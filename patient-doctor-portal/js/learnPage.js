import { buildFlashcardDeck, FLASHCARD_DECKS } from "./flashcards.js";

/**
 * @param {HTMLElement} root
 * @param {object} deps
 */
export function mountLearnPage(root, deps) {
  const { session, renderHeader, bindLogout, escapeHtml } = deps;
  const allCards = buildFlashcardDeck();
  let deckFilter = "All";
  let index = 0;
  let flipped = false;
  let known = new Set();

  const filtered = () =>
    deckFilter === "All" ? allCards : allCards.filter((c) => c.deck === deckFilter);

  const render = () => {
    const cards = filtered();
    const card = cards[index] || null;
    const total = cards.length;
    const progress = total ? Math.round(((index + 1) / total) * 100) : 0;

    root.innerHTML =
      renderHeader(session) +
      `
      <main>
        <div class="card">
          <h1>Calm &amp; learn</h1>
          <p class="muted">Tap a card to flip. Calming exercises, visit prep, caregiver tips, and emotional support between medical touchpoints — not medical advice.</p>
          <div class="flash-deck-tabs btn-row">
            ${FLASHCARD_DECKS.map(
              (d) =>
                `<button type="button" class="btn ${d === deckFilter ? "btn-primary" : "btn-ghost"}" data-deck="${escapeHtml(d)}">${escapeHtml(d)}</button>`
            ).join("")}
          </div>
          <div class="flash-progress">
            <div class="flash-progress-bar" style="width:${progress}%"></div>
          </div>
          <p class="muted flash-meta">Card ${total ? index + 1 : 0} of ${total} · ${known.size} marked “got it”</p>
          ${
            card
              ? `
          <button type="button" class="flashcard ${flipped ? "is-flipped" : ""}" id="flashcardBtn" aria-label="Flip card">
            <div class="flashcard-inner">
              <div class="flashcard-face flashcard-front">
                <span class="flashcard-tag">${escapeHtml(card.tag || card.deck)}</span>
                <p class="flashcard-prompt">${escapeHtml(card.front)}</p>
                <span class="flashcard-hint">Tap to reveal</span>
              </div>
              <div class="flashcard-face flashcard-back">
                <span class="flashcard-tag">Answer</span>
                <p class="flashcard-answer">${escapeHtml(card.back).replace(/\n/g, "<br>")}</p>
              </div>
            </div>
          </button>`
              : `<p class="muted">No cards in this deck.</p>`
          }
          <div class="btn-row flash-nav">
            <button type="button" class="btn btn-ghost" id="flashPrev" ${index <= 0 ? "disabled" : ""}>Previous</button>
            <button type="button" class="btn btn-ghost" id="flashKnown" ${!card ? "disabled" : ""}>Got it ✓</button>
            <button type="button" class="btn btn-primary" id="flashNext" ${index >= total - 1 ? "disabled" : ""}>Next</button>
          </div>
          <p class="muted">Want to hear from others? Visit <a href="#/patient/community">Community</a> to read peer stories—submissions are reviewed for safety before they appear in the feed.</p>
        </div>
      </main>`;

    bindLogout();

    root.querySelectorAll("[data-deck]").forEach((btn) => {
      btn.onclick = () => {
        deckFilter = btn.getAttribute("data-deck") || "All";
        index = 0;
        flipped = false;
        render();
      };
    });

    document.getElementById("flashcardBtn")?.addEventListener("click", () => {
      flipped = !flipped;
      document.getElementById("flashcardBtn")?.classList.toggle("is-flipped", flipped);
    });

    document.getElementById("flashPrev")?.addEventListener("click", () => {
      if (index > 0) {
        index -= 1;
        flipped = false;
        render();
      }
    });

    document.getElementById("flashNext")?.addEventListener("click", () => {
      const cards = filtered();
      if (index < cards.length - 1) {
        index += 1;
        flipped = false;
        render();
      }
    });

    document.getElementById("flashKnown")?.addEventListener("click", () => {
      const cards = filtered();
      const card = cards[index];
      if (card) known.add(card.id);
      if (index < cards.length - 1) {
        index += 1;
        flipped = false;
      }
      render();
    });
  };

  render();
}
