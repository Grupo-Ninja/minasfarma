import React, { useState } from 'react';
import { User, Lock, ArrowRight } from 'lucide-react';
import { login } from '../api';
import { LOGO_DATA_URI } from '../logoData';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data = await login(username, password);
      localStorage.setItem('token', data.access_token);
      onLogin();
    } catch (err: any) {
      console.error("Login Error:", err);
      setError('Usuário ou senha inválidos.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A1E35] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header / Logo Area */}
        <div className="bg-[#0f2947] p-8 text-center border-b border-[#D4C4A8]/20 relative">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border-4 border-[#D4C4A8] shadow-lg">
            <img
              src={LOGO_DATA_URI}
              alt="Minas Farma Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-2xl font-bold text-[#D4C4A8]">Minas Farma</h1>
          <p className="text-slate-400 text-sm mt-1 uppercase tracking-widest">Sistema de Gestão</p>
        </div>

        {/* Login Form */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-[#0A1E35] mb-2">Login</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A1E35] focus:border-transparent bg-white shadow-sm"
                  placeholder="Seu usuário"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#0A1E35] mb-2">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A1E35] focus:border-transparent bg-white shadow-sm"
                  placeholder="Sua senha"
                />
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-[#D4C4A8] bg-[#0A1E35] hover:bg-[#162F4D] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0A1E35] transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Entrando...' : (
                <>
                  Acessar Sistema
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
          <p className="text-xs text-slate-400">© 2025 Minas Farma Canaã - Todos os direitos reservados</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
