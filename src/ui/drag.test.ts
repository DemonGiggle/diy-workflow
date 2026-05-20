import test from "node:test";
import assert from "node:assert/strict";
import { calculateDraggedNodePosition, calculateNodeDragOffset } from "./drag.js";

test("node drag keeps the initial node-relative cursor offset", () => {
  const canvasRect = { left: 100, top: 50 };
  const initialNodePosition = { x: 240, y: 180 };
  const pointerDown = { x: 372, y: 262 };
  const dragOffset = calculateNodeDragOffset(pointerDown, canvasRect, initialNodePosition);

  assert.deepEqual(dragOffset, { x: 32, y: 32 });
  assert.deepEqual(
    calculateDraggedNodePosition(pointerDown, canvasRect, dragOffset),
    initialNodePosition,
  );
});

test("node drag uses canvas coordinates instead of drag-handle-local offsets", () => {
  const canvasRect = { left: 100, top: 50 };
  const pointerMove = { x: 390, y: 280 };
  const nodeRelativeOffset = { x: 32, y: 32 };
  const handleLocalOffset = { x: 8, y: 8 };

  assert.deepEqual(
    calculateDraggedNodePosition(pointerMove, canvasRect, nodeRelativeOffset),
    { x: 258, y: 198 },
  );
  assert.notDeepEqual(
    calculateDraggedNodePosition(pointerMove, canvasRect, handleLocalOffset),
    { x: 258, y: 198 },
  );
});
