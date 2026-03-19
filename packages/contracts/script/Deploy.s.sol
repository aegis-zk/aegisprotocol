// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";
import {AegisRegistry} from "../src/AegisRegistry.sol";
import {MockVerifier} from "../src/mocks/MockVerifier.sol";
import {HonkVerifier} from "../src/generated/UltraHonkVerifier.sol";
import {ValidationRegistry} from "../src/erc8004/ValidationRegistry.sol";

/// @notice Deploys AEGIS with MockVerifier (for testing / quick iteration)
contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        MockVerifier verifier = new MockVerifier();
        console2.log("MockVerifier deployed at:", address(verifier));

        AegisRegistry registry = new AegisRegistry(address(verifier));
        console2.log("AegisRegistry deployed at:", address(registry));

        vm.stopBroadcast();
    }
}

/// @notice Deploys AEGIS with the real UltraHonk ZK verifier
/// @dev Use this for production / testnet deployments with real proof verification
contract DeployAegis is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        HonkVerifier verifier = new HonkVerifier();
        console2.log("HonkVerifier deployed at:", address(verifier));

        AegisRegistry registry = new AegisRegistry(address(verifier));
        console2.log("AegisRegistry deployed at:", address(registry));

        vm.stopBroadcast();
    }
}

/// @notice Deploys AEGIS Registry using an existing verifier (for contract upgrades)
/// @dev Reuses the already-deployed HonkVerifier to save gas
contract DeployRegistryOnly is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address existingVerifier = vm.envAddress("VERIFIER_ADDRESS");

        vm.startBroadcast(deployerKey);

        AegisRegistry registry = new AegisRegistry(existingVerifier);
        console2.log("AegisRegistry deployed at:", address(registry));
        console2.log("Using existing verifier:", existingVerifier);

        vm.stopBroadcast();
    }
}

/// @notice Deploys the ERC-8004 ValidationRegistry
/// @dev Uses the existing IdentityRegistry at 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
contract DeployValidationRegistry is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address identityRegistry = vm.envOr(
            "IDENTITY_REGISTRY",
            address(0x8004A169FB4a3325136EB29fA0ceB6D2e539a432)
        );

        vm.startBroadcast(deployerKey);

        ValidationRegistry validationRegistry = new ValidationRegistry(identityRegistry);
        console2.log("ValidationRegistry deployed at:", address(validationRegistry));
        console2.log("Using IdentityRegistry:", identityRegistry);

        vm.stopBroadcast();
    }
}
