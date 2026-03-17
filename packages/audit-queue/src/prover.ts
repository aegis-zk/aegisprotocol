import type { AuditResult } from "./types.js";
import { config } from "./config.js";

/**
 * Generate a ZK attestation proof for a completed audit.
 *
 * Wraps the SDK's generateAttestationViaCLI() which shells out to
 * nargo + bb (Noir prover toolchain). On Windows, this runs via WSL.
 *
 * Returns the proof bytes and public inputs needed for on-chain submission.
 */
export async function generateProof(
  auditResult: AuditResult,
  auditorCommitment: string
): Promise<{ proof: string; publicInputs: string[] }> {
  try {
    // Dynamic import to avoid hard dependency if SDK isn't fully set up
    const sdk = await import("@aegisaudit/sdk");

    // Compute criteria hash from the sorted criteria IDs
    const criteriaIds = auditResult.criteria.map(c => c.criterionId).sort();
    const criteriaHash = sdk.computeCriteriaHash
      ? sdk.computeCriteriaHash(criteriaIds)
      : "0x" + "00".repeat(32); // fallback

    console.log(`[prover] Generating proof for ${auditResult.skillHash.slice(0, 10)}...`);
    console.log(`[prover] Level: L${auditResult.auditLevel}, Criteria: ${criteriaIds.length}`);

    // Generate proof via CLI (nargo + bb)
    const result = await sdk.generateAttestationViaCLI({
      circuitsDir: config.circuitsDir,
      skillHash: auditResult.skillHash,
      criteriaHash,
      auditLevel: auditResult.auditLevel,
      auditorCommitment,
      sourceHash: auditResult.sourceHash.replace("sha256:", "0x"),
    });

    console.log(`[prover] Proof generated (${result.proof.length} bytes)`);

    return {
      proof: result.proof,
      publicInputs: result.publicInputs,
    };
  } catch (err) {
    throw new Error(`Proof generation failed: ${(err as Error).message}`);
  }
}
