import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { NavConnectWallet } from "../components/NavConnectWallet";
import { useBounties, useProtocolStats, type BountyEntry } from "../hooks/useSubgraphData";
import { registryAbi } from "../abi";
import { REGISTRY_ADDRESS } from "../config";

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

const PER_PAGE = 10;

// ── Helpers ─────────────────────────────────────────────

function getBountyStatus(b: BountyEntry): "open" | "claimed" | "expired" | "reclaimed" {
  if (b.claimed) return "claimed";
  if (b.reclaimed) return "reclaimed";
  if (Number(b.expiresAt) <= Math.floor(Date.now() / 1000)) return "expired";
  return "open";
}

function formatTimeRemaining(expiresAt: string): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = Number(expiresAt);
  const diff = exp - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function truncAddr(addr: string) {
  return addr.length >= 10 ? `${addr.slice(0, 6)}\u2026${addr.slice(-4)}` : addr;
}

// ── Reusable Components (same style as Registry) ──────────

function FilterChip({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: active ? ACCENT + "18" : "transparent",
      border: `1px solid ${active ? ACCENT + "40" : BORDER}`,
      color: active ? ACCENT : TEXT_DIM,
      fontSize: 12, fontWeight: 400,
      padding: "5px 10px", borderRadius: 6, cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 6,
      transition: "all 0.12s ease",
    }}>
      {label}
      {count !== undefined && (
        <span style={{
          background: active ? ACCENT + "30" : SURFACE3,
          color: active ? ACCENT : TEXT_MUTED,
          fontSize: 10, fontWeight: 700,
          padding: "1px 6px", borderRadius: 10, minWidth: 18, textAlign: "center",
        }}>{count}</span>
      )}
    </button>
  );
}

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

function LevelDots({ level }: { level: number }) {
  const lvl = Math.min(3, Math.max(0, level)) as 0 | 1 | 2 | 3;
  if (lvl === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        {[1, 2, 3].map(n => (
          <div key={n} style={{ width: 7, height: 7, borderRadius: "50%", background: SURFACE3, border: `1px solid ${BORDER}` }} />
        ))}
        <span style={{ fontSize: 11, color: TEXT_MUTED, marginLeft: 4 }}>{"\u2014"}</span>
      </div>
    );
  }
  const fillColor = lvl === 3 ? ACCENT : lvl === 2 ? ACCENT2 : TEXT_DIM;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      {[1, 2, 3].map(n => (
        <div key={n} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: n <= lvl ? fillColor : SURFACE3,
          border: n <= lvl ? "none" : `1px solid ${BORDER}`,
        }} />
      ))}
      <span style={{ fontSize: 11, color: TEXT_DIM, marginLeft: 4 }}>L{lvl}</span>
    </div>
  );
}

function BountyStatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    open: { color: "#4ADE80", bg: "#4ADE8015" },
    claimed: { color: ACCENT, bg: ACCENT + "15" },
    expired: { color: TEXT_MUTED, bg: SURFACE3 },
    reclaimed: { color: "#FBBF24", bg: "#FBBF2415" },
  };
  const s = map[status] || map.expired;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
      color: s.color, background: s.bg, padding: "2px 6px", borderRadius: 4,
      textTransform: "uppercase", whiteSpace: "nowrap",
    }}>{status}</span>
  );
}

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

function PageBtn({ label, active, disabled, onClick }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: 32, height: 32, borderRadius: 6,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: active ? 700 : 400,
      background: active ? ACCENT + "20" : "transparent",
      border: active ? `1px solid ${ACCENT}40` : `1px solid transparent`,
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
      <span style={{ fontSize: 12, color: TEXT_MUTED }}>Page {page} of {totalPages}</span>
      <div style={{ display: "flex", gap: 4 }}>
        <PageBtn label={"\u2190"} disabled={page <= 1} onClick={() => onPage(page - 1)} />
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} style={{ width: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", color: TEXT_MUTED, fontSize: 12 }}>&hellip;</span>
          ) : (
            <PageBtn key={p} label={String(p)} active={p === page} onClick={() => onPage(p as number)} />
          )
        )}
        <PageBtn label={"\u2192"} disabled={page >= totalPages} onClick={() => onPage(page + 1)} />
      </div>
    </div>
  );
}

// ── Post Bounty Form ────────────────────────────────────────

