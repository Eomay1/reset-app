import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./auth/ProtectedRoute";
import { useAuth } from "./auth/AuthProvider";
import AccountPage from "./pages/AccountPage";
import StartPage from "./pages/StartPage";

function ResetRoute({ ResetApp }) {
  const { user } = useAuth();
  return <ResetApp currentUser={user} />;
}

export default function AppRouter({ ResetApp }) {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/start" element={<StartPage />} />
        <Route path="/signin" element={<StartPage />} />
        <Route path="/auth/confirm" element={<StartPage />} />
        <Route path="/app" element={(
          <ProtectedRoute><ResetRoute ResetApp={ResetApp} /></ProtectedRoute>
        )} />
        <Route path="/account" element={(
          <ProtectedRoute><AccountPage /></ProtectedRoute>
        )} />
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
