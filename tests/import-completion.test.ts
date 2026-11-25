import { expect, it } from "vitest";
import { createFestivalProject } from "../packages/core/festival-opening";
import {
  importDecision,
  inspectImportTarget,
  interpretRows,
  planRow,
} from "../packages/core/excel-import";
import { pdfCompletion } from "../packages/core/pdf-completion";
import { layoutProject } from "../packages/layout-engine";
import { webStorage } from "../packages/project-storage";
it("基本情報の空欄は初期選択、既存情報の上書きは確認、同じ値は変更不要", () => {
  const p = createFestivalProject();
  p.university = "";
  p.festival = "旧学園祭";
  const rows = interpretRows("基本情報", [
    ["大学名", "架空大学"],
    ["学園祭名", "新学園祭"],
    ["開催回数", String(p.edition)],
    ["開催日", "2027-10-24"],
  ]);
  const result = rows.map((r) => {
    const plan = planRow(p, r);
    const inspected = new Map(
      plan.candidates.map((c) => [c.id, inspectImportTarget(p, r, c.id, plan)]),
    );
    return {
      plan,
      decision: importDecision(r, plan, false, inspected),
      inspected,
    };
  });
  expect(result.map((r) => r.decision.state)).toEqual([
    "update",
    "review",
    "same",
    "update",
  ]);
  expect(result[1].inspected.get(p.id)?.differences).toEqual([
    { field: "学園祭名", before: "旧学園祭", after: "新学園祭" },
  ]);
  for (const { plan, decision } of result)
    if (decision.state === "update") plan.apply(p, decision.target);
  expect(p.university).toBe("架空大学");
  expect(p.festival).toBe("旧学園祭");
  expect(p.date).toContain("2027年10月24日");
});
it("階数の未入力と明示した0を保存と組版で区別する", async () => {
  const p = createFestivalProject();
  for (const r of interpretRows("学生企画", [
    ["未入力", "団体", "本館", "", "", "ピロティ"],
    ["0階企画", "団体", "本館", "0", "", "ホール"],
  ]))
    planRow(p, r).apply(p);
  const q = (await webStorage.load(await webStorage.save(p))).project;
  expect(q.events.map((e) => e.floor)).toEqual([undefined, 0]);
  const texts = layoutProject(q)
    .pages.flatMap((pg) => pg.nodes)
    .filter((n) => n.kind === "text");
  expect(
    texts.some(
      (n) => n.source?.id === q.events[0].id && /1F|1階|0階/.test(n.text),
    ),
  ).toBe(false);
  expect(
    texts.some(
      (n) => n.source?.id === q.events[1].id && n.text.includes("0階"),
    ),
  ).toBe(true);
});
it("標準表紙は画像のみ、裏表紙の大学名は基本情報に連動する", () => {
  const p = createFestivalProject();
  p.festival = "テスト学園祭";
  p.university = "架空大学";
  p.date = "2027年10月24日（日）";
  p.coverId = "art";
  p.blocks[0].coverTitle = "show";
  const pages = layoutProject(p).pages;
  expect(pages[0].nodes.some((n) => n.kind === "text")).toBe(false);
  expect(
    pages[0].nodes.some((n) => n.kind === "asset" && n.assetId === "art"),
  ).toBe(true);
  expect(
    pages
      .at(-1)
      ?.nodes.some((n) => n.kind === "text" && n.text === p.university),
  ).toBe(true);
});
it("PDF完成は必要な確認と生成した版で判定する", () => {
  expect(pdfCompletion(1, null, false, false)).toBe("確認が必要");
  expect(pdfCompletion(1, null, false, true)).toBe("PDF出力可能");
  expect(pdfCompletion(1, 1, false, true)).toBe("PDF生成済み");
  expect(pdfCompletion(2, 1, false, true)).toBe("出力後に変更あり");
  expect(pdfCompletion(1, 1, true, true)).toBe("確認が必要");
});
it("調整用白紙の理由は編集専用で、中綴じは4の倍数になる", () => {
  const p = createFestivalProject();
  p.theme.padding = 4;
  const { pages } = layoutProject(p);
  expect(pages.length % 4).toBe(0);
  const blank = pages.filter((pg) => pg.blankReason);
  expect(blank.length).toBeGreaterThan(0);
  expect(blank.every((pg) => pg.nodes.every((n) => n.editorOnly))).toBe(true);
});
