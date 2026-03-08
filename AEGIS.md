# AEGIS Protocol — Project Context

Last updated: 2026-03-06

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
| npm MCP Server | https://www.npmjs.com/package/@aegisaudit/mcp-server (v0.5.0) |
| AegisRegistry (mainnet v4) | `0xEFF449364D8f064e6dBCF0f0e0aD030D7E489cCd` (Base, block 42983389) |
| AegisRegistry (mainnet v3, deprecated) | `0xa0FF1563Ab7d5d514146F2713125098954Af1F61` (Base, block 42942701) |
| AegisRegistry (mainnet v2, deprecated) | `0x2E993439E0241b220BF12652897342054202f57C` (Base) |
| AegisRegistry (mainnet v1, deprecated) | `0xBED52D8CEe2690900e21e5ffcb988DFF728D7E1D` (Base) |
| HonkVerifier (mainnet) | `0xefc302c44579ccd362943D696dD71c8EdBCa5Ff7` (Base) |
| AegisRegistry (testnet) | `0x851CfbB116aBdd50Ab899c35680eBd8273dD6Bba` (Base Sepolia) |
| HonkVerifier (testnet) | `0x6c58dE61157AA10E62174c37DFBe63094e334cE6` (Base Sepolia) |
| Deployer wallet (mainnet) | `0x20bABe2d87B225445C4398029DFfE9DfEF275170` |
| Deployer wallet (testnet) | `0x51C8Df6ce7b35EF9b13d5fC040CF81AC74c984e3` |
| Scout bot wallet | `0x4145aF7351Cbc65e3B031C081bfD5377D18E31ad` (fee-exempt on v4) |
| Skills listed | Live — scout bot actively populating v4 contract |
| Indexer | `@aegisaudit/indexer@0.1.0` (local, port 4200) |
| Subgraph (Studio) | https://thegraph.com/studio/subgraph/aegis-protocol |
| Subgraph GraphQL | `https://api.studio.thegraph.com/query/1743315/aegis-protocol/v0.2.0` |

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
│   ├── mcp-server/     # @aegisaudit/mcp-server@0.5.0 — MCP tools for AI agents (tsup, ESM)
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
| @aegisaudit/mcp-server | 0.5.0 |
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

1. **Subgraph (primary)** — GraphQL query to `https://api.studio.thegraph.com/query/1743315/aegis-protocol/v0.2.0`
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
| DApp | `DAppPage.tsx` | Verify Skill, Register Auditor, Submit Skill, Auditor Status tabs |
| Registry | `Registry.tsx` | Live on-chain skills (30s auto-refresh), detail panel, BaseScan links |
| Dashboard | `Dashboard.tsx` | Protocol stats, activity feed, top auditors (subgraph-powered) |
| Auditors | `Auditors.tsx` | Info tab + Leaderboard tab with search/filter/pagination |
| Auditor Profile | `AuditorProfile.tsx` | Stats, tier progress, attestation history, dispute history table |
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

- [ ] **A4 — Reputation oracle upgrade** `Medium`
  Weighted scoring: attestation count x stake x dispute win rate x tenure
  - [ ] Weighted `getReputationScore()` with decay factor
  - [ ] Minimum stake threshold for reputation tiers (bronze/silver/gold)

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
  - [ ] Publish `@aegisaudit/consumer-middleware@0.1.0` to npm

- [~] **B2 — `aegis-scout-agent`** npm/GitHub monitor + auto-lister
  - [x] Scout bot running and actively listing skills on v4 contract
  - [x] Wallet `0x4145aF7351Cbc65e3B031C081bfD5377D18E31ad` whitelisted (fee-exempt)
  - [ ] Monitor npm registry for new MCP server publishes in real-time
  - [ ] Monitor GitHub for new MCP repos
  - [ ] Parse metadata, flag high-risk skills (credential access, file deletion, code exec)
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

- [ ] **B4 — `aegis-dispute-agent`** vulnerability monitor + challenger
  - Dependency: Needs indexer (A1) to watch attestations
  - [ ] Monitor attested skills for vulnerabilities, malicious behavior, supply chain attacks
  - [ ] Open dispute with evidence if something is found
  - [ ] Revenue: slashed stakes from negligent auditors

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

Now:       B3 (Auditor agent) + B4 (Dispute agent)
           ↳ The flywheel starts turning

Next:      A4 (Reputation oracle upgrade)
           ↳ Full loop closed
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
