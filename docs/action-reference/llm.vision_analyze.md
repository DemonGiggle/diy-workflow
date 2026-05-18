# llm.vision_analyze

Analyze an image and describe what it contains.

## Capability

This action accepts an image artifact and an optional prompt. The MVP runtime returns a deterministic preview or a mock response.

## Input

| Field | Required | Type | Description |
| --- | --- | --- | --- |
| image | Yes | object | Image artifact from io.read_image or another image-capable action. |
| prompt | No | string | Optional instruction or question for the analysis. |

## Output

| Field | Type | Description |
| --- | --- | --- |
| text | string | Image understanding result. |

## Config

| Field | Type | Description |
| --- | --- | --- |
| `providerId` | string | Optional node-level provider override. When set, `modelId` must also be set. |
| `modelId` | string | Optional node-level model override. Selected models must advertise `vision` capability. |
| mock.enabled | boolean | Enables deterministic mock output. |
| mock.response | string | Mock analysis text. |

## YAML

~~~
steps:
  - id: read
    type: io.read_image
    input:
      path: input.png
  - id: analyze
    type: llm.vision_analyze
    input:
      image: "{{steps.read.output.image}}"
      prompt: Describe the image.
~~~

## Mock YAML

~~~
steps:
  - id: analyze
    type: llm.vision_analyze
    input:
      image:
        path: input.png
        mimeType: image/png
        bytes: 42
    config:
      mock:
        enabled: true
        response: A small blue square.
~~~
