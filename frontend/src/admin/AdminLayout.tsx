import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdminAuth } from './AdminAuth';
import { 
  BarChart3, 
  Users, 
  MapPin, 
  GraduationCap, 
  Tags, 
  Smartphone, 
  Video, 
  Clock, 
  ShieldAlert, 
  Settings,
  LogOut
} from './Icons.js';

const NAV_ITEMS = [
  { path: '', label: 'Dashboard', icon: BarChart3, exact: true },
  { path: 'live', label: 'Live Activity', icon: Users },
  { path: 'locations', label: 'Locations', icon: MapPin },
  { path: 'campus', label: 'Campus Analytics', icon: GraduationCap },
  { path: 'tags', label: 'Tags', icon: Tags },
  { path: 'devices', label: 'Devices', icon: Smartphone },
  { path: 'matches', label: 'Matches', icon: Video },
  { path: 'queue', label: 'Queue', icon: Clock },
  { path: 'reports', label: 'Reports', icon: ShieldAlert },
  { path: 'settings', label: 'Settings', icon: Settings },
];

export function AdminLayout() {
  const { logout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center text-sm shadow-lg shadow-blue-500/20">
              💥
            </div>
            <span className="text-white font-bold tracking-wide">Admin V2</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) => 
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-blue-500/10 text-blue-400' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-rose-400 transition-colors px-2 py-1 w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Topbar (Mobile mainly) */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900/50 md:hidden">
           <span className="text-white font-bold">Admin V2</span>
           <button onClick={handleLogout} className="text-slate-400"><LogOut className="w-5 h-5"/></button>
        </header>
        
        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6 md:p-8 bg-slate-950">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
