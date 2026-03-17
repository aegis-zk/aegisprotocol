import { config, chainConfig } from "./config.js";

/**
 * Submit an attestation on-chain via the SDK's registerSkill().
 *
 * Mirrors the call pattern from packages/mcp-server/src/tools/audit-skill.ts.
 * Returns the transaction hash.
 */
export async function submitAttestation(params: {
  skillHash: string;
  metadataURI: string;
  proof: string;
  publicInputs: string[];
  auditorCommitment: string;
  auditLevel: 1 | 2 | 3;
}): Promise<string> {
  try {
    // Dynamic import for SDK
    const sdk = await import("@aegisaudit/sdk");

    const client = new sdk.AegisClient({
      chainId: config.chainId,
      rpcUrl: config.rpcUrl,
    });

    // Set wallet from private key
    client.setWallet(config.privateKey);

    console.log(`[submit] Submitting L${params.auditLevel} attestation for ${params.skillHash.slice(0, 10)}...`);

    const txHash = await client.registerSkill({
      skillHash: params.skillHash as `0x${string}`,
      metadataURI: params.metadataURI,
      attestationProof: params.proof as `0x${string}`,
      publicInputs: params.publicInputs as `0x${string}`[],
      auditorCommitment: params.auditorCommitment as `0x${string}`,
      auditLevel: params.auditLevel,
    });

    console.log(`[submit] Transaction sent: ${txHash}`);
    return txHash;
  } catch (err) {
    throw new Error(`On-chain submission failed: ${(err as Error).message}`);
  }
}

/**
 * Verify an attestation was indexed by waiting for subgraph sync.
 * Polls every 10s for up to 60s.
 */
export async function verifyAttestation(
  skillHash: string,
  expectedTxHash: string
): Promise<boolean> {
  const sdk = await import("@aegisaudit/sdk");

  const client = new sdk.AegisClient({
    chainId: config.chainId,
    rpcUrl: config.rpcUrl,
  });

  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 10_000));

    try {
      const attestations = await client.getAttestations(skillHash as `0x${string}`);
      const found = attestations.some(
        (a: any) => a.txHash?.toLowerCase() === expectedTxHash.toLowerCase()
      );

      if (found) {
        console.log(`[verify] Attestation confirmed on-chain for ${skillHash.slice(0, 10)}...`);
        return true;
      }
    } catch {
      // Subgraph not ready yet, keep polling
    }
  }

  console.warn(`[verify] Attestation not confirmed after 60s — may still be indexing`);
  return false;
}
