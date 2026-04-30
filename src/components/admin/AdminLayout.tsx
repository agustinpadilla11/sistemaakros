import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Home, Users, CheckSquare, DollarSign, ShoppingBag, Receipt, LogOut, Wallet, Trophy, ShieldCheck, List } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function AdminLayout() {
  const { logout } = useAuth();
  
  const navItems = [
    { to: '/admin', icon: Home, label: 'Dashboard', exact: true },
    { to: '/admin/caja', icon: Wallet, label: 'Caja Diaria' },
    { to: '/admin/alumnas', icon: Users, label: 'Gimnastas' },
    { to: '/admin/grupos', icon: CheckSquare, label: 'Grupos' },
    { to: '/admin/cuotas', icon: DollarSign, label: 'Cuotas' },
    { to: '/admin/indumentaria', icon: ShoppingBag, label: 'Indumentaria' },
    { to: '/admin/federacion', icon: CheckSquare, label: 'Federación' },
    { to: '/admin/matricula', icon: Receipt, label: 'Matrícula' },
    { to: '/admin/seguro', icon: ShieldCheck, label: 'Seguro' },
    { to: '/admin/torneos', icon: Trophy, label: 'Torneos' },
  ];

  return (
    <div className="flex h-screen overflow-hidden font-sans text-slate-800 bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-purple-900 text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-purple-800/50 flex flex-col items-center justify-center min-h-[90px]">
          <p className="text-sm text-purple-200 uppercase tracking-widest text-center font-bold">Panel de Gestión</p>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-hide">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
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
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 relative">
          <div className="flex items-center space-x-4">
             <h2 className="text-sm font-bold uppercase tracking-tight text-slate-800 opacity-0">Panel</h2>
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <img src="/logo.png" alt="Akros" className="h-10 w-auto" />
          </div>

          <div className="flex items-center space-x-4">
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="bg-purple-100 text-purple-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Modo Administrador</div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full p-8 md:p-12 space-y-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
