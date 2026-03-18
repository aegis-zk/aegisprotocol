import { createServer, type Server } from "node:http";
import { initDb, claimNextTask, updateTaskState, getRetryableTasks, skipTask, getHealthStats } from "./db/index.js";
import { config } from "./config.js";
import { backfill, startLiveListener } from "./listener.js";
import { runAudit } from "./runner.js";
import { generateProof } from "./prover.js";
import { submitAttestation, verifyAttestation, checkAlreadyAttested, checkBountyStillAvailable } from "./submitter.js";
import { computeNextRetry } from "./retry.js";

// ── Banner ──────────────────────────────────────────────────

function printBanner() {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║       AEGIS Automated Audit Pipeline      ║
  ║         v0.2.0 · Bounty-Aware Racing      ║
  ╚═══════════════════════════════════════════╝
  `);
  console.log(`  Chain:       ${config.chainId}`);
  console.log(`  RPC:         ${config.rpcUrl}`);
  console.log(`  Auditor:     ${config.auditorAddress}`);
  console.log(`  Commitment:  ${config.auditorCommitment.slice(0, 10)}...`);
  console.log(`  Audit Level: L${config.preferredAuditLevel}`);
  console.log(`  Concurrency: ${config.maxConcurrency}`);
  console.log(`  Health:      http://localhost:${config.healthPort}`);
  console.log(`  DB:          ${config.dbPath}`);
  console.log();
}

// ── Health HTTP Server ──────────────────────────────────────

function startHealthServer(): Server {
  const server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");

    if (req.url === "/health") {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: "ok",
        version: "0.2.0",
        chain: config.chainId,
        auditor: config.auditorAddress,
        uptime: process.uptime(),
      }));
      return;
    }

    if (req.url === "/stats") {
      try {
        const stats = getHealthStats();
        res.writeHead(200);
        res.end(JSON.stringify(stats));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found. Use /health or /stats" }));
  });

  server.listen(config.healthPort, () => {
    console.log(`[health] Listening on http://localhost:${config.healthPort}`);
  });

  return server;
}

// ── Queue Processor ─────────────────────────────────────────

let running = true;

async function processQueue(): Promise<void> {
  while (running) {
    try {
      // 1. Re-queue retryable failed tasks
      const retryable = getRetryableTasks();
      for (const task of retryable) {
        console.log(`[queue] Re-queuing failed task ${task.skillHash.slice(0, 10)}... (attempt ${task.attempt + 1})`);
        updateTaskState(task.id, "discovered");
      }

      // 2. Claim next task (bounty-priority ordering)
      const task = claimNextTask();

      if (!task) {
        await sleep(config.pollIntervalMs);
        continue;
      }

      const tag = task.skillHash.slice(0, 10);
      console.log(`\n[queue] ═══ Processing ${tag}... ═══`);
      console.log(`[queue] Publisher: ${task.publisher}`);
      console.log(`[queue] Attempt: ${task.attempt + 1}`);
      if (task.bountyAmount && task.bountyAmount !== "0") {
        console.log(`[queue] Bounty: ${task.bountyAmount} wei (L${task.bountyRequiredLevel})`);
      }

      // 3. Run audit checklist
      updateTaskState(task.id, "auditing");
      console.log(`[audit] Running L${config.preferredAuditLevel} checklist...`);

      const result = await runAudit(task, config.preferredAuditLevel);

      const passed = result.criteria.filter(c => c.passed).length;
      const total = result.criteria.length;
      console.log(`[audit] Result: ${passed}/${total} criteria passed`);

      if (!result.allPassed) {
        const failed = result.criteria.filter(c => !c.passed).map(c => c.criterionId);
        console.warn(`[audit] Failed criteria: ${failed.join(", ")}`);
        updateTaskState(task.id, "failed", {
          lastError: `Audit failed: ${failed.join(", ")}`,
          attempt: task.attempt + 1,
          nextRetryAt: computeNextRetry(task.attempt, config.retryBaseDelayMs),
        });
        continue;
      }

      // 4. Generate ZK proof
      updateTaskState(task.id, "proof-generating");
      console.log("[prover] Generating ZK attestation proof...");

      const { proof, publicInputs } = await generateProof(result, config.auditorCommitment);

      updateTaskState(task.id, "proof-generating", {
        proofHex: proof,
        publicInputs: JSON.stringify(publicInputs),
      });

      // 5. Pre-submission race check — did a competitor already attest?
      console.log("[race] Checking for existing attestations...");
      const alreadyAttested = await checkAlreadyAttested(task.skillHash, config.preferredAuditLevel);
      if (alreadyAttested) {
        skipTask(task.id);
        console.log(`[race] Skipped ${tag}... — already attested by competitor`);
        continue;
      }

      // 6. Check bounty availability (informational — still submit for reputation)
      let bountyRecipient: string | undefined;
      if (task.bountyAmount && task.bountyAmount !== "0") {
        const bountyCheck = await checkBountyStillAvailable(task.skillHash);
        if (bountyCheck.available) {
          bountyRecipient = config.auditorAddress;
          console.log(`[bounty] Claiming bounty → ${config.auditorAddress}`);
        } else {
          console.log(`[bounty] Bounty no longer available — submitting for reputation only`);
        }
      }

      // 7. Submit on-chain
      updateTaskState(task.id, "submitting");
      console.log("[submit] Submitting attestation transaction...");

      const txHash = await submitAttestation({
        skillHash: task.skillHash,
        metadataURI: task.metadataURI,
        proof,
        publicInputs,
        auditorCommitment: config.auditorCommitment,
        auditLevel: config.preferredAuditLevel,
        bountyRecipient,
      });

      // 8. Verify
      const verified = await verifyAttestation(task.skillHash, txHash);

      updateTaskState(task.id, "verified", {
        txHash,
        completedAt: new Date().toISOString(),
      });

      console.log(`[queue] ✓ ${tag}... ${verified ? "verified" : "submitted (pending verification)"}${bountyRecipient ? " + bounty claimed" : ""}`);

    } catch (err) {
      console.error("[queue] Unexpected error:", (err as Error).message);
      await sleep(config.pollIntervalMs);
    }
  }
}

// ── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  printBanner();

  // 1. Initialize database
  console.log("[init] Initializing database...");
  await initDb();

  // 2. Start health endpoint
  const healthServer = startHealthServer();

  // 3. Backfill historical events (SkillListed + BountyPosted + SkillRegistered)
  console.log("[init] Starting historical backfill...");
  await backfill();

  // Print initial stats
  const stats = getHealthStats();
  console.log(`[init] Queue: ${stats.total} tasks`, stats.byState);
  if (stats.bountyTaskCount > 0) {
    console.log(`[init] Bounty tasks: ${stats.bountyTaskCount} (${stats.totalBountyWei} wei total)`);
  }

  // 4. Start live listener for new events
  console.log("[init] Starting live event listener...");
  const stopListener = startLiveListener();

  // 5. Start queue processor
  console.log("[init] Starting queue processor...\n");
  const processorPromise = processQueue();

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n[shutdown] Stopping...");
    running = false;
    stopListener();
    healthServer.close();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await processorPromise;
  console.log("[shutdown] Audit queue stopped");
}

// ── Helpers ─────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Run ─────────────────────────────────────────────────────

main().catch(err => {
  console.error("[fatal]", err);
  process.exit(1);
});
