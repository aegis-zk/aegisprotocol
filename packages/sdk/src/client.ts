import type { PublicClient, WalletClient, Transport, Chain, Account } from 'viem';
import type {
  AegisConfig,
  Address,
  Attestation,
  AuditorReputation,
  UnstakeRequest,
  BountyInfo,
  SkillListing,
  ListSkillParams,
  Hex,
  RegisterSkillParams,
  SkillRegisteredEvent,
  SkillListedEvent,
  AuditorRegisteredEvent,
  DisputeOpenedEvent,
  DisputeResolvedEvent,
  BountyPostedEvent,
  ValidationStatus,
  ValidationSummary,
  ReputationSummary,
  AgentRegistration,
  RequestErc8004ValidationParams,
  RespondToErc8004ValidationParams,
  TrustProfile,
  SkillTrustScore,
  DisputeDetails,
  AuditorProfile,
} from './types';
import {
  createReadClient,
  getAttestations as _getAttestations,
  verifyAttestation as _verifyAttestation,
  getAuditorReputation as _getAuditorReputation,
  getMetadataURI as _getMetadataURI,
  getSkillListing as _getSkillListing,
  getUnstakeRequest as _getUnstakeRequest,
  listAllSkills as _listAllSkills,
  listListedSkills as _listListedSkills,
  listAllAuditors as _listAllAuditors,
  listDisputes as _listDisputes,
  listResolvedDisputes as _listResolvedDisputes,
  listSkill as _listSkill,
  registerAuditor as _registerAuditor,
  addStake as _addStake,
  registerSkill as _registerSkill,
  openDispute as _openDispute,
  resolveDispute as _resolveDispute,
  initiateUnstake as _initiateUnstake,
  completeUnstake as _completeUnstake,
  cancelUnstake as _cancelUnstake,
  getBounty as _getBounty,
  listBounties as _listBounties,
  postBounty as _postBounty,
  reclaimBounty as _reclaimBounty,
  getDispute as _getDispute,
  getActiveDisputeCount as _getActiveDisputeCount,
  getDisputeCount as _getDisputeCount,
  isAttestationRevoked as _isAttestationRevoked,
  revokeAttestation as _revokeAttestation,
  getAuditorProfile as _getAuditorProfile,
} from './registry';
import { REGISTRY_ADDRESSES } from './constants';
import {
  ERC8004_CHAIN_ADDRESSES,
  AUDIT_LEVEL_SCORES,
} from './erc8004-constants';
import {
  resolveErc8004Addresses,
  registerAgent as _registerAgent,
  setAgentMetadata as _setAgentMetadata,
  requestErc8004Validation as _requestErc8004Validation,
  respondToErc8004Validation as _respondToErc8004Validation,
  getValidationSummary as _getValidationSummary,
  getReputationSummary as _getReputationSummary,
  getValidationStatus as _getValidationStatus,
  createAgentRegistration as _createAgentRegistration,
} from './erc8004';
import {
  buildTrustProfile as _buildTrustProfile,
  buildSkillTrustScore as _buildSkillTrustScore,
} from './trust';

/**
 * High-level client for interacting with the AEGIS protocol.
 *
 * Read operations work out of the box — just provide a chainId.
 * Write operations require a wallet via setWallet().
 *
 * @example
 * ```ts
 * import { AegisClient } from '@aegisaudit/sdk';
 *
 * const client = new AegisClient({ chainId: 8453 });
 *
 * // Discover all registered skills
 * const skills = await client.listAllSkills();
 *
 * // Query attestations for a specific skill
 * const attestations = await client.getAttestations(skills[0].skillHash);
 *
 * // Verify an attestation's ZK proof on-chain
 * const isValid = await client.verify(skills[0].skillHash, 0);
 *
 * // Get skill metadata
 * const uri = await client.getMetadataURI(skills[0].skillHash);
 * ```
 */
export class AegisClient {
  private readonly config: AegisConfig & { registryAddress: Address };
  private readonly publicClient: PublicClient;
  private walletClient?: WalletClient<Transport, Chain, Account>;

  constructor(config: AegisConfig) {
    const registryAddress =
      config.registryAddress ?? REGISTRY_ADDRESSES[config.chainId];
    if (!registryAddress) {
      throw new Error(
        `No registry address for chain ${config.chainId}. Pass registryAddress explicitly.`,
      );
    }
    this.config = { ...config, registryAddress };
    this.publicClient = createReadClient(this.config);
  }

