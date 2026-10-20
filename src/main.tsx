import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { instalarTornada } from './lib/legal';
import './index.css';

// Abans de pintar: si es torna de l'entorn legal, es recupera on s'era
instalarTornada();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
