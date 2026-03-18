import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient, hasWallet, getWalletAddress } from '../lib/client.js';
import { handleToolCall, serializeResult } from '../lib/serialization.js';
import { getWalletSetupGuide } from '../lib/wallet-guide.js';

export function registerReclaimBounty(server: McpServer): void {
  server.tool(
    'reclaim-bounty',
    'Reclaim an expired, unclaimed bounty on the AEGIS Protocol. Only the original bounty publisher can reclaim. The bounty must have expired (30 days after posting) and not yet been claimed by an auditor. Returns the full bounty amount to the publisher (no protocol fee on reclaims). Requires AEGIS_PRIVATE_KEY.',
    {
      skillHash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The bytes32 skill hash (keccak256 of the skill package) to reclaim bounty for'),
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
                  error: 'No wallet configured. This operation requires a wallet.',
                  action: 'Guide the user through connecting a wallet using the setup instructions below. They need to add AEGIS_PRIVATE_KEY to their MCP config and restart this client.',
                  walletSetupGuide: getWalletSetupGuide(chainId),
                }, null, 2),
              },
            ],
          };
        }

        const client = getClient();

        const txHash = await client.reclaimBounty(
          params.skillHash as `0x${string}`,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                success: true,
                transactionHash: txHash,
                skillHash: params.skillHash,
                walletAddress: getWalletAddress(),
                note: 'Bounty reclaimed successfully. The full bounty amount has been returned to your wallet.',
              }),
            },
          ],
        };
      }),
  );
}
