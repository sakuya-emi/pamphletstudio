import { useState } from "react";
import type { Project } from "../../../../packages/core/model";
import { readSource, type DataSource } from "../../../../packages/core/editing";
export function DirectEditor({
  project,
  source,
  onEdit,
  onEditMany,
  onClose,
  onAsset,
}: {
  project: Project;
  source: DataSource;
  onEdit: (s: DataSource, v: string) => void;
  onEditMany?: (changes: { source: DataSource; value: string }[]) => void;
  onClose: () => void;
  onAsset?: (s: DataSource, f: File) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const composite = ["place", "placeShort"].includes(source.field);
  const festival = source.type === "project" && source.field === "festivalDisplay";
  const timeRange = source.type === "event" && source.field === "timeRange";
  const fields = timeRange
    ? ["startTime", "endTime"]
    : festival
    ? ["edition", "festival"]
    : composite
      ? ["building", "floor", "room", "location"]
      : [source.field];
  return (
    <div className="direct-editor" onClick={(e) => e.stopPropagation()}>
      <strong>
        {source.type === "chapter"
          ? "章名（全ページへ反映）"
          : composite
            ? "開催場所の元データ"
            : festival
              ? "開催回数・学園祭名"
              : timeRange
                ? "開催時刻"
                : source.field === "assetId"
              ? "画像の差し替え"
              : "登録内容の編集"}
      </strong>
      {source.field === "assetId" ? (
        <input
          aria-label="素材を差し替える"
          type="file"
          accept="image/*,.pdf"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f)
              try {
                await onAsset?.(source, f);
                onClose();
              } catch (e) {
                setError(String(e));
              }
          }}
        />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const data = new FormData(e.currentTarget);
              const changes = fields.map((field) => ({
                source: { ...source, field }, value: String(data.get(field) || ""),
              }));
              if (onEditMany) onEditMany(changes);
              else changes.forEach(({ source, value }) => onEdit(source, value));
              onClose();
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          {fields.map((field) => (
            <label key={field}>
              {(
                {
                  startTime: "開始時刻",
                  endTime: "終了時刻",
                  edition: "開催回数",
                  festival: "学園祭名",
                  building: "建物",
                  floor: "階数",
                  room: "教室",
                  location: "詳細な場所",
                } as Record<string, string>
              )[field] || "内容"}
              <textarea
                autoFocus={field === fields[0]}
                aria-label={"直接編集 " + field}
                name={field}
                defaultValue={readSource(project, { ...source, field })}
                onKeyDown={(e) => {
                  if (e.key === "Escape") onClose();
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
            </label>
          ))}
          <button type="submit">確定</button>
        </form>
      )}
      <button type="button" onClick={onClose}>
        閉じる
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
