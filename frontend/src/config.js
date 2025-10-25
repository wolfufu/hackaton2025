// src/config.js
const getConfig = () => {
  // В продакшене API будет через nginx proxy
  if (process.env.NODE_ENV === 'production') {
    return {
      API_BASE: '/api',
      WS_BASE: window.location.protocol === 'https:' ? 'wss://' + window.location.host : 'ws://' + window.location.host
    };
  }
  
  // Локальная разработка
  return {
    API_BASE: 'http://localhost:8000/api',
    WS_BASE: 'ws://localhost:8000'
  };
};

export const { API_BASE, WS_BASE } = getConfig();