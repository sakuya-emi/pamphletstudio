import { listingEvents, type Event } from "../core/model";
import { type Context, type Node } from "../layout-engine/types";
export function posterNodes(
  c: Context,
  events: Event[],
  top: number,
  rows = 2,
): Node[] {
  const bottom = 198 - c.project.theme.adQuarterHeight - 6,
    gap = c.block.posterSpacing === "compact" ? 3 : 5,
    h = (bottom - top - gap * (rows - 1)) / rows,
    w = (c.width - gap) / 2;
  return events.map((e, i) => {
    const ph = h,
      pw = Math.min(w, ph * c.project.theme.posterAspect);
    return {
      kind: "asset" as const,
      assetId: e.assetId!,
      x: c.left + (i % 2) * (w + gap) + (w - pw) / 2,
      y: top + Math.floor(i / 2) * (h + gap),
      w: pw,
      h: ph,
      source: { type: "event" as const, id: e.id, field: "assetId" },
    };
  });
}
export function posterPages(c: Context): Node[][] {
  const events = listingEvents(c.project, c.block.eventCategory).filter(
      (e) => e.assetId && e.category !== "kitchen",
    ),
    pages: Node[][] = [];
  if (c.block.posterMode === "single")
    return events.length
      ? events.map((e) => [
          {
            kind: "asset",
            assetId: e.assetId!,
            x: c.left,
            y: 25,
            w: c.width,
            h: 172,
            source: { type: "event", id: e.id, field: "assetId" },
          },
        ])
      : [[]];
  for (let i = 0; i < events.length; i += 4)
    pages.push(
      posterNodes(
        c,
        events.slice(i, i + 4),
        c.project.referenceDesign ? 12 : 24,
      ),
    );
  return !pages.length && c.block.eventCategory ? [[]] : pages;
}
/** Measured content flow; never reduce an ad frame or poster below 60mm tall. */
export function flowEvents(c: Context, tables: Node[][]): Node[][] {
  const pages = tables.map((n) => [...n]),
    posters = listingEvents(c.project, c.block.eventCategory).filter(
      (e) => e.assetId && e.category !== "kitchen",
    );
  let taken = 0;
  const last = pages.at(-1),
    end = last?.reduce((y, n) => Math.max(y, n.y + n.h), 23) ?? 23,
    top = end + 5,
    available = 198 - c.project.theme.adQuarterHeight - 6 - top;
  if (last && end < 110 && available >= 60 && posters.length) {
    taken = Math.min(2, posters.length);
    last.push(...posterNodes(c, posters.slice(0, taken), top, 1));
  }
  for (let i = taken; i < posters.length; i += 4)
    pages.push(posterNodes(c, posters.slice(i, i + 4), 24));
  return pages;
}
