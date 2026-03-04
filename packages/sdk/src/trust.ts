/**
 * Agent Trust Profile aggregation module.
 *
 * Combines data from the AEGIS Registry (skills, attestations, disputes)
 * and ERC-8004 registries (identity, validation, reputation) into a
 * unified TrustProfile for an AI agent.
 *
 * Two usage modes:
 * - Direct mode: call buildTrustProfile() locally (multiple RPC calls, free)
 * - API mode: serve via createTrustApiMiddleware() with x402 payment gating
 */

import type { PublicClient } from 'viem';
import type {
  Address,
  Hex,
  TrustProfile,
  TrustLevel,
  SkillTrustScore,
  SkillAttestation,
} from './types';
import {
  getAttestations,
  verifyAttestation,
  getMetadataURI,
  listAllSkills,
  listDisputes,
  listResolvedDisputes,
} from './registry';
import {
  getAgentOwner,
  getAgentMetadata,
  getValidationSummary,
  getReputationSummary,
} from './erc8004';

// ──────────────────────────────────────────────
//  Trust Score Algorithm
// ──────────────────────────────────────────────

/** Base score contribution from the highest audit level */
const AUDIT_BASE_SCORES: Record<number, number> = {
  1: 20, // L1 Functional
  2: 40, // L2 Robust
  3: 60, // L3 Security
};

/**
 * Compute a composite trust score (0-100) and trust level classification.
 *
 * Scoring breakdown:
 * - Audit base (60% weight): highest audit level across skills → L1=20, L2=40, L3=60
 * - Validation consensus (20%): ERC-8004 validation average score
 * - Reputation (10%): ERC-8004 reputation summary, normalized to 0-100
 * - Multi-skill bonus (10%): +5 per additional audited skill, max +10
 * - Dispute penalty: -10 per skill with active disputes
 *
 * Trust levels:
 * - trusted: score >= 80, L3+, no active disputes
 * - verified: score >= 50, L2+, no active disputes
 * - basic: score >= 20, L1+
 * - unknown: everything else
 */
export function computeOverallTrustScore(
  skills: SkillTrustScore[],
  validation: { count: bigint; averageScore: number },
  reputation: { count: bigint; summaryValue: bigint; summaryValueDecimals: number },
): TrustProfile['overall'] {
  // Base score from highest audit level across all skills
  const highestAuditLevel = skills.length > 0
    ? Math.max(...skills.map((s) => s.highestLevel))
    : 0;

  let score = AUDIT_BASE_SCORES[highestAuditLevel] ?? 0;

  // Validation consensus (weighted 20%)
  if (validation.count > 0n) {
    score += (validation.averageScore / 100) * 20;
  }

  // Reputation (weighted 10%)
  if (reputation.count > 0n) {
    const divisor = 10 ** reputation.summaryValueDecimals;
    const repNormalized = Math.min(
      100,
      Math.max(0, Number(reputation.summaryValue) / (divisor || 1)),
    );
    score += (repNormalized / 100) * 10;
  }

  // Multi-skill bonus: +5 per additional audited skill (max +10)
  const auditedSkillCount = skills.filter((s) => s.highestLevel > 0).length;
  if (auditedSkillCount > 1) {
    score += Math.min(10, (auditedSkillCount - 1) * 5);
  }

  // Dispute penalty: -10 per skill with active disputes
  const activeDisputeCount = skills.filter((s) => s.hasActiveDisputes).length;
  score -= activeDisputeCount * 10;

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, Math.round(score)));

  const hasActiveDisputes = activeDisputeCount > 0;
  const skillCount = skills.length;

  // Determine trust level
  let level: TrustLevel = 'unknown';
  if (score >= 80 && highestAuditLevel >= 3 && !hasActiveDisputes) {
    level = 'trusted';
  } else if (score >= 50 && highestAuditLevel >= 2 && !hasActiveDisputes) {
    level = 'verified';
  } else if (score >= 20 && highestAuditLevel >= 1) {
    level = 'basic';
  }

  return {
    trustScore: score,
    level,
    skillCount,
    highestAuditLevel,
    hasActiveDisputes,
  };
}

// ──────────────────────────────────────────────
//  Skill Trust Score
// ──────────────────────────────────────────────

/**
 * Build trust data for a single skill.
 *
 * Aggregates attestations, metadata, and dispute status from the AEGIS Registry.
 * By default, attestations are marked as verified (proofs are checked at
 * registration time). Pass `options.verify = true` to re-verify on-chain.
 */
