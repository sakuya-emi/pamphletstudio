import type { Node } from "../layout-engine/types";
type Edge = { node: Node; priority: number };
/** Split collinear edges at every endpoint, choosing one border for each interval.
 * This also handles the long side of a merged cell beside several shorter cells. */
export function collapseBorders(edges: Edge[]): Node[] {
  const groups = new Map<string, Edge[]>();
  for (const edge of edges) {
    const n = edge.node,
      vertical = n.w === 0,
      key = `${vertical ? "v" : "h"}:${(vertical ? n.x : n.y).toFixed(4)}`;
    groups.set(key, [...(groups.get(key) || []), edge]);
  }
  const result: Node[] = [];
  for (const list of groups.values()) {
    const vertical = list[0].node.w === 0;
    const start = (e: Edge) => (vertical ? e.node.y : e.node.x),
      end = (e: Edge) => start(e) + (vertical ? e.node.h : e.node.w);
    const points = [
      ...new Set(
        list
          .flatMap((e) => [start(e), end(e)])
          .map((v) => Number(v.toFixed(4))),
      ),
    ].sort((a, b) => a - b);
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i],
        b = points[i + 1],
        mid = (a + b) / 2;
      const winner = list
        .filter((e) => start(e) <= mid && end(e) >= mid)
        .sort(
          (x, y) =>
            y.priority - x.priority || edges.indexOf(y) - edges.indexOf(x),
        )[0];
      if (!winner) continue;
      const n = winner.node,
        x = vertical ? n.x : a,
        y = vertical ? a : n.y,
        w = vertical ? 0 : b - a,
        h = vertical ? b - a : 0;
      result.push({
        ...n,
        kind: "path",
        x,
        y,
        w,
        h,
        d: `M ${x} ${y} L ${x + w} ${y + h}`,
        fill: "none",
        stroke: n.kind === "path" ? n.stroke : undefined,
      });
    }
  }
  return result;
}
