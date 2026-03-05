import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient, hasWallet, getWalletAddress } from '../lib/client.js';
import { handleToolCall, serializeResult } from '../lib/serialization.js';
import { getWalletSetupGuide } from '../lib/wallet-guide.js';

export function registerResolveDispute(server: McpServer): void {
  server.tool(
    'resolve-dispute',
    'Resolve a dispute on the AEGIS Protocol (contract owner only). If auditorFault is true, the auditor\'s stake is slashed 50% and sent to the challenger along with their bond. If false, the bond is forfeited to the protocol treasury.',
    {
      disputeId: z
        .number()
        .int()
        .min(0)
        .describe('The dispute ID to resolve'),
      auditorFault: z
        .boolean()
        .describe('True if the auditor is at fault (triggers slashing), false otherwise'),
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
                  error: 'No wallet configured. This operation requires the contract owner wallet.',
                  action: 'Guide the user through connecting the owner wallet using the setup instructions below.',
                  walletSetupGuide: getWalletSetupGuide(chainId),
                }, null, 2),
              },
            ],
          };
        }

        const client = getClient();
        const txHash = await client.resolveDispute(
          BigInt(params.disputeId),
          params.auditorFault,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                success: true,
                transactionHash: txHash,
                disputeId: params.disputeId,
                auditorFault: params.auditorFault,
                walletAddress: getWalletAddress(),
                note: params.auditorFault
                  ? 'Dispute resolved: auditor found at fault. Stake slashed 50% and bond returned to challenger.'
                  : 'Dispute resolved: auditor not at fault. Bond forfeited to protocol treasury.',
              }),
            },
          ],
        };
      }),
  );
}
