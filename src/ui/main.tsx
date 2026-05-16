import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Cable, CirclePlay, Copy, FileCode2, Grip, Plus, Trash2 } from "lucide-react";
import YAML from "yaml";
import type { StepTrace, WorkflowStep } from "../types.js";
import { editorActions, getEditorAction, type EditorActionDefinition, type FieldDescriptor } from "./actionCatalog.js";
import {
  addStep,
  availableConnections,
  buildMockTrace,
  connectField,
  createInitialEditorState,
  moveStep,
  removeStep,
  updateStepConfig,
  updateStepInput,
  type EditorState,
} from "./editorModel.js";
import "./styles.css";

function App() {
  const [state, setState] = useState<EditorState>(() => createInitialEditorState());
  const [trace, setTrace] = useState<StepTrace[]>([]);
  const selectedStep = state.workflow.steps.find((step) => step.id === state.selectedStepId) ?? state.workflow.steps[0] ?? null;
  const yaml = useMemo(() => YAML.stringify(state.workflow), [state.workflow]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>diy-workflow</h1>
          <span>Visual editor preview</span>
        </div>
        <div className="topbar-actions">
          <button className="secondary" onClick={() => navigator.clipboard?.writeText(yaml)}><Copy size={16}/> Copy YAML</button>
          <button onClick={() => setTrace(buildMockTrace(state.workflow))}><CirclePlay size={16}/> Preview Run</button>
        </div>
      </header>

      <section className="workspace">
        <ActionPalette onAdd={(type) => setState((current) => addStep(current, type))} />
        <Canvas state={state} setState={setState} />
        <aside className="side-panel">
          {selectedStep ? <Inspector state={state} step={selectedStep} setState={setState} /> : <EmptyInspector />}
          <YamlPanel yaml={yaml} />
          <TracePanel trace={trace} />
        </aside>
      </section>
    </main>
  );
}

function ActionPalette({ onAdd }: { onAdd: (type: string) => void }) {
  const groups = groupActionsByNamespace(editorActions);
  return (
    <aside className="palette">
      <div className="panel-heading">
        <Plus size={16}/>
        <h2>Actions</h2>
      </div>
      {[...groups.entries()].map(([namespace, actions]) => (
        <section key={namespace} className="palette-group">
          <h3>{namespace}</h3>
          {actions.map((action) => (
            <button key={action.type} className="action-card" onClick={() => onAdd(action.type)}>
              <strong>{action.label}</strong>
              <span>{action.type}</span>
              <p>{action.description}</p>
            </button>
          ))}
        </section>
      ))}
    </aside>
  );
}

function groupActionsByNamespace(actions: EditorActionDefinition[]): Map<string, EditorActionDefinition[]> {
  return actions.reduce((groups, action) => {
    const existing = groups.get(action.namespace) ?? [];
    existing.push(action);
    groups.set(action.namespace, existing);
    return groups;
  }, new Map<string, EditorActionDefinition[]>());
}

