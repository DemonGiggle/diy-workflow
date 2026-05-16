# llm.prompt

Renders and runs a prompt through the MVP mock LLM provider.

## Capability

`llm.prompt` accepts a prompt string and optional variables. The current MVP provider is deterministic: it either returns configured mock text or renders `{{variable}}` placeholders from `input.variables`.

## Input

| Field | Required | Type | Description |
| --- | --- | --- | --- |
| `prompt` | Yes | string | Prompt template or literal prompt text. |
| `variables` | No | object | Values used to replace `{{key}}` placeholders in `prompt`. Dot paths are supported. |

## Output

| Field | Type | Description |
| --- | --- | --- |
| `text` | string | Rendered prompt response. |
| `provider` | string | Current provider identifier. The MVP returns `mock`. |

## Config

| Field | Type | Description |
| --- | --- | --- |
| `mockResponse` | string | Legacy deterministic response shortcut. Prefer `mock.response` for new workflows. |

## Mock Config

Mock mode is enabled with `config.mock.enabled: true`.

| Field | Type | Description |
| --- | --- | --- |
| `mock.enabled` | boolean | Enables deterministic mock output. |
| `mock.response` | string | Response returned as `output.text`. If omitted, the action renders the prompt. |

## YAML

~~~yaml
steps:
  - id: prompt
    type: llm.prompt
    input:
      prompt: "Write a short review plan for {{topic}}."
      variables:
        topic: typed workflow engines
~~~

## Connected YAML

~~~yaml
steps:
  - id: read
    type: io.read_file
    input:
      path: examples/input.txt

  - id: prompt
    type: llm.prompt
    input:
      prompt: "{{steps.read.output.content}}"
~~~

## Mock YAML

~~~yaml
steps:
  - id: prompt
    type: llm.prompt
    input:
      prompt: "Summarize the requirements."
    config:
      mock:
        enabled: true
        response: "Use typed action schemas and trace every run."
~~~
