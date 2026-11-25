import { Preview } from "../apps/web/src/Preview";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { createProject } from "../packages/core/model";
import { addEvent, addAd } from "../packages/core/registration";
import {
  interpretRows,
  planRow,
  importDecision,
  inspectImportTarget,
} from "../packages/core/excel-import";
import { layoutProject, fallbackMeasure } from "../packages/layout-engine";
import { exportPDF } from "../packages/pdf-export";
import {
  mediaItems,
  mediaSummary,
  uniqueProjectName,
  outputPages,
} from "../apps/web/src/workspace/workflow";
import { MediaIntake } from "../apps/web/src/workspace/MediaIntake";
import { DirectEditor } from "../apps/web/src/workspace/DirectEditor";
import { ProductionEditor } from "../apps/web/src/workspace/ProductionEditor";
import { pdfCompletion } from "../packages/core/pdf-completion";

describe("初見最短フロー", () => {
  it("表紙・掲載対象のポスター・店舗・広告だけを同じ総数に数え、欠損素材も未登録に数える", () => {
    const p = createProject();
    p.events = [];
    p.ads = [];
    const event = addEvent(p, "student");
    event.assetId = "missing";
    addEvent(p, "kitchen");
    addEvent(p, "student").published = false;
    addAd(p);
    addAd(p).published = false;
    expect(mediaItems(p).map((i) => i.label)).toEqual([
      "表紙",
      "ポスター",
      "店舗画像",
      "広告画像",
    ]);
    expect(mediaSummary(p)).toEqual({
      total: 4,
      missing: 4,
      breakdown: "表紙1件 ／ ポスター1件 ／ 店舗画像1件 ／ 広告画像1件",
    });
    const html = renderToStaticMarkup(
      <MediaIntake project={p} update={() => {}} onFinish={() => {}} />,
    );
    expect(html).toContain("一括スキップ");
    expect(html).toContain("表紙1件");
  });
  it.each([
    "edition",
    "date",
    "time",
    "university",
    "festival",
    "tagline",
    "festivalDisplay",
  ])("基本情報%sの直接編集とパネルに入力欄を出さない", (field) => {
    const p = createProject(),
      source = { type: "project" as const, id: p.id, field };
    const direct = renderToStaticMarkup(
      <DirectEditor
        project={p}
        source={source}
        onEdit={() => {}}
        onClose={() => {}}
      />,
    );
    const panel = renderToStaticMarkup(
      <ProductionEditor
        project={p}
        target={{ blockId: p.blocks[0].id, source }}
        update={() => {}}
        onTarget={() => {}}
        onClose={() => {}}
        onSheet={() => {}}
        onDesign={() => {}}
      />,
    );
    for (const html of [direct, panel]) {
      expect(html).toContain("基本情報");
      expect(html).not.toMatch(/<(input|textarea|select)\b/);
    }
  });
  it("Excel基本情報6項目は反映し、既存文章と異なる行は明示選択した場合だけ更新する", () => {
    const p = createProject();
    for (const row of interpretRows("基本情報", [
      ["開催回数", "28"],
      ["開催日", "2027-10-24"],
      ["開催時間", "09:30〜16:00"],
      ["大学名", "架空大学"],
      ["学園祭名", "見本祭"],
      ["テーマ", "つながる"],
    ])) {
      const plan = planRow(p, row);
      expect(plan.error).toBeFalsy();
      plan.apply(p, p.id);
    }
    expect([
      p.edition,
      p.date,
      p.time,
      p.university,
      p.festival,
      p.tagline,
    ]).toEqual([
      28,
      "2027年10月24日（日）",
      "09:30〜16:00",
      "架空大学",
      "見本祭",
      "つながる",
    ]);
    const row = interpretRows("基本情報", [["大学名", "別の大学"]])[0],
      plan = planRow(p, row);
    const inspected = new Map(
      plan.candidates.map((c) => [
        c.id,
        inspectImportTarget(p, row, c.id, plan),
      ]),
    );
    expect(importDecision(row, plan, false, inspected).state).toBe("review");
    expect(importDecision(row, plan, false, inspected, "").state).toBe("skip");
    const decision = importDecision(row, plan, false, inspected, p.id);
    expect(decision.state).toBe("update");
    plan.apply(p, decision.target);
    expect(p.university).toBe("別の大学");
  });
  it("デザイン見本のラベルを冊子全体のPDFページ数と混同させない", () => {
    const p = createProject(),
      page = layoutProject(p, fallbackMeasure).pages[0];
    const html = renderToStaticMarkup(
      <Preview page={page} project={p} thumb />,
    );
    expect(html).toContain("のデザイン見本");
    expect(html).not.toContain(`PDF ${page.physical}ページ`);
  });
  it("同名は空いている連番を選び、出力総数は内訳と一致する", () => {
    expect(
      uniqueProjectName([
        { name: "稲友祭パンフレット" },
        { name: "稲友祭パンフレット (2)" },
      ]),
    ).toBe("稲友祭パンフレット (3)");
    expect(outputPages(28, 2)).toBe(
      "出力28ページ（誌面26ページ＋自動白紙2ページ）",
    );
    expect(pdfCompletion("v1", "v1", false, false)).toBe("PDF生成済み");
    expect(pdfCompletion("v2", "v1", false, false)).toBe("出力後に変更あり");
  });
  it("基本情報6項目が未設定・表紙未登録でも警告を保って実際のPDFを出力する", async () => {
    const p = createProject();
    p.edition = 0;
    p.date = p.time = p.university = p.festival = p.tagline = "";
    const layout = layoutProject(p, fallbackMeasure);
    expect(layout.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(
      layout.issues.some(
        (i) => i.level === "warning" && i.message.includes("表紙画像"),
      ),
    ).toBe(true);
    expect(
      interpretRows("基本情報", [
        ["項目", "内容"],
        ["開催日", ""],
        ["開催回数", ""],
      ]),
    ).toEqual([]);
    const [medium, bold] = await Promise.all([
      readFile("public/fonts/NotoSansCJKjp-Medium.ttf"),
      readFile("public/fonts/NotoSansCJKjp-Bold.ttf"),
    ]);
    const result = await exportPDF(p, { medium, bold });
    const pdf = await PDFDocument.load(result.bytes);
    expect(pdf.getPageCount()).toBe(result.layout.pages.length);
    expect(pdf.getPageCount()).toBeGreaterThan(0);
  }, 60000);
});
