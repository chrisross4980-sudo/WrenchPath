/**
 * messageHandler.test.ts
 *
 * Unit tests for the Spectrum message handler.
 *
 * All external dependencies (aiClient) are injected as mocks via the
 * `aiClient` config parameter — no module monkey-patching needed.
 * These tests verify routing, deduplication, welcome greeting, and
 * AI error fallback without real credentials or a live iMessage connection.
 */

import { describe, it, expect, mock, beforeEach } from "bun:test";
import { createMessageHandler } from "../src/handlers/messageHandler.ts";
import { AiServiceError } from "../src/services/aiClient.ts";
import type { Env } from "../src/utils/env.ts";
import type { AiClientFn } from "../src/handlers/messageHandler.ts";

// Silence logger during tests
process.env["LOG_LEVEL"] = "error";

// ── Mock helpers ──────────────────────────────────────────────────────────────

const TEST_ENV: Env = {
  SPECTRUM_PROJECT_ID: "test-id",
  SPECTRUM_PROJECT_SECRET: "test-secret",
  PORT: 3000,
  AI_SERVICE_URL: "http://localhost:4000",
  AI_TIMEOUT_MS: 1000,
  LOG_LEVEL: "error",
  NODE_ENV: "test",
};

type SendCall = { type: string; text?: string };

/** Spectrum content builder shape — has a build() fn that resolves the real content. */
type ContentBuilder = { build: (ctx: unknown) => Promise<SendCall> };

function makeSpace(id = "space-1") {
  const sends: SendCall[] = [];
  return {
    id,
    sends,
    send: mock(async (content: ContentBuilder) => {
      // Resolve the lazy builder so tests can inspect .text
      const resolved = await content.build({});
      sends.push(resolved);
    }),
    responding: mock(async (fn: () => Promise<void>) => {
      await fn();
    }),
  };
}

function makeMessage(overrides: {
  id?: string;
  text?: string;
  direction?: "inbound" | "outbound";
  contentType?: string;
  senderId?: string;
}) {
  return {
    id: overrides.id ?? "msg-1",
    direction: overrides.direction ?? "inbound",
    content: {
      type: overrides.contentType ?? "text",
      text: overrides.text ?? "Hello",
    },
    sender: { id: overrides.senderId ?? "user-1", __platform: "imessage" },
    platform: "imessage",
  };
}

// ── Default mock AI client ────────────────────────────────────────────────────

let mockAiClient: AiClientFn;

beforeEach(() => {
  mockAiClient = mock(async () => ({ reply: "Here is your career roadmap." }));
});

