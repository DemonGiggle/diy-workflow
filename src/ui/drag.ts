export interface CanvasRect {
  left: number;
  top: number;
}

export interface Point {
  x: number;
  y: number;
}

export function calculateNodeDragOffset(pointer: Point, canvasRect: CanvasRect, nodePosition: Point): Point {
  return {
    x: pointer.x - canvasRect.left - nodePosition.x,
    y: pointer.y - canvasRect.top - nodePosition.y,
  };
}

export function calculateDraggedNodePosition(pointer: Point, canvasRect: CanvasRect, dragOffset: Point): Point {
  return {
    x: Math.max(16, pointer.x - canvasRect.left - dragOffset.x),
    y: Math.max(16, pointer.y - canvasRect.top - dragOffset.y),
  };
}
