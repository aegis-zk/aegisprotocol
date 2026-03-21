import { useState, useEffect, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { formatEther } from "viem";
import { registryAbi } from "../abi";
import { REGISTRY_ADDRESS } from "../config";

const ACCENT = "#FF3366";
const SURFACE = "#131316";
const SURFACE2 = "#1A1A1F";
const BORDER = "#2A2A30";
const TEXT = "#E4E4E7";
const TEXT_DIM = "#71717A";
const TEXT_MUTED = "#52525B";

const FONT_HEAD = "'Orbitron', sans-serif";
const FONT = "'Space Mono', monospace";

const PER_PAGE = 10;
const INDEXER_URL = import.meta.env.VITE_INDEXER_URL ?? "/api";

// ── Helpers ─────────────────────────────────────────────

function truncAddr(addr: string) {
  return addr.length >= 10 ? `${addr.slice(0, 6)}\u2026${addr.slice(-4)}` : addr;
}

function RefStatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div style={{
      flex: 1, background: SURFACE, border: `1px solid ${accent ? ACCENT + "30" : BORDER}`,
      borderRadius: 10, padding: "18px 20px",
      animation: "fadeInUp 0.4s ease both",
    }}>
      <div style={{ fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 800, color: accent ? ACCENT : TEXT, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

// ── Data hooks ──────────────────────────────────────────

interface ReferralStats {
  total_referrals: number;
  total_amount: string;
  topReferrers: { referrer: string; referral_count: number; total_earned: string }[];
}

interface ReferralEntry {
  referee: string;
  skill_hash: string;
  amount: string;
  tx_hash: string;
  created_at: string;
}

function useReferralStats() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${INDEXER_URL}/referrals/stats`)
      .then(r => r.json())
      .then(json => {
        if (json.data) {
          setStats({
            total_referrals: json.data.totals?.total_referrals ?? 0,
            total_amount: json.data.totals?.total_amount ?? "0",
            topReferrers: json.data.topReferrers ?? [],
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading };
}

function useReferralHistory(address: string | undefined, page: number) {
  const [entries, setEntries] = useState<ReferralEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) { setEntries([]); setTotal(0); return; }
    setLoading(true);
    fetch(`${INDEXER_URL}/referrals/${address}?limit=${PER_PAGE}&offset=${(page - 1) * PER_PAGE}`)
      .then(r => r.json())
      .then(json => {
        setEntries(json.data ?? []);
        setTotal(json.count ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address, page]);

  return { entries, total, loading };
}

// ── Withdraw Panel ──────────────────────────────────────

function WithdrawPanel() {
  const { address } = useAccount();
  const { data: earnings, refetch } = useReadContract({
    address: REGISTRY_ADDRESS[8453],
    abi: registryAbi,
    functionName: "getReferralEarnings",
    args: address ? [address] : undefined,
    chainId: 8453,
    query: { enabled: !!address },
  });

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleWithdraw = useCallback(() => {
    writeContract({
      address: REGISTRY_ADDRESS[8453],
      abi: registryAbi,
      functionName: "withdrawReferralEarnings",
      chainId: 8453,
    });
  }, [writeContract]);

  useEffect(() => {
    if (isSuccess) refetch();
  }, [isSuccess, refetch]);

  const balance = earnings ? formatEther(earnings as bigint) : "0";
  const hasBalance = earnings && (earnings as bigint) > 0n;

  return (
    <div style={{
      background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10,
      padding: "24px", marginBottom: 24,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: FONT_HEAD, fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 8 }}>
            Your Referral Balance
          </div>
          <div style={{ fontFamily: FONT_HEAD, fontSize: 28, fontWeight: 800, color: hasBalance ? "#4ADE80" : TEXT_DIM }}>
            {parseFloat(balance).toFixed(6)} ETH
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>
            Available to withdraw from on-chain referral earnings
          </div>
        </div>
        <button
          onClick={handleWithdraw}
          disabled={!hasBalance || isPending || isConfirming}
          style={{
            padding: "12px 28px", borderRadius: 8, border: "none",
            background: hasBalance ? ACCENT : SURFACE2,
            color: hasBalance ? "#fff" : TEXT_MUTED,
            fontFamily: FONT_HEAD, fontSize: 13, fontWeight: 700,
            cursor: hasBalance ? "pointer" : "not-allowed",
            opacity: isPending || isConfirming ? 0.6 : 1,
            transition: "opacity 0.12s",
          }}
        >
          {isPending ? "Confirm..." : isConfirming ? "Withdrawing..." : "Withdraw"}
        </button>
      </div>

      {isSuccess && hash && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#4ADE80" }}>
          Withdrawal successful!{" "}
          <a href={`https://basescan.org/tx/${hash}`} target="_blank" rel="noreferrer"
            style={{ color: ACCENT, textDecoration: "underline" }}>
            View on BaseScan
          </a>
        </div>
      )}
      {error && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#F87171" }}>
          {error.message.includes("User rejected") ? "Transaction rejected" : "Withdrawal failed"}
        </div>
      )}
    </div>
  );
}

