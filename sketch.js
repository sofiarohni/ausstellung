// BERÜHRUNG — v25
// Samsung Flip Pro WM55B · 3840 × 2160 · 55"
// Fonts: Averia Serif Libre Bold Italic + Degular Mono (UI)

let counter = 2617;
let started = false;
let nodes = [];
let edges = [];
let touchCount = 0;
let finished = false;
let finishTime = 0;
let restartAlpha = 0;
let restarting = false;
let imgBg;
let photos = [];

let activePresses = {};
const B = [0, 0, 255];

let SF = 1;
function sc(v) { return v * SF; }

const BAR_H_BASE  = 50;
const MAX_DOT_R   = 350;
const MAX_WORD_FS = 300;
const MAX_PHOTO_W = 550;
const GROW_RATE   = 1.25;

const K_NEAREST = 3;
const MAX_DIST  = 900;

const WORDS_START = [
  "Wärme","Haut","Hand","Finger","Wange","Schulter","Rücken","Puls",
  "Nähe","Umarmung","Halten","Sanft","Weich","Kribbeln","Gänsehaut",
  "Geborgen","Vertraut","Zuhause","Ankommen","Da sein","Bei dir","Ganz nah",
];
const WORDS_MIDDLE = [
  "Puls","Atmung","Zittern","Kribbeln","Gänsehaut","Innenraum","Spüren",
  "Ausbreiten","Nachhallen","Still","Schwere","Getragen","Umhüllt",
  "Eingehüllt","Aufgehen","Versinken","Verdichten","Zu nah","Zu viel",
];
const WORDS_END = [
  "Glas","Display","Oberfläche","Glatt","Kalt","Still","Lautlos","Wischen",
  "Tippen","Scrollen","Endlos","Fläche","Gleiten","Spurlos","Verblassen",
  "Schatten","Abbild","Simulation","Echo","Schnell",
];

const REPULSION   = 70000;
const ATTRACTION  = 0.0014;
const DAMPING     = 0.96;
const EDGE_LEN    = 600;
const LIFE_STABLE = 240000;
const LIFE_FADE   = 15000;

let onboardPhase     = 0;
let onboardHintTimer = 0;

// ── Blur-Übergang ─────────────────────────────────────────────────────────────
let exitAnim  = false;
let exitStart = 0;
const EXIT_DURATION = 1600; // ms — langsamer Zoom

let restartBtnVisible = false;
let restartBtnX, restartBtnY, restartBtnW, restartBtnH;

let toastMsg = "";
let toastTimer = 0;
let toast33Shown = false;
let toast66Shown = false;
const TOAST_DURATION = 3500;
let counterFlash = 0;

let lastInteraction = 0;
const IDLE_TIMEOUT  = 300000;

let endPulsesReady      = false;
let endCounterStartTime = 0;
const END_COUNTER_DURATION = 2500;

function preload() {
  imgBg = loadImage("bg.png");
  for (let i = 1; i <= 9; i++) photos[i - 1] = loadImage(`skin0${i}.webp`);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  imageMode(CENTER);
  SF = min(windowWidth, windowHeight) / 1080;
  frameRate(30);
  lastInteraction = millis();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  SF = min(windowWidth, windowHeight) / 1080;
  endPulsesReady = false;
}

function resetAll() {
  counter = 2617;
  started = false;
  nodes   = [];
  edges   = [];
  touchCount    = 0;
  finished      = false;
  finishTime    = 0;
  restartAlpha  = 0;
  restarting    = false;
  activePresses = {};
  onboardPhase  = 0;
  onboardHintTimer  = 0;
  restartBtnVisible = false;
  exitAnim  = false;
  exitStart = 0;
  toastMsg  = "";
  toastTimer    = 0;
  toast33Shown  = false;
  toast66Shown  = false;
  // Zoom-Transform zurücksetzen
  let canvas = document.querySelector('canvas');
  if (canvas) { canvas.style.transform = ''; canvas.style.opacity = ''; }
}

