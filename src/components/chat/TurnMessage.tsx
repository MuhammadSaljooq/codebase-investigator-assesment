"use client";

import { AuditCard } from "@/components/AuditCard";
import { TurnView } from "@/lib/types/investigator";

interface TurnMessageProps {
  turn: TurnView;
  index: number;
  previousAnswer?: string;
  isEvidenceOpen: (citationKey: string) => boolean;
  onToggleEvidence: (citationKey: string) => void;
}

export function TurnMessage({
  turn,
  index,
  previousAnswer,
  isEvidenceOpen,
  onToggleEvidence
}: TurnMessageProps) {
  return (
    <div className="stagger">
      <article className="msg msg-user">
        <div className="msg-bubble">{turn.question}</div>
      </article>

      <article className="msg msg-agent">
        <div className="msg-label">
          <span className="msg-label-dot" />
          Investigator response
        </div>
        <div className="msg-body">
          <p>{turn.answer.answer}</p>

          <div className="badge-stack">
            <span className="badge badge-neutral">type {turn.answer.questionType}</span>
            <span className="badge badge-neutral">
              uncertainty {turn.answer.uncertainties.join(", ")}
            </span>
            {turn.retrievalDiagnostics ? (
              <span className="badge badge-accent">
                retrieval {turn.retrievalDiagnostics.strategy}
                {turn.retrievalDiagnostics.cacheHit ? " cache" : ""}
              </span>
            ) : null}
          </div>

          <div className="msg-section">
            <div className="answer-header">Findings</div>
            <ul className="t-body">
              {turn.answer.claims.map((claim) => (
                <li key={claim.id} className="mb-2">
                  <span
                    className={`badge ${
                      claim.severity === "high"
                        ? "badge-danger"
                        : claim.severity === "medium"
                          ? "badge-warn"
                          : "badge-accent"
                    }`}
                  >
                    {claim.severity}
                  </span>{" "}
                  {claim.statement} <span className="text-muted">({claim.uncertainty})</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="msg-section">
            <div className="answer-header">Evidence</div>
            <div className="evidence-list">
              {Object.entries(turn.answer.citations).map(([key, citation]) => {
                const isOpen = isEvidenceOpen(key);
                return (
                  <div key={key} className={`evidence-card ${isOpen ? "open" : ""}`}>
                    <button
                      className="evidence-card-header"
                      title={citation.evidenceQuote}
                      onClick={() => onToggleEvidence(key)}
                    >
                      <span className="evidence-path">{citation.filePath}</span>
                      <span className="evidence-lines">
                        {citation.startLine}-{citation.endLine}
                      </span>
                      <span className="evidence-toggle">{isOpen ? "▲" : "▼"}</span>
                    </button>
                    <div className="evidence-description">{citation.evidenceQuote}</div>
                    <div className="evidence-snippet">
                      <div className="code-block">
                        <div className="code-block-header">
                          <span className="code-block-lang">snippet</span>
                        </div>
                        <pre>{citation.evidenceQuote}</pre>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {turn.answer.tradeoffs && turn.answer.tradeoffs.length > 0 ? (
            <div className="msg-section">
              <div className="answer-header">Trade-offs</div>
              <p>{turn.answer.tradeoffs.join(" ")}</p>
            </div>
          ) : null}
          {turn.answer.breakageRisks && turn.answer.breakageRisks.length > 0 ? (
            <div className="msg-section">
              <div className="answer-header">Breakage Risks</div>
              <p>{turn.answer.breakageRisks.join(" ")}</p>
            </div>
          ) : null}
          {turn.answer.recommendationImpact ? (
            <div className="msg-section">
              <div className="answer-header">Recommendation Impact</div>
              <div className="status-row mb-2">
                <span className="status-dot busy" />
                <span>{turn.answer.recommendationImpact.blastRadius}</span>
              </div>
              <p className="t-body">Rollback: {turn.answer.recommendationImpact.rollbackPlan}</p>
              <p className="t-body">Test impact: {turn.answer.recommendationImpact.testImpact}</p>
            </div>
          ) : null}

          {index > 0 && previousAnswer ? (
            <details className="mt-3">
              <summary className="text-muted">Compare with previous answer</summary>
              <p className="t-caption text-secondary mt-2">Previous: {previousAnswer.slice(0, 280)}</p>
            </details>
          ) : null}

          <AuditCard audit={turn.audit} />
        </div>
      </article>
    </div>
  );
}
