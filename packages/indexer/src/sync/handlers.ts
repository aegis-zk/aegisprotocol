import type { Log, PublicClient } from 'viem';
import type { Database } from 'sql.js';
import * as q from '../db/queries.js';
import { chainConfig } from '../config.js';

/**
 * Attestation index tracker.
 *
 * The SkillRegistered event doesn't include the attestation index,
 * so we track it per-skill. On startup, we initialize from the DB.
 * During sync, we increment after each SkillRegistered event.
 */
const attestationCounters = new Map<string, number>();

export function initAttestationCounters(db: Database): void {
  const result = db.exec('SELECT skill_hash, MAX(attestation_index) AS max_idx FROM attestations GROUP BY skill_hash');
  if (result.length === 0) return;

  for (const row of result[0].values) {
    const skillHash = row[0] as string;
    const maxIdx = row[1] as number;
    attestationCounters.set(skillHash, maxIdx + 1);
  }
}

function nextAttestationIndex(skillHash: string): number {
  const idx = attestationCounters.get(skillHash) ?? 0;
  attestationCounters.set(skillHash, idx + 1);
  return idx;
}

// ── Event type guards ────────────────────────────────────

interface DecodedLog extends Log {
  eventName: string;
  args: Record<string, unknown>;
}

// ── Handlers ─────────────────────────────────────────────

export async function handleEvent(log: DecodedLog, client: PublicClient): Promise<void> {
  const blockNumber = (log.blockNumber ?? 0n).toString();
  const txHash = log.transactionHash ?? '0x';
  const logIndex = log.logIndex ?? 0;

  // Raw event log for audit trail
  q.insertEventLog({
    eventName: log.eventName,
    blockNumber,
    txHash,
    logIndex,
    data: JSON.stringify(log.args, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
  });

  switch (log.eventName) {
    case 'SkillListed':
      q.insertSkill({
        skillHash: log.args.skillHash as string,
        publisher: log.args.publisher as string,
        metadataUri: log.args.metadataURI as string,
        blockNumber,
        txHash,
        logIndex,
      });
      break;

    case 'SkillRegistered': {
      const skillHash = log.args.skillHash as string;
      q.insertAttestation({
        skillHash,
        attestationIndex: nextAttestationIndex(skillHash),
        auditorCommitment: log.args.auditorCommitment as string,
        auditLevel: Number(log.args.auditLevel),
        blockNumber,
        txHash,
        logIndex,
      });
      break;
    }

    case 'AuditorRegistered':
      q.insertAuditor({
        auditorCommitment: log.args.auditorCommitment as string,
        initialStake: (log.args.stake as bigint).toString(),
        blockNumber,
        txHash,
        logIndex,
      });
      break;

    case 'StakeAdded':
      q.updateAuditorStake({
        auditorCommitment: log.args.auditorCommitment as string,
        totalStake: (log.args.totalStake as bigint).toString(),
      });
      break;

    case 'DisputeOpened': {
      const disputeId = Number(log.args.disputeId);
      // Fetch full details from contract since the event only has id + skillHash
      let attestationIndex: number | null = null;
      let challenger: string | null = null;
      let bond: string | null = null;
      let evidence: string | null = null;

      try {
        const result = (await client.readContract({
          address: chainConfig.registryAddress,
          abi: [
            {
              type: 'function',
              name: 'getDispute',
              inputs: [{ name: 'disputeId', type: 'uint256' }],
              outputs: [
                { name: 'skillHash', type: 'bytes32' },
                { name: 'attestationIndex', type: 'uint256' },
                { name: 'evidence', type: 'bytes' },
                { name: 'challenger', type: 'address' },
                { name: 'bond', type: 'uint256' },
                { name: 'resolved', type: 'bool' },
                { name: 'auditorFault', type: 'bool' },
              ],
              stateMutability: 'view',
            },
          ],
          functionName: 'getDispute',
          args: [BigInt(disputeId)],
        })) as readonly [string, bigint, string, string, bigint, boolean, boolean];

        attestationIndex = Number(result[1]);
        evidence = result[2];
        challenger = result[3];
        bond = result[4].toString();
      } catch {
        console.warn(`[sync] Failed to fetch dispute #${disputeId} details from contract`);
      }

      q.insertDispute({
        disputeId,
        skillHash: log.args.skillHash as string,
        attestationIndex,
        challenger,
        bond,
        evidence,
        blockNumber,
        txHash,
        logIndex,
      });
      break;
    }

    case 'DisputeResolved':
      q.resolveDispute({
        disputeId: Number(log.args.disputeId),
        auditorFault: log.args.auditorSlashed as boolean,
      });
      break;

    case 'AttestationRevoked':
      q.revokeAttestation({
        skillHash: log.args.skillHash as string,
        attestationIndex: Number(log.args.attestationIndex),
      });
      break;

    case 'BountyPosted':
      q.insertBounty({
        skillHash: log.args.skillHash as string,
        amount: (log.args.amount as bigint).toString(),
        requiredLevel: Number(log.args.requiredLevel),
        expiresAt: (log.args.expiresAt as bigint).toString(),
        blockNumber,
        txHash,
        logIndex,
      });
      break;

    case 'BountyClaimed':
      q.claimBounty(log.args.skillHash as string);
      break;

    case 'BountyReclaimed':
      q.reclaimBounty(log.args.skillHash as string);
      break;

    default:
      console.warn(`[sync] Unknown event: ${log.eventName}`);
  }
}
