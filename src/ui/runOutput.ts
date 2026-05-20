import { shouldPrintLogEvent } from "../logs.js";
import type { LogLevel, RunLogEvent, RunTrace, StdoutTraceOutput } from "../types.js";

export interface RunOutputEntry {
  level: LogLevel;
  stepId: string;
  message: string;
  label?: string;
  category?: string;
  bytes?: number;
  newline?: boolean;
}

export function listRunOutputEntries(trace: RunTrace | null, threshold: LogLevel): RunOutputEntry[] {
  if (!trace) return [];
  if (trace.logs?.length) {
    return trace.logs.flatMap((event) => {
      if (!isRunLogEvent(event) || !shouldPrintLogEvent(event, threshold)) return [];
      return [toRunOutputEntry(event)];
    });
  }

  return trace.steps.flatMap((step) => {
    if (step.type !== "io.write_stdout" || !isStdoutTraceOutput(step.output)) return [];
    const event = legacyStdoutEntry(step.id, step.output);
    return shouldPrintLogEvent(event, threshold) ? [toRunOutputEntry(event)] : [];
  });
}

function toRunOutputEntry(event: RunLogEvent): RunOutputEntry {
  return {
    level: event.level,
    stepId: event.stepId,
    message: event.message,
    ...(event.label ? { label: event.label } : {}),
    ...(event.category ? { category: event.category } : {}),
    ...(typeof event.bytes === "number" ? { bytes: event.bytes } : {}),
    ...(typeof event.newline === "boolean" ? { newline: event.newline } : {}),
  };
}

function legacyStdoutEntry(stepId: string, output: StdoutTraceOutput): RunLogEvent {
  return {
    index: 0,
    timestamp: "",
    level: "info",
    stepId,
    category: "stdout",
    message: output.content,
    ...(output.label ? { label: output.label } : {}),
    newline: output.newline,
    bytes: output.bytes,
  };
}

function isRunLogEvent(value: unknown): value is RunLogEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  return typeof event.stepId === "string"
    && typeof event.message === "string"
    && isLogLevel(event.level)
    && (event.category === undefined || typeof event.category === "string")
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

function isLogLevel(value: unknown): value is LogLevel {
  return value === "debug" || value === "info" || value === "warn" || value === "error";
}
