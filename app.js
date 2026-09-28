/* ============================================================
   AGMX — SaaS Cooperative Governance Operating System
   Single-page app with multi-role views, AI copilot, live AGM.
   ============================================================ */

(function () {
  "use strict";

  const D = window.MC_DATA || {
    cooperative: { id: "KPM-0000", name: "Koperasi", plan: "Enterprise", members: 0, quorumPct: 25, quorumRequired: 0, uukRef: "UUK/v1" },
    currentUser: { id: "U-0000", name: "Pengguna", role: "Pentadbir", avatar: "PG", phone: "", email: "", language: "BM" },
    members: [], agm: { id: "AGM-0000", title: "AGM", edition: "", date: "", time: "", venue: "", mode: "", status: "", startedAt: "", elapsed: "00:00", quorumPct: 0, quorumRequired: 0, quorumPresent: 0, totalMembers: 0, lateNoticeDays: 21, noticesSent: 0, noticesRead: 0, noticesOpened: 0 },
    agenda: [], candidates: [], motions: [{ id: "M-000", title: "Menunggu data", status: "Draf", type: "Biasa", proposer: "-", seconder: "-", proposedAt: "-", votes: { ya: 0, tidak: 0, abstain: 0 }, discussion: [] }], questions: [], actions: [], auditLog: [], health: { activeSessions: 0, wsLatency: 0, bandwidth: 0 }, compliance: { score: 0, aktaChips: [] },
    financialSummary: { revenue: "RM 0", netProfit: "RM 0", dividend: "0%", totalAssets: "RM 0", totalLiabilities: "RM 0", yoyProfit: "0%" },
    languages: ["Bahasa Melayu", "English"],
  };
  const $ = (sel, root = document) => root?.querySelector(sel) || null;
  const $$ = (sel, root = document) => root ? Array.from(root.querySelectorAll(sel)) : [];

  /* ---------- App State ---------- */
  const state = {
    view: "login",
    role: "secretary",
    seniorMode: false,
    theme: "default",
    lang: "BM",
    drawerOpen: false,
    sidebarOpen: false,
    chat: [],
    selectedCandidates: new Set(),
    wizardStep: 1,
    notifOpen: false,
    profileOpen: false,
    searchOpen: false,
    liveVotes: { ya: 248, tidak: 47, abstain: 18, total: 403 },
    selectedLayout: "voting",
    agendaFilter: "all",
    complianceFilter: "all",
    vaultLogLimit: 5,
    memberSearch: "",
    memberSort: { key: null, dir: "asc" },
    membersPage: 1,
    membersPerPage: 10,
    motionsPage: 1,
    motionsPerPage: 10,
    candidatesPage: 1,
    candidatesPerPage: 10,
    questionsPage: 1,
    questionsPerPage: 10,
    activeMotion: "M-001",
    copilotAgent: "chairman",
    aiDrawerOpen: false,
    _intervals: [],
    _listeners: [],
  };

  function safeInterval(fn, ms) {
    const id = setInterval(fn, ms);
    state._intervals.push(id);
    return id;
  }

  function clearAllIntervals() {
    state._intervals.forEach(clearInterval);
    state._intervals = [];
  }

  function safeAdd(el, event, fn) {
    if (!el) return;
    el.addEventListener(event, fn);
    state._listeners.push({ el, event, fn });
  }

  function safeOn(els, event, fn) {
    if (!els) return;
    els.forEach(el => { if (el) { el.addEventListener(event, fn); state._listeners.push({ el, event, fn }); } });
  }

  function safeEl(id) { return document.getElementById(id); }

  function safeRender(fn) {
    try { fn(); } catch (e) {
      console.error("[AGMX] Render error:", e);
      const m = document.getElementById("main");
      if (m) m.innerHTML = `<div class="fade-in" style="padding:40px;text-align:center"><div style="font-size:48px;margin-bottom:12px">⚠️</div><h2 style="font-size:20px;font-weight: 700;margin-bottom:8px">Ralat Tidak Dijangka</h2><p style="color:var(--c-text-2)">Maaf, berlaku ralat semasa memaparkan halaman ini. Sila cuba semula.</p><button class="btn btn-primary mt-3" onclick="location.reload()">Muat Semula</button></div>`;
    }
  }

  function showLoading() {
    const main = $("#main");
    if (!main) return;
    main.innerHTML = `
      <div class="loading-screen fade-in">
        <div class="skeleton skeleton-card"></div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
          <div class="skeleton skeleton-block"></div>
          <div class="skeleton skeleton-block"></div>
          <div class="skeleton skeleton-block"></div>
          <div class="skeleton skeleton-block"></div>
        </div>
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px">
          <div class="skeleton skeleton-block" style="height:300px"></div>
          <div style="display:flex;flex-direction:column;gap:12px">
            <div class="skeleton skeleton-block" style="height:140px"></div>
            <div class="skeleton skeleton-block" style="height:140px"></div>
          </div>
        </div>
      </div>`;
  }

  /* ============================================================
     ICONS (inline SVG)
     ============================================================ */
  const ICONS = {
    dashboard: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    users: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    calendar: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    vote: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    motions: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>',
    ai: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 1.5.4 2.9 1.1 4.1L4 22l5-2.5c.9.3 1.9.5 3 .5a8 8 0 1 0 0-16z"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg>',
    shield: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    vault: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><circle cx="12" cy="15" r="1.5" fill="currentColor"/></svg>',
    cog: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    bell: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    help: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    cog: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    chevDown: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>',
    mic: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    cam: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
    screen: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    phoneOff: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-3.6-2.94"/><line x1="23" y1="1" x2="1" y2="23"/></svg>',
    send: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    download: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    upload: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    qr: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="17" y2="14"/><line x1="20" y1="14" x2="20" y2="17"/><line x1="14" y1="20" x2="17" y2="20"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    alert: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    globe: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    moon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    sun: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    volume: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
    chat: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    sparkle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.5 5L18 9l-4.5 2L12 16l-1.5-5L6 9l4.5-2z"/></svg>',
    print: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    share: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
  };

  /* ============================================================
     LAYOUT (Sidebar / Header / Drawer)
     ============================================================ */
  /* Unified navigation model: 8 persistent top-level items, contextual sub-menus */
  const NAV_MODEL = [
    { route: "dashboard", icon: "dashboard", label: "Papan Pemuka" },
    {
      route: "agm-hall", icon: "calendar", label: "Dewan AGM", badge: '<span class="nav-badge live">LIVE</span>',
      children: [
        { route: "agm-hall", layout: "town-hall", label: "Town Hall" },
        { route: "agm-hall", layout: "conference", label: "Persidangan" },
        { route: "agm-hall", layout: "presentation", label: "Pembentangan" },
        { route: "agm-hall", layout: "discussion", label: "Perbahasan" },
        { route: "agm-hall", layout: "voting", label: "Undian" },
      ],
    },
    {
      route: "voting", icon: "vote", label: "E-Voting", badge: '<span class="nav-badge">2</span>',
      children: [
        { route: "voting", label: "Calon & Undian" },
        { route: "motions", label: "Usul & Resolusi" },
        { route: "scanner", label: "Pendaftaran QR" },
      ],
    },
    { route: "members", icon: "users", label: "Ahli & Organisasi", badge: `<span class="nav-badge">${D.members.length}</span>` },
    { route: "copilot", icon: "ai", label: "AI Copilot", badge: '<span class="nav-badge">4 ejen</span>' },
    { route: "compliance", icon: "shield", label: "Pematuhan" },
    { route: "vault", icon: "vault", label: "Digital Vault" },
    {
      route: "settings", icon: "cog", label: "Tetapan",
      children: [
        { route: "settings", label: "Umum & Aksesibiliti" },
        { route: "wizard", label: "AGM Wizard" },
        { route: "senior-member", label: "Mod Warga Emas" },
        { route: "roadmap", label: "Roadmap" },
      ],
    },
  ];

  function navGroupFor(view) {
    for (const item of NAV_MODEL) {
      if (item.route === view) return item.route;
      if (item.children && item.children.some(c => c.route === view)) return item.route;
    }
    return null;
  }

  function renderSidebarNav() {
    const activeGroup = navGroupFor(state.view);
    return NAV_MODEL.map(item => {
      const isGroupActive = activeGroup === item.route;
      const expanded = item.children && isGroupActive;
      const sub = item.children ? `
        <ul class="nav-sublist ${expanded ? 'open' : ''}">
          ${item.children.map(c => {
            const subActive = c.layout
              ? (state.view === c.route && state.selectedLayout === c.layout)
              : state.view === c.route;
            return `<li class="nav-subitem ${subActive ? 'active' : ''}" data-route="${c.route}" ${c.layout ? `data-layout="${c.layout}"` : ''} tabindex="0" role="link">${c.label}</li>`;
          }).join("")}
        </ul>` : "";
      return `
        <li class="nav-group">
          <div class="nav-item ${isGroupActive ? 'active' : ''}" data-route="${item.route}" data-tip="${item.label}" tabindex="0" role="link">
            ${ICONS[item.icon] || ''}<span>${item.label}</span>
            ${item.badge || ''}
            ${item.children ? `<span class="nav-chev ${expanded ? 'open' : ''}">${ICONS.chevDown}</span>` : ''}
          </div>
          ${sub}
        </li>`;
    }).join("");
  }

  function renderLayout() {
    const root = $("#app");
    root.innerHTML = `
      <aside class="sidebar" id="sidebar">
        <button class="sidebar-collapse" id="sidebar-collapse" title="Kuncup/Kembang menu" aria-label="Kuncup atau kembangkan menu sisi">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="sidebar-inner scrollbar">
        <div class="sidebar-brand">
          <div class="brand-mark">AG</div>
          <div class="brand-text">
            <div class="b1">AGMX</div>
            <div class="b2">Governance OS</div>
          </div>
          <button class="sidebar-close" id="sidebar-close" aria-label="Tutup menu">${ICONS.x}</button>
        </div>

        <div class="nav-section">
          <ul class="nav-list" id="nav-root">
            ${renderSidebarNav()}
          </ul>
        </div>

        <div class="sidebar-foot">
          <div class="plan-pill">${D.cooperative.plan}</div>
          <div>${D.cooperative.name}</div>
          <div style="margin-top:4px; opacity:0.7">ID: ${D.cooperative.id}</div>
        </div>
        </div>
      </aside>

      <header class="header">
        <div class="h-left">
          <button class="h-icon-btn hamburger" id="hamburger-btn" aria-label="Buka menu navigasi">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div>
            <div class="h-title" id="h-title">Papan Pemuka</div>
            <div class="h-subtitle" id="h-subtitle">${D.cooperative.name}</div>
          </div>
          <div class="h-divider"></div>
          <div class="h-live-pill"><span class="h-live-dot"></span> AGM LIVE · ${D.agm.elapsed}</div>
        </div>
        <div class="h-right">
          <button class="h-icon-btn" id="ai-toggle" title="AI Copilot">${ICONS.sparkle}</button>
          <button class="h-icon-btn" title="Pemberitahuan" id="notif-btn">${ICONS.bell}<span class="dot"></span></button>
          <button class="h-icon-btn" title="${state.theme === 'dark' ? 'Mod Cerah' : 'Mod Gelap'}" id="theme-toggle" aria-label="${state.theme === 'dark' ? 'Tukar ke mod cerah' : 'Tukar ke mod gelap'}">${state.theme === 'dark' ? ICONS.sun : ICONS.moon}</button>
          <a class="h-icon-btn lang-switch" href="app-en.html${location.hash}" title="Switch to English" aria-label="Switch to English">EN</a>
          <button class="h-icon-btn" title="Senior Mode" id="senior-toggle">${ICONS.help}</button>
          <div class="h-user" id="profile-btn">
            <div class="h-avatar">${D.currentUser.avatar}</div>
            <div>
              <div class="u-name">${D.currentUser.name}</div>
              <div class="u-role">${D.currentUser.role}</div>
            </div>
            ${ICONS.chevDown}
          </div>
        </div>
      </header>

      <main class="main scrollbar" id="main"></main>

      <footer class="statusbar" aria-label="Status sistem">
        <span class="sb-item"><span class="sb-dot ok"></span> Sistem Dalam Talian</span>
        <span class="sb-item">WS <span class="text-mono" id="sb-latency">${D.health.wsLatency}ms</span></span>
        <span class="sb-item">🔗 Hash chain disegerak <span class="text-mono">#7891</span></span>
        <span class="sb-item sb-right">TLS 1.3 · AES-256</span>
        <span class="sb-item">AGMX v2.1.0 · ${D.cooperative.plan}</span>
      </footer>

      <div class="copilot-drawer" id="copilot-drawer">
        <div class="copilot-drawer-head">
          <div style="width:42px;height:42px;border-radius:10px;background:rgba(255,255,255,0.2);display:grid;place-items:center;">
            ${ICONS.sparkle}
          </div>
          <div style="flex:1">
            <div class="dh-name">AGMX AI Copilot</div>
            <div class="dh-sub">4 ejen aktif · RAG + Audit Sentiasa</div>
          </div>
          <button class="h-icon-btn" id="drawer-close" style="color:#fff">${ICONS.x}</button>
        </div>
        <div class="copilot-drawer-body">
          <div class="ai-alert">
            <div class="ai-alert-head">⚡ AI Chairman Alert</div>
            <div class="ai-alert-text">M-001 telahpun mendapat 248 undi YA. Kuorum terjawab. Boleh tutup fasa undian dalam 2 minit.</div>
            <div class="ai-alert-actions">
              <button class="btn btn-sm btn-primary">Tutup Undian</button>
              <button class="btn btn-sm btn-ghost">Lanjutkan 2 min</button>
            </div>
          </div>
          <div class="ai-alert" style="background:#FEE2E2;border-left-color:#EF4444;">
            <div class="ai-alert-head" style="color:#B91C1C">⚠️ AI Compliance Alert</div>
            <div class="ai-alert-text">M-003 tidak memenuhi Klausa 7.3 UUK (tiada Penyokong dalam 15 minit). Auto-gugur dicadangkan.</div>
            <div class="ai-alert-actions">
              <button class="btn btn-sm btn-danger">Auto-Gugur</button>
              <button class="btn btn-sm btn-ghost">Maklum Pengerusi</button>
            </div>
          </div>
          <div style="font-size:12px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:0.5px;margin:16px 0 8px">Cadangan Pintar</div>
          <div class="ai-suggestion">
            <div class="as-head">📊 AI Question Organizer</div>
            <div class="as-text">12 soalan berulang tentang Dividen — satukan menjadi 1 untuk dijawab Bendahari sekaligus.</div>
          </div>
          <div class="ai-suggestion">
            <div class="as-head">📝 AI Minute Writer</div>
            <div class="as-text">Draf minit AGM Ke-16 sedang dijana. Dijangka siap dalam 4 minit (98% ketepatan).</div>
          </div>
          <div class="ai-suggestion">
            <div class="as-head">🎯 AI Auditor</div>
            <div class="as-text">2 resolusi AGM Ke-15 masih belum selesai. Papar status kepatuhan di AG-04?</div>
          </div>
        </div>
        <div class="copilot-drawer-foot">
          <button class="btn btn-primary btn-lg" style="width:100%">${ICONS.chat}<span>Buka Copilot Penuh</span></button>
        </div>
      </div>
    `;

    bindLayoutEvents();
    setActiveNav();
  }

  function bindLayoutEvents() {
    const navGo = (e) => {
      e.stopPropagation();
      const el = e.currentTarget;
      if (el.dataset.layout) state.selectedLayout = el.dataset.layout;
      state.view = el.dataset.route;
      state.sidebarOpen = false;
      document.body.classList.remove("sidebar-open");
      location.hash = "#/" + state.view;
      render();
    };
    safeOn($$(".nav-item, .nav-subitem"), "click", navGo);
    safeOn($$(".nav-item, .nav-subitem"), "keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navGo(e); }
    });
    safeAdd($("#hamburger-btn"), "click", () => {
      state.sidebarOpen = !state.sidebarOpen;
      document.body.classList.toggle("sidebar-open", state.sidebarOpen);
    });
    safeAdd($("#sidebar-collapse"), "click", () => {
      const collapsed = document.body.classList.toggle("nav-collapsed");
      try { localStorage.setItem("agmx-nav", collapsed ? "collapsed" : "expanded"); } catch (e) { /* private mode */ }
    });
    safeAdd($("#sidebar-close"), "click", () => {
      state.sidebarOpen = false;
      document.body.classList.remove("sidebar-open");
    });
    safeAdd($("#ai-toggle"), "click", () => toggleDrawer());
    safeAdd($("#drawer-close"), "click", () => toggleDrawer(false));
    safeAdd($("#theme-toggle"), "click", () => cycleTheme());
    safeAdd($("#senior-toggle"), "click", () => toggleSenior());
    safeAdd($("#notif-btn"), "click", (e) => { e.stopPropagation(); toggleNotif(); });
    safeAdd($("#profile-btn"), "click", (e) => { e.stopPropagation(); toggleProfile(); });
    safeAdd($("#search-btn"), "click", () => toggleSearch(true));
    document.addEventListener("click", closeAllDropdowns);
    document.addEventListener("keydown", handleGlobalKeys);

    // Live latency jitter in status bar
    safeInterval(() => {
      const el = safeEl("sb-latency");
      if (el) el.textContent = (D.health.wsLatency + Math.floor(Math.random() * 21) - 10) + "ms";
    }, 2500);
  }

  function handleGlobalKeys(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      toggleSearch(true);
    }
    if (e.key === "Escape") {
      if (state.searchOpen) toggleSearch(false);
      if (state.notifOpen) toggleNotif(false);
      if (state.profileOpen) toggleProfile(false);
    }
  }

  function closeAllDropdowns(e) {
    if (!e.target.closest("#notif-panel") && !e.target.closest("#notif-btn")) state.notifOpen = false;
    if (!e.target.closest("#profile-menu") && !e.target.closest("#profile-btn")) state.profileOpen = false;
    if (state.sidebarOpen && !e.target.closest("#sidebar") && !e.target.closest("#hamburger-btn")) {
      state.sidebarOpen = false;
      document.body.classList.remove("sidebar-open");
    }
    renderDropdowns();
  }

  function toggleNotif(force) {
    state.notifOpen = force !== undefined ? force : !state.notifOpen;
    if (state.notifOpen) state.profileOpen = false;
    renderDropdowns();
  }
  function toggleProfile(force) {
    state.profileOpen = force !== undefined ? force : !state.profileOpen;
    if (state.profileOpen) state.notifOpen = false;
    renderDropdowns();
  }
  function toggleSearch(force) {
    state.searchOpen = force !== undefined ? force : !state.searchOpen;
    renderDropdowns();
    if (state.searchOpen) setTimeout(() => $("#global-search-input")?.focus(), 100);
  }

  function setActiveNav() {
    const titleEl = document.getElementById("h-title");
    if (!titleEl) return;
    const activeGroup = navGroupFor(state.view);
    $$(".nav-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.route === activeGroup);
    });
    $$(".nav-subitem").forEach((el) => {
      const subActive = el.dataset.layout
        ? (state.view === el.dataset.route && state.selectedLayout === el.dataset.layout)
        : state.view === el.dataset.route;
      el.classList.toggle("active", subActive);
    });
    const titles = {
      dashboard: ["Papan Pemuka", "Ringkasan AGM & Kuorum"],
      members: ["Ahli & Organisasi", "Pengurusan keahlian & kelayakan undi"],
      "agm-hall": ["Dewan AGM", "Persidangan Hibrid · Mod Voting"],
      voting: ["E-Voting Pintar", "Galeri calon pilihan raya lembaga"],
      motions: ["Usul & Resolusi", "Enjin rantaian usul & minit mesyuarat"],
      copilot: ["AI Governance Copilot", "Multi-ejen RAG · Ejen pintar"],
      compliance: ["Pematuhan SKM", "Akta Koperasi 1993 · GP14 · UUK"],
      vault: ["Digital Governance Vault", "Lejar kalis ubah · Hash chain"],
      settings: ["Tetapan", "Aksesibiliti, bahasa & senior mode"],
      wizard: ["AGM Wizard", "Cipta mesyuarat agung · 5 langkah dipandu"],
      "senior-member": ["Mod Warga Emas", "Antaramuka One Click Join untuk ahli"],
      scanner: ["Pendaftaran Kehadiran", "QR Scanner · Live quorum sync"],
      roadmap: ["Product Roadmap", "Pelan 3-fasa → Cooperative SuperApp"],
    };
    const [t, s] = titles[state.view] || ["AGMX", ""];
    $("#h-title").textContent = t;
    $("#h-subtitle").textContent = s;
  }

  function toggleDrawer(force) {
    state.drawerOpen = force !== undefined ? force : !state.drawerOpen;
    $("#copilot-drawer").classList.toggle("open", state.drawerOpen);
  }

  function applyTheme(theme) {
    state.theme = theme;
    document.body.classList.remove("theme-hc", "theme-dark");
    if (theme === "hc") document.body.classList.add("theme-hc");
    if (theme === "dark") document.body.classList.add("theme-dark");
    try { localStorage.setItem("agmx-theme", theme); } catch (e) { /* private mode */ }
    // Swap the header toggle icon in place
    const btn = $("#theme-toggle");
    if (btn) {
      btn.innerHTML = theme === "dark" ? ICONS.sun : ICONS.moon;
      btn.title = theme === "dark" ? "Mod Cerah" : "Mod Gelap";
      btn.setAttribute("aria-label", theme === "dark" ? "Tukar ke mod cerah" : "Tukar ke mod gelap");
    }
  }

  function cycleTheme() {
    // Header button = simple dark/light toggle (HC stays available in Tetapan)
    const next = state.theme === "dark" ? "default" : "dark";
    applyTheme(next);
    showToast(next === "dark" ? "🌙 Mod Gelap diaktifkan" : "☀️ Mod Cerah diaktifkan");
  }

  function toggleSenior() {
    state.seniorMode = !state.seniorMode;
    document.body.classList.toggle("senior-mode", state.seniorMode);
    showToast(state.seniorMode ? "🧓 Senior Friendly Mode: AKTIF" : "Senior Mode dimatikan");
  }

  /* ============================================================
     LOGIN
     ============================================================ */
  function renderLogin() {
    const main = $("#main");
    main.innerHTML = `
      <div class="login-wrap">
        <div class="login-card fade-in">
          <div class="l-logo">
            <div class="lm">AG</div>
            <div class="lt">AGMX</div>
          </div>
          <h1>Sistem Operasi Tadbir Urus Koperasi</h1>
          <p class="l-sub">Log masuk untuk mengurus ${D.agm.title}</p>

          <div class="login-tabs">
            <div class="login-tab active" data-tab="otp">SMS / WhatsApp OTP</div>
            <div class="login-tab" data-tab="passkey">Passkey</div>
          </div>

          <div data-pane="otp">
            <div class="login-methods">
              <div class="login-method active">
                <div class="lm-icon">${ICONS.bell}</div>
                <div class="lm-title">SMS OTP</div>
                <div class="lm-sub">+60 12-*** 8821</div>
              </div>
              <div class="login-method">
                <div class="lm-icon">${ICONS.chat}</div>
                <div class="lm-title">WhatsApp</div>
                <div class="lm-sub">One Click Join</div>
              </div>
            </div>

            <div class="label">Pilih Peranan Anda</div>
            <div class="role-pick">
              <div class="role-pick-card active" data-role="secretary">
                <div class="rp-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                <div class="rp-title">Setiausaha</div>
                <div class="rp-sub">Pentadbir AGM</div>
              </div>
              <div class="role-pick-card" data-role="chairman">
                <div class="rp-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg></div>
                <div class="rp-title">Pengerusi</div>
                <div class="rp-sub">Kawalan dewan</div>
              </div>
              <div class="role-pick-card" data-role="member">
                <div class="rp-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
                <div class="rp-title">Ahli</div>
                <div class="rp-sub">Mengundi</div>
              </div>
            </div>

            <div class="label">Masukkan 6-digit OTP yang dihantar</div>
            <div class="otp-row">
              <input class="otp-box" maxlength="1" value="4">
              <input class="otp-box" maxlength="1" value="8">
              <input class="otp-box" maxlength="1" value="2">
              <input class="otp-box" maxlength="1" value="1">
              <input class="otp-box" maxlength="1" value="7">
              <input class="otp-box" maxlength="1" value="9">
            </div>

            <button class="btn btn-primary btn-xl" style="width:100%; justify-content:center;" id="login-btn">
              ${ICONS.check}<span>Sah & Masuk AGM</span>
            </button>

            <div class="login-foot">
              Kod tamat dalam 02:48 · <a href="#">Hantar semula</a> · <a href="#">Bukan ahli?</a>
            </div>
          </div>
        </div>
      </div>
    `;

    // OTP boxes focus
    $$(".otp-box").forEach((b, i, arr) => {
      b.addEventListener("input", () => {
        if (b.value && arr[i + 1]) arr[i + 1].focus();
      });
    });

    $$(".login-tab").forEach((t) =>
      t.addEventListener("click", () => {
        $$(".login-tab").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        if (t.dataset.tab === "passkey") {
          showToast("Passkey: Gunakan cap jari / Face ID");
        }
      })
    );

    $$(".role-pick-card").forEach((r) =>
      r.addEventListener("click", () => {
        $$(".role-pick-card").forEach((x) => x.classList.remove("active"));
        r.classList.add("active");
        state.role = r.dataset.role;
      })
    );

    $("#login-btn").addEventListener("click", () => {
      const btn = $("#login-btn");
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span><span>Mengesahkan OTP...</span>`;
      setTimeout(() => {
        navigate("dashboard");
        showToast("🔐 Log masuk berjaya. Selamat datang ke AGM Ke-16!");
      }, 700);
    });
  }

  /* ============================================================
     DASHBOARD
     ============================================================ */
  function renderDashboard() {
    const main = $("#main");
    const f = D.financialSummary;
    main.innerHTML = `
      <div class="fade-in">
        <div class="page-head">
          <div>
            <h1 class="page-title">Selamat Datang, Pn. Aishah 👋</h1>
            <div class="page-sub">AGM Ke-16 sedang berjalan · Hari ke-2 persidangan · Kuorum 31.4%</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost">${ICONS.download}<span>Eksport Laporan</span></button>
            <button class="btn btn-ghost" data-route="senior-member">🧓<span>Pratonton Senior</span></button>
            <button class="btn btn-primary" data-route="agm-hall">${ICONS.cam}<span>Masuk Dewan AGM</span></button>
          </div>
        </div>

        <div class="dash-greeting">
          <div>
            <h2>${D.agm.title}</h2>
            <p>${D.agm.date} · ${D.agm.time} · ${D.agm.venue}. Persidangan diteruskan dengan Agenda AG-06 — Pembahagian Dividen & Lebih Surplus.</p>
          </div>
          <div class="g-actions">
            <button class="btn" style="background:rgba(255,255,255,0.2); color:#fff; border:1px solid rgba(255,255,255,0.3)">${ICONS.bell}<span>Notis (3)</span></button>
            <button class="btn btn-accent" data-route="wizard">${ICONS.plus}<span>Cipta AGM</span></button>
            <button class="btn btn-accent" data-route="scanner">${ICONS.qr}<span>Imbas QR</span></button>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi">
            <div class="kpi-icon">${ICONS.users}</div>
            <div class="kpi-label">Jumlah Ahli</div>
            <div class="kpi-value">${D.cooperative.members.toLocaleString()}</div>
            <div class="kpi-trend">+8.2% tahun ke tahun</div>
          </div>
          <div class="kpi" style="background:linear-gradient(135deg,#065F46,#10B981);color:#fff;">
            <div class="kpi-icon" style="background:rgba(255,255,255,0.2);color:#fff">${ICONS.vote}</div>
            <div class="kpi-label" style="color:rgba(255,255,255,0.7)">Undian Setakat Ini</div>
            <div class="kpi-value">${(D.motions[0].votes.ya + D.motions[0].votes.tidak + D.motions[0].votes.abstain).toLocaleString()}</div>
            <div class="kpi-trend" style="color:#fff">↑ Aktif dalam ${D.motions[0].id}</div>
          </div>
          <div class="kpi">
            <div class="kpi-icon" style="background:#FEF3C7;color:#92400E">${ICONS.calendar}</div>
            <div class="kpi-label">Sesi AGM</div>
            <div class="kpi-value">${D.agm.id.split("-").pop()}</div>
            <div class="kpi-trend down">Tamat dalam 1j 42m</div>
          </div>
          <div class="kpi">
            <div class="kpi-icon" style="background:#DBEAFE;color:#1E40AF">${ICONS.shield}</div>
            <div class="kpi-label">Skor Pematuhan</div>
            <div class="kpi-value">${D.compliance.score}<span style="font-size:18px;color:var(--c-text-3)">/100</span></div>
            <div class="kpi-trend">Akta Koperasi 1993 · GP14</div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1.6fr 1fr; gap:20px; margin-top:20px">
          <div>
            <div class="card">
              <div class="card-head">
                <div class="card-title">Live Meeting Health</div>
                <span class="badge success"><span class="dot"></span> Semua Sistem Normal</span>
              </div>
              <div class="card-body">
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
                  ${healthCard("Sesi Aktif", D.health.activeSessions, "ahli sedang online", ICONS.users, "#10B981")}
                  ${healthCard("WebSocket Latency", D.health.wsLatency + " ms", "↓ 8 ms dari semalam", ICONS.screen, "#3B82F6")}
                  ${healthCard("Bandwidth", D.health.bandwidth + "%", "Auto-scaling aktif", ICONS.globe, "#F59E0B")}
                  ${healthCard("AI Alerts", "2 aktif", "Compliance + Chairman", ICONS.alert, "#EF4444")}
                </div>
                <hr class="divider">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                  <div style="font-weight:700">Senarai Agenda Aktif</div>
                  <span class="text-sm text-3">${D.agenda.filter(a => a.status === "Selesai").length}/${D.agenda.length || "0"} selesai</span>
                </div>
                <div class="agenda-list">
                  ${D.agenda.slice(0, 5).map(a => `
                    <div class="agenda-item ${a.status === 'Sedang Berlangsung' ? 'active' : ''} ${a.status === 'Selesai' ? 'done' : ''}">
                      <div class="agenda-num">${a.id.split("-")[1]}</div>
                      <div class="agenda-text">
                        <div class="agenda-title">${a.title}</div>
                        <div class="agenda-meta"><span>${a.type}</span> · <span>${a.duration} minit</span> · <span>${a.presenter}</span></div>
                      </div>
                      <span class="badge ${a.status === 'Selesai' ? 'success' : a.status === 'Sedang Berlangsung' ? 'warning' : ''}">${a.status}</span>
                    </div>
                  `).join("")}
                </div>
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-head">
                <div class="card-title">Ringkasan Kewangan TK 2025 (AI Ringkasan)</div>
                <span class="badge info">${ICONS.sparkle} Auto-jana</span>
              </div>
              <div class="card-body">
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
                  ${financeCard("Hasil", f.revenue, "+9.8% YoY", "#0B5394")}
                  ${financeCard("Untung Bersih", f.netProfit, f.yoyProfit + " YoY", "#10B981")}
                  ${financeCard("Dividen Dicadangkan", f.dividend, "daripada Lebih Surplus", "#8A6A0B")}
                </div>
                <div class="fin-chart">
                  <div class="fc-title">Trend Untung Bersih (5 tahun)</div>
                  ${finChartSvg()}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div class="card">
              <div class="card-head">
                <div class="card-title">Status Kuorum</div>
                <span class="badge success"><span class="dot"></span> PATUH</span>
              </div>
              <div class="quorum-card" style="border-radius:0 0 14px 14px">
                <div class="quorum-numbers">
                  <div class="pct">${D.agm.quorumPct}%</div>
                  <div class="abs">(${D.agm.quorumPresent} / ${D.agm.totalMembers})</div>
                </div>
                ${(() => {
                  const pct = D.agm.quorumPct;
                  const target = D.cooperative.quorumPct;
                  const barColor = pct < target ? 'linear-gradient(90deg,#EF4444,#F87171)' : pct < target * 1.2 ? 'linear-gradient(90deg,#F59E0B,#FCD34D)' : 'linear-gradient(90deg,#10B981,#34D399)';
                  return `
                <div class="quorum-bar-wrap" style="position:relative;overflow:visible;margin-top:30px">
                  <div class="quorum-bar" style="width:${pct}%;background:${barColor}"></div>
                  <div class="quorum-threshold-line" style="left:${target}%;"></div>
                  <div class="quorum-target-tag" style="left:${target}%">Sasaran ${target}%</div>
                </div>`;
                })()}
                <div class="flex justify-between text-sm" style="opacity:0.85;margin-top:14px">
                  <span>Syarat minimum: ${D.agm.quorumPct > D.cooperative.quorumPct ? '✅' : '⚠️'} ${D.agm.quorumRequired} ahli (${D.cooperative.quorumPct}%)</span>
                  <span class="quorum-status"><span class="dot"></span> LIVE</span>
                </div>
                <div style="margin-top:14px; font-size:12px; opacity:0.8">
                  Mod: Hibrid · Fizikal: 142 · Dalam Talian: 261
                </div>
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-head">
                <div class="card-title">${ICONS.sparkle} AI Copilot Alert</div>
              </div>
              <div class="card-body">
                <div class="ai-alert">
                  <div class="ai-alert-head">📊 AI Question Organizer</div>
                  <div class="ai-alert-text">12 soalan ahli tentang "Dividen" boleh digabung menjadi 1 untuk dijawab sekaligus.</div>
                  <div class="ai-alert-actions">
                    <button class="btn btn-sm btn-primary">Satukan Soalan</button>
                  </div>
                </div>
                <div class="ai-alert" style="background:#D1FAE5;border-left-color:#10B981;">
                  <div class="ai-alert-head" style="color:#047857">✅ AI Compliance</div>
                  <div class="ai-alert-text">Semua notis dihantar 21 hari lebih awal — melebihi minimum UUK 15 hari.</div>
                </div>
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-head">
                <div class="card-title">Pek Mesyuarat Digital</div>
              </div>
              <div class="card-body" style="display:grid;gap:10px">
                ${meetingPack("Notis AGM", "PDF · 4 halaman · Dihantar 02 Jun", "ready")}
                ${meetingPack("Agenda & Minit", "PDF · 12 halaman", "ready")}
                ${meetingPack("Penyata Kewangan 2025", "PDF · 28 halaman", "ready")}
                ${meetingPack("Laporan Tahunan", "PDF · 64 halaman", "ready")}
                ${meetingPack("Draf Minit AGM-16", "AI-generated · Sedang dijana", "generating")}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    $$("[data-route]").forEach((b) =>
      b.addEventListener("click", () => {
        navigate(b.dataset.route);
      })
    );
  }

  function healthCard(label, value, sub, icon, color) {
    return `
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <div style="width:32px;height:32px;border-radius:8px;background:${color}15;color:${color};display:grid;place-items:center">
            ${icon}
          </div>
          <div style="font-size:12px;color:var(--c-text-3);font-weight: 500">${label}</div>
        </div>
        <div style="font-size:22px;font-weight: 700;letter-spacing:-0.5px">${value}</div>
        <div style="font-size:11.5px;color:var(--c-text-3);margin-top:2px">${sub}</div>
      </div>
    `;
  }
  function financeCard(label, value, sub, color) {
    return `
      <div style="padding:14px;background:${color}10;border-radius:10px;border-left:3px solid ${color}">
        <div style="font-size:11.5px;color:var(--c-text-3);text-transform:uppercase;letter-spacing:0.5px;font-weight: 500">${label}</div>
        <div style="font-size:22px;font-weight: 700;color:${color};margin-top:4px">${value}</div>
        <div style="font-size:11.5px;color:var(--c-text-3);margin-top:2px">${sub}</div>
      </div>
    `;
  }
  function meetingPack(title, sub, status) {
    const stColor = status === "ready" ? "success" : "warning";
    return `
      <div class="flex items-center justify-between" style="padding:10px; background:var(--c-surface-2); border-radius:8px">
        <div>
          <div style="font-weight: 500;font-size:13.5px">${title}</div>
          <div style="font-size:11.5px;color:var(--c-text-3);margin-top:2px">${sub}</div>
        </div>
        ${status === "ready"
          ? `<button class="btn btn-sm btn-ghost">${ICONS.download}</button>`
          : `<span class="badge ${stColor}"><span class="dot"></span> Menjana</span>`}
      </div>
    `;
  }
  function finChartSvg() {
    const data = [820, 940, 1180, 1320, 1420];
    const years = ["2021", "2022", "2023", "2024", "2025"];
    const max = Math.max(...data);
    const w = 360, h = 100;
    const stepX = w / (data.length - 1);
    const yOf = (v) => h - (v / max) * (h - 20) - 10;
    let path = "", area = "";
    data.forEach((v, i) => {
      const x = i * stepX;
      const y = yOf(v);
      path += `${i === 0 ? "M" : "L"} ${x} ${y} `;
      area += `${i === 0 ? "M" : "L"} ${x} ${y} `;
    });
    area += `L ${w} ${h} L 0 ${h} Z`;
    return `
      <svg viewBox="0 0 ${w} ${h + 10}" preserveAspectRatio="none" style="width:100%;height:auto" role="img" aria-label="Trend untung bersih 5 tahun: RM 820K (2021) ke RM 1,420K (2025)">
        <defs>
          <linearGradient id="finG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0B5394" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#0B5394" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#finG)"/>
        <path d="${path}" fill="none" stroke="#0B5394" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${data.map((v, i) => `<g class="fin-point"><circle cx="${i * stepX}" cy="${yOf(v)}" r="4" fill="#fff" stroke="#0B5394" stroke-width="2"><title>${years[i]}: RM ${(v / 1000).toFixed(2)} Juta</title></circle><circle cx="${i * stepX}" cy="${yOf(v)}" r="12" fill="transparent"><title>${years[i]}: RM ${(v / 1000).toFixed(2)} Juta</title></circle></g>`).join("")}
      </svg>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--c-text-3);margin-top:4px">
        ${years.map(y => `<span>${y}</span>`).join("")}
      </div>
      <div class="fin-legend">
        <span class="fin-legend-item"><span class="fin-legend-swatch" style="background:#0B5394"></span> Untung Bersih (RM Juta)</span>
        <span class="fin-legend-item" style="color:var(--c-success);font-weight:600">↑ +73% dalam 5 tahun</span>
      </div>
    `;
  }

  /* ============================================================
     MEMBERS
     ============================================================ */
  function renderMembers() {
    const main = $("#main");
    const filtered = D.members.filter(m => {
      if (state.memberSearch && !m.name.toLowerCase().includes(state.memberSearch.toLowerCase()) && !m.id.includes(state.memberSearch)) return false;
      if (state.agendaFilter === "eligible" && !m.eligible) return false;
      if (state.agendaFilter === "ineligible" && m.eligible) return false;
      if (state.agendaFilter === "arrears" && m.status !== "Tunggakan") return false;
      if (state.agendaFilter === "proxy" && !m.proxy) return false;
      return true;
    });
    // Column sorting
    if (state.memberSort.key) {
      const { key, dir } = state.memberSort;
      filtered.sort((a, b) => {
        let va = a[key], vb = b[key];
        if (typeof va === "string") { va = va.toLowerCase(); vb = (vb || "").toLowerCase(); }
        if (va < vb) return dir === "asc" ? -1 : 1;
        if (va > vb) return dir === "asc" ? 1 : -1;
        return 0;
      });
    }
    const sortIcon = (key) => state.memberSort.key !== key ? '<span class="sort-icon">↕</span>'
      : state.memberSort.dir === "asc" ? '<span class="sort-icon on">↑</span>' : '<span class="sort-icon on">↓</span>';
    const ariaSort = (key) => state.memberSort.key !== key ? "none" : state.memberSort.dir === "asc" ? "ascending" : "descending";
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.membersPerPage));
    if (state.membersPage > totalPages) state.membersPage = totalPages;
    const page = state.membersPage;
    const startIdx = (page - 1) * state.membersPerPage;
    const pageData = filtered.slice(startIdx, startIdx + state.membersPerPage);
    const eligibleCount = D.members.filter(m => m.eligible).length;
    const arrearsCount = D.members.filter(m => m.status === "Tunggakan").length;
    const proxyCount = D.members.filter(m => m.proxy).length;
    main.innerHTML = `
      <div class="fade-in">
        <div class="page-head">
          <div>
            <h1 class="page-title">Ahli & Organisasi</h1>
            <div class="page-sub">${D.members.length} ahli berdaftar · ${eligibleCount} layak mengundi · ${arrearsCount} tunggakan</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost">${ICONS.download}<span>Eksport CSV</span></button>
            <button class="btn btn-ghost">${ICONS.upload}<span>Import CSV</span></button>
            <button class="btn btn-primary">${ICONS.plus}<span>Tambah Ahli</span></button>
          </div>
        </div>

        <div class="kpi-grid mb-4">
          ${kpiBox("Jumlah Ahli", D.members.length, "+8.2%", "primary")}
          ${kpiBox("Layak Mengundi", eligibleCount, "Auto-tapis aktif", "success")}
          ${kpiBox("Tunggakan", arrearsCount, "Perlu penjelasan SKM", "warning")}
          ${kpiBox("Menggunakan Proksi", proxyCount, "Surat proksi disahkan", "info")}
        </div>

        <div class="card">
          <div class="toolbar">
            <div class="search">
              ${ICONS.search}
              <input type="text" placeholder="Cari nama atau no. ahli..." id="member-search" value="${state.memberSearch}">
            </div>
            <div class="filter-chip ${state.agendaFilter === 'all' ? 'active' : ''}" data-filter="all">Semua</div>
            <div class="filter-chip ${state.agendaFilter === 'eligible' ? 'active' : ''}" data-filter="eligible">✓ Layak Undi</div>
            <div class="filter-chip ${state.agendaFilter === 'ineligible' ? 'active' : ''}" data-filter="ineligible">✗ Tidak Layak</div>
            <div class="filter-chip ${state.agendaFilter === 'arrears' ? 'active' : ''}" data-filter="arrears">Tunggakan</div>
            <div class="filter-chip ${state.agendaFilter === 'proxy' ? 'active' : ''}" data-filter="proxy">Proksi</div>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th><input type="checkbox" aria-label="Pilih semua"></th>
                <th class="th-sort" data-sort="name" aria-sort="${ariaSort('name')}">Nama & No. Ahli ${sortIcon('name')}</th>
                <th>No. IC</th>
                <th class="th-sort" data-sort="shares" aria-sort="${ariaSort('shares')}">Saham ${sortIcon('shares')}</th>
                <th class="th-sort" data-sort="status" aria-sort="${ariaSort('status')}">Status ${sortIcon('status')}</th>
                <th>Kelayakan Undi</th>
                <th>Proksi</th>
                <th>Kehadiran</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${pageData.map(m => `
                <tr>
                  <td><input type="checkbox"></td>
                  <td>
                    <div class="member-cell">
                      <div class="member-avatar">${m.name.split(" ").slice(-1)[0].slice(0,1)}${m.name.split(" ")[1] ? m.name.split(" ")[1].slice(0,1) : ''}</div>
                      <div>
                        <div class="member-name">${m.name}</div>
                        <div class="member-id">${m.id}</div>
                      </div>
                    </div>
                  </td>
                  <td class="text-mono text-sm">${m.ic}</td>
                  <td class="text-bold">${m.shares.toLocaleString()}</td>
                  <td>
                    <span class="badge ${m.status === 'Aktif' ? 'success' : 'warning'}">
                      <span class="dot"></span> ${m.status}${m.arrears > 0 ? ` (RM ${m.arrears})` : ''}
                    </span>
                  </td>
                  <td>
                    <span class="eligibility-chip ${m.eligible ? 'eligible' : 'ineligible'}">
                      ${m.eligible ? '✓' : '✕'} ${m.eligible ? 'Layak' : 'Disekat'}
                    </span>
                  </td>
                  <td class="text-sm">${m.proxy ? `<span style="color:var(--c-info)">→ ${m.proxy}</span>` : '<span class="text-3">—</span>'}</td>
                  <td>
                    ${m.attended
                      ? '<span class="badge success"><span class="dot"></span> Hadir</span>'
                      : '<span class="badge"><span class="dot"></span> Belum</span>'}
                  </td>
                  <td>
                    <button class="btn btn-sm btn-ghost">${ICONS.screen}</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          ${filtered.length === 0 ? '<div style="padding:40px;text-align:center;color:var(--c-text-3)">Tiada ahli padanan dengan carian</div>' : ''}
          <div class="card-foot flex items-center justify-between text-sm">
            <div class="text-3">Paparan ${startIdx + 1}-${Math.min(startIdx + state.membersPerPage, filtered.length)} daripada ${filtered.length} ahli</div>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-ghost" data-mpage="prev" ${page <= 1 ? 'disabled' : ''}>Sebelum</button>
              ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p =>
                `<button class="btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}" data-mpage="${p}">${p}</button>`
              ).join("")}
              <button class="btn btn-sm btn-ghost" data-mpage="next" ${page >= totalPages ? 'disabled' : ''}>Seterus</button>
            </div>
          </div>
        </div>
      </div>
    `;

    $("#member-search")?.addEventListener("input", (e) => {
      state.memberSearch = e.target.value;
      state.membersPage = 1;
      renderMembers();
      $("#member-search").focus();
    });
    $$("[data-filter]").forEach(c =>
      c.addEventListener("click", () => {
        state.agendaFilter = c.dataset.filter;
        state.membersPage = 1;
        renderMembers();
      })
    );
    $$(".th-sort").forEach(th =>
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (state.memberSort.key === key) {
          state.memberSort.dir = state.memberSort.dir === "asc" ? "desc" : "asc";
        } else {
          state.memberSort = { key, dir: "asc" };
        }
        renderMembers();
      })
    );
    $$("[data-mpage]").forEach(b =>
      b.addEventListener("click", () => {
        const val = b.dataset.mpage;
        if (val === "prev") state.membersPage = Math.max(1, state.membersPage - 1);
        else if (val === "next") {
          const totalPages = Math.max(1, Math.ceil(filtered.length / state.membersPerPage));
          state.membersPage = Math.min(totalPages, state.membersPage + 1);
        }
        else state.membersPage = parseInt(val, 10);
        renderMembers();
      })
    );
  }

  function kpiBox(label, val, sub, color) {
    return `
      <div class="kpi">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value" style="color:var(--c-${color})">${val.toLocaleString ? val.toLocaleString() : val}</div>
        <div class="kpi-trend">${sub}</div>
      </div>
    `;
  }

  /* ============================================================
     AGM LIVE HALL
     ============================================================ */
  function renderHall() {
    const main = $("#main");
    main.innerHTML = `
      <div class="fade-in">
        <div class="page-head">
          <div>
            <h1 class="page-title">${D.agm.title}</h1>
            <div class="page-sub">${D.agm.edition} · ${D.agm.date} · ${D.agm.mode}</div>
          </div>
          <div class="page-actions">
            <span class="badge danger" style="font-size:13px;padding:6px 12px"><span class="dot"></span> SEDANG BERLANGSUNG · ${D.agm.elapsed}</span>
            <button class="btn btn-ghost">${ICONS.share || ICONS.download}<span>Rekod</span></button>
            <button class="btn btn-primary" data-route="voting">${ICONS.vote}<span>Buka Mod Voting</span></button>
          </div>
        </div>

        <div class="hall">
          <div class="hall-main">
            <div class="hall-backdrop"></div>
            <div class="hall-header">
              <div>
                <div class="hall-title">Dewan AGM — Layout ${state.selectedLayout === 'town-hall' ? 'Town Hall' : state.selectedLayout === 'conference' ? 'Persidangan' : state.selectedLayout === 'presentation' ? 'Pembentangan' : state.selectedLayout === 'discussion' ? 'Perbahasan' : 'Pengundian'}</div>
                <div class="hall-subtitle">AG-06 · Pembahagian Dividen & Lebih Surplus</div>
              </div>
              <div class="layout-tabs">
                <div class="layout-tab ${state.selectedLayout === 'town-hall' ? 'active' : ''}" data-layout="town-hall">Town Hall</div>
                <div class="layout-tab ${state.selectedLayout === 'conference' ? 'active' : ''}" data-layout="conference">Persidangan</div>
                <div class="layout-tab ${state.selectedLayout === 'presentation' ? 'active' : ''}" data-layout="presentation">Pembentangan</div>
                <div class="layout-tab ${state.selectedLayout === 'discussion' ? 'active' : ''}" data-layout="discussion">Perbahasan</div>
                <div class="layout-tab ${state.selectedLayout === 'voting' ? 'active' : ''}" data-layout="voting">Undian</div>
              </div>
            </div>
            <div class="stage-layout mode-${state.selectedLayout}">
              ${state.selectedLayout === 'town-hall' ? `
                <div class="stage-card feature">
                  <div class="stage-screen" style="background:linear-gradient(135deg, rgba(212,160,23,0.1), rgba(11,83,148,0.1))">
                    <div style="text-align:center">
                      <div class="speaker-tile">AC</div>
                      <div class="speaker-name" style="margin-top:14px;font-size:20px">Dato' Ariffin Bin Kassim</div>
                      <div class="speaker-role" style="font-size:14px;opacity:0.85">Pengerusi KOPEMAJU</div>
                      <div class="speaker-live-meta">
                        <span class="slm-chip live"><span class="h-live-dot"></span> Sedang bercakap · <span id="speaker-timer">04:12</span></span>
                        <span class="slm-chip">📋 AG-06 · Pembahagian Dividen & Lebih Surplus</span>
                        <span class="slm-chip">🗳️ M-001 sedang diundi</span>
                      </div>
                    </div>
                  </div>
                  <div class="live-transcript">
                    <div class="lt-head">🔊 Transkrip Langsung · Auto-translate</div>
                    <div class="lt-line"><b>Dato' Ariffin:</b> "Ahli sekalian, kita sekarang membincangkan pembahagian dividen 8% daripada lebih surplus RM 1.42 juta..."</div>
                    <div class="lt-line dim"><b>AI (EN):</b> "Members, we are now discussing the 8% dividend distribution from the RM 1.42 million surplus..."</div>
                  </div>
                </div>
              ` : state.selectedLayout === 'conference' ? `
                <div class="stage-card feature">
                  <div class="stage-screen">
                    <div style="text-align:center">
                      <div class="speaker-tile">AC</div>
                      <div class="speaker-name" style="margin-top:14px">Dato' Ariffin (Pengerusi)</div>
                      <div class="speaker-role">Memperbahasan M-001</div>
                    </div>
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:14px">
                  <div class="stage-card">
                    <div class="stage-screen" style="min-height:120px">
                      <div style="text-align:center">
                        <div class="speaker-tile s-2 sm">VK</div>
                        <div class="speaker-name" style="margin-top:8px;font-size:13px">En. Vijay Kumar</div>
                        <div class="speaker-role" style="font-size:11px">Pencadang M-001</div>
                      </div>
                    </div>
                  </div>
                  <div class="stage-card">
                    <div class="stage-screen" style="min-height:120px">
                      <div style="text-align:center">
                        <div class="speaker-tile s-3 sm">WS</div>
                        <div class="speaker-name" style="margin-top:8px;font-size:13px">Pn. Wong</div>
                        <div class="speaker-role" style="font-size:11px">Penyokong</div>
                      </div>
                    </div>
                  </div>
                </div>
              ` : state.selectedLayout === 'presentation' ? `
                <div class="stage-card feature">
                  <div class="stage-screen" style="display:flex;flex-direction:column;padding:32px">
                    <div style="background:rgba(255,255,255,0.05);padding:24px;border-radius:12px;width:100%">
                      <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.5);margin-bottom:8px">Slaid 14 / 28</div>
                      <div style="font-size:28px;font-weight: 700;margin-bottom:12px">Analisis Untung Bersih TK 2025</div>
                      <div style="font-size:16px;line-height:1.6;opacity:0.9">Pendapatan koperasi meningkat 9.8% kepada RM 12.84 juta, dengan untung bersih RM 1.42 juta. Dividen 8% dicadangkan — melebihi purata 3 tahun sebelumnya.</div>
                      <div style="margin-top:18px;display:flex;gap:14px">
                        <div style="flex:1;padding:14px;background:rgba(16,185,129,0.2);border-radius:8px"><div style="font-size:11px;opacity:0.7">Hasil</div><div style="font-size:22px;font-weight: 700">RM 12.84M</div></div>
                        <div style="flex:1;padding:14px;background:rgba(212,160,23,0.2);border-radius:8px"><div style="font-size:11px;opacity:0.7">Dividen</div><div style="font-size:22px;font-weight: 700">8%</div></div>
                        <div style="flex:1;padding:14px;background:rgba(59,130,246,0.2);border-radius:8px"><div style="font-size:11px;opacity:0.7">YoY</div><div style="font-size:22px;font-weight: 700">+12.4%</div></div>
                      </div>
                    </div>
                  </div>
                  <div class="speakers-row" style="padding:8px">
                    <div class="speaker-tile s-2 sm">SH</div>
                    <div class="speaker-tile s-3 sm">MG</div>
                    <div class="speaker-tile s-4 sm">AC</div>
                  </div>
                </div>
              ` : state.selectedLayout === 'discussion' ? `
                <div class="stage-card">
                  <div style="font-size:13px;font-weight:700;opacity:0.8">Senarai Penceramah (Speaker Queue)</div>
                  <div class="speakers-row" style="justify-content:flex-start;flex-direction:column;align-items:stretch;gap:8px">
                    ${[
                      { name: "En. Muthusamy Gopal", role: "Ahli · 71 tahun", initial: "MG", cls: "s-3" },
                      { name: "Pn. Zaiton (Proksi: Pn. Fatimah)", role: "Ahli · 75 tahun", initial: "ZF", cls: "s-4" },
                      { name: "En. Lim Chong Wei", role: "Calon Pengerusi", initial: "LC", cls: "s-2" },
                      { name: "Cik Nurul Huda", role: "Ahli · 32 tahun", initial: "NH", cls: "s-5" },
                    ].map((s, i) => `
                      <div class="flex items-center gap-3" style="background:rgba(255,255,255,0.04);padding:10px;border-radius:10px">
                        <div style="width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,0.1);display:grid;place-items:center;font-size:11px;font-weight:700">${i + 1}</div>
                        <div class="speaker-tile ${s.cls} sm">${s.initial}</div>
                        <div style="flex:1">
                          <div style="font-weight: 500;font-size:13px">${s.name}</div>
                          <div style="font-size:11px;opacity:0.6">${s.role}</div>
                        </div>
                        <span class="badge">${i === 0 ? '🎤 Sedang bercakap' : 'Menunggu'}</span>
                      </div>
                    `).join("")}
                  </div>
                </div>
                <div class="stage-card">
                  <div style="font-size:13px;font-weight:700;opacity:0.8">Live Caption & Translate</div>
                  <div style="background:rgba(0,0,0,0.3);padding:14px;border-radius:8px;flex:1;display:flex;flex-direction:column;gap:10px;font-size:13px">
                    <div><span style="color:#D4A017;font-weight:700">Muthusamy:</span> Saya menyokong penuh kadar dividen 8% — ia adalah munasabah dan selari dengan prestasi tahun ini.</div>
                    <div style="opacity:0.6"><span style="color:#10B981;font-weight:700">AI Auto-Translate (EN):</span> "I fully support the 8% dividend rate — it is reasonable and aligned with this year's performance."</div>
                    <div><span style="color:#D4A017;font-weight:700">Zaiton:</span> Boleh penjelasan formula pengiraan?</div>
                    <div style="opacity:0.6"><span style="color:#10B981;font-weight:700">AI Auto-Translate (TA):</span> "கணக்கீடு சூத்திரத்தை விளக்க முடியுமா?"</div>
                  </div>
                  <div style="font-size:11px;opacity:0.5;text-align:center">🔊 Audio diterjemah masa nyata oleh AI</div>
                </div>
              ` : `
                <div class="stage-card feature">
                  <div style="text-align:center">
                    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.6">M-001 SEDANG DIUNDI</div>
                    <div style="font-size:26px;font-weight: 700;margin:10px 0 6px">Pembahagian Dividen 8%</div>
                    <div style="font-size:14px;opacity:0.8;margin-bottom:24px">daripada Lebih Surplus RM 1.42 Juta</div>

                    ${(function() { const _t = D.motions[0].votes.ya + D.motions[0].votes.tidak + D.motions[0].votes.abstain; const _s = _t > 0 ? _t : 1; return `
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;max-width:580px;margin:0 auto">
                      <div style="background:rgba(16,185,129,0.2);padding:24px 14px;border-radius:14px;border:1px solid rgba(16,185,129,0.4)">
                        <div style="font-size:42px;font-weight: 700;color:#10B981">${D.motions[0].votes.ya}</div>
                        <div style="font-size:14px;font-weight:700;letter-spacing:1px;margin-top:6px">YA</div>
                        <div style="font-size:11px;opacity:0.7;margin-top:4px">${Math.round(D.motions[0].votes.ya / _s * 100)}%</div>
                      </div>
                      <div style="background:rgba(239,68,68,0.2);padding:24px 14px;border-radius:14px;border:1px solid rgba(239,68,68,0.4)">
                        <div style="font-size:42px;font-weight: 700;color:#EF4444">${D.motions[0].votes.tidak}</div>
                        <div style="font-size:14px;font-weight:700;letter-spacing:1px;margin-top:6px">TIDAK</div>
                        <div style="font-size:11px;opacity:0.7;margin-top:4px">${Math.round(D.motions[0].votes.tidak / _s * 100)}%</div>
                      </div>
                      <div style="background:rgba(148,163,184,0.2);padding:24px 14px;border-radius:14px;border:1px solid rgba(148,163,184,0.4)">
                        <div style="font-size:42px;font-weight: 700;color:#94A3B8">${D.motions[0].votes.abstain}</div>
                        <div style="font-size:14px;font-weight:700;letter-spacing:1px;margin-top:6px">KOSONG</div>
                        <div style="font-size:11px;opacity:0.7;margin-top:4px">${Math.round(D.motions[0].votes.abstain / _s * 100)}%</div>
                      </div>
                    </div>`})()}

                    <div style="margin-top:30px;display:flex;justify-content:center;gap:14px">
                      <button class="btn btn-success btn-xl" id="hall-close-vote">${ICONS.check}<span>Tutup Undian</span></button>
                      <button class="btn btn-ghost btn-xl" style="background:rgba(255,255,255,0.1); color:#fff; border-color:rgba(255,255,255,0.2)">${ICONS.vote}<span>Lanjutkan 2 min</span></button>
                    </div>

                    <div style="margin-top:24px;font-size:12px;opacity:0.6">313 daripada 403 ahli berkuorum telah mengundi · Tamat: 11:45</div>
                  </div>
                </div>
              `}
            </div>
            <div class="hall-controls">
              <div class="hall-actions">
                <button class="hall-btn" title="Mikrofon">${ICONS.mic}</button>
                <button class="hall-btn" title="Kamera">${ICONS.cam}</button>
                <button class="hall-btn" title="Skrin">${ICONS.screen}</button>
                <button class="hall-btn" title="Subtitle">${ICONS.volume}</button>
              </div>
              <div class="hall-actions">
                <button class="hall-btn primary lg" title="Tangan">${ICONS.plus}</button>
              </div>
              <div class="hall-actions">
                <button class="hall-btn" title="Rekod">${ICONS.download}</button>
                <button class="hall-btn danger" title="Akhiri Mesyuarat" id="hall-end-btn" aria-label="Akhiri mesyuarat">${ICONS.phoneOff}</button>
              </div>
            </div>
          </div>

          <div class="hall-side">
            <div class="card">
              <div class="card-head">
                <div class="card-title">Agenda Sesi</div>
                <span class="badge info">${D.agenda.filter(a => a.status === "Selesai").length}/${D.agenda.length}</span>
              </div>
              <div class="agenda-list">
                ${D.agenda.map(a => `
                  <div class="agenda-item ${a.status === 'Sedang Berlangsung' ? 'active' : ''} ${a.status === 'Selesai' ? 'done' : ''}">
                    <div class="agenda-num">${a.id.split("-")[1]}</div>
                    <div class="agenda-text">
                      <div class="agenda-title">${a.title}</div>
                      <div class="agenda-meta"><span>${a.type}</span> · <span>${a.duration}m</span></div>
                    </div>
                    <span class="badge ${a.status === 'Selesai' ? 'success' : a.status === 'Sedang Berlangsung' ? 'warning' : ''}">${a.status === 'Selesai' ? '✓' : a.status === 'Sedang Berlangsung' ? '●' : '○'}</span>
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="card">
              <div class="card-head">
                <div class="card-title">${ICONS.sparkle} AI Live Help</div>
              </div>
              <div class="card-body" style="padding:14px">
                <div style="background:#FEF3C7;padding:10px;border-radius:8px;font-size:12.5px;margin-bottom:10px">
                  <div style="font-weight:700;color:#92400E">📊 Soalan Digabung</div>
                  <div style="color:var(--c-text-2);margin-top:2px">12 soalan tentang Dividen → 1 soalan</div>
                </div>
                <div style="background:#D1FAE5;padding:10px;border-radius:8px;font-size:12.5px;margin-bottom:10px">
                  <div style="font-weight:700;color:#047857">⏱️ Peringatan</div>
                  <div style="color:var(--c-text-2);margin-top:2px">M-001 berbaki 4 minit sebelum auto-tutup</div>
                </div>
                <div style="background:#FEE2E2;padding:10px;border-radius:8px;font-size:12.5px">
                  <div style="font-weight:700;color:#B91C1C">⚠️ Compliance</div>
                  <div style="color:var(--c-text-2);margin-top:2px">M-003 auto-gugur (tiada Penyokong)</div>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-head">
                <div class="card-title">Speaker Queue</div>
                <span class="badge warning">4 menunggu</span>
              </div>
              <div class="queue-list">
                <div class="queue-item active">
                  <div class="queue-num">1</div>
                  <div class="member-avatar">MG</div>
                  <div style="flex:1"><div style="font-size:13px;font-weight: 500">En. Muthusamy</div><div style="font-size:11px;color:var(--c-text-3)">3 minit</div></div>
                </div>
                <div class="queue-item">
                  <div class="queue-num">2</div>
                  <div class="member-avatar">ZF</div>
                  <div style="flex:1"><div style="font-size:13px;font-weight: 500">Pn. Zaiton</div><div style="font-size:11px;color:var(--c-text-3)">Proksi aktif</div></div>
                </div>
                <div class="queue-item">
                  <div class="queue-num">3</div>
                  <div class="member-avatar">LC</div>
                  <div style="flex:1"><div style="font-size:13px;font-weight: 500">En. Lim CW</div><div style="font-size:11px;color:var(--c-text-3)">Baru daftar</div></div>
                </div>
                <div class="queue-item">
                  <div class="queue-num">4</div>
                  <div class="member-avatar">NH</div>
                  <div style="flex:1"><div style="font-size:13px;font-weight: 500">Cik Nurul Huda</div><div style="font-size:11px;color:var(--c-text-3)">Baru daftar</div></div>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-head">
                <div class="card-title">⚡ Butang Panik</div>
              </div>
              <div class="card-body" style="padding:14px">
                <button class="btn btn-danger btn-lg" style="width:100%; justify-content:center;">
                  <span style="font-size:18px">🆘</span>
                  <span>Saya Perlukan Bantuan</span>
                </button>
                <div class="text-3 text-xs" style="margin-top:8px;text-align:center">Pentadbir akan menelefon anda dalam 30 saat</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    $$(".layout-tab[data-layout]").forEach(el =>
      el.addEventListener("click", () => {
        state.selectedLayout = el.dataset.layout;
        renderHall();
        setActiveNav();
      })
    );

    // Live speaker timer (town-hall layout)
    let spkSecs = 252;
    safeInterval(() => {
      const t = $("#speaker-timer");
      if (!t) return;
      spkSecs++;
      t.textContent = `${Math.floor(spkSecs / 60).toString().padStart(2, "0")}:${(spkSecs % 60).toString().padStart(2, "0")}`;
    }, 1000);

    // Critical actions require confirmation (enterprise safety rail)
    safeAdd($("#hall-end-btn"), "click", () => {
      showConfirm({
        title: "Akhiri Mesyuarat?",
        message: "Semua sesi ahli akan ditamatkan dan minit akhir akan dimuktamadkan. Tindakan ini tidak boleh dibatalkan.",
        confirmLabel: "Ya, Akhiri Mesyuarat",
        danger: true,
        onConfirm: () => showToast("Mesyuarat ditamatkan. Minit akhir sedang dijana.", "success"),
      });
    });
    safeAdd($("#hall-close-vote"), "click", () => {
      showConfirm({
        title: "Tutup Undian M-001?",
        message: "313 daripada 403 ahli telah mengundi. Ahli yang belum mengundi tidak akan dapat mengundi selepas ini.",
        confirmLabel: "Tutup Undian",
        onConfirm: () => showToast("✅ Undian M-001 ditutup. Keputusan dimuktamadkan.", "success"),
      });
    });
    $$("[data-route]").forEach(b =>
      b.addEventListener("click", () => {
        navigate(b.dataset.route);
      })
);

    // Pagination
    $$("[data-motions-page]").forEach(b =>
      b.addEventListener("click", () => {
        const val = b.dataset.motionsPage;
        if (val === "prev") state.motionsPage = Math.max(1, state.motionsPage - 1);
        else if (val === "next") {
          const totalPages = Math.max(1, Math.ceil(D.motions.length / state.motionsPerPage));
          state.motionsPage = Math.min(totalPages, state.motionsPage + 1);
        }
        else state.motionsPage = parseInt(val, 10);
        renderMotions();
      })
    );
  }
  /* ============================================================
     VOTING
     ============================================================ */
  function renderVoting() {
    const main = $("#main");
    const seatCounts = { "Pengerusi": 1, "Naib Pengerusi": 1, "Ahli Lembaga": 6 };
    const selectedCount = state.selectedCandidates.size;

    const totalCandidatesPages = Math.max(1, Math.ceil(D.candidates.length / state.candidatesPerPage));
    state.candidatesPage = Math.max(1, Math.min(totalCandidatesPages, state.candidatesPage));
    const candidatesPage = state.candidatesPage;
    const candidatesStartIdx = (candidatesPage - 1) * state.candidatesPerPage;

    main.innerHTML = `
      <div class="fade-in">
        <div class="page-head">
          <div>
            <h1 class="page-title">E-Voting · Pilihan Raya Lembaga 2026-2029</h1>
            <div class="page-sub">${D.candidates.length} calon · Pilih sehingga 1 Pengerusi, 1 Naib, dan 6 Ahli Lembaga</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost">${ICONS.help}<span>Bagaimana Mengundi?</span></button>
          </div>
        </div>

        <div class="voting-progress">
          <div class="vp-info">
            <div class="vp-title">⏱️ Fasa Pengundian Aktif</div>
            <div class="vp-sub">${state.liveVotes.ya + state.liveVotes.tidak + state.liveVotes.abstain} daripada ${state.liveVotes.total} ahli berkuorum telah mengundi · Akan tutup pada 11:45</div>
          </div>
          <div class="vp-timer" id="vp-timer">12:48</div>
          <div class="flex gap-2">
            <button class="btn btn-success">${ICONS.check}<span>Hantar Undi</span></button>
          </div>
        </div>

        <div class="card mb-4">
          <div class="card-body">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px">
              <div style="display:flex;gap:14px;align-items:center">
                <div style="font-size:13px;color:var(--c-text-3);text-transform:uppercase;letter-spacing:0.5px;font-weight: 500">Tapis:</div>
                <div class="filter-chip active">Semua (8)</div>
                <div class="filter-chip">Pengerusi (1)</div>
                <div class="filter-chip">Naib Pengerusi (1)</div>
                <div class="filter-chip">Ahli Lembaga (6)</div>
                <div class="filter-chip">Zon PJ Utara</div>
              </div>
              <div class="search" style="min-width:200px;position:relative">
                ${ICONS.search}
                <input type="text" placeholder="Cari calon..." style="width:100%;padding:8px 12px 8px 34px;border:1px solid var(--c-border-strong);border-radius:8px">
              </div>
            </div>
          </div>
        </div>

        <div class="candidate-grid">
          ${D.candidates.map(c => {
            const sel = state.selectedCandidates.has(c.id);
            const pct = Math.round((c.votes / 350) * 100);
            return `
            <div class="candidate-card ${sel ? 'selected' : ''}" data-cid="${c.id}" role="checkbox" aria-checked="${sel}" tabindex="0">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div class="cc-avatar" style="background:${c.color}">${c.photo}</div>
                <div style="text-align:right">
                  <div class="cc-position">${c.position}</div>
                  <div style="font-size:11px;color:var(--c-text-3);margin-top:4px">Zon ${c.zone}</div>
                </div>
              </div>
              <div class="cc-name">${c.name}</div>
              <div class="cc-meta">${c.age} tahun · ${c.zone}</div>
              <div class="cc-manifesto">"${c.manifesto}"</div>
              <div class="cc-votes">
                <div class="cc-votes-row"><span>📊 ${c.votes} undi</span><span>${pct}% sokongan</span></div>
                <div class="cc-votes-bar"><div class="cc-votes-fill" style="width:${pct}%;background:${c.color}"></div></div>
              </div>
              <button class="btn cc-pick-btn ${sel ? 'picked' : ''}" aria-hidden="true" tabindex="-1">
                ${sel ? `${ICONS.check}<span>Dipilih</span>` : `<span>Pilih Calon</span>`}
              </button>
            </div>
          `;}).join("")}
        </div>

        <div class="vote-basket">
          <div style="width:54px;height:54px;border-radius:12px;background:var(--c-accent);color:var(--c-primary-700);display:grid;place-items:center;font-size:24px">🛒</div>
          <div class="vote-basket-info">
            <div class="vb-count">${selectedCount} calon dipilih</div>
            <div class="vb-sub">Pengerusi (${[...state.selectedCandidates].filter(c => D.candidates.find(x => x.id === c)?.position === 'Pengerusi').length}/1) · Naib (${[...state.selectedCandidates].filter(c => D.candidates.find(x => x.id === c)?.position === 'Naib Pengerusi').length}/1) · Ahli (${[...state.selectedCandidates].filter(c => D.candidates.find(x => x.id === c)?.position === 'Ahli Lembaga').length}/6)</div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-ghost" id="clear-basket">Kosongkan</button>
            <button class="btn btn-primary btn-lg" id="submit-ballot-btn" ${selectedCount === 0 ? 'disabled' : ''}>${ICONS.check}<span>Sah & Hantar</span></button>
          </div>
        </div>
      </div>
    `;

    const toggleCandidate = (c) => {
      const id = c.dataset.cid;
      if (state.selectedCandidates.has(id)) state.selectedCandidates.delete(id);
      else state.selectedCandidates.add(id);
      renderVoting();
    };
    $$(".candidate-card").forEach(c => {
      c.addEventListener("click", () => toggleCandidate(c));
      c.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCandidate(c); }
      });
    });
    $("#clear-basket")?.addEventListener("click", () => {
      state.selectedCandidates.clear();
      renderVoting();
    });
    $("#submit-ballot-btn")?.addEventListener("click", () => {
      const n = state.selectedCandidates.size;
      showConfirm({
        title: "Hantar Undi Anda?",
        message: `Anda memilih ${n} calon. Selepas dihantar, undi anda dimeterai secara kriptografi dan <b>tidak boleh diubah</b>.`,
        confirmLabel: "Ya, Hantar Undi",
        onConfirm: () => {
          showToast("✅ Undi anda telah dihantar & direkodkan dalam hash chain.", "success");
          state.selectedCandidates.clear();
          renderVoting();
        },
      });
    });

    // Countdown timer
    let secs = 768;
    safeInterval(() => {
      secs = Math.max(0, secs - 1);
      const t = $("#vp-timer");
      if (!t) return;
      const m = Math.floor(secs / 60).toString().padStart(2, "0");
      const s = (secs % 60).toString().padStart(2, "0");
      t.textContent = `${m}:${s}`;
    }, 1000);
  }

  /* ============================================================
     MOTIONS
     ============================================================ */
  function renderMotions() {
    const main = $("#main");
    const totalPages = Math.max(1, Math.ceil(D.motions.length / state.motionsPerPage));
    state.motionsPage = Math.max(1, Math.min(totalPages, state.motionsPage));
    const page = state.motionsPage;
    const startIdx = (page - 1) * state.motionsPerPage;
    main.innerHTML = `
      <div class="fade-in">
        <div class="page-head">
          <div>
            <h1 class="page-title">Usul & Resolusi</h1>
            <div class="page-sub">Enjin Rantaian Usul · ${D.motions.length} usul direkodkan · BRule-001 hingga BRule-005 dipantau</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost">${ICONS.download}<span>Eksport Minit</span></button>
            <button class="btn btn-primary">${ICONS.plus}<span>Cadang Usul</span></button>
          </div>
        </div>

        <div class="kpi-grid mb-4">
          ${kpiBox("Jumlah Usul", D.motions.length, "Tahun ini", "primary")}
          ${kpiBox("Diluluskan", D.motions.filter(m => m.status.includes('LULUS')).length, "Auto-dokumentasi", "success")}
          ${kpiBox("Sedang Diundi", D.motions.filter(m => m.status.includes('Diundi')).length, "Live sekarang", "warning")}
          ${kpiBox("Auto-Gugur", D.motions.filter(m => m.status.includes('Gagal')).length, "BRule-002/003", "info")}
        </div>

        ${D.motions.slice(startIdx, startIdx + state.motionsPerPage).map(m => {
          const total = m.votes ? (m.votes.ya + m.votes.tidak + m.votes.abstain) : 0;
          const yaPct = m.votes && total > 0 ? (m.votes.ya / total * 100) : 0;
          const tkPct = m.votes && total > 0 ? (m.votes.tidak / total * 100) : 0;
          const abPct = m.votes && total > 0 ? (m.votes.abstain / total * 100) : 0;
          const statusClass = m.status.includes('LULUS') ? 'passed' : m.status.includes('Gagal') ? 'failed' : m.status.includes('Diundi') ? 'active' : '';
          return `
            <div class="motion-card ${statusClass}">
              <div class="flex items-start justify-between gap-4">
                <div style="flex:1">
                  <div class="flex items-center gap-3 mb-2">
                    <span class="motion-id">${m.id}</span>
                    <span class="badge ${m.status.includes('LULUS') ? 'success' : m.status.includes('Gagal') ? 'danger' : m.status.includes('Diundi') ? 'warning' : 'info'}">${m.status}</span>
                    <span class="badge">${m.type}</span>
                  </div>
                  <div class="motion-title">${m.title}</div>
                  <div class="motion-people">
                    <div class="mp-item"><span class="mp-label">📝 Pencadang:</span><span class="mp-val">${m.proposer}</span></div>
                    <div class="mp-item"><span class="mp-label">✓ Penyokong:</span><span class="mp-val">${m.seconder || '<span class="text-danger">Tiada</span>'}</span></div>
                    <div class="mp-item"><span class="mp-label">⏱️ Dicadang:</span><span class="mp-val">${m.proposedAt}</span></div>
                  </div>
                  ${m.votes ? `
                    <div class="motion-vote-bar">
                      <div class="seg-ya" style="width:${yaPct}%">${m.votes.ya} YA (${Math.round(yaPct)}%)</div>
                      <div class="seg-tidak" style="width:${tkPct}%">${m.votes.tidak}</div>
                      <div class="seg-abstain" style="width:${abPct}%">${m.votes.abstain}</div>
                    </div>
                  ` : ''}
                  ${m.discussion.length > 0 ? `
                    <div class="discussion-list">
                      ${m.discussion.map(d => `
                        <div class="discussion-msg">
                          <div class="dmsg-head">
                            <span style="color:var(--c-primary)">${d.name}</span>
                            <span class="ts">${d.at}</span>
                          </div>
                          <div>${d.text}</div>
                        </div>
                      `).join("")}
                    </div>
                  ` : ''}
                </div>
                <div class="flex gap-2" style="flex-shrink:0">
                  ${m.status.includes('Diundi') ? `
                    <button class="btn btn-success">${ICONS.check}<span>Tutup</span></button>
                  ` : ''}
                  <button class="btn btn-ghost">${ICONS.screen}</button>
                </div>
              </div>
            </div>
          `;
        }).join("")}

        ${page > 1 ? `
        <div class="card-foot flex items-center justify-between text-sm mt-4">
          <div class="text-3">Paparan ${startIdx + 1}-${Math.min(startIdx + state.motionsPerPage, D.motions.length)} daripada ${D.motions.length} usul</div>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-ghost" data-motions-page="prev" ${state.motionsPage <= 1 ? 'disabled' : ''}>Sebelum</button>
            ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p =>
              `<button class="btn btn-sm ${p === state.motionsPage ? 'btn-primary' : 'btn-ghost'}" data-motions-page="${p}">${p}</button>`
            ).join("\n            ")}
            <button class="btn btn-sm btn-ghost" data-motions-page="next" ${state.motionsPage >= totalPages ? 'disabled' : ''}>Seterus</button>
          </div>
        </div>
        ` : ''}

        ${page > 1 ? '' : `
        <div class="card mt-6">
          <div class="card-head flex items-center justify-between">
            <div class="card-title">${ICONS.sparkle} AI Minute Writer — Draf Minit Mesyuarat</div>
            <span class="badge info">Sedang dijana · 68% siap</span>
          </div>

          <div class="card-foot flex items-center justify-between text-sm mt-2">
            <div class="text-3">Paparan ${startIdx + 1}-${Math.min(startIdx + state.motionsPerPage, D.motions.length)} daripada ${D.motions.length} usul</div>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-ghost" data-motions-page="prev" ${state.motionsPage <= 1 ? 'disabled' : ''}>Sebelum</button>
              ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p =>
                `<button class="btn btn-sm ${p === state.motionsPage ? 'btn-primary' : 'btn-ghost'}" data-motions-page="${p}">${p}</button>`
              ).join("\n              ")}
              <button class="btn btn-sm btn-ghost" data-motions-page="next" ${state.motionsPage >= totalPages ? 'disabled' : ''}>Seterus</button>
            </div>
          </div>

          <div class="card-body">
            <div style="background:var(--c-surface-2);padding:16px;border-radius:8px;font-family:'SF Mono',monospace;font-size:13px;line-height:1.7">
              <div style="font-weight:700;color:var(--c-primary)">MINIT MESYUARAT AGUNG TAHUNAN KE-16</div>
              <div style="margin:8px 0">Tarikh: 23 Jun 2026 · Masa: 09:04 – (berlangsung) · Tempat: Dewan Korporat KOPEMAJU</div>
              <hr class="divider">
              <div><b>AG-01:</b> Mesyuarat dipengerusikan oleh Dato' Ariffin Bin Kassim (Pengerusi).</div>
              <div><b>AG-02:</b> Kuorum disahkan — 403 daripada 1,284 ahli hadir (31.4%) — melepasi syarat minimum UUK 25%.</div>
              <div><b>AG-03:</b> Minit AGM Ke-15 disahkan tanpa pindaan oleh En. Vijay Kumar dan disokong Pn. Wong Soke Yen.</div>
              <div><b>AG-04:</b> Penyata Kewangan TK 2025 dibentang — Hasil RM 12.84J, Untung RM 1.42J, Dividen 8% dicadangkan.</div>
              <div><b>M-002:</b> Pelantikan Juruaudit Luar — LULUS (381 YA, 12 TIDAK, 8 KOSONG).</div>
              <div><b>M-003:</b> Pindaan UUK 7.3 — GAGAL (tiada Penyokong dalam 15 minit, BRule-003 dipicu).</div>
              <div><b>AG-06:</b> <span style="background:#FEF3C8;padding:2px 6px;border-radius:4px">Sedang berlangsung — M-001 pembahagian dividen sedang diundi.</span></div>
            </div>
            <div class="flex gap-2 mt-3">
              <button class="btn btn-primary">${ICONS.check}<span>Sah & Tandatangan Digital</span></button>
              <button class="btn btn-ghost">${ICONS.download}<span>Eksport PDF</span></button>
              <button class="btn btn-ghost">${ICONS.sparkle}<span>Perbaiki dengan AI</span></button>
            </div>
          </div>
        </div>
        `}
      </div>
    `;
  }

  /* ============================================================
     COPILOT
     ============================================================ */
  function renderCopilot() {
    const main = $("#main");
    const agents = [
      { id: "chairman", cls: "c1", icon: ICONS.mic, title: "AI Chairman & Moderator", sub: "Peringatan prosedur proaktif" },
      { id: "secretary", cls: "c2", icon: ICONS.motions, title: "AI Secretary & Minute Writer", sub: "Speech-to-text & auto-minit" },
      { id: "compliance", cls: "c3", icon: ICONS.shield, title: "AI Compliance & Legal", sub: "Akta Koperasi 1993 + GP14" },
      { id: "organizer", cls: "c4", icon: ICONS.ai, title: "AI Question Organizer", sub: "Satukan soalan berulang" },
    ];

    main.innerHTML = `
      <div class="fade-in">
        <div class="page-head">
          <div>
            <h1 class="page-title">AI Governance Copilot</h1>
            <div class="page-sub">Multi-ejen pintar · RAG diindeks dengan ${D.auditLog.length}+ rekod · ${ICONS.sparkle}Powered by AGMX AI Engine</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost">${ICONS.upload}<span>Upload Dokumen</span></button>
            <button class="btn btn-primary">${ICONS.plus}<span>Ejen Baru</span></button>
          </div>
        </div>

        <div class="copilot-shell">
          <div class="copilot-side">
            <div style="font-size:11px;color:var(--c-text-3);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;padding:0 4px 8px">Ejen Aktif</div>
            ${agents.map(a => `
              <div class="copilot-agent ${state.copilotAgent === a.id ? 'active' : ''}" data-agent="${a.id}">
                <div class="ca-icon ${a.cls}">${a.icon}</div>
                <div class="ca-text">
                  <div class="t1">${a.title}</div>
                  <div class="t2">${a.sub}</div>
                </div>
              </div>
            `).join("")}
            <div style="font-size:11px;color:var(--c-text-3);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;padding:14px 4px 8px">Status Sistem</div>
            <div style="background:var(--c-success-100);padding:10px;border-radius:8px;font-size:12px;color:#047857">
              ✅ RAG Indeks: 1,247 dokumen
            </div>
            <div style="background:var(--c-primary-100);padding:10px;border-radius:8px;font-size:12px;color:var(--c-primary);margin-top:6px">
              🧠 Model: GPT-4 + Custom Embedding
            </div>
            <div style="background:var(--c-warning-100);padding:10px;border-radius:8px;font-size:12px;color:#92400E;margin-top:6px">
              ⚡ Latency: 142ms avg
            </div>
          </div>

          <div class="copilot-chat">
            <div class="copilot-head">
              <div class="ch-avatar">${ICONS.sparkle}</div>
              <div style="flex:1">
                <div class="ch-name">${(agents.find(a => a.id === state.copilotAgent) || agents[0]).title}</div>
                <div class="ch-sub">${(agents.find(a => a.id === state.copilotAgent) || agents[0]).sub} · Aktif sekarang</div>
              </div>
              <span class="badge success"><span class="dot"></span> Dalam Talian</span>
            </div>

            <div class="chat-stream" id="chat-stream">
              <div class="chat-msg ai">
                <div class="av">${ICONS.sparkle}</div>
                <div class="bubble-wrap">
                  <div class="bubble">
                    Selamat sejahtera Pn. Aishah 👋 Saya ${(agents.find(a => a.id === state.copilotAgent) || agents[0]).title}. Saya boleh membantu dengan analisis kewangan, semakan pematuhan, dan ringkasan minit mesyuarat. Ada apa yang ingin saya bantu?
                  </div>
                  <div class="msg-time">11:38</div>
                </div>
              </div>

              <div class="chat-msg user">
                <div class="av">AR</div>
                <div class="bubble-wrap">
                  <div class="bubble">Berapa dividen tahun lepas berbanding tahun ini?</div>
                  <div class="msg-time">11:39 · Dibaca ✓✓</div>
                </div>
              </div>

              <div class="chat-msg ai">
                <div class="av">${ICONS.sparkle}</div>
                <div class="bubble">
                  <div><b>Perbandingan Dividen KOPEMAJU (TK 2024 vs TK 2025):</b></div>
                  <div style="margin-top:8px">
                    <table style="width:100%; border-collapse: collapse; font-size:13px">
                      <tr style="border-bottom:1px solid var(--c-divider)">
                        <td style="padding:6px 0"><b>TK 2024</b></td>
                        <td>10%</td>
                        <td>(RM 1.10J daripada lebih surplus RM 1.10J)</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0"><b>TK 2025</b></td>
                        <td><b style="color:var(--c-accent-ink)">8% (dicadangkan)</b></td>
                        <td>(RM 1.14J daripada lebih surplus RM 1.42J)</td>
                      </tr>
                    </table>
                  </div>
                  <div style="margin-top:10px">Walaupun kadar lebih rendah, jumlah dividen diagih lebih tinggi (+3.6%) kerana lebih surplus meningkat 29%.</div>
                  <div class="citation">
                    <span class="cite-label">📄 Sumber:</span>
                    Penyata Kewangan 2025 (M/S 14, Para 3.2)
                    <span class="cite-page">/dokumen/fy2025-financial.pdf</span>
                  </div>
                </div>
              </div>

              <div class="chat-msg user">
                <div class="av">AR</div>
                <div class="bubble-wrap">
                  <div class="bubble">Adakah ini melanggar UUK?</div>
                  <div class="msg-time">11:40 · Dibaca ✓✓</div>
                </div>
              </div>

              <div class="chat-msg ai">
                <div class="av">${ICONS.sparkle}</div>
                <div class="bubble">
                  ✅ <b>Tidak melanggar.</b> Semakan AI Compliance:<br>
                  • UUK Klausa 8.1: Dividen minimum 5% — <b>PATUH</b> (8% > 5%)<br>
                  • Akta Koperasi 1993 Sec 22(3): Lebih surplus diagih — <b>PATUH</b><br>
                  • GP14B: Sekurang-kurangnya 20% lebih surplus dikekalkan — <b>PATUH</b> (RM 280K dikekalkan)
                  <div class="citation">
                    <span class="cite-label">⚖️ Rujukan:</span> Akta Koperasi 1993, Garis Panduan 14B, Klausa 8.1 UUK KOPEMAJU
                  </div>
                </div>
              </div>

              <div class="chat-msg ai">
                <div class="av">${ICONS.sparkle}</div>
                <div class="bubble-wrap">
                  <div class="bubble">
                    <div class="fin-chart">
                      <div class="fc-title">Auto-jana: Trend Untung Bersih 5 Tahun</div>
                      ${finChartSvg()}
                    </div>
                  </div>
                  <div class="msg-time">11:41</div>
                </div>
              </div>

              <div class="chat-msg ai">
                <div class="av">${ICONS.sparkle}</div>
                <div class="bubble typing" aria-label="AI sedang menaip">
                  <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
                </div>
              </div>
            </div>

            <div class="chat-suggestions">
              <div class="suggestion-chip">📊 Ringkaskan Penyata Kewangan</div>
              <div class="suggestion-chip">⚖️ Semak pematuhan UUK</div>
              <div class="suggestion-chip">📝 Jana draf minit</div>
              <div class="suggestion-chip">🔍 Cari resolusi AGM Ke-15</div>
            </div>

            <div class="chat-input">
              <input type="text" placeholder="Tanya soalan tentang AGM, kewangan atau pematuhan...">
              <button class="send">${ICONS.send}</button>
            </div>
          </div>
        </div>

        <div class="kpi-grid mt-4">
          ${kpiBox("Soalan Dijawab", 142, "+27 hari ini", "primary")}
          ${kpiBox("Dokumen Diindeks", 1247, "RAG siap carian", "success")}
          ${kpiBox("Draf Minit", 4, "AI jana automatik", "info")}
          ${kpiBox("Alert Pematuhan", 2, "Auto-block tindakan", "warning")}
        </div>

        <div class="card mt-4">
          <div class="card-head">
            <div class="card-title">${ICONS.sparkle} AI Action Tracker — Tugas Pasca-AGM</div>
            <span class="badge success">3 tugasan aktif</span>
          </div>
          <div class="card-body">
            ${D.actions.map(a => {
              const meta = a.status === 'Selesai'
                ? { pct: 100, icon: '✅', prio: 'Selesai', prioCls: 'success', bar: 'var(--c-success)' }
                : a.status === 'Dalam Tindakan'
                ? { pct: 55, icon: '⏳', prio: 'Keutamaan Tinggi', prioCls: 'warning', bar: 'var(--c-warning)' }
                : { pct: 0, icon: '📌', prio: 'Belum Bermula', prioCls: 'info', bar: 'var(--c-border-strong)' };
              return `
              <div class="action-tracker-card ${a.status === 'Selesai' ? 'is-done' : a.status === 'Dalam Tindakan' ? 'is-inprog' : ''}">
                <div class="at-status-icon ${a.status === 'Selesai' ? 'done' : a.status === 'Dalam Tindakan' ? 'inprog' : 'todo'}" style="font-size:17px">
                  ${meta.icon}
                </div>
                <div class="at-info">
                  <div class="at-title">${a.title}</div>
                  <div class="at-meta">
                    <span>📅 ${a.due}</span>
                    <span>👤 ${a.pic}</span>
                    <span>📋 ${a.fromMotion}</span>
                  </div>
                  <div class="at-progress">
                    <div class="at-progress-bar"><div class="at-progress-fill" style="width:${meta.pct}%;background:${meta.bar}"></div></div>
                    <span class="at-progress-pct">${meta.pct}%</span>
                  </div>
                </div>
                <span class="badge ${meta.prioCls}">${meta.prio}</span>
              </div>
            `;}).join("")}
          </div>
        </div>
      </div>
    `;

    $$("[data-agent]").forEach(el =>
      el.addEventListener("click", () => {
        state.copilotAgent = el.dataset.agent;
        renderCopilot();
      })
    );
  }

  /* ============================================================
     COMPLIANCE
     ============================================================ */
  function renderCompliance() {
    const main = $("#main");
    main.innerHTML = `
      <div class="fade-in">
        <div class="page-head">
          <div>
            <h1 class="page-title">Pematuhan SKM & Akta Koperasi</h1>
            <div class="page-sub">Enjin Compliance-by-Design · Akta Koperasi 1993 · GP14 · GP14B · UUK ${D.cooperative.uukRef}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost">${ICONS.download}<span>Laporan Pematuhan</span></button>
            <button class="btn btn-primary">${ICONS.shield}<span>Jana Audit SKM</span></button>
          </div>
        </div>

        <div class="warning-banner" role="alert">
          <div class="wb-icon">${ICONS.alert}</div>
          <div class="wb-text">
            <div class="wb-title">1 Amaran Aktif — UUK 7.3: Tempoh Perbahasan</div>
            <div class="wb-sub">1 usul (M-001) melebihi had 15 minit perbahasan. Tindakan pengerusi diperlukan.</div>
          </div>
          <button class="btn btn-sm wb-action">Lihat Butiran</button>
        </div>

        <div class="compliance-shell">
          <div>
            <div class="card">
              <div class="compliance-gauge">
                <div class="gauge-circle">
                  <svg viewBox="0 0 180 180" style="width:100%;height:100%">
                    <defs>
                      <linearGradient id="compG" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#10B981"/>
                        <stop offset="100%" stop-color="#0B5394"/>
                      </linearGradient>
                    </defs>
                    <circle cx="90" cy="90" r="75" fill="none" stroke="#E5E9F0" stroke-width="14"/>
                    <circle cx="90" cy="90" r="75" fill="none" stroke="url(#compG)" stroke-width="14"
                      stroke-dasharray="${(98/100)*471} 471" stroke-linecap="round"
                      transform="rotate(-90 90 90)"/>
                    <text x="90" y="90" text-anchor="middle" dominant-baseline="central"
                      font-size="38" font-weight="800" fill="#0B5394">${D.compliance.score}</text>
                    <text x="90" y="115" text-anchor="middle" font-size="11" fill="#94A3B8">/ 100</text>
                  </svg>
                </div>
                <div class="gauge-value">98</div>
                <div class="gauge-label">Skor Digital Governance · PATUH TINGGI</div>
                <div class="gauge-trend up" title="Berbanding audit lepas">↑ +3 mata dari audit lepas (95)</div>
                <div style="margin-top:12px;display:flex;justify-content:center;gap:8px">
                  <span class="badge success"><span class="dot"></span>5 Patuh</span>
                  <span class="badge warning"><span class="dot"></span>1 Amaran</span>
                </div>
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-head">
                <div class="card-title">Statistik Pematuhan</div>
              </div>
              <div class="card-body">
                ${[
                  { label: "Notis AGM Dihantar", val: "21 hari lebih awal", pct: 100, color: "#10B981" },
                  { label: "Kelayakan Undi", val: "Auto-tapis", pct: 100, color: "#10B981" },
                  { label: "Kuorum Dipantau", val: "31.4% > 25%", pct: 100, color: "#10B981" },
                  { label: "Pencadang & Penyokong", val: "BRule-002/003", pct: 92, color: "#10B981" },
                  { label: "Tempoh Perbahasan", val: "1 usul > 15 minit", pct: 80, color: "#F59E0B" },
                  { label: "Audit Hash Chain", val: "100% immutabel", pct: 100, color: "#10B981" },
                ].map(s => `
                  <div style="margin-bottom:14px">
                    <div class="flex justify-between" style="font-size:13px;margin-bottom:6px">
                      <span style="font-weight: 500">${s.label}</span>
                      <span class="text-3">${s.val}</span>
                    </div>
                    <div style="background:#EEF1F6;border-radius:6px;overflow:hidden;height:8px">
                      <div style="height:100%;width:${s.pct}%;background:${s.color};border-radius:6px"></div>
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>

          <div>
            <div class="card">
              <div class="card-head">
                <div class="card-title">Matriks Peraturan Perniagaan</div>
                <div style="display:flex;gap:6px;align-items:center">
                  <div class="filter-chip ${state.complianceFilter === 'all' ? 'active' : ''}" data-cfilter="all">Semua (${D.compliance.aktaChips.length})</div>
                  <div class="filter-chip ${state.complianceFilter === 'PATUH' ? 'active' : ''}" data-cfilter="PATUH">✓ Patuh (${D.compliance.aktaChips.filter(r => r.status === 'PATUH').length})</div>
                  <div class="filter-chip ${state.complianceFilter === 'AMARAN' ? 'active' : ''}" data-cfilter="AMARAN">⚠ Amaran (${D.compliance.aktaChips.filter(r => r.status === 'AMARAN').length})</div>
                </div>
              </div>
              <div class="card-body">
                <div class="rule-list compact">
                  ${D.compliance.aktaChips.filter(r => state.complianceFilter === 'all' || r.status === state.complianceFilter).map(r => `
                    <div class="rule-row ${r.status === 'PATUH' ? 'pass' : r.status === 'AMARAN' ? 'warn' : 'fail'}">
                      <div class="rule-icon">
                        ${r.status === 'PATUH' ? ICONS.check : r.status === 'AMARAN' ? ICONS.alert : ICONS.x}
                      </div>
                      <div class="rule-info">
                        <div style="display:flex;align-items:center;gap:8px">
                          <span class="r-ref">${r.id}</span>
                          <span class="r1">${r.label}</span>
                        </div>
                        <div class="r2">${r.evidence}</div>
                      </div>
                      <span class="badge ${r.status === 'PATUH' ? 'success' : 'warning'}">${r.status}</span>
                    </div>
                  `).join("")}
                </div>
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-head">
                <div class="card-title">Business Rules Engine (BRule)</div>
              </div>
              <div class="card-body">
                ${[
                  { id: "BRule-001", label: "Kuorum minimum tidak tercapai", trigger: "Butang Start Meeting dinyahaktifkan", status: "Aktif" },
                  { id: "BRule-002", label: "Usul tiada Pencadang", trigger: "Sesi Open Discussion disekat", status: "Aktif" },
                  { id: "BRule-003", label: "Tiada Penyokong dalam 15 min", trigger: "Auto-gugur + rekod minit", status: "Aktif" },
                  { id: "BRule-004", label: "Notis AGM < 15 hari", trigger: "Sekat terbitan notis", status: "Aktif" },
                  { id: "BRule-005", label: "Ahli Tunggakan mengundi", trigger: "Akses undian disekat", status: "Aktif" },
                ].map(r => `
                  <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--c-divider)">
                    <span class="badge info" style="font-family:monospace">${r.id}</span>
                    <div style="flex:1">
                      <div style="font-size:13px;font-weight:700">${r.label}</div>
                      <div style="font-size:11.5px;color:var(--c-text-3);margin-top:2px">${r.trigger}</div>
                    </div>
                    <span class="badge success"><span class="dot"></span> ${r.status}</span>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    $$("[data-cfilter]").forEach(c =>
      c.addEventListener("click", () => {
        state.complianceFilter = c.dataset.cfilter;
        renderCompliance();
      })
    );
  }

  /* ============================================================
     VAULT
     ============================================================ */
  function renderVault() {
    const main = $("#main");
    main.innerHTML = `
      <div class="fade-in">
        <div class="page-head">
          <div>
            <h1 class="page-title">Digital Governance Vault</h1>
            <div class="page-sub">Lejar Kalis Ubah · Immutable Hash Chain · 7,891 blok direkodkan sejak 2010</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost">${ICONS.download}<span>Eksport untuk SKM</span></button>
            <button class="btn btn-primary">${ICONS.shield}<span>Verifikasi Integriti</span></button>
          </div>
        </div>

        <div class="kpi-grid mb-4">
          ${kpiBox("Blok Disimpan", 7891, "Rantaian tidak boleh diubah", "primary")}
          ${kpiBox("Integriti Chain", "100%", "Disahkan secara berkriptografi", "success")}
          ${kpiBox("Penyulitan", "AES-256 + TLS 1.3", "Zero Trust enforced", "info")}
          ${kpiBox("Backup Lokasi", 3, "Geo-redundan aktif", "warning")}
        </div>

        <div class="audit-shell">
          <div class="card">
            <div class="toolbar">
              <div class="search" style="position:relative;flex:1">
                ${ICONS.search}
                <input type="text" placeholder="Cari ID ahli, hash, atau tindakan...">
              </div>
              <div class="filter-chip active">Semua</div>
              <div class="filter-chip">Undi</div>
              <div class="filter-chip">Usul</div>
              <div class="filter-chip">Sistem</div>
              <button class="btn btn-sm btn-ghost">${ICONS.download}<span>Eksport</span></button>
            </div>
            <div class="audit-list">
              <div class="audit-row audit-head">
                <div>Cap Masa</div>
                <div>Aktor</div>
                <div>Tindakan</div>
                <div>Hash (Truncated)</div>
                <div>Tanda</div>
              </div>
              ${D.auditLog.slice(0, state.vaultLogLimit).map(r => `
                <div class="audit-row">
                  <div>${r.ts}</div>
                  <div>${r.actor}</div>
                  <div><span class="audit-action ${r.action.includes('VOTE') ? 'vote' : r.action.includes('MOTION') ? 'motion' : r.action.includes('START') ? 'start' : 'stage'}">${r.action}</span> — ${r.detail}</div>
                  <div><span class="hash-link">${r.hash}</span></div>
                  <div style="color:#10B981">${r.sig}</div>
                </div>
              `).join("")}
            </div>
            <div class="card-foot" style="display:flex;align-items:center;justify-content:space-between;gap:12px">
              <span class="text-sm text-3">Paparan ${Math.min(state.vaultLogLimit, D.auditLog.length)} rekod terkini · 7,891 dalam arkib</span>
              ${state.vaultLogLimit < D.auditLog.length
                ? `<button class="btn btn-sm btn-ghost" id="vault-load-more">Muat Lagi ↓</button>`
                : `<button class="btn btn-sm btn-ghost" id="vault-archive-btn">Buka Arkib Penuh →</button>`}
            </div>
          </div>

          <div>
            <div class="chain-viz">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                <div style="font-weight:700">🔗 Rantaian Hash</div>
                <span class="badge info">7,891 blok</span>
              </div>
              ${[
                { num: 7891, hash: "0x9f4ab3e1c7d2f8a604519e2b8c2", action: "VOTE_CAST · M-001 · YA", time: "11:42:18" },
                { num: 7890, hash: "0x9f4ab3e1c7d2f8a604519e2b8c1", action: "VOTE_CAST · M-001 · TIDAK", time: "11:42:17" },
                { num: 7889, hash: "0x9f4ab3e1c7d2f8a604519e2b8bf", action: "VOTE_CAST · M-001 · YA", time: "11:42:16" },
              ].map(b => `
                <div class="chain-block has-hash-tip" tabindex="0">
                  <div class="flex items-center gap-2">
                    <span class="cb-num">#${b.num}</span>
                    <span class="cb-time">${b.time}</span>
                    <span style="margin-left:auto;font-size:10px;background:var(--c-success-100);color:#047857;padding:2px 6px;border-radius:4px">✓ Verified</span>
                  </div>
                  <div style="font-weight: 500;font-size:12px;margin-top:6px">${b.action}</div>
                  <div class="cb-hash-hint">🔍 Tuding untuk hash</div>
                  <div class="hash-tooltip">hash: ${b.hash}</div>
                </div>
              `).join("")}
              <div class="chain-more">+ 7,888 blok terdahulu · semua disahkan ✓</div>
              <button class="btn btn-primary btn-lg" id="verify-chain-btn" style="width:100%;justify-content:center;margin-top:14px">
                ${ICONS.shield}<span>Verifikasi Integriti Sekarang</span>
              </button>
              <div class="chain-verified">
                ✅ Verifikasi terakhir: 11:42:18 (SHA-256)
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-head">
                <div class="card-title">🛡️ Zero Trust Security</div>
              </div>
              <div class="card-body" style="font-size:13px">
                ${[
                  { icon: "🔐", label: "MFA + Passkey", val: "Aktif untuk semua peranan" },
                  { icon: "🔒", label: "AES-256 Encryption", val: "Data in-transit & at-rest" },
                  { icon: "🚫", label: "Anti-Bot + CAPTCHA", val: "Cloudflare WAF aktif" },
                  { icon: "📍", label: "Geo Blocking", val: "Malaysia + ASEAN sahaja" },
                  { icon: "🆔", label: "Device Binding", val: "Session fingerprint enforced" },
                  { icon: "🕵️", label: "Fraud Detection", val: "Live monitoring aktif" },
                ].map(s => `
                  <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--c-divider)">
                    <span style="font-size:20px">${s.icon}</span>
                    <div style="flex:1">
                      <div style="font-weight: 500;font-size:13px">${s.label}</div>
                      <div style="font-size:11.5px;color:var(--c-text-3)">${s.val}</div>
                    </div>
                    <span class="badge success"><span class="dot"></span> AKTIF</span>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    $("#vault-load-more")?.addEventListener("click", () => {
      state.vaultLogLimit += 5;
      renderVault();
    });
    $("#verify-chain-btn")?.addEventListener("click", () => {
      const btn = $("#verify-chain-btn");
      btn.innerHTML = `<span>⏳ Menyemak 7,891 blok...</span>`;
      setTimeout(() => {
        btn.innerHTML = `<span>✅ Integriti 100% Disahkan</span>`;
        showToast("✅ Verifikasi selesai: 7,891/7,891 blok sah (SHA-256)");
      }, 1400);
    });
  }

  /* ============================================================
     SETTINGS
     ============================================================ */
  function renderSettings() {
    const main = $("#main");
    main.innerHTML = `
      <div class="fade-in">
        <div class="page-head">
          <div>
            <h1 class="page-title">Tetapan & Aksesibiliti</h1>
            <div class="page-sub">Senior Friendly Mode · Bahasa · Tema · Premium</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:20px">
          <div class="card">
            <div class="card-head">
              <div class="card-title">🧓 Senior Friendly Mode</div>
              <label style="position:relative;display:inline-block;width:48px;height:26px">
                <input type="checkbox" id="senior-switch" ${state.seniorMode ? 'checked' : ''} style="opacity:0;width:0;height:0">
                <span style="position:absolute;cursor:pointer;inset:0;background:${state.seniorMode ? 'var(--c-primary)' : '#CBD2DD'};border-radius:26px;transition:0.2s"></span>
                <span style="position:absolute;cursor:pointer;height:20px;width:20px;left:${state.seniorMode ? '24px' : '3px'};top:3px;background:#fff;border-radius:50%;transition:0.2s"></span>
              </label>
            </div>
            <div class="card-body">
              <p class="text-2 text-sm">Aktifkan paparan mesra warga emas dengan butang besar (60-80px), teks lebih besar, kontras tinggi, dan navigasi ringkas (One Screen, One Action).</p>
              <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
                <span class="badge info">Saiz butang: 60-80px</span>
                <span class="badge info">Teks: +20%</span>
                <span class="badge info">Menu: ≤5 item</span>
                <span class="badge info">Butang Panik</span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <div class="card-title">🎨 Tema Paparan</div>
            </div>
            <div class="card-body">
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
                ${["default", "hc", "dark"].map(t => `
                  <div class="role-pick-card ${state.theme === t ? 'active' : ''}" data-theme="${t}">
                    <div style="width:60px;height:40px;border-radius:6px;margin:0 auto 8px;${t === 'default' ? 'background:linear-gradient(135deg,#F5F7FB,#0B5394)' : t === 'hc' ? 'background:#fff;border:2px solid #000' : 'background:linear-gradient(135deg,#0F172A,#1E293B)'}"></div>
                    <div style="font-weight:700">${t === 'default' ? 'Lalai' : t === 'hc' ? 'Kontras Tinggi' : 'Gelap'}</div>
                    <div class="text-3 text-xs">${t === 'default' ? 'Standard' : t === 'hc' ? 'Aksesibiliti' : 'Malam'}</div>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <div class="card-title">🌐 Bahasa & Locale</div>
            </div>
            <div class="card-body">
              <div class="label">Bahasa Antaramuka</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
                ${D.languages.map((l, i) => `
                  <div class="filter-chip ${i === 0 ? 'active' : ''}">${l}</div>
                `).join("")}
              </div>
              <div class="label">Auto-Translate Caption</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <span class="badge success"><span class="dot"></span>BM → EN Aktif</span>
                <span class="badge success"><span class="dot"></span>BM → TA Aktif</span>
                <span class="badge success"><span class="dot"></span>BM → ID Aktif</span>
                <span class="badge success"><span class="dot"></span>BM → 中文 Aktif</span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <div class="card-title">💎 Langganan SaaS</div>
            </div>
            <div class="card-body">
              <div style="background:linear-gradient(135deg, var(--c-primary), var(--c-info));color:#fff;padding:16px;border-radius:10px;margin-bottom:12px">
                <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.8">Pelan Aktif</div>
                <div style="font-size:22px;font-weight: 700;margin:4px 0">Enterprise</div>
                <div style="font-size:13px;opacity:0.9">RM 2,500 / tahun · sehingga 1,000 ahli</div>
              </div>
              <table class="table" style="font-size:12.5px">
                <tr><td>Ahli digunakan</td><td class="text-bold">1,284 / 1,000 ⚠️</td></tr>
                <tr><td>Pembaharuan</td><td>31 Dis 2026</td></tr>
                <tr><td>Cloud</td><td>SaaS Multi-Tenant</td></tr>
                <tr><td>White Label</td><td>Tidak aktif</td></tr>
              </table>
              <button class="btn btn-primary mt-3" style="width:100%; justify-content:center">⬆️ Naik Taraf ke Platinum</button>
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <div class="card-title">📱 Peranti Aktif</div>
            </div>
            <div class="card-body">
              ${[
                { device: "iPhone 15 Pro · Aishah", loc: "Petaling Jaya", time: "Sekarang", current: true },
                { device: "MacBook Pro · Setiausaha", loc: "Petaling Jaya", time: "Sekarang", current: true },
                { device: "Samsung Galaxy · Pengerusi", loc: "Shah Alam", time: "2 jam lalu" },
              ].map(d => `
                <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--c-divider)">
                  <div style="width:38px;height:38px;background:var(--c-primary-100);color:var(--c-primary);border-radius:8px;display:grid;place-items:center;font-size:18px">${d.device.includes('iPhone') || d.device.includes('Samsung') ? '📱' : '💻'}</div>
                  <div style="flex:1">
                    <div style="font-weight: 500;font-size:13px">${d.device}</div>
                    <div style="font-size:11.5px;color:var(--c-text-3)">📍 ${d.loc} · ${d.time}</div>
                  </div>
                  ${d.current ? '<span class="badge success"><span class="dot"></span> Aktif</span>' : '<button class="btn btn-sm btn-ghost">Log Keluar</button>'}
                </div>
              `).join("")}
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <div class="card-title">🔌 Integrasi & API</div>
            </div>
            <div class="card-body">
              ${[
                { name: "SKM Compliance API", status: "Connected", icon: "🛡️" },
                { name: "WhatsApp Business", status: "Connected", icon: "💬" },
                { name: "SMS Gateway (Twilio)", status: "Connected", icon: "📨" },
                { name: "Payment Gateway", status: "Belum disambungkan", icon: "💳" },
                { name: "eWallet Coopera", status: "Beta", icon: "👛" },
              ].map(i => `
                <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--c-divider)">
                  <div style="font-size:24px">${i.icon}</div>
                  <div style="flex:1">
                    <div style="font-weight: 500;font-size:13.5px">${i.name}</div>
                  </div>
                  <span class="badge ${i.status === 'Connected' ? 'success' : i.status === 'Beta' ? 'info' : 'warning'}">${i.status}</span>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      </div>
    `;

    $("#senior-switch")?.addEventListener("change", (e) => {
      state.seniorMode = e.target.checked;
      document.body.classList.toggle("senior-mode", state.seniorMode);
    });
    $$("[data-theme]").forEach(t =>
      t.addEventListener("click", () => {
        applyTheme(t.dataset.theme);
        renderSettings();
      })
    );
  }

  /* ============================================================
     DROPDOWNS (Notifications, Profile, Search)
     ============================================================ */
  function renderDropdowns() {
    // Remove existing dropdowns
    ["notif-panel", "profile-menu", "search-overlay"].forEach(id => {
      const old = document.getElementById(id);
      if (old) old.remove();
    });

    if (state.notifOpen) renderNotifications();
    if (state.profileOpen) renderProfileMenu();
    if (state.searchOpen) renderSearchOverlay();
  }

  function renderNotifications() {
    const notifications = [
      { type: "vote", icon: "🗳️", color: "primary", title: "M-001: 12 undi baru diterima", desc: "248 YA · 47 TIDAK · 18 KOSONG", time: "Baru saja", unread: true },
      { type: "ai", icon: "🤖", color: "info", title: "AI Minute Writer siap 68%", desc: "Draf minit AGM-16 sedang dijana · dijangka siap 4 minit", time: "2 minit lalu", unread: true },
      { type: "alert", icon: "⚠️", color: "warning", title: "M-003 auto-gugur", desc: "BRule-003 dipicu: Tiada Penyokong dalam 15 minit", time: "5 minit lalu", unread: true },
      { type: "compliance", icon: "✅", color: "success", title: "Pematuhan 100% LULUS", desc: "Semua 6 syarat SKM dipatuhi untuk AGM-16", time: "10 minit lalu" },
      { type: "user", icon: "👤", color: "info", title: "Pn. Fatimah Ismail daftar masuk", desc: "Kaedah: MyKad NFC · No. Ahli A-0312", time: "12 minit lalu" },
      { type: "system", icon: "🔧", color: "info", title: "WebSocket latency turun 8ms", desc: "Optimisasi auto-scaling selesai", time: "15 minit lalu" },
      { type: "agenda", icon: "📋", color: "primary", title: "AG-07 akan dimulakan", desc: "Pilihan Raya Lembaga · 45 minit", time: "20 minit lalu" },
    ];

    const panel = document.createElement("div");
    panel.id = "notif-panel";
    panel.className = "dropdown-panel";
    panel.innerHTML = `
      <div class="dp-head">
        <div>
          <div class="dp-title">Pemberitahuan</div>
          <div class="dp-sub">3 belum dibaca</div>
        </div>
        <button class="dp-action">Tanda Semua Dibaca</button>
      </div>
      <div class="dp-list scrollbar">
        ${notifications.map(n => `
          <div class="notif-row ${n.unread ? 'unread' : ''}">
            <div class="notif-icon ${n.color}">${n.icon}</div>
            <div style="flex:1; min-width:0">
              <div class="notif-title">${n.title}</div>
              <div class="notif-desc">${n.desc}</div>
              <div class="notif-time">${n.time}</div>
            </div>
            ${n.unread ? '<div class="notif-dot"></div>' : ''}
          </div>
        `).join("")}
      </div>
      <div class="dp-foot">
        <button class="dp-action">Lihat Semua Pemberitahuan</button>
      </div>
    `;
    document.body.appendChild(panel);
  }

  function renderProfileMenu() {
    const menu = document.createElement("div");
    menu.id = "profile-menu";
    menu.className = "dropdown-panel";
    menu.innerHTML = `
      <div class="profile-head">
        <div class="h-avatar" style="width:48px;height:48px;font-size:16px">${D.currentUser.avatar}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:14px">${D.currentUser.name}</div>
          <div class="text-xs text-3">${D.currentUser.role}</div>
          <div class="text-xs text-3 text-mono">${D.currentUser.email}</div>
        </div>
      </div>
      <div class="profile-actions">
        <div class="prof-role-row">
          <div style="font-size:11px;color:var(--c-text-3);text-transform:uppercase;letter-spacing:0.5px;font-weight: 500;margin-bottom:6px">Tukar Peranan (Demo)</div>
          <div class="role-switcher">
            <div class="rs-chip ${state.role === 'secretary' ? 'active' : ''}" data-role="secretary">📋 Setiausaha</div>
            <div class="rs-chip ${state.role === 'chairman' ? 'active' : ''}" data-role="chairman">🎤 Pengerusi</div>
            <div class="rs-chip ${state.role === 'member' ? 'active' : ''}" data-role="member">👤 Ahli</div>
          </div>
        </div>
      </div>
      <div class="profile-menu-list">
        <div class="pml-item" data-action="settings">${ICONS.cog}<span>Tetapan Akaun</span></div>
        <div class="pml-item" data-action="notifications">${ICONS.bell}<span>Keutamaan Pemberitahuan</span></div>
        <div class="pml-item" data-action="help">${ICONS.help}<span>Bantuan & Sokongan</span></div>
        <div class="pml-item" data-action="keyboard">${ICONS.search}<span>Pintasan Papan Kekunci</span></div>
        <div class="pml-divider"></div>
        <div class="pml-item danger" data-action="logout">${ICONS.phoneOff}<span>Log Keluar</span></div>
      </div>
    `;
    document.body.appendChild(menu);

    $$(".rs-chip", menu).forEach(el =>
      el.addEventListener("click", () => {
        state.role = el.dataset.role;
        state.profileOpen = false;
        showToast(`Peranan ditukar: ${el.textContent.trim()}`);
        renderDropdowns();
      })
    );
    $$(".pml-item", menu).forEach(el =>
      el.addEventListener("click", () => {
        const a = el.dataset.action;
        if (a === "settings") { navigate("settings"); }
        else if (a === "logout") {
          showToast("👋 Anda telah log keluar");
          navigate("login");
        } else {
          showToast("Ciri ini akan datang dalam versi penuh.");
        }
        state.profileOpen = false;
        renderDropdowns();
      })
    );
  }

  function renderSearchOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "search-overlay";
    overlay.className = "search-overlay";
    overlay.innerHTML = `
      <div class="search-modal">
        <div class="search-bar">
          ${ICONS.search}
          <input type="text" placeholder="Cari ahli, usul, agenda, atau apa-apa..." id="global-search-input" autocomplete="off">
          <span class="kb-hint">ESC</span>
        </div>
        <div class="search-results scrollbar" id="search-results">
          <div style="padding:20px;text-align:center;color:var(--c-text-3)">
            <div style="font-size:32px;margin-bottom:8px">🔍</div>
            <div>Taip untuk mula mencari...</div>
            <div style="font-size:12px;margin-top:6px">Mencari dalam ${D.members.length} ahli · ${D.motions.length} usul · ${D.agenda.length} agenda · 1,247 dokumen</div>
          </div>
        </div>
        <div class="search-suggest">
          <span>Cuba:</span>
          <div class="suggest-tag" data-q="Dividen">Dividen</div>
          <div class="suggest-tag" data-q="A-0078">A-0078 (Muthusamy)</div>
          <div class="suggest-tag" data-q="M-001">M-001</div>
          <div class="suggest-tag" data-q="AG-06">AG-06</div>
          <div class="suggest-tag" data-q="Kuorum">Kuorum</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = $("#global-search-input");
    input.addEventListener("input", (e) => runSearch(e.target.value));
    $$(".suggest-tag").forEach(t =>
      t.addEventListener("click", () => { input.value = t.dataset.q; runSearch(t.dataset.q); })
    );
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) toggleSearch(false);
    });
  }

  function runSearch(q) {
    const results = $("#search-results");
    if (!q || q.length < 1) {
      results.innerHTML = '<div style="padding:20px;text-align:center;color:var(--c-text-3)">Taip untuk mula mencari...</div>';
      return;
    }
    const ql = q.toLowerCase();
    const out = [];

    // Search members
    D.members.filter(m => m.name.toLowerCase().includes(ql) || m.id.includes(ql) || m.ic.includes(ql)).slice(0, 5).forEach(m => {
      out.push({ type: "Ahli", icon: "👤", title: m.name, sub: `${m.id} · ${m.shares.toLocaleString()} saham · ${m.status}`, route: "members" });
    });

    // Search motions
    D.motions.filter(m => m.title.toLowerCase().includes(ql) || m.id.toLowerCase().includes(ql)).slice(0, 3).forEach(m => {
      out.push({ type: "Usul", icon: "📜", title: m.title, sub: `${m.id} · ${m.status}`, route: "motions" });
    });

    // Search agenda
    D.agenda.filter(a => a.title.toLowerCase().includes(ql) || a.id.toLowerCase().includes(ql)).slice(0, 3).forEach(a => {
      out.push({ type: "Agenda", icon: "📋", title: a.title, sub: `${a.id} · ${a.duration} min · ${a.presenter}`, route: "agm-hall" });
    });

    // Search candidates
    D.candidates.filter(c => c.name.toLowerCase().includes(ql) || c.position.toLowerCase().includes(ql)).slice(0, 3).forEach(c => {
      out.push({ type: "Calon", icon: "🎯", title: c.name, sub: `${c.position} · Zon ${c.zone}`, route: "voting" });
    });

    if (out.length === 0) {
      results.innerHTML = `<div style="padding:30px;text-align:center;color:var(--c-text-3)"><div style="font-size:32px;margin-bottom:8px">🤷</div><div>Tiada hasil untuk "${q}"</div></div>`;
      return;
    }

    results.innerHTML = out.map(r => `
      <div class="search-result-item" data-route="${r.route}">
        <div class="sri-icon">${r.icon}</div>
        <div style="flex:1;min-width:0">
          <div class="sri-title">${r.title}</div>
          <div class="sri-sub">${r.sub}</div>
        </div>
        <span class="badge">${r.type}</span>
      </div>
    `).join("");

    $$(".search-result-item", results).forEach(el =>
      el.addEventListener("click", () => {
        state.searchOpen = false;
        navigate(el.dataset.route);
        showToast(`Pergi ke ${el.dataset.route}`);
      })
    );
  }

  /* ============================================================
     REAL-TIME VOTE SIMULATOR
     ============================================================ */
  function startLiveVoteSim() {
    safeInterval(() => {
      if (state.view !== "voting" && state.view !== "agm-hall") return;
      if (state.liveVotes.ya + state.liveVotes.tidak + state.liveVotes.abstain >= state.liveVotes.total - 5) return;
      const r = Math.random();
      if (r < 0.75) state.liveVotes.ya += Math.floor(Math.random() * 3) + 1;
      else if (r < 0.92) state.liveVotes.tidak += 1;
      else state.liveVotes.abstain += 1;

      if (state.view === "voting") updateVotingCounter();
      if (state.view === "agm-hall") updateHallVoteCounter();
    }, 3500);
  }

  function updateVotingCounter() {
    const subEl = document.querySelector(".vp-sub");
    if (subEl) {
      const t = state.liveVotes.ya + state.liveVotes.tidak + state.liveVotes.abstain;
      const pct = Math.round(t / state.liveVotes.total * 100);
      subEl.textContent = `${t} daripada ${state.liveVotes.total} ahli berkuorum telah mengundi (${pct}%) · Akan tutup pada 11:45`;
    }
  }

  function updateHallVoteCounter() {
    const hall = document.querySelector(".hall-main");
    if (!hall || state.selectedLayout !== "voting") return;
    // Update the 3 vote tiles in hall voting mode
    const yas = hall.querySelectorAll(".stage-layout.mode-voting div[style*='background:rgba(16,185,129,0.2)']");
    if (yas.length === 0) return;
  }


  /* ============================================================
     TOAST
     ============================================================ */
  function toastHost() {
    let host = $("#toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.setAttribute("role", "status");
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    return host;
  }

  function showToast(msg, type) {
    // Infer type from leading emoji when not given (keeps old call sites working)
    if (!type) {
      if (/^(✅|🎉|🔐)/.test(msg)) type = "success";
      else if (/^(⚠️|❗)/.test(msg)) type = "warning";
      else if (/^(❌|🚫)/.test(msg)) type = "danger";
      else type = "info";
    }
    const icons = { success: "✓", warning: "!", danger: "✕", info: "i" };
    const host = toastHost();
    const t = document.createElement("div");
    t.className = `toast toast-${type}`;
    t.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span class="toast-msg"></span>
      <button class="toast-close" aria-label="Tutup">${ICONS.x}</button>`;
    t.querySelector(".toast-msg").textContent = msg;
    host.appendChild(t);
    // Keep at most 3 stacked
    while (host.children.length > 3) host.firstChild.remove();
    requestAnimationFrame(() => t.classList.add("show"));
    const kill = () => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 250);
    };
    t.querySelector(".toast-close").addEventListener("click", kill);
    setTimeout(kill, 4000);
  }

  /* ============================================================
     CONFIRM DIALOG (for critical / destructive actions)
     ============================================================ */
  function showConfirm({ title, message, confirmLabel, cancelLabel, danger, onConfirm }) {
    $("#confirm-backdrop")?.remove();
    const wrap = document.createElement("div");
    wrap.id = "confirm-backdrop";
    wrap.className = "modal-backdrop";
    wrap.innerHTML = `
      <div class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="cfm-title">
        <div class="modal-body" style="text-align:center;padding:28px 26px 20px">
          <div class="cfm-icon ${danger ? 'danger' : ''}">${danger ? ICONS.alert : ICONS.help}</div>
          <h3 id="cfm-title" style="margin:14px 0 6px;font-size:18px;font-weight:700">${title}</h3>
          <p class="text-2" style="margin:0;font-size:14px;line-height:1.55">${message}</p>
        </div>
        <div class="modal-foot" style="justify-content:center;border-top:0;padding-top:0;background:transparent">
          <button class="btn btn-ghost btn-lg" id="cfm-cancel">${cancelLabel || "Batal"}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-lg" id="cfm-ok">${confirmLabel || "Sahkan"}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    $("#cfm-cancel", wrap).addEventListener("click", close);
    $("#cfm-ok", wrap).addEventListener("click", () => { close(); onConfirm && onConfirm(); });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
    });
    setTimeout(() => $("#cfm-ok", wrap)?.focus(), 50);
  }



  /* ============================================================
     AGM WIZARD (Create AGM)
     ============================================================ */
  function renderWizard() {
    const main = $("#main");
    const steps = [
      { id: 1, label: "Asas AGM", icon: "📋", desc: "Tarikh & mod" },
      { id: 2, label: "Agenda", icon: "📑", desc: "Susun atur agenda" },
      { id: 3, label: "Notis & Hebahan", icon: "📨", desc: "Saluran pengedaran" },
      { id: 4, label: "Pematuhan", icon: "⚖️", desc: "Auto-checks SKM" },
      { id: 5, label: "Terbit AGM", icon: "🚀", desc: "Sedia dimulakan" },
    ];
    const step = state.wizardStep || 1;
    main.innerHTML = `
      <div class="fade-in">
        <div class="page-head">
          <div>
            <h1 class="page-title">AGM Wizard · Cipta Mesyuarat Agung</h1>
            <div class="page-sub">5 langkah · Auto-pematuhan Akta Koperasi 1993 · Auto-jana Notis & Minit</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost" id="wiz-cancel">Batal</button>
            <button class="btn btn-ghost">${ICONS.help}<span>Panduan</span></button>
          </div>
        </div>

        <div class="wizard-shell">
          <div class="wizard-steps">
            ${steps.map(s => `
              <div class="wizard-step ${step === s.id ? 'active' : ''} ${step > s.id ? 'done' : ''}" data-step="${s.id}">
                <div class="ws-num">${step > s.id ? '✓' : s.id}</div>
                <div class="ws-info">
                  <div class="ws-label">${s.label}</div>
                  <div class="ws-desc">${s.desc}</div>
                </div>
              </div>
            `).join("")}
            <div style="margin-top:24px;padding:14px;background:var(--c-primary-100);border-radius:10px;font-size:12.5px">
              <div style="font-weight:700;color:var(--c-primary);margin-bottom:6px">💡 Tip Auto-Save</div>
              <div style="color:var(--c-text-2)">Setiap langkah disimpan automatik. Anda boleh kembali dan menyunting pada bila-bila masa.</div>
            </div>
          </div>

          <div class="wizard-panel">
            ${step === 1 ? `
              <div class="card">
                <div class="card-head">
                  <div>
                    <div class="card-title">Langkah 1: Asas AGM</div>
                    <div class="text-sm text-3 mt-1">Tetapkan tarikh, masa, dan mod persidangan</div>
                  </div>
                  <span class="badge info">Auto-saved</span>
                </div>
                <div class="card-body">
                  <div class="form-row">
                    <div>
                      <div class="label">Tajuk AGM</div>
                      <input class="input" value="Mesyuarat Agung Tahunan Ke-17">
                    </div>
                    <div>
                      <div class="label">Edisi / Tahun Kewangan</div>
                      <input class="input" value="TK 2026">
                    </div>
                  </div>
                  <div class="form-row-3">
                    <div>
                      <div class="label">Tarikh</div>
                      <input class="input" type="date" value="2027-06-15">
                    </div>
                    <div>
                      <div class="label">Masa Mula</div>
                      <input class="input" type="time" value="09:00">
                    </div>
                    <div>
                      <div class="label">Tempoh (jam)</div>
                      <input class="input" type="number" value="4">
                    </div>
                  </div>
                  <div class="label">Mod Persidangan</div>
                  <div class="mode-pick">
                    <div class="mode-card active">
                      <div style="font-size:32px;margin-bottom:6px">🏛️</div>
                      <div style="font-weight:700">Hibrid</div>
                      <div class="text-xs text-3">Fizikal + Dalam Talian</div>
                      <span class="badge info mt-2">Paling Popular</span>
                    </div>
                    <div class="mode-card">
                      <div style="font-size:32px;margin-bottom:6px">📍</div>
                      <div style="font-weight:700">Fizikal Sahaja</div>
                      <div class="text-xs text-3">Hadir di dewan</div>
                    </div>
                    <div class="mode-card">
                      <div style="font-size:32px;margin-bottom:6px">💻</div>
                      <div style="font-weight:700">Dalam Talian</div>
                      <div class="text-xs text-3">Zoom-style</div>
                    </div>
                  </div>
                  <div class="form-row">
                    <div>
                      <div class="label">Lokasi (jika fizikal/hibrid)</div>
                      <input class="input" value="Dewan Korporat KOPEMAJU, Petaling Jaya">
                    </div>
                    <div>
                      <div class="label">Kuorum Minimum (%)</div>
                      <input class="input" type="number" value="25">
                    </div>
                  </div>
                </div>
              </div>
            ` : step === 2 ? `
              <div class="card">
                <div class="card-head">
                  <div>
                    <div class="card-title">Langkah 2: Agenda Builder</div>
                    <div class="text-sm text-3 mt-1">Tambah dan susun atur item agenda</div>
                  </div>
                  <span class="badge info">7 item · 165 minit</span>
                </div>
                <div class="card-body">
                  <div class="agenda-builder">
                    ${D.agenda.map((a, i) => `
                      <div class="agenda-build-item">
                        <div class="abi-handle">⋮⋮</div>
                        <div class="abi-num">${i + 1}</div>
                        <div class="abi-content">
                          <div style="font-weight: 500;font-size:14px">${a.title}</div>
                          <div class="text-xs text-3 mt-1">${a.type} · ${a.duration} min · ${a.presenter}</div>
                        </div>
                        <div class="abi-actions">
                          <span class="badge ${a.type === 'Resolution' || a.type === 'Election' ? 'warning' : 'info'}">${a.type}</span>
                          <button class="btn btn-sm btn-ghost">${ICONS.x}</button>
                        </div>
                      </div>
                    `).join("")}
                    <div class="agenda-add">
                      ${ICONS.plus}<span>Tambah Item Agenda</span>
                    </div>
                  </div>
                  <div style="background:var(--c-surface-2);padding:14px;border-radius:10px;margin-top:14px">
                    <div class="flex justify-between items-center">
                      <div>
                        <div style="font-weight:700;font-size:13.5px">⏱️ Anggaran Masa</div>
                        <div class="text-xs text-3">Slaid AI tersedia: 28 muka surat · Minit: 12 hal.</div>
                      </div>
                      <div style="font-size:24px;font-weight: 700;color:var(--c-primary)">165 min</div>
                    </div>
                  </div>
                </div>
              </div>
            ` : step === 3 ? `
              <div class="card">
                <div class="card-head">
                  <div>
                    <div class="card-title">Langkah 3: Notis & Hebahan</div>
                    <div class="text-sm text-3 mt-1">Pilih saluran pengedaran notis AGM</div>
                  </div>
                  <span class="badge success">${D.agm.noticesSent} ahli akan menerima</span>
                </div>
                <div class="card-body">
                  <div class="label">Saluran Pengedaran</div>
                  <div class="channel-grid">
                    ${[
                      { name: "WhatsApp Business", icon: "💬", active: true, sent: 1284, delivered: 1247 },
                      { name: "SMS Gateway", icon: "📨", active: true, sent: 1284, delivered: 1281 },
                      { name: "E-mel", icon: "📧", active: true, sent: 984, delivered: 941 },
                      { name: "Notifikasi App", icon: "🔔", active: true, sent: 1284, delivered: 1284 },
                      { name: "Surat Fizikal", icon: "✉️", active: false, sent: 0, delivered: 0 },
                      { name: "Portal SKM", icon: "🛡️", active: true, sent: 1, delivered: 1 },
                    ].map(ch => `
                      <div class="channel-card ${ch.active ? 'active' : ''}">
                        <div class="ch-icon">${ch.icon}</div>
                        <div style="flex:1">
                          <div style="font-weight:700;font-size:13.5px">${ch.name}</div>
                          <div class="text-xs text-3">${ch.active ? `${ch.delivered}/${ch.sent} dihantar` : 'Tidak aktif'}</div>
                        </div>
                        <label style="position:relative;display:inline-block;width:40px;height:22px;flex-shrink:0">
                          <input type="checkbox" ${ch.active ? 'checked' : ''} style="opacity:0;width:0;height:0">
                          <span style="position:absolute;cursor:pointer;inset:0;background:${ch.active ? 'var(--c-primary)' : '#CBD2DD'};border-radius:22px;transition:0.2s"></span>
                          <span style="position:absolute;cursor:pointer;height:16px;width:16px;left:${ch.active ? '20px' : '3px'};top:3px;background:#fff;border-radius:50%;transition:0.2s"></span>
                        </label>
                      </div>
                    `).join("")}
                  </div>

                  <div style="margin-top:18px">
                    <div class="label">Tarikh Hantar Notis</div>
                    <input class="input" type="date" value="2027-05-25" style="max-width:240px">
                    <div class="text-xs text-success mt-1">✓ Hantar 21 hari sebelum AGM — melebihi minimum UUK 15 hari</div>
                  </div>

                  <div style="margin-top:14px">
                    <div class="label">Templat Notis (AI-jana)</div>
                    <div style="background:var(--c-surface-2);padding:14px;border-radius:8px;font-size:13px;line-height:1.6;font-family:'SF Mono',monospace">
                      <b>SUBJECT:</b> Notis Mesyuarat Agung Tahunan Ke-17 KOPEMAJU<br>
                      <b>TARIKH:</b> 15 Jun 2027 · 09:00<br>
                      <b>TEMPAT:</b> Dewan Korporat KOPEMAJU & Dalam Talian<br><br>
                      Assalamualaikum dan Salam Sejahtera ahli KOPEMAPU sekalian,<br>
                      Dimaklumkan bahawa Mesyuarat Agung Tahunan Ke-17 akan diadakan...<br>
                      <span style="opacity:0.5">[ ... AI auto-lengkapkan dari data koperasi ... ]</span>
                    </div>
                  </div>
                </div>
              </div>
            ` : step === 4 ? `
              <div class="card">
                <div class="card-head">
                  <div>
                    <div class="card-title">Langkah 4: Auto-Pematuhan SKM</div>
                    <div class="text-sm text-3 mt-1">Sistem mengesahkan semua keperluan Akta Koperasi 1993</div>
                  </div>
                  <span class="badge success">6/6 LULUS</span>
                </div>
                <div class="card-body">
                  <div class="rule-list">
                    ${[
                      { id: "Sec 17", label: "Notis Mesyuarat dihantar ≥15 hari", status: "pass", detail: "Notis akan dihantar 21 hari sebelum AGM (margin 6 hari)" },
                      { id: "Sec 22", label: "Kuorum minimum ditakrifkan", status: "pass", detail: "25% daripada 1,284 ahli = 321 ahli minimum" },
                      { id: "GP14", label: "Semua resolusi melalui Pencadang + Penyokong", status: "pass", detail: "Enjin BRule-002/003 akan menguatkuasakan" },
                      { id: "GP14B", label: "Sekurang-kurangnya 20% lebih surplus dikekalkan", status: "pass", detail: "Auto-kira dalam minit AI" },
                      { id: "UUK 7.3", label: "Tempoh perbahasan ≤15 minit setiap usul", status: "pass", detail: "Auto-timer aktif dalam Dewan AGM" },
                      { id: "Akta 1993", label: "Rekod digital tidak boleh diubah", status: "pass", detail: "Immutable hash chain akan diaktifkan untuk AGM ini" },
                    ].map(r => `
                      <div class="rule-row ${r.status}">
                        <div class="rule-icon">${ICONS.check}</div>
                        <div class="rule-info">
                          <div class="flex items-center gap-2">
                            <span class="r-ref">${r.id}</span>
                            <span class="r1">${r.label}</span>
                          </div>
                          <div class="r2">${r.detail}</div>
                        </div>
                        <span class="badge success">LULUS</span>
                      </div>
                    `).join("")}
                  </div>

                  <div style="background:linear-gradient(135deg,#D1FAE5,#A7F3D0);padding:18px;border-radius:12px;margin-top:18px;text-align:center">
                    <div style="font-size:32px;margin-bottom:8px">✅</div>
                    <div style="font-weight: 700;font-size:18px;color:#047857">Semua Pematuhan LULUS</div>
                    <div class="text-sm" style="color:#065F46;margin-top:4px">AGM ini bersedia untuk diterbitkan dan diedarkan kepada ahli</div>
                  </div>
                </div>
              </div>
            ` : `
              <div class="card">
                <div class="card-head">
                  <div>
                    <div class="card-title">Langkah 5: Sedia Terbit! 🚀</div>
                    <div class="text-sm text-3 mt-1">Semak ringkasan akhir dan terbitkan AGM</div>
                  </div>
                  <span class="badge success"><span class="dot"></span> Semua Sedia</span>
                </div>
                <div class="card-body" style="text-align:center;padding:40px">
                  <div style="font-size:64px;margin-bottom:14px">🎉</div>
                  <h2 style="font-size:24px;font-weight: 700;margin-bottom:10px">AGM Anda Telah Diconfigurasikan</h2>
                  <p class="text-2 mb-4" style="max-width:520px;margin:0 auto">Semua data, notis, dan pematuhan telah disahkan. Hanya satu klik untuk menerbitkan AGM dan mula menerima kehadiran.</p>

                  <div style="display:inline-grid;grid-template-columns:repeat(2,1fr);gap:14px;text-align:left;max-width:520px;margin:20px auto">
                    ${[
                      { l: "Tarikh AGM", v: "15 Jun 2027" },
                      { l: "Mod", v: "Hibrid" },
                      { l: "Agenda Items", v: "7" },
                      { l: "Ahli Dinotis", v: "1,284" },
                      { l: "Saluran Aktif", v: "5" },
                      { l: "Pematuhan", v: "6/6 ✅" },
                    ].map(s => `
                      <div style="padding:10px;background:var(--c-surface-2);border-radius:8px">
                        <div class="text-xs text-3">${s.l}</div>
                        <div style="font-weight:700;margin-top:2px">${s.v}</div>
                      </div>
                    `).join("")}
                  </div>

                  <div class="flex gap-2" style="justify-content:center;margin-top:20px">
                    <button class="btn btn-ghost btn-lg">${ICONS.x}<span>Simpan Draf</span></button>
                    <button class="btn btn-primary btn-xl" id="publish-agm">${ICONS.check}<span>Terbit AGM Sekarang</span></button>
                  </div>
                </div>
              </div>
            `}

            <div class="wizard-nav">
              <button class="btn btn-ghost btn-lg" id="wiz-prev" ${step === 1 ? 'disabled style="opacity:0.4"' : ''}>← Sebelum</button>
              <div style="font-size:12.5px;color:var(--c-text-3)">Langkah ${step} daripada 5</div>
              <button class="btn btn-primary btn-lg" id="wiz-next" ${step === 5 ? 'disabled style="opacity:0.4"' : ''}>Seterusnya →</button>
            </div>
          </div>
        </div>
      </div>
    `;

    $$("[data-step]").forEach(el =>
      el.addEventListener("click", () => {
        state.wizardStep = +el.dataset.step;
        renderWizard();
      })
    );
    $("#wiz-prev")?.addEventListener("click", () => {
      if (state.wizardStep > 1) { state.wizardStep--; renderWizard(); }
    });
    $("#wiz-next")?.addEventListener("click", () => {
      if (state.wizardStep < 5) { state.wizardStep++; renderWizard(); }
    });
    $("#wiz-cancel")?.addEventListener("click", () => {
      state.wizardStep = 1;
      navigate("dashboard");
    });
    $("#publish-agm")?.addEventListener("click", () => {
      showToast("🎉 AGM Ke-17 diterbitkan! Notis dihantar kepada 1,284 ahli.");
      state.wizardStep = 1;
      navigate("dashboard");
    });
  }

  /* ============================================================
     SENIOR MEMBER VIEW (Mobile-friendly, large buttons)
     ============================================================ */
  function renderSeniorMember() {
    const main = $("#main");
    main.innerHTML = `
      <div class="senior-shell">
        <div class="senior-top">
          <div class="flex items-center gap-3">
            <div class="brand-mark" style="background:#fff;color:var(--c-primary)">AG</div>
            <div>
              <div style="font-weight: 700;font-size:18px;color:#fff">AGMX</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.7)">Mod Mesra Warga Emas</div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button class="senior-help" title="Bantuan 24/7">🆘 Saya Perlukan Bantuan</button>
            <button class="senior-help" style="background:var(--c-success)" title="Hubungi saya">📞 Hubungi Saya</button>
          </div>
        </div>

        <div class="senior-greeting">
          <div>
            <div style="font-size:32px;margin-bottom:6px">👋</div>
            <div style="font-size:24px;font-weight: 700">Selamat Datang, Pn. Fatimah</div>
            <div style="font-size:16px;opacity:0.9;margin-top:6px">Ahli KOPEMAJU sejak 2010 · No. Ahli A-0312</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:13px;opacity:0.7;text-transform:uppercase;letter-spacing:1px">Sesi AGM Aktif</div>
            <div style="font-size:28px;font-weight: 700">02:18:42</div>
            <div style="font-size:13px;opacity:0.7;margin-top:4px">${D.agm.title}</div>
          </div>
        </div>

        <div class="senior-menu">
          <div class="senior-menu-card primary" data-sm="agenda">
            <div class="sm-icon">📋</div>
            <div class="sm-title">Senarai Agenda</div>
            <div class="sm-sub">7 perkara · AG-06 aktif</div>
          </div>
          <div class="senior-menu-card" data-sm="documents">
            <div class="sm-icon">📄</div>
            <div class="sm-title">Dokumen AGM</div>
            <div class="sm-sub">4 fail tersedia</div>
          </div>
          <div class="senior-menu-card urgent" data-sm="vote">
            <div class="sm-icon">🗳️</div>
            <div class="sm-title">Undi Sekarang</div>
            <div class="sm-sub">1 undian menunggu anda</div>
            <div class="sm-pulse"></div>
          </div>
          <div class="senior-menu-card" data-sm="ask">
            <div class="sm-icon">💬</div>
            <div class="sm-title">Tanya Soalan</div>
            <div class="sm-sub">AI akan susun soalan</div>
          </div>
        </div>

        <div id="senior-content"></div>

        <div class="senior-help-bar">
          <div style="font-weight:700;font-size:16px;color:var(--c-primary)">📞 Hotline Pengerusi</div>
          <div class="text-2 text-sm">Sebarang kesulitan? Telefon terus: <b>+60 3-7728 1420</b> (8 pagi - 10 malam)</div>
        </div>
      </div>
    `;

    // Click handlers
    $$("[data-sm]").forEach(el =>
      el.addEventListener("click", () => {
        const v = el.dataset.sm;
        if (v === "vote") renderSeniorVoting();
        else if (v === "agenda") renderSeniorAgenda();
        else if (v === "documents") renderSeniorDocs();
        else showToast("Ciri ini akan datang. Sila hubungi pentadbir jika perlu.");
      })
    );
  }

  function renderSeniorVoting() {
    const root = $("#senior-content");
    root.innerHTML = `
      <div class="senior-vote">
        <button class="senior-back" id="sn-back">← Kembali</button>
        <h2 style="font-size:28px;font-weight: 700;margin:14px 0 8px">🗳️ Pengundian Anda</h2>
        <p style="font-size:18px;color:var(--c-text-2);margin-bottom:18px">Sila pilih YA atau TIDAK. Anda boleh tukar pilihan sebelum menghantar.</p>

        <div class="sn-motion-card">
          <div style="font-size:13px;font-weight:700;color:var(--c-primary);text-transform:uppercase;letter-spacing:1px">M-001</div>
          <h3 style="font-size:22px;font-weight: 700;margin:8px 0;line-height:1.3">Pembahagian Dividen 8% daripada Lebih Surplus RM 1.42 Juta</h3>
          <div style="font-size:15px;color:var(--c-text-2);background:var(--c-bg);padding:14px;border-radius:10px;margin-top:10px">
            <b>Dalam bahasa mudah:</b> Koperasi bercadang membahagikan 8% daripada keuntungan kepada semua ahli sebagai dividen. Sebagai contoh, jika anda mempunyai 1,500 unit saham, anda akan menerima RM 120.
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px">
          <button class="senior-vote-btn yes" id="sn-yes">
            <div style="font-size:40px;margin-bottom:4px">✅</div>
            <div style="font-size:28px;font-weight: 700">YA</div>
            <div style="font-size:15px;opacity:0.9;margin-top:2px">Saya setuju</div>
          </button>
          <button class="senior-vote-btn no" id="sn-no">
            <div style="font-size:40px;margin-bottom:4px">❌</div>
            <div style="font-size:28px;font-weight: 700">TIDAK</div>
            <div style="font-size:15px;opacity:0.9;margin-top:2px">Saya tidak setuju</div>
          </button>
        </div>

        <div style="background:var(--c-bg);padding:18px;border-radius:12px;margin-top:24px;text-align:center">
          <div style="font-size:18px;font-weight:700">🛡️ Undi Anda Dilindungi</div>
          <div class="text-sm text-2 mt-1">Disulitkan AES-256 · Direkodkan kekal dalam lejar KOPEMAJU</div>
        </div>
      </div>
    `;

    let chosen = null;
    const yes = $("#sn-yes"), no = $("#sn-no");
    [yes, no].forEach(b =>
      b.addEventListener("click", () => {
        yes.classList.remove("selected"); no.classList.remove("selected");
        b.classList.add("selected");
        chosen = b === yes ? "YA" : "TIDAK";
        setTimeout(() => {
          const grid = yes.parentElement;
          grid.outerHTML = `
            <div class="senior-voted-card">
              <div class="svc-check">✓</div>
              <div class="svc-title">Anda Telah Mengundi!</div>
              <div class="svc-sub">Undi anda (<b>${chosen}</b>) telah direkodkan dengan selamat. Terima kasih, Pn. Fatimah! 🎉</div>
              <div class="svc-receipt">🧾 Resit digital: #7892 · 11:43 · Disulitkan AES-256</div>
            </div>`;
          showToast("✅ Undi anda (" + chosen + ") berjaya dihantar. Terima kasih!");
        }, 500);
      })
    );
    $("#sn-back").addEventListener("click", () => {
      root.innerHTML = "";
    });
  }

  function renderSeniorAgenda() {
    const root = $("#senior-content");
    root.innerHTML = `
      <div class="senior-vote">
        <button class="senior-back" id="sn-back">← Kembali</button>
        <h2 style="font-size:28px;font-weight: 700;margin:14px 0 14px">📋 Apa Yang Akan Dibincangkan</h2>
        ${D.agenda.slice(0, 6).map((a, i) => `
          <div style="display:flex;gap:14px;align-items:flex-start;background:var(--c-surface);padding:18px;border-radius:12px;margin-bottom:12px;border:1px solid var(--c-border)">
            <div style="width:54px;height:54px;border-radius:50%;background:${a.status === 'Sedang Berlangsung' ? 'var(--c-warning)' : a.status === 'Selesai' ? 'var(--c-success)' : 'var(--c-primary)'};color:#fff;display:grid;place-items:center;font-weight: 700;font-size:22px;flex-shrink:0">${i + 1}</div>
            <div style="flex:1">
              <div style="font-size:20px;font-weight:700;line-height:1.3">${a.title}</div>
              <div style="font-size:15px;color:var(--c-text-3);margin-top:4px">${a.duration} minit · ${a.presenter}</div>
              <span class="badge ${a.status === 'Selesai' ? 'success' : a.status === 'Sedang Berlangsung' ? 'warning' : ''}" style="margin-top:8px;font-size:14px;padding:6px 12px">${a.status}</span>
            </div>
          </div>
        `).join("")}
      </div>
    `;
    $("#sn-back").addEventListener("click", () => { root.innerHTML = ""; });
  }

  function renderSeniorDocs() {
    const root = $("#senior-content");
    root.innerHTML = `
      <div class="senior-vote">
        <button class="senior-back" id="sn-back">← Kembali</button>
        <h2 style="font-size:28px;font-weight: 700;margin:14px 0 14px">📄 Dokumen AGM</h2>
        ${[
          { name: "Notis AGM", size: "4 halaman", icon: "📨" },
          { name: "Agenda & Minit", size: "12 halaman", icon: "📋" },
          { name: "Penyata Kewangan 2025", size: "28 halaman", icon: "💰" },
          { name: "Laporan Tahunan", size: "64 halaman", icon: "📊" },
        ].map(d => `
          <div style="display:flex;align-items:center;gap:16px;background:var(--c-surface);padding:20px;border-radius:12px;margin-bottom:12px;border:1px solid var(--c-border);cursor:pointer" onclick="window.open('about:blank')">
            <div style="font-size:40px">${d.icon}</div>
            <div style="flex:1">
              <div style="font-size:20px;font-weight:700">${d.name}</div>
              <div style="font-size:15px;color:var(--c-text-3)">${d.size}</div>
            </div>
            <div style="font-size:36px">⬇️</div>
          </div>
        `).join("")}
      </div>
    `;
    $("#sn-back").addEventListener("click", () => { root.innerHTML = ""; });
  }

  /* ============================================================
     ATTENDANCE QR SCANNER (Hybrid check-in desk)
     ============================================================ */
  function renderScanner() {
    const main = $("#main");
    main.innerHTML = `
      <div class="fade-in">
        <div class="page-head">
          <div>
            <h1 class="page-title">📷 Meja Pendaftaran Kehadiran</h1>
            <div class="page-sub">Imbas QR ahli · Real-time check-in · Auto-sync dengan Dewan AGM</div>
          </div>
          <div class="page-actions">
            <span class="badge success"><span class="dot"></span> ${D.agm.quorumPresent}/${D.agm.totalMembers} ahli berdaftar</span>
            <button class="btn btn-ghost">${ICONS.download}<span>Eksport Senarai</span></button>
            <button class="btn btn-primary">${ICONS.print || ICONS.qr}<span>Cetak QR Mesra</span></button>
          </div>
        </div>

        <div class="scanner-shell">
          <div>
            <div class="card">
              <div class="card-body" style="padding:30px;text-align:center">
                <div class="scanner-frame">
                  <div class="scanner-overlay">
                    <div class="scan-corner tl"></div>
                    <div class="scan-corner tr"></div>
                    <div class="scan-corner bl"></div>
                    <div class="scan-corner br"></div>
                    <div class="scan-line"></div>
                    <div style="position:absolute;inset:0;display:grid;place-items:center;color:rgba(255,255,255,0.5);font-size:14px">QR Scanner Aktif</div>
                  </div>
                  <div style="padding:60px 30px;background:#0a0a0a">
                    <div style="font-size:48px;margin-bottom:14px">📷</div>
                    <div style="color:#fff;font-weight:700;font-size:18px">Kamera Diaktifkan</div>
                    <div class="text-sm" style="color:rgba(255,255,255,0.6);margin-top:6px">Arahkan kod QR ahli ke kamera</div>
                  </div>
                </div>
                <div class="mt-3" style="font-size:13px;color:var(--c-text-3)">Auto-zoom · Anti-duplicate · OCR MyKad backup</div>
                <div class="flex gap-2 mt-3" style="justify-content:center">
                  <button class="btn btn-ghost btn-sm">${ICONS.cam}<span>Tukar Kamera</span></button>
                  <button class="btn btn-ghost btn-sm">📱<span>MyKad Manual</span></button>
                </div>
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-head">
                <div class="card-title">Sesi Imbas Terkini</div>
                <span class="badge info">24 dalam 5 minit</span>
              </div>
              <div class="card-body" style="padding:0;max-height:380px;overflow-y:auto">
                ${[
                  { name: "En. Lim Chong Wei", id: "A-0117", time: "11:38:42", method: "QR", status: "OK" },
                  { name: "Cik Nurul Huda Ali", id: "A-0233", time: "11:38:15", method: "QR", status: "OK" },
                  { name: "Pn. Zaiton (Proksi)", id: "→A-0312", time: "11:37:58", method: "MyKad", status: "PROXY" },
                  { name: "En. Muthusamy Gopal", id: "A-0078", time: "11:37:34", method: "QR", status: "OK" },
                  { name: "En. Razak Hussein", id: "A-0044", time: "11:36:21", method: "QR", status: "BLOCKED" },
                  { name: "Cik Tan Mei Ling", id: "A-0201", time: "11:35:48", method: "QR", status: "OK" },
                  { name: "En. Faizal Ahmad", id: "A-0089", time: "11:35:12", method: "MyKad", status: "BLOCKED" },
                ].map(s => `
                  <div style="display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid var(--c-divider)">
                    <div class="member-avatar">${s.name.split(' ').slice(-1)[0].slice(0,1)}${s.name.split(' ')[1] ? s.name.split(' ')[1].slice(0,1) : ''}</div>
                    <div style="flex:1">
                      <div style="font-weight: 500;font-size:13.5px">${s.name}</div>
                      <div class="text-xs text-mono text-3">${s.id}</div>
                    </div>
                    <span class="badge">${s.method}</span>
                    <span class="text-xs text-3 text-mono">${s.time}</span>
                    <span class="badge ${s.status === 'OK' ? 'success' : s.status === 'PROXY' ? 'info' : 'danger'}">${s.status}</span>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>

          <div>
            <div class="card">
              <div class="card-head">
                <div class="card-title">Live Quorum Tracker</div>
                <span class="badge success">PATUH</span>
              </div>
              <div class="card-body" style="padding:18px">
                <div style="text-align:center;margin-bottom:14px">
                  <div style="font-size:48px;font-weight: 700;color:var(--c-primary)">${D.agm.quorumPct}%</div>
                  <div style="font-size:14px;color:var(--c-text-3)">(${D.agm.quorumPresent} / ${D.agm.totalMembers} ahli)</div>
                </div>
                <div class="quorum-bar-wrap" style="position:relative;background:var(--c-bg);height:18px;border-radius:9px;overflow:hidden">
                  <div style="height:100%;width:${D.agm.quorumPct}%;background:linear-gradient(90deg,var(--c-accent),#FCD34D);border-radius:9px"></div>
                  <div style="position:absolute;left:25%;top:0;bottom:0;width:2px;background:rgba(0,0,0,0.3)"></div>
                </div>
                <div class="flex justify-between text-xs text-3 mt-2">
                  <span>0%</span><span>Syarat 25%</span><span>100%</span>
                </div>
                <div class="grid-2 mt-3" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                  <div style="padding:12px;background:var(--c-primary-100);border-radius:10px">
                    <div class="text-xs text-3">📍 Fizikal</div>
                    <div style="font-size:24px;font-weight: 700;color:var(--c-primary)">142</div>
                  </div>
                  <div style="padding:12px;background:var(--c-info);color:#fff;border-radius:10px;background:linear-gradient(135deg,#3B82F6,#1E40AF)">
                    <div style="font-size:11px;opacity:0.85">💻 Dalam Talian</div>
                    <div style="font-size:24px;font-weight: 700">261</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-head">
                <div class="card-title">Mod Check-in</div>
              </div>
              <div class="card-body" style="padding:14px">
                ${[
                  { name: "QR Code", icon: ICONS.qr, active: true, desc: "Imbas kod QR peribadi ahli" },
                  { name: "MyKad (NFC)", icon: "🆔", active: true, desc: "Sentuh kad pengenalan" },
                  { name: "Manual Entry", icon: "⌨️", active: false, desc: "Taip no. ahli secara manual" },
                  { name: "Face Recognition", icon: "👤", active: false, desc: "Beta — untuk ahli berdaftar" },
                ].map(m => `
                  <div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:8px;background:${m.active ? 'var(--c-primary-100)' : 'transparent'};margin-bottom:6px">
                    <div style="width:36px;height:36px;background:${m.active ? 'var(--c-primary)' : 'var(--c-bg)'};color:${m.active ? '#fff' : 'var(--c-text-2)'};border-radius:8px;display:grid;place-items:center">
                      ${typeof m.icon === 'string' ? `<span style="font-size:18px">${m.icon}</span>` : m.icon}
                    </div>
                    <div style="flex:1">
                      <div style="font-weight:700;font-size:13.5px">${m.name}</div>
                      <div class="text-xs text-3">${m.desc}</div>
                    </div>
                    <span class="badge ${m.active ? 'success' : ''}">${m.active ? 'AKTIF' : 'OFF'}</span>
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-head">
                <div class="card-title">⚠️ Sekatan Automatik</div>
              </div>
              <div class="card-body" style="padding:14px;font-size:13px">
                <div style="display:flex;gap:10px;padding:10px;background:#FEE2E2;border-radius:8px;margin-bottom:8px">
                  <span style="font-size:20px">🚫</span>
                  <div>
                    <div style="font-weight:700">Tunggakan Saham/Yuran</div>
                    <div class="text-xs text-3">2 ahli disekat hari ini (BRule-005)</div>
                  </div>
                </div>
                <div style="display:flex;gap:10px;padding:10px;background:#FEF3C7;border-radius:8px;margin-bottom:8px">
                  <span style="font-size:20px">⚠️</span>
                  <div>
                    <div style="font-weight:700">Proksi Tidak Sah</div>
                    <div class="text-xs text-3">1 proksi ditolak (tidak berdaftar dengan SKM)</div>
                  </div>
                </div>
                <div style="display:flex;gap:10px;padding:10px;background:#DBEAFE;border-radius:8px">
                  <span style="font-size:20px">ℹ️</span>
                  <div>
                    <div style="font-weight:700">Dual Check-in Dicegah</div>
                    <div class="text-xs text-3">Sistem auto-kesan percubaan daftar masuk berganda</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }


  /* ============================================================
     PRODUCT ROADMAP (from PRD Vol 1 + Vol 10)
     ============================================================ */
  /* ============================================================
     PRODUCT ROADMAP (from PRD Vol 1 + Vol 10)
     ============================================================ */
    
  /* ============================================================
     SPRINT 13 — HARDENING UTILITIES
     ============================================================ */
  const Hardening = {
    /* ---------- Accessibility Audit (WCAG 2.1 AA) ---------- */
    accessibility: {
      audit() {
        const issues = [];
        $$("img:not([alt])").forEach(img => issues.push({ level: "A", rule: "1.1.1", element: img, msg: "Gambar tanpa alt text" }));
        $$("input:not([id])").forEach(input => { const label = $("label[for=" + input.id + "]"); if (!label) issues.push({ level: "A", rule: "1.3.1", element: input, msg: "Input tanpa label terhubung" }); });
        $$(".text-3, .text-2, .text-sm").forEach(el => { const style = getComputedStyle(el); const color = style.color; const bg = style.backgroundColor; if (color === bg) issues.push({ level: "AA", rule: "1.4.3", element: el, msg: "Warna teks sama dengan background" }); });
        $$("button, a, input, select, textarea, [tabindex]").forEach(el => { if (el.tabIndex < 0 && !el.disabled) issues.push({ level: "A", rule: "2.1.1", element: el, msg: "Elemen interaktif tidak reachable via keyboard" }); });
        const style = document.createElement("style"); style.textContent = ":focus-visible { outline: 3px solid var(--c-accent) !important; outline-offset: 2px !important; }"; document.head.appendChild(style);
        if (!document.documentElement.lang) issues.push({ level: "A", rule: "3.1.1", element: document.documentElement, msg: "Halaman tidak ada lang attribute" });
        $$("[role]").forEach(el => { if (!el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !el.textContent.trim()) issues.push({ level: "A", rule: "4.1.2", element: el, msg: "Elemen ARIA tanpa nama aksesibel" }); });
        return issues;
      },
      report() {
        const issues = this.audit();
        const byLevel = { A: [], AA: [], AAA: [] };
        issues.forEach(i => byLevel[i.level].push(i));
        console.group("AGMX Accessibility Audit (WCAG 2.1 AA)");
        console.log("Total issues:", issues.length);
        console.log("Level A:", byLevel.A.length);
        console.log("Level AA:", byLevel.AA.length);
        console.table(issues.map(i => ({ Rule: i.rule, Level: i.level, Message: i.msg, Element: i.element.tagName + (i.element.id ? "#" + i.element.id : "") + (i.element.className ? "." + i.element.className.split(" ")[0] : "") })));
        console.groupEnd();
        return issues;
      }
    },

    /* ---------- Security Audit ---------- */
    security: {
      audit() {
        const issues = [];
        if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) issues.push({ severity: "HIGH", category: "CSP", msg: "Content Security Policy tidak ditemukan" });
        if (location.protocol !== "https:" && location.hostname !== "localhost") issues.push({ severity: "HIGH", category: "TLS", msg: "Bukan HTTPS" });
        $$("script:not([src])").forEach(s => { if (!s.nonce && !s.hasAttribute("data-inline-ok")) issues.push({ severity: "MEDIUM", category: "CSP", msg: "Inline script tanpa nonce", element: s }); });
        $$("style:not([data-inline-ok])").forEach(s => issues.push({ severity: "MEDIUM", category: "CSP", msg: "Inline style", element: s }));
        if (!document.querySelector('meta[http-equiv="X-Frame-Options"]')) issues.push({ severity: "MEDIUM", category: "Clickjacking", msg: "X-Frame-Options tidak diset" });
        try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/token|password|secret|key/i.test(k)) issues.push({ severity: "HIGH", category: "Storage", msg: "Data sensitif di localStorage: " + k }); } } catch(e) {}
        return issues;
      },
      report() {
        const issues = this.audit();
        console.group("AGMX Security Audit");
        console.log("Total issues:", issues.length);
        console.table(issues.map(i => ({ Severity: i.severity, Category: i.category, Message: i.msg })));
        console.groupEnd();
        return issues;
      }
    },

    /* ---------- Performance Monitoring ---------- */
    performance: {
      metrics: {},
      start(label) { this.metrics[label] = performance.now(); },
      end(label) { if (this.metrics[label]) { const duration = performance.now() - this.metrics[label]; console.log(label + ": " + duration.toFixed(2) + "ms"); return duration; } },
      report() {
        const nav = performance.getEntriesByType("navigation")[0];
        if (nav) {
          console.group("AGMX Performance Report");
          console.log("DNS Lookup:", (nav.domainLookupEnd - nav.domainLookupStart).toFixed(2), "ms");
          console.log("TCP Connect:", (nav.connectEnd - nav.connectStart).toFixed(2), "ms");
          console.log("TTFB:", (nav.responseStart - nav.requestStart).toFixed(2), "ms");
          console.log("DOM Content Loaded:", (nav.domContentLoadedEventEnd - nav.navigationStart).toFixed(2), "ms");
          console.log("Load Complete:", (nav.loadEventEnd - nav.navigationStart).toFixed(2), "ms");
          console.groupEnd();
        }
        return nav;
      }
    },

    /* ---------- Data Integrity ---------- */
    integrity: {
      verifyHashChain() {
        const log = D.auditLog || [];
        let valid = true;
        for (let i = 1; i < log.length; i++) {
          if (!/^0x[0-9a-f…]+$/.test(log[i].hash)) { console.warn("Invalid hash format at index", i); valid = false; }
        }
        console.log(valid ? "Hash chain format valid" : "Hash chain has issues");
        return valid;
      },
      verifyChecksums() {
        const docs = D.documents || [];
        let valid = true;
        docs.forEach(d => { if (!/^sha256:[a-f0-9]{8,}...$/.test(d.checksum)) { console.warn("Invalid checksum format:", d.id, d.checksum); valid = false; } });
        console.log(valid ? "Document checksums format valid" : "Checksum format issues");
        return valid;
      },
      verifySnapshot() {
        const ER = D.electoralRoll || {};
        if (!ER.snapshotId || !ER.hash) return console.warn("Electoral roll snapshot missing");
        console.log("Electoral roll snapshot:", ER.snapshotId, "hash:", ER.hash);
        return true;
      }
    },

    /* ---------- Production Claims Verification ---------- */
    claims: {
      verify() {
        const claims = [
          { claim: "AES-256 encryption", status: "UNVERIFIED", evidence: "Crypto implementation needed" },
          { claim: "Immutable hash chain (7,891 blocks)", status: "FORMAT_ONLY", evidence: "Hash format only, no crypto verification" },
          { claim: "Compliance score 98/100", status: "REMOVED", evidence: "Removed per PRD §20 - replaced with configured rules" },
          { claim: "98% AI accuracy", status: "REMOVED", evidence: "Removed per PRD §20 - AI is advisory only" },
          { claim: "Production testimonials", status: "REMOVED", evidence: "Replaced with demo illustrations per PRD §20" },
          { claim: "1284 members managed", status: "DEMO_DATA", evidence: "Mock data in data.js" },
          { claim: "7,891 hash blocks", status: "DEMO_DATA", evidence: "Mock data in data.js" },
          { claim: "4 AI agents active", status: "IMPLEMENTED", evidence: "6 agents in renderCopilotAgents()" },
        ];
        console.group("AGMX Production Claims Verification");
        console.table(claims.map(c => ({ Claim: c.claim, Status: c.status, Evidence: c.evidence })));
        console.groupEnd();
        return claims;
      }
    },

    /* ---------- DR / Backup Verification ---------- */
    disasterRecovery: {
      check() {
        const checks = [
          { name: "localStorage backup", fn: function() { try { const size = JSON.stringify(localStorage).length; return size > 0; } catch(e) { return false; } } },
          { name: "IndexedDB available", fn: function() { return "indexedDB" in window; } },
          { name: "Service Worker registered", fn: function() { return navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready; } },
          { name: "Offline fallback", fn: function() { try { const resp = fetch("offline.html"); return resp.ok; } catch(e) { return false; } } },
        ];
        console.group("AGMX DR/Backup Check");
        checks.forEach(c => { try { const pass = c.fn(); console.log(pass ? "PASS" : "FAIL", c.name); } catch(e) { console.log("FAIL", c.name, e.message); } });
        console.groupEnd();
      }
    },

    /* ---------- Run All Audits ---------- */
    runAll() {
      console.log("AGMX Sprint 13 - Hardening Suite");
      this.accessibility.report();
      this.security.report();
      this.performance.report();
      this.integrity.verifyHashChain();
      this.integrity.verifyChecksums();
      this.integrity.verifySnapshot();
      this.claims.verify();
      this.disasterRecovery.check();
      console.log("Hardening suite complete");
      return {
        a11y: this.accessibility.audit(),
        security: this.security.audit(),
        perf: this.performance.report(),
        integrity: { hash: this.integrity.verifyHashChain(), checksums: this.integrity.verifyChecksums(), snapshot: this.integrity.verifySnapshot() },
        claims: this.claims.verify(),
        dr: this.disasterRecovery.check()
      };
    }
  };

  /* Expose globally for console use */
  window.AGMX_Hardening = Hardening;

  /* Auto-run on load (dev only) */
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    document.addEventListener("DOMContentLoaded", function() {
      setTimeout(function() { Hardening.runAll(); }, 1000);
    });
  }

