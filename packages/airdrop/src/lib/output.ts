/**
 * Snapshot output: write JSON + CSV files.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Snapshot } from '../types.js';

/**
 * Write snapshot to JSON and CSV files.
 * Returns the paths of the written files.
 */
export function writeSnapshot(
  snapshot: Snapshot,
  outputDir: string,
): { jsonPath: string; csvPath: string } {
  mkdirSync(outputDir, { recursive: true });

  const ts = snapshot.timestamp.replace(/[:.]/g, '-').replace('Z', '');
  const baseName = `snapshot-${ts}`;

  // JSON
  const jsonPath = join(outputDir, `${baseName}.json`);
  writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2), 'utf-8');

  // CSV
  const csvPath = join(outputDir, `${baseName}.csv`);
  const header = 'commitment,reputationScore,shareBps,sharePercent,tokenAmount,merkleProof';
  const rows = snapshot.allocations.map((a) =>
    [
      a.commitment,
      a.reputationScore,
      a.shareBps,
      a.sharePercent,
      a.tokenAmount,
      `"${JSON.stringify(a.merkleProof)}"`,
    ].join(','),
  );
  writeFileSync(csvPath, [header, ...rows].join('\n'), 'utf-8');

  return { jsonPath, csvPath };
}
