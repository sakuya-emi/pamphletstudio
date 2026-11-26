import type {
  LayoutPage,
  Node,
} from "../../../../packages/layout-engine/types";
import type { Project } from "../../../../packages/core/model";
import {
  adCompany,
  eventCategory,
} from "../../../../packages/core/registration";
import type { DataSource } from "../../../../packages/core/editing";

export const basicFields = [
  "edition",
  "date",
  "time",
  "university",
  "festival",
  "tagline",
  "festivalDisplay",
];
export function excelManaged(source: DataSource) {
  return source.type === "project" && basicFields.includes(source.field);
}
export function mediaItems(project: Project) {
  return [
    {
      collection: "cover" as const,
      id: project.id,
      title: "表紙画像",
      label: "表紙",
      detail: "学園祭名・開催日入りの完成画像を登録してください。",
      assetId: project.coverId,
    },
    ...project.events
      .filter(
        (e) =>
          e.published !== false &&
          (eventCategory(e) === "kitchen" || e.posterRequired !== false),
      )
      .sort(
        (a, b) =>
          Number(eventCategory(a) === "kitchen") -
          Number(eventCategory(b) === "kitchen"),
      )
      .map((e) => ({
        collection: "events" as const,
        id: e.id,
        title: e.name,
        label: eventCategory(e) === "kitchen" ? "店舗画像" : "ポスター",
        detail: [e.group, e.location].filter(Boolean).join(" · "),
        assetId: e.assetId,
      })),
    ...project.blocks
      .filter((b) => b.externalEvent && b.posterRequired !== false)
      .map((b) => ({
        collection: "blocks" as const,
        id: b.id,
        title: b.title,
        label: "ポスター",
        detail: "外部・特別企画",
        assetId: b.assetId,
      })),
    ...project.ads
      .filter((a) => a.published !== false)
      .map((a) => ({
        collection: "ads" as const,
        id: a.id,
        title: adCompany(project, a.id),
        label: "広告画像",
        detail: { full: "1ページ", half: "1/2ページ", quarter: "1/4ページ" }[
          a.size
        ],
        assetId: a.assetId,
      })),
  ].sort(
    (a, b) =>
      ["表紙", "ポスター", "店舗画像", "広告画像"].indexOf(a.label) -
      ["表紙", "ポスター", "店舗画像", "広告画像"].indexOf(b.label),
  );
}
export function mediaSummary(project: Project) {
  const items = mediaItems(project);
  return {
    total: items.length,
    missing: items.filter((i) => !i.assetId || !project.assets[i.assetId])
      .length,
    breakdown: ["表紙", "ポスター", "店舗画像", "広告画像"]
      .map(
        (label) => `${label}${items.filter((i) => i.label === label).length}件`,
      )
      .join(" ／ "),
  };
}
export function uniqueProjectName(
  projects: Pick<Project, "name">[],
  base = "稲友祭パンフレット",
) {
  const names = new Set(projects.map((p) => p.name));
  let name = base,
    n = 2;
  while (names.has(name)) name = `${base} (${n++})`;
  return name;
}
export function outputPages(total: number, padding: number) {
  return `出力${total}ページ（誌面${total - padding}ページ＋自動白紙${padding}ページ）`;
}

export function automaticBlankCounts(pages: LayoutPage[]) {
  const start = pages.filter(
    (p) => p.template === "blank" && p.automatic?.kind === "start",
  ).length;
  const padding = pages.filter(
    (p) => p.template === "blank" && p.automatic?.kind === "padding",
  ).length;
  return { start, padding, total: start + padding };
}
export function sourceEditLabel(project: Project, source: DataSource) {
  const names: Record<string, string> = {
    name: "名称",
    group: "団体名",
    building: "建物",
    floor: "階数",
    room: "教室",
    location: "開催場所",
    place: "開催場所",
    placeShort: "開催場所",
    startTime: "開始時刻",
    endTime: "終了時刻",
    timeRange: "開催時刻",
    title: "見出し",
    body: "本文",
    assetId: "画像1",
    secondAssetId: "画像2",
    thirdAssetId: "画像3",
    coverId: "表紙画像",
    logoId: "大学ロゴ",
    websiteUrl: "大学ウェブサイトのURL",
    surveyUrl: "アンケートのURL",
    festivalDisplay: "開催回数・学園祭名",
    date: "開催日",
    time: "開催時間",
    edition: "開催回数",
    festival: "学園祭名",
    university: "大学名",
    tagline: "テーマ",
  };
  const title =
    source.type === "chapter"
      ? "章名"
      : source.type === "pageNumber"
        ? "ページ番号"
        : (names[source.field] ??
          (source.field.startsWith("bodyLine:")
            ? `本文の項目${Number(source.field.split(":")[1]) + 1}`
            : "内容"));
  const record =
    source.type === "chapter"
      ? project.chapters.find((x) => x.id === source.id)?.name
      : source.type === "event"
        ? project.events.find((x) => x.id === source.id)?.name
        : source.type === "block"
          ? project.blocks.find((x) => x.id === source.id)?.title
          : source.type === "staff"
            ? project.staff.find((x) => x.id === source.id)?.name
            : undefined;
  return `${title}を編集${record ? "：" + record : ""}`;
}

export function editTargets(nodes: Node[]): Node[] {
  const targets = new Map<string, Node>();
  for (const n of nodes) {
    if (!n.source) continue;
    const key = JSON.stringify([
      n.source.type,
      n.source.id,
      n.source.field,
      n.objectId,
      n.source.field === "surveyUrl" && n.kind === "text" && !n.editorOnly
        ? "url-label"
        : "",
    ]);
    const previous = targets.get(key);
    if (!previous) targets.set(key, { ...n });
    else {
      const x = Math.min(previous.x, n.x),
        y = Math.min(previous.y, n.y);
      targets.set(key, {
        ...previous,
        x,
        y,
        w: Math.max(previous.x + previous.w, n.x + n.w) - x,
        h: Math.max(previous.y + previous.h, n.y + n.h) - y,
      });
    }
  }
  return [...targets.values()];
}
export function sourcePage(
  layout: { pages: LayoutPage[] },
  source: DataSource,
) {
  return layout.pages.find(
    (pg) =>
      (source.type === "ad" && pg.slots.some((s) => s.adId === source.id)) ||
      (source.type === "block" && pg.blockId === source.id) ||
      pg.nodes.some(
        (n) => n.source?.type === source.type && n.source.id === source.id,
      ),
  );
}
