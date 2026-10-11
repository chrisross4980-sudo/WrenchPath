/**
 * env.test.ts
 *
 * Unit tests for environment variable validation.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { loadEnv } from "../src/utils/env.ts";

// Helper: save and restore process.env around each test
const saved: Record<string, string | undefined> = {};
const VARS = [
  "SPECTRUM_PROJECT_ID",
  "SPECTRUM_PROJECT_SECRET",
  "PORT",
  "AI_SERVICE_URL",
  "AI_TIMEOUT_MS",
  "LOG_LEVEL",
  "NODE_ENV",
] as const;

beforeEach(() => {
  for (const k of VARS) saved[k] = process.env[k];
  for (const k of VARS) delete process.env[k];
});

afterEach(() => {
  for (const k of VARS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function withEnv(overrides: Partial<Record<(typeof VARS)[number], string>>) {
  Object.assign(process.env, overrides);
}

describe("loadEnv", () => {
  it("throws when SPECTRUM_PROJECT_ID is missing", () => {
    withEnv({ SPECTRUM_PROJECT_SECRET: "s" });
    expect(() => loadEnv()).toThrow("SPECTRUM_PROJECT_ID");
  });

  it("throws when SPECTRUM_PROJECT_SECRET is missing", () => {
    withEnv({ SPECTRUM_PROJECT_ID: "p" });
    expect(() => loadEnv()).toThrow("SPECTRUM_PROJECT_SECRET");
  });

  it("throws listing both missing variables at once", () => {
    expect(() => loadEnv()).toThrow(/SPECTRUM_PROJECT_ID[\s\S]*SPECTRUM_PROJECT_SECRET/);
  });

  it("returns defaults when optional vars are absent", () => {
    withEnv({ SPECTRUM_PROJECT_ID: "pid", SPECTRUM_PROJECT_SECRET: "psec" });
    const env = loadEnv();
    expect(env.PORT).toBe(3000);
    expect(env.AI_SERVICE_URL).toBe("http://localhost:4000");
    expect(env.AI_TIMEOUT_MS).toBe(5000);
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.NODE_ENV).toBe("development");
  });

  it("parses custom PORT", () => {
    withEnv({ SPECTRUM_PROJECT_ID: "p", SPECTRUM_PROJECT_SECRET: "s", PORT: "4321" });
    expect(loadEnv().PORT).toBe(4321);
  });

  it("throws on invalid PORT", () => {
    withEnv({ SPECTRUM_PROJECT_ID: "p", SPECTRUM_PROJECT_SECRET: "s", PORT: "abc" });
    expect(() => loadEnv()).toThrow(/PORT must be a valid port number/);
  });

  it("throws on PORT out of range", () => {
    withEnv({ SPECTRUM_PROJECT_ID: "p", SPECTRUM_PROJECT_SECRET: "s", PORT: "99999" });
    expect(() => loadEnv()).toThrow(/PORT must be a valid port number/);
  });

  it("throws on invalid LOG_LEVEL", () => {
    withEnv({ SPECTRUM_PROJECT_ID: "p", SPECTRUM_PROJECT_SECRET: "s", LOG_LEVEL: "verbose" });
    expect(() => loadEnv()).toThrow(/LOG_LEVEL must be one of/);
  });

  it("throws on AI_TIMEOUT_MS below minimum", () => {
    withEnv({ SPECTRUM_PROJECT_ID: "p", SPECTRUM_PROJECT_SECRET: "s", AI_TIMEOUT_MS: "50" });
    expect(() => loadEnv()).toThrow(/AI_TIMEOUT_MS must be/);
  });

  it("does not include SECRET in the error message", () => {
    withEnv({ SPECTRUM_PROJECT_SECRET: "super_secret_value" });
    try {
      loadEnv();
    } catch (e) {
      expect(String(e)).not.toContain("super_secret_value");
    }
  });
});
