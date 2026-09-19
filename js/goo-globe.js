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

  var R = 2;
  var scene  = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.1, 7.3);

  var conn = navigator.connection || navigator.mozConnection || {};
  var saveData = !!conn.saveData || /2g/.test(conn.effectiveType || '');
  var low = saveData || (window.GOO && GOO.Device && GOO.Device.mobile);
  var segs = low ? 32 : 48;
  var renderer = new THREE.WebGLRenderer({ antialias:!low, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.5));
  mount.appendChild(renderer.domElement);

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

  function applyTexture(tex){
    mat.map = tex;
    mat.emissiveMap = tex;
    mat.emissiveIntensity = 0.30;   // lifts the shadow side without washing out
    mat.needsUpdate = true;
  }
  applyTexture(fallbackTexture());
  var loader = new THREE.TextureLoader();
  loader.crossOrigin = 'anonymous';
  var TEX = {
    default:'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
    night:'https://threejs.org/examples/textures/planets/earth_lights_2048.jpg',
    marble:'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
  };
  if(!saveData) loader.load(TEX.default, applyTexture, undefined, function(){});
  window.__globeTex = function(key){
    var url = TEX[key] || TEX.default;
    loader.load(url, applyTexture, undefined, function(){});
  };
  var idlePrefetch = window.requestIdleCallback || function(fn){ setTimeout(fn, 1800); };
  idlePrefetch(function(){
    if(saveData) return;
    var img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.src = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/2/1/2';
  }, { timeout:2000 });

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
        ev.stopPropagation();
        window.__chosenCity = c.id;
        if(window.__globeLook) window.__globeLook(c.lat, c.lng);
      });
      pinRoot.appendChild(el);
      c.el = el;
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
      PIN_CITIES.forEach(function(c){
        if(!c.el) return;
        var world = latLonToVec(c.lat, c.lng, R).applyMatrix4(spin.matrixWorld);
        var front = world.clone().normalize().dot(camN) > 0.18;
        var p = world.project(camera);
        var x = (p.x * 0.5 + 0.5) * w;
        var y = (-p.y * 0.5 + 0.5) * h;
        c.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        c.el.style.opacity = front ? '1' : '0';
        c.el.classList.toggle('front', front);
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
