import { DurableObject } from "cloudflare:workers";

export class DocumentProgress extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    
    // Internal API to broadcast status updates
    if (request.method === "POST" && url.pathname === "/broadcast") {
      const data = await request.text();
      
      // Get all accepted WebSockets and broadcast
      const websockets = this.ctx.getWebSockets();
      for (const ws of websockets) {
        try {
          ws.send(data);
        } catch (e) {
          // Let hibernation API manage disconnects automatically
        }
      }
      return new Response("Broadcasted", { status: 200 });
    }

    // WebSocket upgrade request from the client
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      // Opt into WebSocket Hibernation API
      this.ctx.acceptWebSocket(server);
      
      // Send initial connection status
      server.send("Status: Connected to Document Progress Tracker");
      
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response("Not found", { status: 404 });
  }

  webSocketMessage(ws, message) {
    // Not needed, client doesn't send data
  }

  webSocketClose(ws, code, reason, wasClean) {
    // Handled automatically by the hibernation API
  }

  webSocketError(ws, error) {
    // Handled automatically by the hibernation API
  }
}
