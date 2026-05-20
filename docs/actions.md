# Actions

Actions are reusable typed building blocks. Each action defines a stable runtime contract:

- `type`
- input schema
- output schema
- optional config schema
- `run(input, context)`

This page is an index. Detailed behavior, input/output fields, mock settings, and YAML examples live in the per-action reference pages.

## Built-In Actions

| Type | Purpose | Reference |
| --- | --- | --- |
| `trigger.watch_dir` | Wait for the first batch of file changes in a directory. | [trigger.watch_dir](action-reference/trigger.watch_dir.md) |
| `io.read_file` | Read a local file and extract text from common document formats. | [io.read_file](action-reference/io.read_file.md) |
| `io.read_image` | Read a local image and emit a structured image artifact. | [io.read_image](action-reference/io.read_image.md) |
| `io.write_file` | Write text content to a local file. | [io.write_file](action-reference/io.write_file.md) |
| `io.write_stdout` | Emit text or JSON-compatible content to stdout-style run output. | [io.write_stdout](action-reference/io.write_stdout.md) |
| `io.write_image` | Write a generated image payload to a local file. | [io.write_image](action-reference/io.write_image.md) |
| `llm.prompt` | Render and run a prompt through the MVP mock LLM provider. | [llm.prompt](action-reference/llm.prompt.md) |
| `llm.vision_analyze` | Analyze an image and describe what it contains. | [llm.vision_analyze](action-reference/llm.vision_analyze.md) |
| `llm.ocr` | Extract text from an image. | [llm.ocr](action-reference/llm.ocr.md) |
| `llm.summarize` | Summarize text with deterministic extractive summarization. | [llm.summarize](action-reference/llm.summarize.md) |
| `control.fanout` | Run multiple action branches with the same ambient input value. | [control.fanout](action-reference/control.fanout.md) |
| `control.fanin` | Merge fanout results using a configured strategy. | [control.fanin](action-reference/control.fanin.md) |
| `eval.exact_match` | Compare two values using strict deep equality. | [eval.exact_match](action-reference/eval.exact_match.md) |

## Registry

The action registry provides action lookup by `type` and exposes action schema metadata to validation and execution.

## Mock Mode

Every built-in action supports action-level mock mode through `config.mock.enabled`.

Mock settings stay in `config`, not `input`, so the input schema still describes the real workflow contract while tests and UI runs can opt into deterministic outputs.

Run the deterministic mock example:

~~~sh
node dist/cli.js validate examples/mock-e2e.yaml
node dist/cli.js run examples/mock-e2e.yaml
~~~

The visual editor exposes each action's mock settings in the config panel, including a checkbox for `mock.enabled`.

## LLM Provider Routing

All LLM actions can inherit the workflow default provider/model or override it per node with:

- `config.providerId`
- `config.modelId`

See [Provider and model configuration](provider-models.md) for runtime resolution order, capability rules, secret handling, and migration notes.
