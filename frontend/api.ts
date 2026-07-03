import axios from 'axios';

// Em produção, usamos URLs relativas (Nginx faz proxy reverso para /api/* e /token)
// Em desenvolvimento, usa http://localhost:8000
const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
    baseURL: API_URL,
});

// Interceptor para adicionar o token em toda requisição
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const login = async (username, password) => {
    // O backend espera Form Data para o OAuth2PasswordRequestForm
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await api.post('/token', formData);
    return response.data; // { access_token, token_type }
};

export const getMe = async () => {
    const response = await api.get('/api/users/me');
    return response.data;
};

// --- SANGRIA API ---
export const getSangrias = async (params: { page?: number; page_size?: number; search?: string; date?: string } = {}) => {
    const response = await api.get('/api/sangrias/', { params });
    return response.data; // { items, total, page, page_size, pages, summary }
};

export const createSangria = async (data: { valor: number; motivo: string }) => {
    const response = await api.post('/api/sangrias/', data);
    return response.data;
};

export const updateSangriaStatus = async (id: number, status: string) => {
    const response = await api.put(`/api/sangrias/${id}/status`, { status });
    return response.data;
};

export const deleteSangria = async (id: number) => {
    const response = await api.delete(`/api/sangrias/${id}`);
    return response.data;
};

// --- PIX API ---
export const getPixEntries = async (params: { page?: number; page_size?: number; search?: string; date?: string; status?: string } = {}) => {
    const response = await api.get('/api/pix/', { params });
    return response.data; // { items, total, page, page_size, pages, summary }
};

export const createPix = async (data: { valor: number; observacao?: string; data_transacao: string }) => {
    const response = await api.post('/api/pix/', data);
    return response.data;
};

export const updatePixStatus = async (id: number, status: string) => {
    const response = await api.put(`/api/pix/${id}/status`, { status });
    return response.data;
};

export const deletePix = async (id: number) => {
    const response = await api.delete(`/api/pix/${id}`);
    return response.data;
};

// --- DASHBOARD API ---
export const getDashboardStats = async (data?: string) => {
    const params = data ? `?data=${data}` : '';
    const response = await api.get(`/api/dashboard/stats${params}`);
    return response.data;
};

// --- CLOSING API ---
export const getClosings = async (params: { page?: number; page_size?: number; status?: string; search?: string; start_date?: string; end_date?: string } = {}) => {
    const response = await api.get('/api/closings/', { params });
    return response.data; // { items, total, page, page_size, pages, summary }
};

export const getClosing = async (id: number) => {
    const response = await api.get(`/api/closings/${id}`);
    return response.data;
};

export const createClosing = async (data: any) => {
    const response = await api.post('/api/closings/', data);
    return response.data;
};

