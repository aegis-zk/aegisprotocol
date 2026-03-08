import { useState, useEffect, useRef, useCallback } from "react";

const SUBGRAPH_URL =
  "https://api.studio.thegraph.com/query/1743315/aegis-protocol/v0.2.0";

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

const AUDITOR_PROFILE_QUERY = `query AuditorProfile($id: ID!) {
  auditor(id: $id) {
    id
    currentStake
    initialStake
    attestationCount
    disputesInvolved
    disputesLost
    reputationScore
    registered
    timestamp
    txHash
    attestations(first: 100, orderBy: timestamp, orderDirection: desc) {
      id
      attestationIndex
      skill {
        id skillName category
        disputes(first: 50) {
          id disputeId attestationIndex
          challenger bond resolved auditorFault
          openedAt resolvedAt txHash
        }
      }
      auditLevel
      revoked
      txHash
      timestamp
    }
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

export function useAuditorProfile(commitment: string, refreshMs = 30_000) {
  const [auditor, setAuditor] = useState<AuditorEntry | null>(null);
  const [attestations, setAttestations] = useState<AuditorAttestationEntry[]>([]);
  const [disputes, setDisputes] = useState<DisputeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    if (!commitment) return;
    try {
      const data = await subgraphQuery<{
        auditor: (AuditorEntry & { attestations: AuditorAttestationEntry[] }) | null;
      }>(AUDITOR_PROFILE_QUERY, { id: commitment.toLowerCase() });
      if (data.auditor) {
        setAuditor(data.auditor);
        const atts = data.auditor.attestations ?? [];
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
        extracted.sort((a, b) => Number(b.openedAt) - Number(a.openedAt));
        setDisputes(extracted);
      }
    } catch (err) {
      console.error("[subgraph] Failed to fetch auditor profile:", err);
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

const BOUNTIES_QUERY = `{
  bounties(first: 200, orderBy: amount, orderDirection: desc) {
    id
    amount
    requiredLevel
    expiresAt
    claimed
    reclaimed
    timestamp
    txHash
    skill {
      id
      skillName
      category
      publisher
    }
  }
}`;

export function useBounties(refreshMs = 30_000) {
  const [bounties, setBounties] = useState<BountyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      const data = await subgraphQuery<{
        bounties: Array<{
          id: string;
          amount: string;
          requiredLevel: number;
          expiresAt: string;
          claimed: boolean;
          reclaimed: boolean;
          timestamp: string;
          txHash: string;
          skill: {
            id: string;
            skillName: string;
            category: string;
            publisher: string;
          };
        }>;
      }>(BOUNTIES_QUERY);
      setBounties(
        data.bounties.map((b) => ({
          id: b.id,
          skillHash: b.skill.id,
          skillName: b.skill.skillName,
          category: b.skill.category,
          publisher: b.skill.publisher,
          amount: b.amount,
          requiredLevel: b.requiredLevel,
          expiresAt: b.expiresAt,
          claimed: b.claimed,
          reclaimed: b.reclaimed,
          timestamp: b.timestamp,
          txHash: b.txHash,
        })),
      );
    } catch (err) {
      console.error("[subgraph] Failed to fetch bounties:", err);
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

// ── Registry Skills (replaces on-chain RPC scanner) ──────

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

const REGISTRY_SKILLS_QUERY = `{
  skills(first: 500, orderBy: timestamp, orderDirection: desc) {
    id
    publisher
    metadataURI
    skillName
    category
    listed
    attestationCount
    blockNumber
    txHash
    timestamp
    attestations(first: 10, orderBy: timestamp, orderDirection: desc) {
      auditLevel
      revoked
      auditor {
        id
        currentStake
      }
    }
    disputes(first: 10) {
      resolved
      auditorFault
    }
  }
}`;

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
      const data = await subgraphQuery<{
        skills: Array<{
          id: string;
          publisher: string;
          metadataURI: string;
          skillName: string;
          category: string;
          listed: boolean;
          attestationCount: number;
          blockNumber: string;
          txHash: string;
          timestamp: string;
          attestations: Array<{
            auditLevel: number;
            revoked: boolean;
            auditor: { id: string; currentStake: string };
          }>;
          disputes: Array<{
            resolved: boolean;
            auditorFault: boolean;
          }>;
        }>;
      }>(REGISTRY_SKILLS_QUERY);

      const entries: SkillEntry[] = data.skills.map((s) => {
        // Use subgraph skillName/category, fall back to parsing metadataURI
        let name = s.skillName;
        let category = s.category;
        let description = "";
        if (!name || name === "Unknown Skill") {
          const parsed = parseMetadataURI(s.metadataURI);
          name = parsed.name;
          category = parsed.category || category;
          description = parsed.description;
        }

        // Determine audit status from attestations
        const latestAttestation = s.attestations.length > 0 ? s.attestations[0] : null;
        const hasActiveAttestation = latestAttestation && !latestAttestation.revoked;
        const auditLevel = hasActiveAttestation ? latestAttestation.auditLevel : 0;
        const auditor = hasActiveAttestation ? latestAttestation.auditor.id : "";
        const stake = hasActiveAttestation
          ? parseFloat((Number(latestAttestation.auditor.currentStake) / 1e18).toFixed(4))
          : 0;

        // Determine statuses
        const hasOpenDispute = s.disputes.some((d) => !d.resolved);
        const hasRevokedAttestation = s.attestations.some((a) => a.revoked);

        let status: "active" | "disputed" | "expired" | "revoked" = "active";
        if (hasOpenDispute) status = "disputed";
        else if (hasRevokedAttestation && !hasActiveAttestation) status = "revoked";

        const auditStatus: "unaudited" | "in_review" | "attested" =
          hasActiveAttestation ? "attested" : "unaudited";

        return {
          id: s.id.slice(0, 10),
          skillHash: s.id,
          name,
          description,
          category,
          publisher: s.publisher,
          auditor,
          level: Math.min(3, Math.max(0, auditLevel)) as 0 | 1 | 2 | 3,
          stake,
          status,
          auditStatus,
          timestamp: Number(s.timestamp) * 1000,
          verifications: s.attestationCount,
          txHash: s.txHash,
          blockNumber: Number(s.blockNumber),
        };
      });

      setSkills(entries);
      setError(null);
    } catch (err) {
      console.error("[subgraph] Failed to fetch registry skills:", err);
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
