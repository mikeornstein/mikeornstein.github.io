// 5×7 1-bit bitmap font for the 400×240 LCD.
// Original glyphs for Go Momo Go (CC0). No system text, no dither.
(function (root) {
  "use strict";

  var W = 5;
  var H = 7;
  var GAP = 1;
  var BG = "#c9d63a";
  var INK = "#2a1c12";

  // Each glyph is 7 rows of 5 bits, packed as a string of "#" and ".".
  // Missing characters fall back to a hollow box.
  var GLYPHS = {
    " ": ".....|.....|.....|.....|.....|.....|.....",
    "!": ".#...|.#...|.#...|.#...|.#...|.....|.#...",
    '"': "#.#..|#.#..|.....|.....|.....|.....|.....",
    "#": ".#.#.|#####|.#.#.|#####|.#.#.|.....|.....",
    $: "..#..|.####|.#...|.###.|...#.|####.|..#..",
    "%": "#...#|...#.|..#..|.#...|#...#|.....|.....",
    "&": ".##..|#..#.|.##..|#.#.#|#..#.|.#.#.|.....",
    "'": ".#...|.#...|.....|.....|.....|.....|.....",
    "(": "..#..|.#...|#....|#....|#....|.#...|..#..",
    ")": ".#...|..#..|...#.|...#.|...#.|..#..|.#...",
    "*": ".#...|#.#.#|.###.|#####|.###.|#.#.#|.#...",
    "+": ".....|..#..|..#..|#####|..#..|..#..|.....",
    ",": ".....|.....|.....|.....|.#...|.#...|#....",
    "-": ".....|.....|.....|#####|.....|.....|.....",
    ".": ".....|.....|.....|.....|.....|.....|.#...",
    "/": "...#.|...#.|..#..|.#...|#....|#....|.....",
    "0": ".###.|#...#|#..##|#.#.#|##..#|#...#|.###.",
    "1": "..#..|.##..|..#..|..#..|..#..|..#..|.###.",
    "2": ".###.|#...#|....#|..##.|.#...|#....|#####",
    "3": ".###.|#...#|....#|.###.|....#|#...#|.###.",
    "4": "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.",
    "5": "#####|#....|####.|....#|....#|#...#|.###.",
    "6": ".###.|#....|#....|####.|#...#|#...#|.###.",
    "7": "#####|....#|...#.|..#..|.#...|.#...|.#...",
    "8": ".###.|#...#|#...#|.###.|#...#|#...#|.###.",
    "9": ".###.|#...#|#...#|.####|....#|....#|.###.",
    ":": ".....|.#...|.....|.....|.....|.#...|.....",
    ";": ".....|.#...|.....|.....|.#...|.#...|#....",
    "<": "...#.|..#..|.#...|#....|.#...|..#..|...#.",
    "=": ".....|.....|#####|.....|#####|.....|.....",
    ">": "#....|.#...|..#..|...#.|..#..|.#...|#....",
    "?": ".###.|#...#|....#|..##.|..#..|.....|..#..",
    "@": ".###.|#...#|#.###|#.#.#|#.##.|#....|.###.",
    A: ".###.|#...#|#...#|#####|#...#|#...#|#...#",
    B: "####.|#...#|#...#|####.|#...#|#...#|####.",
    C: ".###.|#...#|#....|#....|#....|#...#|.###.",
    D: "####.|#...#|#...#|#...#|#...#|#...#|####.",
    E: "#####|#....|#....|####.|#....|#....|#####",
    F: "#####|#....|#....|####.|#....|#....|#....",
    G: ".###.|#...#|#....|#.###|#...#|#...#|.####",
    H: "#...#|#...#|#...#|#####|#...#|#...#|#...#",
    I: ".###.|..#..|..#..|..#..|..#..|..#..|.###.",
    J: "..###|...#.|...#.|...#.|...#.|#..#.|.##..",
    K: "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#",
    L: "#....|#....|#....|#....|#....|#....|#####",
    M: "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#",
    N: "#...#|##..#|#.#.#|#.#.#|#..##|#...#|#...#",
    O: ".###.|#...#|#...#|#...#|#...#|#...#|.###.",
    P: "####.|#...#|#...#|####.|#....|#....|#....",
    Q: ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#",
    R: "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
    S: ".####|#....|#....|.###.|....#|....#|####.",
    T: "#####|..#..|..#..|..#..|..#..|..#..|..#..",
    U: "#...#|#...#|#...#|#...#|#...#|#...#|.###.",
    V: "#...#|#...#|#...#|#...#|#...#|.#.#.|..#..",
    W: "#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#",
    X: "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
    Y: "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..",
    Z: "#####|....#|...#.|..#..|.#...|#....|#####",
    "[": ".###.|.#...|.#...|.#...|.#...|.#...|.###.",
    "\\": "#....|#....|.#...|..#..|...#.|...#.|.....",
    "]": ".###.|...#.|...#.|...#.|...#.|...#.|.###.",
    "^": "..#..|.#.#.|#...#|.....|.....|.....|.....",
    _: ".....|.....|.....|.....|.....|.....|#####",
    "`": ".#...|..#..|.....|.....|.....|.....|.....",
    a: ".....|.....|.###.|....#|.####|#...#|.####",
    b: "#....|#....|#.##.|##..#|#...#|#...#|####.",
    c: ".....|.....|.###.|#....|#....|#...#|.###.",
    d: "....#|....#|.##.#|#..##|#...#|#...#|.####",
    e: ".....|.....|.###.|#...#|#####|#....|.###.",
    f: "..##.|.#..#|#....|###..|#....|#....|#....",
    g: ".....|.....|.####|#...#|.####|....#|.###.",
    h: "#....|#....|#.##.|##..#|#...#|#...#|#...#",
    i: ".#...|.....|.##..|..#..|..#..|..#..|.###.",
    j: "..#..|.....|..##.|...#.|...#.|#..#.|.##..",
    k: "#....|#....|#..#.|#.#..|##...|#.#..|#..#.",
    l: ".##..|..#..|..#..|..#..|..#..|..#..|.###.",
    m: ".....|.....|##.#.|#.#.#|#.#.#|#.#.#|#.#.#",
    n: ".....|.....|#.##.|##..#|#...#|#...#|#...#",
    o: ".....|.....|.###.|#...#|#...#|#...#|.###.",
    p: ".....|.....|####.|#...#|####.|#....|#....",
    q: ".....|.....|.####|#...#|.####|....#|....#",
    r: ".....|.....|#.##.|##..#|#....|#....|#....",
    s: ".....|.....|.####|#....|.###.|....#|####.",
    t: ".#...|.#...|####.|.#...|.#...|.#..#|..##.",
    u: ".....|.....|#...#|#...#|#...#|#..##|.##.#",
    v: ".....|.....|#...#|#...#|#...#|.#.#.|..#..",
    w: ".....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.",
    x: ".....|.....|#...#|.#.#.|..#..|.#.#.|#...#",
    y: ".....|.....|#...#|#...#|.####|....#|.###.",
    z: ".....|.....|#####|...#.|..#..|.#...|#####",
    "{": "..##.|.#...|.#...|##...|.#...|.#...|..##.",
    "|": ".#...|.#...|.#...|.#...|.#...|.#...|.#...",
    "}": ".##..|...#.|...#.|...##|...#.|...#.|.##..",
    "~": ".....|.##..|#..#.|.##..|.....|.....|.....",
  };

  var BOX = "#####|#...#|#...#|#...#|#...#|#...#|#####";
  var CACHE = {};

  function normalizeChar(ch) {
    if (ch === "—" || ch === "–") return "-";
    if (ch === "·") return ".";
    if (ch === "…") return ".";
    return ch;
  }

  function expandEllipsis(text) {
    return String(text == null ? "" : text).replace(/…/g, "...");
  }

  function rowsOf(ch) {
    var key = normalizeChar(ch);
    if (CACHE[key]) return CACHE[key];
    var raw = GLYPHS[key] || BOX;
    var rows = raw.split("|");
    CACHE[key] = rows;
    return rows;
  }

  function advance(scale) {
    return W * scale + GAP * scale;
  }

  function measure(text, scale) {
    scale = scale || 1;
    var src = expandEllipsis(text);
    if (!src.length) return { w: 0, h: H * scale, chars: 0 };
    var n = src.length;
    return {
      w: n * W * scale + Math.max(0, n - 1) * GAP * scale,
      h: H * scale,
      chars: n,
    };
  }

  function missing(text) {
    var src = expandEllipsis(text);
    var out = [];
    var seen = {};
    for (var i = 0; i < src.length; i++) {
      var ch = src.charAt(i);
      var key = normalizeChar(ch);
      if (!GLYPHS[key] && !seen[ch]) {
        seen[ch] = true;
        out.push(ch);
      }
    }
    return out;
  }

  function eachPixel(text, x, y, scale, plot) {
    scale = scale || 1;
    var src = expandEllipsis(text);
    var cx = Math.floor(x);
    var originY = Math.floor(y);
    var i, r, c, rows, py, px, s;
    for (i = 0; i < src.length; i++) {
      rows = rowsOf(src.charAt(i));
      for (r = 0; r < H; r++) {
        var row = rows[r] || ".....";
        py = originY + r * scale;
        for (c = 0; c < W; c++) {
          if (row.charAt(c) !== "#") continue;
          px = cx + c * scale;
          if (scale === 1) plot(px, py);
          else {
            for (s = 0; s < scale; s++) {
              for (var t = 0; t < scale; t++) plot(px + t, py + s);
            }
          }
        }
      }
      cx += advance(scale);
    }
  }

  function parseRgb(color, fallback) {
    if (Array.isArray(color) && color.length >= 3) {
      return [color[0] | 0, color[1] | 0, color[2] | 0];
    }
    var hex = String(color || fallback || INK);
    if (hex.charAt(0) === "#") hex = hex.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex.charAt(0) + hex.charAt(0), 16),
        parseInt(hex.charAt(1) + hex.charAt(1), 16),
        parseInt(hex.charAt(2) + hex.charAt(2), 16),
      ];
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }

  function draw(ctx, text, x, y, opts) {
    opts = opts || {};
    var scale = opts.scale || 1;
    var color = opts.color || INK;
    var align = opts.align || "left";
    var src = expandEllipsis(text);
    var size = measure(src, scale);
    var dx = x;
    if (align === "center") dx = Math.round(x - size.w / 2);
    if (align === "right") dx = Math.round(x - size.w);
    if (opts.bg) {
      ctx.fillStyle = opts.bg;
      var pad = opts.pad == null ? 1 : opts.pad;
      ctx.fillRect(dx - pad, y - pad, size.w + pad * 2, size.h + pad * 2);
    }
    ctx.fillStyle = color;
    eachPixel(src, dx, y, scale, function (px, py) {
      ctx.fillRect(px, py, 1, 1);
    });
    return size;
  }

  function blitImageData(imageData, text, x, y, rgb, opts) {
    opts = opts || {};
    var scale = opts.scale || 1;
    var src = expandEllipsis(text);
    var size = measure(src, scale);
    var dx = x;
    if (opts.align === "center") dx = Math.round(x - size.w / 2);
    var data = imageData.data;
    var w = imageData.width;
    var h = imageData.height;
    var r = rgb[0];
    var g = rgb[1];
    var b = rgb[2];
    eachPixel(src, dx, y, scale, function (px, py) {
      if (px < 0 || py < 0 || px >= w || py >= h) return;
      var i = (py * w + px) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    });
    return size;
  }

  var api = {
    W: W,
    H: H,
    GAP: GAP,
    BG: BG,
    INK: INK,
    GLYPHS: GLYPHS,
    measure: measure,
    missing: missing,
    eachPixel: eachPixel,
    draw: draw,
    blitImageData: blitImageData,
    parseRgb: parseRgb,
    advance: advance,
  };

  root.GoMomoFont = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
