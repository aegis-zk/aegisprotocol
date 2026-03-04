import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';

export function registerCreateAgentRegistration(server: McpServer): void {
  server.tool(
    'create-agent-registration',
    'Generate an ERC-8004 agent registration JSON document. This creates the metadata file that should be hosted at the agentURI (e.g. on IPFS) before calling register-agent. Includes agent name, description, services, and AEGIS skill references.',
    {
      name: z
        .string()
        .describe('Display name of the AI agent'),
      description: z
        .string()
        .describe('Description of what the agent does'),
      skills: z
        .array(
          z.object({
            skillHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
            auditLevel: z.number().int().min(1).max(3).optional(),
            metadataURI: z.string().optional(),
          }),
        )
        .optional()
        .describe('AEGIS skills to include in the registration'),
      services: z
        .array(
          z.object({
            type: z.string(),
            endpoint: z.string(),
            description: z.string().optional(),
          }),
        )
        .optional()
        .describe('Service endpoints the agent exposes'),
      paymentAddress: z
        .string()
        .optional()
        .describe('x402 payment address for pay-per-use (optional)'),
    },
    async (params) => {
      return handleToolCall(async () => {
        const client = getClient();

        const registration = client.createAgentRegistration({
          name: params.name,
          description: params.description,
          skills: params.skills?.map((s) => ({
            skillHash: s.skillHash as `0x${string}`,
            auditLevel: s.auditLevel,
            metadataURI: s.metadataURI,
          })),
          services: params.services,
          ...(params.paymentAddress
            ? {
                x402Support: {
                  paymentAddress: params.paymentAddress as `0x${string}`,
                  acceptedTokens: [],
                },
              }
            : {}),
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                registrationJson: registration,
                note: 'Agent registration JSON generated. Host this file at a public URI (IPFS recommended) and pass that URI to register-agent to mint the ERC-8004 identity NFT.',
              }),
            },
          ],
        };
      });
    },
  );
}
