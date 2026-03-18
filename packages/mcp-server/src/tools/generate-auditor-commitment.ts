import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { handleToolCall, serializeResult } from '../lib/serialization.js';

/**
 * MCP tool to generate an auditor commitment hash.
 *
 * IMPORTANT: The commitment MUST be a Pedersen hash (BN254 field element),
 * NOT a keccak256 hash. Using keccak256 will produce a value that exceeds
 * the BN254 field modulus, causing ZK proof generation to fail silently
 * while the on-chain registration appears to succeed (the contract accepts
 * any bytes32).
 *
 * This tool generates the correct Pedersen commitment from an auditor's
 * private key field element, matching what the Noir circuit expects.
 */
export function registerGenerateAuditorCommitment(server: McpServer): void {
  server.tool(
    'generate-auditor-commitment',
    `Generate a Pedersen commitment hash for auditor registration.

CRITICAL: Auditor commitments MUST be Pedersen hashes (BN254 field elements), NOT keccak256.
Using keccak256 will waste your registration stake because the ZK circuit won't accept it.

This tool computes pedersen_hash([auditorPrivateKey]) which matches the Noir circuit's expectation.
The auditorPrivateKey is a field element (a number), NOT your Ethereum wallet private key.

Flow: generate-auditor-commitment → register-auditor → browse-unaudited → audit skills

Requires nargo CLI to be installed for Pedersen hash computation.`,
    {
      auditorPrivateKey: z
        .string()
        .describe('A secret field element (e.g. "12345" or "67890"). This is your Noir circuit auditor identity — NOT your Ethereum private key. Keep this secret — you need it every time you generate a proof.'),
    },
    async (params) => {
      return handleToolCall(async () => {
        // Use nargo to compute Pedersen hash via a minimal Noir program
        // This ensures the commitment matches exactly what the circuit produces
        const { execSync } = await import('child_process');
        const { writeFileSync, mkdtempSync, rmSync } = await import('fs');
        const { join } = await import('path');
        const { tmpdir } = await import('os');

        const isWindows = process.platform === 'win32';

        // Create a temp directory with a minimal Noir project
        const tempDir = mkdtempSync(join(tmpdir(), 'aegis-commit-'));

        try {
          // Write a minimal Noir project that computes pedersen_hash
          writeFileSync(join(tempDir, 'Nargo.toml'), `[package]
name = "commitment"
type = "bin"
[dependencies]
`);

          const srcDir = join(tempDir, 'src');
          const { mkdirSync } = await import('fs');
          mkdirSync(srcDir, { recursive: true });

          writeFileSync(join(srcDir, 'main.nr'), `
use std::hash::pedersen_hash;
fn main(private_key: Field) -> pub Field {
    pedersen_hash([private_key])
}
`);

          writeFileSync(join(tempDir, 'Prover.toml'), `private_key = "${params.auditorPrivateKey}"\n`);

          // Run nargo execute to compute the output
          const run = (cmd: string): string => {
            if (isWindows) {
              const wslPath = tempDir
                .replace(/\\/g, '/')
                .replace(/^([A-Za-z]):/, (_m: string, d: string) => `/mnt/${d.toLowerCase()}`);
              return execSync(
                `wsl -d Ubuntu -- bash -lc "export PATH=\\$HOME/.nargo/bin:\\$PATH && cd ${wslPath} && ${cmd}"`,
                { encoding: 'utf-8', timeout: 60_000 },
              );
            }
            return execSync(cmd, {
              cwd: tempDir,
              encoding: 'utf-8',
              timeout: 60_000,
              env: {
                ...process.env,
                PATH: `${process.env.HOME}/.nargo/bin:${process.env.PATH}`,
              },
            });
          };

          // nargo execute prints the circuit's public return value to stdout
          const output = run('nargo execute 2>&1');

          // Parse the commitment from stdout (format: "Circuit output: 0x1b90cf...")
          const match = output.match(/0x[0-9a-fA-F]{64}/);

          if (!match) {
            throw new Error('Failed to extract commitment from nargo stdout. Output: ' + output.trim());
          }

          const commitment = match[0];

          return {
            content: [
              {
                type: 'text' as const,
                text: serializeResult({
                  success: true,
                  auditorCommitment: commitment,
                  auditorPrivateKey: params.auditorPrivateKey,
                  hashType: 'Pedersen (BN254)',
                  note: 'Use this commitment with register-auditor. Keep your auditorPrivateKey secret — you need it for every proof generation.',
                  warning: 'DO NOT use keccak256 for commitments — it produces values outside the BN254 field modulus and will make your registration unusable.',
                }),
              },
            ],
          };
        } finally {
          // Cleanup
          try {
            rmSync(tempDir, { recursive: true, force: true });
          } catch {
            // Best effort cleanup
          }
        }
      });
    },
  );
}
