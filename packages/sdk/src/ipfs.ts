/**
 * IPFS metadata upload/fetch utilities.
 *
 * Provides a minimal abstraction for storing and retrieving skill metadata
 * on IPFS. Defaults to using a public gateway for reads and requires
 * Pinata credentials for writes.
 *
 * When no Pinata keys are available, `uploadMetadata()` automatically
 * falls back to encoding metadata as a base64 data URI — no external
 * services or API keys needed.
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
 * Encode metadata as a base64 data URI.
 *
 * This is a zero-dependency alternative to IPFS/Pinata — the metadata JSON is
 * base64-encoded and stored on-chain as a `data:` URI. No external services or
 * API keys needed. Suitable for small metadata payloads (< 4 KB recommended).
 *
 * @example
 * ```ts
 * import { metadataToDataURI } from '@aegisaudit/sdk';
 *
 * const uri = metadataToDataURI({ name: 'My Skill', description: '...', version: '1.0.0' });
 * // => "data:application/json;base64,eyJuYW1lIjoi..."
 *
 * await client.registerSkill({ skillHash, metadataURI: uri, ... });
 * ```
 */
export function metadataToDataURI(metadata: SkillMetadata | AuditMetadata): string {
  const json = JSON.stringify(metadata);
  // Use btoa for browser, Buffer for Node
  const base64 =
    typeof btoa === 'function'
      ? btoa(unescape(encodeURIComponent(json)))
      : Buffer.from(json, 'utf-8').toString('base64');
  return `data:application/json;base64,${base64}`;
}

/**
 * Decode a base64 data URI back to metadata JSON.
 *
 * Inverse of `metadataToDataURI()`. Returns the parsed JSON object.
 */
export function dataURIToMetadata<T = SkillMetadata | AuditMetadata>(dataURI: string): T {
  if (!dataURI.startsWith('data:')) {
    throw new Error('Not a data URI');
  }
  const base64 = dataURI.split(',')[1];
  if (!base64) throw new Error('Invalid data URI format');
  const json =
    typeof atob === 'function'
      ? decodeURIComponent(escape(atob(base64)))
      : Buffer.from(base64, 'base64').toString('utf-8');
  return JSON.parse(json) as T;
}

/**
 * Upload skill metadata to IPFS via Pinata, or encode as a data URI.
 *
 * Accepts either legacy `SkillMetadata` or the new `AuditMetadata` format.
 *
 * If Pinata credentials are not available (no PINATA_API_KEY / PINATA_SECRET_KEY
 * env vars and no explicit credentials), automatically falls back to encoding
 * metadata as a base64 data URI. The data URI is stored on-chain directly —
 * no external service or API keys needed.
 *
 * To always use Pinata, pass credentials explicitly.
 * To always use data URIs, call `metadataToDataURI()` directly.
 */
export async function uploadMetadata(
  metadata: SkillMetadata | AuditMetadata,
  credentials?: { apiKey: string; secretKey: string },
): Promise<string> {
  const apiKey = credentials?.apiKey ?? process.env.PINATA_API_KEY;
  const secretKey = credentials?.secretKey ?? process.env.PINATA_SECRET_KEY;

  // No Pinata keys → encode as data URI (works without any external service)
  if (!apiKey || !secretKey) {
    return metadataToDataURI(metadata);
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
