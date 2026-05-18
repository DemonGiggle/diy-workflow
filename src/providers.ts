import type { LlmModelDefinition, LlmProviderDefinition, ProviderCatalog, WorkflowDocument } from "./types.js";

export const mockProviderId = "mock";
export const mockModelId = "mock-default";

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
