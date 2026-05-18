import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultRegistry } from "../../src/actions/index.js";
import { WorkflowExecutor } from "../../src/executor.js";
import { TraceStore } from "../../src/trace.js";
import { WorkflowValidator } from "../../src/validator.js";
import type { WorkflowDocument } from "../../src/types.js";

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

test("validator accepts legacy workflows without an explicit provider catalog", () => {
  const workflow: WorkflowDocument = {
    steps: [
      { id: "prompt", type: "llm.prompt", input: { prompt: "hello" } },
    ],
  };
  const result = new WorkflowValidator(createDefaultRegistry()).validate(workflow);
  assert.equal(result.ok, true);
});

test("validator rejects provider catalogs with duplicate ids and missing defaults", () => {
  const workflow: WorkflowDocument = {
    providerCatalog: {
      providers: [
        {
          id: "openai",
          label: "OpenAI",
          kind: "openai-compatible",
          models: [
            { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
            { id: "gpt-4.1-mini", label: "Duplicate" },
          ],
        },
        {
          id: "openai",
          label: "Duplicate provider",
          kind: "openai-compatible",
          models: [{ id: "gpt-4.1", label: "GPT-4.1" }],
        },
      ],
    },
    steps: [
      { id: "prompt", type: "llm.prompt", input: { prompt: "hello" } },
    ],
  };
  const result = new WorkflowValidator(createDefaultRegistry()).validate(workflow);
  assert.equal(result.ok, false);
  const messages = result.issues.map((issue) => issue.message).join("\n");
  assert.match(messages, /Duplicate provider id/);
  assert.match(messages, /Duplicate model id/);
  assert.match(messages, /defaultProviderId is required/);
  assert.match(messages, /defaultModelId is required/);
});

test("validator rejects unknown or disabled provider defaults", () => {
  const workflow: WorkflowDocument = {
    providerCatalog: {
      defaultProviderId: "openai",
      defaultModelId: "gpt-4.1-mini",
      providers: [
        {
          id: "openai",
          label: "OpenAI",
          kind: "openai-compatible",
          enabled: false,
          models: [{ id: "gpt-4.1-mini", label: "GPT-4.1 Mini", enabled: false }],
        },
      ],
    },
    steps: [
      { id: "prompt", type: "llm.prompt", input: { prompt: "hello" } },
    ],
  };
  const result = new WorkflowValidator(createDefaultRegistry()).validate(workflow);
  assert.equal(result.ok, false);
  const messages = result.issues.map((issue) => issue.message).join("\n");
  assert.match(messages, /Default provider is disabled/);
  assert.match(messages, /Default model is disabled/);
});

test("validator rejects incomplete or unknown node-level provider selections", () => {
  const workflow: WorkflowDocument = {
    providerCatalog: {
      defaultProviderId: "mock",
      defaultModelId: "mock-default",
      providers: [
        {
          id: "mock",
          label: "Mock Provider",
          kind: "mock",
          models: [{ id: "mock-default", label: "Mock Default", capabilities: { text: true, vision: true } }],
        },
        {
          id: "openai",
          label: "OpenAI",
          kind: "openai-compatible",
          models: [{ id: "gpt-4.1-mini", label: "GPT-4.1 Mini", capabilities: { text: true } }],
        },
      ],
    },
    steps: [
      { id: "prompt", type: "llm.prompt", input: { prompt: "hello" }, config: { providerId: "openai" } },
      { id: "vision", type: "llm.vision_analyze", input: { image: { path: "x.png", mimeType: "image/png", bytes: 1 } }, config: { providerId: "openai", modelId: "missing" } },
    ],
  };
  const result = new WorkflowValidator(createDefaultRegistry()).validate(workflow);
  assert.equal(result.ok, false);
  const messages = result.issues.map((issue) => issue.message).join("\n");
  assert.match(messages, /modelId is required/);
  assert.match(messages, /Unknown model id for provider openai: missing/);
});

test("validator rejects node model selections that lack required vision capability", () => {
  const workflow: WorkflowDocument = {
    providerCatalog: {
      defaultProviderId: "mock",
      defaultModelId: "mock-default",
      providers: [
        {
          id: "mock",
          label: "Mock Provider",
          kind: "mock",
          models: [{ id: "mock-default", label: "Mock Default", capabilities: { text: true, vision: true } }],
        },
        {
          id: "openai",
          label: "OpenAI",
          kind: "openai-compatible",
          models: [{ id: "gpt-4.1-mini", label: "GPT-4.1 Mini", capabilities: { text: true } }],
        },
      ],
    },
    steps: [
      {
        id: "vision",
        type: "llm.vision_analyze",
        input: { image: { path: "x.png", mimeType: "image/png", bytes: 1 } },
        config: { providerId: "openai", modelId: "gpt-4.1-mini" },
      },
    ],
  };
  const result = new WorkflowValidator(createDefaultRegistry()).validate(workflow);
  assert.equal(result.ok, false);
  assert.match(result.issues.map((issue) => issue.message).join("\n"), /does not support vision/);
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
