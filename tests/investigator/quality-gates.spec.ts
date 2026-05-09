import { describe, expect, it } from "vitest";
import { verifyCitations } from "@/lib/audit/citationVerifier";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function makeTempRepo(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "investigator-quality-"));
  for (const [relative, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relative);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf8");
  }
  return dir;
}

describe("trust quality gates", () => {
  it("keeps citation precision above threshold in golden fixture", () => {
    const repoRoot = makeTempRepo({
      "src/api.ts": "export async function handleError(err: Error) { throw err; }\n"
    });
    const answer = {
      questionType: "evaluation_risk",
      answer: "error handling exists",
      claims: [
        {
          id: "claim_1",
          statement: "Errors are thrown from API handler.",
          severity: "high",
          uncertainty: "known",
          citationIds: ["c1"]
        }
      ],
      citations: {
        c1: {
          filePath: "src/api.ts",
          startLine: 1,
          endLine: 1,
          evidenceQuote: "handleError(err: Error)"
        }
      },
      uncertainties: ["known"]
    } as const;
    const check = verifyCitations(repoRoot, answer);
    const failures =
      check.missingFiles.length +
      check.invalidRanges.length +
      check.exactMismatch.length +
      check.symbolMismatch.length;
    expect(failures).toBe(0);
  });
});
