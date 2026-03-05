import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { NavConnectWallet } from "../components/NavConnectWallet";

// ── Design System (matches Landing / Registry / Developers) ──
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

// Additional palette for tiers / status
const GREEN = "#4ADE80";
const PURPLE = "#A78BFA";
const AMBER = "#FBBF24";
const RED = "#F87171";
const BLUE = "#60A5FA";

// ── Types ────────────────────────────────────────────────────
interface Auditor {
  commitment: string;
  stake: number;
  reputation: number;
  attestations: number;
  disputes: number;
  slashed: boolean;
  registeredDaysAgo: number;
  tier: "Bronze" | "Silver" | "Gold" | "Diamond";
  levels: number[];   // [L1, L2, L3] counts
  status: "active" | "suspended" | "slashed";
  recentSkills: string[];
}

// ── Auditor Data (empty — populated from on-chain as auditors register) ──
const AUDITOR_DATA: Auditor[] = [];

// ── Tier Config ──────────────────────────────────────────────
const TIER_COLORS: Record<string, string> = {
  Bronze: "#CD7F32",
  Silver: "#C0C0C0",
  Gold: AMBER,
  Diamond: PURPLE,
};

const TIER_REQUIREMENTS = [
  { tier: "Bronze", rep: "0 – 9", stake: "≥ 0.01 ETH", perks: "Eligible for L1 audits" },
  { tier: "Silver", rep: "10 – 24", stake: "≥ 0.025 ETH", perks: "Eligible for L1 & L2 audits" },
  { tier: "Gold", rep: "25 – 49", stake: "≥ 0.1 ETH", perks: "Eligible for all levels, priority queue" },
  { tier: "Diamond", rep: "50+", stake: "≥ 0.5 ETH", perks: "All levels, governance votes, bonus rewards" },
];

// ── Animated Counter ─────────────────────────────────────────
function Counter({ end, suffix = "", duration = 1600 }: { end: number; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = Date.now();
          const tick = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setVal(Math.floor(eased * end));
            if (progress < 1) requestAnimationFrame(tick);
          };
          tick();
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ── StatCard ─────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div style={{
      flex: 1, background: SURFACE, border: `1px solid ${BORDER}`,
      borderRadius: 10, padding: "20px 24px",
    }}>
      <div style={{ fontFamily: FONT, fontSize: 11, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: FONT_HEAD, fontSize: 26, fontWeight: 700, color: accent ? ACCENT : TEXT, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      <div style={{ fontFamily: FONT, fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

// ── TierBadge ────────────────────────────────────────────────
function TierBadge({ tier, size = "sm" }: { tier: string; size?: "sm" | "lg" }) {
  const color = TIER_COLORS[tier] || TEXT_DIM;
  const isSm = size === "sm";
  return (
    <span style={{
      fontFamily: FONT, fontSize: isSm ? 10 : 11, fontWeight: 700,
      color, background: `${color}18`, border: `1px solid ${color}30`,
      padding: isSm ? "2px 8px" : "4px 12px", borderRadius: 4,
      textTransform: "uppercase", letterSpacing: "0.04em",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <span style={{ width: isSm ? 5 : 6, height: isSm ? 5 : 6, borderRadius: "50%", background: color }} />
      {tier}
    </span>
  );
}

// ── StatusDot ────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    active: { color: GREEN, bg: `${GREEN}15` },
    suspended: { color: AMBER, bg: `${AMBER}15` },
    slashed: { color: RED, bg: `${RED}15` },
  };
  const s = map[status] || map.active;
  return (
    <span style={{
      fontFamily: FONT, fontSize: 10, fontWeight: 700,
      color: s.color, background: s.bg, padding: "3px 8px", borderRadius: 4,
      textTransform: "uppercase", letterSpacing: "0.04em",
    }}>{status}</span>
  );
}

// ── LevelBar ─────────────────────────────────────────────────
function LevelBar({ levels, total }: { levels: number[]; total: number }) {
  if (total === 0) return null;
  const colors = [TEXT_DIM, ACCENT2, ACCENT];
  return (
    <div style={{ display: "flex", gap: 1, borderRadius: 3, overflow: "hidden", height: 6, width: "100%", maxWidth: 120 }}>
      {levels.map((count, i) => (
        <div key={i} style={{
          flex: count, background: colors[i], minWidth: count > 0 ? 4 : 0,
          transition: "flex 0.3s ease",
        }} title={`L${i + 1}: ${count}`} />
      ))}
    </div>
  );
}

// ── Reputation Bar ───────────────────────────────────────────
function ReputationBar({ score, max = 80 }: { score: number; max?: number }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = score >= 50 ? PURPLE : score >= 25 ? AMBER : score >= 10 ? ACCENT2 : TEXT_DIM;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", maxWidth: 140 }}>
      <div style={{
        flex: 1, height: 6, background: SURFACE3, borderRadius: 3, overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%", background: color, borderRadius: 3,
          transition: "width 0.4s ease",
        }} />
      </div>
      <span style={{ fontFamily: FONT, fontSize: 11, color: TEXT_DIM, minWidth: 24, textAlign: "right" }}>
        {score}
      </span>
    </div>
  );
}

// ── FilterChip ───────────────────────────────────────────────
function FilterChip({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: active ? `${ACCENT}18` : "transparent",
      border: `1px solid ${active ? `${ACCENT}40` : BORDER}`,
      color: active ? ACCENT : TEXT_DIM,
      fontFamily: FONT, fontSize: 12, fontWeight: 400,
      padding: "5px 10px", borderRadius: 6, cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 6,
      transition: "all 0.12s ease",
    }}>
      {label}
      {count !== undefined && (
        <span style={{
          background: active ? `${ACCENT}30` : SURFACE3,
          color: active ? ACCENT : TEXT_MUTED,
          fontSize: 10, fontFamily: FONT, fontWeight: 700,
          padding: "1px 6px", borderRadius: 10, minWidth: 18, textAlign: "center",
        }}>{count}</span>
      )}
    </button>
  );
}

// ── SortHeader ───────────────────────────────────────────────
function SortHeader({ label, sortKey, currentSort, currentDir, onSort }: {
  label: string; sortKey: string; currentSort: string; currentDir: "asc" | "desc"; onSort: (key: string) => void;
}) {
  const active = currentSort === sortKey;
  return (
    <span
      onClick={() => onSort(sortKey)}
      style={{
        cursor: "pointer", userSelect: "none",
        color: active ? TEXT : TEXT_MUTED,
        fontWeight: active ? 700 : 400,
        transition: "color 0.12s",
        display: "inline-flex", alignItems: "center", gap: 4,
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget.style.color = TEXT); }}
      onMouseLeave={e => { if (!active) (e.currentTarget.style.color = TEXT_MUTED); }}
    >
      {label}
      {active && <span style={{ color: ACCENT, fontSize: 10 }}>{currentDir === "asc" ? "\u2191" : "\u2193"}</span>}
    </span>
  );
}

// ── PageBtn + Pagination ─────────────────────────────────────
function PageBtn({ label, active, disabled, onClick }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: 32, height: 32, borderRadius: 6,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: FONT, fontSize: 12, fontWeight: active ? 700 : 400,
      background: active ? `${ACCENT}20` : "transparent",
      border: active ? `1px solid ${ACCENT}40` : "1px solid transparent",
      color: active ? ACCENT : disabled ? TEXT_MUTED : TEXT_DIM,
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.4 : 1,
      transition: "all 0.12s",
    }}
      onMouseEnter={e => { if (!active && !disabled) e.currentTarget.style.background = SURFACE3; }}
      onMouseLeave={e => { if (!active && !disabled) e.currentTarget.style.background = "transparent"; }}
    >{label}</button>
  );
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "16px 20px", borderTop: `1px solid ${BORDER}`,
    }}>
      <span style={{ fontFamily: FONT, fontSize: 12, color: TEXT_MUTED }}>Page {page} of {totalPages}</span>
      <div style={{ display: "flex", gap: 4 }}>
        <PageBtn label="\u2190" disabled={page <= 1} onClick={() => onPage(page - 1)} />
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} style={{ width: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", color: TEXT_MUTED, fontFamily: FONT, fontSize: 12 }}>&hellip;</span>
          ) : (
            <PageBtn key={p} label={String(p)} active={p === page} onClick={() => onPage(p as number)} />
          )
        )}
        <PageBtn label="\u2192" disabled={page >= totalPages} onClick={() => onPage(page + 1)} />
      </div>
    </div>
  );
}

