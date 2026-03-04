# AEGIS Protocol — Project Context

Last updated: 2026-03-04

This document captures the full state of the AEGIS Protocol project for continuity across context windows.

## What is AEGIS

On-chain zero-knowledge skill attestation protocol for AI agents on Base L2. Auditors evaluate AI agent skills, generate ZK proofs, and submit attestations on-chain. AEGIS is a **trust verification layer** — it does not execute skills.

## Deployed Infrastructure

| Resource | Location |
|---|---|
| Website | https://aegisprotocol.tech |
| Vercel project | `jadebroccoli-2626s-projects/dist` (deploy from `apps/web/dist`) |
| GitHub | https://github.com/aegisaudit/aegis |
| npm SDK | https://www.npmjs.com/package/@aegisaudit/sdk (v0.2.2) |
| npm MCP Server | https://www.npmjs.com/package/@aegisaudit/mcp-server (v0.2.2) |
| AegisRegistry (mainnet) | `0xBED52D8CEe2690900e21e5ffcb988DFF728D7E1D` (Base, block 42937983) |
| HonkVerifier (mainnet) | `0x832415341C4fD8Fb57da691D87EaF44cd98C63F1` (Base) |
| ZKTranscriptLib (mainnet) | `0xD3a2a936Bc67a46da50dC7E3ce9c6dda42dDbDA2` (Base) |
| AegisRegistry (testnet) | `0x851CfbB116aBdd50Ab899c35680eBd8273dD6Bba` (Base Sepolia) |
| HonkVerifier (testnet) | `0x6c58dE61157AA10E62174c37DFBe63094e334cE6` (Base Sepolia) |
| Deployer wallet (mainnet) | `0x20bABe2d87B225445C4398029DFfE9DfEF275170` |
| Deployer wallet (testnet) | `0x51C8Df6ce7b35EF9b13d5fC040CF81AC74c984e3` |

## Git Identity

- Author: `AEGIS <aegis@aegisprotocol.tech>`
- Git config is set locally in repo (`git config user.name "AEGIS"` / `git config user.email "aegis@aegisprotocol.tech"`)
- History was rewritten and repo recreated to remove old identity — do NOT amend old commits
- GitHub PAT for aegisaudit account is stored in remote URL

## Monorepo Structure

```
aegis/
├── packages/
│   ├── sdk/            # @aegisaudit/sdk — TypeScript client library (tsup, ESM+CJS)
│   ├── mcp-server/     # @aegisaudit/mcp-server — MCP tools for AI agents (tsup, ESM)
│   ├── contracts/      # AegisRegistry.sol — Foundry (forge)
│   ├── circuits/       # Noir ZK circuits (Barretenberg/BB.js)
│   └── cli/            # @aegis/cli — command-line tool (commander, chalk, ora)
├── apps/
│   └── web/            # Frontend — React 19 + Vite 6 + Three.js + wagmi
├── scripts/
│   ├── seed-registry.py    # Seeds 8 skills on Base Sepolia
│   └── seed-results.json   # Output from seed script
├── files/              # Brand assets (logos, banners)
├── metadata/           # OG/Twitter meta card images
├── README.md           # Root README with how-to-use guide
└── AEGIS.md            # This file
```

## Build & Deploy Patterns

```bash
# Build web app
cd apps/web && npx pnpm build

# Deploy to Vercel (from pre-built dist)
npx vercel --cwd "C:/Projects/Aegis/apps/web/dist" --prod --yes

# Build SDK
cd packages/sdk && npx pnpm build

# Build MCP server
cd packages/mcp-server && npx pnpm build

# Publish to npm (SDK has prepublishOnly that auto-builds)
cd packages/sdk && npm publish --access public
cd packages/mcp-server && npm publish --access public

# Full monorepo build
pnpm build   # uses turborepo
```

## Package Versions (current)

