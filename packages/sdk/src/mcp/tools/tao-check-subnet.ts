import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { computeTaoSubnetHash, computeTaoMinerHash } from '../../tao.js';
import { serializeResult, handleToolCall } from '../lib/serialization.js';
import { querySubgraph } from '../lib/subgraph.js';

const CHECK_SKILL_QUERY = `
  query CheckSkill($id: String!) {
    skill(id: $id) {
      id
      skillName
      category
      metadataURI
      publisher
      attestationCount
      listed
      timestamp
      attestations(orderBy: timestamp, orderDirection: desc) {
        id
        auditor { id }
        auditLevel
        revoked
        timestamp
        txHash
      }
      disputes(orderBy: timestamp, orderDirection: desc) {
        id
        challenger
        bond
        resolved
        auditorFault
        timestamp
      }
    }
  }
`;

interface CheckSkillResult {
  skill: {
    id: string;
    skillName: string;
    category: string;
    metadataURI: string;
    publisher: string;
    attestationCount: number;
    listed: boolean;
    timestamp: string;
    attestations: Array<{
      id: string;
      auditor: { id: string };
      auditLevel: number;
      revoked: boolean;
      timestamp: string;
      txHash: string;
    }>;
    disputes: Array<{
      id: string;
      challenger: string;
      bond: string;
      resolved: boolean;
      auditorFault: boolean;
      timestamp: string;
    }>;
  } | null;
}

export function registerTaoCheckSubnet(server: McpServer): void {
  server.tool(
    'aegis_tao_check_subnet',
    'Check AEGIS attestations for a Bittensor subnet or specific miner. Computes the skill hash from the netuid (and optional hotkey), then queries the AEGIS subgraph for existing attestations and disputes.',
    {
      netuid: z
        .number()
        .int()
        .min(0)
        .describe('Bittensor subnet ID'),
      hotkey: z
        .string()
        .optional()
        .describe('Optional SS58-encoded miner hotkey. If provided, checks the specific miner instead of the whole subnet.'),
    },
    async ({ netuid, hotkey }) => {
      return handleToolCall(async () => {
        const skillHash = hotkey
          ? computeTaoMinerHash(netuid, hotkey)
          : computeTaoSubnetHash(netuid);

        const data = await querySubgraph<CheckSkillResult>(
          CHECK_SKILL_QUERY,
          { id: skillHash.toLowerCase() },
        );

        if (!data.skill) {
          return {
            content: [
              {
                type: 'text' as const,
                text: serializeResult({
                  found: false,
                  netuid,
                  hotkey: hotkey ?? null,
                  skillHash,
                  message: hotkey
                    ? `No AEGIS attestations found for miner ${hotkey} on SN${netuid}. This miner is unaudited — submit an attestation with aegis_audit_skill using skillHash ${skillHash}.`
                    : `No AEGIS attestations found for subnet ${netuid}. This subnet is unaudited.`,
                }),
              },
            ],
          };
        }

        const activeDisputes = data.skill.disputes.filter((d) => !d.resolved);
        const validAttestations = data.skill.attestations.filter((a) => !a.revoked);
        const highestLevel = validAttestations.reduce(
          (max, a) => Math.max(max, a.auditLevel),
          0,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: serializeResult({
                found: true,
                netuid,
                hotkey: hotkey ?? null,
                skillHash,
                skillName: data.skill.skillName,
                attestationCount: data.skill.attestationCount,
                highestAuditLevel: highestLevel,
                hasActiveDisputes: activeDisputes.length > 0,
                attestations: validAttestations.map((a) => ({
                  auditor: a.auditor.id,
                  auditLevel: a.auditLevel,
                  timestamp: a.timestamp,
                  txHash: a.txHash,
                })),
                disputes: activeDisputes.map((d) => ({
                  challenger: d.challenger,
                  bond: d.bond,
                  timestamp: d.timestamp,
                })),
              }),
            },
          ],
        };
      });
    },
  );
}
