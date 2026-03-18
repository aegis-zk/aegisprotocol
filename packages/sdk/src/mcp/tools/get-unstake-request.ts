import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerGetUnstakeRequest(server: McpServer): void {
  server.tool(
    'get-unstake-request',
    "Get a pending unstake request for an auditor. Returns the amount and unlock timestamp. If amount is 0, there is no pending request.",
    {
      auditorCommitment: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe("The auditor's bytes32 Pedersen commitment hash"),
    },
    async ({ auditorCommitment }) => {
      return handleToolCall(async () => {
        const client = getClient();
        const request = await client.getUnstakeRequest(
          auditorCommitment as `0x${string}`,
        );
        return {
          content: [{ type: 'text' as const, text: serializeResult(request) }],
        };
      });
    },
  );
}
