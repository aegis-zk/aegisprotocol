import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient, hasWallet } from '../lib/client.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';
import { querySubgraph } from '../lib/subgraph.js';

const SKILL_CONTEXT_QUERY = `
  query SkillContext($id: Bytes!) {
    skill(id: $id) {
      id
      skillName
      category
      metadataURI
      publisher
      listed
      attestationCount
      attestations(where: { revoked: false }, orderBy: timestamp, orderDirection: desc) {
        id
        auditLevel
        auditor { id }
      }
      disputes(where: { resolved: false }) {
        id
        disputeId
      }
      bounty {
        id
        amount
        requiredLevel
        expiresAt
        claimed
        reclaimed
      }
    }
  }
`;

interface SkillContextResult {
  skill: {
    id: string;
    skillName: string;
    category: string;
    metadataURI: string;
    publisher: string;
    listed: boolean;
    attestationCount: number;
    attestations: Array<{
      id: string;
      auditLevel: number;
      auditor: { id: string };
    }>;
    disputes: Array<{
      id: string;
      disputeId: string;
    }>;
    bounty: Array<{
      id: string;
      amount: string;
      requiredLevel: number;
      expiresAt: string;
      claimed: boolean;
      reclaimed: boolean;
    }>;
  } | null;
}

export function registerAuditSkill(server: McpServer): void {
  server.tool(
    'aegis_audit_skill',
    `Two-phase audit tool: (1) reads the current skill state from the subgraph — existing attestations, open disputes, and bounty info — then (2) submits an on-chain registerSkill transaction via the SDK. Requires AEGIS_PRIVATE_KEY to be set. The auditor must already be registered on-chain via register-auditor.

IMPORTANT: The attestationProof must be an UltraHonk proof generated with keccak: true (for EVM verification). Required toolchain:
  - nargo 1.0.0-beta.18 (Noir compiler)
  - @aztec/bb.js@3.0.0-nightly.20260102 (Barretenberg backend)
Other versions of bb.js may produce incompatible proofs. Use generate-attestation-proof to create the proof.`,
    {
      skillHash: z
        .string()
        .describe('The bytes32 skill hash to audit (0x-prefixed, 66 chars)'),
      metadataURI: z
        .string()
        .optional()
        .default('')
        .describe('Metadata URI for the attestation (IPFS URI, HTTP URL, or data URI). Empty string if none.'),
      attestationProof: z
        .string()
        .describe('UltraHonk ZK proof bytes (0x-prefixed hex string)'),
      publicInputs: z
        .array(z.string())
        .describe('Public inputs array: [skillHash, criteriaHash, auditLevelHex, auditorCommitment] — all 0x-prefixed bytes32'),
      auditorCommitment: z
        .string()
        .describe('The auditor Pedersen commitment (bytes32, 0x-prefixed). Must be registered on-chain first.'),
      auditLevel: z
        .number()
        .int()
        .min(1)
        .max(3)
        .describe('Audit tier level: 1 = L1 Functional, 2 = L2 Robust, 3 = L3 Security'),
      bountyRecipient: z
        .string()
        .optional()
        .describe('Address to receive bounty payout if one exists for this skill (defaults to 0x0 to skip)'),
    },
    async ({ skillHash, metadataURI, attestationProof, publicInputs, auditorCommitment, auditLevel, bountyRecipient }) => {
      return handleToolCall(async () => {
        // Phase 1: Read skill state from subgraph
        const ctx = await querySubgraph<SkillContextResult>(
          SKILL_CONTEXT_QUERY,
          { id: skillHash },
        );

        const skillContext = ctx.skill
          ? {
              skillName: ctx.skill.skillName,
              category: ctx.skill.category,
              listed: ctx.skill.listed,
              existingAttestations: ctx.skill.attestationCount,
              openDisputes: ctx.skill.disputes.length,
              activeBounty: ctx.skill.bounty.find(
                (b) => !b.claimed && !b.reclaimed,
              ) ?? null,
            }
          : null;

        // Phase 2: Submit on-chain transaction
        if (!hasWallet()) {
          return {
            content: [
              {
                type: 'text' as const,
                text: serializeResult({
                  error: 'No wallet configured',
                  hint: 'Set AEGIS_PRIVATE_KEY environment variable to enable write operations.',
                  skillContext,
                }),
              },
            ],
          };
        }

        const client = getClient();
        const txHash = await client.registerSkill({
          skillHash: skillHash as `0x${string}`,
          metadataURI: metadataURI ?? '',
          attestationProof: attestationProof as `0x${string}`,
          publicInputs: publicInputs as `0x${string}`[],
          auditorCommitment: auditorCommitment as `0x${string}`,
          auditLevel: auditLevel as 1 | 2 | 3,
          bountyRecipient: bountyRecipient
            ? (bountyRecipient as `0x${string}`)
            : undefined,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                success: true,
                txHash,
                skillContext,
                hint: 'Transaction submitted. Wait for confirmation, then the subgraph will index the new attestation within ~30 seconds.',
              }),
            },
          ],
        };
      });
    },
  );
}