function makeHandler(aiClient = mockAiClient) {
  return createMessageHandler({ env: TEST_ENV, aiClient });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createMessageHandler", () => {
  it("sends welcome greeting on first message in a conversation", async () => {
    const space = makeSpace();
    const handle = makeHandler();

    await handle(space as never, makeMessage({}) as never);

    expect(space.sends.length).toBe(2);
    expect(space.sends[0]?.text).toMatch(/WrenchPath ATL/);
  });

  it("does NOT send welcome greeting on second message in same conversation", async () => {
    const space = makeSpace();
    const handle = makeHandler();

    await handle(space as never, makeMessage({ id: "m1", text: "First message" }) as never);
    space.sends.length = 0;

    await handle(space as never, makeMessage({ id: "m2", text: "Second message" }) as never);

    expect(space.sends.length).toBe(1);
    expect(space.sends[0]?.text).not.toMatch(/WrenchPath ATL/);
  });

  it("sends greeting again for a new conversation (different space)", async () => {
    const space1 = makeSpace("space-A");
    const space2 = makeSpace("space-B");
    const handle = makeHandler();

    await handle(space1 as never, makeMessage({ id: "m1" }) as never);
    await handle(space2 as never, makeMessage({ id: "m2" }) as never);

    expect(space1.sends[0]?.text).toMatch(/WrenchPath ATL/);
    expect(space2.sends[0]?.text).toMatch(/WrenchPath ATL/);
  });

  it("calls aiClient with correct conversationId, senderId, message", async () => {
    const space = makeSpace("conv-xyz");
    const handle = makeHandler();

    await handle(
      space as never,
      makeMessage({ id: "m1", text: "Want EV cert", senderId: "user-999" }) as never
    );

    expect(mockAiClient).toHaveBeenCalledTimes(1);
    const [calledUrl, calledTimeout, calledReq] = (mockAiClient as ReturnType<typeof mock>).mock
      .calls[0] as [string, number, { conversationId: string; senderId: string; message: string }];
    expect(calledUrl).toBe("http://localhost:4000");
    expect(calledTimeout).toBe(1000);
    expect(calledReq.conversationId).toBe("conv-xyz");
    expect(calledReq.senderId).toBe("user-999");
    expect(calledReq.message).toBe("Want EV cert");
  });

  it("sends AI reply to the space", async () => {
    const customAi: AiClientFn = mock(async () => ({ reply: "Your roadmap is ready." }));
    const space = makeSpace();
    const handle = makeHandler(customAi);

    await handle(space as never, makeMessage({ id: "m1" }) as never);

    const lastSend = space.sends[space.sends.length - 1];
    expect(lastSend?.text).toBe("Your roadmap is ready.");
  });

  it("sends fallback message when AI service throws AiServiceError", async () => {
    const failingAi: AiClientFn = mock(async () => {
      throw new AiServiceError("timeout");
    });
    const space = makeSpace();
    const handle = makeHandler(failingAi);

    await handle(space as never, makeMessage({ id: "m1" }) as never);

    const lastSend = space.sends[space.sends.length - 1];
    expect(lastSend?.text).toMatch(/trouble connecting/);
  });

  it("sends fallback message when AI service throws an unexpected error", async () => {
    const failingAi: AiClientFn = mock(async () => {
      throw new Error("something unexpected");
    });
    const space = makeSpace();
    const handle = makeHandler(failingAi);

    await handle(space as never, makeMessage({ id: "m1" }) as never);

    const lastSend = space.sends[space.sends.length - 1];
    expect(lastSend?.text).toMatch(/trouble connecting/);
  });

  it("ignores outbound messages", async () => {
    const space = makeSpace();
    const handle = makeHandler();

    await handle(space as never, makeMessage({ direction: "outbound" }) as never);

    expect(space.sends.length).toBe(0);
    expect(mockAiClient).not.toHaveBeenCalled();
  });

  it("ignores non-text content types", async () => {
    const space = makeSpace();
    const handle = makeHandler();

    await handle(space as never, makeMessage({ contentType: "reaction" }) as never);

    expect(space.sends.length).toBe(0);
    expect(mockAiClient).not.toHaveBeenCalled();
  });

  it("ignores empty messages (whitespace only)", async () => {
    const space = makeSpace();
    const handle = makeHandler();

    await handle(space as never, makeMessage({ id: "m1", text: "   " }) as never);

    expect(space.sends.length).toBe(0);
    expect(mockAiClient).not.toHaveBeenCalled();
  });

  it("deduplicates messages with the same ID", async () => {
    const space = makeSpace();
    const handle = makeHandler();

    await handle(space as never, makeMessage({ id: "dup-1", text: "Hello" }) as never);
    space.sends.length = 0;

    await handle(space as never, makeMessage({ id: "dup-1", text: "Hello" }) as never);

    expect(space.sends.length).toBe(0);
    expect(mockAiClient).toHaveBeenCalledTimes(1);
  });

  it("uses space.responding() for every processed message", async () => {
    const space = makeSpace();
    const handle = makeHandler();

    await handle(space as never, makeMessage({ id: "m1" }) as never);

    expect(space.responding).toHaveBeenCalledTimes(1);
  });

  it("processes different conversations independently (no cross-contamination)", async () => {
    const spaceA = makeSpace("space-A");
    const spaceB = makeSpace("space-B");
    const aiA: AiClientFn = mock(async () => ({ reply: "Reply for A" }));
    const aiB: AiClientFn = mock(async () => ({ reply: "Reply for B" }));

    // Two separate handlers simulating two concurrent conversations
    const handleA = makeHandler(aiA);
    const handleB = makeHandler(aiB);

    await handleA(spaceA as never, makeMessage({ id: "ma1" }) as never);
    await handleB(spaceB as never, makeMessage({ id: "mb1" }) as never);

    const lastA = spaceA.sends[spaceA.sends.length - 1];
    const lastB = spaceB.sends[spaceB.sends.length - 1];
    expect(lastA?.text).toBe("Reply for A");
    expect(lastB?.text).toBe("Reply for B");
  });
});
