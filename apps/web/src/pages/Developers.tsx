import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { NavConnectWallet } from "../components/NavConnectWallet";

// ── Design System ────────────────────────────────────────────
const ACCENT = "#FF3366";
const ACCENT2 = "#FF6B9D";
const BG = "#09090B";
const SURFACE = "#131316";
const SURFACE2 = "#1A1A1F";
const SURFACE3 = "#222228";
const BORDER = "#2A2A30";
const BORDER_LIGHT = "#3A3A42";
const TEXT = "#E4E4E7";
const TEXT_DIM = "#71717A";
const TEXT_MUTED = "#52525B";

const FONT_HEAD = "'Orbitron', sans-serif";
const FONT = "'Space Mono', monospace";
const FONT_CODE = "'SF Mono', 'Cascadia Code', 'Fira Code', Menlo, Consolas, 'DejaVu Sans Mono', monospace";

// Syntax colors
const SYN_KW = "#C084FC";
const SYN_STR = "#4ADE80";
const SYN_COMMENT = "#4B5563";
const SYN_FN = "#60A5FA";
const SYN_TYPE = "#FBBF24";
const SYN_NUM = "#F87171";
const SYN_DEFAULT = "#A1A1AA";

// ── Types ────────────────────────────────────────────────────
type Lang = "ts" | "py";

interface SidenavSection {
  id: string;
  label: string;
  indent?: boolean;
}

interface MethodParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface MethodDef {
  name: string;
  signature: string;
  description: string;
  params: MethodParam[];
  returnType: string;
  tsExample: string;
  pyExample: string;
  group: string;
}

