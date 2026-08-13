// Centralizador Dinâmico de Endpoints do Backend (HTTP / WebSocket)
// Adapta-se automaticamente entre ambiente local (localhost:8000) e servidores do Coolify na Nuvem

const getApiUrl = () => {
  const customUrl = import.meta.env.VITE_API_URL;
  let url = 'http://localhost:8000';

  if (customUrl && typeof customUrl === 'string' && customUrl.trim() !== '') {
    url = customUrl.trim().replace(/\/$/, '');
  } else if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // Fallback de produção explícito para HTTP, pois o sslip.io gerado pode não ter HTTPS nativo
    url = 'http://fsit226mdiud42a8v7eg3w4f.144.91.110.199.sslip.io';
  }

  // Prevenir erros de Conteúdo Misto (Mixed Content): Se a página rodar em HTTPS, o backend DEVE ser chamado via HTTPS
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
    url = url.replace(/^http:\/\//, 'https://');
  }

  return url;
};

const getWsUrl = () => {
  const customWsUrl = import.meta.env.VITE_WS_URL;
  if (customWsUrl && typeof customWsUrl === 'string' && customWsUrl.trim() !== '') {
    let wsUrl = customWsUrl.trim().replace(/\/$/, '');
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && wsUrl.startsWith('ws://')) {
      wsUrl = wsUrl.replace(/^ws:\/\//, 'wss://');
    }
    return wsUrl;
  }
  
  const apiUrl = getApiUrl();
  if (apiUrl.startsWith('https://')) {
    return apiUrl.replace(/^https:\/\//, 'wss://');
  } else if (apiUrl.startsWith('http://')) {
    return apiUrl.replace(/^http:\/\//, 'ws://');
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
