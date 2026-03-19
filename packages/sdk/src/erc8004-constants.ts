import type { Address } from './types';

// ──────────────────────────────────────────────
//  ERC-8004 Contract Addresses
// ──────────────────────────────────────────────

export interface Erc8004Addresses {
  identityRegistry: Address;
  reputationRegistry: Address;
  validationRegistry: Address | null;
}

/** ERC-8004 deployed contract addresses per chain */
export const ERC8004_ADDRESSES: Record<string, Erc8004Addresses> = {
  base: {
    identityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    reputationRegistry: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
    validationRegistry: '0x17CDbc4dbbEb0053EF9a6c1b3e0d1DA1FC5D76b3',
  },
};

/** Chain ID → ERC-8004 addresses lookup */
export const ERC8004_CHAIN_ADDRESSES: Record<number, Erc8004Addresses> = {
  8453: ERC8004_ADDRESSES.base,
};

// ──────────────────────────────────────────────
//  Score Mapping: AEGIS Audit Level → ERC-8004
// ──────────────────────────────────────────────

/**
 * Maps AEGIS audit levels to ERC-8004 validation scores (0–100).
 * L1 Functional = 33, L2 Robust = 66, L3 Security = 100
 */
export const AUDIT_LEVEL_SCORES: Record<number, number> = {
  1: 33,  // L1 Functional
  2: 66,  // L2 Robust
  3: 100, // L3 Security
};

/** Tag used to filter AEGIS validations in ERC-8004 registries */
export const AEGIS_VALIDATION_TAG = 'aegis-audit';

/** Secondary tag for reputation feedback */
export const AEGIS_REPUTATION_TAG = 'audit-quality';

// ──────────────────────────────────────────────
//  x402 USDC Addresses
// ──────────────────────────────────────────────

/** USDC contract addresses on Base chains */
export const USDC_ADDRESSES: Record<number, Address> = {
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',   // Base Mainnet
};
