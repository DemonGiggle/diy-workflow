import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Cable, CirclePlay, Copy, FileCode2, Grip, Plus, Trash2 } from "lucide-react";
import YAML from "yaml";
import type { RunTrace, WorkflowStep } from "../types.js";
import { editorActions, getEditorAction, type EditorActionDefinition, type FieldDescriptor } from "./actionCatalog.js";
import {
  addStep,
  availableConnections,
  connectCompatibleField,
  connectField,
  createInitialEditorState,
  getWorkflowConnections,
  isCompatibleConnection,
  moveStep,
  removeStep,
  updateStepConfig,
  updateStepInput,
  type EditorState,
} from "./editorModel.js";
import { listRuns, runWorkflow, showRun } from "./apiClient.js";
import type { OutputDescriptor } from "./actionCatalog.js";
import { createTranslator, isLocale, localeOptions, localizeAction, localizeActions, type Locale } from "./i18n.js";
import "./styles.css";

const localeStorageKey = "diy-workflow.locale";

function App() {
  const [state, setState] = useState<EditorState>(() => createInitialEditorState());
  const [trace, setTrace] = useState<RunTrace | null>(null);
  const [runs, setRuns] = useState<string[]>([]);
  const [locale, setLocale] = useState<Locale>(() => readStoredLocale());
  const t = useMemo(() => createTranslator(locale), [locale]);
  const [statusMessage, setStatusMessage] = useState<string>(() => t("run.ready"));
  const [isRunning, setIsRunning] = useState(false);
  const selectedStep = state.workflow.steps.find((step) => step.id === state.selectedStepId) ?? state.workflow.steps[0] ?? null;
  const yaml = useMemo(() => YAML.stringify(state.workflow), [state.workflow]);

  useEffect(() => {
    window.localStorage?.setItem(localeStorageKey, locale);
  }, [locale]);

  useEffect(() => {
    void refreshRuns(setRuns, setStatusMessage, t);
  }, [t]);

  async function executeWorkflow() {
    setIsRunning(true);
    setStatusMessage(t("run.runningWorkflow"));
    try {
      const nextTrace = await runWorkflow(state.workflow);
      setTrace(nextTrace);
      setStatusMessage(`${nextTrace.status.toUpperCase()} ${nextTrace.runId}`);
      await refreshRuns(setRuns, setStatusMessage, t, false);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRunning(false);
    }
  }

  async function inspectRun(runId: string) {
    setStatusMessage(t("run.loading", { runId }));
    try {
      const nextTrace = await showRun(runId);
      setTrace(nextTrace);
      setStatusMessage(`${nextTrace.status.toUpperCase()} ${nextTrace.runId}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>diy-workflow</h1>
          <span>{t("app.subtitle")}</span>
        </div>
        <div className="topbar-actions">
          <label className="locale-picker">
            <span>{t("locale.label")}</span>
            <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
              {localeOptions.map((option) => <option key={option.locale} value={option.locale}>{option.label}</option>)}
            </select>
          </label>
          <button className="secondary" onClick={() => navigator.clipboard?.writeText(yaml)}><Copy size={16}/> {t("run.copyYaml")}</button>
          <button onClick={executeWorkflow} disabled={isRunning}><CirclePlay size={16}/> {isRunning ? t("run.running") : t("run.runWorkflow")}</button>
        </div>
      </header>

      <section className="workspace">
        <ActionPalette locale={locale} t={t} onAdd={(type) => setState((current) => addStep(current, type))} />
        <Canvas state={state} locale={locale} t={t} setState={setState} />
        <aside className="side-panel">
          {selectedStep ? <Inspector state={state} step={selectedStep} locale={locale} t={t} setState={setState} /> : <EmptyInspector t={t} />}
          <YamlPanel yaml={yaml} t={t} />
          <TracePanel trace={trace} runs={runs} statusMessage={statusMessage} t={t} onRefresh={() => refreshRuns(setRuns, setStatusMessage, t)} onShowRun={inspectRun} />
        </aside>
      </section>
    </main>
  );
}

type Translator = ReturnType<typeof createTranslator>;

function readStoredLocale(): Locale {
  const value = window.localStorage?.getItem(localeStorageKey);
  return value && isLocale(value) ? value : "en";
}

async function refreshRuns(setRuns: (runs: string[]) => void, setStatusMessage: (message: string) => void, t: Translator, reportSuccess = true): Promise<void> {
  try {
    const nextRuns = await listRuns();
    setRuns(nextRuns);
    if (reportSuccess) setStatusMessage(nextRuns.length ? t("run.savedRuns", { count: nextRuns.length }) : t("run.noSavedRuns"));
  } catch {
    setRuns([]);
    setStatusMessage(t("run.unavailable"));
  }
}

function ActionPalette({ locale, t, onAdd }: { locale: Locale; t: Translator; onAdd: (type: string) => void }) {
  const groups = groupActionsByNamespace(localizeActions(editorActions, locale));
  return (
    <aside className="palette">
      <div className="panel-heading">
        <Plus size={16}/>
        <h2>{t("actions.title")}</h2>
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

function Canvas({ state, locale, t, setState }: { state: EditorState; locale: Locale; t: Translator; setState: React.Dispatch<React.SetStateAction<EditorState>> }) {
  const [dragging, setDragging] = useState<{ stepId: string; dx: number; dy: number } | null>(null);
  const [linking, setLinking] = useState<{ stepId: string; field: OutputDescriptor } | null>(null);

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setState((current) => moveStep(current, dragging.stepId, {
      x: Math.max(16, event.clientX - rect.left - dragging.dx),
      y: Math.max(16, event.clientY - rect.top - dragging.dy),
    }));
  }

  return (
    <section className="canvas" onPointerMove={onPointerMove} onPointerUp={() => { setDragging(null); setLinking(null); }} onPointerLeave={() => setDragging(null)}>
      <div className="canvas-grid" />
      <Connections state={state} />
      {state.workflow.steps.map((step, index) => {
        const action = getEditorAction(step.type);
        const localizedAction = action ? localizeAction(action, locale) : undefined;
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
              title={t("editor.dragNode")}
            >
              <Grip size={15}/>
            </button>
            <div className="node-index">{index + 1}</div>
            <h3>{localizedAction?.label ?? step.type}</h3>
            <code>{step.id}</code>
            <div className="node-io">
              <div>
                <span>{t("common.input")}</span>
                {(localizedAction?.inputFields ?? []).map((field) => {
                  const connectable = linking && field.connectable;
                  const compatible = connectable ? field.connectable && isLinkCompatible(linking.field, field) : false;
                  return (
                    <code
                      key={field.name}
                      className={`port input-port ${connectable ? compatible ? "drop-ok" : "drop-blocked" : ""}`}
                      title={field.connectable ? t("editor.connectOutput") : t("editor.notConnectable")}
                      onPointerUp={(event) => {
                        if (!linking) return;
                        event.stopPropagation();
                        const result = connectCompatibleField(state, step.id, field.name, linking.stepId, linking.field.name);
                        if (result.ok) setState(result.state);
                        setLinking(null);
                      }}
                    >
                      {field.name}
                    </code>
                  );
                })}
              </div>
              <div>
                <span>{t("common.output")}</span>
                {(localizedAction?.outputFields ?? []).map((field) => (
                  <code
                    key={field.name}
                    className={`port output-port ${linking?.stepId === step.id && linking.field.name === field.name ? "linking" : ""}`}
                    title={t("editor.connectOutput")}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      setLinking({ stepId: step.id, field });
                    }}
                  >
                    {field.name}
                  </code>
                ))}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function isLinkCompatible(source: OutputDescriptor, target: FieldDescriptor): boolean {
  if (!target.connectable) return false;
  return isCompatibleConnection(source.kind, target.kind);
}

function Connections({ state }: { state: EditorState }) {
  const lines = getWorkflowConnections(state);
  return (
    <svg className="connections">
      {lines.map((line, index) => {
        const from = portPosition(state, line.fromStepId, line.fromField, "output");
        const to = portPosition(state, line.toStepId, line.toField, "input");
        return (
          <g key={`${line.fromStepId}.${line.fromField}-${line.toStepId}.${line.toField}-${index}`}>
            <path d={`M ${from.x} ${from.y} C ${from.x + 86} ${from.y}, ${to.x - 86} ${to.y}, ${to.x} ${to.y}`} />
            <circle cx={from.x} cy={from.y} r="3" />
            <circle cx={to.x} cy={to.y} r="3" />
          </g>
        );
      })}
    </svg>
  );
}

function portPosition(state: EditorState, stepId: string, fieldName: string, side: "input" | "output"): { x: number; y: number } {
  const step = state.workflow.steps.find((item) => item.id === stepId);
  const action = step ? getEditorAction(step.type) : undefined;
  const pos = state.positions[stepId] ?? { x: 0, y: 0 };
  const fields = side === "input" ? action?.inputFields ?? [] : action?.outputFields ?? [];
  const fieldIndex = Math.max(fields.findIndex((field) => field.name === fieldName), 0);
  return {
    x: side === "input" ? pos.x + 16 : pos.x + 264,
    y: pos.y + 154 + fieldIndex * 27,
  };
}

function Inspector({ state, step, locale, t, setState }: { state: EditorState; step: WorkflowStep; locale: Locale; t: Translator; setState: React.Dispatch<React.SetStateAction<EditorState>> }) {
  const action = getEditorAction(step.type);
  if (!action) return null;
  const localizedAction = localizeAction(action, locale);
  return (
    <section className="inspector">
      <div className="panel-heading">
        <FileCode2 size={16}/>
        <h2>{localizedAction.label}</h2>
      </div>
      <div className="step-meta">
        <label>{t("step.id")}<input value={step.id} readOnly /></label>
        <label>{t("common.type")}<input value={step.type} readOnly /></label>
      </div>
      <h3>{t("common.inputs")}</h3>
      {localizedAction.inputFields.map((field) => (
        <FieldEditor
          key={field.name}
          field={field}
          t={t}
          value={readField(step.input, field.name)}
          connections={availableConnections(state, step.id, field)}
          onChange={(value) => setState((current) => updateStepInput(current, step.id, field.name, value))}
          onConnect={(sourceStep, sourceField) => setState((current) => connectField(current, step.id, field.name, sourceStep, sourceField))}
        />
      ))}
      {localizedAction.configFields.length > 0 && <h3>{t("common.config")}</h3>}
      {localizedAction.configFields.map((field) => (
        <FieldEditor
          key={field.name}
          field={field}
          t={t}
          value={readField(step.config, field.name)}
          connections={[]}
          onChange={(value) => setState((current) => updateStepConfig(current, step.id, field.name, value))}
        />
      ))}
      <h3>{t("common.outputs")}</h3>
      <div className="output-list">{localizedAction.outputFields.map((field) => <code key={field.name}>{field.label}<span>{field.name} · {field.kind}</span></code>)}</div>
      <button className="danger" onClick={() => setState((current) => removeStep(current, step.id))}><Trash2 size={15}/> {t("step.delete")}</button>
    </section>
  );
}

function FieldEditor({ field, t, value, connections, onChange, onConnect }: {
  field: FieldDescriptor;
  t: Translator;
  value: unknown;
  connections: Array<{ fromStepId: string; field: { name: string; kind: string }; reference: string }>;
  onChange: (value: unknown) => void;
  onConnect?: (stepId: string, field: string) => void;
}) {
  return (
    <label className="field-editor">
      <span>{field.label}{field.required ? t("field.requiredSuffix") : ""}</span>
      {field.kind === "textarea" ? (
        <textarea value={stringValue(value)} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : field.kind === "boolean" ? (
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />
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
          <option value="">{t("editor.connectOutput")}</option>
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

function YamlPanel({ yaml, t }: { yaml: string; t: Translator }) {
  return <section className="yaml-panel"><h2>{t("yaml.title")}</h2><pre>{yaml}</pre></section>;
}

function TracePanel({ trace, runs, statusMessage, t, onRefresh, onShowRun }: {
  trace: RunTrace | null;
  runs: string[];
  statusMessage: string;
  t: Translator;
  onRefresh: () => void;
  onShowRun: (runId: string) => void;
}) {
  return (
    <section className="trace-panel">
      <div className="panel-heading"><Cable size={16}/><h2>{t("run.title")}</h2></div>
      <p className="muted">{statusMessage}</p>
      <div className="run-list">
        <button className="secondary small" onClick={onRefresh}>{t("run.refresh")}</button>
        {runs.map((runId) => <button key={runId} className="run-pill" onClick={() => onShowRun(runId)}>{runId}</button>)}
      </div>
      {!trace ? <p className="muted">{t("run.inspectHint")}</p> : (
        <>
          <h3>{trace.runId} · {trace.status}</h3>
          {trace.steps.map((step) => (
            <details key={step.id} open>
              <summary>{step.status.toUpperCase()} {step.id} <span>{step.metrics.durationMs}ms</span></summary>
              <pre>{JSON.stringify({ input: step.input, output: step.output, error: step.error }, null, 2)}</pre>
            </details>
          ))}
        </>
      )}
    </section>
  );
}

function EmptyInspector({ t }: { t: Translator }) {
  return <section className="inspector"><p className="muted">{t("editor.noSelection")}</p></section>;
}

function readField(value: unknown, field: string): unknown {
  return field.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object" || !(part in current)) return undefined;
    return (current as Record<string, unknown>)[part];
  }, value);
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
