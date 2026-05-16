# Getting Started

This guide gets diy-workflow installed, tested, and running locally.

## Install

~~~sh
npm install
~~~

## Build And Test

~~~sh
npm run check
~~~

This runs:

- TypeScript build
- production UI build into `web-dist/`
- test compilation into `dist-test/`
- unit/model tests under `src/**/*.test.ts`
- integration tests under `tests/integration/**/*.test.ts`

## Test Layers

The test suite intentionally covers several layers:

- action unit tests for each built-in action's real and mock behavior
- reference resolver tests for whole-value and inline references
- integration tests under `tests/integration/` for validation, execution, fanout/fanin, and trace output
- CLI integration tests under `tests/integration/` for `validate`, `run`, `runs list`, and `runs show`
- launched server integration tests under `tests/integration/` that spawn `diy-workflow serve` and call static UI and workflow API endpoints
- UI model/i18n tests for editor wiring and localization coverage

Useful test commands:

~~~sh
npm run test:compile
npm run test:unit
npm run test:integration
npm test
~~~

`test:integration` expects the production CLI and UI to be built first because it launches the real `dist/cli.js` server. `npm test` and `npm run check` handle those prerequisites.

## Run The CLI

Build the CLI first:

~~~sh
npm run build
~~~

Validate and run the basic summarize workflow:

~~~sh
node dist/cli.js validate examples/summarize.yaml
node dist/cli.js run examples/summarize.yaml
~~~

Inspect saved runs:

~~~sh
node dist/cli.js runs list
node dist/cli.js runs show run_0001
~~~

Execution traces are written to `runs/run_xxxx/trace.json`.

## Run The Visual Editor

Build both the CLI and UI:

~~~sh
npm run build
npm run build:ui
~~~

Serve the editor:

~~~sh
npm run serve -- --host 127.0.0.1 --port 4173
~~~

Open:

~~~text
http://127.0.0.1:4173/
~~~

If the server reports that `web-dist/index.html` is missing, run `npm run build:ui`.

## Useful Examples

Validate and run the LLM-oriented example:

~~~sh
node dist/cli.js validate examples/llm-review.yaml
node dist/cli.js run examples/llm-review.yaml
~~~

Validate and run the deterministic mock example:

~~~sh
node dist/cli.js validate examples/mock-e2e.yaml
node dist/cli.js run examples/mock-e2e.yaml
~~~
