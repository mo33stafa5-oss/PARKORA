/* PARKORA — 3D model (pure CSS 3D, no libraries). window.Parkora3D.mount(container) → cleanup() */
(function () {
const CSS = `
.p3{display:grid;grid-template-columns:minmax(0,1fr) 390px;height:calc(100vh - var(--hh,118px));min-height:560px}
.s3{position:relative;overflow:hidden;perspective:1700px;perspective-origin:50% 35%;touch-action:none;cursor:grab;
  background:radial-gradient(120% 90% at 50% 20%,light-dark(#fbfaf6,#1a232a) 0%,light-dark(#e7e5dc,#0c1115) 75%)}
.s3.drag{cursor:grabbing}
.w3{position:absolute;left:50%;top:58%;width:0;height:0;transform-style:preserve-3d;transition:transform .5s ease}
.s3.drag .w3{transition:none}
.bx,.g,.pl,.bb,.part{position:absolute;left:0;top:0;transform-style:preserve-3d}
.part{transition:transform 1.1s cubic-bezier(.2,.85,.25,1)}
.part.out{visibility:hidden}
.fc{position:absolute;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:var(--c,#ccc);overflow:hidden}
.fc::after{content:"";position:absolute;inset:0;background:#000;opacity:var(--sh,0);pointer-events:none}
.f-front{--sh:.07}.f-right,.f-left{--sh:.18}.f-back{--sh:.26}.f-bottom{--sh:.45}
.mat .fc{background-color:var(--matc)}
.wood{--matc:#c79b67}.wood .mat .fc{background-image:repeating-linear-gradient(92deg,rgba(80,45,10,.10) 0 2px,transparent 2px 9px),repeating-linear-gradient(0deg,rgba(255,255,255,.06) 0 1px,transparent 1px 13px)}
.pla{--matc:#e6e8ea}.pla .mat .fc{background-image:repeating-linear-gradient(0deg,rgba(0,0,0,.05) 0 1px,transparent 1px 3px)}
.floor .f-top{background:light-dark(#9aa1a6,#7f878d) !important;background-image:none !important}
.wood .floor .f-top{background:#b98d5c !important;background-image:repeating-linear-gradient(92deg,rgba(80,45,10,.12) 0 2px,transparent 2px 11px) !important}
.pla .floor .f-top{background:#d3d6d9 !important}
.pl>div{position:absolute}
.bay{font:800 22px/1 Archivo,sans-serif;color:rgba(255,255,255,.85);display:flex;align-items:flex-end;justify-content:center;padding-bottom:10px;border:3px solid #f5c400;border-top:0}
.bay.res{background:rgba(245,196,0,.18)}
.stripes{background:repeating-linear-gradient(90deg,#d7263d 0 12px,#fff 12px 24px) !important}
.lcdface{background:#1f4fbf;display:flex;flex-direction:column;justify-content:center;padding:0 3px;box-shadow:inset 0 0 0 2px #133a8f}
.lcdface span{font:700 5.2px/1.25 "IBM Plex Mono",monospace;color:#e8f0ff;white-space:pre;letter-spacing:.2px}
.keys{display:grid;grid-template-columns:repeat(4,1fr);gap:1.2px;padding:2px;background:#111}
.keys span{background:#e9e9e9;font:700 5px/7px "IBM Plex Sans";color:#222;text-align:center;border-radius:1px}
.keys span.k{background:#f5b800}
.pcb-blue{--c:#1d5fa8}.pcb-red{--c:#b8262f}.pcb-dark{--c:#14324a}
.eye{position:absolute;width:10px;height:10px;border-radius:50%;background:radial-gradient(#ddd,#888);top:5px}
.led .fc{background:#4b1010}
.led.on .fc{background:#ff3b3b;box-shadow:0 0 14px 4px rgba(255,40,40,.9)}
.lamp .fc{background:#7a6a33}
.lights .lamp .fc{background:#fff3b0;box-shadow:0 0 24px 8px rgba(255,220,90,.9)}
.pool{background:radial-gradient(closest-side,rgba(255,226,120,.55),rgba(255,226,120,0));opacity:0;transition:opacity .6s}
.lights .pool{opacity:1}
.beam{background:linear-gradient(90deg,rgba(19,168,168,.55),rgba(19,168,168,0));opacity:0;transition:opacity .3s}
.beam.on{opacity:1}
.irbeam{background:linear-gradient(270deg,rgba(255,60,60,.55),rgba(255,60,60,0));opacity:0;transition:opacity .3s}
.irbeam.on{opacity:1}
.win{position:absolute;inset:2px 3px;background:linear-gradient(160deg,#bfe0f5,#4f7fa3);border-radius:2px}
.hl-part .fc{box-shadow:inset 0 0 0 2px #f5b800}
.bb{transform:translate3d(var(--x),var(--y),var(--z)) rotateY(calc(var(--ry) * -1)) rotateX(calc(var(--rx) * -1))}
.lbl{position:absolute;transform:translate(-50%,-100%);white-space:nowrap;font:600 12px/1 "IBM Plex Sans",sans-serif;background:light-dark(#14202a,#f1f4f6);color:light-dark(#fff,#14202a);padding:5px 8px;border-radius:6px;pointer-events:none}
.lbl::after{content:"";position:absolute;left:50%;bottom:-4px;width:8px;height:8px;margin-left:-4px;background:inherit;transform:rotate(45deg)}
.nolabels .lbl{display:none}
.puff{position:absolute;width:40px;height:40px;margin:-20px;border-radius:50%;background:radial-gradient(rgba(120,120,120,.75),rgba(120,120,120,0) 70%);opacity:0}
.gas .puff{animation:puff 2.4s ease-out infinite}
@keyframes puff{0%{opacity:0;transform:translateY(0) scale(.4)}20%{opacity:.9}100%{opacity:0;transform:translateY(-120px) scale(2.6)}}
.ov{position:absolute;inset:0;pointer-events:none;transition:opacity .6s}
.night{background:rgba(8,16,32,.38);opacity:0}
.s3.dark .night{opacity:1}
.alarm{background:radial-gradient(closest-side,rgba(215,38,61,0),rgba(215,38,61,.45));opacity:0}
.s3.alarmon .alarm{animation:alarm 1s steps(2) infinite}
@keyframes alarm{0%{opacity:1}50%{opacity:.15}}
.buz.on .fc{box-shadow:0 0 0 3px rgba(215,38,61,.8)}
.t3{position:absolute;left:10px;top:10px;display:flex;gap:6px;flex-wrap:wrap;z-index:3}
.cap3{position:absolute;left:12px;right:12px;bottom:12px;display:flex;justify-content:center;pointer-events:none;z-index:3}
.cap3 span{background:color-mix(in srgb,var(--panel,#fff) 94%,transparent);border:1px solid var(--line,#ddd);border-radius:10px;padding:10px 14px;font-size:15px;max-width:720px;text-align:center}
.seg{display:flex;border:1px solid var(--line,#ddd);border-radius:10px;overflow:hidden;margin:14px 0 4px}
.seg button{flex:1;min-height:44px;border:0;background:none;font-weight:600;cursor:pointer;color:var(--mute)}
.seg button[aria-pressed=true]{background:var(--acc,#f5b800);color:#17140a}
.chk{display:flex;align-items:center;gap:8px;min-height:40px;font-size:14px;cursor:pointer}
.chk input{width:18px;height:18px;accent-color:#f5b800}
.scn{display:grid;gap:8px;margin-top:12px}
.scn button{text-align:left;min-height:52px;padding:8px 14px;border:1px solid var(--line,#ddd);border-radius:10px;background:var(--panel,#fff);cursor:pointer}
.scn button b{display:block;font-size:15px}.scn button small{color:var(--mute);font-size:13px}
.scn button[aria-pressed=true]{border-color:#f5b800;box-shadow:0 0 0 3px color-mix(in srgb,#f5b800 35%,transparent)}
.log{margin:12px 0 0;padding:0;list-style:none;font-size:14px}
.log li{padding:6px 0;border-top:1px solid var(--line,#ddd)}
.log li:first-child{font-weight:600}
@media(max-width:900px){.p3{grid-template-columns:minmax(0,1fr);height:auto}.s3{height:68vh;min-height:440px}.p3 aside{border-left:0;border-top:1px solid var(--line)}}
@media(prefers-reduced-motion:reduce){.part{transition:none}.gas .puff,.s3.alarmon .alarm{animation:none}}
`;

const G = 12;                                  // floor top height
const BAYS = [-195, -65, 65, 195], BAY_Z = -110;
const ENTRY_X = -245, EXIT_X = 245, GATE_Z = 200;

function el(tag, cls, parent, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
function box(parent, o) {
  const b = el('div', 'bx ' + (o.cls || ''), parent);
  b.style.transform = 'translate3d(' + (o.x || 0) + 'px,' + (-((o.y || 0) + o.h / 2)) + 'px,' + (o.z || 0) + 'px)' + (o.ry ? ' rotateY(' + o.ry + 'deg)' : '');
  if (o.c) b.style.setProperty('--c', o.c);
  const F = [['front', o.w, o.h, 'translateZ(' + o.d / 2 + 'px)'], ['back', o.w, o.h, 'rotateY(180deg) translateZ(' + o.d / 2 + 'px)'],
    ['right', o.d, o.h, 'rotateY(90deg) translateZ(' + o.w / 2 + 'px)'], ['left', o.d, o.h, 'rotateY(-90deg) translateZ(' + o.w / 2 + 'px)'],
    ['top', o.w, o.d, 'rotateX(90deg) translateZ(' + o.h / 2 + 'px)'], ['bottom', o.w, o.d, 'rotateX(-90deg) translateZ(' + o.h / 2 + 'px)']];
  F.forEach(([n, w, h, t]) => {
    if ((o.skip || ['bottom']).indexOf(n) >= 0) return;
    const f = el('div', 'fc f-' + n, b);
    f.style.cssText += 'width:' + w + 'px;height:' + h + 'px;left:' + (-w / 2) + 'px;top:' + (-h / 2) + 'px;transform:' + t;
    if (o.faces && o.faces[n]) f.innerHTML = o.faces[n];
    if (o.fcls && o.fcls[n]) f.className += ' ' + o.fcls[n];
  });
  return b;
}
function plane(parent, o) {                    // flat on the floor, readable from the front
  const p = el('div', 'pl', parent);
  p.style.transform = 'translate3d(' + o.x + 'px,' + (-(o.y || G) - .5) + 'px,' + o.z + 'px) rotateX(90deg)' + (o.rz ? ' rotateZ(' + o.rz + 'deg)' : '');
  const d = el('div', o.cls || '', p, o.html || null);
  d.style.cssText += 'width:' + o.w + 'px;height:' + o.d + 'px;left:' + (-o.w / 2) + 'px;top:' + (-o.d / 2) + 'px';
  return d;
}
function vplane(parent, o) {                   // vertical, facing +z, rotated by ry
  const p = el('div', 'pl', parent);
  p.style.transform = 'translate3d(' + o.x + 'px,' + (-o.y) + 'px,' + o.z + 'px) rotateY(' + (o.ry || 0) + 'deg)';
  const d = el('div', o.cls || '', p);
  d.style.cssText += 'width:' + o.w + 'px;height:' + o.h + 'px;left:' + (-o.w / 2) + 'px;top:' + (-o.h / 2) + 'px';
  return d;
}
function grp(parent, t, cls) { const g = el('div', 'g ' + (cls || ''), parent); if (t) g.style.transform = t; return g; }
function label(parent, text, x, y, z) {
  const b = el('div', 'bb', parent); b.style.setProperty('--x', x + 'px'); b.style.setProperty('--y', (-y) + 'px'); b.style.setProperty('--z', z + 'px');
  el('span', 'lbl', b, null).textContent = text; return b;
}

const STEPS = [
  { k: 'base', t: 'Base plate', d: 'Everything mounts on one board. The front apron is the approach road.' },
  { k: 'lines', t: 'Parking bays P1–P4', d: 'Paint four bays with yellow lines and number them.' },
  { k: 'walls', t: 'Walls', d: 'Back and side walls, front wall with two openings: entry (left) and exit (right).' },
  { k: 'gates', t: 'Barrier gates', d: 'Two posts, an SG90 servo on each, striped arms. Entry servo GPIO13, exit servo GPIO14, 5 V from the supply.' },
  { k: 'us', t: 'HC-SR04 at the entry', d: 'Faces the approach lane and detects the car waiting at the barrier. TRIG GPIO23, ECHO GPIO35 through the 1k/2k divider.' },
  { k: 'slotir', t: 'Slot sensors + LEDs', d: 'One IR sensor per bay on the back wall (GPIO36, 39, 32, 33). Each red LED is wired to its sensor output, so it lights by itself when the bay is taken.' },
  { k: 'exitir', t: 'Exit IR sensor', d: 'On the right wall at the exit lane, GPIO27. A car in front of it opens the exit gate.' },
  { k: 'console', t: 'Driver console', d: 'LCD 16×2 on I2C (SDA 21, SCL 22) above the 4×4 keypad, at driver height next to the entry barrier.' },
  { k: 'pir', t: 'PIR + garage light', d: 'PIR on the back wall (GPIO26) switches the light (GPIO15) on with motion, off after 30 s.' },
  { k: 'mq2', t: 'MQ-2 + buzzer', d: 'Gas sensor on the left wall (GPIO34 via divider), buzzer by the electronics (GPIO25).' },
  { k: 'elec', t: 'ESP32 + power supply', d: 'The ESP32 DevKitC and the 5 V / 2 A supply sit on the apron; all wiring runs under the board to them.' },
  { k: 'final', t: 'Finished model', d: 'Two cars parked in P1 and P3. Switch to Live demo to see it work.' }
];
const LIFT = { base: 0, lines: 8, walls: 70, gates: 150, us: 120, slotir: 170, exitir: 150, console: 190, pir: 230, mq2: 200, elec: 140, final: 60 };

const SCEN = [
  { id: 'booked', t: 'Driver with a booking', s: 'PIN 4821 → slot P2' },
  { id: 'walkin', t: 'Walk-in driver', s: 'Presses A → free slot P4' },
  { id: 'wrong', t: 'Wrong PIN ×3', s: 'Keypad locks for 30 s' },
  { id: 'leave', t: 'Car leaves', s: 'Exit IR opens the exit gate' },
  { id: 'gas', t: 'Gas / smoke alarm', s: 'Siren, exit opens, entry locked' },
  { id: 'pir', t: 'Motion lighting', s: 'Someone walks in → lights on' }
];

function mount(host) {
  if (!document.getElementById('p3css')) { const st = el('style', null, document.head); st.id = 'p3css'; st.textContent = CSS; }
  host.innerHTML = '';
  const root = el('div', 'p3', host);
  const stage = el('div', 's3', root);
  const world = el('div', 'w3 wood', stage);
  el('div', 'ov night', stage); el('div', 'ov alarm', stage);
  const tools = el('div', 't3', stage);
  const cap = el('div', 'cap3', stage); const capText = el('span', null, cap);
  const aside = el('aside', null, root);

  /* ---------- camera ---------- */
  const cam = { rx: -32, ry: -24, s: .95 };
  const fitScale = () => { const w = stage.clientWidth, hgt = stage.clientHeight; return Math.max(.35, Math.min(1.2, Math.min(w / 900, hgt / 700))); };
  let base = fitScale();
  function applyCam() {
    world.style.transform = 'scale3d(' + cam.s * base + ',' + cam.s * base + ',' + cam.s * base + ') rotateX(' + cam.rx + 'deg) rotateY(' + cam.ry + 'deg) translate3d(0,0,-80px)';
    world.style.setProperty('--rx', cam.rx + 'deg'); world.style.setProperty('--ry', cam.ry + 'deg');
  }
  applyCam();
  const ro = new ResizeObserver(() => { base = fitScale(); applyCam(); }); ro.observe(stage);
  const ptrs = new Map(); let last = null, pinch = null;
  stage.addEventListener('pointerdown', e => { if (e.target.closest('.t3')) return; stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); stage.classList.add('drag'); last = { x: e.clientX, y: e.clientY }; });
  stage.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) cam.s = Math.min(2.4, Math.max(.4, cam.s * d / pinch)); pinch = d; applyCam(); return; }
    cam.ry += (e.clientX - last.x) * .35; cam.rx = Math.max(-80, Math.min(-6, cam.rx - (e.clientY - last.y) * .25)); last = { x: e.clientX, y: e.clientY }; applyCam();
  });
  const endPtr = e => { ptrs.delete(e.pointerId); pinch = null; if (!ptrs.size) stage.classList.remove('drag'); else last = [...ptrs.values()][0]; };
  stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);
  stage.addEventListener('wheel', e => { e.preventDefault(); cam.s = Math.min(2.4, Math.max(.4, cam.s * Math.exp(-e.deltaY * .0012))); applyCam(); }, { passive: false });
  const tb = (txt, fn, lab) => { const b = el('button', 'tb', tools); b.textContent = txt; if (lab) b.setAttribute('aria-label', lab); b.onclick = fn; return b; };
  tb('+', () => { cam.s = Math.min(2.4, cam.s * 1.15); applyCam(); }, 'Zoom in');
  tb('−', () => { cam.s = Math.max(.4, cam.s / 1.15); applyCam(); }, 'Zoom out');
  tb('Front', () => { Object.assign(cam, { rx: -22, ry: 0, s: 1 }); applyCam(); });
  tb('Top', () => { Object.assign(cam, { rx: -78, ry: 0, s: 1 }); applyCam(); });
  tb('3/4 view', () => { Object.assign(cam, { rx: -32, ry: -24, s: .95 }); applyCam(); });

  /* ---------- model ---------- */
  const parts = {};
  const P = k => { const p = el('div', 'part', world); p.dataset.k = k; parts[k] = p; return p; };
  const refs = {};

  // base
  let p = P('base');
  box(p, { x: 0, y: 0, z: 90, w: 660, h: G, d: 640, cls: 'mat floor' });
  plane(p, { x: ENTRY_X, z: 300, w: 4, d: 180, cls: '', html: '' }).style.background = 'rgba(255,255,255,.6)';
  label(p, 'Base plate', 0, 20, 330);

  // bays
  p = P('lines');
  refs.bays = BAYS.map((x, i) => { const b = plane(p, { x, z: -110, w: 128, d: 196, cls: 'bay' + (i === 1 ? ' res' : ''), html: 'P' + (i + 1) }); return b; });
  plane(p, { x: 0, z: 110, w: 600, d: 3 }).style.background = 'rgba(255,255,255,.55)';
  label(p, 'Bays P1–P4', 0, 30, -110);

  // walls
  p = P('walls');
  box(p, { x: 0, y: G, z: -215, w: 660, h: 72, d: 10, cls: 'mat' });
  box(p, { x: -325, y: G, z: -5, w: 10, h: 72, d: 410, cls: 'mat' });
  box(p, { x: 325, y: G, z: -5, w: 10, h: 72, d: 410, cls: 'mat' });
  box(p, { x: 0, y: G, z: GATE_Z, w: 356, h: 40, d: 10, cls: 'mat' });
  label(p, 'Walls', -325, 100, -100);

  // gates
  p = P('gates');
  const gate = (px, dir) => {
    box(p, { x: px, y: G, z: GATE_Z, w: 14, h: 56, d: 14, cls: 'mat' });
    box(p, { x: px, y: G + 50, z: GATE_Z + 11, w: 24, h: 12, d: 10, c: '#2f6fd6' });
    const piv = grp(p, 'translate3d(' + px + 'px,' + (-(G + 56)) + 'px,' + (GATE_Z + 19) + 'px) rotateZ(0deg)');
    piv.style.transition = 'transform .9s ease-in-out';
    box(piv, { x: dir * 58, y: -3, z: 0, w: 112, h: 6, d: 4, c: '#fff', fcls: { front: 'stripes', back: 'stripes', top: 'stripes' } });
    return piv;
  };
  refs.entryArm = gate(-187, -1); refs.exitArm = gate(187, 1);
  label(p, 'Servo SG90 · GPIO13', -187, 90, GATE_Z); label(p, 'Servo SG90 · GPIO14', 187, 90, GATE_Z);

  // ultrasonic
  p = P('us');
  box(p, { x: -318, y: G, z: 258, w: 10, h: 34, d: 10, cls: 'mat' });
  box(p, { x: -310, y: G + 26, z: 258, w: 4, h: 20, d: 44, cls: 'pcb-blue', faces: { right: '<i class="eye" style="left:7px"></i><i class="eye" style="left:27px"></i>' } });
  refs.usBeam = plane(p, { x: -250, y: G + 36, z: 258, w: 116, d: 34, cls: 'beam' });
  label(p, 'HC-SR04 · TRIG 23 / ECHO 35', -310, 70, 258);

  // slot IR + LEDs
  p = P('slotir');
  refs.leds = BAYS.map((x, i) => {
    box(p, { x, y: G + 14, z: -208, w: 30, h: 13, d: 4, cls: 'pcb-red', faces: { front: '<i class="eye" style="left:3px;top:1.5px"></i><i class="eye" style="left:17px;top:1.5px"></i>' } });
    return box(p, { x, y: G + 72, z: -215, w: 9, h: 7, d: 9, cls: 'led' });
  });
  label(p, 'IR ×4 · GPIO36/39/32/33', -130, 110, -215);

  // exit IR
  p = P('exitir');
  box(p, { x: 318, y: G + 14, z: 165, w: 4, h: 13, d: 30, cls: 'pcb-red', faces: { left: '<i class="eye" style="left:3px;top:1.5px"></i><i class="eye" style="left:17px;top:1.5px"></i>' } });
  refs.exitBeam = plane(p, { x: 262, y: G + 20, z: 165, w: 110, d: 10, cls: 'irbeam' });
  label(p, 'Exit IR · GPIO27', 318, 60, 165);

  // console
  p = P('console');
  box(p, { x: -170, y: G, z: 262, w: 14, h: 52, d: 14, cls: 'mat' });
  const lcdHtml = '<div class="lcdface" style="position:absolute;inset:3px 3px 50% 3px"><span>PARKORA</span><span>Free 1 of 4</span></div>';
  const keyHtml = '<div class="keys" style="position:absolute;left:4px;right:4px;bottom:3px;height:46%">' + '123A456B789C*0#D'.split('').map(k => '<span data-k="' + k + '">' + k + '</span>').join('') + '</div>';
  const head = box(p, { x: -170, y: G + 50, z: 262, w: 46, h: 44, d: 12, ry: -40, c: '#22282d', faces: { front: lcdHtml + keyHtml } });
  refs.lcd = head.querySelectorAll('.lcdface span'); refs.keys = {}; head.querySelectorAll('.keys span').forEach(s => refs.keys[s.dataset.k] = s);
  label(p, 'LCD 16×2 + keypad 4×4', -170, 112, 262);

  // PIR + light
  p = P('pir');
  box(p, { x: 0, y: G + 50, z: -206, w: 22, h: 18, d: 8, c: '#f4f4f4', faces: { front: '<i style="position:absolute;inset:3px 4px;border-radius:50%;background:radial-gradient(#fff,#cfcfcf)"></i>' } });
  box(p, { x: 0, y: G + 72, z: -205, w: 50, h: 8, d: 14, cls: 'lamp' });
  refs.pool = plane(p, { x: 0, z: -40, w: 620, d: 420, cls: 'pool' });
  label(p, 'PIR · GPIO26', 40, 80, -206); label(p, 'Light · GPIO15', -40, 100, -205);

  // MQ-2 + buzzer
  p = P('mq2');
  box(p, { x: -318, y: G + 34, z: -20, w: 4, h: 22, d: 30, cls: 'pcb-blue', faces: { right: '<i style="position:absolute;left:6px;top:2px;width:18px;height:18px;border-radius:50%;background:repeating-radial-gradient(#ccc 0 1px,#888 1px 2px)"></i>' } });
  const puffs = grp(p, null, 'smoke');
  [[-290, 60, -20], [-270, 50, 10], [-280, 70, -45], [-255, 40, -10]].forEach((q, i) => { const b = el('div', 'bb', puffs); b.style.setProperty('--x', q[0] + 'px'); b.style.setProperty('--y', (-q[1]) + 'px'); b.style.setProperty('--z', q[2] + 'px'); const pf = el('i', 'puff', b); pf.style.animationDelay = (i * .55) + 's'; });
  refs.smoke = puffs;
  refs.buz = box(p, { x: -40, y: G, z: 280, w: 14, h: 10, d: 14, c: '#1d1f22', cls: 'buz' });
  label(p, 'MQ-2 · GPIO34', -318, 75, -20); label(p, 'Buzzer · GPIO25', -40, 35, 280);

  // electronics
  p = P('elec');
  box(p, { x: 40, y: G, z: 280, w: 62, h: 4, d: 26, cls: 'pcb-dark', fcls: { top: 'pins' } });
  box(p, { x: 46, y: G + 4, z: 280, w: 20, h: 3, d: 15, c: '#c3cbd1' });
  box(p, { x: 120, y: G, z: 280, w: 52, h: 24, d: 32, c: '#2a2e33' });
  label(p, 'ESP32 DevKitC', 40, 30, 280); label(p, '5 V / 2 A supply', 120, 46, 280);

  // cars
  p = P('final');
  function car(color) {
    const g = grp(world, null, 'car'); g.style.display = 'none';
    box(g, { x: 0, y: 5, z: 0, w: 44, h: 16, d: 84, c: color });
    box(g, { x: 0, y: 21, z: 8, w: 38, h: 13, d: 42, c: color, faces: { front: '<i class="win"></i>', back: '<i class="win"></i>', left: '<i class="win"></i>', right: '<i class="win"></i>' } });
    [-23, 23].forEach(sx => [-27, 27].forEach(sz => box(g, { x: sx, y: 0, z: sz, w: 7, h: 14, d: 14, c: '#1b1f23', skip: ['bottom', 'top', sx < 0 ? 'right' : 'left'] })));
    box(g, { x: -14, y: 11, z: -42.5, w: 9, h: 5, d: 1, c: '#fff1b8', skip: ['back', 'left', 'right', 'top', 'bottom'] }); box(g, { x: 14, y: 11, z: -42.5, w: 9, h: 5, d: 1, c: '#fff1b8', skip: ['back', 'left', 'right', 'top', 'bottom'] });
    box(g, { x: -14, y: 11, z: 42.5, w: 9, h: 5, d: 1, c: '#e0313e', skip: ['front', 'left', 'right', 'top', 'bottom'] }); box(g, { x: 14, y: 11, z: 42.5, w: 9, h: 5, d: 1, c: '#e0313e', skip: ['front', 'left', 'right', 'top', 'bottom'] });
    return { el: g, x: 0, z: 0, h: 0 };
  }
  const cars = { a: car('#d23b3b'), b: car('#eceff1'), c: car('#2f6fd6'), d: car('#2f9e6e') };
  label(p, 'Car in P1', BAYS[0], 60, BAY_Z); label(p, 'Car in P3', BAYS[2], 60, BAY_Z);
  const person = grp(world, null, 'car'); person.style.display = 'none';
  box(person, { x: 0, y: 0, z: 0, w: 12, h: 30, d: 10, c: '#3b4a6b' }); box(person, { x: 0, y: 30, z: 0, w: 10, h: 10, d: 10, c: '#e2b48c' });
  const personObj = { el: person, x: 0, z: 0, h: 0 };

  /* ---------- animation helpers ---------- */
  let token = 0;
  const place = (o, s) => { Object.assign(o, s); o.el.style.transition = 'none'; o.el.style.transform = 'translate3d(' + o.x + 'px,' + (-G) + 'px,' + o.z + 'px) rotateY(' + o.h + 'deg)'; o.el.style.display = ''; };
  const sleep = (ms, t) => new Promise((res, rej) => setTimeout(() => (t === token ? res() : rej('cancel')), ms));
  const move = (o, s, ms, t) => { Object.assign(o, s); void o.el.offsetWidth; o.el.style.transition = 'transform ' + ms + 'ms ease-in-out'; o.el.style.transform = 'translate3d(' + o.x + 'px,' + (-G) + 'px,' + o.z + 'px) rotateY(' + o.h + 'deg)'; return sleep(ms, t); };
  const arm = (which, open) => { const a = which === 'entry' ? refs.entryArm : refs.exitArm, x = which === 'entry' ? -187 : 187; a.style.transform = 'translate3d(' + x + 'px,' + (-(G + 56)) + 'px,' + (GATE_Z + 19) + 'px) rotateZ(' + (open ? (which === 'entry' ? 90 : -90) : 0) + 'deg)'; state[which] = open ? 'open' : 'closed'; hud(); };
  const lcd = (a, b) => { refs.lcd[0].textContent = a; refs.lcd[1].textContent = b; state.lcd = [a, b]; if (lm1) { lm1.textContent = (a + ' '.repeat(16)).slice(0, 16); lm2.textContent = (b + ' '.repeat(16)).slice(0, 16); } };
  const led = (i, on) => { refs.leds[i].classList.toggle('on', on); state.occ[i] = on; hud(); };
  const lights = on => { world.classList.toggle('lights', on); stage.classList.toggle('dark', !on && mode === 'demo'); state.light = on; hud(); };
  async function press(k, t) { const s = refs.keys[k]; s.classList.add('k'); await sleep(260, t); s.classList.remove('k'); await sleep(140, t); }
  const say = txt => { capText.textContent = txt; const li = document.createElement('li'); li.textContent = txt; logEl.prepend(li); while (logEl.children.length > 8) logEl.lastChild.remove(); };

  /* ---------- state + panel ---------- */
  const state = { occ: [true, false, true, false], booked: 1, entry: 'closed', exit: 'closed', light: false, gas: 'normal', lcd: ['PARKORA', ''] };
  let mode = 'build', step = 0, playing = null, exploded = false, lm1 = null, lm2 = null;
  aside.innerHTML = '<h2>3D model</h2><p class="lead muted">Watch the garage being built part by part, then run it.</p>';
  const seg = el('div', 'seg', aside);
  const bBuild = el('button', null, seg, 'Build'), bDemo = el('button', null, seg, 'Live demo');
  const buildBox = el('div', null, aside), demoBox = el('div', null, aside);

  // build panel
  const ctrl = el('div', 'row', buildBox);
  const bPlay = el('button', 'btn pri', ctrl, 'Assemble'); const bPrev = el('button', 'btn', ctrl, 'Previous'); const bNext = el('button', 'btn', ctrl, 'Next');
  const opts = el('div', null, buildBox); opts.style.marginTop = '10px';
  const mk = (txt, on, fn) => { const l = el('label', 'chk', opts); const i = el('input', null, l); i.type = 'checkbox'; i.checked = on; el('span', null, l).textContent = txt; i.onchange = () => fn(i.checked); return i; };
  mk('Exploded view', false, v => { exploded = v; render(); });
  const labChk = mk('Show labels', true, v => stage.classList.toggle('nolabels', !v));
  const matRow = el('label', 'chk', opts); el('span', null, matRow).textContent = 'Model material';
  const sel = el('select', 'tb', matRow); sel.innerHTML = '<option value="wood">Wood (MDF)</option><option value="pla">3D print (PLA)</option>';
  sel.onchange = () => { world.classList.remove('wood', 'pla'); world.classList.add(sel.value); };
  el('h3', null, buildBox).textContent = 'Assembly steps';
  const ol = el('ol', 'steps', buildBox);
  const stepLis = STEPS.map((s, i) => { const li = el('li', null, ol); li.innerHTML = '<b></b><br><span class="muted"></span>'; li.querySelector('b').textContent = s.t; li.querySelector('span').textContent = s.d; li.onclick = () => { stopPlay(); go(i); }; return li; });

  // demo panel
  el('p', 'muted', demoBox).textContent = 'Each scenario runs the same logic as the firmware. Drag the model to watch from any side.';
  const scnBox = el('div', 'scn', demoBox);
  const scnBtns = SCEN.map(s => { const b = el('button', null, scnBox); b.innerHTML = '<b></b><small></small>'; b.querySelector('b').textContent = s.t; b.querySelector('small').textContent = s.s; b.onclick = () => runScenario(s.id, b); return b; });
  el('h3', null, demoBox).textContent = 'LCD right now';
  const lcdMirror = el('div', 'lcd', demoBox); lm1 = el('div', null, lcdMirror); lm2 = el('div', null, lcdMirror);
  el('h3', null, demoBox).textContent = 'Live status';
  const hudT = el('table', 'kv', demoBox); const hudB = el('tbody', null, hudT);
  el('h3', null, demoBox).textContent = 'What just happened';
  const logEl = el('ul', 'log', demoBox);
  function hud() {
    const free = state.occ.filter(o => !o).length;
    const rows = [['Slots', state.occ.map((o, i) => 'P' + (i + 1) + (o ? ' ■' : ' □')).join('  ')], ['Free for walk-ins', String(Math.max(0, free - (state.booked >= 0 && !state.occ[state.booked] ? 1 : 0)))], ['Booked', state.booked >= 0 ? 'P' + (state.booked + 1) : '—'], ['Entry gate', state.entry], ['Exit gate', state.exit], ['Light', state.light ? 'on' : 'off'], ['Gas', state.gas]];
    hudB.innerHTML = ''; rows.forEach(r => { const tr = el('tr', null, hudB); el('td', null, tr).textContent = r[0]; el('td', null, tr).textContent = r[1]; });
  }

  function render() {
    STEPS.forEach((s, i) => {
      const part = parts[s.k], inn = mode === 'demo' || i <= step;
      part.classList.toggle('out', !inn);
      part.style.transform = !inn ? 'translate3d(0,-700px,0)' : (exploded && mode === 'build' ? 'translate3d(0,' + (-LIFT[s.k]) + 'px,0)' : 'none');
      part.classList.toggle('hl-part', mode === 'build' && i === step && step < STEPS.length - 1);
    });
    stepLis.forEach((li, i) => li.className = i === step ? 'cur' : '');
    const showCars = mode === 'demo' || step >= STEPS.length - 1;
    if (showCars && !cars.a.el.style.display.length) {}
    if (showCars) { if (cars.a.el.style.display === 'none') place(cars.a, { x: BAYS[0], z: BAY_Z, h: 0 }); if (cars.b.el.style.display === 'none') place(cars.b, { x: BAYS[2], z: BAY_Z, h: 0 }); }
    else { cars.a.el.style.display = 'none'; cars.b.el.style.display = 'none'; }
    const ex = exploded && mode === 'build' ? -LIFT.final : 0;
    [cars.a, cars.b].forEach(c => { if (c.el.style.display !== 'none') c.el.style.transform = 'translate3d(' + c.x + 'px,' + (-G + ex) + 'px,' + c.z + 'px) rotateY(' + c.h + 'deg)'; });
    if (mode === 'build') { capText.textContent = (step + 1) + ' / ' + STEPS.length + ' · ' + STEPS[step].t + ' — ' + STEPS[step].d; led(0, step >= STEPS.length - 1); led(2, step >= STEPS.length - 1); }
    bPrev.disabled = step === 0; bNext.disabled = step === STEPS.length - 1;
  }
  function go(i) { step = Math.max(0, Math.min(STEPS.length - 1, i)); render(); }
  function stopPlay() { if (playing) clearInterval(playing); playing = null; bPlay.textContent = 'Assemble'; }
  bPlay.onclick = () => {
    if (playing) return stopPlay();
    if (step >= STEPS.length - 1) go(0);
    bPlay.textContent = 'Pause';
    playing = setInterval(() => { if (step >= STEPS.length - 1) return stopPlay(); go(step + 1); }, 1700);
  };
  bPrev.onclick = () => { stopPlay(); go(step - 1); };
  bNext.onclick = () => { stopPlay(); go(step + 1); };

  function setMode(m) {
    mode = m; token++; stopPlay();
    bBuild.setAttribute('aria-pressed', m === 'build'); bDemo.setAttribute('aria-pressed', m === 'demo');
    buildBox.style.display = m === 'build' ? '' : 'none'; demoBox.style.display = m === 'demo' ? '' : 'none';
    resetDemo();
    stage.classList.toggle('nolabels', m === 'demo' || !labChk.checked);
    if (m === 'build') { stage.classList.remove('dark'); world.classList.remove('lights'); render(); }
    else { render(); lights(false); capText.textContent = 'Pick a scenario on the right.'; }
  }
  bBuild.onclick = () => setMode('build'); bDemo.onclick = () => setMode('demo');

  function resetDemo() {
    token++;
    stage.classList.remove('alarmon'); world.classList.remove('gas');
    [cars.c, cars.d].forEach(c => c.el.style.display = 'none'); person.style.display = 'none';
    if (mode === 'demo' || step >= STEPS.length - 1) { place(cars.a, { x: BAYS[0], z: BAY_Z, h: 0 }); place(cars.b, { x: BAYS[2], z: BAY_Z, h: 0 }); }
    Object.assign(state, { occ: [true, false, true, false], booked: 1, gas: 'normal' });
    refs.bays.forEach((b, i) => b.classList.toggle('res', i === 1));
    [0, 1, 2, 3].forEach(i => led(i, state.occ[i]));
    arm('entry', false); arm('exit', false);
    refs.usBeam.classList.remove('on'); refs.exitBeam.classList.remove('on'); refs.buz.classList.remove('on');
    lcd('PARKORA', 'Free 1 of 4');
    scnBtns.forEach(b => b.setAttribute('aria-pressed', 'false'));
    hud();
  }

  /* ---------- scenarios ---------- */
  async function arrive(c, t) {
    place(c, { x: ENTRY_X, z: 390, h: 0 });
    say('A car drives up to the entry barrier.');
    await move(c, { z: 262 }, 1800, t);
    refs.usBeam.classList.add('on'); say('HC-SR04 reads 6 cm — car detected.');
    await sleep(500, t);
    lcd('Welcome! Free:1', 'A=Walk-in PIN+#'); say('LCD asks: A for walk-in, or PIN then #.');
    await sleep(900, t);
  }
  async function driveIn(c, bay, t) {
    arm('entry', true); lights(true); say('Entry servo turns to 90° — barrier up. Motion turns the light on.');
    await sleep(700, t);
    await move(c, { z: 110 }, 1500, t); refs.usBeam.classList.remove('on');
    await move(c, { h: -90 }, 600, t);
    say('Ultrasonic clear for 2 s → barrier down.'); arm('entry', false); lcd('PARKORA', 'Welcome in');
    await move(c, { x: BAYS[bay] }, Math.abs(BAYS[bay] - ENTRY_X) * 6, t);
    await move(c, { h: 0 }, 600, t);
    await move(c, { z: BAY_Z }, 1500, t);
    led(bay, true); say('P' + (bay + 1) + ' sensor goes LOW → red LED on, dashboard updates.');
  }
  async function runScenario(id, btn) {
    resetDemo(); const t = token;
    btn.setAttribute('aria-pressed', 'true'); logEl.innerHTML = '';
    try {
      if (id === 'booked') {
        await arrive(cars.c, t);
        let typed = ''; for (const k of '4821') { await press(k, t); typed += '*'; lcd('Enter PIN', 'PIN: ' + typed); }
        await press('#', t); say('Driver types 4821 #. ESP32 compares the PIN hash with the active booking.');
        await sleep(500, t); lcd('Booking OK', 'Go to slot P2'); say('Match → “Go to slot P2”.');
        state.booked = -1; refs.bays[1].classList.remove('res'); hud();
        await sleep(900, t); await driveIn(cars.c, 1, t);
        lcd('PARKORA', 'Free 1 of 4'); say('Done. The booking is marked arrived.');
      } else if (id === 'walkin') {
        await arrive(cars.d, t);
        await press('A', t); say('Driver presses A. Free (2) − bookings (1) = 1 → allowed.');
        lcd('Gate opening...', 'Free: P4'); await sleep(900, t);
        await driveIn(cars.d, 3, t);
        lcd('PARKORA', 'Free 0 of 4'); say('Walk-in parked in P4. Only the booked P2 is left.');
      } else if (id === 'wrong') {
        await arrive(cars.c, t);
        for (let n = 1; n <= 3; n++) {
          let typed = ''; for (const k of '1111') { await press(k, t); typed += '*'; lcd('Enter PIN', 'PIN: ' + typed); }
          await press('#', t); refs.buz.classList.add('on');
          if (n < 3) { lcd('Wrong PIN (' + n + '/3)', 'Try again'); say('Wrong PIN ' + n + ' of 3 — triple beep.'); }
          await sleep(700, t); refs.buz.classList.remove('on');
        }
        lcd('Locked 30s', 'Too many tries'); say('Third wrong PIN → keypad locked 30 s, pin_fail event sent to the dashboard.');
        await sleep(2600, t); lcd('Welcome! Free:1', 'A=Walk-in PIN+#'); say('After 30 s the keypad works again. The barrier never opened.');
      } else if (id === 'leave') {
        const c = cars.a; say('The red car in P1 starts to leave.'); lights(true);
        await move(c, { z: 110 }, 1500, t); led(0, false); say('P1 sensor clears → LED off, slot free on the dashboard.');
        await move(c, { h: -90 }, 600, t);
        await move(c, { x: EXIT_X }, (EXIT_X - BAYS[0]) * 5, t);
        await move(c, { h: 180 }, 700, t);
        await move(c, { z: 160 }, 700, t);
        refs.exitBeam.classList.add('on'); say('Exit IR blocked → exit servo opens. No PIN needed to leave.');
        arm('exit', true); lcd('PARKORA', 'Free 2 of 4'); await sleep(800, t);
        await move(c, { z: 390 }, 1600, t); refs.exitBeam.classList.remove('on');
        c.el.style.display = 'none'; say('Exit clear for 2 s → barrier down, exit event logged.');
        await sleep(600, t); arm('exit', false);
      } else if (id === 'gas') {
        say('Smoke reaches the MQ-2 on the left wall.'); world.classList.add('gas');
        await sleep(1800, t);
        state.gas = 'ALARM'; stage.classList.add('alarmon'); refs.buz.classList.add('on'); lights(true);
        lcd('!! GAS ALERT !!', 'EVACUATE NOW'); arm('exit', true);
        say('3 readings above threshold → siren, lights on, exit gate opens, entry locked, Telegram alert + dashboard banner.');
        await sleep(5200, t);
        world.classList.remove('gas'); say('Smoke clears. Readings stay under the threshold…');
        await sleep(2400, t);
        stage.classList.remove('alarmon'); refs.buz.classList.remove('on'); state.gas = 'normal'; arm('exit', false); lcd('PARKORA', 'Free 1 of 4');
        say('10 s below threshold → back to normal. The alert stays on the dashboard until acknowledged.');
      } else if (id === 'pir') {
        lights(false); place(personObj, { x: -120, z: 140, h: -90 }); say('The garage is dark — the light is off to save energy.');
        await sleep(1000, t);
        const walk = move(personObj, { x: 150 }, 4200, t);
        await sleep(700, t); lights(true); say('PIR detects motion → light on, 30 s timer starts.');
        await walk; person.style.display = 'none';
        for (let s = 30; s > 0; s -= 5) { capText.textContent = 'No motion · light off in ' + s + ' s (sped up)'; await sleep(600, t); }
        lights(false); say('30 s without motion → light off.');
      }
    } catch (e) { if (e !== 'cancel') throw e; }
  }

  setMode('build'); go(0);
  // auto-play the assembly once on open
  setTimeout(() => { if (mode === 'build' && step === 0 && !playing) bPlay.onclick(); }, 600);

  return () => { token++; stopPlay(); ro.disconnect(); host.innerHTML = ''; };
}
window.Parkora3D = { mount };
})();
