import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultRegistry } from "./actions/index.js";
import { WorkflowExecutor } from "./executor.js";
import { TraceStore } from "./trace.js";
import { WorkflowValidator } from "./validator.js";
import type { WorkflowDocument } from "./types.js";

test("validator rejects duplicate ids and unknown action types", () => {
  const workflow: WorkflowDocument = {
    steps: [
      { id: "a", type: "io.read_file", input: { path: "x" } },
      { id: "a", type: "missing.action", input: {} },
    ],
  };
  const result = new WorkflowValidator(createDefaultRegistry()).validate(workflow);
  assert.equal(result.ok, false);
  assert.match(result.issues.map((issue) => issue.message).join("\n"), /Duplicate step id/);
  assert.match(result.issues.map((issue) => issue.message).join("\n"), /Unknown action type/);
});

test("validator rejects references to future steps", () => {
  const workflow: WorkflowDocument = {
    steps: [
      { id: "a", type: "llm.summarize", input: { text: "{{steps.b.output.text}}" } },
      { id: "b", type: "llm.prompt", input: { prompt: "hello" } },
    ],
  };
  const result = new WorkflowValidator(createDefaultRegistry()).validate(workflow);
  assert.equal(result.ok, false);
  assert.match(result.issues[0]?.message ?? "", /not available/);
});

test("executor runs workflow, resolves references, and saves trace", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diy-workflow-"));
  try {
    await writeFile(join(dir, "input.txt"), "One. Two. Three.", "utf8");
    const workflow: WorkflowDocument = {
      name: "test",
      steps: [
        { id: "read", type: "io.read_file", input: { path: "input.txt" } },
        { id: "summary", type: "llm.summarize", input: { text: "{{steps.read.output.content}}" }, config: { maxSentences: 2 } },
        { id: "eval", type: "eval.exact_match", input: { actual: "{{steps.summary.output.summary}}", expected: "One. Two." } },
      ],
    };
    const trace = await new WorkflowExecutor().execute({
      workflowPath: join(dir, "workflow.yaml"),
      workflow,
      registry: createDefaultRegistry(),
      traceStore: new TraceStore(join(dir, "runs")),
    });
    assert.equal(trace.status, "success");
    assert.equal(trace.steps.length, 3);
    assert.deepEqual(trace.steps[2]?.output, { matched: true, actual: "One. Two.", expected: "One. Two." });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("executor supports action-level mock mode for deterministic e2e runs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diy-workflow-"));
  try {
    const workflow: WorkflowDocument = {
      name: "mocked",
      steps: [
        {
          id: "read",
          type: "io.read_file",
          input: { path: "missing.txt" },
          config: { mock: { enabled: true, path: "mock://missing.txt", content: "Alpha. Beta.", bytes: 12 } },
        },
        {
          id: "prompt",
          type: "llm.prompt",
          input: { prompt: "{{steps.read.output.content}}" },
          config: { mock: { enabled: true, response: "Mock prompt output." } },
        },
        {
          id: "summary",
          type: "llm.summarize",
          input: { text: "{{steps.prompt.output.text}}" },
          config: { mock: { enabled: true, summary: "Mock summary.", sentenceCount: 1 } },
        },
        {
          id: "eval",
          type: "eval.exact_match",
          input: { actual: "{{steps.summary.output.summary}}", expected: "Different" },
          config: { mock: { enabled: true, matched: true, expected: "Mock summary." } },
        },
      ],
    };
    const trace = await new WorkflowExecutor().execute({
      workflowPath: join(dir, "workflow.yaml"),
      workflow,
      registry: createDefaultRegistry(),
      traceStore: new TraceStore(join(dir, "runs")),
    });
    assert.equal(trace.status, "success");
    assert.deepEqual(trace.steps.map((step) => step.status), ["success", "success", "success", "success"]);
    assert.deepEqual(trace.steps[0]?.output, { path: "mock://missing.txt", content: "Alpha. Beta.", bytes: 12 });
    assert.deepEqual(trace.steps[3]?.output, { matched: true, actual: "Mock summary.", expected: "Mock summary." });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("fanout and fanin compose branch outputs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diy-workflow-"));
  try {
    const workflow: WorkflowDocument = {
      steps: [
        {
          id: "fanout",
          type: "control.fanout",
          input: {
            value: "Hello",
            branches: [
              { id: "a", type: "llm.prompt", input: { prompt: "{{input}} A" } },
              { id: "b", type: "llm.prompt", input: { prompt: "{{input}} B" } },
            ],
          },
        },
        { id: "fanin", type: "control.fanin", input: { items: "{{steps.fanout.output.results}}" }, config: { strategy: "first_success" } },
      ],
    };
    const trace = await new WorkflowExecutor().execute({
      workflowPath: join(dir, "workflow.yaml"),
      workflow,
      registry: createDefaultRegistry(),
      traceStore: new TraceStore(join(dir, "runs")),
    });
    assert.equal(trace.status, "success");
    assert.equal((trace.steps[1]?.output as { count: number }).count, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
