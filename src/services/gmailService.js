import { APP_CONFIG, auth } from './firebase';

const GMAIL_BACKEND_URL = APP_CONFIG?.gmailBackendUrl || 'https://us-central1-finanzapp-fb.cloudfunctions.net/api';

async function getAuthHeader() {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export async function checkGmailStatus(uid) {
  if (!uid) return { connected: false };
  try {
    const headers = await getAuthHeader();
    const res = await fetch(`${GMAIL_BACKEND_URL}/status?uid=${encodeURIComponent(uid)}`, { headers });
    if (!res.ok) return { connected: false };
    return await res.json();
  } catch (err) {
    console.warn('Gmail status check failed:', err);
    return { connected: false };
  }
}

export async function disconnectGmail(uid) {
  if (!uid) return;
  try {
    const headers = await getAuthHeader();
    await fetch(`${GMAIL_BACKEND_URL}/disconnect`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid })
    });
    localStorage.removeItem('finanzapp:gmail:token');
  } catch (err) {
    console.warn('Disconnect Gmail failed:', err);
    throw err;
  }
}

export async function getGmailAuthUrl(uid) {
  const headers = await getAuthHeader();
  const res = await fetch(`${GMAIL_BACKEND_URL}/auth-url?uid=${encodeURIComponent(uid)}`, { headers });
  if (!res.ok) throw new Error('Error al obtener URL de autenticación');
  const data = await res.json();
  return data.url;
}

export async function syncGmailTransactions(uid) {
  if (!uid) return [];
  try {
    const headers = await getAuthHeader();
    const res = await fetch(`${GMAIL_BACKEND_URL}/sync`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid })
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.transactions || [];
  } catch (err) {
    console.warn('Sync Gmail transactions failed:', err);
    return [];
  }
}
