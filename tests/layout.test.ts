import { describe, it, expect } from "vitest";
import {
  createProject as newProject,
  nextYear,
  sortedEvents,
  sortedSponsors,
  type Event,
} from "../packages/core/model";
import { layoutProject, fit } from "../packages/layout-engine";
import { webStorage, validateProject } from "../packages/project-storage";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { exportPDF, fontMeasure } from "../packages/pdf-export";
import { readFile, mkdir, writeFile } from "node:fs/promises";
// Regression fixtures retain the pre-v5 separate-section setting.
const createProject = (demo = false) => {
  const p = newProject(demo);
  p.blocks.forEach((b) => (b.flowPosters = false));
  return p;
};
const attachPosters = (p: ReturnType<typeof createProject>) => {
  p.assets.poster = {
    id: "poster",
    name: "poster",
    mime: "image/png",
    data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ioAAAAASUVORK5CYII=",
    width: 1052,
    height: 1495,
  };
  p.events.forEach((e) => (e.assetId = "poster"));
};
const events = (count: number): Event[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `ev${i}`,
    name: `企画 ${i + 1}`,
    group: `団体 ${i + 1}`,
    building: i % 2 ? "FLOS館" : "本館",
    floor: (i % 3) + 1,
    room: `C${(i % 3) + 1}${String(i).padStart(2, "0")}`,
    location: "教室内",
  }));