// ── Draw ───────────────────────────────────────────────────────────────────────
function draw() {
  background(255);

  if (restarting) {
    fill(255, restartAlpha);
    noStroke();
    rect(0, 0, width, height);
    restartAlpha += 5;
    if (restartAlpha >= 255) resetAll();
    return;
  }

  if (started && !finished && !restarting) {
    if (millis() - lastInteraction > IDLE_TIMEOUT) {
      restarting = true; restartAlpha = 0;
    }
  }

  if (!started) {
    drawStartScreen();
    return;
  }

  if (finished) { drawEndScreen(); return; }

  for (let key in activePresses) {
    let p = activePresses[key];
    if (p.nodeIdx >= 0 && p.nodeIdx < nodes.length) {
      let n = nodes[p.nodeIdx];
      if (!n.hit) growNode(n);
    }
  }

  for (let i = nodes.length - 1; i >= 0; i--) {
    if (getDecay(nodes[i]) >= 1) {
      nodes.splice(i, 1);
      for (let key in activePresses) {
        if (activePresses[key].nodeIdx === i)     activePresses[key].nodeIdx = -1;
        else if (activePresses[key].nodeIdx > i)  activePresses[key].nodeIdx--;
      }
    }
  }

  applyForces();
  drawEdges();
  for (let n of nodes) drawNode(n);
  drawUI();
  drawToast();

  if (onboardPhase === 1 && onboardHintTimer === true) drawHoldHint();
}

// ── Startscreen ────────────────────────────────────────────────────────────────
function drawStartScreen() {
  let cx = width / 2;
  let cy = height / 2;
  let t  = millis();

  // Blur via CSS-Filter auf Canvas
  // Zoom-In Transition: Canvas wird in die Mitte hinein gezoomt (skaliert hoch)
  // und faded gleichzeitig aus → wirkt als würde man in den weißen Bereich eintauchen
  if (exitAnim) {
    let progress = min(1, (t - exitStart) / EXIT_DURATION);
    let eased    = progress < 0.5
      ? 2 * progress * progress
      : 1 - pow(-2 * progress + 2, 2) / 2; // ease-in-out
    // Zoom: von 1x auf 2x, alpha faded erst in der zweiten Hälfte aus
    let zoom   = 1 + eased * 1.0;
    let alphaV = progress < 0.3 ? 1 : 1 - ((progress - 0.3) / 0.7);
    let canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.style.transformOrigin = '50% 50%';
      canvas.style.transform       = `scale(${zoom})`;
      canvas.style.opacity         = alphaV;
    }
    if (progress >= 1) {
      exitAnim = false;
      started  = true;
      onboardPhase     = 1;
      onboardHintTimer = true;
      if (canvas) {
        canvas.style.transform = '';
        canvas.style.opacity   = '';
      }
      return;
    }
  }

  // ── Schicht 1: bg.png ─────────────────────────────────────────────────────
  if (imgBg) {
    let imgAspect = imgBg.width / imgBg.height;
    let scrAspect = width / height;
    let drawW, drawH;
    if (scrAspect > imgAspect) { drawW = width;  drawH = width / imgAspect; }
    else                       { drawH = height; drawW = height * imgAspect; }
    image(imgBg, cx, cy, drawW, drawH);
  }

  // ── Schicht 2: blauer Blob — atmet nur, keine Ringe ─────────────────────
  let baseR   = min(width, height) * 0.52;
  let pulse   = sin(t * 0.0018) * 0.05;
  let circleR = baseR * (1 + pulse);

  let grad = drawingContext.createRadialGradient(cx, cy, 0, cx, cy, circleR);
  grad.addColorStop(0,    "rgba(0,0,255,1)");
  grad.addColorStop(0.65, "rgba(0,0,255,0.95)");
  grad.addColorStop(0.88, "rgba(0,0,255,0.45)");
  grad.addColorStop(1.0,  "rgba(0,0,255,0)");
  drawingContext.fillStyle = grad;
  drawingContext.beginPath();
  drawingContext.arc(cx, cy, circleR, 0, Math.PI * 2);
  drawingContext.fill();

  // ── Schicht 3: „2617" groß weiß zentriert auf dem blauen Kreis ──────────
  let numFS = sc(400);
  drawingContext.save();
  drawingContext.font = `900 italic ${numFS}px 'Averia Serif Libre', serif`;
  drawingContext.letterSpacing = "-0.04em";
  drawingContext.textAlign = "center";
  drawingContext.textBaseline = "middle";
  // Weiße Kontur — dick genug dass sich Ziffern überlappen, aber Zahl noch lesbar
  drawingContext.strokeStyle = "rgba(255,255,255,1)";
  drawingContext.lineWidth   = sc(52);
  drawingContext.lineJoin    = "round";
  drawingContext.strokeText("2617", cx, cy);
  // Füllung oben drauf
  drawingContext.fillStyle = "rgba(255,255,255,1)";
  drawingContext.fillText("2617", cx, cy);
  drawingContext.restore();

  // ── Schicht 4: Wortboxen mit Verbindungslinien ───────────────────────────
  let fs  = sc(52);
  let pad = sc(8);
  drawingContext.save();
  drawingContext.font = `400 ${fs}px 'degular-mono', monospace`;
  drawingContext.letterSpacing = "0.04em";
  drawingContext.textBaseline = "alphabetic";
  drawingContext.textAlign = "left";

  let labels = [
    { text: "Spür", x: width * 0.19, y: height * 0.38 },
    { text: "mal",  x: width * 0.34, y: height * 0.44 },
    { text: "nach", x: width * 0.63, y: height * 0.74 },
  ];

  let boxes = labels.map(lb => {
    let tw = drawingContext.measureText(lb.text).width;
    return {
      text: lb.text,
      x: lb.x, y: lb.y,
      w: tw + pad * 2,
      h: fs + pad * 2,
      cx: lb.x - pad + (tw + pad * 2) / 2,
      cy: lb.y - fs - pad + (fs + pad * 2) / 2,
    };
  });

  // Spür → mal: gestrichelt
  drawingContext.setLineDash([sc(0.5), sc(10)]);
  drawingContext.strokeStyle = "rgba(255,255,255,1)";
  drawingContext.lineWidth = sc(5);
  drawingContext.beginPath();
  drawingContext.moveTo(boxes[0].cx + boxes[0].w / 2, boxes[0].cy);
  drawingContext.lineTo(boxes[1].cx - boxes[1].w / 2, boxes[1].cy);
  drawingContext.stroke();

  // mal → nach: durchgehend
  drawingContext.setLineDash([]);
  drawingContext.beginPath();
  drawingContext.moveTo(boxes[1].cx + boxes[1].w / 2, boxes[1].cy);
  drawingContext.lineTo(boxes[2].cx - boxes[2].w / 2, boxes[2].cy);
  drawingContext.stroke();

  for (let b of boxes) {
    drawingContext.fillStyle = "rgba(255,255,255,1)";
    drawingContext.fillRect(b.x - pad, b.y - fs - pad, b.w, b.h);
    drawingContext.fillStyle = "rgb(0,0,255)";
    drawingContext.fillText(b.text, b.x, b.y);
  }

  drawingContext.restore();
}

