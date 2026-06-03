
import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Conference from './components/Conference';
import PixManagement from './components/PixManagement';
import Operators from './components/Operators';
import SangriaList from './components/SangriaList';
import Login from './components/Login';
import { AppRoute } from './types';
import { getMe, logout } from './api';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(AppRoute.DASHBOARD);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Verificar se já está logado ao carregar
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const user = await getMe();
          setIsAuthenticated(true);
          setIsAdmin(user.cargo === 'admin');
          setUserName(user.nome || user.login);
        } catch (err) {
          // Token inválido, limpar
          localStorage.removeItem('token');
        }
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  const handleLogin = async () => {
    try {
      const user = await getMe();
      setIsAuthenticated(true);
      setIsAdmin(user.cargo === 'admin');
      setUserName(user.nome || user.login);
    } catch (err) {
      console.error('Erro ao buscar usuário:', err);
    }
  };

  const handleLogout = () => {
    logout();
    setIsAuthenticated(false);
    setIsAdmin(false);
    setUserName('');
    setCurrentRoute(AppRoute.DASHBOARD);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A1E35] flex items-center justify-center">
        <div className="text-[#D4C4A8] text-xl">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (currentRoute) {
      case AppRoute.DASHBOARD:
        return <Dashboard onNavigate={setCurrentRoute} />;
      case AppRoute.CONFERENCE:
        return <Conference />;
      case AppRoute.PIX:
        return <PixManagement isAdmin={isAdmin} />;
      case AppRoute.SANGRIA:
        return <SangriaList isAdmin={isAdmin} />;
      case AppRoute.OPERATORS:
        return isAdmin ? <Operators /> : <Dashboard onNavigate={setCurrentRoute} />;
      default:
        return <Dashboard onNavigate={setCurrentRoute} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden">
      <Sidebar
        currentRoute={currentRoute}
        onNavigate={setCurrentRoute}
        isAdmin={isAdmin}
        userName={userName}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0 md:ml-0 overflow-hidden relative">
        {/* Mobile Header Trigger */}
        <div className="md:hidden bg-[#0A1E35] text-white p-4 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-[#D4C4A8]">
              <Menu size={24} />
            </button>
            <span className="font-bold">Minas Farma</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#D4C4A8] flex items-center justify-center text-[#0A1E35] font-bold text-sm">
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>

        <div className="flex-1 p-4 md:p-8 overflow-y-auto scroll-smooth">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
