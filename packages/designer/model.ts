import { tabPath } from "./tab-path";
import { validateTable } from "./table-validation";
import { corners, validCorners, type CornerRadius } from "./corners";
import type { TableStyle } from "./table-model";
import { uid, type Template, type AdSize } from "../core/model";
export type ObjectKind =
  | "rect"
  | "ellipse"
  | "line"
  | "path"
  | "text"
  | "image"
  | "table"
  | "index"
  | "posters"
  | "timetable";
export type Binding =
  | "block.body"
  | "page.title"
  | "none"
  | "event.name"
  | "event.group"
  | "event.place"
  | "event.poster"
  | "advertisement"
  | "page.number"
  | "chapter.name"
  | "project.festival"
  | "project.date";
export interface Anchor {
  x: number;
  y: number;
  in?: { x: number; y: number };
  out?: { x: number; y: number };
}
export interface DesignLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}
export interface TableColumn {
  label: string;
  field:
    | "name"
    | "group"
    | "building"
    | "floor"
    | "room"
    | "location"
    | "place"
    | "placeShort";
  weight: number;
}
export type RepeatRole =
  "staffName" | "kitchenName" | "kitchenMenu" | "kitchenPhoto";
export interface DesignObject {
  repeatRole?: RepeatRole;
  visible?: boolean;
  locked?: boolean;
  eventSource?: "stage";
  spread?: boolean;
  verticalText?: boolean;
  tickMinutes?: number;
  studentStageColor?: string;
  id: string;
  name: string;
  kind: ObjectKind;
  layerId: string;
  groupId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  radius: number;
  corners?: CornerRadius;
  cornersLinked?: boolean;
  tableStyle?: TableStyle;
  templateRef?: string;
  localOverrides?: Partial<DesignObject>;
  tabShape?: "rect" | "rounded" | "outer" | "top" | "bottom" | "slant" | "path";
  tabPath?: string;
  tabTextColor?: string;
  useChapterColors?: boolean;
  tabStyles?: Record<string, Partial<DesignObject>>;
  inactiveFill?: string;
  dash?: number[];
  size: number;
  bold: boolean;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
  /** Only for text bound to block.body; each nonempty line is a separate editable item. */
  listMarker?: "disc" | "dash" | "number";
  bulletIndent?: number;
  text: string;
  binding: Binding;
  assetId?: string;
  adSize?: AdSize;
  anchors?: Anchor[];
  closed?: boolean;
  columns?: TableColumn[];
  rowHeight: number;
  headerHeight: number;
  padding: number;
  alternate: string;
  headerFill: string;
  headerColor: string;
  groupBuildings: boolean;
  cols: number;
  rows: number;
  gap: number;
  vertical: boolean;
  inactiveOpacity: number;
  mirror: boolean;
  itemsPerPage: number;
}
export type TemplateScope = "page" | "component" | "master" | "style";
export interface ComponentInstance {
  id: string;
  kind: ObjectKind;
  templateId: string;
  targetObjectId?: string;
  placement: { x: number; y: number; w: number; h: number };
  overrides?: Partial<DesignObject>;
}
export interface DesignTemplate {
  sharedSource?: { id: string; version: number };
  scope?: TemplateScope;
  componentKind?: ObjectKind;
  category?: string;
  thumbnail?: string;
  runtimeOverrides?: ComponentInstance[];
  constraints?: { flow: "repeat" | "fixed"; keepGroups?: boolean };
  id: string;
  name: string;
  kind: Template;
  version: number;
  createdAt: string;
  updatedAt: string;
  objects: DesignObject[];
  layers: DesignLayer[];
  masterId?: string;
  background: string;
  grid: number;
  snap: boolean;
  guidesX: number[];
  guidesY: number[];
}
export function object(
  kind: ObjectKind,
  layerId: string,
  x = 15,
  y = 25,
  w = 40,
  h = 25,
): DesignObject {
  return {
    id: uid(),
    name: {
      rect: "長方形",
      ellipse: "楕円",
      line: "直線",
      path: "パス",
      text: "テキスト",
      image: "画像枠",
      table: "企画一覧表",
      index: "サイドインデックス",
      posters: "ポスター繰り返し",
      timetable: "タイムテーブル",
    }[kind],
    kind,
    layerId,
    x,
    y,
    w,
    h,
    rotation: 0,
    fill: kind === "line" || kind === "path" ? "none" : "#e9e6dc",
    stroke: "#285b48",
    strokeWidth: 0.3,
    opacity: 1,
    radius: 0,
    size: 3.2,
    bold: false,
    lineHeight: 1.5,
    textAlign: "left",
    text: "テキストを入力",
    binding: "none",
    adSize: "quarter",
    rowHeight: 8,
    headerHeight: 8,
    padding: 2,
    alternate: "#f3f4ef",
    headerFill: "#285b48",
    headerColor: "#ffffff",
    groupBuildings: true,
    columns: [
      { label: "企画名", field: "name", weight: 43 },
      { label: "団体名", field: "group", weight: 31 },
      { label: "場所", field: "place", weight: 26 },
    ],
    cols: 2,
    rows: 2,
    gap: 5,
    vertical: true,
    inactiveOpacity: 0.55,
    mirror: true,
    itemsPerPage: 6,
  };
}
export function createDesign(
  kind: Template = "notice",
  name = "新しいデザイン",
): DesignTemplate {
  const layerId = uid(),
    t: DesignTemplate = {
      id: uid(),
      name,
      kind,
      version: 1,
      scope: "page",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      objects: [],
      layers: [
        { id: layerId, name: "レイヤー1", visible: true, locked: false },
      ],
      background: "#ffffff",
      grid: 2,
      snap: true,
      guidesX: [12, 138],
      guidesY: [20, 198],
    };
  const title = object("text", layerId, 15, 9, 120, 10);
  Object.assign(title, {
    text:
      kind === "events"
        ? "企画一覧"
        : kind === "posters"
          ? "学生企画"
          : kind === "notice"
            ? "お知らせ"
            : "タイムテーブル",
    fill: "#231815",
    stroke: "none",
    size: 5.2,
    bold: true,
  });
  t.objects.push(title);
  if (kind === "events")
    t.objects.push(object("table", layerId, 12, 24, 126, 173));
  if (kind === "posters") {
    t.objects.push(object("posters", layerId, 12, 24, 126, 123));
    const ad = object("image", layerId, 12.5, 153, 125, 45);
    ad.binding = "advertisement";
    ad.name = "1/4ページ協賛広告";
    t.objects.push(ad);
  }
  const folio = object("text", layerId, 133, 203, 10, 5);
  Object.assign(folio, {
    text: "ページ番号",
    binding: "page.number",
    fill: "#231815",
    stroke: "none",
    size: 3.2,
  });
  t.objects.push(folio);
  return t;
}
export function validateDesign(value: unknown): DesignTemplate {
  if (!value || typeof value !== "object")
    throw new Error("テンプレート形式が不正です。");
  const t = value as DesignTemplate;
  if (
    typeof t.id !== "string" ||
    typeof t.name !== "string" ||
    ![
      "notice",
      "events",
      "posters",
      "cover",
      "contents",
      "stage",
      "staff",
      "kitchen",
      "ads",
      "back",
    ].includes(t.kind) ||
    !Number.isInteger(t.version) ||
    t.version < 1 ||
    !Array.isArray(t.objects) ||
    !Array.isArray(t.layers) ||
    !t.layers.length ||
    t.layers.length > 100 ||
    t.objects.length > 1000
  )
    throw new Error("テンプレートの構造・件数が不正です。");
  if (t.scope && !["page", "component", "master", "style"].includes(t.scope))
    throw new Error("テンプレートの分類が不正です。");
  if (
    t.scope === "component" &&
    (!t.componentKind ||
      t.objects.length !== 1 ||
      t.objects[0].kind !== t.componentKind)
  )
    throw new Error("部品テンプレートは対象部品1個で構成してください。");
  const color = (v: unknown) =>
    v === "none" || (typeof v === "string" && /^#[\da-f]{6}$/i.test(v));
  if (
    !color(t.background) ||
    t.background === "none" ||
    !Number.isFinite(t.grid) ||
    t.grid < 0.5 ||
    t.grid > 20 ||
    !Array.isArray(t.guidesX) ||
    !Array.isArray(t.guidesY) ||
    [...t.guidesX, ...t.guidesY].some(
      (n) => !Number.isFinite(n) || n < 0 || n > 210,
    )
  )
    throw new Error("グリッド・ガイド・背景が不正です。");
  const ids = new Set<string>();
  for (const l of t.layers)
    if (
      !l ||
      typeof l.id !== "string" ||
      typeof l.name !== "string" ||
      typeof l.visible !== "boolean" ||
      typeof l.locked !== "boolean"
    )
      throw new Error("レイヤーが不正です。");
  for (const o of t.objects) {
    if (o?.spread !== undefined && typeof o.spread !== "boolean")
      throw new Error("見開き設定が不正です。");
    if (o && o.corners !== undefined && !validCorners(o.corners))
      throw new Error("四隅の角丸が不正です。");
    if (o?.tabShape === "path" && o.tabPath) tabPath(o.tabPath, 0, 0, 1, 1);
    if (o?.templateRef && typeof o.templateRef !== "string")
      throw new Error("部品参照が不正です。");
    if (o) {
      if (o.lineHeight === undefined) o.lineHeight = 1.5;
      if (o.textAlign === undefined) o.textAlign = "left";
      if (
        !Number.isFinite(o.lineHeight) ||
        o.lineHeight < 1 ||
        o.lineHeight > 3 ||
        !["left", "center", "right"].includes(o.textAlign)
      )
        throw new Error("文字スタイルが不正です。");
    }
    if (o && o.headerHeight === undefined) o.headerHeight = o.rowHeight;
    if (
      !o ||
      typeof o.id !== "string" ||
      ids.has(o.id) ||
      !t.layers.some((l) => l.id === o.layerId) ||
      ![
        "rect",
        "ellipse",
        "line",
        "path",
        "text",
        "image",
        "table",
        "index",
        "posters",
        "timetable",
      ].includes(o.kind)
    )
      throw new Error("オブジェクトが不正です。");
    if (
      o.repeatRole !== undefined &&
      !(
        t.constraints?.flow === "repeat" &&
        (!t.scope || t.scope === "page") &&
        ((t.kind === "staff" &&
          o.repeatRole === "staffName" &&
          o.kind === "text") ||
          (t.kind === "kitchen" &&
            (((o.repeatRole === "kitchenName" ||
              o.repeatRole === "kitchenMenu") &&
              o.kind === "text") ||
              (o.repeatRole === "kitchenPhoto" && o.kind === "image"))))
      )
    )
      throw new Error("繰り返し項目がテンプレートの種類と一致しません。");
    if (o.tableStyle) validateTable(o.tableStyle, o.columns?.length || 0);
    ids.add(o.id);
    for (const key of [
      "x",
      "y",
      "w",
      "h",
      "rotation",
      "strokeWidth",
      "opacity",
      "size",
      "radius",
      "rowHeight",
      "headerHeight",
      "padding",
      "cols",
      "rows",
      "gap",
      "inactiveOpacity",
      "itemsPerPage",
    ] as const)
      if (!Number.isFinite(o[key]))
        throw new Error("オブジェクトの数値が不正です。");
    if (
      Math.abs(o.x) > 2000 ||
      Math.abs(o.y) > 2000 ||
      o.w < 0.2 ||
      o.h < 0.2 ||
      o.w > 2000 ||
      o.h > 2000 ||
      o.size < 1 ||
      o.size > 30 ||
      o.opacity < 0 ||
      o.opacity > 1 ||
      o.inactiveOpacity < 0 ||
      o.inactiveOpacity > 1 ||
      o.radius < 0 ||
      o.radius > 100 ||
      o.strokeWidth < 0 ||
      o.strokeWidth > 10 ||
      o.padding < 0 ||
      o.padding > 10 ||
      o.rowHeight < 2 ||
      o.rowHeight > 50 ||
      o.cols < 1 ||
      o.cols > 6 ||
      o.rows < 1 ||
      o.rows > 8 ||
      o.gap < 0 ||
      o.gap > 20 ||
      o.itemsPerPage < 1 ||
      o.itemsPerPage > 24 ||
      !color(o.fill) ||
      !color(o.stroke) ||
      !color(o.alternate) ||
      !color(o.headerFill) ||
      !color(o.headerColor) ||
      typeof o.text !== "string" ||
      ![
        "none",
        "event.name",
        "event.group",
        "event.place",
        "event.poster",
        "advertisement",
        "page.number",
        "page.title",
        "block.body",
        "chapter.name",
        "project.festival",
        "project.date",
      ].includes(o.binding)
    )
      throw new Error(
        "オブジェクトの寸法・スタイル・バインディングが不正です。",
      );
    if (o.headerHeight < 3 || o.headerHeight > 50)
      throw new Error("表の見出し高さが不正です。");
    if (o.kind === "table" && o.columns?.length) {
      const minHeight =
        Math.max(o.headerHeight, 2 * o.padding + o.size * 1.4) +
        Math.max(o.rowHeight, 2 * o.padding + o.size * 1.5);
      if (
        o.h < minHeight ||
        o.columns.some(
          (c) =>
            (o.w * c.weight) / o.columns!.reduce((s, a) => s + a.weight, 0) <
            2 * o.padding + o.size,
        )
      )
        throw new Error("表の枠が小さすぎます。高さか列幅を広げてください。");
    }
    if (
      !Number.isInteger(o.cols) ||
      !Number.isInteger(o.rows) ||
      !Number.isInteger(o.itemsPerPage)
    )
      throw new Error("列・行・掲載件数は整数にしてください。");
    if (
      o.kind === "timetable" &&
      (o.h < 14 + o.size * 1.4 ||
        o.w / (o.vertical ? 1 : o.itemsPerPage) < 2 * o.padding + o.size)
    )
      throw new Error("タイムテーブルの枠が小さすぎます。");
    if (
      o.kind === "posters" &&
      ((o.w - (o.cols - 1) * o.gap) / o.cols < 5 ||
        (o.h - (o.rows - 1) * o.gap) / o.rows < 14)
    )
      throw new Error("ポスター枠の行列・間隔を調整してください。");
    if (o.adSize && !["full", "half", "quarter"].includes(o.adSize))
      throw new Error("広告規格が不正です。");
    if (
      o.kind === "path" &&
      (!o.anchors ||
        o.anchors.length < 2 ||
        o.anchors.length > 200 ||
        o.anchors.some((a) =>
          [
            a.x,
            a.y,
            a.in?.x ?? 0,
            a.in?.y ?? 0,
            a.out?.x ?? 0,
            a.out?.y ?? 0,
          ].some((v) => !Number.isFinite(v) || Math.abs(v) > 10),
        ))
    )
      throw new Error("パスのアンカーが不正です。");
    if (
      o.kind === "table" &&
      (!o.columns?.length ||
        o.columns.length > 8 ||
        o.columns.some(
          (c) =>
            ![
              "name",
              "placeShort",
              "group",
              "building",
              "floor",
              "room",
              "location",
              "place",
            ].includes(c.field) ||
            typeof c.label !== "string" ||
            !Number.isFinite(c.weight) ||
            c.weight <= 0,
        ))
    )
      throw new Error("表の列設定が不正です。");
    if (
      ["table", "posters", "timetable", "index"].includes(o.kind) &&
      o.rotation !== 0
    )
      throw new Error("自動組版コンポーネントの回転には対応していません。");
  }
  if (
    t.objects.filter((o) => ["table", "posters", "timetable"].includes(o.kind))
      .length > 1
  )
    throw new Error("自動改ページコンポーネントは1テンプレートに1個までです。");
  return t;
}
