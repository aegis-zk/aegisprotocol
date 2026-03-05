/**
 * CrewAI adapter for AEGIS TrustGate.
 *
 * Provides a hook function compatible with CrewAI's before-tool-call pattern.
 *
 * @example
 * ```ts
 * import { TrustGate } from '@aegisaudit/consumer-middleware';
 * import { createAegisTrustHook } from '@aegisaudit/consumer-middleware/crewai';
 *
 * const gate = new TrustGate({ policy: { minAuditLevel: 2 }, skills: [...] });
 * const hook = createAegisTrustHook(gate);
 *
 * // Register with CrewAI
 * crew.registerBeforeToolCallHook(hook);
 * ```
 *
 * @module
 */

import type { TrustGate } from '../gate.js';
import { AegisTrustError } from '../gate.js';

/**
 * Create a CrewAI-compatible before-tool-call hook.
 *
 * In `enforce` mode, throws `AegisTrustError` to block untrusted tool calls.
 * In `warn` or `log` mode, logs but allows execution.
 */
export function createAegisTrustHook(
  gate: TrustGate,
): (toolName: string, args: unknown) => Promise<void> {
  return async (toolName: string, _args: unknown): Promise<void> => {
    const result = await gate.check(toolName);

    if (!result.allowed) {
      throw new AegisTrustError(result);
    }
  };
}
