import { useNavigate } from "react-router-dom";
import { NavConnectWallet } from "../components/NavConnectWallet";
import { useProtocolStats, useActivityFeed } from "../hooks/useSubgraphData";

// ── Design tokens ────────────────────────────────────────
const ACCENT = "#FF3366";
const ACCENT2 = "#FF6B9D";
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
const AMBER = "#FBBF24";
const RED = "#F87171";
const BLUE = "#60A5FA";
const PURPLE = "#A78BFA";

// ── Event type config ────────────────────────────────────
const EVENT_COLORS: Record<string, { color: string; label: string }> = {
  SkillListed:        { color: BLUE,   label: "LISTED" },
  SkillRegistered:    { color: GREEN,  label: "ATTESTED" },
  AuditorRegistered:  { color: AMBER,  label: "AUDITOR" },
  StakeAdded:         { color: AMBER,  label: "STAKED" },
  DisputeOpened:      { color: RED,    label: "DISPUTE" },
  DisputeResolved:    { color: GREEN,  label: "RESOLVED" },
  AttestationRevoked: { color: RED,    label: "REVOKED" },
  BountyPosted:       { color: PURPLE, label: "BOUNTY" },
  BountyClaimed:      { color: GREEN,  label: "CLAIMED" },
  BountyReclaimed:    { color: AMBER,  label: "RECLAIMED" },
  UnstakeInitiated:   { color: AMBER,  label: "UNSTAKE" },
  UnstakeCompleted:   { color: TEXT_DIM, label: "UNSTAKED" },
  UnstakeCancelled:   { color: TEXT_DIM, label: "CANCELLED" },
};

function formatTimestamp(ts: string): string {
  const seconds = Math.floor(Date.now() / 1000 - Number(ts));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function truncHex(hex: string): string {
  if (hex.length < 12) return hex;
  return hex.slice(0, 6) + "\u2026" + hex.slice(-4);
}

export function Dashboard() {
  const navigate = useNavigate();
  const { stats, loading: statsLoading } = useProtocolStats();
  const { events, loading: eventsLoading } = useActivityFeed(30);

  const navItems = [
    { label: "Registry", onClick: () => navigate("/registry") },
    { label: "Dashboard", onClick: () => navigate("/dashboard") },
    { label: "Auditors", onClick: () => navigate("/auditors") },
    { label: "Developers", onClick: () => navigate("/developers") },
    { label: "Docs", onClick: () => navigate("/docs") },
  ];

  const statCards = [
    { label: "SKILLS LISTED", value: stats.totalSkills, accent: true },
    { label: "AUDITORS", value: stats.totalAuditors },
    { label: "ATTESTATIONS", value: stats.totalAttestations },
    { label: "OPEN DISPUTES", value: stats.openDisputes, warn: stats.openDisputes > 0 },
  ];

  const healthCards = [
    { label: "Unaudited Skills", value: stats.unauditedSkills, total: stats.totalSkills },
    { label: "Open Bounties", value: stats.openBounties, total: stats.totalBounties },
    { label: "Total Disputes", value: stats.totalDisputes },
  ];

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: FONT }}>
      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "0 40px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(9,9,11,0.85)", backdropFilter: "blur(20px)",
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
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {navItems.map(item => (
            <a key={item.label} href="#" style={{
              color: item.label === "Dashboard" ? TEXT : TEXT_DIM,
              textDecoration: item.label === "Dashboard" ? "underline" : "none",
              textUnderlineOffset: "6px",
              textDecorationColor: item.label === "Dashboard" ? ACCENT : "transparent",
              fontSize: 13, fontFamily: FONT,
              fontWeight: item.label === "Dashboard" ? 600 : 400,
              transition: "color 0.2s",
              cursor: item.label === "Dashboard" ? "default" : "pointer",
            }}
              onClick={e => { e.preventDefault(); if (item.label !== "Dashboard" && item.onClick) item.onClick(); }}
              onMouseEnter={e => { if (item.label !== "Dashboard") (e.target as HTMLElement).style.color = TEXT; }}
              onMouseLeave={e => { if (item.label !== "Dashboard") (e.target as HTMLElement).style.color = TEXT_DIM; }}
            >{item.label}</a>
          ))}
          <NavConnectWallet />
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 24px 60px" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontFamily: FONT_HEAD, fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
            Protocol Dashboard
          </h1>
          <p style={{ color: TEXT_DIM, fontSize: 13, marginTop: 8 }}>
            Real-time overview of AEGIS protocol activity on Base L2
          </p>
        </div>

        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 40 }}>
          {statCards.map(card => (
            <div key={card.label} style={{
              background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 24px",
            }}>
              <div style={{ fontSize: 10, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                {card.label}
              </div>
              <div style={{
                fontFamily: FONT_HEAD, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em",
                color: card.accent ? ACCENT : card.warn ? RED : TEXT,
              }}>
                {statsLoading ? "\u2014" : card.value}
              </div>
            </div>
          ))}
        </div>

        {/* Activity Feed */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
              Activity Feed
            </h2>
            <span style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Auto-refreshes every 30s
            </span>
          </div>

          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
            {eventsLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: TEXT_DIM }}>Loading events...</div>
            ) : events.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: TEXT_DIM }}>No events yet</div>
            ) : (
              events.map((ev, i) => {
                const config = EVENT_COLORS[ev.eventName] || { color: TEXT_DIM, label: ev.eventName };
                return (
                  <div key={ev.id} style={{
                    display: "flex", alignItems: "center", gap: 16, padding: "14px 20px",
                    borderBottom: i < events.length - 1 ? `1px solid ${BORDER}` : "none",
                    transition: "background 0.15s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = SURFACE2)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Event badge */}
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: config.color,
                      background: `${config.color}15`, border: `1px solid ${config.color}30`,
                      padding: "3px 8px", borderRadius: 4, textTransform: "uppercase",
                      letterSpacing: "0.04em", minWidth: 72, textAlign: "center",
                    }}>
                      {config.label}
                    </span>

                    {/* Data */}
                    <span style={{ flex: 1, fontSize: 12, color: TEXT, fontFamily: FONT }}>
                      {truncHex(ev.data)}
                    </span>

                    {/* Time */}
                    <span style={{ fontSize: 11, color: TEXT_MUTED, minWidth: 70, textAlign: "right" }}>
                      {formatTimestamp(ev.timestamp)}
                    </span>

                    {/* BaseScan link */}
                    <a
                      href={`https://basescan.org/tx/${ev.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 10, color: ACCENT, textDecoration: "none",
                        opacity: 0.7, transition: "opacity 0.2s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}
                    >
                      BaseScan
                    </a>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Protocol Health */}
        <div>
          <h2 style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 600, margin: "0 0 16px", letterSpacing: "-0.01em" }}>
            Protocol Health
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {healthCards.map(card => (
              <div key={card.label} style={{
                background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 24px",
              }}>
                <div style={{ fontSize: 10, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  {card.label}
                </div>
                <div style={{ fontFamily: FONT_HEAD, fontSize: 24, fontWeight: 700, color: TEXT }}>
                  {statsLoading ? "\u2014" : card.value}
                </div>
                {"total" in card && card.total !== undefined && (
                  <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>
                    of {card.total} total
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
