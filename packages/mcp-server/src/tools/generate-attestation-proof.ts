import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { handleToolCall, serializeResult } from '../lib/serialization.js';

/**
 * MCP tool to generate a ZK attestation proof.
 *
 * Bridges the gap between audit analysis and on-chain submission.
 * Uses the SDK's generateAttestationViaCLI() which shells out to nargo + bb.
 *
 * Flow: register-auditor → browse-unaudited → check-skill → **generate-attestation-proof** → audit-skill
 */
export function registerGenerateAttestationProof(server: McpServer): void {
  server.tool(
    'generate-attestation-proof',
    `Generate a ZK attestation proof for submitting an audit on-chain. This is the missing step between auditing a skill and calling aegis_audit_skill.

IMPORTANT: This tool requires nargo and bb CLI tools to be installed:
  - nargo 1.0.0-beta.18 (install: curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash && noirup -v 1.0.0-beta.18)
  - bb (Barretenberg backend, installed alongside nargo)

On Windows, these must be available in WSL (Ubuntu).

Returns the proof hex and publicInputs array needed by aegis_audit_skill.`,
    {
      skillHash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The bytes32 skill hash being audited'),
      criteriaHash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('Pedersen hash of the sorted audit criteria IDs'),
      auditLevel: z
        .number()
        .int()
        .min(1)
        .max(3)
        .describe('Audit level: 1=Functional, 2=Robust, 3=Security'),
      auditorCommitment: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .describe('The auditor Pedersen commitment (must match on-chain registration)'),
      auditorPrivateKey: z
        .string()
        .describe('The auditor private key field element (used to derive the commitment). This is the Noir circuit input, NOT your Ethereum private key.'),
      sourceCode: z
        .array(z.string())
        .optional()
        .describe('Source code field elements (64 fields). Defaults to array of "1"s for metadata-only audits.'),
      auditResults: z
        .array(z.string())
        .optional()
        .describe('Audit result field elements (32 fields). Defaults to array of "1"s for passing audits.'),
      circuitsDir: z
        .string()
        .optional()
        .describe('Path to the circuits package directory containing Nargo.toml. Defaults to CIRCUITS_DIR env var or "../circuits".'),
    },
    async (params) => {
      return handleToolCall(async () => {
        const sdk = await import('@aegisaudit/sdk');

        const circuitsDir = params.circuitsDir
          ?? process.env.CIRCUITS_DIR
          ?? '../circuits';

        const sourceCode = params.sourceCode ?? Array(64).fill('1');
        const auditResults = params.auditResults ?? Array(32).fill('1');

        // Build Prover.toml
        const proverToml = sdk.buildProverToml({
          sourceCode,
          auditResults,
          auditorPrivateKey: params.auditorPrivateKey,
          skillHash: params.skillHash,
          criteriaHash: params.criteriaHash,
          auditLevel: params.auditLevel,
          auditorCommitment: params.auditorCommitment,
        });

        // Generate proof via CLI (nargo + bb)
        const result = await sdk.generateAttestationViaCLI({
          circuitsDir,
          proverToml,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                success: true,
                proof: result.proof,
                publicInputs: result.publicInputs,
                publicInputCount: result.publicInputs.length,
                circuitsDir,
                note: 'Proof generated successfully. Pass proof and publicInputs to aegis_audit_skill to submit on-chain.',
              }),
            },
          ],
        };
      });
    },
  );
}
