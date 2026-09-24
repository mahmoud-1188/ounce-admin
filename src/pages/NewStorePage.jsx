import { useState } from "react";
import { ArrowRight, Copy, KeyRound } from "lucide-react";
import { createStore } from "../core/api.js";
import { CENTRAL_URL, PAY_METHODS, PLANS, errorMessage, fmtDate, fmtMoney, generatePassword, monthlyPrice } from "../core/constants.js";
import { Card, ErrorBox, Field, btnGhost, btnPrimary, inputCls } from "../ui/common.jsx";

/**
 * نظير «① ترخيص شركة» في النموذج الأولي: نفس الحقول (الاسم · الباقة ·
 * سقف الفروع · مدة الاشتراك بالأشهر، 0 = بلا انتهاء)، لكن الناتج متجرٌ
 * حقيقي وحساب مالكٍ يدخل به المركزي فورًا — لا رمزٌ يُلصق.
 */
export default function NewStorePage({ onBack, onCreated }) {
  const [form, setForm] = useState({
    name: "",
    plan: "central",
    maxBranches: 3,
    months: 12,
    ownerName: "",
    ownerEmail: "",
    ownerPassword: generatePassword(),
    priceBase: "",
    pricePerBranch: "",
    payAmount: "",
    payMethod: "transfer",
    payNote: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const branchOnly = form.plan === "branch_only";
  // ⚠ لا فروع عند الإنشاء — يُحتسب فرعٌ واحد، ويزيد الشهري تلقائيًّا مع كل فرعٍ يُنشئه المالك
  const monthly1 = monthlyPrice(form.priceBase, form.pricePerBranch, 1);
  const monthlyCap = monthlyPrice(form.priceBase, form.pricePerBranch, branchOnly ? 1 : Number(form.maxBranches) || 1);
  const suggested = Math.round(monthly1 * (Number(form.months) || 0) * 100) / 100;
  const num = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value.replace(/[^\d.]/g, "") }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { store } = await createStore({
        name: form.name.trim(),
        plan: form.plan,
        maxBranches: branchOnly ? 1 : Number(form.maxBranches),
        months: Number(form.months),
        ownerName: form.ownerName.trim(),
        ownerEmail: form.ownerEmail.trim(),
        ownerPassword: form.ownerPassword,
        priceBase: Number(form.priceBase) || 0,
        pricePerBranch: Number(form.pricePerBranch) || 0,
        payment: Number(form.payAmount) > 0
          ? { amount: Number(form.payAmount), method: form.payMethod, note: form.payNote.trim() }
          : undefined,
      });
      setCreated({ store, email: form.ownerEmail.trim(), password: form.ownerPassword });
    } catch (err) {
      setError(errorMessage(err, "تعذّر إنشاء المتجر"));
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    const msg = [
      `أهلًا بك في أوقية — ${created.store.name}`,
      CENTRAL_URL ? `رابط الإدارة المركزية: ${CENTRAL_URL}` : null,
      `البريد: ${created.email}`,
      `كلمة المرور: ${created.password}`,
      `الاشتراك: ${created.store.expiresAt ? `حتى ${fmtDate(created.store.expiresAt)}` : "بلا انتهاء"} · حتى ${created.store.maxBranches} فرع`,
      "ادخل من الرابط وأنشئ فروعك من شاشة الفروع، ثم افتح رابط كل فرع على جهازه.",
    ]
      .filter(Boolean)
      .join("\n");
    return (
      <div className="space-y-4">
        <Card title="✓ أُنشئ المتجر">
          <p className="text-sm text-neutral-300 mb-3">
            أرسل هذه البيانات للعميل. <b className="text-amber-300">كلمة المرور لا تظهر مرة أخرى</b> — انسخها الآن.
          </p>
          <pre className="whitespace-pre-wrap text-sm bg-neutral-950 border border-amber-700/60 rounded-lg p-3 leading-7 font-sans">
            {msg}
          </pre>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              className={`${btnPrimary} flex items-center gap-1.5`}
              onClick={() => {
                navigator.clipboard?.writeText(msg);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <Copy size={16} /> {copied ? "✓ نُسخ" : "انسخ الرسالة"}
            </button>
            <button type="button" className={btnGhost} onClick={() => onCreated(created.store.id)}>
              افتح المتجر
            </button>
          </div>
          {!CENTRAL_URL && (
            <p className="text-[11px] text-neutral-500 mt-3">
              اضبط VITE_CENTRAL_APP_URL في بيئة هذا التطبيق ليُضاف رابط المركزي للرسالة تلقائيًّا.
            </p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-100">
        <ArrowRight size={16} /> المتاجر
      </button>
      <h1 className="text-lg font-semibold">متجر جديد</h1>

      <Card title="الشركة والاشتراك">
        <div className="space-y-3">
          <Field label="اسم الشركة">
            <input value={form.name} onChange={set("name")} className={inputCls} placeholder="مجوهرات الأصالة" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="الباقة" hint={PLANS.find((p) => p.id === form.plan)?.hint}>
              <select value={form.plan} onChange={set("plan")} className={inputCls}>
                {PLANS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field label="سقف الفروع">
              <input
                type="number"
                min="1"
                value={branchOnly ? 1 : form.maxBranches}
                disabled={branchOnly}
                onChange={set("maxBranches")}
                className={inputCls}
              />
            </Field>
            <Field label="مدة الاشتراك (شهر)" hint="0 = بلا انتهاء (للعملاء الدائمين فقط)">
              <input type="number" min="0" value={form.months} onChange={set("months")} className={inputCls} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="سعر الاشتراك">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="الأساسي شهريًّا (ر.س)" hint="رسم المتجر ثابتًا كل شهر">
              <input inputMode="decimal" value={form.priceBase} onChange={num("priceBase")} className={inputCls} placeholder="0" dir="ltr" />
            </Field>
            <Field label="لكل فرع شهريًّا (ر.س)" hint="يُضرب في الفروع العاملة — فرعٌ واحد على الأقل">
              <input inputMode="decimal" value={form.pricePerBranch} onChange={num("pricePerBranch")} className={inputCls} placeholder="0" dir="ltr" />
            </Field>
          </div>
          <p className="text-xs text-neutral-400 leading-6">
            الشهري الآن (فرع واحد): <b className="text-amber-300">{fmtMoney(monthly1)}</b>
            {!branchOnly && Number(form.maxBranches) > 1 && <> · عند بلوغ السقف ({form.maxBranches} فروع): {fmtMoney(monthlyCap)}</>}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="المدفوع الآن (ر.س)" hint={suggested > 0 ? `المقترح ${fmtMoney(suggested)} = الشهري × ${form.months} شهر` : "اتركه فارغًا إن لم يُدفع بعد"}>
              <div className="flex gap-2">
                <input inputMode="decimal" value={form.payAmount} onChange={num("payAmount")} className={inputCls} placeholder="0" dir="ltr" />
                {suggested > 0 && (
                  <button type="button" className={btnGhost} onClick={() => setForm((f) => ({ ...f, payAmount: String(suggested) }))}>المقترح</button>
                )}
              </div>
            </Field>
            <Field label="طريقة الدفع">
              <select value={form.payMethod} onChange={set("payMethod")} className={inputCls}>
                {PAY_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="ملاحظة الدفعة">
              <input value={form.payNote} onChange={set("payNote")} className={inputCls} placeholder="رقم الحوالة…" />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="حساب المالك — يدخل به تطبيق المركزي">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="اسم المالك">
            <input value={form.ownerName} onChange={set("ownerName")} className={inputCls} />
          </Field>
          <Field label="البريد">
            <input type="email" value={form.ownerEmail} onChange={set("ownerEmail")} className={inputCls} dir="ltr" />
          </Field>
          <Field label="كلمة المرور" hint="مولّدة تلقائيًّا — 8 أحرف على الأقل">
            <div className="flex gap-2">
              <input value={form.ownerPassword} onChange={set("ownerPassword")} className={`${inputCls} font-mono`} dir="ltr" />
              <button
                type="button"
                className={btnGhost}
                aria-label="ولّد كلمة مرور"
                onClick={() => setForm((f) => ({ ...f, ownerPassword: generatePassword() }))}
              >
                <KeyRound size={16} />
              </button>
            </div>
          </Field>
        </div>
      </Card>

      <ErrorBox>{error}</ErrorBox>

      <button type="submit" disabled={busy} className={`${btnPrimary} w-full sm:w-auto`}>
        {busy ? "جارِ الإنشاء…" : "أنشئ المتجر"}
      </button>
    </form>
  );
}
