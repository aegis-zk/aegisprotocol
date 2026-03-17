import { createPublicClient, http, parseEventLogs } from "viem";
import { base, baseSepolia } from "viem/chains";
import { config, chainConfig } from "./config.js";
import { getLastSyncedBlock, setLastSyncedBlock, insertTask, taskExists } from "./db/index.js";

// ── SkillListed Event ABI ───────────────────────────────────

const SKILL_LISTED_EVENT = [
  {
    type: "event" as const,
    name: "SkillListed" as const,
    inputs: [
      { name: "skillHash", type: "bytes32" as const, indexed: true },
      { name: "publisher", type: "address" as const, indexed: true },
      { name: "metadataURI", type: "string" as const, indexed: false },
    ],
  },
] as const;

// ── Client ──────────────────────────────────────────────────

const chain = config.chainId === 8453 ? base : baseSepolia;

const client = createPublicClient({
  chain,
  transport: http(config.rpcUrl),
});

// ── Process Block Range ─────────────────────────────────────

async function processBlockRange(
  fromBlock: bigint,
  toBlock: bigint
): Promise<number> {
  const logs = await client.getLogs({
    address: chainConfig.registryAddress,
    fromBlock,
    toBlock,
    // Filter only SkillListed events
    event: SKILL_LISTED_EVENT[0],
  });

  if (logs.length === 0) return 0;

  const decoded = parseEventLogs({
    abi: SKILL_LISTED_EVENT,
    logs,
  });

  let count = 0;
  for (const log of decoded) {
    const { skillHash, publisher, metadataURI } = log.args as {
      skillHash: string;
      publisher: string;
      metadataURI: string;
    };

    if (!taskExists(skillHash)) {
      insertTask(skillHash, publisher, metadataURI, config.preferredAuditLevel);
      count++;
    }
  }

  return count;
}

// ── Historical Backfill ─────────────────────────────────────

export async function backfill(): Promise<void> {
  const lastSynced = getLastSyncedBlock();
  const startBlock = lastSynced > 0n ? lastSynced + 1n : chainConfig.deploymentBlock;
  const headBlock = await client.getBlockNumber();

  if (startBlock > headBlock) {
    console.log("[listener] Already up to date");
    return;
  }

  const totalBlocks = headBlock - startBlock;
  console.log(`[listener] Backfilling ${totalBlocks} blocks (${startBlock} → ${headBlock})`);

  let cursor = startBlock;
  let totalEvents = 0;

  while (cursor <= headBlock) {
    const end =
      cursor + config.maxLogRange > headBlock
        ? headBlock
        : cursor + config.maxLogRange;

    const count = await processBlockRange(cursor, end);
    totalEvents += count;
    setLastSyncedBlock(end);

    if (count > 0) {
      console.log(`[listener] ${cursor}→${end}: ${count} new skills queued (total: ${totalEvents})`);
    }

    cursor = end + 1n;
  }

  console.log(`[listener] Backfill complete — ${totalEvents} skills queued`);
}

// ── Live Polling ────────────────────────────────────────────

export function startLiveListener(): () => void {
  let running = true;

  const poll = async () => {
    while (running) {
      try {
        const lastSynced = getLastSyncedBlock();
        const headBlock = await client.getBlockNumber();

        if (headBlock > lastSynced) {
          let cursor = lastSynced + 1n;

          while (cursor <= headBlock && running) {
            const end =
              cursor + config.maxLogRange > headBlock
                ? headBlock
                : cursor + config.maxLogRange;

            const count = await processBlockRange(cursor, end);
            setLastSyncedBlock(end);

            if (count > 0) {
              console.log(`[live] ${cursor}→${end}: ${count} new skills queued`);
            }

            cursor = end + 1n;
          }
        }
      } catch (err) {
        console.error("[live] Poll error:", (err as Error).message);
      }

      // Wait before next poll
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, config.pollIntervalMs);
        // Allow cleanup to break out of sleep
        if (!running) {
          clearTimeout(timer);
          resolve();
        }
      });
    }
  };

  poll().catch(err => console.error("[live] Fatal:", err));

  return () => {
    running = false;
    console.log("[live] Listener stopped");
  };
}
