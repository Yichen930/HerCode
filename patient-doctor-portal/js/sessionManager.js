import * as backend from "./backend.js";
import {
  clearSession as clearLocalSession,
  getSession as getLocalSession,
  getShareChatConsent,
  linkPatient,
  listChatMessages,
  listLinkedPatientIds,
  listSubmissions,
  retractSubmission,
  restoreSubmission,
  purgeSubmission,
  setSession as setLocalSession,
  setShareChatConsent,
  slugifyEmail,
  addChatMessage as localAddChatMessage,
  clearChatMessages,
  listClinicalRecords,
  addClinicalRecord,
} from "./storage.js";

/** @typedef {{ mode: "api", role: string, displayName: string, email: string, userId: number, patientId: string, doctorId: string }} ApiSession */
/** @typedef {{ mode?: "local", role: string, displayName: string, patientId: string, doctorId: string }} LocalSession */

let useApi = false;
/** @type {ApiSession | LocalSession | null} */
let cachedApiUser = null;

function mapApiUser(user) {
  const email = user.email;
  return {
    mode: "api",
    role: user.role,
    displayName: user.display_name,
    email,
    userId: user.id,
    patientId: email,
    doctorId: email,
    shareChatWithDoctor: Boolean(user.share_chat_with_doctor),
  };
}

export function isApiMode() {
  return useApi;
}

export async function initPortal() {
  useApi = await backend.probeBackend();
  cachedApiUser = null;
  if (useApi) {
    await refreshApiSession();
  }
}

export async function refreshApiSession() {
  if (!useApi) return false;
  const t = backend.getApiToken();
  if (!t) {
    cachedApiUser = null;
    return false;
  }
  try {
    const me = await backend.apiFetch("/me");
    cachedApiUser = mapApiUser(me.user);
    return true;
  } catch {
    backend.clearApiToken();
    cachedApiUser = null;
    return false;
  }
}

/**
 * @returns {ApiSession | LocalSession | null}
 */
export function getSession() {
  if (useApi) return cachedApiUser;
  return getLocalSession();
}

export function setLocalOnlySession(session) {
  setLocalSession(session);
}