// ── Circuit Connector SVG (runs between step cards) ─────────
function CircuitConnectors({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [dims, setDims] = useState<{ w: number; h: number; cards: DOMRect[] } | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-step-card]")).map(c => {
        const cr = c.getBoundingClientRect();
        return new DOMRect(cr.left - rect.left, cr.top - rect.top, cr.width, cr.height);
      });
      if (cards.length === 4) setDims({ w: rect.width, h: rect.height, cards });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [containerRef]);

  if (!dims || dims.cards.length < 4) return null;

  const { w, h, cards } = dims;

  // Build paths connecting each card pair through the gaps
  // Each connector: exits right side of card N, routes through gap, enters left side of card N+1
  const connectors: { path: string; nodes: [number, number][]; delay: number }[] = [];

  for (let i = 0; i < 3; i++) {
    const from = cards[i];
    const to = cards[i + 1];
    const exitX = from.x + from.width;
    const enterX = to.x;
    const midX = (exitX + enterX) / 2;

    // Main trace — exits at ~35% height, jogs through the gap with right angles
    const y1 = from.y + from.height * 0.32;
    const y2 = to.y + to.height * 0.38;
    const path = `M ${exitX} ${y1} H ${midX - 2} V ${y2} H ${enterX}`;

    // Secondary trace — exits at ~65% height, different routing
    const y3 = from.y + from.height * 0.68;
    const y4 = to.y + to.height * 0.62;
    const path2 = `M ${exitX} ${y3} H ${midX + 2} V ${y4} H ${enterX}`;

    connectors.push(
      { path, nodes: [[midX - 2, y1], [midX - 2, y2], [enterX, y2]], delay: i * 0.6 },
      { path: path2, nodes: [[midX + 2, y3], [midX + 2, y4]], delay: i * 0.6 + 0.3 },
    );
  }

  return (
    <svg
      width={w}
      height={h}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 5 }}
    >
      <defs>
        <filter id="circuit-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {connectors.map(({ path, nodes, delay }, i) => (
        <g key={i}>
          {/* Static dim trace */}
          <path d={path} fill="none" stroke={ACCENT} strokeWidth="1.5" opacity="0.15" strokeLinecap="round" />

          {/* Animated flowing pulse */}
          <path
            d={path}
            fill="none"
            stroke={ACCENT}
            strokeWidth="2"
            strokeLinecap="round"
            filter="url(#circuit-glow)"
            strokeDasharray="16 200"
            style={{
              animation: `circuitFlow ${3 + delay}s linear ${delay}s infinite`,
              opacity: 0.85,
            }}
          />

          {/* Junction nodes */}
          {nodes.map(([cx, cy], j) => (
            <circle
              key={j}
              cx={cx}
              cy={cy}
              r="3"
              fill={ACCENT}
              opacity="0.5"
              style={{ animation: `nodeFlicker ${1.8 + j * 0.3}s ease-in-out ${delay}s infinite` }}
            />
          ))}
        </g>
      ))}

      {/* Entry/exit port dots on each card edge */}
      {cards.map((card, ci) => {
        const dots: [number, number][] = [];
        if (ci > 0) {
          // Left edge entry ports
          dots.push([card.x, card.y + card.height * 0.38]);
          dots.push([card.x, card.y + card.height * 0.62]);
        }
        if (ci < 3) {
          // Right edge exit ports
          dots.push([card.x + card.width, card.y + card.height * 0.32]);
          dots.push([card.x + card.width, card.y + card.height * 0.68]);
        }
        return dots.map(([cx, cy], di) => (
          <circle
            key={`port-${ci}-${di}`}
            cx={cx}
            cy={cy}
            r="3.5"
            fill={BG}
            stroke={ACCENT}
            strokeWidth="1.5"
            opacity="0.7"
            style={{ animation: `nodeFlicker 2s ease-in-out ${ci * 0.4}s infinite` }}
          />
        ));
      })}
    </svg>
  );
}

