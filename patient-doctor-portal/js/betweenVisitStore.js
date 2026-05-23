/**
 * Between-visit data: visit questions, reflect snapshot, support notes, briefs.
 * Stored per patient in localStorage (demo). Synced to API when available.
 */

const NS = "hearher.betweenVisit.v1";

function key(patientId) {
  return `${NS}:${patientId || "anon"}`;
}

function emptySnapshot() {
  return {
    visitQuestions: [],
    supportCollected: {},
    reflectAnswers: {},
    reflectThemeIds: [],
    visitBriefText: "",
    familyExplainByAudience: {},
    updatedAt: null,
  };
}

export function loadBetweenVisit(patientId) {
  try {
    const raw = localStorage.getItem(key(patientId));
    if (!raw) return emptySnapshot();
    const parsed = JSON.parse(raw);
    return { ...emptySnapshot(), ...parsed };
  } catch {
    return emptySnapshot();
  }
}

export function saveBetweenVisit(patientId, data) {
  const next = { ...data, updatedAt: new Date().toISOString() };
  localStorage.setItem(key(patientId), JSON.stringify(next));
  return next;
}

export function patchBetweenVisit(patientId, patch) {
  const cur = loadBetweenVisit(patientId);
  return saveBetweenVisit(patientId, { ...cur, ...patch });
}

/** @param {string} patientId @param {{ id?: string, text: string, source?: string }} q */
export function addVisitQuestion(patientId, q) {
  const data = loadBetweenVisit(patientId);
  const text = (q.text || "").trim();
  if (!text) return data;
  const item = {
    id: q.id || crypto.randomUUID(),
    text,
    source: q.source || "manual",
    createdAt: new Date().toISOString(),
  };
  if (data.visitQuestions.some((x) => x.text.toLowerCase() === text.toLowerCase())) {
    return data;
  }
  data.visitQuestions.unshift(item);
  return saveBetweenVisit(patientId, data);
}

export function removeVisitQuestion(patientId, id) {
  const data = loadBetweenVisit(patientId);
  data.visitQuestions = data.visitQuestions.filter((q) => q.id !== id);
  return saveBetweenVisit(patientId, data);
}

export function setSupportCollected(patientId, collected) {
  return patchBetweenVisit(patientId, { supportCollected: { ...collected } });
}

export function setReflectSnapshot(patientId, answers, themeIds) {
  return patchBetweenVisit(patientId, {
    reflectAnswers: { ...answers },
    reflectThemeIds: [...(themeIds || [])],
  });
}

export function setVisitBriefText(patientId, text) {
  return patchBetweenVisit(patientId, { visitBriefText: text });
}

export function setFamilyExplain(patientId, audience, text) {
  const data = loadBetweenVisit(patientId);
  data.familyExplainByAudience = { ...data.familyExplainByAudience, [audience]: text };
  return saveBetweenVisit(patientId, data);
}
