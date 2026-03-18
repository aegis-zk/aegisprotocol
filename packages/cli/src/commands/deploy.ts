import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { truncateHex } from '../utils/format.js';

/**
 * Minimal deployment command that deploys via forge script.
 * For production, use forge directly. This is a convenience wrapper.
 */
export const deployCmd = new Command('deploy')
  .description('Deploy AEGIS contracts to a network (wraps forge script)')
  .option('-n, --network <network>', 'Network: base', 'base')
  .option('--rpc <url>', 'Custom RPC URL')
  .option('--private-key <key>', 'Deployer private key (hex)')
  .option('--verify', 'Verify contracts on Basescan after deployment')
  .option('--contracts-dir <path>', 'Path to contracts package', './packages/contracts')
  .action(async (opts) => {
    try {
      const { execSync } = await import('child_process');
      const rpc =
        opts.rpc ??
        process.env.AEGIS_RPC_URL ??
        process.env.BASE_RPC_URL ??
        'https://mainnet.base.org';

      const privateKey = opts.privateKey ?? process.env.AEGIS_PRIVATE_KEY;
      if (!privateKey) {
        console.error(
          chalk.red('\n  Private key required. Use --private-key or set AEGIS_PRIVATE_KEY\n'),
        );
        process.exit(1);
      }

      console.log(chalk.bold('\n  AEGIS — Deploy Contracts\n'));
      console.log(`  Network:  ${opts.network ?? 'base'}`);
      console.log(`  RPC:      ${rpc}`);
      console.log(`  Verify:   ${opts.verify ? 'yes' : 'no'}\n`);

      const contractsDir = opts.contractsDir ?? './packages/contracts';

      // Build forge command
      let forgeCmd = `forge script script/Deploy.s.sol:DeployAegis --rpc-url ${rpc} --private-key ${privateKey} --broadcast`;

      if (opts.verify) {
        const etherscanKey = process.env.BASESCAN_API_KEY;
        if (!etherscanKey) {
          console.warn(
            chalk.yellow('  Warning: BASESCAN_API_KEY not set, verification may fail\n'),
          );
        }
        forgeCmd += ' --verify';
        if (etherscanKey) {
          forgeCmd += ` --etherscan-api-key ${etherscanKey}`;
        }
      }

      const spinner = ora('Running forge deployment script...').start();

      try {
        const output = execSync(forgeCmd, {
          cwd: contractsDir,
          encoding: 'utf-8',
          timeout: 300_000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        spinner.succeed(chalk.green('Deployment successful!'));
        console.log('\n' + output);

        // Try to extract deployed addresses from output
        const verifierMatch = output.match(/(HonkVerifier|MockVerifier) deployed at:\s+(0x[a-fA-F0-9]+)/);
        const registryMatch = output.match(/AegisRegistry deployed at:\s+(0x[a-fA-F0-9]+)/);

        if (verifierMatch || registryMatch) {
          console.log(chalk.bold('\n  Deployed Addresses'));
          console.log(`  ──────────────────────────────`);
          if (verifierMatch) console.log(`  Verifier: ${verifierMatch[2]} (${verifierMatch[1]})`);
          if (registryMatch) console.log(`  Registry: ${registryMatch[1]}`);
          console.log(
            `\n  Update your .env:\n  AEGIS_REGISTRY_ADDRESS=${registryMatch?.[1] ?? '0x...'}\n`,
          );
        }
      } catch (err) {
        spinner.fail(chalk.red('Deployment failed'));
        const error = err as { stderr?: string; stdout?: string };
        if (error.stderr) console.error('\n' + error.stderr);
        if (error.stdout) console.log('\n' + error.stdout);
        process.exit(1);
      }
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });
