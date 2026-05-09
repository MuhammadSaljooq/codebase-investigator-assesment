import { NextRequest } from "next/server";
import { apiError, apiOk, newRequestId } from "@/lib/api/response";
import { logEvent } from "@/lib/telemetry/logger";
import { answerQuestionService, askRequestSchema } from "@/lib/services/answerQuestionService";

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  try {
    const body = askRequestSchema.parse(await req.json());
    const result = await answerQuestionService(body);
    logEvent("info", "ask_completed", {
      requestId,
      conversationId: body.conversationId,
      turnIndex: result.turnIndex,
      latencyMs: result.latencyMs,
      retrievalStrategy: result.retrievalDiagnostics.strategy,
      auditVerdict: result.audit.verdict
    });
    return apiOk(requestId, {
      turnId: result.turnId,
      turnIndex: result.turnIndex,
      answer: result.answer,
      audit: result.audit,
      retrievalDiagnostics: result.retrievalDiagnostics
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to answer question.";
    logEvent("error", "ask_failed", {
      requestId,
      message
    });
    if (message === "Conversation not found." || message === "Repository snapshot not found.") {
      return apiError(requestId, "NOT_FOUND", message, 404);
    }
    return apiError(requestId, "ANSWER_FAILED", message, 400);
  }
}
