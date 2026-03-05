import { useState, useEffect, useRef } from "react";
import {
  createPublicClient,
  http,
  formatEther,
  type Hex,
  type Address,
} from "viem";
import { base } from "viem/chains";
import { REGISTRY_ADDRESS } from "../config";

// ── Constants ─────────────────────────────────────────────
const REGISTRY = REGISTRY_ADDRESS[8453];
const DEPLOYMENT_BLOCK = 42940673n;
const CHUNK_SIZE = 9_999n;

// ── Singleton read-only client (no wallet needed) ─────────
const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

// ── ABI event fragments ───────────────────────────────────
const skillListedEvent = {
  type: "event" as const,
  name: "SkillListed" as const,
  inputs: [
    { name: "skillHash", type: "bytes32" as const, indexed: true },
    { name: "publisher", type: "address" as const, indexed: true },
    { name: "metadataURI", type: "string" as const, indexed: false },
  ],
} as const;

const skillRegisteredEvent = {
  type: "event" as const,
  name: "SkillRegistered" as const,
  inputs: [
    { name: "skillHash", type: "bytes32" as const, indexed: true },
    { name: "auditLevel", type: "uint8" as const, indexed: false },
    { name: "auditorCommitment", type: "bytes32" as const, indexed: true },
  ],
} as const;

const auditorRegisteredEvent = {
  type: "event" as const,
  name: "AuditorRegistered" as const,
  inputs: [
    { name: "auditorCommitment", type: "bytes32" as const, indexed: true },
    { name: "stake", type: "uint256" as const, indexed: false },
  ],
} as const;

const stakeAddedEvent = {
  type: "event" as const,
  name: "StakeAdded" as const,
  inputs: [
    { name: "auditorCommitment", type: "bytes32" as const, indexed: true },
    { name: "amount", type: "uint256" as const, indexed: false },
  ],
} as const;

const disputeOpenedEvent = {
  type: "event" as const,
  name: "DisputeOpened" as const,
  inputs: [
    { name: "disputeId", type: "uint256" as const, indexed: true },
    { name: "skillHash", type: "bytes32" as const, indexed: true },
  ],
} as const;

// ── ABI function fragments ────────────────────────────────
const metadataURIsAbi = {
  name: "metadataURIs" as const,
  type: "function" as const,
  stateMutability: "view" as const,
  inputs: [{ name: "", type: "bytes32" as const }],
  outputs: [{ name: "", type: "string" as const }],
} as const;

const getAttestationsAbi = {
  name: "getAttestations" as const,
  type: "function" as const,
  stateMutability: "view" as const,
  inputs: [{ name: "skillHash", type: "bytes32" as const }],
  outputs: [
    {
      name: "",
      type: "tuple[]" as const,
      components: [
        { name: "skillHash", type: "bytes32" as const },
        { name: "auditCriteriaHash", type: "bytes32" as const },
        { name: "zkProof", type: "bytes32" as const },
        { name: "auditorCommitment", type: "bytes32" as const },
        { name: "stakeAmount", type: "uint256" as const },
        { name: "timestamp", type: "uint256" as const },
        { name: "auditLevel", type: "uint8" as const },
      ],
    },
  ],
} as const;

// ── Metadata parsing ──────────────────────────────────────
interface SkillMetadata {
  name: string;
  description: string;
  category: string;
  version: string;
}

function parseMetadataURI(uri: string): SkillMetadata {
  const fallback: SkillMetadata = {
    name: "Unknown Skill",
    description: "",
    category: "Uncategorized",
    version: "0.0.0",
  };
  try {
    if (!uri) return fallback;
    if (uri.startsWith("data:")) {
      // data:application/json;base64,<base64>
      const commaIdx = uri.indexOf(",");
      if (commaIdx === -1) return fallback;
      const payload = uri.slice(commaIdx + 1);
      const isBase64 = uri.slice(0, commaIdx).includes("base64");
      const jsonStr = isBase64 ? atob(payload) : decodeURIComponent(payload);
      const json = JSON.parse(jsonStr);
      return {
        name: json.name || fallback.name,
        description: json.description || "",
        category: json.category || fallback.category,
        version: json.version || fallback.version,
      };
    }
    // HTTP/IPFS URIs — can't decode inline, return fallback
    return fallback;
  } catch {
    return fallback;
  }
}

