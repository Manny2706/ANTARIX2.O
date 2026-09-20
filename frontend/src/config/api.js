export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sat-query-ai-ten.vercel.app';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE_URL;
export const SOCKET_KEY = import.meta.env.VITE_SOCKET_KEY || 'bgvpit303269bgwb9nishant';
export const DEFAULT_USER_ID = import.meta.env.VITE_USER_ID || '70fa21d1-c6c0-4766-a264-9c2d418352c2';

export const AUTH_ENDPOINTS = {
  REGISTER: `${API_BASE_URL}/api/auth/register`,
  LOGIN: `${API_BASE_URL}/api/auth/login`,
};

export const HISTORY_ENDPOINTS = {
  CONVERSATIONS: `${API_BASE_URL}/api/history/conversations`,
  MESSAGES: `${API_BASE_URL}/api/history/messages`,
};
