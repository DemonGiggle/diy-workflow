# diy-workflow

A workflow experiment engine built around typed reusable actions.

The MVP is CLI-first, but it also includes a visual editor foundation for building workflows from typed action inputs and outputs.

## What it does

- Defines workflows as ordered YAML steps.
- Treats every action as a reusable typed building block.
- Connects action outputs into later action inputs with references like `{{steps.read.output.content}}`.
- Validates workflow shape, unique step ids, action types, references, and schemas before execution.
- Executes workflows and writes traces under `runs/run_xxxx/trace.json`.
- Provides a visual editor for adding actions, editing inputs/config, wiring typed ports, running workflows, and inspecting saved traces.
- Supports localized editor chrome and action labels for English and Traditional Chinese.

## Install

```sh
npm install
```

## Build and test

```sh
npm run check
```

This runs:

- TypeScript build
- production UI build into `web-dist/`
- node:test coverage for core workflow behavior, server API, and editor model wiring

## CLI usage

```sh
npm run build

node dist/cli.js validate examples/summarize.yaml
node dist/cli.js run examples/summarize.yaml
node dist/cli.js runs list
node dist/cli.js runs show run_0001
```

Execution traces are written to `runs/run_xxxx/trace.json`.

## Visual editor

![Visual workflow editor with LLM action](docs/editor-llm-example.png)

Build the UI before serving:

```sh
npm run build
npm run build:ui
npm run serve -- --host 127.0.0.1 --port 4173
```

Then open:

```text
http://127.0.0.1:4173/
```

The editor server provides:

- `POST /api/workflows/validate`
- `POST /api/workflows/run`
- `GET /api/runs`
- `GET /api/runs/:run_id`

Notes:

- `web-dist/` is resolved from the installed package/repo root, so the editor can be served even if you start the command from another working directory.
- `runs/` is resolved from the directory where you start `diy-workflow serve`, so traces stay with the workspace you are operating in.
- If `web-dist/index.html` is missing, run `npm run build:ui`.

## Workflow example

```yaml
name: demo
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
```

An LLM-oriented workflow is also available:

```sh
node dist/cli.js validate examples/llm-review.yaml
node dist/cli.js run examples/llm-review.yaml
```

It reads requirements from `examples/input.txt`, sends them through `llm.prompt`, summarizes the generated plan with `llm.summarize`, and checks the summary with `eval.exact_match`.

## Mock mode

Every built-in action supports action-level mock mode through `config.mock.enabled`. Mock settings stay out of `input`, so the action input schema still describes the real workflow contract while tests and UI runs can opt into deterministic outputs.

```yaml
steps:
  - id: read
    type: io.read_file
    input:
      path: does-not-need-to-exist.txt
    config:
      mock:
        enabled: true
        path: mock://requirements.txt
        content: Mocked file content
        bytes: 19
```

Run the end-to-end mock example:

```sh
node dist/cli.js validate examples/mock-e2e.yaml
node dist/cli.js run examples/mock-e2e.yaml
```

The editor exposes each action's mock settings in the config panel, including a checkbox for `mock.enabled`.

## Localization

The visual editor ships with English and Traditional Chinese locales. The language selector changes editor chrome, action labels, descriptions, field labels, and placeholders while preserving workflow contracts such as action `type`, step ids, YAML keys, and references.

Locale resources live in `src/ui/i18n.ts`. To add another language, append the locale to `supportedLocales` and provide matching UI/action translations; the i18n tests verify every editor action and field has localized text.

## Architecture

- `ActionDefinition`: reusable typed building block with `type`, input schema, output schema, optional config schema, and `run(input, context)`.
- `ActionRegistry`: lookup and schema metadata for actions.
- `WorkflowValidator`: validates unique ids, action types, references, and static schema constraints.
- `WorkflowExecutor`: validates, resolves references, executes ordered steps, and saves traces.
- `TraceStore`: stores and reads run directories under `runs/`.
- `createWorkflowServer`: serves the built editor and local workflow API.
- `src/ui`: visual editor state model, action catalog, typed connection rules, locale resources, and React UI.

Built-in actions:

- `io.read_file`
- `llm.prompt`
- `llm.summarize`
- `control.fanout`
- `control.fanin`
- `eval.exact_match`
