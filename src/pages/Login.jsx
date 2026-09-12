import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';

export default function Login() {
  const { isAuthenticated, checkUserAuth } = useAuth();
  const { language } = useLanguage(); const en = language === 'en';
  const navigate = useNavigate(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  if (isAuthenticated) return <Navigate to="/" replace />;
  async function submit(event) { event.preventDefault(); setLoading(true); setError(''); try { await base44.auth.login(email, password); await checkUserAuth(); navigate('/'); } catch (e) { setError(en ? 'Unable to sign in. Check your email and password and try again.' : 'No se ha podido iniciar sesión. Comprueba el email y la contraseña e inténtalo de nuevo.'); } finally { setLoading(false); } }
  return <AuthLayout icon={LogIn} title="Track&Race" subtitle={en ? 'Sign in to continue' : 'Inicia sesión para continuar'}><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">Email<input className="mt-1 w-full rounded-md border p-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label className="block text-sm font-medium">{en ? 'Password' : 'Contraseña'}<input className="mt-1 w-full rounded-md border p-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label><div className="text-right"><Link className="text-sm text-primary underline" to="/forgot-password">{en ? 'Forgot your password?' : '¿Has olvidado tu contraseña?'}</Link></div>{error && <p className="text-sm text-red-600">{error}</p>}<button className="w-full rounded-md bg-primary p-2 text-primary-foreground disabled:opacity-50" disabled={loading}>{loading ? (en ? 'Signing in…' : 'Entrando…') : (en ? 'Sign in' : 'Entrar')}</button></form></AuthLayout>;
}
