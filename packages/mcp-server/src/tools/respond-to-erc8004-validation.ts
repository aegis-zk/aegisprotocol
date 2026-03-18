import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient, hasWallet, getWalletAddress } from '../lib/client.js';
import { handleToolCall, serializeResult } from '../lib/serialization.js';
import { getWalletSetupGuide } from '../lib/wallet-guide.js';
import { AUDIT_LEVEL_SCORES } from '@aegisaudit/sdk';

export function registerRespondToErc8004Validation(server: McpServer): void {
  server.tool(
    'respond-to-erc8004-validation',
    'Respond to an ERC-8004 validation request (Step 2 of 2). Called by the AEGIS VALIDATOR to submit the validation response with the mapped score (L1→33, L2→66, L3→100). Must be called from the validator wallet (NOT the agent owner). The requestHash from Step 1 is required. Optionally also submits reputation feedback. Requires AEGIS_PRIVATE_KEY (validator wallet).',
    {
      requestHash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The request hash returned from request-erc8004-validation (Step 1)'),
      agentId: z
        .string()
        .describe('The ERC-8004 agent ID (uint256 as string)'),
      skillHash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The bytes32 AEGIS skill hash'),
      auditLevel: z
        .number()
        .int()
        .min(1)
        .max(3)
        .describe('AEGIS audit level (1=Functional→33, 2=Robust→66, 3=Security→100)'),
      metadataURI: z
        .string()
        .describe('URI to the audit metadata (e.g. IPFS CID)'),
      includeReputation: z
        .boolean()
        .optional()
        .describe('Also submit reputation feedback to ERC-8004 ReputationRegistry (default: true)'),
    },
    (params) =>
      handleToolCall(async () => {
        if (!hasWallet()) {
          const chainId = Number(process.env.AEGIS_CHAIN_ID ?? '8453');
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  error: 'No wallet configured. This operation requires the AEGIS validator wallet.',
                  action: 'Guide the user through connecting a wallet using the setup instructions below. They need to add AEGIS_PRIVATE_KEY (validator private key) to their MCP config and restart this client.',
                  walletSetupGuide: getWalletSetupGuide(chainId),
                }, null, 2),
              },
            ],
          };
        }

        const client = getClient();
        const result = await client.respondToErc8004Validation({
          requestHash: params.requestHash as `0x${string}`,
          agentId: BigInt(params.agentId),
          skillHash: params.skillHash as `0x${string}`,
          auditLevel: params.auditLevel as 1 | 2 | 3,
          metadataURI: params.metadataURI,
          includeReputation: params.includeReputation,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                success: true,
                step: '2 of 2 — Validation response submitted',
                responseTxHash: result.responseTxHash,
                reputationTxHash: result.reputationTxHash ?? null,
                requestHash: params.requestHash,
                agentId: params.agentId,
                skillHash: params.skillHash,
                auditLevel: params.auditLevel,
                erc8004Score: AUDIT_LEVEL_SCORES[params.auditLevel],
                validatorAddress: getWalletAddress(),
                note: 'AEGIS attestation bridged to ERC-8004 successfully. The validation is now discoverable by any ERC-8004 consumer using the "aegis-audit" tag.',
              }),
            },
          ],
        };
      }),
  );
}
