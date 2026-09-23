import { useEffect, useState } from "react";
import { fetchSetupStatus, login, setupFirstAdmin } from "../core/api.js";
import { errorMessage } from "../core/constants.js";
import { ErrorBox, Field, btnPrimary, inputCls } from "../ui/common.jsx";

/**
 * دخول أدمن المنصة. إن لم يوجد أي حساب أدمن بعد (منصة جديدة) تتحول
 * الشاشة إلى «إنشاء أول حساب» — تحتاج PLATFORM_ADMIN_KEY مرة واحدة فقط،
 * وبعدها يُرفض هذا المسار نهائيًّا من الخادم.
 */
export default function LoginPage({ onLoggedIn }) {
  const [mode, setMode] = useState("checking"); // checking | login | setup | offline
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [platformKey, setPlatformKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const check = () => {
    setMode("checking");
    fetchSetupStatus()
      .then((r) => setMode(r.needsSetup ? "setup" : "login"))
      .catch(() => setMode("offline"));
  };
  useEffect(check, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) return setError("أدخل البريد وكلمة المرور");
    setBusy(true);
    try {
      if (mode === "setup") {
        if (!name.trim()) {
          setBusy(false);
          return setError("أدخل اسمك");
        }
        const { admin } = await setupFirstAdmin({ platformKey: platformKey.trim(), name: name.trim(), email: email.trim(), password });
        onLoggedIn(admin);
      } else {
        const { admin } = await login({ email: email.trim(), password });
        onLoggedIn(admin);
      }
    } catch (err) {
      if (err?.body?.error === "already_set_up") setMode("login");
      setError(errorMessage(err, mode === "setup" ? "تعذّر إنشاء الحساب" : "تعذّر تسجيل الدخول"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
        <div className="text-center space-y-1 mb-2">
          <img src="/brand/logo-mark-transparent.png" alt="أوقية" className="h-12 w-12 mx-auto" />
          <h1 className="text-lg font-semibold">أدمن المنصة</h1>
          <p className="text-xs text-neutral-400">أوقية — إدارة المشتركين والاشتراكات</p>
        </div>

        {mode === "checking" && <p className="text-sm text-neutral-400 text-center">جارِ الاتصال…</p>}

        {mode === "offline" && (
          <div className="space-y-3">
            <ErrorBox>تعذّر الاتصال بالخادم — تحقّق من VITE_API_URL ومن تشغيل الباك إند.</ErrorBox>
            <button type="button" onClick={check} className={`${btnPrimary} w-full`}>إعادة المحاولة</button>
          </div>
        )}

        {(mode === "login" || mode === "setup") && (
          <>
            {mode === "setup" && (
              <>
                <p className="text-xs text-amber-300 bg-amber-950/40 border border-amber-900 rounded-lg px-3 py-2 leading-6">
                  لا يوجد حساب أدمن بعد. أنشئ حسابك الأول بمفتاح المنصة (PLATFORM_ADMIN_KEY من متغيرات بيئة الباك
                  إند) — مرة واحدة فقط، وبعدها يُقفل هذا الخيار نهائيًّا.
                </p>
                <Field label="مفتاح المنصة">
                  <input type="password" value={platformKey} onChange={(e) => setPlatformKey(e.target.value)} className={inputCls} dir="ltr" autoComplete="off" />
                </Field>
                <Field label="اسمك">
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                </Field>
              </>
            )}
            <Field label="البريد الإلكتروني">
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} dir="ltr" />
            </Field>
            <Field label="كلمة المرور" hint={mode === "setup" ? "8 أحرف على الأقل" : undefined}>
              <input
                type="password"
                autoComplete={mode === "setup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                dir="ltr"
              />
            </Field>
            <ErrorBox>{error}</ErrorBox>
            <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
              {busy ? "لحظة…" : mode === "setup" ? "أنشئ الحساب وادخل" : "دخول"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
