import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { parseEther, type Hex } from 'viem';
import { MIN_AUDITOR_STAKE } from '@aegisaudit/sdk';
import { resolveConfig } from '../utils/config.js';
import { getPublicClient, getWalletClient, printWalletInfo } from '../utils/wallet.js';
import { fmtEth } from '../utils/format.js';

export const registerAuditorCmd = new Command('register-auditor')
  .description('Register as an anonymous auditor by staking ETH')
  .requiredOption('-c, --commitment <hex>', 'Auditor commitment hash (bytes32)')
  .option('-s, --stake <eth>', 'Stake amount in ETH (min 0.01)', '0.01')
  .option('-n, --network <network>', 'Network: base', 'base')
  .option('--rpc <url>', 'Custom RPC URL')
  .option('--registry <address>', 'AegisRegistry contract address')
  .option('--private-key <key>', 'Wallet private key (hex)')
  .action(async (opts) => {
    try {
      const config = resolveConfig(opts);
      const publicClient = getPublicClient(config);
      const walletClient = getWalletClient(config);

      console.log(chalk.bold('\n  AEGIS — Register Auditor\n'));
      await printWalletInfo(publicClient, walletClient);

      const stakeAmount = parseEther(opts.stake);
      if (stakeAmount < MIN_AUDITOR_STAKE) {
        console.error(chalk.red(`\n  Minimum stake is ${fmtEth(MIN_AUDITOR_STAKE)}`));
        process.exit(1);
      }

      const commitment = opts.commitment as Hex;
      console.log(`  Commitment: ${commitment}`);
      console.log(`  Stake: ${fmtEth(stakeAmount)}`);
      console.log(`  Network: ${opts.network ?? 'base'}\n`);

      const spinner = ora('Submitting registration transaction...').start();

      const txHash = await walletClient.writeContract({
        address: config.registryAddress,
        abi: [
          {
            name: 'registerAuditor',
            type: 'function',
            stateMutability: 'payable',
            inputs: [{ name: 'auditorCommitment', type: 'bytes32' }],
            outputs: [],
          },
        ],
        functionName: 'registerAuditor',
        args: [commitment],
        value: stakeAmount,
      });

      spinner.text = 'Waiting for confirmation...';

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status === 'success') {
        spinner.succeed(chalk.green('Auditor registered successfully!'));
        console.log(`\n  Tx: ${txHash}`);
        console.log(`  Block: ${receipt.blockNumber}`);
        console.log(`  Gas used: ${receipt.gasUsed.toString()}\n`);
      } else {
        spinner.fail(chalk.red('Transaction reverted'));
        process.exit(1);
      }
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });
