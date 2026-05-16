import test from "node:test";
import assert from "node:assert/strict";
import { extractReferences, resolveReferences } from "./references.js";

test("extractReferences finds nested whole and inline references", () => {
  const refs = extractReferences({
    direct: "{{steps.read.output.content}}",
    array: ["prefix {{steps.prompt.output.text}} suffix"],
    fullOutput: "{{steps.fanout.output}}",
  });

  assert.deepEqual(refs, [
    { stepId: "read", path: ["content"] },
    { stepId: "prompt", path: ["text"] },
    { stepId: "fanout", path: [] },
  ]);
});

test("resolveReferences preserves object values for whole references and stringifies inline references", () => {
  const steps = new Map([
    ["read", { output: { content: "Alpha", metadata: { bytes: 5 } } }],
    ["fanin", { output: { output: { ok: true } } }],
  ]);

  assert.deepEqual(resolveReferences("{{steps.read.output.metadata}}", steps), { bytes: 5 });
  assert.equal(resolveReferences("Text: {{steps.read.output.content}}", steps), "Text: Alpha");
  assert.equal(resolveReferences("Result {{steps.fanin.output.output}}", steps), 'Result {"ok":true}');
});

test("resolveReferences throws for missing steps and fields", () => {
  const steps = new Map([["read", { output: { content: "Alpha" } }]]);

  assert.throws(() => resolveReferences("{{steps.missing.output.content}}", steps), /unavailable step/);
  assert.throws(() => resolveReferences("{{steps.read.output.missing}}", steps), /Reference path not found/);
});
