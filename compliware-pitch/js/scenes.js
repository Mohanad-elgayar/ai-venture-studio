/* Compliware pitch: scene choreography.
   Each scene's build(el, ctx) receives a fresh copy of its markup and
   returns a GSAP timeline. Optional ctx.steps = [fn, ...] are run by the
   "next" key after the timeline completes (used by the demo previews). */
(function () {
  const CW = (window.CW = window.CW || {});
  const BG = CW.BG, CF = CW.CF;
  const $ = (el, s) => el.querySelector(s);
  const $$ = (el, s) => Array.from(el.querySelectorAll(s));
  const rand = (a, b) => a + Math.random() * (b - a);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const isLite = () => document.body.classList.contains('lite');

  /* ---------- Helpers ---------- */
  function typeOn(el, text, cps, opts) {
    opts = opts || {};
    const tl = gsap.timeline();
    el.textContent = '';
    const tn = document.createTextNode('');
    el.appendChild(tn);
    let car = null;
    if (opts.caret !== false) {
      car = document.createElement('span');
      car.className = 'caret';
      el.appendChild(car);
      tl.set(car, { opacity: 1 });
    }
    const o = { n: 0 };
    tl.to(o, {
      n: text.length, duration: text.length / (cps || 16), ease: 'none',
      onUpdate() { tn.nodeValue = text.slice(0, Math.round(o.n)); },
      onComplete() { tn.nodeValue = text; },
    });
    if (car && !opts.keepCaret) tl.to(car, { opacity: 0, duration: 0.2 }, '+=0.6');
    return tl;
  }

  function streamWords(el, text, wps) {
    const words = text.split(' ');
    const o = { n: 0 };
    return gsap.to(o, {
      n: words.length, duration: words.length / (wps || 7), ease: 'none',
      onUpdate() { el.textContent = words.slice(0, Math.ceil(o.n)).join(' '); },
      onComplete() { el.textContent = text; },
    });
  }

  function countUp(el, to, dur, dec) {
    const o = { v: 0 };
    const fmt = (v) => (dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US'));
    return gsap.to(o, {
      v: to, duration: dur || 2, ease: 'power3.out',
      onUpdate() { el.textContent = fmt(o.v); },
      onComplete() { el.textContent = fmt(to); },
    });
  }

  /* ---------- Logo (canvas) ---------- */
  const LOGO_CY = 500;
  function drawMark(ctx, x, y, size, thick) {
    const k = size / 100;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.strokeStyle = '#5fefff';
    ctx.fillStyle = '#5fefff';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 4 * thick;
    ctx.beginPath();
    [[50, 6], [88.1, 28], [88.1, 72], [50, 94], [11.9, 72], [11.9, 28]].forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
    ctx.closePath();
    ctx.stroke();
    ctx.lineWidth = 7 * thick;
    ctx.beginPath();
    ctx.arc(50, 50, 22, -Math.PI / 4, Math.PI / 4, true);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(50, 50, 4 * thick, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffb547';
    ctx.beginPath(); ctx.arc(65.56, 65.56, 5.5 * thick, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawLogo(ctx, thick) {
    ctx.font = '600 100px "Space Grotesk"';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '12px';
    const tw = ctx.measureText('COMPLIWARE').width - 12;
    const ms = 160, gap = 46, x0 = (1920 - (ms + gap + tw)) / 2;
    drawMark(ctx, x0, LOGO_CY - ms / 2, ms, thick);
    ctx.fillStyle = '#eaf7ff';
    ctx.textBaseline = 'middle';
    ctx.fillText('COMPLIWARE', x0 + ms + gap, LOGO_CY + 4);
  }
  let samples = null;
  function logoSamples() {
    if (samples) return samples;
    const step = isLite() ? 5 : 3;
    const c = document.createElement('canvas');
    c.width = 1920; c.height = 1080;
    const g = c.getContext('2d');
    drawLogo(g, 1.25);
    const y0 = LOGO_CY - 110, y1 = LOGO_CY + 110;
    const d = g.getImageData(0, y0, 1920, y1 - y0).data;
    samples = [];
    for (let y = 0; y < y1 - y0; y += step) {
      for (let x = 0; x < 1920; x += step) {
        const i = (y * 1920 + x) * 4;
        if (d[i + 3] > 140) samples.push({ tx: x, ty: y + y0, amber: d[i] > 200 && d[i + 2] < 160 });
      }
    }
    return samples;
  }

  function logoTimeline(el) {
    const dust = $(el, '.logo-dust'), crisp = $(el, '.logo-crisp');
    const ctx = dust.getContext('2d');
    const cctx = crisp.getContext('2d');
    cctx.clearRect(0, 0, 1920, 1080);
    drawLogo(cctx, 1);
    const minX = 420, spanX = 1080;
    const pts = logoSamples().map((s) => {
      const ang = rand(0, Math.PI * 2), rad = rand(500, 1300);
      return {
        tx: s.tx, ty: s.ty, amber: s.amber,
        sx: 960 + Math.cos(ang) * rad, sy: 540 + Math.sin(ang) * rad * 0.6,
        d: Math.min(0.55, Math.max(0, rand(0, 0.3) + ((s.tx - minX) / spanX) * 0.25)),
        sw: rand(-140, 140), sz: rand(1.3, 2.6),
      };
    });
    const groups = [pts.filter((p) => !p.amber), pts.filter((p) => p.amber)];
    const fills = ['rgba(95,239,255,.92)', 'rgba(255,190,90,.95)'];
    const o = { t: 0 };
    function draw() {
      ctx.clearRect(0, 0, 1920, 1080);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, o.t * 6);
      for (let g = 0; g < 2; g++) {
        ctx.fillStyle = fills[g];
        for (const p of groups[g]) {
          const l = Math.min(1, Math.max(0, (o.t - p.d) / 0.45));
          const e = 1 - Math.pow(1 - l, 3);
          const sw = Math.sin(l * Math.PI) * p.sw;
          ctx.fillRect(p.sx + (p.tx - p.sx) * e + sw * 0.4, p.sy + (p.ty - p.sy) * e + sw, p.sz, p.sz);
        }
      }
      ctx.globalAlpha = 1;
    }
    return gsap.to(o, { t: 1, duration: 3.2, ease: 'none', onUpdate: draw, onComplete: draw });
  }

  /* ---------- Document preview ---------- */
  const Preview = (CW.Preview = {
    open: false,
    el: null,
    init() {
      this.el = document.getElementById('preview');
      $(this.el, '.pv-backdrop').addEventListener('click', () => this.close());
      $(this.el, '.pv-close').addEventListener('click', () => this.close());
    },
    show(key, fromEl) {
      const doc = CW.DOCS[key];
      if (!doc) return;
      const el = this.el, panel = $(el, '.pv-panel'), body = $(el, '.pv-body');
      const fill = () => {
        $(el, '.pv-type').textContent = doc.type;
        $(el, '.pv-title').textContent = doc.title;
        body.innerHTML = doc.html;
        const marks = $$(body, 'mark');
        if (marks.length) gsap.fromTo(marks, { backgroundSize: '0% 100%' }, { backgroundSize: '100% 100%', duration: 1, ease: 'power2.inOut', delay: 0.45, stagger: 0.3 });
      };
      gsap.killTweensOf([panel, body, $(el, '.pv-backdrop')]);
      if (this.open) {
        gsap.to(body, { opacity: 0, duration: 0.2, onComplete() { fill(); gsap.to(body, { opacity: 1, duration: 0.3 }); } });
      } else {
        fill();
        gsap.set(body, { opacity: 1 });
        gsap.set(el, { autoAlpha: 1 });
        gsap.fromTo($(el, '.pv-backdrop'), { opacity: 0 }, { opacity: 1, duration: 0.4 });
        let dx = 0, dy = 300;
        if (fromEl) {
          const st = document.getElementById('stage').getBoundingClientRect();
          const r = fromEl.getBoundingClientRect();
          const k = CW.App ? CW.App.scale : 1;
          dx = ((r.left + r.width / 2 - st.left) / k) - 960;
          dy = ((r.top + r.height / 2 - st.top) / k) - 540;
        }
        gsap.fromTo(panel, { x: dx, y: dy, scale: 0.12, opacity: 0 }, { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.75, ease: 'expo.out' });
      }
      this.open = true;
      this.key = key;
    },
    close(instant) {
      if (!this.open) return;
      this.open = false;
      const el = this.el;
      gsap.killTweensOf([$(el, '.pv-panel'), $(el, '.pv-backdrop')]);
      if (instant) { gsap.set(el, { autoAlpha: 0 }); return; }
      gsap.to($(el, '.pv-panel'), { scale: 0.92, opacity: 0, duration: 0.3, ease: 'power2.in' });
      gsap.to($(el, '.pv-backdrop'), { opacity: 0, duration: 0.35, onComplete: () => { if (!this.open) gsap.set(el, { autoAlpha: 0 }); } });
    },
  });

  /* ---------- Demo chat skeleton (rendered once at boot) ---------- */
  function renderDemo(sec) {
    const d = sec.dataset;
    const chips = JSON.parse(d.chips);
    const delta = d.delta ? JSON.parse(d.delta) : null;
    const sources = ['Emails', 'RFIs', 'Drawings', 'Meeting minutes', 'Submittals'];
    sec.innerHTML = `
      <div class="head-block tl"><div class="kicker">${esc(d.kicker)}</div></div>
      <div class="demo-count">${esc(d.count)}</div>
      <div class="app glass">
        <div class="app-head">
          <svg><use href="#cw-mark"/></svg>
          <div class="an">ZAKERAH<em>Project memory</em></div>
          <div class="proj"><span class="live"></span>Project <b>Oberoi – Wadi Safar</b></div>
        </div>
        <div class="app-body">
          <div class="side">
            <div class="si on"><i></i>Ask the project</div>
            <div class="si"><i></i>Mutabiq checks</div>
            <div class="si"><i></i>Open items</div>
            <div class="sk">Sources searched</div>
            ${sources.map((s) => `<div class="src"><span>${s}</span><span class="dot"></span></div>`).join('')}
          </div>
          <div class="chat">
            <div class="msgs">
              <div class="msg-user">${esc(d.q)}</div>
              <div class="msg-ai">
                <div class="av"><svg><use href="#cw-mark"/></svg></div>
                <div class="bub">
                  <div class="thinking"><div class="bars"><i></i><i></i><i></i><i></i></div><span>Searching emails, RFIs, drawings and minutes…</span></div>
                  <div class="ans"></div>
                  ${delta ? `<div class="delta"><span>${esc(delta[0])}</span><svg viewBox="0 0 46 16"><path d="M0 8H40M34 2L42 8L34 14" stroke="#3be8ff" stroke-width="2" fill="none"/></svg><span>${esc(delta[1])}</span></div>` : ''}
                  <div class="detail">${esc(d.detail)}</div>
                  <div class="src-label">Sources</div>
                  <div class="chips">${chips.map((c) => `<button class="chip" type="button" tabindex="-1" data-doc="${c.doc}"><span class="ct ${c.type}">${c.type}</span><span><b>${esc(c.label)}</b><small>${esc(c.sub)}</small></span><i class="spark"></i></button>`).join('')}</div>
                  <div class="hint">Click a source to open the document</div>
                </div>
              </div>
            </div>
            <div class="inputbar"><div class="typed"></div><button class="send" type="button" tabindex="-1"><svg viewBox="0 0 24 24"><path d="M4 12h14M12 5l7 7-7 7" stroke="#02101c" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
          </div>
        </div>
      </div>`;
  }

  function buildDemo(el, ctx) {
    const d = el.dataset;
    const tl = gsap.timeline();
    const typed = $(el, '.typed'), send = $(el, '.send'), user = $(el, '.msg-user'), ai = $(el, '.msg-ai');
    const think = $(el, '.thinking'), ans = $(el, '.ans'), detail = $(el, '.detail'), delta = $(el, '.delta');
    const label = $(el, '.src-label'), chips = $$(el, '.chip'), hint = $(el, '.hint');

    tl.from($(el, '.app'), { opacity: 0, y: 40, duration: 1, ease: 'power3.out' }, 0);
    tl.from([$(el, '.kicker'), $(el, '.demo-count')], { opacity: 0, duration: 0.6 }, 0.2);
    tl.add(typeOn(typed, d.q, 26), 1.0);
    tl.to(send, { scale: 0.86, duration: 0.12, yoyo: true, repeat: 1 }, '+=0.3');
    tl.to(typed, { opacity: 0, duration: 0.2 });
    tl.fromTo(user, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out' }, '<');
    tl.fromTo(ai, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, '+=0.2');
    tl.fromTo(think, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, '<');
    const t0 = tl.duration();
    $$(el, '.src').forEach((s, i) => {
      tl.to(s, { backgroundColor: 'rgba(59,232,255,.08)', color: '#e6f1ff', duration: 0.2 }, t0 + i * 0.28);
      tl.to($(s, '.dot'), { backgroundColor: '#3be8ff', boxShadow: '0 0 10px #3be8ff', duration: 0.2 }, t0 + i * 0.28);
    });
    tl.set(think, { display: 'none' }, t0 + 1.7);
    tl.add(streamWords(ans, d.a, 7), t0 + 1.75);
    if (delta) tl.fromTo(delta, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.5 }, '+=0.15');
    tl.fromTo(detail, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6 }, '+=0.15');
    tl.to(label, { opacity: 1, duration: 0.4 }, '+=0.2');
    const from = [
      { x: -900, y: 420, rotation: -38 },
      { x: 1100, y: -520, rotation: 32 },
    ];
    chips.forEach((c, i) => {
      tl.fromTo(c, Object.assign({ autoAlpha: 0, scale: 1.7 }, from[i % 2]),
        { autoAlpha: 1, x: 0, y: 0, rotation: 0, scale: 1, duration: 1.1, ease: 'expo.out' }, i ? '<0.35' : '+=0.05');
      tl.fromTo($(c, '.spark'), { opacity: 1, scale: 1 }, { opacity: 0, scale: 1.25, duration: 0.6, ease: 'power2.out' }, '>-0.2');
      c.addEventListener('click', (e) => { e.stopPropagation(); c.blur(); Preview.show(c.dataset.doc, c); });
    });
    tl.to(hint, { opacity: 1, duration: 0.5 }, '+=0.2');

    ctx.steps = [
      () => Preview.show(chips[0].dataset.doc, chips[0]),
      () => Preview.show(chips[1].dataset.doc, chips[1]),
      () => Preview.close(),
    ];
    return tl;
  }

  /* ---------- Scenes ---------- */
  const list = [
    /* 1 · Intro */
    {
      build(el) {
        BG.setNow({ dim: 0, particles: 0, grid: 0 });
        const tl = gsap.timeline();
        const look = document.querySelectorAll('#stage .backdrop, #stage .grid-overlay');
        tl.set(look, { opacity: 0 }, 0);
        tl.add(typeOn($(el, '.l1 .type'), 'Every project forgets.', 15), 0.6);
        tl.to($(el, '.l1'), { opacity: 0.35, duration: 0.8 }, '+=1.0');
        tl.add(typeOn($(el, '.l2 .type'), 'This one remembers.', 15), '+=0.2');
        tl.to($(el, '.intro-type'), { opacity: 0, y: -30, duration: 1, ease: 'power2.in' }, '+=1.4');
        tl.add(logoTimeline(el), '-=0.2');
        tl.to(BG.p, { dim: 1, particles: 0.7, grid: 0.45, duration: 3.5, ease: 'power2.inOut' }, '<0.4');
        tl.to(look, { opacity: 1, duration: 3, ease: 'power2.inOut' }, '<');
        tl.to($(el, '.logo-crisp'), { opacity: 1, duration: 1.2 }, '>-1.6');
        tl.to($(el, '.logo-dust'), { opacity: 0.16, duration: 1.4 }, '<');
        tl.add(typeOn($(el, '.logo-tag .type'), 'Project memory. Compliance intelligence.', 34, { caret: false }), '-=0.4');
        return tl;
      },
    },

    /* 2 · Chaos */
    {
      build(el) {
        const tl = gsap.timeline();
        const head = $(el, '.chaos-head'), tag = $(el, '.anchor-tag');
        CF.obstacles = [{ x: 100, y: 58, w: 720, h: 170 }];
        tl.add(CF.chaos(), 0);
        tl.fromTo(CF.layer, { opacity: 1 }, { opacity: 1, duration: 0.01 }, 0);
        tl.from(head, { opacity: 0, y: 20, duration: 1 }, 0.4);
        // The RFI that gets lost
        tl.to(CF.lost, { flag: 1, duration: 0.5 }, 2.4);
        tl.to(CF.reticle, { a: 1, duration: 0.5 }, 2.4);
        tl.to(CF.reticle, { l1: 0, l2: 1, duration: 0.3 }, 4.8);
        tl.to(CF.lost, { a: 0, s: 0.6, flag: 0, duration: 1.6, ease: 'power2.in' }, 5.0);
        tl.to(CF.reticle, { a: 0, duration: 0.6 }, 6.2);
        // Focus on the building, pour the slab
        tl.to(CF.layer, { opacity: 0.13, duration: 1.2 }, 6.8);
        tl.to(head, { opacity: 0, duration: 0.8 }, 6.8);
        tl.to(BG.p, { bx: 4.6, camZ: 17.5, camY: 3.6, spin: 0.3, duration: 2.2, ease: 'power2.inOut' }, 6.8);
        tl.fromTo(BG.p, { slab: 0 }, { slab: 1, duration: 2.4, ease: 'power1.inOut', immediateRender: false }, 8.4);
        tl.to(BG.p, { slabA: 1, duration: 0.4 }, 8.4);
        if (BG.ok) BG.anchor(tag, 'slab');
        else {
          gsap.set(tag, { x: 1500, y: 690 });
          tl.fromTo($(el, '.svgb-slab'), { opacity: 0 }, { opacity: 0.75, duration: 1.6 }, 8.4);
        }
        tl.to(tag, { opacity: 1, duration: 0.6 }, 10.6);
        tl.add(typeOn($(el, '.impact-head .type'), 'Concrete poured. No sleeves.', 18), 9.4);
        tl.to($(el, '.impact-cost'), { opacity: 1, duration: 0.5 }, 11.6);
        tl.add(countUp($(el, '.num.sar'), 120000, 2.2), 11.6);
        tl.add(countUp($(el, '.num.days'), 15, 2.2), 11.6);
        tl.to($(el, '.impact .tag-illustrative'), { opacity: 0.9, duration: 0.8 }, 12.6);
        return tl;
      },
    },

    /* 3 · Order */
    {
      build(el, ctx) {
        const tl = gsap.timeline();
        if (ctx.prev !== 1) CF.scatterNow();
        tl.to(CF.layer, { opacity: 1, duration: 0.6 }, 0);
        tl.add(CF.order(), 0);
        tl.from($(el, '.order-head'), { opacity: 0, y: 20, duration: 0.9 }, 0.5);
        tl.from($(el, '.core'), { scale: 0.3, opacity: 0, duration: 1.4, ease: 'expo.out' }, 0.9);
        tl.from($$(el, '.group-labels span'), { opacity: 0, y: 10, stagger: 0.06, duration: 0.5 }, 1.3);
        tl.from($$(el, '.links path'), { opacity: 0, duration: 0.8, stagger: 0.08 }, 1.8);
        tl.from($$(el, '.core-pills > *'), { opacity: 0, y: 16, stagger: 0.15, duration: 0.6 }, 2.1);
        tl.from($(el, '.alert-row'), { opacity: 0, y: 24, duration: 0.8 }, 2.9);
        return tl;
      },
    },

    /* 4 · Demo A */ { build: buildDemo },
    /* 5 · Demo B */ { build: buildDemo },

    /* 6 · Mutabiq */
    {
      build(el) {
        const tl = gsap.timeline();
        const paper = $(el, '.sub-paper'), panel = $(el, '.check-panel'), laser = $(el, '.laser');
        tl.from($(el, '.kicker'), { opacity: 0, duration: 0.6 }, 0);
        tl.from(paper, { opacity: 0, x: -40, duration: 0.9, ease: 'power3.out' }, 0.1);
        tl.from(panel, { opacity: 0, x: 40, duration: 0.9, ease: 'power3.out' }, 0.3);
        const T0 = 1.2, TS = 3.4, PH = 860;
        tl.set(laser, { opacity: 1, y: 0 }, T0);
        tl.to(laser, { y: PH, duration: TS, ease: 'none' }, T0);
        tl.to(laser, { opacity: 0, duration: 0.3 }, T0 + TS - 0.3);
        $$(el, '.ds-row').forEach((row) => {
          const t = T0 + TS * ((row.offsetTop + row.offsetHeight / 2) / PH);
          const keep = row.dataset.r === '2' || row.dataset.r === '3';
          if (row.dataset.r === '2') row.classList.add('good');
          tl.to($(row, '.hl'), { opacity: 1, duration: 0.2 }, t);
          if (!keep) tl.to($(row, '.hl'), { opacity: 0, duration: 0.6 }, t + 0.5);
        });
        $$(el, '.check').forEach((c, i) => {
          const t = T0 + 0.9 + i * 0.75;
          tl.fromTo(c, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.5, ease: 'power3.out' }, t);
          tl.from($(c, '.ck-pill'), { opacity: 0, scale: 0.6, duration: 0.4, ease: 'back.out(2)' }, t + 0.45);
          if (c.dataset.ok === '0') tl.to(c, { boxShadow: '0 0 34px rgba(255,77,94,.35)', duration: 0.6 }, t + 0.5);
        });
        tl.to($(el, '.cp-status .s1'), { opacity: 0, duration: 0.3 }, T0 + TS);
        tl.to($(el, '.cp-status .s2'), { opacity: 1, duration: 0.3 }, T0 + TS + 0.2);
        tl.to($(el, '.clause'), { opacity: 1, duration: 0.6 }, T0 + TS + 0.3);
        tl.to($(el, '.cl.g'), { backgroundSize: '100% 100%', duration: 0.9, ease: 'power2.inOut' }, T0 + TS + 0.9);
        tl.to($(el, '.cl.r'), { backgroundSize: '100% 100%', duration: 1.1, ease: 'power2.inOut' }, T0 + TS + 1.9);
        tl.fromTo($(el, '.draft'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6 }, T0 + TS + 3.0);
        tl.to($(el, '.verdict'), { opacity: 1, duration: 0.6 }, T0 + TS + 3.5);
        return tl;
      },
    },

    /* 7 · Value */
    {
      build(el) {
        const tl = gsap.timeline();
        tl.from($(el, '.head-block'), { opacity: 0, y: 20, duration: 0.9 }, 0);
        tl.from($$(el, '.vcard'), { opacity: 0, y: 40, stagger: 0.3, duration: 0.9, ease: 'power3.out' }, 0.4);
        tl.from($$(el, '.vop'), { opacity: 0, scale: 0.5, stagger: 0.3, duration: 0.5 }, 0.9);
        $$(el, '.v-num .num').forEach((n, i) => {
          tl.add(countUp(n, parseFloat(n.dataset.to), i === 2 ? 1.8 : 2.2, parseInt(n.dataset.dec || '0', 10)), 1.0 + i * 0.7);
        });
        tl.from($(el, '.tag-illustrative'), { opacity: 0, duration: 0.8 }, 3.4);
        return tl;
      },
    },

    /* 8 · Proof */
    {
      build(el) {
        const tl = gsap.timeline();
        tl.from($(el, '.head-block'), { opacity: 0, y: 20, duration: 0.9 }, 0);
        tl.from($$(el, '.proof-col'), { opacity: 0, y: 40, stagger: 0.25, duration: 0.9, ease: 'power3.out' }, 0.3);
        tl.from($$(el, '.pf-body > *'), { opacity: 0, y: 10, stagger: 0.12, duration: 0.4 }, 1.0);
        const C = 2 * Math.PI * 68;
        $$(el, '.m-arc').forEach((a, i) => {
          a.style.strokeDasharray = C;
          tl.fromTo(a, { strokeDashoffset: C }, { strokeDashoffset: C * (1 - parseFloat(a.dataset.v) / 100), duration: 2, ease: 'power3.out' }, 1.2 + i * 0.4);
        });
        $$(el, '.m-val .num').forEach((n, i) => tl.add(countUp(n, parseFloat(n.dataset.to), 2, 1), 1.2 + i * 0.4));
        tl.from($$(el, '.founder'), { opacity: 0, x: 30, stagger: 0.2, duration: 0.7 }, 1.6);
        return tl;
      },
    },

    /* 9 · Roadmap */
    {
      build(el) {
        const tl = gsap.timeline();
        tl.from($(el, '.head-block'), { opacity: 0, y: 20, duration: 0.9 }, 0);
        tl.fromTo($(el, '.tl-fill'), { scaleX: 0 }, { scaleX: 1, duration: 3.2, ease: 'power2.inOut' }, 0.6);
        $$(el, '.tl-node').forEach((n, i) => {
          const t = 0.6 + i * 0.72;
          tl.from($(n, '.tl-dot'), { scale: 0, duration: 0.6, ease: 'back.out(2.4)' }, t);
          tl.from([$(n, '.tl-phase'), $(n, '.tl-name'), $(n, '.tl-desc')], { opacity: 0, y: 14, stagger: 0.08, duration: 0.6 }, t + 0.1);
        });
        tl.to($(el, '.tl-pulse'), { opacity: 1, duration: 0.6 }, 3.8);
        return tl;
      },
    },

    /* 10 · Ask */
    {
      build(el) {
        const tl = gsap.timeline();
        tl.add(typeOn($(el, '.ask-l1 .type'), '90 days. One project.', 14), 0.8);
        tl.fromTo($(el, '.ask-l2'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out' }, '+=0.5');
        tl.fromTo($$(el, '.ask'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, stagger: 0.45, duration: 1, ease: 'power3.out' }, '+=0.9');
        tl.to($(el, '.ask-logo'), { opacity: 1, duration: 1 }, '+=0.4');
        return tl;
      },
    },
  ];

  CW.Scenes = {
    list,
    prepare() {
      document.querySelectorAll('.scene.demo').forEach(renderDemo);
      Preview.init();
    },
  };
})();
