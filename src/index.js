import { AutoRouter } from "itty-router";
import { DocumentProgress } from "./durable_object.js";
import chunkerWasm from "./chunker.wasm";

export { DocumentProgress };

const router = AutoRouter();

const getCorsHeaders = (env) => ({
  "Access-Control-Allow-Origin": env.FRONTEND_URL,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
});

router.options("*", (request, env) => new Response(null, { headers: getCorsHeaders(env) }));

router.post("/upload", async (request, env, ctx) => {
  try {
    const document_id = crypto.randomUUID();

    // Parse incoming document
    const contentType = request.headers.get("content-type") || "";

    let rawText = "";
    if (contentType.includes("application/json")) {
      const data = await request.json();
      rawText = data.text;
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (file) {
        rawText = await file.text();
      }
    } else {
      rawText = await request.text();
    }

    if (!rawText) {
      return new Response("Missing document text", { status: 400, headers: getCorsHeaders(env) });
    }

    await env.DOCUMENT_KV.put(document_id, rawText);

    await env.PROCESSING_QUEUE.send({
      document_id
    });

    const wsUrl = new URL(request.url);
    wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
    wsUrl.pathname = `/ws/${document_id}`;

    return new Response(JSON.stringify({
      success: true,
      document_id,
      ws_url: wsUrl.toString()
    }), {
      headers: { "Content-Type": "application/json", ...getCorsHeaders(env) }
    });
  } catch (err) {
    return new Response(err.message, { status: 500, headers: getCorsHeaders(env) });
  }
});

router.post("/query", async (request, env, ctx) => {
  try {
    const { query, document_id } = await request.json();
    if (!query) {
      return new Response("Missing query", { status: 400, headers: getCorsHeaders(env) });
    }

    const embeddingsResp = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [query] });
    const queryVector = embeddingsResp.data[0];

    const searchOptions = { topK: 5 };
    if (document_id) {
      searchOptions.filter = { document_id };
    }
    const searchResp = await env.RAG_INDEX.query(queryVector, searchOptions);
    if (!searchResp.matches.length) {
      const emptyStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`data: {"response":"I could not find any relevant information in the uploaded document to answer your question."}\n\ndata: [DONE]\n\n`));
          controller.close();
        }
      });
      return new Response(emptyStream, { headers: { "Content-Type": "text/event-stream", ...getCorsHeaders(env) } });
    }

    const placeholders = searchResp.matches.map(() => '?').join(',');
    const chunkIds = searchResp.matches.map(m => m.id);
    const d1Resp = await env.DOCUMENT_META.prepare(
      `SELECT text FROM chunks WHERE id IN (${placeholders})`
    ).bind(...chunkIds).all();

    const contextText = d1Resp.results.map(r => r.text).join('\n\n---\n\n');

    const systemPrompt = `You are a helpful assistant. Use the following document context to answer the user's question. If the answer is not in the context, say you don't know.\n\nContext:\n${contextText}`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: query }
    ];

    const stream = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', { messages, stream: true });

    return new Response(stream, { headers: { "Content-Type": "text/event-stream", ...getCorsHeaders(env) } });
  } catch (err) {
    console.error("Query Error:", err.stack);
    return new Response(err.message, { status: 500, headers: getCorsHeaders(env) });
  }
});

// Fallback
router.all("*", () => new Response("Not Found", { status: 404 }));

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/ws/")) {
      try {
        if (request.headers.get("Upgrade") !== "websocket") {
          return new Response("Expected Upgrade: websocket", { status: 426 });
        }
        const document_id = url.pathname.split("/")[2];
        const id = env.DOCUMENT_PROGRESS.idFromName(document_id);
        const stub = env.DOCUMENT_PROGRESS.get(id);
        return stub.fetch(request);
      } catch (err) {
        console.error("WS Error:", err.stack);
        return new Response(err.message, { status: 500 });
      }
    }
    return router.fetch(request, env, ctx);
  },

  async queue(batch, env, ctx) {
    for (const message of batch.messages) {
      const { document_id } = message.body;

      const id = env.DOCUMENT_PROGRESS.idFromName(document_id);
      const stub = env.DOCUMENT_PROGRESS.get(id);

      const broadcastStatus = async (status) => {
        const req = new Request("http://internal/broadcast", { method: "POST", body: status });
        ctx.waitUntil(stub.fetch(req));
      };

      try {
        await broadcastStatus("Status: Processing started");

        // Fetch from KV
        const text = await env.DOCUMENT_KV.get(document_id);
        if (!text) {
          if (message.attempts < 5) {
            const backoffSeconds = Math.pow(2, message.attempts);
            message.retry({ delaySeconds: backoffSeconds });
            continue;
          } else {
            throw new Error("KV Object not found after maximum retries");
          }
        }

        const wasmInstance = await WebAssembly.instantiate(chunkerWasm, {});
        const chunks = await processWithWasm(wasmInstance.exports, text);

        await broadcastStatus("Status: Chunking complete");

        await env.DOCUMENT_META.prepare(
          "INSERT OR IGNORE INTO documents (id) VALUES (?)"
        ).bind(document_id).run();

        let allVectors = [];
        const batchSize = 10;

        for (let i = 0; i < chunks.length; i += batchSize) {
          const chunkBatch = chunks.slice(i, i + batchSize);

          const embeddingsResp = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: chunkBatch });
          const embeddings = embeddingsResp.data;

          const statements = [];

          const vectors = chunkBatch.map((textChunk, idx) => {
            const chunkId = `${document_id}-${i + idx}`;

            statements.push(
              env.DOCUMENT_META.prepare(
                "INSERT INTO chunks (id, document_id, text, vector_idx) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET text=excluded.text"
              ).bind(chunkId, document_id, textChunk, i + idx)
            );

            return {
              id: chunkId,
              values: embeddings[idx],
              metadata: { document_id }
            };
          });

          await env.DOCUMENT_META.batch(statements);
          allVectors.push(...vectors);
        }

        await broadcastStatus("Status: Embeddings complete");

        // Upsert for idempotency on retries
        for (let i = 0; i < allVectors.length; i += 1000) {
          await env.RAG_INDEX.upsert(allVectors.slice(i, i + 1000));
        }

        await broadcastStatus("Status: Done");
        message.ack();

      } catch (err) {
        await broadcastStatus(`Status: Error - ${err.message}`);
        // If it's a retryable error, don't ack, so it will retry
      }
    }
  }
};

async function processWithWasm(exports, text) {
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);

  const ptr = exports.malloc(textBytes.length + 1);
  const memory = new Uint8Array(exports.memory.buffer);
  memory.set(textBytes, ptr);
  memory[ptr + textBytes.length] = 0;

  const resultPtr = exports.chunk_text(ptr);

  const view = new DataView(exports.memory.buffer);
  const count = view.getInt32(resultPtr, true);
  const chunksPtr = view.getUint32(resultPtr + 4, true);

  const chunks = [];
  for (let i = 0; i < count; i++) {
    const chunkStrPtr = view.getUint32(chunksPtr + i * 4, true);

    let end = chunkStrPtr;
    while (memory[end] !== 0) end++;

    const chunkBytes = memory.slice(chunkStrPtr, end);
    const decoder = new TextDecoder();
    chunks.push(decoder.decode(chunkBytes));
  }

  exports.free_result(resultPtr);
  exports.free(ptr);

  return chunks;
}
