# trigger.watch_dir

Waits for the first batch of file changes in a directory, then emits the watched directory and changed file paths.

This is the first trigger-style action in diy-workflow. In v1 it behaves like a blocking step: one run waits for one change burst, returns the paths, and then the workflow continues normally.

## Input

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `path` | string | Yes | Directory to watch, resolved relative to the workflow file. |
| `debounceMs` | number | No | Collapse rapid change bursts into one output batch. Defaults to `50`. |

## Output

| Field | Type | Notes |
| --- | --- | --- |
| `directory` | string | Absolute watched directory path. |
| `paths` | string[] | Absolute changed file paths captured in the first trigger batch. |

## Config

Mock mode is supported through `config.mock.enabled`.

| Field | Type | Notes |
| --- | --- | --- |
| `mock.directory` | string | Optional mock directory path. |
| `mock.paths` | string[] | Optional mock changed-path list. |

## Example

~~~yaml
steps:
  - id: watch
    type: trigger.watch_dir
    input:
      path: inbox
      debounceMs: 75

  - id: summarize
    type: llm.summarize
    input:
      text: "{{steps.watch.output.paths}}"
~~~

## Notes

- v1 triggers on the first observed change batch and then completes.
- The action reports paths only. It does not read file contents.
- For the cleanest control flow, place trigger steps near the start of the workflow.
