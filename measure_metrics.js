const API_URL = "https://rag-pipeline.ateate8228.workers.dev";

async function runTests() {
  console.log("🚀 Starting Performance Metrics Test on Live Cloudflare Edge...\n");


  const textPayload = "This is a test document to measure the performance of our Serverless RAG pipeline. It contains multiple sentences. We want to see how fast the edge network can handle this.";

  const uploadStart = Date.now();
  const uploadRes = await fetch(`${API_URL}/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: textPayload })
  });

  if (!uploadRes.ok) throw new Error("Upload failed: " + await uploadRes.text());

  const uploadData = await uploadRes.json();
  const uploadEnd = Date.now();

  const uploadLatency = uploadEnd - uploadStart;
  console.log(`✅ Upload Request Latency: ${uploadLatency}ms`);
  console.log(`   (Document ID: ${uploadData.document_id})`);

  // Allow time for Vectorize global propagation
  console.log("\n⏳ Waiting 5 seconds for Cloudflare Vectorize global propagation...\n");
  await new Promise(r => setTimeout(r, 5000));

  console.log("🤖 Querying LLaMA 3.1 8B...");
  const queryStart = Date.now();

  const queryRes = await fetch(`${API_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "What is this document about?", document_id: uploadData.document_id })
  });

  const reader = queryRes.body.getReader();
  let firstTokenTime = null;
  let fullResponseTime = null;

  while (true) {
    const { done, value } = await reader.read();
    if (value && !firstTokenTime) {
      firstTokenTime = Date.now();
      console.log(`✅ Time to First Token (TTFT): ${firstTokenTime - queryStart}ms`);
    }
    if (done) {
      fullResponseTime = Date.now();
      break;
    }
  }

  const ttft = firstTokenTime - queryStart;
  const totalGen = fullResponseTime - queryStart;

  console.log(`✅ Total Generation Time: ${totalGen}ms`);
  console.log("\n=========================================");
  console.log("📊 SUGGESTED METRICS FOR YOUR CV:");
  console.log("=========================================");
  console.log(`* "Achieved sub-${Math.ceil(uploadLatency / 50) * 50}ms document ingestion latency by deploying a highly-available Cloudflare Worker..."`);
  console.log(`* "Engineered a real-time streaming RAG pipeline, reducing perceived latency to a ${ttft}ms Time-to-First-Token (TTFT) using Server-Sent Events."`);
  console.log(`* "Delivered full generative AI responses in ${(totalGen / 1000).toFixed(2)} seconds by querying Meta LLaMA 3.1 8B directly on Cloudflare's edge network."`);
  console.log("=========================================\n");
}

runTests().catch(console.error);
