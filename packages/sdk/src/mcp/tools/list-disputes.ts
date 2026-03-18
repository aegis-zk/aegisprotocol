import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerListDisputes(server: McpServer): void {
  server.tool(
    'list-disputes',
    'List all opened disputes on the AEGIS Protocol. Optionally filter by skill hash and/or block range.',
    {
      skillHash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .optional()
        .describe('Optional bytes32 skill hash to filter disputes for a specific skill'),
      fromBlock: z
        .string()
        .optional()
        .describe('Start block number as string (defaults to contract deployment block)'),
      toBlock: z
        .string()
        .optional()
        .describe('End block number as string (defaults to latest block)'),
    },
    async ({ skillHash, fromBlock, toBlock }) => {
      return handleToolCall(async () => {
        const client = getClient();
        const disputes = await client.listDisputes({
          skillHash: skillHash as `0x${string}` | undefined,
          fromBlock: fromBlock ? BigInt(fromBlock) : undefined,
          toBlock: toBlock ? BigInt(toBlock) : undefined,
        });
        return {
          content: [{ type: 'text' as const, text: serializeResult(disputes) }],
        };
      });
    },
  );
}
