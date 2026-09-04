(() => {
  const LCD_W = 400, LCD_H = 240;
  const LIME = "#c9d63a", INK = "#2a1c12", TAN = "#c9a36a";
  const LEASH_MIN = 0.9, LEASH_MAX = 5.2;
  const TURN_RATE = 2.4;
  const WALK_SPD = 2.3;

  const lcd = document.getElementById("lcd");
  const lctx = lcd.getContext("2d");
  const crankEl = document.getElementById("crank");
  const cctx = crankEl.getContext("2d");
  const stickEl = document.getElementById("stick");
  const sctx = stickEl.getContext("2d");

  function eatLcdTouch(e) { e.preventDefault(); }
  lcd.addEventListener("touchstart", eatLcdTouch, { passive: false });
  lcd.addEventListener("touchmove", eatLcdTouch, { passive: false });
  lcd.addEventListener("touchend", eatLcdTouch, { passive: false });
  lcd.addEventListener("touchcancel", eatLcdTouch, { passive: false });

  const you = { x: 0, y: 0, heading: 0 };
  const momo = { x: 1.6, y: 0.3, heading: 0, want: 0, sniff: 0, gait: 0, wag: 0, target: null, think: 0 };
  const crank = { ang: 0, vel: 0, grabbing: false, last: null };
  const leash = { len: 2.6, taut: 0 };
  // left stick: nx/ny in [-1,1], screen +y down so walk forward = -ny
  const stick = { nx: 0, ny: 0, grabbing: false };
  const keys = { up: false, down: false, left: false, right: false };
  let mail = 0, tPrev = performance.now();

  const posts = [];
  for (let i = 0; i < 34; i++) {
    const a = i * 1.7;
    posts.push({
      x: Math.cos(a) * (5 + (i % 5) * 2.4) + (i % 3) * 0.5,
      y: Math.sin(a) * (5 + (i % 7) * 1.9),
      h: 1.1 + (i % 4) * 0.15,
      done: false,
      hit: 0
    });
  }

  function wrapPi(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  const cOpts = { passive: false };

  function crankLocal(e) {
    const r = crankEl.getBoundingClientRect();
    const t = e.changedTouches ? e.changedTouches[0] : e;
    return { x: t.clientX - r.left - r.width / 2, y: t.clientY - r.top - r.height / 2 };
  }
  function onCrankStart(e) {
    e.preventDefault();
    const p = crankLocal(e);
    crank.grabbing = true;
    crank.last = Math.atan2(p.y, p.x);
  }
  function onCrankMove(e) {
    if (!crank.grabbing) return;
    e.preventDefault();
    const p = crankLocal(e);
    const a = Math.atan2(p.y, p.x);
    const da = wrapPi(a - crank.last);
    crank.vel = crank.vel * 0.35 + da * 0.65;
    crank.ang += da;
    crank.last = a;
    leash.len = Math.min(LEASH_MAX, Math.max(LEASH_MIN, leash.len + da * 0.55));
  }
  function onCrankEnd(e) {
    e.preventDefault();
    crank.grabbing = false;
    crank.last = null;
  }
  crankEl.addEventListener("touchstart", onCrankStart, cOpts);
  crankEl.addEventListener("touchmove", onCrankMove, cOpts);
  crankEl.addEventListener("touchend", onCrankEnd, cOpts);
  crankEl.addEventListener("touchcancel", onCrankEnd, cOpts);
  crankEl.addEventListener("pointerdown", e => { if (e.pointerType === "touch") return; onCrankStart(e); crankEl.setPointerCapture(e.pointerId); });
  crankEl.addEventListener("pointermove", e => { if (e.pointerType === "touch") return; onCrankMove(e); });
  crankEl.addEventListener("pointerup", e => { if (e.pointerType === "touch") return; onCrankEnd(e); });
  crankEl.addEventListener("wheel", e => {
    e.preventDefault();
    const da = (e.deltaY + e.deltaX) * 0.004;
    crank.vel = crank.vel * 0.3 + da * 0.7;
    crank.ang += da;
    leash.len = Math.min(LEASH_MAX, Math.max(LEASH_MIN, leash.len + da * 0.55));
  }, cOpts);

  function stickLocal(e) {
    const r = stickEl.getBoundingClientRect();
    const t = e.changedTouches ? e.changedTouches[0] : e;
    return { x: t.clientX - r.left - r.width / 2, y: t.clientY - r.top - r.height / 2 };
  }
  function setStickFromLocal(p) {
    const maxR = stickEl.width * 0.34;
    let x = p.x, y = p.y;
    const mag = Math.hypot(x, y) || 1e-6;
    if (mag > maxR) { x = (x / mag) * maxR; y = (y / mag) * maxR; }
    const dead = 0.12;
    let nx = x / maxR, ny = y / maxR;
    if (Math.hypot(nx, ny) < dead) { nx = 0; ny = 0; }
    stick.nx = nx;
    stick.ny = ny;
  }
  function clearStick() { stick.nx = 0; stick.ny = 0; stick.grabbing = false; }
  function onStickStart(e) {
    e.preventDefault();
    stick.grabbing = true;
    setStickFromLocal(stickLocal(e));
  }
  function onStickMove(e) {
    if (!stick.grabbing) return;
    e.preventDefault();
    setStickFromLocal(stickLocal(e));
  }
  function onStickEnd(e) {
    e.preventDefault();
    clearStick();
  }
  stickEl.addEventListener("touchstart", onStickStart, cOpts);
  stickEl.addEventListener("touchmove", onStickMove, cOpts);
  stickEl.addEventListener("touchend", onStickEnd, cOpts);
  stickEl.addEventListener("touchcancel", onStickEnd, cOpts);
  stickEl.addEventListener("pointerdown", e => {
    if (e.pointerType === "touch") return;
    e.preventDefault();
    stick.grabbing = true;
    setStickFromLocal(stickLocal(e));
    stickEl.setPointerCapture(e.pointerId);
  });
  stickEl.addEventListener("pointermove", e => {
    if (e.pointerType === "touch") return;
    if (!stick.grabbing) return;
    setStickFromLocal(stickLocal(e));
  });
  stickEl.addEventListener("pointerup", e => { if (e.pointerType === "touch") return; clearStick(); });

  addEventListener("keydown", e => {
    if (e.key === "ArrowUp") keys.up = true;
    if (e.key === "ArrowDown") keys.down = true;
    if (e.key === "ArrowLeft") keys.left = true;
    if (e.key === "ArrowRight") keys.right = true;
  });
  addEventListener("keyup", e => {
    if (e.key === "ArrowUp") keys.up = false;
    if (e.key === "ArrowDown") keys.down = false;
    if (e.key === "ArrowLeft") keys.left = false;
    if (e.key === "ArrowRight") keys.right = false;
  });

  function stickAxes() {
    if (stick.grabbing || Math.hypot(stick.nx, stick.ny) > 0.01) return { x: stick.nx, y: stick.ny };
    let x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    let y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y };
  }

  function worldToCam(wx, wy) {
    const dx = wx - you.x, dy = wy - you.y;
    const c = Math.cos(you.heading), s = Math.sin(you.heading);
    return { x: -dx * s + dy * c, z: dx * c + dy * s };
  }
  function project(wx, wy) {
    const p = worldToCam(wx, wy);
    if (p.z < 0.3) return null;
    const f = 210;
    return { x: LCD_W * 0.5 + (p.x / p.z) * f, y: 100 + 92 / p.z, z: p.z, s: 70 / p.z };
  }

  function pickTarget() {
    let best = null, bestD = 1e9;
    for (const p of posts) {
      if (p.done) continue;
      const d = Math.hypot(p.x - you.x, p.y - you.y);
      if (d < leash.len + 1.6 && d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function stepMomo(dt) {
    momo.think -= dt;
    if (momo.think <= 0 || (momo.target && momo.target.done)) {
      momo.target = pickTarget();
      momo.think = 1.2 + Math.random() * 1.4;
    }
    let tx, ty;
    if (momo.target) {
      tx = momo.target.x; ty = momo.target.y;
    } else {
      tx = you.x + Math.cos(you.heading + Math.sin(performance.now() / 2600) * 0.7) * leash.len * 0.8;
      ty = you.y + Math.sin(you.heading + Math.sin(performance.now() / 2600) * 0.7) * leash.len * 0.8;
    }
    const dx = tx - momo.x, dy = ty - momo.y;
    const dist = Math.hypot(dx, dy) || 1e-6;
    const atTarget = dist < 0.5;
    const spd = atTarget ? 0 : 1.9;
    momo.x += (dx / dist) * spd * dt;
    momo.y += (dy / dist) * spd * dt;

    let lx = momo.x - you.x, ly = momo.y - you.y;
    let ld = Math.hypot(lx, ly) || 1e-6;
    if (ld > leash.len) {
      momo.x = you.x + (lx / ld) * leash.len;
      momo.y = you.y + (ly / ld) * leash.len;
      ld = leash.len;
    }
    leash.taut += ((ld / leash.len > 0.94 ? 1 : 0) - leash.taut) * (1 - Math.exp(-dt * 8));

    const moving = !atTarget && ld < leash.len - 0.02;
    momo.heading = Math.atan2(dy, dx);
    momo.gait += (moving ? 1 : 0) * dt * 11;
    momo.wag += dt * (1.6 + (moving ? 5 : 2.5));
    momo.sniff += ((atTarget ? 1 : 0) - momo.sniff) * (1 - Math.exp(-dt * 4));

    if (momo.target && atTarget && momo.sniff > 0.8 && !momo.target.done) {
      momo.target.done = true;
      momo.target.hit = 1;
      mail++;
      momo.think = 0.2;
    }
    for (const p of posts) if (p.hit > 0) p.hit *= Math.exp(-dt * 0.5);
  }

  let wasTaut = false;
  let tautPulse = 0;
  function pulseTaut() {
    tautPulse = 1;
    try {
      if (navigator.vibrate) navigator.vibrate([14, 30, 18]);
    } catch (_) {}
  }

  function step(dt) {
    if (!crank.grabbing) crank.vel *= Math.exp(-dt * 2.6);
    crank.ang += crank.grabbing ? 0 : crank.vel * 0.35;

    const ax = stickAxes();
    // continuous turn (no detents); stick X / arrow L-R
    you.heading += ax.x * TURN_RATE * dt;
    // walk: stick forward = up = -ny
    const walk = -ax.y;
    const drag = Math.max(0.18, 1 - 0.82 * leash.taut);
    const spd = WALK_SPD * drag;
    you.x += Math.cos(you.heading) * walk * dt * spd;
    you.y += Math.sin(you.heading) * walk * dt * spd;

    stepMomo(dt);

    const tautNow = leash.taut > 0.55;
    // heading stays under stick — leash pull does not yank camera
    if (tautNow && !wasTaut) pulseTaut();
    wasTaut = tautNow;
    if (tautPulse > 0) tautPulse = Math.max(0, tautPulse - dt * 3.2);
  }

  function ditherSky() {
    lctx.fillStyle = LIME;
    lctx.fillRect(0, 0, LCD_W, LCD_H);
    lctx.fillStyle = INK;
    for (let y = 0; y < 96; y += 2) {
      const st = 7 + (y >> 3);
      for (let x = (y * 3) % 5; x < LCD_W; x += st) lctx.fillRect(x, y, 1, 1);
    }
    lctx.fillRect(0, 108, LCD_W, 1);
    for (let y = 110; y < LCD_H; y += 5) {
      for (let x = (y * 2) % 9; x < LCD_W; x += 14) lctx.fillRect(x, y, 1, 1);
    }
  }

  function drawPost(p) {
    const pr = project(p.x, p.y);
    if (!pr) return;
    const h = pr.s * p.h * 1.4;
    const x = Math.round(pr.x), y = Math.round(pr.y);
    lctx.fillStyle = INK;
    lctx.fillRect(x, y - h, 2, h);
    lctx.fillRect(x - 4, y - h, 10, 2);
    if (p.done) lctx.fillRect(x + 3, y - h + 6, 6, 5);
  }

  function drawMomo(px, py, scale, sniffAmt, sideways) {
    lctx.save();
    lctx.translate(px, py);
    lctx.scale(scale, scale);
    lctx.strokeStyle = INK;
    lctx.fillStyle = TAN;
    lctx.lineWidth = 2 / scale;
    lctx.lineJoin = "round";
    lctx.lineCap = "round";
    const walk = Math.sin(momo.gait) * (1 - sniffAmt);
    const droop = sniffAmt * 5;
    lctx.beginPath();
    lctx.moveTo(-7, 4); lctx.lineTo(-9 - walk * 3, 16);
    lctx.moveTo(7, 4); lctx.lineTo(9 + walk * 3, 16);
    lctx.stroke();
    lctx.beginPath();
    lctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
    lctx.fill(); lctx.stroke();
    const hx = sideways * 9;
    lctx.beginPath();
    lctx.ellipse(hx, -8 + droop, 9, 8, 0, 0, Math.PI * 2);
    lctx.fill(); lctx.stroke();
    lctx.beginPath();
    lctx.ellipse(hx - 6, -13 + droop, 4.5, 6.5, -0.3, 0, Math.PI * 2);
    lctx.fill(); lctx.stroke();
    lctx.beginPath();
    lctx.ellipse(hx + 6, -13 + droop, 4.5, 6.5, 0.3, 0, Math.PI * 2);
    lctx.fill(); lctx.stroke();
    lctx.fillStyle = INK;
    lctx.fillRect(hx - 4, -9 + droop, 2, 2);
    lctx.fillRect(hx + 2, -9 + droop, 2, 2);
    lctx.strokeStyle = INK;
    lctx.beginPath();
    lctx.moveTo(-12, -2);
    lctx.quadraticCurveTo(-20 + Math.sin(momo.wag) * 5, -8, -16 + Math.cos(momo.wag) * 7, -14);
    lctx.stroke();
    lctx.restore();
  }

  function drawStick() {
    const w = stickEl.width, h = stickEl.height, cx = w / 2, cy = h / 2;
    const outer = w * 0.42, knob = w * 0.16, travel = w * 0.34;
    const ax = stickAxes();
    sctx.clearRect(0, 0, w, h);
    sctx.beginPath();
    sctx.arc(cx, cy, outer + 3, 0, Math.PI * 2);
    sctx.fillStyle = "#2a241e";
    sctx.fill();
    sctx.beginPath();
    sctx.arc(cx, cy, outer, 0, Math.PI * 2);
    sctx.strokeStyle = "#6b5b46";
    sctx.lineWidth = 5;
    sctx.stroke();
    const kx = cx + ax.x * travel;
    const ky = cy + ax.y * travel;
    sctx.beginPath();
    sctx.arc(kx, ky, knob, 0, Math.PI * 2);
    sctx.fillStyle = "#e8c48a";
    sctx.fill();
    sctx.beginPath();
    sctx.arc(kx, ky, knob * 0.35, 0, Math.PI * 2);
    sctx.fillStyle = INK;
    sctx.fill();
  }

  function drawCrank() {
    const w = crankEl.width, h = crankEl.height, cx = w / 2, cy = h / 2, r = w * 0.42;
    cctx.clearRect(0, 0, w, h);
    cctx.beginPath(); cctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    cctx.fillStyle = "#2a241e"; cctx.fill();
    cctx.beginPath(); cctx.arc(cx, cy, r, 0, Math.PI * 2);
    cctx.strokeStyle = "#6b5b46"; cctx.lineWidth = 4; cctx.stroke();
    const frac = (leash.len - LEASH_MIN) / (LEASH_MAX - LEASH_MIN);
    cctx.beginPath();
    cctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    cctx.strokeStyle = TAN; cctx.lineWidth = 5; cctx.stroke();
    cctx.save();
    cctx.translate(cx, cy);
    cctx.rotate(crank.ang);
    cctx.fillStyle = "#e8c48a";
    cctx.beginPath();
    cctx.roundRect(-6, -7, r * 0.95, 14, 7);
    cctx.fill();
    cctx.beginPath(); cctx.arc(r * 0.88, 0, 12, 0, Math.PI * 2); cctx.fill();
    cctx.fillStyle = INK;
    cctx.beginPath(); cctx.arc(0, 0, 6, 0, Math.PI * 2); cctx.fill();
    cctx.restore();
  }

  function drawWorld() {
    ditherSky();
    const ordered = posts
      .map(p => ({ p, z: worldToCam(p.x, p.y).z }))
      .filter(o => o.z > 0.35)
      .sort((a, b) => b.z - a.z);
    for (const o of ordered) drawPost(o.p);

    const cam = worldToCam(momo.x, momo.y);
    const handX = LCD_W * 0.5, handY = LCD_H - 2;
    const mp = project(momo.x, momo.y);
    lctx.strokeStyle = INK;
    lctx.lineWidth = 2;
    if (mp) {
      const cx2 = Math.max(-40, Math.min(LCD_W + 40, mp.x));
      const cy2 = mp.y - 6;
      lctx.beginPath();
      lctx.moveTo(handX, handY);
      lctx.lineWidth = 2 + (tautPulse > 0 ? 2 * tautPulse : 0);
      if (leash.taut > 0.5) {
        lctx.lineTo(cx2, cy2);
      } else {
        const sag = 14 * (1 - leash.taut);
        lctx.quadraticCurveTo((handX + cx2) / 2, Math.max(cy2, (handY + cy2) / 2 + sag), cx2, cy2);
      }
      lctx.stroke();
      lctx.lineWidth = 2;
      const scale = Math.max(0.5, Math.min(1.9, 1.5 / Math.max(0.6, cam.z)));
      const sideways = Math.max(-1, Math.min(1, Math.sin(momo.heading - you.heading)));
      drawMomo(cx2, Math.min(LCD_H - 20, cy2 + 6), scale, momo.sniff, sideways);
    } else {
      const side = cam.x > 0 ? LCD_W + 10 : -10;
      lctx.beginPath();
      lctx.moveTo(handX, handY);
      lctx.lineTo(side, LCD_H - 46);
      lctx.stroke();
    }

    lctx.fillStyle = INK;
    lctx.font = "10px ui-monospace, ui-rounded, system-ui";
    lctx.fillText("MAIL " + mail, 8, 14);
    if (tautPulse > 0) {
      lctx.globalAlpha = Math.min(1, tautPulse);
      lctx.fillRect(0, 0, LCD_W, 2);
      lctx.fillRect(0, LCD_H - 2, LCD_W, 2);
      lctx.globalAlpha = 1;
    }
  }

  function fitLcd() {
    const wrap = document.getElementById("lcdWrap");
    const aw = wrap.clientWidth;
    const ah = wrap.clientHeight;
    const scale = Math.max(1, Math.floor(Math.min(aw / LCD_W, ah / LCD_H)));
    lcd.style.width = (LCD_W * scale) + "px";
    lcd.style.height = (LCD_H * scale) + "px";
  }
  addEventListener("resize", fitLcd);
  // visualViewport covers iOS Safari chrome show/hide
  if (window.visualViewport) visualViewport.addEventListener("resize", fitLcd);
  fitLcd();

  function frame(now) {
    const dt = Math.min(0.05, (now - tPrev) / 1000);
    tPrev = now;
    step(dt);
    drawWorld();
    drawCrank();
    drawStick();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
