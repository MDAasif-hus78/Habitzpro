/**
 * ═══════════════════════════════════════════════════════════════
 *  HabitzPro — Frontend ↔ Backend Integration Guide
 *  api.js  (drop this file in your html project folder)
 * ═══════════════════════════════════════════════════════════════
 *
 *  This file replaces the localStorage-only approach in the
 *  dashboard/auth HTML files with real API calls to the backend.
 *
 *  USAGE
 *  ──────
 *  1.  Add  <script src="api.js"></script>  in every HTML page
 *      BEFORE the page's own <script> block.
 *  2.  Replace localStorage reads/writes with the helpers below.
 *
 *  All functions return Promises.  Use  await  or  .then()/.catch().
 */

// ── Config ────────────────────────────────────────────────────
const API_BASE = 'http://localhost:5000/api';   // ← change to your deployed URL in production

// ── Token helpers ─────────────────────────────────────────────
const Auth = {
  getToken:    ()      => localStorage.getItem('hp_token'),
  setToken:    (t)     => localStorage.setItem('hp_token', t),
  removeToken: ()      => localStorage.removeItem('hp_token'),
  isLoggedIn:  ()      => !!localStorage.getItem('hp_token'),
};

// ── Base fetch wrapper ────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = Auth.getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.errors = data.errors;
    throw err;
  }
  return data;
}

// ── File upload (multipart) ───────────────────────────────────
async function apiUpload(endpoint, formData) {
  const token = Auth.getToken();
  const res   = await fetch(`${API_BASE}${endpoint}`, {
    method:  'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body:    formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.message); e.status = res.status; throw e; }
  return data;
}

// ═══════════════════════════════════════════════════════════════
//  AUTH API
// ═══════════════════════════════════════════════════════════════

const AuthAPI = {

  /** Register a new user */
  async register({ firstName, lastName, email, password }) {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body:   JSON.stringify({ firstName, lastName, email, password }),
    });
    Auth.setToken(data.token);
    _cacheUser(data.user);
    return data;
  },

  /** Log in */
  async login({ email, password }) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body:   JSON.stringify({ email, password }),
    });
    Auth.setToken(data.token);
    _cacheUser(data.user);
    return data;
  },

  /** Get current user from the server */
  async me() {
    const data = await apiFetch('/auth/me');
    _cacheUser(data.user);
    return data.user;
  },

  /** Update name / email / bio / theme */
  async updateProfile(fields) {
    const data = await apiFetch('/auth/update-profile', {
      method: 'PUT',
      body:   JSON.stringify(fields),
    });
    _cacheUser(data.user);
    return data.user;
  },

  /** Change password */
  async changePassword({ currentPassword, newPassword }) {
    return apiFetch('/auth/change-password', {
      method: 'PUT',
      body:   JSON.stringify({ currentPassword, newPassword }),
    });
  },

  /** Request password reset code */
  async forgotPassword(email) {
    return apiFetch('/auth/forgot-password', {
      method: 'POST',
      body:   JSON.stringify({ email }),
    });
  },

  /** Reset password with code */
  async resetPassword({ email, code, newPassword }) {
    const data = await apiFetch('/auth/reset-password', {
      method: 'POST',
      body:   JSON.stringify({ email, code, newPassword }),
    });
    Auth.setToken(data.token);
    _cacheUser(data.user);
    return data;
  },

  /** Log out (clears token + cached data) */
  logout() {
    Auth.removeToken();
    localStorage.removeItem('hp_user');
    // Optional: redirect
    window.location.href = 'login.html';
  },
};

// ═══════════════════════════════════════════════════════════════
//  USER API
// ═══════════════════════════════════════════════════════════════

const UserAPI = {

  /** Get full profile */
  async getProfile() {
    const data = await apiFetch('/users/profile');
    _cacheUser(data.user);
    return data.user;
  },

  /** Upload avatar image (File object) */
  async uploadAvatar(file) {
    const form = new FormData();
    form.append('avatar', file);
    const data = await apiUpload('/users/avatar', form);
    // Update cached avatar
    const user = _getCachedUser();
    if (user) { user.avatarUrl = data.avatarUrl; _cacheUser(user); }
    return data.avatarUrl;
  },

  /** Remove avatar */
  async removeAvatar() {
    await apiFetch('/users/avatar', { method: 'DELETE' });
    const user = _getCachedUser();
    if (user) { user.avatarUrl = ''; _cacheUser(user); }
  },

  /** Save theme preference to server */
  async updateTheme(theme) {
    return apiFetch('/users/theme', {
      method: 'PUT',
      body:   JSON.stringify({ theme }),
    });
  },

  /** Permanently delete account */
  async deleteAccount() {
    await apiFetch('/users/account', { method: 'DELETE' });
    Auth.removeToken();
    localStorage.clear();
    window.location.href = 'Main_file.html';
  },
};

