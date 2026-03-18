import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { NavConnectWallet } from "../components/NavConnectWallet";

// ── Design System ────────────────────────────────────────────
const ACCENT = "#FF3366";
const BG = "#09090B";
const SURFACE = "#131316";
const SURFACE2 = "#1A1A1F";
const BORDER = "#2A2A30";
const TEXT = "#E4E4E7";
const TEXT_DIM = "#71717A";
const TEXT_MUTED = "#52525B";

const FONT_HEAD = "'Orbitron', sans-serif";
const FONT = "'Space Mono', monospace";

const GREEN = "#4ADE80";
const PURPLE = "#A78BFA";
const AMBER = "#FBBF24";
const BLUE = "#60A5FA";

// ── Update Entries ──────────────────────────────────────────
type Category = "Protocol" | "SDK" | "Frontend" | "Token" | "Agent" | "Subgraph" | "MCP" | "Coming Soon";

interface UpdateEntry {
  date: string;
  title: string;
  category: Category;
  description: string;
}

const CATEGORY_COLORS: Record<Category, string> = {
  Protocol: ACCENT,
  SDK: BLUE,
  Frontend: PURPLE,
  Token: AMBER,
  Agent: GREEN,
  Subgraph: BLUE,
  MCP: PURPLE,
  "Coming Soon": TEXT_MUTED,
};

const UPDATES: UpdateEntry[] = [
  {
    date: "2026-03-17",
    title: "SDK & MCP Server v0.6.0 \u2014 Mainnet-Only",
    category: "SDK",
    description: "Removed all Base Sepolia/testnet references across the entire stack. Default chain is now 8453 (Base mainnet) everywhere \u2014 SDK, MCP server, CLI, and web app. Eliminates agent confusion from installing testnet tooling.",
  },
  {
    date: "2026-03-17",
    title: "Auto-Wallet Generation",
    category: "MCP",
    description: "New generate-wallet MCP tool lets agents create a fresh Ethereum wallet in one call \u2014 no more guiding users through MetaMask private key export. Returns address, key, and ready-to-paste config snippet.",
  },
  {
    date: "2026-03-17",
    title: "Bundled Prover \u2014 Zero-Config ZK Proofs",
    category: "SDK",
    description: "SDK now auto-detects the bb binary from @aztec/bb.js and bundles the compiled circuit artifact. Agents no longer need to hunt for bb, nargo, or circuit files \u2014 just pass inputs and the SDK handles everything.",
  },
  {
    date: "2026-03-17",
    title: "MCP Server v0.5.2 \u2014 13 Onboarding Fixes",
    category: "MCP",
    description: "Resolved 13 issues from first auditor agent test: fixed commitment stdout parsing, corrected tool parameter schemas, improved error messages, added missing tool registrations, and hardened the full audit-to-attestation pipeline.",
  },
  {
    date: "2026-03-17",
    title: "Automated Audit Pipeline v0.2",
    category: "Agent",
    description: "Event-driven audit queue that watches for SkillListed events and automates the full lifecycle: bounty-aware racing, competitor detection, 14-criteria evaluation, ZK proof generation, on-chain attestation, and health monitoring.",
  },
  {
    date: "2026-03-17",
    title: "TAO Subnet Integration",
    category: "Coming Soon",
    description: "Exploring Bittensor TAO subnet integration \u2014 mapping AEGIS auditors to miners, validators to reputation oracles, and TAO emissions to replace custom tokenomics.",
  },
  {
    date: "2026-03-17",
    title: "$AEGIS Token Documentation",
    category: "Token",
    description: "Added comprehensive $AEGIS Token section to Docs and Developers pages covering the 3\u20135% buy/sell tax, reputation-weighted airdrops, Merkle tree distribution, and the full incentive loop.",
  },
  {
    date: "2026-03-15",
    title: "ERC-8004 Cross-Chain Attestation",
    category: "Protocol",
    description: "Integrated ERC-8004 agent identity standard. AEGIS validators attest agent skills with mapped trust scores (L1\u219233, L2\u219266, L3\u2192100). Any ERC-8004-aware app gets AEGIS trust data for free.",
  },
  {
    date: "2026-03-15",
    title: "x402 Trust API",
    category: "SDK",
    description: "Added x402 HTTP payment protocol support. Consumers pay per-query in USDC for trust profiles \u2014 no API keys, no subscriptions. Payment negotiated in HTTP headers with zero config.",
  },
  {
    date: "2026-03-14",
    title: "Auditor Agent Playbook",
    category: "Agent",
    description: "Published 13-section playbook for building auditor agents: discover unaudited skills, run L1/L2/L3 audits against all 14 criteria, generate ZK proofs, and submit on-chain attestations.",
  },
  {
    date: "2026-03-14",
    title: "Dispute Agent Playbook",
    category: "Agent",
    description: "Published 9-section playbook for dispute agents: monitor attestations, detect vulnerabilities, prepare structured evidence, and submit on-chain disputes with bond management.",
  },
  {
    date: "2026-03-12",
    title: "Subgraph v0.3.0 \u2014 7-Factor Reputation",
    category: "Subgraph",
    description: "Upgraded subgraph with weighted 7-factor reputation formula: attestation count, level bonus, stake (diminishing), tenure, disputes lost, win rate multiplier, and decay. All BigInt fixed-point arithmetic.",
  },
  {
    date: "2026-03-10",
    title: "MCP Server \u2014 42 Tools",
    category: "MCP",
    description: "Shipped MCP server with 42 tools for Claude and MCP-compatible AI agents. Covers skill discovery, audit submission, dispute management, bounty tracking, reputation queries, ERC-8004 bridging, and trust profiles.",
  },
  {
    date: "2026-03-08",
    title: "Protocol Launch on Base L2",
    category: "Protocol",
    description: "AEGIS Protocol deployed to Base L2 with AegisRegistry contract, UltraHonk ZK verifier, and initial auditor registration. Anonymous expertise attestation for AI agent skills is live.",
  },
];

