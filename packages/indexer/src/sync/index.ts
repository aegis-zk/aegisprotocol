import { createPublicClient, http, parseEventLogs } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { config, chainConfig } from '../config.js';
import { getDb } from '../db/index.js';
import { getLastSyncedBlock, setLastSyncedBlock } from '../db/index.js';
import { REGISTRY_EVENTS } from './events.js';
import { handleEvent, initAttestationCounters } from './handlers.js';

/** Max blocks per getLogs request (public RPCs cap at ~10K) */
const MAX_RANGE = 9_999n;

const chain = config.chainId === 8453 ? base : baseSepolia;

const client = createPublicClient({
  chain,
  transport: http(config.rpcUrl),
});

/**
 * Process a range of blocks: fetch logs, decode, handle.
 * Returns the number of events processed.
 */
async function processBlockRange(fromBlock: bigint, toBlock: bigint): Promise<number> {
  const logs = await client.getLogs({
    address: chainConfig.registryAddress,
    fromBlock,
    toBlock,
  });

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
  const deploymentBlock = chainConfig.deploymentBlock;
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
  console.log(`[sync] Registry: ${chainConfig.registryAddress}`);
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
