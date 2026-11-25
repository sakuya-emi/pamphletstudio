import { object, type Anchor, type DesignObject } from "./model";
import { fromPoints } from "./geometry";
export type PenPoint = {
  x: number;
  y: number;
  in?: { x: number; y: number };
  out?: { x: number; y: number };
};
export function penGeometry(points: PenPoint[]) {
  const all = points.flatMap((p) => [
    p,
    ...(p.in ? [p.in] : []),
    ...(p.out ? [p.out] : []),
  ]);
  const box = fromPoints(all);
  const local = (p: { x: number; y: number }) => ({
    x: (p.x - box.x) / box.w,
    y: (p.y - box.y) / box.h,
  });
  return {
    ...box,
    anchors: points.map((p) => ({
      ...local(p),
      in: p.in ? local(p.in) : undefined,
      out: p.out ? local(p.out) : undefined,
    })),
  };
}
export function polygonObject(
  layerId: string,
  sides = 6,
  star = false,
): DesignObject {
  const o = object("path", layerId, 25, 35, 40, 40);
  o.name = star ? "星形" : "多角形";
  o.closed = true;
  o.anchors = Array.from({ length: star ? sides * 2 : sides }, (_, i) => {
    const a = (i * Math.PI * 2) / (star ? sides * 2 : sides) - Math.PI / 2,
      radius = star && i % 2 ? 0.22 : 0.5;
    return { x: 0.5 + Math.cos(a) * radius, y: 0.5 + Math.sin(a) * radius };
  });
  return o;
}
export function reverseAnchors(points: Anchor[]) {
  return [...points].reverse().map((p) => ({
    ...p,
    in: p.out ? { ...p.out } : undefined,
    out: p.in ? { ...p.in } : undefined,
  }));
}
export function splitPath(
  o: DesignObject,
  index: number,
): [DesignObject, DesignObject] {
  if (
    o.kind !== "path" ||
    o.closed ||
    !o.anchors ||
    index <= 0 ||
    index >= o.anchors.length - 1
  )
    throw new Error("開いたパスの端点以外を選んでください。");
  const a = structuredClone(o),
    b = structuredClone(o);
  a.anchors = a.anchors!.slice(0, index + 1);
  a.anchors.at(-1)!.out = undefined;
  b.anchors = b.anchors!.slice(index);
  b.anchors[0].in = undefined;
  b.id = crypto.randomUUID();
  b.name += "（分割）";
  return [a, b];
}
