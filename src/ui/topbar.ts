import type { UiStringKey } from "./locales/types.js";

export type TopbarActionId =
  | "open-workflow"
  | "save-workflow"
  | "copy-yaml"
  | "validate-workflow"
  | "run-workflow"
  | "show-latest-run"
  | "refresh-runs";

export interface TopbarActionDescriptor {
  id: TopbarActionId;
  labelKey: UiStringKey;
  emphasis: "primary" | "secondary";
}

export interface TopbarLayout {
  workflowMenuActions: TopbarActionDescriptor[];
  runActions: TopbarActionDescriptor[];
  moreMenuActions: TopbarActionDescriptor[];
}

export function createTopbarLayout(options: { saveUsesFileSystemApi: boolean; hasRuns: boolean }): TopbarLayout {
  return {
    workflowMenuActions: [
      { id: "open-workflow", labelKey: "yaml.loadAction", emphasis: "secondary" },
      { id: "save-workflow", labelKey: options.saveUsesFileSystemApi ? "yaml.saveAction" : "yaml.downloadAction", emphasis: "secondary" },
      { id: "copy-yaml", labelKey: "run.copyYaml", emphasis: "secondary" },
    ],
    runActions: [
      { id: "validate-workflow", labelKey: "run.validateWorkflow", emphasis: "secondary" },
      { id: "run-workflow", labelKey: "run.runWorkflow", emphasis: "primary" },
    ],
    moreMenuActions: [
      ...(options.hasRuns ? [{ id: "show-latest-run", labelKey: "run.openLatest", emphasis: "secondary" } satisfies TopbarActionDescriptor] : []),
      { id: "refresh-runs", labelKey: "run.refresh", emphasis: "secondary" },
    ],
  };
}
