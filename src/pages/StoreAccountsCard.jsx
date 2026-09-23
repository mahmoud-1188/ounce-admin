import { useState } from "react";
import { Copy, KeyRound, Pencil, UserPlus } from "lucide-react";
import { addStoreOwner, resetStoreUserPassword, updateStoreUser } from "../core/api.js";
import { CENTRAL_URL, generatePassword } from "../core/constants.js";
import { Card, Field, btnGhost, btnPrimary, inputCls } from "../ui/common.jsx";

/**
 * حسابات دخول المركزي لهذا المتجر (البريد + كلمة المرور).
 *
 * ⚠ كلمة المرور مخزّنة مشفّرة (bcrypt) فلا يمكن عرض القديمة لأحد، حتى
 * للأدمن — المتاح تعيين كلمة مرور جديدة تظهر مرة واحدة لتُرسل للعميل.
 */
export default function StoreAccountsCard({ storeId, storeName, storeUsers, busy, act }) {
  const [editing, setEditing] = useState(null); // { id, name, email }
  const [pwFor, setPwFor] = useState(null); // { id, name, email, password }
  const [adding, setAdding] = useState(null); // { name, email, password }
  const [creds, setCreds] = useState(null); // { email, password }
  const [copied, setCopied] = useState(false);

  const hasOwner = storeUsers.some((u) => u.role === "owner" && u.active);

  const closeAll = () => {
    setEditing(null);
    setPwFor(null);
    setAdding(null);
  };

  const credsMsg = creds
    ? [
        `بيانات دخول الإدارة المركزية — ${storeName}`,
        CENTRAL_URL ? `الرابط: ${CENTRAL_URL}` : null,
        `البريد: ${creds.email}`,
        `كلمة المرور: ${creds.password}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const saveEdit = async () => {
    const ok = await act(() => updateStoreUser(editing.id, { name: editing.name.trim(), email: editing.email.trim() }), "حُفظ الحساب");
    if (ok) setEditing(null);
  };

  const savePassword = async () => {
    const { id, email, password } = pwFor;
    const ok = await act(() => resetStoreUserPassword(id, password), "عُيّنت كلمة مرور جديدة");
    if (ok) {
      setPwFor(null);
      setCreds({ email, password });
    }
  };

  const saveOwner = async () => {
    const { name, email, password } = adding;
    const ok = await act(() => addStoreOwner(storeId, { name: name.trim(), email: email.trim(), password }), "أُضيف حساب المالك");
    if (ok) {
      setAdding(null);
      setCreds({ email: email.trim(), password });
    }
  };

  return (
    <Card
      title="حسابات الدخول للمركزي"
      actions={
        !adding && (
          <button
            type="button"
            className={`${hasOwner ? btnGhost : btnPrimary} flex items-center gap-1.5`}
            onClick={() => {
              closeAll();
              setCreds(null);
              setAdding({ name: "", email: "", password: generatePassword() });
            }}
          >
            <UserPlus size={14} /> حساب مالك
          </button>
        )
      }
    >
      <p className="text-[11px] text-neutral-500 mb-3 leading-5">
        كلمات المرور مشفّرة ولا يمكن عرض القديمة — «كلمة مرور جديدة» تستبدلها وتعرض الجديدة مرة واحدة لترسلها للعميل.
      </p>

      {!hasOwner && !adding && (
        <p className="text-sm text-amber-300 bg-amber-950/40 border border-amber-900 rounded-lg px-3 py-2 mb-3">
          لا يوجد حساب مالك فعّال — لا أحد يستطيع دخول المركزي لهذا المتجر. أضف حسابًا.
        </p>
      )}

      {creds && (
        <div className="mb-3 space-y-2">
          <pre className="whitespace-pre-wrap text-sm bg-neutral-950 border border-amber-700/60 rounded-lg p-3 leading-7 font-sans">{credsMsg}</pre>
          <p className="text-[11px] text-amber-300">كلمة المرور لا تظهر مرة أخرى — انسخها الآن.</p>
          <div className="flex gap-2">
            <button
              type="button"
              className={`${btnPrimary} flex items-center gap-1.5`}
              onClick={() => {
                navigator.clipboard?.writeText(credsMsg);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <Copy size={16} /> {copied ? "✓ نُسخ" : "انسخ"}
            </button>
            <button type="button" className={btnGhost} onClick={() => setCreds(null)}>
              تم
            </button>
          </div>
        </div>
      )}

      {adding && (
        <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-3 mb-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="اسم المالك">
              <input value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} className={inputCls} />
            </Field>
            <Field label="البريد (اسم الدخول)">
              <input type="email" value={adding.email} onChange={(e) => setAdding({ ...adding, email: e.target.value })} className={inputCls} dir="ltr" />
            </Field>
            <PasswordField value={adding.password} onChange={(password) => setAdding({ ...adding, password })} />
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy} className={btnPrimary} onClick={saveOwner}>أضف الحساب</button>
            <button type="button" disabled={busy} className={btnGhost} onClick={() => setAdding(null)}>إلغاء</button>
          </div>
        </div>
      )}

      {storeUsers.length === 0 && !adding && <p className="text-sm text-neutral-500">لا حسابات.</p>}

      <div className="space-y-2">
        {storeUsers.map((u) => (
          <div key={u.id} className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
            {editing?.id === u.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="الاسم">
                    <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="البريد (اسم الدخول)">
                    <input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className={inputCls} dir="ltr" />
                  </Field>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} className={btnPrimary} onClick={saveEdit}>حفظ</button>
                  <button type="button" disabled={busy} className={btnGhost} onClick={() => setEditing(null)}>إلغاء</button>
                </div>
              </div>
            ) : pwFor?.id === u.id ? (
              <div className="space-y-3">
                <div className="text-sm">
                  كلمة مرور جديدة لـ <span dir="ltr" className="text-amber-300">{u.email}</span>
                </div>
                <PasswordField value={pwFor.password} onChange={(password) => setPwFor({ ...pwFor, password })} />
                <div className="flex gap-2">
                  <button type="button" disabled={busy || pwFor.password.length < 8} className={btnPrimary} onClick={savePassword}>
                    عيّن كلمة المرور
                  </button>
                  <button type="button" disabled={busy} className={btnGhost} onClick={() => setPwFor(null)}>إلغاء</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm truncate">
                    {u.name}{" "}
                    <span className="text-xs text-neutral-500">{u.role === "owner" ? "· مالك" : "· موظف"}</span>
                    {!u.active && <span className="text-xs text-red-400"> · معطّل</span>}
                  </div>
                  <div className="text-xs text-neutral-400 truncate" dir="ltr">{u.email}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busy}
                    className={`${btnGhost} flex items-center gap-1.5`}
                    onClick={() => {
                      closeAll();
                      setEditing({ id: u.id, name: u.name, email: u.email });
                    }}
                  >
                    <Pencil size={14} /> تعديل
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className={`${btnGhost} flex items-center gap-1.5`}
                    onClick={() => {
                      closeAll();
                      setCreds(null);
                      setPwFor({ id: u.id, name: u.name, email: u.email, password: generatePassword() });
                    }}
                  >
                    <KeyRound size={14} /> كلمة مرور جديدة
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function PasswordField({ value, onChange }) {
  return (
    <Field label="كلمة المرور" hint="مولّدة تلقائيًّا — 8 أحرف على الأقل">
      <div className="flex gap-2">
        <input value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} font-mono`} dir="ltr" />
        <button type="button" className={btnGhost} aria-label="ولّد كلمة مرور" onClick={() => onChange(generatePassword())}>
          <KeyRound size={16} />
        </button>
      </div>
    </Field>
  );
}
