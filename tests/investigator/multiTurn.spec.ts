import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { retrieveContext } from "@/lib/retrieval/retrieveContext";
import { generateAnswer } from "@/lib/investigator/generateAnswer";
import { classifyQuestionType } from "@/lib/contracts/questionTypeSchema";
import { buildLedgerFromHistory } from "@/lib/memory/claimLedger";
import { detectContradictions } from "@/lib/memory/contradictionCheck";

function makeTempRepo(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "investigator-turns-"));
  for (const [relative, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relative);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf8");
  }
  return dir;
}

describe("multi-turn behavior", () => {
  it("classifies the benchmark prompt mix correctly", () => {
    const prompts = [
      "How does auth work here, and what would you change about it?",
      "This signup flow feels off — walk me through it and flag anything risky.",
      "Is there dead code? What's safe to delete?",
      "Why is this function async? Does it need to be?",
      "Suggest a better way to handle errors in the API layer.",
      "Walk me through what this service does. Skip the obvious."
    ];

    const types = prompts.map(classifyQuestionType);
    expect(types).toContain("recommendation_opinion");
    expect(types).toContain("evaluation_risk");
    expect(types).toContain("retrieval_explanation");
  });

  it("retrieves context and returns citations for answers", async () => {
    const repoRoot = makeTempRepo({
      "src/auth.ts": `
export async function signup(email: string) {
  if (!email.includes("@")) throw new Error("invalid");
  return { ok: true };
}
`.trim()
    });
    const retrieval = await retrieveContext({
      repoRoot,
      question: "How does signup flow work?",
      limit: 5
    });
    expect(retrieval.chunks.length).toBeGreaterThan(0);

    const answer = await generateAnswer({
      question: "How does signup flow work?",
      chunks: retrieval.chunks,
      priorSummary: ""
    });
    expect(Object.keys(answer.citations).length).toBeGreaterThan(0);
    expect(answer.claims.length).toBeGreaterThan(0);
  });

  it("detects possible contradiction with prior claims", () => {
    const ledger = buildLedgerFromHistory([
      {
        turnIndex: 1,
        claims: [
          {
            claim_key: "c1",
            statement: "The signup flow sends a verification email.",
            uncertainty: "known"
          }
        ]
      }
    ]);
    const result = detectContradictions(ledger, [
      {
        statement: "The signup flow does not send a verification email."
      }
    ]);
    expect(result.notes.length).toBeGreaterThan(0);
  });
});
