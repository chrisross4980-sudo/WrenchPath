/**
 * aiClient.test.ts
 *
 * Unit tests for the AI service HTTP client.
 * All network calls are intercepted with a mock fetch — no real HTTP.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { callAiService, AiServiceError } from "../src/services/aiClient.ts";

// Silence logger during tests
process.env["LOG_LEVEL"] = "error";

const BASE_URL = "http://localhost:4000";
const TIMEOUT_MS = 1000;
const VALID_REQUEST = {
  conversationId: "conv-123",
  senderId: "user-456",
  message: "I want to become an EV technician.",
};

// Helper to create a mock fetch response
function mockFetch(body: unknown, status = 200): typeof globalThis.fetch {
  return mock(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    )
  ) as unknown as typeof globalThis.fetch;
}

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("callAiService", () => {
  it("returns the reply on a successful response", async () => {
    globalThis.fetch = mockFetch({ reply: "Great, let's build your roadmap." });
    const result = await callAiService(BASE_URL, TIMEOUT_MS, VALID_REQUEST);
    expect(result.reply).toBe("Great, let's build your roadmap.");
  });

  it("calls the correct URL and method", async () => {
    let capturedUrl: string | undefined;
    let capturedMethod: string | undefined;
    globalThis.fetch = mock((input: Request | string | URL, init?: RequestInit) => {
      capturedUrl = input instanceof Request ? input.url : String(input);
      capturedMethod = input instanceof Request ? input.method : (init?.method ?? "GET");
      return Promise.resolve(
        new Response(JSON.stringify({ reply: "ok" }), { status: 200 })
      );
    }) as unknown as typeof fetch;

    await callAiService(BASE_URL, TIMEOUT_MS, VALID_REQUEST);
    expect(capturedUrl).toBe("http://localhost:4000/api/chat");
    expect(capturedMethod).toBe("POST");
  });

  it("sends the correct request body", async () => {
    let capturedBody: unknown;
    globalThis.fetch = mock((_input: Request | string | URL, init?: RequestInit) => {
      try {
        capturedBody = JSON.parse(init?.body as string);
      } catch {
        capturedBody = null;
      }
      return Promise.resolve(new Response(JSON.stringify({ reply: "ok" }), { status: 200 }));
    }) as unknown as typeof fetch;

    await callAiService(BASE_URL, TIMEOUT_MS, VALID_REQUEST);
    expect(capturedBody).toEqual(VALID_REQUEST);
  });

  it("throws AiServiceError on non-2xx status", async () => {
    globalThis.fetch = mockFetch({ error: "not found" }, 404);
    await expect(callAiService(BASE_URL, TIMEOUT_MS, VALID_REQUEST)).rejects.toThrow(
      AiServiceError
    );
  });

  it("throws AiServiceError on 500 status", async () => {
    globalThis.fetch = mockFetch({ error: "internal error" }, 500);
    await expect(callAiService(BASE_URL, TIMEOUT_MS, VALID_REQUEST)).rejects.toThrow(
      /HTTP 500/
    );
  });

  it("throws AiServiceError when reply field is missing", async () => {
    globalThis.fetch = mockFetch({ message: "wrong shape" });
    await expect(callAiService(BASE_URL, TIMEOUT_MS, VALID_REQUEST)).rejects.toThrow(
      AiServiceError
    );
  });

  it("throws AiServiceError when reply is empty string", async () => {
    globalThis.fetch = mockFetch({ reply: "" });
    await expect(callAiService(BASE_URL, TIMEOUT_MS, VALID_REQUEST)).rejects.toThrow(
      AiServiceError
    );
  });

  it("throws AiServiceError when reply is not a string", async () => {
    globalThis.fetch = mockFetch({ reply: 42 });
    await expect(callAiService(BASE_URL, TIMEOUT_MS, VALID_REQUEST)).rejects.toThrow(
      AiServiceError
    );
  });

  it("throws AiServiceError when fetch rejects (network error)", async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error("ECONNREFUSED"))
    ) as unknown as typeof fetch;
    await expect(callAiService(BASE_URL, TIMEOUT_MS, VALID_REQUEST)).rejects.toThrow(
      AiServiceError
    );
  });

  it("throws AiServiceError on timeout", async () => {
    const timeoutError = new DOMException("The operation was aborted.", "TimeoutError");
    globalThis.fetch = mock(() => Promise.reject(timeoutError)) as unknown as typeof fetch;
    const err = await callAiService(BASE_URL, TIMEOUT_MS, VALID_REQUEST).catch((e) => e);
    expect(err).toBeInstanceOf(AiServiceError);
    expect(err.message).toMatch(/timed out/);
  });

  it("throws AiServiceError on invalid JSON body", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("not json", { status: 200 }))
    ) as unknown as typeof fetch;
    await expect(callAiService(BASE_URL, TIMEOUT_MS, VALID_REQUEST)).rejects.toThrow(
      AiServiceError
    );
  });
});
