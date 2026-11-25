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
      .filter((e) => e.published !== false)
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
  ];
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
