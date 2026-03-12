/**
 * Paginated GraphQL client for the AEGIS subgraph.
 */

import type { SubgraphAuditor } from '../types.js';

const DEFAULT_URL =
  'https://api.studio.thegraph.com/query/1743315/aegis-protocol/v0.3.0';

const PAGE_SIZE = 1000;

async function query<T>(
  gql: string,
  variables: Record<string, unknown>,
  url: string,
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: gql, variables }),
  });

  if (!res.ok) {
    throw new Error(`Subgraph HTTP ${res.status}: ${await res.text()}`);
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

const AUDITORS_QUERY = `
  query AirdropSnapshot($minReputation: BigInt!, $first: Int!, $skip: Int!) {
    auditors(
      where: { registered: true, reputationScore_gte: $minReputation }
      orderBy: reputationScore
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      reputationScore
      currentStake
      attestationCount
      l2AttestationCount
      l3AttestationCount
      disputesLost
      disputesInvolved
      registered
      timestamp
      lastAttestationAt
    }
  }
`;

const META_QUERY = `{ _meta { block { number } } }`;

/**
 * Fetch all eligible auditors from the subgraph, paginated.
 */
export async function fetchAllAuditors(
  minReputation: bigint,
  url?: string,
): Promise<SubgraphAuditor[]> {
  const endpoint = url ?? process.env.AEGIS_SUBGRAPH_URL ?? DEFAULT_URL;
  const all: SubgraphAuditor[] = [];
  let skip = 0;

  while (true) {
    const data = await query<{ auditors: SubgraphAuditor[] }>(
      AUDITORS_QUERY,
      { minReputation: minReputation.toString(), first: PAGE_SIZE, skip },
      endpoint,
    );

    all.push(...data.auditors);

    if (data.auditors.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }

  return all;
}

/**
 * Get the latest indexed block number from the subgraph.
 */
export async function getIndexedBlock(url?: string): Promise<number> {
  const endpoint = url ?? process.env.AEGIS_SUBGRAPH_URL ?? DEFAULT_URL;
  const data = await query<{ _meta: { block: { number: number } } }>(
    META_QUERY,
    {},
    endpoint,
  );
  return data._meta.block.number;
}
