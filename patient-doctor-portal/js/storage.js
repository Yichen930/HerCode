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
  setPatientDoctorLink(email, doctorId);
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

function partnerConsentKey(patientId) {
  return `${NS}:patient:${patientId}:shareWithPartner`;
}

function childrenConsentKey(patientId) {
  return `${NS}:patient:${patientId}:shareWithChildren`;
}

function syncLegacyCaregiverConsent(patientId) {
  const any = getSharePartnerConsent(patientId) || getShareChildrenConsent(patientId);
  localStorage.setItem(caregiverConsentKey(patientId), any ? "1" : "0");
}

export function getSharePartnerConsent(patientId) {
  const key = partnerConsentKey(patientId);
  if (localStorage.getItem(key) == null && localStorage.getItem(caregiverConsentKey(patientId)) === "1") {
    return true;
  }
  return localStorage.getItem(key) === "1";
}

export function getShareChildrenConsent(patientId) {
  const key = childrenConsentKey(patientId);
  if (localStorage.getItem(key) == null && localStorage.getItem(caregiverConsentKey(patientId)) === "1") {
    return true;
  }
  return localStorage.getItem(key) === "1";
}

export function getShareCaregiverConsent(patientId) {
  return getSharePartnerConsent(patientId) || getShareChildrenConsent(patientId);
}

export function setSharePartnerConsent(patientId, enabled) {
  localStorage.setItem(partnerConsentKey(patientId), enabled ? "1" : "0");
  syncLegacyCaregiverConsent(patientId);
}

export function setShareChildrenConsent(patientId, enabled) {
  localStorage.setItem(childrenConsentKey(patientId), enabled ? "1" : "0");
  syncLegacyCaregiverConsent(patientId);
}

export function setShareCaregiverConsent(patientId, enabled) {
  setSharePartnerConsent(patientId, enabled);
  setShareChildrenConsent(patientId, enabled);
}

export function caregiverLinksKey(caregiverId) {
  return `${NS}:caregiver:${caregiverId}:linkedPatients`;
}

function caregiverLinkMetaKey(caregiverId) {
  return `${NS}:caregiver:${caregiverId}:linkMeta`;
}

export function getCaregiverLinkRelationship(caregiverId, patientEmail) {
  try {
    const raw = localStorage.getItem(caregiverLinkMetaKey(caregiverId));
    const meta = raw ? JSON.parse(raw) : {};
    const rel = meta[slugifyEmail(patientEmail)];
    return rel === "partner" || rel === "child" ? rel : "other";
  } catch {
    return "other";
  }
}

export function setCaregiverLinkRelationship(caregiverId, patientEmail, relationship) {
  const rel = relationship === "partner" || relationship === "child" ? relationship : "other";
  try {
    const raw = localStorage.getItem(caregiverLinkMetaKey(caregiverId));
    const meta = raw ? JSON.parse(raw) : {};
    meta[slugifyEmail(patientEmail)] = rel;
    localStorage.setItem(caregiverLinkMetaKey(caregiverId), JSON.stringify(meta));
  } catch {
    localStorage.setItem(
      caregiverLinkMetaKey(caregiverId),
      JSON.stringify({ [slugifyEmail(patientEmail)]: rel })
    );
  }
  return rel;
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

export function linkCaregiverPatient(caregiverId, patientEmail, relationship = "other") {
  const email = (patientEmail || "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Patient email is required." };
  const cur = listCaregiverLinkedPatientIds(caregiverId);
  if (!cur.includes(email)) {
    cur.push(email);
    localStorage.setItem(caregiverLinksKey(caregiverId), JSON.stringify(cur));
  }
  setCaregiverLinkRelationship(caregiverId, email, relationship);
  addPatientCaregiverLink(email, caregiverId);
  return { ok: true, patientId: email, relationship: getCaregiverLinkRelationship(caregiverId, email) };
}

function patientDoctorLinkKey(patientEmail) {
  return `${NS}:patient:${patientEmail}:linkedDoctor`;
}

function patientCaregiverLinksKey(patientEmail) {
  return `${NS}:patient:${patientEmail}:linkedCaregivers`;
}

export function setPatientDoctorLink(patientEmail, doctorEmail) {
  localStorage.setItem(patientDoctorLinkKey(slugifyEmail(patientEmail)), slugifyEmail(doctorEmail));
}

export function getPatientDoctorLink(patientEmail) {
  return localStorage.getItem(patientDoctorLinkKey(slugifyEmail(patientEmail))) || null;
}

export function addPatientCaregiverLink(patientEmail, caregiverEmail) {
  const email = slugifyEmail(patientEmail);
  const cg = slugifyEmail(caregiverEmail);
  const cur = listPatientCaregiverLinks(email);
  if (!cur.includes(cg)) {
    cur.push(cg);
    localStorage.setItem(patientCaregiverLinksKey(email), JSON.stringify(cur));
  }
}

export function listPatientCaregiverLinks(patientEmail) {
  const raw = localStorage.getItem(patientCaregiverLinksKey(slugifyEmail(patientEmail)));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function directMessagesKey(patientEmail, channel) {
  return `${NS}:patient:${slugifyEmail(patientEmail)}:direct:${channel}`;
}

/** @returns {Array<object>} */
export function listDirectMessages(patientEmail, channel) {
  const raw = localStorage.getItem(directMessagesKey(patientEmail, channel));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addDirectMessage(patientEmail, channel, message) {
  const list = listDirectMessages(patientEmail, channel);
  list.push(message);
  localStorage.setItem(directMessagesKey(patientEmail, channel), JSON.stringify(list));
  return message;
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
