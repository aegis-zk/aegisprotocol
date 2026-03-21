import { useState } from 'react';
import { useReadContract } from 'wagmi';
import { formatEther, type Hex } from 'viem';
import { registryAbi } from '../abi';
import { useRegistryAddress } from '../hooks/useRegistryAddress';

export function Status() {
  const registryAddress = useRegistryAddress();
  const [commitment, setCommitment] = useState('');
  const [queryCommitment, setQueryCommitment] = useState<Hex | undefined>();

  const { data: reputation, isLoading, error } = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: 'getAuditorReputation',
    args: queryCommitment ? [queryCommitment] : undefined,
    query: { enabled: !!queryCommitment && !!registryAddress },
  });

  const { data: activeDisputes } = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: 'getActiveDisputeCount',
    args: queryCommitment ? [queryCommitment] : undefined,
    query: { enabled: !!queryCommitment && !!registryAddress },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!commitment) return;
    const hex = (commitment.startsWith('0x') ? commitment : `0x${commitment}`) as Hex;
    setQueryCommitment(hex);
  }

  const [score, totalStake, attestationCount] = (reputation ?? [0n, 0n, 0n]) as [bigint, bigint, bigint];
  const hasData = queryCommitment && !isLoading && !error && (totalStake > 0n || attestationCount > 0n);
  const notFound = queryCommitment && !isLoading && !error && totalStake === 0n && attestationCount === 0n;

  return (
    <div>
      <h2 className="page-title">Auditor Status</h2>
      <p className="page-desc">
        Look up any auditor's reputation by their commitment hash. View stake, score, and attestation count.
      </p>

      <div className="card mb-2">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Auditor Commitment (bytes32)</label>
            <input
              type="text"
              className="form-input"
              placeholder="0x1a65fb219ffd58992a8c16d3038ef77e..."
              value={commitment}
              onChange={(e) => setCommitment(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={!commitment} style={{ whiteSpace: 'nowrap' }}>
            Look Up
          </button>
        </form>
      </div>

      {isLoading && (
        <div className="alert alert-info">
          <span className="spinner" /> Fetching auditor data...
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          Error: {error.message.length > 120 ? error.message.slice(0, 120) + '...' : error.message}
        </div>
      )}

      {notFound && (
        <div className="alert alert-info">
          Auditor not found or not registered with this commitment.
        </div>
      )}

      {hasData && (
        <div>
          <h3 style={{ color: 'var(--text-heading)', marginBottom: '1rem' }}>
            Auditor Reputation
          </h3>

          <div className="card-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-label">Reputation Score</div>
              <div className="stat-value">{score.toString()}</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Total Stake</div>
              <div className="stat-value">{Number(formatEther(totalStake)).toFixed(4)} <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>ETH</span></div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Attestations</div>
              <div className="stat-value">{attestationCount.toString()}</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Active Disputes</div>
              <div className="stat-value" style={{ color: activeDisputes && (activeDisputes as bigint) > 0n ? 'var(--error)' : undefined }}>
                {activeDisputes !== undefined ? (activeDisputes as bigint).toString() : '—'}
              </div>
            </div>
          </div>

          <div className="card">
            <h4 style={{ color: 'var(--text-heading)', marginBottom: '0.5rem', fontSize: '0.95rem' }}>Details</h4>
            <div style={{ fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <span className="text-muted">Commitment</span>
                <span className="mono" style={{ color: 'var(--accent)' }}>
                  {queryCommitment && queryCommitment.length > 16
                    ? `${queryCommitment.slice(0, 10)}...${queryCommitment.slice(-6)}`
                    : queryCommitment}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <span className="text-muted">Status</span>
                <span className="badge badge-success">Active</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                <span className="text-muted">Trust Tier</span>
                <span>
                  {score >= 100n ? '🏆 Gold'
                    : score >= 50n ? '🥈 Silver'
                      : score >= 10n ? '🥉 Bronze'
                        : '🔰 New'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
