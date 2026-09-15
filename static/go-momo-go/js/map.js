// Procedural neighborhood from real-life street rules. No authored tile map.
// Plan of record: 4×8 square-cell city blocks (houses, lawns, driveways, fences),
// sidewalks both sides, cars on streets, crosswalks at intersections only,
// home at center, busy-near / quiet-far, grass on sidewalk/yard edges.
(function (root) {
  "use strict";

  var VIEW_W = 400;
  var VIEW_H = 240;
  var CELL = 20;
  var BLOCK_W = 4;
  var BLOCK_H = 8;
  var SW = 1;
  var ROAD = 2;
  var CORRIDOR = SW + ROAD + SW;
  var N_BLOCKS_X = 7;
  var N_BLOCKS_Y = 5;
  var GRID_W = N_BLOCKS_X * BLOCK_W + (N_BLOCKS_X + 1) * CORRIDOR;
  var GRID_H = N_BLOCKS_Y * BLOCK_H + (N_BLOCKS_Y + 1) * CORRIDOR;
  var WORLD_W = GRID_W * CELL;
  var WORLD_H = GRID_H * CELL;

  var CELL_KIND = {
    YARD: 0,
    STREET: 1,
    SIDEWALK: 2,
    CROSSWALK: 3,
    GRASS: 4,
    HOME: 5,
    BUILDING: 6,
    FENCE: 7,
    DRIVEWAY: 8,
  };

  var WALKABLE = {};
  WALKABLE[CELL_KIND.SIDEWALK] = true;
  WALKABLE[CELL_KIND.CROSSWALK] = true;
  WALKABLE[CELL_KIND.GRASS] = true;
  WALKABLE[CELL_KIND.HOME] = true;

  function idx(c, r) {
    return r * GRID_W + c;
  }

  function inGrid(c, r) {
    return c >= 0 && r >= 0 && c < GRID_W && r < GRID_H;
  }

  function px(n) {
    return n * CELL;
  }

  function cellOf(x, y) {
    return { c: Math.floor(x / CELL), r: Math.floor(y / CELL) };
  }

  function stamp(cells, c0, r0, c1, r1, kind) {
    var ca = Math.max(0, Math.floor(c0));
    var ra = Math.max(0, Math.floor(r0));
    var cb = Math.min(GRID_W, Math.ceil(c1));
    var rb = Math.min(GRID_H, Math.ceil(r1));
    for (var r = ra; r < rb; r++) {
      for (var c = ca; c < cb; c++) {
        cells[idx(c, r)] = kind;
      }
    }
  }

  function getCell(cells, c, r) {
    if (!inGrid(c, r)) return CELL_KIND.YARD;
    return cells[idx(c, r)];
  }

  function get(map, x, y) {
    var t = cellOf(x, y);
    return getCell(map.cells, t.c, t.r);
  }

  function isWalkableKind(kind) {
    return WALKABLE[kind] === true;
  }

  function isWalkableAt(map, x, y) {
    return isWalkableKind(get(map, x, y));
  }

  function densityAt(x, y) {
    var dx = (x - WORLD_W / 2) / (WORLD_W / 2);
    var dy = (y - WORLD_H / 2) / (WORLD_H / 2);
    var d = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0, 1 - Math.min(1.15, d));
  }

  function decorateStreetX(col0) {
    var walkL0 = px(col0);
    var walkL1 = px(col0 + SW);
    var asphalt0 = walkL1;
    var asphalt1 = px(col0 + SW + ROAD);
    var walkR0 = asphalt1;
    var walkR1 = px(col0 + CORRIDOR);
    return {
      col0: col0,
      a: walkL0,
      b: walkR1,
      walkL0: walkL0,
      walkL1: walkL1,
      asphalt0: asphalt0,
      asphalt1: asphalt1,
      walkR0: walkR0,
      walkR1: walkR1,
      center: (walkL0 + walkR1) / 2,
      asphaltCenter: (asphalt0 + asphalt1) / 2,
    };
  }

  function decorateStreetY(row0) {
    var walkT0 = px(row0);
    var walkT1 = px(row0 + SW);
    var asphalt0 = walkT1;
    var asphalt1 = px(row0 + SW + ROAD);
    var walkB0 = asphalt1;
    var walkB1 = px(row0 + CORRIDOR);
    return {
      row0: row0,
      a: walkT0,
      b: walkB1,
      walkT0: walkT0,
      walkT1: walkT1,
      asphalt0: asphalt0,
      asphalt1: asphalt1,
      walkB0: walkB0,
      walkB1: walkB1,
      center: (walkT0 + walkB1) / 2,
      asphaltCenter: (asphalt0 + asphalt1) / 2,
    };
  }

  function paintVerticalStreets(cells, vStreets) {
    for (var i = 0; i < vStreets.length; i++) {
      var col0 = vStreets[i].col0;
      stamp(cells, col0, 0, col0 + SW, GRID_H, CELL_KIND.SIDEWALK);
      stamp(cells, col0 + SW, 0, col0 + SW + ROAD, GRID_H, CELL_KIND.STREET);
      stamp(cells, col0 + SW + ROAD, 0, col0 + CORRIDOR, GRID_H, CELL_KIND.SIDEWALK);
    }
  }

  function paintHorizontalStreets(cells, hStreets) {
    for (var i = 0; i < hStreets.length; i++) {
      var row0 = hStreets[i].row0;
      for (var r = row0; r < row0 + CORRIDOR; r++) {
        var inAsphalt = r >= row0 + SW && r < row0 + SW + ROAD;
        for (var c = 0; c < GRID_W; c++) {
          var iCell = idx(c, r);
          var cur = cells[iCell];
          if (inAsphalt) {
            cells[iCell] = cur === CELL_KIND.SIDEWALK ? CELL_KIND.CROSSWALK : CELL_KIND.STREET;
          } else if (cur === CELL_KIND.STREET) {
            cells[iCell] = CELL_KIND.CROSSWALK;
          } else {
            cells[iCell] = CELL_KIND.SIDEWALK;
          }
        }
      }
    }
  }

  function blockOrigin(col, row) {
    return {
      c: CORRIDOR + col * (BLOCK_W + CORRIDOR),
      r: CORRIDOR + row * (BLOCK_H + CORRIDOR),
    };
  }

  function buildLots() {
    var lots = [];
    var homeCol = Math.floor(N_BLOCKS_X / 2);
    var homeRow = Math.floor(N_BLOCKS_Y / 2);
    for (var j = 0; j < N_BLOCKS_Y; j++) {
      for (var i = 0; i < N_BLOCKS_X; i++) {
        var o = blockOrigin(i, j);
        var lot = {
          col: i,
          row: j,
          c0: o.c,
          r0: o.r,
          c1: o.c + BLOCK_W,
          r1: o.r + BLOCK_H,
          x0: px(o.c),
          y0: px(o.r),
          x1: px(o.c + BLOCK_W),
          y1: px(o.r + BLOCK_H),
        };
        lot.cx = (lot.x0 + lot.x1) / 2;
        lot.cy = (lot.y0 + lot.y1) / 2;
        lot.density = densityAt(lot.cx, lot.cy);
        lot.isHome = i === homeCol && j === homeRow;
        lots.push(lot);
      }
    }
    return lots;
  }

  function localSet(local, c, r, kind) {
    if (c < 0 || r < 0 || c >= BLOCK_W || r >= BLOCK_H) return;
    local[r * BLOCK_W + c] = kind;
  }

  function localGet(local, c, r) {
    if (c < 0 || r < 0 || c >= BLOCK_W || r >= BLOCK_H) return CELL_KIND.YARD;
    return local[r * BLOCK_W + c];
  }

  function fencePerimeter(local) {
    var c, r;
    for (c = 0; c < BLOCK_W; c++) {
      localSet(local, c, 0, CELL_KIND.FENCE);
      localSet(local, c, BLOCK_H - 1, CELL_KIND.FENCE);
    }
    for (r = 0; r < BLOCK_H; r++) {
      localSet(local, 0, r, CELL_KIND.FENCE);
      localSet(local, BLOCK_W - 1, r, CELL_KIND.FENCE);
    }
  }

  function placeHouseFacing(local, face, rng, buildings, origin) {
    var pair = rng.int(0, 2);
    var c0 = pair === 2 ? 2 : pair;
    var c1 = c0 + 1;
    var driveOptions = [];
    var c;
    for (c = 0; c < BLOCK_W; c++) {
      if (c !== c0 && c !== c1) driveOptions.push(c);
    }
    var drive = rng.pick(driveOptions);
    var rHouse0;
    var rHouse1;
    var rDrive0;
    var rDrive1;
    var rFront;
    if (face === "n") {
      rHouse0 = 1;
      rHouse1 = 2;
      rDrive0 = 0;
      rDrive1 = 2;
      rFront = 0;
    } else {
      rHouse0 = 5;
      rHouse1 = 6;
      rDrive0 = 5;
      rDrive1 = 7;
      rFront = 7;
    }
    var r;
    for (r = rHouse0; r <= rHouse1; r++) {
      localSet(local, c0, r, CELL_KIND.BUILDING);
      localSet(local, c1, r, CELL_KIND.BUILDING);
    }
    for (r = rDrive0; r <= rDrive1; r++) {
      localSet(local, drive, r, CELL_KIND.DRIVEWAY);
    }
    for (c = 0; c < BLOCK_W; c++) {
      if (c === drive) continue;
      localSet(local, c, rFront, CELL_KIND.GRASS);
    }
    buildings.push({
      x: px(origin.c + c0),
      y: px(origin.r + rHouse0),
      w: CELL * 2,
      h: CELL * 2,
      roof: rng.chance(0.75),
    });
  }

  function punchGrassOpening(local, rng) {
    var side = rng.pick(["n", "s", "e", "w"]);
    var i;
    if (side === "n") {
      for (i = 1; i <= 2; i++) {
        if (localGet(local, i, 0) === CELL_KIND.FENCE) localSet(local, i, 0, CELL_KIND.GRASS);
      }
    } else if (side === "s") {
      for (i = 1; i <= 2; i++) {
        if (localGet(local, i, BLOCK_H - 1) === CELL_KIND.FENCE) localSet(local, i, BLOCK_H - 1, CELL_KIND.GRASS);
      }
    } else if (side === "w") {
      for (i = 3; i <= 4; i++) {
        if (localGet(local, 0, i) === CELL_KIND.FENCE) localSet(local, 0, i, CELL_KIND.GRASS);
      }
    } else {
      for (i = 3; i <= 4; i++) {
        if (localGet(local, BLOCK_W - 1, i) === CELL_KIND.FENCE) localSet(local, BLOCK_W - 1, i, CELL_KIND.GRASS);
      }
    }
  }

  function layoutHome(local, buildings, origin) {
    fencePerimeter(local);
    var c, r;
    for (c = 1; c <= 2; c++) {
      for (r = 2; r <= 4; r++) localSet(local, c, r, CELL_KIND.BUILDING);
      localSet(local, c, 5, CELL_KIND.HOME);
      localSet(local, c, 6, CELL_KIND.HOME);
      localSet(local, c, 7, CELL_KIND.HOME);
      localSet(local, c, 1, CELL_KIND.GRASS);
    }
    localSet(local, 0, 1, CELL_KIND.GRASS);
    localSet(local, 3, 1, CELL_KIND.GRASS);
    buildings.push({
      x: px(origin.c + 1),
      y: px(origin.r + 2),
      w: CELL * 2,
      h: CELL * 3,
      roof: true,
      home: true,
    });
    return {
      building: { x: px(origin.c + 1), y: px(origin.r + 2), w: CELL * 2, h: CELL * 3 },
      stoop: { x: px(origin.c + 1) + CELL, y: px(origin.r + 5) + CELL / 2 },
      path: {
        x0: px(origin.c + 1),
        y0: px(origin.r + 5),
        x1: px(origin.c + 3),
        y1: px(origin.r + BLOCK_H),
      },
    };
  }

  function layoutLot(local, lot, rng, buildings) {
    var origin = { c: lot.c0, r: lot.r0 };
    var c, r;
    for (r = 0; r < BLOCK_H; r++) {
      for (c = 0; c < BLOCK_W; c++) localSet(local, c, r, CELL_KIND.YARD);
    }
    if (lot.isHome) return layoutHome(local, buildings, origin);

    fencePerimeter(local);
    var nHouses;
    if (lot.density > 0.55) nHouses = 2;
    else if (lot.density > 0.32) nHouses = 1;
    else if (lot.density > 0.15) nHouses = rng.chance(0.55) ? 1 : 0;
    else nHouses = rng.chance(0.22) ? 1 : 0;

    if (nHouses >= 1) {
      var first = rng.chance(0.5) ? "n" : "s";
      placeHouseFacing(local, first, rng, buildings, origin);
      if (nHouses >= 2) placeHouseFacing(local, first === "n" ? "s" : "n", rng, buildings, origin);
    } else {
      punchGrassOpening(local, rng);
    }
    return null;
  }

  function stampLocal(cells, lot, local) {
    var r, c;
    for (r = 0; r < BLOCK_H; r++) {
      for (c = 0; c < BLOCK_W; c++) {
        cells[idx(lot.c0 + c, lot.r0 + r)] = local[r * BLOCK_W + c];
      }
    }
  }

  function collectGrass(cells, lots, home) {
    var patches = [];
    var r, c, L;
    for (L = 0; L < lots.length; L++) {
      var lot = lots[L];
      for (r = lot.r0; r < lot.r1; r++) {
        for (c = lot.c0; c < lot.c1; c++) {
          if (getCell(cells, c, r) !== CELL_KIND.GRASS) continue;
          var gx = px(c);
          var gy = px(r);
          patches.push({
            x: gx,
            y: gy,
            w: CELL,
            h: CELL,
            cx: gx + CELL / 2,
            cy: gy + CELL / 2,
            homeLot: lot.isHome,
            dist: Math.hypot(gx + CELL / 2 - home.stoop.x, gy + CELL / 2 - home.stoop.y),
          });
        }
      }
    }
    var tutorial = null;
    var homePatches = patches.filter(function (p) {
      return p.homeLot;
    });
    var pool = homePatches.length ? homePatches : patches;
    if (pool.length) {
      tutorial = pool[0];
      for (var p = 1; p < pool.length; p++) {
        if (pool[p].dist < tutorial.dist) tutorial = pool[p];
      }
      tutorial.tutorial = true;
    }
    return { patches: patches, tutorial: tutorial };
  }

  function collectSamples(cells) {
    var sidewalk = [];
    var street = [];
    var grass = [];
    var crosswalk = [];
    for (var r = 0; r < GRID_H; r++) {
      for (var c = 0; c < GRID_W; c++) {
        var k = cells[idx(c, r)];
        var sample = { x: px(c) + CELL / 2, y: px(r) + CELL / 2, density: densityAt(px(c) + CELL / 2, px(r) + CELL / 2) };
        if (k === CELL_KIND.SIDEWALK) sidewalk.push(sample);
        else if (k === CELL_KIND.STREET) street.push(sample);
        else if (k === CELL_KIND.GRASS) grass.push(sample);
        else if (k === CELL_KIND.CROSSWALK) crosswalk.push(sample);
      }
    }
    return { sidewalk: sidewalk, street: street, grass: grass, crosswalk: crosswalk };
  }

  function pickFrom(samples, rng, count) {
    var out = [];
    if (!samples.length || count <= 0) return out;
    for (var i = 0; i < count; i++) {
      var s = rng.pick(samples);
      out.push({ x: s.x, y: s.y, density: s.density });
    }
    return out;
  }

  function pickBusyQuiet(samples, rng, total, nearShare) {
    var near = [];
    var far = [];
    for (var i = 0; i < samples.length; i++) {
      if (samples[i].density >= 0.45) near.push(samples[i]);
      else far.push(samples[i]);
    }
    if (!near.length) near = samples;
    var nNear = Math.max(1, Math.round(total * nearShare));
    var nFar = Math.max(0, total - nNear);
    if (!far.length) nFar = 0;
    return pickFrom(near, rng, nNear).concat(pickFrom(far, rng, nFar));
  }

  function carLanes(vStreets, hStreets) {
    var lanes = [];
    var i;
    for (i = 0; i < vStreets.length; i++) {
      lanes.push({
        axis: "y",
        x: vStreets[i].asphaltCenter,
        y0: 0,
        y1: WORLD_H,
        x0: vStreets[i].asphalt0,
        x1: vStreets[i].asphalt1,
      });
    }
    for (i = 0; i < hStreets.length; i++) {
      lanes.push({
        axis: "x",
        y: hStreets[i].asphaltCenter,
        x0: 0,
        x1: WORLD_W,
        y0: hStreets[i].asphalt0,
        y1: hStreets[i].asphalt1,
      });
    }
    return lanes;
  }

  function floodWalkable(cells, sx, sy) {
    var start = cellOf(sx, sy);
    var seen = new Uint8Array(GRID_W * GRID_H);
    var stack = [[start.c, start.r]];
    var reached = { grass: false, crosswalk: false, sidewalk: false, farGrass: false, home: false };
    var n = 0;
    while (stack.length) {
      var p = stack.pop();
      var c = p[0];
      var r = p[1];
      if (!inGrid(c, r)) continue;
      var i = idx(c, r);
      if (seen[i]) continue;
      if (!isWalkableKind(cells[i])) continue;
      seen[i] = 1;
      n++;
      if (cells[i] === CELL_KIND.GRASS) {
        reached.grass = true;
        if (densityAt(px(c) + CELL / 2, px(r) + CELL / 2) < 0.45) reached.farGrass = true;
      }
      if (cells[i] === CELL_KIND.CROSSWALK) reached.crosswalk = true;
      if (cells[i] === CELL_KIND.SIDEWALK) reached.sidewalk = true;
      if (cells[i] === CELL_KIND.HOME) reached.home = true;
      stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }
    reached.tiles = n;
    return reached;
  }

  function lotHasKind(cells, lot, kind) {
    for (var r = lot.r0; r < lot.r1; r++) {
      for (var c = lot.c0; c < lot.c1; c++) {
        if (getCell(cells, c, r) === kind) return true;
      }
    }
    return false;
  }

  function generateNeighborhood(seed) {
    var rng = new root.GoMomoRng.Rng(seed);
    var cells = new Uint8Array(GRID_W * GRID_H);
    var vStreets = [];
    var hStreets = [];
    var i;
    for (i = 0; i < N_BLOCKS_X + 1; i++) vStreets.push(decorateStreetX(i * (BLOCK_W + CORRIDOR)));
    for (i = 0; i < N_BLOCKS_Y + 1; i++) hStreets.push(decorateStreetY(i * (BLOCK_H + CORRIDOR)));

    paintVerticalStreets(cells, vStreets);
    paintHorizontalStreets(cells, hStreets);

    var lots = buildLots();
    var buildings = [];
    var home = null;
    var homeLot = null;
    for (i = 0; i < lots.length; i++) {
      var local = new Uint8Array(BLOCK_W * BLOCK_H);
      var placed = layoutLot(local, lots[i], rng, buildings);
      stampLocal(cells, lots[i], local);
      if (lots[i].isHome) {
        home = placed;
        homeLot = lots[i];
      }
    }

    var grass = collectGrass(cells, lots, home);
    var samples = collectSamples(cells);

    var peopleN = 6 + rng.int(0, 3);
    var dogsN = 2 + rng.int(0, 2);
    var mailN = 5 + rng.int(0, 3);
    var calmX = grass.tutorial ? grass.tutorial.cx : home.stoop.x;
    var calmY = grass.tutorial ? grass.tutorial.cy : home.stoop.y;
    function awayFromTutorial(list) {
      return list.filter(function (s) {
        return Math.hypot(s.x - calmX, s.y - calmY) > CELL * 2.5;
      });
    }
    var sidewalkAway = awayFromTutorial(samples.sidewalk);
    var people = pickBusyQuiet(sidewalkAway, rng, peopleN, 0.8);
    var dogs = pickBusyQuiet(sidewalkAway, rng, dogsN, 0.84);
    var peemail = pickBusyQuiet(sidewalkAway, rng, mailN, 0.78);

    var lanes = carLanes(vStreets, hStreets);
    var ranked = lanes.slice().sort(function (a, b) {
      var ax = a.axis === "y" ? a.x : (a.x0 + a.x1) / 2;
      var ay = a.axis === "y" ? (a.y0 + a.y1) / 2 : a.y;
      var bx = b.axis === "y" ? b.x : (b.x0 + b.x1) / 2;
      var by = b.axis === "y" ? (b.y0 + b.y1) / 2 : b.y;
      return Math.hypot(ax - WORLD_W / 2, ay - WORLD_H / 2) - Math.hypot(bx - WORLD_W / 2, by - WORLD_H / 2);
    });
    var cars = [];
    var carCount = Math.min(ranked.length, 7);
    for (var ci = 0; ci < carCount; ci++) {
      var lane = ranked[ci];
      var along = rng.next();
      var car;
      if (lane.axis === "y") {
        car = {
          x: lane.x,
          y: lane.y0 + along * (lane.y1 - lane.y0),
          axis: "y",
          dir: rng.chance(0.5) ? 1 : -1,
          lane: ci,
        };
      } else {
        car = {
          x: lane.x0 + along * (lane.x1 - lane.x0),
          y: lane.y,
          axis: "x",
          dir: rng.chance(0.5) ? 1 : -1,
          lane: ci,
        };
      }
      cars.push(car);
    }

    var reach = floodWalkable(cells, home.stoop.x, home.stoop.y);

    return {
      w: WORLD_W,
      h: WORLD_H,
      worldW: WORLD_W,
      worldH: WORLD_H,
      gridW: GRID_W,
      gridH: GRID_H,
      cell: CELL,
      blockW: BLOCK_W,
      blockH: BLOCK_H,
      seed: rng.seed,
      cells: cells,
      vStreets: vStreets,
      hStreets: hStreets,
      lots: lots,
      homeLot: homeLot,
      home: home,
      buildings: buildings,
      grass: grass.patches,
      tutorialGrass: grass.tutorial,
      samples: samples,
      spawns: { people: people, dogs: dogs, peemail: peemail, cars: cars },
      lanes: lanes,
      reach: reach,
      inner: { x0: 0, x1: WORLD_W, y0: 0, y1: WORLD_H },
    };
  }

  function sidewalksBothSides(map) {
    for (var i = 0; i < map.vStreets.length; i++) {
      var s = map.vStreets[i];
      if (s.walkL1 - s.walkL0 < px(SW) - 0.01) return false;
      if (s.walkR1 - s.walkR0 < px(SW) - 0.01) return false;
    }
    for (var j = 0; j < map.hStreets.length; j++) {
      var h = map.hStreets[j];
      if (h.walkT1 - h.walkT0 < px(SW) - 0.01) return false;
      if (h.walkB1 - h.walkB0 < px(SW) - 0.01) return false;
    }
    return true;
  }

  function homeContainsCenter(map) {
    var lot = map.homeLot;
    return lot.x0 <= WORLD_W / 2 && WORLD_W / 2 < lot.x1 && lot.y0 <= WORLD_H / 2 && WORLD_H / 2 < lot.y1;
  }

  var api = {
    W: VIEW_W,
    H: VIEW_H,
    VIEW_W: VIEW_W,
    VIEW_H: VIEW_H,
    CELL_SIZE: CELL,
    BLOCK_W: BLOCK_W,
    BLOCK_H: BLOCK_H,
    GRID_W: GRID_W,
    GRID_H: GRID_H,
    WORLD_W: WORLD_W,
    WORLD_H: WORLD_H,
    N_BLOCKS_X: N_BLOCKS_X,
    N_BLOCKS_Y: N_BLOCKS_Y,
    CELL_KIND: CELL_KIND,
    CELL: CELL_KIND,
    generateNeighborhood: generateNeighborhood,
    get: get,
    getCell: getCell,
    isWalkableAt: isWalkableAt,
    isWalkableKind: isWalkableKind,
    densityAt: densityAt,
    sidewalksBothSides: sidewalksBothSides,
    homeContainsCenter: homeContainsCenter,
    lotHasKind: lotHasKind,
    idx: idx,
    cellOf: cellOf,
  };

  root.GoMomoMap = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
