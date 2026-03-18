import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { serializeResult, handleToolCall } from '../lib/serialization.js';
import { querySubgraph } from '../lib/subgraph.js';

const BROWSE_UNAUDITED_QUERY = `
  query BrowseUnaudited($first: Int!, $skip: Int!) {
    skills(
      where: { attestationCount: 0, listed: true }
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
      unauditedSkills
    }
  }
`;

interface BrowseUnauditedResult {
  skills: Array<{
    id: string;
    skillName: string;
    category: string;
    metadataURI: string;
    publisher: string;
    timestamp: string;
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
    unauditedSkills: number;
  } | null;
}

export function registerBrowseUnaudited(server: McpServer): void {
  server.tool(
    'aegis_browse_unaudited',
    'Browse skills that have zero attestations — prime candidates for auditing. Returns newest-first with bounty info if available. Use this to find skills that need auditing.',
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
        const data = await querySubgraph<BrowseUnauditedResult>(
          BROWSE_UNAUDITED_QUERY,
          { first, skip },
        );

        // Attach active bounty info to each skill
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
                  totalUnaudited: data.protocolStats?.unauditedSkills ?? null,
                },
              }),
            },
          ],
        };
      });
    },
  );
}
