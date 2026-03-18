import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient, hasWallet, getWalletAddress } from '../lib/client.js';
import { handleToolCall, serializeResult } from '../lib/serialization.js';
import { getWalletSetupGuide } from '../lib/wallet-guide.js';

export function registerRegisterAgent(server: McpServer): void {
  server.tool(
    'register-agent',
    'Register a new AI agent in the ERC-8004 IdentityRegistry on Base. Mints an ERC-721 NFT representing the agent identity. The agentURI should point to a JSON file describing the agent (name, services, skills). Returns the transaction hash. Requires AEGIS_PRIVATE_KEY.',
    {
      agentURI: z
        .string()
        .describe('URI pointing to the agent registration JSON (e.g. "ipfs://Qm..." or "https://example.com/agent.json")'),
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
        const result = await client.registerAgent(params.agentURI);

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                success: true,
                transactionHash: result.txHash,
                agentURI: params.agentURI,
                walletAddress: getWalletAddress(),
                note: 'Agent registered in ERC-8004 IdentityRegistry. An ERC-721 NFT has been minted representing this agent identity.',
              }),
            },
          ],
        };
      }),
  );
}
