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
  getLlmProviderSelection,
  getProviderCatalog,
  getWorkflowConnections,
  isCompatibleConnection,
  moveStep,
  removeProvider,
  removeProviderModel,
  removeStep,
  setDefaultModel,
  setDefaultProvider,
  setStepLlmModel,
  setStepLlmProvider,
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

test("editor model stores node-level provider and model overrides independently", () => {
  let state = createInitialEditorState();
  state = addProvider(state);
  state = updateProviderField(state, 1, "id", "openai");
  state = updateProviderField(state, 1, "label", "OpenAI");
  state = updateProviderModelField(state, 1, 0, "id", "gpt-4.1-mini");
  state = updateProviderModelField(state, 1, 0, "label", "GPT-4.1 Mini");
  state = addProviderModel(state, 1);
  state = updateProviderModelField(state, 1, 1, "id", "gpt-4.1");
  state = updateProviderModelField(state, 1, 1, "label", "GPT-4.1");

  const prompt = state.workflow.steps.find((step) => step.type === "llm.prompt")!;
  const summarize = state.workflow.steps.find((step) => step.type === "llm.summarize")!;
  state = setStepLlmProvider(state, prompt.id, "openai");
  state = setStepLlmModel(state, prompt.id, "gpt-4.1");
  state = setStepLlmProvider(state, summarize.id, "openai");
  state = setStepLlmModel(state, summarize.id, "gpt-4.1-mini");

  assert.deepEqual(state.workflow.steps.find((step) => step.id === prompt.id)?.config, {
    providerId: "openai",
    modelId: "gpt-4.1",
  });
  assert.deepEqual(state.workflow.steps.find((step) => step.id === summarize.id)?.config, {
    maxSentences: 3,
    providerId: "openai",
    modelId: "gpt-4.1-mini",
  });
});

test("editor model clears node-level provider overrides back to workflow defaults", () => {
  let state = createInitialEditorState();
  state = addProvider(state);
  state = updateProviderField(state, 1, "id", "openai");
  const prompt = state.workflow.steps.find((step) => step.type === "llm.prompt")!;
  state = setStepLlmProvider(state, prompt.id, "openai");
  state = setStepLlmProvider(state, prompt.id, "");

  assert.equal(state.workflow.steps.find((step) => step.id === prompt.id)?.config, undefined);
});

test("editor model surfaces invalid node model references after catalog changes", () => {
  let state = createInitialEditorState();
  state = addProvider(state);
  state = updateProviderField(state, 1, "id", "openai");
  state = updateProviderModelField(state, 1, 0, "id", "gpt-4.1-mini");
  const prompt = state.workflow.steps.find((step) => step.type === "llm.prompt")!;
  state = setStepLlmProvider(state, prompt.id, "openai");
  state = setStepLlmModel(state, prompt.id, "gpt-4.1-mini");
  state = removeProviderModel(state, 1, 0);

  const selection = getLlmProviderSelection(state, state.workflow.steps.find((step) => step.id === prompt.id)!);
  assert.equal(selection?.issues[0]?.field, "modelId");
  assert.match(selection?.issues[0]?.message ?? "", /Unknown model id/);
});

function summarizeInput(state: ReturnType<typeof createInitialEditorState>): unknown {
  const summarize = state.workflow.steps.find((step) => step.type === "llm.summarize")!;
  return (summarize.input as Record<string, unknown>).text;
}

function promptConfig(state: ReturnType<typeof createInitialEditorState>): unknown {
  const prompt = state.workflow.steps.find((step) => step.type === "llm.prompt")!;
  return prompt.config;
}
