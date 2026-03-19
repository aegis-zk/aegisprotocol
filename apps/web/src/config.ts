import type { Address } from 'viem';

/**
 * Contract addresses per chain. Update after deployment.
 */
export const REGISTRY_ADDRESS: Record<number, Address> = {
  // Base Mainnet (v5 — referral rewards)
  8453: '0xcB2D64212431D942dE5559F50946BAeD521923Cc' as Address,
  // Anvil local (override via env)
  31337: (import.meta.env.VITE_REGISTRY_ADDRESS ?? '0x0000000000000000000000000000000000000000') as Address,
};

/** Legacy v4 registry — still holds 287 skills, 21 attestations, 4 auditors */
export const REGISTRY_V4_ADDRESS: Record<number, Address> = {
  8453: '0xEFF449364D8f064e6dBCF0f0e0aD030D7E489cCd' as Address,
};

export const REGISTRATION_FEE = BigInt('1000000000000000'); // 0.001 ETH
export const MIN_AUDITOR_STAKE = BigInt('10000000000000000'); // 0.01 ETH
export const MIN_DISPUTE_BOND = BigInt('5000000000000000'); // 0.005 ETH