// ── Physik & Nodes ─────────────────────────────────────────────────────────────
function getDecay(n) {
  let age = millis() - n.born;
  if (age < LIFE_STABLE) return 0;
  return min(1, (age - LIFE_STABLE) / LIFE_FADE);
}

function growNode(n) {
  if (n.kind === "dot") {
    n.rx = min(n.rx + GROW_RATE * n.stretchX, sc(MAX_DOT_R) * n.stretchX);
    n.ry = min(n.ry + GROW_RATE * n.stretchY, sc(MAX_DOT_R) * n.stretchY);
  } else if (n.kind === "word") {
    n.fontSize = min(n.fontSize + GROW_RATE * 0.5 * ((n.stretchX + n.stretchY) / 2), sc(MAX_WORD_FS));
    n.scaleX = n.stretchX; n.scaleY = n.stretchY;
  } else if (n.kind === "photo") {
    n.pw = min(n.pw + GROW_RATE * 2 * n.stretchX, sc(MAX_PHOTO_W) * n.stretchX);
    n.ph = min(n.ph + GROW_RATE * 2 * n.stretchY, sc(MAX_PHOTO_W) * 1.4 * n.stretchY);
  }
}

function randomStretch() {
  let r = random();
  if (r < 0.33) return { sx: random(1.2, 2.2), sy: random(0.6, 1.0) };
  if (r < 0.66) return { sx: random(0.6, 1.0), sy: random(1.2, 2.4) };
  let u = random(0.8, 1.3);
  return { sx: u, sy: u };
}

function getWord() {
  let progress = 1 - counter / 3311;
  let list = progress < 0.33 ? WORDS_START : progress < 0.66 ? WORDS_MIDDLE : WORDS_END;
  return list[floor(random(list.length))];
}