export async function clearAllSession() {
  if (useApi && backend.getApiToken()) {
    try {
      await backend.apiFetch("/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    backend.clearApiToken();
    cachedApiUser = null;
  }
  clearLocalSession();
}

export async function apiRegister({ email, password, displayName, role }) {
  await backend.apiFetch("/register", {
    method: "POST",
    body: JSON.stringify({
      email: slugifyEmail(email),
      password,
      display_name: displayName,
      role,
    }),
  });
}

export async function apiLogin({ email, password }) {
  const res = await backend.apiFetch("/login", {
    method: "POST",
    body: JSON.stringify({ email: slugifyEmail(email), password }),
  });
  backend.setApiToken(res.token);
  cachedApiUser = mapApiUser(res.user);
}

export async function fetchMySubmissions() {
  if (!useApi) return listSubmissions(getLocalSession().patientId);
  return await backend.apiFetch("/submissions/mine");
}

export async function fetchMyTrashedSubmissions() {
  if (!useApi) return listSubmissions(getLocalSession().patientId, { trash: true });
  return await backend.apiFetch("/submissions/mine/trash");
}

export async function retractSubmissionUnified(session, submissionId) {
  const pid = session.patientId;
  if (!useApi) return retractSubmission(pid, submissionId);
  return await backend.apiFetch(`/submissions/${encodeURIComponent(submissionId)}/retract`, {
    method: "POST",
  });
}

export async function restoreSubmissionUnified(session, submissionId) {
  const pid = session.patientId;
  if (!useApi) return restoreSubmission(pid, submissionId);
  return await backend.apiFetch(`/submissions/${encodeURIComponent(submissionId)}/restore`, {
    method: "POST",
  });
}

export async function purgeSubmissionUnified(session, submissionId) {
  const pid = session.patientId;
  if (!useApi) return purgeSubmission(pid, submissionId);
  return await backend.apiFetch(`/submissions/${encodeURIComponent(submissionId)}`, {
    method: "DELETE",
  });
}

export async function fetchDoctorPatients() {
  if (!useApi) return listLinkedPatientIds(getLocalSession().doctorId).map((email) => ({ patient_email: email }));
  return await backend.apiFetch("/doctor/patients");
}

export async function fetchDoctorPatientSubmissions(patientEmail) {
  if (!useApi) {
    return listSubmissions(patientEmail);
  }
  const enc = encodeURIComponent(slugifyEmail(patientEmail));
  return await backend.apiFetch(`/doctor/patients/${enc}/submissions`);
}

export async function apiCreateSubmission(answers) {
  return await backend.apiFetch("/submissions", {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export async function apiLinkPatient(patientEmail) {
  const email = slugifyEmail(patientEmail);
  if (!email) return { ok: false, error: "Patient email is required." };
  try {
    await backend.apiFetch("/links", {
      method: "POST",
      body: JSON.stringify({ patient_email: email }),
    });
    return { ok: true, patientId: email };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function linkPatientUnified(session, patientEmail) {
  if (useApi) return apiLinkPatient(patientEmail);
  return linkPatient(session.doctorId, patientEmail);
}

export function getChatConsent(session) {
  if (!session || session.role !== "patient") return false;
  if (useApi) return Boolean(session.shareChatWithDoctor);
  return getShareChatConsent(session.patientId);
}

export async function setChatConsentUnified(session, enabled) {
  if (!session || session.role !== "patient") return;
  if (useApi) {
    const res = await backend.apiFetch("/me/consent", {
      method: "PATCH",
      body: JSON.stringify({ share_chat_with_doctor: enabled }),
    });
    cachedApiUser = mapApiUser(res.user);
    return;
  }
  setShareChatConsent(session.patientId, enabled);
}

export async function fetchChatMessagesUnified(session) {
  if (!session || session.role !== "patient") return [];
  if (useApi) return await backend.apiFetch("/chat/messages");
  return listChatMessages(session.patientId);
}

export async function appendChatMessageUnified(session, { role, text }) {
  if (!session || session.role !== "patient") return null;
  const msg = { id: crypto.randomUUID(), role, text, createdAt: new Date().toISOString() };
  if (useApi) {
    return await backend.apiFetch("/chat/messages", {
      method: "POST",
      body: JSON.stringify({ role, text }),
    });
  }
  localAddChatMessage(session.patientId, msg);
  return msg;
}

export async function clearChatUnified(session) {
  if (!session || session.role !== "patient") return;
  if (useApi) {
    await backend.apiFetch("/chat/messages", { method: "DELETE" });
    return;
  }
  clearChatMessages(session.patientId);
}

export async function fetchDoctorPatientChat(patientEmail) {
  const enc = encodeURIComponent(slugifyEmail(patientEmail));
  return await backend.apiFetch(`/doctor/patients/${enc}/chat`);
}

export async function fetchDoctorClinicalRecords(patientEmail) {
  const email = slugifyEmail(patientEmail);
  if (!useApi) return listClinicalRecords(email);
  const enc = encodeURIComponent(email);
  return await backend.apiFetch(`/doctor/patients/${enc}/clinical-records`);
}

export async function fetchMyClinicalRecords(session) {
  if (!session || session.role !== "patient") return [];
  if (!useApi) return listClinicalRecords(session.patientId);
  return await backend.apiFetch("/clinical-records/mine");
}

/**
 * @param {string} patientEmail
 * @param {{ diagnosisName: string, confirmed: boolean, notes?: string, linkedSubmissionId?: string|null }} payload
 * @param {{ doctorId: string, displayName: string }} doctorSession
 */
export async function fetchDoctorExportManifest() {
  if (!useApi) return null;
  return await backend.apiFetch("/doctor/exports/manifest");
}

export async function syncDoctorExports() {
  if (!useApi) return null;
  return await backend.apiFetch("/doctor/exports/sync", { method: "POST" });
}

export async function createDoctorClinicalRecord(patientEmail, payload, doctorSession) {
  const email = slugifyEmail(patientEmail);
  const body = {
    diagnosis_name: payload.diagnosisName,
    confirmed: payload.confirmed,
    notes: payload.notes || "",
    linked_submission_id: payload.linkedSubmissionId || null,
  };

  if (useApi) {
    const enc = encodeURIComponent(email);
    return await backend.apiFetch(`/doctor/patients/${enc}/clinical-records`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  if (body.linked_submission_id) {
    const subs = listSubmissions(email);
    if (!subs.some((s) => s.id === body.linked_submission_id)) {
      throw new Error("Selected check-in does not belong to this patient.");
    }
  }

  const linked = body.linked_submission_id
    ? listSubmissions(email).find((s) => s.id === body.linked_submission_id)
    : null;

  return addClinicalRecord(email, {
    id: crypto.randomUUID(),
    diagnosisName: body.diagnosis_name,
    confirmed: body.confirmed,
    notes: body.notes,
    linkedSubmissionId: body.linked_submission_id,
    linkedSubmissionAt: linked?.submittedAt || null,
    recordedAt: new Date().toISOString(),
    doctorDisplay: doctorSession.displayName,
    doctorEmail: doctorSession.doctorId,
  });
}