// ── How It Works Step ────────────────────────────────────────
function Step({ number, title, description, icon }: { number: number; title: string; description: string; icon: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      data-step-card
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, padding: "28px 24px", background: hovered ? SURFACE2 : SURFACE,
        border: `1px solid ${hovered ? `${ACCENT}30` : BORDER}`,
        borderRadius: 12, position: "relative", transition: "all 0.2s ease",
        zIndex: 1,
      }}
    >
      <div style={{
        position: "absolute", top: -12, left: 20,
        fontFamily: FONT, fontSize: 10, fontWeight: 700,
        color: BG, background: ACCENT, padding: "2px 10px", borderRadius: 4,
      }}>
        STEP {number}
      </div>
      <div style={{ fontSize: 28, marginBottom: 12, marginTop: 4 }}>{icon}</div>
      <h3 style={{
        fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 700,
        color: TEXT, margin: "0 0 8px", letterSpacing: "-0.01em",
      }}>{title}</h3>
      <p style={{
        fontFamily: FONT, fontSize: 12, color: TEXT_DIM, lineHeight: 1.6, margin: 0,
      }}>{description}</p>
    </div>
  );
}

// ── Steps + Circuit Connectors (wrapper) ─────────────────────
function StepsWithCircuits() {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={containerRef} style={{ display: "flex", gap: 14, position: "relative" }}>
      <CircuitConnectors containerRef={containerRef} />
      <Step
        number={1}
        title="Generate Commitment"
        description="Create a Pedersen hash from your private key. This is your anonymous on-chain identity — no wallet address, no KYC, just math."
        icon="🔐"
      />
      <Step
        number={2}
        title="Stake & Register"
        description="Register on-chain by staking at least 0.01 ETH. Your stake is your bond — slashed if disputes prove bad audits. A 5% protocol fee applies."
        icon="⚡"
      />
      <Step
        number={3}
        title="Audit Against Criteria"
        description="Evaluate skills against structured criteria — L1 (4 checks), L2 (9 checks), or L3 (14 checks). Generate a ZK proof and publish metadata to IPFS."
        icon="🔍"
      />
      <Step
        number={4}
        title="Build Trust On-Chain"
        description="Attestations feed into ERC-8004 validation scores and composite trust profiles. Your work becomes part of the global agent trust layer."
        icon="📈"
      />
    </div>
  );
}

// ── AuditorRow ───────────────────────────────────────────────
const GRID = "minmax(140px, 1fr) 100px 100px 80px 130px 100px 90px 40px";

