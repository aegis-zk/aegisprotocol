export type Hex = `0x${string}`;
export type Address = `0x${string}`;

export interface Attestation {
  skillHash: Hex;
  auditCriteriaHash: Hex;
  zkProof: Hex;
  auditorCommitment: Hex;
  stakeAmount: bigint;
  timestamp: bigint;
  auditLevel: number;
}

export interface AuditorReputation {
  score: bigint;
  totalStake: bigint;
  attestationCount: bigint;
}

export interface DisputeInfo {
  skillHash: Hex;
  attestationIndex: bigint;
  evidence: Hex;
  challenger: Address;
  bond: bigint;
  resolved: boolean;
  auditorFault: boolean;
}

export interface UnstakeRequest {
  amount: bigint;
  unlockTimestamp: bigint;
}

export interface BountyInfo {
  publisher: Address;
  amount: bigint;
  requiredLevel: number;
  expiresAt: bigint;
  claimed: boolean;
}

export interface AegisConfig {
  /** Target chain ID (8453 for Base, 84532 for Base Sepolia) */
  chainId: number;
  /** AegisRegistry contract address (optional — auto-resolved from built-in addresses for supported chains) */
  registryAddress?: Address;
  /** RPC URL (optional — defaults to public RPC for the chain) */
  rpcUrl?: string;
}

export interface RegisterSkillParams {
  skillHash: Hex;
  metadataURI: string;
  attestationProof: Hex;
  publicInputs: Hex[];
  auditorCommitment: Hex;
  auditLevel: 1 | 2 | 3;
  /** Address to receive bounty payout (defaults to 0x0 to skip bounty claim) */
  bountyRecipient?: Address;
  fee?: bigint;
}

export interface SubmitAttestationParams {
  sourceCode: Uint8Array;
  auditResults: Uint8Array;
  auditorPrivateKey: string;
  skillHash: Hex;
  auditLevel: 1 | 2 | 3;
  metadataURI: string;
}

// ──────────────────────────────────────────────
//  Event Types — for discovery & history queries
// ──────────────────────────────────────────────

export interface SkillRegisteredEvent {
  skillHash: Hex;
  auditLevel: number;
  auditorCommitment: Hex;
  blockNumber: bigint;
  transactionHash: Hex;
}

export interface AuditorRegisteredEvent {
  auditorCommitment: Hex;
  stake: bigint;
  blockNumber: bigint;
  transactionHash: Hex;
}

export interface DisputeOpenedEvent {
  disputeId: bigint;
  skillHash: Hex;
  blockNumber: bigint;
  transactionHash: Hex;
}

export interface DisputeResolvedEvent {
  disputeId: bigint;
  auditorSlashed: boolean;
  blockNumber: bigint;
  transactionHash: Hex;
}

export interface BountyPostedEvent {
  skillHash: Hex;
  amount: bigint;
  requiredLevel: number;
  expiresAt: bigint;
  blockNumber: bigint;
  transactionHash: Hex;
}

export interface BountyClaimedEvent {
  skillHash: Hex;
  recipient: Address;
  auditorPayout: bigint;
  protocolFee: bigint;
  blockNumber: bigint;
  transactionHash: Hex;
}

// ──────────────────────────────────────────────
//  ERC-8004 (Trustless Agents) Integration Types
// ──────────────────────────────────────────────

/** ERC-8004 validation status for a request */
export interface ValidationStatus {
  validator: Address;
  agentId: bigint;
  response: number; // 0-100 score
  responseHash: Hex;
  tag: string;
  timestamp: bigint;
}

/** Aggregated validation summary from ERC-8004 ValidationRegistry */
export interface ValidationSummary {
  count: bigint;
  averageResponse: number;
}

/** Aggregated reputation summary from ERC-8004 ReputationRegistry */
export interface ReputationSummary {
  count: bigint;
  summaryValue: bigint;
  summaryValueDecimals: number;
}

/** ERC-8004 agent registration data */
export interface AgentRegistration {
  name: string;
  description: string;
  agentURI: string;
  services?: Array<{
    type: string;
    endpoint: string;
    description?: string;
  }>;
  skills?: Array<{
    skillHash: Hex;
    auditLevel?: number;
    metadataURI?: string;
  }>;
  x402Support?: {
    paymentAddress: Address;
    acceptedTokens: Address[];
  };
}

/**
 * Parameters for requesting ERC-8004 validation (called by agent owner).
 * Step 1 of the two-wallet bridge flow.
 */
export interface RequestErc8004ValidationParams {
  /** The ERC-8004 agent ID */
  agentId: bigint;
  /** The AEGIS skill hash to bridge */
  skillHash: Hex;
  /** AEGIS audit level (1=Functional, 2=Robust, 3=Security) */
  auditLevel: 1 | 2 | 3;
  /** URI to the audit metadata (e.g. IPFS CID) */
  metadataURI: string;
  /** Address of the AEGIS validator who will respond */
  validatorAddress: Address;
}

/**
 * Parameters for responding to an ERC-8004 validation (called by AEGIS validator).
 * Step 2 of the two-wallet bridge flow.
 */
