import { Hono } from 'hono';
import { fetchTaoSubnets, fetchTaoMetagraph, fetchTaoStats } from '../sync/tao.js';

export const taoRouter = new Hono();

/** GET /tao/subnets — All active Bittensor subnets with AEGIS attestation status. */
taoRouter.get('/subnets', async (c) => {
  try {
    const subnets = await fetchTaoSubnets();
    return c.json({ data: subnets, count: subnets.length });
  } catch (err) {
    console.error('[tao] Failed to fetch subnets:', err);
    return c.json({ error: 'Failed to fetch Bittensor subnets' }, 502);
  }
});

/** GET /tao/subnets/:netuid — Metagraph (miners/validators) for a specific subnet. */
taoRouter.get('/subnets/:netuid', async (c) => {
  const netuid = Number(c.req.param('netuid'));
  if (isNaN(netuid) || netuid < 0) {
    return c.json({ error: 'Invalid netuid' }, 400);
  }

  const sortBy = (c.req.query('sortBy') ?? 'stake') as 'stake' | 'trust' | 'incentive';
  const limit = Math.min(Number(c.req.query('limit') ?? 100), 256);

  try {
    let miners = await fetchTaoMetagraph(netuid);

    // Sort
    if (sortBy === 'trust') {
      miners = [...miners].sort((a, b) => b.trust - a.trust);
    } else if (sortBy === 'incentive') {
      miners = [...miners].sort((a, b) => b.incentive - a.incentive);
    } else {
      miners = [...miners].sort((a, b) => parseFloat(b.stake) - parseFloat(a.stake));
    }

    miners = miners.slice(0, limit);

    return c.json({
      data: {
        netuid,
        miners,
        totalNodes: miners.length,
      },
    });
  } catch (err) {
    console.error(`[tao] Failed to fetch metagraph for SN${netuid}:`, err);
    return c.json({ error: `Failed to fetch metagraph for subnet ${netuid}` }, 502);
  }
});

/** GET /tao/stats — Aggregate Bittensor stats. */
taoRouter.get('/stats', async (c) => {
  try {
    const stats = await fetchTaoStats();
    return c.json({ data: stats });
  } catch (err) {
    console.error('[tao] Failed to fetch stats:', err);
    return c.json({ error: 'Failed to fetch TAO stats' }, 502);
  }
});
