// Playtest #3 art stamps. Prefer Game Art Director tiles in web/assets/;
// procedural greys remain a fallback until images load (or if a file 404s).
(function (root) {
  "use strict";

  var BG = "#c9d63a";
  var INK = "#2a1c12";
  var WALL = "#8c7a42";
  var WALL2 = "#6e6234";
  var ROOF = "#3d2a16";
  var TRIM = "#4a381c";
  var PANE = "#c4d070";
  var CELL = 20;
  var DIR = "assets/";

  var HOUSE_2X2 = ["house_2x2", "house_2x2_b", "house_face_2x2", "house_face_2x2_b"];
  var TILE_NAMES = [
    "house_2x2",
    "house_2x2_b",
    "house_face_2x2",
    "house_face_2x2_b",
    "house_face_2x3",
    "house_home_2x3",
    "house_home_3x3",
    "house_home_zhuz",
    "house_home_zhuz_3x3",
    "house_home_landmark",
    "house_home_landmark_2x3",
    "splash",
    "mimi",
    "fence_h",
    "fence_v",
    "fence_corner_nw",
    "fence_corner_ne",
    "fence_corner_sw",
    "fence_corner_se",
    "fence_gate",
    "car_h_20x12",
    "car_v_12x20",
  ];

  function Art() {
    this.tiles = {};
    this.ready = false;
    this._load();
  }

  Art.prototype._load = function () {
    if (typeof Image === "undefined") return;
    var self = this;
    var left = TILE_NAMES.length;
    function grab(name) {
      var img = new Image();
      img.onload = function () {
        self.tiles[name] = img;
        left--;
        if (left <= 0) self.ready = true;
      };
      img.onerror = function () {
        left--;
        if (left <= 0) self.ready = true;
      };
      img.src = DIR + name + ".png";
    }
    for (var i = 0; i < TILE_NAMES.length; i++) grab(TILE_NAMES[i]);
  };

  Art.prototype.tile = function (name) {
    var img = this.tiles[name];
    return img && img.width ? img : null;
  };

  Art.prototype.blit = function (ctx, img, dx, dy, dw, dh, flipX, flipY) {
    if (!img) return false;
    ctx.imageSmoothingEnabled = false;
    if (flipX || flipY) {
      ctx.save();
      ctx.translate(dx + (flipX ? dw : 0), dy + (flipY ? dh : 0));
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh);
    }
    return true;
  };

  Art.prototype.drawHouse = function (ctx, b) {
    var img;
    var flipY = b.face === "n";
    if (b.home) {
      var zhuz = this.tile("house_home_zhuz");
      img =
        zhuz ||
        this.tile("house_home_landmark") ||
        this.tile("house_home_landmark_2x3") ||
        this.tile("house_home_2x3") ||
        this.tile("house_home_zhuz_3x3") ||
        this.tile("house_home_3x3");
      if (this.blit(ctx, img, b.x, b.y, b.w, b.h, false, false)) {
        if (!zhuz && !this.tile("house_home_landmark") && !this.tile("house_home_landmark_2x3")) {
          this.drawHomeLandmark(ctx, b);
        }
        return;
      }
    } else {
      var name = HOUSE_2X2[(b.variant || 0) % HOUSE_2X2.length];
      img = this.tile(name);
      if (this.blit(ctx, img, b.x, b.y, b.w, b.h, false, flipY)) return;
    }
    this.drawHouseProcedural(ctx, b);
    if (b.home) this.drawHomeLandmark(ctx, b);
  };

  Art.prototype.drawHomeLandmark = function (ctx, b) {
    var x = Math.floor(b.x);
    var y = Math.floor(b.y);
    var w = Math.floor(b.w);
    var h = Math.floor(b.h);
    ctx.imageSmoothingEnabled = false;
    var poleX = x + w - 7;
    var poleY = y - 10;
    ctx.fillStyle = INK;
    ctx.fillRect(poleX, poleY, 2, 16);
    ctx.fillStyle = BG;
    ctx.fillRect(poleX + 2, poleY, 10, 7);
    ctx.fillStyle = INK;
    ctx.fillRect(poleX + 2, poleY, 10, 1);
    ctx.fillRect(poleX + 2, poleY + 6, 10, 1);
    ctx.fillRect(poleX + 11, poleY, 1, 7);
    ctx.fillRect(poleX + 4, poleY + 2, 3, 3);

    var doorW = 10;
    var doorH = 16;
    var doorX = x + Math.floor(w / 2) - Math.floor(doorW / 2);
    var doorY = y + h - doorH;
    ctx.fillStyle = INK;
    ctx.fillRect(doorX - 1, doorY - 1, doorW + 2, doorH + 1);
    ctx.fillStyle = BG;
    ctx.fillRect(doorX, doorY, doorW, doorH - 1);
    ctx.fillStyle = INK;
    ctx.fillRect(doorX + doorW - 3, doorY + Math.floor(doorH / 2), 2, 2);

    ctx.fillStyle = BG;
    ctx.fillRect(doorX - 2, y + h - 2, doorW + 4, 4);
    ctx.fillStyle = INK;
    ctx.fillRect(doorX - 2, y + h - 2, doorW + 4, 1);

    var boxX = x + 2;
    var boxY = y + h - 8;
    ctx.fillStyle = INK;
    ctx.fillRect(boxX, boxY, 6, 6);
    ctx.fillStyle = BG;
    ctx.fillRect(boxX + 1, boxY + 1, 4, 3);
  };

  Art.prototype.fenceStamp = function (n) {
    var N = !!(n && n.N);
    var S = !!(n && n.S);
    var E = !!(n && n.E);
    var W = !!(n && n.W);
    if (E && S && !N && !W) return "fence_corner_nw";
    if (W && S && !N && !E) return "fence_corner_ne";
    if (E && N && !S && !W) return "fence_corner_sw";
    if (W && N && !S && !E) return "fence_corner_se";
    if (E && W && !N && !S) return "fence_h";
    if (N && S && !E && !W) return "fence_v";
    if ((E || W) && !N && !S) return "fence_h";
    if ((N || S) && !E && !W) return "fence_v";
    if (N && S) return "fence_v";
    if (E && W) return "fence_h";
    if (E || W) return "fence_h";
    return "fence_v";
  };

  Art.prototype.drawFence = function (ctx, x, y, size, n) {
    var img = this.tile(this.fenceStamp(n));
    if (this.blit(ctx, img, x, y, size, size, false, false)) return;
    this.drawFenceProcedural(ctx, x, y, size, n);
  };

  Art.prototype.tryBlitCar = function (ctx, c, x, y) {
    var horiz = c.axis !== "y";
    var img = this.tile(horiz ? "car_h_20x12" : "car_v_12x20");
    if (!img) return false;
    var flipX = horiz && c.dir < 0;
    var flipY = !horiz && c.dir < 0;
    return this.blit(ctx, img, x, y, c.w, c.h, flipX, flipY);
  };

  Art.prototype.tryBlitMimi = function (ctx, p, x, y) {
    var img = this.tile("mimi");
    if (!img) return false;
    return this.blit(ctx, img, x, y, 12, 20, p.dirX < 0, false);
  };

  Art.prototype.tryBlitSplash = function (ctx) {
    var img = this.tile("splash");
    if (!img) return false;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, 400, 240);
    return true;
  };

  Art.prototype.drawHouseProcedural = function (ctx, b) {
    var x = Math.floor(b.x);
    var y = Math.floor(b.y);
    var w = Math.floor(b.w);
    var h = Math.floor(b.h);
    var face = b.face || "s";
    var v = b.variant || 0;
    var roofH = b.home ? 10 : 8;

    ctx.fillStyle = WALL;
    ctx.fillRect(x, y + roofH - 2, w, h - (roofH - 2));

    var by;
    for (by = y + roofH; by < y + h - 1; by += 3) {
      ctx.fillStyle = Math.floor((by - y) / 3) % 2 === 0 ? WALL2 : WALL;
      ctx.fillRect(x + 1, by, w - 2, 2);
    }

    ctx.fillStyle = INK;
    ctx.fillRect(x, y + roofH - 2, w, 1);
    ctx.fillRect(x, y + roofH - 2, 1, h - (roofH - 2));
    ctx.fillRect(x + w - 1, y + roofH - 2, 1, h - (roofH - 2));
    ctx.fillRect(x, y + h - 1, w, 1);

    this.drawRoof(ctx, x, y, w, roofH, b.roof !== false);

    var doorW = 8;
    var doorH = b.home ? 14 : 10;
    var doorX = x + Math.floor(w / 2) - Math.floor(doorW / 2);
    var doorY = face === "n" ? y + roofH + 1 : y + h - doorH - 1;
    ctx.fillStyle = INK;
    ctx.fillRect(doorX, doorY, doorW, doorH);
    ctx.fillStyle = BG;
    ctx.fillRect(doorX + 1, doorY + 1, doorW - 2, doorH - 2);
    ctx.fillStyle = INK;
    ctx.fillRect(doorX + doorW - 3, doorY + Math.floor(doorH / 2), 2, 2);

    this.drawWindows(ctx, x, y, w, h, roofH, face, v, b.home, doorY, doorH);

    if (b.home) {
      ctx.fillStyle = BG;
      ctx.fillRect(x + Math.floor(w / 2) - 3, y + h - 1, 6, 2);
    }
  };

  Art.prototype.drawRoof = function (ctx, x, y, w, roofH, peaked) {
    ctx.fillStyle = ROOF;
    if (peaked) {
      ctx.beginPath();
      ctx.moveTo(x - 2, y + roofH);
      ctx.lineTo(x + Math.floor(w / 2), y - 5);
      ctx.lineTo(x + w + 2, y + roofH);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.fillRect(x - 1, y + 2, w + 2, roofH);
      ctx.fillStyle = INK;
      ctx.fillRect(x - 1, y + 2, w + 2, 1);
    }
    ctx.fillStyle = TRIM;
    ctx.fillRect(x + w - 8, y + 1, 4, roofH - 1);
    ctx.fillStyle = INK;
    ctx.fillRect(x + w - 8, y + 1, 4, 1);
    ctx.fillRect(x + w - 8, y + 1, 1, roofH - 2);
    ctx.fillRect(x + w - 5, y + 1, 1, roofH - 2);
  };

  Art.prototype.drawWindows = function (ctx, x, y, w, h, roofH, face, variant, home) {
    var wy = face === "n" ? y + h - 16 : y + roofH + (home ? 6 : 3);
    function pane(px, py, pw, ph) {
      ctx.fillStyle = INK;
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = PANE;
      ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);
      ctx.fillStyle = INK;
      ctx.fillRect(px + Math.floor(pw / 2), py + 1, 1, ph - 2);
      ctx.fillRect(px + 1, py + Math.floor(ph / 2), pw - 2, 1);
    }
    if (variant === 1) {
      pane(x + 4, wy, 8, 8);
      pane(x + w - 12, wy, 8, 8);
      if (home) pane(x + Math.floor(w / 2) - 4, wy + 14, 8, 8);
    } else if (variant === 2) {
      pane(x + 5, wy, w - 10, 9);
      if (home) {
        pane(x + 4, wy + 14, 8, 8);
        pane(x + w - 12, wy + 14, 8, 8);
      }
    } else if (variant === 3) {
      pane(x + 3, wy, 7, 8);
      pane(x + w - 10, wy, 7, 8);
      ctx.fillStyle = INK;
      ctx.fillRect(x + 2, y + h - 12, 1, 11);
      ctx.fillRect(x + w - 3, y + h - 12, 1, 11);
    } else {
      pane(x + 4, wy, 8, 8);
      pane(x + w - 12, wy, 8, 8);
      if (home) pane(x + 4, wy + 16, 8, 8);
    }
    if (home && face === "s") {
      pane(x + w - 12, y + roofH + 22, 8, 8);
    }
  };

  Art.prototype.drawFenceProcedural = function (ctx, x, y, size, n) {
    var east = n && n.E;
    var west = n && n.W;
    var north = n && n.N;
    var south = n && n.S;
    var runH = east || west || (!north && !south);
    var runV = north || south || (!east && !west);
    var i;
    ctx.fillStyle = INK;
    if (runH) {
      ctx.fillRect(x, y + 6, size, 2);
      ctx.fillRect(x, y + 13, size, 2);
      for (i = 0; i < size; i += 5) {
        ctx.fillRect(x + i + 1, y + 4, 2, size - 6);
      }
    }
    if (runV) {
      ctx.fillRect(x + 6, y, 2, size);
      ctx.fillRect(x + 13, y, 2, size);
      for (i = 0; i < size; i += 5) {
        ctx.fillRect(x + 4, y + i + 1, size - 6, 2);
      }
    }
    ctx.fillRect(x + 1, y + 4, 3, 3);
    ctx.fillRect(x + size - 4, y + 4, 3, 3);
    ctx.fillRect(x + 1, y + size - 7, 3, 3);
    ctx.fillRect(x + size - 4, y + size - 7, 3, 3);
  };

  var api = {
    Art: Art,
    DIR: DIR,
    TILE_NAMES: TILE_NAMES,
    SHEET_HOUSES: "assets/houses.png",
    SHEET_FENCES: "assets/fences.png",
    SHEET_CARS: "assets/cars.png",
    HOME_LANDMARK: ["house_home_zhuz", "house_home_zhuz_3x3", "house_home_landmark", "house_home_landmark_2x3"],
    SPLASH: "assets/splash.png",
    MIMI: "assets/mimi.png",
    CELL: CELL,
  };

  root.GoMomoArt = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
