// Airtable API wrapper — routes through Netlify Function
const API = (() => {
  const PROXY = '/.netlify/functions/airtable';

  // ── API call counter ──
  let _callCount = 0;
  let _pageCallCount = 0;
  function _tick(label) {
    _callCount++;
    _pageCallCount++;
    console.log(`[Airtable #${_callCount}] ${label}`);
    _updateCounter();
  }
  function _updateCounter() {
    const el = document.getElementById('apiCallCounter');
    if (el) el.textContent = `API: ${_pageCallCount} calls`;
  }
  function resetPageCounter() { _pageCallCount = 0; _updateCounter(); }

  function _url(table, recordId, params) {
    const u = new URL(PROXY, location.origin);
    u.searchParams.set('table', table);
    if (recordId) u.searchParams.set('recordId', recordId);
    if (params) Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) u.searchParams.set(k, v);
    });
    return u.toString();
  }

  async function request(url, opts = {}) {
    _tick(`${opts.method || 'GET'} ${String(url).split('?')[0].split('/').pop()}`);
    const h = {};
    if (opts.body) h['Content-Type'] = 'application/json';
    const res = await fetch(url, { headers: h, ...opts });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Airtable ${res.status}: ${err.error?.message || res.statusText}`);
    }
    return res.json();
  }

  // ── Read ──

  async function getAll(table, params = {}) {
    const records = [];
    let offset = null;
    do {
      const p = { ...params };
      if (offset) p.offset = offset;
      const data = await request(_url(table, null, p));
      records.push(...(data.records || []));
      offset = data.offset;
    } while (offset);
    return records;
  }

  async function getOne(table, id) {
    return request(_url(table, id, null));
  }

  async function getByIds(table, ids) {
    if (!ids?.length) return [];
    const formula = ids.length === 1
      ? `RECORD_ID()="${ids[0]}"`
      : `OR(${ids.map(id => `RECORD_ID()="${id}"`).join(',')})`;
    return getAll(table, { filterByFormula: formula });
  }

  // ── Write ──

  async function create(table, fields) {
    return request(_url(table, null, null), {
      method: 'POST',
      body: JSON.stringify({ fields }),
    });
  }

  async function update(table, id, fields) {
    return request(_url(table, id, null), {
      method: 'PATCH',
      body: JSON.stringify({ fields }),
    });
  }

  // ── Date-aware order fetching ──

  async function getOrdersByDate(isoDate) {
    // isoDate: "2026-03-19"
    // Use YEAR/MONTH/DAY comparison — works regardless of base locale or DATESTR format
    const dateField = CONFIG.FIELDS.ORDER_DATE;
    const [y, m, d] = isoDate.split('-').map(Number);
    const formula = `AND(YEAR({${dateField}})=${y},MONTH({${dateField}})=${m},DAY({${dateField}})=${d})`;

    console.log('[Date filter]', formula);
    try {
      const recs = await getAll(CONFIG.TABLES.ORDERS, { filterByFormula: formula });
      return recs;
    } catch (e) {
      console.warn('Date filter failed:', e.message);
      // Fallback: fetch recent 50 and filter client-side
      const all = await getAll(CONFIG.TABLES.ORDERS, { maxRecords: 50 });
      return all.filter(r => {
        const raw = r.fields?.[dateField];
        return raw && raw.startsWith(isoDate);
      });
    }
  }

  // Sync preparation status to Airtable (requires "הוכן" checkbox field in LINE_ITEMS)
  async function syncDoneStatus(lineItemId, done) {
    try {
      await update(CONFIG.TABLES.LINE_ITEMS, lineItemId, {
        [CONFIG.FIELDS.LINE_ITEM_DONE]: done,
      });
      return true;
    } catch (e) {
      // Field might not exist yet — silently ignore
      console.warn('Airtable sync skipped:', e.message);
      return false;
    }
  }

  return { getAll, getOne, getByIds, create, update, getOrdersByDate, syncDoneStatus, resetPageCounter };
})();

// ── Progress tracking — localStorage + Airtable sync ──
const PROGRESS = {
  key: id => `kit_prog_${id}`,

  isDone(id) {
    try { return !!JSON.parse(localStorage.getItem(this.key(id)))?.done; }
    catch { return false; }
  },

  getTime(id) {
    try { return JSON.parse(localStorage.getItem(this.key(id)))?.time || null; }
    catch { return null; }
  },

  async setDone(id, done) {
    const val = done
      ? { done: true, time: new Date().toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }) }
      : null;
    if (val) localStorage.setItem(this.key(id), JSON.stringify(val));
    else localStorage.removeItem(this.key(id));
    // Async sync to Airtable (fire and forget)
    API.syncDoneStatus(id, done);
  },

  countDone(ids) {
    return ids.filter(id => this.isDone(id)).length;
  },
};

// ── Field helpers ──

// Get a field value from a record (returns null if missing)
function field(record, name, fallback = null) {
  return record?.fields?.[name] ?? fallback;
}

// Get first item if array (lookup field), otherwise the value itself
function firstVal(record, name, fallback = null) {
  const v = record?.fields?.[name];
  if (v === undefined || v === null) return fallback;
  return Array.isArray(v) ? (v[0] ?? fallback) : v;
}

// Get linked record IDs (array field)
function linkedIds(record, name) {
  const v = record?.fields?.[name];
  return Array.isArray(v) ? v : [];
}

// Get first linked record ID
function linkedId(record, name) {
  return linkedIds(record, name)[0] ?? null;
}

// ── Today's ISO date ──
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
