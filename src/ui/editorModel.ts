import type { JsonObject, StepTrace, WorkflowDocument, WorkflowStep } from "../types.js";
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

export function createInitialEditorState(): EditorState {
  const read = createStep("io.read_file", 0);
  const prompt = createStep("llm.prompt", 1);
  const summarize = createStep("llm.summarize", 2);
  prompt.input = { prompt: referenceFor(read.id, "content") };
  summarize.input = { text: referenceFor(prompt.id, "text") };
  return {
    workflow: { name: "visual-workflow", steps: [read, prompt, summarize] },
    selectedStepId: prompt.id,
    positions: {
      [read.id]: { x: 72, y: 92 },
      [prompt.id]: { x: 420, y: 92 },
      [summarize.id]: { x: 768, y: 92 },
    },
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

function mockOutputFor(step: WorkflowStep, index: number): unknown {
  switch (step.type) {
    case "io.read_file": return { path: asObject(step.input).path ?? "input.txt", content: "Preview file content", bytes: 20 };
    case "llm.prompt": return { text: asObject(step.input).prompt || "Preview prompt response" };
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