export interface RespondToErc8004ValidationParams {
  /** The request hash (returned from requestErc8004Validation) */
  requestHash: Hex;
  /** The ERC-8004 agent ID (for optional reputation feedback) */
  agentId: bigint;
  /** The AEGIS skill hash */
  skillHash: Hex;
  /** AEGIS audit level (1=Functional, 2=Robust, 3=Security) */
  auditLevel: 1 | 2 | 3;
  /** URI to the audit metadata (e.g. IPFS CID) */
  metadataURI: string;
  /** Also submit reputation feedback to ERC-8004 ReputationRegistry (default: true) */
  includeReputation?: boolean;
}

// ──────────────────────────────────────────────
//  x402 Payment Types
// ──────────────────────────────────────────────

/** x402 payment requirement returned in HTTP 402 responses */
export interface X402PaymentRequirement {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType?: string;
  payTo: Address;
  maxTimeoutSeconds?: number;
  asset: Address;
  extra?: Record<string, unknown>;
}

/** Configuration for an auditor's x402-enabled endpoint */
export interface X402AuditorConfig {
  /** Auditor's wallet address to receive payments */
  paymentAddress: Address;
  /** Price per audit in USDC (6 decimals, e.g. "5.00" = 5 USDC) */
  priceUsdc: string;
  /** Supported audit levels */
  supportedLevels: Array<1 | 2 | 3>;
  /** Optional description for the x402 payment requirement */
  description?: string;
}

// ──────────────────────────────────────────────
//  Trust Profile Types
// ──────────────────────────────────────────────

/** Trust level classification based on composite score */
export type TrustLevel = 'unknown' | 'basic' | 'verified' | 'trusted';

/** Individual attestation within a SkillTrustScore */
export interface SkillAttestation {
  /** Auditor's ZK commitment hash */
  auditorCommitment: Hex;
  /** AEGIS audit level (1=Functional, 2=Robust, 3=Security) */
  auditLevel: number;
  /** Block timestamp of the attestation */
  timestamp: bigint;
  /** Whether the ZK proof verifies on-chain */
  verified: boolean;
}

/** Trust data for a single skill attestation */
export interface SkillTrustScore {
  /** The bytes32 skill hash */
  skillHash: Hex;
  /** Metadata URI (IPFS or HTTP) */
  metadataURI: string;
  /** All attestations for this skill */
  attestations: SkillAttestation[];
  /** Highest audit level among attestations */
  highestLevel: number;
  /** Total number of disputes opened against this skill */
  disputeCount: number;
  /** Whether any disputes are still unresolved */
  hasActiveDisputes: boolean;
}

/** Aggregated trust profile for an AI agent */
export interface TrustProfile {
  /** ERC-8004 agent identity ID */
  agentId: bigint;
  /** Agent identity info from ERC-8004 IdentityRegistry */
  identity: {
    owner: Address;
    agentURI: string;
  };
  /** Per-skill trust breakdown */
  skills: SkillTrustScore[];
  /** Aggregated ERC-8004 validation data */
  validation: {
    count: bigint;
    averageScore: number;
  };
  /** Aggregated ERC-8004 reputation data */
  reputation: {
    count: bigint;
    summaryValue: bigint;
    summaryValueDecimals: number;
  };
  /** Computed overall trust assessment */
  overall: {
    /** Composite trust score (0-100) */
    trustScore: number;
    /** Trust level classification */
    level: TrustLevel;
    /** Number of audited skills */
    skillCount: number;
    /** Highest audit level across all skills */
    highestAuditLevel: number;
    /** Whether any skill has unresolved disputes */
    hasActiveDisputes: boolean;
  };
  /** ISO 8601 timestamp of when the profile was computed */
  timestamp: string;
}

/** USDC pricing for trust API endpoints */
export interface TrustApiPricing {
  /** Price per single profile query (e.g. "0.10" = 10 cents) */
  profileQuery: string;
  /** Price per single skill trust query (e.g. "0.05") */
  skillQuery: string;
  /** Price per batch profile query (e.g. "0.50") */
  batchQuery: string;
}

/** Configuration for the x402-gated Trust API server */
export interface TrustApiConfig {
  /** Wallet address to receive USDC payments */
  paymentAddress: Address;
  /** Chain ID (8453 for Base, 84532 for Base Sepolia) */
  chainId: number;
  /** Optional custom RPC URL */
  rpcUrl?: string;
  /** Optional explicit AegisRegistry address */
  registryAddress?: Address;
  /** USDC pricing per endpoint */
  pricing: TrustApiPricing;
  /** Optional description for x402 payment requirements */
  description?: string;
}

/** Typed client for consuming the x402-gated Trust API */
export interface TrustApiClient {
  /** Get a full trust profile for an agent */
  getProfile(agentId: bigint): Promise<TrustProfile>;
  /** Get trust data for a single skill */
  getSkillTrust(skillHash: Hex): Promise<SkillTrustScore>;
  /** Get trust profiles for multiple agents in one request */
  batchProfiles(agentIds: bigint[]): Promise<TrustProfile[]>;
}
