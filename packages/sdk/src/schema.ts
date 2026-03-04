/**
 * AEGIS Attestation Metadata Schema & Audit Level Standards.
 *
 * Defines the structured metadata format for skill attestations and the
 * specific evaluation criteria required at each audit level (L1/L2/L3).
 *
 * ## Overview
 *
 * When an auditor attests a skill, the metadata URI in the on-chain attestation
 * points to a JSON document conforming to `AuditMetadata`. This document records:
 *
 * - What skill was evaluated (name, version, source hash)
 * - What checks were performed (criteria checklist per audit level)
 * - What evidence supports the findings (test results, tool output hashes)
 * - Who performed the audit (auditor commitment, tooling used)
 *
 * The `auditCriteriaHash` stored on-chain is the keccak256 of the sorted
 * criteria IDs that the auditor claims to have checked. This creates a
 * verifiable link between the on-chain attestation and the off-chain metadata.
 *
 * ## Dispute Resolution
 *
 * When a dispute is opened, the challenger can reference specific criteria IDs
 * from the metadata. The dispute resolver checks whether the auditor's metadata
 * demonstrates that the claimed checks were actually performed. If the metadata
 * is missing, incomplete, or demonstrably false, the auditor is slashed.
 *
 * @module schema
 */

// ──────────────────────────────────────────────
//  Audit Level Definitions
// ──────────────────────────────────────────────

/**
 * L1 — Functional Audit
 *
 * Verifies that the skill executes correctly under normal conditions.
 * This is the baseline: does the skill do what it says it does?
 *
 * Required criteria:
 * - L1.EXEC    — Skill executes without error on provided test inputs
 * - L1.OUTPUT  — Output conforms to the declared schema/format
 * - L1.DEPS    — All dependencies are declared and resolvable
 * - L1.DOCS    — Skill has a description and usage documentation
 *
 * Evidence: Input/output hashes, execution logs
 */
export const L1_CRITERIA = {
  'L1.EXEC': 'Skill executes without error on provided test inputs',
  'L1.OUTPUT': 'Output conforms to the declared schema/format',
  'L1.DEPS': 'All dependencies are declared and resolvable',
  'L1.DOCS': 'Skill has a description and usage documentation',
} as const;

/**
 * L2 — Robust Audit
 *
 * All L1 criteria PLUS edge case handling, error states, and input validation.
 * Can this skill handle the real world, not just happy paths?
 *
 * Required criteria (in addition to all L1):
 * - L2.EDGE    — Handles boundary/edge case inputs gracefully
 * - L2.ERROR   — Returns meaningful errors without leaking internals
 * - L2.VALIDATE — Validates and sanitizes all inputs
 * - L2.RESOURCE — Operates within declared resource limits (time, memory, tokens)
 * - L2.IDEMPOTENT — Consistent results across repeated invocations
 *
 * Evidence: Test suite hash, edge case matrix, resource profiling output
 */
export const L2_CRITERIA = {
  ...L1_CRITERIA,
  'L2.EDGE': 'Handles boundary/edge case inputs gracefully',
  'L2.ERROR': 'Returns meaningful errors without leaking internal state',
  'L2.VALIDATE': 'Validates and sanitizes all inputs before processing',
  'L2.RESOURCE': 'Operates within declared resource limits (time, memory, tokens)',
  'L2.IDEMPOTENT': 'Produces consistent results across repeated invocations',
} as const;

/**
 * L3 — Security Audit
 *
 * All L1 + L2 criteria PLUS adversarial testing and security analysis.
 * Is this skill safe to run in an untrusted environment?
 *
 * Required criteria (in addition to all L1 + L2):
 * - L3.INJECTION — Resistant to prompt injection and instruction manipulation
 * - L3.EXFIL     — No unauthorized data exfiltration (network, filesystem, env vars)
 * - L3.SANDBOX   — Cannot escape execution sandbox or escalate privileges
 * - L3.SUPPLY    — Third-party dependencies audited for known vulnerabilities
 * - L3.ADVERSARIAL — Tested against adversarial/malicious input patterns
 *
 * Evidence: Security tool output hashes, adversarial test results, dependency audit report
 */