function PostBountyForm() {
  const { isConnected } = useAccount();
  const { data: hash, writeContract, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const [skillHash, setSkillHash] = useState("");
  const [level, setLevel] = useState<number>(1);
  const [amount, setAmount] = useState("");

  if (!isConnected) {
    return (
      <div style={{
        background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10,
        padding: "40px 24px", textAlign: "center", marginBottom: 24,
      }}>
        <div style={{ fontSize: 13, color: TEXT_DIM, marginBottom: 8 }}>Connect your wallet to post a bounty</div>
      </div>
    );
  }

  const addr = REGISTRY_ADDRESS[8453] as `0x${string}`;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!skillHash || !amount) return;
    reset();
    writeContract({
      address: addr,
      abi: registryAbi,
      functionName: "postBounty",
      args: [skillHash as `0x${string}`, level],
      value: parseEther(amount),
    });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 6,
    background: SURFACE2, border: `1px solid ${BORDER}`, color: TEXT,
    fontFamily: FONT, fontSize: 13, outline: "none",
  };

  return (
    <form onSubmit={handleSubmit} style={{
      background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10,
      padding: "24px", marginBottom: 24,
    }}>
      <div style={{ fontFamily: FONT_HEAD, fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 16 }}>
        Post Bounty
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px auto", gap: 12, alignItems: "end" }}>
        <div>
          <label style={{ fontSize: 11, color: TEXT_DIM, display: "block", marginBottom: 4 }}>Skill Hash (bytes32)</label>
          <input
            style={inputStyle} placeholder="0x..." value={skillHash}
            onChange={e => setSkillHash(e.target.value)}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: TEXT_DIM, display: "block", marginBottom: 4 }}>Required Level</label>
          <select
            value={level} onChange={e => setLevel(Number(e.target.value))}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            <option value={1}>L1 Functional</option>
            <option value={2}>L2 Robust</option>
            <option value={3}>L3 Security</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: TEXT_DIM, display: "block", marginBottom: 4 }}>Amount (ETH)</label>
          <input
            type="number" step="0.001" min="0.001"
            style={inputStyle} placeholder="0.01" value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={isPending || isConfirming || !skillHash || !amount}
          style={{
            padding: "10px 20px", borderRadius: 6, border: "none",
            background: ACCENT, color: "#fff", fontFamily: FONT_HEAD,
            fontSize: 12, fontWeight: 700, cursor: "pointer",
            opacity: isPending || isConfirming ? 0.6 : 1,
            transition: "opacity 0.12s",
          }}
        >
          {isPending ? "Confirm..." : isConfirming ? "Posting..." : "Post Bounty"}
        </button>
      </div>

      {/* Status */}
      {isSuccess && hash && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#4ADE80" }}>
          Bounty posted!{" "}
          <a href={`https://basescan.org/tx/${hash}`} target="_blank" rel="noreferrer"
            style={{ color: ACCENT, textDecoration: "underline" }}>
            View on BaseScan
          </a>
        </div>
      )}
      {error && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#F87171" }}>
          {error.message.includes("User rejected") ? "Transaction rejected" : "Transaction failed"}
        </div>
      )}
    </form>
  );
}

// ── Bounty Row Grid ─────────────────────────────────────────

const GRID = "minmax(180px, 1.5fr) 120px 100px 80px 120px 80px 40px";

