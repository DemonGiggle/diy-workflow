import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultRegistry } from "./actions/index.js";
import { faninAction, fanoutAction } from "./actions/control.js";
import { exactMatchAction } from "./actions/eval.js";
import { readFileAction, writeFileAction, writeStdoutAction } from "./actions/io.js";
import { readImageAction, writeImageAction } from "./actions/image.js";
import { promptAction, summarizeAction } from "./actions/llm.js";
import { ocrAction, visionAnalyzeAction } from "./actions/image.js";
import type { ActionContext, ActionLogEvent, StdoutEmission } from "./types.js";
import { createLlmRuntime } from "./llmRuntime.js";
import { Document, Packer, Paragraph } from "docx";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";

const registry = createDefaultRegistry();

function context(
  cwd = process.cwd(),
  onStdout?: (output: StdoutEmission) => void | Promise<void>,
  onLog?: (event: ActionLogEvent) => void | Promise<void>,
): ActionContext {
  const traceMetadata = {};
  return {
    runId: "run_test",
    stepId: "step_test",
    cwd,
    registry,
    llm: createLlmRuntime({ workflow: {}, setTraceMetadata: (patch) => Object.assign(traceMetadata, patch) }),
    setTraceMetadata: (patch) => Object.assign(traceMetadata, patch),
    emitLog: async (event) => {
      await onLog?.(event);
    },
    emitStdout: async (output) => {
      await onStdout?.(output);
    },
    runAction: async (type, input, config) => {
      const action = registry.get(type);
      if (!action) throw new Error(`Unknown nested action type: ${type}`);
      return action.run(input as never, context(cwd), config);
    },
  };
}

