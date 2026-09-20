/* Shared fund + personal painter and Checkout binder for desktop and PWA. */
(function () {
  'use strict';

  var bound = false;
  var active = true;
  var onPaint = null;
  var onError = null;
  var source = 'desktop';
  var lastLedger = null;

  function $(id) { return document.getElementById(id); }

  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = value == null ? '—' : String(value);
  }

  function emailInputs() {
    return [$('uxCheckoutEmail'), $('pwaPayEmail')].filter(Boolean);
  }

  function checkoutButtons() {
    return [$('uxCheckout'), $('pwaCheckout')].filter(Boolean);
  }

  function currentEmail() {
    var fromInput = '';
    emailInputs().some(function (el) {
      if (el.value.trim()) { fromInput = el.value; return true; }
      return false;
    });
    return window.GooApi ? window.GooApi.normalizeEmail(fromInput || window.GooApi.readEmail()) : '';
  }

  function fillEmails(value) {
    emailInputs().forEach(function (el) { el.value = value; });
  }

  function paint(ledger) {
    lastLedger = ledger;
    if (!ledger) return;
    var fund = ledger.fund || {};
    var personal = ledger.personal || {};
    var avail = fund.available && fund.available.label ? fund.available.label : '$0.00';
    var settled = fund.paid && fund.paid.label ? fund.paid.label : '$0.00';
    var splitRaw = fund.split && fund.split.label ? fund.split.label : '85/15 SPLIT';
    var split = splitRaw.replace(' SPLIT', '');
    var pendingCount = fund.pending && fund.pending.count != null ? fund.pending.count : 0;
    var live = ledger.live ? 'LIVE' : 'OFF';

    setText('uxFundAvail', avail);
    setText('uxFundPaid', settled);
    setText('uxFundSplit', split);
    setText('uxFundLive', live);
    setText('uxFundLine', settled + ' settled · Field ops 85% · treasury 15%');
    setText('pwaBalOp', avail);
    setText('pwaBalPaid', settled);
    setText('pwaBalSplit', split);
    setText('pwaBalFund', settled + ' settled · Field ops 85% · treasury 15%');
    setText('pwaPayLive', live);

    var you = personal.paid && personal.paid.label ? personal.paid.label : '$0.00';
    var pend = personal.pending && personal.pending.label ? personal.pending.label : '$0.00';
    var orders = String((personal.paid && personal.paid.count || 0) + (personal.pending && personal.pending.count || 0));
    var status = personal.status || 'EMAIL';
    var line = personal.email
      ? (personal.status === 'LINKED' ? personal.email + ' · Stripe + Postgres' : personal.email + ' · no orders yet')
      : 'Enter email to load your payouts';

    setText('uxPayPaid', you);
    setText('uxPayPend', pend);
    setText('uxPayCount', orders);
    setText('uxPayStatus', status);
    setText('uxPayLine', line);
    setText('pwaBalYou', you);
    setText('pwaBalPend', pend);
    setText('pwaBalOrders', orders);
    setText('pwaPayStatus', status);
    setText('pwaPayLine', line);

    if (typeof onPaint === 'function') onPaint(ledger, { avail: avail, settled: settled, split: split, pendingCount: pendingCount });
  }

  function paintOffline() {
    setText('uxFundLive', 'OFF');
    setText('pwaPayLive', 'OFF');
    setText('uxFundLine', 'Treasury API unreachable');
    setText('pwaBalFund', 'Treasury API unreachable');
    setText('uxPayLine', 'Could not load personal payouts');
    setText('pwaPayLine', 'Could not load personal payouts');
    if (typeof onPaint === 'function') onPaint(null, { offline: true });
  }

  function reload() {
    if (!window.GooApi || !window.GooApi.fetchLedger) return;
    var email = currentEmail();
    if (email && window.GooApi.isValidEmail(email)) window.GooApi.persistEmail(email);
    window.GooApi.fetchLedger(email).then(paint).catch(function () { paintOffline(); });
  }

  function setBusy(on) {
    checkoutButtons().forEach(function (btn) {
      btn.disabled = on;
      btn.setAttribute('aria-busy', on ? 'true' : 'false');
      btn.classList.toggle('is-loading', on);
      var label = btn.querySelector('.ux-checkout-label');
      if (label) label.textContent = on ? 'Redirecting to Stripe…' : 'Checkout';
      if (btn.id === 'pwaCheckout') btn.textContent = on ? '…' : 'CHECKOUT';
    });
  }

  function fail(message) {
    setBusy(false);
    if (typeof onError === 'function') onError(message);
  }

  function startPay() {
    if (!window.GooApi) {
      fail('Checkout is not available');
      return;
    }
    var email = currentEmail();
    if (!window.GooApi.isValidEmail(email)) {
      var first = emailInputs()[0];
      if (first) {
        first.focus();
        first.placeholder = 'Email required';
      }
      fail('Enter a valid email for Checkout');
      return;
    }
    fillEmails(email);
    window.GooApi.persistEmail(email);
    setBusy(true);
    window.GooApi.startCheckout(email, 'payment', source).then(function (session) {
      window.location.href = session.url;
    }).catch(function (err) {
      fail(err && err.message ? err.message : 'Checkout failed');
    });
  }

  function bind(opts) {
    opts = opts || {};
    if (opts.onPaint) onPaint = opts.onPaint;
    if (opts.onError) onError = opts.onError;
    if (opts.source) source = opts.source;
    if (bound) {
      attachControls();
      reload();
      return;
    }
    bound = true;

    var saved = window.GooApi ? window.GooApi.readEmail() : '';
    if (saved) fillEmails(saved);

    attachControls();

    var dock = $('uxBalanceDock');
    if (dock && !dock.dataset.gooBound) {
      dock.dataset.gooBound = '1';
      dock.addEventListener('click', function (ev) {
        if (ev.target.id === 'uxFundRefresh' || ev.target.id === 'uxPayRefresh') reload();
      });
    }
    reload();
  }

  function attachControls() {
    var saved = window.GooApi ? window.GooApi.readEmail() : '';
    if (saved) fillEmails(saved);
    emailInputs().forEach(function (el) {
      if (el.dataset.gooBound) return;
      el.dataset.gooBound = '1';
      el.addEventListener('change', reload);
      el.addEventListener('blur', reload);
    });
    checkoutButtons().forEach(function (btn) {
      if (btn.dataset.gooBound) return;
      btn.dataset.gooBound = '1';
      btn.addEventListener('click', startPay);
    });
  }

  window.GooWallet = {
    bind: bind,
    reload: reload,
    setActive: function (on) { active = !!on; if (active) reload(); },
    lastLedger: function () { return lastLedger; }
  };
})();
