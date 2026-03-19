// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IAegisRegistry} from "./interfaces/IAegisRegistry.sol";
import {IVerifier} from "./interfaces/IVerifier.sol";
import {AegisErrors} from "./libraries/AegisErrors.sol";

/// @title AegisRegistry
/// @notice On-chain registry for ZK-verified AI skill attestations
/// @dev Delegates proof verification to an external UltraPlonk verifier contract
contract AegisRegistry is IAegisRegistry {
    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    struct AuditorInfo {
        uint256 totalStake;
        uint256 reputationScore;
        uint256 attestationCount;
        bool registered;
    }

    /// @notice The ZK proof verifier contract
    IVerifier public immutable verifier;

    /// @notice Protocol admin (for dispute resolution; upgradeable to DAO later)
    address public owner;

    /// @notice Minimum stake required to register as an auditor
    uint256 public constant MIN_AUDITOR_STAKE = 0.01 ether;

    /// @notice Minimum bond required to open a dispute
    uint256 public constant MIN_DISPUTE_BOND = 0.005 ether;

    /// @notice Skill registration fee
    uint256 public constant REGISTRATION_FEE = 0.001 ether;

    /// @notice Cooldown period before unstaked ETH can be withdrawn
    uint256 public constant UNSTAKE_COOLDOWN = 3 days;

    /// @notice Protocol fee taken from staking operations (5% = 500 basis points)
    uint256 public constant PROTOCOL_FEE_BPS = 500;

    /// @notice Minimum bounty amount
    uint256 public constant MIN_BOUNTY = 0.001 ether;

    /// @notice Bounty expiration period (30 days)
    uint256 public constant BOUNTY_EXPIRATION = 30 days;

    /// @notice Accumulated protocol revenue available for owner withdrawal
    uint256 public protocolBalance;

    /// @notice skillHash → attestations
    mapping(bytes32 => Attestation[]) private _attestations;

    /// @notice auditorCommitment → auditor info
    mapping(bytes32 => AuditorInfo) private _auditors;

    /// @notice disputeId → dispute
    mapping(uint256 => Dispute) private _disputes;

    /// @notice Counter for dispute IDs
    uint256 private _nextDisputeId;

    /// @notice skillHash → metadataURI
    mapping(bytes32 => string) public metadataURIs;

    /// @notice auditorCommitment → pending unstake request
    mapping(bytes32 => UnstakeRequest) private _unstakeRequests;

    /// @notice auditorCommitment → number of active (unresolved) disputes
    mapping(bytes32 => uint256) private _activeDisputeCount;

    /// @notice skillHash → bounty
    mapping(bytes32 => Bounty) private _bounties;

    /// @notice skillHash → skill listing (for unaudited skills awaiting audit)
    mapping(bytes32 => SkillListing) private _skillListings;

    /// @notice skillHash → attestationIndex → revoked
    mapping(bytes32 => mapping(uint256 => bool)) private _revokedAttestations;

    /// @notice Addresses exempt from listing / registration fees
    mapping(address => bool) public feeExempt;

    /// @notice Listing fee (same as registration fee) — required to prevent spam
    uint256 public constant LISTING_FEE = 0.001 ether;

    /// @notice Referral reward: 50% of fee to referrer (5000 basis points)
    uint256 public constant REFERRAL_BPS = 5000;

    /// @notice Fixed referral reward for fee-exempt registrations (funded from protocolBalance)
    uint256 public constant REFERRAL_FIXED_REWARD = 0.0005 ether;

    /// @notice Accumulated referral earnings per address (pull-pattern withdrawal)
    mapping(address => uint256) public referralEarnings;

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor(address _verifier) {
        verifier = IVerifier(_verifier);
        owner = msg.sender;
    }

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert AegisErrors.Unauthorized();
        _;
    }

    // ──────────────────────────────────────────────
    //  Skill Listing (no audit required)
    // ──────────────────────────────────────────────

    /// @inheritdoc IAegisRegistry
    function listSkill(bytes32 skillHash, string calldata metadataURI, address referrer) external payable {
        if (skillHash == bytes32(0)) revert AegisErrors.InvalidSkillHash();
        if (bytes(metadataURI).length == 0) revert AegisErrors.EmptyMetadata();
        if (!feeExempt[msg.sender] && msg.value < LISTING_FEE) revert AegisErrors.InsufficientListingFee();
        if (_skillListings[skillHash].listed) revert AegisErrors.SkillAlreadyListed();
        if (referrer == msg.sender) revert AegisErrors.SelfReferral();

        _processReferralFee(msg.value, referrer, msg.sender, skillHash);

        _skillListings[skillHash] = SkillListing({
            publisher: msg.sender,
            metadataURI: metadataURI,
            timestamp: block.timestamp,
            listed: true
        });

        // Also store in metadataURIs for unified metadata lookups
        metadataURIs[skillHash] = metadataURI;

        emit SkillListed(skillHash, msg.sender, metadataURI);
    }

    /// @inheritdoc IAegisRegistry
    function getSkillListing(bytes32 skillHash) external view returns (SkillListing memory) {
        return _skillListings[skillHash];
    }

    // ──────────────────────────────────────────────
    //  Publisher Actions
    // ──────────────────────────────────────────────

    /// @inheritdoc IAegisRegistry
    function registerSkill(
        bytes32 skillHash,
        string calldata metadataURI,
        bytes calldata attestationProof,
        bytes32[] calldata publicInputs,
        bytes32 auditorCommitment,
        uint8 auditLevel,
        address bountyRecipient,
        address referrer
    ) external payable {
        if (!feeExempt[msg.sender] && msg.value < REGISTRATION_FEE) revert AegisErrors.InsufficientFee();
        if (auditLevel < 1 || auditLevel > 3) revert AegisErrors.InvalidAuditLevel();
        if (!_auditors[auditorCommitment].registered) revert AegisErrors.AuditorNotRegistered();
        if (referrer == msg.sender) revert AegisErrors.SelfReferral();

        _processReferralFee(msg.value, referrer, msg.sender, skillHash);
        _storeAttestation(skillHash, metadataURI, attestationProof, publicInputs, auditorCommitment, auditLevel);
        _processBountyPayout(skillHash, auditLevel, bountyRecipient);

        emit SkillRegistered(skillHash, auditLevel, auditorCommitment);
    }

    // ──────────────────────────────────────────────
    //  Auditor Actions
    // ──────────────────────────────────────────────

    /// @inheritdoc IAegisRegistry
    function registerAuditor(bytes32 auditorCommitment) external payable {
        if (_auditors[auditorCommitment].registered) revert AegisErrors.AuditorAlreadyRegistered();

        uint256 fee = (msg.value * PROTOCOL_FEE_BPS) / 10_000;
        uint256 stakeAmount = msg.value - fee;
        if (stakeAmount < MIN_AUDITOR_STAKE) revert AegisErrors.InsufficientStake();

        protocolBalance += fee;

        _auditors[auditorCommitment] = AuditorInfo({
            totalStake: stakeAmount,
            reputationScore: 0,
            attestationCount: 0,
            registered: true
        });

        emit AuditorRegistered(auditorCommitment, stakeAmount);
    }

    /// @inheritdoc IAegisRegistry
    function addStake(bytes32 auditorCommitment) external payable {
        if (!_auditors[auditorCommitment].registered) revert AegisErrors.AuditorNotRegistered();
        if (msg.value == 0) revert AegisErrors.InsufficientStake();

        uint256 fee = (msg.value * PROTOCOL_FEE_BPS) / 10_000;
        uint256 stakeAmount = msg.value - fee;

        protocolBalance += fee;
        _auditors[auditorCommitment].totalStake += stakeAmount;

        emit StakeAdded(auditorCommitment, stakeAmount, _auditors[auditorCommitment].totalStake);
    }

    // ──────────────────────────────────────────────
    //  Consumer Queries
    // ──────────────────────────────────────────────

    /// @inheritdoc IAegisRegistry
    function getAttestations(bytes32 skillHash) external view returns (Attestation[] memory) {
        return _attestations[skillHash];
    }

    /// @inheritdoc IAegisRegistry
    function verifyAttestation(bytes32 skillHash, uint256 attestationIndex) external returns (bool valid) {
        Attestation[] storage attestations = _attestations[skillHash];
        if (attestationIndex >= attestations.length) revert AegisErrors.AttestationNotFound();

        Attestation storage att = attestations[attestationIndex];

        // Reconstruct public inputs from stored attestation data
        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = att.skillHash;
        publicInputs[1] = att.auditCriteriaHash;
        publicInputs[2] = bytes32(uint256(att.auditLevel));
        publicInputs[3] = att.auditorCommitment;

        return verifier.verify(att.zkProof, publicInputs);
    }

    /// @inheritdoc IAegisRegistry
    function getAuditorReputation(bytes32 auditorCommitment)
        external
        view
        returns (uint256 score, uint256 totalStake, uint256 attestationCount)
    {
        AuditorInfo storage info = _auditors[auditorCommitment];
        return (info.reputationScore, info.totalStake, info.attestationCount);
    }

    // ──────────────────────────────────────────────
    //  Dispute Actions
    // ──────────────────────────────────────────────

    /// @inheritdoc IAegisRegistry
    function openDispute(bytes32 skillHash, uint256 attestationIndex, bytes calldata evidence) external payable {
        if (msg.value < MIN_DISPUTE_BOND) revert AegisErrors.InsufficientDisputeBond();
        if (attestationIndex >= _attestations[skillHash].length) revert AegisErrors.AttestationNotFound();

        uint256 disputeId = _nextDisputeId++;

        _disputes[disputeId] = Dispute({
            skillHash: skillHash,
            attestationIndex: attestationIndex,
            evidence: evidence,
            challenger: msg.sender,
            bond: msg.value,
            resolved: false,
            auditorFault: false
        });

        // Track active disputes per auditor (for unstake blocking)
        bytes32 auditorCommitment = _attestations[skillHash][attestationIndex].auditorCommitment;
        _activeDisputeCount[auditorCommitment]++;

        emit DisputeOpened(disputeId, skillHash);
    }

    /// @inheritdoc IAegisRegistry
    function resolveDispute(uint256 disputeId, bool auditorFault) external onlyOwner {
        Dispute storage dispute = _disputes[disputeId];
        if (dispute.resolved) revert AegisErrors.DisputeAlreadyResolved();

        dispute.resolved = true;
        dispute.auditorFault = auditorFault;

        // Decrement active dispute count for the auditor
        bytes32 disputeAuditor = _attestations[dispute.skillHash][dispute.attestationIndex].auditorCommitment;
        if (_activeDisputeCount[disputeAuditor] > 0) {
            _activeDisputeCount[disputeAuditor]--;
        }

        if (auditorFault) {
            // Slash the auditor's stake
            Attestation storage att = _attestations[dispute.skillHash][dispute.attestationIndex];
            bytes32 auditorCommitment = att.auditorCommitment;
            AuditorInfo storage auditor = _auditors[auditorCommitment];

            // Decrease reputation
            if (auditor.reputationScore > 0) {
                auditor.reputationScore--;
            }

            // Slash half the stake, send to challenger as reward
            uint256 slashAmount = auditor.totalStake / 2;
            if (slashAmount > 0) {
                auditor.totalStake -= slashAmount;
                (bool sent,) = dispute.challenger.call{value: slashAmount + dispute.bond}("");
                require(sent, "Transfer failed");
            }
        } else {
            // Auditor not at fault — dispute bond is forfeited to protocol treasury
            protocolBalance += dispute.bond;
        }

        emit DisputeResolved(disputeId, auditorFault);
    }

    /// @inheritdoc IAegisRegistry
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
        )
    {
        if (disputeId >= _nextDisputeId) revert AegisErrors.DisputeNotFound();
        Dispute storage d = _disputes[disputeId];
        return (d.skillHash, d.attestationIndex, d.evidence, d.challenger, d.bond, d.resolved, d.auditorFault);
    }

    /// @inheritdoc IAegisRegistry
    function getActiveDisputeCount(bytes32 auditorCommitment) external view returns (uint256 count) {
        return _activeDisputeCount[auditorCommitment];
    }

    /// @inheritdoc IAegisRegistry
    function getDisputeCount() external view returns (uint256 count) {
        return _nextDisputeId;
    }

    // ──────────────────────────────────────────────
    //  Revocation Actions
    // ──────────────────────────────────────────────

    /// @inheritdoc IAegisRegistry
    function revokeAttestation(bytes32 skillHash, uint256 attestationIndex) external onlyOwner {
        if (attestationIndex >= _attestations[skillHash].length) revert AegisErrors.AttestationNotFound();
        if (_revokedAttestations[skillHash][attestationIndex]) revert AegisErrors.AlreadyRevoked();

        _revokedAttestations[skillHash][attestationIndex] = true;

        bytes32 auditorCommitment = _attestations[skillHash][attestationIndex].auditorCommitment;
        emit AttestationRevoked(skillHash, attestationIndex, auditorCommitment);
    }

    /// @inheritdoc IAegisRegistry
    function isAttestationRevoked(bytes32 skillHash, uint256 attestationIndex) external view returns (bool revoked) {
        return _revokedAttestations[skillHash][attestationIndex];
    }

    // ──────────────────────────────────────────────
    //  Unstaking Actions
    // ──────────────────────────────────────────────

    /// @inheritdoc IAegisRegistry
    function initiateUnstake(bytes32 auditorCommitment, uint256 amount) external {
        AuditorInfo storage auditor = _auditors[auditorCommitment];
        if (!auditor.registered) revert AegisErrors.AuditorNotRegistered();
        if (amount == 0 || amount > auditor.totalStake) revert AegisErrors.InvalidUnstakeAmount();
        if (_activeDisputeCount[auditorCommitment] > 0) revert AegisErrors.ActiveDisputesExist();
        if (_unstakeRequests[auditorCommitment].amount > 0) revert AegisErrors.UnstakeAlreadyPending();

        // Partial unstake must leave at least MIN_AUDITOR_STAKE, unless it's a full withdrawal
        uint256 remaining = auditor.totalStake - amount;
        if (remaining > 0 && remaining < MIN_AUDITOR_STAKE) revert AegisErrors.InvalidUnstakeAmount();

        uint256 unlockTimestamp = block.timestamp + UNSTAKE_COOLDOWN;
        _unstakeRequests[auditorCommitment] = UnstakeRequest({
            amount: amount,
            unlockTimestamp: unlockTimestamp
        });

        emit UnstakeInitiated(auditorCommitment, amount, unlockTimestamp);
    }

    /// @inheritdoc IAegisRegistry
    function completeUnstake(bytes32 auditorCommitment) external {
        UnstakeRequest storage request = _unstakeRequests[auditorCommitment];
        if (request.amount == 0) revert AegisErrors.NoActiveUnstakeRequest();
        if (block.timestamp < request.unlockTimestamp) revert AegisErrors.UnstakeCooldownNotMet();
        if (_activeDisputeCount[auditorCommitment] > 0) revert AegisErrors.ActiveDisputesExist();

        AuditorInfo storage auditor = _auditors[auditorCommitment];
        uint256 amount = request.amount;

        // Clear the request before transfer (reentrancy protection)
        delete _unstakeRequests[auditorCommitment];

        // Update stake
        auditor.totalStake -= amount;

        // Full withdrawal deregisters the auditor
        if (auditor.totalStake == 0) {
            auditor.registered = false;
        }

        // Transfer ETH
        (bool sent,) = msg.sender.call{value: amount}("");
        if (!sent) revert AegisErrors.UnstakeTransferFailed();

        emit UnstakeCompleted(auditorCommitment, amount);
    }

    /// @inheritdoc IAegisRegistry
    function cancelUnstake(bytes32 auditorCommitment) external {
        UnstakeRequest storage request = _unstakeRequests[auditorCommitment];
        if (request.amount == 0) revert AegisErrors.NoActiveUnstakeRequest();

        uint256 amount = request.amount;
        delete _unstakeRequests[auditorCommitment];

        emit UnstakeCancelled(auditorCommitment, amount);
    }

    /// @inheritdoc IAegisRegistry
    function getUnstakeRequest(bytes32 auditorCommitment) external view returns (UnstakeRequest memory) {
        return _unstakeRequests[auditorCommitment];
    }

    // ──────────────────────────────────────────────
    //  Bounty Actions
    // ──────────────────────────────────────────────

    /// @inheritdoc IAegisRegistry
    function postBounty(bytes32 skillHash, uint8 requiredLevel) external payable {
        if (msg.value < MIN_BOUNTY) revert AegisErrors.InsufficientBounty();
        if (requiredLevel < 1 || requiredLevel > 3) revert AegisErrors.InvalidAuditLevel();
        if (_bounties[skillHash].amount > 0 && !_bounties[skillHash].claimed) revert AegisErrors.BountyAlreadyExists();

        uint256 expiresAt = block.timestamp + BOUNTY_EXPIRATION;

        _bounties[skillHash] = Bounty({
            publisher: msg.sender,
            amount: msg.value,
            requiredLevel: requiredLevel,
            expiresAt: expiresAt,
            claimed: false
        });

        emit BountyPosted(skillHash, msg.value, requiredLevel, expiresAt);
    }

    /// @inheritdoc IAegisRegistry
    function reclaimBounty(bytes32 skillHash) external {
        Bounty storage bounty = _bounties[skillHash];
        if (bounty.amount == 0) revert AegisErrors.BountyNotFound();
        if (bounty.claimed) revert AegisErrors.BountyAlreadyClaimed();
        if (block.timestamp < bounty.expiresAt) revert AegisErrors.BountyNotExpired();
        if (msg.sender != bounty.publisher) revert AegisErrors.NotBountyPublisher();

        uint256 amount = bounty.amount;
        address publisher = bounty.publisher;

        // Clear bounty before transfer (reentrancy protection)
        delete _bounties[skillHash];

        (bool sent,) = publisher.call{value: amount}("");
        if (!sent) revert AegisErrors.BountyTransferFailed();

        emit BountyReclaimed(skillHash, publisher, amount);
    }

    /// @inheritdoc IAegisRegistry
    function getBounty(bytes32 skillHash) external view returns (Bounty memory) {
        return _bounties[skillHash];
    }

    // ──────────────────────────────────────────────
    //  Referral Actions
    // ──────────────────────────────────────────────

    /// @inheritdoc IAegisRegistry
    function withdrawReferralEarnings() external {
        uint256 amount = referralEarnings[msg.sender];
        if (amount == 0) revert AegisErrors.NoReferralEarnings();
        referralEarnings[msg.sender] = 0;
        (bool sent,) = msg.sender.call{value: amount}("");
        require(sent, "Transfer failed");
        emit ReferralWithdrawn(msg.sender, amount);
    }

    /// @inheritdoc IAegisRegistry
    function getReferralEarnings(address account) external view returns (uint256 earnings) {
        return referralEarnings[account];
    }

    /// @dev Store attestation and update auditor stats (extracted to reduce stack depth)
    function _storeAttestation(
        bytes32 skillHash,
        string calldata metadataURI,
        bytes calldata attestationProof,
        bytes32[] calldata publicInputs,
        bytes32 auditorCommitment,
        uint8 auditLevel
    ) internal {
        // Verify the ZK proof on-chain
        bool valid = verifier.verify(attestationProof, publicInputs);
        if (!valid) revert AegisErrors.InvalidProof();

        // Store the attestation
        _attestations[skillHash].push(
            Attestation({
                skillHash: skillHash,
                auditCriteriaHash: publicInputs.length > 1 ? publicInputs[1] : bytes32(0),
                zkProof: attestationProof,
                auditorCommitment: auditorCommitment,
                stakeAmount: _auditors[auditorCommitment].totalStake,
                timestamp: block.timestamp,
                auditLevel: auditLevel
            })
        );

        // Update auditor stats
        _auditors[auditorCommitment].attestationCount++;
        _auditors[auditorCommitment].reputationScore++;

        // Store metadata URI (overwrites if skill already has one)
        if (bytes(metadataURI).length > 0) {
            metadataURIs[skillHash] = metadataURI;
        }
    }

    /// @dev Process bounty payout if applicable (extracted to reduce stack depth)
    function _processBountyPayout(bytes32 skillHash, uint8 auditLevel, address bountyRecipient) internal {
        Bounty storage bounty = _bounties[skillHash];
        if (bounty.amount > 0 && !bounty.claimed && bountyRecipient != address(0)) {
            if (auditLevel >= bounty.requiredLevel) {
                bounty.claimed = true;

                uint256 protocolCut = (bounty.amount * PROTOCOL_FEE_BPS) / 10_000;
                uint256 auditorPayout = bounty.amount - protocolCut;
                protocolBalance += protocolCut;

                (bool sent,) = bountyRecipient.call{value: auditorPayout}("");
                if (!sent) revert AegisErrors.BountyTransferFailed();

                emit BountyClaimed(skillHash, bountyRecipient, auditorPayout, protocolCut);
            }
        }
    }

    /// @dev Process fee splitting for referrals. Handles three cases:
    ///   1. No referrer → all to protocolBalance
    ///   2. Fee-paying registration with referrer → 50% to referrer, 50% to protocol
    ///   3. Fee-exempt registration with referrer → fixed reward from protocolBalance
    function _processReferralFee(
        uint256 valueSent,
        address referrer,
        address referee,
        bytes32 skillHash
    ) internal {
        if (referrer == address(0)) {
            // No referrer — all to protocol (backward-compatible)
            if (valueSent > 0) protocolBalance += valueSent;
        } else if (valueSent > 0) {
            // Fee-paying registration — split between referrer and protocol
            uint256 referralAmount = (valueSent * REFERRAL_BPS) / 10_000;
            protocolBalance += valueSent - referralAmount;
            referralEarnings[referrer] += referralAmount;
            emit ReferralReward(referrer, referee, skillHash, referralAmount);
        } else {
            // Fee-exempt registration — fund referral from protocol balance
            if (protocolBalance >= REFERRAL_FIXED_REWARD) {
                protocolBalance -= REFERRAL_FIXED_REWARD;
                referralEarnings[referrer] += REFERRAL_FIXED_REWARD;
                emit ReferralReward(referrer, referee, skillHash, REFERRAL_FIXED_REWARD);
            }
            // If insufficient protocolBalance, silently skip (don't revert)
        }
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    /// @notice Withdraw accumulated protocol revenue (fees, forfeited bonds)
    function withdrawProtocolBalance(address to) external onlyOwner {
        uint256 amount = protocolBalance;
        if (amount == 0) revert AegisErrors.InsufficientFee();
        protocolBalance = 0;
        (bool sent,) = to.call{value: amount}("");
        require(sent, "Transfer failed");
    }

    /// @notice Set fee exemption for an address (e.g. protocol bots)
    function setFeeExempt(address account, bool exempt) external onlyOwner {
        feeExempt[account] = exempt;
    }

    /// @notice Transfer ownership (for future DAO migration)
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
}
