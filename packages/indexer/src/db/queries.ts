import { getDb } from './index.js';

// ── Helper: convert sql.js result rows to objects ──────

function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const db = getDb();
  const result = db.exec(sql, params as any[]);
  if (result.length === 0) return [];

  const { columns, values } = result[0];
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj as T;
  });
}

function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
  const rows = queryAll<T>(sql, params);
  return rows[0];
}

function run(sql: string, params: unknown[] = []): void {
  getDb().run(sql, params as any[]);
}

// ════════════════════════════════════════════════════════
//  WRITE QUERIES — used by the sync engine
// ════════════════════════════════════════════════════════

export function insertSkill(params: {
  skillHash: string;
  publisher: string;
  metadataUri: string;
  blockNumber: string;
  txHash: string;
  logIndex: number;
}): void {
  run(
    `INSERT OR IGNORE INTO skills (skill_hash, publisher, metadata_uri, block_number, tx_hash, log_index)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [params.skillHash, params.publisher, params.metadataUri, params.blockNumber, params.txHash, params.logIndex],
  );
}

export function insertAttestation(params: {
  skillHash: string;
  attestationIndex: number;
  auditorCommitment: string;
  auditLevel: number;
  blockNumber: string;
  txHash: string;
  logIndex: number;
}): void {
  run(
    `INSERT OR IGNORE INTO attestations
       (skill_hash, attestation_index, auditor_commitment, audit_level, block_number, tx_hash, log_index)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      params.skillHash,
      params.attestationIndex,
      params.auditorCommitment,
      params.auditLevel,
      params.blockNumber,
      params.txHash,
      params.logIndex,
    ],
  );

  // Bump auditor attestation count
  run(
    `UPDATE auditors SET attestation_count = attestation_count + 1
     WHERE auditor_commitment = ?`,
    [params.auditorCommitment],
  );
}

export function insertAuditor(params: {
  auditorCommitment: string;
  initialStake: string;
  blockNumber: string;
  txHash: string;
  logIndex: number;
}): void {
  run(
    `INSERT OR IGNORE INTO auditors
       (auditor_commitment, initial_stake, current_stake, block_number, tx_hash, log_index)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [params.auditorCommitment, params.initialStake, params.initialStake, params.blockNumber, params.txHash, params.logIndex],
  );
}

export function updateAuditorStake(params: {
  auditorCommitment: string;
  totalStake: string;
}): void {
  run(`UPDATE auditors SET current_stake = ? WHERE auditor_commitment = ?`, [
    params.totalStake,
    params.auditorCommitment,
  ]);
}

export function insertDispute(params: {
  disputeId: number;
  skillHash: string;
  attestationIndex: number | null;
  challenger: string | null;
  bond: string | null;
  evidence: string | null;
  blockNumber: string;
  txHash: string;
  logIndex: number;
}): void {
  run(
    `INSERT OR IGNORE INTO disputes
       (dispute_id, skill_hash, attestation_index, challenger, bond, evidence, block_number, tx_hash, log_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.disputeId,
      params.skillHash,
      params.attestationIndex,
      params.challenger,
      params.bond,
      params.evidence,
      params.blockNumber,
      params.txHash,
      params.logIndex,
    ],
  );
}

export function resolveDispute(params: { disputeId: number; auditorFault: boolean }): void {
  run(`UPDATE disputes SET resolved = 1, auditor_fault = ?, resolved_at = datetime('now') WHERE dispute_id = ?`, [
    params.auditorFault ? 1 : 0,
    params.disputeId,
  ]);

  // Update auditor dispute counters if auditor was at fault
  if (params.auditorFault) {
    const dispute = queryOne<{ skill_hash: string; attestation_index: number }>(
      'SELECT skill_hash, attestation_index FROM disputes WHERE dispute_id = ?',
      [params.disputeId],
    );

    if (dispute) {
      const attestation = queryOne<{ auditor_commitment: string }>(
        'SELECT auditor_commitment FROM attestations WHERE skill_hash = ? AND attestation_index = ?',
        [dispute.skill_hash, dispute.attestation_index],
      );

      if (attestation) {
        run(`UPDATE auditors SET disputes_lost = disputes_lost + 1 WHERE auditor_commitment = ?`, [
          attestation.auditor_commitment,
        ]);
      }
    }
  }
}

