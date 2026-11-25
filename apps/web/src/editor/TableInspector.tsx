import type { DesignObject } from "../../../../packages/designer/model";
import {
  defaultTableStyle,
  type CellStyle,
  type TableStyle,
  type TableTarget,
  type BorderStyle,
} from "../../../../packages/designer/table-model";
import { CornerEditor } from "./CornerEditor";
import { corners } from "../../../../packages/designer/corners";
const fields = [
  ["name", "企画名"],
  ["group", "団体名"],
  ["building", "建物"],
  ["floor", "階"],
  ["room", "教室"],
  ["location", "開催場所"],
  ["place", "場所全体"],
  ["placeShort", "階・教室／場所"],
];
export function TableInspector({
  simple,
  o,
  target,
  onTarget,
  modify,
  onEnter,
}: {
  simple?: boolean;
  o: DesignObject;
  target: TableTarget | null;
  onTarget: (t: TableTarget | null) => void;
  modify: (p: Partial<DesignObject>) => void;
  onEnter: () => void;
}) {
  const baseStyle = defaultTableStyle();
  if (!o.tableStyle) {
    baseStyle.base = {
      ...baseStyle.base,
      size: o.size,
      padding: o.padding,
      fill: o.fill,
    };
    baseStyle.header = {
      ...baseStyle.header,
      fill: o.headerFill,
      color: o.headerColor,
    };
    baseStyle.even = { fill: o.alternate };
    baseStyle.groupBy = o.groupBuildings ? "building" : "none";
  }
  const s = o.tableStyle || baseStyle,
    current = target || { kind: "table" },
    column = current.column ?? 0,
    row = current.rowId || "",
    group = current.groupKey || "";
  function update(fn: (v: TableStyle) => void) {
    const v = structuredClone(s);
    fn(v);
    modify({ tableStyle: v });
  }
  function selectedStyle(): CellStyle {
    if (current.kind === "column") return s.columns[column] || {};
    if (current.kind === "row") return s.rows[row] || {};
    if (current.kind === "cell" || current.kind === "border")
      return s.cells[`${row}:${column}`] || {};
    if (current.kind === "header")
      return current.column === undefined
        ? s.header
        : s.headerColumns?.[column] || {};
    if (current.kind === "group" || current.kind === "groupLabel")
      return s.groups[group] || {};
    if (current.kind === "title") return s.title.style;
    return s.base;
  }
  function patchStyle(patch: Partial<CellStyle>) {
    update((v) => {
      let st = selectedStyle();
      st = {
        ...st,
        ...patch,
        border: patch.border ? { ...st.border, ...patch.border } : st.border,
      };
      if (current.kind === "column") v.columns[column] = st;
      else if (current.kind === "row") v.rows[row] = st;
      else if (current.kind === "cell" || current.kind === "border")
        v.cells[`${row}:${column}`] = st;
      else if (current.kind === "header") {
        if (current.column === undefined) v.header = st;
        else {
          v.headerColumns ||= {};
          v.headerColumns[column] = st;
        }
      } else if (current.kind === "group" || current.kind === "groupLabel")
        v.groups[group] = {
          ...v.groups[group],
          ...st,
          ...(current.kind === "groupLabel"
            ? { labelColor: st.color, labelSize: st.size }
            : {}),
        };
      else if (current.kind === "title") v.title.style = st;
      else v.base = st;
    });
  }
  const st = selectedStyle(),
    color = (label: string, key: "fill" | "color" | "alternate") => (
      <label>
        {label}
        <input
          aria-label={label}
          type="text"
          key={String(st[key])}
          defaultValue={st[key] || ""}
          placeholder="#RRGGBB / none / 継承"
          onBlur={(e) => {
            if (!e.target.value) {
              const patch = { ...st };
              delete patch[key];
              patchStyle({ [key]: undefined });
            } else if (
              /^#[a-f0-9]{6}$/i.test(e.target.value) ||
              e.target.value === "none"
            )
              patchStyle({ [key]: e.target.value });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </label>
    );
  const num = (
    label: string,
    key: "size" | "padding" | "lineHeight" | "letterSpacing",
    fallback: number,
    min: number,
    max: number,
  ) => (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step=".1"
        value={st[key] ?? fallback}
        onChange={(e) =>
          patchStyle({ [key]: Math.max(min, Math.min(max, +e.target.value)) })
        }
      />
    </label>
  );
  if (!o.tableStyle && !simple)
    return (
      <section>
        <h3>高度な表の編集</h3>
        <button
          onClick={() =>
            modify({
              tableStyle: {
                ...s,
                base: { ...s.base, size: o.size, padding: o.padding },
                header: {
                  ...s.header,
                  fill: o.headerFill,
                  color: o.headerColor,
                },
                even: { fill: o.alternate },
              },
            })
          }
        >
          行・列・セルのスタイルを有効にする
        </button>
        <p className="hint">既存の列とデータ連動を維持して拡張します。</p>
      </section>
    );
  const controls = (
    <section className="table-inspector">
      <h3>表の内部編集</h3>
      {!target && (
        <button onClick={onEnter}>表の内部を編集（ダブルクリック）</button>
      )}
      <label>
        編集対象
        <select
          aria-label="表の編集対象"
          value={current.kind}
          onChange={(e) =>
            onTarget({
              ...current,
              kind: e.target.value as TableTarget["kind"],
            })
          }
        >
          {[
            ["table", "表全体"],
            ["column", "列"],
            ["row", "行"],
            ["cell", "セル"],
            ["header", "見出しセル"],
            ["group", "建物のグループ枠"],
            ["groupLabel", "建物の見出し"],
            ["border", "セル罫線"],
            ["title", "メインタイトル"],
          ].map(([k, v]) => (
            <option
              value={k}
              key={k}
              disabled={
                ["cell", "row", "border"].includes(k) && (simple || !row)
              }
            >
              {v}
            </option>
          ))}
        </select>
      </label>
      {target && (
        <p className="hint">
          {row ? `企画 ${row.slice(0, 16)} / ` : ""}
          {o.columns?.[column]?.label || "列"}
          {group ? ` / ${group}` : ""} · Escで表全体へ戻る
        </p>
      )}
      {current.kind === "table" && (
        <>
          <label>
            構成
            <select
              aria-label="表の構成"
              value={s.variant}
              onChange={(e) =>
                update((v) => {
                  v.variant = e.target.value as TableStyle["variant"];
                })
              }
            >
              <option value="grid">標準グリッド</option>
              <option value="stripe">ストライプ＋縦結合</option>
              <option value="cards">建物別カード</option>
              <option value="split">分割カラム</option>
            </select>
          </label>
          <div className="designer-numbers">
            {(
              ["rowGap", "columnGap", "groupGap", "groupLabelWidth"] as const
            ).map((k) => (
              <label key={k}>
                {
                  {
                    rowGap: "行間隔（mm）",
                    columnGap: "列間隔（mm）",
                    groupGap: "建物間隔（mm）",
                    groupLabelWidth: "建物ラベル幅",
                  }[k]
                }
                <input
                  aria-label={k}
                  type="number"
                  min="0"
                  max="50"
                  step=".5"
                  value={s[k]}
                  onChange={(e) =>
                    update((v) => {
                      v[k] = Math.max(0, Math.min(50, +e.target.value));
                    })
                  }
                />
              </label>
            ))}
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={s.autoHeight}
              onChange={(e) =>
                update((v) => {
                  v.autoHeight = e.target.checked;
                })
              }
            />
            自動行高（長文は設定に関係なく拡張）
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={s.keepGroups}
              onChange={(e) =>
                update((v) => {
                  v.keepGroups = e.target.checked;
                })
              }
            />
            建物を可能な限り分割しない
          </label>
          <label>
            グループキー
            <select
              value={s.groupBy}
              onChange={(e) =>
                update((v) => {
                  v.groupBy = e.target.value as TableStyle["groupBy"];
                })
              }
            >
              <option value="none">グループ化しない</option>
              {fields.map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <h3>メインタイトル</h3>
          <label>
            タイトル
            <input
              aria-label="表のメインタイトル"
              value={s.title.text}
              onChange={(e) =>
                update((v) => {
                  v.title.text = e.target.value;
                })
              }
            />
          </label>
          <label>
            タイトルの範囲
            <select
              value={s.title.scope}
              onChange={(e) =>
                update((v) => {
                  v.title.scope = e.target
                    .value as TableStyle["title"]["scope"];
                })
              }
            >
              <option value="none">非表示</option>
              <option value="first">左列のみ</option>
              <option value="all">表全幅</option>
            </select>
          </label>
          <label>
            タイトル高さ（mm）
            <input
              type="number"
              min="5"
              max="40"
              value={s.title.height}
              onChange={(e) =>
                update((v) => {
                  v.title.height = Math.max(5, Math.min(40, +e.target.value));
                })
              }
            />
          </label>
          <h3>点線リーダー</h3>
          <label>
            線種
            <select
              aria-label="リーダーの線種"
              value={s.leader.type}
              onChange={(e) =>
                update((v) => {
                  v.leader.type = e.target.value as BorderStyle["type"];
                })
              }
            >
              <option value="none">表示しない</option>
              <option value="dotted">点線</option>
              <option value="dashed">破線</option>
              <option value="solid">実線</option>
            </select>
          </label>
          <label>
            リーダー色
            <input
              defaultValue={s.leader.color}
              key={s.leader.color}
              onBlur={(e) => {
                if (/^#[a-f0-9]{6}$/i.test(e.target.value))
                  update((v) => {
                    v.leader.color = e.target.value;
                  });
              }}
            />
          </label>
          <div className="designer-numbers">
            <label>
              線幅
              <input
                type="number"
                min=".05"
                max="2"
                step=".05"
                value={s.leader.width}
                onChange={(e) =>
                  update((v) => {
                    v.leader.width = Math.max(0.05, +e.target.value);
                  })
                }
              />
            </label>
            <label>
              点線間隔
              <input
                type="number"
                min=".1"
                max="5"
                step=".1"
                value={s.leader.gap || 0.7}
                onChange={(e) =>
                  update((v) => {
                    v.leader.gap = Math.max(0.1, +e.target.value);
                  })
                }
              />
            </label>
          </div>
        </>
      )}
      {["column", "header"].includes(current.kind) && (
        <label>
          対象の列
          <select
            aria-label="内部編集の列"
            value={column}
            onChange={(e) => onTarget({ ...current, column: +e.target.value })}
          >
            {o.columns?.map((c, i) => (
              <option key={i} value={i}>
                {i + 1} · {c.label || "空見出し"}
              </option>
            ))}
          </select>
        </label>
      )}
      {current.kind === "column" && (
        <label>
          同じ値のセルを縦結合
          <select
            aria-label="縦結合のキー"
            value={s.merge.find((m) => m.column === column)?.key || "none"}
            onChange={(e) =>
              update((v) => {
                v.merge = v.merge.filter((m) => m.column !== column);
                if (e.target.value !== "none")
                  v.merge.push({
                    column,
                    key: e.target.value as any,
                    withinGroup: v.groupBy !== "none",
                  });
              })
            }
          >
            <option value="none">結合しない</option>
            {fields.map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      )}
      <h3>
        {current.kind === "table" ? "セルの基本スタイル" : "選択範囲のスタイル"}
      </h3>
      <div className="designer-numbers">
        {color("セル背景", "fill")}
        {color("セル文字色", "color")}
        {current.kind === "column" && color("列の交互背景", "alternate")}
        {num("セル文字サイズ", "size", s.base.size || o.size, 1, 15)}
        {num("セル内側余白", "padding", s.base.padding ?? o.padding, 0, 10)}
        {num("セル行間", "lineHeight", s.base.lineHeight || 1.4, 1, 3)}
        {num("セル文字間隔", "letterSpacing", 0, 0, 3)}
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={st.bold ?? false}
          onChange={(e) => patchStyle({ bold: e.target.checked })}
        />
        太字
      </label>
      <label>
        水平揃え
        <select
          value={st.align || "left"}
          onChange={(e) =>
            patchStyle({ align: e.target.value as CellStyle["align"] })
          }
        >
          <option value="left">左</option>
          <option value="center">中央</option>
          <option value="right">右</option>
        </select>
      </label>
      <label>
        垂直揃え
        <select
          value={st.valign || "center"}
          onChange={(e) =>
            patchStyle({ valign: e.target.value as CellStyle["valign"] })
          }
        >
          <option value="top">上</option>
          <option value="center">中央</option>
          <option value="bottom">下</option>
        </select>
      </label>
      <CornerEditor
        value={st.corners || corners(0)}
        linked={st.cornersLinked ?? false}
        onLink={(cornersLinked) => patchStyle({ cornersLinked })}
        onChange={(corners) => patchStyle({ corners })}
      />
      {current.kind === "cell" && row && (
        <>
          <h3>セル結合</h3>
          {(["rowSpan", "colSpan"] as const).map((key) => (
            <label key={key}>
              {key === "rowSpan" ? "結合行数" : "結合列数"}
              <input
                aria-label={key === "rowSpan" ? "結合行数" : "結合列数"}
                type="number"
                min="1"
                max={
                  key === "colSpan" ? (o.columns?.length || 1) - column : 100
                }
                value={
                  s.spans.find((a) => a.rowId === row && a.column === column)?.[
                    key
                  ] || 1
                }
                onChange={(e) =>
                  update((v) => {
                    const old = v.spans.find(
                      (a) => a.rowId === row && a.column === column,
                    ) || { rowId: row, column, rowSpan: 1, colSpan: 1 };
                    v.spans = v.spans.filter((a) => a !== old);
                    const n = { ...old, [key]: Math.max(1, +e.target.value) };
                    if (n.rowSpan > 1 || n.colSpan > 1) v.spans.push(n);
                  })
                }
              />
            </label>
          ))}
        </>
      )}
      {["group", "groupLabel"].includes(current.kind) && (
        <>
          <h3>グループの枠・見出し</h3>
          <label>
            枠・見出しの色
            <input
              key={String(s.groups[group]?.stroke)}
              defaultValue={s.groups[group]?.stroke || s.group.stroke}
              onBlur={(e) => {
                if (/^#[a-f0-9]{6}$/i.test(e.target.value))
                  update((v) => {
                    v.groups[group] = {
                      ...v.groups[group],
                      stroke: e.target.value,
                      labelColor: e.target.value,
                    };
                  });
              }}
            />
          </label>
          <label>
            影のオフセット（mm）
            <input
              type="number"
              min="0"
              max="3"
              step=".2"
              value={s.groups[group]?.shadow ?? s.group.shadow ?? 0}
              onChange={(e) =>
                update((v) => {
                  v.groups[group] = {
                    ...v.groups[group],
                    shadow: Math.max(0, Math.min(3, +e.target.value)),
                  };
                })
              }
            />
          </label>
        </>
      )}
      <details>
        <summary>四辺の罫線</summary>
        {(["top", "right", "bottom", "left"] as const).map((side) => {
          const b = st.border?.[side] || {
            type: "none",
            color: "#808080",
            width: 0.2,
            gap: 0.7,
          };
          return (
            <div className="border-setting" key={side}>
              <label>
                {{ top: "上", right: "右", bottom: "下", left: "左" }[side]}
                <select
                  aria-label={"罫線" + side}
                  value={b.type}
                  onChange={(e) =>
                    patchStyle({
                      border: {
                        [side]: {
                          ...b,
                          type: e.target.value as BorderStyle["type"],
                        },
                      },
                    })
                  }
                >
                  {["none", "solid", "dotted", "dashed"].map((k, i) => (
                    <option key={k} value={k}>
                      {["なし", "実線", "点線", "破線"][i]}
                    </option>
                  ))}
                </select>
              </label>
              <input
                aria-label={side + "罫線色"}
                key={b.color}
                defaultValue={b.color}
                onBlur={(e) => {
                  if (/^#[a-f0-9]{6}$/i.test(e.target.value))
                    patchStyle({
                      border: { [side]: { ...b, color: e.target.value } },
                    });
                }}
              />
              <input
                aria-label={side + "罫線幅"}
                type="number"
                min=".05"
                max="3"
                step=".05"
                value={b.width}
                onChange={(e) =>
                  patchStyle({
                    border: {
                      [side]: {
                        ...b,
                        width: Math.max(0.05, Math.min(3, +e.target.value)),
                      },
                    },
                  })
                }
              />
            </div>
          );
        })}
      </details>
      <p className="hint">
        基本 → 奇偶行 → 行 → 列 →
        セル固有の順に優先します。未指定項目は継承します。データは企画情報を参照します。
      </p>
    </section>
  );
  if (!simple) return controls;
  return (
    <>
      <p className="hint">
        行は登録件数に合わせて繰り返します。「列」ではその列の全行を変更できます。
      </p>
      <label>
        本文の文字サイズ（mm）
        <input
          type="number"
          aria-label="本文の文字サイズ（mm）"
          min="1.5"
          max="12"
          step=".1"
          value={s.base.size ?? o.size}
          onChange={(e) =>
            update((v) => {
              v.base.size = Math.max(1.5, Math.min(12, +e.target.value));
            })
          }
        />
      </label>
      <label>
        行間隔（mm）
        <input
          type="number"
          min="0"
          max="50"
          step=".5"
          value={s.rowGap}
          onChange={(e) =>
            update((v) => {
              v.rowGap = Math.max(0, Math.min(50, +e.target.value));
            })
          }
        />
      </label>
      <label>
        本文の行罫線
        <select
          value={s.base.border?.bottom?.type ?? "inherit"}
          onChange={(e) => {
            const type = e.target.value as BorderStyle["type"] | "inherit";
            update((v) => {
              const border = { ...v.base.border };
              if (type === "inherit") delete border.bottom;
              else
                border.bottom = {
                  color: "#808080",
                  width: 0.18,
                  ...border.bottom,
                  type,
                };
              v.base.border = border;
            });
          }}
        >
          <option value="inherit">標準（個別設定を維持）</option>
          <option value="none">なし</option>
          <option value="solid">実線</option>
          <option value="dotted">点線</option>
          <option value="dashed">破線</option>
        </select>
      </label>
      {o.columns?.map((col, i) => (
        <div className="table-column-basic" key={i}>
          <button
            aria-pressed={current.kind === "column" && column === i}
            onClick={() => {
              onEnter();
              onTarget({ kind: "column", column: i });
            }}
          >
            {col.label || fields.find(([id]) => id === col.field)?.[1] || "列"}
            の表示形式
          </button>
          <label>
            幅の比率
            <input
              aria-label={`${col.label || "列" + (i + 1)}の幅の比率`}
              type="number"
              min="1"
              max="1000"
              value={col.weight}
              onChange={(e) =>
                modify({
                  columns: o.columns!.map((c, j) =>
                    j === i
                      ? {
                          ...c,
                          weight: Math.min(1000, Math.max(1, +e.target.value)),
                        }
                      : c,
                  ),
                })
              }
            />
          </label>
        </div>
      ))}
      {current.kind === "column" && (
        <>
          {num(
            "選択した列の文字サイズ",
            "size",
            s.base.size ?? o.size,
            1.5,
            12,
          )}
          <label>
            選択した列の文字揃え
            <select
              value={st.align ?? s.base.align ?? "left"}
              onChange={(e) =>
                patchStyle({ align: e.target.value as CellStyle["align"] })
              }
            >
              <option value="left">左揃え</option>
              <option value="center">中央揃え</option>
              <option value="right">右揃え</option>
            </select>
          </label>
        </>
      )}
      <details>
        <summary>表・セルの詳細設定</summary>
        {controls}
      </details>
    </>
  );
}
