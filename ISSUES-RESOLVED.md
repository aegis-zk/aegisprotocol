# AEGIS Issues — Resolution Report

**Date:** 2026-03-17
**Packages:** `@aegisaudit/sdk@0.5.1`, `@aegisaudit/mcp-server@0.5.1`
**Registry:** `0xEFF449364D8f064e6dBCF0f0e0aD030D7E489cCd` (Base Mainnet)
**Verifier:** `0xefc302c44579ccd362943D696dD71c8EdBCa5Ff7` (Base Mainnet)

---

## Summary

All 13 issues from the onboarding test have been addressed. 10 were code fixes shipped in the `0.5.1` release, 2 turned out to be false alarms after on-chain investigation, and 1 was a misunderstanding of the contract's auth model. A `0.5.2` patch is pending with post-publish improvements.

---

## Issue Resolution

### Issue 1 — `list-all-skills` misses SkillListed events
**Status:** Fixed in `0.5.1`

The tool was scanning on-chain event logs with a limited block range, missing older skills. Rewrote to query the subgraph instead. Now returns all listed skills with attestation counts, bounty info, and `first`/`skip` pagination.

---

### Issue 2 — npm package has stale registry address
**Status:** Fixed in `0.5.1`

SDK and MCP server bumped to `0.5.1` and published to npm under `@aegisaudit`. The SDK ships with the correct mainnet registry address (`0xEFF4...`).

---

### Issue 3 — No proof generation MCP tool
**Status:** Fixed in `0.5.1`

New tool: **`generate-attestation-proof`**. Wraps `buildProverToml()` + `generateAttestationViaCLI()` from the SDK. Accepts all circuit inputs (skillHash, criteriaHash, auditLevel, auditorCommitment, auditorPrivateKey) and returns proof hex + publicInputs for `aegis_audit_skill`.

Requires nargo and bb in WSL on Windows:
```
noirup -v 1.0.0-beta.18
```

---

### Issue 4 — `register-auditor` rejects 0.01 ETH
**Status:** Fixed in `0.5.1`

The 5% protocol fee (`PROTOCOL_FEE_BPS = 500`) was deducted from the sent value, causing the net stake to fall below the minimum. The tool now auto-adjusts:

```
adjustedStake = (desiredNetStake * 10000) / 9500 + 1
```

Response includes `requestedStakeEth`, `actualSentEth`, and `netStakeAfterFeeEth` for transparency.

---

### Issue 5 — bb.js version compatibility unclear
**Status:** Fixed in `0.5.1`

Added explicit version requirements to `audit-skill` and `generate-attestation-proof` tool descriptions:
- `nargo 1.0.0-beta.18`
- `@aztec/bb.js@3.0.0-nightly.20260102`

Other versions may produce incompatible proofs.

---

### Issue 6 — On-chain verifier VK mismatch (20 vs 4 public inputs)
**Status:** False alarm — verifier works correctly

**Investigation:**
1. Rebuilt the circuit from source (`nargo compile` + `bb write_vk` + `bb write_solidity_verifier`)
2. Regenerated verifier is **identical** to the deployed contract (verified on Basescan)
3. The Solidity constant `NUMBER_OF_PUBLIC_INPUTS = 20` is correct: the verifier internally subtracts `PAIRING_POINTS_SIZE = 16`, so `verify(proof, publicInputs)` expects exactly **4** public inputs in the array
4. Generated a fresh proof and ran a Forge script against the live mainnet verifier:

```
Proof size: 9024
Public inputs count: 4
Verification result: true
```

The verifier at `0xefc3...` is working correctly with the current circuit and toolchain. No redeployment needed.

---

### Issue 7 — Auditor commitment must be Pedersen hash, not keccak256
**Status:** Fixed in `0.5.1`

New tool: **`generate-auditor-commitment`**. Computes `pedersen_hash([auditorPrivateKey])` by spinning up a temporary Noir project. Handles WSL on Windows. Includes a warning that keccak256 will produce the wrong commitment.

---

### Issue 8 — `is-attestation-revoked` returns false for non-existent attestations
**Status:** Fixed in `0.5.1`

Now checks attestation existence via `getAttestations()` before calling `isAttestationRevoked()`. Returns structured errors:
- `AttestationNotFound` — skill has zero attestations
- `AttestationIndexOutOfBounds` — index exceeds attestation count

---

### Issue 9 — ERC-8004 ValidationRegistry not deployed on mainnet
**Status:** Fixed in `0.5.1`

Added conditional `mainnetWarning` to `register-agent` when `AEGIS_CHAIN_ID === 8453`. Warns that `request-erc8004-validation`, `respond-to-erc8004-validation`, and `query-trust-profile` are affected.

This is an ops issue — the ValidationRegistry contract has not been deployed to Base mainnet yet.

---

### Issue 10 — Inconsistent error handling across attestation tools
**Status:** Fixed in `0.5.1` + `0.5.2`

Improved three tools:
- **`verify-attestation`** — Pre-checks attestation existence, returns structured `AttestationNotFound` / `AttestationIndexOutOfBounds` errors with context
- **`get-attestations`** — Returns a helpful message when no attestations exist instead of an empty raw array
- **`is-attestation-revoked`** — Already fixed in Issue #8

All attestation tools now return structured error objects instead of opaque reverts.

---

### Issue 11 — Subgraph doesn't index bounties
**Status:** False alarm — subgraph is working correctly

**Investigation:**
1. Reviewed `mapping.ts` — handlers for `BountyPosted`, `BountyClaimed`, `BountyReclaimed` are all present and correct
2. Queried the live subgraph (`v0.2.0`):
   - Synced to block 43,509,633, no indexing errors
   - 283 skills indexed
   - 1 active bounty: 0.001 ETH on `@claude-flow/memory` (requiredLevel: 1, expires: ~2026-05-14)
3. Bounty data appears correctly in both direct `bounties` query and nested within `skills { bounty { ... } }` query

Likely cause: tester queried the wrong subgraph version or checked before the `BountyPosted` transaction was confirmed.

---

### Issue 12 — `query-trust-profile` crashes on mainnet
**Status:** Fixed in `0.5.1`

Added try-catch with graceful degradation. When `getTrustProfile()` fails with "ValidationRegistry not deployed", the tool falls back to AEGIS-only attestation data via `getSkillTrustScore()`. Response includes `partial: true` and an explanation of what data is unavailable.

---

### Issue 13 — `link-skill-to-agent` returns "Not authorized"
**Status:** Fixed in `0.5.2`

**Investigation:**
The IdentityRegistry does **not** have a `METADATA_SETTER_ROLE` or any AccessControl roles. Authorization for `setMetadata()` is simply `ownerOf(agentId)` — only the NFT holder can write metadata.

Verified on-chain:
- Random address → "Not authorized"
- Contract owner → "Not authorized"
- NFT owner → success

**Fix:** Updated tool description to clarify the `ownerOf` requirement. Added a pre-check that queries `ownerOf(agentId)` before attempting the transaction and returns a clear `NotAgentOwner` error with both addresses if mismatched.

---

## Pending

- [ ] Publish `@aegisaudit/mcp-server@0.5.2` with post-publish fixes (Issue #6 warning removal, Issue #13 ownership pre-check)
- [ ] Deploy ValidationRegistry to Base mainnet (unblocks Issues #9, #12 full mode)