function AuditorRow({ auditor, expanded, onToggle, index }: {
  auditor: Auditor; expanded: boolean; onToggle: () => void; index: number;
}) {
  const dateStr = (() => {
    const d = new Date(Date.now() - auditor.registeredDaysAgo * 86400000);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  })();

  return (
    <div style={{ animation: `fadeInUp 0.4s ease ${index * 0.03}s both` }}>
      <div
        onClick={onToggle}
        style={{
          display: "grid", gridTemplateColumns: GRID,
          padding: "14px 20px", borderBottom: expanded ? "none" : `1px solid ${BORDER}`,
          alignItems: "center", cursor: "pointer",
          background: expanded ? SURFACE2 : "transparent",
          transition: "background 0.12s",
        }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = SURFACE2; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = "transparent"; }}
      >
        {/* Commitment */}
        <div>
          <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: TEXT }}>{auditor.commitment}</div>
          <div style={{ fontFamily: FONT, fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>
            {auditor.registeredDaysAgo}d ago
          </div>
        </div>
        {/* Tier */}
        <TierBadge tier={auditor.tier} />
        {/* Stake */}
        <div style={{ fontFamily: FONT, fontSize: 12, color: TEXT }}>{auditor.stake.toFixed(3)} ETH</div>
        {/* Attestations */}
        <div style={{ fontFamily: FONT, fontSize: 12, color: TEXT }}>{auditor.attestations}</div>
        {/* Reputation */}
        <ReputationBar score={auditor.reputation} />
        {/* Status */}
        <StatusBadge status={auditor.status} />
        {/* Levels */}
        <LevelBar levels={auditor.levels} total={auditor.attestations} />
        {/* Expand */}
        <div style={{
          fontFamily: FONT, fontSize: 14, color: TEXT_MUTED, textAlign: "center",
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.15s ease",
        }}>{"\u25BE"}</div>
      </div>

      {/* Expanded Panel */}
      {expanded && (
        <div style={{
          background: SURFACE2, padding: "0 20px 20px", borderBottom: `1px solid ${BORDER}`,
          animation: "fadeInUp 0.25s ease",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: FONT, fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Full Commitment</div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: ACCENT, wordBreak: "break-all" }}>{auditor.commitment}</div>
            </div>
            <div>
              <div style={{ fontFamily: FONT, fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Total Stake</div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: TEXT }}>{auditor.stake.toFixed(3)} ETH</div>
            </div>
            <div>
              <div style={{ fontFamily: FONT, fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Disputes</div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: auditor.disputes > 0 ? RED : TEXT }}>{auditor.disputes}</div>
            </div>
            <div>
              <div style={{ fontFamily: FONT, fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Registered</div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: TEXT }}>{dateStr}</div>
            </div>
          </div>

          {/* Attestation breakdown */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: FONT, fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              Attestation Breakdown
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { label: "L1 Functional", count: auditor.levels[0], color: TEXT_DIM },
                { label: "L2 Robust", count: auditor.levels[1], color: ACCENT2 },
                { label: "L3 Security", count: auditor.levels[2], color: ACCENT },
              ].map(l => (
                <div key={l.label} style={{
                  flex: 1, padding: "10px 14px", background: SURFACE,
                  border: `1px solid ${BORDER}`, borderRadius: 8,
                }}>
                  <div style={{ fontFamily: FONT_HEAD, fontSize: 18, fontWeight: 700, color: l.color }}>
                    {l.count}
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>
                    {l.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent skills */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: FONT, fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              Recent Audited Skills
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {auditor.recentSkills.map((skill, i) => (
                <span key={i} style={{
                  fontFamily: FONT, fontSize: 11, color: TEXT_DIM,
                  background: SURFACE3, padding: "4px 10px", borderRadius: 4,
                  border: `1px solid ${BORDER}`,
                }}>{skill}</span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
            {[
              { label: "View on Base", bg: SURFACE3, color: TEXT_DIM, border: BORDER },
              { label: "View Attestations", bg: `${ACCENT}15`, color: ACCENT, border: `${ACCENT}30` },
              ...(auditor.status === "active" ? [{ label: "Submit Dispute", bg: `${RED}15`, color: RED, border: `${RED}30` }] : []),
            ].map(btn => (
              <button key={btn.label} style={{
                fontFamily: FONT, fontSize: 11, fontWeight: 400,
                background: btn.bg, color: btn.color, border: `1px solid ${btn.border}`,
                padding: "6px 14px", borderRadius: 6, cursor: "pointer",
                transition: "opacity 0.12s",
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >{btn.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── NavBar ───────────────────────────────────────────────────
function AuditorNavBar() {
  const navigate = useNavigate();
  return (
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
          fontFamily: FONT, fontSize: 10, color: ACCENT, background: `${ACCENT}18`,
          border: `1px solid ${ACCENT}30`, borderRadius: 4, padding: "2px 8px",
          fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          Auditors
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        {[
          { label: "Registry", onClick: () => navigate("/registry") },
          { label: "Developers", onClick: () => navigate("/developers") },
          { label: "Auditors", onClick: () => navigate("/auditors") },
          { label: "Docs", onClick: () => navigate("/docs") },
        ].map(item => (
          <a key={item.label} href="#" style={{
            color: item.label === "Auditors" ? TEXT : TEXT_DIM,
            textDecoration: item.label === "Auditors" ? "underline" : "none",
            textUnderlineOffset: 6,
            textDecorationColor: item.label === "Auditors" ? ACCENT : "transparent",
            fontSize: 13, fontFamily: FONT,
            fontWeight: item.label === "Auditors" ? 600 : 400,
            transition: "color 0.2s",
            cursor: item.label === "Auditors" ? "default" : "pointer",
          }}
            onClick={e => { e.preventDefault(); if (item.label !== "Auditors" && item.onClick) item.onClick(); }}
            onMouseEnter={e => { if (item.label !== "Auditors") (e.target as HTMLElement).style.color = TEXT; }}
            onMouseLeave={e => { if (item.label !== "Auditors") (e.target as HTMLElement).style.color = TEXT_DIM; }}
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

// ── Geometric BG (subtle) ────────────────────────────────────
function SubtleBG() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      <svg width="100%" height="100%" style={{ opacity: 0.03 }}>
        <defs>
          <pattern id="auditor-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#fff" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auditor-grid)" />
      </svg>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          width: 400 + i * 100, height: 400 + i * 100,
          border: `1px solid rgba(255,51,102,${0.02 + i * 0.005})`,
          borderRadius: "50%",
          top: `${15 + i * 20}%`,
          left: `${60 + (i % 2 === 0 ? -10 : 15)}%`,
          transform: "translate(-50%, -50%)",
        }} />
      ))}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
const PER_PAGE = 8;

export function Auditors() {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState("reputation");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const filtered = (() => {
    let data = [...AUDITOR_DATA];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(a =>
        a.commitment.toLowerCase().includes(q) ||
        a.tier.toLowerCase().includes(q) ||
        a.recentSkills.some(s => s.toLowerCase().includes(q))
      );
    }
    if (tierFilter) data = data.filter(a => a.tier === tierFilter);
    if (statusFilter) data = data.filter(a => a.status === statusFilter);

    data.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
    return data;
  })();

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageData = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const tierCounts: Record<string, number> = { Bronze: 0, Silver: 0, Gold: 0, Diamond: 0 };
  const statusCounts: Record<string, number> = { active: 0, suspended: 0, slashed: 0 };
  AUDITOR_DATA.forEach(a => { tierCounts[a.tier]++; statusCounts[a.status]++; });

  const totalStake = AUDITOR_DATA.reduce((s, a) => s + a.stake, 0);
  const totalAttestations = AUDITOR_DATA.reduce((s, a) => s + a.attestations, 0);

  const scrollToTable = useCallback(() => {
    const el = document.getElementById("auditor-table");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: ${BG}; color: ${TEXT}; overflow-x: hidden; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes circuitFlow {
          0% { stroke-dashoffset: 200; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes nodeFlicker {
          0%, 100% { opacity: 0.2; r: 1.5; }
          50% { opacity: 0.9; r: 2.5; }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${BG}; }
        ::-webkit-scrollbar-thumb { background: ${BORDER}; border-radius: 3px; }
      `}</style>

      <SubtleBG />
      <AuditorNavBar />

      <div style={{ paddingTop: 64, position: "relative", zIndex: 1 }}>
        {/* ── Hero Section ─────────────────────────── */}
        <div ref={heroRef} style={{
          padding: "60px 48px 48px", maxWidth: 1200, margin: "0 auto",
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "4px 14px", borderRadius: 20, border: `1px solid ${BORDER}`,
            marginBottom: 20, background: `${ACCENT}06`,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: AUDITOR_DATA.length > 0 ? GREEN : TEXT_MUTED, animation: AUDITOR_DATA.length > 0 ? "pulse 2s infinite" : "none" }} />
            <span style={{ color: TEXT_DIM, fontSize: 11, fontFamily: FONT }}>
              {AUDITOR_DATA.length > 0 ? `${statusCounts.active} auditors active on Base` : "No auditors registered yet"}
            </span>
          </div>

          <h1 style={{
            fontFamily: FONT_HEAD, fontSize: 36, fontWeight: 800,
            color: TEXT, letterSpacing: "-0.02em", margin: "0 0 12px",
          }}>
            Auditor{" "}
            <span style={{
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>Network</span>
          </h1>
          <p style={{
            fontFamily: FONT, fontSize: 14, color: TEXT_DIM,
            maxWidth: 600, lineHeight: 1.7, margin: "0 0 32px",
          }}>
            Anonymous auditors stake ETH behind their attestations. Reputation is tracked by commitment, not identity.
            Bad audits get slashed. Good audits compound trust.
          </p>

          {/* Stats Row */}
          <div style={{ display: "flex", gap: 12, marginBottom: 0 }}>
            <StatCard label="Total Auditors" value={String(AUDITOR_DATA.length)} sub={`${statusCounts.active} active`} />
            <StatCard label="Total Staked" value={`${totalStake.toFixed(1)} ETH`} sub="Bonded across all auditors" accent />
            <StatCard label="Attestations" value={totalAttestations.toLocaleString()} sub="Skills verified" />
            <StatCard label="Disputes" value={String(AUDITOR_DATA.reduce((s, a) => s + a.disputes, 0))} sub={`${statusCounts.slashed} slashed`} />
          </div>
        </div>

        {/* ── How It Works ─────────────────────────── */}
        <div style={{
          padding: "48px 48px", maxWidth: 1200, margin: "0 auto",
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 12, color: ACCENT,
            textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12,
          }}>How Auditing Works</div>
          <h2 style={{
            fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 700,
            color: TEXT, letterSpacing: "-0.01em", margin: "0 0 28px",
          }}>From anonymous identity to trusted attestation</h2>

          <StepsWithCircuits />
        </div>

        {/* ── Audit Criteria ───────────────────────── */}
        <div style={{
          padding: "48px 48px", maxWidth: 1200, margin: "0 auto",
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 12, color: BLUE,
            textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12,
          }}>Evaluation Framework</div>
          <h2 style={{
            fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 700,
            color: TEXT, letterSpacing: "-0.01em", margin: "0 0 8px",
          }}>Structured audit criteria</h2>
          <p style={{
            fontFamily: FONT, fontSize: 13, color: TEXT_DIM, lineHeight: 1.6,
            margin: "0 0 28px", maxWidth: 640,
          }}>
            Each audit level defines specific checks the auditor must perform and document.
            Higher levels include all checks from lower levels. Metadata is published to IPFS
            and linked on-chain via a criteria hash.
          </p>

          <div style={{ display: "flex", gap: 16 }}>
            {[
              {
                level: "L1",
                name: "Functional",
                color: TEXT_DIM,
                score: "33",
                checks: [
                  { id: "L1.EXEC", label: "Execution" },
                  { id: "L1.OUTPUT", label: "Output Format" },
                  { id: "L1.DEPS", label: "Dependencies" },
                  { id: "L1.DOCS", label: "Documentation" },
                ],
              },
              {
                level: "L2",
                name: "Robust",
                color: ACCENT2,
                score: "66",
                checks: [
                  { id: "L2.EDGE", label: "Edge Cases" },
                  { id: "L2.ERROR", label: "Error Handling" },
                  { id: "L2.VALIDATE", label: "Input Validation" },
                  { id: "L2.RESOURCE", label: "Resource Limits" },
                  { id: "L2.IDEMPOTENT", label: "Consistency" },
                ],
              },
              {
                level: "L3",
                name: "Security",
                color: ACCENT,
                score: "100",
                checks: [
                  { id: "L3.INJECTION", label: "Prompt Injection" },
                  { id: "L3.EXFIL", label: "Data Exfiltration" },
                  { id: "L3.SANDBOX", label: "Sandbox Escape" },
                  { id: "L3.SUPPLY", label: "Supply Chain" },
                  { id: "L3.ADVERSARIAL", label: "Adversarial Testing" },
                ],
              },
            ].map((tier, i) => (
              <div key={tier.level} style={{
                flex: 1, background: SURFACE, border: `1px solid ${BORDER}`,
                borderRadius: 12, overflow: "hidden",
              }}>
                {/* Header */}
                <div style={{
                  padding: "20px 20px 16px",
                  borderBottom: `1px solid ${BORDER}`,
                  background: `${tier.color}08`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{
                      fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 800, color: tier.color,
                    }}>{tier.level}</span>
                    <span style={{
                      fontFamily: FONT, fontSize: 10, fontWeight: 700,
                      color: tier.color, background: `${tier.color}18`,
                      border: `1px solid ${tier.color}30`,
                      padding: "2px 8px", borderRadius: 4,
                    }}>ERC-8004: {tier.score}</span>
                  </div>
                  <div style={{ fontFamily: FONT_HEAD, fontSize: 14, fontWeight: 700, color: TEXT }}>
                    {tier.name}
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 11, color: TEXT_DIM, marginTop: 4 }}>
                    {i === 0 ? "4 checks" : i === 1 ? "L1 + 5 checks (9 total)" : "L1 + L2 + 5 checks (14 total)"}
                  </div>
                </div>
                {/* Checks */}
                <div style={{ padding: "16px 20px" }}>
                  {tier.checks.map(check => (
                    <div key={check.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 0",
                      borderBottom: `1px solid ${BORDER}40`,
                    }}>
                      <code style={{
                        fontFamily: FONT, fontSize: 10, color: tier.color,
                        background: `${tier.color}12`, padding: "2px 6px",
                        borderRadius: 3, whiteSpace: "nowrap",
                      }}>{check.id}</code>
                      <span style={{ fontFamily: FONT, fontSize: 12, color: TEXT_DIM }}>
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* On-chain commitment note */}
          <div style={{
            marginTop: 20, padding: "16px 20px",
            background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 18 }}>&#x1f517;</span>
            <div>
              <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 2 }}>
                On-chain criteria hash
              </div>
              <div style={{ fontFamily: FONT, fontSize: 11, color: TEXT_DIM, lineHeight: 1.5 }}>
                Each attestation stores <code style={{ fontFamily: FONT, color: ACCENT, fontSize: 11 }}>keccak256(sorted criteria IDs)</code> on-chain,
                linking the attestation to its IPFS metadata. Disputes reference specific criteria IDs.
              </div>
            </div>
          </div>
        </div>

        {/* ── Trust Ecosystem ────────────────────────── */}
        <div style={{
          padding: "48px 48px", maxWidth: 1200, margin: "0 auto",
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 12, color: GREEN,
            textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12,
          }}>Trust Pipeline</div>
          <h2 style={{
            fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 700,
            color: TEXT, letterSpacing: "-0.01em", margin: "0 0 8px",
          }}>From audit to trust score</h2>
          <p style={{
            fontFamily: FONT, fontSize: 13, color: TEXT_DIM, lineHeight: 1.6,
            margin: "0 0 28px", maxWidth: 640,
          }}>
            Your audit attestations flow through the ERC-8004 ecosystem to produce
            composite trust profiles that AI agents query before interacting with each other.
          </p>

          {/* Pipeline flow */}
          <div style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
            {[
              {
                label: "AEGIS Audit",
                sub: "ZK attestation on-chain",
                detail: "L1/L2/L3 criteria, IPFS metadata, stake-backed proof",
                color: ACCENT,
                icon: "🛡️",
              },
              {
                label: "ERC-8004 Validation",
                sub: "Cross-protocol bridge",
                detail: "Audit scores mapped to 33/66/100 and submitted as validations",
                color: BLUE,
                icon: "🔗",
              },
              {
                label: "ERC-8004 Reputation",
                sub: "Consumer feedback",
                detail: "Users submit on-chain reputation after consuming an audit report",
                color: PURPLE,
                icon: "⭐",
              },
              {
                label: "Trust Profile",
                sub: "Composite 0-100 score",
                detail: "Weighted aggregate: 60% audit + 20% validation + 10% reputation + 10% multi-skill",
                color: GREEN,
                icon: "📊",
              },
            ].map((step, i) => (
              <div key={step.label} style={{ flex: 1, display: "flex", alignItems: "stretch" }}>
                <div style={{
                  flex: 1, padding: "24px 20px", background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  borderRadius: i === 0 ? "12px 0 0 12px" : i === 3 ? "0 12px 12px 0" : 0,
                  borderRight: i < 3 ? "none" : `1px solid ${BORDER}`,
                  position: "relative",
                }}>
                  <div style={{ fontSize: 24, marginBottom: 12 }}>{step.icon}</div>
                  <div style={{
                    fontFamily: FONT, fontSize: 10, fontWeight: 700,
                    color: step.color, textTransform: "uppercase",
                    letterSpacing: "0.06em", marginBottom: 6,
                  }}>{step.label}</div>
                  <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 6 }}>
                    {step.sub}
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 11, color: TEXT_DIM, lineHeight: 1.5 }}>
                    {step.detail}
                  </div>
                  {i < 3 && (
                    <div style={{
                      position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)",
                      width: 16, height: 16, background: BG, border: `1px solid ${BORDER}`,
                      borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      zIndex: 2, fontSize: 10, color: TEXT_MUTED,
                    }}>&#x2192;</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Trust levels */}
          <div style={{
            marginTop: 20, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2,
          }}>
            {[
              { level: "Unknown", range: "< 20", req: "No audits", color: TEXT_MUTED },
              { level: "Basic", range: "20 – 49", req: "L1+ audit", color: TEXT_DIM },
              { level: "Verified", range: "50 – 79", req: "L2+, no disputes", color: BLUE },
              { level: "Trusted", range: "80 – 100", req: "L3+, no disputes", color: GREEN },
            ].map((t, i) => (
              <div key={t.level} style={{
                padding: "16px 18px", background: SURFACE,
                borderRadius: i === 0 ? "10px 0 0 10px" : i === 3 ? "0 10px 10px 0" : 0,
                borderRight: i < 3 ? `1px solid ${BORDER}` : "none",
              }}>
                <div style={{
                  fontFamily: FONT, fontSize: 10, fontWeight: 700,
                  color: t.color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4,
                }}>{t.level}</div>
                <div style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 700, color: TEXT }}>{t.range}</div>
                <div style={{ fontFamily: FONT, fontSize: 11, color: TEXT_DIM, marginTop: 4 }}>{t.req}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tier System ──────────────────────────── */}
        <div style={{
          padding: "48px 48px", maxWidth: 1200, margin: "0 auto",
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 12, color: ACCENT2,
            textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12,
          }}>Tier System</div>
          <h2 style={{
            fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 700,
            color: TEXT, letterSpacing: "-0.01em", margin: "0 0 24px",
          }}>Reputation unlocks capabilities</h2>

          <div style={{ display: "flex", gap: 2 }}>
            {TIER_REQUIREMENTS.map((t, i) => (
              <div key={t.tier} style={{
                flex: 1, padding: "24px 20px", background: SURFACE,
                borderRadius: i === 0 ? "12px 0 0 12px" : i === 3 ? "0 12px 12px 0" : 0,
                borderRight: i < 3 ? `1px solid ${BORDER}` : "none",
              }}>
                <TierBadge tier={t.tier} size="lg" />
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontFamily: FONT, fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                    Reputation
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: TEXT }}>{t.rep}</div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontFamily: FONT, fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                    Min Stake
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: TEXT }}>{t.stake}</div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontFamily: FONT, fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                    Perks
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 12, color: TEXT_DIM, lineHeight: 1.5 }}>{t.perks}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Slashing Rules ───────────────────────── */}
        <div style={{
          padding: "48px 48px", maxWidth: 1200, margin: "0 auto",
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <div style={{
            fontFamily: FONT, fontSize: 12, color: RED,
            textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12,
          }}>Accountability</div>
          <h2 style={{
            fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 700,
            color: TEXT, letterSpacing: "-0.01em", margin: "0 0 24px",
          }}>Slashing &amp; dispute resolution</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              {
                title: "Dispute Bond",
                value: "0.005 ETH",
                description: "Anyone can open a dispute against an attestation by posting a minimum bond. If the auditor is found at fault, the bond is returned plus 50% of the auditor's slashed stake.",
                color: AMBER,
              },
              {
                title: "Slash Penalty",
                value: "50% of stake",
                description: "If governance resolves a dispute against the auditor, 50% of their total stake is slashed. Half goes to the challenger as reward, reputation score decreases.",
                color: RED,
              },
              {
                title: "False Dispute",
                value: "Bond forfeited",
                description: "If the auditor is found not at fault, the challenger's dispute bond is forfeited and stays in the protocol treasury. This discourages frivolous disputes.",
                color: TEXT_DIM,
              },
              {
                title: "Governance",
                value: "Protocol admin",
                description: "Currently disputes are resolved by the protocol admin (contract owner). Future versions will migrate to a DAO governance model with Diamond-tier auditor voting.",
                color: PURPLE,
              },
            ].map(card => (
              <div key={card.title} style={{
                padding: "24px", background: SURFACE, border: `1px solid ${BORDER}`,
                borderRadius: 12,
              }}>
                <div style={{ fontFamily: FONT, fontSize: 11, color: card.color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  {card.title}
                </div>
                <div style={{ fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 8 }}>
                  {card.value}
                </div>
                <p style={{ fontFamily: FONT, fontSize: 12, color: TEXT_DIM, lineHeight: 1.6, margin: 0 }}>
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Auditor Leaderboard ──────────────────── */}
        <div id="auditor-table" style={{
          padding: "48px 48px 24px", maxWidth: 1200, margin: "0 auto",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
            <div>
              <div style={{
                fontFamily: FONT, fontSize: 12, color: ACCENT,
                textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12,
              }}>Leaderboard</div>
              <h2 style={{
                fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 700,
                color: TEXT, letterSpacing: "-0.01em", margin: 0,
              }}>Active auditors</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN, animation: "pulse 2s infinite" }} />
              <span style={{ fontFamily: FONT, fontSize: 12, color: TEXT_MUTED }}>Live &middot; Base L2</span>
            </div>
          </div>

          {/* Search */}
          <div style={{ maxWidth: 680, marginBottom: 24 }}>
            <div style={{
              display: "flex", alignItems: "center",
              background: searchFocused ? SURFACE2 : SURFACE,
              border: `1px solid ${searchFocused ? `${ACCENT}60` : BORDER}`,
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
                placeholder="Search by commitment, tier, or skill name..."
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  fontFamily: FONT, fontSize: 14, color: TEXT, padding: "14px 12px",
                }}
              />
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
            <span style={{ fontFamily: FONT, fontSize: 11, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 4 }}>Tier</span>
            <FilterChip label="All" count={AUDITOR_DATA.length} active={tierFilter === null} onClick={() => { setTierFilter(null); setPage(1); }} />
            {["Bronze", "Silver", "Gold", "Diamond"].map(t => (
              <FilterChip key={t} label={t} count={tierCounts[t]} active={tierFilter === t} onClick={() => { setTierFilter(prev => prev === t ? null : t); setPage(1); }} />
            ))}

            <div style={{ width: 1, height: 20, background: BORDER, margin: "0 8px" }} />

            <span style={{ fontFamily: FONT, fontSize: 11, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 4 }}>Status</span>
            <FilterChip label="All" active={statusFilter === null} onClick={() => { setStatusFilter(null); setPage(1); }} />
            <FilterChip label="Active" active={statusFilter === "active"} onClick={() => { setStatusFilter(prev => prev === "active" ? null : "active"); setPage(1); }} />
            <FilterChip label="Suspended" active={statusFilter === "suspended"} onClick={() => { setStatusFilter(prev => prev === "suspended" ? null : "suspended"); setPage(1); }} />
            <FilterChip label="Slashed" active={statusFilter === "slashed"} onClick={() => { setStatusFilter(prev => prev === "slashed" ? null : "slashed"); setPage(1); }} />
          </div>
        </div>

        {/* Data Table */}
        <div style={{
          maxWidth: 1200, margin: "-1px auto 0", background: SURFACE,
          border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "clip",
        }}>
          {/* Table Header */}
          <div style={{
            display: "grid", gridTemplateColumns: GRID,
            padding: "12px 20px", background: SURFACE,
            borderBottom: `1px solid ${BORDER}`,
            fontFamily: FONT, fontSize: 10, color: TEXT_MUTED,
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            <SortHeader label="Commitment" sortKey="commitment" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <span>Tier</span>
            <SortHeader label="Stake" sortKey="stake" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Audits" sortKey="attestations" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Reputation" sortKey="reputation" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <span>Status</span>
            <span>Levels</span>
            <span />
          </div>

          {/* Rows */}
          {pageData.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontFamily: FONT, fontSize: 14, color: TEXT_DIM, marginBottom: 6 }}>No auditors found</div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: TEXT_MUTED }}>Try adjusting your search or filters</div>
            </div>
          ) : (
            pageData.map((auditor, i) => (
              <AuditorRow
                key={auditor.commitment}
                auditor={auditor}
                index={i}
                expanded={expandedId === auditor.commitment}
                onToggle={() => setExpandedId(prev => prev === auditor.commitment ? null : auditor.commitment)}
              />
            ))
          )}

          {/* Pagination */}
          {filtered.length > 0 && (
            <Pagination page={currentPage} totalPages={totalPages} onPage={setPage} />
          )}
        </div>

        {/* Bottom info bar */}
        <div style={{
          maxWidth: 1200, margin: "12px auto 0", display: "flex",
          justifyContent: "space-between", padding: "0 4px",
        }}>
          <span style={{ fontFamily: FONT, fontSize: 11, color: TEXT_MUTED }}>
            Showing {Math.min((currentPage - 1) * PER_PAGE + 1, filtered.length)}-{Math.min(currentPage * PER_PAGE, filtered.length)} of {filtered.length} auditors
          </span>
          <span style={{ fontFamily: FONT, fontSize: 11, color: TEXT_MUTED }}>
            Base Mainnet &middot; Registry 0xBED5...7E1D
          </span>
        </div>

        {/* ── CTA Section ──────────────────────────── */}
        <div style={{
          padding: "80px 48px 100px", maxWidth: 1200, margin: "0 auto",
          textAlign: "center", position: "relative",
        }}>
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: 500, height: 500,
            background: `radial-gradient(circle, rgba(255,51,102,0.04) 0%, transparent 60%)`,
            pointerEvents: "none",
          }} />
          <h2 style={{
            fontFamily: FONT_HEAD, fontSize: 28, fontWeight: 800,
            color: TEXT, letterSpacing: "-0.02em", margin: "0 0 12px",
            position: "relative",
          }}>
            Become an auditor
          </h2>
          <p style={{
            fontFamily: FONT, fontSize: 14, color: TEXT_DIM,
            maxWidth: 480, margin: "0 auto 28px", lineHeight: 1.7,
          }}>
            Stake ETH, audit skills anonymously, and earn reputation on-chain. No KYC. No identity. Just cryptographic proof of expertise.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", position: "relative" }}>
            <button style={{
              background: ACCENT, color: BG, border: "none", borderRadius: 8,
              padding: "14px 32px", fontSize: 14, fontWeight: 700, cursor: "pointer",
              fontFamily: FONT, transition: "opacity 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >Register as Auditor</button>
            <button style={{
              background: "transparent", color: TEXT, border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: "14px 32px", fontSize: 14, fontWeight: 700,
              cursor: "pointer", fontFamily: FONT, transition: "border-color 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = ACCENT)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
            >Read Documentation &rarr;</button>
          </div>
        </div>

        {/* ── Footer ───────────────────────────────── */}
        <footer style={{
          padding: "40px 48px 32px", borderTop: `1px solid ${BORDER}`,
          maxWidth: 1200, margin: "0 auto",
          display: "flex", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 20, height: 20, border: `2px solid ${ACCENT}`, borderRadius: 3,
              transform: "rotate(45deg)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 5, height: 5, background: ACCENT, borderRadius: 1 }} />
            </div>
            <span style={{ fontFamily: FONT_HEAD, fontSize: 13, fontWeight: 700, color: TEXT }}>AEGIS</span>
            <span style={{ fontFamily: FONT, fontSize: 11, color: TEXT_MUTED, marginLeft: 8 }}>
              &copy; 2026 AEGIS PROTOCOL
            </span>
          </div>
          <span style={{ fontFamily: FONT, fontSize: 11, color: TEXT_MUTED }}>
            DEPLOYED ON BASE L2
          </span>
        </footer>
      </div>
    </>
  );
}
