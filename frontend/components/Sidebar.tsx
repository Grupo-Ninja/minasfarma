
import React from 'react';
import { LayoutDashboard, FileCheck, DollarSign, LogOut, Users, User, Wallet, X } from 'lucide-react';
import { AppRoute } from '../types';

interface SidebarProps {
    currentRoute: AppRoute;
    onNavigate: (route: AppRoute) => void;
    isAdmin: boolean;
    userName: string;
    onLogout: () => void;
    isOpen: boolean;
    onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentRoute, onNavigate, isAdmin, userName, onLogout, isOpen, onClose }) => {
    const menuItems = [
        { id: AppRoute.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
        { id: AppRoute.CONFERENCE, label: 'Fechamento de Caixa', icon: FileCheck },
        { id: AppRoute.SANGRIA, label: 'Sangrias', icon: Wallet },
        { id: AppRoute.PIX, label: 'Gestão de Pix', icon: DollarSign },
    ];

    if (isAdmin) {
        menuItems.push({ id: AppRoute.OPERATORS, label: 'Operadores', icon: Users });
    }

    const overlayClass = isOpen ? "fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity" : "hidden";

    const sidebarClass = `
    fixed top-0 left-0 h-screen bg-[#0A1E35] text-white w-64 shadow-2xl z-50 transition-transform duration-300 ease-in-out
    ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
    md:translate-x-0 md:static md:h-screen flex flex-col
  `;

    const handleLogoutClick = () => {
        if (window.confirm('Tem certeza que deseja sair do sistema?')) {
            onLogout();
        }
    };

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
                    <div className="w-20 h-20 mb-3 rounded-full overflow-hidden border-2 border-[#D4C4A8] shadow-lg bg-[#162F4D] flex items-center justify-center">
                        <span className="text-[#D4C4A8] text-2xl font-bold">MF</span>
                    </div>
                    <h1 className="text-lg font-bold text-[#D4C4A8] tracking-wide">
                        Minas Farma
                    </h1>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Sistema de Gestão</p>
                </div>

                {/* User Info */}
                <div className="px-4 py-3 border-b border-[#1A3350] bg-[#0D2440]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#D4C4A8] flex items-center justify-center text-[#0A1E35] font-bold">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{userName}</p>
                            <p className="text-xs text-slate-400">{isAdmin ? 'Administrador' : 'Operador'}</p>
                        </div>
                    </div>
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
                                    if (window.innerWidth < 768) onClose();
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${isActive
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

                {/* Footer with Logout */}
                <div className="p-4 bg-[#08182A] mt-auto border-t border-[#1A3350]">
                    <button
                        onClick={handleLogoutClick}
                        className="w-full flex items-center gap-3 px-4 py-3 text-rose-400 hover:bg-rose-900/20 rounded-lg transition-colors group"
                    >
                        <LogOut size={20} className="group-hover:text-rose-300" />
                        <span className="font-medium text-sm group-hover:text-rose-300">Sair do Sistema</span>
                    </button>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
