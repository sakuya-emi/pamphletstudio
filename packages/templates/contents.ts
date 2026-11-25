import {
  rect,
  text,
  type Context,
  type Node,
  type LayoutPage,
} from "../layout-engine/types";
export const contentsRows = 18;
export function headingEntries(pages: LayoutPage[]) {
  let previous = "";
  return pages.filter((page) => {
    if (["cover", "back", "contents", "blank"].includes(page.template))
      return false;
    const heading = (page.heading ?? page.title).trim();
    if (!heading || heading === previous) return false;
    previous = heading;
    return true;
  });
}
export function contents(
  c: Context,
  pages: LayoutPage[],
  offset: number,
): Node[] {
  const { project: p, left: x, width: w } = c;
  const entries = headingEntries(pages);
  const n: Node[] = [];
  entries.slice(offset, offset + contentsRows).forEach((page, i) => {
    const y = 33 + i * 8.6,
      heading = page.heading ?? page.title;
    const size = Math.min(
      4,
      (4 * (w - 22)) / Math.max(w - 22, c.measure(heading, 4, true)),
    );
    n.push(
      rect(
        x,
        y + 1,
        2,
        4,
        p.chapters.find((ch) => ch.id === page.chapterId)?.color ||
          p.theme.accent,
      ),
    );
    n.push({
      ...text(x + 6, y, w - 22, heading, size, p.theme.ink, true),
      source: { type: "block", id: page.blockId, field: "title" },
    });
    n.push(
      text(x + w - 13, y, 13, String(page.number ?? "—"), 4, p.theme.ink, true),
    );
    n.push(rect(x + 6, y + 6.8, w - 6, 0.15, "#dddcd6"));
  });
  return n;
}
