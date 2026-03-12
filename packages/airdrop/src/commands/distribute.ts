/**
 * `aegis-airdrop distribute` command.
 * v1: Load snapshot, verify Merkle proofs, print summary.
 * Future: batch on-chain transfers via multisig or claim contract.
 */

import { readFileSync } from 'node:fs';
import chalk from 'chalk';
import ora from 'ora';
import type { Snapshot } from '../types.js';
import { verifySnapshot } from '../lib/merkle.js';

export interface DistributeOptions {
  snapshot: string;
  verify?: boolean;
  dryRun?: boolean;
}

export async function distributeCommand(opts: DistributeOptions): Promise<void> {
  console.log(chalk.bold('\n⚡ AEGIS Airdrop Distribution\n'));

  // 1. Load snapshot
  const loadSpinner = ora('Loading snapshot…').start();
  let snapshot: Snapshot;

  try {
    const raw = readFileSync(opts.snapshot, 'utf-8');
    snapshot = JSON.parse(raw) as Snapshot;
  } catch (err) {
    loadSpinner.fail(`Failed to load snapshot: ${opts.snapshot}`);
    throw err;
  }

  loadSpinner.succeed(
    `Loaded snapshot v${snapshot.version} — ` +
      `${snapshot.eligibleCount} auditors, block ${snapshot.snapshotBlock}`,
  );

  // 2. Print summary
  console.log();
  console.log(chalk.dim('  Timestamp:        ') + chalk.white(snapshot.timestamp));
  console.log(chalk.dim('  Chain ID:         ') + chalk.white(snapshot.chainId));
  console.log(chalk.dim('  Snapshot block:   ') + chalk.white(snapshot.snapshotBlock));
  console.log(chalk.dim('  Total amount:     ') + chalk.cyan(snapshot.totalAmount));
  console.log(chalk.dim('  Eligible count:   ') + chalk.cyan(snapshot.eligibleCount));
  console.log(chalk.dim('  Total reputation: ') + chalk.cyan(snapshot.totalReputation));
  console.log(chalk.dim('  Merkle root:      ') + chalk.yellow(snapshot.merkleRoot.slice(0, 18) + '…'));
  console.log();

  // 3. Verify proofs
  if (opts.verify !== false) {
    const verifySpinner = ora('Verifying Merkle proofs…').start();
    const result = verifySnapshot(snapshot.merkleRoot, snapshot.allocations);

    if (result.valid) {
      verifySpinner.succeed(
        chalk.green(`All ${snapshot.allocations.length} proofs verified ✓`),
      );
    } else {
      verifySpinner.fail(`Verification failed: ${result.failures.length} errors`);
      for (const f of result.failures) {
        console.log(chalk.red(`  ✗ ${f}`));
      }
      process.exitCode = 1;
      return;
    }
  }

  // 4. Dry run — print what would be distributed
  if (opts.dryRun) {
    console.log();
    console.log(chalk.bold('  📋 Distribution plan (dry run):'));
    console.log();
    console.log(
      chalk.dim('    Commitment           │ Share   │ Token Amount'),
    );
    console.log(chalk.dim('    ' + '─'.repeat(55)));

    for (const a of snapshot.allocations) {
      console.log(
        chalk.dim('    ') +
          chalk.white(a.commitment.slice(0, 20) + '…') +
          chalk.dim(' │ ') +
          chalk.cyan(a.sharePercent.padStart(7)) +
          chalk.dim(' │ ') +
          chalk.green(a.tokenAmount),
      );
    }

    console.log();
    console.log(chalk.yellow('  ⚠  Dry run — no transactions sent.\n'));
    return;
  }

  // 5. Future: actual distribution
  console.log();
  console.log(
    chalk.yellow(
      '  ⚠  On-chain distribution not yet implemented.\n' +
        '     Use --dry-run to preview, or export snapshot for multisig batch transfer.\n',
    ),
  );
}
