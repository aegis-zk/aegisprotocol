// ── Task States ─────────────────────────────────────────────

export type TaskState =
  | "discovered"     // Skill listed on-chain, waiting to be claimed
  | "claimed"        // Claimed by this queue processor
  | "auditing"       // Running 14-criteria checklist
  | "proof-generating" // Generating ZK proof via nargo + bb
  | "submitting"     // Sending registerSkill() tx on-chain
  | "verified"       // Attestation confirmed on-chain
  | "skipped"        // Already attested by competitor — no action needed
  | "failed";        // Error — will retry with backoff

// ── Audit Task ──────────────────────────────────────────────

export interface AuditTask {
  id: number;
  skillHash: string;         // bytes32 hex
  publisher: string;         // address hex
  metadataURI: string;
  state: TaskState;
  auditLevel: 1 | 2 | 3;
  attempt: number;
  lastError: string | null;
  proofHex: string | null;
  publicInputs: string | null; // JSON stringified array
  txHash: string | null;
  bountyAmount: string | null;       // wei string, NULL = no bounty
  bountyRequiredLevel: number | null; // 1/2/3 or NULL
  bountyExpiresAt: string | null;    // ISO timestamp or NULL
  discoveredAt: string;      // ISO timestamp
  claimedAt: string | null;
  completedAt: string | null;
  nextRetryAt: string | null;
}

// ── Checklist Result ────────────────────────────────────────

export interface ChecklistResult {
  criterionId: string;       // e.g. "L1.EXEC", "L2.EDGE", "L3.INJECTION"
  passed: boolean;
  notes: string;
  evidenceHash?: string;     // sha256 of evidence data
}

// ── Audit Result ────────────────────────────────────────────

export interface AuditResult {
  skillHash: string;
  auditLevel: 1 | 2 | 3;
  criteria: ChecklistResult[];
  allPassed: boolean;
  reportJSON: string;        // Full aegis/audit-metadata@1 JSON
  sourceHash: string;        // sha256 of skill source
}
