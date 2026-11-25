export interface CornerRadius {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}
export const corners = (r: number | CornerRadius = 0): CornerRadius =>
  typeof r === "number"
    ? { topLeft: r, topRight: r, bottomRight: r, bottomLeft: r }
    : { ...r };
export function normalizeCorners(
  r: number | CornerRadius,
  w: number,
  h: number,
): CornerRadius {
  const c = corners(r);
  const scale = Math.min(
    1,
    w / Math.max(0.0001, c.topLeft + c.topRight),
    w / Math.max(0.0001, c.bottomLeft + c.bottomRight),
    h / Math.max(0.0001, c.topLeft + c.bottomLeft),
    h / Math.max(0.0001, c.topRight + c.bottomRight),
  );
  return Object.fromEntries(
    Object.entries(c).map(([k, v]) => [k, Math.max(0, v) * scale]),
  ) as unknown as CornerRadius;
}
export function mirrorCorners(r: CornerRadius): CornerRadius {
  return {
    topLeft: r.topRight,
    topRight: r.topLeft,
    bottomRight: r.bottomLeft,
    bottomLeft: r.bottomRight,
  };
}
export function roundedPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | CornerRadius,
) {
  const {
    topLeft: a,
    topRight: b,
    bottomRight: c,
    bottomLeft: d,
  } = normalizeCorners(r, w, h);
  return `M ${x + a} ${y} L ${x + w - b} ${y} Q ${x + w} ${y} ${x + w} ${y + b} L ${x + w} ${y + h - c} Q ${x + w} ${y + h} ${x + w - c} ${y + h} L ${x + d} ${y + h} Q ${x} ${y + h} ${x} ${y + h - d} L ${x} ${y + a} Q ${x} ${y} ${x + a} ${y} Z`;
}
export function validCorners(r: unknown): r is CornerRadius {
  return (
    !!r &&
    typeof r === "object" &&
    ["topLeft", "topRight", "bottomRight", "bottomLeft"].every(
      (k) =>
        Number.isFinite((r as any)[k]) &&
        (r as any)[k] >= 0 &&
        (r as any)[k] <= 500,
    )
  );
}
