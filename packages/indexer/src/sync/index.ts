import { createPublicClient, http, parseEventLogs } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { config, chainConfig } from '../config.js';
import { getDb } from '../db/index.js';
import { getLastSyncedBlock, setLastSyncedBlock } from '../db/index.js';
import { REGISTRY_EVENTS } from './events.js';
import { handleEvent, initAttestationCounters } from './handlers.js';

/** Max blocks per getLogs request (public RPCs cap at ~10K) */
const MAX_RANGE = 9_999n;

/** Delay between backfill batches to avoid rate-limiting (ms) */
const BACKFILL_DELAY_MS = 1_500;

/** Sleep helper */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry with exponential backoff on 429 / rate-limit errors */
async function withRetry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const is429 = err?.status === 429 || err?.details?.includes?.('rate limit');
      if (!is429 || attempt === retries - 1) throw err;
      const delay = 2_000 * 2 ** attempt; // 2s, 4s, 8s, 16s, 32s
      console.warn(`[sync] Rate-limited, retrying in ${delay / 1000}s...`);
      await sleep(delay);
    }
  }
  throw new Error('unreachable');
}

const chain = config.chainId === 8453 ? base : baseSepolia;

const client = createPublicClient({
  chain,
  transport: http(config.rpcUrl),
});

/** All registry addresses to watch (v5 + legacy v4) */
const watchAddresses: `0x${string}`[] = [chainConfig.registryAddress];
if (chainConfig.registryV4Address) {
  watchAddresses.push(chainConfig.registryV4Address);
}

/**
 * Process a range of blocks: fetch logs from all registry contracts, decode, handle.
 * Returns the number of events processed.
 */
async function processBlockRange(fromBlock: bigint, toBlock: bigint): Promise<number> {
  const logs = await withRetry(() =>
    client.getLogs({
      address: watchAddresses,
      fromBlock,
      toBlock,
    }),
  );

  if (logs.length === 0) return 0;

  // Decode logs using our event ABI fragments
  const decoded = parseEventLogs({
    abi: REGISTRY_EVENTS,
    logs,
  });

  // Process in order (block number → log index)
  for (const log of decoded) {
    await handleEvent(log as any, client);
  }

  return decoded.length;
}

/**
 * Historical backfill: scan from deployment block (or last synced)
 * to the current chain head. Processes in chunks of MAX_RANGE.
 */
export async function backfill(): Promise<void> {
  // Use the earliest deployment block (v4 if dual-watching, otherwise v5)
  const deploymentBlock = chainConfig.registryV4Address
    ? (chainConfig.deploymentBlockV4 < chainConfig.deploymentBlock ? chainConfig.deploymentBlockV4 : chainConfig.deploymentBlock)
    : chainConfig.deploymentBlock;
  const lastSynced = getLastSyncedBlock();
  const startBlock = lastSynced > 0n ? lastSynced + 1n : deploymentBlock;
  const headBlock = await client.getBlockNumber();

  if (startBlock > headBlock) {
    console.log('[sync] Already up to date');
    return;
  }

  const totalBlocks = headBlock - startBlock;
  console.log(
    `[sync] Backfilling ${totalBlocks} blocks (${startBlock} → ${headBlock})`,
  );

  let cursor = startBlock;
  let totalEvents = 0;

  while (cursor <= headBlock) {
    const end = cursor + MAX_RANGE > headBlock ? headBlock : cursor + MAX_RANGE;
    const count = await processBlockRange(cursor, end);
    totalEvents += count;

    setLastSyncedBlock(end);

    if (count > 0) {
      console.log(`[sync] ${cursor}→${end}: ${count} events (total: ${totalEvents})`);
    }

    cursor = end + 1n;

    // Throttle to avoid rate-limiting on public RPCs
    if (cursor <= headBlock) await sleep(BACKFILL_DELAY_MS);
  }

  console.log(`[sync] Backfill complete — ${totalEvents} events indexed`);
}

/**
 * Live polling: check for new blocks every `pollIntervalMs`.
 * Returns a cleanup function to stop polling.
 */
export function startLiveSync(): () => void {
  let running = true;

  const poll = async () => {
    while (running) {
      try {
        const lastSynced = getLastSyncedBlock();
        const headBlock = await client.getBlockNumber();

        if (headBlock > lastSynced) {
          // Process in chunks in case we fell behind
          let cursor = lastSynced + 1n;
          while (cursor <= headBlock && running) {
            const end = cursor + MAX_RANGE > headBlock ? headBlock : cursor + MAX_RANGE;
            const count = await processBlockRange(cursor, end);

            setLastSyncedBlock(end);

            if (count > 0) {
              console.log(`[live] ${cursor}→${end}: ${count} events`);
            }

            cursor = end + 1n;
          }
        }
      } catch (err) {
        console.error('[live] Poll error:', (err as Error).message);
      }

      // Wait before next poll
      await new Promise((r) => setTimeout(r, config.pollIntervalMs));
    }
  };

  poll();

  return () => {
    running = false;
  };
}

/**
 * Initialize the sync engine:
 * 1. Build attestation counters from existing DB state
 * 2. Run historical backfill
 * 3. Start live polling
 */
export async function initSync(): Promise<() => void> {
  console.log(`[sync] Registry v5: ${chainConfig.registryAddress}`);
  if (chainConfig.registryV4Address) {
    console.log(`[sync] Registry v4: ${chainConfig.registryV4Address}`);
  }
  console.log(`[sync] Chain: ${config.chainId} | RPC: ${config.rpcUrl}`);

  // Initialize attestation index counters from DB
  initAttestationCounters(getDb());

  // Backfill to current head
  await backfill();

  // Start live polling
  const stop = startLiveSync();
  console.log(`[sync] Live sync started (poll every ${config.pollIntervalMs}ms)`);

  return stop;
}
