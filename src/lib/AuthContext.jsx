import React, { createContext, useContext, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    try { setUser(await base44.auth.me()); } catch { setUser(null); } finally { setIsLoadingAuth(false); }
  };
  useEffect(() => { checkUserAuth(); }, []);
  const logout = (redirect = true) => { setUser(null); base44.auth.logout(redirect); };
  return <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), isLoadingAuth, isLoadingPublicSettings: false, authError: user ? null : { type: 'auth_required' }, appPublicSettings: null, logout, navigateToLogin: base44.auth.redirectToLogin, checkUserAuth, checkAppState: checkUserAuth, authChecked: !isLoadingAuth }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  return value;
};
