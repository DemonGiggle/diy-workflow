import type { RunLogEvent, StdoutEmission } from "./types.js";

export function stringifyStdoutContent(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    const serialized = JSON.stringify(value, null, 2);
    return serialized ?? String(value);
  } catch {
    return String(value);
  }
}

export function formatStdoutEmission(output: StdoutEmission): string {
  const prefix = output.label ? `${output.label}: ` : "";
  return `${prefix}${output.content}${output.newline ? "\n" : ""}`;
}

export function measureStdoutEmission(output: StdoutEmission): number {
  return Buffer.byteLength(formatStdoutEmission(output), "utf8");
}

export function stdoutEmissionToLogEvent(stepId: string, output: StdoutEmission): Omit<RunLogEvent, "index" | "timestamp"> {
  return {
    level: "info",
    stepId,
    message: output.content,
    ...(output.label ? { label: output.label } : {}),
    category: "stdout",
    newline: output.newline,
    bytes: measureStdoutEmission(output),
  };
}
