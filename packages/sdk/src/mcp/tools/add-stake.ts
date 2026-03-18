import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient, hasWallet, getWalletAddress } from '../lib/client.js';
import { handleToolCall, serializeResult } from '../lib/serialization.js';
import { getWalletSetupGuide } from '../lib/wallet-guide.js';

export function registerAddStake(server: McpServer): void {
  server.tool(
    'add-stake',
    'Add more ETH stake to an existing auditor registration on the AEGIS Protocol. Requires AEGIS_PRIVATE_KEY to be set. If no wallet is configured, returns a step-by-step guide to help the user connect one.',
    {
      auditorCommitment: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The auditor bytes32 Pedersen commitment hash'),
      amountEth: z
        .string()
        .describe('Amount of ETH to add (e.g. "0.1")'),
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
                  error: 'No wallet configured. This operation requires a wallet with ETH to pay for gas and staking.',
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

        const txHash = await client.addStake(
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
                addedEth: params.amountEth,
                walletAddress: getWalletAddress(),
                note: 'Stake added successfully. Higher stake increases auditor reputation score.',
              }),
            },
          ],
        };
      }),
  );
}
