import { Hono } from 'hono';
import * as q from '../db/queries.js';

export const auditorsRouter = new Hono();

/** GET /auditors/leaderboard — Auditors ranked by reputation. */
auditorsRouter.get('/leaderboard', (c) => {
  const limit = Number(c.req.query('limit') ?? 50);
  const offset = Number(c.req.query('offset') ?? 0);
  const auditors = q.getAuditorLeaderboard(limit, offset);
  return c.json({ data: auditors, count: auditors.length });
});

/** GET /auditors/:commitment — Single auditor profile. */
auditorsRouter.get('/:commitment', (c) => {
  const commitment = c.req.param('commitment');
  const auditor = q.getAuditorByCommitment(commitment);
  if (!auditor) return c.json({ error: 'Auditor not found' }, 404);

  const attestations = q.getAttestationsByAuditor(commitment);

  return c.json({ data: { ...auditor, attestations } });
});
