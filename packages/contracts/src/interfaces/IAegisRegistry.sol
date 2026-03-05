// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title IAegisRegistry
/// @notice Interface for the AEGIS skill attestation registry
interface IAegisRegistry {
    // ──────────────────────────────────────────────
    //  Structs
    // ──────────────────────────────────────────────

    struct Attestation {
        bytes32 skillHash;
        bytes32 auditCriteriaHash;
        bytes zkProof;
        bytes32 auditorCommitment;
        uint256 stakeAmount;
        uint256 timestamp;
        uint8 auditLevel;
    }

    struct Dispute {
        bytes32 skillHash;
        uint256 attestationIndex;
        bytes evidence;
        address challenger;
        uint256 bond;
        bool resolved;
        bool auditorFault;
    }

    struct UnstakeRequest {
        uint256 amount;
        uint256 unlockTimestamp;
    }

    struct Bounty {
        address publisher;
        uint256 amount;
        uint8 requiredLevel;
        uint256 expiresAt;
        bool claimed;
    }

    struct SkillListing {
        address publisher;
        string metadataURI;
        uint256 timestamp;
        bool listed;
    }

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event SkillListed(bytes32 indexed skillHash, address indexed publisher, string metadataURI);
    event SkillRegistered(bytes32 indexed skillHash, uint8 auditLevel, bytes32 auditorCommitment);
    event AuditorRegistered(bytes32 indexed auditorCommitment, uint256 stake);
    event StakeAdded(bytes32 indexed auditorCommitment, uint256 amount, uint256 totalStake);
    event DisputeOpened(uint256 indexed disputeId, bytes32 indexed skillHash);
    event DisputeResolved(uint256 indexed disputeId, bool auditorSlashed);
    event UnstakeInitiated(bytes32 indexed auditorCommitment, uint256 amount, uint256 unlockTimestamp);
    event UnstakeCompleted(bytes32 indexed auditorCommitment, uint256 amount);
    event UnstakeCancelled(bytes32 indexed auditorCommitment, uint256 amount);
    event BountyPosted(bytes32 indexed skillHash, uint256 amount, uint8 requiredLevel, uint256 expiresAt);
    event BountyClaimed(bytes32 indexed skillHash, address indexed recipient, uint256 auditorPayout, uint256 protocolFee);
    event BountyReclaimed(bytes32 indexed skillHash, address indexed publisher, uint256 amount);
    event AttestationRevoked(bytes32 indexed skillHash, uint256 attestationIndex, bytes32 indexed auditorCommitment);

    // ──────────────────────────────────────────────
    //  Skill Listing (no audit required)
    // ──────────────────────────────────────────────

    /// @notice List a skill for future auditing (no auditor or ZK proof required)
    /// @param skillHash keccak256 of the skill package source code
    /// @param metadataURI URI pointing to skill metadata JSON (IPFS, HTTP, or data URI). Cannot be empty.
    function listSkill(bytes32 skillHash, string calldata metadataURI) external payable;

    /// @notice Get a skill listing
    /// @param skillHash keccak256 of the skill package
    /// @return The listing info (listed=false if not listed)
    function getSkillListing(bytes32 skillHash) external view returns (SkillListing memory);

    // ──────────────────────────────────────────────
    //  Publisher Actions
    // ──────────────────────────────────────────────

    /// @notice Register a skill with a verified attestation
    /// @param skillHash keccak256 of the skill package
    /// @param metadataURI IPFS URI pointing to skill description
    /// @param attestationProof Serialized ZK proof bytes
    /// @param publicInputs Public inputs for the ZK circuit [skillHash, criteriaHash, auditLevel, auditorCommitment]
    /// @param auditorCommitment Identifies the auditor anonymously
    /// @param auditLevel 1=basic, 2=standard, 3=comprehensive
    /// @param bountyRecipient Address to receive bounty payout (address(0) to skip)
    function registerSkill(
        bytes32 skillHash,
        string calldata metadataURI,
        bytes calldata attestationProof,
        bytes32[] calldata publicInputs,
        bytes32 auditorCommitment,
        uint8 auditLevel,
        address bountyRecipient
    ) external payable;

    // ──────────────────────────────────────────────
    //  Auditor Actions
    // ──────────────────────────────────────────────

    /// @notice Register as an anonymous auditor by staking ETH
    /// @param auditorCommitment hash(auditor_private_key) — unique auditor identifier
    function registerAuditor(bytes32 auditorCommitment) external payable;

    /// @notice Add more stake to an existing auditor commitment
    /// @param auditorCommitment The auditor's commitment identifier
    function addStake(bytes32 auditorCommitment) external payable;

    // ──────────────────────────────────────────────
    //  Consumer Queries
    // ──────────────────────────────────────────────

    /// @notice Get all attestations for a skill
    /// @param skillHash keccak256 of the skill package
    /// @return Array of attestations
    function getAttestations(bytes32 skillHash) external view returns (Attestation[] memory);

