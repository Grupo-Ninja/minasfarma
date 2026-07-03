
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, AlertCircle, CheckCircle2, DollarSign, Wallet, Loader2, Calendar } from 'lucide-react';
import { getDashboardStats } from '../api';
import { AppRoute } from '../types';

interface DashboardProps {
  onNavigate: (route: AppRoute) => void;
}

interface DashboardStatsData {
  fechamentos_hoje: number;
  quebra_acumulada: number;
  pendentes: number;
  total_processado: number;
  chart_data: { name: string; value: number }[];
  ultimos_fechamentos: {
    id: number;
    data: string;
    operador: string;
    status: string;
    quebra: number;
  }[];
}

// Helper para obter data de ontem
const getYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterDate, setFilterDate] = useState(getYesterday());

  useEffect(() => {
    fetchStats(filterDate);
  }, [filterDate]);

  const fetchStats = async (data?: string) => {
    try {
      setLoading(true);
      const result = await getDashboardStats(data);
      setStats(result);
      setError('');
    } catch (err) {
      console.error("Erro ao carregar dashboard:", err);
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Brand colors adapted for chart
  const COLORS = ['#0A1E35', '#D4C4A8', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#0A1E35]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-rose-600">
        {error}
      </div>
    );
  }

  // Label dinâmico baseado na data selecionada
  const isYesterday = filterDate === getYesterday();
  const dateLabel = isYesterday ? 'Ontem' : new Date(filterDate + 'T12:00:00').toLocaleDateString('pt-BR');

  const kpiData = [
    { title: `Fechamentos ${dateLabel}`, value: stats?.fechamentos_hoje?.toString() || '0', icon: CheckCircle2, color: 'text-[#0A1E35]', bg: 'bg-[#D4C4A8]/20' },
    { title: 'Quebra Acumulada', value: `R$ ${(stats?.quebra_acumulada || 0).toFixed(2)}`, icon: TrendingUp, color: stats?.quebra_acumulada && stats.quebra_acumulada < 0 ? 'text-rose-600' : 'text-emerald-600', bg: stats?.quebra_acumulada && stats.quebra_acumulada < 0 ? 'bg-rose-100' : 'bg-emerald-100' },
    { title: 'Pendentes', value: stats?.pendentes?.toString() || '0', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-100' },
    { title: 'Total Processado', value: `R$ ${((stats?.total_processado || 0) / 1000).toFixed(1)}k`, icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  ];

  const chartData = stats?.chart_data || [];
  const recentClosings = stats?.ultimos_fechamentos || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-[#0A1E35]">Cockpit Gerencial</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="text-sm bg-transparent outline-none font-medium text-[#0A1E35]"
            />
          </div>
          <span className="text-sm text-slate-500 font-medium bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
            {new Date(filterDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${kpi.bg}`}>
                  <Icon className={`w-6 h-6 ${kpi.color}`} />
                </div>
              </div>
              <h3 className="text-slate-500 text-sm font-medium">{kpi.title}</h3>
              <p className={`text-2xl font-bold mt-1 ${index === 1 && stats?.quebra_acumulada && stats.quebra_acumulada < 0 ? 'text-rose-600' : 'text-[#0A1E35]'}`}>{kpi.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <h3 className="text-lg font-bold text-[#0A1E35] mb-6">Volume por Forma de Pagamento ({dateLabel})</h3>
          <div className="h-80 w-full flex-1">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    tickFormatter={(v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 })}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    cursor={{ fill: '#f1f5f9' }}
                    formatter={(value: number) => [
                      Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                      'Valor',
                    ]}
                    labelStyle={{ fontWeight: 700, color: '#0A1E35' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={60}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                Nenhum dado disponível para ontem
              </div>
            )}
          </div>
        </div>

        {/* Recent List */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-[#0A1E35]">Últimos Fechamentos</h3>
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold">Recentes</span>
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] custom-scrollbar pr-2">
            {recentClosings.length === 0 ? (
              <div className="text-center text-slate-400 py-8">Nenhum fechamento registrado</div>
            ) : (
              recentClosings.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors group cursor-pointer">
                  <div>
                    <p className="font-bold text-[#0A1E35] text-sm group-hover:text-blue-700 transition-colors">{item.operador}</p>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{item.data ? new Date(item.data).toLocaleDateString('pt-BR') : '-'}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${item.status === 'Aprovado' ? 'bg-emerald-100 text-emerald-700' :
                      item.status === 'Rejeitado' ? 'bg-rose-100 text-rose-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                      {item.status}
                    </span>
                    <p className={`text-xs font-bold mt-1 ${item.quebra < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {item.quebra !== 0 ? `R$ ${item.quebra.toFixed(2)}` : 'OK'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => onNavigate(AppRoute.CONFERENCE)}
            className="w-full mt-4 py-3 text-sm font-bold text-[#0A1E35] hover:text-[#D4C4A8] hover:bg-[#0A1E35] rounded-lg transition-all border border-slate-200 hover:border-[#0A1E35]"
          >
            Ver Histórico Completo
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

