import axios from 'axios';

/**
 * Instancia de Axios apuntando al backend NestJS del restaurante.
 * Adjunta el JWT (guardado en localStorage por el flujo de auth) en cada
 * petición y, ante un 401, limpia la sesión y redirige al login.
 */
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3002/api',
});

api.interceptors.request.use((config) => {
  const raw = localStorage.getItem('userDetails');
  if (raw) {
    try {
      const { idToken } = JSON.parse(raw);
      if (idToken) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${idToken}`;
      }
    } catch (e) {
      // token corrupto: se ignora
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const path = window.location.pathname;
      if (!path.endsWith('/login')) {
        localStorage.removeItem('userDetails');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
