import { useState, useEffect, useCallback } from "react";

// ── Indexer API base URL ──────────────────────────────
const INDEXER_URL =
  (import.meta as any).env?.VITE_INDEXER_URL?.replace(/\/$/, "") ||
  "/api";

async function indexerFetch<T>(path: string): Promise<T> {
  const url = `${INDEXER_URL}${path}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Indexer ${res.status} on ${path}`);
  const json = await res.json();
  return json.data as T;
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
      console.error("[indexer] Failed to fetch stats:", err);
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
      console.error("[indexer] Failed to fetch events:", err);
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
      console.error("[indexer] Failed to fetch auditors:", err);
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
      console.error("[indexer] Failed to fetch attestation levels:", err);
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
      console.error("[indexer] Failed to fetch skill names:", err);
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
      console.error("[indexer] Failed to fetch auditor profile:", err);
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
      console.error("[indexer] Failed to fetch bounties:", err);
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
        let name = s.skill_name;
        let category = s.category;
        let description = "";
        if (!name || name === "Unknown Skill") {
          const parsed = parseMetadataURI(s.metadata_uri);
          name = parsed.name;
          category = parsed.category || category;
          description = parsed.description;
        }

        const activeAttestations = (s.attestations ?? []).filter((a) => a.revoked === 0);
        const latestAttestation = activeAttestations.length > 0 ? activeAttestations[0] : null;
        const auditLevel = latestAttestation ? latestAttestation.audit_level : 0;
        const auditor = latestAttestation ? latestAttestation.auditor_commitment : "";
        const stake = latestAttestation
          ? parseFloat((Number(latestAttestation.auditor_stake) / 1e18).toFixed(4))
          : 0;

        const hasOpenDispute = (s.disputes ?? []).some((d) => d.resolved === 0);
        const hasRevokedAttestation = (s.attestations ?? []).some((a) => a.revoked === 1);

        let status: "active" | "disputed" | "expired" | "revoked" = "active";
        if (hasOpenDispute) status = "disputed";
        else if (hasRevokedAttestation && !latestAttestation) status = "revoked";

        const auditStatus: "unaudited" | "in_review" | "attested" =
          latestAttestation ? "attested" : "unaudited";

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
      console.error("[indexer] Failed to fetch registry skills:", err);
      setError(err instanceof Error ? err.message : "Failed to load registry data");
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

// ── Live Event Feed (Landing page) ──────────────────────

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

function eventNameToType(name: string): LiveEvent["type"] | null {
  switch (name) {
    case "SkillListed": return "LISTED";
    case "SkillRegistered": return "ATTESTED";
    case "AuditorRegistered":
    case "StakeAdded": return "STAKED";
    case "DisputeOpened": return "DISPUTE";
    default: return null;
  }
}

function timeAgo(isoOrUnix: string): string {
  let ms: number;
  const n = Number(isoOrUnix);
  if (!isNaN(n) && n > 1e9) {
    ms = n < 1e12 ? n * 1000 : n;
  } else {
    ms = new Date(isoOrUnix).getTime();
  }
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function truncAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr || "\u2014";
  return addr.slice(0, 6) + "\u2026" + addr.slice(-4);
}

export function useRecentEvents(limit = 8) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
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
      >(`/stats/events?limit=${limit * 2}`);

      const mapped: LiveEvent[] = [];
      for (const e of data) {
        const evType = eventNameToType(e.event_name);
        if (!evType) continue;

        let parsed: any = {};
        try { parsed = JSON.parse(e.data); } catch { /* ok */ }

        let skill = "\u2014";
        let skillHash: string | undefined;
        let level = 0;
        let auditor = "\u2014";
        let amount: string | undefined;

        if (evType === "LISTED") {
          skill = parsed.skillName || parsed.skill_name || (parsed.skillHash ? parsed.skillHash.slice(0, 10) + "\u2026" : "\u2014");
          skillHash = parsed.skillHash || parsed.skill_hash;
          auditor = truncAddr(parsed.publisher);
        } else if (evType === "ATTESTED") {
          skill = parsed.skillName || parsed.skill_name || (parsed.skillHash ? parsed.skillHash.slice(0, 10) + "\u2026" : "\u2014");
          skillHash = parsed.skillHash || parsed.skill_hash;
          level = parsed.auditLevel ?? parsed.audit_level ?? 0;
          auditor = truncAddr(parsed.auditorCommitment || parsed.auditor_commitment || "");
        } else if (evType === "STAKED") {
          const stake = parsed.stake || parsed.amount;
          if (stake) {
            const eth = Number(stake) / 1e18;
            amount = `${eth >= 0.01 ? eth.toFixed(2) : eth.toFixed(4)} ETH`;
          }
          auditor = truncAddr(parsed.auditorCommitment || parsed.auditor_commitment || "");
        } else if (evType === "DISPUTE") {
          skill = parsed.skillName || parsed.skill_name || (parsed.skillHash ? parsed.skillHash.slice(0, 10) + "\u2026" : "\u2014");
          skillHash = parsed.skillHash || parsed.skill_hash;
        }

        mapped.push({
          type: evType,
          skill,
          skillHash,
          level,
          auditor,
          time: timeAgo(e.indexed_at),
          amount,
          blockNumber: BigInt(e.block_number),
          txHash: e.tx_hash,
        });

        if (mapped.length >= limit) break;
      }

      setEvents(mapped);
    } catch (err) {
      console.error("[indexer] Failed to fetch recent events:", err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, 30_000);
    return () => clearInterval(id);
  }, [fetch_]);

  return { events, loading };
}
