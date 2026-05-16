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
- node:test coverage for workflow behavior, server API, editor model wiring, mock mode, and localization

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
