import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { NavConnectWallet } from "../components/NavConnectWallet";
import { useAuditorProfile } from "../hooks/useSubgraphData";
import { formatEther } from "viem";

// ── Design tokens ────────────────────────────────────────
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
const AMBER = "#FBBF24";
const RED = "#F87171";
const PURPLE = "#A78BFA";

// ── Tier logic (A4: min-stake gating) ────────────────────
const TIER_COLORS: Record<string, string> = {
  Bronze: "#CD7F32",
  Silver: "#C0C0C0",
  Gold: AMBER,
  Diamond: PURPLE,
};

const TIER_CONFIG = [
  { tier: "Diamond", minScore: 50, minStakeEth: 0.5 },
  { tier: "Gold",    minScore: 25, minStakeEth: 0.1 },
  { tier: "Silver",  minScore: 10, minStakeEth: 0.025 },
  { tier: "Bronze",  minScore: 0,  minStakeEth: 0.01 },
];

const TIER_THRESHOLDS = TIER_CONFIG.map(t => ({ tier: t.tier, min: t.minScore }));

function getTier(score: number, stakeEth: number = Infinity): string {
  for (const t of TIER_CONFIG) {
    if (score >= t.minScore && stakeEth >= t.minStakeEth) return t.tier;
  }
  return "Bronze";
}

function getStakeCap(score: number, stakeEth: number): { capped: boolean; requiredStake: number; uncappedTier: string } | null {
  const uncappedTier = getTier(score);
  const actualTier = getTier(score, stakeEth);
  if (uncappedTier === actualTier) return null;
  const uncapped = TIER_CONFIG.find(t => t.tier === uncappedTier);
  return { capped: true, requiredStake: uncapped?.minStakeEth ?? 0, uncappedTier };
}

function truncHex(hex: string): string {
  if (hex.length < 12) return hex;
  return hex.slice(0, 6) + "\u2026" + hex.slice(-4);
}

function formatStake(weiStr: string): string {
  try {
    const eth = Number(formatEther(BigInt(weiStr)));
    return eth >= 0.01 ? eth.toFixed(3) : eth.toFixed(4);
  } catch {
    return "0";
  }
}

function formatDate(ts: string): string {
  return new Date(Number(ts) * 1000).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function TierBadge({ tier }: { tier: string }) {
  const color = TIER_COLORS[tier] || TEXT_DIM;
  return (
    <span style={{
      fontFamily: FONT, fontSize: 10, fontWeight: 700,
      color, background: `${color}18`, border: `1px solid ${color}30`,
      padding: "3px 10px", borderRadius: 4,
      textTransform: "uppercase", letterSpacing: "0.04em",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
      {tier}
    </span>
  );
}

function LevelDots({ level }: { level: number }) {
  const LEVEL_COLORS = [TEXT_DIM, ACCENT, ACCENT];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      {[1, 2, 3].map(l => (
        <div key={l} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: l <= level ? LEVEL_COLORS[l - 1] : SURFACE2,
          border: l <= level ? "none" : `1px solid ${BORDER}`,
        }} />
      ))}
      <span style={{ fontSize: 11, color: TEXT_DIM, marginLeft: 4 }}>L{level}</span>
    </div>
  );
}

