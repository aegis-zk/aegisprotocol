import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerQueryTrustProfile(server: McpServer): void {
  server.tool(
    'query-trust-profile',
    'Get an aggregated trust profile for an AI agent. Combines AEGIS Registry attestations with ERC-8004 validation and reputation data. Degrades gracefully on mainnet where ValidationRegistry is not yet deployed — returns AEGIS-only attestation data with a note about missing validation scores.',
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

        try {
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
        } catch (err) {
          const message = (err as Error).message ?? '';

          // Graceful degradation when ValidationRegistry is not deployed
          if (message.includes('ValidationRegistry') || message.includes('not yet deployed')) {
            const skillHashes = knownSkillHashes ?? [];
            const skillScores = [];

            for (const hash of skillHashes) {
              try {
                const score = await client.getSkillTrustScore(hash as `0x${string}`);
                skillScores.push(score);
              } catch {
                // Skip skills that fail to resolve
              }
            }

            const highestLevel = skillScores.reduce(
              (max, s) => Math.max(max, (s as any).highestAuditLevel ?? 0),
              0,
            );
            const hasDisputes = skillScores.some((s) => (s as any).hasActiveDisputes);
            const baseScore = highestLevel === 3 ? 80 : highestLevel === 2 ? 50 : highestLevel === 1 ? 25 : 0;
            const trustScore = hasDisputes ? Math.max(baseScore - 20, 0) : baseScore;
            const trustLevel = trustScore >= 80 ? 'trusted' : trustScore >= 50 ? 'verified' : trustScore >= 20 ? 'basic' : 'unknown';

            return {
              content: [
                {
                  type: 'text' as const,
                  text: serializeResult({
                    agentId,
                    trustScore,
                    trustLevel,
                    identity: null,
                    skillCount: skillScores.length,
                    highestAuditLevel: highestLevel,
                    hasActiveDisputes: hasDisputes,
                    skills: skillScores,
                    validation: null,
                    reputation: null,
                    partial: true,
                    partialReason: 'ValidationRegistry is not deployed on this chain. Trust profile is based on AEGIS attestation data only — ERC-8004 validation and reputation scores are unavailable.',
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
          }

          throw err;
        }
      });
    },
  );
}
