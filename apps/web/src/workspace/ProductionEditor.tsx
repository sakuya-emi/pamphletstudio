import { CommitField } from "./CommitField";
import { useState } from "react";
import { insertBlock, type Project } from "../../../../packages/core/model";
import {
  readSource,
  writeSource,
  type DataSource,
} from "../../../../packages/core/editing";
import {
  eventCategory,
  isStage,
  timeWarning,
  nextRecordId,
} from "../../../../packages/core/registration";
import { importAsset } from "../assets";
import { KitchenMenus } from "./KitchenMenus";
export type InputTarget = {
  componentKind?: string;
  objectId?: string;
  source?: DataSource;
  category?: import("../../../../packages/core/registration").EventCategory;
  action?: "event" | "poster" | "ad" | "stage" | "staff" | "kitchen";
  blockId: string;
  slotKey?: string;
  size?: "full" | "half" | "quarter";
};
export function ProductionEditor({
  project: p,
  target,
  update,
  onTarget,
  onClose,
  onSheet,
  onDesign,
}: {
  project: Project;
  target: InputTarget;
  update: (f: (p: Project) => void) => void;
  onTarget: (t: InputTarget) => void;
  onClose: () => void;
  onSheet: (s: DataSource) => void;
  onDesign: () => void;
}) {
  const [error, setError] = useState("");
  const s = target.source;
  const assetField =
    s &&
    [
      "coverId",
      "logoId",
      "secondAssetId",
      "thirdAssetId",
      "backMapId",
    ].includes(s.field)
      ? s.field
      : "assetId";
  const event =
    s?.type === "event" ? p.events.find((e) => e.id === s.id) : undefined;
  const endOptional = p.blocks.some((b) => b.openingKind === "schedule");
  const block = p.blocks.find((b) => b.id === target.blockId);

  const change = (field: string, value: string) => {
    if (!s) return;
    try {
      update((q) => {
        writeSource(q, { ...s, field }, value);
        if (
          s.type === "ad" &&
          field === "size" &&
          ["full", "half"].includes(value)
        ) {
          for (const key of Object.keys(q.assignments))
            if (q.assignments[key] === s.id) delete q.assignments[key];
          if (
            !q.blocks.some(
              (b) => b.template === "ads" && (b.adSize || "quarter") === value,
            )
          )
            insertBlock(q, {
              id: nextRecordId(q),
              template: "ads",
              title: "協賛広告",
              chapterId:
                q.chapters.find((c) => c.id === block?.chapterId)?.id ||
                q.chapters[0].id,
              adSize: value as "full" | "half" | "quarter",
            });
        }
      });
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };
  const asset = async (f: File) => {
    if (!s) return;
    try {
      const { asset } = await importAsset(f);
      update((q) => {
        q.assets[asset.id] = asset;
        writeSource(q, { ...s, field: assetField }, asset.id);
      });
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };
  const input = (field: string, label: string, type = "text") => (
    <label key={field}>
      {label}
      <CommitField
        key={field}
        label={label}
        type={type}
        value={s ? readSource(p, { ...s, field }) : ""}
        onCommit={(value) => change(field, value)}
      />
    </label>
  );
  const upload = () => {
    const id = s ? readSource(p, { ...s, field: assetField }) : "";
    const a = p.assets[id];
    return (
      <label
        className="production-upload"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) void asset(f);
        }}
      >
        画像・PDF
        {a && (
          <>
            <img
              alt="登録済み画像"
              style={{ maxHeight: 150, objectFit: "contain" }}
              src={a.preview || a.data}
            />
            <span>{a.name}</span>
          </>
        )}
        <input
          aria-label="画像・PDFを登録"
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void asset(f);
          }}
        />
      </label>
    );
  };
  return (
    <section className="production-editor" aria-label="選択した内容を編集">
      <header>
        <strong>内容を入力</strong>
        <button onClick={onClose} aria-label="編集パネルを閉じる">
          ×
        </button>
      </header>
      {target.action ? (
        <>
          {target.action === "poster" && (
            <>
              <p>ポスターを掲載する企画を選んでください。</p>
              <select
                aria-label="ポスターを登録する企画"
                value=""
                onChange={(e) => {
                  if (e.target.value)
                    onTarget({
                      ...target,
                      action: undefined,
                      source: {
                        type: "event",
                        id: e.target.value,
                        field: "assetId",
                      },
                    });
                }}
              >
                <option value="">企画を選択</option>
                {p.events
                  .filter((e) =>
                    target.category
                      ? (e.category || "student") === target.category
                      : !isStage(e) && e.category !== "kitchen",
                  )
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name || "名称未入力"}
                    </option>
                  ))}
              </select>
            </>
          )}
          {target.action === "stage" &&
            p.events
              .filter(isStage)
              .sort((a, b) =>
                (a.startTime || "").localeCompare(b.startTime || ""),
              )
              .map((e) => (
                <button
                  key={e.id}
                  onClick={() =>
                    onTarget({
                      ...target,
                      action: undefined,
                      source: { type: "event", id: e.id, field: "name" },
                    })
                  }
                >
                  {e.startTime} {e.name || "名称未入力"}
                </button>
              ))}
          <p>新しい掲載情報はExcelから登録してください。</p>
        </>
      ) : (
        s && (
          <>
            {event ? (
              <>
                {isStage(event) && (
                  <label>
                    企画の種類
                    <select
                      aria-label="企画の種類"
                      value={eventCategory(event)}
                      onChange={(e) => change("category", e.target.value)}
                    >
                      <option value="stage">ステージ企画</option>
                      <option value="studentStage">学生ステージ企画</option>
                    </select>
                  </label>
                )}
                {!isStage(event) && event.category !== "kitchen" && (
                  <label>
                    企画の種類
                    <select
                      aria-label="企画の種類"
                      value={eventCategory(event)}
                      onChange={(e) => change("category", e.target.value)}
                    >
                      <option value="student">学生企画</option>
                      <option value="food">模擬店</option>
                    </select>
                  </label>
                )}
                {input(
                  "name",
                  event.category === "kitchen" ? "会社名" : "企画名",
                )}
                {isStage(event) ? (
                  <>
                    {input("startTime", "開始時刻", "time")}
                    {input(
                      "endTime",
                      endOptional ? "終了時刻（任意）" : "終了時刻",
                      "time",
                    )}
                    {timeWarning(event, endOptional) && (
                      <p role="status">{timeWarning(event, endOptional)}</p>
                    )}
                  </>
                ) : event.category === "kitchen" ? (
                  <KitchenMenus
                    project={p}
                    eventId={event.id}
                    update={update}
                  />
                ) : (
                  <>
                    {input("group", "団体名")}
                    {input("building", "建物")}
                    {input("floor", "階数", "number")}
                    {input("room", "教室")}
                    {input("location", "詳細な場所")}
                  </>
                )}
                {upload()}
              </>
            ) : s.type === "ad" ? (
              <>
                {input("companyName", "企業名")}
                <label>
                  広告サイズ
                  <select
                    aria-label="広告サイズ"
                    value={readSource(p, { ...s, field: "size" })}
                    onChange={(e) => change("size", e.target.value)}
                  >
                    <option value="full">1ページ</option>
                    <option value="half">1/2ページ</option>
                    <option value="quarter">1/4ページ</option>
                  </select>
                </label>
                {upload()}
              </>
            ) : [
                "assetId",
                "coverId",
                "logoId",
                "secondAssetId",
                "thirdAssetId",
                "backMapId",
              ].includes(s.field) ? (
              upload()
            ) : s.type === "project" && s.field === "festivalDisplay" ? (
              <>
                {input("edition", "開催回数", "number")}
                {input("festival", "学園祭名")}
              </>
            ) : s.field === "websiteUrl" ? (
              input("websiteUrl", "大学ウェブサイトのURL", "url")
            ) : s.field === "surveyUrl" ? (
              input("surveyUrl", "アンケートのURL", "url")
            ) : s.type === "staff" ? (
              input("name", "氏名")
            ) : s.type === "pageNumber" ? (
              <label>
                開始番号
                <input
                  aria-label="開始番号"
                  type="number"
                  value={p.theme.numberStart ?? 1}
                  onChange={(e) =>
                    update((q) => {
                      q.theme.numberStart = Number(e.target.value);
                    })
                  }
                />
              </label>
            ) : (
              <label>
                {s.type === "chapter"
                  ? "章名（全ページへ反映）"
                  : s.field === "title"
                    ? "見出し"
                    : "内容"}
                <CommitField
                  label="選択した文字"
                  rows={5}
                  value={readSource(p, s)}
                  onCommit={(value) => change(s.field, value)}
                />
              </label>
            )}
            <button onClick={() => onSheet(s)}>表形式で編集</button>
          </>
        )
      )}
      {block && <button onClick={onDesign}>デザインを変更</button>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
