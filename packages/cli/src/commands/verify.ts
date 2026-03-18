import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import type { Hex } from 'viem';
import { resolveConfig } from '../utils/config.js';
import { getPublicClient } from '../utils/wallet.js';
import { truncateHex, fmtAuditLevel, fmtEth, fmtTimestamp } from '../utils/format.js';

const REGISTRY_ABI = [
  {
    name: 'getAttestations',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'skillHash', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'skillHash', type: 'bytes32' },
          { name: 'auditCriteriaHash', type: 'bytes32' },
          { name: 'zkProof', type: 'bytes' },
          { name: 'auditorCommitment', type: 'bytes32' },
          { name: 'stakeAmount', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'auditLevel', type: 'uint8' },
        ],
      },
    ],
  },
  {
    name: 'verifyAttestation',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'skillHash', type: 'bytes32' },
      { name: 'attestationIndex', type: 'uint256' },
    ],
    outputs: [{ name: 'valid', type: 'bool' }],
  },
] as const;

export const verifyCmd = new Command('verify')
  .description('Verify a skill attestation on-chain')
  .requiredOption('-s, --skill <hash>', 'Skill hash (bytes32)')
  .option('-i, --index <n>', 'Attestation index (default: 0)', '0')
  .option('--info', 'Show attestation details without re-verifying the proof')
  .option('-n, --network <network>', 'Network: base', 'base')
  .option('--rpc <url>', 'Custom RPC URL')
  .option('--registry <address>', 'AegisRegistry contract address')
  .action(async (opts) => {
    try {
      const config = resolveConfig(opts);
      const publicClient = getPublicClient(config);

      const skillHash = opts.skill as Hex;
      const index = parseInt(opts.index, 10);

      console.log(chalk.bold('\n  AEGIS — Verify Attestation\n'));
      console.log(`  Skill: ${truncateHex(skillHash)}`);
      console.log(`  Index: ${index}`);
      console.log(`  Network: ${opts.network ?? 'base'}\n`);

      // Fetch attestation details
      const spinner = ora('Fetching attestation...').start();

      const attestations = (await publicClient.readContract({
        address: config.registryAddress,
        abi: REGISTRY_ABI,
        functionName: 'getAttestations',
        args: [skillHash],
      })) as readonly {
        skillHash: Hex;
        auditCriteriaHash: Hex;
        zkProof: Hex;
        auditorCommitment: Hex;
        stakeAmount: bigint;
        timestamp: bigint;
        auditLevel: number;
      }[];

      if (!attestations || attestations.length === 0) {
        spinner.fail(chalk.yellow('No attestations found for this skill'));
        process.exit(1);
      }

      if (index >= attestations.length) {
        spinner.fail(chalk.yellow(`Index ${index} out of range (${attestations.length} attestations)`));
        process.exit(1);
      }

      spinner.succeed('Attestation found');

      const att = attestations[index];
      console.log(`\n  ${chalk.bold('Attestation Details')}`);
      console.log(`  ──────────────────────────────`);
      console.log(`  Skill hash:     ${truncateHex(att.skillHash)}`);
      console.log(`  Criteria hash:  ${truncateHex(att.auditCriteriaHash)}`);
      console.log(`  Auditor:        ${truncateHex(att.auditorCommitment)}`);
      console.log(`  Audit level:    ${fmtAuditLevel(att.auditLevel)}`);
      console.log(`  Stake:          ${fmtEth(att.stakeAmount)}`);
      console.log(`  Timestamp:      ${fmtTimestamp(att.timestamp)}`);
      console.log(`  Proof size:     ${(att.zkProof.length - 2) / 2} bytes`);

      if (opts.info) {
        console.log('');
        return;
      }

      // Re-verify the proof on-chain
      const verifySpinner = ora('Re-verifying ZK proof on-chain...').start();

      try {
        const valid = await publicClient.readContract({
          address: config.registryAddress,
          abi: REGISTRY_ABI,
          functionName: 'verifyAttestation',
          args: [skillHash, BigInt(index)],
        });

        if (valid) {
          verifySpinner.succeed(chalk.green('Proof is VALID'));
        } else {
          verifySpinner.fail(chalk.red('Proof is INVALID'));
        }
      } catch {
        verifySpinner.fail(chalk.red('Verification failed (transaction reverted)'));
      }

      console.log('');
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });
