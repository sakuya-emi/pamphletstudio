import { listingEvents } from "../core/model";
import {
  rect,
  text,
  wrap,
  type Context,
  type Node,
} from "../layout-engine/types";
export function eventPages(c: Context): Node[][] {
  const { project: p, left: x, width: w, measure } = c;
  const size = p.theme.fontSize;
  const stage = ["stage", "studentStage"].includes(c.block.eventCategory ?? "");
  const events = listingEvents(p, c.block.eventCategory);
  if (stage)
    events.sort((a, b) =>
      (a.startTime || "99:99").localeCompare(b.startTime || "99:99", "en", {
        numeric: true,
      }),
    );
  const widths = [w * 0.43, w * 0.31, w * 0.26];
  const pages: Node[][] = [];
  let nodes: Node[] = [];
  let y = 0;
  const start = () => {
    nodes = [];
    y = 30;
    let xx = x;
    ["企画名", "団体名", stage ? "開始時刻" : "開催場所"].forEach((s, i) => {
      nodes.push(
        rect(
          xx,
          23,
          widths[i],
          7,
          p.chapters.find((a) => a.id === c.block.chapterId)?.color ||
            p.theme.accent,
        ),
      );
      nodes.push(text(xx + 2, 24.6, widths[i] - 4, s, size, "#ffffff", true));
      xx += widths[i];
    });
    pages.push(nodes);
  };
  start();
  let last = "";
  for (const e of events) {
    const building =
      e.category === "kitchen" ? "屋外" : e.building || "建物未設定";
    if (!stage && last !== building) {
      if (y + 14 > 195) start();
      nodes.push(rect(x, y, w, 7, "#f1f1ef"));
      nodes.push({
        ...text(x + 2, y + 1.6, w - 4, building, size, p.theme.ink, true),
        source: { type: "event", id: e.id, field: "building" },
      });
      y += 7;
      last = building;
    }
    const cells = [
      e.name,
      e.group,
      stage
        ? [e.startTime, e.endTime].filter(Boolean).join("〜")
        : e.category === "kitchen"
          ? "マップに記載"
          : `${e.floor !== undefined ? e.floor + "階 " : ""}${e.room}\n${e.location}`,
    ].map((s, i) => wrap(s, widths[i] - 4, size, measure));
    const max = Math.max(...cells.map((a) => a.length));
    let offset = 0;
    while (offset < max) {
      let available = Math.floor((195 - y - 4) / (size * p.theme.lineHeight));
      if (available < 1) {
        start();
        available = Math.floor((195 - y - 4) / (size * p.theme.lineHeight));
      }
      const take = Math.min(max - offset, available),
        h = take * size * p.theme.lineHeight + 4;
      let xx = x;
      cells.forEach((lines, i) => {
        nodes.push(rect(xx, y, widths[i], h, "#ffffff", "#deded9"));
        lines.slice(offset, offset + take).forEach((s, j) =>
          nodes.push({
            ...text(
              xx + 2,
              y + 2 + j * size * p.theme.lineHeight,
              widths[i] - 4,
              s,
              size,
              p.theme.ink,
              i === 0,
            ),
            source: {
              type: "event",
              id: e.id,
              field: ["name", "group", stage ? "startTime" : "place"][i],
            },
          }),
        );
        xx += widths[i];
      });
      y += h;
      offset += take;
      if (offset < max) start();
    }
  }
  if (!events.length)
    nodes.push({
      ...text(
        x + 3,
        39,
        w - 6,
        "企画を登録すると一覧表が生成されます。",
        size,
        p.theme.silver,
      ),
      editorOnly: true,
    });
  return pages;
}
