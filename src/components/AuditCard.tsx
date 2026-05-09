"use client";

import { AuditData } from "@/lib/types/investigator";

export function AuditCard({ audit }: { audit: AuditData }) {
  const verdictBadgeClass =
    audit.verdict === "trustworthy"
      ? "badge badge-accent"
      : audit.verdict === "caution"
        ? "badge badge-warn"
        : "badge badge-danger";
  const verdictDotClass =
    audit.verdict === "trustworthy"
      ? "status-dot active"
      : audit.verdict === "caution"
        ? "status-dot busy"
        : "status-dot error";

  return (
    <section className="msg-section">
      <div className="answer-header">Independent Audit</div>
      <div className="status-row mb-3">
        <span className={verdictDotClass} />
        <span>Audit verdict</span>
        <span className={verdictBadgeClass}>{audit.verdict}</span>
        <span className="badge badge-neutral">score {audit.score.toFixed(2)}</span>
      </div>
      <p className="t-body">
        Findings: {audit.findings.length ? audit.findings.join(" ") : "No major findings."}
      </p>
      {audit.hallucinatedCitations.length > 0 ? (
        <p className="t-body">
          Citation integrity issues: {audit.hallucinatedCitations.join(", ")}
        </p>
      ) : null}
      {audit.unsupportedClaims.length > 0 ? (
        <p className="t-body">Unsupported claims: {audit.unsupportedClaims.join(", ")}</p>
      ) : null}
      {audit.contradictionNotes.length > 0 ? (
        <p className="t-body">Contradictions: {audit.contradictionNotes.join(" ")}</p>
      ) : null}
      {audit.remediationSuggestions.length > 0 ? (
        <p className="t-body">Remediation: {audit.remediationSuggestions.join(" ")}</p>
      ) : null}
    </section>
  );
}
