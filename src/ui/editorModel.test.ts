import test from "node:test";
import assert from "node:assert/strict";
import { addStep, availableConnections, connectField, createInitialEditorState, moveStep, removeStep, updateStepInput } from "./editorModel.js";

test("editor model adds, moves, and removes nodes", () => {
  let state = createInitialEditorState();
  state = addStep(state, "eval.exact_match");
  const added = state.workflow.steps.at(-1);
  assert.equal(added?.type, "eval.exact_match");
  assert.equal(state.selectedStepId, added?.id);

  state = moveStep(state, added!.id, { x: 123, y: 456 });
  assert.deepEqual(state.positions[added!.id], { x: 123, y: 456 });

  state = removeStep(state, added!.id);
  assert.equal(state.workflow.steps.some((step) => step.id === added!.id), false);
});

test("editor model builds schema-style upstream references", () => {
  let state = createInitialEditorState();
  const [read, summarize] = state.workflow.steps;
  assert.ok(read);
  assert.ok(summarize);
  const connections = availableConnections(state, summarize.id);
  assert.ok(connections.some((connection) => connection.reference === `{{steps.${read.id}.output.content}}`));

  state = connectField(state, summarize.id, "text", read.id, "content");
  assert.deepEqual(summarizeInput(state), `{{steps.${read.id}.output.content}}`);
});

test("editor model updates primitive field input", () => {
  let state = createInitialEditorState();
  const read = state.workflow.steps[0]!;
  state = updateStepInput(state, read.id, "path", "new.txt");
  assert.equal((state.workflow.steps[0]!.input as Record<string, unknown>).path, "new.txt");
});

function summarizeInput(state: ReturnType<typeof createInitialEditorState>): unknown {
  return (state.workflow.steps[1]!.input as Record<string, unknown>).text;
}
