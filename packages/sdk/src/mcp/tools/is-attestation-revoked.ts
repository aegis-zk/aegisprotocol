import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerIsAttestationRevoked(server: McpServer): void {
  server.tool(
    'is-attestation-revoked',
    'Check if a specific attestation has been revoked. First verifies the attestation exists — returns an explicit error if not (the raw contract silently returns false for non-existent attestations, which can mislead consumers).',
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

        // Check existence first to avoid the misleading "revoked: false" for non-existent attestations
        const attestations = await client.getAttestations(
          skillHash as `0x${string}`,
        );

        if (attestations.length === 0) {
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: serializeResult({
                error: 'AttestationNotFound',
                skillHash,
                attestationIndex,
                message: `No attestations exist for skill ${skillHash}. The skill may be listed but not yet audited.`,
              }),
            }],
          };
        }

        if (attestationIndex >= attestations.length) {
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: serializeResult({
                error: 'AttestationIndexOutOfBounds',
                skillHash,
                attestationIndex,
                totalAttestations: attestations.length,
                message: `Index ${attestationIndex} out of range. This skill has ${attestations.length} attestation(s) (indices 0-${attestations.length - 1}).`,
              }),
            }],
          };
        }

        const revoked = await client.isAttestationRevoked(
          skillHash as `0x${string}`,
          attestationIndex,
        );

        return {
          content: [{
            type: 'text' as const,
            text: serializeResult({ skillHash, attestationIndex, exists: true, revoked }),
          }],
        };
      });
    },
  );
}
