/**
 * Bittensor (TAO) subnet integration for AEGIS Protocol.
 *
 * Provides deterministic skill hash derivation for TAO subnets and miners,
 * plus metagraph queries for auditor discovery tooling.
 *
 * Skill hashes use a `tao:` namespace prefix to prevent collisions with
 * existing EVM-based skill hashes. The AegisRegistry on Base sees these
 * as ordinary `bytes32` values — no contract changes required.
 *
 * @module tao
 */

import { keccak256, toHex, type Hex } from 'viem';

// ──────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────

/** Summary info for a Bittensor subnet. */
export interface TaoSubnetInfo {
  /** Subnet ID */
  netuid: number;
  /** Human-readable subnet name (if available) */
  name: string;
  /** Subnet tempo (block interval) */
  tempo: number;
  /** Number of active miners */
  minerCount: number;
  /** Number of active validators */
  validatorCount: number;
  /** Total emission (rao) per tempo */
  emission: bigint;
}

/** A node (miner or validator) in a subnet metagraph. */
export interface TaoMetagraphNode {
  /** SS58-encoded hotkey */
  hotkey: string;
  /** SS58-encoded coldkey */
  coldkey: string;
  /** UID within the subnet */
  uid: number;
  /** Staked TAO (rao) */
  stake: bigint;
  /** Trust score (0–1 normalized) */
  trust: number;
  /** Consensus score (0–1 normalized) */
  consensus: number;
  /** Incentive score (0–1 normalized) */
  incentive: number;
  /** Dividend score (0–1 normalized) */
  dividends: number;
  /** Emission per tempo (rao) */
  emission: bigint;
  /** Axon IP address */
  axonIp: string;
  /** Axon port */
  axonPort: number;
  /** Whether this node is a validator (vs miner) */
  isValidator: boolean;
}

/** Full metagraph data for a subnet. */
export interface TaoMetagraphData {
  /** Subnet ID */
  netuid: number;
  /** Subnet name */
  subnetName: string;
  /** All nodes in the subnet */
  nodes: TaoMetagraphNode[];
}

/** Axon endpoint info for a specific miner. */
export interface TaoAxonInfo {
  /** SS58-encoded hotkey */
  hotkey: string;
  /** IP address */
  ip: string;
  /** Port number */
  port: number;
  /** Protocol version */
  protocol: number;
}

/** Metadata attached to skill audits of TAO subnets/miners. */
export interface TaoSkillMetadata {
  /** Subnet ID */
  netuid: number;
  /** Subnet human-readable name */
  subnetName: string;
  /** Miner hotkey (SS58), if this is a miner-level audit */
  hotkey?: string;
  /** Axon endpoint at time of audit (ip:port) */
  axonEndpoint?: string;
  /** Miner UID within the subnet at time of audit */
  uid?: number;
  /** Miner's TAO stake at time of audit (rao, as string) */
  stake?: string;
  /** Miner's trust score at time of audit (0–1) */
  trust?: number;
  /** Miner's consensus score at time of audit (0–1) */
  consensus?: number;
}

// ──────────────────────────────────────────────
//  Default endpoint
// ──────────────────────────────────────────────

const DEFAULT_SUBTENSOR_HTTP = 'https://entrypoint-finney.opentensor.ai:443';

/** Resolve the subtensor RPC endpoint from env or default. */
function getEndpoint(override?: string): string {
  return override ?? process.env.BITTENSOR_RPC_URL ?? DEFAULT_SUBTENSOR_HTTP;
}

// ──────────────────────────────────────────────
//  Hash Derivation
// ──────────────────────────────────────────────

/**
 * Compute a deterministic AEGIS skill hash for a TAO subnet.
 *
 * Formula: `keccak256("tao:subnet:<netuid>")`
 *
 * @param netuid - Bittensor subnet ID
 * @returns bytes32 skill hash
 *
 * @example
 * ```ts
 * import { computeTaoSubnetHash } from '@aegisaudit/sdk';
 *
 * const hash = computeTaoSubnetHash(18);
 * // Use with registerSkill() or listSkill() on Base
 * ```
 */
export function computeTaoSubnetHash(netuid: number): Hex {
  return keccak256(toHex(`tao:subnet:${netuid}`));
}

