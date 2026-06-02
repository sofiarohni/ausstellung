// BERÜHRUNG — v20
// Samsung Flip Pro WM55B · 3840 × 2160 · 55"
// Fonts: Averia Serif Libre Bold Italic (Überschriften + Wörter) + Degular Mono (UI)

let counter = 2617;
let started = false;
let nodes = [];
let edges = [];
let touchCount = 0;
let finished = false;
let finishTime = 0;
let restartAlpha = 0;
let restarting = false;
let startImg;
let photos = [];

let activePresses = {};
const B = [0, 0, 255];

// ── 4K-Skalierung ─────────────────────────────────────────────────────────────
let SF = 1;
function sc(v) {
  return v * SF;
}

const BAR_H_BASE = 50;
const MAX_DOT_R = 350;
const MAX_WORD_FS = 300;
const MAX_PHOTO_W = 550;
const GROW_RATE = 1.25;

// ── Verbindungen ──────────────────────────────────────────────────────────────
const K_NEAREST = 3; // Anzahl Verbindungen pro Node
const MAX_DIST = 900; // Maximale Verbindungsdistanz (vor Skalierung)

// ── Wortlisten ────────────────────────────────────────────────────────────────
const WORDS_START = [
  "Wärme",
  "Haut",
  "Hand",
  "Finger",
  "Wange",
  "Schulter",
  "Rücken",
  "Puls",
  "Nähe",
  "Umarmung",
  "Halten",
  "Sanft",
  "Weich",
  "Kribbeln",
  "Gänsehaut",
  "Geborgen",
  "Vertraut",
  "Zuhause",
  "Ankommen",
  "Da sein",
  "Bei dir",
  "Ganz nah",
];
const WORDS_MIDDLE = [
  "Puls",
  "Atmung",
  "Zittern",
  "Kribbeln",
  "Gänsehaut",
  "Innenraum",
  "Spüren",
  "Ausbreiten",
  "Nachhallen",
  "Still",
  "Schwere",
  "Getragen",
  "Umhüllt",
  "Eingehüllt",
  "Aufgehen",
  "Versinken",
  "Verdichten",
  "Zu nah",
  "Zu viel",
];
const WORDS_END = [
  "Glas",
  "Display",
  "Oberfläche",
  "Glatt",
  "Kalt",
  "Still",
  "Lautlos",
  "Wischen",
  "Tippen",
  "Scrollen",
  "Weiter",
  "Endlos",
  "Fläche",
  "Gleiten",
  "Spurlos",
  "Verblassen",
  "Schatten",
  "Abbild",
  "Simulation",
  "Echo",
  "Schnell",
];

// ── Physik-Konstanten ─────────────────────────────────────────────────────────
const REPULSION = 70000;
const ATTRACTION = 0.0014;
const DAMPING = 0.96;
const EDGE_LEN = 600;

const LIFE_STABLE = 999999999;
const LIFE_FADE = 999999999;

// ── Kachel-Animation ──────────────────────────────────────────────────────────
let tiles = [];
let tilesAnimating = false;
let tileStartTime = 0;
const TILE_COLS = 6;
const TILE_ROWS = 7;

// ── Onboarding ────────────────────────────────────────────────────────────────
let onboardPulses = [];
let onboardVisible = true;
let onboardPhase = 0;
let onboardHintTimer = 0;

// ── Restart-Button ────────────────────────────────────────────────────────────
let restartBtnVisible = false;
let restartBtnX, restartBtnY, restartBtnW, restartBtnH;

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastMsg = "";
let toastTimer = 0;
let toast33Shown = false;
let toast66Shown = false;
const TOAST_DURATION = 3500;

let counterFlash = 0;

// ── Inaktivitäts-Reset ───────────────────────────────────────────────────────
let lastInteraction = 0;
const IDLE_TIMEOUT = 300000;

// ── Endscreen ─────────────────────────────────────────────────────────────────
let endPulsesReady = false;

// ── Laden ─────────────────────────────────────────────────────────────────────

