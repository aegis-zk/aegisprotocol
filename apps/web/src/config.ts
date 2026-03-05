import type { Address } from 'viem';

/**
 * Contract addresses per chain. Update after deployment.
 */
export const REGISTRY_ADDRESS: Record<number, Address> = {
  // Base Mainnet
  8453: '0xa0FF1563Ab7d5d514146F2713125098954Af1F61' as Address,
  // Base Sepolia
  84532: '0x851CfbB116aBdd50Ab899c35680eBd8273dD6Bba' as Address,
  // Anvil local (override via env)
  31337: (import.meta.env.VITE_REGISTRY_ADDRESS ?? '0x0000000000000000000000000000000000000000') as Address,
};

export const REGISTRATION_FEE = BigInt('1000000000000000'); // 0.001 ETH
export const MIN_AUDITOR_STAKE = BigInt('10000000000000000'); // 0.01 ETH
export const MIN_DISPUTE_BOND = BigInt('5000000000000000'); // 0.005 ETH
