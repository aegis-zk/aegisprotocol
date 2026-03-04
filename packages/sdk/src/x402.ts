/**
 * x402 (HTTP 402) payment utilities for AEGIS Protocol.
 *
 * Enables pay-per-audit micropayments using Coinbase's x402 protocol.
 * Auditors can expose x402-enabled endpoints; publishers pay in USDC on Base.
 *
 * Requires optional peer dependencies: @x402/fetch, @x402/express
 */

import type { Address, X402PaymentRequirement, X402AuditorConfig } from './types';
import { USDC_ADDRESSES } from './erc8004-constants';

// ──────────────────────────────────────────────
//  x402 Client — wraps fetch with auto-payment
// ──────────────────────────────────────────────

/**
 * Create a fetch wrapper that handles x402 payment flows automatically.
 *
 * When a request returns HTTP 402 with payment requirements,
 * the wrapper pays on-chain and retries with the X-PAYMENT header.
 *
 * @param walletClient - A viem WalletClient with signing capability
 * @returns A fetch-compatible function with x402 auto-payment
 *
 * @example
 * ```ts
 * import { createX402Fetch } from '@aegisaudit/sdk';
 * import { createWalletClient, http } from 'viem';
 *
 * const wallet = createWalletClient({ ... });
 * const x402Fetch = await createX402Fetch(wallet);
 *
 * // Automatically handles 402 responses with on-chain payment
 * const response = await x402Fetch('https://auditor.example.com/api/audit', {
 *   method: 'POST',
 *   body: JSON.stringify({ skillHash: '0x...' }),
 * });
 * ```
 */
export async function createX402Fetch(
  walletClient: unknown,
): Promise<typeof globalThis.fetch> {
  let wrapFetch: (fetch: typeof globalThis.fetch, walletClient: unknown) => typeof globalThis.fetch;

  try {
    const mod = await import('@x402/fetch' as string);
    wrapFetch = mod.wrapFetch ?? mod.default?.wrapFetch;
  } catch {
    throw new Error(
      'x402 payments require the @x402/fetch package. Install it with: npm install @x402/fetch',
    );
  }

  if (!wrapFetch) {
    throw new Error(
      'Could not find wrapFetch export from @x402/fetch. Ensure you have a compatible version installed.',
    );
  }

  return wrapFetch(globalThis.fetch, walletClient);
}

// ──────────────────────────────────────────────
//  x402 Server — auditor endpoint helpers
// ──────────────────────────────────────────────

/**
 * Create an x402 payment configuration for an auditor endpoint.
 *
 * Returns the configuration object to pass to the @x402/express middleware.
 * The auditor hosts an HTTP endpoint; the middleware automatically handles
 * 402 responses and payment verification.
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { paymentMiddleware } from '@x402/express';
 * import { createAuditPaymentConfig } from '@aegisaudit/sdk';
 *
 * const app = express();
 * const config = createAuditPaymentConfig({
 *   paymentAddress: '0xYourAddress...',
 *   priceUsdc: '5.00',
 *   supportedLevels: [1, 2, 3],
 * });
 *
 * app.post('/api/audit',
 *   paymentMiddleware(config.facilitatorUrl, config.paymentDetails),
 *   (req, res) => { ... }
 * );
 * ```
 */
export function createAuditPaymentConfig(
  config: X402AuditorConfig & { chainId?: number },
): {
  facilitatorUrl: string;
  paymentDetails: X402PaymentRequirement;
} {
  const chainId = config.chainId ?? 8453;
  const usdcAddress = USDC_ADDRESSES[chainId];
  if (!usdcAddress) {
    throw new Error(`USDC not available on chain ${chainId}. Supported: 8453 (Base), 84532 (Base Sepolia).`);
  }

  // Convert USDC amount to 6-decimal string (e.g., "5.00" → "5000000")
  const amountAtomicStr = String(Math.floor(parseFloat(config.priceUsdc) * 1e6));

  return {
    facilitatorUrl: chainId === 84532
      ? 'https://x402.org/facilitator/testnet'
      : 'https://x402.org/facilitator',
    paymentDetails: {
      scheme: 'exact',
      network: chainId === 84532 ? 'base-sepolia' : 'base',
      maxAmountRequired: amountAtomicStr,
      resource: '/api/audit',
      description: config.description ?? `AEGIS audit (levels: ${config.supportedLevels.join(', ')})`,
      payTo: config.paymentAddress,
      maxTimeoutSeconds: 300,
      asset: usdcAddress,
    },
  };
}

// ──────────────────────────────────────────────
//  Trust API Client — typed client for x402-gated trust endpoints
// ──────────────────────────────────────────────

import type { TrustProfile, SkillTrustScore, TrustApiClient, Hex } from './types';

/**
 * Create a typed client for consuming the x402-gated Trust Profile API.
 *
 * Wraps fetch with x402 auto-payment (via @x402/fetch) and provides
 * typed methods for each trust API endpoint.
 *
 * Note: BigInt fields in the returned objects will be strings (due to JSON
 * serialization). Convert with BigInt() if needed for arithmetic.
 *
 * @param walletClient - A viem WalletClient with signing capability for USDC payments
 * @param baseUrl - Base URL of the trust API server (e.g. "https://trust.aegisprotocol.tech")
 * @returns A TrustApiClient with typed methods
 *
 * @example
 * ```ts
 * import { createTrustApiClient } from '@aegisaudit/sdk';
 *
 * const trustApi = await createTrustApiClient(walletClient, 'https://trust.aegisprotocol.tech');
 *
 * // Pay 10c USDC, get a full trust profile
 * const profile = await trustApi.getProfile(42n);
 * console.log(profile.overall.trustScore); // 0-100
 * console.log(profile.overall.level);      // 'trusted'
 *
 * // Get trust data for a single skill
 * const skill = await trustApi.getSkillTrust('0x1234...abcd');
 *
 * // Batch query multiple agents
 * const profiles = await trustApi.batchProfiles([1n, 2n, 3n]);
 * ```
 */
export async function createTrustApiClient(
  walletClient: unknown,
  baseUrl: string,
): Promise<TrustApiClient> {
  const x402Fetch = await createX402Fetch(walletClient);

  // Normalize base URL (strip trailing slash)
  const base = baseUrl.replace(/\/$/, '');

  // Helper to parse response
  async function parseResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Trust API error (${response.status}): ${body}`);
    }
    return response.json() as Promise<T>;
  }

  return {
    async getProfile(agentId: bigint): Promise<TrustProfile> {
      const response = await x402Fetch(
        `${base}/v1/trust/${agentId.toString()}`,
      );
      return parseResponse<TrustProfile>(response);
    },

    async getSkillTrust(skillHash: Hex): Promise<SkillTrustScore> {
      const response = await x402Fetch(
        `${base}/v1/trust/skill/${skillHash}`,
      );
      return parseResponse<SkillTrustScore>(response);
    },

    async batchProfiles(agentIds: bigint[]): Promise<TrustProfile[]> {
      const response = await x402Fetch(`${base}/v1/trust/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentIds: agentIds.map((id) => id.toString()),
        }),
      });
      return parseResponse<TrustProfile[]>(response);
    },
  };
}

// ──────────────────────────────────────────────
//  Re-export USDC addresses for convenience
// ──────────────────────────────────────────────

export { USDC_ADDRESSES } from './erc8004-constants';
