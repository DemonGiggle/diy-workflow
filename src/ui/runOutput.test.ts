import test from "node:test";
import assert from "node:assert/strict";
import { listStdoutEntries } from "./runOutput.js";
import type { RunTrace } from "../types.js";

test("run output helper lists stdout entries in trace order", () => {
  const trace: RunTrace = {
    runId: "run_0001",
    workflow: { name: "stdout", path: "/tmp/workflow.yaml" },
    status: "success",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:00:01.000Z",
    logs: [
      {
        index: 0,
        timestamp: "2026-01-01T00:00:00.100Z",
        level: "info",
        stepId: "emit_first",
        category: "stdout",
        message: "Hello",
        label: "first",
        newline: true,
        bytes: 13,
      },
      {
        index: 1,
        timestamp: "2026-01-01T00:00:00.150Z",
        level: "info",
        stepId: "emit_second",
        category: "stdout",
        message: "Second line\nThird line",
        newline: false,
        bytes: 22,
      },
    ],
    steps: [
      {
        id: "prompt",
        type: "llm.prompt",
        input: {},
        output: { text: "Hello" },
        status: "success",
        error: null,
        metrics: { startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-01T00:00:00.100Z", durationMs: 100 },
      },
      {
        id: "emit_first",
        type: "io.write_stdout",
        input: {},
        output: { content: "Hello", label: "first", newline: true, bytes: 13 },
        status: "success",
        error: null,
        metrics: { startedAt: "2026-01-01T00:00:00.100Z", endedAt: "2026-01-01T00:00:00.150Z", durationMs: 50 },
      },
      {
        id: "emit_second",
        type: "io.write_stdout",
        input: {},
        output: { content: "Second line\nThird line", newline: false, bytes: 22 },
        status: "success",
        error: null,
        metrics: { startedAt: "2026-01-01T00:00:00.150Z", endedAt: "2026-01-01T00:00:00.200Z", durationMs: 50 },
      },
    ],
  };

  assert.deepEqual(listStdoutEntries(trace), [
    { stepId: "emit_first", content: "Hello", label: "first", newline: true, bytes: 13 },
    { stepId: "emit_second", content: "Second line\nThird line", newline: false, bytes: 22 },
  ]);
});

test("run output helper falls back to legacy stdout step outputs when logs are absent", () => {
  const trace: RunTrace = {
    runId: "run_0003",
    workflow: { name: "legacy-stdout", path: "/tmp/workflow.yaml" },
    status: "success",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:00:01.000Z",
    steps: [
      {
        id: "emit",
        type: "io.write_stdout",
        input: {},
        output: { content: "Legacy", newline: true, bytes: 7 },
        status: "success",
        error: null,
        metrics: { startedAt: "2026-01-01T00:00:00.100Z", endedAt: "2026-01-01T00:00:00.200Z", durationMs: 100 },
      },
    ],
  };

  assert.deepEqual(listStdoutEntries(trace), [
    { stepId: "emit", content: "Legacy", newline: true, bytes: 7 },
  ]);
});

test("run output helper ignores malformed stdout outputs", () => {
  const trace: RunTrace = {
    runId: "run_0002",
    workflow: { path: "/tmp/workflow.yaml" },
    status: "failed",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:00:01.000Z",
    steps: [
      {
        id: "emit",
        type: "io.write_stdout",
        input: {},
        output: { content: 1, bytes: 1, newline: true },
        status: "failed",
        error: "bad output",
        metrics: { startedAt: "2026-01-01T00:00:00.100Z", endedAt: "2026-01-01T00:00:00.200Z", durationMs: 100 },
      },
    ],
  };

  assert.deepEqual(listStdoutEntries(trace), []);
});
