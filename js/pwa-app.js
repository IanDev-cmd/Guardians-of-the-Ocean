/* PWA dashboard: clock, tiles, loading into web-app views */
(function () {
  'use strict';
  var Sound = window.GOO && GOO.Sound;
  var Notify = window.GOO && GOO.Notify;
  var Compass = window.GOO && GOO.Compass;
  if (!Sound) return;

  var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function pad(n){ return n < 10 ? '0' + n : '' + n; }
  function updateClock(){
    var timeEl = document.getElementById('timeText');
    var dateEl = document.getElementById('dateText');
    if (!timeEl || !dateEl) return;
    var now = new Date();
    var h = now.getHours();
    var ampm = h >= 12 ? 'p.m.' : 'a.m.';
    h = h % 12; if (h === 0) h = 12;
    timeEl.innerHTML = pad(h) + ':' + pad(now.getMinutes()) + '<sup id="ampm">' + ampm + '</sup>';
    dateEl.innerHTML = days[now.getDay()] + ', ' + pad(now.getDate()) + '<br>' + months[now.getMonth()] + ' ' + now.getFullYear();
  }
  updateClock();
  setInterval(updateClock, 15000);

  var ICONS = [
    { headline:'Global Impact Ledger', subtext:'Tracking 14 active deployment zones and 2.4M sq km of monitored terrain across 8 countries.', svg:'<circle cx="12" cy="12" r="9" stroke-width="1.4"/><ellipse cx="12" cy="12" rx="4" ry="9" stroke-width="1.4"/><path d="M3 12h18" stroke-width="1.4"/>', view:'globe' },
    { headline:'Verified Audit Trail', subtext:'100% immutable consensus with 48,290 verified on-chain state checks on Hedera.', svg:'<path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3Z" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>', view:'map' },
    { headline:'Secure Asset Vault', subtext:'$1.25M USD total value locked across 3 multi-signature reserve vaults.', svg:'<rect x="5" y="11" width="14" height="9" rx="2" stroke-width="1.4"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke-width="1.4"/><circle cx="12" cy="15.5" r="1.2" stroke-width="1.4"/>', view:'globe' },
    { headline:'Campaign Roadmap', subtext:'Phase 3 of 4 active: 85% completion rate across 12 field delivery routes.', svg:'<path d="M4 18c3-6 6-2 9-8 2-4 4-4 7-4" stroke-width="1.4" stroke-linecap="round"/><circle cx="4" cy="18" r="1.2" stroke-width="1.4"/><circle cx="20" cy="6" r="1.2" stroke-width="1.4"/>', view:'map' },
    { headline:'Proof of Execution', subtext:'12,450 downloadable PDF records linked to live Hedera transaction hashes.', svg:'<path d="M6 3h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3V3Z" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" stroke-width="1.3" stroke-linecap="round"/>', view:'map' },
    { headline:'Reforestation Hub', subtext:'450,000 trees planted, offsetting an estimated 9,800 metric tons of CO2 annually.', svg:'<path d="M12 21c-4-2-7-6-7-10a7 7 0 0 1 14 0c0 4-3 8-7 10Z" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 21V9" stroke-width="1.4" stroke-linecap="round"/>', view:'globe' },
    { headline:'Biodiversity Guard', subtext:'128 protected species monitored across 35,000 hectares of sanctuary land.', svg:'<path d="M2 13c3-3.5 6-3.5 8 0 2-3.5 5-3.5 8 0" stroke-width="1.4" stroke-linecap="round"/><path d="M10 13v6" stroke-width="1.4" stroke-linecap="round"/>', view:'globe' },
    { headline:'Ocean & Basin Care', subtext:'85 metric tons of coastal waste removed across 14 marine restoration sites.', svg:'<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11Z" stroke-width="1.4" stroke-linejoin="round"/>', view:'map' },
    { headline:'Clean Energy Grid', subtext:'3.2 GWh of solar output generated with 1,420 MWh in active energy credits.', svg:'<circle cx="12" cy="12" r="4" stroke-width="1.4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M4.5 19.5l2-2M17.5 6.5l2-2" stroke-width="1.4" stroke-linecap="round"/>', view:'globe' },
    { headline:'Fiat & Token Treasury', subtext:'Balance: $4,250.00 USD | 12,500 HBAR | 250 custom HTS impact tokens.', svg:'<path d="M4 9V7a2 2 0 0 1 2-2h9" stroke-width="1.4" stroke-linecap="round"/><path d="M4 8a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" stroke-width="1.4" stroke-linejoin="round"/><circle cx="16.3" cy="12.5" r="0.9" stroke-width="1.4"/>', view:'globe' },
    { headline:'Grants & Micro-Stipends', subtext:'$142,000 distributed across 320 verified local field operators this month.', svg:'<path d="M3 12l4-4 3 2 3-2 4 4-2 2-2-1-2 2-2-1-2 1-2-2Z" stroke-width="1.3" stroke-linejoin="round"/>', view:'map' },
    { headline:'On-Chain HashScan', subtext:'Latency: 3.2s finality | Block #58,291,042 | 0.001 HBAR average network fee.', svg:'<path d="M14 4h6v6" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 4l-9 9" stroke-width="1.4" stroke-linecap="round"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>', view:'map' }
  ];

  var APP = '../../save-the-earth%20(4).html';
  var loadEl = document.getElementById('pwaLoad');
  var frameEl = document.getElementById('pwaFrame');
  var iframe = document.getElementById('pwaIframe');
  var grid = document.getElementById('iconGrid');
  var headlineEl = document.getElementById('headlineText');
  var subtextEl = document.getElementById('subtextText');
  if (!grid || !loadEl || !frameEl || !iframe) return;

  function openWebView(view){
    loadEl.classList.add('show');
    Sound.click();
    setTimeout(function(){
      iframe.src = APP + '?embed=1&from=pwa&view=' + encodeURIComponent(view);
      frameEl.classList.add('show');
      loadEl.classList.remove('show');
      if (Notify) Notify.toast({ tone:'blue', title:'Live feed', sub:'Mobile 3D / 2D maps from the web app.', n:'📡' });
    }, 900);
  }

  document.getElementById('pwaCloseView') && document.getElementById('pwaCloseView').addEventListener('click', function(){
    frameEl.classList.remove('show');
    iframe.src = 'about:blank';
  });
  var pwaComp = document.getElementById('pwaCompassBtn');
  if (pwaComp) pwaComp.addEventListener('click', function(){
    if (Compass) Compass.show('immersive');
  });

  ICONS.forEach(function (item, i) {
    var btn = document.createElement('button');
    btn.className = 'tile' + (i === 0 ? ' active' : '');
    btn.setAttribute('aria-label', item.headline);
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none">' + item.svg + '</svg>';
    btn.addEventListener('click', function () {
      grid.querySelectorAll('.tile').forEach(function (t) { t.classList.remove('active'); });
      btn.classList.add('active');
      if (headlineEl) headlineEl.classList.add('fade');
      if (subtextEl) subtextEl.classList.add('fade');
      setTimeout(function () {
        if (headlineEl) {
          headlineEl.textContent = item.headline;
          headlineEl.classList.remove('fade');
        }
        if (subtextEl) {
          subtextEl.textContent = item.subtext;
          subtextEl.classList.remove('fade');
        }
      }, 160);
      openWebView(item.view);
    });
    grid.appendChild(btn);
  });
})();
