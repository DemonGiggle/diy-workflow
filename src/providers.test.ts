import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultProviderCatalog,
  inspectLlmProviderSelection,
  listSelectableModels,
  mockModelId,
  mockProviderId,
  resolveDefaultProviderSelection,
  resolveLlmProviderSelection,
  resolveWorkflowProviderCatalog,
} from "./providers.js";

test("provider catalog falls back to the default mock provider for legacy workflows", () => {
  const catalog = resolveWorkflowProviderCatalog({});
  assert.equal(catalog.defaultProviderId, mockProviderId);
  assert.equal(catalog.defaultModelId, mockModelId);
  assert.equal(catalog.providers.length, 1);
  assert.equal(catalog.providers[0]?.id, mockProviderId);
  assert.equal(catalog.providers[0]?.models[0]?.id, mockModelId);
});

test("provider selection resolves explicit defaults deterministically", () => {
  const selection = resolveDefaultProviderSelection({
    defaultProviderId: "openai",
    defaultModelId: "gpt-4.1-mini",
    providers: [
      {
        id: "openai",
        label: "OpenAI",
        kind: "openai-compatible",
        enabled: true,
        models: [
          { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", enabled: true },
          { id: "gpt-4.1", label: "GPT-4.1", enabled: true },
        ],
      },
    ],
  });

  assert.equal(selection.providerId, "openai");
  assert.equal(selection.modelId, "gpt-4.1-mini");
  assert.equal(selection.provider.label, "OpenAI");
  assert.equal(selection.model.label, "GPT-4.1 Mini");
});

test("default provider catalog returns fresh copies", () => {
  const first = createDefaultProviderCatalog();
  const second = createDefaultProviderCatalog();
  first.providers[0]!.label = "Changed";
  first.providers[0]!.models[0]!.label = "Changed model";
  assert.equal(second.providers[0]!.label, "Mock Provider");
  assert.equal(second.providers[0]!.models[0]!.label, "Mock Default");
});

test("llm provider selection falls back to workflow defaults when node config is unset", () => {
  const selection = resolveLlmProviderSelection(createDefaultProviderCatalog(), "llm.prompt", {});
  assert.equal(selection.source, "default");
  assert.equal(selection.providerId, mockProviderId);
  assert.equal(selection.modelId, mockModelId);
});

test("llm provider selection resolves explicit node overrides", () => {
  const catalog = {
    defaultProviderId: "mock",
    defaultModelId: "mock-default",
    providers: [
      ...createDefaultProviderCatalog().providers,
      {
        id: "openai",
        label: "OpenAI",
        kind: "openai-compatible" as const,
        enabled: true,
        models: [
          { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", enabled: true, capabilities: { text: true } },
          { id: "gpt-4.1-vision", label: "GPT-4.1 Vision", enabled: true, capabilities: { text: true, vision: true } },
        ],
      },
    ],
  };

  const selection = resolveLlmProviderSelection(catalog, "llm.vision_analyze", {
    providerId: "openai",
    modelId: "gpt-4.1-vision",
  });

  assert.equal(selection.source, "node");
  assert.equal(selection.providerId, "openai");
  assert.equal(selection.modelId, "gpt-4.1-vision");
});

test("llm provider selection reports missing node model references", () => {
  const selection = inspectLlmProviderSelection(createDefaultProviderCatalog(), "llm.prompt", {
    providerId: "mock",
  });
  assert.equal(selection.issues[0]?.field, "modelId");
  assert.match(selection.issues[0]?.message ?? "", /modelId is required/);
});

test("vision actions only list enabled models with vision support", () => {
  const models = listSelectableModels({
    id: "openai",
    label: "OpenAI",
    kind: "openai-compatible",
    enabled: true,
    models: [
      { id: "text-only", label: "Text Only", enabled: true, capabilities: { text: true } },
      { id: "vision-disabled", label: "Vision Disabled", enabled: false, capabilities: { text: true, vision: true } },
      { id: "vision-ready", label: "Vision Ready", enabled: true, capabilities: { text: true, vision: true } },
    ],
  }, "vision");

  assert.deepEqual(models.map((model) => model.id), ["vision-ready"]);
});