test("read_file reads workspace-relative files and supports mock output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diy-workflow-actions-"));
  try {
    await writeFile(join(dir, "input.txt"), "Hello file", "utf8");

    const output = await readFileAction.run({ path: "input.txt" }, context(dir));
    assert.equal(output.content, "Hello file");
    assert.equal(output.bytes, Buffer.byteLength("Hello file"));
    assert.match(output.path, /input\.txt$/);

    const mocked = await readFileAction.run(
      { path: "missing.txt" },
      context(dir),
      { mock: { enabled: true, path: "mock://file.txt", content: "Mocked", bytes: 6 } },
    );
    assert.deepEqual(mocked, { path: "mock://file.txt", content: "Mocked", bytes: 6 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("write_stdout emits text or JSON-compatible content and supports mock mode", async () => {
  const emitted: StdoutEmission[] = [];

  const direct = await writeStdoutAction.run(
    { content: { answer: "Hello" }, label: "result", newline: false },
    context(process.cwd(), async (output) => { emitted.push(output); }),
  );

  assert.deepEqual(emitted[0], { content: '{\n  "answer": "Hello"\n}', label: "result", newline: false });
  assert.deepEqual(direct, {
    content: '{\n  "answer": "Hello"\n}',
    label: "result",
    newline: false,
    bytes: Buffer.byteLength('result: {\n  "answer": "Hello"\n}', "utf8"),
  });

  const mocked = await writeStdoutAction.run(
    { content: "ignored", newline: false },
    context(process.cwd(), async (output) => { emitted.push(output); }),
    { mock: { enabled: true, content: ["mocked"], label: "preview", newline: true, bytes: 99 } },
  );

  assert.deepEqual(emitted[1], { content: '[\n  "mocked"\n]', label: "preview", newline: true });
  assert.deepEqual(mocked, {
    content: '[\n  "mocked"\n]',
    label: "preview",
    newline: true,
    bytes: 99,
  });
});

test("write_file writes text output and supports mock mode", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diy-workflow-write-file-"));
  try {
    const written = await writeFileAction.run(
      { path: "outputs/summary.txt", content: "Hello output file" },
      context(dir),
    );

    assert.match(written.path, /outputs\/summary\.txt$/);
    assert.equal(written.bytes, Buffer.byteLength("Hello output file"));
    assert.equal(await readFile(join(dir, "outputs", "summary.txt"), "utf8"), "Hello output file");

    const mocked = await writeFileAction.run(
      { path: "outputs/mock.txt", content: "Ignored" },
      context(dir),
      { mock: { enabled: true, path: "mock://summary.txt", bytes: 77 } },
    );
    assert.deepEqual(mocked, { path: "mock://summary.txt", bytes: 77 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("read_image reads image metadata and supports mock output", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diy-workflow-images-"));
  try {
    await writeFile(join(dir, "input.png"), pngFixture());

    const output = await readImageAction.run({ path: "input.png" }, context(dir));
    assert.equal(output.mimeType, "image/png");
    assert.equal(output.bytes, pngFixture().byteLength);
    assert.equal(output.width, 1);
    assert.equal(output.height, 1);
    assert.equal(output.image.mimeType, "image/png");
    assert.equal(output.image.width, 1);

    const mocked = await readImageAction.run(
      { path: "missing.png" },
      context(dir),
      {
        mock: {
          enabled: true,
          path: "mock/input.png",
          mimeType: "image/png",
          bytes: 42,
          width: 800,
          height: 600,
          image: { path: "mock/input.png", mimeType: "image/png", bytes: 42, width: 800, height: 600 },
        },
      },
    );
    assert.deepEqual(mocked, {
      path: "mock/input.png",
      mimeType: "image/png",
      bytes: 42,
      width: 800,
      height: 600,
      image: { path: "mock/input.png", mimeType: "image/png", bytes: 42, width: 800, height: 600 },
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("write_image writes generated image payloads, supports file-backed artifacts, and mocks cleanly", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diy-workflow-write-image-"));
  try {
    const generated = await writeImageAction.run(
      {
        path: "outputs/generated.png",
        image: {
          mimeType: "image/png",
          data: pngFixture().toString("base64"),
          width: 1,
          height: 1,
        },
      },
      context(dir),
    );

    assert.match(generated.path, /outputs\/generated\.png$/);
    assert.equal(generated.mimeType, "image/png");
    assert.equal(generated.bytes, pngFixture().byteLength);
    assert.deepEqual(await readFile(join(dir, "outputs", "generated.png")), pngFixture());

    await writeFile(join(dir, "source.png"), pngFixture());
    const source = await readImageAction.run({ path: "source.png" }, context(dir));
    const copied = await writeImageAction.run(
      { path: "outputs/copied.png", image: source.image },
      context(dir),
    );
    assert.equal(copied.bytes, pngFixture().byteLength);
    assert.deepEqual(await readFile(join(dir, "outputs", "copied.png")), pngFixture());

    const mocked = await writeImageAction.run(
      {
        path: "outputs/mock.png",
        image: {
          mimeType: "image/png",
          data: pngFixture().toString("base64"),
        },
      },
      context(dir),
      {
        mock: {
          enabled: true,
          path: "mock://image.png",
          mimeType: "image/png",
          bytes: 42,
          width: 10,
          height: 20,
        },
      },
    );
    assert.deepEqual(mocked, {
      path: "mock://image.png",
      mimeType: "image/png",
      bytes: 42,
      width: 10,
      height: 20,
      image: { path: "mock://image.png", mimeType: "image/png", bytes: 42, width: 10, height: 20 },
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("read_file extracts text from docx, pdf, and excel files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diy-workflow-docs-"));
  try {
    await writeFile(
      join(dir, "input.docx"),
      await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph("Hello docx"), new Paragraph("Second line")] }] })),
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Name", "Value"],
        ["Alpha", "One"],
        ["Beta", "Two"],
      ]),
      "Sheet1",
    );
    await writeFile(join(dir, "input.xlsx"), XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

    await writeFile(join(dir, "input.pdf"), await createPdfBuffer(["Hello pdf", "Second page line"]));

    const docxOutput = await readFileAction.run({ path: "input.docx" }, context(dir));
    assert.match(docxOutput.content, /Hello docx/);
    assert.match(docxOutput.content, /Second line/);

    const excelOutput = await readFileAction.run({ path: "input.xlsx" }, context(dir));
    assert.match(excelOutput.content, /# Sheet1/);
    assert.match(excelOutput.content, /Alpha,One/);
    assert.match(excelOutput.content, /Beta,Two/);

    const pdfOutput = await readFileAction.run({ path: "input.pdf" }, context(dir));
    assert.match(pdfOutput.content, /Hello pdf/);
    assert.match(pdfOutput.content, /Second page line/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("llm prompt renders variables and accepts mock response", async () => {
  const rendered = await promptAction.run(
    { prompt: "Hello {{user.name}}", variables: { user: { name: "Gigo" } } },
    context(),
  );
  assert.deepEqual(rendered, { text: "Hello Gigo" });

  const mocked = await promptAction.run(
    { prompt: "Ignored" },
    context(),
    { mock: { enabled: true, response: "Mock response" } },
  );
  assert.deepEqual(mocked, { text: "Mock response" });
});

test("llm vision analyze and ocr produce deterministic previews and mock responses", async () => {
  const image = { path: "/tmp/input.png", mimeType: "image/png", bytes: 12, width: 1, height: 1 };

  const analyzed = await visionAnalyzeAction.run({ image, prompt: "Describe the image" }, context());
  assert.match(analyzed.text, /input\.png/);
  assert.match(analyzed.text, /Describe the image/);

  const ocr = await ocrAction.run({ image }, context());
  assert.match(ocr.text, /OCR preview/);

  const mockedAnalyze = await visionAnalyzeAction.run(
    { image },
    context(),
    { mock: { enabled: true, response: "Mock vision output" } },
  );
  assert.deepEqual(mockedAnalyze, { text: "Mock vision output" });

  const mockedOcr = await ocrAction.run(
    { image },
    context(),
    { mock: { enabled: true, response: "Mock OCR output" } },
  );
  assert.deepEqual(mockedOcr, { text: "Mock OCR output" });
});

test("llm summarize applies sentence and character limits and mock summary", async () => {
  const summarized = await summarizeAction.run(
    { text: "One sentence. Two sentence. Three sentence." },
    context(),
    { maxSentences: 2, maxChars: 18 },
  );
  assert.equal(summarized.summary, "One sentence. Two…");
  assert.equal(summarized.sentenceCount, 3);

  const mocked = await summarizeAction.run(
    { text: "Ignored" },
    context(),
    { mock: { enabled: true, summary: "Mock summary.", sentenceCount: 1 } },
  );
  assert.deepEqual(mocked, { summary: "Mock summary.", sentenceCount: 1 });
});

test("control fanout injects values and fanin merges successful outputs", async () => {
  const fanout = await fanoutAction.run(
    {
      value: "Shared",
      branches: [
        { id: "a", type: "llm.prompt", input: { prompt: "{{input}} A" } },
        { id: "b", type: "llm.prompt", input: { prompt: "$input" } },
      ],
    },
    context(),
  );

  assert.equal(fanout.results.length, 2);
  assert.deepEqual(fanout.results.map((result) => result.status), ["success", "success"]);
  assert.deepEqual(fanout.results.map((result) => (result.output as { text: string }).text), ["Shared A", "Shared"]);

  const merged = await faninAction.run(
    { items: [{ status: "success", output: { a: 1 } }, { status: "success", output: { b: 2 } }] },
    context(),
    { strategy: "merge" },
  );
  assert.deepEqual(merged, { strategy: "merge", output: { a: 1, b: 2 }, count: 2 });
});

test("control fanin first_success and mock config are deterministic", async () => {
  const first = await faninAction.run(
    { items: [{ status: "failed", output: null }, { status: "success", output: { ok: true } }] },
    context(),
    { strategy: "first_success" },
  );
  assert.deepEqual(first, { strategy: "first_success", output: { status: "success", output: { ok: true } }, count: 1 });

  const mocked = await faninAction.run(
    { items: [] },
    context(),
    { mock: { enabled: true, strategy: "first_success", output: "mock", count: 9 } },
  );
  assert.deepEqual(mocked, { strategy: "first_success", output: "mock", count: 9 });
});

test("exact_match compares nested values and can force mock output", async () => {
  const matched = await exactMatchAction.run({ actual: { value: [1, 2] }, expected: { value: [1, 2] } }, context());
  assert.equal(matched.matched, true);

  const mocked = await exactMatchAction.run(
    { actual: "a", expected: "b" },
    context(),
    { mock: { enabled: true, matched: true, actual: "same", expected: "same" } },
  );
  assert.deepEqual(mocked, { matched: true, actual: "same", expected: "same" });
});

async function createPdfBuffer(lines: string[]): Promise<Buffer> {
  return await new Promise<Buffer>((resolvePromise, rejectPromise) => {
    const doc = new PDFDocument({ margin: 36, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(Buffer.from(chunk)));
    doc.on("error", rejectPromise);
    doc.on("end", () => resolvePromise(Buffer.concat(chunks)));

    doc.fontSize(12);
    for (const line of lines) {
      doc.text(line);
    }
    doc.end();
  });
}

function pngFixture(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2sZl8AAAAASUVORK5CYII=",
    "base64",
  );
}
