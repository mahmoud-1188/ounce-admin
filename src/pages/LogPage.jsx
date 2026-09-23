import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { fetchLog } from "../core/api.js";
import { errorMessage, fmtDateTime } from "../core/constants.js";
import { actionLabel, describeLogEntry, downloadText, logToCsv } from "../core/logText.js";
import { ErrorBox, btnGhost } from "../ui/common.jsx";

/**
 * سجل عمليات المنصة كلّه — نظير «سجل ما أصدرتَه» في النموذج الأولي، لكنه
 * في القاعدة: لا يضيع بمسح المتصفح، ويُصدَّر CSV متى شئت.
 */
export default function LogPage({ onOpenStore, onAuthLost }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchLog({ limit: 2000 })
      .then((r) => setEntries(r.entries))
      .catch((err) => {
        if (err?.status === 401) return onAuthLost();
        setError(errorMessage(err, "تعذّر تحميل السجل"));
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">سجل العمليات</h1>
        <button
          type="button"
          disabled={!entries?.length}
          onClick={() => downloadText(`oqiyyah-platform-log-${new Date().toISOString().slice(0, 10)}.csv`, logToCsv(entries))}
          className={`${btnGhost} flex items-center gap-1.5`}
        >
          <Download size={16} /> صدّر CSV
        </button>
      </div>

      <ErrorBox>{error}</ErrorBox>
      {!entries && !error && <p className="text-sm text-neutral-400">جارِ التحميل…</p>}
      {entries && entries.length === 0 && <p className="text-sm text-neutral-500">لا عمليات بعد.</p>}

      <div className="space-y-2">
        {(entries || []).map((e) => (
          <div key={e.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{actionLabel(e.action)}</span>
              <span className="text-xs text-neutral-500 shrink-0">{fmtDateTime(e.createdAt)}</span>
            </div>
            {e.storeName && (
              <button type="button" onClick={() => onOpenStore(e.storeId)} className="text-sm text-amber-400 hover:underline">
                {e.storeName}
              </button>
            )}
            <div className="text-xs text-neutral-400 mt-0.5">{describeLogEntry(e)}</div>
            {e.adminName && <div className="text-[11px] text-neutral-600 mt-0.5">بواسطة {e.adminName}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
