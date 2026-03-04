import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerGetBounty(server: McpServer): void {
  server.tool(
    'get-bounty',
    "Get bounty details for a skill. Returns publisher address, bounty amount, required audit level, expiration timestamp, and claimed status. If amount is 0, no bounty exists for this skill.",
    {
      skillHash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The bytes32 skill hash (keccak256 of the skill package)'),
    },
    async ({ skillHash }) => {
      return handleToolCall(async () => {
        const client = getClient();
        const bounty = await client.getBounty(
          skillHash as `0x${string}`,
        );
        return {
          content: [{ type: 'text' as const, text: serializeResult(bounty) }],
        };
      });
    },
  );
}
