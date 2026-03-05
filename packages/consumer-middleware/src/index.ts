// Core
export { TrustGate, AegisTrustError } from './gate.js';

// Resolvers
export { SubgraphResolver } from './resolvers/subgraph.js';
export { OnchainResolver } from './resolvers/onchain.js';

// Types
export type {
  TrustPolicy,
  SkillMapping,
  TrustGateConfig,
  TrustGateResult,
  ResolvedTrustData,
  TrustResolver,
} from './types.js';
