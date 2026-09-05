/* ============================================================
   AGMX — API Layer (Sprint 2 · Money Flow)
   Lead → Assessment → Quote → Invoice → Payment → AGM scheduled

   One async interface, two adapters:
     * LocalAdapter    — localStorage persistence (demo mode, default)
     * SupabaseAdapter — PostgREST RPC calls (see supabase/schema.sql,
                         functions submit_agm_assessment / create_quote_for_
                         assessment / accept_quote / create_invoice_for_quote /
                         record_payment)

   Configuration (first match wins):
     1. window.AGMX_CONFIG = { mode: "supabase", url, anonKey }
     2. localStorage "agmx_backend_cfg"  (set from leads.html → Tetapan Backend)
     3. default: { mode: "local" }

   Browser:  <script src="api.js"></script>   →  window.AGMX_API
   Node:     const AGMX_API = require("./api.js")   (tools/test_money_flow.mjs)

   NOTE (red-team honesty): in local mode nothing leaves the browser.
   The Supabase adapter is live only once a project is provisioned and
   the RPCs from supabase/schema.sql are applied.
   ============================================================ */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AGMX_API = factory();
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  /* ---------- storage shim (browser localStorage / node memory) ---------- */
  const store = (function () {
    if (typeof localStorage !== "undefined" && localStorage !== null) return localStorage;
    const mem = new Map(); // node (tests) — per-process only
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)); },
      removeItem: (k) => { mem.delete(k); },
    };
  })();

  const KEYS = {
    leads: "agmx_leads_v1",      // shared with assessment.js (demo continuity)
    quotes: "agmx_quotes_v1",
    invoices: "agmx_invoices_v1",
    payments: "agmx_payments_v1",
    audit: "agmx_audit_v1",
    cfg: "agmx_backend_cfg",
  };

  const TAX_RATE = 0.08;          // SST 8% on services — shown separately on the invoice
  const QUOTE_VALID_DAYS = 30;    // quote valid for 30 days
  const INVOICE_DUE_DAYS = 14;    // payment terms: net 14 days

  /* Sales pipeline stages (BM — matches assessment.html pipeline chips) */
  const STAGES = [
    "Assessment Diterima",
    "Dihubungi",
    "Sebut Harga Dihantar",
    "Sebut Harga Diterima",
    "Dibayar",
    "AGM Dijadualkan",
  ];

  const PAYMENT_METHODS = {
    fpx: "FPX (Perbankan Dalam Talian)",
    card: "Kad Kredit / Debit",
    bank_transfer: "Pemindahan Bank (Manual)",
  };

  /* ---------- helpers ---------- */
  const readArr = (k) => { try { return JSON.parse(store.getItem(k)) || []; } catch (e) { return []; } };
  const writeArr = (k, v) => store.setItem(k, JSON.stringify(v));
  /* monotonic sequence: keeps same-millisecond audit events in order */
  let _seq = (function () {
    const log = readArr(KEYS.audit);
    return log.reduce((m, e) => Math.max(m, Number(e.seq) || 0), 0);
  })();
  const pad = (n, w) => String(n).padStart(w, "0");
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const RM = (n) =>
    "RM" + Number(n).toLocaleString("ms-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const nowIso = () => new Date().toISOString();

  /* Next human reference in a list, e.g. nextRef("LD-", leads) → LD-0007 */
  function nextRef(prefix, list) {
    let max = 0;
    for (const it of list) {
      const m = /(\d+)$/.exec(String(it.id || it.number || ""));
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return prefix + pad(max + 1, 4);
  }

  /* Year-scoped document number, e.g. QT-2026-003 */
  function nextDocNumber(prefix, list) {
    const yr = new Date().getFullYear();
    let max = 0;
    for (const it of list) {
      const m = new RegExp("^" + prefix + yr + "-(\\d+)$").exec(String(it.number || ""));
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return prefix + yr + "-" + pad(max + 1, 3);
  }

  /* ============================================================
     LOCAL ADAPTER (demo — persists in this browser only)
     ============================================================ */
  const LocalAdapter = {

    /* ----- diagnostics ----- */
    async status() {
      return { mode: "local", ok: true, label: "Demo Tempatan (localStorage)" };
    },

    /* ----- leads / assessments ----- */
    async submitAssessment(p) {
      const leads = readArr(KEYS.leads);
      const lead = {
        /* identity */
        id: nextRef("LD-", leads),
        createdAt: nowIso(),
        stage: STAGES[0],
        /* cooperative profile */
        coopName: p.coopName || "",
        coopReg: p.coopReg || "",
        state: p.state || "",
        members: Number(p.members) || 0,
        agmDate: p.agmDate || "",
        mode: p.mode || "hybrid",
        attendance: Number(p.attendance) || 0,
        candidates: Number(p.candidates) || 0,
        motions: Number(p.motions) || 0,
        process: p.process || "mixed",
        managed: !!p.managed,
        /* scoring outcome */
        score: Number(p.score) || 0,
        factors: p.factors || [],
        pkgKey: p.pkgKey || "",
        pkgName: p.pkgName || "",
        pkgPrice: Number(p.pkgPrice) || 0,
        quote: Number(p.pkgPrice) || Number(p.quote) || 0,   /* legacy field used by assessment.js table */
        /* contact */
        contactName: p.contactName || "",
        contactPhone: p.contactPhone || "",
        contactEmail: p.contactEmail || "",
        /* linked commercial docs (filled in by the money flow) */
        quoteId: null,
        invoiceId: null,
        paymentId: null,
      };
      leads.unshift(lead);
      writeArr(KEYS.leads, leads);
      this._audit("assessment.submitted", "lead", lead.id, {
        coop: lead.coopName, score: lead.score, package: lead.pkgName,
      });
      return lead;
    },

    async listAssessments() {
      return readArr(KEYS.leads).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },

    async getAssessment(ref) {
      return readArr(KEYS.leads).find((l) => l.id === ref) || null;
    },

    async updateLeadStage(ref, stage) {
      const leads = readArr(KEYS.leads);
      const lead = leads.find((l) => l.id === ref);
      if (!lead) throw new Error("Lead tidak dijumpai: " + ref);
      const from = lead.stage;
      lead.stage = stage;
      writeArr(KEYS.leads, leads);
      this._audit("lead.stage_changed", "lead", ref, { from, to: stage });
      return lead;
    },

    /* ----- quotes ----- */
    async createQuote(input) {
      /* input: { leadRef, items: [{ description, qty, unitPrice }] } */
      const leads = readArr(KEYS.leads);
      const lead = leads.find((l) => l.id === input.leadRef);
      if (!lead) throw new Error("Lead tidak dijumpai: " + input.leadRef);

      const quotes = readArr(KEYS.quotes);
      const items = (input.items || []).map((it) => {
        const qty = Math.max(1, Number(it.qty) || 1);
        const unitPrice = round2(it.unitPrice);
        return {
          description: it.description,
          qty,
          unitPrice,
          lineTotal: round2(qty * unitPrice),
        };
      });
      if (!items.length) throw new Error("Sebut harga mesti ada sekurang-kurangnya satu item.");

      const subtotal = round2(items.reduce((s, it) => s + it.lineTotal, 0));
      const tax = round2(subtotal * TAX_RATE);
      const total = round2(subtotal + tax);

      const quote = {
        id: nextDocNumber("QT-", quotes),   /* id === number (QT-YYYY-NNN) */
        number: nextDocNumber("QT-", quotes),
        leadRef: lead.id,
        items,
        subtotal, tax, taxRate: TAX_RATE, total,
        currency: "MYR",
        status: "sent",                 // self-serve flow: visible to the lead immediately
        validUntil: addDays(QUOTE_VALID_DAYS),
        createdAt: nowIso(),
        acceptedAt: null,
      };
      quote.id = quote.number;
      quotes.unshift(quote);
      writeArr(KEYS.quotes, quotes);

      lead.quoteId = quote.number;
      lead.stage = STAGES[2];          // "Sebut Harga Dihantar"
      writeArr(KEYS.leads, leads);

      this._audit("quote.created", "quote", quote.number, {
        lead: lead.id, total, items: items.length,
      });
      return quote;
    },

    async getQuote(id) {
      return readArr(KEYS.quotes).find((q) => q.number === id || q.id === id) || null;
    },

    async acceptQuote(id) {
      const quotes = readArr(KEYS.quotes);
      const quote = quotes.find((q) => q.number === id || q.id === id);
      if (!quote) throw new Error("Sebut harga tidak dijumpai: " + id);
      if (quote.status === "accepted") return quote;
      quote.status = "accepted";
      quote.acceptedAt = nowIso();
      writeArr(KEYS.quotes, quotes);

      const leads = readArr(KEYS.leads);
      const lead = leads.find((l) => l.id === quote.leadRef);
      if (lead) { lead.stage = STAGES[3]; writeArr(KEYS.leads, leads); } // "Sebut Harga Diterima"

      this._audit("quote.accepted", "quote", quote.number, { lead: quote.leadRef, total: quote.total });
      return quote;
    },

    /* ----- invoices ----- */
    async createInvoice(quoteId) {
      const quote = await this.getQuote(quoteId);
      if (!quote) throw new Error("Sebut harga tidak dijumpai: " + quoteId);

      const invoices = readArr(KEYS.invoices);
      const invoice = {
        id: nextRef("INV-", invoices),
        number: nextDocNumber("INV-", invoices),
        quoteId: quote.number,
        leadRef: quote.leadRef,
        amount: quote.total,
        currency: "MYR",
        status: "unpaid",
        issuedAt: today(),
        dueAt: addDays(INVOICE_DUE_DAYS),
        paidAt: null,
      };
      invoices.unshift(invoice);
      writeArr(KEYS.invoices, invoices);

      const leads = readArr(KEYS.leads);
      const lead = leads.find((l) => l.id === quote.leadRef);
      if (lead) { lead.invoiceId = invoice.number; writeArr(KEYS.leads, leads); }

      this._audit("invoice.created", "invoice", invoice.number, {
        quote: quote.number, amount: invoice.amount, due: invoice.dueAt,
      }, quote.leadRef);
      return invoice;
    },

    async getInvoice(id) {
      return readArr(KEYS.invoices).find((i) => i.number === id || i.id === id) || null;
    },

    /* ----- payments -----
       method: fpx | card | bank_transfer
         * fpx / card           → simulated gateway, succeeds instantly (demo)
         * bank_transfer        → status "pending" until an operator verifies
    */
    async payInvoice(invoiceId, opts) {
      const opts2 = opts || {};
      const invoices = readArr(KEYS.invoices);
      const invoice = invoices.find((i) => i.number === invoiceId || i.id === invoiceId);
      if (!invoice) throw new Error("Invois tidak dijumpai: " + invoiceId);
      if (invoice.status === "paid") throw new Error("Invois sudah dibayar.");

      const method = opts2.method || "fpx";
      if (!PAYMENT_METHODS[method]) throw new Error("Kaedah pembayaran tidak sah: " + method);
      const pending = method === "bank_transfer";
      const reference =
        opts2.reference ||
        (pending
          ? "TRF-" + Date.now().toString(36).toUpperCase()
          : method.toUpperCase() + Date.now().toString(36).toUpperCase());

      const payments = readArr(KEYS.payments);
      const payment = {
        id: nextRef("PAY-", payments),
        invoiceId: invoice.number,
        leadRef: invoice.leadRef,
        method,
        methodLabel: PAYMENT_METHODS[method],
        reference,
        amount: Number(opts2.amount) || invoice.amount,
        currency: "MYR",
        status: pending ? "pending" : "succeeded",
        paidAt: pending ? null : nowIso(),
        createdAt: nowIso(),
      };
      payments.unshift(payment);
      writeArr(KEYS.payments, payments);

      if (!pending) {
        invoice.status = "paid";
        invoice.paidAt = payment.paidAt;
        writeArr(KEYS.invoices, invoices);

        const leads = readArr(KEYS.leads);
        const lead = leads.find((l) => l.id === invoice.leadRef);
        if (lead) {
          lead.paymentId = payment.id;
          lead.stage = STAGES[4];      // "Dibayar"
          writeArr(KEYS.leads, leads);
        }
      }

      this._audit(pending ? "payment.pending_verification" : "payment.succeeded", "payment", payment.id, {
        invoice: invoice.number, method, reference, amount: payment.amount,
      }, invoice.leadRef);
      return payment;
    },

    async listPayments(leadRef) {
      const all = readArr(KEYS.payments);
      return leadRef ? all.filter((p) => p.leadRef === leadRef) : all;
    },

    /* ----- aggregate view for the operator inbox ----- */
    async listDeals() {
      const leads = await this.listAssessments();
      const quotes = readArr(KEYS.quotes);
      const invoices = readArr(KEYS.invoices);
      const payments = readArr(KEYS.payments);
      return leads.map((l) => {
        const quote = quotes.find((q) => q.leadRef === l.id) || null;
        const invoice = invoices.find((i) => i.leadRef === l.id) || null;
        const payment = payments.find((p) => p.leadRef === l.id) || null;
        return {
          lead: l, quote, invoice, payment,
          quoteTotal: quote ? quote.total : 0,
          paidTotal: payment && payment.status === "succeeded" ? payment.amount : 0,
        };
      });
    },

    async metrics() {
      const deals = await this.listDeals();
      const leads = deals.length;
      const quoted = deals.filter((d) => d.quote).length;
      const paid = deals.filter((d) => d.paidTotal > 0).length;
      return {
        leads,
        quoted,
        paid,
        pipelineValue: round2(deals.reduce((s, d) => s + (d.quote ? d.quoteTotal : d.pkgPrice), 0)),
        collectedValue: round2(deals.reduce((s, d) => s + d.paidTotal, 0)),
        quoteRate: leads ? Math.round((quoted / leads) * 100) : 0,
        closeRate: quoted ? Math.round((paid / quoted) * 100) : 0,
      };
    },

    /* ----- audit trail ----- */
    async audit(leadRef) {
      const all = readArr(KEYS.audit);
      return (leadRef ? all.filter((e) => e.leadRef === leadRef) : all)
        .sort((a, b) => (a.seq < b.seq ? 1 : -1));
    },

    _audit(event, entityType, entityId, detail, leadRef) {
      const log = readArr(KEYS.audit);
      const entry = {
        id: "EVT-" + pad(log.length + 1, 5),
        seq: ++_seq,
        ts: nowIso(),
        event,
        entityType,
        entityId,
        leadRef: leadRef || (detail && detail.lead) || (entityType === "lead" ? entityId : null),
        detail: detail || {},
      };
      log.unshift(entry);
      writeArr(KEYS.audit, log);
      return entry;
    },
  };

  /* ============================================================
     SUPABASE ADAPTER (production path — requires schema.sql applied)
     ============================================================ */
  const SupabaseAdapter = {
    mode: "supabase",
    url: "",
    anonKey: "",

    async _rpc(fn, body) {
      const res = await fetch(this.url.replace(/\/+$/, "") + "/rest/v1/rpc/" + fn, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.anonKey,
          Authorization: "Bearer " + this.anonKey,
        },
        body: JSON.stringify(body || {}),
      });
      if (!res.ok) {
        throw new Error("Supabase RPC " + fn + " gagal: HTTP " + res.status + " — " + (await res.text()).slice(0, 200));
      }
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    },

    async status() {
      if (!this.url || !this.anonKey) return { mode: "supabase", ok: false, label: "Supabase (tidak dikonfigurasi)" };
      try {
        const res = await fetch(this.url.replace(/\/+$/, "") + "/rest/v1/", {
          headers: { apikey: this.anonKey, Authorization: "Bearer " + this.anonKey },
        });
        return {
          mode: "supabase",
          ok: res.ok || res.status === 200 || res.status === 404, /* root returns 404 on healthy projects */
          label: "Supabase Live",
        };
      } catch (e) {
        return { mode: "supabase", ok: false, label: "Supabase (tidak dapat dihubungi)" };
      }
    },

    async submitAssessment(p) {
      const out = await this._rpc("submit_agm_assessment", {
        p: {
          coop_name: p.coopName, coop_reg: p.coopReg, state: p.state,
          members: p.members, agm_date: p.agmDate || "", mode: p.mode,
          expected_attendance: p.attendance, candidates: p.candidates,
          motions: p.motions, current_process: p.process, needs_managed: p.managed,
          contact_name: p.contactName, contact_phone: p.contactPhone, contact_email: p.contactEmail || "",
          complexity_score: p.score,
        },
      });
      return Object.assign({}, p, { id: out && out.ref, uuid: out && out.id });
    },

    async listAssessments() {
      const res = await fetch(
        this.url.replace(/\/+$/, "") + "/rest/v1/agm_assessments?select=*&order=created_at.desc&limit=200",
        { headers: { apikey: this.anonKey, Authorization: "Bearer " + this.anonKey } }
      );
      if (!res.ok) throw new Error("Gagal membaca agm_assessments: HTTP " + res.status);
      const rows = await res.json();
      /* normalise to the local lead shape so the inbox renders identically */
      return rows.map((r) => ({
        id: r.reference, uuid: r.id, createdAt: r.created_at,
        stage: r.status, coopName: r.coop_name, coopReg: r.coop_reg, state: r.state,
        members: r.members, agmDate: r.agm_date, mode: r.mode,
        attendance: r.expected_attendance, candidates: r.candidates, motions: r.motions,
        process: r.current_process, managed: r.needs_managed, score: r.complexity_score,
        contactName: r.contact_name, contactPhone: r.contact_phone, contactEmail: r.contact_email,
        quoteId: null, invoiceId: null, paymentId: null,
      }));
    },

    async getAssessment(ref) {
      const all = await this.listAssessments();
      return all.find((l) => l.id === ref) || null;
    },

    async createQuote(input) {
      const out = await this._rpc("create_quote_for_assessment", {
        p_assessment_ref: input.leadRef,
        p_items: (input.items || []).map((it) => ({
          description: it.description, qty: it.qty, unit_price: it.unitPrice,
        })),
      });
      return this._normQuote(out);
    },

    async getQuote(id) {
      const out = await this._rpc("get_quote", { p_number: id });
      return out ? this._normQuote(out) : null;
    },

    async acceptQuote(id) {
      const out = await this._rpc("accept_quote", { p_number: id });
      return out ? this._normQuote(out) : null;
    },

    async createInvoice(quoteId) {
      const out = await this._rpc("create_invoice_for_quote", { p_quote_number: quoteId });
      return this._normInvoice(out);
    },

    async getInvoice(id) {
      const out = await this._rpc("get_invoice", { p_number: id });
      return out ? this._normInvoice(out) : null;
    },

    async payInvoice(invoiceId, opts) {
      const o = opts || {};
      const out = await this._rpc("record_payment", {
        p_invoice_number: invoiceId, p_method: o.method || "fpx", p_reference: o.reference || "",
      });
      return out ? this._normPayment(out) : null;
    },

    async listPayments() { return []; },   /* reads go through listDeals in Sprint 3 */
    async listDeals() {
      const leads = await this.listAssessments();
      return leads.map((l) => ({
        lead: l, quote: null, invoice: null, payment: null,
        quoteTotal: 0, paidTotal: 0,
      }));
    },
    async metrics() {
      const leads = await this.listAssessments();
      return {
        leads: leads.length, quoted: 0, paid: 0,
        pipelineValue: 0, collectedValue: 0, quoteRate: 0, closeRate: 0,
      };
    },
    async updateLeadStage() { return null; }, /* stage changes are server-side */
    async audit() { return []; },

    /* --- normalisers: snake_case rows → local camelCase shapes --- */
    _normQuote(r) {
      if (!r) return null;
      return {
        id: r.number, number: r.number, leadRef: r.lead_ref || (r.assessment && r.assessment.ref),
        items: (r.items || []).map((i) => ({
          description: i.description, qty: i.qty, unitPrice: i.unit_price, lineTotal: i.line_total,
        })),
        subtotal: Number(r.subtotal), tax: Number(r.tax), taxRate: Number(r.tax_rate || TAX_RATE),
        total: Number(r.total), currency: "MYR",
        status: r.status, validUntil: r.valid_until, createdAt: r.created_at, acceptedAt: r.accepted_at,
      };
    },
    _normInvoice(r) {
      if (!r) return null;
      return {
        id: r.number, number: r.number, quoteId: r.quote_number, leadRef: r.lead_ref,
        amount: Number(r.amount), currency: "MYR", status: r.status,
        issuedAt: r.issued_at, dueAt: r.due_at, paidAt: r.paid_at,
      };
    },
    _normPayment(r) {
      if (!r) return null;
      return {
        id: r.id, invoiceId: r.invoice_number, leadRef: r.lead_ref,
        method: r.method, methodLabel: PAYMENT_METHODS[r.method] || r.method,
        reference: r.reference, amount: Number(r.amount), currency: "MYR",
        status: r.status, paidAt: r.paid_at, createdAt: r.created_at,
      };
    },
  };

  /* ============================================================
     Boot: resolve configuration and pick the adapter
     ============================================================ */
  function readCfg() {
    if (typeof window !== "undefined" && window.AGMX_CONFIG) return window.AGMX_CONFIG;
    try {
      const raw = store.getItem(KEYS.cfg);
      if (raw) {
        const cfg = JSON.parse(raw);
        if (cfg && cfg.mode === "supabase" && cfg.url && cfg.anonKey) return cfg;
      }
    } catch (e) { /* ignore malformed config */ }
    return { mode: "local" };
  }

  const cfg = readCfg();
  let adapter;
  if (cfg.mode === "supabase") {
    SupabaseAdapter.url = cfg.url;
    SupabaseAdapter.anonKey = cfg.anonKey;
    adapter = SupabaseAdapter;
  } else {
    adapter = LocalAdapter;
  }

  /* Public surface (bound so callers can pass methods around freely) */
  const api = {
    adapter,
    TAX_RATE,
    QUOTE_VALID_DAYS,
    INVOICE_DUE_DAYS,
    STAGES,
    PAYMENT_METHODS,
    RM, pad, round2,
    status: () => adapter.status(),
    submitAssessment: (p) => adapter.submitAssessment(p),
    listAssessments: () => adapter.listAssessments(),
    getAssessment: (ref) => adapter.getAssessment(ref),
    updateLeadStage: (ref, stage) => adapter.updateLeadStage(ref, stage),
    createQuote: (input) => adapter.createQuote(input),
    getQuote: (id) => adapter.getQuote(id),
    acceptQuote: (id) => adapter.acceptQuote(id),
    createInvoice: (quoteId) => adapter.createInvoice(quoteId),
    getInvoice: (id) => adapter.getInvoice(id),
    payInvoice: (id, opts) => adapter.payInvoice(id, opts),
    listPayments: (ref) => adapter.listPayments(ref),
    listDeals: () => adapter.listDeals(),
    metrics: () => adapter.metrics(),
    audit: (ref) => adapter.audit(ref),
    /* switch backend at runtime (leads.html settings dialog) */
    configure(next) {
      if (next && next.mode === "supabase" && next.url && next.anonKey) {
        store.setItem(KEYS.cfg, JSON.stringify(next));
      } else {
        store.removeItem(KEYS.cfg);
      }
    },
  };

  return api;
});
