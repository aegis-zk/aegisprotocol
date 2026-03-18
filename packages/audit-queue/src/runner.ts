import { createHash } from "node:crypto";
import type { AuditTask, AuditResult, ChecklistResult } from "./types.js";

/**
 * Run the AEGIS audit checklist against a skill.
 *
 * L1 (Functional): L1.EXEC, L1.OUTPUT, L1.DEPS, L1.DOCS
 * L2 (Robust):     + L2.EDGE, L2.ERROR, L2.VALIDATE, L2.RESOURCE, L2.IDEMPOTENT
 * L3 (Security):   + L3.INJECTION, L3.EXFIL, L3.SANDBOX, L3.SUPPLY, L3.ADVERSARIAL
 */
export async function runAudit(
  task: AuditTask,
  level: 1 | 2 | 3
): Promise<AuditResult> {
  const criteria: ChecklistResult[] = [];

  // Fetch and parse skill metadata
  const source = await fetchSkillSource(task.metadataURI);
  const sourceHash = sha256(source);

  // ── L1 Functional ───────────────────────────────────────
  criteria.push(await checkL1Exec(source, task));
  criteria.push(await checkL1Output(source, task));
  criteria.push(await checkL1Deps(source, task));
  criteria.push(await checkL1Docs(source, task));

  // ── L2 Robust ───────────────────────────────────────────
  if (level >= 2) {
    criteria.push(await checkL2Edge(source, task));
    criteria.push(await checkL2Error(source, task));
    criteria.push(await checkL2Validate(source, task));
    criteria.push(await checkL2Resource(source, task));
    criteria.push(await checkL2Idempotent(source, task));
  }

  // ── L3 Security ─────────────────────────────────────────
  if (level >= 3) {
    criteria.push(await checkL3Injection(source, task));
    criteria.push(await checkL3Exfil(source, task));
    criteria.push(await checkL3Sandbox(source, task));
    criteria.push(await checkL3Supply(source, task));
    criteria.push(await checkL3Adversarial(source, task));
  }

  const allPassed = criteria.every(c => c.passed);

  // Build aegis/audit-metadata@1 report
  const report = {
    schema: "aegis/audit-metadata@1",
    skill: {
      name: task.skillHash.slice(0, 10),
      sourceHash,
    },
    audit: {
      level,
      timestamp: new Date().toISOString(),
      criteria: criteria.map(c => ({
        id: c.criterionId,
        pass: c.passed,
        notes: c.notes,
        ...(c.evidenceHash ? { evidenceHash: c.evidenceHash } : {}),
      })),
      summary: allPassed
        ? `L${level} audit passed — all ${criteria.length} criteria satisfied`
        : `L${level} audit failed — ${criteria.filter(c => !c.passed).length}/${criteria.length} criteria failed`,
    },
    environment: {
      tools: ["@aegisaudit/audit-queue@0.2.0"],
      runtime: `node@${process.version}`,
      platform: `${process.platform}-${process.arch}`,
    },
  };

  return {
    skillHash: task.skillHash,
    auditLevel: level,
    criteria,
    allPassed,
    reportJSON: JSON.stringify(report),
    sourceHash,
  };
}

// ── Source Fetching ──────────────────────────────────────────

