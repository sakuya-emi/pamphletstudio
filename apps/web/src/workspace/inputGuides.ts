import type { Project } from "../../../../packages/core/model";
import type { LayoutPage } from "../../../../packages/layout-engine";
import type { InputTarget } from "./ProductionEditor";
export interface InputGuide {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  target: InputTarget;
}
/** UI-only guides: never enter the layout nodes or PDF drawing stream. */
export function inputGuides(p: Project, page: LayoutPage): InputGuide[] {
  const b = p.blocks.find((b) => b.id === page.blockId);
  if (!b) return [];
  const guides: InputGuide[] = [];
  const base = { blockId: b.id, category: b.eventCategory };
  const add = (
    action: NonNullable<InputTarget["action"]>,
    label: string,
    y: number,
    h = 10,
  ) => guides.push({ x: 14, y, w: 120, h, label, target: { ...base, action } });
  const t = b.template;
  if (t === "back" && !b.backLayout && !p.logoId)
    guides.push({
      x: 15,
      y: 187,
      w: 80,
      h: 13,
      label: "大学ロゴを登録",
      target: {
        ...base,
        source: { type: "project", id: p.id, field: "logoId" },
      },
    });
  if (t === "cover" && !p.coverId)
    guides.push({
      x: 15,
      y: 78,
      w: 118,
      h: 49,
      label: "表紙画像を登録してください（学園祭名・開催日入りの画像）",
      target: {
        ...base,
        source: { type: "project", id: p.id, field: "coverId" },
      },
    });
  if (!b.title && t !== "cover")
    guides.push({
      x: 14,
      y: 10,
      w: 120,
      h: 10,
      label: "見出しを入力",
      target: { ...base, source: { type: "block", id: b.id, field: "title" } },
    });
  if (t === "events")
    add(
      "event",
      "＋ 企画を追加",
      p.events.some((e) => e.category === "student" || e.category === "food")
        ? 199
        : 35,
    );
  if (t === "posters" || (t === "events" && b.flowPosters)) {
    const assets = page.nodes.filter(
      (n) => n.source?.type === "event" && n.kind === "asset",
    );
    if (!assets.length)
      add("poster", "＋ ポスターを登録", t === "events" ? 60 : 32, 55);
    else add("poster", "＋ ポスターを登録", 199, 7);
  }
  if (t === "stage")
    add(
      "stage",
      "ステージ企画を追加・編集",
      p.events.some(
        (e) => e.category === "stage" || e.category === "studentStage",
      )
        ? 199
        : 35,
    );
  if (t === "kitchen")
    add(
      "kitchen",
      "＋ キッチンカーを追加",
      p.events.some((e) => e.category === "kitchen") ? 199 : 35,
    );
  if (t === "staff") add("staff", "＋ 氏名を追加", p.staff.length ? 199 : 35);
  if (t === "notice" && !b.openingKind && !b.body)
    guides.push({
      x: 14,
      y: 38,
      w: 120,
      h: 20,
      label: "項目を追加",
      target: { ...base, source: { type: "block", id: b.id, field: "body" } },
    });
  let missingSlot = 0;
  const boxes = page.nodes.filter(
    (n) => n.kind === "rect" && n.componentKind === "ad-placeholder",
  );
  for (const slot of page.slots) {
    const ad = p.ads.find((a) => a.id === slot.adId);
    if (ad?.assetId) continue;
    const box = boxes[missingSlot++];
    const i = page.slots.indexOf(slot),
      h =
        slot.size === "quarter"
          ? p.theme.adQuarterHeight
          : slot.size === "half"
            ? p.theme.adHalfHeight
            : p.theme.adHeight;
    const y =
      t === "posters" || t === "stage" || b.flowPosters
        ? 198 - h
        : 18 + i * (h + 5);
    guides.push({
      x: box?.x ?? (148 - p.theme.adWidth) / 2,
      y: box?.y ?? y,
      w: box?.w ?? p.theme.adWidth,
      h: box?.h ?? h,
      label: "広告を登録",
      target: {
        ...base,
        action: ad ? undefined : "ad",
        source: ad ? { type: "ad", id: ad.id, field: "assetId" } : undefined,
        slotKey: slot.key,
        size: slot.size as InputTarget["size"],
      },
    });
  }
  return guides;
}
