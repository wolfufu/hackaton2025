// src/config.js
const getConfig = () => {
  const hostname = window.location.hostname;
  
  console.log('Current hostname:', hostname); // Для отладки
  
  // Для локальной разработки
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return {
      API_BASE: 'http://localhost:8000/api',
      WS_BASE: 'ws://localhost:8000'
    };
  } 
  // Для подключения по сети
  else {
    return {
      API_BASE: `http://${hostname}:8000/api`,
      WS_BASE: `ws://${hostname}:8000`
    };
  }
};

export const { API_BASE, WS_BASE } = getConfig();