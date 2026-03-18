# AEGIS Protocol — Project Context

Last updated: 2026-03-18

This document captures the full state of the AEGIS Protocol project for continuity across context windows.

## What is AEGIS

On-chain zero-knowledge skill attestation protocol for AI agents on Base L2. Auditors evaluate AI agent skills, generate ZK proofs, and submit attestations on-chain. AEGIS is a **trust verification layer** — it does not execute skills.

## Deployed Infrastructure

| Resource | Location |
|---|---|
| Website | https://aegisprotocol.tech |
| Vercel project | `jadebroccoli-2626s-projects/dist` (deploy from `apps/web/dist`) |
| GitHub | https://github.com/aegis-zk/aegisprotocol |
| npm SDK | https://www.npmjs.com/package/@aegisaudit/sdk (v0.7.0 — includes MCP server) |
| npm MCP Server | https://www.npmjs.com/package/@aegisaudit/mcp-server (deprecated — merged into SDK) |
| npm Consumer Middleware | https://www.npmjs.com/package/@aegisaudit/consumer-middleware (v0.1.0) |
| AegisRegistry (mainnet v4) | `0xEFF449364D8f064e6dBCF0f0e0aD030D7E489cCd` (Base, block 42983389) |
| AegisRegistry (mainnet v3, deprecated) | `0xa0FF1563Ab7d5d514146F2713125098954Af1F61` (Base, block 42942701) |
| AegisRegistry (mainnet v2, deprecated) | `0x2E993439E0241b220BF12652897342054202f57C` (Base) |
| AegisRegistry (mainnet v1, deprecated) | `0xBED52D8CEe2690900e21e5ffcb988DFF728D7E1D` (Base) |
| HonkVerifier (mainnet) | `0xefc302c44579ccd362943D696dD71c8EdBCa5Ff7` (Base) |
| AegisRegistry (testnet, deprecated) | `0x851CfbB116aBdd50Ab899c35680eBd8273dD6Bba` (Base Sepolia — removed in v0.6.0) |
| HonkVerifier (testnet, deprecated) | `0x6c58dE61157AA10E62174c37DFBe63094e334cE6` (Base Sepolia — removed in v0.6.0) |
| Deployer wallet (mainnet) | `0x20bABe2d87B225445C4398029DFfE9DfEF275170` |
| Scout bot wallet | `0x4145aF7351Cbc65e3B031C081bfD5377D18E31ad` (fee-exempt on v4) |
| Skills listed | Live — scout bot actively populating v4 contract |
| Indexer | `@aegisaudit/indexer@0.1.0` (local, port 4200) |
| Subgraph (Studio) | https://thegraph.com/studio/subgraph/aegis-protocol |
| Subgraph GraphQL | `https://api.studio.thegraph.com/query/1743315/aegis-protocol/v0.3.0` |

## Git Identity

- Author: `AEGIS <aegis@aegisprotocol.tech>`
- Git config is set locally in repo (`git config user.name "AEGIS"` / `git config user.email "aegis@aegisprotocol.tech"`)
- History was rewritten and repo recreated to remove old identity — do NOT amend old commits
- GitHub PAT for aegis-zk account is stored in remote URL

## Monorepo Structure

```
aegis/
├── packages/
│   ├── sdk/            # @aegisaudit/sdk@0.7.0 — SDK + MCP server + ZK prover (tsup, ESM+CJS)
│   ├── mcp-server/     # (deprecated — merged into sdk in v0.7.0)
│   ├── indexer/        # @aegisaudit/indexer@0.1.0 — Event indexer + REST API (Hono, sql.js)
│   ├── subgraph/       # @aegisaudit/subgraph@0.3.0 — The Graph subgraph (Base L2, AssemblyScript)
│   ├── consumer-middleware/ # @aegisaudit/consumer-middleware@0.1.0 — Pre-execution trust gate (tsup, ESM+CJS)
│   ├── audit-queue/    # @aegisaudit/audit-queue@0.2.0 — Automated audit pipeline (bounty-aware, race-safe)
│   ├── agents/         # Agent playbooks — auditor + dispute agent templates (markdown + JSON examples)
│   ├── contracts/      # AegisRegistry.sol — Foundry (forge)
│   ├── circuits/       # Noir ZK circuits (Barretenberg/BB.js)
│   └── cli/            # @aegis/cli — command-line tool (commander, chalk, ora)
├── apps/
│   └── web/            # Frontend — React 19 + Vite 6 + Three.js + wagmi
├── files/              # Brand assets (logos, banners)
├── metadata/           # OG/Twitter meta card images
├── README.md           # Root README with how-to-use guide
└── Aegis.md            # This file
```

## Build & Deploy Patterns

```bash
# Full monorepo build
pnpm build   # uses turborepo

# Build individual packages
cd packages/sdk && pnpm build
cd packages/indexer && pnpm build
cd apps/web && pnpm build

# Deploy to Vercel (from pre-built dist)
npx vercel --cwd "C:/Projects/Aegis/apps/web/dist" --prod --yes

# Publish to npm (SDK includes MCP server)
cd packages/sdk && npm publish --access public

# Run indexer locally
cd packages/indexer && pnpm start  # http://localhost:4200

# Deploy contracts (registry only, reuses existing verifier)
cd packages/contracts
VERIFIER_ADDRESS=0xefc302c44579ccd362943D696dD71c8EdBCa5Ff7 forge script script/Deploy.s.sol:DeployRegistryOnly --rpc-url base --broadcast --verify
```

## Package Versions (current)

| Package | Version |
|---|---|
| @aegisaudit/sdk | 0.7.0 (includes MCP server) |
| @aegisaudit/mcp-server | deprecated (merged into SDK) |
| @aegisaudit/indexer | 0.1.0 |
| @aegisaudit/subgraph | 0.3.0 |
| @aegisaudit/consumer-middleware | 0.1.0 |
| @aegisaudit/audit-queue | 0.2.0 |
| @aegis/web | 0.0.1 (private) |