function preload() {
  photos[0] = loadImage("skin01.webp");
  photos[1] = loadImage("skin02.webp");
  photos[2] = loadImage("skin03.webp");
  photos[3] = loadImage("skin04.webp");
  photos[4] = loadImage("skin05.webp");
  photos[5] = loadImage("skin06.webp");
  photos[6] = loadImage("skin07.webp");
  photos[7] = loadImage("skin08.webp");
  photos[8] = loadImage("skin09.webp");
  startImg = loadImage("start.jpg");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  imageMode(CENTER);
  SF = min(windowWidth, windowHeight) / 1080;
  spawnOnboardPulses();
  lastInteraction = millis();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  SF = min(windowWidth, windowHeight) / 1080;
  spawnOnboardPulses();
  endPulsesReady = false;
}

// ── Reset ─────────────────────────────────────────────────────────────────────

function resetAll() {
  counter = 2617;
  started = false;
  nodes = [];
  edges = [];
  touchCount = 0;
  finished = false;
  finishTime = 0;
  restartAlpha = 0;
  restarting = false;
  activePresses = {};
  onboardVisible = true;
  onboardPhase = 0;
  onboardHintTimer = 0;
  restartBtnVisible = false;
  tiles = [];
  tilesAnimating = false;
  toastMsg = "";
  toastTimer = 0;
  toast33Shown = false;
  toast66Shown = false;
  spawnOnboardPulses();
}

// ── Draw ──────────────────────────────────────────────────────────────────────

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

  // Idle-Reset: wenn gestartet und zu lange keine Berührung
  if (started && !finished && !restarting && !tilesAnimating) {
    if (millis() - lastInteraction > IDLE_TIMEOUT) {
      restarting = true;
      restartAlpha = 0;
    }
  }

  if (!started || tilesAnimating) {
    drawStartScreen();
    if (tilesAnimating) drawTilesFadeOut();
    return;
  }

  if (finished) {
    drawEndScreen();
    return;
  }

  // Aktive Berührungen wachsen lassen
  for (let key in activePresses) {
    let p = activePresses[key];
    if (p.nodeIdx >= 0 && p.nodeIdx < nodes.length) {
      let n = nodes[p.nodeIdx];
      if (!n.hit) growNode(n);
    }
  }

  // Abgelaufene Nodes entfernen
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (getDecay(nodes[i]) >= 1) {
      nodes.splice(i, 1);
      for (let key in activePresses) {
        if (activePresses[key].nodeIdx === i) activePresses[key].nodeIdx = -1;
        else if (activePresses[key].nodeIdx > i) activePresses[key].nodeIdx--;
      }
    }
  }

  applyForces();
  drawEdges();
  for (let n of nodes) drawNode(n);
  drawUI();
  drawToast();

  if (onboardPhase === 1 && onboardHintTimer === true) {
    drawHoldHint();
  }
}

// ── Verbindungen (dynamisch, nächste Nachbarn) ────────────────────────────────

// Beim Erstellen eines neuen Nodes: Verbindungen zu K_NEAREST Nachbarn speichern
function addEdges(newNode) {
  let maxD = sc(MAX_DIST);
  let candidates = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    let d = dist(newNode.x, newNode.y, nodes[i].x, nodes[i].y);
    if (d < maxD) candidates.push({ node: nodes[i], d });
  }
  candidates.sort((a, b) => a.d - b.d);
  let nearest = candidates.slice(0, K_NEAREST);
  for (let { node } of nearest) {
    edges.push({ a: newNode, b: node, born: millis() });
  }
}

// Gespeicherte Kanten zeichnen – bleiben permanent
function drawEdges() {
  for (let e of edges) {
    let fadeA = min(1, ((millis() - e.a.born) / 1000) * 2.5);
    let fadeB = min(1, ((millis() - e.b.born) / 1000) * 2.5);
    let fadeE = min(1, ((millis() - e.born) / 1000) * 2.5);
    let alpha = min(fadeA, fadeB, fadeE);
    if (alpha < 0.01) continue;
    stroke(B[0], B[1], B[2], 220 * alpha);
    strokeWeight(sc(1.3));
    noFill();
    line(e.a.x, e.a.y, e.b.x, e.b.y);
  }
  noStroke();
}

// ── Physik ────────────────────────────────────────────────────────────────────

