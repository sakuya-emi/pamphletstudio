import { loadFontBytes } from "./font-files";
import { exportPDF } from "./index";
import type { Project } from "../core/model";
self.onmessage = async (e: MessageEvent<Project>) => {
  try {
    self.postMessage({
      phase: "フォントを読み込み中…（初回は30秒以上かかる場合があります）",
    });
    const fonts = await loadFontBytes();
    self.postMessage({
      phase:
        "組版とフォント埋め込みを準備中…（初回は30秒以上かかる場合があります）",
    });
    const result = await exportPDF(e.data, fonts, undefined, (status) =>
      self.postMessage({ status }),
    );
    self.postMessage(
      { bytes: result.bytes, pageCount: result.layout.pages.length },
      { transfer: [result.bytes.buffer as ArrayBuffer] },
    );
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
