/**
 * server.test.ts
 *
 * Integration tests for the HTTP server.
 * Spins up a real server on a random port, exercises the routes, then stops it.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startServer } from "../src/server.ts";

// Silence logger output during tests
process.env["LOG_LEVEL"] = "error";

let server: ReturnType<typeof startServer>;
let baseUrl: string;

beforeAll(() => {
  // Port 0 → OS assigns a free port
  server = startServer(0);
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop();
});

describe("GET /health", () => {
  it("returns 200 with correct shape", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.service).toBe("wrenchpath-photon-backend");
    expect(typeof body.timestamp).toBe("string");
  });

  it("timestamp is a valid ISO 8601 date", async () => {
    const res = await fetch(`${baseUrl}/health`);
    const body = await res.json() as Record<string, unknown>;
    expect(() => new Date(body.timestamp as string).toISOString()).not.toThrow();
  });
});

describe("Unknown routes", () => {
  it("returns 404 for unknown path", async () => {
    const res = await fetch(`${baseUrl}/unknown`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for POST /health", async () => {
    const res = await fetch(`${baseUrl}/health`, { method: "POST" });
    expect(res.status).toBe(404);
  });
});
