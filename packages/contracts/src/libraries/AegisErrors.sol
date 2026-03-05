// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title AegisErrors
/// @notice Custom errors for the AEGIS protocol
library AegisErrors {
    /// @notice ZK proof verification failed
    error InvalidProof();

    /// @notice Auditor stake below minimum requirement
    error InsufficientStake();

    /// @notice Auditor commitment already registered
    error AuditorAlreadyRegistered();

    /// @notice Auditor commitment not found in registry
    error AuditorNotRegistered();

    /// @notice Dispute has already been resolved
    error DisputeAlreadyResolved();

    /// @notice Caller is not authorized for this action
    error Unauthorized();

    /// @notice Invalid audit level (must be 1-3)
    error InvalidAuditLevel();

    /// @notice Dispute bond too low
    error InsufficientDisputeBond();

    /// @notice Attestation index out of bounds
    error AttestationNotFound();

    /// @notice Registration fee not met
    error InsufficientFee();

    /// @notice Unstake amount invalid (zero, exceeds stake, or leaves stake below minimum without full withdrawal)
    error InvalidUnstakeAmount();

    /// @notice Auditor has active (unresolved) disputes — cannot unstake
    error ActiveDisputesExist();

    /// @notice Unstake request already pending for this auditor
    error UnstakeAlreadyPending();

    /// @notice No pending unstake request found
    error NoActiveUnstakeRequest();

    /// @notice Cooldown period has not elapsed yet
    error UnstakeCooldownNotMet();

    /// @notice ETH transfer failed during unstake withdrawal
    error UnstakeTransferFailed();

    /// @notice Bounty amount below minimum (0.001 ETH)
    error InsufficientBounty();

    /// @notice A bounty already exists for this skill hash
    error BountyAlreadyExists();

    /// @notice No bounty found for this skill hash
    error BountyNotFound();

    /// @notice Bounty has already been claimed
    error BountyAlreadyClaimed();

    /// @notice Bounty has not expired yet — cannot reclaim
    error BountyNotExpired();

    /// @notice Only the bounty publisher can reclaim
    error NotBountyPublisher();

    /// @notice ETH transfer to bounty recipient failed
    error BountyTransferFailed();

    /// @notice Skill has already been listed
    error SkillAlreadyListed();

    /// @notice Metadata URI cannot be empty
    error EmptyMetadata();

    /// @notice Skill hash cannot be zero
    error InvalidSkillHash();

    /// @notice Listing fee not met
    error InsufficientListingFee();

    /// @notice Attestation has already been revoked
    error AlreadyRevoked();

    /// @notice Dispute ID does not exist
    error DisputeNotFound();
}
