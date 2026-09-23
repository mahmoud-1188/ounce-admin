import { useEffect, useState } from "react";
import { fetchMe, hasToken, logout } from "../core/api.js";
import LoginPage from "../pages/LoginPage.jsx";
import StoresPage from "../pages/StoresPage.jsx";
import NewStorePage from "../pages/NewStorePage.jsx";
import StoreDetailPage from "../pages/StoreDetailPage.jsx";
import LogPage from "../pages/LogPage.jsx";
import TopBar from "../ui/TopBar.jsx";

/**
 * لوحة أدمن المنصة — مالك البرنامج وحده.
 *
 * التنقّل حالةٌ داخلية بسيطة (لا راوتر): المتاجر ← متجر جديد / تفاصيل
 * متجر، والسجل. الشاشات قليلة، فراوترٌ كامل عبءٌ بلا فائدة هنا.
 */
export default function AdminApp() {
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(hasToken());
  const [tab, setTab] = useState("stores");
  const [view, setView] = useState({ name: "list" }); // list | new | store

  // استعادة الجلسة عند إعادة التحميل — 401 فقط يعني جلسة غير صالحة؛
  // خطأ شبكة لا يمسح التوكن (نفس مبدأ تطبيق الفرع).
  useEffect(() => {
    if (!hasToken()) return;
    fetchMe()
      .then((r) => setAdmin(r.admin))
      .catch((err) => {
        if (err?.status === 401) logout();
      })
      .finally(() => setChecking(false));
  }, []);

  const signOut = () => {
    logout();
    setAdmin(null);
    setTab("stores");
    setView({ name: "list" });
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 flex items-center justify-center text-sm">جارِ التحقق…</div>
    );
  }

  if (!admin) return <LoginPage onLoggedIn={setAdmin} />;

  const openStore = (id) => {
    setTab("stores");
    setView({ name: "store", id });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <TopBar
        admin={admin}
        tab={tab}
        onTabChange={(t) => {
          setTab(t);
          setView({ name: "list" });
        }}
        onLogout={signOut}
      />
      <main className="max-w-5xl mx-auto px-4 py-5">
        {tab === "log" && <LogPage onOpenStore={openStore} onAuthLost={signOut} />}
        {tab === "stores" && view.name === "list" && (
          <StoresPage onOpenStore={openStore} onNewStore={() => setView({ name: "new" })} onAuthLost={signOut} />
        )}
        {tab === "stores" && view.name === "new" && (
          <NewStorePage onBack={() => setView({ name: "list" })} onCreated={openStore} />
        )}
        {tab === "stores" && view.name === "store" && (
          <StoreDetailPage storeId={view.id} onBack={() => setView({ name: "list" })} onAuthLost={signOut} />
        )}
      </main>
    </div>
  );
}
