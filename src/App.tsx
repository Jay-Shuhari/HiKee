import { useEffect } from 'react';
import { Left } from './components/Left';
import { Centre } from './components/Centre';
import { Right } from './components/Right';
import { Viewer } from './components/Viewer';
import { AuthScreen, Modal, TabBar, Toast } from './components/Overlays';
import { curChat, isMob, setPage, setView, useApp } from './state/store';
import { setUrlResolver } from './state/audio';
import { hangUp } from './state/call';

function useTheme() {
  const theme = useApp((s) => s.theme);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0e1015' : '#f3f4f7');
      useApp.setState({}); // re-render readers of the resolved theme
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export default function App() {
  useTheme();
  const phase = useApp((s) => s.phase);
  const page = useApp((s) => s.page);
  const backend = useApp((s) => s.backend);
  const c = useApp((s) => curChat(s));
  const unread = useApp((s) => s.chats.reduce((n, x) => n + (s.muted.includes(x.id) ? 0 : x.unread), 0));

  useEffect(() => { if (backend) setUrlResolver((k) => backend.url(k)); }, [backend]);
  useEffect(() => { document.body.dataset.page = page; }, [page]);
  useEffect(() => { document.title = unread ? `(${unread}) HiKee` : 'HiKee'; }, [unread]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useApp.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (isMob()) setPage('home'); document.getElementById('q')?.focus(); return; }
      if (e.key !== 'Escape' || s.viewer || s.confirm) return;
      if (s.call) { if (s.call.phase !== 'incoming') hangUp(); return; }
      if (document.querySelector('.pop.open, .box.rec')) return; // the composer / menu handle their own Escape
      if (s.view) { setView(null); if (isMob()) setPage('media'); return; }
      if (isMob() && s.page === 'chat') setPage('home');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (phase === 'boot') return <div className="boot"><img src="/logo.png" alt="Loading HiKee" /></div>;

  return (
    <>
      <div className="app">
        {phase === 'in' ? <><Left c={c} /><Centre c={c} /><Right /></> : null}
      </div>
      {phase === 'in' ? <TabBar c={c} /> : null}
      <Viewer />
      <Modal />
      <Toast />
      <AuthScreen />
    </>
  );
}
