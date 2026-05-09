import { AnswerPayload } from "@/lib/contracts/answerSchema";
import { AuditPayload, auditSchema } from "@/lib/audit/auditSchema";
import { verifyCitations } from "@/lib/audit/citationVerifier";
import { callJsonModel } from "@/lib/llm/client";

const modelAuditSchema = auditSchema;

export async function runIndependentAudit(input: {
  repoRoot: string;
  question: string;
  answer: AnswerPayload;
  contradictionNotes: string[];
}): Promise<AuditPayload> {
  const verification = verifyCitations(input.repoRoot, input.answer);
  const findings: string[] = [];
  const hallucinatedCitations = [
    ...verification.missingFiles.map((id) => `${id}:missing_file`),
    ...verification.invalidRanges.map((id) => `${id}:invalid_range`)
  ];

  if (hallucinatedCitations.length > 0) {
    findings.push("One or more citations are invalid or refer to missing files.");
  }
  if (verification.weakEvidence.length > 0) {
    findings.push("Some evidence quotes are weakly matched against cited spans.");
  }
  if (verification.exactMismatch.length > 0) {
    findings.push("Some citation quotes do not exactly match cited code spans.");
  }
  if (verification.symbolMismatch.length > 0) {
    findings.push("Some cited symbols are not present in the cited ranges.");
  }
  if (verification.unsupportedClaims.length > 0) {
    findings.push("Some claims are not fully backed by valid citations.");
  }
  if (input.contradictionNotes.length > 0) {
    findings.push("Potential contradictions with prior turns were detected.");
  }

  const programmaticScore = Math.max(
    0,
    1 -
      hallucinatedCitations.length * 0.2 -
      verification.weakEvidence.length * 0.05 -
      verification.exactMismatch.length * 0.1 -
      verification.symbolMismatch.length * 0.1 -
      verification.unsupportedClaims.length * 0.15 -
      input.contradictionNotes.length * 0.1
  );

  const programmaticVerdict: AuditPayload["verdict"] =
    programmaticScore >= 0.8 ? "trustworthy" : programmaticScore >= 0.55 ? "caution" : "unreliable";

  const independentPrompt = `
You are an independent reviewer. You did NOT generate the answer.
Question: ${input.question}
Answer:
${input.answer.answer}

Claims:
${JSON.stringify(input.answer.claims)}

Citations:
${JSON.stringify(input.answer.citations)}

Programmatic checks:
${JSON.stringify(verification)}

Potential contradiction notes:
${JSON.stringify(input.contradictionNotes)}

Return JSON:
{
  "verdict": "trustworthy|caution|unreliable",
  "score": 0.0,
  "findings": ["..."],
  "hallucinatedCitations": ["..."],
  "unsupportedClaims": ["..."],
  "contradictionNotes": ["..."],
  "remediationSuggestions": ["..."]
}
`;

  const modelAudit = await callJsonModel(independentPrompt, modelAuditSchema, {
    model: process.env.AUDITOR_MODEL ?? process.env.ANSWER_MODEL,
    temperature: 0
  });

  const merged: AuditPayload = auditSchema.parse(
    modelAudit ?? {
      verdict: programmaticVerdict,
      score: Number(programmaticScore.toFixed(2)),
      findings,
      hallucinatedCitations,
      unsupportedClaims: verification.unsupportedClaims,
      contradictionNotes: input.contradictionNotes,
      remediationSuggestions: [
        "Prefer narrower, function-level citations for high-impact claims.",
        "Add explicit caveats where code evidence is partial."
      ]
    }
  );

  const hardFailures =
    hallucinatedCitations.length > 0 ||
    verification.exactMismatch.length > 0 ||
    verification.symbolMismatch.length > 0;
  const missingImpactChecklist =
    input.answer.questionType === "recommendation_opinion" &&
    (!input.answer.recommendationImpact ||
      input.answer.recommendationImpact.affectedFiles.length === 0 ||
      !input.answer.recommendationImpact.blastRadius.trim());

  // Hard failure mode: never allow trustworthy verdict with citation integrity issues.
  if (hardFailures && merged.verdict === "trustworthy") {
    return {
      ...merged,
      verdict: "caution",
      findings: [...merged.findings, "Programmatic checks found citation integrity issues."]
    };
  }
  if (missingImpactChecklist) {
    return {
      ...merged,
      verdict: merged.verdict === "unreliable" ? "unreliable" : "caution",
      findings: [...merged.findings, "Recommendation answer is missing full impact checklist fields."]
    };
  }

  return merged;
}
