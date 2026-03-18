import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient, hasWallet, getWalletAddress } from '../lib/client.js';
import { handleToolCall, serializeResult } from '../lib/serialization.js';
import { getWalletSetupGuide } from '../lib/wallet-guide.js';

export function registerOpenDispute(server: McpServer): void {
  server.tool(
    'open-dispute',
    'Open a dispute against a skill attestation on the AEGIS Protocol. Requires AEGIS_PRIVATE_KEY and a minimum bond of 0.005 ETH. If the auditor is found at fault, their stake is slashed and the bond is returned. If no wallet is configured, returns a step-by-step guide to help the user connect one.',
    {
      skillHash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The bytes32 skill hash to dispute'),
      attestationIndex: z
        .number()
        .int()
        .min(0)
        .describe('Zero-based index of the attestation to dispute'),
      evidence: z
        .string()
        .regex(/^0x[0-9a-fA-F]+$/)
        .describe('Hex-encoded evidence bytes supporting the dispute'),
      bondEth: z
        .string()
        .describe('ETH bond amount (e.g. "0.01"). Minimum 0.005 ETH.'),
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
                  error: 'No wallet configured. This operation requires a wallet with ETH to pay for gas and the dispute bond.',
                  action: 'Guide the user through connecting a wallet using the setup instructions below. They need to add AEGIS_PRIVATE_KEY to their MCP config and restart this client.',
                  walletSetupGuide: getWalletSetupGuide(chainId),
                }, null, 2),
              },
            ],
          };
        }

        const client = getClient();
        const bondWei = BigInt(
          Math.floor(parseFloat(params.bondEth) * 1e18),
        );

        const txHash = await client.openDispute(
          params.skillHash as `0x${string}`,
          params.attestationIndex,
          params.evidence as `0x${string}`,
          bondWei,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                success: true,
                transactionHash: txHash,
                skillHash: params.skillHash,
                attestationIndex: params.attestationIndex,
                bondEth: params.bondEth,
                walletAddress: getWalletAddress(),
                note: 'Dispute opened successfully. The bond will be returned if the auditor is found at fault.',
              }),
            },
          ],
        };
      }),
  );
}
