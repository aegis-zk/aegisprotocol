import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { queryMetagraph, computeTaoMinerHash } from '../../tao.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';
import { querySubgraph } from '../lib/subgraph.js';

const SKILL_EXISTS_QUERY = `
  query CheckSkills($ids: [String!]!) {
    skills(where: { id_in: $ids }) {
      id
      attestationCount
    }
  }
`;

interface SkillExistsResult {
  skills: Array<{ id: string; attestationCount: number }>;
}

export function registerTaoBrowseMiners(server: McpServer): void {
  server.tool(
    'aegis_tao_browse_miners',
    'Browse miners on a Bittensor subnet. For each miner, computes the AEGIS skill hash and checks if attestations exist — helping auditors find unaudited TAO miners.',
    {
      netuid: z
        .number()
        .int()
        .min(0)
        .describe('Bittensor subnet ID to browse'),
      first: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(20)
        .describe('Number of miners to return (default 20)'),
      sortBy: z
        .enum(['stake', 'trust', 'incentive'])
        .optional()
        .default('stake')
        .describe('Sort miners by this field (default: stake)'),
    },
    async ({ netuid, first, sortBy }) => {
      return handleToolCall(async () => {
        const mg = await queryMetagraph(netuid);
        const miners = mg.nodes.filter((n) => !n.isValidator);

        // Sort
        const sorted = [...miners].sort((a, b) => {
          if (sortBy === 'stake') return Number(b.stake - a.stake);
          if (sortBy === 'trust') return b.trust - a.trust;
          return b.incentive - a.incentive;
        });

        const page = sorted.slice(0, first);

        // Compute skill hashes
        const minerHashes = page.map((m) => ({
          ...m,
          skillHash: computeTaoMinerHash(netuid, m.hotkey),
          stake: m.stake.toString(),
          emission: m.emission.toString(),
        }));

        // Batch-check AEGIS subgraph for existing attestations
        const hashIds = minerHashes.map((m) => m.skillHash.toLowerCase());
        let auditedMap: Record<string, number> = {};

        try {
          const subgraphData = await querySubgraph<SkillExistsResult>(
            SKILL_EXISTS_QUERY,
            { ids: hashIds },
          );
          auditedMap = Object.fromEntries(
            subgraphData.skills.map((s) => [s.id, s.attestationCount]),
          );
        } catch {
          // Subgraph unavailable — still return miners without attestation data
        }

        const results = minerHashes.map((m) => ({
          hotkey: m.hotkey,
          uid: m.uid,
          stake: m.stake,
          trust: m.trust,
          consensus: m.consensus,
          incentive: m.incentive,
          axon: m.axonIp ? `${m.axonIp}:${m.axonPort}` : null,
          aegisSkillHash: m.skillHash,
          attestationCount: auditedMap[m.skillHash.toLowerCase()] ?? 0,
          audited: (auditedMap[m.skillHash.toLowerCase()] ?? 0) > 0,
        }));

        const unauditedCount = results.filter((r) => !r.audited).length;

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                subnet: { netuid, name: mg.subnetName },
                miners: results,
                pagination: { returned: results.length, totalMiners: miners.length },
                unauditedCount,
                hint: unauditedCount > 0
                  ? `${unauditedCount} unaudited miners found. Use aegis_audit_skill with the aegisSkillHash to submit an attestation.`
                  : 'All returned miners have existing attestations.',
              }),
            },
          ],
        };
      });
    },
  );
}
