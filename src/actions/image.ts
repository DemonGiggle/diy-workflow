import { readFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import type { ActionDefinition, JsonObject } from "../types.js";
import { anyMockValueSchema, readMockConfig } from "./mock.js";

export interface ImageArtifact {
  path: string;
  mimeType: string;
  bytes: number;
  width?: number;
  height?: number;
}

interface ReadImageInput {
  path: string;
}

interface ReadImageOutput extends ImageArtifact {
  image: ImageArtifact;
}

interface VisionAnalyzeInput {
  image: ImageArtifact;
  prompt?: string;
}

interface VisionAnalyzeOutput {
  text: string;
}

interface OcrInput {
  image: ImageArtifact;
}

interface OcrOutput {
  text: string;
}

const JPEG_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
const llmSelectionConfigSchema = {
  providerId: { type: "string", minLength: 1, nullable: true },
  modelId: { type: "string", minLength: 1, nullable: true },
};

export const imageArtifactSchema = {
  type: "object",
  additionalProperties: false,
  required: ["path", "mimeType", "bytes"],
  properties: {
    path: { type: "string" },
    mimeType: { type: "string" },
    bytes: { type: "number" },
    width: { type: "number", nullable: true },
    height: { type: "number", nullable: true },
  },
};

export const readImageAction: ActionDefinition<ReadImageInput, ReadImageOutput> = {
  type: "io.read_image",
  description: "Read a local image and emit a structured image artifact.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["path"],
    properties: {
      path: { type: "string", minLength: 1 },
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
          mimeType: { type: "string", nullable: true },
          bytes: { type: "number", minimum: 0, nullable: true },
          width: { type: "number", minimum: 0, nullable: true },
          height: { type: "number", minimum: 0, nullable: true },
          image: anyMockValueSchema,
        },
      },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["path", "mimeType", "bytes", "image"],
    properties: {
      path: { type: "string" },
      mimeType: { type: "string" },
      bytes: { type: "number" },
      width: { type: "number", nullable: true },
      height: { type: "number", nullable: true },
      image: imageArtifactSchema,
    },
  },
  async run(input, context, config) {
    const mock = readMockConfig(config);
    if (mock) {
      const fallback = buildImageArtifact(
        typeof mock.path === "string" ? mock.path : input.path,
        typeof mock.mimeType === "string" ? mock.mimeType : mimeTypeFromPath(typeof mock.path === "string" ? mock.path : input.path),
        typeof mock.bytes === "number" ? mock.bytes : 0,
        typeof mock.width === "number" ? mock.width : undefined,
        typeof mock.height === "number" ? mock.height : undefined,
      );
      const artifact = normalizeImageArtifact(mock.image, fallback);
      return { ...artifact, image: artifact };
    }

    const absolutePath = resolve(context.cwd, input.path);
    const buffer = await readFile(absolutePath);
    const mimeType = detectImageMimeType(buffer, absolutePath);
    const { width, height } = parseImageDimensions(buffer, mimeType);
    const artifact = buildImageArtifact(absolutePath, mimeType, buffer.length, width, height);
    return { ...artifact, image: artifact };
  },
};

export const visionAnalyzeAction: ActionDefinition<VisionAnalyzeInput, VisionAnalyzeOutput> = {
  type: "llm.vision_analyze",
  description: "Analyze an image and describe what it contains.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["image"],
    properties: {
      image: imageArtifactSchema,
      prompt: { type: "string", nullable: true },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["text"],
    properties: {
      text: { type: "string" },
    },
  },
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      ...llmSelectionConfigSchema,
      mock: {
        type: "object",
        nullable: true,
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean", nullable: true },
          response: { type: "string", nullable: true },
        },
      },
    },
  },
  async run(input, context, config) {
    return await context.llm.run<VisionAnalyzeOutput>("llm.vision_analyze", input, config);
  },
};

export const ocrAction: ActionDefinition<OcrInput, OcrOutput> = {
  type: "llm.ocr",
  description: "Extract text from an image.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["image"],
    properties: {
      image: imageArtifactSchema,
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["text"],
    properties: {
      text: { type: "string" },
    },
  },
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      ...llmSelectionConfigSchema,
      mock: {
        type: "object",
        nullable: true,
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean", nullable: true },
          response: { type: "string", nullable: true },
        },
      },
    },
  },
  async run(input, context, config) {
    return await context.llm.run<OcrOutput>("llm.ocr", input, config);
  },
};

function mimeTypeFromPath(path: string): string {
  const extension = extname(path).toLowerCase();
  switch (extension) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function detectImageMimeType(buffer: Buffer, path: string): string {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 6) {
    const signature = buffer.subarray(0, 6).toString("ascii");
    if (signature === "GIF87a" || signature === "GIF89a") return "image/gif";
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }

  const mimeType = mimeTypeFromPath(path);
  if (mimeType !== "application/octet-stream") return mimeType;
  throw new Error("Unsupported image format: " + basename(path));
}

function parseImageDimensions(buffer: Buffer, mimeType: string): { width?: number; height?: number } {
  if (mimeType === "image/png" && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (mimeType === "image/gif" && buffer.length >= 10) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (mimeType === "image/jpeg") {
    return parseJpegDimensions(buffer);
  }
  return {};
}

function parseJpegDimensions(buffer: Buffer): { width?: number; height?: number } {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    let marker = buffer[offset + 1];
    while (marker === 0xff && offset + 1 < buffer.length) {
      offset++;
      marker = buffer[offset + 1];
    }

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    if (offset + 3 >= buffer.length) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) {
      break;
    }

    if (JPEG_SOF_MARKERS.has(marker) && offset + 8 < buffer.length) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + segmentLength;
  }
  return {};
}

function buildImageArtifact(path: string, mimeType: string, bytes: number, width?: number, height?: number): ImageArtifact {
  return {
    path,
    mimeType,
    bytes,
    ...(typeof width === "number" ? { width } : {}),
    ...(typeof height === "number" ? { height } : {}),
  };
}

function normalizeImageArtifact(value: unknown, fallback: ImageArtifact): ImageArtifact {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const candidate = value as JsonObject;
  return buildImageArtifact(
    typeof candidate.path === "string" ? candidate.path : fallback.path,
    typeof candidate.mimeType === "string" ? candidate.mimeType : fallback.mimeType,
    typeof candidate.bytes === "number" ? candidate.bytes : fallback.bytes,
    typeof candidate.width === "number" ? candidate.width : fallback.width,
    typeof candidate.height === "number" ? candidate.height : fallback.height,
  );
}
