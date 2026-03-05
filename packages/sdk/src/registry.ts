import {
  createPublicClient,
  http,
  getContract,
  parseAbiItem,
  type PublicClient,
  type WalletClient,
  type GetContractReturnType,
  type Transport,
  type Chain,
  type Account,
} from 'viem';
import { base, baseSepolia } from 'viem/chains';
import abi from './abi/AegisRegistry.json' with { type: 'json' };
import type {
  AegisConfig,
  Attestation,
  AuditorReputation,
  UnstakeRequest,
  BountyInfo,
  SkillListing,
  Hex,
  Address,
  SkillRegisteredEvent,
  SkillListedEvent,
  AuditorRegisteredEvent,
  DisputeOpenedEvent,
  DisputeResolvedEvent,
  BountyPostedEvent,
} from './types';
import { REGISTRATION_FEE, LISTING_FEE, DEPLOYMENT_BLOCKS, MAX_LOG_RANGE } from './constants';

const CHAINS: Record<number, Chain> = {
  8453: base,
  84532: baseSepolia,
};

export function createReadClient(config: AegisConfig): PublicClient {
  const chain = CHAINS[config.chainId];
  if (!chain) throw new Error(`Unsupported chain: ${config.chainId}`);

  return createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });
}

export function getRegistryContract(
  client: PublicClient,
  address: Address,
): GetContractReturnType<typeof abi, PublicClient> {
  return getContract({
    address,
    abi,
    client,
  });
}

// ──────────────────────────────────────────────
//  Read Operations
// ──────────────────────────────────────────────

export async function getAttestations(
  client: PublicClient,
  registryAddress: Address,
  skillHash: Hex,
): Promise<Attestation[]> {
  const result = await client.readContract({
    address: registryAddress,
    abi,
    functionName: 'getAttestations',
    args: [skillHash],
  });

  return result as unknown as Attestation[];
}

export async function verifyAttestation(
  client: PublicClient,
  registryAddress: Address,
  skillHash: Hex,
  attestationIndex: bigint,
): Promise<boolean> {
  const result = await client.readContract({
    address: registryAddress,
    abi,
    functionName: 'verifyAttestation',
    args: [skillHash, attestationIndex],
  });

  return result as boolean;
}

export async function getAuditorReputation(
  client: PublicClient,
  registryAddress: Address,
  auditorCommitment: Hex,
): Promise<AuditorReputation> {
  const [score, totalStake, attestationCount] = (await client.readContract({
    address: registryAddress,
    abi,
    functionName: 'getAuditorReputation',
    args: [auditorCommitment],
  })) as [bigint, bigint, bigint];

  return { score, totalStake, attestationCount };
}

export async function getMetadataURI(
  client: PublicClient,
  registryAddress: Address,
  skillHash: Hex,
): Promise<string> {
  const result = await client.readContract({
    address: registryAddress,
    abi,
    functionName: 'metadataURIs',
    args: [skillHash],
  });

  return result as string;
}

export async function getSkillListing(
  client: PublicClient,
  registryAddress: Address,
  skillHash: Hex,
): Promise<SkillListing> {
  const result = (await client.readContract({
    address: registryAddress,
    abi,
    functionName: 'getSkillListing',
    args: [skillHash],
  })) as { publisher: Address; metadataURI: string; timestamp: bigint; listed: boolean };

  return {
    publisher: result.publisher,
    metadataURI: result.metadataURI,
    timestamp: result.timestamp,
    listed: result.listed,
  };
}

// ──────────────────────────────────────────────
//  Event Queries — Discovery & History
// ──────────────────────────────────────────────

const skillListedEvent = parseAbiItem(
  'event SkillListed(bytes32 indexed skillHash, address indexed publisher, string metadataURI)',
);

const skillRegisteredEvent = parseAbiItem(
  'event SkillRegistered(bytes32 indexed skillHash, uint8 auditLevel, bytes32 auditorCommitment)',
);

