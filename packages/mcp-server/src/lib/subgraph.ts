/**
 * Lightweight GraphQL client for the AEGIS subgraph.
 *
 * Uses native `fetch` — no additional dependencies required.
 * Override the endpoint via the AEGIS_SUBGRAPH_URL environment variable.
 */

const SUBGRAPH_URL =
  process.env.AEGIS_SUBGRAPH_URL ??
  'https://api.studio.thegraph.com/query/1743315/aegis-protocol/v0.2.0';

/**
 * Execute a GraphQL query against the AEGIS subgraph.
 *
 * @param query - GraphQL query string
 * @param variables - Optional query variables
 * @returns Parsed `data` field from the response, typed as `T`
 * @throws On HTTP errors or GraphQL-level errors
 */
export async function querySubgraph<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Subgraph query failed (HTTP ${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(`Subgraph error: ${json.errors[0].message}`);
  }

  if (!json.data) {
    throw new Error('Subgraph returned no data');
  }

  return json.data;
}
