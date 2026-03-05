import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  SkillListed,
  SkillRegistered,
  AuditorRegistered,
  StakeAdded,
  DisputeOpened,
  DisputeResolved,
  AttestationRevoked,
  BountyPosted,
  BountyClaimed,
  BountyReclaimed,
  UnstakeInitiated,
  UnstakeCompleted,
  UnstakeCancelled,
  AegisRegistry,
} from "../generated/AegisRegistry/AegisRegistry";
import {
  Skill,
  Attestation,
  Auditor,
  Dispute,
  Bounty,
  UnstakeRequest,
  ProtocolEvent,
} from "../generated/schema";
import { parseMetadataURI } from "./helpers/metadata";
import { calculateReputation } from "./helpers/reputation";
import { getOrCreateStats } from "./helpers/stats";

// ── Helpers ─────────────────────────────────────────────

function logEvent(
  eventName: string,
  txHash: Bytes,
  logIndex: BigInt,
  blockNumber: BigInt,
  timestamp: BigInt,
  data: string
): void {
  let id = txHash.toHexString() + "-" + logIndex.toString();
  let ev = new ProtocolEvent(id);
  ev.eventName = eventName;
  ev.txHash = txHash;
  ev.logIndex = logIndex;
  ev.blockNumber = blockNumber;
  ev.timestamp = timestamp;
  ev.data = data;
  ev.save();
}

// ── Skills ──────────────────────────────────────────────

export function handleSkillListed(event: SkillListed): void {
  let skill = new Skill(event.params.skillHash);
  skill.publisher = event.params.publisher;
  skill.metadataURI = event.params.metadataURI;
  skill.listed = true;
  skill.attestationCount = 0;
  skill.blockNumber = event.block.number;
  skill.txHash = event.transaction.hash;
  skill.logIndex = event.logIndex;
  skill.timestamp = event.block.timestamp;

  // Parse metadata for name + category
  let meta = parseMetadataURI(event.params.metadataURI);
  skill.skillName = meta.name;
  skill.category = meta.category;

  skill.save();

  // Update stats
  let stats = getOrCreateStats();
  stats.totalSkills += 1;
  stats.unauditedSkills += 1;
  stats.save();

  logEvent(
    "SkillListed",
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp,
    event.params.skillHash.toHexString()
  );
}

// ── Attestations ────────────────────────────────────────

export function handleSkillRegistered(event: SkillRegistered): void {
  let skill = Skill.load(event.params.skillHash);
  if (skill == null) return;

  // Attestation index = current count (0-based)
  let attestationIndex = skill.attestationCount;

  let id = event.params.skillHash.toHexString() + "-" + attestationIndex.toString();
  let attestation = new Attestation(id);
  attestation.skill = event.params.skillHash;
  attestation.attestationIndex = attestationIndex;
  attestation.auditor = event.params.auditorCommitment;
  attestation.auditLevel = event.params.auditLevel;
  attestation.revoked = false;
  attestation.blockNumber = event.block.number;
  attestation.txHash = event.transaction.hash;
  attestation.logIndex = event.logIndex;
  attestation.timestamp = event.block.timestamp;
  attestation.save();

  // Update skill
  let wasUnaudited = skill.attestationCount == 0;
  skill.attestationCount += 1;
  skill.save();

  // Update auditor
  let auditor = Auditor.load(event.params.auditorCommitment);
  if (auditor != null) {
    auditor.attestationCount += 1;
    auditor.reputationScore = calculateReputation(
      auditor.attestationCount,
      auditor.currentStake,
      auditor.disputesLost
    );
    auditor.save();
  }

  // Update stats
  let stats = getOrCreateStats();
  stats.totalAttestations += 1;
  if (wasUnaudited) {
    stats.unauditedSkills -= 1;
  }
  stats.save();

  logEvent(
    "SkillRegistered",
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp,
    event.params.skillHash.toHexString()
  );
}

// ── Auditors ────────────────────────────────────────────

