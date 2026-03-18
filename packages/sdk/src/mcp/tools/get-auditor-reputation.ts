import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerGetAuditorReputation(server: McpServer): void {
  server.tool(
    'get-auditor-reputation',
    "Get an auditor's on-chain reputation data including score, total stake (in wei), and attestation count.",
    {
      auditorCommitment: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe("The auditor's bytes32 Pedersen commitment hash"),
    },
    async ({ auditorCommitment }) => {
      return handleToolCall(async () => {
        const client = getClient();
        const reputation = await client.getAuditorReputation(
          auditorCommitment as `0x${string}`,
        );
        return {
          content: [{ type: 'text' as const, text: serializeResult(reputation) }],
        };
      });
    },
  );
}