export async function buildSkillTrustScore(
  publicClient: PublicClient,
  registryAddress: Address,
  skillHash: Hex,
  options?: { verify?: boolean },
): Promise<SkillTrustScore> {
  // Fetch attestations, metadata, and disputes in parallel
  const [rawAttestations, metadataURI, openDisputes, resolvedDisputes] =
    await Promise.all([
      getAttestations(publicClient, registryAddress, skillHash),
      getMetadataURI(publicClient, registryAddress, skillHash),
      listDisputes(publicClient, registryAddress, { skillHash }),
      listResolvedDisputes(publicClient, registryAddress),
    ]);

  // Determine which disputes are still active (opened but not resolved)
  const resolvedDisputeIds = new Set(
    resolvedDisputes.map((d) => d.disputeId.toString()),
  );
  const activeDisputes = openDisputes.filter(
    (d) => !resolvedDisputeIds.has(d.disputeId.toString()),
  );

  // Map attestations to SkillAttestation format
  const attestations: SkillAttestation[] = await Promise.all(
    rawAttestations.map(async (att, index) => {
      let verified = true; // default: assume valid (checked at registration)
      if (options?.verify) {
        try {
          verified = await verifyAttestation(
            publicClient,
            registryAddress,
            skillHash,
            BigInt(index),
          );
        } catch {
          verified = false;
        }
      }
      return {
        auditorCommitment: att.auditorCommitment,
        auditLevel: att.auditLevel,
        timestamp: att.timestamp,
        verified,
      };
    }),
  );

  const highestLevel =
    attestations.length > 0
      ? Math.max(...attestations.map((a) => a.auditLevel))
      : 0;

  return {
    skillHash,
    metadataURI,
    attestations,
    highestLevel,
    disputeCount: openDisputes.length,
    hasActiveDisputes: activeDisputes.length > 0,
  };
}

// ──────────────────────────────────────────────
//  Agent Trust Profile
// ──────────────────────────────────────────────

/**
 * Build an aggregated trust profile for an AI agent.
 *
 * Combines data from the AEGIS Registry (skills, attestations, disputes)
 * and ERC-8004 registries (identity, validation, reputation) into a
 * single TrustProfile with a composite 0-100 trust score.
 *
 * @param publicClient - A viem PublicClient for on-chain reads
 * @param registryAddress - AegisRegistry contract address
 * @param chainId - Chain ID (8453 for Base, 84532 for Base Sepolia)
 * @param agentId - The ERC-8004 agent identity ID
 * @param options.knownSkillHashes - Skip skill scan by providing known linked skill hashes
 */
export async function buildTrustProfile(
  publicClient: PublicClient,
  registryAddress: Address,
  chainId: number,
  agentId: bigint,
  options?: { knownSkillHashes?: Hex[] },
): Promise<TrustProfile> {
  // 1. Fetch identity data and ERC-8004 summaries in parallel
  const [owner, validationResult, reputationResult] = await Promise.all([
    getAgentOwner(publicClient, chainId, agentId),
    getValidationSummary(publicClient, chainId, agentId),
    getReputationSummary(publicClient, chainId, agentId),
  ]);

  // 2. Resolve agent URI from ERC-8004 IdentityRegistry metadata
  let agentURI = '';
  try {
    const rawURI = await getAgentMetadata(
      publicClient,
      chainId,
      agentId,
      'agentURI',
    );
    if (rawURI && rawURI !== '0x') {
      agentURI = Buffer.from(rawURI.slice(2), 'hex').toString('utf8');
    }
  } catch {
    // agentURI remains empty if not set
  }

  // 3. Discover skill hashes linked to this agent
  let skillHashes: Hex[] = options?.knownSkillHashes ?? [];
  if (skillHashes.length === 0) {
    // Scan all registered skills and check which are linked to this agent
    const allSkills = await listAllSkills(publicClient, registryAddress);
    const uniqueHashes = [...new Set(allSkills.map((s) => s.skillHash))];

    // Check each skill for agent linkage via ERC-8004 metadata
    const linkChecks = await Promise.all(
      uniqueHashes.map(async (hash) => {
        try {
          const meta = await getAgentMetadata(
            publicClient,
            chainId,
            agentId,
            `aegis:skill:${hash}`,
          );
          return meta && meta !== '0x' ? hash : null;
        } catch {
          return null;
        }
      }),
    );
    skillHashes = linkChecks.filter((h): h is Hex => h !== null);
  }

  // 4. Build trust scores for each linked skill
  const skills = await Promise.all(
    skillHashes.map((hash) =>
      buildSkillTrustScore(publicClient, registryAddress, hash),
    ),
  );

  // 5. Assemble validation and reputation data
  const validation = {
    count: validationResult.count,
    averageScore: validationResult.averageResponse,
  };
  const reputation = {
    count: reputationResult.count,
    summaryValue: reputationResult.summaryValue,
    summaryValueDecimals: reputationResult.summaryValueDecimals,
  };

  // 6. Compute overall trust score
  const overall = computeOverallTrustScore(skills, validation, reputation);

  return {
    agentId,
    identity: { owner, agentURI },
    skills,
    validation,
    reputation,
    overall,
    timestamp: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────
//  Batch Trust Profiles
// ──────────────────────────────────────────────

/** Maximum agents per batch request */
export const MAX_BATCH_SIZE = 10;

/**
 * Build trust profiles for multiple agents in a single call.
 *
 * Uses Promise.allSettled to return partial results if some agents fail.
 * Capped at 10 agents per batch.
 */
export async function batchBuildTrustProfiles(
  publicClient: PublicClient,
  registryAddress: Address,
  chainId: number,
  agentIds: bigint[],
): Promise<TrustProfile[]> {
  if (agentIds.length > MAX_BATCH_SIZE) {
    throw new Error(
      `Batch size ${agentIds.length} exceeds maximum of ${MAX_BATCH_SIZE}.`,
    );
  }

  const results = await Promise.allSettled(
    agentIds.map((id) =>
      buildTrustProfile(publicClient, registryAddress, chainId, id),
    ),
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<TrustProfile> =>
        r.status === 'fulfilled',
    )
    .map((r) => r.value);
}
