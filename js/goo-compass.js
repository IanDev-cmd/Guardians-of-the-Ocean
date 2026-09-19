/* GPS compass: heading, elevation, rose / satellite ring / immersive HUD */
(function (root) {
  'use strict';
  var GOO = root.GOO;
  if (!GOO) return;
  var Sound = GOO.Sound;
  var Notify = GOO.Notify;

  var CARDS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  var DEGS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  var ARROW_SVG =
    '<svg class="go-needle" viewBox="0 0 72 88" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="goNgrad" x1="36" y1="4" x2="36" y2="84" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0" stop-color="#8af5de"/>' +
          '<stop offset=".45" stop-color="#4ee0c8"/>' +
          '<stop offset="1" stop-color="#1fb8a4"/>' +
        '</linearGradient>' +
        '<linearGradient id="goNshine" x1="12" y1="8" x2="40" y2="50" gradientUnits="userSpaceOnUse">' +
          '<stop offset="0" stop-color="#fff" stop-opacity=".55"/>' +
          '<stop offset="1" stop-color="#fff" stop-opacity="0"/>' +
        '</linearGradient>' +
        '<filter id="goNsh" x="-30%" y="-10%" width="160%" height="140%">' +
          '<feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="#1a4a48" flood-opacity=".35"/>' +
        '</filter>' +
      '</defs>' +
      '<path filter="url(#goNsh)" fill="url(#goNgrad)" d="M36 6 C33 6 30 16 18 52 C16 58 20 64 28 64 L36 58 L44 64 C52 64 56 58 54 52 C42 16 39 6 36 6 Z"/>' +
      '<path fill="url(#goNshine)" d="M36 10 C34 10 32 18 24 44 C28 42 32 40 36 40 Z"/>' +
      '<path fill="#148f82" opacity=".35" d="M36 10 C38 10 40 18 48 44 C44 42 40 40 36 40 Z"/>' +
    '</svg>';

  var Compass = {
    open: false,
    heading: 0,
    lat: null,
    lng: null,
    alt: null,
    acc: null,
    gpsOk: false,
    mode: 'rose',
    map: null,
    targetBearing: 0,
    watchId: null,
    gpsWarned: false,
    els: {},

    mount: function () {
      var wrap = document.getElementById('goCompass');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'goCompass';
        wrap.className = 'go-compass';
        wrap.innerHTML =
          '<div class="go-compass-hud">' +
            '<b id="goHead">000°</b><i id="goCard">N</i>' +
            '<span id="goAlt">ELE —</span><span id="goAcc">GPS …</span>' +
          '</div>' +
          '<div class="go-compass-stage">' +
            '<div class="go-rose" id="goRose">' +
              '<div class="go-cmap" id="goCmap"></div>' +
              '<svg class="go-ticks" viewBox="0 0 200 200" aria-hidden="true"></svg>' +
              '<div class="go-labs" id="goLabs"></div>' +
            '</div>' +
            '<div class="go-arrow" id="goArrow">' + ARROW_SVG + '</div>' +
          '</div>' +
          '<div class="go-compass-tools">' +
            '<button type="button" data-cmode="rose">Rose</button>' +
            '<button type="button" data-cmode="map">Map</button>' +
            '<button type="button" data-cmode="immersive">Immerse</button>' +
            '<button type="button" id="goCclose">Close</button>' +
          '</div>';
        document.body.appendChild(wrap);
        this.drawTicks(wrap.querySelector('.go-ticks'), wrap.querySelector('#goLabs'));
        var self = this;
        wrap.querySelectorAll('[data-cmode]').forEach(function (b) {
          b.addEventListener('click', function () {
            Sound.click();
            self.setMode(b.getAttribute('data-cmode'));
          });
        });
        wrap.querySelector('#goCclose').addEventListener('click', function () {
          Sound.click();
          self.hide();
        });
      }
      this.els.wrap = wrap;
      this.els.rose = wrap.querySelector('#goRose');
      this.els.arrow = wrap.querySelector('#goArrow');
      this.els.head = wrap.querySelector('#goHead');
      this.els.card = wrap.querySelector('#goCard');
      this.els.alt = wrap.querySelector('#goAlt');
      this.els.acc = wrap.querySelector('#goAcc');
      this.els.cmap = wrap.querySelector('#goCmap');
      this.els.labs = wrap.querySelectorAll('#goLabs span');
    },

    drawTicks: function (svg, labs) {
      if (!svg || svg.childNodes.length) return;
      var ns = 'http://www.w3.org/2000/svg';
      var g = document.createElementNS(ns, 'g');
      g.setAttribute('transform', 'translate(100,100)');
      var ring = document.createElementNS(ns, 'circle');
      ring.setAttribute('r', '88');
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', '#d4dae0');
      ring.setAttribute('stroke-width', '0.6');
      g.appendChild(ring);
      for (var d = 0; d < 360; d += 2) {
        var rad = d * Math.PI / 180;
        var inner = d % 30 === 0 ? 78 : d % 10 === 0 ? 82 : 85.5;
        var ln = document.createElementNS(ns, 'line');
        ln.setAttribute('x1', String(Math.sin(rad) * inner));
        ln.setAttribute('y1', String(-Math.cos(rad) * inner));
        ln.setAttribute('x2', String(Math.sin(rad) * 88));
        ln.setAttribute('y2', String(-Math.cos(rad) * 88));
        ln.setAttribute('stroke', d % 30 === 0 ? '#9aa3ad' : '#c5ccd3');
        ln.setAttribute('stroke-width', d % 30 === 0 ? '1.35' : d % 10 === 0 ? '0.9' : '0.55');
        g.appendChild(ln);
      }
      svg.appendChild(g);
      CARDS.forEach(function (c, i) {
        var a = i * 45;
        var el = document.createElement('span');
        el.className = 'go-card' + (c.length === 1 ? ' major' : '');
        el.textContent = c;
        el.dataset.a = String(a);
        el.dataset.ring = 'card';
        labs.appendChild(el);
      });
      DEGS.forEach(function (deg) {
        var n = document.createElement('span');
        n.className = 'go-deg';
        n.textContent = String(deg);
        n.dataset.a = String(deg);
        n.dataset.ring = 'deg';
        labs.appendChild(n);
      });
    },

    cardFrom: function (h) {
      var names = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
      var idx = Math.round((((h % 360) + 360) % 360) / 22.5) % 16;
      return names[idx];
    },

    setMode: function (mode) {
      this.mode = mode;
      if (!this.els.wrap) return;
      this.els.wrap.classList.toggle('map-on', mode === 'map');
      this.els.wrap.classList.toggle('immersive', mode === 'immersive');
      if (mode === 'map' || mode === 'immersive') this.ensureMap();
      if (mode === 'immersive') {
        Notify.toast({ tone: 'blue', title: 'Immersive heading', sub: 'Arrow glows by alignment to north and your target city.', n: 'HUD' });
      }
    },

    ensureMap: function () {
      var self = this;
      function make() {
        if (!window.L || !self.els.cmap) return;
        if (!self.map) {
          self.map = L.map(self.els.cmap, {
            zoomControl: false, attributionControl: false, dragging: false,
            scrollWheelZoom: false, doubleClickZoom: false, keyboard: false
          });
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(self.map);
        }
        var ll = self.lat != null ? [self.lat, self.lng] : [0.05, 20];
        self.map.setView(ll, 15);
        setTimeout(function () { if (self.map) self.map.invalidateSize(); }, 80);
      }
      if (window.L) { make(); return; }
      if (window.GOOLoad) {
        window.GOOLoad.leaflet().then(make).catch(function () {});
        return;
      }
      if (document.getElementById('goLeaf')) {
        document.getElementById('goLeaf').addEventListener('load', make, { once: true });
        return;
      }
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(css);
      var s = document.createElement('script');
      s.id = 'goLeaf';
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      s.onload = make;
      document.head.appendChild(s);
    },

    paint: function () {
      if (!this.open || !this.els.rose) return;
      var h = ((this.heading % 360) + 360) % 360;
      this.els.rose.style.transform = 'rotate(' + (-h) + 'deg)';
      var labs = this.els.labs;
      if (labs && labs.length) {
        for (var i = 0; i < labs.length; i++) {
          var el = labs[i];
          var a = +el.dataset.a;
          var y = el.dataset.ring === 'card' ? (el.classList.contains('major') ? -92 : -90) : -62;
          el.style.transform = 'rotate(' + a + 'deg) translateY(' + y + 'px) rotate(' + (-a + h) + 'deg)';
        }
      }
      var shown = Math.round(h);
      this.els.head.textContent = ('00' + shown).slice(-3) + '°';
      this.els.card.textContent = this.cardFrom(h);
      this.els.alt.textContent = this.alt != null && isFinite(this.alt) ? ('ELE ' + Math.round(this.alt) + ' m') : 'ELE —';
      this.els.acc.textContent = this.gpsOk
        ? ('GPS ±' + (this.acc != null ? Math.round(this.acc) : '?') + ' m')
        : 'GPS …';
      var delta = Math.abs(((this.heading - this.targetBearing + 540) % 360) - 180);
      var tone = !this.gpsOk ? 'red' : (delta < 12 ? 'green' : (delta < 40 ? 'blue' : 'red'));
      this.els.arrow.className = 'go-arrow glow-' + tone;
      if (this.map && this.lat != null) {
        this.map.setView([this.lat, this.lng], this.map.getZoom() || 15, { animate: false });
      }
    },

    onOri: function (e) {
      var h = null;
      if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
      else if (e.absolute && typeof e.alpha === 'number') h = (360 - e.alpha) % 360;
      else if (typeof e.alpha === 'number' && !this._absBound) h = (360 - e.alpha) % 360;
      if (h == null || isNaN(h)) return;
      this.heading += ((h - this.heading + 540) % 360 - 180) * 0.28;
      this.paint();
    },

    startSensors: function () {
      this.stopSensors();
      var self = this;
      if (navigator.geolocation) {
        this.watchId = navigator.geolocation.watchPosition(function (pos) {
          self.lat = pos.coords.latitude;
          self.lng = pos.coords.longitude;
          self.alt = pos.coords.altitude;
          self.acc = pos.coords.accuracy;
          self.gpsOk = true;
          if (typeof pos.coords.heading === 'number' && !isNaN(pos.coords.heading) && pos.coords.speed > 0.6) {
            self.heading = pos.coords.heading;
          }
          var cities = window.CITIES;
          if (window.__chosenCity && cities && cities.length) {
            var city = null;
            for (var i = 0; i < cities.length; i++) if (cities[i].id === window.__chosenCity) { city = cities[i]; break; }
            if (city) {
              var dLon = (city.ll[1] - self.lng) * Math.PI / 180;
              var lat1 = self.lat * Math.PI / 180, lat2 = city.ll[0] * Math.PI / 180;
              var y = Math.sin(dLon) * Math.cos(lat2);
              var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
              self.targetBearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
            }
          }
          self.paint();
        }, function () {
          self.gpsOk = false;
          self.paint();
          if (!self.gpsWarned) {
            self.gpsWarned = true;
            Notify.toast({ tone: 'amber', title: 'Location needed', sub: 'Allow GPS for heading, elevation and the map ring.', n: 'GPS' });
          }
        }, { enableHighAccuracy: true, maximumAge: 1000 });
      }
      this._onOri = this.onOri.bind(this);
      var bindAbs = function () {
        self._absBound = true;
        addEventListener('deviceorientationabsolute', self._onOri, true);
      };
      var bindRel = function () {
        addEventListener('deviceorientation', self._onOri, true);
      };
      if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
        DeviceOrientationEvent.requestPermission().then(function (s) {
          if (s === 'granted') { bindAbs(); bindRel(); }
        }).catch(bindRel);
      } else {
        bindAbs();
        bindRel();
      }
    },

    stopSensors: function () {
      if (this.watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      if (this._onOri) {
        removeEventListener('deviceorientationabsolute', this._onOri, true);
        removeEventListener('deviceorientation', this._onOri, true);
      }
      this._absBound = false;
    },

    show: function (mode) {
      this.mount();
      this.open = true;
      this.els.wrap.classList.add('open');
      this.setMode(mode || 'rose');
      this.startSensors();
      this.paint();
      Sound.success();
      Notify.toast({ tone: 'blue', title: 'Compass live', sub: 'True heading, GPS elevation and calibrations are on.', n: 'N' });
    },

    hide: function () {
      this.open = false;
      if (this.els.wrap) this.els.wrap.classList.remove('open', 'immersive', 'map-on');
      this.stopSensors();
    },

    toggle: function () { this.open ? this.hide() : this.show(); }
  };

  GOO.Compass = Compass;
})(window);
