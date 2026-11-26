import { PdfProgress, type PdfProgressState } from "./workspace/PdfProgress";
import {
  outputPages,
  automaticBlankCounts,
  sourcePage,
} from "./workspace/workflow";
import { ExcelImport } from "./workspace/ExcelImport";
import { MediaIntake } from "./workspace/MediaIntake";
import {
  applyPageVariant,
  applyThemeVariant,
} from "./workspace/design-selection";
import { StartRoutes } from "./StartRoutes";
import { RuleMarkControl } from "./workspace/RuleMarkControl";
import { LibraryPageDialog } from "./workspace/LibraryPageDialog";
import { installRelease } from "../../../packages/designer/library";
import {
  ComponentChoices,
  type ComponentCategory,
} from "./workspace/ComponentChoices";
import { findComponent } from "../../../packages/designer/components";
import { pdfCompletion } from "../../../packages/core/pdf-completion";
import { createFestivalSample } from "../../../packages/core/festival-sample";
import { PageChoices, templateLabel } from "./workspace/TemplateChoices";
import { CommitField } from "./workspace/CommitField";
import {
  backCoverLayouts,
  universityWebsite,
} from "../../../packages/templates/back-cover";
import { PaletteControl } from "./workspace/PaletteControl";
import { createFestivalProject } from "../../../packages/core/festival-opening";
import {
  ProductionEditor,
  type InputTarget,
} from "./workspace/ProductionEditor";
import { ProjectHome } from "./ProjectHome";
import { isStage, setAdCompany } from "../../../packages/core/registration";
import { KitchenMenus } from "./workspace/KitchenMenus";
import { DataWorkspace } from "./workspace/DataWorkspace";
import {
  record,
  writeSource,
  type DataSource,
} from "../../../packages/core/editing";
import {
  applyComponent,
  blockDesign,
  detachTemplate,
} from "../../../packages/designer/components";
import { seedLibrary } from "../../../packages/designer/presets";
import { ComponentApplyDialog } from "./editor/ComponentApplyDialog";
import { renderTemplate } from "../../../packages/designer/render";
import { loadFontBytes } from "../../../packages/pdf-export/font-files";
import {
  createDesign,
  object,
  type DesignTemplate,
} from "../../../packages/designer/model";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FilePlus,
  FolderOpen,
  GripVertical,
  Home,
  ImagePlus,
  Layers,
  LayoutGrid,
  Plus,
  Redo2,
  Save,
  Settings2,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import {
  createProject,
  insertBlock,
  nextYear,
  uid,
  templateNames,
  palettes,
  type Project,
  type Template,
  type Event,
  type AdSize,
} from "../../../packages/core/model";
import {
  layoutProject,
  fallbackMeasure,
  type Measure,
} from "../../../packages/layout-engine";

import {
  type UnreadableProject,
  webStorage,
  download,
} from "../../../packages/project-storage";
import { importAsset } from "./assets";
import { Preview } from "./Preview";
const productionSteps = [
  "デザインを選ぶ",
  "情報を入力",
  "Excelを読み込む",
  "誌面を確認・編集",
  "最終確認・PDF出力",
];
type Tab = "page" | "events" | "ads" | "theme";
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="field">
    <span>{label}</span>
    {children}
  </label>
);
const SharedDesigner = lazy(() =>
  import("./SharedDesigner").then((m) => ({ default: m.SharedDesigner })),
);
const Designer = lazy(() =>
  import("./Designer").then((module) => ({ default: module.Designer })),
);

