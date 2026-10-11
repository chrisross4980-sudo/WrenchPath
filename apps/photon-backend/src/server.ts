/**
 * server.ts
 *
 * Minimal HTTP server for the Photon backend.
 *
 * Routes:
 *   GET  /health  →  200 { status: "ok", service, timestamp }
 *
 * The server is intentionally small — the primary interface for
 * WrenchPath is iMessage via Spectrum, not HTTP. This server exists
 * for health monitoring and future webhook endpoints.
 */

import { logger } from "./utils/logger.ts";

interface ServerHandle {
  port: number;
  stop: () => void;
}

export function startServer(port: number): ServerHandle {
  const server = Bun.serve({
    port,
    fetch(request: Request): Response {
      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/health") {
        return Response.json({
          status: "ok",
          service: "wrenchpath-photon-backend",
          timestamp: new Date().toISOString(),
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  const boundPort = server.port ?? port;
  logger.info("HTTP server started", { port: boundPort });

  return {
    port: boundPort,
    stop: () => {
      server.stop();
      logger.info("HTTP server stopped");
    },
  };
}
