import { Hono } from 'hono';
import * as q from '../db/queries.js';

export const skillsRouter = new Hono();

/** GET /skills — All listed skills, newest first. */
skillsRouter.get('/', (c) => {
  const limit = Number(c.req.query('limit') ?? 50);
  const offset = Number(c.req.query('offset') ?? 0);
  const skills = q.getSkills(limit, offset);
  return c.json({ data: skills, count: skills.length });
});

/** GET /skills/unaudited — Skills with no valid attestations. */
skillsRouter.get('/unaudited', (c) => {
  const limit = Number(c.req.query('limit') ?? 50);
  const offset = Number(c.req.query('offset') ?? 0);
  const skills = q.getUnauditedSkills(limit, offset);
  return c.json({ data: skills, count: skills.length });
});

/** GET /skills/:hash — Single skill with attestation details. */
skillsRouter.get('/:hash', (c) => {
  const hash = c.req.param('hash');
  const skill = q.getSkillByHash(hash);
  if (!skill) return c.json({ error: 'Skill not found' }, 404);

  const attestations = q.getAttestationsForSkill(hash);
  const disputes = q.getDisputesForSkill(hash);

  return c.json({ data: { ...skill, attestations, disputes } });
});
