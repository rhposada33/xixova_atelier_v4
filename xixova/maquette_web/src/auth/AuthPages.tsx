import {useEffect,useState,type FormEvent} from 'react';
import {Link,Navigate,useLocation,useNavigate} from 'react-router-dom';
import {getSupabaseClient} from '../infrastructure/supabase/client';
import {useAuth} from './AuthContext';
import './auth.css';

const authMessage=(message:string)=>/invalid login credentials/i.test(message)?'E-mail ou senha inválidos.':/email not confirmed/i.test(message)?'Confirme seu e-mail antes de entrar.':'Não foi possível concluir a solicitação. Tente novamente.';

export function LoginPage(){
  const {session,loading}=useAuth();const navigate=useNavigate();const location=useLocation();
  const requested=new URLSearchParams(location.search).get('returnTo');const returnTo=requested?.startsWith('/')&&!requested.startsWith('//')?requested:(location.state as any)?.from||'/portal';
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  if(!loading&&session)return <Navigate to={returnTo} replace/>;
  const submit=async(event:FormEvent)=>{event.preventDefault();setBusy(true);setError('');const {error:authError}=await getSupabaseClient().auth.signInWithPassword({email,password});setBusy(false);if(authError)setError(authMessage(authError.message));else navigate(returnTo,{replace:true});};
  return <AuthFrame title="Acesse o Portal Escobar" subtitle="Gestão segura do inventário imobiliário.">
    <form onSubmit={submit} className="auth-form" aria-busy={busy}>
      <label>E-mail<input type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)}/></label>
      <label>Senha<input type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)}/></label>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={busy}>{busy?'Entrando…':'Entrar'}</button>
      <Link to="/forgot-password">Esqueci minha senha</Link>
    </form>
  </AuthFrame>;
}

export function ForgotPasswordPage(){
  const [email,setEmail]=useState('');const [sent,setSent]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const submit=async(event:FormEvent)=>{event.preventDefault();setBusy(true);setError('');const redirectTo=`${location.origin}/reset-password`;const {error:authError}=await getSupabaseClient().auth.resetPasswordForEmail(email,{redirectTo});setBusy(false);if(authError)setError(authMessage(authError.message));else setSent(true);};
  return <AuthFrame title="Recuperar senha" subtitle="Enviaremos um link seguro para o seu e-mail.">
    {sent?<div className="auth-notice" role="status"><h2>Verifique sua caixa de entrada</h2><p>Se o endereço estiver cadastrado, você receberá as instruções para redefinir a senha.</p><Link to="/login">Voltar ao login</Link></div>:
    <form onSubmit={submit} className="auth-form"><label>E-mail<input type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)}/></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy?'Enviando…':'Enviar link de recuperação'}</button><Link to="/login">Voltar ao login</Link></form>}
  </AuthFrame>;
}

export function ResetPasswordPage(){
  const {session,loading}=useAuth();const [password,setPassword]=useState('');const [confirmation,setConfirmation]=useState('');const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);const [error,setError]=useState('');
  const invalid=!loading&&!session;
  const submit=async(event:FormEvent)=>{event.preventDefault();if(password.length<8){setError('A senha deve ter pelo menos 8 caracteres.');return;}if(password!==confirmation){setError('As senhas não coincidem.');return;}setBusy(true);setError('');const {error:authError}=await getSupabaseClient().auth.updateUser({password});setBusy(false);if(authError)setError(authMessage(authError.message));else setDone(true);};
  return <AuthFrame title="Criar nova senha" subtitle="Escolha uma senha segura para continuar.">
    {loading?<p role="status">Validando o link…</p>:invalid?<div className="auth-notice" role="alert"><h2>Link inválido ou expirado</h2><p>Solicite um novo link de recuperação.</p><Link to="/forgot-password">Solicitar novo link</Link></div>:done?<div className="auth-notice" role="status"><h2>Senha atualizada</h2><p>Sua nova senha já está ativa.</p><Link to="/portal">Continuar para o portal</Link></div>:<form onSubmit={submit} className="auth-form"><label>Nova senha<input type="password" autoComplete="new-password" required value={password} onChange={event=>setPassword(event.target.value)}/></label><label>Confirmar nova senha<input type="password" autoComplete="new-password" required value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy?'Atualizando…':'Atualizar senha'}</button></form>}
  </AuthFrame>;
}

function AuthFrame({title,subtitle,children}:{title:string;subtitle:string;children:React.ReactNode}){useEffect(()=>{document.title=`${title} · Escobar`;},[title]);return <main className="auth-page"><section className="auth-brand" aria-label="Escobar"><span>ESCOBAR</span><p>Viver é uma arte</p></section><section className="auth-card"><p className="eyebrow">Portal administrativo</p><h1>{title}</h1><p className="auth-subtitle">{subtitle}</p>{children}<p className="auth-private">Acesso exclusivo para usuários autorizados. Não há cadastro público.</p></section></main>}
