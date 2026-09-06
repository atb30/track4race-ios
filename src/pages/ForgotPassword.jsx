import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { base44 } from '@/api/base44Client';

export default function ForgotPassword() {
  const [email, setEmail] = useState(''); const [loading, setLoading] = useState(false); const [sent, setSent] = useState(false); const [error, setError] = useState('');
  async function submit(event) { event.preventDefault(); setLoading(true); setError(''); try { await base44.auth.forgotPassword(email); setSent(true); } catch (e) { setError(e.message); } finally { setLoading(false); } }
  return <AuthLayout icon={KeyRound} title="Recuperar contraseña" subtitle="Te enviaremos un enlace de un solo uso"><form onSubmit={submit} className="space-y-4">{sent ? <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">Si existe una cuenta con ese email, recibirás un enlace en unos minutos.</p> : <><label className="block text-sm font-medium">Email<input className="mt-1 w-full rounded-md border p-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>{error && <p className="text-sm text-red-600">{error}</p>}<button className="w-full rounded-md bg-primary p-2 text-primary-foreground disabled:opacity-50" disabled={loading}>{loading ? 'Enviando…' : 'Enviar enlace'}</button></>}<p className="text-center text-sm"><Link className="text-primary underline" to="/login">Volver a iniciar sesión</Link></p></form></AuthLayout>;
}
