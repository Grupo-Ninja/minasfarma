import React, { useState, useEffect, useMemo } from 'react';
import {
    CalendarClock, UploadCloud, Sparkles, Save, Plus, Trash2, Sun, Moon,
    RefreshCw, AlertCircle, CheckCircle2, Eye, ArrowLeft, CalendarDays,
    Pencil, FileText, Users as UsersIcon, X,
} from 'lucide-react';
import {
    getScheduleSummaries, getAnchor, setAnchor as apiSetAnchor,
    extractSchedulePDF, saveSchedule, getUserSchedule,
    getIntegration, setIntegration,
} from '../api';
import { KeyRound, LayoutGrid } from 'lucide-react';
import { ScheduleSummary, ScheduleDay, WEEKDAY_LABELS } from '../types';
import MySchedule from './MySchedule';
import ScheduleOverview from './ScheduleOverview';

type TabId = 'geral' | 'funcionarios' | 'config';

type DraftDay = { is_work: boolean; shifts: { entrada: string; saida: string }[] };
type Draft = { num_weeks: number; grid: Record<number, Record<number, DraftDay>> };

const emptyDay = (): DraftDay => ({ is_work: false, shifts: [] });

const buildGrid = (num_weeks: number, days?: ScheduleDay[]): Draft => {
    const grid: Record<number, Record<number, DraftDay>> = {};
    for (let w = 1; w <= num_weeks; w++) {
        grid[w] = {};
        for (let d = 0; d < 7; d++) grid[w][d] = emptyDay();
    }
    (days || []).forEach(d => {
        if (d.week_index >= 1 && d.week_index <= num_weeks) {
            grid[d.week_index][d.weekday] = {
                is_work: d.is_work,
                shifts: (d.shifts || []).map(s => ({ entrada: s.entrada, saida: s.saida })),
            };
        }
    });
    return { num_weeks, grid };
};

const draftToDays = (draft: Draft): ScheduleDay[] => {
    const out: ScheduleDay[] = [];
    for (let w = 1; w <= draft.num_weeks; w++) {
        for (let d = 0; d < 7; d++) {
            const cell = draft.grid[w][d];
            out.push({
                week_index: w, weekday: d, is_work: cell.is_work,
                shifts: cell.is_work ? cell.shifts.filter(s => s.entrada && s.saida) : [],
            });
        }
    }
    return out;
};

