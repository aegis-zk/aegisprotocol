import { initDb, claimNextTask, updateTaskState, getRetryableTasks, getTaskStats } from "./db/index.js";
import { config } from "./config.js";
import { backfill, startLiveListener } from "./listener.js";
import { runAudit } from "./runner.js";
import { generateProof } from "./prover.js";
import { submitAttestation, verifyAttestation } from "./submitter.js";
import { computeNextRetry } from "./retry.js";

// ── Banner ──────────────────────────────────────────────────

function printBanner() {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║       AEGIS Automated Audit Pipeline      ║
  ║              v0.1.0 · Base L2             ║
  ╚═══════════════════════════════════════════╝
  `);
  console.log(`  Chain:       ${config.chainId}`);
  console.log(`  RPC:         ${config.rpcUrl}`);
  console.log(`  Audit Level: L${config.preferredAuditLevel}`);
  console.log(`  Concurrency: ${config.maxConcurrency}`);
  console.log(`  DB:          ${config.dbPath}`);
  console.log();
}

// ── Queue Processor ─────────────────────────────────────────

let running = true;

async function processQueue(): Promise<void> {
  // Derive auditor commitment from private key (would normally use SDK)
  // For now, this is a placeholder — the real commitment comes from
  // pedersen_hash(privateKey) computed during auditor registration
  const auditorCommitment = process.env.AUDITOR_COMMITMENT ?? "0x";

  while (running) {
    try {
      // 1. Re-queue retryable failed tasks
      const retryable = getRetryableTasks();
      for (const task of retryable) {
        console.log(`[queue] Re-queuing failed task ${task.skillHash.slice(0, 10)}... (attempt ${task.attempt + 1})`);
        updateTaskState(task.id, "discovered");
      }

      // 2. Claim next task
      const task = claimNextTask();

      if (!task) {
        // Nothing to do — sleep and check again
        await sleep(config.pollIntervalMs);
        continue;
      }

      console.log(`\n[queue] ═══ Processing ${task.skillHash.slice(0, 10)}... ═══`);
      console.log(`[queue] Publisher: ${task.publisher}`);
      console.log(`[queue] Attempt: ${task.attempt + 1}`);

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

      const { proof, publicInputs } = await generateProof(result, auditorCommitment);

      updateTaskState(task.id, "proof-generating", {
        proofHex: proof,
        publicInputs: JSON.stringify(publicInputs),
      });

      // 5. Submit on-chain
      updateTaskState(task.id, "submitting");
      console.log("[submit] Submitting attestation transaction...");

      const txHash = await submitAttestation({
        skillHash: task.skillHash,
        metadataURI: task.metadataURI,
        proof,
        publicInputs,
        auditorCommitment,
        auditLevel: config.preferredAuditLevel,
      });

      // 6. Verify
      const verified = await verifyAttestation(task.skillHash, txHash);

      updateTaskState(task.id, "verified", {
        txHash,
        completedAt: new Date().toISOString(),
      });

      console.log(`[queue] ✓ ${task.skillHash.slice(0, 10)}... ${verified ? "verified" : "submitted (pending verification)"}`);

    } catch (err) {
      console.error("[queue] Unexpected error:", (err as Error).message);

      // If we had a claimed task, mark it failed
      const task = claimNextTask();
      if (task) {
        updateTaskState(task.id, "failed", {
          lastError: (err as Error).message,
          attempt: task.attempt + 1,
          nextRetryAt: computeNextRetry(task.attempt, config.retryBaseDelayMs),
        });
      }

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

  // 2. Backfill historical SkillListed events
  console.log("[init] Starting historical backfill...");
  await backfill();

  // Print initial stats
  const stats = getTaskStats();
  console.log(`[init] Queue: ${stats.total} tasks`, stats.byState);

  // 3. Start live listener for new SkillListed events
  console.log("[init] Starting live event listener...");
  const stopListener = startLiveListener();

  // 4. Start queue processor
  console.log("[init] Starting queue processor...\n");
  const processorPromise = processQueue();

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n[shutdown] Stopping...");
    running = false;
    stopListener();
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
