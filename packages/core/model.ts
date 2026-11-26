import type { DesignTemplate } from "../designer/model";
export type Template =
  | "cover"
  | "contents"
  | "events"
  | "posters"
  | "ads"
  | "notice"
  | "back"
  | "sponsors"
  | "staff"
  | "stage"
  | "kitchen";
export type AdSize = "full" | "half" | "quarter";
export interface Chapter {
  visible?: boolean;
  startSide?: "auto" | "left" | "right";
  id: string;
  name: string;
  color: string;
}
export interface Staff {
  id: string;
  name: string;
  kana: string;
  grade: number;
  role: string;
  published?: boolean;
}
export interface Event {
  posterRequired?: boolean;
  category?: "student" | "food" | "kitchen" | "stage" | "studentStage";
  published?: boolean;
  order?: number;
  notes?: string;
  id: string;
  name: string;
  group: string;
  building: string;
  floor?: number;
  room: string;
  location: string;
  startTime?: string;
  endTime?: string;
  assetId?: string;
}
export interface Sponsor {
  category?: string;
  notes?: string;
  id: string;
  name: string;
  kana: string;
  sortKey: string;
}
export interface Ad {
  notes?: string;
  /** Unpublished ads stay linked to sponsors but are excluded from automatic placement. */
  published?: boolean;
  id: string;
  sponsorId: string;
  size: AdSize;
  assetId?: string;
}
export interface Asset {
  id: string;
  name: string;
  mime: string;
  rulePicture?: "smoking" | "drinking";
  data: string;
  width: number;
  height: number;
  preview?: string;
  vectorPdf?: string;
  pdfPage?: number;
}
export interface Block {
  externalEvent?: boolean;
  posterRequired?: boolean;
  staffSpread?: boolean;
  eventCategory?: Event["category"];
  posterMode?: "single";
  posterSpacing?: "compact" | "standard";
  backLayout?: "map-left" | "qr-left";
  backMapId?: string;
  websiteUrl?: string;
  openingKind?:
    "survey" | "leaders" | "committee" | "rules" | "waste" | "schedule" | "map";
  surveyUrl?: string;
  secondBody?: string;
  secondAssetId?: string;
  firstName?: string;
  secondName?: string;
  viceMode?: "together" | "separate";
  thirdName?: string;
  thirdBody?: string;
  thirdAssetId?: string;
  smokingPicture?: string;
  drinkingPicture?: string;
  id: string;
  template: Template;
  templateId?: string;
  components?: import("../designer/model").ComponentInstance[];
  title: string;
  chapterId: string;
  flowPosters?: boolean;
  startSide?: "auto" | "left" | "right";
  adSize?: AdSize;
  body?: string;
  assetId?: string;
  showIndex?: boolean;
  showNumber?: boolean;
  coverTitle?: "auto" | "show" | "hide";
}
export interface Theme {
  indexShape?: "rounded" | "square";
  scheduleStyle?: "compact" | "bands" | "line";
  numberStart?: number;
  background: string;
  ink: string;
  accent: string;
  silver: string;
  margin: number;
  adWidth: number;
  adHeight: number;
  adHalfHeight: number;
  adQuarterHeight: number;
  posterAspect: number;
  fontSize: number;
  lineHeight: number;
  binding: "left" | "right";
  padding: 1 | 2 | 4;
  emptySlots: "keep" | "center";
  fontFamily: string;
}
export interface Project {
  intake?: "excel" | "images" | "done";
  contentVersion?: string;
  lastPdf?: { at: string; pages: number; contentVersion: string };
  referenceDesign?: boolean;
  colorPalettes?: import("./color-palette").ColorPalette[];
  colorPaletteId?: string;
  schemaVersion: 5;
  nextRecordId?: number;
  kitchenMenus?: { id: string; eventId: string; name: string; order: number }[];
  id: string;
  name: string;
  year: number;
  edition: number;
  festival: string;
  tagline: string;
  date: string;
  time: string;
  logoId?: string;
  coverId?: string;
  chapters: Chapter[];
  staff: Staff[];
  university?: string;
  events: Event[];
  sponsors: Sponsor[];
  ads: Ad[];
  assets: Record<string, Asset>;
  blocks: Block[];
  templates: DesignTemplate[];
  pageOrder: string[];
  assignments: Record<string, string | null>;
  theme: Theme;
  manualChecks: Record<string, boolean>;
  updatedAt: string;
}
export const uid = () => crypto.randomUUID();
export const templateNames: Record<Template, string> = {
  sponsors: "協賛企業一覧",
  staff: "スタッフ一覧",
  stage: "ステージタイムテーブル",
  kitchen: "キッチンカー紹介",
  cover: "T01 表紙",
  contents: "T03 自動目次",
  events: "T08 企画一覧表",
  posters: "T09 ポスター4枚＋広告",
  ads: "T16 協賛広告",
  notice: "T02 お知らせ",
  back: "T18 裏表紙（基本版）",
};
export const palettes = ["#e4006e", "#ec6c1f", "#231815", "#808080"];
export function createProject(demo = false): Project {
  const chapters = [
    "挨拶",
    "タイムテーブル",
    "マップ",
    "飲食",
    "企画",
    "協賛",
    "スタッフ",
  ].map((name, i) => ({
    id: `ch${i}`,
    name,
    color: [
      "#f16b52",
      "#4cc5e2",
      "#ff9b60",
      "#e4006e",
      "#efd64d",
      "#7067bd",
      "#808080",
    ][i],
  }));
  return {
    schemaVersion: 5,
    id: uid(),
    name: "稲友祭パンフレット",
    year: 2026,
    edition: 27,
    festival: "稲友祭",
    tagline: "ここから、つながる。",
    date: demo ? "2026年10月25日（日）" : "",
    time: "9:30 - 17:30",
    chapters,
    events: demo
      ? Array.from({ length: 5 }, (_, i) => ({
          id: uid(),
          name: [
            "遊べるメディア展示会",
            "プログラミングロボットで遊ぼう",
            "文理フォトギャラリー",
            "わくわくサイエンス",
            "稲映会2026",
          ][i],
          group: [
            "情報メディア学科",
            "ロボット研究会",
            "写真部",
            "科学サークル",
            "映像制作サークル",
          ][i],
          building: i < 3 ? "本館" : "FLOS館",
          floor: (i % 3) + 1,
          room: `C${(i % 3) + 1}01`,
          location: "教室内",
        }))
      : [],
    staff: [],
    sponsors: [],
    ads: [],
    assets: {},
    blocks: [
      ["cover", "表紙", "ch0"],
      ["contents", "目次", "ch0"],
      ["events", "企画一覧", "ch4"],
      ["posters", "学生企画", "ch4"],
      ["ads", "協賛広告", "ch5"],
      ["back", "ご来場ありがとうございました", "ch6"],
    ].map(([template, title, chapterId]) => ({
      id: uid(),
      template: template as Template,
      title,
      chapterId,
      adSize: "quarter",
      flowPosters: template === "events",
    })),
    templates: [],
    pageOrder: [],
    assignments: {},
    theme: {
      background: "#ffffff",
      ink: "#231815",
      accent: "#e4006e",
      silver: "#808080",
      margin: 9,
      adWidth: 125,
      adHeight: 180,
      adHalfHeight: 85,
      adQuarterHeight: 45,
      posterAspect: 1052 / 1495,
      fontSize: 3.1,
      lineHeight: 1.55,
      binding: "left",
      padding: 4,
      emptySlots: "keep",
      fontFamily: "Noto Sans CJK JP",
    },
    manualChecks: {},
    updatedAt: new Date().toISOString(),
  };
}
export function nextYear(p: Project): Project {
  const q = structuredClone(p);
  q.id = uid();
  q.intake = "excel";
  delete q.lastPdf;
  delete q.contentVersion;
  q.year++;
  if (q.edition > 0) q.edition++;
  q.name = `${q.year} ${p.name}`;
  q.date = "";
  q.events = [];
  q.kitchenMenus = [];
  q.staff = [];
  q.sponsors = [];
  q.ads = [];
  const keep = new Set(
    q.templates.flatMap((t) =>
      t.objects.flatMap((o) => (o.assetId ? [o.assetId] : [])),
    ),
  );
  for (const a of Object.values(q.assets)) if (a.rulePicture) keep.add(a.id);
  for (const b of q.blocks)
    if (b.openingKind === "survey" && b.assetId) keep.add(b.assetId);
  for (const b of q.blocks) if (b.backMapId) keep.add(b.backMapId);
  q.assets = Object.fromEntries(
    Object.entries(q.assets).filter(([id]) => keep.has(id)),
  );
  q.logoId = undefined;
  q.coverId = undefined;
  q.pageOrder = [];
  q.assignments = {};
  q.manualChecks = {};
  q.blocks = q.blocks.map((b) => ({
    ...b,
    assetId: b.openingKind === "survey" ? b.assetId : undefined,
    body: ["survey", "rules", "waste"].includes(b.openingKind || "")
      ? b.body
      : "",
    secondBody: ["rules", "waste"].includes(b.openingKind || "")
      ? b.secondBody
      : undefined,
    thirdBody: undefined,
    firstName: undefined,
    secondName: undefined,
    thirdName: undefined,
    secondAssetId: undefined,
    thirdAssetId: undefined,
  }));
  return q;
}
export function sortedEvents(p: Project) {
  return p.events
    .filter((e) => e.published !== false)
    .sort(
      (a, b) =>
        (a.order !== undefined || b.order !== undefined
          ? (a.order ?? 1e9) - (b.order ?? 1e9)
          : 0) ||
        a.building.localeCompare(b.building, "ja", { numeric: true }) ||
        (a.floor ?? -Infinity) - (b.floor ?? -Infinity) ||
        a.room.localeCompare(b.room, "ja", { numeric: true }),
    );
}
export function listingEvents(p: Project, category?: Event["category"]) {
  return sortedEvents(p).filter((e) =>
    category
      ? (e.category || "student") === category
      : e.category !== "stage" && e.category !== "studentStage",
  );
}
export function sortedSponsors(p: Project) {
  const key = (s: Sponsor) =>
    (
      s.sortKey ||
      s.kana ||
      s.name.replace(/株式会社|有限会社|合同会社|一般社団法人/g, "")
    ).trim();
  return [...p.sponsors].sort(
    (a, b) =>
      Number(!/^[a-z]/i.test(key(a))) - Number(!/^[a-z]/i.test(key(b))) ||
      key(a).localeCompare(key(b), "ja", { numeric: true }),
  );
}

export function insertBlock(p: Project, b: Block) {
  const at = p.blocks.findIndex((block) => block.template === "back"),
    back = at < 0 ? undefined : p.blocks[at];
  p.blocks.splice(at < 0 ? p.blocks.length : at, 0, b);
  if (p.pageOrder.length) {
    const i = back
      ? p.pageOrder.findIndex((id) => id.startsWith(back.id + "/"))
      : -1;
    p.pageOrder.splice(i < 0 ? p.pageOrder.length : i, 0, b.id + "/0");
  }
}

export const requiresPoster = (event: Event) => event.posterRequired !== false;
