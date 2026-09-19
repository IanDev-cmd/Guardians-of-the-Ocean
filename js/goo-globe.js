/* 3D globe (Three.js r128) */
/* =====================================================================
   GLOBE
   The reference earth has NO night side: it reads as uniformly lit with a
   bright cyan-white rim wrapping the lower-left limb. That is reproduced
   with: white ambient + a near-camera key light + an emissiveMap lift, and
   an additive fresnel shell for the halo. A plain directional/phong rig
   (which is what produced the dark globe) is deliberately avoided.
   ===================================================================== */
(function(){
  'use strict';
  var mount = document.getElementById('globeMount');
  if(!window.THREE || !mount) return;
  if(mount.querySelector('canvas')) return;

  var R = 2;
  var scene  = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.1, 5.85);

  var conn = navigator.connection || navigator.mozConnection || {};
  var saveData = !!conn.saveData || /2g/.test(conn.effectiveType || '');
  var mem = navigator.deviceMemory || 8;
  var cores = navigator.hardwareConcurrency || 8;
  var mobile = !!(window.GOO && GOO.Device && GOO.Device.mobile);
  var low = saveData || mobile || mem <= 2 || cores <= 2;
  var mid = !low && (mem <= 4 || cores <= 4);
  var segs = low ? 24 : mid ? 32 : 48;
  var renderer = new THREE.WebGLRenderer({ antialias:!low, alpha:true, powerPreference: low ? 'low-power' : 'default' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1 : mid ? 1.25 : 1.5));
  if(THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.domElement.style.opacity = '0';
  renderer.domElement.style.transition = 'opacity .35s ease';
  mount.appendChild(renderer.domElement);
  var wrap = document.getElementById('globeWrap');

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  var key = new THREE.DirectionalLight(0xffffff, 0.75);
  key.position.set(1.2, 0.9, 4.0);          // almost head-on: kills the terminator
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xbfe9ff, 0.38);
  rim.position.set(-3.2, -2.0, 1.2);        // the cool lower-left limb wrap
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xdff4ff, 0x2f8fd6, 0.22));

  var tilt = new THREE.Group();
  tilt.rotation.z = -16 * Math.PI/180;
  tilt.rotation.x =   5 * Math.PI/180;
  scene.add(tilt);
  var spin = new THREE.Group();
  spin.rotation.y = 2.45;                   // opens on the Americas, as in frame 0
  tilt.add(spin);

  function fallbackTexture(){
    var c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    var x = c.getContext('2d');
    var g = x.createLinearGradient(0,0,0,512);
    g.addColorStop(0,'#28658f'); g.addColorStop(.5,'#245e88'); g.addColorStop(1,'#1f5378');
    x.fillStyle = g; x.fillRect(0,0,1024,512);
    // greens sampled from the reference: #185f2a / #2b7c47 / #3f8e56
    var land = [
      [232,150,46,60,'#2b7c47'],[248,196,26,40,'#3f8e56'],[268,250,30,58,'#2b7c47'],
      [286,318,20,46,'#185f2a'],[200,128,30,26,'#3f8e56'],[176,96,22,16,'#e9f4f8'],
      [506,132,40,30,'#2b7c47'],[534,186,34,44,'#185f2a'],[556,252,26,40,'#3f8e56'],
      [596,140,44,34,'#2b7c47'],[646,158,54,40,'#3f8e56'],[700,200,40,34,'#2b7c47'],
      [740,150,46,32,'#3f8e56'],[812,270,40,44,'#2b7c47'],[856,330,34,30,'#185f2a'],
      [640,110,36,22,'#3f8e56'],[420,180,16,14,'#2b7c47']
    ];
    land.forEach(function(b){
      x.fillStyle = b[4]; x.beginPath();
      x.ellipse(b[0],b[1],b[2],b[3],0,0,Math.PI*2); x.fill();
    });
    x.fillStyle = 'rgba(242,251,255,.96)';
    x.fillRect(0,0,1024,18); x.fillRect(0,494,1024,18);
    return new THREE.CanvasTexture(c);
  }

  var mat = new THREE.MeshPhongMaterial({
    shininess:10, specular:0x2a5f8c,
    emissive:0xffffff, emissiveIntensity:0.0
  });
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(R, segs, segs), mat));

  function revealGlobe(){
    renderer.domElement.style.opacity = '1';
    if(wrap) wrap.classList.add('globe-live');
  }
  function applyTexture(tex){
    if(tex.anisotropy !== undefined) tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if(THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    mat.map = tex;
    mat.emissiveMap = tex;
    mat.emissiveIntensity = 0.30;   // lifts the shadow side without washing out
    mat.needsUpdate = true;
    revealGlobe();
  }
  var loader = new THREE.TextureLoader();
  loader.crossOrigin = 'anonymous';
  var TEX = {
    default:['assets/3d/earth-atmos.jpg','https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg'],
    night:['assets/3d/earth-night.jpg','https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-night.jpg'],
    marble:['assets/3d/earth-atmos.jpg','https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg']
  };
  function loadChain(urls, i){
    i = i || 0;
    if(!urls || i >= urls.length) return;
    loader.load(urls[i], applyTexture, undefined, function(){ loadChain(urls, i + 1); });
  }
  loadChain(TEX.default);
  window.__globeTex = function(key){
    loadChain(TEX[key] || TEX.default);
  };
  window.__globeReady = true;

  // additive fresnel halo — the luminous edge the reference has
  var fres = new THREE.ShaderMaterial({
    uniforms:{ c:{value:0.17}, p:{value:4.2}, glow:{value:new THREE.Color(0xa8e4ff)} },
    vertexShader:
      'varying vec3 vN; varying vec3 vP;' +
      'void main(){ vN = normalize(normalMatrix * normal);' +
      ' vec4 mv = modelViewMatrix * vec4(position,1.0); vP = normalize(-mv.xyz);' +
      ' gl_Position = projectionMatrix * mv; }',
    fragmentShader:
      'uniform float c; uniform float p; uniform vec3 glow;' +
      'varying vec3 vN; varying vec3 vP;' +
      'void main(){ float i = pow(c - dot(vN, vP), p);' +
      ' gl_FragColor = vec4(glow, 1.0) * clamp(i, 0.0, 1.0); }',
    side:THREE.BackSide, blending:THREE.AdditiveBlending,
    transparent:true, depthWrite:false
  });
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(R*1.15, 32, 32), fres));

  var lw=0, lh=0;
  function sync(){
    var w = mount.clientWidth, h = mount.clientHeight;
    if(w>0 && h>0 && (w!==lw || h!==lh)){
      lw=w; lh=h;
      renderer.setSize(w,h,false);
      camera.aspect = w/h; camera.updateProjectionMatrix();
    }
  }
  window.__spin = spin;
  var pwaGlobe = window.GOO && GOO.Device && (GOO.Device.embed || GOO.Device.fromPwa);
  var spinRate = pwaGlobe ? 0.0044 : 0.0019;

  function latLonToVec(lat, lon, r){
    var phi = (90 - lat) * Math.PI / 180;
    var theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
       r * Math.cos(phi),
       r * Math.sin(phi) * Math.sin(theta)
    );
  }

  var PIN_CITIES = [
    {id:'jakarta', name:'Jakarta', lat:-6.2088, lng:106.8456, risk:'critical'},
    {id:'manila', name:'Manila', lat:14.5995, lng:120.9842, risk:'critical'},
    {id:'hcmc', name:'Ho Chi Minh', lat:10.8231, lng:106.6297, risk:'critical'},
    {id:'lagos', name:'Lagos', lat:6.5244, lng:3.3792, risk:'critical'},
    {id:'miami', name:'Miami', lat:25.7617, lng:-80.1918, risk:'elevated'},
    {id:'mumbai', name:'Mumbai', lat:19.0760, lng:72.8777, risk:'elevated'},
    {id:'mombasa', name:'Mombasa', lat:-4.0435, lng:39.6682, risk:'elevated'},
    {id:'sydney', name:'Sydney', lat:-33.8688, lng:151.2093, risk:'managed'},
    {id:'capetown', name:'Cape Town', lat:-33.9249, lng:18.4241, risk:'managed'},
    {id:'rotterdam', name:'Rotterdam', lat:51.9244, lng:4.4777, risk:'managed'}
  ];
  var pinRoot = document.getElementById('globePins');
  if(pinRoot){
    PIN_CITIES.forEach(function(c){
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'gpin' + (c.risk==='critical' ? ' crit' : c.risk==='elevated' ? ' elev' : '');
      el.dataset.id = c.id;
      el.innerHTML = '<i></i><span>' + c.name.toUpperCase() + '</span>';
      el.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        window.__chosenCity = c.id;
        if(window.__globeLook) window.__globeLook(c.lat, c.lng);
      });
      pinRoot.appendChild(el);
      c.el = el;
    });
    pinRoot.addEventListener('click', function(ev){ ev.stopPropagation(); });
  }
  if(wrap){
    wrap.addEventListener('click', function(ev){ ev.stopPropagation(); });
    wrap.addEventListener('pointerup', function(ev){
      if(ev.target && (ev.target === wrap || ev.target.id === 'globeMount' || ev.target.closest && ev.target.closest('#globeMount'))){
        ev.stopPropagation();
      }
    });
  }

  window.__globeLook = function(lat, lng){
    window.__globeAim = {
      y: -(lng) * Math.PI / 180 + Math.PI * 0.5,
      x: (lat) * Math.PI / 180 * 0.28
    };
  };

  (function loop(){
    requestAnimationFrame(loop);
    sync();
    if(window.__globeAim){
      var aim = window.__globeAim;
      var dy = aim.y - spin.rotation.y;
      while(dy > Math.PI) dy -= Math.PI*2;
      while(dy < -Math.PI) dy += Math.PI*2;
      spin.rotation.y += dy * 0.07;
      var tx = (aim.x) - tilt.rotation.x;
      tilt.rotation.x += tx * 0.07;
      if(Math.abs(dy) < 0.012 && Math.abs(tx) < 0.012) window.__globeAim = null;
    } else {
      spin.rotation.y += spinRate + (window.__spinBoost || 0);
    }
    spin.updateMatrixWorld(true);
    tilt.updateMatrixWorld(true);
    if(pinRoot){
      var w = mount.clientWidth, h = mount.clientHeight;
      var camN = camera.position.clone().normalize();
      var dist = camera.position.length();
      var fov = camera.fov * Math.PI / 180;
      var rPx = (h / 2) * Math.tan(Math.asin(Math.min(0.999, R / dist))) / Math.tan(fov / 2);
      pinRoot.style.setProperty('--pin-clip', ((rPx / Math.max(w, 1)) * 100).toFixed(2) + '%');
      var r2 = rPx * rPx * 0.90;
      var cx = w * 0.5, cy = h * 0.5;
      PIN_CITIES.forEach(function(c){
        if(!c.el) return;
        var world = latLonToVec(c.lat, c.lng, R).applyMatrix4(spin.matrixWorld);
        var facing = world.clone().normalize().dot(camN) > 0.22;
        var p = world.project(camera);
        var x = (p.x * 0.5 + 0.5) * w;
        var y = (-p.y * 0.5 + 0.5) * h;
        var dx = x - cx, dy = y - cy;
        var onGlobe = facing && p.z > -1 && p.z < 1 && (dx * dx + dy * dy) <= r2;
        c.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        c.el.style.opacity = onGlobe ? '1' : '0';
        c.el.classList.toggle('front', onGlobe);
        c.el.classList.toggle('gpin-left', x > cx);
        c.el.style.pointerEvents = onGlobe ? 'auto' : 'none';
      });
    }
    renderer.render(scene, camera);
  })();

  var lastPtr = Date.now();
  addEventListener('pointerdown', function(){ lastPtr = Date.now(); }, { passive:true });
  setInterval(function(){
    if(Date.now() - lastPtr < 12000) return;
    if(pwaGlobe) return;
    if(document.body.classList.contains('terra-open') || document.body.classList.contains('tut-on')) return;
    if(document.getElementById('app') && document.getElementById('app').classList.contains('globe-focus')) return;
    var comp = document.getElementById('goCompass');
    if(comp && comp.classList.contains('open')) return;
    if(window.GOO && GOO.Device && GOO.Device.reduced) return;
    var c = PIN_CITIES[Math.floor(Math.random() * PIN_CITIES.length)];
    if(window.__globeLook) window.__globeLook(c.lat, c.lng);
  }, 12000);
})();
