import { useState } from "react";
import { Preview } from "../Preview";
import { uid, type Project } from "../../../../packages/core/model";
import { paletteColors } from "../../../../packages/core/color-palette";
import {
  layoutProject,
  type Measure,
} from "../../../../packages/layout-engine";

export function PaletteControl({
  project,
  update,
  measure,
  edit = false,
  confirmSelection = false,
}: {
  project: Project;
  update: (fn: (p: Project) => void) => void;
  measure: Measure;
  edit?: boolean;
  confirmSelection?: boolean;
}) {
  const current = project.colorPalettes?.find(
    (p) => p.id === project.colorPaletteId,
  );
  const [pending, setPending] = useState<string>();
  const preview =
    confirmSelection && pending !== undefined
      ? { ...project, colorPaletteId: pending || undefined }
      : undefined;
  const previewPage =
    confirmSelection &&
    layoutProject(preview ?? project, measure).pages.find(
      (page) => page.template === "events",
    );
  const labels: Record<string, string> = {
    [project.theme.background.toLowerCase()]: "背景",
    [project.theme.ink.toLowerCase()]: "本文・見出し",
    [project.theme.accent.toLowerCase()]: "アクセント",
    "#d83d70": "アンケート",
    "#fa4834": "禁煙・禁酒",
    "#2ba6c5": "タイムテーブル左",
    "#65aa94": "タイムテーブル右",
    "#3b75ac": "分別表・可燃ごみ",
    "#66a850": "分別表・その他",
  };
  for (const ch of project.chapters)
    labels[ch.color.toLowerCase()] = "章タブ：" + ch.name;
  return (
    <section className="book-palette">
      <label>
        冊子のカラーパレット
        <select
          aria-label="冊子のカラーパレット"
          value={pending ?? current?.id ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            if (confirmSelection) setPending(value);
            else
              update((p) => {
                p.colorPaletteId = value || undefined;
              });
          }}
        >
          <option value="">標準の配色</option>
          {project.colorPalettes?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {confirmSelection && !project.colorPalettes?.length && (
        <p>現在の配色は標準のみです。</p>
      )}
      {confirmSelection && previewPage && !preview && (
        <div className="apply-preview">
          <Preview project={project} page={previewPage} thumb />
        </div>
      )}
      {confirmSelection && (
        <p>
          編集対象・適用対象：冊子全体の配色
          <br />
          現在使用中：{current?.name ?? "標準の配色"}
        </p>
      )}
      {preview && (
        <section className="design-inline">
          <strong>
            プレビュー中・未適用：
            {project.colorPalettes?.find((p) => p.id === pending)?.name ??
              "標準の配色"}
          </strong>
          {previewPage && (
            <div className="apply-preview">
              <Preview project={preview} page={previewPage} thumb />
            </div>
          )}
          <div className="button-row">
            <button onClick={() => setPending(undefined)}>キャンセル</button>
            <button
              className="primary"
              onClick={() => {
                update((p) => {
                  p.colorPaletteId = pending || undefined;
                });
                setPending(undefined);
              }}
            >
              このデザインを適用
            </button>
          </div>
        </section>
      )}
      {edit && (
        <>
          <button
            onClick={() =>
              update((p) => {
                const raw = layoutProject(
                  { ...p, colorPaletteId: undefined },
                  measure,
                ).pages.flatMap((pg) => pg.nodes);
                const id = uid();
                (p.colorPalettes ||= []).push({
                  id,
                  name: "配色 " + (p.colorPalettes.length + 1),
                  colors: { ...paletteColors(p, raw), ...current?.colors },
                });
                p.colorPaletteId = id;
              })
            }
          >
            ＋ カラーパレットを登録
          </button>
          {current && (
            <>
              <label>
                パレット名
                <input
                  aria-label="パレット名"
                  value={current.name}
                  onChange={(e) =>
                    update((p) => {
                      p.colorPalettes!.find((a) => a.id === current.id)!.name =
                        e.target.value;
                    })
                  }
                />
              </label>
              <div className="book-palette-colors">
                {Object.entries(current.colors).map(([key, value]) => {
                  const label = labels[key] || key;
                  const change = (color: string) => {
                    if (!/^#[0-9a-f]{6}$/i.test(color) || color === value)
                      return;
                    update((p) => {
                      p.colorPalettes!.find((a) => a.id === current.id)!.colors[
                        key
                      ] = color;
                    });
                  };
                  return (
                    <div key={key} className="book-palette-color">
                      <i style={{ background: key }} /> <span>{label}</span>
                      <input
                        type="color"
                        aria-label={label + "を選択"}
                        value={value}
                        onInput={(e) => change(e.currentTarget.value)}
                      />
                      <input
                        type="text"
                        aria-label={label + "の色コード"}
                        key={current.id + value}
                        defaultValue={value}
                        maxLength={7}
                        onBlur={(e) => {
                          const next = e.currentTarget.value.trim();
                          if (/^#[0-9a-f]{6}$/i.test(next)) change(next);
                          else e.currentTarget.value = value;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <p className="hint">
            左の色は元の色です。同じ元の色を使う全ページに反映します。写真・広告・QRコードの色は変わりません。
          </p>
        </>
      )}
    </section>
  );
}
