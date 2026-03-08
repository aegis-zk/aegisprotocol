import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavConnectWallet } from "../components/NavConnectWallet";
import { RegisterAuditor } from "./RegisterAuditor";
import { RegisterSkill } from "./RegisterSkill";
import { Verify } from "./Verify";
import { Status } from "./Status";

// ── Design tokens (matches all other pages) ──────────────────
const ACCENT = "#FF3366";
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

// ── Tab config ──────────────────────────────────────────────
type DAppTab = "verify" | "auditor" | "skill" | "status";

const TABS: { id: DAppTab; label: string; icon: string; desc: string }[] = [
  { id: "verify", label: "Verify Skill", icon: "🔍", desc: "Look up attestations and verify ZK proofs on-chain" },
  { id: "auditor", label: "Register Auditor", icon: "🛡️", desc: "Stake ETH to become an anonymous auditor" },
  { id: "skill", label: "Submit Skill", icon: "📦", desc: "Register a skill with a ZK-verified attestation proof" },
  { id: "status", label: "Auditor Status", icon: "📊", desc: "Look up any auditor's reputation and stats" },
];

export function DAppPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DAppTab>("verify");

  const navItems = [
    { label: "DApp", onClick: () => navigate("/app") },
    { label: "Registry", onClick: () => navigate("/registry") },
    { label: "Dashboard", onClick: () => navigate("/dashboard") },
    { label: "Bounties", onClick: () => navigate("/bounties") },
    { label: "Auditors", onClick: () => navigate("/auditors") },
    { label: "Developers", onClick: () => navigate("/developers") },
    { label: "Docs", onClick: () => navigate("/docs") },
  ];

  const currentTab = TABS.find(t => t.id === activeTab)!;

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        /* Override global CSS variables within this page so the form components match */
        .dapp-content {
          --bg: ${BG};
          --bg-card: ${SURFACE};
          --bg-card-hover: ${SURFACE2};
          --bg-input: ${SURFACE2};
          --border: ${BORDER};
          --border-focus: ${ACCENT};
          --text: ${TEXT};
          --text-muted: ${TEXT_DIM};
          --text-heading: ${TEXT};
          --accent: ${ACCENT};
          --accent-hover: #FF6B9D;
          --success: #4ADE80;
          --warning: #FBBF24;
          --error: #F87171;
        }
        .dapp-content .page-title {
          font-family: ${FONT_HEAD};
          font-size: 1.2rem;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .dapp-content .page-desc {
          font-size: 0.85rem;
        }
        .dapp-content .card {
          border-radius: 10px;
        }
        .dapp-content .btn {
          font-family: ${FONT};
        }
        .dapp-content .form-input {
          font-family: ${FONT};
          border-radius: 8px;
        }
        .dapp-content .form-label {
          font-family: ${FONT};
          font-size: 0.82rem;
          letter-spacing: 0.02em;
        }
      `}</style>

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "0 40px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(9,9,11,0.92)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, border: `2px solid ${ACCENT}`, borderRadius: 4,
            transform: "rotate(45deg)", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }} onClick={() => navigate("/")}>
            <div style={{ width: 8, height: 8, background: ACCENT, borderRadius: 1 }} />
          </div>
          <span style={{ fontFamily: FONT_HEAD, fontSize: 18, fontWeight: 700, color: TEXT, letterSpacing: "-0.02em", cursor: "pointer" }} onClick={() => navigate("/")}>
            AEGIS
          </span>
          <span style={{
            fontSize: 11, color: TEXT_DIM,
            background: SURFACE2, padding: "2px 8px", borderRadius: 4,
            marginLeft: 4,
          }}>DAPP</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {navItems.map(item => (
            <a key={item.label} href="#" style={{
              color: item.label === "DApp" ? TEXT : TEXT_DIM,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: item.label === "DApp" ? 700 : 400,
              borderBottom: item.label === "DApp" ? `2px solid ${ACCENT}` : "2px solid transparent",
              paddingBottom: 2,
              transition: "color 0.15s",
              cursor: item.label === "DApp" ? "default" : "pointer",
            }}
              onClick={e => { e.preventDefault(); if (item.label !== "DApp" && item.onClick) item.onClick(); }}
              onMouseEnter={e => { if (item.label !== "DApp") (e.target as HTMLElement).style.color = TEXT; }}
              onMouseLeave={e => { if (item.label !== "DApp") (e.target as HTMLElement).style.color = TEXT_DIM; }}
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

      {/* Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "100px 24px 60px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32, animation: "fadeInUp 0.5s ease 0s both" }}>
          <h1 style={{ fontFamily: FONT_HEAD, fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
            Protocol Interface
          </h1>
          <p style={{ color: TEXT_DIM, fontSize: 13, marginTop: 8 }}>
            Interact directly with the AEGIS smart contract on Base L2
          </p>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 32,
          borderBottom: `1px solid ${BORDER}`, paddingBottom: 0,
          animation: "fadeInUp 0.5s ease 0.05s both",
        }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === tab.id ? `2px solid ${ACCENT}` : "2px solid transparent",
                color: activeTab === tab.id ? TEXT : TEXT_DIM,
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 700 : 400,
                fontFamily: FONT,
                padding: "12px 16px",
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 6,
                marginBottom: -1,
              }}
              onMouseEnter={e => { if (activeTab !== tab.id) (e.currentTarget.style.color = TEXT); }}
              onMouseLeave={e => { if (activeTab !== tab.id) (e.currentTarget.style.color = TEXT_DIM); }}
            >
              <span style={{ fontSize: 14 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active Tab Description */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 24,
          padding: "12px 16px", background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8,
          animation: "fadeInUp 0.5s ease 0.1s both",
        }}>
          <span style={{ fontSize: 20 }}>{currentTab.icon}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 2 }}>{currentTab.label}</div>
            <div style={{ fontSize: 11, color: TEXT_DIM }}>{currentTab.desc}</div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="dapp-content" style={{ animation: "fadeInUp 0.5s ease 0.15s both" }}>
          {activeTab === "verify" && <Verify />}
          {activeTab === "auditor" && <RegisterAuditor />}
          {activeTab === "skill" && <RegisterSkill />}
          {activeTab === "status" && <Status />}
        </div>
      </div>
    </div>
  );
}
