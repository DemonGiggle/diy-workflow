import { formatStdoutEmission } from "./stdout.js";
import type { LogLevel, RunLogEvent, StdoutEmission } from "./types.js";

const logLevelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function shouldPrintLogEvent(event: RunLogEvent, threshold: LogLevel): boolean {
  return logLevelOrder[event.level] >= logLevelOrder[threshold];
}

export function formatRunLogEvent(event: RunLogEvent): string {
  if (event.category === "stdout") {
    const stdout: StdoutEmission = {
      content: event.message,
      newline: event.newline ?? true,
      ...(event.label ? { label: event.label } : {}),
    };
    return formatStdoutEmission(stdout);
  }

  const prefix = `[${event.level}] ${event.stepId}`;
  const lines = event.message.split("\n");
  const rendered = lines
    .map((line, index) => (index === 0 ? `${prefix}: ${line}` : `${" ".repeat(prefix.length + 2)}${line}`))
    .join("\n");
  return `${rendered}\n`;
}
