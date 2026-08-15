# Serverless AI Data Pipeline (RAG)

A highly-scalable, zero-maintenance **Retrieval-Augmented Generation (RAG)** architecture built entirely on Cloudflare's serverless edge network. This project allows users to upload documents and instantly chat with them in real-time, utilizing state-of-the-art AI without relying on expensive third-party APIs like OpenAI.

**Live Demo:** [https://rag-pipeline.pages.dev](https://rag-pipeline.pages.dev)

---

## ⚡ Performance Metrics

This architecture was designed with a strict focus on latency reduction, cost efficiency, and scale. Benchmarks measured directly on the live edge network demonstrate:

*   **Sub-2.5s Document Ingestion:** Achieved high-speed document ingestion (avg. 2261ms) by bypassing traditional monolithic servers, utilizing a distributed Cloudflare Worker and Queue architecture.
*   **1.13s Time-to-First-Token (TTFT):** Engineered a real-time streaming RAG pipeline, reducing perceived user wait times to a ~1,125ms TTFT utilizing WebSockets and Server-Sent Events.
*   **High-Speed Generation:** Delivered full generative AI responses in ~1.2 seconds by querying Meta's LLaMA 3.1 8B model directly on Cloudflare's distributed edge network.

---

## 🏗️ System Architecture

The entire pipeline runs on Cloudflare's distributed edge, scaling to zero when not in use and automatically horizontally scaling to handle thousands of concurrent users.

1.  **Frontend (React/Vite)**
    *   Hosted on **Cloudflare Pages**.
    *   Implements a real-time Chat Interface consuming Server-Sent Events (SSE).
    *   Session persistence via a Document UUID allowing users to "Resume" past chats.
2.  **Upload & Background Processing (Workers & Queues)**
    *   Files are uploaded to a **Cloudflare Worker**, temporarily cached in **KV**, and a message is immediately dropped into a **Cloudflare Queue** to decouple heavy processing from the user's web request.
3.  **Deterministic Chunking (WebAssembly / C++)**
    *   Instead of relying on slow JavaScript parsing, the Queue Consumer passes the raw text to a custom-compiled **C++ WebAssembly (Wasm)** module that deterministically chunks the text for high-throughput semantic processing.
4.  **Vectorization & Storage (Vectorize & D1)**
    *   The Wasm chunks are embedded using `@cf/baai/bge-base-en-v1.5`.
    *   The resulting high-dimensional numerical vectors are stored in **Cloudflare Vectorize** to enable rapid semantic similarity search.
    *   The raw text chunks are simultaneously stored in a **D1 SQLite Database** for later retrieval.
5.  **Retrieval & Generation (Workers AI)**
    *   User queries are embedded and compared against the Vectorize index. 
    *   The top 5 most mathematically similar chunks are pulled from D1 and injected into a localized context window.
    *   The context is sent to `@cf/meta/llama-3.1-8b-instruct-fast`, which streams the answer back to the frontend in real-time.

---

## 🚀 How to Run Locally

### Prerequisites
*   Node.js (v18+)
*   Cloudflare Account & Wrangler CLI (`npm i -g wrangler`)
*   Emscripten (if you want to recompile the C++ Wasm module)

### 1. Backend Setup
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Authenticate Wrangler with your Cloudflare account:
   ```bash
   npx wrangler login
   ```
3. Copy the example configuration:
   ```bash
   cp wrangler.toml.example wrangler.toml
   ```
4. Create your remote databases and replace the placeholder UUIDs in `wrangler.toml`:
   ```bash
   npx wrangler d1 create rag-db
   npx wrangler kv:namespace create DOCUMENT_KV
   npx wrangler vectorize create rag-index --dimensions 768 --metric cosine
   npx wrangler vectorize create-metadata-index rag-index --propertyName document_id --type string
   ```
5. Apply the database schema:
   ```bash
   npx wrangler d1 execute rag-db --remote --file=schema.sql
   ```
6. Start the local development server:
   ```bash
   npm run dev
   ```

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.
