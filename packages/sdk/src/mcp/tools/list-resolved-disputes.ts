import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerListResolvedDisputes(server: McpServer): void {
  server.tool(
    'list-resolved-disputes',
    'List all resolved disputes on the AEGIS Protocol. Returns dispute IDs, whether the auditor was slashed, and block info.',
    {
      fromBlock: z
        .string()
        .optional()
        .describe('Start block number as string (defaults to contract deployment block)'),
      toBlock: z
        .string()
        .optional()
        .describe('End block number as string (defaults to latest block)'),
    },
    async ({ fromBlock, toBlock }) => {
      return handleToolCall(async () => {
        const client = getClient();
        const resolved = await client.listResolvedDisputes({
          fromBlock: fromBlock ? BigInt(fromBlock) : undefined,
          toBlock: toBlock ? BigInt(toBlock) : undefined,
        });
        return {
          content: [{ type: 'text' as const, text: serializeResult(resolved) }],
        };
      });
    },
  );
}
