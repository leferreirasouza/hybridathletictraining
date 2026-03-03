import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/layouts/AppLayout";
import Auth from "@/pages/Auth";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Schedule from "@/pages/Schedule";
import LogSession from "@/pages/LogSession";
import AIChat from "@/pages/AIChat";
import Profile from "@/pages/Profile";
import CoachDashboard from "@/pages/CoachDashboard";
import PlanBuilder from "@/pages/PlanBuilder";
import AdminPanel from "@/pages/AdminPanel";
import Analytics from "@/pages/Analytics";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 rounded-xl gradient-hyrox animate-pulse-glow" />
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function RequireOrg({ children }: { children: React.ReactNode }) {
  const { memberships, loading } = useAuth();
  if (loading) return null;
  if (memberships.length === 0) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function RoleDashboard() {
  const { currentRole } = useAuth();
  if (currentRole === 'coach' || currentRole === 'master_admin') {
    return <CoachDashboard />;
  }
  return <Dashboard />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><RequireOrg><AppLayout /></RequireOrg></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<RoleDashboard />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="log" element={<LogSession />} />
              <Route path="ai" element={<AIChat />} />
              <Route path="profile" element={<Profile />} />
              <Route path="athletes" element={<CoachDashboard />} />
              <Route path="plans" element={<PlanBuilder />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="admin" element={<AdminPanel />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
