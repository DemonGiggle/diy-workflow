# Workflow YAML

Workflows are YAML documents with ordered steps.

~~~yaml
name: demo
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
steps:
  - id: read
    type: io.read_file
    input:
      path: input.txt

  - id: summarize
    type: llm.summarize
    input:
      text: "{{steps.read.output.content}}"
    config:
      maxSentences: 2
~~~

## Step Shape

Each step has:

- `id`: unique identifier used by later references
- `type`: action type registered in the action registry
- `input`: input object validated against the action input schema
- `config`: optional config object validated against the action config schema

Some actions may block before they produce output. A trigger step still behaves like a normal ordered step: later references can use its output after it completes.

LLM actions can also opt into node-level provider routing inside `config`:

~~~yaml
steps:
  - id: prompt_fast
    type: llm.prompt
    input:
      prompt: "Draft a short answer."
    config:
      providerId: openai
      modelId: gpt-4.1-mini

  - id: prompt_deep
    type: llm.prompt
    input:
      prompt: "Draft a longer answer."
    config:
      providerId: anthropic
      modelId: claude-sonnet-4
~~~

## Provider Catalog

`providerCatalog` is optional. Right now it lives at the workflow root so the workflow can carry its own provider/model catalog.

For the complete product model, see [Provider and model configuration](provider-models.md).

If you omit it entirely, diy-workflow falls back to a built-in deterministic mock catalog:

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
~~~

If you define `providerCatalog` explicitly, validation requires:

- `defaultProviderId`
- `defaultModelId`
- unique provider ids
- unique model ids within each provider
- enabled defaults

LLM node overrides follow these rules:

- omit both `config.providerId` and `config.modelId` to inherit workflow defaults
- if one is set, both must be set
- the referenced provider and model must exist and be enabled
- vision actions require a model with `capabilities.vision: true`

## References

Later steps can reference earlier step outputs:

~~~yaml
text: "{{steps.read.output.content}}"
~~~

Reference format:

~~~text
{{steps.step_id.output.field}}
~~~

Use `{{steps.step_id.output}}` to pass the whole output object, or append a field path such as `{{steps.step_id.output.summary}}` to pass one nested value.

References must point to earlier steps. Forward references are rejected during validation.

## Validation

Validation checks:

- workflow shape
- provider catalog shape and defaults, when present
- unique step ids
- valid action types
- reference step availability
- action input schemas
- action config schemas
- LLM node provider/model overrides, when present

When an input contains references, static input-schema validation is deferred until execution because the referenced value is not known yet. During execution, references are resolved, missing output paths fail the step, and the resolved input is validated against the action input schema.

Run validation with:

~~~sh
node dist/cli.js validate workflow.yaml
~~~

## Execution And Traces

Executor flow:

~~~text
load -> validate -> resolve inputs -> execute/await -> save trace
~~~

Traces are saved under:

~~~text
runs/run_xxxx/trace.json
~~~

Each step trace contains:

- step id
- input
- output
- status
- error
- metrics
