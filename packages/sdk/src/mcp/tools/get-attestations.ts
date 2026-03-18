import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerGetAttestations(server: McpServer): void {
  server.tool(
    'get-attestations',
    'Get all ZK attestations for a registered skill. Returns attestation objects with ZK proof, auditor commitment, stake amount, timestamp, and audit level. Returns an empty array with a helpful message if no attestations exist.',
    {
      skillHash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The bytes32 skill hash (e.g., 0x1234...abcd)'),
    },
    async ({ skillHash }) => {
      return handleToolCall(async () => {
        const client = getClient();
        const attestations = await client.getAttestations(skillHash as `0x${string}`);

        if (attestations.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: serializeResult({
                  skillHash,
                  attestations: [],
                  count: 0,
                  message: `No attestations found for skill ${skillHash}. This skill has not been audited yet.`,
                }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                skillHash,
                attestations,
                count: attestations.length,
              }),
            },
          ],
        };
      });
    },
  );
}
