import { expect, it } from "vitest";
import { createFestivalProject } from "../packages/core/festival-opening";
import { addEvent } from "../packages/core/registration";
import { layoutProject } from "../packages/layout-engine";
import { webStorage } from "../packages/project-storage";

it.each([1, 2, 4, 6])(
  "色帯と縦書きの%s件は1ページのカードに集約し、時刻と名前を保持",
  async (count) => {
    const p = createFestivalProject();
    p.theme.scheduleStyle = "bands";
    for (let i = count - 1; i >= 0; i--) {
      const e = addEvent(p, i % 2 ? "studentStage" : "stage");
      e.name = i === 0 ? "開会式ステージ" : "長い企画名称".repeat(i * 3);
      e.startTime = `${10 + i}:00`;
      e.endTime = `${10 + i}:30`;
      e.posterRequired = false;
    }
    const { project } = await webStorage.load(await webStorage.save(p));
    expect(project.theme.scheduleStyle).toBe("bands");
    for (const binding of ["left", "right"] as const) {
      project.theme.binding = binding;
      const pages = layoutProject(project).pages.filter(
        (pg) => pg.template === "stage",
      );
      expect(pages).toHaveLength(1);
      const nodes = pages[0].nodes;
      for (const e of p.events) {
        const names = nodes.filter(
          (n) => n.source?.id === e.id && n.source.field === "name",
        );
        expect(
          names
            .filter((n) => n.kind === "text")
            .map((n) => (n.kind === "text" ? n.text : ""))
            .join(""),
        ).toBe(e.name);
        expect(
          nodes.some(
            (n) =>
              n.kind === "text" &&
              n.source?.id === e.id &&
              n.text === `${e.startTime}〜${e.endTime}`,
          ),
        ).toBe(true);
        for (const n of names) {
          expect(n.x).toBeGreaterThanOrEqual(14);
          expect(n.x + n.w).toBeLessThanOrEqual(134);
          expect(n.y + n.h).toBeLessThan(181);
        }
      }
      expect(
        nodes.some(
          (n) => n.kind === "text" && n.text === "ー" && n.rotation === 90,
        ),
      ).toBe(true);
      if (count >= 4)
        expect(
          Math.max(
            ...nodes
              .filter((n) => n.kind === "rect" && !n.source)
              .map((n) => n.y + n.h),
          ),
        ).toBeGreaterThan(170);
      expect(
        nodes
          .filter((n) => n.kind === "text" && n.source?.field === "startTime")
          .map((n) => n.source?.id),
      ).toEqual([...p.events].reverse().map((e) => e.id));
    }
  },
);
