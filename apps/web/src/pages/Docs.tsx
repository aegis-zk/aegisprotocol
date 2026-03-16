import React, { useState, useEffect, useRef, useCallback } from "react";
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
const TEXT = "#E4E4E7";
const TEXT_DIM = "#71717A";
const TEXT_MUTED = "#52525B";

const FONT_HEAD = "'Orbitron', sans-serif";
const FONT = "'Space Mono', monospace";
const FONT_CODE = "'SF Mono', 'Cascadia Code', 'Fira Code', Menlo, Consolas, 'DejaVu Sans Mono', monospace";

const GREEN = "#4ADE80";
const PURPLE = "#A78BFA";
const AMBER = "#FBBF24";
const RED = "#F87171";
const BLUE = "#60A5FA";

// ── Syntax Highlighting ──────────────────────────────────────
const SYN_KW = "#C084FC";
const SYN_STR = "#4ADE80";
const SYN_COMMENT = "#4B5563";
const SYN_FN = "#60A5FA";
const SYN_TYPE = "#FBBF24";
const SYN_NUM = "#F87171";
const SYN_DEFAULT = "#A1A1AA";

function highlight(code: string): React.ReactElement[] {
  return code.split("\n").map((line, i) => {
    const spans: React.ReactElement[] = [];
    let key = 0;
    const push = (text: string, color: string) => {
      spans.push(<span key={key++} style={{ color }}>{text}</span>);
    };

    if (line.trimStart().startsWith("//") || line.trimStart().startsWith("#") || line.trimStart().startsWith("--")) {
      push(line, SYN_COMMENT);
      return <div key={i} style={{ minHeight: "1.5em" }}>{spans}</div>;
    }
    if (line.trim() === "") return <div key={i} style={{ minHeight: "1.5em" }}>{"\u00A0"}</div>;

    const tokens: { start: number; end: number; color: string }[] = [];
    let m: RegExpExecArray | null;
    const stringRe = /(["'`])(?:(?!\1|\\).|\\.)*\1/g;
    while ((m = stringRe.exec(line)) !== null) tokens.push({ start: m.index, end: m.index + m[0].length, color: SYN_STR });
    const kwRe = /\b(const|let|var|await|async|import|from|export|if|else|return|new|function|true|false|null|undefined|struct|mapping|bytes32|uint256|uint8|address|bool|event|error|modifier|require|assert|emit|pub|fn|use|external|payable|view|returns|memory|storage|calldata|indexed|revert|contract|is|pragma|solidity|library)\b/g;
    while ((m = kwRe.exec(line)) !== null) {
      if (!tokens.some(t => m!.index >= t.start && m!.index < t.end))
        tokens.push({ start: m.index, end: m.index + m[0].length, color: SYN_KW });
    }
    const fnRe = /\b([a-zA-Z_]\w*)\s*\(/g;
    while ((m = fnRe.exec(line)) !== null) {
      const s = m.index, e = m.index + m[1].length;
      if (!tokens.some(t => s >= t.start && s < t.end))
        tokens.push({ start: s, end: e, color: SYN_FN });
    }
    const typeRe = /\b([A-Z][a-zA-Z0-9]+)\b/g;
    while ((m = typeRe.exec(line)) !== null) {
      if (!tokens.some(t => m!.index >= t.start && m!.index < t.end))
        tokens.push({ start: m.index, end: m.index + m[0].length, color: SYN_TYPE });
    }
    const numRe = /\b(\d+(?:\.\d+)?n?)\b/g;
    while ((m = numRe.exec(line)) !== null) {
      if (!tokens.some(t => m!.index >= t.start && m!.index < t.end))
        tokens.push({ start: m.index, end: m.index + m[0].length, color: SYN_NUM });
    }
    tokens.sort((a, b) => a.start - b.start);
    let pos = 0;
    for (const t of tokens) {
      if (t.start > pos) push(line.slice(pos, t.start), SYN_DEFAULT);
      push(line.slice(t.start, t.end), t.color);
      pos = t.end;
    }
    if (pos < line.length) push(line.slice(pos), SYN_DEFAULT);
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
    <button onClick={handleCopy} style={{
      background: copied ? "rgba(74,222,128,0.15)" : SURFACE3,
      border: `1px solid ${copied ? "rgba(74,222,128,0.3)" : BORDER}`,
      borderRadius: 5, padding: "4px 10px", fontSize: 11,
      fontFamily: FONT_CODE, color: copied ? GREEN : TEXT_DIM,
      cursor: "pointer", transition: "all 0.15s ease",
    }}>{copied ? "✓ Copied" : "Copy"}</button>
  );
}

// ── CodeBlock ────────────────────────────────────────────────
function CodeBlock({ code, filename, lang }: { code: string; filename?: string; lang?: string }) {
  return (
    <div style={{
      background: "#0D0D10", border: `1px solid ${BORDER}`,
      borderRadius: 10, overflow: "hidden", marginTop: 12, marginBottom: 20,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderBottom: `1px solid ${BORDER}`, background: SURFACE,
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
            }}>{filename}</span>
          )}
          {lang && (
            <span style={{
              fontFamily: FONT_CODE, fontSize: 9, color: TEXT_MUTED,
              background: SURFACE2, padding: "1px 6px", borderRadius: 3,
              textTransform: "uppercase",
            }}>{lang}</span>
          )}
        </div>
        <CopyButton text={code} />
      </div>
      <div style={{ padding: "16px 20px", fontFamily: FONT_CODE, fontSize: 13, lineHeight: 1.6, overflowX: "auto" }}>
        {highlight(code)}
      </div>
    </div>
  );
}

// ── InfoTable ────────────────────────────────────────────────
function InfoTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{
      border: `1px solid ${BORDER}`, borderRadius: 8,
      overflow: "hidden", marginTop: 12, marginBottom: 20,
    }}>
      <div style={{
        display: "grid", gridTemplateColumns: `repeat(${headers.length}, 1fr)`,
        padding: "10px 16px", background: SURFACE, borderBottom: `1px solid ${BORDER}`,
        fontSize: 10, color: TEXT_MUTED,
        textTransform: "uppercase", letterSpacing: "0.06em",
      }}>
        {headers.map((h, i) => <span key={i}>{h}</span>)}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} style={{
          display: "grid", gridTemplateColumns: `repeat(${headers.length}, 1fr)`,
          padding: "10px 16px", borderBottom: ri < rows.length - 1 ? `1px solid ${BORDER}` : "none",
          fontSize: 12,
        }}>
          {row.map((cell, ci) => (
            <span key={ci} style={{
              color: ci === 0 ? SYN_FN : ci === 1 ? SYN_TYPE : TEXT_DIM,
              wordBreak: "break-word",
            }}>{cell}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────
interface SidenavSection { id: string; label: string; indent?: boolean; }

const SECTIONS: SidenavSection[] = [
  { id: "overview", label: "Protocol Overview" },
  { id: "architecture", label: "Architecture" },
  { id: "arch-contracts", label: "Smart Contracts", indent: true },
  { id: "arch-circuits", label: "ZK Circuits", indent: true },
  { id: "arch-sdk", label: "SDK", indent: true },
  { id: "arch-cli", label: "CLI", indent: true },
  { id: "audit-levels", label: "Audit Levels" },
  { id: "level-1", label: "L1 Functional", indent: true },
  { id: "level-2", label: "L2 Robust", indent: true },
  { id: "level-3", label: "L3 Security", indent: true },
  { id: "metadata-schema", label: "Metadata Schema", indent: true },
  { id: "contract-ref", label: "Contract Reference" },
  { id: "contract-functions", label: "Functions", indent: true },
  { id: "contract-events", label: "Events", indent: true },
  { id: "contract-errors", label: "Errors", indent: true },
  { id: "zk-circuit", label: "ZK Circuit" },
  { id: "sdk-agents", label: "SDK for Agents" },
  { id: "sdk-discovery", label: "Discovery", indent: true },
  { id: "sdk-verification", label: "Verification", indent: true },
  { id: "sdk-write-ops", label: "Write Operations", indent: true },
  { id: "mcp-server", label: "MCP Server" },
  { id: "mcp-install", label: "Installation", indent: true },
  { id: "mcp-tools", label: "Available Tools", indent: true },
  { id: "erc8004", label: "ERC-8004 Integration" },
  { id: "erc8004-bridging", label: "Bridging Flow", indent: true },
  { id: "x402-trust-api", label: "x402 Trust API", indent: true },
  { id: "cli-ref", label: "CLI Reference" },
  { id: "deployment", label: "Deployment" },
  { id: "consumer-middleware", label: "Consumer Middleware" },
  { id: "reputation-system", label: "Reputation System" },
  { id: "aegis-token", label: "$AEGIS Token", indent: true },
  { id: "tao-subnet-auditing", label: "TAO Subnet Auditing" },
  { id: "agent-playbooks", label: "Agent Playbooks" },
];

function SidenavItem({ label, active, indent, onClick }: {
  label: string; active: boolean; indent?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      display: "block", width: "100%", textAlign: "left",
      background: "transparent", border: "none",
      borderLeft: active ? `2px solid ${ACCENT}` : "2px solid transparent",
      padding: `6px 16px 6px ${indent ? 28 : 16}px`,
      fontSize: indent ? 12 : 12.5,
      fontWeight: active ? 600 : 400,
      color: active ? ACCENT : TEXT_DIM,
      cursor: "pointer", transition: "all 0.15s ease",
    }}
      onMouseEnter={e => { if (!active) (e.target as HTMLElement).style.color = TEXT; }}
      onMouseLeave={e => { if (!active) (e.target as HTMLElement).style.color = TEXT_DIM; }}
    >{label}</button>
  );
}

// ── Callout Box ──────────────────────────────────────────────
function Callout({ color, label, children }: { color: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{
      borderLeft: `3px solid ${color}`, background: `${color}08`,
      padding: "14px 18px", borderRadius: "0 8px 8px 0",
      marginTop: 12, marginBottom: 20,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700,
        color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6,
      }}>{label}</div>
      <div style={{ fontSize: 12.5, color: TEXT_DIM, lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}

// ── NavBar ───────────────────────────────────────────────────
function DocsNavBar() {
  const navigate = useNavigate();
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      padding: "0 40px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "rgba(9,9,11,0.95)", backdropFilter: "blur(20px)",
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
          fontSize: 11, color: TEXT_DIM,
          background: SURFACE2, padding: "2px 8px", borderRadius: 4,
          marginLeft: 4,
        }}>DOCS</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        {[
          { label: "DApp", onClick: () => navigate("/app") },
          { label: "Registry", onClick: () => navigate("/registry") },
          { label: "Dashboard", onClick: () => navigate("/dashboard") },
          { label: "Bounties", onClick: () => navigate("/bounties") },
          { label: "Auditors", onClick: () => navigate("/auditors") },
          { label: "Developers", onClick: () => navigate("/developers") },
          { label: "Docs", onClick: () => navigate("/docs") },
        ].map(item => (
          <a key={item.label} href="#" style={{
            color: item.label === "Docs" ? TEXT : TEXT_DIM,
            textDecoration: "none",
            fontSize: 13,
            fontWeight: item.label === "Docs" ? 700 : 400,
            borderBottom: item.label === "Docs" ? `2px solid ${ACCENT}` : "2px solid transparent",
            paddingBottom: 2,
            transition: "color 0.2s",
            cursor: item.label === "Docs" ? "default" : "pointer",
          }}
            onClick={e => { e.preventDefault(); if (item.label !== "Docs" && item.onClick) item.onClick(); }}
            onMouseEnter={e => { if (item.label !== "Docs") (e.target as HTMLElement).style.color = TEXT; }}
            onMouseLeave={e => { if (item.label !== "Docs") (e.target as HTMLElement).style.color = TEXT_DIM; }}
          >{item.label}</a>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginLeft: -8 }}>
          <a href="https://github.com/aegis-zk/aegisprotocol" target="_blank" rel="noopener noreferrer" title="GitHub"
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
export function Docs() {
  const [activeSection, setActiveSection] = useState("overview");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

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
    Object.values(sectionRefs.current).forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const setRef = useCallback((id: string) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  }, []);

  const SectionHeading = ({ children }: { children: React.ReactNode }) => (
    <h2 style={{
      fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 700,
      color: TEXT, marginBottom: 8,
    }}>{children}</h2>
  );

  const SubHeading = ({ children }: { children: React.ReactNode }) => (
    <h3 style={{
      fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 600,
      color: TEXT, marginBottom: 8, marginTop: 28,
    }}>{children}</h3>
  );

  const Para = ({ children }: { children: React.ReactNode }) => (
    <p style={{
      fontSize: 13, color: TEXT_DIM,
      lineHeight: 1.7, marginBottom: 16, maxWidth: 720,
    }}>{children}</p>
  );

  const InlineCode = ({ children }: { children: React.ReactNode }) => (
    <code style={{
      color: SYN_FN, background: SURFACE2,
      padding: "1px 5px", borderRadius: 3, fontSize: 12,
      fontFamily: FONT_CODE,
    }}>{children}</code>
  );

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

      <DocsNavBar />

      <div style={{ display: "flex", paddingTop: 64, minHeight: "100vh" }}>
        {/* Sidebar */}
        <aside style={{
          position: "fixed", top: 64, left: 0, bottom: 0,
          width: 240, padding: "24px 0",
          borderRight: `1px solid ${BORDER}`,
          background: BG, overflowY: "auto", zIndex: 50,
        }}>
          <div style={{
            fontSize: 10, color: TEXT_MUTED,
            textTransform: "uppercase", letterSpacing: "0.08em",
            padding: "0 16px 12px",
          }}>Documentation</div>
          {SECTIONS.map(s => (
            <SidenavItem
              key={s.id} label={s.label} active={activeSection === s.id}
              indent={s.indent} onClick={() => scrollTo(s.id)}
            />
          ))}
        </aside>

        {/* Content */}
        <main style={{ marginLeft: 240, flex: 1, maxWidth: 820, padding: "40px 48px 120px" }}>

          {/* ═══ Protocol Overview ═══ */}
          <section id="overview" ref={setRef("overview")}>
            <div style={{
              fontSize: 12, color: ACCENT,
              textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12,
            }}>Protocol Documentation</div>
            <h1 style={{
              fontFamily: FONT_HEAD, fontSize: 28, fontWeight: 800,
              color: TEXT, letterSpacing: "-0.02em", marginBottom: 12,
            }}>AEGIS Protocol</h1>
            <Para>
              <strong style={{ color: TEXT }}>Anonymous Expertise &amp; Guarantee for Intelligent Skills</strong> — AEGIS is an on-chain attestation registry for AI agent skills deployed on Base L2. It enables anonymous auditors to stake ETH behind cryptographic attestations that verify skill safety, without revealing the source code, the auditor's identity, or the audit results.
            </Para>
            <Para>
              The protocol uses zero-knowledge proofs (UltraHonk via Noir) to prove that an auditor has reviewed a skill's source code and that it meets specific safety criteria — all without exposing any private data on-chain. Consumers can verify these attestations in a single on-chain call before loading any skill into their agents.
            </Para>

            <Callout color={ACCENT} label="Key Principle">
              Trust the proof, not the publisher. AEGIS separates identity from expertise — auditors are identified by Pedersen hash commitments, not wallet addresses. Reputation is built through successful attestations, not credentials.
            </Callout>

            <SubHeading>Core Actors</SubHeading>
            <InfoTable
              headers={["Role", "Description", "On-Chain Action"]}
              rows={[
                ["Publisher", "Deploys AI agent skills and submits them for audit", "registerSkill() — submits skill hash + proof + fee"],
                ["Auditor", "Reviews code and generates ZK attestation proofs", "registerAuditor() — stakes ETH behind identity"],
                ["Consumer", "AI agents that load and execute verified skills", "verify() / getAttestations() — read-only queries"],
                ["Challenger", "Disputes fraudulent or negligent attestations", "openDispute() — posts bond + evidence"],
              ]}
            />
          </section>

          {/* ═══ Architecture ═══ */}
          <section id="architecture" ref={setRef("architecture")} style={{ marginTop: 56 }}>
            <SectionHeading>Architecture</SectionHeading>
            <Para>
              AEGIS is structured as a monorepo with five packages. Each layer is independently deployable and versioned.
            </Para>

            <CodeBlock code={`aegis/
├── packages/
│   ├── contracts/     # Solidity — AegisRegistry + UltraHonkVerifier
│   │   ├── src/       # AegisRegistry.sol, IAegisRegistry.sol, AegisErrors.sol
│   │   ├── test/      # 25 Foundry tests (forge test)
│   │   └── script/    # Deploy.s.sol deployment scripts
│   ├── circuits/      # Noir — ZK attestation circuit
│   │   └── src/       # main.nr (40 lines)
│   ├── sdk/           # TypeScript — AegisClient, prover, IPFS
│   │   └── src/       # client.ts, prover.ts, registry.ts, types.ts
│   └── cli/           # Commander.js — 5 commands
│       └── src/       # register-auditor, register-skill, verify, status, deploy
└── apps/
    └── web/           # React + Vite + wagmi + Three.js`} filename="project-structure" lang="tree" />
          </section>

          {/* Smart Contracts */}
          <section id="arch-contracts" ref={setRef("arch-contracts")} style={{ marginTop: 32 }}>
            <SubHeading>Smart Contracts</SubHeading>
            <Para>
              The contract layer consists of two deployed contracts on Base L2:
            </Para>
            <InfoTable
              headers={["Contract", "Language", "Description"]}
              rows={[
                ["AegisRegistry", "Solidity ^0.8.27", "Core registry — stores attestations, manages auditors, handles disputes"],
                ["UltraHonkVerifier", "Solidity (generated)", "Auto-generated verifier from the Noir circuit. Verifies ZK proofs on-chain"],
              ]}
            />
            <Para>
              AegisRegistry stores attestation data in mappings keyed by <InlineCode>bytes32 skillHash</InlineCode>. Each attestation includes the ZK proof, auditor commitment, stake snapshot, audit level, and timestamp. The verifier contract is called during <InlineCode>registerSkill()</InlineCode> to validate proofs before storage, and again during <InlineCode>verifyAttestation()</InlineCode> for re-verification.
            </Para>
          </section>

          {/* ZK Circuits */}
          <section id="arch-circuits" ref={setRef("arch-circuits")} style={{ marginTop: 32 }}>
            <SubHeading>ZK Circuits</SubHeading>
            <Para>
              The attestation circuit is written in Noir (v1.0.0-beta.18) and compiled to an UltraHonk proof system. The circuit takes private inputs (source code, audit results, auditor key) and public inputs (skill hash, criteria hash, audit level, auditor commitment) and proves four statements without revealing any private data.
            </Para>
            <Callout color={PURPLE} label="What the circuit proves">
              1. <InlineCode>hash(source_code) == skill_hash</InlineCode> — code matches the claimed hash<br/>
              2. <InlineCode>hash(audit_results) == criteria_hash</InlineCode> — audit passed criteria<br/>
              3. <InlineCode>hash(auditor_key) == auditor_commitment</InlineCode> — auditor identity is valid<br/>
              4. <InlineCode>audit_level ∈ [1, 3]</InlineCode> — level is in valid range
            </Callout>
          </section>

          {/* SDK */}
          <section id="arch-sdk" ref={setRef("arch-sdk")} style={{ marginTop: 32 }}>
            <SubHeading>SDK <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700 }}>v0.5.0</span></SubHeading>
            <Para>
              The TypeScript SDK (<InlineCode>@aegisaudit/sdk</InlineCode>) provides a high-level client for interacting with the registry. It wraps viem for chain interactions, includes a prover module for ZK proofs, and supports full discovery and event queries. Install via <InlineCode>npm install @aegisaudit/sdk</InlineCode>.
            </Para>
            <InfoTable
              headers={["Module", "Exports", "Description"]}
              rows={[
                ["client.ts", "AegisClient", "High-level client: verify, discover, register, dispute, stake"],
                ["prover.ts", "generateAttestationViaCLI, loadProofFromFiles", "ZK proof generation via nargo + bb CLI"],
                ["registry.ts", "Low-level wrappers", "Direct viem contract read/write calls + event queries"],
                ["types.ts", "Attestation, AegisConfig, Event types", "TypeScript interfaces for all protocol types"],
                ["constants.ts", "CHAIN_CONFIG, REGISTRY_ADDRESSES", "Chain IDs, addresses, fee amounts, deployment blocks"],
                ["ipfs.ts", "fetchMetadata, uploadMetadata", "IPFS metadata storage helpers"],
              ]}
            />

            <Callout color={GREEN} label="Agent Capabilities (v0.5.0)">
              The SDK provides full feature parity with the web app. AI agents can: discover all registered skills and auditors via event scanning, fetch metadata URIs, verify attestation proofs, manage auditor stake, open and resolve disputes — all programmatically via <InlineCode>npm install @aegisaudit/sdk</InlineCode>.
            </Callout>

            <CodeBlock code={`import { AegisClient } from '@aegisaudit/sdk';

// Registry address auto-resolved for known chains
const client = new AegisClient({ chainId: 8453 });

// Discovery — scan on-chain events
const skills = await client.listAllSkills();
const auditors = await client.listAllAuditors();
const uri = await client.getMetadataURI(skills[0].skillHash);

// Verification
const isValid = await client.verify(skills[0].skillHash, 0);

// Reputation
const rep = await client.getAuditorReputation(auditors[0].auditorCommitment);

// Disputes
const disputes = await client.listDisputes({ skillHash: skills[0].skillHash });`} filename="agent.ts" lang="typescript" />
          </section>

          {/* CLI */}
          <section id="arch-cli" ref={setRef("arch-cli")} style={{ marginTop: 32 }}>
            <SubHeading>CLI</SubHeading>
            <Para>
              The CLI (<InlineCode>@aegisaudit/cli</InlineCode>) provides 5 commands for interacting with the protocol from the terminal. Built with Commander.js, chalk, and ora.
            </Para>
            <CodeBlock code={`# Install globally (coming soon)
npm install -g @aegisaudit/cli

# Available commands
aegis register-auditor   # Register as an anonymous auditor
aegis register-skill     # Register a skill with ZK proof
aegis verify             # Verify an attestation on-chain
aegis status             # Query auditor/skill status
aegis deploy             # Deploy contracts (wraps forge)`} filename="terminal" lang="bash" />
          </section>

          {/* ═══ Audit Levels ═══ */}
          <section id="audit-levels" ref={setRef("audit-levels")} style={{ marginTop: 56 }}>
            <SectionHeading>Audit Levels</SectionHeading>
            <Para>
              AEGIS defines three audit levels with <strong style={{ color: TEXT }}>structured evaluation criteria</strong>. Each level builds on the previous — L2 includes all L1 checks, L3 includes all L1 + L2 checks. The audit level and a hash of the checked criteria are stored on-chain as part of the attestation, creating a verifiable link to the off-chain audit report.
            </Para>
            <Para>
              Auditors submit metadata (hosted on IPFS) documenting which criteria they checked and their findings. This follows an <strong style={{ color: TEXT }}>optimistic model</strong> — attestations are accepted by default and can be challenged via the dispute system if the metadata is missing, incomplete, or demonstrably false.
            </Para>
          </section>

          <section id="level-1" ref={setRef("level-1")} style={{ marginTop: 24 }}>
            <div style={{
              padding: "20px 24px", background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 12, marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: BG,
                  background: TEXT_DIM, padding: "3px 10px", borderRadius: 4,
                }}>LEVEL 1</span>
                <span style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 700, color: TEXT }}>Functional</span>
              </div>
              <Para>Does the skill do what it says it does? L1 verifies basic execution correctness under normal conditions. This is the baseline — the skill runs, produces the right output format, and has its dependencies in order.</Para>
              <InfoTable
                headers={["Criteria ID", "Check", "Description"]}
                rows={[
                  ["L1.EXEC", "Execution", "Skill executes without error on provided test inputs"],
                  ["L1.OUTPUT", "Output format", "Output conforms to the declared schema/format"],
                  ["L1.DEPS", "Dependencies", "All dependencies are declared and resolvable"],
                  ["L1.DOCS", "Documentation", "Skill has a description and usage documentation"],
                ]}
              />
              <div style={{ marginTop: 12, padding: "10px 14px", background: SURFACE2, borderRadius: 8, border: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: 11, color: TEXT_DIM }}>Evidence: </span>
                <span style={{ fontSize: 11, color: TEXT }}>Input/output hashes, execution logs</span>
              </div>
            </div>
          </section>

          <section id="level-2" ref={setRef("level-2")} style={{ marginTop: 16 }}>
            <div style={{
              padding: "20px 24px", background: SURFACE, border: `1px solid ${ACCENT2}30`,
              borderRadius: 12, marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: BG,
                  background: ACCENT2, padding: "3px 10px", borderRadius: 4,
                }}>LEVEL 2</span>
                <span style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 700, color: TEXT }}>Robust</span>
              </div>
              <Para>Can the skill handle the real world? L2 includes all L1 checks plus edge case handling, input validation, error states, and resource limits. Tests that the skill behaves correctly when things go wrong.</Para>
              <InfoTable
                headers={["Criteria ID", "Check", "Description"]}
                rows={[
                  ["L2.EDGE", "Edge cases", "Handles boundary/edge case inputs gracefully"],
                  ["L2.ERROR", "Error handling", "Returns meaningful errors without leaking internal state"],
                  ["L2.VALIDATE", "Input validation", "Validates and sanitizes all inputs before processing"],
                  ["L2.RESOURCE", "Resource limits", "Operates within declared resource limits (time, memory, tokens)"],
                  ["L2.IDEMPOTENT", "Consistency", "Produces consistent results across repeated invocations"],
                ]}
              />
              <div style={{ marginTop: 12, padding: "10px 14px", background: SURFACE2, borderRadius: 8, border: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: 11, color: TEXT_DIM }}>Evidence: </span>
                <span style={{ fontSize: 11, color: TEXT }}>Test suite hash, edge case matrix, resource profiling output</span>
              </div>
              <div style={{ marginTop: 8, padding: "10px 14px", background: `${ACCENT2}08`, borderRadius: 8, border: `1px solid ${ACCENT2}20` }}>
                <span style={{ fontSize: 11, color: ACCENT2 }}>+ all L1 criteria required</span>
              </div>
            </div>
          </section>

          <section id="level-3" ref={setRef("level-3")} style={{ marginTop: 16 }}>
            <div style={{
              padding: "20px 24px", background: SURFACE, border: `1px solid ${ACCENT}30`,
              borderRadius: 12, marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: BG,
                  background: ACCENT, padding: "3px 10px", borderRadius: 4,
                }}>LEVEL 3</span>
                <span style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 700, color: TEXT }}>Security</span>
              </div>
              <Para>Is this skill safe to run in an untrusted environment? L3 includes all L1 + L2 checks plus adversarial testing, prompt injection resistance, data exfiltration checks, and dependency vulnerability scanning.</Para>
              <InfoTable
                headers={["Criteria ID", "Check", "Description"]}
                rows={[
                  ["L3.INJECTION", "Prompt injection", "Resistant to prompt injection and instruction manipulation"],
                  ["L3.EXFIL", "Data exfiltration", "No unauthorized data exfiltration (network, filesystem, env vars)"],
                  ["L3.SANDBOX", "Sandbox escape", "Cannot escape execution sandbox or escalate privileges"],
                  ["L3.SUPPLY", "Supply chain", "Third-party dependencies audited for known vulnerabilities"],
                  ["L3.ADVERSARIAL", "Adversarial inputs", "Tested against adversarial/malicious input patterns"],
                ]}
              />
              <div style={{ marginTop: 12, padding: "10px 14px", background: SURFACE2, borderRadius: 8, border: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: 11, color: TEXT_DIM }}>Evidence: </span>
                <span style={{ fontSize: 11, color: TEXT }}>Security tool output hashes, adversarial test results, dependency audit report</span>
              </div>
              <div style={{ marginTop: 8, padding: "10px 14px", background: `${ACCENT}08`, borderRadius: 8, border: `1px solid ${ACCENT}20` }}>
                <span style={{ fontSize: 11, color: ACCENT }}>+ all L1 + L2 criteria required</span>
              </div>
            </div>
          </section>

          {/* ═══ Metadata Schema ═══ */}
          <section id="metadata-schema" ref={setRef("metadata-schema")} style={{ marginTop: 32 }}>
            <SubHeading>Metadata Schema</SubHeading>
            <Para>
              Every attestation includes a <InlineCode>metadataURI</InlineCode> pointing to a JSON document on IPFS. This document follows the <InlineCode>aegis/audit-metadata@1</InlineCode> schema and records exactly what was checked and what was found.
            </Para>
            <Para>
              The <InlineCode>auditCriteriaHash</InlineCode> stored on-chain is the keccak256 of the sorted criteria IDs, creating a verifiable commitment between the on-chain attestation and the off-chain report. If a dispute is opened, the metadata serves as evidence — challengers can reference specific criteria IDs.
            </Para>
            <CodeBlock code={`// aegis/audit-metadata@1 schema
{
  "schema": "aegis/audit-metadata@1",

  "skill": {
    "name": "Uniswap Swap Executor",
    "description": "Executes token swaps via Uniswap V3 router",
    "version": "1.2.0",
    "sourceHash": "sha256:ab3f...c901",
    "repository": "https://github.com/example/swap-skill",
    "tags": ["defi", "uniswap", "swap"]
  },

  "audit": {
    "level": 2,
    "timestamp": "2026-03-03T12:00:00Z",
    "summary": "All L1+L2 criteria pass. Skill handles edge cases well.",
    "criteria": [
      {
        "id": "L1.EXEC",
        "pass": true,
        "notes": "Executed 50 swap scenarios, all returned valid tx hashes",
        "evidenceHash": "sha256:d4e5...f678"
      },
      {
        "id": "L2.EDGE",
        "pass": true,
        "notes": "Tested zero-amount, max-uint, expired deadlines"
      }
      // ... all criteria for the declared level
    ]
  },

  "environment": {
    "tools": ["aegis-cli@0.2.2", "hardhat@2.22"],
    "runtime": "node@22.0.0",
    "platform": "linux-x64"
  }
}`} filename="audit-metadata.json" lang="bash" />
            <Para>
              The SDK provides helpers for creating, validating, and hashing metadata:
            </Para>
            <CodeBlock code={`import {
  createAuditTemplate,
  validateAuditMetadata,
  computeCriteriaHash,
  getRequiredCriteria,
  uploadMetadata
} from '@aegisaudit/sdk';

// Create a template with all required criteria for L2
const metadata = createAuditTemplate(2, {
  name: 'Uniswap Swap Executor',
  description: 'Executes token swaps via Uniswap V3',
  version: '1.2.0',
  sourceHash: 'sha256:ab3f...c901',
});

// Fill in results as you audit each criteria
metadata.audit.criteria[0].pass = true;
metadata.audit.criteria[0].notes = 'Executed 50 swap scenarios successfully';

// Validate before submitting
const { valid, errors } = validateAuditMetadata(metadata);

// Compute the on-chain criteria hash
const criteriaHash = computeCriteriaHash(getRequiredCriteria(2));

// Upload to IPFS
const metadataURI = await uploadMetadata(metadata);`} filename="audit-workflow.ts" lang="bash" /></section>

          {/* ═══ Contract Reference ═══ */}
          <section id="contract-ref" ref={setRef("contract-ref")} style={{ marginTop: 56 }}>
            <SectionHeading>Contract Reference</SectionHeading>
            <Para>
              The <InlineCode>AegisRegistry</InlineCode> contract is the core on-chain component. It manages skill attestations, auditor registrations, stake management, and dispute resolution.
            </Para>
            <InfoTable
              headers={["Constant", "Value", "Description"]}
              rows={[
                ["REGISTRATION_FEE", "0.001 ETH", "Fee to register a skill attestation"],
                ["MIN_AUDITOR_STAKE", "0.01 ETH", "Minimum ETH to register as an auditor"],
                ["MIN_DISPUTE_BOND", "0.005 ETH", "Minimum bond to open a dispute"],
                ["PROTOCOL_FEE_BPS", "500 (5%)", "Fee deducted from staking and bounty operations"],
                ["UNSTAKE_COOLDOWN", "3 days", "Cooldown period before unstaked ETH can be withdrawn"],
                ["MIN_BOUNTY", "0.001 ETH", "Minimum bounty amount to incentivize auditors"],
                ["BOUNTY_EXPIRATION", "30 days", "Time before unclaimed bounties can be reclaimed"],
              ]}
            />
          </section>

          {/* Functions */}
          <section id="contract-functions" ref={setRef("contract-functions")} style={{ marginTop: 32 }}>
            <SubHeading>Functions</SubHeading>
            <InfoTable
              headers={["Function", "Access", "Description"]}
              rows={[
                ["registerSkill(skillHash, metadataURI, proof, inputs, commitment, level, bountyRecipient)", "payable", "Register a skill with ZK proof. Auto-claims matching bounty if bountyRecipient is set"],
                ["registerAuditor(auditorCommitment)", "payable", "Register as auditor. Requires MIN_AUDITOR_STAKE"],
                ["addStake(auditorCommitment)", "payable", "Add more stake to an existing auditor"],
                ["getAttestations(skillHash)", "view", "Get all attestations for a skill hash"],
                ["verifyAttestation(skillHash, index)", "external", "Re-verify stored ZK proof on-chain"],
                ["getAuditorReputation(commitment)", "view", "Returns (score, totalStake, attestationCount)"],
                ["openDispute(skillHash, index, evidence)", "payable", "Open dispute. Requires MIN_DISPUTE_BOND"],
                ["resolveDispute(disputeId, auditorFault)", "onlyOwner", "Resolve dispute. Slashes 50% if fault=true"],
                ["initiateUnstake(commitment, amount)", "external", "Start unstake with 3-day cooldown"],
                ["completeUnstake(commitment)", "external", "Withdraw ETH after cooldown. Full withdrawal deregisters"],
                ["cancelUnstake(commitment)", "external", "Cancel a pending unstake request"],
                ["getUnstakeRequest(commitment)", "view", "Get pending unstake request details"],
                ["postBounty(skillHash, requiredLevel)", "payable", "Post ETH bounty for a skill audit. Min 0.001 ETH, expires in 30 days"],
                ["reclaimBounty(skillHash)", "external", "Reclaim expired unclaimed bounty (publisher only)"],
                ["getBounty(skillHash)", "view", "Get bounty details (publisher, amount, level, expiry, claimed)"],
                ["withdrawProtocolBalance(to)", "onlyOwner", "Withdraw accumulated protocol fees"],
                ["transferOwnership(newOwner)", "onlyOwner", "Transfer admin role (for future DAO migration)"],
              ]}
            />

            <CodeBlock code={`// Attestation struct stored on-chain
struct Attestation {
    bytes32 skillHash;
    bytes32 auditCriteriaHash;
    bytes zkProof;
    bytes32 auditorCommitment;
    uint256 stakeAmount;
    uint256 timestamp;
    uint8 auditLevel;
}

// Dispute struct
struct Dispute {
    bytes32 skillHash;
    uint256 attestationIndex;
    bytes evidence;
    address challenger;
    uint256 bond;
    bool resolved;
    bool auditorFault;
}

// Unstake request struct
struct UnstakeRequest {
    uint256 amount;
    uint256 unlockTimestamp;
}

// Bounty struct
struct Bounty {
    address publisher;
    uint256 amount;
    uint8 requiredLevel;
    uint256 expiresAt;
    bool claimed;
}`} filename="IAegisRegistry.sol" lang="solidity" />
          </section>

          {/* Events */}
          <section id="contract-events" ref={setRef("contract-events")} style={{ marginTop: 32 }}>
            <SubHeading>Events</SubHeading>
            <InfoTable
              headers={["Event", "Parameters", "When Emitted"]}
              rows={[
                ["SkillRegistered", "skillHash (indexed), auditLevel, auditorCommitment", "New skill attestation registered"],
                ["AuditorRegistered", "auditorCommitment (indexed), stake", "New auditor registers with stake"],
                ["StakeAdded", "auditorCommitment (indexed), amount, totalStake", "Auditor adds to their stake"],
                ["DisputeOpened", "disputeId (indexed), skillHash (indexed)", "Dispute opened against attestation"],
                ["DisputeResolved", "disputeId (indexed), auditorSlashed", "Dispute resolved by governance"],
                ["BountyPosted", "skillHash (indexed), amount, requiredLevel, expiresAt", "Bounty posted for a skill"],
                ["BountyClaimed", "skillHash (indexed), recipient (indexed), auditorPayout, protocolFee", "Bounty claimed via registerSkill"],
                ["BountyReclaimed", "skillHash (indexed), publisher (indexed), amount", "Expired bounty reclaimed by publisher"],
              ]}
            />
          </section>

          {/* Errors */}
          <section id="contract-errors" ref={setRef("contract-errors")} style={{ marginTop: 32 }}>
            <SubHeading>Errors</SubHeading>
            <InfoTable
              headers={["Error", "Condition", "Fix"]}
              rows={[
                ["InvalidProof()", "ZK proof verification failed", "Ensure proof matches public inputs and circuit version"],
                ["InsufficientStake()", "Stake below 0.01 ETH minimum", "Send at least 0.01 ETH when registering"],
                ["AuditorAlreadyRegistered()", "Commitment already taken", "Generate a new Pedersen commitment"],
                ["AuditorNotRegistered()", "Commitment not found", "Register auditor before submitting skills"],
                ["InvalidAuditLevel()", "Level not 1, 2, or 3", "Set auditLevel to 1, 2, or 3"],
                ["InsufficientFee()", "Fee below 0.001 ETH", "Send at least 0.001 ETH with registerSkill"],
                ["InsufficientDisputeBond()", "Bond below 0.005 ETH", "Send at least 0.005 ETH with openDispute"],
                ["AttestationNotFound()", "Index out of bounds", "Check getAttestations() length first"],
                ["DisputeAlreadyResolved()", "Dispute already resolved", "No action needed"],
                ["Unauthorized()", "Caller is not owner", "Only protocol admin can resolve disputes"],
                ["InsufficientBounty()", "Bounty below 0.001 ETH", "Send at least 0.001 ETH with postBounty"],
                ["BountyAlreadyExists()", "Active bounty exists for skill", "Wait for existing bounty to be claimed or reclaimed"],
                ["BountyNotFound()", "No bounty for skill hash", "Check getBounty() first"],
                ["BountyAlreadyClaimed()", "Bounty was already claimed", "Bounty has been paid out to an auditor"],
                ["BountyNotExpired()", "Bounty hasn't expired yet", "Wait 30 days or until bounty is claimed"],
                ["NotBountyPublisher()", "Not the original publisher", "Only the publisher can reclaim"],
                ["BountyTransferFailed()", "ETH transfer failed", "Check recipient address"],
              ]}
            />
          </section>

          {/* ═══ ZK Circuit ═══ */}
          <section id="zk-circuit" ref={setRef("zk-circuit")} style={{ marginTop: 56 }}>
            <SectionHeading>ZK Circuit</SectionHeading>
            <Para>
              The attestation circuit is written in Noir and compiles to an UltraHonk proof. It uses Pedersen hashing for all commitments. The circuit is intentionally compact (40 lines) to minimize proving time while maintaining security guarantees.
            </Para>

            <CodeBlock code={`use std::hash::pedersen_hash;

fn main(
    // Private inputs -- known only to the auditor
    source_code: [Field; 64],
    audit_results: [Field; 32],
    auditor_private_key: Field,
    // Public inputs -- visible on-chain
    skill_hash: pub Field,
    criteria_hash: pub Field,
    audit_level: pub u8,
    auditor_commitment: pub Field,
) {
    // 1. Verify source code hash matches the claimed skill hash
    let computed_skill_hash = pedersen_hash(source_code);
    assert(computed_skill_hash == skill_hash);

    // 2. Verify audit results hash matches the criteria hash
    let computed_criteria_hash = pedersen_hash(audit_results);
    assert(computed_criteria_hash == criteria_hash);

    // 3. Verify auditor identity via Pedersen commitment
    let computed_commitment = pedersen_hash([auditor_private_key]);
    assert(computed_commitment == auditor_commitment);

    // 4. Validate audit level range
    assert(audit_level >= 1);
    assert(audit_level <= 3);
}`} filename="main.nr" lang="noir" />

            <Callout color={BLUE} label="Proving Requirements">
              <strong style={{ color: TEXT }}>nargo</strong> v1.0.0-beta.18 for circuit compilation &middot;{" "}
              <strong style={{ color: TEXT }}>bb</strong> v3.0.0 for UltraHonk proof generation &middot;{" "}
              On Windows, proving runs via WSL (auto-detected by the SDK)
            </Callout>

            <SubHeading>Proof Lifecycle</SubHeading>
            <div style={{ display: "flex", gap: 2, marginTop: 12, marginBottom: 20 }}>
              {[
                { step: "1", label: "Compile", detail: "nargo compile" },
                { step: "2", label: "Witness", detail: "nargo execute" },
                { step: "3", label: "Prove", detail: "bb prove -b ... -w ... -o proof" },
                { step: "4", label: "Verify", detail: "On-chain via UltraHonkVerifier" },
              ].map((s, i) => (
                <div key={i} style={{
                  flex: 1, padding: "16px 14px", background: SURFACE,
                  borderRadius: i === 0 ? "10px 0 0 10px" : i === 3 ? "0 10px 10px 0" : 0,
                  borderRight: i < 3 ? `1px solid ${BORDER}` : "none",
                  textAlign: "center",
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700,
                    color: BG, background: ACCENT, display: "inline-block",
                    padding: "1px 8px", borderRadius: 3, marginBottom: 8,
                  }}>{s.step}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 4 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 10, color: TEXT_MUTED }}>
                    {s.detail}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ SDK for Agents ═══ */}
          <section id="sdk-agents" ref={setRef("sdk-agents")} style={{ marginTop: 56 }}>
            <SectionHeading>SDK for Agents</SectionHeading>
            <Para>
              The <InlineCode>@aegisaudit/sdk</InlineCode> package (v0.5.0) gives AI agents full programmatic access to the AEGIS registry — the same capabilities available in the web app. Agents can discover skills, verify proofs, manage stake, and handle disputes without any web interface.
            </Para>

            <CodeBlock code={`npm install @aegisaudit/sdk`} filename="terminal" lang="bash" />

            <Callout color={GREEN} label="Auto-Resolved Configuration">
              Registry addresses are built into the SDK for known chains (Base Sepolia, Base Mainnet). Just pass <InlineCode>chainId</InlineCode> — no need to look up contract addresses.
            </Callout>
          </section>

          <section id="sdk-discovery" ref={setRef("sdk-discovery")} style={{ marginTop: 32 }}>
            <SubHeading>Discovery</SubHeading>
            <Para>
              Read-only methods that scan on-chain events to discover registered skills and auditors. Event queries use chunked log fetching (9,999 blocks per request) to work within public RPC limits.
            </Para>
            <InfoTable
              headers={["Method", "Returns", "Description"]}
              rows={[
                ["listAllSkills(options?)", "SkillRegisteredEvent[]", "All registered skills with audit levels and auditor info"],
                ["listAllAuditors(options?)", "AuditorRegisteredEvent[]", "All registered auditors with initial stake amounts"],
                ["getMetadataURI(skillHash)", "string", "IPFS/HTTP metadata URI for a skill"],
                ["listDisputes(options?)", "DisputeOpenedEvent[]", "All opened disputes, optionally filtered by skill"],
                ["listResolvedDisputes(options?)", "DisputeResolvedEvent[]", "All resolved disputes with slash results"],
              ]}
            />
            <CodeBlock code={`import { AegisClient } from '@aegisaudit/sdk';

const client = new AegisClient({ chainId: 8453 });

// Browse all registered skills
const skills = await client.listAllSkills();
for (const s of skills) {
  const uri = await client.getMetadataURI(s.skillHash);
  console.log(s.skillHash, 'level:', s.auditLevel, 'meta:', uri);
}

// Browse all auditors
const auditors = await client.listAllAuditors();
for (const a of auditors) {
  const rep = await client.getAuditorReputation(a.auditorCommitment);
  console.log(a.auditorCommitment, 'score:', rep.score, 'audits:', rep.attestationCount);
}`} filename="discover.ts" lang="typescript" />
          </section>

          <section id="sdk-verification" ref={setRef("sdk-verification")} style={{ marginTop: 32 }}>
            <SubHeading>Verification</SubHeading>
            <Para>
              Core read-only methods for verifying skill attestations and querying auditor reputation. These call the on-chain verifier contract directly.
            </Para>
            <InfoTable
              headers={["Method", "Returns", "Description"]}
              rows={[
                ["verify(skillHash, index)", "boolean", "Re-verify an attestation's ZK proof on-chain"],
                ["getAttestations(skillHash)", "Attestation[]", "All attestations for a skill hash"],
                ["getAuditorReputation(commitment)", "AuditorReputation", "Score, total stake, attestation count"],
              ]}
            />
            <CodeBlock code={`// Before loading any skill, agents should verify:
const attestations = await client.getAttestations(skillHash);
const isValid = await client.verify(skillHash, 0);
const rep = await client.getAuditorReputation(
  attestations[0].auditorCommitment
);

// Trust decision based on proof + reputation
if (isValid && rep.score > 0n && rep.attestationCount > 2n) {
  console.log('Safe to load skill');
}`} filename="verify.ts" lang="typescript" />
          </section>

          <section id="sdk-write-ops" ref={setRef("sdk-write-ops")} style={{ marginTop: 32 }}>
            <SubHeading>Write Operations</SubHeading>
            <Para>
              Methods that modify on-chain state. Require a wallet client via <InlineCode>client.setWallet()</InlineCode>.
            </Para>
            <InfoTable
              headers={["Method", "ETH Required", "Description"]}
              rows={[
                ["registerSkill(params)", "0.001 ETH", "Submit a skill attestation with ZK proof"],
                ["registerAuditor(commitment, stake)", "0.01+ ETH", "Register as anonymous auditor (5% protocol fee)"],
                ["addStake(commitment, amount)", "any", "Add stake to existing registration (5% protocol fee)"],
                ["openDispute(skillHash, index, evidence, bond)", "0.005+ ETH", "Challenge a fraudulent attestation"],
                ["resolveDispute(disputeId, auditorFault)", "0", "Resolve dispute (owner only)"],
                ["initiateUnstake(commitment, amount)", "0", "Start 3-day unstake cooldown"],
                ["completeUnstake(commitment)", "0", "Withdraw ETH after cooldown"],
                ["cancelUnstake(commitment)", "0", "Cancel pending unstake"],
                ["postBounty(skillHash, level, amount)", "0.001+ ETH", "Post bounty to incentivize auditors (5% fee on claim)"],
                ["reclaimBounty(skillHash)", "0", "Reclaim expired bounty (publisher only, full refund)"],
                ["registerAgent(agentURI)", "0", "Register agent in ERC-8004 IdentityRegistry (mints NFT)"],
                ["requestErc8004Validation(params)", "0", "Step 1: Agent owner requests ERC-8004 validation"],
                ["respondToErc8004Validation(params)", "0", "Step 2: AEGIS validator submits validation response"],
                ["linkSkillToAgent(agentId, skillHash, level)", "0", "Link skill to ERC-8004 agent metadata"],
                ["getErc8004ValidationSummary(agentId)", "0 (read)", "Get ERC-8004 validation summary for an agent"],
                ["getErc8004ReputationSummary(agentId)", "0 (read)", "Get ERC-8004 reputation summary for an agent"],
              ]}
            />

            <div style={{ marginTop: 24 }}><SubHeading>Audit Metadata Helpers</SubHeading></div>
            <Para>
              The SDK provides utilities for working with the <InlineCode>aegis/audit-metadata@1</InlineCode> schema:
            </Para>
            <InfoTable
              headers={["Method", "Returns", "Description"]}
              rows={[
                ["createAuditTemplate(level, skillInfo)", "AuditMetadata", "Generate a template with all required criteria for a level"],
                ["validateAuditMetadata(metadata)", "ValidationResult", "Validate metadata against the schema and level requirements"],
                ["computeCriteriaHash(criteriaIds)", "string", "Compute the on-chain auditCriteriaHash from criteria IDs"],
                ["getRequiredCriteria(level)", "CriteriaId[]", "List all required criteria IDs for a level"],
                ["fetchAuditMetadata(cid)", "AuditMetadata", "Fetch structured audit metadata from IPFS"],
              ]}
            />
          </section>

          {/* ═══ MCP Server ═══ */}
          <section id="mcp-server" ref={setRef("mcp-server")} style={{ marginTop: 56 }}>
            <SectionHeading>MCP Server</SectionHeading>
            <Para>
              The <InlineCode>@aegisaudit/mcp-server</InlineCode> package exposes all read-only AEGIS SDK methods as <strong style={{ color: TEXT }}>Model Context Protocol (MCP)</strong> tools. Any MCP-compatible AI client — Claude Desktop, Claude Code, Cursor, Windsurf, or custom agents — can discover skills, verify ZK attestations, and query auditor reputation with zero setup.
            </Para>

            <Callout color={GREEN} label="Zero Config">
              The MCP server auto-resolves the registry address for known chains. Point it at Base Sepolia (chain 84532) or Base Mainnet (chain 8453) and start querying immediately — no contract addresses or ABIs needed.
            </Callout>
          </section>

          <section id="mcp-install" ref={setRef("mcp-install")} style={{ marginTop: 32 }}>
            <SubHeading>Installation</SubHeading>
            <Para>
              One command auto-detects Claude Desktop and Cursor on your machine and configures them:
            </Para>

            <CodeBlock code={`npx @aegisaudit/mcp-server setup

# ◆ AEGIS Protocol — MCP Server Setup
#   ✓ Claude Desktop — configured
#   ✓ Cursor — configured
#   Done! Restart your AI client to load the AEGIS tools.`} filename="terminal" lang="bash" />

            <Callout color={PURPLE} label="Claude Code">
              For Claude Code, use the built-in MCP command instead:<br/><br/>
              <InlineCode>claude mcp add aegis-protocol -- npx -y @aegisaudit/mcp-server</InlineCode>
            </Callout>

            <SubHeading>Manual Configuration</SubHeading>
            <Para>
              If you prefer to configure manually, add this to your client's MCP config file:
            </Para>

            <CodeBlock code={`{
  "mcpServers": {
    "aegis-protocol": {
      "command": "npx",
      "args": ["-y", "@aegisaudit/mcp-server"],
      "env": {
        "AEGIS_CHAIN_ID": "8453"
      }
    }
  }
}`} filename="claude_desktop_config.json / .mcp.json / .cursor/mcp.json" lang="json" />

            <SubHeading>Environment Variables</SubHeading>
            <InfoTable
              headers={["Variable", "Default", "Description"]}
              rows={[
                ["AEGIS_CHAIN_ID", "8453", "Target chain — 8453 (Base Mainnet) or 84532 (Base Sepolia)"],
                ["AEGIS_RPC_URL", "Auto", "Custom RPC endpoint (defaults to public Base RPC)"],
                ["AEGIS_REGISTRY", "Auto", "Registry contract address (auto-resolved for known chains)"],
                ["AEGIS_PRIVATE_KEY", "—", "Wallet private key for write operations (register, stake, dispute). Optional — read tools work without it."],
              ]}
            />

            <Callout color={AMBER} label="Write Operations">
              To enable on-chain write operations, add <InlineCode>AEGIS_PRIVATE_KEY</InlineCode> to the env block in your MCP config. The wallet needs Base ETH for gas and staking. The key never leaves your machine — it stays in the local MCP server process.
            </Callout>
          </section>

          <section id="mcp-tools" ref={setRef("mcp-tools")} style={{ marginTop: 32 }}>
            <SubHeading>Available Tools</SubHeading>
            <Para>
              The MCP server exposes 39 tools — 23 read-only, 4 subgraph-powered, and 12 write operations. Write tools require <InlineCode>AEGIS_PRIVATE_KEY</InlineCode> to be set. If no wallet is configured, calling a write tool returns setup instructions automatically.
            </Para>
            <InfoTable
              headers={["Tool", "Parameters", "Description"]}
              rows={[
                ["aegis-info", "—", "Protocol overview, wallet status, and tool discovery"],
                ["wallet-status", "—", "Check wallet connection, address, and ETH balance"],
                ["list-all-skills", "fromBlock?, toBlock?", "Browse all registered skills on-chain"],
                ["list-all-auditors", "fromBlock?, toBlock?", "Browse all registered auditors"],
                ["get-attestations", "skillHash", "Get ZK attestations for a specific skill"],
                ["verify-attestation", "skillHash, attestationIndex", "Verify a ZK proof on-chain via the UltraHonk verifier"],
                ["get-auditor-reputation", "auditorCommitment", "Query auditor reputation (score, stake, attestation count)"],
                ["get-metadata-uri", "skillHash", "Get the IPFS metadata URI for a skill"],
                ["list-disputes", "skillHash?, fromBlock?, toBlock?", "List opened disputes, optionally filtered by skill"],
                ["list-resolved-disputes", "fromBlock?, toBlock?", "List resolved disputes with slash results"],
                ["get-unstake-request", "auditorCommitment", "Get pending unstake request details"],
                ["register-auditor", "auditorCommitment, stakeEth", "Register as anonymous auditor (5% protocol fee, min 0.01 net)"],
                ["add-stake", "auditorCommitment, amountEth", "Add more ETH stake (5% protocol fee)"],
                ["open-dispute", "skillHash, attestationIndex, evidence, bondEth", "Challenge a fraudulent attestation (min 0.005 ETH bond)"],
                ["initiate-unstake", "auditorCommitment, amountEth", "Start 3-day unstake cooldown"],
                ["complete-unstake", "auditorCommitment", "Withdraw ETH after cooldown period"],
                ["cancel-unstake", "auditorCommitment", "Cancel pending unstake request"],
                ["get-bounty", "skillHash", "Get bounty details for a skill (amount, level, expiry, claimed)"],
                ["post-bounty", "skillHash, requiredLevel, amountEth", "Post ETH bounty for a skill audit (min 0.001 ETH)"],
                ["reclaim-bounty", "skillHash", "Reclaim expired unclaimed bounty (publisher only)"],
                ["create-agent-registration", "name, description, skills?, services?", "Generate ERC-8004 agent registration JSON"],
                ["get-erc8004-validation", "agentId", "Get ERC-8004 validation summary (AEGIS audits)"],
                ["register-agent", "agentURI", "Register agent in ERC-8004 IdentityRegistry"],
                ["request-erc8004-validation", "agentId, skillHash, auditLevel, metadataURI, validatorAddress", "Step 1: Agent owner requests ERC-8004 validation"],
                ["respond-to-erc8004-validation", "requestHash, agentId, skillHash, auditLevel, metadataURI", "Step 2: AEGIS validator submits validation response"],
                ["link-skill-to-agent", "agentId, skillHash, auditLevel", "Link AEGIS skill to ERC-8004 agent identity"],
                ["query-trust-profile", "agentId, knownSkillHashes?", "Aggregated trust profile (AEGIS + ERC-8004, 0-100 score)"],
                ["query-skill-trust", "skillHash", "Trust data for a single skill (attestations, disputes, level)"],
                ["check-skill", "skillHash", "Query skill trust status via subgraph (audit level, attestation count, disputes)"],
                ["browse-unaudited", "limit?, offset?", "List skills with no attestations from the subgraph"],
                ["browse-bounties", "limit?, offset?", "List open bounties sorted by reward from the subgraph"],
                ["audit-skill", "skillHash, level", "Full audit flow — discover, evaluate, generate proof, and attest"],
              ]}
            />

            <Callout color={BLUE} label="Try It">
              After adding the MCP server to your AI client, try asking: <em>"Use the AEGIS tools to list all registered skills and verify the first one"</em> — the agent will call <InlineCode>list-all-skills</InlineCode>, then <InlineCode>verify-attestation</InlineCode> automatically.
            </Callout>
          </section>

          {/* ═══ ERC-8004 Integration ═══ */}
          <section id="erc8004" ref={setRef("erc8004")} style={{ marginTop: 56 }}>
            <SectionHeading>ERC-8004 Integration</SectionHeading>
            <Para>
              AEGIS integrates with <strong style={{ color: TEXT }}>ERC-8004 (Trustless Agents)</strong> — the Ethereum standard for AI agent identity, reputation, and validation backed by MetaMask, Ethereum Foundation, Google, and Coinbase. AEGIS acts as a <strong style={{ color: ACCENT }}>specialized validation provider</strong>: agents register identity via ERC-8004, and AEGIS provides ZK-verified audit attestations that feed into their ValidationRegistry.
            </Para>

            <InfoTable
              headers={["AEGIS Level", "ERC-8004 Score", "Tag"]}
              rows={[
                ["L1 Functional", "33 / 100", "aegis-audit"],
                ["L2 Robust", "66 / 100", "aegis-audit"],
                ["L3 Security", "100 / 100", "aegis-audit"],
              ]}
            />

            <InfoTable
              headers={["Registry", "Base Sepolia", "Base Mainnet"]}
              rows={[
                ["IdentityRegistry", "0x8004A818...BD9e", "0x8004A169...a432"],
                ["ReputationRegistry", "0x8004B663...8713", "0x8004BAa1...9b63"],
                ["ValidationRegistry", "0x8004Cb1B...4272", "Not yet deployed"],
              ]}
            />
          </section>

          <section id="erc8004-bridging" ref={setRef("erc8004-bridging")} style={{ marginTop: 32 }}>
            <SubHeading>Bridging Flow</SubHeading>
            <Para>
              Bridging uses a <strong style={{ color: ACCENT }}>two-wallet model</strong> that matches ERC-8004's trust architecture: the agent owner requests validation, then a separate AEGIS validator responds. No self-certification.
            </Para>
            <CodeBlock code={`import { AegisClient } from '@aegisaudit/sdk';

// ── Agent Owner (wallet A) ──
const ownerClient = new AegisClient({ chainId: 8453 });
ownerClient.setWallet(agentOwnerWallet);

// 1. Register agent in ERC-8004 IdentityRegistry
const { txHash } = await ownerClient.registerAgent('ipfs://QmAgentMetadata...');

// 2. After AEGIS audit, request validation (names the validator)
const { requestHash } = await ownerClient.requestErc8004Validation({
  agentId: 1n,
  skillHash: '0xabc...',
  auditLevel: 2,            // L2 Robust → score 66
  metadataURI: 'ipfs://QmAuditResult...',
  validatorAddress: '0xAEGIS_VALIDATOR...',
});

// ── AEGIS Validator (wallet B) ──
const validatorClient = new AegisClient({ chainId: 8453 });
validatorClient.setWallet(aegisValidatorWallet);

// 3. Validator responds with the AEGIS score
await validatorClient.respondToErc8004Validation({
  requestHash,
  agentId: 1n,
  skillHash: '0xabc...',
  auditLevel: 2,
  metadataURI: 'ipfs://QmAuditResult...',
  includeReputation: true,  // also submit reputation feedback
});

// 4. Any ERC-8004 consumer can now query AEGIS validations
const summary = await ownerClient.getErc8004ValidationSummary(1n);
// { count: 1n, averageResponse: 66 }`} filename="bridge.ts" lang="typescript" />
          </section>

          <section id="x402-trust-api" ref={setRef("x402-trust-api")} style={{ marginTop: 32 }}>
            <SubHeading>x402 Trust API</SubHeading>
            <Para>
              The AEGIS Trust API uses <strong style={{ color: TEXT }}>x402</strong> (Coinbase's HTTP 402 protocol) to serve aggregated trust intelligence for USDC micropayments on Base. On-chain attestation data is public, but querying it requires multiple RPC calls across two contract systems. The Trust API aggregates AEGIS Registry + ERC-8004 data into a single <InlineCode>TrustProfile</InlineCode> response.
            </Para>

            <Para>
              Two modes: <strong style={{ color: TEXT }}>Direct mode</strong> queries on-chain for free (multiple RPC calls via the SDK). <strong style={{ color: TEXT }}>API mode</strong> hits an x402-gated endpoint — pay USDC, get one response.
            </Para>

            <InfoTable headers={["Endpoint", "Method", "Description"]} rows={[
              ["/v1/trust/:agentId", "GET", "Full agent trust profile with composite 0-100 score"],
              ["/v1/trust/skill/:skillHash", "GET", "Single skill trust data with attestation details"],
              ["/v1/trust/batch", "POST", "Batch trust profiles for up to 10 agents"],
            ]} />

            <CodeBlock code={`// Host a Trust API — serve trust data for USDC
import express from 'express';
import { createTrustApiMiddleware } from '@aegisaudit/sdk';

const app = express();
app.use(express.json());

const trustRouter = await createTrustApiMiddleware({
  paymentAddress: '0xYourAddress...',
  chainId: 8453,
  pricing: {
    profileQuery: '0.10',  // 10 cents per profile
    skillQuery: '0.05',    // 5 cents per skill
    batchQuery: '0.50',    // 50 cents per batch
  },
});

app.use(trustRouter);
app.listen(3001);`} filename="trust-server.ts" lang="typescript" />

            <CodeBlock code={`// Consume the Trust API — auto-pay with x402
import { createTrustApiClient } from '@aegisaudit/sdk';

const trustApi = await createTrustApiClient(
  walletClient,
  'https://trust.aegisprotocol.tech'
);

// Pay 10c USDC, get aggregated trust profile
const profile = await trustApi.getProfile(42n);
console.log(profile.overall.trustScore); // 85
console.log(profile.overall.level);      // 'trusted'

// Batch query multiple agents
const profiles = await trustApi.batchProfiles([1n, 2n, 3n]);`} filename="trust-client.ts" lang="typescript" />

            <Callout color={ACCENT} label="Direct Mode (Free)">
              Don't need x402? Use direct mode via the SDK — it queries on-chain for free: <InlineCode>client.getTrustProfile(agentId)</InlineCode> and <InlineCode>client.getSkillTrustScore(skillHash)</InlineCode>. Makes multiple RPC calls but requires no USDC payment.
            </Callout>

            <Callout color={PURPLE} label="Optional Dependencies">
              x402 support requires optional peer dependencies: <InlineCode>npm install @x402/fetch</InlineCode> (consumer) and <InlineCode>@x402/express</InlineCode> (server). The core trust aggregation logic works without them.
            </Callout>
          </section>

          {/* ═══ CLI Reference ═══ */}
          <section id="cli-ref" ref={setRef("cli-ref")} style={{ marginTop: 56 }}>
            <SectionHeading>CLI Reference</SectionHeading>
            <Para>
              The AEGIS CLI (<InlineCode>@aegisaudit/cli</InlineCode>) wraps the SDK into 5 terminal commands. All commands support <InlineCode>--network</InlineCode> (base-sepolia | base), <InlineCode>--rpc</InlineCode>, and <InlineCode>--registry</InlineCode> flags.
            </Para>

            {[
              {
                name: "register-auditor",
                desc: "Register as an anonymous auditor by staking ETH",
                usage: "aegis register-auditor -c <commitment> -s 0.05 --private-key <key>",
                flags: [
                  ["-c, --commitment <hex>", "bytes32", "Auditor commitment hash (required)"],
                  ["-s, --stake <eth>", "string", "Stake amount in ETH (default: 0.01)"],
                  ["--private-key <key>", "hex", "Wallet private key for signing"],
                ],
              },
              {
                name: "register-skill",
                desc: "Register a skill with a ZK attestation proof",
                usage: "aegis register-skill --proof ./proof --public-inputs ./public_inputs --metadata-uri ipfs://Qm... -c <commitment> -l 2",
                flags: [
                  ["--proof <path>", "string", "Path to proof binary file (required)"],
                  ["--public-inputs <path>", "string", "Path to public_inputs binary (required)"],
                  ["--metadata-uri <uri>", "string", "IPFS metadata URI (required)"],
                  ["-c, --commitment <hex>", "bytes32", "Auditor commitment (required)"],
                  ["-l, --level <n>", "1|2|3", "Audit level (default: 1)"],
                  ["--fee <eth>", "string", "Registration fee (default: 0.001)"],
                ],
              },
              {
                name: "verify",
                desc: "Verify a skill attestation on-chain",
                usage: "aegis verify -s <skillHash> -i 0 --info",
                flags: [
                  ["-s, --skill <hash>", "bytes32", "Skill hash to verify (required)"],
                  ["-i, --index <n>", "number", "Attestation index (default: 0)"],
                  ["--info", "boolean", "Show details without re-verifying proof"],
                ],
              },
              {
                name: "status",
                desc: "Query auditor reputation or skill status",
                usage: "aegis status --auditor <commitment>",
                flags: [
                  ["--auditor <commitment>", "bytes32", "Query auditor reputation data"],
                  ["--skill <hash>", "bytes32", "Query skill attestation details"],
                ],
              },
              {
                name: "deploy",
                desc: "Deploy AEGIS contracts (wraps forge script)",
                usage: "aegis deploy -n base-sepolia --private-key <key> --verify",
                flags: [
                  ["--verify", "boolean", "Verify contracts on Basescan after deploy"],
                  ["--contracts-dir <path>", "string", "Path to contracts package (default: ./packages/contracts)"],
                  ["--private-key <key>", "hex", "Deployer private key"],
                ],
              },
            ].map(cmd => (
              <div key={cmd.name} style={{
                border: `1px solid ${BORDER}`, borderRadius: 10,
                overflow: "hidden", marginBottom: 12,
              }}>
                <div style={{
                  padding: "14px 16px", background: SURFACE,
                  borderBottom: `1px solid ${BORDER}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: SYN_FN }}>
                      aegis {cmd.name}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: TEXT_DIM }}>{cmd.desc}</div>
                </div>
                <div style={{ padding: "12px 16px" }}>
                  <div style={{
                    fontFamily: FONT_CODE, fontSize: 11, color: TEXT_MUTED,
                    background: "#0D0D10", padding: "8px 12px", borderRadius: 6,
                    marginBottom: 12, border: `1px solid ${BORDER}`,
                  }}>
                    $ {cmd.usage}
                  </div>
                  <InfoTable
                    headers={["Flag", "Type", "Description"]}
                    rows={cmd.flags}
                  />
                </div>
              </div>
            ))}
          </section>

          {/* ═══ Deployment ═══ */}
          <section id="deployment" ref={setRef("deployment")} style={{ marginTop: 56 }}>
            <SectionHeading>Deployment</SectionHeading>
            <Para>
              AEGIS contracts are deployed using Foundry's <InlineCode>forge script</InlineCode> via the CLI. The deploy command handles both the UltraHonkVerifier and AegisRegistry contracts.
            </Para>

            <SubHeading>Chain Configuration</SubHeading>
            <InfoTable
              headers={["Network", "Chain ID", "RPC URL", "Explorer"]}
              rows={[
                ["Base Mainnet", "8453", "https://mainnet.base.org", "https://basescan.org"],
                ["Base Sepolia", "84532", "https://sepolia.base.org", "https://sepolia.basescan.org"],
              ]}
            />

            <SubHeading>Current Deployment (Base Sepolia)</SubHeading>
            <InfoTable
              headers={["Contract", "Address"]}
              rows={[
                ["UltraHonkVerifier", "0x6c58dE61157AA10E62174c37DFBe63094e334cE6"],
                ["AegisRegistry", "0x851CfbB116aBdd50Ab899c35680eBd8273dD6Bba"],
              ]}
            />

            <SubHeading>Deploy Steps</SubHeading>
            <CodeBlock code={`# 1. Build contracts
cd packages/contracts
forge build

# 2. Deploy to Base Sepolia
aegis deploy -n base-sepolia \\
  --private-key 0x... \\
  --verify

# 3. Verify deployment
aegis status --skill 0x0000...0000 -n base-sepolia

# Output:
# ✓ UltraHonkVerifier deployed at 0x6c58...
# ✓ AegisRegistry deployed at 0x851C...
# ✓ Contracts verified on Basescan`} filename="terminal" lang="bash" />

            <SubHeading>Environment Variables</SubHeading>
            <InfoTable
              headers={["Variable", "Required", "Description"]}
              rows={[
                ["PRIVATE_KEY", "Yes", "Deployer wallet private key (hex)"],
                ["BASESCAN_API_KEY", "For --verify", "Basescan API key for contract verification"],
                ["RPC_URL", "No", "Custom RPC URL (defaults to public Base RPC)"],
              ]}
            />

            <Callout color={AMBER} label="Important">
              Never commit private keys or API keys to version control. Use environment variables or a <InlineCode>.env</InlineCode> file (which is gitignored by default in the monorepo).
            </Callout>
          </section>

          {/* ═══ Consumer Middleware ═══ */}
          <section id="consumer-middleware" ref={setRef("consumer-middleware")} style={{ marginTop: 56 }}>
            <SectionHeading>Consumer Middleware</SectionHeading>
            <Para>
              The <InlineCode>@aegisaudit/consumer-middleware</InlineCode> package (v0.1.0) is a pre-execution trust gate for AI agent frameworks. It intercepts tool calls, queries AEGIS attestation data, and enforces configurable trust policies before allowing execution.
            </Para>

            <CodeBlock code={`npm install @aegisaudit/consumer-middleware`} filename="terminal" lang="bash" />

            <SubHeading>TrustGate</SubHeading>
            <Para>
              Create a gate with your policy and map tool names to AEGIS skill hashes. The gate queries attestation data from the subgraph (with on-chain fallback) and caches results for 60 seconds.
            </Para>

            <CodeBlock code={`import { TrustGate } from '@aegisaudit/consumer-middleware';

const gate = new TrustGate({
  policy: {
    minAuditLevel: 2,       // 1=Functional, 2=Robust, 3=Security
    minAttestations: 1,      // Minimum non-revoked attestations
    blockOnDispute: true,    // Block skills with unresolved disputes
    mode: 'enforce',         // 'enforce' | 'warn' | 'log'
  },
  skills: [
    { toolName: 'web_search', skillHash: '0xabc...' },
    { toolName: 'file_read', skillHash: '0xdef...' },
  ],
});

const result = await gate.check('web_search');
if (!result.allowed) {
  throw new Error(result.reason);
}`} filename="trust-gate.ts" lang="typescript" />

            <SubHeading>Framework Adapters</SubHeading>
            <InfoTable
              headers={["Framework", "Import Path", "Integration"]}
              rows={[
                ["LangChain", "@aegisaudit/consumer-middleware/langchain", "createAegisTrustHandler(gate) \u2192 callback handler"],
                ["CrewAI", "@aegisaudit/consumer-middleware/crewai", "createAegisTrustHook(gate) \u2192 before-tool-call hook"],
                ["MCP", "@aegisaudit/consumer-middleware/mcp", "aegisMcpMiddleware(gate, handler) \u2192 tool call wrapper"],
              ]}
            />

            <Callout color={GREEN} label="One-Liner Integration">
              In enforce mode, blocked tools throw <InlineCode>AegisTrustError</InlineCode> with full trust data attached. In warn mode, execution continues but logs the decision. In log mode, decisions are recorded silently.
            </Callout>
          </section>

          {/* ═══ Reputation System ═══ */}
          <section id="reputation-system" ref={setRef("reputation-system")} style={{ marginTop: 56 }}>
            <SectionHeading>Reputation System</SectionHeading>
            <Para>
              Auditor reputation is computed by the subgraph (v0.3.0) using a weighted 7-factor formula with fixed-point arithmetic. Scores update automatically on every attestation, stake change, and dispute resolution.
            </Para>

            <InfoTable
              headers={["Factor", "Weight", "Details"]}
              rows={[
                ["Attestations", "count \u00d7 10", "Base score from total attestation count"],
                ["Level Bonus", "L2 \u00d7 5 + L3 \u00d7 15", "Higher-level audits earn more points"],
                ["Stake", "Diminishing above 0.1 ETH", "Encourages broad participation over whale staking"],
                ["Tenure", "+1 per 30 days (cap 12)", "Rewards long-term auditors"],
                ["Disputes Lost", "-20 per loss", "Penalizes bad attestations"],
                ["Win Rate", "0.5\u00d7 to 1.1\u00d7 multiplier", "Based on dispute win/loss ratio"],
                ["Decay", "90-day grace, then linear to 0.5\u00d7", "Inactive auditors lose score over 365 days"],
              ]}
            />

            <SubHeading>Reputation Tiers</SubHeading>
            <Para>
              Tiers are gated by both minimum score and minimum stake. If an auditor's score qualifies for a higher tier but their stake doesn't meet the threshold, the tier is capped and a warning is shown on the profile page.
            </Para>

            <InfoTable
              headers={["Tier", "Min Score", "Min Stake"]}
              rows={[
                ["Bronze", "\u2265 0", "\u2265 0.01 ETH"],
                ["Silver", "\u2265 10", "\u2265 0.025 ETH"],
                ["Gold", "\u2265 25", "\u2265 0.1 ETH"],
                ["Diamond", "\u2265 50", "\u2265 0.5 ETH"],
              ]}
            />

            <Callout color={AMBER} label="Formula">
              final = (attestations + levelBonus + stake + tenure - disputes) \u00d7 winRate \u00d7 decay. All math uses BigInt with \u00d71000 fixed-point precision in AssemblyScript.
            </Callout>

            <div id="aegis-token" ref={setRef("aegis-token")} />
            <SubHeading>$AEGIS Token</SubHeading>
            <Para>
              $AEGIS is a rewards token on Base (launched via Clanker) that closes the economic loop between protocol revenue and auditor incentives. A 3{"\u2013"}5% buy/sell tax on every $AEGIS trade generates a revenue pool that is periodically distributed as airdrops to staked auditors, weighted by reputation score.
            </Para>

            <InfoTable
              headers={["Mechanic", "Details"]}
              rows={[
                ["Tax", "3\u20135% on every buy and sell \u2014 collected automatically by the token contract"],
                ["Revenue Pool", "Accumulated tax is held until the next airdrop epoch"],
                ["Snapshot", "CLI tool queries the subgraph, computes proportional allocations using BigInt arithmetic"],
                ["Weighting", "Each auditor receives tokens proportional to their reputation score \u00f7 total reputation"],
                ["Merkle Tree", "Allocations are committed to an OpenZeppelin StandardMerkleTree (bytes32 commitment + uint256 amount)"],
                ["Distribution", "v1: batch transfer via multisig. Future: on-chain MerkleDistributor claim contract"],
              ]}
            />

            <Callout color={GREEN} label="Incentive Loop">
              Audit {"\u2192"} earn reputation {"\u2192"} receive larger $AEGIS airdrops {"\u2192"} token demand from consumers funds the next round. The higher your reputation, the larger your share of every airdrop epoch.
            </Callout>

            <InfoTable
              headers={["Component", "Location", "Description"]}
              rows={[
                ["Snapshot CLI", "packages/airdrop/", "aegis-airdrop snapshot --amount <n> \u2014 queries subgraph, builds Merkle tree, writes JSON + CSV"],
                ["Distribute CLI", "packages/airdrop/", "aegis-airdrop distribute --snapshot <path> --verify --dry-run"],
                ["Subgraph Query", "Paginated (1000/batch)", "Fetches all registered auditors with reputationScore > 0"],
                ["Dust Handling", "Last auditor", "Remainder tokens from integer division go to the last auditor in sorted order"],
                ["Output", "./snapshots/", "snapshot-{timestamp}.json + .csv with allocations, proofs, and merkle root"],
              ]}
            />
          </section>

          {/* ═══ TAO Subnet Auditing ═══ */}
          <section id="tao-subnet-auditing" ref={setRef("tao-subnet-auditing")} style={{ marginTop: 56 }}>
            <SectionHeading>TAO Subnet Auditing</SectionHeading>
            <Para>
              AEGIS supports auditing Bittensor (TAO) subnet skills using the same on-chain registry on Base. TAO skill hashes are derived client-side from the subnet ID and optional miner hotkey {"\u2014"} the contract just sees a standard <InlineCode>bytes32</InlineCode>.
            </Para>

            <SubHeading>Skill Hash Derivation</SubHeading>
            <Para>
              Two levels of granularity: subnet-level audits evaluate the protocol, miner-level audits evaluate a specific endpoint.
            </Para>
            <InfoTable
              headers={["Scope", "Formula", "Example"]}
              rows={[
                ["Subnet", 'keccak256("tao:subnet:<netuid>")', "computeTaoSubnetHash(18)"],
                ["Miner", 'keccak256("tao:miner:<netuid>:<hotkey>")', 'computeTaoMinerHash(18, "5F4tQ...")'],
              ]}
            />

            <SubHeading>TAO Audit Criteria</SubHeading>
            <Para>
              Auditors still classify their audit as L1/L2/L3, then optionally add TAO-specific supplementary checks.
            </Para>
            <InfoTable
              headers={["Criteria", "Description"]}
              rows={[
                ["TAO.RESPONSE", "Axon endpoint responds with valid output for standard queries"],
                ["TAO.UPTIME", "Endpoint demonstrates consistent availability over monitoring period"],
                ["TAO.QUALITY", "Response quality meets subnet-specific standards"],
                ["TAO.WEIGHT", "Validator weight distribution is consistent and not gaming emissions"],
                ["TAO.LATENCY", "Response latency within acceptable bounds for the subnet type"],
                ["TAO.INTEGRITY", "Responses are genuine (not copied/proxied from other miners)"],
              ]}
            />

            <SubHeading>MCP Discovery Tools</SubHeading>
            <InfoTable
              headers={["Tool", "Description"]}
              rows={[
                ["aegis_tao_list_subnets", "List all active Bittensor subnets with miner counts and computed skill hashes"],
                ["aegis_tao_browse_miners", "Browse miners on a subnet, showing which are unaudited in AEGIS"],
                ["aegis_tao_check_subnet", "Check existing AEGIS attestations for a subnet or specific miner by netuid"],
              ]}
            />

            <Callout color={ACCENT} label="Same Registry">
              TAO attestations live in the same AegisRegistry on Base. Consumers verify trust with the same TrustGate middleware {"\u2014"} just pass a TAO-derived skill hash instead of an EVM one.
            </Callout>
          </section>

          {/* ═══ Agent Playbooks ═══ */}
          <section id="agent-playbooks" ref={setRef("agent-playbooks")} style={{ marginTop: 56 }}>
            <SectionHeading>Agent Playbooks</SectionHeading>
            <Para>
              Step-by-step guides for building autonomous agents that participate in the AEGIS ecosystem. Found in <InlineCode>packages/agents/</InlineCode> in the monorepo.
            </Para>

            <SubHeading>B3 — Auditor Agent</SubHeading>
            <Para>
              A 13-section playbook for building an agent that discovers unaudited skills, performs L1/L2/L3 security audits against all 14 criteria, generates ZK proofs, and submits on-chain attestations. Includes example reports for each audit level and a revenue model based on bounty collection.
            </Para>
            <InfoTable
              headers={["Resource", "Path", "Description"]}
              rows={[
                ["Playbook", "packages/agents/auditor-agent/PLAYBOOK.md", "Full step-by-step guide (13 sections)"],
                ["L1 Example", "packages/agents/auditor-agent/examples/example-l1-report.json", "4-criteria functional audit report"],
                ["L2 Example", "packages/agents/auditor-agent/examples/example-l2-report.json", "9-criteria robust audit report"],
                ["L3 Example", "packages/agents/auditor-agent/examples/example-l3-report.json", "14-criteria security audit report"],
                ["Checklist", "packages/agents/shared/audit-checklist.md", "All 14 criteria with pass/fail criteria"],
              ]}
            />

            <SubHeading>B4 — Dispute Agent</SubHeading>
            <Para>
              A 9-section playbook for building an agent that monitors attestations, detects vulnerabilities in audited skills, prepares structured evidence, and submits on-chain disputes. Revenue comes from bond returns plus 50% of slashed auditor stake.
            </Para>
            <InfoTable
              headers={["Resource", "Path", "Description"]}
              rows={[
                ["Playbook", "packages/agents/dispute-agent/PLAYBOOK.md", "Full guide (9 sections)"],
                ["Evidence Example", "packages/agents/dispute-agent/examples/example-dispute-evidence.json", "Structured dispute evidence with reproduction steps"],
                ["Evidence Schema", "packages/agents/shared/evidence-schema.json", "JSON Schema for aegis/dispute-evidence@1"],
              ]}
            />

            <Callout color={ACCENT} label="MCP-Powered">
              Both playbooks reference the 39 MCP server tools by exact name and parameter format. Agents built with Claude, GPT, or any MCP-compatible client can follow the playbooks directly.
            </Callout>
          </section>

          <div style={{ height: 80 }} />
        </main>
      </div>
    </>
  );
}
