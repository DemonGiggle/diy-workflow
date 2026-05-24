import type { WorkflowStep } from "../types.js";

export function isLlmProviderSelectionDisabled(step: WorkflowStep): boolean {
  const mock = step.config?.["mock"] as Record<string, unknown> | undefined;
  return mock?.["enabled"] === true;
}
