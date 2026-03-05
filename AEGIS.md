# AEGIS Protocol — Project Context

Last updated: 2026-03-05

This document captures the full state of the AEGIS Protocol project for continuity across context windows.

## What is AEGIS

On-chain zero-knowledge skill attestation protocol for AI agents on Base L2. Auditors evaluate AI agent skills, generate ZK proofs, and submit attestations on-chain. AEGIS is a **trust verification layer** — it does not execute skills.

## Deployed Infrastructure

| Resource | Location |
|---|---|
| Website | https://aegisprotocol.tech |
| Vercel project | `jadebroccoli-2626s-projects/dist` (deploy from `apps/web/dist`) |
| GitHub | https://github.com/aegisaudit/aegis |
| npm SDK | https://www.npmjs.com/package/@aegisaudit/sdk (v0.5.0) |
| npm MCP Server | https://www.npmjs.com/package/@aegisaudit/mcp-server (v0.4.0) |
| AegisRegistry (mainnet v3) | `0xa0FF1563Ab7d5d514146F2713125098954Af1F61` (Base, block 42942701) |
| AegisRegistry (mainnet v2, deprecated) | `0x2E993439E0241b220BF12652897342054202f57C` (Base) |
| AegisRegistry (mainnet v1, deprecated) | `0xBED52D8CEe2690900e21e5ffcb988DFF728D7E1D` (Base) |
| HonkVerifier (mainnet) | `0xefc302c44579ccd362943D696dD71c8EdBCa5Ff7` (Base) |
| AegisRegistry (testnet) | `0x851CfbB116aBdd50Ab899c35680eBd8273dD6Bba` (Base Sepolia) |
| HonkVerifier (testnet) | `0x6c58dE61157AA10E62174c37DFBe63094e334cE6` (Base Sepolia) |
| Deployer wallet (mainnet) | `0x20bABe2d87B225445C4398029DFfE9DfEF275170` |
| Deployer wallet (testnet) | `0x51C8Df6ce7b35EF9b13d5fC040CF81AC74c984e3` |
| Skills listed | 15 (re-listed on v3 contract) |
| Indexer | `@aegisaudit/indexer@0.1.0` (local, port 4200) |
| Subgraph (Studio) | https://thegraph.com/studio/subgraph/aegis-protocol |
| Subgraph GraphQL | `https://api.studio.thegraph.com/query/1743315/aegis-protocol/v0.1.0` |

## Git Identity

- Author: `AEGIS <aegis@aegisprotocol.tech>`
- Git config is set locally in repo (`git config user.name "AEGIS"` / `git config user.email "aegis@aegisprotocol.tech"`)
- History was rewritten and repo recreated to remove old identity — do NOT amend old commits
- GitHub PAT for aegisaudit account is stored in remote URL

## Monorepo Structure

```
aegis/
├── packages/
│   ├── sdk/            # @aegisaudit/sdk@0.5.0 — TypeScript client library (tsup, ESM+CJS)
│   ├── mcp-server/     # @aegisaudit/mcp-server@0.4.0 — MCP tools for AI agents (tsup, ESM)
│   ├── indexer/        # @aegisaudit/indexer@0.1.0 — Event indexer + REST API (Hono, sql.js)
│   ├── subgraph/       # @aegisaudit/subgraph@0.1.0 — The Graph subgraph (Base L2, AssemblyScript)
│   ├── consumer-middleware/ # @aegisaudit/consumer-middleware@0.1.0 — Pre-execution trust gate (tsup, ESM+CJS)
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
cd packages/mcp-server && pnpm build
cd packages/indexer && pnpm build
cd apps/web && pnpm build

# Deploy to Vercel (from pre-built dist)
npx vercel --cwd "C:/Projects/Aegis/apps/web/dist" --prod --yes

# Publish to npm
cd packages/sdk && npm publish --access public
cd packages/mcp-server && npm publish --access public

# Run indexer locally
cd packages/indexer && pnpm start  # http://localhost:4200

# Deploy contracts (registry only, reuses existing verifier)
cd packages/contracts
VERIFIER_ADDRESS=0xefc302c44579ccd362943D696dD71c8EdBCa5Ff7 forge script script/Deploy.s.sol:DeployRegistryOnly --rpc-url base --broadcast --verify
```

## Package Versions (current)

