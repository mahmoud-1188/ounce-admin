import { useEffect, useState } from "react";
import { ArrowRight, Ban, CheckCircle2, Pencil } from "lucide-react";
import { addPayment, fetchLog, getStore, renewStore, setBranchOperatingModel, setStoreStatus, updateStore, voidPayment } from "../core/api.js";
import {
  BRANCH_MODELS,
  PAY_METHODS,
  PLANS,
  RENEW_PRESETS,
  addMonths,
  errorMessage,
  expiryText,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  monthlyPrice,
  payMethodLabel,
  planLabel,
} from "../core/constants.js";
import { actionLabel, describeLogEntry } from "../core/logText.js";
import StoreAccountsCard from "./StoreAccountsCard.jsx";
import { Card, ErrorBox, Field, Notice, Stat, StateBadge, btnDanger, btnGhost, btnPrimary, inputCls } from "../ui/common.jsx";

/** تاريخ ISO → قيمة حقل <input type="date"> (بالتوقيت المحلي). */
function toDateInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * تفاصيل متجر — نظير «③ تحقّق» في النموذج الأولي، لكن بحالته الحقيقية
 * من القاعدة، ومعها كل الأفعال: تجديد، تعديل، إيقاف/تفعيل، ونموذج تشغيل
 * كل فرع (نظير «② مفتاح فرع»).
 */