export const L3_CRITERIA = {
  ...L2_CRITERIA,
  'L3.INJECTION': 'Resistant to prompt injection and instruction manipulation',
  'L3.EXFIL': 'No unauthorized data exfiltration (network, filesystem, env vars)',
  'L3.SANDBOX': 'Cannot escape execution sandbox or escalate privileges',
  'L3.SUPPLY': 'Third-party dependencies audited for known vulnerabilities',
  'L3.ADVERSARIAL': 'Tested against adversarial/malicious input patterns',
} as const;

/** All possible criteria IDs */
export type CriteriaId = keyof typeof L3_CRITERIA;

/** Map from audit level to required criteria */
export const LEVEL_CRITERIA = {
  1: L1_CRITERIA,
  2: L2_CRITERIA,
  3: L3_CRITERIA,
} as const;

// ──────────────────────────────────────────────
//  Metadata Schema Types
// ──────────────────────────────────────────────

/** Result of a single criteria check */
export interface CriteriaResult {
  /** Criteria ID (e.g. "L1.EXEC", "L2.EDGE", "L3.INJECTION") */
  id: CriteriaId;
  /** Whether this criteria passed */
  pass: boolean;
  /** Human-readable notes on what was checked and findings */
  notes: string;
  /** SHA-256 hash of supporting evidence (logs, tool output, test results) */
  evidenceHash?: string;
}

/** Information about the skill being audited */
export interface SkillInfo {
  /** Human-readable skill name */
  name: string;
  /** Short description of what the skill does */
  description: string;
  /** Skill version string (semver recommended) */
  version: string;
  /** SHA-256 hash of the skill source code / definition at time of audit */
  sourceHash: string;
  /** Author or publisher (optional) */
  author?: string;
  /** Repository URL (optional) */
  repository?: string;
  /** Skill descriptor URL (e.g. https://flow.bid/skill/skill.md) */
  skillUrl?: string;
  /** Categorization tags */
  tags?: string[];
}

/** Information about the auditing environment and tools used */
export interface AuditEnvironment {
  /** Auditing tools/frameworks used (e.g. ["aegis-cli@0.1.0", "semgrep@1.90"]) */
  tools: string[];
  /** Runtime environment (e.g. "node@22.0.0", "python@3.12") */
  runtime?: string;
  /** Platform/OS (e.g. "linux-x64", "darwin-arm64") */
  platform?: string;
}

/**
 * Full audit metadata document.
 *
 * This is the JSON document stored at the metadataURI in the on-chain attestation.
 * It provides the complete record of what was audited and what was found.
 *
 * @example
 * ```json
 * {
 *   "schema": "aegis/audit-metadata@1",
 *   "skill": {
 *     "name": "Uniswap Swap Executor",
 *     "description": "Executes token swaps via Uniswap V3 router",
 *     "version": "1.2.0",
 *     "sourceHash": "sha256:ab3f...c901"
 *   },
 *   "audit": {
 *     "level": 2,
 *     "timestamp": "2026-03-03T12:00:00Z",
 *     "criteria": [
 *       { "id": "L1.EXEC", "pass": true, "notes": "Executed 50 swap scenarios, all returned valid tx hashes" },
 *       { "id": "L2.EDGE", "pass": true, "notes": "Tested zero-amount, max-uint, expired deadlines — all handled" }
 *     ]
 *   },
 *   "environment": {
 *     "tools": ["aegis-cli@0.2.2", "hardhat@2.22"]
 *   }
 * }
 * ```
 */
export interface AuditMetadata {
  /** Schema version identifier — always "aegis/audit-metadata@1" for v1 */
  schema: 'aegis/audit-metadata@1';

  /** Information about the skill being audited */
  skill: SkillInfo;

  /** Audit details and results */
  audit: {
    /** Audit level (1, 2, or 3) */
    level: 1 | 2 | 3;
    /** ISO 8601 timestamp of when the audit was performed */
    timestamp: string;
    /** Results for each criteria checked */
    criteria: CriteriaResult[];
    /** Overall summary / auditor's notes */
    summary?: string;
  };

  /** Auditing environment info */
  environment?: AuditEnvironment;
}

// ──────────────────────────────────────────────
//  Validation
// ──────────────────────────────────────────────

