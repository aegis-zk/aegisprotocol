import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { skillsRouter } from './routes/skills.js';
import { auditorsRouter } from './routes/auditors.js';
import { disputesRouter } from './routes/disputes.js';
import { bountiesRouter } from './routes/bounties.js';
import { statsRouter } from './routes/stats.js';
import { referralsRouter } from './routes/referrals.js';
import { taoRouter } from './routes/tao.js';

export const app = new Hono();

// ── Middleware ────────────────────────────────────────────

app.use('*', cors());
app.use('*', logger());

// ── Health check ─────────────────────────────────────────

app.get('/', (c) =>
  c.json({
    name: '@aegisaudit/indexer',
    version: '0.1.0',
    endpoints: [
      'GET /skills',
      'GET /skills/by-category',
      'GET /skills/unaudited',
      'GET /skills/registry',
      'GET /skills/:hash',
      'GET /auditors/leaderboard',
      'GET /auditors/:commitment',
      'GET /disputes/open',
      'GET /disputes/:id',
      'GET /bounties',
      'GET /bounties/open',
      'GET /stats',
      'GET /stats/events',
      'GET /stats/attestation-levels',
      'GET /referrals/stats',
      'GET /referrals/:address',
      'GET /tao/subnets',
      'GET /tao/subnets/:netuid',
      'GET /tao/stats',
    ],
  }),
);

// ── Routes ───────────────────────────────────────────────

app.route('/skills', skillsRouter);
app.route('/auditors', auditorsRouter);
app.route('/disputes', disputesRouter);
app.route('/bounties', bountiesRouter);
app.route('/stats', statsRouter);
app.route('/referrals', referralsRouter);
app.route('/tao', taoRouter);

// ── 404 fallback ─────────────────────────────────────────

app.notFound((c) => c.json({ error: 'Not found' }, 404));

// ── Error handler ────────────────────────────────────────

app.onError((err, c) => {
  console.error('[server] Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});
