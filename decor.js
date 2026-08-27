/* Arka plandaki kuru cipso (baby's breath) dalları koda gömülü olarak üretilir. */
(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  // Deterministik rastgelelik: her açılışta aynı dizilim.
  function makeRng(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function quadAt(a, b, c, t) {
    const u = 1 - t;
    return u * u * a + 2 * u * t * b + t * t * c;
  }

  function growBranch(rng, state, x, y, angle, length, depth) {
    const bend = (rng() - 0.5) * 0.55;
    const ex = x + Math.cos(angle) * length;
    const ey = y + Math.sin(angle) * length;
    const mx = x + Math.cos(angle) * length * 0.5 - Math.sin(angle) * length * bend;
    const my = y + Math.sin(angle) * length * 0.5 + Math.cos(angle) * length * bend;

    state.stems.push({
      d: `M${x.toFixed(1)} ${y.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`,
      w: 0.35 + depth * 0.42,
    });

    if (depth <= 0) {
      state.heads.push({ x: ex, y: ey, r: 3.4 + rng() * 2.6 });
      return;
    }

    const count = 2 + Math.floor(rng() * 2.4);
    for (let i = 0; i < count; i++) {
      const t = 0.32 + (0.62 * i) / Math.max(count - 1, 1) + rng() * 0.08;
      const px = quadAt(x, mx, ex, t);
      const py = quadAt(y, my, ey, t);
      const side = i % 2 === 0 ? 1 : -1;
      const spread = side * (0.3 + rng() * 0.5);
      growBranch(rng, state, px, py, angle + spread, length * (0.42 + rng() * 0.24), depth - 1);
    }

    state.heads.push({ x: ex, y: ey, r: 2.8 + rng() * 2.2 });
  }

  function buildSprig(rng, roots) {
    const state = { stems: [], heads: [] };
    roots.forEach((root) => {
      growBranch(rng, state, root.x, root.y, root.a, root.len, root.depth == null ? 3 : root.depth);
    });
    return state;
  }

  function florets(rng, heads) {
    const petals = [];
    heads.forEach((head) => {
      const n = 6 + Math.floor(rng() * 6);
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * head.r;
        petals.push({
          x: head.x + Math.cos(a) * d,
          y: head.y + Math.sin(a) * d,
          r: 0.85 + rng() * 1.35,
          o: 0.45 + rng() * 0.55,
        });
      }
      petals.push({ x: head.x, y: head.y, r: 1.1 + rng() * 0.8, o: 0.95 });
    });
    return petals;
  }

  function render(svg, sprig, petals) {
    const glowId = `bloom-glow-${svg.dataset.sprig}`;

    const defs = document.createElementNS(SVG_NS, "defs");
    defs.innerHTML =
      `<filter id="${glowId}" x="-40%" y="-40%" width="180%" height="180%">` +
      `<feGaussianBlur stdDeviation="2.4" result="b" />` +
      `<feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>` +
      `</filter>`;
    svg.appendChild(defs);

    const stems = document.createElementNS(SVG_NS, "g");
    stems.setAttribute("class", "sprig-stems");
    sprig.stems.forEach((stem) => {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", stem.d);
      path.setAttribute("stroke-width", stem.w.toFixed(2));
      stems.appendChild(path);
    });
    svg.appendChild(stems);

    const blooms = document.createElementNS(SVG_NS, "g");
    blooms.setAttribute("class", "sprig-blooms");
    blooms.setAttribute("filter", `url(#${glowId})`);
    petals.forEach((p) => {
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", p.x.toFixed(1));
      c.setAttribute("cy", p.y.toFixed(1));
      c.setAttribute("r", p.r.toFixed(2));
      c.setAttribute("opacity", p.o.toFixed(2));
      blooms.appendChild(c);
    });
    svg.appendChild(blooms);
  }

  // Her köşe için kök dallar: viewBox koordinatlarında.
  const LAYOUTS = {
    // Sol üstteki polaroidin üzerine taşan tutam.
    topleft: {
      seed: 20240517,
      roots: [
        { x: 8, y: 292, a: -1.15, len: 118, depth: 3 },
        { x: 26, y: 296, a: -1.0, len: 96, depth: 3 },
        { x: 46, y: 300, a: -0.86, len: 132, depth: 3 },
        { x: 4, y: 268, a: -0.62, len: 104, depth: 3 },
        { x: 62, y: 300, a: -0.55, len: 118, depth: 3 },
      ],
    },
    // Sol kenardan yukarı uzanan uzun dallar.
    left: {
      seed: 7781234,
      roots: [
        { x: 10, y: 478, a: -1.32, len: 176, depth: 3 },
        { x: 30, y: 480, a: -1.12, len: 148, depth: 3 },
        { x: 52, y: 480, a: -0.95, len: 168, depth: 3 },
        { x: 6, y: 420, a: -0.72, len: 132, depth: 3 },
        { x: 74, y: 478, a: -0.78, len: 142, depth: 3 },
        { x: 2, y: 330, a: -0.5, len: 96, depth: 2 },
      ],
    },
    // Sağ alt köşedeki geniş tutam.
    right: {
      seed: 33110099,
      roots: [
        { x: 332, y: 296, a: -2.05, len: 168, depth: 3 },
        { x: 336, y: 250, a: -2.35, len: 148, depth: 3 },
        { x: 320, y: 298, a: -1.78, len: 152, depth: 3 },
        { x: 296, y: 300, a: -1.55, len: 140, depth: 3 },
        { x: 338, y: 190, a: -2.6, len: 122, depth: 3 },
        { x: 262, y: 298, a: -1.3, len: 118, depth: 2 },
      ],
    },
  };

  document.querySelectorAll(".floral[data-sprig]").forEach((svg) => {
    const layout = LAYOUTS[svg.dataset.sprig];
    if (!layout) return;
    const rng = makeRng(layout.seed);
    const sprig = buildSprig(rng, layout.roots);
    render(svg, sprig, florets(rng, sprig.heads));
  });
})();
