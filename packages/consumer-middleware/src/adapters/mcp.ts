/**
 * MCP adapter for AEGIS TrustGate.
 *
 * Wraps an MCP server's tool call handler with trust verification.
 *
 * @example
 * ```ts
 * import { TrustGate } from '@aegisaudit/consumer-middleware';
 * import { aegisMcpMiddleware } from '@aegisaudit/consumer-middleware/mcp';
 *
 * const gate = new TrustGate({ policy: { minAuditLevel: 2 }, skills: [...] });
 *
 * // Wrap tool call handler
 * server.setRequestHandler(CallToolRequestSchema, aegisMcpMiddleware(gate, async (request) => {
 *   // Original tool handler
 *   return { content: [{ type: 'text', text: 'result' }] };
 * }));
 * ```
 *
 * @module
 */

import type { TrustGate } from '../gate.js';

interface McpToolCallRequest {
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

interface McpToolCallResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

type McpToolHandler = (request: McpToolCallRequest) => Promise<McpToolCallResult>;

/**
 * Create an MCP middleware that wraps a tool call handler with AEGIS trust checks.
 *
 * In `enforce` mode, returns an error result instead of executing the tool.
 * In `warn` or `log` mode, logs but proceeds to the original handler.
 */
export function aegisMcpMiddleware(
  gate: TrustGate,
  handler: McpToolHandler,
): McpToolHandler {
  return async (request: McpToolCallRequest): Promise<McpToolCallResult> => {
    const toolName = request.params.name;
    const result = await gate.check(toolName);

    if (!result.allowed) {
      return {
        content: [
          {
            type: 'text',
            text: `AEGIS trust check failed: ${result.reason}`,
          },
        ],
        isError: true,
      };
    }

    return handler(request);
  };
}
