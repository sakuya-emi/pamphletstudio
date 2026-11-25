import { tabPath } from "../packages/designer/tab-path";
import { collapseBorders } from "../packages/designer/table-borders";
import { describe, it, expect } from "vitest";
import { createProject, uid, type Event } from "../packages/core/model";
import {
  object,
  createDesign,
  validateDesign,
} from "../packages/designer/model";
import { tablePreset, indexPreset } from "../packages/designer/presets";
import {
  applyComponent,
  resolveObject,
  blockDesign,
} from "../packages/designer/components";
import {
  corners,
  normalizeCorners,
  roundedPath,
  mirrorCorners,
} from "../packages/designer/corners";
import { renderTemplate } from "../packages/designer/render";
import { layoutProject, fallbackMeasure } from "../packages/layout-engine";
import { validateProject, webStorage } from "../packages/project-storage";
import { exportPDF } from "../packages/pdf-export";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
function events(n: number): Event[] {
  return Array.from({ length: n }, (_, i) => ({
    id: "ev" + i,
    name: "学生企画" + (i + 1),
    group: "学生団体" + (i + 1),
    building: ["本館", "FLOS館", "屋外", "キッチンカー"][
      Math.min(3, Math.floor(i / Math.max(1, Math.ceil(n / 4))))
    ],
    floor: (i % 3) + 1,
    room: "C" + (101 + i),
    location: i % 5 < 4 ? "芝生広場前 駐車場" : "ラウンジ",
    startTime: "10:00",
    endTime: "12:00",
  }));
}
describe("部品だけの適用と互換性", () => {
  it("標準ページのインデックスだけを差し替えて表・見出し・ノンブル・背景・データを保持する", () => {
    const p = createProject();
    p.events = events(5);
    const b = p.blocks.find((b) => b.template === "events")!,
      t = indexPreset("outer");
    p.templates = [t];
    const before = layoutProject(p),
      saved = structuredClone(p),
      nodes = before.pages.find((pg) => pg.blockId === b.id)!.nodes;
    applyComponent(p, b.id, t.id);
    const after = layoutProject(p).pages.find(
      (pg) => pg.blockId === b.id,
    )!.nodes;
    expect(b.templateId).toBe(
      saved.blocks.find((a) => a.id === b.id)!.templateId,
    );
    expect(b.template).toBe("events");
    expect(p.events).toEqual(saved.events);
    expect(p.theme).toEqual(saved.theme);
    expect(p.chapters).toEqual(saved.chapters);
    expect(after.filter((n) => n.x >= 10 && n.x < 140)).toEqual(
      nodes.filter((n) => n.x >= 10 && n.x < 140),
    );
    expect(after.find((n) => n.x === 0 && n.w === 148)).toEqual(
      nodes.find((n) => n.x === 0 && n.w === 148),
    );
  });
  it("カスタムページのID・広告枠・他オブジェクトを保持し、配置とローカル値を残す", () => {
    const p = createProject();
    const page = createDesign("posters");
    const idx = object("index", page.layers[0].id, 140, 2, 8, 194);
    page.objects.push(idx);
    const a = indexPreset("rect"),
      b = indexPreset("outer");
    p.templates = [page, a, b];
    const block = p.blocks.find((b) => b.template === "posters")!;
    block.templateId = page.id;
    const original = structuredClone(
      page.objects.filter((o) => o.kind !== "index"),
    );
    applyComponent(p, block.id, a.id);
    block.components![0].overrides = { size: 2.1 };
    applyComponent(p, block.id, b.id);
    const resolved = blockDesign(p, block)!;
    expect(block.templateId).toBe(page.id);
    expect(resolved.objects.filter((o) => o.kind !== "index")).toEqual(
      original,
    );
    expect(resolved.objects.find((o) => o.kind === "index")).toMatchObject({
      x: 140,
      y: 2,
      w: 8,
      h: 194,
    });
    expect(
      resolveObject(
        p,
        resolved.objects.find((o) => o.kind === "index")!,
      ).size,
    ).toBe(2.1);
  });
  it("部品が無いページへは明示的な追加選択が必要", () => {
    const p = createProject(),
      t = indexPreset();
    p.templates = [t];
    const b = p.blocks.find((b) => b.template === "cover")!;
    expect(() => applyComponent(p, b.id, t.id)).toThrow("新しく追加");
    applyComponent(p, b.id, t.id, { add: true });
    expect(b.template).toBe("cover");
    expect(b.components).toHaveLength(1);
  });
  it("全ページ適用時に表紙を勝手に変更しない", () => {
    const p = createProject(),
      t = indexPreset();
    p.templates = [t];
    applyComponent(p, p.blocks[0].id, t.id, { all: true });
    expect(
      p.blocks.find((b) => b.template === "cover")!.components,
    ).toBeUndefined();
    expect(
      p.blocks.find((b) => b.template === "events")!.components,
    ).toHaveLength(1);
  });
  it("旧形式3のradiusを四隅へ移行し、部品参照・上書きを保存復元", async () => {
    const p = createProject(),
      d = createDesign("events");
    d.objects[0].radius = 5;
    const old = { ...p, schemaVersion: 3, templates: [d] };
    const q = validateProject(old);
    expect(q.schemaVersion).toBe(5);
    expect(q.templates[0].objects[0].corners).toEqual(corners(5));
    const t = indexPreset();
    q.templates.push(t);
    applyComponent(q, q.blocks.find((b) => b.template === "events")!.id, t.id);
    const restored = (await webStorage.load(await webStorage.save(q))).project;
    expect(restored.blocks).toEqual(q.blocks);
    expect(restored.templates).toEqual(q.templates);
  });
  it("部品IDをページ全体の参照に指定した破損データを拒否する", () => {
    const p = createProject(),
      t = indexPreset();
    p.templates = [t];
    p.blocks[0].templateId = t.id;
    expect(() => validateProject(p)).toThrow("ページ全体");
  });
});
describe("四隅独立角丸", () => {
  it("隣接角の合計に基づいて同じ比率で正規化する", () => {
    const result = normalizeCorners(
      { topLeft: 80, topRight: 40, bottomRight: 20, bottomLeft: 60 },
      100,
      100,
    );
    for (const [key, value] of Object.entries({
      topLeft: 80,
      topRight: 40,
      bottomRight: 20,
      bottomLeft: 60,
    }))
      expect(result[key as keyof typeof result]).toBeCloseTo(
        (value * 100) / 140,
      );
  });
  it("上下・左右の非対称と反転を保持する", () => {
    const r = { topLeft: 5, topRight: 9, bottomRight: 0, bottomLeft: 2 };
    expect(roundedPath(10, 20, 50, 80, r)).toContain("M 15 20 L 51 20");
    expect(mirrorCorners(r)).toEqual({
      topLeft: 9,
      topRight: 5,
      bottomRight: 2,
      bottomLeft: 0,
    });
  });
  it("四隅・線種を含むオブジェクトの保存復元", async () => {
    const p = createProject(),
      t = createDesign();
    const o = object("rect", t.layers[0].id);
    o.corners = { topLeft: 6, topRight: 3, bottomRight: 0, bottomLeft: 1 };
    o.dash = [1, 2];
    t.objects.push(o);
    p.templates = [t];
    expect(
      (
        await webStorage.load(await webStorage.save(p))
      ).project.templates[0].objects.at(-1),
    ).toEqual(o);
  });
});
describe("編集可能な3つの表と自動組版", () => {
  for (const variant of ["stripe", "cards", "split"] as const)
    for (const n of [1, 5, 20, 50])
      it(`${variant} ${n}件が欠落・はみ出しなく改ページする`, () => {
        const p = createProject(),
          t = tablePreset(variant);
        p.events = events(n);
        expect(validateDesign(t)).toBe(t);
        const pages = renderTemplate(p, t, fallbackMeasure);
        expect(pages.length).toBeLessThan(30);
        for (const e of p.events)
          expect(
            pages.flat().some((n) => n.kind === "text" && n.text === e.name),
          ).toBe(true);
        for (const node of pages.flat()) {
          expect(node.x).toBeGreaterThanOrEqual(0);
          expect(node.y).toBeGreaterThanOrEqual(0);
          expect(node.x + node.w).toBeLessThanOrEqual(148.01);
          expect(node.y + node.h).toBeLessThanOrEqual(210.01);
        }
      });
  it("Aは建物を縦結合し列ごとの交互背景を保持", () => {
    const p = createProject(),
      t = tablePreset("stripe");
    p.events = events(5);
    p.events.forEach((e) => (e.building = "本館"));
    const nodes = renderTemplate(p, t)[0];
    expect(
      nodes.some((n) => n.tablePart?.column === 0 && n.tablePart.rowSpan === 5),
    ).toBe(true);
    expect(
      nodes.filter((n) => n.kind === "rect").some((n) => n.fill === "#a9d4c0"),
    ).toBe(true);
  });
  it("Bは建物ごとの枠・影・点線をベクターノードで保持", () => {
    const p = createProject(),
      t = tablePreset("cards");
    p.events = events(10);
    const nodes = renderTemplate(p, t).flat();
    expect(
      new Set(
        nodes
          .filter((n) => n.tablePart?.kind === "group")
          .map((n) => n.tablePart?.groupKey),
      ).size,
    ).toBe(4);
    expect(nodes.some((n) => n.kind === "path" && n.dash?.length === 2)).toBe(
      true,
    );
    expect(nodes.every((n) => n.kind !== "asset")).toBe(true);
  });
  it("Cは列間隔と共通場所の縦結合を保持", () => {
    const p = createProject(),
      t = tablePreset("split");
    p.events = events(5);
    p.events.forEach((e) => (e.location = "芝生広場前 駐車場"));
    const nodes = renderTemplate(p, t)[0];
    expect(
      nodes.some((n) => n.tablePart?.column === 2 && n.tablePart.rowSpan === 5),
    ).toBe(true);
    const heads = nodes.filter((n) => n.tablePart?.kind === "header");
    expect(heads[1].x - (heads[0].x + heads[0].w)).toBeCloseTo(2);
  });
  it("行・列・セルのスタイル優先順位と結合領域を反映", () => {
    const p = createProject(),
      t = tablePreset("split");
    p.events = events(5);
    const s = t.objects[0].tableStyle!;
    s.merge = [];
    s.rows.ev0 = { fill: "#111111" };
    s.columns[0] = { fill: "#222222" };
    s.cells["ev0:0"] = { fill: "#333333" };
    s.spans = [{ rowId: "ev0", column: 0, rowSpan: 2, colSpan: 2 }];
    const nodes = renderTemplate(p, t)[0];
    expect(
      nodes.find(
        (n) =>
          n.tablePart?.rowId === "ev0" &&
          n.tablePart.column === 0 &&
          n.kind === "rect",
      ),
    ).toMatchObject({ fill: "#333333", tablePart: { rowSpan: 2, colSpan: 2 } });
    expect(
      nodes.filter(
        (n) =>
          n.tablePart?.rowId === "ev1" &&
          n.tablePart.column === 1 &&
          n.kind === "rect",
      ),
    ).toHaveLength(0);
  });
  it("非常に長い企画と場所を複数ページに分けて全文保持", () => {
    const p = createProject(),
      t = tablePreset("stripe");
    p.events = events(1);
    p.events[0].name = "長い企画".repeat(500);
    p.events[0].location = "長い場所".repeat(200);
    p.events[0].room = "";
    t.objects[0].columns![1].field = "location";
    const pages = renderTemplate(p, t);
    const joined = pages
      .flat()
      .filter(
        (n) =>
          n.kind === "text" &&
          n.tablePart?.rowId === "ev0" &&
          n.tablePart.column === 2,
      )
      .map((n) => (n.kind === "text" ? n.text : ""))
      .join("");
    expect(joined).toBe(p.events[0].name);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.length).toBeLessThan(100);
  });
  it("継続ページの結合セルに建物名と見出しを繰り返す", () => {
    const p = createProject(),
      t = tablePreset("stripe");
    p.events = events(50);
    p.events.forEach((e) => (e.building = "本館"));
    const pages = renderTemplate(p, t);
    expect(pages.length).toBeGreaterThan(1);
    for (const nodes of pages) {
      expect(nodes.some((n) => n.kind === "text" && n.text === "本館")).toBe(
        true,
      );
      expect(nodes.some((n) => n.tablePart?.kind === "header")).toBe(true);
    }
  });
});
it("3種の表・非対称角丸・部品変更を日本語ベクターPDFとして生成", async () => {
  await mkdir("output/pdf", { recursive: true });
  const medium = new Uint8Array(
      await readFile("public/fonts/NotoSansCJKjp-Medium.ttf"),
    ),
    bold = new Uint8Array(
      await readFile("public/fonts/NotoSansCJKjp-Bold.ttf"),
    );
  for (const variant of ["stripe", "cards", "split"] as const) {
    const p = createProject(),
      t = tablePreset(variant);
    t.scope = "page";
    p.templates = [t];
    p.theme.padding = 1;
    p.blocks = [
      {
        id: uid(),
        template: "events",
        templateId: t.id,
        title: t.name,
        chapterId: p.chapters[4].id,
      },
    ];
    p.events = events(variant === "split" ? 5 : 20);
    if (variant === "split") {
      const names = [
        "クレープ",
        "たませんたまちゃん",
        "情報メディアのやるやきとり",
        "フライドポテト",
        "朴朴かき氷",
      ];
      p.events.forEach((e, i) => {
        e.name = names[i];
        e.location = "芝生広場前\n駐車場";
      });
    }
    const result = await exportPDF(p, { medium, bold });
    const pdf = await PDFDocument.load(result.bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(0);
    for (const page of pdf.getPages()) {
      expect((page.getWidth() * 25.4) / 72).toBeCloseTo(148);
      expect((page.getHeight() * 25.4) / 72).toBeCloseTo(210);
    }
    await writeFile(`output/pdf/table-${variant}.pdf`, result.bytes);
    await writeFile(`output/table-${variant}.json`, JSON.stringify(p, null, 2));
  }
}, 60000);

it("結合セルの長辺と隣接セルの短辺を重複描画しない", () => {
  const edge = (y: number, h: number, priority: number, color: string) => ({
    priority,
    node: {
      kind: "path" as const,
      x: 10,
      y,
      w: 0,
      h,
      d: `M 10 ${y} L 10 ${y + h}`,
      fill: "none",
      stroke: color,
    },
  });
  const nodes = collapseBorders([
    edge(0, 20, 1, "#111111"),
    edge(0, 10, 2, "#222222"),
    edge(10, 10, 2, "#333333"),
  ]);
  expect(nodes).toHaveLength(2);
  expect(nodes.map((n) => n.h)).toEqual([10, 10]);
  expect(nodes.map((n) => (n.kind === "path" ? n.stroke : ""))).toEqual([
    "#222222",
    "#333333",
  ]);
});
it("同じ部品を再度適用しても部品インスタンスが増えない", () => {
  const p = createProject(),
    a = indexPreset("outer"),
    b = indexPreset("rect");
  p.templates = [a, b];
  const block = p.blocks.find((b) => b.template === "events")!;
  applyComponent(p, block.id, a.id);
  const target = block.components![0].targetObjectId!;
  applyComponent(p, block.id, b.id, { targetId: target });
  expect(block.components).toHaveLength(1);
  expect(block.components![0].templateId).toBe(b.id);
});

it("正規化SVGタブを左右反転して同じ描画データに出力する", () => {
  expect(tabPath("M 0 0 L 1 0 Q 1 1 0 1 Z", 10, 20, 8, 30, true)).toBe(
    "M 18 20 L 10 20 Q 10 50 18 50 Z",
  );
  expect(() => tabPath("M 2 0 L 0 0", 0, 0, 1, 1)).toThrow();
  const p = createProject(),
    t = indexPreset();
  t.objects[0].tabShape = "path";
  t.objects[0].tabPath = "M 0 0 L 1 0 L 0.8 1 L 0 1 Z";
  expect(renderTemplate(p, t)[0].filter((n) => n.kind === "path")).toHaveLength(
    p.chapters.length,
  );
});
it("共通マスターの部品変更とページ固有の上書きを分離する", () => {
  const p = createProject(),
    master = createDesign("notice");
  master.scope = "master";
  master.objects = [object("index", master.layers[0].id, 140, 0, 8, 196)];
  const page = createDesign("events");
  page.masterId = master.id;
  const replacement = indexPreset("slant");
  p.templates = [master, page, replacement];
  p.events = events(5);
  const blocks = p.blocks.filter((b) =>
    ["events", "posters"].includes(b.template),
  );
  blocks.forEach((b) => (b.templateId = page.id));
  const before = renderTemplate(p, page)[0];
  applyComponent(p, blocks[0].id, replacement.id, {
    targetId: master.objects[0].id,
  });
  expect(
    renderTemplate(p, blockDesign(p, blocks[0])!)[0].some(
      (n) => n.kind === "path" && n.tablePart?.groupKey,
    ),
  ).toBe(true);
  expect(renderTemplate(p, blockDesign(p, blocks[1])!)[0]).toEqual(before);
  master.objects[0].templateRef = replacement.id;
  expect(
    renderTemplate(p, blockDesign(p, blocks[1])!)[0].some(
      (n) => n.kind === "path" && n.tablePart?.groupKey,
    ),
  ).toBe(true);
  expect(validateProject(p).schemaVersion).toBe(5);
});
it("右端の部品インデックスは文字枠もA5内に収まる", () => {
  const p = createProject(),
    t = indexPreset("slant");
  p.templates = [t];
  applyComponent(p, p.blocks.find((b) => b.template === "events")!.id, t.id);
  expect(
    layoutProject(p).issues.filter(
      (i) => i.level === "error" && i.message.includes("印刷範囲"),
    ),
  ).toHaveLength(0);
});
it("少数行の建物カードでも見出しを枠内に保持する", () => {
  const p = createProject(),
    t = tablePreset("cards");
  p.events = events(50);
  p.events.forEach((e) => (e.building = "長い建物の名称"));
  const pages = renderTemplate(p, t);
  for (const nodes of pages) {
    const frames = nodes.filter((n) => n.tablePart?.kind === "group");
    for (const label of nodes.filter(
      (n) => n.kind === "text" && /長い|建物|名称|続き/.test(n.text),
    ))
      expect(
        frames.some(
          (f) => label.y >= f.y && label.y + label.h <= f.y + f.h + 0.01,
        ),
      ).toBe(true);
  }
});
