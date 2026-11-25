import { useState } from "react";
import type { DesignTemplate } from "../../../../packages/designer/model";
import type { Project } from "../../../../packages/core/model";
import { renderTemplate } from "../../../../packages/designer/render";
import type { Measure, LayoutPage } from "../../../../packages/layout-engine";
import { Preview } from "../Preview";
export const category = (t: DesignTemplate) =>
  t.category ||
  (t.objects.some((o) => o.kind === "table")
    ? "表"
    : t.objects.some((o) => o.kind === "timetable")
      ? "タイムテーブル"
      : t.objects.some((o) => o.kind === "posters")
        ? "ポスター紹介"
        : t.kind === "ads"
          ? "広告"
          : t.objects.some((o) => o.kind === "index")
            ? "インデックス"
            : "自由配置");
export function TemplatePanel({
  project,
  measure,
  id,
  onSelect,
  onNew,
}: {
  project: Project;
  measure: Measure;
  id: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const [filter, setFilter] = useState("すべて"),
    [scope, setScope] = useState("all");
  return (
    <section>
      <div className="panel-heading">
        <h3>テンプレート</h3>
        <button onClick={onNew}>＋ 新規</button>
      </div>
      <label className="panel-filter">
        分類
        <select
          aria-label="テンプレートの分類"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="all">すべての分類</option>
          <option value="page">ページ全体</option>
          <option value="component">部品のみ</option>
          <option value="master">共通マスター</option>
          <option value="style">スタイル</option>
        </select>
      </label>
      <label className="panel-filter">
        種類
        <select
          aria-label="テンプレートの絞り込み"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {[
            "すべて",
            "見出し",
            "ページ番号",
            "本文",
            "箇条書き",
            "画像",
            "共通装飾",
            "表",
            "インデックス",
            "タイムテーブル",
            "ポスター紹介",
            "広告",
            "自由配置",
          ].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      {project.templates
        .filter((t) => scope === "all" || (t.scope || "page") === scope)
        .filter((t) => filter === "すべて" || category(t) === filter)
        .map((t) => {
          const pg: LayoutPage = {
            id: t.id,
            blockId: "",
            title: t.name,
            chapterId: "",
            template: "notice",
            physical: 1,
            side: "right",
            nodes: renderTemplate(project, t, measure)[0] || [],
            slots: [],
          };
          return (
            <button
              className={`designer-library-item ${id === t.id ? "selected" : ""}`}
              key={t.id}
              onClick={() => onSelect(t.id)}
            >
              <Preview page={pg} project={project} thumb />
              <span>
                {t.name}
                <small>
                  {t.scope === "component"
                    ? "部品のみ"
                    : t.scope === "master"
                      ? "共通マスター"
                      : t.scope === "style"
                        ? "スタイル"
                        : "ページ全体"}{" "}
                  · {category(t)} · v{t.version}
                </small>
              </span>
            </button>
          );
        })}
      <p className="hint">
        共通デザインは、公開した版を冊子のデザイン選択から適用します。共通ライブラリでは下書きです。公開した版を冊子で選んだときだけ反映されます。
      </p>
    </section>
  );
}
