import {
  createDefaultProviderCatalog,
  getRequiredCapabilityForAction,
  inspectLlmProviderSelection,
  isLlmActionType,
  listSelectableModels,
  readLlmNodeSelectionConfig,
  type LlmProviderSelectionState,
} from "../providers.js";
import type { JsonObject, ProviderCatalog, StepTrace, WorkflowDocument, WorkflowStep } from "../types.js";
import { createStep, getEditorAction, type FieldDescriptor, type FieldKind, type OutputDescriptor } from "./actionCatalog.js";

export interface NodePosition {
  x: number;
  y: number;
}

export interface EditorState {
  workflow: WorkflowDocument;
  selectedStepId: string | null;
  positions: Record<string, NodePosition>;
}

export interface ConnectionCandidate {
  fromStepId: string;
  field: OutputDescriptor;
  reference: string;
  compatible: boolean;
}

export interface WorkflowConnection {
  fromStepId: string;
  fromField: string;
  toStepId: string;
  toField: string;
}

export interface ConnectionResult {
  state: EditorState;
  ok: boolean;
  message?: string;
}

const nodeLayout = {
  startX: 72,
  startY: 92,
  gapX: 348,
  gapY: 248,
  maxColumns: 3,
} as const;

export function createInitialEditorState(): EditorState {
  const read = createStep("io.read_file", 0);
  const prompt = createStep("llm.prompt", 1);
  const summarize = createStep("llm.summarize", 2);
  prompt.input = { prompt: referenceFor(read.id, "content") };
  summarize.input = { text: referenceFor(prompt.id, "text") };
  return {
    ...createEditorStateFromWorkflow({
      name: "visual-workflow",
      providerCatalog: createDefaultProviderCatalog(),
      steps: [read, prompt, summarize],
    }),
    selectedStepId: prompt.id,
  };
}

export function createEditorStateFromWorkflow(workflow: WorkflowDocument): EditorState {
  return {
    workflow,
    selectedStepId: workflow.steps[0]?.id ?? null,
    positions: Object.fromEntries(workflow.steps.map((step, index) => [step.id, defaultNodePosition(index)])),
  };
}

export function addStep(state: EditorState, type: string): EditorState {
  const step = createStep(type, state.workflow.steps.length);
  const last = state.workflow.steps[state.workflow.steps.length - 1];
  const lastPosition = last ? state.positions[last.id] : undefined;
  return {
    ...state,
    workflow: { ...state.workflow, steps: [...state.workflow.steps, step] },
    selectedStepId: step.id,
    positions: {
      ...state.positions,
      [step.id]: { x: (lastPosition?.x ?? 72) + 320, y: lastPosition?.y ?? 92 },
    },
  };
}

export function removeStep(state: EditorState, stepId: string): EditorState {
  const steps = state.workflow.steps.filter((step) => step.id !== stepId);
  const positions = { ...state.positions };
  delete positions[stepId];
  return {
    ...state,
    workflow: { ...state.workflow, steps },
    selectedStepId: state.selectedStepId === stepId ? steps[0]?.id ?? null : state.selectedStepId,
    positions,
  };
}

export function moveStep(state: EditorState, stepId: string, position: NodePosition): EditorState {
  return { ...state, positions: { ...state.positions, [stepId]: position } };
}

export function updateStepInput(state: EditorState, stepId: string, field: string, value: unknown): EditorState {
  return updateStep(state, stepId, (step) => ({
    ...step,
    input: { ...asObject(step.input), [field]: value },
  }));
}

export function updateStepConfig(state: EditorState, stepId: string, field: string, value: unknown): EditorState {
  return updateStep(state, stepId, (step) => ({
    ...step,
    config: pruneEmpty(setPath(asObject(step.config), field.split("."), value)),
  }));
}

export function connectField(state: EditorState, targetStepId: string, targetField: string, sourceStepId: string, sourceField: string): EditorState {
  return updateStepInput(state, targetStepId, targetField, referenceFor(sourceStepId, sourceField));
}

