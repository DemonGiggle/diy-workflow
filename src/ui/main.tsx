import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Cable, CheckCircle2, CirclePlay, Copy, Download, FileCode2, FolderOpen, Grip, LocateFixed, Minus, MoreHorizontal, Plus, Save, Settings2, Trash2 } from "lucide-react";
import YAML from "yaml";
import type { LlmProviderKind, LogLevel, RunTrace, WorkflowStep } from "../types.js";
import { isLlmActionType, listSelectableModels } from "../providers.js";
import { editorActions, getEditorAction, type EditorActionDefinition, type FieldDescriptor } from "./actionCatalog.js";
import {
  addProvider,
  addProviderModel,
  addStep,
  availableConnections,
  connectCompatibleField,
  connectField,
  createEditorStateFromWorkflow,
  createInitialEditorState,
  getLlmProviderSelection,
  getProviderCatalog,
  getWorkflowConnections,
  isCompatibleConnection,
  moveStep,
  removeProvider,
  removeProviderModel,
  removeStep,
  setDefaultModel,
  setDefaultProvider,
  setStepLlmModel,
  setStepLlmProvider,
  updateProviderField,
  updateProviderModelCapability,
  updateProviderModelField,
  updateStepConfig,
  updateStepInput,
  type EditorState,
} from "./editorModel.js";
import { listRuns, runWorkflow, showRun, validateWorkflow } from "./apiClient.js";
import type { OutputDescriptor } from "./actionCatalog.js";
import { createTranslator, isLocale, localeOptions, localizeAction, localizeActions, type Locale } from "./i18n.js";
import { isLlmProviderSelectionDisabled } from "./llmSelection.js";
import { createTopbarLayout, type TopbarActionId } from "./topbar.js";
import { listRunOutputEntries } from "./runOutput.js";
import { formatValidationIssues, parseWorkflowYaml, suggestWorkflowFileName } from "./workflowFiles.js";
import {
  calculateDraggedNodePosition,
  calculateNodeDragOffset,
  calculateScrollForViewportCenter,
  calculateScrollForViewportTopLeft,
  calculateViewportFrame,
  clampZoom,
  deriveCanvasBounds,
  type CanvasViewport,
  type Point,
  type Size,
  type ViewportFrame,
} from "./drag.js";
import "./styles.css";

const localeStorageKey = "diy-workflow.locale";
const yamlPickerTypes = [{
  description: "Workflow YAML",
  accept: {
    "application/yaml": [".yaml", ".yml"],
    "text/yaml": [".yaml", ".yml"],
    "text/plain": [".yaml", ".yml"],
  },
}];

