import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultProviderCatalog,
  mockModelId,
  mockProviderId,
  resolveDefaultProviderSelection,
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
