import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFeedbackUrl,
  fetchTrackName,
  findPreviousSession,
  findSession,
  normalizeSchedule,
  sessionIdFromLocation,
  trackNameFromSessionHtml,
} from "../schedule.js";

const fixture = {
  rooms: [
    { id: "R1", zh: { name: "TR101", description: "" } },
    { id: "R2", zh: { name: "TR102", description: "" } },
  ],
  tags: [
    { id: "language_zhtw", zh: { name: "漢語", description: "" } },
    { id: "difficulty_elementary", zh: { name: "入門", description: "" } },
  ],
  speakers: [
    { id: "SPEAKER_A", zh: { name: "講者甲", bio: "" } },
    { id: "SPEAKER_B", zh: { name: "講者乙", bio: "" } },
  ],
  sessions: [
    {
      id: "PREVIOUS",
      zh: { title: "上一場議程", description: "" },
      room: "R1",
      tags: ["language_zhtw", "difficulty_elementary"],
      speakers: ["SPEAKER_A"],
      start: "2026-08-08T10:00:00+08:00",
      end: "2026-08-08T10:30:00+08:00",
    },
    {
      id: "CURRENT",
      zh: { title: "目前議程", description: "" },
      room: "R1",
      tags: ["language_zhtw", "difficulty_elementary"],
      speakers: ["SPEAKER_A", "SPEAKER_B"],
      start: "2026-08-08T10:45:00+08:00",
      end: "2026-08-08T11:15:00+08:00",
    },
    {
      id: "OTHER_ROOM",
      zh: { title: "另一間教室", description: "" },
      room: "R2",
      tags: ["language_zhtw"],
      speakers: ["SPEAKER_B"],
      start: "2026-08-08T10:30:00+08:00",
      end: "2026-08-08T11:00:00+08:00",
    },
    {
      id: "OTHER_DAY",
      zh: { title: "隔天同教室", description: "" },
      room: "R1",
      tags: ["language_zhtw"],
      speakers: ["SPEAKER_A"],
      start: "2026-08-09T09:00:00+08:00",
      end: "2026-08-09T09:30:00+08:00",
    },
  ],
};

test("normalizes OPass session, room and speaker data without treating language as track", () => {
  const sessions = normalizeSchedule(fixture);
  const current = findSession(sessions, "CURRENT");
  assert.equal(current.title, "目前議程");
  assert.equal(current.roomName, "TR101");
  assert.deepEqual(current.speakerNames, ["講者甲", "講者乙"]);
  assert.equal(current.trackName, "");
});

test("finds the closest earlier session in the same room and day", () => {
  const sessions = normalizeSchedule(fixture);
  const current = findSession(sessions, "CURRENT");
  assert.equal(findPreviousSession(sessions, current)?.id, "PREVIOUS");
});

test("builds a Google Forms prefilled URL", () => {
  const sessions = normalizeSchedule(fixture);
  const current = findSession(sessions, "CURRENT");
  const url = new URL(buildFeedbackUrl({ ...current, trackName: "開源治理" }));
  assert.equal(url.searchParams.get("entry.1246257474"), "目前議程");
  assert.equal(url.searchParams.get("entry.2060906697"), "開源治理");
  assert.equal(url.searchParams.get("usp"), "pp_url");
});

test("leaves track blank instead of pre-filling a language tag", () => {
  const current = findSession(normalizeSchedule(fixture), "CURRENT");
  const url = new URL(buildFeedbackUrl(current));
  assert.equal(url.searchParams.get("entry.2060906697"), null);
});

test("extracts the authoritative track from the public session page", () => {
  const html = `
    <article>
      <a href="/2026/track/541" class="track">臺灣自由軟體在地化社群 <span>↗</span></a>
    </article>
  `;
  assert.equal(trackNameFromSessionHtml(html), "臺灣自由軟體在地化社群");
});

test("fetches a missing track from the official session detail URL", async () => {
  const current = findSession(normalizeSchedule(fixture), "CURRENT");
  let requestedUrl = "";
  const trackName = await fetchTrackName(current, {
    sessionPageRoot: "https://example.test/2026/session/",
    fetchImpl: async (url) => {
      requestedUrl = url.toString();
      return {
        ok: true,
        text: async () => '<a href="/2026/track/99">Open Web &amp; Data</a>',
      };
    },
  });
  assert.equal(requestedUrl, "https://example.test/2026/session/CURRENT/");
  assert.equal(trackName, "Open Web & Data");
});

test("accepts the primary and compatibility URL parameters", () => {
  assert.equal(
    sessionIdFromLocation({ href: "https://example.test/?session=CURRENT" }),
    "CURRENT",
  );
  assert.equal(sessionIdFromLocation({ href: "https://example.test/?id=PREVIOUS" }), "PREVIOUS");
  assert.equal(sessionIdFromLocation({ href: "https://example.test/#OTHER_ROOM" }), "OTHER_ROOM");
});
