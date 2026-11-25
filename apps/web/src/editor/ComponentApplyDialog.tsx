import { currentPartId } from "../workspace/design-selection";
import {
  layoutProject,
  fallbackMeasure,
  type Measure,
} from "../../../../packages/layout-engine";
import { applyComponent } from "../../../../packages/designer/components";
import { Preview } from "../Preview";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Project, Block } from "../../../../packages/core/model";
import type { DesignTemplate } from "../../../../packages/designer/model";
import {
  blockDesign,
  findComponent,
} from "../../../../packages/designer/components";
export function ComponentApplyDialog({
  project,
  block,
  template,
  onApply,
  onClose,
  initialTarget,
  initialAll,
  measure = fallbackMeasure,
  inline = false,
}: {
  project: Project;
  block: Block;
  template: DesignTemplate;
  onApply: (options: {
    targetId?: string;
    add?: boolean;
    all?: boolean;
    master?: boolean;
    chapterId?: string;
  }) => void;
  onClose: () => void;
  initialTarget?: string;
  initialAll?: boolean;
  measure?: Measure;
  inline?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    d = blockDesign(project, block),
    candidates =
      d?.objects.filter(
        (o) =>
          o.kind === template.componentKind &&
          ((o.kind !== "text" &&
            template.objects[0].binding !== "advertisement") ||
            o.binding === template.objects[0].binding),
      ) || [];
  const fallback = findComponent(
    project,
    block,
    template.componentKind!,
    undefined,
    template.componentKind === "text" ? template.objects[0].binding : undefined,
  );
  if (!candidates.length && fallback) candidates.push(fallback);
  const [target, setTarget] = useState(
      candidates.find((o) => o.id === initialTarget)?.id ??
        candidates[0]?.id ??
        "",
    ),
    [scope, setScope] = useState(initialAll ? "all" : "current"),
    [add, setAdd] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(inline);
  const preview = useMemo(() => {
    if (!previewOpen) return null;
    try {
      const copy = structuredClone({ ...project, assets: {} });
      copy.assets = project.assets;
      if (scope === "master") {
        const design = copy.templates.find((t) => t.id === block.templateId);
        const master = copy.templates.find((t) => t.id === design?.masterId);
        const o = master?.objects.find(
          (o) =>
            o.kind === template.componentKind &&
            o.binding === template.objects[0].binding,
        );
        if (!o) throw new Error("共通マスターに対応する部品がありません。");
        o.templateRef = template.id;
      } else
        applyComponent(copy, block.id, template.id, {
          targetId: target || undefined,
          add,
          all: scope === "all" || scope === "chapter",
          chapterId: scope === "chapter" ? block.chapterId : undefined,
        });
      return {
        project: copy,
        page: layoutProject(copy, measure).pages.find(
          (p) => p.blockId === block.id,
        ),
      };
    } catch (e) {
      return { error: String(e) };
    }
  }, [previewOpen, project, block, template, scope, target, add, measure]);
  useEffect(() => {
    if (!inline) ref.current?.showModal();
  }, [inline]);
  const content = (
    <>
      {inline && (
        <p className="design-comparison-status">
          編集対象：{block.title}
          <br />
          現在使用中：
          {project.templates.find(
            (t) =>
              t.id ===
              currentPartId(project, block, template, target || undefined),
          )?.name ?? "標準デザイン"}
          <br />
          <strong>プレビュー中・未適用：{template.name}</strong>
        </p>
      )}
      {!inline && <h2>部品だけを変更</h2>}
      <p>
        「{block.title}」の
        {template.componentKind === "index"
          ? "インデックス"
          : template.componentKind === "table"
            ? "表"
            : "部品"}
        に「{template.name}
        」を適用します。ページ全体・登録情報・他の部品は維持します。
      </p>
      {candidates.length > 0 ? (
        <label>
          置き換える部品
          <select
            aria-label="置き換える部品"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            {candidates.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          <input
            type="checkbox"
            checked={add}
            onChange={(e) => setAdd(e.target.checked)}
          />{" "}
          このページに対応部品がありません。新しく追加する
        </label>
      )}
      <label>
        適用範囲
        <select
          value={scope}
          aria-label="部品の適用範囲"
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="current">選択した部品のみ（現在のページ）</option>
          <option value="chapter">現在の章の同種部品</option>

          <option value="all">同種の部品すべて（全ページ）</option>
          <option
            value="master"
            disabled={
              !project.templates
                .find((t) => t.id === d?.masterId)
                ?.objects.some(
                  (o) =>
                    o.kind === template.componentKind &&
                    o.binding === template.objects[0].binding,
                )
            }
          >
            共通マスター全体
          </option>
        </select>
      </label>
      <p>
        配置と個別の上書き設定を保持します。デザインの元テンプレートを編集すると、参照先にも反映されます。
      </p>
      {!inline && (
        <button onClick={() => setPreviewOpen((v) => !v)}>
          {previewOpen ? "プレビューを閉じる" : "適用前の紙面を確認"}
        </button>
      )}
      {preview &&
        ("error" in preview ? (
          <p role="alert">{preview.error}</p>
        ) : (
          preview.page && (
            <div className="apply-preview">
              <Preview page={preview.page} project={preview.project} thumb />
            </div>
          )
        ))}
      <footer>
        <button onClick={onClose}>キャンセル</button>
        <button
          className="primary"
          disabled={
            (!!preview && "error" in preview) ||
            (!candidates.length &&
              !add &&
              scope !== "all" &&
              scope !== "master")
          }
          onClick={() =>
            onApply({
              targetId: target || undefined,
              add,
              all: scope === "all" || scope === "chapter",
              chapterId: scope === "chapter" ? block.chapterId : undefined,
              master: scope === "master",
            })
          }
        >
          {inline ? "このデザインを適用" : "部品に適用"}
        </button>
      </footer>
    </>
  );
  return inline ? (
    <section aria-label="適用前の紙面">{content}</section>
  ) : (
    <dialog
      ref={ref}
      className="editor-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {content}
    </dialog>
  );
}
