export interface CanvasRect {
  left: number;
  top: number;
}

export interface CanvasViewport {
  scrollLeft: number;
  scrollTop: number;
  clientWidth: number;
  clientHeight: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ViewportFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

const defaultCanvasSize: Size = { width: 1500, height: 950 };
const nodeFootprint: Size = { width: 280, height: 164 };
const canvasPadding = 160;

export function calculateNodeDragOffset(
  pointer: Point,
  canvasRect: CanvasRect,
  viewport: CanvasViewport,
  nodePosition: Point,
  zoom: number,
): Point {
  const canvasPoint = screenToCanvasPoint(pointer, canvasRect, viewport, zoom);
  return {
    x: canvasPoint.x - nodePosition.x,
    y: canvasPoint.y - nodePosition.y,
  };
}

export function calculateDraggedNodePosition(
  pointer: Point,
  canvasRect: CanvasRect,
  viewport: CanvasViewport,
  dragOffset: Point,
  zoom: number,
): Point {
  const canvasPoint = screenToCanvasPoint(pointer, canvasRect, viewport, zoom);
  return {
    x: Math.max(16, canvasPoint.x - dragOffset.x),
    y: Math.max(16, canvasPoint.y - dragOffset.y),
  };
}

export function screenToCanvasPoint(pointer: Point, canvasRect: CanvasRect, viewport: CanvasViewport, zoom: number): Point {
  return {
    x: (pointer.x - canvasRect.left + viewport.scrollLeft) / zoom,
    y: (pointer.y - canvasRect.top + viewport.scrollTop) / zoom,
  };
}

export function deriveCanvasBounds(positions: Record<string, Point>): Size {
  let width = defaultCanvasSize.width;
  let height = defaultCanvasSize.height;
  for (const position of Object.values(positions)) {
    width = Math.max(width, position.x + nodeFootprint.width + canvasPadding);
    height = Math.max(height, position.y + nodeFootprint.height + canvasPadding);
  }
  return { width, height };
}

export function clampZoom(zoom: number): number {
  return Math.min(1.8, Math.max(0.5, roundZoom(zoom)));
}

export function calculateViewportFrame(viewport: CanvasViewport, zoom: number, bounds: Size): ViewportFrame {
  const width = Math.min(bounds.width, viewport.clientWidth / zoom);
  const height = Math.min(bounds.height, viewport.clientHeight / zoom);
  const maxLeft = Math.max(0, bounds.width - width);
  const maxTop = Math.max(0, bounds.height - height);
  return {
    left: clamp(viewport.scrollLeft / zoom, 0, maxLeft),
    top: clamp(viewport.scrollTop / zoom, 0, maxTop),
    width,
    height,
  };
}

export function calculateScrollForViewportTopLeft(topLeft: Point, viewportSize: Size, bounds: Size, zoom: number): Point {
  const maxLeft = Math.max(0, bounds.width - viewportSize.width / zoom);
  const maxTop = Math.max(0, bounds.height - viewportSize.height / zoom);
  return {
    x: clamp(topLeft.x, 0, maxLeft) * zoom,
    y: clamp(topLeft.y, 0, maxTop) * zoom,
  };
}

export function calculateScrollForViewportCenter(center: Point, viewportSize: Size, bounds: Size, zoom: number): Point {
  return calculateScrollForViewportTopLeft({
    x: center.x - viewportSize.width / (2 * zoom),
    y: center.y - viewportSize.height / (2 * zoom),
  }, viewportSize, bounds, zoom);
}

function roundZoom(zoom: number): number {
  return Math.round(zoom * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
