import { repeatPages } from "./repeat-design";
import { stageSpread } from "./stage-spread";
import { stageTimeline } from "./stage-timeline";
import { tabPath } from "./tab-path";
import { resolveObject, componentObject } from "./components";
import { corners, mirrorCorners } from "./corners";
import { tablePages } from "./table-engine";
import {
  sortedEvents,
  listingEvents,
  type Project,
  type Event,
} from "../core/model";
import {
  rect,
  text,
  wrap,
  fallbackMeasure,
  type Node,
  type Measure,
} from "../layout-engine/types";
import type { DesignObject, DesignTemplate } from "./model";
import { ellipsePath, pathData } from "./geometry";
import { adPlaceholder, adPlaceholderLabel } from "../templates/ads";
export interface RenderContext {
  side: "left" | "right";
  number?: number;
  chapterId?: string;
  ads?: Record<string, string | undefined>;
  previewAds?: boolean;
  title?: string;
  blockId?: string;
}
function timeValue(s?: string) {
  const m = s?.match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 1e6;
}
export function eventValue(e: Event | undefined, key: string): string {
  if (!e) return "";
  if (key === "place")
    return `${e.building} ${e.floor !== undefined ? e.floor + "階" : ""} ${e.room} ${e.location}`.trim();
  return String((e as unknown as Record<string, unknown>)[key] ?? "");
}
function mark(nodes: Node[], o: DesignObject, namespace: string): Node[] {
  return nodes.map((n, i) => ({
    ...n,
    id: `${namespace}:${o.id}:${i}`,
    objectId: o.id,
    layerId: o.layerId,
    groupId: o.groupId,
    rotation: n.rotation || o.rotation,
    transformOrigin: n.transformOrigin ?? {
      x: o.x + o.w / 2,
      y: o.y + o.h / 2,
    },
    opacity: (n.opacity ?? 1) * o.opacity,
    strokeWidth: n.strokeWidth ?? o.strokeWidth,
    dash: n.dash ?? o.dash,
  }));
}
function flow(
  o: DesignObject,
  p: Project,
  measure: Measure,
  category?: Project["events"][number]["category"],
): Node[][] {
  const es =
      o.kind === "timetable" ? sortedEvents(p) : listingEvents(p, category),
    pages: Node[][] = [[]];
  let n = pages[0];
  const next = () => {
    n = [];
    pages.push(n);
    return n;
  };
  if (o.kind === "posters") {
    const capacity = Math.max(1, Math.floor(o.cols) * Math.floor(o.rows)),
      cw = (o.w - (o.cols - 1) * o.gap) / o.cols,
      ch = (o.h - (o.rows - 1) * o.gap) / o.rows;
    if (cw < 4 || ch < 13)
      return [[text(o.x, o.y, o.w, "枠が小さすぎます。", 3, "#bb3322")]];
    for (
      let start = 0;
      start <
      es.filter(
        (e) =>
          e.assetId && e.category !== "kitchen" && e.posterRequired !== false,
      ).length;
      start += capacity
    ) {
      if (start) next();
      es.filter(
        (e) =>
          e.assetId && e.category !== "kitchen" && e.posterRequired !== false,
      )
        .slice(start, start + capacity)
        .forEach((e, i) => {
          const x = o.x + (i % o.cols) * (cw + o.gap),
            y = o.y + Math.floor(i / o.cols) * (ch + o.gap),
            ih = ch,
            iw = Math.min(cw, ih * p.theme.posterAspect),
            xx = x + (cw - iw) / 2;
          if (e.assetId)
            n.push({
              kind: "asset",
              assetId: e.assetId,
              x: xx,
              y,
              w: iw,
              h: ih,
              source: { type: "event", id: e.id, field: "assetId" },
            });
          else
            n.push(
              rect(
                xx,
                y,
                iw,
                ih,
                o.fill === "none" ? "#f4f3ef" : o.fill,
                o.stroke === "none" ? undefined : o.stroke,
              ),
            );
        });
    }
    return pages;
  }
  if (o.kind === "timetable" && o.eventSource === "stage")
    return !o.vertical && o.spread !== false
      ? stageSpread(o, p, measure)
      : stageTimeline(o, p, measure);
  if (o.kind === "timetable") {
    // Prefer explicitly registered stage events. Older projects without
    // categories retain the previous timetable behaviour.
    const stages = es.filter(
      (e) => e.category === "stage" || e.category === "studentStage",
    );
    const ordered = [
      ...(stages.length || es.some((e) => e.category) ? stages : es),
    ].sort((a, b) => timeValue(a.startTime) - timeValue(b.startTime));
    const cw = o.vertical ? o.w : o.w / o.itemsPerPage,
      lh = o.size * 1.4,
      maxLines = Math.max(1, Math.floor((o.h - 14) / lh));
    const items = ordered.flatMap((e) => {
      const ls = wrap(
          e.name,
          Math.max(1, cw - 2 * o.padding),
          o.size,
          measure,
          true,
        ),
        fragments: { e: Event; lines: string[] }[] = [];
      for (let offset = 0; offset < ls.length; offset += maxLines)
        fragments.push({ e, lines: ls.slice(offset, offset + maxLines) });
      return fragments;
    });
    let cursor = o.y,
      count = 0;
    for (const item of items) {
      const h = o.vertical ? 12 + item.lines.length * lh : o.h;
      if (
        count >= o.itemsPerPage ||
        (o.vertical && cursor + h > o.y + o.h + 0.01)
      ) {
        next();
        cursor = o.y;
        count = 0;
      }
      const x = o.vertical ? o.x : o.x + count * cw,
        y = o.vertical ? cursor : o.y;
      n.push(
        rect(
          x,
          y,
          cw,
          8,
          item.e.category === "studentStage" ? o.alternate : o.headerFill,
        ),
      );
      n.push({
        ...text(
          x + o.padding,
          y + 1,
          cw - 2 * o.padding,
          `${item.e.startTime || "未設定"}${item.e.endTime ? "–" + item.e.endTime : ""}`,
          Math.min(o.size, cw / 14),
          o.headerColor,
          true,
        ),
        source: { type: "event", id: item.e.id, field: "timeRange" },
      });
      n.push({
        kind: "path",
        x,
        y: y + 8,
        w: Math.max(0.5, cw),
        h: 3,
        d: `M ${x + cw / 2} ${y + 8} L ${x + cw / 2} ${y + 11}`,
        fill: "none",
        stroke: o.stroke,
        strokeWidth: o.strokeWidth,
        dash: o.dash,
      });
      item.lines.forEach((line, j) =>
        n.push({
          ...text(
            x + o.padding,
            y + 12 + j * lh,
            cw - 2 * o.padding,
            line,
            o.size,
            "#231815",
            true,
          ),
          source: { type: "event", id: item.e.id, field: "name" },
        }),
      );
      cursor += h + o.gap;
      count++;
    }
    if (!items.length)
      n.push(
        text(
          o.x,
          o.y,
          o.w,
          "企画と開催時刻を登録してください。",
          o.size,
          "#808080",
        ),
      );
    return pages;
  }
  if (o.tableStyle) return tablePages(o, p, measure, category);
  const columns = o.columns!,
    sum = columns.reduce((s, c) => s + c.weight, 0),
    widths = columns.map((c) => (o.w * c.weight) / sum);
  const headerHeight = Math.max(
      o.headerHeight ?? o.rowHeight,
      2 * o.padding + o.size * 1.4,
    ),
    rowHeight = Math.max(o.rowHeight, 2 * o.padding + o.size * 1.5);
  let y = o.y,
    last = "";
  const header = () => {
    let x = o.x;
    columns.forEach((c, i) => {
      n.push(
        rect(
          x,
          y,
          widths[i],
          headerHeight,
          o.headerFill,
          o.stroke === "none" ? undefined : o.stroke,
        ),
      );
      n.push(
        text(
          x + o.padding,
          y + o.padding,
          widths[i] - 2 * o.padding,
          c.label,
          o.size,
          o.headerColor,
          true,
        ),
      );
      x += widths[i];
    });
    y += headerHeight;
  };
  header();
  const breakPage = () => {
    next();
    y = o.y;
    header();
  };
  es.forEach((e, ri) => {
    if (o.groupBuildings && last !== e.building) {
      if (y + rowHeight * 2 > o.y + o.h) breakPage();
      n.push(rect(o.x, y, o.w, rowHeight, o.alternate));
      n.push(
        text(
          o.x + o.padding,
          y + o.padding,
          o.w - 2 * o.padding,
          e.building || "建物未設定",
          o.size,
          "#231815",
          true,
        ),
      );
      y += rowHeight;
      last = e.building;
    }
    const lines = columns.map((c, i) =>
      wrap(
        eventValue(e, c.field),
        Math.max(1, widths[i] - 2 * o.padding),
        o.size,
        measure,
      ),
    );
    let offset = 0;
    const count = Math.max(...lines.map((l) => l.length));
    while (offset < count) {
      const available = Math.floor(
        (o.y + o.h - y - 2 * o.padding) / (o.size * 1.5),
      );
      if (available < 1) {
        if (y <= o.y + headerHeight + 0.01) return;
        breakPage();
        continue;
      }
      const take = Math.min(count - offset, available),
        rh = Math.max(rowHeight, take * o.size * 1.5 + 2 * o.padding);
      if (y + rh > o.y + o.h + 0.01) {
        breakPage();
        continue;
      }
      let x = o.x;
      lines.forEach((ls, i) => {
        n.push(
          rect(
            x,
            y,
            widths[i],
            rh,
            ri % 2 ? o.alternate : "#ffffff",
            o.stroke === "none" ? undefined : o.stroke,
          ),
        );
        ls.slice(offset, offset + take).forEach((s, j) =>
          n.push(
            text(
              x + o.padding,
              y + o.padding + j * o.size * 1.5,
              widths[i] - 2 * o.padding,
              s,
              o.size,
              "#231815",
              o.bold,
            ),
          ),
        );
        x += widths[i];
      });
      y += rh;
      offset += take;
      if (offset < count) breakPage();
    }
  });
  if (!es.length)
    n.push(
      text(
        o.x + 2,
        y + 4,
        o.w - 4,
        "企画を登録すると行が追加されます。",
        o.size,
        "#808080",
      ),
    );
  return pages;
}
export function renderIndex(
  o: DesignObject,
  p: Project,
  ctx: RenderContext,
): Node[] {
  const chapters = p.chapters.filter((ch) => ch.visible !== false);
  const n: Node[] = [],
    gap = o.gap,
    hh = Math.max(
      0.5,
      (o.h - gap * (chapters.length - 1)) / Math.max(1, chapters.length),
    ),
    xx = o.mirror && ctx.side === "left" ? 148 - o.x - o.w : o.x;
  chapters.forEach((ch, i) => {
    const tab = { ...o, ...o.tabStyles?.[ch.id] };
    let radii = corners(tab.corners ?? tab.radius);
    if (tab.tabShape === "rect") radii = corners(0);
    if (tab.tabShape === "outer") radii.topLeft = radii.bottomLeft = 0;
    if (tab.tabShape === "top") radii.bottomLeft = radii.bottomRight = 0;
    if (tab.tabShape === "bottom") radii.topLeft = radii.topRight = 0;
    if (o.mirror && ctx.side === "left") radii = mirrorCorners(radii);
    const yy = o.y + i * (hh + gap),
      active = ch.id === ctx.chapterId;
    n.push({
      ...rect(
        xx,
        yy,
        o.w,
        hh,
        tab.useChapterColors === false ? tab.fill : ch.color,
        tab.stroke === "none" ? undefined : tab.stroke,
        tab.radius,
        active ? (tab.opacity ?? 1) : tab.inactiveOpacity,
      ),
      corners: radii,
      source: { type: "chapter", id: ch.id, field: "name" },
      tablePart: { kind: "cell", groupKey: ch.id, rowIndex: i },
    });
    if (tab.tabShape === "slant" || (tab.tabShape === "path" && tab.tabPath)) {
      try {
        const d = tabPath(
          tab.tabShape === "slant"
            ? "M 0 0 L 0.7 0 L 1 0.1 L 1 1 L 0 1 Z"
            : tab.tabPath!,
          xx,
          yy,
          o.w,
          hh,
          o.mirror && ctx.side === "left",
        );
        n[n.length - 1] = {
          kind: "path",
          x: xx,
          y: yy,
          w: o.w,
          h: hh,
          d,
          fill: tab.useChapterColors === false ? tab.fill : ch.color,
          stroke: tab.stroke === "none" ? undefined : tab.stroke,
          strokeWidth: tab.strokeWidth,
          opacity: active ? 1 : tab.inactiveOpacity,
          source: { type: "chapter", id: ch.id, field: "name" },
          tablePart: { kind: "cell", groupKey: ch.id, rowIndex: i },
        };
      } catch {
        /* Keep the last valid rectangular fallback while typing. Validation rejects saving an invalid path. */
      }
    }
    if (o.vertical) {
      const chars = Array.from(ch.name),
        size = Math.min(tab.size, (hh - 1) / Math.max(1, chars.length));
      chars.forEach((s, j) =>
        n.push(
          text(
            xx + (o.w - size) / 2,
            yy + (hh - chars.length * size) / 2 + j * size,
            size,
            s,
            size,
            tab.tabTextColor || "#231815",
            active,
          ),
        ),
      );
    } else
      n.push(
        text(
          xx + 1,
          yy + hh / 2 - o.size / 2,
          o.w - 2,
          ch.name,
          o.size,
          tab.tabTextColor || "#231815",
          active,
        ),
      );
  });
  return n.map((node) => ({
    ...node,
    source: {
      type: "chapter",
      id:
        chapters[
          Math.max(
            0,
            Math.min(
              chapters.length - 1,
              Math.floor((node.y - o.y) / (hh + gap)),
            ),
          )
        ]?.id || "",
      field: "name",
    },
  }));
}
export function renderTemplate(
  p: Project,
  t: DesignTemplate,
  measure: Measure = fallbackMeasure,
  ctx: RenderContext = { side: "right" },
): Node[][] {
  const visible = t.objects
      .map((o) => resolveObject(p, o))
      .filter(
        (o) =>
          o.visible !== false &&
          t.layers.find((l) => l.id === o.layerId)?.visible,
      ),
    component = visible.find((o) =>
      ["table", "posters", "timetable"].includes(o.kind),
    ),
    repeat =
      (t.kind === "staff" || t.kind === "kitchen") &&
      t.constraints?.flow === "repeat" &&
      t.objects.some((o) => o.repeatRole)
        ? repeatPages(t.kind, visible, p, measure)
        : undefined,
    flows = repeat
      ? repeat.map(() => [] as Node[])
      : component
        ? flow(
            component,
            p,
            measure,
            p.blocks.find((b) => b.id === ctx.blockId)?.eventCategory,
          )
        : Array.from(
            {
              length:
                t.kind === "ads"
                  ? Math.max(
                      1,
                      ...(["full", "half", "quarter"] as const).map((size) => {
                        const slots = templateAdObjects(p, t).filter(
                          (o) => (o.adSize || "quarter") === size,
                        ).length;
                        return slots
                          ? Math.ceil(
                              p.ads.filter(
                                (a) => a.published !== false && a.size === size,
                              ).length / slots,
                            )
                          : 0;
                      }),
                    )
                  : 1,
            },
            () => [] as Node[],
          ),
    result: Node[][] = [];
  const sampleAds = ctx.previewAds ? templateAdObjects(p, t) : [];
  for (let page = 0; page < flows.length; page++) {
    const ads = ctx.previewAds
      ? Object.fromEntries(
          (["full", "half", "quarter"] as const).flatMap((size) => {
            const slots = sampleAds.filter(
              (o) => (o.adSize || "quarter") === size,
            );
            const available = p.ads.filter(
              (a) => a.published !== false && a.size === size,
            );
            return slots.map((slot, i) => [
              slot.id,
              available[page * slots.length + i]?.id,
            ]);
          }),
        )
      : ctx.ads;
    const nodes: Node[] =
      t.scope === "component" || t.scope === "style" || t.scope === "master"
        ? []
        : [rect(0, 0, 148, 210, t.background)];
    const master = p.templates.find((m) => m.id === t.masterId);
    if (master && master.id !== t.id && !master.masterId)
      nodes.push(
        ...renderTemplate(
          p,
          {
            ...master,
            objects: master.objects.map((o) => {
              const i = t.runtimeOverrides?.find(
                (i) => i.targetObjectId === o.id,
              );
              return i
                ? {
                    ...componentObject(p, i),
                    id: o.id,
                    layerId: o.layerId,
                    binding: o.binding,
                    assetId: o.assetId,
                    text: o.text,
                  }
                : o;
            }),
          },
          measure,
          ctx,
        )[0].filter(
          (n) =>
            !(
              n.kind === "rect" &&
              n.x === 0 &&
              n.y === 0 &&
              n.w === 148 &&
              n.h === 210
            ),
        ),
      );
    for (const layer of t.layers.filter((l) => l.visible))
      for (const o of visible.filter((o) => o.layerId === layer.id)) {
        let ns: Node[] = [];
        if (o.repeatRole) continue;
        if (o === component) ns = flows[page];
        else if (o.kind === "rect")
          ns = [
            {
              ...rect(
                o.x,
                o.y,
                o.w,
                o.h,
                o.fill,
                o.stroke === "none" ? undefined : o.stroke,
                o.radius,
              ),
              corners: o.corners,
            },
          ];
        else if (o.kind === "ellipse")
          ns = [
            {
              kind: "path",
              x: o.x,
              y: o.y,
              w: o.w,
              h: o.h,
              d: ellipsePath(o.x, o.y, o.w, o.h),
              fill: o.fill,
              stroke: o.stroke,
            },
          ];
        else if (o.kind === "line")
          ns = [
            {
              kind: "path",
              x: o.x,
              y: o.y,
              w: o.w,
              h: o.h,
              d: `M ${o.x} ${o.y} L ${o.x + o.w} ${o.y + o.h}`,
              fill: "none",
              stroke: o.stroke,
            },
          ];
        else if (o.kind === "path")
          ns = [
            {
              kind: "path",
              x: o.x,
              y: o.y,
              w: o.w,
              h: o.h,
              d: pathData(o),
              fill: o.fill,
              stroke: o.stroke,
            },
          ];
        else if (o.kind === "index") ns = renderIndex(o, p, ctx);
        else if (o.kind === "text") {
          if (
            (t.kind === "cover" ||
              p.blocks.find((b) => b.id === ctx.blockId)?.template ===
                "cover") &&
            (o.binding === "project.festival" || o.binding === "project.date")
          )
            continue;
          const e = sortedEvents(p)[page],
            binding =
              o.binding === "block.body"
                ? p.blocks.find((b) => b.id === ctx.blockId)?.body ||
                  "本文を作業ページで登録してください。"
                : o.binding === "page.title"
                  ? ctx.title || "ページタイトル"
                  : o.binding === "page.number"
                    ? String(ctx.number ?? page + 1)
                    : o.binding === "chapter.name"
                      ? p.chapters.find((ch) => ch.id === ctx.chapterId)
                          ?.name || "章名"
                      : o.binding === "project.festival"
                        ? (p.edition > 0 ? `第${p.edition}回 ` : "") +
                          p.festival
                        : o.binding === "project.date"
                          ? p.date
                          : o.binding.startsWith("event.")
                            ? eventValue(e, o.binding.slice(6))
                            : o.text;
          if (o.binding === "block.body" && o.listMarker && ctx.blockId) {
            const indent = Math.min(o.w - 1, Math.max(2, o.bulletIndent ?? 5));
            const lh = o.size * (o.lineHeight ?? 1.5);
            let lineNumber = 0;
            let cursor = o.y;
            binding.split(/\r?\n/).forEach((entry, index) => {
              if (!entry.trim()) return;
              const source: Node["source"] = {
                type: "block",
                id: ctx.blockId!,
                field: `bodyLine:${index}`,
              };
              lineNumber++;
              const marker =
                o.listMarker === "number"
                  ? `${lineNumber}.`
                  : o.listMarker === "dash"
                    ? "—"
                    : "・";
              ns.push({
                ...text(
                  o.x,
                  cursor,
                  indent - 0.5,
                  marker,
                  o.size,
                  o.fill,
                  o.bold,
                ),
                source,
              });
              const lines = wrap(entry, o.w - indent, o.size, measure, o.bold);
              lines.forEach((part, j) =>
                ns.push({
                  ...text(
                    o.x + indent,
                    cursor + j * lh,
                    o.w - indent,
                    part,
                    o.size,
                    o.fill,
                    o.bold,
                  ),
                  source,
                }),
              );
              cursor += Math.max(1, lines.length) * lh;
            });
          } else {
            wrap(binding, o.w, o.size, measure, o.bold).forEach((s, i) =>
              ns.push(
                text(
                  o.mirror && o.binding === "page.number" && ctx.side === "left"
                    ? 148 - o.x - o.w
                    : o.x +
                        (o.textAlign === "center"
                          ? 0.5
                          : o.textAlign === "right"
                            ? 1
                            : 0) *
                          Math.max(0, o.w - measure(s, o.size, o.bold)),
                  o.y + i * o.size * (o.lineHeight ?? 1.5),
                  o.w,
                  s,
                  o.size,
                  o.fill,
                  o.bold,
                ),
              ),
            );
            const source: Node["source"] =
              o.binding === "block.body"
                ? { type: "block", id: ctx.blockId || "", field: "body" }
                : o.binding === "page.title"
                  ? { type: "block", id: ctx.blockId || "", field: "title" }
                  : o.binding === "chapter.name"
                    ? {
                        type: "chapter",
                        id: ctx.chapterId || "",
                        field: "name",
                      }
                    : o.binding === "page.number"
                      ? { type: "pageNumber", id: "", field: "number" }
                      : o.binding === "project.date"
                        ? { type: "project", id: p.id, field: "date" }
                        : o.binding === "project.festival"
                          ? {
                              type: "project",
                              id: p.id,
                              field: "festivalDisplay",
                            }
                          : o.binding.startsWith("event.") && e
                            ? {
                                type: "event",
                                id: e.id,
                                field: o.binding.slice(6),
                              }
                            : undefined;
            if (source) ns = ns.map((n) => ({ ...n, source }));
          }
        } else if (o.kind === "image") {
          const posterEvent =
            o.binding === "event.poster"
              ? sortedEvents(p).filter(
                  (event) => event.assetId && event.posterRequired !== false,
                )[page]
              : undefined;
          const assignedAd =
            o.binding === "advertisement"
              ? p.ads.find((ad) => ad.id === ads?.[o.id])
              : undefined;
          const assetId =
            posterEvent?.assetId ||
            assignedAd?.assetId ||
            (o.binding === "none" ? o.assetId : undefined);
          if (assetId)
            ns = [
              {
                kind: "asset",
                assetId,
                x: o.x,
                y: o.y,
                w: o.w,
                h: o.h,
                source: posterEvent
                  ? { type: "event", id: posterEvent.id, field: "assetId" }
                  : assignedAd
                    ? { type: "ad", id: assignedAd.id, field: "assetId" }
                    : undefined,
              },
            ];
          else
            ns = adPlaceholder(
              o,
              o.binding === "advertisement"
                ? adPlaceholderLabel(p, assignedAd?.id)
                : o.binding === "event.poster"
                  ? "ポスター画像"
                  : "画像枠",
              measure,
            );
        }
        nodes.push(...mark(ns, o, t.id));
      }
    for (const [index, entry] of (repeat?.[page] ?? []).entries()) {
      const n = entry.node;
      nodes.push(
        ...(entry.object
          ? mark(
              [
                {
                  ...n,
                  transformOrigin: { x: n.x + n.w / 2, y: n.y + n.h / 2 },
                },
              ],
              entry.object,
              `${t.id}:repeat:${index}`,
            )
          : [n]),
      );
    }
    result.push(nodes);
  }
  return result;
}

export function templateAdObjects(
  p: Project,
  t: DesignTemplate,
): DesignObject[] {
  const master = p.templates.find((m) => m.id === t.masterId);
  return [...(master ? [master] : []), t].flatMap((def) =>
    def.objects.filter(
      (o) =>
        o.kind === "image" &&
        o.binding === "advertisement" &&
        def.layers.find((l) => l.id === o.layerId)?.visible,
    ),
  );
}

export function renderComponent(
  o: DesignObject,
  p: Project,
  measure: Measure,
  ctx: RenderContext = { side: "right" },
): Node[][] {
  const t: DesignTemplate = {
    id: "component-" + o.id,
    name: o.name,
    scope: "component",
    componentKind: o.kind,
    kind: "notice",
    version: 1,
    createdAt: "",
    updatedAt: "",
    objects: [o],
    layers: [{ id: o.layerId, name: "部品", visible: true, locked: false }],
    background: "#ffffff",
    grid: 2,
    snap: false,
    guidesX: [],
    guidesY: [],
  };
  return renderTemplate(p, t, measure, ctx);
}
