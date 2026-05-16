import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createDefaultRegistry } from "./actions/index.js";
import { WorkflowExecutor } from "./executor.js";
import { TraceStore } from "./trace.js";
import { WorkflowValidator } from "./validator.js";
import type { WorkflowDocument } from "./types.js";

export interface WorkflowServerOptions {
  cwd?: string;
  webRoot?: string;
  traceRoot?: string;
}

interface JsonResponse {
  status?: number;
  body: unknown;
}

export function createWorkflowServer(options: WorkflowServerOptions = {}): Server {
  const cwd = resolve(options.cwd ?? process.cwd());
  const webRoot = resolve(options.webRoot ?? join(packageRoot(), "web-dist"));
  const traceStore = new TraceStore(resolve(options.traceRoot ?? join(cwd, "runs")));
  const registry = createDefaultRegistry();

  return createServer(async (request, response) => {
    try {
      if (!request.url) return sendJson(response, { status: 400, body: { error: "Missing request URL" } });

      const url = new URL(request.url, "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        return await routeApi(request, response, url, { cwd, registry, traceStore });
      }

      return await serveStatic(response, webRoot, url.pathname);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      return sendJson(response, {
        status,
        body: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  });
}

function packageRoot(): string {
  return resolve(fileURLToPath(import.meta.url), "..", "..");
}

async function routeApi(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  runtime: {
    cwd: string;
    registry: ReturnType<typeof createDefaultRegistry>;
    traceStore: TraceStore;
  },
): Promise<void> {
  if (request.method === "GET" && url.pathname === "/api/health") {
    return sendJson(response, { body: { ok: true } });
  }

  if (request.method === "POST" && url.pathname === "/api/workflows/validate") {
    const { workflow } = await readWorkflowRequest(request);
    const validation = new WorkflowValidator(runtime.registry).validate(workflow);
    return sendJson(response, { status: validation.ok ? 200 : 422, body: validation });
  }

  if (request.method === "POST" && url.pathname === "/api/workflows/run") {
    const { workflow } = await readWorkflowRequest(request);
    const trace = await new WorkflowExecutor().execute({
      workflowPath: join(runtime.cwd, "ui-workflow.yaml"),
      workflow,
      registry: runtime.registry,
      traceStore: runtime.traceStore,
    });
    return sendJson(response, { body: trace });
  }

  if (request.method === "GET" && url.pathname === "/api/runs") {
    const runs = await runtime.traceStore.list();
    return sendJson(response, { body: { runs } });
  }

  const runMatch = url.pathname.match(/^\/api\/runs\/(run_\d{4})$/);
  if (request.method === "GET" && runMatch) {
    const trace = await runtime.traceStore.read(runMatch[1]!);
    return sendJson(response, { body: trace });
  }

  return sendJson(response, { status: 404, body: { error: "Not found" } });
}

async function readWorkflowRequest(request: IncomingMessage): Promise<{ workflow: WorkflowDocument }> {
  const raw = await readRequestBody(request);
  const parsed = JSON.parse(raw || "{}") as { workflow?: WorkflowDocument };
  if (!parsed.workflow || typeof parsed.workflow !== "object") {
    throw new HttpError(400, "Request body must include a workflow object");
  }
  return { workflow: parsed.workflow };
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function serveStatic(response: ServerResponse, webRoot: string, pathname: string): Promise<void> {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(webRoot, normalize(decodeURIComponent(requested)).replace(/^([/\\])+/, ""));
  if (!filePath.startsWith(`${webRoot}${sep}`) && filePath !== webRoot) {
    return sendJson(response, { status: 403, body: { error: "Forbidden" } });
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, { "content-type": contentType(filePath) });
    response.end(content);
  } catch {
    const index = await readFile(join(webRoot, "index.html"));
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(index);
  }
}

function sendJson(response: ServerResponse, result: JsonResponse): void {
  response.writeHead(result.status ?? 200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(result.body));
}

function contentType(path: string): string {
  switch (extname(path)) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".json": return "application/json; charset=utf-8";
    default: return "application/octet-stream";
  }
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
