import { sortedSponsors, type Staff } from "../core/model";
import {
  text,
  rect,
  wrap,
  type Context,
  type Node,
} from "../layout-engine/types";

const roleRank = (s: Staff) =>
  s.role === "実行委員長" ? 0 : s.role === "副実行委員長" ? 1 : 2;
export function recordPages(c: Context, staff = false): Node[][] {
  const p = c.project;
  const ordered = [...p.staff]
    .filter((s) => s.published !== false)
    .sort(
      (a, b) =>
        roleRank(a) - roleRank(b) ||
        b.grade - a.grade ||
        (a.kana || a.name).localeCompare(b.kana || b.name, "ja"),
    );
  const groups = new Map<string, { id: string; name: string }[]>();
  if (staff)
    for (const person of ordered) {
      const label =
        roleRank(person) < 2
          ? person.role
          : person.grade > 0
            ? person.grade + "年"
            : "学年未設定";
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(person);
    }
  else groups.set("", sortedSponsors(p));
  const pages: Node[][] = [[]];
  const top = p.referenceDesign ? 33 : 25;
  let n = pages[0],
    y = top;
  const size = p.theme.fontSize;
  const labelWidth = staff ? 31 : 0;
  const column = (c.width - labelWidth - 4) / 2;
  const lineHeight = size * 1.5;
  for (const [label, people] of groups) {
    let needsLabel = staff;
    for (let i = 0; i < people.length; i += 2) {
      const row = people
        .slice(i, i + 2)
        .map((person) => ({
          person,
          lines: wrap(person.name, column - 2, size, c.measure),
        }));
      const h = Math.max(1, ...row.map((r) => r.lines.length)) * lineHeight + 2;
      if (y + h > 196 && y > top) {
        n = [];
        pages.push(n);
        y = top;
        needsLabel = staff;
      }
      if (needsLabel) {
        const w = Math.min(labelWidth - 3, c.measure(label, 2.9, true) + 6);
        n.push(rect(c.left, y, w, 5.2, "#f0f0ef", undefined, 2.6));
        n.push(
          text(c.left + 3, y + 0.75, w - 4, label, 2.9, p.theme.ink, true),
        );
        needsLabel = false;
      }
      row.forEach(({ person, lines }, j) =>
        lines.forEach((line, k) =>
          n.push({
            ...text(
              c.left + labelWidth + j * (column + 4),
              y + k * lineHeight,
              column - 2,
              line,
              size,
              p.theme.ink,
            ),
            source: {
              type: staff ? "staff" : "sponsor",
              id: person.id,
              field: "name",
            },
          }),
        ),
      );
      y += h;
    }
    y += staff ? 4 : 0;
  }
  return pages;
}
