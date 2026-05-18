# Provider And Model Configuration

This guide is the product-level source of truth for how diy-workflow stores and resolves LLM provider/model choices.

## Source Of Truth

Provider and model metadata lives in the workflow document itself under `providerCatalog`.

That means a workflow can carry:

- the selectable providers
- the selectable models under each provider
- the workflow-wide default provider/model
- any per-node overrides in each LLM step's `config`

The runtime does not persist API keys or secret values into workflow steps or traces.

## Workflow Shape

~~~yaml
providerCatalog:
  defaultProviderId: mock
  defaultModelId: mock-default
  providers:
    - id: mock
      label: Mock Provider
      kind: mock
      models:
        - id: mock-default
          label: Mock Default
          capabilities:
            text: true
            vision: true
        - id: mock-reviewer
          label: Mock Reviewer
          capabilities:
            text: true
            vision: true
~~~

LLM steps can then either inherit the defaults or override them:

~~~yaml
steps:
  - id: draft
    type: llm.prompt
    input:
      prompt: "Draft a short answer."

  - id: review
    type: llm.prompt
    input:
      prompt: "Review the draft."
    config:
      providerId: mock
      modelId: mock-reviewer
~~~

## Resolution Order

At execution time, diy-workflow resolves an LLM step in this order:

1. If the node sets both `config.providerId` and `config.modelId`, use that pair.
2. Otherwise use `providerCatalog.defaultProviderId` and `providerCatalog.defaultModelId`.
3. Reject the step if the provider or model is missing, disabled, or lacks the required capability.
4. Record safe trace metadata with provider/model ids and provider kind.
5. Dispatch through the provider adapter boundary.

## Capability Rules

- `llm.prompt` requires text capability.
- `llm.summarize` requires text capability.
- `llm.vision_analyze` requires `capabilities.vision: true`.
- `llm.ocr` requires `capabilities.vision: true`.

Today text-capable models are treated permissively when `capabilities.text` is omitted. Vision actions are strict and require an explicit `vision: true`.

## Secret Handling

Secrets must be referenced, not embedded in steps.

Use provider-level `apiKeyRef` for runtime wiring:

~~~yaml
providerCatalog:
  providers:
    - id: openai
      label: OpenAI
      kind: openai-compatible
      apiKeyRef: env:OPENAI_API_KEY
      models:
        - id: gpt-4.1-mini
          label: GPT-4.1 Mini
          capabilities:
            text: true
~~~

Current expectations:

- use environment references such as `env:OPENAI_API_KEY`
- do not embed raw API keys in workflow YAML
- traces only store safe metadata like provider/model ids
- `apiKeyRef` itself is not written into saved traces

## Mock Vs Real Providers

The built-in `mock` provider is the fully working adapter today. It is the default fallback when `providerCatalog` is omitted.

Other provider kinds are scaffolded but not fully implemented yet:

- the runtime validates selection and credentials
- missing `apiKeyRef` fails clearly
- missing environment variables fail clearly
- after credentials are present, non-mock adapters still return a "not implemented yet" runtime error until a concrete adapter lands

This lets the product model stabilize before external API execution is added.

## Migration Behavior

Older workflows without `providerCatalog` still run.

Their behavior is:

- inject the built-in mock catalog at runtime
- use `mock / mock-default` as the effective default selection
- allow existing LLM steps without `config.providerId` or `config.modelId` to continue working unchanged

You only need to add `providerCatalog` when you want explicit multi-provider or multi-model routing.
