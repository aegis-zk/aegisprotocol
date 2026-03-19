import type { Address } from './types';

export const CHAIN_CONFIG = {
  base: {
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
  },
} as const;

/**
 * Deployed contract addresses per chain.
 * Updated after each deployment.
 */
export const REGISTRY_ADDRESSES: Record<number, Address> = {
  // Base Mainnet (v5 — referral rewards, all v4 features)
  8453: '0xcB2D64212431D942dE5559F50946BAeD521923Cc',
};

/** Legacy v4 addresses — indexer reads from both v4 + v5 */
export const REGISTRY_V4_ADDRESSES: Record<number, Address> = {
  8453: '0xEFF449364D8f064e6dBCF0f0e0aD030D7E489cCd',
};

export const MIN_AUDITOR_STAKE = BigInt('10000000000000000'); // 0.01 ETH
export const MIN_DISPUTE_BOND = BigInt('5000000000000000'); // 0.005 ETH
export const REGISTRATION_FEE = BigInt('1000000000000000'); // 0.001 ETH
export const UNSTAKE_COOLDOWN = 3 * 24 * 60 * 60; // 3 days in seconds
export const PROTOCOL_FEE_BPS = 500; // 5% fee on staking (500 basis points)
export const MIN_BOUNTY = BigInt('1000000000000000'); // 0.001 ETH
export const BOUNTY_EXPIRATION = 30 * 24 * 60 * 60; // 30 days in seconds
export const LISTING_FEE = BigInt('1000000000000000'); // 0.001 ETH (same as registration fee)
export const REFERRAL_BPS = 5000; // 50% of fee to referrer (5000 basis points)

/**
 * Deployment block numbers for each chain.
 * Event queries default to starting from these blocks.
 */
export const DEPLOYMENT_BLOCKS: Record<number, bigint> = {
  8453: 43575353n, // Base Mainnet deployment v5 (Mar 19 2026)
};

/** Max block range for eth_getLogs (public RPCs typically limit to 10K) */
export const MAX_LOG_RANGE = 9_999n;

/**
 * Contract error selectors for debugging reverts.
 *
 * When a transaction reverts, the error data starts with a 4-byte selector.
 * Match it against this map to identify the error.
 *
 * @example
 * ```ts
 * // If you catch a revert with data starting with 0x657f08f5:
 * const errorName = REVERT_ERRORS['0x657f08f5'];
 * // => 'InvalidAuditLevel — auditLevel must be 1, 2, or 3'
 * ```
 */
export const REVERT_ERRORS: Record<string, string> = {
  '0x657f08f5': 'InvalidAuditLevel — auditLevel must be 1, 2, or 3',
  '0x57fb4f95': 'AuditorNotRegistered — auditorCommitment not registered on-chain (call registerAuditor first)',
  '0x09bde339': 'InvalidProof — ZK proof failed on-chain verification',
  '0x025dbdd4': 'InsufficientFee — transaction value < 0.001 ETH registration fee',
  '0xf1bc94d2': 'InsufficientStake — auditor stake below 0.01 ETH minimum',
  '0x82b42900': 'Unauthorized — caller not authorized for this action',
  '0x8046aa2c': 'SkillAlreadyListed — skill hash already has a listing',
  '0xae921357': 'EmptyMetadata — metadataURI cannot be empty',
  '0xd556b563': 'InvalidSkillHash — skill hash cannot be zero',
  '0xbf8513a4': 'InsufficientListingFee — listing fee must be >= 0.001 ETH',
  '0x905e7107': 'AlreadyRevoked — attestation has already been revoked',
  '0x4250af08': 'DisputeNotFound — dispute ID does not exist',
};
