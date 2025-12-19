import axios from 'axios';

// Ler URL da API do .env (Vite usa import.meta.env)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

// --- CLOSING API ---
export const getClosings = async () => {
    const response = await api.get('/api/closings/');
    return response.data;
};

export const createClosing = async (data: any) => {
    const response = await api.post('/api/closings/', data);
    return response.data;
};

export default api;
