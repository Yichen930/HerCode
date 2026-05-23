/**
 * Emergency contacts — call/text when something feels urgent; optional in-app notes as backup.
 */

function formatTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function bubbleSide(senderRole, viewerRole) {
  if (viewerRole === "patient") return senderRole === "patient" ? "out" : "in";
  return senderRole === viewerRole ? "out" : "in";
}

function senderLabel(msg) {
  if (msg.senderRole === "patient") return msg.senderDisplayName || "Patient";
  if (msg.senderRole === "doctor") return msg.senderDisplayName || "Clinician";
  return msg.senderDisplayName || "Caregiver";
}

function phoneDigits(phone) {
  return String(phone || "").replace(/[^\d+]/g, "");
}

function relationshipLabel(relationship) {
  const rel =
    relationship === "partner" ? "Partner" : relationship === "child" ? "Adult child" : "Caregiver";
  return `Emergency contact · ${rel}`;
}

function renderContactActions({ phone, email, escapeHtml }) {
  const digits = phoneDigits(phone);
  const actions = [];
  if (digits) {
    actions.push(
      `<a class="btn btn-primary care-team-action" href="tel:${escapeHtml(digits)}">Call</a>`,
      `<a class="btn btn-ghost care-team-action" href="sms:${escapeHtml(digits)}">Text</a>`
    );
  }
  if (email) {
    actions.push(
      `<a class="btn btn-ghost care-team-action" href="mailto:${escapeHtml(email)}">Email</a>`
    );
  }
  if (!actions.length) {
    return `<p class="muted care-team-no-actions">No contact details shared in HearHer yet.</p>`;
  }
  return `<div class="care-team-actions">${actions.join("")}</div>`;
}

function renderContactCard({ name, roleLabel, phone, email, escapeHtml, hint = "" }) {
  const phoneLine = phone
    ? `<p class="care-team-contact-line"><span class="care-team-contact-label">Phone</span> ${escapeHtml(phone)}</p>`
    : `<p class="muted care-team-contact-line">Phone not listed here — use the number you already have for them.</p>`;
  const emailLine = email
    ? `<p class="care-team-contact-line"><span class="care-team-contact-label">Email</span> ${escapeHtml(email)}</p>`
    : "";

  return `<section class="care-team-card">
    <header class="care-team-card-head">
      <div>
        <h2>${escapeHtml(name)}</h2>
        <p class="muted care-team-role">${escapeHtml(roleLabel)}</p>
      </div>
    </header>
    ${phoneLine}
    ${emailLine}
    ${renderContactActions({ phone, email, escapeHtml })}
    ${hint ? `<p class="muted care-team-hint">${escapeHtml(hint)}</p>` : ""}
  </section>`;
}

function renderInAppNoteSection({
  messages,
  viewerRole,
  escapeHtml,
  linked,
  notLinkedMessage,
  formId,
  composerOpts = {},
}) {
  if (!linked) {
    return `<details class="care-team-note-panel" open>
      <summary>In-app note (backup only)</summary>
      <div class="callout callout-info"><p>${escapeHtml(notLinkedMessage || "Not linked yet.")}</p></div>
    </details>`;
  }

  return `<details class="care-team-note-panel">
    <summary>In-app note (backup only)</summary>
    <p class="muted care-team-note-lead">If you cannot reach them by call or text, leave a short note here. Not for life-threatening emergencies — call 995.</p>
    ${renderDirectChatLog(messages, viewerRole, escapeHtml)}
    ${renderDirectChatComposer(formId, escapeHtml, composerOpts)}
  </details>`;
}

export function renderDirectChatLog(messages, viewerRole, escapeHtml) {
  if (!messages?.length) {
    return `<p class="muted direct-chat-empty">No in-app notes yet.</p>`;
  }
  return `<div class="direct-chat-log" id="directChatLog">${messages
    .map((m) => {
      const side = bubbleSide(m.senderRole, viewerRole);
      const urgent = m.urgent ? `<span class="direct-chat-urgent">Urgent</span>` : "";
      return `<article class="direct-chat-bubble direct-chat-bubble--${side}${m.urgent ? " direct-chat-bubble--urgent" : ""}">
        <header class="direct-chat-meta">
          <span class="direct-chat-sender">${escapeHtml(senderLabel(m))}</span>
          ${urgent}
          <time class="direct-chat-time">${escapeHtml(formatTime(m.createdAt))}</time>
        </header>
        <p>${escapeHtml(m.text)}</p>
      </article>`;
    })
    .join("")}</div>`;
}

