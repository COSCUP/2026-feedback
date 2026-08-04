import {
  SCHEDULE_URL,
  buildFeedbackUrl,
  fetchSchedule,
  fetchTrackName,
  findNextSession,
  findPreviousSession,
  findSession,
  formatSessionTime,
  sessionIdFromLocation,
} from "./schedule.js?v=20260804-focus-7";

const LANGS = ["zh-Hant", "en", "ja", "ko"];

const copy = {
  current: ["當下議程", "Current session", "現在のセッション", "현재 세션"],
  previous: ["已過議程", "Previous session", "終了したセッション", "종료된 세션"],
  next: ["尚未開始", "Next session", "開始前のセッション", "시작 전 세션"],
  openForm: [
    "填寫這場議程的回饋",
    "Give feedback for this session",
    "このセッションにフィードバック",
    "이 세션에 피드백 남기기",
  ],
  trackUnavailable: [
    "議程軌暫時無法載入（表單不會誤填語言）",
    "Track unavailable (language will not be used by mistake)",
    "トラックを取得できません（言語を誤入力しません）",
    "트랙을 불러올 수 없음 (언어를 잘못 입력하지 않음)",
  ],
};

const sessionStatuses = {
  current: { key: "current", tag: "Now Online", labels: copy.current },
  previous: { key: "previous", tag: "Ended", labels: copy.previous },
  next: { key: "next", tag: "Upcoming", labels: copy.next },
};

const statusPanel = document.querySelector(".status-panel");
const statusMessage = document.querySelector("#status-message");
const sessionResults = document.querySelector("#session-results");
const previousButton = document.querySelector("#show-previous-session");
const currentButton = document.querySelector("#show-current-session");
const nextButton = document.querySelector("#show-next-session");
const selectedSlot = document.querySelector("#selected-session");
const lookup = document.querySelector("#session-lookup");
const lookupForm = document.querySelector("#lookup-form");
const sessionInput = document.querySelector("#session-id");
const lookupButton = lookupForm.querySelector('button[type="submit"]');
const cardTemplate = document.querySelector("#session-card-template");

let sessions = [];
let renderVersion = 0;
let anchorSession = null;

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

function addSessionStatus(container, status) {
  container.replaceChildren();
  const tag = document.createElement("span");
  tag.className = "session-card__status-tag";
  tag.lang = "en";
  tag.textContent = status.tag;
  container.append(tag);

  status.labels.forEach((line, index) => {
    const span = document.createElement("span");
    span.className = "language-line";
    span.lang = LANGS[index];
    span.textContent = line;
    container.append(span);
  });
}

function renderSessionCard(slot, session, status) {
  slot.replaceChildren();
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  card.classList.toggle("is-current", status.key === "current");
  card.dataset.status = status.key;
  card.href = buildFeedbackUrl(session);
  card.target = "_blank";
  card.rel = "noreferrer";
  card.setAttribute(
    "aria-label",
    `${status.labels.join(" / ")}：${session.title}。${copy.openForm.join(" / ")}`,
  );
  addSessionStatus(card.querySelector(".session-card__label"), status);
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

function sessionStatus(session) {
  if (!anchorSession || session.id === anchorSession.id) return sessionStatuses.current;
  if (session.startAt < anchorSession.startAt) return sessionStatuses.previous;
  return sessionStatuses.next;
}

function updateNavigation(session) {
  const previous = findPreviousSession(sessions, session);
  const next = findNextSession(sessions, session);
  previousButton.disabled = !previous;
  currentButton.disabled = session.id === anchorSession?.id;
  nextButton.disabled = !next;
  previousButton.dataset.sessionId = previous?.id ?? "";
  nextButton.dataset.sessionId = next?.id ?? "";
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

async function displaySession(source) {
  const version = ++renderVersion;
  previousButton.disabled = true;
  currentButton.disabled = true;
  nextButton.disabled = true;
  setStatus([
    "正在向官方議程頁核對議程軌…",
    "Checking the track against the official program…",
    "公式プログラムでトラックを確認しています…",
    "공식 프로그램에서 트랙을 확인하고 있습니다…",
  ]);

  const session = await hydrateTrack(source);
  if (version !== renderVersion) return;

  renderSessionCard(selectedSlot, session, sessionStatus(session));
  updateNavigation(source);
  sessionResults.hidden = false;
  if (!session.trackName) {
    setStatus(
      [
        "議程已載入；議程軌無法取得，表單將保留空白供確認。",
        "Session loaded; the unavailable track is left blank for confirmation.",
        "セッションを読み込みました。取得できないトラックは確認用に空欄にします。",
        "세션을 불러왔습니다. 확인할 수 없는 트랙은 빈칸으로 둡니다.",
      ],
      "error",
    );
  } else {
    statusPanel.hidden = true;
  }
}

async function showSession(sessionId) {
  const currentSource = findSession(sessions, sessionId);
  document.body.dataset.mode = currentSource ? "results" : "lookup";
  sessionInput.value = sessionId;
  lookup.hidden = Boolean(currentSource);

  if (!currentSource) {
    ++renderVersion;
    anchorSession = null;
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

  anchorSession = currentSource;
  await displaySession(currentSource);
}

function navigateFrom(button) {
  const target = findSession(sessions, button.dataset.sessionId);
  if (target) void displaySession(target);
}

previousButton.addEventListener("click", () => navigateFrom(previousButton));
currentButton.addEventListener("click", () => {
  if (anchorSession) void displaySession(anchorSession);
});
nextButton.addEventListener("click", () => navigateFrom(nextButton));

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
  lookup.hidden = Boolean(sessionId);
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
