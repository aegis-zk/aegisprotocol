/**
 * Metadata URI parsing for skill categorization.
 *
 * Extracts name and category from metadata stored as:
 * - data: URIs (inline base64 JSON — decoded synchronously)
 * - ipfs:// URIs (fetched via public gateway)
 * - https:// URIs (fetched directly)
 */

import * as q from './db/queries.js';

const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

export interface ParsedMetadata {
  name: string;
  category: string;
}

const FALLBACK: ParsedMetadata = { name: 'Unknown Skill', category: 'Uncategorized' };

/**
 * Parse a metadata URI and extract name + category.
 * Returns fallback values on any failure.
 */
export async function parseMetadataURI(uri: string): Promise<ParsedMetadata> {
  try {
    if (uri.startsWith('data:')) {
      return parseDataURI(uri);
    }
    if (uri.startsWith('ipfs://')) {
      return await fetchAndParse(`${IPFS_GATEWAY}/${uri.replace('ipfs://', '')}`);
    }
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      return await fetchAndParse(uri);
    }
  } catch (err) {
    console.warn(`[metadata] Failed to parse ${uri.slice(0, 60)}...:`, (err as Error).message);
  }

  return FALLBACK;
}

/** Decode a base64 data URI synchronously. */
function parseDataURI(uri: string): ParsedMetadata {
  const base64 = uri.split(',')[1];
  if (!base64) return FALLBACK;

  const json = Buffer.from(base64, 'base64').toString('utf-8');
  return extractFields(JSON.parse(json));
}

/** Fetch a remote URI and parse the JSON. */
async function fetchAndParse(url: string): Promise<ParsedMetadata> {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return FALLBACK;

  const json = await res.json();
  return extractFields(json);
}

/**
 * Backfill metadata for existing skills that are missing name/category.
 * Called once at startup after sync initialization.
 */
export async function backfillMetadata(): Promise<void> {
  const skills = q.getSkillsNeedingMetadata();
  if (skills.length === 0) return;

  console.log(`[metadata] Backfilling ${skills.length} skill(s)...`);

  for (const skill of skills) {
    const meta = await parseMetadataURI(skill.metadata_uri);
    q.updateSkillMetadata({ skillHash: skill.skill_hash, skillName: meta.name, category: meta.category });
  }

  console.log(`[metadata] Backfill complete`);
}

/** Extract name and category from any metadata JSON shape. */
function extractFields(obj: Record<string, unknown>): ParsedMetadata {
  // aegis/audit-metadata@1 nests under `skill`
  const skill = (obj.skill ?? obj) as Record<string, unknown>;

  return {
    name: (typeof skill.name === 'string' && skill.name) || FALLBACK.name,
    category: (typeof skill.category === 'string' && skill.category) || FALLBACK.category,
  };
}
