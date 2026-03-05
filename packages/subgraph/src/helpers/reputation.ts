import { BigInt } from "@graphprotocol/graph-ts";

const ATTESTATION_WEIGHT = BigInt.fromI32(10);
const STAKE_DIVISOR = BigInt.fromString("10000000000000000"); // 1e16
const DISPUTE_PENALTY = BigInt.fromI32(20);

/**
 * Calculate auditor reputation score.
 * Formula: (attestationCount * 10) + (currentStake / 1e16) - (disputesLost * 20)
 */
export function calculateReputation(
  attestationCount: i32,
  currentStake: BigInt,
  disputesLost: i32
): BigInt {
  let attestationScore = BigInt.fromI32(attestationCount).times(ATTESTATION_WEIGHT);
  let stakeScore = currentStake.div(STAKE_DIVISOR);
  let penalty = BigInt.fromI32(disputesLost).times(DISPUTE_PENALTY);

  let score = attestationScore.plus(stakeScore).minus(penalty);
  return score.lt(BigInt.zero()) ? BigInt.zero() : score;
}
