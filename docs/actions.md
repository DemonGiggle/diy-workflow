# Actions

Actions are reusable typed building blocks.

Each action defines:

- `type`
- input schema
- output schema
- optional config schema
- `run(input, context)`

## Built-In Actions

### `io.read_file`

Reads a text file and emits:

- `path`
- `content`
- `bytes`

### `llm.prompt`

Accepts a prompt and emits model text. The MVP implementation is deterministic and suitable for local workflow experiments.

### `llm.summarize`

Summarizes text with model-facing controls such as `maxSentences` and `maxChars`.

### `control.fanout`

Runs multiple branches with the same input.

### `control.fanin`

Merges fanout outputs.

Supported strategies:

- `merge`
- `first_success`

### `eval.exact_match`

Compares two values exactly and emits whether they matched.

## Registry

The action registry provides action lookup by `type` and exposes action schema metadata to validation and execution.

## Mock Mode

Every built-in action supports action-level mock mode through `config.mock.enabled`.

Mock settings stay in `config`, not `input`, so the input schema still describes the real workflow contract while tests and UI runs can opt into deterministic outputs.

~~~yaml
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
~~~

Run the mock example:

~~~sh
node dist/cli.js validate examples/mock-e2e.yaml
node dist/cli.js run examples/mock-e2e.yaml
~~~

The visual editor exposes each action's mock settings in the config panel, including a checkbox for `mock.enabled`.
