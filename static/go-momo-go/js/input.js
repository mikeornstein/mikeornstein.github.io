// WASD / arrows plus on-screen d-pad. Soft buttons for mobile web.
(function (root) {
  "use strict";

  var KEYS = {
    ArrowUp: "u",
    ArrowDown: "d",
    ArrowLeft: "l",
    ArrowRight: "r",
    w: "u",
    a: "l",
    s: "d",
    d: "r",
    W: "u",
    A: "l",
    S: "d",
    D: "r",
  };

  function Input(rootEl) {
    this.held = { u: false, d: false, l: false, r: false };
    this.restartQueued = false;
    this.newBlockQueued = false;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    window.addEventListener("keydown", this._onKeyDown, { passive: false });
    window.addEventListener("keyup", this._onKeyUp);
    if (rootEl) this.bindPad(rootEl);
  }

  Input.prototype._onKeyDown = function (e) {
    var dir = KEYS[e.key];
    if (dir) {
      this.held[dir] = true;
      e.preventDefault();
    }
    if (e.key === "r" || e.key === "R" || e.key === "Enter" || e.key === " ") {
      this.restartQueued = true;
      if (e.key !== " ") e.preventDefault();
    }
    if (e.key === "n" || e.key === "N" || e.key === "b" || e.key === "B") {
      this.newBlockQueued = true;
    }
  };

  Input.prototype._onKeyUp = function (e) {
    var dir = KEYS[e.key];
    if (dir) this.held[dir] = false;
  };

  Input.prototype.bindPad = function (rootEl) {
    var self = this;
    var buttons = rootEl.querySelectorAll("[data-dir]");
    for (var i = 0; i < buttons.length; i++) {
      (function (btn) {
        var dir = btn.getAttribute("data-dir");
        function down(ev) {
          self.held[dir] = true;
          btn.classList.add("is-down");
          ev.preventDefault();
        }
        function up(ev) {
          self.held[dir] = false;
          btn.classList.remove("is-down");
          if (ev) ev.preventDefault();
        }
        btn.addEventListener("pointerdown", down);
        btn.addEventListener("pointerup", up);
        btn.addEventListener("pointerleave", up);
        btn.addEventListener("pointercancel", up);
      })(buttons[i]);
    }
    var restart = rootEl.querySelector("[data-action=restart]");
    if (restart) {
      restart.addEventListener("click", function (e) {
        e.preventDefault();
        self.restartQueued = true;
      });
    }
    var fresh = rootEl.querySelector("[data-action=new-block]");
    if (fresh) {
      fresh.addEventListener("click", function (e) {
        e.preventDefault();
        self.newBlockQueued = true;
      });
    }
  };

  Input.prototype.axis = function () {
    var x = (this.held.r ? 1 : 0) - (this.held.l ? 1 : 0);
    var y = (this.held.d ? 1 : 0) - (this.held.u ? 1 : 0);
    if (x !== 0 && y !== 0) {
      var inv = 1 / Math.sqrt(2);
      return { x: x * inv, y: y * inv };
    }
    return { x: x, y: y };
  };

  Input.prototype.consumeRestart = function () {
    var v = this.restartQueued;
    this.restartQueued = false;
    return v;
  };

  Input.prototype.consumeNewBlock = function () {
    var v = this.newBlockQueued;
    this.newBlockQueued = false;
    return v;
  };

  root.GoMomoInput = { Input: Input };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.GoMomoInput;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
