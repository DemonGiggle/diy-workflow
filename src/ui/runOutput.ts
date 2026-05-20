import type { RunLogEvent, RunTrace, StdoutTraceOutput } from "../types.js";

export interface StdoutRunEntry extends StdoutTraceOutput {
  stepId: string;
}

export function listStdoutEntries(trace: RunTrace | null): StdoutRunEntry[] {
  if (!trace) return [];
  if (trace.logs?.length) {
    return trace.logs.flatMap((event) => {
      if (!isStdoutLogEvent(event)) return [];
      return [{
        stepId: event.stepId,
        content: event.message,
        ...(event.label ? { label: event.label } : {}),
        newline: event.newline,
        bytes: event.bytes,
      }];
    });
  }

  return trace.steps.flatMap((step) => {
    if (step.type !== "io.write_stdout" || !isStdoutTraceOutput(step.output)) return [];
    return [{ stepId: step.id, ...step.output }];
  });
}

function isStdoutLogEvent(value: unknown): value is RunLogEvent & StdoutTraceOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  return event.category === "stdout"
    && typeof event.stepId === "string"
    && typeof event.message === "string"
    && typeof event.bytes === "number"
    && typeof event.newline === "boolean"
    && (event.label === undefined || typeof event.label === "string");
}

function isStdoutTraceOutput(value: unknown): value is StdoutTraceOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const output = value as Record<string, unknown>;
  return typeof output.content === "string"
    && typeof output.bytes === "number"
    && typeof output.newline === "boolean"
    && (output.label === undefined || typeof output.label === "string");
}
