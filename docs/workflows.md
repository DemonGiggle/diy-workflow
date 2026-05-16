# Workflow YAML

Workflows are YAML documents with ordered steps.

~~~yaml
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
~~~

## Step Shape

Each step has:

- `id`: unique identifier used by later references
- `type`: action type registered in the action registry
- `input`: input object validated against the action input schema
- `config`: optional config object validated against the action config schema

## References

Later steps can reference earlier step outputs:

~~~yaml
text: "{{steps.read.output.content}}"
~~~

Reference format:

~~~text
{{steps.step_id.output.field}}
~~~

References must point to earlier steps. Forward references are rejected during validation.

## Validation

Validation checks:

- workflow shape
- unique step ids
- valid action types
- valid references
- action input schemas
- action config schemas

Run validation with:

~~~sh
node dist/cli.js validate workflow.yaml
~~~

## Execution And Traces

Executor flow:

~~~text
load -> validate -> resolve inputs -> execute -> save trace
~~~

Traces are saved under:

~~~text
runs/run_xxxx/trace.json
~~~

Each step trace contains:

- step id
- input
- output
- status
- error
- metrics
