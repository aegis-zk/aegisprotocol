/**
 * Contract event definitions for viem.
 *
 * We define ABI fragments inline rather than importing the full ABI
 * so the indexer stays decoupled from the SDK build artifact.
 */
export const REGISTRY_EVENTS = [
  {
    type: 'event',
    name: 'SkillListed',
    inputs: [
      { name: 'skillHash', type: 'bytes32', indexed: true },
      { name: 'publisher', type: 'address', indexed: true },
      { name: 'metadataURI', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SkillRegistered',
    inputs: [
      { name: 'skillHash', type: 'bytes32', indexed: true },
      { name: 'auditLevel', type: 'uint8', indexed: false },
      { name: 'auditorCommitment', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AuditorRegistered',
    inputs: [
      { name: 'auditorCommitment', type: 'bytes32', indexed: true },
      { name: 'stake', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'StakeAdded',
    inputs: [
      { name: 'auditorCommitment', type: 'bytes32', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'totalStake', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DisputeOpened',
    inputs: [
      { name: 'disputeId', type: 'uint256', indexed: true },
      { name: 'skillHash', type: 'bytes32', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'DisputeResolved',
    inputs: [
      { name: 'disputeId', type: 'uint256', indexed: true },
      { name: 'auditorSlashed', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AttestationRevoked',
    inputs: [
      { name: 'skillHash', type: 'bytes32', indexed: true },
      { name: 'attestationIndex', type: 'uint256', indexed: false },
      { name: 'auditorCommitment', type: 'bytes32', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'BountyPosted',
    inputs: [
      { name: 'skillHash', type: 'bytes32', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'requiredLevel', type: 'uint8', indexed: false },
      { name: 'expiresAt', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BountyClaimed',
    inputs: [
      { name: 'skillHash', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'auditorPayout', type: 'uint256', indexed: false },
      { name: 'protocolFee', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BountyReclaimed',
    inputs: [
      { name: 'skillHash', type: 'bytes32', indexed: true },
      { name: 'publisher', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ReferralReward',
    inputs: [
      { name: 'referrer', type: 'address', indexed: true },
      { name: 'referee', type: 'address', indexed: true },
      { name: 'skillHash', type: 'bytes32', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ReferralWithdrawn',
    inputs: [
      { name: 'referrer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;
