import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { decodeEventLog, formatEther, type Hex } from 'viem';
import { registryAbi } from '../abi';
import { useRegistryAddress } from '../hooks/useRegistryAddress';
import { MIN_DISPUTE_BOND } from '../config';
import { TxStatus } from '../components/TxStatus';

const LEVEL_LABELS: Record<number, string> = {
  1: 'Level 1 — Automated',
  2: 'Level 2 — Static + Dynamic',
  3: 'Level 3 — Full Manual',
};

function truncateHex(hex: string): string {
  return hex.length > 16 ? `${hex.slice(0, 10)}...${hex.slice(-6)}` : hex;
}

function formatTimestamp(ts: bigint): string {
  if (ts === 0n) return '—';
  return new Date(Number(ts) * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function RevocationBadge({ skillHash, index }: { skillHash: Hex; index: number }) {
  const registryAddress = useRegistryAddress();
  const { data: revoked } = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: 'isAttestationRevoked',
    args: [skillHash, BigInt(index)],
    query: { enabled: !!registryAddress },
  });

  if (!revoked) return null;
  return (
    <span className="badge badge-error" style={{ fontWeight: 700, letterSpacing: '0.04em' }}>
      REVOKED
    </span>
  );
}

function VerifyButton({ skillHash, index }: { skillHash: Hex; index: number }) {
  const registryAddress = useRegistryAddress();
  const [checked, setChecked] = useState(false);

  const { data: valid, isLoading, refetch } = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: 'verifyAttestation',
    args: [skillHash, BigInt(index)],
    query: { enabled: false },
  });

  async function handleVerify() {
    const result = await refetch();
    if (result.data !== undefined) setChecked(true);
  }

  if (checked && valid !== undefined) {
    return (
      <span className={`badge ${valid ? 'badge-success' : 'badge-error'}`}>
        {valid ? '✓ Valid' : '✗ Invalid'}
      </span>
    );
  }

  return (
    <button
      className="btn btn-secondary btn-sm"
      onClick={handleVerify}
      disabled={isLoading}
      style={{ fontSize: '0.78rem' }}
    >
      {isLoading ? 'Verifying...' : 'Verify On-Chain'}
    </button>
  );
}

function DisputeForm({ skillHash, index, onClose }: { skillHash: Hex; index: number; onClose: () => void }) {
  const { isConnected } = useAccount();
  const registryAddress = useRegistryAddress();
  const [evidence, setEvidence] = useState('');

  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Extract disputeId from DisputeOpened event
  const disputeId = (() => {
    if (!receipt?.logs) return undefined;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: registryAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === 'DisputeOpened') {
          return (decoded.args as { disputeId: bigint }).disputeId;
        }
      } catch { /* not our event */ }
    }
    return undefined;
  })();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!registryAddress) return;

    const evidenceHex = evidence
      ? (evidence.startsWith('0x') ? evidence : `0x${evidence}`) as Hex
      : '0x' as Hex;

    writeContract({
      address: registryAddress,
      abi: registryAbi,
      functionName: 'openDispute',
      args: [skillHash, BigInt(index), evidenceHex],
      value: MIN_DISPUTE_BOND,
    });
  }

  if (!isConnected) {
    return (
      <div className="alert alert-info mt-1">
        Connect your wallet to open a dispute.
      </div>
    );
  }

  return (
    <div className="card mt-1" style={{ padding: '1rem', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h4 style={{ color: 'var(--text-heading)', fontSize: '0.9rem', margin: 0 }}>Open Dispute</h4>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onClose}
          style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
        >
          ✕
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
          <label className="form-label">Evidence (hex, optional)</label>
          <input
            type="text"
            className="form-input"
            placeholder="0x... (optional evidence data)"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
          />
          <p className="form-hint">
            Bond: {Number(MIN_DISPUTE_BOND) / 1e18} ETH — refunded if dispute succeeds.
          </p>
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={isPending || isConfirming}
          style={{ background: 'var(--error)' }}
        >
          {isPending ? 'Confirm in wallet...' : isConfirming ? 'Submitting...' : 'Submit Dispute'}
        </button>
      </form>
      <div className="mt-1">
        <TxStatus hash={hash} isPending={isPending} isConfirming={isConfirming} isSuccess={isSuccess} error={error} />
        {isSuccess && disputeId !== undefined && (
          <div className="alert alert-success" style={{ marginTop: '0.5rem' }}>
            Dispute #{disputeId.toString()} opened successfully.
          </div>
        )}
      </div>
    </div>
  );
}

