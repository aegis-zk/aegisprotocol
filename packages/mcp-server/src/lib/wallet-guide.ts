/**
 * Shared wallet onboarding instructions for agents.
 *
 * When an agent connects to the AEGIS MCP server without a wallet,
 * these instructions tell it exactly how to guide the user through
 * connecting one.
 */

interface WalletGuide {
  summary: string;
  optionA: { label: string; steps: string[] };
  optionB: { label: string; steps: string[] };
  configLocations: {
    claudeDesktop: Record<string, string>;
    cursor: string;
    claudeCode: string;
  };
  importantNotes: string[];
}

export function getWalletSetupGuide(chainId: number): WalletGuide {
  const networkName =
    chainId === 8453
      ? 'Base'
      : `Chain ${chainId}`;

  return {
    summary: `A wallet with ETH on ${networkName} is required for write operations (register-auditor, add-stake, open-dispute). Read operations work without a wallet.`,

    optionA: {
      label: 'Generate a new wallet (recommended)',
      steps: [
        'Call the `generate-wallet` tool to create a fresh wallet.',
        'Save the private key — it is shown only once.',
        "Send Base ETH to the generated address (~$0.50 is enough for auditing).",
        'Add AEGIS_PRIVATE_KEY to your MCP server config (the tool returns a configSnippet you can copy).',
        'Restart your AI client, then call `wallet-status` to verify.',
      ],
    },

    optionB: {
      label: 'Use your own wallet',
      steps: [
        'Export the private key from your wallet (e.g. MetaMask → Account Details → Show Private Key). Use a dedicated key, not your main wallet.',
        'Add "AEGIS_PRIVATE_KEY": "0x<key>" to the "env" section of your MCP server config (see configLocations below).',
        'Restart your AI client, then call `wallet-status` to verify.',
      ],
    },

    configLocations: {
      claudeDesktop: {
        macOS: '~/Library/Application Support/Claude/claude_desktop_config.json',
        windows: '%APPDATA%\\Claude\\claude_desktop_config.json',
        linux: '~/.config/claude/claude_desktop_config.json',
      },
      cursor: '~/.cursor/mcp.json',
      claudeCode: 'Run: claude mcp add-json aegis-protocol \'{"command":"npx","args":["-y","@aegisaudit/mcp-server"],"env":{"AEGIS_CHAIN_ID":"8453","AEGIS_PRIVATE_KEY":"0x<key>"}}\'',
    },

    importantNotes: [
      'You\'ll need Base ETH for gas (~$0.50 is enough for auditing).',
      'SECURITY: Use a dedicated wallet for AEGIS, not your main wallet with significant funds.',
      'The private key is stored locally in the MCP config and never sent to any server — it only signs transactions locally.',
    ],
  };
}
