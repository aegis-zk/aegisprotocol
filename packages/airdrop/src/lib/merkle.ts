/**
 * Merkle tree generation using OpenZeppelin's StandardMerkleTree.
 * Leaves: [bytes32 commitment, uint256 tokenAmount]
 * Compatible with Solidity MerkleProof.sol
 */

import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import type { AuditorAllocation } from '../types.js';

type Leaf = [string, string];

/**
 * Build a Merkle tree from allocations and attach proofs.
 */
export function buildMerkleTree(allocations: AuditorAllocation[]): {
  root: string;
  allocations: AuditorAllocation[];
} {
  if (allocations.length === 0) {
    return { root: '0x' + '0'.repeat(64), allocations };
  }

  // Build values array: [commitment, tokenAmount]
  const values: Leaf[] = allocations.map((a) => [
    a.commitment,
    a.tokenAmount,
  ]);

  const tree = StandardMerkleTree.of(values, ['bytes32', 'uint256']);

  // Attach proofs to allocations
  const withProofs = allocations.map((a) => {
    const proof = getProof(tree, a.commitment);
    return { ...a, merkleProof: proof };
  });

  return { root: tree.root, allocations: withProofs };
}

function getProof(
  tree: StandardMerkleTree<Leaf>,
  commitment: string,
): string[] {
  for (const [i, v] of tree.entries()) {
    if (v[0].toLowerCase() === commitment.toLowerCase()) {
      return tree.getProof(i);
    }
  }
  throw new Error(`Commitment ${commitment} not found in Merkle tree`);
}

/**
 * Verify all proofs in a snapshot against its Merkle root.
 */
export function verifySnapshot(
  merkleRoot: string,
  allocations: AuditorAllocation[],
): { valid: boolean; failures: string[] } {
  if (allocations.length === 0) {
    return { valid: true, failures: [] };
  }

  const values: Leaf[] = allocations.map((a) => [a.commitment, a.tokenAmount]);
  const tree = StandardMerkleTree.of(values, ['bytes32', 'uint256']);

  if (tree.root !== merkleRoot) {
    return {
      valid: false,
      failures: [`Root mismatch: expected ${merkleRoot}, got ${tree.root}`],
    };
  }

  const failures: string[] = [];

  for (const a of allocations) {
    try {
      const verified = StandardMerkleTree.verify(
        tree.root,
        ['bytes32', 'uint256'],
        [a.commitment, a.tokenAmount],
        a.merkleProof,
      );
      if (!verified) {
        failures.push(`Invalid proof for ${a.commitment}`);
      }
    } catch {
      failures.push(`Proof verification threw for ${a.commitment}`);
    }
  }

  return { valid: failures.length === 0, failures };
}
