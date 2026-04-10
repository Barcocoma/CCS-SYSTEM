export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';


function getStoredUser() {
  const rawUser = localStorage.getItem('user');
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}


export async function apiRequest(path, options = {}) {
  const storedUser = getStoredUser();
  const headers = new Headers(options.headers || {});
  const config = {
    method: options.method || 'GET',
    headers,
  };

  if (storedUser) {
    if (storedUser.id) headers.set('X-Actor-Id', String(storedUser.id));
    if (storedUser.username) headers.set('X-Actor-Name', storedUser.username);
    if (storedUser.tenant_id) headers.set('X-Tenant-Id', storedUser.tenant_id);
  }

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    config.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const response = await fetch(`${API_URL}${path}`, config);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload;
}
