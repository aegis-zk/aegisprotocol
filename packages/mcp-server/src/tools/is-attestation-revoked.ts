import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerIsAttestationRevoked(server: McpServer): void {
  server.tool(
    'is-attestation-revoked',
    'Check if a specific attestation has been revoked by the protocol admin. Revoked attestations should not be trusted.',
    {
      skillHash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The bytes32 skill hash'),
      attestationIndex: z
        .number()
        .int()
        .min(0)
        .describe('Zero-based index of the attestation'),
    },
    async ({ skillHash, attestationIndex }) => {
      return handleToolCall(async () => {
        const client = getClient();
        const revoked = await client.isAttestationRevoked(
          skillHash as `0x${string}`,
          attestationIndex,
        );
        return {
          content: [{ type: 'text' as const, text: serializeResult({ skillHash, attestationIndex, revoked }) }],
        };
      });
    },
  );
}