/** Validation result with specific error details */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate an audit metadata document against the AEGIS schema.
 *
 * Checks:
 * 1. Schema version is recognized
 * 2. All required fields are present
 * 3. All criteria required for the declared audit level are present
 * 4. All criteria results have valid IDs
 * 5. All required criteria pass (a valid attestation cannot have failing required criteria)
 *
 * @param metadata - The metadata document to validate
 * @returns Validation result with any errors
 *
 * @example
 * ```ts
 * import { validateAuditMetadata } from '@aegisaudit/sdk';
 *
 * const result = validateAuditMetadata(metadata);
 * if (!result.valid) {
 *   console.error('Invalid metadata:', result.errors);
 * }
 * ```
 */
export function validateAuditMetadata(metadata: unknown): ValidationResult {
  const errors: string[] = [];

  if (!metadata || typeof metadata !== 'object') {
    return { valid: false, errors: ['Metadata must be a non-null object'] };
  }

  const doc = metadata as Record<string, unknown>;

  // Schema version
  if (doc.schema !== 'aegis/audit-metadata@1') {
    errors.push(`Unknown schema version: "${doc.schema}". Expected "aegis/audit-metadata@1"`);
  }

  // Skill info
  if (!doc.skill || typeof doc.skill !== 'object') {
    errors.push('Missing required field: skill');
  } else {
    const skill = doc.skill as Record<string, unknown>;
    if (!skill.name || typeof skill.name !== 'string') errors.push('skill.name is required (string)');
    if (!skill.description || typeof skill.description !== 'string') errors.push('skill.description is required (string)');
    if (!skill.version || typeof skill.version !== 'string') errors.push('skill.version is required (string)');
    if (!skill.sourceHash || typeof skill.sourceHash !== 'string') errors.push('skill.sourceHash is required (string)');
  }

  // Audit section
  if (!doc.audit || typeof doc.audit !== 'object') {
    errors.push('Missing required field: audit');
    return { valid: errors.length === 0, errors };
  }

  const audit = doc.audit as Record<string, unknown>;

  // Audit level
  const level = audit.level as number;
  if (![1, 2, 3].includes(level)) {
    errors.push(`audit.level must be 1, 2, or 3. Got: ${level}`);
    return { valid: false, errors };
  }

  // Timestamp
  if (!audit.timestamp || typeof audit.timestamp !== 'string') {
    errors.push('audit.timestamp is required (ISO 8601 string)');
  }

  // Criteria checks
  if (!Array.isArray(audit.criteria)) {
    errors.push('audit.criteria must be an array');
    return { valid: false, errors };
  }

  const requiredCriteria = LEVEL_CRITERIA[level as 1 | 2 | 3];
  const requiredIds = new Set(Object.keys(requiredCriteria));
  const allValidIds = new Set(Object.keys(L3_CRITERIA));
  const presentIds = new Set<string>();

  for (const criterion of audit.criteria as CriteriaResult[]) {
    if (!criterion.id || typeof criterion.id !== 'string') {
      errors.push('Each criteria result must have a string "id" field');
      continue;
    }

    if (!allValidIds.has(criterion.id)) {
      errors.push(`Unknown criteria ID: "${criterion.id}"`);
      continue;
    }

    if (typeof criterion.pass !== 'boolean') {
      errors.push(`Criteria "${criterion.id}": pass must be a boolean`);
    }

    if (!criterion.notes || typeof criterion.notes !== 'string') {
      errors.push(`Criteria "${criterion.id}": notes is required (string)`);
    }

    // Required criteria must pass
    if (requiredIds.has(criterion.id) && criterion.pass === false) {
      errors.push(`Required criteria "${criterion.id}" did not pass. All criteria for L${level} must pass for a valid attestation.`);
    }

    presentIds.add(criterion.id);
  }

  // Check all required criteria are present
  for (const reqId of requiredIds) {
    if (!presentIds.has(reqId)) {
      errors.push(`Missing required criteria for L${level}: "${reqId}" — ${requiredCriteria[reqId as keyof typeof requiredCriteria]}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get the list of required criteria IDs for a given audit level.
 *
 * @param level - Audit level (1, 2, or 3)
 * @returns Array of criteria IDs required for that level
 *
 * @example
 * ```ts
 * import { getRequiredCriteria } from '@aegisaudit/sdk';
 *
 * const l2Criteria = getRequiredCriteria(2);
 * // ['L1.EXEC', 'L1.OUTPUT', 'L1.DEPS', 'L1.DOCS',
 * //  'L2.EDGE', 'L2.ERROR', 'L2.VALIDATE', 'L2.RESOURCE', 'L2.IDEMPOTENT']
 * ```
 */
export function getRequiredCriteria(level: 1 | 2 | 3): CriteriaId[] {
  return Object.keys(LEVEL_CRITERIA[level]) as CriteriaId[];
}

/**
 * Compute the auditCriteriaHash from a list of criteria IDs.
 *
 * This produces the same hash that should be stored on-chain in the attestation's
 * `auditCriteriaHash` field, creating a verifiable link between the on-chain
 * commitment and the off-chain metadata.
 *
 * Uses keccak256(abi.encodePacked(sorted criteria IDs joined by ",")):
 *   keccak256("L1.DEPS,L1.DOCS,L1.EXEC,L1.OUTPUT")
 *
 * @param criteriaIds - Array of criteria IDs to hash
 * @returns Hex-encoded keccak256 hash
 *
 * @example
 * ```ts
 * import { computeCriteriaHash } from '@aegisaudit/sdk';
 *
 * const hash = computeCriteriaHash(['L1.EXEC', 'L1.OUTPUT', 'L1.DEPS', 'L1.DOCS']);
 * // Use this as the auditCriteriaHash public input when generating the ZK proof
 * ```
 */
export function computeCriteriaHash(criteriaIds: CriteriaId[]): string {
  // Sort for deterministic ordering
  const sorted = [...criteriaIds].sort();
  const packed = sorted.join(',');

  // keccak256 — using a simple implementation to avoid adding dependencies
  // In production, use viem's keccak256 or ethers.keccak256
  return keccak256String(packed);
}

/**
 * Minimal keccak256 for string inputs.
 * Uses the same algorithm as Solidity's keccak256(abi.encodePacked(string)).
 *
 * For production use with viem:
 *   import { keccak256, toBytes } from 'viem';
 *   keccak256(toBytes(input));
 */
function keccak256String(input: string): string {
  // We use the Web Crypto API-compatible approach via a bundled keccak
  // Since this SDK already depends on viem, we import from there at runtime
  try {
    // Dynamic import to avoid circular deps — viem is a peer dep
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { keccak256, toHex } = require('viem') as {
      keccak256: (data: `0x${string}`) => `0x${string}`;
      toHex: (value: string) => `0x${string}`;
    };
    return keccak256(toHex(input));
  } catch {
    throw new Error(
      'viem is required for computeCriteriaHash(). Install it: pnpm add viem',
    );
  }
}

/**
 * Create a template AuditMetadata document for a given audit level.
 *
 * Returns a pre-populated metadata object with all required criteria set to
 * `pass: false` and placeholder notes. Auditors fill in the results as they
 * perform each check.
 *
 * @param level - Audit level (1, 2, or 3)
 * @param skillInfo - Information about the skill being audited
 * @returns Template AuditMetadata document
 *
 * @example
 * ```ts
 * import { createAuditTemplate } from '@aegisaudit/sdk';
 *
 * const template = createAuditTemplate(2, {
 *   name: 'Uniswap Swap Executor',
 *   description: 'Executes token swaps via Uniswap V3',
 *   version: '1.2.0',
 *   sourceHash: 'sha256:ab3f...c901',
 * });
 *
 * // Fill in results as you audit
 * template.audit.criteria[0].pass = true;
 * template.audit.criteria[0].notes = 'Executed 50 swap scenarios successfully';
 * ```
 */
export function createAuditTemplate(
  level: 1 | 2 | 3,
  skillInfo: SkillInfo,
): AuditMetadata {
  const criteria = LEVEL_CRITERIA[level];
  const criteriaResults: CriteriaResult[] = Object.entries(criteria).map(
    ([id, description]) => ({
      id: id as CriteriaId,
      pass: false,
      notes: `TODO: ${description}`,
    }),
  );

  return {
    schema: 'aegis/audit-metadata@1',
    skill: skillInfo,
    audit: {
      level,
      timestamp: new Date().toISOString(),
      criteria: criteriaResults,
    },
  };
}
