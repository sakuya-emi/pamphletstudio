/** Fetch the same TTF bytes for preview and PDF, compressed in transit where supported. */
async function loadFont(
  name: "Medium" | "Bold",
): Promise<Uint8Array<ArrayBuffer>> {
  const url = `${import.meta.env.BASE_URL}fonts/NotoSansCJKjp-${name}.ttf`;
  if (typeof DecompressionStream !== "undefined") {
    try {
      const response = await fetch(url + ".gz");
      if (response.ok && response.body) {
        const stream = response.body.pipeThrough(
          new DecompressionStream("gzip"),
        );
        return new Uint8Array(await new Response(stream).arrayBuffer());
      }
    } catch {
      // Old deployments or hosts that transparently decode .gz can use the original.
    }
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error("埋め込みフォントを読み込めません。");
  return new Uint8Array(await response.arrayBuffer());
}

export async function loadFontBytes() {
  const [medium, bold] = await Promise.all([
    loadFont("Medium"),
    loadFont("Bold"),
  ]);
  return { medium, bold };
}
