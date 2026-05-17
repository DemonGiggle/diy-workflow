import type { EditorActionDefinition, FieldDescriptor, OutputDescriptor } from "./actionCatalog.js";

export const supportedLocales = ["en", "zh-TW"] as const;

export type Locale = typeof supportedLocales[number];

export interface LocaleOption {
  locale: Locale;
  label: string;
}

type UiStringKey =
  | "app.subtitle"
  | "actions.title"
  | "common.config"
  | "common.input"
  | "common.inputs"
  | "common.output"
  | "common.outputs"
  | "common.type"
  | "editor.connectOutput"
  | "editor.dragNode"
  | "editor.noSelection"
  | "editor.notConnectable"
  | "field.requiredSuffix"
  | "locale.label"
  | "run.copyYaml"
  | "run.empty"
  | "run.loading"
  | "run.noSavedRuns"
  | "run.ready"
  | "run.refresh"
  | "run.runWorkflow"
  | "run.running"
  | "run.runningWorkflow"
  | "run.savedRuns"
  | "run.title"
  | "run.unavailable"
  | "run.inspectHint"
  | "step.delete"
  | "step.id"
  | "yaml.title";

type ActionFieldTranslations = Record<string, { label: string; placeholder?: string }>;

interface ActionTranslation {
  label: string;
  description: string;
  inputFields?: ActionFieldTranslations;
  configFields?: ActionFieldTranslations;
  outputFields?: Record<string, { label: string }>;
}

interface LocaleResources {
  localeName: string;
  ui: Record<UiStringKey, string>;
  actions: Record<string, ActionTranslation>;
}

export const resources: Record<Locale, LocaleResources> = {
  en: {
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
          provider: { label: "Provider" },
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
  },
  "zh-TW": {
    localeName: "繁體中文",
    ui: {
      "app.subtitle": "視覺化編輯器預覽",
      "actions.title": "動作",
      "common.config": "設定",
      "common.input": "輸入",
      "common.inputs": "輸入",
      "common.output": "輸出",
      "common.outputs": "輸出",
      "common.type": "類型",
      "editor.connectOutput": "連接上游輸出...",
      "editor.dragNode": "拖拉節點",
      "editor.noSelection": "選取節點來編輯輸入、設定與連線。",
      "editor.notConnectable": "這個輸入不能連線",
      "field.requiredSuffix": " *",
      "locale.label": "語言",
      "run.copyYaml": "複製 YAML",
      "run.empty": "目前沒有儲存的執行紀錄",
      "run.loading": "載入 {runId}...",
      "run.noSavedRuns": "目前沒有儲存的執行紀錄",
      "run.ready": "就緒",
      "run.refresh": "重新整理",
      "run.runWorkflow": "執行 workflow",
      "run.running": "執行中",
      "run.runningWorkflow": "正在執行 workflow...",
      "run.savedRuns": "已儲存 {count} 筆執行紀錄",
      "run.title": "執行紀錄",
      "run.unavailable": "Run API 無法使用。請先建置 UI 後執行 diy-workflow serve。",
      "run.inspectHint": "執行 workflow 或選取已儲存紀錄，以檢視步驟狀態、輸出、錯誤與 metrics。",
      "step.delete": "刪除步驟",
      "step.id": "步驟 ID",
      "yaml.title": "YAML",
    },
    actions: {
      "io.read_file": {
        label: "讀取檔案",
        description: "讀取本機檔案，輸出擷取的文字、路徑與位元組數。",
        inputFields: { path: { label: "路徑", placeholder: "input.txt" } },
        configFields: {
          "mock.enabled": { label: "Mock 模式" },
          "mock.path": { label: "Mock 路徑", placeholder: "mock/input.txt" },
          "mock.content": { label: "Mock 內容", placeholder: "選填的檔案內容" },
          "mock.bytes": { label: "Mock 位元組數" },
        },
        outputFields: {
          path: { label: "路徑" },
          content: { label: "內容" },
          bytes: { label: "位元組數" },
        },
      },
      "llm.prompt": {
        label: "提示詞",
        description: "向 AI model 發送 prompt。MVP 使用可重現的 mock 輸出。",
        inputFields: { prompt: { label: "提示詞", placeholder: "請針對 {{input}} 寫出精簡回答" } },
        configFields: {
          "mock.enabled": { label: "Mock 模式" },
          "mock.response": { label: "Mock 回應", placeholder: "選填的固定回應" },
        },
        outputFields: {
          text: { label: "文字" },
          provider: { label: "Provider" },
        },
      },
      "llm.summarize": {
        label: "摘要",
        description: "使用面向 model 的設定摘要文字。",
        inputFields: { text: { label: "文字", placeholder: "貼上或連接文字" } },
        configFields: {
          maxSentences: { label: "最大句數", placeholder: "3" },
          maxChars: { label: "最大字元數" },
          "mock.enabled": { label: "Mock 模式" },
          "mock.summary": { label: "Mock 摘要" },
          "mock.sentenceCount": { label: "Mock 句數" },
        },
        outputFields: {
          summary: { label: "摘要" },
          sentenceCount: { label: "句數" },
        },
      },
      "control.fanout": {
        label: "Fanout",
        description: "用相同輸入執行多個分支。",
        inputFields: {
          value: { label: "值" },
          branches: { label: "分支" },
        },
        configFields: {
          "mock.enabled": { label: "Mock 模式" },
          "mock.results": { label: "Mock 結果" },
        },
        outputFields: { results: { label: "結果" } },
      },
      "control.fanin": {
        label: "Fanin",
        description: "合併 fanout 輸出。",
        inputFields: { items: { label: "項目" } },
        configFields: {
          strategy: { label: "策略", placeholder: "merge | first_success" },
          "mock.enabled": { label: "Mock 模式" },
          "mock.strategy": { label: "Mock 策略", placeholder: "merge | first_success" },
          "mock.output": { label: "Mock 輸出" },
          "mock.count": { label: "Mock 數量" },
        },
        outputFields: {
          strategy: { label: "策略" },
          output: { label: "輸出" },
          count: { label: "數量" },
        },
      },
      "eval.exact_match": {
        label: "完全比對",
        description: "精確比較兩個值。",
        inputFields: {
          actual: { label: "實際值" },
          expected: { label: "預期值" },
        },
        configFields: {
          "mock.enabled": { label: "Mock 模式" },
          "mock.matched": { label: "Mock 比對結果" },
          "mock.actual": { label: "Mock 實際值" },
          "mock.expected": { label: "Mock 預期值" },
        },
        outputFields: {
          matched: { label: "是否符合" },
          actual: { label: "實際值" },
          expected: { label: "預期值" },
        },
      },
    },
  },
};

