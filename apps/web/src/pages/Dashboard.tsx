import { useNavigate } from "react-router-dom";
import { NavConnectWallet } from "../components/NavConnectWallet";
import { useProtocolStats, useActivityFeed, useAuditorLeaderboard, useAttestationLevels, useSkillNames } from "../hooks/useSubgraphData";
import { formatEther } from "viem";

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

// ── Tier logic ───────────────────────────────────────────
const TIER_COLORS: Record<string, string> = {
  Bronze: "#CD7F32",
  Silver: "#C0C0C0",
  Gold: AMBER,
  Diamond: PURPLE,
};

function getTier(score: number): string {
  if (score >= 50) return "Diamond";
  if (score >= 25) return "Gold";
  if (score >= 10) return "Silver";
  return "Bronze";
}

function formatStake(weiStr: string): string {
  try {
    const eth = Number(formatEther(BigInt(weiStr)));
    return eth >= 0.01 ? eth.toFixed(3) : eth.toFixed(4);
  } catch {
    return "0";
  }
}

export function Dashboard() {
  const navigate = useNavigate();
  const { stats, loading: statsLoading } = useProtocolStats();
  const { events, loading: eventsLoading } = useActivityFeed(30);
  const { auditors, loading: auditorsLoading } = useAuditorLeaderboard();
  const { counts: levelCounts, loading: levelsLoading } = useAttestationLevels();
  const { skills: skillNameMap } = useSkillNames();

  const topAuditors = auditors.slice(0, 5);
  const totalLevelCount = levelCounts.l1 + levelCounts.l2 + levelCounts.l3;

  const navItems = [
    { label: "DApp", onClick: () => navigate("/app") },
    { label: "Registry", onClick: () => navigate("/registry") },
    { label: "Dashboard", onClick: () => navigate("/dashboard") },
    { label: "Bounties", onClick: () => navigate("/bounties") },
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
    <div style={{ minHeight: "100vh", background: BG, color: TEXT }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "0 40px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(9,9,11,0.85)", backdropFilter: "blur(20px)",
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
          }}>DASHBOARD</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {navItems.map(item => (
            <a key={item.label} href="#" style={{
              color: item.label === "Dashboard" ? TEXT : TEXT_DIM,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: item.label === "Dashboard" ? 700 : 400,
              borderBottom: item.label === "Dashboard" ? `2px solid ${ACCENT}` : "2px solid transparent",
              paddingBottom: 2,
              transition: "color 0.15s",
              cursor: item.label === "Dashboard" ? "default" : "pointer",
            }}
              onClick={e => { e.preventDefault(); if (item.label !== "Dashboard" && item.onClick) item.onClick(); }}
              onMouseEnter={e => { if (item.label !== "Dashboard") (e.target as HTMLElement).style.color = TEXT; }}
              onMouseLeave={e => { if (item.label !== "Dashboard") (e.target as HTMLElement).style.color = TEXT_DIM; }}
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
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 24px 60px" }}>
        {/* Header */}
        <div style={{ marginBottom: 40, animation: "fadeInUp 0.5s ease 0s both" }}>
          <h1 style={{ fontFamily: FONT_HEAD, fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
            Protocol Dashboard
          </h1>
          <p style={{ color: TEXT_DIM, fontSize: 13, marginTop: 8 }}>
            Real-time overview of AEGIS protocol activity on Base L2
          </p>
        </div>

        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 40, animation: "fadeInUp 0.5s ease 0.05s both" }}>
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

        {/* Audit Level Distribution */}
        <div style={{ marginBottom: 40, animation: "fadeInUp 0.5s ease 0.1s both" }}>
          <h2 style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 600, margin: "0 0 16px", letterSpacing: "-0.01em" }}>
            Audit Level Distribution
          </h2>
          <div style={{
            background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 24px",
          }}>
            {levelsLoading || totalLevelCount === 0 ? (
              <div style={{ color: TEXT_DIM, fontSize: 12 }}>
                {levelsLoading ? "Loading..." : "No attestations yet"}
              </div>
            ) : (
              <>
                <div style={{
                  display: "flex", gap: 2, borderRadius: 4, overflow: "hidden", height: 8, marginBottom: 16,
                }}>
                  <div style={{ flex: levelCounts.l1, background: TEXT_DIM, minWidth: levelCounts.l1 > 0 ? 4 : 0, transition: "flex 0.4s ease" }} />
                  <div style={{ flex: levelCounts.l2, background: ACCENT2, minWidth: levelCounts.l2 > 0 ? 4 : 0, transition: "flex 0.4s ease" }} />
                  <div style={{ flex: levelCounts.l3, background: ACCENT, minWidth: levelCounts.l3 > 0 ? 4 : 0, transition: "flex 0.4s ease" }} />
                </div>
                <div style={{ display: "flex", gap: 24 }}>
                  {[
                    { label: "L1 Functional", count: levelCounts.l1, color: TEXT_DIM },
                    { label: "L2 Robust", count: levelCounts.l2, color: ACCENT2 },
                    { label: "L3 Security", count: levelCounts.l3, color: ACCENT },
                  ].map(item => (
                    <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
                      <span style={{ fontSize: 11, color: TEXT_DIM }}>{item.label}</span>
                      <span style={{ fontSize: 12, fontFamily: FONT_HEAD, fontWeight: 700, color: TEXT }}>
                        {item.count}
                      </span>
                      <span style={{ fontSize: 10, color: TEXT_MUTED }}>
                        ({Math.round((item.count / totalLevelCount) * 100)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Top Auditors */}
        <div style={{ marginBottom: 40, animation: "fadeInUp 0.5s ease 0.15s both" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
              Top Auditors
            </h2>
            <span
              onClick={() => navigate("/auditors")}
              style={{ fontSize: 11, color: ACCENT, cursor: "pointer", letterSpacing: "0.02em" }}
            >
              View All &rarr;
            </span>
          </div>
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "40px 1fr 90px 100px 80px",
              padding: "10px 20px", borderBottom: `1px solid ${BORDER}`,
              fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              <span>#</span><span>Auditor</span><span>Tier</span><span>Stake</span>
              <span style={{ textAlign: "right" }}>Rep</span>
            </div>
            {auditorsLoading ? (
              <div style={{ padding: 30, textAlign: "center", color: TEXT_DIM }}>Loading...</div>
            ) : topAuditors.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: TEXT_DIM }}>No auditors registered yet</div>
            ) : (
              topAuditors.map((a, i) => {
                const score = Number(a.reputationScore);
                const tier = getTier(score);
                const color = TIER_COLORS[tier];
                return (
                  <div key={a.id} style={{
                    display: "grid", gridTemplateColumns: "40px 1fr 90px 100px 80px",
                    padding: "12px 20px", alignItems: "center",
                    borderBottom: i < topAuditors.length - 1 ? `1px solid ${BORDER}` : "none",
                    transition: "background 0.15s", cursor: "pointer",
                  }}
                    onClick={() => navigate(`/auditor/${a.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = SURFACE2)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{
                      fontFamily: FONT_HEAD, fontSize: 13, fontWeight: 700,
                      color: i === 0 ? AMBER : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : TEXT_DIM,
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 12, color: TEXT, fontFamily: FONT }}>{truncHex(a.id)}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, color, background: `${color}18`,
                      border: `1px solid ${color}30`, padding: "2px 8px", borderRadius: 4,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                      display: "inline-flex", alignItems: "center", gap: 4, width: "fit-content",
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
                      {tier}
                    </span>
                    <span style={{ fontSize: 12, color: TEXT, fontFamily: FONT }}>{formatStake(a.currentStake)} ETH</span>
                    <span style={{
                      textAlign: "right", fontFamily: FONT_HEAD, fontSize: 14, fontWeight: 700,
                      color: score >= 50 ? PURPLE : score >= 25 ? AMBER : score >= 10 ? "#C0C0C0" : TEXT,
                    }}>
                      {score}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div style={{ marginBottom: 40, animation: "fadeInUp 0.5s ease 0.2s both" }}>
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
                const isSkillEvent = ["SkillListed", "SkillRegistered", "BountyPosted", "BountyClaimed", "BountyReclaimed", "AttestationRevoked"].includes(ev.eventName);
                const isAuditorEvent = ["AuditorRegistered", "StakeAdded", "UnstakeInitiated", "UnstakeCompleted", "UnstakeCancelled"].includes(ev.eventName);
                const isClickable = isSkillEvent || isAuditorEvent;
                const handleEventClick = () => {
                  if (isSkillEvent) navigate("/registry");
                  else if (isAuditorEvent) navigate(`/auditor/${ev.data}`);
                };
                return (
                  <div key={ev.id} style={{
                    display: "flex", alignItems: "center", gap: 16, padding: "14px 20px",
                    borderBottom: i < events.length - 1 ? `1px solid ${BORDER}` : "none",
                    transition: "background 0.15s",
                    cursor: isClickable ? "pointer" : "default",
                  }}
                    onClick={isClickable ? handleEventClick : undefined}
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
                    <span style={{ flex: 1, fontSize: 12, color: TEXT }}>
                      {(() => {
                        const resolved = skillNameMap.get(ev.data.toLowerCase());
                        if (resolved?.skillName && resolved.skillName !== "Unknown Skill") {
                          return (
                            <>
                              <span style={{ fontWeight: 600 }}>{resolved.skillName}</span>
                              {resolved.category && (
                                <span style={{ fontSize: 10, color: TEXT_MUTED, marginLeft: 8 }}>{resolved.category}</span>
                              )}
                            </>
                          );
                        }
                        return <span style={{ fontFamily: FONT }}>{truncHex(ev.data)}</span>;
                      })()}
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
                      onClick={e => e.stopPropagation()}
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
        <div style={{ animation: "fadeInUp 0.5s ease 0.25s both" }}>
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
