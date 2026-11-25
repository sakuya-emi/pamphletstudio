import { useMemo, useState } from "react";
import { type Project } from "../../../../packages/core/model";
import { type DesignTemplate } from "../../../../packages/designer/model";
import {
  installRelease,
  type LibraryRelease,
} from "../../../../packages/designer/library";
import {
  layoutProject,
  type Measure,
} from "../../../../packages/layout-engine";
import { Preview } from "../Preview";
export function LibraryPageDialog({
  project,
  template,
  release,
  blockId,
  all,
  measure,
  apply,
  close,
  inline = false,
}: {
  project: Project;
  template: DesignTemplate;
  release?: LibraryRelease;
  blockId?: string;
  all: boolean;
  measure: Measure;
  apply: (blockId: string, all: boolean) => void;
  close: () => void;
  inline?: boolean;
}) {
  const master = template.scope === "master";
  const candidates = project.blocks.filter((b) =>
    master ? !!b.templateId : b.template === template.kind,
  );
  const [selected, setSelected] = useState(
    candidates.find((b) => b.id === blockId)?.id ?? candidates[0]?.id ?? "",
  );
  const [scopeAll, setScopeAll] = useState(all);
  const preview = useMemo(() => {
    try {
      const p = structuredClone({ ...project, assets: {} });
      p.assets = { ...project.assets };
      if (release) installRelease(p, release);
      else if (!p.templates.some((t) => t.id === template.id))
        p.templates.push(template);
      const targets = candidates.filter((b) => scopeAll || b.id === selected);
      for (const target of targets) {
        const b = p.blocks.find((b) => b.id === target.id)!;
        if (master) {
          const design = p.templates.find((t) => t.id === b.templateId);
          if (design) design.masterId = template.id;
        } else b.templateId = template.id;
      }
      return {
        project: p,
        page: layoutProject(p, measure).pages.find(
          (pg) => pg.blockId === selected,
        ),
      };
    } catch (e) {
      return { error: String(e) };
    }
  }, [project, template, release, selected, scopeAll, measure]);
  const target = candidates.find((b) => b.id === selected);
  const design = project.templates.find((t) => t.id === target?.templateId);
  const current = master
    ? project.templates.find((t) => t.id === design?.masterId)
    : design;
  const content = (
    <>
      {inline && (
        <p className="design-comparison-status">
          編集対象：{target?.title ?? "対象なし"}
          <br />
          現在使用中：
          {current?.name ?? (master ? "共通マスターなし" : "標準デザイン")}
          <br />
          <strong>プレビュー中・未適用：{template.name}</strong>
        </p>
      )}
      <h2>
        {template.name} · v{template.version}
      </h2>
      <p>
        {master
          ? "共通マスターを変更します。"
          : "このデザインはページ全体を変更します。"}
        登録内容と素材は保持します。確定前に紙面を確認してください。
      </p>
      <label>
        対象ページ{" "}
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {candidates.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={scopeAll}
          onChange={(e) => setScopeAll(e.target.checked)}
        />
        同じ種類のページすべて
      </label>
      {"error" in preview ? (
        <p role="alert">{preview.error}</p>
      ) : (
        preview.page && (
          <div className="apply-preview">
            <Preview page={preview.page} project={preview.project} thumb />
          </div>
        )
      )}
      {!candidates.length && (
        <p>対応するページがありません。先にページを追加してください。</p>
      )}
      <button onClick={close}>キャンセル</button>
      <button
        className="primary"
        disabled={!selected || "error" in preview}
        onClick={() => apply(selected, scopeAll)}
      >
        {inline ? "このデザインを適用" : "確認して適用"}
      </button>
    </>
  );
  return inline ? (
    <section aria-label="適用前の紙面">{content}</section>
  ) : (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="公開デザインの適用確認"
      >
        {content}
      </section>
    </div>
  );
}
