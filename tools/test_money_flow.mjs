#!/usr/bin/env node
/* ============================================================
   AGMX — Money-flow tests (Sprint 2)
   Exercises the AGMX_API local adapter end-to-end:
   assessment → quote → acceptance → invoice → payment → metrics.

   Usage:  node tools/test_money_flow.mjs     (from repo root)
   No dependencies — api.js runs in Node with an in-memory store.
   ============================================================ */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const AGMX_API = require(path.join(here, "..", "api.js"));

let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log("  ✓ " + label); }
  else { failed++; console.error("  ✗ " + label); }
}
function eq(a, b, label) {
  const good = JSON.stringify(a) === JSON.stringify(b);
  if (!good) console.error("      expected:", JSON.stringify(b), "\n      actual:  ", JSON.stringify(a));
  ok(good, label);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("\nAGMX Money Flow — LocalAdapter\n===============================\n");

/* ---------- 1. status ---------- */
{
  const st = await AGMX_API.status();
  ok(st.mode === "local" && st.ok === true, "status() → local demo mode");
}

/* ---------- 2. assessment submission ---------- */
let lead;
{
  lead = await AGMX_API.submitAssessment({
    coopName: "Koperasi Ujian Berhad", coopReg: "KPM-999/2026", state: "Selangor",
    members: 1284, agmDate: "2026-11-14", mode: "hybrid",
    attendance: 403, candidates: 8, motions: 12, process: "mixed", managed: true,
    score: 61, pkgKey: "professional", pkgName: "AGMX Professional AGM", pkgPrice: 3500,
    contactName: "Pn. Aishah Rahman", contactPhone: "012-3456789", contactEmail: "aishah@ujian.my",
  });
  ok(/^LD-\d{4}$/.test(lead.id), "lead reference format LD-xxxx → " + lead.id);
  eq(lead.stage, "Assessment Diterima", "initial stage = Assessment Diterima");
  const listed = await AGMX_API.listAssessments();
  ok(listed.some((l) => l.id === lead.id), "assessment appears in listAssessments()");
}

/* ---------- 3. quote creation + SST math ---------- */
let quote;
{
  quote = await AGMX_API.createQuote({
    leadRef: lead.id,
    items: [
      { description: "AGMX Professional AGM — perkhidmatan AGM sekali gus", qty: 1, unitPrice: 3500 },
      { description: "Fasilitator AGM Tambahan", qty: 1, unitPrice: 800 },
    ],
  });
  ok(/^QT-\d{4}-\d{3}$/.test(quote.number), "quote number format QT-YYYY-NNN → " + quote.number);
  eq(quote.subtotal, 4300, "subtotal = 4300.00");
  eq(quote.tax, 344, "SST 8% = 344.00");
  eq(quote.total, 4644, "total = 4644.00");
  eq(quote.status, "sent", "new quote status = sent");
  const leadNow = await AGMX_API.getAssessment(lead.id);
  eq(leadNow.stage, "Sebut Harga Dihantar", "lead stage advanced to Sebut Harga Dihantar");
  eq(leadNow.quoteId, quote.number, "lead carries quoteId");

  try {
    await AGMX_API.createQuote({ leadRef: "LD-0000", items: [{ description: "x", qty: 1, unitPrice: 1 }] });
    ok(false, "createQuote on missing lead throws");
  } catch (e) { ok(true, "createQuote on missing lead throws"); }
}

/* ---------- 4. quote acceptance ---------- */
{
  quote = await AGMX_API.acceptQuote(quote.number);
  eq(quote.status, "accepted", "quote status = accepted");
  const again = await AGMX_API.acceptQuote(quote.number);
  eq(again.status, "accepted", "acceptQuote is idempotent");
  const leadNow = await AGMX_API.getAssessment(lead.id);
  eq(leadNow.stage, "Sebut Harga Diterima", "lead stage = Sebut Harga Diterima");
}

/* ---------- 5. invoice ---------- */
let invoice;
{
  invoice = await AGMX_API.createInvoice(quote.number);
  ok(/^INV-\d{4}-\d{3}$/.test(invoice.number), "invoice number format INV-YYYY-NNN → " + invoice.number);
  eq(invoice.amount, quote.total, "invoice amount = quote total");
  eq(invoice.status, "unpaid", "invoice starts unpaid");
  const due = new Date(invoice.dueAt), issued = new Date(invoice.issuedAt);
  const days = Math.round((due - issued) / 864e5);
  eq(days, 14, "payment terms = NET 14 days");
}

/* ---------- 6. payment (fpx, instant success) ---------- */
let payment;
{
  payment = await AGMX_API.payInvoice(invoice.number, { method: "fpx" });
  eq(payment.status, "succeeded", "fpx payment succeeds instantly");
  ok(/^FPX/.test(payment.reference), "gateway reference generated → " + payment.reference);
  const inv = await AGMX_API.getInvoice(invoice.number);
  eq(inv.status, "paid", "invoice marked paid");
  const leadNow = await AGMX_API.getAssessment(lead.id);
  eq(leadNow.stage, "Dibayar", "lead stage = Dibayar");

  try {
    await AGMX_API.payInvoice(invoice.number, { method: "card" });
    ok(false, "double payment throws");
  } catch (e) { ok(true, "double payment throws"); }
}

/* ---------- 7. bank transfer (pending verification) ---------- */
{
  const lead2 = await AGMX_API.submitAssessment({
    coopName: "Koperasi Kedua Berhad", state: "Johor", members: 250,
    mode: "physical", attendance: 80, process: "manual", managed: false,
    score: 20, pkgKey: "essential", pkgName: "AGMX Essential AGM", pkgPrice: 1500,
    contactName: "En. Tan", contactPhone: "019-8887777",
  });
  const q2 = await AGMX_API.createQuote({ leadRef: lead2.id, items: [{ description: "Essential", qty: 1, unitPrice: 1500 }] });
  await AGMX_API.acceptQuote(q2.number);
  const inv2 = await AGMX_API.createInvoice(q2.number);
  const pay2 = await AGMX_API.payInvoice(inv2.number, { method: "bank_transfer" });
  eq(pay2.status, "pending", "bank transfer → pending verification");
  const inv2now = await AGMX_API.getInvoice(inv2.number);
  eq(inv2now.status, "unpaid", "invoice stays unpaid until verified");
  const lead2now = await AGMX_API.getAssessment(lead2.id);
  eq(lead2now.stage, "Sebut Harga Diterima", "lead not marked Dibayar for manual transfer");
}

/* ---------- 8. metrics + deals join ---------- */
{
  const m = await AGMX_API.metrics();
  eq(m.leads, 2, "metrics: 2 leads");
  eq(m.quoted, 2, "metrics: 2 quoted");
  eq(m.paid, 1, "metrics: 1 paid");
  eq(m.collectedValue, 4644, "metrics: collected = 4644.00");
  eq(m.closeRate, 50, "metrics: close rate 50%");
  const deals = await AGMX_API.listDeals();
  eq(deals.length, 2, "listDeals: one row per lead");
  const d1 = deals.find((d) => d.lead.id === lead.id);
  ok(d1 && d1.payment && d1.payment.status === "succeeded", "deal join: payment attached");
}

/* ---------- 9. audit trail ---------- */
{
  const events = await AGMX_API.audit(lead.id);
  const seq = events.map((e) => e.event).reverse();
  eq(seq, [
    "assessment.submitted", "quote.created", "quote.accepted",
    "invoice.created", "payment.succeeded",
  ], "audit trail records the full sequence for the lead");
  const all = await AGMX_API.audit();
  ok(all.length >= 7, "global audit log collects all events (" + all.length + ")");
}

/* ---------- 10. stage updates ---------- */
{
  const lead3 = await AGMX_API.submitAssessment({
    coopName: "Koperasi Ketiga", state: "Perak", members: 900, mode: "online",
    attendance: 300, process: "digital", managed: true, score: 45,
    pkgKey: "professional", pkgName: "AGMX Professional AGM", pkgPrice: 3500,
    contactName: "En. Lim", contactPhone: "013-2223333",
  });
  await AGMX_API.updateLeadStage(lead3.id, "Dihubungi");
  const l = await AGMX_API.getAssessment(lead3.id);
  eq(l.stage, "Dihubungi", "updateLeadStage persists");
}

/* ---------- 11. persistence across instances ---------- */
{
  const AGMX_API2 = require(path.join(here, "..", "api.js"));
  const leads = await AGMX_API2.listAssessments();
  eq(leads.length, 3, "second API instance reads the same store (3 leads)");
  const m = await AGMX_API2.metrics();
  eq(m.collectedValue, 4644, "second instance sees collected revenue");
}

/* ---------- result ---------- */
console.log("\n------------------------------");
console.log("Passed: " + passed + " · Failed: " + failed);
if (failed > 0) { console.error("MONEY FLOW TESTS FAILED\n"); process.exit(1); }
console.log("All money-flow tests passed ✓\n");