const ScheduleAdmin: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = false }) => {
    const [tab, setTab] = useState<TabId>('geral');
    const [summaries, setSummaries] = useState<ScheduleSummary[]>([]);
    const [anchor, setAnchorState] = useState<string | null>(null);
    const [anchorInput, setAnchorInput] = useState('');
    const [anchorSaving, setAnchorSaving] = useState(false);
    const [anchorMsg, setAnchorMsg] = useState('');

    const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
    const [file, setFile] = useState<File | null>(null);
    const [extracting, setExtracting] = useState(false);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const [viewing, setViewing] = useState<{ id: number; name: string } | null>(null);

    // Integração OpenAI
    const [integration, setIntegrationState] = useState<{ configured: boolean; model: string; key_last4?: string | null; source?: string | null } | null>(null);
    const [keyInput, setKeyInput] = useState('');
    const [modelInput, setModelInput] = useState('gpt-4o');
    const [intSaving, setIntSaving] = useState(false);
    const [intMsg, setIntMsg] = useState('');

    const loadAll = async () => {
        setIsLoading(true);
        try {
            const [sums, anc, integ] = await Promise.all([getScheduleSummaries(), getAnchor(), getIntegration()]);
            setSummaries(sums);
            setAnchorState(anc.anchor_date || null);
            setAnchorInput(anc.anchor_date || '');
            setIntegrationState(integ);
            setModelInput(integ.model || 'gpt-4o');
        } catch (err) {
            setError('Erro ao carregar dados de escala.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveIntegration = async () => {
        setIntSaving(true); setIntMsg('');
        try {
            const payload: { api_key?: string | null; model?: string } = { model: modelInput };
            if (keyInput.trim()) payload.api_key = keyInput.trim();
            const res = await setIntegration(payload);
            setIntegrationState(res);
            setKeyInput('');
            setIntMsg('Configuração salva!');
            setTimeout(() => setIntMsg(''), 3500);
        } catch {
            setIntMsg('Erro ao salvar a configuração.');
        } finally {
            setIntSaving(false);
        }
    };

    useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin]);

    const selectedName = useMemo(
        () => summaries.find(s => s.user_id === selectedUserId)?.nome || '',
        [summaries, selectedUserId]
    );

    // ---------------- âncora ----------------
    const handleSaveAnchor = async () => {
        setAnchorSaving(true); setAnchorMsg('');
        try {
            const res = await apiSetAnchor(anchorInput || null);
            setAnchorState(res.anchor_date || null);
            setAnchorMsg('Data da Semana 1 salva! O sistema recalculou as jornadas de todos.');
            setTimeout(() => setAnchorMsg(''), 4000);
        } catch {
            setAnchorMsg('Erro ao salvar a data.');
        } finally {
            setAnchorSaving(false);
        }
    };

    // ---------------- extração / manual ----------------
    const resetDraft = () => { setDraft(null); setWarnings([]); setError(''); setSuccess(''); };

    const handleExtract = async () => {
        if (!selectedUserId) { setError('Selecione o funcionário desta escala.'); return; }
        if (!file) { setError('Escolha o PDF da escala.'); return; }
        setExtracting(true); setError(''); setSuccess('');
        try {
            const res = await extractSchedulePDF(file);
            setDraft(buildGrid(res.num_weeks || 4, res.days));
            setWarnings(res.warnings || []);
        } catch (err: any) {
            const detail = err.response?.data?.detail || 'Erro ao extrair a escala.';
            setError(detail + (err.response?.status === 503 ? ' Você pode preencher manualmente abaixo.' : ''));
        } finally {
            setExtracting(false);
        }
    };

    const handleManual = (userId?: number) => {
        const uid = userId ?? selectedUserId;
        if (!uid) { setError('Selecione o funcionário primeiro.'); return; }
        if (userId) setSelectedUserId(userId);
        setError(''); setSuccess('');
        setDraft(buildGrid(4));
        setWarnings([]);
    };

    const loadExistingForEdit = async (userId: number) => {
        setSelectedUserId(userId);
        setError(''); setSuccess('');
        try {
            const sch = await getUserSchedule(userId);
            setDraft(buildGrid(sch.num_weeks, sch.days));
            setWarnings([]);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
            setError('Erro ao carregar escala existente.');
        }
    };

    // ---------------- edição do draft ----------------
    const mutate = (fn: (g: Draft) => void) => {
        setDraft(prev => {
            if (!prev) return prev;
            const copy: Draft = { num_weeks: prev.num_weeks, grid: JSON.parse(JSON.stringify(prev.grid)) };
            fn(copy);
            return copy;
        });
    };

    const toggleWork = (w: number, d: number) => mutate(g => {
        const cell = g.grid[w][d];
        cell.is_work = !cell.is_work;
        if (cell.is_work && cell.shifts.length === 0) cell.shifts = [{ entrada: '', saida: '' }];
    });
    const addShift = (w: number, d: number) => mutate(g => { g.grid[w][d].shifts.push({ entrada: '', saida: '' }); });
    const removeShift = (w: number, d: number, i: number) => mutate(g => { g.grid[w][d].shifts.splice(i, 1); });
    const setShift = (w: number, d: number, i: number, key: 'entrada' | 'saida', val: string) =>
        mutate(g => { g.grid[w][d].shifts[i][key] = val; });
    const changeNumWeeks = (n: number) => {
        if (n < 1 || n > 8) return;
        setDraft(prev => {
            if (!prev) return prev;
            const days = draftToDays(prev);
            return buildGrid(n, days);
        });
    };

    const handleSave = async () => {
        if (!draft || !selectedUserId) return;
        setSaving(true); setError(''); setSuccess('');
        try {
            await saveSchedule({
                user_id: Number(selectedUserId),
                num_weeks: draft.num_weeks,
                source_filename: file?.name || null,
                days: draftToDays(draft),
            });
            setSuccess(`Escala de ${selectedName} salva com sucesso!`);
            setDraft(null); setFile(null); setWarnings([]);
            loadAll();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao salvar a escala.');
        } finally {
            setSaving(false);
        }
    };

    // ---------------- view mode (admin vê escala de alguém) ----------------
    if (viewing) {
        return (
            <div className="space-y-4 animate-fade-in">
                <button onClick={() => setViewing(null)} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#0A1E35]">
                    <ArrowLeft size={16} /> Voltar para Gestão de Escalas
                </button>
                <MySchedule targetUserId={viewing.id} targetName={viewing.name} />
            </div>
        );
    }

    // Funcionário (não-admin): vê apenas a própria escala
    if (!isAdmin) {
        return (
            <div className="max-w-6xl mx-auto">
                <MySchedule />
            </div>
        );
    }

    if (isLoading) {
        return <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 text-[#0A1E35] animate-spin" /></div>;
    }

    const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
        { id: 'geral', label: 'Escala Geral', icon: <LayoutGrid size={16} /> },
        { id: 'funcionarios', label: 'Funcionários', icon: <UsersIcon size={16} /> },
        { id: 'config', label: 'Configurações', icon: <CalendarDays size={16} /> },
    ];

    return (
        <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
            <div>
                <h2 className="text-2xl font-bold text-[#0A1E35] flex items-center gap-2"><CalendarClock /> Gestão de Escalas</h2>
                <p className="text-slate-500">Escala geral, cadastro/importação por funcionário e configurações.</p>
            </div>

            {/* Abas */}
            <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-[#0A1E35] text-[#0A1E35]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* Aba: Escala Geral */}
            {tab === 'geral' && <ScheduleOverview />}

            {/* Aba: Configurações */}
            {tab === 'config' && (<>
            {/* Âncora global */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-1">
                    <CalendarDays className="text-[#0A1E35]" size={20} />
                    <h3 className="font-bold text-[#0A1E35]">Data da Semana 1 (global)</h3>
                </div>
                <p className="text-sm text-slate-500 mb-4">
                    Defina uma data que representa a <b>Semana 1</b> para <b>todos</b> os funcionários. A partir dela o sistema
                    recalcula automaticamente o ciclo de cada um.
                </p>
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Início da Semana 1</label>
                        <input type="date" value={anchorInput} onChange={e => setAnchorInput(e.target.value)}
                            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#0A1E35] outline-none" />
                    </div>
                    <button onClick={handleSaveAnchor} disabled={anchorSaving}
                        className="px-5 py-2 bg-[#0A1E35] text-[#D4C4A8] rounded-lg font-bold hover:bg-[#162F4D] disabled:opacity-50 flex items-center gap-2">
                        <Save size={16} /> {anchorSaving ? 'Salvando...' : 'Salvar'}
                    </button>
                    {anchor && <span className="text-sm text-slate-400 sm:ml-2">Atual: <b className="text-slate-600">{anchor.split('-').reverse().join('/')}</b></span>}
                </div>
                {anchorMsg && (
                    <div className="mt-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 flex items-center gap-2">
                        <CheckCircle2 size={16} /> {anchorMsg}
                    </div>
                )}
            </div>

            {/* Integração OpenAI */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-1">
                    <KeyRound className="text-[#0A1E35]" size={20} />
                    <h3 className="font-bold text-[#0A1E35]">Integração OpenAI (leitura do PDF por IA)</h3>
                    {integration?.configured ? (
                        <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                            <CheckCircle2 size={12} /> Configurada{integration.key_last4 ? ` ····${integration.key_last4}` : ''}
                            {integration.source === 'env' ? ' (via .env)' : ''}
                        </span>
                    ) : (
                        <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                            <AlertCircle size={12} /> Não configurada
                        </span>
                    )}
                </div>
                <p className="text-sm text-slate-500 mb-4">
                    Cole sua chave da OpenAI para habilitar o botão "Extrair com IA". A chave fica salva no servidor
                    e nunca é exibida de volta (só os 4 últimos dígitos).
                </p>
                <div className="grid md:grid-cols-3 gap-3 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Chave da API (sk-...)</label>
                        <input type="password" autoComplete="off" value={keyInput} onChange={e => setKeyInput(e.target.value)}
                            placeholder={integration?.configured ? 'Deixe em branco para manter a chave atual' : 'sk-...'}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#0A1E35] outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Modelo</label>
                        <input type="text" value={modelInput} onChange={e => setModelInput(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#0A1E35] outline-none" />
                    </div>
                </div>
                <div className="flex items-center gap-3 mt-3">
                    <button onClick={handleSaveIntegration} disabled={intSaving}
                        className="px-5 py-2 bg-[#0A1E35] text-[#D4C4A8] rounded-lg font-bold hover:bg-[#162F4D] disabled:opacity-50 flex items-center gap-2">
                        <Save size={16} /> {intSaving ? 'Salvando...' : 'Salvar integração'}
                    </button>
                    {intMsg && <span className="text-sm text-emerald-700 flex items-center gap-1"><CheckCircle2 size={14} /> {intMsg}</span>}
                </div>
            </div>

            </>)}

            {/* Aba: Funcionários (importação + lista) */}
            {tab === 'funcionarios' && (<>
            {/* Importar / editar escala */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                    <UploadCloud className="text-[#0A1E35]" size={20} />
                    <h3 className="font-bold text-[#0A1E35]">Importar escala de um funcionário</h3>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Funcionário</label>
                        <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value ? Number(e.target.value) : '')}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#0A1E35] outline-none">
                            <option value="">Selecione...</option>
                            {summaries.map(s => (
                                <option key={s.user_id} value={s.user_id}>
                                    {s.nome || s.login} {s.has_schedule ? '· (tem escala)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-500 mb-1">PDF da escala</label>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer">
                                <div className="px-4 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:bg-slate-50 flex items-center gap-2 truncate">
                                    <FileText size={16} className="shrink-0" />
                                    {file ? file.name : 'Escolher arquivo PDF...'}
                                </div>
                                <input type="file" accept="application/pdf" className="hidden"
                                    onChange={e => setFile(e.target.files?.[0] || null)} />
                            </label>
                            <button onClick={handleExtract} disabled={extracting || !file || !selectedUserId}
                                className="px-4 py-2 bg-[#0A1E35] text-[#D4C4A8] rounded-lg font-bold hover:bg-[#162F4D] disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
                                {extracting ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                {extracting ? 'Extraindo...' : 'Extrair com IA'}
                            </button>
                        </div>
                        <button onClick={handleManual} className="mt-2 text-xs text-slate-500 hover:text-[#0A1E35] underline flex items-center gap-1">
                            <Pencil size={12} /> ou preencher manualmente
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-600 text-sm px-4 py-3 rounded-lg flex items-start gap-2">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
                    </div>
                )}
                {success && (
                    <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
                        <CheckCircle2 size={16} /> {success}
                    </div>
                )}

                {/* Revisão / edição */}
                {draft && (
                    <div className="mt-6 border-t border-slate-100 pt-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <div>
                                <h4 className="font-bold text-[#0A1E35] flex items-center gap-2">
                                    <Eye size={18} /> Revisão da escala — {selectedName}
                                </h4>
                                <p className="text-xs text-slate-500">Confira e ajuste antes de salvar. Verde = trabalha, cinza = folga.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-slate-500 flex items-center gap-2">
                                    Semanas no ciclo:
                                    <input type="number" min={1} max={8} value={draft.num_weeks}
                                        onChange={e => changeNumWeeks(Number(e.target.value))}
                                        className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-slate-900" />
                                </label>
                                <button onClick={handleSave} disabled={saving}
                                    className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                                    <Save size={16} /> {saving ? 'Salvando...' : 'Salvar escala'}
                                </button>
                                <button onClick={resetDraft} className="p-2 text-slate-400 hover:text-slate-600" title="Cancelar"><X size={18} /></button>
                            </div>
                        </div>

                        {warnings.length > 0 && (
                            <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg p-3">
                                <p className="font-bold mb-1 flex items-center gap-1"><AlertCircle size={14} /> Reveja estes pontos (a IA teve dúvidas):</p>
                                <ul className="list-disc list-inside space-y-0.5">
                                    {warnings.slice(0, 8).map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                            </div>
                        )}

                        <div className="space-y-5">
                            {Array.from({ length: draft.num_weeks }, (_, i) => i + 1).map(wk => (
                                <div key={wk}>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Semana {wk}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                        {Array.from({ length: 7 }, (_, wd) => {
                                            const cell = draft.grid[wk][wd];
                                            return (
                                                <div key={wd} className={`rounded-xl border p-2.5 ${cell.is_work ? 'bg-white border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-bold text-slate-500">{WEEKDAY_LABELS[wd]}</span>
                                                        <button onClick={() => toggleWork(wk, wd)}
                                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${cell.is_work ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>
                                                            {cell.is_work ? <><Sun size={10} />Trabalha</> : <><Moon size={10} />Folga</>}
                                                        </button>
                                                    </div>
                                                    {cell.is_work && (
                                                        <div className="space-y-1.5">
                                                            {cell.shifts.map((s, i) => (
                                                                <div key={i} className="flex items-center gap-1 min-w-0">
                                                                    <input type="time" value={s.entrada} onChange={e => setShift(wk, wd, i, 'entrada', e.target.value)}
                                                                        className="w-full min-w-0 px-1 py-0.5 border border-slate-200 rounded text-[11px] text-slate-800 tabular-nums" />
                                                                    <span className="text-slate-300 text-xs shrink-0">→</span>
                                                                    <input type="time" value={s.saida} onChange={e => setShift(wk, wd, i, 'saida', e.target.value)}
                                                                        className="w-full min-w-0 px-1 py-0.5 border border-slate-200 rounded text-[11px] text-slate-800 tabular-nums" />
                                                                    <button onClick={() => removeShift(wk, wd, i)} className="text-slate-300 hover:text-rose-500 shrink-0"><Trash2 size={12} /></button>
                                                                </div>
                                                            ))}
                                                            <button onClick={() => addShift(wk, wd)} className="text-[10px] text-slate-400 hover:text-[#0A1E35] flex items-center gap-1">
                                                                <Plus size={10} /> turno
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Lista de funcionários */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                    <UsersIcon size={18} className="text-[#0A1E35]" />
                    <h3 className="font-bold text-[#0A1E35]">Funcionários</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold">
                            <tr>
                                <th className="px-6 py-3">Funcionário</th>
                                <th className="px-6 py-3">Escala</th>
                                <th className="px-6 py-3">Ciclo</th>
                                <th className="px-6 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {summaries.map(s => (
                                <tr key={s.user_id} className="hover:bg-slate-50">
                                    <td className="px-6 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                                                {(s.nome || s.login).charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <span className="block text-sm font-medium text-[#0A1E35]">{s.nome || s.login}</span>
                                                <span className="text-xs text-slate-400">@{s.login} · {s.cargo}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3">
                                        {s.has_schedule ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold"><CheckCircle2 size={11} /> Cadastrada</span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">Sem escala</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-sm text-slate-600">{s.num_weeks ? `${s.num_weeks} semanas` : '—'}</td>
                                    <td className="px-6 py-3 text-right whitespace-nowrap">
                                        {s.has_schedule && (
                                            <>
                                                <button onClick={() => setViewing({ id: s.user_id, name: s.nome || s.login })}
                                                    className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-full" title="Ver escala"><Eye size={16} /></button>
                                                <button onClick={() => loadExistingForEdit(s.user_id)}
                                                    className="text-slate-500 hover:text-[#0A1E35] p-2 hover:bg-slate-100 rounded-full" title="Editar"><Pencil size={16} /></button>
                                            </>
                                        )}
                                        {!s.has_schedule && (
                                            <button onClick={() => handleManual(s.user_id)}
                                                className="text-emerald-600 hover:text-emerald-800 text-xs font-medium px-3 py-1.5 hover:bg-emerald-50 rounded-lg">
                                                Criar
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            </>)}
        </div>
    );
};

export default ScheduleAdmin;
