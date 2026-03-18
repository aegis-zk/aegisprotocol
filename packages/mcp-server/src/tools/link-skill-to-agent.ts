import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient, hasWallet, getWalletAddress } from '../lib/client.js';
import { handleToolCall, serializeResult } from '../lib/serialization.js';
import { getWalletSetupGuide } from '../lib/wallet-guide.js';
import { AUDIT_LEVEL_SCORES, ERC8004_CHAIN_ADDRESSES } from '@aegisaudit/sdk';
import { createPublicClient, http } from 'viem';

export function registerLinkSkillToAgent(server: McpServer): void {
  server.tool(
    'link-skill-to-agent',
    'Link an AEGIS skill hash to an ERC-8004 agent identity by writing it as metadata on the IdentityRegistry. This associates the audit result with the agent NFT so consumers can discover it. Requires AEGIS_PRIVATE_KEY. IMPORTANT: The wallet must be the ownerOf(agentId) — only the NFT holder can set metadata. If you get "Not authorized", the AEGIS_PRIVATE_KEY wallet does not own the specified agent NFT.',
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
        const walletAddr = getWalletAddress();
        const chainId = Number(process.env.AEGIS_CHAIN_ID ?? '8453');

        // Pre-check: verify the wallet owns this agent NFT
        try {
          const addrs = ERC8004_CHAIN_ADDRESSES[chainId];
          if (addrs?.identityRegistry) {
            const publicClient = createPublicClient({
              transport: http(process.env.AEGIS_RPC_URL),
            });
            const nftOwner = await publicClient.readContract({
              address: addrs.identityRegistry as `0x${string}`,
              abi: [{ type: 'function', name: 'ownerOf', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' }] as const,
              functionName: 'ownerOf',
              args: [BigInt(params.agentId)],
            }) as string;

            if (nftOwner.toLowerCase() !== walletAddr?.toLowerCase()) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: serializeResult({
                      error: 'NotAgentOwner',
                      agentId: params.agentId,
                      nftOwner,
                      walletAddress: walletAddr,
                      message: `Your wallet ${walletAddr} does not own agent #${params.agentId}. Only the NFT owner (${nftOwner}) can set metadata. Use the correct AEGIS_PRIVATE_KEY or register a new agent with register-agent.`,
                    }),
                  },
                ],
              };
            }
          }
        } catch {
          // Agent may not exist — let the tx revert with a clear error
        }

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
