import { REGISTRY_ADDRESSES, DEPLOYMENT_BLOCKS } from "@aegisaudit/sdk";
import { privateKeyToAccount } from "viem/accounts";

// ── Environment Helper ──────────────────────────────────────

const env = (key: string, fallback?: string): string => {
  const val = process.env[key] ?? fallback;
  if (val === undefined) throw new Error(`Missing required env var: ${key}`);
  return val;
};

// ── Config ──────────────────────────────────────────────────

const privateKey = env("AEGIS_PRIVATE_KEY") as `0x${string}`;

export const config = {
  /** Chain ID (8453 = Base, 84532 = Base Sepolia) */
  chainId: Number(env("CHAIN_ID", "8453")),

  /** RPC endpoint */
  rpcUrl: env("RPC_URL", "https://mainnet.base.org"),

  /** Auditor wallet private key — signs attestation transactions */
  privateKey,

  /** Auditor wallet address — derived from private key, used as default bountyRecipient */
  auditorAddress: privateKeyToAccount(privateKey).address,

  /** Auditor commitment hash (pedersen_hash of private key, set during registration) */
  auditorCommitment: env("AUDITOR_COMMITMENT") as `0x${string}`,

  /** SQLite database file path */
  dbPath: env("QUEUE_DB_PATH", "./audit-queue.db"),

  /** Event polling interval (ms) */
  pollIntervalMs: Number(env("POLL_INTERVAL_MS", "5000")),

  /** Max tasks processed concurrently (1 = serial, avoids nonce collisions) */
  maxConcurrency: Number(env("MAX_CONCURRENCY", "1")),

  /** Default audit level: 1=Functional, 2=Robust, 3=Security */
  preferredAuditLevel: Number(env("AUDIT_LEVEL", "1")) as 1 | 2 | 3,

  /** Path to noir circuit artifacts */
  circuitsDir: env("CIRCUITS_DIR", "../circuits"),

  /** Optional gas limit override */
  gasLimit: env("GAS_LIMIT", "") || undefined,

  /** Max retry attempts for failed tasks */
  retryMaxAttempts: Number(env("RETRY_MAX_ATTEMPTS", "5")),

  /** Base delay for exponential backoff (ms) */
  retryBaseDelayMs: Number(env("RETRY_BASE_DELAY_MS", "2000")),

  /** Block to start syncing from (empty = deployment block) */
  startBlock: env("START_BLOCK", "") || undefined,

  /** Max blocks per getLogs chunk (public RPCs cap at ~10K) */
  maxLogRange: 9_999n,

  /** HTTP health endpoint port */
  healthPort: Number(env("HEALTH_PORT", "9090")),

  /** Minimum bounty threshold (wei) — ignore bounties below this */
  minBountyWei: env("MIN_BOUNTY_WEI", "0"),
} as const;

/** Derived chain-specific values */
export const chainConfig = {
  registryAddress: REGISTRY_ADDRESSES[config.chainId] as `0x${string}`,
  deploymentBlock: config.startBlock
    ? BigInt(config.startBlock)
    : (DEPLOYMENT_BLOCKS[config.chainId] ?? 0n),
};
