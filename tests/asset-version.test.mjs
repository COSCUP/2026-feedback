import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ASSET_VERSION = "20260804-focus-4";

test("uses one cache-busting version across page and module assets", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, new RegExp(`styles\\.css\\?v=${ASSET_VERSION}`));
  assert.match(html, new RegExp(`app\\.js\\?v=${ASSET_VERSION}`));
  assert.match(app, new RegExp(`schedule\\.js\\?v=${ASSET_VERSION}`));
});
