import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../utils/index.js';
import logoKaboom from '../../images/logo_kaboom.png';
import iconKaboom from '../../images/icon_kaboom.png';

const NAV_LINKS = [
  { to: '/',        label: 'Home' },
  { to: '/about',   label: 'About' },
  { to: '/faq',     label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
];

interface NavbarProps {
  /** When true: transparent background, no border, pointer-events passthrough on bg */
  isTransparent?: boolean;
}

export function Navbar({ isTransparent = false }: NavbarProps) {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {/* ── HEADER ───────────────────────────────────────────── */}
      <header
        className={cn(
          'app-header',
          isTransparent ? 'app-header--transparent' : 'glass border-b border-white/5'
        )}
      >
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-full">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-[14px] group shrink-0">
            <img 
              src={iconKaboom} 
              alt="Kaboom TV Icon" 
              className="object-contain rounded-[10px] transition-transform duration-300 group-hover:scale-105" 
              style={{ width: 'clamp(28px, 3vw, 44px)', height: 'clamp(28px, 3vw, 44px)' }}
            />
            <div className="hidden min-[375px]:flex items-center justify-center p-[4px_8px] rounded-[14px] bg-transparent transition-all duration-300 hover:shadow-[0_0_15px_rgba(255,255,255,0.08)] group-hover:scale-[1.02] shrink-0">
              <img 
                src={logoKaboom} 
                alt="Kaboom TV Logo" 
                className="w-auto object-contain shrink-0"
                style={{ height: 'clamp(24px, 2.5vw, 44px)' }}
              />
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 whitespace-nowrap',
                  location.pathname === link.to
                    ? 'text-white bg-white/10'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/chat"
              className="btn-primary text-sm px-4 py-2 ml-2 rounded-xl"
              id="nav-start-chat"
            >
              Start Chat
            </Link>
          </nav>

          {/* Mobile: Start Chat + Hamburger */}
          <div className="flex lg:hidden items-center gap-2">
            <Link
              to="/chat"
              className="btn-primary text-sm px-3 py-2 rounded-xl"
              id="nav-start-chat-mobile"
            >
              Start Chat
            </Link>
            <button
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="flex flex-col gap-[5px] p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <span className="w-5 h-0.5 bg-white/80 rounded-full block" />
              <span className="w-5 h-0.5 bg-white/80 rounded-full block" />
              <span className="w-5 h-0.5 bg-white/80 rounded-full block" />
            </button>
          </div>

        </div>
      </header>

      {/* ── MOBILE DRAWER BACKDROP ─────────────────────────── */}
      <div
        className={cn('mobile-drawer-backdrop', drawerOpen && 'mobile-drawer-backdrop--open')}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* ── MOBILE DRAWER ──────────────────────────────────── */}
      <nav
        className={cn('mobile-drawer', drawerOpen && 'mobile-drawer--open')}
        aria-label="Mobile navigation"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-lg font-semibold text-white/90">Menu</span>
          <button
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="4" x2="16" y2="16" />
              <line x1="16" y1="4" x2="4" y2="16" />
            </svg>
          </button>
        </div>

        {/* Drawer links */}
        {NAV_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            onClick={() => setDrawerOpen(false)}
            className={cn(
              'flex items-center px-4 py-3 rounded-xl text-base font-medium transition-colors duration-150',
              location.pathname === link.to
                ? 'text-white bg-white/10'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            )}
          >
            {link.label}
          </Link>
        ))}

        <div className="mt-auto pt-6 border-t border-white/10">
          <Link
            to="/chat"
            onClick={() => setDrawerOpen(false)}
            className="btn-primary w-full text-center text-sm py-3"
          >
            Start Chat
          </Link>
        </div>
      </nav>
    </>
  );
}
