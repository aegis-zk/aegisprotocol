import initSqlJs, { type Database } from "sql.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { config } from "../config.js";
import { SCHEMA, MIGRATION_V2 } from "./schema.js";
import type { AuditTask, TaskState } from "../types.js";

let db: Database;
let startedAt: string;

// ── Init ────────────────────────────────────────────────────

export async function initDb(): Promise<void> {
  const SQL = await initSqlJs();
  startedAt = new Date().toISOString();

  if (existsSync(config.dbPath)) {
    const buffer = readFileSync(config.dbPath);
    db = new SQL.Database(buffer);
    console.log("[db] Loaded existing database");
  } else {
    db = new SQL.Database();
    console.log("[db] Created new database");
  }

  db.run(SCHEMA);
  runMigrations();
  persist();
}

export function getDb(): Database {
  if (!db) throw new Error("Database not initialized — call initDb() first");
  return db;
}

function persist(): void {
  const data = db.export();
  writeFileSync(config.dbPath, Buffer.from(data));
}

// ── Migrations ─────────────────────────────────────────────

function getSchemaVersion(): number {
  const result = db.exec("SELECT value FROM sync_state WHERE key = 'schema_version'");
  if (result.length === 0 || result[0].values.length === 0) return 1;
  return Number(result[0].values[0][0]);
}

function setSchemaVersion(version: number): void {
  db.run(
    "INSERT OR REPLACE INTO sync_state (key, value) VALUES ('schema_version', ?)",
    [version.toString()]
  );
}

function runMigrations(): void {
  const version = getSchemaVersion();

  if (version < 2) {
    console.log("[db] Running migration v1 → v2 (bounty columns)...");
    for (const stmt of MIGRATION_V2) {
      try {
        db.run(stmt);
      } catch (err) {
        // Column may already exist if schema was created fresh with v2 DDL
        const msg = (err as Error).message;
        if (!msg.includes("duplicate column")) throw err;
      }
    }
    setSchemaVersion(2);
    console.log("[db] Migration v2 complete");
  }
}

// ── Sync State ──────────────────────────────────────────────

export function getLastSyncedBlock(): bigint {
  const result = db.exec("SELECT value FROM sync_state WHERE key = 'last_synced_block'");
  if (result.length === 0 || result[0].values.length === 0) return 0n;
  return BigInt(result[0].values[0][0] as string);
}

export function setLastSyncedBlock(block: bigint): void {
  db.run(
    "INSERT OR REPLACE INTO sync_state (key, value) VALUES ('last_synced_block', ?)",
    [block.toString()]
  );
  persist();
}

// ── Task Operations ─────────────────────────────────────────

export function taskExists(skillHash: string): boolean {
  const result = db.exec(
    "SELECT 1 FROM audit_tasks WHERE skill_hash = ? LIMIT 1",
    [skillHash]
  );
  return result.length > 0 && result[0].values.length > 0;
}

