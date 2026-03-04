// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";
import {AegisRegistry} from "../src/AegisRegistry.sol";
import {MockVerifier} from "../src/mocks/MockVerifier.sol";
import {HonkVerifier} from "../src/generated/UltraHonkVerifier.sol";

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
