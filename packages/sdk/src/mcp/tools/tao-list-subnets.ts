import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listSubnets, computeTaoSubnetHash } from '../../tao.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerTaoListSubnets(server: McpServer): void {
  server.tool(
    'aegis_tao_list_subnets',
    'List active Bittensor subnets with basic info. Returns netuid, name, miner count, and the computed AEGIS skill hash for each subnet. Use this to discover TAO subnets available for auditing.',
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(50)
        .describe('Max number of subnets to return (default 50)'),
    },
    async ({ limit }) => {
      return handleToolCall(async () => {
        const subnets = await listSubnets();

        const results = subnets.slice(0, limit).map((s) => ({
          netuid: s.netuid,
          name: s.name,
          minerCount: s.minerCount,
          validatorCount: s.validatorCount,
          aegisSkillHash: computeTaoSubnetHash(s.netuid),
        }));

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                subnets: results,
                total: results.length,
                hint: 'Use aegis_tao_browse_miners with a netuid to see individual miners, or aegis_tao_check_subnet to check existing AEGIS attestations.',
              }),
            },
          ],
        };
      });
    },
  );
}
