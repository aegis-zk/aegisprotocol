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

export function updateSkillMetadata(params: {
  skillHash: string;
  skillName: string;
  category: string;
}): void {
  run(`UPDATE skills SET skill_name = ?, category = ? WHERE skill_hash = ?`, [
    params.skillName,
    params.category,
    params.skillHash,
  ]);
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
  skill_name: string;
  category: string;
  block_number: string;
  tx_hash: string;
  listed_at: string;
  attestation_count: number;
  has_bounty: number;
}

/** Skills that still have the default metadata (need backfill). */
export function getSkillsNeedingMetadata(): { skill_hash: string; metadata_uri: string }[] {
  return queryAll<{ skill_hash: string; metadata_uri: string }>(
    `SELECT skill_hash, metadata_uri FROM skills WHERE skill_name = 'Unknown Skill' AND category = 'Uncategorized'`,
  );
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

/** Skills grouped by category. Returns { category: string, skills: SkillRow[] }[]. */
export function getSkillsByCategory(): { category: string; skills: SkillRow[] }[] {
  const rows = queryAll<SkillRow>(
    `SELECT s.*,
            (SELECT COUNT(*) FROM attestations a WHERE a.skill_hash = s.skill_hash AND a.revoked = 0) AS attestation_count,
            (SELECT COUNT(*) FROM bounties b WHERE b.skill_hash = s.skill_hash AND b.claimed = 0 AND b.reclaimed = 0) AS has_bounty
     FROM skills s
     ORDER BY s.category ASC, s.block_number DESC`,
  );

  const grouped = new Map<string, SkillRow[]>();
  for (const row of rows) {
    const cat = row.category ?? 'Uncategorized';
    const list = grouped.get(cat) ?? [];
    list.push(row);
    grouped.set(cat, list);
  }

  return Array.from(grouped.entries()).map(([category, skills]) => ({ category, skills }));
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

// ── Attestation levels ────────────────────────────────

export interface AttestationLevelCounts {
  l1: number;
  l2: number;
  l3: number;
}

/** Count non-revoked attestations by audit level. */
export function getAttestationLevelCounts(): AttestationLevelCounts {
  const count = (level: number): number => {
    const row = queryOne<{ c: number }>(
      'SELECT COUNT(*) AS c FROM attestations WHERE audit_level = ? AND revoked = 0',
      [level],
    );
    return row?.c ?? 0;
  };
  return { l1: count(1), l2: count(2), l3: count(3) };
}

// ── Registry skills (full detail for web app) ────────

export interface RegistrySkillRow {
  skill_hash: string;
  publisher: string;
  metadata_uri: string;
  skill_name: string;
  category: string;
  block_number: string;
  tx_hash: string;
  listed_at: string;
  attestation_count: number;
}

export interface RegistrySkillDetail extends RegistrySkillRow {
  attestations: Array<{
    attestation_index: number;
    auditor_commitment: string;
    audit_level: number;
    revoked: number;
    tx_hash: string;
    created_at: string;
    auditor_stake: string;
  }>;
  disputes: Array<{
    dispute_id: number;
    attestation_index: number;
    challenger: string;
    bond: string;
    resolved: number;
    auditor_fault: number;
    opened_at: string;
    resolved_at: string | null;
    tx_hash: string;
  }>;
}

/** All skills with attestations and disputes inlined (for registry page). */
export function getRegistrySkills(limit = 500): RegistrySkillDetail[] {
  const skills = queryAll<RegistrySkillRow>(
    `SELECT s.*,
            (SELECT COUNT(*) FROM attestations a WHERE a.skill_hash = s.skill_hash AND a.revoked = 0) AS attestation_count
     FROM skills s
     ORDER BY s.block_number DESC
     LIMIT ?`,
    [limit],
  );

  return skills.map((s) => {
    const attestations = queryAll<{
      attestation_index: number;
      auditor_commitment: string;
      audit_level: number;
      revoked: number;
      tx_hash: string;
      created_at: string;
      auditor_stake: string;
    }>(
      `SELECT a.attestation_index, a.auditor_commitment, a.audit_level, a.revoked, a.tx_hash, a.created_at,
              COALESCE(aud.current_stake, '0') AS auditor_stake
       FROM attestations a
       LEFT JOIN auditors aud ON aud.auditor_commitment = a.auditor_commitment
       WHERE a.skill_hash = ?
       ORDER BY a.attestation_index DESC`,
      [s.skill_hash],
    );

    const disputes = queryAll<{
      dispute_id: number;
      attestation_index: number;
      challenger: string;
      bond: string;
      resolved: number;
      auditor_fault: number;
      opened_at: string;
      resolved_at: string | null;
      tx_hash: string;
    }>(
      `SELECT dispute_id, attestation_index, challenger, bond, resolved, auditor_fault, opened_at, resolved_at, tx_hash
       FROM disputes WHERE skill_hash = ?
       ORDER BY dispute_id DESC`,
      [s.skill_hash],
    );

    return { ...s, attestations, disputes };
  });
}

// ── All bounties (not just open) ──────────────────────

/** All bounties with skill metadata joined. */
export function getAllBounties(limit = 200) {
  return queryAll(
    `SELECT b.*, s.skill_name, s.category, s.publisher
     FROM bounties b
     LEFT JOIN skills s ON s.skill_hash = b.skill_hash
     ORDER BY CAST(b.amount AS REAL) DESC
     LIMIT ?`,
    [limit],
  );
}

// ── Auditor profile (full detail) ─────────────────────

export interface AuditorProfileRow {
  auditor_commitment: string;
  initial_stake: string;
  current_stake: string;
  attestation_count: number;
  l2_attestation_count: number;
  l3_attestation_count: number;
  last_attestation_at: string | null;
  disputes_involved: number;
  disputes_lost: number;
  reputation_score: number;
  block_number: string;
  tx_hash: string;
  registered_at: string;
}

/** Full auditor profile with l2/l3 counts and attestation details. */
export function getAuditorProfile(commitment: string): AuditorProfileRow | undefined {
  return queryOne<AuditorProfileRow>(
    `SELECT a.*,
            (a.attestation_count * 10 + CAST(a.current_stake AS REAL) / 1e16 - a.disputes_lost * 20) AS reputation_score,
            (SELECT COUNT(*) FROM attestations att WHERE att.auditor_commitment = a.auditor_commitment AND att.audit_level = 2 AND att.revoked = 0) AS l2_attestation_count,
            (SELECT COUNT(*) FROM attestations att WHERE att.auditor_commitment = a.auditor_commitment AND att.audit_level = 3 AND att.revoked = 0) AS l3_attestation_count,
            (SELECT MAX(att.created_at) FROM attestations att WHERE att.auditor_commitment = a.auditor_commitment) AS last_attestation_at
     FROM auditors a
     WHERE a.auditor_commitment = ?`,
    [commitment],
  );
}

/** Attestations by auditor with skill name, category, and disputes. */
export function getAuditorAttestationsDetailed(commitment: string) {
  const attestations = queryAll<{
    skill_hash: string;
    attestation_index: number;
    audit_level: number;
    revoked: number;
    tx_hash: string;
    created_at: string;
    skill_name: string;
    category: string;
  }>(
    `SELECT a.skill_hash, a.attestation_index, a.audit_level, a.revoked, a.tx_hash, a.created_at,
            COALESCE(s.skill_name, 'Unknown Skill') AS skill_name,
            COALESCE(s.category, 'Uncategorized') AS category
     FROM attestations a
     LEFT JOIN skills s ON s.skill_hash = a.skill_hash
     WHERE a.auditor_commitment = ?
     ORDER BY a.created_at DESC`,
    [commitment],
  );

  // Attach disputes for each attestation's skill
  return attestations.map((att) => {
    const disputes = queryAll<{
      dispute_id: number;
      attestation_index: number;
      challenger: string;
      bond: string;
      resolved: number;
      auditor_fault: number;
      opened_at: string;
      resolved_at: string | null;
      tx_hash: string;
    }>(
      `SELECT dispute_id, attestation_index, challenger, bond, resolved, auditor_fault, opened_at, resolved_at, tx_hash
       FROM disputes WHERE skill_hash = ?`,
      [att.skill_hash],
    );
    return { ...att, disputes };
  });
}

// ── Leaderboard with l2/l3 counts ─────────────────────

export interface LeaderboardRow extends AuditorRow {
  l2_attestation_count: number;
  l3_attestation_count: number;
  last_attestation_at: string | null;
}

/** Leaderboard with per-level attestation counts. */
export function getLeaderboardDetailed(limit = 50, offset = 0): LeaderboardRow[] {
  return queryAll<LeaderboardRow>(
    `SELECT a.*,
            (a.attestation_count * 10 + CAST(a.current_stake AS REAL) / 1e16 - a.disputes_lost * 20) AS reputation_score,
            (SELECT COUNT(*) FROM attestations att WHERE att.auditor_commitment = a.auditor_commitment AND att.audit_level = 2 AND att.revoked = 0) AS l2_attestation_count,
            (SELECT COUNT(*) FROM attestations att WHERE att.auditor_commitment = a.auditor_commitment AND att.audit_level = 3 AND att.revoked = 0) AS l3_attestation_count,
            (SELECT MAX(att.created_at) FROM attestations att WHERE att.auditor_commitment = a.auditor_commitment) AS last_attestation_at
     FROM auditors a
     ORDER BY reputation_score DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );
}

// ── Event log ──────────────────────────────────────────

export function getRecentEvents(limit = 100) {
  return queryAll(`SELECT * FROM event_log ORDER BY id DESC LIMIT ?`, [limit]);
}

// ════════════════════════════════════════════════════════
//  REFERRAL QUERIES
// ════════════════════════════════════════════════════════

export function insertReferral(params: {
  referrer: string;
  referee: string;
  skillHash: string;
  amount: string;
  blockNumber: string;
  txHash: string;
  logIndex: number;
}): void {
  run(
    `INSERT OR IGNORE INTO referrals (referrer, referee, skill_hash, amount, block_number, tx_hash, log_index)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [params.referrer, params.referee, params.skillHash, params.amount, params.blockNumber, params.txHash, params.logIndex],
  );
}

export function getReferralsByReferrer(referrer: string, limit = 50) {
  return queryAll(
    `SELECT * FROM referrals WHERE referrer = ? ORDER BY id DESC LIMIT ?`,
    [referrer, limit],
  );
}

export function getReferralStats() {
  const totals = queryOne<{ total_referrals: number; total_amount: string }>(
    `SELECT COUNT(*) as total_referrals, COALESCE(SUM(CAST(amount AS REAL)), 0) as total_amount FROM referrals`,
  );
  const topReferrers = queryAll(
    `SELECT referrer, COUNT(*) as referral_count, SUM(CAST(amount AS REAL)) as total_earned
     FROM referrals GROUP BY referrer ORDER BY total_earned DESC LIMIT 10`,
  );
  return { totals, topReferrers };
}
