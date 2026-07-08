import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { SessionProvider } from './contexts/SessionContext.js';
import { ToastProvider } from './contexts/ToastContext.js';
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

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <SessionProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/topics" element={<ContentHubPage />} />
              <Route path="/topics/:category" element={<ContentHubPage />} />
              <Route path="/tag/:tagName" element={<TagPage />} />
              <Route path="/:seoSlug" element={<DynamicSeoPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </SessionProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
