import { useMemo } from "react";
import {
  type Block,
  type Template,
  templateNames,
} from "../../../../packages/core/model";
import { createFestivalSample } from "../../../../packages/core/festival-sample";
import {
  layoutProject,
  type Measure,
} from "../../../../packages/layout-engine";
import { tablePreset } from "../../../../packages/designer/presets";
import { applyComponent } from "../../../../packages/designer/components";
import { Preview } from "../Preview";

export const pageOptions: {
  template: Template;
  kind?: Block["openingKind"];
  name?: string;
  use: string;
}[] = [
  { template: "cover", use: "冊子の表紙画像" },
  { template: "contents", use: "見出しとページ番号を自動掲載" },
  { template: "events", use: "企画を建物・場所ごとに掲載" },
  { template: "posters", use: "ポスター4枚と1/4広告" },
  {
    template: "stage",
    kind: "schedule",
    use: "開始時刻順の見開きタイムテーブル",
  },
  { template: "kitchen", use: "会社名・メニュー・写真" },
  { template: "notice", use: "文章と画像を使う案内" },
  {
    template: "notice",
    kind: "leaders",
    name: "学園長・学長挨拶",
    use: "肩書・氏名・本文と写真",
  },
  {
    template: "notice",
    kind: "committee",
    name: "実行委員会挨拶",
    use: "実行委員長・副委員長の挨拶",
  },
  { template: "notice", kind: "map", name: "マップ", use: "学内マップ画像" },
  {
    template: "notice",
    kind: "survey",
    name: "アンケートのご案内",
    use: "案内画像・文章・QRコード",
  },
  {
    template: "notice",
    kind: "rules",
    name: "禁煙・禁酒",
    use: "会場内の注意事項",
  },
  {
    template: "notice",
    kind: "waste",
    name: "ゴミの分別",
    use: "分別方法の一覧",
  },
  { template: "sponsors", use: "協賛企業を一覧に掲載" },
  { template: "ads", use: "協賛広告を規格ごとに配置" },
  { template: "staff", use: "スタッフの氏名を掲載" },
  { template: "back", use: "裏表紙画像・大学周辺マップ・QR" },
];
export function templateLabel(template: Template) {
  return templateNames[template].replace(/^T\d+\s+/, "");
}
const tableVariants = [
  ["cards", "建物別カード"],
  ["stripe", "ストライプ"],
  ["split", "分割カラム"],
] as const;
type Variant = (typeof tableVariants)[number][0];
export function TableChoices({
  measure,
  select,
}: {
  measure: Measure;
  select: (v: Variant) => void;
}) {
  const thumbs = useMemo(
    () =>
      tableVariants.map(([v, label]) => {
        const p = createFestivalSample(),
          b = p.blocks.find((b) => b.template === "events")!;
        const t = tablePreset(v);
        p.templates.push(t);
        applyComponent(p, b.id, t.id);
        p.blocks = [b];
        p.theme.padding = 1;
        return { v, label, p, page: layoutProject(p, measure).pages[0] };
      }),
    [measure],
  );
  return (
    <div className="guide-choices">
      {thumbs.map(({ v, label, p, page }) => (
        <button key={v} onClick={() => select(v)}>
          <div className="template-thumb">
            <Preview page={page} project={p} thumb />
          </div>
          <b>{label}</b>
        </button>
      ))}
    </div>
  );
}
export function PageChoices({
  measure,
  select,
  only,
  current,
}: {
  measure: Measure;
  select?: (t: Template, k?: Block["openingKind"], name?: string) => void;
  only?: Template;
  current?: Block;
}) {
  const { p, pages } = useMemo(() => {
    const p = createFestivalSample();
    const chapterId = p.chapters[0].id;
    p.blocks.splice(2, 0, {
      id: "sample-notice",
      template: "notice",
      title: "お知らせ・案内",
      chapterId,
      body: "会場の案内をここに掲載します。\nこれは見本です。",
    });
    return { p, pages: layoutProject(p, measure).pages };
  }, [measure]);
  return (
    <div className="template-grid">
      {pageOptions
        .filter((o) => !only || o.template === only)
        .map(({ template, kind, name, use }) => {
          const b = p.blocks.find(
            (b) =>
              b.template === template &&
              (kind ? b.openingKind === kind : !b.openingKind),
          );
          const page = pages.find((pg) => pg.blockId === b?.id);
          const active =
            current?.template === template &&
            current?.openingKind === kind &&
            !current.templateId;
          return (
            <button
              key={kind ?? template}
              aria-pressed={active}
              disabled={!page || !select}
              onClick={() => select?.(template, kind, name)}
            >
              <div className="template-thumb">
                {page && <Preview page={page} project={p} thumb />}
              </div>
              <b>{name ?? templateLabel(template)}</b>
              <small>
                ページ · {use}
                {active ? " · 適用中" : ""}
                {!page ? " · 準備中" : !select ? " · 標準の見本" : ""}
              </small>
            </button>
          );
        })}
    </div>
  );
}
