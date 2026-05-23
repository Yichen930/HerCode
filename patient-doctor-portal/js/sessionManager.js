import * as backend from "./backend.js";
import {
  clearSession as clearLocalSession,
  getSession as getLocalSession,
  getShareChatConsent,
  getShareCaregiverConsent,
  linkPatient,
  linkCaregiverPatient,
  listChatMessages,
  listLinkedPatientIds,
  listCaregiverLinkedPatientIds,
  listSubmissions,
  retractSubmission,
  restoreSubmission,
  purgeSubmission,
  setSession as setLocalSession,
  setShareChatConsent,
  setShareCaregiverConsent,
  setSharePartnerConsent,
  setShareChildrenConsent,
  getSharePartnerConsent,
  getShareChildrenConsent,
  getCaregiverLinkRelationship,
  setCaregiverLinkRelationship,
  slugifyEmail,
  addChatMessage as localAddChatMessage,
  clearChatMessages,
  listClinicalRecords,
  addClinicalRecord,
  listDirectMessages,
  addDirectMessage,
  getPatientDoctorLink,
  listPatientCaregiverLinks,
  setPatientDoctorLink,
  addPatientCaregiverLink,
} from "./storage.js";
import { loadBetweenVisit } from "./betweenVisitStore.js";

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
    caregiverId: email,
    shareChatWithDoctor: Boolean(user.share_chat_with_doctor),
    shareWithCaregiver: Boolean(user.share_with_caregiver),
    shareWithPartner: Boolean(user.share_with_partner ?? user.share_with_caregiver),
    shareWithChildren: Boolean(user.share_with_children ?? user.share_with_caregiver),
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
  if (useApi) {
    const res = await apiLinkPatient(patientEmail);
    if (res.ok) {
      setPatientDoctorLink(patientEmail, session.doctorId || session.email || "");
    }
    return res;
  }
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

export function getCaregiverConsentForPatient(patientEmail) {
  return getShareCaregiverConsent(slugifyEmail(patientEmail));
}

export async function setCaregiverConsentUnified(session, { partner, children }) {
  if (!session || session.role !== "patient") return;
  if (useApi) {
    const res = await backend.apiFetch("/me/caregiver-consent", {
      method: "PATCH",
      body: JSON.stringify({
        share_with_partner: Boolean(partner),
        share_with_children: Boolean(children),
      }),
    });
    cachedApiUser = mapApiUser(res.user);
    return;
  }
  setSharePartnerConsent(session.patientId, Boolean(partner));
  setShareChildrenConsent(session.patientId, Boolean(children));
}

export async function syncBetweenVisitSnapshot(session) {
  if (!session || session.role !== "patient") return;
  const snapshot = loadBetweenVisit(session.patientId);
  if (!useApi) return snapshot;
  try {
    await backend.apiFetch("/me/between-visit", {
      method: "PUT",
      body: JSON.stringify({ snapshot }),
    });
  } catch {
    /* ignore offline */
  }
  return snapshot;
}

export async function fetchCaregiverPatients() {
  if (!useApi) {
    const cgId = getLocalSession().caregiverId || getLocalSession().email;
    return listCaregiverLinkedPatientIds(cgId).map((email) => ({
      patient_email: email,
      relationship: getCaregiverLinkRelationship(cgId, email),
      share_with_partner: getSharePartnerConsent(email),
      share_with_children: getShareChildrenConsent(email),
    }));
  }
  return await backend.apiFetch("/caregiver/patients");
}

