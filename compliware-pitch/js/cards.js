/* Compliware pitch: the shared document-card field.
   Scene 2: cards drift and collide (simple 2D physics).
   Scene 3: cards snap into ordered columns around the core. */
(function () {
  const CW = (window.CW = window.CW || {});
  const SW = 1920, SH = 1080, CW_ = 230, CH_ = 92;

  const CF = { obstacles: [], cards: [], lost: null, reticle: { a: 0, l1: 1, l2: 0 }, layer: null, physics: false, visible: false };
  let isPaused = () => false, lite = false, last = 0, retEl, retL1, retL2;

  const rand = (a, b) => a + Math.random() * (b - a);

  CF.init = function (layer, opts) {
    CF.layer = layer;
    lite = !!opts.lite;
    isPaused = opts.isPaused || isPaused;
    const per = lite ? 3 : 6;
    CW.CARD_TYPES.forEach((type, ti) => {
      type.items.slice(0, per).forEach((it, row) => {
        const el = document.createElement('div');
        el.className = `card t-${type.key}` + (it[3] ? ' lost' : '');
        el.innerHTML = `<div class="card-top"><span class="badge">${type.label}</span><span class="cid">${it[0]}</span></div>
          <div class="ctitle">${it[1]}</div><div class="cmeta">${it[2]}</div>`;
        layer.appendChild(el);
        const c = { el, ti, row, x: SW / 2, y: SH / 2, r: 0, s: 1, a: 0, vx: 0, vy: 0, vr: 0, depth: 1, flag: 0, rec: 0, lost: !!it[3] };
        CF.cards.push(c);
        if (c.lost) CF.lost = c;
      });
    });
    retEl = document.createElement('div');
    retEl.className = 'reticle';
    retEl.innerHTML = '<i class="rc a"></i><i class="rc b"></i><i class="rc c"></i><i class="rc d"></i><span class="rl l1">Awaiting response · 12 days</span><span class="rl l2">Lost in the thread</span>';
    layer.appendChild(retEl);
    retL1 = retEl.querySelector('.l1');
    retL2 = retEl.querySelector('.l2');
    requestAnimationFrame(tick);
  };

  /* Random scatter + velocities */
  function scatter(c) {
    c.depth = lite ? 1 : rand(0.82, 1.02);
    c.s = c.depth;
    for (let k = 0; k < 20; k++) {
      c.x = rand(140, SW - 140);
      c.y = rand(90, SH - 90);
      if (!CF.obstacles.some((o) => c.x > o.x - 120 && c.x < o.x + o.w + 120 && c.y > o.y - 50 && c.y < o.y + o.h + 50)) break;
    }
    c.r = rand(-9, 9);
    const sp = rand(35, 85), ang = rand(0, Math.PI * 2);
    c.vx = Math.cos(ang) * sp;
    c.vy = Math.sin(ang) * sp;
    c.vr = rand(-4, 4);
    c.flag = 0; c.rec = 0;
  }

  CF.reset = function () {
    gsap.killTweensOf(CF.cards);
    gsap.killTweensOf(CF.reticle);
    CF.cards.forEach((c) => { scatter(c); c.a = 0; });
    // The lost card starts in a visible, readable spot on the left
    const L = CF.lost;
    L.x = 520; L.y = 560; L.r = -3; L.s = 1.05; L.vx = 28; L.vy = -12; L.vr = 1;
    Object.assign(CF.reticle, { a: 0, l1: 1, l2: 0 });
  };

  /* Scene 2 entrance: returns a timeline (cards fade in, physics starts) */
  CF.chaos = function () {
    CF.reset();
    CF.show();
    CF.physics = true;
    const tl = gsap.timeline();
    tl.to(CF.cards, { a: 1, duration: 0.9, ease: 'power2.out', stagger: { each: 0.035, from: 'random' } }, 0);
    return tl;
  };

  /* Instant scatter (used when entering scene 3 directly) */
  CF.scatterNow = function () {
    CF.reset();
    CF.cards.forEach((c) => (c.a = 1));
    CF.show();
  };

  /* Scene 3: snap into ordered columns. Returns a timeline. */
  CF.order = function () {
    CF.physics = false;
    CF.obstacles = [];
    gsap.killTweensOf(CF.cards);
    CF.show();
    const tl = gsap.timeline();
    tl.to(CF.reticle, { a: 0, duration: 0.3 }, 0);
    CF.cards.forEach((c) => {
      const left = c.ti < 3;
      const col = left ? c.ti : c.ti - 3;
      const x0 = left ? 120 : 1362;
      const tx = x0 + col * 151 + 69;
      const ty = 320 + c.row * 67 + 27.5;
      tl.to(c, { x: tx, y: ty, r: 0, s: 0.6, a: 1, flag: 0, duration: 1.25, ease: 'expo.inOut' }, 0.15 + Math.random() * 0.45);
    });
    tl.to(CF.lost, { rec: 1, duration: 0.6, ease: 'power2.out' }, 2.0);
    return tl;
  };

  CF.show = function () {
    if (CF.visible) return;
    CF.visible = true;
    gsap.killTweensOf(CF.layer);
    gsap.set(CF.layer, { autoAlpha: 1, filter: 'none' });
  };

  CF.hide = function (instant) {
    CF.physics = false;
    if (!CF.visible) return;
    CF.visible = false;
    gsap.killTweensOf(CF.layer);
    gsap.to(CF.layer, { autoAlpha: 0, duration: instant ? 0 : 0.6, onComplete: () => gsap.killTweensOf(CF.cards) });
  };

  function step(dt) {
    const cs = CF.cards;
    for (const c of cs) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.r = Math.max(-14, Math.min(14, c.r + c.vr * dt));
      const hw = (CW_ * c.s) / 2, hh = (CH_ * c.s) / 2;
      if (c.x < hw + 10) { c.x = hw + 10; c.vx = Math.abs(c.vx); }
      if (c.x > SW - hw - 10) { c.x = SW - hw - 10; c.vx = -Math.abs(c.vx); }
      if (c.y < hh + 10) { c.y = hh + 10; c.vy = Math.abs(c.vy); }
      if (c.y > SH - hh - 10) { c.y = SH - hh - 10; c.vy = -Math.abs(c.vy); }
      for (const o of CF.obstacles) { // keep headlines readable: cards bounce off them
        const ox = Math.min(c.x + hw, o.x + o.w) - Math.max(c.x - hw, o.x);
        const oy = Math.min(c.y + hh, o.y + o.h) - Math.max(c.y - hh, o.y);
        if (ox <= 0 || oy <= 0) continue;
        if (ox < oy) { const sx = c.x < o.x + o.w / 2 ? -1 : 1; c.x += sx * ox; c.vx = sx * Math.abs(c.vx); }
        else { const sy = c.y < o.y + o.h / 2 ? -1 : 1; c.y += sy * oy; c.vy = sy * Math.abs(c.vy); }
      }
    }
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i];
      if (a.a < 0.3) continue;
      for (let j = i + 1; j < cs.length; j++) {
        const b = cs[j];
        if (b.a < 0.3) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const ox = ((CW_ * a.s + CW_ * b.s) / 2) * 0.92 - Math.abs(dx);
        const oy = ((CH_ * a.s + CH_ * b.s) / 2) * 0.9 - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        if (ox < oy) {
          const sx = Math.sign(dx) || 1;
          a.x -= (sx * ox) / 2; b.x += (sx * ox) / 2;
          if ((b.vx - a.vx) * sx < 0) { const t = a.vx; a.vx = b.vx; b.vx = t; a.vr = rand(-6, 6); b.vr = rand(-6, 6); }
        } else {
          const sy = Math.sign(dy) || 1;
          a.y -= (sy * oy) / 2; b.y += (sy * oy) / 2;
          if ((b.vy - a.vy) * sy < 0) { const t = a.vy; a.vy = b.vy; b.vy = t; a.vr = rand(-6, 6); b.vr = rand(-6, 6); }
        }
      }
    }
  }

  function render() {
    for (const c of CF.cards) {
      c.el.style.transform = `translate3d(${(c.x - CW_ / 2).toFixed(1)}px, ${(c.y - CH_ / 2).toFixed(1)}px, 0) rotate(${c.r.toFixed(2)}deg) scale(${c.s.toFixed(3)})`;
      c.el.style.opacity = c.a.toFixed(3);
      if (c.flag || c.el._f) { c.el.style.setProperty('--flag', c.flag.toFixed(3)); c.el._f = c.flag; }
      if (c.rec || c.el._r) { c.el.style.setProperty('--rec', c.rec.toFixed(3)); c.el._r = c.rec; }
      c.el.style.zIndex = c.lost ? (c.a < 0.6 ? 0 : 50) : 10;
    }
    const R = CF.reticle, L = CF.lost;
    if (R.a > 0.001 || retEl._a) {
      retEl.style.opacity = R.a.toFixed(3);
      retEl.style.transform = `translate3d(${(L.x - 145).toFixed(1)}px, ${(L.y - 75).toFixed(1)}px, 0)`;
      retL1.style.opacity = R.l1;
      retL2.style.opacity = R.l2;
      retEl._a = R.a;
    }
  }

  function tick(now) {
    requestAnimationFrame(tick);
    const dtMs = now - last;
    if (lite && dtMs < 30) return;
    const dt = Math.min(0.05, dtMs / 1000);
    last = now;
    if (!CF.visible && CF.layer.style.visibility === 'hidden') return;
    if (CF.physics && !isPaused()) step(dt);
    render();
  }

  CW.CF = CF;
})();
