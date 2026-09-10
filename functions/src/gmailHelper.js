const axios = require('axios');
const admin = require('firebase-admin');

const CLIENT_ID = process.env.GMAIL_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || process.env.REDIRECT_URI || 'postmessage';

const GMAIL_RUNTIME_SECRETS = ['GMAIL_CLIENT_SECRET'];
const GMAIL_PUBSUB_TOPIC = process.env.GMAIL_PUBSUB_TOPIC || `projects/${process.env.GCLOUD_PROJECT}/topics/gmail-notifications`;
const GMAIL_PUBSUB_SHORT = process.env.GMAIL_PUBSUB_SHORT || 'gmail-notifications';
const GMAIL_WATCH_RENEW_MARGIN_MS = Number(process.env.GMAIL_WATCH_RENEW_MARGIN_MS || (5 * 60 * 1000));
const GMAIL_WATCH_RENEW_SCHEDULE = process.env.GMAIL_WATCH_RENEW_SCHEDULE || 'every 5 minutes';

function isInvalidGrantError(err) {
  const d = err && err.response && err.response.data ? err.response.data : null;
  const code = d && typeof d === 'object' ? d.error : (typeof d === 'string' ? d : null);
  const desc = d && typeof d === 'object' ? (d.error_description || '') : (typeof d === 'string' ? d : '');
  return code === 'invalid_grant' || (typeof desc === 'string' && /expired|revoked|invalid_grant/i.test(desc));
}

async function clearUserGmailTokens(uid) {
  try {
    await admin.firestore().collection('users').doc(uid).set({
      gmail: {
        encrypted_refresh_token: admin.firestore.FieldValue.delete(),
        refresh_token: admin.firestore.FieldValue.delete(),
        tokens: admin.firestore.FieldValue.delete()
      }
    }, { merge: true });
    console.log('[gmail] cleared refresh token for', uid);
  } catch (e) {
    console.warn('[gmail] failed clearing refresh token for', uid, e);
  }
}

function refreshAccessTokenWithRefreshToken(refresh_token) {
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refresh_token);
  return axios.post('https://oauth2.googleapis.com/token', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }).then(r => r.data).catch(err => {
    if (isInvalidGrantError(err)) {
      const e = new Error('invalid_grant');
      e.code = 'invalid_grant';
      e.original = err;
      throw e;
    }
    throw err;
  });
}

module.exports = {
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  GMAIL_RUNTIME_SECRETS,
  GMAIL_PUBSUB_TOPIC,
  GMAIL_PUBSUB_SHORT,
  GMAIL_WATCH_RENEW_MARGIN_MS,
  GMAIL_WATCH_RENEW_SCHEDULE,
  isInvalidGrantError,
  clearUserGmailTokens,
  refreshAccessTokenWithRefreshToken
};

