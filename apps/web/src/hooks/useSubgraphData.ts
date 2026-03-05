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
