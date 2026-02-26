// CallTrack API client
const API_URL = import.meta.env.VITE_API_URL || 'https://call-track-backend-production.up.railway.app';

let token = localStorage.getItem('ct_token');

function headers(json = false) {
  const h = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export async function login(email, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Invalid credentials');
  const data = await res.json();
  token = data.token;
  localStorage.setItem('ct_token', token);
  localStorage.setItem('ct_email', data.email);
  return data;
}

export function logout() {
  token = null;
  localStorage.removeItem('ct_token');
  localStorage.removeItem('ct_email');
}

export function getStoredAuth() {
  const t = localStorage.getItem('ct_token');
  const email = localStorage.getItem('ct_email');
  if (!t) return null;
  // Check JWT expiry
  try {
    const payload = JSON.parse(atob(t.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) {
      logout();
      return null;
    }
    token = t;
    return { email };
  } catch {
    logout();
    return null;
  }
}

export async function fetchRecords(limit = 10000, skip = 0, sort = 'newest') {
  const res = await fetch(`${API_URL}/api/records?limit=${limit}&skip=${skip}&sort=${sort}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error('Failed to fetch records');
  return res.json();
}

export async function deleteRecord(id) {
  const res = await fetch(`${API_URL}/api/records/${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) throw new Error('Failed to delete record');
  return res.json();
}

export async function getRecordingUrl(recordingKey) {
  const res = await fetch(`${API_URL}/api/recordings/${encodeURIComponent(recordingKey)}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error('Failed to get recording URL');
  const data = await res.json();
  return data.url;
}

export async function getContactMappings() {
  const res = await fetch(`${API_URL}/api/settings/contact-mappings`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error('Failed to fetch mappings');
  return res.json();
}

export async function saveContactMappings(mappings) {
  const res = await fetch(`${API_URL}/api/settings/contact-mappings`, {
    method: 'PUT',
    headers: headers(true),
    body: JSON.stringify(mappings),
  });
  if (!res.ok) throw new Error('Failed to save mappings');
  return res.json();
}
