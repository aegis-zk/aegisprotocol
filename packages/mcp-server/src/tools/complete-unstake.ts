import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient, hasWallet, getWalletAddress } from '../lib/client.js';
import { handleToolCall, serializeResult } from '../lib/serialization.js';
import { getWalletSetupGuide } from '../lib/wallet-guide.js';

export function registerCompleteUnstake(server: McpServer): void {
  server.tool(
    'complete-unstake',
    'Complete a pending unstake request after the 3-day cooldown has passed. Transfers the unstaked ETH to the caller. Blocked if new disputes were opened during cooldown. Requires AEGIS_PRIVATE_KEY.',
    {
      auditorCommitment: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The auditor bytes32 Pedersen commitment hash'),
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
                  error: 'No wallet configured. This operation requires a wallet with ETH to pay for gas.',
                  action: 'Guide the user through connecting a wallet using the setup instructions below. They need to add AEGIS_PRIVATE_KEY to their MCP config and restart this client.',
                  walletSetupGuide: getWalletSetupGuide(chainId),
                }, null, 2),
              },
            ],
          };
        }

        const client = getClient();

        const txHash = await client.completeUnstake(
          params.auditorCommitment as `0x${string}`,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                success: true,
                transactionHash: txHash,
                auditorCommitment: params.auditorCommitment,
                walletAddress: getWalletAddress(),
                note: 'Unstake completed. ETH has been transferred to the caller. If the full stake was withdrawn, the auditor has been deregistered.',
              }),
            },
          ],
        };
      }),
  );
}
