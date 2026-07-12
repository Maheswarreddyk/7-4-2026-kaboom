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

const router = createBrowserRouter([
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

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <SessionProvider>
          <FloatingLayoutProvider>
            <RouterProvider router={router} />
          </FloatingLayoutProvider>
        </SessionProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
