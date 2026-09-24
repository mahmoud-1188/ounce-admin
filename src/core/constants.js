// ثوابت لوحة الأدمن — المفاهيم نفسها من صفحة «تصاريح الاشتراك» الأولية،
// بمعرّفاتها كما هي حرفيًّا حتى تطابق ما يخزّنه الباك إند.

const PLANS = [
  { id: "central", label: "مركزي + فروع", hint: "تطبيق الإدارة المركزية وعدة فروع داخل السقف" },
  { id: "branch_only", label: "فرعٌ واحد فقط", hint: "فرع واحد — السقف 1 دائمًا" },
];

const planLabel = (id) => PLANS.find((p) => p.id === id)?.label || id;

// نفس BRANCH_MODELS في النموذج الأولي (المعرّفات والتسميات والتلميحات).
const BRANCH_MODELS = [
  { id: "full", label: "فرعٌ كامل", hint: "يشتري ويُكوّد ويطبع بنفسه" },
  { id: "coding_only_hq", label: "التكويد في الإدارة", hint: "يشتري بموافقة، والبضاعة تُكوَّد في الرئيسي ثم تصله" },
  { id: "sales_only", label: "معرض بيعٍ فقط", hint: "يبيع ما يصله — لا يشتري ولا يُكوّد" },
  { id: "approval_only", label: "يُكوّد بموافقة", hint: "يُكوّد بنفسه لكن الشراء يحتاج اعتماد الإدارة" },
];

const branchModelLabel = (id) => BRANCH_MODELS.find((m) => m.id === id)?.label || id;

// حالة الاشتراك كما يحسبها الخادم (subscriptionState في platform.routes.js)
const STATES = {
  active: { label: "فعّال", cls: "bg-emerald-950/60 text-emerald-300 border-emerald-800" },
  expiring: { label: "قارب الانتهاء", cls: "bg-amber-950/60 text-amber-300 border-amber-800" },
  expired: { label: "منتهٍ", cls: "bg-red-950/60 text-red-300 border-red-800" },
  suspended: { label: "موقوف", cls: "bg-neutral-800 text-neutral-300 border-neutral-600" },
};

const ACTIONS = {
  admin_setup: "إنشاء حساب الأدمن",
  admin_updated: "تعديل حساب الأدمن",
  store_created: "إنشاء متجر",
  store_updated: "تعديل الاشتراك",
  store_renewed: "تجديد",
  store_suspended: "إيقاف",
  store_activated: "تفعيل",
  branch_model_changed: "تغيير نموذج فرع",
  store_user_created: "إضافة حساب مركزي",
  store_user_updated: "تعديل حساب مركزي",
  store_user_password_reset: "كلمة مرور جديدة",
  payment_recorded: "دفعة اشتراك",
  payment_voided: "إلغاء دفعة",
};

// طرق الدفع — نفس القيم في subscription_payments (migration 043)
const PAY_METHODS = [
  { id: "transfer", label: "تحويل بنكي" },
  { id: "cash", label: "نقدًا" },
  { id: "card", label: "بطاقة" },
  { id: "other", label: "أخرى" },
];
const payMethodLabel = (id) => PAY_METHODS.find((m) => m.id === id)?.label || id;

const CURRENCY = "ر.س";
const moneyFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
/** مبلغ بالريال — معزول الاتجاه كي لا ينقلب داخل النص العربي. */
const fmtMoney = (n) => `\u2066${moneyFmt.format(Number(n) || 0)}\u2069 ${CURRENCY}`;

/** السعر الشهري = الأساسي + سعر الفرع × الفروع المحتسبة (فرعٌ واحد على الأقل) — كما يحسبه الخادم. */
function monthlyPrice(base, perBranch, branches) {
  const b = Math.max(1, Number(branches) || 0);
  return Math.round(((Number(base) || 0) + (Number(perBranch) || 0) * b) * 100) / 100;
}

const RENEW_PRESETS = [1, 3, 6, 12];

// ⚠ عزلٌ اتجاهيّ (LRI…PDI) حول التاريخ: داخل نصٍّ عربي يقلب المتصفح
// 2026-09-28 بصريًّا إلى 28-09-2026 — والعزل يُبقيه كما هو.
const ltr = (t) => `\u2066${t}\u2069`;
const stripIsolates = (t) => String(t).replace(/[\u2066-\u2069]/g, "");

