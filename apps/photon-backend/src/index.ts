/**
 * index.ts
 *
 * WrenchPath ATL — Photon Backend entry point.
 *
 * Startup sequence:
 *   1. Validate environment variables (fail fast with a clear message).
 *   2. Start the HTTP server (health check on GET /health).
 *   3. Initialize Spectrum with the iMessage provider.
 *   4. Run the message loop — forwards iMessages to the AI Agent service.
 *   5. Wire SIGINT / SIGTERM for graceful shutdown.
 */

import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { loadEnv } from "./utils/env.ts";
import { logger } from "./utils/logger.ts";
import { startServer } from "./server.ts";
import { createMessageHandler } from "./handlers/messageHandler.ts";

// ── 1. Environment ────────────────────────────────────────────────────────────
const env = loadEnv();
logger.info("WrenchPath ATL — Photon Backend starting", {
  port: env.PORT,
  aiServiceUrl: env.AI_SERVICE_URL,
  nodeEnv: env.NODE_ENV,
  // NOTE: SPECTRUM_PROJECT_ID and SPECTRUM_PROJECT_SECRET are never logged.
});

// ── 2. HTTP Server ────────────────────────────────────────────────────────────
const server = startServer(env.PORT);

// ── 3. Spectrum / iMessage ────────────────────────────────────────────────────
logger.info("Initializing Spectrum iMessage provider...");

const app = await Spectrum({
  projectId: env.SPECTRUM_PROJECT_ID,
  projectSecret: env.SPECTRUM_PROJECT_SECRET,
  providers: [imessage.config()],
});

logger.info("Spectrum connected — listening for iMessages");

// ── 4. Graceful Shutdown ──────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info("Shutdown signal received", { signal });
  await app.stop();
  server.stop();
  logger.info("WrenchPath ATL — Photon Backend stopped cleanly");
  process.exit(0);
}

process.once("SIGINT",  () => { void shutdown("SIGINT"); });
process.once("SIGTERM", () => { void shutdown("SIGTERM"); });

logger.info("WrenchPath ATL — Photon Backend ready", { port: server.port });

// ── 5. Message Loop ───────────────────────────────────────────────────────────
const handleMessage = createMessageHandler({ env });

for await (const [space, message] of app.messages) {
  // handleMessage is async but the loop must not await it — Spectrum delivers
  // messages from all conversations on one async iterator, so we process each
  // conversation independently without blocking the loop for other users.
  void handleMessage(space, message).catch((err) => {
    logger.error("Unhandled error in message handler", { error: String(err) });
  });
}
