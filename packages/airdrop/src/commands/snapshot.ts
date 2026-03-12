/**
 * `aegis-airdrop snapshot` command.
 * Queries the subgraph, computes allocations, builds Merkle tree, writes output.
 */

import chalk from 'chalk';
import ora from 'ora';
import type { Snapshot } from '../types.js';
import { resolveConfig, type SnapshotOptions } from '../lib/config.js';
import { computeAllocations } from '../lib/snapshot.js';
import { buildMerkleTree } from '../lib/merkle.js';
import { getIndexedBlock } from '../lib/subgraph.js';
import { writeSnapshot } from '../lib/output.js';

export async function snapshotCommand(opts: SnapshotOptions): Promise<void> {
  console.log(chalk.bold('\n⚡ AEGIS Airdrop Snapshot\n'));

  // 1. Resolve config
  const config = resolveConfig(opts);
  const decimals = config.tokenDecimals;
  const humanAmount = formatTokenAmount(config.totalAmount, decimals);

  console.log(chalk.dim('  Total amount:   ') + chalk.cyan(humanAmount + ' tokens'));
  console.log(chalk.dim('  Min reputation: ') + chalk.cyan(config.minReputation.toString()));
  if (config.minStake > 0n) {
    console.log(chalk.dim('  Min stake:      ') + chalk.cyan(formatEth(config.minStake)));
  }
  console.log(chalk.dim('  Merkle tree:    ') + chalk.cyan(config.skipMerkle ? 'skipped' : 'enabled'));
  console.log(chalk.dim('  Subgraph:       ') + chalk.cyan(config.subgraphUrl));
  console.log();

  // 2. Query subgraph
  const spinner = ora('Querying subgraph for auditors…').start();

  let blockNumber: number;
  try {
    blockNumber = await getIndexedBlock(config.subgraphUrl);
    spinner.text = `Querying subgraph (block ${blockNumber})…`;
  } catch {
    blockNumber = 0;
  }

  const { allocations, totalReputation } = await computeAllocations(config);

  if (allocations.length === 0) {
    spinner.warn('No eligible auditors found.');
    return;
  }

  spinner.succeed(
    `Found ${chalk.bold(allocations.length)} eligible auditors (total reputation: ${totalReputation})`,
  );

  // 3. Build Merkle tree
  let merkleRoot = '0x' + '0'.repeat(64);
  let finalAllocations = allocations;

  if (!config.skipMerkle) {
    const merkleSpinner = ora('Building Merkle tree…').start();
    const result = buildMerkleTree(allocations);
    merkleRoot = result.root;
    finalAllocations = result.allocations;
    merkleSpinner.succeed(`Merkle root: ${chalk.yellow(merkleRoot.slice(0, 18))}…`);
  }

  // 4. Assemble snapshot
  const snapshot: Snapshot = {
    version: '1.0.0',
    chainId: 8453,
    snapshotBlock: blockNumber,
    timestamp: new Date().toISOString(),
    totalAmount: config.totalAmount.toString(),
    eligibleCount: finalAllocations.length,
    totalReputation: totalReputation.toString(),
    minReputation: config.minReputation.toString(),
    merkleRoot,
    allocations: finalAllocations,
  };

  // 5. Write output
  const outputSpinner = ora('Writing snapshot files…').start();
  const { jsonPath, csvPath } = writeSnapshot(snapshot, config.outputDir);
  outputSpinner.succeed('Snapshot written');

  // 6. Summary
  console.log();
  console.log(chalk.bold('  📄 Output files:'));
  console.log(chalk.dim('    JSON: ') + chalk.green(jsonPath));
  console.log(chalk.dim('    CSV:  ') + chalk.green(csvPath));
  console.log();

  // Top allocations
  const top = finalAllocations.slice(0, 5);
  console.log(chalk.bold('  🏆 Top allocations:'));
  for (const a of top) {
    const amount = formatTokenAmount(BigInt(a.tokenAmount), decimals);
    console.log(
      chalk.dim('    ') +
        chalk.white(a.commitment.slice(0, 10) + '…') +
        chalk.dim(' │ ') +
        chalk.cyan(a.sharePercent.padStart(7)) +
        chalk.dim(' │ ') +
        chalk.green(amount + ' tokens'),
    );
  }

  if (finalAllocations.length > 5) {
    console.log(chalk.dim(`    … and ${finalAllocations.length - 5} more`));
  }

  console.log();
  console.log(chalk.green('✅ Snapshot complete.\n'));
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatTokenAmount(amount: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const intPart = amount / divisor;
  const fracPart = amount % divisor;
  const fracStr = fracPart.toString().padStart(decimals, '0').replace(/0+$/, '');

  if (fracStr.length === 0) return intPart.toLocaleString();
  return `${intPart.toLocaleString()}.${fracStr.slice(0, 4)}`;
}

function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  return `${eth} ETH`;
}
