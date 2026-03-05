import { REGISTRY_ADDRESSES, DEPLOYMENT_BLOCKS } from '@aegisaudit/sdk';

// ── Environment ──────────────────────────────────────────────

const env = (key: string, fallback?: string): string => {
  const val = process.env[key] ?? fallback;
  if (val === undefined) throw new Error(`Missing required env var: ${key}`);
  return val;
};

/** Max block range for eth_getLogs (public RPCs typically limit to 10K) */
const MAX_LOG_RANGE = 9_999n;

// ── Config ───────────────────────────────────────────────────

export const config = {
  /** Server port */
  port: Number(env('PORT', '4200')),

  /** Chain ID (8453 = Base, 84532 = Base Sepolia) */
  chainId: Number(env('CHAIN_ID', '8453')),

  /** RPC endpoint — defaults to public Base RPC */
  rpcUrl: env('RPC_URL', 'https://mainnet.base.org'),

  /** SQLite database file path */
  dbPath: env('DB_PATH', './aegis-indexer.db'),

  /** Polling interval for new blocks (ms) */
  pollIntervalMs: Number(env('POLL_INTERVAL_MS', '5000')),

  /** Max blocks per getLogs chunk */
  maxLogRange: MAX_LOG_RANGE,
} as const;

/** Derived values that depend on chain config */
export const chainConfig = {
  registryAddress: REGISTRY_ADDRESSES[config.chainId] as `0x${string}`,
  deploymentBlock: DEPLOYMENT_BLOCKS[config.chainId] ?? 0n,
};
