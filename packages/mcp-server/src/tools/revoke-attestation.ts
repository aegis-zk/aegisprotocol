import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient, hasWallet, getWalletAddress } from '../lib/client.js';
import { handleToolCall, serializeResult } from '../lib/serialization.js';
import { getWalletSetupGuide } from '../lib/wallet-guide.js';

export function registerRevokeAttestation(server: McpServer): void {
  server.tool(
    'revoke-attestation',
    'Revoke an attestation on the AEGIS Protocol (contract owner only). Revoked attestations are permanently marked as invalid. Consumers should check isAttestationRevoked() before trusting any attestation.',
    {
      skillHash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The bytes32 skill hash'),
      attestationIndex: z
        .number()
        .int()
        .min(0)
        .describe('Zero-based index of the attestation to revoke'),
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
        const txHash = await client.revokeAttestation(
          params.skillHash as `0x${string}`,
          params.attestationIndex,
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
                walletAddress: getWalletAddress(),
                note: 'Attestation revoked permanently. It will now return true for isAttestationRevoked().',
              }),
            },
          ],
        };
      }),
  );
}