function createNode(x, y) {
  let roll = random();
  let kind = roll < 0.4 ? "dot" : roll < 0.75 ? "word" : "photo";
  let st   = randomStretch();
  let initR = sc(12);
  let selectedPhoto = photos[floor(random(photos.length))];
  return {
    x: x + random(-sc(80), sc(80)),
    y: y + random(-sc(80), sc(80)),
    vx: 0, vy: 0,
    born: millis(),
    kind, pulse: 0, hit: false,
    stretchX: st.sx, stretchY: st.sy,
    scaleX: 1, scaleY: 1,
    rx: kind === "dot" ? initR * st.sx : 0,
    ry: kind === "dot" ? initR * st.sy : 0,
    fontSize: kind === "word" ? sc(9) : 0,
    weight: [100,200,300,400,700,900][floor(random(6))],
    letterSpacing: [-0.02,0,0.06,0.14,0.22][floor(random(5))],
    inverted: kind === "word" && random() < 0.15,
    pw: kind === "photo" ? sc(50) : 0,
    ph: kind === "photo" ? sc(50) * (selectedPhoto ? selectedPhoto.height / selectedPhoto.width : 1.3) : 0,
    tinted:   kind === "photo" && random() < 0.25,
    scanLine: kind === "photo" && random() < 0.35,
    accent: false,
    word: getWord(),
    photo: kind === "photo" ? selectedPhoto : null,
  };
}

function addEdges(newNode) {
  let maxD = sc(MAX_DIST);
  let candidates = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    let d = dist(newNode.x, newNode.y, nodes[i].x, nodes[i].y);
    if (d < maxD) candidates.push({ node: nodes[i], d });
  }
  candidates.sort((a, b) => a.d - b.d);
  for (let { node } of candidates.slice(0, K_NEAREST))
    edges.push({ a: newNode, b: node, born: millis() });
}

function drawEdges() {
  edges = edges.filter(e => nodes.includes(e.a) && nodes.includes(e.b));
  for (let e of edges) {
    let fadeA = min(1, ((millis() - e.a.born) / 1000) * 2.5);
    let fadeB = min(1, ((millis() - e.b.born) / 1000) * 2.5);
    let fadeE = min(1, ((millis() - e.born)   / 1000) * 2.5);
    let alpha = min(fadeA, fadeB, fadeE);
    if (alpha < 0.01) continue;
    stroke(B[0], B[1], B[2], 220 * alpha);
    strokeWeight(sc(1.3));
    noFill();
    line(e.a.x, e.a.y, e.b.x, e.b.y);
  }
  noStroke();
}

function applyForces() {
  let rep  = REPULSION * SF * SF;
  let maxD = sc(MAX_DIST);

  for (let i = 0; i < nodes.length; i++) {
    let a  = nodes[i];
    let dA = getDecay(a);
    for (let j = i + 1; j < nodes.length; j++) {
      let b  = nodes[j];
      let dx = a.x - b.x, dy = a.y - b.y;
      let d  = max(dist(a.x, a.y, b.x, b.y), 1);
      let f  = rep / (d * d);
      a.vx += (dx / d) * f;  a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f;  b.vy -= (dy / d) * f;
    }
    if (dA > 0) {
      a.vx *= 0.95; a.vy *= 0.95;
    } else {
      a.vx += random(-0.005, 0.005);
      a.vy += random(-0.005, 0.005);
      let cxf = width / 2, cyf = height / 2;
      a.vx += (cxf - a.x) * 0.0006;
      a.vy += (cyf - a.y) * 0.0006;
      let margin = sc(180);
      if (a.x < margin)          a.vx += (margin - a.x)            * 0.03;
      if (a.x > width - margin)  a.vx -= (a.x - (width - margin))  * 0.03;
      if (a.y < margin)          a.vy += (margin - a.y)            * 0.03;
      if (a.y > height - margin) a.vy -= (a.y - (height - margin)) * 0.03;
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    let a = nodes[i];
    let candidates = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      let d = dist(a.x, a.y, nodes[j].x, nodes[j].y);
      if (d < maxD) candidates.push({ b: nodes[j], d });
    }
    candidates.sort((x, y) => x.d - y.d);
    for (let { b, d } of candidates.slice(0, K_NEAREST)) {
      let pull = (1 - max(getDecay(a), getDecay(b))) * ATTRACTION;
      let dx = b.x - a.x, dy = b.y - a.y;
      let len = max(d, 1);
      let dp  = (d - sc(EDGE_LEN)) * pull;
      a.vx += (dx / len) * dp;  a.vy += (dy / len) * dp;
      b.vx -= (dx / len) * dp;  b.vy -= (dy / len) * dp;
    }
  }

  for (let n of nodes) {
    n.vx *= DAMPING; n.vy *= DAMPING;
    n.vx = constrain(n.vx, -15, 15);
    n.vy = constrain(n.vy, -15, 15);
    n.x += n.vx; n.y += n.vy;
    let clamp = sc(20);
    if (n.x < clamp)           { n.x = clamp;           n.vx *= -0.1; }
    if (n.x > width  - clamp)  { n.x = width  - clamp;  n.vx *= -0.1; }
    if (n.y < clamp)           { n.y = clamp;           n.vy *= -0.1; }
    if (n.y > height - clamp)  { n.y = height - clamp;  n.vy *= -0.1; }
  }
}