export const localeOptions: LocaleOption[] = supportedLocales.map((locale) => ({
  locale,
  label: resources[locale].localeName,
}));

export function isLocale(value: string): value is Locale {
  return (supportedLocales as readonly string[]).includes(value);
}

export function createTranslator(locale: Locale): (key: UiStringKey, values?: Record<string, string | number>) => string {
  return (key, values = {}) => {
    const template = resources[locale].ui[key] ?? resources.en.ui[key] ?? key;
    return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template);
  };
}

export function localizeAction(action: EditorActionDefinition, locale: Locale): EditorActionDefinition {
  const localized = resources[locale].actions[action.type] ?? resources.en.actions[action.type];
  if (!localized) return action;
  return {
    ...action,
    label: localized.label,
    description: localized.description,
    inputFields: action.inputFields.map((field) => localizeField(field, localized.inputFields)),
    configFields: action.configFields.map((field) => localizeField(field, localized.configFields)),
    outputFields: action.outputFields.map((field) => localizeOutput(field, localized.outputFields)),
  };
}

export function localizeActions(actions: EditorActionDefinition[], locale: Locale): EditorActionDefinition[] {
  return actions.map((action) => localizeAction(action, locale));
}

function localizeField(field: FieldDescriptor, translations?: ActionFieldTranslations): FieldDescriptor {
  const translation = translations?.[field.name];
  if (!translation) return field;
  return {
    ...field,
    label: translation.label,
    placeholder: translation.placeholder ?? field.placeholder,
  };
}

function localizeOutput(field: OutputDescriptor, translations?: Record<string, { label: string }>): OutputDescriptor {
  const translation = translations?.[field.name];
  return translation ? { ...field, label: translation.label } : field;
}
