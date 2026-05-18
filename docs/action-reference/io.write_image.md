# io.write_image

Writes an image to a local file in the workflow workspace.

## Capability

`io.write_image` is designed primarily as the sink for prompt-to-image or other generated image payloads. It resolves `input.path` relative to the workflow execution working directory, creates parent directories when needed, persists the image bytes to disk, and returns a file-backed image artifact.

As a compatibility path, it can also accept an existing file-backed image artifact and copy it to a new destination.

## Input

| Field | Required | Type | Description |
| --- | --- | --- | --- |
| `path` | Yes | string | Destination image path relative to the workflow workspace or an absolute path. |
| `image` | Yes | object | Generated image payload (`mimeType`, base64 `data`, optional `encoding`, `width`, `height`) or a file-backed image artifact. |

## Output

| Field | Type | Description |
| --- | --- | --- |
| `path` | string | Resolved output path. |
| `mimeType` | string | Output MIME type. |
| `bytes` | number | Written byte count. |
| `width` | number | Optional width metadata. |
| `height` | number | Optional height metadata. |
| `image` | object | File-backed image artifact for downstream steps. |

## Config

Mock mode is enabled with `config.mock.enabled: true`.

| Field | Type | Description |
| --- | --- | --- |
| `mock.enabled` | boolean | Enables deterministic mock output. |
| `mock.path` | string | Optional output path. Defaults to `input.path`. |
| `mock.mimeType` | string | Optional output MIME type. Defaults to the input image MIME type. |
| `mock.bytes` | number | Optional output byte count. |
| `mock.width` | number | Optional output width. |
| `mock.height` | number | Optional output height. |
| `mock.image` | object | Optional fully mocked output image artifact. |

## YAML

~~~yaml
steps:
  - id: write
    type: io.write_image
    input:
      path: outputs/generated.png
      image:
        mimeType: image/png
        data: iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2sZl8AAAAASUVORK5CYII=
        width: 1
        height: 1
~~~

## Connected YAML

When a future image-generation action is added, its output should connect directly into `io.write_image.input.image`.

## Mock YAML

~~~yaml
steps:
  - id: write
    type: io.write_image
    input:
      path: outputs/generated.png
      image:
        mimeType: image/png
        data: iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2sZl8AAAAASUVORK5CYII=
    config:
      mock:
        enabled: true
        path: mock://generated.png
        mimeType: image/png
        bytes: 68
        width: 1
        height: 1
~~~
