# @aegisaudit/consumer-middleware

[![npm](https://img.shields.io/npm/v/@aegisaudit/consumer-middleware?color=FF3366)](https://www.npmjs.com/package/@aegisaudit/consumer-middleware)
[![license](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)

Pre-execution trust gate for AI agent tool calls. Verifies AEGIS on-chain skill attestations **before** your agent runs any tool — blocking untrusted, unaudited, or disputed skills automatically.

## Why Use This

When your AI agent calls third-party tools or skills, you have no guarantee they've been security-audited. The AEGIS consumer middleware solves this by:

1. **Intercepting** every tool call before execution
2. **Querying** the AEGIS on-chain registry for audit attestations
3. **Enforcing** your trust policy (minimum audit level, attestation count, dispute status)
4. **Blocking** tools that don't meet your requirements

This works with any framework: LangChain, CrewAI, MCP, or your own custom agent loop.

## Install

```bash
npm install @aegisaudit/consumer-middleware
```

The middleware depends on `@aegisaudit/sdk` (installed automatically).

## Quick Start

### 1. Map Your Tools to AEGIS Skill Hashes

Every tool your agent uses corresponds to an AEGIS skill hash — a `bytes32` identifier derived from the tool's source code (`keccak256(sourceCode)`). You can look up skill hashes via the AEGIS MCP server, the subgraph, or the SDK.

```typescript
import { TrustGate } from '@aegisaudit/consumer-middleware';

const gate = new TrustGate({
  // Define your trust requirements
  policy: {
    minAuditLevel: 2,      // Require at least L2 (Robust) audit
    minAttestations: 1,     // At least 1 verified attestation
    blockOnDispute: true,   // Block skills with unresolved disputes
    mode: 'enforce',        // Block execution on failure
  },

  // Map tool names to AEGIS skill hashes
  skills: [
    { toolName: 'web_search',    skillHash: '0x1a2b3c...' },
    { toolName: 'code_executor', skillHash: '0x4d5e6f...' },
    { toolName: 'file_reader',   skillHash: '0x7a8b9c...' },
  ],
});
```

### 2. Check Trust Before Execution

```typescript
const result = await gate.check('web_search');

if (result.allowed) {
  // Safe to execute
  console.log('Trust verified:', result.trustData);
} else {
  // Blocked by policy
  console.error('Blocked:', result.reason);
  // e.g. "Audit level 1 < required 2"
  // e.g. "Skill has unresolved disputes"
  // e.g. "Skill not found in AEGIS registry"
}
```

### 3. Or Use a Framework Adapter (Recommended)

Framework adapters handle the interception automatically — no manual `check()` calls needed.

## Framework Integration

### LangChain

```typescript
import { TrustGate } from '@aegisaudit/consumer-middleware';
import { createAegisTrustHandler } from '@aegisaudit/consumer-middleware/langchain';
import { AgentExecutor } from 'langchain/agents';

// Create the trust gate
const gate = new TrustGate({
  policy: { minAuditLevel: 2, blockOnDispute: true },
  skills: [
    { toolName: 'web_search', skillHash: '0x...' },
  ],
});

// Create the LangChain callback handler
const trustHandler = createAegisTrustHandler(gate);

// Attach to your agent — every tool call is now trust-gated
const agent = new AgentExecutor({
  agent: yourAgent,
  tools: yourTools,
  callbacks: [trustHandler],
});

// When the agent tries to call 'web_search':
//   - If the skill passes the policy → tool executes normally
//   - If it fails → AegisTrustError is thrown, tool never runs
```

### CrewAI

```typescript
import { TrustGate } from '@aegisaudit/consumer-middleware';
import { createAegisTrustHook } from '@aegisaudit/consumer-middleware/crewai';

const gate = new TrustGate({
  policy: { minAuditLevel: 1, minAttestations: 2 },
  skills: [
    { toolName: 'search_tool', skillHash: '0x...' },
    { toolName: 'scrape_tool', skillHash: '0x...' },
  ],
});

// Register as a before-tool-call hook
const trustHook = createAegisTrustHook(gate);
crew.registerBeforeToolCallHook(trustHook);

// All tool calls are now verified against AEGIS before execution
```

### MCP (Model Context Protocol)

For MCP servers built with `@modelcontextprotocol/sdk`:

```typescript
import { TrustGate } from '@aegisaudit/consumer-middleware';
import { aegisMcpMiddleware } from '@aegisaudit/consumer-middleware/mcp';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const gate = new TrustGate({
  policy: { minAuditLevel: 2, mode: 'enforce' },
  skills: [
    { toolName: 'query-database', skillHash: '0x...' },
    { toolName: 'send-email',     skillHash: '0x...' },
  ],
});

// Wrap your tool call handler with the trust gate
server.setRequestHandler(
  CallToolRequestSchema,
  aegisMcpMiddleware(gate, async (request) => {
    // This only runs if the trust check passes
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'query-database':
        return { content: [{ type: 'text', text: await queryDb(args) }] };
      case 'send-email':
        return { content: [{ type: 'text', text: await sendEmail(args) }] };
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  })
);

// When a tool call comes in:
//   1. Middleware checks AEGIS trust for the tool
//   2. If trusted → your handler executes
//   3. If untrusted → returns an error result, handler never runs
```

#### Connecting to the AEGIS MCP Server

If your agent connects to the AEGIS MCP server (`@aegisaudit/mcp-server`), you can use the MCP tools to discover skill hashes, then configure the middleware:

```typescript
// Step 1: Use the AEGIS MCP tools to discover skills
// Ask your agent: "Use list-all-skills to find registered skills"
// Or query programmatically via the SDK:

import { AegisClient } from '@aegisaudit/sdk';

const aegis = new AegisClient({ chainId: 8453 }); // Base mainnet
const skills = await aegis.listAllSkills();

// Step 2: Map the discovered skill hashes to your tool names
const gate = new TrustGate({
  policy: { minAuditLevel: 2, blockOnDispute: true },
  skills: skills.map(s => ({
    toolName: myToolNameFor(s.skillHash), // your mapping logic
    skillHash: s.skillHash,
  })),
});

// Step 3: Wrap your MCP server
server.setRequestHandler(CallToolRequestSchema,
  aegisMcpMiddleware(gate, originalHandler)
);
```

## Custom Agent Loop

If you're not using a framework, call the gate directly in your execution loop:

```typescript
import { TrustGate, AegisTrustError } from '@aegisaudit/consumer-middleware';

const gate = new TrustGate({
  policy: { minAuditLevel: 2, mode: 'enforce' },
  skills: [
    { toolName: 'web_search', skillHash: '0x...' },
  ],
});

// In your agent's tool execution loop:
async function executeTool(toolName: string, args: unknown) {
  // Trust check — throws AegisTrustError in enforce mode
  const result = await gate.check(toolName);
  if (!result.allowed) {
    throw new AegisTrustError(result);
  }

  // Tool is trusted, execute it
  return runTool(toolName, args);
}
```

## Finding Skill Hashes

You need AEGIS skill hashes to configure the middleware. Here's how to find them:

### Via the AEGIS MCP Server

If you have the AEGIS MCP server connected, ask your AI agent:

> "Use `list-all-skills` to show me all registered skills"

> "Use `get-attestations` to check the audit status of skill `0x...`"

### Via the Subgraph (GraphQL)

Query the deployed AEGIS subgraph directly:

```graphql
# Find all audited skills
{
  skills(where: { attestationCount_gt: 0 }, orderBy: attestationCount, orderDirection: desc) {
    id          # This is the skillHash
    skillName
    category
    attestationCount
    attestations(where: { revoked: false }) {
      auditLevel
      auditor {
        reputationScore
      }
    }
  }
}
```

Endpoint: `https://api.studio.thegraph.com/query/1743315/aegis-protocol/v0.1.0`

### Via the SDK

```typescript
import { AegisClient } from '@aegisaudit/sdk';

const client = new AegisClient({ chainId: 8453 });
const skills = await client.listAllSkills();

for (const skill of skills) {
  console.log(`${skill.skillHash} — Level ${skill.auditLevel}`);
}
```

### Computing a Skill Hash

If you know the tool's source code, the skill hash is `keccak256(sourceCode)`:

```typescript
import { keccak256, toBytes } from 'viem';

const sourceCode = fs.readFileSync('./my-tool.ts', 'utf-8');
const skillHash = keccak256(toBytes(sourceCode));
```

## Configuration Reference

### `TrustPolicy`

| Field | Type | Default | Description |
|---|---|---|---|
| `minAuditLevel` | `1 \| 2 \| 3` | `1` | Minimum audit level. 1=Functional, 2=Robust, 3=Security |
| `minAttestations` | `number` | `1` | Minimum number of non-revoked attestations |
| `blockOnDispute` | `boolean` | `true` | Block skills with unresolved disputes |
| `mode` | `string` | `'enforce'` | `'enforce'` = block, `'warn'` = log + allow, `'log'` = silent |

### `TrustGateConfig`

| Field | Type | Default | Description |
|---|---|---|---|
| `policy` | `TrustPolicy` | *required* | Trust requirements |
| `skills` | `SkillMapping[]` | *required* | Tool name → skill hash mappings |
| `subgraphUrl` | `string` | AEGIS Studio endpoint | Subgraph GraphQL URL |
| `sdkConfig` | `AegisConfig` | Base mainnet | On-chain fallback config |
| `cacheTtlMs` | `number` | `60000` | Cache TTL in ms (0 to disable) |
| `onBlock` | `function` | — | Callback when a tool is blocked |
| `onWarn` | `function` | — | Callback when a warning is issued |

### `TrustGateResult`

```typescript
interface TrustGateResult {
  toolName: string;           // Tool that was checked
  skillHash: Hex;             // AEGIS skill hash
  allowed: boolean;           // Whether execution is allowed
  reason?: string;            // Why it was blocked (if blocked)
  trustData?: {
    highestLevel: number;     // Best audit level (1-3)
    attestationCount: number; // Number of valid attestations
    hasActiveDisputes: boolean;
  };
}
```

## Enforcement Modes

### `enforce` (default)

Blocks execution. Framework adapters throw `AegisTrustError`, the MCP adapter returns an error result.

```typescript
const gate = new TrustGate({
  policy: { mode: 'enforce', minAuditLevel: 2 },
  skills: [...],
  onBlock: (result) => {
    console.error(`Blocked ${result.toolName}: ${result.reason}`);
    // Send to monitoring, log to audit trail, etc.
  },
});
```

### `warn`

Logs a warning but allows execution. Use this to monitor trust status before enforcing.

```typescript
const gate = new TrustGate({
  policy: { mode: 'warn', minAuditLevel: 2 },
  skills: [...],
  onWarn: (result) => {
    console.warn(`Trust warning for ${result.toolName}: ${result.reason}`);
  },
});
```

### `log`

Silently allows everything. Use this for development or monitoring-only deployments.

## Data Sources

The middleware queries trust data from two sources with automatic fallback:

1. **Subgraph (primary)** — Fast GraphQL query against The Graph's decentralized indexer. This is the default and recommended data source.

2. **On-chain (fallback)** — Direct RPC calls via the `@aegisaudit/sdk`. Activated automatically if the subgraph is unavailable or returns no data.

Results are cached for 60 seconds by default (configurable via `cacheTtlMs`).

### Custom Subgraph URL

```typescript
const gate = new TrustGate({
  policy: { ... },
  skills: [...],
  subgraphUrl: 'https://your-custom-subgraph-endpoint.com/subgraphs/name/aegis',
});
```

### Custom On-chain Config

```typescript
const gate = new TrustGate({
  policy: { ... },
  skills: [...],
  sdkConfig: {
    chainId: 84532,  // Base Sepolia testnet
    rpcUrl: 'https://your-rpc.com',
  },
});
```

## Unmapped Tools

Tools without a skill mapping are **always allowed**. This means you only need to map the tools you want to gate — internal or trusted tools can be left unmapped.

```typescript
const gate = new TrustGate({
  policy: { minAuditLevel: 2 },
  skills: [
    { toolName: 'web_search', skillHash: '0x...' },
    // 'calculator' is not mapped → always allowed
  ],
});

await gate.check('web_search');  // → checks AEGIS
await gate.check('calculator');  // → allowed (no mapping)
```

## Runtime Policy Updates

You can change the policy at runtime without recreating the gate:

```typescript
// Start permissive
const gate = new TrustGate({
  policy: { mode: 'warn', minAuditLevel: 1 },
  skills: [...],
});

// Tighten later
gate.updatePolicy({ mode: 'enforce', minAuditLevel: 3 });

// Clear cached trust data after policy change
gate.clearCache();
```

## Error Handling

The `AegisTrustError` class extends `Error` and includes the full `TrustGateResult`:

```typescript
import { AegisTrustError } from '@aegisaudit/consumer-middleware';

try {
  await gate.check('untrusted_tool');
} catch (err) {
  if (err instanceof AegisTrustError) {
    console.log(err.result.toolName);   // 'untrusted_tool'
    console.log(err.result.reason);     // 'Audit level 1 < required 2'
    console.log(err.result.trustData);  // { highestLevel: 1, attestationCount: 1, ... }
  }
}
```

## End-to-End Example: Agent with AEGIS MCP + Trust Gate

This example shows a complete setup where an agent connects to the AEGIS MCP server for discovery and uses the middleware for runtime trust enforcement:

```typescript
import { AegisClient } from '@aegisaudit/sdk';
import { TrustGate } from '@aegisaudit/consumer-middleware';
import { createAegisTrustHandler } from '@aegisaudit/consumer-middleware/langchain';

// 1. Discover available audited skills from AEGIS
const aegis = new AegisClient({ chainId: 8453 });
const registeredSkills = await aegis.listAllSkills();

// 2. Match your agent's tools to AEGIS-registered skills
const toolSkillMap = [
  { toolName: 'web_search',    skillHash: '0x1a2b...' },
  { toolName: 'code_executor', skillHash: '0x3c4d...' },
];

// 3. Create a trust gate with your security policy
const gate = new TrustGate({
  policy: {
    minAuditLevel: 2,      // Only allow L2+ audited tools
    minAttestations: 1,     // Require at least 1 attestation
    blockOnDispute: true,   // Don't run disputed tools
    mode: 'enforce',        // Hard block on failure
  },
  skills: toolSkillMap,
  onBlock: (result) => {
    // Log blocked attempts for monitoring
    console.warn(`[AEGIS] Blocked tool "${result.toolName}": ${result.reason}`);
  },
});

// 4. Attach to your LangChain agent
const agent = new AgentExecutor({
  agent: myAgent,
  tools: myTools,
  callbacks: [createAegisTrustHandler(gate)],
});

// 5. Run the agent — untrusted tools are automatically blocked
const response = await agent.invoke({ input: 'Search for the latest news' });
```

## AEGIS Audit Levels

| Level | Name | What It Means |
|---|---|---|
| 1 | Functional | Automated security scan — basic code review |
| 2 | Robust | Static + dynamic analysis — thorough automated audit |
| 3 | Security | Full manual audit with fuzzing — highest assurance |

Higher levels require more auditor stake (ETH at risk), providing stronger economic guarantees. If an audit is found fraudulent via the dispute system, the auditor's stake is slashed.

## Links

- [AEGIS Protocol](https://aegisprotocol.tech)
- [SDK Documentation](https://www.npmjs.com/package/@aegisaudit/sdk)
- [MCP Server](https://www.npmjs.com/package/@aegisaudit/mcp-server)
- [GitHub](https://github.com/aegis-zk/aegisprotocol)

## License

MIT