export function revokeAttestation(params: { skillHash: string; attestationIndex: number }): void {
  run(`UPDATE attestations SET revoked = 1 WHERE skill_hash = ? AND attestation_index = ?`, [
    params.skillHash,
    params.attestationIndex,
  ]);
}

export function insertBounty(params: {
  skillHash: string;
  amount: string;
  requiredLevel: number;
  expiresAt: string;
  blockNumber: string;
  txHash: string;
  logIndex: number;
}): void {
  run(
    `INSERT OR REPLACE INTO bounties
       (skill_hash, amount, required_level, expires_at, block_number, tx_hash, log_index)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [params.skillHash, params.amount, params.requiredLevel, params.expiresAt, params.blockNumber, params.txHash, params.logIndex],
  );
}

export function claimBounty(skillHash: string): void {
  run(`UPDATE bounties SET claimed = 1 WHERE skill_hash = ?`, [skillHash]);
}

export function reclaimBounty(skillHash: string): void {
  run(`UPDATE bounties SET reclaimed = 1 WHERE skill_hash = ?`, [skillHash]);
}

export function insertEventLog(params: {
  eventName: string;
  blockNumber: string;
  txHash: string;
  logIndex: number;
  data: string;
}): void {
  run(`INSERT INTO event_log (event_name, block_number, tx_hash, log_index, data) VALUES (?, ?, ?, ?, ?)`, [
    params.eventName,
    params.blockNumber,
    params.txHash,
    params.logIndex,
    params.data,
  ]);
}

// ════════════════════════════════════════════════════════
//  READ QUERIES — used by the REST API
// ════════════════════════════════════════════════════════

// ── Skills ─────────────────────────────────────────────

export interface SkillRow {
  skill_hash: string;
  publisher: string;
  metadata_uri: string;
  block_number: string;
  tx_hash: string;
  listed_at: string;
  attestation_count: number;
  has_bounty: number;
}

/** All skills, newest first, with attestation count. */
export function getSkills(limit = 50, offset = 0): SkillRow[] {
  return queryAll<SkillRow>(
    `SELECT s.*,
            (SELECT COUNT(*) FROM attestations a WHERE a.skill_hash = s.skill_hash AND a.revoked = 0) AS attestation_count,
            (SELECT COUNT(*) FROM bounties b WHERE b.skill_hash = s.skill_hash AND b.claimed = 0 AND b.reclaimed = 0) AS has_bounty
     FROM skills s
     ORDER BY s.block_number DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );
}

/** Skills with zero non-revoked attestations. */
export function getUnauditedSkills(limit = 50, offset = 0): SkillRow[] {
  return queryAll<SkillRow>(
    `SELECT s.*,
            0 AS attestation_count,
            (SELECT COUNT(*) FROM bounties b WHERE b.skill_hash = s.skill_hash AND b.claimed = 0 AND b.reclaimed = 0) AS has_bounty
     FROM skills s
     WHERE NOT EXISTS (
       SELECT 1 FROM attestations a WHERE a.skill_hash = s.skill_hash AND a.revoked = 0
     )
     ORDER BY s.block_number DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );
}

/** Single skill by hash. */
export function getSkillByHash(skillHash: string) {
  return queryOne(
    `SELECT s.*,
            (SELECT COUNT(*) FROM attestations a WHERE a.skill_hash = s.skill_hash AND a.revoked = 0) AS attestation_count
     FROM skills s
     WHERE s.skill_hash = ?`,
    [skillHash],
  );
}

/** Attestations for a skill. */
export function getAttestationsForSkill(skillHash: string) {
  return queryAll(`SELECT * FROM attestations WHERE skill_hash = ? ORDER BY attestation_index ASC`, [skillHash]);
}

// ── Auditors ───────────────────────────────────────────

export interface AuditorRow {
  auditor_commitment: string;
  initial_stake: string;
  current_stake: string;
  attestation_count: number;
  disputes_involved: number;
  disputes_lost: number;
  block_number: string;
  registered_at: string;
  reputation_score: number;
}

/** Auditor leaderboard sorted by a weighted reputation score. */
export function getAuditorLeaderboard(limit = 50, offset = 0): AuditorRow[] {
  return queryAll<AuditorRow>(
    `SELECT *,
            (attestation_count * 10 + CAST(current_stake AS REAL) / 1e16 - disputes_lost * 20) AS reputation_score
     FROM auditors
     ORDER BY reputation_score DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );
}

