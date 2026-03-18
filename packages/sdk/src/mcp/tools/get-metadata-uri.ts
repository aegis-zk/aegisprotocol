import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { handleToolCall } from '../lib/serialization.js';

export function registerGetMetadataURI(server: McpServer): void {
  server.tool(
    'get-metadata-uri',
    "Get the metadata URI for a registered skill. Returns the IPFS or HTTP link to the skill's metadata JSON (name, description, category).",
    {
      skillHash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The bytes32 skill hash'),
    },
    async ({ skillHash }) => {
      return handleToolCall(async () => {
        const client = getClient();
        const uri = await client.getMetadataURI(skillHash as `0x${string}`);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ metadataURI: uri }) }],
        };
      });
    },
  );
}
