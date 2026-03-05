import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { NavConnectWallet } from "../components/NavConnectWallet";
import { useAuditorLeaderboard, useProtocolStats } from "../hooks/useSubgraphData";
import { formatEther } from "viem";

// ── Design tokens ────────────────────────────────────────
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

const AMBER = "#FBBF24";
const PURPLE = "#A78BFA";

// ── Tier logic ───────────────────────────────────────────
const TIER_COLORS: Record<string, string> = {
  Bronze: "#CD7F32",
  Silver: "#C0C0C0",
  Gold: AMBER,
  Diamond: PURPLE,
};

const TIER_REQUIREMENTS = [
  { tier: "Bronze", rep: "0 \u2013 9", stake: "\u2265 0.01 ETH", perks: "Eligible for L1 audits" },
  { tier: "Silver", rep: "10 \u2013 24", stake: "\u2265 0.025 ETH", perks: "Eligible for L1 & L2 audits" },
  { tier: "Gold", rep: "25 \u2013 49", stake: "\u2265 0.1 ETH", perks: "Eligible for all levels, priority queue" },
  { tier: "Diamond", rep: "50+", stake: "\u2265 0.5 ETH", perks: "All levels, governance votes, bonus rewards" },
];

function getTier(score: number): string {
  if (score >= 50) return "Diamond";
  if (score >= 25) return "Gold";
  if (score >= 10) return "Silver";
  return "Bronze";
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

function FilterChip({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: active ? `${ACCENT}18` : "transparent",
      border: `1px solid ${active ? ACCENT + "40" : BORDER}`,
      color: active ? ACCENT : TEXT_DIM,
      fontSize: 12, fontWeight: active ? 700 : 400,
      padding: "5px 10px", borderRadius: 6,
      cursor: "pointer", transition: "all 0.12s ease",
      display: "inline-flex", alignItems: "center", gap: 6,
    }}>
      {label}
      {count !== undefined && (
        <span style={{
          fontSize: 10, background: active ? `${ACCENT}30` : SURFACE3,
          padding: "1px 6px", borderRadius: 10,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

const PER_PAGE = 15;

export function Leaderboard() {
  const navigate = useNavigate();
  const { auditors, loading } = useAuditorLeaderboard();
  const { stats } = useProtocolStats();

  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchFocused, setSearchFocused] = useState(false);

  const navItems = [
    { label: "Registry", onClick: () => navigate("/registry") },
    { label: "Dashboard", onClick: () => navigate("/dashboard") },
    { label: "Auditors", onClick: () => navigate("/auditors") },
    { label: "Developers", onClick: () => navigate("/developers") },
    { label: "Docs", onClick: () => navigate("/docs") },
  ];

  const totalStake = auditors.reduce((sum, a) => {
    try { return sum + Number(formatEther(BigInt(a.currentStake))); } catch { return sum; }
  }, 0);

  const avgScore = auditors.length > 0
    ? Math.round(auditors.reduce((sum, a) => sum + Number(a.reputationScore), 0) / auditors.length)
    : 0;

  // Tier counts for filter chips
  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { Bronze: 0, Silver: 0, Gold: 0, Diamond: 0 };
    for (const a of auditors) counts[getTier(Number(a.reputationScore))]++;
    return counts;
  }, [auditors]);

  // Filtered + paginated data
  const filtered = useMemo(() => {
    let data = [...auditors];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(a => a.id.toLowerCase().includes(q));
    }
    if (tierFilter) {
      data = data.filter(a => getTier(Number(a.reputationScore)) === tierFilter);
    }
    return data;
  }, [auditors, search, tierFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageData = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const statCards = [
    { label: "AUDITORS", value: String(stats.totalAuditors) },
    { label: "TOTAL STAKED", value: `${totalStake.toFixed(3)} ETH` },
    { label: "AVG REPUTATION", value: String(avgScore) },
    { label: "ACTIVE DISPUTES", value: String(stats.openDisputes) },
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
              color: TEXT_DIM, textDecoration: "none",
              fontSize: 13, fontWeight: 400,
              transition: "color 0.2s", cursor: "pointer",
            }}
              onClick={e => { e.preventDefault(); item.onClick(); }}
              onMouseEnter={e => (e.target as HTMLElement).style.color = TEXT}
              onMouseLeave={e => (e.target as HTMLElement).style.color = TEXT_DIM}
            >{item.label}</a>
          ))}
          <NavConnectWallet />
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 24px 60px" }}>
        {/* Header */}
        <div style={{ marginBottom: 40, animation: "fadeInUp 0.5s ease 0s both" }}>
          <h1 style={{ fontFamily: FONT_HEAD, fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
            Auditor Leaderboard
          </h1>
          <p style={{ color: TEXT_DIM, fontSize: 13, marginTop: 8 }}>
            Ranked by on-chain reputation score — updated every 30s
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
              <div style={{ fontFamily: FONT_HEAD, fontSize: 24, fontWeight: 700, color: TEXT }}>
                {card.value}
              </div>
            </div>
          ))}
        </div>

        {/* Search Bar */}
        <div style={{ maxWidth: 680, marginBottom: 16, animation: "fadeInUp 0.5s ease 0.1s both" }}>
          <div style={{
            display: "flex", alignItems: "center",
            background: searchFocused ? SURFACE2 : SURFACE,
            border: `1px solid ${searchFocused ? ACCENT + "60" : BORDER}`,
            borderRadius: 10, padding: "0 16px",
            transition: "all 0.15s ease",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={searchFocused ? ACCENT : TEXT_MUTED} strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search by auditor commitment..."
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                fontSize: 14, color: TEXT, padding: "14px 12px",
              }}
            />
          </div>
        </div>

        {/* Tier Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, animation: "fadeInUp 0.5s ease 0.12s both" }}>
          <span style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 4 }}>
            Tier
          </span>
          <FilterChip label="All" count={auditors.length} active={!tierFilter} onClick={() => { setTierFilter(null); setPage(1); }} />
          {(["Bronze", "Silver", "Gold", "Diamond"] as const).map(t => (
            <FilterChip
              key={t}
              label={t}
              count={tierCounts[t]}
              active={tierFilter === t}
              onClick={() => { setTierFilter(tierFilter === t ? null : t); setPage(1); }}
            />
          ))}
        </div>

        {/* Leaderboard Table */}
        <div style={{ marginBottom: 48, animation: "fadeInUp 0.5s ease 0.15s both" }}>
          <div style={{
            background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden",
          }}>
            {/* Header row */}
            <div style={{
              display: "grid", gridTemplateColumns: "50px 1fr 100px 110px 90px 100px",
              padding: "12px 20px", borderBottom: `1px solid ${BORDER}`,
              fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              <span>#</span>
              <span>Auditor</span>
              <span>Tier</span>
              <span>Stake</span>
              <span>Attests</span>
              <span style={{ textAlign: "right" }}>Rep Score</span>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: TEXT_DIM }}>Loading auditors...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: TEXT_DIM }}>
                {auditors.length === 0 ? (
                  <>No auditors registered yet. Be the first to{" "}
                    <a href="#/app" style={{ color: ACCENT, textDecoration: "none" }}>register as an auditor</a>.
                  </>
                ) : (
                  <>No auditors match your search.</>
                )}
              </div>
            ) : (
              pageData.map((auditor, i) => {
                const globalRank = (currentPage - 1) * PER_PAGE + i + 1;
                const score = Number(auditor.reputationScore);
                const tier = getTier(score);
                // Use global rank for medal colors (only if not filtered)
                const medalRank = !search && !tierFilter ? globalRank : null;
                return (
                  <div key={auditor.id} style={{
                    display: "grid", gridTemplateColumns: "50px 1fr 100px 110px 90px 100px",
                    padding: "14px 20px", alignItems: "center",
                    borderBottom: i < pageData.length - 1 ? `1px solid ${BORDER}` : "none",
                    transition: "background 0.15s",
                    cursor: "pointer",
                    animation: `fadeInUp 0.4s ease ${i * 0.03}s both`,
                  }}
                    onClick={() => navigate(`/auditor/${auditor.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = SURFACE2)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{
                      fontFamily: FONT_HEAD, fontSize: 14, fontWeight: 700,
                      color: medalRank === 1 ? AMBER : medalRank === 2 ? "#C0C0C0" : medalRank === 3 ? "#CD7F32" : TEXT_DIM,
                    }}>
                      {globalRank}
                    </span>
                    <span style={{ fontSize: 13, fontFamily: FONT, color: TEXT }}>
                      {truncHex(auditor.id)}
                    </span>
                    <span><TierBadge tier={tier} /></span>
                    <span style={{ fontSize: 12, color: TEXT }}>{formatStake(auditor.currentStake)} ETH</span>
                    <span style={{ fontSize: 12, color: TEXT }}>{auditor.attestationCount}</span>
                    <span style={{
                      textAlign: "right", fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 700,
                      color: score >= 50 ? PURPLE : score >= 25 ? AMBER : score >= 10 ? "#C0C0C0" : TEXT,
                    }}>
                      {score}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: "flex", justifyContent: "center", alignItems: "center", gap: 4, marginTop: 20,
            }}>
              <button
                disabled={currentPage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{
                  width: 32, height: 32, borderRadius: 6, fontSize: 14,
                  background: "transparent", border: "none", color: currentPage <= 1 ? TEXT_MUTED : TEXT,
                  cursor: currentPage <= 1 ? "default" : "pointer",
                  opacity: currentPage <= 1 ? 0.4 : 1, transition: "all 0.12s",
                }}
              >
                &lsaquo;
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)} style={{
                  width: 32, height: 32, borderRadius: 6, fontSize: 12, fontWeight: p === currentPage ? 700 : 400,
                  background: p === currentPage ? `${ACCENT}20` : "transparent",
                  border: p === currentPage ? `1px solid ${ACCENT}40` : "1px solid transparent",
                  color: p === currentPage ? ACCENT : TEXT_DIM,
                  cursor: "pointer", transition: "all 0.12s",
                }}>
                  {p}
                </button>
              ))}
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                style={{
                  width: 32, height: 32, borderRadius: 6, fontSize: 14,
                  background: "transparent", border: "none", color: currentPage >= totalPages ? TEXT_MUTED : TEXT,
                  cursor: currentPage >= totalPages ? "default" : "pointer",
                  opacity: currentPage >= totalPages ? 0.4 : 1, transition: "all 0.12s",
                }}
              >
                &rsaquo;
              </button>
            </div>
          )}
        </div>

        {/* Tier Requirements */}
        <div style={{ animation: "fadeInUp 0.5s ease 0.2s both" }}>
          <h2 style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 600, margin: "0 0 16px", letterSpacing: "-0.01em" }}>
            Tier Requirements
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {TIER_REQUIREMENTS.map(t => {
              const color = TIER_COLORS[t.tier];
              return (
                <div key={t.tier} style={{
                  background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 24px",
                  borderTop: `3px solid ${color}`,
                }}>
                  <div style={{
                    fontFamily: FONT_HEAD, fontSize: 14, fontWeight: 700, color,
                    marginBottom: 12, display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                    {t.tier}
                  </div>
                  <div style={{ fontSize: 11, color: TEXT_DIM, marginBottom: 6 }}>
                    Reputation: <span style={{ color: TEXT }}>{t.rep}</span>
                  </div>
                  <div style={{ fontSize: 11, color: TEXT_DIM, marginBottom: 6 }}>
                    Min Stake: <span style={{ color: TEXT }}>{t.stake}</span>
                  </div>
                  <div style={{ fontSize: 11, color: TEXT_DIM }}>
                    {t.perks}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
