import {
  SCHEDULE_URL,
  buildFeedbackUrl,
  fetchSchedule,
  findPreviousSession,
  findSession,
  formatSessionTime,
  sessionIdFromLocation,
} from "./schedule.js";

const statusPanel = document.querySelector(".status-panel");
const statusMessage = document.querySelector("#status-message");
const sessionResults = document.querySelector("#session-results");
const currentSlot = document.querySelector("#current-session");
const previousSlot = document.querySelector("#previous-session");
const lookup = document.querySelector("#session-lookup");
const lookupForm = document.querySelector("#lookup-form");
const sessionInput = document.querySelector("#session-id");
const cardTemplate = document.querySelector("#session-card-template");

let sessions = [];

function setStatus(message, state = "loading") {
  statusMessage.textContent = message;
  statusPanel.dataset.state = state;
}

function renderSessionCard(slot, session, label) {
  slot.replaceChildren();
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  card.href = buildFeedbackUrl(session);
  card.setAttribute("aria-label", `${label}：${session.title}。前往填寫回饋`);
  card.querySelector(".session-card__label").textContent = label;
  card.querySelector(".session-card__title").textContent = session.title;
  card.querySelector('[data-field="time"]').textContent = formatSessionTime(session);
  card.querySelector('[data-field="room"]').textContent = session.roomName;
  card.querySelector('[data-field="track"]').textContent = session.trackName;
  slot.append(card);
}

function renderEmptyPrevious() {
  previousSlot.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "empty-card";
  empty.textContent = "這個場地在同一天沒有更早的議程資料。";
  previousSlot.append(empty);
}

function showSession(sessionId) {
  const current = findSession(sessions, sessionId);
  sessionInput.value = sessionId;
  lookup.hidden = false;

  if (!current) {
    sessionResults.hidden = true;
    setStatus(`找不到 session ID「${sessionId}」，請確認後再試一次。`, "error");
    return;
  }

  const previous = findPreviousSession(sessions, current);
  renderSessionCard(currentSlot, current, "目前議程為");
  if (previous) renderSessionCard(previousSlot, previous, "上一場議程為");
  else renderEmptyPrevious();

  sessionResults.hidden = false;
  setStatus("議程資料已更新。點選任一議程即可前往回饋表單。", "ready");
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
    setStatus("請先輸入 session ID。", "error");
    sessionInput.focus();
    return;
  }
  updateSessionInUrl(sessionId);
  showSession(sessionId);
});

async function init() {
  const sessionId = sessionIdFromLocation(window.location);

  try {
    sessions = await fetchSchedule(SCHEDULE_URL);
    if (!sessions.length) throw new Error("議程資料是空的");

    lookup.hidden = false;
    if (sessionId) {
      showSession(sessionId);
    } else {
      setStatus("請在網址加入 ?session=議程ID，或在下方輸入 session ID。", "ready");
      sessionInput.focus();
    }
  } catch (error) {
    lookup.hidden = false;
    setStatus(
      error?.name === "AbortError"
        ? "讀取議程資料逾時，請稍後重新整理頁面。"
        : `暫時無法讀取議程資料：${error.message}`,
      "error",
    );
  }
}

init();
