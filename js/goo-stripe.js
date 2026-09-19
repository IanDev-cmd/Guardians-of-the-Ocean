/* Stripe Checkout redirect + live treasury balances */
(function () {
  'use strict';

  function apiBase() {
    return String(window.GOO_API || '').replace(/\/$/, '');
  }

  function headers() {
    var h = { 'Content-Type': 'application/json' };
    var secret = localStorage.getItem('goo-checkout-secret') || '';
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

  async function fetchBalance(email) {
    var q = email ? ('?email=' + encodeURIComponent(email)) : '';
    return getJson('/api/balance' + q);
  }

  async function startCheckout(email, mode) {
    var base = apiBase();
    if (!base) throw new Error('Treasury API is not configured');
    var res = await fetch(base + '/api/checkout', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        email: email,
        mode: mode || 'payment'
      })
    });
    var body = {};
    try { body = await res.json(); } catch (e) { body = {}; }
    if (!res.ok || !body.url) {
      throw new Error(body.error || 'Could not start Checkout');
    }
    return body;
  }

  window.GooStripe = {
    apiBase: apiBase,
    fetchBalance: fetchBalance,
    startCheckout: startCheckout
  };
})();