function renderRoadmap() {
    const main = $("#main");
    main.innerHTML = `
      <div class="fade-in">
        <div class="page-head">
          <div>
            <h1 class="page-title">🗺️ Product Roadmap AGMX</h1>
            <div class="page-sub">Pelan 3-fasa daripada MVP hingga "Cooperative SuperApp" · Vol 1 + Vol 10 PRD</div>
          </div>
        </div>

        <div class="kpi-grid mb-4">
          ${kpiBox("Fasa 1: Core Governance", "Sprint 1-8", "AGM fizikal end-to-end", "primary")}
          ${kpiBox("Fasa 2: AGMX LIVE", "Sprint 9-11", "Hibrid/Online + AI Minit", "accent")}
          ${kpiBox("Fasa 3: Enterprise", "Sprint 12+", "White-label, DR, Multi-coop", "success")}
          ${kpiBox("Status Hardening", "Sprint 13", "A11y, Sec, Perf, DR", "warning")}
        </div>

        <div class="card mb-4">
          <div class="card-head">
            <h3 class="card-title">Fasa 1: Core Governance (MVP)</h3>
            <span class="badge success">SELESAI</span>
          </div>
          <div class="grid-3">
            <div class="p-4" style="background:var(--c-success-100);border-radius:var(--r-lg);border:1px solid var(--c-success)">
              <div class="text-bold text-success mb-2">✅ Sprint 1-3: Foundation</div>
              <ul class="text-sm text-2 space-y-1">
                <li>Inventory & freeze codebase</li>
                <li>4 Workspace IA (Gov/Hub/Control/LIVE)</li>
                <li>AGM Workspace + 12-stage lifecycle</li>
              </ul>
            </div>
            <div class="p-4" style="background:var(--c-success-100);border-radius:var(--r-lg);border:1px solid var(--c-success)">
              <div class="text-bold text-success mb-2">✅ Sprint 4-6: Compliance & Candidates</div>
              <ul class="text-sm text-2 space-y-1">
                <li>Electoral Roll (kelayakan terpisah)</li>
                <li>Notices + AGM Pack + Communications</li>
                <li>Nomination + Candidates (Lampiran 1)</li>
              </ul>
            </div>

  function renderRoadmap() {
    const main = $("#main");
    main.innerHTML = `
      <div class="fade-in">
        <div class="page-head">
          <div>
            <h1 class="page-title">🗺️ Product Roadmap AGMX</h1>
            <div class="page-sub">Pelan 3-fasa daripada MVP hingga "Cooperative SuperApp" · Vol 1 + Vol 10 PRD</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost">${ICONS.download}<span>Eksport Roadmap PDF</span></button>
            <button class="btn btn-primary">${ICONS.share}<span>Kongsi dengan Lembaga</span></button>
          </div>
        </div>

        <!-- VISION BANNER -->
        <div style="background:linear-gradient(135deg, var(--c-primary-700) 0%, var(--c-primary) 50%, var(--c-info) 100%);color:#fff;padding:32px;border-radius:18px;margin-bottom:24px;position:relative;overflow:hidden">
          <div style="position:absolute;inset:0;background:radial-gradient(circle at 80% 30%, rgba(212,160,23,0.3), transparent 50%);pointer-events:none"></div>
          <div style="position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:24px">
            <div>
              <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.8;margin-bottom:6px">🎯 Visi Jangka Panjang</div>
              <h2 style="font-size:32px;font-weight: 700;margin:0 0 8px;letter-spacing:-0.5px">AGM Expert 2.0 → Cooperative SuperApp</h2>
              <p style="font-size:15px;opacity:0.9;max-width:680px;margin:0">Bukan sekadar aplikasi telesidang. AGMX ialah Sistem Operasi Tadbir Urus Koperasi menyeluruh — Microsoft 365 + Zoom + SPR + DocuSign + Sistem Audit, digabungkan dalam satu platform SaaS.</p>
            </div>
            <div style="text-align:right;background:rgba(255,255,255,0.15);padding:20px 24px;border-radius:14px;backdrop-filter:blur(10px);min-width:200px">
              <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.85">Status Unicorn</div>
              <div style="font-size:42px;font-weight: 700;letter-spacing:-1px">🎯</div>
              <div style="font-size:13px;font-weight:700">Sasaran 2028</div>
            </div>
          </div>
        </div>

        <!-- TIMELINE TRACK -->
        <div class="roadmap-track">
          <!-- PHASE 1 -->
          <div class="roadmap-phase done">
            <div class="phase-head">
              <div class="phase-badge">✅ Fasa 1 · MVP</div>
              <div class="phase-duration">4 bulan · Selesai</div>
            </div>
            <h3 class="phase-title">Minimum Viable Product</h3>
            <p class="phase-desc">Ciri-ciri asas AGM dengan pematuhan Compliance-by-Design</p>
            <div class="phase-progress">
              <div class="phase-bar" style="width:100%;background:linear-gradient(90deg,#10B981,#047857)"></div>
            </div>
            <div class="phase-percent">100% siap</div>

            <div class="phase-modules">
              <div class="module-chip done">✓ Pengurusan Ahli (CSV)</div>
              <div class="module-chip done">✓ AGM Wizard (5 langkah)</div>
              <div class="module-chip done">✓ Imbasan QR Kehadiran</div>
              <div class="module-chip done">✓ E-Voting Asas (AES-256)</div>
              <div class="module-chip done">✓ Papan Pemuka Pentadbir</div>
              <div class="module-chip done">✓ Satu-Skrin-Satu-Tindakan UI</div>
              <div class="module-chip done">✓ One Click Join (OTP)</div>
            </div>
          </div>

          <!-- PHASE 2 -->
          <div class="roadmap-phase in-progress">
            <div class="phase-head">
              <div class="phase-badge">🔄 Fasa 2 · V1</div>
              <div class="phase-duration">3 bulan · Sedang berjalan</div>
            </div>
            <h3 class="phase-title">Hybrid AI Platform</h3>
            <p class="phase-desc">Persidangan hibrid + AI Governance + Enjin Pematuhan Penuh</p>
            <div class="phase-progress">
              <div class="phase-bar" style="width:78%;background:linear-gradient(90deg,var(--c-warning),#B45309)"></div>
            </div>
            <div class="phase-percent">78% siap</div>

            <div class="phase-modules">
              <div class="module-chip done">✓ Mod Hibrid (5 Layout)</div>
              <div class="module-chip done">✓ AI Minute Writer</div>
              <div class="module-chip done">✓ Enjin Pematuhan SKM</div>
              <div class="module-chip done">✓ Multi-Ejen AI Copilot</div>
              <div class="module-chip done">✓ Notifikasi Bersepadu</div>
              <div class="module-chip done">✓ Auto-Translate Caption</div>
              <div class="module-chip done">✓ Digital Vault (Hash Chain)</div>
              <div class="module-chip progress">⟳ Offline Sync</div>
              <div class="module-chip todo">○ Action Tracker Penuh</div>
            </div>
          </div>

          <!-- PHASE 3 -->
          <div class="roadmap-phase upcoming">
            <div class="phase-head">
              <div class="phase-badge">⏳ Fasa 3 · V2</div>
              <div class="phase-duration">4 bulan · Akan datang</div>
            </div>
            <h3 class="phase-title">SaaS Multi-Tenant Enterprise</h3>
            <p class="phase-desc">Penskalaan mega + integrasi kerajaan + AI Legal Assistant</p>
            <div class="phase-progress">
              <div class="phase-bar" style="width:18%;background:linear-gradient(90deg,#94A3B8,#475569)"></div>
            </div>
            <div class="phase-percent">18% siap</div>

            <div class="phase-modules">
              <div class="module-chip todo">○ Multi-Tenant 100k+ ahli</div>
              <div class="module-chip todo">○ Pembantu Perundangan AI</div>
              <div class="module-chip todo">○ Open API & SDK</div>
              <div class="module-chip todo">○ Government Cloud</div>
              <div class="module-chip todo">○ White Label Enterprise</div>
              <div class="module-chip todo">○ Dedicated Cloud (Platinum)</div>
              <div class="module-chip todo">○ On-site Tech Support</div>
            </div>
          </div>

          <!-- PHASE 4 (FUTURE VISION) -->
          <div class="roadmap-phase future">
            <div class="phase-head">
              <div class="phase-badge">🚀 Fasa 4 · 2028</div>
              <div class="phase-duration">Visi · Cooperative SuperApp</div>
            </div>
            <h3 class="phase-title">Governance Digital Twin</h3>
            <p class="phase-desc">Bukan lagi AGM app — Sistem memori institusi koperasi</p>
            <div class="phase-progress">
              <div class="phase-bar" style="width:5%;background:linear-gradient(90deg,var(--c-accent),#B8860B)"></div>
            </div>
            <div class="phase-percent">Konseptual</div>

            <div class="phase-modules">
              <div class="module-chip future">◆ AI Memory Institusi</div>
              <div class="module-chip future">◆ Predictive Audit</div>
              <div class="module-chip future">◆ Cross-Border ASEAN</div>
              <div class="module-chip future">◆ Live Subtitle (BM/EN/ID/TA/中)</div>
              <div class="module-chip future">◆ Smart Dividend Optimizer</div>
              <div class="module-chip future">◆ Member Marketplace</div>
            </div>
          </div>
        </div>

        <!-- KEY METRICS -->
        <div class="kpi-grid mt-4">
          ${kpiBox("Modul Selesai", "12+", "daripada 40+ dirancang", "success")}
          ${kpiBox("Pematuhan SKM", "98/100", "Auto-checks aktif", "primary")}
          ${kpiBox("Latency E-Voting", "<500ms", "WebSocket optimized", "info")}
          ${kpiBox("Availability SLA", "99.95%", "Multi-AZ Kubernetes", "warning")}
        </div>

        <!-- MILESTONE TIMELINE -->
        <div class="card mt-4">
          <div class="card-head">
            <div class="card-title">📅 Garis Masa Pelancaran</div>
            <span class="badge info">${new Date().getFullYear()} - ${new Date().getFullYear() + 2}</span>
          </div>
          <div class="card-body">
            <div class="milestones">
              ${[
                { date: "Jan 2026", title: "🚀 Pelancaran MVP", desc: "100 koperasi pertama · Subscription Starter RM500", status: "done" },
                { date: "Apr 2026", title: "🧠 Pelancaran AI Copilot", desc: "RAG + Multi-Agent · 1,247 dokumen diindeks", status: "done" },
                { date: "Jul 2026", title: "🏛️ Fasa 2 Siap", desc: "Hybrid mode + Compliance engine + Digital Vault", status: "in-progress" },
                { date: "Okt 2026", title: "🌏 Peluasan ASEAN", desc: "Pejabat Sumatera · Multi-bahasa penuh", status: "todo" },
                { date: "Q1 2027", title: "⚖️ Fasa 3 Enterprise", desc: "Multi-tenant 100k+ ahli · Government Cloud", status: "todo" },
                { date: "Q4 2027", title: "💎 Platinum Tier Live", desc: "Dedicated Cloud + On-site Tech Support", status: "todo" },
                { date: "2028", title: "🦄 Status Unicorn", desc: "Cooperative SuperApp · Sasaran ARR RM 50M", status: "future" },
              ].map((m, i) => `
                <div class="milestone ${m.status}">
                  <div class="ms-line">
                    <div class="ms-dot"></div>
                    ${i < 6 ? '<div class="ms-line-bar"></div>' : ''}
                  </div>
                  <div style="flex:1">
                    <div class="ms-date">${m.date}</div>
                    <div class="ms-title">${m.title}</div>
                    <div class="ms-desc">${m.desc}</div>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>

        <!-- GTM STRATEGY (from Vol 10) -->
        <div class="card mt-4">
          <div class="card-head">
            <div class="card-title">📈 Strategi Go-To-Market (GTM)</div>
            <span class="badge gold">B2B + B2G</span>
          </div>
          <div class="card-body">
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
              <div class="gtm-card">
                <div class="gtm-icon" style="background:var(--c-primary);color:#fff">🏢</div>
                <div style="font-weight:700;margin-top:10px">Jualan Langsung (B2B)</div>
                <div class="text-sm text-2 mt-1">Sasaran 100 koperasi terbesar di Malaysia yang menghadapi isu kuorum & pertikaian E-Voting.</div>
                <div class="mt-3" style="font-size:11px;color:var(--c-text-3)">Status: Aktif</div>
              </div>
              <div class="gtm-card">
                <div class="gtm-icon" style="background:var(--c-success);color:#fff">🛡️</div>
                <div style="font-weight:700;margin-top:10px">Rakan Strategik SKM</div>
                <div class="text-sm text-2 mt-1">Kerjasama dengan Suruhanjaya Koperasi Malaysia untuk menjadikan AGMX standard kepatuhan.</div>
                <div class="mt-3" style="font-size:11px;color:var(--c-text-3)">Status: Dalam rundingan</div>
              </div>
              <div class="gtm-card">
                <div class="gtm-icon" style="background:var(--c-accent);color:var(--c-primary-700)">📣</div>
                <div style="font-weight:700;margin-top:10px">Pemasaran Digital</div>
                <div class="text-sm text-2 mt-1">Kempen kesedaran menumpukan Zero Training Required — warga emas boleh mengundi dalam 5 minit.</div>
                <div class="mt-3" style="font-size:11px;color:var(--c-text-3)">Status: Aktif</div>
              </div>
            </div>

            <hr class="divider">

            <div style="font-weight:700;margin-bottom:10px">💰 Pelan Langganan SaaS</div>
            <div class="pricing-grid">
              ${[
                { plan: "Starter", price: "RM 500", capacity: "50 ahli", features: ["AGM Wizard", "E-Voting Asas", "1 Bahasa"] },
                { plan: "Professional", price: "RM 1,000", capacity: "300 ahli", features: ["Semua Starter", "Multi-bahasa", "QR Scanner", "AI Minute"], pop: true },
                { plan: "Enterprise", price: "RM 2,500", capacity: "1,000 ahli", features: ["Semua Pro", "AI Copilot Penuh", "API Integrasi", "Priority Support"] },
                { plan: "Platinum", price: "RM 5,000", capacity: "1,000+ ahli", features: ["Semua Enterprise", "Dedicated Cloud", "White Label"] },
                { plan: "Unlimited", price: "RM 15,000", capacity: "Unlimited", features: ["Semua Platinum", "On-site AGM Support", "Custom Integration"] },
              ].map(p => `
                <div class="pricing-card ${p.pop ? 'popular' : ''}">
                  ${p.pop ? '<div class="pop-badge">PALING POPULAR</div>' : ''}
                  <div class="plan-name">${p.plan}</div>
                  <div class="plan-price">${p.price}<span>/ tahun</span></div>
                  <div class="plan-cap">${p.capacity}</div>
                  <div class="plan-features">
                    ${p.features.map(f => `<div class="pf-item">✓ ${f}</div>`).join("")}
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }


  /* ============================================================
     ROUTER
     ============================================================ */
  function render() {
    clearAllIntervals();

    if (state.view === "login") {
      document.getElementById("app").innerHTML = `<main class="main" id="main"></main>`;
      safeRender(renderLogin);
      setActiveNav();
      return;
    }
    showLoading();
    safeRender(renderLayout);
    const main = $("#main");
    const renderers = {
      dashboard: renderDashboard,
      members: renderMembers,
      "agm-hall": renderHall,
      voting: renderVoting,
      motions: renderMotions,
      copilot: renderCopilot,
      compliance: renderCompliance,
      vault: renderVault,
      settings: renderSettings,
      wizard: renderWizard,
      "senior-member": renderSeniorMember,
      scanner: renderScanner,
      roadmap: renderRoadmap,
    };
    const fn = renderers[state.view] || renderDashboard;
    safeRender(fn);
  }

  function navigate(view) {
    state.view = view;
    location.hash = "#/" + view;
    render();
  }

  function handleHashChange() {
    const hash = location.hash.replace("#/", "") || "login";
    if (hash !== state.view) {
      state.view = hash;
      render();
    }
  }

  window.addEventListener("hashchange", handleHashChange);

  // Restore persisted theme (shared with the English version)
  try {
    const savedTheme = localStorage.getItem("agmx-theme");
    if (savedTheme && ["default", "dark", "hc"].includes(savedTheme)) {
      state.theme = savedTheme;
      document.body.classList.toggle("theme-dark", savedTheme === "dark");
      document.body.classList.toggle("theme-hc", savedTheme === "hc");
    }
  } catch (e) { /* private mode */ }

  // Restore sidebar rail preference
  try {
    if (localStorage.getItem("agmx-nav") === "collapsed") document.body.classList.add("nav-collapsed");
  } catch (e) { /* private mode */ }

  // Initialize from URL hash or default to login
  const initView = location.hash.replace("#/", "") || "login";
  state.view = initView;
  render();
  startLiveVoteSim();
})();
// Build trigger Mon Sep 28 11:37:15 AM +08 2026
