// src/config.js
// src/config.js
export const API_BASE_URL = "http://83.234.174.96:8000/api";
export const WS_BASE_URL = "ws://83.234.174.96:8000";

// Или для разработки:
// export const API_BASE_URL = "http://localhost:8000/api";
// export const WS_BASE_URL = "ws://localhost:8000";
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