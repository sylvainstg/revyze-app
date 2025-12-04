import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './src/index.css';
import './i18n';
import { AdminProvider } from './contexts/AdminContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AdminProvider>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>}>
        <App />
      </Suspense>
    </AdminProvider>
  </React.StrictMode>
);