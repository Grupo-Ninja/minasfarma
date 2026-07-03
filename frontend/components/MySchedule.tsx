import React, { useState, useEffect, useMemo } from 'react';
import {
    CalendarDays, Clock, Sun, Moon, ChevronLeft, ChevronRight,
    RefreshCw, AlertCircle, CalendarClock, Briefcase, Coffee, Info, Printer,
} from 'lucide-react';
import { getMyJourney, getMySchedule, getUserJourney, getUserSchedule } from '../api';
import { JourneyResponse, JourneyDay, EmployeeSchedule, WEEKDAY_SHORT, WEEKDAY_LABELS } from '../types';
import { printHTML } from '../printDoc';

// ---------- helpers de data (sem libs externas) ----------
const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sundayOf = (d: Date) => addDays(d, -((d.getDay()) % 7)); // getDay: 0=Domingo
const parseISO = (s: string) => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); };
const fmtDayMonth = (s: string) => { const d = parseISO(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface Props {
    // Modo admin: visualizar a escala de outro funcionário
    targetUserId?: number;
    targetName?: string;
}

const MySchedule: React.FC<Props> = ({ targetUserId, targetName }) => {
    const isAdminView = typeof targetUserId === 'number';
    const [schedule, setSchedule] = useState<EmployeeSchedule | null>(null);
    const [journey, setJourney] = useState<JourneyResponse | null>(null);
    const [weekOffset, setWeekOffset] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [noSchedule, setNoSchedule] = useState(false);
    const [showCycle, setShowCycle] = useState(false);

    const todayISO = toISO(new Date());

    // Janela: começa no domingo da semana atual + offset; cobre num_weeks semanas
    const numWeeks = schedule?.num_weeks || 4;
    const viewStart = useMemo(() => sundayOf(addDays(new Date(), weekOffset * 7)), [weekOffset]);
    const viewEnd = useMemo(() => addDays(viewStart, numWeeks * 7 - 1), [viewStart, numWeeks]);

    const loadSchedule = async () => {
        try {
            const data = isAdminView ? await getUserSchedule(targetUserId!) : await getMySchedule();
            setSchedule(data);
            setNoSchedule(false);
            return data;
        } catch (err: any) {
            if (err.response?.status === 404) { setNoSchedule(true); return null; }
            throw err;
        }
    };

    const loadJourney = async (weeks: number) => {
        const start = toISO(sundayOf(addDays(new Date(), weekOffset * 7)));
        const end = toISO(addDays(parseISO(start), weeks * 7 - 1));
        try {
            const data = isAdminView
                ? await getUserJourney(targetUserId!, start, end)
                : await getMyJourney(start, end);
            setJourney(data);
            setError('');
        } catch (err: any) {
            if (err.response?.status === 409) {
                setError('A data da Semana 1 ainda não foi definida pelo administrador. Sua jornada será exibida assim que isso for configurado.');
            } else if (err.response?.status !== 404) {
                setError('Erro ao calcular a jornada.');
            }
            setJourney(null);
        }
    };

    useEffect(() => {
        (async () => {
            setIsLoading(true);
            setError('');
            try {
                const sch = await loadSchedule();
                if (sch) await loadJourney(sch.num_weeks || 4);
            } catch {
                setError('Erro ao carregar a escala.');
            } finally {
                setIsLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetUserId]);

    useEffect(() => {
        if (schedule) loadJourney(schedule.num_weeks || 4);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekOffset]);

    // Agrupa a jornada em semanas de 7 dias
    const weeks = useMemo(() => {
        if (!journey) return [];
        const chunks: JourneyDay[][] = [];
        for (let i = 0; i < journey.days.length; i += 7) chunks.push(journey.days.slice(i, i + 7));
        return chunks;
    }, [journey]);

    const totals = useMemo(() => {
        if (!journey) return { work: 0, off: 0, hours: 0 };
        const work = journey.days.filter(d => d.is_work).length;
        return {
            work,
            off: journey.days.length - work,
            hours: Math.round(journey.days.reduce((a, d) => a + (d.total_horas || 0), 0) * 10) / 10,
        };
    }, [journey]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 text-[#0A1E35] animate-spin" />
            </div>
        );
    }

    if (noSchedule) {
        return (
            <div className="max-w-2xl mx-auto animate-fade-in">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <CalendarDays className="w-8 h-8 text-slate-400" />
                    </div>
                    <h2 className="text-xl font-bold text-[#0A1E35]">Nenhuma escala cadastrada</h2>
                    <p className="text-slate-500 mt-2">
                        {isAdminView
                            ? 'Este funcionário ainda não tem uma escala importada.'
                            : 'Sua escala de trabalho ainda não foi cadastrada. Fale com o administrador.'}
                    </p>
                </div>
            </div>
        );
    }

    const title = isAdminView ? `Escala de ${targetName || journey?.user_nome || ''}` : 'Minha Escala';

    const handlePrint = () => {
        if (!journey) return;
        const rows = journey.days.map(d => {
            const wd = WEEKDAY_LABELS[d.weekday];
            const shifts = (d.shifts || []).map(s => `${s.entrada}–${s.saida}`).join(' &nbsp; ') || '—';
            return `<tr>
                <td>${fmtDayMonth(d.date)}</td>
                <td>${wd}</td>
                <td class="${d.is_work ? 'work' : 'off'}" style="text-align:left">${d.is_work ? 'Trabalha' : 'Folga'}</td>
                <td class="shifts">${d.is_work ? shifts : '—'}</td>
                <td class="hours">${d.is_work ? d.total_horas + 'h' : '—'}</td>
            </tr>`;
        }).join('');
        const periodo = journey.days.length
            ? `${fmtDayMonth(journey.days[0].date)} a ${fmtDayMonth(journey.days[journey.days.length - 1].date)}`
            : '';
        printHTML({
            title: 'Escala de Trabalho',
            subtitle: journey.user_nome || (isAdminView ? targetName : '') || '',
            meta: `Período: <b>${periodo}</b> · Ciclo de <b>${numWeeks} semanas</b> · Dias de trabalho: <b>${totals.work}</b> · Folgas: <b>${totals.off}</b> · Total de horas: <b>${totals.hours}h</b>`,
            orientation: 'portrait',
            body: `<table class="grid"><thead><tr>
                <th style="text-align:left">Data</th><th style="text-align:left">Dia</th>
                <th style="text-align:left">Situação</th><th style="text-align:left">Horários</th>
                <th style="text-align:right">Horas</th></tr></thead><tbody>${rows}</tbody></table>`,
        });
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-[#0A1E35] flex items-center gap-2">
                        <CalendarClock className="text-[#0A1E35]" /> {title}
                    </h2>
                    <p className="text-slate-500">
                        Ciclo rotativo de <span className="font-semibold text-[#0A1E35]">{numWeeks} semanas</span>
                        {journey?.anchor_date && <> · Semana 1 ancorada em {fmtDayMonth(journey.anchor_date)}</>}
                    </p>
                </div>
                <div className="flex items-center gap-2 self-start">
                    <button
                        onClick={() => setShowCycle(s => !s)}
                        className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                    >
                        <Info size={16} /> {showCycle ? 'Ver jornada (datas)' : 'Ver escala base (ciclo)'}
                    </button>
                    {!showCycle && journey && (
                        <button
                            onClick={handlePrint}
                            className="px-4 py-2 rounded-lg bg-[#0A1E35] text-[#D4C4A8] text-sm font-bold hover:bg-[#162F4D] flex items-center gap-2"
                        >
                            <Printer size={16} /> Imprimir
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            {/* Cartões de resumo */}
            {!showCycle && journey && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <SummaryCard icon={<Briefcase size={18} />} label="Dias de trabalho" value={String(totals.work)} tone="work" />
                    <SummaryCard icon={<Coffee size={18} />} label="Folgas" value={String(totals.off)} tone="off" />
                    <SummaryCard icon={<Clock size={18} />} label="Horas no período" value={`${totals.hours}h`} tone="hours" />
                </div>
            )}

            {/* Navegação de período */}
            {!showCycle && (
                <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3">
                    <button onClick={() => setWeekOffset(o => o - numWeeks)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
                        <ChevronLeft size={20} />
                    </button>
                    <div className="text-center">
                        <p className="text-sm font-semibold text-[#0A1E35]">
                            {fmtDayMonth(toISO(viewStart))} — {fmtDayMonth(toISO(viewEnd))}
                        </p>
                        <p className="text-xs text-slate-400">{MONTHS[viewStart.getMonth()]} de {viewStart.getFullYear()}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        {weekOffset !== 0 && (
                            <button onClick={() => setWeekOffset(0)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#0A1E35] text-[#D4C4A8] hover:bg-[#162F4D]">
                                Hoje
                            </button>
                        )}
                        <button onClick={() => setWeekOffset(o => o + numWeeks)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* JORNADA (datas reais) */}
            {!showCycle && journey && weeks.map((week, wi) => (
                <div key={wi} className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Semana {week[0]?.week_index} do ciclo
                        </span>
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-xs text-slate-400">
                            {fmtDayMonth(week[0]?.date)} a {fmtDayMonth(week[week.length - 1]?.date)}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                        {week.map(day => <JourneyCard key={day.date} day={day} isToday={day.date === todayISO} />)}
                    </div>
                </div>
            ))}

            {/* ESCALA BASE (ciclo template) */}
            {showCycle && schedule && (
                <CycleView schedule={schedule} />
            )}
        </div>
    );
};

// ---------- subcomponentes ----------

const SummaryCard: React.FC<{ icon: React.ReactNode; label: string; value: string; tone: 'work' | 'off' | 'hours' }> = ({ icon, label, value, tone }) => {
    const tones = {
        work: 'from-emerald-500/10 to-emerald-500/5 text-emerald-700 border-emerald-100',
        off: 'from-slate-500/10 to-slate-500/5 text-slate-600 border-slate-200',
        hours: 'from-[#0A1E35]/10 to-[#0A1E35]/5 text-[#0A1E35] border-[#0A1E35]/10',
    }[tone];
    return (
        <div className={`bg-gradient-to-br ${tones} border rounded-xl p-4 flex items-center gap-3`}>
            <div className="w-10 h-10 rounded-lg bg-white/70 flex items-center justify-center">{icon}</div>
            <div>
                <p className="text-2xl font-bold leading-none">{value}</p>
                <p className="text-xs font-medium opacity-80 mt-1">{label}</p>
            </div>
        </div>
    );
};

const JourneyCard: React.FC<{ day: JourneyDay; isToday: boolean }> = ({ day, isToday }) => {
    const work = day.is_work;
    const base = work
        ? 'bg-white border-emerald-200'
        : 'bg-slate-50 border-slate-200';
    const ring = isToday ? 'ring-2 ring-[#0A1E35] ring-offset-2' : '';
    return (
        <div className={`relative rounded-xl border ${base} ${ring} p-3 transition-all hover:shadow-md`}>
            {isToday && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#0A1E35] text-[#D4C4A8] text-[10px] font-bold uppercase tracking-wider">
                    Hoje
                </span>
            )}
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{WEEKDAY_SHORT[day.weekday]}</span>
                <span className="text-sm font-bold text-[#0A1E35]">{fmtDayMonth(day.date)}</span>
            </div>

            <div className="mt-2.5">
                {work ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 text-[11px] font-bold">
                        <Sun size={12} /> Trabalha
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-200 text-slate-500 text-[11px] font-bold">
                        <Moon size={12} /> Folga
                    </span>
                )}
            </div>

            {work && day.shifts.length > 0 && (
                <div className="mt-2.5 space-y-1">
                    {day.shifts.map((s, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50 rounded px-1.5 py-1 border border-slate-100">
                            <Clock size={11} className="text-emerald-500 shrink-0" />
                            <span className="font-medium tabular-nums">{s.entrada}</span>
                            <span className="text-slate-300">→</span>
                            <span className="font-medium tabular-nums">{s.saida}</span>
                        </div>
                    ))}
                    <p className="text-[10px] text-slate-400 text-right font-medium pt-0.5">{day.total_horas}h no dia</p>
                </div>
            )}
        </div>
    );
};

const CycleView: React.FC<{ schedule: EmployeeSchedule }> = ({ schedule }) => {
    const byWeek = useMemo(() => {
        const map: Record<number, Record<number, any>> = {};
        for (const d of schedule.days) {
            map[d.week_index] = map[d.week_index] || {};
            map[d.week_index][d.weekday] = d;
        }
        return map;
    }, [schedule]);

    return (
        <div className="space-y-5">
            <div className="bg-blue-50 border border-blue-100 text-blue-700 text-sm rounded-xl p-3 flex items-center gap-2">
                <Info size={16} /> Esta é a <b>escala base</b> (o ciclo que se repete). As datas reais dependem da âncora da Semana 1.
            </div>
            {Array.from({ length: schedule.num_weeks }, (_, i) => i + 1).map(wk => (
                <div key={wk}>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Semana {wk}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                        {Array.from({ length: 7 }, (_, wd) => {
                            const d = byWeek[wk]?.[wd];
                            const work = d?.is_work;
                            return (
                                <div key={wd} className={`rounded-xl border p-3 ${work ? 'bg-white border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                                    <p className="text-xs font-bold text-slate-500">{WEEKDAY_LABELS[wd]}</p>
                                    <div className="mt-2">
                                        {work ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold"><Sun size={10} />Trabalha</span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200 text-slate-500 text-[10px] font-bold"><Moon size={10} />Folga</span>
                                        )}
                                    </div>
                                    {work && (d?.shifts || []).map((s: any, i: number) => (
                                        <p key={i} className="text-[11px] text-slate-600 tabular-nums mt-1">{s.entrada}–{s.saida}</p>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default MySchedule;
