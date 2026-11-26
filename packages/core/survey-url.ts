/** Use the same normalized URL in Excel previews and the printed QR code. */
export function normalizeSurveyUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(
      "アンケートURLは https:// または http:// で始まるURLを入力してください。",
    );
  }
  if (!["https:", "http:"].includes(url.protocol) || !url.hostname)
    throw new Error(
      "アンケートURLは https:// または http:// で始まるURLを入力してください。",
    );
  if (url.href.length > 2048)
    throw new Error(
      "アンケートURLは2048文字以下にしてください。短い共有URLも使えます。",
    );
  return url.href;
}
