import type {
  JsonObject,
  LlmModelCapabilities,
  LlmModelDefinition,
  LlmProviderDefinition,
  ProviderCatalog,
  WorkflowDocument,
} from "./types.js";

export const mockProviderId = "mock";
export const mockModelId = "mock-default";
const llmActionCapabilityMap = {
  "llm.prompt": "text",
  "llm.summarize": "text",
  "llm.vision_analyze": "vision",
  "llm.ocr": "vision",
} as const;

export type LlmActionType = keyof typeof llmActionCapabilityMap;
export type LlmSelectionIssueField = "providerId" | "modelId";

export interface LlmNodeSelectionConfig {
  providerId?: string;
  modelId?: string;
}

export interface LlmSelectionIssue {
  field: LlmSelectionIssueField;
  message: string;
}

export interface LlmProviderSelectionState {
  source: "default" | "node";
  requiredCapability: keyof LlmModelCapabilities;
  explicitProviderId?: string;
  explicitModelId?: string;
  resolvedProviderId?: string;
  resolvedModelId?: string;
  provider?: LlmProviderDefinition;
  model?: LlmModelDefinition;
  issues: LlmSelectionIssue[];
}

const defaultMockModel: LlmModelDefinition = {
  id: mockModelId,
  label: "Mock Default",
  capabilities: {
    text: true,
    vision: true,
    structuredOutput: true,
  },
  enabled: true,
};

const defaultMockProvider: LlmProviderDefinition = {
  id: mockProviderId,
  label: "Mock Provider",
  kind: "mock",
  models: [defaultMockModel],
  enabled: true,
};

export function createDefaultProviderCatalog(): ProviderCatalog {
  return {
    providers: [
      {
        ...defaultMockProvider,
        models: defaultMockProvider.models.map((model) => ({ ...model, capabilities: model.capabilities ? { ...model.capabilities } : undefined })),
      },
    ],
    defaultProviderId: mockProviderId,
    defaultModelId: mockModelId,
  };
}

export function resolveWorkflowProviderCatalog(workflow: Pick<WorkflowDocument, "providerCatalog">): ProviderCatalog {
  return workflow.providerCatalog ? cloneProviderCatalog(workflow.providerCatalog) : createDefaultProviderCatalog();
}

export function isLlmActionType(type: string): type is LlmActionType {
  return type in llmActionCapabilityMap;
}

export function getRequiredCapabilityForAction(type: LlmActionType): keyof LlmModelCapabilities {
  return llmActionCapabilityMap[type];
}

export function readLlmNodeSelectionConfig(config: unknown): LlmNodeSelectionConfig {
  const object = config && typeof config === "object" && !Array.isArray(config) ? config as JsonObject : undefined;
  return {
    providerId: typeof object?.providerId === "string" && object.providerId.trim() ? object.providerId : undefined,
    modelId: typeof object?.modelId === "string" && object.modelId.trim() ? object.modelId : undefined,
  };
}

export function inspectLlmProviderSelection(catalog: ProviderCatalog, type: LlmActionType, config: unknown): LlmProviderSelectionState {
  const { providerId, modelId } = readLlmNodeSelectionConfig(config);
  const requiredCapability = getRequiredCapabilityForAction(type);
  const issues: LlmSelectionIssue[] = [];

  if (!providerId && !modelId) {
    try {
      const selection = resolveDefaultProviderSelection(catalog);
      const capabilityIssue = validateModelCapability(selection.model, requiredCapability);
      return {
        source: "default",
        requiredCapability,
        resolvedProviderId: selection.providerId,
        resolvedModelId: selection.modelId,
        provider: selection.provider,
        model: selection.model,
        issues: capabilityIssue ? [capabilityIssue] : [],
      };
    } catch (error) {
      return {
        source: "default",
        requiredCapability,
        issues: [{ field: "providerId", message: error instanceof Error ? error.message : String(error) }],
      };
    }
  }

  if (!providerId) {
    issues.push({ field: "providerId", message: "providerId is required when modelId is set" });
  }

  if (!modelId) {
    issues.push({ field: "modelId", message: "modelId is required when providerId is set" });
  }

  const provider = providerId ? catalog.providers.find((item) => item.id === providerId) : undefined;
  if (providerId && !provider) {
    issues.push({ field: "providerId", message: `Unknown provider id: ${providerId}` });
  } else if (provider && provider.enabled === false) {
    issues.push({ field: "providerId", message: `Provider is disabled: ${provider.id}` });
  }

  const model = provider && modelId ? provider.models.find((item) => item.id === modelId) : undefined;
  if (provider && modelId && !model) {
    issues.push({ field: "modelId", message: `Unknown model id for provider ${provider.id}: ${modelId}` });
  } else if (model && model.enabled === false) {
    issues.push({ field: "modelId", message: `Model is disabled: ${model.id}` });
  }

  const capabilityIssue = model ? validateModelCapability(model, requiredCapability) : null;
  if (capabilityIssue) issues.push(capabilityIssue);

  return {
    source: "node",
    requiredCapability,
    explicitProviderId: providerId,
    explicitModelId: modelId,
    resolvedProviderId: provider?.id,
    resolvedModelId: model?.id,
    provider,
    model,
    issues,
  };
}

