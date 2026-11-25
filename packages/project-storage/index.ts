import { festivalDate } from "../core/festival-date";
import { corners } from "../designer/corners";
import { validateDesign } from "../designer/model";
import JSZip from "jszip";
import { get, set, keys, del } from "idb-keyval";
import { createProject, type Project, type Asset } from "../core/model";
export interface ProjectStorage {
  remove(id: string): Promise<void>;
  save(p: Project): Promise<Blob>;
  load(file: Blob): Promise<{ project: Project; warnings: string[] }>;
  autosave(p: Project): Promise<void>;
  recent(onUnreadable?: (count: number) => void): Promise<Project[]>;
}
const maxFile = 300 * 1024 * 1024;
export function validateProject(raw: unknown): Project {
  if (!raw || typeof raw !== "object")
    throw new Error("プロジェクトの構造を読み取れません。");
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  let r = raw as Omit<Partial<Project>, "schemaVersion"> & {
    schemaVersion?: number;
  };
  if (version === 1) {
    const oldTheme = (raw as { theme?: Partial<Project["theme"]> }).theme;
    r = {
      ...r,
      schemaVersion: 4,
      theme: {
        ...oldTheme,
        adWidth: oldTheme?.adWidth === 126 ? 125 : (oldTheme?.adWidth ?? 125),
        adHalfHeight: 85,
        adQuarterHeight: 45,
        posterAspect: 1052 / 1495,
      } as Project["theme"],
    };
  }
  if (version === 1 || version === 2)
    r = { ...r, schemaVersion: 4, templates: [] };
  if (version === 3) {
    r = structuredClone(r);
    r.schemaVersion = 4;
    const pageRefs = new Set(r.blocks?.map((b) => b.templateId));
    const masterRefs = new Set(r.templates?.map((t) => t.masterId));
    for (const t of r.templates || []) {
      t.scope = masterRefs.has(t.id) && !pageRefs.has(t.id) ? "master" : "page";
      if (
        !pageRefs.has(t.id) &&
        t.objects.filter((o) => o.kind === "index").length === 1 &&
        t.objects.every((o) => o.kind === "index" || o.kind === "text") &&
        /インデックス/.test(t.name)
      ) {
        t.scope = "component";
        t.componentKind = "index";
        t.objects = t.objects.filter((o) => o.kind === "index");
      }
      for (const o of t.objects) {
        o.corners ||= corners(o.radius);
        o.cornersLinked ??= true;
      }
    }
  }
  if (r.schemaVersion === 4) {
    r = structuredClone(r);
    r.schemaVersion = 5;
    r.staff ??= [];
    for (const b of r.blocks || []) b.flowPosters ??= false;
  }
  if (r.schemaVersion !== 5)
    throw new Error(
      `未対応のスキーマバージョン：${r.schemaVersion}。元ファイルは保持してください。`,
    );
  for (const key of [
    "blocks",
    "chapters",
    "events",
    "sponsors",
    "ads",
  ] as const)
    if (!Array.isArray(r[key])) throw new Error(`${key} が破損しています。`);
  if (!r.theme || !r.assets || typeof r.assets !== "object")
    throw new Error("テーマまたは素材情報がありません。");
  const p = { ...createProject(), ...r } as Project;
  if (p.contentVersion !== undefined && typeof p.contentVersion !== "string")
    delete p.contentVersion;
  if (
    p.lastPdf &&
    (typeof p.lastPdf.contentVersion !== "string" ||
      typeof p.lastPdf.at !== "string" ||
      !Number.isFinite(Date.parse(p.lastPdf.at)) ||
      !Number.isInteger(p.lastPdf.pages) ||
      p.lastPdf.pages < 1)
  )
    delete p.lastPdf;
  if (!Array.isArray(p.templates) || p.templates.length > 200)
    throw new Error("テンプレートライブラリが不正です。");
  if (!Array.isArray(p.staff))
    throw new Error("スタッフ情報が破損しています。");
  for (const list of [p.events, p.ads, p.sponsors, p.chapters, p.staff]) {
    const ids = list.map((r) => r.id);
    if (
      ids.some((id) => typeof id !== "string" || !id) ||
      new Set(ids).size !== ids.length
    )
      throw new Error("レコードIDが不正または重複しています。");
  }
  if (
    p.kitchenMenus !== undefined &&
    (!Array.isArray(p.kitchenMenus) ||
      p.kitchenMenus.some(
        (m) =>
          typeof m.id !== "string" ||
          typeof m.eventId !== "string" ||
          typeof m.name !== "string" ||
          !Number.isFinite(m.order),
      ))
  )
    throw new Error("メニュー情報が不正です。");
  const aliases: Record<string, string> = {
    学生企画: "student",
    模擬店: "food",
    キッチンカー: "kitchen",
    ステージ企画: "stage",
    学生ステージ企画: "studentStage",
    "student-stage": "studentStage",
  };
  for (const e of p.events) {
    const mapped = aliases[e.category || ""];
    if (mapped) e.category = mapped as typeof e.category;
  }
  p.templates.forEach(validateDesign);
  const tids = new Set(p.templates.map((t) => t.id));
  if (tids.size !== p.templates.length)
    throw new Error("テンプレートIDが重複しています。");
  for (const t of p.templates)
    if (t.masterId) {
      const master = p.templates.find((m) => m.id === t.masterId);
      if (
        !master ||
        master.id === t.id ||
        master.masterId ||
        master.objects.some((o) =>
          ["table", "posters", "timetable"].includes(o.kind),
        )
      )
        throw new Error("共通マスターの参照が不正です。");
    }
  for (const t of p.templates)
    for (const o of t.objects)
      if (o.templateRef) {
        const ref = p.templates.find((a) => a.id === o.templateRef);
        if (
          !ref ||
          ref.scope !== "component" ||
          ref.componentKind !== o.kind ||
          ref.objects[0]?.templateRef
        )
          throw new Error("部品オブジェクトの参照が不正です。");
      }
  for (const b of p.blocks) {
    if (
      b.components &&
      (!Array.isArray(b.components) || b.components.length > 100)
    )
      throw new Error("ページの部品設定が不正です。");
    const ids = new Set<string>();
    for (const c of b.components || []) {
      const t = p.templates.find((t) => t.id === c.templateId);
      if (
        !t ||
        t.scope !== "component" ||
        t.componentKind !== c.kind ||
        typeof c.id !== "string" ||
        ids.has(c.id) ||
        !c.placement ||
        ![c.placement.x, c.placement.y, c.placement.w, c.placement.h].every(
          Number.isFinite,
        ) ||
        c.placement.x < 0 ||
        c.placement.y < 0 ||
        c.placement.w < 0.2 ||
        c.placement.h < 0.2 ||
        c.placement.x + c.placement.w > 148.01 ||
        c.placement.y + c.placement.h > 210.01
      )
        throw new Error("ページの部品参照・配置が不正です。");
      ids.add(c.id);
    }
    if (
      b.templateId &&
      p.templates.find((t) => t.id === b.templateId)?.scope === "component"
    )
      throw new Error("部品テンプレートをページ全体の参照に使用できません。");
  }
  for (const b of p.blocks)
    if (b.templateId && !tids.has(b.templateId))
      throw new Error("ページのテンプレート参照がありません。");
  if (!p.blocks.length || !p.chapters.length)
    throw new Error("ページと章を1件以上登録してください。");
  if (
    !Array.isArray(p.pageOrder) ||
    p.pageOrder.some((id) => typeof id !== "string")
  )
    throw new Error("ページ順序が不正です。");
  if (
    !p.assignments ||
    typeof p.assignments !== "object" ||
    !p.manualChecks ||
    typeof p.manualChecks !== "object"
  )
    throw new Error("割当・確認設定が不正です。");
  if (
    !["left", "right"].includes(p.theme.binding) ||
    !["keep", "center"].includes(p.theme.emptySlots)
  )
    throw new Error("表示設定が不正です。");
  for (const key of [
    "name",
    "festival",
    "tagline",
    "date",
    "time",
    "updatedAt",
  ] as const)
    if (typeof p[key] !== "string") throw new Error("基本情報が不正です。");
  if (!Number.isFinite(p.edition) || !Number.isFinite(p.year))
    throw new Error("年度・開催回数が不正です。");
  for (const a of p.ads)
    if (
      !a ||
      typeof a.id !== "string" ||
      typeof a.sponsorId !== "string" ||
      !["full", "half", "quarter"].includes(a.size)
    )
      throw new Error("広告情報が不正です。");
  for (const s of p.sponsors)
    if (
      !s ||
      !["id", "name", "kana", "sortKey"].every(
        (k) => typeof (s as unknown as Record<string, unknown>)[k] === "string",
      )
    )
      throw new Error("協賛企業情報が不正です。");
  if (
    p.blocks.length > 1000 ||
    p.events.length > 10000 ||
    p.chapters.length > 50
  )
    throw new Error("プロジェクトの件数上限を超えています。");
  const templates = [
    "cover",
    "contents",
    "events",
    "posters",
    "ads",
    "notice",
    "back",
    "stage",
    "kitchen",
    "sponsors",
    "staff",
  ];
  for (const b of p.blocks)
    if (
      !b ||
      typeof b.id !== "string" ||
      !templates.includes(b.template) ||
      typeof b.title !== "string" ||
      (b.template === "ads" &&
        b.adSize !== undefined &&
        !["full", "half", "quarter"].includes(b.adSize))
    )
      throw new Error("未対応または破損したページがあります。");
  for (const ch of p.chapters)
    if (
      !ch ||
      typeof ch.id !== "string" ||
      typeof ch.name !== "string" ||
      !/^#[\da-f]{6}$/i.test(ch.color)
    )
      throw new Error("章設定が不正です。");
  for (const e of p.events)
    if (
      !e ||
      !["id", "name", "group", "building", "room", "location"].every(
        (k) => typeof (e as unknown as Record<string, unknown>)[k] === "string",
      ) ||
      (e.floor !== undefined && !Number.isFinite(e.floor))
    )
      throw new Error("企画データが不正です。");
  for (const k of [
    "margin",
    "adWidth",
    "adHeight",
    "adHalfHeight",
    "adQuarterHeight",
    "posterAspect",
    "fontSize",
    "lineHeight",
  ] as const)
    if (!Number.isFinite(p.theme[k])) throw new Error("寸法設定が不正です。");
  if (
    p.theme.margin < 5 ||
    p.theme.margin > 16 ||
    p.theme.adHeight < 100 ||
    p.theme.adHeight > 180 ||
    p.theme.adWidth < 50 ||
    p.theme.adWidth > 128 ||
    p.theme.adHalfHeight < 30 ||
    p.theme.adHalfHeight > 90 ||
    p.theme.adQuarterHeight < 15 ||
    p.theme.adQuarterHeight > 45 ||
    p.theme.posterAspect < 0.3 ||
    p.theme.posterAspect >= 1 ||
    p.theme.fontSize < 2 ||
    p.theme.fontSize > 5 ||
    p.theme.lineHeight < 1.1 ||
    p.theme.lineHeight > 1.8
  )
    throw new Error("寸法設定が許容範囲外です。");
  if (![1, 2, 4].includes(p.theme.padding))
    throw new Error("ページ調整設定が不正です。");
  for (const k of ["background", "ink", "accent", "silver"] as const)
    if (!/^#[\da-f]{6}$/i.test(p.theme[k]))
      throw new Error("色設定が不正です。");
  if (p.colorPalettes !== undefined) {
    if (!Array.isArray(p.colorPalettes) || p.colorPalettes.length > 128)
      throw new Error("カラーパレットが不正です。");
    const ids = new Set<string>();
    for (const palette of p.colorPalettes) {
      if (
        !palette ||
        typeof palette.id !== "string" ||
        ids.has(palette.id) ||
        typeof palette.name !== "string" ||
        !palette.colors ||
        typeof palette.colors !== "object" ||
        Array.isArray(palette.colors)
      )
        throw new Error("カラーパレットが不正です。");
      ids.add(palette.id);
      for (const [key, value] of Object.entries(palette.colors))
        if (
          !/^#[0-9a-f]{6}$/i.test(key) ||
          typeof value !== "string" ||
          !/^#[0-9a-f]{6}$/i.test(value)
        )
          throw new Error("カラーパレットの色が不正です。");
    }
    if (p.colorPaletteId && !ids.has(p.colorPaletteId))
      p.colorPaletteId = undefined;
  }
  const date = festivalDate(p.date);
  if (date) {
    p.date = date.label;
    p.year = date.year;
  } else if (p.date === "開催日を入力") p.date = "";
  return p;
}
export const webStorage: ProjectStorage = {
  async remove(id) {
    await del(`pamph:${id}`);
  },
  async save(p) {
    const zip = new JSZip(),
      manifest = structuredClone(p);
    for (const a of Object.values(manifest.assets)) {
      const folder = p.ads.some((ad) => ad.assetId === a.id)
        ? "ads"
        : p.events.some((e) => e.assetId === a.id)
          ? "posters"
          : "images";
      const path = `assets/${folder}/${a.id}`;
      zip.file(path, a.data.split(",")[1], { base64: true });
      a.data = path;
    }
    zip.file("project.json", JSON.stringify(manifest, null, 2));
    zip.file("theme.json", JSON.stringify(p.theme, null, 2));
    zip.file("events.json", JSON.stringify(p.events, null, 2));
    return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  },
  async load(file) {
    if (file.size > maxFile)
      throw new Error("300MB以下のプロジェクトを選択してください。");
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entry = zip.file("project.json");
    if (!entry) throw new Error("project.json がありません。");
    const raw = JSON.parse(await entry.async("string"));
    const p = validateProject(raw),
      warnings: string[] = [];
    if (raw.schemaVersion === 1)
      warnings.push(
        "旧形式を更新しました。広告規格を幅125mm（旧初期値の場合）、高さ180／85／45mmへ、ポスター枠を縦長へ更新しています。元ファイルは変更していません。",
      );
    let size = 0;
    for (const [id, a] of Object.entries(p.assets)) {
      if (
        !a ||
        a.id !== id ||
        typeof a.mime !== "string" ||
        typeof a.data !== "string" ||
        !Number.isFinite(a.width) ||
        a.width <= 0 ||
        !Number.isFinite(a.height) ||
        a.height <= 0
      )
        throw new Error("素材情報が破損しています。");
      if (a.data.startsWith("data:")) continue;
      const f = zip.file(a.data);
      if (!f) {
        warnings.push(`素材を復元できません：${a.name}`);
        delete p.assets[id];
        continue;
      }
      const bytes = await f.async("uint8array");
      size += bytes.length;
      if (size > maxFile)
        throw new Error("展開後の素材が300MBを超えています。");
      a.data = `data:${a.mime};base64,${bytesToBase64(bytes)}`;
    }
    if (raw.schemaVersion === 2 || raw.schemaVersion === 3)
      warnings.push(
        "デザイナーモード対応の形式3へ更新しました。既存ページは保持しています。",
      );
    // Preserve project identity across export/import; nextYear() handles cloning.
    return { project: p, warnings };
  },
  async autosave(p) {
    await set(`pamph:${p.id}`, { ...p, updatedAt: new Date().toISOString() });
  },
  async recent(onUnreadable) {
    const ids = (await keys()).filter((k) => String(k).startsWith("pamph:"));
    let unreadable = 0;
    const projects = (
      await Promise.all(
        ids.map(async (id) => {
          try {
            const raw = await get<Project>(id);
            return raw ? validateProject(raw) : undefined;
          } catch {
            unreadable++;
            return undefined;
          }
        }),
      )
    )
      .filter((p): p is Project => !!p)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    onUnreadable?.(unreadable);
    return projects;
  },
};
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function bytesToBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
export function dataBytes(data: string) {
  return Uint8Array.from(atob(data.split(",")[1]), (c) => c.charCodeAt(0));
}
export type StoredAsset = Asset;
