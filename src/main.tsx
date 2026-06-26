import { StrictMode } from 'react';
import App from './App.tsx';
import { mountApp } from './lib/bootstrap.ts';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Elemento #root não encontrado');
}

const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

void mountApp(container, app);