    /// @notice Verify a specific attestation's proof on-chain
    /// @param skillHash keccak256 of the skill package
    /// @param attestationIndex Index into the attestation array
    /// @return valid True if the stored proof verifies
    function verifyAttestation(bytes32 skillHash, uint256 attestationIndex) external returns (bool valid);

    /// @notice Get an auditor's reputation data
    /// @param auditorCommitment The auditor's commitment identifier
    /// @return score Reputation score
    /// @return totalStake Total ETH staked
    /// @return attestationCount Number of attestations submitted
    function getAuditorReputation(bytes32 auditorCommitment)
        external
        view
        returns (uint256 score, uint256 totalStake, uint256 attestationCount);

    // ──────────────────────────────────────────────
    //  Dispute Actions
    // ──────────────────────────────────────────────

    /// @notice Open a dispute against a skill attestation
    /// @param skillHash keccak256 of the skill package
    /// @param attestationIndex Index of the contested attestation
    /// @param evidence Encoded evidence supporting the dispute
    function openDispute(bytes32 skillHash, uint256 attestationIndex, bytes calldata evidence) external payable;

    /// @notice Resolve a dispute (admin/governance only)
    /// @param disputeId The dispute identifier
    /// @param auditorFault True if the auditor is at fault (triggers slashing)
    function resolveDispute(uint256 disputeId, bool auditorFault) external;

    /// @notice Get full dispute details by ID
    /// @param disputeId The dispute identifier
    /// @return skillHash The disputed skill
    /// @return attestationIndex The contested attestation index
    /// @return evidence Encoded evidence
    /// @return challenger Address that opened the dispute
    /// @return bond ETH bond posted by challenger
    /// @return resolved Whether the dispute has been resolved
    /// @return auditorFault Whether the auditor was found at fault
    function getDispute(uint256 disputeId)
        external
        view
        returns (
            bytes32 skillHash,
            uint256 attestationIndex,
            bytes memory evidence,
            address challenger,
            uint256 bond,
            bool resolved,
            bool auditorFault
        );

    /// @notice Get the number of active (unresolved) disputes for an auditor
    /// @param auditorCommitment The auditor's commitment identifier
    /// @return count Number of unresolved disputes
    function getActiveDisputeCount(bytes32 auditorCommitment) external view returns (uint256 count);

    /// @notice Get the total number of disputes ever created
    /// @return count Total dispute count
    function getDisputeCount() external view returns (uint256 count);

    // ──────────────────────────────────────────────
    //  Revocation Actions
    // ──────────────────────────────────────────────

    /// @notice Revoke an attestation (admin/governance only)
    /// @param skillHash keccak256 of the skill package
    /// @param attestationIndex Index of the attestation to revoke
    function revokeAttestation(bytes32 skillHash, uint256 attestationIndex) external;

    /// @notice Check if an attestation has been revoked
    /// @param skillHash keccak256 of the skill package
    /// @param attestationIndex Index of the attestation
    /// @return revoked True if the attestation is revoked
    function isAttestationRevoked(bytes32 skillHash, uint256 attestationIndex) external view returns (bool revoked);

    // ──────────────────────────────────────────────
    //  Unstaking Actions
    // ──────────────────────────────────────────────

    /// @notice Initiate an unstake request with a 3-day cooldown
    /// @param auditorCommitment The auditor's commitment identifier
    /// @param amount Amount of ETH to unstake
    function initiateUnstake(bytes32 auditorCommitment, uint256 amount) external;

    /// @notice Complete a pending unstake after the cooldown period
    /// @param auditorCommitment The auditor's commitment identifier
    function completeUnstake(bytes32 auditorCommitment) external;

    /// @notice Cancel a pending unstake request
    /// @param auditorCommitment The auditor's commitment identifier
    function cancelUnstake(bytes32 auditorCommitment) external;

    /// @notice Get a pending unstake request
    /// @param auditorCommitment The auditor's commitment identifier
    /// @return The unstake request (amount=0 if none pending)
    function getUnstakeRequest(bytes32 auditorCommitment) external view returns (UnstakeRequest memory);

    // ──────────────────────────────────────────────
    //  Bounty Actions
    // ──────────────────────────────────────────────

    /// @notice Post a bounty to incentivize auditors for a skill
    /// @param skillHash keccak256 of the skill package
    /// @param requiredLevel Minimum audit level (1-3) to claim the bounty
    function postBounty(bytes32 skillHash, uint8 requiredLevel) external payable;

    /// @notice Reclaim an expired, unclaimed bounty
    /// @param skillHash keccak256 of the skill package
    function reclaimBounty(bytes32 skillHash) external;

    /// @notice Get bounty details for a skill
    /// @param skillHash keccak256 of the skill package
    /// @return The bounty info (amount=0 if none exists)
    function getBounty(bytes32 skillHash) external view returns (Bounty memory);
}
