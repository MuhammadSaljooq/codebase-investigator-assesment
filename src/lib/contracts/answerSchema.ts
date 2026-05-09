import { z } from "zod";
import { questionTypeSchema } from "@/lib/contracts/questionTypeSchema";

export const uncertaintySchema = z.enum(["known", "inferred", "speculative"]);

export const citationSchema = z.object({
  filePath: z.string().min(1),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  evidenceQuote: z.string().min(1)
});

export const claimSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]).default("medium"),
  uncertainty: uncertaintySchema,
  citationIds: z.array(z.string().min(1)).min(1)
});

export const recommendationImpactSchema = z.object({
  affectedFiles: z.array(z.string()).default([]),
  blastRadius: z.string().default("unknown"),
  rollbackPlan: z.string().default("No rollback plan provided."),
  testImpact: z.string().default("Test impact not evaluated.")
});

export const answerSchema = z.object({
  questionType: questionTypeSchema,
  answer: z.string().min(1),
  claims: z.array(claimSchema),
  citations: z.record(z.string(), citationSchema),
  uncertainties: z.array(uncertaintySchema),
  tradeoffs: z.array(z.string()).optional(),
  breakageRisks: z.array(z.string()).optional(),
  recommendationImpact: recommendationImpactSchema.optional()
});

export type AnswerPayload = z.infer<typeof answerSchema>;
