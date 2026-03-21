/**
 * Bittensor TAO data provider for the indexer.
 *
 * Queries the Finney subtensor RPC for subnet and metagraph data,
 * caches results, and cross-references AEGIS subgraph for attestation status.
 *
 * Metagraph data is decoded from NeuronInfoLite SCALE responses — no external
 * SCALE codec dependency required.
 */

import { keccak256, toHex, type Hex } from 'viem';

// ── Config ──────────────────────────────────────────────

const SUBTENSOR_URL =
  process.env.BITTENSOR_RPC_URL ?? 'https://entrypoint-finney.opentensor.ai:443';

const SUBGRAPH_URL =
  process.env.AEGIS_SUBGRAPH_URL ??
  'https://api.studio.thegraph.com/query/1743315/aegis-protocol/v0.2.0';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_NEURONS_PER_SUBNET = 256;

// ── Types ───────────────────────────────────────────────

export interface TaoSubnetEntry {
  netuid: number;
  name: string;
  minerCount: number;
  validatorCount: number;
  aegisSkillHash: string;
  attested: boolean;
  attestationCount: number;
}

export interface TaoMinerEntry {
  hotkey: string;
  uid: number;
  stake: string;
  trust: number;
  consensus: number;
  incentive: number;
  dividends: number;
  emission: string;
  axon: string | null;
  isValidator: boolean;
  aegisSkillHash: string;
  attestationCount: number;
  audited: boolean;
}

export interface TaoStats {
  totalSubnets: number;
  totalNodes: number;
  attestedSubnets: number;
  attestedMiners: number;
}

// Subnet names are now fetched on-chain via SubnetInfoRuntimeApi_get_subnets_info_v2
// which includes SubnetIdentityV3 with subnet_name field.

// ── Skill hash derivation ───────────────────────────────

function computeTaoSubnetHash(netuid: number): Hex {
  return keccak256(toHex(`tao:subnet:${netuid}`));
}

function computeTaoMinerHash(netuid: number, hotkey: string): Hex {
  return keccak256(toHex(`tao:miner:${netuid}:${hotkey}`));
}

