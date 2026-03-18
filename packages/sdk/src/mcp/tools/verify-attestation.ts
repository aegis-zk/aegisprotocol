import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { handleToolCall, serializeResult } from '../lib/serialization.js';

export function registerVerifyAttestation(server: McpServer): void {
  server.tool(
    'verify-attestation',
    "Verify an attestation's ZK proof on-chain via the UltraHonk verifier. Returns true if the proof is valid. Checks attestation existence first to provide clear errors instead of opaque reverts.",
    {
      skillHash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The bytes32 skill hash'),
      attestationIndex: z
        .number()
        .int()
        .min(0)
        .describe('Zero-based index of the attestation to verify'),
    },
    async ({ skillHash, attestationIndex }) => {
      return handleToolCall(async () => {
        const client = getClient();

        // Check attestation exists before verifying
        const attestations = await client.getAttestations(skillHash as `0x${string}`);
        if (attestations.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: serializeResult({
                  error: 'AttestationNotFound',
                  skillHash,
                  attestationIndex,
                  message: `No attestations exist for skill ${skillHash}. The skill may not have been audited yet.`,
                }),
              },
            ],
          };
        }

        if (attestationIndex >= attestations.length) {
          return {
            content: [
              {
                type: 'text' as const,
                text: serializeResult({
                  error: 'AttestationIndexOutOfBounds',
                  skillHash,
                  attestationIndex,
                  totalAttestations: attestations.length,
                  message: `Attestation index ${attestationIndex} is out of bounds. This skill has ${attestations.length} attestation(s) (valid indices: 0-${attestations.length - 1}).`,
                }),
              },
            ],
          };
        }

        const isValid = await client.verify(skillHash as `0x${string}`, attestationIndex);
        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                valid: isValid,
                skillHash,
                attestationIndex,
                attestation: {
                  auditLevel: Number(attestations[attestationIndex].auditLevel),
                  auditorCommitment: attestations[attestationIndex].auditorCommitment,
                  timestamp: Number(attestations[attestationIndex].timestamp),
                },
              }),
            },
          ],
        };
      });
    },
  );
}
