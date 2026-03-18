import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient, hasWallet, getWalletAddress } from '../lib/client.js';
import { handleToolCall, serializeResult } from '../lib/serialization.js';
import { getWalletSetupGuide } from '../lib/wallet-guide.js';
import { AUDIT_LEVEL_SCORES } from '@aegisaudit/sdk';

export function registerRequestErc8004Validation(server: McpServer): void {
  server.tool(
    'request-erc8004-validation',
    'Request ERC-8004 validation for an AEGIS-audited agent (Step 1 of 2). Called by the AGENT OWNER to submit a validation request to the ERC-8004 ValidationRegistry, naming the AEGIS validator who will respond separately. This ensures proper two-party trust: the agent owner requests, the validator responds. Returns a requestHash needed for Step 2. Requires AEGIS_PRIVATE_KEY (agent owner wallet).',
    {
      agentId: z
        .string()
        .describe('The ERC-8004 agent ID (uint256 as string)'),
      skillHash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The bytes32 AEGIS skill hash to bridge'),
      auditLevel: z
        .number()
        .int()
        .min(1)
        .max(3)
        .describe('AEGIS audit level (1=Functional→33, 2=Robust→66, 3=Security→100)'),
      metadataURI: z
        .string()
        .describe('URI to the audit metadata (e.g. IPFS CID)'),
      validatorAddress: z
        .string()
        .regex(/^0x[0-9a-fA-F]{40}$/)
        .describe('Address of the AEGIS validator wallet that will respond to this request'),
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
                  error: 'No wallet configured. This operation requires the agent owner wallet.',
                  action: 'Guide the user through connecting a wallet using the setup instructions below. They need to add AEGIS_PRIVATE_KEY to their MCP config and restart this client.',
                  walletSetupGuide: getWalletSetupGuide(chainId),
                }, null, 2),
              },
            ],
          };
        }

        const client = getClient();
        const result = await client.requestErc8004Validation({
          agentId: BigInt(params.agentId),
          skillHash: params.skillHash as `0x${string}`,
          auditLevel: params.auditLevel as 1 | 2 | 3,
          metadataURI: params.metadataURI,
          validatorAddress: params.validatorAddress as `0x${string}`,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                success: true,
                step: '1 of 2 — Validation request submitted',
                requestHash: result.requestHash,
                requestTxHash: result.requestTxHash,
                agentId: params.agentId,
                skillHash: params.skillHash,
                auditLevel: params.auditLevel,
                erc8004Score: AUDIT_LEVEL_SCORES[params.auditLevel],
                validatorAddress: params.validatorAddress,
                agentOwnerAddress: getWalletAddress(),
                nextStep: 'The AEGIS validator must now call respond-to-erc8004-validation with the requestHash above to complete the bridge. This must be done from the validator wallet, not the agent owner wallet.',
              }),
            },
          ],
        };
      }),
  );
}
