import type { LocaleResources } from "./types.js";

export const en: LocaleResources = {
  localeName: "English",
  ui: {
    "app.subtitle": "Visual editor preview",
    "actions.title": "Actions",
    "common.config": "Config",
    "common.input": "input",
    "common.inputs": "Inputs",
    "common.output": "output",
    "common.outputs": "Outputs",
    "common.type": "Type",
    "editor.connectOutput": "Connect upstream output...",
    "editor.dragNode": "Drag node",
    "editor.noSelection": "Select a node to edit inputs, config, and connections.",
    "editor.notConnectable": "This input is not connectable",
    "field.requiredSuffix": " *",
    "locale.label": "Language",
    "run.copyYaml": "Copy YAML",
    "run.empty": "No saved runs yet",
    "run.loading": "Loading {runId}...",
    "run.noSavedRuns": "No saved runs yet",
    "run.ready": "Ready",
    "run.refresh": "Refresh",
    "run.runWorkflow": "Run Workflow",
    "run.running": "Running",
    "run.runningWorkflow": "Running workflow...",
    "run.savedRuns": "{count} saved run(s)",
    "run.title": "Runs",
    "run.unavailable": "Run API unavailable. Use diy-workflow serve after building the UI.",
    "run.inspectHint": "Run the workflow or select a saved run to inspect step status, outputs, errors, and metrics.",
    "step.delete": "Delete step",
    "step.id": "Step id",
    "yaml.title": "YAML",
  },
  actions: {
    "io.read_file": {
      label: "Read File",
      description: "Read a local file and emit extracted text, path, and byte count.",
      inputFields: { path: { label: "Path", placeholder: "input.txt" } },
      configFields: {
        "mock.enabled": { label: "Mock mode" },
        "mock.path": { label: "Mock path", placeholder: "mock/input.txt" },
        "mock.content": { label: "Mock content", placeholder: "Optional file content" },
        "mock.bytes": { label: "Mock bytes" },
      },
      outputFields: {
        path: { label: "Path" },
        content: { label: "Content" },
        bytes: { label: "Bytes" },
      },
    },
    "io.read_image": {
      label: "Read Image",
      description: "Read a local image and emit a structured image artifact.",
      inputFields: { path: { label: "Path", placeholder: "input.png" } },
      configFields: {
        "mock.enabled": { label: "Mock mode" },
        "mock.path": { label: "Mock path", placeholder: "mock/input.png" },
        "mock.mimeType": { label: "Mock MIME type", placeholder: "image/png" },
        "mock.bytes": { label: "Mock bytes" },
        "mock.width": { label: "Mock width" },
        "mock.height": { label: "Mock height" },
        "mock.image": { label: "Mock image" },
      },
      outputFields: {
        path: { label: "Path" },
        mimeType: { label: "MIME type" },
        bytes: { label: "Bytes" },
        width: { label: "Width" },
        height: { label: "Height" },
        image: { label: "Image" },
      },
    },
    "llm.prompt": {
      label: "Prompt",
      description: "Prompt an AI model. MVP uses deterministic mock output.",
      inputFields: { prompt: { label: "Prompt", placeholder: "Write a concise answer about {{input}}" } },
      configFields: {
        "mock.enabled": { label: "Mock mode" },
        "mock.response": { label: "Mock response", placeholder: "Optional deterministic response" },
      },
      outputFields: {
        text: { label: "Text" },
      },
    },
    "llm.vision_analyze": {
      label: "Vision Analyze",
      description: "Analyze an image and describe what it contains.",
      inputFields: {
        image: { label: "Image" },
        prompt: { label: "Prompt", placeholder: "Describe what matters in this image" },
      },
      configFields: {
        "mock.enabled": { label: "Mock mode" },
        "mock.response": { label: "Mock response", placeholder: "Optional deterministic response" },
      },
      outputFields: {
        text: { label: "Text" },
      },
    },
    "llm.ocr": {
      label: "OCR",
      description: "Extract text from an image.",
      inputFields: {
        image: { label: "Image" },
      },
      configFields: {
        "mock.enabled": { label: "Mock mode" },
        "mock.response": { label: "Mock response", placeholder: "Optional deterministic response" },
      },
      outputFields: {
        text: { label: "Text" },
      },
    },
    "llm.summarize": {
      label: "Summarize",
      description: "Summarize text with model-facing controls.",
      inputFields: { text: { label: "Text", placeholder: "Paste or connect text" } },
      configFields: {
        maxSentences: { label: "Max sentences", placeholder: "3" },
        maxChars: { label: "Max characters" },
        "mock.enabled": { label: "Mock mode" },
        "mock.summary": { label: "Mock summary" },
        "mock.sentenceCount": { label: "Mock sentence count" },
      },
      outputFields: {
        summary: { label: "Summary" },
        sentenceCount: { label: "Sentence count" },
      },
    },
    "control.fanout": {
      label: "Fanout",
      description: "Run multiple branches with the same input.",
      inputFields: {
        value: { label: "Value" },
        branches: { label: "Branches" },
      },
      configFields: {
        "mock.enabled": { label: "Mock mode" },
        "mock.results": { label: "Mock results" },
      },
      outputFields: { results: { label: "Results" } },
    },
    "control.fanin": {
      label: "Fanin",
      description: "Merge fanout outputs.",
      inputFields: { items: { label: "Items" } },
      configFields: {
        strategy: { label: "Strategy", placeholder: "merge | first_success" },
        "mock.enabled": { label: "Mock mode" },
        "mock.strategy": { label: "Mock strategy", placeholder: "merge | first_success" },
        "mock.output": { label: "Mock output" },
        "mock.count": { label: "Mock count" },
      },
      outputFields: {
        strategy: { label: "Strategy" },
        output: { label: "Output" },
        count: { label: "Count" },
      },
    },
    "eval.exact_match": {
      label: "Exact Match",
      description: "Compare two values exactly.",
      inputFields: {
        actual: { label: "Actual" },
        expected: { label: "Expected" },
      },
      configFields: {
        "mock.enabled": { label: "Mock mode" },
        "mock.matched": { label: "Mock matched" },
        "mock.actual": { label: "Mock actual" },
        "mock.expected": { label: "Mock expected" },
      },
      outputFields: {
        matched: { label: "Matched" },
        actual: { label: "Actual" },
        expected: { label: "Expected" },
      },
    },
  },
};