export function AuditorProfile() {
  const navigate = useNavigate();
  const { commitment } = useParams<{ commitment: string }>();
  const { auditor, attestations, disputes, loading } = useAuditorProfile(commitment || "");
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredDisputeRow, setHoveredDisputeRow] = useState<number | null>(null);

  const navItems = [
    { label: "DApp", onClick: () => navigate("/app") },
    { label: "Registry", onClick: () => navigate("/registry") },
    { label: "Dashboard", onClick: () => navigate("/dashboard") },
    { label: "Bounties", onClick: () => navigate("/bounties") },
    { label: "Auditors", onClick: () => navigate("/auditors") },
    { label: "Developers", onClick: () => navigate("/developers") },
    { label: "Docs", onClick: () => navigate("/docs") },
    { label: "Updates", onClick: () => navigate("/updates") },
  ];

  const score = auditor ? Number(auditor.reputationScore) : 0;
  const stakeEth = auditor ? Number(formatEther(BigInt(auditor.currentStake))) : 0;
  const tier = getTier(score, stakeEth);
  const tierColor = TIER_COLORS[tier] || TEXT_DIM;
  const stakeCap = auditor ? getStakeCap(score, stakeEth) : null;

  // Tier progress
  const currentIdx = TIER_THRESHOLDS.findIndex(t => t.tier === tier);
  const nextTier = TIER_THRESHOLDS[currentIdx + 1];
  const prevMin = TIER_THRESHOLDS[currentIdx]?.min ?? 0;
  const progress = nextTier ? Math.min(1, (score - prevMin) / (nextTier.min - prevMin)) : 1;
  const remaining = nextTier ? nextTier.min - score : 0;

  // Reputation breakdown (A4)
  const l1Count = auditor ? auditor.attestationCount - (auditor.l2AttestationCount || 0) - (auditor.l3AttestationCount || 0) : 0;
  const l2Count = auditor?.l2AttestationCount || 0;
  const l3Count = auditor?.l3AttestationCount || 0;
  const attPts = auditor ? auditor.attestationCount * 10 : 0;
  const lvlPts = (l2Count * 5) + (l3Count * 15);
  const stakePts = stakeEth <= 0.1 ? Math.floor(stakeEth / 0.01) : 10 + Math.floor((stakeEth - 0.1) / 0.05);
  const registeredTs = auditor ? Number(auditor.timestamp) : 0;
  const now = Math.floor(Date.now() / 1000);
  const tenureDays = registeredTs ? Math.floor((now - registeredTs) / 86400) : 0;
  const tenurePts = Math.min(12, Math.floor(tenureDays / 30));
  const disputePts = auditor ? auditor.disputesLost * 20 : 0;
  const disputesWon = auditor ? (auditor.disputesInvolved - auditor.disputesLost) : 0;
  const winRate = auditor && auditor.disputesInvolved > 0
    ? `${(disputesWon / auditor.disputesInvolved * 100).toFixed(0)}%`
    : "N/A";
  const winRateMul = auditor && auditor.disputesInvolved > 0
    ? (0.5 + (disputesWon / auditor.disputesInvolved) * 0.6).toFixed(2)
    : "1.00";
  const lastAttTs = auditor?.lastAttestationAt ? Number(auditor.lastAttestationAt) : 0;
  const daysSinceAtt = lastAttTs ? Math.floor((now - lastAttTs) / 86400) : 0;
  const decayMul = (!lastAttTs || daysSinceAtt <= 90)
    ? "1.00"
    : daysSinceAtt >= 365
      ? "0.50"
      : (1.0 - ((daysSinceAtt - 90) / 275) * 0.5).toFixed(2);

  const statCards = auditor ? [
    { label: "CURRENT STAKE", value: `${formatStake(auditor.currentStake)} ETH` },
    { label: "INITIAL STAKE", value: `${formatStake(auditor.initialStake)} ETH` },
    { label: "REPUTATION", value: String(score), color: tierColor },
    { label: "ATTESTATIONS", value: String(auditor.attestationCount) },
    { label: "DISPUTES", value: `${auditor.disputesInvolved - auditor.disputesLost}W / ${auditor.disputesLost}L` },
  ] : [];

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
          }}>AUDITOR</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {navItems.map(item => (
            <a key={item.label} href="#" style={{
              color: item.label === "Auditors" ? TEXT : TEXT_DIM,
              textDecoration: "none",
              fontSize: 13, fontWeight: item.label === "Auditors" ? 700 : 400,
              borderBottom: item.label === "Auditors" ? `2px solid ${ACCENT}` : "2px solid transparent",
              paddingBottom: 2,
              transition: "color 0.15s", cursor: item.label === "Auditors" ? "default" : "pointer",
            }}
              onClick={e => { e.preventDefault(); if (item.label !== "Auditors") item.onClick(); }}
              onMouseEnter={e => { if (item.label !== "Auditors") (e.target as HTMLElement).style.color = TEXT; }}
              onMouseLeave={e => { if (item.label !== "Auditors") (e.target as HTMLElement).style.color = TEXT_DIM; }}
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

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 24px 60px" }}>

        {/* Back link */}
        <div style={{ marginBottom: 24, animation: "fadeInUp 0.5s ease 0s both" }}>
          <span
            onClick={() => navigate("/auditors")}
            style={{ fontSize: 12, color: ACCENT, cursor: "pointer", transition: "opacity 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            &larr; Back to Auditors
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 80, textAlign: "center", color: TEXT_DIM, fontSize: 14 }}>
            Loading auditor profile...
          </div>
        ) : !auditor ? (
          <div style={{ padding: 80, textAlign: "center" }}>
            <div style={{ fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 12 }}>
              Auditor Not Found
            </div>
            <div style={{ fontSize: 13, color: TEXT_DIM }}>
              No auditor registered with commitment {truncHex(commitment || "")}
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ marginBottom: 40, animation: "fadeInUp 0.5s ease 0.05s both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
                <h1 style={{ fontFamily: FONT_HEAD, fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
                  Auditor Profile
                </h1>
                <TierBadge tier={tier} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 13, color: TEXT, fontFamily: FONT }}>
                  {commitment && commitment.length > 20
                    ? `${commitment.slice(0, 10)}...${commitment.slice(-8)}`
                    : commitment}
                </span>
                <a
                  href={`https://basescan.org/tx/${auditor.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 10, color: ACCENT, textDecoration: "none", opacity: 0.8 }}
                >
                  BaseScan &rarr;
                </a>
                <span style={{ fontSize: 11, color: TEXT_MUTED }}>
                  Registered {formatDate(auditor.timestamp)}
                </span>
              </div>
            </div>

            {/* Stat Cards */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 40,
              animation: "fadeInUp 0.5s ease 0.1s both",
            }}>
              {statCards.map(card => (
                <div key={card.label} style={{
                  background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 24px",
                }}>
                  <div style={{ fontSize: 10, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    {card.label}
                  </div>
                  <div style={{
                    fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em",
                    color: card.color || TEXT,
                  }}>
                    {card.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Tier Progress */}
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 24px",
              marginBottom: 40, animation: "fadeInUp 0.5s ease 0.15s both",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h2 style={{ fontFamily: FONT_HEAD, fontSize: 14, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
                  Tier Progress
                </h2>
                {nextTier ? (
                  <span style={{ fontSize: 11, color: TEXT_DIM }}>
                    {remaining} point{remaining !== 1 ? "s" : ""} to{" "}
                    <span style={{ color: TIER_COLORS[nextTier.tier], fontWeight: 700 }}>{nextTier.tier}</span>
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: PURPLE, fontWeight: 700 }}>Max tier reached</span>
                )}
              </div>
              <div style={{
                height: 8, borderRadius: 4, background: SURFACE2, overflow: "hidden", position: "relative",
              }}>
                <div style={{
                  height: "100%", borderRadius: 4,
                  background: `linear-gradient(90deg, ${tierColor}, ${nextTier ? TIER_COLORS[nextTier.tier] : tierColor})`,
                  width: `${progress * 100}%`, transition: "width 0.6s ease",
                  minWidth: progress > 0 ? 4 : 0,
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                {TIER_THRESHOLDS.map(t => (
                  <span key={t.tier} style={{
                    fontSize: 9, color: tier === t.tier ? TIER_COLORS[t.tier] : TEXT_MUTED,
                    fontWeight: tier === t.tier ? 700 : 400,
                  }}>
                    {t.tier} ({t.min})
                  </span>
                ))}
              </div>
            </div>

            {/* Stake Cap Warning */}
            {stakeCap && (
              <div style={{
                background: `${AMBER}10`, border: `1px solid ${AMBER}30`, borderRadius: 10,
                padding: "14px 20px", marginBottom: 24, animation: "fadeInUp 0.5s ease 0.16s both",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span style={{ fontSize: 16 }}>&#9888;</span>
                <span style={{ fontSize: 12, color: AMBER }}>
                  Score qualifies for <strong>{stakeCap.uncappedTier}</strong> but tier is capped by stake.
                  Increase stake to {stakeCap.requiredStake} ETH to unlock.
                </span>
              </div>
            )}

            {/* Reputation Breakdown (A4) */}
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 24px",
              marginBottom: 40, animation: "fadeInUp 0.5s ease 0.17s both",
            }}>
              <h2 style={{ fontFamily: FONT_HEAD, fontSize: 14, fontWeight: 600, margin: "0 0 16px", letterSpacing: "-0.01em" }}>
                Score Breakdown
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 40px", fontFamily: FONT, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: TEXT_DIM }}>
                  <span>Attestations ({auditor?.attestationCount || 0} &times; 10)</span>
                  <span style={{ color: GREEN }}>+{attPts}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: TEXT_DIM }}>
                  <span>Level Bonus ({l2Count} L2, {l3Count} L3)</span>
                  <span style={{ color: lvlPts > 0 ? GREEN : TEXT_MUTED }}>+{lvlPts}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: TEXT_DIM }}>
                  <span>Stake Bonus ({stakeEth.toFixed(3)} ETH)</span>
                  <span style={{ color: stakePts > 0 ? GREEN : TEXT_MUTED }}>+{stakePts}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: TEXT_DIM }}>
                  <span>Tenure ({tenureDays}d, cap 12)</span>
                  <span style={{ color: tenurePts > 0 ? GREEN : TEXT_MUTED }}>+{tenurePts}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: TEXT_DIM }}>
                  <span>Disputes Lost ({auditor?.disputesLost || 0} &times; 20)</span>
                  <span style={{ color: disputePts > 0 ? RED : TEXT_MUTED }}>{disputePts > 0 ? `-${disputePts}` : "0"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: TEXT_DIM }}>
                  <span>Win Rate ({winRate})</span>
                  <span style={{ color: TEXT }}>&times;{winRateMul}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: TEXT_DIM }}>
                  <span>Activity Decay ({daysSinceAtt}d ago)</span>
                  <span style={{ color: decayMul === "1.00" ? TEXT : AMBER }}>&times;{decayMul}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${BORDER}`, paddingTop: 8, marginTop: 4 }}>
                  <span style={{ color: TEXT, fontWeight: 700 }}>Final Score</span>
                  <span style={{ color: tierColor, fontWeight: 700 }}>{score}</span>
                </div>
              </div>
            </div>

            {/* Attestation History */}
            <div style={{ marginBottom: 40, animation: "fadeInUp 0.5s ease 0.2s both" }}>
              <h2 style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 600, margin: "0 0 16px", letterSpacing: "-0.01em" }}>
                Attestation History
              </h2>
              <div style={{
                background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden",
              }}>
                {/* Header */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 120px 80px 90px 100px 80px",
                  padding: "12px 20px", borderBottom: `1px solid ${BORDER}`,
                  fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  <span>Skill</span>
                  <span>Category</span>
                  <span>Level</span>
                  <span>Status</span>
                  <span>Date</span>
                  <span style={{ textAlign: "right" }}>Tx</span>
                </div>

                {attestations.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: TEXT_DIM, fontSize: 12 }}>
                    No attestations yet
                  </div>
                ) : (
                  attestations.map((att, i) => (
                    <div key={att.id} style={{
                      display: "grid", gridTemplateColumns: "1fr 120px 80px 90px 100px 80px",
                      padding: "14px 20px", alignItems: "center",
                      borderBottom: i < attestations.length - 1 ? `1px solid ${BORDER}` : "none",
                      background: hoveredRow === i ? SURFACE2 : "transparent",
                      transition: "background 0.15s",
                      animation: `fadeInUp 0.4s ease ${i * 0.03}s both`,
                    }}
                      onMouseEnter={() => setHoveredRow(i)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <span style={{ fontSize: 12, color: TEXT, fontWeight: 600 }}>
                        {att.skill.skillName !== "Unknown Skill" ? att.skill.skillName : truncHex(att.skill.id)}
                      </span>
                      <span style={{ fontSize: 11, color: TEXT_DIM }}>
                        {att.skill.category !== "Uncategorized" ? att.skill.category : "\u2014"}
                      </span>
                      <LevelDots level={att.auditLevel} />
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                        color: att.revoked ? RED : GREEN,
                        background: att.revoked ? `${RED}15` : `${GREEN}15`,
                        padding: "2px 8px", borderRadius: 4, width: "fit-content",
                      }}>
                        {att.revoked ? "Revoked" : "Active"}
                      </span>
                      <span style={{ fontSize: 11, color: TEXT_DIM }}>
                        {formatDate(att.timestamp)}
                      </span>
                      <a
                        href={`https://basescan.org/tx/${att.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 10, color: ACCENT, textDecoration: "none", textAlign: "right",
                          opacity: 0.7, transition: "opacity 0.2s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}
                      >
                        BaseScan
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Dispute Summary */}
            <div style={{ animation: "fadeInUp 0.5s ease 0.25s both" }}>
              <h2 style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 600, margin: "0 0 16px", letterSpacing: "-0.01em" }}>
                Dispute Record
              </h2>
              <div style={{
                background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "24px",
                display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24,
              }}>
                <div>
                  <div style={{ fontSize: 10, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    Total Disputes
                  </div>
                  <div style={{ fontFamily: FONT_HEAD, fontSize: 24, fontWeight: 700, color: TEXT }}>
                    {auditor.disputesInvolved}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    Won (Not at Fault)
                  </div>
                  <div style={{ fontFamily: FONT_HEAD, fontSize: 24, fontWeight: 700, color: GREEN }}>
                    {auditor.disputesInvolved - auditor.disputesLost}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    Lost (Slashed)
                  </div>
                  <div style={{ fontFamily: FONT_HEAD, fontSize: 24, fontWeight: 700, color: auditor.disputesLost > 0 ? RED : TEXT }}>
                    {auditor.disputesLost}
                  </div>
                </div>
              </div>
            </div>

            {/* Dispute History Table */}
            <div style={{ marginTop: 40, animation: "fadeInUp 0.5s ease 0.3s both" }}>
              <h2 style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 600, margin: "0 0 16px", letterSpacing: "-0.01em" }}>
                Dispute History
              </h2>
              <div style={{
                background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden",
              }}>
                {/* Header */}
                <div style={{
                  display: "grid", gridTemplateColumns: "60px 1fr 120px 90px 80px 100px 80px",
                  padding: "12px 20px", borderBottom: `1px solid ${BORDER}`,
                  fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  <span>#</span>
                  <span>Skill</span>
                  <span>Challenger</span>
                  <span>Bond</span>
                  <span>Outcome</span>
                  <span>Date</span>
                  <span style={{ textAlign: "right" }}>Tx</span>
                </div>

                {disputes.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: TEXT_DIM, fontSize: 12 }}>
                    No disputes on record
                  </div>
                ) : (
                  disputes.map((d, i) => {
                    const outcome = !d.resolved
                      ? { label: "OPEN", color: AMBER }
                      : d.auditorFault
                        ? { label: "LOST", color: RED }
                        : { label: "WON", color: GREEN };
                    return (
                      <div key={d.id} style={{
                        display: "grid", gridTemplateColumns: "60px 1fr 120px 90px 80px 100px 80px",
                        padding: "14px 20px", alignItems: "center",
                        borderBottom: i < disputes.length - 1 ? `1px solid ${BORDER}` : "none",
                        background: hoveredDisputeRow === i ? SURFACE2 : "transparent",
                        transition: "background 0.15s",
                        animation: `fadeInUp 0.4s ease ${i * 0.03}s both`,
                      }}
                        onMouseEnter={() => setHoveredDisputeRow(i)}
                        onMouseLeave={() => setHoveredDisputeRow(null)}
                      >
                        <span style={{ fontSize: 11, color: TEXT_DIM, fontFamily: FONT }}>
                          {d.disputeId}
                        </span>
                        <span style={{ fontSize: 12, color: TEXT, fontWeight: 600 }}>
                          {d.skillName !== "Unknown Skill" ? d.skillName : truncHex(d.skillId)}
                        </span>
                        <span style={{ fontSize: 11, color: TEXT_DIM, fontFamily: FONT }}>
                          {truncHex(d.challenger)}
                        </span>
                        <span style={{ fontSize: 11, color: TEXT_DIM, fontFamily: FONT }}>
                          {formatStake(d.bond)} ETH
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                          color: outcome.color,
                          background: `${outcome.color}15`,
                          padding: "2px 8px", borderRadius: 4, width: "fit-content",
                        }}>
                          {outcome.label}
                        </span>
                        <span style={{ fontSize: 11, color: TEXT_DIM }}>
                          {formatDate(d.openedAt)}
                        </span>
                        <a
                          href={`https://basescan.org/tx/${d.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 10, color: ACCENT, textDecoration: "none", textAlign: "right",
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
          </>
        )}
      </div>
    </div>
  );
}
