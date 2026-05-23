import { CHAT_STEPS, advanceChat, OPEN_TEXT_STEP_IDS } from "./symptomChat.js";
import { getSupportReply, probeAiChat, resetAiProbe, getLastAiError } from "./aiChat.js";
import { parseSupportTabFromHash } from "./betweenVisitHome.js";
import {
  DISMISSAL_STARTERS,
  DISMISSAL_STEP_IDS,
  getDismissalIntro,
  renderDismissalAdvocacyPanel,
} from "./dismissalSupport.js";
import { setSupportCollected, addVisitQuestion } from "./betweenVisitStore.js";
import { autoCollectVisitQuestions } from "./visitQuestions.js";
import { syncBetweenVisitSnapshot } from "./sessionManager.js";
import { renderAiNotCounsellorBanner, renderHumanSupportFootnote } from "./humanSupportLadder.js";

const EMOTIONAL_STEP_IDS = new Set([
  "emotionalIntro",
  "stressLevel",
  "toldJustStress",
  "embarrassed",
  "emotionalBurden",
  "emotionalText",
]);

const JOURNEY_STEP_IDS = new Set([
  "journeyIntro",
  "concernDuration",
  "careDelay",
  "supportNetwork",
  "visitGoal",
  "oneThingForDoctor",
  "checkinBridge",
]);

const SUPPORT_STARTERS = [
  "I feel overwhelmed and stressed about my health",
  "I was told it is just stress but I do not feel better",
  "I am embarrassed to talk to a doctor about this",
  "I am scared something is wrong and no one believes me",
];

const HARD_TO_SAY_STARTERS = [
  "I am ashamed to talk about periods or body changes",
  "I am grieving what this might mean for my future",
  "I feel alone even when people try to help",
  "I do not know if my symptoms are real enough to mention",
];

const ENTRY_TABS = [
  { id: "feelings", title: "Feelings", desc: "Fear, grief, confusion, overload" },
  { id: "visitprep", title: "Visit prep", desc: "Goals and what to ask next" },
  { id: "dismissal", title: "Hard to say", desc: "Dismissed or not believed" },
  { id: "open", title: "Open chat", desc: "Write freely in your own words" },
];

function stepIndexById(id) {
  return CHAT_STEPS.findIndex((s) => s.id === id);
}

function isOpenTextStep(stepId) {
  return OPEN_TEXT_STEP_IDS.has(stepId);
}

function guidedSectionLabel(step) {
  if (!step) return "";
  if (EMOTIONAL_STEP_IDS.has(step.id)) {
    return `<p class="chat-section-label">How you feel</p>`;
  }
  if (JOURNEY_STEP_IDS.has(step.id)) {
    return `<p class="chat-section-label">Care journey &amp; your visit</p>`;
  }
  return "";
}

function firstStepIndexForTab(tab) {
  if (tab === "feelings") return stepIndexById("emotionalIntro");
  if (tab === "visitprep") return stepIndexById("journeyIntro");
  if (tab === "dismissal") return stepIndexById("toldJustStress");
  return 0;
}

/**
 * @param {HTMLElement} root
 * @param {object} deps
 */
