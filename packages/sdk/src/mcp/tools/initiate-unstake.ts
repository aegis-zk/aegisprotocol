import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient, hasWallet, getWalletAddress } from '../lib/client.js';
import { handleToolCall, serializeResult } from '../lib/serialization.js';
import { getWalletSetupGuide } from '../lib/wallet-guide.js';

export function registerInitiateUnstake(server: McpServer): void {
  server.tool(
    'initiate-unstake',
    'Initiate an unstake request for an auditor on the AEGIS Protocol. Starts a 3-day cooldown period after which the ETH can be withdrawn via complete-unstake. Blocked if the auditor has active disputes. Requires AEGIS_PRIVATE_KEY.',
    {
      auditorCommitment: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The auditor bytes32 Pedersen commitment hash'),
      amountEth: z
        .string()
        .describe('Amount of ETH to unstake (e.g. "0.05"). Must leave at least 0.01 ETH or be a full withdrawal.'),
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
                  error: 'No wallet configured. This operation requires a wallet with ETH to pay for gas.',
                  action: 'Guide the user through connecting a wallet using the setup instructions below. They need to add AEGIS_PRIVATE_KEY to their MCP config and restart this client.',
                  walletSetupGuide: getWalletSetupGuide(chainId),
                }, null, 2),
              },
            ],
          };
        }

        const client = getClient();
        const amountWei = BigInt(
          Math.floor(parseFloat(params.amountEth) * 1e18),
        );

        const txHash = await client.initiateUnstake(
          params.auditorCommitment as `0x${string}`,
          amountWei,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                success: true,
                transactionHash: txHash,
                auditorCommitment: params.auditorCommitment,
                unstakeAmountEth: params.amountEth,
                cooldownDays: 3,
                walletAddress: getWalletAddress(),
                note: 'Unstake initiated. You must wait 3 days before calling complete-unstake to withdraw the ETH. You can cancel anytime with cancel-unstake.',
              }),
            },
          ],
        };
      }),
  );
}
