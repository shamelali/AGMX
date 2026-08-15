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
    agenda: [], candidates: [], motions: [{ id: "M-000", title: "Waiting data", status: "Draf", type: "Biasa", proposer: "-", seconder: "-", proposedAt: "-", votes: { ya: 0, tidak: 0, abstain: 0 }, discussion: [] }], questions: [], actions: [], auditLog: [], health: { activeSessions: 0, wsLatency: 0, bandwidth: 0 }, compliance: { score: 0, aktaChips: [] },
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
      if (m) m.innerHTML = `<div class="fade-in" style="padding:40px;text-align:center"><div style="font-size:48px;margin-bottom:12px">⚠️</div><h2 style="font-size:20px;font-weight: 700;margin-bottom:8px">Unexpected Error</h2><p style="color:var(--c-text-2)">Sorry, an error occurred while displaying this page. Please try again.</p><button class="btn btn-primary mt-3" onclick="location.reload()">Reload</button></div>`;
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
    { route: "dashboard", icon: "dashboard", label: "Dashboard" },
    {
      route: "agm-hall", icon: "calendar", label: "AGM Hall", badge: '<span class="nav-badge live">LIVE</span>',
      children: [
        { route: "agm-hall", layout: "town-hall", label: "Town Hall" },
        { route: "agm-hall", layout: "conference", label: "Conference" },
        { route: "agm-hall", layout: "presentation", label: "Presentation" },
        { route: "agm-hall", layout: "discussion", label: "Debate" },
        { route: "agm-hall", layout: "voting", label: "Voting" },
      ],
    },
    {
      route: "voting", icon: "vote", label: "E-Voting", badge: '<span class="nav-badge">2</span>',
      children: [
        { route: "voting", label: "Candidates & Ballots" },
        { route: "motions", label: "Motions & Resolutions" },
        { route: "scanner", label: "QR Check-in" },
      ],
    },
    { route: "members", icon: "users", label: "Members & Organization", badge: `<span class="nav-badge">${D.members.length}</span>` },
    { route: "copilot", icon: "ai", label: "AI Copilot", badge: '<span class="nav-badge">4 agents</span>' },
    { route: "compliance", icon: "shield", label: "Compliance" },
    { route: "vault", icon: "vault", label: "Digital Vault" },
    {
      route: "settings", icon: "cog", label: "Settings",
      children: [
        { route: "settings", label: "General & Accessibility" },
        { route: "wizard", label: "AGM Wizard" },
        { route: "senior-member", label: "Senior Citizen Mode" },
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
        <button class="sidebar-collapse" id="sidebar-collapse" title="Collapse/expand menu" aria-label="Collapse or expand the sidebar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="sidebar-inner scrollbar">
        <div class="sidebar-brand">
          <div class="brand-mark">AG</div>
          <div class="brand-text">
            <div class="b1">AGMX</div>
            <div class="b2">Governance OS</div>
          </div>
          <button class="sidebar-close" id="sidebar-close" aria-label="Close menu">${ICONS.x}</button>
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
          <button class="h-icon-btn hamburger" id="hamburger-btn" aria-label="Open navigation menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div>
            <div class="h-title" id="h-title">Dashboard</div>
            <div class="h-subtitle" id="h-subtitle">${D.cooperative.name}</div>
          </div>
          <div class="h-divider"></div>
          <div class="h-live-pill"><span class="h-live-dot"></span> AGM LIVE · ${D.agm.elapsed}</div>
        </div>
        <div class="h-right">
          <button class="h-icon-btn" id="ai-toggle" title="AI Copilot">${ICONS.sparkle}</button>
          <button class="h-icon-btn" title="Notifications" id="notif-btn">${ICONS.bell}<span class="dot"></span></button>
          <button class="h-icon-btn" title="${state.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}" id="theme-toggle" aria-label="${state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}">${state.theme === 'dark' ? ICONS.sun : ICONS.moon}</button>
          <a class="h-icon-btn lang-switch" href="app.html${location.hash}" title="Tukar ke Bahasa Melayu" aria-label="Tukar ke Bahasa Melayu">BM</a>
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

      <footer class="statusbar" aria-label="System status">
        <span class="sb-item"><span class="sb-dot ok"></span> System Online</span>
        <span class="sb-item">WS <span class="text-mono" id="sb-latency">${D.health.wsLatency}ms</span></span>
        <span class="sb-item">🔗 Hash chain synced <span class="text-mono">#7891</span></span>
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
            <div class="dh-sub">4 active agents · RAG + Always-on Audit</div>
          </div>
          <button class="h-icon-btn" id="drawer-close" style="color:#fff">${ICONS.x}</button>
        </div>
        <div class="copilot-drawer-body">
          <div class="ai-alert">
            <div class="ai-alert-head">⚡ AI Chairman Alert</div>
            <div class="ai-alert-text">M-001 has already received 248 YES votes. Quorum satisfied. The voting phase can close in 2 minutes.</div>
            <div class="ai-alert-actions">
              <button class="btn btn-sm btn-primary">Close Voting</button>
              <button class="btn btn-sm btn-ghost">Extend 2 min</button>
            </div>
          </div>
          <div class="ai-alert" style="background:#FEE2E2;border-left-color:#EF4444;">
            <div class="ai-alert-head" style="color:#B91C1C">⚠️ AI Compliance Alert</div>
            <div class="ai-alert-text">M-003 does not meet UUK Clause 7.3 (no Seconder within 15 minutes). Auto-drop recommended.</div>
            <div class="ai-alert-actions">
              <button class="btn btn-sm btn-danger">Auto-Drop</button>
              <button class="btn btn-sm btn-ghost">Notify Chairman</button>
            </div>
          </div>
          <div style="font-size:12px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:0.5px;margin:16px 0 8px">Smart Suggestions</div>
          <div class="ai-suggestion">
            <div class="as-head">📊 AI Question Organizer</div>
            <div class="as-text">12 repeated questions about Dividendds — merge into 1 for the Treasurer to answer at once.</div>
          </div>
          <div class="ai-suggestion">
            <div class="as-head">📝 AI Minute Writer</div>
            <div class="as-text">The 16th AGM minutes draft is being generated. Expected ready in 4 minutes (98% accuracy).</div>
          </div>
          <div class="ai-suggestion">
            <div class="as-head">🎯 AI Auditor</div>
            <div class="as-text">2 resolutions from the 15th AGM are still incomplete. Show compliance status in AG-04?</div>
          </div>
        </div>
        <div class="copilot-drawer-foot">
          <button class="btn btn-primary btn-lg" style="width:100%">${ICONS.chat}<span>Open Full Copilot</span></button>
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
      dashboard: ["Dashboard", "AGM Overview & Quorum"],
      members: ["Members & Organization", "Membership management & voting eligibility"],
      "agm-hall": ["AGM Hall", "Hybrid Conference · Voting Mode"],
      voting: ["Smart E-Voting", "Board election candidate gallery"],
      motions: ["Motions & Resolutions", "Motion chain engine & meeting minutes"],
      copilot: ["AI Governance Copilot", "Multi-agent RAG · Smart agents"],
      compliance: ["SKM Compliance", "Akta Koperasi 1993 · GP14 · UUK"],
      vault: ["Digital Governance Vault", "Tamper-proof ledger · Hash chain"],
      settings: ["Settings", "Accessibility, language & senior mode"],
      wizard: ["AGM Wizard", "Create your AGM · 5 guided steps"],
      "senior-member": ["Senior Citizen Mode", "One Click Join interface for members"],
      scanner: ["Attendance Registration", "QR Scanner · Live quorum sync"],
      roadmap: ["Product Roadmap", "3-phase plan → Cooperative SuperApp"],
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
      btn.title = theme === "dark" ? "Light Mode" : "Dark Mode";
      btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    }
  }

  function cycleTheme() {
    // Header button = simple dark/light toggle (HC stays available in Settings)
    const next = state.theme === "dark" ? "default" : "dark";
    applyTheme(next);
    showToast(next === "dark" ? "🌙 Dark Mode enabled" : "☀️ Light Mode enabled");
  }

  function toggleSenior() {
    state.seniorMode = !state.seniorMode;
    document.body.classList.toggle("senior-mode", state.seniorMode);
    showToast(state.seniorMode ? "🧓 Senior Friendly Mode: ON" : "Senior Mode turned off");
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
          <h1>Cooperative Governance Operating System</h1>
          <p class="l-sub">Log in to manage ${D.agm.title}</p>

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

            <div class="label">Choose Your Role</div>
            <div class="role-pick">
              <div class="role-pick-card active" data-role="secretary">
                <div class="rp-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                <div class="rp-title">Secretary</div>
                <div class="rp-sub">AGM Administrator</div>
              </div>
              <div class="role-pick-card" data-role="chairman">
                <div class="rp-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg></div>
                <div class="rp-title">Chairman</div>
                <div class="rp-sub">Hall controls</div>
              </div>
              <div class="role-pick-card" data-role="member">
                <div class="rp-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
                <div class="rp-title">Member</div>
                <div class="rp-sub">Vote</div>
              </div>
            </div>

            <div class="label">Enter the 6-digit OTP sent to you</div>
            <div class="otp-row">
              <input class="otp-box" maxlength="1" value="4">
              <input class="otp-box" maxlength="1" value="8">
              <input class="otp-box" maxlength="1" value="2">
              <input class="otp-box" maxlength="1" value="1">
              <input class="otp-box" maxlength="1" value="7">
              <input class="otp-box" maxlength="1" value="9">
            </div>

            <button class="btn btn-primary btn-xl" style="width:100%; justify-content:center;" id="login-btn">
              ${ICONS.check}<span>Verify & Enter AGM</span>
            </button>

            <div class="login-foot">
              Code expires in 02:48 · <a href="#">Resend</a> · <a href="#">Not a member?</a>
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
          showToast("Passkey: Use fingerprint / Face ID");
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
      btn.innerHTML = `<span class="spinner"></span><span>Verifying OTP...</span>`;
      setTimeout(() => {
        navigate("dashboard");
        showToast("🔐 Login successful. Welcome to the 16th AGM!");
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
            <h1 class="page-title">Welcome, Mrs. Aishah 👋</h1>
            <div class="page-sub">16th AGM in progress · Conference day 2 · Quorum 31.4%</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost">${ICONS.download}<span>Export Report</span></button>
            <button class="btn btn-ghost" data-route="senior-member">🧓<span>Senior Preview</span></button>
            <button class="btn btn-primary" data-route="agm-hall">${ICONS.cam}<span>Enter AGM Hall</span></button>
          </div>
        </div>

        <div class="dash-greeting">
          <div>
            <h2>${D.agm.title}</h2>
            <p>${D.agm.date} · ${D.agm.time} · ${D.agm.venue}. The conference continues with Agenda AG-06 — Dividendd & Surplus Distribution.</p>
          </div>
          <div class="g-actions">
            <button class="btn" style="background:rgba(255,255,255,0.2); color:#fff; border:1px solid rgba(255,255,255,0.3)">${ICONS.bell}<span>Notices (3)</span></button>
            <button class="btn btn-accent" data-route="wizard">${ICONS.plus}<span>Create AGM</span></button>
            <button class="btn btn-accent" data-route="scanner">${ICONS.qr}<span>Scan QR</span></button>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi">
            <div class="kpi-icon">${ICONS.users}</div>
            <div class="kpi-label">Total Members</div>
            <div class="kpi-value">${D.cooperative.members.toLocaleString()}</div>
            <div class="kpi-trend">+8.2% year on year</div>
          </div>
          <div class="kpi" style="background:linear-gradient(135deg,#065F46,#10B981);color:#fff;">
            <div class="kpi-icon" style="background:rgba(255,255,255,0.2);color:#fff">${ICONS.vote}</div>
            <div class="kpi-label" style="color:rgba(255,255,255,0.7)">Votes So Far</div>
            <div class="kpi-value">${(D.motions[0].votes.ya + D.motions[0].votes.tidak + D.motions[0].votes.abstain).toLocaleString()}</div>
            <div class="kpi-trend" style="color:#fff">↑ Active in ${D.motions[0].id}</div>
          </div>
          <div class="kpi">
            <div class="kpi-icon" style="background:#FEF3C7;color:#92400E">${ICONS.calendar}</div>
            <div class="kpi-label">AGM Session</div>
            <div class="kpi-value">${D.agm.id.split("-").pop()}</div>
            <div class="kpi-trend down">Ends in 1h 42m</div>
          </div>
          <div class="kpi">
            <div class="kpi-icon" style="background:#DBEAFE;color:#1E40AF">${ICONS.shield}</div>
            <div class="kpi-label">Compliance Score</div>
            <div class="kpi-value">${D.compliance.score}<span style="font-size:18px;color:var(--c-text-3)">/100</span></div>
            <div class="kpi-trend">Akta Koperasi 1993 · GP14</div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1.6fr 1fr; gap:20px; margin-top:20px">
          <div>
            <div class="card">
              <div class="card-head">
                <div class="card-title">Live Meeting Health</div>
                <span class="badge success"><span class="dot"></span> All Systems Normal</span>
              </div>
              <div class="card-body">
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
                  ${healthCard("Active Sessions", D.health.activeSessions, "members online now", ICONS.users, "#10B981")}
                  ${healthCard("WebSocket Latency", D.health.wsLatency + " ms", "↓ 8 ms vs yesterday", ICONS.screen, "#3B82F6")}
                  ${healthCard("Bandwidth", D.health.bandwidth + "%", "Auto-scaling active", ICONS.globe, "#F59E0B")}
                  ${healthCard("AI Alerts", "2 active", "Compliance + Chairman", ICONS.alert, "#EF4444")}
                </div>
                <hr class="divider">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                  <div style="font-weight:700">Active Agenda List</div>
                  <span class="text-sm text-3">${D.agenda.filter(a => a.status === "Completed").length}/${D.agenda.length || "0"} completed</span>
                </div>
                <div class="agenda-list">
                  ${D.agenda.slice(0, 5).map(a => `
                    <div class="agenda-item ${a.status === 'In Progress' ? 'active' : ''} ${a.status === 'Completed' ? 'done' : ''}">
                      <div class="agenda-num">${a.id.split("-")[1]}</div>
                      <div class="agenda-text">
                        <div class="agenda-title">${a.title}</div>
                        <div class="agenda-meta"><span>${a.type}</span> · <span>${a.duration} minutes</span> · <span>${a.presenter}</span></div>
                      </div>
                      <span class="badge ${a.status === 'Completed' ? 'success' : a.status === 'In Progress' ? 'warning' : ''}">${a.status}</span>
                    </div>
                  `).join("")}
                </div>
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-head">
                <div class="card-title">FY 2025 Financial Summary (AI Summary)</div>
                <span class="badge info">${ICONS.sparkle} Auto-generated</span>
              </div>
              <div class="card-body">
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
                  ${financeCard("Revenue", f.revenue, "+9.8% YoY", "#0B5394")}
                  ${financeCard("Net Profit", f.netProfit, f.yoyProfit + " YoY", "#10B981")}
                  ${financeCard("Proposed Dividendd", f.dividend, "from Net Surplus", "#8A6A0B")}
                </div>
                <div class="fin-chart">
                  <div class="fc-title">Net Profit Trend (5 years)</div>
                  ${finChartSvg()}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div class="card">
              <div class="card-head">
                <div class="card-title">Quorum Status</div>
                <span class="badge success"><span class="dot"></span> COMPLIANT</span>
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
                  <div class="quorum-target-tag" style="left:${target}%">Target ${target}%</div>
                </div>`;
                })()}
                <div class="flex justify-between text-sm" style="opacity:0.85;margin-top:14px">
                  <span>Minimum requirement: ${D.agm.quorumPct > D.cooperative.quorumPct ? '✅' : '⚠️'} ${D.agm.quorumRequired} members (${D.cooperative.quorumPct}%)</span>
                  <span class="quorum-status"><span class="dot"></span> LIVE</span>
                </div>
                <div style="margin-top:14px; font-size:12px; opacity:0.8">
                  Mode: Hybrid · Physical: 142 · Online: 261
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
                  <div class="ai-alert-text">12 member questions about "Dividendds" can be merged into 1 to answer at once.</div>
                  <div class="ai-alert-actions">
                    <button class="btn btn-sm btn-primary">Merge Questions</button>
                  </div>
                </div>
                <div class="ai-alert" style="background:#D1FAE5;border-left-color:#10B981;">
                  <div class="ai-alert-head" style="color:#047857">✅ AI Compliance</div>
                  <div class="ai-alert-text">All notices sent 21 days in advance — exceeding the 15-day UUK minimum.</div>
                </div>
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-head">
                <div class="card-title">Digital Meeting Pack</div>
              </div>
              <div class="card-body" style="display:grid;gap:10px">
                ${meetingPack("AGM Notice", "PDF · 4 pages · Sent 02 Jun", "ready")}
                ${meetingPack("Agenda & Minit", "PDF · 12 pages", "ready")}
                ${meetingPack("2025 Financial Statements", "PDF · 28 pages", "ready")}
                ${meetingPack("Annual Report", "PDF · 64 pages", "ready")}
                ${meetingPack("AGM-16 Minutes Draft", "AI-generated · Generating", "generating")}
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
          : `<span class="badge ${stColor}"><span class="dot"></span> Generating</span>`}
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
      <svg viewBox="0 0 ${w} ${h + 10}" preserveAspectRatio="none" style="width:100%;height:auto" role="img" aria-label="Trend untung bersih 5 years: RM 820K (2021) ke RM 1,420K (2025)">
        <defs>
          <linearGradient id="finG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0B5394" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#0B5394" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#finG)"/>
        <path d="${path}" fill="none" stroke="#0B5394" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        ${data.map((v, i) => `<g class="fin-point"><circle cx="${i * stepX}" cy="${yOf(v)}" r="4" fill="#fff" stroke="#0B5394" stroke-width="2"><title>${years[i]}: RM ${(v / 1000).toFixed(2)} Million</title></circle><circle cx="${i * stepX}" cy="${yOf(v)}" r="12" fill="transparent"><title>${years[i]}: RM ${(v / 1000).toFixed(2)} Million</title></circle></g>`).join("")}
      </svg>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--c-text-3);margin-top:4px">
        ${years.map(y => `<span>${y}</span>`).join("")}
      </div>
      <div class="fin-legend">
        <span class="fin-legend-item"><span class="fin-legend-swatch" style="background:#0B5394"></span> Net Profit (RM Million)</span>
        <span class="fin-legend-item" style="color:var(--c-success);font-weight:600">↑ +73% over 5 years</span>
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
      if (state.agendaFilter === "arrears" && m.status !== "Arrears") return false;
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
    const arrearsCount = D.members.filter(m => m.status === "Arrears").length;
    const proxyCount = D.members.filter(m => m.proxy).length;
    main.innerHTML = `
      <div class="fade-in">
        <div class="page-head">
          <div>
            <h1 class="page-title">Members & Organization</h1>
            <div class="page-sub">${D.members.length} registered members · ${eligibleCount} eligible to vote · ${arrearsCount} arrears</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost">${ICONS.download}<span>Export CSV</span></button>
            <button class="btn btn-ghost">${ICONS.upload}<span>Import CSV</span></button>
            <button class="btn btn-primary">${ICONS.plus}<span>Add Member</span></button>
          </div>
        </div>

        <div class="kpi-grid mb-4">
          ${kpiBox("Total Members", D.members.length, "+8.2%", "primary")}
          ${kpiBox("Eligible to Vote", eligibleCount, "Auto-filter active", "success")}
          ${kpiBox("Arrears", arrearsCount, "SKM clarification needed", "warning")}
          ${kpiBox("Using Proxy", proxyCount, "Proxy letters verified", "info")}
        </div>

        <div class="card">
          <div class="toolbar">
            <div class="search">
              ${ICONS.search}
              <input type="text" placeholder="Search name or member no..." id="member-search" value="${state.memberSearch}">
            </div>
            <div class="filter-chip ${state.agendaFilter === 'all' ? 'active' : ''}" data-filter="all">All</div>
            <div class="filter-chip ${state.agendaFilter === 'eligible' ? 'active' : ''}" data-filter="eligible">✓ Eligible</div>
            <div class="filter-chip ${state.agendaFilter === 'ineligible' ? 'active' : ''}" data-filter="ineligible">✗ Ineligible</div>
            <div class="filter-chip ${state.agendaFilter === 'arrears' ? 'active' : ''}" data-filter="arrears">Arrears</div>
            <div class="filter-chip ${state.agendaFilter === 'proxy' ? 'active' : ''}" data-filter="proxy">Proxy</div>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th><input type="checkbox" aria-label="Select all"></th>
                <th class="th-sort" data-sort="name" aria-sort="${ariaSort('name')}">Name & Member No. ${sortIcon('name')}</th>
                <th>No. IC</th>
                <th class="th-sort" data-sort="shares" aria-sort="${ariaSort('shares')}">Shares ${sortIcon('shares')}</th>
                <th class="th-sort" data-sort="status" aria-sort="${ariaSort('status')}">Status ${sortIcon('status')}</th>
                <th>Voting Eligibility</th>
                <th>Proxy</th>
                <th>Attendance</th>
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
                    <span class="badge ${m.status === 'Active' ? 'success' : 'warning'}">
                      <span class="dot"></span> ${m.status}${m.arrears > 0 ? ` (RM ${m.arrears})` : ''}
                    </span>
                  </td>
                  <td>
                    <span class="eligibility-chip ${m.eligible ? 'eligible' : 'ineligible'}">
                      ${m.eligible ? '✓' : '✕'} ${m.eligible ? 'Eligible' : 'Blocked'}
                    </span>
                  </td>
                  <td class="text-sm">${m.proxy ? `<span style="color:var(--c-info)">→ ${m.proxy}</span>` : '<span class="text-3">—</span>'}</td>
                  <td>
                    ${m.attended
                      ? '<span class="badge success"><span class="dot"></span> Hadir</span>'
                      : '<span class="badge"><span class="dot"></span> Not Yet</span>'}
                  </td>
                  <td>
                    <button class="btn btn-sm btn-ghost">${ICONS.screen}</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          ${filtered.length === 0 ? '<div style="padding:40px;text-align:center;color:var(--c-text-3)">No members match your search</div>' : ''}
          <div class="card-foot flex items-center justify-between text-sm">
            <div class="text-3">Showing ${startIdx + 1}-${Math.min(startIdx + state.membersPerPage, filtered.length)} of ${filtered.length} members</div>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-ghost" data-mpage="prev" ${page <= 1 ? 'disabled' : ''}>Prev</button>
              ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p =>
                `<button class="btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}" data-mpage="${p}">${p}</button>`
              ).join("")}
              <button class="btn btn-sm btn-ghost" data-mpage="next" ${page >= totalPages ? 'disabled' : ''}>Next</button>
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
            <span class="badge danger" style="font-size:13px;padding:6px 12px"><span class="dot"></span> IN PROGRESS · ${D.agm.elapsed}</span>
            <button class="btn btn-ghost">${ICONS.share || ICONS.download}<span>Record</span></button>
            <button class="btn btn-primary" data-route="voting">${ICONS.vote}<span>Open Voting Mode</span></button>
          </div>
        </div>

        <div class="hall">
          <div class="hall-main">
            <div class="hall-backdrop"></div>
            <div class="hall-header">
              <div>
                <div class="hall-title">AGM Hall — Layout ${state.selectedLayout === 'town-hall' ? 'Town Hall' : state.selectedLayout === 'conference' ? 'Conference' : state.selectedLayout === 'presentation' ? 'Presentation' : state.selectedLayout === 'discussion' ? 'Debate' : 'Voting'}</div>
                <div class="hall-subtitle">AG-06 · Dividendd & Surplus Distribution</div>
              </div>
              <div class="layout-tabs">
                <div class="layout-tab ${state.selectedLayout === 'town-hall' ? 'active' : ''}" data-layout="town-hall">Town Hall</div>
                <div class="layout-tab ${state.selectedLayout === 'conference' ? 'active' : ''}" data-layout="conference">Conference</div>
                <div class="layout-tab ${state.selectedLayout === 'presentation' ? 'active' : ''}" data-layout="presentation">Presentation</div>
                <div class="layout-tab ${state.selectedLayout === 'discussion' ? 'active' : ''}" data-layout="discussion">Debate</div>
                <div class="layout-tab ${state.selectedLayout === 'voting' ? 'active' : ''}" data-layout="voting">Voting</div>
              </div>
            </div>
            <div class="stage-layout mode-${state.selectedLayout}">
              ${state.selectedLayout === 'town-hall' ? `
                <div class="stage-card feature">
                  <div class="stage-screen" style="background:linear-gradient(135deg, rgba(212,160,23,0.1), rgba(11,83,148,0.1))">
                    <div style="text-align:center">
                      <div class="speaker-tile">AC</div>
                      <div class="speaker-name" style="margin-top:14px;font-size:20px">Dato' Ariffin Bin Kassim</div>
                      <div class="speaker-role" style="font-size:14px;opacity:0.85">KOPEMAJU Chairman</div>
                      <div class="speaker-live-meta">
                        <span class="slm-chip live"><span class="h-live-dot"></span> Speaking now · <span id="speaker-timer">04:12</span></span>
                        <span class="slm-chip">📋 AG-06 · Dividendd & Surplus Distribution</span>
                        <span class="slm-chip">🗳️ M-001 being voted</span>
                      </div>
                    </div>
                  </div>
                  <div class="live-transcript">
                    <div class="lt-head">🔊 Live Transcript · Auto-translate</div>
                    <div class="lt-line"><b>Dato' Ariffin:</b> "Members, we are now discussing the 8% dividend distribution from the RM 1.42 million surplus..."</div>
                    <div class="lt-line dim"><b>AI (MS):</b> "Ahli sekalian, kita kini membincangkan pembahagian dividen 8% daripada lebihan RM 1.42 juta..."</div>
                  </div>
                </div>
              ` : state.selectedLayout === 'conference' ? `
                <div class="stage-card feature">
                  <div class="stage-screen">
                    <div style="text-align:center">
                      <div class="speaker-tile">AC</div>
                      <div class="speaker-name" style="margin-top:14px">Dato' Ariffin (Chairman)</div>
                      <div class="speaker-role">Debating M-001</div>
                    </div>
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:14px">
                  <div class="stage-card">
                    <div class="stage-screen" style="min-height:120px">
                      <div style="text-align:center">
                        <div class="speaker-tile s-2 sm">VK</div>
                        <div class="speaker-name" style="margin-top:8px;font-size:13px">Mr. Vijay Kumar</div>
                        <div class="speaker-role" style="font-size:11px">Proposer of M-001</div>
                      </div>
                    </div>
                  </div>
                  <div class="stage-card">
                    <div class="stage-screen" style="min-height:120px">
                      <div style="text-align:center">
                        <div class="speaker-tile s-3 sm">WS</div>
                        <div class="speaker-name" style="margin-top:8px;font-size:13px">Mrs. Wong</div>
                        <div class="speaker-role" style="font-size:11px">Seconder</div>
                      </div>
                    </div>
                  </div>
                </div>
              ` : state.selectedLayout === 'presentation' ? `
                <div class="stage-card feature">
                  <div class="stage-screen" style="display:flex;flex-direction:column;padding:32px">
                    <div style="background:rgba(255,255,255,0.05);padding:24px;border-radius:12px;width:100%">
                      <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.5);margin-bottom:8px">Slide 14 / 28</div>
                      <div style="font-size:28px;font-weight: 700;margin-bottom:12px">FY 2025 Net Profit Analysis</div>
                      <div style="font-size:16px;line-height:1.6;opacity:0.9">Cooperative revenue grew 9.8% to RM 12.84 million, with net profit of RM 1.42 million. An 8% dividend is proposed — above the previous 3-year average.</div>
                      <div style="margin-top:18px;display:flex;gap:14px">
                        <div style="flex:1;padding:14px;background:rgba(16,185,129,0.2);border-radius:8px"><div style="font-size:11px;opacity:0.7">Revenue</div><div style="font-size:22px;font-weight: 700">RM 12.84M</div></div>
                        <div style="flex:1;padding:14px;background:rgba(212,160,23,0.2);border-radius:8px"><div style="font-size:11px;opacity:0.7">Dividend</div><div style="font-size:22px;font-weight: 700">8%</div></div>
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
                  <div style="font-size:13px;font-weight:700;opacity:0.8">Speaker Queue</div>
                  <div class="speakers-row" style="justify-content:flex-start;flex-direction:column;align-items:stretch;gap:8px">
                    ${[
                      { name: "Mr. Muthusamy Gopal", role: "Member · 71 years", initial: "MG", cls: "s-3" },
                      { name: "Mrs. Zaiton (Proxy: Mrs. Fatimah)", role: "Member · 75 years", initial: "ZF", cls: "s-4" },
                      { name: "Mr. Lim Chong Wei", role: "Chairman Candidate", initial: "LC", cls: "s-2" },
                      { name: "Ms. Nurul Huda", role: "Member · 32 years", initial: "NH", cls: "s-5" },
                    ].map((s, i) => `
                      <div class="flex items-center gap-3" style="background:rgba(255,255,255,0.04);padding:10px;border-radius:10px">
                        <div style="width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,0.1);display:grid;place-items:center;font-size:11px;font-weight:700">${i + 1}</div>
                        <div class="speaker-tile ${s.cls} sm">${s.initial}</div>
                        <div style="flex:1">
                          <div style="font-weight: 500;font-size:13px">${s.name}</div>
                          <div style="font-size:11px;opacity:0.6">${s.role}</div>
                        </div>
                        <span class="badge">${i === 0 ? '🎤 Speaking now' : 'Waiting'}</span>
                      </div>
                    `).join("")}
                  </div>
                </div>
                <div class="stage-card">
                  <div style="font-size:13px;font-weight:700;opacity:0.8">Live Caption & Translate</div>
                  <div style="background:rgba(0,0,0,0.3);padding:14px;border-radius:8px;flex:1;display:flex;flex-direction:column;gap:10px;font-size:13px">
                    <div><span style="color:#D4A017;font-weight:700">Muthusamy:</span> I fully support the 8% dividend rate — it is reasonable and aligned with this year's performance.</div>
                    <div style="opacity:0.6"><span style="color:#10B981;font-weight:700">AI Auto-Translate (MS):</span> "Saya menyokong penuh kadar dividen 8% — ia munasabah dan selari dengan prestasi tahun ini."</div>
                    <div><span style="color:#D4A017;font-weight:700">Zaiton:</span> Could you explain the calculation formula?</div>
                    <div style="opacity:0.6"><span style="color:#10B981;font-weight:700">AI Auto-Translate (TA):</span> "கணக்கீடு சூத்திரத்தை விளக்க முடியுமா?"</div>
                  </div>
                  <div style="font-size:11px;opacity:0.5;text-align:center">🔊 Audio translated in real time by AI</div>
                </div>
              ` : `
                <div class="stage-card feature">
                  <div style="text-align:center">
                    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.6">M-001 VOTING IN PROGRESS</div>
                    <div style="font-size:26px;font-weight: 700;margin:10px 0 6px">Pembahagian Dividend 8%</div>
                    <div style="font-size:14px;opacity:0.8;margin-bottom:24px">from RM 1.42 Million Net Surplus</div>

                    ${(function() { const _t = D.motions[0].votes.ya + D.motions[0].votes.tidak + D.motions[0].votes.abstain; const _s = _t > 0 ? _t : 1; return `
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;max-width:580px;margin:0 auto">
                      <div style="background:rgba(16,185,129,0.2);padding:24px 14px;border-radius:14px;border:1px solid rgba(16,185,129,0.4)">
                        <div style="font-size:42px;font-weight: 700;color:#10B981">${D.motions[0].votes.ya}</div>
                        <div style="font-size:14px;font-weight:700;letter-spacing:1px;margin-top:6px">YES</div>
                        <div style="font-size:11px;opacity:0.7;margin-top:4px">${Math.round(D.motions[0].votes.ya / _s * 100)}%</div>
                      </div>
                      <div style="background:rgba(239,68,68,0.2);padding:24px 14px;border-radius:14px;border:1px solid rgba(239,68,68,0.4)">
                        <div style="font-size:42px;font-weight: 700;color:#EF4444">${D.motions[0].votes.tidak}</div>
                        <div style="font-size:14px;font-weight:700;letter-spacing:1px;margin-top:6px">NO</div>
                        <div style="font-size:11px;opacity:0.7;margin-top:4px">${Math.round(D.motions[0].votes.tidak / _s * 100)}%</div>
                      </div>
                      <div style="background:rgba(148,163,184,0.2);padding:24px 14px;border-radius:14px;border:1px solid rgba(148,163,184,0.4)">
                        <div style="font-size:42px;font-weight: 700;color:#94A3B8">${D.motions[0].votes.abstain}</div>
                        <div style="font-size:14px;font-weight:700;letter-spacing:1px;margin-top:6px">ABSTAIN</div>
                        <div style="font-size:11px;opacity:0.7;margin-top:4px">${Math.round(D.motions[0].votes.abstain / _s * 100)}%</div>
                      </div>
                    </div>`})()}

                    <div style="margin-top:30px;display:flex;justify-content:center;gap:14px">
                      <button class="btn btn-success btn-xl" id="hall-close-vote">${ICONS.check}<span>Close Voting</span></button>
                      <button class="btn btn-ghost btn-xl" style="background:rgba(255,255,255,0.1); color:#fff; border-color:rgba(255,255,255,0.2)">${ICONS.vote}<span>Extend 2 min</span></button>
                    </div>

                    <div style="margin-top:24px;font-size:12px;opacity:0.6">313 of 403 quorum members have voted · Ends: 11:45</div>
                  </div>
                </div>
              `}
            </div>
            <div class="hall-controls">
              <div class="hall-actions">
                <button class="hall-btn" title="Microphone">${ICONS.mic}</button>
                <button class="hall-btn" title="Camera">${ICONS.cam}</button>
                <button class="hall-btn" title="Screen">${ICONS.screen}</button>
                <button class="hall-btn" title="Subtitle">${ICONS.volume}</button>
              </div>
              <div class="hall-actions">
                <button class="hall-btn primary lg" title="Raise Hand">${ICONS.plus}</button>
              </div>
              <div class="hall-actions">
                <button class="hall-btn" title="Record">${ICONS.download}</button>
                <button class="hall-btn danger" title="End Meeting" id="hall-end-btn" aria-label="End the meeting">${ICONS.phoneOff}</button>
              </div>
            </div>
          </div>

          <div class="hall-side">
            <div class="card">
              <div class="card-head">
                <div class="card-title">Session Agenda</div>
                <span class="badge info">${D.agenda.filter(a => a.status === "Completed").length}/${D.agenda.length}</span>
              </div>
              <div class="agenda-list">
                ${D.agenda.map(a => `
                  <div class="agenda-item ${a.status === 'In Progress' ? 'active' : ''} ${a.status === 'Completed' ? 'done' : ''}">
                    <div class="agenda-num">${a.id.split("-")[1]}</div>
                    <div class="agenda-text">
                      <div class="agenda-title">${a.title}</div>
                      <div class="agenda-meta"><span>${a.type}</span> · <span>${a.duration}m</span></div>
                    </div>
                    <span class="badge ${a.status === 'Completed' ? 'success' : a.status === 'In Progress' ? 'warning' : ''}">${a.status === 'Completed' ? '✓' : a.status === 'In Progress' ? '●' : '○'}</span>
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
                  <div style="font-weight:700;color:#92400E">📊 Questions Merged</div>
                  <div style="color:var(--c-text-2);margin-top:2px">12 questions about Dividendds → 1 question</div>
                </div>
                <div style="background:#D1FAE5;padding:10px;border-radius:8px;font-size:12.5px;margin-bottom:10px">
                  <div style="font-weight:700;color:#047857">⏱️ Reminder</div>
                  <div style="color:var(--c-text-2);margin-top:2px">M-001 has 4 minutes left before auto-close</div>
                </div>
                <div style="background:#FEE2E2;padding:10px;border-radius:8px;font-size:12.5px">
                  <div style="font-weight:700;color:#B91C1C">⚠️ Compliance</div>
                  <div style="color:var(--c-text-2);margin-top:2px">M-003 auto-dropped (no Seconder)</div>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-head">
                <div class="card-title">Speaker Queue</div>
                <span class="badge warning">4 waiting</span>
              </div>
              <div class="queue-list">
                <div class="queue-item active">
                  <div class="queue-num">1</div>
                  <div class="member-avatar">MG</div>
                  <div style="flex:1"><div style="font-size:13px;font-weight: 500">Mr. Muthusamy</div><div style="font-size:11px;color:var(--c-text-3)">3 minutes</div></div>
                </div>
                <div class="queue-item">
                  <div class="queue-num">2</div>
                  <div class="member-avatar">ZF</div>
                  <div style="flex:1"><div style="font-size:13px;font-weight: 500">Mrs. Zaiton</div><div style="font-size:11px;color:var(--c-text-3)">Proxy active</div></div>
                </div>
                <div class="queue-item">
                  <div class="queue-num">3</div>
                  <div class="member-avatar">LC</div>
                  <div style="flex:1"><div style="font-size:13px;font-weight: 500">Mr. Lim CW</div><div style="font-size:11px;color:var(--c-text-3)">Just registered</div></div>
                </div>
                <div class="queue-item">
                  <div class="queue-num">4</div>
                  <div class="member-avatar">NH</div>
                  <div style="flex:1"><div style="font-size:13px;font-weight: 500">Ms. Nurul Huda</div><div style="font-size:11px;color:var(--c-text-3)">Just registered</div></div>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-head">
                <div class="card-title">⚡ Panic Button</div>
              </div>
              <div class="card-body" style="padding:14px">
                <button class="btn btn-danger btn-lg" style="width:100%; justify-content:center;">
                  <span style="font-size:18px">🆘</span>
                  <span>I Need Help</span>
                </button>
                <div class="text-3 text-xs" style="margin-top:8px;text-align:center">An admin will call you within 30 seconds</div>
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
        title: "End the Meeting?",
        message: "All member sessions will be terminated and the final minutes will be locked. This action cannot be undone.",
        confirmLabel: "Yes, End Meeting",
        danger: true,
        onConfirm: () => showToast("Meeting ended. Final minutes are being generated.", "success"),
      });
    });
    safeAdd($("#hall-close-vote"), "click", () => {
      showConfirm({
        title: "Close Voting on M-001?",
        message: "313 of 403 members have voted. Members who have not voted will no longer be able to vote.",
        confirmLabel: "Close Voting",
        onConfirm: () => showToast("✅ Voting on M-001 closed. Results finalized.", "success"),
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
    const seatCounts = { "Chairman": 1, "Deputy Chairman": 1, "Board Member": 6 };
    const selectedCount = state.selectedCandidates.size;

    const totalCandidatesPages = Math.max(1, Math.ceil(D.candidates.length / state.candidatesPerPage));
    state.candidatesPage = Math.max(1, Math.min(totalCandidatesPages, state.candidatesPage));
    const candidatesPage = state.candidatesPage;
    const candidatesStartIdx = (candidatesPage - 1) * state.candidatesPerPage;

    main.innerHTML = `
      <div class="fade-in">
        <div class="page-head">
          <div>
            <h1 class="page-title">E-Voting · Board Election 2026-2029</h1>
            <div class="page-sub">${D.candidates.length} candidates · Choose up to 1 Chairman, 1 Deputy, and 6 Board Members</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost">${ICONS.help}<span>How to Vote?</span></button>
          </div>
        </div>

        <div class="voting-progress">
          <div class="vp-info">
            <div class="vp-title">⏱️ Voting Phase Active</div>
            <div class="vp-sub">${state.liveVotes.ya + state.liveVotes.tidak + state.liveVotes.abstain} of ${state.liveVotes.total} quorum members have voted · Closes at 11:45</div>
          </div>
          <div class="vp-timer" id="vp-timer">12:48</div>
          <div class="flex gap-2">
            <button class="btn btn-success">${ICONS.check}<span>Submit Vote</span></button>
          </div>
        </div>

        <div class="card mb-4">
          <div class="card-body">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px">
              <div style="display:flex;gap:14px;align-items:center">
                <div style="font-size:13px;color:var(--c-text-3);text-transform:uppercase;letter-spacing:0.5px;font-weight: 500">Filter:</div>
                <div class="filter-chip active">All (8)</div>
                <div class="filter-chip">Chairman (1)</div>
                <div class="filter-chip">Deputy Chairman (1)</div>
                <div class="filter-chip">Board Member (6)</div>
                <div class="filter-chip">PJ North Zone</div>
              </div>
              <div class="search" style="min-width:200px;position:relative">
                ${ICONS.search}
                <input type="text" placeholder="Search candidates..." style="width:100%;padding:8px 12px 8px 34px;border:1px solid var(--c-border-strong);border-radius:8px">
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
                  <div style="font-size:11px;color:var(--c-text-3);margin-top:4px">Zone ${c.zone}</div>
                </div>
              </div>
              <div class="cc-name">${c.name}</div>
              <div class="cc-meta">${c.age} years · ${c.zone}</div>
              <div class="cc-manifesto">"${c.manifesto}"</div>
              <div class="cc-votes">
                <div class="cc-votes-row"><span>📊 ${c.votes} votes</span><span>${pct}% support</span></div>
                <div class="cc-votes-bar"><div class="cc-votes-fill" style="width:${pct}%;background:${c.color}"></div></div>
              </div>
              <button class="btn cc-pick-btn ${sel ? 'picked' : ''}" aria-hidden="true" tabindex="-1">
                ${sel ? `${ICONS.check}<span>Selected</span>` : `<span>Select Candidate</span>`}
              </button>
            </div>
          `;}).join("")}
        </div>

        <div class="vote-basket">
          <div style="width:54px;height:54px;border-radius:12px;background:var(--c-accent);color:var(--c-primary-700);display:grid;place-items:center;font-size:24px">🛒</div>
          <div class="vote-basket-info">
            <div class="vb-count">${selectedCount} candidates selected</div>
            <div class="vb-sub">Chairman (${[...state.selectedCandidates].filter(c => D.candidates.find(x => x.id === c)?.position === 'Chairman').length}/1) · Deputy (${[...state.selectedCandidates].filter(c => D.candidates.find(x => x.id === c)?.position === 'Deputy Chairman').length}/1) · Member (${[...state.selectedCandidates].filter(c => D.candidates.find(x => x.id === c)?.position === 'Board Member').length}/6)</div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-ghost" id="clear-basket">Clear</button>
            <button class="btn btn-primary btn-lg" id="submit-ballot-btn" ${selectedCount === 0 ? 'disabled' : ''}>${ICONS.check}<span>Confirm & Submit</span></button>
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
        title: "Submit Your Ballot?",
        message: `You selected ${n} candidates. Once submitted, your ballot is cryptographically sealed and <b>cannot be changed</b>.`,
        confirmLabel: "Yes, Submit Ballot",
        onConfirm: () => {
          showToast("✅ Your ballot has been submitted & recorded in the hash chain.", "success");
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
            <h1 class="page-title">Motions & Resolutions</h1>
            <div class="page-sub">Motion Chain Engine · ${D.motions.length} motions recorded · BRule-001 to BRule-005 monitored</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost">${ICONS.download}<span>Export Minutes</span></button>
            <button class="btn btn-primary">${ICONS.plus}<span>Propose Motion</span></button>
          </div>
        </div>

        <div class="kpi-grid mb-4">
          ${kpiBox("Total Motions", D.motions.length, "This year", "primary")}
          ${kpiBox("Approved", D.motions.filter(m => m.status.includes('PASSED')).length, "Auto-documented", "success")}
          ${kpiBox("Voting Open", D.motions.filter(m => m.status.includes('Voting Open')).length, "Live now", "warning")}
          ${kpiBox("Auto-Drop", D.motions.filter(m => m.status.includes('Failed')).length, "BRule-002/003", "info")}
        </div>

        ${D.motions.slice(startIdx, startIdx + state.motionsPerPage).map(m => {
          const total = m.votes ? (m.votes.ya + m.votes.tidak + m.votes.abstain) : 0;
          const yaPct = m.votes && total > 0 ? (m.votes.ya / total * 100) : 0;
          const tkPct = m.votes && total > 0 ? (m.votes.tidak / total * 100) : 0;
          const abPct = m.votes && total > 0 ? (m.votes.abstain / total * 100) : 0;
          const statusClass = m.status.includes('PASSED') ? 'passed' : m.status.includes('Failed') ? 'failed' : m.status.includes('Voting Open') ? 'active' : '';
          return `
            <div class="motion-card ${statusClass}">
              <div class="flex items-start justify-between gap-4">
                <div style="flex:1">
                  <div class="flex items-center gap-3 mb-2">
                    <span class="motion-id">${m.id}</span>
                    <span class="badge ${m.status.includes('PASSED') ? 'success' : m.status.includes('Failed') ? 'danger' : m.status.includes('Voting Open') ? 'warning' : 'info'}">${m.status}</span>
                    <span class="badge">${m.type}</span>
                  </div>
                  <div class="motion-title">${m.title}</div>
                  <div class="motion-people">
                    <div class="mp-item"><span class="mp-label">📝 Proposer:</span><span class="mp-val">${m.proposer}</span></div>
                    <div class="mp-item"><span class="mp-label">✓ Seconder:</span><span class="mp-val">${m.seconder || '<span class="text-danger">None</span>'}</span></div>
                    <div class="mp-item"><span class="mp-label">⏱️ Proposed:</span><span class="mp-val">${m.proposedAt}</span></div>
                  </div>
                  ${m.votes ? `
                    <div class="motion-vote-bar">
                      <div class="seg-ya" style="width:${yaPct}%">${m.votes.ya} YES (${Math.round(yaPct)}%)</div>
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
                  ${m.status.includes('Voting Open') ? `
                    <button class="btn btn-success">${ICONS.check}<span>Close</span></button>
                  ` : ''}
                  <button class="btn btn-ghost">${ICONS.screen}</button>
                </div>
              </div>
            </div>
          `;
        }).join("")}

        ${page > 1 ? `
        <div class="card-foot flex items-center justify-between text-sm mt-4">
          <div class="text-3">Showing ${startIdx + 1}-${Math.min(startIdx + state.motionsPerPage, D.motions.length)} of ${D.motions.length} motions</div>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-ghost" data-motions-page="prev" ${state.motionsPage <= 1 ? 'disabled' : ''}>Prev</button>
            ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p =>
              `<button class="btn btn-sm ${p === state.motionsPage ? 'btn-primary' : 'btn-ghost'}" data-motions-page="${p}">${p}</button>`
            ).join("\n            ")}
            <button class="btn btn-sm btn-ghost" data-motions-page="next" ${state.motionsPage >= totalPages ? 'disabled' : ''}>Next</button>
          </div>
        </div>
        ` : ''}

        ${page > 1 ? '' : `
        <div class="card mt-6">
          <div class="card-head flex items-center justify-between">
            <div class="card-title">${ICONS.sparkle} AI Minute Writer — Meeting Minutes Draft</div>
            <span class="badge info">Generating · 68% done</span>
          </div>

          <div class="card-foot flex items-center justify-between text-sm mt-2">
            <div class="text-3">Showing ${startIdx + 1}-${Math.min(startIdx + state.motionsPerPage, D.motions.length)} of ${D.motions.length} motions</div>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-ghost" data-motions-page="prev" ${state.motionsPage <= 1 ? 'disabled' : ''}>Prev</button>
              ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p =>
                `<button class="btn btn-sm ${p === state.motionsPage ? 'btn-primary' : 'btn-ghost'}" data-motions-page="${p}">${p}</button>`
              ).join("\n              ")}
              <button class="btn btn-sm btn-ghost" data-motions-page="next" ${state.motionsPage >= totalPages ? 'disabled' : ''}>Next</button>
            </div>
          </div>

          <div class="card-body">
            <div style="background:var(--c-surface-2);padding:16px;border-radius:8px;font-family:'SF Mono',monospace;font-size:13px;line-height:1.7">
              <div style="font-weight:700;color:var(--c-primary)">MINUTES OF THE 16TH ANNUAL GENERAL MEETING</div>
              <div style="margin:8px 0">Date: 23 Jun 2026 · Time: 09:04 – (ongoing) · Venue: KOPEMAJU Corporate Hall</div>
              <hr class="divider">
              <div><b>AG-01:</b> The meeting was chaired by Dato' Ariffin Bin Kassim (Chairman).</div>
              <div><b>AG-02:</b> Quorum confirmed — 403 of 1,284 members present (31.4%) — exceeding the UUK 25% minimum.</div>
              <div><b>AG-03:</b> 15th AGM minutes confirmed without amendment by Mr. Vijay Kumar, seconded by Mrs. Wong Soke Yen.</div>
              <div><b>AG-04:</b> FY 2025 Financial Statements presented — Revenue RM 12.84M, Profit RM 1.42M, 8% dividend proposed.</div>
              <div><b>M-002:</b> External Auditor Appointment — PASSED (381 YES, 12 NO, 8 ABSTAIN).</div>
              <div><b>M-003:</b> UUK 7.3 Amendment — FAILED (no Seconder within 15 minutes, BRule-003 triggered).</div>
              <div><b>AG-06:</b> <span style="background:#FEF3C8;padding:2px 6px;border-radius:4px">Ongoing — M-001 dividend distribution currently being voted.</span></div>
            </div>
            <div class="flex gap-2 mt-3">
              <button class="btn btn-primary">${ICONS.check}<span>Confirm & Digitally Sign</span></button>
              <button class="btn btn-ghost">${ICONS.download}<span>Export PDF</span></button>
              <button class="btn btn-ghost">${ICONS.sparkle}<span>Refine with AI</span></button>
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
      { id: "chairman", cls: "c1", icon: ICONS.mic, title: "AI Chairman & Moderator", sub: "Proactive procedure reminders" },
      { id: "secretary", cls: "c2", icon: ICONS.motions, title: "AI Secretary & Minute Writer", sub: "Speech-to-text & auto-minutes" },
      { id: "compliance", cls: "c3", icon: ICONS.shield, title: "AI Compliance & Legal", sub: "Akta Koperasi 1993 + GP14" },
      { id: "organizer", cls: "c4", icon: ICONS.ai, title: "AI Question Organizer", sub: "Merge repeated questions" },
    ];

    main.innerHTML = `
      <div class="fade-in">
        <div class="page-head">
          <div>
            <h1 class="page-title">AI Governance Copilot</h1>
            <div class="page-sub">Smart multi-agent · RAG indexed with ${D.auditLog.length}+ records · ${ICONS.sparkle}Powered by AGMX AI Engine</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost">${ICONS.upload}<span>Upload Documents</span></button>
            <button class="btn btn-primary">${ICONS.plus}<span>New Agent</span></button>
          </div>
        </div>

        <div class="copilot-shell">
          <div class="copilot-side">
            <div style="font-size:11px;color:var(--c-text-3);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;padding:0 4px 8px">Active Agents</div>
            ${agents.map(a => `
              <div class="copilot-agent ${state.copilotAgent === a.id ? 'active' : ''}" data-agent="${a.id}">
                <div class="ca-icon ${a.cls}">${a.icon}</div>
                <div class="ca-text">
                  <div class="t1">${a.title}</div>
                  <div class="t2">${a.sub}</div>
                </div>
              </div>
            `).join("")}
            <div style="font-size:11px;color:var(--c-text-3);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;padding:14px 4px 8px">System Status</div>
            <div style="background:var(--c-success-100);padding:10px;border-radius:8px;font-size:12px;color:#047857">
              ✅ RAG Index: 1,247 documents
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
                <div class="ch-sub">${(agents.find(a => a.id === state.copilotAgent) || agents[0]).sub} · Active now</div>
              </div>
              <span class="badge success"><span class="dot"></span> Online</span>
            </div>

            <div class="chat-stream" id="chat-stream">
              <div class="chat-msg ai">
                <div class="av">${ICONS.sparkle}</div>
                <div class="bubble-wrap">
                  <div class="bubble">
                    Greetings Mrs. Aishah 👋 I am ${(agents.find(a => a.id === state.copilotAgent) || agents[0]).title}. I can help with financial analysis, compliance checks, and meeting minutes summaries. How can I assist you?
                  </div>
                  <div class="msg-time">11:38</div>
                </div>
              </div>

              <div class="chat-msg user">
                <div class="av">AR</div>
                <div class="bubble-wrap">
                  <div class="bubble">How does last year's dividend compare to this year's?</div>
                  <div class="msg-time">11:39 · Read ✓✓</div>
                </div>
              </div>

              <div class="chat-msg ai">
                <div class="av">${ICONS.sparkle}</div>
                <div class="bubble">
                  <div><b>KOPEMAJU Dividendd Comparison (FY 2024 vs FY 2025):</b></div>
                  <div style="margin-top:8px">
                    <table style="width:100%; border-collapse: collapse; font-size:13px">
                      <tr style="border-bottom:1px solid var(--c-divider)">
                        <td style="padding:6px 0"><b>TK 2024</b></td>
                        <td>10%</td>
                        <td>(RM 1.10M from RM 1.10M net surplus)</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0"><b>TK 2025</b></td>
                        <td><b style="color:var(--c-accent-ink)">8% (proposed)</b></td>
                        <td>(RM 1.14M from RM 1.42M net surplus)</td>
                      </tr>
                    </table>
                  </div>
                  <div style="margin-top:10px">Although the rate is lower, the total dividend distributed is higher (+3.6%) because the net surplus grew 29%.</div>
                  <div class="citation">
                    <span class="cite-label">📄 Source:</span>
                    2025 Financial Statements (p. 14, Para 3.2)
                    <span class="cite-page">/dokumen/fy2025-financial.pdf</span>
                  </div>
                </div>
              </div>

              <div class="chat-msg user">
                <div class="av">AR</div>
                <div class="bubble-wrap">
                  <div class="bubble">Does this violate the UUK?</div>
                  <div class="msg-time">11:40 · Read ✓✓</div>
                </div>
              </div>

              <div class="chat-msg ai">
                <div class="av">${ICONS.sparkle}</div>
                <div class="bubble">
                  ✅ <b>No violation.</b> AI Compliance check:<br>
                  • UUK Clause 8.1: Minimum dividend 5% — <b>COMPLIANT</b> (8% > 5%)<br>
                  • Cooperative Act 1993 Sec 22(3): Net surplus distributed — <b>COMPLIANT</b><br>
                  • GP14B: At least 20% of net surplus retained — <b>COMPLIANT</b> (RM 280K retained)
                  <div class="citation">
                    <span class="cite-label">⚖️ Reference:</span> Akta Koperasi 1993, Guideline 14B, KOPEMAJU UUK Clause 8.1
                  </div>
                </div>
              </div>

              <div class="chat-msg ai">
                <div class="av">${ICONS.sparkle}</div>
                <div class="bubble-wrap">
                  <div class="bubble">
                    <div class="fin-chart">
                      <div class="fc-title">Auto-generated: 5-Year Net Profit Trend</div>
                      ${finChartSvg()}
                    </div>
                  </div>
                  <div class="msg-time">11:41</div>
                </div>
              </div>

              <div class="chat-msg ai">
                <div class="av">${ICONS.sparkle}</div>
                <div class="bubble typing" aria-label="AI is typing">
                  <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
                </div>
              </div>
            </div>

            <div class="chat-suggestions">
              <div class="suggestion-chip">📊 Summarize Financial Statements</div>
              <div class="suggestion-chip">⚖️ Check UUK compliance</div>
              <div class="suggestion-chip">📝 Generate minutes draft</div>
              <div class="suggestion-chip">🔍 Find 15th AGM resolutions</div>
            </div>

            <div class="chat-input">
              <input type="text" placeholder="Ask about the AGM, finances or compliance...">
              <button class="send">${ICONS.send}</button>
            </div>
          </div>
        </div>

        <div class="kpi-grid mt-4">
          ${kpiBox("Questions Answered", 142, "+27 today", "primary")}
          ${kpiBox("Documents Indexed", 1247, "RAG search-ready", "success")}
          ${kpiBox("Minutes Drafts", 4, "AI auto-generated", "info")}
          ${kpiBox("Compliance Alerts", 2, "Auto-block actions", "warning")}
        </div>

        <div class="card mt-4">
          <div class="card-head">
            <div class="card-title">${ICONS.sparkle} AI Action Tracker — Post-AGM Tasks</div>
            <span class="badge success">3 active tasks</span>
          </div>
          <div class="card-body">
            ${D.actions.map(a => {
              const meta = a.status === 'Completed'
                ? { pct: 100, icon: '✅', prio: 'Completed', prioCls: 'success', bar: 'var(--c-success)' }
                : a.status === 'In Action'
                ? { pct: 55, icon: '⏳', prio: 'High Priority', prioCls: 'warning', bar: 'var(--c-warning)' }
                : { pct: 0, icon: '📌', prio: 'Not Started', prioCls: 'info', bar: 'var(--c-border-strong)' };
              return `
              <div class="action-tracker-card ${a.status === 'Completed' ? 'is-done' : a.status === 'In Action' ? 'is-inprog' : ''}">
                <div class="at-status-icon ${a.status === 'Completed' ? 'done' : a.status === 'In Action' ? 'inprog' : 'todo'}" style="font-size:17px">
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
            <h1 class="page-title">SKM & Cooperative Act Compliance</h1>
            <div class="page-sub">Compliance-by-Design Engine · Akta Koperasi 1993 · GP14 · GP14B · UUK ${D.cooperative.uukRef}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost">${ICONS.download}<span>Compliance Report</span></button>
            <button class="btn btn-primary">${ICONS.shield}<span>Generate SKM Audit</span></button>
          </div>
        </div>

        <div class="warning-banner" role="alert">
          <div class="wb-icon">${ICONS.alert}</div>
          <div class="wb-text">
            <div class="wb-title">1 Active Warning — UUK 7.3: Debate Duration</div>
            <div class="wb-sub">1 motion (M-001) exceeded the 15-minute debate limit. Chairman action required.</div>
          </div>
          <button class="btn btn-sm wb-action">View Details</button>
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
                <div class="gauge-label">Digital Governance Score · HIGHLY COMPLIANT</div>
                <div class="gauge-trend up" title="Compared to last audit">↑ +3 points since last audit (95)</div>
                <div style="margin-top:12px;display:flex;justify-content:center;gap:8px">
                  <span class="badge success"><span class="dot"></span>5 Compliant</span>
                  <span class="badge warning"><span class="dot"></span>1 Warning</span>
                </div>
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-head">
                <div class="card-title">Compliance Statistics</div>
              </div>
              <div class="card-body">
                ${[
                  { label: "AGM Notices Sent", val: "21 days early", pct: 100, color: "#10B981" },
                  { label: "Voting Eligibility", val: "Auto-filtered", pct: 100, color: "#10B981" },
                  { label: "Quorum Monitored", val: "31.4% > 25%", pct: 100, color: "#10B981" },
                  { label: "Proposer & Seconder", val: "BRule-002/003", pct: 92, color: "#10B981" },
                  { label: "Debate Duration", val: "1 motion > 15 minutes", pct: 80, color: "#F59E0B" },
                  { label: "Audit Hash Chain", val: "100% immutable", pct: 100, color: "#10B981" },
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
                <div class="card-title">Business Rules Matrix</div>
                <div style="display:flex;gap:6px;align-items:center">
                  <div class="filter-chip ${state.complianceFilter === 'all' ? 'active' : ''}" data-cfilter="all">All (${D.compliance.aktaChips.length})</div>
                  <div class="filter-chip ${state.complianceFilter === 'COMPLIANT' ? 'active' : ''}" data-cfilter="COMPLIANT">✓ Compliant (${D.compliance.aktaChips.filter(r => r.status === 'COMPLIANT').length})</div>
                  <div class="filter-chip ${state.complianceFilter === 'WARNING' ? 'active' : ''}" data-cfilter="WARNING">⚠ Warning (${D.compliance.aktaChips.filter(r => r.status === 'WARNING').length})</div>
                </div>
              </div>
              <div class="card-body">
                <div class="rule-list compact">
                  ${D.compliance.aktaChips.filter(r => state.complianceFilter === 'all' || r.status === state.complianceFilter).map(r => `
                    <div class="rule-row ${r.status === 'COMPLIANT' ? 'pass' : r.status === 'WARNING' ? 'warn' : 'fail'}">
                      <div class="rule-icon">
                        ${r.status === 'COMPLIANT' ? ICONS.check : r.status === 'WARNING' ? ICONS.alert : ICONS.x}
                      </div>
                      <div class="rule-info">
                        <div style="display:flex;align-items:center;gap:8px">
                          <span class="r-ref">${r.id}</span>
                          <span class="r1">${r.label}</span>
                        </div>
                        <div class="r2">${r.evidence}</div>
                      </div>
                      <span class="badge ${r.status === 'COMPLIANT' ? 'success' : 'warning'}">${r.status}</span>
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
                  { id: "BRule-001", label: "Minimum quorum not reached", trigger: "Start Meeting button disabled", status: "Active" },
                  { id: "BRule-002", label: "Motion without Proposer", trigger: "Open Discussion session blocked", status: "Active" },
                  { id: "BRule-003", label: "No Seconder within 15 min", trigger: "Auto-drop + record in minutes", status: "Active" },
                  { id: "BRule-004", label: "AGM notice < 15 days", trigger: "Block notice publication", status: "Active" },
                  { id: "BRule-005", label: "Member in arrears voting", trigger: "Voting access blocked", status: "Active" },
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
            <div class="page-sub">Tamper-Proof Ledger · Immutable Hash Chain · 7,891 blocks recorded since 2010</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost">${ICONS.download}<span>Export for SKM</span></button>
            <button class="btn btn-primary">${ICONS.shield}<span>Verify Integrity</span></button>
          </div>
        </div>

        <div class="kpi-grid mb-4">
          ${kpiBox("Blocks Stored", 7891, "Immutable chain", "primary")}
          ${kpiBox("Chain Integrity", "100%", "Cryptographically verified", "success")}
          ${kpiBox("Encryption", "AES-256 + TLS 1.3", "Zero Trust enforced", "info")}
          ${kpiBox("Backup Locations", 3, "Geo-redundancy active", "warning")}
        </div>

        <div class="audit-shell">
          <div class="card">
            <div class="toolbar">
              <div class="search" style="position:relative;flex:1">
                ${ICONS.search}
                <input type="text" placeholder="Search member ID, hash, or action...">
              </div>
              <div class="filter-chip active">All</div>
              <div class="filter-chip">Votes</div>
              <div class="filter-chip">Motions</div>
              <div class="filter-chip">System</div>
              <button class="btn btn-sm btn-ghost">${ICONS.download}<span>Export</span></button>
            </div>
            <div class="audit-list">
              <div class="audit-row audit-head">
                <div>Timestamp</div>
                <div>Actor</div>
                <div>Action</div>
                <div>Hash (Truncated)</div>
                <div>Sig</div>
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
              <span class="text-sm text-3">Showing ${Math.min(state.vaultLogLimit, D.auditLog.length)} latest records · 7,891 in archive</span>
              ${state.vaultLogLimit < D.auditLog.length
                ? `<button class="btn btn-sm btn-ghost" id="vault-load-more">Load More ↓</button>`
                : `<button class="btn btn-sm btn-ghost" id="vault-archive-btn">Open Full Archive →</button>`}
            </div>
          </div>

          <div>
            <div class="chain-viz">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                <div style="font-weight:700">🔗 Hash Chain</div>
                <span class="badge info">7,891 blocks</span>
              </div>
              ${[
                { num: 7891, hash: "0x9f4ab3e1c7d2f8a604519e2b8c2", action: "VOTE_CAST · M-001 · YES", time: "11:42:18" },
                { num: 7890, hash: "0x9f4ab3e1c7d2f8a604519e2b8c1", action: "VOTE_CAST · M-001 · NO", time: "11:42:17" },
                { num: 7889, hash: "0x9f4ab3e1c7d2f8a604519e2b8bf", action: "VOTE_CAST · M-001 · YES", time: "11:42:16" },
              ].map(b => `
                <div class="chain-block has-hash-tip" tabindex="0">
                  <div class="flex items-center gap-2">
                    <span class="cb-num">#${b.num}</span>
                    <span class="cb-time">${b.time}</span>
                    <span style="margin-left:auto;font-size:10px;background:var(--c-success-100);color:#047857;padding:2px 6px;border-radius:4px">✓ Verified</span>
                  </div>
                  <div style="font-weight: 500;font-size:12px;margin-top:6px">${b.action}</div>
                  <div class="cb-hash-hint">🔍 Hover for hash</div>
                  <div class="hash-tooltip">hash: ${b.hash}</div>
                </div>
              `).join("")}
              <div class="chain-more">+ 7,888 earlier blocks · all verified ✓</div>
              <button class="btn btn-primary btn-lg" id="verify-chain-btn" style="width:100%;justify-content:center;margin-top:14px">
                ${ICONS.shield}<span>Verify Integrity Now</span>
              </button>
              <div class="chain-verified">
                ✅ Last verified: 11:42:18 (SHA-256)
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-head">
                <div class="card-title">🛡️ Zero Trust Security</div>
              </div>
              <div class="card-body" style="font-size:13px">
                ${[
                  { icon: "🔐", label: "MFA + Passkey", val: "Active for all roles" },
                  { icon: "🔒", label: "AES-256 Encryption", val: "Data in-transit & at-rest" },
                  { icon: "🚫", label: "Anti-Bot + CAPTCHA", val: "Cloudflare WAF active" },
                  { icon: "📍", label: "Geo Blocking", val: "Malaysia + ASEAN only" },
                  { icon: "🆔", label: "Device Binding", val: "Session fingerprint enforced" },
                  { icon: "🕵️", label: "Fraud Detection", val: "Live monitoring active" },
                ].map(s => `
                  <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--c-divider)">
                    <span style="font-size:20px">${s.icon}</span>
                    <div style="flex:1">
                      <div style="font-weight: 500;font-size:13px">${s.label}</div>
                      <div style="font-size:11.5px;color:var(--c-text-3)">${s.val}</div>
                    </div>
                    <span class="badge success"><span class="dot"></span> ACTIVE</span>
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
      btn.innerHTML = `<span>⏳ Checking 7,891 blocks...</span>`;
      setTimeout(() => {
        btn.innerHTML = `<span>✅ Integrity 100% Verified</span>`;
        showToast("✅ Verification complete: 7,891/7,891 blocks valid (SHA-256)");
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
            <h1 class="page-title">Settings & Accessibility</h1>
            <div class="page-sub">Senior Friendly Mode · Language · Theme · Premium</div>
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
              <p class="text-2 text-sm">Enable a senior-friendly display with large buttons (60-80px), bigger text, high contrast, and simple navigation (One Screen, One Action).</p>
              <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
                <span class="badge info">Button size: 60-80px</span>
                <span class="badge info">Text: +20%</span>
                <span class="badge info">Menu: ≤5 items</span>
                <span class="badge info">Panic Button</span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <div class="card-title">🎨 Display Theme</div>
            </div>
            <div class="card-body">
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
                ${["default", "hc", "dark"].map(t => `
                  <div class="role-pick-card ${state.theme === t ? 'active' : ''}" data-theme="${t}">
                    <div style="width:60px;height:40px;border-radius:6px;margin:0 auto 8px;${t === 'default' ? 'background:linear-gradient(135deg,#F5F7FB,#0B5394)' : t === 'hc' ? 'background:#fff;border:2px solid #000' : 'background:linear-gradient(135deg,#0F172A,#1E293B)'}"></div>
                    <div style="font-weight:700">${t === 'default' ? 'Default' : t === 'hc' ? 'High Contrast' : 'Dark'}</div>
                    <div class="text-3 text-xs">${t === 'default' ? 'Standard' : t === 'hc' ? 'Accessibility' : 'Night'}</div>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <div class="card-title">🌐 Language & Locale</div>
            </div>
            <div class="card-body">
              <div class="label">Interface Language</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
                ${D.languages.map((l, i) => `
                  <div class="filter-chip ${i === 0 ? 'active' : ''}">${l}</div>
                `).join("")}
              </div>
              <div class="label">Auto-Translate Caption</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <span class="badge success"><span class="dot"></span>BM → EN Active</span>
                <span class="badge success"><span class="dot"></span>BM → TA Active</span>
                <span class="badge success"><span class="dot"></span>BM → ID Active</span>
                <span class="badge success"><span class="dot"></span>BM → 中文 Active</span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <div class="card-title">💎 SaaS Subscription</div>
            </div>
            <div class="card-body">
              <div style="background:linear-gradient(135deg, var(--c-primary), var(--c-info));color:#fff;padding:16px;border-radius:10px;margin-bottom:12px">
                <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.8">Active Plan</div>
                <div style="font-size:22px;font-weight: 700;margin:4px 0">Enterprise</div>
                <div style="font-size:13px;opacity:0.9">RM 2,500 / year · up to 1,000 members</div>
              </div>
              <table class="table" style="font-size:12.5px">
                <tr><td>Members used</td><td class="text-bold">1,284 / 1,000 ⚠️</td></tr>
                <tr><td>Renewal</td><td>31 Dis 2026</td></tr>
                <tr><td>Cloud</td><td>SaaS Multi-Tenant</td></tr>
                <tr><td>White Label</td><td>Inactive</td></tr>
              </table>
              <button class="btn btn-primary mt-3" style="width:100%; justify-content:center">⬆️ Upgrade to Platinum</button>
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <div class="card-title">📱 Active Devices</div>
            </div>
            <div class="card-body">
              ${[
                { device: "iPhone 15 Pro · Aishah", loc: "Petaling Jaya", time: "Sekarang", current: true },
                { device: "MacBook Pro · Secretary", loc: "Petaling Jaya", time: "Sekarang", current: true },
                { device: "Samsung Galaxy · Chairman", loc: "Shah Alam", time: "2 hours ago" },
              ].map(d => `
                <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--c-divider)">
                  <div style="width:38px;height:38px;background:var(--c-primary-100);color:var(--c-primary);border-radius:8px;display:grid;place-items:center;font-size:18px">${d.device.includes('iPhone') || d.device.includes('Samsung') ? '📱' : '💻'}</div>
                  <div style="flex:1">
                    <div style="font-weight: 500;font-size:13px">${d.device}</div>
                    <div style="font-size:11.5px;color:var(--c-text-3)">📍 ${d.loc} · ${d.time}</div>
                  </div>
                  ${d.current ? '<span class="badge success"><span class="dot"></span> Active</span>' : '<button class="btn btn-sm btn-ghost">Log Out</button>'}
                </div>
              `).join("")}
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <div class="card-title">🔌 Integrations & API</div>
            </div>
            <div class="card-body">
              ${[
                { name: "SKM Compliance API", status: "Connected", icon: "🛡️" },
                { name: "WhatsApp Business", status: "Connected", icon: "💬" },
                { name: "SMS Gateway (Twilio)", status: "Connected", icon: "📨" },
                { name: "Payment Gateway", status: "Not connected", icon: "💳" },
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
      { type: "vote", icon: "🗳️", color: "primary", title: "M-001: 12 new votes received", desc: "248 YES · 47 NO · 18 ABSTAIN", time: "Just now", unread: true },
      { type: "ai", icon: "🤖", color: "info", title: "AI Minute Writer 68% done", desc: "AGM-16 minutes draft generating · ready in ~4 minutes", time: "2 minutes ago", unread: true },
      { type: "alert", icon: "⚠️", color: "warning", title: "M-003 auto-dropped", desc: "BRule-003 triggered: No Seconder within 15 minutes", time: "5 minutes ago", unread: true },
      { type: "compliance", icon: "✅", color: "success", title: "Compliance 100% PASSED", desc: "All 6 SKM requirements met for AGM-16", time: "10 minutes ago" },
      { type: "user", icon: "👤", color: "info", title: "Mrs. Fatimah Ismail checked in", desc: "Method: MyKad NFC · Member No. A-0312", time: "12 minutes ago" },
      { type: "system", icon: "🔧", color: "info", title: "WebSocket latency down 8ms", desc: "Auto-scaling optimization complete", time: "15 minutes ago" },
      { type: "agenda", icon: "📋", color: "primary", title: "AG-07 starting soon", desc: "Board Election · 45 minutes", time: "20 minutes ago" },
    ];

    const panel = document.createElement("div");
    panel.id = "notif-panel";
    panel.className = "dropdown-panel";
    panel.innerHTML = `
      <div class="dp-head">
        <div>
          <div class="dp-title">Notifications</div>
          <div class="dp-sub">3 unread</div>
        </div>
        <button class="dp-action">Mark All Read</button>
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
        <button class="dp-action">View All Notifications</button>
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
          <div style="font-size:11px;color:var(--c-text-3);text-transform:uppercase;letter-spacing:0.5px;font-weight: 500;margin-bottom:6px">Switch Role (Demo)</div>
          <div class="role-switcher">
            <div class="rs-chip ${state.role === 'secretary' ? 'active' : ''}" data-role="secretary">📋 Secretary</div>
            <div class="rs-chip ${state.role === 'chairman' ? 'active' : ''}" data-role="chairman">🎤 Chairman</div>
            <div class="rs-chip ${state.role === 'member' ? 'active' : ''}" data-role="member">👤 Member</div>
          </div>
        </div>
      </div>
      <div class="profile-menu-list">
        <div class="pml-item" data-action="settings">${ICONS.cog}<span>Account Settings</span></div>
        <div class="pml-item" data-action="notifications">${ICONS.bell}<span>Notification Preferences</span></div>
        <div class="pml-item" data-action="help">${ICONS.help}<span>Help & Support</span></div>
        <div class="pml-item" data-action="keyboard">${ICONS.search}<span>Keyboard Shortcuts</span></div>
        <div class="pml-divider"></div>
        <div class="pml-item danger" data-action="logout">${ICONS.phoneOff}<span>Log Out</span></div>
      </div>
    `;
    document.body.appendChild(menu);

    $$(".rs-chip", menu).forEach(el =>
      el.addEventListener("click", () => {
        state.role = el.dataset.role;
        state.profileOpen = false;
        showToast(`Role switched: ${el.textContent.trim()}`);
        renderDropdowns();
      })
    );
    $$(".pml-item", menu).forEach(el =>
      el.addEventListener("click", () => {
        const a = el.dataset.action;
        if (a === "settings") { navigate("settings"); }
        else if (a === "logout") {
          showToast("👋 You have logged out");
          navigate("login");
        } else {
          showToast("This feature is coming in the full version.");
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
          <input type="text" placeholder="Search members, motions, agenda, or anything..." id="global-search-input" autocomplete="off">
          <span class="kb-hint">ESC</span>
        </div>
        <div class="search-results scrollbar" id="search-results">
          <div style="padding:20px;text-align:center;color:var(--c-text-3)">
            <div style="font-size:32px;margin-bottom:8px">🔍</div>
            <div>Type to start searching...</div>
            <div style="font-size:12px;margin-top:6px">Searching across ${D.members.length} members · ${D.motions.length} motions · ${D.agenda.length} agenda · 1,247 documents</div>
          </div>
        </div>
        <div class="search-suggest">
          <span>Try:</span>
          <div class="suggest-tag" data-q="Dividend">Dividend</div>
          <div class="suggest-tag" data-q="A-0078">A-0078 (Muthusamy)</div>
          <div class="suggest-tag" data-q="M-001">M-001</div>
          <div class="suggest-tag" data-q="AG-06">AG-06</div>
          <div class="suggest-tag" data-q="Quorum">Quorum</div>
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
      results.innerHTML = '<div style="padding:20px;text-align:center;color:var(--c-text-3)">Type to start searching...</div>';
      return;
    }
    const ql = q.toLowerCase();
    const out = [];

    // Search members
    D.members.filter(m => m.name.toLowerCase().includes(ql) || m.id.includes(ql) || m.ic.includes(ql)).slice(0, 5).forEach(m => {
      out.push({ type: "Member", icon: "👤", title: m.name, sub: `${m.id} · ${m.shares.toLocaleString()} shares · ${m.status}`, route: "members" });
    });

    // Search motions
    D.motions.filter(m => m.title.toLowerCase().includes(ql) || m.id.toLowerCase().includes(ql)).slice(0, 3).forEach(m => {
      out.push({ type: "Motion", icon: "📜", title: m.title, sub: `${m.id} · ${m.status}`, route: "motions" });
    });

    // Search agenda
    D.agenda.filter(a => a.title.toLowerCase().includes(ql) || a.id.toLowerCase().includes(ql)).slice(0, 3).forEach(a => {
      out.push({ type: "Agenda", icon: "📋", title: a.title, sub: `${a.id} · ${a.duration} min · ${a.presenter}`, route: "agm-hall" });
    });

    // Search candidates
    D.candidates.filter(c => c.name.toLowerCase().includes(ql) || c.position.toLowerCase().includes(ql)).slice(0, 3).forEach(c => {
      out.push({ type: "Candidate", icon: "🎯", title: c.name, sub: `${c.position} · Zone ${c.zone}`, route: "voting" });
    });

    if (out.length === 0) {
      results.innerHTML = `<div style="padding:30px;text-align:center;color:var(--c-text-3)"><div style="font-size:32px;margin-bottom:8px">🤷</div><div>No results for "${q}"</div></div>`;
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
        showToast(`Going to ${el.dataset.route}`);
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
      subEl.textContent = `${t} of ${state.liveVotes.total} quorum members have voted (${pct}%) · Akan tutup pada 11:45`;
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
      <button class="toast-close" aria-label="Close">${ICONS.x}</button>`;
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
          <button class="btn btn-ghost btn-lg" id="cfm-cancel">${cancelLabel || "Cancel"}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-lg" id="cfm-ok">${confirmLabel || "Confirm"}</button>
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
      { id: 1, label: "AGM Basics", icon: "📋", desc: "Date & mode" },
      { id: 2, label: "Agenda", icon: "📑", desc: "Arrange agenda" },
      { id: 3, label: "Notice & Distribution", icon: "📨", desc: "Distribution channels" },
      { id: 4, label: "Compliance", icon: "⚖️", desc: "SKM auto-checks" },
      { id: 5, label: "Publish AGM", icon: "🚀", desc: "Ready to start" },
    ];
    const step = state.wizardStep || 1;
    main.innerHTML = `
      <div class="fade-in">
        <div class="page-head">
          <div>
            <h1 class="page-title">AGM Wizard · Create General Meeting</h1>
            <div class="page-sub">5 steps · Auto-compliance with Cooperative Act 1993 · Auto-generate Notice & Minutes</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost" id="wiz-cancel">Cancel</button>
            <button class="btn btn-ghost">${ICONS.help}<span>Guide</span></button>
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
              <div style="font-weight:700;color:var(--c-primary);margin-bottom:6px">💡 Auto-Save Tip</div>
              <div style="color:var(--c-text-2)">Every step is saved automatically. You can go back and edit at any time.</div>
            </div>
          </div>

          <div class="wizard-panel">
            ${step === 1 ? `
              <div class="card">
                <div class="card-head">
                  <div>
                    <div class="card-title">Step 1: AGM Basics</div>
                    <div class="text-sm text-3 mt-1">Set the date, time, and conference mode</div>
                  </div>
                  <span class="badge info">Auto-saved</span>
                </div>
                <div class="card-body">
                  <div class="form-row">
                    <div>
                      <div class="label">AGM Title</div>
                      <input class="input" value="17th Annual General Meeting">
                    </div>
                    <div>
                      <div class="label">Edition / Financial Year</div>
                      <input class="input" value="TK 2026">
                    </div>
                  </div>
                  <div class="form-row-3">
                    <div>
                      <div class="label">Date</div>
                      <input class="input" type="date" value="2027-06-15">
                    </div>
                    <div>
                      <div class="label">Start Time</div>
                      <input class="input" type="time" value="09:00">
                    </div>
                    <div>
                      <div class="label">Duration (hours)</div>
                      <input class="input" type="number" value="4">
                    </div>
                  </div>
                  <div class="label">Conference Mode</div>
                  <div class="mode-pick">
                    <div class="mode-card active">
                      <div style="font-size:32px;margin-bottom:6px">🏛️</div>
                      <div style="font-weight:700">Hybrid</div>
                      <div class="text-xs text-3">Physical + Online</div>
                      <span class="badge info mt-2">Most Popular</span>
                    </div>
                    <div class="mode-card">
                      <div style="font-size:32px;margin-bottom:6px">📍</div>
                      <div style="font-weight:700">Physical Only</div>
                      <div class="text-xs text-3">Attend in hall</div>
                    </div>
                    <div class="mode-card">
                      <div style="font-size:32px;margin-bottom:6px">💻</div>
                      <div style="font-weight:700">Online</div>
                      <div class="text-xs text-3">Zoom-style</div>
                    </div>
                  </div>
                  <div class="form-row">
                    <div>
                      <div class="label">Location (if physical/hybrid)</div>
                      <input class="input" value="KOPEMAJU Corporate Hall, Petaling Jaya">
                    </div>
                    <div>
                      <div class="label">Minimum Quorum (%)</div>
                      <input class="input" type="number" value="25">
                    </div>
                  </div>
                </div>
              </div>
            ` : step === 2 ? `
              <div class="card">
                <div class="card-head">
                  <div>
                    <div class="card-title">Step 2: Agenda Builder</div>
                    <div class="text-sm text-3 mt-1">Add and arrange agenda items</div>
                  </div>
                  <span class="badge info">7 items · 165 minutes</span>
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
                      ${ICONS.plus}<span>Add Agenda Item</span>
                    </div>
                  </div>
                  <div style="background:var(--c-surface-2);padding:14px;border-radius:10px;margin-top:14px">
                    <div class="flex justify-between items-center">
                      <div>
                        <div style="font-weight:700;font-size:13.5px">⏱️ Estimated Time</div>
                        <div class="text-xs text-3">AI slides ready: 28 pages · Minutes: 12 pp.</div>
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
                    <div class="card-title">Step 3: Notice & Distribution</div>
                    <div class="text-sm text-3 mt-1">Choose AGM notice distribution channels</div>
                  </div>
                  <span class="badge success">${D.agm.noticesSent} members will receive</span>
                </div>
                <div class="card-body">
                  <div class="label">Distribution Channels</div>
                  <div class="channel-grid">
                    ${[
                      { name: "WhatsApp Business", icon: "💬", active: true, sent: 1284, delivered: 1247 },
                      { name: "SMS Gateway", icon: "📨", active: true, sent: 1284, delivered: 1281 },
                      { name: "Email", icon: "📧", active: true, sent: 984, delivered: 941 },
                      { name: "App Notifications", icon: "🔔", active: true, sent: 1284, delivered: 1284 },
                      { name: "Physical Mail", icon: "✉️", active: false, sent: 0, delivered: 0 },
                      { name: "Portal SKM", icon: "🛡️", active: true, sent: 1, delivered: 1 },
                    ].map(ch => `
                      <div class="channel-card ${ch.active ? 'active' : ''}">
                        <div class="ch-icon">${ch.icon}</div>
                        <div style="flex:1">
                          <div style="font-weight:700;font-size:13.5px">${ch.name}</div>
                          <div class="text-xs text-3">${ch.active ? `${ch.delivered}/${ch.sent} delivered` : 'Inactive'}</div>
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
                    <div class="label">Notice Send Date</div>
                    <input class="input" type="date" value="2027-05-25" style="max-width:240px">
                    <div class="text-xs text-success mt-1">✓ Sent 21 days before the AGM — exceeds the 15-day UUK minimum</div>
                  </div>

                  <div style="margin-top:14px">
                    <div class="label">Notice Template (AI-generated)</div>
                    <div style="background:var(--c-surface-2);padding:14px;border-radius:8px;font-size:13px;line-height:1.6;font-family:'SF Mono',monospace">
                      <b>SUBJECT:</b> Notice of the 17th KOPEMAJU Annual General Meeting<br>
                      <b>TARIKH:</b> 15 Jun 2027 · 09:00<br>
                      <b>TEMPAT:</b> KOPEMAJU Corporate Hall & Online<br><br>
                      Greetings to all KOPEMAJU members,<br>
                      Please be informed that the 17th Annual General Meeting will be held...<br>
                      <span style="opacity:0.5">[ ... AI auto-completes from cooperative data ... ]</span>
                    </div>
                  </div>
                </div>
              </div>
            ` : step === 4 ? `
              <div class="card">
                <div class="card-head">
                  <div>
                    <div class="card-title">Step 4: SKM Auto-Compliance</div>
                    <div class="text-sm text-3 mt-1">The system verifies all Cooperative Act 1993 requirements</div>
                  </div>
                  <span class="badge success">6/6 PASSED</span>
                </div>
                <div class="card-body">
                  <div class="rule-list">
                    ${[
                      { id: "Sec 17", label: "Meeting Notice sent ≥15 days", status: "pass", detail: "Notice will be sent 21 days before the AGM (6-day margin)" },
                      { id: "Sec 22", label: "Minimum quorum defined", status: "pass", detail: "25% of 1,284 members = 321 members minimum" },
                      { id: "GP14", label: "All resolutions via Proposer + Seconder", status: "pass", detail: "BRule-002/003 engine will enforce" },
                      { id: "GP14B", label: "At least 20% of net surplus retained", status: "pass", detail: "Auto-calculated in AI minutes" },
                      { id: "UUK 7.3", label: "Debate duration ≤15 minutes per motion", status: "pass", detail: "Auto-timer active in the AGM Hall" },
                      { id: "Akta 1993", label: "Digital records cannot be altered", status: "pass", detail: "Immutable hash chain will be enabled for this AGM" },
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
                        <span class="badge success">PASSED</span>
                      </div>
                    `).join("")}
                  </div>

                  <div style="background:linear-gradient(135deg,#D1FAE5,#A7F3D0);padding:18px;border-radius:12px;margin-top:18px;text-align:center">
                    <div style="font-size:32px;margin-bottom:8px">✅</div>
                    <div style="font-weight: 700;font-size:18px;color:#047857">All Compliance Checks PASSED</div>
                    <div class="text-sm" style="color:#065F46;margin-top:4px">This AGM is ready to be published and distributed to members</div>
                  </div>
                </div>
              </div>
            ` : `
              <div class="card">
                <div class="card-head">
                  <div>
                    <div class="card-title">Step 5: Ready to Publish! 🚀</div>
                    <div class="text-sm text-3 mt-1">Review the final summary and publish the AGM</div>
                  </div>
                  <span class="badge success"><span class="dot"></span> All Set</span>
                </div>
                <div class="card-body" style="text-align:center;padding:40px">
                  <div style="font-size:64px;margin-bottom:14px">🎉</div>
                  <h2 style="font-size:24px;font-weight: 700;margin-bottom:10px">Your AGM Has Been Configured</h2>
                  <p class="text-2 mb-4" style="max-width:520px;margin:0 auto">All data, notices, and compliance have been verified. Just one click to publish the AGM and start accepting attendance.</p>

                  <div style="display:inline-grid;grid-template-columns:repeat(2,1fr);gap:14px;text-align:left;max-width:520px;margin:20px auto">
                    ${[
                      { l: "AGM Date", v: "15 Jun 2027" },
                      { l: "Mod", v: "Hybrid" },
                      { l: "Agenda Items", v: "7" },
                      { l: "Members Notified", v: "1,284" },
                      { l: "Active Channels", v: "5" },
                      { l: "Compliance", v: "6/6 ✅" },
                    ].map(s => `
                      <div style="padding:10px;background:var(--c-surface-2);border-radius:8px">
                        <div class="text-xs text-3">${s.l}</div>
                        <div style="font-weight:700;margin-top:2px">${s.v}</div>
                      </div>
                    `).join("")}
                  </div>

                  <div class="flex gap-2" style="justify-content:center;margin-top:20px">
                    <button class="btn btn-ghost btn-lg">${ICONS.x}<span>Save Draft</span></button>
                    <button class="btn btn-primary btn-xl" id="publish-agm">${ICONS.check}<span>Publish AGM Now</span></button>
                  </div>
                </div>
              </div>
            `}

            <div class="wizard-nav">
              <button class="btn btn-ghost btn-lg" id="wiz-prev" ${step === 1 ? 'disabled style="opacity:0.4"' : ''}>← Back</button>
              <div style="font-size:12.5px;color:var(--c-text-3)">Step ${step} of 5</div>
              <button class="btn btn-primary btn-lg" id="wiz-next" ${step === 5 ? 'disabled style="opacity:0.4"' : ''}>Next →</button>
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
      showToast("🎉 17th AGM published! Notices sent to 1,284 members.");
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
              <div style="font-size:12px;color:rgba(255,255,255,0.7)">Senior Friendly Mode</div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button class="senior-help" title="24/7 Help">🆘 I Need Help</button>
            <button class="senior-help" style="background:var(--c-success)" title="Call me">📞 Call Me</button>
          </div>
        </div>

        <div class="senior-greeting">
          <div>
            <div style="font-size:32px;margin-bottom:6px">👋</div>
            <div style="font-size:24px;font-weight: 700">Welcome, Mrs. Fatimah</div>
            <div style="font-size:16px;opacity:0.9;margin-top:6px">KOPEMAJU member since 2010 · Member No. A-0312</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:13px;opacity:0.7;text-transform:uppercase;letter-spacing:1px">AGM Session Active</div>
            <div style="font-size:28px;font-weight: 700">02:18:42</div>
            <div style="font-size:13px;opacity:0.7;margin-top:4px">${D.agm.title}</div>
          </div>
        </div>

        <div class="senior-menu">
          <div class="senior-menu-card primary" data-sm="agenda">
            <div class="sm-icon">📋</div>
            <div class="sm-title">Agenda List</div>
            <div class="sm-sub">7 items · AG-06 active</div>
          </div>
          <div class="senior-menu-card" data-sm="documents">
            <div class="sm-icon">📄</div>
            <div class="sm-title">AGM Documents</div>
            <div class="sm-sub">4 files available</div>
          </div>
          <div class="senior-menu-card urgent" data-sm="vote">
            <div class="sm-icon">🗳️</div>
            <div class="sm-title">Vote Now</div>
            <div class="sm-sub">1 ballot awaiting you</div>
            <div class="sm-pulse"></div>
          </div>
          <div class="senior-menu-card" data-sm="ask">
            <div class="sm-icon">💬</div>
            <div class="sm-title">Ask a Question</div>
            <div class="sm-sub">AI will organize questions</div>
          </div>
        </div>

        <div id="senior-content"></div>

        <div class="senior-help-bar">
          <div style="font-weight:700;font-size:16px;color:var(--c-primary)">📞 Chairman Hotline</div>
          <div class="text-2 text-sm">Any difficulty? Call directly: <b>+60 3-7728 1420</b> (8 am - 10 pm)</div>
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
        else showToast("Coming soon. Please contact the administrator if needed.");
      })
    );
  }

  function renderSeniorVoting() {
    const root = $("#senior-content");
    root.innerHTML = `
      <div class="senior-vote">
        <button class="senior-back" id="sn-back">← Back</button>
        <h2 style="font-size:28px;font-weight: 700;margin:14px 0 8px">🗳️ Your Ballot</h2>
        <p style="font-size:18px;color:var(--c-text-2);margin-bottom:18px">Please choose YES or NO. You can change your choice before submitting.</p>

        <div class="sn-motion-card">
          <div style="font-size:13px;font-weight:700;color:var(--c-primary);text-transform:uppercase;letter-spacing:1px">M-001</div>
          <h3 style="font-size:22px;font-weight: 700;margin:8px 0;line-height:1.3">8% Dividendd Distribution from RM 1.42 Million Net Surplus</h3>
          <div style="font-size:15px;color:var(--c-text-2);background:var(--c-bg);padding:14px;border-radius:10px;margin-top:10px">
            <b>In simple terms:</b> The cooperative proposes to distribute 8% of profits to all members as dividends. For example, if you own 1,500 share units, you will receive RM 120.
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px">
          <button class="senior-vote-btn yes" id="sn-yes">
            <div style="font-size:40px;margin-bottom:4px">✅</div>
            <div style="font-size:28px;font-weight: 700">YES</div>
            <div style="font-size:15px;opacity:0.9;margin-top:2px">I agree</div>
          </button>
          <button class="senior-vote-btn no" id="sn-no">
            <div style="font-size:40px;margin-bottom:4px">❌</div>
            <div style="font-size:28px;font-weight: 700">NO</div>
            <div style="font-size:15px;opacity:0.9;margin-top:2px">I disagree</div>
          </button>
        </div>

        <div style="background:var(--c-bg);padding:18px;border-radius:12px;margin-top:24px;text-align:center">
          <div style="font-size:18px;font-weight:700">🛡️ Your Vote Is Protected</div>
          <div class="text-sm text-2 mt-1">AES-256 encrypted · Permanently recorded in the KOPEMAJU ledger</div>
        </div>
      </div>
    `;

    let chosen = null;
    const yes = $("#sn-yes"), no = $("#sn-no");
    [yes, no].forEach(b =>
      b.addEventListener("click", () => {
        yes.classList.remove("selected"); no.classList.remove("selected");
        b.classList.add("selected");
        chosen = b === yes ? "YES" : "NO";
        setTimeout(() => {
          const grid = yes.parentElement;
          grid.outerHTML = `
            <div class="senior-voted-card">
              <div class="svc-check">✓</div>
              <div class="svc-title">You Have Voted!</div>
              <div class="svc-sub">Your vote (<b>${chosen}</b>) has been securely recorded. Thank you, Mrs. Fatimah! 🎉</div>
              <div class="svc-receipt">🧾 Digital receipt: #7892 · 11:43 · AES-256 encrypted</div>
            </div>`;
          showToast("✅ Your vote (" + chosen + ") was submitted successfully. Thank you!");
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
        <button class="senior-back" id="sn-back">← Back</button>
        <h2 style="font-size:28px;font-weight: 700;margin:14px 0 14px">📋 What Will Be Discussed</h2>
        ${D.agenda.slice(0, 6).map((a, i) => `
          <div style="display:flex;gap:14px;align-items:flex-start;background:var(--c-surface);padding:18px;border-radius:12px;margin-bottom:12px;border:1px solid var(--c-border)">
            <div style="width:54px;height:54px;border-radius:50%;background:${a.status === 'In Progress' ? 'var(--c-warning)' : a.status === 'Completed' ? 'var(--c-success)' : 'var(--c-primary)'};color:#fff;display:grid;place-items:center;font-weight: 700;font-size:22px;flex-shrink:0">${i + 1}</div>
            <div style="flex:1">
              <div style="font-size:20px;font-weight:700;line-height:1.3">${a.title}</div>
              <div style="font-size:15px;color:var(--c-text-3);margin-top:4px">${a.duration} minutes · ${a.presenter}</div>
              <span class="badge ${a.status === 'Completed' ? 'success' : a.status === 'In Progress' ? 'warning' : ''}" style="margin-top:8px;font-size:14px;padding:6px 12px">${a.status}</span>
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
        <button class="senior-back" id="sn-back">← Back</button>
        <h2 style="font-size:28px;font-weight: 700;margin:14px 0 14px">📄 AGM Documents</h2>
        ${[
          { name: "AGM Notice", size: "4 pages", icon: "📨" },
          { name: "Agenda & Minit", size: "12 pages", icon: "📋" },
          { name: "2025 Financial Statements", size: "28 pages", icon: "💰" },
          { name: "Annual Report", size: "64 pages", icon: "📊" },
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
            <h1 class="page-title">📷 Attendance Check-in Desk</h1>
            <div class="page-sub">Scan member QR · Real-time check-in · Auto-sync with AGM Hall</div>
          </div>
          <div class="page-actions">
            <span class="badge success"><span class="dot"></span> ${D.agm.quorumPresent}/${D.agm.totalMembers} registered members</span>
            <button class="btn btn-ghost">${ICONS.download}<span>Export List</span></button>
            <button class="btn btn-primary">${ICONS.print || ICONS.qr}<span>Print Friendly QR</span></button>
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
                    <div style="position:absolute;inset:0;display:grid;place-items:center;color:rgba(255,255,255,0.5);font-size:14px">QR Scanner Active</div>
                  </div>
                  <div style="padding:60px 30px;background:#0a0a0a">
                    <div style="font-size:48px;margin-bottom:14px">📷</div>
                    <div style="color:#fff;font-weight:700;font-size:18px">Camera Enabled</div>
                    <div class="text-sm" style="color:rgba(255,255,255,0.6);margin-top:6px">Point the member's QR code at the camera</div>
                  </div>
                </div>
                <div class="mt-3" style="font-size:13px;color:var(--c-text-3)">Auto-zoom · Anti-duplicate · OCR MyKad backup</div>
                <div class="flex gap-2 mt-3" style="justify-content:center">
                  <button class="btn btn-ghost btn-sm">${ICONS.cam}<span>Switch Camera</span></button>
                  <button class="btn btn-ghost btn-sm">📱<span>MyKad Manual</span></button>
                </div>
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-head">
                <div class="card-title">Recent Scans</div>
                <span class="badge info">24 in 5 minutes</span>
              </div>
              <div class="card-body" style="padding:0;max-height:380px;overflow-y:auto">
                ${[
                  { name: "Mr. Lim Chong Wei", id: "A-0117", time: "11:38:42", method: "QR", status: "OK" },
                  { name: "Ms. Nurul Huda Ali", id: "A-0233", time: "11:38:15", method: "QR", status: "OK" },
                  { name: "Mrs. Zaiton (Proxy)", id: "→A-0312", time: "11:37:58", method: "MyKad", status: "PROXY" },
                  { name: "Mr. Muthusamy Gopal", id: "A-0078", time: "11:37:34", method: "QR", status: "OK" },
                  { name: "Mr. Razak Hussein", id: "A-0044", time: "11:36:21", method: "QR", status: "BLOCKED" },
                  { name: "Ms. Tan Mei Ling", id: "A-0201", time: "11:35:48", method: "QR", status: "OK" },
                  { name: "Mr. Faizal Ahmad", id: "A-0089", time: "11:35:12", method: "MyKad", status: "BLOCKED" },
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
                <span class="badge success">COMPLIANT</span>
              </div>
              <div class="card-body" style="padding:18px">
                <div style="text-align:center;margin-bottom:14px">
                  <div style="font-size:48px;font-weight: 700;color:var(--c-primary)">${D.agm.quorumPct}%</div>
                  <div style="font-size:14px;color:var(--c-text-3)">(${D.agm.quorumPresent} / ${D.agm.totalMembers} members)</div>
                </div>
                <div class="quorum-bar-wrap" style="position:relative;background:var(--c-bg);height:18px;border-radius:9px;overflow:hidden">
                  <div style="height:100%;width:${D.agm.quorumPct}%;background:linear-gradient(90deg,var(--c-accent),#FCD34D);border-radius:9px"></div>
                  <div style="position:absolute;left:25%;top:0;bottom:0;width:2px;background:rgba(0,0,0,0.3)"></div>
                </div>
                <div class="flex justify-between text-xs text-3 mt-2">
                  <span>0%</span><span>Threshold 25%</span><span>100%</span>
                </div>
                <div class="grid-2 mt-3" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                  <div style="padding:12px;background:var(--c-primary-100);border-radius:10px">
                    <div class="text-xs text-3">📍 Physical</div>
                    <div style="font-size:24px;font-weight: 700;color:var(--c-primary)">142</div>
                  </div>
                  <div style="padding:12px;background:var(--c-info);color:#fff;border-radius:10px;background:linear-gradient(135deg,#3B82F6,#1E40AF)">
                    <div style="font-size:11px;opacity:0.85">💻 Online</div>
                    <div style="font-size:24px;font-weight: 700">261</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-head">
                <div class="card-title">Check-in Modes</div>
              </div>
              <div class="card-body" style="padding:14px">
                ${[
                  { name: "QR Code", icon: ICONS.qr, active: true, desc: "Scan member's personal QR code" },
                  { name: "MyKad (NFC)", icon: "🆔", active: true, desc: "Tap identity card" },
                  { name: "Manual Entry", icon: "⌨️", active: false, desc: "Type member no. manually" },
                  { name: "Face Recognition", icon: "👤", active: false, desc: "Beta — for registered members" },
                ].map(m => `
                  <div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:8px;background:${m.active ? 'var(--c-primary-100)' : 'transparent'};margin-bottom:6px">
                    <div style="width:36px;height:36px;background:${m.active ? 'var(--c-primary)' : 'var(--c-bg)'};color:${m.active ? '#fff' : 'var(--c-text-2)'};border-radius:8px;display:grid;place-items:center">
                      ${typeof m.icon === 'string' ? `<span style="font-size:18px">${m.icon}</span>` : m.icon}
                    </div>
                    <div style="flex:1">
                      <div style="font-weight:700;font-size:13.5px">${m.name}</div>
                      <div class="text-xs text-3">${m.desc}</div>
                    </div>
                    <span class="badge ${m.active ? 'success' : ''}">${m.active ? 'ACTIVE' : 'OFF'}</span>
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="card mt-4">
              <div class="card-head">
                <div class="card-title">⚠️ Automatic Blocks</div>
              </div>
              <div class="card-body" style="padding:14px;font-size:13px">
                <div style="display:flex;gap:10px;padding:10px;background:#FEE2E2;border-radius:8px;margin-bottom:8px">
                  <span style="font-size:20px">🚫</span>
                  <div>
                    <div style="font-weight:700">Share/Fee Arrears</div>
                    <div class="text-xs text-3">2 members blocked today (BRule-005)</div>
                  </div>
                </div>
                <div style="display:flex;gap:10px;padding:10px;background:#FEF3C7;border-radius:8px;margin-bottom:8px">
                  <span style="font-size:20px">⚠️</span>
                  <div>
                    <div style="font-weight:700">Invalid Proxy</div>
                    <div class="text-xs text-3">1 proxy rejected (not registered with SKM)</div>
                  </div>
                </div>
                <div style="display:flex;gap:10px;padding:10px;background:#DBEAFE;border-radius:8px">
                  <span style="font-size:20px">ℹ️</span>
                  <div>
                    <div style="font-weight:700">Duplicate Check-in Prevented</div>
                    <div class="text-xs text-3">System auto-detects duplicate check-in attempts</div>
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
  function renderRoadmap() {
    const main = $("#main");
    main.innerHTML = `
      <div class="fade-in">
        <div class="page-head">
          <div>
            <h1 class="page-title">🗺️ Product Roadmap AGMX</h1>
            <div class="page-sub">3-phase plan from MVP to "Cooperative SuperApp" · Vol 1 + Vol 10 PRD</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-ghost">${ICONS.download}<span>Export Roadmap PDF</span></button>
            <button class="btn btn-primary">${ICONS.share}<span>Share with Board</span></button>
          </div>
        </div>

        <!-- VISION BANNER -->
        <div style="background:linear-gradient(135deg, var(--c-primary-700) 0%, var(--c-primary) 50%, var(--c-info) 100%);color:#fff;padding:32px;border-radius:18px;margin-bottom:24px;position:relative;overflow:hidden">
          <div style="position:absolute;inset:0;background:radial-gradient(circle at 80% 30%, rgba(212,160,23,0.3), transparent 50%);pointer-events:none"></div>
          <div style="position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:24px">
            <div>
              <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.8;margin-bottom:6px">🎯 Long-Term Vision</div>
              <h2 style="font-size:32px;font-weight: 700;margin:0 0 8px;letter-spacing:-0.5px">AGM Expert 2.0 → Cooperative SuperApp</h2>
              <p style="font-size:15px;opacity:0.9;max-width:680px;margin:0">Not just a teleconferencing app. AGMX is a complete Cooperative Governance Operating System — Microsoft 365 + Zoom + an election commission + DocuSign + an audit system, combined into one SaaS platform.</p>
            </div>
            <div style="text-align:right;background:rgba(255,255,255,0.15);padding:20px 24px;border-radius:14px;backdrop-filter:blur(10px);min-width:200px">
              <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.85">Status Unicorn</div>
              <div style="font-size:42px;font-weight: 700;letter-spacing:-1px">🎯</div>
              <div style="font-size:13px;font-weight:700">Target 2028</div>
            </div>
          </div>
        </div>

        <!-- TIMELINE TRACK -->
        <div class="roadmap-track">
          <!-- PHASE 1 -->
          <div class="roadmap-phase done">
            <div class="phase-head">
              <div class="phase-badge">✅ Phase 1 · MVP</div>
              <div class="phase-duration">4 months · Completed</div>
            </div>
            <h3 class="phase-title">Minimum Viable Product</h3>
            <p class="phase-desc">Core AGM features with Compliance-by-Design</p>
            <div class="phase-progress">
              <div class="phase-bar" style="width:100%;background:linear-gradient(90deg,#10B981,#047857)"></div>
            </div>
            <div class="phase-percent">100% done</div>

            <div class="phase-modules">
              <div class="module-chip done">✓ Member Management (CSV)</div>
              <div class="module-chip done">✓ AGM Wizard (5 steps)</div>
              <div class="module-chip done">✓ QR Attendance Scanning</div>
              <div class="module-chip done">✓ Basic E-Voting (AES-256)</div>
              <div class="module-chip done">✓ Admin Dashboard</div>
              <div class="module-chip done">✓ One-Screen-One-Action UI</div>
              <div class="module-chip done">✓ One Click Join (OTP)</div>
            </div>
          </div>

          <!-- PHASE 2 -->
          <div class="roadmap-phase in-progress">
            <div class="phase-head">
              <div class="phase-badge">🔄 Phase 2 · V1</div>
              <div class="phase-duration">3 months · Ongoing</div>
            </div>
            <h3 class="phase-title">Hybrid AI Platform</h3>
            <p class="phase-desc">Hybrid conference + AI Governance + Full Compliance Engine</p>
            <div class="phase-progress">
              <div class="phase-bar" style="width:78%;background:linear-gradient(90deg,var(--c-warning),#B45309)"></div>
            </div>
            <div class="phase-percent">78% done</div>

            <div class="phase-modules">
              <div class="module-chip done">✓ Hybrid Mode (5 Layouts)</div>
              <div class="module-chip done">✓ AI Minute Writer</div>
              <div class="module-chip done">✓ SKM Compliance Engine</div>
              <div class="module-chip done">✓ Multi-Agent AI Copilot</div>
              <div class="module-chip done">✓ Unified Notifications</div>
              <div class="module-chip done">✓ Auto-Translate Caption</div>
              <div class="module-chip done">✓ Digital Vault (Hash Chain)</div>
              <div class="module-chip progress">⟳ Offline Sync</div>
              <div class="module-chip todo">○ Full Action Tracker</div>
            </div>
          </div>

          <!-- PHASE 3 -->
          <div class="roadmap-phase upcoming">
            <div class="phase-head">
              <div class="phase-badge">⏳ Phase 3 · V2</div>
              <div class="phase-duration">4 months · Upcoming</div>
            </div>
            <h3 class="phase-title">SaaS Multi-Tenant Enterprise</h3>
            <p class="phase-desc">Mega scaling + government integration + AI Legal Assistant</p>
            <div class="phase-progress">
              <div class="phase-bar" style="width:18%;background:linear-gradient(90deg,#94A3B8,#475569)"></div>
            </div>
            <div class="phase-percent">18% done</div>

            <div class="phase-modules">
              <div class="module-chip todo">○ Multi-Tenant 100k+ members</div>
              <div class="module-chip todo">○ AI Legal Assistant</div>
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
              <div class="phase-badge">🚀 Phase 4 · 2028</div>
              <div class="phase-duration">Vision · Cooperative SuperApp</div>
            </div>
            <h3 class="phase-title">Governance Digital Twin</h3>
            <p class="phase-desc">No longer an AGM app — a cooperative institutional memory system</p>
            <div class="phase-progress">
              <div class="phase-bar" style="width:5%;background:linear-gradient(90deg,var(--c-accent),#B8860B)"></div>
            </div>
            <div class="phase-percent">Conceptual</div>

            <div class="phase-modules">
              <div class="module-chip future">◆ Institutional AI Memory</div>
              <div class="module-chip future">◆ Predictive Audit</div>
              <div class="module-chip future">◆ Cross-Border ASEAN</div>
              <div class="module-chip future">◆ Live Subtitle (BM/EN/ID/TA/中)</div>
              <div class="module-chip future">◆ Smart Dividendd Optimizer</div>
              <div class="module-chip future">◆ Member Marketplace</div>
            </div>
          </div>
        </div>

        <!-- KEY METRICS -->
        <div class="kpi-grid mt-4">
          ${kpiBox("Modules Completed", "12+", "of 40+ planned", "success")}
          ${kpiBox("SKM Compliance", "98/100", "Auto-checks active", "primary")}
          ${kpiBox("Latency E-Voting", "<500ms", "WebSocket optimized", "info")}
          ${kpiBox("Availability SLA", "99.95%", "Multi-AZ Kubernetes", "warning")}
        </div>

        <!-- MILESTONE TIMELINE -->
        <div class="card mt-4">
          <div class="card-head">
            <div class="card-title">📅 Launch Timeline</div>
            <span class="badge info">${new Date().getFullYear()} - ${new Date().getFullYear() + 2}</span>
          </div>
          <div class="card-body">
            <div class="milestones">
              ${[
                { date: "Jan 2026", title: "🚀 MVP Launch", desc: "First 100 cooperatives · Starter subscription RM500", status: "done" },
                { date: "Apr 2026", title: "🧠 AI Copilot Launch", desc: "RAG + Multi-Agent · 1,247 documents indexed", status: "done" },
                { date: "Jul 2026", title: "🏛️ Phase 2 Complete", desc: "Hybrid mode + Compliance engine + Digital Vault", status: "in-progress" },
                { date: "Okt 2026", title: "🌏 ASEAN Expansion", desc: "Sumatra office · Full multi-language", status: "todo" },
                { date: "Q1 2027", title: "⚖️ Phase 3 Enterprise", desc: "Multi-tenant 100k+ members · Government Cloud", status: "todo" },
                { date: "Q4 2027", title: "💎 Platinum Tier Live", desc: "Dedicated Cloud + On-site Tech Support", status: "todo" },
                { date: "2028", title: "🦄 Status Unicorn", desc: "Cooperative SuperApp · ARR target RM 50M", status: "future" },
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
            <div class="card-title">📈 Go-To-Market (GTM) Strategy</div>
            <span class="badge gold">B2B + B2G</span>
          </div>
          <div class="card-body">
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
              <div class="gtm-card">
                <div class="gtm-icon" style="background:var(--c-primary);color:#fff">🏢</div>
                <div style="font-weight:700;margin-top:10px">Direct Sales (B2B)</div>
                <div class="text-sm text-2 mt-1">Targeting Malaysia's 100 largest cooperatives facing quorum issues & e-voting disputes.</div>
                <div class="mt-3" style="font-size:11px;color:var(--c-text-3)">Status: Active</div>
              </div>
              <div class="gtm-card">
                <div class="gtm-icon" style="background:var(--c-success);color:#fff">🛡️</div>
                <div style="font-weight:700;margin-top:10px">SKM Strategic Partner</div>
                <div class="text-sm text-2 mt-1">Partnership with the Malaysia Co-operative Societies Commission to make AGMX the compliance standard.</div>
                <div class="mt-3" style="font-size:11px;color:var(--c-text-3)">Status: In negotiation</div>
              </div>
              <div class="gtm-card">
                <div class="gtm-icon" style="background:var(--c-accent);color:var(--c-primary-700)">📣</div>
                <div style="font-weight:700;margin-top:10px">Digital Marketing</div>
                <div class="text-sm text-2 mt-1">Awareness campaign focused on Zero Training Required — seniors can vote within 5 minutes.</div>
                <div class="mt-3" style="font-size:11px;color:var(--c-text-3)">Status: Active</div>
              </div>
            </div>

            <hr class="divider">

            <div style="font-weight:700;margin-bottom:10px">💰 SaaS Subscription Plans</div>
            <div class="pricing-grid">
              ${[
                { plan: "Starter", price: "RM 500", capacity: "50 members", features: ["AGM Wizard", "E-Voting Asas", "1 Language"] },
                { plan: "Professional", price: "RM 1,000", capacity: "300 members", features: ["All Starter", "Multi-language", "QR Scanner", "AI Minute"], pop: true },
                { plan: "Enterprise", price: "RM 2,500", capacity: "1,000 members", features: ["All Pro", "Full AI Copilot", "API Integration", "Priority Support"] },
                { plan: "Platinum", price: "RM 5,000", capacity: "1,000+ members", features: ["All Enterprise", "Dedicated Cloud", "White Label"] },
                { plan: "Unlimited", price: "RM 15,000", capacity: "Unlimited", features: ["All Platinum", "On-site AGM Support", "Custom Integration"] },
              ].map(p => `
                <div class="pricing-card ${p.pop ? 'popular' : ''}">
                  ${p.pop ? '<div class="pop-badge">MOST POPULAR</div>' : ''}
                  <div class="plan-name">${p.plan}</div>
                  <div class="plan-price">${p.price}<span>/ year</span></div>
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
