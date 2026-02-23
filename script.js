/* ══════════════════════════════════════════════════════════════
   SCRIPT.JS — Screen 1 (Stamp + Envelope) + Screen 2 (Invitation)
   ══════════════════════════════════════════════════════════════ */

// ── Screen 1: Stamp canvas refs ───────────────────────────────
const stampCanvas = document.getElementById('stamp-canvas');
const ctx         = stampCanvas.getContext('2d');
const W = 260, H = 260, CX = W / 2, CY = H / 2;

const fallCanvas = document.getElementById('fall-canvas');
const fctx       = fallCanvas.getContext('2d');

function resizeFallCanvas() {
  fallCanvas.width  = window.innerWidth;
  fallCanvas.height = window.innerHeight;
}
resizeFallCanvas();
window.addEventListener('resize', resizeFallCanvas);

// ── Stamp state ────────────────────────────────────────────────
let clickCount = 0, MAX_CLICKS = 6;
let crackPaths = [];
let fragments  = [];
let falling    = false;
let animFrame;
let shaking = false, shakeFrames = 0;
let done    = false;

const RX = 105, RY = 118;
const WOBBLE = { freq: 10, phase: 0.4, amp: 0.05 };

// ── Stamp path ────────────────────────────────────────────────
function stampPath(ctx2d, cx, cy, rx, ry, wobble, segments) {
  ctx2d.beginPath();
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const r = 1 + Math.sin(angle * wobble.freq + wobble.phase) * wobble.amp;
    const x = cx + rx * r * Math.cos(angle);
    const y = cy + ry * r * Math.sin(angle);
    if (i === 0) ctx2d.moveTo(x, y);
    else         ctx2d.lineTo(x, y);
  }
  ctx2d.closePath();
}

// ── Draw stamp ────────────────────────────────────────────────
function drawStamp(offCtx, cx, cy, crackLines, shakeX = 0, shakeY = 0) {
  offCtx.save();
  offCtx.translate(shakeX, shakeY);
  offCtx.shadowColor = 'rgba(0,0,0,0.6)';
  offCtx.shadowBlur  = 28;
  offCtx.shadowOffsetY = 8;

  const grad = offCtx.createRadialGradient(cx - 20, cy - 25, 10, cx, cy, RX * 1.1);
  grad.addColorStop(0,   '#d03a2b');
  grad.addColorStop(0.4, '#a5281b');
  grad.addColorStop(0.7, '#7c1f18');
  grad.addColorStop(1,   '#4b100e');

  stampPath(offCtx, cx, cy, RX, RY, WOBBLE, 180);
  offCtx.fillStyle = grad;
  offCtx.fill();
  offCtx.shadowBlur = 0; offCtx.shadowOffsetY = 0;

  offCtx.save();
  stampPath(offCtx, cx, cy, RX * 0.84, RY * 0.84, { freq: 11, phase: 0.4, amp: 0.03 }, 180);
  offCtx.strokeStyle = 'rgba(255,200,160,0.22)';
  offCtx.lineWidth   = 2.5;
  offCtx.stroke();
  offCtx.restore();

  offCtx.save();
  offCtx.font = 'bold 62px Georgia, serif';
  offCtx.textAlign = 'center'; offCtx.textBaseline = 'middle';
  offCtx.shadowColor = 'rgba(0,0,0,0.5)'; offCtx.shadowBlur = 6; offCtx.shadowOffsetY = 3;
  offCtx.fillStyle = 'rgba(255,220,190,0.55)';
  offCtx.fillText('★', cx, cy + 2);
  offCtx.restore();

  if (crackLines.length) {
    offCtx.save();
    stampPath(offCtx, cx, cy, RX, RY, WOBBLE, 180);
    offCtx.clip();
    crackLines.forEach(crack => {
      offCtx.beginPath();
      offCtx.strokeStyle = 'rgba(0,0,0,0.9)';
      offCtx.lineWidth = crack.width || 1.5;
      offCtx.lineJoin = 'round'; offCtx.lineCap = 'round';
      offCtx.moveTo(crack.pts[0].x, crack.pts[0].y);
      for (let i = 1; i < crack.pts.length; i++) offCtx.lineTo(crack.pts[i].x, crack.pts[i].y);
      offCtx.stroke();
      offCtx.beginPath();
      offCtx.strokeStyle = 'rgba(200,100,80,0.4)';
      offCtx.lineWidth = 0.7;
      offCtx.moveTo(crack.pts[0].x + 0.5, crack.pts[0].y + 0.5);
      for (let i = 1; i < crack.pts.length; i++) offCtx.lineTo(crack.pts[i].x + 0.5, crack.pts[i].y + 0.5);
      offCtx.stroke();
    });
    offCtx.restore();
  }
  offCtx.restore();
}

