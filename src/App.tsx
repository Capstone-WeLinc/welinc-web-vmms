import { useEffect, useCallback, useLayoutEffect, useRef, type ReactNode } from "react";
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
import Dashboard from "./pages/Dashboard/Dashboard";
import SchedulingPage from "./pages/Maintenance Scheduling/MaintenanceScheduling";
import ChecklistTemplates from "./pages/ChecklistTemplates/ChecklistTemplates";
import WorkOrders from "./pages/WorkOrders/WorkOrders";
import MaintenanceExpenses from "./pages/MaintenanceExpenses/MaintenanceExpenses";
import MaintenanceReports from "./pages/MaintenanceReports/MaintenanceReports";
import MaintenanceLogs from "./pages/MaintenanceLogs/MaintenanceLogs";
import FuelManagement from "./pages/FuelManagement/FuelManagement";
import UserManagement from "./pages/UserManagement/UserManagement";
import LoginPage from "./pages/Login/LoginPage";
import Profile from "./pages/Profile/Profile";

import { setLastActivity, msUntilAbsoluteExpiry, msUntilInactivityExpiry, clearSession } from "./lib/utils/session";
import { isChiefMechanicRole, isMechanicRole, isOperationsRole } from "./lib/utils/permissions";
import { useAuthStore } from "./store/authStore";

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
  const authenticated = useAuthStore((state) => state.authenticated);
  const currentUser = useAuthStore((state) => state.currentUser);
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement | null>(null);

  const isAuthenticated = authenticated;
  const hasIncomingSsoToken =
    location.pathname === "/login" &&
    new URLSearchParams(location.search).has("token");
  const isMechanic = isMechanicRole(currentUser);
  const isChiefMechanic = isChiefMechanicRole(currentUser);
  const isOperations = isOperationsRole(currentUser);

  const handleLogin = () => {
    setAuthenticated(true);
    getCurrentUser()
      .then((u) => {
        setCurrentUser(u);
        navigate("/dashboard", { replace: true });
      })
      .catch(() => {
        setCurrentUser(null);
        navigate("/dashboard", { replace: true });
      });
  };

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem("accessToken");
    clearSession();
    clearAuth();
    navigate("/login", { replace: true });
  }, [clearAuth, navigate]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token' || e.key === 'welinc_token' || e.key === 'accessToken' || e.key === 'welinc_user') {
        window.location.reload();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    getCurrentUser()
      .then((u) => setCurrentUser(u))
      .catch(() => setCurrentUser(null));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    if (isMechanic || isChiefMechanic) {
      const allowedMechanicPaths = [
        "/dashboard",
        "/maintenance-scheduling",
        "/work-orders",
        "/maintenance-logs",
        "/profile",
      ];
      if (
        !allowedMechanicPaths.includes(location.pathname)
      ) {
        navigate("/dashboard", { replace: true });
      }
      return;
    }

    if (isOperations) {
      const allowedOperationsPaths = [
        "/dashboard",
        "/maintenance-scheduling",
        "/work-orders",
        "/maintenance-logs",
        "/checklist-templates",
        "/profile",
        "/maintenance-reports",
        "/fuel-expenses",
      ];

      if (!allowedOperationsPaths.includes(location.pathname)) {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [currentUser, isAuthenticated, isChiefMechanic, isMechanic, isOperations, location.pathname, navigate]);

  useLayoutEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  useEffect(() => {
    const handleUnauthorized = () => {
      if (!isAuthenticated) return;
      clearAuth();
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
  }, [clearAuth, isAuthenticated, handleLogout, navigate]);

  return (
    <div className="min-h-screen bg-[var(--color-page-bg)] text-[var(--color-text-primary)] transition-colors duration-300">
      {isAuthenticated && (
        <Sidebar
          currentUser={currentUser}
        />
      )}
      <main
        ref={mainRef}
        className={`transition-all duration-300 ease-in-out ${
          isAuthenticated
            ? "ml-20 px-6 pb-8 pt-4 md:px-8 lg:px-10"
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
              isAuthenticated && !hasIncomingSsoToken ? (
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
              path="/checklist-templates"
              element={
              <RequireAuthWrapper
                isAuthenticated={isAuthenticated}
                location={location}
              >
                <ChecklistTemplates />
              </RequireAuthWrapper>
              }
            />
            <Route
              path="/inspection-checklists"
              element={<Navigate to="/checklist-templates" replace />}
            />
          <Route
            path="/profile"
            element={
              <RequireAuthWrapper
                isAuthenticated={isAuthenticated}
                location={location}
              >
                <Profile />
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
                <MaintenanceReports />
              </RequireAuthWrapper>
            }
          />
          <Route
            path="/fuel-expenses"
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
            path="/maintenance-expenses"
            element={
              <RequireAuthWrapper
                isAuthenticated={isAuthenticated}
                location={location}
              >
                <MaintenanceExpenses />
              </RequireAuthWrapper>
            }
          />
          <Route
            path="/fuel-management"
            element={<Navigate to="/fuel-expenses" replace />}
          />
          <Route
            path="/expense-profitability"
            element={<Navigate to="/maintenance-expenses" replace />}
          />
          <Route
            path="*"
            element={
              isAuthenticated ? (
                <Navigate to="/users" replace />
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
