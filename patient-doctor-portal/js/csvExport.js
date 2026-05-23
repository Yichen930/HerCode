/**
 * CSV export helpers — server downloads (API mode) or browser-generated files (offline).
 */

import { getApiToken } from "./backend.js";
import {
  listSubmissions,
  listClinicalRecords,
  listChatMessages,
  listLinkedPatientIds,
  getShareChatConsent,
} from "./storage.js";

const CHECKIN_KEYS = [
  "age",
  "cycleRegularity",
  "painLevel",
  "painTiming",
  "skinHair",
  "bowelBladder",
  "weightChange",
  "heavyBleeding",
  "bmiCategory",
  "fertilityConcern",
  "notes",
];

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(fieldnames, rows) {
  const lines = [fieldnames.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(fieldnames.map((f) => csvEscape(row[f])).join(","));
  }
  return lines.join("\n");
}

function downloadBlob(filename, content, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function submissionToRow(email, s) {
  const row = {
    submission_id: s.id,
    patient_email: email,
    submitted_at: s.submittedAt || "",
    deleted_at: s.deletedAt || "",
    summary_plain: s.summary || "",
  };
  for (const k of CHECKIN_KEYS) {
    row[k] = (s.answers && s.answers[k]) || "";
  }
  return row;
}

/**
 * @param {string} patientEmail
 * @param {{ subs: object[], clinicalRecords: object[], chatMessages: object[] }} bundle
 */
export function exportPatientBundleCsv(patientEmail, bundle) {
  const slug = patientEmail.replace(/@/g, "_at_");
  const fields = [
    "submission_id",
    "patient_email",
    "submitted_at",
    "deleted_at",
    "summary_plain",
    ...CHECKIN_KEYS,
  ];
  downloadBlob(
    `hearher_${slug}_checkins.csv`,
    rowsToCsv(fields, (bundle.subs || []).map((s) => submissionToRow(patientEmail, s)))
  );

  downloadBlob(
    `hearher_${slug}_clinical_records.csv`,
    rowsToCsv(
      [
        "record_id",
        "patient_email",
        "diagnosis_name",
        "confirmed",
        "notes",
        "linked_submission_id",
        "recorded_at",
        "doctor_display",
      ],
      (bundle.clinicalRecords || []).map((r) => ({
        record_id: r.id,
        patient_email: patientEmail,
        diagnosis_name: r.diagnosisName,
        confirmed: r.confirmed ? "yes" : "provisional",
        notes: r.notes || "",
        linked_submission_id: r.linkedSubmissionId || "",
        recorded_at: r.recordedAt || "",
        doctor_display: r.doctorDisplay || "",
      }))
    )
  );

  downloadBlob(
    `hearher_${slug}_chat.csv`,
    rowsToCsv(
      ["message_id", "patient_email", "role", "text", "created_at"],
      (bundle.chatMessages || []).map((m) => ({
        message_id: m.id,
        patient_email: patientEmail,
        role: m.role,
        text: m.text,
        created_at: m.createdAt || "",
      }))
    )
  );
}

/**
 * Offline: export all linked patients for a doctor session.
 * @param {string} doctorId
 * @param {(email: string) => Promise<{ subs: object[], clinicalRecords: object[], chatMessages: object[] }>} loadBundle
 */
export async function exportAllLinkedPatientsCsv(doctorId, loadBundle) {
  const emails = listLinkedPatientIds(doctorId);
  const rosterRows = emails.map((email) => ({ patient_email: email }));
  downloadBlob(
    "hearher_roster.csv",
    rowsToCsv(["patient_email"], rosterRows)
  );
  for (const email of emails) {
    const bundle = await loadBundle(email);
    if (!getShareChatConsent(email)) bundle.chatMessages = [];
    exportPatientBundleCsv(email, bundle);
  }
}

/**
 * @param {string} relativePath e.g. clinicians/foo_at_bar.com/checkins.csv
 */
export async function downloadServerExportFile(relativePath) {
  const token = getApiToken();
  const res = await fetch(`/api/doctor/exports/download?path=${encodeURIComponent(relativePath)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const name = relativePath.split("/").pop() || "export.csv";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