// ── Crack generation ──────────────────────────────────────────
function generateCrack(startX, startY, angle, length, steps) {
  const pts = [{ x: startX, y: startY }];
  let curAngle = angle, curX = startX, curY = startY;
  const stepLen = length / steps;
  for (let i = 0; i < steps; i++) {
    curAngle += (Math.random() - 0.5) * 0.9;
    if (Math.random() < 0.18) curAngle += (Math.random() - 0.5) * 1.4;
    curX += Math.cos(curAngle) * stepLen * (0.7 + Math.random() * 0.6);
    curY += Math.sin(curAngle) * stepLen * (0.7 + Math.random() * 0.6);
    pts.push({ x: curX, y: curY });
  }
  return pts;
}

function addCracks() {
  const count = clickCount <= 2 ? 2 : clickCount <= 4 ? 3 : 4;
  for (let i = 0; i < count; i++) {
    const angle  = Math.random() * Math.PI * 2;
    const startR = Math.random() * 30;
    const sx = CX + Math.cos(angle) * startR;
    const sy = CY + Math.sin(angle) * startR;
    const crackAngle = angle + (Math.random() - 0.5) * 1.2;
    const length = 50 + Math.random() * 70;
    const pts = generateCrack(sx, sy, crackAngle, length, 12 + Math.floor(Math.random() * 8));
    crackPaths.push({ pts, width: 1.2 + Math.random() });
  }
}

// ── Voronoi fragments ─────────────────────────────────────────
function buildFragments() {
  const numCells = 12 + Math.floor(Math.random() * 8);
  const seeds = [];
  for (let i = 0; i < numCells; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 15 + Math.random() * RX * 0.85;
    seeds.push({ x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r * (RY / RX) });
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    seeds.push({ x: CX + Math.cos(a) * RX * 1.1, y: CY + Math.sin(a) * RY * 1.1 });
  }

  const frags = [];
  const STEP  = 4;
  const cols  = Math.ceil(W / STEP);
  const map   = new Uint16Array(Math.ceil(W / STEP) * Math.ceil(H / STEP));

  for (let py = 0; py < H; py += STEP) {
    for (let px = 0; px < W; px += STEP) {
      let minD = Infinity, minI = 0;
      for (let s = 0; s < seeds.length; s++) {
        const dx = px - seeds[s].x, dy = py - seeds[s].y;
        const d  = dx * dx + dy * dy;
        if (d < minD) { minD = d; minI = s; }
      }
      map[(py / STEP) * cols + (px / STEP)] = minI;
    }
  }

  for (let si = 0; si < seeds.length; si++) {
    const fc   = document.createElement('canvas');
    fc.width   = W; fc.height = H;
    const fc2d = fc.getContext('2d');
    drawStamp(fc2d, CX, CY, crackPaths);

    fc2d.save();
    fc2d.globalCompositeOperation = 'destination-in';
    const mask  = document.createElement('canvas');
    mask.width  = W; mask.height = H;
    const mctx  = mask.getContext('2d');
    const idata = mctx.createImageData(W, H);

    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const gx = Math.floor(px / STEP), gy = Math.floor(py / STEP);
        if (map[gy * cols + gx] === si) {
          const dx    = (px - CX) / RX, dy = (py - CY) / RY;
          const angle = Math.atan2(dy, dx);
          const r2    = 1 + Math.sin(angle * WOBBLE.freq + WOBBLE.phase) * WOBBLE.amp;
          if (dx * dx + dy * dy <= r2 * r2) {
            const idx = (py * W + px) * 4;
            idata.data[idx] = idata.data[idx+1] = idata.data[idx+2] = idata.data[idx+3] = 255;
          }
        }
      }
    }
    mctx.putImageData(idata, 0, 0);
    fc2d.drawImage(mask, 0, 0);
    fc2d.restore();

    frags.push({
      canvas: fc, cx: CX, cy: CY, x: 0, y: 0,
      vx: (Math.random() - 0.5) * 2, vy: -2 - Math.random() * 2,
      rotation: 0, rotSpeed: (Math.random() - 0.5) * 0.12,
      opacity: 1, gravity: 0.18 + Math.random() * 0.08
    });
  }
  return frags;
}

