/* ============================================================
   AGMX — Lead Inbox (Operator view, Sprint 2)
   Lists every assessment with its commercial documents,
   pipeline metrics, CSV export and backend switching.

   Demo honesty: reads from AGMX_API (localStorage by default).
   Production: Supabase with auth + RLS — see leads.html notice.
   ============================================================ */
(function () {
  "use strict";

  const API = window.AGMX_API;
  const $ = (id) => document.getElementById(id);

  const STAGE_CLASS = {
    "Assessment Diterima": "",
    "Dihubungi": "",
    "Sebut Harga Dihantar": "gold",
    "Sebut Harga Diterima": "warning",
    "Dibayar": "success",
    "AGM Dijadualkan": "success",
  };

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  const RM = (n) => API.RM(n);
  function showToast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3600);
  }
  const dt = (iso) => (iso ? new Date(iso).toLocaleDateString("ms-MY", { day: "2-digit", month: "short" }) : "—");

  let DEALS = [];
  let EVENTS = [];

  /* ---------- rendering ---------- */
  function renderMetrics(m) {
    $("m-leads").textContent = m.leads;
    $("m-pipeline").textContent = RM(m.pipelineValue);
    $("m-collected").textContent = RM(m.collectedValue);
    $("m-close").textContent = m.closeRate + "%";
  }

  function invoiceBadge(inv, pay) {
    if (!inv) return '<span class="badge" style="background:var(--c-divider);color:var(--c-text-2)">—</span>';
    if (pay && pay.status === "succeeded") return '<span class="badge success">Dibayar</span>';
    if (pay && pay.status === "pending") return '<span class="badge warning">Pengesahan</span>';
    if (inv.status === "unpaid") return '<span class="badge danger">Belum Bayar</span>';
    return '<span class="badge">' + escapeHtml(inv.status) + "</span>";
  }

  function renderDeals(filter) {
    const q = (filter || "").toLowerCase();
    const rows = DEALS.filter((d) => {
      if (!q) return true;
      const l = d.lead;
      return [l.id, l.coopName, l.state, l.contactName, l.contactPhone, l.pkgName]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });

    if (!rows.length) {
      $("deals-wrap").innerHTML =
        '<p style="font-size:13.5px;color:var(--c-text-3);padding:14px 4px">Tiada penilaian' +
        (q ? " yang sepadan dengan carian" : " lagi") +
        '. Mulakan di <a href="assessment.html">assessment.html</a>.</p>';
      return;
    }

    $("deals-wrap").innerHTML =
      '<table class="deals-table"><thead><tr>' +
      "<th>Rujukan</th><th>Koperasi</th><th>Ahli</th><th>Skor</th><th>Pakej</th>" +
      '<th class="num">Nilai</th><th>Tahap</th><th>Dokumen</th><th>Invois</th><th></th>' +
      "</tr></thead><tbody>" +
      rows.map((d) => {
        const l = d.lead;
        const value = d.quote ? d.quote.total : l.pkgPrice || 0;
        const docs = [];
        if (d.quote) docs.push("QT " + d.quote.number + (d.quote.status === "accepted" ? " ✓" : ""));
        if (d.invoice) docs.push("INV " + d.invoice.number);
        if (d.payment) docs.push(d.payment.id);
        return (
          "<tr>" +
          '<td><strong>' + escapeHtml(l.id) + "</strong><div class=\"cell-sub\">" + dt(l.createdAt) + "</div></td>" +
          "<td><strong>" + escapeHtml(l.coopName) + "</strong><div class=\"cell-sub\">" +
            escapeHtml(l.state || "—") + (l.coopReg ? " · " + escapeHtml(l.coopReg) : "") + "</div></td>" +
          '<td class="num">' + Number(l.members || 0).toLocaleString("ms-MY") + "</td>" +
          '<td><span class="badge ' + (l.score >= 65 ? "danger" : l.score >= 35 ? "warning" : "success") + '">' + l.score + "</span></td>" +
          "<td>" + escapeHtml(l.pkgName || "—") + "</td>" +
          '<td class="num"><strong>' + RM(value) + "</strong>" +
            (d.quote ? '<div class="cell-sub">termasuk SST</div>' : '<div class="cell-sub">anggaran</div>') + "</td>" +
          '<td><span class="badge ' + (STAGE_CLASS[l.stage] || "") + '">' + escapeHtml(l.stage) + "</span></td>" +
          '<td style="font-size:12px;line-height:1.8">' + (docs.length ? docs.map(escapeHtml).join("<br>") : '<span style="color:var(--c-text-3)">—</span>') + "</td>" +
          "<td>" + invoiceBadge(d.invoice, d.payment) + "</td>" +
          '<td style="white-space:nowrap">' +
            '<a class="btn btn-primary btn-sm" href="checkout.html?ref=' + encodeURIComponent(l.id) + '">' +
              (d.invoice && d.invoice.status === "paid" ? "Lihat" : "Proses") + " →</a> " +
            (l.stage === "Assessment Diterima"
              ? '<button class="btn btn-ghost btn-sm" data-contact="' + escapeHtml(l.id) + '">Tanda Dihubungi</button>'
              : "") +
          "</td>" +
          "</tr>"
        );
      }).join("") +
      "</tbody></table>";
  }

  const EVENT_LABELS = {
    "assessment.submitted": "Penilaian dihantar",
    "quote.created": "Sebut harga diterbitkan",
    "quote.accepted": "Sebut harga diterima",
    "invoice.created": "Invois diterbitkan",
    "payment.succeeded": "Pembayaran berjaya",
    "payment.pending_verification": "Pemindahan menunggu pengesahan",
    "lead.stage_changed": "Peringkat dikemas kini",
  };

  function renderAudit() {
    $("audit-list").innerHTML = EVENTS.length
      ? EVENTS.slice(0, 60).map((e) =>
          '<div class="audit-item"><span class="t">' + new Date(e.ts).toLocaleString("ms-MY") + "</span>" +
          "<span><strong>" + (EVENT_LABELS[e.event] || escapeHtml(e.event)) + "</strong>" +
          '<span style="color:var(--c-text-3)"> · ' + escapeHtml(e.entityType) + " " + escapeHtml(e.entityId) +
          (e.detail && e.detail.amount ? " · " + RM(e.detail.amount) : "") + "</span></span></div>"
        ).join("")
      : '<p style="font-size:13px;color:var(--c-text-3)">Tiada aktiviti lagi.</p>';
  }

  /* ---------- CSV export ---------- */
  function exportCsv() {
    const head = ["Rujukan", "Tarikh", "Koperasi", "NoPendaftaran", "Negeri", "Ahli", "Skor",
      "Pakej", "Nilai", "Tahap", "SebutHarga", "Invois", "StatusInvois", "Resit", "PIC", "Telefon", "Emel"];
    const esc = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const lines = [head.map(esc).join(",")];
    for (const d of DEALS) {
      const l = d.lead;
      lines.push([
        l.id, l.createdAt, l.coopName, l.coopReg, l.state, l.members, l.score,
        l.pkgName, d.quote ? d.quote.total : l.pkgPrice, l.stage,
        d.quote ? d.quote.number : "", d.invoice ? d.invoice.number : "",
        d.invoice ? d.invoice.status : "", d.payment ? d.payment.id : "",
        l.contactName, l.contactPhone, l.contactEmail,
      ].map(esc).join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "agmx-leads-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("CSV dieksport (" + DEALS.length + " baris).");
  }

  /* ---------- backend chip / settings ---------- */
  function fillBackendDialog() {
    const cfgRaw = localStorage.getItem("agmx_backend_cfg");
    try {
      const cfg = cfgRaw ? JSON.parse(cfgRaw) : null;
      $("sb-url").value = (cfg && cfg.url) || "";
      $("sb-key").value = (cfg && cfg.anonKey) || "";
    } catch (e) { /* ignore */ }
  }

  async function loadAll() {
    try {
      DEALS = await API.listDeals();
      EVENTS = await API.audit();
      const m = await API.metrics();
      renderMetrics(m);
      renderDeals($("search").value);
      renderAudit();
    } catch (e) {
      showToast("Ralat memuatkan data: " + e.message);
    }
  }

  /* ---------- boot ---------- */
  async function boot() {
    if (!API) { showToast("api.js gagal dimuatkan."); return; }

    try {
      const st = await API.status();
      $("backend-label").textContent = st.label;
      $("backend-chip").classList.toggle("live", !!st.ok);
    } catch (e) { /* non-fatal */ }

    $("search").addEventListener("input", (e) => renderDeals(e.target.value));
    $("btn-refresh").addEventListener("click", loadAll);
    $("btn-export").addEventListener("click", exportCsv);

    /* mark as contacted */
    $("deals-wrap").addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-contact]");
      if (!btn) return;
      await API.updateLeadStage(btn.dataset.contact, "Dihubungi");
      showToast(btn.dataset.contact + " ditanda sebagai Dihubungi.");
      loadAll();
    });

    /* backend settings dialog */
    const dlg = $("backend-dialog");
    $("backend-chip").addEventListener("click", () => { fillBackendDialog(); dlg.showModal(); });
    $("sb-save").addEventListener("click", () => {
      const url = $("sb-url").value.trim();
      const key = $("sb-key").value.trim();
      if (url && key) {
        API.configure({ mode: "supabase", url, anonKey: key });
        showToast("Backend Supabase dikonfigurasi. Memuat semula…");
      } else {
        showToast("URL dan anon key diperlukan untuk mod Supabase.");
        return;
      }
      setTimeout(() => location.reload(), 700);
    });
    $("sb-clear").addEventListener("click", () => {
      API.configure(null);
      showToast("Kembali ke demo tempatan. Memuat semula…");
      setTimeout(() => location.reload(), 700);
    });

    await loadAll();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
