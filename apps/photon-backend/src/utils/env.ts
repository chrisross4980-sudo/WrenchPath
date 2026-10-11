/**
 * env.ts
 *
 * Validates all required environment variables at startup.
 * Call loadEnv() once in index.ts before anything else.
 * Throws with a clear message listing every missing variable so the
 * developer can fix all problems in one run.
 */

export interface Env {
  SPECTRUM_PROJECT_ID: string;
  SPECTRUM_PROJECT_SECRET: string;
  PORT: number;
  AI_SERVICE_URL: string;
  AI_TIMEOUT_MS: number;
  LOG_LEVEL: "debug" | "info" | "warn" | "error";
  NODE_ENV: string;
}

const REQUIRED = ["SPECTRUM_PROJECT_ID", "SPECTRUM_PROJECT_SECRET"] as const;

export function loadEnv(): Env {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `[WrenchPath] Missing required environment variables:\n` +
        missing.map((k) => `  - ${k}`).join("\n") +
        `\n\nCopy .env.example to .env and fill in the values.`
    );
  }

  const port = parseInt(process.env["PORT"] ?? "3000", 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`[WrenchPath] PORT must be a valid port number (got: ${process.env["PORT"]})`);
  }

  const aiTimeout = parseInt(process.env["AI_TIMEOUT_MS"] ?? "5000", 10);
  if (isNaN(aiTimeout) || aiTimeout < 100) {
    throw new Error(`[WrenchPath] AI_TIMEOUT_MS must be >= 100 ms (got: ${process.env["AI_TIMEOUT_MS"]})`);
  }

  const logLevel = process.env["LOG_LEVEL"] ?? "info";
  if (!["debug", "info", "warn", "error"].includes(logLevel)) {
    throw new Error(`[WrenchPath] LOG_LEVEL must be one of: debug, info, warn, error (got: ${logLevel})`);
  }

  return {
    SPECTRUM_PROJECT_ID: process.env["SPECTRUM_PROJECT_ID"]!,
    SPECTRUM_PROJECT_SECRET: process.env["SPECTRUM_PROJECT_SECRET"]!,
    PORT: port,
    AI_SERVICE_URL: process.env["AI_SERVICE_URL"] ?? "http://localhost:4000",
    AI_TIMEOUT_MS: aiTimeout,
    LOG_LEVEL: logLevel as Env["LOG_LEVEL"],
    NODE_ENV: process.env["NODE_ENV"] ?? "development",
  };
}
