import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerGetErc8004Validation(server: McpServer): void {
  server.tool(
    'get-erc8004-validation',
    'Get the ERC-8004 validation summary for an agent. Returns the count of AEGIS validations and the average score (0-100). Filters by the "aegis-audit" tag to show only AEGIS-provided validations.',
    {
      agentId: z
        .string()
        .describe('The ERC-8004 agent ID (uint256 as string)'),
    },
    async ({ agentId }) => {
      return handleToolCall(async () => {
        const client = getClient();

        const validation = await client.getErc8004ValidationSummary(
          BigInt(agentId),
        );
        const reputation = await client.getErc8004ReputationSummary(
          BigInt(agentId),
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                agentId,
                validation: {
                  count: validation.count.toString(),
                  averageScore: validation.averageResponse,
                  tag: 'aegis-audit',
                },
                reputation: {
                  count: reputation.count.toString(),
                  summaryValue: reputation.summaryValue.toString(),
                  summaryValueDecimals: reputation.summaryValueDecimals,
                },
                scoreMapping: {
                  '33': 'L1 Functional',
                  '66': 'L2 Robust',
                  '100': 'L3 Security',
                },
              }),
            },
          ],
        };
      });
    },
  );
}
