import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getClient } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerGetDisputeCount(server: McpServer): void {
  server.tool(
    'get-dispute-count',
    'Get the total number of disputes ever created on the AEGIS Registry. Useful for pagination and enumeration.',
    {},
    async () => {
      return handleToolCall(async () => {
        const client = getClient();
        const count = await client.getDisputeCount();
        return {
          content: [{ type: 'text' as const, text: serializeResult({ totalDisputeCount: count.toString() }) }],
        };
      });
    },
  );
}
