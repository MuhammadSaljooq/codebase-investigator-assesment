import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AnswerPayload } from "@/lib/contracts/answerSchema";
import { verifyCitations } from "@/lib/audit/citationVerifier";
import { runIndependentAudit } from "@/lib/audit/runIndependentAudit";

function makeTempRepo(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "investigator-audit-"));
  for (const [relative, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relative);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf8");
  }
  return dir;
}

describe("audit pipeline", () => {
  it("flags hallucinated citations and unsupported claims", async () => {
    const repoRoot = makeTempRepo({
      "src/auth.ts": `export function login() {\n  return true;\n}\n`
    });

    const answer: AnswerPayload = {
      questionType: "evaluation_risk",
      answer: "Auth is implemented in src/auth.ts",
      claims: [
        {
          id: "claim_1",
          statement: "Auth is implemented.",
          severity: "medium",
          uncertainty: "known",
          citationIds: ["c1", "c2"]
        }
      ],
      citations: {
        c1: {
          filePath: "src/auth.ts",
          startLine: 1,
          endLine: 2,
          evidenceQuote: "export function login"
        },
        c2: {
          filePath: "src/missing.ts",
          startLine: 1,
          endLine: 2,
          evidenceQuote: "missing"
        }
      },
      uncertainties: ["known"]
    };

    const verification = verifyCitations(repoRoot, answer);
    expect(verification.missingFiles).toContain("c2");
    expect(verification.unsupportedClaims).toContain("claim_1");

    const audit = await runIndependentAudit({
      repoRoot,
      question: "How does auth work?",
      answer,
      contradictionNotes: []
    });
    expect(["caution", "unreliable"]).toContain(audit.verdict);
    expect(audit.hallucinatedCitations.some((item) => item.includes("c2"))).toBe(true);
  });
});