export async function linkCaregiverPatientUnified(session, patientEmail, relationship = "other") {
  const rel = relationship === "partner" || relationship === "child" ? relationship : "other";
  if (useApi) {
    try {
      await backend.apiFetch("/caregiver/links", {
        method: "POST",
        body: JSON.stringify({ patient_email: slugifyEmail(patientEmail), relationship: rel }),
      });
      addPatientCaregiverLink(patientEmail, session.caregiverId || session.email || "");
      setCaregiverLinkRelationship(session.caregiverId || session.email, patientEmail, rel);
      return { ok: true, patientId: slugifyEmail(patientEmail), relationship: rel };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return linkCaregiverPatient(session.caregiverId || session.email, patientEmail, rel);
}

export async function fetchDoctorPatientSnapshot(patientEmail) {
  const email = slugifyEmail(patientEmail);
  if (!useApi) return loadBetweenVisit(email);
  const enc = encodeURIComponent(email);
  return await backend.apiFetch(`/doctor/patients/${enc}/between-visit`);
}

export async function fetchCaregiverPatientSnapshot(patientEmail, relationship = "other") {
  const email = slugifyEmail(patientEmail);
  const rel = relationship === "child" ? "child" : relationship === "partner" ? "partner" : "other";
  if (!useApi) {
    const sharingOn =
      rel === "child" ? getShareChildrenConsent(email) : getSharePartnerConsent(email);
    if (!sharingOn) return null;
    return loadBetweenVisit(email);
  }
  const enc = encodeURIComponent(email);
  return await backend.apiFetch(`/caregiver/patients/${enc}/between-visit`);
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

function directMessageContactsFromLocal(patientEmail) {
  const doctorLink = getPatientDoctorLink(patientEmail);
  const caregiverLinks = listPatientCaregiverLinks(patientEmail);
  const caregivers = caregiverLinks.map((email) => ({
    displayName: email.split("@")[0],
    email,
    phone: null,
    relationship: "other",
  }));
  return {
    hasLinkedDoctor: Boolean(doctorLink),
    hasLinkedCaregiver: caregivers.length > 0,
    doctorDisplayName: doctorLink ? doctorLink.split("@")[0] : null,
    doctorEmail: doctorLink || null,
    doctorPhone: null,
    caregiverDisplayNames: caregivers.map((c) => c.displayName),
    caregiverEmails: caregiverLinks,
    caregivers,
    doctor: doctorLink
      ? { displayName: doctorLink.split("@")[0], email: doctorLink, phone: null }
      : null,
  };
}

function cachePatientLinkHints(patientEmail, contacts) {
  if (contacts?.doctorEmail) {
    setPatientDoctorLink(patientEmail, contacts.doctorEmail);
  }
  for (const cgEmail of contacts?.caregiverEmails || []) {
    addPatientCaregiverLink(patientEmail, cgEmail);
  }
}

function isMissingDirectMessagesApi(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg === "Not Found" || /\b404\b/.test(msg);
}

export async function fetchDirectMessageContacts(session) {
  if (!session || session.role !== "patient") {
    return {
      hasLinkedDoctor: false,
      hasLinkedCaregiver: false,
      doctorDisplayName: null,
      caregiverDisplayNames: [],
    };
  }
  const patientEmail = session.patientId || session.email;
  if (useApi || backend.getApiToken()) {
    try {
      const contacts = await backend.apiFetch("/direct-messages/contacts");
      cachePatientLinkHints(patientEmail, contacts);
      return contacts;
    } catch (e) {
      if (isMissingDirectMessagesApi(e)) {
        return directMessageContactsFromLocal(patientEmail);
      }
      if (useApi) throw e;
    }
  }
  return directMessageContactsFromLocal(patientEmail);
}

export async function fetchDirectMessagesUnified(session, { channel, patientEmail = "" }) {
  if (channel !== "doctor" && channel !== "caregiver") {
    throw new Error("Invalid channel");
  }

  const email = slugifyEmail(patientEmail || session.patientId || session.email);

  if (useApi || backend.getApiToken()) {
    try {
      if (session.role === "patient") {
        return await backend.apiFetch(`/direct-messages/${channel}`);
      }
      const enc = encodeURIComponent(email);
      if (session.role === "doctor") {
        return await backend.apiFetch(`/doctor/patients/${enc}/direct-messages`);
      }
      if (session.role === "caregiver") {
        return await backend.apiFetch(`/caregiver/patients/${enc}/direct-messages`);
      }
      throw new Error("Unsupported role");
    } catch (e) {
      if (isMissingDirectMessagesApi(e) && session.role === "patient") {
        /* fall through to local handling */
      } else if (useApi || session.role !== "patient") {
        throw e;
      }
    }
  }

  if (session.role === "patient") {
    const linked =
      channel === "doctor" ? Boolean(getPatientDoctorLink(email)) : listPatientCaregiverLinks(email).length > 0;
    if (!linked) {
      const signInEmail = slugifyEmail(session.email || session.patientId || "");
      return {
        linked: false,
        messages: [],
        message:
          channel === "doctor"
            ? `No linked clinician yet. Ask them to link ${signInEmail || "your HearHer sign-in email"} under Link person. If login shows Offline mode, sign in again with Server connected.`
            : `No linked caregiver yet. They must link ${signInEmail || "your email"} under Link someone. If login shows Offline mode, sign in again with Server connected.`,
      };
    }
    return { linked: true, messages: listDirectMessages(email, channel) };
  }

  if (session.role === "doctor" && channel === "doctor") {
    if (!listLinkedPatientIds(session.doctorId).includes(email)) {
      throw new Error("Patient not linked");
    }
    return { linked: true, messages: listDirectMessages(email, channel) };
  }

  if (session.role === "caregiver" && channel === "caregiver") {
    const cgId = session.caregiverId || session.email;
    if (!listCaregiverLinkedPatientIds(cgId).includes(email)) {
      throw new Error("Patient not linked");
    }
    return { linked: true, messages: listDirectMessages(email, channel) };
  }

  throw new Error("Unsupported role");
}

export async function sendDirectMessageUnified(session, { channel, patientEmail = "", text, urgent = false }) {
  const trimmed = (text || "").trim();
  if (!trimmed) throw new Error("Message is required");

  const email = slugifyEmail(patientEmail || session.patientId || session.email);

  if (useApi || backend.getApiToken()) {
    const body = { text: trimmed, urgent: Boolean(urgent) };
    try {
      if (session.role === "patient") {
        return await backend.apiFetch(`/direct-messages/${channel}`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      const enc = encodeURIComponent(email);
      if (session.role === "doctor") {
        return await backend.apiFetch(`/doctor/patients/${enc}/direct-messages`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      if (session.role === "caregiver") {
        return await backend.apiFetch(`/caregiver/patients/${enc}/direct-messages`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      throw new Error("Unsupported role");
    } catch (e) {
      if (useApi || session.role !== "patient") throw e;
    }
  }
  let senderRole = session.role;
  let senderDisplayName = session.displayName || session.email || senderRole;

  if (session.role === "patient") {
    const linked =
      channel === "doctor" ? Boolean(getPatientDoctorLink(email)) : listPatientCaregiverLinks(email).length > 0;
    if (!linked) throw new Error("Not linked");
  } else if (session.role === "doctor") {
    if (!listLinkedPatientIds(session.doctorId).includes(email)) throw new Error("Patient not linked");
  } else if (session.role === "caregiver") {
    const cgId = session.caregiverId || session.email;
    if (!listCaregiverLinkedPatientIds(cgId).includes(email)) throw new Error("Patient not linked");
  } else {
    throw new Error("Unsupported role");
  }

  return addDirectMessage(email, channel, {
    id: crypto.randomUUID(),
    channel,
    senderRole,
    senderDisplayName,
    text: trimmed,
    urgent: Boolean(urgent),
    createdAt: new Date().toISOString(),
  });
}
