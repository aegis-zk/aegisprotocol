import { useState, useMemo } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, type Hex } from 'viem';
import { registryAbi } from '../abi';
import { useRegistryAddress } from '../hooks/useRegistryAddress';
import { REGISTRATION_FEE } from '../config';
import { TxStatus } from '../components/TxStatus';

const AUDIT_LEVELS = [
  { value: 1, label: 'Level 1 — Automated scan' },
  { value: 2, label: 'Level 2 — Static + dynamic analysis' },
  { value: 3, label: 'Level 3 — Full manual audit' },
];

export function RegisterSkill() {
  const { isConnected } = useAccount();
  const registryAddress = useRegistryAddress();

  // Parse referrer from URL query params (?ref=0x...)
  const referrer = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    return ref && /^0x[a-fA-F0-9]{40}$/.test(ref) ? ref as Hex : null;
  }, []);

  const [skillHash, setSkillHash] = useState('');
  const [criteriaHash, setCriteriaHash] = useState('');
  const [auditorCommitment, setAuditorCommitment] = useState('');
  const [auditLevel, setAuditLevel] = useState(1);
  const [proof, setProof] = useState('');
  const [metadataURI, setMetadataURI] = useState('');

  const { data: hash, writeContract, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function ensureHex(v: string): Hex {
    return (v.startsWith('0x') ? v : `0x${v}`) as Hex;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!registryAddress) return;

    // Build the public inputs array from the form fields
    // Order must match the circuit: [skillHash, criteriaHash, auditLevel, auditorCommitment]
    const auditLevelHex = ('0x' + auditLevel.toString(16).padStart(64, '0')) as Hex;
    const publicInputs: Hex[] = [
      ensureHex(skillHash),
      ensureHex(criteriaHash),
      auditLevelHex,
      ensureHex(auditorCommitment),
    ];

    writeContract({
      address: registryAddress,
      abi: registryAbi,
      functionName: 'registerSkill',
      args: [
        ensureHex(skillHash),
        metadataURI,
        ensureHex(proof),
        publicInputs,
        ensureHex(auditorCommitment),
        auditLevel,
        '0x0000000000000000000000000000000000000000', // bountyRecipient
        referrer ?? '0x0000000000000000000000000000000000000000', // referrer
      ],
      value: REGISTRATION_FEE,
    });
  }

  if (!isConnected) {
    return (
      <div className="connect-prompt">
        <h3>Connect your wallet</h3>
        <p>You need a connected wallet to submit a skill attestation.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="page-title">Submit a Skill</h2>
      <p className="page-desc">
        Register an AI agent skill with a ZK-verified attestation proof.
        The proof validates the audit was performed correctly without revealing source code.
      </p>

      {referrer && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '3px solid #00ff88', padding: '0.75rem 1rem' }}>
          <span style={{ color: '#00ff88', fontWeight: 600 }}>Referred by</span>{' '}
          <span className="mono" style={{ fontSize: '0.82rem' }}>
            {referrer.slice(0, 6)}...{referrer.slice(-4)}
          </span>
          <span style={{ color: '#888', marginLeft: '0.5rem', fontSize: '0.82rem' }}>
            — they'll earn 50% of the registration fee
          </span>
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Skill Hash (bytes32)</label>
            <input
              type="text"
              className="form-input"
              placeholder="0x0eba0c96..."
              value={skillHash}
              onChange={(e) => setSkillHash(e.target.value)}
              required
            />
            <p className="form-hint">Keccak-256 hash of the skill/plugin code.</p>
          </div>

          <div className="form-group">
            <label className="form-label">Audit Criteria Hash (bytes32)</label>
            <input
              type="text"
              className="form-input"
              placeholder="0x1c5562cc..."
              value={criteriaHash}
              onChange={(e) => setCriteriaHash(e.target.value)}
              required
            />
            <p className="form-hint">Hash of the audit criteria used for this review.</p>
          </div>

          <div className="form-group">
            <label className="form-label">Auditor Commitment (bytes32)</label>
            <input
              type="text"
              className="form-input"
              placeholder="0x1a65fb21..."
              value={auditorCommitment}
              onChange={(e) => setAuditorCommitment(e.target.value)}
              required
            />
            <p className="form-hint">The registered auditor's Pedersen commitment.</p>
          </div>

          <div className="form-group">
            <label className="form-label">Audit Level</label>
            <select
              className="form-input"
              value={auditLevel}
              onChange={(e) => setAuditLevel(Number(e.target.value))}
            >
              {AUDIT_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">ZK Proof (hex)</label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="0x..."
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              required
              style={{ resize: 'vertical', fontFamily: "'Space Mono', monospace", fontSize: '0.82rem' }}
            />
            <p className="form-hint">
              UltraHonk proof generated by the Noir circuit via <span className="mono">bb prove</span>.
              Paste the hex-encoded proof bytes.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Metadata URI (optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="ipfs://Qm... or https://..."
              value={metadataURI}
              onChange={(e) => setMetadataURI(e.target.value)}
            />
            <p className="form-hint">IPFS or HTTP link to skill metadata (name, description, etc.).</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isPending || isConfirming || !skillHash || !proof || !auditorCommitment}
            >
              {isPending ? 'Confirm in wallet...' : isConfirming ? 'Submitting...' : 'Submit Skill'}
            </button>

            <span className="text-muted" style={{ fontSize: '0.82rem' }}>
              Fee: {Number(REGISTRATION_FEE) / 1e18} ETH
            </span>

            {isSuccess && (
              <button type="button" className="btn btn-secondary" onClick={() => { reset(); setSkillHash(''); setProof(''); }}>
                Submit Another
              </button>
            )}
          </div>
        </form>

        <div className="mt-2">
          <TxStatus
            hash={hash}
            isPending={isPending}
            isConfirming={isConfirming}
            isSuccess={isSuccess}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}
