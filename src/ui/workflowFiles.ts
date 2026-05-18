import YAML from "yaml";
import type { ValidationIssue, WorkflowDocument } from "../types.js";

export function parseWorkflowYaml(text: string): WorkflowDocument {
  const document = YAML.parseDocument(text, { prettyErrors: true });
  if (document.errors.length > 0) {
    throw new Error(document.errors.map((error) => error.message).join("; "));
  }

  const workflow = document.toJS();
  if (!isWorkflowDocument(workflow)) {
    throw new Error("YAML must define a workflow object with a steps array.");
  }

  return workflow;
}

export function formatValidationIssues(issues: ValidationIssue[]): string {
  const preview = issues
    .slice(0, 3)
    .map((issue) => `${issue.path === "/" ? "workflow" : issue.path}: ${issue.message}`)
    .join("; ");
  return issues.length > 3 ? `${preview}; +${issues.length - 3} more` : preview;
}

export function suggestWorkflowFileName(workflow: WorkflowDocument): string {
  const rawName = workflow.name?.trim() || "workflow";
  const fileName = rawName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const baseName = fileName || "workflow";
  return baseName.endsWith(".yaml") || baseName.endsWith(".yml") ? baseName : `${baseName}.yaml`;
}

function isWorkflowDocument(value: unknown): value is WorkflowDocument {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && Array.isArray((value as { steps?: unknown }).steps);
}
