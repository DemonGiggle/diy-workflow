import test from "node:test";
import assert from "node:assert/strict";
import { createInitialEditorState, updateStepConfig } from "./editorModel.js";
import { isLlmProviderSelectionDisabled } from "./llmSelection.js";

test("llm provider selection is disabled when mock mode is enabled", () => {
  let state = createInitialEditorState();
  const step = state.workflow.steps.find((item) => item.type === "llm.prompt");
  assert.ok(step);
  assert.equal(isLlmProviderSelectionDisabled(step), false);

  state = updateStepConfig(state, step.id, "mock.enabled", true);
  const updated = state.workflow.steps.find((item) => item.id === step.id);
  assert.ok(updated);
  assert.equal(isLlmProviderSelectionDisabled(updated), true);
});
