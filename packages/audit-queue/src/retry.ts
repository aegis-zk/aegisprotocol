/**
 * Compute the next retry timestamp using exponential backoff with jitter.
 *
 *   delay = baseDelayMs × 2^attempt + random(0..1000ms)
 *
 * Example (baseDelay=2000ms):
 *   attempt 0 → ~2s
 *   attempt 1 → ~4s
 *   attempt 2 → ~8s
 *   attempt 3 → ~16s
 *   attempt 4 → ~32s
 */
export function computeNextRetry(attempt: number, baseDelayMs: number): string {
  const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
  return new Date(Date.now() + delay).toISOString();
}
