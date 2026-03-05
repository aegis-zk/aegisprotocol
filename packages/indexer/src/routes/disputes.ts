import { Hono } from 'hono';
import * as q from '../db/queries.js';

export const disputesRouter = new Hono();

/** GET /disputes/open — Unresolved disputes. */
disputesRouter.get('/open', (c) => {
  const limit = Number(c.req.query('limit') ?? 50);
  const offset = Number(c.req.query('offset') ?? 0);
  const disputes = q.getOpenDisputes(limit, offset);
  return c.json({ data: disputes, count: disputes.length });
});

/** GET /disputes/:id — Single dispute by ID. */
disputesRouter.get('/:id', (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: 'Invalid dispute ID' }, 400);

  const dispute = q.getDisputeById(id);
  if (!dispute) return c.json({ error: 'Dispute not found' }, 404);

  return c.json({ data: dispute });
});
