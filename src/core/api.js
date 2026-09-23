// ═══════════════════════════════════════════════════════════════
//  طبقة الاتصال بالباك إند — لوحة أدمن المنصة (ounce-admin)
// ═══════════════════════════════════════════════════════════════
//
// ⚠ تطبيق ثالث منفصل عن الفرع (ounce-frontend) والمتجر (ounce-central)،
// لكنه يتصل بنفس الباك إند عبر مسارات /api/platform/* وحدها (راجع
// platform.routes.js). توكنه scope: "platform"، ولا يمر على أي مسار آخر.

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

// ⚠ مفتاح تخزين مختلف عن توكن الفرع والمتجر — لا تختلط الجلسات أبدًا
// حتى لو فُتحت التطبيقات الثلاثة في نفس المتصفح.
const TOKEN_STORAGE_KEY = "ounce_platform_auth_token_v1";

let authToken = null;
try {
  authToken = localStorage.getItem(TOKEN_STORAGE_KEY) || null;
} catch {
  // localStorage غير متاح — الجلسة تبقى في الذاكرة فقط.
}

function setAuthToken(token) {
  authToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // تجاهل
  }
}

function hasToken() {
  return !!authToken;
}

class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body || {};
  }
}

async function apiFetch(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let payload = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: "invalid_response", raw: text };
    }
  }
  if (!res.ok) throw new ApiError(res.status, payload);
  return payload;
}

// ── الدخول ──

function fetchSetupStatus() {
  return apiFetch("/platform/auth/setup-status");
}

/** أول حساب أدمن على منصة جديدة — يحتاج PLATFORM_ADMIN_KEY مرة واحدة فقط. */
async function setupFirstAdmin({ platformKey, name, email, password }) {
  const res = await apiFetch("/platform/auth/setup", {
    method: "POST",
    body: { name, email, password },
    headers: { "x-platform-admin-key": platformKey },
  });
  setAuthToken(res.token);
  return res;
}

async function login({ email, password }) {
  const res = await apiFetch("/platform/auth/login", { method: "POST", body: { email, password } });
  setAuthToken(res.token);
  return res;
}

function fetchMe() {
  return apiFetch("/platform/auth/me");
}

function logout() {
  setAuthToken(null);
}

// ── المتاجر ──

function listStores() {
  return apiFetch("/platform/stores");
}

function createStore(data) {
  return apiFetch("/platform/stores", { method: "POST", body: data });
}

function getStore(id) {
  return apiFetch(`/platform/stores/${encodeURIComponent(id)}`);
}

function updateStore(id, patch) {
  return apiFetch(`/platform/stores/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
}

function renewStore(id, months) {
  return apiFetch(`/platform/stores/${encodeURIComponent(id)}/renew`, { method: "POST", body: { months } });
}

function setStoreStatus(id, status, reason) {
  return apiFetch(`/platform/stores/${encodeURIComponent(id)}/status`, {
    method: "POST",
    body: { status, reason },
  });
}

function setBranchOperatingModel(branchId, operatingModel) {
  return apiFetch(`/platform/branches/${encodeURIComponent(branchId)}/operating-model`, {
    method: "PATCH",
    body: { operatingModel },
  });
}

function fetchLog({ storeId, limit } = {}) {
  const q = new URLSearchParams();
  if (storeId) q.set("storeId", storeId);
  if (limit) q.set("limit", String(limit));
  const qs = q.toString();
  return apiFetch(`/platform/log${qs ? `?${qs}` : ""}`);
}

export {
  ApiError,
  hasToken,
  fetchSetupStatus,
  setupFirstAdmin,
  login,
  fetchMe,
  logout,
  listStores,
  createStore,
  getStore,
  updateStore,
  renewStore,
  setStoreStatus,
  setBranchOperatingModel,
  fetchLog,
};
