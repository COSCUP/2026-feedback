import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFeedbackUrl,
  findPreviousSession,
  findSession,
  normalizeSchedule,
  sessionIdFromLocation,
} from "../schedule.js";

const fixture = {
  rooms: [
    { id: "R1", zh: { name: "TR101", description: "" } },
    { id: "R2", zh: { name: "TR102", description: "" } },
  ],
  tags: [
    { id: "track-open", zh: { name: "開源治理", description: "" } },
    { id: "track-data", zh: { name: "開放資料", description: "" } },
  ],
  sessions: [
    {
      id: "PREVIOUS",
      zh: { title: "上一場議程", description: "" },
      room: "R1",
      tags: ["track-open"],
      start: "2026-08-08T10:00:00+08:00",
      end: "2026-08-08T10:30:00+08:00",
    },
    {
      id: "CURRENT",
      zh: { title: "目前議程", description: "" },
      room: "R1",
      tags: ["track-open"],
      start: "2026-08-08T10:45:00+08:00",
      end: "2026-08-08T11:15:00+08:00",
    },
    {
      id: "OTHER_ROOM",
      zh: { title: "另一間教室", description: "" },
      room: "R2",
      tags: ["track-data"],
      start: "2026-08-08T10:30:00+08:00",
      end: "2026-08-08T11:00:00+08:00",
    },
    {
      id: "OTHER_DAY",
      zh: { title: "隔天同教室", description: "" },
      room: "R1",
      tags: ["track-open"],
      start: "2026-08-09T09:00:00+08:00",
      end: "2026-08-09T09:30:00+08:00",
    },
  ],
};

test("normalizes OPass session, room and track data", () => {
  const sessions = normalizeSchedule(fixture);
  const current = findSession(sessions, "CURRENT");
  assert.equal(current.title, "目前議程");
  assert.equal(current.roomName, "TR101");
  assert.equal(current.trackName, "開源治理");
});

test("finds the closest earlier session in the same room and day", () => {
  const sessions = normalizeSchedule(fixture);
  const current = findSession(sessions, "CURRENT");
  assert.equal(findPreviousSession(sessions, current)?.id, "PREVIOUS");
});

test("builds a Google Forms prefilled URL", () => {
  const sessions = normalizeSchedule(fixture);
  const current = findSession(sessions, "CURRENT");
  const url = new URL(buildFeedbackUrl(current));
  assert.equal(url.searchParams.get("entry.1246257474"), "目前議程");
  assert.equal(url.searchParams.get("entry.2060906697"), "開源治理");
  assert.equal(url.searchParams.get("usp"), "pp_url");
});

test("accepts the primary and compatibility URL parameters", () => {
  assert.equal(
    sessionIdFromLocation({ href: "https://example.test/?session=CURRENT" }),
    "CURRENT",
  );
  assert.equal(sessionIdFromLocation({ href: "https://example.test/?id=PREVIOUS" }), "PREVIOUS");
  assert.equal(sessionIdFromLocation({ href: "https://example.test/#OTHER_ROOM" }), "OTHER_ROOM");
});
