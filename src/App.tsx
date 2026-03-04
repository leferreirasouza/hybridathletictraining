import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/layouts/AppLayout";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";

// Lazy-loaded pages
const Terms = lazy(() => import("@/pages/Terms"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const About = lazy(() => import("@/pages/About"));
const FAQ = lazy(() => import("@/pages/FAQ"));
const Contact = lazy(() => import("@/pages/Contact"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const History = lazy(() => import("@/pages/History"));
const RaceResults = lazy(() => import("@/pages/RaceResults"));
const LogSession = lazy(() => import("@/pages/LogSession"));
const AIChat = lazy(() => import("@/pages/AIChat"));
const Messages = lazy(() => import("@/pages/Messages"));
const Profile = lazy(() => import("@/pages/Profile"));
const Reports = lazy(() => import("@/pages/Reports"));
const CoachDashboard = lazy(() => import("@/pages/CoachDashboard"));
const PlanBuilder = lazy(() => import("@/pages/PlanBuilder"));
const AdminPanel = lazy(() => import("@/pages/AdminPanel"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Settings = lazy(() => import("@/pages/Settings"));
const ActivityLog = lazy(() => import("@/pages/ActivityLog"));
const ExerciseLibrary = lazy(() => import("@/pages/ExerciseLibrary"));

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
  const { memberships, loading, membershipsLoading } = useAuth();
  if (loading || membershipsLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 rounded-xl gradient-hyrox animate-pulse-glow" />
    </div>
  );
  if (memberships.length === 0) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function RoleDashboard() {
  const { effectiveRole } = useAuth();
  if (effectiveRole === 'coach' || effectiveRole === 'admin' || effectiveRole === 'master_admin') {
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
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="h-8 w-8 rounded-xl gradient-hyrox animate-pulse-glow" /></div>}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/about" element={<About />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route path="/" element={<ProtectedRoute><RequireOrg><AppLayout /></RequireOrg></ProtectedRoute>}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<RoleDashboard />} />
                <Route path="schedule" element={<Schedule />} />
                <Route path="log" element={<LogSession />} />
                <Route path="races" element={<RaceResults />} />
                <Route path="history" element={<History />} />
                <Route path="ai" element={<AIChat />} />
                <Route path="messages" element={<Messages />} />
                <Route path="reports" element={<Reports />} />
                <Route path="profile" element={<Profile />} />
                <Route path="athletes" element={<CoachDashboard />} />
                <Route path="plans" element={<PlanBuilder />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="admin" element={<AdminPanel />} />
                <Route path="settings" element={<Settings />} />
                <Route path="activity" element={<ActivityLog />} />
                <Route path="exercises" element={<ExerciseLibrary />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