export function renderDirectChatComposer(formId, escapeHtml, opts = {}) {
  const { showUrgent = true, placeholder = "Type a message…" } = opts;
  return `<form class="direct-chat-form" id="${escapeHtml(formId)}">
    <label class="sr-only" for="${escapeHtml(formId)}Input">Message</label>
    <textarea id="${escapeHtml(formId)}Input" rows="3" maxlength="4000" required placeholder="${escapeHtml(placeholder)}"></textarea>
    <div class="direct-chat-form-actions">
      ${
        showUrgent
          ? `<label class="direct-chat-urgent-toggle checkbox-row">
        <input type="checkbox" id="${escapeHtml(formId)}Urgent" />
        Mark as urgent
      </label>`
          : ""
      }
      <div class="btn-row">
        <button type="button" class="btn btn-ghost btn-sm" id="${escapeHtml(formId)}Refresh">Refresh</button>
        <button type="submit" class="btn btn-primary">Send note</button>
      </div>
    </div>
    <p class="muted direct-chat-footnote">For emergencies, call 995 or go to the nearest A&amp;E — do not rely on in-app notes alone.</p>
    <p id="${escapeHtml(formId)}Msg" class="muted"></p>
  </form>`;
}

export function renderDirectChatPanel({
  title,
  lead,
  messages,
  viewerRole,
  escapeHtml,
  formId = "directChatForm",
  linked = true,
  notLinkedMessage = "",
  composerOpts = {},
}) {
  if (!linked) {
    return `<section class="direct-chat-panel">
      <header class="direct-chat-head">
        <h2>${escapeHtml(title)}</h2>
        ${lead ? `<p class="muted">${escapeHtml(lead)}</p>` : ""}
      </header>
      <div class="callout callout-info">
        <p>${escapeHtml(notLinkedMessage || "Not linked yet.")}</p>
      </div>
    </section>`;
  }

  return `<section class="direct-chat-panel">
    <header class="direct-chat-head">
      <h2>${escapeHtml(title)}</h2>
      ${lead ? `<p class="muted">${escapeHtml(lead)}</p>` : ""}
    </header>
    ${renderDirectChatLog(messages, viewerRole, escapeHtml)}
    ${renderDirectChatComposer(formId, escapeHtml, composerOpts)}
  </section>`;
}

export function renderPatientMessagesPage(session, contacts, channel, messages, escapeHtml, opts = {}) {
  const { contactsError = "", signInEmail = "", serverMode = true } = opts;
  const tabs = [
    {
      id: "doctor",
      label: "Clinician",
      enabled: contacts.hasLinkedDoctor,
      href: "#/patient/messages?channel=doctor",
    },
    {
      id: "caregiver",
      label: "Caregiver",
      enabled: contacts.hasLinkedCaregiver,
      href: "#/patient/messages?channel=caregiver",
    },
  ];

  const tabHtml = tabs
    .map((t) => {
      const active = t.id === channel ? " is-active" : "";
      const disabled = t.enabled ? "" : " direct-msg-tab--disabled";
      return `<a href="${t.href}" class="direct-msg-tab${active}${disabled}" aria-current="${t.id === channel ? "page" : "false"}">${escapeHtml(t.label)}</a>`;
    })
    .join("");

  let contactBlock = "";
  if (channel === "doctor") {
    const doc = contacts.doctor || {
      displayName: contacts.doctorDisplayName,
      email: contacts.doctorEmail,
      phone: contacts.doctorPhone,
    };
    if (contacts.hasLinkedDoctor && doc?.displayName) {
      contactBlock = renderContactCard({
        name: doc.displayName,
        roleLabel: "Emergency contact · Oncology clinician",
        phone: doc.phone,
        email: doc.email,
        escapeHtml,
        hint: "For acute symptoms, call your clinic on-call line or 995 if it feels life-threatening.",
      });
    } else {
      contactBlock = `<div class="callout callout-info"><p>No clinician linked to ${escapeHtml(signInEmail || "your account")} yet. Share your sign-in email from Home so they can link you.</p></div>`;
    }
  } else {
    const caregivers = contacts.caregivers || [];
    if (contacts.hasLinkedCaregiver && caregivers.length) {
      contactBlock = caregivers
        .map((cg) =>
          renderContactCard({
            name: cg.displayName || cg.email?.split("@")[0] || "Caregiver",
            roleLabel: relationshipLabel(cg.relationship),
            phone: cg.phone,
            email: cg.email,
            escapeHtml,
            hint: "Someone you trust in case something feels wrong — call or text them first.",
          })
        )
        .join("");
    } else {
      contactBlock = `<div class="callout callout-info"><p>No caregiver linked yet. Ask them to link your account under Link someone.</p></div>`;
    }
  }

  const noteSection = renderInAppNoteSection({
    messages: messages.messages || [],
    viewerRole: "patient",
    escapeHtml,
    linked: messages.linked,
    notLinkedMessage:
      messages.message ||
      (channel === "doctor"
        ? `Link a clinician first to leave an in-app note.`
        : `Link a caregiver first to leave an in-app note.`),
    formId: "patientDirectChatForm",
    composerOpts: { placeholder: "Only if you cannot reach them by phone…" },
  });

  const emergencyBanner = `<div class="callout callout-danger care-team-emergency-banner"><p><strong>Life-threatening emergency?</strong> Call <strong>995</strong> first — do not wait for in-app notes.</p></div>`;

  const statusNote = contactsError
    ? `<div class="callout callout-info"><p>${escapeHtml(contactsError)}</p></div>`
    : !serverMode
      ? `<div class="callout callout-info"><p class="muted"><strong>Offline mode.</strong> Contact details and notes sync when login shows <strong>Server connected</strong>.</p></div>`
      : "";

  return `
    <main class="portal-mobile direct-messages-main care-team-main">
      <section class="home-hero home-hero--compact">
        <div class="home-hero-inner">
          <p class="home-eyebrow">Emergency contacts</p>
          <p class="home-lead">People to call or text in case something feels urgent — your linked clinician and trusted caregivers, in one place.</p>
        </div>
      </section>
      ${emergencyBanner}
      <div class="direct-msg-tabs" role="tablist">${tabHtml}</div>
      ${statusNote}
      ${contactBlock}
      ${noteSection}
    </main>`;
}

