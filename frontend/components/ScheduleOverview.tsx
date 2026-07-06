import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, AlertCircle, Sun, Moon, Users as UsersIcon, Printer, CalendarDays, LayoutGrid } from 'lucide-react';
import { getScheduleOverview } from '../api';
import { WEEKDAY_SHORT, WEEKDAY_LABELS } from '../types';
import { printHTML } from '../printDoc';

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sundayOf = (d: Date) => addDays(d, -(d.getDay() % 7));
const saturdayOf = (d: Date) => addDays(d, 6 - (d.getDay() % 7));
const parseISO = (iso: string) => { const [y, m, dd] = iso.split('-').map(Number); return new Date(y, m - 1, dd); };
const fmtDM = (iso: string) => { const [, m, dd] = iso.split('-'); return `${dd}/${m}`; };
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Paleta de cores por funcionário (escura o suficiente p/ texto branco)
const PALETTE = ['#0A1E35', '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#ea580c', '#4f46e5', '#0d9488'];
const firstName = (nome?: string) => (nome || '?').trim().split(/\s+/)[0];

type ViewMode = 'semana' | 'mes';

const ScheduleOverview: React.FC = () => {
    const [mode, setMode] = useState<ViewMode>('semana');
    const [data, setData] = useState<any>(null);
    const [weekOffset, setWeekOffset] = useState(0);
    const [monthOffset, setMonthOffset] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const todayISO = toISO(new Date());
    const viewStart = useMemo(() => sundayOf(addDays(new Date(), weekOffset * 7)), [weekOffset]);
    const viewMonth = useMemo(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + monthOffset, 1); }, [monthOffset]);

    const load = async () => {
        setIsLoading(true);
        setError('');
        try {
            let res;
            if (mode === 'semana') {
                res = await getScheduleOverview(toISO(viewStart));
            } else {
                const gridStart = sundayOf(viewMonth);
                const gridEnd = saturdayOf(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0));
                res = await getScheduleOverview(toISO(gridStart), toISO(gridEnd));
            }
            setData(res);
        } catch (err: any) {
            if (err.response?.status === 409) {
                setError('A data da Semana 1 ainda não foi definida. Configure na aba "Configurações".');
            } else {
                setError('Erro ao carregar a escala geral.');
            }
            setData(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [mode, weekOffset, monthOffset]);

    const dates: string[] = data?.dates || [];
    const employees: any[] = data?.employees || [];

    // Funcionários com cor fixa (ordem estável já vem ordenada por nome do backend)
    const empColors = useMemo(
        () => employees.map((e, i) => ({ ...e, color: PALETTE[i % PALETTE.length] })),
        [employees]
    );

    // Filtro: quais funcionários aparecem (por padrão, todos)
    const [hidden, setHidden] = useState<Set<number>>(new Set());
    const toggleEmp = (id: number) => setHidden(h => { const n = new Set(h); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const visibleEmps = useMemo(() => empColors.filter(e => !hidden.has(e.user_id)), [empColors, hidden]);

    // Mapa data -> [funcionarios que trabalham] (apenas os visíveis pelo filtro)
    const workByDate = useMemo(() => {
        const map: Record<string, any[]> = {};
        visibleEmps.forEach(e => (e.days || []).forEach((d: any) => {
            if (d.is_work) (map[d.date] = map[d.date] || []).push(e);
        }));
        return map;
    }, [visibleEmps]);

    const weeksGrid = useMemo(() => {
        const chunks: string[][] = [];
        for (let i = 0; i < dates.length; i += 7) chunks.push(dates.slice(i, i + 7));
        return chunks;
    }, [dates]);

    // ---------------- impressão ----------------
    const legendHTML = () => visibleEmps.map(e =>
        `<span class="item"><span class="dot" style="background:${e.color}"></span>${e.nome}</span>`
    ).join('');

    const printWeek = () => {
        const head = dates.map(iso => {
            const wd = parseISO(iso).getDay();
            return `<th>${WEEKDAY_LABELS[wd]}<br><span style="font-weight:400;font-size:10px;opacity:.85">${fmtDM(iso)}</span></th>`;
        }).join('');
        const rows = visibleEmps.map(e => {
            const cells = e.days.map((d: any) => d.is_work
                ? `<td class="work">${d.total_horas}h<br><span class="shifts" style="font-size:9px;color:#059669;font-weight:400">${(d.shifts || []).map((s: any) => s.entrada + '–' + s.saida).join('<br>')}</span></td>`
                : `<td class="off">Folga</td>`).join('');
            return `<tr><td class="name-cell" style="border-left:6px solid ${e.color}">${e.nome}</td>${cells}</tr>`;
        }).join('');
        printHTML({
            title: 'Escala de Trabalho',
            subtitle: `Semana de ${fmtDM(toISO(viewStart))} a ${fmtDM(toISO(addDays(viewStart, 6)))}`,
            orientation: 'landscape',
            body: `<table class="grid"><thead><tr><th style="text-align:left">Funcionário</th>${head}</tr></thead><tbody>${rows}</tbody></table>`,
        });
    };

    const printMonth = () => {
        const headRow = WEEKDAY_LABELS.map(w => `<th>${w}</th>`).join('');
        const rows = weeksGrid.map(week => {
            const cells = week.map(iso => {
                const dObj = parseISO(iso);
                const inMonth = dObj.getMonth() === viewMonth.getMonth();
                const isToday = iso === todayISO;
                const workers = workByDate[iso] || [];
                const folga = visibleEmps.filter(e => !workers.some(w => w.user_id === e.user_id));
                const chips = workers.map(e => `<span class="chip" style="background:${e.color}">${firstName(e.nome)}</span>`).join('');
                const worklist = inMonth && workers.length
                    ? `<div class="lbl">Trabalham</div><div class="chips">${chips}</div>`
                    : '';
                const folgalist = inMonth && workers.length && folga.length
                    ? `<div class="folga"><b style="color:#94a3b8">Folga:</b> ${folga.map(f => firstName(f.nome)).join(', ')}</div>`
                    : '';
                return `<td class="${inMonth ? '' : 'out'} ${isToday ? 'today' : ''}"><div class="daynum">${dObj.getDate()}</div>${worklist}${folgalist}</td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
        }).join('');
        printHTML({
            title: 'Planejador Mensal',
            subtitle: `${MONTHS[viewMonth.getMonth()]} de ${viewMonth.getFullYear()}`,
            orientation: 'landscape',
            body: `<div class="legend">${legendHTML()}</div><table class="cal"><thead><tr>${headRow}</tr></thead><tbody>${rows}</tbody></table>`,
        });
    };

    return (
        <div className="space-y-4">
            {/* Barra: alternância de modo + navegação + imprimir */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3">
                <div className="inline-flex bg-slate-100 rounded-lg p-1 self-start">
                    <button onClick={() => setMode('semana')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${mode === 'semana' ? 'bg-white text-[#0A1E35] shadow-sm' : 'text-slate-500'}`}>
                        <LayoutGrid size={15} /> Semana
                    </button>
                    <button onClick={() => setMode('mes')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${mode === 'mes' ? 'bg-white text-[#0A1E35] shadow-sm' : 'text-slate-500'}`}>
                        <CalendarDays size={15} /> Mês
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => (mode === 'semana' ? setWeekOffset(o => o - 1) : setMonthOffset(o => o - 1))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
                        <ChevronLeft size={18} />
                    </button>
                    <div className="text-center min-w-[180px]">
                        {mode === 'semana' ? (
                            <>
                                <p className="text-sm font-semibold text-[#0A1E35]">{fmtDM(toISO(viewStart))} a {fmtDM(toISO(addDays(viewStart, 6)))}</p>
                                <p className="text-xs text-slate-400">{MONTHS[viewStart.getMonth()]} de {viewStart.getFullYear()}</p>
                            </>
                        ) : (
                            <p className="text-sm font-semibold text-[#0A1E35]">{MONTHS[viewMonth.getMonth()]} de {viewMonth.getFullYear()}</p>
                        )}
                    </div>
                    <button onClick={() => (mode === 'semana' ? setWeekOffset(o => o + 1) : setMonthOffset(o => o + 1))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
                        <ChevronRight size={18} />
                    </button>
                    {((mode === 'semana' && weekOffset !== 0) || (mode === 'mes' && monthOffset !== 0)) && (
                        <button onClick={() => (mode === 'semana' ? setWeekOffset(0) : setMonthOffset(0))} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#0A1E35] text-[#D4C4A8] hover:bg-[#162F4D]">
                            Hoje
                        </button>
                    )}
                </div>

                <button onClick={() => (mode === 'semana' ? printWeek() : printMonth())} disabled={visibleEmps.length === 0}
                    className="self-start md:self-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A1E35] text-[#D4C4A8] font-bold text-sm hover:bg-[#162F4D] disabled:opacity-40">
                    <Printer size={16} /> Imprimir PDF
                </button>
            </div>

            {/* Filtro: escolher quais colaboradores aparecem */}
            {!isLoading && !error && employees.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide mr-1">Mostrar:</span>
                    {empColors.map(e => {
                        const on = !hidden.has(e.user_id);
                        return (
                            <button key={e.user_id} onClick={() => toggleEmp(e.user_id)}
                                title={on ? 'Clique para ocultar' : 'Clique para mostrar'}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${on ? 'text-white border-transparent' : 'text-slate-400 border-slate-200 bg-slate-50'}`}
                                style={on ? { background: e.color } : undefined}>
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: on ? 'rgba(255,255,255,0.8)' : e.color }} />
                                {e.nome}
                            </button>
                        );
                    })}
                    {hidden.size > 0 && (
                        <button onClick={() => setHidden(new Set())} className="text-xs text-[#0A1E35] font-semibold underline ml-1">
                            Mostrar todos
                        </button>
                    )}
                </div>
            )}

            {error && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center h-48"><RefreshCw className="w-7 h-7 text-[#0A1E35] animate-spin" /></div>
            ) : !error && employees.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
                    Nenhum funcionário com escala cadastrada.
                </div>
            ) : !error && mode === 'semana' ? (
                /* ---------- VISÃO SEMANA (turnos por dia) ---------- */
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full border-collapse min-w-[720px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 min-w-[160px]">
                                        <span className="flex items-center gap-2"><UsersIcon size={14} /> Funcionário</span>
                                    </th>
                                    {dates.map((iso) => {
                                        const wd = parseISO(iso).getDay();
                                        const isToday = iso === todayISO;
                                        return (
                                            <th key={iso} className={`px-2 py-3 text-center text-xs font-bold ${isToday ? 'bg-[#0A1E35] text-[#D4C4A8]' : 'text-slate-500'}`}>
                                                <div className="uppercase tracking-wide">{WEEKDAY_SHORT[wd]}</div>
                                                <div className={`text-[10px] font-medium ${isToday ? 'text-[#D4C4A8]/80' : 'text-slate-400'}`}>{fmtDM(iso)}</div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {visibleEmps.map((emp) => (
                                    <tr key={emp.user_id} className="hover:bg-slate-50/60">
                                        <td className="sticky left-0 z-10 bg-white px-4 py-3 min-w-[160px]" style={{ borderLeft: `4px solid ${emp.color}` }}>
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ background: emp.color }}>
                                                    {(emp.nome || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm font-medium text-[#0A1E35] truncate">{emp.nome}</span>
                                            </div>
                                        </td>
                                        {emp.days.map((d: any) => {
                                            const isToday = d.date === todayISO;
                                            return (
                                                <td key={d.date} className={`px-1.5 py-2 align-top text-center ${isToday ? 'bg-[#0A1E35]/5' : ''}`}>
                                                    {d.is_work ? (
                                                        <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-1 py-1.5">
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700"><Sun size={10} /> {d.total_horas}h</span>
                                                            {(d.shifts || []).slice(0, 2).map((s: any, i: number) => (
                                                                <div key={i} className="text-[9px] text-slate-500 tabular-nums leading-tight">{s.entrada}–{s.saida}</div>
                                                            ))}
                                                            {(d.shifts || []).length > 2 && <div className="text-[9px] text-slate-400">+{d.shifts.length - 2}</div>}
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-lg bg-slate-50 border border-slate-100 px-1 py-2">
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400"><Moon size={10} /> Folga</span>
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : !error && (
                /* ---------- VISÃO MÊS (quem trabalha por dia, cor por funcionário) ---------- */
                <div className="space-y-3">

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <div className="min-w-[720px]">
                                {/* Cabeçalho dos dias da semana */}
                                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                                    {WEEKDAY_SHORT.map((w, i) => (
                                        <div key={i} className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wider text-slate-500">{w}</div>
                                    ))}
                                </div>
                                {/* Semanas */}
                                {weeksGrid.map((week, wi) => (
                                    <div key={wi} className="grid grid-cols-7">
                                        {week.map(iso => {
                                            const dObj = parseISO(iso);
                                            const inMonth = dObj.getMonth() === viewMonth.getMonth();
                                            const isToday = iso === todayISO;
                                            const workers = workByDate[iso] || [];
                                            return (
                                                <div key={iso} className={`min-h-[92px] border-b border-r border-slate-100 p-1.5 ${inMonth ? '' : 'bg-slate-50/60'}`}>
                                                    <div className={`text-xs font-bold mb-1 ${isToday ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#0A1E35] text-[#D4C4A8]' : inMonth ? 'text-slate-600' : 'text-slate-300'}`}>
                                                        {dObj.getDate()}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {workers.map(e => (
                                                            <span key={e.user_id} title={e.nome} className="inline-block text-[10px] font-semibold text-white rounded px-1.5 py-0.5 leading-tight" style={{ background: e.color }}>
                                                                {firstName(e.nome)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScheduleOverview;