// Upload PDFs e extração de dados
export const uploadClosingPDFs = async (caixaPdf: File, diferencaPdf: File) => {
    const formData = new FormData();
    formData.append('caixa_pdf', caixaPdf);
    formData.append('diferenca_pdf', diferencaPdf);

    const response = await api.post('/api/closings/upload-pdfs', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

// Criar fechamento a partir dos dados extraídos dos PDFs
export const createClosingFromPDFs = async (data: {
    data_referencia: string;
    operador_nome: string;
    caixa: string;
    movimentos: any[];
    conferencia: any[];
    total_quebra: number;
}) => {
    const response = await api.post('/api/closings/create-from-pdfs', data);
    return response.data;
};

// Admin aprova fechamento
export const approveClosing = async (id: number, data?: {
    conferencias?: any[];
    observacao_gerente?: string;
}) => {
    const response = await api.put(`/api/closings/${id}/approve`, data || {});
    return response.data;
};

// Admin rejeita fechamento
export const rejectClosing = async (id: number, motivo: string) => {
    const response = await api.put(`/api/closings/${id}/reject`, { motivo });
    return response.data;
};

// Admin desaprova fechamento (volta para Pendente)
export const unapproveClosing = async (id: number) => {
    const response = await api.put(`/api/closings/${id}/unapprove`);
    return response.data;
};

// Admin exclui fechamento
export const deleteClosing = async (id: number) => {
    const response = await api.delete(`/api/closings/${id}`);
    return response.data;
};

// --- USER API ---
export const getUsers = async () => {
    const response = await api.get('/api/users/');
    return response.data;
};

export const getUser = async (id: number) => {
    const response = await api.get(`/api/users/${id}`);
    return response.data;
};

export const createUser = async (data: { login: string; nome: string; cargo: string; senha: string }) => {
    const response = await api.post('/api/users/', data);
    return response.data;
};

export const updateUser = async (id: number, data: { login?: string; nome?: string; cargo?: string; active?: boolean }) => {
    const response = await api.put(`/api/users/${id}`, data);
    return response.data;
};

export const deleteUser = async (id: number) => {
    const response = await api.delete(`/api/users/${id}`);
    return response.data;
};

export const updatePassword = async (id: number, data: { senha_atual: string; nova_senha: string }) => {
    const response = await api.put(`/api/users/${id}/password`, data);
    return response.data;
};

export const reactivateUser = async (id: number) => {
    const response = await api.post(`/api/users/${id}/reactivate`);
    return response.data;
};

// --- ESCALA DE TRABALHO ---
// Extrai a escala de um PDF via IA (retorna dados para revisão, não salva)
export const extractSchedulePDF = async (pdf: File) => {
    const formData = new FormData();
    formData.append('pdf', pdf);
    const response = await api.post('/api/schedules/extract', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data; // ExtractResult
};

// Salva/substitui a escala de um funcionário
export const saveSchedule = async (data: {
    user_id: number;
    num_weeks: number;
    source_filename?: string | null;
    days: any[];
}) => {
    const response = await api.post('/api/schedules/', data);
    return response.data;
};

// Lista funcionários + status da escala (admin)
export const getScheduleSummaries = async () => {
    const response = await api.get('/api/schedules/');
    return response.data; // ScheduleSummary[]
};

// Escala bruta (grade) de um funcionário (admin)
export const getUserSchedule = async (userId: number) => {
    const response = await api.get(`/api/schedules/user/${userId}`);
    return response.data;
};

// Escala bruta do próprio usuário
export const getMySchedule = async () => {
    const response = await api.get('/api/schedules/me');
    return response.data;
};

// Data-âncora global da Semana 1
export const getAnchor = async () => {
    const response = await api.get('/api/schedules/anchor');
    return response.data; // { anchor_date }
};

export const setAnchor = async (anchor_date: string | null) => {
    const response = await api.put('/api/schedules/anchor', { anchor_date });
    return response.data;
};

// Integração OpenAI (configurável pela UI, admin)
export const getIntegration = async () => {
    const response = await api.get('/api/schedules/integration');
    return response.data; // { configured, model, key_last4, source }
};

export const setIntegration = async (data: { api_key?: string | null; model?: string }) => {
    const response = await api.put('/api/schedules/integration', data);
    return response.data;
};

// Visão geral (semana ou mês x todos os funcionários) - admin
export const getScheduleOverview = async (start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const qs = params.toString();
    const response = await api.get(`/api/schedules/overview${qs ? `?${qs}` : ''}`);
    return response.data; // { week_start, dates, anchor_date, employees }
};

// Jornada calculada (self)
export const getMyJourney = async (start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const response = await api.get(`/api/schedules/journey?${params.toString()}`);
    return response.data; // JourneyResponse
};

// Jornada calculada de um funcionário (admin)
export const getUserJourney = async (userId: number, start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const response = await api.get(`/api/schedules/journey/${userId}?${params.toString()}`);
    return response.data;
};

// --- LOGOUT ---
export const logout = () => {
    localStorage.removeItem('token');
};

export default api;
