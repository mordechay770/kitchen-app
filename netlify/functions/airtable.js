// Allowed table IDs — only these tables can be accessed through the proxy.
// Add or remove table IDs to match your Airtable base.
const ALLOWED_TABLES = new Set([
  'tblMnlLwYCD27ou80',  // Orders
  'tblcP1zvc3Tu9oQuL',  // Line Items
  'tblhkNaiSGBiLRUxA',  // Dishes
  'tbl053nytobUU4ytc',  // Recipes
  'tblpmPSqC7TuzElHI',  // BOM
  'tblCg9hg1F8oj1mQ7',  // Composite
]);

exports.handler = async (event) => {
  const TOKEN         = process.env.AIRTABLE_TOKEN;
  const BASE          = process.env.AIRTABLE_BASE;
  const PROXY_SECRET  = process.env.PROXY_SECRET  || '';
  const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';

  // ── CORS ──
  const reqOrigin = (event.headers && (event.headers['origin'] || event.headers['Origin'])) || '';
  const corsOrigin = ALLOWED_ORIGIN
    ? (reqOrigin === ALLOWED_ORIGIN ? reqOrigin : ALLOWED_ORIGIN)
    : '*';

  const RESPONSE_HEADERS = {
    'Content-Type':                  'application/json',
    'Access-Control-Allow-Origin':   corsOrigin,
    'Access-Control-Allow-Headers':  'Content-Type, X-Api-Key',
    'Access-Control-Allow-Methods':  'GET, POST, PATCH, DELETE, OPTIONS',
  };

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: RESPONSE_HEADERS, body: '' };
  }

  if (!TOKEN || !BASE) {
    return { statusCode: 500, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'Missing environment variables' }) };
  }

  // ── API key check ──
  // If PROXY_SECRET env var is set, every request must include a matching X-Api-Key header.
  if (PROXY_SECRET) {
    const provided = (event.headers && (event.headers['x-api-key'] || event.headers['X-Api-Key'])) || '';
    if (provided !== PROXY_SECRET) {
      return { statusCode: 403, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
    }
  }

  const table    = event.queryStringParameters?.table    || '';
  const filter   = event.queryStringParameters?.filterByFormula || '';
  const sort     = event.queryStringParameters?.sort     || '';
  const fields   = event.queryStringParameters?.fields   || '';
  const offset   = event.queryStringParameters?.offset   || '';
  const method   = event.httpMethod;
  const recordId = event.queryStringParameters?.recordId || '';

  // ── Table allowlist ──
  if (!table || !ALLOWED_TABLES.has(table)) {
    return { statusCode: 403, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'Table not allowed' }) };
  }

  // Build Airtable URL
  let url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(table)}`;
  if (recordId) url += `/${recordId}`;

  const params = new URLSearchParams();
  if (filter) params.set('filterByFormula', filter);
  if (sort)   params.set('sort[0][field]', sort);
  if (fields) params.set('fields[]', fields);
  if (offset) params.set('offset', offset);
  const qs = params.toString();
  if (qs && method === 'GET') url += '?' + qs;

  const airtableHeaders = {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type':  'application/json',
  };

  const fetchOptions = { method, headers: airtableHeaders };
  if (method !== 'GET' && event.body) {
    fetchOptions.body = event.body;
  }

  try {
    const res  = await fetch(url, fetchOptions);
    const data = await res.json();
    return {
      statusCode: res.status,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return { statusCode: 500, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
