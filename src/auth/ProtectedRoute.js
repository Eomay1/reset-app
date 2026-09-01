import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <main className="auth-screen"><p role="status">Restoring your RESET account…</p></main>;
  }

  if (!user) {
    return <Navigate to="/start" replace state={{ from: location.pathname }} />;
  }

  return children;
}