export function handleAuditorRegistered(event: AuditorRegistered): void {
  let auditor = new Auditor(event.params.auditorCommitment);
  auditor.initialStake = event.params.stake;
  auditor.currentStake = event.params.stake;
  auditor.attestationCount = 0;
  auditor.disputesInvolved = 0;
  auditor.disputesLost = 0;
  auditor.reputationScore = BigInt.zero();
  auditor.registered = true;
  auditor.blockNumber = event.block.number;
  auditor.txHash = event.transaction.hash;
  auditor.logIndex = event.logIndex;
  auditor.timestamp = event.block.timestamp;
  auditor.save();

  let stats = getOrCreateStats();
  stats.totalAuditors += 1;
  stats.save();

  logEvent(
    "AuditorRegistered",
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp,
    event.params.auditorCommitment.toHexString()
  );
}

export function handleStakeAdded(event: StakeAdded): void {
  let auditor = Auditor.load(event.params.auditorCommitment);
  if (auditor == null) return;

  auditor.currentStake = event.params.totalStake;
  auditor.reputationScore = calculateReputation(
    auditor.attestationCount,
    auditor.currentStake,
    auditor.disputesLost
  );
  auditor.save();

  logEvent(
    "StakeAdded",
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp,
    event.params.auditorCommitment.toHexString()
  );
}

// ── Disputes ────────────────────────────────────────────

export function handleDisputeOpened(event: DisputeOpened): void {
  let dispute = new Dispute(event.params.disputeId.toString());
  dispute.disputeId = event.params.disputeId;
  dispute.skill = event.params.skillHash;
  dispute.resolved = false;
  dispute.auditorFault = false;
  dispute.blockNumber = event.block.number;
  dispute.txHash = event.transaction.hash;
  dispute.logIndex = event.logIndex;
  dispute.openedAt = event.block.timestamp;

  // Fetch full details from contract
  let contract = AegisRegistry.bind(event.address);
  let result = contract.try_getDispute(event.params.disputeId);

  if (!result.reverted) {
    let data = result.value;
    dispute.attestationIndex = data.value1.toI32();
    dispute.evidence = data.value2;
    dispute.challenger = data.value3;
    dispute.bond = data.value4;
  } else {
    dispute.attestationIndex = 0;
    dispute.challenger = Bytes.empty();
    dispute.bond = BigInt.zero();
    dispute.evidence = Bytes.empty();
  }

  dispute.save();

  let stats = getOrCreateStats();
  stats.totalDisputes += 1;
  stats.openDisputes += 1;
  stats.save();

  logEvent(
    "DisputeOpened",
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp,
    event.params.disputeId.toString()
  );
}

export function handleDisputeResolved(event: DisputeResolved): void {
  let dispute = Dispute.load(event.params.disputeId.toString());
  if (dispute == null) return;

  dispute.resolved = true;
  dispute.auditorFault = event.params.auditorSlashed;
  dispute.resolvedAt = event.block.timestamp;
  dispute.save();

  // If auditor was at fault, update their stats
  if (event.params.auditorSlashed) {
    let attestationId = dispute.skill.toHexString() + "-" + dispute.attestationIndex.toString();
    let attestation = Attestation.load(attestationId);
    if (attestation != null) {
      let auditor = Auditor.load(attestation.auditor);
      if (auditor != null) {
        auditor.disputesLost += 1;
        auditor.reputationScore = calculateReputation(
          auditor.attestationCount,
          auditor.currentStake,
          auditor.disputesLost
        );
        auditor.save();
      }
    }
  }

  let stats = getOrCreateStats();
  stats.openDisputes -= 1;
  stats.save();

  logEvent(
    "DisputeResolved",
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp,
    event.params.disputeId.toString()
  );
}

// ── Attestation Revocation ──────────────────────────────

