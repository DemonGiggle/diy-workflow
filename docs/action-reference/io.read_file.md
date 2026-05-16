# io.read_file

Reads a text file from the local workspace.

## Capability

`io.read_file` resolves `input.path` relative to the workflow execution working directory, reads the file as text, and returns the resolved absolute path, content, and byte size.

## Input

| Field | Required | Type | Description |
| --- | --- | --- | --- |
| `path` | Yes | string | File path to read. Relative paths are resolved from the executor working directory. |
| `encoding` | No | string | Text encoding passed to Node's file reader. Defaults to `utf8`. |

## Output

| Field | Type | Description |
| --- | --- | --- |
| `path` | string | Resolved absolute path for real reads, or mock path when mock mode is enabled. |
| `content` | string | File content. |
| `bytes` | number | File size from `stat` for real reads, or computed/mock bytes in mock mode. |

## Config

This action has no required runtime config.

## Mock Config

Mock mode is enabled with `config.mock.enabled: true`.

| Field | Type | Description |
| --- | --- | --- |
| `mock.enabled` | boolean | Enables deterministic mock output. |
| `mock.path` | string | Optional output path. Defaults to `input.path`. |
| `mock.content` | string | Optional output content. Defaults to an empty string. |
| `mock.bytes` | number | Optional output byte count. Defaults to `Buffer.byteLength(content, encoding)`. |

## YAML

~~~yaml
steps:
  - id: read
    type: io.read_file
    input:
      path: examples/input.txt
~~~

## Mock YAML

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
        content: Mocked requirements text
        bytes: 24
~~~
