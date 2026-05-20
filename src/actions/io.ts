import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";
import { measureStdoutEmission, stringifyStdoutContent } from "../stdout.js";
import type { ActionDefinition, StdoutTraceOutput } from "../types.js";
import { readMockConfig } from "./mock.js";

interface ReadFileInput {
  path: string;
  encoding?: BufferEncoding;
}

interface ReadFileOutput {
  path: string;
  content: string;
  bytes: number;
}

interface WriteFileInput {
  path: string;
  content: string;
  encoding?: BufferEncoding;
}

interface WriteFileOutput {
  path: string;
  bytes: number;
}

interface WriteStdoutInput {
  content: unknown;
  newline?: boolean;
  label?: string;
}

type WriteStdoutOutput = StdoutTraceOutput;

const binaryTextExtensions = new Set([".docx", ".pdf", ".xlsx", ".xls", ".xlsm", ".xlsb"]);

async function extractTextFromFile(absolutePath: string, encoding: BufferEncoding): Promise<string> {
  const extension = extname(absolutePath).toLowerCase();
  if (!binaryTextExtensions.has(extension)) {
    return readFile(absolutePath, encoding);
  }

  const buffer = await readFile(absolutePath);
  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  if (extension === ".pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetTexts = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return `# ${sheetName}`;
    }
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    return csv.trim().length > 0 ? `# ${sheetName}\n${csv.trimEnd()}` : `# ${sheetName}`;
  });
  return sheetTexts.join("\n\n");
}

export const readFileAction: ActionDefinition<ReadFileInput, ReadFileOutput> = {
  type: "io.read_file",
  description: "Read a local file and extract text from text, PDF, Word, or Excel files.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["path"],
    properties: {
      path: { type: "string", minLength: 1 },
      encoding: { type: "string", nullable: true },
    },
  },
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      mock: {
        type: "object",
        nullable: true,
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean", nullable: true },
          path: { type: "string", nullable: true },
          content: { type: "string", nullable: true },
          bytes: { type: "number", minimum: 0, nullable: true },
        },
      },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["path", "content", "bytes"],
    properties: {
      path: { type: "string" },
      content: { type: "string" },
      bytes: { type: "number" },
    },
  },
  async run(input, context, config) {
    const mock = readMockConfig(config);
    if (mock) {
      const content = typeof mock.content === "string" ? mock.content : "";
      return {
        path: typeof mock.path === "string" ? mock.path : input.path,
        content,
        bytes: typeof mock.bytes === "number" ? mock.bytes : Buffer.byteLength(content, input.encoding ?? "utf8"),
      };
    }

    const encoding = input.encoding ?? "utf8";
    const absolute = resolve(context.cwd, input.path);
    const [content, info] = await Promise.all([extractTextFromFile(absolute, encoding), stat(absolute)]);
    return { path: absolute, content, bytes: info.size };
  },
};

export const writeFileAction: ActionDefinition<WriteFileInput, WriteFileOutput> = {
  type: "io.write_file",
  description: "Write text content to a local file.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["path", "content"],
    properties: {
      path: { type: "string", minLength: 1 },
      content: { type: "string" },
      encoding: { type: "string", nullable: true },
    },
  },
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      mock: {
        type: "object",
        nullable: true,
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean", nullable: true },
          path: { type: "string", nullable: true },
          bytes: { type: "number", minimum: 0, nullable: true },
        },
      },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["path", "bytes"],
    properties: {
      path: { type: "string" },
      bytes: { type: "number" },
    },
  },
  async run(input, context, config) {
    const encoding = input.encoding ?? "utf8";
    const mock = readMockConfig(config);
    if (mock) {
      return {
        path: typeof mock.path === "string" ? mock.path : input.path,
        bytes: typeof mock.bytes === "number" ? mock.bytes : Buffer.byteLength(input.content, encoding),
      };
    }

    const absolutePath = resolve(context.cwd, input.path);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.content, encoding);
    return {
      path: absolutePath,
      bytes: Buffer.byteLength(input.content, encoding),
    };
  },
};

export const writeStdoutAction: ActionDefinition<WriteStdoutInput, WriteStdoutOutput> = {
  type: "io.write_stdout",
  description: "Emit text or JSON-compatible content to stdout-style run output.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["content"],
    properties: {
      content: {},
      newline: { type: "boolean", nullable: true },
      label: { type: "string", minLength: 1, nullable: true },
    },
  },
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      mock: {
        type: "object",
        nullable: true,
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean", nullable: true },
          content: {},
          newline: { type: "boolean", nullable: true },
          label: { type: "string", minLength: 1, nullable: true },
          bytes: { type: "number", minimum: 0, nullable: true },
        },
      },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["content", "bytes", "newline"],
    properties: {
      content: { type: "string" },
      bytes: { type: "number" },
      newline: { type: "boolean" },
      label: { type: "string", nullable: true },
    },
  },
  async run(input, context, config) {
    const mock = readMockConfig(config);
    const output = createStdoutOutput(input, mock);
    await context.emitStdout({ content: output.content, label: output.label, newline: output.newline });
    return output;
  },
};

function createStdoutOutput(input: WriteStdoutInput, mock?: Record<string, unknown> | null): WriteStdoutOutput {
  const output = {
    content: stringifyStdoutContent(
      mock && Object.prototype.hasOwnProperty.call(mock, "content") ? mock.content : input.content,
    ),
    newline: typeof mock?.newline === "boolean" ? mock.newline : input.newline ?? true,
    ...(typeof mock?.label === "string" ? { label: mock.label } : typeof input.label === "string" ? { label: input.label } : {}),
  };

  return {
    ...output,
    bytes: typeof mock?.bytes === "number" ? mock.bytes : measureStdoutEmission(output),
  };
}
