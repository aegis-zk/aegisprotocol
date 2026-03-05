import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrustGate, AegisTrustError } from '../src/gate.js';
import type {
  TrustResolver,
  ResolvedTrustData,
  TrustGateConfig,
} from '../src/types.js';
import type { Hex } from '@aegisaudit/sdk';

// ── Mock resolver ──────────────────────────────────────

class MockResolver implements TrustResolver {
  private data: Map<string, ResolvedTrustData | null> = new Map();

  set(skillHash: string, data: ResolvedTrustData | null): void {
    this.data.set(skillHash, data);
  }

  async resolve(skillHash: Hex): Promise<ResolvedTrustData | null> {
    return this.data.get(skillHash) ?? null;
  }
}

// ── Helper to create a TrustGate with mock resolver ────

function createTestGate(
  config: Partial<TrustGateConfig> & { resolver: MockResolver },
): TrustGate {
  const gate = new TrustGate({
    policy: config.policy ?? {},
    skills: config.skills ?? [],
    subgraphUrl: 'http://mock-subgraph',
    cacheTtlMs: 0, // Disable cache for tests
    ...config,
  });

  // Inject the mock resolver as the primary resolver
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (gate as any).primary = config.resolver;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (gate as any).fallback = config.resolver;

  return gate;
}

const SKILL_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex;
const SKILL_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Hex;

// ── Tests ──────────────────────────────────────────────

