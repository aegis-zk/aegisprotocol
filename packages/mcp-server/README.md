# @aegisaudit/mcp-server

[![npm](https://img.shields.io/npm/v/@aegisaudit/mcp-server?color=FF3366)](https://www.npmjs.com/package/@aegisaudit/mcp-server)
[![license](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)

MCP server for the AEGIS Protocol — exposes on-chain ZK skill attestation queries as tools for AI agents.

Works with **Claude Desktop**, **Claude Code**, **Cursor**, and any MCP-compatible client.

## Install

```bash
npm install -g @aegisaudit/mcp-server
```

Or run directly:

```bash
npx @aegisaudit/mcp-server
```

## Configuration

### Claude Desktop

Add to your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "aegis-protocol": {
      "command": "npx",
      "args": ["-y", "@aegisaudit/mcp-server"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add aegis-protocol -- npx -y @aegisaudit/mcp-server
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "aegis-protocol": {
      "command": "npx",
      "args": ["-y", "@aegisaudit/mcp-server"]
    }
  }
}
```

### Interactive Setup

Run the built-in installer to auto-configure your MCP client:

```bash
npx @aegisaudit/mcp-server setup
```

## Available Tools

### Discovery

| Tool | Description |
|---|---|
| `aegis-info` | Get protocol information, contract addresses, and setup guidance |
| `wallet-status` | Check wallet connection and auditor registration status |

### Read Operations

| Tool | Description |
|---|---|
| `list-all-skills` | List all skills registered on the AEGIS Registry |
| `list-all-auditors` | List all registered auditors |
| `get-attestations` | Get attestations for a specific skill by hash |
| `verify-attestation` | Verify a ZK proof on-chain for a given attestation |
| `get-auditor-reputation` | Query an auditor's reputation and stake |
| `get-metadata-uri` | Get the metadata URI for a registered skill |
| `list-disputes` | List open disputes (optionally filtered by skill) |
| `list-resolved-disputes` | List resolved disputes |

### Write Operations

These require `AEGIS_PRIVATE_KEY` to be set.

| Tool | Description |
|---|---|
| `register-auditor` | Register as an auditor by staking ETH |
| `add-stake` | Add more stake to your auditor registration |
| `open-dispute` | Open a dispute against a skill attestation |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `AEGIS_CHAIN_ID` | `84532` | Chain ID (84532 = Base Sepolia) |
| `AEGIS_RPC_URL` | Public RPC | Custom RPC endpoint |
| `AEGIS_PRIVATE_KEY` | — | Private key for write operations |

Example with a custom RPC and wallet:

```json
{
  "mcpServers": {
    "aegis-protocol": {
      "command": "npx",
      "args": ["-y", "@aegisaudit/mcp-server"],
      "env": {
        "AEGIS_CHAIN_ID": "84532",
        "AEGIS_RPC_URL": "https://base-sepolia.g.alchemy.com/v2/YOUR_KEY",
        "AEGIS_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

## Wallet Setup

Write operations (registering as an auditor, staking, opening disputes) require a wallet with Base Sepolia ETH.

1. Export a private key from your wallet
2. Set `AEGIS_PRIVATE_KEY` in your MCP config
3. Get testnet ETH from the [Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia)

The server will guide you through setup if no wallet is configured — just ask your AI agent to check your `wallet-status`.

## Trust-Gating Agent Tool Calls

If your agent uses tools that correspond to AEGIS-registered skills, use `@aegisaudit/consumer-middleware` to automatically verify trust before execution:

```bash
npm install @aegisaudit/consumer-middleware
```

```typescript
import { TrustGate } from '@aegisaudit/consumer-middleware';
import { aegisMcpMiddleware } from '@aegisaudit/consumer-middleware/mcp';

// Configure trust policy
const gate = new TrustGate({
  policy: {
    minAuditLevel: 2,      // Require L2+ audited skills
    blockOnDispute: true,   // Block skills with open disputes
    mode: 'enforce',        // Hard block on failure
  },
  skills: [
    { toolName: 'query-database', skillHash: '0x...' },
    { toolName: 'send-email',     skillHash: '0x...' },
  ],
});

// Wrap your MCP tool handler
server.setRequestHandler(CallToolRequestSchema,
  aegisMcpMiddleware(gate, originalHandler)
);
```

The middleware queries the AEGIS subgraph (with on-chain fallback) and blocks tools that don't meet your policy. See the [consumer middleware docs](https://www.npmjs.com/package/@aegisaudit/consumer-middleware) for LangChain, CrewAI, and custom agent loop examples.

## Links

- [AEGIS Protocol](https://aegisprotocol.tech)
- [GitHub](https://github.com/aegis-zk/aegisprotocol)
- [SDK](https://www.npmjs.com/package/@aegisaudit/sdk)
- [Consumer Middleware](https://www.npmjs.com/package/@aegisaudit/consumer-middleware)

## License

MIT
