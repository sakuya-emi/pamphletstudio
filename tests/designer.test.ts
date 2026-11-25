import { describe, it, expect } from "vitest";
import {
  createProject,
  nextYear,
  insertBlock,
  type Project,
} from "../packages/core/model";
import {
  createDesign,
  object,
  validateDesign,
} from "../packages/designer/model";
import { renderTemplate, templateAdObjects } from "../packages/designer/render";
import {
  bounds,
  constrain,
  fromPoints,
  pathData,
  rotateObjects,
} from "../packages/designer/geometry";
import { layoutProject } from "../packages/layout-engine";
import { validateProject, webStorage } from "../packages/project-storage";
import { exportPDF } from "../packages/pdf-export";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
function fixture(kind: "events" | "posters" | "notice" = "events", count = 5) {
  const p = createProject();
  p.events = Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    assetId: kind === "posters" ? "poster" : undefined,
    name: `学生企画 ${i + 1}`,
    group: `団体 ${i + 1}`,
    building: i % 2 ? "FLOS" : "本館",
    floor: (i % 3) + 1,
    room: `C${i + 100}`,
    location: "ラウンジ",
    startTime: `${i % 2 ? 10 : 9}:${i % 2 ? "30" : "05"}`,
    endTime: "12:00",
  }));
  const t = createDesign(kind, "テストデザイン");
  p.templates = [t];
  p.blocks = [
    {
      id: "custom",
      template: kind,
      templateId: t.id,
      title: t.name,
      chapterId: p.chapters[4].id,
    },
  ];
  return { p, t };
}
describe("デザイナーの保存モデル・互換性", () => {
  it("標準状態のテンプレートは検証できる", () => {
    for (const kind of ["events", "posters", "notice"] as const)
      expect(validateDesign(createDesign(kind)).kind).toBe(kind);
  });
  it("形式2の既存ページを保持し形式4へ移行する", () => {
    const old = structuredClone(createProject()) as any;
    old.schemaVersion = 2;
    delete old.templates;
    const next = validateProject(old);
    expect(next.schemaVersion).toBe(5);
    expect(next.templates).toEqual([]);
    expect(next.blocks).toEqual(old.blocks);
    expect(old.schemaVersion).toBe(2);
  });
  it("パス・グループ・レイヤー・リンク・素材を.pamphから復元する", async () => {
    const { p, t } = fixture("notice");
    const o = object("path", t.layers[0].id, 20, 30, 40, 30);
    o.anchors = [
      { x: 0, y: 0, out: { x: 0.4, y: 0.1 } },
      { x: 1, y: 1, in: { x: 0.7, y: 0.9 } },
    ];
    o.groupId = "group1";
    t.objects.push(o);
    const img = object("image", t.layers[0].id, 30, 90, 50, 60);
    img.assetId = "asset";
    t.objects.push(img);
    p.assets.asset = {
      id: "asset",
      name: "a.png",
      mime: "image/png",
      data: "data:image/png;base64,aGVsbG8=",
      width: 10,
      height: 10,
    };
    const { project: q } = await webStorage.load(await webStorage.save(p));
    expect(q.templates).toEqual(p.templates);
    expect(q.blocks).toEqual(p.blocks);
    expect(q.assets).toEqual(p.assets);
  });
  it("テンプレートの静的素材を翌年度にも保持する", () => {
    const { p, t } = fixture("notice");
    const o = object("image", t.layers[0].id);
    o.assetId = "logo";
    t.objects.push(o);
    p.assets.logo = {
      id: "logo",
      name: "logo",
      mime: "image/png",
      data: "data:image/png;base64,aA==",
      width: 1,
      height: 1,
    };
    expect(nextYear(p).assets.logo).toEqual(p.assets.logo);
    expect(nextYear(p).events).toEqual([]);
  });
  it("回転による紙面外配置を許し、参照切れは拒否する", () => {
    const { p, t } = fixture("notice");
    const o = object("rect", t.layers[0].id, 0, 0, 50, 50);
    o.rotation = 45;
    t.objects.push(o);
    expect(validateDesign(t)).toBe(t);
    t.objects.pop();
    p.blocks[0].templateId = "missing";
    expect(() => validateProject(p)).toThrow("テンプレート参照");
  });
  it("マスターの循環と自動改ページを持つマスターを拒否する", () => {
    const { p, t } = fixture("events");
    const child = createDesign("notice");
    child.masterId = t.id;
    p.templates.push(child);
    expect(() => validateProject(p)).toThrow("マスター");
    t.objects = t.objects.filter((o) => o.kind !== "table");
    t.masterId = child.id;
    expect(() => validateProject(p)).toThrow("マスター");
  });
});
describe("自動組版とマスター", () => {
  for (const count of [0, 5, 30])
    it(`編集した表で${count}件を掲載し、全ページに見出しを繰り返す`, () => {
      const { p, t } = fixture("events", count);
      const table = t.objects.find((o) => o.kind === "table")!;
      table.headerFill = "#b04060";
      table.columns![0].label = "企画タイトル";
      const l = layoutProject(p);
      const pages = l.pages.filter((pg) => pg.blockId === "custom");
      expect(l.issues.filter((i) => i.level === "error")).toEqual([]);
      expect(
        pages.every((pg) =>
          pg.nodes.some((n) => n.kind === "text" && n.text === "企画タイトル"),
        ),
      ).toBe(true);
      for (const e of p.events)
        expect(
          pages.some((pg) =>
            pg.nodes.some((n) => n.kind === "text" && n.text === e.name),
          ),
        ).toBe(true);
    });
  it("非常に長い表の文字を欠落なく改ページする", () => {
    const { p, t } = fixture("events", 1);
    p.events[0].name = "超長い企画".repeat(300);
    const pages = renderTemplate(p, t);
    expect(pages.length).toBeGreaterThan(1);
    const texts = pages
      .flat()
      .filter(
        (n) =>
          n.kind === "text" && n.x === 14 && /^[超長い企画]+$/.test(n.text),
      )
      .map((n) => (n.kind === "text" ? n.text : ""))
      .join("");
    expect(texts).toBe(p.events[0].name);
  });
  it("小さすぎる表を保存しない", () => {
    const { t } = fixture("events");
    t.objects.find((o) => o.kind === "table")!.h = 5;
    expect(() => validateDesign(t)).toThrow("小さすぎ");
  });
  for (const count of [1, 4, 5, 11])
    it(`編集したポスター繰り返しに${count}件を自動分割`, () => {
      const { p } = fixture("posters", count);
      const pages = layoutProject(p).pages.filter(
        (pg) => pg.blockId === "custom",
      );
      expect(pages).toHaveLength(Math.ceil(count / 4));
      expect(pages.every((pg) => pg.slots.length === 1)).toBe(true);
    });
  it("列数・行数を変えると改ページも変わる", () => {
    const { p, t } = fixture("posters", 11);
    const grid = t.objects.find((o) => o.kind === "posters")!;
    grid.cols = 3;
    grid.rows = 2;
    expect(renderTemplate(p, t)).toHaveLength(2);
  });
  it("マスターの編集が子デザインに反映し索引は左右反転する", () => {
    const { p, t } = fixture("notice");
    const master = createDesign("notice", "共通マスター");
    const index = object("index", master.layers[0].id, 140, 0, 8, 196);
    index.gap = 0.6;
    master.objects = [index];
    p.templates.push(master);
    t.masterId = master.id;
    const left = renderTemplate(p, t, undefined, {
      side: "left",
      number: 8,
      chapterId: p.chapters[4].id,
    })[0];
    const right = renderTemplate(p, t, undefined, {
      side: "right",
      number: 9,
      chapterId: p.chapters[4].id,
    })[0];
    expect(left.find((n) => n.objectId === index.id)?.x).toBe(0);
    expect(right.find((n) => n.objectId === index.id)?.x).toBe(140);
    index.radius = 5;
    expect(
      renderTemplate(p, t)[0].some((n) => n.kind === "rect" && n.radius === 5),
    ).toBe(true);
  });
  it("マスター内の広告枠も予約対象に含む", () => {
    const { p, t } = fixture("notice");
    const master = createDesign("notice");
    master.objects = [];
    const ad = object("image", master.layers[0].id, 12.5, 153, 125, 45);
    ad.binding = "advertisement";
    master.objects = [ad];
    p.templates.push(master);
    t.masterId = master.id;
    p.ads = [{ id: "ad", sponsorId: "s", size: "quarter" }];
    expect(templateAdObjects(p, t)).toHaveLength(1);
    expect(layoutProject(p).pages[0].slots[0].adId).toBe("ad");
  });
  it("時間軸は9時を10時より先に並べ、件数で分割する", () => {
    const { p, t } = fixture("notice", 8);
    const time = object("timetable", t.layers[0].id, 12, 28, 126, 165);
    time.itemsPerPage = 3;
    t.objects.push(time);
    const pages = renderTemplate(p, t);
    expect(pages).toHaveLength(3);
    const times = pages
      .flat()
      .filter((n) => n.kind === "text" && /^[\d:]+–/.test(n.text))
      .map((n) => (n.kind === "text" ? n.text : ""));
    expect(times[0]).toContain("9:05");
    expect(times.at(-1)).toContain("10:30");
  });
  it("非表示レイヤーの図形はPDF描画データに出さない", () => {
    const { p, t } = fixture("notice");
    t.layers[0].visible = false;
    expect(renderTemplate(p, t)[0]).toHaveLength(1);
  });
});
describe("幾何とパス", () => {
  it("ドラッグの逆方向と数値制約を扱う", () => {
    const result = fromPoints([
      { x: 80, y: 70 },
      { x: 20, y: 30 },
    ]);
    expect(result).toMatchObject({ x: 20, y: 30, w: 60, h: 40 });
    const o = object("rect", "layer", 140, 205, 30, 20);
    expect(constrain(o)).toMatchObject({ x: 140, y: 205, w: 30, h: 20 });
  });
  it("ベジェは制御点付きのベクターパスになる", () => {
    const o = object("path", "layer", 10, 20, 30, 40);
    o.anchors = [
      { x: 0, y: 0, out: { x: 0.3, y: 0.2 } },
      { x: 1, y: 1, in: { x: 0.8, y: 0.9 } },
    ];
    expect(pathData(o)).toContain("C 19 28 34 56 40 60");
  });
  it("複数オブジェクトの回転は選択全体の中心を使う", () => {
    const a = object("rect", "l", 30, 40, 10, 10),
      b = object("rect", "l", 60, 40, 10, 10);
    const next = rotateObjects([a, b], 90);
    expect(bounds(next).w).toBeCloseTo(10);
    expect(next[0].rotation).toBe(90);
    expect(next[0].y).not.toBe(next[1].y);
  });
});
it("自由配置した文字・回転・楕円・ベジェをベクターPDFに出力", async () => {
  const { p, t } = fixture("notice", 0);
  p.theme.padding = 2; // Preserve the explicit two-page fixture for this drawing test.
  t.objects = [];
  const layer = t.layers[0].id;
  const title = object("text", layer, 16, 12, 116, 12);
  Object.assign(title, {
    text: "デザイナーモード検証",
    size: 6,
    bold: true,
    fill: "#231815",
    stroke: "none",
  });
  const r = object("rect", layer, 22, 40, 45, 25);
  r.fill = "#e8c9c0";
  r.rotation = 15;
  r.radius = 3;
  const ellipse = object("ellipse", layer, 85, 40, 35, 25);
  ellipse.fill = "#b7d0b7";
  const path = object("path", layer, 22, 90, 100, 40);
  path.anchors = [
    { x: 0, y: 1, out: { x: 0.25, y: -0.3 } },
    { x: 1, y: 1, in: { x: 0.7, y: -0.3 } },
  ];
  path.strokeWidth = 1;
  const body = object("text", layer, 20, 150, 110, 25);
  body.text = "文字・図形・パスはベクターのまま出力します。";
  body.rotation = -5;
  body.fill = "#285b48";
  body.stroke = "none";
  t.objects = [title, r, ellipse, path, body];
  const medium = new Uint8Array(
      await readFile("public/fonts/NotoSansCJKjp-Medium.ttf"),
    ),
    bold = new Uint8Array(
      await readFile("public/fonts/NotoSansCJKjp-Bold.ttf"),
    );
  const { bytes, layout } = await exportPDF(p, { medium, bold });
  expect(layout.issues.filter((i) => i.level === "error")).toEqual([]);
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(2);
  await mkdir("output/pdf", { recursive: true });
  await writeFile("output/pdf/designer-verification.pdf", bytes);
  await mkdir("tmp", { recursive: true });
  await writeFile("tmp/designer-verification.json", JSON.stringify(p));
}, 60000);

