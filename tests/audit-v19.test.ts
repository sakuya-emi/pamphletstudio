import { inputGuides } from "../apps/web/src/workspace/inputGuides";
import { expect, it } from "vitest";
import { createProject } from "../packages/core/model";
import { createFestivalProject } from "../packages/core/festival-opening";
import { addEvent, addAd } from "../packages/core/registration";
import { writeSource } from "../packages/core/editing";
import { layoutProject } from "../packages/layout-engine";
import { createDesign, object } from "../packages/designer/model";
import { renderTemplate } from "../packages/designer/render";
import { adPlaceholder, adPlaceholderLabel } from "../packages/templates/ads";

it("標準広告枠で企業未設定・企業名未設定・画像未登録を区別し、企業名編集を即時反映する", () => {
  const p = createProject();
  const block = p.blocks.find((b) => b.template === "ads")!;
  const ad = addAd(p);
  ad.size = "half";
  block.adSize = "half";
  p.assignments[`${block.id}/0:slot0`] = ad.id;
  function labels() {
    return layoutProject(p)
      .pages.filter((pg) => pg.blockId === block.id)
      .flatMap((pg) => pg.nodes)
      .filter((n) => n.kind === "text" && n.componentKind === "ad-placeholder")
      .map((n) => (n.kind === "text" ? n.text : ""));
  }
  expect(labels()).toEqual(
    expect.arrayContaining([
      "企業名未設定",
      "画像未登録",
      "企業未設定（広告未設定）",
    ]),
  );
  writeSource(p, { type: "ad", id: ad.id, field: "companyName" }, "確認会社");
  expect(labels()).toContain("確認会社");
  writeSource(
    p,
    { type: "ad", id: ad.id, field: "companyName" },
    "変更後の会社名",
  );
  expect(labels()).toContain("変更後の会社名");
  const page = layoutProject(p).pages.find((pg) => pg.blockId === block.id)!;
  const guide = inputGuides(p, page).find(
    (g) => g.target.source?.id === ad.id,
  )!;
  expect(guide.label).toBe("変更後の会社名\n画像未登録\n広告を登録");
  expect(guide.target.source?.field).toBe("assetId");
  expect(inputGuides(p, page).some((g) => g.label.includes("企業未設定"))).toBe(
    true,
  );
  expect(labels()).not.toContain("確認会社");
  ad.assetId = "registered-image";
  p.assets[ad.assetId] = {
    id: ad.assetId,
    name: "広告",
    mime: "image/png",
    data: "data:image/png;base64,AA==",
    width: 100,
    height: 100,
  };
  expect(labels()).not.toContain("変更後の会社名");
  expect(
    layoutProject(p).pages.some((pg) =>
      pg.nodes.some((n) => n.kind === "asset" && n.source?.id === ad.id),
    ),
  ).toBe(true);
});

it("カスタム広告枠にも企業名を表示し、プレビュー専用の案内は枠内に折り返す", () => {
  const p = createProject();
  const ad = addAd(p);
  writeSource(
    p,
    { type: "ad", id: ad.id, field: "companyName" },
    "非常に長い企業名".repeat(6),
  );
  const t = createDesign("ads", "広告確認");
  const o = object("image", t.layers[0].id, 20, 30, 65, 35);
  o.binding = "advertisement";
  o.adSize = "half";
  t.objects.push(o);
  const nodes = renderTemplate(p, t, undefined, {
    side: "right",
    ads: { [o.id]: ad.id },
  })
    .flat()
    .filter((n) => n.componentKind === "ad-placeholder");
  expect(nodes.length).toBeGreaterThan(2);
  expect(nodes.every((n) => n.editorOnly)).toBe(true);
  const text = nodes.filter((n) => n.kind === "text");
  expect(text.map((n) => (n.kind === "text" ? n.text : "")).join("")).toBe(
    adPlaceholderLabel(p, ad.id).replace(/\n/g, ""),
  );
  for (const n of text) {
    expect(n.y).toBeGreaterThanOrEqual(30);
    expect(n.y + n.h).toBeLessThanOrEqual(65);
  }
  const empty = adPlaceholder(o, adPlaceholderLabel(p));
  expect(
    empty.some((n) => n.kind === "text" && n.text.includes("企業未設定")),
  ).toBe(true);
});

it("コンパクトから復元する細い時間軸の時刻ラベルがページ外判定にならずPDF出力を妨げない", () => {
  const p = createFestivalProject();
  p.theme.scheduleStyle = "line";
  for (let i = 0; i < 4; i++) {
    const e = addEvent(p, "stage");
    e.name = "企画" + i;
    e.startTime = `${10 + i}:00`;
    e.endTime = `${10 + i}:30`;
    e.posterRequired = false;
  }
  const layout = layoutProject(p);
  expect(layout.issues.filter((i) => i.level === "error")).toEqual([]);
  const labels = layout.pages
    .filter((pg) => pg.template === "stage")
    .flatMap((pg) => pg.nodes)
    .filter((n) => n.kind === "text" && n.source?.field === "startTime");
  expect(labels).toHaveLength(4);
  for (const n of labels) expect(n.x + n.w).toBeLessThanOrEqual(148);
});