When bumping versions:
- Update `package.json` version field
- For SDK: also update `version` string in `src/mcp/server.ts` (McpServer constructor)
- For SDK: tsup `onSuccess` hook copies `../circuits/target/attestation.json` to `dist/` — ensure circuit artifact exists before build
- Publish with `npm publish --access public`
- Commit the version bump

## Contract (AegisRegistry v4)

### Functions

**Skill Listing:**
- `listSkill(bytes32 skillHash, string metadataURI)` — 0.001 ETH fee
- `getSkillListing(bytes32 skillHash)` → SkillListing

**Attestation:**
- `registerSkill(bytes32 skillHash, string metadataURI, bytes attestationProof, bytes32[] publicInputs, bytes32 auditorCommitment, uint8 auditLevel, address bountyRecipient)` — 0.001 ETH fee
- `getAttestations(bytes32 skillHash)` → Attestation[]
- `verifyAttestation(bytes32 skillHash, uint256 attestationIndex)` → bool
- `isAttestationRevoked(bytes32 skillHash, uint256 attestationIndex)` → bool
- `revokeAttestation(bytes32 skillHash, uint256 attestationIndex)` — owner only

**Auditor:**
- `registerAuditor(bytes32 auditorCommitment)` — min 0.01 ETH stake (5% protocol fee)
- `addStake(bytes32 auditorCommitment)` — 5% protocol fee
- `getAuditorReputation(bytes32 auditorCommitment)` → (score, totalStake, attestationCount)
- `initiateUnstake(bytes32 auditorCommitment, uint256 amount)` — 3-day cooldown
- `completeUnstake(bytes32 auditorCommitment)`
- `cancelUnstake(bytes32 auditorCommitment)`

**Disputes:**
- `openDispute(bytes32 skillHash, uint256 attestationIndex, bytes evidence)` — min 0.005 ETH bond
- `resolveDispute(uint256 disputeId, bool auditorFault)` — owner only
- `getDispute(uint256 disputeId)` → (skillHash, attestationIndex, evidence, challenger, bond, resolved, auditorFault)
- `getActiveDisputeCount(bytes32 auditorCommitment)` → uint256
- `getDisputeCount()` → uint256

**Bounties:**
- `postBounty(bytes32 skillHash, uint8 requiredLevel)` — min 0.001 ETH, 30-day expiry
- `reclaimBounty(bytes32 skillHash)` — after expiry
- `getBounty(bytes32 skillHash)` → Bounty

**Owner:**
- `withdrawProtocolBalance(address to)` — withdraw accumulated fees
- `setFeeExempt(address account, bool exempt)` — whitelist addresses from listing/registration fees
- `transferOwnership(address newOwner)`

**Fee Exemption (v4):**
- `feeExempt(address)` → bool — check if an address is exempt from fees
- Exempt addresses can call `listSkill()` and `registerSkill()` with `msg.value = 0`

### Events

```
SkillListed(bytes32 indexed skillHash, address indexed publisher, string metadataURI)
SkillRegistered(bytes32 indexed skillHash, uint8 auditLevel, bytes32 auditorCommitment)
AuditorRegistered(bytes32 indexed auditorCommitment, uint256 stake)
StakeAdded(bytes32 indexed auditorCommitment, uint256 amount, uint256 totalStake)
DisputeOpened(uint256 indexed disputeId, bytes32 indexed skillHash)
DisputeResolved(uint256 indexed disputeId, bool auditorSlashed)
AttestationRevoked(bytes32 indexed skillHash, uint256 attestationIndex, bytes32 indexed auditorCommitment)
BountyPosted(bytes32 indexed skillHash, uint256 amount, uint8 requiredLevel, uint256 expiresAt)
BountyClaimed(bytes32 indexed skillHash, address indexed recipient, uint256 auditorPayout, uint256 protocolFee)
BountyReclaimed(bytes32 indexed skillHash, address indexed publisher, uint256 amount)
UnstakeInitiated(bytes32 indexed auditorCommitment, uint256 amount, uint256 unlockTimestamp)
UnstakeCompleted(bytes32 indexed auditorCommitment, uint256 amount)
UnstakeCancelled(bytes32 indexed auditorCommitment, uint256 amount)
```

### Constants

| Constant | Value |
|---|---|
| MIN_AUDITOR_STAKE | 0.01 ETH |
| MIN_DISPUTE_BOND | 0.005 ETH |
| REGISTRATION_FEE | 0.001 ETH |
| LISTING_FEE | 0.001 ETH |
| MIN_BOUNTY | 0.001 ETH |
| PROTOCOL_FEE_BPS | 500 (5%) |
| UNSTAKE_COOLDOWN | 3 days |
| BOUNTY_EXPIRATION | 30 days |

## Indexer (packages/indexer)

REST API on port 4200, backed by SQLite (sql.js WASM):

| Endpoint | Description |
|---|---|
| `GET /` | Service info + endpoint list |
| `GET /skills` | All listed skills, newest first |
| `GET /skills/by-category` | Skills grouped by category |
| `GET /skills/unaudited` | Skills with no valid attestations |
| `GET /skills/:hash` | Single skill with attestations + disputes |
| `GET /auditors/leaderboard` | Auditors ranked by reputation score |
| `GET /auditors/:commitment` | Single auditor profile + attestation history |
| `GET /disputes/open` | Unresolved disputes |
| `GET /disputes/:id` | Single dispute by ID |
| `GET /bounties/open` | Active bounties sorted by reward |
| `GET /stats` | Protocol-wide statistics |
| `GET /stats/events` | Recent raw event log |

Config via env vars: `PORT`, `CHAIN_ID`, `RPC_URL`, `DB_PATH`, `POLL_INTERVAL_MS`

### Docker Deployment (VPS)

