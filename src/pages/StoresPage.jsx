import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";
import { listStores } from "../core/api.js";
import { STATES, errorMessage, expiryText, fmtDate, fmtMoney, planLabel } from "../core/constants.js";
import { ErrorBox, Stat, StateBadge, btnGhost, btnPrimary, inputCls } from "../ui/common.jsx";

const FILTERS = [
  ["all", "الكل"],
  ["active", STATES.active.label],
  ["expiring", STATES.expiring.label],
  ["expired", STATES.expired.label],
  ["suspended", STATES.suspended.label],
];

/** قائمة المتاجر المشتركة — نظير «سجل ما أصدرتَه» لكن من القاعدة لا المتصفح. */
export default function StoresPage({ onOpenStore, onNewStore, onAuthLost }) {
  const [stores, setStores] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const load = () => {
    setError("");
    listStores()
      .then((r) => setStores(r.stores))
      .catch((err) => {
        if (err?.status === 401) return onAuthLost();
        setError(errorMessage(err, "تعذّر تحميل المتاجر"));
      });
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c = { all: 0, active: 0, expiring: 0, expired: 0, suspended: 0 };
    for (const s of stores || []) {
      c.all += 1;
      c[s.state] = (c[s.state] || 0) + 1;
    }
    return c;
  }, [stores]);

  // الإيراد الشهري المتوقع: المتاجر السارية فقط (فعّال أو قارب الانتهاء)
  const revenue = useMemo(() => {
    const live = (stores || []).filter((s) => s.state === "active" || s.state === "expiring");
    return {
      monthly: live.reduce((a, s) => a + (s.pricing?.monthly || 0), 0),
      paid: (stores || []).reduce((a, s) => a + (s.paidTotal || 0), 0),
      priced: live.filter((s) => (s.pricing?.monthly || 0) > 0).length,
      live: live.length,
    };
  }, [stores]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (stores || [])
      .filter((s) => filter === "all" || s.state === filter)
      .filter((s) => !term || `${s.name} ${s.owner?.email || ""} ${s.owner?.name || ""}`.toLowerCase().includes(term));
  }, [stores, q, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg font-semibold">المتاجر المشتركة</h1>
        <div className="flex gap-2">
          <button type="button" onClick={load} className={btnGhost} aria-label="تحديث">
            <RefreshCw size={16} />
          </button>
          <button type="button" onClick={onNewStore} className={`${btnPrimary} flex items-center gap-1.5`}>
            <Plus size={16} /> متجر جديد
          </button>
        </div>
      </div>

      <ErrorBox>{error}</ErrorBox>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="فعّال" value={counts.active} tone="good" />
        <Stat label="قارب الانتهاء" value={counts.expiring} tone="warn" sub="خلال 14 يومًا" />
        <Stat label="منتهٍ" value={counts.expired} tone="bad" />
        <Stat label="موقوف" value={counts.suspended} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="الإيراد الشهري المتوقع" value={fmtMoney(revenue.monthly)} sub={`${revenue.priced} من ${revenue.live} متجرًا ساريًا لها سعر`} tone="good" />
        <Stat label="إجمالي المُحصَّل" value={fmtMoney(revenue.paid)} sub="كل المدفوعات غير الملغاة" />
      </div>

      <div className="relative">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-neutral-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم الشركة أو بريد المالك" className={`${inputCls} pr-9`} />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs border transition-colors ${
              filter === id ? "bg-amber-500/15 text-amber-300 border-amber-700" : "bg-neutral-900 text-neutral-400 border-neutral-800"
            }`}
          >
            {label} ({counts[id] || 0})
          </button>
        ))}
      </div>

      {!stores && !error && <p className="text-sm text-neutral-400">جارِ التحميل…</p>}

      {stores && visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
          {stores.length === 0 ? "لا متاجر بعد — أنشئ أول مشترك من «متجر جديد»." : "لا نتائج مطابقة."}
        </div>
      )}

      <div className="space-y-2">
        {visible.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onOpenStore(s.id)}
            className="w-full text-right rounded-xl border border-neutral-800 bg-neutral-900 hover:border-neutral-700 p-4 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">{s.name}</div>
                <div className="text-xs text-neutral-500 truncate" dir="ltr">{s.owner?.email || "بلا مالك"}</div>
              </div>
              <StateBadge state={s.state} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
              <span>{planLabel(s.plan)}</span>
              <span>الفروع {s.branchCount}/{s.maxBranches}</span>
              <span className="text-amber-300">{s.pricing?.monthly ? `${fmtMoney(s.pricing.monthly)} / شهر` : "بلا سعر"}</span>
              <span>{fmtDate(s.expiresAt)}</span>
              <span className={s.state === "expired" ? "text-red-400" : s.state === "expiring" ? "text-amber-400" : ""}>
                {expiryText(s.expiresAt)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
