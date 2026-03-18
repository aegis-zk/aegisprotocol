import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient, hasWallet, getWalletAddress } from '../lib/client.js';
import { handleToolCall, serializeResult } from '../lib/serialization.js';
import { getWalletSetupGuide } from '../lib/wallet-guide.js';

export function registerRegisterAuditor(server: McpServer): void {
  server.tool(
    'register-auditor',
    'Register as an anonymous auditor on the AEGIS Protocol by staking ETH. Requires AEGIS_PRIVATE_KEY to be set. Minimum effective stake is 0.01 ETH, but the contract charges a 5% protocol fee — so you need to send at least 0.0106 ETH (the tool auto-adjusts). If no wallet is configured, returns a step-by-step guide to help the user connect one.',
    {
      auditorCommitment: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The auditor bytes32 Pedersen commitment hash'),
      stakeEth: z
        .string()
        .describe('Desired net stake in ETH (e.g. "0.01"). The tool auto-adjusts upward to cover the 5% protocol fee. Minimum net stake is 0.01 ETH.'),
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
                  error: 'No wallet configured. This operation requires a wallet with ETH to pay for gas and staking.',
                  action: 'Guide the user through connecting a wallet using the setup instructions below. They need to add AEGIS_PRIVATE_KEY to their MCP config and restart this client.',
                  walletSetupGuide: getWalletSetupGuide(chainId),
                }, null, 2),
              },
            ],
          };
        }

        const client = getClient();
        const desiredNetStakeWei = BigInt(
          Math.floor(parseFloat(params.stakeEth) * 1e18),
        );

        // Auto-adjust to cover 5% protocol fee (PROTOCOL_FEE_BPS = 500)
        // Net stake = sent * (10000 - 500) / 10000 = sent * 0.95
        // So sent = desiredNet / 0.95 = desiredNet * 10000 / 9500
        const adjustedStakeWei = (desiredNetStakeWei * 10000n) / 9500n + 1n; // +1 to round up
        const adjustedStakeEth = Number(adjustedStakeWei) / 1e18;

        const txHash = await client.registerAuditor(
          params.auditorCommitment as `0x${string}`,
          adjustedStakeWei,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                success: true,
                transactionHash: txHash,
                auditorCommitment: params.auditorCommitment,
                requestedStakeEth: params.stakeEth,
                actualSentEth: adjustedStakeEth.toFixed(6),
                netStakeAfterFeeEth: params.stakeEth,
                protocolFeeNote: '5% protocol fee was auto-added to ensure net stake meets your requested amount.',
                walletAddress: getWalletAddress(),
                note: 'Auditor registered successfully. Your commitment hash is your anonymous identity on the protocol.',
              }),
            },
          ],
        };
      }),
  );
}
