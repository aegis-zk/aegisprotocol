import { useState, useEffect, useCallback, useRef } from "react";
import {
  createPublicClient,
  http,
  formatEther,
  type Hex,
  type Address,
} from "viem";
import { base } from "viem/chains";
import { REGISTRY_ADDRESS, REGISTRY_V4_ADDRESS } from "../config";

// ── Indexer API base URL ──────────────────────────────
// In production, point this to your VPS. For local dev, default to localhost:4200.

const INDEXER_URL =
  (import.meta as any).env?.VITE_INDEXER_URL?.replace(/\/$/, "") ||
  "https://indexer.aegisprotocol.tech";

/** Track whether indexer is reachable to avoid repeated slow timeouts */
let indexerDown = false;
let indexerDownSince = 0;
const INDEXER_RETRY_MS = 60_000; // retry indexer every 60s even if it was down

async function indexerFetch<T>(path: string, retries = 2): Promise<T> {
  // If indexer was recently marked down, skip retries and fail fast
  if (indexerDown && Date.now() - indexerDownSince < INDEXER_RETRY_MS) {
    throw new Error("Indexer offline (cached)");
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${INDEXER_URL}${path}`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) throw new Error(`Indexer error: ${res.status}`);
      const json = await res.json();
      indexerDown = false; // mark as recovered
      return json.data as T;
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 1_000 * (attempt + 1)));
      }
    }
  }
  // Mark indexer as down
  indexerDown = true;
  indexerDownSince = Date.now();
  throw lastErr;
}

// ── On-chain fallback infrastructure ─────────────────
const REGISTRIES: `0x${string}`[] = [
  REGISTRY_ADDRESS[8453] as `0x${string}`,
  REGISTRY_V4_ADDRESS[8453] as `0x${string}`,
].filter(Boolean);
const DEPLOYMENT_BLOCK = 42983389n; // v4 deployment block (earliest)
const CHUNK = 9_999n;

const onChainClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

const skillListedAbi = {
  type: "event" as const,
  name: "SkillListed" as const,
  inputs: [
    { name: "skillHash", type: "bytes32" as const, indexed: true },
    { name: "publisher", type: "address" as const, indexed: true },
    { name: "metadataURI", type: "string" as const, indexed: false },
  ],
} as const;

const skillRegisteredAbi = {
  type: "event" as const,
  name: "SkillRegistered" as const,
  inputs: [
    { name: "skillHash", type: "bytes32" as const, indexed: true },
    { name: "auditLevel", type: "uint8" as const, indexed: false },
    { name: "auditorCommitment", type: "bytes32" as const, indexed: true },
  ],
} as const;

const auditorRegisteredAbi = {
  type: "event" as const,
  name: "AuditorRegistered" as const,
  inputs: [
    { name: "auditorCommitment", type: "bytes32" as const, indexed: true },
    { name: "stake", type: "uint256" as const, indexed: false },
  ],
} as const;

const disputeOpenedAbi = {
  type: "event" as const,
  name: "DisputeOpened" as const,
  inputs: [
    { name: "disputeId", type: "uint256" as const, indexed: true },
    { name: "skillHash", type: "bytes32" as const, indexed: true },
  ],
} as const;

const bountyPostedAbi = {
  type: "event" as const,
  name: "BountyPosted" as const,
  inputs: [
    { name: "skillHash", type: "bytes32" as const, indexed: true },
    { name: "publisher", type: "address" as const, indexed: true },
    { name: "amount", type: "uint256" as const, indexed: false },
    { name: "requiredLevel", type: "uint8" as const, indexed: false },
    { name: "expiresAt", type: "uint256" as const, indexed: false },
  ],
} as const;

/** Scan logs from both v4+v5 registries in chunks */
async function scanAllLogs<T>(event: any, processLog: (log: any) => T): Promise<T[]> {
  const to = await onChainClient.getBlockNumber();
  const results: T[] = [];
  for (let start = DEPLOYMENT_BLOCK; start <= to; start += CHUNK + 1n) {
    const end = start + CHUNK > to ? to : start + CHUNK;
    const logs = await onChainClient.getLogs({
      address: REGISTRIES,
      event,
      fromBlock: start,
      toBlock: end,
    });
    for (const log of logs) results.push(processLog(log));
  }
  return results;
}

function estimateTs(eventBlock: bigint, headBlock: bigint, headTs: number): number {
  const diff = Number(headBlock - eventBlock);
  return (headTs - diff * 2) * 1000;
}

// ── Types ────────────────────────────────────────────────

export interface ProtocolStats {
  totalSkills: number;
  totalAttestations: number;
  totalAuditors: number;
  totalDisputes: number;
  openDisputes: number;
  totalBounties: number;
  openBounties: number;
  unauditedSkills: number;
}

export interface ProtocolEventEntry {
  id: string;
  eventName: string;
  txHash: string;
  blockNumber: string;
  timestamp: string;
  data: string;
}

export interface AttestationLevelCounts {
  l1: number;
  l2: number;
  l3: number;
}

export interface SkillNameEntry {
  id: string;
  skillName: string;
  category: string;
}

export interface AuditorEntry {
  id: string;
  currentStake: string;
  initialStake: string;
  attestationCount: number;
  l2AttestationCount: number;
  l3AttestationCount: number;
  lastAttestationAt: string | null;
  disputesInvolved: number;
  disputesLost: number;
  reputationScore: string;
  timestamp: string;
  txHash: string;
}

export interface AuditorAttestationEntry {
  id: string;
  attestationIndex: number;
  skill: {
    id: string;
    skillName: string;
    category: string;
    disputes: RawDisputeEntry[];
  };
  auditLevel: number;
  revoked: boolean;
  txHash: string;
  timestamp: string;
}

interface RawDisputeEntry {
  id: string;
  disputeId: string;
  attestationIndex: number;
  challenger: string;
  bond: string;
  resolved: boolean;
  auditorFault: boolean;
  openedAt: string;
  resolvedAt: string | null;
  txHash: string;
}

export interface DisputeEntry {
  id: string;
  disputeId: string;
  challenger: string;
  bond: string;
  resolved: boolean;
  auditorFault: boolean;
  openedAt: string;
  resolvedAt: string | null;
  txHash: string;
  skillName: string;
  skillId: string;
}

export interface BountyEntry {
  id: string;
  skillHash: string;
  skillName: string;
  category: string;
  publisher: string;
  amount: string;
  requiredLevel: number;
  expiresAt: string;
  claimed: boolean;
  reclaimed: boolean;
  timestamp: string;
  txHash: string;
}

// ── Hooks ────────────────────────────────────────────────

const DEFAULT_STATS: ProtocolStats = {
  totalSkills: 0,
  totalAttestations: 0,
  totalAuditors: 0,
  totalDisputes: 0,
  openDisputes: 0,
  totalBounties: 0,
  openBounties: 0,
  unauditedSkills: 0,
};

async function fetchStatsOnChain(): Promise<ProtocolStats> {
  const [listed, registered, auditors, disputes, bounties] = await Promise.all([
    scanAllLogs(skillListedAbi, () => 1),
    scanAllLogs(skillRegisteredAbi, (l: any) => l.args.skillHash as string),
    scanAllLogs(auditorRegisteredAbi, () => 1),
    scanAllLogs(disputeOpenedAbi, () => 1),
    scanAllLogs(bountyPostedAbi, () => 1),
  ]);

  const attestedHashes = new Set(registered);
  const totalSkills = listed.length;
  const totalAttestations = registered.length;
  const totalAuditors = auditors.length;
  const totalDisputes = disputes.length;
  const totalBounties = bounties.length;

  return {
    totalSkills,
    totalAttestations,
    totalAuditors,
    totalDisputes,
    openDisputes: totalDisputes, // approximate — would need resolve events
    totalBounties,
    openBounties: totalBounties, // approximate
    unauditedSkills: totalSkills - attestedHashes.size,
  };
}

export function useProtocolStats(refreshMs = 30_000) {
  const [stats, setStats] = useState<ProtocolStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      const data = await indexerFetch<{
        total_skills: number;
        total_attestations: number;
        total_auditors: number;
        total_disputes: number;
        open_disputes: number;
        total_bounties: number;
        open_bounties: number;
        unaudited_skills: number;
      }>("/stats");
      setStats({
        totalSkills: data.total_skills,
        totalAttestations: data.total_attestations,
        totalAuditors: data.total_auditors,
        totalDisputes: data.total_disputes,
        openDisputes: data.open_disputes,
        totalBounties: data.total_bounties,
        openBounties: data.open_bounties,
        unauditedSkills: data.unaudited_skills,
      });
    } catch (err) {
      console.error("[indexer] Indexer unavailable, falling back to on-chain reads");
      try {
        const onChainStats = await fetchStatsOnChain();
        setStats(onChainStats);
      } catch (err2) {
        console.error("[on-chain] Failed to fetch stats:", err2);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, refreshMs);
    return () => clearInterval(id);
  }, [fetch_, refreshMs]);

  return { stats, loading };
}

export function useActivityFeed(limit = 20, refreshMs = 30_000) {
  const [events, setEvents] = useState<ProtocolEventEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      const data = await indexerFetch<
        Array<{
          id: number;
          event_name: string;
          tx_hash: string;
          block_number: string;
          indexed_at: string;
          data: string;
        }>
      >(`/stats/events?limit=${limit}`);
      setEvents(
        data.map((e) => ({
          id: String(e.id),
          eventName: e.event_name,
          txHash: e.tx_hash,
          blockNumber: e.block_number,
          timestamp: e.indexed_at,
          data: e.data,
        })),
      );
    } catch (err) {
      console.error("[indexer] Indexer unavailable for events, falling back to on-chain");
      try {
        // Scan recent events from both contracts
        const headBlock = await onChainClient.getBlockNumber();
        // Only scan recent ~50k blocks (~1 day) for the feed
        const recentFrom = headBlock > 50_000n ? headBlock - 50_000n : DEPLOYMENT_BLOCK;
        const [listed, registered] = await Promise.all([
          scanAllLogs(skillListedAbi, (l: any) => ({
            eventName: "SkillListed",
            txHash: l.transactionHash as string,
            blockNumber: String(l.blockNumber),
            data: JSON.stringify({ skillHash: l.args.skillHash, publisher: l.args.publisher }),
          })),
          scanAllLogs(skillRegisteredAbi, (l: any) => ({
            eventName: "SkillRegistered",
            txHash: l.transactionHash as string,
            blockNumber: String(l.blockNumber),
            data: JSON.stringify({ skillHash: l.args.skillHash, auditLevel: Number(l.args.auditLevel) }),
          })),
        ]);
        const all = [...listed, ...registered]
          .sort((a, b) => Number(BigInt(b.blockNumber) - BigInt(a.blockNumber)))
          .slice(0, limit)
          .map((e, i) => ({
            id: String(i),
            eventName: e.eventName,
            txHash: e.txHash,
            blockNumber: e.blockNumber,
            timestamp: new Date().toISOString(),
            data: e.data,
          }));
        setEvents(all);
      } catch (err2) {
        console.error("[on-chain] Failed to fetch events:", err2);
      }
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, refreshMs);
    return () => clearInterval(id);
  }, [fetch_, refreshMs]);

  return { events, loading };
}

export function useAuditorLeaderboard(refreshMs = 30_000) {
  const [auditors, setAuditors] = useState<AuditorEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      const data = await indexerFetch<
        Array<{
          auditor_commitment: string;
          current_stake: string;
          initial_stake: string;
          attestation_count: number;
          l2_attestation_count: number;
          l3_attestation_count: number;
          last_attestation_at: string | null;
          disputes_involved: number;
          disputes_lost: number;
          reputation_score: number;
          registered_at: string;
          tx_hash: string;
        }>
      >("/auditors/leaderboard");
      setAuditors(
        data.map((a) => ({
          id: a.auditor_commitment,
          currentStake: a.current_stake,
          initialStake: a.initial_stake,
          attestationCount: a.attestation_count,
          l2AttestationCount: a.l2_attestation_count,
          l3AttestationCount: a.l3_attestation_count,
          lastAttestationAt: a.last_attestation_at,
          disputesInvolved: a.disputes_involved,
          disputesLost: a.disputes_lost,
          reputationScore: String(a.reputation_score),
          timestamp: a.registered_at,
          txHash: a.tx_hash,
        })),
      );
    } catch (err) {
      console.error("[indexer] Indexer unavailable for auditors, falling back to on-chain");
      try {
        const auditorLogs = await scanAllLogs(auditorRegisteredAbi, (l: any) => ({
          commitment: l.args.auditorCommitment as string,
          stake: l.args.stake as bigint,
          blockNumber: l.blockNumber as bigint,
          txHash: l.transactionHash as string,
        }));
        const auditorMap = new Map<string, typeof auditorLogs[0]>();
        for (const a of auditorLogs) auditorMap.set(a.commitment, a);
        setAuditors(
          Array.from(auditorMap.values()).map((a) => ({
            id: a.commitment,
            currentStake: formatEther(a.stake),
            initialStake: formatEther(a.stake),
            attestationCount: 0,
            l2AttestationCount: 0,
            l3AttestationCount: 0,
            lastAttestationAt: null,
            disputesInvolved: 0,
            disputesLost: 0,
            reputationScore: "100",
            timestamp: new Date().toISOString(),
            txHash: a.txHash,
          })),
        );
      } catch (err2) {
        console.error("[on-chain] Failed to fetch auditors:", err2);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, refreshMs);
    return () => clearInterval(id);
  }, [fetch_, refreshMs]);

  return { auditors, loading };
}

export function useAttestationLevels(refreshMs = 30_000) {
  const [counts, setCounts] = useState<AttestationLevelCounts>({ l1: 0, l2: 0, l3: 0 });
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      const data = await indexerFetch<AttestationLevelCounts>("/stats/attestation-levels");
      setCounts(data);
    } catch (err) {
      console.error("[indexer] Indexer unavailable for attestation levels, falling back to on-chain");
      try {
        const registered = await scanAllLogs(skillRegisteredAbi, (l: any) => Number(l.args.auditLevel));
        const levels = { l1: 0, l2: 0, l3: 0 };
        for (const lvl of registered) {
          if (lvl === 1) levels.l1++;
          else if (lvl === 2) levels.l2++;
          else if (lvl === 3) levels.l3++;
        }
        setCounts(levels);
      } catch (err2) {
        console.error("[on-chain] Failed to fetch attestation levels:", err2);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, refreshMs);
    return () => clearInterval(id);
  }, [fetch_, refreshMs]);

  return { counts, loading };
}

export function useSkillNames(refreshMs = 30_000) {
  const [skills, setSkills] = useState<Map<string, SkillNameEntry>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      const data = await indexerFetch<
        Array<{
          skill_hash: string;
          skill_name: string;
          category: string;
        }>
      >("/skills?limit=100");
      const map = new Map<string, SkillNameEntry>();
      for (const s of data) {
        map.set(s.skill_hash.toLowerCase(), {
          id: s.skill_hash,
          skillName: s.skill_name,
          category: s.category,
        });
      }
      setSkills(map);
    } catch (err) {
      console.error("[indexer] Indexer unavailable for skill names, falling back to on-chain");
      try {
        const listed = await scanAllLogs(skillListedAbi, (l: any) => ({
          skillHash: (l.args.skillHash as string).toLowerCase(),
          metadataURI: l.args.metadataURI as string,
        }));
        const map = new Map<string, SkillNameEntry>();
        for (const s of listed) {
          const meta = parseMetadataURI(s.metadataURI);
          map.set(s.skillHash, { id: s.skillHash, skillName: meta.name, category: meta.category });
        }
        setSkills(map);
      } catch (err2) {
        console.error("[on-chain] Failed to fetch skill names:", err2);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, refreshMs);
    return () => clearInterval(id);
  }, [fetch_, refreshMs]);

  return { skills, loading };
}

export function useAuditorProfile(commitment: string, refreshMs = 30_000) {
  const [auditor, setAuditor] = useState<AuditorEntry | null>(null);
  const [attestations, setAttestations] = useState<AuditorAttestationEntry[]>([]);
  const [disputes, setDisputes] = useState<DisputeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    if (!commitment) return;
    try {
      const data = await indexerFetch<{
        auditor_commitment: string;
        current_stake: string;
        initial_stake: string;
        attestation_count: number;
        l2_attestation_count: number;
        l3_attestation_count: number;
        last_attestation_at: string | null;
        disputes_involved: number;
        disputes_lost: number;
        reputation_score: number;
        registered_at: string;
        tx_hash: string;
        attestations: Array<{
          skill_hash: string;
          attestation_index: number;
          audit_level: number;
          revoked: number;
          tx_hash: string;
          created_at: string;
          skill_name: string;
          category: string;
          disputes: Array<{
            dispute_id: number;
            attestation_index: number;
            challenger: string;
            bond: string;
            resolved: number;
            auditor_fault: number;
            opened_at: string;
            resolved_at: string | null;
            tx_hash: string;
          }>;
        }>;
      }>(`/auditors/${commitment.toLowerCase()}`);

      setAuditor({
        id: data.auditor_commitment,
        currentStake: data.current_stake,
        initialStake: data.initial_stake,
        attestationCount: data.attestation_count,
        l2AttestationCount: data.l2_attestation_count,
        l3AttestationCount: data.l3_attestation_count,
        lastAttestationAt: data.last_attestation_at,
        disputesInvolved: data.disputes_involved,
        disputesLost: data.disputes_lost,
        reputationScore: String(data.reputation_score),
        timestamp: data.registered_at,
        txHash: data.tx_hash,
      });

      const atts: AuditorAttestationEntry[] = (data.attestations ?? []).map((a) => ({
        id: `${a.skill_hash}-${a.attestation_index}`,
        attestationIndex: a.attestation_index,
        skill: {
          id: a.skill_hash,
          skillName: a.skill_name,
          category: a.category,
          disputes: (a.disputes ?? []).map((d) => ({
            id: String(d.dispute_id),
            disputeId: String(d.dispute_id),
            attestationIndex: d.attestation_index,
            challenger: d.challenger,
            bond: d.bond,
            resolved: d.resolved === 1,
            auditorFault: d.auditor_fault === 1,
            openedAt: d.opened_at,
            resolvedAt: d.resolved_at,
            txHash: d.tx_hash,
          })),
        },
        auditLevel: a.audit_level,
        revoked: a.revoked === 1,
        txHash: a.tx_hash,
        timestamp: a.created_at,
      }));
      setAttestations(atts);

      // Extract disputes that target this auditor's attestations
      const seen = new Set<string>();
      const extracted: DisputeEntry[] = [];
      for (const att of atts) {
        for (const d of att.skill.disputes ?? []) {
          if (d.attestationIndex === att.attestationIndex && !seen.has(d.id)) {
            seen.add(d.id);
            extracted.push({
              id: d.id,
              disputeId: d.disputeId,
              challenger: d.challenger,
              bond: d.bond,
              resolved: d.resolved,
              auditorFault: d.auditorFault,
              openedAt: d.openedAt,
              resolvedAt: d.resolvedAt,
              txHash: d.txHash,
              skillName: att.skill.skillName,
              skillId: att.skill.id,
            });
          }
        }
      }
      extracted.sort((a, b) => (b.openedAt > a.openedAt ? 1 : -1));
      setDisputes(extracted);
    } catch (err) {
      console.error("[indexer] Indexer unavailable for auditor profile, falling back to on-chain");
      try {
        const auditorLogs = await scanAllLogs(auditorRegisteredAbi, (l: any) => ({
          commitment: l.args.auditorCommitment as string,
          stake: l.args.stake as bigint,
          txHash: l.transactionHash as string,
        }));
        const match = auditorLogs.find((a) => a.commitment.toLowerCase() === commitment.toLowerCase());
        if (match) {
          setAuditor({
            id: match.commitment,
            currentStake: formatEther(match.stake),
            initialStake: formatEther(match.stake),
            attestationCount: 0,
            l2AttestationCount: 0,
            l3AttestationCount: 0,
            lastAttestationAt: null,
            disputesInvolved: 0,
            disputesLost: 0,
            reputationScore: "100",
            timestamp: new Date().toISOString(),
            txHash: match.txHash,
          });
        }
      } catch (err2) {
        console.error("[on-chain] Failed to fetch auditor profile:", err2);
      }
    } finally {
      setLoading(false);
    }
  }, [commitment]);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, refreshMs);
    return () => clearInterval(id);
  }, [fetch_, refreshMs]);

  return { auditor, attestations, disputes, loading };
}

// ── Bounty hook ─────────────────────────────────────────

export function useBounties(refreshMs = 30_000) {
  const [bounties, setBounties] = useState<BountyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      const data = await indexerFetch<
        Array<{
          skill_hash: string;
          skill_name: string;
          category: string;
          publisher: string;
          amount: string;
          required_level: number;
          expires_at: string;
          claimed: number;
          reclaimed: number;
          posted_at: string;
          tx_hash: string;
        }>
      >("/bounties");
      setBounties(
        data.map((b) => ({
          id: b.skill_hash,
          skillHash: b.skill_hash,
          skillName: b.skill_name ?? "Unknown Skill",
          category: b.category ?? "Uncategorized",
          publisher: b.publisher ?? "",
          amount: b.amount,
          requiredLevel: b.required_level,
          expiresAt: b.expires_at,
          claimed: b.claimed === 1,
          reclaimed: b.reclaimed === 1,
          timestamp: b.posted_at,
          txHash: b.tx_hash,
        })),
      );
    } catch (err) {
      console.error("[indexer] Indexer unavailable for bounties, falling back to on-chain");
      try {
        const bountyLogs = await scanAllLogs(bountyPostedAbi, (l: any) => ({
          skillHash: l.args.skillHash as string,
          publisher: l.args.publisher as string,
          amount: l.args.amount as bigint,
          requiredLevel: Number(l.args.requiredLevel),
          expiresAt: Number(l.args.expiresAt),
          txHash: l.transactionHash as string,
          blockNumber: l.blockNumber as bigint,
        }));
        setBounties(
          bountyLogs.map((b) => ({
            id: b.skillHash,
            skillHash: b.skillHash,
            skillName: b.skillHash.slice(0, 10) + "\u2026",
            category: "Uncategorized",
            publisher: b.publisher,
            amount: formatEther(b.amount),
            requiredLevel: b.requiredLevel,
            expiresAt: new Date(b.expiresAt * 1000).toISOString(),
            claimed: false,
            reclaimed: false,
            timestamp: new Date().toISOString(),
            txHash: b.txHash,
          })),
        );
      } catch (err2) {
        console.error("[on-chain] Failed to fetch bounties:", err2);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, refreshMs);
    return () => clearInterval(id);
  }, [fetch_, refreshMs]);

  return { bounties, loading };
}

// ── Registry Skills ──────────────────────────────────────

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

function parseMetadataURI(uri: string): { name: string; description: string; category: string } {
  const fallback = { name: "Unknown Skill", description: "", category: "Uncategorized" };
  try {
    if (!uri) return fallback;
    if (uri.startsWith("data:")) {
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
      };
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function useRegistrySkills(refreshMs = 30_000) {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const data = await indexerFetch<
        Array<{
          skill_hash: string;
          publisher: string;
          metadata_uri: string;
          skill_name: string;
          category: string;
          block_number: string;
          tx_hash: string;
          listed_at: string;
          attestation_count: number;
          attestations: Array<{
            attestation_index: number;
            auditor_commitment: string;
            audit_level: number;
            revoked: number;
            tx_hash: string;
            created_at: string;
            auditor_stake: string;
          }>;
          disputes: Array<{
            dispute_id: number;
            attestation_index: number;
            resolved: number;
            auditor_fault: number;
          }>;
        }>
      >("/skills/registry");

      const entries: SkillEntry[] = data.map((s) => {
        // Use indexer skill_name/category, fall back to parsing metadataURI
        let name = s.skill_name;
        let category = s.category;
        let description = "";
        if (!name || name === "Unknown Skill") {
          const parsed = parseMetadataURI(s.metadata_uri);
          name = parsed.name;
          category = parsed.category || category;
          description = parsed.description;
        }

        // Determine audit status from attestations
        const activeAttestations = (s.attestations ?? []).filter((a) => a.revoked === 0);
        const latestAttestation = activeAttestations.length > 0 ? activeAttestations[0] : null;
        const auditLevel = latestAttestation ? latestAttestation.audit_level : 0;
        const auditor = latestAttestation ? latestAttestation.auditor_commitment : "";
        const stake = latestAttestation
          ? parseFloat((Number(latestAttestation.auditor_stake) / 1e18).toFixed(4))
          : 0;

        // Determine statuses
        const hasOpenDispute = (s.disputes ?? []).some((d) => d.resolved === 0);
        const hasRevokedAttestation = (s.attestations ?? []).some((a) => a.revoked === 1);

        let status: "active" | "disputed" | "expired" | "revoked" = "active";
        if (hasOpenDispute) status = "disputed";
        else if (hasRevokedAttestation && !latestAttestation) status = "revoked";

        const auditStatus: "unaudited" | "in_review" | "attested" =
          latestAttestation ? "attested" : "unaudited";

        // Parse listed_at as timestamp — try unix seconds first, then ISO date
        let ts = Number(s.listed_at);
        if (isNaN(ts) || ts < 1e9) {
          ts = new Date(s.listed_at).getTime();
        } else {
          ts = ts * 1000;
        }

        return {
          id: s.skill_hash.slice(0, 10),
          skillHash: s.skill_hash,
          name,
          description,
          category,
          publisher: s.publisher,
          auditor,
          level: Math.min(3, Math.max(0, auditLevel)) as 0 | 1 | 2 | 3,
          stake,
          status,
          auditStatus,
          timestamp: ts,
          verifications: s.attestation_count,
          txHash: s.tx_hash,
          blockNumber: Number(s.block_number),
        };
      });

      setSkills(entries);
      setError(null);
    } catch (err) {
      console.error("[indexer] Indexer unavailable for registry, falling back to on-chain");
      try {
        const headBlock = await onChainClient.getBlockNumber();
        const block = await onChainClient.getBlock({ blockNumber: headBlock });
        const headTs = Number(block.timestamp);

        const [listedRaw, registeredRaw] = await Promise.all([
          scanAllLogs(skillListedAbi, (l: any) => ({
            skillHash: l.args.skillHash as Hex,
            publisher: l.args.publisher as Address,
            metadataURI: l.args.metadataURI as string,
            blockNumber: l.blockNumber as bigint,
            txHash: l.transactionHash as Hex,
          })),
          scanAllLogs(skillRegisteredAbi, (l: any) => ({
            skillHash: l.args.skillHash as Hex,
            auditLevel: Number(l.args.auditLevel),
            auditorCommitment: l.args.auditorCommitment as Hex,
            blockNumber: l.blockNumber as bigint,
            txHash: l.transactionHash as Hex,
          })),
        ]);

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
            timestamp: estimateTs(ev.blockNumber, headBlock, headTs),
            verifications: 0,
            txHash: ev.txHash,
            blockNumber: Number(ev.blockNumber),
          });
        }

        for (const ev of registeredRaw) {
          const existing = skillMap.get(ev.skillHash);
          if (existing) {
            existing.auditStatus = "attested";
            existing.level = ev.auditLevel as 0 | 1 | 2 | 3;
            existing.auditor = ev.auditorCommitment;
          } else {
            skillMap.set(ev.skillHash, {
              id: ev.skillHash.slice(0, 10),
              skillHash: ev.skillHash,
              name: ev.skillHash.slice(0, 10) + "\u2026",
              description: "",
              category: "Uncategorized",
              publisher: "",
              auditor: ev.auditorCommitment,
              level: ev.auditLevel as 0 | 1 | 2 | 3,
              stake: 0,
              status: "active",
              auditStatus: "attested",
              timestamp: estimateTs(ev.blockNumber, headBlock, headTs),
              verifications: 0,
              txHash: ev.txHash,
              blockNumber: Number(ev.blockNumber),
            });
          }
        }

        setSkills(Array.from(skillMap.values()));
        setError(null);
      } catch (err2) {
        console.error("[on-chain] Failed to fetch registry skills:", err2);
        setError(err2 instanceof Error ? err2.message : "Failed to load registry data");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, refreshMs);
    return () => clearInterval(id);
  }, [fetch_, refreshMs]);

  return { skills, loading, error };
}
