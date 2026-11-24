import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Sidebar from './components/Sidebar/Sidebar';
import Navbar from './components/Navbar/Navbar';
import Dashboard from './pages/Dashboard/Dashboard';
import SchedulingPage from './pages/Maintenance Scheduling/MaintenanceScheduling';
import ChecklistTemplates from './pages/ChecklistTemplates/ChecklistTemplates';
import WorkOrders from './pages/WorkOrders/WorkOrders';
import MaintenanceLogs from './pages/MaintenanceLogs/MaintenanceLogs';
import FuelManagement from './pages/FuelManagement/FuelManagement';
import Profile from './pages/Profile/Profile';
import AIAnalyticsPage from './pages/AIAnalytics/AIAnalytics';
import Vehicles from './pages/Vehicles/Vehicles';
import Garages from './pages/Garages/Garages';
import OutsourcedProviders from './pages/OutsourcedProviders/OutsourcedProviders';
import MaintenanceReports from './pages/MaintenanceReports/MaintenanceReports';
import MaintenanceCosting from './pages/MaintenanceCosting/MaintenanceCosting';
import AuditLogs from './pages/AuditLogs/AuditLogs';
import Settings from './pages/Settings/Settings';
import SessionExpiryNotice from './components/session/SessionExpiryNotice';
import { useBackend } from './lib/api/httpClient';
import { useAuthStore } from './store/authStore';
import { bootSession, PORTAL_URL } from './lib/session/session';

function Protected({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export default function App() {
  const [adminCodeRequired, setAdminCodeRequired] = useState(false);
  const authenticated = useAuthStore((state) => state.authenticated);
  const currentUser = useAuthStore((state) => state.currentUser);
  const sessionStatus = useAuthStore((state) => state.status);

  useEffect(() => {
    const showNotice = () => setAdminCodeRequired(true);
    window.addEventListener('admin-code-required', showNotice);
    return () => window.removeEventListener('admin-code-required', showNotice);
  }, []);

  if (useBackend && !authenticated) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        {sessionStatus === 'unavailable' ? (
          <div role="alert" className="max-w-md">
            <p className="font-semibold">Can't reach the shared sign in service</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Check your connection, then try again.</p>
            <button
              type="button"
              className="mt-4 rounded-md bg-[var(--color-primary)] px-4 py-2 font-semibold text-white"
              onClick={() => void bootSession()}
            >
              Retry
            </button>
          </div>
        ) : (
          <p>Connecting to the shared sign in service…</p>
        )}
      </div>
    );
  }

  if (useBackend && authenticated && !['ADMIN', 'OPERATIONS'].includes(currentUser?.role ?? '')) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-semibold">Use the VMMS mobile app</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            This account does not have access to the VMMS web app. Mechanics and Chief Mechanics use the mobile app.
          </p>
          <a className="mt-4 inline-block font-semibold underline" href={`${PORTAL_URL}/?from=VMMS`}>
            Return to the app launcher
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-page-bg)] text-[var(--color-text-primary)] transition-colors duration-300">
      <Sidebar currentUser={currentUser} />
      <div className="ml-20 flex min-h-screen min-w-0 flex-col transition-all duration-300 ease-in-out">
        <Navbar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {adminCodeRequired && (
            <div role="alert" className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              Confirm your sign in in the portal to continue.{' '}
              <a className="font-semibold underline" href={`${PORTAL_URL}/admin`} target="_blank" rel="noreferrer">Open portal administration</a>
            </div>
          )}
          <SessionExpiryNotice />
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="/maintenance-scheduling" element={<Protected><SchedulingPage /></Protected>} />
            <Route path="/work-orders" element={<Protected><WorkOrders /></Protected>} />
            <Route path="/maintenance-logs" element={<Protected><MaintenanceLogs /></Protected>} />
            <Route path="/checklist-templates" element={<Protected><ChecklistTemplates /></Protected>} />
            <Route path="/inspection-checklists" element={<Navigate to="/checklist-templates" replace />} />
            <Route path="/profile" element={<Protected><Profile /></Protected>} />
            <Route path="/ai-analytics" element={<Protected><AIAnalyticsPage /></Protected>} />
            <Route path="/maintenance-reports" element={<Protected><MaintenanceReports /></Protected>} />
            <Route path="/maintenance-costing" element={<Protected><MaintenanceCosting /></Protected>} />
            <Route path="/fuel-management" element={<Protected><FuelManagement /></Protected>} />
            <Route path="/vehicles" element={<Protected><Vehicles /></Protected>} />
            <Route path="/garages" element={<Protected><Garages /></Protected>} />
            <Route path="/outsourced-providers" element={<Protected><OutsourcedProviders /></Protected>} />
            <Route
              path="/audit-logs"
              element={currentUser?.role === 'ADMIN' ? <Protected><AuditLogs /></Protected> : <Navigate to="/dashboard" replace />}
            />
            <Route
              path="/settings"
              element={['ADMIN', 'OPERATIONS'].includes(currentUser?.role ?? '') ? <Protected><Settings /></Protected> : <Navigate to="/dashboard" replace />}
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
