/** Raw auditor data from the subgraph */
export interface SubgraphAuditor {
  id: string;
  reputationScore: string;
  currentStake: string;
  attestationCount: number;
  l2AttestationCount: number;
  l3AttestationCount: number;
  disputesLost: number;
  disputesInvolved: number;
  registered: boolean;
  timestamp: string;
  lastAttestationAt: string | null;
}

/** Configuration for a snapshot run */
export interface SnapshotConfig {
  totalAmount: bigint;
  minReputation: bigint;
  minStake: bigint;
  subgraphUrl: string;
  outputDir: string;
  tokenDecimals: number;
  skipMerkle: boolean;
}

/** A single auditor's allocation */
export interface AuditorAllocation {
  commitment: string;
  reputationScore: string;
  currentStake: string;
  shareBps: number;
  sharePercent: string;
  tokenAmount: string;
  merkleProof: string[];
}

/** Complete snapshot output */
export interface Snapshot {
  version: string;
  chainId: number;
  snapshotBlock: number;
  timestamp: string;
  totalAmount: string;
  eligibleCount: number;
  totalReputation: string;
  minReputation: string;
  merkleRoot: string;
  allocations: AuditorAllocation[];
}
