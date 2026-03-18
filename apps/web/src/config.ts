import type { Address } from 'viem';

/**
 * Contract addresses per chain. Update after deployment.
 */
export const REGISTRY_ADDRESS: Record<number, Address> = {
  // Base Mainnet
  8453: '0xEFF449364D8f064e6dBCF0f0e0aD030D7E489cCd' as Address,
  // Anvil local (override via env)
  31337: (import.meta.env.VITE_REGISTRY_ADDRESS ?? '0x0000000000000000000000000000000000000000') as Address,
};

export const REGISTRATION_FEE = BigInt('1000000000000000'); // 0.001 ETH
export const MIN_AUDITOR_STAKE = BigInt('10000000000000000'); // 0.01 ETH
export const MIN_DISPUTE_BOND = BigInt('5000000000000000'); // 0.005 ETH
