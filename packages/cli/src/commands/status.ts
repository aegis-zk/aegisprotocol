import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import type { Hex } from 'viem';
import { resolveConfig } from '../utils/config.js';
import { getPublicClient } from '../utils/wallet.js';
import { fmtEth, truncateHex, fmtAuditLevel, fmtTimestamp } from '../utils/format.js';

const REGISTRY_ABI = [
  {
    name: 'getAuditorReputation',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'auditorCommitment', type: 'bytes32' }],
    outputs: [
      { name: 'score', type: 'uint256' },
      { name: 'totalStake', type: 'uint256' },
      { name: 'attestationCount', type: 'uint256' },
    ],
  },
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
    name: 'metadataURIs',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

export const statusCmd = new Command('status')
  .description('Query auditor reputation or skill attestation status')
  .option('--auditor <commitment>', 'Auditor commitment hash (bytes32)')
  .option('--skill <hash>', 'Skill hash (bytes32)')
  .option('-n, --network <network>', 'Network: base', 'base')
  .option('--rpc <url>', 'Custom RPC URL')
  .option('--registry <address>', 'AegisRegistry contract address')
  .action(async (opts) => {
    try {
      if (!opts.auditor && !opts.skill) {
        console.error(chalk.red('\n  Provide --auditor <commitment> or --skill <hash>\n'));
        process.exit(1);
      }

      const config = resolveConfig(opts);
      const publicClient = getPublicClient(config);

      console.log(chalk.bold('\n  AEGIS — Status Query\n'));

      // Auditor status
      if (opts.auditor) {
        const commitment = opts.auditor as Hex;
        const spinner = ora('Fetching auditor reputation...').start();

        const [score, totalStake, attestationCount] = (await publicClient.readContract({
          address: config.registryAddress,
          abi: REGISTRY_ABI,
          functionName: 'getAuditorReputation',
          args: [commitment],
        })) as [bigint, bigint, bigint];

        if (totalStake === 0n && attestationCount === 0n) {
          spinner.warn(chalk.yellow('Auditor not found or not registered'));
        } else {
          spinner.succeed('Auditor found');
          console.log(`\n  ${chalk.bold('Auditor Reputation')}`);
          console.log(`  ──────────────────────────────`);
          console.log(`  Commitment:     ${truncateHex(commitment)}`);
          console.log(`  Reputation:     ${score.toString()}`);
          console.log(`  Total stake:    ${fmtEth(totalStake)}`);
          console.log(`  Attestations:   ${attestationCount.toString()}`);
        }
      }

      // Skill status
      if (opts.skill) {
        const skillHash = opts.skill as Hex;
        const spinner = ora('Fetching skill attestations...').start();

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

        const metadataURI = (await publicClient.readContract({
          address: config.registryAddress,
          abi: REGISTRY_ABI,
          functionName: 'metadataURIs',
          args: [skillHash],
        })) as string;

        if (!attestations || attestations.length === 0) {
          spinner.warn(chalk.yellow('No attestations found for this skill'));
        } else {
          spinner.succeed(`Found ${attestations.length} attestation(s)`);
          console.log(`\n  ${chalk.bold('Skill Status')}`);
          console.log(`  ──────────────────────────────`);
          console.log(`  Skill hash:   ${truncateHex(skillHash)}`);
          if (metadataURI) {
            console.log(`  Metadata:     ${metadataURI}`);
          }
          console.log('');

          for (let i = 0; i < attestations.length; i++) {
            const att = attestations[i];
            console.log(`  ${chalk.bold(`Attestation #${i}`)}`);
            console.log(`    Auditor:      ${truncateHex(att.auditorCommitment)}`);
            console.log(`    Level:        ${fmtAuditLevel(att.auditLevel)}`);
            console.log(`    Stake:        ${fmtEth(att.stakeAmount)}`);
            console.log(`    Timestamp:    ${fmtTimestamp(att.timestamp)}`);
            console.log(`    Proof size:   ${(att.zkProof.length - 2) / 2} bytes`);
            console.log('');
          }
        }
      }
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });
