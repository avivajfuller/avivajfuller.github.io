(() => {
  "use strict";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- Galton board ---------------- */
  const canvas = document.getElementById("galton");
  const counterEl = document.getElementById("n-count");
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext("2d");
    const W = 520, H = 420;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const ROWS = 12;
    const BINS = ROWS + 1;
    const PAD = 22;
    const bw = (W - PAD * 2) / BINS;     // bin width == horizontal peg spacing
    const cx = W / 2;
    const top = 34;
    const rowH = 15;
    const binTop = top + ROWS * rowH + 18;
    const binBottom = H - 16;
    const binH = binBottom - binTop;
    const mean = ROWS / 2;
    const sd = Math.sqrt(ROWS) / 2;

    const counts = new Array(BINS).fill(0);
    let n = 0;
    let balls = [];
    let colors = {};

    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      const v = (name) => cs.getPropertyValue(name).trim();
      colors = { accent: v("--accent"), blue: v("--blue"), ink3: v("--ink-3"), line: v("--line"), ink: v("--ink") };
    }
    readColors();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { readColors(); if (reduceMotion) draw(); });

    const pegX = (r, k) => cx + (k - r / 2) * bw;
    const pegY = (r) => top + r * rowH;

    function spawn() {
      const path = [0];
      for (let r = 0; r < ROWS; r++) path.push(path[r] + (Math.random() < 0.5 ? 0 : 1));
      balls.push({ path, p: -0.6, speed: 7 + Math.random() * 2 });
    }

    function ballPos(b) {
      const p = b.p;
      if (p < 0) return { x: cx, y: top - 14 + (p + 0.6) / 0.6 * 14 - 6 };
      if (p >= ROWS) {
        const k = b.path[ROWS];
        const fall = (p - ROWS) * 60;
        return { x: pegX(ROWS, k), y: pegY(ROWS) - 6 + fall };
      }
      const r = Math.floor(p), f = p - r;
      const x0 = pegX(r, b.path[r]), x1 = pegX(r + 1, b.path[r + 1]);
      const x = x0 + (x1 - x0) * f;
      const y = pegY(r) - 6 + rowH * f - Math.sin(f * Math.PI) * 5; // small hop over each peg
      return { x, y };
    }

    function scaleMax() {
      const expectedPeak = n / (sd * Math.sqrt(2 * Math.PI));
      return Math.max(8, Math.max(...counts), expectedPeak) * 1.15;
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // pegs
      ctx.fillStyle = colors.ink3;
      ctx.globalAlpha = 0.55;
      for (let r = 0; r < ROWS; r++) {
        for (let k = 0; k <= r; k++) {
          ctx.beginPath();
          ctx.arc(pegX(r, k), pegY(r), 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // baseline + bin separators
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, binBottom + 0.5);
      ctx.lineTo(W - PAD, binBottom + 0.5);
      ctx.stroke();

      // bars
      const sm = scaleMax();
      ctx.fillStyle = colors.accent;
      ctx.globalAlpha = 0.82;
      for (let k = 0; k < BINS; k++) {
        const h = (counts[k] / sm) * binH;
        const x = PAD + k * bw + 2;
        roundRectTop(x, binBottom - h, bw - 4, h, 3);
      }
      ctx.globalAlpha = 1;

      // expected curve (normal approximation to Binomial(12, 1/2))
      if (n > 0) {
        ctx.strokeStyle = colors.blue;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
          const kk = -0.5 + (BINS) * (i / 120);
          const z = (kk - mean) / sd;
          const e = n * Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
          const x = PAD + (kk + 0.5) * bw;
          const y = binBottom - (e / sm) * binH;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // balls
      ctx.fillStyle = colors.blue;
      for (const b of balls) {
        const { x, y } = ballPos(b);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // axis labels
      ctx.fillStyle = colors.ink3;
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("μ", PAD + (mean + 0.5) * bw, binBottom + 12);
    }

    function roundRectTop(x, y, w, h, r) {
      if (h <= 0) return;
      r = Math.min(r, h, w / 2);
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fill();
    }

    if (reduceMotion) {
      for (let i = 0; i < 600; i++) {
        let k = 0;
        for (let r = 0; r < ROWS; r++) k += Math.random() < 0.5 ? 0 : 1;
        counts[k]++;
      }
      n = 600;
      counterEl.textContent = n.toLocaleString();
      draw();
    } else {
      let last = performance.now();
      let spawnAcc = 0;
      let visible = true;
      const io = new IntersectionObserver(([e]) => {
        const wasVisible = visible;
        visible = e.isIntersecting;
        if (visible && !wasVisible) { last = performance.now(); requestAnimationFrame(tick); }
      });
      io.observe(canvas);

      function tick(now) {
        if (!visible) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;

        // spawn faster as time goes on so the shape emerges quickly
        const rate = n < 30 ? 9 : n < 200 ? 18 : 28;
        spawnAcc += dt * rate;
        while (spawnAcc >= 1) { spawn(); spawnAcc -= 1; }

        for (const b of balls) b.p += dt * b.speed;
        const landed = [];
        balls = balls.filter((b) => {
          const done = ballPos(b).y >= binBottom - 4;
          if (done) landed.push(b);
          return !done;
        });
        for (const b of landed) { counts[b.path[ROWS]]++; n++; }
        if (landed.length) counterEl.textContent = n.toLocaleString();

        // start over after a while so the story repeats
        if (n >= 2500) { counts.fill(0); n = 0; balls = []; counterEl.textContent = "0"; }

        draw();
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
  }

  /* ---------------- Nav state ---------------- */
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const links = [...document.querySelectorAll(".nav-links a")];
  const sections = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => spy.observe(s));

  /* ---------------- Reveal on scroll ---------------- */
  if (!reduceMotion && "IntersectionObserver" in window) {
    const targets = document.querySelectorAll(".section-head, .timeline li, .r-feature, .r-item, .t-item, .honors li, .stats");
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); ro.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    targets.forEach((t, i) => { t.classList.add("reveal"); t.style.transitionDelay = (i % 6) * 50 + "ms"; ro.observe(t); });
  }

  const yr = document.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();
})();
