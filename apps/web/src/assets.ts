import { uid, type Asset } from "../../../packages/core/model";
import { bytesToBase64 } from "../../../packages/project-storage";
function read(file: File): Promise<string> {
  return new Promise((ok, bad) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as string);
    r.onerror = bad;
    r.readAsDataURL(file);
  });
}
async function raster(data: string) {
  const img = new Image();
  img.src = data;
  await img.decode();
  return img;
}
export async function importAsset(
  file: File,
): Promise<{ asset: Asset; warning?: string }> {
  if (file.size > 60 * 1024 * 1024)
    throw new Error("素材は1件60MB以下にしてください。");
  const mime =
    file.type ||
    (/\.pdf$/i.test(file.name)
      ? "application/pdf"
      : /\.svg$/i.test(file.name)
        ? "image/svg+xml"
        : "");
  if (
    ![
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
      "application/pdf",
    ].includes(mime)
  )
    throw new Error("PNG・JPEG・WebP・SVG・PDFを選択してください。");
  const data = await read(file);
  const a: Asset = {
    id: uid(),
    name: file.name,
    mime,
    data,
    width: 1,
    height: 1,
  };
  if (mime === "application/pdf") {
    const [pdfjs, worker] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const doc = await pdfjs.getDocument({
      data: await file.arrayBuffer(),
      isEvalSupported: false,
    }).promise;
    const page = await doc.getPage(1),
      vp = page.getViewport({ scale: 1 });
    a.width = vp.width;
    a.height = vp.height;
    a.pdfPage = 0;
    const view = page.getViewport({ scale: Math.min(1.5, 900 / vp.width) }),
      canvas = document.createElement("canvas");
    canvas.width = view.width;
    canvas.height = view.height;
    await page.render({
      canvasContext: canvas.getContext("2d")!,
      viewport: view,
    }).promise;
    a.preview = canvas.toDataURL("image/png");
    const warning =
      doc.numPages > 1
        ? `${file.name}：全${doc.numPages}ページのうち1ページ目を登録しました。複数ページ素材は事前に分割してください。`
        : undefined;
    await doc.destroy();
    return { asset: a, warning };
  }
  if (mime === "image/svg+xml") {
    const svgText = await file.text(),
      doc = new DOMParser().parseFromString(svgText, "image/svg+xml"),
      svg = doc.documentElement;
    if (svg.nodeName !== "svg" || doc.querySelector("parsererror"))
      throw new Error("SVGを読み取れません。");
    if (doc.querySelector("script,foreignObject,iframe,style,text"))
      throw new Error(
        "SVGのスクリプト・外部スタイル・文字要素は未対応です。文字をパスに変換したSVGまたはPDFをご登録ください。",
      );
    for (const el of [svg, ...svg.querySelectorAll("*")])
      for (const at of el.attributes) {
        if (at.name === "xmlns" || at.name.startsWith("xmlns:")) continue;
        if (
          /^on/i.test(at.name) ||
          /(?:https?:|javascript:|url\(\s*[^#])/i.test(at.value) ||
          ((at.name === "href" || at.name === "xlink:href") &&
            !at.value.startsWith("#"))
        )
          throw new Error("外部参照を含むSVGは登録できません。");
      }
    const view = svg
      .getAttribute("viewBox")
      ?.split(/[\s,]+/)
      .map(Number);
    a.width = view?.[2] || parseFloat(svg.getAttribute("width") || "100");
    a.height = view?.[3] || parseFloat(svg.getAttribute("height") || "100");
    if (!(a.width > 0 && a.height > 0))
      throw new Error("SVGの寸法が不正です。");
    const { jsPDF } = await import("jspdf");
    await import("svg2pdf.js");
    const pdf = new jsPDF({
      unit: "pt",
      format: [a.width, a.height],
      orientation: a.width > a.height ? "landscape" : "portrait",
    });
    await pdf.svg(svg as unknown as SVGElement, {
      x: 0,
      y: 0,
      width: a.width,
      height: a.height,
    });
    a.vectorPdf = `data:application/pdf;base64,${bytesToBase64(new Uint8Array(pdf.output("arraybuffer")))}`;
    return { asset: a };
  }
  const img = await raster(data);
  a.width = img.naturalWidth;
  a.height = img.naturalHeight;
  if (mime === "image/webp") {
    const canvas = document.createElement("canvas");
    canvas.width = a.width;
    canvas.height = a.height;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    a.preview = canvas.toDataURL("image/png");
  }
  return { asset: a };
}
