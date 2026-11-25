import { loadFontBytes } from "./font-files";
import { exportPDF } from "./index";
import type { Project } from "../core/model";
self.onmessage = async (e: MessageEvent<Project>) => {
  try {
    const fonts = await loadFontBytes();
    const result = await exportPDF(e.data, fonts, (progress) =>
      self.postMessage({ progress }),
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
