import { createContext, useState, useCallback, useEffect } from 'react';
import client from '../api/client';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const stored = localStorage.getItem('user');
    if (token && stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username, password, totpCode) => {
    const resp = await client.post('/auth/login', {
      username,
      password,
      totp_code: totpCode || '',
    });
    const { access_token, requires_totp_setup, totp_provisioning_uri } = resp.data;

    localStorage.setItem('access_token', access_token);
    const userData = { username, requires_totp_setup, totp_provisioning_uri };
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);

    return { requires_totp_setup, totp_provisioning_uri };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const isAuthenticated = !!user && !!localStorage.getItem('access_token');

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
