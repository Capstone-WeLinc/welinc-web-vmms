import { useState, useEffect, useCallback, type ReactNode } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  type Location,
} from "react-router-dom";
import Sidebar from "./components/Sidebar/Sidebar";
import { getCurrentUser } from "./lib/api/authService";
import type { UserRecord } from "./lib/api/authService";
import Dashboard from "./pages/Dashboard/Dashboard";
import PlaceholderPage from "./pages/PlaceholderPage/PlaceholderPage";
import SchedulingPage from "./pages/Maintenance Scheduling/MaintenanceScheduling";
import WorkOrderTemplates from "./pages/WorkOrderTemplates/WorkOrderTemplates";
import WorkOrders from "./pages/WorkOrders/WorkOrders";
import ExpenseTrackingPage from "./pages/Expense/ExpenseTrackingPage";
import MaintenanceLogs from "./pages/MaintenanceLogs/MaintenanceLogs";
import FuelManagement from "./pages/FuelManagement/FuelManagement";
import UserManagement from "./pages/UserManagement/UserManagement";
import LoginPage from "./pages/Login/LoginPage";
import { useBackend } from "./lib/api/httpClient";

import { FileBarChart2 } from "lucide-react";
import { setLastActivity, msUntilAbsoluteExpiry, msUntilInactivityExpiry, clearSession } from "./lib/utils/session";
import { isMechanicRole, isOperationsRole } from "./lib/utils/permissions";

function RequireAuthWrapper({
  children,
  isAuthenticated,
  location,
}: {
  children: ReactNode;
  isAuthenticated: boolean;
  location: Location;
}) {
  if (isAuthenticated) return <>{children}</>;
  return <Navigate to="/login" replace state={{ from: location }} />;
}

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [authenticated, setAuthenticated] = useState(() => {
    if (!useBackend) {
      return true;
    }
    return Boolean(window.localStorage.getItem("accessToken"));
  });
  const [darkMode, setDarkMode] = useState(() => {
    const saved = window.localStorage.getItem("darkMode");
    if (saved !== null) {
      return saved === "true";
    }
    return false; // Default to light mode
  });
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);

  const isAuthenticated = useBackend ? authenticated : true;
  const isMechanic = isMechanicRole(currentUser);
  const isOperations = isOperationsRole(currentUser);

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
    window.localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  const handleLogin = () => {
    setAuthenticated(true);
    getCurrentUser()
      .then((u) => setCurrentUser(u))
      .catch(() => setCurrentUser(null));
    navigate("/dashboard", { replace: true });
  };

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem("accessToken");
    clearSession();
    setAuthenticated(false);
    setCurrentUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    getCurrentUser()
      .then((u) => setCurrentUser(u))
      .catch(() => setCurrentUser(null));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    if (isMechanic) {
      if (location.pathname !== "/work-orders" && location.pathname !== "/maintenance-logs") {
        navigate("/work-orders", { replace: true });
      }
      return;
    }

    if (isOperations) {
      const allowedOperationsPaths = [
        "/dashboard",
        "/maintenance-scheduling",
        "/work-orders",
        "/maintenance-logs",
        "/maintenance-reports",
        "/fuel-management",
      ];

      if (!allowedOperationsPaths.includes(location.pathname)) {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [currentUser, isAuthenticated, isMechanic, isOperations, location.pathname, navigate]);

  useEffect(() => {
    const handleUnauthorized = () => {
      if (!isAuthenticated) return;
      setAuthenticated(false);
      setCurrentUser(null);
      navigate("/login", { replace: true });
    };

    // Session expiry handling — use session helper for persistence and timing
    let absoluteTimeout: ReturnType<typeof setTimeout> | null = null;
    let inactivityTimeout: ReturnType<typeof setTimeout> | null = null;
    const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "click"] as const;

    function clearTimers() {
      if (absoluteTimeout) {
        clearTimeout(absoluteTimeout);
        absoluteTimeout = null;
      }
      if (inactivityTimeout) {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = null;
      }
    }

    function scheduleAbsoluteExpiry() {
      const msUntil = msUntilAbsoluteExpiry();
      if (!isFinite(msUntil) || msUntil <= 0) {
        handleLogout();
        return;
      }
      absoluteTimeout = setTimeout(() => {
        handleLogout();
      }, msUntil);
    }

    function resetInactivityTimer() {
      setLastActivity(new Date());
      if (inactivityTimeout) clearTimeout(inactivityTimeout);
      const msUntil = msUntilInactivityExpiry();
      inactivityTimeout = setTimeout(() => {
        handleLogout();
      }, msUntil);
    }

    function activityHandler() {
      resetInactivityTimer();
    }

    if (isAuthenticated) {
      scheduleAbsoluteExpiry();
      resetInactivityTimer();
      activityEvents.forEach((ev) => window.addEventListener(ev, activityHandler));
    }

    window.addEventListener("unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("unauthorized", handleUnauthorized);
      activityEvents.forEach((ev) => window.removeEventListener(ev, activityHandler));
      clearTimers();
    };
  }, [isAuthenticated, handleLogout, navigate]);

  return (
    <div className="min-h-screen bg-[var(--color-page-bg)] text-[var(--color-text-primary)] transition-colors duration-300">
      {isAuthenticated && (
        <Sidebar
          onCollapse={setSidebarCollapsed}
          onLogout={handleLogout}
          currentUser={currentUser}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
        />
      )}
      <main
        className={`transition-all duration-300 ease-in-out ${
          isAuthenticated
            ? `px-6 py-8 md:px-8 lg:px-10 ${sidebarCollapsed ? "ml-20" : "ml-64"}`
            : "h-screen"
        }`}
      >
        <Routes>
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LoginPage onLogin={handleLogin} />
              )
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireAuthWrapper
                isAuthenticated={isAuthenticated}
                location={location}
              >
                <Dashboard />
              </RequireAuthWrapper>
            }
          />
          <Route
            path="/users"
            element={
              <RequireAuthWrapper
                isAuthenticated={isAuthenticated}
                location={location}
              >
                <UserManagement />
              </RequireAuthWrapper>
            }
          />
          <Route
            path="/maintenance-scheduling"
            element={
              <RequireAuthWrapper
                isAuthenticated={isAuthenticated}
                location={location}
              >
                <SchedulingPage />
              </RequireAuthWrapper>
            }
          />
          <Route
            path="/work-orders"
            element={
              <RequireAuthWrapper
                isAuthenticated={isAuthenticated}
                location={location}
              >
                <WorkOrders />
              </RequireAuthWrapper>
            }
          />
          <Route
            path="/maintenance-logs"
            element={
              <RequireAuthWrapper
                isAuthenticated={isAuthenticated}
                location={location}
              >
                <MaintenanceLogs />
              </RequireAuthWrapper>
            }
          />
          <Route
            path="/inspection-checklists"
            element={
              <RequireAuthWrapper
                isAuthenticated={isAuthenticated}
                location={location}
              >
                <WorkOrderTemplates />
              </RequireAuthWrapper>
            }
          />
          <Route
            path="/maintenance-reports"
            element={
              <RequireAuthWrapper
                isAuthenticated={isAuthenticated}
                location={location}
              >
                <PlaceholderPage
                  icon={FileBarChart2}
                  title="Maintenance Reports"
                  subtitle="Generate and view maintenance analytics"
                />
              </RequireAuthWrapper>
            }
          />
          <Route
            path="/fuel-management"
            element={
              <RequireAuthWrapper
                isAuthenticated={isAuthenticated}
                location={location}
              >
                <FuelManagement />
              </RequireAuthWrapper>
            }
          />
          <Route
            path="/expense-profitability"
            element={
              <RequireAuthWrapper
                isAuthenticated={isAuthenticated}
                location={location}
              >
                <ExpenseTrackingPage />
              </RequireAuthWrapper>
            }
          />
          <Route
            path="*"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