it("広告テンプレートは枠数から必要なページを増やし重複しない", () => {
  const { p, t } = fixture("notice", 0);
  t.kind = "ads";
  t.objects = [];
  const ad = object("image", t.layers[0].id, 12.5, 20, 125, 180);
  ad.binding = "advertisement";
  ad.adSize = "full";
  t.objects = [ad];
  p.blocks[0].template = "ads";
  p.ads = Array.from({ length: 3 }, (_, i) => ({
    id: `ad${i}`,
    sponsorId: "s",
    size: "full",
  }));
  const pages = layoutProject(p).pages.filter((pg) => pg.blockId === "custom");
  expect(pages).toHaveLength(3);
  expect(new Set(pages.flatMap((pg) => pg.slots.map((s) => s.adId))).size).toBe(
    3,
  );
});
it("タイムテーブルの極端に長い企画名も枠内で分割して保持する", () => {
  const { p, t } = fixture("notice", 1);
  const o = object("timetable", t.layers[0].id, 12, 28, 126, 160);
  t.objects.push(o);
  p.events[0].name = "長い時間割企画".repeat(200);
  const pages = renderTemplate(p, t);
  expect(pages.length).toBeGreaterThan(1);
  const full = pages
    .flat()
    .filter((n) => n.kind === "text" && /^[長い時間割企画]+$/.test(n.text))
    .map((n) => (n.kind === "text" ? n.text : ""))
    .join("");
  expect(full).toBe(p.events[0].name);
  for (const n of pages.flat().filter((n) => n.objectId === o.id))
    expect(n.y + n.h).toBeLessThanOrEqual(o.y + o.h + 0.01);
});
it("塗りなしの文字と非表示レイヤーは透明な描画データになる", () => {
  const { p, t } = fixture("notice", 0);
  const txt = t.objects.find((o) => o.kind === "text")!;
  txt.fill = "none";
  expect(
    renderTemplate(p, t)[0].find((n) => n.objectId === txt.id)?.opacity,
  ).toBe(0);
});