// ═══════════════════════════════════════════════════════════════
//  HABITS API
// ═══════════════════════════════════════════════════════════════

const HabitsAPI = {

  /** Fetch all habits (optional filters: category, search, archived) */
  async getAll(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const data = await apiFetch(`/habits${qs ? '?' + qs : ''}`);
    return data.habits;
  },

  /** Get single habit */
  async get(id) {
    const data = await apiFetch(`/habits/${id}`);
    return data.habit;
  },

  /** Create habit */
  async create({ name, emoji, category, note, goal }) {
    const data = await apiFetch('/habits', {
      method: 'POST',
      body:   JSON.stringify({ name, emoji, category, note, goal }),
    });
    return data.habit;
  },

  /** Update habit */
  async update(id, fields) {
    const data = await apiFetch(`/habits/${id}`, {
      method: 'PUT',
      body:   JSON.stringify(fields),
    });
    return data.habit;
  },

  /** Delete habit */
  async delete(id) {
    return apiFetch(`/habits/${id}`, { method: 'DELETE' });
  },

  /** Archive / unarchive */
  async archive(id) {
    const data = await apiFetch(`/habits/${id}/archive`, { method: 'PATCH' });
    return data.isArchived;
  },

  /** Toggle today's completion */
  async toggleToday(id) {
    const data = await apiFetch(`/habits/${id}/toggle`, { method: 'PATCH' });
    return { completed: data.completed, streak: data.streak };
  },

  /** Toggle a specific date (YYYY-MM-DD) */
  async toggleDate(id, date) {
    const data = await apiFetch(`/habits/${id}/date`, {
      method: 'PATCH',
      body:   JSON.stringify({ date }),
    });
    return { completed: data.completed, streak: data.streak };
  },

  /** Toggle a cell in the monthly tracking chart */
  async toggleChartCell(id, { year, month, day }) {
    const data = await apiFetch(`/habits/${id}/chart-cell`, {
      method: 'PATCH',
      body:   JSON.stringify({ year, month, day }),
    });
    return data.ticked;
  },

  /** Update the goal (day count) for a habit */
  async updateGoal(id, goal) {
    const data = await apiFetch(`/habits/${id}/goal`, {
      method: 'PATCH',
      body:   JSON.stringify({ goal }),
    });
    return data.goal;
  },

  /** Analytics summary */
  async getAnalytics() {
    const data = await apiFetch('/habits/analytics/summary');
    return data.analytics;
  },

  /** Achievements */
  async getAchievements() {
    const data = await apiFetch('/habits/analytics/achievements');
    return data.achievements;
  },
};

// ═══════════════════════════════════════════════════════════════
//  LOCAL CACHE HELPERS  (keeps UI snappy — one source of truth)
// ═══════════════════════════════════════════════════════════════

function _cacheUser(user) {
  if (!user) return;
  localStorage.setItem('hp_user',       JSON.stringify(user));
  // Keep legacy keys so existing dashboard HTML keeps working
  localStorage.setItem('hpUserName',  user.displayName || `${user.firstName} ${user.lastName}`);
  localStorage.setItem('hpUserEmail', user.email);
  if (user.theme) localStorage.setItem('hpTheme', user.theme);
}

function _getCachedUser() {
  try { return JSON.parse(localStorage.getItem('hp_user') || 'null'); }
  catch { return null; }
}

/** Returns cached user synchronously — use for fast UI renders */
function getCurrentUser() {
  return _getCachedUser();
}

// ═══════════════════════════════════════════════════════════════
//  ROUTE GUARD  — call at the top of protected pages
// ═══════════════════════════════════════════════════════════════

/**
 * Redirects to login.html if no token is present.
 * Also refreshes user info from the server.
 *
 * Usage (top of dashboard.html script):
 *   await requireAuth();
 */
async function requireAuth(redirectTo = 'login.html') {
  if (!Auth.isLoggedIn()) {
    window.location.href = redirectTo;
    return null;
  }
  try {
    const user = await AuthAPI.me();
    return user;
  } catch {
    Auth.removeToken();
    window.location.href = redirectTo;
    return null;
  }
}

/**
 * Redirects logged-in users away from auth pages (login, signup).
 * Usage (top of login.html script):
 *   redirectIfLoggedIn('dashboard.html');
 */
function redirectIfLoggedIn(redirectTo = 'dashboard.html') {
  if (Auth.isLoggedIn()) window.location.href = redirectTo;
}

// ── Expose globally ───────────────────────────────────────────
window.HabitzAPI = { Auth, AuthAPI, UserAPI, HabitsAPI, requireAuth, redirectIfLoggedIn, getCurrentUser };
