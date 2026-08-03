export const SCHEDULE_URL = "https://coscup.org/2026/api/opass.json";

export const FORM_CONFIG = Object.freeze({
  baseUrl:
    "https://docs.google.com/forms/d/e/1FAIpQLSdZo95aSE3XKTxmkNiIuT9UCb8KYXuzISmMBdCrCklVb8Hptg/viewform",
  titleEntry: "entry.1246257474",
  trackEntry: "entry.2060906697",
});

const TAIPEI_TIME_ZONE = "Asia/Taipei";

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function localizedText(value, key = "name") {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();

  if (typeof value === "object") {
    return String(
      firstValue(
        value.zh?.[key],
        value["zh-Hant"]?.[key],
        value.zh_TW?.[key],
        value.zh?.title,
        value.zh?.name,
        value[key],
        value.title,
        value.name,
        value.en?.[key],
        value.en?.title,
        value.en?.name,
        "",
      ),
    ).trim();
  }

  return "";
}

function referenceId(value) {
  if (value && typeof value === "object") {
    return String(firstValue(value.id, value.code, value.value, ""));
  }
  return value === undefined || value === null ? "" : String(value);
}

function collectionIndex(collection) {
  const index = new Map();
  for (const item of asArray(collection)) {
    const id = referenceId(item);
    if (id) index.set(id, item);
  }
  return index;
}

function resolveName(value, index, key = "name") {
  if (value && typeof value === "object") return localizedText(value, key);
  const id = referenceId(value);
  return localizedText(index.get(id), key) || id;
}

function toEpoch(value) {
  if (typeof value === "number") {
    return value < 10_000_000_000 ? value * 1000 : value;
  }

  if (typeof value !== "string" || !value.trim()) return Number.NaN;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && /^\d+(\.\d+)?$/.test(value.trim())) {
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }

  return Date.parse(value);
}

function taipeiDateKey(epoch) {
  if (!Number.isFinite(epoch)) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIPEI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(epoch);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function resolveTrackName(session, tagsIndex, sessionTypesIndex) {
  const direct = firstValue(
    session.track_name,
    session.trackName,
    session.community_name,
    session.communityName,
    session.community,
    session.track,
  );
  const directName = localizedText(direct, "name");
  if (directName) return directName;

  const trackId = firstValue(session.track_id, session.trackId, session.community_id);
  if (trackId) {
    const resolved =
      resolveName(trackId, tagsIndex, "name") || resolveName(trackId, sessionTypesIndex, "name");
    if (resolved) return resolved;
  }

  const tagNames = asArray(session.tags ?? session.tag)
    .map((tag) => resolveName(tag, tagsIndex, "name"))
    .filter(Boolean);

  return tagNames[0] || "未標示議程軌";
}

export function normalizeSchedule(rawData) {
  const data = rawData?.data && !rawData.sessions ? rawData.data : rawData;
  const sessions = asArray(data?.sessions ?? data?.session ?? data?.schedule);
  const roomsIndex = collectionIndex(data?.rooms ?? data?.room);
  const tagsIndex = collectionIndex(data?.tags ?? data?.tracks ?? data?.communities);
  const sessionTypesIndex = collectionIndex(data?.session_types ?? data?.sessionTypes);

  return sessions
    .map((session, sourceIndex) => {
      const id = String(
        firstValue(
          session.id,
          session.session_id,
          session.sessionId,
          session.code,
          session.proposal_code,
          "",
        ),
      ).trim();
      const roomValue = firstValue(
        session.room,
        session.room_id,
        session.roomId,
        session.venue,
        session.location,
      );
      const roomId = referenceId(roomValue);
      const roomName = resolveName(roomValue, roomsIndex, "name") || "未標示場地";
      const startAt = toEpoch(
        firstValue(session.start, session.start_at, session.startAt, session.begin),
      );
      const endAt = toEpoch(firstValue(session.end, session.end_at, session.endAt, session.finish));

      return {
        id,
        sourceIndex,
        title:
          localizedText(session, "title") ||
          localizedText(session.title, "title") ||
          "未命名議程",
        trackName: resolveTrackName(session, tagsIndex, sessionTypesIndex),
        roomId,
        roomName,
        startAt,
        endAt,
        dateKey: taipeiDateKey(startAt),
        raw: session,
      };
    })
    .filter((session) => session.id);
}

export function findSession(sessions, sessionId) {
  const target = String(sessionId ?? "").trim();
  if (!target) return null;
  return sessions.find((session) => session.id === target) ?? null;
}

export function findPreviousSession(sessions, currentSession) {
  if (!currentSession) return null;

  const sameRoom = (session) => {
    if (currentSession.roomId && session.roomId) return session.roomId === currentSession.roomId;
    return session.roomName === currentSession.roomName;
  };

  if (Number.isFinite(currentSession.startAt)) {
    return (
      sessions
        .filter(
          (session) =>
            session.id !== currentSession.id &&
            sameRoom(session) &&
            session.dateKey === currentSession.dateKey &&
            Number.isFinite(session.startAt) &&
            session.startAt < currentSession.startAt,
        )
        .sort((a, b) => b.startAt - a.startAt)[0] ?? null
    );
  }

  return (
    sessions
      .filter(
        (session) =>
          session.id !== currentSession.id &&
          sameRoom(session) &&
          session.sourceIndex < currentSession.sourceIndex,
      )
      .sort((a, b) => b.sourceIndex - a.sourceIndex)[0] ?? null
  );
}

export function buildFeedbackUrl(session, config = FORM_CONFIG) {
  const url = new URL(config.baseUrl);
  url.searchParams.set("usp", "pp_url");
  url.searchParams.set(config.titleEntry, session.title);
  url.searchParams.set(config.trackEntry, session.trackName);
  return url.toString();
}

export function sessionIdFromLocation(locationLike) {
  const url = new URL(locationLike.href);
  const value = firstValue(
    url.searchParams.get("session"),
    url.searchParams.get("id"),
    url.searchParams.get("session_id"),
    url.searchParams.get("sessionId"),
    url.hash ? decodeURIComponent(url.hash.slice(1)) : "",
  );
  return String(value ?? "").trim();
}

export async function fetchSchedule(
  url = SCHEDULE_URL,
  { fetchImpl = fetch, timeoutMs = 12_000 } = {},
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`讀取議程資料失敗（HTTP ${response.status}）`);
    return normalizeSchedule(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

export function formatSessionTime(session) {
  if (!Number.isFinite(session.startAt)) return "時間未定";

  const date = new Intl.DateTimeFormat("zh-TW", {
    timeZone: TAIPEI_TIME_ZONE,
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(session.startAt);
  const timeFormatter = new Intl.DateTimeFormat("zh-TW", {
    timeZone: TAIPEI_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const start = timeFormatter.format(session.startAt);
  const end = Number.isFinite(session.endAt) ? timeFormatter.format(session.endAt) : "";
  return `${date} ${start}${end ? `–${end}` : ""}`;
}
