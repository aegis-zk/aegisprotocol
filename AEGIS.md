# AEGIS Protocol — Project Context

Last updated: 2026-03-02

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
| AegisRegistry | `0x851CfbB116aBdd50Ab899c35680eBd8273dD6Bba` (Base Sepolia) |
| HonkVerifier | `0x6c58dE61157AA10E62174c37DFBe63094e334cE6` (Base Sepolia) |
| Deployer wallet | `0x51C8Df6ce7b35EF9b13d5fC040CF81AC74c984e3` |

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

13 tools total:
- **Discovery**: aegis-info, wallet-status
- **Read**: list-all-skills, list-all-auditors, get-attestations, verify-attestation, get-auditor-reputation, get-metadata-uri, list-disputes, list-resolved-disputes
- **Write** (need AEGIS_PRIVATE_KEY): register-auditor, add-stake, open-dispute

All tools include wallet onboarding guidance via `lib/wallet-guide.ts` when no wallet is configured.

Has `setup` subcommand for interactive MCP client configuration.

## SDK

`AegisClient` class with:
- Read: `listAllSkills()`, `listAllAuditors()`, `getAttestations()`, `verify()`, `getAuditorReputation()`, `getMetadataURI()`, `listDisputes()`, `listResolvedDisputes()`
- Write (need wallet): `registerSkill()`, `registerAuditor()`, `addStake()`, `openDispute()`
- Prover: `generateAttestation()`, `loadProofFromFiles()`
- IPFS: `fetchMetadata()`, `uploadMetadata()`

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

## Recent Work (reverse chronological)

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
