import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Read tools
import { registerAegisInfo } from './aegis-info.js';
import { registerWalletStatus } from './wallet-status.js';
import { registerGetAttestations } from './get-attestations.js';
import { registerVerifyAttestation } from './verify-attestation.js';
import { registerGetAuditorReputation } from './get-auditor-reputation.js';
import { registerGetMetadataURI } from './get-metadata-uri.js';
import { registerListAllSkills } from './list-all-skills.js';
import { registerListAllAuditors } from './list-all-auditors.js';
import { registerListDisputes } from './list-disputes.js';
import { registerListResolvedDisputes } from './list-resolved-disputes.js';

// Write tools
import { registerRegisterAuditor } from './register-auditor.js';
import { registerAddStake } from './add-stake.js';
import { registerOpenDispute } from './open-dispute.js';
import { registerInitiateUnstake } from './initiate-unstake.js';
import { registerCompleteUnstake } from './complete-unstake.js';
import { registerCancelUnstake } from './cancel-unstake.js';
import { registerGetUnstakeRequest } from './get-unstake-request.js';

// Bounty tools
import { registerGetBounty } from './get-bounty.js';
import { registerPostBounty } from './post-bounty.js';
import { registerReclaimBounty } from './reclaim-bounty.js';

// ERC-8004 Integration tools
import { registerRegisterAgent } from './register-agent.js';
import { registerRequestErc8004Validation } from './request-erc8004-validation.js';
import { registerRespondToErc8004Validation } from './respond-to-erc8004-validation.js';
import { registerGetErc8004Validation } from './get-erc8004-validation.js';
import { registerLinkSkillToAgent } from './link-skill-to-agent.js';
import { registerCreateAgentRegistration } from './create-agent-registration.js';

// Dispute & Revocation tools
import { registerGetDispute } from './get-dispute.js';
import { registerGetActiveDisputeCount } from './get-active-dispute-count.js';
import { registerGetDisputeCount } from './get-dispute-count.js';
import { registerIsAttestationRevoked } from './is-attestation-revoked.js';
import { registerGetAuditorProfile } from './get-auditor-profile.js';
import { registerResolveDispute } from './resolve-dispute.js';
import { registerRevokeAttestation } from './revoke-attestation.js';

// Trust Profile tools
import { registerQueryTrustProfile } from './query-trust-profile.js';
import { registerQuerySkillTrust } from './query-skill-trust.js';

// Subgraph-backed discovery & audit tools
import { registerCheckSkill } from './check-skill.js';
import { registerBrowseUnaudited } from './browse-unaudited.js';
import { registerBrowseBounties } from './browse-bounties.js';
import { registerAuditSkill } from './audit-skill.js';

// TAO (Bittensor) discovery tools
import { registerTaoListSubnets } from './tao-list-subnets.js';
import { registerTaoBrowseMiners } from './tao-browse-miners.js';
import { registerTaoCheckSubnet } from './tao-check-subnet.js';

/**
 * Register all AEGIS MCP tools on the given server instance.
 */
export function registerAllTools(server: McpServer): void {
  // Discovery & info
  registerAegisInfo(server);
  registerWalletStatus(server);

  // Read operations
  registerListAllSkills(server);
  registerListAllAuditors(server);
  registerGetAttestations(server);
  registerVerifyAttestation(server);
  registerGetAuditorReputation(server);
  registerGetMetadataURI(server);
  registerListDisputes(server);
  registerListResolvedDisputes(server);

  // Read: disputes, unstaking & bounties
  registerGetDispute(server);
  registerGetActiveDisputeCount(server);
  registerGetDisputeCount(server);
  registerIsAttestationRevoked(server);
  registerGetAuditorProfile(server);
  registerGetUnstakeRequest(server);
  registerGetBounty(server);

  // Write operations (require AEGIS_PRIVATE_KEY)
  registerRegisterAuditor(server);
  registerAddStake(server);
  registerOpenDispute(server);
  registerResolveDispute(server);
  registerRevokeAttestation(server);
  registerInitiateUnstake(server);
  registerCompleteUnstake(server);
  registerCancelUnstake(server);
  registerPostBounty(server);
  registerReclaimBounty(server);

  // ERC-8004 Integration (require AEGIS_PRIVATE_KEY for write ops)
  registerCreateAgentRegistration(server);
  registerGetErc8004Validation(server);
  registerRegisterAgent(server);
  registerRequestErc8004Validation(server);
  registerRespondToErc8004Validation(server);
  registerLinkSkillToAgent(server);

  // Trust Profile queries (direct mode, no x402)
  registerQueryTrustProfile(server);
  registerQuerySkillTrust(server);

  // Subgraph-backed discovery & audit tools
  registerCheckSkill(server);
  registerBrowseUnaudited(server);
  registerBrowseBounties(server);
  registerAuditSkill(server);

  // TAO (Bittensor) subnet discovery
  registerTaoListSubnets(server);
  registerTaoBrowseMiners(server);
  registerTaoCheckSubnet(server);
}