function drawNode(n) {
  let age    = (millis() - n.born) / 1000;
  let fadeIn = min(1, age * 3);
  let decay  = getDecay(n);
  let alpha  = fadeIn * (1 - decay);
  if (alpha <= 0.01) return;
  let x = n.x, y = n.y;

  if (n.kind === "dot") {
    noStroke();
    let layers = 12;
    for (let s = 0; s < layers; s++) {
      let t  = s / layers;
      let rx = n.rx * (0.05 + t * 0.95);
      let ry = n.ry * (0.05 + t * 0.95);
      let a  = exp(-t * t * 4.5) * 230 * alpha;
      fill(B[0], B[1], B[2], a);
      ellipse(x, y, rx * 2, ry * 2);
    }
  } else if (n.kind === "word") {
    noStroke();
    if (n.inverted) {
      let pad = sc(6);
      let tw  = n.fontSize * n.word.length * 0.62;
      drawingContext.save();
      drawingContext.translate(x, y);
      drawingContext.scale(n.scaleX || 1, n.scaleY || 1);
      drawingContext.fillStyle = `rgba(0,0,255,${0.9 * alpha})`;
      drawingContext.fillRect(-tw/2 - pad, -n.fontSize * 0.72 - pad, tw + pad*2, n.fontSize + pad*2);
      drawingContext.font = `bold italic ${n.fontSize}px 'Averia Serif Libre', serif`;
      drawingContext.letterSpacing = "0.06em";
      drawingContext.textAlign = "center";
      drawingContext.textBaseline = "middle";
      drawingContext.strokeStyle = `rgba(255,255,255,${alpha})`;
      drawingContext.lineWidth = sc(3);
      drawingContext.strokeText(n.word.toUpperCase(), 0, 0);
      drawingContext.fillStyle = `rgba(255,255,255,${alpha})`;
      drawingContext.fillText(n.word.toUpperCase(), 0, 0);
      drawingContext.restore();
    } else {
      drawingContext.save();
      drawingContext.translate(x, y);
      drawingContext.scale(n.scaleX || 1, n.scaleY || 1);
      drawingContext.font = `bold italic ${n.fontSize}px 'Averia Serif Libre', serif`;
      drawingContext.letterSpacing = `${n.letterSpacing || 0.08}em`;
      drawingContext.textAlign = "center";
      drawingContext.textBaseline = "middle";
      drawingContext.strokeStyle = `rgba(0,0,255,${0.12 * alpha})`;
      drawingContext.lineWidth = sc(3);
      drawingContext.strokeText(n.word.toUpperCase(), 0, 0);
      drawingContext.fillStyle = `rgba(0,0,255,${0.95 * alpha})`;
      drawingContext.fillText(n.word.toUpperCase(), 0, 0);
      drawingContext.restore();
    }
  } else if (n.kind === "photo") {
    if (!n.photo) return;
    push();
    translate(x, y);
    noStroke();
    image(n.photo, 0, 0, n.pw, n.ph);
    if (n.scanLine) {
      let scanY = ((millis() * 0.04) % n.ph) - n.ph / 2;
      stroke(255, 255, 255, 80 * alpha);
      strokeWeight(sc(1));
      line(-n.pw / 2, scanY, n.pw / 2, scanY);
    }
    pop();
  }
}

