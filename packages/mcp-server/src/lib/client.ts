import { AegisClient } from '@aegisaudit/sdk';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

let clientInstance: AegisClient | null = null;

const CHAINS: Record<number, typeof base> = {
  8453: base,
};

/**
 * Get or create the singleton AegisClient.
 *
 * Configuration is resolved from environment variables:
 *   AEGIS_CHAIN_ID      — defaults to 8453 (Base)
 *   AEGIS_RPC_URL       — optional custom RPC endpoint
 *   AEGIS_REGISTRY      — optional explicit registry address
 *   AEGIS_PRIVATE_KEY   — optional wallet private key for write operations
 */
export function getClient(): AegisClient {
  if (clientInstance) return clientInstance;

  const chainId = Number(process.env.AEGIS_CHAIN_ID ?? '8453');
  const rpcUrl = process.env.AEGIS_RPC_URL ?? undefined;
  const registryAddress = process.env.AEGIS_REGISTRY as `0x${string}` | undefined;

  clientInstance = new AegisClient({
    chainId,
    rpcUrl,
    registryAddress,
  });

  // If a private key is provided, attach a wallet client for write operations
  const privateKey = process.env.AEGIS_PRIVATE_KEY as `0x${string}` | undefined;
  if (privateKey) {
    const chain = CHAINS[chainId];
    if (!chain) throw new Error(`Unsupported chain for wallet: ${chainId}`);

    const account = privateKeyToAccount(privateKey);
    const wallet = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });
    clientInstance.setWallet(wallet);
  }

  return clientInstance;
}

/**
 * Check if a wallet is configured via AEGIS_PRIVATE_KEY.
 */
export function hasWallet(): boolean {
  return !!process.env.AEGIS_PRIVATE_KEY;
}

/**
 * Get the wallet address if configured, or null.
 */
export function getWalletAddress(): string | null {
  const key = process.env.AEGIS_PRIVATE_KEY as `0x${string}` | undefined;
  if (!key) return null;
  try {
    return privateKeyToAccount(key).address;
  } catch {
    return null;
  }
}
