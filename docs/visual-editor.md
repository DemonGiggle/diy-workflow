# Visual Editor

The visual editor is the UI foundation for composing workflows from typed action inputs and outputs.

## Capabilities

- add and remove action nodes
- drag nodes on the canvas
- inspect action inputs, config, and outputs
- connect compatible output ports into input ports
- edit prompt-oriented action inputs
- enable action-level mock mode from the config panel
- run workflows through the local server API
- inspect stdout-style run output in a dedicated panel
- inspect saved traces
- load existing workflow YAML from local files
- save back to the opened YAML file when supported by the browser
- download YAML when native file-save access is unavailable
- copy generated YAML
- zoom the whole canvas without mutating stored node coordinates
- inspect node layout and drag the visible viewport from a minimap

The top navigation keeps the most common actions visible and grouped:

- view switching stays always visible
- run controls keep validate and run together
- workflow file actions live in a dedicated workflow menu
- lower-frequency controls such as locale and recent-run access live in a secondary menu

Canvas navigation now treats zoom as a pure view transform:

- node coordinates remain in stable model space
- dragging and connection hit targets continue to resolve against model-space positions
- the minimap derives from the same layout state instead of maintaining a second canvas model

## Typed Connections

The editor relies on action schemas and field descriptors to decide which ports can connect.

Example:

- `io.read_file.output.content` can connect to `llm.prompt.input.prompt`
- `llm.prompt.output.text` can connect to `llm.summarize.input.text`

Workflow YAML stores the connection as a reference:

~~~yaml
prompt: "{{steps.io_read_file_1.output.content}}"
~~~

## Local Server API

The editor server provides:

- `GET /api/health`
- `POST /api/workflows/validate`
- `POST /api/workflows/run`
- `GET /api/runs`
- `GET /api/runs/:run_id`

`web-dist/` is resolved from the installed package or repo root, so the editor can be served even if the command starts from another working directory.

`runs/` is resolved from the directory where `diy-workflow serve` starts, so traces stay with the workspace being operated on.

## Localization

The editor supports English and Traditional Chinese.

The language selector changes:

- editor chrome
- action labels
- action descriptions
- field labels
- placeholders
- status messages

Workflow contracts are intentionally not translated:

- action `type`
- step ids
- YAML keys
- references

Locale resources live in `src/ui/i18n.ts`. To add another language, append the locale to `supportedLocales` and provide matching UI/action translations.

The i18n tests verify every editor action and field has localized text.
