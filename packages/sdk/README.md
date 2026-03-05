# @aegisaudit/sdk

[![npm](https://img.shields.io/npm/v/@aegisaudit/sdk?color=FF3366)](https://www.npmjs.com/package/@aegisaudit/sdk)
[![license](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)

TypeScript SDK for the AEGIS Protocol — query and interact with on-chain ZK skill attestations on Base.

## Install

```bash
npm install @aegisaudit/sdk
```

## Quick Start

```typescript
import { AegisClient } from '@aegisaudit/sdk';

// Create a read-only client (no wallet needed)
const client = new AegisClient({ chainId: 84532 });

// List all registered skills
const skills = await client.listAllSkills();
console.log(`${skills.length} skills registered`);

// Get attestations for a skill
const attestations = await client.getAttestations(skills[0].skillHash);

// Verify a ZK proof on-chain
const valid = await client.verify(skills[0].skillHash, 0);
console.log('Proof valid:', valid);

// Get skill metadata
const uri = await client.getMetadataURI(skills[0].skillHash);
```

## How to Use AEGIS

AEGIS is a **trust verification layer**, not a skill execution runtime. It answers the question: *"Has this AI agent skill been audited, and can I trust the audit?"*

### What AEGIS does

- Tells you if a skill has been audited (attestation exists)
- Verifies the ZK proof on-chain (is the audit legitimate?)
- Shows the audit level and how much ETH the auditor staked (skin in the game)

### What AEGIS does NOT do

- Execute or run skills
- Host skill code or definitions
- Provide APIs for the skills themselves

### Integration Pattern (Manual)

If you're building an agent that wants to run a third-party skill safely:

```typescript
import { AegisClient } from '@aegisaudit/sdk';

const aegis = new AegisClient({ chainId: 84532 });

// 1. Look up the skill on the registry
const skills = await aegis.listAllSkills();
const skill = skills.find(s => s.skillHash === TARGET_SKILL_HASH);

if (!skill) {
  throw new Error('Skill not registered on AEGIS — no audit exists');
}

// 2. Check the attestation
const attestations = await aegis.getAttestations(skill.skillHash);
const att = attestations[0];

console.log(`Audit level: ${att.auditLevel}`);      // 1, 2, or 3
console.log(`Auditor stake: ${att.stakeAmount} wei`); // ETH at risk

// 3. Verify the ZK proof on-chain
const proofValid = await aegis.verify(skill.skillHash, 0);

if (!proofValid) {
  throw new Error('ZK proof verification failed — do not trust this audit');
}

// 4. Now you can trust the audit → go execute the skill
//    Get the skill code from the skill publisher (not from AEGIS)
//    e.g., fetch from the publisher's API, npm package, or IPFS
```

### Integration Pattern (Middleware — Recommended)

For production agents, use `@aegisaudit/consumer-middleware` to **automatically** gate every tool call. It intercepts tool execution, checks AEGIS trust, and blocks untrusted tools — no manual verification code needed.

```bash
npm install @aegisaudit/consumer-middleware
```

```typescript
import { TrustGate } from '@aegisaudit/consumer-middleware';
import { createAegisTrustHandler } from '@aegisaudit/consumer-middleware/langchain';

const gate = new TrustGate({
  policy: {
    minAuditLevel: 2,      // Require L2+ audits
    blockOnDispute: true,   // Block disputed skills
    mode: 'enforce',        // Hard block on failure
  },
  skills: [
    { toolName: 'web_search', skillHash: '0x...' },
  ],
});

// LangChain: attach as a callback
const agent = new AgentExecutor({
  callbacks: [createAegisTrustHandler(gate)],
});

// Also supports CrewAI, MCP, and custom agent loops.
```

See the [consumer middleware documentation](https://www.npmjs.com/package/@aegisaudit/consumer-middleware) for full setup guides for every framework.

### Audit Levels

| Level | Meaning |
|---|---|
| 1 | Basic — code review only |
| 2 | Standard — code review + input validation |
| 3 | Comprehensive — full security audit with fuzzing |

Higher level = more thorough audit. The auditor's staked ETH gets slashed if the audit is disputed and found fraudulent.

## API Reference

### `new AegisClient(config)`

Create a client instance.

```typescript
const client = new AegisClient({
  chainId: 84532,           // Base Sepolia (default registry auto-resolved)
  rpcUrl: 'https://...',    // Optional custom RPC
  registryAddress: '0x...',  // Optional override
});
```

### Read Operations

These work without a wallet.

| Method | Description |
|---|---|
| `listAllSkills(options?)` | List all registered skills from on-chain events |
| `listAllAuditors(options?)` | List all registered auditors |
| `getAttestations(skillHash)` | Get all attestations for a specific skill |
| `verify(skillHash, index)` | Verify an attestation's ZK proof on-chain |
| `getAuditorReputation(commitment)` | Get an auditor's reputation data |
| `getMetadataURI(skillHash)` | Get the metadata URI for a skill |
| `listDisputes(options?)` | List opened disputes |
| `listResolvedDisputes(options?)` | List resolved disputes |

### Write Operations

These require a wallet via `client.setWallet(walletClient)`.

| Method | Description |
|---|---|
| `registerSkill(params)` | Register a skill with a verified attestation |
| `registerAuditor(commitment, stake)` | Register as an auditor by staking ETH |
| `addStake(commitment, amount)` | Add stake to an existing auditor registration |
| `openDispute(skillHash, index, evidence, bond)` | Dispute a skill attestation |

### Prover

Generate ZK attestation proofs locally.

```typescript
import { generateAttestation, loadProofFromFiles } from '@aegisaudit/sdk';

// Generate a proof in-process (requires WASM)
const result = await generateAttestation({
  skillHash: '0x...',
  auditorSecret: '0x...',
  score: 85,
  metadataHash: '0x...',
});

// Or load a pre-generated proof from files
const proof = await loadProofFromFiles('./proof', './vkey');
```

### IPFS Metadata

```typescript
import { fetchMetadata, uploadMetadata } from '@aegisaudit/sdk';

const metadata = await fetchMetadata('ipfs://Qm...');
```

### Constants

```typescript
import {
  CHAIN_CONFIG,         // { base, baseSepolia } chain configs
  REGISTRY_ADDRESSES,   // Registry contract addresses per chain
  DEPLOYMENT_BLOCKS,    // Block numbers for event scanning
  MIN_AUDITOR_STAKE,    // 0.01 ETH
  MIN_DISPUTE_BOND,     // 0.005 ETH
  REGISTRATION_FEE,     // 0.001 ETH
} from '@aegisaudit/sdk';
```

## Configuration

The `AegisConfig` type:

```typescript
interface AegisConfig {
  chainId: number;           // 84532 (Base Sepolia) or 8453 (Base)
  rpcUrl?: string;           // Custom RPC URL (defaults to public RPC)
  registryAddress?: Address; // Override registry address
}
```

## Links

- [AEGIS Protocol](https://aegisprotocol.tech)
- [GitHub](https://github.com/aegisaudit/aegis)
- [MCP Server](https://www.npmjs.com/package/@aegisaudit/mcp-server)

## License

MIT
