/* Compliware pitch: presentation engine (navigation, keys, notes, modes) */
(function () {
  const CW = window.CW;
  const { BG, CF, NOTES, Scenes } = CW;
  const stage = document.getElementById('stage');
  const sceneEls = Array.from(document.querySelectorAll('.scene'));
  const N = sceneEls.length;
  const $id = (id) => document.getElementById(id);

  /* ---------- Settings ---------- */
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
    return null;
  }
  function readLite() {
    const q = new URLSearchParams(location.search);
    if (q.has('lite')) return q.get('lite') !== '0';
    const v = store('cw-lite');
    if (v !== null) return v === '1';
    return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  const lite = readLite();
  document.body.classList.toggle('lite', lite);

  // Backdrop + CSS grid brightness per scene: [backdrop, grid]
  const LOOK = [[0, 0], [1, 1], [1, 1], [1, 0.7], [1, 0.7], [1, 0.8], [1, 1], [1, 0.8], [1, 1], [0.45, 0.25]];

  const App = (CW.App = {
    i: 0, tl: null, armed: true, paused: false, steps: [], stepIdx: 0, scale: 1,
    startedAt: null, pw: null, templates: [],
  });

  /* ---------- Layout ---------- */
  function fit() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    App.scale = s;
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
    BG.setScale(s);
  }

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg, ms) {
    const t = $id('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), ms || 2200);
  }

  /* ---------- Pause ---------- */
  function setPaused(v) {
    App.paused = v;
    if (v) gsap.globalTimeline.pause(); else gsap.globalTimeline.resume();
    document.body.classList.toggle('paused', v);
  }

  /* ---------- Navigation ---------- */
  function finishTweensOf(target) { gsap.getTweensOf(target).forEach((t) => t.progress(1)); }

  function completeNow() {
    finishTweensOf(BG.p);
    finishTweensOf(sceneEls[App.i]);
    if (App.tl) App.tl.progress(1);
  }

  function go(n, opts) {
    opts = opts || {};
    n = Math.max(0, Math.min(N - 1, n));
    setPaused(false);
    hideArmed();
    if (App.startedAt === null) App.startedAt = Date.now();
    const prev = App.i, same = prev === n && !App.wasArmed;
    App.wasArmed = false;
    const prevEl = sceneEls[prev], el = sceneEls[n];

    CW.Preview.close(true);
    if (App.tl) { App.tl.kill(); App.tl = null; }
    BG.clearAnchors();

    if (!same) {
      prevEl.classList.remove('active');
      gsap.killTweensOf(prevEl);
      if (opts.instant || lite) gsap.set(prevEl, { autoAlpha: 0 });
      else {
        gsap.to(prevEl, {
          autoAlpha: 0, scale: 1.03, filter: 'blur(6px)', duration: 0.55, ease: 'power2.in',
          onComplete: () => gsap.set(prevEl, { clearProps: 'transform,filter' }),
        });
        gsap.fromTo('#wipe', { x: -20, opacity: 1 }, { x: 1940, duration: 1.0, ease: 'power2.inOut', onComplete: () => gsap.set('#wipe', { opacity: 0 }) });
      }
    }

    gsap.killTweensOf(el);
    el.innerHTML = App.templates[n];
    el.classList.add('active');
    const delay = same || opts.instant ? 0 : 0.35;
    if (same || opts.instant) gsap.set(el, { autoAlpha: 1, clearProps: 'transform,filter' });
    else if (lite) gsap.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, delay });
    else gsap.fromTo(el, { autoAlpha: 0, scale: 0.985, filter: 'blur(4px)' }, { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 0.8, delay, ease: 'power2.out', clearProps: 'transform,filter' });

    const look = LOOK[n];
    gsap.to('#stage .backdrop', { opacity: look[0], duration: opts.instant ? 0 : 1.2 });
    gsap.to('#stage .grid-overlay', { opacity: look[1], duration: opts.instant ? 0 : 1.2 });
    BG.mode(n, opts.instant ? 0 : 1.8);
    if (n !== 1 && n !== 2) CF.hide(opts.instant);

    const ctx = { prev: same ? -1 : prev, steps: [] };
    App.i = n;
    App.tl = Scenes.list[n].build(el, ctx);
    if (delay) App.tl.delay(delay);
    App.steps = ctx.steps || [];
    App.stepIdx = 0;
    if (opts.complete) completeNow();

    try { history.replaceState(null, '', '#' + (n + 1)); } catch (e) { /* file:// in some browsers */ }
    updateProgress();
    updateNotes();
  }

  function next() {
    if ($id('blackout').classList.contains('on')) { $id('blackout').classList.remove('on'); return; }
    if ($id('help').classList.contains('on')) { $id('help').classList.remove('on'); return; }
    if (App.paused) { setPaused(false); return; }
    if (App.armed) { App.armed = false; go(0, { instant: true }); return; }
    if (App.tl && App.tl.progress() < 1) { completeNow(); return; }
    if (App.stepIdx < App.steps.length) { App.steps[App.stepIdx++](); updateNotes(); return; }
    if (App.i < N - 1) go(App.i + 1);
  }

  function prev() {
    if ($id('blackout').classList.contains('on')) { $id('blackout').classList.remove('on'); return; }
    if (CW.Preview.open) { CW.Preview.close(); App.stepIdx = App.steps.length; return; }
    if (App.armed) return;
    if (App.i > 0) go(App.i - 1, { complete: true });
  }

  /* ---------- Armed (pre-show black screen) ---------- */
  function armed() {
    App.armed = true;
    App.wasArmed = true;
    App.i = 0;
    sceneEls.forEach((e) => gsap.set(e, { autoAlpha: 0 }));
    gsap.set('#stage .backdrop, #stage .grid-overlay', { opacity: 0 });
    BG.mode(0, 0);
    $id('armed-hint').style.display = '';
    updateProgress();
    updateNotes();
  }
  function hideArmed() { $id('armed-hint').style.display = 'none'; }

  /* ---------- Progress, notes, presenter window ---------- */
  function updateProgress() {
    document.body.classList.toggle('intro', App.armed || App.i === 0);
    const p = $id('progress');
    if (!p.children.length) for (let k = 0; k < N; k++) p.appendChild(document.createElement('i'));
    Array.from(p.children).forEach((c, k) => {
      c.className = App.armed ? '' : k < App.i ? 'done' : k === App.i ? 'cur' : '';
    });
  }

  function elapsed() {
    if (App.startedAt === null) return '00:00';
    const s = Math.floor((Date.now() - App.startedAt) / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function noteHTML() {
    const n = NOTES[App.i];
    const nx = NOTES[App.i + 1];
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const step = App.steps.length ? ` · step ${App.stepIdx}/${App.steps.length}` : '';
    return {
      title: (App.armed ? 'Ready · ' : '') + n.title + step,
      list: n.notes.map((x) => `<li>${esc(x)}</li>`).join(''),
      next: nx ? 'Next: ' + nx.title : 'Last scene',
    };
  }

  function updateNotes() {
    const h = noteHTML();
    const o = $id('notes-overlay');
    o.innerHTML = `<h4>${h.title}<span class="tm">${elapsed()}</span></h4><ul>${h.list}</ul><div class="nx">${h.next}</div>`;
    const w = App.pw;
    if (w && !w.closed) {
      const d = w.document;
      d.getElementById('t').textContent = h.title;
      d.getElementById('l').innerHTML = h.list;
      d.getElementById('n').textContent = h.next;
      d.getElementById('c').textContent = `${App.i + 1} / ${N}` + (App.paused ? ' · paused' : '');
    }
  }

  function tickTimer() {
    const t = elapsed();
    const tm = document.querySelector('#notes-overlay .tm');
    if (tm) tm.textContent = t;
    if (App.pw && !App.pw.closed) {
      const e = App.pw.document.getElementById('e');
      if (e) e.textContent = t;
    }
  }

  function openPresenter() {
    const w = window.open('', 'compliware-presenter', 'width=1000,height=720');
    if (!w) { toast('Pop-up blocked: allow pop-ups to open the presenter window', 4000); return; }
    App.pw = w;
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Compliware · Presenter</title>
<style>
body{margin:0;background:#050b15;color:#dce8f6;font:18px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;padding:28px 34px}
header{display:flex;align-items:baseline;gap:20px;border-bottom:1px solid #1d3048;padding-bottom:14px;margin-bottom:18px}
#t{font-size:26px;font-weight:600;color:#3be8ff;flex:1}
#e{font:600 34px ui-monospace,monospace;color:#ffb547}
#c{font:14px ui-monospace,monospace;color:#7d93ad}
ul{padding-left:22px;margin:0}li{margin-bottom:12px;font-size:22px}
#n{margin-top:22px;color:#7d93ad;font-size:17px}
footer{position:fixed;left:34px;right:34px;bottom:20px;font:13px ui-monospace,monospace;color:#4b6380;display:flex;gap:16px}
button{background:#0d1c30;color:#cfe0f2;border:1px solid #23405f;border-radius:8px;padding:6px 12px;font:13px ui-monospace,monospace;cursor:pointer}
</style></head><body>
<header><div id="t"></div><div id="c"></div><div id="e">00:00</div></header>
<ul id="l"></ul><div id="n"></div>
<footer><span>→ next · ← back · K pause · R replay · B black</span><button id="rs">Reset timer</button></footer>
</body></html>`);
    w.document.close();
    w.document.addEventListener('keydown', onKey);
    w.document.getElementById('rs').addEventListener('click', () => { App.startedAt = Date.now(); tickTimer(); });
    updateNotes();
  }

  /* ---------- Fullscreen / lite ---------- */
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => toast('Fullscreen not available'));
  }

  function toggleLite() {
    const v = lite ? '0' : '1';
    store('cw-lite', v);
    const u = new URL(location.href);
    u.searchParams.set('lite', v);
    u.hash = App.armed ? '' : '#' + (App.i + 1);
    toast(v === '1' ? 'Lite mode on: reloading…' : 'Full mode on: reloading…');
    setTimeout(() => location.replace(u.toString()), 350);
  }

  /* ---------- Keys ---------- */
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    const nav = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'];
    if (nav.includes(k) || k === 'F5') e.preventDefault();
    if (e.repeat && nav.includes(k)) return;
    switch (k) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter': next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': prev(); break;
      case 'Home': go(0); break;
      case 'End': go(N - 1, { complete: true }); break;
      case 'f': case 'F': case 'F5': toggleFullscreen(); break;
      case 'k': case 'K':
        if (App.armed) break;
        setPaused(!App.paused); toast(App.paused ? 'Paused · K to resume' : 'Resumed', 1200); updateNotes(); break;
      case 'r': case 'R': if (!App.armed) { go(App.i); toast('Replay', 900); } break;
      case 'n': case 'N': $id('notes-overlay').classList.toggle('on'); updateNotes(); break;
      case 'p': case 'P': openPresenter(); break;
      case 'l': case 'L': toggleLite(); break;
      case 'h': case 'H': case '?': $id('help').classList.toggle('on'); break;
      case 'b': case 'B': case '.': $id('blackout').classList.toggle('on'); break;
      case 'Escape':
        if (CW.Preview.open) { CW.Preview.close(); App.stepIdx = App.steps.length; }
        $id('help').classList.remove('on');
        break;
      default:
        if (/^[0-9]$/.test(k)) { const d = k === '0' ? 9 : parseInt(k, 10) - 1; App.armed = false; go(d); }
    }
  }

  /* ---------- Cursor auto-hide ---------- */
  let cursorTimer;
  function wakeCursor() {
    document.body.classList.remove('hide-cursor');
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => document.body.classList.add('hide-cursor'), 2500);
  }

  /* ---------- Frame-rate probe → suggest lite mode ---------- */
  function probeFps() {
    if (lite) return;
    let frames = 0, start = 0;
    function f(now) {
      if (!start) start = now;
      frames++;
      if (now - start < 3000) return requestAnimationFrame(f);
      const fps = (frames * 1000) / (now - start);
      if (fps < 38) toast(`Low frame rate (${Math.round(fps)} fps): press L for lite mode`, 7000);
    }
    setTimeout(() => requestAnimationFrame(f), 1500);
  }

  /* ---------- Boot ---------- */
  async function boot() {
    const fontLoads = [
      '500 92px "Space Grotesk"', '600 100px "Space Grotesk"', '400 20px "IBM Plex Sans"',
      '500 20px "IBM Plex Mono"', '500 22px "IBM Plex Sans Arabic"',
    ].map((f) => document.fonts.load(f, f.includes('Arabic') ? 'ذاكرة' : 'Ag'));
    await Promise.race([Promise.all(fontLoads).catch(() => {}), new Promise((r) => setTimeout(r, 2500))]);

    Scenes.prepare();
    App.templates = sceneEls.map((e) => e.innerHTML);

    const ok = BG.init($id('bg3d'), { lite, isPaused: () => App.paused, scale: 1 });
    if (!ok) document.body.classList.add('no-webgl');
    CF.init($id('cardfield'), { lite, isPaused: () => App.paused });
    $id('help').querySelector('.help-mode').textContent =
      `Mode: ${lite ? 'LITE (reduced animation)' : 'FULL'} · 3D background: ${ok ? 'WebGL on' : 'off (fallback)'}`;

    fit();
    window.addEventListener('resize', fit);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousemove', wakeCursor);
    $id('blackout').addEventListener('click', () => $id('blackout').classList.remove('on'));
    $id('help').addEventListener('click', (e) => { if (e.target.id === 'help') $id('help').classList.remove('on'); });
    setInterval(tickTimer, 1000);

    const h = parseInt(location.hash.slice(1), 10);
    if (h >= 2 && h <= N) { App.armed = false; App.wasArmed = true; go(h - 1, { instant: true }); }
    else armed();
    wakeCursor();
    probeFps();
    document.documentElement.dataset.ready = '1';
  }

  boot();
})();
