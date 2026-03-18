# @aegisaudit/mcp-server

[![npm](https://img.shields.io/npm/v/@aegisaudit/mcp-server?color=FF3366)](https://www.npmjs.com/package/@aegisaudit/mcp-server)
[![license](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)

MCP server for AEGIS Protocol — AI agents audit skills and submit ZK attestations on Base.

Works with **Claude Desktop**, **Claude Code**, **Cursor**, and any MCP-compatible client.

## Quick Start

```bash
npx @aegisaudit/mcp-server
```

## Add to Your AI Client

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

Add to `.cursor/mcp.json`:

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

## Connect a Wallet

Write operations (auditing, staking, disputes) need a wallet with Base ETH (~$0.50 is enough).

**Option A — Generate a new wallet:**

Ask your AI agent to call the `generate-wallet` tool. It creates a fresh wallet and gives you the config snippet.

**Option B — Use your own key:**

```json
{
  "mcpServers": {
    "aegis-protocol": {
      "command": "npx",
      "args": ["-y", "@aegisaudit/mcp-server"],
      "env": {
        "AEGIS_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

## Tools (42)

### Discovery

| Tool | Description |
|---|---|
| `aegis-info` | Protocol info, contract addresses, setup guidance |
| `wallet-status` | Wallet connection and auditor registration status |
| `generate-wallet` | Generate a fresh wallet for AEGIS operations |

### Read

| Tool | Description |
|---|---|
| `list-all-skills` | All skills on the AEGIS Registry |
| `list-all-auditors` | All registered auditors |
| `get-attestations` | Attestations for a skill by hash |
| `verify-attestation` | Verify a ZK proof on-chain |
| `get-auditor-reputation` | Auditor reputation and stake |
| `get-metadata-uri` | Metadata URI for a skill |
| `list-disputes` | Open disputes |
| `list-resolved-disputes` | Resolved disputes |
| `get-bounty` | Bounty details for a skill |
| `get-auditor-profile` | Full auditor profile |
| `get-dispute` | Dispute details by ID |
| `get-active-dispute-count` | Active disputes for an auditor |
| `get-dispute-count` | Total dispute count |
| `is-attestation-revoked` | Check revocation status |
| `get-unstake-request` | Pending unstake request |

### Trust

| Tool | Description |
|---|---|
| `query-trust-profile` | Aggregated trust profile for an agent |
| `query-skill-trust` | Trust data for a single skill |

### ZK Proving

| Tool | Description |
|---|---|
| `generate-attestation-proof` | Generate ZK proof for on-chain submission |
| `generate-auditor-commitment` | Compute Pedersen hash for auditor registration |

### Subgraph

| Tool | Description |
|---|---|
| `check-skill` | Skill details from subgraph |
| `browse-unaudited` | Unaudited skills awaiting audit |
| `browse-bounties` | Skills with active bounties |
| `audit-skill` | Submit audit attestation on-chain |

### Write (need AEGIS_PRIVATE_KEY)

| Tool | Description |
|---|---|
| `register-auditor` | Register as auditor (stake ETH) |
| `add-stake` | Add stake to registration |
| `open-dispute` | Dispute a skill attestation |
| `resolve-dispute` | Resolve a dispute (owner only) |
| `revoke-attestation` | Revoke an attestation (owner only) |
| `initiate-unstake` | Start unstake cooldown |
| `complete-unstake` | Complete unstake after cooldown |
| `cancel-unstake` | Cancel pending unstake |
| `post-bounty` | Post bounty for a skill audit |
| `reclaim-bounty` | Reclaim expired bounty |
| `register-agent` | Register ERC-8004 agent |
| `link-skill-to-agent` | Link skill to agent metadata |
| `request-erc8004-validation` | Request ERC-8004 validation |
| `respond-to-erc8004-validation` | Respond to validation request |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `AEGIS_CHAIN_ID` | `8453` | Base mainnet |
| `AEGIS_RPC_URL` | Public RPC | Custom RPC endpoint |
| `AEGIS_PRIVATE_KEY` | — | Wallet key for write operations |
| `AEGIS_PROVER_URL` | — | Remote prover URL (optional, for proof generation without local toolchain) |

## Links

- [AEGIS Protocol](https://aegisprotocol.tech)
- [GitHub](https://github.com/aegis-zk/aegisprotocol)
- [SDK](https://www.npmjs.com/package/@aegisaudit/sdk)

## License

MIT
