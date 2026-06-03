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
export const getSangrias = async () => {
    const response = await api.get('/api/sangrias/');
    return response.data;
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
export const getPixEntries = async () => {
    const response = await api.get('/api/pix/');
    return response.data;
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
export const getClosings = async (status?: string) => {
    const params = status ? `?status=${status}` : '';
    const response = await api.get(`/api/closings/${params}`);
    return response.data;
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

// --- LOGOUT ---
export const logout = () => {
    localStorage.removeItem('token');
};

export default api;