```bash
cd packages/indexer

# Build and run with docker-compose
docker compose up -d --build

# Or build standalone
docker build -t aegis-indexer -f Dockerfile ../../
docker run -d --name aegis-indexer -p 4200:4200 -v aegis-data:/data aegis-indexer
```

SQLite DB is persisted in a Docker volume at `/data/aegis-indexer.db`.

## Subgraph (packages/subgraph)

Decentralized indexer on The Graph for Base L2. Primary data source for the protocol.

### Entities

| Entity | ID | Description |
|---|---|---|
| Skill | bytes32 skillHash | Listed skills with parsed name + category |
| Attestation | skillHash-index | Audit attestations per skill |
| Auditor | bytes32 commitment | Auditor profiles with weighted reputation score, L2/L3 counts, decay |
| Dispute | disputeId | Opened/resolved disputes |
| Bounty | bytes32 skillHash | Active bounties per skill |
| UnstakeRequest | bytes32 commitment | Pending unstake requests |
| ProtocolEvent | txHash-logIndex | Immutable event log |
| ProtocolStats | "singleton" | Protocol-wide counters |

### Key GraphQL Queries

```graphql
# Skills by category
{ skills(orderBy: category) { skillName category attestationCount } }

# Unaudited skills
{ skills(where: { attestationCount: 0 }) { id skillName metadataURI } }

# Auditor leaderboard
{ auditors(orderBy: reputationScore, orderDirection: desc) { id currentStake attestationCount reputationScore } }

# Open disputes
{ disputes(where: { resolved: false }) { disputeId skill { skillName } challenger bond } }

# Open bounties
{ bounties(where: { claimed: false, reclaimed: false }, orderBy: amount, orderDirection: desc) { skill { skillName } amount requiredLevel } }

# Protocol stats
{ protocolStats(id: "singleton") { totalSkills totalAttestations totalAuditors openDisputes } }
```

### Build & Deploy

```bash
cd packages/subgraph
pnpm install && pnpm build     # codegen + compile WASM

# Deploy to The Graph Studio
graph auth --studio <DEPLOY_KEY>
npx graph deploy aegis-protocol -g https://api.studio.thegraph.com/deploy/ -l v0.3.0
```

### Reputation Formula (v0.3.0)

Weighted 7-factor scoring computed in AssemblyScript with ×1000 fixed-point precision:

```
base       = attestationCount × 10
levelBonus = l2Count × 5 + l3Count × 15
stake      = diminishing returns above 0.1 ETH (1e16 → 5e16 divisor)
tenure     = +1 per 30 days since registration (cap 12)
disputes   = disputesLost × 20
winRate    = 0.5× to 1.1× multiplier based on dispute win ratio
decay      = 90-day grace period, linear to 0.5× at 365 days of inactivity

final = (base + levelBonus + stake + tenure - disputes) × winRate × decay
```

Auditor entity fields: `reputationScore`, `attestationCount`, `currentStake`, `disputesWon`, `disputesLost`, `disputesInvolved`, `l2AttestationCount`, `l3AttestationCount`, `lastAttestationAt`, `timestamp`

### Metadata Parsing

Data URIs (`data:application/json;base64,...`) are decoded inline in AssemblyScript to extract `skillName` and `category`. IPFS/HTTP URIs fall back to "Unknown Skill" / "Uncategorized" (subgraph runtime cannot make HTTP requests).

## MCP Server (45 tools, bundled in SDK since v0.7.0)

- **Discovery**: aegis-info, wallet-status, generate-wallet
- **Read**: list-all-skills, list-all-auditors, get-attestations, verify-attestation, get-auditor-reputation, get-metadata-uri, list-disputes, list-resolved-disputes, get-unstake-request, get-bounty, create-agent-registration, get-erc8004-validation, get-dispute, get-active-dispute-count, get-dispute-count, is-attestation-revoked, get-auditor-profile
- **Trust**: query-trust-profile, query-skill-trust
- **ZK Proving**: generate-attestation-proof, generate-auditor-commitment
- **Subgraph**: check-skill, browse-unaudited, browse-bounties, audit-skill
- **Write** (need AEGIS_PRIVATE_KEY): register-auditor, add-stake, open-dispute, initiate-unstake, complete-unstake, cancel-unstake, post-bounty, reclaim-bounty, register-agent, request-erc8004-validation, respond-to-erc8004-validation, link-skill-to-agent, resolve-dispute, revoke-attestation
- **TAO/Bittensor**: tao-list-subnets, tao-browse-miners, tao-check-subnet

### New in v0.7.0 (2026-03-18)

**Package consolidation.** MCP server merged into `@aegisaudit/sdk`. Agents install one package: `npm install @aegisaudit/sdk`. The SDK provides both the library API and the MCP server binary (`aegis-mcp-server`). `@aegisaudit/mcp-server` is deprecated.

**Agent config updated.** MCP config now uses `npx -y @aegisaudit/sdk` instead of `npx -y @aegisaudit/mcp-server`. Setup command: `npx @aegisaudit/sdk setup`.

**New README.** Dead-simple agent-first README with MCP setup instructions first, library usage second.

### v0.6.0 changes (2026-03-17)

**Mainnet-only.** All testnet/Base Sepolia (chain 84532) references removed across the entire codebase. Default chain is 8453 (Base mainnet). Agents no longer get confused installing testnet tooling.

**Auto-wallet generation.** New `generate-wallet` tool creates a fresh wallet via `viem/accounts` (`generatePrivateKey()` + `privateKeyToAccount()`). Returns address, private key, config snippet, and next steps. Agents no longer need users to export MetaMask keys.

**Bundled prover dependencies.** `findBbBinary()` auto-detects the `bb` binary from `node_modules/@aztec/bb.js/build/{platform}/bb`, then falls back to PATH and `$HOME/.bb/bb`. `findCircuitArtifact()` finds the bundled `attestation.json` from SDK dist (copied via tsup `onSuccess` hook) or monorepo fallback. The `circuitsDir` parameter on `generateAttestationViaCLI()` is now optional.

