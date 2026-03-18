import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerListAllAuditors(server: McpServer): void {
  server.tool(
    'list-all-auditors',
    'List all registered auditors on the AEGIS Protocol by scanning on-chain AuditorRegistered events. Returns auditor commitment hashes, stake amounts, and block info.',
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
        const auditors = await client.listAllAuditors({
          fromBlock: fromBlock ? BigInt(fromBlock) : undefined,
          toBlock: toBlock ? BigInt(toBlock) : undefined,
        });
        return {
          content: [{ type: 'text' as const, text: serializeResult(auditors) }],
        };
      });
    },
  );
}