const auditorRegisteredEvent = parseAbiItem(
  'event AuditorRegistered(bytes32 indexed auditorCommitment, uint256 stake)',
);

const disputeOpenedEvent = parseAbiItem(
  'event DisputeOpened(uint256 indexed disputeId, bytes32 indexed skillHash)',
);

const disputeResolvedEvent = parseAbiItem(
  'event DisputeResolved(uint256 indexed disputeId, bool auditorSlashed)',
);

/**
 * Fetch logs in chunks to stay within public RPC eth_getLogs range limits.
 * Most public RPCs (including Base) limit to ~10K blocks per request.
 */
async function getLogsChunked<T>(
  client: PublicClient,
  params: {
    address: Address;
    event: any;
    args?: any;
    fromBlock: bigint;
    toBlock: bigint;
  },
  mapper: (log: any) => T,
): Promise<T[]> {
  const results: T[] = [];
  let cursor = params.fromBlock;

  while (cursor <= params.toBlock) {
    const endBlock =
      cursor + MAX_LOG_RANGE > params.toBlock
        ? params.toBlock
        : cursor + MAX_LOG_RANGE;

    const logs = await client.getLogs({
      address: params.address,
      event: params.event,
      args: params.args,
      fromBlock: cursor,
      toBlock: endBlock,
    });

    for (const log of logs) {
      results.push(mapper(log));
    }

    cursor = endBlock + 1n;
  }

  return results;
}

/**
 * Resolve the fromBlock for event queries.
 * Defaults to the deployment block for the chain.
 */
function resolveFromBlock(client: PublicClient, fromBlock?: bigint): bigint {
  if (fromBlock !== undefined) return fromBlock;
  const chainId = client.chain?.id;
  if (chainId && DEPLOYMENT_BLOCKS[chainId]) return DEPLOYMENT_BLOCKS[chainId];
  return 0n;
}

/**
 * List all registered skills by scanning SkillRegistered events.
 * Returns skill hashes with their audit level and auditor info.
 */
export async function listAllSkills(
  client: PublicClient,
  registryAddress: Address,
  options?: { fromBlock?: bigint; toBlock?: bigint },
): Promise<SkillRegisteredEvent[]> {
  const currentBlock = await client.getBlockNumber();
  const from = resolveFromBlock(client, options?.fromBlock);
  const to = options?.toBlock ?? currentBlock;

  return getLogsChunked(
    client,
    {
      address: registryAddress,
      event: skillRegisteredEvent,
      fromBlock: from,
      toBlock: to,
    },
    (log) => ({
      skillHash: log.args.skillHash! as Hex,
      auditLevel: Number(log.args.auditLevel!),
      auditorCommitment: log.args.auditorCommitment! as Hex,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash as Hex,
    }),
  );
}

/**
 * List all listed skills (unaudited) by scanning SkillListed events.
 * These are skills awaiting audit — they don't have ZK proofs yet.
 */
export async function listListedSkills(
  client: PublicClient,
  registryAddress: Address,
  options?: { fromBlock?: bigint; toBlock?: bigint },
): Promise<SkillListedEvent[]> {
  const currentBlock = await client.getBlockNumber();
  const from = resolveFromBlock(client, options?.fromBlock);
  const to = options?.toBlock ?? currentBlock;

  return getLogsChunked(
    client,
    {
      address: registryAddress,
      event: skillListedEvent,
      fromBlock: from,
      toBlock: to,
    },
    (log) => ({
      skillHash: log.args.skillHash! as Hex,
      publisher: log.args.publisher! as Address,
      metadataURI: log.args.metadataURI!,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash as Hex,
    }),
  );
}

/**
 * List all registered auditors by scanning AuditorRegistered events.
 */
