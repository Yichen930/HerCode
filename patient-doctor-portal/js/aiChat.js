import { apiFetch } from "./backend.js";
import { getFreeformFallback, getSupportiveFallback } from "./empatheticFallback.js";

let aiConfiguredCache = null;
let lastAiError = null;

export function getLastAiError() {
  return lastAiError;
}

export async function probeAiChat(force = false) {
  if (!force && aiConfiguredCache !== null) return aiConfiguredCache;
  try {
    const r = await fetch("/api/health");
    if (!r.ok) {
      aiConfiguredCache = false;
      return false;
    }
    const j = await r.json();
    aiConfiguredCache = Boolean(j.ai_chat);
    return aiConfiguredCache;
  } catch {
    aiConfiguredCache = false;
    return false;
  }
}

export function resetAiProbe() {
  aiConfiguredCache = null;
  lastAiError = null;
}

function isOpenTextStep(stepId) {
  return stepId === "emotionalText" || stepId === "oneThingForDoctor";
}

function fallbackReply(message, context) {
  const ctx = context || {};
  if (ctx.mode === "freeform" || isOpenTextStep(ctx.step_id)) {
    return getFreeformFallback(message);
  }
  if (ctx.mode === "guided_after_step") {
    return getSupportiveFallback(ctx.step_id, ctx.user_label);
  }
  if (ctx.mode === "guided_welcome") {
    return getSupportiveFallback("welcome");
  }
  return getFreeformFallback(message);
}

/**
 * @returns {Promise<{ reply: string, source: "ai" | "fallback" }>}
 */
export async function getSupportReply(message, context, apiMode) {
  const ctx = context || {};
  lastAiError = null;

  if (apiMode) {
    const aiOn = await probeAiChat();
    if (aiOn) {
      try {
        const res = await apiFetch("/chat/ai-reply", {
          method: "POST",
          body: JSON.stringify({ message, context: ctx }),
        });
        if (res?.reply) {
          return { reply: res.reply, source: "ai" };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastAiError = msg.includes("CERTIFICATE_VERIFY_FAILED")
          ? "AI request failed. Please try again later or use built-in support replies."
          : "AI is temporarily unavailable. Built-in support replies are still available.";
        console.warn("AI support request failed:", lastAiError);
      }
    } else {
      lastAiError = "Personalized AI support is not enabled on this server.";
    }
  } else {
    lastAiError = "AI chat requires server mode with AI support enabled.";
  }

  return { reply: fallbackReply(message, ctx), source: "fallback" };
}
