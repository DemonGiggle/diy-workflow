import type { JsonObject, WorkflowStep } from "../types.js";

export interface FieldDescriptor {
  name: string;
  label: string;
  kind: "text" | "textarea" | "number" | "json" | "array";
  required?: boolean;
  connectable?: boolean;
  placeholder?: string;
}

export interface EditorActionDefinition {
  type: string;
  namespace: string;
  label: string;
  description: string;
  inputFields: FieldDescriptor[];
  configFields: FieldDescriptor[];
  outputFields: string[];
  createInput(): unknown;
  createConfig?(): JsonObject;
}

export const editorActions: EditorActionDefinition[] = [
  {
    type: "io.read_file",
    namespace: "io",
    label: "Read File",
    description: "Read a text file and emit content, path, and byte count.",
    inputFields: [{ name: "path", label: "Path", kind: "text", required: true, placeholder: "input.txt" }],
    configFields: [],
    outputFields: ["path", "content", "bytes"],
    createInput: () => ({ path: "input.txt" }),
  },
  {
    type: "llm.prompt",
    namespace: "llm",
    label: "Prompt",
    description: "Prompt an AI model. MVP uses deterministic mock output.",
    inputFields: [{ name: "prompt", label: "Prompt", kind: "textarea", required: true, connectable: true, placeholder: "Write a concise answer about {{input}}" }],
    configFields: [{ name: "mockResponse", label: "Mock response", kind: "textarea", placeholder: "Optional deterministic response" }],
    outputFields: ["text", "provider"],
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
    ],
    outputFields: ["summary", "sentenceCount"],
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
    configFields: [],
    outputFields: ["results"],
    createInput: () => ({ value: {}, branches: [] }),
  },
  {
    type: "control.fanin",
    namespace: "control",
    label: "Fanin",
    description: "Merge fanout outputs.",
    inputFields: [{ name: "items", label: "Items", kind: "json", required: true, connectable: true }],
    configFields: [{ name: "strategy", label: "Strategy", kind: "text", placeholder: "merge | first_success" }],
    outputFields: ["strategy", "output", "count"],
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
    configFields: [],
    outputFields: ["matched", "actual", "expected"],
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

