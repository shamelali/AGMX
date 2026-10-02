// ============================================================
// AGMX — PocketBase Client + Google Auth
// ------------------------------------------------------------
// Replaces window.MC_DATA (data.js) with live PocketBase data.
//
// Load order in HTML:
//   1. pocketbase-client.js  (defines window.AGMX_API)
//   2. data.js               (mock fallback — used only if PB unavailable)
//
// Usage:
//   const api = window.AGMX_API;
//   await api.init();                       // restore session
//   await api.loginWithGoogle();            // Google OAuth2
//   const data = await api.loadDashboard(); // → MC_DATA-shaped object
// ============================================================

(function () {
  "use strict";

  // ---- Configuration -------------------------------------------
  // Load from /config.js (gitignored) or fall back to defaults.
  const CONFIG = Object.assign(
    {
      // Local dev
      url: "http://127.0.0.1:8090",
      // Production (set in /config.js)
      // url: "https://pb.agmx-project.vercel.app",
      googleClientId: "",
      appName: "AGMX",
      demoMode: true, // falls back to data.js mock if PocketBase unreachable
    },
    window.AGMX_CONFIG || {}
  );

  const COLLECTIONS = {
    organizations: "organizations",
    members: "members",
    agms: "agms",
    agmSettings: "agm_settings",
    agenda: "agenda_items",
    candidates: "candidates",
    motions: "motions",
    votes: "votes",
    resolutions: "resolutions",
    attendance: "attendance",
    quorum: "quorum_snapshots",
    notices: "agm_notices",
    noticeRecipients: "notice_recipients",
    questions: "questions",
    actions: "actions",
    complianceRules: "compliance_rules",
    complianceChecks: "compliance_checks",
    complianceFindings: "compliance_findings",
    documents: "documents",
    auditEvents: "audit_events",
    statusHistory: "member_status_history",
    plans: "plans",
    subscriptions: "subscriptions",
    assessments: "agm_assessments",
    quotes: "quotes",
    invoices: "invoices",
    payments: "payments",
    partners: "partners",
    partnerOrgs: "partner_organizations",
    federations: "federations",
    federationOrgs: "federation_organizations",
  };

  // ---- Minimal PocketBase SDK (no npm needed) ------------------
  // Implements the subset of the PocketBase JS SDK that AGMX needs:
  //   authWithOAuth2, authWithPassword, requestOTP / verifyOTP,
  //   collection().getFullList/getFirstListItem/create/update,
  //   subscribe (SSE realtime)
  class PB {
    constructor(baseUrl) {
      this.baseUrl = baseUrl.replace(/\/$/, "");
      this.authToken = localStorage.getItem("pb_token") || "";
      this.authRecord = null;
      try {
        const raw = localStorage.getItem("pb_auth");
        if (raw) this.authRecord = JSON.parse(raw);
      } catch (_) {
        /* ignore */
      }
      this._listeners = {};
    }

    // ---- internal helpers ----
    _headers(extra) {
      const h = Object.assign({ "Content-Type": "application/json" }, extra || {});
      if (this.authToken) h["Authorization"] = this.authToken;
      return h;
    }

    _saveAuth(token, record) {
      this.authToken = token || "";
      this.authRecord = record || null;
      if (token) localStorage.setItem("pb_token", token);
      else localStorage.removeItem("pb_token");
      if (record) localStorage.setItem("pb_auth", JSON.stringify(record));
      else localStorage.removeItem("pb_auth");
    }

    async _request(path, options = {}) {
      const url = this.baseUrl + path;
      const res = await fetch(url, {
        method: options.method || "GET",
        headers: this._headers(options.headers),
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (_) {
        data = { raw: text };
      }
      if (!res.ok) {
        const err = new Error(
          (data && (data.message || data.data)) || "HTTP " + res.status
        );
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    }

    // ---- auth ----
    /**
     * Google OAuth2. PocketBase must have the Google provider enabled and
     * `clientId` configured in Settings → Auth (see GOOGLE_AUTH_SETUP.md).
     * Returns { token, record }.
     */
    async authWithGoogle() {
      const provider = "google";
      const redirect = location.origin + location.pathname;

      // 1) Ask PocketBase for the OAuth2 authorization URL.
      const cfg = await this._request(
        `/api/collections/${COLLECTIONS.users || "_pb_users_auth_"}/auth-methods`
      ).catch(() => null);

      // Fall back to the standard endpoint name.
      const endpoint =
        cfg && cfg.google ? "/api/collections/_pb_users_auth_/auth-methods" : null;

      // Build the URL manually (stable across PocketBase versions).
      const authUrl =
        `${this.baseUrl}/api/collections/_pb_users_auth_/auth-methods` +
        `?provider=${provider}&redirect=${encodeURIComponent(redirect)}`;

      // 2) Redirect the browser to Google consent screen.
      const res = await fetch(authUrl, { method: "GET" });
      if (!res.ok) {
        throw new Error(
          "Google auth is not configured on the PocketBase server. " +
            "See GOOGLE_AUTH_SETUP.md."
        );
      }
      const data = await res.json();
      location.href = data.authURL;

      // Unreachable in the main document flow; used when PocketBase is
      // embedded in an iframe / popup flow.
      return new Promise((resolve, reject) => {
        window.addEventListener("message", async (ev) => {
          try {
            const payload = JSON.parse(ev.data);
            if (!payload || !payload.token) return;
            this._saveAuth(payload.token, payload.record);
            resolve({ token: payload.token, record: payload.record });
          } catch (e) {
            reject(e);
          }
        });
        void endpoint;
      });
    }

    /** Standard email+password login (fallback / staff accounts). */
    async authWithPassword(email, password) {
      const data = await this._request(
        "/api/collections/_pb_users_auth_/auth-with-password",
        { method: "POST", body: { identity: email, password } }
      );
      this._saveAuth(data.token, data.record);
      return data;
    }

    /** Email OTP (PocketBase v0.23+) — used for One Click Join. */
    async requestEmailOTP(email) {
      return this._request(
        "/api/collections/_pb_users_auth_/request-otp",
        { method: "POST", body: { email } }
      );
    }

    async verifyEmailOTP(email, token) {
      const data = await this._request(
        "/api/collections/_pb_users_auth_/auth-with-otp",
        { method: "POST", body: { email, token } }
      );
      this._saveAuth(data.token, data.record);
      return data;
    }

    /** SMS OTP for members without email (pocketbase-plugin-otp-sms). */
    async requestSMSOTP(phone) {
      return this._request(
        "/api/collections/_pb_users_auth_/request-sms-otp",
        { method: "POST", body: { phone } }
      );
    }

    async verifySMSOTP(phone, token) {
      const data = await this._request(
        "/api/collections/_pb_users_auth_/auth-with-sms-otp",
        { method: "POST", body: { phone, token } }
      );
      this._saveAuth(data.token, data.record);
      return data;
    }

    async logout() {
      try {
        await this._request("/api/collections/_pb_users_auth_/auth-refresh", {
          method: "DELETE",
        });
      } catch (_) {
        /* ignore */
      }
      this._saveAuth("", null);
    }

    get isValid() {
      return !!this.authToken;
    }

    get currentUser() {
      return this.authRecord;
    }

    // ---- collections ----
    collection(name) {
      const self = this;
      return {
        name,

        async getFullList({ filter, sort, fields, limit = 1000, expand } = {}) {
          const qs = new URLSearchParams();
          if (filter) qs.set("filter", filter);
          if (sort) qs.set("sort", sort);
          if (fields) qs.set("fields", fields);
          if (expand) qs.set("expand", expand);
          qs.set("perPage", String(Math.min(limit, 2000)));
          return self._request(
            `/api/collections/${name}/records?` + qs.toString()
          );
        },

        async getList(opts = {}) {
          const qs = new URLSearchParams();
          if (opts.filter) qs.set("filter", opts.filter);
          if (opts.sort) qs.set("sort", opts.sort);
          if (opts.page) qs.set("page", String(opts.page));
          qs.set("perPage", String(opts.perPage || 50));
          return self._request(
            `/api/collections/${name}/records?` + qs.toString()
          );
        },

        async getFirstListItem(filter) {
          const list = await this.getFullList({ filter, limit: 1 });
          return list.items[0];
        },

        async getOne(id, expand) {
          const qs = expand ? "?expand=" + expand : "";
          return self._request(
            `/api/collections/${name}/records/${id}${qs}`
          );
        },

        async create(body, query = {}) {
          const qs = new URLSearchParams(query).toString();
          return self._request(
            `/api/collections/${name}/records${qs ? "?" + qs : ""}`,
            { method: "POST", body }
          );
        },

        async update(id, body) {
          return self._request(`/api/collections/${name}/records/${id}`, {
            method: "PATCH",
            body,
          });
        },

        async remove(id) {
          return self._request(`/api/collections/${name}/records/${id}`, {
            method: "DELETE",
          });
        },

        /** Realtime SSE subscription. Returns unsubscribe fn. */
        subscribe(topic, callback) {
          return self._subscribe(name, topic, callback);
        },
      };
    }

    // ---- realtime (SSE) ----
    _subscribe(collection, topic, callback) {
      const url =
        `${this.baseUrl}/api/realtime` +
        `?topics=${encodeURIComponent(collection + "/" + topic)}` +
        (this.authToken ? `&auth=${encodeURIComponent(this.authToken)}` : "");

      const es = new EventSource(url);
      es.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          callback(payload);
        } catch (_) {
          /* ignore malformed frames */
        }
      };
      es.onerror = () => {
        /* EventSource auto-reconnects */
      };
      return () => es.close();
    }
  }

  // ---- AGMX API layer -------------------------------------------
  const pb = new PB(CONFIG.url);

  /** Resolve the auth record's organizationId + role + memberId. */
  function authContext() {
    const u = pb.currentUser;
    if (!u) return null;
    const meta = u.organizationId || (u.meta && u.meta.organizationId) || null;
    return {
      userId: u.id,
      email: u.email,
      name: u.name,
      organizationId: meta,
      role: (u.meta && u.meta.role) || u.role || "member",
      memberId: (u.meta && u.meta.memberId) || null,
    };
  }

  /** Map a PocketBase members record → the shape data.js uses. */
  function mapMember(rec) {
    const r = rec;
    return {
      id: r.memberNo,
      pbId: r.id,
      name: r.name,
      ic: r.ic || "",
      phone: r.phone || "",
      shares: r.shares || 0,
      status: r.status || "Aktif",
      arrears: r.arrears || 0,
      eligible: !!r.eligible,
      age: r.age || null,
      proxy: r.proxyOf || null,
      attended: !!r.attended,
      joined: r.joinedAt || "",
    };
  }

  /** Map a PocketBase motions record → data.js shape. */
  function mapMotion(rec) {
    const r = rec;
    return {
      id: r.code,
      pbId: r.id,
      title: r.title,
      proposer: r.proposerId || "-",
      seconder: r.seconderId || null,
      status: (r.status || "draf").toUpperCase(),
      type: r.type || "lain",
      proposedAt: r.proposedAt || "-",
      secondedAt: r.secondedAt || null,
      discussion: Array.isArray(r.discussion) ? r.discussion : [],
      votes: r.votes || { ya: 0, tidak: 0, abstain: 0 },
    };
  }

  /** Map agenda_items → data.js shape. */
  function mapAgenda(rec) {
    const r = rec;
    return {
      id: r.code,
      title: r.title,
      type: (r.type || "").replace(/^./, (c) => c.toUpperCase()),
      duration: r.durationMin || 10,
      status: r.status || "menunggu",
      presenter: r.presenter || "",
      sortOrder: r.sortOrder || 0,
    };
  }

  /** Map candidates → data.js shape. */
  function mapCandidate(rec) {
    const r = rec;
    const initials = (r.name || "")
      .replace(/^(Pn\.|En\.|Cik|Pn |En |Cik )\s*/i, "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
    const colors = ["#0B5394", "#7B1FA2", "#10B981", "#F59E0B", "#E91E63", "#2196F3", "#9C27B0", "#FF5722"];
    return {
      id: r.code,
      pbId: r.id,
      name: r.name,
      age: r.age || null,
      position: r.position || "Ahli Lembaga",
      votes: 0,
      manifesto: r.manifesto || "",
      photo: initials,
      color: colors[(r.sortOrder || 0) % colors.length],
      zone: r.zone || "",
    };
  }

  const api = {
    pb,
    config: CONFIG,
    COLLECTIONS,

    /** Restore a saved session. Safe to call on every page load. */
    async init() {
      if (!pb.isValid) return null;
      try {
        const record = await pb
          .collection("_pb_users_auth_")
          .getOne(pb.authRecord.id);
        pb._saveAuth(pb.authToken, record);
        return record;
      } catch (_) {
        pb._saveAuth("", null);
        return null;
      }
    },

    authContext,
    isAuthenticated() {
      return pb.isValid;
    },

    // ---- auth ----
    loginWithGoogle: () => pb.authWithGoogle(),
    loginWithPassword: (email, pw) => pb.authWithPassword(email, pw),
    requestEmailOTP: (email) => pb.requestEmailOTP(email),
    verifyEmailOTP: (email, token) => pb.verifyEmailOTP(email, token),
    requestSMSOTP: (phone) => pb.requestSMSOTP(phone),
    verifySMSOTP: (phone, token) => pb.verifySMSOTP(phone, token),
    logout: () => pb.logout(),

    // ---- queries ----
    async loadOrganization(orgId) {
      const rec = await pb.collection(COLLECTIONS.organizations).getOne(orgId);
      return {
        id: rec.registrationNo || rec.slug,
        pbId: rec.id,
        name: rec.name,
        shortName: rec.shortName || rec.name,
        registrationNo: rec.registrationNo || "",
        state: rec.state || "",
        zone: rec.zone || "",
        members: 0, // filled by loadMembers count
        quorumPct: (rec.settings && rec.settings.quorumPct) || 25,
        quorumRequired: 0,
        uukRef: (rec.settings && rec.settings.uukRef) || "",
        logoText: (rec.shortName || rec.name || "").slice(0, 2).toUpperCase(),
        logoColor: "#0B5394",
        founded: rec.founded || "",
        plan: rec.plan || "starter",
        renewalDate: rec.settings && rec.settings.renewalDate,
      };
    },

    async loadMembers(orgId) {
      const list = await pb
        .collection(COLLECTIONS.members)
        .getFullList({
          filter: `organizationId = "${orgId}"`,
          sort: "memberNo",
        });
      return list.items.map(mapMember);
    },

    async loadCurrentAGM(orgId) {
      const rec = await pb.collection(COLLECTIONS.agms).getFirstListItem(
        `organizationId = "${orgId}" && (status = "live" || status = "open" || status = "notice" || status = "closed" || status = "minuted")`
      );
      const quorum = await pb.collection(COLLECTIONS.quorum).getFirstListItem(
        `agmId = "${rec.id}"`,
      );
      const att = await pb
        .collection(COLLECTIONS.attendance)
        .getFullList({ filter: `agmId = "${rec.id}"` });

      return {
        id: rec.id,
        code: `AGM-${rec.edition}`,
        pbId: rec.id,
        title: rec.title,
        edition: `AGM Ke-${rec.edition}${rec.fiscalYear ? " (Tahun Kewangan " + rec.fiscalYear + ")" : ""}`,
        date: rec.scheduledAt,
        time: "",
        venue: rec.venue || "",
        mode: rec.mode || "hybrid",
        status: (rec.status || "").toUpperCase(),
        startedAt: rec.startedAt || "",
        elapsed: "",
        quorumPct: quorum ? Number(quorum.pct) : 0,
        quorumRequired: quorum
          ? Math.ceil((quorum.totalMembers * Number(rec.quorumPct)) / 100)
          : 0,
        quorumPresent: att.items.length,
        totalMembers: quorum ? quorum.totalMembers : 0,
        lateNoticeDays: rec.noticeDays || 21,
        noticesSent: 0,
        noticesRead: 0,
        noticesOpened: 0,
      };
    },

    async loadAgenda(agmId) {
      const list = await pb
        .collection(COLLECTIONS.agenda)
        .getFullList({ filter: `agmId = "${agmId}"`, sort: "sortOrder" });
      return list.items.map(mapAgenda);
    },

    async loadCandidates(agmId) {
      const list = await pb
        .collection(COLLECTIONS.candidates)
        .getFullList({ filter: `agmId = "${agmId}"`, sort: "sortOrder" });
      return list.items.map(mapCandidate);
    },

    async loadMotions(agmId) {
      const list = await pb
        .collection(COLLECTIONS.motions)
        .getFullList({ filter: `agmId = "${agmId}"`, sort: "code" });

      // Attach tallies.
      const motions = list.items.map(mapMotion);
      await Promise.all(
        motions.map(async (m) => {
          const votes = await pb
            .collection(COLLECTIONS.votes)
            .getFullList({ filter: `motionId = "${m.pbId}"` });
          m.votes = tally(votes.items);
        })
      );
      return motions;
    },

    async loadQuestions(agmId) {
      const list = await pb
        .collection(COLLECTIONS.questions)
        .getFullList({ filter: `agmId = "${agmId}"`, sort: "-upvotes" });
      return list.items.map((q) => ({
        id: q.id.slice(0, 8),
        from: q.askerId || "-",
        text: q.text,
        category: q.category || "",
        upvotes: q.upvotes || 0,
        status: q.status || "baru",
        grouped: q.groupedCount || 1,
      }));
    },

    async loadActions(orgId) {
      const list = await pb
        .collection(COLLECTIONS.actions)
        .getFullList({ filter: `organizationId = "${orgId}"` });
      return list.items.map((a) => ({
        id: a.id.slice(0, 8),
        title: a.title,
        pic: a.picRole || a.picId || "-",
        due: a.dueDate || "",
        status: a.status || "terbuka",
        fromMotion: a.resolutionId || "",
      }));
    },

    async loadAuditLog(orgId, limit = 200) {
      const list = await pb
        .collection(COLLECTIONS.auditEvents)
        .getFullList({
          filter: `organizationId = "${orgId}"`,
          sort: "-occurredAt",
          limit,
        });
      return list.items.map((e) => ({
        ts: e.occurredAt,
        actor: e.actorName || e.actorId || "-",
        action: e.action,
        detail: (e.payload && e.payload.detail) || e.action,
        hash: e.hash ? e.hash.slice(0, 8) + "…" : "",
        ip: e.payload && e.payload.ip ? e.payload.ip : "—",
        sig: e.hash ? "✓" : "",
      }));
    },

    async loadCompliance(orgId, agmId) {
      const checks = await pb
        .collection(COLLECTIONS.complianceChecks)
        .getFullList({
          filter: `organizationId = "${orgId}" && agmId = "${agmId}"`,
          expand: "ruleId",
        });
      const passed = checks.items.filter((c) => c.result === "lulus").length;
      const warned = checks.items.filter((c) => c.result === "amaran").length;
      const total = checks.items.length || 1;

      return {
        score: Math.round(((passed + warned * 0.5) / total) * 100),
        aktaChips: checks.items.map((c) => {
          const rule = c.expand && c.expand.ruleId ? c.expand.ruleId : {};
          return {
            id: rule.code || c.ruleId,
            label: rule.label || "",
            status: (c.result || "").toUpperCase(),
            evidence:
              (c.details && (c.details.evidence || c.details.note)) || "",
          };
        }),
      };
    },

    // ---- mutations ----
    async castVote({ orgId, agmId, motionId, choice }) {
      const ctx = authContext();
      if (!ctx || !ctx.memberId) throw new Error("Not authorised to vote");

      // Append-only: the collection has updateRule/deleteRule = "" so a
      // vote can never be changed or removed once cast.
      const vote = await pb.collection(COLLECTIONS.votes).create({
        organizationId: orgId,
        agmId,
        motionId,
        voterId: ctx.memberId,
        choice,
        castAt: new Date().toISOString(),
      });

      // Write the chained audit event.
      await api.appendAudit(orgId, {
        action: "vote.cast",
        entityType: "votes",
        entityId: vote.id,
        payload: { choice, motionId },
      });

      return vote;
    },

    async checkIn({ orgId, agmId, memberId, method = "qr" }) {
      const rec = await pb.collection(COLLECTIONS.attendance).create({
        organizationId: orgId,
        agmId,
        memberId,
        method,
        checkInAt: new Date().toISOString(),
      });
      await api.refreshQuorum(orgId, agmId);
      return rec;
    },

    async refreshQuorum(orgId, agmId) {
      const [members, att, agm] = await Promise.all([
        pb
          .collection(COLLECTIONS.members)
          .getFullList({ filter: `organizationId = "${orgId}"`, limit: 1, fields: "id" }),
        pb.collection(COLLECTIONS.attendance).getFullList({ filter: `agmId = "${agmId}"` }),
        pb.collection(COLLECTIONS.agms).getOne(agmId),
      ]);
      const total = members.totalItems || att.items.length;
      const present = att.items.length;
      const pct = total ? Number(((present / total) * 100).toFixed(2)) : 0;

      return pb.collection(COLLECTIONS.quorum).create({
        organizationId: orgId,
        agmId,
        totalMembers: total,
        present,
        pct,
        satisfied: pct >= Number(agm.quorumPct || 25),
        capturedAt: new Date().toISOString(),
      });
    },

    /**
     * Append an audit event with a chained SHA-256 hash.
     * prev_hash = hash of the previous event for this org, so the chain is
     * tamper-evident (the same guarantee the prototype UI renders).
     */
    async appendAudit(orgId, { action, entityType, entityId, payload }) {
      const prev = await pb
        .collection(COLLECTIONS.auditEvents)
        .getFirstListItem(`organizationId = "${orgId}"`);

      const prevHash = prev ? prev.hash : "GENESIS";
      const occurredAt = new Date().toISOString();
      const material = `${prevHash}|${occurredAt}|${action}|${entityType}|${entityId}|${JSON.stringify(payload || {})}`;

      const hash = await sha256Hex(material);
      const ctx = authContext();

      return pb.collection(COLLECTIONS.auditEvents).create({
        organizationId: orgId,
        actorId: ctx ? ctx.userId : undefined,
        actorName: ctx ? ctx.name : undefined,
        action,
        entityType,
        entityId,
        payload: payload || {},
        prevHash,
        hash,
        occurredAt,
      });
    },

    // ---- realtime ----
    subscribeVotes(agmId, cb) {
      return pb
        .collection(COLLECTIONS.votes)
        .subscribe(agmId, cb);
    },
    subscribeAttendance(agmId, cb) {
      return pb
        .collection(COLLECTIONS.attendance)
        .subscribe(agmId, cb);
    },
    subscribeMotions(agmId, cb) {
      return pb
        .collection(COLLECTIONS.motions)
        .subscribe(agmId, cb);
    },

    // ---- composite loaders (data.js-shaped output) ----
    async loadDashboard() {
      const ctx = authContext();
      if (!ctx || !ctx.organizationId) throw new Error("No organization bound");

      const orgId = ctx.organizationId;
      const [organization, agm] = await Promise.all([
        api.loadOrganization(orgId),
        api.loadCurrentAGM(orgId),
      ]);

      const [members, agenda, candidates, motions, questions, actions, auditLog, compliance] =
        await Promise.all([
          api.loadMembers(orgId),
          api.loadAgenda(agm.pbId),
          api.loadCandidates(agm.pbId),
          api.loadMotions(agm.pbId),
          api.loadQuestions(agm.pbId),
          api.loadActions(orgId),
          api.loadAuditLog(orgId),
          api.loadCompliance(orgId, agm.pbId),
        ]);

      organization.members = agm.totalMembers || members.length;
      organization.quorumRequired = agm.quorumRequired;

      return {
        cooperative: organization,
        currentUser: {
          id: ctx.memberId || ctx.userId,
          name: ctx.name,
          role: ctx.role,
          avatar: (ctx.name || "?").slice(0, 2).toUpperCase(),
          language: "BM",
        },
        members,
        agm,
        agenda,
        candidates,
        motions,
        questions,
        actions,
        auditLog,
        compliance,
        health: {
          activeSessions: agm.quorumPresent,
          wsLatency: 0,
          bandwidth: 0,
        },
        financialSummary: (organization.settings &&
          organization.settings.financialSummary) || {
          revenue: "—",
          netProfit: "—",
          dividend: "—",
          totalAssets: "—",
          totalLiabilities: "—",
          yoyProfit: "—",
        },
        languages: ["Bahasa Melayu", "English"],
        source: "pocketbase",
      };
    },
  };

  // ---- helpers ----
  function tally(votes) {
    const t = { ya: 0, tidak: 0, abstain: 0, total: votes.length };
    votes.forEach((v) => {
      if (v.choice === "ya") t.ya++;
      else if (v.choice === "tidak") t.tidak++;
      else t.abstain++;
    });
    return t;
  }

  async function sha256Hex(str) {
    if (window.crypto && window.crypto.subtle) {
      const buf = await window.crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(str)
      );
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    // Non-secure context fallback (http on a LAN) — not cryptographically
    // strong; production must run behind HTTPS.
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return "weak-" + (h >>> 0).toString(16);
  }

  // ---- expose ----
  window.AGMX_API = api;
  window.AGMX_PB = pb;
})();
