import type { Hex } from '@aegisaudit/sdk';
import type {
  TrustPolicy,
  TrustGateConfig,
  TrustGateResult,
  TrustResolver,
  ResolvedTrustData,
} from './types.js';
import { SubgraphResolver } from './resolvers/subgraph.js';
import { OnchainResolver } from './resolvers/onchain.js';

/** Error thrown when a tool is blocked by the trust gate in enforce mode. */
export class AegisTrustError extends Error {
  public readonly result: TrustGateResult;

  constructor(result: TrustGateResult) {
    super(`AEGIS trust check failed for "${result.toolName}": ${result.reason}`);
    this.name = 'AegisTrustError';
    this.result = result;
  }
}

interface CacheEntry {
  data: ResolvedTrustData | null;
  expiresAt: number;
}

const DEFAULT_POLICY: Required<TrustPolicy> = {
  minAuditLevel: 1,
  minAttestations: 1,
  blockOnDispute: true,
  mode: 'enforce',
};

/**
 * Core trust gate that checks AEGIS skill attestations before tool execution.
 *
 * Queries the subgraph first, falls back to on-chain SDK if the subgraph is
 * unavailable. Caches results to avoid repeated queries within the TTL window.
 *
 * @example
 * ```ts
 * const gate = new TrustGate({
 *   policy: { minAuditLevel: 2, mode: 'enforce' },
 *   skills: [
 *     { toolName: 'web_search', skillHash: '0xabc...' },
 *   ],
 * });
 *
 * const result = await gate.check('web_search');
 * if (!result.allowed) {
 *   console.error(result.reason);
 * }
 * ```
 */
export class TrustGate {
  private policy: Required<TrustPolicy>;
  private readonly skillMap: Map<string, Hex>;
  private readonly primary: TrustResolver;
  private readonly fallback: TrustResolver;
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly cacheTtlMs: number;
  private readonly onBlock?: (result: TrustGateResult) => void;
  private readonly onWarn?: (result: TrustGateResult) => void;

  constructor(config: TrustGateConfig) {
    this.policy = { ...DEFAULT_POLICY, ...config.policy };
    this.skillMap = new Map(config.skills.map((s) => [s.toolName, s.skillHash]));
    this.primary = new SubgraphResolver(config.subgraphUrl);
    this.fallback = new OnchainResolver(config.sdkConfig);
    this.cacheTtlMs = config.cacheTtlMs ?? 60_000;
    this.onBlock = config.onBlock;
    this.onWarn = config.onWarn;
  }

  /**
   * Check trust for a tool by name. Returns immediately with `allowed: true`
   * if the tool name has no skill mapping (unmapped tools are always allowed).
   */
  async check(toolName: string): Promise<TrustGateResult> {
    const skillHash = this.skillMap.get(toolName);
    if (!skillHash) {
      return { toolName, skillHash: '0x' as Hex, allowed: true };
    }
    return this.evaluate(toolName, skillHash);
  }

  /** Check trust directly by skill hash. */
  async checkHash(skillHash: Hex): Promise<TrustGateResult> {
    return this.evaluate(skillHash, skillHash);
  }

  /** Update the policy at runtime. */
  updatePolicy(policy: Partial<TrustPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  /** Clear the trust data cache. */
  clearCache(): void {
    this.cache.clear();
  }

  private async evaluate(toolName: string, skillHash: Hex): Promise<TrustGateResult> {
    const trustData = await this.resolve(skillHash);

    if (!trustData) {
      return this.applyPolicy({
        toolName,
        skillHash,
        allowed: false,
        reason: 'Skill not found in AEGIS registry',
      });
    }

    // Check active disputes first
    if (this.policy.blockOnDispute && trustData.hasActiveDisputes) {
      return this.applyPolicy({
        toolName,
        skillHash,
        allowed: false,
        reason: 'Skill has unresolved disputes',
        trustData,
      });
    }

    // Check attestation count
    if (trustData.attestationCount < this.policy.minAttestations) {
      return this.applyPolicy({
        toolName,
        skillHash,
        allowed: false,
        reason: `Attestation count ${trustData.attestationCount} < required ${this.policy.minAttestations}`,
        trustData,
      });
    }

    // Check audit level
    if (trustData.highestLevel < this.policy.minAuditLevel) {
      return this.applyPolicy({
        toolName,
        skillHash,
        allowed: false,
        reason: `Audit level ${trustData.highestLevel} < required ${this.policy.minAuditLevel}`,
        trustData,
      });
    }

    return { toolName, skillHash, allowed: true, trustData };
  }

  private applyPolicy(result: TrustGateResult): TrustGateResult {
    switch (this.policy.mode) {
      case 'enforce':
        this.onBlock?.(result);
        return result;

      case 'warn':
        this.onWarn?.(result);
        return { ...result, allowed: true };

      case 'log':
        return { ...result, allowed: true };
    }
  }

  private async resolve(skillHash: Hex): Promise<ResolvedTrustData | null> {
    const cached = this.cache.get(skillHash);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    let data: ResolvedTrustData | null = null;

    try {
      data = await this.primary.resolve(skillHash);
    } catch {
      // Subgraph unavailable, fall through to on-chain
    }

    if (!data) {
      try {
        data = await this.fallback.resolve(skillHash);
      } catch {
        // Both resolvers failed
      }
    }

    this.cache.set(skillHash, {
      data,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return data;
  }
}