| Package | Version |
|---|---|
| @aegisaudit/sdk | 0.2.2 |
| @aegisaudit/mcp-server | 0.2.2 |
| @aegis/web | 0.0.1 (private) |

When bumping versions:
- Update `package.json` version field
- For MCP server: also update `version` string in `src/index.ts` (McpServer constructor)
- Publish with `npm publish --access public`
- Commit the version bump

## Website Pages

All pages are in `apps/web/src/pages/`:

| Page | File | Key Features |
|---|---|---|
| Landing | `Landing.tsx` | Three.js hero, animated stats, feature grid, CTA |
| Registry | `Registry.tsx` | 8 real on-chain skills from `REGISTRY_DATA`, detail panel with BaseScan links |
| Developers | `Developers.tsx` | SDK docs, code examples, API reference, lang toggle (TS/Python/curl) |
| Auditors | `Auditors.tsx` | Tier system, slashing rules, leaderboard (currently empty — no mock data) |
| Docs | `Docs.tsx` | Protocol documentation, architecture diagrams |

### Design System (consistent across all pages)

```
ACCENT = "#FF3366"    ACCENT2 = "#FF6B9D"
BG = "#09090B"        SURFACE = "#131316"
BORDER = "#2A2A30"    TEXT = "#E4E4E7"    TEXT_DIM = "#71717A"
FONT_HEAD = "'Orbitron', sans-serif"
FONT = "'Space Mono', monospace"
```

### Navbar Pattern

All pages share the same navbar structure:
- CSS diamond logo (28x28, rotated 45deg, 2px ACCENT border, 8x8 inner dot)
- "AEGIS" text + page badge
- Nav links: Registry | Developers | Auditors | Docs
- GitHub + npm icon links (Landing, Docs, Developers)
- `<NavConnectWallet />` component (wagmi)

The user explicitly prefers the **CSS diamond logo** over PNG images — do not swap to images.

## Registry Data

The Registry page uses 8 real on-chain skills stored in `REGISTRY_DATA` (not mock data). These were seeded via `scripts/seed-registry.py`. The skills include:

