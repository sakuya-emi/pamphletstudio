import { describe, it, expect } from "vitest";
import { createProject, uid, type Event } from "../packages/core/model";
import { readSource, writeSource } from "../packages/core/editing";
import { layoutProject } from "../packages/layout-engine";
import { createDesign, object } from "../packages/designer/model";
import { renderTemplate } from "../packages/designer/render";
import { textPreset } from "../packages/designer/presets";
import { applyComponent } from "../packages/designer/components";

const event = (id: string, name: string, category: Event["category"] = "student"): Event => ({
  id, name, group: "団体", building: "本館", floor: 1, room: "C101", location: "",
  category, startTime: "10:00", endTime: "11:00", published: true,
});

describe("引き継ぎ仕様の回帰テスト", () => {
  it("目次から見出しの元データを特定して全ページを更新できる", () => {
    const p = createProject();
    p.events = [event("ev", "展示")];
    const toc = layoutProject(p).pages.find((pg) => pg.template === "contents")!;
    const b = p.blocks.find((b) => b.template === "events")!;
    const label = toc.nodes.find((n) => n.kind === "text" && n.text === b.title);
    expect(label?.source).toEqual({ type: "block", id: b.id, field: "title" });
    writeSource(p, label!.source!, "企画・展示");
    expect(layoutProject(p).pages.find((pg) => pg.template === "contents")!.nodes.some(
      (n) => n.kind === "text" && n.text === "企画・展示",
    )).toBe(true);
  });

  it("本文と箇条書きは元データを共有し、箇条書き項目だけ直接編集できる", () => {
    const p = createProject();
    const b = { id: uid(), chapterId: p.chapters[0].id, template: "notice" as const,
      title: "お知らせ", body: "持ち物を確認\n忘れ物に注意" };
    p.blocks = [b];
    const list = textPreset("箇条書き");
    p.templates = [list];
    applyComponent(p, b.id, list.id, { add: true });
    const nodes = layoutProject(p).pages.flatMap((pg) => pg.nodes);
    const first = nodes.find((n) => n.kind === "text" && n.text === "持ち物を確認");
    const second = nodes.find((n) => n.kind === "text" && n.text === "忘れ物に注意");
    expect(first?.source).toEqual({ type: "block", id: b.id, field: "bodyLine:0" });
    expect(second?.source).toEqual({ type: "block", id: b.id, field: "bodyLine:1" });
    expect(nodes.filter((n) => n.kind === "text" && n.text === "持ち物を確認")).toHaveLength(1);
    writeSource(p, second!.source!, "会場内は禁煙");
    expect(readSource(p, second!.source!)).toBe("会場内は禁煙");
    expect(p.blocks[0].body).toBe("持ち物を確認\n会場内は禁煙");
  });

  it("未装飾の本文もプレビューから元データへ移動できる", () => {
    const p = createProject();
    const b = { id: uid(), chapterId: "ch0", template: "notice" as const,
      title: "お願い", body: "お静かにお願いします" };
    p.blocks = [b];
    const node = layoutProject(p).pages.flatMap((pg) => pg.nodes).find(
      (n) => n.kind === "text" && n.text === "お静かにお願いします",
    );
    expect(node?.source).toEqual({ type: "block", id: b.id, field: "body" });
  });

  it("カスタム画像枠もポスターIDと編集対象フィールドを保持する", () => {
    const p = createProject();
    p.events = [event("e1", "画像あり"), event("e2", "画像なし")];
    p.assets.poster = { id: "poster", name: "ポスター", mime: "image/png",
      data: "data:image/png;base64,aGVsbG8=", width: 1000, height: 1500 };
    p.events[0].assetId = "poster";
    const t = createDesign("posters");
    const image = object("image", t.layers[0].id, 20, 25, 60, 80);
    image.binding = "event.poster";
    t.objects = [image];
    const nodes = renderTemplate(p, t)[0];
    const node = nodes.find((n) => n.kind === "asset");
    expect(node?.source).toEqual({ type: "event", id: "e1", field: "assetId" });
  });

  it("ステージ企画の時間割には一般企画を混入させない", () => {
    const p = createProject();
    p.events = [event("student", "一般の展示"), event("stage", "ステージ発表", "stage")];
    const t = createDesign("notice");
    const schedule = object("timetable", t.layers[0].id, 15, 25, 120, 100);
    t.objects = [schedule];
    const nodes = renderTemplate(p, t)[0];
    expect(nodes.some((n) => n.kind === "text" && n.text === "ステージ発表")).toBe(true);
    expect(nodes.some((n) => n.kind === "text" && n.text === "一般の展示")).toBe(false);
    expect(nodes.some((n) => n.kind === "text" && n.source?.type === "event" && n.source.id === "stage")).toBe(true);
  });

  it("非掲載広告を自動枠へ配置しない", () => {
    const p = createProject();
    p.blocks = p.blocks.filter((b) => b.template === "ads");
    p.ads = [
      { id: "hidden", sponsorId: "s", size: "quarter", published: false },
      { id: "visible", sponsorId: "s", size: "quarter", published: true },
    ];
    const layout = layoutProject(p);
    expect(layout.pages.flatMap((pg) => pg.slots.map((s) => s.adId)).includes("hidden")).toBe(false);
    expect(layout.pages.flatMap((pg) => pg.slots.map((s) => s.adId)).includes("visible")).toBe(true);
    expect(layout.issues.some((issue) => issue.message.includes("未配置広告") && issue.message.includes("hidden"))).toBe(false);
  });
});