**Wallet guide rewritten.** Option A (recommended) = call `generate-wallet` tool. Option B = provide existing private key. All faucet links and testnet references removed.

### v0.5.1 changes (preserved)

- **`generate-attestation-proof`** — Wraps `buildProverToml()` + `generateAttestationViaCLI()` from the SDK. Accepts circuit inputs (skillHash, criteriaHash, auditLevel, auditorCommitment, auditorPrivateKey) and returns proof hex + publicInputs for `registerSkill()`. Requires nargo 1.0.0-beta.18 + bb 3.0.0-nightly.20260102 in WSL on Windows.
- **`generate-auditor-commitment`** — Computes `pedersen_hash([auditorPrivateKey])` via a temporary Noir project. Returns the correct commitment for `registerAuditor()`. Warns that keccak256 will produce the wrong commitment.
- **`link-skill-to-agent`** — Updated with `ownerOf(agentId)` pre-check. Returns `NotAgentOwner` error with both addresses if wallet doesn't own the agent NFT.
- Structured error handling across attestation tools (`AttestationNotFound`, `AttestationIndexOutOfBounds`)
- `register-auditor` auto-adjusts stake to account for 5% protocol fee

## SDK (AegisClient) — v0.6.0

### v0.6.0 changes

- **Mainnet-only**: Removed `baseSepolia` chain config, `REGISTRY_ADDRESSES[84532]`, `DEPLOYMENT_BLOCKS[84532]`, all ERC-8004 testnet addresses
- **`findBbBinary()`**: Auto-detects bb from `node_modules/@aztec/bb.js/build/{arch}-{os}/bb` → PATH → `$HOME/.bb/bb`
- **`findCircuitArtifact(circuitsDir?)`**: Finds bundled `attestation.json` in SDK dist or monorepo
- **`generateAttestationViaCLI()`**: `circuitsDir` now optional — auto-resolves via `findCircuitArtifact()` and creates temp dir with bundled circuit
- **Circuit artifact bundling**: `attestation.json` (118KB) copied to SDK `dist/` via tsup `onSuccess` hook
- **Exports**: `findBbBinary`, `findCircuitArtifact` added to public API
- **Trust/x402**: Removed testnet facilitator URL conditionals, hardcoded `https://x402.org/facilitator` and `network: 'base'`

**Read:**
- `listAllSkills()`, `listAllAuditors()`, `getAttestations()`, `verify()`, `getAuditorReputation()`
- `getMetadataURI()`, `listDisputes()`, `listResolvedDisputes()`, `getUnstakeRequest()`
- `getBounty()`, `listBounties()`
- `getDispute()`, `getActiveDisputeCount()`, `getDisputeCount()`, `isAttestationRevoked()`
- `getAuditorProfile()` — aggregated auditor data

**Write:**
- `registerSkill()`, `registerAuditor()`, `addStake()`, `openDispute()`, `resolveDispute()`
- `initiateUnstake()`, `completeUnstake()`, `cancelUnstake()`
- `postBounty()`, `reclaimBounty()`, `revokeAttestation()`

**ERC-8004:** `registerAgent()`, `requestErc8004Validation()`, `respondToErc8004Validation()`, `linkSkillToAgent()`, etc.

**Trust:** `getTrustProfile()`, `getSkillTrustScore()`

## Consumer Middleware (packages/consumer-middleware)

Pre-execution trust gate that intercepts AI agent tool calls, queries AEGIS trust data, and enforces configurable policies before allowing execution.

### Core API

```typescript
import { TrustGate } from '@aegisaudit/consumer-middleware';

const gate = new TrustGate({
  policy: {
    minAuditLevel: 2,       // 1=Functional, 2=Robust, 3=Security
    minAttestations: 1,      // Minimum non-revoked attestations
    blockOnDispute: true,    // Block skills with unresolved disputes
    mode: 'enforce',         // 'enforce' | 'warn' | 'log'
  },
  skills: [
    { toolName: 'web_search', skillHash: '0x...' },
  ],
});

const result = await gate.check('web_search');
// result: { allowed, reason, trustData: { highestLevel, attestationCount, hasActiveDisputes } }
```

### Data Sources

1. **Subgraph (primary)** — GraphQL query to `https://api.studio.thegraph.com/query/1743315/aegis-protocol/v0.3.0`
2. **On-chain (fallback)** — `AegisClient.getSkillTrustScore()` via SDK RPC calls

Results cached for 60s by default (configurable via `cacheTtlMs`).

### Framework Adapters

| Adapter | Import Path | Integration Point |
|---|---|---|
| LangChain | `@aegisaudit/consumer-middleware/langchain` | `createAegisTrustHandler(gate)` → callback handler |
| CrewAI | `@aegisaudit/consumer-middleware/crewai` | `createAegisTrustHook(gate)` → before-tool-call hook |
| MCP | `@aegisaudit/consumer-middleware/mcp` | `aegisMcpMiddleware(gate, handler)` → tool call wrapper |

### Error Handling

`AegisTrustError` extends `Error` with a `result: TrustGateResult` property containing `toolName`, `skillHash`, `reason`, and `trustData`.

## Audit Queue (packages/audit-queue) v0.2.0

Automated audit pipeline: listens for on-chain events, queues skills, runs audit checklists, generates ZK proofs, and submits attestations. Designed for the "auditor agents race to claim bounties" model.

### Architecture

```
Event Listener → SQLite Queue → Audit Runner → ZK Prover → On-chain Submitter
     ↑                                                           ↓
     └── Competitor Detection (skip if already attested) ←───────┘
```

### Key Features (v0.2)

- **Bounty-aware prioritization** — Highest bounty tasks claimed first (not FIFO)
- **Competitor detection** — Monitors `SkillRegistered` events; skips tasks already attested by other auditors
- **Race-safe submission** — Pre-submission check via `checkAlreadyAttested()` to avoid wasted gas
- **L2/L3 static heuristics** — Real checks for type guards, schema validation, resource limits, adversarial patterns
- **Health endpoint** — `GET /health` (status + uptime) and `GET /stats` (queue metrics) on configurable port (default 9090)
- **Bounty claiming** — Passes `bountyRecipient` to `registerSkill()` when bounty exists

