/**
 * x402-gated Trust Profile API server middleware.
 *
 * Creates an Express Router with three endpoints:
 *   GET  /v1/trust/:agentId         → TrustProfile (x402 gated)
 *   GET  /v1/trust/skill/:skillHash → SkillTrustScore (x402 gated)
 *   POST /v1/trust/batch            → TrustProfile[] (x402 gated, higher price)
 *
 * Requires: express + @x402/express (optional peer dependencies)
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { createTrustApiMiddleware } from '@aegisaudit/sdk';
 *
 * const app = express();
 * app.use(express.json());
 *
 * const trustRouter = await createTrustApiMiddleware({
 *   paymentAddress: '0xYourAddress...',
 *   chainId: 8453,
 *   pricing: {
 *     profileQuery: '0.10',  // 10 cents USDC
 *     skillQuery: '0.05',    // 5 cents
 *     batchQuery: '0.50',    // 50 cents
 *   },
 * });
 *
 * app.use(trustRouter);
 * app.listen(3001, () => console.log('Trust API running on :3001'));
 * ```
 */

import type { TrustApiConfig, Address } from './types';
import { USDC_ADDRESSES } from './erc8004-constants';
import { REGISTRY_ADDRESSES } from './constants';
import { createReadClient } from './registry';
import {
  buildTrustProfile,
  buildSkillTrustScore,
  batchBuildTrustProfiles,
  MAX_BATCH_SIZE,
} from './trust';

/**
 * JSON serializer that converts bigint values to strings.
 * Required because JSON.stringify() does not support bigint natively.
 */
function serializeBigInts(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

/**
 * Create Express middleware for hosting an x402-gated Trust Profile API.
 *
 * The returned Router exposes three endpoints gated by USDC micropayments:
 * - GET /v1/trust/:agentId — Full agent trust profile
 * - GET /v1/trust/skill/:skillHash — Single skill trust data
 * - POST /v1/trust/batch — Batch trust profiles (max 10 agents)
 *
 * Requires `express` and `@x402/express` to be installed by the deployer.
 *
 * @param apiConfig - Server configuration including payment address, chain, and pricing
 * @returns An Express Router to mount on your app
 */
export async function createTrustApiMiddleware(
  apiConfig: TrustApiConfig,
): Promise<unknown> {
  // Dynamic import of @x402/express (optional peer dep)
  let paymentMiddleware: (
    facilitatorUrl: string,
    paymentDetails: Record<string, unknown>,
  ) => unknown;

  try {
    const mod = await import('@x402/express' as string);
    paymentMiddleware = mod.paymentMiddleware ?? mod.default?.paymentMiddleware;
  } catch {
    throw new Error(
      'Trust API server requires @x402/express. Install it with: npm install @x402/express',
    );
  }

  if (!paymentMiddleware) {
    throw new Error(
      'Could not find paymentMiddleware export from @x402/express. Ensure you have a compatible version installed.',
    );
  }

  // Dynamic import of Express Router (deployer provides express)
  let Router: new () => unknown;
  try {
    const expressMod = await import('express' as string);
    Router = expressMod.Router ?? expressMod.default?.Router;
  } catch {
    throw new Error(
      'Trust API server requires express. Install it with: npm install express',
    );
  }

  if (!Router) {
    throw new Error(
      'Could not find Router export from express. Ensure you have a compatible version installed.',
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const router = (Router as any)();

  // Resolve chain configuration
  const chainId = apiConfig.chainId;
  const registryAddress =
    apiConfig.registryAddress ?? REGISTRY_ADDRESSES[chainId];
  if (!registryAddress) {
    throw new Error(
      `No registry address for chain ${chainId}. Pass registryAddress explicitly.`,
    );
  }
  const usdcAddress = USDC_ADDRESSES[chainId];
  if (!usdcAddress) {
    throw new Error(
      `USDC not available on chain ${chainId}. Supported: 8453 (Base).`,
    );
  }

  // Create a read-only client for on-chain queries
  const publicClient = createReadClient({
    chainId,
    rpcUrl: apiConfig.rpcUrl,
  });

  // Resolve x402 facilitator URL
  const facilitatorUrl = 'https://x402.org/facilitator';

  // Helper to build x402 payment details for an endpoint
  function makePaymentDetails(
    resource: string,
    price: string,
    description: string,
  ): Record<string, unknown> {
    const amountAtomic = String(Math.floor(parseFloat(price) * 1e6));
    return {
      scheme: 'exact',
      network: 'base',
      maxAmountRequired: amountAtomic,
      resource,
      description,
      payTo: apiConfig.paymentAddress,
      maxTimeoutSeconds: 300,
      asset: usdcAddress,
    };
  }

  // ── GET /v1/trust/:agentId ──
  router.get(
    '/v1/trust/:agentId',
    paymentMiddleware(
      facilitatorUrl,
      makePaymentDetails(
        '/v1/trust/:agentId',
        apiConfig.pricing.profileQuery,
        apiConfig.description ?? 'AEGIS Trust Profile query',
      ),
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (req: any, res: any) => {
      try {
        const agentId = BigInt(req.params.agentId);
        const profile = await buildTrustProfile(
          publicClient,
          registryAddress as Address,
          chainId,
          agentId,
        );
        res
          .type('json')
          .send(JSON.stringify(profile, serializeBigInts));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        res.status(500).json({ error: message });
      }
    },
  );

  // ── GET /v1/trust/skill/:skillHash ──
  router.get(
    '/v1/trust/skill/:skillHash',
    paymentMiddleware(
      facilitatorUrl,
      makePaymentDetails(
        '/v1/trust/skill/:skillHash',
        apiConfig.pricing.skillQuery,
        apiConfig.description ?? 'AEGIS Skill Trust query',
      ),
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (req: any, res: any) => {
      try {
        const skillHash = req.params.skillHash as `0x${string}`;
        const score = await buildSkillTrustScore(
          publicClient,
          registryAddress as Address,
          skillHash,
        );
        res
          .type('json')
          .send(JSON.stringify(score, serializeBigInts));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        res.status(500).json({ error: message });
      }
    },
  );

  // ── POST /v1/trust/batch ──
  router.post(
    '/v1/trust/batch',
    paymentMiddleware(
      facilitatorUrl,
      makePaymentDetails(
        '/v1/trust/batch',
        apiConfig.pricing.batchQuery,
        apiConfig.description ?? 'AEGIS Trust Profile batch query',
      ),
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (req: any, res: any) => {
      try {
        const { agentIds } = req.body as { agentIds?: string[] };
        if (!Array.isArray(agentIds) || agentIds.length === 0) {
          res.status(400).json({ error: 'agentIds array required' });
          return;
        }
        if (agentIds.length > MAX_BATCH_SIZE) {
          res.status(400).json({
            error: `Max ${MAX_BATCH_SIZE} agents per batch`,
          });
          return;
        }

        const ids = agentIds.map((id: string) => BigInt(id));
        const profiles = await batchBuildTrustProfiles(
          publicClient,
          registryAddress as Address,
          chainId,
          ids,
        );
        res
          .type('json')
          .send(JSON.stringify(profiles, serializeBigInts));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        res.status(500).json({ error: message });
      }
    },
  );

  return router;
}