function BountyRow({ bounty, index }: { bounty: BountyEntry; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const status = getBountyStatus(bounty);
  const amountEth = formatEther(BigInt(bounty.amount));
  const dateStr = new Date(Number(bounty.timestamp) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div style={{ animation: `fadeInUp 0.4s ease ${index * 0.03}s both` }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "grid", gridTemplateColumns: GRID, columnGap: 12,
          padding: "14px 20px", borderBottom: expanded ? "none" : `1px solid ${BORDER}`,
          alignItems: "center", cursor: "pointer",
          background: expanded ? SURFACE2 : "transparent",
          transition: "background 0.12s",
        }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = SURFACE2; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = "transparent"; }}
      >
        {/* Skill */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{bounty.skillName || "Unknown Skill"}</div>
          <div style={{ fontFamily: FONT, fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>
            {bounty.skillHash.slice(0, 14)}&hellip;{bounty.skillHash.slice(-6)}
          </div>
        </div>
        {/* Publisher */}
        <div style={{ fontFamily: FONT, fontSize: 12, color: TEXT_DIM }}>{truncAddr(bounty.publisher)}</div>
        {/* Amount */}
        <div style={{ fontSize: 13, fontWeight: 700, color: "#4ADE80" }}>{parseFloat(amountEth).toFixed(4)} ETH</div>
        {/* Level */}
        <LevelDots level={bounty.requiredLevel} />
        {/* Expires */}
        <div style={{ fontSize: 11, color: status === "open" ? TEXT_DIM : TEXT_MUTED }}>
          {status === "open" ? formatTimeRemaining(bounty.expiresAt) : status === "expired" ? "Expired" : dateStr}
        </div>
        {/* Status */}
        <BountyStatusBadge status={status} />
        {/* Expand */}
        <div style={{
          fontSize: 14, color: TEXT_MUTED, textAlign: "center",
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.15s ease",
        }}>{"\u25BE"}</div>
      </div>

      {/* Expanded Detail Panel */}
      {expanded && (
        <div style={{
          background: SURFACE2, padding: "0 20px 20px", borderBottom: `1px solid ${BORDER}`,
          animation: "fadeInUp 0.25s ease",
        }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 20,
            padding: "16px 0", borderTop: `1px solid ${BORDER}`,
          }}>
            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Skill Hash</div>
              <div style={{ fontSize: 12, color: TEXT, wordBreak: "break-all", fontFamily: FONT }}>{bounty.skillHash}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Category</div>
              <div style={{ fontSize: 12, color: TEXT }}>{bounty.category || "Uncategorized"}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Expires At</div>
              <div style={{ fontSize: 12, color: TEXT }}>
                {new Date(Number(bounty.expiresAt) * 1000).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Transaction</div>
              <a href={`https://basescan.org/tx/${bounty.txHash}`} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, color: ACCENT, textDecoration: "none" }}>
                {bounty.txHash.slice(0, 10)}&hellip; &#8599;
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────

export function Bounties() {
  const navigate = useNavigate();
  const { bounties, loading } = useBounties();
  const { stats } = useProtocolStats();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState("amount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [showPostForm, setShowPostForm] = useState(false);

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  }

  const enriched = useMemo(() =>
    bounties.map(b => ({ ...b, status: getBountyStatus(b) })),
    [bounties]
  );

  const filtered = useMemo(() => {
    let result = enriched;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(b =>
        b.skillName.toLowerCase().includes(q) ||
        b.skillHash.toLowerCase().includes(q) ||
        b.publisher.toLowerCase().includes(q)
      );
    }
    if (levelFilter) result = result.filter(b => b.requiredLevel === levelFilter);
    if (statusFilter) result = result.filter(b => b.status === statusFilter);
    return result;
  }, [enriched, search, levelFilter, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "amount": cmp = Number(BigInt(a.amount) - BigInt(b.amount)); break;
        case "skill": cmp = a.skillName.localeCompare(b.skillName); break;
        case "level": cmp = a.requiredLevel - b.requiredLevel; break;
        case "expires": cmp = Number(a.expiresAt) - Number(b.expiresAt); break;
        default: cmp = Number(BigInt(a.amount) - BigInt(b.amount));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const paged = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Stats
  const totalEth = bounties.reduce((s, b) => s + Number(formatEther(BigInt(b.amount))), 0);
  const avgSize = bounties.length > 0 ? totalEth / bounties.length : 0;
  const statusCounts = enriched.reduce((acc, b) => { acc[b.status] = (acc[b.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: FONT }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;800&family=Space+Mono:wght@400;700&display=swap');
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        ::selection { background: ${ACCENT}40; color: ${TEXT}; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* Navbar */}
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
          }}>BOUNTIES</span>
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
              color: item.label === "Bounties" ? TEXT : TEXT_DIM,
              textDecoration: "none", fontSize: 13,
              fontWeight: item.label === "Bounties" ? 700 : 400,
              borderBottom: item.label === "Bounties" ? `2px solid ${ACCENT}` : "2px solid transparent",
              paddingBottom: 2, transition: "color 0.15s",
              cursor: item.label === "Bounties" ? "default" : "pointer",
            }}
              onClick={e => { e.preventDefault(); if (item.label !== "Bounties" && item.onClick) item.onClick(); }}
              onMouseEnter={e => { if (item.label !== "Bounties") (e.target as HTMLElement).style.color = TEXT; }}
              onMouseLeave={e => { if (item.label !== "Bounties") (e.target as HTMLElement).style.color = TEXT_DIM; }}
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
      <div style={{ paddingTop: 64, maxWidth: 1200, margin: "0 auto", padding: "88px 24px 40px" }}>
        {/* Header */}
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: TEXT_MUTED }}>AEGIS</span>
          <span style={{ fontSize: 12, color: TEXT_MUTED, margin: "0 6px" }}>/</span>
          <span style={{ fontSize: 12, color: TEXT_DIM }}>Bounties</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: FONT_HEAD, fontSize: 28, fontWeight: 800, color: TEXT, letterSpacing: "-0.02em" }}>
              Bounty Board
            </h1>
            <p style={{ fontSize: 13, color: TEXT_DIM, marginTop: 4 }}>
              Post bounties to incentivize skill audits. Auditors earn ETH for verifying AI agent skills.
            </p>
          </div>
          <button
            onClick={() => setShowPostForm(!showPostForm)}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "none",
              background: showPostForm ? SURFACE3 : ACCENT, color: showPostForm ? TEXT_DIM : "#fff",
              fontFamily: FONT_HEAD, fontSize: 12, fontWeight: 700, cursor: "pointer",
              transition: "all 0.12s",
            }}
          >
            {showPostForm ? "Cancel" : "+ Post Bounty"}
          </button>
        </div>

        {/* Post Form */}
        {showPostForm && <PostBountyForm />}

        {/* Stats */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <StatCard label="Total Bounties" value={String(stats.totalBounties)} sub="All time" />
          <StatCard label="Open Bounties" value={String(stats.openBounties)} sub="Available now" accent />
          <StatCard label="Total ETH Posted" value={totalEth.toFixed(3)} sub="Across all bounties" />
          <StatCard label="Avg Bounty Size" value={avgSize > 0 ? avgSize.toFixed(4) + " ETH" : "\u2014"} sub="Mean reward" />
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <FilterChip label="All" count={enriched.length} active={!statusFilter && !levelFilter} onClick={() => { setStatusFilter(null); setLevelFilter(null); setPage(1); }} />
          <span style={{ width: 1, background: BORDER, margin: "0 4px" }} />
          <FilterChip label="Open" count={statusCounts.open || 0} active={statusFilter === "open"} onClick={() => { setStatusFilter(statusFilter === "open" ? null : "open"); setPage(1); }} />
          <FilterChip label="Claimed" count={statusCounts.claimed || 0} active={statusFilter === "claimed"} onClick={() => { setStatusFilter(statusFilter === "claimed" ? null : "claimed"); setPage(1); }} />
          <FilterChip label="Expired" count={statusCounts.expired || 0} active={statusFilter === "expired"} onClick={() => { setStatusFilter(statusFilter === "expired" ? null : "expired"); setPage(1); }} />
          <span style={{ width: 1, background: BORDER, margin: "0 4px" }} />
          <FilterChip label="L1" count={enriched.filter(b => b.requiredLevel === 1).length} active={levelFilter === 1} onClick={() => { setLevelFilter(levelFilter === 1 ? null : 1); setPage(1); }} />
          <FilterChip label="L2" count={enriched.filter(b => b.requiredLevel === 2).length} active={levelFilter === 2} onClick={() => { setLevelFilter(levelFilter === 2 ? null : 2); setPage(1); }} />
          <FilterChip label="L3" count={enriched.filter(b => b.requiredLevel === 3).length} active={levelFilter === 3} onClick={() => { setLevelFilter(levelFilter === 3 ? null : 3); setPage(1); }} />
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TEXT_MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder="Search by skill name, hash, or publisher..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: "100%", padding: "10px 12px 10px 40px", borderRadius: 8,
              background: SURFACE, border: `1px solid ${BORDER}`, color: TEXT,
              fontFamily: FONT, fontSize: 13, outline: "none",
            }}
          />
        </div>

        {/* Table */}
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
          {/* Header */}
          <div style={{
            display: "grid", gridTemplateColumns: GRID, columnGap: 12,
            padding: "12px 20px", borderBottom: `1px solid ${BORDER}`,
            fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            <SortHeader label="Skill" sortKey="skill" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <span style={{ color: TEXT_MUTED }}>Publisher</span>
            <SortHeader label="Amount" sortKey="amount" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Level" sortKey="level" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <SortHeader label="Expires" sortKey="expires" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            <span style={{ color: TEXT_MUTED }}>Status</span>
            <span />
          </div>

          {/* Rows */}
          {loading ? (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: TEXT_DIM, animation: "fadeInUp 0.4s ease" }}>Loading bounties...</div>
            </div>
          ) : paged.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>&#x1F3AF;</div>
              <div style={{ fontSize: 14, color: TEXT_DIM, fontWeight: 700, marginBottom: 4 }}>
                {search || statusFilter || levelFilter ? "No matching bounties" : "No bounties yet"}
              </div>
              <div style={{ fontSize: 12, color: TEXT_MUTED }}>
                {search || statusFilter || levelFilter
                  ? "Try adjusting your filters"
                  : "Be the first to post a bounty and incentivize auditors"}
              </div>
            </div>
          ) : (
            paged.map((b, i) => <BountyRow key={b.id} bounty={b} index={i} />)
          )}

          {/* Pagination */}
          {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPage={setPage} />}
        </div>

        {/* Footer info */}
        <div style={{
          marginTop: 16, padding: "12px 16px", borderRadius: 8,
          background: SURFACE, border: `1px solid ${BORDER}`,
          fontSize: 11, color: TEXT_MUTED, display: "flex", justifyContent: "space-between",
        }}>
          <span>Min bounty: 0.001 ETH &bull; Expires after 30 days &bull; 5% protocol fee on claim</span>
          <span>Data from AEGIS Subgraph v0.2.0</span>
        </div>
      </div>
    </div>
  );
}
