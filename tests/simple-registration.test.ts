import { it, expect } from "vitest";
import { createProject, listingEvents, nextYear } from "../packages/core/model";
import {
  addEvent,
  addStaff,
  addAd,
  setAdCompany,
  adCompany,
  addMenu,
  menus,
  timeWarning,
  nextRecordId,
  setCategory,
} from "../packages/core/registration";
import { layoutProject } from "../packages/layout-engine";
import { webStorage, validateProject } from "../packages/project-storage";
import { stagePreset, tablePreset } from "../packages/designer/presets";
import { applyComponent } from "../packages/designer/components";
import { stageTimeline } from "../packages/designer/stage-timeline";
import { fallbackMeasure } from "../packages/layout-engine";
import { exportPDF } from "../packages/pdf-export";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
it("氏名のみで登録し、旧スタッフ情報は保持する", () => {
  const p = createProject();
  p.staff.push({
    id: "old",
    name: "旧委員",
    kana: "きゅう",
    grade: 3,
    role: "委員長",
  });
  const s = addStaff(p, "山田太郎");
  expect(s.name).toBe("山田太郎");
  expect(p.staff[0]).toEqual({
    id: "old",
    name: "旧委員",
    kana: "きゅう",
    grade: 3,
    role: "委員長",
  });
  p.blocks = [
    {
      id: "staff-page",
      template: "staff",
      title: "スタッフ",
      chapterId: p.chapters[6].id,
    },
  ];
  const n = layoutProject(p).pages.flatMap((pg) => pg.nodes);
  expect(n.some((n) => n.kind === "text" && n.text === "山田太郎")).toBe(true);
  expect(n.some((n) => n.kind === "text" && n.text.includes("0年"))).toBe(
    false,
  );
});
it("広告は企業名を再利用し、複数広告の識別は独立する", () => {
  const p = createProject(),
    a = addAd(p),
    b = addAd(p);
  setAdCompany(p, a.id, "株式会社美ノ久");
  setAdCompany(p, b.id, " 株式会社美ノ久 ");
  expect(p.sponsors).toHaveLength(1);
  expect(a.sponsorId).toBe(b.sponsorId);
  expect(a.id).not.toBe(b.id);
  expect(adCompany(p, a.id)).toBe("株式会社美ノ久");
  setAdCompany(p, a.id, "別の会社");
  expect(adCompany(p, b.id)).toBe("株式会社美ノ久");
});
it("自動番号は削除・並べ替え・保存復元後も再利用しない", async () => {
  const p = createProject();
  p.events.push({
    id: "7",
    name: "旧",
    group: "",
    building: "",
    floor: 1,
    room: "",
    location: "",
  });
  const first = addEvent(p, "food");
  expect(+first.id).toBeGreaterThan(0);
  const id = first.id;
  p.events = p.events.filter((e) => e.id !== id);
  const q = (await webStorage.load(await webStorage.save(p))).project;
  const second = addEvent(q, "student");
  expect(second.id).not.toBe(id);
  expect(q.events.find((e) => e.name === "旧")?.id).toBe("7");
  expect(
    new Set([...q.events, ...q.ads, ...q.staff, ...q.sponsors].map((r) => r.id))
      .size,
  ).toBe(q.events.length + q.ads.length + q.staff.length + q.sponsors.length);
});
it("5種を分離し、一覧には学生・模擬店・キッチンカーだけを掲載する", () => {
  const p = createProject();
  for (const c of [
    "student",
    "food",
    "stage",
    "studentStage",
    "kitchen",
  ] as const) {
    const e = addEvent(p, c);
    e.name = c;
    e.building = c === "kitchen" ? "" : "本館";
  }
  expect(
    listingEvents(p)
      .map((e) => e.name)
      .sort(),
  ).toEqual(["food", "kitchen", "student"]);
  for (const t of [undefined, tablePreset("stripe")]) {
    const q = structuredClone(p),
      block = q.blocks.find((b) => b.template === "events")!;
    if (t) {
      q.templates.push(t);
      applyComponent(q, block.id, t.id);
    }
    const nodes = layoutProject(q)
      .pages.filter((pg) => pg.blockId === block.id)
      .flatMap((pg) => pg.nodes);
    expect(
      nodes.some(
        (n) =>
          n.source?.type === "event" &&
          p.events.find((e) => e.id === n.source!.id)?.category === "stage",
      ),
    ).toBe(false);
    expect(nodes.some((n) => n.kind === "text" && n.text === "kitchen")).toBe(
      true,
    );
    expect(nodes.some((n) => n.kind === "text" && n.text.includes("0階"))).toBe(
      false,
    );
  }
});
it("ステージ2種が時刻順で掲載され、デザイン変更は登録値を保持する", () => {
  const p = createProject(),
    student = addEvent(p, "studentStage"),
    stage = addEvent(p, "stage");
  Object.assign(student, {
    name: "学生バンド",
    startTime: "11:00",
    endTime: "11:30",
  });
  Object.assign(stage, {
    name: "開会式",
    startTime: "09:30",
    endTime: "10:00",
  });
  const h = stagePreset(),
    v = stagePreset(true);
  p.templates.push(h, v);
  const block = p.blocks.find((b) => b.template === "stage")!;
  const saved = structuredClone(p.events);
  applyComponent(p, block.id, h.id);
  const n = layoutProject(p).pages.find((pg) => pg.blockId === block.id)!.nodes;
  expect(
    n.some((n) => n.kind === "text" && n.text.includes("学生ステージ")),
  ).toBe(true);
  const a = n.find((n) => n.source?.id === stage.id)!,
    b = n.find((n) => n.source?.id === student.id)!;
  expect(a.x).toBeLessThan(b.x);
  applyComponent(p, block.id, v.id);
  expect(p.events).toEqual(saved);
  expect(p.blocks.filter((b) => b.template === "stage")).toHaveLength(1);
});
it("無効時刻は内容を削除せず警告する", () => {
  const p = createProject(),
    e = addEvent(p, "stage");
  e.startTime = "15:00";
  e.endTime = "14:00";
  expect(timeWarning(e)).toContain("後");
  expect(e.endTime).toBe("14:00");
  expect(() =>
    stageTimeline(stagePreset().objects[0], p, fallbackMeasure),
  ).not.toThrow();
});
it("キッチンカーの複数メニューはIDで関連付け、全メニューを自動改ページする", () => {
  const p = createProject(),
    e = addEvent(p, "kitchen");
  e.name = "テストキッチン";
  for (let i = 0; i < 40; i++) addMenu(p, e.id, "メニュー" + i);
  const ms = menus(p, e.id);
  [ms[0].order, ms[1].order] = [ms[1].order, ms[0].order];
  expect(menus(p, e.id)[0].name).toBe("メニュー1");
  const n = layoutProject(p)
    .pages.filter((pg) => pg.template === "kitchen")
    .flatMap((pg) => pg.nodes);
  for (const m of ms)
    expect(
      n.some(
        (n) => n.kind === "text" && n.text === m.name && n.source?.id === m.id,
      ),
    ).toBe(true);
  expect(
    layoutProject(p).pages.filter((pg) => pg.template === "kitchen").length,
  ).toBeGreaterThan(1);
  e.assetId = "new-image";
  expect(menus(p, e.id)).toHaveLength(40);
  expect(e.name).toBe("テストキッチン");
});
it("種別の変更と旧データ読込で、ID・画像・文章・旧項目を保持する", async () => {
  const p = createProject(true),
    e = p.events[0];
  e.assetId = "old-image";
  e.notes = "備考";
  const old = structuredClone(e);
  setCategory(p, e.id, "studentStage");
  expect(p.blocks.some((b) => b.template === "stage")).toBe(true);
  expect({ ...e, category: undefined }).toEqual({
    ...old,
    category: undefined,
  });
  const q = validateProject({ ...p, schemaVersion: 4 });
  expect(q.events[0].id).toBe(old.id);
  expect(q.events[0].assetId).toBe("old-image");
  expect(q.templates).toEqual(p.templates);
  const k = addEvent(q, "kitchen");
  addMenu(q, k.id, "フランスドッグ");
  const restored = (await webStorage.load(await webStorage.save(q))).project;
  expect(restored.kitchenMenus).toEqual(q.kitchenMenus);
  expect(restored.events).toEqual(q.events);
  expect(nextYear(restored).kitchenMenus).toEqual([]);
});
it("横・縦時間軸とキッチンカーを既存ベクターPDF出力で検証", async () => {
  const p = createProject();
  p.theme.padding = 1;
  p.blocks = [];
  const a = addEvent(p, "stage"),
    b = addEvent(p, "studentStage"),
    k = addEvent(p, "kitchen");
  Object.assign(a, { name: "開会式", startTime: "09:30", endTime: "10:00" });
  Object.assign(b, {
    name: "学生バンド",
    startTime: "11:00",
    endTime: "11:45",
  });
  k.name = "サンプル会社（校正用）";
  addMenu(p, k.id, "フランスドッグ");
  addMenu(p, k.id, "トンテキ丼");
  const medium = new Uint8Array(
      await readFile("public/fonts/NotoSansCJKjp-Medium.ttf"),
    ),
    bold = new Uint8Array(
      await readFile("public/fonts/NotoSansCJKjp-Bold.ttf"),
    );
  const result = await exportPDF(p, { medium, bold });
  const pdf = await PDFDocument.load(result.bytes);
  expect(pdf.getPageCount()).toBe(result.layout.pages.length);
  for (const pg of pdf.getPages()) {
    expect((pg.getWidth() * 25.4) / 72).toBeCloseTo(148);
    expect((pg.getHeight() * 25.4) / 72).toBeCloseTo(210);
  }
  expect(result.layout.issues.filter((i) => i.level === "error")).toEqual([]);
  await mkdir("output/pdf", { recursive: true });
  await writeFile(
    "output/pdf/simple-registration-verification.pdf",
    result.bytes,
  );
}, 60000);

