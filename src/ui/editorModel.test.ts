import test from "node:test";
import assert from "node:assert/strict";
import { addStep, availableConnections, connectCompatibleField, connectField, createInitialEditorState, isCompatibleConnection, moveStep, removeStep, updateStepInput } from "./editorModel.js";

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

test("editor model filters upstream connections by compatible field kind", () => {
  let state = createInitialEditorState();
  state = addStep(state, "eval.exact_match");
  const exactMatch = state.workflow.steps.at(-1)!;
  const actualField = { name: "actual", label: "Actual", kind: "json" as const, connectable: true };
  const jsonConnections = availableConnections(state, exactMatch.id, actualField);
  assert.ok(jsonConnections.some((connection) => connection.field.name === "bytes"));

  const summarize = state.workflow.steps[1]!;
  const textField = { name: "text", label: "Text", kind: "textarea" as const, connectable: true };
  const textConnections = availableConnections(state, summarize.id, textField);
  assert.ok(textConnections.some((connection) => connection.field.name === "content"));
  assert.equal(textConnections.some((connection) => connection.field.name === "bytes"), false);
});

test("editor model exposes compatibility rules for UI wiring", () => {
  assert.equal(isCompatibleConnection("textarea", "textarea"), true);
  assert.equal(isCompatibleConnection("number", "textarea"), false);
  assert.equal(isCompatibleConnection("number", "json"), true);
  assert.equal(isCompatibleConnection("array", "array"), true);
  assert.equal(isCompatibleConnection("boolean", "number"), false);
});

test("editor model only connects compatible visual ports", () => {
  let state = createInitialEditorState();
  const [read, summarize] = state.workflow.steps;
  assert.ok(read);
  assert.ok(summarize);

  const invalid = connectCompatibleField(state, summarize.id, "text", read.id, "bytes");
  assert.equal(invalid.ok, false);
  assert.equal(summarizeInput(invalid.state), `{{steps.${read.id}.output.content}}`);

  const valid = connectCompatibleField(state, summarize.id, "text", read.id, "content");
  assert.equal(valid.ok, true);
  assert.equal(summarizeInput(valid.state), `{{steps.${read.id}.output.content}}`);
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