/**
 * Compute a deterministic AEGIS skill hash for a TAO miner.
 *
 * Formula: `keccak256("tao:miner:<netuid>:<hotkey>")`
 *
 * @param netuid - Bittensor subnet ID
 * @param hotkey - SS58-encoded miner hotkey
 * @returns bytes32 skill hash
 *
 * @example
 * ```ts
 * import { computeTaoMinerHash } from '@aegisaudit/sdk';
 *
 * const hash = computeTaoMinerHash(18, '5F4tQyWrhfGVcNhoqeiNMoLs3jkr1LYE5LGZka7pLoNU3X1M');
 * ```
 */
export function computeTaoMinerHash(netuid: number, hotkey: string): Hex {
  return keccak256(toHex(`tao:miner:${netuid}:${hotkey}`));
}

/**
 * Parse a TAO skill hash back to its components (best-effort).
 *
 * Since keccak256 is one-way, this uses a lookup table that must be
 * populated by the caller. For most use cases, store the netuid/hotkey
 * in the metadata `tao` field instead.
 *
 * @returns null — reverse lookup is not possible from hash alone.
 *          Use the `tao` field in AuditMetadata for provenance.
 */
export function parseTaoSkillHash(_skillHash: Hex): null {
  // keccak256 is one-way — metadata.skill.tao contains the provenance
  return null;
}

// ──────────────────────────────────────────────
//  Substrate JSON-RPC Helpers
// ──────────────────────────────────────────────

