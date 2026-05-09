import { z } from "zod";

export const auditVerdictSchema = z.enum(["trustworthy", "caution", "unreliable"]);

export const auditSchema = z.object({
  verdict: auditVerdictSchema,
  score: z.number().min(0).max(1),
  findings: z.array(z.string()),
  hallucinatedCitations: z.array(z.string()),
  unsupportedClaims: z.array(z.string()),
  contradictionNotes: z.array(z.string()),
  remediationSuggestions: z.array(z.string())
});

export type AuditPayload = z.infer<typeof auditSchema>;
