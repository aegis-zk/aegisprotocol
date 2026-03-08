import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { serializeResult, handleToolCall } from '../lib/serialization.js';
import { querySubgraph } from '../lib/subgraph.js';

const CHECK_SKILL_QUERY = `
  query CheckSkill($id: Bytes!) {
    skill(id: $id) {
      id
      skillName
      category
      metadataURI
      publisher
      listed
      attestationCount
      timestamp
      attestations(where: { revoked: false }, orderBy: timestamp, orderDirection: desc) {
        id
        attestationIndex
        auditLevel
        timestamp
        txHash
        auditor {
          id
          currentStake
          reputationScore
          attestationCount
          disputesInvolved
          disputesLost
        }
      }
      disputes(where: { resolved: false }) {
        id
        disputeId
        attestationIndex
        challenger
        bond
        openedAt
      }
      bounty {
        id
        amount
        requiredLevel
        expiresAt
        claimed
        reclaimed
      }
    }
  }
`;

interface CheckSkillResult {
  skill: {
    id: string;
    skillName: string;
    category: string;
    metadataURI: string;
    publisher: string;
    listed: boolean;
    attestationCount: number;
    timestamp: string;
    attestations: Array<{
      id: string;
      attestationIndex: number;
      auditLevel: number;
      timestamp: string;
      txHash: string;
      auditor: {
        id: string;
        currentStake: string;
        reputationScore: string;
        attestationCount: number;
        disputesInvolved: number;
        disputesLost: number;
      };
    }>;
    disputes: Array<{
      id: string;
      disputeId: string;
      attestationIndex: number;
      challenger: string;
      bond: string;
      openedAt: string;
    }>;
    bounty: Array<{
      id: string;
      amount: string;
      requiredLevel: number;
      expiresAt: string;
      claimed: boolean;
      reclaimed: boolean;
    }>;
  } | null;
}

export function registerCheckSkill(server: McpServer): void {
  server.tool(
    'aegis_check_skill',
    'Look up a skill by its bytes32 hash. Returns skill metadata, all non-revoked attestations with auditor reputation data, open disputes, and active bounty information. Use this to get a comprehensive view of a skill before auditing or interacting with it.',
    {
      skillId: z
        .string()
        .describe('The bytes32 skill hash (0x-prefixed, 66 chars)'),
    },
    async ({ skillId }) => {
      return handleToolCall(async () => {
        const data = await querySubgraph<CheckSkillResult>(CHECK_SKILL_QUERY, {
          id: skillId,
        });

        if (!data.skill) {
          return {
            content: [
              {
                type: 'text' as const,
                text: serializeResult({
                  skill: null,
                  hint: `Skill ${skillId} not found in the subgraph. It may not have been listed yet, or the hash may be incorrect.`,
                }),
              },
            ],
          };
        }

        // Find active (unclaimed, unreclaimed) bounty
        const activeBounty = data.skill.bounty.find(
          (b) => !b.claimed && !b.reclaimed,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                skill: {
                  ...data.skill,
                  bounty: undefined,
                  activeBounty: activeBounty ?? null,
                },
                summary: {
                  attestations: data.skill.attestations.length,
                  openDisputes: data.skill.disputes.length,
                  hasBounty: !!activeBounty,
                },
              }),
            },
          ],
        };
      });
    },
  );
}