export function handleAttestationRevoked(event: AttestationRevoked): void {
  let id = event.params.skillHash.toHexString() + "-" + event.params.attestationIndex.toString();
  let attestation = Attestation.load(id);
  if (attestation == null) return;

  attestation.revoked = true;
  attestation.save();

  // Check if skill is now unaudited
  let skill = Skill.load(event.params.skillHash);
  if (skill != null) {
    // We track total attestations made via attestationCount on Skill.
    // For unaudited tracking, decrement total attestations in stats.
    let stats = getOrCreateStats();
    stats.totalAttestations -= 1;
    stats.save();
  }

  logEvent(
    "AttestationRevoked",
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp,
    event.params.skillHash.toHexString()
  );
}

// ── Bounties ────────────────────────────────────────────

export function handleBountyPosted(event: BountyPosted): void {
  let bounty = new Bounty(event.params.skillHash);
  bounty.skill = event.params.skillHash;
  bounty.amount = event.params.amount;
  bounty.requiredLevel = event.params.requiredLevel;
  bounty.expiresAt = event.params.expiresAt;
  bounty.claimed = false;
  bounty.reclaimed = false;
  bounty.blockNumber = event.block.number;
  bounty.txHash = event.transaction.hash;
  bounty.logIndex = event.logIndex;
  bounty.timestamp = event.block.timestamp;
  bounty.save();

  let stats = getOrCreateStats();
  stats.totalBounties += 1;
  stats.openBounties += 1;
  stats.save();

  logEvent(
    "BountyPosted",
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp,
    event.params.skillHash.toHexString()
  );
}

export function handleBountyClaimed(event: BountyClaimed): void {
  let bounty = Bounty.load(event.params.skillHash);
  if (bounty == null) return;

  bounty.claimed = true;
  bounty.claimRecipient = event.params.recipient;
  bounty.auditorPayout = event.params.auditorPayout;
  bounty.protocolFee = event.params.protocolFee;
  bounty.save();

  let stats = getOrCreateStats();
  stats.openBounties -= 1;
  stats.save();

  logEvent(
    "BountyClaimed",
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp,
    event.params.skillHash.toHexString()
  );
}

export function handleBountyReclaimed(event: BountyReclaimed): void {
  let bounty = Bounty.load(event.params.skillHash);
  if (bounty == null) return;

  bounty.reclaimed = true;
  bounty.save();

  let stats = getOrCreateStats();
  stats.openBounties -= 1;
  stats.save();

  logEvent(
    "BountyReclaimed",
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp,
    event.params.skillHash.toHexString()
  );
}

// ── Unstaking ───────────────────────────────────────────

export function handleUnstakeInitiated(event: UnstakeInitiated): void {
  let request = new UnstakeRequest(event.params.auditorCommitment);
  request.auditor = event.params.auditorCommitment;
  request.amount = event.params.amount;
  request.unlockTimestamp = event.params.unlockTimestamp;
  request.status = "pending";
  request.blockNumber = event.block.number;
  request.txHash = event.transaction.hash;
  request.timestamp = event.block.timestamp;
  request.save();

  logEvent(
    "UnstakeInitiated",
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp,
    event.params.auditorCommitment.toHexString()
  );
}

export function handleUnstakeCompleted(event: UnstakeCompleted): void {
  let request = UnstakeRequest.load(event.params.auditorCommitment);
  if (request != null) {
    request.status = "completed";
    request.save();
  }

  let auditor = Auditor.load(event.params.auditorCommitment);
  if (auditor != null) {
    auditor.currentStake = auditor.currentStake.minus(event.params.amount);
    auditor.reputationScore = calculateReputation(
      auditor.attestationCount,
      auditor.currentStake,
      auditor.disputesLost
    );
    auditor.save();
  }

  logEvent(
    "UnstakeCompleted",
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp,
    event.params.auditorCommitment.toHexString()
  );
}

export function handleUnstakeCancelled(event: UnstakeCancelled): void {
  let request = UnstakeRequest.load(event.params.auditorCommitment);
  if (request != null) {
    request.status = "cancelled";
    request.save();
  }

  logEvent(
    "UnstakeCancelled",
    event.transaction.hash,
    event.logIndex,
    event.block.number,
    event.block.timestamp,
    event.params.auditorCommitment.toHexString()
  );
}
