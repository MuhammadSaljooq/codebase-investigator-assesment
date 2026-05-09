import { z } from "zod";
import { database } from "@/lib/db/client";
import { retrieveContext } from "@/lib/retrieval/retrieveContext";
import { generateAnswer } from "@/lib/investigator/generateAnswer";
import { answerSchema } from "@/lib/contracts/answerSchema";
import { buildLedgerFromHistory } from "@/lib/memory/claimLedger";
import { detectContradictions } from "@/lib/memory/contradictionCheck";
import { runIndependentAudit } from "@/lib/audit/runIndependentAudit";
import { classifyQuestionType } from "@/lib/contracts/questionTypeSchema";
import { inferClaimLineage } from "@/lib/memory/claimLineage";
import { recordAskMetrics } from "@/lib/telemetry/metrics";

export const askRequestSchema = z.object({
  conversationId: z.number().int().positive(),
  question: z.string().min(1)
});

export type AskRequest = z.infer<typeof askRequestSchema>;

export interface AskServiceResult {
  turnId: number;
  turnIndex: number;
  answer: z.infer<typeof answerSchema>;
  audit: Awaited<ReturnType<typeof runIndependentAudit>>;
  retrievalDiagnostics: {
    strategy: "hybrid" | "lexical_only";
    totalChunks: number;
    returnedChunks: number;
    cacheHit: boolean;
  };
  latencyMs: number;
}

export async function answerQuestionService(input: AskRequest): Promise<AskServiceResult> {
  const startedAt = Date.now();
  const conversation = database.getConversation(input.conversationId);
  if (!conversation) {
    throw new Error("Conversation not found.");
  }
  const snapshot = database.getRepoSnapshot(conversation.repo_snapshot_id);
  if (!snapshot) {
    throw new Error("Repository snapshot not found.");
  }

  const history = database.getConversationHistory(input.conversationId);
  const questionType = classifyQuestionType(input.question);
  const ledger = buildLedgerFromHistory(
    history.map((turn) => ({
      turnIndex: turn.turnIndex,
      claims: turn.claims.map((claim) => ({
        claim_key: claim.claim_key,
        statement: claim.statement,
        uncertainty: claim.uncertainty as "known" | "inferred" | "speculative"
      }))
    }))
  );

  const retrieval = await retrieveContext({
    repoRoot: snapshot.local_path,
    repoSha: snapshot.commit_sha,
    question: input.question,
    questionType,
    limit: 10
  });
  const priorSummary = history
    .slice(-3)
    .map((turn) => `Turn ${turn.turnIndex}: ${turn.questionType} - ${turn.answer.slice(0, 220)}`)
    .join("\n");

  const draftAnswer = await generateAnswer({
    question: input.question,
    chunks: retrieval.chunks,
    priorSummary
  });
  const parsedAnswer = answerSchema.parse(draftAnswer);
  const contradictionResult = detectContradictions(ledger, parsedAnswer.claims);
  const lineage = inferClaimLineage(
    history.flatMap((turn) =>
      turn.claims.map((claim) => ({ claim_key: claim.claim_key, statement: claim.statement }))
    ),
    parsedAnswer.claims.map((claim) => ({ id: claim.id, statement: claim.statement }))
  );

  const audit = await runIndependentAudit({
    repoRoot: snapshot.local_path,
    question: input.question,
    answer: parsedAnswer,
    contradictionNotes: contradictionResult.notes
  });

  const stored = database.insertTurnWithArtifacts({
    conversationId: input.conversationId,
    question: input.question,
    questionType: parsedAnswer.questionType,
    answerPayload: parsedAnswer,
    auditPayload: audit,
    claimLineage: lineage
  });

  const latencyMs = Date.now() - startedAt;
  recordAskMetrics({
    latencyMs,
    retrievalStrategy: retrieval.diagnostics.strategy,
    citationFailures: audit.hallucinatedCitations.length,
    verdict: audit.verdict
  });

  return {
    turnId: stored.turnId,
    turnIndex: stored.turnIndex,
    answer: parsedAnswer,
    audit,
    retrievalDiagnostics: retrieval.diagnostics,
    latencyMs
  };
}