// ══════════════════════════════════════════════════════════════
// TRANSITION: Envelope open → Card rise → Card expand → Invitation reveal
// ══════════════════════════════════════════════════════════════
function openEnvelope() {
  const flap    = document.getElementById('env-flap');
  const card    = document.getElementById('card');
  const scene   = document.querySelector('.scene');
  const hint    = document.getElementById('hint-stamp');
  const envWrap = document.getElementById('envelope-wrap');

  // 1. Flap opens
  flap.classList.add('open');

  // 2. Card rises out
  setTimeout(() => card.classList.add('rise'), 200);

  // 3. After rise settles, expand card to fullscreen
  setTimeout(() => {
    expandCard(card, scene, hint, envWrap);
  }, 1300);
}

function expandCard(card, scene, hint, envWrap) {
  // Snapshot position while still in envelope DOM
  const rect = card.getBoundingClientRect();

  // Move card to body so envWrap removal won't destroy it
  document.body.appendChild(card);

  // Pin at exact same screen position
  Object.assign(card.style, {
    position:  'fixed',
    left:      rect.left + 'px',
    top:       rect.top  + 'px',
    width:     rect.width  + 'px',
    height:    rect.height + 'px',
    transform: 'none',
    opacity:   '1',
    zIndex:    '200',
    margin:    '0',
    bottom:    'auto',
    animation: 'none',
  });

  // Force reflow — establishes start of transition
  void card.getBoundingClientRect();

  // Apply transition
  card.style.transition = [
    'top    0.7s cubic-bezier(0.4,0,0.2,1)',
    'left   0.7s cubic-bezier(0.4,0,0.2,1)',
    'width  0.7s cubic-bezier(0.4,0,0.2,1)',
    'height 0.7s cubic-bezier(0.4,0,0.2,1)',
  ].join(', ');

  const inner = card.querySelector('#card-inner');
  if (inner) inner.style.transition = 'border-radius 0.7s cubic-bezier(0.4,0,0.2,1)';

  // Next frame: expand to fullscreen + fade everything behind
  requestAnimationFrame(() => requestAnimationFrame(() => {
    Object.assign(card.style, {
      left:   '0px',
      top:    '0px',
      width:  window.innerWidth  + 'px',
      height: window.innerHeight + 'px',
    });
    if (inner) inner.style.borderRadius = '0px';

    scene.classList.add('fade-out');
    hint.classList.add('fade-out');
    envWrap.classList.add('fade-out');
  }));

  // After expand done: crossfade into invitation screen
  setTimeout(() => {
    revealInvitation(card, scene, hint, envWrap);
  }, 900);
}

function revealInvitation(card, scene, hint, envWrap) {
  const invScreen = document.getElementById('invitation-screen');

  // Fade the card-bridge out while invitation fades in simultaneously
  card.style.transition = 'opacity 0.6s ease';
  card.style.opacity    = '0';

  // Invitation screen fades in (CSS transition on #invitation-screen)
  invScreen.classList.add('revealed');

  // Trigger invitation card content animation
  setTimeout(() => {
    document.querySelector('.inv-inner').classList.add('play-reveal');
    document.getElementById('hint-inv').classList.add('play-hint');
  }, 300);

  // Clean up screen 1 DOM after everything is done
  setTimeout(() => {
    if (card    && card.parentNode)    card.remove();
    if (scene   && scene.parentNode)   scene.remove();
    if (hint    && hint.parentNode)    hint.remove();
    if (envWrap && envWrap.parentNode) envWrap.remove();
    fallCanvas.style.display = 'none';

    // Boot screen 2 animations
    initInvitationScreen();
  }, 700);
}

