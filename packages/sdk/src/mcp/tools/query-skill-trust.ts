import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerQuerySkillTrust(server: McpServer): void {
  server.tool(
    'query-skill-trust',
    'Get trust data for a single AEGIS skill. Returns all attestation details (auditor commitments, audit levels, timestamps), dispute count and active dispute status, metadata URI, and the highest audit level achieved. This is a direct on-chain query (no x402 payment needed).',
    {
      skillHash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe(
          'The bytes32 skill hash to query (e.g., 0x1234...abcd)',
        ),
    },
    async ({ skillHash }) => {
      return handleToolCall(async () => {
        const client = getClient();

        const score = await client.getSkillTrustScore(
          skillHash as `0x${string}`,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                skillHash,
                metadataURI: score.metadataURI,
                highestLevel: score.highestLevel,
                attestationCount: score.attestations.length,
                attestations: score.attestations,
                disputeCount: score.disputeCount,
                hasActiveDisputes: score.hasActiveDisputes,
                auditLevelGuide: {
                  '1': 'L1 Functional (4 criteria)',
                  '2': 'L2 Robust (9 criteria)',
                  '3': 'L3 Security (14 criteria)',
                },
              }),
            },
          ],
        };
      });
    },
  );
}
