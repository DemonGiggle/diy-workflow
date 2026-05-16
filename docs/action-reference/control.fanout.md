# control.fanout

Runs multiple action branches with the same ambient input value.

## Capability

`control.fanout` executes each branch action independently. The same `input.value` can be injected into branch inputs with either `"$input"` or the `{{input}}` placeholder.

Branch failures are captured as failed branch results instead of failing the whole fanout step.

## Input

| Field | Required | Type | Description |
| --- | --- | --- | --- |
| `value` | No | any | Ambient value shared with branches. |
| `branches` | Yes | array | Branch action steps. Each branch has `id`, `type`, `input`, and optional `config`. Must contain at least one branch. |

## Branch Shape

| Field | Required | Type | Description |
| --- | --- | --- | --- |
| `id` | Yes | string | Branch id. |
| `type` | Yes | string | Action type to run. |
| `input` | Yes | any | Branch action input. `"$input"` and `{{input}}` are replaced with fanout value. |
| `config` | No | object | Branch action config. |

## Output

| Field | Type | Description |
| --- | --- | --- |
| `results` | array | Per-branch result objects. |

Each result contains:

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Branch id. |
| `type` | string | Branch action type. |
| `status` | string | `success` or `failed`. |
| `output` | any | Branch output, or `null` when failed. |
| `error` | string or null | Error message for failed branches. |

## Config

This action has no required runtime config.

## Mock Config

Mock mode is enabled with `config.mock.enabled: true`.

| Field | Type | Description |
| --- | --- | --- |
| `mock.enabled` | boolean | Enables deterministic mock output. |
| `mock.results` | array | Results returned as `output.results`. Defaults to an empty array. |

## YAML

~~~yaml
steps:
  - id: fanout
    type: control.fanout
    input:
      value: "Workflow engines should be typed."
      branches:
        - id: summarize_short
          type: llm.summarize
          input:
            text: "$input"
          config:
            maxSentences: 1
        - id: prompt_review
          type: llm.prompt
          input:
            prompt: "Review this requirement: {{input}}"
~~~

## Mock YAML

~~~yaml
steps:
  - id: fanout
    type: control.fanout
    input:
      value: ignored in mock mode
      branches:
        - id: summarize_short
          type: llm.summarize
          input:
            text: "$input"
    config:
      mock:
        enabled: true
        results:
          - id: summarize_short
            type: llm.summarize
            status: success
            output:
              summary: "Mocked branch summary."
              sentenceCount: 1
            error: null
~~~