// ══════════════════════════════════════════════════════════════
// SCREEN 2 — Invitation physics / stars / ropes
// ══════════════════════════════════════════════════════════════
function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 600;
}

function initInvitationScreen() {
  const ropeCanvas = document.getElementById('rope-canvas');
  const ropeCtx    = ropeCanvas.getContext('2d');

  function resizeRopeCanvas() {
    ropeCanvas.width  = window.innerWidth;
    ropeCanvas.height = window.innerHeight;
  }
  resizeRopeCanvas();

  // Stars
  const starsBg = document.getElementById('stars-bg');
  function makeStars() {
    starsBg.innerHTML = '';
    const count = Math.floor(window.innerWidth * window.innerHeight / (isMobile() ? 3500 : 2500));
    for (let i = 0; i < count; i++) {
      const s  = document.createElement('div');
      s.className = 'star-dot';
      const sz = Math.random() * 2.2 + 0.3;
      const op = Math.random() * 0.65 + 0.3;
      s.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;
        width:${sz}px;height:${sz}px;
        --dur:${(Math.random()*3+2).toFixed(1)}s;
        --del:${(Math.random()*5).toFixed(1)}s;
        --max-op:${op.toFixed(2)};`;
      starsBg.appendChild(s);
    }
  }
  makeStars();

  // SVG ornaments
  const ORNAMENT_SVGS = {
    lantern: (c1, c2) => `
      <svg width="50" height="86" viewBox="0 0 54 90" xmlns="http://www.w3.org/2000/svg">
        <line x1="27" y1="0" x2="27" y2="10" stroke="#c8a050" stroke-width="2"/>
        <ellipse cx="27" cy="13" rx="12" ry="4" fill="${c2}"/>
        <rect x="15" y="10" width="24" height="6" rx="2" fill="${c2}"/>
        <rect x="10" y="16" width="34" height="52" rx="9" fill="${c1}" opacity="0.95"/>
        <rect x="14" y="20" width="26" height="44" rx="7" fill="${c2}" opacity="0.15"/>
        <line x1="10" y1="30" x2="44" y2="30" stroke="${c2}" stroke-width="1" opacity="0.55"/>
        <line x1="10" y1="44" x2="44" y2="44" stroke="${c2}" stroke-width="1" opacity="0.55"/>
        <line x1="10" y1="58" x2="44" y2="58" stroke="${c2}" stroke-width="1" opacity="0.55"/>
        <ellipse cx="27" cy="44" rx="7" ry="9" fill="none" stroke="${c2}" stroke-width="1.5" opacity="0.45"/>
        <ellipse cx="27" cy="68" rx="12" ry="4" fill="${c2}"/>
        <rect x="15" y="66" width="24" height="5" rx="2" fill="${c2}"/>
        <line x1="21" y1="71" x2="19" y2="82" stroke="${c2}" stroke-width="1.5"/>
        <line x1="27" y1="71" x2="27" y2="84" stroke="${c2}" stroke-width="1.5"/>
        <line x1="33" y1="71" x2="35" y2="82" stroke="${c2}" stroke-width="1.5"/>
        <circle cx="19" cy="83" r="2.5" fill="${c2}"/>
        <circle cx="27" cy="85" r="2.5" fill="${c2}"/>
        <circle cx="35" cy="83" r="2.5" fill="${c2}"/>
      </svg>`,
    star: (color) => `
      <svg width="56" height="66" viewBox="0 0 60 68" xmlns="http://www.w3.org/2000/svg">
        <line x1="30" y1="0" x2="30" y2="9" stroke="#c8a050" stroke-width="2"/>
        <polygon points="30,10 33.5,22 45,19 37,28 48,34 36,36 38,48 30,40 22,48 24,36 12,34 23,28 15,19 26.5,22" fill="${color}" opacity="0.95"/>
        <circle cx="30" cy="32" r="4" fill="#fff" opacity="0.35"/>
        <line x1="30" y1="52" x2="30" y2="60" stroke="${color}" stroke-width="1.5"/>
        <circle cx="30" cy="62" r="3" fill="${color}" opacity="0.6"/>
      </svg>`,
    moon: (color) => `
      <svg width="60" height="74" viewBox="0 0 64 76" xmlns="http://www.w3.org/2000/svg">
        <line x1="32" y1="0" x2="32" y2="9" stroke="#c8a050" stroke-width="2"/>
        <circle cx="32" cy="40" r="26" fill="${color}" opacity="0.95"/>
        <circle cx="44" cy="33" r="20" fill="#0a0518"/>
        <circle cx="18" cy="28" r="2" fill="#fff" opacity="0.75"/>
        <circle cx="14" cy="37" r="1.2" fill="#fff" opacity="0.5"/>
        <circle cx="22" cy="23" r="1.5" fill="#fff" opacity="0.6"/>
        <line x1="32" y1="66" x2="32" y2="73" stroke="${color}" stroke-width="1.5"/>
        <circle cx="32" cy="75" r="2.5" fill="${color}" opacity="0.65"/>
      </svg>`,
  };

  const LANTERN_C = [
    ['#e8402a','#f0b030'], ['#2a6ae8','#30d0f0'],
    ['#9a2ae8','#e030c0'], ['#2ab870','#30f0a0'],
  ];
  const STAR_C = ['#f0c060','#60d0f0','#e060c0','#90f060'];
  const MOON_C = ['#f0c060','#c0e8ff','#f0d090'];

  const GRAVITY = 0.45, DAMPING = 0.982, SEG_LEN = 13;
  function getIterations(n) { return Math.max(20, n * 2); }

  const ALL_DEFS = [
    { type:'lantern', xFrac:0.05, segs:22, ci:0 },
    { type:'star',    xFrac:0.16, segs:16, ci:0 },
    { type:'moon',    xFrac:0.27, segs:19, ci:0 },
    { type:'lantern', xFrac:0.38, segs:12, ci:1 },
    { type:'star',    xFrac:0.62, segs:13, ci:1 },
    { type:'moon',    xFrac:0.73, segs:18, ci:1 },
    { type:'lantern', xFrac:0.84, segs:15, ci:2 },
    { type:'star',    xFrac:0.95, segs:21, ci:2 },
  ];

  function getActiveDefs() {
    const W2 = window.innerWidth;
    if (W2 <= 380) return [
      { type:'lantern', xFrac:0.12, segs:14, ci:0 },
      { type:'moon',    xFrac:0.50, segs:10, ci:1 },
      { type:'star',    xFrac:0.88, segs:13, ci:2 },
    ];
    if (W2 <= 600) return [
      { type:'lantern', xFrac:0.08, segs:15, ci:0 },
      { type:'star',    xFrac:0.30, segs:11, ci:0 },
      { type:'moon',    xFrac:0.70, segs:12, ci:1 },
      { type:'lantern', xFrac:0.92, segs:14, ci:2 },
    ];
    if (W2 <= 900) return [
      { type:'lantern', xFrac:0.06, segs:18, ci:0 },
      { type:'star',    xFrac:0.22, segs:13, ci:0 },
      { type:'moon',    xFrac:0.38, segs:10, ci:1 },
      { type:'star',    xFrac:0.62, segs:11, ci:1 },
      { type:'lantern', xFrac:0.78, segs:14, ci:2 },
      { type:'moon',    xFrac:0.94, segs:17, ci:2 },
    ];
    return ALL_DEFS;
  }

  let ornaments = [], dragging = null;

  function buildRope(anchorX, numSegs) {
    const nodes = [];
    for (let i = 0; i <= numSegs; i++) {
      const y = -(numSegs - i) * SEG_LEN;
      nodes.push({ x: anchorX, y, px: anchorX, py: y, pinned: i === 0 });
    }
    return nodes;
  }

  function initOrnaments() {
    document.getElementById('ornaments-layer').innerHTML = '';
    ornaments = [];
    getActiveDefs().forEach(d => {
      const ax    = d.xFrac * window.innerWidth;
      const nodes = buildRope(ax, d.segs);
      let svgStr;
      if (d.type === 'lantern') {
        const [c1, c2] = LANTERN_C[d.ci % LANTERN_C.length];
        svgStr = ORNAMENT_SVGS.lantern(c1, c2);
      } else if (d.type === 'star') {
        svgStr = ORNAMENT_SVGS.star(STAR_C[d.ci % STAR_C.length]);
      } else {
        svgStr = ORNAMENT_SVGS.moon(MOON_C[d.ci % MOON_C.length]);
      }
      const el = document.createElement('div');
      el.className = 'ornament';
      el.innerHTML = svgStr;
      el.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;';
      document.getElementById('ornaments-layer').appendChild(el);

      const svgW = d.type === 'lantern' ? 50 : d.type === 'star' ? 56 : 60;
      const orn  = { type: d.type, nodes, anchorX: ax, segs: d.segs,
                     el, svgW, grabbed: false, dropped: false, mouseX: 0, mouseY: 0 };
      attachDrag(orn);
      ornaments.push(orn);
    });
  }

  function dropAll() {
    ornaments.forEach(orn => {
      orn.dropped = true;
      orn.el.style.visibility = 'visible';
      const last  = orn.nodes[orn.nodes.length - 1];
      const kickX = (Math.random() < 0.5 ? 1 : -1) * (Math.random() * 12 + 8);
      last.px = last.x - kickX;
      last.py = last.y + 2;
    });
  }

  function attachDrag(orn) {
    const el = orn.el;
    let velHist = [];
    const getPos = e => e.touches
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };

    const onDown = e => {
      e.preventDefault();
      if (!orn.dropped) return;
      orn.grabbed = true; el.classList.add('grabbed'); dragging = orn; velHist = [];
      const p = getPos(e); orn.mouseX = p.x; orn.mouseY = p.y;
    };
    const onMove = e => {
      if (dragging !== orn) return;
      e.preventDefault();
      const p = getPos(e);
      velHist.push({ x: p.x, y: p.y, t: Date.now() });
      if (velHist.length > 8) velHist.shift();
      orn.mouseX = p.x; orn.mouseY = p.y;
    };
    const onUp = () => {
      if (dragging !== orn) return;
      orn.grabbed = false; el.classList.remove('grabbed');
      if (velHist.length >= 2) {
        const a = velHist[0], b = velHist[velHist.length - 1];
        const dt   = Math.max(b.t - a.t, 1);
        const last = orn.nodes[orn.nodes.length - 1];
        last.px = last.x - (b.x - a.x) / dt * 16;
        last.py = last.y - (b.y - a.y) / dt * 16;
      }
      dragging = null;
    };
    el.addEventListener('mousedown',  onDown);
    el.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove',  onMove, { passive: false });
    window.addEventListener('touchmove',  onMove, { passive: false });
    window.addEventListener('mouseup',  onUp);
    window.addEventListener('touchend', onUp);
  }

  function updateRope(orn) {
    const nodes     = orn.nodes;
    const W2 = window.innerWidth, H2 = window.innerHeight;
    const last      = nodes[nodes.length - 1];
    const isGrabbed = orn.grabbed && dragging === orn;

    if (isGrabbed) { last.x = orn.mouseX; last.y = orn.mouseY; last.px = last.x; last.py = last.y; }

    for (let i = 1; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.pinned) continue;
      if (i === nodes.length - 1 && isGrabbed) continue;
      const vx = (n.x - n.px) * DAMPING, vy = (n.y - n.py) * DAMPING;
      n.px = n.x; n.py = n.y;
      n.x += vx; n.y += vy + GRAVITY;
      if (n.y > H2 - 8) { n.y = H2 - 8; n.py = n.y + vy * 0.3; }
      if (n.x < 2) n.x = 2;
      if (n.x > W2 - 2) n.x = W2 - 2;
    }

    const iters = getIterations(orn.segs);
    for (let iter = 0; iter < iters; iter++) {
      nodes[0].x = orn.anchorX; nodes[0].y = 0;
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i], b = nodes[i + 1];
        const bIsGrabbed = (i === nodes.length - 2) && isGrabbed;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const diff = (dist - SEG_LEN) / dist;
        const aCanMove = !a.pinned, bCanMove = !bIsGrabbed;
        if (aCanMove && bCanMove) {
          const half = diff * 0.5;
          a.x += dx * half; a.y += dy * half;
          b.x -= dx * half; b.y -= dy * half;
        } else if (aCanMove) { a.x += dx * diff; a.y += dy * diff; }
        else if (bCanMove)   { b.x -= dx * diff; b.y -= dy * diff; }
      }
      nodes[0].x = orn.anchorX; nodes[0].y = 0;
    }
  }

  function drawRope(orn) {
    const nodes = orn.nodes;
    if (nodes.length < 2) return;
    ropeCtx.beginPath();
    ropeCtx.moveTo(nodes[0].x, nodes[0].y);
    for (let i = 1; i < nodes.length - 1; i++) {
      const mx = (nodes[i].x + nodes[i+1].x) / 2;
      const my = (nodes[i].y + nodes[i+1].y) / 2;
      ropeCtx.quadraticCurveTo(nodes[i].x, nodes[i].y, mx, my);
    }
    ropeCtx.lineTo(nodes[nodes.length-1].x, nodes[nodes.length-1].y);
    ropeCtx.strokeStyle = 'rgba(200,158,76,0.9)';
    ropeCtx.lineWidth   = 2;
    ropeCtx.lineCap     = 'round';
    ropeCtx.shadowColor = 'rgba(200,150,60,0.5)';
    ropeCtx.shadowBlur  = 5;
    ropeCtx.stroke();
    ropeCtx.shadowBlur  = 0;
  }

  function drawAnchor(ax) {
    ropeCtx.beginPath();
    ropeCtx.arc(ax, 0, 4.5, 0, Math.PI * 2);
    ropeCtx.fillStyle   = 'rgba(200,160,80,0.55)';
    ropeCtx.strokeStyle = 'rgba(240,192,96,0.9)';
    ropeCtx.lineWidth   = 1.5;
    ropeCtx.fill(); ropeCtx.stroke();
  }

  function positionOrnament(orn) {
    const last = orn.nodes[orn.nodes.length - 1];
    orn.el.style.transform = `translate(${(last.x - orn.svgW / 2).toFixed(1)}px, ${last.y.toFixed(1)}px)`;
  }

  function loop() {
    ropeCtx.clearRect(0, 0, ropeCanvas.width, ropeCanvas.height);
    ornaments.forEach(orn => {
      if (!orn.dropped) return;
      updateRope(orn);
      drawAnchor(orn.anchorX);
      drawRope(orn);
      positionOrnament(orn);
    });
    requestAnimationFrame(loop);
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeRopeCanvas();
      makeStars();
      initOrnaments();
      setTimeout(dropAll, 100);
    }, 200);
  });

  initOrnaments();
  loop();
  setTimeout(dropAll, 600);
}

// ══════════════════════════════════════════════════════════════
// SCREEN 1 RENDER LOOP
// ══════════════════════════════════════════════════════════════
function render() {
  ctx.clearRect(0, 0, W, H);

  if (!falling) {
    let sx = 0, sy = 0;
    if (shaking) {
      sx = (Math.random() - 0.5) * 8;
      sy = (Math.random() - 0.5) * 8;
      shakeFrames--;
      if (shakeFrames <= 0) shaking = false;
    }
    drawStamp(ctx, CX, CY, crackPaths, sx, sy);
  } else {
    fctx.clearRect(0, 0, fallCanvas.width, fallCanvas.height);

    // Get the actual rendered size of the stamp container (CSS-scaled)
    // so fragments fall at the same visual size the stamp appeared
    const containerRect = document.getElementById('stamp-container').getBoundingClientRect();
    const displaySize   = containerRect.width || W;   // fallback to 260 if hidden
    const scale         = displaySize / W;             // e.g. 0.67 if container is 174px

    const offsetX = window.innerWidth  / 2;
    const offsetY = window.innerHeight / 2;

    let allGone = true;
    fragments.forEach(f => {
      if (f.opacity <= 0) return;
      allGone = false;
      f.vy += f.gravity; f.x += f.vx; f.y += f.vy; f.rotation += f.rotSpeed;

      // screenY tracks where fragment centre is (in viewport coords)
      const screenY = offsetY + (f.cy + f.y - CY) * scale;
      if (screenY > window.innerHeight * 0.75) f.opacity -= 0.022;

      fctx.save();
      fctx.globalAlpha = Math.max(0, f.opacity);
      // Translate to screen centre + fragment offset (scaled), then rotate around fragment centre
      fctx.translate(
        offsetX + (f.cx + f.x - CX) * scale,
        offsetY + (f.cy + f.y - CY) * scale
      );
      fctx.rotate(f.rotation);
      // Draw the 260×260 fragment canvas scaled down to match visual stamp size
      fctx.drawImage(f.canvas, -f.cx * scale, -f.cy * scale, W * scale, H * scale);
      fctx.restore();
    });

    if (allGone) {
      fallCanvas.style.display = 'none';
      cancelAnimationFrame(animFrame);
      openEnvelope();
      return;
    }
  }

  animFrame = requestAnimationFrame(render);
}

// ── Click handler ─────────────────────────────────────────────
const stampContainer = document.getElementById('stamp-container');

// Suppress Android tap highlight — CSS alone isn't enough on some devices
stampContainer.addEventListener('touchstart', (e) => {
  e.preventDefault(); // kills the highlight AND the 300ms delay
}, { passive: false });

stampContainer.addEventListener('click', () => {
  if (falling || done) return;
  clickCount++;
  document.getElementById('hint-stamp').style.opacity = '0';

  addCracks();
  shaking = true; shakeFrames = 8;

  if (clickCount >= MAX_CLICKS) {
    setTimeout(() => {
      fragments                 = buildFragments();
      falling                   = true;
      stampCanvas.style.display = 'none';
      fallCanvas.style.display  = 'block';
    }, 120);
  }
});

// ── Boot ──────────────────────────────────────────────────────
render();

// ══════════════════════════════════════════════════════════════
// AUDIO — starts on first user interaction (browser policy)
// ══════════════════════════════════════════════════════════════
(function initAudio() {
  const music   = document.getElementById('bg-music');
  const muteBtn = document.getElementById('mute-btn');
  let started   = false;

  // Browsers block autoplay until the user has interacted with the page.
  // We start on the very first click/touch anywhere on the document.
  function startMusic() {
    if (started) return;
    started = true;
    music.volume = 0;
    music.play().then(() => {
      // Fade in smoothly over ~1.5 s
      let vol = 0;
      const tick = setInterval(() => {
        vol = Math.min(vol + 0.04, 1);
        music.volume = vol;
        if (vol >= 1) clearInterval(tick);
      }, 60);
    }).catch(() => {
      // Autoplay still blocked — silently ignore; mute btn still works
    });
    document.removeEventListener('click',     startMusic);
    document.removeEventListener('touchstart', startMusic);
  }

  document.addEventListener('click',     startMusic);
  document.addEventListener('touchstart', startMusic, { passive: true });

  // Mute / unmute toggle
  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // don't count as "crack" click on stamp
    if (music.muted) {
      music.muted = false;
      muteBtn.textContent = '♪';
      muteBtn.classList.remove('muted');
    } else {
      music.muted = true;
      muteBtn.textContent = '♪';
      muteBtn.classList.add('muted');
    }
    // If music hasn't started yet, clicking mute should still start it
    startMusic();
  });
})();
