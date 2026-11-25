import type { ReactNode } from "react";
export function EditorShell({
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className="designer-root" tabIndex={0}>
      {children}
    </div>
  );
}
export function StatusBar({
  tool,
  count,
  zoom,
  message,
  saveState,
  shared,
}: {
  tool: string;
  count: number;
  zoom: number;
  message: string;
  saveState: string;
  shared?: boolean;
}) {
  return (
    <footer className="designer-status" role="status">
      <span>{tool}</span>
      <span>{count}個選択</span>
      <span>{Math.round(zoom * 100)}%</span>
      <span>{saveState}</span>
      <span className="status-message">
        {message ||
          (shared
            ? "共通ライブラリの下書きです。公開した版を冊子で選択してください。"
            : "変更はプロジェクトに反映済み · ファイル → 保存でバックアップ")}
      </span>
      <span>Space：パン · Shift：複数選択</span>
    </footer>
  );
}
