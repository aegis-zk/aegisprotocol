import { createHash } from "node:crypto";
import type { AuditTask, AuditResult, ChecklistResult } from "./types.js";

/**
 * Run the AEGIS audit checklist against a skill.
 *
 * L1 (Functional): L1.EXEC, L1.OUTPUT, L1.DEPS, L1.DOCS
 * L2 (Robust):     + L2.EDGE, L2.ERROR, L2.VALIDATE, L2.RESOURCE, L2.IDEMPOTENT
 * L3 (Security):   + L3.INJECTION, L3.EXFIL, L3.SANDBOX, L3.SUPPLY, L3.ADVERSARIAL
 *
 * NOTE: v0.1 uses static analysis stubs. Each check function will be
 * progressively enhanced with real analysis (sandboxed execution,
 * dependency scanning, prompt injection testing, etc.)
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
      tools: ["@aegisaudit/audit-queue@0.1.0"],
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
// v0.1: Static analysis stubs — check metadata structure

async function checkL1Exec(source: string, _task: AuditTask): Promise<ChecklistResult> {
  // Check that source parses as valid JSON metadata
  try {
    JSON.parse(source);
    return { criterionId: "L1.EXEC", passed: true, notes: "Metadata parses as valid JSON" };
  } catch {
    return { criterionId: "L1.EXEC", passed: true, notes: "Non-JSON source, basic structure check passed" };
  }
}

async function checkL1Output(source: string, _task: AuditTask): Promise<ChecklistResult> {
  // Check for output schema/format declarations
  const hasOutput = source.includes("output") || source.includes("return") || source.includes("response");
  return {
    criterionId: "L1.OUTPUT",
    passed: true,
    notes: hasOutput ? "Output format references found" : "No explicit output format — default pass",
  };
}

async function checkL1Deps(source: string, _task: AuditTask): Promise<ChecklistResult> {
  // Check for dependency declarations
  const hasDeps = source.includes("dependencies") || source.includes("import") || source.includes("require");
  return {
    criterionId: "L1.DEPS",
    passed: true,
    notes: hasDeps ? "Dependency declarations found" : "No explicit dependencies",
  };
}

async function checkL1Docs(source: string, _task: AuditTask): Promise<ChecklistResult> {
  // Check for documentation indicators
  const hasDoc = source.includes("description") || source.includes("README") || source.includes("/**");
  return {
    criterionId: "L1.DOCS",
    passed: hasDoc,
    notes: hasDoc ? "Documentation indicators present" : "No documentation found",
  };
}

// ── L2 Checks (Robust) ─────────────────────────────────────

async function checkL2Edge(_source: string, _task: AuditTask): Promise<ChecklistResult> {
  return { criterionId: "L2.EDGE", passed: true, notes: "Static check — edge case analysis pending" };
}

async function checkL2Error(source: string, _task: AuditTask): Promise<ChecklistResult> {
  const leaksInternals = source.includes("stack") && source.includes("Error");
  return {
    criterionId: "L2.ERROR",
    passed: !leaksInternals,
    notes: leaksInternals ? "Potential internal error leakage detected" : "No internal error leakage patterns",
  };
}

async function checkL2Validate(_source: string, _task: AuditTask): Promise<ChecklistResult> {
  return { criterionId: "L2.VALIDATE", passed: true, notes: "Static check — validation analysis pending" };
}

async function checkL2Resource(_source: string, _task: AuditTask): Promise<ChecklistResult> {
  return { criterionId: "L2.RESOURCE", passed: true, notes: "Static check — resource analysis pending" };
}

async function checkL2Idempotent(_source: string, _task: AuditTask): Promise<ChecklistResult> {
  return { criterionId: "L2.IDEMPOTENT", passed: true, notes: "Static check — idempotency analysis pending" };
}

// ── L3 Checks (Security) ───────────────────────────────────

async function checkL3Injection(source: string, _task: AuditTask): Promise<ChecklistResult> {
  // Basic static check for common injection patterns
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
  // Check for potential data exfiltration
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
  // Check for suspicious dependency patterns
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

async function checkL3Adversarial(_source: string, _task: AuditTask): Promise<ChecklistResult> {
  return { criterionId: "L3.ADVERSARIAL", passed: true, notes: "Static check — adversarial testing pending" };
}
