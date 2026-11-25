import type { Project } from "../../../../packages/core/model";
import { uid, insertBlock } from "../../../../packages/core/model";
import {
  layoutProject,
  type Measure,
} from "../../../../packages/layout-engine";
import { Preview } from "../Preview";
export function PagePanel({
  project,
  measure,
  onEdit,
  onSelect,
  current,
}: {
  project: Project;
  measure: Measure;
  onEdit: (fn: (p: Project) => void) => void;
  onSelect: (blockId: string) => void;
  current?: string;
}) {
  const pages = layoutProject(project, measure).pages;
  function shift(id: string, d: number) {
    onEdit((p) => {
      const i = p.blocks.findIndex((b) => b.id === id),
        j = i + d;
      if (j >= 0 && j < p.blocks.length) {
        [p.blocks[i], p.blocks[j]] = [p.blocks[j], p.blocks[i]];
        p.pageOrder = [];
      }
    });
  }
  return (
    <section>
      <div className="panel-heading">
        <h3>制作ページ</h3>
        <button
          onClick={() =>
            onEdit((p) =>
              insertBlock(p, {
                id: uid(),
                title: "お知らせ",
                template: "notice",
                chapterId: p.chapters[0]?.id,
              }),
            )
          }
        >
          ＋ 追加
        </button>
      </div>
      <p className="hint">
        制作するページを選択します。カスタムデザインは編集対象が切り替わり、標準ページは制作モードで開きます。
      </p>
      {project.blocks.map((b) => (
        <div className="editor-page-row" key={b.id}>
          <button
            className={`designer-library-item ${b.id === current ? "selected" : ""}`}
            onClick={() => onSelect(b.id)}
          >
            {pages.find((p) => p.blockId === b.id) && (
              <Preview
                page={pages.find((p) => p.blockId === b.id)!}
                project={project}
                thumb
              />
            )}
            <span>
              {b.title}
              <small>
                {pages.filter((p) => p.blockId === b.id).length}ページ
              </small>
            </span>
          </button>
          <div className="page-row-actions">
            <button
              aria-label={`${b.title}を前へ`}
              onClick={() => shift(b.id, -1)}
            >
              ↑
            </button>
            <button
              aria-label={`${b.title}を後へ`}
              onClick={() => shift(b.id, 1)}
            >
              ↓
            </button>
            <button
              onClick={() =>
                onEdit((p) => {
                  const n = structuredClone(b);
                  n.id = uid();
                  n.title += " コピー";
                  insertBlock(p, n);
                })
              }
            >
              複製
            </button>
            <button
              onClick={() => {
                if (confirm(`「${b.title}」から生成するページを削除しますか？`))
                  onEdit((p) => {
                    p.blocks = p.blocks.filter((a) => a.id !== b.id);
                    p.pageOrder = p.pageOrder.filter(
                      (a) => !a.startsWith(b.id + "/"),
                    );
                  });
              }}
            >
              削除
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
