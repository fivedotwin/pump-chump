import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Buffer } from 'buffer';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

// 🔧 Essential polyfills for Solana wallets
window.Buffer = Buffer;
window.global = window.global || window;
window.process = window.process || {
  env: { NODE_ENV: 'production' },
  version: 'v18.0.0',
  versions: { node: '18.0.0' },
  browser: true,
  nextTick: (fn: Function) => setTimeout(fn, 0)
};

console.log('✅ Buffer polyfill loaded:', {
  'Buffer': typeof window.Buffer,
  'Buffer.alloc': typeof window.Buffer?.alloc,
  'Process': typeof window.process,
  'Global': typeof window.global
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
