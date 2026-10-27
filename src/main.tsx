import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';

import App from './App';

import './styles.css';
import './brand-theme.css';

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