const TOKEN_KEY = "pdportal_v1:api_token";

let probeCache = null;

export async function probeBackend() {
  if (probeCache !== null) return probeCache;
  try {
    const r = await fetch("/api/health", { method: "GET" });
    probeCache = r.ok;
  } catch {
    probeCache = false;
  }
  return probeCache;
}

export function resetBackendProbe() {
  probeCache = null;
}

export function getApiToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setApiToken(token) {
  if (token == null) {
    sessionStorage.removeItem(TOKEN_KEY);
    return;
  }
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearApiToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const t = getApiToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const r = await fetch(`/api${path}`, { ...options, headers });
  const text = await r.text();
  if (!r.ok) {
    let detail = text || r.statusText;
    try {
      const j = JSON.parse(text);
      if (j && j.detail) detail = Array.isArray(j.detail) ? j.detail.map((d) => d.msg || d).join("; ") : String(j.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (!text) return null;
  return JSON.parse(text);
}
