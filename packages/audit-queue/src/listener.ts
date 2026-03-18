import { createPublicClient, http, parseEventLogs } from "viem";
import { base, baseSepolia } from "viem/chains";
import { config, chainConfig } from "./config.js";
import {
  getLastSyncedBlock,
  setLastSyncedBlock,
  insertTask,
  taskExists,
  upsertBounty,
  markCompetitorAttested,
} from "./db/index.js";

// ── Event ABIs ──────────────────────────────────────────────

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

const BOUNTY_POSTED_EVENT = [
  {
    type: "event" as const,
    name: "BountyPosted" as const,
    inputs: [
      { name: "skillHash", type: "bytes32" as const, indexed: true },
      { name: "amount", type: "uint256" as const, indexed: false },
      { name: "requiredLevel", type: "uint8" as const, indexed: false },
      { name: "expiresAt", type: "uint256" as const, indexed: false },
    ],
  },
] as const;

const SKILL_REGISTERED_EVENT = [
  {
    type: "event" as const,
    name: "SkillRegistered" as const,
    inputs: [
      { name: "skillHash", type: "bytes32" as const, indexed: true },
      { name: "auditLevel", type: "uint8" as const, indexed: false },
      { name: "auditorCommitment", type: "bytes32" as const, indexed: false },
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
  // Fetch all three event types in parallel
  const [skillLogs, bountyLogs, registeredLogs] = await Promise.all([
    client.getLogs({
      address: chainConfig.registryAddress,
      fromBlock,
      toBlock,
      event: SKILL_LISTED_EVENT[0],
    }),
    client.getLogs({
      address: chainConfig.registryAddress,
      fromBlock,
      toBlock,
      event: BOUNTY_POSTED_EVENT[0],
    }),
    client.getLogs({
      address: chainConfig.registryAddress,
      fromBlock,
      toBlock,
      event: SKILL_REGISTERED_EVENT[0],
    }),
  ]);

  let count = 0;

  // 1. Process SkillListed — insert new tasks
  if (skillLogs.length > 0) {
    const decoded = parseEventLogs({ abi: SKILL_LISTED_EVENT, logs: skillLogs });
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
  }

  // 2. Process BountyPosted — update bounty info on tasks
  if (bountyLogs.length > 0) {
    const decoded = parseEventLogs({ abi: BOUNTY_POSTED_EVENT, logs: bountyLogs });
    for (const log of decoded) {
      const { skillHash, amount, requiredLevel, expiresAt } = log.args as {
        skillHash: string;
        amount: bigint;
        requiredLevel: number;
        expiresAt: bigint;
      };

      // Skip dust bounties
      if (BigInt(config.minBountyWei) > 0n && amount < BigInt(config.minBountyWei)) continue;

      upsertBounty(
        skillHash,
        amount.toString(),
        requiredLevel,
        new Date(Number(expiresAt) * 1000).toISOString()
      );
    }
  }

  // 3. Process SkillRegistered — mark competitor attestations
  if (registeredLogs.length > 0) {
    const decoded = parseEventLogs({ abi: SKILL_REGISTERED_EVENT, logs: registeredLogs });
    for (const log of decoded) {
      const { skillHash, auditLevel, auditorCommitment } = log.args as {
        skillHash: string;
        auditLevel: number;
        auditorCommitment: string;
      };

      // Skip our own attestations
      if (auditorCommitment.toLowerCase() === config.auditorCommitment.toLowerCase()) continue;

      markCompetitorAttested(skillHash, auditLevel);
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
