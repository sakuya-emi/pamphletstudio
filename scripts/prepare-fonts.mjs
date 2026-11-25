import { createReadStream, createWriteStream } from "node:fs";
import { stat, rename, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

await Promise.all(
  ["Medium", "Bold"].map(async (name) => {
    const source = new URL(
      `../public/fonts/NotoSansCJKjp-${name}.ttf`,
      import.meta.url,
    );
    const target = new URL(source.href + ".gz");
    if (
      (await stat(target).catch(() => null))?.mtimeMs >=
      (await stat(source)).mtimeMs
    )
      return;
    const temporary = new URL(target.href + "." + process.pid + ".tmp");
    try {
      await pipeline(
        createReadStream(source),
        createGzip({ level: 9 }),
        createWriteStream(temporary),
      );
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true });
    }
  }),
);
