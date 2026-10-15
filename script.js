/* ═══════════════════════════════════════════════════════
   MMMS – Mubiligi Multipurpose Management System
   script.js  –  Full front-end logic (localStorage)
═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── HELPERS ──────────────────────────────────────
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const id = (n) => document.getElementById(n);
  const ls = (k, v) => { if (v === undefined) { try { const d = localStorage.getItem('mub_' + k); return d ? JSON.parse(d) : null; } catch { return null; } } localStorage.setItem('mub_' + k, JSON.stringify(v)); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const today = () => new Date().toISOString().slice(0, 10);
  const now = () => new Date().toISOString();
  const fmt = (d) => { if (!d) return '—'; const dt = new Date(d); return dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
  const dfmt = (d) => d ? new Date(d).toLocaleDateString() : '—';
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // ─── PAGINATION ────────────────────────────────────
  const PG = {};
  const PAGE_SIZE = 50;
  function pg(key, list) {
    if (!PG[key]) PG[key] = { page: 0 };
    const s = PG[key];
    const pages = Math.ceil(list.length / PAGE_SIZE) || 1;
    if (s.page >= pages) s.page = Math.max(0, pages - 1);
    const start = s.page * PAGE_SIZE;
    const slice = list.slice(start, start + PAGE_SIZE);
    return { items: slice, page: s.page, pages, start: start + 1 };
  }
  function pgCtrl(key, total) {
    return `<div class="pagination"><span class="pg-info">${pgStart(key)}–${pgEnd(key, total)} of ${total}</span><div class="pg-btns">${PG[key].page > 0 ? '<button class="btn btn-sm btn-ghost" onclick="pgGo(\'' + key + '\',' + (PG[key].page - 1) + ')">‹ Prev</button>' : ''}${PG[key].page < Math.ceil(total / PAGE_SIZE) - 1 ? '<button class="btn btn-sm btn-ghost" onclick="pgGo(\'' + key + '\',' + (PG[key].page + 1) + ')">Next ›</button>' : ''}</div></div>`;
  }
  function pgStart(key) { const s = PG[key]; return s ? s.page * PAGE_SIZE + 1 : 1; }
  function pgEnd(key, total) { const s = PG[key]; return s ? Math.min((s.page + 1) * PAGE_SIZE, total) : total; }
  window.pgGo = (key, p) => { if (PG[key]) { PG[key].page = p; const fn = pgFns[key]; if (fn) fn(); } };
  const pgFns = {};

  // ─── PERSISTENT STORAGE ──────────────────────────
  const SERVER_URL = 'http://localhost:3456';
  let syncTimer = null;
  let syncBusy = false;
  let syncQueued = false;

  async function doSync() {
    if (syncBusy) { syncQueued = true; return; }
    syncBusy = true;
    syncQueued = false;
    try {
      await fetch(SERVER_URL + '/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users, consumables, borrows, foodItems, deliveries, issues,
          consumption, equipment, damages, suppliers, activities, auditTrail,
          notifications, breakfastSettings, breakfastPlans,
          agasekeRecords, agasekeProducts, welfareRecords, theme
        })
      });
    } catch { /* server offline — data stays in localStorage */ }
    finally {
      syncBusy = false;
      if (syncQueued) doSync();
    }
  }

  function syncToServer() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(doSync, 500);
  }

  async function loadFromServer() {
    try {
      const res = await fetch(SERVER_URL + '/api/data');
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !Object.keys(data).length) return;
      // Only load if server has more data than localStorage
      const serverUsers = data.users || [];
      const localUsers = ls('users') || [];
      if (serverUsers.length >= localUsers.length) {
        users = data.users || users;
        consumables = data.consumables || consumables;
        borrows = data.borrows || borrows;
        foodItems = data.foodItems || foodItems;
        deliveries = data.deliveries || deliveries;
        issues = data.issues || issues;
        consumption = data.consumption || consumption;
        equipment = data.equipment || equipment;
        damages = data.damages || damages;
        suppliers = data.suppliers || suppliers;
        activities = data.activities || activities;
        auditTrail = data.auditTrail || auditTrail;
        notifications = data.notifications || notifications;
        breakfastSettings = data.breakfastSettings || breakfastSettings;
        breakfastPlans = data.breakfastPlans || breakfastPlans;
        agasekeRecords = data.agasekeRecords || agasekeRecords;
        agasekeProducts = data.agasekeProducts || agasekeProducts;
        welfareRecords = data.welfareRecords || welfareRecords;
        theme = data.theme || theme;
        saveAll();
      }
    } catch { /* server offline — use localStorage */ }
  }

  // ─── SECURITY HELPERS ────────────────────────────
  const sanitize = (str) => { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; };

  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 5 * 60 * 1000;
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

  async function hashPassword(password) {
    const enc = new TextEncoder().encode(password);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function validatePassword(pw) {
    if (!pw || pw.length < 8) return 'Min 8 characters';
    if (!/[A-Z]/.test(pw)) return 'Needs an uppercase letter';
    if (!/[a-z]/.test(pw)) return 'Needs a lowercase letter';
    if (!/[0-9]/.test(pw)) return 'Needs a digit';
    if (!/[^A-Za-z0-9]/.test(pw)) return 'Needs a special character';
    return null;
  }

  function getLoginAttempts(username) {
    const data = ls('login_' + username);
    if (!data) return { count: 0, lockedUntil: null };
    if (data.lockedUntil && Date.now() >= data.lockedUntil) {
      ls('login_' + username, null);
      return { count: 0, lockedUntil: null };
    }
    return data;
  }

  function recordFailedAttempt(username) {
    const data = getLoginAttempts(username);
    data.count = (data.count || 0) + 1;
    if (data.count >= MAX_LOGIN_ATTEMPTS) {
      data.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    }
    ls('login_' + username, data);
  }

  function resetLoginAttempts(username) {
    ls('login_' + username, null);
  }

  // ─── STATE ─────────────────────────────────────────
  let session = ls('session') || null;
  let users = ls('users') || [];
  let consumables = ls('consumables') || [];
  let borrows = ls('borrows') || [];
  let foodItems = ls('foodItems') || [];
  let deliveries = ls('deliveries') || [];
  let issues = ls('issues') || [];
  let consumption = ls('consumption') || [];
  let equipment = ls('equipment') || [];
  let damages = ls('damages') || [];
  let suppliers = ls('suppliers') || [];
  let activities = ls('activities') || [];
  let notifications = ls('notifications') || [];
  let breakfastSettings = ls('breakfastSettings') || null;
  let breakfastPlans = ls('breakfastPlans') || [];
  let agasekeRecords = ls('agasekeRecords') || [];
  let welfareRecords = ls('welfareRecords') || [];
  let welfareFilter = 'active';
  let agasekeProducts = ls('agasekeProducts') || {
    fermented_milk: { name: 'Fermented Milk', defaultQty: 1, unit: 'Litre' },
    eggs: { name: 'Eggs', defaultQty: 1, unit: 'Piece' },
    yellow_bananas: { name: 'Yellow Bananas', defaultQty: 2, unit: 'Piece' }
  };

  let theme = ls('theme') || 'light';

  function saveAll() {
    ls('consumables', consumables);
    ls('borrows', borrows);
    ls('foodItems', foodItems);
    ls('deliveries', deliveries);
    ls('issues', issues);
    ls('consumption', consumption);
    ls('equipment', equipment);
    ls('damages', damages);
    ls('suppliers', suppliers);
    ls('activities', activities);
    ls('auditTrail', auditTrail);
    ls('notifications', notifications);
    ls('breakfastSettings', breakfastSettings);
    ls('breakfastPlans', breakfastPlans);
    ls('agasekeRecords', agasekeRecords);
    ls('agasekeProducts', agasekeProducts);
    ls('welfareRecords', welfareRecords);
    ls('users', users);
    ls('theme', theme);
    syncToServer();
  }

  let auditTrail = ls('auditTrail') || [];

  function addAudit(action, itemType, itemId, details) {
    auditTrail.unshift({
      id: uid(),
      timestamp: now(),
      userId: session?.userId || 'system',
      userName: session?.userName || 'System',
      userRole: session?.userRole || 'system',
      action,
      itemType: itemType || null,
      itemId: itemId || null,
      details
    });
    if (auditTrail.length > 1000) auditTrail.length = 1000;
    saveAll();
  }

  function addActivity(action, category, details) {
    activities.unshift({
      id: uid(),
      timestamp: now(),
      userId: session?.userId || 'system',
      userName: session?.userName || 'System',
      action,
      category,
      details
    });
    if (activities.length > 500) activities.length = 500;
    auditTrail.unshift({
      id: uid(),
      timestamp: now(),
      userId: session?.userId || 'system',
      userName: session?.userName || 'System',
      userRole: session?.userRole || 'system',
      action,
      itemType: category || null,
      itemId: null,
      details
    });
    if (auditTrail.length > 1000) auditTrail.length = 1000;
  }

  function addNotification(type, title, message) {
    notifications.unshift({
      id: uid(),
      timestamp: now(),
      type,
      title,
      message,
      read: false
    });
    if (notifications.length > 200) notifications.length = 200;
    updateBadges();
  }

  function getUnreadNotif() { return notifications.filter(n => !n.read).length; }
  function getActiveBorrows() { return borrows.filter(b => b.status === 'active'); }
  function getExpiringSoon(days = 14) {
    const limit = new Date();
    limit.setDate(limit.getDate() + days);
    return foodItems.filter(f => f.expiryDate && new Date(f.expiryDate) <= limit && new Date(f.expiryDate) >= new Date());
  }

  function getLowConsumables() { return consumables.filter(c => c.qty <= c.min); }
  function getLowFood() { return foodItems.filter(f => f.qty <= f.min); }
  function getDamagedCount() { return damages.length; }

  // ─── TOAST ─────────────────────────────────────────
  function toast(msg, type = 'info') {
    const c = id('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3500);
  }

  // ─── MODAL ─────────────────────────────────────────
  function openModal(elId) {
    const el = id(elId);
    if (!el) return;
    el.classList.add('open');
    id('modalBackdrop').classList.add('open');
  }

  function closeModal(elId) {
    const el = id(elId);
    if (el) el.classList.remove('open');
    id('modalBackdrop').classList.remove('open');
  }

  function closeActiveModal() {
    $$('.modal.open').forEach(m => m.classList.remove('open'));
    id('modalBackdrop').classList.remove('open');
  }

  // ─── CONFIRM ───────────────────────────────────────
  let confirmCb = null;
  function confirmAction(title, msg, cb) {
    id('confirmTitle').textContent = title;
    id('confirmMsg').textContent = msg;
    id('confirmDialog').classList.add('open');
    id('modalBackdrop').classList.add('open');
    confirmCb = cb;
  }
  function closeConfirm() {
    id('confirmDialog').classList.remove('open');
    id('modalBackdrop').classList.remove('open');
    confirmCb = null;
  }
  id('confirmOk').addEventListener('click', () => {
    if (confirmCb) confirmCb();
    closeConfirm();
  });

  // ─── THEME ─────────────────────────────────────────
  function applyTheme(t) {
    theme = t;
    document.documentElement.setAttribute('data-theme', t);
    id('themeBtn').textContent = t === 'dark' ? '☀️' : '🌙';
    if (id('darkSw')) id('darkSw').checked = t === 'dark';
    ls('theme', theme);
  }

  function toggleTheme() {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  }

  function applyThemeSw(el) {
    applyTheme(el.checked ? 'dark' : 'light');
  }

  // ─── AUTH ──────────────────────────────────────────
  function switchTab(tab) {
    const fLogin = id('loginForm');
    const fReg = id('registerForm');
    const tA = id('tabA');
    const tB = id('tabB');
    if (tab === 'login') {
      fLogin.classList.remove('hidden');
      fReg.classList.add('hidden');
      tA.classList.add('active');
      tB.classList.remove('active');
    } else {
      fLogin.classList.add('hidden');
      fReg.classList.remove('hidden');
      tA.classList.remove('active');
      tB.classList.add('active');
    }
    id('loginAlert').classList.add('hidden');
    id('regAlert').classList.add('hidden');
  }

  function showAlert(elId, msg, type = 'error') {
    const el = id(elId);
    el.textContent = msg;
    el.className = 'falert ' + type;
    el.classList.remove('hidden');
  }

  function hideAlert(elId) {
    id(elId).classList.add('hidden');
  }

  function eyeT(fieldId, btn) {
    const inp = id(fieldId);
    if (!inp) return;
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
    else { inp.type = 'password'; btn.textContent = '👁'; }
  }

  function clearErr(prefix) {
    $$(`[id^="${prefix}"]`).forEach(el => { if (el.className === 'ferr') el.textContent = ''; });
  }

  async function doLogin(e) {
    e.preventDefault();
    hideAlert('loginAlert');
    clearErr('li');
    const u = id('liU').value.trim();
    const p = id('liP').value;
    if (!u) { id('liUe').textContent = 'Username required'; return; }
    if (!p) { id('liPe').textContent = 'Password required'; return; }

    const attempts = getLoginAttempts(u);
    if (attempts.lockedUntil) {
      const remaining = Math.ceil((attempts.lockedUntil - Date.now()) / 1000 / 60);
      showAlert('loginAlert', 'Account locked. Try again in ' + remaining + ' min');
      addAudit('Failed login (locked)', 'auth', null, 'Username: ' + u);
      return;
    }

    const user = users.find(x => x.username === u);
    if (!user) {
      recordFailedAttempt(u);
      showAlert('loginAlert', 'Invalid username or password');
      addAudit('Failed login', 'auth', null, 'Username: ' + u + ' — not found');
      return;
    }

    const hashed = await hashPassword(p);
    if (user.password !== hashed) {
      recordFailedAttempt(u);
      showAlert('loginAlert', 'Invalid username or password');
      addAudit('Failed login', 'auth', null, 'Username: ' + u + ' — wrong password');
      return;
    }

    resetLoginAttempts(u);
    session = { userId: user.id, userName: user.name, userRole: user.role, loginTime: Date.now(), lastActivity: Date.now() };
    ls('session', session);
    addActivity('Login', 'auth', user.name + ' logged in');
    saveAll();
    showApp();
    startIdleMonitor();
  }

  async function doRegister(e) {
    e.preventDefault();
    hideAlert('regAlert');
    clearErr('r');
    const nm = id('rnm').value.trim();
    const usr = id('rusr').value.trim();
    const rol = id('rrol').value;
    const pw = id('rpw').value;
    const cf = id('rcf').value;
    let ok = true;
    if (!nm) { id('rnme').textContent = 'Name required'; ok = false; }
    if (!usr) { id('rusre').textContent = 'Username required'; ok = false; }
    else if (users.find(x => x.username === usr)) { id('rusre').textContent = 'Username taken'; ok = false; }
    const pwErr = validatePassword(pw);
    if (pwErr) { id('rpwe').textContent = pwErr; ok = false; }
    if (pw !== cf) { id('rcfe').textContent = 'Passwords do not match'; ok = false; }
    if (!ok) return;
    const user = {
      id: uid(),
      name: nm,
      username: usr,
      role: rol,
      password: await hashPassword(pw),
      createdAt: now()
    };
    users.push(user);
    saveAll();
    addActivity('Registered user: ' + nm + ' (' + rol + ')', 'auth', 'New account created');
    showAlert('regAlert', 'Account created! Please sign in.', 'success');
    setTimeout(() => switchTab('login'), 800);
  }

  function doLogout() {
    stopIdleMonitor();
    addActivity('Logout', 'auth', session?.userName + ' logged out');
    saveAll();
    session = null;
    ls('session', null);
    id('authScreen').classList.remove('hidden');
    id('appShell').classList.add('hidden');
  }

  // ─── IDLE MONITOR ──────────────────────────────────
  let idleTimer = null;
  let idleLockEnabled = true;

  function startIdleMonitor() {
    stopIdleMonitor();
    const reset = () => { if (session) { session.lastActivity = Date.now(); ls('session', session); } };
    document.addEventListener('mousemove', reset, { passive: true });
    document.addEventListener('keydown', reset, { passive: true });
    document.addEventListener('click', reset, { passive: true });
    document.addEventListener('touchstart', reset, { passive: true });
    idleTimer = setInterval(() => {
      if (!session) return;
      const inactive = Date.now() - session.lastActivity;
      if (inactive >= IDLE_TIMEOUT_MS) {
        stopIdleMonitor();
        doLogout();
        toast('Session expired due to inactivity', 'warning');
      }
    }, 15000);
  }

  function stopIdleMonitor() {
    if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
  }

  // ─── APP NAV ───────────────────────────────────────
  function showApp() {
    if (session) {
      const elapsed = Date.now() - (session.loginTime || 0);
      if (elapsed > SESSION_TIMEOUT_MS) {
        stopIdleMonitor();
        doLogout();
        toast('Session expired. Please login again.', 'warning');
        return;
      }
      startIdleMonitor();
    }
    id('authScreen').classList.add('hidden');
    id('appShell').classList.remove('hidden');
    updateUserUI();
    updateSidebar();
    go('dashboard');
    applyTheme(theme);
  }

  function updateUserUI() {
    if (!session) return;
    $$('#sbNm, #tbNm, #setNm').forEach(el => el.textContent = session.userName);
    id('sbRl').textContent = session.userRole?.replace(/_/g, ' ') || '';
    id('setRl').textContent = session.userRole?.replace(/_/g, ' ') || '';
    updateSidebar();
  }

  // ─── USER DROPDOWN ────────────────────────────────
  function toggleUserDropdown() {
    const btn = id('tbUsrBtn');
    const menu = id('tbDropdown');
    const isOpen = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', isOpen);
    if (isOpen) {
      const first = menu.querySelector('.tb-drop-item');
      if (first) first.focus();
    }
  }

  function closeUserDropdown() {
    const btn = id('tbUsrBtn');
    const menu = id('tbDropdown');
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }

  function setupUserDropdown() {
    const btn = id('tbUsrBtn');
    const menu = id('tbDropdown');
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleUserDropdown();
    });

    // Outside click close
    document.addEventListener('click', (e) => {
      if (!btn.contains(e.target) && !menu.contains(e.target)) {
        closeUserDropdown();
      }
    });

    // Item clicks
    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.tb-drop-item');
      if (!item) return;
      e.preventDefault();
      const action = item.dataset.action;
      closeUserDropdown();
      switch (action) {
        case 'profile': go('settings'); break;
        case 'settings': go('settings'); break;
        case 'password': go('settings'); id('newPwd').focus(); break;
        case 'help': toast('📞 Contact the school IT administrator for support', 'info'); break;
        case 'logout': doLogout(); break;
      }
    });

    // Keyboard navigation
    menu.addEventListener('keydown', (e) => {
      const items = [...menu.querySelectorAll('.tb-drop-item')];
      const current = document.activeElement;
      const idx = items.indexOf(current);
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          items[(idx + 1) % items.length].focus();
          break;
        case 'ArrowUp':
          e.preventDefault();
          items[(idx - 1 + items.length) % items.length].focus();
          break;
        case 'Escape':
          e.preventDefault();
          closeUserDropdown();
          btn.focus();
          break;
        case 'Tab':
          closeUserDropdown();
          break;
      }
    });
  }

  let currentPage = '';

  function go(page) {
    if (!canAccess(page)) { toast('Access denied for ' + (session?.userRole || 'unknown') + ' role', 'error'); if (currentPage) return; page = 'dashboard'; }
    currentPage = page;
    $$('.pg').forEach(p => p.classList.remove('active'));
    const tgt = id('pg-' + page);
    if (tgt) tgt.classList.add('active');
    $$('.ni').forEach(n => n.classList.toggle('active', n.dataset.p === page));
    const titles = {
      'dashboard': 'Dashboard',
      'c-inv': 'Consumables Inventory',
      'c-borrow': 'Borrow Items',
      'c-return': 'Return Items',
      'c-move': 'Stock Movements',
      'c-report': 'Consumables Reports',
      'f-inv': 'Food Inventory',
      'f-receive': 'Food Receiving',
      'f-issue': 'Food Issuing',
      'f-consume': 'Daily Consumption',
      'r-equip': 'Refectory Equipment',
      'r-damage': 'Loss & Damage',
      'f-expiry': 'Expiry Monitor',
      'f-move': 'Stock Movements',
      'f-report': 'Food Reports',
      's-dir': 'Suppliers Directory',
      's-hist': 'Supplier History',
      'l-user': 'User Activities',
      'l-inv': 'Inventory Logs',
      'l-audit': 'Audit Trail',
      'alerts': 'Alert Center',
      'settings': 'Settings',
      'fast': 'Breakfast Management',
      'agaseke': 'Agaseke Management',
      'welfare': 'Student Welfare Register'
    };
    id('tbTitle').textContent = titles[page] || page;
    closeSB();
    renderPage(page);
  }

  function renderPage(page) {
    switch (page) {
      case 'dashboard': renderDashboard(); break;
      case 'c-inv': renderCInv(); break;
      case 'c-borrow': renderBorrow(); break;
      case 'c-return': renderReturn(); break;
      case 'c-move': renderCMove(); break;
      case 'c-report': renderCReport(); break;
      case 'f-inv': renderFInv(); break;
      case 'f-receive': renderFRec(); break;
      case 'f-issue': renderFIss(); break;
      case 'f-consume': renderCon(); break;
      case 'r-equip': renderEq(); break;
      case 'r-damage': renderDam(); break;
      case 'f-expiry': renderExpiry(); break;
      case 'f-move': renderFMove(); break;
      case 'f-report': renderFReport(); break;
      case 's-dir': renderSup(); break;
      case 's-hist': renderSupHist(); break;
      case 'l-user': renderLog(); break;
      case 'l-inv': renderInvLog(); break;
      case 'l-audit': renderAudit(); break;
      case 'alerts': renderAlerts(); break;
      case 'settings': renderSettings(); break;
      case 'fast': renderBFast(); break;
      case 'agaseke': renderAAgaseke(); break;
      case 'welfare': renderWelfare(); break;
    }
    const ro = isReadOnly(session?.userRole, currentPage);
    document.body.classList.toggle('readonly', ro);
    updateBadges();
  }

  function toggleSB() {
    id('sidebar').classList.toggle('open');
    id('sbOverlay').classList.toggle('show');
  }

  function closeSB() {
    id('sidebar').classList.remove('open');
    id('sbOverlay').classList.remove('show');
  }

  // ─── FEEDING ELIGIBILITY ────────────────────────────
  const WELFARE_FEEDING_MAP = {
    'Present in Dormitory': { dormitoryBread: true, refectoryBread: false, agaseke: true, label: 'Dorm Bread' },
    'Present at School': { dormitoryBread: false, refectoryBread: true, agaseke: true, label: 'Refectory' },
    'Sick in Dormitory': { dormitoryBread: true, refectoryBread: false, agaseke: 'approved', label: 'Dorm Bread' },
    'Sick Bay': { dormitoryBread: true, refectoryBread: false, agaseke: 'approved', label: 'Per Policy' },
    'Hospital': { dormitoryBread: false, refectoryBread: false, agaseke: false, label: 'No Food' },
    'Sent Home': { dormitoryBread: false, refectoryBread: false, agaseke: false, label: 'No Food' },
    'Authorized Leave': { dormitoryBread: false, refectoryBread: false, agaseke: false, label: 'No Food' },
    'Suspended': { dormitoryBread: false, refectoryBread: false, agaseke: false, label: 'No Food' },
    'Uniform Stolen': { dormitoryBread: false, refectoryBread: false, agaseke: false, label: 'No Food' },
    'Personal Emergency': { dormitoryBread: false, refectoryBread: false, agaseke: false, label: 'No Food' },
    'Missing': { dormitoryBread: false, refectoryBread: false, agaseke: false, label: 'No Food' },
    'Other': { dormitoryBread: false, refectoryBread: true, agaseke: 'approved', label: 'Refectory' }
  };

  function getActiveWelfareRecords() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (welfareRecords || []).filter(r => {
      if (!r.expectedReturn) return true;
      const ret = new Date(r.expectedReturn);
      ret.setHours(23, 59, 59, 999);
      return ret >= today;
    });
  }

  function getFeedingStats() {
    const active = getActiveWelfareRecords();
    let dormitoryBread = 0, refectoryBread = 0, agasekeEligible = 0, noFood = 0;
    let totalBoarding = 0, present = 0, inDorm = 0, inRefectory = 0;
    let sick = 0, hospitalized = 0, sentHome = 0, onLeave = 0, missing = 0;

    const breakfastSettings = ls('breakfastSettings');

    active.forEach(r => {
      const map = WELFARE_FEEDING_MAP[r.status];
      if (!map) return;
      if (map.dormitoryBread) dormitoryBread++;
      if (map.refectoryBread) refectoryBread++;
      if (map.agaseke === true || map.agaseke === 'approved') agasekeEligible++;
      if (!map.dormitoryBread && !map.refectoryBread) noFood++;

      if (r.status === 'Present in Dormitory') { totalBoarding++; present++; inDorm++; }
      else if (r.status === 'Present at School') { totalBoarding++; present++; inRefectory++; }
      else if (r.status === 'Sick in Dormitory') { totalBoarding++; present++; sick++; }
      else if (r.status === 'Sick Bay') { totalBoarding++; present++; sick++; }
      else if (r.status === 'Hospital') { totalBoarding++; hospitalized++; }
      else if (r.status === 'Sent Home') { totalBoarding++; sentHome++; }
      else if (r.status === 'Authorized Leave') { totalBoarding++; onLeave++; }
      else if (r.status === 'Suspended') { totalBoarding++; }
      else if (r.status === 'Uniform Stolen') { totalBoarding++; }
      else if (r.status === 'Personal Emergency') { totalBoarding++; }
      else if (r.status === 'Missing') { totalBoarding++; missing++; }
      else if (r.status === 'Other') { totalBoarding++; present++; }
    });

    const totalStudents = breakfastSettings?.totalStudents || totalBoarding || 0;

    return {
      totalStudents, totalBoarding, present, inDorm, inRefectory,
      sick, hospitalized, sentHome, onLeave, missing, noFood,
      dormitoryBread, refectoryBread,
      totalBread: dormitoryBread + refectoryBread,
      agasekeEligible
    };
  }

  function getFeedingLabel(status) {
    const map = WELFARE_FEEDING_MAP[status];
    return map ? map.label : '—';
  }

  // ─── WELFARE FILTER ─────────────────────────────────
  function setWF(v, btn) {
    welfareFilter = v;
    $$('#wChips .chip').forEach(c => c.classList.toggle('active', c.dataset.v === v));
    renderWelfare();
  }

  function openWModal(item) {
    clearErr('mW');
    id('mWelfT').textContent = item ? 'Edit Welfare Record' : 'Add Welfare Record';
    id('mWId').value = item ? item.id : '';
    id('mWName').value = item ? item.studentName : '';
    id('mWIdNum').value = item ? item.studentId : '';
    id('mWClass').value = item ? item.wClass : '';
    id('mWDorm').value = item ? item.dormitory : '';
    id('mWDate').value = item ? item.date : today();
    id('mWReturn').value = item ? item.expectedReturn || '' : '';
    id('mWStatus').value = item ? item.status : 'Present in Dormitory';
    id('mWReason').value = item ? item.reason || '' : '';
    id('mWNotes').value = item ? item.notes || '' : '';
    openModal('mWelfare');
  }

  function saveWelfare() {
    const idV = id('mWId').value;
    const name = id('mWName').value.trim();
    const sid = id('mWIdNum').value.trim();
    const cls = id('mWClass').value.trim();
    const dorm = id('mWDorm').value.trim();
    const date = id('mWDate').value;
    const ret = id('mWReturn').value || null;
    const status = id('mWStatus').value;
    const reason = id('mWReason').value.trim();
    const notes = id('mWNotes').value.trim();

    if (!name) { id('mWNameE').textContent = 'Name required'; return; }
    if (!date) { id('mWDateE').textContent = 'Date required'; return; }

    if (idV) {
      const idx = welfareRecords.findIndex(x => x.id === idV);
      if (idx !== -1) {
        const oldStatus = welfareRecords[idx].status;
        welfareRecords[idx] = {
          ...welfareRecords[idx],
          studentName: name, studentId: sid, wClass: cls,
          dormitory: dorm, date, expectedReturn: ret,
          status, reason, notes, updatedAt: now()
        };
        if (oldStatus !== status) {
          addActivity('Welfare status changed: ' + name + ' (' + oldStatus + ' → ' + status + ')', 'welfare', 'Status update');
        }
      }
    } else {
      welfareRecords.push({
        id: uid(), studentName: name, studentId: sid, wClass: cls,
        dormitory: dorm, date, expectedReturn: ret,
        status, reason, notes, createdAt: now(), updatedAt: now()
      });
      addActivity('Welfare record added: ' + name + ' (' + status + ')', 'welfare', 'New record');
    }

    saveAll();
    closeModal('mWelfare');
    renderWelfare();
    renderDashboard();
    toast(idV ? 'Welfare record updated' : 'Welfare record added', 'success');
  }

  function deleteWelfare(idV) {
    const item = welfareRecords.find(r => r.id === idV);
    if (!item) return;
    confirmAction('Delete Record', 'Delete welfare record for ' + item.studentName + '?', () => {
      welfareRecords = welfareRecords.filter(r => r.id !== idV);
      saveAll();
      addActivity('Welfare record deleted: ' + item.studentName, 'welfare', 'Record removed');
      renderWelfare();
      renderDashboard();
      toast('Record deleted', 'warning');
    });
  }

  function renderWelfare() {
    const q = (id('wSrch')?.value || '').toLowerCase();
    const sf = id('wStatF')?.value || 'all';

    let list = [...welfareRecords];

    // Date filter
    if (welfareFilter === 'active') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      list = list.filter(r => {
        if (!r.expectedReturn) return true;
        const ret = new Date(r.expectedReturn);
        ret.setHours(23, 59, 59, 999);
        return ret >= today;
      });
    } else if (welfareFilter === 'returned') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      list = list.filter(r => {
        if (!r.expectedReturn) return false;
        const ret = new Date(r.expectedReturn);
        ret.setHours(0, 0, 0, 0);
        return ret < today;
      });
    }

    if (q) list = list.filter(r => (r.studentName + ' ' + (r.studentId || '') + ' ' + (r.wClass || '')).toLowerCase().includes(q));
    if (sf !== 'all') list = list.filter(r => r.status === sf);

    list.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Stats
    const feeding = getFeedingStats();
    id('wStats').innerHTML = `
      <div class="sc-card"><div class="sc-icon ic-green">👥</div><div class="sc-val">${feeding.totalBoarding}</div><div class="sc-lbl">Total Boarding</div></div>
      <div class="sc-card"><div class="sc-icon ic-blue">✅</div><div class="sc-val">${feeding.present}</div><div class="sc-lbl">Present</div></div>
      <div class="sc-card"><div class="sc-icon ic-gold">🏠</div><div class="sc-val">${feeding.inDorm}</div><div class="sc-lbl">In Dormitory</div></div>
      <div class="sc-card"><div class="sc-icon ic-teal">🍽</div><div class="sc-val">${feeding.inRefectory}</div><div class="sc-lbl">In Refectory</div></div>
      <div class="sc-card"><div class="sc-icon ic-red">🤒</div><div class="sc-val">${feeding.sick}</div><div class="sc-lbl">Sick</div></div>
      <div class="sc-card"><div class="sc-icon ic-danger">🏥</div><div class="sc-val">${feeding.hospitalized}</div><div class="sc-lbl">Hospitalized</div></div>
      <div class="sc-card"><div class="sc-icon ic-orange">🚶</div><div class="sc-val">${feeding.sentHome}</div><div class="sc-lbl">Sent Home</div></div>
      <div class="sc-card"><div class="sc-icon ic-purple">📋</div><div class="sc-val">${feeding.onLeave}</div><div class="sc-lbl">On Leave</div></div>
      <div class="sc-card"><div class="sc-icon ic-dark">❓</div><div class="sc-val">${feeding.missing}</div><div class="sc-lbl">Missing</div></div>
    `;

    const tbody = id('wBd');
    if (!list.length) {
      tbody.innerHTML = '';
      id('wPg').classList.add('hidden');
      id('wEmp').classList.remove('hidden');
      return;
    }
    id('wEmp').classList.add('hidden');
    const p = pg('welfare', list);
    id('wPg').classList.remove('hidden');
    id('wPg').innerHTML = pgCtrl('welfare', list.length);

    tbody.innerHTML = p.items.map((r, i) => {
      const overdue = r.expectedReturn && new Date(r.expectedReturn) < new Date(new Date().toDateString());
      const missingFlag = r.status === 'Missing';
      const noReturnDate = !r.expectedReturn && r.status !== 'Present in Dormitory' && r.status !== 'Present at School';
      const feedingLabel = getFeedingLabel(r.status);
      const badgeClass = r.status === 'Hospital' || r.status === 'Missing' ? 'badge-danger'
        : r.status === 'Sent Home' || r.status === 'Suspended' ? 'badge-warning'
        : r.status === 'Sick in Dormitory' || r.status === 'Sick Bay' ? 'badge-info'
        : 'badge-success';
      return `<tr class="${overdue || missingFlag ? 'row-danger' : noReturnDate ? 'row-warning' : ''}">
        <td>${p.start + i}</td>
        <td><strong>${r.studentName}</strong></td>
        <td>${r.studentId || '—'}</td>
        <td>${r.wClass || '—'}</td>
        <td>${r.dormitory || '—'}</td>
        <td>${dfmt(r.date)}</td>
        <td><span class="status-badge ${badgeClass}">${r.status}</span></td>
        <td>${r.reason || '—'}</td>
        <td>${r.expectedReturn ? dfmt(r.expectedReturn) + (overdue ? ' ⚠️' : '') : (noReturnDate ? '⚠️' : '—')}</td>
        <td>${feedingLabel}</td>
        <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.notes || ''}">${r.notes || '—'}</td>
        <td>
          <button class="btn btn-sm btn-ghost" onclick="openWModal(welfareRecords.find(x=>x.id==='${r.id}'))">✏️</button>
          <button class="btn btn-sm btn-ghost" onclick="deleteWelfare('${r.id}')">🗑</button>
        </td>
      </tr>`;
    }).join('');
  }
  pgFns.welfare = renderWelfare;

  function updateBadges() {
    id('nbDam').textContent = getDamagedCount();
    id('nbExp').textContent = getExpiringSoon().length;
    id('nbAlert').textContent = getUnreadNotif();
    id('tbDot').textContent = getUnreadNotif();
    id('tbDot').style.display = getUnreadNotif() > 0 ? 'flex' : 'none';
  }

  // ─── RBAC ──────────────────────────────────────────
  const RBAC_PAGES = {
    admin: ['dashboard','c-inv','c-borrow','c-return','c-move','c-report','f-inv','f-receive','f-issue','f-consume','r-equip','r-damage','f-expiry','f-move','f-report','fast','agaseke','s-dir','s-hist','l-user','l-inv','l-audit','alerts','settings','welfare'],
    storekeeper: ['dashboard','c-inv','c-borrow','c-return','c-move','c-report','f-inv','f-receive','f-issue','f-consume','r-equip','r-damage','f-expiry','f-move','f-report','fast','agaseke','s-dir','s-hist','alerts'],
    head_teacher: ['dashboard','c-inv','c-report','f-inv','f-expiry','f-report','agaseke','alerts','welfare'],
    welfare_prefect: ['dashboard','agaseke','alerts','welfare'],
    bursar: ['dashboard','c-inv','c-report','f-inv','f-report','s-dir','s-hist','agaseke','alerts'],
    refectory_manager: ['dashboard','f-inv','f-receive','f-issue','f-consume','r-equip','r-damage','f-expiry','f-move','f-report','fast','agaseke','alerts']
  };

  function getAllowedPages(role) { return RBAC_PAGES[role] || ['dashboard','alerts'] }

  function isReadOnly(role, page) {
    if (!role || role === 'admin' || role === 'storekeeper' || role === 'refectory_manager') return false;
    if (role === 'welfare_prefect' && (page === 'agaseke' || page === 'welfare')) return false;
    return true;
  }

  function canAccess(page) {
    if (!session) return false;
    return getAllowedPages(session.userRole).includes(page);
  }

  function updateSidebar() {
    $$('.ni').forEach(el => {
      const p = el.dataset.p;
      if (!p) return;
      if (!canAccess(p)) { el.style.display = 'none'; } else { el.style.display = ''; }
    });
  }

  // ─── GLOBAL SEARCH ─────────────────────────────────
  function gSearch() {
    const q = id('tbSrch').value.trim().toLowerCase();
    if (!q) return;
    const all = [...consumables, ...foodItems, ...equipment, ...suppliers];
    const hit = all.find(x => (x.name || '').toLowerCase().includes(q));
    if (hit) {
      if (consumables.includes(hit)) go('c-inv');
      else if (foodItems.includes(hit)) go('f-inv');
      else if (equipment.includes(hit)) go('r-equip');
      else if (suppliers.includes(hit)) go('s-dir');
    }
    id('tbSrch').value = '';
  }

  // ─── PRINT ─────────────────────────────────────────
  function doPrint() { window.print(); }

  // ─── RESET FORM ────────────────────────────────────
  function rf(formId) {
    const f = id(formId);
    if (f) f.reset();
    $$(`#${formId} .ferr`).forEach(e => e.textContent = '');
    $$(`#${formId} .falert`).forEach(e => e.classList.add('hidden'));
  }

  // ═══════════════════════════════════════════════════════
  //  DASHBOARD
  // ═══════════════════════════════════════════════════════
  function renderDashboard() {
    const hr = new Date().getHours();
    const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    id('dashGreet').textContent = greet + ' 👋';
    id('dashDate').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Stats row 1
    const totalCons = consumables.reduce((s, c) => s + c.qty, 0);
    const totalFood = foodItems.reduce((s, f) => s + f.qty, 0);
    const totalEq = equipment.reduce((s, e) => s + e.qty, 0);
    const totalSup = suppliers.length;

    id('dStat1').innerHTML = `
      <div class="sc-card"><div class="sc-icon ic-green">📦</div><div class="sc-val">${consumables.length}</div><div class="sc-lbl">Consumable Items</div></div>
      <div class="sc-card"><div class="sc-icon ic-blue">🥫</div><div class="sc-val">${foodItems.length}</div><div class="sc-lbl">Food Items</div></div>
      <div class="sc-card"><div class="sc-icon ic-teal">🥄</div><div class="sc-val">${equipment.length}</div><div class="sc-lbl">Equipment Items</div></div>
      <div class="sc-card"><div class="sc-icon ic-gold">🏢</div><div class="sc-val">${totalSup}</div><div class="sc-lbl">Suppliers</div></div>
    `;

    const activeB = getActiveBorrows().length;
    const exp = getExpiringSoon().length;
    const lowC = getLowConsumables().length;
    const lowF = getLowFood().length;
    const damC = getDamagedCount();

    id('dStat2').innerHTML = `
      <div class="sc-card"><div class="sc-icon ic-gold">📤</div><div class="sc-val">${activeB}</div><div class="sc-lbl">Active Borrows</div></div>
      <div class="sc-card"><div class="sc-icon ic-rust">⚠️</div><div class="sc-val">${damC}</div><div class="sc-lbl">Damage Reports</div></div>
      <div class="sc-card"><div class="sc-icon ic-red">⬇</div><div class="sc-val">${lowC + lowF}</div><div class="sc-lbl">Low Stock Items</div></div>
      <div class="sc-card"><div class="sc-icon ic-teal">⏰</div><div class="sc-val">${exp}</div><div class="sc-lbl">Expiring Soon</div></div>
    `;

    // Low stock alerts
    const lowItems = [...getLowConsumables().map(c => ({ name: c.name, type: 'consumable', qty: c.qty, min: c.min })), ...getLowFood().map(f => ({ name: f.name, type: 'food', qty: f.qty, min: f.min }))];
    const dAlerts = id('dashAlerts');
    dAlerts.innerHTML = lowItems.slice(0, 5).map(i =>
      `<div class="astrip warn">⚠️ <strong>${i.name}</strong> — Low stock (${i.qty} / min ${i.min})</div>`
    ).join('');
    if (lowItems.length > 5) dAlerts.innerHTML += `<div class="astrip warn">…and ${lowItems.length - 5} more low-stock items</div>`;

    // Stock chart
    renderStockChart();

    // Recent transactions
    const recent = [...borrows.map(b => ({ ...b, _type: 'borrow' }))].sort((a, b) => new Date(b.borrowedAt || b.createdAt) - new Date(a.borrowedAt || a.createdAt)).slice(0, 6);
    id('dRecentTxn').innerHTML = recent.length ? recent.map(r =>
      `<div class="fi-item"><div class="fi-dot ${r.status === 'active' ? 'gold' : 'teal'}">${r.status === 'active' ? '📤' : '📥'}</div><div class="fi-txt"><strong>${consumables.find(c => c.id === r.itemId)?.name || 'Unknown'}</strong><span>${r.person} — ${r.status === 'active' ? 'Borrowed' : 'Returned'} ${r.qty} pcs</span></div><div class="fi-time">${fmt(r.borrowedAt || r.createdAt)}</div></div>`
    ).join('') : '<div class="estate" style="padding:20px"><span>🔄</span><h4>No recent transactions</h4></div>';

    // Recent activities
    const recentAct = activities.slice(0, 6);
    id('dRecentAct').innerHTML = recentAct.length ? recentAct.map(a =>
      `<div class="fi-item"><div class="fi-dot blue">📋</div><div class="fi-txt"><strong>${a.action}</strong><span>${a.userName} — ${a.category}</span></div><div class="fi-time">${fmt(a.timestamp)}</div></div>`
    ).join('') : '<div class="estate" style="padding:20px"><span>🗒</span><h4>No recent activities</h4></div>';

    // Low stock feed
    id('dLowStock').innerHTML = lowItems.length ? lowItems.slice(0, 5).map(i =>
      `<div class="fi-item"><div class="fi-dot red">⬇</div><div class="fi-txt"><strong>${i.name}</strong><span>${i.qty} / min ${i.min}</span></div></div>`
    ).join('') : '<div class="estate" style="padding:20px"><span>✅</span><h4>All items well stocked</h4></div>';

    // Expiring feed
    const expItems = getExpiringSoon();
    id('dExpiring').innerHTML = expItems.length ? expItems.slice(0, 5).map(f =>
      `<div class="fi-item"><div class="fi-dot gold">⏰</div><div class="fi-txt"><strong>${f.name}</strong><span>Expires ${dfmt(f.expiryDate)}</span></div></div>`
    ).join('') : '<div class="estate" style="padding:20px"><span>✅</span><h4>No items expiring soon</h4></div>';

    // Welfare stats row
    const feed = getFeedingStats();
    id('dStat3').innerHTML = `
      <div class="sc-card"><div class="sc-icon ic-green">👥</div><div class="sc-val">${feed.totalBoarding}</div><div class="sc-lbl">Boarding Students</div></div>
      <div class="sc-card"><div class="sc-icon ic-blue">✅</div><div class="sc-val">${feed.present}</div><div class="sc-lbl">Present</div></div>
      <div class="sc-card"><div class="sc-icon ic-gold">🏠</div><div class="sc-val">${feed.inDorm}</div><div class="sc-lbl">In Dormitory</div></div>
      <div class="sc-card"><div class="sc-icon ic-teal">🍽</div><div class="sc-val">${feed.inRefectory}</div><div class="sc-lbl">In Refectory</div></div>
      <div class="sc-card"><div class="sc-icon ic-red">🤒</div><div class="sc-val">${feed.sick}</div><div class="sc-lbl">Sick</div></div>
      <div class="sc-card"><div class="sc-icon ic-danger">🏥</div><div class="sc-val">${feed.hospitalized}</div><div class="sc-lbl">Hospitalized</div></div>
      <div class="sc-card"><div class="sc-icon ic-purple">🚶</div><div class="sc-val">${feed.sentHome}</div><div class="sc-lbl">Sent Home</div></div>
      <div class="sc-card"><div class="sc-icon ic-dark">❓</div><div class="sc-val">${feed.missing}</div><div class="sc-lbl">Missing</div></div>
    `;

    renderBDashboard();
    renderADashboard();
    renderWelfareDashboard();
    renderFoodPlanDashboard();
  }

  function renderStockChart() {
    const cats = ['Stationery', 'Office Supplies', 'Cleaning', 'Electrical', 'Laboratory', 'General'];
    const chart = id('stockChart');
    const leg = id('stockLeg');
    const maxQty = Math.max(1, ...cats.map(c => consumables.filter(x => x.category === c).reduce((s, x) => s + x.qty, 0)));
    chart.innerHTML = cats.map(c => {
      const qty = consumables.filter(x => x.category === c).reduce((s, x) => s + x.qty, 0);
      const h = (qty / maxQty) * 120;
      return `<div class="cbar-grp"><div class="cbar-wrap"><div class="cbar cb1" style="height:${h}px"></div></div><span class="clbl">${c.split(' ')[0]}</span></div>`;
    }).join('');
    leg.innerHTML = `<div class="cleg"><span class="cleg-dot" style="background:var(--forest3)"></span>Stock Qty</div>`;
  }

  // ═══════════════════════════════════════════════════════
  //  CONSUMABLES INVENTORY
  // ═══════════════════════════════════════════════════════
  let cInvFilter = 'all';
  let cInvStatus = 'all';

  function setCF(val, btn) {
    cInvFilter = val;
    $$('#cChips .chip').forEach(b => b.classList.toggle('active', b === btn));
    renderCInv();
  }

  function renderCInv() {
    const q = id('cInvSr').value.trim().toLowerCase();
    const status = id('cStF')?.value || 'all';
    let list = consumables;
    if (cInvFilter !== 'all') list = list.filter(x => x.category === cInvFilter);
    if (status === 'available') list = list.filter(x => x.qty > x.min);
    else if (status === 'borrowed') list = list.filter(x => x.qty < 0);
    else if (status === 'low') list = list.filter(x => x.qty > 0 && x.qty <= x.min);
    if (q) list = list.filter(x => x.name.toLowerCase().includes(q) || x.code?.toLowerCase().includes(q));
    const tbody = id('cInvBd');
    if (!list.length) {
      tbody.innerHTML = '';
      id('cInvPg').classList.add('hidden');
      id('cInvEmp').classList.remove('hidden');
      return;
    }
    id('cInvEmp').classList.add('hidden');
    const p = pg('cInv', list);
    id('cInvPg').classList.remove('hidden');
    id('cInvPg').innerHTML = pgCtrl('cInv', list.length);
    tbody.innerHTML = p.items.map((x, i) => {
      const stat = x.qty <= 0 ? 'Out of Stock' : x.qty <= x.min ? 'Low Stock' : 'Available';
      const cls = x.qty <= 0 ? 'b-red' : x.qty <= x.min ? 'b-gold' : 'b-green';
      return `<tr>
        <td>${p.start + i}</td>
        <td><strong>${x.name}</strong></td>
        <td>${x.category}</td>
        <td style="font-family:monospace">${x.code || '—'}</td>
        <td><strong>${x.qty}</strong></td>
        <td>${x.min}</td>
        <td>${x.unit}</td>
        <td><span class="badge ${cls}">${stat}</span></td>
        <td>${x.location || '—'}</td>
        <td><div class="ac">
          <button class="ico-btn" onclick="editCItem('${x.id}')" title="Edit">✏️</button>
          <button class="ico-btn del" onclick="delCItem('${x.id}')" title="Delete">🗑</button>
        </div></td>
      </tr>`;
    }).join('');
  }
  pgFns.cInv = renderCInv;

  function openCModal(item) {
    clearErr('mC');
    id('mConsT').textContent = item ? 'Edit Consumable' : 'Add Consumable';
    id('mCId').value = item ? item.id : '';
    id('mCName').value = item ? item.name : '';
    id('mCCat').value = item ? item.category : 'Stationery';
    id('mCCode').value = item ? item.code || '' : '';
    id('mCQty').value = item ? item.qty : '';
    id('mCMin').value = item ? item.min : '';
    id('mCUnit').value = item ? item.unit : 'Piece';
    id('mCLoc').value = item ? item.location || '' : '';
    id('mCDesc').value = item ? item.description || '' : '';
    openModal('mCons');
  }

  function saveCons() {
    const idV = id('mCId').value;
    const name = id('mCName').value.trim();
    const cat = id('mCCat').value;
    const code = id('mCCode').value.trim();
    const qty = parseFloat(id('mCQty').value) || 0;
    const min = parseFloat(id('mCMin').value) || 0;
    const unit = id('mCUnit').value;
    const loc = id('mCLoc').value.trim();
    const desc = id('mCDesc').value.trim();
    if (!name) { id('mCNameE').textContent = 'Name required'; return; }
    if (isNaN(qty) || qty < 0) { id('mCQtyE').textContent = 'Valid quantity required'; return; }
    if (idV) {
      const idx = consumables.findIndex(x => x.id === idV);
      if (idx !== -1) {
        consumables[idx] = { ...consumables[idx], name, category: cat, code, qty, min, unit, location: loc, description: desc, updatedAt: now() };
        addActivity('Updated consumable: ' + name, 'consumable', 'Updated item details');
      }
    } else {
      consumables.push({ id: uid(), name, category: cat, code, qty, min, unit, location: loc, description: desc, createdAt: now(), updatedAt: now() });
      addActivity('Added consumable: ' + name, 'consumable', 'New item created');
    }
    saveAll();
    closeModal('mCons');
    renderCInv();
    toast(idV ? 'Item updated' : 'Item added', 'success');
  }

  function editCItem(idV) {
    const item = consumables.find(x => x.id === idV);
    if (item) openCModal(item);
  }
  function delCItem(idV) {
    const item = consumables.find(x => x.id === idV);
    if (!item) return;
    confirmAction('Delete Item', 'Delete "' + item.name + '"? This cannot be undone.', () => {
      consumables = consumables.filter(x => x.id !== idV);
      saveAll();
      renderCInv();
      addActivity('Deleted consumable: ' + item.name, 'consumable', 'Item removed');
      toast('Item deleted', 'warning');
    });
  }

  // ═══════════════════════════════════════════════════════
  //  BORROW
  // ═══════════════════════════════════════════════════════
  function populateBorrowItems() {
    const sel = id('bItem');
    const avail = consumables.filter(c => c.qty > 0);
    sel.innerHTML = '<option value="">— Select —</option>' + avail.map(c => `<option value="${c.id}">${c.name} (${c.qty} ${c.unit})</option>`).join('');
  }

  function doBorrow(e) {
    e.preventDefault();
    clearErr('b');
    const itemId = id('bItem').value;
    const person = id('bPerson').value.trim();
    const dept = id('bDept').value.trim();
    const qty = parseInt(id('bQty').value) || 0;
    const purpose = id('bPurpose').value.trim();
    const retDate = id('bRetDate').value;
    let ok = true;
    if (!itemId) { id('bItemE').textContent = 'Select an item'; ok = false; }
    if (!person) { id('bPersonE').textContent = 'Borrower name required'; ok = false; }
    if (qty < 1) { id('bQtyE').textContent = 'Quantity must be at least 1'; ok = false; }
    if (!ok) return;
    const item = consumables.find(c => c.id === itemId);
    if (!item) { toast('Item not found', 'error'); return; }
    if (qty > item.qty) { id('bQtyE').textContent = 'Only ' + item.qty + ' available'; return; }
    borrows.push({
      id: uid(),
      itemId,
      person,
      dept,
      qty,
      purpose,
      expectedReturn: retDate || '',
      condition: '',
      notes: '',
      borrowedAt: now(),
      returnedAt: null,
      status: 'active'
    });
    item.qty -= qty;
    saveAll();
    rf('borrowForm');
    populateBorrowItems();
    renderBorrow();
    addActivity('Borrowed: ' + item.name + ' x' + qty + ' to ' + person, 'consumable', 'Item issued');
    addNotification('info', 'Item Borrowed', person + ' borrowed ' + item.name + ' x' + qty);
    toast('Item issued to ' + person, 'success');
  }

  function renderBorrow() {
    const active = getActiveBorrows();
    id('borCnt').textContent = active.length;
    const list = id('borList');
    if (!active.length) {
      list.innerHTML = '<div class="estate" style="padding:20px"><span>📤</span><h4>No items currently borrowed</h4></div>';
      return;
    }
    list.innerHTML = active.map(b => {
      const item = consumables.find(c => c.id === b.itemId);
      return `<div class="fi-item"><div class="fi-dot gold">📤</div><div class="fi-txt"><strong>${item?.name || 'Unknown'}</strong><span>${b.person}${b.dept ? ' — ' + b.dept : ''} · ${b.qty} pcs</span><span style="font-size:11px;color:var(--ink4)">${b.purpose ? b.purpose : ''}${b.expectedReturn ? ' | Due: ' + dfmt(b.expectedReturn) : ''}</span></div><div class="fi-time">${fmt(b.borrowedAt)}</div></div>`;
    }).join('');
    populateBorrowItems();
  }

  // ═══════════════════════════════════════════════════════
  //  RETURN
  // ═══════════════════════════════════════════════════════
  function populateReturnItems() {
    const sel = id('retItem');
    const active = getActiveBorrows();
    sel.innerHTML = '<option value="">— Select —</option>' + active.map(b => {
      const item = consumables.find(c => c.id === b.itemId);
      return `<option value="${b.id}">${item?.name || 'Unknown'} — ${b.person} (${b.qty} pcs)</option>`;
    }).join('');
  }

  function doReturn(e) {
    e.preventDefault();
    clearErr('ret');
    const borrowId = id('retItem').value;
    const cond = id('retCond').value;
    const notes = id('retNotes').value.trim();
    if (!borrowId) { id('retItemE').textContent = 'Select a borrowed item'; return; }
    const br = borrows.find(b => b.id === borrowId);
    if (!br) { toast('Record not found', 'error'); return; }
    br.status = 'returned';
    br.condition = cond;
    br.notes = notes;
    br.returnedAt = now();
    const item = consumables.find(c => c.id === br.itemId);
    if (item) item.qty += br.qty;
    saveAll();
    rf('returnForm');
    populateReturnItems();
    renderReturn();
    addActivity('Returned: ' + (item?.name || 'Unknown') + ' x' + br.qty + ' from ' + br.person, 'consumable', 'Item returned');
    addNotification('info', 'Item Returned', br.person + ' returned ' + (item?.name || 'Unknown') + ' (' + cond + ')');
    toast('Return processed', 'success');
  }

  function renderReturn() {
    populateReturnItems();
  }

  // ═══════════════════════════════════════════════════════
  //  C-MOVEMENTS
  // ═══════════════════════════════════════════════════════
  function renderCMove() {
    const q = id('cMvSr').value.trim().toLowerCase();
    const filter = id('cMvF').value;
    let list = [...borrows.map(b => ({ ...b, _t: 'borrow' }))];
    if (filter !== 'all') list = list.filter(x => x._t === filter);
    if (q) list = list.filter(x => {
      const item = consumables.find(c => c.id === x.itemId);
      return (item?.name || '').toLowerCase().includes(q) || (x.person || '').toLowerCase().includes(q);
    });
    list.sort((a, b) => new Date(b.borrowedAt || b.createdAt) - new Date(a.borrowedAt || a.createdAt));
    const tbody = id('cMvBd');
    if (!list.length) {
      tbody.innerHTML = '';
      id('cMvEmp').classList.remove('hidden');
      return;
    }
    id('cMvEmp').classList.add('hidden');
    tbody.innerHTML = list.map((x, i) => {
      const item = consumables.find(c => c.id === x.itemId);
      const isRet = x.status === 'returned';
      return `<tr>
        <td>${i + 1}</td>
        <td>${fmt(x.returnedAt || x.borrowedAt)}</td>
        <td><span class="badge ${isRet ? 'b-teal' : 'b-gold'}">${isRet ? 'Return' : 'Borrow'}</span></td>
        <td>${item?.name || 'Unknown'}</td>
        <td>${x.qty}</td>
        <td>${x.person}</td>
        <td>${x.dept || '—'}</td>
        <td>${isRet ? (x.condition || '—') : '—'}</td>
        <td>${x.notes || x.purpose || '—'}</td>
      </tr>`;
    }).join('');
  }

  // ═══════════════════════════════════════════════════════
  //  C-REPORT
  // ═══════════════════════════════════════════════════════
  function renderCReport() {
    const total = consumables.length;
    const totalQty = consumables.reduce((s, c) => s + c.qty, 0);
    const borrowed = getActiveBorrows().length;
    const low = getLowConsumables().length;
    const cats = [...new Set(consumables.map(c => c.category))];
    let html = `<div class="rep-sec"><h3 class="rep-title">Consumables Summary</h3>
      <div class="rep-sum">
        <div class="rep-stat"><strong>${total}</strong><span>Total Items</span></div>
        <div class="rep-stat"><strong>${totalQty}</strong><span>Total Quantity</span></div>
        <div class="rep-stat"><strong>${borrowed}</strong><span>Active Borrows</span></div>
        <div class="rep-stat"><strong>${low}</strong><span>Low Stock</span></div>
      </div></div>`;
    cats.forEach(c => {
      const items = consumables.filter(x => x.category === c);
      html += `<div class="rep-sec"><h3 class="rep-title">${c}</h3><table class="dt"><thead><tr><th>Name</th><th>Qty</th><th>Min</th><th>Unit</th><th>Status</th></tr></thead><tbody>`;
      items.forEach(x => {
        const stat = x.qty <= 0 ? 'Out' : x.qty <= x.min ? 'Low' : 'OK';
        html += `<tr><td>${x.name}</td><td>${x.qty}</td><td>${x.min}</td><td>${x.unit}</td><td>${stat}</td></tr>`;
      });
      html += `</tbody></table></div>`;
    });
    id('cRepContent').innerHTML = html || '<div class="estate"><span>📊</span><h4>No data</h4></div>';
  }

  // ═══════════════════════════════════════════════════════
  //  FOOD INVENTORY
  // ═══════════════════════════════════════════════════════
  let fInvFilter = 'all';
  let fInvStatus = 'all';

  function setFF(val, btn) {
    fInvFilter = val;
    $$('#fChips .chip').forEach(b => b.classList.toggle('active', b === btn));
    renderFInv();
  }

  function populateFoodSuppliers() {
    const sel = id('mFSup');
    sel.innerHTML = '<option value="">None</option>' + suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }

  function renderFInv() {
    const q = id('fInvSr').value.trim().toLowerCase();
    const status = id('fStF')?.value || 'all';
    let list = foodItems;
    if (fInvFilter !== 'all') list = list.filter(x => x.category === fInvFilter);
    const nowD = new Date();
    if (status === 'available') list = list.filter(x => x.qty > x.min);
    else if (status === 'low') list = list.filter(x => x.qty > 0 && x.qty <= x.min);
    else if (status === 'out') list = list.filter(x => x.qty <= 0);
    else if (status === 'expiring') list = list.filter(x => x.expiryDate && new Date(x.expiryDate) <= new Date(nowD.getTime() + 14 * 86400000) && new Date(x.expiryDate) >= nowD);
    if (q) list = list.filter(x => x.name.toLowerCase().includes(q));
    const tbody = id('fInvBd');
    if (!list.length) {
      tbody.innerHTML = '';
      id('fInvPg').classList.add('hidden');
      id('fInvEmp').classList.remove('hidden');
      return;
    }
    id('fInvEmp').classList.add('hidden');
    const p = pg('fInv', list);
    id('fInvPg').classList.remove('hidden');
    id('fInvPg').innerHTML = pgCtrl('fInv', list.length);
    tbody.innerHTML = p.items.map((x, i) => {
      const stat = x.qty <= 0 ? 'Out of Stock' : x.qty <= x.min ? 'Low Stock' : x.expiryDate && new Date(x.expiryDate) <= new Date(nowD.getTime() + 14 * 86400000) ? 'Expiring' : 'Available';
      const cls = x.qty <= 0 ? 'b-red' : x.qty <= x.min ? 'b-gold' : 'b-green';
      const val = (x.unitCost || 0) * x.qty;
      return `<tr>
        <td>${p.start + i}</td>
        <td><strong>${x.name}</strong></td>
        <td>${x.category}</td>
        <td><strong>${x.qty}</strong></td>
        <td>${x.unit}</td>
        <td>${x.min}</td>
        <td>${x.unitCost ? x.unitCost.toLocaleString() + ' RWF' : '—'}</td>
        <td>${val ? val.toLocaleString() + ' RWF' : '—'}</td>
        <td>${x.expiryDate ? dfmt(x.expiryDate) : '—'}</td>
        <td><span class="badge ${cls}">${stat}</span></td>
        <td>${x.location || '—'}</td>
        <td><div class="ac">
          <button class="ico-btn" onclick="editFItem('${x.id}')" title="Edit">✏️</button>
          <button class="ico-btn del" onclick="delFItem('${x.id}')" title="Delete">🗑</button>
        </div></td>
      </tr>`;
    }).join('');
  }
  pgFns.fInv = renderFInv;

  function openFModal(item) {
    clearErr('mF');
    populateFoodSuppliers();
    id('mFoodT').textContent = item ? 'Edit Food Item' : 'Add Food Item';
    id('mFId').value = item ? item.id : '';
    id('mFName').value = item ? item.name : '';
    id('mFCat').value = item ? item.category : 'Cereals';
    id('mFQty').value = item ? item.qty : '';
    id('mFUnit').value = item ? item.unit : 'Kg';
    id('mFMin').value = item ? item.min : '';
    id('mFMax').value = item ? item.max : '';
    id('mFCost').value = item ? item.unitCost || '' : '';
    id('mFSup').value = item ? item.supplier || '' : '';
    id('mFPurch').value = item ? item.purchaseDate || '' : '';
    id('mFRec').value = item ? item.receivedDate || '' : '';
    id('mFExp').value = item ? item.expiryDate || '' : '';
    id('mFLoc').value = item ? item.location || '' : '';
    id('mFNotes').value = item ? item.notes || '' : '';
    openModal('mFood');
  }

  function saveFood() {
    const idV = id('mFId').value;
    const name = id('mFName').value.trim();
    const cat = id('mFCat').value;
    const qty = parseFloat(id('mFQty').value) || 0;
    const unit = id('mFUnit').value;
    const min = parseFloat(id('mFMin').value) || 0;
    const max = parseFloat(id('mFMax').value) || 0;
    const cost = parseFloat(id('mFCost').value) || 0;
    const sup = id('mFSup').value;
    const purch = id('mFPurch').value;
    const rec = id('mFRec').value;
    const exp = id('mFExp').value;
    const loc = id('mFLoc').value.trim();
    const notes = id('mFNotes').value.trim();
    if (!name) { id('mFNameE').textContent = 'Name required'; return; }
    if (isNaN(qty) || qty < 0) { id('mFQtyE').textContent = 'Valid quantity required'; return; }
    if (idV) {
      const idx = foodItems.findIndex(x => x.id === idV);
      if (idx !== -1) {
        foodItems[idx] = { ...foodItems[idx], name, category: cat, qty, unit, min, max, unitCost: cost, supplier: sup, purchaseDate: purch, receivedDate: rec, expiryDate: exp, location: loc, notes, updatedAt: now() };
        addActivity('Updated food item: ' + name, 'food', 'Item details updated');
      }
    } else {
      foodItems.push({ id: uid(), name, category: cat, qty, unit, min, max, unitCost: cost, supplier: sup, purchaseDate: purch, receivedDate: rec, expiryDate: exp, location: loc, notes, createdAt: now(), updatedAt: now() });
      addActivity('Added food item: ' + name, 'food', 'New food item created');
    }
    saveAll();
    closeModal('mFood');
    renderFInv();
    toast(idV ? 'Food item updated' : 'Food item added', 'success');
  }

  function editFItem(idV) {
    const item = foodItems.find(x => x.id === idV);
    if (item) openFModal(item);
  }
  function delFItem(idV) {
    const item = foodItems.find(x => x.id === idV);
    if (!item) return;
    confirmAction('Delete Food Item', 'Delete "' + item.name + '"?', () => {
      foodItems = foodItems.filter(x => x.id !== idV);
      saveAll();
      renderFInv();
      addActivity('Deleted food item: ' + item.name, 'food', 'Item removed');
      toast('Food item deleted', 'warning');
    });
  }

  // ═══════════════════════════════════════════════════════
  //  FOOD RECEIVING
  // ═══════════════════════════════════════════════════════
  function populateFRecSelects() {
    const fi = id('mRFItem');
    fi.innerHTML = '<option value="">— Select —</option>' + foodItems.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
    const sp = id('mRSup');
    sp.innerHTML = '<option value="">None</option>' + suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }

  function renderFRec() {
    const q = id('fRecSr').value.trim().toLowerCase();
    let list = [...deliveries];
    if (q) list = list.filter(x => {
      const food = foodItems.find(f => f.id === x.foodId);
      const sup = suppliers.find(s => s.id === x.supplierId);
      return (food?.name || '').toLowerCase().includes(q) || (sup?.name || '').toLowerCase().includes(q) || (x.deliveryNo || '').toLowerCase().includes(q);
    });
    list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    const tbody = id('fRecBd');
    if (!list.length) {
      tbody.innerHTML = '';
      id('fRecEmp').classList.remove('hidden');
      return;
    }
    id('fRecEmp').classList.add('hidden');
    tbody.innerHTML = list.map((x, i) => {
      const food = foodItems.find(f => f.id === x.foodId);
      const sup = suppliers.find(s => s.id === x.supplierId);
      return `<tr>
        <td>${i + 1}</td>
        <td style="font-family:monospace">${x.deliveryNo || '—'}</td>
        <td>${food?.name || 'Unknown'}</td>
        <td>${sup?.name || '—'}</td>
        <td>${x.qty}</td>
        <td>${food?.unit || '—'}</td>
        <td>${x.unitCost ? x.unitCost.toLocaleString() : '—'}</td>
        <td>${(x.totalCost || 0).toLocaleString()} RWF</td>
        <td>${dfmt(x.date)}</td>
        <td>${x.receivedBy || '—'}</td>
        <td>${x.notes || '—'}</td>
        <td><div class="ac"><button class="ico-btn del" onclick="delFRec('${x.id}')" title="Delete">🗑</button></div></td>
      </tr>`;
    }).join('');
  }

  function openFRecModal() {
    clearErr('mR');
    populateFRecSelects();
    id('mRQty').value = '';
    id('mRCost').value = '';
    id('mRDate').value = today();
    id('mRBy').value = session?.userName || '';
    id('mRNotes').value = '';
    openModal('mFRec');
  }

  function saveFRec() {
    const foodId = id('mRFItem').value;
    const supId = id('mRSup').value;
    const qty = parseFloat(id('mRQty').value) || 0;
    const cost = parseFloat(id('mRCost').value) || 0;
    const date = id('mRDate').value || today();
    const by = id('mRBy').value.trim();
    const notes = id('mRNotes').value.trim();
    if (!foodId) { id('mRFItemE').textContent = 'Select food item'; return; }
    if (qty < 1) { id('mRQtyE').textContent = 'Quantity must be > 0'; return; }
    const food = foodItems.find(f => f.id === foodId);
    if (!food) { toast('Food item not found', 'error'); return; }
    const del = {
      id: uid(),
      deliveryNo: 'DEL-' + Date.now().toString(36).toUpperCase(),
      foodId,
      supplierId: supId || '',
      qty,
      unitCost: cost,
      totalCost: cost * qty,
      date,
      receivedBy: by || session?.userName || '',
      notes,
      createdAt: now()
    };
    deliveries.push(del);
    food.qty += qty;
    if (food.receivedDate && date > food.receivedDate) food.receivedDate = date;
    else if (!food.receivedDate) food.receivedDate = date;
    saveAll();
    closeModal('mFRec');
    renderFRec();
    addActivity('Food delivery received: ' + food.name + ' x' + qty, 'food', 'Delivery #' + del.deliveryNo);
    addNotification('info', 'Food Received', food.name + ' x' + qty + ' received');
    toast('Delivery recorded', 'success');
  }

  function delFRec(idV) {
    const rec = deliveries.find(d => d.id === idV);
    if (!rec) return;
    confirmAction('Delete Delivery', 'Remove this delivery record? Stock will NOT be adjusted.', () => {
      deliveries = deliveries.filter(d => d.id !== idV);
      saveAll();
      renderFRec();
      toast('Delivery record deleted', 'warning');
    });
  }

  // ═══════════════════════════════════════════════════════
  //  FOOD ISSUING
  // ═══════════════════════════════════════════════════════
  function populateFIssSelects() {
    const fi = id('mIFItem');
    fi.innerHTML = '<option value="">— Select —</option>' + foodItems.filter(f => f.qty > 0).map(f => `<option value="${f.id}">${f.name} (${f.qty} ${f.unit})</option>`).join('');
  }

  function renderFIss() {
    const q = id('fIssSr').value.trim().toLowerCase();
    let list = [...issues];
    if (q) list = list.filter(x => {
      const food = foodItems.find(f => f.id === x.foodId);
      return (food?.name || '').toLowerCase().includes(q) || (x.issuedBy || '').toLowerCase().includes(q);
    });
    list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    const tbody = id('fIssBd');
    if (!list.length) {
      tbody.innerHTML = '';
      id('fIssEmp').classList.remove('hidden');
      return;
    }
    id('fIssEmp').classList.add('hidden');
    tbody.innerHTML = list.map((x, i) => {
      const food = foodItems.find(f => f.id === x.foodId);
      return `<tr>
        <td>${i + 1}</td>
        <td style="font-family:monospace">${x.issueNo || '—'}</td>
        <td>${food?.name || 'Unknown'}</td>
        <td>${x.qty}</td>
        <td>${food?.unit || '—'}</td>
        <td>${dfmt(x.date)}</td>
        <td>${x.issuedBy || '—'}</td>
        <td>${x.dept || '—'}</td>
        <td>${x.notes || '—'}</td>
        <td><div class="ac"><button class="ico-btn del" onclick="delFIss('${x.id}')" title="Delete">🗑</button></div></td>
      </tr>`;
    }).join('');
  }

  function openFIssModal() {
    clearErr('mI');
    populateFIssSelects();
    id('mIQty').value = '';
    id('mIDate').value = today();
    id('mIBy').value = session?.userName || '';
    id('mIDept').value = 'Kitchen';
    id('mINotes').value = '';
    openModal('mFIss');
  }

  function saveFIss() {
    const foodId = id('mIFItem').value;
    const qty = parseFloat(id('mIQty').value) || 0;
    const date = id('mIDate').value || today();
    const by = id('mIBy').value.trim();
    const dept = id('mIDept').value;
    const notes = id('mINotes').value.trim();
    if (!foodId) { id('mIFItemE').textContent = 'Select food item'; return; }
    if (qty < 1) { id('mIQtyE').textContent = 'Quantity must be > 0'; return; }
    const food = foodItems.find(f => f.id === foodId);
    if (!food) { toast('Food item not found', 'error'); return; }
    if (qty > food.qty) { id('mIQtyE').textContent = 'Only ' + food.qty + ' ' + food.unit + ' available'; return; }
    issues.push({
      id: uid(),
      issueNo: 'ISS-' + Date.now().toString(36).toUpperCase(),
      foodId,
      qty,
      date,
      issuedBy: by || session?.userName || '',
      dept,
      notes,
      createdAt: now()
    });
    food.qty -= qty;
    saveAll();
    closeModal('mFIss');
    renderFIss();
    addActivity('Food issued: ' + food.name + ' x' + qty + ' to ' + dept, 'food', 'Issue recorded');
    addNotification('info', 'Food Issued', food.name + ' x' + qty + ' issued to ' + dept);
    toast('Food issued', 'success');
  }

  function delFIss(idV) {
    const iss = issues.find(i => i.id === idV);
    if (!iss) return;
    confirmAction('Delete Issue Record', 'Remove this issue record? Stock will NOT be adjusted.', () => {
      issues = issues.filter(i => i.id !== idV);
      saveAll();
      renderFIss();
      toast('Issue record deleted', 'warning');
    });
  }

  // ═══════════════════════════════════════════════════════
  //  DAILY CONSUMPTION
  // ═══════════════════════════════════════════════════════
  function populateConSelects() {
    const fi = id('mCnFood');
    fi.innerHTML = '<option value="">— Select —</option>' + foodItems.filter(f => f.qty > 0).map(f => `<option value="${f.id}">${f.name} (${f.qty} ${f.unit})</option>`).join('');
  }

  function renderCon() {
    const q = id('fConSr').value.trim().toLowerCase();
    const mealF = id('fConMF').value;
    let list = [...consumption];
    if (mealF !== 'all') list = list.filter(x => x.meal === mealF);
    if (q) list = list.filter(x => {
      const food = foodItems.find(f => f.id === x.foodId);
      return (food?.name || '').toLowerCase().includes(q) || (x.loggedBy || '').toLowerCase().includes(q);
    });
    list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    // Stats
    const totalUsed = list.reduce((s, x) => s + x.qty, 0);
    const meals = [...new Set(list.map(x => x.meal))];
    id('conStats').innerHTML = `
      <div class="sc-card"><div class="sc-icon ic-green">📅</div><div class="sc-val">${list.length}</div><div class="sc-lbl">Entries</div></div>
      <div class="sc-card"><div class="sc-icon ic-teal">📊</div><div class="sc-val">${totalUsed}</div><div class="sc-lbl">Total Qty Used</div></div>
      <div class="sc-card"><div class="sc-icon ic-blue">🍽</div><div class="sc-val">${meals.length}</div><div class="sc-lbl">Meal Types</div></div>
    `;

    const tbody = id('fConBd');
    if (!list.length) {
      tbody.innerHTML = '';
      id('fConEmp').classList.remove('hidden');
      return;
    }
    id('fConEmp').classList.add('hidden');
    tbody.innerHTML = list.map((x, i) => {
      const food = foodItems.find(f => f.id === x.foodId);
      return `<tr>
        <td>${i + 1}</td>
        <td>${dfmt(x.date)}</td>
        <td><span class="badge b-blue">${x.meal}</span></td>
        <td>${food?.name || 'Unknown'}</td>
        <td>${x.qty}</td>
        <td>${food?.unit || '—'}</td>
        <td>${x.notes || '—'}</td>
        <td>${x.loggedBy || '—'}</td>
      </tr>`;
    }).join('');
  }

  function openConModal() {
    clearErr('mCn');
    populateConSelects();
    id('mCnDate').value = today();
    id('mCnMeal').value = 'Lunch';
    id('mCnQty').value = '';
    id('mCnNotes').value = '';
    openModal('mCon');
  }

  function saveCon() {
    const date = id('mCnDate').value || today();
    const meal = id('mCnMeal').value;
    const foodId = id('mCnFood').value;
    const qty = parseFloat(id('mCnQty').value) || 0;
    const notes = id('mCnNotes').value.trim();
    if (!foodId) { id('mCnFoodE').textContent = 'Select food item'; return; }
    if (qty <= 0) { id('mCnQtyE').textContent = 'Quantity must be > 0'; return; }
    const food = foodItems.find(f => f.id === foodId);
    if (!food) { toast('Food item not found', 'error'); return; }
    if (qty > food.qty) { id('mCnQtyE').textContent = 'Only ' + food.qty + ' ' + food.unit + ' available'; return; }
    consumption.push({
      id: uid(),
      date,
      meal,
      foodId,
      qty,
      notes,
      loggedBy: session?.userName || '',
      createdAt: now()
    });
    food.qty -= qty;
    saveAll();
    closeModal('mCon');
    renderCon();
    addActivity('Consumption logged: ' + food.name + ' x' + qty + ' (' + meal + ')', 'food', 'Daily consumption');
    toast('Consumption logged', 'success');
  }

  // ═══════════════════════════════════════════════════════
  //  EXPIRY MONITOR
  // ═══════════════════════════════════════════════════════
  function renderExpiry() {
    const nowD = new Date();
    const expItems = foodItems.filter(f => f.expiryDate).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    const expired = expItems.filter(f => new Date(f.expiryDate) < nowD);
    const expiring = expItems.filter(f => new Date(f.expiryDate) >= nowD && new Date(f.expiryDate) <= new Date(nowD.getTime() + 14 * 86400000));
    const safe = expItems.filter(f => new Date(f.expiryDate) > new Date(nowD.getTime() + 14 * 86400000));

    id('expStats').innerHTML = `
      <div class="sc-card"><div class="sc-icon ic-red">❌</div><div class="sc-val">${expired.length}</div><div class="sc-lbl">Expired</div></div>
      <div class="sc-card"><div class="sc-icon ic-gold">⏰</div><div class="sc-val">${expiring.length}</div><div class="sc-lbl">Expiring (14d)</div></div>
      <div class="sc-card"><div class="sc-icon ic-green">✅</div><div class="sc-val">${safe.length}</div><div class="sc-lbl">Safe</div></div>
    `;

    const renderTable = (items, label, cls) => {
      if (!items.length) return '';
      return `<div class="rep-sec"><h3 class="rep-title" style="color:var(--${cls})">${label} (${items.length})</h3>
        <table class="dt"><thead><tr><th>Name</th><th>Category</th><th>Qty</th><th>Expiry Date</th><th>Days Left</th><th>Location</th></tr></thead><tbody>
        ${items.map(f => {
          const days = Math.ceil((new Date(f.expiryDate) - nowD) / 86400000);
          return `<tr><td>${f.name}</td><td>${f.category}</td><td>${f.qty} ${f.unit}</td><td>${dfmt(f.expiryDate)}</td><td><span class="badge ${days < 0 ? 'b-red' : days <= 7 ? 'b-gold' : 'b-teal'}">${days < 0 ? 'Expired' : days + ' days'}</span></td><td>${f.location || '—'}</td></tr>`;
        }).join('')}
      </tbody></table></div>`;
    };

    id('expContent').innerHTML = renderTable(expired, 'Expired', 'red') + renderTable(expiring, 'Expiring Within 14 Days', 'gold') + renderTable(safe, 'Safe', 'green');
    if (!expItems.length) id('expContent').innerHTML = '<div class="estate"><span>✅</span><h4>No expiry dates set for any food items</h4></div>';
  }

  // ═══════════════════════════════════════════════════════
  //  FOOD MOVEMENTS
  // ═══════════════════════════════════════════════════════
  function renderFMove() {
    const q = id('fMvSr').value.trim().toLowerCase();
    const filter = id('fMvF').value;
    const recs = deliveries.map(d => ({ ...d, _t: 'received', _dt: d.date || d.createdAt, _by: d.receivedBy, _itemId: d.foodId, _qty: d.qty }));
    const iss = issues.map(i => ({ ...i, _t: 'issued', _dt: i.date || i.createdAt, _by: i.issuedBy, _itemId: i.foodId, _qty: -i.qty }));
    const cons = consumption.map(c => ({ ...c, _t: 'consumption', _dt: c.date || c.createdAt, _by: c.loggedBy, _itemId: c.foodId, _qty: -c.qty }));
    let list = [...recs, ...iss, ...cons];
    if (filter !== 'all') list = list.filter(x => x._t === filter);
    if (q) list = list.filter(x => {
      const food = foodItems.find(f => f.id === x._itemId);
      return (food?.name || '').toLowerCase().includes(q) || (x._by || '').toLowerCase().includes(q);
    });
    list.sort((a, b) => new Date(b._dt) - new Date(a._dt));
    const tbody = id('fMvBd');
    if (!list.length) {
      tbody.innerHTML = '';
      id('fMvEmp').classList.remove('hidden');
      return;
    }
    id('fMvEmp').classList.add('hidden');
    const typeMap = { received: 'b-green', issued: 'b-gold', consumption: 'b-blue' };
    const typeLabel = { received: 'Received', issued: 'Issued', consumption: 'Consumption' };
    tbody.innerHTML = list.map((x, i) => {
      const food = foodItems.find(f => f.id === x._itemId);
      return `<tr>
        <td>${i + 1}</td>
        <td>${fmt(x._dt)}</td>
        <td><span class="badge ${typeMap[x._t] || 'b-gray'}">${typeLabel[x._t] || x._t}</span></td>
        <td>${food?.name || 'Unknown'}</td>
        <td>${Math.abs(x._qty)}</td>
        <td>${food?.unit || '—'}</td>
        <td>${x._by || '—'}</td>
        <td>${x.notes || '—'}</td>
      </tr>`;
    }).join('');
  }

  // ═══════════════════════════════════════════════════════
  //  FOOD REPORTS
  // ═══════════════════════════════════════════════════════
  function renderFReport() {
    const total = foodItems.length;
    const totalQty = foodItems.reduce((s, f) => s + f.qty, 0);
    const totalVal = foodItems.reduce((s, f) => s + (f.unitCost || 0) * f.qty, 0);
    const low = getLowFood().length;
    const exp = getExpiringSoon().length;
    const cats = [...new Set(foodItems.map(f => f.category))];
    let html = `<div class="rep-sec"><h3 class="rep-title">Food Store Summary</h3>
      <div class="rep-sum">
        <div class="rep-stat"><strong>${total}</strong><span>Total Items</span></div>
        <div class="rep-stat"><strong>${totalQty}</strong><span>Total Quantity</span></div>
        <div class="rep-stat"><strong>${totalVal.toLocaleString()}</strong><span>Total Value (RWF)</span></div>
        <div class="rep-stat"><strong>${low}</strong><span>Low Stock</span></div>
        <div class="rep-stat"><strong>${exp}</strong><span>Expiring Soon</span></div>
      </div></div>`;
    cats.forEach(c => {
      const items = foodItems.filter(x => x.category === c);
      html += `<div class="rep-sec"><h3 class="rep-title">${c}</h3><table class="dt"><thead><tr><th>Name</th><th>Qty</th><th>Unit</th><th>Unit Cost</th><th>Value</th><th>Expiry</th></tr></thead><tbody>`;
      items.forEach(x => {
        html += `<tr><td>${x.name}</td><td>${x.qty}</td><td>${x.unit}</td><td>${x.unitCost ? x.unitCost.toLocaleString() + ' RWF' : '—'}</td><td>${((x.unitCost || 0) * x.qty).toLocaleString()} RWF</td><td>${dfmt(x.expiryDate)}</td></tr>`;
      });
      html += `</tbody></table></div>`;
    });
    id('fRepContent').innerHTML = html || '<div class="estate"><span>📊</span><h4>No data</h4></div>';
  }

  // ═══════════════════════════════════════════════════════
  //  BREAKFAST MANAGEMENT
  // ═══════════════════════════════════════════════════════

  let bCurrentTab = 'settings';

  function switchBTab(tab) {
    bCurrentTab = tab;
    $$('#pg-fast .atab').forEach(t => t.classList.toggle('active', t.id === 'bTab' + tab.charAt(0).toUpperCase() + tab.slice(1)));
    $$('#bSecSettings, #bSecPlan, #bSecInventory, #bSecReports').forEach(s => s.classList.add('hidden'));
    const sec = id('bSec' + tab.charAt(0).toUpperCase() + tab.slice(1));
    if (sec) sec.classList.remove('hidden');
    if (tab === 'plan') { calcBReq(); populateBPlan(); }
    if (tab === 'inventory') renderBInventory();
    if (tab === 'reports') renderBReports();
  }

  function getPrevBPlan() {
    if (!breakfastPlans.length) return null;
    return breakfastPlans.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b);
  }

  function calcBReq() {
    const eatersB = parseInt(id('bBreadEaters').value) || 0;
    const eatersC = parseInt(id('bCakeEaters').value) || 0;
    const extraB = parseInt(id('bExtraBreads').value) || 0;
    const extraC = parseInt(id('bExtraCakes').value) || 0;
    id('bReqBreads').value = Math.max(0, eatersB - extraB);
    id('bReqCakes').value = Math.max(0, eatersC - extraC);
  }

  function renderBFast() {
    switchBTab(bCurrentTab);
    populateBSettings();
    populateBPlan();
    renderBAlerts();
  }

  function populateBSettings() {
    if (breakfastSettings) {
      id('bTotStudents').value = breakfastSettings.totalStudents || '';
      id('bBreadStudents').value = breakfastSettings.breadStudents || '';
      id('bCakeStudents').value = breakfastSettings.cakeStudents || '';
    }
  }

  function saveBSettings() {
    hideAlert('bSettingsAlert');
    clearErr('bTotStudents');
    clearErr('bBreadStudents');
    clearErr('bCakeStudents');
    const total = parseInt(id('bTotStudents').value) || 0;
    const bread = parseInt(id('bBreadStudents').value) || 0;
    const cake = parseInt(id('bCakeStudents').value) || 0;
    if (total < 1) { id('bTotStudentsE').textContent = 'Total students required'; return; }
    if (bread + cake !== total) {
      showAlert('bSettingsAlert', 'Bread students + Cake students (' + (bread + cake) + ') must equal Total students (' + total + ').', 'error');
      return;
    }
    breakfastSettings = { totalStudents: total, breadStudents: bread, cakeStudents: cake };
    saveAll();
    toast('Breakfast settings saved', 'success');
  }

  function populateBPlan() {
    const prev = getPrevBPlan();
    if (prev) {
      id('bExtraBreads').value = prev.remainingBreads || 0;
      id('bExtraCakes').value = prev.remainingCakes || 0;
    } else {
      id('bExtraBreads').value = 0;
      id('bExtraCakes').value = 0;
    }
    id('bPlanDate').value = today();

    // Auto-fill from welfare data
    const feed = getFeedingStats();
    if (feed.totalBoarding > 0) {
      const bAlert = id('bPlanAlert');
      if (bAlert) {
        bAlert.className = 'falert info';
        bAlert.textContent = '🏥 Welfare-based recommendation: ' + feed.dormitoryBread + ' dorm bread, ' + feed.refectoryBread + ' refectory bread, ' + feed.agasekeEligible + ' agaseke eligible';
        bAlert.classList.remove('hidden');
      }
    }

    calcBReq();
    renderBPlanTable();

    // Today's info
    const todayPlan = breakfastPlans.find(p => p.date === today());
    const info = id('bTodayInfo');
    if (todayPlan) {
      info.innerHTML = '<div class="fi-item"><div class="fi-dot green">📅</div><div class="fi-txt"><strong>Today\'s Plan</strong><span>Present: ' + todayPlan.totalPresent + ' | Bread: ' + todayPlan.breadEaters + ' | Cake: ' + todayPlan.cakeEaters + '</span><span style="font-size:11px;color:var(--ink4)">Req. Bread: ' + todayPlan.requiredBreads + ' | Req. Cake: ' + todayPlan.requiredCakes + ' | Rem. Bread: ' + todayPlan.remainingBreads + ' | Rem. Cake: ' + todayPlan.remainingCakes + '</span></div></div>';
    } else {
      info.innerHTML = '<div class="estate" style="padding:20px"><span>📅</span><h4>No plan for today</h4></div>';
    }
  }

  function saveBPlan(e) {
    e.preventDefault();
    hideAlert('bPlanAlert');
    clearErr('bPlanDate');
    clearErr('bTotPresent');
    clearErr('bBreadEaters');
    clearErr('bCakeEaters');
    clearErr('bBreadsRec');
    clearErr('bCakesRec');
    const date = id('bPlanDate').value;
    const present = parseInt(id('bTotPresent').value) || 0;
    const breadE = parseInt(id('bBreadEaters').value) || 0;
    const cakeE = parseInt(id('bCakeEaters').value) || 0;
    const extraB = parseInt(id('bExtraBreads').value) || 0;
    const extraC = parseInt(id('bExtraCakes').value) || 0;
    const recB = parseInt(id('bBreadsRec').value) || 0;
    const recC = parseInt(id('bCakesRec').value) || 0;
    if (!date) { id('bPlanDateE').textContent = 'Date required'; return; }
    if (present < 1) { id('bTotPresentE').textContent = 'Total present required'; return; }
    if (breadE < 0) { id('bBreadEatersE').textContent = 'Valid number required'; return; }
    if (cakeE < 0) { id('bCakeEatersE').textContent = 'Valid number required'; return; }
    if (breadE + cakeE > present) {
      showAlert('bPlanAlert', 'Bread eaters + Cake eaters (' + (breadE + cakeE) + ') exceeds total present (' + present + ').', 'error');
      return;
    }
    if (recB < 0) { id('bBreadsRecE').textContent = 'Valid number required'; return; }
    if (recC < 0) { id('bCakesRecE').textContent = 'Valid number required'; return; }

    const reqB = Math.max(0, breadE - extraB);
    const reqC = Math.max(0, cakeE - extraC);
    const availB = recB + extraB;
    const availC = recC + extraC;
    const servedB = Math.min(availB, breadE);
    const servedC = Math.min(availC, cakeE);
    const remB = availB - servedB;
    const remC = availC - servedC;

    // Check if already exists for this date
    const existing = breakfastPlans.findIndex(p => p.date === date);
    const planData = {
      id: existing !== -1 ? breakfastPlans[existing].id : uid(),
      date,
      totalPresent: present,
      breadEaters: breadE,
      cakeEaters: cakeE,
      extraBreads: extraB,
      extraCakes: extraC,
      requiredBreads: reqB,
      requiredCakes: reqC,
      breadsReceived: recB,
      cakesReceived: recC,
      breadsServed: servedB,
      cakesServed: servedC,
      remainingBreads: remB,
      remainingCakes: remC,
      createdAt: existing !== -1 ? breakfastPlans[existing].createdAt : now(),
      updatedAt: now()
    };

    if (existing !== -1) {
      breakfastPlans[existing] = planData;
      addActivity('Updated breakfast plan: ' + date, 'food', 'Breakfast plan updated');
    } else {
      breakfastPlans.push(planData);
      addActivity('Created breakfast plan: ' + date, 'food', 'New breakfast plan');
    }

    saveAll();
    rf('bPlanForm');
    populateBPlan();
    renderBAlerts();
    toast('Breakfast plan saved', 'success');
  }

  function delBPlan(idV) {
    const item = breakfastPlans.find(p => p.id === idV);
    if (!item) return;
    confirmAction('Delete Plan', 'Delete breakfast plan for ' + item.date + '?', () => {
      breakfastPlans = breakfastPlans.filter(p => p.id !== idV);
      saveAll();
      populateBPlan();
      renderBAlerts();
      toast('Plan deleted', 'warning');
    });
  }

  function renderBPlanTable() {
    const list = [...breakfastPlans].sort((a, b) => new Date(b.date) - new Date(a.date));
    const tbody = id('bPlanBd');
    if (!list.length) {
      tbody.innerHTML = '';
      id('bPlanEmp').classList.remove('hidden');
      return;
    }
    id('bPlanEmp').classList.add('hidden');
    tbody.innerHTML = list.map((x, i) => `<tr>
      <td>${i + 1}</td>
      <td>${dfmt(x.date)}</td>
      <td>${x.totalPresent}</td>
      <td>${x.breadEaters}</td>
      <td>${x.cakeEaters}</td>
      <td>${x.extraBreads}</td>
      <td>${x.extraCakes}</td>
      <td><strong>${x.requiredBreads}</strong></td>
      <td><strong>${x.requiredCakes}</strong></td>
      <td>${x.breadsReceived}</td>
      <td>${x.cakesReceived}</td>
      <td>${x.breadsServed}</td>
      <td>${x.cakesServed}</td>
      <td><span class="badge ${x.remainingBreads > 0 ? 'b-green' : 'b-gray'}">${x.remainingBreads}</span></td>
      <td><span class="badge ${x.remainingCakes > 0 ? 'b-green' : 'b-gray'}">${x.remainingCakes}</span></td>
      <td><div class="ac"><button class="ico-btn del" onclick="delBPlan('${x.id}')" title="Delete">🗑</button></div></td>
    </tr>`).join('');
  }

  function renderBAlerts() {
    const cont = id('bAlerts');
    const todayPlan = breakfastPlans.find(p => p.date === today());
    const alerts = [];

    if (breakfastSettings) {
      const total = breakfastSettings.totalStudents;
      const breadS = breakfastSettings.breadStudents;
      const cakeS = breakfastSettings.cakeStudents;
      if (breadS + cakeS !== total) {
        alerts.push({ type: 'danger', msg: '⚠ Settings mismatch: Bread (' + breadS + ') + Cake (' + cakeS + ') ≠ Total (' + total + ')' });
      }
    } else {
      alerts.push({ type: 'warn', msg: '⚙ Student breakfast settings not configured.' });
    }

    if (todayPlan) {
      if (todayPlan.breadsReceived < todayPlan.requiredBreads) {
        alerts.push({ type: 'danger', msg: '🍞 Breads received (' + todayPlan.breadsReceived + ') are less than required (' + todayPlan.requiredBreads + ').' });
      }
      if (todayPlan.cakesReceived < todayPlan.requiredCakes) {
        alerts.push({ type: 'danger', msg: '🧁 Cakes received (' + todayPlan.cakesReceived + ') are less than required (' + todayPlan.requiredCakes + ').' });
      }
      if (todayPlan.breadEaters + todayPlan.cakeEaters > todayPlan.totalPresent) {
        alerts.push({ type: 'warn', msg: '⚠ Student allocation exceeds total present.' });
      }
    }

    if (!alerts.length) {
      cont.innerHTML = '<div class="estate" style="padding:20px"><span>✅</span><h4>All good — no alerts</h4></div>';
      return;
    }
    cont.innerHTML = alerts.map(a =>
      '<div class="astrip ' + a.type + '">' + a.msg + '</div>'
    ).join('');
  }

  function renderBInventory() {
    const list = [...breakfastPlans].sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalRecB = list.reduce((s, x) => s + (x.breadsReceived || 0), 0);
    const totalRecC = list.reduce((s, x) => s + (x.cakesReceived || 0), 0);
    const totalSrvB = list.reduce((s, x) => s + (x.breadsServed || 0), 0);
    const totalSrvC = list.reduce((s, x) => s + (x.cakesServed || 0), 0);
    const totalRemB = list.reduce((s, x) => s + (x.remainingBreads || 0), 0);
    const totalRemC = list.reduce((s, x) => s + (x.remainingCakes || 0), 0);

    id('bInvStats').innerHTML = `
      <div class="sc-card"><div class="sc-icon ic-green">🍞</div><div class="sc-val">${totalRecB}</div><div class="sc-lbl">Total Breads Received</div></div>
      <div class="sc-card"><div class="sc-icon ic-gold">🧁</div><div class="sc-val">${totalRecC}</div><div class="sc-lbl">Total Cakes Received</div></div>
      <div class="sc-card"><div class="sc-icon ic-blue">🍞</div><div class="sc-val">${totalSrvB}</div><div class="sc-lbl">Breads Served</div></div>
      <div class="sc-card"><div class="sc-icon ic-teal">🧁</div><div class="sc-val">${totalSrvC}</div><div class="sc-lbl">Cakes Served</div></div>
      <div class="sc-card"><div class="sc-icon ic-rust">📦</div><div class="sc-val">${totalRemB}</div><div class="sc-lbl">Remaining Breads</div></div>
      <div class="sc-card"><div class="sc-icon ic-red">📦</div><div class="sc-val">${totalRemC}</div><div class="sc-lbl">Remaining Cakes</div></div>
    `;

    const tbody = id('bInvBd');
    if (!list.length) {
      tbody.innerHTML = '';
      id('bInvEmp').classList.remove('hidden');
      return;
    }
    id('bInvEmp').classList.add('hidden');
    tbody.innerHTML = list.map((x, i) => `<tr>
      <td>${i + 1}</td>
      <td>${dfmt(x.date)}</td>
      <td>${x.breadsReceived || 0}</td>
      <td>${x.cakesReceived || 0}</td>
      <td>${x.breadsServed || 0}</td>
      <td>${x.cakesServed || 0}</td>
      <td><span class="badge ${x.remainingBreads > 0 ? 'b-green' : 'b-gray'}">${x.remainingBreads}</span></td>
      <td><span class="badge ${x.remainingCakes > 0 ? 'b-green' : 'b-gray'}">${x.remainingCakes}</span></td>
    </tr>`).join('');
  }

  function renderBReports() {
    if (!breakfastPlans.length) {
      id('bRepEmpty').classList.remove('hidden');
      id('bRepStats').innerHTML = '';
      id('bRepMonthly').innerHTML = '';
      return;
    }
    id('bRepEmpty').classList.add('hidden');

    const totalBRec = breakfastPlans.reduce((s, x) => s + (x.breadsReceived || 0), 0);
    const totalCRec = breakfastPlans.reduce((s, x) => s + (x.cakesReceived || 0), 0);
    const totalBSrv = breakfastPlans.reduce((s, x) => s + (x.breadsServed || 0), 0);
    const totalCSrv = breakfastPlans.reduce((s, x) => s + (x.cakesServed || 0), 0);
    const totalRemB = breakfastPlans.reduce((s, x) => s + (x.remainingBreads || 0), 0);
    const totalRemC = breakfastPlans.reduce((s, x) => s + (x.remainingCakes || 0), 0);
    const totalDays = breakfastPlans.length;

    id('bRepStats').innerHTML = `
      <div class="sc-card"><div class="sc-icon ic-green">📅</div><div class="sc-val">${totalDays}</div><div class="sc-lbl">Days Recorded</div></div>
      <div class="sc-card"><div class="sc-icon ic-blue">🍞</div><div class="sc-val">${totalBRec}</div><div class="sc-lbl">Breads Received</div></div>
      <div class="sc-card"><div class="sc-icon ic-teal">🧁</div><div class="sc-val">${totalCRec}</div><div class="sc-lbl">Cakes Received</div></div>
      <div class="sc-card"><div class="sc-icon ic-green">🍞</div><div class="sc-val">${totalBSrv}</div><div class="sc-lbl">Breads Served</div></div>
      <div class="sc-card"><div class="sc-icon ic-gold">🧁</div><div class="sc-val">${totalCSrv}</div><div class="sc-lbl">Cakes Served</div></div>
      <div class="sc-card"><div class="sc-icon ic-rust">📦</div><div class="sc-val">${totalRemB}</div><div class="sc-lbl">Leftover Breads</div></div>
      <div class="sc-card"><div class="sc-icon ic-red">📦</div><div class="sc-val">${totalRemC}</div><div class="sc-lbl">Leftover Cakes</div></div>
    `;

    // Monthly breakdown
    const months = {};
    breakfastPlans.forEach(p => {
      const m = p.date ? p.date.slice(0, 7) : 'unknown';
      if (!months[m]) months[m] = { days: 0, bRec: 0, cRec: 0, bSrv: 0, cSrv: 0, bRem: 0, cRem: 0 };
      months[m].days++;
      months[m].bRec += p.breadsReceived || 0;
      months[m].cRec += p.cakesReceived || 0;
      months[m].bSrv += p.breadsServed || 0;
      months[m].cSrv += p.cakesServed || 0;
      months[m].bRem += p.remainingBreads || 0;
      months[m].cRem += p.remainingCakes || 0;
    });

    let mHtml = '<table class="dt"><thead><tr><th>Month</th><th>Days</th><th>Breads Rec.</th><th>Cakes Rec.</th><th>Breads Served</th><th>Cakes Served</th><th>Leftover Breads</th><th>Leftover Cakes</th></tr></thead><tbody>';
    Object.keys(months).sort().reverse().forEach(m => {
      const d = months[m];
      mHtml += `<tr><td><strong>${m}</strong></td><td>${d.days}</td><td>${d.bRec}</td><td>${d.cRec}</td><td>${d.bSrv}</td><td>${d.cSrv}</td><td>${d.bRem}</td><td>${d.cRem}</td></tr>`;
    });
    mHtml += '</tbody></table>';
    id('bRepMonthly').innerHTML = mHtml;
  }

  function renderBDashboard() {
    const todayPlan = breakfastPlans.find(p => p.date === today());
    const cont = id('dBreakfast');
    if (!todayPlan) {
      cont.innerHTML = '<div class="estate" style="padding:20px"><span>🥖</span><h4>No breakfast data for today</h4><p style="font-size:12px">Plan your breakfast from the Breakfast Management page.</p></div>';
      return;
    }
    cont.innerHTML = `
      <div class="fi-item"><div class="fi-dot green">👥</div><div class="fi-txt"><strong>Students Today</strong><span>${todayPlan.totalPresent} present</span></div></div>
      <div class="fi-item"><div class="fi-dot green">🍞</div><div class="fi-txt"><strong>Bread Eaters</strong><span>${todayPlan.breadEaters} students</span></div></div>
      <div class="fi-item"><div class="fi-dot gold">🧁</div><div class="fi-txt"><strong>Cake Eaters</strong><span>${todayPlan.cakeEaters} students</span></div></div>
      <div class="fi-item"><div class="fi-dot blue">🧮</div><div class="fi-txt"><strong>Breads Needed</strong><span>${todayPlan.requiredBreads}</span></div></div>
      <div class="fi-item"><div class="fi-dot teal">🧮</div><div class="fi-txt"><strong>Cakes Needed</strong><span>${todayPlan.requiredCakes}</span></div></div>
      <div class="fi-item"><div class="fi-dot green">📦</div><div class="fi-txt"><strong>Remaining Breads</strong><span>${todayPlan.remainingBreads}</span></div></div>
      <div class="fi-item"><div class="fi-dot gold">📦</div><div class="fi-txt"><strong>Remaining Cakes</strong><span>${todayPlan.remainingCakes}</span></div></div>
    `;
  }

  // ═══════════════════════════════════════════════════════
  //  AGASEKE MANAGEMENT
  // ═══════════════════════════════════════════════════════

  const AGASEKE_SCHEDULE = {
    Monday: 'fermented_milk', Tuesday: 'eggs',
    Thursday: 'eggs', Friday: 'fermented_milk', Sunday: 'yellow_bananas'
  };
  const AGASEKE_PRODUCT_NAMES = {
    fermented_milk: 'Fermented Milk', eggs: 'Eggs', yellow_bananas: 'Yellow Bananas'
  };
  const AGASEKE_PRODUCT_ICONS = {
    fermented_milk: '🥛', eggs: '🥚', yellow_bananas: '🍌'
  };
  const AGASEKE_DAYS_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  let aCurrentTab = 'schedule';

  function switchATab(tab) {
    aCurrentTab = tab;
    $$('#pg-agaseke .atab').forEach(t => t.classList.toggle('active', t.id === 'aTab' + tab.charAt(0).toUpperCase() + tab.slice(1)));
    $$('#aSecSchedule, #aSecPlan, #aSecInventory, #aSecReports, #aSecProducts').forEach(s => s.classList.add('hidden'));
    const sec = id('aSec' + tab.charAt(0).toUpperCase() + tab.slice(1));
    if (sec) sec.classList.remove('hidden');
    if (tab === 'plan') populateAPlan();
    if (tab === 'inventory') renderAInventory();
    if (tab === 'reports') renderAGeneratedReport();
    if (tab === 'products') populateAProducts();
  }

  function getATodayItem() {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const todayName = days[new Date().getDay()];
    return AGASEKE_SCHEDULE[todayName] || null;
  }

  function getNextADay() {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const todayIdx = new Date().getDay();
    for (let i = 1; i <= 7; i++) {
      const checkName = days[(todayIdx + i) % 7];
      if (AGASEKE_SCHEDULE[checkName]) return { day: checkName, product: AGASEKE_SCHEDULE[checkName] };
    }
    return null;
  }

  function getALastRecordForProduct(productKey) {
    const records = agasekeRecords.filter(r => r.productKey === productKey).sort((a, b) => new Date(b.date) - new Date(a.date));
    return records.length ? records[0] : null;
  }

  function getAProductStock(productKey) {
    const records = agasekeRecords.filter(r => r.productKey === productKey);
    const totalRec = records.reduce((s, r) => s + (r.stockReceived || 0), 0);
    const totalDist = records.reduce((s, r) => s + (r.stockDistributed || 0), 0);
    const totalDam = records.reduce((s, r) => s + (r.stockDamaged || 0), 0);
    const remaining = totalRec - totalDist - totalDam;
    const last = getALastRecordForProduct(productKey);
    return { totalReceived: totalRec, totalDistributed: totalDist, totalDamaged: totalDam, remaining: Math.max(0, remaining), carryForward: last ? (last.stockRemaining || 0) : 0 };
  }

  function renderAAgaseke() {
    switchATab(aCurrentTab);
    populateAPlan();
    renderASchedule();
    renderAAlerts();
  }

  function renderASchedule() {
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const todayIdx = new Date().getDay();
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const todayName = dayNames[todayIdx];
    let html = '';
    days.forEach(d => {
      const productKey = AGASEKE_SCHEDULE[d];
      const isToday = d === todayName;
      const isAgaseke = !!productKey;
      const pname = productKey ? AGASEKE_PRODUCT_NAMES[productKey] : '—';
      const icon = productKey ? AGASEKE_PRODUCT_ICONS[productKey] : '—';
      html += `<div class="fi-item" style="${isToday ? 'background:var(--fbg2);border-left:3px solid var(--forest3)' : ''}">
        <div class="fi-dot ${isAgaseke ? (isToday ? 'green' : 'gold') : 'gray'}">${isToday ? '📌' : (isAgaseke ? '✅' : '—')}</div>
        <div class="fi-txt"><strong>${d}${isToday ? ' <span class="badge b-green">Today</span>' : ''}</strong>
        <span>${isAgaseke ? icon + ' ' + pname : 'No Agaseke distribution'}</span></div>
      </div>`;
    });
    id('aScheduleContent').innerHTML = html;
  }

  function calcAReq() {
    const students = parseInt(id('aStudents').value) || 0;
    const qtyPer = parseFloat(id('aQtyPerStudent').value) || 0;
    const remaining = parseInt(id('aRemainingStock').value) || 0;
    const reqQty = students * qtyPer;
    id('aReqQty').value = reqQty;
    id('aNetQty').value = Math.max(0, reqQty - remaining);
  }

  function populateAPlan() {
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const todayName = dayNames[new Date().getDay()];
    const todayItem = getATodayItem();
    const productQty = todayItem ? (agasekeProducts[todayItem]?.defaultQty || 1) : 1;
    id('aPlanDate').value = today();
    id('aItemServed').value = todayItem ? AGASEKE_PRODUCT_NAMES[todayItem] + ' (' + todayName + ')' : 'No Agaseke today';
    id('aQtyPerStudent').value = productQty;
    // Auto-suggest from welfare data
    const feed = getFeedingStats();
    const suggestedStudents = feed.agasekeEligible || '';
    id('aStudents').value = suggestedStudents;
    id('aStudents').placeholder = suggestedStudents ? 'Welfare suggests: ' + suggestedStudents : 'Enter number';
    id('aStockRec').value = '';
    id('aStockDist').value = '';
    id('aStockDamaged').value = '';
    id('aNotes').value = '';

    if (todayItem) {
      const stock = getAProductStock(todayItem);
      id('aAvailStock').value = stock.remaining;
      const last = getALastRecordForProduct(todayItem);
      id('aRemainingStock').value = last ? (last.stockRemaining || 0) : 0;
    } else {
      id('aAvailStock').value = 0;
      id('aRemainingStock').value = 0;
    }
    calcAReq();
    renderAPlanTable();

    const todayRec = agasekeRecords.find(r => r.date === today());
    const info = id('aTodayInfo');
    if (todayRec) {
      const pname = AGASEKE_PRODUCT_NAMES[todayRec.productKey] || todayRec.productKey;
      info.innerHTML = '<div class="fi-item"><div class="fi-dot green">📋</div><div class="fi-txt"><strong>Today\'s Distribution</strong><span>Item: ' + pname + ' | Students: ' + todayRec.studentsPresent + ' | Distributed: ' + todayRec.stockDistributed + '</span><span style="font-size:11px;color:var(--ink4)">Req: ' + todayRec.requiredQty + ' | Net: ' + todayRec.netQtyNeeded + ' | Remaining: ' + (todayRec.stockRemaining || 0) + '</span></div></div>';
    } else {
      info.innerHTML = '<div class="estate" style="padding:20px"><span>📅</span><h4>No distribution recorded for today</h4></div>';
    }
  }

  function saveAPlan(e) {
    e.preventDefault();
    hideAlert('aPlanAlert');
    clearErr('aPlanDate');
    clearErr('aStudents');
    clearErr('aStockRec');
    const date = id('aPlanDate').value;
    const students = parseInt(id('aStudents').value) || 0;
    const qtyPer = parseFloat(id('aQtyPerStudent').value) || 0;
    const todayItem = getATodayItem();
    if (!date) { id('aPlanDateE').textContent = 'Date required'; return; }
    if (!todayItem) { showAlert('aPlanAlert', 'Today is not an Agaseke distribution day.', 'error'); return; }
    if (students < 1) { id('aStudentsE').textContent = 'Students present required'; return; }
    const recB = parseInt(id('aStockRec').value) || 0;
    if (recB < 0) { id('aStockRecE').textContent = 'Valid stock received required'; return; }
    const dist = parseInt(id('aStockDist').value) || 0;
    const dam = parseInt(id('aStockDamaged').value) || 0;
    const notes = id('aNotes').value.trim();
    const remaining = parseInt(id('aRemainingStock').value) || 0;
    const reqQty = students * qtyPer;
    const netQty = Math.max(0, reqQty - remaining);
    const stockRemaining = Math.max(0, recB + remaining - dist - dam);

    const existing = agasekeRecords.findIndex(r => r.date === date);
    const recData = {
      id: existing !== -1 ? agasekeRecords[existing].id : uid(),
      date,
      dayOfWeek: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(date).getDay()],
      productKey: todayItem,
      studentsPresent: students,
      qtyPerStudent: qtyPer,
      requiredQty: reqQty,
      availableStock: parseInt(id('aAvailStock').value) || 0,
      remainingStockFromPrev: remaining,
      netQtyNeeded: netQty,
      stockReceived: recB,
      stockDistributed: dist,
      stockDamaged: dam,
      stockRemaining,
      notes,
      createdAt: existing !== -1 ? agasekeRecords[existing].createdAt : now(),
      updatedAt: now()
    };

    if (existing !== -1) {
      agasekeRecords[existing] = recData;
      addActivity('Updated Agaseke record: ' + date, 'food', 'Agaseke distribution updated');
    } else {
      agasekeRecords.push(recData);
      addActivity('Created Agaseke record: ' + date, 'food', 'New Agaseke distribution');
    }
    saveAll();
    rf('aPlanForm');
    populateAPlan();
    renderAAlerts();
    toast('Distribution saved', 'success');
  }

  function delARecord(idV) {
    const item = agasekeRecords.find(r => r.id === idV);
    if (!item) return;
    confirmAction('Delete Record', 'Delete Agaseke record for ' + item.date + '?', () => {
      agasekeRecords = agasekeRecords.filter(r => r.id !== idV);
      saveAll();
      populateAPlan();
      renderAAlerts();
      toast('Record deleted', 'warning');
    });
  }

  function renderAPlanTable() {
    const list = [...agasekeRecords].sort((a, b) => new Date(b.date) - new Date(a.date));
    const tbody = id('aPlanBd');
    if (!list.length) {
      tbody.innerHTML = '';
      id('aPlanEmp').classList.remove('hidden');
      return;
    }
    id('aPlanEmp').classList.add('hidden');
    tbody.innerHTML = list.map((x, i) => {
      const pname = AGASEKE_PRODUCT_NAMES[x.productKey] || x.productKey;
      const icon = AGASEKE_PRODUCT_ICONS[x.productKey] || '🍽';
      return `<tr>
        <td>${i + 1}</td>
        <td>${dfmt(x.date)}</td>
        <td>${x.dayOfWeek || '—'}</td>
        <td>${icon} ${pname}</td>
        <td>${x.studentsPresent}</td>
        <td>${x.qtyPerStudent}</td>
        <td><strong>${x.requiredQty}</strong></td>
        <td><strong>${x.netQtyNeeded}</strong></td>
        <td>${x.stockReceived || 0}</td>
        <td>${x.stockDistributed || 0}</td>
        <td>${x.stockDamaged || 0}</td>
        <td><span class="badge ${(x.stockRemaining || 0) > 0 ? 'b-green' : 'b-gray'}">${x.stockRemaining || 0}</span></td>
        <td><div class="ac"><button class="ico-btn del" onclick="delARecord('${x.id}')" title="Delete">🗑</button></div></td>
      </tr>`;
    }).join('');
  }

  function renderAAlerts() {
    const cont = id('aAlerts');
    const todayItem = getATodayItem();
    const alerts = [];

    if (todayItem) {
      const todayRec = agasekeRecords.find(r => r.date === today());
      if (!todayRec) {
        alerts.push({ type: 'warn', msg: '📋 No distribution recorded for today (' + AGASEKE_PRODUCT_NAMES[todayItem] + ').' });
      }
      const stock = getAProductStock(todayItem);
      if (stock.remaining <= 0) {
        alerts.push({ type: 'danger', msg: '📦 No stock available for ' + AGASEKE_PRODUCT_NAMES[todayItem] + '!' });
      }
    }

    // Check upcoming days
    const next = getNextADay();
    if (next) {
      const stock = getAProductStock(next.product);
      if (stock.remaining <= 0) {
        alerts.push({ type: 'warn', msg: '⚠ Upcoming ' + next.day + ' (' + AGASEKE_PRODUCT_NAMES[next.product] + ') has no stock.' });
      }
    }

    if (!alerts.length) {
      cont.innerHTML = '<div class="estate" style="padding:20px"><span>✅</span><h4>All good</h4></div>';
      return;
    }
    cont.innerHTML = alerts.map(a => '<div class="astrip ' + a.type + '">' + a.msg + '</div>').join('');
  }

  function renderAInventory() {
    const products = ['fermented_milk', 'eggs', 'yellow_bananas'];
    let statsHtml = '';
    products.forEach(pk => {
      const s = getAProductStock(pk);
      const icon = AGASEKE_PRODUCT_ICONS[pk];
      statsHtml += `<div class="sc-card"><div class="sc-icon ic-green">${icon}</div><div class="sc-val">${s.remaining}</div><div class="sc-lbl">${AGASEKE_PRODUCT_NAMES[pk]} Remaining</div></div>`;
    });
    id('aInvStats').innerHTML = statsHtml;

    const tbody = id('aInvBd');
    const isEmpty = products.every(pk => {
      const s = getAProductStock(pk);
      return s.totalReceived === 0 && s.totalDistributed === 0;
    });
    if (isEmpty) {
      tbody.innerHTML = '';
      id('aInvEmp').classList.remove('hidden');
      return;
    }
    id('aInvEmp').classList.add('hidden');
    tbody.innerHTML = products.map(pk => {
      const s = getAProductStock(pk);
      const icon = AGASEKE_PRODUCT_ICONS[pk];
      return `<tr>
        <td><strong>${icon} ${AGASEKE_PRODUCT_NAMES[pk]}</strong></td>
        <td>${s.totalReceived}</td>
        <td>${s.totalDistributed}</td>
        <td>${s.totalDamaged}</td>
        <td><span class="badge ${s.remaining > 0 ? 'b-green' : 'b-gray'}">${s.remaining}</span></td>
        <td>${s.carryForward}</td>
      </tr>`;
    }).join('');
  }

  function populateAProducts() {
    id('aPMilkQty').value = agasekeProducts.fermented_milk?.defaultQty || 1;
    id('aPEggsQty').value = agasekeProducts.eggs?.defaultQty || 1;
    id('aPBananaQty').value = agasekeProducts.yellow_bananas?.defaultQty || 2;
  }

  function saveAProducts() {
    hideAlert('aProductsAlert');
    const milk = parseFloat(id('aPMilkQty').value) || 1;
    const eggs = parseFloat(id('aPEggsQty').value) || 1;
    const banana = parseFloat(id('aPBananaQty').value) || 2;
    if (milk < 0 || eggs < 0 || banana < 0) {
      showAlert('aProductsAlert', 'Quantities cannot be negative.', 'error');
      return;
    }
    agasekeProducts.fermented_milk.defaultQty = milk;
    agasekeProducts.eggs.defaultQty = eggs;
    agasekeProducts.yellow_bananas.defaultQty = banana;
    saveAll();
    toast('Product settings saved', 'success');
  }

  function renderAGeneratedReport() {
    const type = id('aRepType').value;
    const productFilter = id('aRepProduct').value;
    let records = [...agasekeRecords];
    if (productFilter !== 'all') records = records.filter(r => r.productKey === productFilter);
    records.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!records.length) {
      id('aRepContent').innerHTML = '<div class="estate"><span>📊</span><h4>No data for selected filters</h4></div>';
      return;
    }

    // Filter by type
    const now = new Date();
    if (type === 'weekly') {
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      records = records.filter(r => new Date(r.date) >= weekAgo);
    } else if (type === 'monthly') {
      const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1);
      records = records.filter(r => new Date(r.date) >= monthAgo);
    }

    // Stats
    const totalStudents = records.reduce((s, r) => s + (r.studentsPresent || 0), 0);
    const totalRec = records.reduce((s, r) => s + (r.stockReceived || 0), 0);
    const totalDist = records.reduce((s, r) => s + (r.stockDistributed || 0), 0);
    const totalDam = records.reduce((s, r) => s + (r.stockDamaged || 0), 0);

    // By product breakdown
    const byProduct = {};
    records.forEach(r => {
      const pk = r.productKey || 'other';
      if (!byProduct[pk]) byProduct[pk] = { rec: 0, dist: 0, dam: 0, students: 0 };
      byProduct[pk].rec += r.stockReceived || 0;
      byProduct[pk].dist += r.stockDistributed || 0;
      byProduct[pk].dam += r.stockDamaged || 0;
      byProduct[pk].students += r.studentsPresent || 0;
    });

    const productRows = Object.keys(byProduct).map(pk => {
      const d = byProduct[pk];
      const name = AGASEKE_PRODUCT_NAMES[pk] || pk;
      const icon = AGASEKE_PRODUCT_ICONS[pk] || '🍽';
      return `<tr><td>${icon} ${name}</td><td>${d.students}</td><td>${d.rec}</td><td>${d.dist}</td><td>${d.dam}</td><td>${d.rec - d.dist - d.dam}</td></tr>`;
    }).join('');

    const totalRem = totalRec - totalDist - totalDam;

    id('aRepStats').innerHTML = `
      <div class="sc-card"><div class="sc-icon ic-green">📊</div><div class="sc-val">${records.length}</div><div class="sc-lbl">${type.charAt(0).toUpperCase() + type.slice(1)} Records</div></div>
      <div class="sc-card"><div class="sc-icon ic-blue">👥</div><div class="sc-val">${totalStudents}</div><div class="sc-lbl">Total Students</div></div>
      <div class="sc-card"><div class="sc-icon ic-teal">🚚</div><div class="sc-val">${totalRec}</div><div class="sc-lbl">Total Received</div></div>
      <div class="sc-card"><div class="sc-icon ic-green">🍽</div><div class="sc-val">${totalDist}</div><div class="sc-lbl">Total Distributed</div></div>
      <div class="sc-card"><div class="sc-icon ic-rust">⚠️</div><div class="sc-val">${totalDam}</div><div class="sc-lbl">Total Damaged</div></div>
      <div class="sc-card"><div class="sc-icon ic-gold">📦</div><div class="sc-val">${totalRem}</div><div class="sc-lbl">Total Remaining</div></div>
    `;

    let html = `<div class="rep-sec"><h3 class="rep-title">${type.charAt(0).toUpperCase() + type.slice(1)} Report — Product Breakdown</h3>
      <table class="dt"><thead><tr><th>Product</th><th>Students Served</th><th>Received</th><th>Distributed</th><th>Damaged</th><th>Remaining</th></tr></thead><tbody>
      ${productRows}
    </tbody></table></div>`;

    html += `<div class="rep-sec"><h3 class="rep-title">Daily Records</h3>
      <table class="dt"><thead><tr><th>Date</th><th>Day</th><th>Item</th><th>Students</th><th>Qty/Stu</th><th>Req</th><th>Rec</th><th>Dist</th><th>Dam</th><th>Remaining</th></tr></thead><tbody>
      ${records.map(r => {
        const pname = AGASEKE_PRODUCT_NAMES[r.productKey] || r.productKey;
        const icon = AGASEKE_PRODUCT_ICONS[r.productKey] || '🍽';
        return `<tr><td>${dfmt(r.date)}</td><td>${r.dayOfWeek || '—'}</td><td>${icon} ${pname}</td><td>${r.studentsPresent}</td><td>${r.qtyPerStudent}</td><td>${r.requiredQty}</td><td>${r.stockReceived || 0}</td><td>${r.stockDistributed || 0}</td><td>${r.stockDamaged || 0}</td><td><span class="badge ${(r.stockRemaining || 0) > 0 ? 'b-green' : 'b-gray'}">${r.stockRemaining || 0}</span></td></tr>`;
      }).join('')}
    </tbody></table></div>`;

    id('aRepContent').innerHTML = html;
  }

  function renderADashboard() {
    const todayItem = getATodayItem();
    const cont = id('dAgaseke');
    if (!todayItem) {
      const next = getNextADay();
      const nextText = next ? 'Next: ' + next.day + ' (' + AGASEKE_PRODUCT_NAMES[next.product] + ')' : 'No upcoming';
      cont.innerHTML = '<div class="estate" style="padding:20px"><span>🍌</span><h4>No Agaseke today</h4><p style="font-size:12px">' + nextText + '</p></div>';
      return;
    }
    const todayRec = agasekeRecords.find(r => r.date === today());
    const stock = getAProductStock(todayItem);
    const students = todayRec ? todayRec.studentsPresent : '—';
    const reqQty = todayRec ? todayRec.requiredQty : '—';
    const remaining = todayRec ? todayRec.stockRemaining : stock.remaining;
    const next = getNextADay();
    const nextText = next ? next.day + ' (' + AGASEKE_PRODUCT_NAMES[next.product] + ')' : '—';

    cont.innerHTML = `
      <div class="fi-item"><div class="fi-dot green">🍽</div><div class="fi-txt"><strong>Today's Item</strong><span>${AGASEKE_PRODUCT_NAMES[todayItem]}</span></div></div>
      <div class="fi-item"><div class="fi-dot blue">👥</div><div class="fi-txt"><strong>Students Present</strong><span>${students}</span></div></div>
      <div class="fi-item"><div class="fi-dot teal">🧮</div><div class="fi-txt"><strong>Quantity Required</strong><span>${reqQty}</span></div></div>
      <div class="fi-item"><div class="fi-dot gold">📦</div><div class="fi-txt"><strong>Quantity Available</strong><span>${stock.remaining}</span></div></div>
      <div class="fi-item"><div class="fi-dot ${remaining > 0 ? 'green' : 'gray'}">📦</div><div class="fi-txt"><strong>Quantity Remaining</strong><span>${remaining}</span></div></div>
      <div class="fi-item"><div class="fi-dot rust">📅</div><div class="fi-txt"><strong>Next Agaseke Day</strong><span>${nextText}</span></div></div>
    `;
  }

  function renderWelfareDashboard() {
    const feed = getFeedingStats();
    const active = getActiveWelfareRecords();
    const cont = id('dWelfare');
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const expectedToday = active.filter(r => r.expectedReturn && new Date(r.expectedReturn).toDateString() === todayDate.toDateString());
    const overdue = active.filter(r => r.expectedReturn && new Date(r.expectedReturn) < todayDate && r.status !== 'Present in Dormitory' && r.status !== 'Present at School');

    let html = `
      <div class="fi-item"><div class="fi-dot green">👥</div><div class="fi-txt"><strong>Total Boarding</strong><span>${feed.totalBoarding}</span></div></div>
      <div class="fi-item"><div class="fi-dot blue">✅</div><div class="fi-txt"><strong>Present at School</strong><span>${feed.present}</span></div></div>
      <div class="fi-item"><div class="fi-dot teal">🏠</div><div class="fi-txt"><strong>In Dormitory</strong><span>${feed.inDorm}</span></div></div>
      <div class="fi-item"><div class="fi-dot gold">🍽</div><div class="fi-txt"><strong>In Refectory</strong><span>${feed.inRefectory}</span></div></div>
      <div class="fi-item"><div class="fi-dot red">🤒</div><div class="fi-txt"><strong>Sick / Sick Bay</strong><span>${feed.sick}</span></div></div>
      <div class="fi-item"><div class="fi-dot danger">🏥</div><div class="fi-txt"><strong>Hospitalized</strong><span>${feed.hospitalized}</span></div></div>
      <div class="fi-item"><div class="fi-dot rust">🚶</div><div class="fi-txt"><strong>Sent Home / Leave</strong><span>${feed.sentHome + feed.onLeave}</span></div></div>
      <div class="fi-item"><div class="fi-dot dark">❓</div><div class="fi-txt"><strong>Missing</strong><span>${feed.missing}</span></div></div>`;

    if (expectedToday.length) {
      html += `<div class="fi-item"><div class="fi-dot green">📅</div><div class="fi-txt"><strong>Expected Back Today</strong><span>${expectedToday.map(r => r.studentName).join(', ')}</span></div></div>`;
    }
    if (overdue.length) {
      html += `<div class="fi-item"><div class="fi-dot danger">⚠️</div><div class="fi-txt"><strong>Overdue Returns</strong><span>${overdue.length} students</span></div></div>`;
    }

    cont.innerHTML = html || '<div class="estate" style="padding:20px"><span>🏥</span><h4>No welfare data</h4></div>';
  }

  function renderFoodPlanDashboard() {
    const feed = getFeedingStats();
    const cont = id('dFoodPlan');
    const plans = ls('breakfastPlans') || [];
    const todayPlan = plans.find(p => p.date === today());
    const breadRem = todayPlan ? todayPlan.remainingBreads : '—';
    const cakeRem = todayPlan ? todayPlan.remainingCakes : '—';

    let html = `
      <div class="fi-item"><div class="fi-dot gold">🍞</div><div class="fi-txt"><strong>Dormitory Bread</strong><span>${feed.dormitoryBread}</span></div></div>
      <div class="fi-item"><div class="fi-dot blue">🍞</div><div class="fi-txt"><strong>Refectory Bread</strong><span>${feed.refectoryBread}</span></div></div>
      <div class="fi-item"><div class="fi-dot green">🍞</div><div class="fi-txt"><strong>Total Bread Needed</strong><span>${feed.totalBread}</span></div></div>
      <div class="fi-item"><div class="fi-dot teal">🥚🥛🍌</div><div class="fi-txt"><strong>Agaseke Eligible</strong><span>${feed.agasekeEligible}</span></div></div>
      <div class="fi-item"><div class="fi-dot ${feed.noFood > 0 ? 'red' : 'gray'}">🚫</div><div class="fi-txt"><strong>No Food Allocation</strong><span>${feed.noFood}</span></div></div>
      <div class="fi-item"><div class="fi-dot rust">📦</div><div class="fi-txt"><strong>Bread Remaining</strong><span>${breadRem}</span></div></div>
      <div class="fi-item"><div class="fi-dot rust">🧁</div><div class="fi-txt"><strong>Cakes Remaining</strong><span>${cakeRem}</span></div></div>`;

    cont.innerHTML = html || '<div class="estate" style="padding:20px"><span>🍽</span><h4>No data</h4></div>';
  }

  // ═══════════════════════════════════════════════════════
  //  REFECTORY EQUIPMENT
  // ═══════════════════════════════════════════════════════
  function renderEq() {
    const q = id('eqSr').value.trim().toLowerCase();
    const cf = id('eqCF').value;
    const sf = id('eqSF').value;
    let list = [...equipment];
    if (cf !== 'all') list = list.filter(x => x.condition === cf);
    if (sf !== 'all') list = list.filter(x => x.status === sf);
    if (q) list = list.filter(x => x.name.toLowerCase().includes(q) || x.category.toLowerCase().includes(q));
    const tbody = id('eqBd');
    if (!list.length) {
      tbody.innerHTML = '';
      id('eqPg').classList.add('hidden');
      id('eqEmp').classList.remove('hidden');
      return;
    }
    id('eqEmp').classList.add('hidden');
    const p = pg('eq', list);
    id('eqPg').classList.remove('hidden');
    id('eqPg').innerHTML = pgCtrl('eq', list.length);
    tbody.innerHTML = p.items.map((x, i) => {
      const val = (x.unitCost || 0) * x.qty;
      return `<tr>
        <td>${p.start + i}</td>
        <td><strong>${x.name}</strong></td>
        <td>${x.category}</td>
        <td>${x.qty}</td>
        <td>${x.min || '—'}</td>
        <td><span class="badge ${x.condition === 'Excellent' ? 'b-green' : x.condition === 'Good' ? 'b-teal' : x.condition === 'Fair' ? 'b-gold' : 'b-red'}">${x.condition}</span></td>
        <td><span class="badge ${x.status === 'Available' ? 'b-green' : x.status === 'In Use' ? 'b-blue' : x.status === 'Missing' ? 'b-red' : 'b-gold'}">${x.status}</span></td>
        <td>${x.unitCost ? x.unitCost.toLocaleString() + ' RWF' : '—'}</td>
        <td>${val ? val.toLocaleString() + ' RWF' : '—'}</td>
        <td>${x.location || '—'}</td>
        <td>${dfmt(x.purchaseDate)}</td>
        <td><div class="ac">
          <button class="ico-btn" onclick="editEqItem('${x.id}')" title="Edit">✏️</button>
          <button class="ico-btn del" onclick="delEqItem('${x.id}')" title="Delete">🗑</button>
        </div></td>
      </tr>`;
    }).join('');
  }
  pgFns.eq = renderEq;

  function openEqModal(item) {
    clearErr('mEq');
    id('mEqT').textContent = item ? 'Edit Equipment' : 'Add Equipment';
    id('mEqId').value = item ? item.id : '';
    id('mEqNm').value = item ? item.name : '';
    id('mEqCat').value = item ? item.category : 'Plates';
    id('mEqQty').value = item ? item.qty : '';
    id('mEqMin').value = item ? item.min || '' : '';
    id('mEqCost').value = item ? item.unitCost || '' : '';
    id('mEqCond').value = item ? item.condition : 'Excellent';
    id('mEqStat').value = item ? item.status : 'Available';
    id('mEqLoc').value = item ? item.location || '' : '';
    id('mEqPurch').value = item ? item.purchaseDate || '' : '';
    id('mEqLife').value = item ? item.lifespan || '' : '';
    id('mEqNotes').value = item ? item.notes || '' : '';
    openModal('mEq');
  }

  function saveEq() {
    const idV = id('mEqId').value;
    const name = id('mEqNm').value.trim();
    const cat = id('mEqCat').value;
    const qty = parseInt(id('mEqQty').value) || 0;
    const min = parseInt(id('mEqMin').value) || 0;
    const cost = parseFloat(id('mEqCost').value) || 0;
    const cond = id('mEqCond').value;
    const stat = id('mEqStat').value;
    const loc = id('mEqLoc').value.trim();
    const purch = id('mEqPurch').value;
    const life = parseInt(id('mEqLife').value) || 0;
    const notes = id('mEqNotes').value.trim();
    if (!name) { id('mEqNmE').textContent = 'Name required'; return; }
    if (isNaN(qty) || qty < 0) { id('mEqQtyE').textContent = 'Valid quantity required'; return; }
    if (idV) {
      const idx = equipment.findIndex(x => x.id === idV);
      if (idx !== -1) {
        equipment[idx] = { ...equipment[idx], name, category: cat, qty, min, condition: cond, status: stat, unitCost: cost, location: loc, purchaseDate: purch, lifespan: life, notes, updatedAt: now() };
        addActivity('Updated equipment: ' + name, 'equipment', 'Item details updated');
      }
    } else {
      equipment.push({ id: uid(), name, category: cat, qty, min, condition: cond, status: stat, unitCost: cost, location: loc, purchaseDate: purch, lifespan: life, notes, createdAt: now(), updatedAt: now() });
      addActivity('Added equipment: ' + name, 'equipment', 'New item created');
    }
    saveAll();
    closeModal('mEq');
    renderEq();
    toast(idV ? 'Equipment updated' : 'Equipment added', 'success');
  }

  function editEqItem(idV) {
    const item = equipment.find(x => x.id === idV);
    if (item) openEqModal(item);
  }
  function delEqItem(idV) {
    const item = equipment.find(x => x.id === idV);
    if (!item) return;
    confirmAction('Delete Equipment', 'Delete "' + item.name + '"?', () => {
      equipment = equipment.filter(x => x.id !== idV);
      saveAll();
      renderEq();
      addActivity('Deleted equipment: ' + item.name, 'equipment', 'Item removed');
      toast('Equipment deleted', 'warning');
    });
  }

  // ═══════════════════════════════════════════════════════
  //  LOSS & DAMAGE
  // ═══════════════════════════════════════════════════════
  function renderDam() {
    const q = id('damSr').value.trim().toLowerCase();
    const tf = id('damTF').value;
    let list = [...damages];
    if (tf !== 'all') list = list.filter(x => x.type === tf);
    if (q) list = list.filter(x => x.itemName.toLowerCase().includes(q) || (x.reportedBy || '').toLowerCase().includes(q));
    list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    const totalLost = list.reduce((s, x) => s + x.qty, 0);
    id('damStats').innerHTML = `
      <div class="sc-card"><div class="sc-icon ic-red">⚠️</div><div class="sc-val">${list.length}</div><div class="sc-lbl">Reports</div></div>
      <div class="sc-card"><div class="sc-icon ic-rust">📊</div><div class="sc-val">${totalLost}</div><div class="sc-lbl">Total Items Lost/Damaged</div></div>
      <div class="sc-card"><div class="sc-icon ic-gold">🏷</div><div class="sc-val">${[...new Set(list.map(x => x.type))].length}</div><div class="sc-lbl">Types</div></div>
    `;

    const tbody = id('damBd');
    if (!list.length) {
      tbody.innerHTML = '';
      id('damEmp').classList.remove('hidden');
      return;
    }
    id('damEmp').classList.add('hidden');
    tbody.innerHTML = list.map((x, i) => {
      return `<tr>
        <td>${i + 1}</td>
        <td style="font-family:monospace">${x.reportNo || '—'}</td>
        <td>${x.itemName}</td>
        <td><span class="badge ${x.type === 'Missing' ? 'b-red' : x.type === 'Broken' ? 'b-gold' : 'b-rust'}">${x.type}</span></td>
        <td>${x.qty}</td>
        <td>${dfmt(x.date)}</td>
        <td>${x.reason || '—'}</td>
        <td>${x.reportedBy || '—'}</td>
        <td>${x.notes || '—'}</td>
      </tr>`;
    }).join('');
  }

  function openDamModal() {
    clearErr('mD');
    id('mDItem').value = '';
    id('mDItemType').value = '';
    id('mDType').value = 'Damaged';
    id('mDQty').value = '';
    id('mDDate').value = today();
    id('mDBy').value = session?.userName || '';
    id('mDReason').value = '';
    id('mDNotes').value = '';
    openModal('mDam');
  }

  function saveDam() {
    const itemName = id('mDItem').value.trim();
    const itemType = id('mDItemType').value.trim();
    const type = id('mDType').value;
    const qty = parseInt(id('mDQty').value) || 0;
    const date = id('mDDate').value || today();
    const by = id('mDBy').value.trim();
    const reason = id('mDReason').value.trim();
    const notes = id('mDNotes').value.trim();
    if (!itemName) { id('mDItemE').textContent = 'Item name required'; return; }
    if (qty < 1) { id('mDQtyE').textContent = 'Quantity must be > 0'; return; }
    damages.push({
      id: uid(),
      reportNo: 'DAM-' + Date.now().toString(36).toUpperCase(),
      itemName,
      itemType,
      type,
      qty,
      date,
      reportedBy: by || session?.userName || '',
      reason,
      notes,
      createdAt: now()
    });
    saveAll();
    closeModal('mDam');
    renderDam();
    addActivity('Damage reported: ' + itemName + ' x' + qty + ' (' + type + ')', 'equipment', 'Damage/loss report');
    addNotification('danger', 'Damage Report', itemName + ' reported as ' + type + ' (x' + qty + ')');
    toast('Report submitted', 'success');
  }

  // ═══════════════════════════════════════════════════════
  //  SUPPLIERS
  // ═══════════════════════════════════════════════════════
  function renderSup() {
    const q = id('supSr').value.trim().toLowerCase();
    let list = [...suppliers];
    if (q) list = list.filter(x => x.name.toLowerCase().includes(q) || (x.contactPerson || '').toLowerCase().includes(q) || (x.products || '').toLowerCase().includes(q));
    const tbody = id('supBd');
    if (!list.length) {
      tbody.innerHTML = '';
      id('supPg').classList.add('hidden');
      id('supEmp').classList.remove('hidden');
      return;
    }
    id('supEmp').classList.add('hidden');
    const p = pg('sup', list);
    id('supPg').classList.remove('hidden');
    id('supPg').innerHTML = pgCtrl('sup', list.length);
    tbody.innerHTML = p.items.map((x, i) => `<tr>
      <td>${p.start + i}</td>
      <td><strong>${x.name}</strong></td>
      <td>${x.contactPerson || '—'}</td>
      <td>${x.phone || '—'}</td>
      <td>${x.email || '—'}</td>
      <td>${x.products || '—'}</td>
      <td>${x.address || '—'}</td>
      <td>${x.notes || '—'}</td>
      <td><div class="ac">
        <button class="ico-btn" onclick="editSupItem('${x.id}')" title="Edit">✏️</button>
        <button class="ico-btn del" onclick="delSupItem('${x.id}')" title="Delete">🗑</button>
      </div></td>
    </tr>`).join('');
  }
  pgFns.sup = renderSup;

  function openSupModal(item) {
    clearErr('mS');
    id('mSupT').textContent = item ? 'Edit Supplier' : 'Add Supplier';
    id('mSupId').value = item ? item.id : '';
    id('mSNm').value = item ? item.name : '';
    id('mSCon').value = item ? item.contactPerson || '' : '';
    id('mSPh').value = item ? item.phone || '' : '';
    id('mSEm').value = item ? item.email || '' : '';
    id('mSProd').value = item ? item.products || '' : '';
    id('mSAddr').value = item ? item.address || '' : '';
    id('mSNotes').value = item ? item.notes || '' : '';
    openModal('mSup');
  }

  function saveSup() {
    const idV = id('mSupId').value;
    const nm = id('mSNm').value.trim();
    const con = id('mSCon').value.trim();
    const ph = id('mSPh').value.trim();
    const em = id('mSEm').value.trim();
    const prod = id('mSProd').value.trim();
    const addr = id('mSAddr').value.trim();
    const notes = id('mSNotes').value.trim();
    if (!nm) { id('mSNmE').textContent = 'Supplier name required'; return; }
    if (idV) {
      const idx = suppliers.findIndex(x => x.id === idV);
      if (idx !== -1) {
        suppliers[idx] = { ...suppliers[idx], name: nm, contactPerson: con, phone: ph, email: em, products: prod, address: addr, notes, updatedAt: now() };
        addActivity('Updated supplier: ' + nm, 'supplier', 'Supplier details updated');
      }
    } else {
      suppliers.push({ id: uid(), name: nm, contactPerson: con, phone: ph, email: em, products: prod, address: addr, notes, createdAt: now(), updatedAt: now() });
      addActivity('Added supplier: ' + nm, 'supplier', 'New supplier created');
    }
    saveAll();
    closeModal('mSup');
    renderSup();
    toast(idV ? 'Supplier updated' : 'Supplier added', 'success');
  }

  function editSupItem(idV) {
    const item = suppliers.find(x => x.id === idV);
    if (item) openSupModal(item);
  }
  function delSupItem(idV) {
    const item = suppliers.find(x => x.id === idV);
    if (!item) return;
    confirmAction('Delete Supplier', 'Delete "' + item.name + '"?', () => {
      suppliers = suppliers.filter(x => x.id !== idV);
      saveAll();
      renderSup();
      addActivity('Deleted supplier: ' + item.name, 'supplier', 'Supplier removed');
      toast('Supplier deleted', 'warning');
    });
  }

  // ═══════════════════════════════════════════════════════
  //  SUPPLIER HISTORY
  // ═══════════════════════════════════════════════════════
  function renderSupHist() {
    const cont = id('supHistContent');
    if (!suppliers.length) {
      cont.innerHTML = '<div class="estate"><span>🏢</span><h4>No suppliers added yet</h4></div>';
      return;
    }
    let html = '';
    suppliers.forEach(sup => {
      const del = deliveries.filter(d => d.supplierId === sup.id);
      if (!del.length) {
        html += `<div class="rep-sec"><h3 class="rep-title">${sup.name}</h3><p class="dim" style="padding:12px 0">No deliveries recorded</p></div>`;
        return;
      }
      html += `<div class="rep-sec"><h3 class="rep-title">${sup.name} (${del.length} deliveries)</h3><table class="dt"><thead><tr><th>#</th><th>Delivery No</th><th>Food Item</th><th>Qty</th><th>Total Cost</th><th>Date</th></tr></thead><tbody>`;
      del.forEach((d, i) => {
        const food = foodItems.find(f => f.id === d.foodId);
        html += `<tr><td>${i + 1}</td><td>${d.deliveryNo || '—'}</td><td>${food?.name || 'Unknown'}</td><td>${d.qty}</td><td>${(d.totalCost || 0).toLocaleString()} RWF</td><td>${dfmt(d.date)}</td></tr>`;
      });
      html += `</tbody></table></div>`;
    });
    cont.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════
  //  USER ACTIVITY LOG
  // ═══════════════════════════════════════════════════════
  function renderLog() {
    const q = id('logSr').value.trim().toLowerCase();
    const cf = id('logCF').value;
    let list = [...activities];
    if (cf !== 'all') list = list.filter(x => x.category === cf);
    if (q) list = list.filter(x => x.action.toLowerCase().includes(q) || (x.userName || '').toLowerCase().includes(q) || (x.details || '').toLowerCase().includes(q));
    const tbody = id('logBd');
    if (!list.length) {
      tbody.innerHTML = '';
      id('logPg').classList.add('hidden');
      id('logEmp').classList.remove('hidden');
      return;
    }
    id('logEmp').classList.add('hidden');
    const p = pg('log', list);
    id('logPg').classList.remove('hidden');
    id('logPg').innerHTML = pgCtrl('log', list.length);
    tbody.innerHTML = p.items.map((x, i) => `<tr>
      <td>${p.start + i}</td>
      <td>${fmt(x.timestamp)}</td>
      <td>${x.userName}</td>
      <td>${x.action}</td>
      <td><span class="badge ${x.category === 'auth' ? 'b-blue' : x.category === 'consumable' ? 'b-green' : x.category === 'food' ? 'b-teal' : x.category === 'equipment' ? 'b-gold' : 'b-gray'}">${x.category}</span></td>
      <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x.details || '—'}</td>
    </tr>`).join('');
  }
  pgFns.log = renderLog;

  // ═══════════════════════════════════════════════════════
  //  INVENTORY LOGS
  // ═══════════════════════════════════════════════════════
  function renderInvLog() {
    const invActs = activities.filter(a => ['consumable', 'food', 'equipment'].includes(a.category));
    if (!invActs.length) {
      id('invLogCnt').innerHTML = '<div class="estate"><span>📦</span><h4>No inventory activity yet</h4></div>';
      return;
    }
    let html = `<div class="tc"><table class="dt"><thead><tr><th>#</th><th>Date/Time</th><th>User</th><th>Action</th><th>Category</th><th>Details</th></tr></thead><tbody>`;
    invActs.slice(0, 100).forEach((x, i) => {
      html += `<tr><td>${i + 1}</td><td>${fmt(x.timestamp)}</td><td>${x.userName}</td><td>${x.action}</td><td><span class="badge ${x.category === 'consumable' ? 'b-green' : x.category === 'food' ? 'b-teal' : 'b-gold'}">${x.category}</span></td><td style="max-width:260px">${x.details || '—'}</td></tr>`;
    });
    html += `</tbody></table></div>`;
    id('invLogCnt').innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════
  //  AUDIT TRAIL
  // ═══════════════════════════════════════════════════════
  function renderAudit() {
    const items = auditTrail.length ? auditTrail : activities;
    if (!items.length) {
      id('auditCnt').innerHTML = '<div class="estate"><span>🔎</span><h4>No audit records yet</h4></div>';
      return;
    }
    let html = `<div class="tc"><table class="dt"><thead><tr><th>#</th><th>Date/Time</th><th>User</th><th>Role</th><th>Action</th><th>Item Type</th><th>Details</th></tr></thead><tbody>`;
    items.forEach((x, i) => {
      const role = x.userRole || '—';
      const itemType = x.itemType || x.category || '—';
      html += `<tr><td>${i + 1}</td><td>${fmt(x.timestamp)}</td><td>${x.userName}</td><td><span class="badge b-gray">${role.replace(/_/g, ' ')}</span></td><td>${x.action}</td><td><span class="badge b-gray">${itemType.replace(/_/g, ' ')}</span></td><td style="max-width:260px">${x.details || '—'}</td></tr>`;
    });
    html += `</tbody></table></div>`;
    id('auditCnt').innerHTML = html;
  }

  function generateWelfareAlerts() {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const newNotifs = [];

    welfareRecords.forEach(r => {
      if (r.expectedReturn) {
        const ret = new Date(r.expectedReturn);
        ret.setHours(0, 0, 0, 0);
        if (ret < todayDate && r.status !== 'Present in Dormitory' && r.status !== 'Present at School') {
          newNotifs.push({ type: 'warning', title: 'Overdue Return', message: r.studentName + ' was expected to return on ' + dfmt(r.expectedReturn) });
        }
      }

      if (!r.expectedReturn && r.status !== 'Present in Dormitory' && r.status !== 'Present at School' && r.status !== 'Sick Bay' && r.status !== 'Sick in Dormitory') {
        newNotifs.push({ type: 'warning', title: 'Missing Return Date', message: r.studentName + ' (' + r.status + ') has no expected return date' });
      }

      if (r.status === 'Missing') {
        newNotifs.push({ type: 'danger', title: 'Student Missing', message: r.studentName + ' is reported as MISSING since ' + dfmt(r.date) });
      }
    });

    // Food stock alerts
    const feed = getFeedingStats();
    const plans = ls('breakfastPlans') || [];
    const lastPlan = plans.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (lastPlan && lastPlan.date === today()) {
      const breadNeeded = feed.totalBread;
      if (lastPlan.breadsReceived < breadNeeded && breadNeeded > 0) {
        newNotifs.push({ type: 'danger', title: 'Insufficient Bread', message: 'Bread needed: ' + breadNeeded + ', Received: ' + (lastPlan.breadsReceived || 0) });
      }
    }

    // Apply all new notifications at once
    newNotifs.forEach(n => addNotification(n.type, n.title, n.message));
    if (newNotifs.length) saveAll();
  }

  // ═══════════════════════════════════════════════════════
  //  ALERTS / NOTIFICATIONS
  // ═══════════════════════════════════════════════════════
  function renderAlerts() {
    generateWelfareAlerts();
    const cont = id('alertsCnt');
    if (!notifications.length) {
      cont.innerHTML = '<div class="estate"><span>🔔</span><h4>No notifications</h4></div>';
      return;
    }
    const unread = notifications.filter(n => !n.read);
    const read = notifications.filter(n => n.read);
    let html = '';
    if (unread.length) {
      html += `<div class="algrp"><div class="algrp-title">Unread (${unread.length})</div>`;
      html += unread.map(n => `<div class="al-card unread ${n.type}"><div class="al-ico">${n.type === 'danger' ? '🔴' : n.type === 'warning' ? '🟡' : '🔵'}</div><div class="al-txt"><strong>${n.title}</strong><span>${n.message} · ${fmt(n.timestamp)}</span></div></div>`).join('');
      html += `</div>`;
    }
    if (read.length) {
      html += `<div class="algrp"><div class="algrp-title">Read (${read.length})</div>`;
      html += read.slice(0, 50).map(n => `<div class="al-card ${n.type}"><div class="al-ico">${n.type === 'danger' ? '🔴' : n.type === 'warning' ? '🟡' : '🔵'}</div><div class="al-txt"><strong>${n.title}</strong><span>${n.message} · ${fmt(n.timestamp)}</span></div></div>`).join('');
      html += `</div>`;
    }
    cont.innerHTML = html;
  }

  function markAllRead() {
    notifications.forEach(n => n.read = true);
    saveAll();
    renderAlerts();
    updateBadges();
    toast('All marked as read', 'info');
  }

  // ═══════════════════════════════════════════════════════
  //  SETTINGS
  // ═══════════════════════════════════════════════════════
  function renderSettings() {
    updateUserUI();
    const card = id('userMgmtCard');
    if (!card) return;
    if (session?.userRole !== 'admin') {
      card.style.display = 'none';
      return;
    }
    card.style.display = '';
    const cont = id('userMgmtContent');
    const list = users.filter(u => u.id !== session.userId);
    if (!list.length) {
      cont.innerHTML = '<div class="estate"><span>👥</span><h4>No other users</h4></div>';
      return;
    }
    cont.innerHTML = `<table class="dt" style="font-size:13px"><thead><tr><th>#</th><th>Name</th><th>Username</th><th>Role</th><th>Actions</th></tr></thead><tbody>
      ${list.map((u, i) => `<tr>
        <td>${i+1}</td>
        <td><strong>${u.name}</strong></td>
        <td>${u.username}</td>
        <td><span class="badge ${u.role === 'admin' ? 'b-green' : 'b-gold'}">${u.role.replace(/_/g, ' ')}</span></td>
        <td><div class="ac">
          <select class="sel-sm" onchange="updateUserRole('${u.id}', this.value)" style="margin-right:6px">
            ${['admin','storekeeper','refectory_manager','head_teacher','welfare_prefect','bursar'].map(r =>
              `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r.replace(/_/g, ' ')}</option>`
            ).join('')}
          </select>
          <button class="ico-btn del" onclick="deleteUser('${u.id}')" title="Delete user">🗑</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table>`;
  }

  function updateUserRole(userId, newRole) {
    const user = users.find(u => u.id === userId);
    if (!user || session?.userRole !== 'admin') return;
    const oldRole = user.role;
    user.role = newRole;
    saveAll();
    addActivity('Changed user role: ' + user.name + ' from ' + oldRole + ' to ' + newRole, 'auth', 'Role updated');
    renderSettings();
    toast(user.name + ' role changed to ' + newRole.replace(/_/g, ' '), 'success');
  }

  function deleteUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user || session?.userRole !== 'admin') return;
    confirmAction('Delete User', 'Delete user ' + user.name + ' (' + user.username + ')?', () => {
      users = users.filter(u => u.id !== userId);
      saveAll();
      addActivity('Deleted user: ' + user.name, 'auth', 'User removed');
      renderSettings();
      toast('User deleted', 'warning');
    });
  }

  async function changePwd() {
    const currentPwd = id('currentPwd').value;
    const newPwd = id('newPwd').value;
    if (!currentPwd) { toast('Enter your current password', 'error'); return; }
    if (!newPwd) { toast('Enter a new password', 'error'); return; }
    const pwErr = validatePassword(newPwd);
    if (pwErr) { toast(pwErr, 'error'); return; }
    const user = users.find(u => u.id === session?.userId);
    if (!user) { toast('User not found', 'error'); return; }

    const hashedCurrent = await hashPassword(currentPwd);
    if (user.password !== hashedCurrent) {
      toast('Current password is incorrect', 'error');
      addAudit('Failed password change', 'auth', null, 'Wrong current password');
      return;
    }

    user.password = await hashPassword(newPwd);
    saveAll();
    id('currentPwd').value = '';
    id('newPwd').value = '';
    addActivity('Password changed', 'auth', 'Password updated');
    toast('Password updated', 'success');
  }

  function exportData() {
    fetch(SERVER_URL + '/api/backup').then(r => {
      if (!r.ok) throw new Error();
      return r.blob();
    }).then(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'mmms_backup_' + today() + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      addActivity('Exported system data (server)', 'auth', 'JSON backup created');
      toast('Data exported from server', 'success');
    }).catch(() => {
      const data = {
        exportedAt: now(),
        users: users.map(u => ({ ...u, password: undefined })),
        consumables, borrows, foodItems, deliveries, issues,
        consumption, equipment, damages, suppliers, activities,
        notifications, breakfastSettings, breakfastPlans,
        agasekeRecords, agasekeProducts, auditTrail, welfareRecords
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'mmms_backup_' + today() + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      addActivity('Exported system data', 'auth', 'JSON backup created');
      toast('Data exported', 'success');
    });
  }

  function confirmReset() {
    confirmAction('⚠️ Reset ALL Data', 'This will permanently delete ALL data in the system. Are you absolutely sure?', () => {
      consumables = []; borrows = []; foodItems = []; deliveries = [];
      issues = []; consumption = []; equipment = []; damages = [];
      suppliers = []; activities = []; notifications = [];
      breakfastSettings = null; breakfastPlans = [];
      agasekeRecords = []; agasekeProducts = { fermented_milk: { name: 'Fermented Milk', defaultQty: 1, unit: 'Litre' }, eggs: { name: 'Eggs', defaultQty: 1, unit: 'Piece' }, yellow_bananas: { name: 'Yellow Bananas', defaultQty: 2, unit: 'Piece' } };
      auditTrail.unshift({ id: uid(), timestamp: now(), userId: session?.userId || 'system', userName: session?.userName || 'System', userRole: session?.userRole || 'system', action: 'Reset all system data', itemType: 'system', itemId: null, details: 'Complete data reset by ' + (session?.userName || 'Unknown') });
      saveAll();
      go('dashboard');
      toast('All data has been reset', 'warning');
    });
  }

  // ═══════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════
  async function init() {
    // Load persistent data from server first
    await loadFromServer();

    // Create default admin if no users
    if (!users.length) {
      users.push({
        id: uid(),
        name: 'Admin',
        username: 'admin',
        role: 'admin',
        password: await hashPassword('Admin@123'),
        createdAt: now()
      });
      saveAll();
    }

    // Validate existing session (expiry check)
    if (session) {
      const elapsed = Date.now() - (session.loginTime || 0);
      if (elapsed > SESSION_TIMEOUT_MS) {
        session = null;
        ls('session', null);
      }
    }

    // Seed default inventory data on first run
    if (!consumables.length && !foodItems.length && !equipment.length && !suppliers.length) {
      const sup1 = uid(), sup2 = uid(), sup3 = uid();
      suppliers.push(
        { id: sup1, name: 'Rwanda Food Distributors Ltd', contactPerson: 'Jean Pierre', phone: '0788123456', email: 'info@rwfood.rw', products: 'Cereals, Legumes, Cooking Oil', address: 'Kigali, Rwanda', notes: '', createdAt: now(), updatedAt: now() },
        { id: sup2, name: 'Kigali Kitchen Supplies', contactPerson: 'Alice Mukamana', phone: '0788234567', email: 'orders@kigaliKitchen.rw', products: 'Utensils, Equipment, Cleaning', address: 'Kigali, Rwanda', notes: '', createdAt: now(), updatedAt: now() },
        { id: sup3, name: 'Huye Farmers Cooperative', contactPerson: 'Patrick Habimana', phone: '0788345678', email: 'sales@huyefarm.rw', products: 'Vegetables, Fruits, Dairy', address: 'Huye, Rwanda', notes: '', createdAt: now(), updatedAt: now() }
      );
      equipment.push(
        { id: uid(), name: 'Dinner Plates', category: 'Plates', qty: 200, min: 50, condition: 'Good', status: 'Available', unitCost: 2500, location: 'Main Rack A1', purchaseDate: '2025-09-01', lifespan: 5, notes: 'White ceramic', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Side Plates', category: 'Plates', qty: 150, min: 40, condition: 'Good', status: 'Available', unitCost: 1800, location: 'Main Rack A2', purchaseDate: '2025-09-01', lifespan: 5, notes: 'White ceramic', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Soup Bowls', category: 'Bowls', qty: 120, min: 30, condition: 'Good', status: 'Available', unitCost: 2000, location: 'Main Rack A3', purchaseDate: '2025-09-01', lifespan: 4, notes: '', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Tea Cups', category: 'Cups', qty: 180, min: 40, condition: 'Good', status: 'Available', unitCost: 1500, location: 'Cupboard B1', purchaseDate: '2025-09-01', lifespan: 4, notes: 'White with handle', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Coffee Mugs', category: 'Cups', qty: 80, min: 20, condition: 'Excellent', status: 'Available', unitCost: 3000, location: 'Cupboard B2', purchaseDate: '2025-11-15', lifespan: 5, notes: 'Enamel coated', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Water Glasses', category: 'Cups', qty: 200, min: 50, condition: 'Good', status: 'Available', unitCost: 1200, location: 'Cupboard B3', purchaseDate: '2025-09-01', lifespan: 3, notes: 'Clear glass', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Dinner Forks', category: 'Cutlery', qty: 250, min: 60, condition: 'Good', status: 'Available', unitCost: 800, location: 'Drawer C1', purchaseDate: '2025-09-01', lifespan: 6, notes: 'Stainless steel', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Dinner Spoons', category: 'Cutlery', qty: 250, min: 60, condition: 'Good', status: 'Available', unitCost: 800, location: 'Drawer C1', purchaseDate: '2025-09-01', lifespan: 6, notes: 'Stainless steel', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Dinner Knives', category: 'Cutlery', qty: 200, min: 50, condition: 'Good', status: 'Available', unitCost: 1000, location: 'Drawer C2', purchaseDate: '2025-09-01', lifespan: 6, notes: 'Stainless steel', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Dessert Spoons', category: 'Cutlery', qty: 120, min: 30, condition: 'Good', status: 'Available', unitCost: 700, location: 'Drawer C2', purchaseDate: '2025-09-01', lifespan: 6, notes: '', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Serving Trays', category: 'Trays', qty: 40, min: 10, condition: 'Good', status: 'Available', unitCost: 5000, location: 'Shelf D1', purchaseDate: '2025-09-01', lifespan: 5, notes: 'Plastic, rectangular', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Cafeteria Trays', category: 'Trays', qty: 100, min: 25, condition: 'Good', status: 'Available', unitCost: 3500, location: 'Shelf D2', purchaseDate: '2025-09-01', lifespan: 4, notes: 'Compartment trays', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Serving Ladles', category: 'Serving Items', qty: 15, min: 5, condition: 'Good', status: 'Available', unitCost: 4000, location: 'Drawer E1', purchaseDate: '2025-09-01', lifespan: 5, notes: 'Stainless steel', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Serving Tongs', category: 'Serving Items', qty: 20, min: 5, condition: 'Good', status: 'Available', unitCost: 2500, location: 'Drawer E1', purchaseDate: '2025-09-01', lifespan: 4, notes: '', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Plastic Water Jugs', category: 'Jugs', qty: 30, min: 8, condition: 'Good', status: 'Available', unitCost: 3000, location: 'Shelf F1', purchaseDate: '2025-09-01', lifespan: 3, notes: '5-litre capacity', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Stock Pot (50L)', category: 'Cooking Pots', qty: 4, min: 2, condition: 'Good', status: 'Available', unitCost: 45000, location: 'Kitchen Rack G1', purchaseDate: '2025-08-15', lifespan: 8, notes: 'Aluminum, heavy-duty', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Saucepan (10L)', category: 'Cooking Pots', qty: 6, min: 3, condition: 'Excellent', status: 'Available', unitCost: 18000, location: 'Kitchen Rack G2', purchaseDate: '2025-11-01', lifespan: 7, notes: 'Stainless steel', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Frying Pan', category: 'Cooking Pots', qty: 8, min: 3, condition: 'Good', status: 'Available', unitCost: 12000, location: 'Kitchen Rack G2', purchaseDate: '2025-09-01', lifespan: 4, notes: 'Non-stick', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Mixing Bowls', category: 'Bowls', qty: 12, min: 4, condition: 'Good', status: 'Available', unitCost: 6000, location: 'Shelf H1', purchaseDate: '2025-09-01', lifespan: 5, notes: 'Stainless steel, assorted sizes', createdAt: now(), updatedAt: now() }
      );
      foodItems.push(
        { id: uid(), name: 'Maize Flour', category: 'Cereals', qty: 500, unit: 'Kg', min: 100, max: 1000, unitCost: 1200, supplier: sup1, purchaseDate: '2026-05-15', receivedDate: '2026-05-16', expiryDate: '2026-11-16', location: 'Dry Store A', notes: '', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Rice', category: 'Cereals', qty: 300, unit: 'Kg', min: 80, max: 600, unitCost: 1800, supplier: sup1, purchaseDate: '2026-05-20', receivedDate: '2026-05-21', expiryDate: '2026-11-21', location: 'Dry Store A', notes: '', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Beans', category: 'Legumes', qty: 200, unit: 'Kg', min: 50, max: 500, unitCost: 1400, supplier: sup1, purchaseDate: '2026-05-10', receivedDate: '2026-05-11', expiryDate: '2026-11-11', location: 'Dry Store B', notes: 'Red beans', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Peas', category: 'Legumes', qty: 80, unit: 'Kg', min: 30, max: 200, unitCost: 1600, supplier: sup1, purchaseDate: '2026-05-10', receivedDate: '2026-05-11', expiryDate: '2026-11-11', location: 'Dry Store B', notes: '', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Cooking Oil', category: 'Cooking', qty: 100, unit: 'Litre', min: 30, max: 200, unitCost: 4500, supplier: sup1, purchaseDate: '2026-05-25', receivedDate: '2026-05-26', expiryDate: '2027-05-26', location: 'Oil Rack', notes: 'Vegetable oil', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Sugar', category: 'Cooking', qty: 150, unit: 'Kg', min: 40, max: 300, unitCost: 2200, supplier: sup1, purchaseDate: '2026-05-18', receivedDate: '2026-05-19', expiryDate: '2026-11-19', location: 'Dry Store A', notes: 'White sugar', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Salt', category: 'Cooking', qty: 50, unit: 'Kg', min: 15, max: 100, unitCost: 500, supplier: sup1, purchaseDate: '2026-05-10', receivedDate: '2026-05-11', expiryDate: '2027-05-11', location: 'Dry Store A', notes: '', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Tomatoes', category: 'Vegetables', qty: 60, unit: 'Kg', min: 10, max: 100, unitCost: 800, supplier: sup3, purchaseDate: '2026-06-01', receivedDate: '2026-06-01', expiryDate: '2026-06-08', location: 'Cold Room', notes: 'Fresh', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Onions', category: 'Vegetables', qty: 80, unit: 'Kg', min: 20, max: 150, unitCost: 600, supplier: sup3, purchaseDate: '2026-05-28', receivedDate: '2026-05-28', expiryDate: '2026-07-28', location: 'Dry Store B', notes: '', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Irish Potatoes', category: 'Vegetables', qty: 200, unit: 'Kg', min: 50, max: 400, unitCost: 700, supplier: sup3, purchaseDate: '2026-05-30', receivedDate: '2026-05-30', expiryDate: '2026-07-15', location: 'Dry Store B', notes: '', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Fresh Milk', category: 'Dairy', qty: 80, unit: 'Litre', min: 20, max: 150, unitCost: 1500, supplier: sup3, purchaseDate: '2026-06-02', receivedDate: '2026-06-02', expiryDate: '2026-06-05', location: 'Cold Room', notes: 'Pasteurized', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Soya Beans', category: 'Legumes', qty: 60, unit: 'Kg', min: 20, max: 150, unitCost: 1300, supplier: sup1, purchaseDate: '2026-05-15', receivedDate: '2026-05-16', expiryDate: '2026-11-16', location: 'Dry Store B', notes: '', createdAt: now(), updatedAt: now() }
      );
      consumables.push(
        { id: uid(), name: 'Laundry Soap', category: 'Cleaning', code: 'CLN-001', qty: 80, min: 20, unit: 'Bar', location: 'Store Room', description: 'Local soap bars for laundry', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Dish Soap', category: 'Cleaning', code: 'CLN-002', qty: 40, min: 10, unit: 'Litre', location: 'Kitchen Store', description: 'Liquid dishwashing soap', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Bleach', category: 'Cleaning', code: 'CLN-003', qty: 25, min: 8, unit: 'Litre', location: 'Store Room', description: 'Javel for sanitation', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Brooms', category: 'Cleaning', code: 'CLN-004', qty: 30, min: 10, unit: 'Piece', location: 'Store Room', description: 'Local brooms (ubunyaburo)', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Mops', category: 'Cleaning', code: 'CLN-005', qty: 15, min: 5, unit: 'Piece', location: 'Store Room', description: 'Floor mops with handles', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Buckets (20L)', category: 'Cleaning', code: 'CLN-006', qty: 20, min: 6, unit: 'Piece', location: 'Store Room', description: 'Plastic buckets for cleaning', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Toilet Paper', category: 'Cleaning', code: 'CLN-007', qty: 200, min: 50, unit: 'Roll', location: 'Store Room', description: 'Standard rolls', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Hand Sanitizer', category: 'Cleaning', code: 'CLN-008', qty: 20, min: 5, unit: 'Litre', location: 'Store Room', description: 'Refill bulk', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Charcoal', category: 'General', code: 'GEN-001', qty: 50, min: 15, unit: 'Bag', location: 'Kitchen Store', description: 'Cooking charcoal (makala)', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Exercise Books', category: 'Stationery', code: 'STN-001', qty: 500, min: 100, unit: 'Piece', location: 'Office Store', description: '72-page school notebooks (cahiers)', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Ballpoint Pens (Blue)', category: 'Stationery', code: 'STN-002', qty: 300, min: 50, unit: 'Box', location: 'Office Store', description: 'Bic biro blue ink', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Chalk (White)', category: 'Stationery', code: 'STN-003', qty: 200, min: 40, unit: 'Box', location: 'Office Store', description: 'Blackboard chalk (craie)', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Chalk (Coloured)', category: 'Stationery', code: 'STN-004', qty: 60, min: 15, unit: 'Box', location: 'Office Store', description: 'Assorted colours', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Whiteboard Markers', category: 'Stationery', code: 'STN-005', qty: 40, min: 10, unit: 'Pack', location: 'Office Store', description: 'Blue, black, red assorted', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Stapler Pins', category: 'Office Supplies', code: 'OFC-001', qty: 50, min: 10, unit: 'Box', location: 'Office Store', description: 'No. 10 standard', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Masking Tape', category: 'Office Supplies', code: 'OFC-002', qty: 30, min: 8, unit: 'Roll', location: 'Office Store', description: '', createdAt: now(), updatedAt: now() },
        { id: uid(), name: 'Register Books', category: 'Office Supplies', code: 'OFC-003', qty: 20, min: 5, unit: 'Piece', location: 'Office Store', description: 'Class attendance registers', createdAt: now(), updatedAt: now() }
      );
      saveAll();
    }

    // Apply theme
    applyTheme(theme);

    // Check session
    if (session) {
      showApp();
    }

    // Setup user dropdown
    setupUserDropdown();

    // Populate dynamic selects on page render as needed
    updateBadges();
  }

  // ─── WELFARE REPORTS ──────────────────────────────
  function showWelfareReport() {
    const cont = id('wRepContent');
    cont.innerHTML = renderWelfareReport();
    cont.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderWelfareReport() {
    const feed = getFeedingStats();
    const active = getActiveWelfareRecords();
    const statusCounts = {};
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    active.forEach(r => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });

    const statusKeys = Object.keys(WELFARE_FEEDING_MAP);
    let html = `<div class="rep-sec">
      <h3 class="rep-title">📋 Daily Student Welfare Report</h3>
      <p class="dim" style="margin-bottom:16px">${today}</p>
      <div class="rep-sum">
        <div class="rep-stat"><strong>${feed.totalBoarding}</strong><span>Total Boarding</span></div>
        <div class="rep-stat"><strong>${feed.present}</strong><span>Present</span></div>
        <div class="rep-stat"><strong>${feed.sick}</strong><span>Sick</span></div>
        <div class="rep-stat"><strong>${feed.hospitalized}</strong><span>Hospitalized</span></div>
        <div class="rep-stat"><strong>${feed.sentHome}</strong><span>Sent Home</span></div>
        <div class="rep-stat"><strong>${feed.onLeave}</strong><span>On Leave</span></div>
        <div class="rep-stat"><strong>${feed.missing}</strong><span>Missing</span></div>
      </div>
    </div>`;

    html += `<div class="rep-sec"><h3 class="rep-title">📊 Status Breakdown</h3><table class="dt"><thead><tr><th>Status</th><th>Count</th><th>Feeding</th></tr></thead><tbody>`;
    statusKeys.forEach(sk => {
      const cnt = statusCounts[sk] || 0;
      if (cnt === 0) return;
      html += `<tr><td>${sk}</td><td>${cnt}</td><td>${getFeedingLabel(sk)}</td></tr>`;
    });
    html += `</tbody></table></div>`;

    html += `<div class="rep-sec"><h3 class="rep-title">🍽 Feeding Allocation Summary</h3>
      <div class="rep-sum">
        <div class="rep-stat"><strong>${feed.dormitoryBread}</strong><span>Dormitory Bread</span></div>
        <div class="rep-stat"><strong>${feed.refectoryBread}</strong><span>Refectory Bread</span></div>
        <div class="rep-stat"><strong>${feed.totalBread}</strong><span>Total Bread</span></div>
        <div class="rep-stat"><strong>${feed.agasekeEligible}</strong><span>Agaseke Eligible</span></div>
        <div class="rep-stat"><strong>${feed.noFood}</strong><span>No Food Allocation</span></div>
      </div>
    </div>`;

    // Checklist of overdue students
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const overdue = active.filter(r => r.expectedReturn && new Date(r.expectedReturn) < todayDate);
    if (overdue.length) {
      html += `<div class="rep-sec"><h3 class="rep-title" style="color:var(--red)">⚠ Overdue Returns</h3>
        <table class="dt"><thead><tr><th>Student</th><th>Expected</th><th>Days Overdue</th><th>Status</th></tr></thead><tbody>`;
      overdue.forEach(r => {
        const days = Math.floor((todayDate - new Date(r.expectedReturn)) / (1000 * 60 * 60 * 24));
        html += `<tr><td>${r.studentName}</td><td>${dfmt(r.expectedReturn)}</td><td>${days}d</td><td>${r.status}</td></tr>`;
      });
      html += `</tbody></table></div>`;
    }

    html += `<div class="fact"><button class="btn btn-ghost" onclick="doPrint()">🖨 Print Report</button></div>`;
    return html;
  }

  // ─── EXPOSE GLOBALLY (for inline onclick) ──────────
  window.switchTab = switchTab;
  window.doLogin = doLogin;
  window.doRegister = doRegister;
  window.doLogout = doLogout;
  window.eyeT = eyeT;
  window.go = go;
  window.toggleSB = toggleSB;
  window.closeSB = closeSB;
  window.toggleTheme = toggleTheme;
  window.applyThemeSw = applyThemeSw;
  window.gSearch = gSearch;
  window.doPrint = doPrint;
  window.rf = rf;
  window.closeModal = closeModal;
  window.closeActiveModal = closeActiveModal;
  window.closeConfirm = closeConfirm;
  window.openCModal = () => openCModal(null);
  window.saveCons = saveCons;
  window.editCItem = editCItem;
  window.delCItem = delCItem;
  window.setCF = setCF;
  window.doBorrow = doBorrow;
  window.doReturn = doReturn;
  window.openFModal = () => openFModal(null);
  window.saveFood = saveFood;
  window.editFItem = editFItem;
  window.delFItem = delFItem;
  window.setFF = setFF;
  window.openFRecModal = openFRecModal;
  window.saveFRec = saveFRec;
  window.delFRec = delFRec;
  window.openFIssModal = openFIssModal;
  window.saveFIss = saveFIss;
  window.delFIss = delFIss;
  window.openConModal = openConModal;
  window.saveCon = saveCon;
  window.openEqModal = () => openEqModal(null);
  window.saveEq = saveEq;
  window.editEqItem = editEqItem;
  window.delEqItem = delEqItem;
  window.openDamModal = openDamModal;
  window.saveDam = saveDam;
  window.openSupModal = () => openSupModal(null);
  window.saveSup = saveSup;
  window.editSupItem = editSupItem;
  window.delSupItem = delSupItem;
  window.markAllRead = markAllRead;
  window.changePwd = changePwd;
  window.switchBTab = switchBTab;
  window.saveBSettings = saveBSettings;
  window.saveBPlan = saveBPlan;
  window.delBPlan = delBPlan;
  window.calcBReq = calcBReq;
  window.switchATab = switchATab;
  window.saveAPlan = saveAPlan;
  window.delARecord = delARecord;
  window.saveAProducts = saveAProducts;
  window.renderAGeneratedReport = renderAGeneratedReport;
  window.calcAReq = calcAReq;
  window.updateUserRole = updateUserRole;
  window.deleteUser = deleteUser;
  window.exportData = exportData;
  window.openWModal = openWModal;
  window.saveWelfare = saveWelfare;
  window.deleteWelfare = deleteWelfare;
  window.setWF = setWF;
  window.renderWelfare = renderWelfare;
  window.renderCInv = renderCInv;
  window.renderCMove = renderCMove;
  window.renderFInv = renderFInv;
  window.renderCon = renderCon;
  window.renderEq = renderEq;
  window.renderDam = renderDam;
  window.renderFMove = renderFMove;
  window.renderLog = renderLog;
  window.confirmReset = confirmReset;
  window.showWelfareReport = showWelfareReport;

  // ─── DEBOUNCED SEARCH WRAPPERS ────────────────────
  const SEARCH_DEBOUNCE_MS = 200;
  window.debouncedCInv = debounce(renderCInv, SEARCH_DEBOUNCE_MS);
  window.debouncedCMove = debounce(renderCMove, SEARCH_DEBOUNCE_MS);
  window.debouncedFInv = debounce(renderFInv, SEARCH_DEBOUNCE_MS);
  window.debouncedFRec = debounce(renderFRec, SEARCH_DEBOUNCE_MS);
  window.debouncedFIss = debounce(renderFIss, SEARCH_DEBOUNCE_MS);
  window.debouncedCon = debounce(renderCon, SEARCH_DEBOUNCE_MS);
  window.debouncedEq = debounce(renderEq, SEARCH_DEBOUNCE_MS);
  window.debouncedDam = debounce(renderDam, SEARCH_DEBOUNCE_MS);
  window.debouncedFMove = debounce(renderFMove, SEARCH_DEBOUNCE_MS);
  window.debouncedSup = debounce(renderSup, SEARCH_DEBOUNCE_MS);
  window.debouncedLog = debounce(renderLog, SEARCH_DEBOUNCE_MS);
  window.debouncedWelfare = debounce(renderWelfare, SEARCH_DEBOUNCE_MS);

  // ─── START ─────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => { init().catch(console.error); });
})();
