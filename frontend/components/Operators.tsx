
import React, { useState } from 'react';
import { UserPlus, Search, Edit, Trash2, Shield, User, Lock } from 'lucide-react';
import { Operator } from '../types';

const Operators: React.FC = () => {
  const [operators, setOperators] = useState<Operator[]>([
    { id: 1, name: 'Tais Monteiro Guimarães', role: 'Operador', active: true, login: 'tais.monteiro' },
    { id: 2, name: 'Carlos Lima', role: 'Operador', active: true, login: 'carlos.lima' },
    { id: 3, name: 'Ana Paula', role: 'Admin', active: true, login: 'ana.admin' },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newOp, setNewOp] = useState({ name: '', role: 'Operador', login: '', password: '' });

  const handleAdd = () => {
    if (!newOp.name || !newOp.login || !newOp.password) return;
    setOperators([...operators, { 
        id: Date.now(), 
        name: newOp.name, 
        role: newOp.role as 'Admin' | 'Operador', 
        active: true,
        login: newOp.login,
        password: newOp.password
    }]);
    setIsModalOpen(false);
    setNewOp({ name: '', role: 'Operador', login: '', password: '' });
  };

  const handleToggleStatus = (id: number) => {
    setOperators(operators.map(op => op.id === id ? { ...op, active: !op.active } : op));
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0A1E35]">Gestão de Operadores</h2>
          <p className="text-slate-500">Cadastre e gerencie o acesso dos funcionários.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#0A1E35] hover:bg-[#162F4D] text-[#D4C4A8] px-6 py-3 rounded-lg font-bold shadow-lg shadow-blue-900/20 flex items-center gap-2 transition-all"
        >
          <UserPlus size={20} />
          Novo Operador
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
           <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input type="text" placeholder="Buscar operador..." className="w-full pl-10 pr-4 py-2 border border-slate-200 bg-white text-slate-900 rounded-lg text-sm focus:ring-2 focus:ring-[#0A1E35] outline-none" />
           </div>
        </div>
        <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold">
                <tr>
                    <th className="px-6 py-4">Nome / Login</th>
                    <th className="px-6 py-4">Função</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {operators.map(op => (
                    <tr key={op.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                                    {op.name.charAt(0)}
                                </div>
                                <div>
                                    <span className="block text-sm font-medium text-[#0A1E35]">{op.name}</span>
                                    <span className="text-xs text-slate-400">@{op.login}</span>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                             <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                op.role === 'Admin' ? 'bg-[#0A1E35] text-[#D4C4A8] border-[#0A1E35]' : 'bg-slate-100 text-slate-600 border-slate-200'
                             }`}>
                                {op.role === 'Admin' ? <Shield size={10} /> : <User size={10} />}
                                {op.role}
                             </span>
                        </td>
                        <td className="px-6 py-4">
                             <button onClick={() => handleToggleStatus(op.id)} className={`relative w-10 h-5 rounded-full transition-colors ${op.active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                <div className={`absolute w-3 h-3 bg-white rounded-full top-1 transition-transform ${op.active ? 'left-6' : 'left-1'}`}></div>
                             </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                             <button className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-full">
                                <Edit size={16} />
                             </button>
                             <button className="text-rose-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-full">
                                <Trash2 size={16} />
                             </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* Simple Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-lg font-bold text-[#0A1E35] mb-4">Novo Operador</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                        <input 
                            type="text" 
                            className="w-full px-4 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-[#0A1E35]" 
                            value={newOp.name}
                            onChange={e => setNewOp({...newOp, name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Função</label>
                        <select 
                            className="w-full px-4 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-[#0A1E35]"
                            value={newOp.role}
                            onChange={e => setNewOp({...newOp, role: e.target.value})}
                        >
                            <option value="Operador">Operador</option>
                            <option value="Admin">Administrador</option>
                        </select>
                    </div>
                    
                    <div className="pt-2 border-t border-slate-100 mt-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Credenciais de Acesso</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Login</label>
                                <div className="relative">
                                    <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                    <input 
                                        type="text" 
                                        className="w-full pl-9 pr-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-[#0A1E35]" 
                                        value={newOp.login}
                                        onChange={e => setNewOp({...newOp, login: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                    <input 
                                        type="password" 
                                        className="w-full pl-9 pr-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-[#0A1E35]" 
                                        value={newOp.password}
                                        onChange={e => setNewOp({...newOp, password: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-6">
                        <button 
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleAdd}
                            className="flex-1 px-4 py-2 bg-[#0A1E35] text-[#D4C4A8] rounded-lg hover:bg-[#162F4D] font-bold"
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Operators;
