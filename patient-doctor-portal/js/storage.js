/**
 * Demo persistence via localStorage. Not suitable for real PHI.
 */
const NS = "pdportal_v1";

export function getSession() {
  const raw = localStorage.getItem(`${NS}:session`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setSession(session) {
  if (session == null) {
    localStorage.removeItem(`${NS}:session`);
    return;
  }
  localStorage.setItem(`${NS}:session`, JSON.stringify(session));
}

export function clearSession() {
  setSession(null);
}

function patientKey(patientId) {
  return `${NS}:patient:${patientId}:submissions`;
}

function readAllSubmissions(patientId) {
  const raw = localStorage.getItem(patientKey(patientId));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAllSubmissions(patientId, list) {
  localStorage.setItem(patientKey(patientId), JSON.stringify(list));
}

/** @param {string} patientId @param {{ trash?: boolean }} [opts] */
export function listSubmissions(patientId, opts = {}) {
  const trash = !!opts.trash;
  return readAllSubmissions(patientId).filter((s) => (trash ? !!s.deletedAt : !s.deletedAt));
}

export function addSubmission(patientId, record) {
  const list = readAllSubmissions(patientId);
  list.unshift(record);
  writeAllSubmissions(patientId, list);
}

export function retractSubmission(patientId, submissionId) {
  const list = readAllSubmissions(patientId);
  const idx = list.findIndex((s) => s.id === submissionId);
  if (idx < 0) return { ok: false, error: "Check-in not found." };
  if (list[idx].deletedAt) return { ok: true, id: submissionId };
  list[idx] = { ...list[idx], deletedAt: new Date().toISOString() };
  writeAllSubmissions(patientId, list);
  return { ok: true, id: submissionId };
}

export function restoreSubmission(patientId, submissionId) {
  const list = readAllSubmissions(patientId);
  const idx = list.findIndex((s) => s.id === submissionId);
  if (idx < 0) return { ok: false, error: "Check-in not found." };
  const { deletedAt: _removed, ...rest } = list[idx];
  list[idx] = rest;
  writeAllSubmissions(patientId, list);
  return { ok: true, id: submissionId };
}

export function purgeSubmission(patientId, submissionId) {
  const list = readAllSubmissions(patientId);
  const item = list.find((s) => s.id === submissionId);
  if (!item) return { ok: false, error: "Check-in not found." };
  if (!item.deletedAt) {
    return { ok: false, error: "Move the check-in to the recycle bin before deleting permanently." };
  }
  writeAllSubmissions(
    patientId,
    list.filter((s) => s.id !== submissionId)
  );
  return { ok: true, id: submissionId };
}

export function doctorLinksKey(doctorId) {
  return `${NS}:doctor:${doctorId}:linkedPatients`;
}

export function listLinkedPatientIds(doctorId) {
  const raw = localStorage.getItem(doctorLinksKey(doctorId));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function linkPatient(doctorId, patientEmail) {
  const email = (patientEmail || "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Patient email is required." };
  const key = doctorLinksKey(doctorId);
  const cur = listLinkedPatientIds(doctorId);
  if (!cur.includes(email)) {
    cur.push(email);
    localStorage.setItem(key, JSON.stringify(cur));
  }
  return { ok: true, patientId: email };
}

export function slugifyEmail(email) {
  return (email || "").trim().toLowerCase();
}

function chatKey(patientId) {
  return `${NS}:patient:${patientId}:chat`;
}

export function listChatMessages(patientId) {
  const raw = localStorage.getItem(chatKey(patientId));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addChatMessage(patientId, message) {
  const list = listChatMessages(patientId);
  list.push(message);
  localStorage.setItem(chatKey(patientId), JSON.stringify(list));
}

export function clearChatMessages(patientId) {
  localStorage.removeItem(chatKey(patientId));
}

function consentKey(patientId) {
  return `${NS}:patient:${patientId}:shareChatWithDoctor`;
}

export function getShareChatConsent(patientId) {
  return localStorage.getItem(consentKey(patientId)) === "1";
}

export function setShareChatConsent(patientId, enabled) {
  localStorage.setItem(consentKey(patientId), enabled ? "1" : "0");
}

function caregiverConsentKey(patientId) {
  return `${NS}:patient:${patientId}:shareWithCaregiver`;
}

export function getShareCaregiverConsent(patientId) {
  return localStorage.getItem(caregiverConsentKey(patientId)) === "1";
}

export function setShareCaregiverConsent(patientId, enabled) {
  localStorage.setItem(caregiverConsentKey(patientId), enabled ? "1" : "0");
}

export function caregiverLinksKey(caregiverId) {
  return `${NS}:caregiver:${caregiverId}:linkedPatients`;
}

export function listCaregiverLinkedPatientIds(caregiverId) {
  const raw = localStorage.getItem(caregiverLinksKey(caregiverId));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function linkCaregiverPatient(caregiverId, patientEmail) {
  const email = (patientEmail || "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Patient email is required." };
  const cur = listCaregiverLinkedPatientIds(caregiverId);
  if (!cur.includes(email)) {
    cur.push(email);
    localStorage.setItem(caregiverLinksKey(caregiverId), JSON.stringify(cur));
  }
  return { ok: true, patientId: email };
}

function clinicalRecordsKey(patientId) {
  return `${NS}:patient:${patientId}:clinicalRecords`;
}

/** @returns {Array<object>} */
export function listClinicalRecords(patientId) {
  const raw = localStorage.getItem(clinicalRecordsKey(patientId));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * @param {string} patientId
 * @param {object} record
 */
export function addClinicalRecord(patientId, record) {
  const list = listClinicalRecords(patientId);
  list.unshift(record);
  localStorage.setItem(clinicalRecordsKey(patientId), JSON.stringify(list));
  return record;
}