// ── Chunked event scanning (handles RPC block limits) ─────
async function scanLogs<T>(
  event: any,
  processLog: (log: any) => T,
  fromBlock?: bigint,
): Promise<T[]> {
  const from = fromBlock ?? DEPLOYMENT_BLOCK;
  const to = await publicClient.getBlockNumber();
  const results: T[] = [];

  for (let start = from; start <= to; start += CHUNK_SIZE + 1n) {
    const end = start + CHUNK_SIZE > to ? to : start + CHUNK_SIZE;
    const logs = await publicClient.getLogs({
      address: REGISTRY,
      event,
      fromBlock: start,
      toBlock: end,
    });
    for (const log of logs) {
      results.push(processLog(log));
    }
  }
  return results;
}

// ── Time helpers ──────────────────────────────────────────
function estimateTimestampMs(
  eventBlock: bigint,
  currentBlock: bigint,
  currentTimestamp: number,
): number {
  const blockDiff = Number(currentBlock - eventBlock);
  const secondsDiff = blockDiff * 2; // ~2s per block on Base
  return (currentTimestamp - secondsDiff) * 1000;
}

function relativeTime(
  eventBlock: bigint,
  currentBlock: bigint,
): string {
  const blockDiff = Number(currentBlock - eventBlock);
  const seconds = blockDiff * 2;
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ── Types ─────────────────────────────────────────────────
export interface SkillEntry {
  id: string;
  skillHash: string;
  name: string;
  description: string;
  category: string;
  publisher: string;
  auditor: string;
  level: 0 | 1 | 2 | 3;
  stake: number;
  status: "active" | "disputed" | "expired" | "revoked";
  auditStatus: "unaudited" | "in_review" | "attested";
  timestamp: number;
  verifications: number;
  txHash: string;
  blockNumber: number;
}

export interface LiveEvent {
  type: "LISTED" | "ATTESTED" | "STAKED" | "DISPUTE";
  skill: string;
  skillHash?: string;
  level: number;
  auditor: string;
  time: string;
  amount?: string;
  blockNumber: bigint;
  txHash: string;
}

// ══════════════════════════════════════════════════════════
//  Hook: useRegistrySkills — full skill list for Registry
// ══════════════════════════════════════════════════════════
export function useRegistrySkills() {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockNumber, setBlockNumber] = useState<bigint>(0n);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    async function load() {
      try {
        // 1) Current block + timestamp for time estimation
        const currentBlock = await publicClient.getBlockNumber();
        const block = await publicClient.getBlock({ blockNumber: currentBlock });
        const currentTs = Number(block.timestamp);
        setBlockNumber(currentBlock);

        // 2) Scan SkillListed + SkillRegistered in parallel
        const [listedRaw, registeredRaw] = await Promise.all([
          scanLogs(
            skillListedEvent,
            (log: any) => ({
              skillHash: log.args.skillHash as Hex,
              publisher: log.args.publisher as Address,
              metadataURI: log.args.metadataURI as string,
              blockNumber: log.blockNumber as bigint,
              txHash: log.transactionHash as Hex,
            }),
          ),
          scanLogs(
            skillRegisteredEvent,
            (log: any) => ({
              skillHash: log.args.skillHash as Hex,
              auditLevel: Number(log.args.auditLevel),
              auditorCommitment: log.args.auditorCommitment as Hex,
              blockNumber: log.blockNumber as bigint,
              txHash: log.transactionHash as Hex,
            }),
          ),
        ]);

        // 3) Build map from listed events (unaudited by default)
        const skillMap = new Map<string, SkillEntry>();

        for (const ev of listedRaw) {
          const meta = parseMetadataURI(ev.metadataURI);
          skillMap.set(ev.skillHash, {
            id: ev.skillHash.slice(0, 10),
            skillHash: ev.skillHash,
            name: meta.name,
            description: meta.description,
            category: meta.category,
            publisher: ev.publisher,
            auditor: "",
            level: 0,
            stake: 0,
            status: "active",
            auditStatus: "unaudited",
            timestamp: estimateTimestampMs(ev.blockNumber, currentBlock, currentTs),
            verifications: 0,
            txHash: ev.txHash,
            blockNumber: Number(ev.blockNumber),
          });
        }

        // 4) Merge registered events → upgrade to "attested"
        // Collect skill hashes that need attestation data for stake amounts
        const registeredHashes: Hex[] = [];

        for (const ev of registeredRaw) {
          registeredHashes.push(ev.skillHash);
          const existing = skillMap.get(ev.skillHash);
          if (existing) {
            existing.auditStatus = "attested";
            existing.level = ev.auditLevel as 0 | 1 | 2 | 3;
            existing.auditor = ev.auditorCommitment;
          } else {
            // Registered without a listing — fetch metadata
            let metaURI = "";
            try {
              metaURI = (await publicClient.readContract({
                address: REGISTRY,
                abi: [metadataURIsAbi],
                functionName: "metadataURIs",
                args: [ev.skillHash],
              })) as string;
            } catch { /* ignore */ }

            const meta = parseMetadataURI(metaURI);
            skillMap.set(ev.skillHash, {
              id: ev.skillHash.slice(0, 10),
              skillHash: ev.skillHash,
              name: meta.name,
              description: meta.description,
              category: meta.category,
              publisher: "",
              auditor: ev.auditorCommitment,
              level: ev.auditLevel as 0 | 1 | 2 | 3,
              stake: 0,
              status: "active",
              auditStatus: "attested",
              timestamp: estimateTimestampMs(ev.blockNumber, currentBlock, currentTs),
              verifications: 0,
              txHash: ev.txHash,
              blockNumber: Number(ev.blockNumber),
            });
          }
        }

        // 5) Batch-fetch attestation data for stake amounts (multicall)
        if (registeredHashes.length > 0) {
          try {
            const results = await publicClient.multicall({
              contracts: registeredHashes.map((h) => ({
                address: REGISTRY,
                abi: [getAttestationsAbi],
                functionName: "getAttestations" as const,
                args: [h],
              })),
            });
            for (let i = 0; i < registeredHashes.length; i++) {
              const result = results[i];
              if (result.status === "success" && Array.isArray(result.result)) {
                const attestations = result.result as any[];
                if (attestations.length > 0) {
                  const latest = attestations[attestations.length - 1];
                  const entry = skillMap.get(registeredHashes[i]);
                  if (entry) {
                    entry.stake = parseFloat(formatEther(latest.stakeAmount ?? 0n));
                  }
                }
              }
            }
          } catch {
            // Non-critical — stake will just show 0
          }
        }

        setSkills(Array.from(skillMap.values()));
      } catch (err) {
        console.error("Failed to fetch registry data:", err);
        setError(err instanceof Error ? err.message : "Failed to load on-chain data");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { skills, loading, error, blockNumber };
}

// ══════════════════════════════════════════════════════════
//  Hook: useRecentEvents — live feed for Landing page
// ══════════════════════════════════════════════════════════
export function useRecentEvents(limit = 8) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    async function load() {
      try {
        const currentBlock = await publicClient.getBlockNumber();

        // Scan all event types in parallel
        const [listed, registered, auditors, stakes, disputes] = await Promise.all([
          scanLogs(skillListedEvent, (log: any) => ({
            type: "LISTED" as const,
            skillHash: log.args.skillHash as Hex,
            metadataURI: log.args.metadataURI as string,
            publisher: log.args.publisher as string,
            blockNumber: log.blockNumber as bigint,
            txHash: log.transactionHash as Hex,
          })),
          scanLogs(skillRegisteredEvent, (log: any) => ({
            type: "ATTESTED" as const,
            skillHash: log.args.skillHash as Hex,
            auditLevel: Number(log.args.auditLevel),
            auditorCommitment: log.args.auditorCommitment as Hex,
            blockNumber: log.blockNumber as bigint,
            txHash: log.transactionHash as Hex,
          })),
          scanLogs(auditorRegisteredEvent, (log: any) => ({
            type: "STAKED" as const,
            auditorCommitment: log.args.auditorCommitment as Hex,
            stake: log.args.stake as bigint,
            blockNumber: log.blockNumber as bigint,
            txHash: log.transactionHash as Hex,
          })),
          scanLogs(stakeAddedEvent, (log: any) => ({
            type: "STAKED" as const,
            auditorCommitment: log.args.auditorCommitment as Hex,
            amount: log.args.amount as bigint,
            blockNumber: log.blockNumber as bigint,
            txHash: log.transactionHash as Hex,
          })),
          scanLogs(disputeOpenedEvent, (log: any) => ({
            type: "DISPUTE" as const,
            disputeId: log.args.disputeId as bigint,
            skillHash: log.args.skillHash as Hex,
            blockNumber: log.blockNumber as bigint,
            txHash: log.transactionHash as Hex,
          })),
        ]);

        // Build a skillHash → name lookup from listed events
        const nameMap = new Map<string, string>();
        for (const ev of listed) {
          const meta = parseMetadataURI(ev.metadataURI);
          nameMap.set(ev.skillHash, meta.name);
        }

        // Convert to unified LiveEvent format
        const allEvents: LiveEvent[] = [];

        for (const ev of listed) {
          const meta = parseMetadataURI(ev.metadataURI);
          allEvents.push({
            type: "LISTED",
            skill: meta.name,
            skillHash: ev.skillHash,
            level: 0,
            auditor: truncAddr(ev.publisher),
            time: relativeTime(ev.blockNumber, currentBlock),
            blockNumber: ev.blockNumber,
            txHash: ev.txHash,
          });
        }

        for (const ev of registered) {
          allEvents.push({
            type: "ATTESTED",
            skill: nameMap.get(ev.skillHash) || ev.skillHash.slice(0, 10) + "\u2026",
            skillHash: ev.skillHash,
            level: ev.auditLevel,
            auditor: truncAddr(ev.auditorCommitment),
            time: relativeTime(ev.blockNumber, currentBlock),
            blockNumber: ev.blockNumber,
            txHash: ev.txHash,
          });
        }

        for (const ev of auditors) {
          const eth = parseFloat(formatEther(ev.stake));
          allEvents.push({
            type: "STAKED",
            skill: "\u2014",
            level: 0,
            auditor: truncAddr(ev.auditorCommitment),
            time: relativeTime(ev.blockNumber, currentBlock),
            amount: `${eth >= 0.01 ? eth.toFixed(2) : eth.toFixed(4)} ETH`,
            blockNumber: ev.blockNumber,
            txHash: ev.txHash,
          });
        }

        for (const ev of stakes) {
          const eth = parseFloat(formatEther(ev.amount));
          allEvents.push({
            type: "STAKED",
            skill: "\u2014",
            level: 0,
            auditor: truncAddr(ev.auditorCommitment),
            time: relativeTime(ev.blockNumber, currentBlock),
            amount: `${eth >= 0.01 ? eth.toFixed(2) : eth.toFixed(4)} ETH`,
            blockNumber: ev.blockNumber,
            txHash: ev.txHash,
          });
        }

        for (const ev of disputes) {
          allEvents.push({
            type: "DISPUTE",
            skill: nameMap.get(ev.skillHash) || ev.skillHash.slice(0, 10) + "\u2026",
            skillHash: ev.skillHash,
            level: 0,
            auditor: "\u2014",
            time: relativeTime(ev.blockNumber, currentBlock),
            blockNumber: ev.blockNumber,
            txHash: ev.txHash,
          });
        }

        // Sort most recent first, take top N
        allEvents.sort((a, b) => Number(b.blockNumber - a.blockNumber));
        setEvents(allEvents.slice(0, limit));
      } catch (err) {
        console.error("Failed to fetch events:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [limit]);

  return { events, loading };
}

// ── Utility ───────────────────────────────────────────────
function truncAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return addr.slice(0, 6) + "\u2026" + addr.slice(-4);
}
