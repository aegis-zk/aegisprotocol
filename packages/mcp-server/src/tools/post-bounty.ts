import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient, hasWallet, getWalletAddress } from '../lib/client.js';
import { handleToolCall, serializeResult } from '../lib/serialization.js';
import { getWalletSetupGuide } from '../lib/wallet-guide.js';

export function registerPostBounty(server: McpServer): void {
  server.tool(
    'post-bounty',
    'Post a bounty to incentivize auditors to audit a skill on the AEGIS Protocol. The bounty is paid out to the auditor when a valid attestation matching the required level is submitted. Minimum bounty is 0.001 ETH. Bounties expire after 30 days. Requires AEGIS_PRIVATE_KEY.',
    {
      skillHash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The bytes32 skill hash (keccak256 of the skill package) to post a bounty for'),
      requiredLevel: z
        .number()
        .int()
        .min(1)
        .max(3)
        .describe('Minimum audit level required to claim the bounty (1=Functional, 2=Robust, 3=Security)'),
      amountEth: z
        .string()
        .describe('Amount of ETH to post as bounty (e.g. "0.05"). Minimum 0.001 ETH.'),
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
                  error: 'No wallet configured. This operation requires a wallet with ETH.',
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

        const txHash = await client.postBounty(
          params.skillHash as `0x${string}`,
          params.requiredLevel,
          amountWei,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                success: true,
                transactionHash: txHash,
                skillHash: params.skillHash,
                bountyAmountEth: params.amountEth,
                requiredLevel: params.requiredLevel,
                expirationDays: 30,
                walletAddress: getWalletAddress(),
                note: 'Bounty posted successfully. It will be paid to the auditor who submits a valid attestation meeting the required level. The bounty expires in 30 days — use reclaim-bounty to reclaim after expiration if unclaimed.',
              }),
            },
          ],
        };
      }),
  );
}
