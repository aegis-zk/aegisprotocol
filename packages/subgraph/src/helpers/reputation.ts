import { BigInt } from "@graphprotocol/graph-ts";

// ── Scoring Weights ──────────────────────────────────────
const ATTESTATION_WEIGHT = BigInt.fromI32(10);        // +10 per attestation (base)
const L2_BONUS           = BigInt.fromI32(5);         // +5 extra per L2 attestation
const L3_BONUS           = BigInt.fromI32(15);        // +15 extra per L3 attestation
const DISPUTE_PENALTY    = BigInt.fromI32(20);        // -20 per lost dispute

// ── Stake Scoring (diminishing returns above 0.1 ETH) ────
const STAKE_DIVISOR      = BigInt.fromString("10000000000000000");  // 1e16 → +1 per 0.01 ETH
const STAKE_THRESHOLD    = BigInt.fromString("100000000000000000"); // 0.1 ETH threshold
const STAKE_DIVISOR_HIGH = BigInt.fromString("50000000000000000");  // 5e16 → +1 per 0.05 ETH above 0.1

// ── Tenure ───────────────────────────────────────────────
const TENURE_PERIOD = BigInt.fromI32(2592000);  // 30 days in seconds
const TENURE_CAP    = BigInt.fromI32(12);       // max 12 pts from tenure

// ── Decay ────────────────────────────────────────────────
const DECAY_GRACE      = BigInt.fromI32(7776000);   // 90 days grace period (no decay)
const DECAY_RANGE      = BigInt.fromI32(23760000);  // 275 days (365 - 90) = range for linear decay
const DECAY_PRECISION  = BigInt.fromI32(1000);      // Fixed-point precision for multipliers

// ── Win Rate ─────────────────────────────────────────────
// Win rate multiplier: 0.5x (all lost) to 1.1x (all won), 1.0x (no disputes)
// Using 1000-based fixed point: 500 to 1100
const WIN_RATE_FLOOR   = BigInt.fromI32(500);   // 0.5x
const WIN_RATE_CEILING = BigInt.fromI32(1100);  // 1.1x
const WIN_RATE_NEUTRAL = BigInt.fromI32(1000);  // 1.0x

/**
 * Calculate weighted auditor reputation score (A4 upgrade).
 *
 * Formula:
 *   baseScore = (attestationCount × 10)
 *             + stakeBonus (diminishing returns above 0.1 ETH)
 *             + tenureBonus (+1 per 30 days, capped at 12)
 *
 *   levelBonus = (l2Count × 5) + (l3Count × 15)
 *
 *   disputeAdjust = disputesLost × 20
 *
 *   winRateMultiplier:
 *     - No resolved disputes → 1.0×
 *     - All won → 1.1× (10% bonus)
 *     - All lost → 0.5× (50% penalty)
 *     - Mixed → linear interpolation
 *
 *   decayFactor:
 *     - ≤90 days since last attestation → 1.0×
 *     - 91-365 days → linear decay from 1.0 to 0.5
 *     - >365 days → 0.5× (floor)
 *
 *   finalScore = max(0, floor(rawScore × winRate × decay))
 */
export function calculateReputation(
  attestationCount: i32,
  currentStake: BigInt,
  disputesLost: i32,
  disputesInvolved: i32,
  registeredAt: BigInt,
  lastAttestationAt: BigInt,
  currentTimestamp: BigInt,
  l2Count: i32,
  l3Count: i32
): BigInt {
  // ── Base Score ──────────────────────────────────────────
  let attestationScore = BigInt.fromI32(attestationCount).times(ATTESTATION_WEIGHT);

  // Stake bonus with diminishing returns above 0.1 ETH
  let stakeScore: BigInt;
  if (currentStake.le(STAKE_THRESHOLD)) {
    stakeScore = currentStake.div(STAKE_DIVISOR);
  } else {
    let lowPortion = STAKE_THRESHOLD.div(STAKE_DIVISOR);  // 10 pts for first 0.1 ETH
    let highPortion = currentStake.minus(STAKE_THRESHOLD).div(STAKE_DIVISOR_HIGH);
    stakeScore = lowPortion.plus(highPortion);
  }

  // Tenure bonus: +1 per 30 days since registration, capped at 12
  let tenureSeconds = currentTimestamp.minus(registeredAt);
  let tenureBonus = tenureSeconds.div(TENURE_PERIOD);
  if (tenureBonus.gt(TENURE_CAP)) {
    tenureBonus = TENURE_CAP;
  }

  let baseScore = attestationScore.plus(stakeScore).plus(tenureBonus);

  // ── Level Bonus ─────────────────────────────────────────
  let levelBonus = BigInt.fromI32(l2Count).times(L2_BONUS)
    .plus(BigInt.fromI32(l3Count).times(L3_BONUS));

  // ── Dispute Adjustment ──────────────────────────────────
  let penalty = BigInt.fromI32(disputesLost).times(DISPUTE_PENALTY);

  // Raw score before multipliers
  let rawScore = baseScore.plus(levelBonus).minus(penalty);
  if (rawScore.lt(BigInt.zero())) {
    rawScore = BigInt.zero();
  }

  // ── Win Rate Multiplier (fixed-point ×1000) ─────────────
  let winRateMul = WIN_RATE_NEUTRAL;  // 1000 = 1.0x default
  if (disputesInvolved > 0) {
    let disputesWon = disputesInvolved - disputesLost;
    // winRate = disputesWon / disputesInvolved → 0.0 to 1.0
    // multiplier = 500 + (winRate × 600) → 500 to 1100
    let range = WIN_RATE_CEILING.minus(WIN_RATE_FLOOR);  // 600
    winRateMul = WIN_RATE_FLOOR.plus(
      BigInt.fromI32(disputesWon).times(range).div(BigInt.fromI32(disputesInvolved))
    );
  }

  // ── Decay Factor (fixed-point ×1000) ────────────────────
  let decayMul = DECAY_PRECISION;  // 1000 = 1.0x default (no decay)

  // Only apply decay if auditor has made at least one attestation
  if (attestationCount > 0 && lastAttestationAt.gt(BigInt.zero())) {
    let daysSinceAttestation = currentTimestamp.minus(lastAttestationAt);

    if (daysSinceAttestation.gt(DECAY_GRACE)) {
      let decayTime = daysSinceAttestation.minus(DECAY_GRACE);
      if (decayTime.ge(DECAY_RANGE)) {
        // Beyond 365 days → floor at 0.5x
        decayMul = BigInt.fromI32(500);
      } else {
        // Linear decay from 1000 to 500 over DECAY_RANGE
        // decayMul = 1000 - (decayTime / DECAY_RANGE × 500)
        let reduction = decayTime.times(BigInt.fromI32(500)).div(DECAY_RANGE);
        decayMul = DECAY_PRECISION.minus(reduction);
      }
    }
  }

  // ── Final Score ─────────────────────────────────────────
  // score = rawScore × (winRateMul / 1000) × (decayMul / 1000)
  let score = rawScore
    .times(winRateMul)
    .times(decayMul)
    .div(DECAY_PRECISION)
    .div(DECAY_PRECISION);

  return score.lt(BigInt.zero()) ? BigInt.zero() : score;
}
