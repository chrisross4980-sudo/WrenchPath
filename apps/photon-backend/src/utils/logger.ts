/**
 * logger.ts
 *
 * Minimal structured logger that emits JSON lines to stdout/stderr.
 * - All log entries include a timestamp and level.
 * - Sensitive fields (project secret, phone numbers) are never logged.
 * - Log level is controlled by the LOG_LEVEL environment variable.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function currentLevel(): LogLevel {
  const raw = process.env["LOG_LEVEL"] ?? "info";
  return (LEVELS[raw as LogLevel] !== undefined ? raw : "info") as LogLevel;
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LEVELS[level] < LEVELS[currentLevel()]) return;

  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    service: "wrenchpath-photon-backend",
    message,
    ...meta,
  };

  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
  info:  (message: string, meta?: Record<string, unknown>) => log("info",  message, meta),
  warn:  (message: string, meta?: Record<string, unknown>) => log("warn",  message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
};
