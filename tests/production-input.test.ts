import { describe, it, expect } from "vitest";
import { createProject } from "../packages/core/model";
import { addEvent, addAd, setAdCompany } from "../packages/core/registration";
import { layoutProject, fallbackMeasure } from "../packages/layout-engine";
import { writeSource, readSource } from "../packages/core/editing";
import { inputGuides } from "../apps/web/src/workspace/inputGuides";
import { webStorage } from "../packages/project-storage";
describe("制作画面の入力ガイド", () => {
  it("未登録広告とロゴの案内は印刷対象から除外される", () => {
    const p = createProject(),
      l = layoutProject(p, fallbackMeasure);
    const hints = l.pages
      .flatMap((pg) => pg.nodes)
      .filter(
        (n) =>
          n.kind === "text" &&
          [
            "広告未設定",
            "大学ロゴ未登録",
            "企画を登録すると一覧表が生成されます。",
          ].includes(n.text),
      );
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.every((n) => n.editorOnly)).toBe(true);
  });
  it("画像付きの標準表紙に学園祭名やロゴを重ねない", () => {
    const p = createProject();
    p.coverId = "cover-art";
    expect(
      layoutProject(p, fallbackMeasure).pages[0].nodes.every(
        (n) =>
          n.kind === "rect" || (n.kind === "asset" && n.assetId === p.coverId),
      ),
    ).toBe(true);
  });

  it("直接編集した情報と素材の関連を保存して復元する", async () => {
    const p = createProject(),
      e = addEvent(p, "stage");
    writeSource(p, { type: "event", id: e.id, field: "startTime" }, "11:30");
    writeSource(p, { type: "event", id: e.id, field: "endTime" }, "12:30");
    writeSource(p, { type: "event", id: e.id, field: "name" }, "保存確認");
    const q = (await webStorage.load(await webStorage.save(p))).project;
    expect(q.events).toEqual(p.events);
    expect(q.blocks).toEqual(p.blocks);
  });
  it("空の企画表とポスター登録を表示し、印刷ノードへ追加しない", () => {
    const p = createProject();
    const b = p.blocks.find((b) => b.template === "events")!;
    b.flowPosters = true;
    const l = layoutProject(p, fallbackMeasure),
      page = l.pages.find((pg) => pg.blockId === b.id)!;
    const before = JSON.stringify(l);
    expect(inputGuides(p, page).map((g) => g.target.action)).toContain("event");
    expect(inputGuides(p, page).map((g) => g.target.action)).toContain(
      "poster",
    );
    expect(JSON.stringify(l)).toBe(before);
    expect(
      l.pages
        .flatMap((pg) => pg.nodes)
        .some((n) => n.kind === "text" && n.text === "＋ ポスターを登録"),
    ).toBe(false);
  });
  it("広告の空き枠は安定した割当キーと元の規格を持つ", () => {
    const p = createProject(),
      l = layoutProject(p, fallbackMeasure);
    const page = l.pages.find((pg) => pg.slots.length)!;
    const g = inputGuides(p, page).find((g) => g.target.action === "ad")!;
    expect(g.target.slotKey).toBe(page.slots[0].key);
    expect(g.w).toBe(p.theme.adWidth);
    const ad = addAd(p);
    p.assignments[g.target.slotKey!] = ad.id;
    const next = layoutProject(p, fallbackMeasure).pages.find(
      (pg) => pg.id === page.id,
    )!;
    expect(
      inputGuides(p, next).find((g) => g.target.source?.id === ad.id),
    ).toBeTruthy();
  });
  it("企画名を元データで変更して複数の描画へ反映する", () => {
    const p = createProject(),
      e = addEvent(p, "student");
    writeSource(
      p,
      { type: "event", id: e.id, field: "name" },
      "直接入力した企画",
    );
    expect(readSource(p, { type: "event", id: e.id, field: "name" })).toBe(
      "直接入力した企画",
    );
    expect(
      layoutProject(p, fallbackMeasure)
        .pages.flatMap((pg) => pg.nodes)
        .some((n) => n.kind === "text" && n.text.includes("直接入力した企画")),
    ).toBe(true);
  });
  it("広告の企業名は既存企業を再利用する", () => {
    const p = createProject(),
      a = addAd(p),
      b = addAd(p);
    setAdCompany(p, a.id, "株式会社テスト");
    writeSource(
      p,
      { type: "ad", id: b.id, field: "companyName" },
      "株式会社テスト",
    );
    expect(p.sponsors).toHaveLength(1);
    expect(a.sponsorId).toBe(b.sponsorId);
  });
});
