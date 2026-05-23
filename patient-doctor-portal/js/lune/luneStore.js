const NS = "pdportal_v1:lune";

function key(userId) {
  return `${NS}:${userId || "anon"}`;
}

const DEFAULT = {
  onboarded: false,
  tone: "warm",
  tomorrowItems: [],
  lastSpill: "",
  shareSelections: [],
};

export function getLuneState(userId) {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return { ...DEFAULT, tomorrowItems: [] };
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT, tomorrowItems: [] };
  }
}

export function saveLuneState(userId, patch) {
  const next = { ...getLuneState(userId), ...patch };
  localStorage.setItem(key(userId), JSON.stringify(next));
  return next;
}

export function addTomorrowItem(userId, text) {
  const state = getLuneState(userId);
  const item = {
    id: crypto.randomUUID(),
    text: text.trim(),
    sealed: true,
    createdAt: new Date().toISOString(),
  };
  state.tomorrowItems = [item, ...(state.tomorrowItems || [])];
  saveLuneState(userId, { tomorrowItems: state.tomorrowItems });
  return item;
}

export function unsealTomorrowItem(userId, id) {
  const state = getLuneState(userId);
  state.tomorrowItems = (state.tomorrowItems || []).map((it) =>
    it.id === id ? { ...it, sealed: false } : it
  );
  saveLuneState(userId, { tomorrowItems: state.tomorrowItems });
}

export const LUNE_TONES = [
  { id: "gentle", label: "Quiet & Gentle", description: "Soft presence, minimal words" },
  { id: "grounding", label: "Calm & Grounding", description: "Steady, reassuring anchor" },
  { id: "warm", label: "Warm & Reassuring", description: "Comforting companionship" },
  { id: "reflective", label: "Reflective Listener", description: "Deep understanding" },
];

export const UNIVERSE_CONSTELLATIONS = [
  { id: 1, label: "Fear of recurrence", thoughtCount: 5, x: 150, y: 120 },
  { id: 2, label: "Treatment exhaustion", thoughtCount: 4, x: 380, y: 180 },
  { id: 3, label: "Things I haven't told anyone", thoughtCount: 6, x: 280, y: 320 },
  { id: 4, label: "Trying to stay strong", thoughtCount: 3, x: 120, y: 380 },
  { id: 5, label: "Body image grief", thoughtCount: 4, x: 350, y: 450 },
];

export const SHARE_CONSTELLATIONS = [
  { id: 1, label: "Fear of recurrence", thoughtCount: 5 },
  { id: 2, label: "Treatment exhaustion", thoughtCount: 4 },
  { id: 3, label: "Things I haven't told anyone", thoughtCount: 6 },
  { id: 4, label: "Trying to stay strong", thoughtCount: 3 },
];

export const SHARE_AUDIENCES = [
  { id: "caregiver", label: "My Caregiver", description: "Someone supporting you" },
  { id: "doctor", label: "My Doctor", description: "For appointments" },
  { id: "witnesses", label: "Anonymous Witnesses", description: "Community support" },
];
