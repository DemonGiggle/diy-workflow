import type { RunTrace, StdoutTraceOutput } from "../types.js";

export interface StdoutRunEntry extends StdoutTraceOutput {
  stepId: string;
}

export function listStdoutEntries(trace: RunTrace | null): StdoutRunEntry[] {
  if (!trace) return [];

  return trace.steps.flatMap((step) => {
    if (step.type !== "io.write_stdout" || !isStdoutTraceOutput(step.output)) return [];
    return [{ stepId: step.id, ...step.output }];
  });
}

function isStdoutTraceOutput(value: unknown): value is StdoutTraceOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const output = value as Record<string, unknown>;
  return typeof output.content === "string"
    && typeof output.bytes === "number"
    && typeof output.newline === "boolean"
    && (output.label === undefined || typeof output.label === "string");
}
