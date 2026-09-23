import { useEffect, useState } from "react";
import { ArrowRight, Ban, CheckCircle2, Pencil } from "lucide-react";
import { fetchLog, getStore, renewStore, setBranchOperatingModel, setStoreStatus, updateStore } from "../core/api.js";
import {
  BRANCH_MODELS,
  PLANS,
  RENEW_PRESETS,
  errorMessage,
  expiryText,
  fmtDate,
  fmtDateTime,
  planLabel,
} from "../core/constants.js";
import { actionLabel, describeLogEntry } from "../core/logText.js";
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
  const [reason, setReason] = useState("");

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

  const { store, branches, storeUsers } = data;
  const activeBranches = branches.filter((b) => !b.deletedAt);
  const suspended = store.status !== "active";

  const renew = (months) => {
    if (months === 0 && !confirm("اجعل اشتراك هذا المتجر بلا انتهاء؟ (للعملاء الدائمين فقط)")) return;
    act(() => renewStore(store.id, months), months ? `جُدِّد ${months} شهر` : "صار الاشتراك بلا انتهاء");
  };

  const startEdit = () => {
    setEdit({
      name: store.name,
      plan: store.plan,
      maxBranches: store.maxBranches,
      noExpiry: !store.expiresAt,
      expiresDate: toDateInput(store.expiresAt),
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

      <Card title="تجديد الاشتراك">
        <p className="text-xs text-neutral-500 mb-3 leading-6">
          يُضاف من تاريخ الانتهاء الحالي إن لم يأتِ بعد (لا يخسر العميل ما بقي له)، ومن اليوم إن كان منتهيًا.
          التجديد لا يرفع الإيقاف.
        </p>
        <div className="flex flex-wrap gap-2">
          {RENEW_PRESETS.map((m) => (
            <button key={m} type="button" disabled={busy} className={btnGhost} onClick={() => renew(m)}>
              +{m} شهر
            </button>
          ))}
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              value={customMonths}
              onChange={(e) => setCustomMonths(e.target.value)}
              placeholder="أشهر"
              className={`${inputCls} w-24`}
            />
            <button
              type="button"
              disabled={busy || !(Number(customMonths) >= 1)}
              className={btnPrimary}
              onClick={() => {
                renew(Math.floor(Number(customMonths)));
                setCustomMonths("");
              }}
            >
              جدّد
            </button>
          </div>
          <button type="button" disabled={busy || !store.expiresAt} className={btnGhost} onClick={() => renew(0)}>
            بلا انتهاء
          </button>
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

      <Card title="حسابات المركزي">
        <div className="space-y-1.5">
          {storeUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">
                {u.name} <span className="text-xs text-neutral-500">{u.role === "owner" ? "· مالك" : "· موظف"}</span>
                {!u.active && <span className="text-xs text-red-400"> · معطّل</span>}
              </span>
              <span className="text-xs text-neutral-500 truncate" dir="ltr">{u.email}</span>
            </div>
          ))}
        </div>
      </Card>

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
