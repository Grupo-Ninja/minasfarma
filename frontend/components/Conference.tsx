
import React, { useState, useEffect, useMemo } from 'react';
import {
  Upload, FileText, AlertTriangle, CheckCircle, Save,
  ArrowDownCircle, ArrowUpCircle, Plus, Search, ChevronRight, Check, X, FileCheck, Printer, Calendar,
  RefreshCw, Shield, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { Trash2 } from 'lucide-react';
import { ClosingData, PaymentMethod, Movement } from '../types';
import { getClosings, getClosing, uploadClosingPDFs, createClosingFromPDFs, approveClosing, rejectClosing, unapproveClosing, deleteClosing, getMe } from '../api';
import Pagination from './Pagination';
import { useDebounce } from '../useDebounce';

type ViewState = 'LIST' | 'UPLOAD' | 'CONFERENCE' | 'DETAIL';

interface ConferenceProps {
  isAdmin?: boolean;
}

const Conference: React.FC<ConferenceProps> = ({ isAdmin: propIsAdmin }) => {
  const [view, setView] = useState<ViewState>('LIST');
  const [data, setData] = useState<ClosingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedClosing, setSelectedClosing] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(propIsAdmin || false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Verificar se é admin
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const user = await getMe();
        setCurrentUser(user);
        setIsAdmin(user.cargo === 'admin');
      } catch (e) {
        console.error('Erro ao verificar usuário:', e);
      }
    };
    checkAdmin();
  }, []);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);

  // Paginação (server-side)
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [sumQuebra, setSumQuebra] = useState(0);

  const closingFilters = () => ({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  });

  // Fetch History (paginado + filtrado no servidor; lista LEVE sem movimentos/conferencias)
  const fetchHistory = async (p = page) => {
    setIsLoading(true);
    try {
      const res = await getClosings({ page: p, page_size: pageSize, ...closingFilters() });
      const mapped = (res.items || []).map((item: any) => ({
        id: item.id,
        operador: item.operador_nome || `Operador #${item.operador_id}`,
        operador_id: item.operador_id,
        data: item.data_referencia,
        status: item.status,
        quebra: item.total_quebra,
      }));
      setHistory(mapped);
      setTotal(res.total || 0);
      setPages(res.pages || 0);
      setSumQuebra(res.summary?.sum_quebra || 0);
    } catch (error) {
      console.error("Erro ao buscar fechamentos", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Volta p/ página 1 quando filtros mudam
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, startDate, endDate]);
  // Busca ao entrar na lista ou mudar página/filtros
  useEffect(() => {
    if (view === 'LIST') fetchHistory(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, page, debouncedSearch, statusFilter, startDate, endDate]);

  // Upload State
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');

  // Expanded movement for description editing
  const [expandedMovementId, setExpandedMovementId] = useState<number | null>(null);

  const resetUpload = () => {
    setFile1(null);
    setFile2(null);
    setIsLoading(false);
    setUploadError('');
  };

  const handleLaunch = async () => {
    if (!file1 || !file2) return;
    setIsLoading(true);
    setUploadError('');

    try {
      const result = await uploadClosingPDFs(file1, file2);
      if (result.success) {
        setData(result.data);
        setView('CONFERENCE');
      } else {
        setUploadError(result.message || 'Erro ao processar PDFs');
      }
    } catch (err: any) {
      console.error("Erro no upload:", err);
      setUploadError(err.response?.data?.detail || 'Erro ao processar os PDFs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToList = () => {
    if (view === 'CONFERENCE' && !window.confirm("Deseja sair? Dados não salvos serão perdidos.")) {
      return;
    }
    setView('LIST');
    setData(null);
    setSelectedClosing(null);
    resetUpload();
  };

  // Confirmar envio do fechamento (operador)
  const handleConfirmClosing = async () => {
    if (!data) return;
    setIsLoading(true);

    try {
      const payload = {
        data_referencia: data.operadorInfo?.dataFechamento || data.operadorInfo?.data || new Date().toISOString(),
        operador_nome: data.operadorInfo?.operador || '',
        caixa: data.operadorInfo?.caixa || '',
        movimentos: data.movimentos || [],
        conferencia: data.conferencia || [],
        total_quebra: totals.quebraTotal
      };

      const result = await createClosingFromPDFs(payload);
      if (result.success) {
        alert('Fechamento enviado para aprovação do gerente!');
        setView('LIST');
        setData(null);
        resetUpload();
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao salvar fechamento');
    } finally {
      setIsLoading(false);
    }
  };

  // Aprovar fechamento (admin)
  const handleApprove = async (id: number) => {
    if (!window.confirm('Deseja aprovar este fechamento?')) return;
    try {
      // Enviar conferências editadas (se o admin alterou algum valor oficial)
      const conferenciasEditadas = data?.conferencia?.map(c => ({
        forma_pagamento: c.forma,
        valor_oficial: c.oficial,
        diferenca: c.diferenca,
        justificativa: c.justificativa
      }));

      await approveClosing(id, { conferencias: conferenciasEditadas });
      alert('Fechamento aprovado com sucesso!');
      fetchHistory();
      setView('LIST');
      setSelectedClosing(null);
      setData(null);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao aprovar');
    }
  };


  // ... (existing helper types/interfaces)

  // Rejeitar fechamento (admin)
  const handleReject = async (id: number) => {
    const motivo = window.prompt('Informe o motivo da rejeição:');
    if (!motivo) return;
    try {
      await rejectClosing(id, motivo);
      alert('Fechamento rejeitado.');
      fetchHistory();
      setView('LIST');
      setSelectedClosing(null);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao rejeitar');
    }
  };

  const handleUnapprove = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja desaprovar este fechamento? Ele voltará para o status Pendente.')) return;
    try {
      await unapproveClosing(id);
      fetchHistory();
      alert('Fechamento retornado para Pendente.');
    } catch (err: any) {
      alert('Erro ao desaprovar fechamento');
    }
  };

  const handleDeleteClosing = async (id: number) => {
    if (!window.confirm('ATENÇÃO: Isso excluirá permanentemente o fechamento e todas as sangrias associadas. Continuar?')) return;
    try {
      await deleteClosing(id);
      fetchHistory();
      alert('Fechamento excluído com sucesso.');
    } catch (err: any) {
      alert('Erro ao excluir fechamento');
    }
  };

  // Ver detalhes de um fechamento (busca o fechamento COMPLETO por id — a lista é leve)
  const handleViewDetail = async (item: any) => {
    setSelectedClosing(item);
    setView('DETAIL');
    setIsLoading(true);
    try {
      const full = await getClosing(item.id);
      const closingData: ClosingData = {
        operadorInfo: {
          operador: item.operador,
          data: item.data,
          caixa: '',
          valoresIniciais: { abertura: 0, fundoTroco: 0 }
        },
        movimentos: (full.movimentos || []).map((m: any, idx: number) => ({
          id: idx + 1,
          historico: m.historico,
          moeda: m.moeda,
          obs: m.historico,
          tipo: m.tipo,
          valor: m.valor,
          descricao: m.descricao || ''
        })),
        conferencia: (full.conferencias || []).map((c: any) => ({
          forma: c.forma_pagamento,
          informado: c.valor_informado,
          calculado: c.valor_calculado,
          oficial: c.valor_oficial,
          diferenca: c.diferenca,
          justificativa: c.justificativa || ''
        }))
      };
      setData(closingData);
    } catch (err) {
      console.error('Erro ao carregar detalhes do fechamento', err);
      alert('Erro ao carregar detalhes do fechamento.');
      setView('LIST');
    } finally {
      setIsLoading(false);
    }
  };

  // A lista já vem filtrada/paginada do servidor
  const filteredHistory = history;

  const handlePrintReport = async () => {
    // Para o relatório, busca TODOS os registros que casam com o filtro (não só a página)
    let rows = filteredHistory;
    try {
      const res = await getClosings({ page: 1, page_size: 1000, ...closingFilters() });
      rows = (res.items || []).map((item: any) => ({
        id: item.id,
        operador: item.operador_nome || `Operador #${item.operador_id}`,
        data: item.data_referencia,
        status: item.status,
        quebra: item.total_quebra,
      }));
    } catch (e) {
      console.error('Erro ao gerar relatório completo, usando página atual', e);
    }
    const totalQuebra = rows.reduce((acc, item) => acc + item.quebra, 0);
    const reportContent = `
      <html>
        <head>
          <title>Relatório de Fechamentos - Minas Farma</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>body { font-family: 'Inter', sans-serif; } @media print { @page { margin: 20px; } }</style>
        </head>
        <body class="bg-white p-8">
          <div class="border-b-2 border-[#0A1E35] pb-6 mb-6">
            <h1 class="text-3xl font-bold text-[#0A1E35]">Minas Farma - Relatório de Fechamentos</h1>
            <p class="text-sm text-gray-500">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
          </div>
          <table class="w-full text-left border-collapse">
            <thead><tr class="bg-gray-100 text-xs uppercase text-gray-600">
              <th class="px-4 py-3 border-b">Data</th>
              <th class="px-4 py-3 border-b">Operador</th>
              <th class="px-4 py-3 border-b text-center">Status</th>
              <th class="px-4 py-3 border-b text-right">Quebra</th>
            </tr></thead>
            <tbody>
              ${rows.map(item => `
                <tr class="border-b">
                  <td class="px-4 py-3">${new Date(item.data).toLocaleDateString('pt-BR')}</td>
                  <td class="px-4 py-3 font-bold">${item.operador}</td>
                  <td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded text-xs font-bold ${item.status === 'Aprovado' ? 'bg-green-100 text-green-800' : item.status === 'Pendente' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}">${item.status}</span></td>
                  <td class="px-4 py-3 text-right font-bold ${item.quebra < 0 ? 'text-red-600' : 'text-green-600'}">${item.quebra === 0 ? 'OK' : item.quebra.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot><tr class="bg-gray-50 border-t-2">
              <td colspan="3" class="px-4 py-3 text-right font-bold">Total Quebra:</td>
              <td class="px-4 py-3 text-right font-bold ${totalQuebra < 0 ? 'text-red-600' : 'text-green-600'}">${totalQuebra.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            </tr></tfoot>
          </table>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(reportContent);
      printWindow.document.close();
    }
  };

  // --- Logic for Conference Table ---
  const handleOfficialValueChange = (index: number, valueStr: string) => {
    if (!data) return;
    const newValue = parseFloat(valueStr) || 0;
    const newData = { ...data };
    const method = newData.conferencia[index];
    method.oficial = newValue;
    method.diferenca = Number((newValue - method.calculado).toFixed(2));
    setData(newData);
  };

  const handleJustificationChange = (index: number, text: string) => {
    if (!data) return;
    const newData = { ...data };
    newData.conferencia[index].justificativa = text;
    setData(newData);
  };

  // Handler para descrição de movimentos (sangrias)
  const handleMovementDescriptionChange = (movId: number, text: string) => {
    if (!data) return;
    const newData = { ...data };
    const movIndex = newData.movimentos.findIndex(m => m.id === movId);
    if (movIndex >= 0) {
      newData.movimentos[movIndex].descricao = text;
      setData(newData);
    }
  };

  const totals = useMemo(() => {
    if (!data) return { entradas: 0, saidas: 0, quebraTotal: 0 };
    const entradas = data.movimentos.filter(m => m.tipo === 'Entrada').reduce((acc, curr) => acc + curr.valor, 0);
    const saidas = data.movimentos.filter(m => m.tipo === 'Saída').reduce((acc, curr) => acc + curr.valor, 0);
    const quebraTotal = data.conferencia.reduce((acc, curr) => acc + Math.abs(curr.diferenca), 0);
    return { entradas, saidas, quebraTotal };
  }, [data]);

  const isFormValid = useMemo(() => {
    if (!data) return false;
    return data.conferencia.every(method => {
      const diff = Math.abs(method.diferenca);
      if (diff > 3.00) return method.justificativa.trim().length > 3;
      return true;
    });
  }, [data]);

  // --- RENDERERS ---

  if (view === 'LIST') {
    return (
      <div className="space-y-6 animate-fade-in pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#0A1E35]">Histórico de Fechamentos</h2>
            <p className="text-slate-500">Gerencie e audite os fechamentos de caixa.</p>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <button
              onClick={handlePrintReport}
              className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 px-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Printer size={18} />
              Relatório PDF
            </button>
            <button
              onClick={() => { resetUpload(); setView('UPLOAD'); }}
              className="bg-[#0A1E35] hover:bg-[#162F4D] text-[#D4C4A8] px-6 py-3 rounded-lg font-bold shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 transition-all"
            >
              <Plus size={20} />
              Inserir Novo
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50">
            <div className="relative flex-1 w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por operador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 bg-white text-slate-900 rounded-lg text-sm focus:ring-2 focus:ring-[#0A1E35] outline-none transition-shadow"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="">Todos</option>
                <option value="Pendente">Pendentes</option>
                <option value="Aprovado">Aprovados</option>
                <option value="Rejeitado">Rejeitados</option>
              </select>

              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                <Calendar size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-500">De:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-sm text-[#0A1E35] font-medium outline-none bg-transparent"
                />
              </div>
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                <span className="text-xs font-bold text-slate-500">Até:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-sm text-[#0A1E35] font-medium outline-none bg-transparent"
                />
              </div>

              <button onClick={() => fetchHistory(page)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg" title="Atualizar">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              Carregando...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold">
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Operador</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Quebra</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.length > 0 ? (
                    filteredHistory.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 group transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {new Date(item.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-[#0A1E35]">{item.operador}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${item.status === 'Aprovado' ? 'bg-emerald-100 text-emerald-700' :
                            item.status === 'Pendente' ? 'bg-amber-100 text-amber-700' :
                              'bg-rose-100 text-rose-700'
                            }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-right text-sm font-bold ${item.quebra < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {item.quebra === 0 ? 'OK' : `R$ ${item.quebra.toFixed(2)}`}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleViewDetail(item)}
                              className="text-slate-400 hover:text-[#0A1E35] p-2 hover:bg-slate-200 rounded-full transition-colors"
                              title="Ver detalhes"
                            >
                              <ChevronRight size={18} />
                            </button>

                            {isAdmin && item.status === 'Pendente' && (
                              <>
                                <button
                                  onClick={() => handleApprove(item.id)}
                                  className="text-emerald-500 hover:text-emerald-700 p-2 hover:bg-emerald-50 rounded-full"
                                  title="Aprovar"
                                >
                                  <ThumbsUp size={16} />
                                </button>
                                <button
                                  onClick={() => handleReject(item.id)}
                                  className="text-rose-500 hover:text-rose-700 p-2 hover:bg-rose-50 rounded-full"
                                  title="Rejeitar"
                                >
                                  <ThumbsDown size={16} />
                                </button>
                              </>
                            )}

                            {isAdmin && (item.status === 'Aprovado' || item.status === 'Rejeitado') && (
                              <button
                                onClick={() => handleUnapprove(item.id)}
                                className="text-amber-500 hover:text-amber-700 p-2 hover:bg-amber-50 rounded-full"
                                title="Desaprovar (Voltar para Pendente)"
                              >
                                <RefreshCw size={16} />
                              </button>
                            )}

                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteClosing(item.id)}
                                className="text-slate-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-full transition-colors"
                                title="Excluir Permanentemente"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        Nenhum fechamento encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <Pagination page={page} pages={pages} total={total} pageSize={pageSize} onPageChange={setPage} />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'UPLOAD') {
    return (
      <div className="max-w-3xl mx-auto py-8 animate-fade-in">
        <button onClick={() => setView('LIST')} className="text-slate-500 hover:text-[#0A1E35] mb-6 flex items-center gap-2 text-sm font-medium transition-colors">
          ← Voltar para lista
        </button>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-[#0A1E35] p-8 text-center">
            <div className="w-16 h-16 bg-[#D4C4A8] text-[#0A1E35] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Upload size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Novo Fechamento de Caixa</h2>
            <p className="text-slate-300">Faça upload dos PDFs do sistema da farmácia.</p>
          </div>

          <div className="p-8 space-y-8">
            {uploadError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 p-4 rounded-lg flex items-center gap-3">
                <AlertTriangle size={20} />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Step 1 */}
            <div className={`transition-all duration-300 ${file1 ? 'opacity-50 grayscale' : 'opacity-100'}`}>
              <label className="block text-sm font-bold text-[#0A1E35] mb-2 uppercase tracking-wide">1. Relatório CAIXA (PDF)</label>
              <div className="relative group">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => e.target.files && setFile1(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className={`border-2 border-dashed rounded-xl p-6 flex items-center gap-4 transition-colors ${file1 ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 group-hover:border-[#0A1E35] group-hover:bg-slate-50'}`}>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${file1 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    {file1 ? <Check size={24} /> : <FileText size={24} />}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{file1 ? file1.name : "Ex: CAIXA 180.pdf"}</p>
                    <p className="text-xs text-slate-500">{file1 ? "Arquivo carregado" : "Clique para selecionar"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className={`transition-all duration-300 ${!file1 ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
              <label className="block text-sm font-bold text-[#0A1E35] mb-2 uppercase tracking-wide">2. Relatório DIFERENÇA (PDF)</label>
              <div className="relative group">
                <input
                  type="file"
                  accept=".pdf"
                  disabled={!file1}
                  onChange={(e) => e.target.files && setFile2(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className={`border-2 border-dashed rounded-xl p-6 flex items-center gap-4 transition-colors ${file2 ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 group-hover:border-[#0A1E35] group-hover:bg-slate-50'}`}>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${file2 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    {file2 ? <Check size={24} /> : <FileCheck size={24} />}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{file2 ? file2.name : "Ex: 180 DIFERENÇA.pdf"}</p>
                    <p className="text-xs text-slate-500">{file2 ? "Arquivo carregado" : "Faça upload do primeiro arquivo"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={handleLaunch}
                disabled={!file1 || !file2 || isLoading}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-3 transition-all ${!file1 || !file2
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#0A1E35] text-[#D4C4A8] hover:bg-[#162F4D] transform hover:-translate-y-1'
                  }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-[#D4C4A8] border-t-transparent rounded-full animate-spin"></div>
                    Processando PDFs...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    Processar e Conferir
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // View === 'CONFERENCE' or 'DETAIL'
  const isDetailView = view === 'DETAIL';
  // Operador pode editar durante criação, Admin pode editar em detalhes pendentes
  const canEdit = !isDetailView || (isAdmin && selectedClosing?.status === 'Pendente');
  const canApprove = isAdmin && isDetailView && selectedClosing?.status === 'Pendente';

  return (
    <div className="space-y-6 pb-24 animate-fade-in">
      {/* Top Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={handleBackToList} className="text-slate-500 hover:text-rose-600 flex items-center gap-2 text-sm font-medium transition-colors">
          <X size={16} /> <span className="hidden md:inline">{isDetailView ? 'Voltar para Lista' : 'Cancelar Conferência'}</span>
        </button>
        <div className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${isDetailView ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-800'
          }`}>
          {isDetailView ? (
            <>
              <Shield size={12} />
              Visualização
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              Nova Conferência
            </>
          )}
        </div>
      </div>

      {/* Header Info */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#D4C4A8]"></div>
        <div className="col-span-2 md:col-span-1">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Operador</label>
          <p className="font-bold text-[#0A1E35] text-lg">{data?.operadorInfo.operador}</p>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data</label>
          <p className="font-medium text-slate-700">{data?.operadorInfo.data}</p>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Caixa Nº</label>
          <p className="font-medium text-slate-700">{data?.operadorInfo.caixa || '-'}</p>
        </div>
        {isDetailView && selectedClosing && (
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</label>
            <p className={`font-bold ${selectedClosing.status === 'Aprovado' ? 'text-emerald-600' :
              selectedClosing.status === 'Pendente' ? 'text-amber-600' : 'text-rose-600'
              }`}>{selectedClosing.status}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Movements Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-[#0A1E35]">Movimentações</h3>
              <span className="text-[10px] bg-[#0A1E35] text-white px-2 py-1 rounded uppercase tracking-wide">Do PDF</span>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[400px] custom-scrollbar">
              <table className="w-full">
                <tbody className="divide-y divide-slate-100">
                  {data?.movimentos && data.movimentos.length > 0 ? (
                    data.movimentos.map((mov) => {
                      const isExpanded = expandedMovementId === mov.id;
                      const isSaida = mov.tipo === 'Saída';

                      return (
                        <tr key={mov.id} className="hover:bg-slate-50">
                          <td colSpan={2} className="py-0 px-0">
                            {/* Linha principal - clicável */}
                            <div
                              className={`py-3 px-4 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50' : ''}`}
                              onClick={() => setExpandedMovementId(isExpanded ? null : mov.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${mov.tipo === 'Entrada' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                                    {mov.tipo === 'Entrada' ? (
                                      <ArrowUpCircle size={14} className="text-emerald-600" />
                                    ) : (
                                      <ArrowDownCircle size={14} className="text-rose-600" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-bold text-slate-700">{mov.obs}</p>
                                      {isSaida && !mov.descricao && canEdit && (
                                        <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-medium">
                                          Clique para identificar
                                        </span>
                                      )}
                                      {mov.descricao && (
                                        <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                                          ✓ Identificado
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 uppercase">{mov.moeda}</p>
                                  </div>
                                </div>
                                <span className={`text-sm font-bold ${mov.tipo === 'Entrada' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {mov.tipo === 'Saída' && '- '} R$ {mov.valor.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            {/* Área expandida com input de descrição */}
                            {isExpanded && (
                              <div className="px-4 pb-3 animate-fade-in">
                                <div className="ml-11 p-3 bg-slate-100 rounded-lg border border-slate-200">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    {isSaida ? 'Identificar esta sangria' : 'Observação'}
                                  </label>
                                  <input
                                    type="text"
                                    placeholder={isSaida ? "Ex: Pago fornecedor XYZ, Depósito banco..." : "Adicione uma observação..."}
                                    value={mov.descricao || ''}
                                    onChange={(e) => handleMovementDescriptionChange(mov.id, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 bg-white rounded-md outline-none focus:ring-2 focus:ring-[#0A1E35] focus:border-[#0A1E35] transition-all"
                                    disabled={!canEdit}
                                    autoFocus
                                  />
                                  {mov.descricao && (
                                    <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                                      <CheckCircle size={10} /> Descrição salva
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={2} className="py-8 text-center text-slate-400 text-sm">
                        Nenhuma movimentação encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-2 gap-4">
              <div className="text-center p-2 bg-white rounded border border-slate-100">
                <span className="text-xs text-slate-400 block mb-1">Entradas</span>
                <span className="font-bold text-emerald-600">R$ {totals.entradas.toFixed(2)}</span>
              </div>
              <div className="text-center p-2 bg-white rounded border border-slate-100">
                <span className="text-xs text-slate-400 block mb-1">Saídas</span>
                <span className="font-bold text-rose-600">R$ {totals.saidas.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Conference Table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-[#0A1E35] flex justify-between items-center">
              <h3 className="font-bold text-white">Mesa de Conferência</h3>
              <span className="text-xs text-[#D4C4A8] italic hidden md:inline">
                {canEdit ? 'Preencha justificativas se necessário' : 'Valores do sistema da farmácia'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Forma Pagto</th>
                    <th className="px-4 py-3 text-right">Informado</th>
                    <th className="px-4 py-3 text-right">Sistema</th>
                    {canApprove && (
                      <th className="px-4 py-3 text-right bg-amber-50 border-b-2 border-amber-400">Oficial</th>
                    )}
                    <th className="px-4 py-3 text-right">Diferença</th>
                    <th className="px-4 py-3">Justificativa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.conferencia && data.conferencia.length > 0 ? (
                    data.conferencia.map((item, idx) => {
                      const isDiffCritical = Math.abs(item.diferenca) > 3.00;
                      const diffColor = item.diferenca === 0
                        ? 'text-emerald-600 bg-emerald-50'
                        : item.diferenca > 0
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-rose-600 bg-rose-50';

                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-4 text-sm font-bold text-[#0A1E35]">{item.forma}</td>
                          <td className="px-4 py-4 text-sm text-right text-slate-400">
                            {item.informado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td className="px-4 py-4 text-sm text-right font-medium text-slate-600">
                            {item.calculado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          {canApprove && (
                            <td className="px-4 py-4 text-right bg-amber-50/30">
                              <input
                                type="number"
                                step="0.01"
                                value={item.oficial}
                                onChange={(e) => handleOfficialValueChange(idx, e.target.value)}
                                className="w-28 text-right p-2 border border-amber-300 bg-white rounded-md text-sm font-bold text-[#0A1E35] focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none shadow-sm"
                              />
                            </td>
                          )}
                          <td className="px-4 py-4 text-right">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${diffColor}`}>
                              {item.diferenca.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </td>
                          <td className="px-4 py-4 relative">
                            {canEdit ? (
                              <input
                                type="text"
                                placeholder={isDiffCritical ? "Obrigatório" : "Opcional"}
                                value={item.justificativa}
                                onChange={(e) => handleJustificationChange(idx, e.target.value)}
                                className={`w-full p-2 text-sm border rounded-md outline-none transition-all ${isDiffCritical && !item.justificativa
                                  ? 'border-rose-300 bg-rose-50 placeholder:text-rose-400'
                                  : 'border-slate-200 bg-white text-slate-900'
                                  }`}
                              />
                            ) : canApprove ? (
                              <input
                                type="text"
                                placeholder="Adicionar justificativa..."
                                value={item.justificativa}
                                onChange={(e) => handleJustificationChange(idx, e.target.value)}
                                className="w-full p-2 text-sm border border-slate-200 bg-white rounded-md outline-none"
                              />
                            ) : (
                              <span className="text-sm text-slate-600">{item.justificativa || '-'}</span>
                            )}
                            {canEdit && isDiffCritical && !item.justificativa && (
                              <AlertTriangle className="absolute right-6 top-1/2 -translate-y-1/2 text-rose-400 w-4 h-4 pointer-events-none" />
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={canApprove ? 6 : 5} className="py-8 text-center text-slate-400 text-sm">
                        Nenhuma forma de pagamento encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary */}
            <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end items-center">
              <div className="flex flex-col items-end">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Quebra Total</p>
                <p className={`text-3xl font-extrabold ${totals.quebraTotal < 0 ? 'text-rose-600' : 'text-[#0A1E35]'}`}>
                  {totals.quebraTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Action Footer */}
      <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-white border-t border-slate-200 px-4 md:px-8 py-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-between items-center z-30">
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400 hidden md:block">
            {currentUser && <>Logado como: <span className="font-bold text-slate-700">{currentUser.nome}</span></>}
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto justify-end">
          <button
            onClick={handleBackToList}
            className="px-4 md:px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {isDetailView ? 'Voltar' : 'Cancelar'}
          </button>

          {canApprove && (
            <>
              <button
                onClick={() => handleReject(selectedClosing.id)}
                className="px-4 md:px-6 py-2.5 text-sm font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center gap-2"
              >
                <ThumbsDown size={16} />
                Rejeitar
              </button>
              <button
                onClick={() => handleApprove(selectedClosing.id)}
                className="px-4 md:px-8 py-2.5 text-sm font-bold rounded-lg shadow-xl flex items-center justify-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <ThumbsUp size={16} />
                Aprovar
              </button>
            </>
          )}

          {!isDetailView && (
            <button
              disabled={!isFormValid || isLoading}
              onClick={handleConfirmClosing}
              className={`flex-1 md:flex-none px-4 md:px-8 py-2.5 text-sm font-bold rounded-lg shadow-xl flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 ${isFormValid
                ? 'bg-[#0A1E35] text-[#D4C4A8] hover:bg-[#162F4D]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
            >
              <CheckCircle size={18} />
              <span className="hidden md:inline">Confirmar Fechamento</span>
              <span className="md:hidden">Confirmar</span>
            </button>
          )}
        </div>
      </div>

    </div>
  );
};

export default Conference;
