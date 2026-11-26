import { eventPages } from "./events";
import { adPlaceholder } from "./ads";
import { text } from "../layout-engine/types";
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
  return events.flatMap((e, i): Node[] => {
    const ph = h,
      pw = Math.min(w, ph * c.project.theme.posterAspect);
    const box = {
      x: c.left + (i % 2) * (w + gap) + (w - pw) / 2,
      y: top + Math.floor(i / 2) * (h + gap),
      w: pw,
      h: ph,
    };
    if (!e.assetId)
      return adPlaceholder(box, "ポスター未登録：" + e.name).map((n) => ({
        ...n,
        source: { type: "event" as const, id: e.id, field: "assetId" },
      }));
    return [
      {
        kind: "asset" as const,
        assetId: e.assetId!,
        x: c.left + (i % 2) * (w + gap) + (w - pw) / 2,
        y: top + Math.floor(i / 2) * (h + gap),
        w: pw,
        h: ph,
        source: { type: "event" as const, id: e.id, field: "assetId" },
      },
    ];
  });
}
export function posterPages(c: Context): Node[][] {
  const events = listingEvents(c.project, c.block.eventCategory).filter(
      (e) =>
        e.category !== "kitchen" &&
        (c.block.posterMode === "single" || e.posterRequired !== false),
    ),
    pages: Node[][] = [];
  if (c.block.posterMode === "single") {
    const result: Node[][] = [];
    let textRun: Event[] = [];
    const flush = () => {
      if (textRun.length) {
        result.push(
          ...eventPages({ ...c, project: { ...c.project, events: textRun } }),
        );
        textRun = [];
      }
    };
    for (const e of events) {
      if (e.posterRequired === false) {
        textRun.push(e);
        continue;
      }
      flush();
      result.push(
        e.assetId
          ? [
              {
                kind: "asset",
                assetId: e.assetId,
                x: c.left,
                y: 25,
                w: c.width,
                h: 172,
                source: { type: "event", id: e.id, field: "assetId" },
              },
            ]
          : adPlaceholder(
              { x: c.left, y: 25, w: c.width, h: 172 },
              "ポスター未登録：" + e.name,
            ).map((n) => ({
              ...n,
              source: { type: "event" as const, id: e.id, field: "assetId" },
            })),
      );
    }
    flush();
    return result.length ? result : [[]];
  }
  for (let i = 0; i < events.length; i += 4)
    pages.push(
      posterNodes(
        c,
        events.slice(i, i + 4),
        c.project.referenceDesign ? 12 : 24,
      ),
    );
  const textOnly = listingEvents(c.project, c.block.eventCategory).filter(
    (e) => e.category !== "kitchen" && e.posterRequired === false,
  );
  if (textOnly.length)
    pages.push(
      ...eventPages({ ...c, project: { ...c.project, events: textOnly } }),
    );
  return !pages.length && c.block.eventCategory ? [[]] : pages;
}
/** Measured content flow; never reduce an ad frame or poster below 60mm tall. */
export function flowEvents(c: Context, tables: Node[][]): Node[][] {
  const pages = tables.map((n) => [...n]),
    posters = listingEvents(c.project, c.block.eventCategory).filter(
      (e) => e.category !== "kitchen" && e.posterRequired !== false,
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
