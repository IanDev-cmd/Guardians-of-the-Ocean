/* Single HTTP client for the treasury API. No DOM. */
(function () {
  'use strict';

  var EMAIL_RE = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+.\-]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
  var EMAIL_KEY = 'goo-checkout-email';

  function apiBase() {
    return String(window.GOO_API || '').replace(/\/$/, '');
  }

  function normalizeEmail(raw) {
    return String(raw || '').trim().toLowerCase();
  }

  function isValidEmail(raw) {
    var email = normalizeEmail(raw);
    return !!email && EMAIL_RE.test(email);
  }

  function readEmail() {
    try { return normalizeEmail(localStorage.getItem(EMAIL_KEY) || ''); }
    catch (e) { return ''; }
  }

  function persistEmail(raw) {
    var email = normalizeEmail(raw);
    if (!isValidEmail(email)) return '';
    try { localStorage.setItem(EMAIL_KEY, email); } catch (e) {}
    return email;
  }

  function headers() {
    var h = { 'Content-Type': 'application/json' };
    var secret = '';
    try { secret = localStorage.getItem('goo-checkout-secret') || ''; } catch (e) {}
    if (secret) h.Authorization = 'Bearer ' + secret;
    return h;
  }

  async function getJson(path) {
    var base = apiBase();
    if (!base) throw new Error('Treasury API is not configured');
    var res = await fetch(base + path, { headers: headers() });
    var body = {};
    try { body = await res.json(); } catch (e) { body = {}; }
    if (!res.ok) throw new Error(body.error || 'Request failed');
    return body;
  }

  async function fetchLedger(email) {
    var normalized = email ? normalizeEmail(email) : '';
    var q = normalized ? ('?email=' + encodeURIComponent(normalized)) : '';
    return getJson('/api/ledger' + q);
  }

  async function startCheckout(email, mode, source) {
    var base = apiBase();
    if (!base) throw new Error('Treasury API is not configured');
    var normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) throw new Error('Valid email is required');
    var res = await fetch(base + '/api/checkout', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        email: normalized,
        mode: mode || 'payment',
        source: source === 'pwa' ? 'pwa' : 'desktop'
      })
    });
    var body = {};
    try { body = await res.json(); } catch (e) { body = {}; }
    if (!res.ok || !body.url) {
      throw new Error(body.error || 'Could not start Checkout');
    }
    persistEmail(normalized);
    return body;
  }

  async function getOrderStatus(sessionId) {
    return getJson('/api/orders/status?session_id=' + encodeURIComponent(sessionId || ''));
  }

  window.GooApi = {
    apiBase: apiBase,
    isValidEmail: isValidEmail,
    normalizeEmail: normalizeEmail,
    readEmail: readEmail,
    persistEmail: persistEmail,
    fetchLedger: fetchLedger,
    startCheckout: startCheckout,
    getOrderStatus: getOrderStatus
  };

  window.GooStripe = {
    apiBase: apiBase,
    fetchBalance: fetchLedger,
    fetchLedger: fetchLedger,
    startCheckout: startCheckout
  };
})();
