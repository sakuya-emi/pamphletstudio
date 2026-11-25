import { TableInspector } from "./TableInspector";
import type { TableTarget } from "../../../../packages/designer/table-model";
import { CornerEditor } from "./CornerEditor";
import { useEffect, useRef, type ReactNode } from "react";
import type {
  DesignTemplate,
  DesignObject,
  Binding,
} from "../../../../packages/designer/model";
import type { Project } from "../../../../packages/core/model";
type Props = {
  simple?: boolean;
  tableTarget: TableTarget | null;
  onTableTarget: (t: TableTarget | null) => void;
  onEnterTable: () => void;
  first?: DesignObject;
  t: DesignTemplate;
  chosen: DesignObject[];
  project: Project;
  selection: string[];
  setSelection: (ids: string[]) => void;
  edit: (fn: (q: DesignTemplate) => void) => void;
  modify: (patch: Partial<DesignObject>) => void;
  numeric: (
    label: string,
    key: keyof DesignObject,
    min?: number,
    max?: number,
    step?: number,
  ) => ReactNode;
  color: (
    label: string,
    key: "fill" | "stroke" | "headerFill" | "headerColor" | "alternate",
  ) => ReactNode;
  image: (file?: File) => Promise<void>;
  align: (
    axis: "x" | "y",
    edge: "start" | "center" | "end" | "distribute",
  ) => void;
  setMessage: (v: string) => void;
  onChapterColor: (id: string, color: string) => void;
};
export function PropertiesPanel({
  simple,
  tableTarget,
  onTableTarget,
  onEnterTable,
  first,
  t,
  chosen,
  project,
  selection,
  setSelection,
  edit,
  modify,
  numeric,
  color,
  image,
  align,
  setMessage,
  onChapterColor,
}: Props) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (panel.current) panel.current.scrollTop = 0;
  }, [first?.id, t.id]);
  return (
    <aside ref={panel} className="designer-properties" aria-label="プロパティ">
      <h3>
        {first
          ? `${({ text: "文字", rect: "長方形", ellipse: "楕円", path: "パス", line: "直線", image: "画像", table: "表 · データ連動", index: "インデックス · データ連動", posters: "ポスター · データ連動", timetable: "時間割 · データ連動" } as Record<string, string>)[first.kind]}${chosen.length > 1 ? ` / ${chosen.length}個選択` : ""}`
          : "アートボード設定"}
      </h3>
      {first ? (
        <>
          {!simple && (
            <label>
              オブジェクト名
              <input
                aria-label="オブジェクト名"
                value={first.name}
                onChange={(e) => modify({ name: e.target.value })}
              />
            </label>
          )}
          <details
            className="geometry-settings"
            key={first.id}
            open={
              !simple &&
              !["table", "index", "posters", "timetable", "text"].includes(
                first.kind,
              )
            }
          >
            <summary>位置・サイズ・外観</summary>
            <div className="designer-numbers">
              {numeric("X（mm）", "x", 0, 148)}
              {numeric("Y（mm）", "y")}
              {numeric("幅（mm）", "w", 0.5, 148)}
              {numeric("高さ（mm）", "h", 0.5, 210)}
              {!["table", "index", "posters", "timetable"].includes(
                first.kind,
              ) && numeric("回転（度）", "rotation", -360, 360, 1)}
              {numeric("不透明度", "opacity", 0, 1, 0.05)}
            </div>
            <label>
              レイヤー
              <select
                value={first.layerId}
                onChange={(e) => modify({ layerId: e.target.value })}
              >
                {t.layers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            {!["image", "index", "text"].includes(first.kind) && (
              <div className="designer-numbers">
                {!["table", "timetable"].includes(first.kind) &&
                  color("塗り", "fill")}
                {first.kind !== "text" && (
                  <>
                    {color("線", "stroke")}
                    {numeric("線幅（mm）", "strokeWidth", 0, 10, 0.1)}
                  </>
                )}
              </div>
            )}
          </details>
          {["rect", "index", "table"].includes(first.kind) && (
            <CornerEditor
              value={first.corners ?? first.radius}
              linked={first.cornersLinked !== false}
              onLink={(cornersLinked) => modify({ cornersLinked })}
              onChange={(corners) => modify({ corners })}
            />
          )}
          {first.kind === "table" && (
            <TableInspector
              simple={simple}
              o={first}
              target={tableTarget}
              onTarget={onTableTarget}
              modify={modify}
              onEnter={onEnterTable}
            />
          )}
          {first.kind === "text" && (
            <>
              {(!simple || (first.binding === "none" && !first.repeatRole)) && (
                <label>
                  固定の文字
                  <textarea
                    aria-label="文字内容"
                    rows={5}
                    value={first.text}
                    onChange={(e) => modify({ text: e.target.value })}
                  />
                </label>
              )}
              {simple && (first.binding !== "none" || first.repeatRole) && (
                <p className="hint">
                  キャンバスの文字は確認用の見本です。冊子では登録された内容が入ります。
                </p>
              )}
              {color("文字色", "fill")}
              <label>
                フォント
                <input
                  aria-label="フォント"
                  readOnly
                  value="Noto Sans CJK JP（埋め込み）"
                  title="現在はNoto Sans CJK JPのみ対応しています"
                />
              </label>
              {numeric("行間（倍率）", "lineHeight", 1, 3, 0.1)}
              <label>
                文字揃え
                <select
                  value={first.textAlign || "left"}
                  onChange={(e) =>
                    modify({
                      textAlign: e.target.value as "left" | "center" | "right",
                    })
                  }
                >
                  <option value="left">左揃え</option>
                  <option value="center">中央揃え</option>
                  <option value="right">右揃え</option>
                </select>
              </label>
              {numeric("文字サイズ（mm）", "size", 1, 30, 0.1)}
              {first.binding === "block.body" && (
                <>
                  <label>
                    箇条書きのマーカー
                    <select
                      value={first.listMarker || "none"}
                      onChange={(e) =>
                        modify({
                          listMarker:
                            e.target.value === "none"
                              ? undefined
                              : (e.target.value as "disc" | "dash" | "number"),
                        })
                      }
                    >
                      <option value="none">なし（通常の本文）</option>
                      <option value="disc">丸点（・）</option>
                      <option value="dash">ダッシュ（—）</option>
                      <option value="number">番号（1. 2. 3.）</option>
                    </select>
                  </label>
                  {first.listMarker &&
                    numeric(
                      "項目のインデント（mm）",
                      "bulletIndent",
                      2,
                      25,
                      0.5,
                    )}
                </>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={first.bold}
                  onChange={(e) => modify({ bold: e.target.checked })}
                />
                太字
              </label>
            </>
          )}
          {["text", "image"].includes(first.kind) && !first.repeatRole && (
            <label>
              {simple ? "表示する内容" : "データ連動"}
              <select
                aria-label="データ連動"
                value={first.binding}
                onChange={(e) => modify({ binding: e.target.value as Binding })}
              >
                <option value="none">固定内容</option>
                {(first.kind === "image"
                  ? [
                      ["event.poster", "企画のポスター画像"],
                      ["advertisement", "協賛広告"],
                    ]
                  : [
                      ["block.body", "本文・箇条書き"],
                      ["page.title", "ページ見出し"],
                      ["event.name", "企画名"],
                      ["event.group", "団体名"],
                      ["event.place", "場所"],
                      ["page.number", "ページ番号"],
                      ["chapter.name", "現在の章"],
                      ["project.festival", "開催回数・祭名"],
                      ["project.date", "開催日"],
                    ]
                ).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          )}
          {first.kind === "image" && (
            <>
              {(!simple || (first.binding === "none" && !first.repeatRole)) && (
                <label className="upload small">
                  画像・PDFを登録
                  <input
                    hidden
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
                    onChange={(e) => {
                      void image(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              <p className="hint">常に縦横比を維持して全体表示します。</p>
              {first.binding === "advertisement" && (
                <label>
                  広告規格
                  <select
                    value={first.adSize || "quarter"}
                    onChange={(e) => {
                      const size = e.target.value as
                        "full" | "half" | "quarter";
                      modify({
                        adSize: size,
                        w: project.theme.adWidth,
                        h:
                          size === "full"
                            ? project.theme.adHeight
                            : size === "half"
                              ? project.theme.adHalfHeight
                              : project.theme.adQuarterHeight,
                      });
                    }}
                  >
                    <option value="full">1ページ 125×180mm</option>
                    <option value="half">1/2ページ 125×85mm</option>
                    <option value="quarter">1/4ページ 125×45mm</option>
                  </select>
                </label>
              )}
            </>
          )}
          {first.kind === "path" && (
            <>
              <label className="check">
                <input
                  type="checkbox"
                  checked={!!first.closed}
                  onChange={(e) => modify({ closed: e.target.checked })}
                />
                パスを閉じる
              </label>
              <button
                onClick={() =>
                  modify({
                    anchors: first.anchors?.map((a) => ({
                      ...a,
                      in: { x: a.x - 0.12, y: a.y },
                      out: { x: a.x + 0.12, y: a.y },
                    })),
                  })
                }
              >
                曲線ハンドルを追加
              </button>
              <button
                onClick={() =>
                  modify({
                    anchors: first.anchors?.map((a) => ({
                      x: a.x,
                      y: a.y,
                    })),
                  })
                }
              >
                直線に戻す
              </button>
              <p className="hint">
                アンカーツールで白丸と接線ハンドルをドラッグできます。
              </p>
            </>
          )}
          {first.kind === "table" && (
            <>
              <h3>表のスタイル・データ</h3>
              {numeric("見出し行高", "headerHeight", 4, 30, 0.5)}
              {numeric("最小行高", "rowHeight", 4, 30, 0.5)}
              {!first.tableStyle && (
                <>
                  {numeric("セル内余白", "padding", 0, 6, 0.5)}
                  {numeric("表の文字サイズ", "size", 1.5, 8, 0.1)}
                  {color("見出し背景", "headerFill")}
                  {color("見出し文字", "headerColor")}
                  {color("交互の行色", "alternate")}
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={first.groupBuildings}
                      onChange={(e) =>
                        modify({ groupBuildings: e.target.checked })
                      }
                    />
                    建物別の見出し
                  </label>
                </>
              )}
              {first.columns?.map((c, i) => (
                <div className="designer-table-column" key={i}>
                  <input
                    aria-label={`列${i + 1}見出し`}
                    value={c.label}
                    onChange={(e) =>
                      modify({
                        columns: first.columns!.map((a, j) =>
                          j === i ? { ...a, label: e.target.value } : a,
                        ),
                      })
                    }
                  />
                  <select
                    aria-label={`列${i + 1}データ`}
                    value={c.field}
                    onChange={(e) =>
                      modify({
                        columns: first.columns!.map((a, j) =>
                          j === i
                            ? {
                                ...a,
                                field: e.target.value as typeof c.field,
                              }
                            : a,
                        ),
                      })
                    }
                  >
                    {[
                      "name",
                      "group",
                      "place",
                      "placeShort",
                      "building",
                      "floor",
                      "room",
                      "location",
                    ].map((k) => (
                      <option key={k} value={k}>
                        {
                          {
                            name: "企画名",
                            group: "団体名",
                            place: "場所",
                            placeShort: "階・教室／場所",
                            building: "建物",
                            floor: "階",
                            room: "教室番号",
                            location: "補足場所",
                          }[k]
                        }
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`列${i + 1}幅比率`}
                    type="number"
                    min="1"
                    value={c.weight}
                    onChange={(e) =>
                      modify({
                        columns: first.columns!.map((a, j) =>
                          j === i
                            ? { ...a, weight: Math.max(1, +e.target.value) }
                            : a,
                        ),
                      })
                    }
                  />
                </div>
              ))}
              <button
                onClick={() =>
                  modify({
                    columns: [
                      ...first.columns!,
                      { label: "追加列", field: "name", weight: 20 },
                    ],
                  })
                }
              >
                列を追加
              </button>
              <button
                disabled={first.columns!.length < 2}
                onClick={() => modify({ columns: first.columns!.slice(0, -1) })}
              >
                最後の列を削除
              </button>
            </>
          )}
          {first.kind === "posters" && (
            <>
              <h3>繰り返し配置</h3>
              {numeric("列数", "cols", 1, 6, 1)}
              {numeric("行数", "rows", 1, 8, 1)}
              {numeric("間隔（mm）", "gap", 0, 20, 0.5)}
              {numeric("企画名文字サイズ", "size", 1.5, 6, 0.1)}
              <p className="hint">
                企画数から自動改ページ。画像は縦長枠内に全体表示します。広告枠は別オブジェクトで配置します。
              </p>
            </>
          )}
          {first.kind === "index" && (
            <>
              <h3>タブ設定 · {project.chapters.length}章</h3>

              <label>
                形状
                <select
                  aria-label="インデックス形状"
                  value={
                    first.tabShape || (first.radius > 0 ? "rounded" : "rect")
                  }
                  onChange={(e) =>
                    modify({
                      tabShape: e.target.value as DesignObject["tabShape"],
                    })
                  }
                >
                  <option value="rounded">角丸</option>
                  <option value="rect">四角</option>
                  <option value="outer">外側だけ角丸</option>
                  <option value="top">上側だけ角丸</option>
                  <option value="bottom">下側だけ角丸</option>
                  <option value="slant">外側を斜めに</option>
                  <option value="path">SVGパス（0〜1）</option>
                </select>
              </label>
              <p className="hint">
                タブの高さは領域の高さと章数から自動調整します。
              </p>
              {first.tabShape === "path" && (
                <label>
                  正規化パス
                  <textarea
                    aria-label="インデックスSVGパス"
                    value={first.tabPath || ""}
                    onChange={(e) => modify({ tabPath: e.target.value })}
                  />
                  <small>M/L/Q/C/Z、絶対座標0〜1</small>
                </label>
              )}
              <label>
                文字色
                <input
                  type="color"
                  value={first.tabTextColor || "#231815"}
                  onChange={(e) => modify({ tabTextColor: e.target.value })}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={first.useChapterColors !== false}
                  onChange={(e) =>
                    modify({ useChapterColors: e.target.checked })
                  }
                />
                章のテーマカラーを使う
              </label>
              {!first.useChapterColors && color("タブの塗り", "fill")}
              {color("タブの線", "stroke")}
              {numeric("タブ線幅（mm）", "strokeWidth", 0, 5, 0.1)}
              <h3>章の配色</h3>
              {project.chapters.map((ch) => (
                <label className="chapter-color" key={ch.id}>
                  {ch.name}
                  <input
                    type="color"
                    aria-label={`${ch.name}の章色`}
                    value={ch.color}
                    onChange={(e) => onChapterColor(ch.id, e.target.value)}
                  />
                  <input
                    aria-label={`${ch.name}の章色カラーコード`}
                    key={ch.color}
                    defaultValue={ch.color}
                    onBlur={(e) => {
                      if (/^#[a-f0-9]{6}$/i.test(e.target.value))
                        onChapterColor(ch.id, e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                </label>
              ))}

              {numeric("タブ間隔", "gap", 0, 5, 0.1)}
              {numeric("章名文字サイズ", "size", 1, 8, 0.1)}
              {numeric("非選択の不透明度", "inactiveOpacity", 0, 1, 0.05)}
              <label className="check">
                <input
                  type="checkbox"
                  checked={first.vertical}
                  onChange={(e) => modify({ vertical: e.target.checked })}
                />
                章名を縦に配置
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={first.mirror}
                  onChange={(e) => modify({ mirror: e.target.checked })}
                />
                左ページで左右反転
              </label>
            </>
          )}
          {first.kind === "timetable" && (
            <>
              <h3>時間軸・分割</h3>
              {first.eventSource === "stage" && (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={!first.vertical && first.spread !== false}
                    onChange={(e) =>
                      modify({
                        spread: e.target.checked,
                        ...(e.target.checked ? { vertical: false } : {}),
                      })
                    }
                  />
                  見開き2ページに1本の横時間軸
                </label>
              )}
              {first.eventSource === "stage" &&
                !first.vertical &&
                first.spread !== false && (
                  <p className="hint">
                    左右をつなげて組版し、中央には文字を置きません。確認ページで左右を切り替えられます。制作モードでは「見開き」で確認できます。
                  </p>
                )}

              {first.eventSource === "stage" && (
                <>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={first.verticalText === true}
                      onChange={(e) =>
                        modify({ verticalText: e.target.checked })
                      }
                    />
                    企画名を縦に配置
                  </label>
                  {numeric("時刻ラベル間隔（分）", "tickMinutes", 15, 120, 15)}
                  <label>
                    学生ステージの色
                    <input
                      type="color"
                      value={first.studentStageColor || first.alternate}
                      onChange={(e) =>
                        modify({ studentStageColor: e.target.value })
                      }
                    />
                  </label>
                  <p className="hint">
                    ステージ企画と学生ステージ企画を自動表示します。内容は掲載情報で編集します。
                  </p>
                </>
              )}

              <label className="check">
                <input
                  type="checkbox"
                  checked={first.vertical}
                  onChange={(e) => modify({ vertical: e.target.checked })}
                />
                縦方向の時間軸
              </label>
              {numeric(
                first.eventSource === "stage" &&
                  !first.vertical &&
                  first.spread !== false
                  ? "1見開きの企画件数"
                  : "1ページの企画件数",
                "itemsPerPage",
                1,
                24,
                1,
              )}
              {numeric("ラベル文字サイズ", "size", 1.5, 8, 0.1)}
              {numeric("企画の間隔（mm）", "gap", 0, 20, 0.5)}
              {numeric("ラベル余白（mm）", "padding", 0, 6, 0.5)}
              {color("交互ラベル色", "alternate")}
              {color("時間ラベル背景", "headerFill")}
              {color("時間ラベル文字", "headerColor")}
              <p className="hint">
                制作モードの企画に開始・終了時刻を登録してください。時間順に並べます。
              </p>
            </>
          )}
          {first.binding === "page.number" && (
            <label className="check">
              <input
                type="checkbox"
                checked={first.mirror}
                onChange={(e) => modify({ mirror: e.target.checked })}
              />
              左ページで外側へ反転
            </label>
          )}
          {simple ? (
            <p className="hint">移動と拡大縮小はキャンバスで操作できます。</p>
          ) : null}
          <details open={!simple || chosen.length > 1}>
            <summary>整列・順序</summary>
            <div className="designer-align">
              {(["start", "center", "end", "distribute"] as const).map(
                (edge) => (
                  <button
                    key={edge}
                    disabled={chosen.length < 2}
                    onClick={() => align("x", edge)}
                  >
                    {
                      {
                        start: "左揃え",
                        center: "左右中央",
                        end: "右揃え",
                        distribute: "横均等",
                      }[edge]
                    }
                  </button>
                ),
              )}
              {(["start", "center", "end", "distribute"] as const).map(
                (edge) => (
                  <button
                    key={edge}
                    disabled={chosen.length < 2}
                    onClick={() => align("y", edge)}
                  >
                    {
                      {
                        start: "上揃え",
                        center: "上下中央",
                        end: "下揃え",
                        distribute: "縦均等",
                      }[edge]
                    }
                  </button>
                ),
              )}
            </div>
            <button
              onClick={() =>
                edit((q) => {
                  const a = q.objects.filter((o) => selection.includes(o.id));
                  q.objects = [
                    ...q.objects.filter((o) => !selection.includes(o.id)),
                    ...a,
                  ];
                })
              }
            >
              前面へ
            </button>
            <button
              onClick={() =>
                edit((q) => {
                  const a = q.objects.filter((o) => selection.includes(o.id));
                  q.objects = [
                    ...a,
                    ...q.objects.filter((o) => !selection.includes(o.id)),
                  ];
                })
              }
            >
              背面へ
            </button>
            <button
              className="danger"
              onClick={() => {
                edit((q) => {
                  q.objects = q.objects.filter(
                    (o) => !selection.includes(o.id),
                  );
                });
                setSelection([]);
              }}
            >
              選択を削除
            </button>
          </details>
        </>
      ) : (
        <>
          {simple && (
            <p className="hint">
              紙面で編集したい図形や文字を選択してください。
            </p>
          )}
          <details open={!simple}>
            <summary>用紙・ガイドの詳細設定</summary>
            <label>
              テンプレートの種類
              <select
                value={t.kind}
                disabled={t.objects.some((o) => o.repeatRole)}
                onChange={(e) =>
                  edit((q) => {
                    q.kind = e.target.value as typeof t.kind;
                  })
                }
              >
                <option value="notice">情報・自由配置</option>
                <option value="stage">タイムテーブル</option>
                <option value="staff">スタッフ紹介</option>
                <option value="kitchen">キッチンカー紹介</option>
                <option value="events">企画一覧</option>
                <option value="posters">ポスター紹介</option>
                <option value="ads">協賛広告（枠数で自動改ページ）</option>
                <option value="cover">表紙</option>
                <option value="back">裏表紙</option>
              </select>
            </label>
            {(!t.scope || t.scope === "page") && (
              <>
                <label>
                  背景色
                  <input
                    type="color"
                    value={t.background}
                    onChange={(e) =>
                      edit((q) => {
                        q.background = e.target.value;
                      })
                    }
                  />
                </label>
              </>
            )}
            <label>
              共通マスター
              <select
                aria-label="共通マスター"
                value={t.masterId || ""}
                disabled={project.templates.some((m) => m.masterId === t.id)}
                onChange={(e) =>
                  edit((q) => {
                    q.masterId = e.target.value || undefined;
                  })
                }
              >
                <option value="">使用しない</option>
                {project.templates
                  .filter(
                    (m) =>
                      m.id !== t.id &&
                      (m.scope === "master" || m.id === t.masterId) &&
                      !m.masterId &&
                      !m.objects.some((o) =>
                        ["table", "posters", "timetable"].includes(o.kind),
                      ),
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              グリッド間隔（mm）
              <input
                type="number"
                min=".5"
                max="20"
                step=".5"
                value={t.grid}
                onChange={(e) =>
                  edit((q) => {
                    q.grid = Math.max(0.5, Math.min(20, +e.target.value));
                  })
                }
              />
            </label>
            <label>
              縦ガイド x（mm・カンマ区切り）
              <input
                defaultValue={t.guidesX.join(",")}
                key={t.id + "x"}
                onBlur={(e) => {
                  const values = e.target.value
                    .split(",")
                    .filter(Boolean)
                    .map(Number);
                  if (
                    values.every(
                      (n) => Number.isFinite(n) && n >= 0 && n <= 148,
                    )
                  )
                    edit((q) => {
                      q.guidesX = values;
                    });
                  else setMessage("ガイドは0〜148mmで入力してください。");
                }}
              />
            </label>
            <label>
              横ガイド y（mm・カンマ区切り）
              <input
                defaultValue={t.guidesY.join(",")}
                key={t.id + "y"}
                onBlur={(e) => {
                  const values = e.target.value
                    .split(",")
                    .filter(Boolean)
                    .map(Number);
                  if (
                    values.every(
                      (n) => Number.isFinite(n) && n >= 0 && n <= 210,
                    )
                  )
                    edit((q) => {
                      q.guidesY = values;
                    });
                  else setMessage("ガイドは0〜210mmで入力してください。");
                }}
              />
            </label>
            <p className="hint">
              選択枠・グリッド・ガイドは編集補助で、PDFには出力しません。図形・文字・パス・表はベクターで出力します。
            </p>
            <h3>操作ヒント</h3>
            <p className="hint">
              Ctrl / Cmd + Z：取り消し
              <br />
              Shift + Ctrl / Cmd + Z：やり直し
              <br />
              Ctrl / Cmd + C・V：コピー・ペースト
              <br />
              Ctrl / Cmd + D：複製
              <br />
              Ctrl / Cmd + G：グループ化
              <br />
              Shift + Ctrl / Cmd + G：解除
              <br />
              矢印：1mm / Shift：10mm
              <br />
              ペン：Enterで確定 / Escで解除
            </p>
          </details>
        </>
      )}
    </aside>
  );
}
