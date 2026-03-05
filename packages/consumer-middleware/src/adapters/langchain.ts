/**
 * LangChain adapter for AEGIS TrustGate.
 *
 * Provides a callback handler that intercepts tool calls and checks
 * AEGIS trust before allowing execution.
 *
 * @example
 * ```ts
 * import { TrustGate } from '@aegisaudit/consumer-middleware';
 * import { createAegisTrustHandler } from '@aegisaudit/consumer-middleware/langchain';
 *
 * const gate = new TrustGate({ policy: { minAuditLevel: 2 }, skills: [...] });
 * const handler = createAegisTrustHandler(gate);
 *
 * // Attach to LangChain agent
 * const agent = new AgentExecutor({ callbacks: [handler] });
 * ```
 *
 * @module
 */

import type { TrustGate } from '../gate.js';
import { AegisTrustError } from '../gate.js';

// Minimal LangChain callback interface to avoid hard dependency.
// At runtime, the actual @langchain/core types are used.
interface LangChainCallbackHandler {
  name: string;
  handleToolStart?: (
    tool: { id?: string[]; name?: string },
    input: string,
    runId: string,
  ) => Promise<void>;
}

/**
 * Create a LangChain callback handler that enforces AEGIS trust policies.
 *
 * In `enforce` mode, throws `AegisTrustError` if the tool fails the trust check,
 * preventing LangChain from executing the tool call.
 */
export function createAegisTrustHandler(gate: TrustGate): LangChainCallbackHandler {
  return {
    name: 'AegisTrustHandler',

    async handleToolStart(
      tool: { id?: string[]; name?: string },
      _input: string,
    ): Promise<void> {
      const toolName = tool.name ?? tool.id?.[tool.id.length - 1] ?? 'unknown';
      const result = await gate.check(toolName);

      if (!result.allowed) {
        throw new AegisTrustError(result);
      }
    },
  };
}
