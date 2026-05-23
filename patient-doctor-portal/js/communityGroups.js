/**
 * Breast cancer peer community — topic groups patients can join.
 */

export const COMMUNITY_GROUPS = [
  {
    id: "newly-diagnosed",
    label: "Newly diagnosed",
    desc: "Shock, first steps, telling family",
    theme: "new",
  },
  {
    id: "chemo",
    label: "Chemotherapy",
    desc: "Cycles, fatigue, nausea, hair loss",
    theme: "chemo",
  },
  {
    id: "surgery",
    label: "Surgery & mastectomy",
    desc: "Before/after op, recovery, scars",
    theme: "surgery",
  },
  {
    id: "radiation",
    label: "Radiation",
    desc: "Daily treatment, skin changes, tiredness",
    theme: "radiation",
  },
  {
    id: "body-image",
    label: "Body image & reconstruction",
    desc: "Mirrors, prosthetics, identity",
    theme: "body",
  },
  {
    id: "scanxiety",
    label: "Scan & results anxiety",
    desc: "Waiting between tests, recurrence fear",
    theme: "scan",
  },
  {
    id: "survivorship",
    label: "Survivorship",
    desc: "Life after active treatment",
    theme: "survive",
  },
  {
    id: "caregivers",
    label: "Family & caregivers",
    desc: "Partners, children, practical support",
    theme: "family",
  },
];

const VALID_GROUP_IDS = new Set(COMMUNITY_GROUPS.map((g) => g.id));

export function isValidGroupId(id) {
  return VALID_GROUP_IDS.has(id);
}

export function getCommunityGroup(id) {
  return COMMUNITY_GROUPS.find((g) => g.id === id) || null;
}

function membershipsKey(patientId) {
  return `pdportal_v1:community:memberships:${patientId || "anon"}`;
}

export function listLocalGroupMemberships(patientId) {
  try {
    const raw = localStorage.getItem(membershipsKey(patientId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((id) => isValidGroupId(id)) : [];
  } catch {
    return [];
  }
}

export function saveLocalGroupMemberships(patientId, groupIds) {
  const unique = [...new Set(groupIds.filter((id) => isValidGroupId(id)))];
  localStorage.setItem(membershipsKey(patientId), JSON.stringify(unique));
  return unique;
}

export function joinLocalGroup(patientId, groupId) {
  if (!isValidGroupId(groupId)) return listLocalGroupMemberships(patientId);
  const cur = listLocalGroupMemberships(patientId);
  if (!cur.includes(groupId)) cur.push(groupId);
  return saveLocalGroupMemberships(patientId, cur);
}

export function leaveLocalGroup(patientId, groupId) {
  return saveLocalGroupMemberships(
    patientId,
    listLocalGroupMemberships(patientId).filter((id) => id !== groupId)
  );
}

export function renderGroupBadge(groupId, escapeHtml) {
  const g = getCommunityGroup(groupId);
  if (!g) return "";
  return `<span class="community-group-badge community-group-badge--${escapeHtml(g.theme)}">${escapeHtml(g.label)}</span>`;
}