function drawUI() {
  drawingContext.globalAlpha = 1.0;
  let progress = 1 - counter / 2617;
  let BAR_H    = sc(BAR_H_BASE);

  noStroke();
  fill(0, 0, 0, 10);
  rect(0, height - BAR_H, width, BAR_H);
  fill(0, 0, 255);
  rect(0, height - BAR_H, width * progress, BAR_H);

  counterFlash = max(0, counterFlash - 0.06);

  let numStr = counter.toLocaleString("de-DE");
  let numFS  = sc(125);
  let padX   = sc(20);
  let padY   = sc(10);

  drawingContext.save();
  drawingContext.font = `400 ${numFS}px 'degular-mono', monospace`;
  drawingContext.letterSpacing = "-0.03em";
  let textW = drawingContext.measureText(numStr).width;
  let pillW = textW + padX * 2;
  let pillH = numFS + padY * 2;
  let pillX = width - pillW - sc(24);
  let pillY = height - BAR_H - pillH;
  drawingContext.restore();

  noStroke();
  fill(0, 0, 255, 255);
  rect(pillX, pillY, pillW, pillH);

  drawingContext.save();
  drawingContext.fillStyle = "rgb(255,255,255)";
  drawingContext.font = `400 ${numFS}px 'degular-mono', monospace`;
  drawingContext.letterSpacing = "-0.03em";
  drawingContext.textAlign = "right";
  drawingContext.textBaseline = "top";
  drawingContext.fillText(numStr, pillX + pillW - padX, pillY + padY);
  drawingContext.restore();
}

function drawToast() {
  if (!toastMsg || toastTimer === 0) return;
  let age = millis() - toastTimer;
  if (age > TOAST_DURATION) { toastMsg = ""; return; }
  let fadeIn  = min(1, age / 300);
  let fadeOut = age > TOAST_DURATION - 600 ? 1 - (age - (TOAST_DURATION - 600)) / 600 : 1;
  let alpha   = fadeIn * fadeOut;
  let fs  = sc(125);
  let pad = sc(14);
  drawingContext.save();
  drawingContext.font = `400 ${fs}px 'degular-mono', monospace`;
  drawingContext.letterSpacing = "0.04em";
  let tw = drawingContext.measureText(toastMsg).width;
  let bw = tw + pad * 2;
  let bh = fs + pad * 2;
  let bx = width / 2 - bw / 2;
  let by = height / 2 - bh / 2;
  drawingContext.fillStyle = `rgba(0,0,255,${0.9 * alpha})`;
  drawingContext.fillRect(bx, by, bw, bh);
  drawingContext.textAlign = "center";
  drawingContext.textBaseline = "middle";
  drawingContext.fillStyle = `rgba(255,255,255,${alpha})`;
  drawingContext.fillText(toastMsg, width / 2, by + bh / 2);
  drawingContext.restore();
}

function drawHoldHint() {
  let cx = width / 2, cy = height / 2;
  let fs = sc(64);
  drawingContext.save();
  drawingContext.letterSpacing = "0.12em";
  drawingContext.textAlign = "center";
  drawingContext.textBaseline = "middle";
  drawingContext.fillStyle = "rgba(0,0,255,1)";
  drawingContext.font = `700 ${fs}px 'degular-mono', monospace`;
  drawingContext.fillText("Tippe weiter", cx, cy - sc(125));
  drawingContext.font = `400 ${fs}px 'degular-mono', monospace`;
  drawingContext.fillText("2617 Berührungen,", cx, cy);
  drawingContext.fillText("die dich näher bringen", cx, cy + sc(80));
  drawingContext.restore();
}

// ── Endscreen ─────────────────────────────────────────────────────────────────
function initEndPulses() {
  endPulsesReady      = true;
  endCounterStartTime = millis();
}