export async function listAllAuditors(
  client: PublicClient,
  registryAddress: Address,
  options?: { fromBlock?: bigint; toBlock?: bigint },
): Promise<AuditorRegisteredEvent[]> {
  const currentBlock = await client.getBlockNumber();
  const from = resolveFromBlock(client, options?.fromBlock);
  const to = options?.toBlock ?? currentBlock;

  return getLogsChunked(
    client,
    {
      address: registryAddress,
      event: auditorRegisteredEvent,
      fromBlock: from,
      toBlock: to,
    },
    (log) => ({
      auditorCommitment: log.args.auditorCommitment! as Hex,
      stake: log.args.stake!,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash as Hex,
    }),
  );
}

/**
 * List all opened disputes. Optionally filter by skillHash.
 */
export async function listDisputes(
  client: PublicClient,
  registryAddress: Address,
  options?: { skillHash?: Hex; fromBlock?: bigint; toBlock?: bigint },
): Promise<DisputeOpenedEvent[]> {
  const currentBlock = await client.getBlockNumber();
  const from = resolveFromBlock(client, options?.fromBlock);
  const to = options?.toBlock ?? currentBlock;

  return getLogsChunked(
    client,
    {
      address: registryAddress,
      event: disputeOpenedEvent,
      args: options?.skillHash ? { skillHash: options.skillHash } : undefined,
      fromBlock: from,
      toBlock: to,
    },
    (log) => ({
      disputeId: log.args.disputeId!,
      skillHash: log.args.skillHash! as Hex,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash as Hex,
    }),
  );
}

/**
 * List resolved disputes.
 */
export async function listResolvedDisputes(
  client: PublicClient,
  registryAddress: Address,
  options?: { fromBlock?: bigint; toBlock?: bigint },
): Promise<DisputeResolvedEvent[]> {
  const currentBlock = await client.getBlockNumber();
  const from = resolveFromBlock(client, options?.fromBlock);
  const to = options?.toBlock ?? currentBlock;

  return getLogsChunked(
    client,
    {
      address: registryAddress,
      event: disputeResolvedEvent,
      fromBlock: from,
      toBlock: to,
    },
    (log) => ({
      disputeId: log.args.disputeId!,
      auditorSlashed: log.args.auditorSlashed!,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash as Hex,
    }),
  );
}

// ──────────────────────────────────────────────
//  Write Operations
// ──────────────────────────────────────────────

/**
 * List a skill for future auditing (no auditor or ZK proof required).
 *
 * This is the lightweight entry point for populating the registry.
 * Anyone can list a skill by providing its hash and metadata, paying a small listing fee.
 * Auditors can then discover and audit listed skills.
 *
 * **Requirements:**
 * - `skillHash` must not be zero. Error: InvalidSkillHash (0xd556b563)
 * - `metadataURI` must not be empty. Error: EmptyMetadata (0xae921357)
 * - Fee must be >= 0.001 ETH. Error: InsufficientListingFee (0xbf8513a4)
 * - Skill must not already be listed. Error: SkillAlreadyListed (0x8046aa2c)
 */
export async function listSkill(
  walletClient: WalletClient<Transport, Chain, Account>,
  registryAddress: Address,
  params: {
    skillHash: Hex;
    metadataURI: string;
    fee?: bigint;
  },
): Promise<Hex> {
  if (params.skillHash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    throw new Error('Invalid skillHash: cannot be zero bytes32.');
  }
  if (!params.metadataURI || params.metadataURI.length === 0) {
    throw new Error(
      'metadataURI cannot be empty. Provide an IPFS URI, HTTP URL, or use metadataToDataURI() to encode inline.',
    );
  }
  const fee = params.fee ?? LISTING_FEE;
  if (fee < LISTING_FEE) {
    throw new Error(
      `Listing fee too low: ${fee} wei. Minimum is ${LISTING_FEE} wei (0.001 ETH). ` +
      `The contract will revert with InsufficientListingFee (0xbf8513a4).`,
    );
  }

  return walletClient.writeContract({
    address: registryAddress,
    abi,
    functionName: 'listSkill',
    args: [params.skillHash, params.metadataURI],
    value: fee,
  });
}

