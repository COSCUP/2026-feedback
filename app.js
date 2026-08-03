import {
  SCHEDULE_URL,
  buildFeedbackUrl,
  fetchSchedule,
  fetchTrackName,
  findPreviousSession,
  findSession,
  formatSessionTime,
  sessionIdFromLocation,
} from "./schedule.js";

const LANGS = ["zh-Hant", "en", "ja", "ko"];

const copy = {
  current: ["目前議程", "Current session", "現在のセッション", "현재 세션"],
  previous: ["上一場議程", "Previous session", "前のセッション", "이전 세션"],
  openForm: ["前往填寫回饋", "Open feedback form", "フィードバックを記入", "피드백 작성"],
  noPrevious: [
    "這個場地在同一天沒有更早的議程資料。",
    "No earlier session was found in this room on the same day.",
    "同じ日のこの会場に、これより前のセッションはありません。",
    "같은 날 이 장소에서 더 이른 세션을 찾지 못했습니다.",
  ],
  trackUnavailable: [
    "議程軌暫時無法載入（表單不會誤填語言）",
    "Track unavailable (language will not be used by mistake)",
    "トラックを取得できません（言語を誤入力しません）",
    "트랙을 불러올 수 없음 (언어를 잘못 입력하지 않음)",
  ],
};

const statusPanel = document.querySelector(".status-panel");
const statusMessage = document.querySelector("#status-message");
const sessionResults = document.querySelector("#session-results");
const currentSlot = document.querySelector("#current-session");
const previousSlot = document.querySelector("#previous-session");
const lookup = document.querySelector("#session-lookup");
const lookupForm = document.querySelector("#lookup-form");
const sessionInput = document.querySelector("#session-id");
const lookupButton = lookupForm.querySelector('button[type="submit"]');
const cardTemplate = document.querySelector("#session-card-template");

let sessions = [];
let renderVersion = 0;

function addLanguageLines(container, lines, className = "language-line") {
  container.replaceChildren();
  lines.forEach((line, index) => {
    const span = document.createElement("span");
    span.className = className;
    span.lang = LANGS[index];
    span.textContent = line;
    container.append(span);
  });
}

function setStatus(lines, state = "loading") {
  statusPanel.hidden = false;
  addLanguageLines(statusMessage, lines, "status-line");
  statusPanel.dataset.state = state;
}

function renderSessionCard(slot, session, labels) {
  slot.replaceChildren();
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  card.href = buildFeedbackUrl(session);
  card.target = "_blank";
  card.rel = "noreferrer";
  card.setAttribute(
    "aria-label",
    `${labels.join(" / ")}：${session.title}。${copy.openForm.join(" / ")}`,
  );
  addLanguageLines(card.querySelector(".session-card__label"), labels);
  card.querySelector(".session-card__title").textContent = session.title;
  card.querySelector('[data-field="time"]').textContent = formatSessionTime(session);
  card.querySelector('[data-field="room"]').textContent = session.roomName;
  card.querySelector('[data-field="speaker"]').textContent =
    session.speakerNames.length ? session.speakerNames.join("、") : "—";

  const trackField = card.querySelector('[data-field="track"]');
  if (session.trackName) {
    trackField.textContent = session.trackName;
  } else {
    addLanguageLines(trackField, copy.trackUnavailable, "meta-language-line");
    trackField.classList.add("is-missing");
  }
  slot.append(card);
}

function renderEmptyPrevious() {
  previousSlot.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "empty-card";
  addLanguageLines(empty, copy.noPrevious);
  previousSlot.append(empty);
}

async function hydrateTrack(session) {
  if (!session) return null;
  try {
    const trackName = await fetchTrackName(session);
    return { ...session, trackName };
  } catch (error) {
    console.warn(`Unable to load the track for ${session.id}`, error);
    return { ...session, trackName: "" };
  }
}

