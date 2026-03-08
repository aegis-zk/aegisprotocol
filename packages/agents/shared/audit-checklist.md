# AEGIS Audit Criteria Checklist

All 14 evaluation criteria across the three audit levels. Each higher level includes all criteria from the levels below it.

## L1 — Functional Audit (4 criteria)

Baseline verification: does the skill do what it says it does?

| ID | Description | What to Test | Pass Criteria | Suggested Tools |
|----|-------------|--------------|---------------|-----------------|
| `L1.EXEC` | Skill executes without error on provided test inputs | Run the skill with 3-5 representative inputs from the skill's documentation or examples | All invocations complete without uncaught exceptions or crashes | MCP tool runner, Node.js REPL |
| `L1.OUTPUT` | Output conforms to the declared schema/format | Compare actual output against the skill's declared response format (JSON schema, type annotations, docs) | Output structure, types, and required fields match the specification | JSON Schema validator, TypeScript type checker |
| `L1.DEPS` | All dependencies are declared and resolvable | Check package.json / import statements; run `npm install` in a clean environment | All imports resolve; no undeclared peer dependencies; `npm ls` shows no missing deps | `npm ls`, `npm install --dry-run` |
| `L1.DOCS` | Skill has a description and usage documentation | Verify skill has a human-readable description, input/output docs, and at least one usage example | Description exists and accurately describes functionality; example is runnable | Manual review |

## L2 — Robust Audit (5 additional criteria, 9 total)

Edge case handling, error states, and input validation.

| ID | Description | What to Test | Pass Criteria | Suggested Tools |
|----|-------------|--------------|---------------|-----------------|
| `L2.EDGE` | Handles boundary/edge case inputs gracefully | Test with: empty strings, null/undefined, very large inputs, Unicode/emoji, negative numbers, zero, max int | No crashes; returns meaningful error or handles gracefully | Fuzzer, manual test matrix |
| `L2.ERROR` | Returns meaningful errors without leaking internal state | Trigger errors with invalid inputs; inspect error messages | Errors are descriptive but don't expose file paths, stack traces, env vars, or API keys | Manual review, grep for path patterns |
| `L2.VALIDATE` | Validates and sanitizes all inputs before processing | Send malformed inputs: wrong types, extra fields, missing required fields, oversized payloads | Inputs are validated before execution; clear validation error messages returned | Schema validator, type coercion tests |
| `L2.RESOURCE` | Operates within declared resource limits (time, memory, tokens) | Measure execution time and memory for normal and large inputs; check for unbounded loops/recursion | Completes within reasonable time (<30s for most tools); no memory leaks; no runaway token usage | `time`, `process.memoryUsage()`, profiler |
| `L2.IDEMPOTENT` | Produces consistent results across repeated invocations | Run the same input 5+ times; compare outputs (accounting for timestamps/random IDs) | Deterministic core output; any non-deterministic fields are clearly documented | Diff tool, hash comparison |

## L3 — Security Audit (5 additional criteria, 14 total)

Adversarial testing and security analysis.

| ID | Description | What to Test | Pass Criteria | Suggested Tools |
|----|-------------|--------------|---------------|-----------------|
| `L3.INJECTION` | Resistant to prompt injection and instruction manipulation | Test with prompt injection payloads: "ignore previous instructions", system prompt overrides, instruction smuggling in data fields | Skill does not execute injected instructions; output is unaffected by injection attempts | Manual injection tests, prompt injection datasets |
| `L3.EXFIL` | No unauthorized data exfiltration (network, filesystem, env vars) | Audit code for: outbound HTTP calls, filesystem reads outside working dir, `process.env` access, DNS exfil | No unauthorized network calls; no env var access; no filesystem reads outside declared scope | `semgrep`, network traffic monitor, `strace`/`ltrace` |
| `L3.SANDBOX` | Cannot escape execution sandbox or escalate privileges | Test for: `eval()`, `Function()`, `child_process`, `require()` of system modules, prototype pollution | No dynamic code execution; no shell spawning; no privilege escalation vectors | `semgrep`, `eslint-plugin-security`, AST analysis |
| `L3.SUPPLY` | Third-party dependencies audited for known vulnerabilities | Run dependency vulnerability scanners; check for typosquatting, abandoned packages, excessive permissions | No known critical/high CVEs; no suspicious packages; all deps have recent maintenance | `npm audit`, `snyk test`, `socket.dev` |
| `L3.ADVERSARIAL` | Tested against adversarial/malicious input patterns | Test with: SQL injection strings, XSS payloads, path traversal (`../`), null bytes, format strings, oversized payloads designed to cause OOM | All adversarial inputs handled safely; no code execution, path traversal, or resource exhaustion | OWASP test vectors, `wfuzz`, custom payloads |

## Level Summary

| Level | Criteria Count | Includes | Focus |
|-------|---------------|----------|-------|
| L1 | 4 | L1 only | Does it work? |
| L2 | 9 | L1 + L2 | Does it handle the real world? |
| L3 | 14 | L1 + L2 + L3 | Is it safe to run untrusted? |

## On-Chain Representation

The criteria IDs are hashed on-chain as `auditCriteriaHash`:

```
keccak256(abi.encodePacked("L1.DEPS,L1.DOCS,L1.EXEC,L1.OUTPUT"))  // L1
keccak256(abi.encodePacked("L1.DEPS,L1.DOCS,L1.EXEC,L1.OUTPUT,L2.EDGE,L2.ERROR,L2.IDEMPOTENT,L2.RESOURCE,L2.VALIDATE"))  // L2
keccak256(abi.encodePacked("L1.DEPS,...,L2.VALIDATE,L3.ADVERSARIAL,L3.EXFIL,L3.INJECTION,L3.SANDBOX,L3.SUPPLY"))  // L3
```

Criteria IDs are **sorted alphabetically** before hashing. Use `computeCriteriaHash()` from `@aegisaudit/sdk` to generate the correct hash.