1. Flow Protocol Skill (https://flow.bid/skill/skill.md)
2. Aave Lending Router
3. Uniswap Swap Executor
4. Chainlink Price Feed
5. Safe Multisig Builder
6. ENS Resolution Service
7. OpenAI Gateway Proxy
8. IPFS Pinning Agent

All use real tx hashes, block numbers, and the same auditor commitment: `0x1b90cf3b44d7b16293e1aca7f37148ec665c1592d33682571b3af18d62d6abb7`

## MCP Server

28 tools total:
- **Discovery**: aegis-info, wallet-status
- **Read**: list-all-skills, list-all-auditors, get-attestations, verify-attestation, get-auditor-reputation, get-metadata-uri, list-disputes, list-resolved-disputes, get-unstake-request, get-bounty, create-agent-registration, get-erc8004-validation
- **Trust**: query-trust-profile, query-skill-trust
- **Write** (need AEGIS_PRIVATE_KEY): register-auditor, add-stake, open-dispute, initiate-unstake, complete-unstake, cancel-unstake, post-bounty, reclaim-bounty, register-agent, request-erc8004-validation, respond-to-erc8004-validation, link-skill-to-agent

All tools include wallet onboarding guidance via `lib/wallet-guide.ts` when no wallet is configured.

Has `setup` subcommand for interactive MCP client configuration.

## SDK

`AegisClient` class with:
- Read: `listAllSkills()`, `listAllAuditors()`, `getAttestations()`, `verify()`, `getAuditorReputation()`, `getMetadataURI()`, `listDisputes()`, `listResolvedDisputes()`, `getUnstakeRequest()`, `getBounty()`, `listBounties()`
- Write (need wallet): `registerSkill()`, `registerAuditor()`, `addStake()`, `openDispute()`, `initiateUnstake()`, `completeUnstake()`, `cancelUnstake()`, `postBounty()`, `reclaimBounty()`
- ERC-8004: `registerAgent()`, `requestErc8004Validation()`, `respondToErc8004Validation()`, `linkSkillToAgent()`, `getErc8004ValidationSummary()`, `getErc8004ReputationSummary()`, `createAgentRegistration()`
- Trust: `getTrustProfile()`, `getSkillTrustScore()`
- Trust API: `createTrustApiClient()`, `createTrustApiMiddleware()`
- x402: `createX402Fetch()`, `createAuditPaymentConfig()`, `createTrustApiClient()`
- Prover: `generateAttestation()`, `loadProofFromFiles()`
- IPFS: `fetchMetadata()`, `fetchAuditMetadata()`, `uploadMetadata()`
- Schema: `createAuditTemplate()`, `validateAuditMetadata()`, `computeCriteriaHash()`, `getRequiredCriteria()`
- Constants: `L1_CRITERIA`, `L2_CRITERIA`, `L3_CRITERIA`, `LEVEL_CRITERIA`, `AUDIT_LEVEL_SCORES`, `ERC8004_ADDRESSES`, `USDC_ADDRESSES`

## Brand Assets

Located in `files/` and `metadata/`:
- `files/aegis-logo-128.png` — favicon (copied to `apps/web/public/favicon.png`)
- `files/aegis-logo-512.png` — app icon (copied to `apps/web/public/logo-512.png`)
- `files/aegis-logo-full-dark.png` — full logo on dark bg
- `files/aegis-logo-full-transparent.png` — full logo transparent
- `files/aegis-banner-1500x500.png` — Twitter/social banner
- `files/aegis-banner-og-1200x630.png` — original OG image
- `metadata/aegis-meta-card-1200x630.png` — current OG card (in use)
- `metadata/aegis-meta-card-twitter.png` — current Twitter card (in use)

Meta tags in `apps/web/index.html`:
- OG image → `/og-image.png` (1200x630 meta card)
- Twitter image → `/twitter-image.png` (separate Twitter card)
- Favicon → `/favicon.png` (128x128)

## Important Decisions & User Preferences

1. **CSS diamond logo preferred** — user explicitly said "i preferred the way it was before... with the big big logo". Do not replace with PNG images.
2. **No personal identity in git** — history was rewritten to remove old username. Use AEGIS identity only.
3. **MCP server runs locally** — stdio transport is more secure than VPS. Don't suggest VPS deployment.
4. **AEGIS is a trust verification layer** — does NOT execute skills. READMEs and docs emphasize this.
5. **Auditors page has no mock data** — all stats are zero, leaderboard is empty. UI components preserved for real data.
6. **Registry uses real on-chain data** — 8 skills from seed-results.json, not mocks.

## Audit Level Standards

AEGIS uses an **optimistic model** with structured evaluation criteria. Each audit level defines specific checks the auditor must perform and document. The metadata URI in the on-chain attestation points to a JSON document conforming to `aegis/audit-metadata@1`.

### Levels

| Level | Name | Criteria | Focus |
|---|---|---|---|
| L1 | Functional | 4 checks | Execution, output format, dependencies, documentation |
| L2 | Robust | 9 checks (L1 + 5) | Edge cases, input validation, error handling, resource limits, consistency |
| L3 | Security | 14 checks (L1+L2 + 5) | Prompt injection, data exfiltration, sandbox escape, supply chain, adversarial testing |

### Criteria IDs

- **L1**: `L1.EXEC`, `L1.OUTPUT`, `L1.DEPS`, `L1.DOCS`
- **L2**: all L1 + `L2.EDGE`, `L2.ERROR`, `L2.VALIDATE`, `L2.RESOURCE`, `L2.IDEMPOTENT`
- **L3**: all L1+L2 + `L3.INJECTION`, `L3.EXFIL`, `L3.SANDBOX`, `L3.SUPPLY`, `L3.ADVERSARIAL`

### On-chain Commitment

The `auditCriteriaHash` stored in the attestation is `keccak256(sorted criteria IDs joined by ",")`. This links the on-chain attestation to the off-chain metadata. Disputes reference specific criteria IDs.

### Schema File

`packages/sdk/src/schema.ts` — contains all criteria definitions, `AuditMetadata` type, `validateAuditMetadata()`, `computeCriteriaHash()`, `createAuditTemplate()`, and `getRequiredCriteria()`.

## Contract Economics

### Protocol Fee
- **5% fee** (500 basis points) deducted from all staking operations (`registerAuditor`, `addStake`)
- Fee is tracked in `protocolBalance` — owner can withdraw via `withdrawProtocolBalance(address to)`
- Skill registration fees (0.001 ETH) and forfeited dispute bonds also credited to `protocolBalance`

### Unstaking
- Auditors can unstake with a **3-day cooldown**: `initiateUnstake()` → wait 3 days → `completeUnstake()`
- **Partial unstake**: allowed down to 0.01 ETH minimum remaining stake
- **Full withdrawal**: unstaking entire balance deregisters the auditor (`registered = false`)
- **Dispute blocking**: cannot initiate or complete unstake while auditor has active (unresolved) disputes
- Can cancel anytime via `cancelUnstake()`

### Bounty System
- Publishers post ETH bounties via `postBounty(skillHash, requiredLevel)` — minimum 0.001 ETH
- Bounties expire after 30 days; unclaimed bounties are reclaimable by the publisher (full refund, no fee)
- When `registerSkill()` is called with a `bountyRecipient` address, if a matching bounty exists and `auditLevel >= requiredLevel`, the bounty is auto-paid minus 5% protocol fee
- Level matching: L3 audit for L2 bounty pays out; L1 for L2 does not
- `bountyRecipient` keeps auditor anonymous — the address is provided by the publisher (who coordinated off-chain)

### Revenue Sources
1. 5% of all auditor staking (register + add stake)
2. Skill registration fees (0.001 ETH per skill)
3. Forfeited dispute bonds (challenger loses bond when auditor is found not at fault)
4. 5% of bounty payouts (deducted when bounty is claimed)

## ERC-8004 Integration

AEGIS integrates with **ERC-8004 (Trustless Agents)** — the Ethereum standard for AI agent identity, reputation, and validation. AEGIS acts as a specialized validation provider within the ERC-8004 ecosystem.

### Architecture
- **SDK-level bridging** — no contract changes needed. ERC-8004 interaction is in `packages/sdk/src/erc8004.ts`
- **Score mapping**: L1 Functional → 33, L2 Robust → 66, L3 Security → 100 (0–100 scale)
- **Tag**: `aegis-audit` for filtering AEGIS validations in ERC-8004 registries
- **Flow**: `registerSkill()` → `requestErc8004Validation()` (agent owner) → `respondToErc8004Validation()` (AEGIS validator) — two-wallet, three composable steps

### ERC-8004 Addresses

| Registry | Base Sepolia | Base Mainnet |
|---|---|---|
| IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| ValidationRegistry | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` | Not yet deployed |

### x402 Payments
- Coinbase's HTTP 402 payment protocol for USDC micropayments on Base
- Publishers use `createX402Fetch()` for auto-payment; auditors use `createAuditPaymentConfig()` for Express middleware
- Optional peer deps: `@x402/fetch`, `@x402/express`
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Base), `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Sepolia)

