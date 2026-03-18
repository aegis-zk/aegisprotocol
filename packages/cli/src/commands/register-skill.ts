import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { type Hex, parseEther } from 'viem';
import { loadProofFromFiles, REGISTRATION_FEE } from '@aegisaudit/sdk';
import { resolveConfig } from '../utils/config.js';
import { getPublicClient, getWalletClient, printWalletInfo } from '../utils/wallet.js';
import { fmtEth, truncateHex } from '../utils/format.js';

export const registerSkillCmd = new Command('register-skill')
  .description('Register a skill with a ZK attestation proof')
  .requiredOption('--proof <path>', 'Path to proof binary file (from bb prove)')
  .requiredOption('--public-inputs <path>', 'Path to public_inputs binary file')
  .requiredOption('--metadata-uri <uri>', 'Metadata URI (e.g. ipfs://Qm...)')
  .requiredOption('-c, --commitment <hex>', 'Auditor commitment hash (bytes32)')
  .option('-l, --level <n>', 'Audit level: 1, 2, or 3', '1')
  .option('--fee <eth>', 'Registration fee in ETH', '0.001')
  .option('-n, --network <network>', 'Network: base', 'base')
  .option('--rpc <url>', 'Custom RPC URL')
  .option('--registry <address>', 'AegisRegistry contract address')
  .option('--private-key <key>', 'Wallet private key (hex)')
  .action(async (opts) => {
    try {
      const config = resolveConfig(opts);
      const publicClient = getPublicClient(config);
      const walletClient = getWalletClient(config);

      console.log(chalk.bold('\n  AEGIS — Register Skill\n'));
      await printWalletInfo(publicClient, walletClient);

      // Load proof from files
      const spinner = ora('Loading proof files...').start();
      const proofResult = await loadProofFromFiles(opts.proof, opts.publicInputs);
      spinner.succeed('Proof loaded');

      const skillHash = proofResult.publicInputs[0] as Hex;
      const auditLevel = parseInt(opts.level, 10);
      const fee = parseEther(opts.fee);

      if (auditLevel < 1 || auditLevel > 3) {
        console.error(chalk.red('\n  Audit level must be 1, 2, or 3'));
        process.exit(1);
      }

      console.log(`\n  Skill hash: ${truncateHex(skillHash)}`);
      console.log(`  Audit level: ${auditLevel}`);
      console.log(`  Metadata: ${opts.metadataUri}`);
      console.log(`  Proof size: ${(proofResult.proof.length - 2) / 2} bytes`);
      console.log(`  Public inputs: ${proofResult.publicInputs.length}`);
      console.log(`  Fee: ${fmtEth(fee)}\n`);

      const txSpinner = ora('Submitting skill registration...').start();

      const txHash = await walletClient.writeContract({
        address: config.registryAddress,
        abi: [
          {
            name: 'registerSkill',
            type: 'function',
            stateMutability: 'payable',
            inputs: [
              { name: 'skillHash', type: 'bytes32' },
              { name: 'metadataURI', type: 'string' },
              { name: 'attestationProof', type: 'bytes' },
              { name: 'publicInputs', type: 'bytes32[]' },
              { name: 'auditorCommitment', type: 'bytes32' },
              { name: 'auditLevel', type: 'uint8' },
            ],
            outputs: [],
          },
        ],
        functionName: 'registerSkill',
        args: [
          skillHash,
          opts.metadataUri,
          proofResult.proof as Hex,
          proofResult.publicInputs as Hex[],
          opts.commitment as Hex,
          auditLevel,
        ],
        value: fee,
      });

      txSpinner.text = 'Waiting for confirmation...';

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status === 'success') {
        txSpinner.succeed(chalk.green('Skill registered successfully!'));
        console.log(`\n  Tx: ${txHash}`);
        console.log(`  Block: ${receipt.blockNumber}`);
        console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
        console.log(`  Skill hash: ${skillHash}\n`);
      } else {
        txSpinner.fail(chalk.red('Transaction reverted'));
        process.exit(1);
      }
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });
