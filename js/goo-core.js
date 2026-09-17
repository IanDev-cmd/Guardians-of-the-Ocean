/* Device, sound, and notifications — shared by web app and PWA */
(function (root) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]);
    });
  }

  var script = document.currentScript && document.currentScript.src;
  var ICON_BASE = script ? script.replace(/js\/goo-core\.js(\?.*)?$/, '') : '';

  var Device = {
    mobile: /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || Math.min(innerWidth, innerHeight) < 760,
    ios: /iPad|iPhone|iPod/.test(navigator.userAgent),
    standalone: matchMedia('(display-mode: standalone)').matches || !!navigator.standalone,
    embed: /(?:^|[?&])embed=1/.test(location.search),
    fromPwa: /(?:^|[?&])from=pwa/.test(location.search),
    view: (location.search.match(/[?&]view=([a-z]+)/) || [])[1] || '',
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    pwaShell: false,
    iconBase: ICON_BASE
  };

  document.documentElement.classList.toggle('mobile', Device.mobile);
  document.documentElement.classList.toggle('standalone', Device.standalone);
  document.documentElement.classList.toggle('embed', Device.embed);
  document.documentElement.classList.toggle('from-pwa', Device.fromPwa);

  var Sound = {
    ctx: null,
    ensure: function () {
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone: function (freq, duration, type, peak, glideTo) {
      var ctx = this.ensure();
      if (!ctx || !freq || !peak) return;
      var t0 = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (glideTo > 0) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(duration, 0.02));
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    },
    hover: function () { this.tone(1500, 0.05, 'sine', 0.035, 1900); },
    click: function () {
      this.tone(680, 0.09, 'triangle', 0.11, 420);
      this.tone(1360, 0.07, 'sine', 0.05, 1360);
    },
    success: function () {
      this.tone(660, 0.12, 'sine', 0.09, 880);
      this.tone(990, 0.18, 'triangle', 0.06, 1320);
    },
    warn: function () { this.tone(420, 0.16, 'square', 0.045, 280); },
    info: function () { this.tone(880, 0.1, 'sine', 0.05, 1100); },
    unlock: function () { this.ensure(); }
  };

  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, function () { Sound.unlock(); }, { once: true, passive: true });
  });

  var Notify = {
    count: 0,
    items: [],
    stack: null,
    bell: null,
    badge: null,
    panel: null,
    askedNative: false,
    ensure: function () {
      if (this.stack) return;
      this.stack = document.createElement('div');
      this.stack.className = 'n-stack';
      document.body.appendChild(this.stack);

      this.bell = document.createElement('button');
      this.bell.type = 'button';
      this.bell.className = 'n-bell';
      this.bell.setAttribute('aria-label', 'Notifications');
      this.bell.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5"/><path d="M9 17a3 3 0 0 0 6 0"/></svg><i class="n-badge" hidden>0</i>';
      document.body.appendChild(this.bell);
      this.badge = this.bell.querySelector('.n-badge');

      this.panel = document.createElement('div');
      this.panel.className = 'n-panel';
      this.panel.innerHTML = '<header>Live notices</header><div class="n-list"></div>';
      document.body.appendChild(this.panel);

      var self = this;
      this.bell.addEventListener('click', function (e) {
        e.stopPropagation();
        Sound.click();
        self.panel.classList.toggle('open');
        self.count = 0;
        self.syncBadge();
        self.requestNative();
      });
      document.addEventListener('click', function () { self.panel.classList.remove('open'); });
    },
    syncBadge: function () {
      if (!this.badge) return;
      if (this.count > 0) {
        this.badge.hidden = false;
        this.badge.textContent = this.count > 9 ? '9+' : String(this.count);
      } else this.badge.hidden = true;
    },
    requestNative: function () {
      if (this.askedNative || !('Notification' in window) || Notification.permission !== 'default') return;
      this.askedNative = true;
      Notification.requestPermission().then(function (p) {
        if (p === 'granted') Notify.toast({ tone: 'blue', title: 'Alerts on', sub: 'You will hear and see live field notices.', n: '01' });
      });
    },
    listen: function () {
      this.ensure();
      addEventListener('online', function () {
        Notify.toast({ tone: 'green', title: 'Network restored', sub: 'Tiles and hashes will sync.', n: 'OK' });
      });
      addEventListener('offline', function () {
        Notify.toast({ tone: 'amber', title: 'Offline', sub: 'Cached maps stay available.', n: '!' });
      });
    },
    native: function (title, body) {
      if (!('Notification' in window) || Notification.permission !== 'granted' || document.hasFocus()) return;
      try {
        new Notification(title, { body: body, icon: ICON_BASE + 'pwa/island-weather-pwa/icons/icon-192.png' });
      } catch (e) {}
    },
    toast: function (opts) {
      this.ensure();
      opts = opts || {};
      var tone = opts.tone || 'blue';
      if (tone === 'green') Sound.success();
      else if (tone === 'amber') Sound.warn();
      else Sound.info();
      this.count += 1;
      this.syncBadge();
      var num = opts.n != null ? String(opts.n) : String(this.items.length + 1).padStart(2, '0');
      var el = document.createElement('div');
      el.className = 'n-toast tone-' + tone;
      el.innerHTML =
        '<span class="n-dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
        '<span class="n-num">' + esc(num) + '</span>' +
        '<span class="n-copy"><b>' + esc(opts.title || 'Notice') + '</b><i>' + esc(opts.sub || '') + '</i></span>' +
        '<span class="n-ico" aria-hidden="true">🔔</span>';
      this.stack.appendChild(el);
      requestAnimationFrame(function () { el.classList.add('show'); });
      this.items.unshift({ tone: tone, title: opts.title, sub: opts.sub, t: Date.now() });
      var list = this.panel.querySelector('.n-list');
      if (list) {
        var row = document.createElement('div');
        row.className = 'n-row tone-' + tone;
        row.innerHTML = '<b>' + esc(opts.title || '') + '</b><i>' + esc(opts.sub || '') + '</i>';
        list.insertBefore(row, list.firstChild);
        while (list.children.length > 12) list.removeChild(list.lastChild);
      }
      this.native(opts.title || 'Guardians', opts.sub || '');
      setTimeout(function () {
        el.classList.remove('show');
        setTimeout(function () { if (el.parentNode) el.remove(); }, 380);
      }, opts.hold || 3200);
    }
  };

  root.GOO = root.GOO || {};
  root.GOO.Device = Device;
  root.GOO.Sound = Sound;
  root.GOO.Notify = Notify;
  root.GOO.esc = esc;
})(window);
