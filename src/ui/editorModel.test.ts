import test from "node:test";
import assert from "node:assert/strict";
import {
  addProvider,
  addProviderModel,
  addStep,
  availableConnections,
  connectCompatibleField,
  connectField,
  createInitialEditorState,
  getProviderCatalog,
  getWorkflowConnections,
  isCompatibleConnection,
  moveStep,
  removeProvider,
  removeProviderModel,
  removeStep,
  setDefaultModel,
  setDefaultProvider,
  updateProviderField,
  updateProviderModelCapability,
  updateProviderModelField,
  updateStepConfig,
  updateStepInput,
} from "./editorModel.js";

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
  const read = state.workflow.steps.find((step) => step.type === "io.read_file")!;
  const summarize = state.workflow.steps.find((step) => step.type === "llm.summarize")!;
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

  const summarize = state.workflow.steps.find((step) => step.type === "llm.summarize")!;
  const textField = { name: "text", label: "Text", kind: "textarea" as const, connectable: true };
  const textConnections = availableConnections(state, summarize.id, textField);
  assert.ok(textConnections.some((connection) => connection.field.name === "content"));
  assert.equal(textConnections.some((connection) => connection.field.name === "bytes"), false);
});

test("editor model exposes compatibility rules for UI wiring", () => {
  assert.equal(isCompatibleConnection("textarea", "textarea"), true);
  assert.equal(isCompatibleConnection("number", "textarea"), false);
  assert.equal(isCompatibleConnection("number", "json"), true);
  assert.equal(isCompatibleConnection("image", "image"), true);
  assert.equal(isCompatibleConnection("image", "json"), false);
  assert.equal(isCompatibleConnection("text", "image"), false);
  assert.equal(isCompatibleConnection("array", "array"), true);
  assert.equal(isCompatibleConnection("boolean", "number"), false);
});

test("editor model only connects compatible visual ports", () => {
  let state = createInitialEditorState();
  const read = state.workflow.steps.find((step) => step.type === "io.read_file")!;
  const summarize = state.workflow.steps.find((step) => step.type === "llm.summarize")!;
  assert.ok(read);
  assert.ok(summarize);

  const invalid = connectCompatibleField(state, summarize.id, "text", read.id, "bytes");
  assert.equal(invalid.ok, false);
  assert.equal(summarizeInput(invalid.state), summarizeInput(state));

  const valid = connectCompatibleField(state, summarize.id, "text", read.id, "content");
  assert.equal(valid.ok, true);
  assert.equal(summarizeInput(valid.state), `{{steps.${read.id}.output.content}}`);
});

test("editor model extracts port-level workflow connections", () => {
  const state = createInitialEditorState();
  const read = state.workflow.steps.find((step) => step.type === "io.read_file")!;
  const prompt = state.workflow.steps.find((step) => step.type === "llm.prompt")!;
  const summarize = state.workflow.steps.find((step) => step.type === "llm.summarize")!;

  assert.deepEqual(getWorkflowConnections(state), [
    { fromStepId: read.id, fromField: "content", toStepId: prompt.id, toField: "prompt" },
    { fromStepId: prompt.id, fromField: "text", toStepId: summarize.id, toField: "text" },
  ]);
});

test("editor model updates primitive field input", () => {
  let state = createInitialEditorState();
  const read = state.workflow.steps[0]!;
  state = updateStepInput(state, read.id, "path", "new.txt");
  assert.equal((state.workflow.steps[0]!.input as Record<string, unknown>).path, "new.txt");
});

test("editor model updates nested mock config fields", () => {
  let state = createInitialEditorState();
  const prompt = state.workflow.steps.find((step) => step.type === "llm.prompt")!;
  state = updateStepConfig(state, prompt.id, "mock.enabled", true);
  state = updateStepConfig(state, prompt.id, "mock.response", "mocked response");
  assert.deepEqual(promptConfig(state), { mock: { enabled: true, response: "mocked response" } });
});

test("editor model wires image outputs only into image inputs", () => {
  let state = createInitialEditorState();
  state = addStep(state, "io.read_image");
  state = addStep(state, "llm.ocr");

  const readImage = state.workflow.steps.find((step) => step.type === "io.read_image")!;
  const ocr = state.workflow.steps.find((step) => step.type === "llm.ocr")!;
  const imageField = { name: "image", label: "Image", kind: "image" as const, connectable: true };
  const connections = availableConnections(state, ocr.id, imageField);

  assert.ok(connections.some((connection) => connection.fromStepId === readImage.id && connection.field.name === "image"));
  assert.equal(connections.some((connection) => connection.field.name === "content"), false);

  const result = connectCompatibleField(state, ocr.id, "image", readImage.id, "image");
  assert.equal(result.ok, true);
});

test("editor model manages provider catalog defaults and provider fields", () => {
  let state = createInitialEditorState();
  state = addProvider(state);
  state = updateProviderField(state, 1, "id", "openai");
  state = updateProviderField(state, 1, "label", "OpenAI");
  state = setDefaultProvider(state, "openai");

  const catalog = getProviderCatalog(state);
  assert.equal(catalog.providers[1]?.id, "openai");
  assert.equal(catalog.defaultProviderId, "openai");
  assert.equal(catalog.defaultModelId, "model_1");
});

test("editor model manages provider models and capabilities", () => {
  let state = createInitialEditorState();
  state = addProvider(state);
  state = updateProviderField(state, 1, "id", "openai");
  state = addProviderModel(state, 1);
  state = updateProviderModelField(state, 1, 1, "id", "gpt-4.1-mini");
  state = updateProviderModelField(state, 1, 1, "label", "GPT-4.1 Mini");
  state = updateProviderModelField(state, 1, 1, "contextWindow", 128000);
  state = updateProviderModelCapability(state, 1, 1, "vision", true);
  state = setDefaultProvider(state, "openai");
  state = setDefaultModel(state, "gpt-4.1-mini");

  const catalog = getProviderCatalog(state);
  const model = catalog.providers[1]?.models[1];
  assert.equal(catalog.defaultModelId, "gpt-4.1-mini");
  assert.equal(model?.label, "GPT-4.1 Mini");
  assert.equal(model?.contextWindow, 128000);
  assert.equal(model?.capabilities?.vision, true);
});

test("editor model resets defaults when removing providers or models", () => {
  let state = createInitialEditorState();
  state = addProvider(state);
  state = updateProviderField(state, 1, "id", "openai");
  state = addProviderModel(state, 1);
  state = updateProviderModelField(state, 1, 1, "id", "gpt-4.1-mini");
  state = setDefaultProvider(state, "openai");
  state = setDefaultModel(state, "gpt-4.1-mini");
  state = removeProviderModel(state, 1, 1);

  let catalog = getProviderCatalog(state);
  assert.equal(catalog.defaultModelId, "model_1");

  state = removeProvider(state, 1);
  catalog = getProviderCatalog(state);
  assert.equal(catalog.defaultProviderId, "mock");
});

function summarizeInput(state: ReturnType<typeof createInitialEditorState>): unknown {
  const summarize = state.workflow.steps.find((step) => step.type === "llm.summarize")!;
  return (summarize.input as Record<string, unknown>).text;
}

function promptConfig(state: ReturnType<typeof createInitialEditorState>): unknown {
  const prompt = state.workflow.steps.find((step) => step.type === "llm.prompt")!;
  return prompt.config;
}
