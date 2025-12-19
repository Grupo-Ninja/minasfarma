
import React, { useState } from 'react';
import { Menu } from 'lucide-react'; // Import Menu icon for mobile trigger
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Conference from './components/Conference';
import PixManagement from './components/PixManagement';
import Operators from './components/Operators';
import SangriaList from './components/SangriaList';
import Login from './components/Login';
import { AppRoute } from './types';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(AppRoute.DASHBOARD);
  const [isAdmin, setIsAdmin] = useState(true); // Default to Admin for demo
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar state

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  const renderContent = () => {
    switch (currentRoute) {
      case AppRoute.DASHBOARD:
        return <Dashboard onNavigate={setCurrentRoute} />;
      case AppRoute.CONFERENCE:
        return <Conference />;
      case AppRoute.PIX:
        return <PixManagement />;
      case AppRoute.SANGRIA:
        return <SangriaList />;
      case AppRoute.OPERATORS:
        // Simple protection: if not admin, show dashboard
        return isAdmin ? <Operators /> : <Dashboard onNavigate={setCurrentRoute} />;
      default:
        return <Dashboard onNavigate={setCurrentRoute} />;
    }
  };

  const handleRoleToggle = () => {
    setIsAdmin(!isAdmin);
    // If switching to non-admin and currently on restricted page, go home
    if (isAdmin && currentRoute === AppRoute.OPERATORS) {
      setCurrentRoute(AppRoute.DASHBOARD);
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden">
      <Sidebar 
        currentRoute={currentRoute} 
        onNavigate={setCurrentRoute} 
        isAdmin={isAdmin}
        onToggleRole={handleRoleToggle}
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
             <div className="w-8 h-8 rounded-full bg-[#D4C4A8] overflow-hidden">
                <img src="https://instagram.fbfh15-1.fna.fbcdn.net/v/t51.2885-19/449031776_444993341719433_772636051678077359_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby40NTEuYzIifQ&_nc_ht=instagram.fbfh15-1.fna.fbcdn.net&_nc_cat=105&_nc_oc=Q6cZ2QGQjiEaWoOkVQgBLaCf-LuKGQYCeSGLFt1Zr_rEWksUzh9g6TU2uIWq3s6Sws6k9o0rOGo91IvLiSPc0cWQ7Ps8&_nc_ohc=zLBU_c0bWD0Q7kNvwHwQzjw&_nc_gid=dJfhDSdihA8hujbqn3EkZA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AfnObzyV6auMvuKlnegSO87dYq72-0sWxb6qiH8tNo9wdQ&oe=693FD43D&_nc_sid=7a9f4b" alt="Logo" className="w-full h-full object-cover" />
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
