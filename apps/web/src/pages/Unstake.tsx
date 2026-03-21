import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther, parseEther, type Hex } from 'viem';
import { registryAbi } from '../abi';
import { useRegistryAddress } from '../hooks/useRegistryAddress';
import { UNSTAKE_COOLDOWN } from '../config';
import { TxStatus } from '../components/TxStatus';

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Ready';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function Unstake() {
  const { isConnected } = useAccount();
  const registryAddress = useRegistryAddress();

  const [commitment, setCommitment] = useState('');
  const [queryCommitment, setQueryCommitment] = useState<Hex | undefined>();
  const [unstakeAmount, setUnstakeAmount] = useState('0.01');
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // Tick every 30s for countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30000);
    return () => clearInterval(timer);
  }, []);

  // Read auditor reputation (for current stake)
  const { data: reputation } = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: 'getAuditorReputation',
    args: queryCommitment ? [queryCommitment] : undefined,
    query: { enabled: !!queryCommitment && !!registryAddress },
  });

  // Read active disputes
  const { data: activeDisputes } = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: 'getActiveDisputeCount',
    args: queryCommitment ? [queryCommitment] : undefined,
    query: { enabled: !!queryCommitment && !!registryAddress },
  });

  // Read existing unstake request
  const { data: unstakeRequest, refetch: refetchUnstake } = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: 'getUnstakeRequest',
    args: queryCommitment ? [queryCommitment] : undefined,
    query: { enabled: !!queryCommitment && !!registryAddress },
  });

  // Write hooks
  const { data: initHash, writeContract: writeInitiate, isPending: initPending, error: initError, reset: resetInit } = useWriteContract();
  const { isLoading: initConfirming, isSuccess: initSuccess } = useWaitForTransactionReceipt({ hash: initHash });

  const { data: completeHash, writeContract: writeComplete, isPending: completePending, error: completeError, reset: resetComplete } = useWriteContract();
  const { isLoading: completeConfirming, isSuccess: completeSuccess } = useWaitForTransactionReceipt({ hash: completeHash });

  const { data: cancelHash, writeContract: writeCancel, isPending: cancelPending, error: cancelError, reset: resetCancel } = useWriteContract();
  const { isLoading: cancelConfirming, isSuccess: cancelSuccess } = useWaitForTransactionReceipt({ hash: cancelHash });

  // Refetch unstake request after any successful tx
  useEffect(() => {
    if (initSuccess || completeSuccess || cancelSuccess) refetchUnstake();
  }, [initSuccess, completeSuccess, cancelSuccess, refetchUnstake]);

  const [, totalStake] = (reputation ?? [0n, 0n, 0n]) as [bigint, bigint, bigint];
  const disputeCount = (activeDisputes as bigint | undefined) ?? 0n;
  const hasDisputes = disputeCount > 0n;

  const request = unstakeRequest as { amount: bigint; unlockTimestamp: bigint } | undefined;
  const hasPendingUnstake = request && request.amount > 0n;
  const unlockTime = hasPendingUnstake ? Number(request.unlockTimestamp) : 0;
  const cooldownRemaining = unlockTime - now;
  const canComplete = hasPendingUnstake && cooldownRemaining <= 0 && !hasDisputes;

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!commitment) return;
    const hex = (commitment.startsWith('0x') ? commitment : `0x${commitment}`) as Hex;
    setQueryCommitment(hex);
    resetInit();
    resetComplete();
    resetCancel();
  }

  function handleInitiate(e: React.FormEvent) {
    e.preventDefault();
    if (!registryAddress || !queryCommitment) return;
    writeInitiate({
      address: registryAddress,
      abi: registryAbi,
      functionName: 'initiateUnstake',
      args: [queryCommitment, parseEther(unstakeAmount)],
    });
  }

  function handleComplete() {
    if (!registryAddress || !queryCommitment) return;
    writeComplete({
      address: registryAddress,
      abi: registryAbi,
      functionName: 'completeUnstake',
      args: [queryCommitment],
    });
  }

  function handleCancel() {
    if (!registryAddress || !queryCommitment) return;
    writeCancel({
      address: registryAddress,
      abi: registryAbi,
      functionName: 'cancelUnstake',
      args: [queryCommitment],
    });
  }

  if (!isConnected) {
    return (
      <div className="connect-prompt">
        <h3>Connect your wallet</h3>
        <p>You need a connected wallet to manage your auditor stake.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="page-title">Manage Stake</h2>
      <p className="page-desc">
        Initiate, complete, or cancel unstaking from your auditor position.
        Unstaking has a {UNSTAKE_COOLDOWN / 86400}-day cooldown period.
      </p>

      {/* Lookup form */}
      <div className="card mb-2">
        <form onSubmit={handleLookup} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
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

      {queryCommitment && totalStake > 0n && (
        <>
          {/* Current stake info */}
          <div className="card-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card">
              <div className="stat-label">Current Stake</div>
              <div className="stat-value">{Number(formatEther(totalStake)).toFixed(4)} <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>ETH</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Active Disputes</div>
              <div className="stat-value" style={{ color: hasDisputes ? 'var(--error)' : undefined }}>
                {disputeCount.toString()}
              </div>
            </div>
            {hasPendingUnstake && (
              <div className="stat-card">
                <div className="stat-label">Unstake Cooldown</div>
                <div className="stat-value" style={{ color: canComplete ? 'var(--success)' : 'var(--warning)' }}>
                  {formatCountdown(cooldownRemaining)}
                </div>
              </div>
            )}
          </div>

          {hasDisputes && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              Cannot unstake while {disputeCount.toString()} dispute{disputeCount > 1n ? 's are' : ' is'} active. Resolve disputes first.
            </div>
          )}

          {/* Phase 2: Pending unstake */}
          {hasPendingUnstake && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h3 style={{ color: 'var(--text-heading)', marginBottom: '0.75rem', fontSize: '1rem' }}>
                Pending Unstake
              </h3>
              <div style={{ fontSize: '0.88rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span className="text-muted">Amount</span>
                  <span style={{ fontWeight: 600 }}>{formatEther(request.amount)} ETH</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span className="text-muted">Unlocks At</span>
                  <span>{new Date(unlockTime * 1000).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                  <span className="text-muted">Status</span>
                  <span className={`badge ${canComplete ? 'badge-success' : 'badge-warning'}`}>
                    {canComplete ? 'Ready to complete' : `${formatCountdown(cooldownRemaining)} remaining`}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleComplete}
                  disabled={!canComplete || completePending || completeConfirming}
                >
                  {completePending ? 'Confirm in wallet...' : completeConfirming ? 'Completing...' : 'Complete Unstake'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleCancel}
                  disabled={cancelPending || cancelConfirming}
                  style={{ color: 'var(--error)' }}
                >
                  {cancelPending ? 'Confirm...' : cancelConfirming ? 'Cancelling...' : 'Cancel Unstake'}
                </button>
              </div>
              <div className="mt-1">
                <TxStatus hash={completeHash} isPending={completePending} isConfirming={completeConfirming} isSuccess={completeSuccess} error={completeError} />
                <TxStatus hash={cancelHash} isPending={cancelPending} isConfirming={cancelConfirming} isSuccess={cancelSuccess} error={cancelError} />
              </div>
            </div>
          )}

          {/* Phase 1: Initiate unstake */}
          {!hasPendingUnstake && (
            <div className="card">
              <h3 style={{ color: 'var(--text-heading)', marginBottom: '0.75rem', fontSize: '1rem' }}>
                Initiate Unstake
              </h3>
              <form onSubmit={handleInitiate}>
                <div className="form-group">
                  <label className="form-label">Amount to Unstake (ETH)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0.01"
                    step="0.001"
                    min="0.001"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    required
                  />
                  <p className="form-hint">
                    Max: {Number(formatEther(totalStake)).toFixed(4)} ETH. After initiating, you must wait {UNSTAKE_COOLDOWN / 86400} days before completing.
                  </p>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={hasDisputes || initPending || initConfirming || !unstakeAmount}
                >
                  {initPending ? 'Confirm in wallet...' : initConfirming ? 'Initiating...' : 'Initiate Unstake'}
                </button>
              </form>
              <div className="mt-2">
                <TxStatus hash={initHash} isPending={initPending} isConfirming={initConfirming} isSuccess={initSuccess} error={initError} />
              </div>
            </div>
          )}
        </>
      )}

      {queryCommitment && totalStake === 0n && !hasPendingUnstake && (
        <div className="alert alert-info">
          No auditor found with this commitment, or stake is zero.
        </div>
      )}
    </div>
  );
}
