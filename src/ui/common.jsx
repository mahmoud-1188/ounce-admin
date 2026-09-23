import { STATES } from "../core/constants.js";

const inputCls =
  "w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60";

const btnPrimary =
  "rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-neutral-950 font-medium px-4 py-2 text-sm transition-colors";

const btnGhost =
  "rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 disabled:opacity-60 disabled:cursor-not-allowed text-neutral-200 px-3 py-2 text-sm transition-colors";

const btnDanger =
  "rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800 disabled:opacity-60 text-red-300 px-3 py-2 text-sm transition-colors";

function Card({ title, children, className = "", actions }) {
  return (
    <section className={`rounded-xl border border-neutral-800 bg-neutral-900 p-4 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          {title && <h2 className="text-sm font-semibold text-amber-400">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-neutral-400">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-neutral-500 leading-5">{hint}</span>}
    </label>
  );
}

function StateBadge({ state }) {
  const s = STATES[state] || STATES.active;
  return (
    <span className={`inline-block shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{children}</div>
  );
}

function Notice({ children }) {
  if (!children) return null;
  return (
    <div className="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-900 rounded-lg px-3 py-2">
      {children}
    </div>
  );
}

function Stat({ label, value, sub, tone }) {
  const color =
    tone === "good" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : tone === "bad" ? "text-red-400" : "text-neutral-100";
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 space-y-0.5">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-neutral-500">{sub}</div>}
    </div>
  );
}

export { inputCls, btnPrimary, btnGhost, btnDanger, Card, Field, StateBadge, ErrorBox, Notice, Stat };
