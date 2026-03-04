/**
 * ERC-8004 (Trustless Agents) integration module.
 *
 * Bridges AEGIS ZK-verified audit attestations into the ERC-8004 ecosystem,
 * allowing any ERC-8004 consumer to discover and trust AEGIS-audited agents.
 */

import {
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain,
  type Account,
  keccak256,
  toHex,
  encodePacked,
} from 'viem';
import type {
  Address,
  Hex,
  ValidationStatus,
  ValidationSummary,
  ReputationSummary,
  AgentRegistration,
  RequestErc8004ValidationParams,
  RespondToErc8004ValidationParams,
} from './types';
import {
  ERC8004_CHAIN_ADDRESSES,
  AUDIT_LEVEL_SCORES,
  AEGIS_VALIDATION_TAG,
  AEGIS_REPUTATION_TAG,
  type Erc8004Addresses,
} from './erc8004-constants';

// ──────────────────────────────────────────────
//  Inline ABIs (minimal — only the functions we need)
// ──────────────────────────────────────────────

const identityRegistryAbi = [
  {
    type: 'function',
    name: 'register',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setMetadata',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'metadataKey', type: 'string' },
      { name: 'metadataValue', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getMetadata',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'metadataKey', type: 'string' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

const validationRegistryAbi = [
  {
    type: 'function',
    name: 'validationRequest',
    inputs: [
      { name: 'validatorAddress', type: 'address' },
      { name: 'agentId', type: 'uint256' },
      { name: 'requestURI', type: 'string' },
      { name: 'requestHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'validationResponse',
    inputs: [
      { name: 'requestHash', type: 'bytes32' },
      { name: 'response', type: 'uint8' },
      { name: 'responseURI', type: 'string' },
      { name: 'responseHash', type: 'bytes32' },
      { name: 'tag', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getValidationStatus',
    inputs: [{ name: 'requestHash', type: 'bytes32' }],
    outputs: [
      { name: '', type: 'address' },
      { name: '', type: 'uint256' },
      { name: '', type: 'uint8' },
      { name: '', type: 'bytes32' },
      { name: '', type: 'string' },
      { name: '', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSummary',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'validatorAddresses', type: 'address[]' },
      { name: 'tag', type: 'string' },
    ],
    outputs: [
      { name: 'count', type: 'uint64' },
      { name: 'averageResponse', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
] as const;

const reputationRegistryAbi = [
  {
    type: 'function',
    name: 'giveFeedback',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'value', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'feedbackURI', type: 'string' },
      { name: 'feedbackHash', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getSummary',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddresses', type: 'address[]' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
    ],
    outputs: [
      { name: 'count', type: 'uint64' },
      { name: 'summaryValue', type: 'int128' },
      { name: 'summaryValueDecimals', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
] as const;

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────

/**
 * Resolve ERC-8004 addresses for a chain, throwing if unavailable.
 */
export function resolveErc8004Addresses(chainId: number): Erc8004Addresses {
  const addrs = ERC8004_CHAIN_ADDRESSES[chainId];
  if (!addrs) {
    throw new Error(
      `ERC-8004 contracts not available on chain ${chainId}. Supported: 84532 (Base Sepolia), 8453 (Base).`,
    );
  }
  return addrs;
}

function requireValidationRegistry(addrs: Erc8004Addresses): Address {
  if (!addrs.validationRegistry) {
    throw new Error(
      'ValidationRegistry is not yet deployed on this chain. Use Base Sepolia (84532) for testing.',
    );
  }
  return addrs.validationRegistry;
}

/**
 * Generate a deterministic request hash for a validation request.
 * Uses keccak256(abi.encodePacked(agentId, skillHash, auditLevel)).
 */
export function computeRequestHash(
  agentId: bigint,
  skillHash: Hex,
  auditLevel: number,
): Hex {
  return keccak256(
    encodePacked(
      ['uint256', 'bytes32', 'uint8'],
      [agentId, skillHash, auditLevel],
    ),
  );
}

// ──────────────────────────────────────────────
//  Read Operations
// ──────────────────────────────────────────────

/** Get metadata for an ERC-8004 agent identity */
export async function getAgentMetadata(
  client: PublicClient,
  chainId: number,
  agentId: bigint,
  metadataKey: string,
): Promise<Hex> {
  const addrs = resolveErc8004Addresses(chainId);
  const result = await client.readContract({
    address: addrs.identityRegistry,
    abi: identityRegistryAbi,
    functionName: 'getMetadata',
    args: [agentId, metadataKey],
  });
  return result as Hex;
}

/** Get the owner address of an ERC-8004 agent NFT */
export async function getAgentOwner(
  client: PublicClient,
  chainId: number,
  agentId: bigint,
): Promise<Address> {
  const addrs = resolveErc8004Addresses(chainId);
  const result = await client.readContract({
    address: addrs.identityRegistry,
    abi: identityRegistryAbi,
    functionName: 'ownerOf',
    args: [agentId],
  });
  return result as Address;
}

/** Get validation status for a specific request hash */
export async function getValidationStatus(
  client: PublicClient,
  chainId: number,
  requestHash: Hex,
): Promise<ValidationStatus> {
  const addrs = resolveErc8004Addresses(chainId);
  const validationAddr = requireValidationRegistry(addrs);

  const result = (await client.readContract({
    address: validationAddr,
    abi: validationRegistryAbi,
    functionName: 'getValidationStatus',
    args: [requestHash],
  })) as [Address, bigint, number, Hex, string, bigint];

  return {
    validator: result[0],
    agentId: result[1],
    response: result[2],
    responseHash: result[3],
    tag: result[4],
    timestamp: result[5],
  };
}

/** Get aggregated validation summary for an agent */
export async function getValidationSummary(
  client: PublicClient,
  chainId: number,
  agentId: bigint,
  validatorAddresses?: Address[],
  tag?: string,
): Promise<ValidationSummary> {
  const addrs = resolveErc8004Addresses(chainId);
  const validationAddr = requireValidationRegistry(addrs);

  const result = (await client.readContract({
    address: validationAddr,
    abi: validationRegistryAbi,
    functionName: 'getSummary',
    args: [agentId, validatorAddresses ?? [], tag ?? AEGIS_VALIDATION_TAG],
  })) as [bigint, number];

  return {
    count: result[0],
    averageResponse: result[1],
  };
}

/** Get aggregated reputation summary for an agent */
export async function getReputationSummary(
  client: PublicClient,
  chainId: number,
  agentId: bigint,
  clientAddresses?: Address[],
): Promise<ReputationSummary> {
  const addrs = resolveErc8004Addresses(chainId);
  const result = (await client.readContract({
    address: addrs.reputationRegistry,
    abi: reputationRegistryAbi,
    functionName: 'getSummary',
    args: [
      agentId,
      clientAddresses ?? [],
      AEGIS_VALIDATION_TAG,
      AEGIS_REPUTATION_TAG,
    ],
  })) as [bigint, bigint, number];

  return {
    count: result[0],
    summaryValue: result[1],
    summaryValueDecimals: result[2],
  };
}

// ──────────────────────────────────────────────
//  Write Operations
// ──────────────────────────────────────────────

/** Register a new agent in the ERC-8004 IdentityRegistry (mints an ERC-721 NFT) */
export async function registerAgent(
  walletClient: WalletClient<Transport, Chain, Account>,
  chainId: number,
  agentURI: string,
): Promise<{ txHash: Hex }> {
  const addrs = resolveErc8004Addresses(chainId);

  const txHash = await walletClient.writeContract({
    address: addrs.identityRegistry,
    abi: identityRegistryAbi,
    functionName: 'register',
    args: [agentURI],
  });

  return { txHash };
}

/** Set metadata on an ERC-8004 agent (e.g., AEGIS audit results) */
export async function setAgentMetadata(
  walletClient: WalletClient<Transport, Chain, Account>,
  chainId: number,
  agentId: bigint,
  metadataKey: string,
  metadataValue: Hex,
): Promise<Hex> {
  const addrs = resolveErc8004Addresses(chainId);

  return walletClient.writeContract({
    address: addrs.identityRegistry,
    abi: identityRegistryAbi,
    functionName: 'setMetadata',
    args: [agentId, metadataKey, metadataValue],
  });
}

/**
 * Submit a validation request to the ERC-8004 ValidationRegistry.
 * This initiates the validation flow — the validator (AEGIS) then responds.
 */
export async function submitValidationRequest(
  walletClient: WalletClient<Transport, Chain, Account>,
  chainId: number,
  validatorAddress: Address,
  agentId: bigint,
  requestURI: string,
  requestHash: Hex,
): Promise<Hex> {
  const addrs = resolveErc8004Addresses(chainId);
  const validationAddr = requireValidationRegistry(addrs);

  return walletClient.writeContract({
    address: validationAddr,
    abi: validationRegistryAbi,
    functionName: 'validationRequest',
    args: [validatorAddress, agentId, requestURI, requestHash],
  });
}

/**
 * Submit a validation response to the ERC-8004 ValidationRegistry.
 * Called by the validator (AEGIS wallet) after completing the audit.
 */
export async function submitValidationResponse(
  walletClient: WalletClient<Transport, Chain, Account>,
  chainId: number,
  requestHash: Hex,
  response: number,
  responseURI: string,
  responseHash: Hex,
  tag?: string,
): Promise<Hex> {
  const addrs = resolveErc8004Addresses(chainId);
  const validationAddr = requireValidationRegistry(addrs);

  return walletClient.writeContract({
    address: validationAddr,
    abi: validationRegistryAbi,
    functionName: 'validationResponse',
    args: [requestHash, response, responseURI, responseHash, tag ?? AEGIS_VALIDATION_TAG],
  });
}

/** Submit reputation feedback for an agent via ERC-8004 ReputationRegistry */
export async function giveAuditFeedback(
  walletClient: WalletClient<Transport, Chain, Account>,
  chainId: number,
  agentId: bigint,
  score: number,
  feedbackURI: string,
): Promise<Hex> {
  const addrs = resolveErc8004Addresses(chainId);
  const feedbackHash = keccak256(toHex(feedbackURI));

  return walletClient.writeContract({
    address: addrs.reputationRegistry,
    abi: reputationRegistryAbi,
    functionName: 'giveFeedback',
    args: [
      agentId,
      BigInt(score), // value as int128
      0,             // valueDecimals
      AEGIS_VALIDATION_TAG,
      AEGIS_REPUTATION_TAG,
      '',            // endpoint (empty — on-chain validation)
      feedbackURI,
      feedbackHash,
    ],
  });
}

// ──────────────────────────────────────────────
//  Two-Wallet Bridge: AEGIS attestation → ERC-8004
// ──────────────────────────────────────────────

/**
 * Step 1: Request ERC-8004 validation (called by AGENT OWNER).
 *
 * The agent owner submits a validation request to the ERC-8004 ValidationRegistry,
 * naming the AEGIS validator address who will respond. This ensures the trust model
 * is correct: the agent owner requests, a separate validator responds.
 *
 * @returns The deterministic request hash and tx hash.
 */
export async function requestErc8004Validation(
  agentOwnerWallet: WalletClient<Transport, Chain, Account>,
  chainId: number,
  params: RequestErc8004ValidationParams,
): Promise<{
  requestHash: Hex;
  requestTxHash: Hex;
}> {
  // Deterministic request hash from agent + skill + level
  const requestHash = computeRequestHash(
    params.agentId,
    params.skillHash,
    params.auditLevel,
  );

  // Agent owner submits the request, naming the validator
  const requestTxHash = await submitValidationRequest(
    agentOwnerWallet,
    chainId,
    params.validatorAddress,
    params.agentId,
    params.metadataURI,
    requestHash,
  );

  return { requestHash, requestTxHash };
}

/**
 * Step 2: Respond to ERC-8004 validation (called by AEGIS VALIDATOR).
 *
 * The AEGIS validator wallet submits the validation response with the mapped
 * ERC-8004 score (L1→33, L2→66, L3→100). Optionally also submits reputation
 * feedback to the ReputationRegistry.
 *
 * @returns Transaction hashes for the response and optional reputation.
 */
export async function respondToErc8004Validation(
  validatorWallet: WalletClient<Transport, Chain, Account>,
  chainId: number,
  params: RespondToErc8004ValidationParams,
): Promise<{
  responseTxHash: Hex;
  reputationTxHash?: Hex;
}> {
  const score = AUDIT_LEVEL_SCORES[params.auditLevel];
  if (score === undefined) {
    throw new Error(`Invalid audit level: ${params.auditLevel}. Must be 1, 2, or 3.`);
  }

  const responseHash = keccak256(toHex(params.metadataURI));

  // Validator submits the response with the AEGIS score
  const responseTxHash = await submitValidationResponse(
    validatorWallet,
    chainId,
    params.requestHash,
    score,
    params.metadataURI,
    responseHash,
  );

  // Optional: Submit reputation feedback
  let reputationTxHash: Hex | undefined;
  if (params.includeReputation !== false) {
    reputationTxHash = await giveAuditFeedback(
      validatorWallet,
      chainId,
      params.agentId,
      score,
      params.metadataURI,
    );
  }

  return { responseTxHash, reputationTxHash };
}

// ──────────────────────────────────────────────
//  Agent Registration Helper
// ──────────────────────────────────────────────

/**
 * Generate an ERC-8004 agent registration JSON.
 * This creates the metadata file that should be hosted at the agentURI.
 */
export function createAgentRegistration(
  params: Omit<AgentRegistration, 'agentURI'>,
): Record<string, unknown> {
  return {
    '@context': 'https://erc8004.org/v1',
    '@type': 'Agent',
    name: params.name,
    description: params.description,
    services: params.services ?? [],
    skills: (params.skills ?? []).map((s) => ({
      skillHash: s.skillHash,
      auditLevel: s.auditLevel,
      metadataURI: s.metadataURI,
      validationProvider: 'aegis-protocol',
    })),
    ...(params.x402Support
      ? {
          x402Support: {
            paymentAddress: params.x402Support.paymentAddress,
            acceptedTokens: params.x402Support.acceptedTokens,
          },
        }
      : {}),
  };
}
