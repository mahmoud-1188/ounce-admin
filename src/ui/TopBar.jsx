import { LogOut, ScrollText, Store } from "lucide-react";

const TABS = [
  { id: "stores", label: "المتاجر", icon: Store },
  { id: "log", label: "السجل", icon: ScrollText },
];

/**
 * نفس بنية شريط ounce-central بعد إصلاح الهاتف: سطران على الشاشات الصغيرة
 * (الشعار + الخروج، ثم التبويبات بعرض كامل) وسطر واحد من sm فأكبر.
 */
export default function TopBar({ admin, tab, onTabChange, onLogout }) {
  return (
    <header className="border-b border-neutral-800 bg-neutral-900">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 shrink-0 min-w-0">
          <img src="/brand/logo-mark-transparent.png" alt="أوقية" className="h-8 w-8 shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">أوقية — أدمن المنصة</div>
            {admin?.name && <div className="text-xs text-neutral-400 truncate">{admin.name}</div>}
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-100 transition-colors shrink-0 order-2 sm:order-3"
        >
          <LogOut size={16} />
          خروج
        </button>

        <nav className="flex items-center gap-1 bg-neutral-800/60 rounded-lg p-1 overflow-x-auto min-w-0 w-full sm:w-auto order-3 sm:order-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm shrink-0 transition-colors ${
                  active ? "bg-neutral-100 text-neutral-900" : "text-neutral-300 hover:text-neutral-100"
                }`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