## Trust Score Algorithm

Composite 0-100 score combining data from AEGIS Registry + ERC-8004:

| Component | Weight | Calculation |
|---|---|---|
| Audit base | 60% | L1=20, L2=40, L3=60 (highest level across skills) |
| Validation consensus | 20% | ERC-8004 averageScore / 100 * 20 |
| Reputation | 10% | ERC-8004 normalized reputation * 10 |
| Multi-skill bonus | 10% | +5 per additional audited skill (max +10) |
| Dispute penalty | — | -10 per skill with active disputes |

Trust levels:
- `trusted`: score >= 80, L3+, no active disputes
- `verified`: score >= 50, L2+, no active disputes
- `basic`: score >= 20, L1+
- `unknown`: everything else

## Mainnet Deployment

### Deployer Wallet
- Address: `0x20bABe2d87B225445C4398029DFfE9DfEF275170`
- Chain: Base Mainnet (8453)
- Funded with ETH for gas
- This wallet becomes the contract owner (can call `withdrawProtocolFees()`)
- **Treat as compromised** — private key was exposed in a chat session. Transfer ownership post-deploy.

### Deployment Commands
```bash
cd packages/contracts
pnpm deploy:base
# Runs: forge script script/Deploy.s.sol:DeployAegis --rpc-url base --broadcast --verify
```

