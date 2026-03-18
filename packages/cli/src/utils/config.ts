import { CHAIN_CONFIG } from '@aegisaudit/sdk';
import type { Address } from 'viem';

export interface CLIConfig {
  chainId: number;
  rpcUrl: string;
  registryAddress: Address;
  privateKey?: `0x${string}`;
}

/**
 * Resolve CLI config from command options + environment variables.
 * Priority: CLI flags > env vars > defaults
 */
export function resolveConfig(opts: {
  network?: string;
  rpc?: string;
  registry?: string;
  privateKey?: string;
}): CLIConfig {
  const network = opts.network ?? process.env.AEGIS_NETWORK ?? 'base';
  const chainConfig = CHAIN_CONFIG.base;

  const rpcUrl =
    opts.rpc ??
    process.env.AEGIS_RPC_URL ??
    process.env.BASE_RPC_URL ??
    chainConfig.rpcUrl;

  const registryAddress =
    (opts.registry ?? process.env.AEGIS_REGISTRY_ADDRESS) as Address | undefined;

  if (!registryAddress) {
    throw new Error(
      'Registry address required. Use --registry <address> or set AEGIS_REGISTRY_ADDRESS env var.',
    );
  }

  const privateKey =
    (opts.privateKey ?? process.env.AEGIS_PRIVATE_KEY) as `0x${string}` | undefined;

  return {
    chainId: chainConfig.chainId,
    rpcUrl,
    registryAddress,
    privateKey,
  };
}
