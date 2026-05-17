# io.read_image

Read a local image and emit a structured image artifact.

## Capability

This action reads a local image file from the workflow workspace, validates that the format is supported, and returns a structured artifact that downstream image-aware actions can consume.

## Input

| Field | Required | Type | Description |
| --- | --- | --- | --- |
| path | Yes | string | Image path relative to the workflow workspace or an absolute path. |

## Output

| Field | Type | Description |
| --- | --- | --- |
| path | string | Absolute image path. |
| mimeType | string | Detected image MIME type. |
| bytes | number | File size in bytes. |
| width | number | Optional image width. |
| height | number | Optional image height. |
| image | object | Structured image artifact for downstream steps. |

## Config

| Field | Type | Description |
| --- | --- | --- |
| mock.enabled | boolean | Enables deterministic mock output. |
| mock.path | string | Mock image path. |
| mock.mimeType | string | Mock image MIME type. |
| mock.bytes | number | Mock byte count. |
| mock.width | number | Mock width. |
| mock.height | number | Mock height. |
| mock.image | object | Fully mocked image artifact. |

## YAML

~~~
steps:
  - id: read
    type: io.read_image
    input:
      path: input.png
~~~

## Mock YAML

~~~
steps:
  - id: read
    type: io.read_image
    input:
      path: input.png
    config:
      mock:
        enabled: true
        path: mock/input.png
        mimeType: image/png
        bytes: 42
        width: 800
        height: 600
~~~

