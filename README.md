# diy-workflow

A CLI-first workflow experiment engine built around typed reusable actions.

Workflows are YAML files made of ordered steps:

```yaml
name: demo
steps:
  - id: read
    type: io.read_file
    input:
      path: input.txt
  - id: summarize
    type: llm.summarize
    input:
      text: "{{steps.read.output.content}}"
    config:
      maxSentences: 2
```

## Commands

```sh
npm install
npm run build

npx diy-workflow validate examples/summarize.yaml
npx diy-workflow run examples/summarize.yaml
npx diy-workflow runs list
npx diy-workflow runs show run_0001
```

Execution traces are written to `runs/run_xxxx/trace.json`.

## Architecture

- `ActionDefinition`: reusable typed building block with `type`, input schema, output schema, and `run(input, context)`.
- `ActionRegistry`: lookup and schema metadata for actions.
- `WorkflowValidator`: validates unique ids, action types, references, and static schema constraints.
- `Executor`: load, validate, resolve inputs, execute ordered steps, and save trace.
- `TraceStore`: stores run directories under `runs/`.

Built-in actions:

- `io.read_file`
- `llm.prompt`
- `llm.summarize`
- `control.fanout`
- `control.fanin`
- `eval.exact_match`