describe("追加した範囲制約とページ挿入", () => {
  it("パスの制御点が紙面外へ出ても保存できる", () => {
    const t = createDesign("notice");
    const path = object("path", t.layers[0].id, 10, 30, 30, 30);
    path.anchors = [
      { x: 0, y: 0, out: { x: -1, y: 0 } },
      { x: 1, y: 1 },
    ];
    t.objects.push(path);
    expect(validateDesign(t)).toBe(t);
    path.anchors[0].out = { x: 0.3, y: 0.2 };
    expect(validateDesign(t)).toBe(t);
  });
  it("手動ページ順を保って裏表紙の前へ新しいブロックを入れる", () => {
    const p = createProject();
    const back = p.blocks.find((b) => b.template === "back")!;
    const original = p.blocks.map((b) => b.id + "/0");
    p.pageOrder = [...original];
    const b = {
      id: "new-custom",
      template: "notice" as const,
      title: "追加",
      chapterId: p.chapters[0].id,
    };
    insertBlock(p, b);
    expect(p.blocks[p.blocks.indexOf(back) - 1]).toBe(b);
    expect(p.pageOrder.filter((id) => id !== "new-custom/0")).toEqual(original);
    expect(p.pageOrder[p.pageOrder.indexOf(back.id + "/0") - 1]).toBe(
      "new-custom/0",
    );
  });
});
