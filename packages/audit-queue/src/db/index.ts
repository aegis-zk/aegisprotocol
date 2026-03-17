import initSqlJs, { type Database } from "sql.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { config } from "../config.js";
import { SCHEMA } from "./schema.js";
import type { AuditTask, TaskState } from "../types.js";

let db: Database;

// ── Init ────────────────────────────────────────────────────

export async function initDb(): Promise<void> {
  const SQL = await initSqlJs();

  if (existsSync(config.dbPath)) {
    const buffer = readFileSync(config.dbPath);
    db = new SQL.Database(buffer);
    console.log("[db] Loaded existing database");
  } else {
    db = new SQL.Database();
    console.log("[db] Created new database");
  }

  db.run(SCHEMA);
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
  auditLevel: 1 | 2 | 3
): void {
  if (taskExists(skillHash)) return; // Idempotent

  db.run(
    `INSERT INTO audit_tasks (skill_hash, publisher, metadata_uri, audit_level)
     VALUES (?, ?, ?, ?)`,
    [skillHash, publisher, metadataURI, auditLevel]
  );
  persist();
  console.log(`[queue] Enqueued skill ${skillHash.slice(0, 10)}...`);
}

export function claimNextTask(): AuditTask | null {
  const result = db.exec(
    `SELECT * FROM audit_tasks
     WHERE state = 'discovered'
     ORDER BY discovered_at ASC
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
    discoveredAt: obj.discovered_at as string,
    claimedAt: (obj.claimed_at as string) ?? null,
    completedAt: (obj.completed_at as string) ?? null,
    nextRetryAt: (obj.next_retry_at as string) ?? null,
  };
}
