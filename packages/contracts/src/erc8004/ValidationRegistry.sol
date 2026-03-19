// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title ValidationRegistry (ERC-8004)
 * @notice Non-upgradeable implementation of the ERC-8004 ValidationRegistry.
 *         ABI-compatible with the official ValidationRegistryUpgradeable.
 *
 *         Manages validation requests and responses for ERC-8004 agents.
 *         Agents request validation from a named validator; the validator
 *         later responds with a score (0-100) and a tag.
 *
 * @dev    Based on erc-8004/erc-8004-contracts ValidationRegistryUpgradeable v2.0.0
 *         Simplified to non-upgradeable for AEGIS deployment since we own the deploy.
 */

interface IIdentityRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

contract ValidationRegistry {
    // ── Events ─────────────────────────────────────────────

    event ValidationRequest(
        address indexed validatorAddress,
        uint256 indexed agentId,
        string requestURI,
        bytes32 indexed requestHash
    );

    event ValidationResponse(
        address indexed validatorAddress,
        uint256 indexed agentId,
        bytes32 indexed requestHash,
        uint8 response,
        string responseURI,
        bytes32 responseHash,
        string tag
    );

    // ── Types ──────────────────────────────────────────────

    struct ValidationStatus {
        address validatorAddress;
        uint256 agentId;
        uint8 response;
        bytes32 responseHash;
        string tag;
        uint256 lastUpdate;
        bool hasResponse;
    }

    // ── State ──────────────────────────────────────────────

    address public immutable identityRegistry;
    address public owner;

    mapping(bytes32 => ValidationStatus) private _validations;
    mapping(uint256 => bytes32[]) private _agentValidations;
    mapping(address => bytes32[]) private _validatorRequests;

    // ── Modifiers ──────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    // ── Constructor ────────────────────────────────────────

    constructor(address identityRegistry_) {
        require(identityRegistry_ != address(0), "bad identity");
        identityRegistry = identityRegistry_;
        owner = msg.sender;
    }

    // ── Write Operations ───────────────────────────────────

    /**
     * @notice Submit a validation request. Caller must own or be approved for the agent NFT.
     * @param validatorAddress The validator who should respond.
     * @param agentId          The ERC-8004 agent NFT token ID.
     * @param requestURI       URI with request details (off-chain).
     * @param requestHash      Deterministic hash identifying this request.
     */
    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    ) external {
        require(validatorAddress != address(0), "bad validator");
        require(_validations[requestHash].validatorAddress == address(0), "exists");

        IIdentityRegistry registry = IIdentityRegistry(identityRegistry);
        address nftOwner = registry.ownerOf(agentId);
        require(
            msg.sender == nftOwner ||
            registry.isApprovedForAll(nftOwner, msg.sender) ||
            registry.getApproved(agentId) == msg.sender,
            "Not authorized"
        );

        _validations[requestHash] = ValidationStatus({
            validatorAddress: validatorAddress,
            agentId: agentId,
            response: 0,
            responseHash: bytes32(0),
            tag: "",
            lastUpdate: block.timestamp,
            hasResponse: false
        });

        _agentValidations[agentId].push(requestHash);
        _validatorRequests[validatorAddress].push(requestHash);

        emit ValidationRequest(validatorAddress, agentId, requestURI, requestHash);
    }

    /**
     * @notice Submit a validation response. Only the named validator can respond.
     * @param requestHash  The request to respond to.
     * @param response     Score 0-100.
     * @param responseURI  URI with response details (off-chain).
     * @param responseHash Hash of the response data.
     * @param tag          Classification tag (e.g. "aegis-audit").
     */
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external {
        ValidationStatus storage s = _validations[requestHash];
        require(s.validatorAddress != address(0), "unknown");
        require(msg.sender == s.validatorAddress, "not validator");
        require(response <= 100, "resp>100");

        s.response = response;
        s.responseHash = responseHash;
        s.tag = tag;
        s.lastUpdate = block.timestamp;
        s.hasResponse = true;

        emit ValidationResponse(
            s.validatorAddress,
            s.agentId,
            requestHash,
            response,
            responseURI,
            responseHash,
            tag
        );
    }

    // ── Read Operations ────────────────────────────────────

    /**
     * @notice Get the full validation status for a request hash.
     */
    function getValidationStatus(bytes32 requestHash)
        external
        view
        returns (
            address validatorAddress,
            uint256 agentId,
            uint8 response,
            bytes32 responseHash,
            string memory tag,
            uint256 lastUpdate
        )
    {
        ValidationStatus memory s = _validations[requestHash];
        require(s.validatorAddress != address(0), "unknown");
        return (s.validatorAddress, s.agentId, s.response, s.responseHash, s.tag, s.lastUpdate);
    }

    /**
     * @notice Compute average validation score for an agent, optionally filtered by
     *         validator addresses and/or tag.
     * @param agentId            The agent to summarize.
     * @param validatorAddresses Filter to these validators (empty = all).
     * @param tag                Filter to this tag (empty = all).
     */
    function getSummary(
        uint256 agentId,
        address[] calldata validatorAddresses,
        string calldata tag
    ) external view returns (uint64 count, uint8 avgResponse) {
        uint256 totalResponse;
        bytes32[] storage requestHashes = _agentValidations[agentId];

        for (uint256 i; i < requestHashes.length; i++) {
            ValidationStatus storage s = _validations[requestHashes[i]];

            // Filter by validator
            bool matchValidator = (validatorAddresses.length == 0);
            if (!matchValidator) {
                for (uint256 j; j < validatorAddresses.length; j++) {
                    if (s.validatorAddress == validatorAddresses[j]) {
                        matchValidator = true;
                        break;
                    }
                }
            }

            // Filter by tag
            bool matchTag = (bytes(tag).length == 0) ||
                (keccak256(bytes(s.tag)) == keccak256(bytes(tag)));

            if (matchValidator && matchTag && s.hasResponse) {
                totalResponse += s.response;
                count++;
            }
        }

        avgResponse = count > 0 ? uint8(totalResponse / count) : 0;
    }

    /**
     * @notice Get all request hashes for an agent.
     */
    function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory) {
        return _agentValidations[agentId];
    }

    /**
     * @notice Get all request hashes assigned to a validator.
     */
    function getValidatorRequests(address validatorAddress) external view returns (bytes32[] memory) {
        return _validatorRequests[validatorAddress];
    }

    // ── Admin ──────────────────────────────────────────────

    function getIdentityRegistry() external view returns (address) {
        return identityRegistry;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "bad owner");
        owner = newOwner;
    }

    function getVersion() external pure returns (string memory) {
        return "2.0.0";
    }
}
