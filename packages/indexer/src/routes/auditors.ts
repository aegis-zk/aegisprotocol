import { Hono } from 'hono';
import * as q from '../db/queries.js';

export const auditorsRouter = new Hono();

/** GET /auditors/leaderboard — Auditors ranked by reputation with l2/l3 counts. */
auditorsRouter.get('/leaderboard', (c) => {
  const limit = Number(c.req.query('limit') ?? 50);
  const offset = Number(c.req.query('offset') ?? 0);
  const auditors = q.getLeaderboardDetailed(limit, offset);
  return c.json({ data: auditors, count: auditors.length });
});

/** GET /auditors/:commitment — Full auditor profile with attestations + disputes. */
auditorsRouter.get('/:commitment', (c) => {
  const commitment = c.req.param('commitment');
  const auditor = q.getAuditorProfile(commitment);
  if (!auditor) return c.json({ error: 'Auditor not found' }, 404);

  const attestations = q.getAuditorAttestationsDetailed(commitment);

  return c.json({ data: { ...auditor, attestations } });
});
