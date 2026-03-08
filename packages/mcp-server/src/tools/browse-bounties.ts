import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { serializeResult, handleToolCall } from '../lib/serialization.js';
import { querySubgraph } from '../lib/subgraph.js';

const BROWSE_BOUNTIES_QUERY = `
  query BrowseBounties($first: Int!, $skip: Int!, $where: Bounty_filter) {
    bounties(
      where: $where
      orderBy: amount
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      amount
      requiredLevel
      expiresAt
      timestamp
      txHash
      skill {
        id
        skillName
        category
        publisher
        attestationCount
      }
    }
    protocolStats(id: "singleton") {
      openBounties
    }
  }
`;

interface BrowseBountiesResult {
  bounties: Array<{
    id: string;
    amount: string;
    requiredLevel: number;
    expiresAt: string;
    timestamp: string;
    txHash: string;
    skill: {
      id: string;
      skillName: string;
      category: string;
      publisher: string;
      attestationCount: number;
    };
  }>;
  protocolStats: {
    openBounties: number;
  } | null;
}

export function registerBrowseBounties(server: McpServer): void {
  server.tool(
    'aegis_browse_bounties',
    'Browse open (unclaimed, unreclaimed) bounties sorted by reward amount descending. Great for finding paid audit opportunities. Each bounty is linked to a skill that needs auditing.',
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
      minLevel: z
        .number()
        .int()
        .min(1)
        .max(3)
        .optional()
        .describe('Filter by minimum required audit level (1=basic, 2=standard, 3=comprehensive)'),
    },
    async ({ first, skip, minLevel }) => {
      return handleToolCall(async () => {
        // Build the where filter
        const where: Record<string, unknown> = {
          claimed: false,
          reclaimed: false,
        };
        if (minLevel !== undefined) {
          where.requiredLevel_gte = minLevel;
        }

        const data = await querySubgraph<BrowseBountiesResult>(
          BROWSE_BOUNTIES_QUERY,
          { first, skip, where },
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                bounties: data.bounties,
                pagination: {
                  returned: data.bounties.length,
                  offset: skip,
                  totalOpen: data.protocolStats?.openBounties ?? null,
                },
              }),
            },
          ],
        };
      });
    },
  );
}
