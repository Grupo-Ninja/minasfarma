
import React from 'react';
import { LayoutDashboard, FileCheck, DollarSign, LogOut, Users, Shield, User, Wallet, X } from 'lucide-react';
import { AppRoute } from '../types';

interface SidebarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  isAdmin: boolean;
  onToggleRole: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentRoute, onNavigate, isAdmin, onToggleRole, isOpen, onClose }) => {
  const menuItems = [
    { id: AppRoute.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { id: AppRoute.CONFERENCE, label: 'Fechamento de Caixa', icon: FileCheck },
    { id: AppRoute.SANGRIA, label: 'Sangrias', icon: Wallet },
    { id: AppRoute.PIX, label: 'Gestão de Pix', icon: DollarSign },
  ];

  if (isAdmin) {
    menuItems.push({ id: AppRoute.OPERATORS, label: 'Operadores', icon: Users });
  }

  // Mobile Overlay class
  const overlayClass = isOpen ? "fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity" : "hidden";
  
  // Sidebar Container class
  const sidebarClass = `
    fixed top-0 left-0 h-full bg-[#0A1E35] text-white w-64 shadow-2xl z-50 transition-transform duration-300 ease-in-out
    ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
    md:translate-x-0 md:static md:block flex flex-col
  `;

  return (
    <>
        {/* Mobile Overlay */}
        <div className={overlayClass} onClick={onClose}></div>

        <div className={sidebarClass}>
        {/* Close Button Mobile */}
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 md:hidden text-slate-400 hover:text-white"
        >
            <X size={24} />
        </button>

        {/* Brand Section */}
        <div className="p-6 border-b border-[#1A3350] flex flex-col items-center text-center">
            <div className="w-20 h-20 mb-3 rounded-full overflow-hidden border-2 border-[#D4C4A8] shadow-lg">
            <img 
                src="https://instagram.fbfh15-1.fna.fbcdn.net/v/t51.2885-19/449031776_444993341719433_772636051678077359_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby40NTEuYzIifQ&_nc_ht=instagram.fbfh15-1.fna.fbcdn.net&_nc_cat=105&_nc_oc=Q6cZ2QGQjiEaWoOkVQgBLaCf-LuKGQYCeSGLFt1Zr_rEWksUzh9g6TU2uIWq3s6Sws6k9o0rOGo91IvLiSPc0cWQ7Ps8&_nc_ohc=zLBU_c0bWD0Q7kNvwHwQzjw&_nc_gid=dJfhDSdihA8hujbqn3EkZA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AfnObzyV6auMvuKlnegSO87dYq72-0sWxb6qiH8tNo9wdQ&oe=693FD43D&_nc_sid=7a9f4b" 
                alt="Minas Farma Logo" 
                className="w-full h-full object-cover"
            />
            </div>
            <h1 className="text-lg font-bold text-[#D4C4A8] tracking-wide">
            Minas Farma
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Sistema de Gestão</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
            {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentRoute === item.id;
            return (
                <button
                key={item.id}
                onClick={() => {
                    onNavigate(item.id);
                    if(window.innerWidth < 768) onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                    isActive
                    ? 'bg-[#162F4D] text-[#D4C4A8] border-r-4 border-[#D4C4A8]'
                    : 'text-slate-400 hover:bg-[#11253E] hover:text-white'
                }`}
                >
                <Icon size={20} className={isActive ? 'text-[#D4C4A8]' : 'text-slate-500 group-hover:text-white'} />
                <span className="font-medium text-sm">{item.label}</span>
                </button>
            );
            })}
        </nav>

        {/* Role Switcher (Simulator) & Footer - Pushed to bottom with mt-auto */}
        <div className="p-4 bg-[#08182A] mt-auto border-t border-[#1A3350]">
            <div className="bg-[#11253E] rounded-lg p-3 mb-4 border border-[#1A3350]">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-2 text-center">Simular Perfil</p>
                <div className="flex bg-[#0A1E35] rounded p-1">
                    <button 
                        onClick={() => !isAdmin && onToggleRole()}
                        className={`flex-1 flex justify-center py-1 rounded text-xs transition-colors ${isAdmin ? 'bg-[#D4C4A8] text-[#0A1E35] font-bold shadow' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Shield size={12} className="mr-1" /> Admin
                    </button>
                    <button 
                        onClick={() => isAdmin && onToggleRole()}
                        className={`flex-1 flex justify-center py-1 rounded text-xs transition-colors ${!isAdmin ? 'bg-[#3B82F6] text-white font-bold shadow' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <User size={12} className="mr-1" /> Operador
                    </button>
                </div>
            </div>

            <button className="w-full flex items-center gap-3 px-4 py-3 text-rose-400 hover:bg-rose-900/10 rounded-lg transition-colors group">
            <LogOut size={20} className="group-hover:text-rose-300" />
            <span className="font-medium text-sm group-hover:text-rose-300">Sair do Sistema</span>
            </button>
        </div>
        </div>
    </>
  );
};

export default Sidebar;
