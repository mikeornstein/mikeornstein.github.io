// Arcade loop: leave home, sidewalks, crosswalks, pace on grass, home before clock.
// Camera is a 400×240 window on a larger cell-grid neighborhood; walking off a
// screen edge snaps (no smooth pan).
(function (root) {
  "use strict";

  var Map = root.GoMomoMap;
  var Dither = root.GoMomoDither;
  var Art = root.GoMomoArt;
  var Font = root.GoMomoFont;
  var CELL = Map.CELL;
  var VIEW_W = Map.VIEW_W;
  var VIEW_H = Map.VIEW_H;
  var CELL_SIZE = Map.CELL_SIZE;

  var BG = Dither ? Dither.BG : "#c9d63a";
  var INK = Dither ? Dither.INK : "#2a1c12";
  // Pre-dither greys only. The LCD pass quantizes to BG/INK. Not shown as fills.
  var PRE = {
    road: "#1a1612",
    walk: "#b7c25c",
    walkLine: "#6a5c32",
    yard: "#9aaa48",
    drive: "#5a4c28",
  };

  var COPY = {
    win: "Good boy.",
    clock: "Late for work.",
    house: "Home before poop. Accident inside.",
    splashTitle: "Go Momo Go",
    splashSub: "Poop. Then home.",
    splashStart: "A / B  -  start day 1",
    pause: "PAUSED",
    resume: "A  Resume",
    restartDay: "B  Restart at day 1",
  };
  // Lime band for the procedural fallback splash only. Art Director splash.png
  // is blitted full-canvas (title already in the bitmap).
  var SPLASH_TITLE_BAND = 102;

  var CAR_W_X = 20;
  var CAR_H_X = 12;
  var CAR_W_Y = 12;
  var CAR_H_Y = 20;
  var WALK_SPEED = 60;
  var WALK_SLOW = 0.46;
  var CAR_SPEED = 36;
  var NPC_SPEED = 18;
  var DOG_LEASH = 11;
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
    this.bestDay = this.readBestDay();
    this.art = Art ? new Art.Art() : null;
    this.reset(this.originSeed, 1);
    this.state = "splash";
  }

  Game.prototype.storage = function () {
    try {
      if (typeof localStorage === "undefined") return null;
      return localStorage;
    } catch (err) {
      return null;
    }
  };

  Game.prototype.readBestDay = function () {
    var store = this.storage();
    if (!store) return 1;
    var n = parseInt(store.getItem("gomomo-best-day"), 10);
    return n >= 1 ? n : 1;
  };

  Game.prototype.noteBestDay = function () {
    if (this.level > this.bestDay) this.bestDay = this.level;
    var store = this.storage();
    if (store) {
      try {
        store.setItem("gomomo-best-day", String(this.bestDay));
      } catch (err) {
        /* file:// or private mode */
      }
    }
  };

  Game.prototype.dayLabel = function () {
    return "D" + this.level;
  };

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
        w: c.axis === "x" ? CAR_W_X : CAR_W_Y,
        h: c.axis === "x" ? CAR_H_X : CAR_H_Y,
        turnLock: 0,
      };
    });
    this.people = this.map.spawns.people.map(function (p) {
      return {
        x: p.x,
        y: p.y,
        dirX: 0,
        dirY: 0,
        kind: p.kind || "person",
        timer: 0,
        wait: p.wait || 0,
        wp: p.wp || 0,
        waypoints: p.waypoints ? p.waypoints.slice() : [],
        dropT: p.dropT == null ? 3 : p.dropT,
        homeX: p.homeX,
        homeY: p.homeY,
      };
    });
    this.dogs = this.map.spawns.dogs.map(function (d) {
      return {
        x: d.x,
        y: d.y,
        dirX: 0,
        dirY: 0,
        kind: "dog",
        ownerIndex: d.ownerIndex,
        timer: 0,
      };
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
    this.endReason = null;
    this.endCopy = "";
    this.message = "Get Momo to the grass.";
    this.messageT = 2.2;
    this.stun = 0;
    this.interruptFlash = 0;
    this.interruptKind = null;
    this.interruptTarget = null;
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
      return { moving: false, slow: null };
    }
    var moving = axis.x !== 0 || axis.y !== 0;
    var slow = this.crowdSlow();
    if (moving) {
      this.walker.facingX = axis.x;
      this.walker.facingY = axis.y;
      var speed = WALK_SPEED * slow.mul;
      this.tryMove(this.walker, axis.x * speed * dt, axis.y * speed * dt);
      this.walker.x = clamp(this.walker.x, 1, this.map.worldW - 2);
      this.walker.y = clamp(this.walker.y, 1, this.map.worldH - 2);
      this.snapCamera();
      if (slow.hit) this.say("Slow — " + slow.hit.kind + ".", 0.7);
    }
    return { moving: moving, slow: slow.hit };
  };

  Game.prototype.crowdSlow = function () {
    var hit = this.interruptHit();
    if (!hit) return { mul: 1, hit: null };
    return { mul: WALK_SLOW, hit: hit };
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
        car.w = car.axis === "x" ? CAR_W_X : CAR_W_Y;
        car.h = car.axis === "x" ? CAR_H_X : CAR_H_Y;
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

  Game.prototype.followWaypoints = function (npc, dt, speed) {
    if (npc.wait > 0) {
      npc.wait -= dt;
      npc.dirX = 0;
      npc.dirY = 0;
      return;
    }
    var wps = npc.waypoints;
    if (!wps || !wps.length) {
      this.sidewalkStep(npc, dt, speed);
      return;
    }
    if (npc.wp >= wps.length) {
      npc.wp = 0;
      npc.wait = 1.4 + Math.random() * 2.2;
      npc.x = npc.homeX != null ? npc.homeX : wps[0].x;
      npc.y = npc.homeY != null ? npc.homeY : wps[0].y;
      return;
    }
    var t = wps[npc.wp];
    var dx = t.x - npc.x;
    var dy = t.y - npc.y;
    var d = hypot(dx, dy);
    if (d < 5) {
      npc.wp += 1;
      return;
    }
    var dirX;
    var dirY;
    if (Math.abs(dx) > Math.abs(dy)) {
      dirX = dx < 0 ? -1 : 1;
      dirY = 0;
    } else {
      dirX = 0;
      dirY = dy < 0 ? -1 : 1;
    }
    var stepX = dirX * speed * dt;
    var stepY = dirY * speed * dt;
    if (!this.canNpcStand(npc.x + stepX, npc.y + stepY)) {
      if (dirX !== 0 && this.canNpcStand(npc.x, npc.y + (dy < 0 ? -speed * dt : speed * dt))) {
        dirX = 0;
        dirY = dy < 0 ? -1 : 1;
        stepX = 0;
        stepY = dirY * speed * dt;
      } else if (dirY !== 0 && this.canNpcStand(npc.x + (dx < 0 ? -speed * dt : speed * dt), npc.y)) {
        dirY = 0;
        dirX = dx < 0 ? -1 : 1;
        stepX = dirX * speed * dt;
        stepY = 0;
      }
    }
    npc.dirX = dirX;
    npc.dirY = dirY;
    npc.x += stepX;
    npc.y += stepY;
    if (!this.canNpcStand(npc.x, npc.y)) {
      npc.x -= stepX;
      npc.y -= stepY;
      npc.wp += 1;
    }
  };

  Game.prototype.followOwner = function (dog, dt) {
    var owner = this.people[dog.ownerIndex];
    if (!owner) return;
    var behindX = owner.x - (owner.dirX || 0) * DOG_LEASH;
    var behindY = owner.y - (owner.dirY || 0) * DOG_LEASH;
    if (owner.dirX === 0 && owner.dirY === 0) {
      behindX = owner.x - DOG_LEASH;
      behindY = owner.y;
    }
    if (!this.canNpcStand(behindX, behindY)) {
      var alts = [
        [owner.x - DOG_LEASH, owner.y],
        [owner.x + DOG_LEASH, owner.y],
        [owner.x, owner.y - DOG_LEASH],
        [owner.x, owner.y + DOG_LEASH],
      ];
      var a;
      behindX = owner.x;
      behindY = owner.y;
      for (a = 0; a < alts.length; a++) {
        if (this.canNpcStand(alts[a][0], alts[a][1])) {
          behindX = alts[a][0];
          behindY = alts[a][1];
          break;
        }
      }
    }
    var dx = behindX - dog.x;
    var dy = behindY - dog.y;
    var d = hypot(dx, dy);
    var pull = Math.min(NPC_SPEED * 1.45, 12 + d * 2);
    if (d > 1) {
      var nx = dog.x + (dx / d) * pull * dt;
      var ny = dog.y + (dy / d) * pull * dt;
      if (this.canNpcStand(nx, ny)) {
        dog.x = nx;
        dog.y = ny;
      } else if (this.canNpcStand(behindX, behindY)) {
        dog.x = behindX;
        dog.y = behindY;
      }
      dog.dirX = dx < -0.4 ? -1 : dx > 0.4 ? 1 : 0;
      dog.dirY = dy < -0.4 ? -1 : dy > 0.4 ? 1 : 0;
    }
  };

  Game.prototype.dropPeeMail = function (person, dt) {
    if (person.kind === "mimi") return;
    person.dropT -= dt;
    if (person.dropT > 0) return;
    person.dropT = 3.5 + Math.random() * 5;
    var cap = 8 + this.level * 3;
    if (this.peemail.length >= cap) return;
    if (!this.canNpcStand(person.x, person.y)) return;
    var t = this.map.tutorialGrass;
    if (t && hypot(person.x - t.cx, person.y - t.cy) < CELL_SIZE * 3) return;
    this.peemail.push({ x: person.x, y: person.y });
  };

  Game.prototype.updateCrowd = function (dt) {
    var i;
    for (i = 0; i < this.people.length; i++) {
      var speed = this.people[i].kind === "mimi" ? NPC_SPEED * 0.82 : NPC_SPEED;
      this.followWaypoints(this.people[i], dt, speed);
      this.dropPeeMail(this.people[i], dt);
    }
    for (i = 0; i < this.dogs.length; i++) this.followOwner(this.dogs[i], dt);
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

  Game.prototype.interruptHit = function () {
    var m = this.momo;
    var w = this.walker;
    var r = this.interruptR;
    var pr = this.peemailR;
    var cr = this.carSpookR;
    for (var i = 0; i < this.people.length; i++) {
      if (dist(m, this.people[i]) < r || dist(w, this.people[i]) < r) {
        var kind = this.people[i].kind === "mimi" ? "mimi" : "person";
        return { kind: kind, target: this.people[i] };
      }
    }
    for (var j = 0; j < this.dogs.length; j++) {
      if (dist(m, this.dogs[j]) < r || dist(w, this.dogs[j]) < r) {
        return { kind: "dog", target: this.dogs[j] };
      }
    }
    for (var k = 0; k < this.peemail.length; k++) {
      if (dist(m, this.peemail[k]) < pr || dist(w, this.peemail[k]) < pr) {
        return { kind: "pee-mail", target: this.peemail[k] };
      }
    }
    for (var c = 0; c < this.cars.length; c++) {
      var car = this.cars[c];
      if (this.carClearance(m, car) < cr || this.carClearance(w, car) < cr) {
        return { kind: "car", target: car };
      }
    }
    return null;
  };

  Game.prototype.interruptNear = function () {
    var hit = this.interruptHit();
    return hit ? hit.kind : null;
  };

  Game.prototype.advanceLevel = function () {
    this.reset((this.map.seed + 1) >>> 0, this.level + 1);
  };

  Game.prototype.startOver = function (freshNeighborhood) {
    if (freshNeighborhood) this.originSeed = (this.map.seed + 1) >>> 0;
    this.reset(this.originSeed, 1);
  };

  Game.prototype.applyInterrupt = function (kind, target) {
    var hadProgress = this.poop > 0;
    this.poop = 0;
    this.interruptFlash = 0.7;
    this.interruptKind = kind;
    this.interruptTarget = target || null;
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
    var spook = this.interruptHit();
    if (spook) {
      this.applyInterrupt(spook.kind, spook.target);
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
      this.setEnd("clock");
      return;
    }
    if (this.hasLeftHome && kind === CELL.HOME) {
      if (this.didPoop) this.setEnd("win");
      else this.setEnd("house");
    }
  };

  Game.prototype.setEnd = function (reason) {
    this.endReason = reason;
    this.endCopy = COPY[reason] || "";
    this.state = reason === "win" ? "won" : "lost";
    this.noteBestDay();
  };

  Game.prototype.menuPressed = function (input) {
    return input.consumeMenu ? input.consumeMenu() : false;
  };

  Game.prototype.update = function (dt, input) {
    if (this.state === "splash") {
      this.time += dt;
      if (input.consumeRestart() || input.consumeNewBlock() || this.menuPressed(input)) {
        this.state = "play";
      }
      return;
    }

    if (this.state === "paused") {
      var restartDay = input.consumeNewBlock();
      var resume = input.consumeRestart() || this.menuPressed(input);
      if (restartDay) this.startOver(false);
      else if (resume) this.state = "play";
      return;
    }

    if (this.state !== "play") {
      this.menuPressed(input);
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

    // A/B (Enter/N and face buttons) are splash + pause + end-screen only.
    // Discard so a play-frame press cannot leak into the next overlay.
    input.consumeRestart();
    input.consumeNewBlock();
    if (this.menuPressed(input)) {
      this.state = "paused";
      return;
    }

    this.time += dt;
    if (this.messageT > 0) this.messageT -= dt;
    if (this.interruptFlash > 0) this.interruptFlash -= dt;
    else {
      this.interruptKind = null;
      this.interruptTarget = null;
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

    ctx.fillStyle = PRE.walk;
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

    ctx.fillStyle = PRE.road;
    for (i = 0; i < this.map.vStreets.length; i++) {
      vs = this.map.vStreets[i];
      ctx.fillRect(vs.asphalt0, 0, vs.asphalt1 - vs.asphalt0, worldH);
    }
    for (i = 0; i < this.map.hStreets.length; i++) {
      hs = this.map.hStreets[i];
      ctx.fillRect(0, hs.asphalt0, worldW, hs.asphalt1 - hs.asphalt0);
    }

    this.ink(ctx);
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
          ctx.fillStyle = PRE.yard;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
          ctx.fillStyle = pats.yard;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        } else if (kind === CELL.FENCE) {
          ctx.fillStyle = pats.grass;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
          if (this.art) {
            this.art.drawFence(ctx, x, y, CELL_SIZE, {
              N: Map.getCell(this.map.cells, c, r - 1) === CELL.FENCE,
              S: Map.getCell(this.map.cells, c, r + 1) === CELL.FENCE,
              E: Map.getCell(this.map.cells, c + 1, r) === CELL.FENCE,
              W: Map.getCell(this.map.cells, c - 1, r) === CELL.FENCE,
            });
          } else {
            ctx.fillStyle = pats.fence;
            ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
          }
        } else if (kind === CELL.DRIVEWAY) {
          ctx.fillStyle = PRE.drive;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
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
    ctx.fillStyle = PRE.walkLine;
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
    for (var i = 0; i < this.map.buildings.length; i++) {
      var b = this.map.buildings[i];
      if (b.x + b.w < this.cam.x - 4 || b.x > this.cam.x + VIEW_W + 4) continue;
      if (b.y + b.h < this.cam.y - 8 || b.y > this.cam.y + VIEW_H + 4) continue;
      if (this.art) {
        this.art.drawHouse(ctx, b);
      } else {
        this.ink(ctx);
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = BG;
        ctx.fillRect(b.x + 4, b.y + 6, 5, 5);
        if (b.w > 24) ctx.fillRect(b.x + b.w - 10, b.y + 6, 5, 5);
        this.ink(ctx);
      }
    }
  };

  Game.prototype.isFlashing = function (ent) {
    return this.interruptFlash > 0 && this.interruptTarget === ent;
  };

  Game.prototype.flashPulse = function () {
    return ((this.time * 10) | 0) % 2 === 0;
  };

  Game.prototype.drawFlashBox = function (ctx, x, y, w, h) {
    var pulse = this.flashPulse();
    var fx = Math.floor(x);
    var fy = Math.floor(y);
    ctx.fillStyle = pulse ? BG : INK;
    ctx.fillRect(fx - 4, fy - 10, w + 8, h + 14);
    ctx.fillStyle = pulse ? INK : BG;
    ctx.fillRect(fx - 2, fy - 2, w + 4, h + 4);
    ctx.fillStyle = pulse ? BG : INK;
    ctx.fillRect(fx, fy, w, h);
  };

  Game.prototype.drawFlashMark = function (ctx, x, y) {
    var pulse = this.flashPulse();
    var mx = Math.floor(x);
    var my = Math.floor(y);
    ctx.fillStyle = pulse ? INK : BG;
    ctx.fillRect(mx - 3, my - 16, 7, 10);
    ctx.fillRect(mx - 3, my - 5, 7, 4);
    ctx.fillStyle = pulse ? BG : INK;
    ctx.fillRect(mx - 1, my - 14, 3, 6);
    ctx.fillRect(mx - 1, my - 4, 3, 2);
  };

  Game.prototype.drawEndCopy = function (ctx, text, x, y, scale) {
    scale = scale || 2;
    var raw = String(text || "");
    var parts = raw.split(". ");
    var lh = Font.H * scale + 4;
    var i;
    if (parts.length < 2) {
      Font.draw(ctx, raw, x, y, { scale: scale, color: BG });
      return { lines: 1, h: Font.H * scale };
    }
    for (i = 0; i < parts.length; i++) {
      var line = parts[i];
      if (i < parts.length - 1 && line.charAt(line.length - 1) !== ".") line += ".";
      Font.draw(ctx, line, x, y + i * lh, { scale: scale, color: BG });
    }
    return { lines: parts.length, h: parts.length * lh - 4 };
  };

  Game.prototype.drawCar = function (ctx, c) {
    var x = Math.floor(c.x - c.w / 2);
    var y = Math.floor(c.y - c.h / 2);
    if (this.isFlashing(c)) {
      this.drawFlashBox(ctx, x, y, c.w, c.h);
      this.drawFlashMark(ctx, c.x, y);
    }
    if (this.art && this.art.tryBlitCar(ctx, c, x, y)) return;
    this.ink(ctx);
    ctx.fillRect(x, y, c.w, c.h);
    ctx.fillStyle = BG;
    ctx.fillRect(x + 1, y + 1, Math.max(1, c.w - 2), Math.max(1, c.h - 2));
    ctx.fillStyle = "#7a6a38";
    if (c.axis === "x") {
      ctx.fillRect(x + 3, y + 2, 4, Math.max(1, c.h - 4));
      ctx.fillRect(x + c.w - 7, y + 2, 4, Math.max(1, c.h - 4));
    } else {
      ctx.fillRect(x + 2, y + 3, Math.max(1, c.w - 4), 4);
      ctx.fillRect(x + 2, y + c.h - 7, Math.max(1, c.w - 4), 4);
    }
    this.ink(ctx);
    if (c.axis === "x") {
      ctx.fillRect(x + 2, y - 1, 3, 2);
      ctx.fillRect(x + c.w - 5, y - 1, 3, 2);
      ctx.fillRect(x + 2, y + c.h - 1, 3, 2);
      ctx.fillRect(x + c.w - 5, y + c.h - 1, 3, 2);
    } else {
      ctx.fillRect(x - 1, y + 2, 2, 3);
      ctx.fillRect(x + c.w - 1, y + 2, 2, 3);
      ctx.fillRect(x - 1, y + c.h - 5, 2, 3);
      ctx.fillRect(x + c.w - 1, y + c.h - 5, 2, 3);
    }
  };

  Game.prototype.drawActors = function (ctx) {
    this.ink(ctx);
    var i;
    for (i = 0; i < this.peemail.length; i++) {
      var m = this.peemail[i];
      var mx0 = Math.floor(m.x - 3);
      var my0 = Math.floor(m.y - 2);
      if (this.isFlashing(m)) {
        this.drawFlashBox(ctx, mx0, my0, 7, 5);
        this.drawFlashMark(ctx, m.x, my0);
      }
      this.ink(ctx);
      ctx.fillRect(mx0, my0, 6, 4);
      ctx.fillStyle = BG;
      ctx.fillRect(mx0 + 1, my0 + 1, 2, 2);
      this.ink(ctx);
    }
    for (i = 0; i < this.cars.length; i++) this.drawCar(ctx, this.cars[i]);
    for (i = 0; i < this.people.length; i++) {
      var p = this.people[i];
      if (p.kind === "mimi") {
        var mx = Math.floor(p.x - 6);
        var my = Math.floor(p.y - 18);
        if (this.isFlashing(p)) {
          this.drawFlashBox(ctx, mx, my, 12, 20);
          this.drawFlashMark(ctx, p.x, my);
        }
        if (this.art && this.art.tryBlitMimi(ctx, p, mx, my)) continue;
        ctx.fillStyle = this.isFlashing(p) && this.flashPulse() ? BG : INK;
        ctx.fillRect(mx + 2, my + 4, 8, 14);
        ctx.fillRect(mx + 3, my, 6, 6);
        ctx.fillRect(mx + 4, my - 2, 4, 3);
        ctx.fillStyle = this.isFlashing(p) && this.flashPulse() ? INK : BG;
        ctx.fillRect(mx + 5, my + 3, 2, 2);
        continue;
      }
      var px = Math.floor(p.x - 3);
      var py = Math.floor(p.y - 8);
      if (this.isFlashing(p)) {
        this.drawFlashBox(ctx, px, py, 6, 11);
        this.drawFlashMark(ctx, p.x, py);
      }
      ctx.fillStyle = this.isFlashing(p) && this.flashPulse() ? BG : INK;
      ctx.fillRect(px, py, 6, 11);
      ctx.fillStyle = this.isFlashing(p) && this.flashPulse() ? INK : BG;
      ctx.fillRect(px + 2, py + 2, 2, 2);
    }
    for (i = 0; i < this.dogs.length; i++) {
      var d = this.dogs[i];
      var owner = this.people[d.ownerIndex];
      if (owner) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(owner.x, owner.y - 4);
        ctx.lineTo(d.x, d.y);
        ctx.stroke();
      }
      var dx = Math.floor(d.x - 5);
      var dy = Math.floor(d.y - 3);
      if (this.isFlashing(d)) {
        this.drawFlashBox(ctx, dx, dy - 2, 10, 8);
        this.drawFlashMark(ctx, d.x, dy);
      }
      ctx.fillStyle = this.isFlashing(d) && this.flashPulse() ? BG : INK;
      ctx.fillRect(dx, dy, 9, 6);
      ctx.fillRect(dx + 8, dy - 2, 3, 3);
      ctx.fillStyle = this.isFlashing(d) && this.flashPulse() ? INK : BG;
      ctx.fillRect(dx + 2, dy + 1, 2, 2);
    }

    this.ink(ctx);
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
  };

  Game.prototype.drawHud = function (ctx) {
    this.ink(ctx);
    ctx.fillRect(0, 0, VIEW_W, 13);
    var x = 4;
    var y = 3;
    Font.draw(ctx, formatClock(this.clock), x, y, { color: BG });
    x += Font.measure(formatClock(this.clock)).w + 8;
    Font.draw(ctx, this.dayLabel(), x, y, { color: BG });
    x += Font.measure(this.dayLabel()).w + 8;
    var poopLabel = this.didPoop ? "POOP OK" : "POOP";
    Font.draw(ctx, poopLabel, x, y, { color: BG });
    x += Font.measure(poopLabel).w + 8;
    var meterX = x;
    ctx.fillStyle = BG;
    ctx.fillRect(meterX, 3, 42, 7);
    ctx.fillStyle = INK;
    ctx.fillRect(meterX + 1, 4, 40, 5);
    ctx.fillStyle = BG;
    ctx.fillRect(meterX + 1, 4, Math.floor(40 * this.poop), 5);
    if (this.interruptFlash > 0) {
      ctx.fillStyle = BG;
      ctx.fillRect(meterX, 3, 42, 7);
      this.ink(ctx);
      ctx.fillRect(meterX + 1, 4, 40, 5);
      ctx.fillStyle = BG;
      ctx.fillRect(meterX + 2, 4, 4, 5);
      ctx.fillRect(meterX + 10, 4, 4, 5);
      ctx.fillRect(meterX + 18, 4, 4, 5);
      ctx.fillRect(meterX + 26, 4, 4, 5);
      ctx.fillRect(meterX + 34, 4, 4, 5);
    }
    var hint = this.messageT > 0 ? this.message : this.didPoop ? "Home before work." : "Sidewalks. Crosswalks. Grass.";
    Font.draw(ctx, hint, meterX + 48, y, { color: BG });
  };

  Game.prototype.drawEndOverlay = function (ctx) {
    if (this.state !== "won" && this.state !== "lost") return;
    ctx.fillStyle = BG;
    ctx.fillRect(48, 58, 304, 124);
    this.ink(ctx);
    ctx.fillRect(50, 60, 300, 120);
    var copy = this.drawEndCopy(ctx, this.endCopy, 62, 76, 2);
    var hintY = 76 + copy.h + 10;
    Font.draw(ctx, "Day " + this.level + " - best D" + this.bestDay, 62, hintY, { color: BG });
    hintY += Font.H + 6;
    if (this.state === "won") {
      Font.draw(ctx, "Enter / A - next day (" + (this.level + 1) + ")", 62, hintY, { color: BG });
      Font.draw(ctx, "N / B - next neighborhood", 62, hintY + Font.H + 5, { color: BG });
    } else {
      Font.draw(ctx, "Streak over. Enter / A - day 1", 62, hintY, { color: BG });
      Font.draw(ctx, "N / B - new neighborhood (day 1)", 62, hintY + Font.H + 5, { color: BG });
    }
  };

  Game.prototype.drawPauseOverlay = function (ctx) {
    if (this.state !== "paused") return;
    ctx.fillStyle = BG;
    ctx.fillRect(48, 58, 304, 124);
    this.ink(ctx);
    ctx.fillRect(50, 60, 300, 120);
    Font.draw(ctx, COPY.pause, 200, 78, { scale: 2, color: BG, align: "center" });
    Font.draw(ctx, COPY.resume, 62, 116, { color: BG });
    Font.draw(ctx, COPY.restartDay, 62, 132, { color: BG });
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

  Game.prototype.drawSplashScene = function (ctx) {
    if (this.art && this.art.tryBlitSplash(ctx)) {
      this._splashFallback = false;
      return;
    }
    if (this.art && !this.art.ready) {
      this._splashFallback = false;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      return;
    }
    this._splashFallback = true;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.ink(ctx);
    ctx.fillRect(0, 148, VIEW_W, 2);
    var i;
    for (i = 0; i < VIEW_W; i += 6) ctx.fillRect(i, 128, 2, 20);

    var mx = 92;
    var my = 142;
    ctx.fillStyle = BG;
    ctx.fillRect(mx - 7, my - 9, 14, 13);
    this.ink(ctx);
    ctx.fillRect(mx - 6, my - 7, 11, 10);
    ctx.fillRect(mx - 7, my - 9, 5, 5);
    ctx.fillRect(mx + 2, my - 9, 5, 5);
    ctx.fillStyle = BG;
    ctx.fillRect(mx - 1, my - 3, 3, 3);

    this.ink(ctx);
    ctx.beginPath();
    ctx.moveTo(mx + 8, my - 2);
    ctx.lineTo(140, 138);
    ctx.stroke();
    ctx.fillStyle = BG;
    ctx.fillRect(136, 128, 10, 16);
    this.ink(ctx);
    ctx.fillRect(137, 129, 8, 14);
    ctx.fillStyle = BG;
    ctx.fillRect(139, 131, 3, 3);
  };

  Game.prototype.drawSplashUi = function (ctx) {
    if (this._splashFallback) {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, VIEW_W, SPLASH_TITLE_BAND);
      Font.draw(ctx, COPY.splashTitle, 200, 24, { scale: 2, color: INK, align: "center" });
      var tw = Font.measure(COPY.splashTitle, 2).w;
      this.ink(ctx);
      ctx.fillRect(Math.round(200 - tw / 2), 24 + Font.H * 2 + 3, tw, 1);
      Font.draw(ctx, COPY.splashSub, 200, 46, { scale: 1, color: INK, align: "center" });
      Font.draw(ctx, "tmp splash", 200, 62, { color: INK, align: "center" });
    }
    Font.draw(ctx, COPY.splashStart, 8, 222, { color: INK, bg: BG, pad: 2 });
    Font.draw(ctx, "Best  D" + this.bestDay, VIEW_W - 8, 222, { color: INK, bg: BG, pad: 2, align: "right" });
  };

  Game.prototype.ensureWorld = function () {
    if (this._world) return this._worldCtx;
    var c = document.createElement("canvas");
    c.width = VIEW_W;
    c.height = VIEW_H;
    this._world = c;
    this._worldCtx = c.getContext("2d", { alpha: false, willReadFrequently: true });
    this._worldCtx.imageSmoothingEnabled = false;
    return this._worldCtx;
  };

  Game.prototype.drawUi = function (ctx) {
    ctx.imageSmoothingEnabled = false;
    if (this.state === "splash") {
      this.drawSplashUi(ctx);
      return;
    }
    this.drawHud(ctx);
    this.drawPauseOverlay(ctx);
    this.drawEndOverlay(ctx);
  };

  Game.prototype.draw = function (ctx) {
    ctx.imageSmoothingEnabled = false;
    var g = this.ensureWorld();
    g.imageSmoothingEnabled = false;
    if (this.state === "splash") {
      this.drawSplashScene(g);
    } else {
      g.save();
      g.beginPath();
      g.rect(0, 0, VIEW_W, VIEW_H);
      g.clip();
      g.translate(-this.cam.x, -this.cam.y);
      this.drawYardDither(g);
      this.drawCells(g);
      this.drawBuildings(g);
      this.drawActors(g);
      this.drawDebug(g);
      g.restore();
    }
    if (Dither) {
      var img = g.getImageData(0, 0, VIEW_W, VIEW_H);
      Dither.ditherImageData(img);
      ctx.putImageData(img, 0, 0);
    } else {
      ctx.drawImage(this._world, 0, 0);
    }
    this.drawUi(ctx);
  };

  root.GoMomoGame = {
    Game: Game,
    BG: BG,
    INK: INK,
    COPY: COPY,
    PRE: PRE,
    SPLASH_TITLE_BAND: SPLASH_TITLE_BAND,
    CLOCK: CLOCK,
    CLOCK_STEP: CLOCK_STEP,
    CLOCK_MIN: CLOCK_MIN,
    clockForLevel: clockForLevel,
    INTERRUPT_R: INTERRUPT_R,
    PEEMAIL_R: PEEMAIL_R,
    CAR_SPOOK_R: CAR_SPOOK_R,
    CAR_W_X: CAR_W_X,
    CAR_H_X: CAR_H_X,
    CAR_W_Y: CAR_W_Y,
    CAR_H_Y: CAR_H_Y,
    WALK_SLOW: WALK_SLOW,
    WALK_SPEED: WALK_SPEED,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.GoMomoGame;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
