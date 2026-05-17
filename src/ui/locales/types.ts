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
