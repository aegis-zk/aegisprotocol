import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Serialize a value to JSON, converting all bigint values to strings.
 * Bigints are converted to string representations to maintain precision
 * (e.g., 38210000n becomes "38210000").
 */
export function serializeResult(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    typeof v === 'bigint' ? v.toString() : v,
  );
}

/**
 * Wrap an async tool handler with standardized error handling.
 * On-chain errors (reverts, RPC failures) are caught and returned
 * as MCP text content with isError: true.
 */
export async function handleToolCall(
  fn: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: message,
            hint: message.includes('No registry address')
              ? 'Set AEGIS_CHAIN_ID to a supported chain (8453 for Base) or provide AEGIS_REGISTRY.'
              : message.includes('execution reverted')
                ? 'The on-chain call reverted. The skill hash or attestation index may not exist.'
                : undefined,
          }),
        },
      ],
    };
  }
}