const END_DOC = [
  { type: "serif-lg",  text: "Das waren fast" },
  { type: "serif-xl",  text: "COUNTER" },
  { type: "serif-lg",  text: "Berührungen an einem Tag." },
  { type: "serif-lg",  text: "Deinem Tag." },
  { type: "gap", h: 48 },
  { type: "sans-body", text: "Gerade eben hast du den Screen berührt." },
  { type: "sans-body", text: "Fast selbstverständlich." },
  { type: "sans-body", text: "Und für einen Moment stellt sich die Frage:" },
  { type: "sans-body", text: "Wofür eigentlich?" },
  { type: "gap", h: 36 },
  { type: "sans-body", text: "Nicht jede Berührung bedeutet Nähe." },
  { type: "sans-body", text: "Nicht jede löst etwas aus." },
  { type: "gap", h: 36 },
  { type: "sans-body", text: "Dabei ist Berührung essenziell." },
  { type: "sans-body", text: "Über die Haut erfahren wir Wärme," },
  { type: "sans-body", text: "Nähe und Vertrauen." },
  { type: "sans-body", text: "Oxytocin entsteht — ein Hormon," },
  { type: "sans-body", text: "das uns verbindet, uns hält." },
  { type: "gap", h: 36 },
  { type: "sans-body", text: "Doch hier bleibt es still." },
  { type: "sans-body", text: "Keine Wärme. Keine Antwort." },
  { type: "sans-body", text: "Nur Oberfläche." },
  { type: "gap", h: 48 },
  { type: "serif-lg",  text: "Sind wir alle ein bisschen" },
  { type: "serif-lg",  text: "out of touch?" },
  { type: "gap", h: 60 },
];

function endDocH(item) {
  const base = {
    "serif-xl": 280, "serif-lg": 150, "sans-body": 90,
    "sans-sm": 80, source: 55, rule: 1, gap: item.h || 20,
  };
  return sc(base[item.type] || 110);
}

function drawEndScreen() {
  background(0, 0, 255);
  let BAR_H = sc(BAR_H_BASE);
  if (!endPulsesReady) initEndPulses();

  let elapsed = (millis() - finishTime) / 1000;
  let totalH  = 0;
  for (let item of END_DOC) totalH += endDocH(item);

  let leftMargin = max(sc(100), width * 0.1);
  let curY       = height / 2 - totalH / 2;
  let delay      = 0.2;

  for (let i = 0; i < END_DOC.length; i++) {
    let item  = END_DOC[i];
    let lh    = endDocH(item);
    let age   = elapsed - i * delay;
    let alpha = min(1, age * 3.5);
    if (alpha <= 0) { curY += lh; continue; }
    let x = leftMargin;

    if (item.type === "gap") {
    } else if (item.type === "rule") {
      stroke(255, 255, 255, 80 * alpha);
      strokeWeight(sc(1));
      line(x, curY + lh / 2, x + width * 0.55, curY + lh / 2);
      noStroke();
    } else {
      noStroke();
      drawingContext.save();
      if (item.type === "serif-xl") {
        let e2617 = millis() - endCounterStartTime;
        let displayStr = item.text === "COUNTER"
          ? Math.min(2617, Math.round((e2617 / END_COUNTER_DURATION) * 2617)).toLocaleString("de-DE")
          : item.text;
        drawingContext.font = `bold italic ${sc(260)}px 'Averia Serif Libre', serif`;
        drawingContext.letterSpacing = "-0.03em";
        drawingContext.textAlign = "left";
        drawingContext.textBaseline = "top";
        drawingContext.strokeStyle = `rgba(255,255,255,${0.15 * alpha})`;
        drawingContext.lineWidth = sc(4);
        drawingContext.strokeText(displayStr, x, curY);
        drawingContext.fillStyle = `rgba(255,255,255,${alpha})`;
        drawingContext.fillText(displayStr, x, curY);
      } else if (item.type === "serif-lg") {
        drawingContext.font = `bold italic ${sc(120)}px 'Averia Serif Libre', serif`;
        drawingContext.letterSpacing = "0.01em";
        drawingContext.textAlign = "left";
        drawingContext.textBaseline = "top";
        drawingContext.strokeStyle = `rgba(255,255,255,${0.08 * alpha})`;
        drawingContext.lineWidth = sc(2);
        drawingContext.strokeText(item.text, x, curY);
        drawingContext.fillStyle = item.highlight
          ? `rgba(255,255,180,${alpha})`
          : `rgba(255,255,255,${0.95 * alpha})`;
        drawingContext.fillText(item.text, x, curY);
      } else if (item.type === "sans-body") {
        drawingContext.font = `400 ${sc(56)}px 'degular-mono', monospace`;
        drawingContext.letterSpacing = "0.02em";
        drawingContext.textAlign = "left";
        drawingContext.textBaseline = "top";
        drawingContext.fillStyle = `rgba(255,255,255,${0.85 * alpha})`;
        drawingContext.fillText(item.text, x, curY);
      } else if (item.type === "sans-sm") {
        drawingContext.font = `400 ${sc(42)}px 'degular-mono', monospace`;
        drawingContext.letterSpacing = "0.03em";
        drawingContext.textAlign = "left";
        drawingContext.textBaseline = "top";
        drawingContext.fillStyle = `rgba(255,255,255,${0.7 * alpha})`;
        drawingContext.fillText(item.text, x, curY);
      } else if (item.type === "source") {
        drawingContext.font = `400 ${sc(32)}px 'degular-mono', monospace`;
        drawingContext.letterSpacing = "0.04em";
        drawingContext.textAlign = "left";
        drawingContext.textBaseline = "top";
        drawingContext.fillStyle = item.dim
          ? `rgba(255,255,255,${0.3 * alpha})`
          : `rgba(255,255,255,${0.45 * alpha})`;
        drawingContext.fillText(item.text, x, curY);
      }
      drawingContext.restore();
    }
    curY += lh;
  }

  let textDone = END_DOC.length * delay + 0.8;
  if (elapsed > textDone) {
    let btnAge = elapsed - textDone;
    let btnA   = min(1, btnAge * 1.2);
    let leftM  = leftMargin;
    let btnY   = curY + sc(32);
    let fs1    = sc(80);
    drawingContext.save();
    drawingContext.font = `400 ${fs1}px 'degular-mono', monospace`;
    drawingContext.letterSpacing = "0.18em";
    let btnText = "Neustart";
    let tw1 = drawingContext.measureText(btnText).width;
    let pad = sc(1);
    restartBtnX = leftM - pad;
    restartBtnY = btnY - fs1 / 2 - pad;
    restartBtnW = tw1 + pad * 2;
    restartBtnH = fs1 + pad * 2;
    restartBtnVisible = true;
    drawingContext.fillStyle = `rgba(255,255,255,${btnA})`;
    drawingContext.fillRect(restartBtnX, restartBtnY, restartBtnW, restartBtnH);
    drawingContext.textAlign = "left";
    drawingContext.textBaseline = "middle";
    drawingContext.fillStyle = `rgba(0,0,255,${btnA})`;
    drawingContext.fillText(btnText, leftM, btnY);
    drawingContext.restore();
  } else {
    restartBtnVisible = false;
  }

  noStroke();
  fill(255, 255, 255, 60);
  rect(0, height - BAR_H, width, BAR_H);
}

