import { useState, useEffect } from "react";
import { keccak256, toHex } from "viem";

// ── Indexer URL ─────────────────────────────────────────
const INDEXER_URL =
  (import.meta.env.VITE_INDEXER_URL as string)?.replace(/\/$/, "") ||
  "https://indexer.aegisprotocol.tech";

// ── Types ───────────────────────────────────────────────

export interface TaoSubnet {
  netuid: number;
  name: string;
  minerCount: number;
  validatorCount: number;
  skillHash: string;
  attested: boolean;
  attestationCount: number;
}

export interface TaoMiner {
  hotkey: string;
  uid: number;
  stake: string;
  trust: number;
  consensus: number;
  incentive: number;
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

// ── Well-known Bittensor subnet names (fallback) ────────

const SUBNET_NAMES: Record<number, string> = {
  0: "Root", 1: "Apex", 2: "Omron", 3: "MyShell", 4: "Targon",
  5: "OpenKaito", 6: "Nous Research", 7: "Subvortex", 8: "Taoshi",
  9: "Pre-training", 10: "MAP Protocol", 11: "Dippy", 12: "Horde",
  13: "Dataverse", 14: "Palaidn", 15: "Datura", 16: "BitAds",
  17: "ThreeGen", 18: "Cortex.t", 19: "Namorai", 20: "BitAgent",
  21: "FileTao", 22: "Datura", 23: "NicheImage", 24: "Omega",
  25: "Hivemind", 26: "Alchemy", 27: "Compute", 28: "Foundry S&P 500",
  29: "Coldint", 30: "Bettensor", 31: "NAS Chain", 32: "It's AI",
  33: "ReadyAI", 34: "BitMind", 35: "LogicNet", 36: "NetSynth",
  37: "Finetuning", 38: "Tatsu", 39: "EdgeMaxxing", 40: "Chunking",
  41: "Sportstensor", 42: "Masa", 43: "Graphite", 44: "Score Predict",
  45: "GenScore", 46: "NeuralAI", 47: "Condense AI", 48: "NextPlace",
  49: "Automate", 50: "Audio Subnet", 51: "Celium", 52: "Dojo",
};

// ── Skill hash derivation (mirrors SDK) ─────────────────

export function computeTaoSubnetHash(netuid: number): string {
  return keccak256(toHex(`tao:subnet:${netuid}`));
}

export function computeTaoMinerHash(netuid: number, hotkey: string): string {
  return keccak256(toHex(`tao:miner:${netuid}:${hotkey}`));
}

// ── Indexer fetch ───────────────────────────────────────

async function indexerFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${INDEXER_URL}${path}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: T };
    return json.data ?? null;
  } catch {
    return null;
  }
}

// ── Hooks ───────────────────────────────────────────────

let cachedSubnets: TaoSubnet[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

export function useTaoSubnets() {
  const [subnets, setSubnets] = useState<TaoSubnet[]>(cachedSubnets || []);
  const [loading, setLoading] = useState(!cachedSubnets);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedSubnets && Date.now() - cacheTime < CACHE_TTL) {
      setSubnets(cachedSubnets);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchSubnets() {
      setLoading(true);
      setError(null);
      try {
        // Try indexer first
        const indexerData = await indexerFetch<TaoSubnet[]>("/tao/subnets");
        if (indexerData && indexerData.length > 0) {
          const mapped = indexerData.map(s => ({
            ...s,
            skillHash: s.skillHash || (s as any).aegisSkillHash || computeTaoSubnetHash(s.netuid),
          }));
          if (!cancelled) {
            cachedSubnets = mapped;
            cacheTime = Date.now();
            setSubnets(mapped);
          }
          return;
        }
      } catch (err) {
        // Final fallback: known subnet names
        if (!cancelled) {
          const fallback = Object.entries(SUBNET_NAMES).map(([id, name]) => ({
            netuid: Number(id),
            name,
            minerCount: 0,
            validatorCount: 0,
            skillHash: computeTaoSubnetHash(Number(id)),
            attested: false,
            attestationCount: 0,
          }));
          cachedSubnets = fallback;
          cacheTime = Date.now();
          setSubnets(fallback);
          setError(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSubnets();
    return () => { cancelled = true; };
  }, []);

  return { subnets, loading, error };
}

export function useTaoMetagraph(netuid: number | null) {
  const [miners, setMiners] = useState<TaoMiner[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (netuid === null) {
      setMiners([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function fetchMetagraph() {
      try {
        const data = await indexerFetch<{ miners: TaoMiner[] }>(`/tao/subnets/${netuid}`);
        if (!cancelled && data?.miners) {
          setMiners(data.miners);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to fetch metagraph");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMetagraph();
    return () => { cancelled = true; };
  }, [netuid]);

  return { miners, loading, error };
}

export function useTaoStats() {
  const [stats, setStats] = useState<TaoStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      const data = await indexerFetch<TaoStats>("/tao/stats");
      if (!cancelled && data) {
        setStats(data);
      }
      if (!cancelled) setLoading(false);
    }

    fetchStats();
    return () => { cancelled = true; };
  }, []);

  return { stats, loading };
}