const p2 = (n) => String(n).padStart(2, "0");
function localDate(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`;
}

const fmtDate = (d) => (d ? ltr(localDate(d)) : "بلا انتهاء");

/** تاريخ ووقت بالتوقيت المحلي للمتصفح (الخادم يخزّن UTC). */
function fmtDateTime(d) {
  if (!d) return "";
  const x = new Date(d);
  return ltr(`${localDate(x)} ${p2(x.getHours())}:${p2(x.getMinutes())}`);
}

/** أيام متبقية حتى الانتهاء (سالبة إن انتهى)، أو null إن كان بلا انتهاء. */
function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}

function expiryText(expiresAt) {
  const d = daysLeft(expiresAt);
  if (d === null) return "بلا انتهاء";
  if (d < 0) return `انتهى منذ ${-d} يوم`;
  if (d === 0) return "ينتهي اليوم";
  return `متبقٍّ ${d} يوم`;
}

/** رسالة عربية لكل رمز خطأ يرجّعه الباك إند من مسارات /platform. */
function errorMessage(err, fallback = "حدث خطأ غير متوقع") {
  const b = err?.body || {};
  switch (b.error) {
    case "invalid_credentials": return "البريد أو كلمة المرور غير صحيحة";
    case "already_set_up": return "يوجد حساب أدمن بالفعل — سجّل الدخول";
    case "invalid_platform_admin_key": return "مفتاح المنصة غير صحيح";
    case "platform_admin_key_not_configured": return "PLATFORM_ADMIN_KEY غير مضبوط في متغيرات بيئة الباك إند";
    case "password_too_short": return "كلمة المرور 8 أحرف على الأقل";
    case "name_and_email_required": return "أدخل الاسم والبريد";
    case "email_already_used": return "هذا البريد مستخدم لحسابٍ آخر";
    case "store_name_required": return "أدخل اسم الشركة";
    case "invalid_plan": return "باقة غير صالحة";
    case "invalid_months": return "مدة الاشتراك غير صالحة";
    case "invalid_max_branches": return "سقف الفروع يجب أن يكون 1 أو أكثر";
    case "owner_name_and_email_required": return "أدخل اسم المالك وبريده";
    case "max_below_current": return `لا يُخفَّض السقف تحت عدد الفروع العاملة (${b.branchCount}) — احذف فرعًا من المركزي أولًا`;
    case "invalid_expires_at": return "تاريخ الانتهاء غير صالح";
    case "store_not_found": return "المتجر غير موجود";
    case "branch_not_found": return "الفرع غير موجود";
    case "invalid_operating_model": return "نموذج تشغيل غير صالح";
    case "invalid_status": return "حالة غير صالحة";
    case "store_user_not_found": return "الحساب غير موجود";
    case "invalid_price": return "السعر غير صالح (رقم 0 أو أكثر)";
    case "invalid_amount": return "المبلغ غير صالح";
    case "invalid_payment_method": return "طريقة دفع غير صالحة";
    case "invalid_paid_at": return "تاريخ الدفع غير صالح";
    case "void_reason_required": return "اكتب سبب الإلغاء";
    case "payment_already_voided": return "أُلغيت هذه الدفعة من قبل";
    case "payment_not_found": return "الدفعة غير موجودة";
    case "current_password_required": return "أدخل كلمة المرور الحالية";
    case "wrong_current_password": return "كلمة المرور الحالية غير صحيحة";
    case "wrong_token_scope":
    case "invalid_or_expired_token":
    case "missing_token":
    case "admin_not_found_or_inactive":
      return "انتهت الجلسة — سجّل الدخول من جديد";
    default:
      return err?.status ? fallback : "تعذّر الاتصال بالخادم";
  }
}

// بلا 0/O و1/l/I — كلمة مرور تُملى على العميل بالهاتف لا تحتمل الالتباس.
const PW_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generatePassword(len = 12) {
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PW_ALPHABET[b % PW_ALPHABET.length]).join("");
}

/** يضيف (أو ينقص بقيمة سالبة) أشهرًا لتاريخ — مع ضبط نهاية الشهر (31 → 30/28). */
function addMonths(iso, months) {
  const d = new Date(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d.toISOString();
}

const CENTRAL_URL = (import.meta.env.VITE_CENTRAL_APP_URL || "").replace(/\/+$/, "");

export {
  PLANS,
  planLabel,
  BRANCH_MODELS,
  branchModelLabel,
  STATES,
  ACTIONS,
  RENEW_PRESETS,
  fmtDate,
  fmtDateTime,
  stripIsolates,
  daysLeft,
  expiryText,
  errorMessage,
  generatePassword,
  addMonths,
  CENTRAL_URL,
  PAY_METHODS,
  payMethodLabel,
  CURRENCY,
  fmtMoney,
  monthlyPrice,
};