export function renderCaregiverDirectChatPage(session, patientEmail, patientName, messages, escapeHtml, opts = {}) {
  const { phone = null } = opts;
  const contactBlock = patientEmail
    ? renderContactCard({
        name: patientName || patientEmail.split("@")[0] || "Patient",
        roleLabel: "Emergency contact · Person you support",
        phone,
        email: patientEmail,
        escapeHtml,
        hint: "Call or text if something feels urgent. In-app notes are only a backup.",
      })
    : `<div class="callout callout-info"><p><a href="#/caregiver">Pick someone from Home</a> to see their emergency contact details.</p></div>`;

  const noteSection = patientEmail
    ? renderInAppNoteSection({
        messages: messages.messages || [],
        viewerRole: "caregiver",
        escapeHtml,
        linked: messages.linked !== false,
        formId: "caregiverDirectChatForm",
        composerOpts: { placeholder: "Backup note if they are not answering calls…" },
      })
    : "";

  const emergencyBanner = `<div class="callout callout-danger care-team-emergency-banner"><p><strong>Life-threatening emergency?</strong> Call <strong>995</strong> — then reach your linked contacts.</p></div>`;

  const roster =
    opts.linkedPatients?.length > 1
      ? `<div class="care-team-roster">${opts.linkedPatients
          .map((p) => {
            const email = p.patient_email || p;
            const active = email === patientEmail ? " is-active" : "";
            const label = p.display_name || email.split("@")[0];
            return `<a class="care-team-roster-chip${active}" href="#/caregiver/chat?patient=${encodeURIComponent(email)}">${escapeHtml(label)}</a>`;
          })
          .join("")}</div>`
      : "";

  return `
    <main class="caregiver-main portal-mobile direct-messages-main care-team-main">
      <section class="home-hero home-hero--caregiver home-hero--compact">
        <div class="home-hero-inner">
          <p class="home-eyebrow">Caregiver · ${escapeHtml(session.displayName || "Caregiver")}</p>
          <p class="home-hero-tagline">Emergency contacts</p>
          <p class="home-lead">Call or text when something feels urgent. In-app notes are a backup only.</p>
        </div>
      </section>
      ${emergencyBanner}
      ${roster}
      ${contactBlock}
      ${noteSection}
    </main>`;
}

export function bindDirectChatForm(root, formId, { onSend, onRefresh }) {
  const form = root.querySelector(`#${formId}`);
  if (!form) return;

  form.querySelector(`#${formId}Refresh`)?.addEventListener("click", () => onRefresh?.());
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = form.querySelector(`#${formId}Input`);
    const urgentEl = form.querySelector(`#${formId}Urgent`);
    const msgEl = form.querySelector(`#${formId}Msg`);
    const text = (input?.value || "").trim();
    if (!text) return;
    if (msgEl) msgEl.textContent = "Sending…";
    try {
      await onSend({ text, urgent: Boolean(urgentEl?.checked) });
      if (input) input.value = "";
      if (urgentEl) urgentEl.checked = false;
      if (msgEl) msgEl.textContent = "Sent.";
    } catch (err) {
      if (msgEl) msgEl.textContent = err instanceof Error ? err.message : String(err);
    }
  });
}

export function scrollDirectChatToBottom(root) {
  const log = root.querySelector("#directChatLog");
  if (log) log.scrollTop = log.scrollHeight;
}
