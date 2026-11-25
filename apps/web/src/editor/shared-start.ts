import type { Project } from "../../../../packages/core/model";
import { uid } from "../../../../packages/core/model";
import {
  createDesign,
  object,
  type DesignTemplate,
} from "../../../../packages/designer/model";
import {
  indexPreset,
  stagePreset,
  tablePreset,
  textPreset,
} from "../../../../packages/designer/presets";
import { defaultTableStyle } from "../../../../packages/designer/table-model";
import { createPresetTemplate } from "./commands";

export const designKinds = [
  ["表", "企画名・団体名・場所を並べる"],
  ["見出し", "ページタイトルの文字を整える"],
  ["インデックス", "章を示す紙面のタブ"],
  ["ページ番号", "誌面番号の文字と位置"],
  ["タイムテーブル", "開始時刻とステージ企画を並べる"],
  ["ポスター枠", "企画ポスターと広告の配置"],
  ["広告枠", "協賛広告を載せるページ"],
  ["スタッフ紹介", "スタッフの氏名と分類を並べる"],
  ["キッチンカー紹介", "店舗・メニュー・画像を載せる"],
  ["本文", "本文の文字を整える"],
  ["箇条書き", "項目とマーカーを整える"],
  ["自由配置", "図形や文字でページを作る"],
] as const;
export type DesignKind = (typeof designKinds)[number][0];

export function starter(kind: DesignKind, blank = false): DesignTemplate {
  let t: DesignTemplate;
  switch (kind) {
    case "表": {
      t = tablePreset("stripe");
      if (blank) {
        const o = object("table", t.layers[0].id, 12, 23, 126, 174);
        o.tableStyle = defaultTableStyle();
        t.objects = [o];
      }
      break;
    }
    case "インデックス":
      t = indexPreset();
      break;
    case "タイムテーブル":
      t = stagePreset();
      break;
    case "見出し":
    case "ページ番号":
    case "本文":
    case "箇条書き":
      t = textPreset(kind);
      break;
    case "ポスター枠":
      t = createPresetTemplate("posters");
      break;
    case "広告枠":
      t = createPresetTemplate("ads");
      break;
    case "スタッフ紹介":
    case "キッチンカー紹介": {
      const staff = kind === "スタッフ紹介";
      t = createDesign(staff ? "staff" : "kitchen", kind);
      const title = t.objects[0];
      title.binding = "page.title";
      const layer = t.layers[0].id;
      const sample = object(
        "text",
        layer,
        staff ? 46 : 15,
        staff ? 33 : 28,
        staff ? 45 : 116,
        5,
      );
      Object.assign(sample, {
        repeatRole: staff ? "staffName" : "kitchenName",
        name: staff ? "スタッフの氏名" : "店舗名",
        size: staff ? 3.2 : 4,
        bold: !staff,
        fill: "#231815",
      });
      t.objects.push(sample);
      if (!staff) {
        const menu = object("text", layer, 72, 40, 59, 5);
        Object.assign(menu, {
          repeatRole: "kitchenMenu",
          name: "メニュー",
          size: 3.2,
          fill: "#231815",
        });
        const photo = object("image", layer, 15, 40, 52, 61);
        Object.assign(photo, { repeatRole: "kitchenPhoto", name: "店舗画像" });
        t.objects.push(menu, photo);
      }
      t.constraints = { flow: "repeat" };
      break;
    }
    default:
      t = createDesign("notice");
      if (blank) t.objects = [];
  }
  if (blank && kind !== "表" && kind !== "自由配置") {
    for (const o of t.objects) {
      if (o.kind === "text" && o.binding === "none" && !o.repeatRole) {
        o.binding = "page.title";
      }
      if (o.kind !== "image") o.fill = "#231815";
    }
  }
  t.category = kind;
  t.name = blank ? `新しい${kind}` : `${kind}の基本デザイン`;
  return t;
}

export function copyStarter(source: DesignTemplate) {
  const t = structuredClone(source);
  t.id = uid();
  t.name += "（コピー）";
  t.version = 1;
  t.createdAt = t.updatedAt = new Date().toISOString();
  delete t.sharedSource;
  return t;
}

export function sampleScenario(project: Project, scenario: string): Project {
  if (scenario === "normal") return project;
  if (scenario === "noImages")
    return {
      ...project,
      events: project.events.map((e) => ({ ...e, assetId: undefined })),
      ads: project.ads.map((a) => ({ ...a, assetId: undefined })),
    };
  const long = scenario === "long";
  const repeat = (i: number) =>
    long
      ? i % 2 === 0
        ? "みんなで楽しむ、ものづくりと創作体験の特別ワークショップ"
        : "秋の発表と体験の特別プログラム"
      : "";
  const expand = <T extends { id: string }>(items: T[]) =>
    scenario === "many"
      ? Array.from({ length: 8 }, (_, i) =>
          items.map((item) => ({ ...item, id: `${item.id}:sample:${i}` })),
        ).flat()
      : scenario === "few"
        ? items.slice(0, 1)
        : items;
  const categories = [...new Set(project.events.map((e) => e.category))];
  const events = (
    scenario === "few"
      ? categories.flatMap((kind) =>
          project.events.filter((e) => e.category === kind).slice(0, 1),
        )
      : expand(project.events)
  ).map((e, i) => ({ ...e, name: e.name + repeat(i) }));
  const kitchenMenus = events.flatMap((e) =>
    (project.kitchenMenus ?? [])
      .filter((m) => m.eventId === e.id.split(":sample:")[0])
      .map((m, i) => ({
        ...m,
        id: `${e.id}:menu:${i}`,
        eventId: e.id,
        name: m.name + repeat(i),
      })),
  );
  return {
    ...project,
    events,
    kitchenMenus,
    staff: expand(project.staff).map((s, i) => ({
      ...s,
      name: s.name + (long ? "・サンプル（長い氏名の表示例）" : ""),
    })),
    ads: expand(project.ads),
  };
}
