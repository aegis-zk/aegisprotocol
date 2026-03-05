import { useState, useEffect, useRef, useCallback } from "react";

const SUBGRAPH_URL =
  "https://api.studio.thegraph.com/query/1743315/aegis-protocol/v0.1.0";

// ── GraphQL helper ───────────────────────────────────────

async function subgraphQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Subgraph error: ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
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
  disputesInvolved: number;
  disputesLost: number;
  reputationScore: string;
  timestamp: string;
  txHash: string;
}

// ── Queries ──────────────────────────────────────────────

const STATS_QUERY = `{
  protocolStats(id: "singleton") {
    totalSkills
    totalAttestations
    totalAuditors
    totalDisputes
    openDisputes
    totalBounties
    openBounties
    unauditedSkills
  }
}`;

const ACTIVITY_QUERY = `query ActivityFeed($first: Int!) {
  protocolEvents(first: $first, orderBy: blockNumber, orderDirection: desc) {
    id
    eventName
    txHash
    blockNumber
    timestamp
    data
  }
}`;

const ATTESTATION_LEVELS_QUERY = `{
  l1: attestations(first: 1000, where: { auditLevel: 1, revoked: false }) { id }
  l2: attestations(first: 1000, where: { auditLevel: 2, revoked: false }) { id }
  l3: attestations(first: 1000, where: { auditLevel: 3, revoked: false }) { id }
}`;

const SKILL_NAMES_QUERY = `{
  skills(first: 100, orderBy: timestamp, orderDirection: desc) {
    id
    skillName
    category
  }
}`;

const LEADERBOARD_QUERY = `{
  auditors(orderBy: reputationScore, orderDirection: desc, where: { registered: true }) {
    id
    currentStake
    initialStake
    attestationCount
    disputesInvolved
    disputesLost
    reputationScore
    timestamp
    txHash
  }
}`;

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
      const data = await subgraphQuery<{
        protocolStats: ProtocolStats | null;
      }>(STATS_QUERY);
      if (data.protocolStats) setStats(data.protocolStats);
    } catch (err) {
      console.error("[subgraph] Failed to fetch stats:", err);
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
      const data = await subgraphQuery<{
        protocolEvents: ProtocolEventEntry[];
      }>(ACTIVITY_QUERY, { first: limit });
      setEvents(data.protocolEvents);
    } catch (err) {
      console.error("[subgraph] Failed to fetch events:", err);
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
      const data = await subgraphQuery<{
        auditors: AuditorEntry[];
      }>(LEADERBOARD_QUERY);
      setAuditors(data.auditors);
    } catch (err) {
      console.error("[subgraph] Failed to fetch auditors:", err);
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
      const data = await subgraphQuery<{
        l1: { id: string }[];
        l2: { id: string }[];
        l3: { id: string }[];
      }>(ATTESTATION_LEVELS_QUERY);
      setCounts({
        l1: data.l1.length,
        l2: data.l2.length,
        l3: data.l3.length,
      });
    } catch (err) {
      console.error("[subgraph] Failed to fetch attestation levels:", err);
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
      const data = await subgraphQuery<{
        skills: SkillNameEntry[];
      }>(SKILL_NAMES_QUERY);
      const map = new Map<string, SkillNameEntry>();
      for (const s of data.skills) {
        map.set(s.id.toLowerCase(), s);
      }
      setSkills(map);
    } catch (err) {
      console.error("[subgraph] Failed to fetch skill names:", err);
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