describe("自動組版", () => {
  for (const n of [1, 4, 5, 11])
    it(`ポスター${n}件は4件ずつ改ページ`, () => {
      const p = createProject();
      p.events = events(n);
      attachPosters(p);
      const pages = layoutProject(p).pages.filter(
        (p) => p.template === "posters",
      );
      expect(pages).toHaveLength(Math.ceil(n / 4));
      expect(
        pages.map(
          (pg) =>
            pg.nodes.filter(
              (n) => n.kind === "asset" && n.source?.type === "event",
            ).length,
        ),
      ).toEqual(
        Array.from({ length: Math.ceil(n / 4) }, (_, i) =>
          Math.min(4, n - i * 4),
        ),
      );
    });
  for (const n of [0, 5, 30])
    it(`企画${n}件の一覧表ははみ出さず、全件を掲載`, () => {
      const p = createProject();
      p.events = events(n);
      const l = layoutProject(p);
      const pages = l.pages.filter((pg) => pg.template === "events");
      for (const e of p.events)
        expect(
          pages.some((pg) =>
            pg.nodes.some(
              (node) => node.kind === "text" && node.text === e.name,
            ),
          ),
        ).toBe(true);
      expect(l.issues.filter((i) => i.level === "error")).toHaveLength(0);
      for (const page of pages)
        expect(
          page.nodes.some((n) => n.kind === "text" && n.text === "団体名"),
        ).toBe(true);
    });
  it("非常に長い企画名を折り返し、ページをまたいでも全て保持", () => {
    const p = createProject();
    p.events = events(1);
    p.events[0].name = "長い企画名".repeat(500);
    const l = layoutProject(p);
    const pages = l.pages.filter((pg) => pg.template === "events");
    expect(pages.length).toBeGreaterThan(1);
    expect(l.issues.filter((i) => i.level === "error")).toHaveLength(0);
    const full = pages
      .flatMap((pg) => pg.nodes)
      .filter(
        (n) =>
          n.kind === "text" &&
          n.x === 14 &&
          n.y >= 30 &&
          /^[長い企画名]+$/.test(n.text),
      )
      .map((n) => (n.kind === "text" ? n.text : ""))
      .join("");
    expect(full).toEqual(p.events[0].name);
  });
  it("建物、階、教室順の並び", () => {
    const p = createProject();
    p.events = events(30);
    const s = sortedEvents(p);
    for (let i = 1; i < s.length; i++)
      if (s[i].building === s[i - 1].building)
        expect(s[i].floor ?? -Infinity).toBeGreaterThanOrEqual(
          s[i - 1].floor ?? -Infinity,
        );
  });
  it("左右はPDFの物理順で決まり、表紙の番号非表示に影響されない", () => {
    const p = createProject();
    const l = layoutProject(p);
    expect(l.pages[0].number).toBeUndefined();
    expect(l.pages[1].side).toBe("left");
    expect(l.pages[1].number).toBe(1);
    p.theme.binding = "right";
    expect(layoutProject(p).pages[1].side).toBe("right");
  });
  it("見出しの増減と目次自身の改ページが確定してから開始ページを参照", () => {
    const p = createProject();
    p.chapters = Array.from({ length: 40 }, (_, i) => ({
      id: `ch${i}`,
      name: `章${i}`,
      color: "#808080",
    }));
    for (let i = 0; i < 37; i++)
      p.blocks.splice(-1, 0, {
        id: "heading-" + i,
        template: "notice",
        chapterId: "ch0",
        title: "見出し " + i,
      });
    const a = layoutProject(p);
    expect(a.pages.filter((p) => p.template === "contents")).toHaveLength(3);
    const target = a.pages.find((p) => p.template === "events")!;
    const toc = a.pages
      .filter((p) => p.template === "contents")
      .flatMap((p) => p.nodes);
    expect(
      toc.some((n) => n.kind === "text" && n.text === String(target.number)),
    ).toBe(true);
    p.pageOrder = a.pages
      .filter((pg) => pg.template !== "blank")
      .map((pg) => pg.id)
      .reverse();
    const b = layoutProject(p);
    expect(b.pages[0].id).toBe(
      p.pageOrder.find((id) => !id.startsWith("blank-")),
    );
    expect(b.pages.filter((pg) => pg.number).map((pg) => pg.number)).toEqual(
      Array.from({ length: b.pages.length - 2 }, (_, i) => i + 1),
    );
  });
  for (const size of ["full", "half", "quarter"] as const)
    it(`${size}広告の実寸を保持`, () => {
      const p = createProject();
      p.blocks = p.blocks.filter((b) => b.template === "ads");
      p.blocks[0].adSize = size;
      p.ads = [{ id: "a", sponsorId: "s", size }];
      const l = layoutProject(p);
      const pg = l.pages[0];
      expect(pg.slots.filter((s) => s.adId)).toHaveLength(1);
      const box = pg.nodes.find(
        (n) => n.kind === "rect" && n.stroke === "#d9d6cf",
      )!;
      expect(box.h).toBe({ full: 180, half: 85, quarter: 45 }[size]);
    });
  it("広告不足時に同じ広告を重複しない", () => {
    const p = createProject();
    p.events = events(11);
    p.ads = [{ id: "a", sponsorId: "s", size: "quarter" }];
    const l = layoutProject(p);
    expect(
      l.pages.flatMap((pg) => pg.slots).filter((s) => s.adId === "a"),
    ).toHaveLength(1);
    expect(l.issues.some((i) => i.message.includes("広告未設定"))).toBe(true);
  });
  it("手動指定の重複と規格違いをエラーにする", () => {
    const p = createProject();
    p.events = events(5);
    p.ads = [{ id: "a", sponsorId: "s", size: "quarter" }];
    p.events = events(5);
    attachPosters(p);
    const id = p.blocks.find((b) => b.template === "posters")!.id;
    p.assignments[`${id}/0:slot0`] = "a";
    p.assignments[`${id}/1:slot0`] = "a";
    expect(
      layoutProject(p).issues.some(
        (i) => i.level === "error" && i.message.includes("複数"),
      ),
    ).toBe(true);
    p.ads[0].size = "full";
    expect(
      layoutProject(p).issues.some((i) => i.message.includes("規格")),
    ).toBe(true);
  });
  it("画像は縦横混在でも全体表示し、実効解像度を警告", () => {
    for (const [w, h] of [
      [100, 300],
      [300, 100],
    ]) {
      const b = fit({ x: 10, y: 10, w: 60, h: 55 }, w, h);
      expect(b.w / b.h).toBeCloseTo(w / h);
      expect(b.x).toBeGreaterThanOrEqual(10);
      expect(b.y + b.h).toBeLessThanOrEqual(65);
    }
    const p = createProject();
    p.events = events(1);
    p.events[0].assetId = "low";
    p.assets.low = {
      id: "low",
      name: "low.png",
      mime: "image/png",
      data: "data:image/png;base64,AAAA",
      width: 50,
      height: 50,
    };
    expect(layoutProject(p).issues.some((i) => i.message.includes("dpi"))).toBe(
      true,
    );
  });
  it("中綴じは裏表紙の前に白紙を追加", () => {
    const p = createProject();
    p.theme.padding = 4;
    const l = layoutProject(p);
    expect(l.pages.length % 4).toBe(0);
    expect(l.pages.at(-1)?.template).toBe("back");
  });
  it("英語名→50音、法人格を除いて協賛企業をソート", () => {
    const p = createProject();
    p.sponsors = ["株式会社Zoo", "株式会社ABC", "有限会社あいう"].map(
      (name, i) => ({ id: String(i), name, kana: "", sortKey: "" }),
    );
    expect(sortedSponsors(p).map((s) => s.name)).toEqual([
      "株式会社ABC",
      "株式会社Zoo",
      "有限会社あいう",
    ]);
  });
});
describe("プロジェクト", () => {
  it("画像・PDF原本・デザイン・順序・広告割当をZIPから復元", async () => {
    const p = createProject(true);
    p.assets.a = {
      id: "a",
      name: "a.png",
      mime: "image/png",
      width: 100,
      height: 100,
      data: "data:image/png;base64,aGVsbG8=",
    };
    p.events[0].assetId = "a";
    p.theme.background = "#eeffee";
    p.assignments["test"] = null;
    p.pageOrder = ["test"];
    const blob = await webStorage.save(p);
    const { project: q } = await webStorage.load(blob);
    expect(q.assets).toEqual(p.assets);
    expect(q.theme).toEqual(p.theme);
    expect(q.events).toEqual(p.events);
    expect(q.assignments).toEqual(p.assignments);
    expect(q.pageOrder).toEqual(p.pageOrder);
    expect(q.id).toEqual(p.id);
  });
  it("未対応スキーマ・破損テーマを拒否", () => {
    const p = createProject();
    expect(() => validateProject({ ...p, schemaVersion: 99 })).toThrow();
    expect(() =>
      validateProject({ ...p, theme: { ...p.theme, adHeight: 999 } }),
    ).toThrow();
  });
  it("次年度は元を変更せず、デザインを継承し内容をリセット", () => {
    const p = createProject(true),
      q = nextYear(p);
    expect(q.id).not.toBe(p.id);
    expect(q.year).toBe(p.year + 1);
    expect(q.edition).toBe(p.edition + 1);
    expect(q.events).toHaveLength(0);
    expect(p.events).toHaveLength(5);
    expect(q.theme).toEqual(p.theme);
  });
});
it("A5日本語ベクターPDFとPDFポスターの直接埋め込みを生成", async () => {
  const medium = new Uint8Array(
      await readFile("public/fonts/NotoSansCJKjp-Medium.ttf"),
    ),
    bold = new Uint8Array(
      await readFile("public/fonts/NotoSansCJKjp-Bold.ttf"),
    );
  const p = createProject();
  p.events = events(11);
  p.events[0].name = "非常に長い企画名でも文字を折り返して掲載します".repeat(3);
  const source = await PDFDocument.create();
  const f = await source.embedFont(StandardFonts.HelveticaBold);
  const a = source.addPage([210, 297]);
  a.drawRectangle({
    x: 0,
    y: 0,
    width: 210,
    height: 297,
    color: rgb(0.94, 0.87, 0.68),
  });
  a.drawCircle({ x: 105, y: 160, size: 65, color: rgb(0.2, 0.4, 0.32) });
  a.drawText("VECTOR POSTER", { x: 20, y: 260, size: 17, font: f });
  a.drawText("TOYU FESTIVAL", { x: 20, y: 30, size: 16, font: f });
  const data = `data:application/pdf;base64,${Buffer.from(await source.save()).toString("base64")}`;
  p.assets.pdf = {
    id: "pdf",
    name: "ベクターポスター.pdf",
    mime: "application/pdf",
    width: 210,
    height: 297,
    data,
  };
  p.events.forEach((e) => (e.assetId = "pdf"));
  p.ads = ["quarter", "half", "full"].map((size, i) => ({
    id: `ad${i}`,
    sponsorId: "sp",
    size: size as "quarter" | "half" | "full",
    assetId: "pdf",
  }));
  p.sponsors = [{ id: "sp", name: "テスト企業", kana: "てすと", sortKey: "" }];
  p.blocks.splice(
    5,
    0,
    ...(["half", "full"] as const).map((size, i) => ({
      id: `more${i}`,
      template: "ads" as const,
      title: "協賛広告",
      chapterId: "ch5",
      adSize: size,
    })),
  );
  const { bytes, layout } = await exportPDF(p, { medium, bold });
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(layout.pages.length);
  for (const page of doc.getPages()) {
    expect(page.getWidth()).toBeCloseTo((148 * 72) / 25.4);
    expect(page.getHeight()).toBeCloseTo((210 * 72) / 25.4);
  }
  await mkdir("output/pdf", { recursive: true });
  await writeFile("output/pdf/verification.pdf", bytes);
  await writeFile("tmp/verification-project.json", JSON.stringify(p));
  expect(layout.issues.filter((i) => i.level === "error")).toHaveLength(0);
}, 60000);

