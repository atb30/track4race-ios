import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';

export default function ResetPassword() {
  const [params] = useSearchParams(); const navigate = useNavigate(); const token = params.get('token'); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const { language } = useLanguage(); const en = language === 'en';
  async function submit(event) { event.preventDefault(); setError(''); if (password !== confirm) return setError(en ? 'Passwords do not match' : 'Las contraseñas no coinciden'); setLoading(true); try { await base44.auth.resetPassword(token, password); navigate('/login', { replace: true }); } catch (e) { setError(e.message); } finally { setLoading(false); } }
  return <AuthLayout icon={KeyRound} title={en ? 'New password' : 'Nueva contraseña'} subtitle={en ? 'Choose a password of at least 10 characters' : 'Elige una contraseña de al menos 10 caracteres'}><form onSubmit={submit} className="space-y-4">{!token ? <p className="text-sm text-red-600">{en ? 'This link is invalid.' : 'El enlace no es válido.'}</p> : <><label className="block text-sm font-medium">{en ? 'New password' : 'Nueva contraseña'}<input className="mt-1 w-full rounded-md border p-2" type="password" minLength="10" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus /></label><label className="block text-sm font-medium">{en ? 'Repeat password' : 'Repetir contraseña'}<input className="mt-1 w-full rounded-md border p-2" type="password" minLength="10" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></label>{error && <p className="text-sm text-red-600">{error}</p>}<button className="w-full rounded-md bg-primary p-2 text-primary-foreground disabled:opacity-50" disabled={loading}>{loading ? (en ? 'Saving…' : 'Guardando…') : (en ? 'Change password' : 'Cambiar contraseña')}</button></>}<p className="text-center text-sm"><Link className="text-primary underline" to="/login">{en ? 'Back to sign in' : 'Volver a iniciar sesión'}</Link></p></form></AuthLayout>;
}