// ── Referral Link Section ───────────────────────────────

function ReferralLinkBox() {
  const { address } = useAccount();
  const [copied, setCopied] = useState(false);

  const refLink = address
    ? `https://aegisprotocol.tech/#/app?ref=${address}`
    : null;

  const handleCopy = useCallback(() => {
    if (!refLink) return;
    navigator.clipboard.writeText(refLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [refLink]);

  if (!address) return null;

  return (
    <div style={{
      background: SURFACE, border: `1px solid ${ACCENT}30`, borderRadius: 10,
      padding: "16px 20px", marginBottom: 24,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ fontSize: 11, color: TEXT_DIM, whiteSpace: "nowrap" }}>Your referral link:</div>
      <div style={{
        flex: 1, fontFamily: FONT, fontSize: 12, color: ACCENT,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {refLink}
      </div>
      <button
        onClick={handleCopy}
        style={{
          padding: "6px 16px", borderRadius: 6, border: `1px solid ${BORDER}`,
          background: copied ? "#4ADE8020" : SURFACE2,
          color: copied ? "#4ADE80" : TEXT_DIM,
          fontFamily: FONT, fontSize: 11, cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

// ── Pagination ──────────────────────────────────────────

function PageBtn({ label, active, onClick, disabled }: { label: string; active?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        width: 32, height: 32, borderRadius: 6,
        background: active ? ACCENT + "18" : "transparent",
        border: `1px solid ${active ? ACCENT + "40" : BORDER}`,
        color: active ? ACCENT : disabled ? TEXT_MUTED : TEXT_DIM,
        fontSize: 12, cursor: disabled ? "default" : "pointer",
        transition: "all 0.12s",
      }}
    >{label}</button>
  );
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const pages: number[] = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) pages.push(i);
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 4, padding: "16px" }}>
      <PageBtn label="\u2190" onClick={() => onPage(page - 1)} disabled={page <= 1} />
      {pages[0] > 1 && <><PageBtn label="1" onClick={() => onPage(1)} /><span style={{ color: TEXT_MUTED, lineHeight: "32px" }}>&hellip;</span></>}
      {pages.map(p => <PageBtn key={p} label={String(p)} active={p === page} onClick={() => onPage(p)} />)}
      {pages[pages.length - 1] < totalPages && <><span style={{ color: TEXT_MUTED, lineHeight: "32px" }}>&hellip;</span><PageBtn label={String(totalPages)} onClick={() => onPage(totalPages)} /></>}
      <PageBtn label="\u2192" onClick={() => onPage(page + 1)} disabled={page >= totalPages} />
    </div>
  );
}

// ── Exported Content Component (used as Dashboard tab) ──

export function ReferralTab() {
  const { address, isConnected } = useAccount();
  const { stats, loading: statsLoading } = useReferralStats();
  const [historyPage, setHistoryPage] = useState(1);
  const { entries, total, loading: historyLoading } = useReferralHistory(address, historyPage);

  const totalHistoryPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const { data: earnings } = useReadContract({
    address: REGISTRY_ADDRESS[8453],
    abi: registryAbi,
    functionName: "getReferralEarnings",
    args: address ? [address] : undefined,
    chainId: 8453,
    query: { enabled: !!address },
  });

  const yourEarnings = earnings ? parseFloat(formatEther(earnings as bigint)).toFixed(6) : "\u2014";
  const totalAmount = stats ? parseFloat(stats.total_amount).toFixed(4) : "0";

  return (
    <>
      {/* Referral Link */}
      <ReferralLinkBox />

      {/* Stat Cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <RefStatCard
          label="Total Referral Rewards"
          value={statsLoading ? "\u2014" : `${totalAmount} ETH`}
          sub="Paid out across all referrers"
          accent
        />
        <RefStatCard
          label="Total Referrals"
          value={statsLoading ? "\u2014" : String(stats?.total_referrals ?? 0)}
          sub="Skills referred to date"
        />
        <RefStatCard
          label="Your Earnings"
          value={isConnected ? `${yourEarnings} ETH` : "\u2014"}
          sub={isConnected ? "Withdrawable balance" : "Connect wallet to view"}
        />
      </div>

      {/* Withdraw Panel */}
      {isConnected && <WithdrawPanel />}

      {/* Leaderboard */}
      <div style={{
        background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10,
        overflow: "hidden", marginBottom: 24,
      }}>
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${BORDER}`,
          fontFamily: FONT_HEAD, fontSize: 14, fontWeight: 700, color: TEXT,
        }}>
          Top Referrers
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "50px 1fr 120px 140px", columnGap: 12,
          padding: "10px 20px", borderBottom: `1px solid ${BORDER}`,
          fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: TEXT_MUTED,
        }}>
          <span>Rank</span>
          <span>Address</span>
          <span>Referrals</span>
          <span>Total Earned</span>
        </div>

        {statsLoading ? (
          <div style={{ padding: "40px 20px", textAlign: "center", fontSize: 13, color: TEXT_DIM }}>
            Loading leaderboard...
          </div>
        ) : !stats?.topReferrers?.length ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 14, color: TEXT_DIM, fontWeight: 700, marginBottom: 4 }}>No referrers yet</div>
            <div style={{ fontSize: 12, color: TEXT_MUTED }}>Be the first to earn referral rewards</div>
          </div>
        ) : (
          stats.topReferrers.map((ref, i) => {
            const isYou = address && ref.referrer.toLowerCase() === address.toLowerCase();
            return (
              <div key={ref.referrer} style={{
                display: "grid", gridTemplateColumns: "50px 1fr 120px 140px", columnGap: 12,
                padding: "14px 20px", borderBottom: `1px solid ${BORDER}`,
                background: isYou ? ACCENT + "08" : "transparent",
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: i < 3 ? ACCENT : TEXT_DIM }}>
                  #{i + 1}
                </div>
                <div style={{ fontFamily: FONT, fontSize: 12, color: isYou ? ACCENT : TEXT }}>
                  {truncAddr(ref.referrer)}{isYou && <span style={{ fontSize: 10, color: ACCENT, marginLeft: 6 }}>(you)</span>}
                </div>
                <div style={{ fontSize: 13, color: TEXT }}>{ref.referral_count}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#4ADE80" }}>
                  {parseFloat(ref.total_earned).toFixed(4)} ETH
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Your Referral History */}
      {isConnected && (
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10,
          overflow: "hidden", marginBottom: 24,
        }}>
          <div style={{
            padding: "16px 20px", borderBottom: `1px solid ${BORDER}`,
            fontFamily: FONT_HEAD, fontSize: 14, fontWeight: 700, color: TEXT,
          }}>
            Your Referral History
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "120px 1fr 1fr 120px 60px", columnGap: 12,
            padding: "10px 20px", borderBottom: `1px solid ${BORDER}`,
            fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: TEXT_MUTED,
          }}>
            <span>Date</span>
            <span>Referee</span>
            <span>Skill Hash</span>
            <span>Amount</span>
            <span>Tx</span>
          </div>

          {historyLoading ? (
            <div style={{ padding: "40px 20px", textAlign: "center", fontSize: 13, color: TEXT_DIM }}>
              Loading history...
            </div>
          ) : entries.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 14, color: TEXT_DIM, fontWeight: 700, marginBottom: 4 }}>No referrals yet</div>
              <div style={{ fontSize: 12, color: TEXT_MUTED }}>Share your referral link to start earning</div>
            </div>
          ) : (
            entries.map((entry, i) => (
              <div key={`${entry.tx_hash}-${i}`} style={{
                display: "grid", gridTemplateColumns: "120px 1fr 1fr 120px 60px", columnGap: 12,
                padding: "14px 20px", borderBottom: `1px solid ${BORDER}`,
              }}>
                <div style={{ fontSize: 12, color: TEXT_DIM }}>
                  {new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
                <div style={{ fontFamily: FONT, fontSize: 12, color: TEXT }}>{truncAddr(entry.referee)}</div>
                <div style={{ fontFamily: FONT, fontSize: 12, color: TEXT_DIM }}>
                  {entry.skill_hash.slice(0, 10)}&hellip;{entry.skill_hash.slice(-4)}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#4ADE80" }}>
                  {parseFloat(entry.amount).toFixed(6)} ETH
                </div>
                <a href={`https://basescan.org/tx/${entry.tx_hash}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: ACCENT, textDecoration: "none" }}>
                  &#8599;
                </a>
              </div>
            ))
          )}

          {totalHistoryPages > 1 && <Pagination page={historyPage} totalPages={totalHistoryPages} onPage={setHistoryPage} />}
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: "12px 16px", borderRadius: 8,
        background: SURFACE, border: `1px solid ${BORDER}`,
        fontSize: 11, color: TEXT_MUTED, display: "flex", justifyContent: "space-between",
      }}>
        <span>Referral split: 50% of registration fee (0.0005 ETH per referral) &bull; Pull-pattern withdrawal</span>
        <span>Data from AEGIS Indexer</span>
      </div>
    </>
  );
}
