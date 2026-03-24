// Kitchen App — Admin Settings & Multi-User Auth
// Admin authentication is server-side (Netlify Function admin-auth.js).
// Kitchen user sessions are stored in localStorage.

const SETTINGS = (() => {
  const STORE_KEY  = 'kit_settings';
  const ADMIN_SES  = 'kit_admin_session';
  const USER_SES   = 'kit_user_session';
  const ADMIN_TTL  = 8  * 3600 * 1000;   // 8 hours
  const USER_TTL   = 12 * 3600 * 1000;   // 12 hours

  const DEFAULTS = {
    adminUser:     'admin',
    adminPassB64:  '',      // local-dev fallback only — set a password via loginAdmin() or use server-side auth
    requireLogin:  false,   // when true, pages redirect to login.html
    allowNewOrder: true,    // global fallback (used when requireLogin=false)
    allowAddDish:  true,    // global fallback
    users: [],              // array of user objects
    uiFontSize:    'medium',  // 'small' | 'medium' | 'large'
    uiColorAccent: 'orange',  // 'orange' | 'blue' | 'green' | 'purple'
  };

  // ── Storage ──
  function _load() {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') }; }
    catch { return { ...DEFAULTS }; }
  }
  function get(key)  { return _load()[key]; }
  function getAll()  { return _load(); }
  function save(patch) {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ..._load(), ...patch }));
  }

  // ── Admin session (for admin.html) ──
  function isAdmin() {
    return Date.now() - parseInt(localStorage.getItem(ADMIN_SES) || '0', 10) < ADMIN_TTL;
  }
  function loginAdmin(user, pass) {
    const cfg = _load();
    if (user === cfg.adminUser && btoa(pass) === cfg.adminPassB64) {
      localStorage.setItem(ADMIN_SES, String(Date.now()));
      return true;
    }
    return false;
  }
  function logoutAdmin() { localStorage.removeItem(ADMIN_SES); }

  // ── User management ──
  // User schema: { id, username, passB64, allowCreateOrder, viewDates, allowedOrderStatuses, allowChangeOrderStatus, allowedCategories, allowViewProduction }
  // viewDates: 'today' | 'all'
  // allowedOrderStatuses: [] = see all, or ['status1','status2'] = restricted to those
  // allowChangeOrderStatus: boolean
  // allowedCategories: [] = see all dish categories, or ['Cat1','Cat2'] = restricted to those dishes
  // allowViewProduction: boolean — can access the daily production summary page
  function getUsers() { return _load().users || []; }

  function addUser(u) {
    const users = getUsers();
    users.push({ id: 'u_' + Date.now(), ...u });
    save({ users });
  }
  function updateUser(id, patch) {
    save({ users: getUsers().map(u => u.id === id ? { ...u, ...patch } : u) });
  }
  function deleteUser(id) {
    save({ users: getUsers().filter(u => u.id !== id) });
  }

  // ── User session (for kitchen pages) ──

  // Called after server-side admin auth succeeds — creates a kitchen session without password.
  function loginAdminDirect(username) {
    const ses = { userId: '__admin__', username: username || 'admin', isAdmin: true,
                  allowCreateOrder: true, viewDates: 'all',
                  allowedOrderStatuses: [], allowChangeOrderStatus: true,
                  allowedCategories: [], allowViewProduction: true,
                  allowEditNotes: true, allowEditOrder: true,
                  loginTime: Date.now() };
    localStorage.setItem(USER_SES, JSON.stringify(ses));
    localStorage.setItem(ADMIN_SES, String(Date.now()));  // keep isAdmin() working
  }

  function loginUser(username, pass) {
    const cfg = _load();
    // Admin password check is now server-side only; kept here as fallback for local dev.
    if (username === cfg.adminUser && btoa(pass) === cfg.adminPassB64) {
      const ses = { userId: '__admin__', username: cfg.adminUser, isAdmin: true,
                    allowCreateOrder: true, viewDates: 'all',
                    allowedOrderStatuses: [], allowChangeOrderStatus: true,
                    allowedCategories: [], allowViewProduction: true,
                    allowEditNotes: true, allowEditOrder: true,
                    loginTime: Date.now() };
      localStorage.setItem(USER_SES, JSON.stringify(ses));
      return true;
    }
    const user = getUsers().find(u => u.username === username && btoa(pass) === u.passB64);
    if (user) {
      const ses = { userId: user.id, username: user.username, isAdmin: false,
                    allowCreateOrder: !!user.allowCreateOrder, viewDates: user.viewDates || 'today',
                    allowedOrderStatuses: user.allowedOrderStatuses || [],
                    allowChangeOrderStatus: !!user.allowChangeOrderStatus,
                    allowedCategories: user.allowedCategories || [],
                    allowViewProduction: !!user.allowViewProduction,
                    allowEditNotes: !!user.allowEditNotes,
                    allowEditOrder: !!user.allowEditOrder,
                    loginTime: Date.now() };
      localStorage.setItem(USER_SES, JSON.stringify(ses));
      return true;
    }
    return false;
  }

  function getCurrentUser() {
    try {
      const ses = JSON.parse(localStorage.getItem(USER_SES) || 'null');
      if (!ses) return null;
      if (Date.now() - ses.loginTime > USER_TTL) { logoutUser(); return null; }
      return ses;
    } catch { return null; }
  }

  function logoutUser() { localStorage.removeItem(USER_SES); }

  // ── Permission helpers ──
  function canCreateOrder() {
    const u = getCurrentUser();
    if (u) return u.isAdmin || u.allowCreateOrder;
    return get('allowNewOrder') || isAdmin();   // no-login fallback
  }
  function canAddDish() {
    const u = getCurrentUser();
    if (u) return u.isAdmin || u.allowCreateOrder;
    return get('allowAddDish') || isAdmin();
  }
  function canViewAllDates() {
    const u = getCurrentUser();
    if (u) return u.isAdmin || u.viewDates === 'all';
    return true;   // no-login mode → no restriction
  }
  // Returns array of allowed order statuses. Empty array = see all.
  function getAllowedStatuses() {
    const u = getCurrentUser();
    if (!u) return [];           // no-login mode: see all
    if (u.isAdmin) return [];    // admin sees all
    return u.allowedOrderStatuses || [];
  }
  // Returns true if the current user can update order status in Airtable.
  function canChangeOrderStatus() {
    const u = getCurrentUser();
    if (!u) return false;
    return u.isAdmin || !!u.allowChangeOrderStatus;
  }
  // Returns true if the current user can access the production summary page.
  function canViewProduction() {
    const u = getCurrentUser();
    if (!u) return false;
    return u.isAdmin || !!u.allowViewProduction;
  }
  // Returns array of allowed dish categories. Empty array = see all.
  function getAllowedCategories() {
    const u = getCurrentUser();
    if (!u) return [];         // no-login mode: see all
    if (u.isAdmin) return [];  // admin sees all
    return u.allowedCategories || [];
  }
  // Returns true if the current user can edit kitchen notes on line items.
  function canEditNotes() {
    const u = getCurrentUser();
    if (!u) return isAdmin();
    return u.isAdmin || !!u.allowEditNotes;
  }
  // Returns true if the current user can change qty or remove dishes from an order.
  function canEditOrder() {
    const u = getCurrentUser();
    if (!u) return isAdmin();
    return u.isAdmin || !!u.allowEditOrder;
  }

  // Redirect to login.html if requireLogin is on and no valid session.
  // Call this synchronously in <head> (not in DOMContentLoaded) to prevent flash.
  function checkLoginRequired() {
    if (!get('requireLogin')) return true;
    if (getCurrentUser()) return true;
    document.documentElement.style.visibility = 'hidden';
    location.replace('login.html?redirect=' + encodeURIComponent(location.href));
    return false;
  }

  // Apply appearance settings (font size + accent color) to CSS variables.
  function applyAppearance() {
    const cfg = _load();
    const root = document.documentElement;
    const sizes = { small: '14px', medium: '16px', large: '18px' };
    root.style.setProperty('--base-font', sizes[cfg.uiFontSize] || '16px');
    const accents = {
      orange: { p: '#FF6B35', p2: '#FF9A6C' },
      blue:   { p: '#58A6FF', p2: '#88C5FF' },
      green:  { p: '#3FB950', p2: '#7ECA9C' },
      purple: { p: '#BC8CFF', p2: '#D5AAFF' },
    };
    const a = accents[cfg.uiColorAccent] || accents.orange;
    root.style.setProperty('--primary',  a.p);
    root.style.setProperty('--primary2', a.p2);
  }

  return {
    get, getAll, save,
    isAdmin, loginAdmin, logoutAdmin, loginAdminDirect,
    getUsers, addUser, updateUser, deleteUser,
    loginUser, getCurrentUser, logoutUser,
    canCreateOrder, canAddDish, canViewAllDates, getAllowedStatuses, canChangeOrderStatus, getAllowedCategories, canViewProduction, canEditNotes, canEditOrder,
    checkLoginRequired, applyAppearance,
  };
})();