export default function StoreDetailPage({ storeId, onBack, onAuthLost }) {
  const [data, setData] = useState(null);
  const [log, setLog] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState(null);
  const [customMonths, setCustomMonths] = useState("");
  // التجديد مع دفعته: تُختار المدة، فيُقترح المبلغ = الشهري × الأشهر (قابلٌ للتعديل)
  const [renewMonths, setRenewMonths] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("transfer");
  const [payNote, setPayNote] = useState("");
  const [reason, setReason] = useState("");
  const [newDate, setNewDate] = useState("");

  const load = () => {
    setError("");
    Promise.all([getStore(storeId), fetchLog({ storeId, limit: 50 })])
      .then(([d, l]) => {
        setData(d);
        setLog(l.entries);
      })
      .catch((err) => {
        if (err?.status === 401) return onAuthLost();
        setError(errorMessage(err, "تعذّر تحميل المتجر"));
      });
  };
  useEffect(load, [storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** ينفّذ فعلًا على الخادم ثم يعيد تحميل المتجر وسجله. */
  async function act(fn, okMsg) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
      setNotice(okMsg);
      load();
      return true;
    } catch (err) {
      if (err?.status === 401) onAuthLost();
      else setError(errorMessage(err, "تعذّر تنفيذ العملية"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <BackLink onBack={onBack} />
        {error ? <ErrorBox>{error}</ErrorBox> : <p className="text-sm text-neutral-400">جارِ التحميل…</p>}
      </div>
    );
  }

  const { store, branches, storeUsers, payments = [] } = data;
  const monthly = store.pricing?.monthly || 0;
  const suggestFor = (m) => (monthly > 0 && m > 0 ? String(Math.round(monthly * m * 100) / 100) : "");
  const pickMonths = (m) => {
    setRenewMonths(m);
    setPayAmount(suggestFor(m));
  };
  const activeBranches = branches.filter((b) => !b.deletedAt);
  const suspended = store.status !== "active";

  const renew = async (months) => {
    if (months === 0 && !confirm("اجعل اشتراك هذا المتجر بلا انتهاء؟ (للعملاء الدائمين فقط)")) return;
    const amount = months > 0 ? Number(payAmount) || 0 : 0;
    const payment = amount > 0 ? { amount, method: payMethod, note: payNote.trim() } : undefined;
    const ok = await act(
      () => renewStore(store.id, months, payment),
      months ? `جُدِّد ${months} شهر${amount > 0 ? ` · سُجّلت دفعة ${fmtMoney(amount)}` : " · بلا دفعة"}` : "صار الاشتراك بلا انتهاء"
    );
    if (ok) { setRenewMonths(null); setPayAmount(""); setPayNote(""); }
  };

  // ⚠ الإنقاص وتحديد التاريخ يمرّان عبر PATCH expiresAt (يُسجَّل «تعديل
  // الاشتراك» بقبل/بعد في السجل) — لا عبر renew الذي يضيف فقط.
  const reduce = (months) => {
    const next = addMonths(store.expiresAt, -months);
    const past = new Date(next).getTime() < Date.now();
    const msg = past
      ? `إنقاص ${months} شهر يجعل تاريخ الانتهاء ${fmtDate(next)} — أي منتهيًا فورًا ويُقفل المركزي والفروع. متابعة؟`
      : `إنقاص ${months} شهر؟ ينتهي الاشتراك في ${fmtDate(next)}.`;
    if (!confirm(msg)) return;
    act(() => updateStore(store.id, { expiresAt: next }), `أُنقص ${months} شهر`);
  };

  const applyDate = async () => {
    if (!newDate) return;
    const iso = new Date(`${newDate}T23:59:59`).toISOString();
    if (new Date(iso).getTime() < Date.now() && !confirm("هذا التاريخ مضى — سيصبح الاشتراك منتهيًا فورًا ويُقفل المركزي والفروع. متابعة؟")) return;
    const ok = await act(() => updateStore(store.id, { expiresAt: iso }), `تاريخ الانتهاء صار ${newDate}`);
    if (ok) setNewDate("");
  };

  const startEdit = () => {
    setEdit({
      name: store.name,
      plan: store.plan,
      maxBranches: store.maxBranches,
      noExpiry: !store.expiresAt,
      expiresDate: toDateInput(store.expiresAt),
      priceBase: String(store.pricing?.base ?? 0),
      pricePerBranch: String(store.pricing?.perBranch ?? 0),
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!edit.noExpiry && !edit.expiresDate) return setError("اختر تاريخ الانتهاء أو فعّل «بلا انتهاء»");
    const ok = await act(
      () =>
        updateStore(store.id, {
          name: edit.name.trim(),
          plan: edit.plan,
          maxBranches: edit.plan === "branch_only" ? 1 : Number(edit.maxBranches),
          // نهاية اليوم المختار بالتوقيت المحلي — لا يُقطع اشتراك العميل منتصف يومه الأخير.
          expiresAt: edit.noExpiry ? null : new Date(`${edit.expiresDate}T23:59:59`).toISOString(),
          priceBase: Number(edit.priceBase) || 0,
          pricePerBranch: Number(edit.pricePerBranch) || 0,
        }),
      "حُفظت التعديلات"
    );
    if (ok) setEditing(false);
  };

  const toggleStatus = async () => {
    if (!suspended && !confirm(`إيقاف «${store.name}»؟ يُقفل المركزي وكل فروعه فورًا.`)) return;
    const ok = await act(
      () => setStoreStatus(store.id, suspended ? "active" : "suspended", reason.trim() || undefined),
      suspended ? "فُعِّل المتجر" : "أُوقف المتجر"
    );
    if (ok) setReason("");
  };

  return (
    <div className="space-y-4">
      <BackLink onBack={onBack} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold truncate">{store.name}</h1>
          <div className="text-xs text-neutral-500 font-mono" dir="ltr">{store.id.slice(0, 8).toUpperCase()}</div>
        </div>
        <StateBadge state={store.state} />
      </div>

      <ErrorBox>{error}</ErrorBox>
      <Notice>{notice}</Notice>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="الباقة" value={planLabel(store.plan)} />
        <Stat label="الفروع" value={`${store.branchCount}/${store.maxBranches}`} sub="العاملة / السقف" />
        <Stat label="ينتهي" value={fmtDate(store.expiresAt)} />
        <Stat
          label="المتبقي"
          value={expiryText(store.expiresAt)}
          tone={store.state === "expired" ? "bad" : store.state === "expiring" ? "warn" : "good"}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat
          label="السعر الشهري"
          value={fmtMoney(monthly)}
          sub={`${fmtMoney(store.pricing?.base)} + ${fmtMoney(store.pricing?.perBranch)} × ${store.pricing?.billableBranches || 1} فرع`}
        />
        <Stat label="المدفوع إجمالًا" value={fmtMoney(store.paidTotal)} sub={`${payments.filter((p) => !p.voidedAt).length} دفعة`} tone="good" />
        <Stat label="آخر دفعة" value={store.lastPaidAt ? fmtDate(store.lastPaidAt) : "—"} />
      </div>

      <Card title="مدة الاشتراك">
        <div className="space-y-4">
          <div>
            <div className="text-xs text-neutral-400 mb-2">
              تمديد — يُضاف من تاريخ الانتهاء الحالي إن لم يأتِ بعد، ومن اليوم إن كان منتهيًا. لا يرفع الإيقاف.
            </div>
            <div className="flex flex-wrap gap-2">
              {RENEW_PRESETS.map((m) => (
                <button key={m} type="button" disabled={busy}
                  className={renewMonths === m ? btnPrimary : btnGhost} onClick={() => pickMonths(m)}>
                  +{m} شهر
                </button>
              ))}
              <input
                type="number"
                min="1"
                value={customMonths}
                onChange={(e) => {
                  setCustomMonths(e.target.value);
                  const m = Math.floor(Number(e.target.value));
                  if (m >= 1) pickMonths(m); else setRenewMonths(null);
                }}
                placeholder="أشهر"
                className={`${inputCls} w-24`}
              />
            </div>
            {renewMonths > 0 && (
              <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-950 p-3 space-y-2">
                <div className="text-xs text-neutral-300">
                  تجديد {renewMonths} شهر
                  {monthly > 0 ? <> · المقترح {fmtMoney(monthly * renewMonths)} = {fmtMoney(monthly)} × {renewMonths}</> : <> · لا سعر مضبوط لهذا المتجر</>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Field label="المدفوع (ر.س)" hint="0 أو فارغ = تجديد بلا دفعة">
                    <input inputMode="decimal" dir="ltr" value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value.replace(/[^\d.]/g, ""))} className={inputCls} placeholder="0" />
                  </Field>
                  <Field label="طريقة الدفع">
                    <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={inputCls}>
                      {PAY_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  </Field>
                  <Field label="ملاحظة">
                    <input value={payNote} onChange={(e) => setPayNote(e.target.value)} className={inputCls} placeholder="رقم الحوالة…" />
                  </Field>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} className={btnPrimary} onClick={() => renew(renewMonths)}>
                    جدّد {renewMonths} شهر{Number(payAmount) > 0 ? ` وسجّل ${fmtMoney(payAmount)}` : ""}
                  </button>
                  <button type="button" disabled={busy} className={btnGhost} onClick={() => { setRenewMonths(null); setCustomMonths(""); }}>إلغاء</button>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="text-xs text-neutral-400 mb-2">إنقاص — يُطرح من تاريخ الانتهاء الحالي.</div>
            <div className="flex flex-wrap gap-2">
              {[1, 3, 6].map((m) => (
                <button key={m} type="button" disabled={busy || !store.expiresAt} className={btnGhost} onClick={() => reduce(m)}>
                  −{m} شهر
                </button>
              ))}
            </div>
            {!store.expiresAt && (
              <p className="text-[11px] text-neutral-500 mt-1">الاشتراك بلا انتهاء — حدّد له تاريخًا أولًا.</p>
            )}
          </div>

          <div>
            <div className="text-xs text-neutral-400 mb-2">
              أو حدّد تاريخ الانتهاء مباشرة (الحالي: {fmtDate(store.expiresAt)})
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className={`${inputCls} w-auto`}
              />
              <button type="button" disabled={busy || !newDate} className={btnPrimary} onClick={applyDate}>
                احفظ التاريخ
              </button>
              <button type="button" disabled={busy || !store.expiresAt} className={btnGhost} onClick={() => renew(0)}>
                بلا انتهاء
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="الاشتراك"
        actions={
          !editing && (
            <button type="button" className={`${btnGhost} flex items-center gap-1.5`} onClick={startEdit}>
              <Pencil size={14} /> تعديل
            </button>
          )
        }
      >
        {!editing ? (
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-neutral-500">الاسم</dt>
            <dd>{store.name}</dd>
            <dt className="text-neutral-500">الباقة</dt>
            <dd>{planLabel(store.plan)}</dd>
            <dt className="text-neutral-500">سقف الفروع</dt>
            <dd>{store.maxBranches}</dd>
            <dt className="text-neutral-500">الأساسي شهريًّا</dt>
            <dd>{fmtMoney(store.pricing?.base)}</dd>
            <dt className="text-neutral-500">لكل فرع شهريًّا</dt>
            <dd>{fmtMoney(store.pricing?.perBranch)}</dd>
            <dt className="text-neutral-500">ينتهي</dt>
            <dd>{fmtDate(store.expiresAt)}</dd>
            <dt className="text-neutral-500">أُنشئ</dt>
            <dd>{fmtDate(store.createdAt)}</dd>
          </dl>
        ) : (
          <div className="space-y-3">
            <Field label="اسم الشركة">
              <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={inputCls} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="الباقة">
                <select value={edit.plan} onChange={(e) => setEdit({ ...edit, plan: e.target.value })} className={inputCls}>
                  {PLANS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="سقف الفروع" hint={`العاملة الآن: ${store.branchCount} — لا يُخفَّض تحتها`}>
                <input
                  type="number"
                  min="1"
                  disabled={edit.plan === "branch_only"}
                  value={edit.plan === "branch_only" ? 1 : edit.maxBranches}
                  onChange={(e) => setEdit({ ...edit, maxBranches: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="الأساسي شهريًّا (ر.س)">
                <input inputMode="decimal" dir="ltr" value={edit.priceBase}
                  onChange={(e) => setEdit({ ...edit, priceBase: e.target.value.replace(/[^\d.]/g, "") })} className={inputCls} />
              </Field>
              <Field label="لكل فرع شهريًّا (ر.س)"
                hint={`الشهري بعد الحفظ: ${fmtMoney(monthlyPrice(edit.priceBase, edit.pricePerBranch, store.branchCount))} (${Math.max(1, store.branchCount)} فرع محتسب)`}>
                <input inputMode="decimal" dir="ltr" value={edit.pricePerBranch}
                  onChange={(e) => setEdit({ ...edit, pricePerBranch: e.target.value.replace(/[^\d.]/g, "") })} className={inputCls} />
              </Field>
            </div>
            <Field label="تاريخ الانتهاء">
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="date"
                  disabled={edit.noExpiry}
                  value={edit.expiresDate}
                  onChange={(e) => setEdit({ ...edit, expiresDate: e.target.value })}
                  className={`${inputCls} w-auto`}
                />
                <label className="flex items-center gap-1.5 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    checked={edit.noExpiry}
                    onChange={(e) => setEdit({ ...edit, noExpiry: e.target.checked })}
                  />
                  بلا انتهاء
                </label>
              </div>
            </Field>
            <div className="flex gap-2">
              <button type="button" disabled={busy} className={btnPrimary} onClick={saveEdit}>
                حفظ
              </button>
              <button type="button" disabled={busy} className={btnGhost} onClick={() => setEditing(false)}>
                إلغاء
              </button>
            </div>
          </div>
        )}
      </Card>

      <PaymentsCard storeId={store.id} payments={payments} monthly={monthly} busy={busy} act={act} />

      <Card title={suspended ? "المتجر موقوف" : "إيقاف المتجر"}>
        <p className="text-xs text-neutral-500 mb-3 leading-6">
          {suspended
            ? "المركزي وكل الفروع مقفلة الآن. التفعيل يعيدهم فورًا (إن لم يكن الاشتراك منتهيًا)."
            : "الإيقاف يُقفل تطبيق المركزي وكل فروع المتجر فورًا عند أول طلب — البيانات تبقى محفوظة كما هي."}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="السبب (اختياري — يُكتب في السجل)" className={inputCls} />
          <button
            type="button"
            disabled={busy}
            onClick={toggleStatus}
            className={`${suspended ? btnPrimary : btnDanger} flex items-center justify-center gap-1.5 shrink-0`}
          >
            {suspended ? <CheckCircle2 size={16} /> : <Ban size={16} />}
            {suspended ? "فعّل المتجر" : "أوقف المتجر"}
          </button>
        </div>
      </Card>

      <Card title={`الفروع (${activeBranches.length})`}>
        <p className="text-[11px] text-neutral-500 mb-3 leading-5">
          نموذج التشغيل يُحفظ الآن لكل فرع. تطبيقه على الشراء والتكويد داخل تطبيق الفرع مرحلةٌ لاحقة.
        </p>
        {branches.length === 0 && (
          <p className="text-sm text-neutral-500">لا فروع بعد — ينشئها المالك من تطبيق المركزي داخل السقف.</p>
        )}
        <div className="space-y-2">
          {branches.map((b) => (
            <div
              key={b.id}
              className={`rounded-lg border border-neutral-800 bg-neutral-950 p-3 ${b.deletedAt ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {b.name}
                    {b.isHq && <span className="text-[11px] text-amber-400 mr-2">رئيسي</span>}
                    {b.deletedAt && <span className="text-[11px] text-red-400 mr-2">محذوف</span>}
                  </div>
                  <div className="text-[11px] text-neutral-500 font-mono" dir="ltr">
                    {b.ref} · {b.userCount} موظف
                  </div>
                </div>
                <select
                  value={b.operatingModel}
                  disabled={busy || !!b.deletedAt}
                  onChange={(e) =>
                    act(() => setBranchOperatingModel(b.id, e.target.value), `نموذج «${b.name}» تغيّر`)
                  }
                  className={`${inputCls} w-auto max-w-[45%]`}
                >
                  {BRANCH_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="text-[11px] text-neutral-500 mt-1">
                {BRANCH_MODELS.find((m) => m.id === b.operatingModel)?.hint}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <StoreAccountsCard storeId={store.id} storeName={store.name} storeUsers={storeUsers} busy={busy} act={act} />

      <Card title="سجل هذا المتجر">
        {log.length === 0 && <p className="text-sm text-neutral-500">لا عمليات مسجّلة.</p>}
        <div className="space-y-2">
          {log.map((e) => (
            <div key={e.id} className="text-sm border-b border-neutral-800 pb-2 last:border-0">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{actionLabel(e.action)}</span>
                <span className="text-xs text-neutral-500 shrink-0">{fmtDateTime(e.createdAt)}</span>
              </div>
              <div className="text-xs text-neutral-400">{describeLogEntry(e)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function BackLink({ onBack }) {
  return (
    <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-100">
      <ArrowRight size={16} /> المتاجر
    </button>
  );
}

/**
 * مدفوعات الاشتراك — ما سُجّل مع كل تجديد أو منفردًا. لا حذف: الدفعة
 * الخاطئة تُلغى بسببٍ مكتوب وتبقى ظاهرةً مشطوبة.
 */
function PaymentsCard({ storeId, payments, monthly, busy, act }) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ amount: "", months: "", method: "transfer", note: "", paidAt: "" });
  const [voidId, setVoidId] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const active = payments.filter((p) => !p.voidedAt);
  const total = active.reduce((a, p) => a + p.amount, 0);

  const submit = async () => {
    const ok = await act(
      () => addPayment(storeId, {
        amount: Number(f.amount),
        months: f.months ? Number(f.months) : undefined,
        method: f.method,
        note: f.note.trim(),
        paidAt: f.paidAt ? new Date(`${f.paidAt}T12:00:00`).toISOString() : undefined,
      }),
      `سُجّلت دفعة ${fmtMoney(f.amount)}`
    );
    if (ok) { setAdding(false); setF({ amount: "", months: "", method: "transfer", note: "", paidAt: "" }); }
  };

  const doVoid = async (p) => {
    const ok = await act(() => voidPayment(p.id, voidReason.trim()), `أُلغيت دفعة ${fmtMoney(p.amount)}`);
    if (ok) { setVoidId(null); setVoidReason(""); }
  };

  return (
    <Card
      title={`المدفوعات · ${fmtMoney(total)}`}
      actions={!adding && (
        <button type="button" className={btnGhost} onClick={() => setAdding(true)}>+ دفعة</button>
      )}
    >
      {adding && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3 mb-3 space-y-2">
          <p className="text-[11px] text-neutral-500">دفعةٌ منفردة (سداد متأخر أو جزئي) — لا تغيّر تاريخ الانتهاء. للتمديد مع الدفع استعمل «مدة الاشتراك».</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Field label="المبلغ (ر.س)">
              <input inputMode="decimal" dir="ltr" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} className={inputCls} />
            </Field>
            <Field label="عن كم شهر (اختياري)" hint={monthly > 0 && f.months ? `= ${fmtMoney(monthly * Number(f.months))}` : undefined}>
              <input type="number" min="0" value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })} className={inputCls} />
            </Field>
            <Field label="الطريقة">
              <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} className={inputCls}>
                {PAY_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="تاريخ الدفع">
              <input type="date" value={f.paidAt} onChange={(e) => setF({ ...f, paidAt: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={inputCls} placeholder="ملاحظة (رقم الحوالة…)" />
          <div className="flex gap-2">
            <button type="button" disabled={busy || !(Number(f.amount) > 0)} className={btnPrimary} onClick={submit}>سجّل الدفعة</button>
            <button type="button" disabled={busy} className={btnGhost} onClick={() => setAdding(false)}>إلغاء</button>
          </div>
        </div>
      )}
      {payments.length === 0 ? (
        <p className="text-sm text-neutral-500">لا مدفوعات مسجّلة بعد.</p>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => (
            <div key={p.id} className={`text-sm border-b border-neutral-800 pb-2 last:border-0 ${p.voidedAt ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`font-semibold tabular-nums ${p.voidedAt ? "line-through text-neutral-500" : "text-emerald-300"}`}>{fmtMoney(p.amount)}</span>
                <span className="text-xs text-neutral-500 shrink-0">{fmtDate(p.paidAt)}</span>
              </div>
              <div className="text-xs text-neutral-400">
                {payMethodLabel(p.method)}{p.months ? ` · عن ${p.months} شهر` : ""}{p.note ? ` · ${p.note}` : ""}{p.adminName ? ` · ${p.adminName}` : ""}
              </div>
              {p.voidedAt ? (
                <div className="text-[11px] text-red-400">أُلغيت {fmtDate(p.voidedAt)}{p.voidedByName ? ` — ${p.voidedByName}` : ""} · {p.voidReason}</div>
              ) : voidId === p.id ? (
                <div className="flex gap-2 mt-1.5">
                  <input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} className={inputCls} placeholder="سبب الإلغاء (إلزامي)" />
                  <button type="button" disabled={busy || !voidReason.trim()} className={`${btnDanger} shrink-0`} onClick={() => doVoid(p)}>ألغِ</button>
                  <button type="button" className={`${btnGhost} shrink-0`} onClick={() => setVoidId(null)}>تراجع</button>
                </div>
              ) : (
                <button type="button" className="text-[11px] text-neutral-500 hover:text-red-400 mt-0.5" onClick={() => { setVoidId(p.id); setVoidReason(""); }}>إلغاء الدفعة</button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