// ── Derive sidebar groups ───────────────────────────────────
function deriveGroups(entries: UpdateEntry[]) {
  const groups: { label: string; key: string }[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const [y, m] = e.date.split("-");
    const key = `${y}-${m}`;
    if (!seen.has(key)) {
      seen.add(key);
      const monthName = new Date(Number(y), Number(m) - 1).toLocaleString("en", { month: "long" });
      groups.push({ label: `${monthName} ${y}`, key });
    }
  }
  return groups;
}

// ── Sidebar Item ────────────────────────────────────────────
function SidenavItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "block", width: "100%", textAlign: "left",
      background: "none", border: "none",
      padding: "6px 16px 6px 20px",
      fontFamily: FONT, fontSize: 12,
      fontWeight: active ? 600 : 400,
      color: active ? ACCENT : TEXT_DIM,
      cursor: "pointer", transition: "all 0.15s ease",
    }}
      onMouseEnter={e => { if (!active) (e.target as HTMLElement).style.color = TEXT; }}
      onMouseLeave={e => { if (!active) (e.target as HTMLElement).style.color = TEXT_DIM; }}
    >{label}</button>
  );
}

// ── NavBar ──────────────────────────────────────────────────
function UpdatesNavBar() {
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
        }}>UPDATES</span>
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
          { label: "Updates", onClick: () => navigate("/updates") },
        ].map(item => (
          <a key={item.label} href="#" style={{
            color: item.label === "Updates" ? TEXT : TEXT_DIM,
            textDecoration: "none",
            fontSize: 13,
            fontWeight: item.label === "Updates" ? 700 : 400,
            borderBottom: item.label === "Updates" ? `2px solid ${ACCENT}` : "2px solid transparent",
            paddingBottom: 2,
            transition: "color 0.2s",
            cursor: item.label === "Updates" ? "default" : "pointer",
          }}
            onClick={e => { e.preventDefault(); if (item.label !== "Updates" && item.onClick) item.onClick(); }}
            onMouseEnter={e => { if (item.label !== "Updates") (e.target as HTMLElement).style.color = TEXT; }}
            onMouseLeave={e => { if (item.label !== "Updates") (e.target as HTMLElement).style.color = TEXT_DIM; }}
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

// ── Category Pill ───────────────────────────────────────────
function CategoryPill({ category }: { category: Category }) {
  const color = CATEGORY_COLORS[category];
  return (
    <span style={{
      display: "inline-block",
      fontSize: 10, fontWeight: 700, fontFamily: FONT,
      color,
      background: `${color}18`,
      padding: "2px 10px",
      borderRadius: 4,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
    }}>{category}</span>
  );
}

// ── Main Component ──────────────────────────────────────────
export function Updates() {
  const [activeGroup, setActiveGroup] = useState("");
  const groupRefs = useRef<Record<string, HTMLElement | null>>({});

  const groups = useMemo(() => deriveGroups(UPDATES), []);

  useEffect(() => {
    if (groups.length > 0) setActiveGroup(groups[0].key);
  }, [groups]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveGroup(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    Object.values(groupRefs.current).forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const scrollTo = useCallback((key: string) => {
    const el = groupRefs.current[key];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const setRef = useCallback((key: string) => (el: HTMLElement | null) => {
    groupRefs.current[key] = el;
  }, []);

  // Group entries by month
  const grouped = useMemo(() => {
    const map = new Map<string, UpdateEntry[]>();
    for (const e of UPDATES) {
      const [y, m] = e.date.split("-");
      const key = `${y}-${m}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, []);

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

      <UpdatesNavBar />

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
          }}>Updates</div>
          {groups.map(g => (
            <SidenavItem
              key={g.key} label={g.label} active={activeGroup === g.key}
              onClick={() => scrollTo(g.key)}
            />
          ))}
        </aside>

        {/* Content */}
        <main style={{ marginLeft: 240, flex: 1, maxWidth: 820, padding: "40px 48px 120px" }}>

          {/* Header */}
          <div style={{ marginBottom: 48 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: ACCENT,
              textTransform: "uppercase", letterSpacing: "0.12em",
              fontFamily: FONT, marginBottom: 12,
            }}>Protocol Updates</div>
            <h1 style={{
              fontFamily: FONT_HEAD, fontSize: 32, fontWeight: 800,
              color: TEXT, lineHeight: 1.2, marginBottom: 12,
            }}>AEGIS Changelog</h1>
            <p style={{ fontSize: 14, color: TEXT_DIM, lineHeight: 1.7, maxWidth: 600 }}>
              Every protocol upgrade, SDK release, and ecosystem milestone logged in one place.
            </p>
          </div>

          {/* Timeline */}
          {groups.map(g => {
            const entries = grouped.get(g.key) || [];
            return (
              <section key={g.key} id={g.key} ref={setRef(g.key)} style={{ marginBottom: 48 }}>
                {/* Month heading */}
                <h2 style={{
                  fontFamily: FONT_HEAD, fontSize: 14, fontWeight: 700,
                  color: TEXT_MUTED, textTransform: "uppercase",
                  letterSpacing: "0.06em", marginBottom: 20,
                  paddingBottom: 8, borderBottom: `1px solid ${BORDER}`,
                }}>{g.label}</h2>

                {/* Entries */}
                <div style={{ position: "relative", paddingLeft: 28 }}>
                  {/* Timeline line */}
                  <div style={{
                    position: "absolute", left: 5, top: 8, bottom: 0,
                    width: 2, background: BORDER,
                  }} />

                  {entries.map((entry, i) => (
                    <div key={`${g.key}-${i}`} style={{ position: "relative", marginBottom: 28 }}>
                      {/* Timeline dot */}
                      <div style={{
                        position: "absolute", left: -25, top: 6,
                        width: 12, height: 12, borderRadius: "50%",
                        background: entry.category === "Coming Soon" ? SURFACE2 : ACCENT,
                        border: `2px solid ${entry.category === "Coming Soon" ? TEXT_MUTED : ACCENT}`,
                      }} />

                      {/* Entry card */}
                      <div style={{
                        background: SURFACE, border: `1px solid ${BORDER}`,
                        borderRadius: 10, padding: "16px 20px",
                        transition: "border-color 0.2s",
                      }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = `${ACCENT}40`)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <span style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: FONT }}>
                            {new Date(entry.date + "T00:00:00").toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          <CategoryPill category={entry.category} />
                        </div>
                        <h3 style={{
                          fontFamily: FONT_HEAD, fontSize: 15, fontWeight: 700,
                          color: TEXT, marginBottom: 6,
                        }}>{entry.title}</h3>
                        <p style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.65 }}>
                          {entry.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          <div style={{ height: 80 }} />
        </main>
      </div>
    </>
  );
}
