import { createDesign, object, type DesignTemplate } from "./model";
import { corners } from "./corners";
import { defaultTableStyle } from "./table-model";
export function tablePreset(
  variant: "stripe" | "cards" | "split",
  name?: string,
): DesignTemplate {
  const title = {
    stripe: "表A · ストライプ＋縦結合",
    cards: "表B · グループカード＋点線",
    split: "表C · 分割カラム＋結合セル",
  }[variant];
  const t = createDesign("events", name || title);
  t.scope = "component";
  t.componentKind = "table";
  t.constraints = { flow: "repeat" };
  const o = object("table", t.layers[0].id, 12, 23, 126, 174);
  o.name = title;
  o.corners = corners(3);
  o.cornersLinked = true;
  o.stroke = "none";
  o.size = 3;
  o.padding = 1;
  o.rowHeight = 6.6;
  o.headerHeight = 7;
  const s = defaultTableStyle();
  s.variant = variant;
  s.base = {
    fill: "#ffffff",
    color: "#231815",
    size: 3,
    padding: 1,
    lineHeight: 1.35,
    align: "center",
    valign: "center",
  };
  s.groupGap = 0;
  s.title.scope = "none";
  s.odd = {};
  s.even = {};
  if (variant === "stripe") {
    o.columns = [
      { label: "", field: "building", weight: 15 },
      { label: "場所", field: "placeShort", weight: 24 },
      { label: "企画名", field: "name", weight: 61 },
    ];
    s.merge = [{ column: 0, key: "building", withinGroup: true }];
    s.columns = {
      0: { fill: "#a9cede", bold: true },
      1: { fill: "#8bbdd3", alternate: "#77b2ce" },
      2: { fill: "#c7e1d2", alternate: "#a9d4c0" },
    };
    s.header = { fill: "#77b2ce", color: "#162c33", bold: true };
    s.headerColumns = { 2: { fill: "#a1d2bd" } };
  }
  if (variant === "cards") {
    o.columns = [
      { label: "企画名", field: "name", weight: 71 },
      { label: "場所", field: "placeShort", weight: 29 },
    ];
    o.size = 2.7;
    o.rowHeight = 5.5;
    o.padding = 0.6;
    s.base = {
      ...s.base,
      fill: "none",
      size: 2.7,
      padding: 0.6,
      align: "left",
      valign: "top",
      lineHeight: 1.4,
    };
    s.title = {
      text: "企画一覧",
      scope: "first",
      height: 12,
      style: {
        fill: "#7f9fc8",
        color: "#ffffff",
        size: 6,
        bold: true,
        padding: 3,
        corners: corners(5),
      },
    };
    s.groupGap = 3;
    s.groupLabelWidth = 24;
    s.group = {
      fill: "#ffffff",
      stroke: "#a3753c",
      strokeWidth: 0.35,
      shadow: 0.8,
      labelSize: 6,
      labelColor: "#a3753c",
      corners: corners(5),
    };
    s.groups = {
      本館: { stroke: "#a3753c", labelColor: "#a3753c" },
      FLOS館: { stroke: "#d56a99", labelColor: "#d56a99", labelSize: 4.5 },
      屋外: { stroke: "#69ae65", labelColor: "#69ae65" },
      キッチンカー: { stroke: "#efa95f", labelColor: "#efa95f", labelSize: 3 },
    };
    s.leader = { color: "#808080", width: 0.18, type: "dotted", gap: 0.65 };
  }
  if (variant === "split") {
    o.columns = [
      { label: "企画名", field: "name", weight: 49 },
      { label: "団体名", field: "group", weight: 27 },
      { label: "場所", field: "location", weight: 24 },
    ];
    o.size = 3.5;
    o.rowHeight = 10;
    o.headerHeight = 10;
    s.base = { ...s.base, size: 3.5, padding: 2, align: "left" };
    s.columnGap = 2;
    s.groupBy = "none";
    s.header = {
      fill: "#35b6d0",
      color: "#ffffff",
      size: 4,
      bold: true,
      align: "center",
    };
    s.odd = { fill: "#bfe5eb" };
    s.even = { fill: "#edf6f8" };
    s.columns = { 0: { bold: true }, 2: { align: "center", bold: true } };
    s.merge = [{ column: 2, key: "location", withinGroup: false }];
    s.title = {
      text: "模擬店",
      scope: "first",
      height: 14,
      style: {
        fill: "#35b6d0",
        color: "#ffffff",
        size: 6.5,
        bold: true,
        padding: 3,
        corners: { topLeft: 5, topRight: 5, bottomRight: 0, bottomLeft: 0 },
      },
    };
  }
  o.tableStyle = s;
  t.objects = [o];
  return t;
}
export function indexPreset(
  shape: NonNullable<import("./model").DesignObject["tabShape"]> = "outer",
): DesignTemplate {
  const t = createDesign(
    "notice",
    `インデックス · ${{ rect: "四角", rounded: "角丸", outer: "外側角丸", top: "上側角丸", bottom: "下側角丸", slant: "斜め", path: "自由パス" }[shape]}`,
  );
  t.scope = "component";
  t.componentKind = "index";
  t.objects = [object("index", t.layers[0].id, 140, 0, 8, 196)];
  Object.assign(t.objects[0], {
    radius: 3,
    corners: corners(3),
    tabShape: shape,
    gap: 0.6,
    size: 2.8,
    stroke: "none",
    useChapterColors: true,
    tabTextColor: "#231815",
  });
  return t;
}
export function textPreset(
  category: "見出し" | "ページ番号" | "本文" | "箇条書き",
  variant = 0,
): DesignTemplate {
  const t = createDesign(
    "notice",
    category + " · " + (variant ? "アクセント" : "標準"),
  );
  t.scope = "component";
  t.componentKind = "text";
  t.category = category;
  const o = object(
    "text",
    t.layers[0].id,
    category === "ページ番号" ? 133 : 15,
    category === "ページ番号" ? 203 : category === "見出し" ? 9 : 30,
    category === "ページ番号" ? 10 : 120,
    category === "見出し" ? 10 : category === "ページ番号" ? 5 : 160,
  );
  o.binding =
    category === "見出し"
      ? "page.title"
      : category === "ページ番号"
        ? "page.number"
        : "block.body";
  o.size = category === "見出し" ? 5.2 : 3.2;
  o.bold = category === "見出し";
  o.fill = variant ? "#a5713a" : "#231815";
  o.text = "";
  if (category === "箇条書き") {
    o.listMarker = "disc";
    o.bulletIndent = 5;
  }
  o.stroke = "none";
  o.mirror = category === "ページ番号";
  t.objects = [o];
  return t;
}
export function stagePreset(vertical = false) {
  const t = createDesign(
    "notice",
    vertical ? "ステージ · 縦時間軸" : "ステージ · 見開き横時間軸",
  );
  t.scope = "component";
  t.componentKind = "timetable";
  t.category = "タイムテーブル";
  const o = object("timetable", t.layers[0].id, 12, 25, 126, 168);
  Object.assign(o, {
    eventSource: "stage",
    vertical,
    verticalText: !vertical,
    spread: !vertical,
    itemsPerPage: 6,
    size: 3,
    tickMinutes: 60,
    headerFill: "#ec6c1f",
    alternate: "#c2c2c2",
    studentStageColor: "#c2c2c2",
    headerColor: "#231815",
    stroke: "#808080",
  });
  t.objects = [o];
  return t;
}
export function seedLibrary(existing: DesignTemplate[]): DesignTemplate[] {
  const names = new Set(existing.map((t) => t.name));
  return [
    ...(["見出し", "ページ番号", "本文", "箇条書き"] as const).flatMap((c) => [
      textPreset(c),
      textPreset(c, 1),
    ]),
    stagePreset(),
    stagePreset(true),
    tablePreset("stripe"),
    tablePreset("cards"),
    tablePreset("split"),
    indexPreset("outer"),
    indexPreset("slant"),
  ].filter((t) => !names.has(t.name));
}