| Package | Version |
|---|---|
| @aegisaudit/sdk | 0.5.0 |
| @aegisaudit/mcp-server | 0.4.0 |
| @aegisaudit/indexer | 0.1.0 |
| @aegisaudit/subgraph | 0.1.0 |
| @aegisaudit/consumer-middleware | 0.1.0 |
| @aegis/web | 0.0.1 (private) |

When bumping versions:
- Update `package.json` version field
- For MCP server: also update `version` string in `src/index.ts` (McpServer constructor)
- For MCP server npm publish: replace `workspace:*` with actual SDK version (e.g., `^0.5.0`)
- Publish with `npm publish --access public`
- Commit the version bump

## Contract (AegisRegistry v3)

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
- `transferOwnership(address newOwner)`

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
| Auditor | bytes32 commitment | Auditor profiles with reputation score |
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
pnpm deploy:studio             # prompts for version label
```

### Metadata Parsing

Data URIs (`data:application/json;base64,...`) are decoded inline in AssemblyScript to extract `skillName` and `category`. IPFS/HTTP URIs fall back to "Unknown Skill" / "Uncategorized" (subgraph runtime cannot make HTTP requests).

## MCP Server (35 tools)

- **Discovery**: aegis-info, wallet-status
- **Read**: list-all-skills, list-all-auditors, get-attestations, verify-attestation, get-auditor-reputation, get-metadata-uri, list-disputes, list-resolved-disputes, get-unstake-request, get-bounty, create-agent-registration, get-erc8004-validation, get-dispute, get-active-dispute-count, get-dispute-count, is-attestation-revoked, get-auditor-profile
- **Trust**: query-trust-profile, query-skill-trust
- **Write** (need AEGIS_PRIVATE_KEY): register-auditor, add-stake, open-dispute, initiate-unstake, complete-unstake, cancel-unstake, post-bounty, reclaim-bounty, register-agent, request-erc8004-validation, respond-to-erc8004-validation, link-skill-to-agent, resolve-dispute, revoke-attestation

## SDK (AegisClient)

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

1. **Subgraph (primary)** — GraphQL query to `https://api.studio.thegraph.com/query/1743315/aegis-protocol/v0.1.0`
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

## Website Pages

All pages in `apps/web/src/pages/`:

| Page | File | Key Features |
|---|---|---|
| Landing | `Landing.tsx` | Three.js hero, animated stats, feature grid, CTA |
| Registry | `Registry.tsx` | 15 on-chain skills, detail panel with BaseScan links |
| Developers | `Developers.tsx` | SDK docs, code examples, API reference |
| Auditors | `Auditors.tsx` | Tier system, slashing rules, leaderboard |
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
5. **Contract redeployment OK during MVP** — v3 deployed with dispute getters + revocation

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
  - [x] Build verified, smoke tested end-to-end (15 skills indexed)
  - [x] Dockerfile + docker-compose for VPS deployment
  - [x] Add `/skills/by-category` endpoint (group by metadata category field)
  - [x] Metadata parsing + caching (skill_name, category extracted from data/IPFS URIs)
  - [x] Auto-migration for existing databases (adds new columns)
  - [ ] Deploy indexer to VPS (run `docker compose up -d` on server)

- [ ] **A2 — MCP server expansion** `Medium`
  Add consumer-facing tools (`aegis_check_skill`, `aegis_browse_unaudited`, `aegis_browse_bounties`) backed by the indexer
  - [ ] `aegis_check_skill` — query indexer for skill trust status
  - [ ] `aegis_browse_unaudited` — list unaudited skills from indexer
  - [ ] `aegis_browse_bounties` — list open bounties from indexer
  - [ ] `aegis_audit_skill` — full audit flow tool
  - [ ] Update MCP server to optionally connect to indexer API
  - [ ] Publish `@aegisaudit/mcp-server@0.5.0`

- [ ] **A3 — Bounty system contract** `High`
  On-chain escrow, posting, claiming, payout
  - [ ] Bounty escrow logic (already partially in contract — `postBounty`, `reclaimBounty`)
  - [ ] Auto-claim on `registerSkill` when bounty exists (already implemented)
  - [ ] Bounty discovery UX via indexer API
  - [ ] Test coverage for bounty edge cases (expiry, partial claims)

- [ ] **A4 — Reputation oracle contract upgrade** `Medium`
  Weighted scoring: attestation count x stake x dispute win rate x tenure
  - [ ] On-chain `getReputationScore()` with weighted formula
  - [ ] Decay factor for old attestations
  - [ ] Minimum stake threshold for reputation tier
  - [ ] Consumer-queryable trust levels (bronze / silver / gold)

