// Client
export { AegisClient } from './client';

// Types
export type {
  Attestation,
  AuditorReputation,
  UnstakeRequest,
  BountyInfo,
  DisputeInfo,
  DisputeDetails,
  AuditorProfile,
  AuditorAttestationRecord,
  AuditorDisputeRecord,
  AttestationRevokedEvent,
  AegisConfig,
  RegisterSkillParams,
  ListSkillParams,
  SkillListing,
  SubmitAttestationParams,
  SkillListedEvent,
  SkillRegisteredEvent,
  AuditorRegisteredEvent,
  DisputeOpenedEvent,
  DisputeResolvedEvent,
  BountyPostedEvent,
  BountyClaimedEvent,
  Hex,
  Address,
} from './types';

// Prover
export {
  generateAttestation,
  generateAttestationViaCLI,
  loadProofFromFiles,
  buildProverToml,
  findBbBinary,
  findCircuitArtifact,
} from './prover';
export type { ProofResult, ProveAttestationParams, CLIProveOptions } from './prover';

// IPFS & Metadata
export { fetchMetadata, fetchAuditMetadata, uploadMetadata, metadataToDataURI, dataURIToMetadata } from './ipfs';
export type { SkillMetadata } from './ipfs';

// Schema — Audit level standards & metadata validation
export {
  L1_CRITERIA,
  L2_CRITERIA,
  L3_CRITERIA,
  TAO_CRITERIA,
  LEVEL_CRITERIA,
  validateAuditMetadata,
  getRequiredCriteria,
  computeCriteriaHash,
  createAuditTemplate,
} from './schema';
export type {
  CriteriaId,
  CriteriaResult,
  SkillInfo,
  AuditEnvironment,
  AuditMetadata,
  ValidationResult,
} from './schema';

// TAO — Bittensor subnet integration
export {
  computeTaoSubnetHash,
  computeTaoMinerHash,
  parseTaoSkillHash,
  listSubnets,
  queryMetagraph,
  buildTaoSkillInfo,
} from './tao';
export type {
  TaoSubnetInfo,
  TaoMetagraphNode,
  TaoMetagraphData,
  TaoAxonInfo,
  TaoSkillMetadata,
} from './tao';

// Constants
export {
  CHAIN_CONFIG,
  REGISTRY_ADDRESSES,
  DEPLOYMENT_BLOCKS,
  MIN_AUDITOR_STAKE,
  MIN_DISPUTE_BOND,
  REGISTRATION_FEE,
  UNSTAKE_COOLDOWN,
  PROTOCOL_FEE_BPS,
  MIN_BOUNTY,
  BOUNTY_EXPIRATION,
  LISTING_FEE,
  REFERRAL_BPS,
  REGISTRY_V4_ADDRESSES,
  REVERT_ERRORS,
} from './constants';

// ERC-8004 Integration
export {
  resolveErc8004Addresses,
  computeRequestHash,
  getAgentMetadata,
  getAgentOwner,
  getValidationStatus,
  getValidationSummary,
  getReputationSummary,
  registerAgent,
  setAgentMetadata,
  submitValidationRequest,
  submitValidationResponse,
  giveAuditFeedback,
  requestErc8004Validation,
  respondToErc8004Validation,
  createAgentRegistration,
} from './erc8004';

// ERC-8004 Constants
export {
  ERC8004_ADDRESSES,
  ERC8004_CHAIN_ADDRESSES,
  AUDIT_LEVEL_SCORES,
  AEGIS_VALIDATION_TAG,
  AEGIS_REPUTATION_TAG,
  USDC_ADDRESSES,
} from './erc8004-constants';
export type { Erc8004Addresses } from './erc8004-constants';

// ERC-8004 Types
export type {
  ValidationStatus,
  ValidationSummary,
  ReputationSummary,
  AgentRegistration,
  RequestErc8004ValidationParams,
  RespondToErc8004ValidationParams,
  X402PaymentRequirement,
  X402AuditorConfig,
} from './types';

// x402 Payments
export { createX402Fetch, createAuditPaymentConfig, createTrustApiClient } from './x402';

// Trust Profile — aggregation & scoring
export {
  buildTrustProfile,
  buildSkillTrustScore,
  computeOverallTrustScore,
  batchBuildTrustProfiles,
  MAX_BATCH_SIZE,
} from './trust';

// Trust API Server — x402-gated middleware
export { createTrustApiMiddleware } from './trust-server';

// Trust Types
export type {
  TrustProfile,
  TrustLevel,
  SkillTrustScore,
  SkillAttestation,
  TrustApiConfig,
  TrustApiPricing,
  TrustApiClient,
} from './types';
