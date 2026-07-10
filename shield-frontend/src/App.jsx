import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/shared/Toast';
import ProtectedRoute from './components/shared/ProtectedRoute';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Overview from './pages/Overview';
import SuricataAlerts from './pages/Alerts';
import AIDecisions from './pages/Threats';
import BlockedIPs from './pages/BlockedIPs';
import MikroTikHealth from './pages/MikroTikHealth';
import NtopngStats from './pages/NtopngStats';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<Overview />} />
              <Route path="/alerts" element={<SuricataAlerts />} />
              <Route path="/ai-decisions" element={<AIDecisions />} />
              <Route path="/blocked-ips" element={<BlockedIPs />} />
              <Route path="/mikrotik" element={<MikroTikHealth />} />
              <Route path="/ntopng" element={<NtopngStats />} />
              <Route path="/audit-logs" element={<AuditLogs />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