### Workstream B — Agent Templates (new repos, mostly standalone)

These are the open-source templates anyone can fork. Each is its own repo with its own npm package.

- [x] **B1 — `aegis-consumer-middleware`** `Highest impact`
  The one-liner integration for any agent framework
  - Dependency: Just needs MCP server (done)
  - [x] `npm install @aegisaudit/consumer-middleware`
  - [x] Pre-execution trust check — query AEGIS subgraph before running any tool
  - [x] Configurable trust thresholds (minAuditLevel, minAttestations, blockOnDispute, mode)
  - [x] Framework integrations: LangChain, CrewAI, MCP adapters
  - [x] Fallback to on-chain SDK if subgraph unavailable
  - [x] TrustGate core with caching, policy evaluation, runtime updates
  - [x] AegisTrustError for enforce mode blocking
  - [x] Unit tests (16 passing)
  - [x] Comprehensive README with end-to-end examples
  - [ ] Publish `@aegisaudit/consumer-middleware@0.1.0` to npm

- [ ] **B2 — `aegis-scout-agent`** npm/GitHub monitor + auto-lister
  - Dependency: Needs indexer (A1) to avoid duplicate listings
  - [ ] Monitor npm registry for new MCP server publishes in real-time
  - [ ] Monitor GitHub for new MCP repos
  - [ ] Parse metadata, flag high-risk skills (credential access, file deletion, code exec)
  - [ ] Auto-list on AEGIS with parsed metadata
  - [ ] Revenue model: listing bounties from publishers who want visibility

- [ ] **B3 — `aegis-auditor-agent`** security scanner + attestor
  - Dependency: Needs bounty system (A3) to find work
  - [ ] Pull skill source code from npm/GitHub
  - [ ] Run static analysis (eslint security rules, semgrep, snyk)
  - [ ] Check dependency tree for known vulns
  - [ ] Scope permissions (network, file, credentials)
  - [ ] Generate structured audit report
  - [ ] Submit L1 attestation with ZK proof
  - [ ] Stake ETH behind attestation — skin in the game
  - [ ] Template: anyone can fork and specialize (npm auditor, Python auditor, smart contract auditor)

- [ ] **B4 — `aegis-dispute-agent`** vulnerability monitor + challenger
  - Dependency: Needs indexer (A1) to watch attestations
  - [ ] Monitor attested skills for vulnerabilities, malicious behavior, supply chain attacks
  - [ ] Open dispute with evidence if something is found
  - [ ] Revenue: slashed stakes from negligent auditors

### Workstream C — Web Platform (apps/web)

- [ ] **C1 — Live dashboard**
  Real-time audit activity feed, attestation counts
  - [ ] Activity feed from indexer `/stats/events` endpoint
  - [ ] Live counters (skills, auditors, attestations, disputes)
  - [ ] Real-time updates via polling or WebSocket

- [ ] **C2 — Auditor leaderboard page**
  Backed by indexer `/auditors/leaderboard`
  - [ ] Ranked table with reputation score, stake, attestation count
  - [ ] Individual auditor profile pages
  - [ ] Dispute history per auditor

- [ ] **C3 — Bounty posting UI**
  Connect wallet, post bounty, view open bounties
  - [ ] Wallet connect (wagmi already integrated)
  - [ ] Post bounty form (skill hash, required level, amount)
  - [ ] Open bounties list from indexer `/bounties/open`
  - [ ] Bounty claim status tracking

### Recommended Sequence

```
Week 1-2:  A1 (Indexer) ✅ + B1 (Consumer middleware) ✅
           ↳ Both complete; subgraph deployed to The Graph Studio

Week 3-4:  A2 (MCP expansion) + B2 (Scout agent) + C1 (Dashboard)
           ↳ Now agents can actually browse + list; dashboard shows activity

Week 5-6:  A3 (Bounty contracts) + B3 (Auditor template)
           ↳ Protocol upgrade + the agent that uses it

Week 7-8:  A4 (Reputation oracle) + B4 (Dispute agent) + C2/C3 (Leaderboard + Bounty UI)
           ↳ Full loop closed
```

### The Flywheel

```
Publisher lists skill → Scout discovers it → pays listing fee
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
