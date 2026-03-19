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
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, address(0), address(0)
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
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, address(0), address(0)
        );
    }

    function test_registerSkill_revertInvalidAuditLevel() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        bytes32[] memory publicInputs = new bytes32[](4);

        vm.prank(publisher);
        vm.expectRevert(AegisErrors.InvalidAuditLevel.selector);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "", fakeProof, publicInputs, auditorCommitment, 0, address(0), address(0)
        );
    }

    function test_registerSkill_revertInsufficientFee() public {
        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        bytes32[] memory publicInputs = new bytes32[](4);

        vm.prank(publisher);
        vm.expectRevert(AegisErrors.InsufficientFee.selector);
        registry.registerSkill{value: 0}(skillHash, "", fakeProof, publicInputs, auditorCommitment, 1, address(0), address(0));
    }

    function test_registerSkill_revertAuditorNotRegistered() public {
        bytes32[] memory publicInputs = new bytes32[](4);
        bytes32 unknownCommitment = keccak256("unknown");

        vm.prank(publisher);
        vm.expectRevert(AegisErrors.AuditorNotRegistered.selector);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "", fakeProof, publicInputs, unknownCommitment, 1, address(0), address(0)
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
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, bountyRecipient, address(0)
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
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, bountyRecipient, address(0)
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
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 3, bountyRecipient, address(0)
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
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, bountyRecipient, address(0)
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
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, address(0), address(0)
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
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, bountyRecipient, address(0)
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
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, bountyRecipient, address(0)
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
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, bountyRecipient, address(0)
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
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, bountyRecipient, address(0)
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

    // ── Bounty edge cases (A3) ──────────────────────────────

    function test_bounty_feeExemptPublisherStillPaysBountyAmount() public {
        // Fee exemption only skips listing/registration fees, not bounty escrow
        registry.setFeeExempt(publisher, true);

        vm.prank(publisher);
        registry.postBounty{value: 0.1 ether}(skillHash, 2);

        IAegisRegistry.Bounty memory b = registry.getBounty(skillHash);
        assertEq(b.amount, 0.1 ether);
        assertEq(b.publisher, publisher);
        assertEq(b.requiredLevel, 2);
    }

    function test_bounty_feeExemptAuditorClaimsSkippingRegFee() public {
        // Post bounty
        vm.prank(publisher);
        registry.postBounty{value: 0.1 ether}(skillHash, 1);

        // Register auditor
        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        // Make auditor fee-exempt
        registry.setFeeExempt(auditor, true);

        address bountyRecipient = makeAddr("bountyRecipient");
        uint256 recipientBalBefore = bountyRecipient.balance;

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(1));
        publicInputs[3] = auditorCommitment;

        // registerSkill with value: 0 (fee-exempt) — bounty should still pay
        vm.prank(auditor);
        registry.registerSkill{value: 0}(
            skillHash, "ipfs://QmMeta", fakeProof, publicInputs, auditorCommitment, 1, bountyRecipient, address(0)
        );

        // Bounty claimed
        IAegisRegistry.Bounty memory b = registry.getBounty(skillHash);
        assertTrue(b.claimed);

        // Recipient got 95% of bounty
        uint256 expectedPayout = 0.1 ether - (0.1 ether * 500) / 10_000;
        assertEq(bountyRecipient.balance - recipientBalBefore, expectedPayout);
    }

    function test_bounty_multipleBountiesAcrossSkills() public {
        bytes32 skill2 = keccak256(abi.encodePacked("another_skill"));
        bytes32 skill3 = keccak256(abi.encodePacked("third_skill"));

        vm.startPrank(publisher);
        registry.postBounty{value: 0.05 ether}(skillHash, 1);
        registry.postBounty{value: 0.1 ether}(skill2, 2);
        registry.postBounty{value: 0.2 ether}(skill3, 3);
        vm.stopPrank();

        // All three coexist
        assertEq(registry.getBounty(skillHash).amount, 0.05 ether);
        assertEq(registry.getBounty(skill2).amount, 0.1 ether);
        assertEq(registry.getBounty(skill3).amount, 0.2 ether);

        // Claim one by registering skill
        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skill2;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(2));
        publicInputs[3] = auditorCommitment;

        address bountyRecipient = makeAddr("bountyRecipient");

        vm.prank(auditor);
        registry.registerSkill{value: 0.001 ether}(
            skill2, "ipfs://QmMeta", fakeProof, publicInputs, auditorCommitment, 2, bountyRecipient, address(0)
        );

        // skill2 bounty claimed, others untouched
        assertTrue(registry.getBounty(skill2).claimed);
        assertFalse(registry.getBounty(skillHash).claimed);
        assertFalse(registry.getBounty(skill3).claimed);
        assertEq(registry.getBounty(skillHash).amount, 0.05 ether);
        assertEq(registry.getBounty(skill3).amount, 0.2 ether);
    }

    function test_bounty_reclaimWhenDisputeExists() public {
        // Post bounty and register skill (without claiming bounty)
        vm.prank(publisher);
        registry.postBounty{value: 0.05 ether}(skillHash, 2);

        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(1));
        publicInputs[3] = auditorCommitment;

        // Register at L1, bounty requires L2 — no payout
        vm.prank(auditor);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "ipfs://QmMeta", fakeProof, publicInputs, auditorCommitment, 1, makeAddr("recipient"), address(0)
        );

        // Open dispute on the attestation
        vm.prank(challenger);
        registry.openDispute{value: 0.005 ether}(skillHash, 0, "evidence");

        // Warp past expiry and reclaim — should succeed despite active dispute
        vm.warp(block.timestamp + 30 days + 1);

        uint256 publisherBalBefore = publisher.balance;
        vm.prank(publisher);
        registry.reclaimBounty(skillHash);

        assertEq(publisher.balance - publisherBalBefore, 0.05 ether);
    }

    function test_bounty_veryLargeAmount() public {
        vm.deal(publisher, 100 ether);
        vm.prank(publisher);
        registry.postBounty{value: 5 ether}(skillHash, 1);

        IAegisRegistry.Bounty memory b = registry.getBounty(skillHash);
        assertEq(b.amount, 5 ether);

        // Claim it
        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        address bountyRecipient = makeAddr("bountyRecipient");
        uint256 recipientBalBefore = bountyRecipient.balance;

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(1));
        publicInputs[3] = auditorCommitment;

        vm.prank(auditor);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "ipfs://QmMeta", fakeProof, publicInputs, auditorCommitment, 1, bountyRecipient, address(0)
        );

        // Protocol cut: 5 ETH * 500 / 10000 = 0.25 ETH
        uint256 expectedProtocolCut = 0.25 ether;
        uint256 expectedPayout = 5 ether - expectedProtocolCut; // 4.75 ETH

        assertEq(bountyRecipient.balance - recipientBalBefore, expectedPayout);
        // Protocol balance includes: auditor reg fee (5%) + registration fee + bounty cut
        uint256 auditorRegFee = (0.02 ether * 500) / 10_000;
        assertEq(registry.protocolBalance(), auditorRegFee + 0.001 ether + expectedProtocolCut);
    }

    function test_bounty_recipientIsMsgSender() public {
        vm.prank(publisher);
        registry.postBounty{value: 0.1 ether}(skillHash, 1);

        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        uint256 auditorBalBefore = auditor.balance;

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(1));
        publicInputs[3] = auditorCommitment;

        // Auditor sets self as bounty recipient
        vm.prank(auditor);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "ipfs://QmMeta", fakeProof, publicInputs, auditorCommitment, 1, auditor, address(0)
        );

        // Net change: paid 0.001 ETH reg fee, received 0.095 ETH bounty
        uint256 expectedBountyPayout = 0.1 ether - (0.1 ether * 500) / 10_000; // 0.095
        uint256 expectedNetGain = expectedBountyPayout - 0.001 ether; // 0.094
        assertEq(auditor.balance - auditorBalBefore, expectedNetGain);
    }

    function test_bounty_canRepostAfterReclaim() public {
        // Post bounty
        vm.prank(publisher);
        registry.postBounty{value: 0.05 ether}(skillHash, 1);

        // Warp past expiry and reclaim
        vm.warp(block.timestamp + 30 days + 1);
        vm.prank(publisher);
        registry.reclaimBounty(skillHash);

        // Bounty should be deleted
        assertEq(registry.getBounty(skillHash).amount, 0);

        // Repost on the same skill hash — should succeed
        vm.prank(publisher);
        registry.postBounty{value: 0.08 ether}(skillHash, 2);

        IAegisRegistry.Bounty memory b = registry.getBounty(skillHash);
        assertEq(b.amount, 0.08 ether);
        assertEq(b.requiredLevel, 2);
        assertFalse(b.claimed);
    }

    function test_bounty_postOnUnlistedSkill() public {
        // Use a skill hash that was never listed via listSkill
        bytes32 unlistedSkill = keccak256(abi.encodePacked("never_listed_skill"));

        vm.prank(publisher);
        registry.postBounty{value: 0.05 ether}(unlistedSkill, 1);

        IAegisRegistry.Bounty memory b = registry.getBounty(unlistedSkill);
        assertEq(b.amount, 0.05 ether);
        assertEq(b.publisher, publisher);
        assertEq(b.requiredLevel, 1);
    }

    // ──────────────────────────────────────────────
    //  Skill Listing
    // ──────────────────────────────────────────────

    function test_listSkill() public {
        vm.prank(publisher);
        registry.listSkill{value: 0.001 ether}(skillHash, "ipfs://QmSkillMeta", address(0));

        IAegisRegistry.SkillListing memory listing = registry.getSkillListing(skillHash);
        assertTrue(listing.listed);
        assertEq(listing.publisher, publisher);
        assertEq(listing.metadataURI, "ipfs://QmSkillMeta");
        assertGt(listing.timestamp, 0);
    }

    function test_listSkill_storesMetadataURI() public {
        vm.prank(publisher);
        registry.listSkill{value: 0.001 ether}(skillHash, "data:application/json;base64,eyJuYW1lIjoiVGVzdCJ9", address(0));

        string memory uri = registry.metadataURIs(skillHash);
        assertEq(uri, "data:application/json;base64,eyJuYW1lIjoiVGVzdCJ9");
    }

    function test_listSkill_protocolFeeAccumulates() public {
        uint256 protocolBefore = registry.protocolBalance();

        vm.prank(publisher);
        registry.listSkill{value: 0.001 ether}(skillHash, "ipfs://QmSkillMeta", address(0));

        assertEq(registry.protocolBalance() - protocolBefore, 0.001 ether);
    }

    function test_listSkill_emitsEvent() public {
        vm.prank(publisher);
        vm.expectEmit(true, true, false, true);
        emit IAegisRegistry.SkillListed(skillHash, publisher, "ipfs://QmSkillMeta");
        registry.listSkill{value: 0.001 ether}(skillHash, "ipfs://QmSkillMeta", address(0));
    }

    function test_listSkill_revertInsufficientFee() public {
        vm.prank(publisher);
        vm.expectRevert(AegisErrors.InsufficientListingFee.selector);
        registry.listSkill{value: 0.0005 ether}(skillHash, "ipfs://QmSkillMeta", address(0));
    }

    function test_listSkill_revertZeroFee() public {
        vm.prank(publisher);
        vm.expectRevert(AegisErrors.InsufficientListingFee.selector);
        registry.listSkill{value: 0}(skillHash, "ipfs://QmSkillMeta", address(0));
    }

    function test_listSkill_revertEmptyMetadata() public {
        vm.prank(publisher);
        vm.expectRevert(AegisErrors.EmptyMetadata.selector);
        registry.listSkill{value: 0.001 ether}(skillHash, "", address(0));
    }

    function test_listSkill_revertZeroSkillHash() public {
        vm.prank(publisher);
        vm.expectRevert(AegisErrors.InvalidSkillHash.selector);
        registry.listSkill{value: 0.001 ether}(bytes32(0), "ipfs://QmSkillMeta", address(0));
    }

    function test_listSkill_revertAlreadyListed() public {
        vm.prank(publisher);
        registry.listSkill{value: 0.001 ether}(skillHash, "ipfs://QmSkillMeta", address(0));

        vm.prank(publisher);
        vm.expectRevert(AegisErrors.SkillAlreadyListed.selector);
        registry.listSkill{value: 0.001 ether}(skillHash, "ipfs://QmSkillMeta2", address(0));
    }

    function test_listSkill_thenRegisterSkill() public {
        // List a skill first (unaudited)
        vm.prank(publisher);
        registry.listSkill{value: 0.001 ether}(skillHash, "ipfs://QmSkillMeta", address(0));

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
            skillHash, "ipfs://QmUpdatedMeta", fakeProof, publicInputs, auditorCommitment, 1, address(0), address(0)
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
        registry.listSkill{value: 0.01 ether}(skillHash, "ipfs://QmSkillMeta", address(0));

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
            skillHash2, "ipfs://QmSecondSkill", fakeProof, publicInputs, auditorCommitment, 1, address(0), address(0)
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
            skillHash, "ipfs://QmUpdated", fakeProof, publicInputs, auditorCommitment, 2, address(0), address(0)
        );

        // Revoke only the first attestation
        registry.revokeAttestation(skillHash, 0);

        assertTrue(registry.isAttestationRevoked(skillHash, 0));
        assertFalse(registry.isAttestationRevoked(skillHash, 1));
    }

    // ──────────────────────────────────────────────
    //  Referral Rewards
    // ──────────────────────────────────────────────

    function test_referral_listSkill_splitsFee() public {
        address referrer = makeAddr("referrer");
        vm.deal(publisher, 10 ether);

        uint256 protocolBefore = registry.protocolBalance();

        vm.prank(publisher);
        registry.listSkill{value: 0.001 ether}(skillHash, "ipfs://QmSkillMeta", referrer);

        // 50% to referrer, 50% to protocol
        assertEq(registry.getReferralEarnings(referrer), 0.0005 ether);
        assertEq(registry.protocolBalance() - protocolBefore, 0.0005 ether);
    }

    function test_referral_registerSkill_splitsFee() public {
        address referrer = makeAddr("referrer");

        vm.prank(auditor);
        registry.registerAuditor{value: 0.02 ether}(auditorCommitment);

        bytes32[] memory publicInputs = new bytes32[](4);
        publicInputs[0] = skillHash;
        publicInputs[1] = keccak256("criteria_v1_basic");
        publicInputs[2] = bytes32(uint256(1));
        publicInputs[3] = auditorCommitment;

        uint256 protocolBefore = registry.protocolBalance();

        vm.prank(publisher);
        registry.registerSkill{value: 0.001 ether}(
            skillHash, "ipfs://QmSkillMetadata", fakeProof, publicInputs, auditorCommitment, 1, address(0), referrer
        );

        assertEq(registry.getReferralEarnings(referrer), 0.0005 ether);
        assertEq(registry.protocolBalance() - protocolBefore, 0.0005 ether);
    }

    function test_referral_selfReferral_reverts() public {
        vm.prank(publisher);
        vm.expectRevert(AegisErrors.SelfReferral.selector);
        registry.listSkill{value: 0.001 ether}(skillHash, "ipfs://QmSkillMeta", publisher);
    }

    function test_referral_zeroReferrer_allToProtocol() public {
        uint256 protocolBefore = registry.protocolBalance();

        vm.prank(publisher);
        registry.listSkill{value: 0.001 ether}(skillHash, "ipfs://QmSkillMeta", address(0));

        assertEq(registry.protocolBalance() - protocolBefore, 0.001 ether);
    }

    function test_referral_withdrawal() public {
        address referrer = makeAddr("referrer");

        vm.prank(publisher);
        registry.listSkill{value: 0.001 ether}(skillHash, "ipfs://QmSkillMeta", referrer);

        uint256 balanceBefore = referrer.balance;

        vm.prank(referrer);
        registry.withdrawReferralEarnings();

        assertEq(referrer.balance - balanceBefore, 0.0005 ether);
        assertEq(registry.getReferralEarnings(referrer), 0);
    }

    function test_referral_withdrawal_reverts_noEarnings() public {
        address nobody = makeAddr("nobody");
        vm.prank(nobody);
        vm.expectRevert(AegisErrors.NoReferralEarnings.selector);
        registry.withdrawReferralEarnings();
    }

    function test_referral_accumulates_acrossMultiple() public {
        address referrer = makeAddr("referrer");
        bytes32 skillHash2 = keccak256("skill_2");

        vm.startPrank(publisher);
        registry.listSkill{value: 0.001 ether}(skillHash, "ipfs://QmSkillMeta", referrer);
        registry.listSkill{value: 0.001 ether}(skillHash2, "ipfs://QmSkillMeta2", referrer);
        vm.stopPrank();

        // Two referrals at 0.0005 each = 0.001 total
        assertEq(registry.getReferralEarnings(referrer), 0.001 ether);
    }

    function test_referral_feeExempt_fundedFromProtocol() public {
        address referrer = makeAddr("referrer");
        address exemptUser = makeAddr("exemptUser");

        // First, seed protocolBalance via a normal listing
        vm.prank(publisher);
        registry.listSkill{value: 0.001 ether}(keccak256("seed_skill"), "ipfs://seed", address(0));

        uint256 protocolBefore = registry.protocolBalance();

        // Make exemptUser fee-exempt
        registry.setFeeExempt(exemptUser, true);

        vm.prank(exemptUser);
        registry.listSkill{value: 0}(skillHash, "ipfs://QmSkillMeta", referrer);

        // Referrer should get fixed reward from protocol balance
        assertEq(registry.getReferralEarnings(referrer), 0.0005 ether);
        assertEq(registry.protocolBalance(), protocolBefore - 0.0005 ether);
    }

    function test_referral_feeExempt_insufficientProtocol_skipsReward() public {
        address referrer = makeAddr("referrer");
        address exemptUser = makeAddr("exemptUser");

        // Protocol balance is 0 — no funds to reward referrer
        registry.setFeeExempt(exemptUser, true);

        vm.prank(exemptUser);
        registry.listSkill{value: 0}(skillHash, "ipfs://QmSkillMeta", referrer);

        // No reward since protocol has no funds
        assertEq(registry.getReferralEarnings(referrer), 0);
    }

    function test_referral_emitsEvent() public {
        address referrer = makeAddr("referrer");

        vm.expectEmit(true, true, true, true);
        emit IAegisRegistry.ReferralReward(referrer, publisher, skillHash, 0.0005 ether);

        vm.prank(publisher);
        registry.listSkill{value: 0.001 ether}(skillHash, "ipfs://QmSkillMeta", referrer);
    }

    // Allow this contract to receive ETH (for completeUnstake tests)
    receive() external payable {}
}
