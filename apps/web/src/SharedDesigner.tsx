import { SharedStart } from "./editor/SharedStart";
import { renderTemplate } from "../../../packages/designer/render";
import { installedRelease } from "../../../packages/designer/library";
import { Preview } from "./Preview";
import { useEffect, useRef, useState } from "react";
import { Designer } from "./Designer";
import { createFestivalSample } from "../../../packages/core/festival-sample";
import {
  createDesign,
  type DesignTemplate,
} from "../../../packages/designer/model";
import { seedLibrary } from "../../../packages/designer/presets";
import {
  emptyLibrary,
  publishTemplate,
  restoreRelease,
  validateLibrary,
  type DesignLibrary,
} from "../../../packages/designer/library";
import {
  loadDesignLibrary,
  saveDesignLibrary,
} from "../../../packages/project-storage/design-library";
import { download, webStorage } from "../../../packages/project-storage";
import type { Project } from "../../../packages/core/model";
import type { Measure } from "../../../packages/layout-engine";

export function SharedDesigner({
  measure,
  onClose,
  onHome,
  onPDF,
}: {
  measure: Measure;
  onClose: () => void;
  onHome?: () => void;
  onPDF: (p: Project) => void;
}) {
  const [library, setLibrary] = useState<DesignLibrary | null>(null);
  const active = useRef<DesignLibrary>(emptyLibrary());
  const [error, setError] = useState("");
  const [status, setStatus] = useState("読み込み中…");
  const [selected, setSelected] = useState("");
  const [entryId, setEntryId] = useState("");
  const [choosing, setChoosing] = useState(true);
  const [historyPreview, setHistoryPreview] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const queue = useRef(Promise.resolve());
  const changeNumber = useRef(0);
  const legacyRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const sample = useRef<Project | null>(null);
  if (!sample.current) {
    sample.current = createFestivalSample();
    sample.current.id = "shared-designer-preview";
  }
  async function load() {
    setError("");
    try {
      const data = await loadDesignLibrary();
      if (!data.drafts.length) {
        data.drafts = seedLibrary([]);
        const page = createDesign("notice", "自由配置のテンプレート");
        data.drafts.push(page);
      }
      active.current = data;
      setLibrary(data);
      setStatus("下書きを読み込みました");
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function persist(next: DesignLibrary) {
    active.current = next;
    setLibrary(next);
    setStatus("変更あり・下書きを保存中…");
    const number = ++changeNumber.current;
    const snapshot = structuredClone(next);
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        try {
          await saveDesignLibrary(snapshot);
          if (number === changeNumber.current) {
            setStatus("下書きをブラウザに保存済み");
            setError("");
          }
        } catch (e) {
          if (number === changeNumber.current) {
            setError(
              "保存できませんでした。編集内容は画面に残っています。" +
                String(e),
            );
            setStatus("保存エラー");
          }
          throw e;
        }
      });
    // Keep a rejection handler attached while allowing save/close to observe the failure.
    void queue.current.catch(() => {});
  }
  function update(fn: (lib: DesignLibrary) => void) {
    const next = structuredClone(active.current);
    fn(next);
    persist(next);
  }
  async function save() {
    persist(active.current);
    try {
      await queue.current;
      return true;
    } catch {
      return false;
    }
  }
  async function backup() {
    try {
      const data = active.current;
      download(
        new Blob([JSON.stringify(data)], { type: "application/json" }),
        "Pamphlet-Studio-共通デザイン.pamplib",
      );
      setStatus("共通デザインのバックアップを作成しました");
    } catch (e) {
      setError(String(e));
    }
  }
  if (!library)
    return (
      <section className="production-guide">
        <h2>共通デザインライブラリ</h2>
        <p>{error || "読み込み中…"}</p>
        {error && <button onClick={load}>再試行</button>}
        <button onClick={onHome ?? onClose}>ホームへ戻る</button>
      </section>
    );
  const preview: Project = {
    ...sample.current!,
    templates: library.drafts,
    theme: library.theme ?? sample.current!.theme,
    colorPalettes: library.palettes,
    colorPaletteId: library.paletteId,
    chapters: sample.current!.chapters.map((ch, i) => ({
      ...ch,
      color: library.chapterColors?.[i] ?? ch.color,
    })),
    assets: { ...sample.current!.assets, ...library.assets },
  };
  const current =
    library.drafts.find((t) => t.id === selected) ?? library.drafts[0];
  const change = (t: DesignTemplate) =>
    update((lib) => {
      const at = lib.drafts.findIndex((x) => x.id === t.id);
      if (at < 0) lib.drafts.push(t);
      else lib.drafts[at] = t;
    });
  return (
    <div className="shared-designer-shell">
      <div className="shared-library-bar">
        <strong>
          共通テンプレート制作{!choosing && current ? " › " + current.name : ""}
        </strong>
        <small role="status">{status}</small>
        <span>冊子で選んで適用するまで、既存の冊子は変わりません。</span>
        {!choosing && (
          <button onClick={() => setChoosing(true)}>＋ 新しいデザイン</button>
        )}
        <button
          disabled={!entryId || choosing || !current || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const next = publishTemplate(active.current, current.id);
              persist(next);
              await queue.current;
              window.dispatchEvent(new Event("pamph-library-published"));
              setStatus(
                "v" +
                  next.releases.at(-1)!.version +
                  "を公開しました。冊子で選択して適用できます。",
              );
            } catch (e) {
              setError(String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          共通テンプレートに保存
        </button>
        <details className="shared-library-more">
          <summary>ライブラリ管理</summary>
          <div>
            <button disabled={!entryId} onClick={() => setHistoryOpen(true)}>
              公開した版・復元
            </button>
            <button onClick={backup}>ライブラリを書き出す</button>
            <button onClick={() => importRef.current?.click()}>読み込む</button>
            <button onClick={() => legacyRef.current?.click()}>
              冊子からデザインをコピー
            </button>
          </div>
        </details>
        {onHome && (
          <button
            onClick={async () => {
              if (await save()) onHome();
            }}
          >
            ホームへ戻る
          </button>
        )}
        {!choosing && (
          <button onClick={() => setChoosing(true)}>
            ← 共通ライブラリへ戻る
          </button>
        )}
        <button
          onClick={async () => {
            if (await save()) onClose();
          }}
        >
          制作を閉じる
        </button>
      </div>
      <input
        hidden
        ref={legacyRef}
        type="file"
        accept=".pamph"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            const original = (await webStorage.load(file)).project;
            const next = structuredClone(active.current);
            const ids = new Map(
              original.templates.map((t) => [
                t.id,
                "legacy:" + crypto.randomUUID(),
              ]),
            );
            const assets = new Map<string, string>();
            for (const source of original.templates) {
              const t = structuredClone(source);
              t.id = ids.get(source.id)!;
              t.name += "（冊子からコピー）";
              t.masterId = source.masterId
                ? ids.get(source.masterId)
                : undefined;
              delete t.sharedSource;
              for (const o of t.objects) {
                if (o.templateRef) o.templateRef = ids.get(o.templateRef);
                if (o.assetId) {
                  const asset = original.assets[o.assetId];
                  if (!asset) throw new Error("参照画像がありません。");
                  let id = assets.get(o.assetId);
                  if (!id) {
                    id = "legacy:" + crypto.randomUUID();
                    assets.set(o.assetId, id);
                    next.assets[id] = { ...structuredClone(asset), id };
                  }
                  o.assetId = id;
                }
              }
              next.drafts.push(t);
            }
            persist(next);
            setStatus(
              original.templates.length +
                "件のデザインだけをコピーしました。企画・広告・スタッフは取り込んでいません。",
            );
          } catch (e) {
            setError(String(e));
          }
        }}
      />
      <input
        hidden
        type="file"
        ref={importRef}
        accept=".pamplib,.json"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            if (file.size > 100 * 1024 * 1024)
              throw new Error("100MB以下のファイルを選択してください。");
            const imported = validateLibrary(JSON.parse(await file.text()));
            const next = structuredClone(active.current);
            for (const t of imported.drafts) {
              const existing = next.drafts.find((x) => x.id === t.id);
              if (existing && JSON.stringify(existing) !== JSON.stringify(t))
                throw new Error(
                  "同じテンプレートに異なる下書きがあります。上書きせず中止しました。個別の.pamptpl読込でコピーしてください。",
                );
              if (!existing) next.drafts.push(t);
            }
            for (const r of imported.releases) {
              const existing = next.releases.find(
                (x) => x.templateId === r.templateId && x.version === r.version,
              );
              if (existing && JSON.stringify(existing) !== JSON.stringify(r))
                throw new Error("同じ公開版の内容が一致しません。");
              if (!existing) next.releases.push(r);
            }
            for (const [id, a] of Object.entries(imported.assets)) {
              if (
                next.assets[id] &&
                JSON.stringify(next.assets[id]) !== JSON.stringify(a)
              )
                throw new Error("同名の素材が競合しています。");
              next.assets[id] = a;
            }
            persist(next);
          } catch (e) {
            setError(String(e));
          }
        }}
      />
      {error && (
        <div className="shared-library-error" role="alert">
          {error}
          <button onClick={() => void save()}>再保存</button>
          <button onClick={backup}>バックアップ</button>
        </div>
      )}
      {choosing && (
        <SharedStart
          project={preview}
          measure={measure}
          onCancel={entryId ? () => setChoosing(false) : undefined}
          onChoose={(template, create) => {
            if (create) change(template);
            setSelected(template.id);
            setEntryId(template.id);
            setChoosing(false);
          }}
        />
      )}
      {entryId && (
        <div className="shared-edit-host" hidden={choosing}>
          <Designer
            initialTemplateId={entryId}
            onNewShared={() => setChoosing(true)}
            project={preview}
            measure={measure}
            saveState={status}
            shared
            onTemplateFocus={setSelected}
            onProjectEdit={(fn) => {
              const p = structuredClone(preview);
              fn(p);
              update((lib) => {
                lib.drafts = p.templates;
                lib.palettes = p.colorPalettes;
                lib.paletteId = p.colorPaletteId;
                lib.theme = p.theme;
                lib.chapterColors = p.chapters.map((ch) => ch.color);
              });
            }}
            onSelectBlock={() => {}}
            onChange={change}
            onCreate={change}
            onRemove={(id) => {
              if (
                active.current.drafts.some(
                  (t) =>
                    t.masterId === id ||
                    t.objects.some((o) => o.templateRef === id),
                )
              ) {
                setError(
                  "ほかの下書きが参照しています。先に参照を外してください。",
                );
                return;
              }
              update((lib) => {
                lib.drafts = lib.drafts.filter((t) => t.id !== id);
              });
            }}
            onAssets={(assets) =>
              update((lib) => {
                for (const a of assets) lib.assets[a.id] = a;
              })
            }
            onApply={() =>
              setStatus(
                "制作する冊子のデザイン選択から、公開版を明示的に適用してください。",
              )
            }
            onClose={async () => {
              if (await save()) onClose();
            }}
            onCapture={() => {
              throw new Error("共通デザインでは冊子の内容を取り込みません。");
            }}
            onPDF={async (id, sample) => {
              try {
                const p = structuredClone(sample ?? preview),
                  t = p.templates.find((t) => t.id === id)!;
                p.blocks = [
                  {
                    id: "shared-preview",
                    template: t.kind,
                    templateId: t.id,
                    title: t.name,
                    chapterId: p.chapters[0].id,
                    body: "これは架空のサンプルです。\n情報を差し込んで確認できます。",
                  },
                ];
                p.pageOrder = [];
                p.assignments = {};
                p.theme.padding = 1;
                for (const a of Object.values(p.assets))
                  if (a.mime === "image/svg+xml" && !a.vectorPdf) {
                    const image = new Image();
                    image.src = a.data;
                    await image.decode();
                    const canvas = document.createElement("canvas");
                    canvas.width = a.width;
                    canvas.height = a.height;
                    canvas.getContext("2d")!.drawImage(image, 0, 0);
                    a.data = canvas.toDataURL("image/png");
                    a.mime = "image/png";
                  }
                onPDF(p);
              } catch (e) {
                setError(String(e));
              }
            }}
            onProjectSave={() => void save()}
          />
        </div>
      )}
      {historyOpen && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="共通テンプレートの公開履歴"
          >
            <h2>{current?.name}の公開履歴</h2>
            <p>
              このブラウザ内の共通ライブラリです。他の端末には書き出して共有してください。公開はクラウドへの送信ではありません。
            </p>
            {[...library.releases]
              .reverse()
              .filter((r) => r.templateId === current?.id)
              .map((r) => (
                <div key={r.version}>
                  <b>v{r.version}</b>{" "}
                  {new Date(r.publishedAt).toLocaleString("ja-JP")}
                  <button onClick={() => setHistoryPreview(r.version)}>
                    この版をプレビュー
                  </button>
                  {historyPreview === r.version &&
                    (() => {
                      const content = installedRelease(r);
                      const p = {
                        ...preview,
                        templates: content.templates,
                        assets: content.assets,
                      };
                      const nodes =
                        renderTemplate(p, content.template, measure, {
                          side: "right",
                          title: "サンプル見出し",
                          chapterId: p.chapters[0].id,
                        })[0] ?? [];
                      return (
                        <div className="apply-preview">
                          <Preview
                            project={p}
                            page={{
                              id: "history",
                              blockId: "",
                              chapterId: "",
                              title: "v" + r.version,
                              template: "notice",
                              physical: 1,
                              side: "right",
                              nodes,
                              slots: [],
                            }}
                            thumb
                          />
                        </div>
                      );
                    })()}
                  <button
                    onClick={() => {
                      try {
                        persist(
                          restoreRelease(
                            active.current,
                            r.templateId,
                            r.version,
                          ),
                        );
                        setHistoryOpen(false);
                      } catch (e) {
                        setError(String(e));
                      }
                    }}
                  >
                    この版を下書きに戻す
                  </button>
                </div>
              ))}
            {!library.releases.some((r) => r.templateId === current?.id) && (
              <p>まだ公開していません。</p>
            )}
            <button onClick={() => setHistoryOpen(false)}>閉じる</button>
          </section>
        </div>
      )}
    </div>
  );
}
