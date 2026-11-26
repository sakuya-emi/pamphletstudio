import { useEffect, useState } from "react";
export type PdfProgressState = {
  completed: number;
  total: number;
  phase: string;
  startedAt: number;
};
export function PdfProgress({
  state,
  message,
}: {
  state: PdfProgressState | null;
  message: string;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!state) return;
    const tick = () =>
      setElapsed(Math.floor((Date.now() - state.startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state?.startedAt]);
  if (!state) return <span>{message}</span>;
  return (
    <section aria-label="PDF生成の進捗" role="status">
      <p>{message}</p>
      <p>
        {state.phase} ／ 描画済み {state.completed} / {state.total || "計算中"}{" "}
        ページ ／ 経過 {elapsed} 秒
      </p>
      <progress
        aria-label="PDFページ描画"
        value={state.completed}
        max={state.total || 1}
      />
      <p>
        フォントの読み込み・埋め込み中はページ数が0のまま待機します。初回は30秒以上かかる場合があります。
      </p>
    </section>
  );
}
