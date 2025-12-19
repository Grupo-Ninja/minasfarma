
import { ClosingData } from './types';

export const SEED_DATA: ClosingData = {
  operadorInfo: {
    operador: "Tais Monteiro Guimarães",
    data: "2025-11-24",
    caixa: "180",
    valoresIniciais: {
      abertura: 0.00,
      fundoTroco: 0.00
    }
  },
  movimentos: [
    { id: 1, historico: "SAIDA", moeda: "DINHEIRO", obs: "SANGRIA", tipo: "Saída", valor: 677.00 },
    { id: 2, historico: "SAIDA", moeda: "DINHEIRO", obs: "GASOLINA", tipo: "Saída", valor: 20.00 },
    { id: 3, historico: "ENTRADA", moeda: "CHEQUE A VISTA", obs: "PIX CELULAR", tipo: "Entrada", valor: 26.99 },
    { id: 4, historico: "ENTRADA", moeda: "DINHEIRO", obs: "RECARGA", tipo: "Entrada", valor: 30.00 }
  ],
  conferencia: [
    { forma: "DINHEIRO", informado: 0.00, calculado: -0.23, oficial: 0.00, diferenca: 0, justificativa: "Erro arredondamento" },
    { forma: "CARTAO", informado: 2373.94, calculado: 2373.93, oficial: 2373.93, diferenca: 0, justificativa: "" },
    { forma: "PIX", informado: 1161.78, calculado: 1161.78, oficial: 1161.78, diferenca: 0, justificativa: "" },
    { forma: "CHEQUE A VISTA", informado: 26.99, calculado: 26.99, oficial: 26.99, diferenca: 0, justificativa: "" }
  ]
};

export const MOCK_HISTORY = [
  { id: 101, data: '2025-11-23', operador: 'João Silva', status: 'Aprovado', quebra: -2.50 },
  { id: 102, data: '2025-11-23', operador: 'Maria Souza', status: 'Aprovado', quebra: 0.00 },
  { id: 103, data: '2025-11-24', operador: 'Carlos Lima', status: 'Pendente', quebra: -15.00 },
  { id: 104, data: '2025-11-24', operador: 'Ana Paula', status: 'Pendente', quebra: 1.20 },
];

export const MOCK_SANGRIAS = [
  { id: '1', operador: 'João Silva', data: '2025-11-24', valor: 500.00, motivo: 'Excesso de Caixa' },
  { id: '2', operador: 'Maria Souza', data: '2025-11-24', valor: 350.00, motivo: 'Pagamento Fornecedor' },
  { id: '3', operador: 'João Silva', data: '2025-11-24', valor: 200.00, motivo: 'Excesso de Caixa' },
  { id: '4', operador: 'Carlos Lima', data: '2025-11-23', valor: 800.00, motivo: 'Excesso de Caixa' },
  { id: '5', operador: 'Ana Paula', data: '2025-11-23', valor: 150.00, motivo: 'Compra Material Limpeza' },
];
