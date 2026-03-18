/** SQLite DDL for the audit queue database */
export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS audit_tasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_hash      TEXT NOT NULL UNIQUE,
    publisher       TEXT NOT NULL,
    metadata_uri    TEXT NOT NULL,
    state           TEXT NOT NULL DEFAULT 'discovered',
    audit_level     INTEGER NOT NULL DEFAULT 1,
    attempt         INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT,
    proof_hex       TEXT,
    public_inputs   TEXT,
    tx_hash         TEXT,
    bounty_amount   TEXT,
    bounty_required_level INTEGER,
    bounty_expires_at TEXT,
    discovered_at   TEXT NOT NULL DEFAULT (datetime('now')),
    claimed_at      TEXT,
    completed_at    TEXT,
    next_retry_at   TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_state
    ON audit_tasks (state);

  CREATE INDEX IF NOT EXISTS idx_tasks_retry
    ON audit_tasks (next_retry_at);

  CREATE INDEX IF NOT EXISTS idx_tasks_bounty_priority
    ON audit_tasks (state, bounty_amount DESC);

  CREATE TABLE IF NOT EXISTS sync_state (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

/**
 * Migration from schema v1 → v2: add bounty columns.
 * ALTER TABLE ADD COLUMN is safe in SQLite (additive, NULL default).
 */
export const MIGRATION_V2 = [
  "ALTER TABLE audit_tasks ADD COLUMN bounty_amount TEXT",
  "ALTER TABLE audit_tasks ADD COLUMN bounty_required_level INTEGER",
  "ALTER TABLE audit_tasks ADD COLUMN bounty_expires_at TEXT",
  `CREATE INDEX IF NOT EXISTS idx_tasks_bounty_priority
    ON audit_tasks (state, bounty_amount DESC)`,
];
