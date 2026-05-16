import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultRegistry } from "./actions/index.js";
import { faninAction, fanoutAction } from "./actions/control.js";
import { exactMatchAction } from "./actions/eval.js";
import { readFileAction } from "./actions/io.js";
import { promptAction, summarizeAction } from "./actions/llm.js";
import type { ActionContext } from "./types.js";

const registry = createDefaultRegistry();

function context(cwd = process.cwd()): ActionContext {
  return {
    runId: "run_test",
    stepId: "step_test",
    cwd,
    registry,
    runAction: async (type, input, config) => {
      const action = registry.get(type);
      if (!action) throw new Error(`Unknown nested action type: ${type}`);
      return action.run(input as never, context(cwd), config);
    },
  };
}

test("read_file reads workspace-relative files and supports mock output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diy-workflow-actions-"));
  try {
    await writeFile(join(dir, "input.txt"), "Hello file", "utf8");

    const output = await readFileAction.run({ path: "input.txt" }, context(dir));
    assert.equal(output.content, "Hello file");
    assert.equal(output.bytes, Buffer.byteLength("Hello file"));
    assert.match(output.path, /input\.txt$/);

    const mocked = await readFileAction.run(
      { path: "missing.txt" },
      context(dir),
      { mock: { enabled: true, path: "mock://file.txt", content: "Mocked", bytes: 6 } },
    );
    assert.deepEqual(mocked, { path: "mock://file.txt", content: "Mocked", bytes: 6 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("llm prompt renders variables and accepts mock response", async () => {
  const rendered = await promptAction.run(
    { prompt: "Hello {{user.name}}", variables: { user: { name: "Gigo" } } },
    context(),
  );
  assert.deepEqual(rendered, { text: "Hello Gigo", provider: "mock" });

  const mocked = await promptAction.run(
    { prompt: "Ignored" },
    context(),
    { mock: { enabled: true, response: "Mock response" } },
  );
  assert.deepEqual(mocked, { text: "Mock response", provider: "mock" });
});

test("llm summarize applies sentence and character limits and mock summary", async () => {
  const summarized = await summarizeAction.run(
    { text: "One sentence. Two sentence. Three sentence." },
    context(),
    { maxSentences: 2, maxChars: 18 },
  );
  assert.equal(summarized.summary, "One sentence. Two…");
  assert.equal(summarized.sentenceCount, 3);

  const mocked = await summarizeAction.run(
    { text: "Ignored" },
    context(),
    { mock: { enabled: true, summary: "Mock summary.", sentenceCount: 1 } },
  );
  assert.deepEqual(mocked, { summary: "Mock summary.", sentenceCount: 1 });
});

test("control fanout injects values and fanin merges successful outputs", async () => {
  const fanout = await fanoutAction.run(
    {
      value: "Shared",
      branches: [
        { id: "a", type: "llm.prompt", input: { prompt: "{{input}} A" } },
        { id: "b", type: "llm.prompt", input: { prompt: "$input" } },
      ],
    },
    context(),
  );

  assert.equal(fanout.results.length, 2);
  assert.deepEqual(fanout.results.map((result) => result.status), ["success", "success"]);
  assert.deepEqual(fanout.results.map((result) => (result.output as { text: string }).text), ["Shared A", "Shared"]);

  const merged = await faninAction.run(
    { items: [{ status: "success", output: { a: 1 } }, { status: "success", output: { b: 2 } }] },
    context(),
    { strategy: "merge" },
  );
  assert.deepEqual(merged, { strategy: "merge", output: { a: 1, b: 2 }, count: 2 });
});

test("control fanin first_success and mock config are deterministic", async () => {
  const first = await faninAction.run(
    { items: [{ status: "failed", output: null }, { status: "success", output: { ok: true } }] },
    context(),
    { strategy: "first_success" },
  );
  assert.deepEqual(first, { strategy: "first_success", output: { status: "success", output: { ok: true } }, count: 1 });

  const mocked = await faninAction.run(
    { items: [] },
    context(),
    { mock: { enabled: true, strategy: "first_success", output: "mock", count: 9 } },
  );
  assert.deepEqual(mocked, { strategy: "first_success", output: "mock", count: 9 });
});

test("exact_match compares nested values and can force mock output", async () => {
  const matched = await exactMatchAction.run({ actual: { value: [1, 2] }, expected: { value: [1, 2] } }, context());
  assert.equal(matched.matched, true);

  const mocked = await exactMatchAction.run(
    { actual: "a", expected: "b" },
    context(),
    { mock: { enabled: true, matched: true, actual: "same", expected: "same" } },
  );
  assert.deepEqual(mocked, { matched: true, actual: "same", expected: "same" });
});