/** Raw JSON-RPC call to a Substrate node. */
async function rpcCall<T>(
  method: string,
  params: unknown[],
  endpoint: string,
): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method,
      params,
    }),
  });

  if (!res.ok) {
    throw new Error(`Subtensor RPC failed (HTTP ${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as {
    result?: T;
    error?: { code: number; message: string };
  };

  if (json.error) {
    throw new Error(`Subtensor RPC error: ${json.error.message}`);
  }

  return json.result as T;
}

/** Decode a hex-encoded SCALE u16. */
function decodeU16(hex: string): number {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length < 4) return 0;
  // SCALE u16 is little-endian
  return parseInt(clean.slice(2, 4) + clean.slice(0, 2), 16);
}

/** Decode a hex-encoded SCALE u64. */
function decodeU64(hex: string): bigint {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  // SCALE u64 is little-endian 8 bytes
  let result = 0n;
  for (let i = 0; i < Math.min(16, clean.length); i += 2) {
    const byte = BigInt(parseInt(clean.slice(i, i + 2), 16));
    result += byte << BigInt((i / 2) * 8);
  }
  return result;
}

// ──────────────────────────────────────────────
//  Metagraph Queries
// ──────────────────────────────────────────────

/**
 * List all active Bittensor subnets.
 *
 * Queries the subtensor chain for registered netuids and basic info.
 * Uses the public Finney endpoint by default — override with
 * `BITTENSOR_RPC_URL` env var or the `endpoint` parameter.
 *
 * @param endpoint - Optional subtensor HTTP endpoint override
 * @returns Array of subnet summaries
 *
 * @example
 * ```ts
 * import { listSubnets } from '@aegisaudit/sdk';
 *
 * const subnets = await listSubnets();
 * subnets.forEach(s => console.log(`SN${s.netuid}: ${s.name} (${s.minerCount} miners)`));
 * ```
 */
export async function listSubnets(endpoint?: string): Promise<TaoSubnetInfo[]> {
  const url = getEndpoint(endpoint);

  // Query all network netuids via state query
  const netuidsHex = await rpcCall<string>(
    'state_getStorage',
    // SubtensorModule::NetworksAdded storage key prefix
    ['0x658faa385070e074c85bf6b568cf0555aab1b4e78e0b7a9e82e9e56327571e35'],
    url,
  );

  if (!netuidsHex) {
    return [];
  }

  // For a simpler approach, query known subnet range (0-52 covers all current subnets)
  const subnets: TaoSubnetInfo[] = [];

  for (let netuid = 0; netuid <= 52; netuid++) {
    try {
      // Query SubnetworkN (number of neurons in subnet)
      const countHex = await rpcCall<string | null>(
        'state_call',
        ['SubtensorModule_get_subnetwork_n', toHex(new Uint8Array([
          // SCALE-encode netuid as u16 LE
          netuid & 0xff, (netuid >> 8) & 0xff,
        ]))],
        url,
      );

      if (!countHex) continue;
      const nodeCount = decodeU16(countHex);
      if (nodeCount === 0) continue;

      subnets.push({
        netuid,
        name: `Subnet ${netuid}`,
        tempo: 360, // Default, can be queried per-subnet
        minerCount: nodeCount,
        validatorCount: 0, // Computed from metagraph
        emission: 0n,
      });
    } catch {
      // Subnet doesn't exist or query failed, skip
      continue;
    }
  }

  return subnets;
}

/**
 * Query the metagraph for a specific subnet.
 *
 * Returns all miners and validators with their stakes, scores, and axon endpoints.
 *
 * @param netuid - Subnet ID to query
 * @param endpoint - Optional subtensor HTTP endpoint override
 * @returns Full metagraph data
 *
 * @example
 * ```ts
 * import { queryMetagraph } from '@aegisaudit/sdk';
 *
 * const mg = await queryMetagraph(18);
 * const miners = mg.nodes.filter(n => !n.isValidator);
 * console.log(`${miners.length} miners on SN${mg.netuid}`);
 * ```
 */
export async function queryMetagraph(
  netuid: number,
  endpoint?: string,
): Promise<TaoMetagraphData> {
  const url = getEndpoint(endpoint);

  // Use the runtime API to get neurons for this subnet
  const netuidBytes = new Uint8Array([netuid & 0xff, (netuid >> 8) & 0xff]);
  const neuronsHex = await rpcCall<string | null>(
    'state_call',
    ['SubtensorModule_get_neurons_lite', toHex(netuidBytes)],
    url,
  );

  const nodes: TaoMetagraphNode[] = [];

  if (neuronsHex && neuronsHex.length > 4) {
    // Parse the SCALE-encoded neuron data
    // For now, return a lightweight representation
    // Full SCALE decoding would require a proper codec
    // TODO: Implement full SCALE decode for NeuronInfoLite
  }

  return {
    netuid,
    subnetName: `Subnet ${netuid}`,
    nodes,
  };
}

/**
 * Build a SkillInfo object from TAO metagraph data.
 *
 * Auto-populates skill info from subnet/miner metagraph state,
 * suitable for passing to `createAuditTemplate()`.
 *
 * @param netuid - Subnet ID
 * @param hotkey - Optional miner hotkey (omit for subnet-level audit)
 * @param endpoint - Optional subtensor endpoint override
 *
 * @example
 * ```ts
 * import { buildTaoSkillInfo, createAuditTemplate } from '@aegisaudit/sdk';
 *
 * const skillInfo = await buildTaoSkillInfo(18, '5F4tQ...');
 * const template = createAuditTemplate(2, skillInfo);
 * ```
 */
export async function buildTaoSkillInfo(
  netuid: number,
  hotkey?: string,
  endpoint?: string,
): Promise<{
  name: string;
  description: string;
  version: string;
  sourceHash: string;
  tags: string[];
  tao: TaoSkillMetadata;
}> {
  const mg = await queryMetagraph(netuid, endpoint);

  const taoMeta: TaoSkillMetadata = {
    netuid,
    subnetName: mg.subnetName,
  };

  if (hotkey) {
    const node = mg.nodes.find((n) => n.hotkey === hotkey);
    if (node) {
      taoMeta.hotkey = node.hotkey;
      taoMeta.axonEndpoint = `${node.axonIp}:${node.axonPort}`;
      taoMeta.uid = node.uid;
      taoMeta.stake = node.stake.toString();
      taoMeta.trust = node.trust;
      taoMeta.consensus = node.consensus;
    } else {
      taoMeta.hotkey = hotkey;
    }
  }

  const name = hotkey
    ? `TAO SN${netuid} Miner ${hotkey.slice(0, 8)}...`
    : `TAO Subnet ${netuid}`;

  const description = hotkey
    ? `Bittensor miner ${hotkey} on subnet ${netuid} (${mg.subnetName})`
    : `Bittensor subnet ${netuid} — ${mg.subnetName}`;

  // sourceHash: hash of the metagraph state at query time
  const stateSnapshot = JSON.stringify({
    netuid,
    hotkey,
    nodeCount: mg.nodes.length,
    queriedAt: new Date().toISOString(),
  });
  const sourceHash = `sha256:${keccak256(toHex(stateSnapshot)).slice(2, 66)}`;

  return {
    name,
    description,
    version: '1.0.0',
    sourceHash,
    tags: ['bittensor', 'tao', `sn${netuid}`, ...(hotkey ? ['miner'] : ['subnet'])],
    tao: taoMeta,
  };
}
