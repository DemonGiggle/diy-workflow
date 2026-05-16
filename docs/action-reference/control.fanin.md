# control.fanin

Merges fanout results using a configured strategy.

## Capability

`control.fanin` accepts an array of items, usually `{{steps.fanout.output.results}}`, and combines them according to `config.strategy`.

Supported strategies:

- `merge`: merge object outputs into one object when possible; otherwise return an output array.
- `first_success`: return the first successful fanout result.

## Input

| Field | Required | Type | Description |
| --- | --- | --- | --- |
| `items` | Yes | array | Items or fanout result objects to merge. |

## Output

| Field | Type | Description |
| --- | --- | --- |
| `strategy` | string | Strategy used: `merge` or `first_success`. |
| `output` | any | Merged output, first successful result, array output, or `null`. |
| `count` | number | Number of items considered in the output. |

## Config

| Field | Type | Description |
| --- | --- | --- |
| `strategy` | string | Optional fanin strategy. Defaults to `merge`. |

## Mock Config

Mock mode is enabled with `config.mock.enabled: true`.

| Field | Type | Description |
| --- | --- | --- |
| `mock.enabled` | boolean | Enables deterministic mock output. |
| `mock.strategy` | string | Optional output strategy. Defaults to `merge`. |
| `mock.output` | any | Output returned as `output.output`. Defaults to `null`. |
| `mock.count` | number | Output count. Defaults to `0`. |

## YAML

~~~yaml
steps:
  - id: fanin
    type: control.fanin
    input:
      items: "{{steps.fanout.output.results}}"
    config:
      strategy: merge
~~~

## First Success YAML

~~~yaml
steps:
  - id: fanin
    type: control.fanin
    input:
      items: "{{steps.fanout.output.results}}"
    config:
      strategy: first_success
~~~

## Mock YAML

~~~yaml
steps:
  - id: fanin
    type: control.fanin
    input:
      items: []
    config:
      mock:
        enabled: true
        strategy: merge
        output:
          summary: "Merged mock output"
        count: 1
~~~