function applyForces() {
  let rep = REPULSION * SF * SF;
  let maxD = sc(MAX_DIST);

  // Abstoßung zwischen allen Nodes
  for (let i = 0; i < nodes.length; i++) {
    let a = nodes[i];
    let dA = getDecay(a);
    for (let j = i + 1; j < nodes.length; j++) {
      let b = nodes[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let d = max(dist(a.x, a.y, b.x, b.y), 1);
      let f = rep / (d * d);
      a.vx += (dx / d) * f;
      a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f;
      b.vy -= (dy / d) * f;
    }
    if (dA > 0) {
      a.vx *= 0.95;
      a.vy *= 0.95;
    } else {
      a.vx += random(-0.005, 0.005);
      a.vy += random(-0.005, 0.005);
      // Sanfte Zentrierung: zieht Nodes leicht zur Mitte
      let cx = width / 2;
      let cy = height / 2;
      a.vx += (cx - a.x) * 0.0006;
      a.vy += (cy - a.y) * 0.0006;
      let margin = sc(180);
      if (a.x < margin) a.vx += (margin - a.x) * 0.03;
      if (a.x > width - margin) a.vx -= (a.x - (width - margin)) * 0.03;
      if (a.y < margin) a.vy += (margin - a.y) * 0.03;
      if (a.y > height - margin) a.vy -= (a.y - (height - margin)) * 0.03;
    }
  }

  // Anziehung zu K_NEAREST Nachbarn
  for (let i = 0; i < nodes.length; i++) {
    let a = nodes[i];
    let candidates = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      let d = dist(a.x, a.y, nodes[j].x, nodes[j].y);
      if (d < maxD) candidates.push({ b: nodes[j], d });
    }
    candidates.sort((x, y) => x.d - y.d);
    let nearest = candidates.slice(0, K_NEAREST);

    for (let { b, d } of nearest) {
      let pull = (1 - max(getDecay(a), getDecay(b))) * ATTRACTION;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let len = max(d, 1);
      let dp = (d - sc(EDGE_LEN)) * pull;
      a.vx += (dx / len) * dp;
      a.vy += (dy / len) * dp;
      b.vx -= (dx / len) * dp;
      b.vy -= (dy / len) * dp;
    }
  }

  // Positionen aktualisieren + Randprall
  for (let n of nodes) {
    n.vx *= DAMPING;
    n.vy *= DAMPING;
    n.x += n.vx;
    n.y += n.vy;
    let clamp = sc(20);
    if (n.x < clamp) {
      n.x = clamp;
      n.vx *= -0.1;
    }
    if (n.x > width - clamp) {
      n.x = width - clamp;
      n.vx *= -0.1;
    }
    if (n.y < clamp) {
      n.y = clamp;
      n.vy *= -0.1;
    }
    if (n.y > height - clamp) {
      n.y = height - clamp;
      n.vy *= -0.1;
    }
  }
}

// ── Kacheln ───────────────────────────────────────────────────────────────────

