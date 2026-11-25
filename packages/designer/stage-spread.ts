import { isStage } from "../core/registration";
import type { DesignObject } from "./model";
import type { Project } from "../core/model";
import { stageTimeline } from "./stage-timeline";
import {
  text,
  rect,
  wrap,
  type Node,
  type Measure,
} from "../layout-engine/types";
/** Compose a single logical time axis, then project its two halves into A5 pages.
 * The fold is a physical gap; text is kept wholly on one side, never rasterized. */
export function stageSpread(
  o: DesignObject,
  p: Project,
  measure: Measure,
): Node[][] {
  const x = Math.max(10, Math.min(30, o.x)),
    panel = Math.max(20, Math.min(o.w, 140 - x)),
    cut = x + panel,
    rightX = 8;
  const times = p.events
    .filter(
      (e) =>
        (isStage(e) || e.id.startsWith("preview-")) && e.published !== false,
    )
    .flatMap((e) => [e.startTime, e.endTime])
    .filter((s): s is string => !!s && /^([01]\d|2[0-3]):[0-5]\d$/.test(s))
    .map((s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3)));
  const range = {
    start: Math.floor(Math.min(540, ...times) / 60) * 60,
    end: Math.ceil(Math.max(1020, ...times) / 60) * 60,
  };
  const logical = stageTimeline(
      { ...o, x, w: panel * 2, vertical: false },
      p,
      measure,
      range,
    ),
    result: Node[][] = [];
  const overflowIds = new Set<string>();
  let group = 0;
  for (const nodes of logical) {
    if (nodes.some((n) => n.kind === "text" && n.text === "長い企画名の補足")) {
      for (const n of nodes)
        if (n.source?.type === "event") overflowIds.add(n.source.id);
      continue;
    }
    const left: Node[] = [],
      right: Node[] = [];
    for (const n of nodes) {
      if (n.kind === "text") {
        const ink = measure(n.text, n.size, n.bold),
          side = n.x < cut ? "left" : "right",
          min = side === "left" ? x : rightX,
          max = min + panel;
        const local = side === "left" ? n.x : n.x - cut + rightX;
        // Time labels and vertical glyphs near the fold remain legible on one page.
        const placedX = Math.max(min, Math.min(max - ink, local));
        const node = {
          ...n,
          x: placedX,
          transformOrigin: n.transformOrigin
            ? { ...n.transformOrigin, x: n.transformOrigin.x + placedX - n.x }
            : undefined,
          w: Math.max(0.1, Math.min(panel, ink)),
        };
        (side === "left" ? left : right).push(node);
        continue;
      }
      if (n.kind !== "rect") continue; // The stage renderer emits vector rectangles and text.
      for (const [target, lo, hi, origin] of [
        [left, x, cut, x],
        [right, cut, cut + panel, rightX],
      ] as const) {
        const start = Math.max(lo, n.x),
          end = Math.min(hi, n.x + n.w);
        if (end <= start) continue;
        const corners = n.corners ? { ...n.corners } : undefined;
        if (corners && start > n.x) {
          corners.topLeft = corners.bottomLeft = 0;
        }
        if (corners && end < n.x + n.w) {
          corners.topRight = corners.bottomRight = 0;
        }
        target.push({
          ...n,
          x: origin + start - lo,
          w: end - start,
          h: n.componentKind === "stage-event" ? Math.min(10, n.h) : n.h,
          corners,
        });
      }
    }
    // Both pieces describe the same continuous axis; the unprinted centre is the fold.
    const line = o.stroke === "none" ? "#808080" : o.stroke;
    left.unshift(rect(x, o.y + 8, panel, 0.35, line));
    right.unshift(rect(rightX, o.y + 8, panel, 0.35, line));
    const tagged = (ns: Node[], side: "left" | "right") =>
      ns.map((n) => ({ ...n, spreadSide: side, spreadIndex: group }));
    const pair =
      p.theme.binding === "right"
        ? [tagged(right, "right"), tagged(left, "left")]
        : [tagged(left, "left"), tagged(right, "right")];
    result.push(...pair);
    group++;
  }
  // Overflow descriptions remain searchable A5 text, outside the paired timeline.
  if (overflowIds.size) {
    let ns: Node[] = [],
      y = o.y;
    const next = () => {
      ns = [text(x, o.y, panel, "長い企画名の補足", 3, p.theme.ink, true)];
      result.push(ns);
      y = o.y + 8;
    };
    next();
    for (const id of overflowIds) {
      const e = p.events.find((e) => e.id === id);
      if (!e) continue;
      for (const line of wrap(e.name, panel, 3, measure, true)) {
        if (y + 4.2 > o.y + o.h) next();
        ns.push({
          ...text(x, y, panel, line, 3, p.theme.ink),
          source: { type: "event", id, field: "name" },
        });
        y += 4.2;
      }
      y += 4;
    }
  }
  return result;
}
