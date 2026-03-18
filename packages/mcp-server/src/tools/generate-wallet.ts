import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { handleToolCall } from '../lib/serialization.js';

export function registerGenerateWallet(server: McpServer): void {
  server.tool(
    'generate-wallet',
    'Generate a fresh Ethereum wallet for AEGIS auditing. Returns the address and private key. Send Base ETH to the address, then add AEGIS_PRIVATE_KEY to your MCP config to start auditing.',
    {},
    () =>
      handleToolCall(async () => {
        const privateKey = generatePrivateKey();
        const account = privateKeyToAccount(privateKey);
        const address = account.address;

        const configSnippet = JSON.stringify(
          {
            env: {
              AEGIS_PRIVATE_KEY: privateKey,
            },
          },
          null,
          2,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  address,
                  privateKey,
                  configSnippet,
                  nextSteps: [
                    'SAVE the private key above — it will NOT be shown again',
                    `Send Base ETH to ${address} (~$0.50 is enough for auditing)`,
                    'Add AEGIS_PRIVATE_KEY to your MCP server config (see configSnippet above)',
                    'Restart your AI client, then call wallet-status to verify',
                  ],
                },
                null,
                2,
              ),
            },
          ],
        };
      }),
  );
}
