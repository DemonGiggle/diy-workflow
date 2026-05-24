import type { WorkflowStep } from "../types.js";

export function isLlmProviderSelectionDisabled(step: WorkflowStep): boolean {
  const mock = step.config && typeof step.config === "object" && !Array.isArray(step.config)
    ? (step.config as Record<string, unknown>).mock
    : undefined;
  return !!mock && typeof mock === "object" && !Array.isArray(mock) && (mock as Record<string, unknown>).enabled === true;
}
