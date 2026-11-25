import type { Project } from "../core/model";
import { menus } from "../core/registration";
import { text, wrap, type Measure, type Node } from "../layout-engine/types";
import { adPlaceholder } from "../templates/ads";
import type { DesignObject } from "./model";

type Entry = { node: Node; object?: DesignObject };
type Page = Entry[];
const fit = (n: number, low: number, high: number) =>
  Math.min(high, Math.max(low, n));

function write(
  o: DesignObject,
  value: string,
  box: { x: number; y: number; w: number },
  measure: Measure,
  source?: Node["source"],
) {
  const size = fit(o.size, 1, 12);
  const step = size * fit(o.lineHeight ?? 1.5, 1, 3);
  const lines = wrap(value, box.w, size, measure, o.bold);
  return {
    h: step * Math.max(1, lines.length),
    entries: lines.map((line, i): Entry => ({
      object: o,
      node: {
        ...text(
          box.x +
            (o.textAlign === "center" ? 0.5 : o.textAlign === "right" ? 1 : 0) *
              Math.max(0, box.w - measure(line, size, o.bold)),
          box.y + i * step,
          box.w,
          line,
          size,
          o.fill,
          o.bold,
        ),
        source,
      },
    })),
  };
}

export function repeatPages(
  kind: "staff" | "kitchen",
  visible: DesignObject[],
  p: Project,
  measure: Measure,
): Page[] {
  const pages: Page[] = [[]];
  let page = pages[0];
  const find = (role: DesignObject["repeatRole"]) =>
    visible.find((o) => o.repeatRole === role);
  const top = (o?: DesignObject) => fit(o?.y ?? 30, 14, 135);
  if (kind === "staff") {
    const name = find("staffName");
    if (!name) return pages;
    const x = fit(name.x, 20, 94);
    const w = fit(name.w, 10, (140 - x - 4) / 2);
    const start = top(name);
    let y = start;
    const rank = (s: Project["staff"][number]) =>
      s.role === "実行委員長" ? 0 : s.role === "副実行委員長" ? 1 : 2;
    const people = p.staff
      .filter((s) => s.published !== false)
      .sort(
        (a, b) =>
          rank(a) - rank(b) ||
          b.grade - a.grade ||
          (a.kana || a.name).localeCompare(b.kana || b.name, "ja"),
      );
    const groups = new Map<string, typeof people>();
    for (const s of people) {
      const label =
        rank(s) < 2 ? s.role : s.grade > 0 ? s.grade + "年" : "学年未設定";
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(s);
    }
    for (const [label, members] of groups) {
      let showLabel = true;
      for (let i = 0; i < members.length; i += 2) {
        const row = members.slice(i, i + 2).map((s, col) =>
          write(name, s.name, { x: x + col * (w + 4), y: 0, w }, measure, {
            type: "staff",
            id: s.id,
            field: "name",
          }),
        );
        const step = fit(name.size, 1, 12) * fit(name.lineHeight ?? 1.5, 1, 3);
        const lineCount = Math.max(1, ...row.map((r) => r.entries.length));
        if (lineCount * step + 2 > 197 - y && y > start) {
          pages.push((page = []));
          y = start;
          showLabel = true;
        }
        for (let line = 0; line < lineCount; line++) {
          if (y + step > 197 && y > start) {
            pages.push((page = []));
            y = start;
            showLabel = true;
          }
          if (showLabel) {
            page.push({
              node: text(12, y, x - 13, label, 2.8, p.theme.ink, true),
            });
            showLabel = false;
          }
          for (const r of row) {
            const e = r.entries[line];
            if (e) page.push({ ...e, node: { ...e.node, y } });
          }
          y += step;
        }
        y += 2;
      }
      y += 4;
    }
  } else {
    const name = find("kitchenName"),
      menu = find("kitchenMenu"),
      photo = find("kitchenPhoto");
    const start = Math.min(
      ...[name, menu, photo].filter(Boolean).map(top),
      100,
    );
    let y = start;
    const box = (o: DesignObject) => {
      const x = fit(o.x, 5, 132);
      return { x, y: fit(o.y - start, 0, 60), w: fit(o.w, 8, 140 - x) };
    };
    const nameBox = name && box(name),
      menuBox = menu && box(menu),
      photoBox = photo && box(photo);
    for (const e of p.events.filter(
      (e) => e.category === "kitchen" && e.published !== false,
    )) {
      const title =
        name &&
        write(name, e.name, nameBox!, measure, {
          type: "event",
          id: e.id,
          field: "name",
        });
      const ph = photo && fit(photo.h, 8, 75);
      const list = menu
        ? menus(p, e.id).flatMap((m) => {
            const item = write(menu, m.name, { ...menuBox!, y: 0 }, measure, {
              type: "kitchenMenu",
              id: m.id,
              field: "name",
            });
            const step = item.h / Math.max(1, item.entries.length);
            return item.entries.map((entry) => ({ ...entry, step }));
          })
        : [];
      const photoBottom = photo && photoBox ? photoBox.y + ph! : 0;
      const titleLines = title ? title.entries : [];
      const titleStep = title ? title.h / Math.max(1, titleLines.length) : 0;
      let first = true,
        nameAt = 0,
        at = 0;
      do {
        let offset = first ? (nameBox?.y ?? 0) : 0;
        const firstText =
          nameAt < titleLines.length
            ? offset + titleStep
            : at < list.length
              ? (first ? (menuBox?.y ?? 0) : 0) + list[at].step
              : 0;
        if (
          y + Math.max(first ? photoBottom : 0, firstText) + 5 > 197 &&
          y > start
        ) {
          pages.push((page = []));
          y = start;
        }
        const append = (entry: Entry, offset: number) =>
          page.push({ ...entry, node: { ...entry.node, y: y + offset } });
        if (first && photo && photoBox && ph) {
          const frame = { ...photoBox, h: Math.min(ph, 197 - y - photoBox.y) };
          if (frame.h > 0) {
            if (e.assetId)
              append(
                {
                  object: photo,
                  node: {
                    kind: "asset",
                    assetId: e.assetId,
                    ...frame,
                    source: { type: "event", id: e.id, field: "assetId" },
                  },
                },
                frame.y,
              );
            else
              for (const node of adPlaceholder(
                { ...photo, ...frame },
                "画像未登録",
              ))
                append({ object: photo, node }, node.y);
          }
        }
        while (nameAt < titleLines.length && y + offset + titleStep <= 197) {
          append(titleLines[nameAt++], offset);
          offset += titleStep;
        }
        if (nameAt === titleLines.length && at < list.length) {
          offset = Math.max(first ? (menuBox?.y ?? 0) : 0, offset + 1);
          while (at < list.length && y + offset + list[at].step <= 197) {
            const { step, ...entry } = list[at++];
            append(entry, offset);
            offset += step;
          }
        }
        y += Math.max(first ? photoBottom : 0, offset) + 5;
        first = false;
        if (nameAt < titleLines.length || at < list.length) {
          pages.push((page = []));
          y = start;
        }
      } while (nameAt < titleLines.length || at < list.length);
    }
  }
  return pages;
}
