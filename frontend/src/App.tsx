import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { SessionProvider } from './contexts/SessionContext.js';
import { ToastProvider } from './contexts/ToastContext.js';
import { FloatingLayoutProvider } from './contexts/FloatingLayoutContext.js';
import { AboutPage } from './pages/AboutPage.js';
import { ChatPage } from './pages/ChatPage.js';
import { ContactPage } from './pages/ContactPage.js';
import { FaqPage } from './pages/FaqPage.js';
import { LandingPage } from './pages/LandingPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { PrivacyPage } from './pages/PrivacyPage.js';
import { TermsPage } from './pages/TermsPage.js';
import { ContentHubPage } from './pages/ContentHubPage.js';
import { TagPage } from './pages/TagPage.js';
import { DynamicSeoPage } from './pages/DynamicSeoPage.js';
import { AdminAuthProvider, useAdminAuth, AdminLogin } from './admin/AdminAuth.js';
import { AdminLayout } from './admin/AdminLayout.js';
import { Dashboard } from './admin/pages/Dashboard.js';
import { LiveOperations } from './admin/pages/LiveOperations.js';
import { CampusAnalytics as AdminCampus } from './admin/pages/CampusAnalytics.js';
import { NotificationsAdmin } from './admin/pages/Notifications.js';

function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAdminAuth();
  if (!token) return <AdminLogin />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  {
    path: "/admin",
    element: (
      <AdminAuthProvider>
        <ProtectedAdminRoute>
          <AdminLayout />
        </ProtectedAdminRoute>
      </AdminAuthProvider>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: "growth", element: <Dashboard /> },
      { path: "product", element: <Dashboard /> },
      { path: "notifications", element: <NotificationsAdmin /> },
      { path: "operations", element: <LiveOperations /> },
      { path: "engineering", element: <div className="p-8 text-slate-400">Engineering Diagnostics (Postponed for MVP)</div> },
      { path: "campus", element: <AdminCampus /> },
      { path: "*", element: <Dashboard /> },
    ]
  },
  {
    element: <Layout />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/chat", element: <ChatPage /> },
      { path: "/about", element: <AboutPage /> },
      { path: "/faq", element: <FaqPage /> },
      { path: "/privacy", element: <PrivacyPage /> },
      { path: "/terms", element: <TermsPage /> },
      { path: "/contact", element: <ContactPage /> },
      { path: "/topics", element: <ContentHubPage /> },
      { path: "/topics/:category", element: <ContentHubPage /> },
      { path: "/tag/:tagName", element: <TagPage /> },
      { path: "/:seoSlug", element: <DynamicSeoPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

import { useEffect } from 'react';

function PushNotificationHandler() {
  useEffect(() => {
    // Phase F: Deep Link Resolution
    const searchParams = new URLSearchParams(window.location.search);
    const campaignId = searchParams.get('campaign');
    
    if (campaignId) {
      // 1. Log click
      console.log(`[PushService] Booted via campaign: ${campaignId}`);
      // In production we would ping the backend here:
      // fetch('/api/analytics/campaign-click', { method: 'POST', body: JSON.stringify({ campaignId }) });
      
      // 2. Restore previous preferences & Auto-focus Start
      // This is handled automatically by the components reading from safeLocalStorage,
      // but we could explicitly set flags here if needed (e.g. force opening QueueCard).
      localStorage.setItem('kaboom_auto_open_queue', 'true');
      
      // Remove query param from URL so we don't trigger it again on reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Also listen to postMessages from the Service Worker (if app was already open)
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICKED') {
        console.log(`[PushService] Focused via campaign: ${event.data.campaignId}`);
        localStorage.setItem('kaboom_auto_open_queue', 'true');
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleMessage);
  }, []);
  
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <SessionProvider>
          <FloatingLayoutProvider>
            <PushNotificationHandler />
            <RouterProvider router={router} />
          </FloatingLayoutProvider>
        </SessionProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
