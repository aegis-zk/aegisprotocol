import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerGetActiveDisputeCount(server: McpServer): void {
  server.tool(
    'get-active-dispute-count',
    "Get the number of active (unresolved) disputes for an auditor. If > 0, the auditor cannot unstake until all disputes are resolved.",
    {
      auditorCommitment: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe("The auditor's bytes32 Pedersen commitment hash"),
    },
    async ({ auditorCommitment }) => {
      return handleToolCall(async () => {
        const client = getClient();
        const count = await client.getActiveDisputeCount(
          auditorCommitment as `0x${string}`,
        );
        return {
          content: [{ type: 'text' as const, text: serializeResult({ auditorCommitment, activeDisputeCount: count.toString() }) }],
        };
      });
    },
  );
}
