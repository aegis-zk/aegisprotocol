import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient, hasWallet, getWalletAddress } from '../lib/client.js';
import { handleToolCall, serializeResult } from '../lib/serialization.js';
import { getWalletSetupGuide } from '../lib/wallet-guide.js';
import { AUDIT_LEVEL_SCORES } from '@aegisaudit/sdk';

export function registerLinkSkillToAgent(server: McpServer): void {
  server.tool(
    'link-skill-to-agent',
    'Link an AEGIS skill hash to an ERC-8004 agent identity by writing it as metadata on the IdentityRegistry. This associates the audit result with the agent NFT so consumers can discover it. Requires AEGIS_PRIVATE_KEY and ownership of the agent NFT.',
    {
      agentId: z
        .string()
        .describe('The ERC-8004 agent ID (uint256 as string)'),
      skillHash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The bytes32 AEGIS skill hash to link'),
      auditLevel: z
        .number()
        .int()
        .min(1)
        .max(3)
        .describe('Audit level of the attestation (1=Functional, 2=Robust, 3=Security)'),
    },
    (params) =>
      handleToolCall(async () => {
        if (!hasWallet()) {
          const chainId = Number(process.env.AEGIS_CHAIN_ID ?? '84532');
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  error: 'No wallet configured. This operation requires a wallet.',
                  action: 'Guide the user through connecting a wallet using the setup instructions below. They need to add AEGIS_PRIVATE_KEY to their MCP config and restart this client.',
                  walletSetupGuide: getWalletSetupGuide(chainId),
                }, null, 2),
              },
            ],
          };
        }

        const client = getClient();
        const txHash = await client.linkSkillToAgent(
          BigInt(params.agentId),
          params.skillHash as `0x${string}`,
          params.auditLevel as 1 | 2 | 3,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                success: true,
                transactionHash: txHash,
                agentId: params.agentId,
                skillHash: params.skillHash,
                auditLevel: params.auditLevel,
                erc8004Score: AUDIT_LEVEL_SCORES[params.auditLevel],
                walletAddress: getWalletAddress(),
                note: 'Skill linked to agent identity in ERC-8004 IdentityRegistry. The metadata key is stored as "aegis:skill:<skillHash>".',
              }),
            },
          ],
        };
      }),
  );
}
