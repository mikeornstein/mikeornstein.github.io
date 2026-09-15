// Arcade loop: leave home, sidewalks, crosswalks, pace on grass, home before clock.
// Camera is a 400×240 window on a larger cell-grid neighborhood; walking off a
// screen edge snaps (no smooth pan).
(function (root) {
  "use strict";

  var Map = root.GoMomoMap;
  var CELL = Map.CELL;
  var VIEW_W = Map.VIEW_W;
  var VIEW_H = Map.VIEW_H;
  var CELL_SIZE = Map.CELL_SIZE;

  var BG = "#c9d63a";
  var INK = "#2a1c12";
  var ROAD = "#0e0c0a";
  var WALK = "#8f8f88";
  var WALK_LINE = "#6c6c66";
  var CURB = "#2a2824";

  var WALK_SPEED = 60;
  var CAR_SPEED = 36;
  var NPC_SPEED = 18;
  var CLOCK = 75;
  var CLOCK_STEP = 8;
  var CLOCK_MIN = 32;
  var PACE_TIME = 2.35;
  var LEASH = 18;
  // Sidewalk is 20px. Lot-edge grass is ~20px from a sidewalk NPC and ~50px
  // from asphalt. Tutorial grass sits one fence cell in (~40px / ~70px).
  var INTERRUPT_R = 44;
  var PEEMAIL_R = 36;
  var CAR_SPOOK_R = 80;
  var STUN_TIME = 0.35;

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function hypot(x, y) {
    return Math.sqrt(x * x + y * y);
  }

  function dist(a, b) {
    return hypot(a.x - b.x, a.y - b.y);
  }

  function formatClock(t) {
    var s = Math.max(0, Math.ceil(t));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  function clockForLevel(level) {
    var lv = Math.max(1, level | 0);
    return Math.max(CLOCK_MIN, CLOCK - (lv - 1) * CLOCK_STEP);
  }

  function Game(seed) {
    this.debug =
      typeof location !== "undefined" && /[?&]debug=1/.test(location.search || "");
    this.originSeed = seed == null ? 20260914 : seed;
    this.level = 1;
    this.reset(this.originSeed, 1);
  }

  Game.prototype.reset = function (seed, level) {
    if (level == null) level = this.level != null ? this.level : 1;
    if (seed == null) seed = this.map ? this.map.seed : this.originSeed;
    this.level = Math.max(1, level | 0);
    this.map = Map.generateNeighborhood(seed, this.level);
    this.walker = {
      x: this.map.home.stoop.x,
      y: this.map.home.stoop.y,
      facingX: 0,
      facingY: 1,
    };
    this.momo = { x: this.walker.x, y: this.walker.y + 10 };
    this.cars = this.map.spawns.cars.map(function (c) {
      return {
        x: c.x,
        y: c.y,
        axis: c.axis,
        dir: c.dir,
        w: c.axis === "x" ? 16 : 10,
        h: c.axis === "x" ? 10 : 16,
        turnLock: 0,
      };
    });
    this.people = this.map.spawns.people.map(function (p) {
      return { x: p.x, y: p.y, dirX: 0, dirY: 0, kind: "person", timer: 0 };
    });
    this.dogs = this.map.spawns.dogs.map(function (p) {
      return { x: p.x, y: p.y, dirX: 0, dirY: 0, kind: "dog", timer: 0 };
    });
    this.peemail = this.map.spawns.peemail.map(function (p) {
      return { x: p.x, y: p.y };
    });
    var bump = this.level - 1;
    this.interruptR = INTERRUPT_R + bump * 4;
    this.peemailR = PEEMAIL_R + bump * 3;
    this.carSpookR = CAR_SPOOK_R + bump * 8;
    this.clock = clockForLevel(this.level);
    this.poop = 0;
    this.didPoop = false;
    this.hasLeftHome = false;
    this.state = "play";
    this.endCopy = "";
    this.message = "Get Momo to the grass.";
    this.messageT = 2.2;
    this.stun = 0;
    this.interruptFlash = 0;
    this.interruptKind = null;
    this.time = 0;
    this.cam = { x: 0, y: 0 };
    this.frameHome();
  };

  Game.prototype.maxCam = function () {
    return {
      x: Math.max(0, this.map.worldW - VIEW_W),
      y: Math.max(0, this.map.worldH - VIEW_H),
    };
  };

  Game.prototype.frameHome = function () {
    var max = this.maxCam();
    this.cam.x = clamp(Math.floor(this.walker.x - VIEW_W / 2), 0, max.x);
    this.cam.y = clamp(Math.floor(this.walker.y - VIEW_H / 2), 0, max.y);
  };

  Game.prototype.snapCamera = function () {
    var max = this.maxCam();
    var snapped = false;
    while (this.walker.x >= this.cam.x + VIEW_W && this.cam.x < max.x) {
      this.cam.x = Math.min(max.x, this.cam.x + VIEW_W);
      snapped = true;
    }
    while (this.walker.x < this.cam.x && this.cam.x > 0) {
      this.cam.x = Math.max(0, this.cam.x - VIEW_W);
      snapped = true;
    }
    while (this.walker.y >= this.cam.y + VIEW_H && this.cam.y < max.y) {
      this.cam.y = Math.min(max.y, this.cam.y + VIEW_H);
      snapped = true;
    }
    while (this.walker.y < this.cam.y && this.cam.y > 0) {
      this.cam.y = Math.max(0, this.cam.y - VIEW_H);
      snapped = true;
    }
    if (this.walker.x >= this.cam.x + VIEW_W) this.cam.x = max.x;
    if (this.walker.x < this.cam.x) this.cam.x = 0;
    if (this.walker.y >= this.cam.y + VIEW_H) this.cam.y = max.y;
    if (this.walker.y < this.cam.y) this.cam.y = 0;
    return snapped;
  };

  Game.prototype.cell = function (x, y) {
    return Map.get(this.map, x, y);
  };

  Game.prototype.walkable = function (x, y) {
    return Map.isWalkableAt(this.map, x, y);
  };

  Game.prototype.onHome = function () {
    return this.cell(this.walker.x, this.walker.y) === CELL.HOME;
  };

  Game.prototype.tryMove = function (ent, dx, dy) {
    var nx = ent.x + dx;
    var ny = ent.y + dy;
    if (this.walkable(nx, ny)) {
      ent.x = nx;
      ent.y = ny;
      return true;
    }
    if (dx !== 0 && this.walkable(ent.x + dx, ent.y)) {
      ent.x += dx;
      return true;
    }
    if (dy !== 0 && this.walkable(ent.x, ent.y + dy)) {
      ent.y += dy;
      return true;
    }
    return false;
  };

  Game.prototype.updateWalker = function (dt, axis) {
    if (this.stun > 0) {
      this.stun -= dt;
      return { moving: false };
    }
    var moving = axis.x !== 0 || axis.y !== 0;
    if (moving) {
      this.walker.facingX = axis.x;
      this.walker.facingY = axis.y;
      this.tryMove(this.walker, axis.x * WALK_SPEED * dt, axis.y * WALK_SPEED * dt);
      this.walker.x = clamp(this.walker.x, 1, this.map.worldW - 2);
      this.walker.y = clamp(this.walker.y, 1, this.map.worldH - 2);
      this.snapCamera();
    }
    return { moving: moving };
  };

  Game.prototype.updateMomo = function (dt) {
    var dx = this.walker.x - this.momo.x;
    var dy = this.walker.y - this.momo.y;
    var d = hypot(dx, dy);
    if (d > LEASH) {
      var pull = Math.min(1, (d - LEASH) * 0.18 + 0.35);
      this.tryMove(this.momo, (dx / d) * pull * WALK_SPEED * 1.15 * dt, (dy / d) * pull * WALK_SPEED * 1.15 * dt);
    } else if (d > 4) {
      this.tryMove(this.momo, dx * 2.2 * dt, dy * 2.2 * dt);
    }
    if (!this.walkable(this.momo.x, this.momo.y)) {
      this.momo.x = this.walker.x;
      this.momo.y = this.walker.y;
    }
  };

  Game.prototype.intersectionNear = function (x, y) {
    for (var i = 0; i < this.map.vStreets.length; i++) {
      for (var j = 0; j < this.map.hStreets.length; j++) {
        var ix = this.map.vStreets[i].asphaltCenter;
        var iy = this.map.hStreets[j].asphaltCenter;
        if (hypot(x - ix, y - iy) < 18) return { x: ix, y: iy };
      }
    }
    return null;
  };

  Game.prototype.snapCarToStreet = function (car) {
    var k = this.cell(car.x, car.y);
    if (k === CELL.STREET || k === CELL.CROSSWALK) return;
    var best = null;
    var bestD = 99;
    for (var i = 0; i < this.map.lanes.length; i++) {
      var lane = this.map.lanes[i];
      var d;
      if (lane.axis === "y") d = Math.abs(car.x - lane.x);
      else d = Math.abs(car.y - lane.y);
      if (d < bestD) {
        bestD = d;
        best = lane;
      }
    }
    if (!best) return;
    if (best.axis === "y") {
      car.x = best.x;
      car.axis = "y";
    } else {
      car.y = best.y;
      car.axis = "x";
    }
  };

  Game.prototype.updateCars = function (dt) {
    for (var i = 0; i < this.cars.length; i++) {
      var car = this.cars[i];
      car.turnLock = Math.max(0, car.turnLock - dt);
      var cross = this.intersectionNear(car.x, car.y);
      if (cross && car.turnLock <= 0 && Math.random() < 0.35) {
        if (car.axis === "x") {
          car.axis = "y";
          car.x = cross.x;
        } else {
          car.axis = "x";
          car.y = cross.y;
        }
        car.dir = Math.random() < 0.5 ? 1 : -1;
        car.turnLock = 1.1;
        car.w = car.axis === "x" ? 16 : 10;
        car.h = car.axis === "x" ? 10 : 16;
      }
      var speed = CAR_SPEED * dt * car.dir;
      if (car.axis === "x") car.x += speed;
      else car.y += speed;

      var inner = this.map.inner;
      if (car.x < inner.x0 + 8) {
        car.x = inner.x0 + 8;
        car.dir = 1;
      }
      if (car.x > inner.x1 - 8) {
        car.x = inner.x1 - 8;
        car.dir = -1;
      }
      if (car.y < inner.y0 + 8) {
        car.y = inner.y0 + 8;
        car.dir = 1;
      }
      if (car.y > inner.y1 - 8) {
        car.y = inner.y1 - 8;
        car.dir = -1;
      }
      this.snapCarToStreet(car);

      if (this.cell(this.walker.x, this.walker.y) === CELL.CROSSWALK) {
        var hit =
          Math.abs(this.walker.x - car.x) < car.w * 0.55 + 4 && Math.abs(this.walker.y - car.y) < car.h * 0.55 + 4;
        if (hit) {
          var bx = this.walker.x - car.x;
          var by = this.walker.y - car.y;
          var bd = hypot(bx, by) || 1;
          this.tryMove(this.walker, (bx / bd) * 12, (by / bd) * 12);
          this.stun = STUN_TIME;
          this.say("Watch the cars!", 1.2);
        }
      }
    }
  };

  Game.prototype.sidewalkStep = function (npc, dt, speed) {
    npc.timer -= dt;
    if (npc.timer <= 0 || !this.canNpcStand(npc.x + npc.dirX, npc.y + npc.dirY)) {
      var dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      var options = [];
      for (var i = 0; i < dirs.length; i++) {
        var nx = npc.x + dirs[i][0] * 4;
        var ny = npc.y + dirs[i][1] * 4;
        if (this.canNpcStand(nx, ny)) options.push(dirs[i]);
      }
      if (options.length) {
        var pick = options[(Math.random() * options.length) | 0];
        npc.dirX = pick[0];
        npc.dirY = pick[1];
      } else {
        npc.dirX = 0;
        npc.dirY = 0;
      }
      npc.timer = 0.6 + Math.random() * 1.4;
    }
    npc.x += npc.dirX * speed * dt;
    npc.y += npc.dirY * speed * dt;
    if (!this.canNpcStand(npc.x, npc.y)) {
      npc.x -= npc.dirX * speed * dt;
      npc.y -= npc.dirY * speed * dt;
      npc.timer = 0;
    }
  };

  Game.prototype.canNpcStand = function (x, y) {
    var k = this.cell(x, y);
    return k === CELL.SIDEWALK || k === CELL.CROSSWALK;
  };

  Game.prototype.updateCrowd = function (dt) {
    for (var i = 0; i < this.people.length; i++) this.sidewalkStep(this.people[i], dt, NPC_SPEED);
    for (var j = 0; j < this.dogs.length; j++) this.sidewalkStep(this.dogs[j], dt, NPC_SPEED * 1.15);
  };

  Game.prototype.say = function (text, t) {
    this.message = text;
    this.messageT = t == null ? 1.6 : t;
  };

  Game.prototype.carClearance = function (ent, car) {
    var dx = Math.max(0, Math.abs(ent.x - car.x) - car.w / 2);
    var dy = Math.max(0, Math.abs(ent.y - car.y) - car.h / 2);
    return hypot(dx, dy);
  };

  Game.prototype.interruptNear = function () {
    var m = this.momo;
    var w = this.walker;
    var r = this.interruptR;
    var pr = this.peemailR;
    var cr = this.carSpookR;
    for (var i = 0; i < this.people.length; i++) {
      if (dist(m, this.people[i]) < r || dist(w, this.people[i]) < r) return "person";
    }
    for (var j = 0; j < this.dogs.length; j++) {
      if (dist(m, this.dogs[j]) < r || dist(w, this.dogs[j]) < r) return "dog";
    }
    for (var k = 0; k < this.peemail.length; k++) {
      if (dist(m, this.peemail[k]) < pr || dist(w, this.peemail[k]) < pr) return "pee-mail";
    }
    for (var c = 0; c < this.cars.length; c++) {
      var car = this.cars[c];
      if (this.carClearance(m, car) < cr || this.carClearance(w, car) < cr) return "car";
    }
    return null;
  };

  Game.prototype.advanceLevel = function () {
    this.reset((this.map.seed + 1) >>> 0, this.level + 1);
  };

  Game.prototype.startOver = function (freshNeighborhood) {
    if (freshNeighborhood) this.originSeed = (this.map.seed + 1) >>> 0;
    this.reset(this.originSeed, 1);
  };

  Game.prototype.applyInterrupt = function (kind) {
    var hadProgress = this.poop > 0;
    this.poop = 0;
    this.interruptFlash = 0.7;
    this.interruptKind = kind;
    if (hadProgress) this.say("Interrupted — " + kind + "!", 1.6);
    else this.say("Too busy — " + kind + ".", 1.1);
  };

  Game.prototype.updatePace = function (dt, moving) {
    if (this.didPoop) return;
    var onGrass = this.cell(this.momo.x, this.momo.y) === CELL.GRASS;
    if (!onGrass) {
      if (this.poop > 0 && this.poop < 1) this.poop = Math.max(0, this.poop - dt * 0.15);
      return;
    }
    if (moving) {
      this.say("Stand still to pace.", 0.8);
      return;
    }
    var spook = this.interruptNear();
    if (spook) {
      this.applyInterrupt(spook);
      return;
    }
    this.poop = Math.min(1, this.poop + dt / PACE_TIME);
    this.say("Pacing…", 0.4);
    if (this.poop >= 1) {
      this.didPoop = true;
      this.poop = 1;
      this.say("Good dump. Get home.", 2.4);
    }
  };

  Game.prototype.updateOutcome = function () {
    if (this.state !== "play") return;
    var kind = this.cell(this.walker.x, this.walker.y);
    if (!this.hasLeftHome) {
      if (kind === CELL.GRASS || kind === CELL.CROSSWALK || kind === CELL.SIDEWALK) {
        this.hasLeftHome = true;
      }
    }

    if (this.clock <= 0) {
      this.state = "lost";
      this.endCopy = "He can hold it. You cannot.";
      return;
    }
    if (this.hasLeftHome && kind === CELL.HOME) {
      if (this.didPoop) {
        this.state = "won";
        this.endCopy = "Good boy.";
      } else {
        this.state = "lost";
        this.endCopy = "You left it.";
      }
    }
  };

  Game.prototype.update = function (dt, input) {
    this.time += dt;
    if (this.messageT > 0) this.messageT -= dt;
    if (this.interruptFlash > 0) this.interruptFlash -= dt;
    else this.interruptKind = null;

    if (this.state !== "play") {
      if (input.consumeRestart()) {
        if (this.state === "won") this.advanceLevel();
        else this.startOver(false);
      }
      if (input.consumeNewBlock()) {
        if (this.state === "won") this.advanceLevel();
        else this.startOver(true);
      }
      return;
    }

    if (input.consumeRestart()) {
      this.reset(this.map.seed, this.level);
      return;
    }
    if (input.consumeNewBlock()) {
      this.reset((this.map.seed + 1) >>> 0, this.level);
      return;
    }

    var axis = input.axis();
    var walk = this.updateWalker(dt, axis);
    this.updateMomo(dt);
    this.updateCars(dt);
    this.updateCrowd(dt);
    this.updatePace(dt, walk.moving);
    this.clock -= dt;
    this.updateOutcome();
  };

  Game.prototype.ink = function (ctx) {
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
  };

  Game.prototype.patterns = function (ctx) {
    if (this._pats) return this._pats;
    function pat(dots, size) {
      var n = size || 4;
      var c = document.createElement("canvas");
      c.width = n;
      c.height = n;
      var g = c.getContext("2d");
      g.fillStyle = BG;
      g.fillRect(0, 0, n, n);
      g.fillStyle = INK;
      for (var i = 0; i < dots.length; i++) {
        var p = dots[i];
        g.fillRect(p[0], p[1], p[2] || 1, p[3] || 1);
      }
      return ctx.createPattern(c, "repeat");
    }
    this._pats = {
      grass: pat(
        [
          [1, 0, 1, 2],
          [0, 1],
          [5, 1, 1, 2],
          [2, 3],
          [6, 2],
          [0, 5, 1, 2],
          [1, 6],
          [3, 6, 1, 2],
          [7, 4],
          [6, 6, 1, 2],
          [4, 7],
        ],
        8
      ),
      home: pat([
        [0, 0],
        [2, 1],
        [1, 2],
      ]),
      drive: pat([
        [0, 0],
        [1, 1],
        [2, 2],
        [3, 3],
      ]),
      fence: pat([
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 3],
        [2, 0],
        [2, 1],
        [2, 2],
        [2, 3],
      ]),
      yard: pat([
        [1, 1],
        [3, 3],
      ]),
    };
    return this._pats;
  };

  Game.prototype.drawYardDither = function (ctx) {
    ctx.fillStyle = BG;
    ctx.fillRect(this.cam.x, this.cam.y, VIEW_W, VIEW_H);
  };

  Game.prototype.drawCells = function (ctx) {
    var pats = this.patterns(ctx);
    var i;
    var worldW = this.map.worldW;
    var worldH = this.map.worldH;

    ctx.fillStyle = WALK;
    for (i = 0; i < this.map.vStreets.length; i++) {
      var vs = this.map.vStreets[i];
      ctx.fillRect(vs.walkL0, 0, vs.walkL1 - vs.walkL0, worldH);
      ctx.fillRect(vs.walkR0, 0, vs.walkR1 - vs.walkR0, worldH);
      this.drawPavers(ctx, vs.walkL0, 0, vs.walkL1 - vs.walkL0, worldH);
      this.drawPavers(ctx, vs.walkR0, 0, vs.walkR1 - vs.walkR0, worldH);
    }
    for (i = 0; i < this.map.hStreets.length; i++) {
      var hs = this.map.hStreets[i];
      ctx.fillRect(0, hs.walkT0, worldW, hs.walkT1 - hs.walkT0);
      ctx.fillRect(0, hs.walkB0, worldW, hs.walkB1 - hs.walkB0);
      this.drawPavers(ctx, 0, hs.walkT0, worldW, hs.walkT1 - hs.walkT0);
      this.drawPavers(ctx, 0, hs.walkB0, worldW, hs.walkB1 - hs.walkB0);
    }

    ctx.fillStyle = ROAD;
    for (i = 0; i < this.map.vStreets.length; i++) {
      vs = this.map.vStreets[i];
      ctx.fillRect(vs.asphalt0, 0, vs.asphalt1 - vs.asphalt0, worldH);
    }
    for (i = 0; i < this.map.hStreets.length; i++) {
      hs = this.map.hStreets[i];
      ctx.fillRect(0, hs.asphalt0, worldW, hs.asphalt1 - hs.asphalt0);
    }

    ctx.fillStyle = CURB;
    for (i = 0; i < this.map.vStreets.length; i++) {
      vs = this.map.vStreets[i];
      ctx.fillRect(vs.asphalt0, 0, 1, worldH);
      ctx.fillRect(vs.asphalt1 - 1, 0, 1, worldH);
    }
    for (i = 0; i < this.map.hStreets.length; i++) {
      hs = this.map.hStreets[i];
      ctx.fillRect(0, hs.asphalt0, worldW, 1);
      ctx.fillRect(0, hs.asphalt1 - 1, worldW, 1);
    }

    for (i = 0; i < this.map.vStreets.length; i++) {
      vs = this.map.vStreets[i];
      this.drawLaneDashes(ctx, vs.asphaltCenter, 0, worldH, true);
    }
    for (i = 0; i < this.map.hStreets.length; i++) {
      hs = this.map.hStreets[i];
      this.drawLaneDashes(ctx, hs.asphaltCenter, 0, worldW, false);
    }

    this.ink(ctx);
    for (i = 0; i < this.map.vStreets.length; i++) {
      vs = this.map.vStreets[i];
      for (var j = 0; j < this.map.hStreets.length; j++) {
        hs = this.map.hStreets[j];
        this.drawZebra(ctx, vs.walkL0, hs.asphalt0, vs.walkL1, hs.asphalt1, true);
        this.drawZebra(ctx, vs.walkR0, hs.asphalt0, vs.walkR1, hs.asphalt1, true);
        this.drawZebra(ctx, vs.asphalt0, hs.walkT0, vs.asphalt1, hs.walkT1, false);
        this.drawZebra(ctx, vs.asphalt0, hs.walkB0, vs.asphalt1, hs.walkB1, false);
      }
    }

    var c0 = Math.max(0, Math.floor(this.cam.x / CELL_SIZE) - 1);
    var r0 = Math.max(0, Math.floor(this.cam.y / CELL_SIZE) - 1);
    var c1 = Math.min(this.map.gridW, Math.ceil((this.cam.x + VIEW_W) / CELL_SIZE) + 1);
    var r1 = Math.min(this.map.gridH, Math.ceil((this.cam.y + VIEW_H) / CELL_SIZE) + 1);
    var c, r, kind, x, y;
    for (r = r0; r < r1; r++) {
      for (c = c0; c < c1; c++) {
        kind = Map.getCell(this.map.cells, c, r);
        x = c * CELL_SIZE;
        y = r * CELL_SIZE;
        if (kind === CELL.YARD) {
          ctx.fillStyle = pats.yard;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        } else if (kind === CELL.FENCE) {
          ctx.fillStyle = pats.fence;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
          this.ink(ctx);
          ctx.fillRect(x, y, CELL_SIZE, 1);
          ctx.fillRect(x, y + CELL_SIZE - 1, CELL_SIZE, 1);
        } else if (kind === CELL.DRIVEWAY) {
          ctx.fillStyle = pats.drive;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        } else if (kind === CELL.GRASS) {
          ctx.fillStyle = pats.grass;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        } else if (kind === CELL.HOME) {
          ctx.fillStyle = pats.home;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        }
      }
    }

    ctx.fillStyle = pats.home;
    var path = this.map.home.path;
    ctx.fillRect(path.x0, path.y0, path.x1 - path.x0, path.y1 - path.y0);
    var stoop = this.map.home.stoop;
    ctx.fillRect(stoop.x - 4, stoop.y - 3, 8, 6);
  };

  Game.prototype.drawPavers = function (ctx, x, y, w, h) {
    var x0 = Math.max(x, this.cam.x - 2);
    var y0 = Math.max(y, this.cam.y - 2);
    var x1 = Math.min(x + w, this.cam.x + VIEW_W + 2);
    var y1 = Math.min(y + h, this.cam.y + VIEW_H + 2);
    if (x1 <= x0 || y1 <= y0) return;
    ctx.fillStyle = WALK_LINE;
    var step = 10;
    var xx;
    var yy;
    for (xx = Math.floor(x0 / step) * step; xx < x1; xx += step) {
      if (xx >= x0) ctx.fillRect(xx, y0, 1, y1 - y0);
    }
    for (yy = Math.floor(y0 / step) * step; yy < y1; yy += step) {
      if (yy >= y0) ctx.fillRect(x0, yy, x1 - x0, 1);
    }
  };

  Game.prototype.drawLaneDashes = function (ctx, center, a0, a1, vertical) {
    ctx.fillStyle = BG;
    var t;
    var vis0;
    var vis1;
    if (vertical) {
      vis0 = Math.max(a0, this.cam.y - 12);
      vis1 = Math.min(a1, this.cam.y + VIEW_H + 12);
    } else {
      vis0 = Math.max(a0, this.cam.x - 12);
      vis1 = Math.min(a1, this.cam.x + VIEW_W + 12);
    }
    for (t = Math.floor(vis0 / 12) * 12; t < vis1; t += 12) {
      if (vertical) {
        if (this.cell(center, t + 3) === CELL.CROSSWALK) continue;
        ctx.fillRect(Math.floor(center) - 1, t, 2, 6);
      } else {
        if (this.cell(t + 3, center) === CELL.CROSSWALK) continue;
        ctx.fillRect(t, Math.floor(center) - 1, 6, 2);
      }
    }
  };

  Game.prototype.drawZebra = function (ctx, x0, y0, x1, y1, verticalWalk) {
    var x = Math.floor(x0);
    var y = Math.floor(y0);
    var w = Math.ceil(x1) - x;
    var h = Math.ceil(y1) - y;
    ctx.fillStyle = BG;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = INK;
    if (verticalWalk) {
      for (var yy = y; yy < y + h; yy++) {
        if (Math.floor((yy - y) / 4) % 2 === 0) ctx.fillRect(x, yy, w, 2);
      }
    } else {
      for (var xx = x; xx < x + w; xx++) {
        if (Math.floor((xx - x) / 4) % 2 === 0) ctx.fillRect(xx, y, 2, h);
      }
    }
  };

  Game.prototype.drawBuildings = function (ctx) {
    this.ink(ctx);
    for (var i = 0; i < this.map.buildings.length; i++) {
      var b = this.map.buildings[i];
      if (b.x + b.w < this.cam.x - 4 || b.x > this.cam.x + VIEW_W + 4) continue;
      if (b.y + b.h < this.cam.y - 8 || b.y > this.cam.y + VIEW_H + 4) continue;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = BG;
      ctx.fillRect(b.x + 4, b.y + 6, 5, 5);
      if (b.w > 24) ctx.fillRect(b.x + b.w - 10, b.y + 6, 5, 5);
      if (b.home) ctx.fillRect(b.x + b.w / 2 - 3, b.y + b.h - 10, 6, 10);
      this.ink(ctx);
      if (b.roof) ctx.fillRect(b.x + 2, b.y - 5, b.w - 4, 5);
    }
  };

  Game.prototype.drawActors = function (ctx) {
    this.ink(ctx);
    var i;
    for (i = 0; i < this.peemail.length; i++) {
      var m = this.peemail[i];
      ctx.fillRect(m.x - 2, m.y - 1, 4, 3);
    }
    for (i = 0; i < this.cars.length; i++) {
      var c = this.cars[i];
      ctx.fillRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h);
      ctx.fillStyle = BG;
      ctx.fillRect(c.x - 2, c.y - 2, 4, 4);
      this.ink(ctx);
    }
    for (i = 0; i < this.people.length; i++) {
      var p = this.people[i];
      ctx.fillRect(p.x - 3, p.y - 8, 6, 11);
    }
    for (i = 0; i < this.dogs.length; i++) {
      var d = this.dogs[i];
      ctx.fillRect(d.x - 5, d.y - 3, 9, 6);
      ctx.fillRect(d.x + 3, d.y - 5, 3, 3);
    }

    ctx.beginPath();
    ctx.moveTo(this.walker.x, this.walker.y - 6);
    ctx.lineTo(this.momo.x, this.momo.y - 2);
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = BG;
    ctx.fillRect(this.walker.x - 4, this.walker.y - 12, 9, 14);
    this.ink(ctx);
    ctx.fillRect(this.walker.x - 3, this.walker.y - 11, 7, 12);
    ctx.fillStyle = BG;
    ctx.fillRect(this.walker.x - 1, this.walker.y - 9, 3, 3);
    this.ink(ctx);

    var mx = this.momo.x;
    var my = this.momo.y;
    ctx.fillStyle = BG;
    ctx.fillRect(mx - 6, my - 8, 13, 12);
    this.ink(ctx);
    ctx.fillRect(mx - 5, my - 6, 10, 9);
    ctx.fillRect(mx - 6, my - 8, 5, 5);
    ctx.fillRect(mx + 2, my - 8, 5, 5);
    ctx.fillStyle = BG;
    ctx.fillRect(mx - 1, my - 2, 3, 3);
    this.ink(ctx);
    if (this.interruptFlash > 0) {
      ctx.fillStyle = BG;
      ctx.fillRect(mx - 12, my - 18, 24, 6);
      ctx.fillRect(mx - 13, my - 12, 5, 5);
      ctx.fillRect(mx + 8, my - 12, 5, 5);
      this.ink(ctx);
      ctx.fillRect(mx - 2, my - 21, 3, 6);
      ctx.fillRect(mx + 8, my - 16, 3, 3);
      ctx.fillRect(mx - 11, my - 16, 3, 3);
    }
  };

  Game.prototype.drawHud = function (ctx) {
    this.ink(ctx);
    ctx.fillRect(0, 0, VIEW_W, 12);
    ctx.fillStyle = BG;
    ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline = "top";
    ctx.fillText(formatClock(this.clock), 4, 2);
    ctx.fillText("L" + this.level, 36, 2);
    ctx.fillText(this.didPoop ? "POOP OK" : "POOP", 56, 2);
    var meterX = 96;
    ctx.fillRect(meterX, 3, 42, 6);
    ctx.fillStyle = INK;
    ctx.fillRect(meterX + 1, 4, 40, 4);
    ctx.fillStyle = BG;
    ctx.fillRect(meterX + 1, 4, Math.floor(40 * this.poop), 4);
    if (this.interruptFlash > 0) {
      ctx.fillStyle = BG;
      ctx.fillRect(meterX, 3, 42, 6);
      this.ink(ctx);
      ctx.fillRect(meterX + 1, 4, 40, 4);
      ctx.fillStyle = BG;
      ctx.fillRect(meterX + 2, 4, 4, 4);
      ctx.fillRect(meterX + 10, 4, 4, 4);
      ctx.fillRect(meterX + 18, 4, 4, 4);
      ctx.fillRect(meterX + 26, 4, 4, 4);
      ctx.fillRect(meterX + 34, 4, 4, 4);
    }
    ctx.fillStyle = BG;
    var hint = this.messageT > 0 ? this.message : this.didPoop ? "Home before work." : "Sidewalks. Crosswalks. Grass.";
    ctx.fillText(hint, 144, 2);

    if (this.state !== "play") {
      ctx.fillStyle = BG;
      ctx.fillRect(48, 70, 304, 100);
      this.ink(ctx);
      ctx.fillRect(50, 72, 300, 96);
      ctx.fillStyle = BG;
      ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(this.endCopy, 62, 90);
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      if (this.state === "won") {
        ctx.fillText("Enter / A — next level (" + (this.level + 1) + ")", 62, 118);
        ctx.fillText("N / B — next neighborhood", 62, 134);
      } else {
        ctx.fillText("Enter / A — start over (level 1)", 62, 118);
        ctx.fillText("N / B — new neighborhood (level 1)", 62, 134);
      }
    }
  };

  Game.prototype.drawDebug = function (ctx) {
    if (!this.debug) return;
    this.ink(ctx);
    var lots = this.map.lots;
    for (var i = 0; i < lots.length; i++) {
      var lot = lots[i];
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.strokeRect(lot.x0 + 0.5, lot.y0 + 0.5, lot.x1 - lot.x0 - 1, lot.y1 - lot.y0 - 1);
    }
    if (this.map.tutorialGrass) {
      ctx.fillStyle = INK;
      var g = this.map.tutorialGrass;
      ctx.fillRect(g.x, g.y, 2, g.h);
      ctx.fillRect(g.x + g.w - 2, g.y, 2, g.h);
    }
  };

  Game.prototype.draw = function (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, VIEW_H);
    ctx.clip();
    ctx.translate(-this.cam.x, -this.cam.y);
    this.drawYardDither(ctx);
    this.drawCells(ctx);
    this.drawBuildings(ctx);
    this.drawActors(ctx);
    this.drawDebug(ctx);
    ctx.restore();
    this.drawHud(ctx);
  };

  root.GoMomoGame = {
    Game: Game,
    BG: BG,
    INK: INK,
    ROAD: ROAD,
    WALK: WALK,
    CLOCK: CLOCK,
    CLOCK_STEP: CLOCK_STEP,
    CLOCK_MIN: CLOCK_MIN,
    clockForLevel: clockForLevel,
    INTERRUPT_R: INTERRUPT_R,
    PEEMAIL_R: PEEMAIL_R,
    CAR_SPOOK_R: CAR_SPOOK_R,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.GoMomoGame;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
