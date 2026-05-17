# llm.ocr

Extract text from an image.

## Capability

This action accepts an image artifact and returns extracted text. The MVP runtime returns a deterministic preview or a mock response.

## Input

| Field | Required | Type | Description |
| --- | --- | --- | --- |
| image | Yes | object | Image artifact from io.read_image or another image-capable action. |

## Output

| Field | Type | Description |
| --- | --- | --- |
| text | string | OCR text result. |

## Config

| Field | Type | Description |
| --- | --- | --- |
| mock.enabled | boolean | Enables deterministic mock output. |
| mock.response | string | Mock OCR text. |

## YAML

~~~
steps:
  - id: read
    type: io.read_image
    input:
      path: input.png
  - id: ocr
    type: llm.ocr
    input:
      image: "{{steps.read.output.image}}"
~~~

## Mock YAML

~~~
steps:
  - id: ocr
    type: llm.ocr
    input:
      image:
        path: input.png
        mimeType: image/png
        bytes: 42
    config:
      mock:
        enabled: true
        response: Detected image text.
~~~

