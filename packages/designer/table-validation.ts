import type { TableStyle, CellStyle } from "./table-model";
import { validCorners } from "./corners";
const color = (v: unknown) =>
  v === undefined ||
  v === "none" ||
  (typeof v === "string" && /^#[a-f0-9]{6}$/i.test(v));
export function validateTable(s: TableStyle, columns: number) {
  if (
    !s ||
    !["grid", "stripe", "cards", "split"].includes(s.variant) ||
    !s.base ||
    !s.header ||
    !s.odd ||
    !s.even ||
    !s.columns ||
    !s.rows ||
    !s.cells ||
    !s.groups ||
    !Array.isArray(s.merge) ||
    !Array.isArray(s.spans) ||
    !s.title ||
    !s.group ||
    !s.leader
  )
    throw new Error("表スタイルの構造が不正です。");
  for (const key of [
    "rowGap",
    "columnGap",
    "groupGap",
    "groupLabelWidth",
  ] as const)
    if (!Number.isFinite(s[key]) || s[key] < 0 || s[key] > 50)
      throw new Error("表の間隔が不正です。");
  if (
    ![
      "none",
      "name",
      "group",
      "building",
      "floor",
      "room",
      "location",
      "place",
      "placeShort",
    ].includes(s.groupBy) ||
    !["none", "first", "all"].includes(s.title.scope) ||
    typeof s.title.text !== "string" ||
    !Number.isFinite(s.title.height) ||
    s.title.height < 3 ||
    s.title.height > 50
  )
    throw new Error("表のグループ・見出しが不正です。");
  const styles = [
    s.base,
    s.header,
    s.odd,
    s.even,
    s.title.style,
    s.group,
    ...Object.values(s.columns),
    ...Object.values(s.headerColumns || {}),
    ...Object.values(s.rows),
    ...Object.values(s.cells),
    ...Object.values(s.groups),
  ];
  if (styles.length > 10000)
    throw new Error("セルスタイルの件数が多すぎます。");
  for (const st of styles) {
    if (
      !st ||
      !color(st.fill) ||
      !color(st.color) ||
      !color(st.alternate) ||
      (st.corners !== undefined && !validCorners(st.corners))
    )
      throw new Error("セルの色・角丸が不正です。");
    for (const [k, min, max] of [
      ["size", 1, 30],
      ["padding", 0, 10],
      ["lineHeight", 1, 3],
      ["letterSpacing", 0, 3],
    ] as const) {
      if (
        st[k] !== undefined &&
        (!Number.isFinite(st[k]) || st[k]! < min || st[k]! > max)
      )
        throw new Error("セルの文字寸法が不正です。");
    }
    if (
      (st.align && !["left", "center", "right"].includes(st.align)) ||
      (st.valign && !["top", "center", "bottom"].includes(st.valign))
    )
      throw new Error("セルの文字揃えが不正です。");
    for (const b of Object.values(st.border || {})) {
      if (
        !b ||
        !color(b.color) ||
        !["solid", "dotted", "dashed", "none"].includes(b.type) ||
        !Number.isFinite(b.width) ||
        b.width < 0 ||
        b.width > 5 ||
        (b.gap !== undefined &&
          (!Number.isFinite(b.gap) || b.gap < 0.05 || b.gap > 20))
      )
        throw new Error("罫線が不正です。");
    }
  }
  for (const gs of [s.group, ...Object.values(s.groups)]) {
    if (!color(gs.stroke) || !color(gs.labelColor))
      throw new Error("グループの色が不正です。");
    for (const [k, max] of [
      ["strokeWidth", 5],
      ["shadow", 10],
      ["labelSize", 30],
    ] as const)
      if (
        gs[k] !== undefined &&
        (!Number.isFinite(gs[k]) || gs[k]! < 0 || gs[k]! > max)
      )
        throw new Error("グループの寸法が不正です。");
  }
  if (
    !Number.isFinite(s.leaderInset) ||
    s.leaderInset < 0 ||
    s.leaderInset > 50 ||
    (s.leader.gap !== undefined &&
      (!Number.isFinite(s.leader.gap) ||
        s.leader.gap < 0.05 ||
        s.leader.gap > 20))
  )
    throw new Error("リーダー線の間隔が不正です。");
  if (
    !color(s.leader.color) ||
    !Number.isFinite(s.leader.width) ||
    s.leader.width < 0 ||
    s.leader.width > 5 ||
    !["solid", "dotted", "dashed", "none"].includes(s.leader.type)
  )
    throw new Error("リーダー線が不正です。");
  for (const m of s.merge)
    if (
      !Number.isInteger(m.column) ||
      m.column < 0 ||
      m.column >= columns ||
      ![
        "name",
        "group",
        "building",
        "floor",
        "room",
        "location",
        "place",
        "placeShort",
      ].includes(m.key)
    )
      throw new Error("自動セル結合が不正です。");
  for (const m of s.spans)
    if (
      typeof m.rowId !== "string" ||
      !Number.isInteger(m.column) ||
      !Number.isInteger(m.rowSpan) ||
      !Number.isInteger(m.colSpan) ||
      m.column < 0 ||
      m.rowSpan < 1 ||
      m.rowSpan > 10000 ||
      m.colSpan < 1 ||
      m.column + m.colSpan > columns
    )
      throw new Error("セル結合範囲が不正です。");
}
