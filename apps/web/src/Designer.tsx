import { sampleScenario } from "./editor/shared-start";
import {
  penGeometry,
  polygonObject,
  reverseAnchors,
  splitPath,
  type PenPoint,
} from "../../../packages/designer/path-tools";
import { PaletteControl } from "./workspace/PaletteControl";
import { recolorNodes } from "../../../packages/core/color-palette";
import type { TableTarget } from "../../../packages/designer/table-model";
import { resolveObject } from "../../../packages/designer/components";
import { corners } from "../../../packages/designer/corners";
import { EditorShell, StatusBar } from "./editor/EditorShell";
import { MenuBar, type MenuAction } from "./editor/MenuBar";
import { ToolBar, editorTools, type Tool } from "./editor/ToolBar";
import { TemplatePanel } from "./editor/TemplatePanel";
import { LayerPanel } from "./editor/LayerPanel";
import { PagePanel } from "./editor/PagePanel";
import { PropertiesPanel } from "./editor/PropertiesPanel";
import {
  createPresetTemplate,
  removeObjects,
  reorderObjects,
} from "./editor/commands";
import { EditorDialog, type Preset } from "./editor/EditorDialog";
import "./editor/editor.css";
import {
  useMemo,
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  createDesign,
  object,
  validateDesign,
  type DesignTemplate,
  type DesignObject,
  type ObjectKind,
  type Binding,
} from "../../../packages/designer/model";
import { renderTemplate } from "../../../packages/designer/render";
import {
  bounds,
  constrain,
  fromPoints,
  rotateObjects,
} from "../../../packages/designer/geometry";
import { uid, type Project, type Asset } from "../../../packages/core/model";
import { type Measure } from "../../../packages/layout-engine";
import { Canvas } from "./editor/Canvas";
import { download, dataBytes } from "../../../packages/project-storage";
import { importAsset } from "./assets";
interface Props {
  shared?: boolean;
  onNewShared?: () => void;
  onTemplateFocus?: (id: string) => void;
  project: Project;
  contextPage?: import("../../../packages/layout-engine").LayoutPage;
  initialTemplateId?: string;
  currentBlockId?: string;
  saveState: string;
  onProjectEdit: (fn: (p: Project) => void) => void;
  onSelectBlock: (id: string) => void;
  measure: Measure;
  onChange: (t: DesignTemplate) => void;
  onCreate: (t: DesignTemplate) => void;
  onRemove: (id: string) => void;
  onAssets: (assets: Asset[]) => void;
  onApply: (id: string, newPage: boolean) => void;
  onClose: () => void;
  onCapture: () => DesignTemplate;
  onPDF: (id: string, sample?: Project) => void;
  onProjectSave: () => void;
}
const tools = editorTools.map((t) => [t.id, "", `${t.name} ${t.key}`] as const);
const names: Record<string, string> = {
  table: "企画一覧表",
  index: "インデックス",
  posters: "ポスター",
  timetable: "タイムテーブル",
};
export function Designer(props: Props) {
  const quickRef = useRef<HTMLDivElement>(null);
  const [alignBoard, setAlignBoard] = useState(false);
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const penDrag = useRef<{
    index: number;
    start: { x: number; y: number };
  } | null>(null);
  const [drawingOpen, setDrawingOpen] = useState(false);
  const [hideLibrary, setHideLibrary] = useState(!!props.shared);
  const [hideProperties, setHideProperties] = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const [isolatedGroup, setIsolatedGroup] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { project, measure } = props;
  const [editingComponentId, setEditingComponentId] = useState<string | null>(
      null,
    ),
    [tableTarget, setTableTarget] = useState<TableTarget | null>(null);
  const [panel, setPanel] = useState<"layers" | "pages" | "templates">(
    "layers",
  );
  const [dialog, setDialog] = useState<"start" | "new" | "help" | null>(
    props.shared ? null : "start",
  );
  const [context, setContext] = useState<{ x: number; y: number } | null>(null);
  const [textEditing, setTextEditing] = useState<{
    id: string;
    value: string;
  } | null>(null);
  const [sampleCount, setSampleCount] = useState(-1),
    [scenario, setScenario] = useState("normal"),
    [showGrid, setShowGrid] = useState(false),
    [showGuides, setShowGuides] = useState(true),
    [showRulers, setShowRulers] = useState(true);
  const imageRef = useRef<HTMLInputElement>(null),
    imagePosition = useRef({ x: 20, y: 30 }),
    space = useRef(false);
  const [id, setId] = useState(
    props.initialTemplateId || project.templates[0]?.id || "",
  );
  const previewProject = useMemo(
    () =>
      props.shared
        ? sampleScenario(project, scenario)
        : sampleCount < 0
          ? project
          : {
              ...project,
              events: Array.from({ length: sampleCount }, (_, i) => ({
                id: `preview-${i}`,
                name: `サンプル企画 ${i + 1}${i % 5 === 0 ? " みんなで楽しむ体験ワークショップ" : ""}`,
                category: (project.templates.find((t) => t.id === id)
                  ?.componentKind === "timetable" ||
                project.templates.find((t) => t.id === id)?.kind === "stage"
                  ? i % 2
                    ? "studentStage"
                    : "stage"
                  : "student") as import("../../../packages/core/registration").EventCategory,
                group: `学生団体 ${i + 1}`,
                building: i % 2 ? "本館" : "FLOS館",
                floor: (i % 3) + 1,
                room: `${100 + i}`,
                location: "教室",
                startTime: `${9 + Math.floor(i / 4)}:${String((i % 4) * 15).padStart(2, "0")}`,
                endTime: "17:00",
              })),
            },
    [project, sampleCount, id, props.shared, scenario],
  );

  const [selection, setSelection] = useState<string[]>([]),
    [tool, setTool] = useState<Tool>("select"),
    [zoom, setZoom] = useState(() =>
      Math.min(
        props.shared ? 1.4 : 1,
        Math.max(0.5, (window.innerHeight - 195) / ((440 * 210) / 148)),
      ),
    ),
    [temp, setTemp] = useState<DesignTemplate | null>(null),
    [pen, setPen] = useState<PenPoint[]>([]),
    [rubber, setRubber] = useState<{
      x: number;
      y: number;
      w: number;
      h: number;
    } | null>(null),
    [message, setMessage] = useState(""),
    [pageIndex, setPageIndex] = useState(0);
  const templateHistories = useRef(
    new Map<string, { past: DesignTemplate[]; future: DesignTemplate[] }>(),
  );
  const hist = useRef<DesignTemplate[]>([]),
    future = useRef<DesignTemplate[]>([]),
    clip = useRef<DesignObject[]>([]),
    svg = useRef<SVGSVGElement>(null),
    fileRef = useRef<HTMLInputElement>(null),
    drag = useRef<{
      mode:
        | "move"
        | "resize"
        | "rotate"
        | "marquee"
        | "create"
        | "anchor"
        | "pan"
        | "column";
      start: { x: number; y: number };
      source: DesignTemplate;
      ids: string[];
      anchor?: number;
      column?: number;
      handle?: "in" | "out";
      client?: { x: number; y: number };
      scroll?: { x: number; y: number };
    } | null>(null);
  const saved =
      project.templates.find((t) => t.id === id) || project.templates[0],
    t = temp || saved;
  const chosen =
      t?.objects
        .filter((o) => selection.includes(o.id))
        .map((o) => resolveObject(project, o)) || [],
    first = chosen[0],
    layerId =
      first?.layerId ||
      [...(t?.layers || [])].reverse().find((l) => !l.locked && l.visible)?.id;
  const rendered = useMemo(
    () =>
      t
        ? renderTemplate(previewProject, t, measure, {
            side: "right",
            chapterId: project.chapters[4]?.id,
            ...(props.shared
              ? {
                  title: t.category ?? t.name,
                  previewAds: true,
                  blockId: previewProject.blocks.find((b) => b.body?.trim())
                    ?.id,
                }
              : {}),
          })
        : [[]],
    [t, previewProject, measure, props.shared],
  );
  const scene = recolorNodes(
    project,
    rendered[Math.min(pageIndex, rendered.length - 1)] || [],
  );
  useEffect(() => {
    props.onTemplateFocus?.(id);
  }, [id]);
  const selectedBox = chosen.length ? bounds(chosen) : null;
  useLayoutEffect(() => {
    const place = () => {
      const bar = quickRef.current,
        art = svg.current,
        box = selectedBox;
      if (!bar || !art || !box) return;
      const host = art.parentElement!.getBoundingClientRect(),
        matrix = art.getScreenCTM();
      if (!matrix) return;
      const point = art.createSVGPoint();
      point.x = box.x;
      point.y = box.y;
      const screen = point.matrixTransform(matrix);
      const width = Math.max(120, Math.min(520, host.width - 16));
      bar.style.width = width + "px";
      const left = Math.max(
        host.left + 8,
        Math.min(host.right - width - 8, screen.x),
      );
      let top = screen.y - bar.offsetHeight - 8;
      if (top < host.top + 8) top = screen.y + box.h * matrix.d + 8;
      top = Math.max(
        host.top + 8,
        Math.min(host.bottom - bar.offsetHeight - 8, top),
      );
      bar.style.left = left + "px";
      bar.style.top = top + "px";
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [
    selection.join(","),
    selectedBox?.x,
    selectedBox?.y,
    selectedBox?.w,
    selectedBox?.h,
    zoom,
    showQuick,
    hideLibrary,
    hideProperties,
  ]);
  useEffect(() => {
    if (!project.templates.some((t) => t.id === id) && project.templates[0])
      setId(project.templates[0].id);
  }, [project.templates, id]);
  useEffect(() => {
    if (props.initialTemplateId) {
      if (id !== props.initialTemplateId) {
        templateHistories.current.set(id, {
          past: hist.current,
          future: future.current,
        });
        setId(props.initialTemplateId);
        hist.current =
          templateHistories.current.get(props.initialTemplateId)?.past ?? [];
        future.current =
          templateHistories.current.get(props.initialTemplateId)?.future ?? [];
      }
      const initial = project.templates.find(
        (x) => x.id === props.initialTemplateId,
      );
      const target =
        props.shared &&
        initial?.objects.find(
          (o) =>
            o.repeatRole ||
            initial.scope === "component" ||
            ["table", "posters", "timetable"].includes(o.kind),
        );
      setSelection(target ? [target.id] : []);
      setEditingComponentId(
        target && target.kind === "table" ? target.id : null,
      );
      setTableTarget(
        target && target.kind === "table" ? { kind: "table" } : null,
      );
      setPageIndex(0);
      setTool("select");
      setTextEditing(null);
      setTemp(null);
    }
  }, [props.initialTemplateId]);
  function selectTemplate(nextId: string) {
    setEditingComponentId(null);
    setTableTarget(null);
    const def = project.templates.find((a) => a.id === nextId);
    if (def?.scope === "style") {
      if (!chosen.length) {
        setMessage("スタイルを適用するオブジェクトを先に選択してください。");
        return;
      }
      const source = def.objects[0];
      const keys = [
        "fill",
        "stroke",
        "strokeWidth",
        "opacity",
        "corners",
        "radius",
        "size",
        "bold",
        "lineHeight",
        "textAlign",
        "tableStyle",
        "dash",
      ] as const;
      const patch = Object.fromEntries(
        keys
          .filter((k) => source[k] !== undefined)
          .map((k) => [k, structuredClone(source[k])]),
      );
      modify(patch);
      setMessage("選択オブジェクトの外観だけを変更しました。");
      return;
    }

    templateHistories.current.set(id, {
      past: hist.current,
      future: future.current,
    });
    setId(nextId);
    const target =
      props.shared &&
      def?.objects.find(
        (o) =>
          o.repeatRole ||
          def.scope === "component" ||
          ["table", "posters", "timetable"].includes(o.kind),
      );
    setSelection(target ? [target.id] : []);
    if (target && target.kind === "table") {
      setEditingComponentId(target.id);
      setTableTarget({ kind: "table" });
    }
    setDrawingOpen(false);
    setTool("select");
    setTemp(null);
    hist.current = templateHistories.current.get(nextId)?.past ?? [];
    future.current = templateHistories.current.get(nextId)?.future ?? [];
    setPageIndex(0);
    setTextEditing(null);
  }
  function createPreset(kind: Preset, name: string) {
    const n = createPresetTemplate(
      kind,
      name || undefined,
      project.templates.length + 1,
    );
    props.onCreate(n);
    selectTemplate(n.id);
    setDialog(null);
    setPanel("layers");
    setMessage(
      props.shared
        ? "共通デザインの下書きを作成しました。公開すると冊子で選べます。"
        : "テンプレートを作成しました。制作ページへの反映は「テンプレート → 適用」から行います。",
    );
  }
  function capture() {
    const n = props.onCapture();
    props.onCreate(n);
    selectTemplate(n.id);
    setDialog(null);
    setMessage(
      "現在のページを固定図形として取り込みました。自動改ページにはデータ連動パーツを使用します。",
    );
  }
  function remove() {
    edit((q) => removeObjects(q, selection));
    setSelection([]);
  }
  function order(front: boolean) {
    edit((q) => reorderObjects(q, selection, front));
  }
  function copyTemplate() {
    const n = structuredClone(t);
    n.id = uid();
    n.name += " コピー";
    n.version = 1;
    props.onCreate(n);
    selectTemplate(n.id);
  }
  async function placeImage(file?: File) {
    if (!file || !layerId) return;
    try {
      setMessage("画像を登録中…");
      const { asset, warning } = await importAsset(file);
      props.onAssets([asset]);
      const o = object(
        "image",
        layerId,
        imagePosition.current.x,
        imagePosition.current.y,
        60,
        Math.min(100, (60 * asset.height) / asset.width),
      );
      o.assetId = asset.id;
      o.name = asset.name;
      Object.assign(o, constrain(o));
      edit((q) => q.objects.push(o));
      setSelection([o.id]);
      setTool("select");
      setMessage(warning || "画像を配置しました。縦横比を維持して表示します。");
    } catch (e) {
      setMessage(String(e));
    }
  }
  function saveText() {
    if (!textEditing) return;
    edit((q) => {
      const o = q.objects.find((o) => o.id === textEditing.id);
      if (o) o.text = textEditing.value;
    });
    setTextEditing(null);
  }
  const contextItems: MenuAction[] = [
    { label: "複製", run: () => duplicate(), disabled: !chosen.length },
    { label: "グループ化", run: () => group(), disabled: chosen.length < 2 },
    {
      label: "グループ解除",
      run: () => group(true),
      disabled: !chosen.some((o) => o.groupId),
    },
    { label: "最前面へ", run: () => order(true), disabled: !chosen.length },
    { label: "最背面へ", run: () => order(false), disabled: !chosen.length },
    { label: "削除", run: remove, disabled: !chosen.length },
  ];
  const menus = [
    {
      name: "ファイル",
      items: [
        {
          label: props.shared
            ? "共通ライブラリの下書きを保存"
            : "プロジェクトを保存…",
          run: props.onProjectSave,
          shortcut: "⌘/Ctrl S",
        },
        {
          label: "テンプレートを読み込む…",
          run: () => fileRef.current?.click(),
        },
        { label: "テンプレートを書き出す…", run: () => void exportTemplate() },
        {
          label: "PDFを書き出す…",
          run: () =>
            props.onPDF(t.id, props.shared ? previewProject : undefined),
        },
        {
          label: props.shared ? "共通ライブラリを閉じる" : "制作モードへ戻る",
          run: props.onClose,
        },
      ],
    },
    {
      name: "編集",
      items: [
        { label: "取り消し", run: () => undo(), shortcut: "⌘/Ctrl Z" },
        { label: "やり直し", run: () => undo(false), shortcut: "⇧ ⌘/Ctrl Z" },
        {
          label: "コピー",
          run: () => {
            clip.current = structuredClone(chosen);
          },
          disabled: !chosen.length,
        },
        { label: "ペースト", run: () => duplicate(true) },
      ],
    },
    {
      name: "オブジェクト",
      items: [
        ...contextItems,
        ...[false, true].map((star) => ({
          label: star ? "星形を追加" : "多角形を追加",
          disabled: !layerId || t.scope === "component",
          run: () => {
            if (!layerId) return;
            const o = polygonObject(layerId, star ? 5 : 6, star);
            edit((q) => q.objects.push(o));
            setSelection([o.id]);
          },
        })),
        {
          label: "パスの向きを反転",
          disabled: first?.kind !== "path",
          run: () => modify({ anchors: reverseAnchors(first?.anchors ?? []) }),
        },
        {
          label: "選んだ点でパスを分割",
          disabled:
            first?.kind !== "path" || anchorIndex === null || first.closed,
          run: () => {
            try {
              const [a, b] = splitPath(first!, anchorIndex!);
              edit((q) => {
                q.objects = q.objects.flatMap((o) =>
                  o.id === a.id ? [a, b] : [o],
                );
              });
              setSelection([a.id, b.id]);
              setAnchorIndex(null);
            } catch (e) {
              setMessage(String(e));
            }
          },
        },
        ...(["index", "table", "timetable", "posters"] as const).map((k) => ({
          label: `${names[k]}を追加`,
          run: () => {
            try {
              insert(k);
            } catch (e) {
              setMessage(String(e));
            }
          },
        })),
      ],
    },
    {
      name: "表示",
      items: [
        {
          label: showGrid ? "グリッドを隠す" : "グリッドを表示",
          run: () => setShowGrid(!showGrid),
        },
        {
          label: showGuides ? "ガイドを隠す" : "ガイドを表示",
          run: () => setShowGuides(!showGuides),
        },
        {
          label: showRulers ? "ルーラーを隠す" : "ルーラーを表示",
          run: () => setShowRulers(!showRulers),
        },
        { label: "100%で表示", run: () => setZoom(1) },
        {
          label: t.snap ? "スナップを無効にする" : "スナップを有効にする",
          run: () =>
            edit((q) => {
              q.snap = !q.snap;
            }),
        },
      ],
    },
    {
      name: "テンプレート",
      items: [
        {
          label: "新規テンプレート…",
          run: props.onNewShared ?? (() => setDialog("new")),
        },
        {
          label: "テンプレート一覧",
          run: () => {
            setHideLibrary(false);
            setPanel("templates");
          },
        },
        {
          label: "共通マスターとして複製",
          disabled: t.objects.some(
            (o) =>
              o.repeatRole ||
              ["table", "posters", "timetable"].includes(o.kind),
          ),
          run: () => {
            const n = structuredClone(t);
            n.id = uid();
            n.scope = "master";
            n.name += " 共通マスター";
            props.onCreate(n);
            selectTemplate(n.id);
          },
        },
        {
          label: "選択のスタイルを保存",
          disabled: !first,
          run: () => {
            if (!first) return;
            const n = createDesign("notice", first.name + " スタイル");
            n.scope = "style";
            n.componentKind = first.kind;
            n.objects = [
              {
                ...structuredClone(first),
                id: uid(),
                layerId: n.layers[0].id,
                templateRef: undefined,
                localOverrides: undefined,
                repeatRole: undefined,
              },
            ];
            props.onCreate(n);
            setMessage(
              "外観のスタイルを保存しました。対象を選んでライブラリから適用できます。",
            );
          },
        },
        { label: "現在のページから作成", disabled: props.shared, run: capture },
        { label: "複製して編集", run: copyTemplate },
        {
          label:
            t.scope === "component"
              ? "現在のページの部品を変更…"
              : "選択ページのデザインを変更",
          disabled: props.shared,
          run: () => {
            if (t.scope === "component") {
              props.onApply(t.id, false);
              return;
            }
            if (
              confirm(
                "選択した制作ページのデザインを変更します。登録情報は保持します。適用しますか？",
              )
            )
              props.onApply(t.id, false);
          },
        },
        {
          label: "新しい制作ページに追加",
          disabled:
            props.shared || t.scope === "component" || t.scope === "style",
          run: () => props.onApply(t.id, true),
        },
        {
          label: "テンプレートを削除…",
          run: () => {
            if (
              confirm(
                props.shared
                  ? `「${t.name}」の下書きを削除しますか？公開済みの版は残ります。`
                  : `「${t.name}」を削除しますか？使用中のページは標準デザインに戻ります。`,
              )
            )
              props.onRemove(t.id);
          },
        },
      ],
    },
    {
      name: "ヘルプ",
      items: [
        { label: "操作ガイド・ショートカット", run: () => setDialog("help") },
        { label: "作業の開始方法", run: () => setDialog("start") },
      ],
    },
  ];
  function commit(next: DesignTemplate, record = true) {
    if (!saved) return;
    try {
      validateDesign(next);
      if (record) {
        hist.current.push(structuredClone(saved));
        if (hist.current.length > 80) hist.current.shift();
        future.current = [];
      }
      next.version = saved.version + 1;
      next.updatedAt = new Date().toISOString();
      props.onChange(next);
      setTemp(null);
      setMessage(
        props.shared
          ? "共通デザインの下書きを変更しました"
          : "変更をプロジェクトに保存しました",
      );
    } catch (e) {
      setTemp(null);
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }
  function edit(fn: (next: DesignTemplate) => void) {
    if (!saved) return;
    const q = structuredClone(saved);
    fn(q);
    commit(q);
  }
  function modify(patch: Partial<DesignObject>) {
    if (patch.radius !== undefined && patch.corners === undefined)
      patch.corners = corners(patch.radius);
    edit((q) => {
      q.objects = q.objects.map((o) =>
        selection.includes(o.id) &&
        !o.locked &&
        !q.layers.find((l) => l.id === o.layerId)?.locked
          ? constrain({
              ...o,
              ...patch,
              ...(o.templateRef
                ? { localOverrides: { ...o.localOverrides, ...patch } }
                : {}),
            })
          : o,
      );
    });
  }
  function undo(back = true) {
    const a = back ? hist.current : future.current,
      b = back ? future.current : hist.current;
    const q = a.pop();
    if (!q || q.id !== saved?.id) return;
    b.push(structuredClone(saved));
    commit(q, false);
  }
  function newTemplate(
    kind: Project["blocks"][number]["template"],
    name?: string,
  ) {
    const n = createDesign(
      kind,
      name ||
        `${kind === "events" ? "表" : kind === "posters" ? "ポスター" : "自由配置"} ${project.templates.length + 1}`,
    );
    props.onCreate(n);
    setId(n.id);
    setSelection([]);
    hist.current = [];
    future.current = [];
    setPageIndex(0);
  }
  function insert(kind: ObjectKind) {
    if (t.scope === "component") {
      setMessage(
        "部品単独編集中です。別の部品はページテンプレートに追加してください。",
      );
      return;
    }
    if (!layerId) {
      setMessage("編集可能なレイヤーを作成してください。");
      return;
    }
    const o = object(
      kind,
      layerId,
      kind === "index" ? 140 : 12,
      kind === "index" ? 0 : 24,
      kind === "index" ? 8 : 126,
      kind === "index" ? 196 : kind === "table" ? 173 : 123,
    );
    if (kind === "index") {
      o.gap = 0.6;
      o.radius = 3;
      o.size = 2.8;
    }
    edit((q) => {
      if (
        ["table", "posters", "timetable"].includes(kind) &&
        q.objects.some((a) =>
          ["table", "posters", "timetable"].includes(a.kind),
        )
      )
        throw new Error(
          "自動改ページ部品は1個までです。既存の部品を削除して追加してください。",
        );
      q.objects.push(o);
    });
    setSelection([o.id]);
  }
  function group(ungroup = false) {
    const gid = uid();
    edit((q) => {
      q.objects = q.objects.map((o) =>
        selection.includes(o.id)
          ? { ...o, groupId: ungroup ? undefined : gid }
          : o,
      );
    });
  }
  function duplicate(paste = false) {
    const originals = paste ? clip.current : chosen;
    if (!originals.length) return;
    if (originals.some((o) => o.repeatRole)) {
      setMessage(
        "繰り返し枠は登録件数に合わせて自動で増えます。別案はテンプレートごとコピーしてください。",
      );
      return;
    }
    const clones = structuredClone(originals),
      groups = new Map<string, string>();
    for (const o of clones) {
      o.id = uid();
      o.x += 3;
      o.y += 3;
      if (o.groupId) {
        if (!groups.has(o.groupId)) groups.set(o.groupId, uid());
        o.groupId = groups.get(o.groupId);
      }
      Object.assign(o, constrain(o));
    }
    edit((q) => q.objects.push(...clones));
    setSelection(clones.map((o) => o.id));
  }
  function align(
    axis: "x" | "y",
    edge: "start" | "center" | "end" | "distribute",
  ) {
    if (!chosen.length || (!alignBoard && chosen.length < 2)) return;
    const b = alignBoard ? { x: 0, y: 0, w: 148, h: 210 } : bounds(chosen),
      dim = axis === "x" ? "w" : "h";
    edit((q) => {
      if (edge === "distribute" && chosen.length > 1) {
        const objects = q.objects
          .filter((o) => selection.includes(o.id))
          .sort((a, b) => a[axis] - b[axis]);
        const total = objects.reduce((s, o) => s + o[dim], 0),
          gap = (b[dim] - total) / (objects.length - 1);
        let cursor = b[axis];
        objects.forEach((o) => {
          o[axis] = cursor;
          cursor += o[dim] + gap;
        });
      } else
        for (const o of q.objects.filter(
          (o) =>
            selection.includes(o.id) &&
            !o.locked &&
            !q.layers.find((l) => l.id === o.layerId)?.locked,
        ))
          o[axis] =
            edge === "start"
              ? b[axis]
              : edge === "end"
                ? b[axis] + b[dim] - o[dim]
                : b[axis] + (b[dim] - o[dim]) / 2;
    });
  }
  function key(e: React.KeyboardEvent) {
    if (
      (e.target as HTMLElement).closest(
        "input,textarea,select,[contenteditable]",
      )
    )
      return;
    if (e.code === "Space") {
      e.preventDefault();
      space.current = true;
      return;
    }
    const mod = e.ctrlKey || e.metaKey,
      k = e.key.toLowerCase();
    if (mod && ["z", "y", "c", "v", "d", "g", "a", "s"].includes(k)) {
      e.preventDefault();
      if (k === "z") undo(!e.shiftKey);
      if (k === "y") undo(false);
      if (k === "c") clip.current = structuredClone(chosen);
      if (k === "v") duplicate(true);
      if (k === "d") duplicate();
      if (k === "g") group(e.shiftKey);
      if (k === "a")
        setSelection(
          t.objects
            .filter(
              (o) =>
                o.visible !== false &&
                t.layers.find((l) => l.id === o.layerId)?.visible &&
                !o.locked &&
                !t.layers.find((l) => l.id === o.layerId)?.locked,
            )
            .map((o) => o.id),
        );
      if (k === "s") {
        if (textEditing) saveText();
        props.onProjectSave();
      }
      return;
    }
    if (mod || e.altKey) return;
    if (e.key === "Escape" && editingComponentId) {
      e.preventDefault();
      if (tableTarget?.kind !== "table") {
        setTableTarget({ kind: "table" });
      } else {
        setEditingComponentId(null);
        setTableTarget(null);
      }
      return;
    }
    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      tool === "anchor" &&
      first?.kind === "path" &&
      anchorIndex !== null
    ) {
      e.preventDefault();
      if ((first.anchors?.length ?? 0) > 2) {
        modify({ anchors: first.anchors!.filter((_, i) => i !== anchorIndex) });
        setAnchorIndex(null);
      } else setMessage("パスには2個以上の点が必要です。");
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      edit((q) => {
        q.objects = q.objects.filter(
          (o) =>
            !selection.includes(o.id) ||
            o.locked ||
            q.layers.find((l) => l.id === o.layerId)?.locked,
        );
      });
      setSelection([]);
    } else if (e.key.startsWith("Arrow") && chosen.length) {
      e.preventDefault();
      const d = e.shiftKey ? 10 : 1;
      edit((q) => {
        q.objects = q.objects.map((o) =>
          selection.includes(o.id) &&
          !o.locked &&
          !q.layers.find((l) => l.id === o.layerId)?.locked
            ? constrain({
                ...o,
                x:
                  o.x +
                  (e.key === "ArrowRight" ? d : e.key === "ArrowLeft" ? -d : 0),
                y:
                  o.y +
                  (e.key === "ArrowDown" ? d : e.key === "ArrowUp" ? -d : 0),
              })
            : o,
        );
      });
    } else if (e.key === "Escape") {
      if (drag.current) {
        setTemp(null);
        drag.current = null;
        setRubber(null);
        return;
      }
      if (isolatedGroup) {
        setIsolatedGroup(null);
        return;
      }
      setContext(null);
      setTextEditing(null);
      setPen([]);
      penDrag.current = null;
      setSelection([]);
      setTool("select");
      setTemp(null);
      drag.current = null;
    } else if (e.key === "Enter" && pen.length >= 2) finishPen();
    else {
      const found = tools.find(([, , label]) =>
        label.endsWith(" " + e.key.toUpperCase()),
      );
      if (found) setTool(found[0]);
    }
  }
  function point(e: ReactPointerEvent) {
    const matrix = svg.current!.getScreenCTM()!;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      matrix.inverse(),
    );
    return {
      x: p.x,
      y: p.y,
    };
  }
  function snap(value: number, axis: "x" | "y", q = t) {
    if (!q.snap) return value;
    const grid = Math.round(value / q.grid) * q.grid,
      lines = [
        ...(axis === "x" ? q.guidesX : q.guidesY),
        ...q.objects
          .filter((o) => !selection.includes(o.id))
          .flatMap((o) =>
            axis === "x"
              ? [o.x, o.x + o.w / 2, o.x + o.w]
              : [o.y, o.y + o.h / 2, o.y + o.h],
          ),
      ];
    return lines.find((v) => Math.abs(v - value) < 0.65) ?? grid;
  }
  function finishPen(closed = false) {
    if (pen.length < 2 || !layerId) return;
    const o = object("path", layerId);
    Object.assign(o, penGeometry(pen), {
      name: "ベジェパス",
      fill: "none",
      closed,
    });
    edit((q) => q.objects.push(o));
    setSelection([o.id]);
    setPen([]);
    setTool("anchor");
  }
  function down(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget.closest(".designer-root") as HTMLElement)?.focus({
      preventScroll: true,
    });
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e),
      target = e.target as SVGElement,
      handle = target.closest("[data-handle]"),
      hit = target.closest("[data-object]"),
      anchor = target.closest("[data-anchor]");
    const columnHit = target.closest("[data-column-handle]");
    if (columnHit && first?.kind === "table") {
      drag.current = {
        mode: "column",
        start: p,
        source: structuredClone(t),
        ids: [first.id],
        column: Number(columnHit.getAttribute("data-column-handle")),
      };
      return;
    }
    const internal = target.closest("[data-table-part]");
    if (internal && editingComponentId) {
      setSelection([editingComponentId]);
      const part: TableTarget = JSON.parse(
        internal.getAttribute("data-table-part")!,
      );
      setTableTarget(
        props.shared && ["row", "cell", "border"].includes(part.kind)
          ? part.column === undefined
            ? { kind: "table" }
            : { kind: "column", column: part.column }
          : part,
      );
      return;
    }
    if (tool === "hand" || space.current) {
      const el = e.currentTarget.parentElement!;
      drag.current = {
        mode: "pan",
        start: p,
        source: structuredClone(t),
        ids: [],
        client: { x: e.clientX, y: e.clientY },
        scroll: { x: el.scrollLeft, y: el.scrollTop },
      };
      return;
    }
    if (tool === "pen") {
      if (t.scope === "component") {
        setMessage(
          "自動組版用の部品はプロパティで編集します。自由作図はページかマスターを選んでください。",
        );
        return;
      }
      if (pen.length >= 3 && Math.hypot(p.x - pen[0].x, p.y - pen[0].y) < 1.8) {
        finishPen(true);
        return;
      }
      const pos = { x: snap(p.x, "x"), y: snap(p.y, "y") };
      penDrag.current = { index: pen.length, start: pos };
      setPen((ps) => [...ps, pos]);
      return;
    }
    if (handle && selection.length) {
      drag.current = {
        mode:
          handle.getAttribute("data-handle") === "rotate" ? "rotate" : "resize",
        start: p,
        source: structuredClone(t),
        ids: selection,
      };
      return;
    }
    if (anchor && first) {
      setAnchorIndex(Number(anchor.getAttribute("data-anchor")));
      drag.current = {
        mode: "anchor",
        start: p,
        source: structuredClone(t),
        ids: [first.id],
        anchor: Number(anchor.getAttribute("data-anchor")),
        handle:
          (anchor.getAttribute("data-control") as "in" | "out") || undefined,
      };
      return;
    }
    if (tool === "select" || tool === "anchor") {
      if (hit) {
        let o = t.objects.find(
          (o) => o.id === hit.getAttribute("data-object"),
        )!;
        if (e.altKey) {
          const all = [...t.objects]
            .reverse()
            .filter(
              (a) =>
                a.visible !== false &&
                !a.locked &&
                t.layers.find((l) => l.id === a.layerId)?.visible &&
                !t.layers.find((l) => l.id === a.layerId)?.locked &&
                p.x >= a.x &&
                p.x <= a.x + a.w &&
                p.y >= a.y &&
                p.y <= a.y + a.h,
            );
          const current = all.findIndex((a) => selection.includes(a.id));
          o = all[(current + 1) % Math.max(1, all.length)] ?? o;
        }
        if (o.locked || o.visible === false) return;
        if (t.layers.find((l) => l.id === o.layerId)?.locked) return;
        const ids =
          o.groupId && o.groupId !== isolatedGroup
            ? t.objects.filter((a) => a.groupId === o.groupId).map((a) => a.id)
            : [o.id];
        const selected = e.shiftKey
          ? selection.includes(o.id)
            ? selection.filter((id) => !ids.includes(id))
            : [...new Set([...selection, ...ids])]
          : selection.includes(o.id)
            ? selection
            : ids;
        setSelection(selected);
        drag.current = {
          mode: "move",
          start: p,
          source: structuredClone(t),
          ids: selected,
        };
      } else {
        if (!e.shiftKey) setSelection([]);
        drag.current = {
          mode: "marquee",
          start: p,
          source: structuredClone(t),
          ids: e.shiftKey ? selection : [],
        };
        setRubber({ ...p, w: 0, h: 0 });
      }
      return;
    }
    if (t.scope === "component") {
      setMessage(
        "部品の設定はプロパティで変更できます。自由作図はページ・マスターで行ってください。",
      );
      return;
    }
    if (!layerId) return;
    if (tool === "image") {
      imagePosition.current = p;
      imageRef.current?.click();
      return;
    }
    const o = object(
      tool as ObjectKind,
      layerId,
      snap(p.x, "x"),
      snap(p.y, "y"),
      0.5,
      0.5,
    );
    if (tool === "text") {
      o.w = 50;
      o.h = 12;
      o.text = "";
      o.fill = "#231815";
      o.stroke = "none";
      edit((q) => q.objects.push(constrain(o)));
      setSelection([o.id]);
      setTextEditing({ id: o.id, value: "" });
      setTool("select");
      return;
    }
    const source = structuredClone(t);
    source.objects.push(o);
    setTemp(source);
    setSelection([o.id]);
    drag.current = {
      mode: "create",
      start: { x: o.x, y: o.y },
      source,
      ids: [o.id],
    };
  }
  function move(e: ReactPointerEvent<SVGSVGElement>) {
    if (penDrag.current) {
      const pos = point(e),
        { index, start } = penDrag.current;
      if (Math.hypot(pos.x - start.x, pos.y - start.y) > 0.3)
        setPen((points) =>
          points.map((p, i) =>
            i === index
              ? {
                  ...p,
                  in: { x: 2 * start.x - pos.x, y: 2 * start.y - pos.y },
                  out: { x: pos.x, y: pos.y },
                }
              : p,
          ),
        );
      return;
    }
    const d = drag.current;
    if (!d) return;
    const p = point(e),
      q = structuredClone(d.source),
      objects = q.objects.filter(
        (o) =>
          d.ids.includes(o.id) &&
          !o.locked &&
          !q.layers.find((l) => l.id === o.layerId)?.locked,
      );
    if (d.mode === "pan") {
      const el = e.currentTarget.parentElement!;
      el.scrollLeft = d.scroll!.x - (e.clientX - d.client!.x);
      el.scrollTop = d.scroll!.y - (e.clientY - d.client!.y);
      return;
    }
    if (d.mode === "marquee") {
      setRubber({
        x: Math.min(p.x, d.start.x),
        y: Math.min(p.y, d.start.y),
        w: Math.abs(p.x - d.start.x),
        h: Math.abs(p.y - d.start.y),
      });
      return;
    }
    if (!objects.length) return;
    if (d.mode === "column") {
      const raw = objects[0],
        o = resolveObject(project, raw),
        columns = structuredClone(o.columns || []),
        ci = d.column!;
      if (columns[ci] && columns[ci + 1]) {
        const sum = columns.reduce((a, c) => a + c.weight, 0),
          combined = columns[ci].weight + columns[ci + 1].weight,
          usable =
            o.w -
            (o.tableStyle?.columnGap || 0) * (columns.length - 1) -
            (o.tableStyle?.variant === "cards"
              ? o.tableStyle.groupLabelWidth + 9
              : 0),
          delta = ((p.x - d.start.x) / Math.max(1, usable)) * sum,
          next = Math.max(
            5,
            Math.min(combined - 5, columns[ci].weight + delta),
          );
        columns[ci + 1].weight = combined - next;
        columns[ci].weight = next;
        raw.columns = columns;
        if (raw.templateRef)
          raw.localOverrides = { ...raw.localOverrides, columns };
      }
    }
    if (d.mode === "move") {
      const b = bounds(objects),
        dx = snap(b.x + p.x - d.start.x, "x", q) - b.x,
        dy = snap(b.y + p.y - d.start.y, "y", q) - b.y;
      for (const o of objects)
        Object.assign(o, constrain({ ...o, x: o.x + dx, y: o.y + dy }));
    }
    if (d.mode === "resize") {
      const b = bounds(objects),
        sx = Math.max(0.05, (snap(p.x, "x") - b.x) / b.w),
        sy = Math.max(0.05, (snap(p.y, "y") - b.y) / b.h);
      for (const o of objects)
        Object.assign(
          o,
          constrain({
            ...o,
            x: b.x + (o.x - b.x) * sx,
            y: b.y + (o.y - b.y) * sy,
            w: o.w * sx,
            h: o.h * sy,
          }),
        );
    }
    if (d.mode === "rotate") {
      if (
        objects.some((o) =>
          ["table", "index", "posters", "timetable"].includes(o.kind),
        )
      )
        return;
      const b = bounds(objects),
        cx = b.x + b.w / 2,
        cy = b.y + b.h / 2,
        angle =
          ((Math.atan2(p.y - cy, p.x - cx) -
            Math.atan2(d.start.y - cy, d.start.x - cx)) *
            180) /
          Math.PI;
      const rotated = rotateObjects(
        objects,
        e.shiftKey ? Math.round(angle / 15) * 15 : angle,
      );
      q.objects = q.objects.map((o) => rotated.find((a) => a.id === o.id) || o);
    }
    if (d.mode === "create") {
      const o = objects[0],
        end = { x: snap(p.x, "x"), y: snap(p.y, "y") };
      Object.assign(o, fromPoints([d.start, end]));
      if (o.kind === "line") {
        o.kind = "path";
        o.fill = "none";
        o.name = "直線";
      }
      Object.assign(o, constrain(o));
    }
    if (d.mode === "anchor") {
      const o = objects[0],
        a = o.anchors![d.anchor!],
        angle = (-o.rotation * Math.PI) / 180,
        dx = p.x - o.x - o.w / 2,
        dy = p.y - o.y - o.h / 2,
        pos = {
          x: (dx * Math.cos(angle) - dy * Math.sin(angle) + o.w / 2) / o.w,
          y: (dx * Math.sin(angle) + dy * Math.cos(angle) + o.h / 2) / o.h,
        };
      if (d.handle) a[d.handle] = pos;
      else {
        const dx = pos.x - a.x,
          dy = pos.y - a.y;
        if (a.in) {
          a.in.x += dx;
          a.in.y += dy;
        }
        if (a.out) {
          a.out.x += dx;
          a.out.y += dy;
        }
        a.x = pos.x;
        a.y = pos.y;
      }
    }
    setTemp(q);
  }
  function up() {
    if (penDrag.current) {
      penDrag.current = null;
      return;
    }
    const d = drag.current;
    if (!d) return;
    if (d.mode === "marquee" && rubber) {
      const ids = t.objects
        .filter(
          (o) =>
            o.visible !== false &&
            t.layers.find((l) => l.id === o.layerId)?.visible &&
            !o.locked &&
            !t.layers.find((l) => l.id === o.layerId)?.locked &&
            o.x >= rubber.x &&
            o.y >= rubber.y &&
            o.x + o.w <= rubber.x + rubber.w &&
            o.y + o.h <= rubber.y + rubber.h,
        )
        .map((o) => o.id);
      setSelection([...new Set([...d.ids, ...ids])]);
    } else if (temp && d.mode !== "pan") commit(temp);
    setRubber(null);
    drag.current = null;
  }
  async function image(file?: File) {
    if (!file || !first) return;
    try {
      setMessage("素材を登録中…");
      const { asset, warning } = await importAsset(file);
      props.onAssets([asset]);
      modify({ assetId: asset.id, binding: "none" });
      setMessage(warning || "画像を登録しました");
    } catch (e) {
      setMessage(String(e));
    }
  }
  function exportTemplate() {
    // A library export is self-contained: bake linked component appearances into
    // editable objects, preserving their bindings and placement.
    const portable = (source: DesignTemplate) => ({
      ...structuredClone(source),
      objects: source.objects.map((o) => {
        const resolved = structuredClone(resolveObject(project, o));
        delete resolved.templateRef;
        delete resolved.localOverrides;
        return resolved;
      }),
    });
    const exported = portable(t),
      masterExport = project.templates.find((m) => m.id === t.masterId);
    const assetIds = new Set(
        [
          ...exported.objects,
          ...(masterExport ? portable(masterExport).objects : []),
        ].flatMap((o) => (o.assetId ? [o.assetId] : [])),
      ),
      assets = Object.fromEntries(
        Object.entries(project.assets).filter(([id]) => assetIds.has(id)),
      );
    download(
      new Blob(
        [
          JSON.stringify(
            {
              format: "pamph-template",
              schemaVersion: 1,
              template: exported,
              master: masterExport ? portable(masterExport) : undefined,
              assets,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      `${t.name}.pamptpl`,
    );
    setMessage("素材を含むテンプレートを書き出しました");
  }
  async function importTemplate(file?: File) {
    if (!file) return;
    try {
      if (file.size > 80 * 1024 * 1024)
        throw new Error("テンプレートは80MB以下にしてください。");
      const data = JSON.parse(await file.text());
      if (data.format !== "pamph-template" || data.schemaVersion !== 1)
        throw new Error("対応していないテンプレート形式です。");
      const n = structuredClone(validateDesign(data.template)),
        assets: Asset[] = [],
        map = new Map<string, string>();
      for (const [id, a] of Object.entries(data.assets || {}) as [
        string,
        Asset,
      ][]) {
        if (
          !a ||
          ![
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/svg+xml",
            "application/pdf",
          ].includes(a.mime) ||
          !a.data.startsWith(`data:${a.mime};base64,`)
        )
          throw new Error("素材の形式が不正です。");
        const result = await importAsset(
          new File([dataBytes(a.data)], a.name, { type: a.mime }),
        );
        map.set(id, result.asset.id);
        assets.push(result.asset);
      }
      const master = data.master
        ? structuredClone(validateDesign(data.master))
        : undefined;
      if (n.masterId && !master)
        throw new Error("共通マスターが含まれていません。");
      if (
        master &&
        (master.masterId ||
          master.objects.some((o) =>
            ["table", "posters", "timetable"].includes(o.kind),
          ))
      )
        throw new Error("共通マスター形式が不正です。");
      [...n.objects, ...(master?.objects || [])].forEach((o) => {
        if (o.assetId) {
          if (!map.has(o.assetId)) throw new Error("必要な素材がありません。");
          o.assetId = map.get(o.assetId);
        }
      });
      n.id = uid();
      n.name += "（読み込み）";
      n.updatedAt = new Date().toISOString();
      props.onAssets(assets);
      if (master) {
        master.id = uid();
        n.masterId = master.id;
        props.onCreate(master);
      }
      props.onCreate(n);
      setId(n.id);
      setSelection([]);
      setMessage("テンプレートと素材を読み込みました");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }
  const numeric = (
    label: string,
    key: keyof DesignObject,
    min = 0,
    max = 210,
    step = 0.5,
  ) => (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        step={step}
        min={min}
        max={max}
        value={(first?.[key] as number) ?? (key === "lineHeight" ? 1.5 : 0)}
        onChange={(e) =>
          modify({ [key]: Math.max(min, Math.min(max, +e.target.value)) })
        }
      />
    </label>
  );
  const color = (
    label: string,
    key: "fill" | "stroke" | "alternate" | "headerFill" | "headerColor",
  ) => (
    <label>
      {label}
      <div className="designer-color">
        <input
          aria-label={label}
          type="color"
          value={first?.[key] === "none" ? "#ffffff" : first?.[key]}
          onChange={(e) => modify({ [key]: e.target.value })}
        />
        <input
          aria-label={`${label}カラーコード`}
          className="color-code"
          key={`${first?.id}-${first?.[key]}`}
          defaultValue={first?.[key]}
          onBlur={(e) => {
            if (
              /^#[a-f0-9]{6}$/i.test(e.target.value) ||
              e.target.value === "none"
            )
              modify({ [key]: e.target.value });
            else setMessage("色は #RRGGBB または none で指定してください。");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <button
          aria-label={`${label}を透明にする`}
          onClick={() => modify({ [key]: "none" })}
        >
          なし
        </button>
      </div>
    </label>
  );
  if (!t)
    return (
      <div className="designer-empty">
        <h2>デザイナーモード</h2>
        <button onClick={() => newTemplate("notice")}>
          最初のテンプレートを作成
        </button>
        <button onClick={props.onClose}>制作モードへ戻る</button>
      </div>
    );
  return (
    <EditorShell
      onKeyDown={key}
      onKeyUp={(e) => {
        if (e.code === "Space") space.current = false;
      }}
      onBlur={(e) => {
        if (
          !e.currentTarget.contains(e.relatedTarget as globalThis.Node | null)
        )
          space.current = false;
      }}
      onPointerDown={(e) => {
        if (!(e.target as Element).closest(".editor-context")) setContext(null);
      }}
    >
      <MenuBar
        shared={props.shared}
        menus={menus}
        onPalette={() => setPaletteOpen(true)}
        onSave={props.onProjectSave}
        onClose={props.onClose}
        undo={() => undo()}
        redo={() => undo(false)}
      />
      {paletteOpen && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="冊子のカラーパレット"
          >
            <button
              className="modal-close"
              aria-label="閉じる"
              onClick={() => setPaletteOpen(false)}
            >
              ×
            </button>
            <h2>冊子のカラーパレット</h2>
            <PaletteControl
              project={project}
              measure={measure}
              update={props.onProjectEdit}
              edit
            />
          </section>
        </div>
      )}
      <input
        hidden
        type="file"
        ref={fileRef}
        accept=".pamptpl,.json"
        onChange={(e) => {
          void importTemplate(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        hidden
        type="file"
        ref={imageRef}
        accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
        onChange={(e) => {
          void (first?.kind === "image" && selection.length === 1
            ? image(e.target.files?.[0])
            : placeImage(e.target.files?.[0]));
          e.target.value = "";
        }}
      />
      <div
        className="designer-workspace"
        data-shared={!!props.shared}
        data-library-hidden={hideLibrary}
        data-properties-hidden={hideProperties}
      >
        <ToolBar
          tool={tool}
          onTool={setTool}
          showDrawing={
            !props.shared ||
            (!t.objects.some(
              (o) =>
                o.repeatRole ||
                ["table", "index", "posters", "timetable"].includes(o.kind),
            ) &&
              t.scope !== "component") ||
            drawingOpen
          }
          onToggleDrawing={
            props.shared &&
            (t.scope === "component" ||
              t.objects.some(
                (o) =>
                  o.repeatRole ||
                  ["table", "index", "posters", "timetable"].includes(o.kind),
              ))
              ? () => {
                  if (drawingOpen) setTool("select");
                  setDrawingOpen(!drawingOpen);
                }
              : undefined
          }
        />
        <aside className="designer-library">
          <div
            className="editor-panel-tabs"
            role="tablist"
            aria-label="左パネル"
          >
            {(props.shared
              ? (["layers", "templates"] as const)
              : (["layers", "pages", "templates"] as const)
            ).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={panel === k}
                onClick={() => setPanel(k)}
              >
                {
                  {
                    layers: "レイヤー",
                    pages: "ページ",
                    templates: "テンプレート",
                  }[k]
                }
              </button>
            ))}
          </div>
          <div className="editor-panel-body" role="tabpanel">
            {panel === "layers" && (
              <LayerPanel {...{ t, selection, setSelection, edit }} />
            )}
            {panel === "templates" && (
              <TemplatePanel
                {...{ project, measure }}
                id={t.id}
                onNew={props.onNewShared ?? (() => setDialog("new"))}
                onSelect={selectTemplate}
              />
            )}
            {panel === "pages" && (
              <PagePanel
                {...{ project, measure }}
                current={props.currentBlockId}
                onEdit={props.onProjectEdit}
                onSelect={props.onSelectBlock}
              />
            )}
          </div>
        </aside>
        <main className="designer-canvas-column">
          <div className="editor-breadcrumb">
            {props.shared
              ? `共通テンプレート › ${t.name} › ${first?.name ?? "用紙"} · `
              : `パンフレット › ${props.contextPage?.title || "制作ページ"} › `}
            {t.scope === "component" ? "部品" : "デザイン"}
            {editingComponentId
              ? ` › ${first?.kind === "index" ? "インデックス" : "表"} › ${tableTarget?.kind === "cell" ? "セル" : tableTarget?.kind === "header" ? "見出し" : "全体"}`
              : ""}
          </div>
          <div className="designer-canvas-bar">
            <button
              aria-pressed={!hideLibrary}
              onClick={() => setHideLibrary((v) => !v)}
            >
              {props.shared ? "レイヤー・テンプレート" : "ライブラリ"}
            </button>
            <button
              aria-pressed={!hideProperties}
              onClick={() => setHideProperties((v) => !v)}
            >
              プロパティ
            </button>
            <button
              aria-pressed={showQuick}
              onClick={() => setShowQuick((v) => !v)}
            >
              クイック操作
            </button>
            <input
              aria-label="テンプレート名"
              value={t.name}
              onChange={(e) =>
                edit((q) => {
                  q.name = e.target.value;
                })
              }
            />
            <span>
              {t.scope === "component"
                ? "部品のみ"
                : t.scope === "master"
                  ? "共通マスター"
                  : t.scope === "style"
                    ? "スタイル"
                    : "ページ全体"}{" "}
              · v{t.version}
            </span>
            {props.shared ? (
              <label className="scenario-control">
                確認用データ{" "}
                <select
                  value={scenario}
                  onChange={(e) => {
                    setScenario(e.target.value);
                    setPageIndex(0);
                  }}
                >
                  <option value="normal">通常</option>
                  <option value="few">少量</option>
                  <option value="many">大量</option>
                  <option value="long">長文</option>
                  <option value="noImages">画像未登録</option>
                </select>
              </label>
            ) : (
              <select
                aria-label="プレビューデータ"
                value={sampleCount}
                onChange={(e) => {
                  setSampleCount(+e.target.value);
                  setPageIndex(0);
                  setMessage(
                    props.shared
                      ? "架空データで確認中。冊子の登録情報は変更しません。"
                      : +e.target.value < 0
                        ? "実際の企画データを表示中"
                        : "サンプル表示中です。登録情報は変更されません。PDF出力は実際の企画を使用します。",
                  );
                }}
              >
                <option value={-1}>
                  {props.shared ? "標準サンプル" : "実際の企画"}
                </option>
                {[0, 5, 11, 30].map((n) => (
                  <option key={n} value={n}>
                    サンプル {n}件
                  </option>
                ))}
              </select>
            )}
            <button onClick={() => setZoom((z) => Math.max(0.1, z / 1.2))}>
              −
            </button>
            <input
              className="zoom-input"
              aria-label="表示倍率（%）"
              type="number"
              min="10"
              max="1600"
              step="10"
              value={Math.round(zoom * 100)}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value >= 10 && value <= 1600) setZoom(value / 100);
              }}
            />
            %
            <button onClick={() => setZoom((z) => Math.min(16, z * 1.2))}>
              ＋
            </button>
            <button
              title="アートボード全体を表示"
              onClick={() => {
                const el = svg.current?.parentElement;
                if (el)
                  setZoom(
                    Math.min(
                      (el.clientWidth - 85) / 440,
                      (el.clientHeight - 100) / ((440 * 210) / 148),
                    ),
                  );
              }}
            >
              全体
            </button>
            <button
              onClick={() => {
                const el = svg.current?.parentElement;
                if (el)
                  setZoom(
                    Math.min(
                      16,
                      Math.max(
                        0.1,
                        (el.clientWidth - 32) / ((440 * 196) / 148),
                      ),
                    ),
                  );
              }}
            >
              幅に合わせる
            </button>
            <select
              aria-label="データ確認ページ"
              value={Math.min(pageIndex, rendered.length - 1)}
              onChange={(e) => setPageIndex(+e.target.value)}
            >
              {rendered.map((_, i) => (
                <option key={i} value={i}>
                  {i + 1} / {rendered.length}ページ
                </option>
              ))}
            </select>
          </div>
          {props.shared &&
            (first?.repeatRole ||
              (first &&
                ["table", "posters", "timetable"].includes(first.kind))) && (
              <p className="repeat-notice">
                {first?.kind === "table"
                  ? "繰り返し：列の設定をすべての企画行に反映します。"
                  : first?.repeatRole
                    ? "繰り返し：この見た目が同じ種類のすべての項目に使われます。"
                    : "繰り返し：登録件数に合わせて自動で並べます。"}
              </p>
            )}
          {props.shared && drawingOpen && t.scope === "component" && (
            <div className="editor-breadcrumb">
              部品に図形を重ねる場合は、同じ配置のページデザインを作ります。
              <button
                onClick={() => {
                  const n = structuredClone(t);
                  n.id = uid();
                  n.name += "（作図付きページ）";
                  n.version = 1;
                  n.createdAt = n.updatedAt = new Date().toISOString();
                  n.scope = "page";
                  delete n.componentKind;
                  delete n.sharedSource;
                  delete n.thumbnail;
                  props.onCreate(n);
                  selectTemplate(n.id);
                  setSelection(n.objects.map((o) => o.id));
                  setDrawingOpen(true);
                  setMessage(
                    "同じ配置をページデザインへコピーしました。元の部品は変更していません。",
                  );
                }}
              >
                この配置で作図する
              </button>
            </div>
          )}
          {isolatedGroup && (
            <div className="editor-breadcrumb">
              グループ内を編集中{" "}
              <button onClick={() => setIsolatedGroup(null)}>全体に戻る</button>
            </div>
          )}
          {showQuick && first && (
            <div
              ref={quickRef}
              className="editor-quick"
              role="toolbar"
              aria-label="選択対象のクイック操作"
            >
              <span>{first.name}</span>
              {first.kind === "text" &&
                first.binding === "none" &&
                !first.repeatRole && (
                  <button
                    onClick={() =>
                      setTextEditing({ id: first.id, value: first.text })
                    }
                  >
                    文字を編集
                  </button>
                )}
              {first.kind === "image" &&
                first.binding === "none" &&
                !first.repeatRole && (
                  <button onClick={() => imageRef.current?.click()}>
                    画像を追加・差し替え
                  </button>
                )}
              {tool === "anchor" &&
                first.kind === "path" &&
                anchorIndex !== null && (
                  <>
                    <span>点 {anchorIndex + 1}</span>
                    <button
                      onClick={() =>
                        modify({
                          anchors: first.anchors?.map((a, i) =>
                            i === anchorIndex ? { x: a.x, y: a.y } : a,
                          ),
                        })
                      }
                    >
                      角点にする
                    </button>
                    <button
                      onClick={() =>
                        modify({
                          anchors: first.anchors?.map((a, i) =>
                            i === anchorIndex
                              ? {
                                  ...a,
                                  in: { x: a.x - 0.1, y: a.y },
                                  out: { x: a.x + 0.1, y: a.y },
                                }
                              : a,
                          ),
                        })
                      }
                    >
                      曲線点にする
                    </button>
                    <button
                      onClick={() => {
                        const anchors = structuredClone(first.anchors ?? []),
                          next = anchors[anchorIndex + 1];
                        if (!next) {
                          setMessage("次の点がある位置を選んでください。");
                          return;
                        }
                        const a = anchors[anchorIndex];
                        if (a.out || next.in) {
                          setMessage(
                            "曲線の途中への点追加は未対応です。直線区間を選んでください。",
                          );
                          return;
                        }
                        anchors.splice(anchorIndex + 1, 0, {
                          x: (a.x + next.x) / 2,
                          y: (a.y + next.y) / 2,
                        });
                        modify({ anchors });
                      }}
                    >
                      間に点を追加
                    </button>
                  </>
                )}
              <button onClick={() => duplicate()}>複製</button>
              <button
                onClick={() => {
                  setHideProperties(false);
                }}
              >
                設定
              </button>
              <select
                aria-label="整列の基準"
                value={alignBoard ? "board" : "selection"}
                onChange={(e) => setAlignBoard(e.target.value === "board")}
              >
                <option value="selection">選択範囲を基準</option>
                <option value="board">用紙を基準</option>
              </select>
              <button onClick={() => align("x", "center")}>中央揃え</button>
              <button onClick={() => order(true)}>最前面</button>
            </div>
          )}
          <Canvas
            isolatedGroup={isolatedGroup}
            onIsolateGroup={setIsolatedGroup}
            editingComponentId={editingComponentId}
            tableTarget={tableTarget}
            onTableTarget={setTableTarget}
            onEnterComponent={(id) => {
              setEditingComponentId(id);
              setTableTarget({ kind: "table" });
              setSelection([id]);
            }}
            backdrop={
              t.scope === "component" ? props.contextPage?.nodes : undefined
            }
            space={space}
            {...{
              svg,
              tool,
              zoom,
              down,
              move,
              up,
              setContext,
              setSelection,
              setZoom,
              finishPen: () => finishPen(),
              t,
              setPanel,
              setTextEditing,
              setMessage,
              scene,
              project,
              showGrid,
              showGuides,
              showRulers,
              selection,
              selectedBox,
              first,
              pen,
              rubber,
              textEditing,
              saveText,
            }}
            onCancel={() => {
              drag.current = null;
              setTemp(null);
              setRubber(null);
            }}
          />
        </main>
        <PropertiesPanel
          simple={props.shared}
          tableTarget={editingComponentId === first?.id ? tableTarget : null}
          onTableTarget={setTableTarget}
          onEnterTable={() => {
            if (first) {
              setEditingComponentId(first.id);
              setTableTarget({ kind: "table" });
            }
          }}
          {...{
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
          }}
          onChapterColor={(id, color) =>
            props.onProjectEdit((p) => {
              p.chapters.find((c) => c.id === id)!.color = color;
            })
          }
        />
      </div>
      <StatusBar
        shared={props.shared}
        tool={editorTools.find((a) => a.id === tool)!.name}
        count={chosen.length}
        zoom={zoom}
        message={message}
        saveState={props.saveState}
      />
      {dialog && (
        <EditorDialog
          shared={props.shared}
          mode={dialog}
          onClose={() => setDialog(null)}
          onCreate={createPreset}
          onCapture={capture}
          onEdit={() => {
            setDialog(null);
            setPanel("templates");
          }}
        />
      )}
      {context && (
        <div
          className="editor-context"
          role="menu"
          style={{
            left: Math.min(context.x, window.innerWidth - 230),
            top: Math.min(context.y, window.innerHeight - 260),
          }}
        >
          {contextItems.map((a) => (
            <button
              role="menuitem"
              disabled={a.disabled}
              key={a.label}
              onClick={() => {
                setContext(null);
                a.run();
              }}
            >
              {a.label}
            </button>
          ))}
          <button role="menuitem" onClick={() => setContext(null)}>
            閉じる
          </button>
        </div>
      )}
    </EditorShell>
  );
}