export function App() {
  const [listState, setListState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const listRequest = useRef(0);
  const [unreadableProjects, setUnreadableProjects] = useState<
    UnreadableProject[]
  >([]);
  const [fitMode, setFitMode] = useState<"page" | "width">("page");
  const [hidePages, setHidePages] = useState(true);
  const [hideInspector, setHideInspector] = useState(true);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<PdfProgressState | null>(null);
  const [pendingLibraryPage, setPendingLibraryPage] = useState<{
    template: DesignTemplate;
    release?: import("../../../packages/designer/library").LibraryRelease;
    blockId?: string;
    all: boolean;
  } | null>(null);
  const [homeRoute, setHomeRoute] = useState<"start" | "books">("start");
  const [sharedOpen, setSharedOpen] = useState(false);
  const [designPicker, setDesignPicker] = useState<{
    category: ComponentCategory;
    blockId?: string;
    objectId?: string;
  } | null>(null);
  const [pendingComponent, setPendingComponent] = useState<{
    template: DesignTemplate;
    release?: import("../../../packages/designer/library").LibraryRelease;
    all: boolean;
  } | null>(null);
  const [componentDestination, setComponentDestination] = useState<{
    blockId: string;
    objectId?: string;
  } | null>(null);
  const designSteps = [
    "冊子全体の配色",
    "インデックス",
    "見出し",
    "表",
    "タイムテーブル",
    "ページ番号",
    "箇条書き",
  ] as const;
  const [designStep, setDesignStep] = useState(0);
  const [step, setStep] = useState(0);
  const [designReady, setDesignReady] = useState(false);
  const intakePending = (p: Project) =>
    p.intake === "excel" || p.intake === "images";
  const [reviewed, setReviewed] = useState(false);
  const pdfRunning = useRef(false);
  const [inputTarget, setInputTarget] = useState<InputTarget | null>(null);
  const [sheetSource, setSheetSource] = useState<DataSource | undefined>();
  const [project, setProject] = useState<Project>(() => createProject(true)),
    [home, setHome] = useState(true),
    [designer, setDesigner] = useState(false),
    [dataMode, setDataMode] = useState(false),
    [componentApply, setComponentApply] = useState<string | null>(null),
    [recent, setRecent] = useState<Project[]>([]),
    [selected, setSelected] = useState(""),
    [tab, setTab] = useState<Tab>("page"),
    [previewMode, setPreviewMode] = useState<"auto" | "single" | "spread">(
      "auto",
    ),
    [zoom, setZoom] = useState(1),
    [advanced, setAdvanced] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(""),
    [saveState, setSaveState] = useState(""),
    [eventId, setEventId] = useState(""),
    [dragged, setDragged] = useState(""),
    [measure, setMeasure] = useState<Measure>(() => fallbackMeasure),
    [fontsReady, setFontsReady] = useState(false),
    [fitWidth, setFitWidth] = useState(650),
    [historyVersion, setHistoryVersion] = useState(0),
    [modal, setModal] = useState<null | "add" | "export" | "delete">(null);
  const sampleSession = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const undo = useRef<Project[]>([]),
    redo = useRef<Project[]>([]),
    openRef = useRef<HTMLInputElement>(null),
    activeProject = useRef(project);
  activeProject.current = project;
  const layout = useMemo(
      () => layoutProject(project, measure),
      [project, measure],
    ),
    page = layout.pages.find((p) => p.id === selected) || layout.pages[0],
    block = project.blocks.find((b) => b.id === page?.blockId),
    index = layout.pages.findIndex((p) => p.id === page?.id),
    event = project.events.find((e) => e.id === eventId) || project.events[0];
  const spreadStart = index <= 0 ? 0 : index % 2 === 1 ? index : index - 1;
  const spread =
    previewMode === "spread" ||
    (previewMode === "auto" &&
      layout.pages
        .slice(spreadStart, spreadStart + (index <= 0 ? 1 : 2))
        .some((p) => p.automatic));
  const blankCounts = automaticBlankCounts(layout.pages);
  const paddingCount = blankCounts.total;
  const [pageChange, setPageChange] = useState("");
  const previousPages = useRef<{ id: string; count: number } | undefined>(
    undefined,
  );
  const pageChangeReason = useRef("編集");
  useEffect(() => {
    const previous = previousPages.current;
    if (previous?.id === project.id && previous.count !== layout.pages.length) {
      const delta = layout.pages.length - previous.count;
      setPageChange(
        `${pageChangeReason.current}による掲載内容・改ページ・白紙調整の再計算で、出力ページ数が${previous.count}から${layout.pages.length}ページに変わりました（${delta > 0 ? "+" : ""}${delta}ページ）。${outputPages(layout.pages.length, paddingCount)}`,
      );
    } else if (previous?.id !== project.id) setPageChange("");
    previousPages.current = { id: project.id, count: layout.pages.length };
  }, [project.id, layout.pages.length, paddingCount]);
  const checks = layout.issues.filter((i) => i.level === "check");
  const pendingChecks = checks.filter(
    (i) => !project.manualChecks[i.checkId!],
  ).length;
  const infos = layout.issues.filter((i) => i.level === "info");
  const errors = layout.issues.filter((i) => i.level === "error"),
    warnings = layout.issues.filter((i) => i.level === "warning");
  const finalStatus = pdfCompletion(
    project.contentVersion ?? "initial",
    project.lastPdf?.contentVersion ?? null,
    !!errors.length,
    true,
  );
  async function refreshProjects() {
    const request = ++listRequest.current;
    setListState("loading");
    try {
      let unreadable: UnreadableProject[] = [];
      const items = await webStorage.recent((_, entries) => {
        unreadable = entries;
      });
      if (request !== listRequest.current) return;
      setRecent(items);
      setUnreadableProjects(unreadable);
      setListState(unreadable.length ? "error" : "ready");
    } catch {
      if (request === listRequest.current) setListState("error");
    }
  }
  useEffect(() => {
    void refreshProjects();
    Promise.all([
      loadFontBytes(),
      import("../../../packages/pdf-export/font-measure"),
    ])
      .then(async ([fonts, { fontMeasure }]) => {
        const faces = await Promise.all([
          new FontFace("Noto Sans CJK JP", fonts.medium, {
            weight: "500",
          }).load(),
          new FontFace("Noto Sans CJK JP", fonts.bold, {
            weight: "700",
          }).load(),
        ]);
        faces.forEach((face) => document.fonts.add(face));
        setMeasure(() => fontMeasure(fonts));
        setFontsReady(true);
      })
      .catch(() =>
        setNotice(
          "日本語フォントを読み込めません。再読み込みしてください。PDF出力は利用できません。",
        ),
      );
  }, []);
  useEffect(() => {
    if (home || sampleSession.current) return;
    setSaveState("保存中…");
    const timer = setTimeout(() => {
      webStorage
        .autosave(project)
        .then(() => setSaveState("ブラウザに自動保存済み"))
        .catch(() => setSaveState("自動保存失敗：ファイルへ保存してください"));
    }, 700);
    return () => clearTimeout(timer);
  }, [project, home]);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const resize = () =>
      setFitWidth(
        Math.max(
          170,
          Math.min(
            el.clientWidth - 16,
            fitMode === "width"
              ? Infinity
              : (((el.clientHeight - 16) * 148) / 210) * (spread ? 2 : 1),
          ),
        ),
      );
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    return () => observer.disconnect();
  }, [home, spread, designer, dataMode, step, fitMode]);
  useEffect(() => {
    if (!pdfSuccess) return;
    const timer = setTimeout(() => setPdfSuccess(false), 4500);
    return () => clearTimeout(timer);
  }, [pdfSuccess]);
  useEffect(() => {
    setPdfSuccess(false);
  }, [home, designer, dataMode, step, sharedOpen]);
  function update(
    fn: (p: Project) => void,
    affectsOutput = true,
    reason = "編集",
  ) {
    pageChangeReason.current = reason;
    // The mutation may reject invalid input (e.g. a non-numeric floor).
    // Only create an undo entry after it succeeds; never commit half an edit.
    const previous = activeProject.current;
    const q = structuredClone(previous);
    fn(q);
    if (affectsOutput) {
      setReviewed(false);
      q.contentVersion = uid();
    }
    undo.current.push(previous);
    if (undo.current.length > 40) undo.current.shift();
    redo.current = [];
    q.updatedAt = new Date().toISOString();
    activeProject.current = q;
    setProject(q);
    setHistoryVersion((n) => n + 1);
  }
  function history(back: boolean) {
    const from = back ? undo.current : redo.current,
      to = back ? redo.current : undo.current;
    const q = from.pop();
    if (!q) return;
    setReviewed(false);
    if (activeProject.current.lastPdf)
      q.lastPdf = activeProject.current.lastPdf;
    else delete q.lastPdf;
    to.push(activeProject.current);
    activeProject.current = q;
    setProject(q);
    if (step > 0 && intakePending(q)) {
      setDataMode(false);
      setStep(q.intake === "excel" ? 1 : 5);
    }
    setHistoryVersion((n) => n + 1);
  }
  function start(p: Project, setup = false, sample = false) {
    sampleSession.current = sample;
    setSaveState(sample ? "見本・編集用コピー" : "保存中…");
    setDesignStep(0);
    setStep(
      setup ? 0 : p.intake === "excel" ? 1 : p.intake === "images" ? 5 : 3,
    );
    setDesignReady(!setup);
    setReviewed(false);
    setPreviewMode("auto");
    setDataMode(false);
    setDesigner(false);
    setAdvanced(false);
    setProject(p);
    setInputTarget(null);
    setSheetSource(undefined);
    setHome(false);
    setSelected("");
    undo.current = [];
    redo.current = [];
    setHistoryVersion((n) => n + 1);
  }
  useEffect(() => {
    const source = inputTarget?.source;
    if (!source || dataMode) return;
    if (!record(project, source)) {
      setInputTarget(null);
      return;
    }
    const matches = (pg: (typeof layout.pages)[number]) =>
      pg.nodes.some(
        (n) => n.source?.type === source.type && n.source?.id === source.id,
      );
    if (!layout.pages.some((pg) => pg.id === selected && matches(pg))) {
      const found = layout.pages.find(matches);
      if (found) setSelected(found.id);
    }
  }, [layout, inputTarget, dataMode]);
  async function run(fn: () => Promise<void>) {
    setBusy("処理中…");
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }
  async function open(file?: File) {
    if (!file) return;
    await run(async () => {
      const { project: p, warnings } = await webStorage.load(file);
      const existing = (await webStorage.recent()).find(
        (item) => item.id === p.id,
      );
      if (existing) {
        p.id = uid();
        p.name += "（読み込みコピー）";
      }
      start(p);
      setNotice(warnings.join("\n") || "プロジェクトを読み込みました。");
    });
  }
  async function save() {
    await run(async () => {
      const current = activeProject.current;
      download(await webStorage.save(current), `${current.name}.pamph`);
      setNotice("素材を含めた.pamphファイルを書き出しました。");
    });
  }
  async function filesAsset(
    files: FileList | null,
    assign: (p: Project, id: string) => void,
  ) {
    if (!files?.length) return;
    const file = files[0];
    await run(async () => {
      const { asset, warning } = await importAsset(file);
      update((p) => {
        p.assets[asset.id] = asset;
        assign(p, asset.id);
      });
      if (warning) setNotice(warning);
    });
  }
  function changeEvent(key: keyof Event, value: string | number) {
    if (event)
      update((p) => {
        Object.assign(
          p.events.find((e) => e.id === event.id)!,
          { [key]: value },
        );
      });
  }
  function addBlock(
    t: Template,
    kind?: Project["blocks"][number]["openingKind"],
    name?: string,
  ) {
    const id = uid();
    update((p) => {
      insertBlock(p, {
        id,
        template: t,
        title: name ?? templateLabel(t),
        openingKind: kind,
        backLayout: t === "back" ? "map-left" : undefined,
        chapterId:
          p.chapters.find((ch) => ch.name === "企画")?.id ||
          p.chapters[0]?.id ||
          "",
        adSize: t === "ads" ? "half" : undefined,
      });
    });
    setSelected(`${id}/0`);
    setTab("page");
    setModal(null);
  }
  function move(from: string, to: string) {
    if (from === to) return;
    const order = layout.pages
      .filter((p) => p.template !== "blank")
      .map((p) => p.id);
    const i = order.indexOf(from),
      j = order.indexOf(to);
    if (i < 0 || j < 0) return;
    order.splice(i, 1);
    order.splice(j, 0, from);
    update((p) => {
      p.pageOrder = order;
    });
    setNotice(
      "ページを移動しました。左右の配置と目次のページ番号を再計算しました。",
    );
  }
  function pdf(source: Project = activeProject.current) {
    if (pdfRunning.current) return;
    pdfRunning.current = true;
    const isBook = source === activeProject.current;
    const outputVersion = source.contentVersion ?? "initial";
    const projectId = source.id;
    setNotice("");
    setPdfSuccess(false);
    setModal(null);
    setPdfProgress({
      completed: 0,
      total: source === activeProject.current ? layout.pages.length : 0,
      phase: "準備中",
      startedAt: Date.now(),
    });
    setBusy("PDF生成の準備中…（初回は30秒以上かかる場合があります）");
    let worker: Worker | undefined;
    function finish(message?: string) {
      worker?.terminate();
      pdfRunning.current = false;
      setPdfProgress(null);
      setBusy("");
      if (message)
        setNotice(
          message + " 素材を確認して、もう一度PDF出力を試してください。",
        );
    }
    try {
      worker = new Worker(
        new URL("../../../packages/pdf-export/worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = async (e) => {
        if (e.data.status) {
          setPdfProgress((previous) =>
            previous ? { ...previous, ...e.data.status } : previous,
          );
          return;
        }
        if (typeof e.data.phase === "string") {
          setBusy(e.data.phase);
          return;
        }
        if (typeof e.data.progress === "number") {
          setBusy(
            e.data.progress >= 95
              ? `PDFファイルを仕上げています… ${e.data.progress}%`
              : `PDFのページを処理中… ${e.data.progress}%`,
          );
          return;
        }
        if (e.data.error) {
          finish(e.data.error);
          return;
        }
        try {
          download(
            new Blob([e.data.bytes], { type: "application/pdf" }),
            source.name + "-校正用RGB.pdf",
          );
          if (isBook && activeProject.current.id === projectId) {
            const current = activeProject.current;
            const q = {
              ...current,
              lastPdf: {
                at: new Date().toISOString(),
                pages: e.data.pageCount as number,
                contentVersion: outputVersion,
              },
            };
            activeProject.current = q;
            setProject(q);
            if (!sampleSession.current) {
              try {
                await webStorage.autosave(q);
              } catch {
                setNotice(
                  "PDFは生成しましたが、履歴の自動保存に失敗しました。プロジェクトをファイルに保存してください。",
                );
              }
            }
          }
          setPdfSuccess(true);
          finish();
        } catch (e) {
          finish(String(e));
        }
      };
      worker.onerror = () => finish("PDF生成に失敗しました。");
      worker.onmessageerror = () =>
        finish("PDF生成結果を受け取れませんでした。");
      worker.postMessage(source);
    } catch (e) {
      finish(String(e));
    }
  }
  function enableDesigner() {
    clearDesignPreview();
    setDesignPicker(null);
    if (sampleSession.current) setSharedOpen(true);
    else
      void run(async () => {
        await webStorage.autosave(activeProject.current);
        setSharedOpen(true);
      });
  }
  function applyDesign(id: string, newPage: boolean) {
    const t = activeProject.current.templates.find((t) => t.id === id);
    if (!t) return;
    if (t.scope === "component") {
      setComponentDestination(null);
      setComponentApply(id);
      return;
    }
    if (t.scope === "master") {
      if (!block?.templateId) {
        setNotice("共通マスターはカスタムページに設定してください。");
        return;
      }
      update((p) => {
        p.templates.find((a) => a.id === block.templateId)!.masterId = id;
      });
      setDesigner(false);
      return;
    }
    if (t.scope === "style") {
      setNotice(
        "スタイルはデザイナーモードでオブジェクトを選択して適用してください。",
      );
      return;
    }
    const newId = uid();
    update((p) => {
      if (newPage || !block) {
        insertBlock(p, {
          id: newId,
          template: t.kind,
          templateId: id,
          title: t.name,
          chapterId: block?.chapterId || p.chapters[0].id,
        });
      } else {
        const b = p.blocks.find((b) => b.id === block.id)!;
        b.templateId = id;
        b.template = t.kind;
        // Keep registered page content and its title when changing only the design.
      }
    });
    if (newPage || !block) setSelected(`${newId}/0`);
    setDesigner(false);
    setTab("page");
  }
  function captureDesign() {
    const source = project.templates.find(
      (t) => t.id === page.designTemplateId,
    );
    if (source) {
      const t = structuredClone(source);
      t.id = uid();
      t.name += " コピー";
      return t;
    }
    const t = createDesign(
      block?.template || "notice",
      `${page.title} 固定デザイン`,
    );
    t.objects = [];
    for (const n of page.nodes) {
      if (n.kind === "path") continue;
      if (
        n.kind === "rect" &&
        n.x === 0 &&
        n.y === 0 &&
        n.w === 148 &&
        n.h === 210
      ) {
        t.background = n.fill;
        continue;
      }
      const o = object(
        n.kind === "asset" ? "image" : n.kind,
        t.layers[0].id,
        n.x,
        n.y,
        Math.max(0.5, n.w),
        Math.max(0.5, n.h),
      );
      o.rotation = n.rotation || 0;
      o.opacity = n.opacity ?? 1;
      if (n.kind === "rect") {
        o.fill = n.fill;
        o.stroke = n.stroke || "none";
        o.radius = n.radius || 0;
      }
      if (n.kind === "text") {
        o.text = n.text;
        o.size = n.size;
        o.fill = n.color;
        o.stroke = "none";
        o.bold = !!n.bold;
      }
      if (n.kind === "asset") o.assetId = n.assetId;
      t.objects.push(o);
    }
    return t;
  }
  const projectInput = (
    <input
      ref={openRef}
      hidden
      type="file"
      accept=".pamph"
      onChange={(e) => {
        void open(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );
  const importButton = (
    label: string,
    assign: (p: Project, id: string) => void,
  ) => (
    <label className="upload small">
      <ImagePlus size={16} />
      {label}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
        hidden
        onChange={(e) => {
          void filesAsset(e.target.files, assign);
          e.target.value = "";
        }}
      />
    </label>
  );
  if (sharedOpen)
    return (
      <>
        <Suspense fallback={<p role="status">共通ライブラリを読み込み中…</p>}>
          <SharedDesigner
            measure={measure}
            onClose={() => setSharedOpen(false)}
            onHome={() => {
              setSharedOpen(false);
              setHome(true);
              setHomeRoute("start");
              void refreshProjects();
            }}
            onPDF={(source) => pdf(source)}
          />
        </Suspense>
        {busy && (
          <div className="busy" role="status">
            <PdfProgress state={pdfProgress} message={busy} />
          </div>
        )}
        {pdfSuccess && !notice && (
          <div className="toast" role="status">
            共通テンプレートのサンプルPDFを生成しました。
          </div>
        )}
        {notice && (
          <div className="toast" role="alert">
            {notice}
            <button onClick={() => setNotice("")}>閉じる</button>
          </div>
        )}
      </>
    );
  if (home)
    return (
      <div className="home">
        {projectInput}
        <header className="home-header">
          <div className="brand-icon">
            <BookOpen />
          </div>
          <strong>PAMPHLET STUDIO</strong>
          <span>稲友祭のパンフレット制作</span>
        </header>
        {homeRoute === "start" ? (
          <StartRoutes
            onTemplates={() => setSharedOpen(true)}
            onBook={() => {
              setHomeRoute("books");
              void refreshProjects();
            }}
          />
        ) : (
          <ProjectHome
            projects={recent}
            unreadable={unreadableProjects}
            onRemoveUnreadable={async (id) => {
              await webStorage.remove(id);
              await refreshProjects();
            }}
            measure={measure}
            listState={listState}
            onRetry={refreshProjects}
            onNew={(name) =>
              void run(async () => {
                const p = createFestivalProject();
                p.name = name;
                p.intake = "excel";
                p.university = "";
                p.festival = "";
                p.edition = 0;
                p.time = "";
                p.tagline = "";
                const jobs = [
                  [
                    "bunchan.jpg",
                    "ぶんちゃん.jpg",
                    "image/jpeg",
                    p.blocks.find((b) => b.openingKind === "survey")!,
                    "assetId",
                  ],
                  [
                    "campus-area.webp",
                    "大学付近マップ.webp",
                    "image/webp",
                    p.blocks.find((b) => b.template === "back")!,
                    "backMapId",
                  ],
                ] as const;
                const results = await Promise.allSettled(
                  jobs.map(async ([file, name, mime, block, field]) => {
                    const response = await fetch(
                      import.meta.env.BASE_URL + "defaults/" + file,
                    );
                    if (!response.ok) throw new Error(name);
                    const { asset } = await importAsset(
                      new File([await response.blob()], name, { type: mime }),
                    );
                    p.assets[asset.id] = asset;
                    block[field] = asset.id;
                  }),
                );
                start(p, true);
                if (results.some((r) => r.status === "rejected"))
                  setNotice(
                    "初期画像の一部を読み込めませんでした。ページ設定から登録できます。",
                  );
              })
            }
            onStart={start}
            onHome={() => setHomeRoute("start")}
            onSample={() =>
              void run(async () => {
                const p = createFestivalSample();
                await Promise.all(
                  Object.values(p.assets).map(async (a) => {
                    const img = new Image();
                    img.src = a.data;
                    await img.decode();
                    const canvas = document.createElement("canvas");
                    canvas.width = a.width;
                    canvas.height = a.height;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) throw new Error("見本の画像を作成できません。");
                    ctx.drawImage(img, 0, 0);
                    a.data = canvas.toDataURL("image/png");
                    a.mime = "image/png";
                  }),
                );
                start(p, false, true);
              })
            }
            onDelete={async (p) => {
              await webStorage.remove(p.id);
              setRecent((current) =>
                current.filter((item) => item.id !== p.id),
              );
              void refreshProjects();
            }}
            onBackup={async (p) =>
              download(await webStorage.save(p), p.name + ".pamph")
            }
            onNextYear={(p) => start(nextYear(p), true)}
            onFiles={(files) => {
              if (!files) return;
              const selectedFiles = Array.from(files).filter((f) =>
                f.name.toLowerCase().endsWith(".pamph"),
              );
              void run(async () => {
                if (!selectedFiles.length) {
                  setNotice(".pamphファイルが見つかりませんでした。");
                  return;
                }
                let loaded = 0;
                const existingIds = new Set(recent.map((p) => p.id));
                const failures: string[] = [];
                for (const file of selectedFiles) {
                  try {
                    const { project: p, warnings } =
                      await webStorage.load(file);
                    const existing = existingIds.has(p.id);
                    if (existing) {
                      p.id = uid();
                      p.name += "（読み込みコピー）";
                    }
                    await webStorage.autosave(p);
                    existingIds.add(p.id);
                    loaded++;
                    failures.push(...warnings.map((w) => file.name + "：" + w));
                  } catch (e) {
                    failures.push(file.name + "：" + String(e));
                  }
                }
                await refreshProjects();
                setNotice(
                  [
                    loaded + "件のプロジェクトを一覧に追加しました。",
                    ...failures,
                  ].join("\n"),
                );
              });
            }}
          />
        )}
        {notice && (
          <div className="toast" role="status">
            {notice}
            <button onClick={() => setNotice("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {busy && (
          <div className="busy">
            <PdfProgress state={pdfProgress} message={busy} />
          </div>
        )}
      </div>
    );
  let visible = spread
    ? index === 0
      ? [null, layout.pages[0]]
      : [layout.pages[spreadStart], layout.pages[spreadStart + 1] || null]
    : [page];
  if (spread && project.theme.binding === "right")
    visible = [...visible].reverse();
  function clearDesignPreview() {
    setPendingLibraryPage(null);
    setComponentApply(null);
    setPendingComponent(null);
    setComponentDestination(null);
  }
  function chooseVisualComponent(
    t: DesignTemplate,
    preferred?: string,
    objectId?: string,
    applyEverywhere = false,
    release?: import("../../../packages/designer/library").LibraryRelease,
  ) {
    clearDesignPreview();
    if (t.scope !== "component") {
      setPendingLibraryPage({
        template: t,
        release,
        blockId: preferred ?? block?.id,
        all: applyEverywhere,
      });
      return;
    }
    if (release) {
      try {
        installRelease(
          {
            ...project,
            templates: [...project.templates],
            assets: { ...project.assets },
          },
          release,
        );
      } catch (e) {
        setNotice(String(e));
        return;
      }
    }
    const target = project.blocks.find((b) => b.id === preferred) ?? block;
    const binding =
      t.objects[0]?.kind === "text" || t.objects[0]?.binding === "advertisement"
        ? t.objects[0].binding
        : undefined;
    const supports = (b: Project["blocks"][number]) =>
      !!findComponent(project, b, t.componentKind!, undefined, binding);
    const destination =
      target && supports(target)
        ? target
        : preferred
          ? target
          : (project.blocks.find(supports) ?? target);
    const first = project.blocks.find(supports);
    const finalDestination = applyEverywhere ? first : destination;
    if (!finalDestination) {
      setNotice("対応する部品がありません。");
      return;
    }
    setPendingComponent({ template: t, release, all: applyEverywhere });
    setComponentDestination({
      blockId: finalDestination.id,
      objectId: finalDestination === target ? objectId : undefined,
    });
    setComponentApply(t.id);
  }
  const libraryPageDialog = (inline = false) =>
    pendingLibraryPage && (
      <LibraryPageDialog
        project={project}
        measure={measure}
        key={pendingLibraryPage.template.id}
        inline={inline}
        {...pendingLibraryPage}
        apply={(blockId, all) => {
          update((p) => {
            const { template, release } = pendingLibraryPage;
            if (release) installRelease(p, release);
            else if (!p.templates.some((t) => t.id === template.id))
              p.templates.push(template);
            for (const b of p.blocks)
              if (
                b.id === blockId ||
                (all &&
                  (template.scope === "master"
                    ? !!b.templateId
                    : b.template === template.kind))
              ) {
                if (template.scope === "master") {
                  const page = p.templates.find((t) => t.id === b.templateId);
                  if (page) page.masterId = template.id;
                } else b.templateId = template.id;
              }
          });
          setPendingLibraryPage(null);
          if (!inline) setDesignPicker(null);
        }}
        close={() => setPendingLibraryPage(null)}
      />
    );
  const partDialog = (inline = false) => {
    const t =
      pendingComponent?.template ??
      project.templates.find((t) => t.id === componentApply);
    let dialogProject = project;
    if (pendingComponent) {
      dialogProject = {
        ...project,
        templates: [...project.templates],
        assets: { ...project.assets },
      };
      if (pendingComponent.release)
        installRelease(dialogProject, pendingComponent.release);
      else if (
        !dialogProject.templates.some(
          (other) => other.id === pendingComponent.template.id,
        )
      )
        dialogProject.templates.push(pendingComponent.template);
    }
    const destination =
      project.blocks.find((b) => b.id === componentDestination?.blockId) ??
      block;
    return (
      t &&
      destination && (
        <ComponentApplyDialog
          key={t.id}
          inline={inline}
          project={dialogProject}
          block={destination}
          initialAll={pendingComponent?.all}
          template={t}
          measure={measure}
          initialTarget={componentDestination?.objectId}
          onClose={() => {
            setComponentApply(null);
            setPendingComponent(null);
            setComponentDestination(null);
          }}
          onApply={(options) => {
            try {
              update((p) => {
                if (pendingComponent?.release)
                  installRelease(p, pendingComponent.release);
                else if (
                  pendingComponent &&
                  !p.templates.some((other) => other.id === t.id)
                )
                  p.templates.push(t);
                if (options.master) {
                  const d = p.templates.find(
                    (t) => t.id === destination.templateId,
                  );
                  const m = p.templates.find(
                    (t) => t.id === d?.masterId && t.scope === "master",
                  );
                  const ref = t.objects[0];
                  const o = m?.objects.find(
                    (o) =>
                      o.kind === t.componentKind && o.binding === ref.binding,
                  );
                  if (!o)
                    throw new Error(
                      "共通マスターに同じ役割の部品がありません。",
                    );
                  o.templateRef = t.id;
                } else applyComponent(p, destination.id, t.id, options);
              });
              setComponentApply(null);
              setPendingComponent(null);
              setComponentDestination(null);
              if (!inline) setDesignPicker(null);
            } catch (e) {
              setNotice(String(e));
            }
          }}
        />
      )
    );
  };
  const visualPicker = () =>
    designPicker && (
      <div className="modal-backdrop">
        <section
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label="見た目でデザインを選ぶ"
        >
          <button
            className="modal-close icon"
            aria-label="閉じる"
            onClick={() => {
              clearDesignPreview();
              setDesignPicker(null);
            }}
          >
            <X size={18} />
          </button>
          <h2>見た目でデザインを選ぶ</h2>
          {designPicker.category === "ページ" && (
            <button
              onClick={() => {
                clearDesignPreview();
                setDesignPicker({
                  ...designPicker,
                  category: "ページマスター",
                });
              }}
            >
              ページマスターを選ぶ
            </button>
          )}
          {designPicker.category === "ページマスター" && (
            <button
              onClick={() => {
                clearDesignPreview();
                setDesignPicker({ ...designPicker, category: "ページ" });
              }}
            >
              ページのデザインに戻る
            </button>
          )}
          <ComponentChoices
            key={designPicker.category + ":" + designPicker.blockId}
            project={project}
            measure={measure}
            block={project.blocks.find((b) => b.id === designPicker.blockId)}
            fixedCategory={designPicker.category}
            targetId={designPicker.objectId}
            pendingId={
              pendingLibraryPage?.template.id ?? pendingComponent?.template.id
            }
            onPreviewVariant={clearDesignPreview}
            select={(t, release) =>
              chooseVisualComponent(
                t,
                designPicker.blockId,
                designPicker.objectId,
                false,
                release,
              )
            }
            applyPageOption={(change, all) =>
              update((p) =>
                applyPageVariant(p, designPicker.blockId ?? "", change, all),
              )
            }
          />
          <div className="design-inline">
            {libraryPageDialog(true)}
            {partDialog(true)}
          </div>
        </section>
      </div>
    );
  if (designer)
    return (
      <>
        <Suspense fallback={<p role="status">デザイナーを読み込み中…</p>}>
          <Designer
            project={project}
            measure={measure}
            initialTemplateId={block?.templateId}
            currentBlockId={block?.id}
            saveState={saveState}
            onProjectEdit={update}
            onSelectBlock={(id) => {
              setSelected(`${id}/0`);
              if (!project.blocks.find((b) => b.id === id)?.templateId)
                setDesigner(false);
            }}
            onChange={(t) =>
              update((p) => {
                p.templates = p.templates.map((a) => (a.id === t.id ? t : a));
              })
            }
            onCreate={(t) =>
              update((p) => {
                p.templates.push(t);
              })
            }
            onRemove={(id) => update((p) => detachTemplate(p, id))}
            onAssets={(assets) =>
              update((p) => {
                assets.forEach((a) => (p.assets[a.id] = a));
              })
            }
            onApply={applyDesign}
            onClose={() => setDesigner(false)}
            onCapture={captureDesign}
            contextPage={page}
            onProjectSave={() => {
              void save();
            }}
            onPDF={(id) => {
              const t = project.templates.find((t) => t.id === id)!;
              const q = structuredClone(project);
              q.blocks = [
                {
                  id: uid(),
                  template: t.kind,
                  templateId: t.id,
                  title: t.name,
                  chapterId: block?.chapterId || q.chapters[0].id,
                },
              ];
              q.pageOrder = [];
              q.assignments = {};
              q.theme.padding = 1;
              pdf(q);
            }}
          />
        </Suspense>
        {!designPicker && (designer || step !== 0) && libraryPageDialog()}
        {visualPicker()}
        {!designPicker && (designer || step !== 0) && partDialog()}
        {busy && (
          <div className="busy">
            <PdfProgress state={pdfProgress} message={busy} />
          </div>
        )}
        {notice && (
          <div className="toast">
            {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}
      </>
    );
  return (
    <div
      className={`editor ${!dataMode && step !== 2 && step !== 3 ? "guided-editor" : ""}`}
      data-history={historyVersion}
    >
      {projectInput}

      <header className="topbar">
        <button
          className="icon"
          title="ホームへ戻る"
          aria-label="ホームへ戻る"
          onClick={() => {
            clearDesignPreview();
            setDesignPicker(null);
            const current = activeProject.current;
            setPdfSuccess(false);
            setNotice("");
            setHomeRoute("start");
            if (sampleSession.current) setHome(true);
            else
              void run(async () => {
                await webStorage.autosave(current);
                setHome(true);
                void refreshProjects();
              });
          }}
        >
          <Home size={19} />
        </button>

        <div className="project-title">
          <CommitField
            label="プロジェクト名"
            value={project.name}
            onCommit={(value) =>
              value.trim()
                ? update((p) => {
                    p.name = value.trim();
                    if (
                      recent.some(
                        (other) => other.id !== p.id && other.name === p.name,
                      )
                    )
                      setNotice(
                        "同名のプロジェクトがあります。一覧では年度と更新日時で確認できます。",
                      );
                  })
                : setNotice("プロジェクト名を入力してください。")
            }
          />
          <span>
            {saveState} <i /> A5縦・出力{layout.pages.length}ページ
          </span>
        </div>
        <div className="top-actions">
          <button
            className="icon"
            title="取り消し"
            disabled={!undo.current.length}
            onClick={() => history(true)}
          >
            <Undo2 size={18} />
          </button>
          <button
            className="icon"
            title="やり直し"
            disabled={!redo.current.length}
            onClick={() => history(false)}
          >
            <Redo2 size={18} />
          </button>
          <button
            onClick={() => openRef.current?.click()}
            title="プロジェクトを開く"
            aria-label="プロジェクトを開く"
          >
            <FolderOpen size={16} />
            <span>開く</span>
          </button>
          <button
            onClick={save}
            title="プロジェクトを保存"
            aria-label="プロジェクトを保存"
          >
            <Save size={16} />
            <span>プロジェクトを保存</span>
          </button>
        </div>
      </header>

      {pageChange && (
        <p className="page-change" role="status">
          {pageChange}
        </p>
      )}
      <div className="route-position">
        パンフレット制作 ›{" "}
        {step === 5
          ? "画像の登録"
          : step === 1 || step === 2 || dataMode
            ? "掲載情報"
            : productionSteps[step]}
      </div>
      {
        <nav className="production-steps" aria-label="制作の手順">
          {[0, 2, 3, 4].map((i, index) => {
            const label = productionSteps[i];
            const current =
              i === step || (i === 2 && (step === 1 || step === 5));
            const needsFix =
              i === 4 &&
              (!!errors.length || finalStatus === "出力後に変更あり");
            const complete = [
              designReady,
              false,
              project.intake === "images" ||
                project.intake === "done" ||
                project.events.length > 0 ||
                project.staff.length > 0 ||
                project.ads.length > 0,
              reviewed || finalStatus === "PDF生成済み",
              finalStatus === "PDF生成済み",
            ][i];
            return (
              <button
                key={label}
                type="button"
                aria-current={current ? "step" : undefined}
                disabled={
                  (!designReady && i > 0) || (intakePending(project) && i > 2)
                }
                className={
                  needsFix
                    ? "step-fix"
                    : complete
                      ? "step-done"
                      : "step-pending"
                }
                onClick={() => {
                  clearDesignPreview();
                  if (i === 4 && step === 3) setReviewed(true);
                  setDataMode(false);
                  setStep(
                    i === 2 && intakePending(project)
                      ? project.intake === "images"
                        ? 5
                        : 1
                      : i,
                  );
                }}
              >
                <b>
                  {index + 1}. {label}
                </b>
                <small>
                  {i === 4 && finalStatus === "PDF生成済み"
                    ? "完了 · PDF生成済み"
                    : i === 4 && finalStatus === "出力後に変更あり"
                      ? "要確認（出力後に変更あり）"
                      : current
                        ? "現在のステップ"
                        : needsFix
                          ? "修正が必要"
                          : i === 4 && finalStatus !== "確認が必要"
                            ? finalStatus
                            : complete
                              ? "完了"
                              : "未完了"}
                </small>
              </button>
            );
          })}
        </nav>
      }
      {intakePending(project) && (
        <p className="hint">
          Excelを取り込み、画像登録を完了または一括スキップすると、誌面の確認とPDF出力に進めます。
        </p>
      )}
      {dataMode || step === 2 ? (
        <DataWorkspace
          project={project}
          layout={layout}
          update={update}
          selectedId={eventId}
          onSelect={setEventId}
          focusSource={sheetSource}
          onReveal={(source) => {
            const pg =
              sourcePage(layout, source) ??
              (source.type === "ad" ? layout.pages[0] : undefined);
            if (pg) {
              setSelected(pg.id);
              setStep(3);
              setInputTarget(
                source.type === "ad" ? null : { blockId: pg.blockId, source },
              );
              setTab(source.type === "ad" ? "ads" : "page");
              setHideInspector(false);
              setDataMode(false);
            } else
              setNotice("この内容はまだパンフレットに配置されていません。");
          }}
          onImport={() => {
            setDataMode(false);
            setStep(1);
          }}
          onImages={() => {
            setDataMode(false);
            setStep(5);
          }}
          onHistory={history}
          historyVersion={historyVersion}
          onFinish={() => {
            setDataMode(false);
            setStep(3);
          }}
        />
      ) : step === 0 ? (
        <section className="production-guide">
          <p className="task-kicker">
            デザイン {designStep + 1} / {designSteps.length}
          </p>
          <p>
            全{designSteps.length}画面：
            {designSteps.join(" → ")}。見本を確認して進みます。
          </p>
          <h2>{designSteps[designStep]}</h2>
          {designStep === 0 ? (
            <PaletteControl
              project={project}
              update={update}
              measure={measure}
              confirmSelection
            />
          ) : (
            <ComponentChoices
              project={project}
              measure={measure}
              fixedCategory={designSteps[designStep] as ComponentCategory}
              allowGlobal
              select={(t, release) =>
                chooseVisualComponent(t, undefined, undefined, true, release)
              }
              key={designStep}
              pendingId={
                pendingLibraryPage?.template.id ?? pendingComponent?.template.id
              }
              onPreviewVariant={clearDesignPreview}
              builtin={(key, value) =>
                update((p) => applyThemeVariant(p, key, value))
              }
            />
          )}
          <div className="design-inline">
            {libraryPageDialog(true)}
            {partDialog(true)}
          </div>
          <div className="button-row">
            {designStep > 0 && (
              <button
                onClick={() => {
                  clearDesignPreview();
                  setDesignStep((i) => i - 1);
                }}
              >
                ← 前へ
              </button>
            )}
            <button
              className={
                designStep === designSteps.length - 1 ? "primary" : undefined
              }
              onClick={() => {
                clearDesignPreview();
                if (designStep < designSteps.length - 1)
                  setDesignStep((i) => i + 1);
                else {
                  setDesignReady(true);
                  setStep(
                    project.intake === "images"
                      ? 5
                      : project.intake === "done"
                        ? 2
                        : 1,
                  );
                }
              }}
            >
              {designStep < designSteps.length - 1
                ? `次へ：${designSteps[designStep + 1]} →`
                : "このデザインで進む →"}
            </button>
          </div>
        </section>
      ) : step === 1 ? (
        <ExcelImport
          inline
          project={project}
          update={(edit) =>
            update(
              (p) => {
                edit(p);
                p.intake = "images";
              },
              true,
              "Excel取り込み",
            )
          }
          close={() => setStep(0)}
          done={() => setStep(5)}
        />
      ) : step === 5 ? (
        <MediaIntake
          key={project.id}
          project={project}
          update={update}
          onFinish={() => {
            if (project.intake === "images")
              update((p) => {
                p.intake = "done";
              }, false);
            setStep(3);
          }}
        />
      ) : step === 4 ? (
        <section className="production-guide">
          <h2>{productionSteps[step]}</h2>
          <p>
            手順の「完了」は作業を進めた記録です。校正チェックの確認済みとは別です。「PDF生成済み」は現在の内容でPDFを出力したことを示します。
          </p>
          <p role="status">
            <strong>{finalStatus}</strong>
            {finalStatus === "出力後に変更あり" &&
              "。最新のPDFを再出力してください。"}
          </p>
          {project.lastPdf && (
            <p>
              最終PDF出力：
              {new Date(project.lastPdf.at).toLocaleString("ja-JP")}（全
              {project.lastPdf.pages}ページ）
            </p>
          )}
          <p>{outputPages(layout.pages.length, paddingCount)}</p>
          <p>
            自動白紙の内訳：章・ページ・見開きの開始位置を揃える白紙
            {blankCounts.start}ページ、総ページ数を整える白紙
            {blankCounts.padding}ページ。どちらも自動白紙に数えています。
          </p>
          <button
            onClick={() => {
              setTab("theme");
              setHideInspector(false);
              setStep(3);
            }}
          >
            総ページ数の設定
          </button>
          <p>
            エラー {errors.length} 件・警告 {warnings.length}{" "}
            件・任意の校正チェック 未確認 {pendingChecks} / {checks.length}{" "}
            件・情報 {infos.length} 件
          </p>
          <p>
            校正チェックは確認の記録用です。未確認や警告があっても校正用PDFを出力できます。エラーがある場合は修正してください。印刷会社の条件は別途確認してください。
          </p>

          <button
            className="primary"
            disabled={!fontsReady || !!busy || !!errors.length}
            onClick={() => pdf()}
          >
            PDFを出力
          </button>
          {!!errors.length && (
            <p>
              PDFを出力するにはエラーを修正してください。警告だけの場合は校正用PDFを出力できます。
            </p>
          )}
          {(
            [
              ["エラー", errors],
              ["警告", warnings],
              ["確認事項", checks],
              ["情報", infos],
            ] as const
          ).map(
            ([label, issues]) =>
              issues.length > 0 && (
                <section key={label}>
                  <h3>{label}</h3>
                  {issues.map((issue, i) => (
                    <div key={i} className={`issue ${issue.level}`}>
                      <span>
                        {issue.level === "check"
                          ? project.manualChecks[issue.checkId!]
                            ? "確認済み"
                            : "未確認"
                          : issue.level === "ok"
                            ? "確認済み"
                            : issue.level === "error"
                              ? "エラー"
                              : issue.level === "info"
                                ? "情報"
                                : "警告"}
                      </span>
                      {issue.checkId ? (
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={!!project.manualChecks[issue.checkId]}
                            onChange={(e) =>
                              update((p) => {
                                p.manualChecks[issue.checkId!] =
                                  e.target.checked;
                              }, false)
                            }
                          />
                          {issue.message}
                        </label>
                      ) : issue.pageId ? (
                        <button
                          onClick={() => {
                            setSelected(issue.pageId!);
                            setStep(3);
                          }}
                        >
                          {issue.message} →
                        </button>
                      ) : issue.adId ? (
                        <button
                          onClick={() => {
                            setSheetSource({
                              type: "ad",
                              id: issue.adId!,
                              field: "assetId",
                            });
                            setEventId(issue.adId!);
                            setStep(2);
                          }}
                        >
                          {issue.message} — 掲載情報 › 広告を確認 →
                        </button>
                      ) : (
                        <span>
                          {issue.message}
                          {issue.level === "warning" &&
                            " — 登録素材や印刷条件を確認してください。"}
                        </span>
                      )}
                    </div>
                  ))}
                </section>
              ),
          )}
        </section>
      ) : (
        <div
          className="workspace production-workspace"
          data-pages-hidden={hidePages}
          data-inspector-hidden={hideInspector}
        >
          <aside className="pages-panel" hidden={hidePages}>
            <div className="panel-heading">
              <h2>
                <Layers size={16} />
                ページ構成
              </h2>
              <button
                className="icon"
                title="ページ追加"
                onClick={() => setModal("add")}
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="page-count">
              全{layout.pages.length}ページ <span>ドラッグで順序変更</span>
            </div>
            <div className="pages-list">
              {layout.pages.map((pg, i) => (
                <button
                  key={pg.id}
                  className={`page-item ${pg.id === page.id ? "selected" : ""}`}
                  title="つかんで移動：左右配置と目次番号は自動で再計算します"
                  draggable={pg.template !== "blank"}
                  onDragStart={() => setDragged(pg.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    move(dragged, pg.id);
                  }}
                  onClick={() => {
                    setSelected(pg.id);
                    setInputTarget(null);
                    setTab("page");
                  }}
                >
                  <div className="thumb-wrap">
                    <Preview page={pg} project={project} thumb />
                    <span>{i + 1}</span>
                  </div>
                  <div>
                    <b>⠿ {pg.title}</b>
                    <small>
                      {pg.number ? `誌面番号 ${pg.number}` : "誌面番号なし"} ·{" "}
                      {pg.side === "left" ? "左" : "右"}
                    </small>
                  </div>
                  <GripVertical className="grip" size={14} />
                </button>
              ))}
            </div>
            <button className="add-page" onClick={() => setModal("add")}>
              <Plus size={16} />
              テンプレートを追加
            </button>
            <div className="backup-note">
              自動保存はこのブラウザ内のみ。
              <br />
              別の端末や引き継ぎには「プロジェクトを保存」でファイルを書き出してください。
            </div>
          </aside>
          <main className="canvas-panel">
            <div className="canvas-toolbar">
              <p>{outputPages(layout.pages.length, paddingCount)}</p>
              <div className="segmented">
                <button
                  aria-pressed={!hidePages}
                  onClick={() => setHidePages((v) => !v)}
                >
                  ページ一覧
                </button>
                <button
                  aria-pressed={!hideInspector}
                  onClick={() => setHideInspector((v) => !v)}
                >
                  編集パネル
                </button>
              </div>
              <select
                aria-label="紙面の表示倍率"
                value={fitMode}
                onChange={(e) => {
                  setFitMode(e.target.value as typeof fitMode);
                  setZoom(1);
                }}
              >
                <option value="page">ページ全体</option>
                <option value="width">幅に合わせる</option>
              </select>

              <label>
                表示方法{" "}
                <select
                  aria-label="プレビューの表示方法"
                  value={previewMode}
                  onChange={(e) =>
                    setPreviewMode(e.target.value as typeof previewMode)
                  }
                >
                  <option value="auto">自動</option>
                  <option value="single">1ページ</option>
                  <option value="spread">見開き2ページ</option>
                </select>
              </label>
              <div className="zoom">
                <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>
                  −
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom((z) => Math.min(1.7, z + 0.1))}>
                  ＋
                </button>
              </div>
              <button
                className="check-summary"
                onClick={() => {
                  setReviewed(true);
                  setStep(4);
                }}
              >
                <CheckCheck size={16} />
                最終確認へ
                <span>警告{warnings.length}件</span>
              </button>
            </div>
            {!sampleSession.current &&
              ((!project.events.length &&
                !project.staff.length &&
                !project.ads.length) ||
                !project.coverId) && (
                <div className="production-next-action">
                  {!project.events.length &&
                  !project.staff.length &&
                  !project.ads.length ? (
                    <button onClick={() => setStep(1)}>Excelを読み込む</button>
                  ) : (
                    <button
                      onClick={() => {
                        const cover = layout.pages.find(
                          (p) => p.template === "cover",
                        );
                        if (cover) {
                          setSelected(cover.id);
                          setHideInspector(false);
                          setInputTarget({
                            blockId: cover.blockId,
                            source: {
                              type: "project",
                              id: project.id,
                              field: "coverId",
                            },
                          });
                        }
                      }}
                    >
                      次に：表紙画像を追加
                    </button>
                  )}
                </div>
              )}
            <div className="canvas-caption">
              <span>
                {page.title}
                {page.blankReason && ` — ${page.blankReason}`}
              </span>
              {page.automatic && (
                <button
                  onClick={() => {
                    const automatic = page.automatic!;
                    setInputTarget(null);
                    setHideInspector(false);
                    if (
                      automatic.kind === "start" &&
                      automatic.setting !== "chapter"
                    ) {
                      const target = layout.pages.find(
                        (p) => p.blockId === automatic.targetBlockId,
                      );
                      if (target) setSelected(target.id);
                      setTab("page");
                      setAdvanced(true);
                    } else setTab("theme");
                  }}
                >
                  {page.automatic.kind === "padding"
                    ? "総ページ数の設定へ"
                    : page.automatic.setting === "chapter"
                      ? "章の設定へ"
                      : "対象ページの設定へ"}
                </button>
              )}
              <small>148 × 210 mm · A5</small>
            </div>
            <div className="canvas-scroll" ref={canvasRef}>
              <div
                className={`spread ${spread ? "" : "single"}`}
                style={{ width: fitWidth * zoom }}
              >
                {visible.map((pg, i) =>
                  pg ? (
                    <div
                      className={`paper ${pg.id === page.id ? "current" : ""}`}
                      key={pg.id}
                      onClick={() => setSelected(pg.id)}
                    >
                      <Preview
                        page={pg}
                        project={project}
                        onInput={(t) => {
                          setHideInspector(false);
                          if (
                            t.action &&
                            ["event", "ad", "staff", "kitchen"].includes(
                              t.action,
                            )
                          ) {
                            setInputTarget(null);
                            setStep(2);
                            return;
                          }
                          setInputTarget(t);
                          setSelected(pg.id);
                        }}
                        onEdit={(source, value) =>
                          update((q) => writeSource(q, source, value))
                        }
                        onEditMany={(changes) =>
                          update((q) => {
                            changes.forEach(({ source, value }) =>
                              writeSource(q, source, value),
                            );
                          })
                        }
                        onSelectSource={(source) => {
                          if (source.type === "event") setEventId(source.id);
                        }}
                        onAsset={async (source, file) => {
                          const { asset } = await importAsset(file);
                          update((q) => {
                            q.assets[asset.id] = asset;
                            writeSource(q, source, asset.id);
                          });
                        }}
                        onNumber={() => {
                          setTab("theme");
                          setAdvanced(true);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="paper-placeholder" key={`empty-${i}`} />
                  ),
                )}
              </div>
            </div>
            <div className="page-controls">
              <button
                className="icon"
                disabled={index < 1}
                title="前のページ"
                onClick={() => setSelected(layout.pages[index - 1].id)}
              >
                <ChevronLeft size={18} />
              </button>
              <span>
                PDF {index + 1}ページ目 ／ 出力全{layout.pages.length}ページ
                <small>{page.side === "left" ? "左ページ" : "右ページ"}</small>
                <details>
                  <summary>紙面に印刷される番号について</summary>
                  <p>
                    {page.number
                      ? `誌面番号は${page.number}です。`
                      : "このページに誌面番号は印刷されません。"}
                    表紙などを数えるPDFの位置とは異なります。
                  </p>
                </details>
              </span>
              <button
                className="icon"
                disabled={index === layout.pages.length - 1}
                title="次のページ"
                onClick={() => setSelected(layout.pages[index + 1].id)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="canvas-foot">
              {fontsReady
                ? "フォント読込済み · 文字と図形をベクター出力"
                : "日本語フォントを読み込み中…"}
            </div>
          </main>
          <aside className="inspector" hidden={hideInspector}>
            <div className="inspector-tabs">
              {(
                [
                  ["page", "ページ"],
                  ["events", "企画"],
                  ["ads", "広告"],
                  ["theme", "デザイン"],
                ] as [Tab, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  className={tab === id ? "active" : ""}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="inspector-body">
              <p className="hint">
                {
                  {
                    page: "ページ：選択した誌面の画像・文章・レイアウトを編集します。",
                    events: "企画：掲載する企画の内容と画像を編集します。",
                    ads: "広告：協賛広告の画像と掲載枠を設定します。",
                    theme:
                      "デザイン：冊子全体の配色・番号・白紙調整を設定します。",
                  }[tab]
                }
              </p>
              {inputTarget && (
                <ProductionEditor
                  key={JSON.stringify(inputTarget)}
                  project={project}
                  target={inputTarget}
                  update={update}
                  onTarget={(target) => {
                    setInputTarget(target);
                    if (target) setHideInspector(false);
                  }}
                  onClose={() => setInputTarget(null)}
                  onSheet={(source) => {
                    setSheetSource(source);
                    setEventId(source.id);
                    setDataMode(true);
                  }}
                  onDesign={() => {
                    const source = inputTarget.source;
                    const targetBlock = project.blocks.find(
                      (b) => b.id === inputTarget.blockId,
                    );
                    const category: ComponentCategory =
                      source?.type === "chapter"
                        ? "インデックス"
                        : source?.type === "pageNumber"
                          ? "ページ番号"
                          : source?.field === "title"
                            ? "見出し"
                            : inputTarget.componentKind === "table"
                              ? "表"
                              : inputTarget.componentKind === "timetable" ||
                                  targetBlock?.template === "stage"
                                ? "タイムテーブル"
                                : inputTarget.action === "ad" ||
                                    source?.type === "ad"
                                  ? "広告枠"
                                  : inputTarget.action === "poster" ||
                                      targetBlock?.template === "posters"
                                    ? "ポスター枠"
                                    : source?.field.startsWith("body")
                                      ? "箇条書き"
                                      : targetBlock?.template === "events"
                                        ? "表"
                                        : "ページ";
                    setDesignPicker({
                      category,
                      blockId: inputTarget.blockId,
                      objectId: inputTarget.objectId,
                    });
                  }}
                />
              )}
              <div hidden={!!inputTarget}>
                {tab === "page" && (
                  <>
                    <div className="eyebrow">PAGE SETTINGS</div>
                    <h2>{page.title}</h2>
                    {block && (
                      <button
                        onClick={() =>
                          setDesignPicker({
                            category:
                              block.template === "events"
                                ? "表"
                                : block.template === "stage"
                                  ? "タイムテーブル"
                                  : block.template === "posters"
                                    ? "ポスター枠"
                                    : block.template === "ads"
                                      ? "広告枠"
                                      : [
                                            "cover",
                                            "back",
                                            "kitchen",
                                            "staff",
                                            "sponsors",
                                            "notice",
                                          ].includes(block.template)
                                        ? "ページ"
                                        : "見出し",
                            blockId: block.id,
                          })
                        }
                      >
                        画像でデザインを選ぶ
                      </button>
                    )}
                    {block ? (
                      <>
                        <Field label="テンプレート">
                          <select
                            value={block.template}
                            onChange={(e) =>
                              update((p) => {
                                const target = p.blocks.find(
                                  (b) => b.id === block.id,
                                )!;
                                const type = e.target.value as Template;
                                if (type === "ads" && target.template !== "ads")
                                  target.adSize = "half";
                                if (type !== target.template)
                                  target.openingKind = undefined;
                                target.template = type;
                                target.templateId = undefined;
                              })
                            }
                          >
                            {Object.entries(templateNames).map(([id, name]) => (
                              <option key={id} value={id}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <div className="production-designs">
                          <b>デザインバリエーション</b>
                          <button
                            className={!block.templateId ? "active" : ""}
                            onClick={() =>
                              update((p) => {
                                p.blocks.find(
                                  (b) => b.id === block.id,
                                )!.templateId = undefined;
                              })
                            }
                          >
                            標準デザイン
                          </button>
                          {project.templates
                            .filter((t) => t.scope !== "style")
                            .map((t) => (
                              <button
                                key={t.id}
                                className={
                                  block.templateId === t.id ? "active" : ""
                                }
                                onClick={() => applyDesign(t.id, false)}
                              >
                                <Preview
                                  page={{
                                    id: t.id,
                                    blockId: block.id,
                                    title: t.name,
                                    template: t.kind,
                                    chapterId: block.chapterId,
                                    physical: 1,
                                    side: "right",
                                    slots: [],
                                    nodes:
                                      renderTemplate(project, t, measure)[0] ||
                                      [],
                                  }}
                                  project={project}
                                  thumb
                                />
                                <span>
                                  {t.name}
                                  <small>
                                    {t.scope === "component"
                                      ? "部品のみ"
                                      : t.scope === "master"
                                        ? "共通マスター"
                                        : "ページ全体"}{" "}
                                    · v{t.version}
                                  </small>
                                </span>
                              </button>
                            ))}
                          <button onClick={enableDesigner}>
                            ＋ デザインを作る
                          </button>
                        </div>
                        {block.template === "events" && (
                          <label className="check">
                            <input
                              type="checkbox"
                              checked={block.flowPosters === true}
                              onChange={(e) =>
                                update((q) => {
                                  q.blocks.find(
                                    (b) => b.id === block.id,
                                  )!.flowPosters = e.target.checked;
                                })
                              }
                            />
                            一覧とポスターを連続組版
                          </label>
                        )}
                        <Field label="開始ページの左右">
                          <select
                            value={block.startSide || "auto"}
                            onChange={(e) =>
                              update((q) => {
                                q.blocks.find(
                                  (b) => b.id === block.id,
                                )!.startSide = e.target.value as
                                  "auto" | "right" | "left";
                              })
                            }
                          >
                            <option value="auto">連続配置</option>
                            <option value="right">右ページから</option>
                            <option value="left">左ページから</option>
                          </select>
                        </Field>
                        <Field label="見出し">
                          <CommitField
                            key={block.id + "-title"}
                            value={block.title}
                            onCommit={(value) =>
                              update((p) => {
                                p.blocks.find((b) => b.id === block.id)!.title =
                                  value;
                              })
                            }
                          />
                        </Field>
                        <Field label="所属する章">
                          <select
                            value={block.chapterId}
                            onChange={(e) =>
                              update((p) => {
                                p.blocks.find(
                                  (b) => b.id === block.id,
                                )!.chapterId = e.target.value;
                              })
                            }
                          >
                            {project.chapters.map((ch) => (
                              <option key={ch.id} value={ch.id}>
                                {ch.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        {block.template === "cover" && (
                          <>
                            {importButton("表紙のメイン画像を登録", (p, id) => {
                              p.coverId = id;
                            })}
                            <p className="hint">
                              学園祭名・開催日・ロゴなどを含む完成画像を登録してください。
                            </p>
                          </>
                        )}
                        {block.openingKind === "survey" && (
                          <Field label="アンケートのURL">
                            <CommitField
                              key={block.id + "-surveyUrl"}
                              type="url"
                              value={block.surveyUrl || ""}
                              onCommit={(value) =>
                                update((p) => {
                                  p.blocks.find(
                                    (b) => b.id === block.id,
                                  )!.surveyUrl = value;
                                })
                              }
                            />
                          </Field>
                        )}
                        {block.openingKind === "committee" && (
                          <Field label="副実行委員長の掲載方法">
                            <select
                              value={block.viceMode || "together"}
                              onChange={(e) =>
                                update((p) => {
                                  p.blocks.find(
                                    (b) => b.id === block.id,
                                  )!.viceMode = e.target.value as
                                    "together" | "separate";
                                })
                              }
                            >
                              <option value="together">二人まとめて</option>
                              <option value="separate">二人を別々に</option>
                            </select>
                          </Field>
                        )}
                        {block.openingKind === "committee" &&
                          block.viceMode === "separate" && (
                            <>
                              <Field label="副実行委員長（2人目）の本文">
                                <CommitField
                                  key={block.id + "-thirdBody"}
                                  rows={8}
                                  value={block.thirdBody || ""}
                                  onCommit={(value) =>
                                    update((p) => {
                                      p.blocks.find(
                                        (b) => b.id === block.id,
                                      )!.thirdBody = value;
                                    })
                                  }
                                />
                              </Field>
                              {importButton(
                                "副実行委員長（2人目）の写真を登録",
                                (p, id) => {
                                  p.blocks.find(
                                    (b) => b.id === block.id,
                                  )!.thirdAssetId = id;
                                },
                              )}
                            </>
                          )}
                        {block.openingKind === "rules" && (
                          <RuleMarkControl
                            key={block.id}
                            project={project}
                            block={block}
                            update={update}
                          />
                        )}
                        {["leaders", "committee", "rules", "waste"].includes(
                          block.openingKind || "",
                        ) && (
                          <>
                            <Field
                              label={
                                block.openingKind === "waste"
                                  ? "その他の品目（1行1項目）"
                                  : "下段の本文"
                              }
                            >
                              <CommitField
                                key={block.id + "-secondBody"}
                                rows={8}
                                value={block.secondBody || ""}
                                onCommit={(value) =>
                                  update((p) => {
                                    p.blocks.find(
                                      (b) => b.id === block.id,
                                    )!.secondBody = value;
                                  })
                                }
                              />
                            </Field>
                            {["leaders", "committee"].includes(
                              block.openingKind || "",
                            ) &&
                              importButton("下段の写真を登録", (p, id) => {
                                p.blocks.find(
                                  (b) => b.id === block.id,
                                )!.secondAssetId = id;
                              })}
                          </>
                        )}
                        {block.template === "events" && (
                          <div className="info-card">
                            <b>企画データから自動生成</b>
                            <p>
                              建物 → 階数 →
                              教室の順に並べます。表が長くなると次ページへ続きます。
                            </p>
                            <button onClick={() => setTab("events")}>
                              企画を編集する →
                            </button>
                          </div>
                        )}
                        {block.template === "posters" && (
                          <>
                            <div className="info-card">
                              <b>4件ずつ、自動でページに</b>
                              <p>
                                一覧表と同じ企画情報を使います。ポスターと広告は変形・切り抜きを行いません。
                              </p>
                            </div>
                            <button onClick={() => setStep(5)}>
                              画像の登録へ
                            </button>
                            <Field label="最後のページの空き枠">
                              <select
                                value={project.theme.emptySlots}
                                onChange={(e) =>
                                  update((p) => {
                                    p.theme.emptySlots = e.target.value as
                                      "keep" | "center";
                                  })
                                }
                              >
                                <option value="keep">枠を空けておく</option>
                                <option value="center">
                                  最後の1枚を中央に揃える
                                </option>
                              </select>
                            </Field>
                          </>
                        )}
                        {block.template === "ads" && (
                          <Field label="広告規格">
                            <select
                              value={block.adSize || "quarter"}
                              onChange={(e) =>
                                update((p) => {
                                  p.blocks.find(
                                    (b) => b.id === block.id,
                                  )!.adSize = e.target.value as AdSize;
                                })
                              }
                            >
                              <option value="full">
                                1ページ（{project.theme.adWidth}×
                                {project.theme.adHeight}mm）
                              </option>
                              <option value="half">
                                1/2ページ（{project.theme.adWidth}×
                                {project.theme.adHalfHeight}mm）
                              </option>
                              {(block.adSize || "quarter") === "quarter" && (
                                <option value="quarter" disabled>
                                  旧テンプレート：1/4広告の縦積み
                                </option>
                              )}
                            </select>
                          </Field>
                        )}
                        {page.slots.length > 0 && (
                          <>
                            <h3>このページの広告</h3>
                            {page.slots.map((s, i) => (
                              <Field
                                key={s.key}
                                label={`広告枠 ${i + 1} / ${s.size}`}
                              >
                                <select
                                  value={
                                    Object.hasOwn(project.assignments, s.key)
                                      ? project.assignments[s.key] || "none"
                                      : "auto"
                                  }
                                  onChange={(e) =>
                                    update((p) => {
                                      if (e.target.value === "auto")
                                        delete p.assignments[s.key];
                                      else
                                        p.assignments[s.key] =
                                          e.target.value === "none"
                                            ? null
                                            : e.target.value;
                                    })
                                  }
                                >
                                  <option value="auto">
                                    自動割当：
                                    {project.sponsors.find(
                                      (c) =>
                                        c.id ===
                                        project.ads.find((a) => a.id === s.adId)
                                          ?.sponsorId,
                                    )?.name || "未設定"}
                                  </option>
                                  <option value="none">空き枠にする</option>
                                  {project.ads
                                    .filter((a) => a.size === s.size)
                                    .map((a) => (
                                      <option key={a.id} value={a.id}>
                                        {project.sponsors.find(
                                          (c) => c.id === a.sponsorId,
                                        )?.name || "企業名未設定"}
                                      </option>
                                    ))}
                                </select>
                              </Field>
                            ))}
                          </>
                        )}
                        {block.template === "back" && (
                          <>
                            <Field label="裏表紙のレイアウト">
                              <select
                                value={block.backLayout || ""}
                                onChange={(e) => {
                                  const value = e.target.value as
                                    keyof typeof backCoverLayouts | "";
                                  update((p) => {
                                    const b = p.blocks.find(
                                      (b) => b.id === block.id,
                                    )!;
                                    b.backLayout = value || undefined;
                                    if (value)
                                      b.websiteUrl ??= universityWebsite;
                                  });
                                  if (value && !block.backMapId)
                                    void run(async () => {
                                      const response = await fetch(
                                        import.meta.env.BASE_URL +
                                          "defaults/campus-area.webp",
                                      );
                                      if (!response.ok)
                                        throw new Error(
                                          "初期マップを読み込めませんでした。",
                                        );
                                      const { asset } = await importAsset(
                                        new File(
                                          [await response.blob()],
                                          "大学付近マップ.webp",
                                          { type: "image/webp" },
                                        ),
                                      );
                                      update((p) => {
                                        const b = p.blocks.find(
                                          (b) => b.id === block.id,
                                        );
                                        if (b && !b.backMapId) {
                                          p.assets[asset.id] = asset;
                                          b.backMapId = asset.id;
                                        }
                                      });
                                    });
                                }}
                              >
                                <option value="">従来の裏表紙</option>
                                {Object.entries(backCoverLayouts).map(
                                  ([key, label]) => (
                                    <option key={key} value={key}>
                                      {label}
                                    </option>
                                  ),
                                )}
                              </select>
                            </Field>
                            {block.backLayout && (
                              <>
                                {importButton("裏表紙の画像を登録", (p, id) => {
                                  p.blocks.find(
                                    (b) => b.id === block.id,
                                  )!.assetId = id;
                                })}
                                {importButton(
                                  "周辺マップを差し替え",
                                  (p, id) => {
                                    p.blocks.find(
                                      (b) => b.id === block.id,
                                    )!.backMapId = id;
                                  },
                                )}
                                <Field label="大学ウェブサイトのURL">
                                  <input
                                    type="url"
                                    value={
                                      block.websiteUrl ?? universityWebsite
                                    }
                                    onChange={(e) =>
                                      update((p) => {
                                        p.blocks.find(
                                          (b) => b.id === block.id,
                                        )!.websiteUrl = e.target.value;
                                      })
                                    }
                                  />
                                </Field>
                              </>
                            )}
                          </>
                        )}
                        {(block.template === "notice" ||
                          (block.template === "back" && !block.backLayout)) && (
                          <>
                            <Field
                              label={
                                block.openingKind === "waste"
                                  ? "可燃ごみ・プラスチック類（1行1項目）"
                                  : "本文"
                              }
                            >
                              <CommitField
                                key={block.id + "-body"}
                                rows={8}
                                value={block.body || ""}
                                onCommit={(value) =>
                                  update((p) => {
                                    p.blocks.find(
                                      (b) => b.id === block.id,
                                    )!.body = value;
                                  })
                                }
                              />
                            </Field>
                            {!["rules", "waste"].includes(
                              block.openingKind || "",
                            ) &&
                              importButton("画像を登録", (p, id) => {
                                p.blocks.find(
                                  (b) => b.id === block.id,
                                )!.assetId = id;
                              })}
                          </>
                        )}
                        {advanced && (
                          <>
                            <h3>表示・順序</h3>
                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={block.showIndex !== false}
                                onChange={(e) =>
                                  update((p) => {
                                    p.blocks.find(
                                      (b) => b.id === block.id,
                                    )!.showIndex = e.target.checked;
                                  })
                                }
                              />
                              サイドインデックスを表示
                            </label>
                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={block.showNumber !== false}
                                onChange={(e) =>
                                  update((p) => {
                                    p.blocks.find(
                                      (b) => b.id === block.id,
                                    )!.showNumber = e.target.checked;
                                  })
                                }
                              />
                              ページ番号を表示
                            </label>
                            <div className="button-row">
                              <button
                                disabled={index < 1}
                                onClick={() =>
                                  move(page.id, layout.pages[index - 1].id)
                                }
                              >
                                <ArrowUp size={15} />
                                前へ
                              </button>
                              <button
                                disabled={index >= layout.pages.length - 1}
                                onClick={() =>
                                  move(page.id, layout.pages[index + 1].id)
                                }
                              >
                                <ArrowDown size={15} />
                                後へ
                              </button>
                            </div>
                          </>
                        )}
                        <div className="button-row section-end">
                          <button
                            onClick={() => {
                              const id = uid();
                              update((p) => {
                                const i = p.blocks.findIndex(
                                  (b) => b.id === block.id,
                                );
                                p.blocks.splice(i + 1, 0, {
                                  ...structuredClone(block),
                                  id,
                                  title: `${block.title} コピー`,
                                });
                                p.pageOrder = [];
                              });
                              setSelected(`${id}/0`);
                            }}
                          >
                            <Copy size={15} />
                            複製
                          </button>
                          <button
                            className="danger"
                            onClick={() => setModal("delete")}
                          >
                            <Trash2 size={15} />
                            削除
                          </button>
                        </div>
                      </>
                    ) : (
                      <p>
                        ページ数を調整する白紙です。デザイン設定で偶数・4の倍数への調整を変更できます。
                      </p>
                    )}
                  </>
                )}
                {tab === "events" && (
                  <>
                    {project.blocks
                      .filter((b) => b.externalEvent)
                      .map((b) => (
                        <Field
                          key={b.id}
                          label={b.title + "（外部・特別企画）ポスター要否"}
                        >
                          <select
                            value={b.posterRequired === false ? "不要" : "要"}
                            onChange={(e) =>
                              update((p) => {
                                p.blocks.find(
                                  (x) => x.id === b.id,
                                )!.posterRequired = e.target.value === "要";
                              })
                            }
                          >
                            <option>要</option>
                            <option>不要</option>
                          </select>
                        </Field>
                      ))}
                    <div className="eyebrow">CONTENT LIBRARY</div>
                    <h2>
                      企画・ポスター{" "}
                      <span className="badge">{project.events.length}</span>
                    </h2>
                    <p className="hint">
                      一度の登録で、一覧表と紹介ページに反映されます。企画の独立した本文欄はありません。お知らせ・挨拶の文章は「共通情報・文章」で編集します。
                    </p>
                    <div className="button-row">
                      <button onClick={() => setStep(5)}>
                        <Upload size={16} />
                        一括登録
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        setDataMode(true);
                        setStep(2);
                      }}
                    >
                      掲載情報・文章の編集へ
                    </button>
                    <div className="record-list">
                      {project.events.map((e) => (
                        <button
                          key={e.id}
                          className={event?.id === e.id ? "active" : ""}
                          onClick={() => setEventId(e.id)}
                        >
                          <span
                            className={
                              e.assetId ? "asset-dot filled" : "asset-dot"
                            }
                          />
                          <span>{e.name || "名称未設定"}</span>
                          {e.floor !== undefined && <small>{e.floor}F</small>}
                        </button>
                      ))}
                    </div>
                    {event && (
                      <>
                        <h3>選択した企画</h3>
                        {(
                          [
                            ["name", "企画名"],
                            ["group", "団体名"],
                            ["building", "建物"],
                            ["room", "教室番号"],
                            ["location", "開催場所"],
                            ["startTime", "開始時刻（HH:mm）"],
                            ["endTime", "終了時刻（HH:mm）"],
                          ] as const
                        )
                          .filter(
                            ([key]) =>
                              !event.category ||
                              event.category === "student" ||
                              event.category === "food" ||
                              (isStage(event) &&
                                ["name", "startTime", "endTime"].includes(
                                  key,
                                )) ||
                              (event.category === "kitchen" && key === "name"),
                          )
                          .map(([key, label]) => (
                            <Field
                              key={key}
                              label={
                                event.category === "kitchen" ? "会社名" : label
                              }
                            >
                              <CommitField
                                key={event.id + "-" + key}
                                value={event[key] || ""}
                                onCommit={(value) => changeEvent(key, value)}
                              />
                            </Field>
                          ))}
                        {!isStage(event) && event.category !== "kitchen" && (
                          <>
                            <Field label="階数">
                              <input
                                type="number"
                                min="-5"
                                max="99"
                                value={event.floor ?? ""}
                                onChange={(e) =>
                                  update((p) =>
                                    writeSource(
                                      p,
                                      {
                                        type: "event",
                                        id: event.id,
                                        field: "floor",
                                      },
                                      e.target.value,
                                    ),
                                  )
                                }
                              />
                            </Field>
                          </>
                        )}
                        {event.category === "kitchen" && (
                          <KitchenMenus
                            project={project}
                            eventId={event.id}
                            update={update}
                          />
                        )}
                        {event.category !== "kitchen" && (
                          <Field label="ポスター要否">
                            <select
                              aria-label="企画のポスター要否"
                              value={
                                event.posterRequired === false ? "不要" : "要"
                              }
                              onChange={(e) =>
                                update((p) => {
                                  p.events.find(
                                    (x) => x.id === event.id,
                                  )!.posterRequired = e.target.value === "要";
                                })
                              }
                            >
                              <option>要</option>
                              <option>不要</option>
                            </select>
                          </Field>
                        )}
                        {event.assetId && project.assets[event.assetId] && (
                          <img
                            className="asset-preview"
                            src={
                              project.assets[event.assetId].preview ||
                              project.assets[event.assetId].data
                            }
                            alt="登録ポスター"
                          />
                        )}
                        {importButton(
                          event.assetId
                            ? "ポスターを差し替え"
                            : "ポスターを登録",
                          (p, id) => {
                            p.events.find((e) => e.id === event.id)!.assetId =
                              id;
                          },
                        )}
                        <p className="hint">
                          PDFは1ページ目を登録し、出力時に原本を直接埋め込みます。
                        </p>
                        <button
                          className="danger"
                          onClick={() =>
                            update((p) => {
                              p.events = p.events.filter(
                                (e) => e.id !== event.id,
                              );
                            })
                          }
                        >
                          <Trash2 size={15} />
                          この企画を削除
                        </button>
                      </>
                    )}
                  </>
                )}
                {tab === "ads" && (
                  <>
                    <div className="eyebrow">SPONSOR LIBRARY</div>
                    <h2>協賛企業・広告</h2>
                    <p className="hint">
                      広告の重複掲載は行いません。空き枠は警告されます。
                    </p>

                    {project.sponsors.map((s) => (
                      <div className="ad-card" key={s.id}>
                        <Field label="企業名">
                          <input
                            value={s.name}
                            onChange={(e) =>
                              update((p) => {
                                p.sponsors.find((c) => c.id === s.id)!.name =
                                  e.target.value;
                              })
                            }
                          />
                        </Field>
                        {advanced && (
                          <>
                            <Field label="読み仮名・並び替えキー">
                              <input
                                value={s.sortKey}
                                placeholder="法人格を除く名称・よみ"
                                onChange={(e) =>
                                  update((p) => {
                                    p.sponsors.find(
                                      (c) => c.id === s.id,
                                    )!.sortKey = e.target.value;
                                  })
                                }
                              />
                            </Field>
                          </>
                        )}
                        {project.ads
                          .filter((a) => a.sponsorId === s.id)
                          .map((ad) => (
                            <div className="ad-item" key={ad.id}>
                              <Field label="広告規格">
                                <select
                                  value={ad.size}
                                  onChange={(e) =>
                                    update((p) => {
                                      p.ads.find((a) => a.id === ad.id)!.size =
                                        e.target.value as AdSize;
                                    })
                                  }
                                >
                                  <option value="full">
                                    1ページ / {project.theme.adWidth}×
                                    {project.theme.adHeight}mm
                                  </option>
                                  <option value="half">
                                    1/2 / {project.theme.adWidth}×
                                    {project.theme.adHalfHeight}mm
                                  </option>
                                  <option value="quarter">
                                    1/4 / {project.theme.adWidth}×
                                    {project.theme.adQuarterHeight}mm
                                  </option>
                                </select>
                              </Field>
                              {ad.assetId && project.assets[ad.assetId] && (
                                <img
                                  className="asset-preview ad"
                                  src={
                                    project.assets[ad.assetId].preview ||
                                    project.assets[ad.assetId].data
                                  }
                                  alt="広告素材"
                                />
                              )}
                              {importButton(
                                ad.assetId
                                  ? "広告素材を差し替え"
                                  : "広告素材を登録",
                                (p, id) => {
                                  p.ads.find((a) => a.id === ad.id)!.assetId =
                                    id;
                                },
                              )}
                              <Field label="広告の配置先">
                                <select
                                  aria-label={
                                    "広告の配置先 " +
                                    (s.name || "名称未設定") +
                                    " " +
                                    ad.id
                                  }
                                  value={
                                    layout.pages
                                      .flatMap((pg) => pg.slots)
                                      .find((slot) => slot.adId === ad.id)
                                      ?.key ?? ""
                                  }
                                  onChange={(e) => {
                                    const key = e.target.value;
                                    if (!key) return;
                                    update((p) => {
                                      for (const previous of Object.keys(
                                        p.assignments,
                                      ))
                                        if (p.assignments[previous] === ad.id)
                                          delete p.assignments[previous];
                                      p.assignments[key] = ad.id;
                                    });
                                  }}
                                >
                                  <option value="">
                                    {layout.pages.some((pg) =>
                                      pg.slots.some(
                                        (slot) =>
                                          slot.size === ad.size && !slot.adId,
                                      ),
                                    )
                                      ? "配置先を選ぶ"
                                      : "同じ規格の空き枠なし（下のボタンで追加）"}
                                  </option>
                                  {layout.pages.flatMap((pg) =>
                                    pg.slots
                                      .filter((slot) => slot.size === ad.size)
                                      .map((slot, i) => (
                                        <option
                                          key={slot.key}
                                          value={slot.key}
                                          disabled={
                                            !!slot.adId && slot.adId !== ad.id
                                          }
                                        >
                                          PDF {pg.physical}ページ：{pg.title} ／
                                          枠{i + 1}
                                          {slot.adId && slot.adId !== ad.id
                                            ? "（使用中）"
                                            : ""}
                                        </option>
                                      )),
                                  )}
                                </select>
                              </Field>
                              <button
                                onClick={() => {
                                  const pg =
                                    layout.pages.find((pg) =>
                                      pg.slots.some(
                                        (slot) => slot.adId === ad.id,
                                      ),
                                    ) ??
                                    layout.pages.find((pg) =>
                                      pg.slots.some(
                                        (slot) =>
                                          slot.size === ad.size && !slot.adId,
                                      ),
                                    );
                                  if (pg) {
                                    setSelected(pg.id);
                                    setTab("page");
                                    setInputTarget(null);
                                    setHideInspector(false);
                                  } else {
                                    const id = uid();
                                    const beforeTotal = layout.pages.length,
                                      beforeBlank = automaticBlankCounts(
                                        layout.pages,
                                      ).total;
                                    update(
                                      (p) => {
                                        insertBlock(p, {
                                          id,
                                          template: "ads",
                                          title: "協賛広告",
                                          chapterId:
                                            p.chapters.find(
                                              (ch) => ch.name === "協賛",
                                            )?.id ?? p.chapters[0].id,
                                          adSize: ad.size,
                                        });
                                        p.assignments[`${id}/0:slot0`] = ad.id;
                                      },
                                      true,
                                      "広告ページの追加と配置",
                                    );
                                    const afterLayout = layoutProject(
                                      activeProject.current,
                                      measure,
                                    );
                                    setNotice(
                                      `広告ページを追加して配置しました。出力${beforeTotal}→${afterLayout.pages.length}ページ、自動白紙${beforeBlank}→${automaticBlankCounts(afterLayout.pages).total}ページ。章の開始位置と総ページ数の調整も再計算しています。`,
                                    );
                                    setSelected(`${id}/0`);
                                    setTab("page");
                                    setInputTarget(null);
                                    setHideInspector(false);
                                  }
                                }}
                              >
                                誌面で配置を確認（空き枠がなければページを追加し、白紙も再計算）
                              </button>
                              <span className="ad-status">
                                {layout.pages.find((pg) =>
                                  pg.slots.some((slot) => slot.adId === ad.id),
                                )?.title || "未配置"}
                                {!ad.assetId ? " / 素材未登録" : ""}
                              </span>
                              <button
                                className="link danger"
                                onClick={() =>
                                  update((p) => {
                                    p.ads = p.ads.filter((a) => a.id !== ad.id);
                                    for (const key of Object.keys(
                                      p.assignments,
                                    ))
                                      if (p.assignments[key] === ad.id)
                                        delete p.assignments[key];
                                  })
                                }
                              >
                                この広告を削除
                              </button>
                            </div>
                          ))}

                        <button
                          className="link danger"
                          onClick={() =>
                            update((p) => {
                              const ids = p.ads
                                .filter((a) => a.sponsorId === s.id)
                                .map((a) => a.id);
                              p.ads = p.ads.filter((a) => a.sponsorId !== s.id);
                              p.sponsors = p.sponsors.filter(
                                (a) => a.id !== s.id,
                              );
                              for (const key of Object.keys(p.assignments))
                                if (ids.includes(p.assignments[key] || ""))
                                  delete p.assignments[key];
                            })
                          }
                        >
                          企業ごと削除
                        </button>
                      </div>
                    ))}
                  </>
                )}
                {tab === "theme" && (
                  <>
                    <p className="hint">
                      冊子全体の配色はステップ1と同じ設定です。ここでの変更も全ページとステップ1に反映されます。
                    </p>
                    <div className="eyebrow">DESIGN SYSTEM</div>
                    <h2>全体のデザイン</h2>
                    <PaletteControl
                      project={project}
                      update={update}
                      measure={measure}
                    />
                    <Field label="ページ番号の開始番号">
                      <input
                        type="number"
                        min={1}
                        value={project.theme.numberStart || 1}
                        onChange={(e) =>
                          update((q) => {
                            q.theme.numberStart = Math.max(1, +e.target.value);
                          })
                        }
                      />
                    </Field>
                    <div className="preset-colors">
                      {palettes.map((color) => (
                        <button
                          key={color}
                          style={{ background: color }}
                          title={color}
                          onClick={() =>
                            update((p) => {
                              p.theme.accent = color;
                            })
                          }
                        />
                      ))}
                    </div>
                    {(
                      [
                        ["background", "本文の背景色"],
                        ["accent", "テーマカラー"],
                        ["ink", "文字色"],
                      ] as const
                    ).map(([key, label]) => (
                      <Field key={key} label={label}>
                        <div className="color-input">
                          <input
                            type="color"
                            value={project.theme[key]}
                            onChange={(e) =>
                              update((p) => {
                                p.theme[key] = e.target.value;
                              })
                            }
                          />
                          <input
                            aria-label={`${label} カラーコード`}
                            defaultValue={project.theme[key]}
                            key={project.theme[key]}
                            onBlur={(e) => {
                              if (/^#[\da-f]{6}$/i.test(e.target.value)) {
                                const value = e.target.value;
                                update((p) => {
                                  p.theme[key] = value;
                                });
                              } else e.target.value = project.theme[key];
                            }}
                          />
                        </div>
                      </Field>
                    ))}
                    <h3>章とサイドインデックス</h3>
                    {project.chapters.map((ch, i) => (
                      <div className="chapter-row" key={ch.id}>
                        <input
                          type="color"
                          aria-label={`${ch.name}の色`}
                          value={ch.color}
                          onChange={(e) =>
                            update((p) => {
                              p.chapters.find((c) => c.id === ch.id)!.color =
                                e.target.value;
                            })
                          }
                        />
                        <input
                          aria-label="章名"
                          value={ch.name}
                          onChange={(e) =>
                            update((p) => {
                              p.chapters.find((c) => c.id === ch.id)!.name =
                                e.target.value;
                            })
                          }
                        />
                        <select
                          aria-label={ch.name + "の開始位置"}
                          value={ch.startSide ?? "auto"}
                          onChange={(e) =>
                            update((p) => {
                              p.chapters.find(
                                (c) => c.id === ch.id,
                              )!.startSide = e.target.value as
                                "auto" | "left" | "right";
                            })
                          }
                        >
                          <option value="auto">開始位置：自動</option>
                          <option value="left">左ページから</option>
                          <option value="right">右ページから</option>
                        </select>
                        <button
                          className="icon"
                          title="章を上へ"
                          disabled={i === 0}
                          onClick={() =>
                            update((p) => {
                              [p.chapters[i - 1], p.chapters[i]] = [
                                p.chapters[i],
                                p.chapters[i - 1],
                              ];
                            })
                          }
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          className="icon danger"
                          title="章を削除"
                          disabled={project.chapters.length === 1}
                          onClick={() =>
                            update((p) => {
                              p.chapters = p.chapters.filter(
                                (c) => c.id !== ch.id,
                              );
                              for (const b of p.blocks)
                                if (b.chapterId === ch.id)
                                  b.chapterId = p.chapters[0].id;
                            })
                          }
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}

                    <h3>ページ・印刷の設定</h3>
                    <Field label="綴じ方向">
                      <select
                        value={project.theme.binding}
                        onChange={(e) =>
                          update((p) => {
                            p.theme.binding = e.target.value as
                              "left" | "right";
                          })
                        }
                      >
                        <option value="left">左綴じ</option>
                        <option value="right">右綴じ</option>
                      </select>
                    </Field>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={project.theme.padding === 4}
                        onChange={(e) =>
                          update((p) => {
                            p.theme.padding = e.target.checked ? 4 : 1;
                          })
                        }
                      />
                      総ページ数を4の倍数に固定
                    </label>
                    {project.theme.padding === 2 && (
                      <p>
                        旧設定：偶数ページに調整中。{" "}
                        <button
                          onClick={() =>
                            update((p) => {
                              p.theme.padding = 1;
                            })
                          }
                        >
                          調整なしに変更
                        </button>
                      </p>
                    )}
                    {advanced && (
                      <>
                        {(
                          [
                            ["margin", "本文余白（mm）", 5, 16, 0.5],
                            ["fontSize", "本文文字サイズ（mm）", 2, 5, 0.1],
                            ["lineHeight", "本文行間", 1.1, 1.8, 0.05],
                            ["adWidth", "広告の共通幅（mm）", 50, 128, 1],
                            [
                              "adHeight",
                              "1ページ広告の高さ（mm）",
                              100,
                              180,
                              1,
                            ],
                            ["adHalfHeight", "1/2広告の高さ（mm）", 30, 90, 1],
                            [
                              "adQuarterHeight",
                              "1/4広告の高さ（mm）",
                              15,
                              45,
                              1,
                            ],
                          ] as const
                        ).map(([key, label, min, max, step]) => (
                          <Field key={key} label={label}>
                            <input
                              type="number"
                              min={min}
                              max={max}
                              step={step}
                              value={project.theme[key]}
                              onChange={(e) =>
                                update((p) => {
                                  p.theme[key] = Math.max(
                                    min,
                                    Math.min(max, +e.target.value),
                                  );
                                })
                              }
                            />
                          </Field>
                        ))}
                      </>
                    )}
                    <div className="info-card">
                      <b>Noto Sans CJK JP</b>
                      <p>
                        見出し Bold / 本文
                        Mediumを同梱・PDFに埋め込み。英数字もNotoで代替します。Arialは同梱していません。
                      </p>
                    </div>
                    <h3>年度の引き継ぎ</h3>
                    <button
                      onClick={() => {
                        start(nextYear(project), true);
                        setNotice(
                          "別プロジェクトとして次年度版を作成しました。企画・広告・素材はリセットしました。",
                        );
                      }}
                    >
                      次年度用に複製
                    </button>
                    <p className="hint">
                      テンプレートと配色・章を引き継ぎ、開催回数を1増やします。
                    </p>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
      {pdfSuccess && !notice && (
        <div className="toast" role="status">
          PDFを出力しました
          {project.lastPdf ? `（全${project.lastPdf.pages}ページ）` : "。"}
          <button
            onClick={() => setPdfSuccess(false)}
            aria-label="通知を閉じる"
          >
            ×
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {busy && (
        <div className="busy">
          <div className="spinner" />
          <PdfProgress state={pdfProgress} message={busy} />
        </div>
      )}
      {modal && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true">
            <button
              className="modal-close icon"
              title="閉じる"
              onClick={() => setModal(null)}
            >
              <X size={18} />
            </button>
            {modal === "add" && (
              <>
                <div className="eyebrow">PAGE TEMPLATES</div>
                <h2>テンプレートを追加</h2>
                <p>登録データの件数に応じて、必要なページを自動生成します。</p>
                <PageChoices measure={measure} select={addBlock} />
              </>
            )}
            {modal === "export" && (
              <>
                <div className="eyebrow">EXPORT / STANDARD PDF</div>
                <h2>A5の標準PDFを書き出す</h2>
                <div className="export-spec">
                  <span>仕上がり</span>
                  <b>148 × 210 mm / 単ページ</b>
                  <span>ページ数</span>
                  <b>{layout.pages.length}ページ</b>
                  <span>出力方式</span>
                  <b>文字・図形はベクター / フォント埋込</b>
                  <span>色空間</span>
                  <b>RGB（校正・プレビュー用）</b>
                </div>
                <p className="export-warning">
                  印刷用のCMYK変換・ICC・PDF/X・塗り足しは未実装です。入稿時は印刷会社の条件に合わせた変換と確認が必要です。
                </p>
                <p>
                  エラー {errors.length}件 / 警告 {warnings.length}件
                </p>
                <div className="button-row">
                  <button
                    onClick={() => {
                      setModal(null);
                      setStep(4);
                    }}
                  >
                    チェック結果を見る
                  </button>
                  <button
                    className="primary"
                    disabled={!!errors.length}
                    onClick={() => pdf()}
                  >
                    <Download size={17} />
                    標準PDFを書き出す
                  </button>
                </div>
              </>
            )}
            {modal === "delete" && (
              <>
                <h2>テンプレートを削除</h2>
                <p>
                  「{block?.title}」と、そこから自動生成された
                  {layout.pages.filter((p) => p.blockId === block?.id).length}
                  ページを削除します。登録した企画や素材は保持されます。
                </p>
                <div className="button-row">
                  <button onClick={() => setModal(null)}>キャンセル</button>
                  <button
                    className="danger"
                    onClick={() => {
                      update((p) => {
                        p.blocks = p.blocks.filter((b) => b.id !== block?.id);
                        for (const key of Object.keys(p.assignments))
                          if (key.startsWith(`${block?.id}/`))
                            delete p.assignments[key];
                        if (!p.blocks.length)
                          p.blocks.push({
                            id: uid(),
                            template: "contents",
                            title: "目次",
                            chapterId: p.chapters[0]?.id || "",
                          });
                      });
                      setSelected("");
                      setModal(null);
                    }}
                  >
                    削除する
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {!designPicker && (designer || step !== 0) && libraryPageDialog()}
      {visualPicker()}
      {!designPicker && (designer || step !== 0) && partDialog()}
    </div>
  );
}
