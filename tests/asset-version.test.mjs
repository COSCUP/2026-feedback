import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ASSET_VERSION = "20260804-focus-7";

test("uses one cache-busting version across page and module assets", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, new RegExp(`styles\\.css\\?v=${ASSET_VERSION}`));
  assert.match(html, new RegExp(`app\\.js\\?v=${ASSET_VERSION}`));
  assert.match(app, new RegExp(`schedule\\.js\\?v=${ASSET_VERSION}`));
});

test("places the current-session shortcut between previous and next", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const previous = html.indexOf('id="show-previous-session"');
  const current = html.indexOf('id="show-current-session"');
  const next = html.indexOf('id="show-next-session"');

  assert.ok(previous >= 0);
  assert.ok(previous < current);
  assert.ok(current < next);
});

test("defines compact English tags for each session state", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(app, /tag: "Now Online"/);
  assert.match(app, /tag: "Ended"/);
  assert.match(app, /tag: "Upcoming"/);
});
