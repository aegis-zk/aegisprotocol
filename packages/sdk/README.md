# @aegisaudit/sdk

[![npm](https://img.shields.io/npm/v/@aegisaudit/sdk?color=FF3366)](https://www.npmjs.com/package/@aegisaudit/sdk)
[![license](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)

On-chain ZK skill attestations for AI agents on Base. One package — SDK library + MCP server + ZK prover.

## Use as MCP Server (AI Agents)

### Auto-setup

```bash
npx @aegisaudit/sdk setup
```

Detects Claude Desktop, Claude Code, and Cursor — injects the config automatically.

### Manual config

**Claude Desktop** — `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "aegis-protocol": {
      "command": "npx",
      "args": ["-y", "@aegisaudit/sdk"]
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add aegis-protocol -- npx -y @aegisaudit/sdk
```

**Cursor** — `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "aegis-protocol": {
      "command": "npx",
      "args": ["-y", "@aegisaudit/sdk"]
    }
  }
}
```

### Connect a wallet

Write operations (auditing, staking, disputes) need a wallet with Base ETH (~$0.50).

**Option A** — Call the `generate-wallet` tool. It creates a wallet and gives you the config snippet.

**Option B** — Provide your own key:

```json
{
  "mcpServers": {
    "aegis-protocol": {
      "command": "npx",
      "args": ["-y", "@aegisaudit/sdk"],
      "env": {
        "AEGIS_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

### Tools (45)

**Discovery:** `aegis-info`, `wallet-status`, `generate-wallet`

**Read:** `list-all-skills`, `list-all-auditors`, `get-attestations`, `verify-attestation`, `get-auditor-reputation`, `get-metadata-uri`, `list-disputes`, `list-resolved-disputes`, `get-bounty`, `get-auditor-profile`, `get-dispute`, `get-active-dispute-count`, `get-dispute-count`, `is-attestation-revoked`, `get-unstake-request`

**Trust:** `query-trust-profile`, `query-skill-trust`

**ZK Proving:** `generate-attestation-proof`, `generate-auditor-commitment`

**Subgraph:** `check-skill`, `browse-unaudited`, `browse-bounties`, `audit-skill`

**Write (need AEGIS_PRIVATE_KEY):** `register-auditor`, `add-stake`, `open-dispute`, `resolve-dispute`, `revoke-attestation`, `initiate-unstake`, `complete-unstake`, `cancel-unstake`, `post-bounty`, `reclaim-bounty`, `register-agent`, `link-skill-to-agent`, `request-erc8004-validation`, `respond-to-erc8004-validation`, `create-agent-registration`, `get-erc8004-validation`

**TAO/Bittensor:** `tao-list-subnets`, `tao-browse-miners`, `tao-check-subnet`

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `AEGIS_CHAIN_ID` | `8453` | Base mainnet |
| `AEGIS_RPC_URL` | Public RPC | Custom RPC endpoint |
| `AEGIS_PRIVATE_KEY` | — | Wallet key for write operations |

## Use as Library

```bash
npm install @aegisaudit/sdk
```

```typescript
import { AegisClient } from '@aegisaudit/sdk';

const client = new AegisClient({ chainId: 8453 });

// List all registered skills
const skills = await client.listAllSkills();

// Get attestations for a skill
const attestations = await client.getAttestations(skills[0].skillHash);

// Verify a ZK proof on-chain
const valid = await client.verify(skills[0].skillHash, 0);
```

### Read operations

| Method | Description |
|---|---|
| `listAllSkills()` | All registered skills |
| `listAllAuditors()` | All registered auditors |
| `getAttestations(skillHash)` | Attestations for a skill |
| `verify(skillHash, index)` | Verify ZK proof on-chain |
| `getAuditorReputation(commitment)` | Auditor reputation data |
| `getMetadataURI(skillHash)` | Skill metadata URI |
| `listDisputes()` | Open disputes |
| `listResolvedDisputes()` | Resolved disputes |
| `getBounty(skillHash)` | Bounty details |
| `getAuditorProfile(commitment)` | Full auditor profile |
| `getTrustProfile(agentId)` | Aggregated trust profile |
| `getSkillTrustScore(skillHash)` | Skill trust score |

### Write operations (need wallet)

| Method | Description |
|---|---|
| `registerSkill(params)` | Register skill with ZK attestation |
| `registerAuditor(commitment, stake)` | Register as auditor (stake ETH) |
| `addStake(commitment, amount)` | Add stake |
| `openDispute(skillHash, index, evidence, bond)` | Dispute an attestation |
| `postBounty(skillHash, level, amount)` | Post audit bounty |

### ZK prover

```typescript
import { buildProverToml, generateAttestationViaCLI } from '@aegisaudit/sdk';

const toml = buildProverToml({ skillHash, criteriaHash, auditLevel, auditorCommitment, auditorPrivateKey });
const { proof, publicInputs } = await generateAttestationViaCLI({ proverToml: toml });
```

### Pre-execution trust gate

For production agents, use `@aegisaudit/consumer-middleware` to automatically block untrusted tool calls:

```bash
npm install @aegisaudit/consumer-middleware
```

```typescript
import { TrustGate } from '@aegisaudit/consumer-middleware';

const gate = new TrustGate({
  policy: { minAuditLevel: 2, blockOnDispute: true, mode: 'enforce' },
  skills: [{ toolName: 'web_search', skillHash: '0x...' }],
});

const result = await gate.check('web_search');
// { allowed: true/false, reason, trustData }
```

Supports LangChain, CrewAI, and MCP adapters.

## Links

- [AEGIS Protocol](https://aegisprotocol.tech)
- [GitHub](https://github.com/aegis-zk/aegisprotocol)
- [Consumer Middleware](https://www.npmjs.com/package/@aegisaudit/consumer-middleware)

## License

MIT
