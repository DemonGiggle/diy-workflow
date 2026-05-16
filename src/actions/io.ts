import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { ActionDefinition } from "../types.js";
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

export const readFileAction: ActionDefinition<ReadFileInput, ReadFileOutput> = {
  type: "io.read_file",
  description: "Read a UTF-8 text file from the local workspace.",
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
    const [content, info] = await Promise.all([readFile(absolute, encoding), stat(absolute)]);
    return { path: absolute, content, bytes: info.size };
  },
};