export function resolveLlmProviderSelection(catalog: ProviderCatalog, type: LlmActionType, config: unknown): {
  source: "default" | "node";
  providerId: string;
  modelId: string;
  provider: LlmProviderDefinition;
  model: LlmModelDefinition;
} {
  const selection = inspectLlmProviderSelection(catalog, type, config);
  if (selection.issues.length > 0 || !selection.provider || !selection.model || !selection.resolvedProviderId || !selection.resolvedModelId) {
    throw new Error(selection.issues.map((issue) => issue.message).join("; ") || "Unable to resolve LLM provider selection");
  }

  return {
    source: selection.source,
    providerId: selection.resolvedProviderId,
    modelId: selection.resolvedModelId,
    provider: selection.provider,
    model: selection.model,
  };
}

export function listSelectableModels(provider: LlmProviderDefinition, requiredCapability: keyof LlmModelCapabilities): LlmModelDefinition[] {
  return provider.models.filter((model) => model.enabled !== false && supportsCapability(model, requiredCapability));
}

export function resolveDefaultProviderSelection(catalog: ProviderCatalog): {
  providerId: string;
  modelId: string;
  provider: LlmProviderDefinition;
  model: LlmModelDefinition;
} {
  const provider = findEnabledProvider(catalog, catalog.defaultProviderId) ?? firstEnabledProvider(catalog);
  if (!provider) throw new Error("Provider catalog does not contain an enabled provider");

  const model = findEnabledModel(provider, catalog.defaultModelId) ?? firstEnabledModel(provider);
  if (!model) throw new Error(`Provider ${provider.id} does not contain an enabled model`);

  return {
    providerId: provider.id,
    modelId: model.id,
    provider,
    model,
  };
}

function cloneProviderCatalog(catalog: ProviderCatalog): ProviderCatalog {
  return {
    defaultProviderId: catalog.defaultProviderId,
    defaultModelId: catalog.defaultModelId,
    providers: catalog.providers.map((provider) => ({
      ...provider,
      models: provider.models.map((model) => ({
        ...model,
        capabilities: model.capabilities ? { ...model.capabilities } : undefined,
      })),
    })),
  };
}

function findEnabledProvider(catalog: ProviderCatalog, providerId?: string): LlmProviderDefinition | undefined {
  if (!providerId) return undefined;
  return catalog.providers.find((provider) => provider.id === providerId && provider.enabled !== false);
}

function firstEnabledProvider(catalog: ProviderCatalog): LlmProviderDefinition | undefined {
  return catalog.providers.find((provider) => provider.enabled !== false);
}

function findEnabledModel(provider: LlmProviderDefinition, modelId?: string): LlmModelDefinition | undefined {
  if (!modelId) return undefined;
  return provider.models.find((model) => model.id === modelId && model.enabled !== false);
}

function firstEnabledModel(provider: LlmProviderDefinition): LlmModelDefinition | undefined {
  return provider.models.find((model) => model.enabled !== false);
}

function validateModelCapability(model: LlmModelDefinition, requiredCapability: keyof LlmModelCapabilities): LlmSelectionIssue | null {
  if (supportsCapability(model, requiredCapability)) return null;
  return { field: "modelId", message: `Model ${model.id} does not support ${requiredCapability}` };
}

function supportsCapability(model: LlmModelDefinition, requiredCapability: keyof LlmModelCapabilities): boolean {
  if (requiredCapability === "vision") return model.capabilities?.vision === true;
  return model.capabilities?.text !== false;
}
