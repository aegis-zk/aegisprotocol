import { AegisClient } from '@aegisaudit/sdk';
import type { AegisConfig, Hex } from '@aegisaudit/sdk';
import type { TrustResolver, ResolvedTrustData } from '../types.js';

const DEFAULT_CONFIG: AegisConfig = { chainId: 8453 };

export class OnchainResolver implements TrustResolver {
  private readonly client: AegisClient;

  constructor(config?: AegisConfig) {
    this.client = new AegisClient(config ?? DEFAULT_CONFIG);
  }

  async resolve(skillHash: Hex): Promise<ResolvedTrustData | null> {
    try {
      const score = await this.client.getSkillTrustScore(skillHash);
      return {
        highestLevel: score.highestLevel,
        attestationCount: score.attestations.length,
        hasActiveDisputes: score.hasActiveDisputes,
      };
    } catch {
      return null;
    }
  }
}
