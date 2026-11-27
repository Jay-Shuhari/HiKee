import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { boot } from './state/store';
import './styles.css';

boot();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// Dev-only handle for debugging and automated UI checks; stripped from production builds.
if (import.meta.env.DEV) (window as unknown as { __hikee: unknown }).__hikee = { useApp: (await import('./state/store')).useApp };