### Environment
`.env` at project root:
```
BASE_RPC_URL=https://mainnet.base.org
BASESCAN_API_KEY=<key>
DEPLOYER_PRIVATE_KEY=<key>
```

### Post-Deploy Checklist
1. Copy deployed HonkVerifier + AegisRegistry addresses from console output
2. Update `packages/sdk/src/constants.ts` — uncomment and fill `REGISTRY_ADDRESSES[8453]` + `DEPLOYMENT_BLOCKS[8453]`
3. Rebuild SDK: `pnpm --filter @aegisaudit/sdk build`
4. Rebuild MCP server: `pnpm --filter @aegisaudit/mcp-server build`
5. Publish new SDK + MCP versions to npm
6. Update `apps/web` if any mainnet-specific UI changes needed
7. Transfer contract ownership to a clean wallet

### Gas Estimate
From Sepolia deployment:
| Contract | Gas Used |
|---|---|
| ZKTranscriptLib | 1,334,893 |
| HonkVerifier | 5,181,593 |
| AegisRegistry | 1,319,688 |
| **Total** | **7,836,174** |

Base mainnet gas is ~0.01-0.05 gwei. Estimated cost: $2-5 in ETH.

## Recent Work (reverse chronological)

- **Mainnet deployment prep**: Added Base mainnet etherscan config to `foundry.toml`, added `deploy:base` npm script, updated `DeployAegis` script to read `DEPLOYER_PRIVATE_KEY` from env
- **x402 Trust Profile API**: Built x402-gated trust data layer. Consumers pay USDC micropayments for aggregated trust profiles combining AEGIS Registry + ERC-8004 data
- Added SDK module: `trust.ts` — `buildTrustProfile()`, `buildSkillTrustScore()`, `computeOverallTrustScore()`, `batchBuildTrustProfiles()`
- Added SDK module: `trust-server.ts` — `createTrustApiMiddleware()` Express middleware with 3 x402-gated endpoints
- Added `createTrustApiClient()` to `x402.ts` — typed client for consuming the Trust API
- Added AegisClient methods: `getTrustProfile()`, `getSkillTrustScore()`
- Added 2 MCP tools: `query-trust-profile`, `query-skill-trust` (28 tools total)
- Updated Docs page: replaced x402 Payments section with x402 Trust API (endpoints, server/client examples, direct mode callout)
- Updated Developers page: added Trust API section with 4 method cards
- **Fixed ERC-8004 bridge trust model**: split `bridgeToErc8004()` into two-wallet flow — `requestErc8004Validation()` (agent owner wallet) + `respondToErc8004Validation()` (AEGIS validator wallet). Prevents self-certification per ERC-8004 spec
- Split MCP tool `bridge-to-erc8004` into `request-erc8004-validation` + `respond-to-erc8004-validation`
- Updated types: `BridgeToErc8004Params` → `RequestErc8004ValidationParams` + `RespondToErc8004ValidationParams`
- Integrated ERC-8004 (Trustless Agents) — AEGIS as validation provider in ERC-8004 ecosystem
- Added SDK modules: `erc8004.ts`, `erc8004-constants.ts`, `x402.ts` with score mapping + bridging
- Added AegisClient methods: `registerAgent()`, `requestErc8004Validation()`, `respondToErc8004Validation()`, `linkSkillToAgent()`, `getErc8004ValidationSummary()`, `getErc8004ReputationSummary()`, `createAgentRegistration()`
- Added x402 payment utilities: `createX402Fetch()` (client), `createAuditPaymentConfig()` (server)
- Added 6 new MCP tools: register-agent, request-erc8004-validation, respond-to-erc8004-validation, get-erc8004-validation, link-skill-to-agent, create-agent-registration (26 total)
- Updated Docs page: added ERC-8004 Integration section, x402 Payments section, updated MCP/SDK tables
- Added bounty/reward system: publishers post ETH bounties, auditors get paid on valid attestation
- Added `postBounty()`, `reclaimBounty()`, `getBounty()` contract functions + `Bounty` struct
- Modified `registerSkill()`: added `bountyRecipient` param for auto-claiming matching bounties
- Added 7 bounty errors, 3 bounty events, `MIN_BOUNTY` + `BOUNTY_EXPIRATION` constants
- Added 15 bounty unit tests (59 total passing)
- Updated SDK: `BountyInfo` type, `postBounty()`/`reclaimBounty()`/`getBounty()`/`listBounties()` methods
- Added 3 MCP bounty tools: get-bounty, post-bounty, reclaim-bounty (20 total)
- Updated Docs page: added bounty functions, events, errors, constants, SDK methods, MCP tools
- Added structured audit level standards (L1 Functional / L2 Robust / L3 Security) with 14 criteria IDs
- Added `aegis/audit-metadata@1` JSON schema for attestation metadata
- Added SDK schema module: `createAuditTemplate()`, `validateAuditMetadata()`, `computeCriteriaHash()`, `getRequiredCriteria()`
- Added `fetchAuditMetadata()` to IPFS module for structured metadata retrieval
- Updated Docs page: rewrote Audit Levels section with real criteria, added Metadata Schema section
- Updated Developers page: added Audit Metadata section with `createAuditTemplate()` and `validateAuditMetadata()` examples
- Updated Docs page: added unstake functions, protocol fee constants, UnstakeRequest struct to contract reference
- Updated Docs page: MCP tools section now shows all 20 tools
- Added 5% protocol fee on staking + `withdrawProtocolBalance` owner function
- Added unstaking with 3-day cooldown (initiateUnstake, completeUnstake, cancelUnstake)
- Added active dispute count tracking per auditor (blocks unstaking during disputes)
- Updated SDK with unstake methods + `UnstakeRequest` type + `PROTOCOL_FEE_BPS` / `UNSTAKE_COOLDOWN` constants
- Added 4 new MCP tools: initiate-unstake, complete-unstake, cancel-unstake, get-unstake-request
- Added ABI entries for new contract functions
- Removed placeholder auditors from Auditors page, reset all stats to zero
- Updated OG/Twitter meta cards with new branded designs from `metadata/`
- Added "How to Use" integration guide to SDK and root READMEs
- Created READMEs for root, SDK, and MCP server; published to npm
- Deleted and recreated GitHub repo to fully purge old identity from history
- Rewrote git history — all commits now authored by `AEGIS <aegis@aegisprotocol.tech>`
- Added GitHub + npm icon links to Landing, Docs, Developers navbars
- Reverted all navbar/footer logos from PNG back to CSS diamond
- Added brand assets: favicon, OG meta tags, Twitter cards
- Replaced 24 mock skills in Registry with 8 real on-chain skills
- Set up custom domain aegisprotocol.tech on Vercel
- Published @aegisaudit/mcp-server@0.2.1 with wallet onboarding guide
- Published @aegisaudit/sdk@0.2.0
