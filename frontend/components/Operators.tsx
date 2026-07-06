
import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Edit, Trash2, Shield, User, Lock, RefreshCw, X, Check, AlertCircle } from 'lucide-react';
import { getUsers, createUser, updateUser, deleteUser, reactivateUser } from '../api';
import { useFeedback } from './Feedback';

interface UserData {
    id: number;
    login: string;
    nome: string;
    cargo: string;
    active: boolean;
}

const Operators: React.FC = () => {
    const { confirm, notify } = useFeedback();
    const [users, setUsers] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingUser, setEditingUser] = useState<UserData | null>(null);
    const [formData, setFormData] = useState({ nome: '', login: '', cargo: 'operador', senha: '' });
    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Carregar usuários
    const loadUsers = async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await getUsers();
            setUsers(data);
        } catch (err: any) {
            setError('Erro ao carregar usuários. Verifique se você tem permissão de administrador.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    // Filtrar usuários
    const filteredUsers = users.filter(user =>
        user.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.login.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Abrir modal para novo usuário
    const handleNewUser = () => {
        setIsEditMode(false);
        setEditingUser(null);
        setFormData({ nome: '', login: '', cargo: 'operador', senha: '' });
        setFormError('');
        setIsModalOpen(true);
    };

    // Abrir modal para editar usuário
    const handleEdit = (user: UserData) => {
        setIsEditMode(true);
        setEditingUser(user);
        setFormData({ nome: user.nome, login: user.login, cargo: user.cargo, senha: '' });
        setFormError('');
        setIsModalOpen(true);
    };

    // Salvar usuário (criar ou editar)
    const handleSave = async () => {
        setFormError('');

        if (!formData.nome || !formData.login) {
            setFormError('Nome e login são obrigatórios.');
            return;
        }

        if (!isEditMode && !formData.senha) {
            setFormError('Senha é obrigatória para novos usuários.');
            return;
        }

        setIsSaving(true);
        try {
            if (isEditMode && editingUser) {
                const updateData: any = {
                    nome: formData.nome,
                    login: formData.login,
                    cargo: formData.cargo,
                };
                // Apenas envia senha se foi preenchida
                if (formData.senha) {
                    updateData.senha = formData.senha;
                }
                await updateUser(editingUser.id, updateData);
            } else {
                await createUser({
                    nome: formData.nome,
                    login: formData.login,
                    cargo: formData.cargo,
                    senha: formData.senha,
                });
            }
            setIsModalOpen(false);
            loadUsers();
        } catch (err: any) {
            const message = err.response?.data?.detail || 'Erro ao salvar usuário.';
            setFormError(message);
        } finally {
            setIsSaving(false);
        }
    };

    // Desativar usuário
    const handleDelete = async (user: UserData) => {
        const ok = await confirm({
            title: 'Remover da equipe',
            message: `Deseja remover "${user.nome || user.login}" da equipe? A escala dele também será excluída.`,
            confirmText: 'Remover',
            danger: true,
        });
        if (!ok) return;

        try {
            await deleteUser(user.id);
            notify('Funcionário removido da equipe.', 'success');
            loadUsers();
        } catch (err: any) {
            notify(err.response?.data?.detail || 'Erro ao desativar usuário.', 'error');
        }
    };

    // Reativar usuário
    const handleReactivate = async (user: UserData) => {
        try {
            await reactivateUser(user.id);
            notify('Funcionário reativado.', 'success');
            loadUsers();
        } catch (err: any) {
            notify(err.response?.data?.detail || 'Erro ao reativar usuário.', 'error');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 text-[#0A1E35] animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 p-4 rounded-lg flex items-center gap-3">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
                <button onClick={loadUsers} className="ml-auto text-sm underline">Tentar novamente</button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-[#0A1E35]">Gestão de Operadores</h2>
                    <p className="text-slate-500">Cadastre e gerencie o acesso dos funcionários.</p>
                </div>
                <button
                    onClick={handleNewUser}
                    className="bg-[#0A1E35] hover:bg-[#162F4D] text-[#D4C4A8] px-6 py-3 rounded-lg font-bold shadow-lg shadow-blue-900/20 flex items-center gap-2 transition-all"
                >
                    <UserPlus size={20} />
                    Novo Operador
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar operador..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 bg-white text-slate-900 rounded-lg text-sm focus:ring-2 focus:ring-[#0A1E35] outline-none"
                        />
                    </div>
                    <button onClick={loadUsers} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                        <RefreshCw size={18} />
                    </button>
                </div>

                <div className="overflow-x-auto">
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
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                                        Nenhum usuário encontrado.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user.id} className={`hover:bg-slate-50 transition-colors ${!user.active ? 'opacity-50' : ''}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                                                    {user.nome?.charAt(0) || user.login.charAt(0)}
                                                </div>
                                                <div>
                                                    <span className="block text-sm font-medium text-[#0A1E35]">{user.nome || '-'}</span>
                                                    <span className="text-xs text-slate-400">@{user.login}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${user.cargo === 'admin' ? 'bg-[#0A1E35] text-[#D4C4A8] border-[#0A1E35]' : 'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}>
                                                {user.cargo === 'admin' ? <Shield size={10} /> : <User size={10} />}
                                                {user.cargo === 'admin' ? 'Admin' : 'Operador'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${user.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {user.active ? (
                                                    <>
                                                        <Check size={10} />
                                                        Ativo
                                                    </>
                                                ) : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleEdit(user)}
                                                className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-full"
                                                title="Editar"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            {user.active ? (
                                                <button
                                                    onClick={() => handleDelete(user)}
                                                    className="text-rose-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-full"
                                                    title="Desativar"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleReactivate(user)}
                                                    className="text-emerald-500 hover:text-emerald-700 p-2 hover:bg-emerald-50 rounded-full"
                                                    title="Reativar"
                                                >
                                                    <RefreshCw size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Criar/Editar */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-4 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-[#0A1E35]">
                                {isEditMode ? 'Editar Operador' : 'Novo Operador'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {formError && (
                                <div className="bg-rose-50 border border-rose-200 text-rose-600 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    {formError}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-[#0A1E35]"
                                    value={formData.nome}
                                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Login</label>
                                <div className="relative">
                                    <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                    <input
                                        type="text"
                                        className="w-full pl-9 pr-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-[#0A1E35]"
                                        value={formData.login}
                                        onChange={e => setFormData({ ...formData, login: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Função</label>
                                <select
                                    className="w-full px-4 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-[#0A1E35]"
                                    value={formData.cargo}
                                    onChange={e => setFormData({ ...formData, cargo: e.target.value })}
                                >
                                    <option value="operador">Operador</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {isEditMode ? 'Nova Senha (deixe em branco para manter)' : 'Senha'}
                                </label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                    <input
                                        type="password"
                                        className="w-full pl-9 pr-3 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-[#0A1E35]"
                                        value={formData.senha}
                                        onChange={e => setFormData({ ...formData, senha: e.target.value })}
                                        placeholder={isEditMode ? 'Deixe em branco para manter a senha atual' : 'Mínimo 6 caracteres'}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
                                    disabled={isSaving}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex-1 px-4 py-2 bg-[#0A1E35] text-[#D4C4A8] rounded-lg hover:bg-[#162F4D] font-bold disabled:opacity-50"
                                >
                                    {isSaving ? 'Salvando...' : 'Salvar'}
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