// ── Interaktion ────────────────────────────────────────────────────────────────
function pressStart(id, x, y) {
  if (finished) {
    if (
      restartBtnVisible &&
      x >= restartBtnX && x <= restartBtnX + restartBtnW &&
      y >= restartBtnY && y <= restartBtnY + restartBtnH
    ) {
      restarting = true; restartAlpha = 0;
    }
    return;
  }

  if (!started && !exitAnim) {
    lastInteraction = millis();
    exitAnim  = true;
    exitStart = millis();
    return;
  }

  if (exitAnim) return;

  if (onboardHintTimer === true) { onboardHintTimer = false; return; }
  if (counter <= 0) return;

  let dec;
  if (counter <= 3)       dec = 1;
  else if (counter <= 10) dec = floor(random(1, 4));
  else                    dec = floor(random(1, 80));
  counter = max(0, counter - dec);
  touchCount++;
  counterFlash    = 1.0;
  lastInteraction = millis();

  let progress = 1 - counter / 2617;
  if (!toast33Shown && progress >= 0.25) {
    toast33Shown = true; toastMsg = "Du kommst näher!"; toastTimer = millis();
  }
  if (!toast66Shown && progress >= 0.66) {
    toast66Shown = true; toastMsg = "Fast greifbar!"; toastTimer = millis();
  }

  let node = createNode(x, y);
  nodes.push(node);
  addEdges(node);
  activePresses[id] = { nodeIdx: nodes.length - 1 };

  if (counter <= 0 && !finished) {
    setTimeout(() => { finished = true; finishTime = millis(); }, 2000);
  }
}

function pressEnd(id) { delete activePresses[id]; }

function mousePressed()  { pressStart("mouse", mouseX, mouseY); }
function mouseReleased() { pressEnd("mouse"); }

function touchStarted() {
  for (let t of touches) pressStart(t.id, t.x, t.y);
  return false;
}
function touchEnded() {
  let activeIds = new Set(touches.map(t => t.id));
  for (let key in activePresses) {
    if (key !== "mouse" && !activeIds.has(parseInt(key))) pressEnd(key);
  }
  return false;
}
