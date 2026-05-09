import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { AnswerPayload } from "@/lib/contracts/answerSchema";
import { AuditPayload } from "@/lib/audit/auditSchema";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "investigator.sqlite");

let dbInstance: Database.Database | null = null;

function getDb(): Database.Database {
  if (dbInstance) return dbInstance;
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const db = new Database(dbPath, { timeout: 5000 });
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS repo_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_url TEXT NOT NULL,
      local_path TEXT NOT NULL,
      commit_sha TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_snapshot_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(repo_snapshot_id) REFERENCES repo_snapshots(id)
    );

    CREATE TABLE IF NOT EXISTS turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      turn_index INTEGER NOT NULL,
      question TEXT NOT NULL,
      question_type TEXT NOT NULL,
      answer TEXT NOT NULL,
      uncertainties_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id)
    );

    CREATE TABLE IF NOT EXISTS citations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      turn_id INTEGER NOT NULL,
      citation_key TEXT NOT NULL,
      file_path TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      evidence_quote TEXT NOT NULL,
      FOREIGN KEY(turn_id) REFERENCES turns(id)
    );

    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      turn_id INTEGER NOT NULL,
      claim_key TEXT NOT NULL,
      statement TEXT NOT NULL,
      uncertainty TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium',
      citation_keys_json TEXT NOT NULL,
      FOREIGN KEY(turn_id) REFERENCES turns(id)
    );

    CREATE TABLE IF NOT EXISTS claim_lineage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      turn_id INTEGER NOT NULL,
      claim_key TEXT NOT NULL,
      supersedes_claim_key TEXT,
      status TEXT NOT NULL,
      FOREIGN KEY(turn_id) REFERENCES turns(id)
    );

    CREATE TABLE IF NOT EXISTS audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      turn_id INTEGER NOT NULL,
      verdict TEXT NOT NULL,
      score REAL NOT NULL,
      findings_json TEXT NOT NULL,
      hallucinated_citations_json TEXT NOT NULL,
      unsupported_claims_json TEXT NOT NULL,
      contradiction_notes_json TEXT NOT NULL,
      remediation_suggestions_json TEXT NOT NULL,
      FOREIGN KEY(turn_id) REFERENCES turns(id)
    );
  `);
  const claimColumns = db
    .prepare(`PRAGMA table_info(claims)`)
    .all() as Array<{ name: string }>;
  if (!claimColumns.some((column) => column.name === "severity")) {
    db.exec(`ALTER TABLE claims ADD COLUMN severity TEXT NOT NULL DEFAULT 'medium';`);
  }
  dbInstance = db;
  return db;
}

export interface StoredTurnBundle {
  turnId: number;
  turnIndex: number;
}

export interface ClaimLineageInput {
  claimKey: string;
  supersedesClaimKey?: string;
  status: "new" | "stable" | "updated";
}

export interface StoredHistoryTurn {
  id: number;
  turnIndex: number;
  question: string;
  questionType: string;
  answer: string;
  uncertainties: string[];
  citations: Array<{
    citation_key: string;
    file_path: string;
    start_line: number;
    end_line: number;
    evidence_quote: string;
  }>;
  claims: Array<{
    claim_key: string;
    statement: string;
    uncertainty: string;
    severity: string;
    citation_keys_json: string;
    citationKeys: string[];
    lineage: {
      supersedesClaimKey: string | null;
      status: string | null;
    };
  }>;
  audit: {
    verdict: string;
    score: number;
    findings: string[];
    hallucinatedCitations: string[];
    unsupportedClaims: string[];
    contradictionNotes: string[];
    remediationSuggestions: string[];
  } | null;
}

export const database = {
  createRepoSnapshot(input: { repoUrl: string; localPath: string; commitSha: string }) {
    const db = getDb();
    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO repo_snapshots (repo_url, local_path, commit_sha, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(input.repoUrl, input.localPath, input.commitSha, now);
    return Number(result.lastInsertRowid);
  },

  createConversation(input: { repoSnapshotId: number; title: string }) {
    const db = getDb();
    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO conversations (repo_snapshot_id, title, created_at)
         VALUES (?, ?, ?)`
      )
      .run(input.repoSnapshotId, input.title, now);
    return Number(result.lastInsertRowid);
  },

  getConversation(conversationId: number) {
    const db = getDb();
    return db
      .prepare(`SELECT * FROM conversations WHERE id = ?`)
      .get(conversationId) as { id: number; repo_snapshot_id: number; title: string } | undefined;
  },

  listConversations() {
    const db = getDb();
    return db
      .prepare(
        `SELECT c.id, c.title, c.created_at, rs.repo_url,
                COALESCE(MAX(t.turn_index), 0) as turn_count
         FROM conversations c
         JOIN repo_snapshots rs ON rs.id = c.repo_snapshot_id
         LEFT JOIN turns t ON t.conversation_id = c.id
         GROUP BY c.id, c.title, c.created_at, rs.repo_url
         ORDER BY c.id DESC`
      )
      .all() as Array<{
      id: number;
      title: string;
      created_at: string;
      repo_url: string;
      turn_count: number;
    }>;
  },

  getRepoSnapshot(snapshotId: number) {
    const db = getDb();
    return db
      .prepare(`SELECT * FROM repo_snapshots WHERE id = ?`)
      .get(snapshotId) as
      | { id: number; repo_url: string; local_path: string; commit_sha: string }
      | undefined;
  },

  getLastTurnIndex(conversationId: number): number {
    const db = getDb();
    const row = db
      .prepare(`SELECT MAX(turn_index) as max_turn FROM turns WHERE conversation_id = ?`)
      .get(conversationId) as { max_turn: number | null };
    return row.max_turn ?? 0;
  },

  insertTurnWithArtifacts(input: {
    conversationId: number;
    question: string;
    questionType: string;
    answerPayload: AnswerPayload;
    auditPayload: AuditPayload;
    claimLineage: ClaimLineageInput[];
  }): StoredTurnBundle {
    const db = getDb();
    const nextTurnIndex = this.getLastTurnIndex(input.conversationId) + 1;
    const now = new Date().toISOString();
    const tx = db.transaction(() => {
      const turnResult = db
        .prepare(
          `INSERT INTO turns (conversation_id, turn_index, question, question_type, answer, uncertainties_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          input.conversationId,
          nextTurnIndex,
          input.question,
          input.questionType,
          input.answerPayload.answer,
          JSON.stringify(input.answerPayload.uncertainties),
          now
        );
      const turnId = Number(turnResult.lastInsertRowid);

      const insertCitation = db.prepare(
        `INSERT INTO citations (turn_id, citation_key, file_path, start_line, end_line, evidence_quote)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const [citationKey, citation] of Object.entries(input.answerPayload.citations)) {
        insertCitation.run(
          turnId,
          citationKey,
          citation.filePath,
          citation.startLine,
          citation.endLine,
          citation.evidenceQuote
        );
      }

      const insertClaim = db.prepare(
        `INSERT INTO claims (turn_id, claim_key, statement, uncertainty, severity, citation_keys_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const claim of input.answerPayload.claims) {
        insertClaim.run(
          turnId,
          claim.id,
          claim.statement,
          claim.uncertainty,
          claim.severity,
          JSON.stringify(claim.citationIds)
        );
      }
      const insertLineage = db.prepare(
        `INSERT INTO claim_lineage (turn_id, claim_key, supersedes_claim_key, status)
         VALUES (?, ?, ?, ?)`
      );
      for (const lineage of input.claimLineage) {
        insertLineage.run(turnId, lineage.claimKey, lineage.supersedesClaimKey ?? null, lineage.status);
      }

      db.prepare(
        `INSERT INTO audits
         (turn_id, verdict, score, findings_json, hallucinated_citations_json, unsupported_claims_json, contradiction_notes_json, remediation_suggestions_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        turnId,
        input.auditPayload.verdict,
        input.auditPayload.score,
        JSON.stringify(input.auditPayload.findings),
        JSON.stringify(input.auditPayload.hallucinatedCitations),
        JSON.stringify(input.auditPayload.unsupportedClaims),
        JSON.stringify(input.auditPayload.contradictionNotes),
        JSON.stringify(input.auditPayload.remediationSuggestions)
      );

      return { turnId, turnIndex: nextTurnIndex };
    });

    return tx();
  },

  getConversationHistory(conversationId: number): StoredHistoryTurn[] {
    const db = getDb();
    const turns = db
      .prepare(
        `SELECT id, turn_index, question, question_type, answer, uncertainties_json, created_at
         FROM turns
         WHERE conversation_id = ?
         ORDER BY turn_index ASC`
      )
      .all(conversationId) as Array<{
      id: number;
      turn_index: number;
      question: string;
      question_type: string;
      answer: string;
      uncertainties_json: string;
      created_at: string;
    }>;

    const citationsStmt = db.prepare(
      `SELECT citation_key, file_path, start_line, end_line, evidence_quote FROM citations WHERE turn_id = ?`
    );
    const claimsStmt = db.prepare(
      `SELECT c.claim_key, c.statement, c.uncertainty, c.severity, c.citation_keys_json,
              l.supersedes_claim_key, l.status
       FROM claims c
       LEFT JOIN claim_lineage l ON l.turn_id = c.turn_id AND l.claim_key = c.claim_key
       WHERE c.turn_id = ?`
    );
    const auditStmt = db.prepare(
      `SELECT verdict, score, findings_json, hallucinated_citations_json, unsupported_claims_json, contradiction_notes_json, remediation_suggestions_json
       FROM audits WHERE turn_id = ?`
    );

    return turns.map((turn): StoredHistoryTurn => ({
      id: turn.id,
      turnIndex: turn.turn_index,
      question: turn.question,
      questionType: turn.question_type,
      answer: turn.answer,
      uncertainties: JSON.parse(turn.uncertainties_json) as string[],
      citations: citationsStmt.all(turn.id) as StoredHistoryTurn["citations"],
      claims: (claimsStmt.all(turn.id) as Array<{
        claim_key: string;
        statement: string;
        uncertainty: string;
        severity: string;
        citation_keys_json: string;
        supersedes_claim_key: string | null;
        status: string | null;
      }>).map((claim) => ({
        ...claim,
        citationKeys: JSON.parse(claim.citation_keys_json) as string[],
        lineage: {
          supersedesClaimKey: claim.supersedes_claim_key,
          status: claim.status
        }
      })),
      audit: (() => {
        const row = auditStmt.get(turn.id) as
          | {
              verdict: string;
              score: number;
              findings_json: string;
              hallucinated_citations_json: string;
              unsupported_claims_json: string;
              contradiction_notes_json: string;
              remediation_suggestions_json: string;
            }
          | undefined;
        if (!row) return null;
        return {
          verdict: row.verdict,
          score: row.score,
          findings: JSON.parse(row.findings_json) as string[],
          hallucinatedCitations: JSON.parse(row.hallucinated_citations_json) as string[],
          unsupportedClaims: JSON.parse(row.unsupported_claims_json) as string[],
          contradictionNotes: JSON.parse(row.contradiction_notes_json) as string[],
          remediationSuggestions: JSON.parse(row.remediation_suggestions_json) as string[]
        };
      })()
    }));
  }
};