// ── RPC helpers ─────────────────────────────────────────

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(SUBTENSOR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Subtensor RPC HTTP ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

// ── SCALE decoding primitives ───────────────────────────

function hexToBytes(hex: string): number[] {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return bytes;
}

function decodeCompactLength(bytes: number[], offset: number): { value: number; bytesRead: number } {
  const mode = bytes[offset] & 0x03;
  if (mode === 0) return { value: bytes[offset] >> 2, bytesRead: 1 };
  if (mode === 1) {
    const val = (bytes[offset] | (bytes[offset + 1] << 8)) >> 2;
    return { value: val, bytesRead: 2 };
  }
  if (mode === 2) {
    const val = (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 2;
    return { value: val, bytesRead: 4 };
  }
  // mode 3: big integer — read length from upper 6 bits + 4, then that many bytes
  const len = (bytes[offset] >> 2) + 4;
  let val = 0n;
  for (let i = 0; i < len && i < 8; i++) {
    val |= BigInt(bytes[offset + 1 + i]) << BigInt(i * 8);
  }
  return { value: Number(val), bytesRead: 1 + len };
}

function readU16LE(bytes: number[], off: number): number {
  return bytes[off] | (bytes[off + 1] << 8);
}

function bytesToHex(bytes: number[], start: number, len: number): string {
  return '0x' + bytes.slice(start, start + len).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── NeuronInfoLite SCALE parser ─────────────────────────

interface ParsedNeuron {
  hotkey: string;
  uid: number;
  active: boolean;
  stake: bigint;        // total stake in rao
  rank: number;         // raw u16
  emission: bigint;     // raw u64
  incentive: number;    // raw u16
  consensus: number;    // raw u16
  trust: number;        // raw u16
  validatorTrust: number; // raw u16
  dividends: number;    // raw u16
  validatorPermit: boolean;
  axonIp: string | null;
  axonPort: number;
}

/**
 * Parse a single NeuronInfoLite from SCALE-encoded bytes.
 * Returns parsed neuron + total bytes consumed, or null on failure.
 *
 * Field order (from subtensor source):
 *   hotkey(32) coldkey(32) uid(compact) netuid(compact) active(bool)
 *   axon_info(32) prometheus_info(31) stake(Vec<(AccountId,Compact<u64>)>)
 *   rank(compact) emission(compact) incentive(compact) consensus(compact)
 *   trust(compact) validator_trust(compact) dividends(compact)
 *   last_update(Vec<compact>) validator_permit(bool) pruning_score(compact)
 */
function parseNeuronInfoLite(bytes: number[], offset: number): { neuron: ParsedNeuron; bytesRead: number } | null {
  try {
    let pos = offset;

    // 1. hotkey — AccountId32 (32 bytes)
    const hotkey = bytesToHex(bytes, pos, 32);
    pos += 32;

    // 2. coldkey — AccountId32 (32 bytes) — skip
    pos += 32;

    // 3. uid — Compact<u16>
    const uidDec = decodeCompactLength(bytes, pos);
    const uid = uidDec.value;
    pos += uidDec.bytesRead;

    // 4. netuid — Compact<u16> — skip value
    const netuidDec = decodeCompactLength(bytes, pos);
    pos += netuidDec.bytesRead;

    // 5. active — bool (1 byte)
    const active = bytes[pos] !== 0;
    pos += 1;

    // 6. axon_info — AxonInfo { block: u64, version: u32, ip: u128, port: u16, ip_type: u8, protocol: u8, placeholder1: u8, placeholder2: u8 }
    //    = 8 + 4 + 16 + 2 + 1 + 1 + 1 + 1 = 34 bytes
    const axonIpBytes = bytes.slice(pos + 12, pos + 28); // ip field at offset 12 (after block+version)
    const axonPort = readU16LE(bytes, pos + 28);          // port at offset 28
    const axonIpType = bytes[pos + 30];                    // ip_type at offset 30

    // Parse IPv4 from u128 (stored LE, IPv4 uses lower 4 bytes)
    let axonIp: string | null = null;
    if (axonIpType === 4 && axonPort > 0) {
      // IPv4: lower 4 bytes of u128 in LE
      axonIp = `${axonIpBytes[0]}.${axonIpBytes[1]}.${axonIpBytes[2]}.${axonIpBytes[3]}:${axonPort}`;
    }
    pos += 34;

    // 7. prometheus_info — PrometheusInfo { block: u64, version: u32, ip: u128, port: u16, ip_type: u8 }
    //    = 8 + 4 + 16 + 2 + 1 = 31 bytes
    pos += 31;

    // 8. stake — Vec<(AccountId32, Compact<u64>)>
    const stakeVecLen = decodeCompactLength(bytes, pos);
    pos += stakeVecLen.bytesRead;
    let totalStake = 0n;
    for (let i = 0; i < stakeVecLen.value; i++) {
      pos += 32; // skip AccountId32
      const stakeDec = decodeCompactLength(bytes, pos);
      totalStake += BigInt(stakeDec.value);
      pos += stakeDec.bytesRead;
    }

    // 9. rank — Compact<u16>
    const rankDec = decodeCompactLength(bytes, pos);
    pos += rankDec.bytesRead;

    // 10. emission — Compact<u64>
    const emissionDec = decodeCompactLength(bytes, pos);
    pos += emissionDec.bytesRead;

    // 11. incentive — Compact<u16>
    const incentiveDec = decodeCompactLength(bytes, pos);
    pos += incentiveDec.bytesRead;

    // 12. consensus — Compact<u16>
    const consensusDec = decodeCompactLength(bytes, pos);
    pos += consensusDec.bytesRead;

    // 13. trust — Compact<u16>
    const trustDec = decodeCompactLength(bytes, pos);
    pos += trustDec.bytesRead;

    // 14. validator_trust — Compact<u16>
    const validatorTrustDec = decodeCompactLength(bytes, pos);
    pos += validatorTrustDec.bytesRead;

    // 15. dividends — Compact<u16>
    const dividendsDec = decodeCompactLength(bytes, pos);
    pos += dividendsDec.bytesRead;

    // 16. last_update — Compact<u64>
    pos += decodeCompactLength(bytes, pos).bytesRead;

    // 17. validator_permit — bool (1 byte)
    const validatorPermit = bytes[pos] !== 0;
    pos += 1;

    // 18. pruning_score — Compact<u16>
    const pruningDec = decodeCompactLength(bytes, pos);
    pos += pruningDec.bytesRead;

    return {
      neuron: {
        hotkey,
        uid,
        active,
        stake: totalStake,
        rank: rankDec.value,
        emission: BigInt(emissionDec.value),
        incentive: incentiveDec.value,
        consensus: consensusDec.value,
        trust: trustDec.value,
        validatorTrust: validatorTrustDec.value,
        dividends: dividendsDec.value,
        validatorPermit,
        axonIp,
        axonPort,
      },
      bytesRead: pos - offset,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Parse all NeuronInfoLite entries from a SCALE Vec<NeuronInfoLite> response.
 */
function parseNeuronsLite(hex: string): ParsedNeuron[] {
  const bytes = hexToBytes(hex);
  if (bytes.length < 2) return [];

  const { value: neuronCount, bytesRead } = decodeCompactLength(bytes, 0);
  let offset = bytesRead;
  const neurons: ParsedNeuron[] = [];

  for (let i = 0; i < Math.min(neuronCount, MAX_NEURONS_PER_SUBNET); i++) {
    const result = parseNeuronInfoLite(bytes, offset);
    if (!result) {
      console.warn(`[tao] Failed to parse neuron ${i}/${neuronCount} at offset ${offset}, stopping`);
      break;
    }
    neurons.push(result.neuron);
    offset += result.bytesRead;
  }

  return neurons;
}

// ── Subgraph query ──────────────────────────────────────

const SKILL_EXISTS_QUERY = `
  query CheckSkills($ids: [String!]!) {
    skills(where: { id_in: $ids }) {
      id
      attestationCount
    }
  }
`;

async function querySubgraphBatch(skillHashes: string[]): Promise<Record<string, number>> {
  if (skillHashes.length === 0) return {};
  try {
    const res = await fetch(SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: SKILL_EXISTS_QUERY,
        variables: { ids: skillHashes.map(h => h.toLowerCase()) },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return {};
    const json = (await res.json()) as {
      data?: { skills: Array<{ id: string; attestationCount: number }> };
    };
    if (!json.data) return {};
    return Object.fromEntries(json.data.skills.map(s => [s.id, s.attestationCount]));
  } catch {
    return {};
  }
}

// ── Cache ───────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const subnetCache: { entry: CacheEntry<TaoSubnetEntry[]> | null } = { entry: null };
const metagraphCache = new Map<number, CacheEntry<TaoMinerEntry[]>>();

// ── SubnetInfo SCALE parser ─────────────────────────────

interface ParsedSubnetInfo {
  netuid: number;
  subnetworkN: number;
  name?: string;
}

/**
 * Read a SCALE BoundedVec<u8> (compact length + raw bytes) and return as UTF-8 string.
 */
function decodeBoundedVecString(bytes: number[], pos: number): { value: string; bytesRead: number } {
  const lenDec = decodeCompactLength(bytes, pos);
  const strBytes = bytes.slice(pos + lenDec.bytesRead, pos + lenDec.bytesRead + lenDec.value);
  const value = new TextDecoder().decode(new Uint8Array(strBytes));
  return { value, bytesRead: lenDec.bytesRead + lenDec.value };
}

/**
 * Parse a single SubnetInfov2 entry from SCALE bytes starting at `pos`.
 * Returns the parsed info + bytes consumed, or null on failure.
 *
 * SubnetInfov2 layout:
 *   1.netuid(compact) 2.rho(compact) 3.kappa(compact) 4.difficulty(compact)
 *   5.immunity_period(compact) 6.max_allowed_validators(compact)
 *   7.min_allowed_weights(compact) 8.max_weights_limit(compact)
 *   9.scaling_law_power(compact) 10.subnetwork_n(compact)
 *   11.max_allowed_uids(compact) 12.blocks_since_last_step(compact)
 *   13.tempo(compact) 14.network_modality(compact)
 *   15.network_connect(Vec<[u16;2]>) 16.emission_values(compact)
 *   17.burn(compact) 18.owner(AccountId32=32B)
 *   19.identity(Option<SubnetIdentityV3>)
 *       SubnetIdentityV3: subnet_name, github_repo, subnet_contact,
 *         subnet_url, discord, description, additional, logo_url
 *         (all BoundedVec<u8>)
 */
function parseSubnetInfoEntry(bytes: number[], startPos: number): { info: ParsedSubnetInfo; bytesRead: number } | null {
  try {
    let pos = startPos;

    // Fields 1-9: compact values (extract netuid from field 1)
    const netuidDec = decodeCompactLength(bytes, pos);
    const netuid = netuidDec.value;
    pos += netuidDec.bytesRead;

    // Skip fields 2-9 (8 compact values)
    for (let i = 0; i < 8; i++) {
      pos += decodeCompactLength(bytes, pos).bytesRead;
    }

    // Field 10: subnetwork_n (compact)
    const subnetworkNDec = decodeCompactLength(bytes, pos);
    const subnetworkN = subnetworkNDec.value;
    pos += subnetworkNDec.bytesRead;

    // Field 11-14: 4 more compact values
    for (let i = 0; i < 4; i++) {
      pos += decodeCompactLength(bytes, pos).bytesRead;
    }

    // Field 15: network_connect — Vec<[u16; 2]>
    const vecLen = decodeCompactLength(bytes, pos);
    pos += vecLen.bytesRead;
    pos += vecLen.value * 4; // each entry is [u16, u16] = 4 bytes

    // Field 16-17: emission_values, burn (compact)
    pos += decodeCompactLength(bytes, pos).bytesRead;
    pos += decodeCompactLength(bytes, pos).bytesRead;

    // Field 18: owner — AccountId32 (32 bytes)
    pos += 32;

    // Field 19: identity — Option<SubnetIdentityV3>
    let name: string | undefined;
    if (pos < bytes.length) {
      const optByte = bytes[pos];
      pos += 1;
      if (optByte === 1) {
        // Some — parse SubnetIdentityV3 (8 BoundedVec<u8> fields)
        // First field is subnet_name
        const nameDec = decodeBoundedVecString(bytes, pos);
        name = nameDec.value || undefined;
        pos += nameDec.bytesRead;
        // Skip remaining 7 fields: github_repo, subnet_contact, subnet_url,
        // discord, description, additional, logo_url
        for (let i = 0; i < 7; i++) {
          const fieldDec = decodeCompactLength(bytes, pos);
          pos += fieldDec.bytesRead + fieldDec.value;
        }
      }
      // optByte === 0 means None — no identity, name stays undefined
    }

    return { info: { netuid, subnetworkN, name }, bytesRead: pos - startPos };
  } catch {
    return null;
  }
}

/**
 * Parse all subnets from a get_subnets_info SCALE response.
 * Response format: Vec<Option<SubnetInfo>>
 */
function parseAllSubnetInfos(hex: string): ParsedSubnetInfo[] {
  const bytes = hexToBytes(hex);
  if (bytes.length < 2) return [];

  const { value: vecLen, bytesRead } = decodeCompactLength(bytes, 0);
  let pos = bytesRead;
  const results: ParsedSubnetInfo[] = [];

  for (let i = 0; i < vecLen; i++) {
    if (pos >= bytes.length) break;
    const optionByte = bytes[pos];
    pos += 1;

    if (optionByte === 0) continue; // None — subnet doesn't exist
    if (optionByte !== 1) break;    // Unexpected byte — stop parsing

    // Some — parse SubnetInfo
    const parsed = parseSubnetInfoEntry(bytes, pos);
    if (!parsed) break;
    results.push(parsed.info);
    pos += parsed.bytesRead;
  }

  return results;
}

// ── Public API ──────────────────────────────────────────

/**
 * Fetch all active Bittensor subnets with AEGIS attestation status.
 */
export async function fetchTaoSubnets(): Promise<TaoSubnetEntry[]> {
  // Check cache
  if (subnetCache.entry && Date.now() - subnetCache.entry.timestamp < CACHE_TTL) {
    return subnetCache.entry.data;
  }

  // Single bulk call to get all subnet info (v2 includes on-chain identity/name)
  const bulkHex = await rpcCall<string>('state_call', [
    'SubnetInfoRuntimeApi_get_subnets_info_v2', '0x',
  ]);
  const discovered = parseAllSubnetInfos(bulkHex);

  // Build subnet entries
  const subnets: TaoSubnetEntry[] = [];
  const hashes: string[] = [];

  for (const { netuid, subnetworkN, name: onChainName } of discovered) {
    const hash = computeTaoSubnetHash(netuid);
    hashes.push(hash);
    subnets.push({
      netuid,
      name: onChainName || `Subnet ${netuid}`,
      minerCount: subnetworkN,
      validatorCount: 0,
      aegisSkillHash: hash,
      attested: false,
      attestationCount: 0,
    });
  }

  // Phase 4: Cross-reference subgraph for attestation status
  const auditedMap = await querySubgraphBatch(hashes);
  for (const s of subnets) {
    const count = auditedMap[s.aegisSkillHash.toLowerCase()] ?? 0;
    s.attested = count > 0;
    s.attestationCount = count;
  }

  subnetCache.entry = { data: subnets, timestamp: Date.now() };
  return subnets;
}

/**
 * Fetch metagraph (miners/validators) for a specific subnet.
 */
export async function fetchTaoMetagraph(netuid: number): Promise<TaoMinerEntry[]> {
  // Check cache
  const cached = metagraphCache.get(netuid);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const netuidBytes = new Uint8Array([netuid & 0xff, (netuid >> 8) & 0xff]);
  const result = await rpcCall<string | null>('state_call', [
    'NeuronInfoRuntimeApi_get_neurons_lite', toHex(netuidBytes),
  ]);

  if (!result || result.length <= 4) {
    return [];
  }

  // Parse NeuronInfoLite SCALE response
  const neurons = parseNeuronsLite(result);

  // Build miner entries with real data
  const miners: TaoMinerEntry[] = [];
  const hashes: string[] = [];

  for (const n of neurons) {
    const hash = computeTaoMinerHash(netuid, n.hotkey);
    hashes.push(hash);

    // Convert rao to TAO string (1 TAO = 1e9 rao)
    const stakeTao = Number(n.stake) / 1e9;
    // Convert u16 metrics to 0.0-1.0 range
    const trust = n.trust / 65535;
    const consensus = n.consensus / 65535;
    const incentive = n.incentive / 65535;
    const dividends = n.dividends / 65535;
    // Emission is in rao per tempo
    const emission = n.emission.toString();

    miners.push({
      hotkey: n.hotkey,
      uid: n.uid,
      stake: stakeTao.toFixed(4),
      trust: Math.round(trust * 10000) / 10000,
      consensus: Math.round(consensus * 10000) / 10000,
      incentive: Math.round(incentive * 10000) / 10000,
      dividends: Math.round(dividends * 10000) / 10000,
      emission,
      axon: n.axonIp,
      isValidator: n.validatorPermit,
      aegisSkillHash: hash,
      attestationCount: 0,
      audited: false,
    });
  }

  // Cross-reference subgraph for attestation status
  const auditedMap = await querySubgraphBatch(hashes);
  for (const m of miners) {
    const count = auditedMap[m.aegisSkillHash.toLowerCase()] ?? 0;
    m.audited = count > 0;
    m.attestationCount = count;
  }

  metagraphCache.set(netuid, { data: miners, timestamp: Date.now() });
  return miners;
}

/**
 * Get aggregate TAO stats.
 */
export async function fetchTaoStats(): Promise<TaoStats> {
  const subnets = await fetchTaoSubnets();
  const totalNodes = subnets.reduce((sum, s) => sum + s.minerCount, 0);
  const attestedSubnets = subnets.filter(s => s.attested).length;

  return {
    totalSubnets: subnets.length,
    totalNodes,
    attestedSubnets,
    attestedMiners: 0, // Would require scanning all metagraphs
  };
}
