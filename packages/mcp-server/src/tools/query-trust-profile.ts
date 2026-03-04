import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerQueryTrustProfile(server: McpServer): void {
  server.tool(
    'query-trust-profile',
    'Get an aggregated trust profile for an AI agent. Combines AEGIS Registry attestations with ERC-8004 validation and reputation data into a single trust assessment. Returns a composite trust score (0-100), trust level (unknown/basic/verified/trusted), per-skill breakdown with attestation details, and dispute status. This is a direct on-chain query (no x402 payment needed). Requires the agent to be registered in the ERC-8004 IdentityRegistry.',
    {
      agentId: z
        .string()
        .describe('The ERC-8004 agent ID (uint256 as string)'),
      knownSkillHashes: z
        .array(z.string().regex(/^0x[0-9a-fA-F]{64}$/))
        .optional()
        .describe(
          'Optional: known skill hashes linked to the agent. Skips the on-chain skill scan if provided, which is faster.',
        ),
    },
    async ({ agentId, knownSkillHashes }) => {
      return handleToolCall(async () => {
        const client = getClient();

        const profile = await client.getTrustProfile(
          BigInt(agentId),
          knownSkillHashes
            ? { knownSkillHashes: knownSkillHashes as `0x${string}`[] }
            : undefined,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                agentId,
                trustScore: profile.overall.trustScore,
                trustLevel: profile.overall.level,
                identity: profile.identity,
                skillCount: profile.overall.skillCount,
                highestAuditLevel: profile.overall.highestAuditLevel,
                hasActiveDisputes: profile.overall.hasActiveDisputes,
                skills: profile.skills,
                validation: profile.validation,
                reputation: profile.reputation,
                timestamp: profile.timestamp,
                trustLevelGuide: {
                  unknown: 'Score < 20 or no attestations',
                  basic: 'Score 20-49 (has L1 attestation)',
                  verified: 'Score 50-79 (L2+ attestation, no disputes)',
                  trusted: 'Score 80-100 (L3, good reputation, no disputes)',
                },
              }),
            },
          ],
        };
      });
    },
  );
}
