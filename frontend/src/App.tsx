import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { BackupsPage } from './pages/BackupsPage';
import { RestorePage } from './pages/RestorePage';
import { ConfigPage } from './pages/ConfigPage';
import { PlayersPage } from './pages/PlayersPage';
import { ConsolePage } from './pages/ConsolePage';
import { FileManagerPage } from './pages/FileManagerPage';
import { MonitoringPage } from './pages/MonitoringPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) {
    return <div className="h-screen w-screen bg-background flex items-center justify-center text-xs text-mutedText">Loading PalAutoBC...</div>;
  }
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<OverviewPage />} />
              <Route path="backups" element={<BackupsPage />} />
              <Route path="restore" element={<RestorePage />} />
              <Route path="config" element={<ConfigPage />} />
              <Route path="players" element={<PlayersPage />} />
              <Route path="console" element={<ConsolePage />} />
              <Route path="files" element={<FileManagerPage />} />
              <Route path="monitoring" element={<MonitoringPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

