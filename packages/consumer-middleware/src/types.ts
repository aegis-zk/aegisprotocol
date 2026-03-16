import type { AegisConfig, Hex } from '@aegisaudit/sdk';

/** Policy that determines whether a tool call is allowed. */
export interface TrustPolicy {
  /** Minimum required audit level (1=Functional, 2=Robust, 3=Security). Default: 1 */
  minAuditLevel?: 1 | 2 | 3;
  /** Minimum number of (non-revoked) attestations required. Default: 1 */
  minAttestations?: number;
  /** Block skills that have unresolved disputes. Default: true */
  blockOnDispute?: boolean;
  /** Enforcement mode. Default: 'enforce'
   *  - enforce: block execution and throw/return error
   *  - warn: log warning but allow execution
   *  - log: silently log, always allow
   */
  mode?: 'enforce' | 'warn' | 'log';
}

/** Maps a framework tool name to an AEGIS skill hash. */
export interface SkillMapping {
  /** Tool name as registered in the framework (e.g. "web_search", "code_exec") */
  toolName: string;
  /** AEGIS skill hash (bytes32) */
  skillHash: Hex;
}

/** Configuration for the TrustGate. */
export interface TrustGateConfig {
  /** Trust policy to evaluate against */
  policy: TrustPolicy;
  /** Tool name → skill hash mappings */
  skills: SkillMapping[];
  /** Subgraph GraphQL endpoint. Defaults to the deployed AEGIS Studio endpoint. */
  subgraphUrl?: string;
  /** SDK config for on-chain fallback. Defaults to Base mainnet (chainId 8453). */
  sdkConfig?: AegisConfig;
  /** Trust data cache TTL in milliseconds. Default: 60000 (1 minute) */
  cacheTtlMs?: number;
  /** Called when a tool is blocked in enforce mode */
  onBlock?: (result: TrustGateResult) => void;
  /** Called when a tool triggers a warning in warn mode */
  onWarn?: (result: TrustGateResult) => void;
}

/** Result of a trust gate check. */
export interface TrustGateResult {
  /** The tool name that was checked */
  toolName: string;
  /** The AEGIS skill hash that was evaluated */
  skillHash: Hex;
  /** Whether execution is allowed */
  allowed: boolean;
  /** Human-readable reason if blocked or warned */
  reason?: string;
  /** Trust data retrieved from AEGIS (null if skill not found) */
  trustData?: ResolvedTrustData;
}

/** Trust data resolved from either subgraph or on-chain. */
export interface ResolvedTrustData {
  /** Highest audit level among non-revoked attestations */
  highestLevel: number;
  /** Number of non-revoked attestations */
  attestationCount: number;
  /** Whether any disputes are currently unresolved */
  hasActiveDisputes: boolean;
}

/** Interface for trust data resolvers (subgraph or on-chain). */
export interface TrustResolver {
  /** Resolve trust data for a skill hash. Returns null if not found. */
  resolve(skillHash: Hex): Promise<ResolvedTrustData | null>;
}

/** Maps a framework tool name to a TAO subnet/miner for AEGIS trust checks. */
export interface TaoSkillMapping {
  /** Tool name as registered in the framework */
  toolName: string;
  /** Bittensor subnet ID */
  netuid: number;
  /** Optional miner hotkey (SS58). If omitted, maps to the subnet-level hash. */
  hotkey?: string;
}