it("ステージポスターは専用紹介へ、キッチンカー画像は紹介ページへ配置する", () => {
  const p = createProject();
  p.theme.padding = 1;
  const s = addEvent(p, "stage"),
    k = addEvent(p, "kitchen");
  s.name = "ステージ";
  s.startTime = "10:00";
  s.endTime = "11:00";
  k.name = "キッチン";
  p.assets.img = {
    id: "img",
    name: "素材",
    mime: "image/png",
    width: 100,
    height: 140,
    data: "data:image/png;base64,",
  };
  s.assetId = k.assetId = "img";
  const layout = layoutProject(p),
    stage = layout.pages.find(
      (pg) => pg.template === "stage" && pg.slots.length,
    )!;
  expect(
    stage.nodes.filter((n) => n.kind === "asset" && n.source?.id === s.id),
  ).toHaveLength(1);
  expect(stage.nodes.some((n) => n.w === 125 && n.h === 45)).toBe(true);
  expect(
    layout.pages
      .filter((pg) => pg.template === "events")
      .flatMap((pg) => pg.nodes)
      .filter((n) => n.kind === "asset" && n.source?.id === k.id),
  ).toHaveLength(0);
});

it("非常に長いステージ名は補足ページに全文を保持する", () => {
  const p = createProject(),
    e = addEvent(p, "stage");
  e.name = "長い企画の名称".repeat(150);
  e.startTime = "10:00";
  e.endTime = "10:15";
  for (const t of [stagePreset(), stagePreset(true)]) {
    const pages = stageTimeline(t.objects[0], p, fallbackMeasure);
    expect(pages.length).toBeGreaterThan(1);
    const text = pages
      .slice(1)
      .flat()
      .filter((n) => n.kind === "text" && n.source?.id === e.id)
      .map((n) => (n.kind === "text" ? n.text : ""))
      .join("");
    expect(text).toBe(e.name);
  }
});

it("メニュー削除後の追加でも順序が重複しない", () => {
  const p = createProject(),
    e = addEvent(p, "kitchen");
  const a = addMenu(p, e.id, "A"),
    b = addMenu(p, e.id, "B"),
    c = addMenu(p, e.id, "C");
  p.kitchenMenus = p.kitchenMenus!.filter((m) => m.id !== a.id);
  const d = addMenu(p, e.id, "D");
  expect(new Set(menus(p, e.id).map((m) => m.order)).size).toBe(3);
  expect(menus(p, e.id).map((m) => m.name)).toEqual(["B", "C", "D"]);
});
