import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import LoginGate from './screens/LoginGate';
import './index.css';
import './design-system/buttonGlossy.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LoginGate>
        <App />
      </LoginGate>
    </ErrorBoundary>
  </React.StrictMode>
);
