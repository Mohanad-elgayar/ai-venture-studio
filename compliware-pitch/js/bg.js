/* Compliware pitch: Three.js blueprint background
   Scenes drive it by tweening the plain proxy object BG.p with GSAP;
   the render loop copies proxy values onto the 3D objects every frame.
   If WebGL is unavailable, BG.ok stays false and every call is a no-op. */
(function () {
  const CW = (window.CW = window.CW || {});

  const p = {
    dim: 0, grid: 0, particles: 0,
    building: 0, bx: 0, slab: 0, slabA: 0, spin: 1,
    core: 0,
    camX: 0, camY: 1.5, camZ: 18, lookY: 0,
  };

  // Per-scene presets (index = scene number - 1)
  const MODES = [
    { dim: 0, grid: 0, particles: 0, building: 0, bx: 0, slab: 0, slabA: 0, core: 0, camX: 0, camY: 1.5, camZ: 18, lookY: 0 },
    { dim: 1, grid: 0.6, particles: 0.6, building: 1, bx: 0, slab: 0, slabA: 0, core: 0, camX: 0, camY: 2.6, camZ: 15, lookY: 0, spin: 1 },
    { dim: 1, grid: 0.5, particles: 0.85, building: 0, slabA: 0, core: 1, camX: 0, camY: 1.2, camZ: 17, lookY: 0 },
    { dim: 1, grid: 0.35, particles: 0.5, building: 0, slabA: 0, core: 0, camX: -2, camY: 4, camZ: 20, lookY: 0 },
    { dim: 1, grid: 0.35, particles: 0.5, building: 0, slabA: 0, core: 0, camX: 2, camY: 4.5, camZ: 20, lookY: 0 },
    { dim: 1, grid: 0.4, particles: 0.5, building: 0, slabA: 0, core: 0, camX: 3, camY: 3, camZ: 18, lookY: 0 },
    { dim: 1, grid: 0.5, particles: 0.7, building: 0, slabA: 0, core: 0, camX: 0, camY: 6, camZ: 18, lookY: 0 },
    { dim: 1, grid: 0.4, particles: 0.6, building: 0, slabA: 0, core: 0, camX: -3, camY: 3.5, camZ: 19, lookY: 0 },
    { dim: 1, grid: 0.6, particles: 0.8, building: 0, slabA: 0, core: 0, camX: 4, camY: 2, camZ: 17, lookY: 0 },
    { dim: 0.55, grid: 0.15, particles: 0.5, building: 0, slabA: 0, core: 0, camX: 0, camY: 1, camZ: 24, lookY: 0 },
  ];

  const W = 7, D = 4.4, H = 1.05, FLOORS = 6; // building footprint & storey height
  const BG = { ok: false, p, anchors: [] };
  let renderer, scene, camera, canvas, lite = false, isPaused = () => false;
  let mats = {}, groups = {}, t = 0, last = 0, lastDim = -1;

  function sprite() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.22, 'rgba(255,255,255,.65)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function points(n, color, size, tex) {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 80;
      pos[i * 3 + 1] = -6 + Math.random() * 26;
      pos[i * 3 + 2] = -45 + Math.random() * 52;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size, map: tex, color, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    return [new THREE.Points(geo, mat), mat];
  }

  function segs(list, mat) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(list, 3));
    return new THREE.LineSegments(geo, mat);
  }

  function build() {
    const tex = sprite();
    const n = lite ? 380 : 1500;
    const [pc, mc] = points(n, 0x5fe9ff, 0.16, tex);
    const [pa, ma] = points(Math.round(n / 8), 0xffb547, 0.2, tex);
    groups.particles = new THREE.Group();
    groups.particles.add(pc, pa);
    scene.add(groups.particles);
    mats.pc = mc; mats.pa = ma;

    // Blueprint floor grid
    const g1 = new THREE.GridHelper(140, 140, 0x135a78, 0x0d3a52);
    const g2 = new THREE.GridHelper(140, 28, 0x2bb7d6, 0x2bb7d6);
    [g1, g2].forEach((g) => { g.material.transparent = true; g.material.opacity = 0; g.material.depthWrite = false; g.position.y = -4.6; scene.add(g); });
    mats.g1 = g1.material; mats.g2 = g2.material;

    // Building wireframe
    const B = new THREE.Group();
    const lm = new THREE.LineBasicMaterial({ color: 0x48e0ff, transparent: true, opacity: 0, depthWrite: false });
    const lmDim = new THREE.LineBasicMaterial({ color: 0x2a8fb0, transparent: true, opacity: 0, depthWrite: false });
    const slabEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(W, 0.12, D));
    for (let i = 0; i <= FLOORS; i++) {
      const e = new THREE.LineSegments(slabEdges, lm);
      e.position.y = i * H;
      B.add(e);
    }
    const s = [];
    const xs = [-W / 2, -W / 6, W / 6, W / 2], zs = [-D / 2, 0, D / 2];
    xs.forEach((x) => zs.forEach((z) => s.push(x, 0, z, x, FLOORS * H, z)));
    for (let i = 1; i < FLOORS; i++) { // beams
      const y = i * H;
      s.push(-W / 2, y, 0, W / 2, y, 0);
      s.push(-W / 6, y, -D / 2, -W / 6, y, D / 2, W / 6, y, -D / 2, W / 6, y, D / 2);
    }
    B.add(segs(s, lmDim));
    const shaft = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.3, FLOORS * H, 1.3)), lm);
    shaft.position.set(-W / 2 + 1.2, (FLOORS * H) / 2, -D / 2 + 1.0);
    B.add(shaft);

    // Level 2 slab (pours from left to right)
    const slabGeo = new THREE.BoxGeometry(W, 0.14, D);
    slabGeo.translate(W / 2, 0, 0);
    const sm = new THREE.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: 0, depthWrite: false });
    const slab = new THREE.Mesh(slabGeo, sm);
    slab.position.set(-W / 2, 2 * H, 0);
    B.add(slab);
    const rm = new THREE.LineBasicMaterial({ color: 0xff6b7a, transparent: true, opacity: 0, depthWrite: false });
    const slabLine = new THREE.LineSegments(slabEdges, rm);
    slabLine.position.y = 2 * H;
    B.add(slabLine);

    B.position.set(0, -3.4, 0);
    B.rotation.y = -0.55;
    scene.add(B);
    groups.building = B; groups.slab = slab;
    mats.lm = lm; mats.lmDim = lmDim; mats.slab = sm; mats.slabLine = rm;

    // Core rings (scene 3)
    const C = new THREE.Group();
    const ringMats = [];
    [[3.0, 0x3be8ff, 1.1, 0], [3.7, 0xffb547, 0.6, 0.9], [4.5, 0x3be8ff, -0.5, 0.4]].forEach(([r, col, tx, tz]) => {
      const pts = [];
      for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
      const m = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false });
      const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), m);
      loop.rotation.set(tx, 0, tz);
      ringMats.push(m);
      C.add(loop);
    });
    scene.add(C);
    groups.core = C; mats.rings = ringMats;
  }

  function apply() {
    if (p.dim !== lastDim) { canvas.style.opacity = p.dim; lastDim = p.dim; }
    mats.pc.opacity = p.particles * 0.85;
    mats.pa.opacity = p.particles * 0.9;
    mats.g1.opacity = p.grid * 0.45;
    mats.g2.opacity = p.grid * 0.5;
    mats.lm.opacity = p.building * 0.75;
    mats.lmDim.opacity = p.building * 0.35;
    groups.building.visible = p.building > 0.001;
    groups.building.position.x = p.bx;
    groups.building.rotation.y = -0.55 + Math.sin(t * 0.12) * 0.18 * p.spin;
    groups.slab.scale.x = Math.max(0.0001, p.slab);
    mats.slab.opacity = p.slabA * 0.72;
    mats.slabLine.opacity = p.slabA * Math.min(1, p.slab * 3) * 0.9;
    groups.core.visible = p.core > 0.001;
    mats.rings.forEach((m) => (m.opacity = p.core * 0.55));
    groups.core.rotation.z = t * 0.15;
    groups.core.rotation.y = Math.sin(t * 0.2) * 0.3;
    groups.particles.rotation.y = t * 0.012;
    groups.particles.position.y = Math.sin(t * 0.2) * 0.3;

    camera.position.set(p.camX + Math.sin(t * 0.07) * 0.7, p.camY + Math.sin(t * 0.05) * 0.35, p.camZ);
    camera.lookAt(p.camX * 0.3, p.lookY, 0);
  }

  const v3 = () => new THREE.Vector3();
  let tmp;
  function updateAnchors() {
    if (!BG.anchors.length) return;
    groups.building.updateMatrixWorld();
    BG.anchors.forEach((a) => {
      if (!a.el.isConnected) return;
      tmp.set(a.local[0], a.local[1], a.local[2]).applyMatrix4(groups.building.matrixWorld).project(camera);
      const x = ((tmp.x + 1) / 2) * 1920, y = ((1 - tmp.y) / 2) * 1080;
      a.el.style.transform = `translate3d(${x + 70}px, ${y}px, 0) translateY(-50%)`;
    });
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (document.hidden) return;
    const dtMs = now - last;
    if (lite && dtMs < 30) return; // ~30 fps cap in lite mode
    const dt = Math.min(0.05, dtMs / 1000);
    last = now;
    if (!isPaused()) t += dt;
    apply();
    updateAnchors();
    if (p.dim > 0.001) renderer.render(scene, camera);
  }

  BG.init = function (cv, opts) {
    canvas = cv;
    lite = !!opts.lite;
    isPaused = opts.isPaused || isPaused;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: !lite, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    } catch (e) {
      console.warn('WebGL unavailable, running without 3D background', e);
      return false;
    }
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02050b, 0.032);
    camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 200);
    tmp = v3();
    build();
    BG.ok = true;
    BG.setScale(opts.scale || 1);
    requestAnimationFrame(loop);
    return true;
  };

  BG.setScale = function (s) {
    if (!renderer) return;
    const dpr = window.devicePixelRatio || 1;
    const pr = Math.max(0.5, Math.min(lite ? 0.8 : 1.5, dpr * s));
    renderer.setPixelRatio(pr);
    renderer.setSize(1920, 1080, false);
  };

  BG.mode = function (i, dur) {
    gsap.killTweensOf(p);
    gsap.to(p, Object.assign({ duration: dur == null ? 1.8 : dur, ease: 'power2.inOut', overwrite: true }, MODES[i] || MODES[2]));
  };

  BG.setNow = function (vals) { gsap.killTweensOf(p); Object.assign(p, vals); };

  // Keep a DOM element pinned next to a point on the building (local coords).
  BG.anchor = function (el, which) {
    BG.anchors = BG.anchors.filter((a) => a.el.isConnected);
    if (which === 'slab') BG.anchors.push({ el, local: [W * 0.05, 2 * H, D / 2] });
  };
  BG.clearAnchors = function () { BG.anchors = []; };

  CW.BG = BG;
})();
