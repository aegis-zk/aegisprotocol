/**
 * AEGIS Airdrop CLI
 *
 * Commands:
 *   snapshot   — Query subgraph, compute allocations, generate Merkle tree
 *   distribute — Load snapshot, verify proofs, distribute tokens
 */

import { Command } from 'commander';
import { snapshotCommand } from './commands/snapshot.js';
import { distributeCommand } from './commands/distribute.js';

const program = new Command();

program
  .name('aegis-airdrop')
  .description('Airdrop snapshot and distribution tooling for $AEGIS token')
  .version('0.1.0');

// ─── snapshot ─────────────────────────────────────────────────────────

program
  .command('snapshot')
  .description('Generate an airdrop snapshot from the AEGIS subgraph')
  .requiredOption('--amount <tokens>', 'Total token amount to distribute (human-readable)')
  .option('--min-reputation <n>', 'Minimum reputation score to qualify', '0')
  .option('--min-stake <eth>', 'Minimum stake in ETH to qualify')
  .option('--decimals <n>', 'Token decimals (default: 18)', '18')
  .option('--output <dir>', 'Output directory', './snapshots')
  .option('--subgraph <url>', 'Subgraph endpoint URL')
  .option('--no-merkle', 'Skip Merkle tree generation')
  .action(async (opts) => {
    try {
      await snapshotCommand({
        amount: opts.amount,
        minReputation: opts.minReputation,
        minStake: opts.minStake,
        decimals: opts.decimals,
        output: opts.output,
        subgraph: opts.subgraph,
        noMerkle: !opts.merkle,
      });
    } catch (err) {
      console.error('\n❌ Snapshot failed:', (err as Error).message);
      process.exitCode = 1;
    }
  });

// ─── distribute ───────────────────────────────────────────────────────

program
  .command('distribute')
  .description('Load and verify a snapshot, preview or execute distribution')
  .requiredOption('--snapshot <path>', 'Path to snapshot JSON file')
  .option('--verify', 'Verify all Merkle proofs', true)
  .option('--no-verify', 'Skip Merkle proof verification')
  .option('--dry-run', 'Print distribution plan without executing')
  .action(async (opts) => {
    try {
      await distributeCommand({
        snapshot: opts.snapshot,
        verify: opts.verify,
        dryRun: opts.dryRun,
      });
    } catch (err) {
      console.error('\n❌ Distribution failed:', (err as Error).message);
      process.exitCode = 1;
    }
  });

program.parse();
