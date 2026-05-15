import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Users, LogOut, FilePlus, Menu, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function PortalPadreLayout() {
  const { logout, userData } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const navItems = [
    { to: '/portal', icon: Users, label: 'Mis Hijas', exact: true },
    { to: '/portal/inscripcion', icon: FilePlus, label: 'Nueva Inscripción' },
  ];

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <div className="flex h-screen overflow-hidden font-sans text-slate-800 bg-slate-50">
      {/* Mobile Overlay */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-purple-900 text-white flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 shrink-0",
        isMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-purple-800/50 flex items-center justify-between min-h-[90px]">
          <p className="text-sm text-purple-200 uppercase tracking-widest font-bold">Portal Padre</p>
          <button onClick={() => setIsMenuOpen(false)} className="lg:hidden p-2 hover:bg-purple-800 rounded-lg">
            <X className="h-6 w-6" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-hide">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              onClick={() => setIsMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  "p-3 rounded-lg flex items-center space-x-3 cursor-pointer transition-colors",
                  isActive 
                    ? "bg-purple-800/50 border-l-4 border-white opacity-100" 
                    : "hover:bg-purple-800/30 opacity-70"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="text-sm font-semibold">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-6 border-t border-purple-800/50 bg-purple-950/30">
          <div className="mb-4">
            <p className="text-sm font-medium opacity-90 truncate">Hola, {userData?.nombre}</p>
            <p className="text-[10px] text-purple-300 uppercase tracking-widest mt-1">Tutor</p>
          </div>
          <button 
            onClick={() => logout()}
            className="flex w-full items-center text-sm font-medium hover:text-purple-300 transition-colors"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shrink-0 relative">
          <div className="flex items-center space-x-4">
            <button 
              onClick={toggleMenu}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h2 className="text-sm font-bold uppercase tracking-tight text-slate-800 hidden lg:block">Panel</h2>
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <img src="/logo.png" alt="Akros" className="h-8 lg:h-10 w-auto" />
          </div>

          <div className="flex items-center space-x-2 lg:space-x-4">
            <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
            <div className="bg-emerald-100 text-emerald-700 text-[9px] lg:text-[10px] font-bold px-2 lg:px-3 py-1 rounded-full uppercase tracking-wider">Acceso Restringido</div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full p-4 md:p-8 lg:p-12 space-y-6 lg:space-y-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

