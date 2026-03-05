import type { Hex } from '@aegisaudit/sdk';
import type { TrustResolver, ResolvedTrustData } from '../types.js';

const DEFAULT_SUBGRAPH_URL =
  'https://api.studio.thegraph.com/query/1743315/aegis-protocol/v0.1.0';

const SKILL_TRUST_QUERY = `
query SkillTrust($id: Bytes!) {
  skill(id: $id) {
    attestationCount
    attestations(where: { revoked: false }) {
      auditLevel
    }
    disputes(where: { resolved: false }) {
      id
    }
  }
}`;

interface SubgraphSkillResponse {
  data?: {
    skill?: {
      attestationCount: number;
      attestations: Array<{ auditLevel: number }>;
      disputes: Array<{ id: string }>;
    };
  };
  errors?: Array<{ message: string }>;
}

export class SubgraphResolver implements TrustResolver {
  private readonly url: string;

  constructor(url?: string) {
    this.url = url ?? DEFAULT_SUBGRAPH_URL;
  }

  async resolve(skillHash: Hex): Promise<ResolvedTrustData | null> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: SKILL_TRUST_QUERY,
        variables: { id: skillHash },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return null;

    const json = (await res.json()) as SubgraphSkillResponse;
    const skill = json.data?.skill;
    if (!skill) return null;

    const nonRevoked = skill.attestations;
    const highestLevel = nonRevoked.reduce(
      (max, a) => Math.max(max, a.auditLevel),
      0,
    );

    return {
      highestLevel,
      attestationCount: nonRevoked.length,
      hasActiveDisputes: skill.disputes.length > 0,
    };
  }
}
