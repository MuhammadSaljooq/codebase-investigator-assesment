import { z } from "zod";
import { answerSchema, AnswerPayload, citationSchema } from "@/lib/contracts/answerSchema";
import { classifyQuestionType } from "@/lib/contracts/questionTypeSchema";
import { CodeChunk } from "@/lib/index/chunker";
import { callJsonModel } from "@/lib/llm/client";

const modelOutputSchema = answerSchema.extend({
  citations: z.record(z.string(), citationSchema)
});

function buildFallback(question: string, chunks: CodeChunk[]): AnswerPayload {
  const questionType = classifyQuestionType(question);
  const selected = chunks.slice(0, Math.min(chunks.length, 3));
  const citations: AnswerPayload["citations"] = {};
  const claims: AnswerPayload["claims"] = [];
  selected.forEach((chunk, index) => {
    const key = `c${index + 1}`;
    const firstLine = chunk.content.split("\n")[0] ?? "";
    citations[key] = {
      filePath: chunk.filePath,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      evidenceQuote: firstLine.slice(0, 180) || chunk.content.slice(0, 180)
    };
    claims.push({
      id: `claim_${index + 1}`,
      statement: `The codebase includes logic in ${chunk.filePath} related to your question.`,
      severity: "medium",
      uncertainty: "inferred",
      citationIds: [key]
    });
  });

  const answerLines = selected.map(
    (chunk, index) =>
      `${index + 1}. ${chunk.filePath} lines ${chunk.startLine}-${chunk.endLine} appear relevant to "${question}".`
  );
  const payload: AnswerPayload = {
    questionType,
    answer:
      answerLines.length > 0
        ? `Based on the retrieved code, here are the most relevant areas:\n${answerLines.join("\n")}`
        : "No relevant code chunks were retrieved.",
    claims,
    citations,
    uncertainties: ["inferred"],
    tradeoffs:
      questionType === "recommendation_opinion"
        ? ["Recommendation quality is limited when repository context is partial."]
        : undefined,
    breakageRisks:
      questionType === "recommendation_opinion"
        ? ["Applying changes without integration tests may introduce regressions."]
        : undefined,
    recommendationImpact:
      questionType === "recommendation_opinion"
        ? {
            affectedFiles: selected.map((chunk) => chunk.filePath),
            blastRadius: "Medium; recommendation touches behavior in cited modules.",
            rollbackPlan: "Revert targeted file changes and rerun regression checks.",
            testImpact: "Requires unit and integration tests around touched flows."
          }
        : undefined
  };
  return answerSchema.parse(payload);
}

export async function generateAnswer(input: {
  question: string;
  chunks: CodeChunk[];
  priorSummary: string;
}): Promise<AnswerPayload> {
  const questionType = classifyQuestionType(input.question);
  const context = input.chunks
    .map(
      (chunk, index) =>
        `Chunk ${index + 1} | ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}\n${chunk.content}`
    )
    .join("\n\n---\n\n");

  const prompt = `
You are a code investigator.
Question type: ${questionType}
Prior context summary:
${input.priorSummary || "none"}

Question:
${input.question}

Evidence chunks:
${context}

Return JSON matching this schema:
{
  "questionType": "retrieval_explanation|evaluation_risk|recommendation_opinion",
  "answer": "string",
  "claims": [{"id":"string","statement":"string","severity":"low|medium|high","uncertainty":"known|inferred|speculative","citationIds":["c1"]}],
  "citations": {"c1":{"filePath":"string","startLine":1,"endLine":2,"evidenceQuote":"string"}},
  "uncertainties": ["known|inferred|speculative"],
  "tradeoffs": ["string optional"],
  "breakageRisks": ["string optional"],
  "recommendationImpact": {
    "affectedFiles": ["string"],
    "blastRadius": "string",
    "rollbackPlan": "string",
    "testImpact": "string"
  }
}

Rules:
- Every claim must reference at least one citation id.
- Do not invent files or line ranges beyond provided chunks.
- If questionType is recommendation_opinion, include tradeoffs, breakageRisks, and recommendationImpact.
`;

  const modelResult = await callJsonModel(prompt, modelOutputSchema, {
    model: process.env.ANSWER_MODEL
  });

  if (!modelResult) {
    return buildFallback(input.question, input.chunks);
  }

  return answerSchema.parse({
    ...modelResult,
    questionType
  });
}
