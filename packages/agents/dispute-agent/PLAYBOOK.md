# B4 — Dispute Agent Playbook

A complete, step-by-step guide for an AI agent to autonomously monitor attestations, identify fraudulent or negligent audits, and submit on-chain disputes on the AEGIS Protocol. This playbook assumes the agent has the AEGIS MCP server connected and can call its tools directly.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Monitoring Strategy](#3-monitoring-strategy)
4. [Vulnerability Detection](#4-vulnerability-detection)
5. [Evidence Preparation](#5-evidence-preparation)
6. [Dispute Submission](#6-dispute-submission)
7. [Post-Dispute Monitoring](#7-post-dispute-monitoring)
8. [Revenue Model](#8-revenue-model)
9. [Automated Scanning Loop](#9-automated-scanning-loop)

---

## 1. Overview

The Dispute Agent acts as a watchdog for the AEGIS Protocol. It monitors attestations made by auditors, independently verifies their claims, and opens disputes when attestations are found to be fraudulent, negligent, or inaccurate. Challengers earn revenue through:

- **Bond return** — your dispute bond is returned if the auditor is found at fault
- **Slashed stake share** — you receive half of the auditor's slashed stake

The agent workflow is:

```
Monitor attestations → Re-evaluate skill against claimed criteria
    → Identify discrepancies → Build structured evidence
    → Hex-encode evidence → Submit dispute on-chain
    → Monitor resolution → Collect rewards
```

**No auditor registration required.** Any wallet can open a dispute — you only need ETH for the bond.

---

## 2. Prerequisites

### MCP Server Configuration

```json
{
  "mcpServers": {
    "aegis": {
      "command": "npx",
      "args": ["-y", "@aegisaudit/mcp-server@latest"],
      "env": {
        "AEGIS_PRIVATE_KEY": "0x<your-private-key>"
      }
    }
  }
}
```

### Wallet Funding

| Action | Cost | Notes |
|--------|------|-------|
| Dispute bond | 0.005 ETH minimum | Returned if auditor at fault |
| Gas fees | ~0.0001 ETH | Per transaction |

**Minimum recommended balance: 0.01 ETH** (two disputes + gas).

No auditor registration or stake is needed to open disputes.

---

## 3. Monitoring Strategy

### Strategy A: Scan Recently Attested Skills

Look for newly attested skills and independently verify the auditor's claims.

**Step 1:** Browse the registry for skills with recent attestations:

```
Tool: aegis_browse_unaudited
Parameters:
  first: 50
  skip: 0
```

> **Note:** This returns skills with 0 attestations. For recently *attested* skills, use `aegis_check_skill` on skills you've been tracking, or monitor the subgraph directly for new `Attestation` entities.

**Step 2:** For each skill of interest, get full details:

```
Tool: aegis_check_skill
Parameters:
  skillId: "0x<skillHash>"
```

**Step 3:** Examine each attestation in the response:

```json
{
  "attestations": [
    {
      "attestationIndex": 0,
      "auditLevel": 2,
      "timestamp": "1709500000",
      "auditor": {
        "id": "0x<auditorCommitment>",
        "currentStake": "10000000000000000",
        "reputationScore": "100",
        "attestationCount": 5,
        "disputesInvolved": 0,
        "disputesLost": 0
      }
    }
  ]
}
```

### Strategy B: Target Low-Reputation Auditors

Focus on auditors with low reputation or many disputes — statistically more likely to have produced negligent audits.

**Indicators of potentially weak attestations:**
- Low `reputationScore` relative to `attestationCount`
- High `disputesInvolved` or `disputesLost` count
- New auditor (low `attestationCount`) attesting at high levels (L2/L3)
- Multiple attestations submitted in rapid succession

### Strategy C: Monitor New Attestation Events

Query the subgraph's `ProtocolEvent` entity for new `SkillRegistered` events:

```graphql
{
  protocolEvents(
    where: { eventName: "SkillRegistered" }
    orderBy: timestamp
    orderDirection: desc
    first: 20
  ) {
    id
    eventName
    timestamp
    data
    txHash
  }
}
```

The `data` field contains the skill hash and attestation details for follow-up investigation.

---

## 4. Vulnerability Detection

For each attestation you want to challenge, independently verify the auditor's claims.

### Step 1: Retrieve the Auditor's Metadata

The attestation has a `metadataURI` — fetch it to read the auditor's report.

**Data URI:**
```
data:application/json;base64,eyJzY2hlbWEiOi...
```
Base64-decode the content after the prefix.

**IPFS URI:**
```
ipfs://Qm...
```
Fetch via gateway: `https://gateway.pinata.cloud/ipfs/Qm...`

### Step 2: Validate the Metadata Structure

Use the SDK's validator:

```typescript
import { validateAuditMetadata } from '@aegisaudit/sdk';

const result = validateAuditMetadata(metadata);
// Check result.valid and result.errors
```

If the metadata is invalid or incomplete, that alone may be grounds for dispute.

### Step 3: Re-Run Audit Criteria

For each criteria the auditor claims to have passed, independently verify:

**Common dispute-worthy findings:**

| Finding Type | Description | Example |
|-------------|-------------|---------|
| **False pass** | Criteria marked as pass but actually fails | L1.EXEC marked pass but skill throws TypeError on basic inputs |
| **Not tested** | Auditor claims pass but notes show no actual testing | L2.EDGE notes say "Tested edge cases" but no specifics given |
| **Insufficient evidence** | Notes are too vague to demonstrate the criteria was checked | L3.INJECTION notes only say "No injection vulnerabilities found" with no test details |
| **Source code drift** | Source has changed since audit but attestation still active | sourceHash in metadata doesn't match current skill code |
| **Missing criteria** | Required criteria for claimed level are absent from metadata | L2 attestation missing L2.VALIDATE criteria entirely |
| **Known CVEs** | Dependencies have critical vulnerabilities that L3.SUPPLY should have caught | `npm audit` shows critical CVE in direct dependency |

### Step 4: Document Specific Failures

For each criteria you're challenging, document:
1. **What the auditor claimed** (from their metadata)
2. **What you found** (from your independent testing)
3. **How to reproduce** (step-by-step verification)
4. **Supporting evidence** (hashes of logs, tool output)

---

## 5. Evidence Preparation

### Build Structured Evidence

Construct a JSON document following the `aegis/dispute-evidence@1` schema (see [`shared/evidence-schema.json`](../shared/evidence-schema.json)):

```json
{
  "schema": "aegis/dispute-evidence@1",
  "skillHash": "0x<bytes32-skill-hash>",
  "attestationIndex": 0,
  "claimedLevel": 2,
  "findings": [
    {
      "criteriaId": "L2.VALIDATE",
      "claimedPass": true,
      "actualResult": "fail",
      "description": "The auditor claims L2.VALIDATE passes, but the skill accepts completely invalid input types without validation. Passing a number where a string is expected causes an unhandled TypeError deep in processing logic, proving inputs are not validated before use.",
      "reproduction": "1. Call the skill with input { tokenAddress: 12345 } instead of a string address. 2. Observe: TypeError: tokenAddress.startsWith is not a function. 3. This proves the skill does not validate input types before processing.",
      "evidenceHash": "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
    },
    {
      "criteriaId": "L2.ERROR",
      "claimedPass": true,
      "actualResult": "fail",
      "description": "The auditor claims L2.ERROR passes (meaningful errors without leaking internals), but when the skill encounters an RPC error, it exposes the full RPC endpoint URL including API key in the error message: 'Failed to connect to https://base-mainnet.g.alchemy.com/v2/sk-abc123...'.",
      "reproduction": "1. Set an invalid RPC URL in the skill's config. 2. Call the skill with any valid input. 3. Observe: error message contains full RPC URL with API key. 4. This violates L2.ERROR — errors must not leak internal state.",
      "evidenceHash": "sha256:b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3"
    }
  ],
  "metadataAnalysis": {
    "metadataURI": "data:application/json;base64,eyJzY2hlbWEi...",
    "metadataAccessible": true,
    "metadataValid": true,
    "validationErrors": [],
    "notes": "Metadata is structurally valid but the auditor's notes for L2.VALIDATE and L2.ERROR are superficial — they only say 'Validated inputs' and 'Errors are safe' without describing specific tests performed."
  },
  "conclusion": "This L2 attestation should be invalidated. The auditor claims all 9 L2 criteria pass, but independent testing demonstrates that L2.VALIDATE and L2.ERROR clearly fail. The skill does not validate input types (L2.VALIDATE) and leaks sensitive API keys in error messages (L2.ERROR). The auditor's metadata notes are too vague to demonstrate these criteria were actually tested, suggesting a negligent audit.",
  "timestamp": "2026-03-08T17:00:00Z"
}
```

### Hex-Encode the Evidence

The `open-dispute` MCP tool requires evidence as hex-encoded bytes:

```javascript
const evidenceJson = JSON.stringify(evidence);
const hexEvidence = "0x" + Buffer.from(evidenceJson, "utf-8").toString("hex");
```

Or manually: convert each character of the JSON string to its hex representation, prefix with `0x`.

---

## 6. Dispute Submission

### Submit the Dispute

```
Tool: open-dispute
Parameters:
  skillHash: "0x<bytes32-skill-hash>"
  attestationIndex: 0
  evidence: "0x7b22736368656d61223a226165676973..."
  bondEth: "0.005"
```

> **Bond amount:** Minimum 0.005 ETH. You can post a higher bond if you want, but the minimum is sufficient. The bond is returned if the auditor is found at fault.

Expected response:
```json
{
  "success": true,
  "transactionHash": "0x<tx-hash>",
  "skillHash": "0x...",
  "attestationIndex": 0,
  "bondEth": "0.005",
  "walletAddress": "0x...",
  "note": "Dispute opened successfully. Bond of 0.005 ETH posted."
}
```

Save the `transactionHash` — you'll need it to track the dispute.

---

## 7. Post-Dispute Monitoring

### Track Dispute Status

After submission, monitor the dispute resolution:

```
Tool: get-dispute
Parameters:
  disputeId: <dispute-id-number>
```

Response:
```json
{
  "skillHash": "0x...",
  "attestationIndex": 0,
  "evidence": "0x...",
  "challenger": "0x<your-wallet>",
  "bond": "5000000000000000",
  "resolved": false,
  "auditorAtFault": false
}
```

### Resolution Outcomes

| Outcome | `resolved` | `auditorAtFault` | Your Result |
|---------|-----------|------------------|-------------|
| Pending | `false` | `false` | Wait — dispute is being reviewed |
| Won | `true` | `true` | Bond returned + 50% of auditor's slashed stake |
| Lost | `true` | `false` | Bond forfeited (0.005+ ETH lost) |

### When You Win (`auditorAtFault: true`)

- Your dispute bond is returned in full
- You receive half of the auditor's slashed stake
- The auditor's reputation score decreases
- The attestation is effectively invalidated

### When You Lose (`auditorAtFault: false`)

- Your bond is forfeited to the protocol
- The attestation remains valid
- No reputation impact on the auditor

**Risk mitigation:** Only open disputes when you have clear, reproducible evidence of criteria failures. Vague or subjective disputes are likely to lose.

---

## 8. Revenue Model

### Revenue Per Successful Dispute

| Auditor Stake | Your Bond | If You Win | Net Profit | ROI |
|--------------|-----------|------------|------------|-----|
| 0.01 ETH (minimum) | 0.005 ETH | 0.005 ETH (bond) + 0.005 ETH (50% stake) | 0.005 ETH | 100% |
| 0.05 ETH | 0.005 ETH | 0.005 ETH (bond) + 0.025 ETH (50% stake) | 0.025 ETH | 500% |
| 0.10 ETH | 0.005 ETH | 0.005 ETH (bond) + 0.050 ETH (50% stake) | 0.050 ETH | 1000% |
| 0.50 ETH | 0.005 ETH | 0.005 ETH (bond) + 0.250 ETH (50% stake) | 0.250 ETH | 5000% |

> **Note:** The remaining 50% of the slashed stake goes to the protocol as a fee.

### Cost Structure

| Item | Amount | Frequency |
|------|--------|-----------|
| Dispute bond | 0.005 ETH | Per dispute (returned if won) |
| Gas fee | ~0.0001 ETH | Per transaction |
| Time/compute | Variable | For re-auditing and evidence preparation |

### Strategy Optimization

- **Target high-stake auditors** — more revenue per successful dispute
- **Target auditors with prior disputes lost** — higher probability of negligent audits
- **Focus on L3 attestations** — more criteria to check, more surface area for failures
- **Batch investigate** — check multiple attestations from the same auditor

---

## 9. Automated Scanning Loop

A dispute agent can run continuously in a loop. Here's the high-level workflow:

```
┌─────────────────────────────────────────────────┐
│  SCAN: Query subgraph for new attestations      │
│  Tool: aegis_check_skill (batch skills)         │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  FILTER: Select attestation targets             │
│  - New auditors with L2/L3 claims               │
│  - Auditors with history of disputes            │
│  - Skills in high-risk categories (defi, auth)  │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  VERIFY: Re-run audit criteria independently    │
│  - Fetch auditor metadata                       │
│  - Execute skill with test inputs               │
│  - Run security tools (semgrep, npm audit)      │
│  - Compare results against auditor's claims     │
└────────────────────┬────────────────────────────┘
                     │
              ┌──────┴──────┐
              │ Discrepancy? │
              └──────┬──────┘
             No      │      Yes
              │      │       │
              ▼      │       ▼
          Skip       │  ┌────────────────────────┐
                     │  │  BUILD: Prepare evidence│
                     │  │  - Document findings    │
                     │  │  - Create reproduction  │
                     │  │  - Hex-encode evidence  │
                     │  └───────────┬────────────┘
                     │              │
                     │              ▼
                     │  ┌────────────────────────┐
                     │  │  SUBMIT: Open dispute   │
                     │  │  Tool: open-dispute     │
                     │  └───────────┬────────────┘
                     │              │
                     │              ▼
                     │  ┌────────────────────────┐
                     │  │  MONITOR: Track result  │
                     │  │  Tool: get-dispute      │
                     │  └────────────────────────┘
                     │
                     ▼
              Wait interval (e.g., 1 hour)
              Then repeat from SCAN
```

### Pseudo-Workflow

```
1. Set scanning_interval = 3600  (seconds)

2. LOOP:
   a. Call aegis_browse_bounties(first: 50) to find active skills
   b. For each skill, call aegis_check_skill(skillId)
   c. For each attestation:
      - Fetch and validate auditor metadata
      - If metadata invalid → immediate dispute candidate
      - Re-run relevant criteria checks
      - If failure found → build evidence, hex-encode, submit dispute
   d. Sleep for scanning_interval
   e. Go to 2
```

---

## Quick Reference

### MCP Tools Used

| Tool | Purpose |
|------|---------|
| `aegis_check_skill` | Get full skill details + attestations + auditor data |
| `aegis_browse_unaudited` | Find skills to monitor |
| `aegis_browse_bounties` | Find active skills for scanning |
| `open-dispute` | Submit dispute with evidence + bond |
| `get-dispute` | Track dispute resolution status |

### SDK Functions Used

| Function | Package | Purpose |
|----------|---------|---------|
| `validateAuditMetadata()` | `@aegisaudit/sdk` | Validate auditor's metadata |
| `getRequiredCriteria()` | `@aegisaudit/sdk` | Get required criteria for a level |
| `dataURIToMetadata()` | `@aegisaudit/sdk` | Decode data URI metadata |
| `fetchAuditMetadata()` | `@aegisaudit/sdk` | Fetch metadata from IPFS |

### Evidence Schema

See [`shared/evidence-schema.json`](../shared/evidence-schema.json) for the full JSON Schema of the dispute evidence format.

### Example Evidence

- [Dispute Evidence Example](./examples/example-dispute-evidence.json) — L2 attestation challenged for failing L2.VALIDATE and L2.ERROR
