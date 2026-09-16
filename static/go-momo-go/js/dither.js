// Ordered (Bayer) dither onto the Playdate two-ink palette.
// Draw the world in any greys/colors, then run ditherImageData on the LCD buffer.
(function (root) {
  "use strict";

  var BG_HEX = "#c9d63a";
  var INK_HEX = "#2a1c12";
  var BG_RGB = [0xc9, 0xd6, 0x3a];
  var INK_RGB = [0x2a, 0x1c, 0x12];

  // 4×4 Bayer; thresholds are (n + 0.5) / 16.
  var BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  function hexOf(r, g, b) {
    function h(n) {
      var s = n.toString(16);
      return s.length === 1 ? "0" + s : s;
    }
    return "#" + h(r) + h(g) + h(b);
  }

  function isPaletteRgb(r, g, b) {
    return (r === BG_RGB[0] && g === BG_RGB[1] && b === BG_RGB[2]) || (r === INK_RGB[0] && g === INK_RGB[1] && b === INK_RGB[2]);
  }

  function luminance(r, g, b) {
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  function ditherImageData(imageData) {
    var data = imageData.data;
    var w = imageData.width;
    var h = imageData.height;
    var x, y, i, t, lum, ink;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = (y * w + x) * 4;
        if (isPaletteRgb(data[i], data[i + 1], data[i + 2])) {
          data[i + 3] = 255;
          continue;
        }
        lum = luminance(data[i], data[i + 1], data[i + 2]);
        t = (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
        ink = lum < t;
        if (ink) {
          data[i] = INK_RGB[0];
          data[i + 1] = INK_RGB[1];
          data[i + 2] = INK_RGB[2];
        } else {
          data[i] = BG_RGB[0];
          data[i + 1] = BG_RGB[1];
          data[i + 2] = BG_RGB[2];
        }
        data[i + 3] = 255;
      }
    }
    return imageData;
  }

  function collectColors(imageData) {
    var data = imageData.data;
    var seen = {};
    var out = [];
    for (var i = 0; i < data.length; i += 4) {
      var key = hexOf(data[i], data[i + 1], data[i + 2]);
      if (!seen[key]) {
        seen[key] = true;
        out.push(key);
      }
    }
    return out;
  }

  function isPlaydatePalette(imageData) {
    var colors = collectColors(imageData);
    for (var i = 0; i < colors.length; i++) {
      if (colors[i] !== BG_HEX && colors[i] !== INK_HEX) return false;
    }
    return colors.length > 0;
  }

  var api = {
    BG: BG_HEX,
    INK: INK_HEX,
    BG_RGB: BG_RGB,
    INK_RGB: INK_RGB,
    BAYER4: BAYER4,
    hexOf: hexOf,
    isPaletteRgb: isPaletteRgb,
    luminance: luminance,
    ditherImageData: ditherImageData,
    collectColors: collectColors,
    isPlaydatePalette: isPlaydatePalette,
  };

  root.GoMomoDither = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
