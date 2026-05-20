# io.write_stdout

Emits text or JSON-compatible content to the workflow run output surface.

## Capability

`io.write_stdout` is a lightweight sink for final or intermediate textual output. CLI runs write the emitted text directly to stdout, while saved traces keep the rendered content, label, newline flag, and byte count on the step output and also record a matching run log event with `category: "stdout"`.

## Input

| Field | Required | Type | Description |
| --- | --- | --- | --- |
| `content` | Yes | any JSON-compatible value | Content to emit. Strings are written as-is; other values are rendered as pretty JSON. |
| `label` | No | string | Optional prefix label shown in UI and emitted as `label: content` in CLI runs. |
| `newline` | No | boolean | Whether to append a trailing newline. Defaults to `true`. |

## Output

| Field | Type | Description |
| --- | --- | --- |
| `content` | string | Rendered text content that was emitted. |
| `label` | string | Optional label prefix. |
| `newline` | boolean | Whether a trailing newline was requested. |
| `bytes` | number | UTF-8 byte count of the emitted stdout payload, including the label prefix and trailing newline when present. |

## Config

Mock mode is enabled with `config.mock.enabled: true`.

| Field | Type | Description |
| --- | --- | --- |
| `mock.enabled` | boolean | Enables deterministic mock output. |
| `mock.content` | any JSON-compatible value | Optional emitted content override. |
| `mock.label` | string | Optional emitted label override. |
| `mock.newline` | boolean | Optional emitted trailing newline override. |
| `mock.bytes` | number | Optional emitted byte count override. |

## YAML

~~~yaml
steps:
  - id: emit
    type: io.write_stdout
    input:
      label: result
      content: Hello from diy-workflow
~~~

## Connected YAML

~~~yaml
steps:
  - id: summarize
    type: llm.summarize
    input:
      text: Emit the most important sentence only. Second sentence here.
    config:
      maxSentences: 1

  - id: emit
    type: io.write_stdout
    input:
      label: summary
      content: "{{steps.summarize.output.summary}}"
~~~

## JSON YAML

~~~yaml
steps:
  - id: emit
    type: io.write_stdout
    input:
      content:
        source: workflow
        ok: true
~~~

## Mock YAML

~~~yaml
steps:
  - id: emit
    type: io.write_stdout
    input:
      content: ignored during mock
    config:
      mock:
        enabled: true
        label: preview
        content:
          status: mocked
        bytes: 32
~~~
