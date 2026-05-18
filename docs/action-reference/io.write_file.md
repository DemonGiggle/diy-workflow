# io.write_file

Writes text content to a local file in the workflow workspace.

## Capability

`io.write_file` resolves `input.path` relative to the workflow execution working directory, creates parent directories when needed, writes the provided text content, and returns the resolved output path plus byte count.

## Input

| Field | Required | Type | Description |
| --- | --- | --- | --- |
| `path` | Yes | string | Destination path relative to the workflow workspace or an absolute path. |
| `content` | Yes | string | Text content to write. |
| `encoding` | No | string | Text encoding passed to Node's file writer. Defaults to `utf8`. |

## Output

| Field | Type | Description |
| --- | --- | --- |
| `path` | string | Resolved output path. |
| `bytes` | number | Written byte count. |

## Config

Mock mode is enabled with `config.mock.enabled: true`.

| Field | Type | Description |
| --- | --- | --- |
| `mock.enabled` | boolean | Enables deterministic mock output. |
| `mock.path` | string | Optional output path. Defaults to `input.path`. |
| `mock.bytes` | number | Optional written byte count. Defaults to `Buffer.byteLength(content, encoding)`. |

## YAML

~~~yaml
steps:
  - id: write
    type: io.write_file
    input:
      path: outputs/summary.txt
      content: Hello from diy-workflow
~~~

## Connected YAML

~~~yaml
steps:
  - id: summarize
    type: llm.summarize
    input:
      text: DIY workflows should end with a real artifact.

  - id: write
    type: io.write_file
    input:
      path: outputs/summary.txt
      content: "{{steps.summarize.output.summary}}"
~~~

## Mock YAML

~~~yaml
steps:
  - id: write
    type: io.write_file
    input:
      path: outputs/summary.txt
      content: ignored during mock
    config:
      mock:
        enabled: true
        path: mock://summary.txt
        bytes: 42
~~~
