/**
 * aiClient.ts
 *
 * HTTP client that forwards user messages to the AI Agent service
 * and returns its reply.
 *
 * POST {AI_SERVICE_URL}/api/chat
 *   Request:  ChatRequest  { conversationId, senderId, message }
 *   Response: ChatResponse { reply }
 *
 * Fails fast on:
 *   - Network errors
 *   - Non-2xx HTTP status
 *   - Response body that doesn't match ChatResponse shape
 *   - Timeout (AI_TIMEOUT_MS, default 5 s)
 */

import { isChatResponse, type ChatRequest, type ChatResponse } from "../types/api.ts";
import { logger } from "../utils/logger.ts";

export class AiServiceError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown
  ) {
    super(message);
    this.name = "AiServiceError";
  }
}

export async function callAiService(
  baseUrl: string,
  timeoutMs: number,
  request: ChatRequest
): Promise<ChatResponse> {
  const url = `${baseUrl}/api/chat`;

  logger.debug("Calling AI service", {
    url,
    conversationId: request.conversationId,
    // senderId and message are intentionally omitted from debug logs
    // to reduce PII exposure in log streams.
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? `AI service timed out after ${timeoutMs}ms`
        : `AI service unreachable: ${err instanceof Error ? err.message : String(err)}`;
    logger.error(message, { conversationId: request.conversationId });
    throw new AiServiceError(message, err);
  }

  if (!response.ok) {
    const message = `AI service returned HTTP ${response.status}`;
    logger.error(message, {
      conversationId: request.conversationId,
      status: response.status,
    });
    throw new AiServiceError(message);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    const message = "AI service returned invalid JSON";
    logger.error(message, { conversationId: request.conversationId });
    throw new AiServiceError(message, err);
  }

  if (!isChatResponse(body)) {
    const message = "AI service response missing or empty `reply` field";
    logger.error(message, { conversationId: request.conversationId });
    throw new AiServiceError(message);
  }

  logger.debug("AI service responded", { conversationId: request.conversationId });
  return body;
}
