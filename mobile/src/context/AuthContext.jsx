import { createContext, useContext, useReducer, useEffect } from 'react';
import client, { setToken, clearToken, getToken } from '../api/client';

const AuthContext = createContext(null);

const initialState = {
  user: null,
  token: null,
  isLoading: true,
};

function reducer(state, action) {
  switch (action.type) {
    case 'RESTORE_TOKEN':
      return { ...state, token: action.token, user: action.user, isLoading: false };
    case 'LOGIN':
      return { ...state, token: action.token, user: action.user, isLoading: false };
    case 'LOGOUT':
      return { ...state, token: null, user: null, isLoading: false };
    case 'LOADED':
      return { ...state, isLoading: false };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const res = await client.get('/api/auth/me');
          if (res.ok) {
            dispatch({ type: 'RESTORE_TOKEN', token, user: res.user });
          } else {
            await clearToken();
            dispatch({ type: 'LOADED' });
          }
        } else {
          dispatch({ type: 'LOADED' });
        }
      } catch {
        await clearToken();
        dispatch({ type: 'LOADED' });
      }
    })();
  }, []);

  const login = async (username, password) => {
    const res = await client.post('/api/auth/login', { username, password });
    if (!res.ok) throw new Error(res.msg);
    await setToken(res.token);
    dispatch({ type: 'LOGIN', token: res.token, user: res.user });
    return res.user;
  };

  const register = async (username, password, name, phone) => {
    const res = await client.post('/api/auth/register', { username, password, name, phone });
    if (!res.ok) throw new Error(res.msg);
    await setToken(res.token);
    dispatch({ type: 'LOGIN', token: res.token, user: res.user });
    return res.user;
  };

  const logout = async () => {
    await clearToken();
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
