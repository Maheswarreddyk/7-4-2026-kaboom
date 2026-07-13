import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';

// Eager imports for critical shell
import { Layout } from './components/Layout.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { SessionProvider } from './contexts/SessionContext.js';
import { ToastProvider } from './contexts/ToastContext.js';
import { FloatingLayoutProvider } from './contexts/FloatingLayoutContext.js';
import { AdminAuthProvider, useAdminAuth, AdminLogin } from './admin/AdminAuth.js';
import { AdminLayout } from './admin/AdminLayout.js';
import { SplashLoader } from './components/SplashLoader.js';

// Lazy imports for chunk splitting
const LandingPage = lazy(() => import('./pages/LandingPage.js').then(m => ({ default: m.LandingPage })));
const ChatPage = lazy(() => import('./pages/ChatPage.js').then(m => ({ default: m.ChatPage })));
const AboutPage = lazy(() => import('./pages/AboutPage.js').then(m => ({ default: m.AboutPage })));
const FaqPage = lazy(() => import('./pages/FaqPage.js').then(m => ({ default: m.FaqPage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage.js').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/TermsPage.js').then(m => ({ default: m.TermsPage })));
const ContactPage = lazy(() => import('./pages/ContactPage.js').then(m => ({ default: m.ContactPage })));
const ContentHubPage = lazy(() => import('./pages/ContentHubPage.js').then(m => ({ default: m.ContentHubPage })));
const TagPage = lazy(() => import('./pages/TagPage.js').then(m => ({ default: m.TagPage })));
const DynamicSeoPage = lazy(() => import('./pages/DynamicSeoPage.js').then(m => ({ default: m.DynamicSeoPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.js').then(m => ({ default: m.NotFoundPage })));

// Admin Lazy Imports
const Dashboard = lazy(() => import('./admin/pages/Dashboard.js').then(m => ({ default: m.Dashboard })));
const LiveOperations = lazy(() => import('./admin/pages/LiveOperations.js').then(m => ({ default: m.LiveOperations })));
const AdminCampus = lazy(() => import('./admin/pages/CampusAnalytics.js').then(m => ({ default: m.CampusAnalytics })));
const NotificationsAdmin = lazy(() => import('./admin/pages/Notifications.js').then(m => ({ default: m.NotificationsAdmin })));
const Growth = lazy(() => import('./admin/pages/Growth.js').then(m => ({ default: m.Growth })));
const Product = lazy(() => import('./admin/pages/Product.js').then(m => ({ default: m.Product })));

function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAdminAuth();
  if (!token) return <AdminLogin />;
  return <>{children}</>;
}

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<SplashLoader />}>
      {children}
    </Suspense>
  );
}

const router = createBrowserRouter([
  {
    path: "/admin",
    element: (
      <AdminAuthProvider>
        <ProtectedAdminRoute>
          <SuspenseWrapper>
            <AdminLayout />
          </SuspenseWrapper>
        </ProtectedAdminRoute>
      </AdminAuthProvider>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: "growth", element: <Growth /> },
      { path: "product", element: <Product /> },
      { path: "campus", element: <AdminCampus /> },
      { path: "notifications", element: <NotificationsAdmin /> },
      { path: "operations", element: <LiveOperations /> }
    ]
  },
  {
    element: <SuspenseWrapper><Layout /></SuspenseWrapper>,
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
