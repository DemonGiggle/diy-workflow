import type { JsonObject, WorkflowStep } from "../types.js";

export interface FieldDescriptor {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  connectable?: boolean;
  placeholder?: string;
}

export type FieldKind = "text" | "textarea" | "number" | "boolean" | "json" | "array";

export interface OutputDescriptor {
  name: string;
  label: string;
  kind: FieldKind;
}

export interface EditorActionDefinition {
  type: string;
  namespace: string;
  label: string;
  description: string;
  inputFields: FieldDescriptor[];
  configFields: FieldDescriptor[];
  outputFields: OutputDescriptor[];
  createInput(): unknown;
  createConfig?(): JsonObject;
}

export const editorActions: EditorActionDefinition[] = [
  {
    type: "io.read_file",
    namespace: "io",
    label: "Read File",
    description: "Read a local file and emit extracted text, path, and byte count.",
    inputFields: [{ name: "path", label: "Path", kind: "text", required: true, placeholder: "input.txt" }],
    configFields: [
      { name: "mock.enabled", label: "Mock mode", kind: "boolean" },
      { name: "mock.path", label: "Mock path", kind: "text", placeholder: "mock/input.txt" },
      { name: "mock.content", label: "Mock content", kind: "textarea", placeholder: "Optional file content" },
      { name: "mock.bytes", label: "Mock bytes", kind: "number" },
    ],
    outputFields: [
      { name: "path", label: "Path", kind: "text" },
      { name: "content", label: "Content", kind: "textarea" },
      { name: "bytes", label: "Bytes", kind: "number" },
    ],
    createInput: () => ({ path: "input.txt" }),
  },
  {
    type: "llm.prompt",
    namespace: "llm",
    label: "Prompt",
    description: "Prompt an AI model. MVP uses deterministic mock output.",
    inputFields: [{ name: "prompt", label: "Prompt", kind: "textarea", required: true, connectable: true, placeholder: "Write a concise answer about {{input}}" }],
    configFields: [
      { name: "mock.enabled", label: "Mock mode", kind: "boolean" },
      { name: "mock.response", label: "Mock response", kind: "textarea", placeholder: "Optional deterministic response" },
    ],
    outputFields: [
      { name: "text", label: "Text", kind: "textarea" },
      { name: "provider", label: "Provider", kind: "text" },
    ],
    createInput: () => ({ prompt: "" }),
    createConfig: () => ({}),
  },
  {
    type: "llm.summarize",
    namespace: "llm",
    label: "Summarize",
    description: "Summarize text with model-facing controls.",
    inputFields: [{ name: "text", label: "Text", kind: "textarea", required: true, connectable: true, placeholder: "Paste or connect text" }],
    configFields: [
      { name: "maxSentences", label: "Max sentences", kind: "number", placeholder: "3" },
      { name: "maxChars", label: "Max characters", kind: "number" },
      { name: "mock.enabled", label: "Mock mode", kind: "boolean" },
      { name: "mock.summary", label: "Mock summary", kind: "textarea" },
      { name: "mock.sentenceCount", label: "Mock sentence count", kind: "number" },
    ],
    outputFields: [
      { name: "summary", label: "Summary", kind: "textarea" },
      { name: "sentenceCount", label: "Sentence count", kind: "number" },
    ],
    createInput: () => ({ text: "" }),
    createConfig: () => ({ maxSentences: 3 }),
  },
  {
    type: "control.fanout",
    namespace: "control",
    label: "Fanout",
    description: "Run multiple branches with the same input.",
    inputFields: [
      { name: "value", label: "Value", kind: "json", connectable: true },
      { name: "branches", label: "Branches", kind: "array", required: true },
    ],
    configFields: [
      { name: "mock.enabled", label: "Mock mode", kind: "boolean" },
      { name: "mock.results", label: "Mock results", kind: "array" },
    ],
    outputFields: [{ name: "results", label: "Results", kind: "array" }],
    createInput: () => ({ value: {}, branches: [] }),
  },
  {
    type: "control.fanin",
    namespace: "control",
    label: "Fanin",
    description: "Merge fanout outputs.",
    inputFields: [{ name: "items", label: "Items", kind: "json", required: true, connectable: true }],
    configFields: [
      { name: "strategy", label: "Strategy", kind: "text", placeholder: "merge | first_success" },
      { name: "mock.enabled", label: "Mock mode", kind: "boolean" },
      { name: "mock.strategy", label: "Mock strategy", kind: "text", placeholder: "merge | first_success" },
      { name: "mock.output", label: "Mock output", kind: "json" },
      { name: "mock.count", label: "Mock count", kind: "number" },
    ],
    outputFields: [
      { name: "strategy", label: "Strategy", kind: "text" },
      { name: "output", label: "Output", kind: "json" },
      { name: "count", label: "Count", kind: "number" },
    ],
    createInput: () => ({ items: [] }),
    createConfig: () => ({ strategy: "merge" }),
  },
  {
    type: "eval.exact_match",
    namespace: "eval",
    label: "Exact Match",
    description: "Compare two values exactly.",
    inputFields: [
      { name: "actual", label: "Actual", kind: "json", required: true, connectable: true },
      { name: "expected", label: "Expected", kind: "json", required: true, connectable: true },
    ],
    configFields: [
      { name: "mock.enabled", label: "Mock mode", kind: "boolean" },
      { name: "mock.matched", label: "Mock matched", kind: "boolean" },
      { name: "mock.actual", label: "Mock actual", kind: "json" },
      { name: "mock.expected", label: "Mock expected", kind: "json" },
    ],
    outputFields: [
      { name: "matched", label: "Matched", kind: "boolean" },
      { name: "actual", label: "Actual", kind: "json" },
      { name: "expected", label: "Expected", kind: "json" },
    ],
    createInput: () => ({ actual: "", expected: "" }),
  },
];

export function getEditorAction(type: string): EditorActionDefinition | undefined {
  return editorActions.find((action) => action.type === type);
}

export function createStep(type: string, index: number): WorkflowStep {
  const action = getEditorAction(type);
  if (!action) throw new Error(`Unknown editor action: ${type}`);
  const id = `${type.replace(/[^A-Za-z0-9]+/g, "_")}_${index + 1}`;
  const config = action.createConfig?.();
  return { id, type, input: action.createInput(), ...(config ? { config } : {}) };
}
