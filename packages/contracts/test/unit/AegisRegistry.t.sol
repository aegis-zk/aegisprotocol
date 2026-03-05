// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test, console2} from "forge-std/Test.sol";
import {AegisRegistry} from "../../src/AegisRegistry.sol";
import {IAegisRegistry} from "../../src/interfaces/IAegisRegistry.sol";
import {MockVerifier} from "../../src/mocks/MockVerifier.sol";
import {AegisErrors} from "../../src/libraries/AegisErrors.sol";

contract AegisRegistryTest is Test {
    AegisRegistry public registry;
    MockVerifier public verifier;

    address public deployer = address(this);
    address public publisher = makeAddr("publisher");
    address public auditor = makeAddr("auditor");
    address public consumer = makeAddr("consumer");
    address public challenger = makeAddr("challenger");

    bytes32 public auditorCommitment = keccak256(abi.encodePacked("auditor_secret"));
    bytes32 public skillHash = keccak256(abi.encodePacked("my_awesome_skill_v1"));
    bytes public fakeProof = hex"deadbeef";

    /// @dev Compute net stake after 5% protocol fee
    function _netStake(uint256 value) internal pure returns (uint256) {
        return value - (value * 500) / 10_000;
    }

    function setUp() public {
        verifier = new MockVerifier();
        registry = new AegisRegistry(address(verifier));

        // Fund test accounts
        vm.deal(publisher, 10 ether);
        vm.deal(auditor, 10 ether);
        vm.deal(challenger, 10 ether);
    }

    // ──────────────────────────────────────────────
    //  Auditor Registration
    // ──────────────────────────────────────────────

    function test_registerAuditor() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        (uint256 score, uint256 totalStake, uint256 attestationCount) =
            registry.getAuditorReputation(auditorCommitment);

        assertEq(score, 0);
        assertEq(totalStake, _netStake(0.02 ether)); // 0.019 ETH after 5% fee
        assertEq(attestationCount, 0);
    }

    function test_registerAuditor_revertInsufficientStake() public {
        // 0.01 ETH → net 0.0095 ETH → below minimum 0.01
        vm.prank(auditor);
        vm.expectRevert(AegisErrors.InsufficientStake.selector);
        registry.registerAuditor{value: 0.01 ether}(auditorCommitment);
    }

    function test_registerAuditor_revertAlreadyRegistered() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        vm.prank(auditor);
        vm.expectRevert(AegisErrors.AuditorAlreadyRegistered.selector);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);
    }

    function test_addStake() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        vm.prank(auditor);
        registry.addStake{value: 0.05 ether}(auditorCommitment);

        (, uint256 totalStake,) = registry.getAuditorReputation(auditorCommitment);
        assertEq(totalStake, _netStake(0.02 ether) + _netStake(0.05 ether));
    }

    function test_protocolFee() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 1 ether}(auditorCommitment);

        // 5% of 1 ETH = 0.05 ETH fee
        assertEq(registry.protocolBalance(), 0.05 ether);

        vm.prank(auditor);
        registry.addStake{value: 1 ether}(auditorCommitment);

        // Another 0.05 ETH fee
        assertEq(registry.protocolBalance(), 0.1 ether);
    }

    function test_withdrawProtocolBalance() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 1 ether}(auditorCommitment);

        uint256 balanceBefore = address(this).balance;
        registry.withdrawProtocolBalance(address(this));
        uint256 balanceAfter = address(this).balance;

        assertEq(balanceAfter - balanceBefore, 0.05 ether);
        assertEq(registry.protocolBalance(), 0);
    }

    function test_withdrawProtocolBalance_revertUnauthorized() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 1 ether}(auditorCommitment);

        vm.prank(auditor);
        vm.expectRevert(AegisErrors.Unauthorized.selector);
        registry.withdrawProtocolBalance(auditor);
    }

    function test_withdrawProtocolBalance_revertEmpty() public {
        vm.expectRevert(AegisErrors.InsufficientFee.selector);
        registry.withdrawProtocolBalance(address(this));
    }

    function test_addStake_revertNotRegistered() public {
        vm.prank(auditor);
        vm.expectRevert(AegisErrors.AuditorNotRegistered.selector);
        registry.addStake{value: 0.05 ether}(auditorCommitment);
    }

    // ──────────────────────────────────────────────
    //  Skill Registration
    // ──────────────────────────────────────────────

    function _registerAuditorAndSkill() internal {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(1));
        publicInputs[3] = auditorCommitment;

        vm.prank(publisher);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, address(0)
        );
    }

    function test_registerSkill() public {
        _registerAuditorAndSkill();

        IAegisRegistry.Attestation[] memory attestations = registry.getAttestations(skillHash);
        assertEq(attestations.length, 1);
        assertEq(attestations[0].skillHash, skillHash);
        assertEq(attestations[0].auditLevel, 1);
        assertEq(attestations[0].auditorCommitment, auditorCommitment);
    }

    function test_registerSkill_updatesAuditorReputation() public {
        _registerAuditorAndSkill();

        (uint256 score,, uint256 attestationCount) = registry.getAuditorReputation(auditorCommitment);
        assertEq(score, 1);
        assertEq(attestationCount, 1);
    }

    function test_registerSkill_revertInvalidProof() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        // Make verifier reject proofs
        verifier.setShouldVerify(false);

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(1));
        publicInputs[3] = auditorCommitment;

        vm.prank(publisher);
        vm.expectRevert(AegisErrors.InvalidProof.selector);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, address(0)
        );
    }

    function test_registerSkill_revertInvalidAuditLevel() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        bytes32[] memory publicInputs = new bytes32[](4);

        vm.prank(publisher);
        vm.expectRevert(AegisErrors.InvalidAuditLevel.selector);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "", fakeProof, publicInputs, auditorCommitment, 0, address(0)
        );
    }

    function test_registerSkill_revertInsufficientFee() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        bytes32[] memory publicInputs = new bytes32[](4);

        vm.prank(publisher);
        vm.expectRevert(AegisErrors.InsufficientFee.selector);
        registry.registerSkill{value: 0}(skillHash, "", fakeProof, publicInputs, auditorCommitment, 1, address(0));
    }

    function test_registerSkill_revertAuditorNotRegistered() public {
        bytes32[] memory publicInputs = new bytes32[](4);
        bytes32 unknownCommitment = keccak256("unknown");

        vm.prank(publisher);
        vm.expectRevert(AegisErrors.AuditorNotRegistered.selector);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "", fakeProof, publicInputs, unknownCommitment, 1, address(0)
        );
    }

    // ──────────────────────────────────────────────
    //  Verification
    // ──────────────────────────────────────────────

    function test_verifyAttestation() public {
        _registerAuditorAndSkill();

        bool valid = registry.verifyAttestation(skillHash, 0);
        assertTrue(valid);
    }

    function test_verifyAttestation_revertNotFound() public {
        vm.expectRevert(AegisErrors.AttestationNotFound.selector);
        registry.verifyAttestation(skillHash, 0);
    }

    // ──────────────────────────────────────────────
    //  Disputes
    // ──────────────────────────────────────────────

    function test_openDispute() public {
        _registerAuditorAndSkill();

        vm.prank(challenger);
        registry.openDispute{value: 0.005 ether}(skillHash, 0, "malicious code found");
    }

    function test_openDispute_revertInsufficientBond() public {
        _registerAuditorAndSkill();

        vm.prank(challenger);
        vm.expectRevert(AegisErrors.InsufficientDisputeBond.selector);
        registry.openDispute{value: 0.001 ether}(skillHash, 0, "evidence");
    }

    function test_resolveDispute_auditorFault() public {
        _registerAuditorAndSkill();

        vm.prank(challenger);
        registry.openDispute{value: 0.005 ether}(skillHash, 0, "malicious code found");

        uint256 challengerBalanceBefore = challenger.balance;

        // Owner resolves in favor of challenger
        registry.resolveDispute(0, true);

        // Challenger receives slashed stake + their bond back
        uint256 challengerBalanceAfter = challenger.balance;
        assertGt(challengerBalanceAfter, challengerBalanceBefore);

        // Auditor reputation decreased
        (uint256 score,,) = registry.getAuditorReputation(auditorCommitment);
        assertEq(score, 0);
    }

    function test_resolveDispute_auditorNotAtFault() public {
        _registerAuditorAndSkill();

        vm.prank(challenger);
        registry.openDispute{value: 0.005 ether}(skillHash, 0, "false accusation");

        // Owner resolves in favor of auditor
        registry.resolveDispute(0, false);

        // Auditor reputation unchanged
        (uint256 score,,) = registry.getAuditorReputation(auditorCommitment);
        assertEq(score, 1);
    }

    function test_resolveDispute_revertAlreadyResolved() public {
        _registerAuditorAndSkill();

        vm.prank(challenger);
        registry.openDispute{value: 0.005 ether}(skillHash, 0, "evidence");

        registry.resolveDispute(0, false);

        vm.expectRevert(AegisErrors.DisputeAlreadyResolved.selector);
        registry.resolveDispute(0, true);
    }

    function test_resolveDispute_revertUnauthorized() public {
        _registerAuditorAndSkill();

        vm.prank(challenger);
        registry.openDispute{value: 0.005 ether}(skillHash, 0, "evidence");

        vm.prank(challenger);
        vm.expectRevert(AegisErrors.Unauthorized.selector);
        registry.resolveDispute(0, true);
    }

    // ──────────────────────────────────────────────
    //  Metadata
    // ──────────────────────────────────────────────

    function test_metadataURI_stored() public {
        _registerAuditorAndSkill();

        string memory uri = registry.metadataURIs(skillHash);
        assertEq(uri, "ipfs://QmSkillMetadata");
    }

    // ──────────────────────────────────────────────
    //  Unstaking
    // ──────────────────────────────────────────────

    function test_initiateUnstake_partial() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.1 ether}(auditorCommitment);

        registry.initiateUnstake(auditorCommitment, 0.05 ether);

        IAegisRegistry.UnstakeRequest memory req = registry.getUnstakeRequest(auditorCommitment);
        assertEq(req.amount, 0.05 ether);
        assertGt(req.unlockTimestamp, block.timestamp);
    }

    function test_initiateUnstake_full() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        uint256 netStake = _netStake(0.02 ether);
        registry.initiateUnstake(auditorCommitment, netStake);

        IAegisRegistry.UnstakeRequest memory req = registry.getUnstakeRequest(auditorCommitment);
        assertEq(req.amount, netStake);
    }

    function test_initiateUnstake_revertInvalidAmount_zero() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.1 ether}(auditorCommitment);

        vm.expectRevert(AegisErrors.InvalidUnstakeAmount.selector);
        registry.initiateUnstake(auditorCommitment, 0);
    }

    function test_initiateUnstake_revertInvalidAmount_exceedsStake() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.1 ether}(auditorCommitment);

        vm.expectRevert(AegisErrors.InvalidUnstakeAmount.selector);
        registry.initiateUnstake(auditorCommitment, 1 ether);
    }

    function test_initiateUnstake_revertInvalidAmount_belowMinRemaining() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.04 ether}(auditorCommitment);

        // Net stake = 0.038 ETH. Trying to unstake 0.03 → remaining 0.008 < 0.01 min
        vm.expectRevert(AegisErrors.InvalidUnstakeAmount.selector);
        registry.initiateUnstake(auditorCommitment, 0.03 ether);
    }

    function test_initiateUnstake_revertAlreadyPending() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.1 ether}(auditorCommitment);

        registry.initiateUnstake(auditorCommitment, 0.05 ether);

        vm.expectRevert(AegisErrors.UnstakeAlreadyPending.selector);
        registry.initiateUnstake(auditorCommitment, 0.01 ether);
    }

    function test_initiateUnstake_revertActiveDisputes() public {
        _registerAuditorAndSkill();

        // Open a dispute
        vm.prank(challenger);
        registry.openDispute{value: 0.005 ether}(skillHash, 0, "evidence");

        // Auditor tries to unstake while dispute is active
        vm.expectRevert(AegisErrors.ActiveDisputesExist.selector);
        registry.initiateUnstake(auditorCommitment, 0.005 ether);
    }

    function test_completeUnstake_partial() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.1 ether}(auditorCommitment);

        uint256 netStake = _netStake(0.1 ether); // 0.095 ETH
        registry.initiateUnstake(auditorCommitment, 0.05 ether);

        // Warp past cooldown
        vm.warp(block.timestamp + 3 days + 1);

        uint256 balanceBefore = address(this).balance;
        registry.completeUnstake(auditorCommitment);
        uint256 balanceAfter = address(this).balance;

        assertEq(balanceAfter - balanceBefore, 0.05 ether);

        (, uint256 totalStake,) = registry.getAuditorReputation(auditorCommitment);
        assertEq(totalStake, netStake - 0.05 ether); // 0.045 ETH remaining
    }

    function test_completeUnstake_fullDeregisters() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        uint256 netStake = _netStake(0.02 ether);
        registry.initiateUnstake(auditorCommitment, netStake);
        vm.warp(block.timestamp + 3 days + 1);

        registry.completeUnstake(auditorCommitment);

        // Auditor should be deregistered — addStake should revert
        vm.prank(auditor);
        vm.expectRevert(AegisErrors.AuditorNotRegistered.selector);
        registry.addStake{value: 0.02 ether}(auditorCommitment);
    }

    function test_completeUnstake_revertCooldownNotMet() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.1 ether}(auditorCommitment);

        registry.initiateUnstake(auditorCommitment, 0.05 ether);

        // Try to complete before cooldown
        vm.expectRevert(AegisErrors.UnstakeCooldownNotMet.selector);
        registry.completeUnstake(auditorCommitment);
    }

    function test_completeUnstake_revertNoRequest() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.1 ether}(auditorCommitment);

        vm.expectRevert(AegisErrors.NoActiveUnstakeRequest.selector);
        registry.completeUnstake(auditorCommitment);
    }

    function test_completeUnstake_revertDisputeOpenedDuringCooldown() public {
        _registerAuditorAndSkill();

        // Add extra stake so partial unstake is valid
        vm.prank(auditor);
        registry.addStake{value: 0.09 ether}(auditorCommitment);

        // Initiate unstake
        registry.initiateUnstake(auditorCommitment, 0.05 ether);

        // Dispute opened during cooldown
        vm.prank(challenger);
        registry.openDispute{value: 0.005 ether}(skillHash, 0, "found issue");

        // Warp past cooldown
        vm.warp(block.timestamp + 3 days + 1);

        // Should still be blocked by active dispute
        vm.expectRevert(AegisErrors.ActiveDisputesExist.selector);
        registry.completeUnstake(auditorCommitment);
    }

    function test_cancelUnstake() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.1 ether}(auditorCommitment);

        registry.initiateUnstake(auditorCommitment, 0.05 ether);
        registry.cancelUnstake(auditorCommitment);

        IAegisRegistry.UnstakeRequest memory req = registry.getUnstakeRequest(auditorCommitment);
        assertEq(req.amount, 0);

        // Can initiate a new one after cancelling
        registry.initiateUnstake(auditorCommitment, 0.03 ether);
        req = registry.getUnstakeRequest(auditorCommitment);
        assertEq(req.amount, 0.03 ether);
    }

    function test_cancelUnstake_revertNoRequest() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.1 ether}(auditorCommitment);

        vm.expectRevert(AegisErrors.NoActiveUnstakeRequest.selector);
        registry.cancelUnstake(auditorCommitment);
    }

    function test_unstakeAfterDisputeResolved() public {
        _registerAuditorAndSkill();

        vm.prank(auditor);
        registry.addStake{value: 0.09 ether}(auditorCommitment);

        uint256 totalNet = _netStake(0.02 ether) + _netStake(0.09 ether);

        // Open and resolve dispute (not at fault)
        vm.prank(challenger);
        registry.openDispute{value: 0.005 ether}(skillHash, 0, "evidence");
        registry.resolveDispute(0, false);

        // Should now be able to unstake
        registry.initiateUnstake(auditorCommitment, 0.05 ether);
        vm.warp(block.timestamp + 3 days + 1);
        registry.completeUnstake(auditorCommitment);

        (, uint256 totalStake,) = registry.getAuditorReputation(auditorCommitment);
        assertEq(totalStake, totalNet - 0.05 ether);
    }

    // ──────────────────────────────────────────────
    //  Bounties — Posting
    // ──────────────────────────────────────────────

    function test_postBounty() public {
        vm.prank(publisher);
        registry.postBounty{value: 0.05 ether}(skillHash, 2);

        IAegisRegistry.Bounty memory b = registry.getBounty(skillHash);
        assertEq(b.publisher, publisher);
        assertEq(b.amount, 0.05 ether);
        assertEq(b.requiredLevel, 2);
        assertFalse(b.claimed);
        assertGt(b.expiresAt, block.timestamp);
    }

    function test_postBounty_revertInsufficientBounty() public {
        vm.prank(publisher);
        vm.expectRevert(AegisErrors.InsufficientBounty.selector);
        registry.postBounty{value: 0.0005 ether}(skillHash, 1);
    }

    function test_postBounty_revertInvalidLevel() public {
        vm.prank(publisher);
        vm.expectRevert(AegisErrors.InvalidAuditLevel.selector);
        registry.postBounty{value: 0.01 ether}(skillHash, 0);
    }

    function test_postBounty_revertInvalidLevelTooHigh() public {
        vm.prank(publisher);
        vm.expectRevert(AegisErrors.InvalidAuditLevel.selector);
        registry.postBounty{value: 0.01 ether}(skillHash, 4);
    }

    function test_postBounty_revertDuplicate() public {
        vm.prank(publisher);
        registry.postBounty{value: 0.01 ether}(skillHash, 1);

        vm.prank(publisher);
        vm.expectRevert(AegisErrors.BountyAlreadyExists.selector);
        registry.postBounty{value: 0.01 ether}(skillHash, 2);
    }

    // ──────────────────────────────────────────────
    //  Bounties — Claiming via registerSkill
    // ──────────────────────────────────────────────

    function test_bounty_claimedOnRegisterSkill() public {
        // Post a bounty for L1 audit
        vm.prank(publisher);
        registry.postBounty{value: 0.1 ether}(skillHash, 1);

        // Register auditor
        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(1));
        publicInputs[3] = auditorCommitment;

        address bountyRecipient = makeAddr("bountyRecipient");
        uint256 recipientBalBefore = bountyRecipient.balance;

        // Register skill with bountyRecipient
        vm.prank(publisher);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, bountyRecipient
        );

        // Bounty should be claimed
        IAegisRegistry.Bounty memory b = registry.getBounty(skillHash);
        assertTrue(b.claimed);

        // Recipient receives bounty minus 5% protocol fee
        uint256 expectedPayout = 0.1 ether - (0.1 ether * 500) / 10_000; // 0.095 ETH
        assertEq(bountyRecipient.balance - recipientBalBefore, expectedPayout);
    }

    function test_bounty_protocolFeeAccumulates() public {
        vm.prank(publisher);
        registry.postBounty{value: 0.1 ether}(skillHash, 1);

        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        // Protocol balance from auditor registration fee
        uint256 protocolBefore = registry.protocolBalance();

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(1));
        publicInputs[3] = auditorCommitment;

        address bountyRecipient = makeAddr("bountyRecipient");
        vm.prank(publisher);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, bountyRecipient
        );

        // Protocol gained: 0.001 ETH reg fee + 5% of 0.1 ETH bounty = 0.001 + 0.005 = 0.006 ETH
        uint256 protocolAfter = registry.protocolBalance();
        uint256 protocolGain = protocolAfter - protocolBefore;
        assertEq(protocolGain, 0.001 ether + (0.1 ether * 500) / 10_000);
    }

    function test_bounty_levelExceeds_stillPays() public {
        // Bounty requires L2, auditor submits L3 — should still pay
        vm.prank(publisher);
        registry.postBounty{value: 0.05 ether}(skillHash, 2);

        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(3));
        publicInputs[3] = auditorCommitment;

        address bountyRecipient = makeAddr("bountyRecipient");
        vm.prank(publisher);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 3, bountyRecipient
        );

        IAegisRegistry.Bounty memory b = registry.getBounty(skillHash);
        assertTrue(b.claimed);
        assertGt(bountyRecipient.balance, 0);
    }

    function test_bounty_levelMismatch_noPayout() public {
        // Bounty requires L3, auditor submits L1 — should NOT pay
        vm.prank(publisher);
        registry.postBounty{value: 0.05 ether}(skillHash, 3);

        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(1));
        publicInputs[3] = auditorCommitment;

        address bountyRecipient = makeAddr("bountyRecipient");
        vm.prank(publisher);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, bountyRecipient
        );

        // Bounty NOT claimed (level too low)
        IAegisRegistry.Bounty memory b = registry.getBounty(skillHash);
        assertFalse(b.claimed);
        assertEq(bountyRecipient.balance, 0);
    }

    function test_bounty_noRecipient_noPayout() public {
        // Bounty exists but bountyRecipient is address(0) — should skip
        vm.prank(publisher);
        registry.postBounty{value: 0.05 ether}(skillHash, 1);

        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(1));
        publicInputs[3] = auditorCommitment;

        vm.prank(publisher);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, address(0)
        );

        // Bounty should NOT be claimed when recipient is address(0)
        IAegisRegistry.Bounty memory b = registry.getBounty(skillHash);
        assertFalse(b.claimed);
    }

    function test_bounty_noBounty_registerSkillStillWorks() public {
        // No bounty posted — registerSkill should work fine
        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(1));
        publicInputs[3] = auditorCommitment;

        address bountyRecipient = makeAddr("bountyRecipient");
        vm.prank(publisher);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, bountyRecipient
        );

        // Skill should be registered normally
        IAegisRegistry.Attestation[] memory attestations = registry.getAttestations(skillHash);
        assertEq(attestations.length, 1);
    }

    // ──────────────────────────────────────────────
    //  Bounties — Reclaiming
    // ──────────────────────────────────────────────

    function test_reclaimBounty() public {
        vm.prank(publisher);
        registry.postBounty{value: 0.05 ether}(skillHash, 2);

        // Warp past expiration (30 days)
        vm.warp(block.timestamp + 30 days + 1);

        uint256 balBefore = publisher.balance;
        vm.prank(publisher);
        registry.reclaimBounty(skillHash);
        uint256 balAfter = publisher.balance;

        // Full refund, no fee
        assertEq(balAfter - balBefore, 0.05 ether);

        // Bounty should be deleted
        IAegisRegistry.Bounty memory b = registry.getBounty(skillHash);
        assertEq(b.amount, 0);
    }

    function test_reclaimBounty_revertNotExpired() public {
        vm.prank(publisher);
        registry.postBounty{value: 0.05 ether}(skillHash, 2);

        vm.prank(publisher);
        vm.expectRevert(AegisErrors.BountyNotExpired.selector);
        registry.reclaimBounty(skillHash);
    }

    function test_reclaimBounty_revertAlreadyClaimed() public {
        // Post bounty and have it claimed
        vm.prank(publisher);
        registry.postBounty{value: 0.05 ether}(skillHash, 1);

        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(1));
        publicInputs[3] = auditorCommitment;

        address bountyRecipient = makeAddr("bountyRecipient");
        vm.prank(publisher);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, bountyRecipient
        );

        // Try to reclaim after it was claimed
        vm.warp(block.timestamp + 30 days + 1);
        vm.prank(publisher);
        vm.expectRevert(AegisErrors.BountyAlreadyClaimed.selector);
        registry.reclaimBounty(skillHash);
    }

    function test_reclaimBounty_revertNotPublisher() public {
        vm.prank(publisher);
        registry.postBounty{value: 0.05 ether}(skillHash, 2);

        vm.warp(block.timestamp + 30 days + 1);

        vm.prank(challenger); // Not the publisher
        vm.expectRevert(AegisErrors.NotBountyPublisher.selector);
        registry.reclaimBounty(skillHash);
    }

    function test_reclaimBounty_revertNotFound() public {
        vm.prank(publisher);
        vm.expectRevert(AegisErrors.BountyNotFound.selector);
        registry.reclaimBounty(skillHash);
    }

    // ──────────────────────────────────────────────
    //  Bounties — Lifecycle & Edge Cases
    // ──────────────────────────────────────────────

    function test_bounty_canRepostAfterClaimed() public {
        // Post bounty, claim it, then post a new one
        vm.prank(publisher);
        registry.postBounty{value: 0.01 ether}(skillHash, 1);

        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(1));
        publicInputs[3] = auditorCommitment;

        address bountyRecipient = makeAddr("bountyRecipient");
        vm.prank(publisher);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, bountyRecipient
        );

        // Bounty claimed — should be able to post a new one
        vm.prank(publisher);
        registry.postBounty{value: 0.02 ether}(skillHash, 2);

        IAegisRegistry.Bounty memory b = registry.getBounty(skillHash);
        assertEq(b.amount, 0.02 ether);
        assertEq(b.requiredLevel, 2);
        assertFalse(b.claimed);
    }

    function test_bounty_fullEthAccounting() public {
        // End-to-end: post bounty → register auditor → register skill w/ bounty claim
        // Verify every ETH flow

        uint256 bountyAmount = 0.1 ether;
        uint256 registrationFee = 0.001 ether;
        uint256 auditorStakeGross = 0.02 ether;

        vm.prank(publisher);
        registry.postBounty{value: bountyAmount}(skillHash, 1);

        vm.prank(auditor);
        registry.registerAuditor{value: auditorStakeGross}(auditorCommitment);

        // Protocol balance so far: auditor registration fee only
        uint256 auditorFee = (auditorStakeGross * 500) / 10_000;
        assertEq(registry.protocolBalance(), auditorFee);

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(1));
        publicInputs[3] = auditorCommitment;

        address bountyRecipient = makeAddr("bountyRecipient");
        uint256 recipientBalBefore = bountyRecipient.balance;

        vm.prank(publisher);
        registry.registerSkill{value: registrationFee}(
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, bountyRecipient
        );

        // Protocol balance: auditorFee + registrationFee + 5% bounty cut
        uint256 bountyCut = (bountyAmount * 500) / 10_000; // 0.005 ETH
        assertEq(registry.protocolBalance(), auditorFee + registrationFee + bountyCut);

        // Recipient receives bounty minus protocol cut
        uint256 expectedPayout = bountyAmount - bountyCut; // 0.095 ETH
        assertEq(bountyRecipient.balance - recipientBalBefore, expectedPayout);

        // Contract balance should hold: auditor net stake + protocol balance
        uint256 expectedContractBalance =
            _netStake(auditorStakeGross) + auditorFee + registrationFee + bountyCut;
        assertEq(address(registry).balance, expectedContractBalance);
    }

    function test_bounty_exactMinimum() public {
        vm.prank(publisher);
        registry.postBounty{value: 0.001 ether}(skillHash, 1);

        IAegisRegistry.Bounty memory b = registry.getBounty(skillHash);
        assertEq(b.amount, 0.001 ether);
    }

    function test_bounty_getBounty_nonexistent() public view {
        IAegisRegistry.Bounty memory b = registry.getBounty(skillHash);
        assertEq(b.amount, 0);
        assertEq(b.publisher, address(0));
    }

    // ──────────────────────────────────────────────
    //  Skill Listing
    // ──────────────────────────────────────────────

    function test_listSkill() public {
        vm.prank(publisher);
        registry.listSkill{value: 0.001 ether}(skillHash, "ipfs://QmSkillMeta");

        IAegisRegistry.SkillListing memory listing = registry.getSkillListing(skillHash);
        assertTrue(listing.listed);
        assertEq(listing.publisher, publisher);
        assertEq(listing.metadataURI, "ipfs://QmSkillMeta");
        assertGt(listing.timestamp, 0);
    }

    function test_listSkill_storesMetadataURI() public {
        vm.prank(publisher);
        registry.listSkill{value: 0.001 ether}(skillHash, "data:application/json;base64,eyJuYW1lIjoiVGVzdCJ9");

        string memory uri = registry.metadataURIs(skillHash);
        assertEq(uri, "data:application/json;base64,eyJuYW1lIjoiVGVzdCJ9");
    }

    function test_listSkill_protocolFeeAccumulates() public {
        uint256 protocolBefore = registry.protocolBalance();

        vm.prank(publisher);
        registry.listSkill{value: 0.001 ether}(skillHash, "ipfs://QmSkillMeta");

        assertEq(registry.protocolBalance() - protocolBefore, 0.001 ether);
    }

    function test_listSkill_emitsEvent() public {
        vm.prank(publisher);
        vm.expectEmit(true, true, false, true);
        emit IAegisRegistry.SkillListed(skillHash, publisher, "ipfs://QmSkillMeta");
        registry.listSkill{value: 0.001 ether}(skillHash, "ipfs://QmSkillMeta");
    }

    function test_listSkill_revertInsufficientFee() public {
        vm.prank(publisher);
        vm.expectRevert(AegisErrors.InsufficientListingFee.selector);
        registry.listSkill{value: 0.0005 ether}(skillHash, "ipfs://QmSkillMeta");
    }

    function test_listSkill_revertZeroFee() public {
        vm.prank(publisher);
        vm.expectRevert(AegisErrors.InsufficientListingFee.selector);
        registry.listSkill{value: 0}(skillHash, "ipfs://QmSkillMeta");
    }

    function test_listSkill_revertEmptyMetadata() public {
        vm.prank(publisher);
        vm.expectRevert(AegisErrors.EmptyMetadata.selector);
        registry.listSkill{value: 0.001 ether}(skillHash, "");
    }

    function test_listSkill_revertZeroSkillHash() public {
        vm.prank(publisher);
        vm.expectRevert(AegisErrors.InvalidSkillHash.selector);
        registry.listSkill{value: 0.001 ether}(bytes32(0), "ipfs://QmSkillMeta");
    }

    function test_listSkill_revertAlreadyListed() public {
        vm.prank(publisher);
        registry.listSkill{value: 0.001 ether}(skillHash, "ipfs://QmSkillMeta");

        vm.prank(publisher);
        vm.expectRevert(AegisErrors.SkillAlreadyListed.selector);
        registry.listSkill{value: 0.001 ether}(skillHash, "ipfs://QmSkillMeta2");
    }

    function test_listSkill_thenRegisterSkill() public {
        // List a skill first (unaudited)
        vm.prank(publisher);
        registry.listSkill{value: 0.001 ether}(skillHash, "ipfs://QmSkillMeta");

        // Then register an auditor and attest it
        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(1));
        publicInputs[3] = auditorCommitment;

        vm.prank(publisher);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "ipfs://QmUpdatedMeta", fakeProof, publicInputs, auditorCommitment, 1, address(0)
        );

        // Both listing and attestation should exist
        IAegisRegistry.SkillListing memory listing = registry.getSkillListing(skillHash);
        assertTrue(listing.listed);

        IAegisRegistry.Attestation[] memory attestations = registry.getAttestations(skillHash);
        assertEq(attestations.length, 1);

        // Metadata should be updated by registerSkill
        string memory uri = registry.metadataURIs(skillHash);
        assertEq(uri, "ipfs://QmUpdatedMeta");
    }

    function test_listSkill_overpayGoesToProtocol() public {
        uint256 protocolBefore = registry.protocolBalance();

        vm.prank(publisher);
        registry.listSkill{value: 0.01 ether}(skillHash, "ipfs://QmSkillMeta");

        // Entire msg.value goes to protocol balance
        assertEq(registry.protocolBalance() - protocolBefore, 0.01 ether);
    }

    function test_getSkillListing_nonexistent() public view {
        IAegisRegistry.SkillListing memory listing = registry.getSkillListing(skillHash);
        assertFalse(listing.listed);
        assertEq(listing.publisher, address(0));
    }

    // ──────────────────────────────────────────────
    //  Dispute Queries
    // ──────────────────────────────────────────────

    function test_getDispute_returnsCorrectData() public {
        _registerAuditorAndSkill();

        vm.prank(challenger);
        registry.openDispute{value: 0.01 ether}(skillHash, 0, "malicious code found");

        (
            bytes32 dSkillHash,
            uint256 dAttestationIndex,
            bytes memory dEvidence,
            address dChallenger,
            uint256 dBond,
            bool dResolved,
            bool dAuditorFault
        ) = registry.getDispute(0);

        assertEq(dSkillHash, skillHash);
        assertEq(dAttestationIndex, 0);
        assertEq(string(dEvidence), "malicious code found");
        assertEq(dChallenger, challenger);
        assertEq(dBond, 0.01 ether);
        assertFalse(dResolved);
        assertFalse(dAuditorFault);
    }

    function test_getDispute_afterResolution() public {
        _registerAuditorAndSkill();

        vm.prank(challenger);
        registry.openDispute{value: 0.005 ether}(skillHash, 0, "evidence");

        registry.resolveDispute(0, true);

        (,,,,, bool dResolved, bool dAuditorFault) = registry.getDispute(0);
        assertTrue(dResolved);
        assertTrue(dAuditorFault);
    }

    function test_getDispute_revertNotFound() public {
        vm.expectRevert(AegisErrors.DisputeNotFound.selector);
        registry.getDispute(0);
    }

    function test_getDispute_revertNotFound_outOfRange() public {
        _registerAuditorAndSkill();

        vm.prank(challenger);
        registry.openDispute{value: 0.005 ether}(skillHash, 0, "evidence");

        // Dispute 0 exists, but 1 does not
        vm.expectRevert(AegisErrors.DisputeNotFound.selector);
        registry.getDispute(1);
    }

    function test_getActiveDisputeCount_incrementsOnOpen() public {
        _registerAuditorAndSkill();

        assertEq(registry.getActiveDisputeCount(auditorCommitment), 0);

        vm.prank(challenger);
        registry.openDispute{value: 0.005 ether}(skillHash, 0, "evidence1");
        assertEq(registry.getActiveDisputeCount(auditorCommitment), 1);

        // Register a second skill to open a second dispute
        bytes32 skillHash2 = keccak256(abi.encodePacked("second_skill"));
        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash2;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(1));
        publicInputs[3] = auditorCommitment;

        vm.prank(publisher);
        registry.registerSkill{value: 0.001 ether}(
            skillHash2, "ipfs://QmSecondSkill", fakeProof, publicInputs, auditorCommitment, 1, address(0)
        );

        vm.prank(challenger);
        registry.openDispute{value: 0.005 ether}(skillHash2, 0, "evidence2");
        assertEq(registry.getActiveDisputeCount(auditorCommitment), 2);
    }

    function test_getActiveDisputeCount_decrementsOnResolve() public {
        _registerAuditorAndSkill();

        vm.prank(challenger);
        registry.openDispute{value: 0.005 ether}(skillHash, 0, "evidence");
        assertEq(registry.getActiveDisputeCount(auditorCommitment), 1);

        registry.resolveDispute(0, false);
        assertEq(registry.getActiveDisputeCount(auditorCommitment), 0);
    }

    function test_getDisputeCount_incrementsOnOpen() public {
        _registerAuditorAndSkill();

        assertEq(registry.getDisputeCount(), 0);

        vm.prank(challenger);
        registry.openDispute{value: 0.005 ether}(skillHash, 0, "evidence1");
        assertEq(registry.getDisputeCount(), 1);

        vm.prank(challenger);
        registry.openDispute{value: 0.005 ether}(skillHash, 0, "evidence2");
        assertEq(registry.getDisputeCount(), 2);
    }

    // ──────────────────────────────────────────────
    //  Attestation Revocation
    // ──────────────────────────────────────────────

    function test_revokeAttestation_success() public {
        _registerAuditorAndSkill();

        registry.revokeAttestation(skillHash, 0);

        assertTrue(registry.isAttestationRevoked(skillHash, 0));
    }

    function test_revokeAttestation_emitsEvent() public {
        _registerAuditorAndSkill();

        vm.expectEmit(true, false, true, true);
        emit IAegisRegistry.AttestationRevoked(skillHash, 0, auditorCommitment);
        registry.revokeAttestation(skillHash, 0);
    }

    function test_revokeAttestation_revertNotOwner() public {
        _registerAuditorAndSkill();

        vm.prank(challenger);
        vm.expectRevert(AegisErrors.Unauthorized.selector);
        registry.revokeAttestation(skillHash, 0);
    }

    function test_revokeAttestation_revertAlreadyRevoked() public {
        _registerAuditorAndSkill();

        registry.revokeAttestation(skillHash, 0);

        vm.expectRevert(AegisErrors.AlreadyRevoked.selector);
        registry.revokeAttestation(skillHash, 0);
    }

    function test_revokeAttestation_revertNoAttestation() public {
        vm.expectRevert(AegisErrors.AttestationNotFound.selector);
        registry.revokeAttestation(skillHash, 0);
    }

    function test_isAttestationRevoked_returnsFalseByDefault() public view {
        assertFalse(registry.isAttestationRevoked(skillHash, 0));
    }

    function test_isAttestationRevoked_returnsTrueAfterRevoke() public {
        _registerAuditorAndSkill();

        assertFalse(registry.isAttestationRevoked(skillHash, 0));
        registry.revokeAttestation(skillHash, 0);
        assertTrue(registry.isAttestationRevoked(skillHash, 0));
    }

    function test_revokeAttestation_doesNotAffectOtherIndices() public {
        _registerAuditorAndSkill();

        // Register a second attestation for the same skill
        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash;
        publicInputs[1] = keccak256("criteria_v2_standard");
        publicInputs[2] = bytes32(uint256(2));
        publicInputs[3] = auditorCommitment;

        vm.prank(publisher);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "ipfs://QmUpdated", fakeProof, publicInputs, auditorCommitment, 2, address(0)
        );

        // Revoke only the first attestation
        registry.revokeAttestation(skillHash, 0);

        assertTrue(registry.isAttestationRevoked(skillHash, 0));
        assertFalse(registry.isAttestationRevoked(skillHash, 1));
    }

    // Allow this contract to receive ETH (for completeUnstake tests)
    receive() external payable {}
}
