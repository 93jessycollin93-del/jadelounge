import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "@/components/common/LoadingScreen";

interface ProtectedRouteProps {
  children: ReactNode;
  requireRole?: "moderator" | "admin";
}

export function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { user, loading, isAdmin, isModerator } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" state={{ from: location.pathname }} replace />;

  if (requireRole === "admin" && !isAdmin) return <Navigate to="/feed" replace />;
  if (requireRole === "moderator" && !isModerator) return <Navigate to="/feed" replace />;

  return <>{children}</>;
}