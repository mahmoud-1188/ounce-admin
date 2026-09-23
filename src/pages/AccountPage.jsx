import { useState } from "react";
import { updateMe } from "../core/api.js";
import { errorMessage } from "../core/constants.js";
import { Card, ErrorBox, Field, Notice, btnPrimary, inputCls } from "../ui/common.jsx";

/**
 * حساب الأدمن نفسه: الاسم، البريد (اسم الدخول)، وكلمة المرور.
 * كل تغيير يحتاج كلمة المرور الحالية — يفرضها الخادم لا الواجهة فقط.
 */
export default function AccountPage({ admin, onUpdated, onAuthLost }) {
  const [name, setName] = useState(admin.name || "");
  const [email, setEmail] = useState(admin.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const changed =
    name.trim() !== admin.name || email.trim().toLowerCase() !== String(admin.email).toLowerCase() || newPassword.length > 0;

  async function submit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!name.trim() || !email.trim()) return setError("أدخل الاسم والبريد");
    if (newPassword) {
      if (newPassword.length < 8) return setError("كلمة المرور الجديدة 8 أحرف على الأقل");
      if (newPassword !== confirmPassword) return setError("تأكيد كلمة المرور لا يطابق");
    }
    if (!currentPassword) return setError("أدخل كلمة المرور الحالية لتأكيد التغيير");
    setBusy(true);
    try {
      const body = { currentPassword, name: name.trim(), email: email.trim() };
      if (newPassword) body.newPassword = newPassword;
      const { admin: updated } = await updateMe(body);
      onUpdated(updated);
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
      setNotice(newPassword ? "حُفظ الحساب وتغيّرت كلمة المرور — استخدم الجديدة في الدخول القادم" : "حُفظ الحساب");
    } catch (err) {
      if (err?.status === 401) return onAuthLost();
      setError(errorMessage(err, "تعذّر حفظ الحساب"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-xl">
      <h1 className="text-lg font-semibold">حسابي</h1>

      <Card title="بيانات الدخول">
        <div className="space-y-3">
          <Field label="الاسم">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="البريد (اسم الدخول)">
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} dir="ltr" />
          </Field>
        </div>
      </Card>

      <Card title="تغيير كلمة المرور">
        <div className="space-y-3">
          <p className="text-[11px] text-neutral-500">اتركهما فارغين إن لم ترد تغيير كلمة المرور.</p>
          <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل">
            <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} dir="ltr" />
          </Field>
          <Field label="تأكيد كلمة المرور الجديدة">
            <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} dir="ltr" />
          </Field>
        </div>
      </Card>

      <Card title="التأكيد">
        <Field label="كلمة المرور الحالية" hint="مطلوبة لحفظ أي تغيير">
          <input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputCls} dir="ltr" />
        </Field>
      </Card>

      <ErrorBox>{error}</ErrorBox>
      <Notice>{notice}</Notice>

      <button type="submit" disabled={busy || !changed} className={`${btnPrimary} w-full sm:w-auto`}>
        {busy ? "جارِ الحفظ…" : "احفظ"}
      </button>
    </form>
  );
}
