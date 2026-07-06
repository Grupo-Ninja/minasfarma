
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, DollarSign, CheckSquare, Square, Filter, CheckCircle, X } from 'lucide-react';
import { PixEntry } from '../types';
import { getPixEntries, createPix, updatePixStatus, deletePix } from '../api';
import Pagination from './Pagination';
import { useFeedback } from './Feedback';

interface PixManagementProps {
  isAdmin?: boolean;
}

const PixManagement: React.FC<PixManagementProps> = ({ isAdmin = false }) => {
  const { confirm, notify } = useFeedback();
  const [filterDate, setFilterDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [entries, setEntries] = useState<PixEntry[]>([]);

  const [newEntry, setNewEntry] = useState({
    valor: '',
    observacao: '',
    data: new Date().toISOString().split('T')[0]
  });

  // Paginação (server-side)
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [sumValor, setSumValor] = useState(0);

  // Lista servida pelo servidor (já filtrada/paginada)
  const filteredEntries = entries;

  // Fetch Pix Entries
  const fetchEntries = async (p = page) => {
    try {
      const res = await getPixEntries({ page: p, page_size: pageSize, date: filterDate || undefined });
      const mapped = (res.items || []).map((item: any) => ({
        id: item.id.toString(),
        data: item.data_transacao ? item.data_transacao.split('T')[0] : '',
        valor: item.valor,
        observacao: item.observacao,
        status: item.status
      }));
      setEntries(mapped);
      setTotal(res.total || 0);
      setPages(res.pages || 0);
      setSumValor(res.summary?.sum_valor || 0);
    } catch (err) {
      console.error("Erro ao buscar Pix", err);
    }
  };

  // Volta para página 1 ao trocar o filtro de data
  useEffect(() => { setPage(1); }, [filterDate]);
  // Busca ao mudar página/filtro; limpa seleção
  useEffect(() => { fetchEntries(page); setSelectedIds(new Set()); }, [page, filterDate]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.valor) return;

    try {
      await createPix({
        valor: parseFloat(newEntry.valor),
        observacao: newEntry.observacao,
        data_transacao: newEntry.data
      });
      await fetchEntries();
      setNewEntry({ ...newEntry, valor: '', observacao: '' });
      notify('Pix lançado.', 'success');
    } catch (err) {
      notify("Erro ao lançar Pix", 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: 'Excluir Pix', message: 'Deseja excluir este lançamento de Pix?', confirmText: 'Excluir', danger: true });
    if (!ok) return;
    try {
      await deletePix(parseInt(id));
      await fetchEntries();
      const newSelected = new Set(selectedIds);
      newSelected.delete(id);
      setSelectedIds(newSelected);
      notify('Pix excluído.', 'success');
    } catch (err) {
      notify("Erro ao excluir Pix", 'error');
    }
  };

  // Bulk Selection Logic
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntries.map(e => e.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkAction = async (action: 'CONCILIAR' | 'DESCONCILIAR' | 'EXCLUIR') => {
    if (action === 'CONCILIAR') {
      try {
        for (const id of selectedIds) {
          await updatePixStatus(parseInt(id), 'Conciliado');
        }
        await fetchEntries();
        setSelectedIds(new Set());
        notify('Itens conciliados.', 'success');
      } catch (err) {
        notify("Erro ao conciliar itens", 'error');
      }
    } else if (action === 'DESCONCILIAR') {
      try {
        for (const id of selectedIds) {
          await updatePixStatus(parseInt(id), 'Pendente');
        }
        await fetchEntries();
        setSelectedIds(new Set());
        notify('Itens desconciliados.', 'success');
      } catch (err) {
        notify("Erro ao desconciliar itens", 'error');
      }
    } else if (action === 'EXCLUIR') {
      const ok = await confirm({ title: 'Excluir selecionados', message: `Excluir ${selectedIds.size} lançamento(s) de Pix?`, confirmText: 'Excluir', danger: true });
      if (!ok) return;
      try {
        for (const id of selectedIds) {
          await deletePix(parseInt(id));
        }
        await fetchEntries();
        setSelectedIds(new Set());
        notify('Itens excluídos.', 'success');
      } catch (err) {
        notify("Erro ao excluir itens", 'error');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0A1E35]">Gestão de Pix Recebidos</h2>
          <p className="text-slate-500">Controle e conciliação de transferências instantâneas.</p>
        </div>

        {/* Header Actions & Filter */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex-1 md:flex-none flex items-center bg-white border border-slate-300 rounded-lg px-3 py-2 shadow-sm transition-all focus-within:ring-2 focus-within:ring-[#0A1E35] focus-within:border-transparent">
            <Filter className="w-4 h-4 text-slate-400 mr-2" />
            <span className="text-sm font-bold text-slate-600 mr-2 hidden md:inline">Data:</span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="text-sm bg-transparent outline-none font-medium text-[#0A1E35] w-full"
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="ml-2 p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                title="Limpar filtro"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="bg-[#D4C4A8] text-[#0A1E35] px-4 py-2 rounded-lg font-bold flex flex-col md:flex-row md:items-center gap-1 md:gap-2 shadow-sm text-center">
            <span className="text-[10px] md:text-xs uppercase tracking-wide opacity-75">{filterDate ? 'Total Dia' : 'Total'}</span>
            <span className="text-sm md:text-base">R$ {sumValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 sticky top-6">
            <h3 className="font-bold text-[#0A1E35] mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Plus className="w-5 h-5 text-[#D4C4A8]" /> Novo Lançamento
            </h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Data</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="date"
                    required
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-[#0A1E35] focus:border-[#0A1E35] text-sm font-medium outline-none transition-all"
                    value={newEntry.data}
                    onChange={e => setNewEntry({ ...newEntry, data: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Valor (R$)</label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0,00"
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-[#0A1E35] focus:border-[#0A1E35] text-sm font-medium outline-none transition-all"
                    value={newEntry.valor}
                    onChange={e => setNewEntry({ ...newEntry, valor: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Observação</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 bg-white text-slate-900 rounded-lg focus:ring-2 focus:ring-[#0A1E35] focus:border-[#0A1E35] text-sm font-medium outline-none transition-all"
                  placeholder="Ex: Venda #123 - Cliente Ana"
                  value={newEntry.observacao}
                  onChange={e => setNewEntry({ ...newEntry, observacao: e.target.value })}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#0A1E35] hover:bg-[#162F4D] text-[#D4C4A8] font-bold py-3 px-4 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 transform active:scale-[0.98]"
              >
                <Plus size={18} /> Adicionar Pix
              </button>
            </form>
          </div>
        </div>

        {/* List Column */}
        <div className="lg:col-span-2 space-y-4">

          {/* Bulk Action Bar - Only Visible when items are selected AND user is admin */}
          {isAdmin && selectedIds.size > 0 && (
            <div className="bg-[#0A1E35] text-white px-4 py-3 rounded-lg flex items-center justify-between shadow-lg animate-fade-in border-b-4 border-[#D4C4A8]">
              <span className="font-bold text-sm pl-2">{selectedIds.size} selecionado(s)</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkAction('EXCLUIR')}
                  className="px-3 py-1.5 text-xs font-bold bg-white/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 rounded transition-colors"
                >
                  Excluir
                </button>
                <button
                  onClick={() => handleBulkAction('DESCONCILIAR')}
                  className="px-3 py-1.5 text-xs font-bold bg-white/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 rounded transition-colors"
                >
                  Desconciliar
                </button>
                <button
                  onClick={() => handleBulkAction('CONCILIAR')}
                  className="px-4 py-1.5 text-xs font-bold bg-[#D4C4A8] hover:bg-[#E5D5B9] text-[#0A1E35] rounded flex items-center gap-1 transition-colors shadow-sm"
                >
                  <CheckCircle size={14} /> Conciliar
                </button>
              </div>
            </div>
          )}

          {/* Responsive List Container */}
          <div>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {filteredEntries.length === 0 ? (
                <div className="text-center p-8 text-slate-400 bg-white rounded-lg border border-slate-200">
                  <p>Nenhum lançamento encontrado.</p>
                </div>
              ) : (
                filteredEntries.map(entry => {
                  const isSelected = selectedIds.has(entry.id);
                  return (
                    <div key={entry.id} className={`p-4 rounded-xl border transition-all ${isSelected ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-200 shadow-sm'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          <button onClick={() => toggleSelect(entry.id)} className="text-[#0A1E35]">
                            {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                          </button>
                          <div>
                            <span className="font-bold text-[#0A1E35] text-lg block">R$ {entry.valor.toFixed(2)}</span>
                            <span className="text-xs text-slate-500">{new Date(entry.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                          </div>
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold border ${entry.status === 'Conciliado'
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                          {entry.status}
                        </span>
                      </div>
                      <div className="pl-8 flex justify-between items-center">
                        <p className="text-sm text-slate-700">{entry.observacao}</p>
                        {isAdmin && (
                          <button onClick={() => handleDelete(entry.id)} className="text-slate-400 hover:text-rose-600">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <button
                        onClick={toggleSelectAll}
                        className="text-[#0A1E35] hover:text-[#162F4D] transition-colors"
                      >
                        {selectedIds.size > 0 && selectedIds.size === filteredEntries.length ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Valor / Info</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <Filter size={32} className="opacity-20" />
                          <p className="text-sm font-medium">Nenhum lançamento encontrado{filterDate ? ' para esta data' : ''}.</p>
                          {filterDate && (
                            <button onClick={() => setFilterDate('')} className="text-xs text-[#0A1E35] font-bold hover:underline">
                              Limpar filtro
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((entry) => {
                      const isSelected = selectedIds.has(entry.id);
                      return (
                        <tr key={entry.id} className={`transition-colors ${isSelected ? 'bg-[#0A1E35]/5' : 'hover:bg-slate-50'}`}>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => toggleSelect(entry.id)}
                              className={`transition-colors ${isSelected ? 'text-[#0A1E35]' : 'text-slate-300 hover:text-slate-500'}`}
                            >
                              {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                            </button>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-[#0A1E35] text-base">R$ {entry.valor.toFixed(2)}</span>
                              <span className="text-xs text-slate-500">{entry.observacao}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-slate-400">ID: {entry.id}</span>
                                {!filterDate && (
                                  <span className="text-[10px] bg-slate-100 px-1.5 rounded text-slate-500">
                                    {new Date(entry.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${entry.status === 'Conciliado'
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              : entry.status === 'Rejeitado'
                                ? 'bg-rose-100 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}>
                              {entry.status === 'Conciliado' && <CheckCircle size={10} className="mr-1" />}
                              {entry.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right">
                            {isAdmin && (
                              <button
                                onClick={() => handleDelete(entry.id)}
                                className="text-slate-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-full transition-colors"
                                title="Excluir"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <Pagination page={page} pages={pages} total={total} pageSize={pageSize} onPageChange={setPage} />
            </div>

            {/* Paginação mobile */}
            <div className="md:hidden bg-white rounded-xl border border-slate-200 overflow-hidden">
              <Pagination page={page} pages={pages} total={total} pageSize={pageSize} onPageChange={setPage} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PixManagement;
