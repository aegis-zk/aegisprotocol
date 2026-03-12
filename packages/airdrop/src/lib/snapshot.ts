/**
 * Core snapshot logic: query auditors, compute proportional allocations.
 */

import type { SubgraphAuditor, AuditorAllocation, SnapshotConfig } from '../types.js';
import { fetchAllAuditors } from './subgraph.js';

/**
 * Query auditors and compute token allocations weighted by reputation score.
 * Uses pure BigInt arithmetic — no floating point.
 */
export async function computeAllocations(
  config: SnapshotConfig,
): Promise<{ allocations: AuditorAllocation[]; totalReputation: bigint }> {
  // 1. Fetch all eligible auditors
  const auditors = await fetchAllAuditors(config.minReputation, config.subgraphUrl);

  // 2. Apply additional filters (minStake)
  let eligible = auditors.filter((a) => a.registered);

  if (config.minStake > 0n) {
    eligible = eligible.filter(
      (a) => BigInt(a.currentStake) >= config.minStake,
    );
  }

  // Filter out zero-reputation auditors
  eligible = eligible.filter((a) => BigInt(a.reputationScore) > 0n);

  if (eligible.length === 0) {
    return { allocations: [], totalReputation: 0n };
  }

  // 3. Sort by commitment (hex) for deterministic output
  eligible.sort((a, b) => a.id.localeCompare(b.id));

  // 4. Compute total reputation
  const totalReputation = eligible.reduce(
    (sum, a) => sum + BigInt(a.reputationScore),
    0n,
  );

  if (totalReputation === 0n) {
    return { allocations: [], totalReputation: 0n };
  }

  // 5. Compute per-auditor allocation (BigInt division)
  const allocations: AuditorAllocation[] = [];
  let distributed = 0n;

  for (let i = 0; i < eligible.length; i++) {
    const a = eligible[i];
    const rep = BigInt(a.reputationScore);

    let tokenAmount: bigint;
    if (i === eligible.length - 1) {
      // Last auditor gets the dust
      tokenAmount = config.totalAmount - distributed;
    } else {
      tokenAmount = (config.totalAmount * rep) / totalReputation;
    }

    distributed += tokenAmount;

    const shareBps = Number((rep * 10000n) / totalReputation);
    const sharePercent = (Number(rep * 10000n / totalReputation) / 100).toFixed(2) + '%';

    allocations.push({
      commitment: a.id,
      reputationScore: a.reputationScore,
      currentStake: a.currentStake,
      shareBps,
      sharePercent,
      tokenAmount: tokenAmount.toString(),
      merkleProof: [], // filled later by merkle step
    });
  }

  return { allocations, totalReputation };
}