// ── Syntax Highlighter ───────────────────────────────────────
function highlight(code: string, lang: Lang): React.ReactElement[] {
  const lines = code.split("\n");
  return lines.map((line, i) => {
    const spans: React.ReactElement[] = [];
    let remaining = line;
    let key = 0;

    const push = (text: string, color: string) => {
      spans.push(<span key={key++} style={{ color }}>{text}</span>);
    };

    // Comment line
    if (lang === "ts" && remaining.trimStart().startsWith("//")) {
      push(remaining, SYN_COMMENT);
      return <div key={i} style={{ minHeight: "1.5em" }}>{spans}</div>;
    }
    if (lang === "py" && remaining.trimStart().startsWith("#")) {
      push(remaining, SYN_COMMENT);
      return <div key={i} style={{ minHeight: "1.5em" }}>{spans}</div>;
    }

    // Empty line
    if (remaining.trim() === "") {
      return <div key={i} style={{ minHeight: "1.5em" }}>{"\u00A0"}</div>;
    }

    // Token-level highlighting
    const tsKeywords = /\b(const|let|var|await|async|import|from|export|if|else|return|new|throw|try|catch|finally|typeof|class|extends|implements|interface|type|function|true|false|null|undefined|void|number|string|boolean|bigint)\b/g;
    const pyKeywords = /\b(def|class|import|from|as|if|else|elif|return|await|async|with|try|except|finally|raise|True|False|None|print|self|and|or|not|in|is|for|while|break|continue|pass|lambda|yield)\b/g;
    const stringRegex = /(["'`])(?:(?!\1|\\).|\\.)*\1/g;
    const fnCallRegex = /\b([a-zA-Z_]\w*)\s*\(/g;
    const typeRegex = /\b([A-Z][a-zA-Z0-9]+)\b/g;
    const numRegex = /\b(\d+(?:\.\d+)?n?)\b/g;

    // Simple approach: process character by character with regex matches
    const tokens: { start: number; end: number; color: string }[] = [];

    // Strings first (highest priority)
    let m: RegExpExecArray | null;
    while ((m = stringRegex.exec(remaining)) !== null) {
      tokens.push({ start: m.index, end: m.index + m[0].length, color: SYN_STR });
    }

    // Keywords
    const kwRegex = lang === "ts" ? tsKeywords : pyKeywords;
    while ((m = kwRegex.exec(remaining)) !== null) {
      if (!tokens.some(t => m!.index >= t.start && m!.index < t.end)) {
        tokens.push({ start: m.index, end: m.index + m[0].length, color: SYN_KW });
      }
    }

    // Function calls
    while ((m = fnCallRegex.exec(remaining)) !== null) {
      const fnStart = m.index;
      const fnEnd = m.index + m[1].length;
      if (!tokens.some(t => fnStart >= t.start && fnStart < t.end)) {
        tokens.push({ start: fnStart, end: fnEnd, color: SYN_FN });
      }
    }

    // Types
    while ((m = typeRegex.exec(remaining)) !== null) {
      if (!tokens.some(t => m!.index >= t.start && m!.index < t.end)) {
        tokens.push({ start: m.index, end: m.index + m[0].length, color: SYN_TYPE });
      }
    }

    // Numbers
    while ((m = numRegex.exec(remaining)) !== null) {
      if (!tokens.some(t => m!.index >= t.start && m!.index < t.end)) {
        tokens.push({ start: m.index, end: m.index + m[0].length, color: SYN_NUM });
      }
    }

    // Sort tokens by start position
    tokens.sort((a, b) => a.start - b.start);

    // Build spans
    let pos = 0;
    for (const token of tokens) {
      if (token.start > pos) {
        push(remaining.slice(pos, token.start), SYN_DEFAULT);
      }
      push(remaining.slice(token.start, token.end), token.color);
      pos = token.end;
    }
    if (pos < remaining.length) {
      push(remaining.slice(pos), SYN_DEFAULT);
    }

    return <div key={i} style={{ minHeight: "1.5em" }}>{spans}</div>;
  });
}

// ── CopyButton ───────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      style={{
        background: copied ? "rgba(74,222,128,0.15)" : SURFACE3,
        border: `1px solid ${copied ? "rgba(74,222,128,0.3)" : BORDER}`,
        borderRadius: 5,
        padding: "4px 10px",
        fontSize: 11,
        fontFamily: FONT_CODE,
        color: copied ? "#4ADE80" : TEXT_DIM,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

// ── LangTabs ─────────────────────────────────────────────────
function LangTabs({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const Tab = ({ l, label }: { l: Lang; label: string }) => {
    const active = lang === l;
    return (
      <button
        onClick={() => setLang(l)}
        style={{
          background: active ? `${ACCENT}18` : "transparent",
          border: `1px solid ${active ? `${ACCENT}40` : BORDER}`,
          borderRadius: 6,
          padding: "6px 16px",
          fontSize: 12,
          color: active ? ACCENT : TEXT_DIM,
          cursor: "pointer",
          fontWeight: active ? 700 : 400,
          transition: "all 0.15s ease",
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <Tab l="ts" label="TypeScript" />
      <Tab l="py" label="Python" />
    </div>
  );
}

// ── CodeWindow ───────────────────────────────────────────────
function CodeWindow({ code, lang, filename }: { code: string; lang: Lang; filename?: string }) {
  return (
    <div style={{
      background: "#0D0D10",
      border: `1px solid ${BORDER}`,
      borderRadius: 10,
      overflow: "hidden",
      marginTop: 12,
      marginBottom: 16,
    }}>
      {/* Title bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
        borderBottom: `1px solid ${BORDER}`,
        background: SURFACE,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#EAB308" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22C55E" }} />
          </div>
          {filename && (
            <span style={{
              fontFamily: FONT_CODE, fontSize: 11, color: TEXT_DIM,
              background: SURFACE2, padding: "2px 8px", borderRadius: 4,
              border: `1px solid ${BORDER}`,
            }}>
              {filename}
            </span>
          )}
          <span style={{
            fontFamily: FONT_CODE, fontSize: 9, color: TEXT_MUTED,
            background: SURFACE2, padding: "1px 6px", borderRadius: 3,
            textTransform: "uppercase",
          }}>
            {lang === "ts" ? "typescript" : "python"}
          </span>
        </div>
        <CopyButton text={code} />
      </div>
      {/* Code */}
      <div style={{
        padding: "16px 20px",
        fontFamily: FONT_CODE,
        fontSize: 13,
        lineHeight: 1.6,
        overflowX: "auto",
      }}>
        {highlight(code, lang)}
      </div>
    </div>
  );
}

// ── SidenavItem ──────────────────────────────────────────────
function SidenavItem({ label, active, indent, onClick }: {
  label: string; active: boolean; indent?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "transparent",
        border: "none",
        borderLeft: active ? `2px solid ${ACCENT}` : "2px solid transparent",
        padding: `6px 16px 6px ${indent ? 28 : 16}px`,
        fontSize: indent ? 12 : 12.5,
        fontWeight: active ? 600 : 400,
        color: active ? ACCENT : TEXT_DIM,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={e => {
        if (!active) (e.target as HTMLElement).style.color = TEXT;
      }}
      onMouseLeave={e => {
        if (!active) (e.target as HTMLElement).style.color = TEXT_DIM;
      }}
    >
      {label}
    </button>
  );
}

// ── ConfigTable ──────────────────────────────────────────────
function ConfigTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{
      border: `1px solid ${BORDER}`,
      borderRadius: 8,
      overflow: "hidden",
      marginTop: 12,
      marginBottom: 16,
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${headers.length}, 1fr)`,
        padding: "10px 16px",
        background: SURFACE,
        borderBottom: `1px solid ${BORDER}`,
        fontSize: 10,
        color: TEXT_MUTED,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}>
        {headers.map((h, i) => <span key={i}>{h}</span>)}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} style={{
          display: "grid",
          gridTemplateColumns: `repeat(${headers.length}, 1fr)`,
          padding: "10px 16px",
          borderBottom: ri < rows.length - 1 ? `1px solid ${BORDER}` : "none",
          fontSize: 12,
        }}>
          {row.map((cell, ci) => (
            <span key={ci} style={{
              color: ci === 0 ? SYN_FN : (ci === 1 ? SYN_TYPE : TEXT_DIM),
              wordBreak: "break-word",
            }}>
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── MethodCard ───────────────────────────────────────────────
function MethodCard({ method, lang, expanded, onToggle }: {
  method: MethodDef; lang: Lang; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div style={{
      border: `1px solid ${expanded ? `${ACCENT}30` : BORDER}`,
      borderRadius: 10,
      overflow: "hidden",
      marginBottom: 10,
      transition: "border-color 0.15s ease",
    }}>
      {/* Collapsed header */}
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "14px 16px",
          background: expanded ? SURFACE2 : SURFACE,
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 0.15s ease",
        }}
      >
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: SYN_FN }}>
            {method.name}
          </span>
          <span style={{ fontSize: 12, color: TEXT_MUTED, marginLeft: 8 }}>
            {method.signature}
          </span>
          <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 4 }}>
            {method.description}
          </div>
        </div>
        <span style={{
          color: TEXT_MUTED, fontSize: 16,
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s ease",
        }}>
          ▾
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: "16px", background: SURFACE, borderTop: `1px solid ${BORDER}` }}>
          {/* Parameters */}
          {method.params.length > 0 && (
            <>
              <h4 style={{
                fontSize: 11, color: TEXT_MUTED,
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8,
              }}>
                Parameters
              </h4>
              <ConfigTable
                headers={["Name", "Type", "Required", "Description"]}
                rows={method.params.map(p => [
                  p.name,
                  p.type,
                  p.required ? "Yes" : "No",
                  p.description,
                ])}
              />
            </>
          )}

          {/* Return type */}
          <div style={{ marginBottom: 12 }}>
            <span style={{
              fontSize: 11, color: TEXT_MUTED,
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              Returns:{" "}
            </span>
            <span style={{ fontSize: 12, color: SYN_TYPE }}>
              {method.returnType}
            </span>
          </div>

          {/* Code example */}
          <CodeWindow
            code={lang === "ts" ? method.tsExample : method.pyExample}
            lang={lang}
            filename={lang === "ts" ? "example.ts" : "example.py"}
          />
        </div>
      )}
    </div>
  );
}

// ── SDK Methods Data (from actual codebase) ──────────────────
const METHODS: MethodDef[] = [
  // ── Read Operations ──
  {
    name: "verify",
    signature: "(skillHash, attestationIndex) → Promise<boolean>",
    description: "Verify an attestation's ZK proof on-chain via the UltraHonk verifier contract.",
    group: "Core Queries",
    returnType: "Promise<boolean>",
    params: [
      { name: "skillHash", type: "Hex (bytes32)", required: true, description: "keccak256 hash of the skill package" },
      { name: "attestationIndex", type: "number", required: true, description: "Index of the attestation to verify" },
    ],
    tsExample: `import { AegisClient } from '@aegisaudit/sdk';

// Registry address auto-resolved for Base Sepolia
const client = new AegisClient({ chainId: 8453 });

const skillHash = '0x183c9388...';
const isValid = await client.verify(skillHash, 0);

if (isValid) {
  console.log('ZK proof verified on-chain');
}`,
    pyExample: `from aegis_sdk import AegisClient

client = AegisClient(chain_id=8453)

skill_hash = "0x183c9388..."
is_valid = await client.verify(skill_hash, 0)

if is_valid:
    print("ZK proof verified on-chain")`,
  },
  {
    name: "getAttestations",
    signature: "(skillHash) → Promise<Attestation[]>",
    description: "Retrieve all attestations for a given skill hash from the on-chain registry.",
    group: "Core Queries",
    returnType: "Promise<Attestation[]>",
    params: [
      { name: "skillHash", type: "Hex (bytes32)", required: true, description: "keccak256 hash of the skill package" },
    ],
    tsExample: `const attestations = await client.getAttestations(skillHash);

for (const att of attestations) {
  console.log('Level:', att.auditLevel);
  console.log('Stake:', att.stakeAmount);
  console.log('Auditor:', att.auditorCommitment);
  console.log('Timestamp:', att.timestamp);
}`,
    pyExample: `attestations = await client.get_attestations(skill_hash)

for att in attestations:
    print(f"Level: {att.audit_level}")
    print(f"Stake: {att.stake_amount}")
    print(f"Auditor: {att.auditor_commitment}")
    print(f"Timestamp: {att.timestamp}")`,
  },
  {
    name: "getAuditorReputation",
    signature: "(auditorCommitment) → Promise<AuditorReputation>",
    description: "Look up an auditor's reputation score, total stake, and attestation count.",
    group: "Core Queries",
    returnType: "Promise<AuditorReputation>",
    params: [
      { name: "auditorCommitment", type: "Hex (bytes32)", required: true, description: "Pedersen hash commitment identifying the auditor" },
    ],
    tsExample: `const rep = await client.getAuditorReputation(
  '0x1a65fb21...'
);

console.log('Score:', rep.score);        // bigint
console.log('Staked:', rep.totalStake);   // bigint (wei)
console.log('Audits:', rep.attestationCount);`,
    pyExample: `rep = await client.get_auditor_reputation(
    "0x1a65fb21..."
)

print(f"Score: {rep.score}")
print(f"Staked: {rep.total_stake}")
print(f"Audits: {rep.attestation_count}")`,
  },
  // ── Discovery (v0.2.0) ──
  {
    name: "listAllSkills",
    signature: "(options?) → Promise<SkillRegisteredEvent[]>",
    description: "Discover all registered skills by scanning on-chain events. Returns skill hashes with audit levels and auditor info.",
    group: "Discovery",
    returnType: "Promise<SkillRegisteredEvent[]>",
    params: [
      { name: "options.fromBlock", type: "bigint", required: false, description: "Start block (defaults to deployment block)" },
      { name: "options.toBlock", type: "bigint", required: false, description: "End block (defaults to latest)" },
    ],
    tsExample: `const skills = await client.listAllSkills();

for (const s of skills) {
  console.log('Hash:', s.skillHash);
  console.log('Level:', s.auditLevel);
  console.log('Auditor:', s.auditorCommitment);
  console.log('Block:', s.blockNumber);
}`,
    pyExample: `skills = await client.list_all_skills()

for s in skills:
    print(f"Hash: {s.skill_hash}")
    print(f"Level: {s.audit_level}")
    print(f"Auditor: {s.auditor_commitment}")`,
  },
  {
    name: "listAllAuditors",
    signature: "(options?) → Promise<AuditorRegisteredEvent[]>",
    description: "Browse all registered auditors by scanning on-chain events. Returns commitments and initial stake amounts.",
    group: "Discovery",
    returnType: "Promise<AuditorRegisteredEvent[]>",
    params: [
      { name: "options.fromBlock", type: "bigint", required: false, description: "Start block (defaults to deployment block)" },
      { name: "options.toBlock", type: "bigint", required: false, description: "End block (defaults to latest)" },
    ],
    tsExample: `const auditors = await client.listAllAuditors();

for (const a of auditors) {
  console.log('Commitment:', a.auditorCommitment);
  console.log('Stake:', a.stake, 'wei');
}`,
    pyExample: `auditors = await client.list_all_auditors()

for a in auditors:
    print(f"Commitment: {a.auditor_commitment}")
    print(f"Stake: {a.stake} wei")`,
  },
  {
    name: "getMetadataURI",
    signature: "(skillHash) → Promise<string>",
    description: "Get the metadata URI for a registered skill. Returns the IPFS or HTTP link to skill metadata JSON.",
    group: "Discovery",
    returnType: "Promise<string>",
    params: [
      { name: "skillHash", type: "Hex (bytes32)", required: true, description: "Hash of the registered skill" },
    ],
    tsExample: `const uri = await client.getMetadataURI(skillHash);
console.log(uri);
// → {"name": "Flow Protocol Skill", "description": "...", "category": "DeFi"}`,
    pyExample: `uri = await client.get_metadata_uri(skill_hash)
print(uri)
# → {"name": "Flow Protocol Skill", ...}`,
  },
  {
    name: "listDisputes",
    signature: "(options?) → Promise<DisputeOpenedEvent[]>",
    description: "List all opened disputes. Optionally filter by skill hash.",
    group: "Discovery",
    returnType: "Promise<DisputeOpenedEvent[]>",
    params: [
      { name: "options.skillHash", type: "Hex", required: false, description: "Filter disputes for a specific skill" },
      { name: "options.fromBlock", type: "bigint", required: false, description: "Start block" },
    ],
    tsExample: `// All disputes
const disputes = await client.listDisputes();

// Disputes for a specific skill
const skillDisputes = await client.listDisputes({
  skillHash: '0x183c9388...',
});`,
    pyExample: `# All disputes
disputes = await client.list_disputes()

# Disputes for a specific skill
skill_disputes = await client.list_disputes(
    skill_hash="0x183c9388..."
)`,
  },
  // ── Write Operations ──
  {
    name: "registerSkill",
    signature: "(params: RegisterSkillParams) → Promise<Hex>",
    description: "Submit a verified skill attestation with ZK proof to the on-chain registry. Requires 0.001 ETH fee.",
    group: "Write Operations",
    returnType: "Promise<Hex> (tx hash)",
    params: [
      { name: "skillHash", type: "Hex (bytes32)", required: true, description: "keccak256 hash of the skill package" },
      { name: "metadataURI", type: "string", required: true, description: "IPFS URI for skill metadata (ipfs://...)" },
      { name: "attestationProof", type: "Hex", required: true, description: "Serialized UltraHonk proof bytes" },
      { name: "publicInputs", type: "Hex[]", required: true, description: "Public inputs: [skillHash, criteriaHash, auditLevel, auditorCommitment]" },
      { name: "auditorCommitment", type: "Hex (bytes32)", required: true, description: "Pedersen hash of auditor private key" },
      { name: "auditLevel", type: "1 | 2 | 3", required: true, description: "Audit tier: L1 Basic, L2 Standard, L3 Comprehensive" },
      { name: "fee", type: "bigint", required: false, description: "Registration fee in wei (default: 0.001 ETH)" },
    ],
    tsExample: `import { AegisClient, generateAttestationViaCLI } from '@aegisaudit/sdk';
import { createWalletClient, http } from 'viem';
import { base } from 'viem/chains';

const wallet = createWalletClient({
  chain: base,
  transport: http(),
});
client.setWallet(wallet);

// Generate proof
const proof = await generateAttestationViaCLI({
  circuitsDir: './packages/circuits',
});

const txHash = await client.registerSkill({
  skillHash: '0x4cd3b629...',
  metadataURI: 'ipfs://Qm...',
  attestationProof: proof.proof,
  publicInputs: proof.publicInputs,
  auditorCommitment: '0x1a65fb21...',
  auditLevel: 1,
});`,
    pyExample: `from aegis_sdk import AegisClient

# Attach wallet for write operations
client.set_wallet(wallet)

# Generate proof (via CLI)
proof = await generate_attestation_via_cli(
    circuits_dir="./packages/circuits",
)

tx_hash = await client.register_skill(
    skill_hash="0x4cd3b629...",
    metadata_uri="ipfs://Qm...",
    attestation_proof=proof.proof,
    public_inputs=proof.public_inputs,
    auditor_commitment="0x1a65fb21...",
    audit_level=1,
)`,
  },
  {
    name: "registerAuditor",
    signature: "(auditorCommitment, stakeAmount) → Promise<Hex>",
    description: "Register as an anonymous auditor by committing a Pedersen hash identity and staking ETH. Minimum stake: 0.01 ETH.",
    group: "Write Operations",
    returnType: "Promise<Hex> (tx hash)",
    params: [
      { name: "auditorCommitment", type: "Hex (bytes32)", required: true, description: "Pedersen hash of the auditor's private key" },
      { name: "stakeAmount", type: "bigint", required: true, description: "ETH to stake in wei (min 0.01 ETH = 10000000000000000n)" },
    ],
    tsExample: `import { parseEther } from 'viem';

const txHash = await client.registerAuditor(
  '0x1a65fb21...',        // auditorCommitment
  parseEther('0.05'),     // stake 0.05 ETH
);

console.log('Registered:', txHash);`,
    pyExample: `from web3 import Web3

tx_hash = await client.register_auditor(
    auditor_commitment="0x1a65fb21...",
    stake_amount=Web3.to_wei(0.05, "ether"),
)

print(f"Registered: {tx_hash}")`,
  },
  {
    name: "addStake",
    signature: "(auditorCommitment, amount) → Promise<Hex>",
    description: "Add more stake to an existing auditor registration. Increases reputation and trust level.",
    group: "Write Operations",
    returnType: "Promise<Hex> (tx hash)",
    params: [
      { name: "auditorCommitment", type: "Hex (bytes32)", required: true, description: "Pedersen hash of the auditor's private key" },
      { name: "amount", type: "bigint", required: true, description: "Additional ETH to stake in wei" },
    ],
    tsExample: `import { parseEther } from 'viem';

const txHash = await client.addStake(
  '0x1b90cf3b...',         // auditorCommitment
  parseEther('0.01'),      // add 0.01 ETH
);`,
    pyExample: `from web3 import Web3

tx_hash = await client.add_stake(
    auditor_commitment="0x1b90cf3b...",
    amount=Web3.to_wei(0.01, "ether"),
)`,
  },
  // ── Dispute Operations ──
  {
    name: "openDispute",
    signature: "(skillHash, attestationIndex, evidence, bond) → Promise<Hex>",
    description: "Open a dispute against a skill attestation. Requires a minimum bond of 0.005 ETH. If the auditor is found at fault, 50% of their stake is slashed and sent to the challenger.",
    group: "Disputes",
    returnType: "Promise<Hex> (tx hash)",
    params: [
      { name: "skillHash", type: "Hex (bytes32)", required: true, description: "Hash of the disputed skill" },
      { name: "attestationIndex", type: "number", required: true, description: "Index of the contested attestation" },
      { name: "evidence", type: "Hex", required: true, description: "Encoded evidence supporting the dispute" },
      { name: "bond", type: "bigint", required: true, description: "Dispute bond in wei (min 0.005 ETH)" },
    ],
    tsExample: `import { parseEther, toHex } from 'viem';

const evidence = toHex(
  'Source code contains backdoor in line 42'
);

const txHash = await client.openDispute(
  '0x4cd3b629...',       // skillHash
  0,                      // attestationIndex
  evidence,
  parseEther('0.01'),     // bond
);`,
    pyExample: `from web3 import Web3

evidence = "0x" + "Source code contains backdoor".encode().hex()

tx_hash = await client.open_dispute(
    skill_hash="0x4cd3b629...",
    attestation_index=0,
    evidence=evidence,
    bond=Web3.to_wei(0.01, "ether"),
)`,
  },
  {
    name: "resolveDispute",
    signature: "(disputeId, auditorFault) → Promise<Hex>",
    description: "Resolve an open dispute. Contract owner only. If auditorFault is true, 50% of the auditor's stake is slashed.",
    group: "Disputes",
    returnType: "Promise<Hex> (tx hash)",
    params: [
      { name: "disputeId", type: "bigint", required: true, description: "ID of the dispute to resolve" },
      { name: "auditorFault", type: "boolean", required: true, description: "Whether the auditor was at fault" },
    ],
    tsExample: `// Owner-only operation
const txHash = await client.resolveDispute(
  1n,      // disputeId
  true,    // auditorFault — slash 50% of stake
);`,
    pyExample: `# Owner-only operation
tx_hash = await client.resolve_dispute(
    dispute_id=1,
    auditor_fault=True,  # slash 50% of stake
)`,
  },
];

// ── Prover Methods ───────────────────────────────────────────
const PROVER_METHODS: MethodDef[] = [
  {
    name: "generateAttestationViaCLI",
    signature: "(options: CLIProveOptions) → Promise<ProofResult>",
    description: "Generate a ZK attestation proof using nargo + bb CLI tools. Recommended approach — works on all platforms via WSL on Windows.",
    group: "ZK Proving",
    returnType: "Promise<ProofResult>",
    params: [
      { name: "circuitsDir", type: "string", required: true, description: "Path to the circuits package directory (containing Nargo.toml)" },
      { name: "useWSL", type: "boolean", required: false, description: "Run nargo/bb via WSL (auto-detected on Windows)" },
      { name: "wslDistro", type: "string", required: false, description: "WSL distribution name (default: 'Ubuntu')" },
      { name: "proverToml", type: "string", required: false, description: "Custom Prover.toml content. Uses existing if not provided." },
    ],
    tsExample: `import { generateAttestationViaCLI, buildProverToml } from '@aegisaudit/sdk';

const result = await generateAttestationViaCLI({
  circuitsDir: './packages/circuits',
  proverToml: buildProverToml({
    sourceCode: Array(64).fill('1'),
    auditResults: Array(32).fill('1'),
    auditorPrivateKey: '12345',
    skillHash: '0x0eba0c96...',
    criteriaHash: '0x1c5562cc...',
    auditLevel: 1,
    auditorCommitment: '0x1a65fb21...',
  }),
});

console.log(result.proof);         // 0x...
console.log(result.publicInputs); // ['0x...', ...]`,
    pyExample: `from aegis_sdk import generate_attestation_via_cli, build_prover_toml

result = await generate_attestation_via_cli(
    circuits_dir="./packages/circuits",
    prover_toml=build_prover_toml(
        source_code=["1"] * 64,
        audit_results=["1"] * 32,
        auditor_private_key="12345",
        skill_hash="0x0eba0c96...",
        criteria_hash="0x1c5562cc...",
        audit_level=1,
        auditor_commitment="0x1a65fb21...",
    ),
)

print(result.proof)
print(result.public_inputs)`,
  },
  {
    name: "loadProofFromFiles",
    signature: "(proofPath, publicInputsPath) → Promise<ProofResult>",
    description: "Load a pre-generated proof and public inputs from binary files output by bb prove.",
    group: "ZK Proving",
    returnType: "Promise<ProofResult>",
    params: [
      { name: "proofPath", type: "string", required: true, description: "Path to the proof binary file" },
      { name: "publicInputsPath", type: "string", required: true, description: "Path to the public_inputs binary file" },
    ],
    tsExample: `import { loadProofFromFiles } from '@aegisaudit/sdk';

const result = await loadProofFromFiles(
  './packages/circuits/target/proof',
  './packages/circuits/target/public_inputs',
);

console.log(result.proof);         // 0x...
console.log(result.publicInputs); // ['0x...', '0x...', '0x...', '0x...']`,
    pyExample: `from aegis_sdk import load_proof_from_files

result = await load_proof_from_files(
    proof_path="./packages/circuits/target/proof",
    public_inputs_path="./packages/circuits/target/public_inputs",
)

print(result.proof)
print(result.public_inputs)`,
  },

  // ── Trust API ──
  {
    name: "getTrustProfile",
    signature: "(agentId, options?) → Promise<TrustProfile>",
    description: "Build an aggregated trust profile for an agent. Combines AEGIS attestation data with ERC-8004 validation and reputation into a composite 0-100 trust score and level classification (unknown/basic/verified/trusted). Direct mode — queries on-chain, no x402 payment needed.",
    group: "Trust API",
    returnType: "Promise<TrustProfile>",
    params: [
      { name: "agentId", type: "bigint", required: true, description: "ERC-8004 agent identity ID" },
      { name: "options.knownSkillHashes", type: "Hex[]", required: false, description: "Skip skill scan by providing known linked skill hashes" },
    ],
    tsExample: `const profile = await client.getTrustProfile(42n);

console.log(profile.overall.trustScore);  // 85
console.log(profile.overall.level);       // 'trusted'
console.log(profile.skills.length);       // 3
console.log(profile.validation);          // { count: 2n, averageScore: 66 }`,
    pyExample: `profile = await client.get_trust_profile(42)

print(profile.overall.trust_score)  # 85
print(profile.overall.level)        # 'trusted'
print(len(profile.skills))          # 3`,
  },
  {
    name: "getSkillTrustScore",
    signature: "(skillHash, options?) → Promise<SkillTrustScore>",
    description: "Get trust data for a single skill including attestations, dispute status, and highest audit level. Direct mode — queries on-chain, no x402 payment needed.",
    group: "Trust API",
    returnType: "Promise<SkillTrustScore>",
    params: [
      { name: "skillHash", type: "Hex", required: true, description: "The bytes32 skill hash" },
      { name: "options.verify", type: "boolean", required: false, description: "Re-verify ZK proofs on-chain (default: false, assumes valid)" },
    ],
    tsExample: `const score = await client.getSkillTrustScore(
  '0x1234...abcd'
);

console.log(score.highestLevel);      // 3
console.log(score.hasActiveDisputes); // false
console.log(score.attestations);      // [{ auditorCommitment, auditLevel, ... }]`,
    pyExample: `score = await client.get_skill_trust_score(
    "0x1234...abcd"
)

print(score.highest_level)       # 3
print(score.has_active_disputes) # False`,
  },
  {
    name: "createTrustApiClient",
    signature: "(walletClient, baseUrl) → Promise<TrustApiClient>",
    description: "Create a typed client for the x402-gated Trust Profile API. Wraps fetch with automatic USDC micropayments on Base via Coinbase's x402 protocol.",
    group: "Trust API",
    returnType: "Promise<TrustApiClient>",
    params: [
      { name: "walletClient", type: "WalletClient", required: true, description: "Viem wallet client for signing USDC payments" },
      { name: "baseUrl", type: "string", required: true, description: "Trust API server URL" },
    ],
    tsExample: `import { createTrustApiClient } from '@aegisaudit/sdk';

const api = await createTrustApiClient(
  wallet,
  'https://trust.aegisprotocol.tech'
);

// Pay 10c USDC, get aggregated profile
const profile = await api.getProfile(42n);

// Pay 50c USDC, batch query
const profiles = await api.batchProfiles([1n, 2n, 3n]);`,
    pyExample: `# Python client not yet available
# Use direct HTTP with x402 headers`,
  },
  {
    name: "createTrustApiMiddleware",
    signature: "(config) → Promise<Express.Router>",
    description: "Create Express middleware for hosting an x402-gated Trust Profile API. Serves aggregated trust data for USDC micropayments on Base. Returns a Router with 3 endpoints.",
    group: "Trust API",
    returnType: "Promise<Express.Router>",
    params: [
      { name: "config.paymentAddress", type: "Address", required: true, description: "Wallet address to receive USDC payments" },
      { name: "config.chainId", type: "number", required: true, description: "Chain ID (8453 or 84532)" },
      { name: "config.pricing", type: "TrustApiPricing", required: true, description: "USDC prices: { profileQuery, skillQuery, batchQuery }" },
    ],
    tsExample: `import express from 'express';
import { createTrustApiMiddleware } from '@aegisaudit/sdk';

const app = express();
app.use(express.json());

const router = await createTrustApiMiddleware({
  paymentAddress: '0xYour...',
  chainId: 8453,
  pricing: {
    profileQuery: '0.10',
    skillQuery: '0.05',
    batchQuery: '0.50',
  },
});

app.use(router);
app.listen(3001);`,
    pyExample: `# Server middleware is TypeScript/Express only`,
  },
];

// ── Sidebar Sections ─────────────────────────────────────────
const SECTIONS: SidenavSection[] = [
  { id: "quick-start", label: "Quick Start" },
  { id: "installation", label: "Installation" },
  { id: "configuration", label: "Configuration" },
  { id: "core-methods", label: "Core Methods" },
  { id: "method-verify", label: "verify()", indent: true },
  { id: "method-getAttestations", label: "getAttestations()", indent: true },
  { id: "method-getAuditorReputation", label: "getAuditorReputation()", indent: true },
  { id: "discovery", label: "Discovery" },
  { id: "method-listAllSkills", label: "listAllSkills()", indent: true },
  { id: "method-listAllAuditors", label: "listAllAuditors()", indent: true },
  { id: "method-getMetadataURI", label: "getMetadataURI()", indent: true },
  { id: "method-listDisputes", label: "listDisputes()", indent: true },
  { id: "audit-metadata", label: "Audit Metadata" },
  { id: "method-createAuditTemplate", label: "createAuditTemplate()", indent: true },
  { id: "method-validateAuditMetadata", label: "validateAuditMetadata()", indent: true },
  { id: "submitting", label: "Write Operations" },
  { id: "method-registerSkill", label: "registerSkill()", indent: true },
  { id: "method-registerAuditor", label: "registerAuditor()", indent: true },
  { id: "method-addStake", label: "addStake()", indent: true },
  { id: "zk-proving", label: "ZK Proving" },
  { id: "method-generateAttestationViaCLI", label: "generateAttestationViaCLI()", indent: true },
  { id: "method-loadProofFromFiles", label: "loadProofFromFiles()", indent: true },
  { id: "disputes", label: "Disputes" },
  { id: "method-openDispute", label: "openDispute()", indent: true },
  { id: "method-resolveDispute", label: "resolveDispute()", indent: true },
  { id: "trust-api", label: "Trust API" },
  { id: "method-getTrustProfile", label: "getTrustProfile()", indent: true },
  { id: "method-getSkillTrustScore", label: "getSkillTrustScore()", indent: true },
  { id: "method-createTrustApiClient", label: "createTrustApiClient()", indent: true },
  { id: "method-createTrustApiMiddleware", label: "createTrustApiMiddleware()", indent: true },
  { id: "events", label: "Contract Events" },
  { id: "errors", label: "Error Handling" },
];

// ── Contract Events ──────────────────────────────────────────
const EVENTS = [
  { name: "SkillRegistered", params: "skillHash (indexed bytes32), auditLevel (uint8), auditorCommitment (bytes32)", description: "Emitted when a new skill attestation is registered" },
  { name: "AuditorRegistered", params: "auditorCommitment (indexed bytes32), stake (uint256)", description: "Emitted when a new auditor registers with stake" },
  { name: "StakeAdded", params: "auditorCommitment (indexed bytes32), amount (uint256), totalStake (uint256)", description: "Emitted when an auditor adds to their stake" },
  { name: "DisputeOpened", params: "disputeId (indexed uint256), skillHash (indexed bytes32)", description: "Emitted when a dispute is opened against an attestation" },
  { name: "DisputeResolved", params: "disputeId (indexed uint256), auditorSlashed (bool)", description: "Emitted when a dispute is resolved by governance" },
  { name: "UnstakeInitiated", params: "auditorCommitment (indexed bytes32), amount (uint256), unlockTimestamp (uint256)", description: "Emitted when an auditor starts the 3-day unstake cooldown" },
  { name: "UnstakeCompleted", params: "auditorCommitment (indexed bytes32), amount (uint256)", description: "Emitted when unstaked ETH is withdrawn after cooldown" },
  { name: "UnstakeCancelled", params: "auditorCommitment (indexed bytes32), amount (uint256)", description: "Emitted when a pending unstake request is cancelled" },
];

// ── Error Codes ──────────────────────────────────────────────
const ERRORS = [
  { code: "InvalidProof", message: "ZK proof verification failed", fix: "Ensure proof was generated with matching public inputs and the correct circuit version" },
  { code: "InsufficientStake", message: "Auditor stake below minimum requirement", fix: "Send at least 0.01 ETH (MIN_AUDITOR_STAKE) when registering" },
  { code: "AuditorAlreadyRegistered", message: "Auditor commitment already registered", fix: "This commitment is taken. Generate a new Pedersen commitment from a different key" },
  { code: "AuditorNotRegistered", message: "Auditor commitment not found in registry", fix: "Register the auditor first via registerAuditor() before submitting skills" },
  { code: "InvalidAuditLevel", message: "Invalid audit level (must be 1-3)", fix: "Set auditLevel to 1 (Basic), 2 (Standard), or 3 (Comprehensive)" },
  { code: "InsufficientFee", message: "Registration fee not met", fix: "Send at least 0.001 ETH (REGISTRATION_FEE) with registerSkill" },
  { code: "InsufficientDisputeBond", message: "Dispute bond too low", fix: "Send at least 0.005 ETH (MIN_DISPUTE_BOND) when opening a dispute" },
  { code: "AttestationNotFound", message: "Attestation index out of bounds", fix: "Check attestation exists via getAttestations() before verifying or disputing" },
  { code: "DisputeAlreadyResolved", message: "Dispute has already been resolved", fix: "This dispute was already resolved. No further action needed." },
  { code: "Unauthorized", message: "Caller is not authorized for this action", fix: "Only the contract owner (protocol admin) can resolve disputes" },
  { code: "InvalidUnstakeAmount", message: "Unstake amount is invalid", fix: "Amount must be > 0, <= totalStake, and leave at least 0.01 ETH (or be a full withdrawal)" },
  { code: "ActiveDisputesExist", message: "Cannot unstake while disputes are active", fix: "Wait for all active disputes to be resolved before unstaking" },
  { code: "UnstakeAlreadyPending", message: "An unstake request is already in progress", fix: "Cancel or complete the existing request before starting a new one" },
  { code: "NoActiveUnstakeRequest", message: "No pending unstake request found", fix: "Call initiateUnstake() first to start the cooldown" },
  { code: "UnstakeCooldownNotMet", message: "3-day cooldown has not elapsed", fix: "Wait for the unlockTimestamp to pass before calling completeUnstake()" },
  { code: "UnstakeTransferFailed", message: "ETH transfer failed during unstake", fix: "Ensure the receiving address can accept ETH (not a contract that rejects transfers)" },
];

// ── NavBar ───────────────────────────────────────────────────
function DevNavBar() {
  const navigate = useNavigate();
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      padding: "0 40px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "rgba(9,9,11,0.95)",
      backdropFilter: "blur(20px)",
      borderBottom: `1px solid ${BORDER}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => navigate("/")}>
        <div style={{
          width: 28, height: 28, border: `2px solid ${ACCENT}`, borderRadius: 4,
          transform: "rotate(45deg)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ width: 8, height: 8, background: ACCENT, borderRadius: 1 }} />
        </div>
        <span style={{ fontFamily: FONT_HEAD, fontSize: 18, fontWeight: 700, color: TEXT, letterSpacing: "-0.02em" }}>
          AEGIS
        </span>
        <span style={{
          fontSize: 10, color: ACCENT, background: `${ACCENT}18`,
          border: `1px solid ${ACCENT}30`, borderRadius: 4, padding: "2px 8px",
          fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          Developers
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        {[
          { label: "Registry", onClick: () => navigate("/registry") },
          { label: "Dashboard", onClick: () => navigate("/dashboard") },
          { label: "Auditors", onClick: () => navigate("/auditors") },
          { label: "Developers", onClick: () => navigate("/developers") },
          { label: "Docs", onClick: () => navigate("/docs") },
        ].map(item => (
          <a key={item.label} href="#" style={{
            color: item.label === "Developers" ? TEXT : TEXT_DIM,
            textDecoration: item.label === "Developers" ? "underline" : "none",
            textUnderlineOffset: 6,
            textDecorationColor: item.label === "Developers" ? ACCENT : "transparent",
            fontSize: 13,
            fontWeight: item.label === "Developers" ? 600 : 400,
            transition: "color 0.2s",
            cursor: item.label === "Developers" ? "default" : "pointer",
          }}
            onClick={e => { e.preventDefault(); if (item.label !== "Developers" && item.onClick) item.onClick(); }}
            onMouseEnter={e => {
              if (item.label !== "Developers") (e.target as HTMLElement).style.color = TEXT;
            }}
            onMouseLeave={e => {
              if (item.label !== "Developers") (e.target as HTMLElement).style.color = TEXT_DIM;
            }}
          >{item.label}</a>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginLeft: -8 }}>
          <a href="https://github.com/aegisaudit/aegis" target="_blank" rel="noopener noreferrer" title="GitHub"
            style={{ color: TEXT_DIM, transition: "color 0.2s", display: "flex" }}
            onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
            onMouseLeave={e => (e.currentTarget.style.color = TEXT_DIM)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          </a>
          <a href="https://www.npmjs.com/package/@aegisaudit/sdk" target="_blank" rel="noopener noreferrer" title="npm"
            style={{ color: TEXT_DIM, transition: "color 0.2s", display: "flex" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#CB3837")}
            onMouseLeave={e => (e.currentTarget.style.color = TEXT_DIM)}>
            <svg width="20" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M0 256V0h256v256H0zm49.6-49.6h46.4V92.8H128v113.6h32V46.4H49.6v160z"/></svg>
          </a>
        </div>
        <NavConnectWallet />
      </div>
    </nav>
  );
}

// ── Main Component ───────────────────────────────────────────
export function Developers() {
  const [lang, setLang] = useState<Lang>("ts");
  const [activeSection, setActiveSection] = useState("quick-start");
  const [expandedMethod, setExpandedMethod] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Scroll tracking via IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    Object.values(sectionRefs.current).forEach(el => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const setRef = useCallback((id: string) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  }, []);

  const toggleMethod = (name: string) => {
    setExpandedMethod(prev => prev === name ? null : name);
  };

  // Group methods
  const coreQueries = METHODS.filter(m => m.group === "Core Queries");
  const discoveryOps = METHODS.filter(m => m.group === "Discovery");
  const writeOps = METHODS.filter(m => m.group === "Write Operations");
  const disputeOps = METHODS.filter(m => m.group === "Disputes");
  const trustOps = METHODS.filter(m => m.group === "Trust API");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { background: ${BG}; color: ${TEXT}; overflow-x: hidden; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${BG}; }
        ::-webkit-scrollbar-thumb { background: ${BORDER}; border-radius: 3px; }
      `}</style>

      <DevNavBar />

      <div style={{ display: "flex", paddingTop: 64, minHeight: "100vh" }}>
        {/* Sidebar */}
        <aside style={{
          position: "fixed", top: 64, left: 0, bottom: 0,
          width: 240, padding: "24px 0",
          borderRight: `1px solid ${BORDER}`,
          background: BG, overflowY: "auto",
          zIndex: 50,
        }}>
          <div style={{
            fontSize: 10, color: TEXT_MUTED,
            textTransform: "uppercase", letterSpacing: "0.08em",
            padding: "0 16px 12px",
          }}>
            Documentation
          </div>
          {SECTIONS.map(s => (
            <SidenavItem
              key={s.id}
              label={s.label}
              active={activeSection === s.id}
              indent={s.indent}
              onClick={() => scrollTo(s.id)}
            />
          ))}
        </aside>

        {/* Content */}
        <main
          ref={contentRef}
          style={{
            marginLeft: 240,
            flex: 1,
            maxWidth: 820,
            padding: "40px 48px 120px",
          }}
        >
          {/* ═══ Quick Start ═══ */}
          <section id="quick-start" ref={setRef("quick-start")}>
            <h1 style={{
              fontFamily: FONT_HEAD, fontSize: 28, fontWeight: 800,
              color: TEXT, letterSpacing: "-0.02em", marginBottom: 12,
            }}>
              AEGIS SDK
            </h1>
            <p style={{
              fontSize: 14, color: TEXT_DIM,
              lineHeight: 1.7, marginBottom: 24, maxWidth: 620,
            }}>
              TypeScript SDK for interacting with the AEGIS Protocol — the on-chain registry for ZK-verified AI agent skill attestations on Base L2. Query attestations, verify proofs, submit skills, and manage auditor identities.
            </p>
            <LangTabs lang={lang} setLang={setLang} />

            <CodeWindow
              code={lang === "ts"
                ? `import { AegisClient } from '@aegisaudit/sdk';

// Initialize client — registry auto-resolved for Base Sepolia
const client = new AegisClient({ chainId: 8453 });

// Discover all registered skills
const skills = await client.listAllSkills();
console.log(skills.length, 'skills registered');

// Verify a skill attestation
const isValid = await client.verify(
  skills[0].skillHash,   // skillHash
  0,                      // attestation index
);

console.log('Valid:', isValid); // true`
                : `from aegis_sdk import AegisClient

# Initialize — registry auto-resolved for Base Sepolia
client = AegisClient(chain_id=8453)

# Discover all registered skills
skills = await client.list_all_skills()
print(f"{len(skills)} skills registered")

# Verify a skill attestation
is_valid = await client.verify(
    skills[0].skill_hash,   # skill_hash
    0,                       # attestation index
)

print(f"Valid: {is_valid}")  # True`}
              lang={lang}
              filename={lang === "ts" ? "quickstart.ts" : "quickstart.py"}
            />
          </section>

          {/* ═══ Installation ═══ */}
          <section id="installation" ref={setRef("installation")} style={{ marginTop: 56 }}>
            <h2 style={{
              fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 700,
              color: TEXT, marginBottom: 16,
            }}>
              Installation
            </h2>

            <h4 style={{ fontSize: 12, color: TEXT_DIM, marginBottom: 8 }}>
              Prerequisites
            </h4>
            <ul style={{
              fontSize: 13, color: TEXT_DIM,
              lineHeight: 2, paddingLeft: 20, marginBottom: 20,
            }}>
              <li>Node.js &gt;= 18.0</li>
              <li>viem &gt;= 2.21.0</li>
              <li>For ZK proving: nargo 1.0.0-beta.18 + bb 3.0.0 (via WSL on Windows)</li>
            </ul>

            <CodeWindow
              code={lang === "ts"
                ? `# Install the SDK
npm install @aegisaudit/sdk

# Optional: Install ZK proving dependencies
npm install @noir-lang/noir_js@1.0.0-beta.18
npm install @aztec/bb.js@3.0.0-nightly.20260102`
                : `# Install the SDK
pip install aegis-sdk

# Optional: Install ZK proving dependencies
pip install aegis-sdk[proving]`}
              lang={lang}
              filename="terminal"
            />
          </section>

          {/* ═══ Configuration ═══ */}
          <section id="configuration" ref={setRef("configuration")} style={{ marginTop: 56 }}>
            <h2 style={{
              fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 700,
              color: TEXT, marginBottom: 8,
            }}>
              Configuration
            </h2>
            <p style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 16, lineHeight: 1.7 }}>
              The <code style={{ color: SYN_FN, background: SURFACE2, padding: "1px 4px", borderRadius: 3 }}>AegisConfig</code> object
              configures the client connection to the AEGIS registry.
            </p>

            <ConfigTable
              headers={["Option", "Type", "Default", "Description"]}
              rows={[
                ["chainId", "number", "—", "Target chain ID (8453 = Base, 84532 = Base Sepolia)"],
                ["registryAddress", "Address (0x...)", "Auto-resolved", "Deployed AegisRegistry address (auto-resolved for known chains)"],
                ["rpcUrl", "string", "Public RPC", "Custom RPC URL (defaults to public Base RPC)"],
              ]}
            />

            <h4 style={{ fontSize: 12, color: TEXT_DIM, marginTop: 20, marginBottom: 8 }}>
              Protocol Constants
            </h4>
            <ConfigTable
              headers={["Constant", "Value", "Description"]}
              rows={[
                ["REGISTRATION_FEE", "0.001 ETH", "Fee required to register a skill attestation"],
                ["MIN_AUDITOR_STAKE", "0.01 ETH", "Minimum stake to register as an auditor"],
                ["MIN_DISPUTE_BOND", "0.005 ETH", "Minimum bond to open a dispute"],
              ]}
            />
          </section>

          {/* ═══ Core Methods ═══ */}
          <section id="core-methods" ref={setRef("core-methods")} style={{ marginTop: 56 }}>
            <h2 style={{
              fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 700,
              color: TEXT, marginBottom: 8,
            }}>
              Core Methods
            </h2>
            <p style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 16, lineHeight: 1.7 }}>
              Read-only queries that don't require a wallet connection.
            </p>

            {coreQueries.map(m => (
              <div key={m.name} id={`method-${m.name}`} ref={setRef(`method-${m.name}`)}>
                <MethodCard
                  method={m}
                  lang={lang}
                  expanded={expandedMethod === m.name}
                  onToggle={() => toggleMethod(m.name)}
                />
              </div>
            ))}
          </section>

          {/* ═══ Discovery ═══ */}
          <section id="discovery" ref={setRef("discovery")} style={{ marginTop: 56 }}>
            <h2 style={{
              fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 700,
              color: TEXT, marginBottom: 8,
            }}>
              Discovery
            </h2>
            <p style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 16, lineHeight: 1.7 }}>
              Browse registered skills, auditors, and metadata on-chain. These read-only methods scan contract events and don't require a wallet.
              <span style={{ color: SYN_TYPE, fontSize: 11, marginLeft: 8, fontWeight: 700 }}>v0.2.0</span>
            </p>

            {discoveryOps.map(m => (
              <div key={m.name} id={`method-${m.name}`} ref={setRef(`method-${m.name}`)}>
                <MethodCard
                  method={m}
                  lang={lang}
                  expanded={expandedMethod === m.name}
                  onToggle={() => toggleMethod(m.name)}
                />
              </div>
            ))}
          </section>

          {/* ═══ Audit Metadata ═══ */}
          <section id="audit-metadata" ref={setRef("audit-metadata")} style={{ marginTop: 56 }}>
            <h2 style={{
              fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 700,
              color: TEXT, marginBottom: 8,
            }}>
              Audit Metadata
            </h2>
            <p style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 16, lineHeight: 1.7 }}>
              Every attestation includes a metadata URI pointing to a JSON document that records what was audited and what was found.
              The SDK provides helpers for creating, validating, and hashing metadata against the{" "}
              <code style={{ color: SYN_FN, background: SURFACE2, padding: "1px 4px", borderRadius: 3 }}>aegis/audit-metadata@1</code> schema.
              <span style={{ color: SYN_TYPE, fontSize: 11, marginLeft: 8, fontWeight: 700 }}>v0.3.0</span>
            </p>
          </section>

          <section id="method-createAuditTemplate" ref={setRef("method-createAuditTemplate")} style={{ marginTop: 16 }}>
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12,
              padding: "20px 24px", marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <code style={{ fontFamily: FONT_CODE, fontSize: 14, fontWeight: 700, color: SYN_FN }}>createAuditTemplate()</code>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: BG,
                  background: "#4ADE80", padding: "2px 8px", borderRadius: 3,
                }}>HELPER</span>
              </div>
              <p style={{ fontSize: 12.5, color: TEXT_DIM, lineHeight: 1.7, marginBottom: 16 }}>
                Generate a pre-populated metadata template with all required criteria for a given audit level. Fill in results as you perform each check.
              </p>
              <div style={{
                background: "#0D0D10", borderRadius: 8, padding: "16px 20px",
                fontFamily: FONT_CODE, fontSize: 12, lineHeight: 1.6, overflow: "auto",
                border: `1px solid ${BORDER}`,
              }}>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: SYN_DEFAULT }}>{highlight(lang === "ts" ? `import {
  createAuditTemplate,
  validateAuditMetadata,
  computeCriteriaHash,
  getRequiredCriteria,
  uploadMetadata,
} from '@aegisaudit/sdk';

// 1. Create template — pre-fills all required criteria for L2
const metadata = createAuditTemplate(2, {
  name: 'Uniswap Swap Executor',
  description: 'Executes token swaps via Uniswap V3',
  version: '1.2.0',
  sourceHash: 'sha256:ab3f...c901',
});

// 2. Fill in results as you audit each criterion
metadata.audit.criteria[0].pass = true;
metadata.audit.criteria[0].notes = 'Executed 50 swap scenarios successfully';

// 3. Validate — checks all required criteria are present and pass
const { valid, errors } = validateAuditMetadata(metadata);
if (!valid) throw new Error(errors.join(', '));

// 4. Compute the on-chain criteria hash
const criteriaHash = computeCriteriaHash(getRequiredCriteria(2));

// 5. Upload to IPFS and use the URI in registerSkill()
const metadataURI = await uploadMetadata(metadata);` : `# Python pseudo-code (use the TypeScript SDK)
# Create template for L2 audit
template = create_audit_template(2, {
    "name": "Uniswap Swap Executor",
    "description": "Executes token swaps via Uniswap V3",
    "version": "1.2.0",
    "source_hash": "sha256:ab3f...c901",
})

# Fill in criteria results
template["audit"]["criteria"][0]["pass"] = True
template["audit"]["criteria"][0]["notes"] = "50 scenarios passed"

# Validate and upload
result = validate_audit_metadata(template)
metadata_uri = upload_metadata(template)`, lang)}</pre>
              </div>
            </div>
          </section>

          <section id="method-validateAuditMetadata" ref={setRef("method-validateAuditMetadata")} style={{ marginTop: 16 }}>
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12,
              padding: "20px 24px", marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <code style={{ fontFamily: FONT_CODE, fontSize: 14, fontWeight: 700, color: SYN_FN }}>validateAuditMetadata()</code>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: BG,
                  background: "#4ADE80", padding: "2px 8px", borderRadius: 3,
                }}>HELPER</span>
              </div>
              <p style={{ fontSize: 12.5, color: TEXT_DIM, lineHeight: 1.7, marginBottom: 16 }}>
                Validates a metadata document against the AEGIS schema. Checks that the schema version is recognized,
                all required fields exist, all criteria for the declared audit level are present, and all required criteria pass.
              </p>

              <div style={{
                marginBottom: 16, padding: "14px 18px", background: SURFACE2,
                borderRadius: 8, border: `1px solid ${BORDER}`,
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Audit Level Criteria</p>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "6px 10px", color: TEXT_DIM, borderBottom: `1px solid ${BORDER}` }}>Level</th>
                      <th style={{ textAlign: "left", padding: "6px 10px", color: TEXT_DIM, borderBottom: `1px solid ${BORDER}` }}>Name</th>
                      <th style={{ textAlign: "left", padding: "6px 10px", color: TEXT_DIM, borderBottom: `1px solid ${BORDER}` }}>Criteria Count</th>
                      <th style={{ textAlign: "left", padding: "6px 10px", color: TEXT_DIM, borderBottom: `1px solid ${BORDER}` }}>Focus</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: "6px 10px", color: TEXT_DIM }}>L1</td>
                      <td style={{ padding: "6px 10px", color: TEXT }}>Functional</td>
                      <td style={{ padding: "6px 10px", color: TEXT }}>4 criteria</td>
                      <td style={{ padding: "6px 10px", color: TEXT }}>Execution, output format, deps, docs</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "6px 10px", color: TEXT_DIM }}>L2</td>
                      <td style={{ padding: "6px 10px", color: TEXT }}>Robust</td>
                      <td style={{ padding: "6px 10px", color: TEXT }}>9 criteria (L1 + 5)</td>
                      <td style={{ padding: "6px 10px", color: TEXT }}>Edge cases, validation, errors, resources</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "6px 10px", color: TEXT_DIM }}>L3</td>
                      <td style={{ padding: "6px 10px", color: TEXT }}>Security</td>
                      <td style={{ padding: "6px 10px", color: TEXT }}>14 criteria (L1 + L2 + 5)</td>
                      <td style={{ padding: "6px 10px", color: TEXT }}>Injection, exfiltration, sandbox, supply chain</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{
                background: "#0D0D10", borderRadius: 8, padding: "16px 20px",
                fontFamily: FONT_CODE, fontSize: 12, lineHeight: 1.6, overflow: "auto",
                border: `1px solid ${BORDER}`,
              }}>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: SYN_DEFAULT }}>{highlight(`import {
  fetchAuditMetadata,
  validateAuditMetadata,
  getRequiredCriteria,
  L1_CRITERIA,
  L2_CRITERIA,
  L3_CRITERIA,
} from '@aegisaudit/sdk';

// Fetch and validate metadata from an attestation
const metadata = await fetchAuditMetadata(metadataURI);
const { valid, errors } = validateAuditMetadata(metadata);

if (!valid) {
  // This attestation has invalid metadata — grounds for dispute
  console.error('Validation errors:', errors);
}

// Check what criteria are required for each level
const l1 = getRequiredCriteria(1); // ['L1.EXEC', 'L1.OUTPUT', 'L1.DEPS', 'L1.DOCS']
const l2 = getRequiredCriteria(2); // L1 criteria + 5 L2 criteria
const l3 = getRequiredCriteria(3); // L1 + L2 criteria + 5 L3 criteria`, lang)}</pre>
              </div>
            </div>
          </section>

          {/* ═══ Submitting Attestations ═══ */}
          <section id="submitting" ref={setRef("submitting")} style={{ marginTop: 56 }}>
            <h2 style={{
              fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 700,
              color: TEXT, marginBottom: 8,
            }}>
              Submitting Attestations
            </h2>
            <p style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 16, lineHeight: 1.7 }}>
              Write operations that modify on-chain state. Require a wallet client via{" "}
              <code style={{ color: SYN_FN, background: SURFACE2, padding: "1px 4px", borderRadius: 3 }}>client.setWallet()</code>.
            </p>

            {writeOps.map(m => (
              <div key={m.name} id={`method-${m.name}`} ref={setRef(`method-${m.name}`)}>
                <MethodCard
                  method={m}
                  lang={lang}
                  expanded={expandedMethod === m.name}
                  onToggle={() => toggleMethod(m.name)}
                />
              </div>
            ))}
          </section>

          {/* ═══ ZK Proving ═══ */}
          <section id="zk-proving" ref={setRef("zk-proving")} style={{ marginTop: 56 }}>
            <h2 style={{
              fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 700,
              color: TEXT, marginBottom: 8,
            }}>
              ZK Proving
            </h2>
            <p style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 16, lineHeight: 1.7 }}>
              Generate UltraHonk ZK proofs for skill attestations. The circuit verifies: source code hash matches skillHash, audit results match criteriaHash, auditor identity is valid via Pedersen commitment, and audit level is in range [1, 3].
            </p>

            {PROVER_METHODS.map(m => (
              <div key={m.name} id={`method-${m.name}`} ref={setRef(`method-${m.name}`)}>
                <MethodCard
                  method={m}
                  lang={lang}
                  expanded={expandedMethod === m.name}
                  onToggle={() => toggleMethod(m.name)}
                />
              </div>
            ))}
          </section>

          {/* ═══ Disputes ═══ */}
          <section id="disputes" ref={setRef("disputes")} style={{ marginTop: 56 }}>
            <h2 style={{
              fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 700,
              color: TEXT, marginBottom: 8,
            }}>
              Disputes
            </h2>
            <p style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 16, lineHeight: 1.7 }}>
              Challenge fraudulent or incorrect attestations. The dispute bond is returned if the auditor is found at fault, plus 50% of the auditor's slashed stake.
            </p>

            {disputeOps.map(m => (
              <div key={m.name} id={`method-${m.name}`} ref={setRef(`method-${m.name}`)}>
                <MethodCard
                  method={m}
                  lang={lang}
                  expanded={expandedMethod === m.name}
                  onToggle={() => toggleMethod(m.name)}
                />
              </div>
            ))}
          </section>

          {/* ═══ Trust API ═══ */}
          <section id="trust-api" ref={setRef("trust-api")} style={{ marginTop: 56 }}>
            <h2 style={{
              fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 700,
              color: TEXT, marginBottom: 8,
            }}>
              Trust API
            </h2>
            <p style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 16, lineHeight: 1.7 }}>
              Aggregated trust profiles combining AEGIS attestations with ERC-8004 validation and reputation data.
              Direct mode queries on-chain for free; API mode serves via x402 USDC micropayments on Base.
            </p>

            {trustOps.map(m => (
              <div key={m.name} id={`method-${m.name}`} ref={setRef(`method-${m.name}`)}>
                <MethodCard
                  method={m}
                  lang={lang}
                  expanded={expandedMethod === m.name}
                  onToggle={() => toggleMethod(m.name)}
                />
              </div>
            ))}
          </section>

          {/* ═══ Contract Events ═══ */}
          <section id="events" ref={setRef("events")} style={{ marginTop: 56 }}>
            <h2 style={{
              fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 700,
              color: TEXT, marginBottom: 8,
            }}>
              Contract Events
            </h2>
            <p style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 16, lineHeight: 1.7 }}>
              AegisRegistry emits the following Solidity events. Subscribe via the SDK or directly with viem.
            </p>

            <ConfigTable
              headers={["Event", "Parameters", "Description"]}
              rows={EVENTS.map(e => [e.name, e.params, e.description])}
            />

            <CodeWindow
              code={lang === "ts"
                ? `import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import abi from '@aegisaudit/sdk/abi/AegisRegistry.json';

const client = createPublicClient({
  chain: base,
  transport: http(),
});

// Watch for new skill registrations
const unwatch = client.watchContractEvent({
  address: '0x...',
  abi,
  eventName: 'SkillRegistered',
  onLogs: (logs) => {
    for (const log of logs) {
      console.log('New skill:', log.args.skillHash);
      console.log('Level:', log.args.auditLevel);
    }
  },
});`
                : `from web3 import Web3

w3 = Web3(Web3.HTTPProvider("https://mainnet.base.org"))
contract = w3.eth.contract(address="0x...", abi=abi)

# Watch for new skill registrations
event_filter = contract.events.SkillRegistered.create_filter(
    from_block="latest"
)

for event in event_filter.get_new_entries():
    print(f"New skill: {event.args.skillHash}")
    print(f"Level: {event.args.auditLevel}")`}
              lang={lang}
              filename={lang === "ts" ? "events.ts" : "events.py"}
            />
          </section>

          {/* ═══ Error Handling ═══ */}
          <section id="errors" ref={setRef("errors")} style={{ marginTop: 56 }}>
            <h2 style={{
              fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 700,
              color: TEXT, marginBottom: 8,
            }}>
              Error Handling
            </h2>
            <p style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 16, lineHeight: 1.7 }}>
              The AegisRegistry contract uses custom Solidity errors from the AegisErrors library. These are decoded automatically by viem.
            </p>

            <ConfigTable
              headers={["Error Code", "Message", "Fix"]}
              rows={ERRORS.map(e => [e.code, e.message, e.fix])}
            />

            <CodeWindow
              code={lang === "ts"
                ? `import { AegisClient } from '@aegisaudit/sdk';
import { ContractFunctionRevertedError } from 'viem';

try {
  await client.registerSkill({
    skillHash: '0x...',
    metadataURI: 'ipfs://Qm...',
    attestationProof: proof.proof,
    publicInputs: proof.publicInputs,
    auditorCommitment: '0x...',
    auditLevel: 1,
  });
} catch (err) {
  if (err instanceof ContractFunctionRevertedError) {
    const errorName = err.data?.errorName;

    if (errorName === 'InsufficientFee') {
      console.error('Send at least 0.001 ETH');
    } else if (errorName === 'InvalidProof') {
      console.error('ZK proof verification failed');
    } else if (errorName === 'AuditorNotRegistered') {
      console.error('Register auditor first');
    }
  }
}`
                : `from aegis_sdk import AegisClient
from aegis_sdk.errors import (
    InsufficientFee,
    InvalidProof,
    AuditorNotRegistered,
)

try:
    await client.register_skill(
        skill_hash="0x...",
        metadata_uri="ipfs://Qm...",
        attestation_proof=proof.proof,
        public_inputs=proof.public_inputs,
        auditor_commitment="0x...",
        audit_level=1,
    )
except InsufficientFee:
    print("Send at least 0.001 ETH")
except InvalidProof:
    print("ZK proof verification failed")
except AuditorNotRegistered:
    print("Register auditor first")`}
              lang={lang}
              filename={lang === "ts" ? "errors.ts" : "errors.py"}
            />
          </section>

          {/* Footer spacer */}
          <div style={{ height: 80 }} />
        </main>
      </div>
    </>
  );
}
