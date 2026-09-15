// Seeded RNG for rules-based neighborhood generation.
(function (root) {
  "use strict";

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function parseSeed(value) {
    if (value == null || value === "") return 20260914;
    var n = Number(value);
    if (Number.isFinite(n)) return n >>> 0;
    return hashString(String(value));
  }

  function Rng(seed) {
    this.seed = parseSeed(seed);
    this.next = mulberry32(this.seed);
  }

  Rng.prototype.float = function (min, max) {
    if (max == null) return this.next() * min;
    return min + this.next() * (max - min);
  };

  Rng.prototype.int = function (min, max) {
    return Math.floor(this.float(min, max + 1));
  };

  Rng.prototype.chance = function (p) {
    return this.next() < p;
  };

  Rng.prototype.pick = function (arr) {
    return arr[this.int(0, arr.length - 1)];
  };

  root.GoMomoRng = { Rng: Rng, parseSeed: parseSeed, hashString: hashString };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.GoMomoRng;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