export function insertTask(
  skillHash: string,
  publisher: string,
  metadataURI: string,
  auditLevel: 1 | 2 | 3,
  bounty?: { amount: string; requiredLevel: number; expiresAt: string }
): void {
  if (taskExists(skillHash)) return; // Idempotent

  db.run(
    `INSERT INTO audit_tasks (skill_hash, publisher, metadata_uri, audit_level, bounty_amount, bounty_required_level, bounty_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      skillHash,
      publisher,
      metadataURI,
      auditLevel,
      bounty?.amount ?? null,
      bounty?.requiredLevel ?? null,
      bounty?.expiresAt ?? null,
    ]
  );
  persist();
  console.log(`[queue] Enqueued skill ${skillHash.slice(0, 10)}...${bounty ? ` (bounty: ${bounty.amount} wei)` : ""}`);
}

/**
 * Claim the next task, prioritizing skills with higher bounties.
 * Falls back to FIFO for non-bounty tasks.
 */
export function claimNextTask(): AuditTask | null {
  const result = db.exec(
    `SELECT * FROM audit_tasks
     WHERE state = 'discovered'
     ORDER BY
       CASE WHEN bounty_amount IS NOT NULL AND bounty_amount != '0' THEN 0 ELSE 1 END ASC,
       CAST(COALESCE(bounty_amount, '0') AS INTEGER) DESC,
       discovered_at ASC
     LIMIT 1`
  );

  if (result.length === 0 || result[0].values.length === 0) return null;

  const row = result[0].values[0];
  const columns = result[0].columns;
  const task = rowToTask(columns, row);

  // Claim it
  db.run(
    "UPDATE audit_tasks SET state = 'claimed', claimed_at = datetime('now') WHERE id = ?",
    [task.id]
  );
  persist();

  return { ...task, state: "claimed" };
}

export function updateTaskState(
  id: number,
  state: TaskState,
  extra?: Partial<{
    lastError: string;
    proofHex: string;
    publicInputs: string;
    txHash: string;
    attempt: number;
    nextRetryAt: string;
    completedAt: string;
  }>
): void {
  const sets: string[] = ["state = ?"];
  const params: (string | number)[] = [state];

  if (extra?.lastError !== undefined) { sets.push("last_error = ?"); params.push(extra.lastError); }
  if (extra?.proofHex !== undefined) { sets.push("proof_hex = ?"); params.push(extra.proofHex); }
  if (extra?.publicInputs !== undefined) { sets.push("public_inputs = ?"); params.push(extra.publicInputs); }
  if (extra?.txHash !== undefined) { sets.push("tx_hash = ?"); params.push(extra.txHash); }
  if (extra?.attempt !== undefined) { sets.push("attempt = ?"); params.push(extra.attempt); }
  if (extra?.nextRetryAt !== undefined) { sets.push("next_retry_at = ?"); params.push(extra.nextRetryAt); }
  if (extra?.completedAt !== undefined) { sets.push("completed_at = ?"); params.push(extra.completedAt); }

  params.push(id);
  db.run(`UPDATE audit_tasks SET ${sets.join(", ")} WHERE id = ?`, params);
  persist();
}

/**
 * Mark a task as skipped (already attested by competitor).
 */
export function skipTask(id: number): void {
  db.run(
    "UPDATE audit_tasks SET state = 'skipped', completed_at = datetime('now') WHERE id = ?",
    [id]
  );
  persist();
}

/**
 * Update bounty info on an existing task, or insert a placeholder if the task
 * doesn't exist yet (BountyPosted can fire before SkillListed).
 */
export function upsertBounty(
  skillHash: string,
  amount: string,
  requiredLevel: number,
  expiresAt: string
): void {
  if (taskExists(skillHash)) {
    db.run(
      `UPDATE audit_tasks
       SET bounty_amount = ?, bounty_required_level = ?, bounty_expires_at = ?
       WHERE skill_hash = ?`,
      [amount, requiredLevel, expiresAt, skillHash]
    );
  } else {
    // Placeholder — will be completed when SkillListed arrives with publisher + metadataURI
    db.run(
      `INSERT INTO audit_tasks (skill_hash, publisher, metadata_uri, audit_level, bounty_amount, bounty_required_level, bounty_expires_at)
       VALUES (?, '', '', ?, ?, ?, ?)`,
      [skillHash, requiredLevel, amount, requiredLevel, expiresAt]
    );
  }
  persist();
  console.log(`[queue] Bounty updated for ${skillHash.slice(0, 10)}... (${amount} wei, L${requiredLevel})`);
}

/**
 * Skip tasks when a competitor's SkillRegistered event is observed.
 * Only skips if the competitor's audit level >= the task's level.
 */
export function markCompetitorAttested(skillHash: string, competitorLevel: number): void {
  const result = db.exec(
    `SELECT id, audit_level, state FROM audit_tasks WHERE skill_hash = ?`,
    [skillHash]
  );

  if (result.length === 0 || result[0].values.length === 0) return;

  const row = result[0].values[0];
  const id = row[0] as number;
  const taskLevel = row[1] as number;
  const state = row[2] as string;

  // Only skip if competitor attested at >= our level and task is still in-queue
  if (competitorLevel >= taskLevel && ["discovered", "claimed", "auditing"].includes(state)) {
    skipTask(id);
    console.log(`[queue] Skipped ${skillHash.slice(0, 10)}... — competitor attested at L${competitorLevel}`);
  }
}

export function getRetryableTasks(): AuditTask[] {
  const result = db.exec(
    `SELECT * FROM audit_tasks
     WHERE state = 'failed'
       AND next_retry_at <= datetime('now')
       AND attempt < ?
     ORDER BY next_retry_at ASC`,
    [config.retryMaxAttempts]
  );

  if (result.length === 0) return [];

  return result[0].values.map(row => rowToTask(result[0].columns, row));
}

export function getTaskStats(): { total: number; byState: Record<string, number> } {
  const total = db.exec("SELECT COUNT(*) FROM audit_tasks");
  const byState = db.exec("SELECT state, COUNT(*) FROM audit_tasks GROUP BY state");

  const stats: Record<string, number> = {};
  if (byState.length > 0) {
    for (const row of byState[0].values) {
      stats[row[0] as string] = row[1] as number;
    }
  }

  return {
    total: total.length > 0 ? (total[0].values[0][0] as number) : 0,
    byState: stats,
  };
}

/**
 * Extended health stats for the /stats endpoint.
 */
export function getHealthStats(): {
  total: number;
  byState: Record<string, number>;
  bountyTaskCount: number;
  totalBountyWei: string;
  startedAt: string;
} {
  const base = getTaskStats();

  const bountyCount = db.exec(
    "SELECT COUNT(*) FROM audit_tasks WHERE bounty_amount IS NOT NULL AND bounty_amount != '0' AND state = 'discovered'"
  );
  const bountySum = db.exec(
    "SELECT COALESCE(SUM(CAST(bounty_amount AS INTEGER)), 0) FROM audit_tasks WHERE bounty_amount IS NOT NULL AND state = 'discovered'"
  );

  return {
    ...base,
    bountyTaskCount: bountyCount.length > 0 ? (bountyCount[0].values[0][0] as number) : 0,
    totalBountyWei: bountySum.length > 0 ? String(bountySum[0].values[0][0]) : "0",
    startedAt,
  };
}

// ── Helpers ─────────────────────────────────────────────────

function rowToTask(columns: string[], row: unknown[]): AuditTask {
  const obj: Record<string, unknown> = {};
  columns.forEach((col, i) => { obj[col] = row[i]; });

  return {
    id: obj.id as number,
    skillHash: obj.skill_hash as string,
    publisher: obj.publisher as string,
    metadataURI: obj.metadata_uri as string,
    state: obj.state as TaskState,
    auditLevel: obj.audit_level as 1 | 2 | 3,
    attempt: obj.attempt as number,
    lastError: (obj.last_error as string) ?? null,
    proofHex: (obj.proof_hex as string) ?? null,
    publicInputs: (obj.public_inputs as string) ?? null,
    txHash: (obj.tx_hash as string) ?? null,
    bountyAmount: (obj.bounty_amount as string) ?? null,
    bountyRequiredLevel: (obj.bounty_required_level as number) ?? null,
    bountyExpiresAt: (obj.bounty_expires_at as string) ?? null,
    discoveredAt: obj.discovered_at as string,
    claimedAt: (obj.claimed_at as string) ?? null,
    completedAt: (obj.completed_at as string) ?? null,
    nextRetryAt: (obj.next_retry_at as string) ?? null,
  };
}