async function showSession(sessionId) {
  const version = ++renderVersion;
  const currentSource = findSession(sessions, sessionId);
  document.body.dataset.mode = currentSource ? "results" : "lookup";
  sessionInput.value = sessionId;
  lookup.hidden = false;

  if (!currentSource) {
    sessionResults.hidden = true;
    setStatus(
      [
        `找不到 session ID「${sessionId}」，請確認後再試一次。`,
        `Session ID “${sessionId}” was not found. Please check it and try again.`,
        `セッション ID「${sessionId}」が見つかりません。確認してもう一度お試しください。`,
        `세션 ID “${sessionId}”을(를) 찾을 수 없습니다. 확인 후 다시 시도해 주세요.`,
      ],
      "error",
    );
    return;
  }

  setStatus([
    "正在向官方議程頁核對議程軌…",
    "Checking the track against the official program…",
    "公式プログラムでトラックを確認しています…",
    "공식 프로그램에서 트랙을 확인하고 있습니다…",
  ]);

  const previousSource = findPreviousSession(sessions, currentSource);
  const [current, previous] = await Promise.all([
    hydrateTrack(currentSource),
    hydrateTrack(previousSource),
  ]);
  if (version !== renderVersion) return;

  renderSessionCard(currentSlot, current, copy.current);
  if (previous) renderSessionCard(previousSlot, previous, copy.previous);
  else renderEmptyPrevious();

  sessionResults.hidden = false;
  const hasMissingTrack = !current.trackName || (previous && !previous.trackName);
  if (hasMissingTrack) {
    setStatus(
      [
        "議程已載入；部分議程軌無法取得，表單將保留空白供確認。",
        "Sessions loaded; unavailable tracks are left blank for confirmation.",
        "セッションを読み込みました。取得できないトラックは確認用に空欄にします。",
        "세션을 불러왔습니다. 확인할 수 없는 트랙은 빈칸으로 둡니다.",
      ],
      "error",
    );
  } else {
    statusPanel.hidden = true;
  }
}

function updateSessionInUrl(sessionId) {
  const url = new URL(window.location.href);
  url.searchParams.set("session", sessionId);
  url.searchParams.delete("id");
  url.searchParams.delete("session_id");
  url.searchParams.delete("sessionId");
  url.hash = "";
  window.history.replaceState({}, "", url);
}

lookupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const sessionId = sessionInput.value.trim();
  if (!sessionId) {
    setStatus(
      [
        "請先輸入 session ID。",
        "Enter a session ID first.",
        "先にセッション ID を入力してください。",
        "먼저 세션 ID를 입력해 주세요.",
      ],
      "error",
    );
    sessionInput.focus();
    return;
  }
  updateSessionInUrl(sessionId);
  void showSession(sessionId);
});

async function init() {
  const sessionId = sessionIdFromLocation(window.location);
  document.body.dataset.mode = sessionId ? "results" : "lookup";
  lookup.hidden = false;
  lookupButton.disabled = true;

  try {
    sessions = await fetchSchedule(SCHEDULE_URL);
    if (!sessions.length) throw new Error("議程資料是空的");

    lookupButton.disabled = false;
    if (sessionId) {
      await showSession(sessionId);
    } else {
      statusPanel.hidden = true;
      sessionInput.focus();
    }
  } catch (error) {
    const timeout = error?.name === "AbortError";
    setStatus(
      timeout
        ? [
            "讀取議程資料逾時，請稍後重新整理頁面。",
            "Loading the program timed out. Please refresh later.",
            "プログラムの読み込みがタイムアウトしました。後でもう一度お試しください。",
            "프로그램 로딩 시간이 초과되었습니다. 잠시 후 새로고침해 주세요.",
          ]
        : [
            `暫時無法讀取議程資料：${error.message}`,
            "The program is temporarily unavailable.",
            "現在プログラムを読み込めません。",
            "현재 프로그램을 불러올 수 없습니다.",
          ],
      "error",
    );
  }
}

void init();
