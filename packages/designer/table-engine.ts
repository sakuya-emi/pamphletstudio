import { collapseBorders } from "./table-borders";
import { listingEvents, type Project, type Event } from "../core/model";
import {
  text,
  rect,
  wrap,
  type Node,
  type Measure,
} from "../layout-engine/types";
import type { DesignObject } from "./model";
import { corners, type CornerRadius } from "./corners";
import {
  defaultTableStyle,
  type TableStyle,
  type CellStyle,
  type TableTarget,
  type BorderStyle,
} from "./table-model";
export const fieldValue = (e: Event, key: string) =>
  e.category === "kitchen" && key === "building"
    ? "屋外"
    : e.category === "kitchen" &&
        ["place", "placeShort", "location", "room"].includes(key)
      ? "マップに記載"
      : e.category === "kitchen" && key === "floor"
        ? ""
        : key === "placeShort"
          ? `${e.floor !== undefined ? e.floor + "階 " : ""}${e.room || e.location}`.trim()
          : key === "place"
            ? `${e.building} ${e.floor !== undefined ? e.floor + "階" : ""} ${e.room} ${e.location}`.trim()
            : String((e as unknown as Record<string, unknown>)[key] ?? "");
export function mergedStyle(...styles: (CellStyle | undefined)[]): CellStyle {
  return styles.reduce<CellStyle>(
    (a, b) => (b ? { ...a, ...b, border: { ...a.border, ...b.border } } : a),
    {},
  );
}
export function cellStyle(
  t: TableStyle,
  rowId: string,
  rowIndex: number,
  column: number,
): CellStyle {
  const col = t.columns[column];
  return mergedStyle(
    t.base,
    rowIndex % 2 ? t.even : t.odd,
    t.rows[rowId],
    col,
    col?.alternate && rowIndex % 2 ? { fill: col.alternate } : undefined,
    t.cells[`${rowId}:${column}`],
  );
}
type Row = {
  e: Event;
  index: number;
  lines: string[][];
  height: number;
  part: number;
};
function dash(b: BorderStyle) {
  return b.type === "dotted"
    ? [Math.max(0.1, b.width), b.gap ?? 0.7]
    : b.type === "dashed"
      ? [Math.max(0.5, b.width * 5), b.gap ?? 1]
      : undefined;
}
export function tablePages(
  o: DesignObject,
  p: Project,
  measure: Measure,
  category?: Event["category"],
): Node[][] {
  const s = o.tableStyle || defaultTableStyle(),
    columns = o.columns || [],
    count = columns.length;
  if (!count) return [[]];
  const total = columns.reduce((a, c) => a + c.weight, 0),
    card = s.variant === "cards",
    leftPad = card ? s.groupLabelWidth + 3 : 0;
  const widths = columns.map(
    (c) =>
      ((o.w - leftPad - (count - 1) * s.columnGap - (card ? 6 : 0)) *
        c.weight) /
      total,
  );
  if (widths.some((w) => w < 2))
    return [
      [text(o.x, o.y, o.w, "列の幅・間隔を調整してください。", 3, "#bb3322")],
    ];
  const es = listingEvents(p, category),
    titleH = s.title.scope === "none" ? 0 : s.title.height + 2,
    headH = card ? 0 : o.headerHeight;
  const capacity = o.h - titleH - headH - (card ? 8 : 0);
  if (capacity < 5)
    return [[text(o.x, o.y, o.w, "表の高さが不足しています。", 3, "#bb3322")]];
  const measured = (value: string, width: number, style: CellStyle) =>
    wrap(
      value,
      Math.max(1, width - 2 * (style.padding ?? o.padding)),
      style.size ?? o.size,
      (str, size, bold) =>
        measure(str, size, bold) +
        Math.max(0, Array.from(str).length - 1) * (style.letterSpacing ?? 0),
      style.bold,
    );
  const records: Row[] = [];
  es.forEach((e, index) => {
    const styles = columns.map((_, ci) => cellStyle(s, e.id, index, ci));
    const ls = columns.map((c, ci) =>
      measured(fieldValue(e, c.field), widths[ci], styles[ci]),
    );
    const need = ls.map((lines, ci) => {
      const st = styles[ci];
      const merged = s.merge.find((m) => m.column === ci);
      const shares =
        merged &&
        es.filter(
          (a) => fieldValue(a, merged.key) === fieldValue(e, merged.key),
        ).length > 1;
      return shares
        ? o.rowHeight
        : lines.length * (st.size ?? o.size) * (st.lineHeight ?? 1.4) +
            2 * (st.padding ?? o.padding);
    });
    const maxHeight = Math.max(o.rowHeight, ...need);
    // Split an exceptionally long source row into bounded fragments; never shrink or drop its text.
    const maxLines = Math.max(
      1,
      Math.floor(
        (capacity -
          2 * Math.max(...styles.map((st) => st.padding ?? o.padding))) /
          Math.max(
            ...styles.map((st) => (st.size ?? o.size) * (st.lineHeight ?? 1.4)),
          ),
      ),
    );
    const largest = Math.max(...ls.map((l) => l.length));
    for (let off = 0; off < Math.max(1, largest); off += maxLines) {
      const lines = ls.map((l) => l.slice(off, off + maxLines));
      const height = Math.min(
        capacity,
        Math.max(
          o.rowHeight,
          ...lines.map(
            (l, ci) =>
              Math.max(1, l.length) *
                (styles[ci].size ?? o.size) *
                (styles[ci].lineHeight ?? 1.4) +
              2 * (styles[ci].padding ?? o.padding),
          ),
          s.autoHeight ? 0 : Math.min(maxHeight, capacity),
        ),
      );
      records.push({ e, index, lines, height, part: off });
    }
  });
  const groups: { key: string; rows: Row[] }[] = [];
  for (const row of records) {
    const key = s.groupBy === "none" ? "" : fieldValue(row.e, s.groupBy);
    if (groups.at(-1)?.key !== key) groups.push({ key, rows: [] });
    groups.at(-1)!.rows.push(row);
  }
  type Segment = { key: string; rows: Row[]; continued: boolean };
  const segments: Segment[][] = [[]];
  let used = 0;
  const fresh = () => {
    segments.push([]);
    used = 0;
  };
  function labelStyle(key: string): CellStyle {
    const gs = { ...s.group, ...s.groups[key] };
    return {
      ...s.base,
      color: gs.labelColor || gs.stroke,
      size: gs.labelSize || 5.5,
      bold: true,
      padding: 2,
      valign: "top",
    };
  }
  function labelLines(key: string, continued: boolean) {
    return measured(
      key + (continued ? "\n続き" : ""),
      s.groupLabelWidth,
      labelStyle(key),
    );
  }
  function labelHeight(key: string, continued: boolean) {
    const st = labelStyle(key);
    return (
      labelLines(key, continued).length *
        (st.size ?? o.size) *
        (st.lineHeight ?? 1.4) +
      10
    );
  }
  function segmentHeight(key: string, rows: Row[], continued: boolean) {
    if (!rows.length) return 0;
    const content =
      rows.reduce((a, r) => a + r.height + s.rowGap, 0) - s.rowGap;
    return card
      ? Math.max(content + 8, labelHeight(key, continued)) + s.groupGap
      : content + s.rowGap;
  }
  for (const group of groups) {
    const whole = segmentHeight(group.key, group.rows, false);
    if (s.keepGroups && used && whole <= capacity && used + whole > capacity)
      fresh();
    let segment: Segment = { key: group.key, rows: [], continued: false };
    for (const row of group.rows) {
      let previous = segmentHeight(
        segment.key,
        segment.rows,
        segment.continued,
      );
      let next = segmentHeight(
        segment.key,
        [...segment.rows, row],
        segment.continued,
      );
      if (used + next - previous > capacity + 0.001 && used) {
        if (segment.rows.length) segments.at(-1)!.push(segment);
        fresh();
        segment = { key: group.key, rows: [], continued: true };
        previous = 0;
        next = segmentHeight(segment.key, [row], true);
      }
      used += next - previous;
      segment.rows.push(row);
    }
    if (segment.rows.length) segments.at(-1)!.push(segment);
  }
  function roundBox(
    nodes: Node[],
    x: number,
    y: number,
    w: number,
    h: number,
    style: CellStyle,
    meta?: TableTarget,
    stroke?: string,
    strokeWidth?: number,
  ) {
    nodes.push({
      ...rect(x, y, w, h, style.fill || "none", stroke, 0),
      corners: style.corners,
      strokeWidth,
      tablePart: meta,
      source:
        meta?.rowId && meta.column !== undefined
          ? {
              type: "event",
              id: meta.rowId,
              field: columns[meta.column]?.field || "name",
            }
          : undefined,
    });
  }
  function words(
    nodes: Node[],
    x: number,
    y: number,
    w: number,
    h: number,
    lines: string[],
    style: CellStyle,
    meta?: TableTarget,
  ) {
    const size = style.size ?? o.size,
      pad = style.padding ?? o.padding,
      lh = size * (style.lineHeight ?? 1.4),
      height = lines.length * lh;
    const yy =
      y +
      (style.valign === "top"
        ? pad
        : style.valign === "bottom"
          ? h - pad - height
          : (h - height) / 2);
    lines.forEach((line, j) => {
      const ww =
          measure(line, size, style.bold) +
          Math.max(0, Array.from(line).length - 1) * (style.letterSpacing ?? 0),
        xx =
          x +
          (style.align === "center"
            ? (w - ww) / 2
            : style.align === "right"
              ? w - pad - ww
              : pad);
      if (style.letterSpacing) {
        let cursor = xx;
        for (const ch of line) {
          nodes.push({
            ...text(
              cursor,
              yy + j * lh,
              measure(ch, size, style.bold),
              ch,
              size,
              style.color || "#231815",
              style.bold,
            ),
            tablePart: meta,
            source:
              meta?.rowId && meta.column !== undefined
                ? {
                    type: "event",
                    id: meta.rowId,
                    field: columns[meta.column]?.field || "name",
                  }
                : undefined,
          });
          cursor += measure(ch, size, style.bold) + style.letterSpacing;
        }
      } else
        nodes.push({
          ...text(
            xx,
            yy + j * lh,
            ww,
            line,
            size,
            style.color || "#231815",
            style.bold,
          ),
          tablePart: meta,
          source:
            meta?.rowId && meta.column !== undefined
              ? {
                  type: "event",
                  id: meta.rowId,
                  field: columns[meta.column]?.field || "name",
                }
              : undefined,
        });
    });
  }
  return segments.map((pageSegments, pageIndex) => {
    const nodes: Node[] = [],
      borders = new Map<string, { node: Node; priority: number }>();
    let y = o.y;
    const allRows = pageSegments.flatMap((g) => g.rows);
    if (s.title.scope !== "none") {
      const st = s.title.style,
        w = s.title.scope === "first" ? widths[0] : o.w;
      roundBox(nodes, o.x, y, w, s.title.height, st, { kind: "title" });
      words(
        nodes,
        o.x,
        y,
        w,
        s.title.height,
        measured(s.title.text, w, st),
        st,
      );
      y += titleH;
    }
    const header = (x: number, yy: number) => {
      let xx = x;
      columns.forEach((c, ci) => {
        const st = mergedStyle(s.base, s.header, s.headerColumns?.[ci]);
        const r = corners(st.corners || o.corners || o.radius);
        if (ci > 0) r.topLeft = 0;
        if (ci < count - 1) r.topRight = 0;
        r.bottomLeft = r.bottomRight = 0;
        roundBox(
          nodes,
          xx,
          yy,
          widths[ci],
          headH,
          { ...st, corners: r },
          { kind: "header", column: ci },
        );
        words(
          nodes,
          xx,
          yy,
          widths[ci],
          headH,
          measured(c.label, widths[ci], st),
          st,
        );
        xx += widths[ci] + s.columnGap;
      });
    };
    if (!card) {
      header(o.x, y);
      y += headH;
    }
    const renderRows = (
      rows: Row[],
      x: number,
      top: number,
      groupKey: string,
    ) => {
      const yy = rows.map(
        (r, i) =>
          top + rows.slice(0, i).reduce((a, b) => a + b.height + s.rowGap, 0),
      );
      const covered = new Set<string>();
      rows.forEach((row, ri) => {
        let xx = x;
        columns.forEach((c, ci) => {
          const cellKey = `${ri}:${ci}`;
          if (covered.has(cellKey)) {
            xx += widths[ci] + s.columnGap;
            return;
          }
          let rs = 1,
            cs = 1,
            value = fieldValue(row.e, c.field);
          const rule = s.merge.find((m) => m.column === ci);
          const span = s.spans.find((a) => {
            const start = es.findIndex((e) => e.id === a.rowId);
            return (
              start >= 0 &&
              ci >= a.column &&
              ci < a.column + a.colSpan &&
              row.index >= start &&
              row.index < start + a.rowSpan
            );
          });
          if (span) {
            const start = es.findIndex((e) => e.id === span.rowId);
            if (ci !== span.column) {
              xx += widths[ci] + s.columnGap;
              return;
            }
            cs = Math.min(span.colSpan, count - ci);
            rs = rows
              .slice(ri)
              .findIndex((a) => a.index >= start + span.rowSpan);
            if (rs < 0) rs = rows.length - ri;
            if (rs === 0) rs = 1;
            value = fieldValue(es[start], c.field);
          } else if (rule && !row.part) {
            while (
              ri + rs < rows.length &&
              fieldValue(rows[ri + rs].e, rule.key) ===
                fieldValue(row.e, rule.key) &&
              (!rule.withinGroup ||
                fieldValue(rows[ri + rs].e, "building") ===
                  fieldValue(row.e, "building")) &&
              !rows[ri + rs].part
            )
              rs++;
          }
          for (let rr = ri; rr < ri + rs; rr++)
            for (let cc = ci; cc < ci + cs; cc++) covered.add(`${rr}:${cc}`);
          const ww =
              widths.slice(ci, ci + cs).reduce((a, b) => a + b, 0) +
              s.columnGap * (cs - 1),
            hh =
              rows.slice(ri, ri + rs).reduce((a, r) => a + r.height, 0) +
              s.rowGap * (rs - 1),
            st = cellStyle(s, row.e.id, row.index, ci);
          const r = corners(st.corners || 0),
            outer = corners(o.corners || o.radius);
          const isLast = rows[ri + rs - 1] === allRows.at(-1);
          if (ri === 0 && pageIndex === 0 && headH === 0) {
            if (ci === 0) r.topLeft = outer.topLeft;
            if (ci + cs === count) r.topRight = outer.topRight;
          }
          if (isLast) {
            if (ci === 0) r.bottomLeft = outer.bottomLeft;
            if (ci + cs === count) r.bottomRight = outer.bottomRight;
          }
          const meta: TableTarget = {
            kind: "cell",
            rowId: row.e.id,
            rowIndex: row.index,
            column: ci,
            groupKey,
            rowSpan: rs,
            colSpan: cs,
          };
          roundBox(nodes, xx, yy[ri], ww, hh, { ...st, corners: r }, meta);
          const ls = rs > 1 || cs > 1 ? measured(value, ww, st) : row.lines[ci];
          words(nodes, xx, yy[ri], ww, hh, ls, st, meta);
          if (s.leader.type !== "none" && ci < count) {
            const pad = st.padding ?? o.padding,
              by = yy[ri] + hh - 0.6,
              start = xx + pad + s.leaderInset,
              end = xx + ww - pad - s.leaderInset;
            if (end > start)
              nodes.push({
                kind: "path",
                x: start,
                y: by,
                w: end - start,
                h: 0.1,
                d: `M ${start} ${by} L ${end} ${by}`,
                fill: "none",
                stroke: s.leader.color,
                strokeWidth: s.leader.width,
                dash: dash(s.leader),
                lineCap: s.leader.type === "dotted" ? "round" : "butt",
                tablePart: { ...meta, kind: "border" },
              });
          }
          for (const side of ["top", "right", "bottom", "left"] as const) {
            const b = st.border?.[side];
            if (!b) continue;
            const x1 = xx + (side === "right" ? ww : 0),
              y1 = yy[ri] + (side === "bottom" ? hh : 0),
              x2 = xx + (side === "left" ? 0 : ww),
              y2 = yy[ri] + (side === "top" ? 0 : hh);
            const key = [x1, y1, x2, y2].map((v) => v.toFixed(4)).join(":");
            const priority = s.cells[`${row.e.id}:${ci}`]?.border?.[side]
              ? 3
              : s.columns[ci]?.border?.[side] ||
                  s.rows[row.e.id]?.border?.[side]
                ? 2
                : 1;
            const old = borders.get(key);
            if (!old || priority >= old.priority)
              borders.set(key, {
                priority,
                node: {
                  kind: "path",
                  x: Math.min(x1, x2),
                  y: Math.min(y1, y2),
                  w: Math.abs(x2 - x1),
                  h: Math.abs(y2 - y1),
                  d: `M ${x1} ${y1} L ${x2} ${y2}`,
                  fill: "none",
                  stroke: b.type === "none" ? "none" : b.color,
                  strokeWidth: b.width,
                  dash: dash(b),
                  lineCap: b.type === "dotted" ? "round" : "butt",
                  tablePart: { ...meta, kind: "border" },
                },
              });
          }
          xx += widths[ci] + s.columnGap;
        });
      });
    };
    for (const segment of pageSegments) {
      const hh =
        segment.rows.reduce((a, r) => a + r.height + s.rowGap, 0) - s.rowGap;
      if (card) {
        const gs = { ...s.group, ...s.groups[segment.key] },
          frameH = Math.max(
            hh + 8,
            labelHeight(segment.key, segment.continued),
          ),
          meta: TableTarget = { kind: "group", groupKey: segment.key };
        if (gs.shadow)
          roundBox(nodes, o.x + gs.shadow, y + gs.shadow, o.w, frameH, {
            fill: gs.stroke || "#808080",
            corners: gs.corners,
          });
        roundBox(
          nodes,
          o.x,
          y,
          o.w,
          frameH,
          gs,
          meta,
          gs.stroke,
          gs.strokeWidth,
        );
        const st = labelStyle(segment.key);
        words(
          nodes,
          o.x + 1,
          y + 3,
          s.groupLabelWidth,
          frameH - 6,
          labelLines(segment.key, segment.continued),
          st,
        );
        nodes.push({
          ...rect(o.x, y, s.groupLabelWidth, frameH, "none"),
          tablePart: { kind: "groupLabel", groupKey: segment.key },
        });
        renderRows(segment.rows, o.x + leftPad, y + 4, segment.key);
        y += frameH + s.groupGap;
      } else {
        renderRows(segment.rows, o.x, y, segment.key);
        y += hh + s.rowGap;
      }
    }
    nodes.push(...collapseBorders([...borders.values()]));
    if (!allRows.length)
      nodes.push(
        text(
          o.x + 2,
          y + 3,
          o.w - 4,
          "企画を登録すると行が追加されます。",
          3,
          "#808080",
        ),
      );
    return nodes;
  });
}
