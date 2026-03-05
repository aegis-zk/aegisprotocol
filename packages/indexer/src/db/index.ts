import initSqlJs, { type Database } from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { config } from '../config.js';
import { SCHEMA_SQL } from './schema.js';

let _db: Database | null = null;
let _saveTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize the SQLite database (async — call once at startup).
 * Loads existing DB file or creates a new one.
 */
export async function initDb(): Promise<Database> {
  if (_db) return _db;

  const SQL = await initSqlJs();

  // Load existing DB file if present
  if (existsSync(config.dbPath)) {
    const buffer = readFileSync(config.dbPath);
    _db = new SQL.Database(buffer);
  } else {
    _db = new SQL.Database();
  }

  // Create tables + indexes
  _db.run(SCHEMA_SQL);

  // Auto-save to disk every 5 seconds
  _saveTimer = setInterval(() => saveDb(), 5000);

  return _db;
}

/**
 * Get the database instance (must call initDb first).
 */
export function getDb(): Database {
  if (!_db) throw new Error('Database not initialized — call initDb() first');
  return _db;
}

/**
 * Persist the in-memory database to disk.
 */
export function saveDb(): void {
  if (!_db) return;
  const data = _db.export();
  writeFileSync(config.dbPath, Buffer.from(data));
}

/**
 * Close the database and save to disk.
 */
export function closeDb(): void {
  if (_saveTimer) {
    clearInterval(_saveTimer);
    _saveTimer = null;
  }
  if (_db) {
    saveDb();
    _db.close();
    _db = null;
  }
}

// ── Sync state helpers ─────────────────────────────────

export function getSyncValue(key: string): string | undefined {
  const db = getDb();
  const result = db.exec('SELECT value FROM sync_state WHERE key = ?', [key]);
  if (result.length === 0 || result[0].values.length === 0) return undefined;
  return result[0].values[0][0] as string;
}

export function setSyncValue(key: string, value: string): void {
  const db = getDb();
  db.run('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', [key, value]);
}

export function getLastSyncedBlock(): bigint {
  const val = getSyncValue('last_synced_block');
  return val ? BigInt(val) : 0n;
}

export function setLastSyncedBlock(block: bigint): void {
  setSyncValue('last_synced_block', block.toString());
}
