import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import EntitlementRoute from "./auth/EntitlementRoute";
import ProtectedRoute from "./auth/ProtectedRoute";
import { useAuth } from "./auth/AuthProvider";
import AccountPage from "./pages/AccountPage";
import StartPage from "./pages/StartPage";
import AccessExpiredPage from "./pages/AccessExpiredPage";
import HistoryPage from "./pages/HistoryPage";

function ResetRoute({ ResetApp }) {
  const { user, refreshEntitlement } = useAuth();
  const navigate = useNavigate();
  return (
    <ResetApp
      currentUser={user}
      refreshEntitlement={refreshEntitlement}
      onAccessDenied={() => navigate("/access-expired", { replace: true })}
    />
  );
}

export default function AppRouter({ ResetApp }) {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/start" element={<StartPage />} />
        <Route path="/signin" element={<StartPage />} />
        <Route path="/auth/confirm" element={<StartPage />} />
        <Route path="/app" element={(
          <ProtectedRoute>
            <EntitlementRoute><ResetRoute ResetApp={ResetApp} /></EntitlementRoute>
          </ProtectedRoute>
        )} />
        <Route path="/account" element={(
          <ProtectedRoute><AccountPage /></ProtectedRoute>
        )} />
        <Route path="/history" element={(
          <ProtectedRoute><HistoryPage /></ProtectedRoute>
        )} />
        <Route path="/access-expired" element={(
          <ProtectedRoute><AccessExpiredPage /></ProtectedRoute>
        )} />
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
