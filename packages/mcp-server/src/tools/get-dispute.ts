import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerGetDispute(server: McpServer): void {
  server.tool(
    'get-dispute',
    'Get full dispute details by ID from the AEGIS Registry. Returns skill hash, attestation index, evidence, challenger address, bond amount, resolution status, and whether the auditor was found at fault.',
    {
      disputeId: z
        .number()
        .int()
        .min(0)
        .describe('The dispute ID (zero-indexed)'),
    },
    async ({ disputeId }) => {
      return handleToolCall(async () => {
        const client = getClient();
        const dispute = await client.getDispute(BigInt(disputeId));
        return {
          content: [{ type: 'text' as const, text: serializeResult(dispute) }],
        };
      });
    },
  );
}