export async function registerAuditor(
  walletClient: WalletClient<Transport, Chain, Account>,
  registryAddress: Address,
  auditorCommitment: Hex,
  stakeAmount: bigint,
): Promise<Hex> {
  return walletClient.writeContract({
    address: registryAddress,
    abi,
    functionName: 'registerAuditor',
    args: [auditorCommitment],
    value: stakeAmount,
  });
}

export async function addStake(
  walletClient: WalletClient<Transport, Chain, Account>,
  registryAddress: Address,
  auditorCommitment: Hex,
  amount: bigint,
): Promise<Hex> {
  return walletClient.writeContract({
    address: registryAddress,
    abi,
    functionName: 'addStake',
    args: [auditorCommitment],
    value: amount,
  });
}

/**
 * Register a skill attestation on the AEGIS Registry.
 *
 * **IMPORTANT — common pitfalls that cause reverts:**
 * - `auditLevel` must be exactly 1, 2, or 3 (not 0, not 4+). Error: InvalidAuditLevel (0x657f08f5)
 * - `auditorCommitment` must already be registered on-chain via registerAuditor(). Error: AuditorNotRegistered (0x57fb4f95)
 * - The ZK proof must be valid and match the public inputs. Error: InvalidProof (0x09bde339)
 * - Transaction must include >= 0.001 ETH as the registration fee. Error: InsufficientFee (0x025dbdd4)
 *
 * @throws Error if auditLevel is not 1, 2, or 3 (caught client-side before sending tx)
 */
export async function registerSkill(
  walletClient: WalletClient<Transport, Chain, Account>,
  registryAddress: Address,
  params: {
    skillHash: Hex;
    metadataURI: string;
    attestationProof: Hex;
    publicInputs: Hex[];
    auditorCommitment: Hex;
    auditLevel: 1 | 2 | 3;
    bountyRecipient?: Address;
    fee?: bigint;
  },
): Promise<Hex> {
  // Runtime validation — catch common mistakes before they hit the chain
  if (![1, 2, 3].includes(params.auditLevel)) {
    throw new Error(
      `Invalid auditLevel: ${params.auditLevel}. Must be 1 (L1 Functional), 2 (L2 Robust), or 3 (L3 Security). ` +
      `The contract will revert with InvalidAuditLevel (0x657f08f5) for any other value.`,
    );
  }
  const fee = params.fee ?? REGISTRATION_FEE;
  if (fee < REGISTRATION_FEE) {
    throw new Error(
      `Registration fee too low: ${fee} wei. Minimum is ${REGISTRATION_FEE} wei (0.001 ETH). ` +
      `The contract will revert with InsufficientFee (0x025dbdd4).`,
    );
  }

  const zeroAddress: Address = '0x0000000000000000000000000000000000000000';
  return walletClient.writeContract({
    address: registryAddress,
    abi,
    functionName: 'registerSkill',
    args: [
      params.skillHash,
      params.metadataURI,
      params.attestationProof,
      params.publicInputs,
      params.auditorCommitment,
      params.auditLevel,
      params.bountyRecipient ?? zeroAddress,
    ],
    value: fee,
  });
}

export async function openDispute(
  walletClient: WalletClient<Transport, Chain, Account>,
  registryAddress: Address,
  skillHash: Hex,
  attestationIndex: bigint,
  evidence: Hex,
  bond: bigint,
): Promise<Hex> {
  return walletClient.writeContract({
    address: registryAddress,
    abi,
    functionName: 'openDispute',
    args: [skillHash, attestationIndex, evidence],
    value: bond,
  });
}

export async function resolveDispute(
  walletClient: WalletClient<Transport, Chain, Account>,
  registryAddress: Address,
  disputeId: bigint,
  auditorFault: boolean,
): Promise<Hex> {
  return walletClient.writeContract({
    address: registryAddress,
    abi,
    functionName: 'resolveDispute',
    args: [disputeId, auditorFault],
  });
}

// ──────────────────────────────────────────────
//  Unstaking Operations
// ──────────────────────────────────────────────

