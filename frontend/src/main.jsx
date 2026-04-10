import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { API_URL } from './lib/api.js';
import { initAutoUpdate } from './lib/autoUpdate.js';

// Initialize auto-update checker
initAutoUpdate();

const nativeFetch = window.fetch.bind(window);

window.fetch = async (input, init = {}) => {
  const requestUrl = typeof input === 'string' ? input : input?.url || '';
  const shouldAttachActor =
    requestUrl.startsWith(`${API_URL}/api/`) ||
    requestUrl.startsWith('/api/');

  if (!shouldAttachActor) {
    return nativeFetch(input, init);
  }

  const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
  const rawUser = localStorage.getItem('user');

  if (rawUser) {
    try {
      const user = JSON.parse(rawUser);
      if (user?.id) headers.set('X-Actor-Id', String(user.id));
      if (user?.username) headers.set('X-Actor-Name', user.username);
      if (user?.tenant_id) headers.set('X-Tenant-Id', user.tenant_id);
    } catch {
      // Ignore malformed localStorage values and proceed with the original request.
    }
  }

  return nativeFetch(input, {
    ...init,
    headers,
  });
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
