import { Outlet, useLocation } from 'react-router-dom';
import { Footer } from './Footer.js';
import { Navbar } from './Navbar.js';
import { ToastContainer } from './ToastContainer.js';
import { cn } from '../utils/index.js';

export function Layout() {
  const location = useLocation();
  const isChatPage = location.pathname === '/chat';

  return (
    <div className={cn("min-h-screen flex flex-col bg-surface", isChatPage && "h-[100dvh] overflow-hidden")}>
      {!isChatPage && <Navbar />}
      {isChatPage && (
        <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
          <Navbar isTransparent={true} />
        </div>
      )}
      <ToastContainer />
      <main className={cn("flex-1 flex flex-col min-h-0", !isChatPage && "pt-16")}>
        <Outlet />
      </main>
      {!isChatPage && <Footer />}
    </div>
  );
}
