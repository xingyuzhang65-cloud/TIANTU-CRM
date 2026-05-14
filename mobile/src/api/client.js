import axios from 'axios';
import { Platform } from 'react-native';

const TOKEN_KEY = 'auth_token';

// Web平台用localStorage，原生平台用expo-secure-store
let SecureStore = null;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
}

const storage = {
  async getItem(key) {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async setItem(key, value) {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    return SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key) {
    if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
    return SecureStore.deleteItemAsync(key);
  },
};

const BACKEND_TUNNEL = 'https://green-socks-crash.loca.lt';
const getBaseURL = () => {
  if (typeof window !== 'undefined' && window.location.hostname.includes('loca.lt')) {
    return BACKEND_TUNNEL;
  }
  return 'http://localhost:8000';
};

const client = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(async (config) => {
  const token = await storage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err.response?.data?.msg || err.message || 'Network error';
    return Promise.reject(new Error(msg));
  }
);

export const setToken = (token) => storage.setItem(TOKEN_KEY, token);
export const clearToken = () => storage.deleteItem(TOKEN_KEY);
export const getToken = () => storage.getItem(TOKEN_KEY);

export default client;
