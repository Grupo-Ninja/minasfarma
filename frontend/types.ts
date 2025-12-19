
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
}

export enum AppRoute {
  DASHBOARD = 'dashboard',
  CONFERENCE = 'conference', // Agora "Fechamento de Caixa"
  PIX = 'pix',
  SANGRIA = 'sangria',
  OPERATORS = 'operators',
}
