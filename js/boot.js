/* Critical boot: defer Three.js / Leaflet until they are actually needed. */
(function (root) {
  'use strict';

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) {
        resolve();
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function loadCss(href) {
    return new Promise(function (resolve) {
      if (document.querySelector('link[href="' + href + '"]')) {
        resolve();
        return;
      }
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = resolve;
      l.onerror = resolve;
      document.head.appendChild(l);
    });
  }

  var pending = {};
  function once(key, fn) {
    if (!pending[key]) pending[key] = fn();
    return pending[key];
  }

  var THREE_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
  var LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';

  var GOOLoad = {
    script: loadScript,
    css: loadCss,
    three: function () {
      return once('three', function () {
        var ready = window.THREE ? Promise.resolve() : loadScript(THREE_SRC);
        return ready.then(function () {
          if (window.__globeReady) return;
          return loadScript('js/goo-globe.js');
        });
      });
    },
    leaflet: function () {
      return once('leaflet', function () {
        return loadCss(LEAFLET_CSS).then(function () {
          if (window.L) return;
          return loadScript(LEAFLET_JS);
        });
      });
    }
  };
  root.GOOLoad = GOOLoad;

  function whenVisible(el, fn) {
    if (!el) {
      fn();
      return;
    }
    if (!('IntersectionObserver' in window)) {
      fn();
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0] || !entries[0].isIntersecting) return;
      io.disconnect();
      fn();
    }, { rootMargin: '120px' });
    io.observe(el);
  }

  function bootGlobe() {
    var wrap = document.getElementById('globeWrap');
    whenVisible(wrap, function () {
      GOOLoad.three().catch(function () {});
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootGlobe);
  } else {
    bootGlobe();
  }
})(window);