export function connectCompatibleField(
  state: EditorState,
  targetStepId: string,
  targetFieldName: string,
  sourceStepId: string,
  sourceFieldName: string,
): ConnectionResult {
  const targetStep = state.workflow.steps.find((step) => step.id === targetStepId);
  const sourceStep = state.workflow.steps.find((step) => step.id === sourceStepId);
  if (!targetStep || !sourceStep) return { state, ok: false, message: "Missing source or target step" };

  const targetAction = getEditorAction(targetStep.type);
  const sourceAction = getEditorAction(sourceStep.type);
  const targetField = targetAction?.inputFields.find((field) => field.name === targetFieldName);
  const sourceField = sourceAction?.outputFields.find((field) => field.name === sourceFieldName);
  if (!targetField || !sourceField) return { state, ok: false, message: "Missing source or target field" };
  if (!targetField.connectable) return { state, ok: false, message: `${targetField.name} does not accept connections` };
  if (!isCompatibleConnection(sourceField.kind, targetField.kind)) {
    return { state, ok: false, message: `${sourceField.kind} output cannot connect to ${targetField.kind} input` };
  }

  return {
    state: connectField(state, targetStepId, targetFieldName, sourceStepId, sourceFieldName),
    ok: true,
  };
}

export function availableConnections(state: EditorState, targetStepId: string, targetField?: FieldDescriptor): ConnectionCandidate[] {
  const targetIndex = state.workflow.steps.findIndex((step) => step.id === targetStepId);
  if (targetIndex < 0) return [];
  return state.workflow.steps.slice(0, targetIndex).flatMap((step) => {
    const action = getEditorAction(step.type);
    return (action?.outputFields ?? [])
      .map((field) => ({
        fromStepId: step.id,
        field,
        reference: referenceFor(step.id, field.name),
        compatible: !targetField || isCompatibleConnection(field.kind, targetField.kind),
      }))
      .filter((connection) => connection.compatible);
  });
}

export function isCompatibleConnection(sourceKind: FieldKind, targetKind: FieldKind): boolean {
  if (sourceKind === "image") return targetKind === "image";
  if (targetKind === "image") return false;
  if (targetKind === "json") return true;
  if (targetKind === "textarea") return sourceKind === "textarea" || sourceKind === "text" || sourceKind === "json";
  if (targetKind === "text") return sourceKind === "text" || sourceKind === "textarea" || sourceKind === "number" || sourceKind === "boolean";
  if (targetKind === "array") return sourceKind === "array";
  if (targetKind === "number") return sourceKind === "number";
  if (targetKind === "boolean") return sourceKind === "boolean";
  return false;
}

export function referenceFor(stepId: string, field: string): string {
  return `{{steps.${stepId}.output.${field}}}`;
}

export function getWorkflowConnections(state: EditorState): WorkflowConnection[] {
  return state.workflow.steps.flatMap((step) => {
    const input = asObject(step.input);
    return Object.entries(input).flatMap(([targetField, value]) =>
      extractFieldReferences(value).map((reference) => ({
        fromStepId: reference.stepId,
        fromField: reference.field,
        toStepId: step.id,
        toField: targetField,
      })),
    );
  });
}

export function buildMockTrace(workflow: WorkflowDocument): StepTrace[] {
  return workflow.steps.map((step, index) => ({
    id: step.id,
    type: step.type,
    input: step.input,
    output: mockOutputFor(step, index),
    status: "success",
    error: null,
    metrics: {
      startedAt: new Date(Date.now() + index * 10).toISOString(),
      endedAt: new Date(Date.now() + index * 10 + 8).toISOString(),
      durationMs: 8,
    },
  }));
}

export function addProvider(state: EditorState): EditorState {
  return updateProviderCatalog(state, (catalog) => {
    const nextProviderNumber = catalog.providers.length + 1;
    catalog.providers.push({
      id: `provider_${nextProviderNumber}`,
      label: `Provider ${nextProviderNumber}`,
      kind: "openai-compatible",
      enabled: true,
      models: [
        {
          id: "model_1",
          label: "Model 1",
          enabled: true,
          capabilities: { text: true },
        },
      ],
    });

    if (!catalog.defaultProviderId) {
      catalog.defaultProviderId = catalog.providers[0]?.id;
      catalog.defaultModelId = catalog.providers[0]?.models[0]?.id;
    }
  });
}

export function updateProviderField(
  state: EditorState,
  providerIndex: number,
  field: "id" | "label" | "kind" | "baseUrl" | "apiKeyRef" | "enabled",
  value: unknown,
): EditorState {
  return updateProviderCatalog(state, (catalog) => {
    const provider = catalog.providers[providerIndex];
    if (!provider) return;
    switch (field) {
      case "id":
        provider.id = typeof value === "string" ? value : provider.id;
        return;
      case "label":
        provider.label = typeof value === "string" ? value : provider.label;
        return;
      case "baseUrl":
        provider.baseUrl = typeof value === "string" ? value : undefined;
        return;
      case "apiKeyRef":
        provider.apiKeyRef = typeof value === "string" ? value : undefined;
        return;
      case "kind":
        provider.kind = value as typeof provider.kind;
        return;
      case "enabled":
        provider.enabled = value === true;
        return;
    }
  });
}

