import { useEffect, useRef } from "react";
import { Save, Undo2, Redo2, ArrowLeft } from "lucide-react";
export interface MenuAction {
  label: string;
  run: () => void;
  disabled?: boolean;
  shortcut?: string;
}
export function MenuBar({
  menus,
  onSave,
  onClose,
  undo,
  redo,
  onPalette,
  shared,
}: {
  menus: { name: string; items: MenuAction[] }[];
  onSave: () => void;
  onClose: () => void;
  undo: () => void;
  redo: () => void;
  onPalette?: () => void;
  shared?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node))
        ref.current
          ?.querySelectorAll("details[open]")
          .forEach((d) => d.removeAttribute("open"));
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <header
      className="editor-menubar"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "Escape")
          ref.current
            ?.querySelectorAll("details[open]")
            .forEach((d) => d.removeAttribute("open"));
      }}
    >
      <button
        title={shared ? "共通ライブラリを閉じる" : "制作モードへ戻る"}
        aria-label={shared ? "共通ライブラリを閉じる" : "制作モードへ戻る"}
        onClick={onClose}
      >
        <ArrowLeft size={17} />
      </button>
      <b className="editor-brand">P / TEMPLATE</b>
      <nav aria-label="編集メニュー">
        {menus.map((m) => (
          <details
            key={m.name}
            onToggle={(e) => {
              if (e.currentTarget.open)
                ref.current?.querySelectorAll("details[open]").forEach((d) => {
                  if (d !== e.currentTarget) d.removeAttribute("open");
                });
            }}
          >
            <summary>{m.name}</summary>
            <div className="editor-menu">
              {m.items.map((a) => (
                <button
                  key={a.label}
                  disabled={a.disabled}
                  onClick={(e) => {
                    e.currentTarget.closest("details")?.removeAttribute("open");
                    a.run();
                  }}
                >
                  {a.label}
                  <kbd>{a.shortcut}</kbd>
                </button>
              ))}
            </div>
          </details>
        ))}
      </nav>
      {onPalette && (
        <button type="button" onClick={onPalette}>
          {shared ? "共通の配色" : "冊子の配色"}
        </button>
      )}
      <span className="editor-mode">テンプレート編集</span>
      <button aria-label="取り消し" title="取り消し Ctrl/Cmd+Z" onClick={undo}>
        <Undo2 size={17} />
      </button>
      <button
        aria-label="やり直し"
        title="やり直し Ctrl/Cmd+Shift+Z"
        onClick={redo}
      >
        <Redo2 size={17} />
      </button>
      <button
        aria-label={
          shared ? "共通ライブラリの下書きを保存" : "プロジェクトを保存"
        }
        title={
          shared
            ? "下書きを保存（冊子へは未適用）"
            : "素材を含む.pamphファイルを保存"
        }
        onClick={onSave}
      >
        <Save size={17} />
      </button>
    </header>
  );
}
