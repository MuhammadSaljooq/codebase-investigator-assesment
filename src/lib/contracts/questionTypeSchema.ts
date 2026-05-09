import { z } from "zod";

export const questionTypeSchema = z.enum([
  "retrieval_explanation",
  "evaluation_risk",
  "recommendation_opinion"
]);

export type QuestionType = z.infer<typeof questionTypeSchema>;

export function classifyQuestionType(question: string): QuestionType {
  const normalized = question.toLowerCase();
  const recommendationHints = [
    "what would you change",
    "suggest",
    "better way",
    "should we",
    "recommend"
  ];
  const evaluationHints = [
    "risky",
    "risk",
    "off",
    "dead code",
    "safe to delete",
    "does it need",
    "problem",
    "issue"
  ];

  if (recommendationHints.some((hint) => normalized.includes(hint))) {
    return "recommendation_opinion";
  }

  if (evaluationHints.some((hint) => normalized.includes(hint))) {
    return "evaluation_risk";
  }

  return "retrieval_explanation";
}
