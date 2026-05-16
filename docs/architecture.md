# Architecture

diy-workflow is organized around a small execution engine and UI-friendly schema metadata.

## Execution Flow

~~~text
load -> validate -> resolve inputs -> execute -> save trace
~~~

## Core Components

- `ActionDefinition`: reusable typed building block with `type`, schemas, optional config schema, and `run(input, context)`
- `ActionRegistry`: action lookup and schema metadata
- `WorkflowValidator`: validates workflow shape, unique ids, action types, references, input schemas, and config schemas
- `WorkflowExecutor`: validates, resolves references, executes ordered steps, and saves traces
- `TraceStore`: stores and reads run directories under `runs/`
- `createWorkflowServer`: serves the built editor and local workflow API
- `src/ui`: visual editor state model, action catalog, typed connection rules, locale resources, and React UI

## Directory Guide

~~~text
src/
  actions/        built-in actions and mock helpers
  ui/             visual editor, editor model, action catalog, i18n
  cli.ts          command-line interface
  executor.ts     workflow execution
  registry.ts     action registry
  server.ts       editor static server and workflow API
  trace.ts        run trace persistence
  types.ts        shared types
  validator.ts    workflow validation

docs/             project documentation
examples/         runnable workflow examples
runs/             generated execution traces
web-dist/         generated UI build output
~~~

## UI-Friendly Action Metadata

The runtime action schema is the source of workflow correctness. The visual editor adds UI metadata in `src/ui/actionCatalog.ts` so the editor can render fields, connection ports, placeholders, and config controls without changing the runtime contract.

This separation keeps the engine usable from the CLI while letting the editor become richer over time.
