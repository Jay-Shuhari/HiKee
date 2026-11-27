import { useEffect, useRef, useState } from 'react';
import type { Chat } from '../data/types';
import { I } from '../lib/icons';
import { firstName } from '../lib/format';
import { enter, setPage, setView, useApp } from '../state/store';
import { Avatar } from './common';

export function Modal() {
  const cf = useApp((s) => s.confirm);
  const last = useRef(cf);
  if (cf) last.current = cf;
  const c = cf || last.current;
  const ok = useRef<HTMLButtonElement>(null);
  const close = () => useApp.setState({ confirm: null });
  useEffect(() => {
    if (!cf) return;
    setTimeout(() => ok.current?.focus(), 50);
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [cf]);
  return (
    <div className={`modal ${cf ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="mcard" role="alertdialog" aria-modal="true" aria-labelledby="mT">
        <h3 id="mT">{c?.title}</h3><p>{c?.body}</p>
        <div className="row">
          <button className="btn ghost" onClick={close}>Cancel</button>
          <button className={`btn ${c?.cls || ''}`} ref={ok} onClick={() => { close(); c?.fn(); }}>{c?.ok}</button>
        </div>
      </div>
    </div>
  );
}

export function Toast() {
  const t = useApp((s) => s.toast);
  const [open, setOpen] = useState(false);
  const last = useRef(t);
  if (t) last.current = t;
  useEffect(() => {
    if (!t) return;
    setOpen(true);
    const h = setTimeout(() => setOpen(false), t.label ? 6000 : 3400);
    return () => clearTimeout(h);
  }, [t]);
  const x = t || last.current;
  return (
    <div className={`toast ${open ? 'open' : ''}`} role="status">
      <span>{x?.msg}</span>
      {x?.label ? <button onClick={() => { x.fn?.(); setOpen(false); }}>{x.label}</button> : null}
    </div>
  );
}

export function TabBar({ c }: { c: Chat | null }) {
  const page = useApp((s) => s.page);
  const view = useApp((s) => s.view);
  const un = useApp((s) => s.chats.reduce((n, x) => n + x.unread, 0));
  const tabs: [typeof page, string, React.ReactNode][] = [
    ['home', 'Chats', <><I n="chats" />{un ? <span className="badge">{un}</span> : null}</>],
    ['chat', c ? firstName(c.name) : 'Chat', c ? <Avatar c={c} sz={26} dot={false} /> : <I n="chats" />],
    ['media', 'Media', <I n="media" />],
  ];
  return (
    <nav className="tabbar" aria-label="Pages">
      {tabs.map(([k, l, ic]) => (
        <button key={k} className={`tab ${page === k ? 'on' : ''}`} aria-current={page === k ? 'page' : undefined} disabled={k === 'chat' && !c}
          onClick={() => { if (k === 'chat' && view) setView(null); setPage(k); }}>
          <span className="ti">{ic}</span><span>{l}</span>
        </button>
      ))}
    </nav>
  );
}

/* ---------- sign in / sign up / confirm / reset (AWS) and "logged out" (demo) ---------- */
type Step = 'in' | 'up' | 'confirm' | 'forgot' | 'reset';

export function AuthScreen() {
  const phase = useApp((s) => s.phase);
  const backend = useApp((s) => s.backend);
  const [step, setStep] = useState<Step>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const open = phase === 'out';
  const demo = backend?.mode !== 'aws';

  async function finish() {
    const me = await backend!.currentUser();
    if (me) { setPw(''); setCode(''); await enter(me); }
    else setErr('Signed in, but your profile couldn’t be loaded. Please try again.');
  }

  async function run(fn: () => Promise<void>) {
    setErr(''); setNote(''); setBusy(true);
    try { await fn(); } catch (e) { setErr(nice(e)); } finally { setBusy(false); }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 'in') run(async () => {
      const r = await backend!.signIn(email, pw);
      if (r === 'done') return finish();
      if (r === 'confirm') { await backend!.resendCode(email).catch(() => {}); setStep('confirm'); setNote('Enter the code we emailed you to confirm your account.'); }
      if (r === 'reset') { setStep('reset'); setNote('Please set a new password. We emailed you a code.'); }
    });
    if (step === 'up') run(async () => {
      const r = await backend!.signUp(name, email, pw);
      if (r === 'done') { await backend!.signIn(email, pw); return finish(); }
      setStep('confirm'); setNote(`We sent a 6-digit code to ${email}.`);
    });
    if (step === 'confirm') run(async () => {
      await backend!.confirmSignUp(email, code);
      if (pw) { await backend!.signIn(email, pw); return finish(); }
      setStep('in'); setNote('Account confirmed. Sign in to continue.');
    });
    if (step === 'forgot') run(async () => { await backend!.forgotPassword(email); setStep('reset'); setNote(`We sent a reset code to ${email}.`); });
    if (step === 'reset') run(async () => {
      await backend!.resetPassword(email, code, pw);
      await backend!.signIn(email, pw); return finish();
    });
  };

  if (demo) return (
    <div className={`out ${open ? 'open' : ''}`}>
      <div className="mcard">
        <img className="logo" src="/logo.png" alt="" />
        <h3>You're logged out</h3>
        <p>Your conversations are safe. Log in again to pick up where you left off.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => run(async () => { await backend!.signIn('', ''); await finish(); })}>Log in again</button>
        </div>
      </div>
    </div>
  );

  const titles: Record<Step, [string, string, string]> = {
    in: ['Welcome back', 'Sign in to HiKee to pick up where you left off.', 'Sign in'],
    up: ['Create your account', 'Chat, share files and call — all in one place.', 'Create account'],
    confirm: ['Check your email', 'Confirm your email address to finish setting up.', 'Confirm'],
    forgot: ['Reset your password', 'We’ll email you a code to set a new password.', 'Send code'],
    reset: ['Choose a new password', 'Enter the code from your email and a new password.', 'Save and sign in'],
  };
  const [title, sub, cta] = titles[step];
  return (
    <div className={`out ${open ? 'open' : ''}`}>
      <form className="mcard auth" onSubmit={submit}>
        <div className="head"><img className="logo" src="/logo.png" alt="" /><h3>{title}</h3><p>{sub}</p></div>
        {err ? <div className="err" role="alert">{err}</div> : null}
        {note ? <div className="note">{note}</div> : null}
        {step === 'up' ? <label className="fld"><span>Your name</span><input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" /></label> : null}
        {step !== 'confirm' || !email ? <label className="fld"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label> : null}
        {step === 'confirm' || step === 'reset' ? <label className="fld"><span>{step === 'confirm' ? 'Confirmation code' : 'Reset code'}</span><input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="one-time-code" /></label> : null}
        {step === 'in' || step === 'up' || step === 'reset' ? (
          <label className="fld"><span>{step === 'reset' ? 'New password' : 'Password'}</span>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} autoComplete={step === 'in' ? 'current-password' : 'new-password'} /></label>
        ) : null}
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : cta}</button>
        <div className="links">
          {step === 'in' ? <><button type="button" onClick={() => { setStep('up'); setErr(''); setNote(''); }}>Create an account</button><button type="button" onClick={() => { setStep('forgot'); setErr(''); setNote(''); }}>Forgot password?</button></> : null}
          {step === 'up' ? <button type="button" onClick={() => { setStep('in'); setErr(''); }}>I already have an account</button> : null}
          {step === 'confirm' ? <><button type="button" onClick={() => run(async () => { await backend!.resendCode(email); setNote('A new code is on its way.'); })}>Resend code</button><button type="button" onClick={() => setStep('in')}>Back to sign in</button></> : null}
          {step === 'forgot' || step === 'reset' ? <button type="button" onClick={() => { setStep('in'); setErr(''); setNote(''); }}>Back to sign in</button> : null}
        </div>
      </form>
    </div>
  );
}

function nice(e: unknown) {
  const err = e as { name?: string; message?: string };
  const map: Record<string, string> = {
    NotAuthorizedException: 'Incorrect email or password.',
    UserNotFoundException: 'There’s no account with that email.',
    UsernameExistsException: 'An account with that email already exists. Try signing in.',
    CodeMismatchException: 'That code isn’t right. Check your email and try again.',
    ExpiredCodeException: 'That code has expired. Request a new one.',
    InvalidPasswordException: 'Use at least 8 characters with upper and lower case letters, a number and a symbol.',
    LimitExceededException: 'Too many attempts. Wait a moment and try again.',
  };
  return (err.name && map[err.name]) || err.message || 'Something went wrong. Please try again.';
}
