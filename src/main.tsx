import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Critical Latin font weights for immediate first paint
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';

import App from './App';
import { scheduleDeferredTask } from './lib/storage';

import './styles.css';
import './brand-theme.css';
import './final-auth-alerts.css';

// Defer non-critical font weights & extended character subsets until idle
scheduleDeferredTask(() => {
  void import('@fontsource/inter/latin-500.css');
  void import('@fontsource/inter/latin-700.css');
  void import('@fontsource/inter/latin-ext-400.css');
  void import('@fontsource/inter/latin-ext-600.css');
  void import('@fontsource/inter/latin-ext-700.css');
  void import('@fontsource/cormorant-garamond/latin-600.css');
  void import('@fontsource/cormorant-garamond/latin-700.css');
}, 60);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
