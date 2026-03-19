import { Hono } from 'hono';
import * as q from '../db/queries.js';

export const bountiesRouter = new Hono();

/** GET /bounties — All bounties with skill metadata. */
bountiesRouter.get('/', (c) => {
  const limit = Number(c.req.query('limit') ?? 200);
  const bounties = q.getAllBounties(limit);
  return c.json({ data: bounties, count: bounties.length });
});

/** GET /bounties/open — Active bounties sorted by reward amount. */
bountiesRouter.get('/open', (c) => {
  const limit = Number(c.req.query('limit') ?? 50);
  const offset = Number(c.req.query('offset') ?? 0);
  const bounties = q.getOpenBounties(limit, offset);
  return c.json({ data: bounties, count: bounties.length });
});
