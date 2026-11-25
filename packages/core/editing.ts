import { festivalDate } from "./festival-date";
import {
  setCategory,
  type EventCategory,
  setAdCompany,
  adCompany,
} from "./registration";
import { uid, type Project, type Event } from "./model";
export type DataSource = {
  type:
    | "kitchenMenu"
    | "event"
    | "sponsor"
    | "ad"
    | "chapter"
    | "block"
    | "project"
    | "staff"
    | "pageNumber";
  id: string;
  field: string;
};
/** A line reference keeps individual bullet edits linked to the original block.body. */
function bodyLineIndex(s: DataSource): number | undefined {
  const match = s.type === "block" && /^bodyLine:(\d+)$/.exec(s.field);
  return match ? Number(match[1]) : undefined;
}
export function readSource(p: Project, s: DataSource): string {
  if (s.type === "ad" && s.field === "companyName") return adCompany(p, s.id);
  const r = record(p, s);
  const index = bodyLineIndex(s);
  if (index !== undefined)
    return String(r?.body ?? "").split(/\r?\n/)[index] ?? "";
  return String(r?.[s.field] ?? "");
}
export function record(
  p: Project,
  s: DataSource,
): Record<string, unknown> | undefined {
  if (s.type === "project") return p as unknown as Record<string, unknown>;
  if (s.type === "pageNumber")
    return p.theme as unknown as Record<string, unknown>;
  const key = {
    kitchenMenu: "kitchenMenus",
    event: "events",
    sponsor: "sponsors",
    ad: "ads",
    chapter: "chapters",
    block: "blocks",
    staff: "staff",
  }[s.type] as "events";
  return p[key]?.find((r) => r.id === s.id) as unknown as Record<
    string,
    unknown
  >;
}
export function writeSource(p: Project, s: DataSource, value: string) {
  if (s.type === "project" && s.field === "date") {
    const parsed = festivalDate(value);
    p.date = parsed?.label ?? value;
    if (parsed) p.year = parsed.year;
    return;
  }
  if (s.type === "ad" && s.field === "companyName") {
    setAdCompany(p, s.id, value);
    return;
  }
  if (s.type === "event" && s.field === "category") {
    setCategory(p, s.id, value as EventCategory);
    return;
  }
  if (s.field === "id") throw new Error("IDは変更できません。");
  const r = record(p, s);
  if (!r) throw new Error("元の項目が見つかりません。");
  const line = bodyLineIndex(s);
  if (line !== undefined) {
    const lines = String(r.body ?? "").split(/\r?\n/);
    if (line >= lines.length) throw new Error("編集対象の項目がありません。");
    lines[line] = value;
    r.body = lines.join("\n");
    return;
  }
  if (["floor", "order", "grade", "edition", "year"].includes(s.field)) {
    if (value !== "" && !Number.isFinite(Number(value)))
      throw new Error("数値を入力してください。");
    r[s.field] = value === "" ? undefined : Number(value);
  } else if (["published", "visible"].includes(s.field))
    r[s.field] = !["false", "0", "非掲載", "非表示"].includes(value);
  else r[s.field] = value;
}
export const newEvent = (): Event => ({
  id: uid(),
  name: "新しい企画",
  group: "",
  building: "",
  room: "",
  location: "",
  category: "student",
  published: true,
});
/** RFC4180-style quoted delimited text, including embedded line breaks. */
export function parseDelimited(
  input: string,
  delimiter = input.includes("\t") ? "\t" : ",",
): string[][] {
  const rows: string[][] = [],
    row: string[] = [];
  let value = "",
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && c === delimiter) {
      row.push(value);
      value = "";
    } else if (!quoted && (c === "\n" || c === "\r")) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(value);
      rows.push(row.splice(0));
      value = "";
    } else value += c;
  }
  if (quoted) throw new Error("引用符が閉じていません。");
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}
export function delimited(rows: string[][], delimiter = ",") {
  return rows
    .map((r) =>
      r
        .map((v) =>
          /["\r\n,\t]/.test(v) ? '"' + v.replaceAll('"', '""') + '"' : v,
        )
        .join(delimiter),
    )
    .join("\r\n");
}