export function removeProvider(state: EditorState, providerIndex: number): EditorState {
  return updateProviderCatalog(state, (catalog) => {
    const [removed] = catalog.providers.splice(providerIndex, 1);
    if (!removed) return;
    if (catalog.defaultProviderId === removed.id) {
      catalog.defaultProviderId = catalog.providers[0]?.id;
      catalog.defaultModelId = catalog.providers[0]?.models[0]?.id;
    }
  });
}

export function addProviderModel(state: EditorState, providerIndex: number): EditorState {
  return updateProviderCatalog(state, (catalog) => {
    const provider = catalog.providers[providerIndex];
    if (!provider) return;
    const nextModelNumber = provider.models.length + 1;
    provider.models.push({
      id: `model_${nextModelNumber}`,
      label: `Model ${nextModelNumber}`,
      enabled: true,
      capabilities: { text: true },
    });
    if (catalog.defaultProviderId === provider.id && !catalog.defaultModelId) {
      catalog.defaultModelId = provider.models[0]?.id;
    }
  });
}

export function updateProviderModelField(
  state: EditorState,
  providerIndex: number,
  modelIndex: number,
  field: "id" | "label" | "contextWindow" | "enabled",
  value: unknown,
): EditorState {
  return updateProviderCatalog(state, (catalog) => {
    const model = catalog.providers[providerIndex]?.models[modelIndex];
    if (!model) return;
    switch (field) {
      case "id":
      case "label":
        model[field] = typeof value === "string" ? value : "";
        return;
      case "contextWindow":
        model.contextWindow = typeof value === "number" ? value : undefined;
        return;
      case "enabled":
        model.enabled = value === true;
        return;
    }
  });
}

export function updateProviderModelCapability(
  state: EditorState,
  providerIndex: number,
  modelIndex: number,
  capability: "text" | "vision" | "structuredOutput" | "tools",
  enabled: boolean,
): EditorState {
  return updateProviderCatalog(state, (catalog) => {
    const model = catalog.providers[providerIndex]?.models[modelIndex];
    if (!model) return;
    model.capabilities = { ...model.capabilities, [capability]: enabled };
  });
}

export function removeProviderModel(state: EditorState, providerIndex: number, modelIndex: number): EditorState {
  return updateProviderCatalog(state, (catalog) => {
    const provider = catalog.providers[providerIndex];
    if (!provider) return;
    const [removed] = provider.models.splice(modelIndex, 1);
    if (!removed) return;
    if (catalog.defaultProviderId === provider.id && catalog.defaultModelId === removed.id) {
      catalog.defaultModelId = provider.models[0]?.id;
    }
  });
}

export function setDefaultProvider(state: EditorState, providerId: string): EditorState {
  return updateProviderCatalog(state, (catalog) => {
    const provider = catalog.providers.find((item) => item.id === providerId);
    if (!provider) return;
    catalog.defaultProviderId = provider.id;
    catalog.defaultModelId = provider.models[0]?.id;
  });
}

export function setDefaultModel(state: EditorState, modelId: string): EditorState {
  return updateProviderCatalog(state, (catalog) => {
    catalog.defaultModelId = modelId;
  });
}

export function getLlmProviderSelection(state: EditorState, step: WorkflowStep): LlmProviderSelectionState | null {
  if (!isLlmActionType(step.type)) return null;
  return inspectLlmProviderSelection(getProviderCatalog(state), step.type, step.config);
}

export function setStepLlmProvider(state: EditorState, stepId: string, providerId: string): EditorState {
  return updateStep(state, stepId, (step) => {
    if (!isLlmActionType(step.type)) return step;
    if (!providerId) return { ...step, config: pruneEmpty(clearLlmSelectionConfig(asObject(step.config))) };

    const provider = getProviderCatalog(state).providers.find((item) => item.id === providerId);
    if (!provider) {
      return { ...step, config: pruneEmpty(writeLlmSelectionConfig(asObject(step.config), { providerId, modelId: undefined })) };
    }

    const current = readLlmNodeSelectionConfig(step.config);
    const requiredCapability = getRequiredCapabilityForAction(step.type);
    const selectable = listSelectableModels(provider, requiredCapability);
    const fallbackModelId = selectable[0]?.id ?? provider.models[0]?.id;
    const modelId = provider.models.some((model) => model.id === current.modelId) ? current.modelId : fallbackModelId;
    return { ...step, config: pruneEmpty(writeLlmSelectionConfig(asObject(step.config), { providerId, modelId })) };
  });
}