### Config (env vars)

| Variable | Description |
|---|---|
| `CHAIN_ID` | 8453 (Base mainnet only) |
| `RPC_URL` | RPC endpoint |
| `PRIVATE_KEY` | Auditor wallet private key |
| `AUDITOR_COMMITMENT` | Pedersen hash of private key |
| `DB_PATH` | SQLite database path |
| `HEALTH_PORT` | Health endpoint port (default 9090) |
| `MIN_BOUNTY_WEI` | Minimum bounty to pursue (optional) |

### Task States

`pending` → `in_progress` → `proving` → `submitting` → `completed`
                                                      → `failed`
                                                      → `skipped` (competitor attested first)

---

## v0.6.0 Agent Onboarding Flow (2026-03-17)

The v0.6.0 release eliminates the main friction points for AI agents:

```
Before (v0.5.x):                          After (v0.6.0):
1. Install MCP server                     1. Install MCP server
2. Defaults to testnet (84532)            2. Defaults to mainnet (8453)
3. Export MetaMask private key             3. Call generate-wallet tool
4. Edit JSON config manually               4. Send ~$0.50 ETH to address
5. Find & install nargo                    5. Call generate-attestation-proof
6. Find & install bb CLI                      (bb + circuit auto-resolved)
7. Find circuit files in monorepo
8. Pass circuitsDir to every proof call
```

**Key new SDK exports**: `findBbBinary()`, `findCircuitArtifact()`, `generatePrivateKey` (re-export from viem)

**Key new MCP tools**: `generate-wallet` (wallet creation), updated `wallet-status` (mentions generate-wallet)

**Files changed in v0.6.0** (~30 files across SDK, MCP server, CLI, web app, indexer, audit-queue):
- `packages/sdk/src/constants.ts` — Removed baseSepolia config
- `packages/sdk/src/registry.ts` — Removed baseSepolia from CHAINS
- `packages/sdk/src/prover.ts` — Added findBbBinary(), findCircuitArtifact(), optional circuitsDir
- `packages/sdk/src/erc8004-constants.ts` — Removed testnet addresses
- `packages/sdk/src/erc8004.ts` — Simplified error messages
- `packages/sdk/src/trust-server.ts` — Hardcoded mainnet facilitator
- `packages/sdk/src/x402.ts` — Hardcoded mainnet facilitator
- `packages/sdk/tsup.config.ts` — onSuccess hook copies attestation.json to dist
- `packages/mcp-server/src/tools/generate-wallet.ts` — NEW: wallet generation tool
- `packages/mcp-server/src/setup.ts` — Default chain 8453
- `packages/mcp-server/src/lib/client.ts` — Removed baseSepolia
- `packages/mcp-server/src/lib/wallet-guide.ts` — Rewritten for generate-wallet
- `packages/mcp-server/src/tools/*.ts` (16 files) — Default chain 8453
- `packages/cli/src/commands/*.ts` (5 files) — Default network 'base'
- `packages/cli/src/utils/config.ts` — Default network 'base'
- `apps/web/src/config.ts` — Removed 84532
- `apps/web/src/wagmi.ts` — Removed baseSepolia
- `apps/web/src/components/TxStatus.tsx` — Removed 84532 explorer
- `apps/web/src/pages/Developers.tsx` — Removed testnet references
- `apps/web/src/pages/Docs.tsx` — Removed testnet references

---

## Issues Resolution (v0.5.1 — 2026-03-17)

13 issues from onboarding test resolved. Full details in `ISSUES-RESOLVED.md`.

| # | Issue | Status |
|---|---|---|
| 1 | `list-all-skills` misses SkillListed events | Fixed — rewrote to query subgraph |
| 2 | npm package has stale registry address | Fixed — SDK/MCP bumped to 0.5.1 |
| 3 | No proof generation MCP tool | Fixed — new `generate-attestation-proof` tool |
| 4 | `register-auditor` rejects 0.01 ETH | Fixed — auto-adjusts for 5% fee |
| 5 | bb.js version compatibility unclear | Fixed — explicit version requirements in tool descriptions |
| 6 | On-chain verifier VK mismatch (20 vs 4 inputs) | **False alarm** — verifier works correctly (20 - 16 pairing points = 4 user inputs) |
| 7 | Auditor commitment must be Pedersen hash | Fixed — new `generate-auditor-commitment` tool |
| 8 | `is-attestation-revoked` false for non-existent | Fixed — existence check added |
| 9 | ERC-8004 ValidationRegistry not on mainnet | Fixed — conditional warning added |
| 10 | Inconsistent error handling across tools | Fixed — structured errors (`AttestationNotFound`, `AttestationIndexOutOfBounds`) |
| 11 | Subgraph doesn't index bounties | **False alarm** — subgraph working correctly (283 skills, 1 active bounty) |
| 12 | `query-trust-profile` crashes on mainnet | Fixed — graceful fallback to AEGIS-only data |
| 13 | `link-skill-to-agent` "Not authorized" | Fixed — `ownerOf(agentId)` pre-check (no roles on IdentityRegistry) |

### Key Findings

