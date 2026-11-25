import { it, expect } from "vitest";
import { createFestivalSample } from "../packages/core/festival-sample";
import { layoutProject } from "../packages/layout-engine";
import { webStorage } from "../packages/project-storage";

it("時間軸とインデックスの選択を独立して保存する", async () => {
  const p = createFestivalSample();
  p.theme.scheduleStyle = "line";
  p.theme.indexShape = "square";
  const { project } = await webStorage.load(await webStorage.save(p));
  expect(project.theme).toMatchObject({
    scheduleStyle: "line",
    indexShape: "square",
  });
  const stage = layoutProject(project).pages.filter(
    (p) => p.template === "stage",
  );
  expect(stage).toHaveLength(2);
  expect(
    stage.every((p) =>
      p.nodes.some((n) => n.kind === "rect" && n.w === 135 && n.h === 0.3),
    ),
  ).toBe(true);
  expect(
    stage
      .flatMap((p) => p.nodes)
      .filter((n) => n.source?.field === "startTime" && n.kind === "text"),
  ).toHaveLength(2);
});
it("スタッフの役職と学年は見出し、氏名と企業名は白地に載る", () => {
  const p = createFestivalSample();
  p.theme.background = "#eee5db";
  const { pages } = layoutProject(p);
  const staff = pages.find((p) => p.template === "staff")!;
  const sponsors = pages.find((p) => p.template === "sponsors")!;
  for (const page of [staff, sponsors])
    expect(page.nodes[0]).toMatchObject({ fill: "#ffffff" });
  expect(
    staff.nodes.filter((n) => n.kind === "text").map((n) => n.text),
  ).toEqual(
    expect.arrayContaining([
      "実行委員長",
      "副実行委員長",
      "2年",
      "架空 委員長",
    ]),
  );
  expect(sponsors.nodes.some((n) => n.source?.type === "sponsor")).toBe(true);
});

it("縦書きタイムテーブルの長音だけを90度回転する", () => {
  const p = createFestivalSample();
  const event = p.events.find((e) => e.category === "stage")!;
  event.name = "ステージ";
  for (const style of ["bands", "line"] as const) {
    p.theme.scheduleStyle = style;
    const nodes = layoutProject(p)
      .pages.filter((pg) => pg.template === "stage")
      .flatMap((pg) => pg.nodes)
      .filter(
        (n) =>
          n.kind === "text" &&
          n.source?.id === event.id &&
          n.source.field === "name",
      );
    expect(
      nodes.find((n) => n.kind === "text" && n.text === "ー")?.rotation,
    ).toBe(90);
    expect(
      nodes.find((n) => n.kind === "text" && n.text === "ス")?.rotation,
    ).toBeUndefined();
  }
});
