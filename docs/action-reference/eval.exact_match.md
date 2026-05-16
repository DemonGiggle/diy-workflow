# eval.exact_match

Compares two values using strict deep equality.

## Capability

`eval.exact_match` compares `input.actual` and `input.expected` with Node's strict deep equality semantics. It returns the comparison result and echoes both compared values.

## Input

| Field | Required | Type | Description |
| --- | --- | --- | --- |
| `actual` | Yes | any | Actual value produced by the workflow. |
| `expected` | Yes | any | Expected value to compare against. |

## Output

| Field | Type | Description |
| --- | --- | --- |
| `matched` | boolean | Whether `actual` and `expected` are deeply equal. |
| `actual` | any | Actual value used in comparison. |
| `expected` | any | Expected value used in comparison. |

## Config

This action has no required runtime config.

## Mock Config

Mock mode is enabled with `config.mock.enabled: true`.

| Field | Type | Description |
| --- | --- | --- |
| `mock.enabled` | boolean | Enables deterministic mock output. |
| `mock.matched` | boolean | Optional forced comparison result. If omitted, the action compares mock or input values. |
| `mock.actual` | any | Optional value returned as `output.actual`. Defaults to `input.actual`. |
| `mock.expected` | any | Optional value returned as `output.expected`. Defaults to `input.expected`. |

## YAML

~~~yaml
steps:
  - id: check
    type: eval.exact_match
    input:
      actual: "{{steps.summarize.output.summary}}"
      expected: "Expected summary"
~~~

## Mock YAML

~~~yaml
steps:
  - id: check
    type: eval.exact_match
    input:
      actual: "{{steps.summarize.output.summary}}"
      expected: "Expected summary"
    config:
      mock:
        enabled: true
        matched: true
        actual: "Expected summary"
        expected: "Expected summary"
~~~
