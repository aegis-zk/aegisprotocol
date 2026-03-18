import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerGetAuditorProfile(server: McpServer): void {
  server.tool(
    'get-auditor-profile',
    "Get a comprehensive auditor profile combining reputation (score, stake, attestation count), attestation history with revocation status, dispute record with outcomes, and active dispute count. This is the single call for full auditor due diligence.",
    {
      auditorCommitment: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe("The auditor's bytes32 Pedersen commitment hash"),
    },
    async ({ auditorCommitment }) => {
      return handleToolCall(async () => {
        const client = getClient();
        const profile = await client.getAuditorProfile(
          auditorCommitment as `0x${string}`,
        );
        return {
          content: [{ type: 'text' as const, text: serializeResult(profile) }],
        };
      });
    },
  );
}
