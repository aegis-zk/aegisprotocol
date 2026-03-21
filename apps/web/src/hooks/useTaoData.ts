import { useState, useEffect } from "react";
import { keccak256, toHex } from "viem";

// ── Indexer URL ─────────────────────────────────────────
const INDEXER_URL =
  (import.meta.env.VITE_INDEXER_URL as string)?.replace(/\/$/, "") ||
  "https://indexer.aegisprotocol.tech";

const SUBTENSOR_URL =
  (import.meta.env.VITE_BITTENSOR_RPC_URL as string) ||
  "https://entrypoint-finney.opentensor.ai:443";

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

// ── SCALE compact length decoder (fallback) ─────────────

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
  return { value: 0, bytesRead: 1 };
}

// ── Indexer fetch with fallback ─────────────────────────

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

// ── Fallback: direct Finney RPC ─────────────────────────

async function fetchSubnetsFallback(): Promise<TaoSubnet[]> {
  const res = await fetch(SUBTENSOR_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: 1, jsonrpc: "2.0",
      method: "state_call",
      params: ["SubnetInfoRuntimeApi_get_subnets_info", "0x"],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { result?: string; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  if (!json.result) throw new Error("Empty response");

  const hex = json.result.slice(2);
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
  const { value: subnetCount } = decodeCompactLength(bytes, 0);

  return Array.from({ length: subnetCount }, (_, i) => ({
    netuid: i,
    name: SUBNET_NAMES[i] || `Subnet ${i}`,
    minerCount: 0,
    validatorCount: 0,
    skillHash: computeTaoSubnetHash(i),
    attested: false,
    attestationCount: 0,
  }));
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

        // Fallback to direct RPC
        const rpcData = await fetchSubnetsFallback();
        if (!cancelled) {
          cachedSubnets = rpcData;
          cacheTime = Date.now();
          setSubnets(rpcData);
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
