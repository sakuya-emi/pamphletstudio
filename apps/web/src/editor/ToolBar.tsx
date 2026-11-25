import {
  MousePointer2,
  MousePointer,
  PenTool,
  Square,
  Circle,
  Minus,
  Type,
  Image,
  Hand,
  ChevronDown,
} from "lucide-react";
export type Tool =
  | "select"
  | "anchor"
  | "pen"
  | "rect"
  | "ellipse"
  | "line"
  | "text"
  | "image"
  | "hand";
export const editorTools = [
  {
    id: "select",
    name: "選択",
    key: "V",
    hint: "クリックで選択、ドラッグで移動",
    icon: MousePointer2,
  },
  {
    id: "anchor",
    name: "ダイレクト選択",
    key: "A",
    hint: "パスの点と制御点を編集",
    icon: MousePointer,
  },
  {
    id: "pen",
    name: "ペン",
    key: "P",
    hint: "クリックで直線、ドラッグで曲線、Enterで確定",
    icon: PenTool,
  },
  {
    id: "rect",
    name: "長方形",
    key: "M",
    hint: "ドラッグして長方形を作成",
    icon: Square,
  },
  {
    id: "ellipse",
    name: "楕円",
    key: "L",
    hint: "ドラッグして楕円を作成",
    icon: Circle,
  },
  {
    id: "line",
    name: "直線",
    key: "\\",
    hint: "始点から終点へドラッグ",
    icon: Minus,
  },
  {
    id: "text",
    name: "文字",
    key: "T",
    hint: "用紙をクリックして直接入力",
    icon: Type,
  },
  {
    id: "image",
    name: "画像",
    key: "I",
    hint: "用紙をクリックして画像を選択",
    icon: Image,
  },
  {
    id: "hand",
    name: "手のひら",
    key: "H",
    hint: "ドラッグで移動、Spaceでも一時切替",
    icon: Hand,
  },
] as const;
export function ToolBar({
  tool,
  onTool,
  showDrawing = true,
  onToggleDrawing,
}: {
  tool: Tool;
  onTool: (tool: Tool) => void;
  showDrawing?: boolean;
  onToggleDrawing?: () => void;
}) {
  return (
    <nav className="editor-tools" aria-label="描画ツール">
      {editorTools
        .filter(
          (t) =>
            showDrawing ||
            t.id === "select" ||
            t.id === "hand" ||
            t.id === tool,
        )
        .map((t) => (
          <button
            key={t.id}
            aria-label={`${t.name} ${t.key}`}
            aria-pressed={tool === t.id}
            title={`${t.name} (${t.key}) — ${t.hint}`}
            onClick={() => onTool(t.id)}
          >
            <t.icon size={19} />
          </button>
        ))}
      {onToggleDrawing && (
        <button
          aria-expanded={showDrawing}
          aria-label={showDrawing ? "作図ツールを閉じる" : "作図ツールを開く"}
          title={showDrawing ? "作図ツールを閉じる" : "作図ツールを開く"}
          onClick={onToggleDrawing}
        >
          <ChevronDown size={19} />
        </button>
      )}
    </nav>
  );
}
