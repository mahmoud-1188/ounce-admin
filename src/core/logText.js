import { ACTIONS, branchModelLabel, fmtDate, fmtDateTime, fmtMoney, payMethodLabel, planLabel, stripIsolates } from "./constants.js";

/** وصفٌ عربي مختصر لتفاصيل سطرٍ من سجل المنصة. */
function describeLogEntry(e) {
  const d = e.details || {};
  switch (e.action) {
    case "store_created":
      return `${planLabel(d.plan)} · سقف ${d.maxBranches} · ${d.months ? `${d.months} شهر حتى ${fmtDate(d.expiresAt)}` : "بلا انتهاء"} · المالك ${d.ownerEmail || "—"}${d.priceBase || d.pricePerBranch ? ` · السعر ${fmtMoney(d.priceBase)} + ${fmtMoney(d.pricePerBranch)}/فرع` : ""}`;
    case "store_renewed":
      return (d.months ? `+${d.months} شهر · ${fmtDate(d.before)} ← ${fmtDate(d.after)}` : "صار بلا انتهاء") + (d.amount ? ` · دُفع ${fmtMoney(d.amount)}` : "");
    case "store_updated": {
      const b = d.before || {};
      const a = d.after || {};
      const parts = [];
      if (b.name !== a.name) parts.push(`الاسم: ${b.name} ← ${a.name}`);
      if (b.plan !== a.plan) parts.push(`الباقة: ${planLabel(b.plan)} ← ${planLabel(a.plan)}`);
      if (b.maxBranches !== a.maxBranches) parts.push(`السقف: ${b.maxBranches} ← ${a.maxBranches}`);
      if (fmtDate(b.expiresAt) !== fmtDate(a.expiresAt)) parts.push(`الانتهاء: ${fmtDate(b.expiresAt)} ← ${fmtDate(a.expiresAt)}`);
      if (b.priceBase !== undefined && b.priceBase !== a.priceBase) parts.push(`الأساسي: ${fmtMoney(b.priceBase)} ← ${fmtMoney(a.priceBase)}`);
      if (b.pricePerBranch !== undefined && b.pricePerBranch !== a.pricePerBranch) parts.push(`سعر الفرع: ${fmtMoney(b.pricePerBranch)} ← ${fmtMoney(a.pricePerBranch)}`);
      return parts.join(" · ") || "بلا تغيير";
    }
    case "store_suspended":
    case "store_activated":
      return d.reason ? `السبب: ${d.reason}` : "";
    case "branch_model_changed":
      return `${d.branchName || e.branchName || ""}: ${branchModelLabel(d.before)} ← ${branchModelLabel(d.after)}`;
    case "store_user_created":
      return `${d.name || ""} · ${d.email || ""}`;
    case "store_user_updated": {
      const b = d.before || {};
      const a = d.after || {};
      const parts = [];
      if (b.name !== a.name) parts.push(`الاسم: ${b.name} ← ${a.name}`);
      if (b.email !== a.email) parts.push(`البريد: ${b.email} ← ${a.email}`);
      return parts.join(" · ") || "بلا تغيير";
    }
    case "store_user_password_reset":
      return d.email || "";
    case "admin_updated": {
      const b = d.before || {};
      const a = d.after || {};
      const parts = [];
      if (b.name !== a.name) parts.push(`الاسم: ${b.name} ← ${a.name}`);
      if (b.email !== a.email) parts.push(`البريد: ${b.email} ← ${a.email}`);
      if (d.passwordChanged) parts.push("تغيير كلمة المرور");
      return parts.join(" · ") || "بلا تغيير";
    }
    case "payment_recorded":
      return `${fmtMoney(d.amount)} · ${payMethodLabel(d.method)}${d.months ? ` · عن ${d.months} شهر` : ""}${d.note ? ` · ${d.note}` : ""}`;
    case "payment_voided":
      return `${fmtMoney(d.amount)} · السبب: ${d.reason || "—"}`;
    case "admin_setup":
      return d.email || "";
    default:
      return "";
  }
}

const actionLabel = (a) => ACTIONS[a] || a;

/** CSV بـBOM (يفتح في Excel بالعربية سليمًا). */
function logToCsv(entries) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["التاريخ", "العملية", "المتجر", "التفصيل", "بواسطة"];
  const rows = entries.map((e) => [
    fmtDateTime(e.createdAt),
    actionLabel(e.action),
    e.storeName || "",
    describeLogEntry(e),
    e.adminName || "",
  ].map(stripIsolates));
  return "﻿" + [head, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

function downloadText(filename, text, type = "text/csv;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export { describeLogEntry, actionLabel, logToCsv, downloadText };
