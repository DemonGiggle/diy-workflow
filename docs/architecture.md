# Architecture

diy-workflow is organized around a small execution engine and UI-friendly schema metadata.

## Execution Flow

~~~text
load -> validate -> resolve inputs -> execute -> save trace
~~~

For LLM actions, the execute phase now includes provider routing:

~~~text
resolve provider/model -> attach safe llm trace metadata -> dispatch adapter -> save trace
~~~

## Core Components

- `ActionDefinition`: reusable typed building block with `type`, schemas, optional config schema, and `run(input, context)`
- `ActionRegistry`: action lookup and schema metadata
- `WorkflowValidator`: validates workflow shape, provider catalog defaults, unique ids, action types, references, input schemas, and config schemas
- `WorkflowExecutor`: validates, resolves references, executes ordered steps, and saves traces
- `src/providers.ts`: default mock provider catalog and deterministic provider/model resolution helpers
- `src/llmRuntime.ts`: LLM adapter boundary, provider/model resolution, deterministic mock execution, and placeholder non-mock adapters
- `TraceStore`: stores and reads run directories under `runs/`
- `createWorkflowServer`: serves the built editor and local workflow API
- `src/ui`: visual editor state model, action catalog, typed connection rules, locale resources, and React UI
- `.github/workflows/ci.yml`: builds the CLI, builds the editor, compiles tests, runs unit/model tests, runs integration tests, and validates example workflows

## Directory Guide

~~~text
src/
  actions/        built-in actions and mock helpers
  ui/             visual editor, editor model, action catalog, i18n
  *.test.ts       colocated unit/model tests
  cli.ts          command-line interface
  executor.ts     workflow execution
  registry.ts     action registry
  server.ts       editor static server and workflow API
  trace.ts        run trace persistence
  types.ts        shared types
  validator.ts    workflow validation

docs/             project documentation
examples/         runnable workflow examples
tests/
  integration/    workflow, server, CLI, and launched-server integration tests
runs/             generated execution traces
dist/             generated production CLI build output
dist-test/        generated test compilation output
web-dist/         generated UI build output
~~~

## Build And Test Configuration

- `tsconfig.json`: production TypeScript build for the CLI/runtime into `dist/`
- `tsconfig.ui.json`: Vite/React TypeScript settings for the visual editor
- `tsconfig.test.json`: test-only TypeScript build for `src/` and `tests/` into `dist-test/`
- `vite.config.ts`: builds the visual editor into `web-dist/`

## UI-Friendly Action Metadata

The runtime action schema is the source of workflow correctness. The visual editor adds UI metadata in `src/ui/actionCatalog.ts` so the editor can render fields, connection ports, placeholders, and config controls without changing the runtime contract.

This separation keeps the engine usable from the CLI while letting the editor become richer over time.

## Provider Catalog

Provider and model metadata currently lives directly on the workflow document as an optional `providerCatalog` block. That keeps the source of truth local to the workflow while the product is still CLI-first.

When `providerCatalog` is omitted, the runtime and validation helpers fall back to a built-in enabled `mock` provider with one enabled `mock-default` model. When `providerCatalog` is present, it must declare:

- `defaultProviderId`
- `defaultModelId`
- unique provider ids
- unique model ids within each provider

Disabled defaults are rejected during validation.

## LLM Runtime Resolution

LLM runtime execution follows this order:

1. read the node-level `config.providerId` and `config.modelId`, if present
2. otherwise fall back to `providerCatalog.defaultProviderId` and `providerCatalog.defaultModelId`
3. confirm the provider/model exist, are enabled, and satisfy the action capability
4. record safe trace metadata with provider/model ids and provider kind
5. dispatch through the provider adapter boundary

Today the built-in `mock` adapter is the only fully implemented runtime adapter. It preserves deterministic local execution for tests and examples.

Other provider kinds currently act as scaffolding:

- they require `apiKeyRef`
- `apiKeyRef` should point to an environment variable, for example `env:OPENAI_API_KEY`
- once credentials are present, the runtime still returns a clear "not implemented yet" error until a real adapter lands

Trace files never include provider `apiKeyRef` or resolved secret values. They only store safe execution metadata such as provider/model ids.
