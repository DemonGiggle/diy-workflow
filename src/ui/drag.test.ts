import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDraggedNodePosition,
  calculateNodeDragOffset,
  calculateScrollForViewportCenter,
  calculateScrollForViewportTopLeft,
  calculateViewportFrame,
  deriveCanvasBounds,
} from "./drag.js";

test("node drag keeps the initial node-relative cursor offset", () => {
  const canvasRect = { left: 100, top: 50 };
  const viewport = { scrollLeft: 0, scrollTop: 0, clientWidth: 800, clientHeight: 600 };
  const initialNodePosition = { x: 240, y: 180 };
  const pointerDown = { x: 372, y: 262 };
  const dragOffset = calculateNodeDragOffset(pointerDown, canvasRect, viewport, initialNodePosition, 1);

  assert.deepEqual(dragOffset, { x: 32, y: 32 });
  assert.deepEqual(
    calculateDraggedNodePosition(pointerDown, canvasRect, viewport, dragOffset, 1),
    initialNodePosition,
  );
});

test("node drag uses canvas coordinates instead of drag-handle-local offsets", () => {
  const canvasRect = { left: 100, top: 50 };
  const viewport = { scrollLeft: 0, scrollTop: 0, clientWidth: 800, clientHeight: 600 };
  const pointerMove = { x: 390, y: 280 };
  const nodeRelativeOffset = { x: 32, y: 32 };
  const handleLocalOffset = { x: 8, y: 8 };

  assert.deepEqual(
    calculateDraggedNodePosition(pointerMove, canvasRect, viewport, nodeRelativeOffset, 1),
    { x: 258, y: 198 },
  );
  assert.notDeepEqual(
    calculateDraggedNodePosition(pointerMove, canvasRect, viewport, handleLocalOffset, 1),
    { x: 258, y: 198 },
  );
});

test("node drag stays aligned under zoom and scroll", () => {
  const canvasRect = { left: 40, top: 20 };
  const viewport = { scrollLeft: 300, scrollTop: 180, clientWidth: 960, clientHeight: 720 };
  const zoom = 1.5;
  const node = { x: 420, y: 280 };
  const pointerDown = {
    x: canvasRect.left + node.x * zoom - viewport.scrollLeft + 48,
    y: canvasRect.top + node.y * zoom - viewport.scrollTop + 60,
  };

  const dragOffset = calculateNodeDragOffset(pointerDown, canvasRect, viewport, node, zoom);
  assert.deepEqual(dragOffset, { x: 32, y: 40 });
  assert.deepEqual(
    calculateDraggedNodePosition(pointerDown, canvasRect, viewport, dragOffset, zoom),
    node,
  );
});

test("viewport frame converts zoomed scroll state back into model space", () => {
  const viewport = { scrollLeft: 450, scrollTop: 240, clientWidth: 900, clientHeight: 600 };
  assert.deepEqual(
    calculateViewportFrame(viewport, 1.5, { width: 1800, height: 1200 }),
    { left: 300, top: 160, width: 600, height: 400 },
  );
});

test("scroll helpers clamp viewport movement to canvas bounds", () => {
  const viewportSize = { width: 900, height: 600 };
  const bounds = { width: 1600, height: 1100 };
  const zoom = 1.25;

  assert.deepEqual(
    calculateScrollForViewportCenter({ x: 80, y: 90 }, viewportSize, bounds, zoom),
    { x: 0, y: 0 },
  );
  assert.deepEqual(
    calculateScrollForViewportTopLeft({ x: 1400, y: 980 }, viewportSize, bounds, zoom),
    { x: 1100, y: 775 },
  );
});

test("canvas bounds expand with node positions while preserving the baseline size", () => {
  assert.deepEqual(deriveCanvasBounds({}), { width: 1500, height: 950 });
  assert.deepEqual(
    deriveCanvasBounds({ a: { x: 1600, y: 920 } }),
    { width: 2040, height: 1244 },
  );
});