function initTiles() {
  tiles = [];
  let order = [];
  for (let i = 0; i < TILE_COLS * TILE_ROWS; i++) order.push(i);
  for (let i = order.length - 1; i > 0; i--) {
    let j = floor(random(i + 1));
    let tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  for (let i = 0; i < TILE_COLS * TILE_ROWS; i++) {
    let col = i % TILE_COLS;
    let row = floor(i / TILE_COLS);
    let rank = order.indexOf(i);
    let x1 = floor((col / TILE_COLS) * width);
    let y1 = floor((row / TILE_ROWS) * height);
    let x2 = floor(((col + 1) / TILE_COLS) * width);
    let y2 = floor(((row + 1) / TILE_ROWS) * height);
    tiles.push({
      x: x1,
      y: y1,
      w: x2 - x1,
      h: y2 - y1,
      delay: rank * 45,
      alpha: 0,
    });
  }
  tilesAnimating = true;
  tileStartTime = millis();
}

function drawTilesFadeOut() {
  let elapsed = millis() - tileStartTime;
  let allDone = true;
  noStroke();
  for (let t of tiles) {
    let age = elapsed - t.delay;
    if (age <= 0) {
      allDone = false;
      continue;
    }
    t.alpha = min(255, t.alpha + 22);
    if (t.alpha < 255) allDone = false;
    fill(255, t.alpha);
    rect(t.x, t.y, t.w, t.h);
  }
  if (allDone) {
    tilesAnimating = false;
    started = true;
    onboardPhase = 1;
    onboardHintTimer = true;
  }
}

// ── Startscreen ───────────────────────────────────────────────────────────────

function spawnOnboardPulses() {
  onboardPulses = [];
  let count = floor(random(6, 12));
  for (let i = 0; i < count; i++) {
    onboardPulses.push({
      x: random(windowWidth * 0.15, windowWidth * 0.85),
      y: random(windowHeight * 0.55, windowHeight * 0.9),
      offset: random(0, 1),
    });
  }
}

function drawStartScreen() {
  background(0);
  let cx = width / 2;
  let cy = height / 2;

  if (startImg) {
    let imgAspect = startImg.width / startImg.height;
    let scrAspect = width / height;
    let drawW, drawH;
    if (scrAspect > imgAspect) {
      drawW = width;
      drawH = width / imgAspect;
    } else {
      drawH = height;
      drawW = height * imgAspect;
    }
    image(startImg, cx, cy, drawW, drawH);
    drawingContext.save();
    drawingContext.globalAlpha = 0.07;
    drawingContext.fillStyle = "white";
    drawingContext.fillRect(0, 0, width, height);
    drawingContext.restore();
  }

  if (onboardVisible) {
    let ctaY = height * 0.62;
    let fs1 = sc(90);
    let textLeft = cx - sc(300);
    let pad = sc(4);

    // --- Zeile 1: alles über drawingContext ---
    drawingContext.save();
    drawingContext.font = `400 ${fs1}px 'Degular Mono', monospace`;
    drawingContext.letterSpacing = "0.18em";
    drawingContext.textAlign = "left";
    drawingContext.textBaseline = "middle";
    let text1 = "Berühre den Bildschirm";
    let tw1 = drawingContext.measureText(text1).width;
    drawingContext.fillStyle = "rgb(255,255,255)";
    drawingContext.fillRect(
      textLeft - pad,
      ctaY - fs1 / 2 - pad,
      tw1 + pad * 2,
      fs1 + pad * 2
    );
    drawingContext.fillStyle = "rgb(0,0,255)";
    drawingContext.fillText(text1, textLeft, ctaY);
    drawingContext.restore();

    // --- Zeile 2: alles über drawingContext ---
    let text2 = "um den Countdown zu starten";
    let fs2 = sc(90);
    let line2Y = ctaY + fs1 + sc(1);
    drawingContext.save();
    drawingContext.font = `400 ${fs2}px 'Degular Mono', monospace`;
    drawingContext.letterSpacing = "0.12em";
    drawingContext.textAlign = "left";
    drawingContext.textBaseline = "top";
    let tw2 = drawingContext.measureText(text2).width;
    let text2Left = textLeft + tw1 - tw2;
    drawingContext.fillStyle = "rgb(255,255,255)";
    drawingContext.fillRect(
      text2Left - pad,
      line2Y - pad,
      tw2 + pad * 2,
      fs2 + pad * 2
    );
    drawingContext.fillStyle = "rgb(0,0,255)";
    drawingContext.fillText(text2, text2Left, line2Y);
    drawingContext.restore();

    drawFingerPulses();
  }
}

function drawFingerPulses() {
  let t = millis();
  let period = 2000;
  for (let p of onboardPulses) {
    let phase = ((t + p.offset) % period) / period;
    let baseR = sc(12);
    let dotA = 240 * (1 - smoothstep(0.5, 1.0, phase));
    noStroke();
    fill(B[0], B[1], B[2], dotA);
    ellipse(p.x, p.y, baseR * 2);
    for (let ring = 0; ring < 2; ring++) {
      let rPhase = (phase + ring * 0.4) % 1.0;
      let r = baseR + sc(65) * easeOut(rPhase);
      let a = 160 * (1 - rPhase);
      noFill();
      stroke(B[0], B[1], B[2], a);
      strokeWeight(sc(1.2));
      ellipse(p.x, p.y, r * 2);
    }
  }
  noStroke();
}

function smoothstep(e0, e1, x) {
  let t = constrain((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
function easeOut(t) {
  return 1 - pow(1 - t, 2);
}

// ── Nodes ─────────────────────────────────────────────────────────────────────

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
    n.fontSize = min(
      n.fontSize + GROW_RATE * 0.5 * ((n.stretchX + n.stretchY) / 2),
      sc(MAX_WORD_FS)
    );
    n.scaleX = n.stretchX;
    n.scaleY = n.stretchY;
  } else if (n.kind === "photo") {
    n.pw = min(n.pw + GROW_RATE * 2 * n.stretchX, sc(MAX_PHOTO_W) * n.stretchX);
    n.ph = min(
      n.ph + GROW_RATE * 2 * n.stretchY,
      sc(MAX_PHOTO_W) * 1.4 * n.stretchY
    );
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
  let list;
  if (progress < 0.33) list = WORDS_START;
  else if (progress < 0.66) list = WORDS_MIDDLE;
  else list = WORDS_END;
  return list[floor(random(list.length))];
}

function createNode(x, y) {
  let roll = random();
  let kind = roll < 0.4 ? "dot" : roll < 0.75 ? "word" : "photo";
  let st = randomStretch();
  let initR = sc(12);
  let selectedPhoto = photos[floor(random(photos.length))];
  return {
    x: x + random(-sc(80), sc(80)),
    y: y + random(-sc(80), sc(80)),
    vx: 0,
    vy: 0,
    born: millis(),
    kind,
    pulse: 0,
    hit: false,
    stretchX: st.sx,
    stretchY: st.sy,
    scaleX: 1,
    scaleY: 1,
    rx: kind === "dot" ? initR * st.sx : 0,
    ry: kind === "dot" ? initR * st.sy : 0,
    fontSize: kind === "word" ? sc(9) : 0,
    weight: [100, 200, 300, 400, 700, 900][floor(random(6))],
    letterSpacing: [-0.02, 0, 0.06, 0.14, 0.22][floor(random(5))],
    inverted: kind === "word" && random() < 0.15,
    pw: kind === "photo" ? sc(50) : 0,
    ph:
      kind === "photo"
        ? sc(50) *
          (selectedPhoto ? selectedPhoto.height / selectedPhoto.width : 1.3)
        : 0,
    tinted: kind === "photo" && random() < 0.25,
    scanLine: kind === "photo" && random() < 0.35,
    accent: false,
    word: getWord(),
    photo: kind === "photo" ? selectedPhoto : null,
  };
}

// ── Zeichnen ──────────────────────────────────────────────────────────────────

function drawNode(n) {
  let age = (millis() - n.born) / 1000;
  let fadeIn = min(1, age * 3);
  let decay = getDecay(n);
  let alpha = fadeIn * (1 - decay);
  if (alpha <= 0.01) return;
  let x = n.x,
    y = n.y;

  if (n.kind === "dot") {
    noStroke();
    let layers = 28;
    for (let s = 0; s < layers; s++) {
      let t = s / layers;
      let rx = n.rx * (0.05 + t * 0.95);
      let ry = n.ry * (0.05 + t * 0.95);
      let a = exp(-t * t * 4.5) * 230 * alpha;
      fill(B[0], B[1], B[2], a);
      ellipse(x, y, rx * 2, ry * 2);
    }
  } else if (n.kind === "word") {
    noStroke();
    if (n.inverted) {
      let pad = sc(6);
      let tw = n.fontSize * n.word.length * 0.62;
      drawingContext.save();
      drawingContext.translate(x, y);
      drawingContext.scale(n.scaleX || 1, n.scaleY || 1);
      drawingContext.fillStyle = `rgba(0,0,255,${0.9 * alpha})`;
      drawingContext.fillRect(
        -tw / 2 - pad,
        -n.fontSize * 0.72 - pad,
        tw + pad * 2,
        n.fontSize + pad * 2
      );
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

// ── UI ────────────────────────────────────────────────────────────────────────

function drawUI() {
  let progress = 1 - counter / 2617;
  let BAR_H = sc(BAR_H_BASE);

  noStroke();
  fill(0, 0, 0, 10);
  rect(0, height - BAR_H, width, BAR_H);
  fill(B[0], B[1], B[2], 255);
  rect(0, height - BAR_H, width * progress, BAR_H);

  counterFlash = max(0, counterFlash - 0.06);

  let numStr = counter.toLocaleString("de-DE");
  let numFS = sc(125);
  let padX = sc(20);
  let padY = sc(10);

  drawingContext.save();
  drawingContext.font = `400 ${numFS}px 'Degular Mono', monospace`;
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
  drawingContext.font = `400 ${numFS}px 'Degular Mono', monospace`;
  drawingContext.letterSpacing = "-0.03em";
  drawingContext.textAlign = "right";
  drawingContext.textBaseline = "top";
  drawingContext.fillText(numStr, pillX + pillW - padX, pillY + padY);
  drawingContext.restore();
}

function drawToast() {
  if (!toastMsg || toastTimer === 0) return;
  let age = millis() - toastTimer;
  if (age > TOAST_DURATION) {
    toastMsg = "";
    return;
  }

  let fadeIn = min(1, age / 300);
  let fadeOut =
    age > TOAST_DURATION - 600 ? 1 - (age - (TOAST_DURATION - 600)) / 600 : 1;
  let alpha = fadeIn * fadeOut;

  let fs = sc(125);
  let pad = sc(14);

  drawingContext.save();
  drawingContext.font = `400 ${fs}px 'Degular Mono', monospace`;
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
  let cx = width / 2;
  let cy = height / 2;
  let fs = sc(64);

  drawingContext.save();
  drawingContext.letterSpacing = "0.12em";
  drawingContext.textAlign = "center";
  drawingContext.textBaseline = "middle";
  drawingContext.fillStyle = "rgba(0,0,255,1)";
  drawingContext.font = `700 ${fs}px 'Degular Mono', monospace`;
  drawingContext.fillText("Tippe weiter", cx, cy - sc(125));
  drawingContext.font = `400 ${fs}px 'Degular Mono', monospace`;
  drawingContext.fillText("2617 Berührungen,", cx, cy);
  drawingContext.fillText("die dich näher bringen", cx, cy + sc(80));
  drawingContext.restore();
}

// ── Endscreen ─────────────────────────────────────────────────────────────────

function initEndPulses() {
  endPulsesReady = true;
}

const END_DOC = [
  { type: "serif-xl", text: "2617" },
  { type: "serif-lg", text: "Berührungen an einem Tag." },
  { type: "gap", h: 48 },
  { type: "sans-body", text: "Wir tippen, wischen, scrollen. Oft unbewusst." },
  { type: "gap", h: 36 },
  { type: "sans-body", text: "Dabei ist Berührung essenziell. Über die" },
  { type: "sans-body", text: "Haut erfahren wir Wärme, Nähe, Vertrauen." },
  { type: "sans-body", text: "Körperlicher Kontakt setzt Oxytocin frei, " },
  { type: "sans-body", text: "ein Hormon, das uns verbindet, uns hält." },
  { type: "gap", h: 36 },
  { type: "sans-body", text: "Auf Glas bleibt das aus. Im digitalen" },
  { type: "sans-body", text: "Alltag wird diese Verbindung immer leiser." },
  { type: "gap", h: 48 },
  { type: "serif-lg", text: "Sind wir alle ein bisschen" },
  { type: "serif-lg", text: "out of touch?" },
  { type: "gap", h: 60 },
];

function endDocH(item) {
  const base = {
    "serif-xl": 280,
    "serif-lg": 150,
    "sans-body": 90,
    "sans-sm": 80,
    source: 55,
    rule: 1,
    gap: item.h || 20,
  };
  return sc(base[item.type] || 110);
}

function drawEndScreen() {
  background(0, 0, 255);
  let BAR_H = sc(BAR_H_BASE);
  if (!endPulsesReady) initEndPulses();

  let elapsed = (millis() - finishTime) / 1000;

  let totalH = 0;
  for (let item of END_DOC) totalH += endDocH(item);

  let leftMargin = max(sc(100), width * 0.1);
  let curY = height / 2 - totalH / 2;
  let delay = 0.2;

  for (let i = 0; i < END_DOC.length; i++) {
    let item = END_DOC[i];
    let lh = endDocH(item);
    let age = elapsed - i * delay;
    let alpha = min(1, age * 3.5);
    if (alpha <= 0) {
      curY += lh;
      continue;
    }

    let x = leftMargin;

    if (item.type === "gap") {
      // nichts
    } else if (item.type === "rule") {
      stroke(255, 255, 255, 80 * alpha);
      strokeWeight(sc(1));
      line(x, curY + lh / 2, x + width * 0.55, curY + lh / 2);
      noStroke();
    } else {
      noStroke();
      drawingContext.save();

      if (item.type === "serif-xl") {
        drawingContext.font = `bold italic ${sc(
          260
        )}px 'Averia Serif Libre', serif`;
        drawingContext.letterSpacing = "-0.03em";
        drawingContext.textAlign = "left";
        drawingContext.textBaseline = "top";
        drawingContext.strokeStyle = `rgba(255,255,255,${0.15 * alpha})`;
        drawingContext.lineWidth = sc(4);
        drawingContext.strokeText(item.text, x, curY);
        drawingContext.fillStyle = `rgba(255,255,255,${alpha})`;
        drawingContext.fillText(item.text, x, curY);
      } else if (item.type === "serif-lg") {
        let col = item.highlight
          ? `rgba(255,255,180,${alpha})`
          : `rgba(255,255,255,${0.95 * alpha})`;
        drawingContext.font = `bold italic ${sc(
          120
        )}px 'Averia Serif Libre', serif`;
        drawingContext.letterSpacing = "0.01em";
        drawingContext.textAlign = "left";
        drawingContext.textBaseline = "top";
        drawingContext.strokeStyle = `rgba(255,255,255,${0.08 * alpha})`;
        drawingContext.lineWidth = sc(2);
        drawingContext.strokeText(item.text, x, curY);
        drawingContext.fillStyle = col;
        drawingContext.fillText(item.text, x, curY);
      } else if (item.type === "sans-body") {
        drawingContext.font = `400 ${sc(56)}px 'Degular Mono', monospace`;
        drawingContext.letterSpacing = "0.02em";
        drawingContext.textAlign = "left";
        drawingContext.textBaseline = "top";
        drawingContext.fillStyle = `rgba(255,255,255,${0.85 * alpha})`;
        drawingContext.fillText(item.text, x, curY);
      } else if (item.type === "sans-sm") {
        drawingContext.font = `400 ${sc(42)}px 'Degular Mono', monospace`;
        drawingContext.letterSpacing = "0.03em";
        drawingContext.textAlign = "left";
        drawingContext.textBaseline = "top";
        drawingContext.fillStyle = `rgba(255,255,255,${0.7 * alpha})`;
        drawingContext.fillText(item.text, x, curY);
      } else if (item.type === "source") {
        drawingContext.font = `400 ${sc(32)}px 'Degular Mono', monospace`;
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
    let btnA = min(1, btnAge * 1.2);
    let leftM = leftMargin;
    let btnY = curY + sc(32);
    let fs1 = sc(80);

    drawingContext.save();
    drawingContext.font = `400 ${fs1}px 'Degular Mono', monospace`;
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

// ── Interaktion ───────────────────────────────────────────────────────────────

function pressStart(id, x, y) {
  if (finished) {
    if (
      restartBtnVisible &&
      x >= restartBtnX &&
      x <= restartBtnX + restartBtnW &&
      y >= restartBtnY &&
      y <= restartBtnY + restartBtnH
    ) {
      restarting = true;
      restartAlpha = 0;
      endPulsesReady = false;
    }
    return;
  }

  if (!started && !tilesAnimating) {
    onboardVisible = false;
    lastInteraction = millis();
    initTiles();
    return;
  }

  if (tilesAnimating) return;

  if (onboardHintTimer === true) {
    onboardHintTimer = false;
    return;
  }

  if (counter <= 0) return;

  let dec;
  if (counter <= 3) dec = 1;
  else if (counter <= 10) dec = floor(random(1, 4));
  else dec = floor(random(1, 0));
  counter = max(0, counter - dec);
  touchCount++;
  counterFlash = 1.0;
  lastInteraction = millis();

  let progress = 1 - counter / 2617;
  if (!toast33Shown && progress >= 0.25) {
    toast33Shown = true;
    toastMsg = "Du kommst näher!";
    toastTimer = millis();
  }
  if (!toast66Shown && progress >= 0.66) {
    toast66Shown = true;
    toastMsg = "Fast greifbar!";
    toastTimer = millis();
  }

  let node = createNode(x, y);
  nodes.push(node);
  addEdges(node);
  activePresses[id] = { nodeIdx: nodes.length - 1 };

  if (counter <= 0 && !finished) {
    setTimeout(() => {
      finished = true;
      finishTime = millis();
    }, 2000);
  }
}

function pressEnd(id) {
  delete activePresses[id];
}

function mousePressed() {
  pressStart("mouse", mouseX, mouseY);
}
function mouseReleased() {
  pressEnd("mouse");
}

function touchStarted() {
  for (let t of touches) pressStart(t.id, t.x, t.y);
  return false;
}
function touchEnded() {
  let activeIds = new Set(touches.map((t) => t.id));
  for (let key in activePresses) {
    if (key !== "mouse" && !activeIds.has(parseInt(key))) pressEnd(key);
  }
  return false;
}
