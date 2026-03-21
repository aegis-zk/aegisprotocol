import { useState, useEffect } from 'react';
import { AUDIT_QUEUE_URL } from '../config';

interface HealthData {
  status: string;
  version: string;
  chain: string;
  auditor: string;
  uptime: number;
}

interface StatsData {
  total: number;
  byState: Record<string, number>;
  bountyTaskCount: number;
  totalBountyWei: string;
  startedAt: string;
}

const STATE_LABELS: Record<string, { label: string; color: string }> = {
  discovered: { label: 'Discovered', color: 'var(--text-muted)' },
  claimed: { label: 'Claimed', color: 'var(--accent)' },
  auditing: { label: 'Auditing', color: 'var(--warning)' },
  'proof-generating': { label: 'Proving', color: '#a78bfa' },
  submitting: { label: 'Submitting', color: '#60a5fa' },
  verified: { label: 'Verified', color: 'var(--success)' },
  skipped: { label: 'Skipped', color: 'var(--text-muted)' },
  failed: { label: 'Failed', color: 'var(--error)' },
};

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function AuditQueue() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        const [healthRes, statsRes] = await Promise.all([
          fetch(`${AUDIT_QUEUE_URL}/health`, { signal: AbortSignal.timeout(5000) }),
          fetch(`${AUDIT_QUEUE_URL}/stats`, { signal: AbortSignal.timeout(5000) }),
        ]);
        if (!cancelled) {
          setHealth(await healthRes.json());
          setStats(await statsRes.json());
          setOffline(false);
        }
      } catch {
        if (!cancelled) setOffline(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (loading) {
    return (
      <div>
        <h2 className="page-title">Audit Queue</h2>
        <div className="alert alert-info">
          <span className="spinner" /> Connecting to audit queue...
        </div>
      </div>
    );
  }

  if (offline) {
    return (
      <div>
        <h2 className="page-title">Audit Queue</h2>
        <p className="page-desc">
          Monitor the autonomous audit queue that processes skill listings and generates ZK proofs.
        </p>
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>&#x1F6AB;</div>
          <h3 style={{ color: 'var(--text-heading)', marginBottom: '0.5rem' }}>Queue Offline</h3>
          <p className="text-muted" style={{ fontSize: '0.88rem' }}>
            The audit queue service is not reachable. It may be down for maintenance or not yet deployed.
          </p>
          <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: '0.5rem' }}>
            Endpoint: {AUDIT_QUEUE_URL}
          </p>
        </div>
      </div>
    );
  }

  const bountyEth = stats?.totalBountyWei
    ? (Number(BigInt(stats.totalBountyWei)) / 1e18).toFixed(4)
    : '0';

  return (
    <div>
      <h2 className="page-title">Audit Queue</h2>
      <p className="page-desc">
        Monitor the autonomous audit queue that processes skill listings and generates ZK proofs.
      </p>

      {/* Status cards */}
      <div className="card-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Status</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {health?.status ?? 'Unknown'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Uptime</div>
          <div className="stat-value">{health ? formatUptime(health.uptime) : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Tasks</div>
          <div className="stat-value">{stats?.total ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Bounty Value</div>
          <div className="stat-value">{bountyEth} <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>ETH</span></div>
        </div>
      </div>

      {/* Task breakdown */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--text-heading)', marginBottom: '1rem', fontSize: '1rem' }}>Task Pipeline</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {Object.entries(STATE_LABELS).map(([state, { label, color }]) => {
            const count = stats?.byState?.[state] ?? 0;
            const pct = stats && stats.total > 0 ? (count / stats.total) * 100 : 0;
            return (
              <div key={state} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: 100, fontSize: '0.82rem', color }}>{label}</span>
                <div style={{
                  flex: 1, height: 8, background: 'var(--bg)',
                  borderRadius: 4, overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.max(pct, count > 0 ? 2 : 0)}%`,
                    height: '100%', background: color, borderRadius: 4,
                    transition: 'width 0.3s',
                  }} />
                </div>
                <span style={{ width: 40, textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Details */}
      <div className="card">
        <h3 style={{ color: 'var(--text-heading)', marginBottom: '0.75rem', fontSize: '1rem' }}>Details</h3>
        <div style={{ fontSize: '0.88rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
            <span className="text-muted">Version</span>
            <span>{health?.version ?? '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
            <span className="text-muted">Chain</span>
            <span>{health?.chain ?? '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
            <span className="text-muted">Auditor</span>
            <span className="mono" style={{ color: 'var(--accent)', fontSize: '0.82rem' }}>
              {health?.auditor ? `${health.auditor.slice(0, 10)}...${health.auditor.slice(-6)}` : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
            <span className="text-muted">Bounty Tasks</span>
            <span>{stats?.bountyTaskCount ?? 0}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
            <span className="text-muted">Started</span>
            <span>{stats?.startedAt ? new Date(stats.startedAt).toLocaleString() : '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