describe('TrustGate', () => {
  let resolver: MockResolver;

  beforeEach(() => {
    resolver = new MockResolver();
  });

  describe('unmapped tools', () => {
    it('allows tools without a skill mapping', async () => {
      const gate = createTestGate({
        resolver,
        skills: [{ toolName: 'mapped_tool', skillHash: SKILL_A }],
      });

      const result = await gate.check('unmapped_tool');
      expect(result.allowed).toBe(true);
    });
  });

  describe('skill not found', () => {
    it('blocks when skill is not in registry (enforce mode)', async () => {
      const gate = createTestGate({
        resolver,
        policy: { mode: 'enforce' },
        skills: [{ toolName: 'my_tool', skillHash: SKILL_A }],
      });

      const result = await gate.check('my_tool');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('allows when skill is not found in warn mode', async () => {
      const gate = createTestGate({
        resolver,
        policy: { mode: 'warn' },
        skills: [{ toolName: 'my_tool', skillHash: SKILL_A }],
      });

      const result = await gate.check('my_tool');
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('not found');
    });
  });

  describe('audit level checks', () => {
    it('allows when audit level meets minimum', async () => {
      resolver.set(SKILL_A, {
        highestLevel: 2,
        attestationCount: 1,
        hasActiveDisputes: false,
      });

      const gate = createTestGate({
        resolver,
        policy: { minAuditLevel: 2 },
        skills: [{ toolName: 'my_tool', skillHash: SKILL_A }],
      });

      const result = await gate.check('my_tool');
      expect(result.allowed).toBe(true);
    });

    it('blocks when audit level is below minimum', async () => {
      resolver.set(SKILL_A, {
        highestLevel: 1,
        attestationCount: 1,
        hasActiveDisputes: false,
      });

      const gate = createTestGate({
        resolver,
        policy: { minAuditLevel: 2, mode: 'enforce' },
        skills: [{ toolName: 'my_tool', skillHash: SKILL_A }],
      });

      const result = await gate.check('my_tool');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Audit level 1 < required 2');
    });
  });

  describe('attestation count checks', () => {
    it('blocks when attestation count is below minimum', async () => {
      resolver.set(SKILL_A, {
        highestLevel: 3,
        attestationCount: 1,
        hasActiveDisputes: false,
      });

      const gate = createTestGate({
        resolver,
        policy: { minAttestations: 3, mode: 'enforce' },
        skills: [{ toolName: 'my_tool', skillHash: SKILL_A }],
      });

      const result = await gate.check('my_tool');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Attestation count 1 < required 3');
    });

    it('allows when attestation count meets minimum', async () => {
      resolver.set(SKILL_A, {
        highestLevel: 1,
        attestationCount: 5,
        hasActiveDisputes: false,
      });

      const gate = createTestGate({
        resolver,
        policy: { minAttestations: 3 },
        skills: [{ toolName: 'my_tool', skillHash: SKILL_A }],
      });

      const result = await gate.check('my_tool');
      expect(result.allowed).toBe(true);
    });
  });

  describe('dispute checks', () => {
    it('blocks when skill has active disputes (blockOnDispute=true)', async () => {
      resolver.set(SKILL_A, {
        highestLevel: 3,
        attestationCount: 5,
        hasActiveDisputes: true,
      });

      const gate = createTestGate({
        resolver,
        policy: { blockOnDispute: true, mode: 'enforce' },
        skills: [{ toolName: 'my_tool', skillHash: SKILL_A }],
      });

      const result = await gate.check('my_tool');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('unresolved disputes');
    });

    it('allows when blockOnDispute is false despite active disputes', async () => {
      resolver.set(SKILL_A, {
        highestLevel: 3,
        attestationCount: 5,
        hasActiveDisputes: true,
      });

      const gate = createTestGate({
        resolver,
        policy: { blockOnDispute: false },
        skills: [{ toolName: 'my_tool', skillHash: SKILL_A }],
      });

      const result = await gate.check('my_tool');
      expect(result.allowed).toBe(true);
    });
  });

  describe('enforcement modes', () => {
    const failingTrustData: ResolvedTrustData = {
      highestLevel: 1,
      attestationCount: 1,
      hasActiveDisputes: false,
    };

    it('enforce mode blocks and calls onBlock', async () => {
      resolver.set(SKILL_A, failingTrustData);
      const onBlock = vi.fn();

      const gate = createTestGate({
        resolver,
        policy: { minAuditLevel: 3, mode: 'enforce' },
        skills: [{ toolName: 'my_tool', skillHash: SKILL_A }],
        onBlock,
      });

      const result = await gate.check('my_tool');
      expect(result.allowed).toBe(false);
      expect(onBlock).toHaveBeenCalledOnce();
    });

    it('warn mode allows and calls onWarn', async () => {
      resolver.set(SKILL_A, failingTrustData);
      const onWarn = vi.fn();

      const gate = createTestGate({
        resolver,
        policy: { minAuditLevel: 3, mode: 'warn' },
        skills: [{ toolName: 'my_tool', skillHash: SKILL_A }],
        onWarn,
      });

      const result = await gate.check('my_tool');
      expect(result.allowed).toBe(true);
      expect(onWarn).toHaveBeenCalledOnce();
    });

    it('log mode allows silently', async () => {
      resolver.set(SKILL_A, failingTrustData);

      const gate = createTestGate({
        resolver,
        policy: { minAuditLevel: 3, mode: 'log' },
        skills: [{ toolName: 'my_tool', skillHash: SKILL_A }],
      });

      const result = await gate.check('my_tool');
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkHash', () => {
    it('checks directly by skill hash', async () => {
      resolver.set(SKILL_B, {
        highestLevel: 2,
        attestationCount: 3,
        hasActiveDisputes: false,
      });

      const gate = createTestGate({
        resolver,
        policy: { minAuditLevel: 1 },
        skills: [],
      });

      const result = await gate.checkHash(SKILL_B);
      expect(result.allowed).toBe(true);
      expect(result.trustData?.highestLevel).toBe(2);
    });
  });

  describe('updatePolicy', () => {
    it('updates policy at runtime', async () => {
      resolver.set(SKILL_A, {
        highestLevel: 1,
        attestationCount: 1,
        hasActiveDisputes: false,
      });

      const gate = createTestGate({
        resolver,
        policy: { minAuditLevel: 1, mode: 'enforce' },
        skills: [{ toolName: 'my_tool', skillHash: SKILL_A }],
      });

      // Should pass with L1
      let result = await gate.check('my_tool');
      expect(result.allowed).toBe(true);

      // Tighten policy
      gate.updatePolicy({ minAuditLevel: 3 });

      result = await gate.check('my_tool');
      expect(result.allowed).toBe(false);
    });
  });

  describe('multiple skills', () => {
    it('checks different skills independently', async () => {
      resolver.set(SKILL_A, {
        highestLevel: 3,
        attestationCount: 5,
        hasActiveDisputes: false,
      });
      resolver.set(SKILL_B, {
        highestLevel: 1,
        attestationCount: 1,
        hasActiveDisputes: false,
      });

      const gate = createTestGate({
        resolver,
        policy: { minAuditLevel: 2, mode: 'enforce' },
        skills: [
          { toolName: 'tool_a', skillHash: SKILL_A },
          { toolName: 'tool_b', skillHash: SKILL_B },
        ],
      });

      const resultA = await gate.check('tool_a');
      expect(resultA.allowed).toBe(true);

      const resultB = await gate.check('tool_b');
      expect(resultB.allowed).toBe(false);
    });
  });
});

describe('AegisTrustError', () => {
  it('includes the TrustGateResult', () => {
    const result = {
      toolName: 'my_tool',
      skillHash: SKILL_A,
      allowed: false as const,
      reason: 'test reason',
    };

    const error = new AegisTrustError(result);
    expect(error.name).toBe('AegisTrustError');
    expect(error.message).toContain('my_tool');
    expect(error.message).toContain('test reason');
    expect(error.result).toEqual(result);
  });
});
