import { useRef, useState } from "react";
import type { Project } from "../../../../packages/core/model";
import { mediaItems, mediaSummary } from "./workflow";
import { importAsset } from "../assets";

export function MediaIntake({
  project,
  update,
  onFinish,
}: {
  project: Project;
  update: (edit: (project: Project) => void) => void;
  onFinish: () => void;
}) {
  const items = mediaItems(project);
  const summary = mediaSummary(project);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(() => {
    const first = items.findIndex(
      (item) => !item.assetId || !project.assets[item.assetId],
    );
    return first < 0 ? items.length : first;
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const item = items[index];
  const asset = item?.assetId ? project.assets[item.assetId] : undefined;
  const missing = items.filter(
    (item) => !item.assetId || !project.assets[item.assetId],
  ).length;
  async function attach(selected?: File) {
    if (!selected || !item || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { asset, warning } = await importAsset(selected);
      update((p) => {
        if (p.id !== project.id) throw new Error("冊子が切り替わりました。");
        p.assets[asset.id] = asset;
        if (item.collection === "cover") p.coverId = asset.id;
        else {
          const record = p[item.collection].find(
            (record) => record.id === item.id,
          );
          if (!record) throw new Error("掲載先が見つかりません。");
          record.assetId = asset.id;
        }
      });
      setMessage(warning ?? "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  function move(to: number) {
    setIndex(to);
    setMessage("");
  }
  if (!started)
    return (
      <section className="task-screen">
        <h2>表紙・ポスター・広告画像を登録する</h2>
        {project.intake === "images" && (
          <p>Excelの取り込みが完了しました。次に画像を登録します。</p>
        )}
        <p>{summary.breakdown}</p>
        <details>
          <summary>登録対象一覧（{items.length}件）</summary>
          <ul>
            {items.map((target, i) => (
              <li key={target.collection + target.id}>
                <button
                  onClick={() => {
                    move(i);
                    setStarted(true);
                  }}
                >
                  {target.label}：{target.title || "名称未入力"}
                </button>
              </li>
            ))}
          </ul>
        </details>
        <p>
          表紙を含み、非掲載の企画と「ポスター不要」の企画を除いた件数です。Excelや掲載設定を変えると件数も変わります。
        </p>
        <p>
          合計{summary.total}件 ／ 未登録{summary.missing}
          件。表紙から順に登録します。画像はあとから追加できます。
        </p>
        <button className="primary" onClick={() => setStarted(true)}>
          画像の登録を始める
        </button>
        <button onClick={onFinish}>すべてあとで登録する（一括スキップ）</button>
        {!project.assets[project.coverId ?? ""] && (
          <p>
            表紙未登録のままでも校正用PDFは出力できます。最終確認に警告が残ります。
          </p>
        )}
      </section>
    );
  if (!item)
    return (
      <section className="task-screen" aria-labelledby="media-finish">
        <p className="task-kicker">画像の登録</p>
        <h2 id="media-finish">
          {missing ? "画像の登録状況" : "誌面を確認・編集"}
        </h2>
        <p>
          {items.length - missing}件登録済み
          {missing ? ` ／ ${missing}件未登録` : ""}
        </p>
        {missing > 0 && (
          <button
            onClick={() =>
              move(
                items.findIndex(
                  (item) => !item.assetId || !project.assets[item.assetId],
                ),
              )
            }
          >
            未登録の画像に戻る
          </button>
        )}
        <button className="primary" onClick={onFinish}>
          {missing ? "未登録のまま誌面を確認・編集" : "誌面を確認・編集"}
        </button>
      </section>
    );
  return (
    <section className="task-screen" aria-labelledby="media-title">
      <p className="task-kicker">
        {index + 1} / {items.length} · {item.label}
      </p>
      <h2
        id="media-title"
        tabIndex={-1}
        ref={(node) => {
          if (node && document.activeElement === document.body) node.focus();
        }}
      >
        {item.title || "名称未入力"}
      </h2>
      <p>{item.detail}</p>
      <label>
        画像の登録先
        <select
          aria-label="画像の登録先"
          value={index}
          disabled={busy}
          onChange={(e) => move(Number(e.target.value))}
        >
          {items.map((target, i) => (
            <option key={target.collection + target.id} value={i}>
              {i + 1}. {target.label}：{target.title}
            </option>
          ))}
        </select>
      </label>
      <p>
        {summary.breakdown} ／ 合計{summary.total}件・未登録{summary.missing}件
      </p>
      <div
        className="task-upload"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void attach(e.dataTransfer.files[0]);
        }}
      >
        {asset && (
          <>
            {(asset.preview || asset.mime !== "application/pdf") && (
              <img src={asset.preview || asset.data} alt="" />
            )}
            <p>{asset.name}</p>
          </>
        )}
        <input
          hidden
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
          onChange={(e) => {
            void attach(e.currentTarget.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
        <button
          className={!asset ? "primary" : undefined}
          disabled={busy}
          onClick={() => file.current?.click()}
        >
          {busy
            ? "読み込み中…"
            : asset
              ? "画像を差し替える"
              : item.label + "を選ぶ"}
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      <div className="button-row">
        <button disabled={busy} onClick={onFinish}>
          すべてあとで登録する（一括スキップ）
        </button>
        <button
          disabled={busy}
          onClick={() => {
            const next = items.findIndex(
              (candidate, i) => i > index && candidate.label !== item.label,
            );
            move(next < 0 ? items.length : next);
          }}
        >
          この種類の残りをあとで登録する
        </button>
        {index > 0 && (
          <button disabled={busy} onClick={() => move(index - 1)}>
            前の画像
          </button>
        )}
        <button
          className={asset ? "primary" : undefined}
          disabled={busy}
          onClick={() => move(index + 1)}
        >
          {asset ? "次へ" : "あとで登録する"}
        </button>
      </div>
    </section>
  );
}
