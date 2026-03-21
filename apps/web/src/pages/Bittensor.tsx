import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTaoSubnets, useTaoMetagraph, useTaoStats, type TaoMiner } from "../hooks/useTaoData";

// ── Design tokens (same as Dashboard/Bounties) ─────────
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

const GREEN = "#4ADE80";
const AMBER = "#FBBF24";
const BLUE = "#60A5FA";
const PURPLE = "#A78BFA";
const TEAL = "#2DD4BF";

function truncHash(h: string) {
  return h.length >= 12 ? `${h.slice(0, 10)}\u2026${h.slice(-6)}` : h;
}

function truncHotkey(h: string) {
  if (h.startsWith("uid:")) return h;
  return h.length >= 12 ? `${h.slice(0, 8)}\u2026${h.slice(-6)}` : h;
}

// ── Stat Card ───────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div style={{
      flex: 1, background: SURFACE, border: `1px solid ${BORDER}`,
      borderRadius: 10, padding: "20px 24px",
    }}>
      <div style={{ fontSize: 11, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: FONT_HEAD, fontSize: 26, fontWeight: 700, color: accent ? ACCENT : TEXT, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

// ── How It Works Step ───────────────────────────────────

function StepCard({ step, title, desc, icon }: { step: number; title: string; desc: string; icon: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, background: hovered ? SURFACE2 : SURFACE,
        border: `1px solid ${hovered ? ACCENT + "40" : BORDER}`,
        borderRadius: 10, padding: "28px 24px",
        transition: "all 0.2s ease", position: "relative",
      }}
    >
      <div style={{
        position: "absolute", top: 12, right: 16,
        fontSize: 48, fontFamily: FONT_HEAD, fontWeight: 800,
        color: ACCENT, opacity: 0.06,
      }}>{step}</div>
      <div style={{ marginBottom: 16, opacity: 0.7 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 8, fontFamily: FONT }}>{title}</div>
      <div style={{ fontSize: 12, color: TEXT_DIM, lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

// ── TAO Criteria Badge ──────────────────────────────────

const TAO_CRITERIA_KEYS = [
  { key: "TAO.RESPONSE", label: "Response", color: GREEN },
  { key: "TAO.UPTIME", label: "Uptime", color: BLUE },
  { key: "TAO.QUALITY", label: "Quality", color: PURPLE },
  { key: "TAO.WEIGHT", label: "Weight", color: AMBER },
  { key: "TAO.LATENCY", label: "Latency", color: TEAL },
  { key: "TAO.INTEGRITY", label: "Integrity", color: ACCENT },
];

// ── Miner Table (expanded subnet) ───────────────────────

function MinerTable({ netuid }: { netuid: number }) {
  const { miners, loading, error } = useTaoMetagraph(netuid);
  const [sortBy, setSortBy] = useState<"stake" | "trust" | "incentive">("stake");

  const sorted = [...miners].sort((a, b) => {
    if (sortBy === "stake") return parseFloat(b.stake || "0") - parseFloat(a.stake || "0");
    if (sortBy === "trust") return b.trust - a.trust;
    return b.incentive - a.incentive;
  });

  const displayed = sorted.slice(0, 25);

  if (loading) {
    return (
      <div style={{ padding: "20px 24px 20px 60px", background: SURFACE2, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 12, color: TEXT_DIM, animation: "pulse 2s infinite" }}>Loading metagraph\u2026</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "20px 24px 20px 60px", background: SURFACE2, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 12, color: ACCENT }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ background: SURFACE2, borderBottom: `1px solid ${BORDER}` }}>
      {/* Sort controls */}
      <div style={{
        padding: "12px 24px 8px 60px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>
          Miners &amp; Validators ({miners.length} nodes)
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["stake", "trust", "incentive"] as const).map(key => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              style={{
                fontSize: 10, fontWeight: sortBy === key ? 700 : 400,
                color: sortBy === key ? TEAL : TEXT_MUTED,
                background: sortBy === key ? TEAL + "12" : "transparent",
                border: `1px solid ${sortBy === key ? TEAL + "30" : "transparent"}`,
                padding: "3px 8px", borderRadius: 4, cursor: "pointer",
                textTransform: "uppercase", letterSpacing: "0.04em",
              }}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* Miner table header */}
      <div style={{
        display: "grid", gridTemplateColumns: "50px 1fr 100px 80px 80px 80px 90px",
        padding: "6px 24px 6px 60px",
        fontSize: 9, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.08em",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div>UID</div>
        <div>Hotkey</div>
        <div style={{ textAlign: "right" }}>Stake</div>
        <div style={{ textAlign: "right" }}>Trust</div>
        <div style={{ textAlign: "right" }}>Consensus</div>
        <div style={{ textAlign: "right" }}>Incentive</div>
        <div style={{ textAlign: "center" }}>Status</div>
      </div>

      {/* Miner rows */}
      {displayed.map((m, i) => (
        <div
          key={m.uid}
          style={{
            display: "grid", gridTemplateColumns: "50px 1fr 100px 80px 80px 80px 90px",
            padding: "8px 24px 8px 60px",
            borderBottom: `1px solid ${BORDER}`,
            fontSize: 12,
            transition: "background 0.1s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = SURFACE3}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <div style={{ color: TEAL, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 11 }}>{m.uid}</div>
          <div style={{
            color: TEXT_DIM, fontFamily: "'SF Mono', 'Cascadia Code', monospace", fontSize: 11,
          }}>{truncHotkey(m.hotkey)}</div>
          <div style={{ textAlign: "right", color: TEXT, fontWeight: 600 }}>
            {formatStake(m.stake)}
          </div>
          <div style={{ textAlign: "right", color: m.trust > 0.5 ? GREEN : TEXT_DIM }}>
            {m.trust.toFixed(3)}
          </div>
          <div style={{ textAlign: "right", color: TEXT_DIM }}>
            {m.consensus.toFixed(3)}
          </div>
          <div style={{ textAlign: "right", color: m.incentive > 0 ? AMBER : TEXT_DIM }}>
            {m.incentive.toFixed(3)}
          </div>
          <div style={{ textAlign: "center" }}>
            {m.audited ? (
              <span style={{
                fontSize: 9, fontWeight: 700, color: GREEN, background: GREEN + "15",
                padding: "2px 6px", borderRadius: 4, textTransform: "uppercase",
              }}>Attested</span>
            ) : m.isValidator ? (
              <span style={{
                fontSize: 9, fontWeight: 700, color: PURPLE, background: PURPLE + "15",
                padding: "2px 6px", borderRadius: 4, textTransform: "uppercase",
              }}>Validator</span>
            ) : (
              <span style={{
                fontSize: 9, fontWeight: 700, color: TEXT_MUTED, background: SURFACE3,
                padding: "2px 6px", borderRadius: 4, textTransform: "uppercase",
              }}>Miner</span>
            )}
          </div>
        </div>
      ))}

      {miners.length > 25 && (
        <div style={{ padding: "10px 24px 10px 60px", fontSize: 11, color: TEXT_MUTED }}>
          Showing 25 of {miners.length} nodes. Sort by stake, trust, or incentive to see different miners.
        </div>
      )}
    </div>
  );
}

function formatStake(raw: string): string {
  const val = parseFloat(raw);
  if (!val || val === 0) return "\u2014";
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return val.toFixed(2);
}

// ── Main Export ─────────────────────────────────────────

export function BittensorTab() {
  const navigate = useNavigate();
  const { subnets, loading, error } = useTaoSubnets();
  const { stats } = useTaoStats();
  const [expandedNet, setExpandedNet] = useState<number | null>(null);

  const attestedCount = subnets.filter(s => s.attested).length;

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Header */}
      <div style={{ marginBottom: 32, animation: "fadeInUp 0.5s ease 0.05s both" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "4px 12px", borderRadius: 14, border: `1px solid ${BORDER}`,
          background: "rgba(45,212,191,0.06)", marginBottom: 16,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: TEAL, animation: "pulse 2s infinite" }} />
          <span style={{ color: TEAL, fontSize: 11, fontWeight: 400 }}>Bittensor Network</span>
        </div>
        <h2 style={{
          fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 700,
          color: TEXT, margin: "0 0 8px",
        }}>Bittensor Integration</h2>
        <p style={{ color: TEXT_DIM, fontSize: 13, margin: 0, maxWidth: 600, lineHeight: 1.6 }}>
          Cross-chain skill attestations for Bittensor subnet miners. Discover subnets, audit miners, and register attestations on Base L2.
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{
        display: "flex", gap: 16, marginBottom: 36,
        animation: "fadeInUp 0.5s ease 0.1s both",
      }}>
        <StatCard
          label="Active Subnets"
          value={loading ? "\u2026" : String(stats?.totalSubnets ?? subnets.length)}
          sub="On Bittensor Finney"
          accent
        />
        <StatCard
          label="Attested Subnets"
          value={loading ? "\u2026" : String(stats?.attestedSubnets ?? attestedCount)}
          sub="With AEGIS attestations"
        />
        <StatCard
          label="Total Nodes"
          value={loading ? "\u2026" : (stats?.totalNodes ?? 0).toLocaleString()}
          sub="Miners & validators"
        />
        <StatCard
          label="TAO Criteria"
          value="6"
          sub="Supplementary checks"
        />
      </div>

      {/* TAO Audit Criteria */}
      <div style={{
        background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10,
        padding: "20px 24px", marginBottom: 36,
        animation: "fadeInUp 0.5s ease 0.15s both",
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 16 }}>TAO Audit Criteria</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TAO_CRITERIA_KEYS.map(c => (
            <div key={c.key} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 6,
              background: c.color + "10", border: `1px solid ${c.color}25`,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: c.color }} />
              <span style={{ fontSize: 11, color: c.color, fontWeight: 600 }}>{c.key}</span>
              <span style={{ fontSize: 10, color: TEXT_DIM }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Subnet Explorer */}
      <div style={{
        background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10,
        overflow: "hidden", marginBottom: 36,
        animation: "fadeInUp 0.5s ease 0.2s both",
      }}>
        <div style={{
          padding: "16px 24px", borderBottom: `1px solid ${BORDER}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Subnet Explorer</div>
          <div style={{ fontSize: 11, color: TEXT_DIM }}>
            {loading ? "Loading subnets\u2026" : `${subnets.length} active subnets \u00b7 ${attestedCount} attested`}
          </div>
        </div>

        {error && (
          <div style={{ padding: "16px 24px", color: ACCENT, fontSize: 12 }}>
            RPC Error: {error}
          </div>
        )}

        {/* Table Header */}
        <div style={{
          display: "grid", gridTemplateColumns: "60px 1fr 80px 90px 1fr",
          padding: "10px 24px", borderBottom: `1px solid ${BORDER}`,
          fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.08em",
        }}>
          <div>NetUID</div>
          <div>Name</div>
          <div style={{ textAlign: "center" }}>Nodes</div>
          <div style={{ textAlign: "center" }}>Status</div>
          <div style={{ textAlign: "right" }}>AEGIS Skill Hash</div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: TEXT_DIM, fontSize: 12 }}>
            Querying Bittensor Finney network\u2026
          </div>
        ) : subnets.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: TEXT_DIM, fontSize: 12 }}>
            No active subnets found
          </div>
        ) : (
          subnets.map(subnet => (
            <div key={subnet.netuid}>
              <div
                onClick={() => setExpandedNet(expandedNet === subnet.netuid ? null : subnet.netuid)}
                style={{
                  display: "grid", gridTemplateColumns: "60px 1fr 80px 90px 1fr",
                  padding: "12px 24px",
                  borderBottom: `1px solid ${BORDER}`,
                  cursor: "pointer",
                  background: expandedNet === subnet.netuid ? SURFACE2 : "transparent",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => { if (expandedNet !== subnet.netuid) e.currentTarget.style.background = SURFACE2; }}
                onMouseLeave={e => { if (expandedNet !== subnet.netuid) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: TEAL, fontFamily: FONT_HEAD }}>
                  {subnet.netuid}
                </div>
                <div style={{ fontSize: 12, color: TEXT }}>{subnet.name}</div>
                <div style={{ fontSize: 11, color: TEXT_DIM, textAlign: "center" }}>
                  {subnet.minerCount > 0 ? subnet.minerCount : "\u2014"}
                </div>
                <div style={{ textAlign: "center" }}>
                  {subnet.attested ? (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: GREEN, background: GREEN + "15",
                      padding: "2px 6px", borderRadius: 4, textTransform: "uppercase",
                    }}>Attested ({subnet.attestationCount})</span>
                  ) : (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: TEXT_MUTED, background: SURFACE3,
                      padding: "2px 6px", borderRadius: 4, textTransform: "uppercase",
                    }}>Unaudited</span>
                  )}
                </div>
                <div style={{
                  fontSize: 11, color: TEXT_MUTED, textAlign: "right",
                  fontFamily: "'SF Mono', 'Cascadia Code', monospace",
                }}>
                  {truncHash(subnet.skillHash)}
                </div>
              </div>

              {/* Expanded: miner table */}
              {expandedNet === subnet.netuid && (
                <>
                  {/* Subnet detail row */}
                  <div style={{
                    padding: "12px 24px 12px 60px",
                    background: SURFACE2, borderBottom: `1px solid ${BORDER}`,
                    display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap",
                  }}>
                    <div>
                      <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>Full Skill Hash</div>
                      <div style={{
                        fontSize: 11, color: TEXT_DIM,
                        fontFamily: "'SF Mono', 'Cascadia Code', monospace",
                        wordBreak: "break-all",
                      }}>{subnet.skillHash}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>Hash Derivation</div>
                      <div style={{ fontSize: 11, color: TEXT_DIM }}>
                        keccak256("tao:subnet:{subnet.netuid}")
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/registry`);
                      }}
                      style={{
                        marginLeft: "auto",
                        background: ACCENT + "15",
                        border: `1px solid ${ACCENT}40`,
                        color: ACCENT, fontSize: 11, fontWeight: 600,
                        padding: "6px 14px", borderRadius: 6,
                        cursor: "pointer", fontFamily: FONT,
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = ACCENT + "25"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = ACCENT + "15"; }}
                    >
                      View in Registry &rarr;
                    </button>
                  </div>
                  {/* Miner table */}
                  <MinerTable netuid={subnet.netuid} />
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* How It Works */}
      <div style={{ marginBottom: 24, animation: "fadeInUp 0.5s ease 0.25s both" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 16 }}>How TAO Attestation Works</div>
        <div style={{ display: "flex", gap: 16 }}>
          <StepCard
            step={1}
            title="Discover Subnets"
            desc="Browse active Bittensor subnets and identify miners to audit. Each subnet and miner gets a deterministic AEGIS skill hash."
            icon={<svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="10" fill="none" stroke={TEAL} strokeWidth="1.5" /><circle cx="14" cy="14" r="4" fill={TEAL} opacity="0.3" /><line x1="21" y1="21" x2="26" y2="26" stroke={TEAL} strokeWidth="1.5" /></svg>}
          />
          <StepCard
            step={2}
            title="Audit Miners"
            desc="Run TAO-specific audit criteria: response quality, uptime, latency, weight distribution, and integrity checks."
            icon={<svg width="28" height="28" viewBox="0 0 28 28"><rect x="4" y="4" width="20" height="20" rx="3" fill="none" stroke={BLUE} strokeWidth="1.5" /><polyline points="8,15 12,19 20,9" fill="none" stroke={BLUE} strokeWidth="2" /></svg>}
          />
          <StepCard
            step={3}
            title="Attest on Base"
            desc="Register ZK attestations on Base L2 using the derived skill hash. Cross-chain trust without bridging tokens."
            icon={<svg width="28" height="28" viewBox="0 0 28 28"><polygon points="14,2 26,9 26,19 14,26 2,19 2,9" fill="none" stroke={ACCENT} strokeWidth="1.5" /><polygon points="14,8 20,11.5 20,18.5 14,22 8,18.5 8,11.5" fill={ACCENT} opacity="0.15" /></svg>}
          />
        </div>
      </div>
    </div>
  );
}
