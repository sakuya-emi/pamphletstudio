import type { DesignObject, Anchor } from "./model";
export function pathData(o: DesignObject): string {
  const a = o.anchors || [];
  if (!a.length) return "";
  const pos = (p: { x: number; y: number }) =>
    `${o.x + p.x * o.w} ${o.y + p.y * o.h}`;
  let d = `M ${pos(a[0])}`;
  for (let i = 1; i < a.length + (o.closed ? 1 : 0); i++) {
    const prev = a[(i - 1) % a.length],
      next = a[i % a.length];
    d +=
      prev.out || next.in
        ? ` C ${pos(prev.out || prev)} ${pos(next.in || next)} ${pos(next)}`
        : ` L ${pos(next)}`;
  }
  return d + (o.closed ? " Z" : "");
}
export function ellipsePath(x: number, y: number, w: number, h: number) {
  const k = 0.5522847498,
    cx = x + w / 2,
    cy = y + h / 2,
    rx = w / 2,
    ry = h / 2;
  return `M ${x + w} ${cy} C ${x + w} ${cy + k * ry} ${cx + k * rx} ${y + h} ${cx} ${y + h} C ${cx - k * rx} ${y + h} ${x} ${cy + k * ry} ${x} ${cy} C ${x} ${cy - k * ry} ${cx - k * rx} ${y} ${cx} ${y} C ${cx + k * rx} ${y} ${x + w} ${cy - k * ry} ${x + w} ${cy} Z`;
}
export function constrain(o: DesignObject): DesignObject {
  const q = { ...o };
  q.w = Math.max(0.5, Math.min(2000, q.w));
  q.h = Math.max(0.5, Math.min(2000, q.h));
  q.x = Math.max(-2000, Math.min(2000, q.x));
  q.y = Math.max(-2000, Math.min(2000, q.y));
  return q;
}
export function bounds(objects: DesignObject[]) {
  const x = Math.min(...objects.map((o) => o.x)),
    y = Math.min(...objects.map((o) => o.y));
  return {
    x,
    y,
    w: Math.max(...objects.map((o) => o.x + o.w)) - x,
    h: Math.max(...objects.map((o) => o.y + o.h)) - y,
  };
}
export function rotateObjects(
  objects: DesignObject[],
  degrees: number,
): DesignObject[] {
  const b = bounds(objects),
    cx = b.x + b.w / 2,
    cy = b.y + b.h / 2,
    a = (degrees * Math.PI) / 180;
  return objects.map((o) => {
    const x = o.x + o.w / 2 - cx,
      y = o.y + o.h / 2 - cy;
    return constrain({
      ...o,
      x: cx + x * Math.cos(a) - y * Math.sin(a) - o.w / 2,
      y: cy + x * Math.sin(a) + y * Math.cos(a) - o.h / 2,
      rotation: (o.rotation + degrees) % 360,
    });
  });
}
export function fromPoints(points: { x: number; y: number }[]): {
  x: number;
  y: number;
  w: number;
  h: number;
  anchors: Anchor[];
} {
  const x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y)),
    w = Math.max(0.5, Math.max(...points.map((p) => p.x)) - x),
    h = Math.max(0.5, Math.max(...points.map((p) => p.y)) - y);
  return {
    x,
    y,
    w,
    h,
    anchors: points.map((p) => ({ x: (p.x - x) / w, y: (p.y - y) / h })),
  };
}
