import { describe, it, expect } from "vitest";
import {
  createPresetTemplate,
  removeObjects,
  reorderObjects,
} from "../apps/web/src/editor/commands";
import { validateDesign, object } from "../packages/designer/model";
import { createProject } from "../packages/core/model";
import { renderTemplate } from "../packages/designer/render";
import { validateProject, webStorage } from "../packages/project-storage";
const measure = (s: string, size: number) => s.length * size;
describe("エディタの作成・編集コマンド", () => {
  for (const kind of [
    "table",
    "index",
    "timetable",
    "posters",
    "ads",
    "free",
  ] as const)
    it(`${kind}の新規プリセットが有効な編集オブジェクトを持つ`, () => {
      const t = createPresetTemplate(kind);
      expect(validateDesign(t)).toBe(t);
      if (kind === "ads")
        expect(
          t.objects.filter((o) => o.binding === "advertisement"),
        ).toHaveLength(2);
      if (kind === "index")
        expect(t.objects.some((o) => o.kind === "index")).toBe(true);
    });
  it("ロック中のレイヤーは削除対象から保護する", () => {
    const t = createPresetTemplate("free");
    t.layers[0].locked = true;
    const ids = t.objects.map((o) => o.id);
    removeObjects(t, ids);
    expect(t.objects.map((o) => o.id)).toEqual(ids);
    t.layers[0].locked = false;
    removeObjects(t, ids);
    expect(t.objects).toEqual([]);
  });
  it("複数オブジェクトの相対順序を保って前面・背面へ移す", () => {
    const t = createPresetTemplate("free");
    const o = object("rect", t.layers[0].id);
    t.objects.push(o);
    const ids = t.objects.slice(0, 2).map((o) => o.id);
    reorderObjects(t, ids, true);
    expect(t.objects.slice(-2).map((o) => o.id)).toEqual(ids);
    reorderObjects(t, ids, false);
    expect(t.objects.slice(0, 2).map((o) => o.id)).toEqual(ids);
  });
  it("旧テンプレートの文字設定は既定値を補い描画を維持する", () => {
    const p = createProject(),
      t = createPresetTemplate("free");
    t.objects.forEach((o) => {
      delete o.lineHeight;
      delete o.textAlign;
    });
    p.templates = [t];
    const q = validateProject(p);
    expect(q.templates[0].objects[0].lineHeight).toBe(1.5);
    expect(q.templates[0].objects[0].textAlign).toBe("left");
  });
  it("文字の行間と中央・右揃えを共通描画座標に反映する", () => {
    const p = createProject(),
      t = createPresetTemplate("free");
    const o = object("text", t.layers[0].id, 10, 40, 50, 30);
    o.text = "AB\nC";
    o.size = 3;
    o.lineHeight = 2;
    o.textAlign = "center";
    t.objects = [o];
    let ns = renderTemplate(p, t, measure)[0].filter((n) => n.kind === "text");
    expect(ns[0].x).toBe(32);
    expect(ns[1].y - ns[0].y).toBe(6);
    o.textAlign = "right";
    ns = renderTemplate(p, t, measure)[0].filter((n) => n.kind === "text");
    expect(ns[0].x).toBe(54);
  });
  it("編集した書式を.pamphに保存・復元する", async () => {
    const p = createProject(),
      t = createPresetTemplate("free");
    t.objects[0].lineHeight = 2;
    t.objects[0].textAlign = "right";
    p.templates = [t];
    const restored = (await webStorage.load(await webStorage.save(p))).project;
    expect(restored.templates).toEqual(p.templates);
  });
});

it("英数字先頭の日本語混在文字をローカライズ用グリフへ誤置換せずPDF幅を一致させる", async () => {
  const { readFile } = await import("node:fs/promises");
  const { PDFDocument } = await import("pdf-lib");
  const { default: fontkit } = await import("@pdf-lib/fontkit");
  const { fontMeasure, PDF_FONT_FEATURES } =
    await import("../packages/pdf-export");
  const medium = new Uint8Array(
    await readFile("public/fonts/NotoSansCJKjp-Medium.ttf"),
  );
  const bold = new Uint8Array(
    await readFile("public/fonts/NotoSansCJKjp-Bold.ttf"),
  );
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const f = await pdf.embedFont(medium, {
    subset: false,
    features: PDF_FONT_FEATURES,
  });
  const measure = fontMeasure({ medium, bold }),
    raw = fontkit.create(medium);
  for (const value of [
    "FLOS館 1階 C101",
    "FLOS館 2階 C201",
    "Office 2026",
    "A5 148×210mm",
  ]) {
    expect(measure(value, 3.2)).toBeCloseTo(f.widthOfTextAtSize(value, 3.2), 8);
    const gs = raw.layout(value, PDF_FONT_FEATURES).glyphs;
    for (const g of gs.filter((g: { id: number; codePoints: number[] }) =>
      g.codePoints.some((c: number) => c >= 48 && c <= 57),
    ))
      expect(g.id).toBe(raw.glyphForCodePoint(g.codePoints[0]).id);
  }
});