function App() {
  const [state, setState] = useState<EditorState>(() => createInitialEditorState());
  const [trace, setTrace] = useState<RunTrace | null>(null);
  const [runs, setRuns] = useState<string[]>([]);
  const [locale, setLocale] = useState<Locale>(() => readStoredLocale());
  const [view, setView] = useState<"workflow" | "providers">("workflow");
  const t = useMemo(() => createTranslator(locale), [locale]);
  const [statusMessage, setStatusMessage] = useState<string>(() => t("run.ready"));
  const [isRunning, setIsRunning] = useState(false);
  const [workflowFileHandle, setWorkflowFileHandle] = useState<WorkflowFileHandle | null>(null);
  const [workflowFileName, setWorkflowFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedStep = state.workflow.steps.find((step) => step.id === state.selectedStepId) ?? state.workflow.steps[0] ?? null;
  const yaml = useMemo(() => YAML.stringify(state.workflow), [state.workflow]);
  const saveUsesFileSystemApi = workflowFileHandle !== null || supportsSavePicker();
  const saveActionLabel = saveUsesFileSystemApi ? t("yaml.saveAction") : t("yaml.downloadAction");
  const topbarLayout = useMemo(() => createTopbarLayout({ saveUsesFileSystemApi, hasRuns: runs.length > 0 }), [saveUsesFileSystemApi, runs.length]);
  const latestRunLabel = runs[0] ?? t("topbar.noRuns");

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

  async function applyLoadedWorkflow(file: File, handle: WorkflowFileHandle | null) {
    const loadedYaml = await file.text();
    const workflow = parseWorkflowYaml(loadedYaml);
    const validation = await validateWorkflow(workflow);
    if (!validation.ok) {
      throw new Error(formatValidationIssues(validation.issues));
    }

    setState(createEditorStateFromWorkflow(workflow));
    setTrace(null);
    setWorkflowFileHandle(handle);
    setWorkflowFileName(file.name);
    setStatusMessage(t("yaml.loaded", { fileName: file.name }));
  }

  async function openWorkflowYaml() {
    try {
      if (supportsOpenPicker()) {
        const [handle] = await getFileSystemWindow().showOpenFilePicker?.({
          multiple: false,
          excludeAcceptAllOption: true,
          types: yamlPickerTypes,
        }) ?? [];
        if (handle) await applyLoadedWorkflow(await handle.getFile(), handle);
        return;
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
        fileInputRef.current.click();
      }
    } catch (error) {
      if (isAbortError(error)) return;
      setStatusMessage(t("yaml.loadFailed", { message: error instanceof Error ? error.message : String(error) }));
    }
  }

  async function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    try {
      await applyLoadedWorkflow(file, null);
    } catch (error) {
      setStatusMessage(t("yaml.loadFailed", { message: error instanceof Error ? error.message : String(error) }));
    }
  }

  async function saveWorkflowYaml() {
    const suggestedName = workflowFileName ?? suggestWorkflowFileName(state.workflow);

    try {
      if (workflowFileHandle) {
        await writeWorkflowFile(workflowFileHandle, yaml);
        setStatusMessage(t("yaml.saved", { fileName: workflowFileHandle.name }));
        return;
      }

      if (supportsSavePicker()) {
        const handle = await getFileSystemWindow().showSaveFilePicker?.({
          suggestedName,
          excludeAcceptAllOption: true,
          types: yamlPickerTypes,
        });
        if (!handle) return;
        await writeWorkflowFile(handle, yaml);
        setWorkflowFileHandle(handle);
        setWorkflowFileName(handle.name);
        setStatusMessage(t("yaml.saved", { fileName: handle.name }));
        return;
      }

      downloadWorkflowYaml(yaml, suggestedName);
      setWorkflowFileName(suggestedName);
      setStatusMessage(t("yaml.downloaded", { fileName: suggestedName }));
    } catch (error) {
      if (isAbortError(error)) return;
      setStatusMessage(t("yaml.saveFailed", { message: error instanceof Error ? error.message : String(error) }));
    }
  }

  async function copyWorkflowYaml() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(yaml);
      setStatusMessage(t("yaml.copied"));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function validateCurrentWorkflow() {
    setStatusMessage(t("run.validatingWorkflow"));
    try {
      const validation = await validateWorkflow(state.workflow);
      setStatusMessage(validation.ok ? t("run.validationPassed") : formatValidationIssues(validation.issues));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleTopbarAction(actionId: TopbarActionId, trigger: HTMLElement) {
    closeTopbarMenu(trigger);

    switch (actionId) {
      case "open-workflow":
        await openWorkflowYaml();
        break;
      case "save-workflow":
        await saveWorkflowYaml();
        break;
      case "copy-yaml":
        await copyWorkflowYaml();
        break;
      case "validate-workflow":
        await validateCurrentWorkflow();
        break;
      case "run-workflow":
        await executeWorkflow();
        break;
      case "show-latest-run":
        if (runs[0]) await inspectRun(runs[0]);
        break;
      case "refresh-runs":
        await refreshRuns(setRuns, setStatusMessage, t);
        break;
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-main">
          <div className="topbar-brand">
            <div>
              <h1>diy-workflow</h1>
              <span>{t("app.subtitle")}</span>
            </div>
          </div>
          <div className="topbar-actions">
            <details className="topbar-menu">
              <summary className="topbar-menubar-button">
                <FolderOpen size={16}/>
                {t("topbar.fileGroup")}
              </summary>
              <div className="topbar-menu-panel" role="menu" aria-label={t("topbar.fileGroup")}>
                {topbarLayout.workflowMenuActions.map((action) => (
                  <button
                    key={action.id}
                    className="secondary topbar-menu-item"
                    onClick={(event) => void handleTopbarAction(action.id, event.currentTarget)}
                  >
                    {iconForTopbarAction(action.id, saveUsesFileSystemApi)}
                    {action.id === "save-workflow" ? saveActionLabel : t(action.labelKey)}
                  </button>
                ))}
              </div>
            </details>

            <section className="topbar-group topbar-run-group">
              <div className="topbar-button-row">
                {topbarLayout.runActions.map((action) => (
                  <button
                    key={action.id}
                    className={action.emphasis === "primary" ? undefined : "secondary"}
                    disabled={isRunning && action.id !== "validate-workflow"}
                    onClick={(event) => void handleTopbarAction(action.id, event.currentTarget)}
                  >
                    {iconForTopbarAction(action.id, saveUsesFileSystemApi)}
                    {action.id === "run-workflow" && isRunning ? t("run.running") : t(action.labelKey)}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="topbar-utility">
            <details className="topbar-menu">
              <summary className="topbar-menubar-button">
                <MoreHorizontal size={16}/>
                {t("topbar.moreGroup")}
              </summary>
              <div className="topbar-menu-panel topbar-menu-panel-wide" role="menu" aria-label={t("topbar.moreGroup")}>
                <label className="topbar-menu-field">
                  <span>{t("locale.label")}</span>
                  <select
                    value={locale}
                    onChange={(event) => {
                      setLocale(event.target.value as Locale);
                    }}
                  >
                    {localeOptions.map((option) => <option key={option.locale} value={option.locale}>{option.label}</option>)}
                  </select>
                </label>
                <div className="topbar-menu-divider" />
                {topbarLayout.moreMenuActions.map((action) => (
                  <button
                    key={action.id}
                    className="secondary topbar-menu-item"
                    onClick={(event) => void handleTopbarAction(action.id, event.currentTarget)}
                  >
                    {iconForTopbarAction(action.id, saveUsesFileSystemApi)}
                    {t(action.labelKey)}
                  </button>
                ))}
              </div>
            </details>
          </div>
        </div>
        <div className="topbar-statusbar">
          <div className="topbar-status-items">
            <span className="topbar-meta">
              <strong>{t("topbar.currentFile")}</strong>
              {workflowFileName ?? t("topbar.unsavedWorkflow")}
            </span>
            <span className={`topbar-meta topbar-status-meta ${isRunning ? "is-running" : ""}`}>
              <strong>{t("topbar.runStatus")}</strong>
              {statusMessage}
            </span>
            <span className="topbar-meta">
              <strong>{t("run.title")}</strong>
              {latestRunLabel}
            </span>
          </div>
          <div className="view-switch" role="tablist" aria-label="Editor view">
            <button className={view === "workflow" ? "secondary active-tab" : "secondary"} onClick={() => setView("workflow")}>{t("view.workflow")}</button>
            <button className={view === "providers" ? "secondary active-tab" : "secondary"} onClick={() => setView("providers")}>{t("view.providers")}</button>
          </div>
        </div>
      </header>
      <input ref={fileInputRef} type="file" accept=".yaml,.yml" hidden onChange={handleFileInputChange} />

      <section className="workspace">
        {view === "workflow" ? (
          <>
            <ActionPalette locale={locale} t={t} onAdd={(type) => setState((current) => addStep(current, type))} />
            <Canvas state={state} locale={locale} t={t} setState={setState} />
          </>
        ) : (
          <>
            <ProvidersSummary state={state} t={t} />
            <ProviderSettings state={state} t={t} setState={setState} />
          </>
        )}
        <aside className="side-panel">
          {view === "workflow"
            ? selectedStep ? <Inspector state={state} step={selectedStep} locale={locale} t={t} setState={setState} /> : <EmptyInspector t={t} />
            : <ProviderDefaultsPanel state={state} t={t} setState={setState} />}
          <YamlPanel yaml={yaml} t={t} fileName={workflowFileName} />
          <OutputPanel trace={trace} t={t} />
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

function closeTopbarMenu(target: HTMLElement | null) {
  const details = target?.closest("details");
  if (details instanceof HTMLDetailsElement) details.open = false;
}

function iconForTopbarAction(actionId: TopbarActionId, saveUsesFileSystemApi: boolean): React.ReactNode {
  switch (actionId) {
    case "open-workflow":
      return <FolderOpen size={16}/>;
    case "save-workflow":
      return saveUsesFileSystemApi ? <Save size={16}/> : <Download size={16}/>;
    case "copy-yaml":
      return <Copy size={16}/>;
    case "validate-workflow":
      return <CheckCircle2 size={16}/>;
    case "run-workflow":
      return <CirclePlay size={16}/>;
    case "show-latest-run":
    case "refresh-runs":
      return <Cable size={16}/>;
  }
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
  const canvasRef = useRef<HTMLElement>(null);
  const [zoom, setZoom] = useState(1);
  const [viewport, setViewport] = useState<CanvasViewport>({ scrollLeft: 0, scrollTop: 0, clientWidth: 0, clientHeight: 0 });
  const [dragging, setDragging] = useState<{ stepId: string; offset: Point } | null>(null);
  const [linking, setLinking] = useState<{ stepId: string; field: OutputDescriptor } | null>(null);
  const [minimapDrag, setMinimapDrag] = useState<{ offset: Point } | null>(null);
  const bounds = useMemo(() => deriveCanvasBounds(state.positions), [state.positions]);
  const viewportFrame = useMemo(() => calculateViewportFrame(viewport, zoom, bounds), [bounds, viewport, zoom]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;

    const updateViewport = () => {
      setViewport({
        scrollLeft: element.scrollLeft,
        scrollTop: element.scrollTop,
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
      });
    };

    updateViewport();
    element.addEventListener("scroll", updateViewport, { passive: true });
    const resizeObserver = new ResizeObserver(updateViewport);
    resizeObserver.observe(element);
    return () => {
      element.removeEventListener("scroll", updateViewport);
      resizeObserver.disconnect();
    };
  }, []);

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const currentViewport = readViewport(event.currentTarget);
    const position = calculateDraggedNodePosition({ x: event.clientX, y: event.clientY }, rect, currentViewport, dragging.offset, zoom);
    setState((current) => moveStep(current, dragging.stepId, position));
  }

  function changeZoom(nextZoom: number) {
    const element = canvasRef.current;
    const clampedZoom = clampZoom(nextZoom);
    if (!element) {
      setZoom(clampedZoom);
      return;
    }

    const center = {
      x: viewportFrame.left + viewportFrame.width / 2,
      y: viewportFrame.top + viewportFrame.height / 2,
    };
    setZoom(clampedZoom);
    requestAnimationFrame(() => {
      const scroll = calculateScrollForViewportCenter(center, {
        width: element.clientWidth,
        height: element.clientHeight,
      }, bounds, clampedZoom);
      element.scrollTo({ left: scroll.x, top: scroll.y });
    });
  }

  function moveViewport(topLeft: Point) {
    const element = canvasRef.current;
    if (!element) return;
    const scroll = calculateScrollForViewportTopLeft(topLeft, {
      width: element.clientWidth,
      height: element.clientHeight,
    }, bounds, zoom);
    element.scrollTo({ left: scroll.x, top: scroll.y });
  }

  return (
    <section
      ref={canvasRef}
      className="canvas"
      onPointerMove={onPointerMove}
      onPointerUp={() => { setDragging(null); setLinking(null); }}
      onPointerLeave={() => setDragging(null)}
    >
      <div className="canvas-toolbar">
        <button className="secondary" onClick={() => changeZoom(zoom - 0.1)} title={t("canvas.zoomOut")} aria-label={t("canvas.zoomOut")}>
          <Minus size={15}/>
        </button>
        <button className="secondary canvas-zoom-pill" onClick={() => changeZoom(1)} title={t("canvas.zoomReset")} aria-label={t("canvas.zoomReset")}>
          {Math.round(zoom * 100)}%
        </button>
        <button className="secondary" onClick={() => changeZoom(zoom + 0.1)} title={t("canvas.zoomIn")} aria-label={t("canvas.zoomIn")}>
          <Plus size={15}/>
        </button>
      </div>

      <div className="canvas-space" style={{ width: `${bounds.width * zoom}px`, height: `${bounds.height * zoom}px` }}>
        <div className="canvas-viewport" style={{ width: `${bounds.width}px`, height: `${bounds.height}px`, transform: `scale(${zoom})` }}>
          <div className="canvas-grid" style={{ width: `${bounds.width}px`, height: `${bounds.height}px` }} />
          <Connections state={state} bounds={bounds} />
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
                    const canvasElement = canvasRef.current;
                    const canvasRect = canvasElement?.getBoundingClientRect();
                    if (!canvasElement || !canvasRect) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    const offset = calculateNodeDragOffset(
                      { x: event.clientX, y: event.clientY },
                      canvasRect,
                      readViewport(canvasElement),
                      pos,
                      zoom,
                    );
                    setDragging({ stepId: step.id, offset });
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
        </div>
      </div>

      <MiniMap
        bounds={bounds}
        state={state}
        viewportFrame={viewportFrame}
        locale={locale}
        title={t("canvas.minimap")}
        onMoveViewport={moveViewport}
        onStartDrag={setMinimapDrag}
        minimapDrag={minimapDrag}
      />
    </section>
  );
}

function isLinkCompatible(source: OutputDescriptor, target: FieldDescriptor): boolean {
  if (!target.connectable) return false;
  return isCompatibleConnection(source.kind, target.kind);
}

function Connections({ state, bounds }: { state: EditorState; bounds: Size }) {
  const lines = getWorkflowConnections(state);
  return (
    <svg className="connections" viewBox={`0 0 ${bounds.width} ${bounds.height}`} preserveAspectRatio="none" style={{ width: `${bounds.width}px`, height: `${bounds.height}px` }}>
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

function MiniMap({
  bounds,
  state,
  viewportFrame,
  locale,
  title,
  onMoveViewport,
  onStartDrag,
  minimapDrag,
}: {
  bounds: Size;
  state: EditorState;
  viewportFrame: ViewportFrame;
  locale: Locale;
  title: string;
  onMoveViewport: (topLeft: Point) => void;
  onStartDrag: React.Dispatch<React.SetStateAction<{ offset: Point } | null>>;
  minimapDrag: { offset: Point } | null;
}) {
  const scale = Math.min(180 / bounds.width, 116 / bounds.height);
  const width = bounds.width * scale;
  const height = bounds.height * scale;
  const offsetX = (180 - width) / 2;
  const offsetY = (116 - height) / 2;
  const frameStyle = {
    left: `${offsetX + viewportFrame.left * scale}px`,
    top: `${offsetY + viewportFrame.top * scale}px`,
    width: `${Math.max(18, viewportFrame.width * scale)}px`,
    height: `${Math.max(14, viewportFrame.height * scale)}px`,
  };

  function modelPointFromClient(clientX: number, clientY: number, rect: DOMRect): Point {
    return {
      x: clampModel((clientX - rect.left - offsetX) / scale, bounds.width),
      y: clampModel((clientY - rect.top - offsetY) / scale, bounds.height),
    };
  }

  function pointInViewport(modelPoint: Point): boolean {
    return modelPoint.x >= viewportFrame.left
      && modelPoint.x <= viewportFrame.left + viewportFrame.width
      && modelPoint.y >= viewportFrame.top
      && modelPoint.y <= viewportFrame.top + viewportFrame.height;
  }

  return (
    <section
      className="minimap"
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const modelPoint = modelPointFromClient(event.clientX, event.clientY, rect);
        event.currentTarget.setPointerCapture(event.pointerId);
        if (pointInViewport(modelPoint)) {
          onStartDrag({ offset: { x: modelPoint.x - viewportFrame.left, y: modelPoint.y - viewportFrame.top } });
        } else {
          onMoveViewport({ x: modelPoint.x - viewportFrame.width / 2, y: modelPoint.y - viewportFrame.height / 2 });
        }
      }}
      onPointerMove={(event) => {
        if (!minimapDrag) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const modelPoint = modelPointFromClient(event.clientX, event.clientY, rect);
        onMoveViewport({ x: modelPoint.x - minimapDrag.offset.x, y: modelPoint.y - minimapDrag.offset.y });
      }}
      onPointerUp={() => onStartDrag(null)}
      onPointerLeave={() => onStartDrag(null)}
    >
      <header className="minimap-header">
        <LocateFixed size={14}/>
        <span>{title}</span>
      </header>
      <div className="minimap-surface">
        <div className="minimap-canvas" style={{ width: `${width}px`, height: `${height}px`, left: `${offsetX}px`, top: `${offsetY}px` }}>
          {state.workflow.steps.map((step, index) => {
            const action = getEditorAction(step.type);
            const label = action ? localizeAction(action, locale).label : step.type;
            const pos = state.positions[step.id] ?? { x: 80 + index * 300, y: 96 };
            return (
              <div
                key={step.id}
                className={`minimap-node ${state.selectedStepId === step.id ? "selected" : ""}`}
                title={label}
                style={{
                  left: `${pos.x * scale}px`,
                  top: `${pos.y * scale}px`,
                  width: `${Math.max(10, 280 * scale)}px`,
                  height: `${Math.max(8, 164 * scale)}px`,
                }}
              />
            );
          })}
          <div className="minimap-viewport" style={frameStyle} />
        </div>
      </div>
    </section>
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
      {isLlmActionType(step.type) && (
        <LlmSelectionEditor state={state} step={step} t={t} setState={setState} />
      )}
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

function LlmSelectionEditor({ state, step, t, setState }: {
  state: EditorState;
  step: WorkflowStep;
  t: Translator;
  setState: React.Dispatch<React.SetStateAction<EditorState>>;
}) {
  if (!isLlmActionType(step.type)) return null;

  const catalog = getProviderCatalog(state);
  const selection = getLlmProviderSelection(state, step);
  if (!selection) return null;

  const explicitProviderId = selection.explicitProviderId ?? "";
  const activeProvider = explicitProviderId
    ? catalog.providers.find((provider) => provider.id === explicitProviderId)
    : catalog.providers.find((provider) => provider.id === selection.resolvedProviderId);
  const activeModels = activeProvider ? listSelectableModels(activeProvider, selection.requiredCapability) : [];
  const providerOptions = catalog.providers.filter((provider) => provider.enabled !== false);
  const providerValue = explicitProviderId;
  const defaultLabel = t("llm.selectionDefault", {
    providerId: selection.resolvedProviderId ?? "?",
    modelId: selection.resolvedModelId ?? "?",
  });
  const selectedModelValue = selection.explicitModelId ?? "";
  const hasInvalidProvider = Boolean(explicitProviderId) && providerOptions.every((provider) => provider.id !== explicitProviderId);
  const hasInvalidModel = Boolean(selectedModelValue) && activeModels.every((model) => model.id !== selectedModelValue);
  const providerSelectionDisabled = isLlmProviderSelectionDisabled(step);

  return (
    <>
      <h3>{t("llm.selection")}</h3>
      <div className="llm-selection-grid">
        <label>
          <span>{t("llm.provider")}</span>
          <select value={providerValue} disabled={providerSelectionDisabled} onChange={(event) => setState((current) => setStepLlmProvider(current, step.id, event.target.value))}>
            <option value="">{defaultLabel}</option>
            {providerOptions.map((provider) => <option key={provider.id} value={provider.id}>{provider.label} ({provider.id})</option>)}
            {hasInvalidProvider && <option value={explicitProviderId}>{t("llm.selectionInvalid", { value: explicitProviderId })}</option>}
          </select>
        </label>
        <label>
          <span>{t("llm.model")}</span>
          <select
            value={selectedModelValue}
            disabled={providerSelectionDisabled || !explicitProviderId}
            onChange={(event) => setState((current) => setStepLlmModel(current, step.id, event.target.value))}
          >
            {!explicitProviderId ? (
              <option value="">{defaultLabel}</option>
            ) : (
              <>
                {activeModels.map((model) => <option key={model.id} value={model.id}>{model.label} ({model.id})</option>)}
                {activeModels.length === 0 && !hasInvalidModel && <option value="">{t("llm.noModels", { capability: selection.requiredCapability })}</option>}
                {hasInvalidModel && <option value={selectedModelValue}>{t("llm.selectionInvalid", { value: selectedModelValue })}</option>}
              </>
            )}
          </select>
        </label>
      </div>
      {explicitProviderId && activeProvider && activeModels.length === 0 && (
        <p className="field-error">{t("llm.noModels", { capability: selection.requiredCapability })}</p>
      )}
      {selection.issues.map((issue) => <p key={issue.field + issue.message} className="field-error">{issue.message}</p>)}
    </>
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
      ) : field.kind === "json" || field.kind === "array" || field.kind === "image" ? (
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

function ProvidersSummary({ state, t }: { state: EditorState; t: Translator }) {
  const catalog = getProviderCatalog(state);
  return (
    <aside className="palette providers-summary">
      <div className="panel-heading">
        <Settings2 size={16}/>
        <h2>{t("providers.title")}</h2>
      </div>
      <p className="muted">{catalog.providers.length} provider(s)</p>
      {catalog.providers.map((provider) => (
        <section key={provider.id} className="palette-group">
          <h3>{provider.label}</h3>
          <p className="summary-line">{provider.id} · {provider.kind}</p>
          <p className="summary-line">{provider.models.length} model(s)</p>
        </section>
      ))}
    </aside>
  );
}

function ProviderSettings({ state, t, setState }: { state: EditorState; t: Translator; setState: React.Dispatch<React.SetStateAction<EditorState>> }) {
  const catalog = getProviderCatalog(state);
  const providerKinds: LlmProviderKind[] = ["openai-compatible", "anthropic", "gemini", "mock", "custom"];

  return (
    <section className="provider-settings">
      <div className="panel-heading">
        <Settings2 size={16}/>
        <h2>{t("providers.title")}</h2>
      </div>
      {catalog.providers.length === 0 && <p className="muted">{t("providers.empty")}</p>}
      <div className="provider-list">
        {catalog.providers.map((provider, providerIndex) => (
          <article key={`provider-${providerIndex}`} className="provider-card">
            <div className="provider-card-header">
              <div>
                <strong>{provider.label}</strong>
                <span>{provider.id}</span>
              </div>
              <button className="danger small" onClick={() => setState((current) => removeProvider(current, providerIndex))}><Trash2 size={15}/> {t("providers.deleteProvider")}</button>
            </div>

            <div className="provider-grid">
              <label><span>{t("providers.providerId")}</span><input value={provider.id} onChange={(event) => setState((current) => updateProviderField(current, providerIndex, "id", event.target.value))} /></label>
              <label><span>{t("providers.providerLabel")}</span><input value={provider.label} onChange={(event) => setState((current) => updateProviderField(current, providerIndex, "label", event.target.value))} /></label>
              <label>
                <span>{t("providers.providerKind")}</span>
                <select value={provider.kind} onChange={(event) => setState((current) => updateProviderField(current, providerIndex, "kind", event.target.value))}>
                  {providerKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                </select>
              </label>
              <label><span>{t("providers.enabled")}</span><input type="checkbox" checked={provider.enabled !== false} onChange={(event) => setState((current) => updateProviderField(current, providerIndex, "enabled", event.target.checked))} /></label>
              <label><span>{t("providers.baseUrl")}</span><input value={provider.baseUrl ?? ""} onChange={(event) => setState((current) => updateProviderField(current, providerIndex, "baseUrl", event.target.value))} /></label>
              <label><span>{t("providers.apiKeyRef")}</span><input value={provider.apiKeyRef ?? ""} onChange={(event) => setState((current) => updateProviderField(current, providerIndex, "apiKeyRef", event.target.value))} /></label>
            </div>

            <div className="provider-models">
              {provider.models.map((model, modelIndex) => (
                <section key={`provider-${providerIndex}-model-${modelIndex}`} className="model-card">
                  <div className="provider-card-header">
                    <div>
                      <strong>{model.label}</strong>
                      <span>{model.id}</span>
                    </div>
                    <button className="secondary small" onClick={() => setState((current) => removeProviderModel(current, providerIndex, modelIndex))}><Trash2 size={15}/> {t("providers.deleteModel")}</button>
                  </div>
                  <div className="provider-grid">
                    <label><span>{t("providers.modelId")}</span><input value={model.id} onChange={(event) => setState((current) => updateProviderModelField(current, providerIndex, modelIndex, "id", event.target.value))} /></label>
                    <label><span>{t("providers.modelLabel")}</span><input value={model.label} onChange={(event) => setState((current) => updateProviderModelField(current, providerIndex, modelIndex, "label", event.target.value))} /></label>
                    <label><span>{t("providers.contextWindow")}</span><input type="number" value={model.contextWindow ?? ""} onChange={(event) => setState((current) => updateProviderModelField(current, providerIndex, modelIndex, "contextWindow", event.target.value === "" ? undefined : Number(event.target.value)))} /></label>
                    <label><span>{t("providers.enabled")}</span><input type="checkbox" checked={model.enabled !== false} onChange={(event) => setState((current) => updateProviderModelField(current, providerIndex, modelIndex, "enabled", event.target.checked))} /></label>
                  </div>
                  <div className="capability-group">
                    <span>{t("providers.capabilities")}</span>
                    <label><input type="checkbox" checked={model.capabilities?.text === true} onChange={(event) => setState((current) => updateProviderModelCapability(current, providerIndex, modelIndex, "text", event.target.checked))} />{t("providers.capability.text")}</label>
                    <label><input type="checkbox" checked={model.capabilities?.vision === true} onChange={(event) => setState((current) => updateProviderModelCapability(current, providerIndex, modelIndex, "vision", event.target.checked))} />{t("providers.capability.vision")}</label>
                    <label><input type="checkbox" checked={model.capabilities?.structuredOutput === true} onChange={(event) => setState((current) => updateProviderModelCapability(current, providerIndex, modelIndex, "structuredOutput", event.target.checked))} />{t("providers.capability.structuredOutput")}</label>
                    <label><input type="checkbox" checked={model.capabilities?.tools === true} onChange={(event) => setState((current) => updateProviderModelCapability(current, providerIndex, modelIndex, "tools", event.target.checked))} />{t("providers.capability.tools")}</label>
                  </div>
                </section>
              ))}
              <button className="secondary" onClick={() => setState((current) => addProviderModel(current, providerIndex))}><Plus size={16}/> {t("providers.addModel")}</button>
            </div>
          </article>
        ))}
      </div>
      <button onClick={() => setState((current) => addProvider(current))}><Plus size={16}/> {t("providers.addProvider")}</button>
    </section>
  );
}

function ProviderDefaultsPanel({ state, t, setState }: { state: EditorState; t: Translator; setState: React.Dispatch<React.SetStateAction<EditorState>> }) {
  const catalog = getProviderCatalog(state);
  const selectedProvider = catalog.providers.find((provider) => provider.id === catalog.defaultProviderId) ?? catalog.providers[0];

  return (
    <section className="inspector">
      <div className="panel-heading">
        <Settings2 size={16}/>
        <h2>{t("providers.defaults")}</h2>
      </div>
      <label>
        <span>{t("providers.defaultProvider")}</span>
        <select value={catalog.defaultProviderId ?? ""} onChange={(event) => setState((current) => setDefaultProvider(current, event.target.value))}>
          {catalog.providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.label} ({provider.id})</option>)}
        </select>
      </label>
      <label>
        <span>{t("providers.defaultModel")}</span>
        <select value={catalog.defaultModelId ?? ""} onChange={(event) => setState((current) => setDefaultModel(current, event.target.value))}>
          {(selectedProvider?.models ?? []).map((model) => <option key={model.id} value={model.id}>{model.label} ({model.id})</option>)}
        </select>
      </label>
    </section>
  );
}

function YamlPanel({ yaml, t, fileName }: { yaml: string; t: Translator; fileName: string | null }) {
  return (
    <section className="yaml-panel">
      <h2>{t("yaml.title")}</h2>
      {fileName ? <p className="muted">{fileName}</p> : null}
      <pre>{yaml}</pre>
    </section>
  );
}

function OutputPanel({ trace, t }: { trace: RunTrace | null; t: Translator }) {
  const [logLevel, setLogLevel] = useState<LogLevel>("info");
  const entries = useMemo(() => listRunOutputEntries(trace, logLevel), [logLevel, trace]);
  const categoryLabel = (category?: string): string => category ?? "log";

  return (
    <section className="output-panel">
      <div className="panel-heading output-panel-heading">
        <h2>{t("output.title")}</h2>
        <label className="output-filter">
          <span>{t("output.levelFilter")}</span>
          <select value={logLevel} onChange={(event) => setLogLevel(event.target.value as LogLevel)}>
            <option value="debug">{t("output.level.debug")}</option>
            <option value="info">{t("output.level.info")}</option>
            <option value="warn">{t("output.level.warn")}</option>
            <option value="error">{t("output.level.error")}</option>
          </select>
        </label>
      </div>
      {!trace ? <p className="muted">{t("output.inspectHint")}</p> : !entries.length ? <p className="muted">{t("output.empty")}</p> : (
        <div className="output-entries">
          {entries.map((entry, index) => (
            <article key={`${entry.stepId}-${index}`} className="output-entry">
              <div className="output-entry-header">
                <strong>{t("output.step", { stepId: entry.stepId })}</strong>
                <span>{t("output.meta", { level: entry.level.toUpperCase(), category: categoryLabel(entry.category) })}</span>
              </div>
              {entry.label ? <p className="output-label">{entry.label}</p> : null}
              {typeof entry.bytes === "number" ? <p className="output-meta">{t("output.bytes", { bytes: entry.bytes })}</p> : null}
              <pre>{entry.message}</pre>
            </article>
          ))}
        </div>
      )}
    </section>
  );
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

interface WorkflowFileWriter {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

interface WorkflowFileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WorkflowFileWriter>;
}

interface WindowWithFileSystemAccess extends Window {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<WorkflowFileHandle[]>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    excludeAcceptAllOption?: boolean;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<WorkflowFileHandle>;
}

function getFileSystemWindow(): WindowWithFileSystemAccess {
  return window as WindowWithFileSystemAccess;
}

function supportsOpenPicker(): boolean {
  return typeof getFileSystemWindow().showOpenFilePicker === "function";
}

function supportsSavePicker(): boolean {
  return typeof getFileSystemWindow().showSaveFilePicker === "function";
}

function isAbortError(error: unknown): boolean {
  return (error instanceof DOMException && error.name === "AbortError")
    || (error instanceof Error && error.name === "AbortError");
}

async function writeWorkflowFile(handle: WorkflowFileHandle, content: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

function downloadWorkflowYaml(content: string, fileName: string): void {
  const blob = new Blob([content], { type: "application/yaml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function readViewport(element: HTMLElement): CanvasViewport {
  return {
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop,
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight,
  };
}

function clampModel(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

const rootElement = document.getElementById("root");
if (rootElement) createRoot(rootElement).render(<App />);
