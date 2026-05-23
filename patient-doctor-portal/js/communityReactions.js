/** Curated supportive reactions for breast cancer peer community. */

export const SUPPORT_EMOJIS = [
  { id: "care", emoji: "💜", label: "Sending care" },
  { id: "hug", emoji: "🤗", label: "Virtual hug" },
  { id: "strong", emoji: "💪", label: "You're strong" },
  { id: "together", emoji: "🫂", label: "Not alone" },
  { id: "hope", emoji: "✨", label: "Hope" },
  { id: "gentle", emoji: "🌸", label: "Gentle support" },
];

const VALID_IDS = new Set(SUPPORT_EMOJIS.map((e) => e.id));

export function isValidEmojiId(id) {
  return VALID_IDS.has(id);
}

export function getSupportEmoji(id) {
  return SUPPORT_EMOJIS.find((e) => e.id === id) || null;
}

/** Normalize API / local reaction rows into a consistent shape. */
export function normalizeReactionList(raw) {
  const byId = new Map();
  for (const row of raw || []) {
    const id = row.emojiId || row.emoji_id;
    if (!isValidEmojiId(id)) continue;
    byId.set(id, {
      emojiId: id,
      count: Number(row.count) || 0,
      reactedByMe: Boolean(row.reactedByMe ?? row.reacted_by_me),
    });
  }
  return SUPPORT_EMOJIS.map((e) => {
    const hit = byId.get(e.id);
    return {
      emojiId: e.id,
      emoji: e.emoji,
      label: e.label,
      count: hit?.count || 0,
      reactedByMe: hit?.reactedByMe || false,
    };
  }).filter((r) => r.count > 0 || r.reactedByMe);
}

export function totalReactionCount(reactions) {
  return (reactions || []).reduce((n, r) => n + (r.count || 0), 0);
}

/**
 * @param {{ targetType: 'post'|'comment', targetId: string, reactions?: object[], escapeHtml: Function, showPicker?: boolean }} opts
 */
export function renderReactionBar({ targetType, targetId, reactions = [], escapeHtml, showPicker = true }) {
  const normalized = normalizeReactionList(reactions);
  const total = totalReactionCount(normalized);
  const summaryHtml =
    total > 0
      ? `<div class="community-reaction-summary" aria-label="${total} supportive reactions">
          ${normalized
            .filter((r) => r.count > 0)
            .map(
              (r) =>
                `<span class="community-reaction-chip${r.reactedByMe ? " is-mine" : ""}" title="${escapeHtml(r.label)}">
                  <span class="community-emoji-char">${r.emoji}</span>
                  <span class="community-emoji-count">${r.count}</span>
                </span>`
            )
            .join("")}
        </div>`
      : "";

  const pickerHtml = showPicker
    ? `<div class="community-emoji-picker" role="group" aria-label="Send supportive reaction">
        ${SUPPORT_EMOJIS.map((e) => {
          const hit = normalized.find((r) => r.emojiId === e.id);
          const count = hit?.count || 0;
          const mine = hit?.reactedByMe || false;
          return `<button type="button" class="community-emoji-btn${mine ? " is-active" : ""}${count ? " has-count" : ""}"
            data-react-type="${escapeHtml(targetType)}" data-react-id="${escapeHtml(targetId)}" data-emoji-id="${escapeHtml(e.id)}"
            title="${escapeHtml(e.label)}" aria-pressed="${mine ? "true" : "false"}">
            <span class="community-emoji-char" aria-hidden="true">${e.emoji}</span>
            <span class="community-emoji-label">${escapeHtml(e.label)}</span>
            ${count ? `<span class="community-emoji-count">${count}</span>` : ""}
          </button>`;
        }).join("")}
      </div>`
    : "";

  return `<div class="community-reactions" data-reactions-for="${escapeHtml(targetType)}:${escapeHtml(targetId)}">
    ${summaryHtml}
    ${pickerHtml}
  </div>`;
}

/** Update an existing reaction bar DOM node after toggle. */
export function refreshReactionBarElement(container, reactions, escapeHtml) {
  if (!container) return;
  const parts = (container.getAttribute("data-reactions-for") || "").split(":");
  const targetType = parts[0] === "comment" ? "comment" : "post";
  const targetId = parts.slice(1).join(":");
  container.outerHTML = renderReactionBar({
    targetType,
    targetId,
    reactions,
    escapeHtml,
  });
}
