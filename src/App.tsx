import { useEffect, useRef, useState } from "react";
import {
  Routes,
  Route,
  Link,
  NavLink,
  useLocation,
  Navigate,
} from "react-router-dom";
import {
  Leaf,
  LayoutDashboard,
  PlusCircle,
  Utensils,
  Dumbbell,
  Heart,
  ChartNoAxesCombined,
  Settings as SettingsIcon,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";
import { DataProvider, useData, api } from "./lib/store";
import { Auth } from "./pages/Auth";
import { Today } from "./pages/Today";
import { FoodEditor, FoodHistory } from "./pages/Food";
import { Workouts } from "./pages/Workouts";
import { Health } from "./pages/Health";
import { Progress } from "./pages/Progress";
import { Settings } from "./pages/Settings";
import { Privacy } from "./pages/Privacy";
const navigation = [
  ["", "Home", LayoutDashboard],
  ["add-meal", "Add meal", PlusCircle],
  ["history", "Food history", Utensils],
  ["workouts", "Workouts", Dumbbell],
  ["health", "Health & recovery", Heart],
  ["progress", "Progress", ChartNoAxesCombined],
  ["settings", "Settings", SettingsIcon],
] as const;
export default function App() {
  const location = useLocation();
  const demo =
    location.pathname === "/demo" || location.pathname.startsWith("/demo/");
  const privacy = location.pathname === "/privacy";
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [checking, setChecking] = useState(!demo && !privacy);
  async function check() {
    setChecking(true);
    try {
      const result = await api<{ user: { id: string } } | null>(
        "/auth/get-session",
      );
      setUser(result?.user || null);
    } catch {
      setUser(null);
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    if (!demo && !privacy) void check();
  }, [demo, privacy]);
  if (privacy) return <Privacy />;
  if (checking && !demo)
    return <div className="loading-screen">Opening your space…</div>;
  if (!demo && !user) return <Auth onLogin={() => void check()} />;
  return (
    <DataProvider key={demo ? "demo" : user?.id} demo={demo}>
      <Shell
        onLogout={() => {
          setUser(null);
          window.location.assign("/");
        }}
      />
    </DataProvider>
  );
}
function Shell({ onLogout }: { onLogout: () => void }) {
  const { demo, settings, loading, error, refresh, reset } = useData();
  const [menu, setMenu] = useState(false);
  const accountRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent | KeyboardEvent) => {
      const node = accountRef.current;
      if (!node?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        node.querySelector("summary")?.focus();
      } else if (node.contains(event.target as Node)) return;
      node.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  const [dark, setDark] = useState(
    localStorage.getItem("form-fuel-theme") === "dark",
  );
  const [offline, setOffline] = useState(!navigator.onLine);
  const location = useLocation();
  const base = demo ? "/demo" : "";
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("form-fuel-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, []);
  useEffect(() => {
    setMenu(false);
    if (accountRef.current) accountRef.current.open = false;
  }, [location.pathname]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link className="brand" to={base || "/"}>
          <span className="brand-mark">
            <Leaf size={24} />
          </span>
          form<span className="brand-amp">&</span>fuel
        </Link>
        <p className="sidebar-label">YOUR DAILY PRACTICE</p>
        <nav id="main-navigation" aria-label="Main navigation">
          {navigation.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={`${base}/${path}`}
              end={path === ""}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={19} />
              {label}
              {path === "add-meal" && <span className="nav-plus">+</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="little-leaf">
              <Leaf size={20} />
            </span>
            <strong>Better, at your pace.</strong>
            <p>
              Less noise.
              <br />
              More understanding.
            </p>
          </div>
          <Link className="text-button" to="/privacy">
            Privacy & your data <ArrowUpRight size={14} />
          </Link>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="split">
            <button
              className="icon-button mobile-menu"
              aria-label={menu ? "Close navigation" : "Open navigation"}
              aria-expanded={menu}
              aria-controls="main-navigation"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
            <span className="breadcrumb">
              Your journal <span>/</span>{" "}
              {navigation.find(
                ([p]) =>
                  location.pathname === `${base}/${p}` ||
                  (!p && location.pathname === base),
              )?.[1] ||
                (location.pathname.endsWith("/profile")
                  ? "Profile"
                  : location.pathname.endsWith("/targets")
                    ? "Targets"
                    : "Home")}
            </span>
          </div>
          <div className="topbar-actions">
            <span className="private-label">
              <i />
              {demo ? "Fictional demo" : "Your private space"}
            </span>
            <button
              className="icon-button"
              aria-label={dark ? "Use light theme" : "Use dark theme"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {!demo && (
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={async () => {
                  await api("/auth/sign-out", { method: "POST", body: "{}" });
                  sessionStorage.clear();
                  onLogout();
                }}
              >
                <LogOut size={18} />
              </button>
            )}
            <details className="account-dropdown" ref={accountRef}>
              <summary
                className="avatar"
                aria-label="Account options"
                title="Account options"
              >
                {settings.displayName[0]?.toUpperCase() || "F"}
              </summary>
              <nav className="account-options" aria-label="Account options">
                {[
                  ["profile", "Profile"],
                  ["targets", "Targets"],
                  ["settings", "Settings"],
                ].map(([path, label]) => (
                  <Link
                    key={path}
                    to={`${base}/${path}`}
                    onClick={() => {
                      if (accountRef.current) accountRef.current.open = false;
                    }}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </details>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span>
              <strong>Demo — fictional sample data.</strong> Explore freely.
              Changes are temporary.
            </span>
            <button onClick={reset}>Reset demo ↻</button>
            <Link to="/">Create your own space →</Link>
          </div>
        )}
        {offline && (
          <div className="offline-banner" role="status">
            You’re offline. Viewing cached public app assets only; private
            changes cannot be saved or synced.
          </div>
        )}
        <main id="main" className="main-content">
          {loading ? (
            <div className="loading-screen">Loading your journal…</div>
          ) : error ? (
            <div role="alert" className="error">
              {error}
              <button
                className="button secondary"
                onClick={() => void refresh()}
              >
                Retry
              </button>
            </div>
          ) : !settings.onboarded ? (
            <Settings onDeleted={onLogout} />
          ) : (
            <Routes>
              <Route path={demo ? "/demo" : "/"} element={<Today />} />
              <Route path={`${base}/add-meal`} element={<FoodEditor />} />
              <Route path={`${base}/history`} element={<FoodHistory />} />
              <Route path={`${base}/workouts`} element={<Workouts />} />
              <Route path={`${base}/health`} element={<Health />} />
              <Route path={`${base}/progress`} element={<Progress />} />
              <Route
                path={`${base}/profile`}
                element={
                  <Settings
                    key="profile"
                    section="profile"
                    onDeleted={onLogout}
                  />
                }
              />
              <Route
                path={`${base}/targets`}
                element={
                  <Settings
                    key="targets"
                    section="targets"
                    onDeleted={onLogout}
                  />
                }
              />
              <Route
                path={`${base}/settings`}
                element={<Settings key="settings" onDeleted={onLogout} />}
              />
              <Route path="*" element={<Navigate to={base || "/"} replace />} />
            </Routes>
          )}
          <footer className="footer">
            <span>
              FORM & FUEL <span>·</span> A little more in tune.
            </span>
            <span>Made for the everyday.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
