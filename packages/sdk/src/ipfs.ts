/**
 * IPFS metadata upload/fetch utilities.
 *
 * Provides a minimal abstraction for storing and retrieving skill metadata
 * on IPFS. Defaults to using a public gateway for reads and requires
 * Pinata credentials for writes.
 *
 * Supports both the legacy `SkillMetadata` format and the new structured
 * `AuditMetadata` format (aegis/audit-metadata@1).
 */

import type { AuditMetadata } from './schema';

/**
 * Legacy skill metadata format.
 * @deprecated Use `AuditMetadata` from `@aegisaudit/sdk/schema` for new attestations.
 */
export interface SkillMetadata {
  name: string;
  description: string;
  version: string;
  author?: string;
  repository?: string;
  tags?: string[];
}

const DEFAULT_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

/**
 * Fetch skill metadata from IPFS.
 * @param cid - IPFS CID or full ipfs:// URI
 * @param gateway - IPFS gateway URL (defaults to Pinata public gateway)
 */
export async function fetchMetadata(
  cid: string,
  gateway: string = DEFAULT_GATEWAY,
): Promise<SkillMetadata> {
  const resolvedCid = cid.replace('ipfs://', '');
  const url = `${gateway}/${resolvedCid}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata from IPFS: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<SkillMetadata>;
}

/**
 * Fetch structured audit metadata from IPFS.
 *
 * Use this for attestations that follow the `aegis/audit-metadata@1` schema.
 * To validate the returned metadata, use `validateAuditMetadata()` from the schema module.
 *
 * @param cid - IPFS CID or full ipfs:// URI
 * @param gateway - IPFS gateway URL (defaults to Pinata public gateway)
 *
 * @example
 * ```ts
 * import { fetchAuditMetadata, validateAuditMetadata } from '@aegisaudit/sdk';
 *
 * const metadata = await fetchAuditMetadata('ipfs://Qm...');
 * const { valid, errors } = validateAuditMetadata(metadata);
 * ```
 */
export async function fetchAuditMetadata(
  cid: string,
  gateway: string = DEFAULT_GATEWAY,
): Promise<AuditMetadata> {
  const resolvedCid = cid.replace('ipfs://', '');
  const url = `${gateway}/${resolvedCid}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audit metadata from IPFS: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<AuditMetadata>;
}

/**
 * Upload skill metadata to IPFS via Pinata.
 *
 * Accepts either legacy `SkillMetadata` or the new `AuditMetadata` format.
 *
 * Requires PINATA_API_KEY and PINATA_SECRET_KEY environment variables,
 * or pass credentials explicitly.
 */
export async function uploadMetadata(
  metadata: SkillMetadata | AuditMetadata,
  credentials?: { apiKey: string; secretKey: string },
): Promise<string> {
  const apiKey = credentials?.apiKey ?? process.env.PINATA_API_KEY;
  const secretKey = credentials?.secretKey ?? process.env.PINATA_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error(
      'Pinata credentials required. Set PINATA_API_KEY and PINATA_SECRET_KEY env vars or pass them explicitly.',
    );
  }

  // Determine pin name from metadata format
  const pinName =
    'schema' in metadata && metadata.schema === 'aegis/audit-metadata@1'
      ? `aegis-audit-${metadata.skill.name}`
      : `aegis-skill-${(metadata as SkillMetadata).name}`;

  const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      pinata_api_key: apiKey,
      pinata_secret_api_key: secretKey,
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: { name: pinName },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to upload to IPFS: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as { IpfsHash: string };
  return `ipfs://${result.IpfsHash}`;
}
