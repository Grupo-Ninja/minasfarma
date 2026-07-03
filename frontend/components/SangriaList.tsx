
import React, { useState, useEffect } from 'react';
import { getSangrias, createSangria, deleteSangria, updateSangriaStatus } from '../api';
import { Wallet, Search, Filter, Calendar, Plus, ArrowDownFromLine, Trash2, CheckCircle, TicketX } from 'lucide-react';
import { SangriaRecord } from '../types';
import Pagination from './Pagination';
import { useDebounce } from '../useDebounce';

interface SangriaListProps {
    isAdmin?: boolean;
}

const SangriaList: React.FC<SangriaListProps> = ({ isAdmin = false }) => {
    const [filterDate, setFilterDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sangrias, setSangrias] = useState<SangriaRecord[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // New Sangria State
    const [newSangria, setNewSangria] = useState({
        valor: '',
        motivo: '',
        operador: ''
    });

    // Paginação (server-side)
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(0);
    const [sumValor, setSumValor] = useState(0);
    const debouncedSearch = useDebounce(searchTerm, 400);

    // API Integration
    const fetchSangrias = async (p = page) => {
        try {
            const res = await getSangrias({
                page: p, page_size: pageSize,
                search: debouncedSearch || undefined,
                date: filterDate || undefined,
            });
            const mapped = (res.items || []).map((item: any) => ({
                id: item.id.toString(),
                data: item.created_at ? item.created_at.split('T')[0] : '',
                valor: item.valor,
                motivo: item.motivo,
                operador: item.operador_nome || 'Operador #' + item.operador_id,
                status: item.status,
                origem: item.origem,
                closing_id: item.closing_id,
            }));
            setSangrias(mapped);
            setTotal(res.total || 0);
            setPages(res.pages || 0);
            setSumValor(res.summary?.sum_valor || 0);
        } catch (error) {
            console.error("Erro ao buscar sangrias:", error);
        }
    };

    // Volta para a página 1 quando um filtro muda
    useEffect(() => { setPage(1); }, [debouncedSearch, filterDate]);
    // Busca quando página ou filtros mudam
    useEffect(() => { fetchSangrias(page); }, [page, debouncedSearch, filterDate]);

    const totalSangrias = sumValor;

    const handleAdd = async () => {
        if (!newSangria.valor) return;

        try {
            await createSangria({
                valor: parseFloat(newSangria.valor),
                motivo: newSangria.motivo || 'Excesso de Caixa'
            });
            await fetchSangrias();
            setIsModalOpen(false);
            setNewSangria({ valor: '', motivo: '', operador: '' });
        } catch (err) {
            alert('Erro ao criar sangria');
        }
    };

    const handleDelete = async (id: string, origem: string) => {
        if (origem === 'Fechamento') {
            alert('Não é possível excluir sangria gerada automaticamente por fechamento de caixa.');
            return;
        }
        if (!window.confirm('Excluir sangria?')) return;

        try {
            await deleteSangria(parseInt(id));
            fetchSangrias();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao excluir sangria');
        }
    };

    const toggleStatus = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'Conciliado' ? 'Pendente' : 'Conciliado';
        try {
            await updateSangriaStatus(parseInt(id), newStatus);
            fetchSangrias();
        } catch (err) {
            alert('Erro ao alterar status');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Title Section */}
            <div>
                <h2 className="text-2xl font-bold text-[#0A1E35]">Controle de Sangrias</h2>
                <p className="text-slate-500">Monitoramento de retiradas de caixa por operador.</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Wallet size={48} className="text-[#0A1E35]" />
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                            <Wallet size={20} />
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total Retirado</span>
                    </div>
                    <p className="text-xl md:text-2xl font-bold text-[#0A1E35]">
                        {totalSangrias.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <ArrowDownFromLine size={48} className="text-amber-600" />
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                            <ArrowDownFromLine size={20} />
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Qtd. Sangrias</span>
                    </div>
                    <p className="text-xl md:text-2xl font-bold text-[#0A1E35]">
                        {total}
                    </p>
                </div>
            </div>

            {/* Toolbar - Desktop Optimized */}
            <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Buscar operador ou motivo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-transparent focus:bg-white focus:border-slate-200 rounded-lg text-sm text-[#0A1E35] focus:ring-2 focus:ring-[#0A1E35] outline-none transition-all"
                    />
                </div>

                {/* Date Filter */}
                <div className="flex items-center bg-slate-50 rounded-lg px-3 py-2 border border-transparent focus-within:bg-white focus-within:border-slate-200 focus-within:ring-2 focus-within:ring-[#0A1E35] transition-all">
                    <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="text-sm bg-transparent outline-none font-medium text-[#0A1E35] w-full md:w-32"
                    />
                    {filterDate && (
                        <button onClick={() => setFilterDate('')} className="ml-2 text-xs text-rose-500 font-bold hover:underline">
                            Limpar
                        </button>
                    )}
                </div>

                {/* Add Button */}
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-[#0A1E35] hover:bg-[#162F4D] text-[#D4C4A8] px-6 py-2.5 rounded-lg font-bold shadow-lg shadow-blue-900/10 flex items-center justify-center gap-2 transition-all whitespace-nowrap"
                >
                    <Plus size={18} />
                    Nova Sangria
                </button>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {sangrias.map((item) => (
                    <div key={item.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-1 h-full ${item.status === 'Conciliado' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-bold text-[#0A1E35] text-lg">{item.operador}</h3>
                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                    <Calendar size={12} /> {new Date(item.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                </p>
                            </div>
                            <span className="text-lg font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                                R$ {item.valor.toFixed(2)}
                            </span>
                        </div>

                        <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Motivo:</span>
                                <span className="font-medium text-slate-700">{item.motivo}</span>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${item.origem === 'Fechamento' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {item.origem}
                                </span>
                                {isAdmin && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => toggleStatus(item.id, item.status)}
                                            className={`p-2 rounded-full ${item.status === 'Conciliado' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-500'}`}
                                            title={item.status === 'Conciliado' ? 'Desconciliar' : 'Conciliar'}
                                        >
                                            {item.status === 'Conciliado' ? <CheckCircle size={16} /> : <div className="w-4 h-4 border-2 border-slate-400 rounded-full" />}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id, item.origem)}
                                            className={`p-2 rounded-full ${item.origem === 'Fechamento' ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-rose-50 text-rose-500 hover:bg-rose-100'}`}
                                            disabled={item.origem === 'Fechamento'}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop Table View - Optimized */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left table-fixed">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 w-40 text-xs uppercase text-slate-500 font-semibold tracking-wider">Data</th>
                            <th className="px-6 py-4 w-1/4 text-xs uppercase text-slate-500 font-semibold tracking-wider">Operador</th>
                            <th className="px-6 py-4 text-xs uppercase text-slate-500 font-semibold tracking-wider">Motivo</th>
                            <th className="px-6 py-4 w-32 text-xs uppercase text-slate-500 font-semibold tracking-wider text-center">Origem</th>
                            <th className="px-6 py-4 w-32 text-xs uppercase text-slate-500 font-semibold tracking-wider text-center">Status</th>
                            <th className="px-6 py-4 w-40 text-right text-xs uppercase text-slate-500 font-semibold tracking-wider">Valor</th>
                            {isAdmin && <th className="px-6 py-4 w-24 text-right text-xs uppercase text-slate-500 font-semibold tracking-wider">Ações</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sangrias.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Calendar size={14} className="text-slate-400" />
                                        <span className="text-sm font-medium">{new Date(item.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm font-bold text-[#0A1E35]">{item.operador}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm text-slate-600">{item.motivo}</span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${item.origem === 'Fechamento' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {item.origem}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${item.status === 'Conciliado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-600'}`}>
                                        {item.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                        R$ {item.valor.toFixed(2)}
                                    </span>
                                </td>
                                {isAdmin && (
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1">
                                            <button
                                                onClick={() => toggleStatus(item.id, item.status)}
                                                className={`p-1.5 rounded hover:bg-slate-100 ${item.status === 'Conciliado' ? 'text-emerald-600' : 'text-slate-400'}`}
                                                title={item.status === 'Conciliado' ? 'Desconciliar' : 'Conciliar'}
                                            >
                                                {item.status === 'Conciliado' ? <CheckCircle size={16} /> : <div className="w-4 h-4 border-2 border-slate-400 rounded-full" />}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id, item.origem)}
                                                className={`p-1.5 rounded ${item.origem === 'Fechamento' ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'}`}
                                                title="Excluir"
                                                disabled={item.origem === 'Fechamento'}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pagination page={page} pages={pages} total={total} pageSize={pageSize} onPageChange={setPage} />
            </div>

            {/* Paginação mobile */}
            <div className="md:hidden">
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <Pagination page={page} pages={pages} total={total} pageSize={pageSize} onPageChange={setPage} />
                </div>
            </div>

            {/* Modal Nova Sangria */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-[#0A1E35]">Nova Sangria</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500">
                                <span className="text-2xl">&times;</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-slate-500">
                                O operador será registrado automaticamente de acordo com o usuário logado.
                            </p>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0,00"
                                    className="w-full px-4 py-3 border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-[#0A1E35] text-lg font-bold"
                                    value={newSangria.valor}
                                    onChange={e => setNewSangria({ ...newSangria, valor: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Motivo</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Excesso de Caixa"
                                    className="w-full px-4 py-3 border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-[#0A1E35]"
                                    value={newSangria.motivo}
                                    onChange={e => setNewSangria({ ...newSangria, motivo: e.target.value })}
                                />
                            </div>

                            <button
                                onClick={handleAdd}
                                className="w-full mt-4 bg-[#0A1E35] text-[#D4C4A8] py-4 rounded-xl font-bold text-lg hover:bg-[#162F4D] transition-all"
                            >
                                Confirmar Sangria
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SangriaList;
