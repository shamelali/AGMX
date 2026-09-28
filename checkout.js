/* ============================================================
   AGMX — Checkout / Money Flow (Sprint 2)
   Quote → Invoice → Payment → Receipt, driven by AGMX_API.

   Demo honesty: the payment gateway is simulated client-side.
   Production swaps LocalAdapter for SupabaseAdapter (api.js) where
   record_payment() runs server-side and appends to audit_events.
   ============================================================ */
(function () {
  "use strict";

  const API = window.AGMX_API;
  const $ = (id) => document.getElementById(id);

  /* Optional add-ons priced per AGMX rate card (quote_items rows) */
  const ADDONS = [
    { key: "facilitator", label: "Fasilitator AGM Tambahan", desc: "1 fasilitator berpengalaman untuk dewan besar / kawalan kehadiran", price: 800 },
    { key: "translate", label: "Penterjemahan Simultan BM ⇄ EN", desc: "Terjemahan langsung semasa AGM untuk ahli pelbagai bahasa", price: 1200 },
    { key: "printpack", label: "Pek Mesyuarat Dicetak & Dihantar", desc: "Pek mesyuarat fizikal dicetak dan dihantar ke dewan AGM", price: 600 },
  ];

  const state = {
    lead: null,
    quote: null,
    invoice: null,
    payment: null,
    step: 1,
    paymentBound: false,
  };

  /* ---------- helpers ---------- */
  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  const RM = (n) => API.RM(n);
  function showToast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 4200);
  }
  const qs = new URLSearchParams(location.search);
  const ref = qs.get("ref");

  function setStep(n) {
    state.step = n;
    document.querySelectorAll("#stepper .step").forEach((el) => {
      const s = Number(el.dataset.step);
      el.classList.toggle("active", s === n);
      el.classList.toggle("done", s < n);
    });
    for (const [card, step] of [
      ["quote-card", 1], ["invoice-card", 2], ["pay-card", 3],
      ["processing-card", 3.5], ["receipt-card", 4],
    ]) {
      $(card).classList.toggle("hidden", step !== n);
    }
    $("audit-card").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function infoGrid(el, pairs) {
    el.innerHTML = pairs.map(([k, v]) =>
      `<div class="info-cell"><div class="k">${k}</div><div class="v">${escapeHtml(v)}</div></div>`).join("");
  }

  function itemRows(tbody, tfoot, items, totals) {
    tbody.innerHTML = items.map((it) =>
      `<tr><td>${escapeHtml(it.description)}</td>
       <td class="num">${it.qty}</td>
       <td class="num">${RM(it.unitPrice)}</td>
       <td class="num"><strong>${RM(it.lineTotal)}</strong></td></tr>`).join("");
    tfoot.innerHTML =
      `<tr><td colspan="3" class="num" style="color:var(--c-text-2)">Subtotal</td><td class="num">${RM(totals.subtotal)}</td></tr>
       <tr><td colspan="3" class="num" style="color:var(--c-text-2)">SST 8%</td><td class="num">${RM(totals.tax)}</td></tr>
       <tr class="grand"><td colspan="3" class="num">Jumlah (MYR)</td><td class="num">${RM(totals.total)}</td></tr>`;
  }

  /* ---------- STEP 1 · QUOTE ---------- */
  function selectedAddons() {
    return ADDONS.filter((a) => {
      const cb = document.querySelector('input[data-addon="' + a.key + '"]');
      return cb && cb.checked;
    });
  }

  function computeTotals() {
    const items = [{
      description: state.lead.pkgName + " — perkhidmatan AGM sekali gus",
      qty: 1, unitPrice: state.lead.pkgPrice,
    }].concat(selectedAddons().map((a) => ({
      description: a.label, qty: 1, unitPrice: a.price,
    })));
    const subtotal = API.round2(items.reduce((s, it) => s + it.qty * it.unitPrice, 0));
    const tax = API.round2(subtotal * API.TAX_RATE);
    return { items, subtotal, tax, total: API.round2(subtotal + tax) };
  }

  function renderQuoteBuilder() {
    const lead = state.lead;
    $("q-title").textContent = "Sebut Harga — " + lead.coopName;
    infoGrid($("q-info"), [
      ["Rujukan Penilaian", lead.id],
      ["Pakej Disarankan", lead.pkgName],
      ["Skor Kerumitan", lead.score + "/100"],
      ["Ahli", Number(lead.members).toLocaleString("ms-MY")],
      ["Negeri", lead.state || "—"],
      ["AGM", lead.agmDate || "Akan ditetapkan"],
    ]);

    /* if a quote already exists, lock the add-on picker (items are frozen) */
    const locked = !!state.quote;
    $("addon-list").innerHTML = ADDONS.map((a) =>
      `<label class="addon${locked ? "" : ""}" data-addon-card="${a.key}">
         <input type="checkbox" data-addon="${a.key}" ${locked ? "disabled" : ""}>
         <span><strong style="font-size:13.5px">${a.label}</strong> · <strong style="color:var(--c-primary)">+${RM(a.price)}</strong>
         <div style="font-size:12px;color:var(--c-text-2);margin-top:2px">${a.desc}</div></span>
       </label>`).join("");
    if (locked) {
      $("q-sub").textContent = "Sebut harga telah diterbitkan. Semak butiran dan teruskan.";
      $("q-continue").textContent = "Terima Sebut Harga & Teruskan →";
    }

    const refresh = () => {
      if (locked) {
        /* show the frozen quote items */
        itemRows($("q-items").querySelector("tbody"), $("q-items").querySelector("tfoot"),
          state.quote.items, state.quote);
      } else {
        const t = computeTotals();
        document.querySelectorAll(".addon").forEach((card) => {
          const key = card.dataset.addonCard;
          card.classList.toggle("on", !!document.querySelector(`input[data-addon="${key}"]`).checked);
        });
        itemRows($("q-items").querySelector("tbody"), $("q-items").querySelector("tfoot"), t.items, t);
      }
      $("q-valid").textContent = locked && state.quote.validUntil
        ? "Sah sehingga " + new Date(state.quote.validUntil).toLocaleDateString("ms-MY")
        : "Sah sehingga " + new Date(Date.now() + API.QUOTE_VALID_DAYS * 864e5).toLocaleDateString("ms-MY");
    };
    document.querySelectorAll('input[data-addon]').forEach((cb) => cb.addEventListener("change", refresh));
    refresh();
  }

  /* Create the quote if missing, accept it, then move to the invoice step */
  async function proceedFromQuote() {
    const btn = $("q-continue");
    btn.disabled = true;
    btn.textContent = "Memproses…";
    try {
      if (!state.quote) {
        const t = computeTotals();
        state.quote = await API.createQuote({
          leadRef: state.lead.id,
          items: t.items.map((it) => ({ description: it.description, qty: it.qty, unitPrice: it.unitPrice })),
        });
        showToast("Sebut harga " + state.quote.number + " diterbitkan.");
      }
      if (state.quote.status !== "accepted") {
        state.quote = await API.acceptQuote(state.quote.number);
      }
      await renderInvoice();
      setStep(2);
    } catch (e) {
      showToast("Ralat: " + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = state.quote && state.quote.status === "accepted"
        ? "Sebut Harga Diterima ✓"
        : "Terbitkan & Terima Sebut Harga →";
    }
  }

  /* ---------- STEP 2 · INVOICE ---------- */
  async function renderInvoice() {
    if (!state.invoice && state.quote) state.invoice = await API.createInvoice(state.quote.number);
    const inv = state.invoice, q = state.quote;
    $("inv-title").textContent = "Invois " + inv.number;
    infoGrid($("inv-info"), [
      ["No. Invois", inv.number],
      ["No. Sebut Harga", q.number],
      ["Rujukan", state.lead.id],
      ["Koperasi", state.lead.coopName],
      ["Diterbitkan", new Date(inv.issuedAt).toLocaleDateString("ms-MY")],
      ["Tamat Tempoh", new Date(inv.dueAt).toLocaleDateString("ms-MY")],
    ]);
    itemRows($("inv-items").querySelector("tbody"), $("inv-items").querySelector("tfoot"), q.items, q);
    $("pay-amount").textContent = RM(inv.amount);
    renderAudit();
  }

  /* ---------- STEP 3 · PAYMENT ---------- */
  function initPaymentControls() {
    if (state.paymentBound) return;
    state.paymentBound = true;

    const update = () => {
      const m = document.querySelector('input[name="paymethod"]:checked').value;
      $("fpx-banks").classList.toggle("hidden", m !== "fpx");
      $("bank-details").classList.toggle("hidden", m !== "bank_transfer");
      $("pay-submit").textContent = m === "bank_transfer"
        ? "Saya Sudah Buat Pemindahan →"
        : "Bayar " + (state.invoice ? RM(state.invoice.amount) : "");
    };
    document.querySelectorAll('input[name="paymethod"]').forEach((r) => r.addEventListener("change", update));
    $("bank-ref").textContent = "AGMX-" + (state.invoice ? state.invoice.number : "") + "-" + state.lead.id;
    update();

    $("pay-submit").addEventListener("click", async () => {
      const method = document.querySelector('input[name="paymethod"]:checked').value;
      const btn = $("pay-submit");
      btn.disabled = true;
      try {
        if (method !== "bank_transfer") {
          $("processing-sub").textContent =
            method === "fpx"
              ? "Menunggu pengesahan " + $("fpx-bank").value + "…"
              : "Menunggu pengesahan 3-D Secure bank anda…";
          setStep(3.5);
          await new Promise((r) => setTimeout(r, 2200)); /* simulated gateway latency */
        }
        state.payment = await API.payInvoice(state.invoice.number, { method });
        await renderReceipt();
        setStep(4);
        showToast("Pembayaran berjaya dirakam.");
      } catch (e) {
        showToast("Ralat: " + e.message);
        setStep(3);
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ---------- STEP 4 · RECEIPT ---------- */
  async function renderReceipt() {
    const p = state.payment, inv = state.invoice;
    const pending = p.status === "pending";
    $("r-sub").textContent = pending
      ? "Pemindahan bank anda menunggu pengesahan pasukan AGMX (1 hari bekerja)."
      : "Terima kasih! AGM koperasi anda kini dijadualkan untuk persediaan.";
    const stamp = document.querySelector(".stamp");
    stamp.innerHTML = pending ? "MENUNGGU<br>PENGESAHAN" : "DIBAYAR<br>✓";
    stamp.style.borderColor = pending ? "var(--c-warning)" : "var(--c-success)";
    stamp.style.color = pending ? "#92400E" : "#047857";
    infoGrid($("r-info"), [
      ["No. Resit", p.id],
      ["No. Invois", inv.number],
      ["Kaedah", p.methodLabel],
      ["Rujukan Gateway", p.reference],
      ["Jumlah", RM(p.amount)],
      ["Dibayar Pada", p.paidAt ? new Date(p.paidAt).toLocaleString("ms-MY") : "—"],
    ]);
    $("r-contact").textContent = state.lead.contactName + " (" + state.lead.contactPhone + ")";
    renderAudit();
  }

  /* ---------- AUDIT TRAIL ---------- */
  const EVENT_LABELS = {
    "assessment.submitted": "Penilaian dihantar",
    "quote.created": "Sebut harga diterbitkan",
    "quote.accepted": "Sebut harga diterima",
    "invoice.created": "Invois diterbitkan",
    "payment.succeeded": "Pembayaran berjaya",
    "payment.pending_verification": "Pemindahan menunggu pengesahan",
    "lead.stage_changed": "Peringkat dikemas kini",
  };

  async function renderAudit() {
    const events = await API.audit(state.lead.id);
    $("audit-list").innerHTML = events.length
      ? events.map((e) =>
          `<div class="audit-item">
             <span class="t">${new Date(e.ts).toLocaleString("ms-MY")}</span>
             <span><strong>${EVENT_LABELS[e.event] || e.event}</strong>
             <span style="color:var(--c-text-3)"> · ${escapeHtml(e.entityType)} ${escapeHtml(e.entityId)}</span></span>
           </div>`).join("")
      : '<p style="font-size:13px;color:var(--c-text-3)">Tiada rekod lagi untuk rujukan ini.</p>';
  }

  /* ---------- BOOT ---------- */
  async function boot() {
    if (!API) { showToast("api.js gagal dimuatkan."); return; }

    /* backend chip */
    try {
      const st = await API.status();
      $("backend-label").textContent = st.label;
      $("backend-chip").classList.toggle("live", !!st.ok);
    } catch (e) { /* non-fatal */ }

    /* static listeners (idempotent handlers check state before acting) */
    $("q-continue").addEventListener("click", proceedFromQuote);
    $("inv-pay").addEventListener("click", () => setStep(3));
    $("inv-print").addEventListener("click", () => window.print());
    $("r-print").addEventListener("click", () => window.print());

    /* resolve lead: ?ref=LD-xxxx → else latest assessment */
    state.lead = ref ? await API.getAssessment(ref) : (await API.listAssessments())[0] || null;

    if (!state.lead) {
      $("empty-card").classList.remove("hidden");
      return;
    }

    /* resume an existing deal if commercial docs already exist */
    const deals = await API.listDeals();
    const deal = deals.find((d) => d.lead.id === state.lead.id) || null;

    if (deal && deal.payment) {
      state.quote = deal.quote; state.invoice = deal.invoice; state.payment = deal.payment;
      renderQuoteBuilder();
      await renderReceipt();
      setStep(4);
      return;
    }
    if (deal && deal.invoice) {
      state.quote = deal.quote; state.invoice = deal.invoice;
      renderQuoteBuilder();
      await renderInvoice();
      initPaymentControls();
      setStep(3);
      return;
    }
    if (deal && deal.quote) {
      state.quote = deal.quote;
      renderQuoteBuilder();
      initPaymentControls();
      if (state.quote.status === "accepted") {
        await renderInvoice();
        setStep(2);
      } else {
        setStep(1);
      }
      return;
    }

    /* fresh deal */
    renderQuoteBuilder();
    initPaymentControls();
    setStep(1);
    renderAudit();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
