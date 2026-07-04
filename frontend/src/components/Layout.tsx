import { Outlet, useLocation } from 'react-router-dom';
import { Footer } from './Footer.js';
import { Navbar } from './Navbar.js';
import { ToastContainer } from './ToastContainer.js';

export function Layout() {
  const { pathname } = useLocation();
  const isChatPage = pathname === '/chat';

  return (
    <div className={isChatPage ? 'layout-immersive' : 'min-h-dvh flex flex-col'}>

      {/* ── HEADER (always first in DOM) ── */}
      <Navbar isTransparent={isChatPage} />

      {/* ── TOAST LAYER ── */}
      <div className="toast-layer" aria-live="polite">
        <ToastContainer />
      </div>

      {/* ── MAIN CONTENT ── */}
      <main
        className={isChatPage
          ? 'absolute inset-0 flex flex-col'
          : 'main-content flex-1'
        }
        role="main"
      >
        <Outlet />
      </main>

      {/* ── FOOTER (hidden during chat) ── */}
      {!isChatPage && <Footer />}

    </div>
  );
}