it("手動順序の後に企画が増えた場合も、続きページは同じ章に追従する", () => {
  const p = createProject();
  p.events = events(5);
  attachPosters(p);
  const before = layoutProject(p);
  p.pageOrder = before.pages
    .filter((pg) => pg.template !== "blank")
    .map((pg) => pg.id);
  p.events = events(11);
  attachPosters(p);
  const after = layoutProject(p);
  const indexes = after.pages.flatMap((pg, i) =>
    pg.template === "posters" ? [i] : [],
  );
  expect(indexes).toEqual([3, 4, 5]);
  expect(after.pages.at(-1)?.template).toBe("back");
});

it("旧プロジェクトを広告125×180/85/45mmと縦長ポスター枠へ移行", () => {
  const old = structuredClone(createProject()) as any;
  old.schemaVersion = 1;
  old.theme.adWidth = 126;
  delete old.theme.adHalfHeight;
  delete old.theme.adQuarterHeight;
  delete old.theme.posterAspect;
  const p = validateProject(old);
  expect(p.schemaVersion).toBe(5);
  expect(p.theme.adWidth).toBe(125);
  expect(p.theme.adHalfHeight).toBe(85);
  expect(p.theme.adQuarterHeight).toBe(45);
  expect(old.schemaVersion).toBe(1);
});
it("T09の素材枠は添付ポスターの縦長比率に統一し1/4広告は125×45mm", () => {
  const p = createProject();
  p.events = events(4);
  p.events.forEach((e) => (e.assetId = "poster"));
  p.assets.poster = {
    id: "poster",
    name: "portrait.png",
    mime: "image/png",
    width: 1052,
    height: 1495,
    data: "data:image/png;base64,aA==",
  };
  const pg = layoutProject(p).pages.find((pg) => pg.template === "posters")!;
  for (const n of pg.nodes.filter((n) => n.kind === "asset")) {
    expect(n.w / n.h).toBeCloseTo(1052 / 1495, 6);
    expect(n.h).toBeGreaterThan(n.w);
  }
  const ad = pg.nodes.find((n) => n.kind === "rect" && n.stroke === "#d9d6cf")!;
  expect(ad.w).toBe(125);
  expect(ad.h).toBe(45);
});