export function setStepLlmModel(state: EditorState, stepId: string, modelId: string): EditorState {
  return updateStep(state, stepId, (step) => {
    if (!isLlmActionType(step.type)) return step;
    const selection = inspectLlmProviderSelection(getProviderCatalog(state), step.type, step.config);
    const providerId = selection.explicitProviderId ?? selection.resolvedProviderId;
    if (!providerId) return step;
    return { ...step, config: pruneEmpty(writeLlmSelectionConfig(asObject(step.config), { providerId, modelId })) };
  });
}

export function getProviderCatalog(state: EditorState): ProviderCatalog {
  return state.workflow.providerCatalog ?? createDefaultProviderCatalog();
}

function mockOutputFor(step: WorkflowStep, index: number): unknown {
  switch (step.type) {
    case "io.read_file": return { path: asObject(step.input).path ?? "input.txt", content: "Preview file content", bytes: 20 };
    case "io.read_image": {
      const path = asObject(step.input).path ?? "input.png";
      const image = { path, mimeType: "image/png", bytes: 128, width: 1, height: 1 };
      return { ...image, image };
    }
    case "llm.prompt": return { text: asObject(step.input).prompt || "Preview prompt response" };
    case "llm.vision_analyze": return { text: "Preview image analysis" };
    case "llm.ocr": return { text: "Preview OCR text" };
    case "llm.summarize": return { summary: "Preview summary", sentenceCount: 2 };
    case "control.fanout": return { results: [] };
    case "control.fanin": return { strategy: asObject(step.config).strategy ?? "merge", output: [], count: 0 };
    case "eval.exact_match": return { matched: true, actual: asObject(step.input).actual, expected: asObject(step.input).expected };
    default: return { index };
  }
}

function updateStep(state: EditorState, stepId: string, fn: (step: WorkflowStep) => WorkflowStep): EditorState {
  return { ...state, workflow: { ...state.workflow, steps: state.workflow.steps.map((step) => step.id === stepId ? fn(step) : step) } };
}

function updateProviderCatalog(state: EditorState, mutate: (catalog: ProviderCatalog) => void): EditorState {
  const catalog = cloneProviderCatalog(getProviderCatalog(state));
  mutate(catalog);
  return {
    ...state,
    workflow: {
      ...state.workflow,
      providerCatalog: catalog,
    },
  };
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function pruneEmpty(value: JsonObject): JsonObject | undefined {
  const entries = Object.entries(value)
    .map(([key, item]) => [key, item && typeof item === "object" && !Array.isArray(item) ? pruneEmpty(item as JsonObject) : item] as const)
    .filter(([, item]) => item !== "" && item !== undefined);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function setPath(source: JsonObject, path: string[], value: unknown): JsonObject {
  const [head, ...tail] = path;
  if (!head) return source;
  if (tail.length === 0) return { ...source, [head]: value };
  return {
    ...source,
    [head]: setPath(asObject(source[head]), tail, value),
  };
}

function extractFieldReferences(value: unknown): Array<{ stepId: string; field: string }> {
  if (typeof value !== "string") return [];
  return [...value.matchAll(/{{\s*steps\.([A-Za-z0-9_-]+)\.output\.([A-Za-z0-9_.-]+)\s*}}/g)]
    .map((match) => ({ stepId: match[1]!, field: match[2]! }));
}

function writeLlmSelectionConfig(config: JsonObject, selection: { providerId?: string; modelId?: string }): JsonObject {
  const next = { ...config };
  if (selection.providerId) next.providerId = selection.providerId;
  else delete next.providerId;
  if (selection.modelId) next.modelId = selection.modelId;
  else delete next.modelId;
  return next;
}

function clearLlmSelectionConfig(config: JsonObject): JsonObject {
  const next = { ...config };
  delete next.providerId;
  delete next.modelId;
  return next;
}

function cloneProviderCatalog(catalog: ProviderCatalog): ProviderCatalog {
  return {
    defaultProviderId: catalog.defaultProviderId,
    defaultModelId: catalog.defaultModelId,
    providers: catalog.providers.map((provider) => ({
      ...provider,
      models: provider.models.map((model) => ({
        ...model,
        capabilities: model.capabilities ? { ...model.capabilities } : undefined,
      })),
    })),
  };
}

function defaultNodePosition(index: number): NodePosition {
  const column = index % nodeLayout.maxColumns;
  const row = Math.floor(index / nodeLayout.maxColumns);
  return {
    x: nodeLayout.startX + column * nodeLayout.gapX,
    y: nodeLayout.startY + row * nodeLayout.gapY,
  };
}