export function Verify() {
  const registryAddress = useRegistryAddress();
  const [skillHash, setSkillHash] = useState('');
  const [queryHash, setQueryHash] = useState<Hex | undefined>();
  const [disputeIndex, setDisputeIndex] = useState<number | null>(null);

  const { data: attestations, isLoading, error } = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: 'getAttestations',
    args: queryHash ? [queryHash] : undefined,
    query: { enabled: !!queryHash && !!registryAddress },
  });

  const { data: metadataURI } = useReadContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: 'metadataURIs',
    args: queryHash ? [queryHash] : undefined,
    query: { enabled: !!queryHash && !!registryAddress },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!skillHash) return;
    const hex = (skillHash.startsWith('0x') ? skillHash : `0x${skillHash}`) as Hex;
    setQueryHash(hex);
    setDisputeIndex(null);
  }

  const attestationList = (attestations ?? []) as readonly {
    skillHash: Hex;
    auditCriteriaHash: Hex;
    zkProof: Hex;
    auditorCommitment: Hex;
    stakeAmount: bigint;
    timestamp: bigint;
    auditLevel: number;
  }[];

  return (
    <div>
      <h2 className="page-title">Verify a Skill</h2>
      <p className="page-desc">
        Look up attestations for any skill by its hash. Verify ZK proofs on-chain and open disputes if needed.
      </p>

      <div className="card mb-2">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Skill Hash (bytes32)</label>
            <input
              type="text"
              className="form-input"
              placeholder="0x0eba0c961970330401e4d801bb41e1d85a910c9878d552f5fc7a9d73ee11cb51"
              value={skillHash}
              onChange={(e) => setSkillHash(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={!skillHash} style={{ whiteSpace: 'nowrap' }}>
            Search
          </button>
        </form>
      </div>

      {isLoading && (
        <div className="alert alert-info">
          <span className="spinner" /> Fetching attestations...
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          Error: {error.message.length > 120 ? error.message.slice(0, 120) + '...' : error.message}
        </div>
      )}

      {queryHash && !isLoading && !error && attestationList.length === 0 && (
        <div className="alert alert-info">
          No attestations found for this skill hash.
        </div>
      )}

      {attestationList.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--text-heading)', margin: 0 }}>
              {attestationList.length} Attestation{attestationList.length !== 1 ? 's' : ''}
            </h3>
            {metadataURI && (
              <a
                href={metadataURI as string}
                target="_blank"
                rel="noopener noreferrer"
                className="badge badge-info"
                style={{ textDecoration: 'none' }}
              >
                Metadata
              </a>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {attestationList.map((att, i) => (
              <div key={i} className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                    Attestation #{i}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`badge ${att.auditLevel >= 3 ? 'badge-success' : att.auditLevel >= 2 ? 'badge-warning' : 'badge-info'}`}>
                      {LEVEL_LABELS[att.auditLevel] ?? `Level ${att.auditLevel}`}
                    </span>
                    {queryHash && <RevocationBadge skillHash={queryHash} index={i} />}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.88rem' }}>
                  <div>
                    <span className="text-muted">Auditor</span>
                    <div className="mono" style={{ color: 'var(--accent)', marginTop: '0.15rem' }}>
                      {truncateHex(att.auditorCommitment)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted">Criteria Hash</span>
                    <div className="mono" style={{ marginTop: '0.15rem' }}>
                      {truncateHex(att.auditCriteriaHash)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted">Stake</span>
                    <div style={{ fontWeight: 600, marginTop: '0.15rem' }}>
                      {formatEther(att.stakeAmount)} ETH
                    </div>
                  </div>
                  <div>
                    <span className="text-muted">Timestamp</span>
                    <div style={{ marginTop: '0.15rem' }}>
                      {formatTimestamp(att.timestamp)}
                    </div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span className="text-muted">Proof size</span>
                    <div className="mono" style={{ marginTop: '0.15rem' }}>
                      {(att.zkProof.length - 2) / 2} bytes
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  {queryHash && <VerifyButton skillHash={queryHash} index={i} />}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setDisputeIndex(disputeIndex === i ? null : i)}
                    style={{ fontSize: '0.78rem', color: 'var(--error)' }}
                  >
                    {disputeIndex === i ? 'Cancel Dispute' : '⚠ Dispute'}
                  </button>
                </div>

                {disputeIndex === i && queryHash && (
                  <DisputeForm
                    skillHash={queryHash}
                    index={i}
                    onClose={() => setDisputeIndex(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
