export type UiStringKey =
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
  | "llm.model"
  | "llm.noModels"
  | "llm.provider"
  | "llm.selection"
  | "llm.selectionDefault"
  | "llm.selectionInvalid"
  | "providers.addModel"
  | "providers.addProvider"
  | "providers.apiKeyRef"
  | "providers.baseUrl"
  | "providers.capabilities"
  | "providers.capability.structuredOutput"
  | "providers.capability.text"
  | "providers.capability.tools"
  | "providers.capability.vision"
  | "providers.contextWindow"
  | "providers.defaultModel"
  | "providers.defaultProvider"
  | "providers.defaults"
  | "providers.deleteModel"
  | "providers.deleteProvider"
  | "providers.enabled"
  | "providers.empty"
  | "providers.modelId"
  | "providers.modelLabel"
  | "providers.providerId"
  | "providers.providerKind"
  | "providers.providerLabel"
  | "providers.title"
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
  | "view.providers"
  | "view.workflow"
  | "yaml.downloadAction"
  | "yaml.downloaded"
  | "yaml.loadAction"
  | "yaml.loadFailed"
  | "yaml.loaded"
  | "yaml.saveAction"
  | "yaml.saveFailed"
  | "yaml.saved"
  | "yaml.title";

export type ActionFieldTranslations = Record<string, { label: string; placeholder?: string }>;

export interface ActionTranslation {
  label: string;
  description: string;
  inputFields?: ActionFieldTranslations;
  configFields?: ActionFieldTranslations;
  outputFields?: Record<string, { label: string }>;
}

export interface LocaleResources {
  localeName: string;
  ui: Record<UiStringKey, string>;
  actions: Record<string, ActionTranslation>;
}
