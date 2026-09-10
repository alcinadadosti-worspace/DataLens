import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import './index.css';
import './design-system/buttonGlossy.css';

// O gate de PIN vive dentro de App.tsx, um por modo (Loja/VD) — não há mais um LoginGate global
// aqui em cima, senão o usuário precisaria digitar dois códigos em sequência pra entrar.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
