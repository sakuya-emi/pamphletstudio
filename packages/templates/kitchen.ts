import { menus } from "../core/registration";
import {
  text,
  rect,
  wrap,
  type Context,
  type Node,
} from "../layout-engine/types";
export function kitchenPages(c: Context): Node[][] {
  const p = c.project,
    cards: {
      event: ProjectEvent;
      lines: { text: string; menuId: string }[];
      continued: boolean;
    }[] = [];
  type ProjectEvent = (typeof p.events)[number];
  for (const e of p.events.filter(
    (e) => e.category === "kitchen" && e.published !== false,
  )) {
    const lines = menus(p, e.id).flatMap((m) => [
      ...wrap(m.name, c.width * 0.5, 3.2, c.measure).map((s) => ({
        text: s,
        menuId: m.id,
      })),
      { text: "", menuId: m.id },
    ]);
    if (!lines.length) cards.push({ event: e, lines: [], continued: false });
    for (let at = 0; at < lines.length; at += 13)
      cards.push({
        event: e,
        lines: lines.slice(at, at + 13),
        continued: at > 0,
      });
  }
  const pages: Node[][] = [];
  for (let i = 0; i < cards.length; i += 2) {
    const n: Node[] = [];
    cards.slice(i, i + 2).forEach(({ event: e, lines, continued }, j) => {
      const y = 25 + j * 85;
      n.push(rect(c.left, y, c.width, 0.3, p.theme.accent));
      wrap(e.name + (continued ? "（続き）" : ""), c.width, 4, c.measure, true)
        .slice(0, 2)
        .forEach((s, k) =>
          n.push({
            ...text(c.left, y + 3 + k * 5, c.width, s, 4, p.theme.ink, true),
            source: { type: "event", id: e.id, field: "name" },
          }),
        );
      if (e.assetId)
        n.push({
          kind: "asset",
          assetId: e.assetId,
          x: c.left,
          y: y + 15,
          w: c.width * 0.44,
          h: 61,
          source: { type: "event", id: e.id, field: "assetId" },
        });
      lines.forEach((line, k) => {
        if (line.text)
          n.push({
            ...text(
              c.left + c.width * 0.48,
              y + 15 + k * 4.5,
              c.width * 0.5,
              line.text,
              3.2,
              p.theme.ink,
            ),
            source: { type: "kitchenMenu", id: line.menuId, field: "name" },
          });
      });
    });
    pages.push(n);
  }
  return pages;
}
