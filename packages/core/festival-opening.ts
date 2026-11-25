import { universityWebsite } from "../templates/back-cover";
import { tablePreset } from "../designer/presets";
import { applyComponent } from "../designer/components";
import { createProject, uid, type Block, type Project } from "./model";

export const surveyDefaultUrl = "https://qr.generatorqr.com/6vESHvTaZ";

/** The 11-page opening follows the reference, including its contents page. */
export function createFestivalProject(): Project {
  const p = createProject();
  p.referenceDesign = true;
  [
    "#fa573e",
    "#36b6d1",
    "#f59a63",
    "#e97894",
    "#f3ce62",
    "#7188be",
    "#919b9a",
  ].forEach((color, i) => {
    p.chapters[i].color = color;
  });
  const block = (
    template: Block["template"],
    title: string,
    chapterId: string,
    extra: Partial<Block> = {},
  ): Block => ({ id: uid(), template, title, chapterId, ...extra });
  const tail = p.blocks.filter((b) => ["ads", "back"].includes(b.template));
  tail.forEach((b) => {
    if (b.template === "ads") b.adSize = "half";
    if (b.template === "back") {
      b.title = "裏表紙";
      b.backLayout = "map-left";
      b.websiteUrl = universityWebsite;
    }
  });
  p.blocks = [
    block("cover", "表紙", "ch0"),
    block("notice", "お知らせ", "ch0", {
      openingKind: "survey",
      surveyUrl: "",
      body: "この度は稲友祭にご来場いただき、誠にありがとうございます！\nより良い稲友祭づくりのため、ご意見をお聞かせください。スマートフォンで右のQRコードを読み取ってご回答ください。",
    }),
    block("contents", "目次", "ch0"),
    block("notice", "学園長・学長挨拶", "ch0", { openingKind: "leaders" }),
    block("notice", "実行委員長・副委員長挨拶", "ch0", {
      openingKind: "committee",
    }),
    block("notice", "禁煙・禁酒について", "ch0", {
      openingKind: "rules",
      body: "会場内では喫煙をご遠慮ください。",
      secondBody: "会場内での飲酒はご遠慮ください。",
    }),
    block("notice", "ゴミの分別について", "ch0", {
      openingKind: "waste",
      body: "紙くず・紙コップ\n割りばし・くし\nビニール・ラップ\nトレー・発泡スチロール",
      secondBody: "ビン・缶類\nペットボトル\nアルミ・スチール",
    }),
    block("stage", "ステージタイムテーブル", "ch1", {
      openingKind: "schedule",
    }),
    block("notice", "マップ", "ch2", { openingKind: "map" }),
    block("events", "企画一覧", "ch4", { flowPosters: false }),
    block("kitchen", "キッチンカー", "ch3"),
    block("events", "学生企画一覧", "ch4", { eventCategory: "student" }),
    block("posters", "学生企画", "ch4", { eventCategory: "student" }),
    block("events", "学生ステージ企画一覧", "ch4", {
      eventCategory: "studentStage",
    }),
    block("posters", "学生ステージ企画", "ch4", {
      eventCategory: "studentStage",
    }),
    block("posters", "自治会ステージ企画", "ch4", {
      eventCategory: "stage",
      posterMode: "single",
    }),
    ...tail.filter((b) => b.template !== "back"),
    block("staff", "スタッフ紹介", "ch6", { staffSpread: true }),
    ...tail.filter((b) => b.template === "back"),
  ];
  const table = tablePreset("cards");
  p.templates.push(table);
  applyComponent(
    p,
    p.blocks.find((b) => b.template === "events")!.id,
    table.id,
  );
  return p;
}
