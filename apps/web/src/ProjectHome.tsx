import type { UnreadableProject } from "../../../packages/project-storage";
import { uniqueProjectName } from "./workspace/workflow";
import { useEffect, useRef, useState } from "react";
import { Plus, FolderOpen, FilePlus } from "lucide-react";
import type { Project } from "../../../packages/core/model";
import {
  layoutProject,
  type LayoutPage,
  type Measure,
} from "../../../packages/layout-engine";
import { Preview } from "./Preview";
const thumbs = new Map<string, { measure: Measure; page?: LayoutPage }>();
function Cover({ project, measure }: { project: Project; measure: Measure }) {
  const key = project.id + ":" + project.updatedAt;
  const cached = thumbs.get(key);
  const [result, setResult] = useState<{ key: string; page?: LayoutPage }>();
  const page =
    cached?.measure === measure
      ? cached.page
      : result?.key === key
        ? result.page
        : undefined;
  useEffect(() => {
    if (thumbs.get(key)?.measure === measure) return;
    const timer = window.setTimeout(() => {
      let page: LayoutPage | undefined;
      try {
        const first = project.blocks[0];
        const cover = project.blocks.find((b) => b.template === "cover");
        const block = cover ?? first;
        if (block) {
          const candidate = layoutProject(
            {
              ...project,
              blocks: [block],
              pageOrder: [],
              theme: { ...project.theme, padding: 1 },
            },
            measure,
          ).pages[0];
          if (candidate?.nodes.some((n) => !n.editorOnly)) page = candidate;
        }
      } catch {
        /* Keep the named fallback when an older layout cannot render. */
      }
      if (thumbs.size >= 80) thumbs.delete(thumbs.keys().next().value!);
      thumbs.set(key, { measure, page });
      setResult({ key, page });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key, project, measure]);
  return (
    <div className="project-cover">
      {page ? (
        <Preview page={page} project={project} thumb />
      ) : (
        <div className="project-cover-fallback">
          <FilePlus size={24} />
          <b>{project.name}</b>
        </div>
      )}
    </div>
  );
}
export function ProjectHome({
  projects,
  unreadable = [],
  onRemoveUnreadable,
  listState,
  onRetry,
  measure,
  onNew,
  onStart,
  onNextYear,
  onFiles,
  onSample,
  onHome,
  onDelete,
  onBackup,
}: {
  projects: Project[];
  unreadable?: UnreadableProject[];
  onRemoveUnreadable?: (id: string) => Promise<void>;
  measure: Measure;
  onNew: (name: string) => void;
  listState: "loading" | "ready" | "error";
  onRetry: () => void;
  onStart: (p: Project) => void;
  onNextYear: (p: Project) => void;
  onFiles: (files: FileList | null) => void;
  onSample: () => void;
  onHome: () => void;
  onDelete: (p: Project) => Promise<void>;
  onBackup: (p: Project) => Promise<void>;
}) {
  const [newName, setNewName] = useState<string | null>(null);
  const [damaged, setDamaged] = useState<UnreadableProject | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const files = useRef<HTMLInputElement>(null),
    folder = useRef<HTMLInputElement>(null);
  return (
    <main className="project-browser">
      <button onClick={onHome}>← ホームへ戻る</button>
      <div className="project-browser-toolbar">
        <h1>パンフレット制作</h1>
        <div>
          <button onClick={() => files.current?.click()}>
            <FolderOpen size={16} />
            保存ファイル（.pamph）を選んで読み込む
          </button>
          <button onClick={onSample}>完成イメージを試す（見本）</button>
          <button onClick={() => folder.current?.click()}>
            <FolderOpen size={16} />
            フォルダ内の保存ファイル（.pamph）をまとめて読み込む
          </button>
        </div>
      </div>
      <input
        ref={files}
        type="file"
        accept=".pamph"
        multiple
        hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={folder}
        type="file"
        multiple
        hidden
        {...{ webkitdirectory: "" }}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {listState === "loading" && (
        <p className="project-browser-note" role="status">
          保存済みプロジェクトを読み込み中…
        </p>
      )}
      {listState === "error" && (
        <p className="project-browser-note" role="alert">
          保存済みプロジェクトの一部または全部を読み込めませんでした。保存データは削除していません。{" "}
          <button onClick={onRetry}>再試行</button>
        </p>
      )}
      {unreadable.length > 0 && (
        <section aria-label="読み込めない保存データ">
          <h2>読み込めない保存データ（{unreadable.length}件）</h2>
          <p>
            正常なプロジェクトは下に表示しています。各データの名前・管理ID・理由を確認してください。削除するまで元のデータは保持します。
          </p>
          {unreadable.map((entry) => (
            <article key={entry.id}>
              <strong>{entry.name}</strong>
              <p>
                管理ID：{entry.id} ／ {entry.reason}
              </p>
              <button
                onClick={() => {
                  setError("");
                  setDamaged(entry);
                }}
              >
                この読めないデータを削除…
              </button>
            </article>
          ))}
        </section>
      )}
      {damaged && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="読めないデータの削除確認"
          >
            <h2>「{damaged.name}」だけを削除しますか？</h2>
            <p>
              管理ID：{damaged.id}
              。このブラウザの該当保存データを削除します。取り消せません。他のプロジェクトは削除しません。
            </p>
            <button disabled={busy} onClick={() => setDamaged(null)}>
              キャンセル
            </button>
            <button
              disabled={busy || !onRemoveUnreadable}
              onClick={async () => {
                setBusy(true);
                try {
                  await onRemoveUnreadable?.(damaged.id);
                  setDamaged(null);
                } catch (e) {
                  setError(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              このデータだけを削除
            </button>
            {error && <p role="alert">{error}</p>}
          </section>
        </div>
      )}
      {listState === "ready" && !projects.length && (
        <p className="project-browser-note">
          このブラウザに保存済みのプロジェクトはありません。
        </p>
      )}
      <div className="project-columns">
        <button
          className="project-new"
          onClick={() => setNewName(uniqueProjectName(projects))}
        >
          <span className="project-new-icon">
            <Plus size={42} strokeWidth={1} />
          </span>
          <strong>新しくパンフレットを作成</strong>
        </button>
        {projects.map((p) => (
          <article className="project-card" key={p.id}>
            <button
              className="project-open"
              onClick={() => onStart(p)}
              aria-label={p.name + "を開く"}
            >
              <Cover project={p} measure={measure} />
              <strong>{p.name}</strong>
              <span>
                {p.year}年度 · 出力{layoutProject(p, measure).pages.length}
                ページ
              </span>
              <span>
                {p.lastPdf
                  ? p.lastPdf.contentVersion === (p.contentVersion ?? "initial")
                    ? "PDF生成済み"
                    : "出力後に変更あり"
                  : "PDF未出力"}{" "}
                · 企画{p.events.length}件 · 管理ID {p.id}
              </span>
              <time>{new Date(p.updatedAt).toLocaleString("ja-JP")}</time>
            </button>
            <button className="project-copy" onClick={() => onNextYear(p)}>
              次年度用に複製
            </button>
            <button
              className="project-copy"
              onClick={() => {
                setError("");
                setDeleting(p);
              }}
            >
              削除…
            </button>
          </article>
        ))}
      </div>
      <p className="project-browser-note">
        新規作成すると、デザイン選択からPDF出力まで順に進めます。完成見本では架空のデータを使い、実際のプロジェクトは変更されません。
      </p>
      {newName !== null && (
        <div className="modal-backdrop">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="新しいプロジェクト"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newName.trim();
              if (name) {
                setNewName(null);
                onNew(name);
              }
            }}
          >
            <h2>新しいプロジェクト</h2>
            <label className="field">
              <span>プロジェクト名</span>
              <input
                required
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            {projects.some((p) => p.name === newName.trim()) && (
              <p role="status">
                同名のプロジェクトがあります。作成しても上書きされません。一覧では年度・ページ数・PDF出力状態・管理IDで区別できます。
              </p>
            )}
            <button type="button" onClick={() => setNewName(null)}>
              キャンセル
            </button>
            <button
              className="primary"
              type="submit"
              disabled={!newName.trim()}
            >
              作成
            </button>
          </form>
        </div>
      )}
      {deleting && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="プロジェクトの削除確認"
          >
            <h2>「{deleting.name}」を削除しますか？</h2>
            <p>
              {deleting.year}年度・
              {new Date(deleting.updatedAt).toLocaleString("ja-JP")}{" "}
              のブラウザ保存だけを削除します。必要なら先にバックアップしてください。
            </p>
            <button
              disabled={busy}
              onClick={async () => {
                try {
                  await onBackup(deleting);
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              バックアップを保存
            </button>
            <button disabled={busy} onClick={() => setDeleting(null)}>
              キャンセル
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete(deleting);
                  setDeleting(null);
                } catch (e) {
                  setError(String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              このプロジェクトを削除
            </button>
            {error && <p role="alert">{error}</p>}
          </section>
        </div>
      )}
    </main>
  );
}
