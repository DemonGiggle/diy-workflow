import { Ajv } from "ajv";
import type { ActionRegistry } from "./registry.js";
import { extractReferences } from "./references.js";
import type { ValidationIssue, ValidationResult, WorkflowDocument, WorkflowStep } from "./types.js";

const workflowSchema = {
  type: "object",
  additionalProperties: false,
  required: ["steps"],
  properties: {
    name: { type: "string", nullable: true },
    steps: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "type", "input"],
        properties: {
          id: { type: "string", minLength: 1, pattern: "^[A-Za-z0-9_-]+$" },
          type: { type: "string", minLength: 1 },
          input: {},
          config: { type: "object", nullable: true, additionalProperties: true },
        },
      },
    },
  },
};

export class WorkflowValidator {
  private readonly ajv = new Ajv({ allErrors: true, strict: false });

  constructor(private readonly registry: ActionRegistry) {}

  validate(workflow: WorkflowDocument): ValidationResult {
    const issues: ValidationIssue[] = [];
    this.validateShape(workflow, issues);
    if (!Array.isArray(workflow.steps)) return { ok: false, issues };

    this.validateUniqueStepIds(workflow.steps, issues);
    this.validateActionsAndSchemas(workflow.steps, issues);
    this.validateReferences(workflow.steps, issues);

    return { ok: issues.length === 0, issues };
  }

  private validateShape(workflow: WorkflowDocument, issues: ValidationIssue[]): void {
    const validate = this.ajv.compile(workflowSchema);
    if (!validate(workflow)) {
      for (const error of validate.errors ?? []) {
        issues.push({ path: error.instancePath || "/", message: error.message ?? "invalid workflow" });
      }
    }
  }

  private validateUniqueStepIds(steps: WorkflowStep[], issues: ValidationIssue[]): void {
    const seen = new Set<string>();
    steps.forEach((step, index) => {
      if (seen.has(step.id)) issues.push({ path: `/steps/${index}/id`, message: `Duplicate step id: ${step.id}` });
      seen.add(step.id);
    });
  }

  private validateActionsAndSchemas(steps: WorkflowStep[], issues: ValidationIssue[]): void {
    steps.forEach((step, index) => {
      const action = this.registry.get(step.type);
      if (!action) {
        issues.push({ path: `/steps/${index}/type`, message: `Unknown action type: ${step.type}` });
        return;
      }

      if (!containsReference(step.input)) {
        const validateInput = this.ajv.compile(action.inputSchema);
        if (!validateInput(step.input)) {
          for (const error of validateInput.errors ?? []) {
            issues.push({ path: `/steps/${index}/input${error.instancePath}`, message: error.message ?? "invalid input" });
          }
        }
      }

      if (step.config && action.configSchema) {
        const validateConfig = this.ajv.compile(action.configSchema);
        if (!validateConfig(step.config)) {
          for (const error of validateConfig.errors ?? []) {
            issues.push({ path: `/steps/${index}/config${error.instancePath}`, message: error.message ?? "invalid config" });
          }
        }
      }
    });
  }

  private validateReferences(steps: WorkflowStep[], issues: ValidationIssue[]): void {
    const prior = new Set<string>();
    steps.forEach((step, index) => {
      const refs = extractReferences(step.input);
      for (const ref of refs) {
        if (!prior.has(ref.stepId)) {
          issues.push({
            path: `/steps/${index}/input`,
            message: `Invalid reference: steps.${ref.stepId}.output is not available before step ${step.id}`,
          });
        }
      }
      prior.add(step.id);
    });
  }
}

function containsReference(value: unknown): boolean {
  return extractReferences(value).length > 0;
}
