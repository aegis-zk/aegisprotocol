import { Hono } from 'hono';
import * as q from '../db/queries.js';
import { getLastSyncedBlock } from '../db/index.js';
import { chainConfig, config } from '../config.js';

export const statsRouter = new Hono();

/** GET /stats — Protocol-wide statistics. */
statsRouter.get('/', (c) => {
  const stats = q.getStats();
  const lastSyncedBlock = getLastSyncedBlock().toString();

  return c.json({
    data: {
      ...stats,
      chain_id: config.chainId,
      registry_address: chainConfig.registryAddress,
      registry_v4_address: chainConfig.registryV4Address ?? null,
      last_synced_block: lastSyncedBlock,
    },
  });
});

/** GET /stats/events — Recent raw event log. */
statsRouter.get('/events', (c) => {
  const limit = Number(c.req.query('limit') ?? 100);
  const events = q.getRecentEvents(limit);
  return c.json({ data: events, count: events.length });
});

/** GET /stats/attestation-levels — Count of non-revoked attestations by level. */
statsRouter.get('/attestation-levels', (c) => {
  const counts = q.getAttestationLevelCounts();
  return c.json({ data: counts });
});
