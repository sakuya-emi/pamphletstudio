import { useEffect, useRef, useState } from "react";
import {
  Table2,
  PanelRight,
  CalendarRange,
  LayoutGrid,
  RectangleHorizontal,
  Square,
  X,
} from "lucide-react";
export type Preset =
  | "tableA"
  | "tableB"
  | "tableC"
  | "table"
  | "index"
  | "timetable"
  | "posters"
  | "ads"
  | "free";
export function EditorDialog({
  mode,
  shared,
  onClose,
  onCreate,
  onCapture,
  onEdit,
}: {
  mode: "start" | "new" | "help";
  shared?: boolean;
  onClose: () => void;
  onCreate: (kind: Preset, name: string) => void;
  onCapture: () => void;
  onEdit: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [name, setName] = useState(""),
    [kind, setKind] = useState<Preset>("table");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="editor-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2>
          {mode === "start"
            ? "テンプレートで、次の一冊をつくる"
            : mode === "help"
              ? "操作ガイド"
              : "新しいテンプレート"}
        </h2>
        <button aria-label="閉じる" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      {mode === "help" ? (
        <>
          <p>
            テンプレートは「デザインの型」です。制作モードの企画・画像データはそのまま使います。
          </p>
          <dl>
            <dt>作成・編集</dt>
            <dd>図形やデータ連動パーツの配置を変更します。</dd>
            <dt>保存</dt>
            <dd>
              {shared
                ? "共通ライブラリの下書きへ保存されます。公開しても既存冊子は変更されません。"
                : "編集はプロジェクトへ即時反映。ファイル → 保存でバックアップを取得します。"}
            </dd>
            <dt>適用</dt>
            <dd>
              テンプレート →
              選択ページのデザインを変更。既存の企画データは保持します。
            </dd>
            <dt>操作</dt>
            <dd>
              V 選択 / A 点の編集 / P ペン / T 文字 / Space＋ドラッグ パン /
              Ctrl・Cmd＋ホイール ズーム / Esc キャンセル
            </dd>
          </dl>
          <button onClick={onClose}>編集に戻る</button>
        </>
      ) : (
        <>
          {mode === "start" && (
            <>
              <p>
                まずは作業を選んでください。ページの内容とデザインを分けて管理します。
              </p>
              <div className="start-actions">
                <button onClick={onEdit}>既存テンプレートを編集</button>
                <button onClick={onCapture} disabled={shared}>
                  現在のページから作成
                </button>
              </div>
              <h3>新しいテンプレートを作成</h3>
            </>
          )}
          <div className="preset-grid">
            {(
              [
                {
                  id: "tableA",
                  name: "表A · ストライプ",
                  hint: "部品 / 建物セルを縦結合",
                  icon: Table2,
                },
                {
                  id: "tableB",
                  name: "表B · 建物別カード",
                  hint: "部品 / 角丸と点線リーダー",
                  icon: Table2,
                },
                {
                  id: "tableC",
                  name: "表C · 分割カラム",
                  hint: "部品 / 共通の場所を結合",
                  icon: Table2,
                },
                {
                  id: "table",
                  name: "表",
                  hint: "列・見出し・自動改ページ",
                  icon: Table2,
                },
                {
                  id: "index",
                  name: "インデックス",
                  hint: "部品 / 本文を維持して差し替え",
                  icon: PanelRight,
                },
                {
                  id: "timetable",
                  name: "タイムテーブル",
                  hint: "時刻順の企画と時間ラベル",
                  icon: CalendarRange,
                },
                {
                  id: "posters",
                  name: "ポスター紹介",
                  hint: "縦長ポスター4枚と広告",
                  icon: LayoutGrid,
                },
                {
                  id: "ads",
                  name: "広告",
                  hint: "125 × 85mmの広告枠2件",
                  icon: RectangleHorizontal,
                },
                {
                  id: "free",
                  name: "自由配置",
                  hint: "A5に文字と図形を自由に配置",
                  icon: Square,
                },
              ] as const
            ).map((p) => (
              <button
                className={kind === p.id ? "selected" : ""}
                key={p.id}
                onClick={() => setKind(p.id)}
              >
                <p.icon size={22} />
                <span>
                  {p.name}
                  <small>{p.hint}</small>
                </span>
              </button>
            ))}
          </div>
          <label>
            テンプレート名
            <input
              placeholder="名前を入力（省略可）"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <footer>
            <button onClick={onClose}>キャンセル</button>
            <button className="primary" onClick={() => onCreate(kind, name)}>
              作成して編集
            </button>
          </footer>
        </>
      )}
    </dialog>
  );
}
