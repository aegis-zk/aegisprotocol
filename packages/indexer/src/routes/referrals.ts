import { Hono } from 'hono';
import * as q from '../db/queries.js';

export const referralsRouter = new Hono();

/** GET /referrals/stats — Top referrers and total rewards distributed. */
referralsRouter.get('/stats', (c) => {
  const stats = q.getReferralStats();
  return c.json({ data: stats });
});

/** GET /referrals/:address — Referral history for a specific address. */
referralsRouter.get('/:address', (c) => {
  const address = c.req.param('address');
  const limit = Number(c.req.query('limit') ?? 50);
  const referrals = q.getReferralsByReferrer(address, limit);
  return c.json({ data: referrals, count: referrals.length });
});
