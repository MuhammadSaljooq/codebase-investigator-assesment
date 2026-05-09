import fs from "node:fs";
import path from "node:path";
import { AnswerPayload } from "@/lib/contracts/answerSchema";

export interface CitationVerificationResult {
  missingFiles: string[];
  invalidRanges: string[];
  weakEvidence: string[];
  exactMismatch: string[];
  symbolMismatch: string[];
  unsupportedClaims: string[];
}

export function verifyCitations(repoRoot: string, answer: AnswerPayload): CitationVerificationResult {
  const missingFiles: string[] = [];
  const invalidRanges: string[] = [];
  const weakEvidence: string[] = [];
  const exactMismatch: string[] = [];
  const symbolMismatch: string[] = [];
  const unsupportedClaims: string[] = [];

  for (const [citationKey, citation] of Object.entries(answer.citations)) {
    const absPath = path.join(repoRoot, citation.filePath);
    if (!fs.existsSync(absPath)) {
      missingFiles.push(citationKey);
      continue;
    }
    const lines = fs.readFileSync(absPath, "utf8").split("\n");
    if (citation.startLine > citation.endLine || citation.endLine > lines.length) {
      invalidRanges.push(citationKey);
      continue;
    }
    const text = lines.slice(citation.startLine - 1, citation.endLine).join("\n").toLowerCase();
    const quote = citation.evidenceQuote.toLowerCase().trim();
    const snippet = quote.slice(0, Math.min(quote.length, 80));
    if (quote.length >= 8 && !text.includes(snippet)) {
      weakEvidence.push(citationKey);
    }
    if (quote.length >= 20 && !text.includes(quote)) {
      exactMismatch.push(citationKey);
    }
    const symbolCandidates = citation.evidenceQuote.match(/[A-Za-z_][A-Za-z0-9_]{2,}/g) ?? [];
    const significantSymbols = symbolCandidates.filter((token) => token.length >= 4).slice(0, 2);
    if (significantSymbols.length > 0) {
      const missing = significantSymbols.some((token) => !text.includes(token.toLowerCase()));
      if (missing) {
        symbolMismatch.push(citationKey);
      }
    }
  }

  for (const claim of answer.claims) {
    const allValid = claim.citationIds.every((id) => {
      if (!answer.citations[id]) return false;
      if (missingFiles.includes(id)) return false;
      if (invalidRanges.includes(id)) return false;
      return true;
    });
    if (!allValid) {
      unsupportedClaims.push(claim.id);
    }
  }

  return {
    missingFiles,
    invalidRanges,
    weakEvidence,
    exactMismatch,
    symbolMismatch,
    unsupportedClaims
  };
}
