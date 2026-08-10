// Centralizador Dinâmico de Endpoints do Backend (HTTP / WebSocket)
// Adapta-se automaticamente entre ambiente local (localhost:8000) e servidores do Coolify na Nuvem

const getApiUrl = () => {
  const customUrl = import.meta.env.VITE_API_URL;
  if (customUrl && typeof customUrl === 'string' && customUrl.trim() !== '') {
    return customUrl.replace(/\/$/, ''); // Remover barra no final caso exista
  }
  return 'http://localhost:8000';
};

const getWsUrl = () => {
  const customWsUrl = import.meta.env.VITE_WS_URL;
  if (customWsUrl && typeof customWsUrl === 'string' && customWsUrl.trim() !== '') {
    return customWsUrl.replace(/\/$/, '');
  }
  
  // Se houver uma URL HTTP personalizada configurada no Coolify, converter automaticamente para WS/WSS
  const apiUrl = getApiUrl();
  if (apiUrl !== 'http://localhost:8000') {
    if (apiUrl.startsWith('https://')) {
      return apiUrl.replace(/^https:\/\//, 'wss://');
    } else if (apiUrl.startsWith('http://')) {
      return apiUrl.replace(/^http:\/\//, 'ws://');
    }
  }
  
  return 'ws://localhost:8000';
};

export const API_BASE = getApiUrl();
export const WS_BASE = getWsUrl();

export const fetchApi = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  return fetch(url, { ...options, headers });
};
