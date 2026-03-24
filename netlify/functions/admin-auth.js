// admin-auth.js — Server-side admin authentication
// Uses only Node.js built-in 'crypto' (no npm packages needed).
//
// Required Netlify environment variables:
//   ADMIN_USERNAME      — admin username (plain text)
//   ADMIN_PASS_HASH     — HMAC-SHA256 of password, keyed by ADMIN_SECRET (hex)
//   ADMIN_SECRET        — random 64-char secret for signing tokens + hashing passwords
//
// To generate ADMIN_PASS_HASH:
//   Run admin-setup.html locally, or use Node.js:
//   node -e "const c=require('crypto'); console.log(c.createHmac('sha256','YOUR_SECRET').update('YOUR_PASSWORD').digest('hex'));"

const crypto = require('crypto');

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const TOKEN_TTL = 8 * 3600 * 1000;  // 8 hours

function safeCompare(a, b) {
  // Always use timingSafeEqual to prevent timing attacks.
  // Buffers must be same length, so compare lengths first (constant-time length check not possible,
  // but we proceed anyway — a mismatch will be caught by timingSafeEqual returning false).
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch { return false; }
}

function makeToken(username, secret) {
  const payload = Buffer.from(JSON.stringify({
    u: username,
    exp: Date.now() + TOKEN_TTL,
  })).toString('base64');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;

  const payload = token.slice(0, dot);
  const sig     = token.slice(dot + 1);

  // Verify signature
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (!safeCompare(sig, expectedSig)) return null;

  // Decode and check expiry
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    if (!data.u || !data.exp) return null;
    if (Date.now() > data.exp) return null;
    return data;
  } catch { return null; }
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const SECRET    = process.env.ADMIN_SECRET;
  const USERNAME  = process.env.ADMIN_USERNAME;
  const PASS_HASH = process.env.ADMIN_PASS_HASH;

  if (!SECRET || !USERNAME || !PASS_HASH) {
    console.error('[admin-auth] Missing environment variables');
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Server not configured. Set ADMIN_SECRET, ADMIN_USERNAME, ADMIN_PASS_HASH in Netlify.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if (body.action === 'login') {
    const { username = '', password = '' } = body;

    // Always compute hash (prevents timing attack from short-circuiting)
    const submittedHash = crypto.createHmac('sha256', SECRET).update(password).digest('hex');

    const userMatch = safeCompare(username, USERNAME);
    const passMatch = safeCompare(submittedHash, PASS_HASH);

    if (!userMatch || !passMatch) {
      // Artificial delay to slow down brute force attempts
      await new Promise(r => setTimeout(r, 400));
      return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Invalid credentials' }) };
    }

    const token = makeToken(USERNAME, SECRET);
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ token, username: USERNAME }) };
  }

  // ── VERIFY ─────────────────────────────────────────────────────────────────
  if (body.action === 'verify') {
    const data = verifyToken(body.token, SECRET);
    if (!data) {
      return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ valid: false }) };
    }
    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ valid: true, username: data.u }) };
  }

  return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Unknown action' }) };
};
