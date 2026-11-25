import { verticalMark } from "../layout-engine/types";
import type { DesignObject } from "./model";
import type { Project } from "../core/model";
import { isStage, timeWarning } from "../core/registration";
import {
  text,
  rect,
  wrap,
  type Node,
  type Measure,
} from "../layout-engine/types";
const minutes = (s?: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s || "");
  return m ? +m[1] * 60 + +m[2] : undefined;
};
export function stageTimeline(
  o: DesignObject,
  p: Project,
  measure: Measure,
  range?: { start: number; end: number },
): Node[][] {
  const events = p.events
    .filter(
      (e) =>
        (isStage(e) || e.id.startsWith("preview-")) && e.published !== false,
    )
    .sort(
      (a, b) => (minutes(a.startTime) ?? 1e9) - (minutes(b.startTime) ?? 1e9),
    );
  if (!events.length)
    return [
      [
        {
          ...text(
            o.x,
            o.y,
            o.w,
            "ステージ企画を登録すると表示されます。",
            3,
            p.theme.silver,
          ),
          editorOnly: true,
        },
      ],
    ];
  const pages: Node[][] = [];
  const overflow: typeof events = [];
  const per = Math.max(1, Math.floor(o.itemsPerPage));
  for (let offset = 0; offset < events.length; offset += per) {
    const items = events.slice(offset, offset + per),
      n: Node[] = [];
    const allTimes = items
      .flatMap((e) => [minutes(e.startTime), minutes(e.endTime)])
      .filter((t): t is number => t !== undefined);
    const start =
        range?.start ?? Math.floor(Math.min(...allTimes, 9 * 60) / 60) * 60,
      end =
        range?.end ??
        Math.max(
          start + 60,
          Math.ceil(Math.max(...allTimes, 17 * 60) / 60) * 60,
        ),
      span = end - start,
      axis = o.vertical ? o.h : o.w,
      interval = Math.max(15, Math.min(120, o.tickMinutes || 60));
    for (let time = start; time <= end; time += interval) {
      const ratio = (time - start) / span,
        label = `${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}`;
      if (o.vertical) {
        const yy = o.y + ratio * (o.h - 5);
        n.push({
          ...rect(
            o.x + 15,
            yy,
            o.w - 15,
            0.2,
            o.stroke === "none" ? "#808080" : o.stroke,
          ),
        });
        n.push(
          text(
            o.x,
            yy,
            14,
            label,
            2.5,
            o.headerColor === "none" ? "#231815" : o.headerColor,
          ),
        );
      } else {
        const xx = o.x + ratio * (o.w - 10);
        n.push(
          rect(
            xx,
            o.y + 8,
            0.2,
            o.h - 8,
            o.stroke === "none" ? "#808080" : o.stroke,
          ),
        );
        n.push(text(xx, o.y, 10, label, 2.5, "#231815"));
      }
    }
    const laneEnds: number[] = [],
      placements = items.map((e) => {
        const ratio = Math.max(
            0,
            Math.min(0.95, ((minutes(e.startTime) ?? start) - start) / span),
          ),
          duration = Math.max(
            10,
            (minutes(e.endTime) ?? (minutes(e.startTime) ?? start) + 30) -
              (minutes(e.startTime) ?? start),
          ),
          x = o.x + ratio * (o.w - 14),
          w = Math.max(
            12,
            Math.min(o.w - (x - o.x), (duration / span) * (o.w - 14)),
          );
        let lane = laneEnds.findIndex((end) => end <= x + 0.001);
        if (lane < 0) lane = laneEnds.length;
        laneEnds[lane] = x + w;
        return { x, w, lane };
      });
    items.forEach((e, i) => {
      const ratio = Math.max(
          0,
          Math.min(0.95, ((minutes(e.startTime) ?? start) - start) / span),
        ),
        duration = Math.max(
          10,
          (minutes(e.endTime) ?? (minutes(e.startTime) ?? start) + 30) -
            (minutes(e.startTime) ?? start),
        ),
        student =
          e.category === "studentStage" ||
          (e.id.startsWith("preview-") && i % 2 === 1),
        fill = student ? o.studentStageColor || o.alternate : o.headerFill;
      let x: number, y: number, w: number, h: number;
      if (o.vertical) {
        x = o.x + 17 + (i * (o.w - 17)) / items.length;
        y = o.y + ratio * (o.h - 14);
        w = (o.w - 20) / items.length;
        h = Math.min(o.h - (y - o.y), Math.max(21, (duration / span) * o.h));
      } else {
        const placement = placements[i],
          lanes = Math.max(1, laneEnds.length);
        x = placement.x;
        w = placement.w;
        y = o.y + 12 + (placement.lane * (o.h - 12)) / lanes;
        h = (o.h - 12) / lanes - 2;
      }
      const source = { type: "event" as const, id: e.id, field: "name" };
      n.push({
        ...rect(
          x,
          y,
          w,
          h,
          fill,
          o.stroke === "none" ? undefined : o.stroke,
          o.radius,
        ),
        corners: o.corners,
        source,
        componentKind: "stage-event",
        groupId: String(o.vertical ? i % 2 : placements[i].lane),
      });
      const label =
        (student ? "学生ステージ" : "ステージ") +
        (timeWarning(e) ? " ※時刻要確認" : "");
      n.push(
        text(
          x + 1,
          y + 1,
          Math.max(1, w - 2),
          label,
          Math.min(2, w / 8),
          "#231815",
        ),
      );
      n.push({
        ...text(
          x + 1,
          y + 4,
          Math.max(1, w - 2),
          e.startTime || "未設定",
          2,
          "#231815",
        ),
        source: { type: "event", id: e.id, field: "startTime" },
      });
      if (e.endTime)
        n.push({
          ...text(x + 1, y + 7, Math.max(1, w - 2), e.endTime, 2, "#231815"),
          source: { type: "event", id: e.id, field: "endTime" },
        });
      if (o.verticalText && !o.vertical) {
        const chars = Array.from(e.name),
          max = Math.max(1, Math.floor((h - 16) / o.size));
        if (
          chars.length >
          max * Math.max(1, Math.floor((w - 1) / (o.size * 1.3)))
        )
          overflow.push(e);
        chars.forEach((ch, j) => {
          const cx = x + w - 1 - o.size - Math.floor(j / max) * (o.size * 1.3),
            cy = y + 12 + (j % max) * o.size;
          if (cx >= x)
            n.push({
              ...text(cx, cy, o.size, ch, o.size, "#231815", true),
              ...verticalMark(ch, cx, cy, o.size),
              source,
            });
        });
      } else {
        const ls = wrap(e.name, Math.max(2, w - 2), o.size, measure, true);
        const limit = Math.max(1, Math.floor((h - 13) / (o.size * 1.4)));
        if (ls.length > limit) overflow.push(e);
        ls.slice(0, limit).forEach((s, j) =>
          n.push({
            ...text(
              x + 1,
              y + 12 + j * o.size * 1.4,
              w - 2,
              s,
              o.size,
              "#231815",
              true,
            ),
            source,
          }),
        );
      }
    });
    pages.push(n);
  }
  if (overflow.length) {
    let lines: Node[] = [],
      y = o.y;
    const next = () => {
      lines = [text(o.x, o.y, o.w, "長い企画名の補足", 3, "#231815", true)];
      pages.push(lines);
      y = o.y + 8;
    };
    next();
    for (const e of overflow) {
      const source = { type: "event" as const, id: e.id, field: "name" };
      for (const line of wrap(e.name, o.w, 3, measure, true)) {
        if (y + 4.2 > o.y + o.h) next();
        lines.push({ ...text(o.x, y, o.w, line, 3, "#231815"), source });
        y += 4.2;
      }
      y += 4;
    }
  }
  return pages;
}
