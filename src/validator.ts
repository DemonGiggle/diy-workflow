import { Ajv } from "ajv";
import type { ActionRegistry } from "./registry.js";
import type { ProviderCatalog } from "./types.js";
import { extractReferences } from "./references.js";
import type { ValidationIssue, ValidationResult, WorkflowDocument, WorkflowStep } from "./types.js";

const workflowSchema = {
  type: "object",
  additionalProperties: false,
  required: ["steps"],
  properties: {
    name: { type: "string", nullable: true },
    providerCatalog: {
      type: "object",
      nullable: true,
      additionalProperties: false,
      required: ["providers"],
      properties: {
        defaultProviderId: { type: "string", nullable: true },
        defaultModelId: { type: "string", nullable: true },
        providers: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "label", "kind", "models"],
            properties: {
              id: { type: "string", minLength: 1, pattern: "^[A-Za-z0-9_-]+$" },
              label: { type: "string", minLength: 1 },
              kind: { type: "string", enum: ["openai-compatible", "anthropic", "gemini", "mock", "custom"] },
              baseUrl: { type: "string", nullable: true },
              apiKeyRef: { type: "string", nullable: true },
              enabled: { type: "boolean", nullable: true },
              models: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["id", "label"],
                  properties: {
                    id: { type: "string", minLength: 1, pattern: "^[A-Za-z0-9_.-]+$" },
                    label: { type: "string", minLength: 1 },
                    enabled: { type: "boolean", nullable: true },
                    contextWindow: { type: "number", minimum: 1, nullable: true },
                    capabilities: {
                      type: "object",
                      nullable: true,
                      additionalProperties: false,
                      properties: {
                        text: { type: "boolean", nullable: true },
                        vision: { type: "boolean", nullable: true },
                        structuredOutput: { type: "boolean", nullable: true },
                        tools: { type: "boolean", nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
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

    this.validateProviderCatalog(workflow.providerCatalog, issues);
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

  private validateProviderCatalog(catalog: ProviderCatalog | undefined, issues: ValidationIssue[]): void {
    if (!catalog) return;

    const providersById = new Map<string, { index: number; enabled: boolean; models: Map<string, { index: number; enabled: boolean }> }>();
    catalog.providers.forEach((provider, providerIndex) => {
      if (providersById.has(provider.id)) {
        issues.push({
          path: `/providerCatalog/providers/${providerIndex}/id`,
          message: `Duplicate provider id: ${provider.id}`,
        });
      }

      const models = new Map<string, { index: number; enabled: boolean }>();
      provider.models.forEach((model, modelIndex) => {
        if (models.has(model.id)) {
          issues.push({
            path: `/providerCatalog/providers/${providerIndex}/models/${modelIndex}/id`,
            message: `Duplicate model id within provider ${provider.id}: ${model.id}`,
          });
        }
        models.set(model.id, { index: modelIndex, enabled: model.enabled !== false });
      });

      if (provider.models.length === 0) {
        issues.push({
          path: `/providerCatalog/providers/${providerIndex}/models`,
          message: `Provider ${provider.id} must define at least one model`,
        });
      }

      providersById.set(provider.id, { index: providerIndex, enabled: provider.enabled !== false, models });
    });

    if (!catalog.defaultProviderId) {
      issues.push({
        path: "/providerCatalog/defaultProviderId",
        message: "providerCatalog.defaultProviderId is required when providerCatalog is defined",
      });
    }

    if (!catalog.defaultModelId) {
      issues.push({
        path: "/providerCatalog/defaultModelId",
        message: "providerCatalog.defaultModelId is required when providerCatalog is defined",
      });
    }

    if (!catalog.defaultProviderId || !catalog.defaultModelId) return;

    const defaultProvider = providersById.get(catalog.defaultProviderId);
    if (!defaultProvider) {
      issues.push({
        path: "/providerCatalog/defaultProviderId",
        message: `Unknown default provider id: ${catalog.defaultProviderId}`,
      });
      return;
    }

    if (!defaultProvider.enabled) {
      issues.push({
        path: "/providerCatalog/defaultProviderId",
        message: `Default provider is disabled: ${catalog.defaultProviderId}`,
      });
    }

    const defaultModel = defaultProvider.models.get(catalog.defaultModelId);
    if (!defaultModel) {
      issues.push({
        path: "/providerCatalog/defaultModelId",
        message: `Unknown default model id for provider ${catalog.defaultProviderId}: ${catalog.defaultModelId}`,
      });
      return;
    }

    if (!defaultModel.enabled) {
      issues.push({
        path: "/providerCatalog/defaultModelId",
        message: `Default model is disabled: ${catalog.defaultModelId}`,
      });
    }
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
