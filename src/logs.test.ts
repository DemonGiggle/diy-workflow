import test from "node:test";
import assert from "node:assert/strict";
import { formatRunLogEvent, shouldPrintLogEvent } from "./logs.js";
import type { RunLogEvent } from "./types.js";

test("log helpers filter events by threshold", () => {
  const debugEvent = event({ level: "debug", stepId: "prompt", message: "Starting llm.prompt" });
  const warnEvent = event({ level: "warn", stepId: "fanout", message: "Fanout completed with 1 failed branch(es)" });

  assert.equal(shouldPrintLogEvent(debugEvent, "info"), false);
  assert.equal(shouldPrintLogEvent(debugEvent, "debug"), true);
  assert.equal(shouldPrintLogEvent(warnEvent, "info"), true);
  assert.equal(shouldPrintLogEvent(warnEvent, "error"), false);
});

test("log helpers format multiline and stdout events for CLI output", () => {
  assert.equal(
    formatRunLogEvent(event({ level: "info", stepId: "read", message: "Loaded first line\nLoaded second line" })),
    "[info] read: Loaded first line\n             Loaded second line\n",
  );
  assert.equal(
    formatRunLogEvent(event({
      level: "info",
      stepId: "emit",
      category: "stdout",
      message: "world",
      label: "result",
      newline: true,
    })),
    "result: world\n",
  );
});

function event(overrides: Partial<RunLogEvent>): RunLogEvent {
  return {
    index: 0,
    timestamp: "2026-05-20T00:00:00.000Z",
    level: "info",
    stepId: "step",
    message: "message",
    ...overrides,
  };
}