export async function mountPatientChat(root, deps) {
  const {
    session,
    renderHeader,
    bindLogout,
    escapeHtml,
    isApiMode,
    fetchChatMessagesUnified,
    appendChatMessageUnified,
    clearChatUnified,
  } = deps;

  let messages = [];
  try {
    messages = await fetchChatMessagesUnified(session);
  } catch {
    messages = [];
  }

  let entryTab = parseSupportTabFromHash() || "feelings";
  if (!ENTRY_TABS.some((t) => t.id === entryTab)) entryTab = "feelings";

  let stepIndex = firstStepIndexForTab(entryTab === "open" ? "feelings" : entryTab);
  let collected = {};
  let uiMode = entryTab === "open" ? "support" : "guided";
  let aiOn = false;
  let busy = false;

  resetAiProbe();
  if (isApiMode()) {
    aiOn = await probeAiChat(true);
  }

  const chatHistory = () => messages.map((m) => ({ role: m.role, text: m.text }));

  const persistCollected = async () => {
    setSupportCollected(session.patientId, collected);
    autoCollectVisitQuestions(session.patientId, {
      supportCollected: collected,
      oneThing: collected.oneThingForDoctor || "",
    });
    await syncBetweenVisitSnapshot(session);
  };

  const renderChatUi = () => {
    const step = CHAT_STEPS[stepIndex];
    const logHtml = messages
      .map((m) => {
        const roleLabel = m.role === "bot" && m.support ? "support" : m.role;
        const supportClass = m.support ? " chat-support" : "";
        return `<div class="chat-bubble chat-${escapeHtml(m.role)}${supportClass}"><span class="chat-role">${escapeHtml(roleLabel)}</span>${escapeHtml(m.text)}</div>`;
      })
      .join("");

    const aiBadge = aiOn
      ? `<span class="badge badge-ai">AI support on</span>`
      : `<span class="badge badge-ai-off">Built-in replies. Personalized AI support is available when enabled on the server.</span>`;

    const entryTabsHtml = ENTRY_TABS.map((t) => {
      const active = (t.id === "open" && uiMode === "support") || (t.id !== "open" && uiMode === "guided" && entryTab === t.id);
      return `<button type="button" class="support-entry-tab${active ? " is-active" : ""}" data-entry-tab="${escapeHtml(t.id)}" role="tab" aria-selected="${active}">
        <span class="support-entry-title">${escapeHtml(t.title)}</span>
        <span class="support-entry-desc">${escapeHtml(t.desc)}</span>
      </button>`;
    }).join("");

    const guidedPanel =
      uiMode === "guided"
        ? step && step.type !== "done"
          ? `<div class="support-step-panel">
              ${entryTab === "dismissal" ? renderDismissalAdvocacyPanel(escapeHtml) : ""}
              ${guidedSectionLabel(step)}
              <p class="chat-bot-line">${escapeHtml(step.bot)}</p>
              ${
                step.type === "choice"
                  ? `<div class="chat-choices">${step.options
                      .map(
                        (o) =>
                          `<button type="button" class="btn btn-ghost chat-choice" data-value="${escapeHtml(o.value)}" ${busy ? "disabled" : ""}>${escapeHtml(o.label)}</button>`
                      )
                      .join("")}</div>`
                  : ""
              }
              ${
                step.type === "text"
                  ? `<form id="chatTextForm" class="chat-text-form ${
                      isOpenTextStep(step.id) ? "chat-text-form-wide" : ""
                    }">${
                      isOpenTextStep(step.id)
                        ? `<textarea id="chatText" rows="3" placeholder="${
                            step.id === "oneThingForDoctor"
                              ? "e.g. I need you to know how much this affects my work and relationships…"
                              : "e.g. work pressure, fear of diagnosis, feeling alone…"
                          }" maxlength="2000" ${busy ? "disabled" : ""}></textarea>`
                        : `<input type="text" id="chatText" placeholder="Optional message" maxlength="500" ${busy ? "disabled" : ""} />`
                    }<button class="btn btn-primary" type="submit" ${busy ? "disabled" : ""}>Send</button></form>`
                  : ""
              }
              ${
                step.type === "continue"
                  ? `<button type="button" class="btn btn-primary" id="chatContinue" ${busy ? "disabled" : ""}>${
                      step.id === "welcome" ? "Start" : "Continue"
                    }</button>`
                  : ""
              }
            </div>`
          : `<p class="muted">You have finished this flow. Try another tab, switch to <strong>Open chat</strong>, or build your <a href="#/patient/visit-brief">Visit brief</a>.</p>`
        : "";

    const starters = entryTab === "dismissal" ? DISMISSAL_STARTERS : entryTab === "open" ? HARD_TO_SAY_STARTERS : SUPPORT_STARTERS;

    const supportPanel =
      uiMode === "support"
        ? `<div class="support-step-panel">
          <p class="muted support-panel-intro">Write in your own words. Pick a starter below or type your message.</p>
          <div class="chat-starters">${starters.map(
            (s) =>
              `<button type="button" class="btn btn-ghost chat-starter" data-starter="${escapeHtml(s)}" ${busy ? "disabled" : ""}>${escapeHtml(s)}</button>`
          ).join("")}</div>
          <form id="supportChatForm" class="chat-text-form chat-support-form">
            <label class="sr-only" for="supportChatInput">Your message</label>
            <textarea id="supportChatInput" rows="4" placeholder="What has been weighing on you—stress, fear, embarrassment, feeling dismissed…" maxlength="2000" ${busy ? "disabled" : ""}></textarea>
            <button class="btn btn-primary" type="submit" ${busy ? "disabled" : ""}>Send message</button>
          </form>
        </div>`
        : "";

    const inputPanelTitle =
      uiMode === "guided"
        ? step && step.type !== "done"
          ? "Current step"
          : "Step-by-step complete"
        : "Your message";

    root.innerHTML =
      renderHeader(session) +
      `
      <main>
        <div class="card support-page">
          <h1>Support</h1>
          ${renderAiNotCounsellorBanner()}
          <p class="muted support-lead">Between medical touchpoints, anxiety and fear are common after a breast cancer diagnosis. A private space to reflect and prepare — not therapy, not medical advice. For wellness tracking, use <a href="#/patient/checkin">Wellness log</a>.</p>
          ${renderHumanSupportFootnote(escapeHtml)}
          <p class="support-ai-line">${aiBadge}</p>
          <p id="aiFallbackHint" class="muted support-hint"></p>
          <div class="support-entry-tabs" role="tablist" aria-label="Support entry">${entryTabsHtml}</div>
          <div class="support-layout">
            <section class="support-conversation" aria-label="Conversation history">
              <h2 class="support-section-title">Conversation</h2>
              <div class="chat-log" id="chatLog">${logHtml || `<p class="muted chat-log-empty">No messages yet. Choose a tab above and start below.</p>`}${busy ? `<p class="chat-typing muted">Thinking…</p>` : ""}</div>
            </section>
            <section class="support-input" aria-label="Reply">
              <h2 class="support-section-title">${escapeHtml(inputPanelTitle)}</h2>
              ${guidedPanel}
              ${supportPanel}
            </section>
          </div>
          <p class="muted support-panel-foot">Technology does not replace your doctor, counsellor, or support group. It may help you reflect, prepare, and feel less alone.</p>
          <div class="btn-row support-actions">
            <a class="btn btn-ghost" href="#/patient/visit-brief">Visit brief</a>
            <a class="btn btn-ghost" href="#/patient/find-help">Find human help</a>
            <a class="btn btn-ghost" href="#/patient/screening">Screening</a>
            <button type="button" class="btn btn-ghost" id="clearChat" ${busy ? "disabled" : ""}>Clear chat</button>
            <a class="btn btn-ghost" href="#/patient/settings">Privacy</a>
            <a class="btn btn-ghost" href="#/patient">Home</a>
          </div>
        </div>
      </main>`;

    bindLogout();

    const pushMessage = async (role, text, support = false) => {
      const saved = await appendChatMessageUnified(session, { role, text });
      const msg = saved || { role, text, createdAt: new Date().toISOString() };
      if (support) msg.support = true;
      messages.push(msg);
    };

    const appendSupport = async (userText, context) => {
      busy = true;
      renderChatUi();
      const { reply, source } = await getSupportReply(userText, context, isApiMode());
      await pushMessage("bot", reply, true);
      busy = false;
      const hintEl = document.getElementById("aiFallbackHint");
      if (hintEl) {
        if (source === "fallback" && aiOn && getLastAiError()) {
          hintEl.textContent = `AI is configured but this reply used built-in text: ${getLastAiError()}`;
        } else if (source === "ai") {
          hintEl.textContent = "";
        }
      }
    };

    document.querySelectorAll("[data-entry-tab]").forEach((btn) => {
      btn.onclick = () => {
        entryTab = btn.getAttribute("data-entry-tab") || "feelings";
        if (entryTab === "open") {
          uiMode = "support";
        } else {
          uiMode = "guided";
          stepIndex = firstStepIndexForTab(entryTab);
          if (entryTab === "dismissal" && messages.length === 0) {
            messages.push({ role: "bot", text: getDismissalIntro() });
          }
        }
        renderChatUi();
      };
    });

    document.querySelectorAll(".dismissal-script").forEach((btn) => {
      btn.addEventListener("click", () => {
        const text = btn.getAttribute("data-script");
        if (text) {
          addVisitQuestion(session.patientId, { text, source: "dismissal" });
          const msg = document.createElement("p");
          msg.className = "muted";
          msg.textContent = "Saved to your visit questions on Home.";
          btn.parentElement?.appendChild(msg);
        }
      });
    });

    document.getElementById("clearChat")?.addEventListener("click", async () => {
      await clearChatUnified(session);
      messages = [];
      stepIndex = firstStepIndexForTab(entryTab === "open" ? "feelings" : entryTab);
      collected = {};
      uiMode = entryTab === "open" ? "support" : "guided";
      renderChatUi();
    });

    document.getElementById("chatContinue")?.addEventListener("click", async () => {
      if (step.id === "welcome") {
        await appendSupport("I am ready to start.", {
          mode: "guided_welcome",
          history: chatHistory(),
        });
      }
      const adv = advanceChat(stepIndex, null, collected);
      stepIndex = adv.nextIndex;
      const nextStep = CHAT_STEPS[stepIndex];
      if (nextStep) await pushMessage("bot", nextStep.bot);
      renderChatUi();
    });

    document.querySelectorAll(".chat-starter").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const text = btn.getAttribute("data-starter");
        if (!text || busy) return;
        await pushMessage("user", text);
        await appendSupport(text, { mode: "freeform", history: chatHistory() });
        renderChatUi();
        const log = document.getElementById("chatLog");
        if (log) log.scrollTop = log.scrollHeight;
      });
    });

    document.querySelectorAll(".chat-choice").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const val = btn.getAttribute("data-value");
        const label = step.options.find((o) => o.value === val)?.label || val;
        await pushMessage("user", label);
        await appendSupport(label, {
          mode: "guided_after_step",
          step_id: step.id,
          user_label: val,
          collected: { ...collected, [step.field]: val },
          history: chatHistory(),
        });
        const adv = advanceChat(stepIndex, val, collected);
        collected = adv.collected;
        await persistCollected();
        stepIndex = adv.nextIndex;
        const nextStep = CHAT_STEPS[stepIndex];
        if (nextStep && nextStep.type !== "done") {
          if (entryTab === "dismissal" && !DISMISSAL_STEP_IDS.includes(nextStep.id)) {
            stepIndex = stepIndexById("done");
          } else if (entryTab === "feelings" && step.id === "emotionalText") {
            stepIndex = stepIndexById("done");
          } else if (entryTab === "visitprep" && step.id === "oneThingForDoctor") {
            stepIndex = stepIndexById("done");
          } else {
            await pushMessage("bot", nextStep.bot);
          }
        }
        const doneStep = CHAT_STEPS[stepIndex];
        if (adv.done || doneStep?.type === "done") {
          await pushMessage("bot", CHAT_STEPS[CHAT_STEPS.length - 1].bot);
          stepIndex = CHAT_STEPS.length - 1;
        }
        renderChatUi();
      });
    });

    document.getElementById("chatTextForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const val = document.getElementById("chatText").value;
      await pushMessage("user", val || "(skipped)");
      await appendSupport(val || "(skipped)", {
        mode: isOpenTextStep(step.id) ? "freeform" : "guided_after_step",
        step_id: step.id,
        user_label: val,
        collected,
        history: chatHistory(),
      });
      const adv = advanceChat(stepIndex, val, collected);
      collected = adv.collected;
      await persistCollected();
      stepIndex = adv.nextIndex;
      const nextStep = CHAT_STEPS[stepIndex];
      if (nextStep && nextStep.type !== "done") await pushMessage("bot", nextStep.bot);
      if (nextStep?.type === "done") await pushMessage("bot", nextStep.bot);
      renderChatUi();
    });

    document.getElementById("supportChatForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("supportChatInput");
      const val = (input?.value || "").trim();
      if (!val) return;
      await pushMessage("user", val);
      input.value = "";
      await appendSupport(val, { mode: "freeform", history: chatHistory() });
      renderChatUi();
      const log = document.getElementById("chatLog");
      if (log) log.scrollTop = log.scrollHeight;
    });
  };

  if (entryTab !== "open") {
    uiMode = "guided";
    stepIndex = firstStepIndexForTab(entryTab);
  }

  if (messages.length > 0) {
    const lastBot = [...messages].reverse().find((m) => m.role === "bot");
    if (lastBot?.text === CHAT_STEPS[CHAT_STEPS.length - 1].bot) {
      stepIndex = CHAT_STEPS.length - 1;
    }
  }
  renderChatUi();
}