export async function getUnstakeRequest(
  client: PublicClient,
  registryAddress: Address,
  auditorCommitment: Hex,
): Promise<UnstakeRequest> {
  const result = (await client.readContract({
    address: registryAddress,
    abi,
    functionName: 'getUnstakeRequest',
    args: [auditorCommitment],
  })) as { amount: bigint; unlockTimestamp: bigint };

  return { amount: result.amount, unlockTimestamp: result.unlockTimestamp };
}

export async function initiateUnstake(
  walletClient: WalletClient<Transport, Chain, Account>,
  registryAddress: Address,
  auditorCommitment: Hex,
  amount: bigint,
): Promise<Hex> {
  return walletClient.writeContract({
    address: registryAddress,
    abi,
    functionName: 'initiateUnstake',
    args: [auditorCommitment, amount],
  });
}

export async function completeUnstake(
  walletClient: WalletClient<Transport, Chain, Account>,
  registryAddress: Address,
  auditorCommitment: Hex,
): Promise<Hex> {
  return walletClient.writeContract({
    address: registryAddress,
    abi,
    functionName: 'completeUnstake',
    args: [auditorCommitment],
  });
}

export async function cancelUnstake(
  walletClient: WalletClient<Transport, Chain, Account>,
  registryAddress: Address,
  auditorCommitment: Hex,
): Promise<Hex> {
  return walletClient.writeContract({
    address: registryAddress,
    abi,
    functionName: 'cancelUnstake',
    args: [auditorCommitment],
  });
}

// ──────────────────────────────────────────────
//  Bounty Operations
// ──────────────────────────────────────────────

const bountyPostedEvent = parseAbiItem(
  'event BountyPosted(bytes32 indexed skillHash, uint256 amount, uint8 requiredLevel, uint256 expiresAt)',
);

export async function getBounty(
  client: PublicClient,
  registryAddress: Address,
  skillHash: Hex,
): Promise<BountyInfo> {
  const result = (await client.readContract({
    address: registryAddress,
    abi,
    functionName: 'getBounty',
    args: [skillHash],
  })) as { publisher: Address; amount: bigint; requiredLevel: number; expiresAt: bigint; claimed: boolean };

  return {
    publisher: result.publisher,
    amount: result.amount,
    requiredLevel: result.requiredLevel,
    expiresAt: result.expiresAt,
    claimed: result.claimed,
  };
}

/**
 * List all posted bounties by scanning BountyPosted events.
 * Optionally filter by skillHash.
 */
export async function listBounties(
  client: PublicClient,
  registryAddress: Address,
  options?: { skillHash?: Hex; fromBlock?: bigint; toBlock?: bigint },
): Promise<BountyPostedEvent[]> {
  const currentBlock = await client.getBlockNumber();
  const from = resolveFromBlock(client, options?.fromBlock);
  const to = options?.toBlock ?? currentBlock;

  return getLogsChunked(
    client,
    {
      address: registryAddress,
      event: bountyPostedEvent,
      args: options?.skillHash ? { skillHash: options.skillHash } : undefined,
      fromBlock: from,
      toBlock: to,
    },
    (log) => ({
      skillHash: log.args.skillHash! as Hex,
      amount: log.args.amount!,
      requiredLevel: Number(log.args.requiredLevel!),
      expiresAt: log.args.expiresAt!,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash as Hex,
    }),
  );
}

export async function postBounty(
  walletClient: WalletClient<Transport, Chain, Account>,
  registryAddress: Address,
  skillHash: Hex,
  requiredLevel: number,
  amount: bigint,
): Promise<Hex> {
  return walletClient.writeContract({
    address: registryAddress,
    abi,
    functionName: 'postBounty',
    args: [skillHash, requiredLevel],
    value: amount,
  });
}

export async function reclaimBounty(
  walletClient: WalletClient<Transport, Chain, Account>,
  registryAddress: Address,
  skillHash: Hex,
): Promise<Hex> {
  return walletClient.writeContract({
    address: registryAddress,
    abi,
    functionName: 'reclaimBounty',
    args: [skillHash],
  });
}
