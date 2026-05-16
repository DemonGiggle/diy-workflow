import type { JsonObject, StepTrace, WorkflowDocument, WorkflowStep } from "../types.js";
import { createStep, getEditorAction } from "./actionCatalog.js";

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
  field: string;
  reference: string;
}

export function createInitialEditorState(): EditorState {
  const read = createStep("io.read_file", 0);
  const summarize = createStep("llm.summarize", 1);
  summarize.input = { text: referenceFor(read.id, "content") };
  return {
    workflow: { name: "visual-workflow", steps: [read, summarize] },
    selectedStepId: summarize.id,
    positions: {
      [read.id]: { x: 72, y: 92 },
      [summarize.id]: { x: 420, y: 92 },
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
    config: pruneEmpty({ ...step.config, [field]: value }),
  }));
}

export function connectField(state: EditorState, targetStepId: string, targetField: string, sourceStepId: string, sourceField: string): EditorState {
  return updateStepInput(state, targetStepId, targetField, referenceFor(sourceStepId, sourceField));
}

export function availableConnections(state: EditorState, targetStepId: string): ConnectionCandidate[] {
  const targetIndex = state.workflow.steps.findIndex((step) => step.id === targetStepId);
  if (targetIndex < 0) return [];
  return state.workflow.steps.slice(0, targetIndex).flatMap((step) => {
    const action = getEditorAction(step.type);
    return (action?.outputFields ?? []).map((field) => ({ fromStepId: step.id, field, reference: referenceFor(step.id, field) }));
  });
}

export function referenceFor(stepId: string, field: string): string {
  return `{{steps.${stepId}.output.${field}}}`;
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
    case "llm.prompt": return { text: asObject(step.input).prompt || "Preview prompt response", provider: "mock" };
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
  const entries = Object.entries(value).filter(([, item]) => item !== "" && item !== undefined);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