- **Verifier (Issue #6)**: The deployed HonkVerifier at `0xefc3...` is identical to regenerated source. `NUMBER_OF_PUBLIC_INPUTS = 20` includes `PAIRING_POINTS_SIZE = 16` subtracted internally, so `verify(proof, publicInputs)` expects exactly 4 user-supplied inputs. Fresh proof verified successfully on mainnet via Forge script.
- **Subgraph (Issue #11)**: Live subgraph v0.2.0 is synced and correctly indexes all bounty events. Tester likely queried wrong version.
- **IdentityRegistry (Issue #13)**: Uses `ownerOf(agentId)` for `setMetadata()` authorization — no AccessControl roles exist. Even contract owner gets "Not authorized" unless they hold the NFT.

---

## Website Pages

All pages in `apps/web/src/pages/`:

| Page | File | Key Features |
|---|---|---|
| Landing | `Landing.tsx` | Three.js hero, animated stats, feature grid, CTA |
| DApp | `DAppPage.tsx` | Verify Skill, Register Auditor, Submit Skill, Auditor Status tabs |
| Registry | `Registry.tsx` | Live on-chain skills (30s auto-refresh), detail panel, BaseScan links |
| Dashboard | `Dashboard.tsx` | Protocol stats, activity feed, top auditors (subgraph-powered) |
| Auditors | `Auditors.tsx` | Info tab + Leaderboard tab with search/filter/pagination, min-stake tier gating |
| Auditor Profile | `AuditorProfile.tsx` | Stats, tier progress, attestation history, dispute history, reputation breakdown (7-factor), stake-cap warning |
| Bounties | `Bounties.tsx` | Bounty board: stats, filters, post form, reclaim, subgraph-powered |
| Developers | `Developers.tsx` | SDK docs, code examples, API reference |
| Docs | `Docs.tsx` | Protocol documentation, architecture diagrams |

### Design System

```
ACCENT = "#FF3366"    ACCENT2 = "#FF6B9D"
BG = "#09090B"        SURFACE = "#131316"
BORDER = "#2A2A30"    TEXT = "#E4E4E7"    TEXT_DIM = "#71717A"
FONT_HEAD = "'Orbitron', sans-serif"
FONT = "'Space Mono', monospace"
```

CSS diamond logo preferred over PNG images.

## Important Decisions & Preferences

1. **CSS diamond logo preferred** — do not replace with PNG images
2. **No personal identity in git** — use AEGIS identity only
3. **MCP server runs locally** — stdio transport, don't suggest VPS
4. **Deployer wallet key exposed** — transfer ownership post-deploy
5. **Contract redeployment OK during MVP** — v4 deployed with fee exemption whitelist
6. **Scout bot is fee-exempt** — `0x4145aF7351Cbc65e3B031C081bfD5377D18E31ad` can list skills with `msg.value = 0`
7. **HonkVerifier is correct** — `NUMBER_OF_PUBLIC_INPUTS = 20` includes 16 pairing points subtracted internally; `verify()` expects exactly 4 user inputs. No redeployment needed.
8. **IdentityRegistry uses ownerOf, not roles** — `setMetadata()` checks `ownerOf(agentId)`, no `METADATA_SETTER_ROLE` exists
9. **ZK toolchain pinned** — nargo 1.0.0-beta.18 + bb 3.0.0-nightly.20260102, other versions may produce incompatible proofs
10. **WSL required on Windows** — nargo and bb run in WSL; use `MSYS_NO_PATHCONV=1` to prevent Git Bash path conversion
11. **Mainnet only (v0.6.0)** — All testnet/Base Sepolia removed. Chain 8453 is the only supported chain. Do NOT re-add testnet support.
12. **WASM vs CLI proof format** — bb.js WASM produces 8032-byte proofs, CLI `bb prove --verifier_target evm` produces 9024-byte proofs. Only CLI format verifies on-chain. The bb binary is bundled inside `@aztec/bb.js` npm at `build/{platform}/bb`.
13. **bb auto-detection** — `findBbBinary()` resolves from npm package first, then PATH, then `$HOME/.bb/bb`. Agents should NOT manually install bb.
14. **Package consolidation done (A8, v0.7.0)** — MCP server merged into SDK. `@aegisaudit/sdk` is the single package. `@aegisaudit/mcp-server` is deprecated. Agent config uses `npx -y @aegisaudit/sdk`.

---

## Phase 2 Checklist

### Workstream A — Platform Infrastructure (this repo)

This is the protocol layer everything else depends on.

- [x] **A1 — Indexer service** `Medium-high`
  Watch contract events, expose REST API
  (`/skills/unaudited`, `/skills/by-category`, `/auditors/leaderboard`, `/bounties/open`)
  - [x] SQLite database schema (skills, attestations, auditors, disputes, bounties, event_log)
  - [x] Sync engine — historical backfill + live polling (5s interval)
  - [x] Hono REST API — 10 endpoints
  - [x] All 10 contract events handled
  - [x] Build verified, smoke tested end-to-end
  - [x] Dockerfile + docker-compose for VPS deployment
  - [x] Add `/skills/by-category` endpoint (group by metadata category field)
  - [x] Metadata parsing + caching (skill_name, category extracted from data/IPFS URIs)
  - [x] Auto-migration for existing databases (adds new columns)
  - [x] Subgraph deployed to The Graph Studio (v0.2.0 — decentralized indexing)
  - [ ] Deploy REST indexer to VPS (Docker) — optional, subgraph handles most use cases

- [x] **A2 — MCP server expansion** `Medium` ✅ Done
  Add consumer-facing tools backed by the subgraph
  - [x] `aegis_check_skill` — query subgraph for skill trust status
  - [x] `aegis_browse_unaudited` — list unaudited skills
  - [x] `aegis_browse_bounties` — list open bounties
  - [x] `aegis_audit_skill` — full audit flow tool
  - [x] Update MCP server to query subgraph GraphQL (`src/lib/subgraph.ts`)
  - [x] Publish `@aegisaudit/mcp-server@0.5.0`

- [x] **A3 — Bounty system testing** `High` ✅ Done
  Contract logic exists (`postBounty`, `reclaimBounty`, auto-claim on `registerSkill`) — tested + UX
  - [x] Test bounty edge cases (8 new tests: fee-exempt, multi-skill, dispute coexistence, large amounts, self-claim, repost-after-reclaim, unlisted skill)
  - [x] 99 total tests passing (94 unit + 5 integration)

- [x] **A4 — Reputation oracle upgrade** `Medium`
  Weighted scoring: attestation count x stake x dispute win rate x tenure
  - [x] Weighted `calculateReputation()` with 7-factor formula: base (att×10) + level bonus (L2×5, L3×15) + stake (diminishing above 0.1 ETH) + tenure (+1/30d, cap 12) - disputes (×20) × win rate (0.5-1.1×) × decay (90d grace, linear to 0.5× at 365d)
  - [x] Minimum stake threshold for reputation tiers: Bronze ≥0.01, Silver ≥0.025, Gold ≥0.1, Diamond ≥0.5 ETH
  - [x] Subgraph v0.3.0 deployed with new Auditor fields (l2/l3 counts, lastAttestationAt)
  - [x] Reputation breakdown UI on Auditor Profile page
  - [x] Stake-cap warning when score qualifies for higher tier

### Workstream B — Agent Templates (new repos, mostly standalone)

These are the open-source templates anyone can fork. Each is its own repo with its own npm package.

- [x] **B1 — `aegis-consumer-middleware`** `Highest impact`
  The one-liner integration for any agent framework
  - [x] Pre-execution trust check — query AEGIS before running any MCP tool
  - [x] Configurable trust thresholds (minAuditLevel, minAttestations, blockOnDispute, mode)
  - [x] Framework integrations (LangChain, CrewAI, MCP adapters)
  - [x] TrustGate core with caching, policy evaluation, runtime updates
  - [x] AegisTrustError for enforce mode blocking
  - [x] Unit tests (16 passing)
  - [~] Publish `@aegisaudit/consumer-middleware@0.1.0` to npm — package built, needs `npm adduser` + publish

- [x] **A5 — Audit queue v0.2** `High` ✅ Done
  Automated audit pipeline with bounty-aware racing and competitor detection
  - [x] Bounty-priority task claiming (highest bounty first, not FIFO)
  - [x] Competitor detection via `SkillRegistered` event monitoring
  - [x] Race-safe submission with pre-submission `checkAlreadyAttested()` check
  - [x] L2/L3 static heuristic checks (type guards, schema validation, resource limits, adversarial patterns)
  - [x] Health HTTP server (`GET /health`, `GET /stats`) on configurable port
  - [x] Bounty claiming with `bountyRecipient` passthrough
  - [x] SQLite schema migration (bounty columns + priority index)
  - [x] `skipped` task state for already-attested skills

- [x] **A6 — Onboarding issue fixes (v0.5.1)** `High` ✅ Done
  13 issues from onboarding test — 10 code fixes, 2 false alarms, 1 auth model clarification
  - [x] 2 new MCP tools: `generate-attestation-proof`, `generate-auditor-commitment`
  - [x] Structured error handling across attestation tools
  - [x] `register-auditor` fee auto-adjustment
  - [x] `link-skill-to-agent` ownerOf pre-check
  - [x] `query-trust-profile` graceful fallback
  - [x] On-chain verifier confirmed working (Issue #6 false alarm — verified on mainnet)
  - [x] Subgraph confirmed indexing bounties (Issue #11 false alarm)
  - [x] SDK + MCP server published to npm as v0.5.1

- [x] **A7 — Agent onboarding overhaul (v0.6.0)** `High` ✅ Done
  Eliminate friction for AI agents setting up and using AEGIS tools
  - [x] Remove all testnet/Base Sepolia (84532) references — SDK, MCP server, CLI, web app, indexer, audit-queue (~30 files)
  - [x] Default chain changed from 84532 to 8453 everywhere
  - [x] New `generate-wallet` MCP tool — one-call wallet creation via `viem/accounts`
  - [x] `findBbBinary()` — auto-detect bb from `@aztec/bb.js` npm package
  - [x] `findCircuitArtifact()` — bundled `attestation.json` in SDK dist via tsup hook
  - [x] `circuitsDir` parameter now optional on `generateAttestationViaCLI()`
  - [x] Wallet guide rewritten (generate-wallet first, no faucet links)
  - [x] MCP server README rewritten (42 tools documented, mainnet config)
  - [x] Published `@aegisaudit/sdk@0.6.0` + `@aegisaudit/mcp-server@0.6.0` to npm
  - [x] Frontend verified — no testnet references, all pages rendering correctly

- [x] **A8 — Package consolidation (v0.7.0)** `High` ✅ Done
  Merge MCP server into SDK so `npm install @aegisaudit/sdk` gives agents everything
  - [x] Move `packages/mcp-server/src/` into SDK as `src/mcp/`
  - [x] Add `@modelcontextprotocol/sdk` + `zod` as SDK dependencies
  - [x] Add `bin` entry to SDK package.json for MCP server executable
  - [x] Update `setup.ts` to reference `@aegisaudit/sdk` instead of `@aegisaudit/mcp-server`
  - [x] Write dead-simple agent-friendly README
  - [x] Deprecate `@aegisaudit/mcp-server` npm package (point to SDK)
  - [x] Update all references across codebase (agents, web, docs, consumer-middleware)
  - [ ] Possibly: remote prover service (plan in memory, deferred)

- [~] **B2 — `aegis-scout-agent`** npm/GitHub monitor + auto-lister
  - [x] Scout bot running and actively listing skills on v4 contract
  - [x] Wallet `0x4145aF7351Cbc65e3B031C081bfD5377D18E31ad` whitelisted (fee-exempt)
  - [ ] Monitor npm registry for new MCP server publishes in real-time
  - [ ] Monitor GitHub for new MCP repos
  - [ ] Parse metadata, flag high-risk skills (credential access, file deletion, code exec)
  - [ ] Revenue model: listing bounties from publishers who want visibility

- [x] **B3 — `aegis-auditor-agent`** security scanner + attestor
  - [x] Auditor Agent Playbook (`packages/agents/auditor-agent/PLAYBOOK.md`)
  - [x] 13-section step-by-step guide: discovery → audit → ZK proof → on-chain submission
  - [x] L1/L2/L3 audit procedures for all 14 criteria
  - [x] Example reports: L1 (4 criteria), L2 (9 criteria), L3 (14 criteria)
  - [x] Shared audit checklist with pass/fail criteria and suggested tools
  - [x] Revenue model: bounty collection + reputation building

- [x] **B4 — `aegis-dispute-agent`** vulnerability monitor + challenger
  - [x] Dispute Agent Playbook (`packages/agents/dispute-agent/PLAYBOOK.md`)
  - [x] 9-section guide: monitoring → detection → evidence → dispute → rewards
  - [x] Three monitoring strategies: scan recent, target low-rep, watch events
  - [x] Structured evidence schema (`shared/evidence-schema.json`)
  - [x] Example dispute evidence with reproduction steps
  - [x] Automated scanning loop workflow
  - [x] Revenue model: bond return + 50% of slashed stake

### Workstream C — Web Platform (apps/web)

- [x] **C1 — Live dashboard**
  Real-time audit activity feed, attestation counts
  - [x] Activity feed from subgraph (ProtocolEvents)
  - [x] Live counters (skills, auditors, attestations, disputes, bounties)
  - [x] Top auditors table (clickable → auditor profile)
  - [x] Attestation level distribution chart
  - [x] 30s auto-refresh polling

- [x] **C2 — Auditor leaderboard page**
  - [x] Leaderboard merged into Auditors page as second tab
  - [x] Ranked table with reputation score, stake, attestation count, tier badge
  - [x] Search, tier filter chips, pagination
  - [x] Individual auditor profile pages (`/auditor/:commitment`)
  - [x] Tier progress bar (Bronze → Silver → Gold → Diamond)
  - [x] Attestation history table
  - [x] Dispute history table (client-side join via skill→attestation→dispute)

- [x] **C3 — Bounty posting UI** ✅ Done
  Connect wallet, post bounty, view open bounties
  - [x] `/bounties` page with stats, filters, search, sortable table, pagination
  - [x] Post bounty form (skill hash, required level, amount) — wallet-gated
  - [x] Open bounties list from subgraph (useBounties hook, 30s refresh)
  - [x] Bounty status tracking (open/claimed/expired/reclaimed)
  - [x] ABI updated with postBounty, reclaimBounty, getBounty + bountyRecipient fix on registerSkill
  - [x] Nav link added to all pages

### UI Polish (Phase 2 — Complete)

- [x] Typography: Orbitron headings + Space Mono body across all pages
- [x] Color tokens standardized (ACCENT, BG, SURFACE, BORDER, TEXT)
- [x] Nav bar standardized (logo + badge + DApp/Registry/Dashboard/Auditors/Developers/Docs + GitHub/NPM + wallet)
- [x] Badge styling unified (gray/muted across all pages)
- [x] Active nav link style unified (borderBottom accent)
- [x] DApp page recreated as proper page with tab interface
- [x] fadeInUp animations on all data pages
- [x] Clickable rows (Dashboard top auditors → profile, Leaderboard → profile)
- [x] Dead files cleaned up (Home.tsx, Leaderboard.tsx removed)

### Contract Changes (v4)

- [x] `feeExempt` mapping — addresses exempt from listing/registration fees
- [x] `setFeeExempt(address, bool)` — owner-only setter
- [x] `listSkill()` and `registerSkill()` skip fee check for exempt addresses
- [x] Deployed to `0xEFF449364D8f064e6dBCF0f0e0aD030D7E489cCd` (Base, block 42983389)
- [x] Verified on BaseScan
- [x] Scout bot wallet whitelisted
- [x] All references updated (frontend, SDK, subgraph, AEGIS.md)
- [x] Subgraph redeployed as v0.2.0

### Recommended Sequence (updated)

```
Done:      A1 (Indexer) ✅ + B1 (Consumer middleware) ✅
           C1 (Dashboard) ✅ + C2 (Leaderboard + Profiles) ✅
           Contract v4 (fee exemption) ✅
           B2 (Scout bot running) 🟡
           A2 (MCP expansion) ✅ — @aegisaudit/mcp-server@0.5.0 published
           A3 (Bounty testing) ✅ — 99 tests passing
           C3 (Bounty UI) ✅ — /bounties page live
           B3 (Auditor agent playbook) ✅ — packages/agents/auditor-agent/
           B4 (Dispute agent playbook) ✅ — packages/agents/dispute-agent/
           A4 (Reputation oracle) ✅ — subgraph v0.3.0, 7-factor weighted scoring
           A5 (Audit queue v0.2) ✅ — bounty-aware racing, competitor detection, health endpoint
           A6 (Onboarding fixes v0.5.1) ✅ — 13 issues resolved, SDK+MCP published

Done:      Full protocol loop closed ✅
           ↳ All core workstream items (A1-A6, B1-B4, C1-C3) complete
           A7 (v0.6.0 agent onboarding) ✅ — mainnet-only, auto-wallet, bundled prover
           A8 (v0.7.0 package consolidation) ✅ — MCP server merged into SDK, single package

Pending:   Deploy ValidationRegistry to Base mainnet (unblocks Issues #9, #12 full mode)
In flight: awesome-mcp-servers PR + Glama listing (pending review)
Next:      Publish @aegisaudit/sdk@0.7.0 to npm + deprecate @aegisaudit/mcp-server
           ↳ Remote prover service (deferred — plan saved in memory)
```

### The Flywheel

```
Publisher lists skill → Scout discovers it → auto-lists (fee-exempt)
↓
Auditor picks it up → stakes ETH → attests
↓
Consumer agent checks → trusts and runs
↓
Dispute agent monitors → challenges if bad
↓
Bad auditor slashed → dispute agent profits
↓
Good auditors rise in reputation → more work
```

**The killer metric:** "X% of MCP tools run by agents are AEGIS-verified"

Start at 0%. Get to 5% and you have a movement. Get to 20% and you're the standard.
