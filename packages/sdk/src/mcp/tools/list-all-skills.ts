import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { serializeResult, handleToolCall } from '../lib/serialization.js';
import { querySubgraph } from '../lib/subgraph.js';

const LIST_ALL_SKILLS_QUERY = `
  query ListAllSkills($first: Int!, $skip: Int!) {
    skills(
      where: { listed: true }
      orderBy: timestamp
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      skillName
      category
      metadataURI
      publisher
      timestamp
      attestationCount
      attestations {
        id
        auditLevel
        timestamp
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
    protocolStats(id: "singleton") {
      totalSkills
      totalAttestations
      unauditedSkills
    }
  }
`;

interface ListAllSkillsResult {
  skills: Array<{
    id: string;
    skillName: string;
    category: string;
    metadataURI: string;
    publisher: string;
    timestamp: string;
    attestationCount: number;
    attestations: Array<{
      id: string;
      auditLevel: number;
      timestamp: string;
    }>;
    bounty: Array<{
      id: string;
      amount: string;
      requiredLevel: number;
      expiresAt: string;
      claimed: boolean;
      reclaimed: boolean;
    }>;
  }>;
  protocolStats: {
    totalSkills: number;
    totalAttestations: number;
    unauditedSkills: number;
  } | null;
}

export function registerListAllSkills(server: McpServer): void {
  server.tool(
    'list-all-skills',
    'List all skills on the AEGIS Protocol — both listed (unaudited) and audited. Returns newest-first with attestation count, audit levels, and bounty info. Uses the subgraph for efficient querying.',
    {
      first: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(20)
        .describe('Number of results to return (max 100, default 20)'),
      skip: z
        .number()
        .int()
        .min(0)
        .optional()
        .default(0)
        .describe('Offset for pagination (default 0)'),
    },
    async ({ first, skip }) => {
      return handleToolCall(async () => {
        const data = await querySubgraph<ListAllSkillsResult>(
          LIST_ALL_SKILLS_QUERY,
          { first, skip },
        );

        const skills = data.skills.map((skill) => {
          const activeBounty = skill.bounty.find(
            (b) => !b.claimed && !b.reclaimed,
          );
          return {
            id: skill.id,
            skillName: skill.skillName,
            category: skill.category,
            metadataURI: skill.metadataURI,
            publisher: skill.publisher,
            timestamp: skill.timestamp,
            attestationCount: skill.attestationCount,
            attestations: skill.attestations,
            activeBounty: activeBounty ?? null,
          };
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                skills,
                pagination: {
                  returned: skills.length,
                  offset: skip,
                  totalSkills: data.protocolStats?.totalSkills ?? null,
                  totalAttestations: data.protocolStats?.totalAttestations ?? null,
                  unauditedSkills: data.protocolStats?.unauditedSkills ?? null,
                },
              }),
            },
          ],
        };
      });
    },
  );
}