  /** Attach a wallet client for write operations */
  setWallet(walletClient: WalletClient<Transport, Chain, Account>): void {
    this.walletClient = walletClient;
  }

  private requireWallet(): WalletClient<Transport, Chain, Account> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations. Call setWallet() first.');
    }
    return this.walletClient;
  }

  // ──────────────────────────────────────────────
  //  Read Operations
  // ──────────────────────────────────────────────

  /** Get all attestations for a skill */
  async getAttestations(skillHash: Hex): Promise<Attestation[]> {
    return _getAttestations(this.publicClient, this.config.registryAddress, skillHash);
  }

  /** Verify an attestation's ZK proof on-chain */
  async verify(skillHash: Hex, attestationIndex: number): Promise<boolean> {
    return _verifyAttestation(
      this.publicClient,
      this.config.registryAddress,
      skillHash,
      BigInt(attestationIndex),
    );
  }

  /** Get an auditor's reputation data */
  async getAuditorReputation(auditorCommitment: Hex): Promise<AuditorReputation> {
    return _getAuditorReputation(this.publicClient, this.config.registryAddress, auditorCommitment);
  }

  /** Get the metadata URI for a registered skill */
  async getMetadataURI(skillHash: Hex): Promise<string> {
    return _getMetadataURI(this.publicClient, this.config.registryAddress, skillHash);
  }

  /** Get a skill listing (for unaudited/listed skills awaiting audit) */
  async getSkillListing(skillHash: Hex): Promise<SkillListing> {
    return _getSkillListing(this.publicClient, this.config.registryAddress, skillHash);
  }

  // ──────────────────────────────────────────────
  //  Discovery — browse skills, auditors, disputes
  // ──────────────────────────────────────────────

  /**
   * List all registered skills by scanning on-chain events.
   * Returns every SkillRegistered event with hash, level, auditor, and tx info.
   */
  async listAllSkills(
    options?: { fromBlock?: bigint; toBlock?: bigint },
  ): Promise<SkillRegisteredEvent[]> {
    return _listAllSkills(this.publicClient, this.config.registryAddress, options);
  }

  /**
   * List all listed skills (awaiting audit) by scanning SkillListed events.
   * These are skills that were listed via listSkill() but haven't been audited yet.
   */
  async listListedSkills(
    options?: { fromBlock?: bigint; toBlock?: bigint },
  ): Promise<SkillListedEvent[]> {
    return _listListedSkills(this.publicClient, this.config.registryAddress, options);
  }

  /**
   * List all registered auditors by scanning on-chain events.
   */
  async listAllAuditors(
    options?: { fromBlock?: bigint; toBlock?: bigint },
  ): Promise<AuditorRegisteredEvent[]> {
    return _listAllAuditors(this.publicClient, this.config.registryAddress, options);
  }

  /**
   * List all opened disputes. Optionally filter by skillHash.
   */
  async listDisputes(
    options?: { skillHash?: Hex; fromBlock?: bigint; toBlock?: bigint },
  ): Promise<DisputeOpenedEvent[]> {
    return _listDisputes(this.publicClient, this.config.registryAddress, options);
  }

  /**
   * List all resolved disputes.
   */
  async listResolvedDisputes(
    options?: { fromBlock?: bigint; toBlock?: bigint },
  ): Promise<DisputeResolvedEvent[]> {
    return _listResolvedDisputes(this.publicClient, this.config.registryAddress, options);
  }

  // ──────────────────────────────────────────────
  //  Write Operations (require wallet)
  // ──────────────────────────────────────────────

  /**
   * List a skill for future auditing (no auditor or ZK proof required).
   *
   * This is the lightweight way to populate the registry with skills.
   * Anyone can list a skill with metadata; auditors can then discover
   * and audit listed skills.
   *
   * **Requirements:**
   * - `skillHash` must not be zero
   * - `metadataURI` must not be empty
   * - Wallet must have >= 0.001 ETH for the listing fee
   *
   * @param params - See {@link ListSkillParams} for details
   * @returns Transaction hash
   *
   * @example
   * ```ts
   * import { keccak256, toBytes } from 'viem';
   * import { metadataToDataURI } from '@aegisaudit/sdk';
   *
   * const skillHash = keccak256(toBytes(sourceCode));
   * const metadataURI = metadataToDataURI({
   *   name: 'My AI Skill',
   *   description: 'A skill that does X',
   *   version: '1.0.0',
   * });
   *
   * const txHash = await client.listSkill({ skillHash, metadataURI });
   * ```
   */
  async listSkill(params: ListSkillParams): Promise<Hex> {
    return _listSkill(this.requireWallet(), this.config.registryAddress, params);
  }

  /**
   * Register a skill attestation on the AEGIS Registry.
   *
   * **Prerequisites (all required or the transaction will revert):**
   * 1. Call `registerAuditor()` first — the `auditorCommitment` must be registered on-chain
   * 2. Generate a valid ZK proof via the Noir circuit (`generateAttestation()` or CLI)
   * 3. Wallet must have >= 0.001 ETH for the registration fee
   *
   * **auditLevel must be exactly 1, 2, or 3:**
   * - `1` = L1 Functional (automated scan)
   * - `2` = L2 Robust (static + dynamic analysis)
   * - `3` = L3 Security (full manual audit)
   *
   * **Common revert errors:**
   * - `InvalidAuditLevel` (0x657f08f5) — auditLevel is not 1, 2, or 3
   * - `AuditorNotRegistered` (0x57fb4f95) — auditorCommitment not registered
   * - `InvalidProof` (0x09bde339) — ZK proof failed on-chain verification
   * - `InsufficientFee` (0x025dbdd4) — less than 0.001 ETH sent
   *
   * @param params - See {@link RegisterSkillParams} for detailed field descriptions
   * @returns Transaction hash
   *
   * @example
   * ```ts
   * // Step 1: Register auditor (one-time)
   * await client.registerAuditor(commitment, parseEther('0.01'));
   *
   * // Step 2: Register skill
   * const txHash = await client.registerSkill({
   *   skillHash: '0x...',
   *   metadataURI: metadataToDataURI({ name: 'My Skill', description: '...', version: '1.0' }),
   *   attestationProof: '0x...',
   *   publicInputs: [skillHash, criteriaHash, auditLevelHex, auditorCommitment],
   *   auditorCommitment: '0x...',
   *   auditLevel: 2, // MUST be 1, 2, or 3
   * });
   * ```
   */
  async registerSkill(params: RegisterSkillParams): Promise<Hex> {
    return _registerSkill(this.requireWallet(), this.config.registryAddress, params);
  }

  /**
   * Register as an anonymous auditor by staking ETH.
   *
   * This must be called **before** `registerSkill()` — the auditorCommitment
   * must exist on-chain or skill registration will revert with `AuditorNotRegistered`.
   *
   * The commitment is a Pedersen hash of the auditor's private key, providing
   * anonymous on-chain identity (no wallet address or KYC).
   * A 5% protocol fee is deducted from the stake.
   *
   * @param auditorCommitment - Pedersen hash of auditor private key (bytes32)
   * @param stakeAmount - Amount to stake in wei (minimum 0.01 ETH = 10000000000000000n)
   * @returns Transaction hash
   *
   * @example
   * ```ts
   * import { parseEther } from 'viem';
   *
   * const txHash = await client.registerAuditor(
   *   '0x1b90cf3b...', // Pedersen commitment
   *   parseEther('0.02'), // Stake 0.02 ETH
   * );
   * ```
   */
  async registerAuditor(auditorCommitment: Hex, stakeAmount: bigint): Promise<Hex> {
    return _registerAuditor(
      this.requireWallet(),
      this.config.registryAddress,
      auditorCommitment,
      stakeAmount,
    );
  }

  /** Add more stake to an existing auditor registration */
  async addStake(auditorCommitment: Hex, amount: bigint): Promise<Hex> {
    return _addStake(
      this.requireWallet(),
      this.config.registryAddress,
      auditorCommitment,
      amount,
    );
  }

  /** Open a dispute against a skill attestation */
  async openDispute(
    skillHash: Hex,
    attestationIndex: number,
    evidence: Hex,
    bond: bigint,
  ): Promise<Hex> {
    return _openDispute(
      this.requireWallet(),
      this.config.registryAddress,
      skillHash,
      BigInt(attestationIndex),
      evidence,
      bond,
    );
  }

  /** Resolve a dispute (contract owner only) */
  async resolveDispute(disputeId: bigint, auditorFault: boolean): Promise<Hex> {
    return _resolveDispute(
      this.requireWallet(),
      this.config.registryAddress,
      disputeId,
      auditorFault,
    );
  }

  /** Get full dispute details by ID */
  async getDispute(disputeId: bigint): Promise<DisputeDetails> {
    return _getDispute(this.publicClient, this.config.registryAddress, disputeId);
  }

  /** Get the number of active (unresolved) disputes for an auditor */
  async getActiveDisputeCount(auditorCommitment: Hex): Promise<bigint> {
    return _getActiveDisputeCount(this.publicClient, this.config.registryAddress, auditorCommitment);
  }

  /** Get the total number of disputes ever created */
  async getDisputeCount(): Promise<bigint> {
    return _getDisputeCount(this.publicClient, this.config.registryAddress);
  }

  // ──────────────────────────────────────────────
  //  Revocation Operations
  // ──────────────────────────────────────────────

  /** Check if an attestation has been revoked */
  async isAttestationRevoked(skillHash: Hex, attestationIndex: number): Promise<boolean> {
    return _isAttestationRevoked(
      this.publicClient,
      this.config.registryAddress,
      skillHash,
      BigInt(attestationIndex),
    );
  }

  /** Revoke an attestation (contract owner only) */
  async revokeAttestation(skillHash: Hex, attestationIndex: number): Promise<Hex> {
    return _revokeAttestation(
      this.requireWallet(),
      this.config.registryAddress,
      skillHash,
      BigInt(attestationIndex),
    );
  }

  // ──────────────────────────────────────────────
  //  Auditor Profile — Aggregated Query
  // ──────────────────────────────────────────────

  /**
   * Build an aggregated auditor profile combining reputation, attestation history,
   * dispute record, and active dispute count into a single query.
   */
  async getAuditorProfile(
    auditorCommitment: Hex,
    options?: { fromBlock?: bigint; toBlock?: bigint },
  ): Promise<AuditorProfile> {
    return _getAuditorProfile(
      this.publicClient,
      this.config.registryAddress,
      auditorCommitment,
      options,
    );
  }

  // ──────────────────────────────────────────────
  //  Unstaking Operations
  // ──────────────────────────────────────────────

  /** Get a pending unstake request for an auditor */
  async getUnstakeRequest(auditorCommitment: Hex): Promise<UnstakeRequest> {
    return _getUnstakeRequest(this.publicClient, this.config.registryAddress, auditorCommitment);
  }

  /** Initiate an unstake with a 3-day cooldown */
  async initiateUnstake(auditorCommitment: Hex, amount: bigint): Promise<Hex> {
    return _initiateUnstake(
      this.requireWallet(),
      this.config.registryAddress,
      auditorCommitment,
      amount,
    );
  }

  /** Complete a pending unstake after the cooldown period */
  async completeUnstake(auditorCommitment: Hex): Promise<Hex> {
    return _completeUnstake(
      this.requireWallet(),
      this.config.registryAddress,
      auditorCommitment,
    );
  }

  /** Cancel a pending unstake request */
  async cancelUnstake(auditorCommitment: Hex): Promise<Hex> {
    return _cancelUnstake(
      this.requireWallet(),
      this.config.registryAddress,
      auditorCommitment,
    );
  }

  // ──────────────────────────────────────────────
  //  Bounty Operations
  // ──────────────────────────────────────────────

  /** Get bounty details for a skill */
  async getBounty(skillHash: Hex): Promise<BountyInfo> {
    return _getBounty(this.publicClient, this.config.registryAddress, skillHash);
  }

  /**
   * List all posted bounties by scanning on-chain events.
   * Optionally filter by skillHash.
   */
  async listBounties(
    options?: { skillHash?: Hex; fromBlock?: bigint; toBlock?: bigint },
  ): Promise<BountyPostedEvent[]> {
    return _listBounties(this.publicClient, this.config.registryAddress, options);
  }

  /** Post a bounty to incentivize auditors for a skill */
  async postBounty(skillHash: Hex, requiredLevel: number, amount: bigint): Promise<Hex> {
    return _postBounty(
      this.requireWallet(),
      this.config.registryAddress,
      skillHash,
      requiredLevel,
      amount,
    );
  }

  /** Reclaim an expired, unclaimed bounty */
  async reclaimBounty(skillHash: Hex): Promise<Hex> {
    return _reclaimBounty(
      this.requireWallet(),
      this.config.registryAddress,
      skillHash,
    );
  }

  // ──────────────────────────────────────────────
  //  ERC-8004 Integration
  // ──────────────────────────────────────────────

  private requireErc8004Addresses() {
    return resolveErc8004Addresses(this.config.chainId);
  }

  /** Check if ERC-8004 contracts are available on this chain */
  hasErc8004Support(): boolean {
    return !!ERC8004_CHAIN_ADDRESSES[this.config.chainId];
  }

  /** Register a new agent in the ERC-8004 IdentityRegistry */
  async registerAgent(agentURI: string): Promise<{ txHash: Hex }> {
    this.requireErc8004Addresses();
    return _registerAgent(this.requireWallet(), this.config.chainId, agentURI);
  }

  /**
   * Step 1: Request ERC-8004 validation (called by agent owner).
   * Submits a validation request to the ValidationRegistry, naming the
   * AEGIS validator who will respond separately.
   */
  async requestErc8004Validation(params: RequestErc8004ValidationParams): Promise<{
    requestHash: Hex;
    requestTxHash: Hex;
  }> {
    this.requireErc8004Addresses();
    return _requestErc8004Validation(this.requireWallet(), this.config.chainId, params);
  }

  /**
   * Step 2: Respond to ERC-8004 validation (called by AEGIS validator).
   * Submits the validation response with mapped AEGIS score + optional reputation.
   * Must be called by a different wallet than the one that submitted the request.
   */
  async respondToErc8004Validation(params: RespondToErc8004ValidationParams): Promise<{
    responseTxHash: Hex;
    reputationTxHash?: Hex;
  }> {
    this.requireErc8004Addresses();
    return _respondToErc8004Validation(this.requireWallet(), this.config.chainId, params);
  }

  /** Get ERC-8004 validation summary for an agent (filtered by AEGIS tag) */
  async getErc8004ValidationSummary(
    agentId: bigint,
    validatorAddresses?: Address[],
  ): Promise<ValidationSummary> {
    this.requireErc8004Addresses();
    return _getValidationSummary(
      this.publicClient,
      this.config.chainId,
      agentId,
      validatorAddresses,
    );
  }

  /** Get ERC-8004 reputation summary for an agent */
  async getErc8004ReputationSummary(
    agentId: bigint,
    clientAddresses?: Address[],
  ): Promise<ReputationSummary> {
    this.requireErc8004Addresses();
    return _getReputationSummary(
      this.publicClient,
      this.config.chainId,
      agentId,
      clientAddresses,
    );
  }

  /** Link a skill hash to an agent's ERC-8004 metadata */
  async linkSkillToAgent(
    agentId: bigint,
    skillHash: Hex,
    auditLevel: 1 | 2 | 3,
  ): Promise<Hex> {
    this.requireErc8004Addresses();
    const metadataKey = `aegis:skill:${skillHash}`;
    const value = `0x${Buffer.from(
      JSON.stringify({ skillHash, auditLevel, score: AUDIT_LEVEL_SCORES[auditLevel] }),
    ).toString('hex')}` as Hex;
    return _setAgentMetadata(
      this.requireWallet(),
      this.config.chainId,
      agentId,
      metadataKey,
      value,
    );
  }

  /** Generate ERC-8004 agent registration JSON */
  createAgentRegistration(
    params: Omit<AgentRegistration, 'agentURI'>,
  ): Record<string, unknown> {
    return _createAgentRegistration(params);
  }

  // ──────────────────────────────────────────────
  //  Trust Profile (Direct Mode)
  // ──────────────────────────────────────────────

  /**
   * Build an aggregated trust profile for an agent (direct mode).
   * Pulls data from AEGIS Registry + ERC-8004 registries on-chain.
   * No x402 payment required — but makes multiple RPC calls.
   *
   * @param agentId - The ERC-8004 agent identity ID
   * @param options.knownSkillHashes - Skip skill scan by providing known linked skill hashes
   */
  async getTrustProfile(
    agentId: bigint,
    options?: { knownSkillHashes?: Hex[] },
  ): Promise<TrustProfile> {
    this.requireErc8004Addresses();
    return _buildTrustProfile(
      this.publicClient,
      this.config.registryAddress,
      this.config.chainId,
      agentId,
      options,
    );
  }

  /**
   * Build trust data for a single skill (direct mode).
   * Returns attestations, dispute status, and highest audit level.
   */
  async getSkillTrustScore(
    skillHash: Hex,
    options?: { verify?: boolean },
  ): Promise<SkillTrustScore> {
    return _buildSkillTrustScore(
      this.publicClient,
      this.config.registryAddress,
      skillHash,
      options,
    );
  }
}