/** Single auditor by commitment. */
export function getAuditorByCommitment(commitment: string) {
  return queryOne(
    `SELECT *,
            (attestation_count * 10 + CAST(current_stake AS REAL) / 1e16 - disputes_lost * 20) AS reputation_score
     FROM auditors
     WHERE auditor_commitment = ?`,
    [commitment],
  );
}

/** Attestations made by an auditor. */
export function getAttestationsByAuditor(commitment: string) {
  return queryAll(
    `SELECT a.*, s.metadata_uri
     FROM attestations a
     LEFT JOIN skills s ON s.skill_hash = a.skill_hash
     WHERE a.auditor_commitment = ?
     ORDER BY a.block_number DESC`,
    [commitment],
  );
}

// ── Disputes ───────────────────────────────────────────

/** Open (unresolved) disputes. */
export function getOpenDisputes(limit = 50, offset = 0) {
  return queryAll(`SELECT * FROM disputes WHERE resolved = 0 ORDER BY block_number DESC LIMIT ? OFFSET ?`, [
    limit,
    offset,
  ]);
}

/** All disputes for a skill. */
export function getDisputesForSkill(skillHash: string) {
  return queryAll(`SELECT * FROM disputes WHERE skill_hash = ? ORDER BY dispute_id DESC`, [skillHash]);
}

/** Single dispute by ID. */
export function getDisputeById(disputeId: number) {
  return queryOne(`SELECT * FROM disputes WHERE dispute_id = ?`, [disputeId]);
}

// ── Bounties ───────────────────────────────────────────

/** Open bounties (not claimed, not reclaimed). */
export function getOpenBounties(limit = 50, offset = 0) {
  return queryAll(
    `SELECT b.*, s.publisher, s.metadata_uri
     FROM bounties b
     LEFT JOIN skills s ON s.skill_hash = b.skill_hash
     WHERE b.claimed = 0 AND b.reclaimed = 0
     ORDER BY CAST(b.amount AS REAL) DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );
}

// ── Stats ──────────────────────────────────────────────

export interface StatsRow {
  total_skills: number;
  total_attestations: number;
  total_auditors: number;
  total_disputes: number;
  open_disputes: number;
  total_bounties: number;
  open_bounties: number;
  unaudited_skills: number;
}

export function getStats(): StatsRow {
  const count = (sql: string): number => {
    const row = queryOne<{ c: number }>(sql);
    return row?.c ?? 0;
  };

  return {
    total_skills: count('SELECT COUNT(*) AS c FROM skills'),
    total_attestations: count('SELECT COUNT(*) AS c FROM attestations WHERE revoked = 0'),
    total_auditors: count('SELECT COUNT(*) AS c FROM auditors'),
    total_disputes: count('SELECT COUNT(*) AS c FROM disputes'),
    open_disputes: count('SELECT COUNT(*) AS c FROM disputes WHERE resolved = 0'),
    total_bounties: count('SELECT COUNT(*) AS c FROM bounties'),
    open_bounties: count('SELECT COUNT(*) AS c FROM bounties WHERE claimed = 0 AND reclaimed = 0'),
    unaudited_skills: count(
      `SELECT COUNT(*) AS c FROM skills s
       WHERE NOT EXISTS (SELECT 1 FROM attestations a WHERE a.skill_hash = s.skill_hash AND a.revoked = 0)`,
    ),
  };
}

// ── Event log ──────────────────────────────────────────

export function getRecentEvents(limit = 100) {
  return queryAll(`SELECT * FROM event_log ORDER BY id DESC LIMIT ?`, [limit]);
}
