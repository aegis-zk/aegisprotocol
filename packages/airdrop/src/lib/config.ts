import type { SnapshotConfig } from '../types.js';

const DEFAULT_SUBGRAPH =
  'https://api.studio.thegraph.com/query/1743315/aegis-protocol/v0.3.0';

export interface SnapshotOptions {
  amount: string;
  minReputation?: string;
  minStake?: string;
  subgraph?: string;
  output?: string;
  decimals?: string;
  noMerkle?: boolean;
}

export function resolveConfig(opts: SnapshotOptions): SnapshotConfig {
  const decimals = parseInt(opts.decimals ?? '18', 10);
  const multiplier = 10n ** BigInt(decimals);
  const amountFloat = parseFloat(opts.amount);

  if (isNaN(amountFloat) || amountFloat <= 0) {
    throw new Error(`Invalid amount: ${opts.amount}`);
  }

  // Convert human-readable amount to smallest unit
  // Handle decimals: split on '.', compute integer + fractional parts
  const [intPart, fracPart = ''] = opts.amount.split('.');
  const paddedFrac = fracPart.padEnd(decimals, '0').slice(0, decimals);
  const totalAmount = BigInt(intPart) * multiplier + BigInt(paddedFrac);

  return {
    totalAmount,
    minReputation: BigInt(opts.minReputation ?? '0'),
    minStake: opts.minStake
      ? BigInt(Math.floor(parseFloat(opts.minStake) * 1e18))
      : 0n,
    subgraphUrl:
      opts.subgraph ?? process.env.AEGIS_SUBGRAPH_URL ?? DEFAULT_SUBGRAPH,
    outputDir: opts.output ?? './snapshots',
    tokenDecimals: decimals,
    skipMerkle: opts.noMerkle ?? false,
  };
}