function Canvas({ state, setState }: { state: EditorState; setState: React.Dispatch<React.SetStateAction<EditorState>> }) {
  const [dragging, setDragging] = useState<{ stepId: string; dx: number; dy: number } | null>(null);

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setState((current) => moveStep(current, dragging.stepId, {
      x: Math.max(16, event.clientX - rect.left - dragging.dx),
      y: Math.max(16, event.clientY - rect.top - dragging.dy),
    }));
  }

  return (
    <section className="canvas" onPointerMove={onPointerMove} onPointerUp={() => setDragging(null)} onPointerLeave={() => setDragging(null)}>
      <div className="canvas-grid" />
      <Connections state={state} />
      {state.workflow.steps.map((step, index) => {
        const action = getEditorAction(step.type);
        const pos = state.positions[step.id] ?? { x: 80 + index * 300, y: 96 };
        return (
          <article
            key={step.id}
            className={`node ${state.selectedStepId === step.id ? "selected" : ""}`}
            style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
            onClick={() => setState((current) => ({ ...current, selectedStepId: step.id }))}
          >
            <button
              className="drag-handle"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragging({ stepId: step.id, dx: event.nativeEvent.offsetX, dy: event.nativeEvent.offsetY });
              }}
              title="Drag node"
            >
              <Grip size={15}/>
            </button>
            <div className="node-index">{index + 1}</div>
            <h3>{action?.label ?? step.type}</h3>
            <code>{step.id}</code>
            <div className="node-io">
              <div>
                <span>input</span>
                {(action?.inputFields ?? []).map((field) => <code key={field.name} className="port input-port">{field.name}</code>)}
              </div>
              <div>
                <span>output</span>
                {(action?.outputFields ?? []).map((field) => <code key={field.name} className="port output-port">{field.name}</code>)}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function Connections({ state }: { state: EditorState }) {
  const lines = state.workflow.steps.flatMap((step) => {
    const text = JSON.stringify(step.input);
    return state.workflow.steps.flatMap((source) => text.includes(`steps.${source.id}.output`) ? [{ from: source.id, to: step.id }] : []);
  });
  return (
    <svg className="connections">
      {lines.map((line, index) => {
        const from = state.positions[line.from] ?? { x: 0, y: 0 };
        const to = state.positions[line.to] ?? { x: 0, y: 0 };
        const x1 = from.x + 270;
        const y1 = from.y + 64;
        const x2 = to.x;
        const y2 = to.y + 64;
        return <path key={`${line.from}-${line.to}-${index}`} d={`M ${x1} ${y1} C ${x1 + 80} ${y1}, ${x2 - 80} ${y2}, ${x2} ${y2}`} />;
      })}
    </svg>
  );
}

function Inspector({ state, step, setState }: { state: EditorState; step: WorkflowStep; setState: React.Dispatch<React.SetStateAction<EditorState>> }) {
  const action = getEditorAction(step.type);
  if (!action) return null;
  return (
    <section className="inspector">
      <div className="panel-heading">
        <FileCode2 size={16}/>
        <h2>{action.label}</h2>
      </div>
      <div className="step-meta">
        <label>Step id<input value={step.id} readOnly /></label>
        <label>Type<input value={step.type} readOnly /></label>
      </div>
      <h3>Inputs</h3>
      {action.inputFields.map((field) => (
        <FieldEditor
          key={field.name}
          field={field}
          value={readField(step.input, field.name)}
          connections={availableConnections(state, step.id, field)}
          onChange={(value) => setState((current) => updateStepInput(current, step.id, field.name, value))}
          onConnect={(sourceStep, sourceField) => setState((current) => connectField(current, step.id, field.name, sourceStep, sourceField))}
        />
      ))}
      {action.configFields.length > 0 && <h3>Config</h3>}
      {action.configFields.map((field) => (
        <FieldEditor
          key={field.name}
          field={field}
          value={readField(step.config, field.name)}
          connections={[]}
          onChange={(value) => setState((current) => updateStepConfig(current, step.id, field.name, value))}
        />
      ))}
      <h3>Outputs</h3>
      <div className="output-list">{action.outputFields.map((field) => <code key={field.name}>{field.name}<span>{field.kind}</span></code>)}</div>
      <button className="danger" onClick={() => setState((current) => removeStep(current, step.id))}><Trash2 size={15}/> Delete step</button>
    </section>
  );
}

function FieldEditor({ field, value, connections, onChange, onConnect }: {
  field: FieldDescriptor;
  value: unknown;
  connections: Array<{ fromStepId: string; field: { name: string; kind: string }; reference: string }>;
  onChange: (value: unknown) => void;
  onConnect?: (stepId: string, field: string) => void;
}) {
  return (
    <label className="field-editor">
      <span>{field.label}{field.required ? " *" : ""}</span>
      {field.kind === "textarea" ? (
        <textarea value={stringValue(value)} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : field.kind === "number" ? (
        <input type="number" value={value === undefined ? "" : String(value)} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))} />
      ) : field.kind === "json" || field.kind === "array" ? (
        <textarea value={jsonValue(value)} placeholder={field.placeholder ?? "JSON or reference"} onChange={(event) => onChange(parseJsonish(event.target.value))} />
      ) : (
        <input value={stringValue(value)} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
      {field.connectable && connections.length > 0 && (
        <select defaultValue="" onChange={(event) => {
          const [stepId, outputField] = event.target.value.split(":");
          if (stepId && outputField) onConnect?.(stepId, outputField);
          event.currentTarget.value = "";
        }}>
          <option value="">Connect upstream output...</option>
          {connections.map((connection) => (
            <option key={connection.reference} value={`${connection.fromStepId}:${connection.field.name}`}>
              {connection.fromStepId}.{connection.field.name} ({connection.field.kind})
            </option>
          ))}
        </select>
      )}
    </label>
  );
}

function YamlPanel({ yaml }: { yaml: string }) {
  return <section className="yaml-panel"><h2>YAML</h2><pre>{yaml}</pre></section>;
}

function TracePanel({ trace }: { trace: StepTrace[] }) {
  return (
    <section className="trace-panel">
      <div className="panel-heading"><Cable size={16}/><h2>Preview Trace</h2></div>
      {trace.length === 0 ? <p className="muted">Run a preview to inspect step status, outputs, errors, and metrics.</p> : trace.map((step) => (
        <details key={step.id} open>
          <summary>{step.status.toUpperCase()} {step.id} <span>{step.metrics.durationMs}ms</span></summary>
          <pre>{JSON.stringify({ input: step.input, output: step.output, error: step.error }, null, 2)}</pre>
        </details>
      ))}
    </section>
  );
}

function EmptyInspector() {
  return <section className="inspector"><p className="muted">Select a node to edit inputs, config, and connections.</p></section>;
}

function readField(value: unknown, field: string): unknown {
  return value && typeof value === "object" && field in value ? (value as Record<string, unknown>)[field] : undefined;
}

function stringValue(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function jsonValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value ?? "", null, 2);
}

function parseJsonish(value: string): unknown {
  if (value.trim().startsWith("{{")) return value;
  try { return JSON.parse(value); } catch { return value; }
}

createRoot(document.getElementById("root")!).render(<App />);