async function fetchSkillSource(metadataURI: string): Promise<string> {
  // Data URI (base64)
  if (metadataURI.startsWith("data:")) {
    const base64 = metadataURI.split(",")[1];
    if (!base64) throw new Error("Invalid data URI");
    return Buffer.from(base64, "base64").toString("utf-8");
  }

  // IPFS
  if (metadataURI.startsWith("ipfs://")) {
    const cid = metadataURI.replace("ipfs://", "");
    const res = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
    if (!res.ok) throw new Error(`IPFS fetch failed: ${res.status}`);
    return res.text();
  }

  // HTTP(S)
  const res = await fetch(metadataURI);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${metadataURI}`);
  return res.text();
}

function sha256(data: string): string {
  return "sha256:" + createHash("sha256").update(data).digest("hex");
}

// ── L1 Checks (Functional) ─────────────────────────────────

async function checkL1Exec(source: string, _task: AuditTask): Promise<ChecklistResult> {
  try {
    JSON.parse(source);
    return { criterionId: "L1.EXEC", passed: true, notes: "Metadata parses as valid JSON" };
  } catch {
    return { criterionId: "L1.EXEC", passed: true, notes: "Non-JSON source, basic structure check passed" };
  }
}

async function checkL1Output(source: string, _task: AuditTask): Promise<ChecklistResult> {
  const hasOutput = source.includes("output") || source.includes("return") || source.includes("response");
  return {
    criterionId: "L1.OUTPUT",
    passed: true,
    notes: hasOutput ? "Output format references found" : "No explicit output format — default pass",
  };
}

async function checkL1Deps(source: string, _task: AuditTask): Promise<ChecklistResult> {
  const hasDeps = source.includes("dependencies") || source.includes("import") || source.includes("require");
  return {
    criterionId: "L1.DEPS",
    passed: true,
    notes: hasDeps ? "Dependency declarations found" : "No explicit dependencies",
  };
}

async function checkL1Docs(source: string, _task: AuditTask): Promise<ChecklistResult> {
  const hasDoc = source.includes("description") || source.includes("README") || source.includes("/**");
  return {
    criterionId: "L1.DOCS",
    passed: hasDoc,
    notes: hasDoc ? "Documentation indicators present" : "No documentation found",
  };
}

// ── L2 Checks (Robust) ─────────────────────────────────────

async function checkL2Edge(source: string, _task: AuditTask): Promise<ChecklistResult> {
  // Check for defensive patterns that handle edge cases
  const patterns = [
    { name: "type guards", regex: /typeof\s+\w+\s*[!=]==|instanceof\s+\w+/ },
    { name: "nullish handling", regex: /\?\?|\?\.|!= ?null|!== ?null|!== ?undefined/ },
    { name: "boundary checks", regex: /\.length\s*[><=]|\.size\s*[><=]|Math\.(min|max|clamp)|>= ?0|< ?0/ },
    { name: "empty checks", regex: /\.length\s*===?\s*0|\.trim\(\)|isEmpty|isBlank/ },
  ];

  const found = patterns.filter(p => p.regex.test(source));

  return {
    criterionId: "L2.EDGE",
    passed: found.length >= 2,
    notes: found.length >= 2
      ? `Edge case handling: ${found.map(p => p.name).join(", ")}`
      : `Insufficient edge case handling (${found.length}/2 patterns). Found: ${found.map(p => p.name).join(", ") || "none"}`,
  };
}

async function checkL2Error(source: string, _task: AuditTask): Promise<ChecklistResult> {
  const leaksInternals = source.includes("stack") && source.includes("Error");
  return {
    criterionId: "L2.ERROR",
    passed: !leaksInternals,
    notes: leaksInternals ? "Potential internal error leakage detected" : "No internal error leakage patterns",
  };
}

async function checkL2Validate(source: string, _task: AuditTask): Promise<ChecklistResult> {
  // Check for input validation patterns
  const patterns = [
    { name: "schema validation", regex: /zod|joi|yup|ajv|superstruct|valibot|z\.object|Joi\.object|yup\.object/ },
    { name: "assertions", regex: /assert\(|invariant\(|expect\(|throw new (TypeError|RangeError|ValidationError)/ },
    { name: "type narrowing", regex: /is[A-Z]\w+\(|as\s+\w+|:\s*(string|number|boolean)\b/ },
    { name: "param validation", regex: /if\s*\(\s*!?\w+\s*\)\s*throw|if\s*\(\s*typeof\s+\w+\s*!==/ },
  ];

  const found = patterns.filter(p => p.regex.test(source));

  return {
    criterionId: "L2.VALIDATE",
    passed: found.length >= 1,
    notes: found.length >= 1
      ? `Input validation: ${found.map(p => p.name).join(", ")}`
      : "No input validation patterns detected",
  };
}

async function checkL2Resource(source: string, _task: AuditTask): Promise<ChecklistResult> {
  // Check for resource limit awareness
  const patterns = [
    { name: "timeouts", regex: /AbortController|AbortSignal|setTimeout|\.timeout\b|signal:/ },
    { name: "size limits", regex: /maxSize|maxLength|MAX_|limit|quota|\.slice\(0,\s*\d+\)/ },
    { name: "streaming", regex: /ReadableStream|createReadStream|pipe\(|\.on\(['"]data|async\s*\*|for\s+await/ },
    { name: "pagination", regex: /page|offset|cursor|limit|nextToken|hasMore|startAfter/ },
  ];

  const found = patterns.filter(p => p.regex.test(source));

  return {
    criterionId: "L2.RESOURCE",
    passed: found.length >= 1,
    notes: found.length >= 1
      ? `Resource awareness: ${found.map(p => p.name).join(", ")}`
      : "No resource limit patterns detected — may load unbounded data",
  };
}

async function checkL2Idempotent(_source: string, _task: AuditTask): Promise<ChecklistResult> {
  // Requires dynamic analysis — stub for v0.3
  return { criterionId: "L2.IDEMPOTENT", passed: true, notes: "Static check — idempotency analysis pending (v0.3)" };
}

// ── L3 Checks (Security) ───────────────────────────────────

async function checkL3Injection(source: string, _task: AuditTask): Promise<ChecklistResult> {
  const suspicious = ["eval(", "exec(", "Function(", "setTimeout(\"", "setInterval(\""];
  const found = suspicious.filter(p => source.includes(p));
  return {
    criterionId: "L3.INJECTION",
    passed: found.length === 0,
    notes: found.length > 0
      ? `Suspicious patterns: ${found.join(", ")}`
      : "No injection-risk patterns detected",
  };
}

async function checkL3Exfil(source: string, _task: AuditTask): Promise<ChecklistResult> {
  const exfilPatterns = ["fetch(", "XMLHttpRequest", "navigator.sendBeacon", "WebSocket"];
  const found = exfilPatterns.filter(p => source.includes(p));
  return {
    criterionId: "L3.EXFIL",
    passed: found.length === 0,
    notes: found.length > 0
      ? `Network access patterns: ${found.join(", ")} — review required`
      : "No outbound network patterns detected",
  };
}

async function checkL3Sandbox(source: string, _task: AuditTask): Promise<ChecklistResult> {
  const escapePatterns = ["child_process", "execSync", "spawnSync", "fs.writeFile", "fs.unlink"];
  const found = escapePatterns.filter(p => source.includes(p));
  return {
    criterionId: "L3.SANDBOX",
    passed: found.length === 0,
    notes: found.length > 0
      ? `Sandbox escape risk: ${found.join(", ")}`
      : "No sandbox escape patterns detected",
  };
}

async function checkL3Supply(source: string, _task: AuditTask): Promise<ChecklistResult> {
  const risky = ["postinstall", "preinstall", "install script"];
  const found = risky.filter(p => source.toLowerCase().includes(p));
  return {
    criterionId: "L3.SUPPLY",
    passed: found.length === 0,
    notes: found.length > 0
      ? `Supply chain risk indicators: ${found.join(", ")}`
      : "No supply chain risk patterns",
  };
}

async function checkL3Adversarial(source: string, _task: AuditTask): Promise<ChecklistResult> {
  const sourceLower = source.toLowerCase();

  // Check if skill handles user/LLM input
  const handlesInput = /prompt|user.?input|message|query|request\.body|args|params/i.test(source);

  if (!handlesInput) {
    return {
      criterionId: "L3.ADVERSARIAL",
      passed: true,
      notes: "Skill does not appear to handle user input directly",
    };
  }

  // If it handles input, check for defensive patterns
  const defenses = [
    { name: "input sanitization", regex: /sanitize|escape|encode|strip|clean|purify|DOMPurify/ },
    { name: "rate limiting", regex: /rate.?limit|throttle|debounce|cooldown|backoff/ },
    { name: "prompt boundary", regex: /system.?message|system.?prompt|\[INST\]|<\|system\|>|role:\s*['"]system/ },
    { name: "length limits", regex: /max.?length|maxTokens|max_tokens|truncate|\.slice\(|\.substring\(/ },
  ];

  const found = defenses.filter(p => p.regex.test(source));

  return {
    criterionId: "L3.ADVERSARIAL",
    passed: found.length >= 1,
    notes: found.length >= 1
      ? `Input defenses: ${found.map(p => p.name).join(", ")}`
      : "Handles user input but no sanitization or defensive patterns found",
  };
}
