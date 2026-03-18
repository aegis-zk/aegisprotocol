import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { REGISTRY_ADDRESSES } from '@aegisaudit/sdk';
import { hasWallet, getWalletAddress } from '../lib/client.js';
import { getWalletSetupGuide } from '../lib/wallet-guide.js';

export function registerAegisInfo(server: McpServer): void {
  server.tool(
    'aegis-info',
    "Get an overview of the AEGIS Protocol and this MCP server's capabilities. Returns protocol description, network configuration, wallet status, wallet setup instructions, and a list of all available tools. IMPORTANT: If the wallet is not connected, guide the user through setup using the walletSetupGuide included in the response.",
    {},
    async () => {
      const chainId = Number(process.env.AEGIS_CHAIN_ID ?? '8453');
      const registryAddress =
        process.env.AEGIS_REGISTRY ?? REGISTRY_ADDRESSES[chainId] ?? 'unknown';
      const networkName =
        chainId === 8453
          ? 'Base'
          : `Chain ${chainId}`;

      const walletConnected = hasWallet();
      const walletAddress = getWalletAddress();

      const readTools = [
        { name: 'aegis-info', description: 'Protocol overview and tool discovery' },
        { name: 'wallet-status', description: 'Check wallet connection, address, and ETH balance' },
        { name: 'list-all-skills', description: 'Browse all registered skills on-chain', params: 'fromBlock?, toBlock?' },
        { name: 'list-all-auditors', description: 'Browse all registered auditors', params: 'fromBlock?, toBlock?' },
        { name: 'get-attestations', description: 'Get ZK attestations for a specific skill', params: 'skillHash' },
        { name: 'verify-attestation', description: "Verify an attestation's ZK proof on-chain", params: 'skillHash, attestationIndex' },
        { name: 'get-auditor-reputation', description: 'Query auditor reputation data', params: 'auditorCommitment' },
        { name: 'get-metadata-uri', description: 'Get the IPFS metadata URI for a skill', params: 'skillHash' },
        { name: 'list-disputes', description: 'List opened disputes, optionally filtered by skill', params: 'skillHash?, fromBlock?, toBlock?' },
        { name: 'list-resolved-disputes', description: 'List resolved disputes', params: 'fromBlock?, toBlock?' },
      ];

      const writeTools = [
        { name: 'register-auditor', description: 'Register as an anonymous auditor by staking ETH (min 0.01 ETH)', params: 'auditorCommitment, stakeEth' },
        { name: 'add-stake', description: 'Add more ETH stake to an existing auditor registration', params: 'auditorCommitment, amountEth' },
        { name: 'open-dispute', description: 'Challenge a fraudulent attestation with a bond (min 0.005 ETH)', params: 'skillHash, attestationIndex, evidence, bondEth' },
      ];

      const info: Record<string, unknown> = {
        protocol: 'AEGIS Protocol',
        description:
          'Anonymous Expertise & Guarantee for Intelligent Skills — an on-chain ZK attestation registry for AI agent skills on Base L2.',
        network: {
          name: networkName,
          chainId,
          registryAddress,
        },
        wallet: {
          connected: walletConnected,
          address: walletAddress,
          hint: walletConnected
            ? 'Wallet connected. Read and write operations are available.'
            : 'No wallet configured. To use write operations (register-auditor, add-stake, open-dispute), the user needs to connect a wallet. See the walletSetupGuide below for step-by-step instructions to walk the user through this.',
        },
        readTools,
        writeTools: walletConnected
          ? writeTools
          : writeTools.map(t => ({
              ...t,
              description: `[REQUIRES WALLET] ${t.description}`,
            })),
      };

      // When no wallet is connected, include the full setup guide so the
      // agent knows exactly how to walk the user through connecting one
      if (!walletConnected) {
        info.walletSetupGuide = getWalletSetupGuide(chainId);
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }],
      };
    },
  );
}
