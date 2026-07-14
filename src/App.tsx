import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import AbsensiPage from "./pages/AbsensiPage";
import BukuKasPage from "./pages/BukuKasPage";
import PengaturanPage from "./pages/PengaturanPage";
import KelolaUserPage from "./pages/KelolaUserPage";
import ProfilPage from "./pages/ProfilPage";
import RoutineBookPage from "./pages/RoutineBookPage";
import KolektifPage from "./pages/KolektifPage";
import KolektifSessionPage from "./pages/KolektifSessionPage";
import LoginPage from "./pages/LoginPage";
import BookGroupPage from "./pages/BookGroupPage";
import RequireAuth from "./components/RequireAuth";
import { getActivities, getBooks, getSessionsByActivity } from "./lib/store";
import { useAuth } from "./lib/auth";

const linkBase =
  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium";

function IconBook(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );
}

function IconUsers(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconSettings(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h.03A1.65 1.65 0 0 0 9 3.09V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51h.03a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.03a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function IconMenu(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function IconLogout(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconUser(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut: _signOut } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [headerTitle, setHeaderTitle] = useState("Karang Taruna Permata");
  const [headerBackTo, setHeaderBackTo] = useState<string | undefined>(
    undefined,
  );
  const [prevPath, setPrevPath] = useState<string>("/buku-kas");

  const path = location.pathname;

  // Simpan path sebelumnya setiap kali pindah halaman (kecuali pengaturan)
  const prevPathRef = useRef<string>("/buku-kas");
  useEffect(() => {
    if (path !== "/pengaturan") {
      prevPathRef.current = path;
      setPrevPath(path);
    }
  }, [path]);
  const parts = path.split("/").filter(Boolean);
  const isBookGroupRoute =
    parts[0] === "buku-kas" && parts[1] === "group" && Boolean(parts[2]);
  const bookId =
    parts[0] === "buku-kas" && parts[1] !== "group" ? parts[1] : undefined;

  useEffect(() => {
    let cancelled = false;
    async function computeHeader() {
      let title = "Karang Taruna Permata";
      let backTo: string | undefined = undefined;

      const resolveBookBackTo = (
        books: Awaited<ReturnType<typeof getBooks>>,
        targetBookId: string,
      ) => {
        const target = books.find((b) => b.id === targetBookId);
        if (!target?.groupId) return "/buku-kas";
        const parent = books.find((b) => b.id === target.groupId);
        if (parent?.type === "kolektif") return `/buku-kas-kolektif/${parent.id}`;
        return `/buku-kas/group/${target.groupId}`;
      };

      if (isBookGroupRoute && parts[2]) {
        const books = await getBooks();
        title = books.find((b) => b.id === parts[2])?.name ?? "Grup buku kas";
        backTo = "/buku-kas";
      } else if (parts[0] === "buku-kas" && bookId) {
        const books = await getBooks();
        if (parts[2] === "transaksi") {
          title = "Transaksi Tunai";
          backTo = `/buku-kas/${bookId}`;
        } else if (parts[2] === "transaksi-rekening") {
          title = "Transaksi Rekening";
          backTo = `/buku-kas/${bookId}`;
        } else {
          title = books.find((b) => b.id === bookId)?.name ?? "Buku kas";
          backTo = resolveBookBackTo(books, bookId);
        }
      } else if (parts[0] === "buku-kas-rutin" && parts[1]) {
        const books = await getBooks();
        title = books.find((b) => b.id === parts[1])?.name ?? "Buku kas rutin";
        backTo = resolveBookBackTo(books, parts[1]);
      } else if (
        parts[0] === "buku-kas-kolektif" &&
        parts[1] &&
        parts[2] === "sesi" &&
        parts[3]
      ) {
        const books = await getBooks();
        title = books.find((b) => b.id === parts[1])?.name ?? "Buku Kolektif";
        backTo = `/buku-kas-kolektif/${parts[1]}`;
      } else if (parts[0] === "buku-kas-kolektif" && parts[1]) {
        const books = await getBooks();
        title = books.find((b) => b.id === parts[1])?.name ?? "Buku Kolektif";
        backTo = resolveBookBackTo(books, parts[1]);
      } else if (parts[0] === "buku-kas") {
        title = "Buku kas";
      } else if (
        parts[0] === "absensi" &&
        parts[1] &&
        parts[2] === "sesi" &&
        parts[3]
      ) {
        const sessions = await getSessionsByActivity(parts[1]);
        title = sessions.find((s) => s.id === parts[3])?.label ?? "Sesi";
        backTo = `/absensi/${parts[1]}`;
      } else if (parts[0] === "absensi" && parts[1]) {
        const activities = await getActivities();
        title =
          activities.find((a) => a.id === parts[1])?.name ?? "Detail Kegiatan";
        backTo = "/absensi";
      } else if (parts[0] === "absensi") {
        title = "Absensi";
      } else if (parts[0] === "pengaturan") {
        title = "Pengaturan";
      } else if (parts[0] === "kelola-user") {
        title = "Kelola User";
        backTo = "/pengaturan";
      } else if (parts[0] === "profil") {
        title = "Profil";
      }

      if (!cancelled) {
        setHeaderTitle(title);
        setHeaderBackTo(backTo);
      }
    }
    computeHeader();
    return () => {
      cancelled = true;
    };
  }, [path]);

  const navLinkClass = (isActive: boolean) =>
    `flex items-center w-full rounded-lg text-sm font-medium transition-[padding,gap] duration-300 ease-in-out ${
      isSidebarCollapsed
        ? "justify-center gap-0 px-0 py-2"
        : "justify-start gap-2 px-3 py-2"
    } ${isActive ? "bg-slate-900 dark:bg-slate-700 text-white" : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"}`;

  const collapseButtonClass = `flex items-center w-full rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-[padding,gap] duration-300 ease-in-out ${
    isSidebarCollapsed
      ? "justify-center gap-0 px-0 py-2"
      : "justify-start gap-2 px-3 py-2"
  }`;

  const spanClass = `overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform,margin] duration-300 ease-in-out ${
    isSidebarCollapsed
      ? "max-w-0 opacity-0 -translate-x-1 ml-0"
      : "max-w-[12rem] opacity-100 translate-x-0 ml-2"
  }`;

  const header = { title: headerTitle, backTo: headerBackTo };

  return (
    <div className="min-h-full">
      <div className="flex h-screen w-full overflow-hidden">
        {/* Sidebar desktop */}
        <aside
          className={`hidden shrink-0 overflow-hidden border-r bg-slate-50 dark:bg-slate-900 dark:border-slate-800 transition-[width] duration-300 ease-in-out md:flex md:flex-col ${
            isSidebarCollapsed ? "w-14" : "w-48"
          }`}
        >
          <div className={`flex items-center border-b dark:border-slate-800 h-12 overflow-hidden ${
            isSidebarCollapsed ? "justify-center px-2" : "px-4"
          }`}>
            <img
              src="/logo.png"
              alt="Logo"
              className="h-10 w-10 shrink-0 object-contain"
            />
            <span className={`text-sm font-bold text-slate-900 dark:text-white leading-tight whitespace-normal transition-[max-width,opacity,margin] duration-300 ease-in-out ${
              isSidebarCollapsed
                ? "max-w-0 opacity-0 ml-0 overflow-hidden"
                : "max-w-[12rem] opacity-100 ml-2"
            }`}>
              Karang Taruna Permata
            </span>
          </div>
          <nav className="flex-1 space-y-1 px-2 pt-3">
            <NavLink
              to="/buku-kas"
              className={({ isActive }) => navLinkClass(isActive)}
              title="Buku kas"
            >
              <IconBook className="h-5 w-5 shrink-0" />
              <span className={spanClass}>Buku kas</span>
            </NavLink>
            <NavLink
              to="/absensi"
              className={({ isActive }) => navLinkClass(isActive)}
              title="Absensi"
            >
              <IconUsers className="h-5 w-5 shrink-0" />
              <span className={spanClass}>Absensi</span>
            </NavLink>
            <NavLink
              to="/profil"
              className={({ isActive }) => navLinkClass(isActive)}
              title="Profil"
            >
              <IconUser className="h-5 w-5 shrink-0" />
              <span className={spanClass}>Profil</span>
            </NavLink>
          </nav>

          <div className="px-2 pb-4 space-y-1">
            {/* Pengaturan */}
            <NavLink
              to="/pengaturan"
              className={({ isActive }) => navLinkClass(isActive)}
              title="Pengaturan"
            >
              <IconSettings className="h-5 w-5 shrink-0" />
              <span className={spanClass}>Pengaturan</span>
            </NavLink>
            {/* Collapse toggle */}
            <button
              type="button"
              className={collapseButtonClass}
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              aria-label={
                isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <IconMenu className="h-5 w-5 shrink-0" />
              <span className={spanClass}>
                {isSidebarCollapsed ? "Expand" : "Collapse"}
              </span>
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header mobile */}
          <header className="sticky top-0 z-30 border-b bg-white dark:bg-slate-900 dark:border-slate-800 md:hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="h-9 w-9 shrink-0 object-contain"
                />
                <div className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {header.title}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {header.backTo ? (
                  <button
                    type="button"
                    className="rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                    onClick={() => navigate(header.backTo!)}
                  >
                    Kembali
                  </button>
                ) : null}
                <button
                  type="button"
                  title={path === "/pengaturan" ? "Kembali" : "Pengaturan"}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border dark:border-slate-700 transition ${
                    path === "/pengaturan"
                      ? "bg-slate-900 dark:bg-slate-700 text-white border-slate-900 dark:border-slate-700"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                  onClick={() =>
                    path === "/pengaturan"
                      ? navigate(prevPath)
                      : navigate("/pengaturan")
                  }
                >
                  <IconSettings className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Header desktop */}
          <header className="sticky top-0 z-30 hidden border-b bg-white dark:bg-slate-900 dark:border-slate-800 md:flex md:items-center md:justify-between px-6 py-3">
            <div className="text-base font-semibold text-slate-900 dark:text-white">
              {header.title}
            </div>
            <div className="flex items-center gap-2">
              {header.backTo ? (
                <button
                  type="button"
                  className="rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  onClick={() => navigate(header.backTo!)}
                >
                  Kembali
                </button>
              ) : null}
            </div>
          </header>

          <main className="min-w-0 flex-1 flex flex-col overflow-y-auto scrollbar-hide px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6 md:pt-4 overflow-x-hidden">
            <Routes>
              <Route path="/" element={<Navigate to="/buku-kas" replace />} />
              <Route path="/buku-kas" element={<BukuKasPage />} />
              <Route
                path="/buku-kas/group/:groupId"
                element={<BookGroupPage />}
              />
              <Route path="/buku-kas/:bookId" element={<BukuKasPage />} />
              <Route
                path="/buku-kas/:bookId/transaksi"
                element={<BukuKasPage />}
              />
              <Route
                path="/buku-kas/:bookId/transaksi-rekening"
                element={<BukuKasPage />}
              />
              <Route
                path="/buku-kas-rutin/:bookId"
                element={<RoutineBookPage />}
              />
              <Route
                path="/buku-kas-kolektif/:bookId"
                element={<KolektifPage />}
              />
              <Route
                path="/buku-kas-kolektif/:bookId/sesi/:sessionId"
                element={<KolektifSessionPage />}
              />
              <Route path="/absensi" element={<AbsensiPage />} />
              <Route path="/absensi/:activityId" element={<AbsensiPage />} />
              <Route
                path="/absensi/:activityId/sesi/:sessionId"
                element={<AbsensiPage />}
              />
              <Route path="/pengaturan" element={<PengaturanPage />} />
              <Route path="/kelola-user" element={<KelolaUserPage />} />
              <Route path="/profil" element={<ProfilPage />} />
            </Routes>
          </main>

          {/* Bottom nav mobile */}
          <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white dark:bg-slate-900 dark:border-slate-800 md:hidden">
            <div className="grid grid-cols-3">
              <NavLink
                to="/buku-kas"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center pt-2 pb-[calc(0.25rem+env(safe-area-inset-bottom))] text-[10px] font-medium transition ${
                    isActive
                      ? "text-slate-900 dark:text-white"
                      : "text-slate-400 dark:text-slate-500"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <IconBook className={`h-4 w-4 mb-0.5 ${isActive ? "stroke-[2.5]" : ""}`} />
                    <span className={`relative ${isActive ? "font-semibold after:absolute after:-bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:h-0.5 after:w-5 after:rounded-full after:bg-slate-900 dark:after:bg-white" : ""}`}>Kas</span>
                  </>
                )}
              </NavLink>
              <NavLink
                to="/absensi"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center pt-2 pb-[calc(0.25rem+env(safe-area-inset-bottom))] text-[10px] font-medium transition ${
                    isActive
                      ? "text-slate-900 dark:text-white"
                      : "text-slate-400 dark:text-slate-500"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <IconUsers className={`h-4 w-4 mb-0.5 ${isActive ? "stroke-[2.5]" : ""}`} />
                    <span className={`relative ${isActive ? "font-semibold after:absolute after:-bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:h-0.5 after:w-5 after:rounded-full after:bg-slate-900 dark:after:bg-white" : ""}`}>Absensi</span>
                  </>
                )}
              </NavLink>
              <NavLink
                to="/profil"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center pt-2 pb-[calc(0.25rem+env(safe-area-inset-bottom))] text-[10px] font-medium transition ${
                    isActive
                      ? "text-slate-900 dark:text-white"
                      : "text-slate-400 dark:text-slate-500"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <IconUser className={`h-4 w-4 mb-0.5 ${isActive ? "stroke-[2.5]" : ""}`} />
                    <span className={`relative ${isActive ? "font-semibold after:absolute after:-bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:h-0.5 after:w-5 after:rounded-full after:bg-slate-900 dark:after:bg-white" : ""}`}>Profil</span>
                  </>
                )}
              </NavLink>
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
