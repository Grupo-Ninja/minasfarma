
export interface OperatorInfo {
  operador: string;
  data: string;
  caixa: string;
  valoresIniciais: {
    abertura: number;
    fundoTroco: number;
  };
}

export interface Movement {
  id: number;
  historico: string;
  moeda: string;
  obs: string;
  tipo: 'Entrada' | 'Saída';
  valor: number;
  descricao?: string; // Descrição/identificação adicionada pelo operador
}

export interface PaymentMethod {
  forma: string;
  informado: number; // Valor do Sistema/PDF
  calculado: number; // Valor processado
  oficial: number;   // Contagem Física (Input)
  diferenca: number; // Calculado - Oficial
  justificativa: string;
}

export interface ClosingData {
  operadorInfo: OperatorInfo;
  movimentos: Movement[];
  conferencia: PaymentMethod[];
}

export interface PixEntry {
  id: string;
  data: string;
  valor: number;
  observacao: string;
  status: 'Pendente' | 'Conciliado' | 'Rejeitado';
}

export interface Operator {
  id: number;
  name: string;
  role: 'Admin' | 'Operador';
  active: boolean;
  login?: string;
  password?: string;
}

export interface SangriaRecord {
  id: string;
  operador: string;
  data: string;
  valor: number;
  motivo: string;
  status: 'Pendente' | 'Conciliado';
  origem: 'Manual' | 'Fechamento';
  closing_id?: number;
  operador_id?: number; // Para controle de permissões
}

export enum AppRoute {
  DASHBOARD = 'dashboard',
  CONFERENCE = 'conference', // Agora "Fechamento de Caixa"
  PIX = 'pix',
  SANGRIA = 'sangria',
  OPERATORS = 'operators',
  MY_SCHEDULE = 'my_schedule',   // Minha Escala (todos)
  SCHEDULES = 'schedules',       // Gestão de Escalas (admin)
}

// --- ESCALA DE TRABALHO ---
export interface Shift {
  entrada: string; // "07:00"
  saida: string;   // "15:00"
}

export interface ScheduleDay {
  week_index: number; // 1..num_weeks
  weekday: number;    // 0=Domingo .. 6=Sábado
  is_work: boolean;
  shifts: Shift[];
  note?: string | null;
}

export interface EmployeeSchedule {
  id: number;
  user_id: number;
  user_nome?: string;
  user_login?: string;
  num_weeks: number;
  source_filename?: string | null;
  updated_at?: string;
  days: ScheduleDay[];
}

export interface ScheduleSummary {
  user_id: number;
  nome?: string;
  login: string;
  cargo: string;
  has_schedule: boolean;
  num_weeks?: number | null;
  updated_at?: string | null;
}

export interface ExtractResult {
  success: boolean;
  num_weeks: number;
  days: ScheduleDay[];
  warnings: string[];
}

export interface JourneyDay {
  date: string;        // ISO yyyy-mm-dd
  weekday: number;     // 0=Domingo .. 6=Sábado
  week_index: number;
  is_work: boolean;
  shifts: Shift[];
  total_horas: number;
  note?: string | null;
}

export interface JourneyResponse {
  user_id: number;
  user_nome?: string;
  num_weeks: number;
  anchor_date?: string | null;
  days: JourneyDay[];
}

export const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
