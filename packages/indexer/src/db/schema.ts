/**
 * SQLite schema for the AEGIS indexer.
 *
 * Design choices:
 * - bigint values (ETH amounts, block numbers) stored as TEXT for lossless precision
 * - timestamps stored as ISO-8601 TEXT via datetime('now')
 * - boolean flags as INTEGER (0/1) per SQLite convention
 * - composite primary keys where natural keys exist
 */

export const SCHEMA_SQL = `
-- ── Sync state ───────────────────────────────────────────
-- Singleton KV store tracking indexer progress.

CREATE TABLE IF NOT EXISTS sync_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ── Skills ───────────────────────────────────────────────
-- Populated from SkillListed events. A skill exists here
-- once a publisher calls listSkill().

CREATE TABLE IF NOT EXISTS skills (
  skill_hash    TEXT PRIMARY KEY,
  publisher     TEXT NOT NULL,
  metadata_uri  TEXT NOT NULL,
  block_number  TEXT NOT NULL,
  tx_hash       TEXT NOT NULL,
  log_index     INTEGER NOT NULL,
  listed_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Attestations ─────────────────────────────────────────
-- Populated from SkillRegistered events. Each row is a
-- single audit attestation against a skill.

CREATE TABLE IF NOT EXISTS attestations (
  skill_hash          TEXT NOT NULL,
  attestation_index   INTEGER NOT NULL,
  auditor_commitment  TEXT NOT NULL,
  audit_level         INTEGER NOT NULL,
  revoked             INTEGER NOT NULL DEFAULT 0,
  block_number        TEXT NOT NULL,
  tx_hash             TEXT NOT NULL,
  log_index           INTEGER NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (skill_hash, attestation_index)
);

CREATE INDEX IF NOT EXISTS idx_attestations_auditor
  ON attestations (auditor_commitment);

-- ── Auditors ─────────────────────────────────────────────
-- Populated from AuditorRegistered events. Stake totals
-- are updated incrementally via StakeAdded events.

CREATE TABLE IF NOT EXISTS auditors (
  auditor_commitment  TEXT PRIMARY KEY,
  initial_stake       TEXT NOT NULL,
  current_stake       TEXT NOT NULL,
  attestation_count   INTEGER NOT NULL DEFAULT 0,
  disputes_involved   INTEGER NOT NULL DEFAULT 0,
  disputes_lost       INTEGER NOT NULL DEFAULT 0,
  block_number        TEXT NOT NULL,
  tx_hash             TEXT NOT NULL,
  log_index           INTEGER NOT NULL,
  registered_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Disputes ─────────────────────────────────────────────
-- Populated from DisputeOpened events. Extra fields
-- (challenger, bond, evidence) fetched via getDispute()
-- RPC call at index time. Resolved via DisputeResolved.

CREATE TABLE IF NOT EXISTS disputes (
  dispute_id        INTEGER PRIMARY KEY,
  skill_hash        TEXT NOT NULL,
  attestation_index INTEGER,
  challenger        TEXT,
  bond              TEXT,
  evidence          TEXT,
  resolved          INTEGER NOT NULL DEFAULT 0,
  auditor_fault     INTEGER NOT NULL DEFAULT 0,
  block_number      TEXT NOT NULL,
  tx_hash           TEXT NOT NULL,
  log_index         INTEGER NOT NULL,
  opened_at         TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_disputes_skill
  ON disputes (skill_hash);

-- ── Bounties ─────────────────────────────────────────────
-- Populated from BountyPosted events. Updated by
-- BountyClaimed / BountyReclaimed events.

CREATE TABLE IF NOT EXISTS bounties (
  skill_hash      TEXT PRIMARY KEY,
  amount          TEXT NOT NULL,
  required_level  INTEGER NOT NULL,
  expires_at      TEXT NOT NULL,
  claimed         INTEGER NOT NULL DEFAULT 0,
  reclaimed       INTEGER NOT NULL DEFAULT 0,
  block_number    TEXT NOT NULL,
  tx_hash         TEXT NOT NULL,
  log_index       INTEGER NOT NULL,
  posted_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Event log ────────────────────────────────────────────
-- Raw event log for audit trail and reprocessing.

CREATE TABLE IF NOT EXISTS event_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name    TEXT NOT NULL,
  block_number  TEXT NOT NULL,
  tx_hash       TEXT NOT NULL,
  log_index     INTEGER NOT NULL,
  data          TEXT NOT NULL,
  indexed_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_event_log_block
  ON event_log (block_number);
CREATE INDEX IF NOT EXISTS idx_event_log_name
  ON event_log (event_name);
`;
