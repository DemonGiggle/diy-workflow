const REF_PATTERN = /^{{\s*steps\.([A-Za-z0-9_-]+)\.output(?:\.([A-Za-z0-9_.-]+))?\s*}}$/;
const REF_SCAN_PATTERN = /{{\s*steps\.([A-Za-z0-9_-]+)\.output(?:\.([A-Za-z0-9_.-]+))?\s*}}/g;

export interface StepOutputRecord {
  output: unknown;
}

export interface Reference {
  stepId: string;
  path: string[];
}

export function extractReferences(value: unknown): Reference[] {
  const refs: Reference[] = [];
  visit(value, refs);
  return refs;
}

export function resolveReferences(value: unknown, steps: Map<string, StepOutputRecord>): unknown {
  if (typeof value === "string") {
    return resolveString(value, steps);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveReferences(item, steps));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveReferences(item, steps)]),
    );
  }
  return value;
}

function visit(value: unknown, refs: Reference[]): void {
  if (typeof value === "string") {
    for (const match of value.matchAll(REF_SCAN_PATTERN)) {
      refs.push({ stepId: match[1]!, path: match[2] ? match[2].split(".") : [] });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) visit(item, refs);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) visit(item, refs);
  }
}

function resolveString(value: string, steps: Map<string, StepOutputRecord>): unknown {
  const whole = REF_PATTERN.exec(value);
  if (whole) {
    return lookup(whole[1]!, whole[2] ? whole[2].split(".") : [], steps);
  }

  return value.replace(REF_SCAN_PATTERN, (_all, stepId: string, pathValue: string | undefined) => {
    const resolved = lookup(stepId, pathValue ? pathValue.split(".") : [], steps);
    return stringifyInline(resolved);
  });
}

function lookup(stepId: string, path: string[], steps: Map<string, StepOutputRecord>): unknown {
  const record = steps.get(stepId);
  if (!record) throw new Error(`Reference points to unavailable step: ${stepId}`);
  let current = record.output;
  for (const part of path) {
    if (!current || typeof current !== "object" || !(part in current)) {
      throw new Error(`Reference path not found: steps.${stepId}.output.${path.join(".")}`);
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function stringifyInline(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

