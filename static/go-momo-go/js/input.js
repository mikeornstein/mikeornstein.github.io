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

  function clearSelection() {
    var sel = root.getSelection && root.getSelection();
    if (sel && sel.removeAllRanges) sel.removeAllRanges();
  }

  function Input(rootEl) {
    this.held = { u: false, d: false, l: false, r: false };
    this.restartQueued = false;
    this.newBlockQueued = false;
    this.menuQueued = false;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    window.addEventListener("keydown", this._onKeyDown, { passive: false });
    window.addEventListener("keyup", this._onKeyUp);
    document.addEventListener("selectionchange", clearSelection);
    document.addEventListener(
      "touchstart",
      function (ev) {
        ev.preventDefault();
        clearSelection();
      },
      { capture: true, passive: false }
    );
    document.addEventListener("touchend", clearSelection);
    document.addEventListener("gesturestart", function (ev) {
      ev.preventDefault();
    });
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
    if (e.key === "Escape" || e.key === "p" || e.key === "P") {
      this.menuQueued = true;
      e.preventDefault();
    }
  };

  Input.prototype._onKeyUp = function (e) {
    var dir = KEYS[e.key];
    if (dir) this.held[dir] = false;
  };

  Input.prototype.bindPad = function (rootEl) {
    var self = this;
    function killSelect(ev) {
      ev.preventDefault();
      clearSelection();
    }
    rootEl.addEventListener("selectstart", killSelect);
    rootEl.addEventListener("contextmenu", killSelect);
    rootEl.addEventListener("dragstart", killSelect);
    var canvas = rootEl.querySelector("canvas");
    if (canvas) {
      canvas.addEventListener("selectstart", killSelect);
      canvas.addEventListener("contextmenu", killSelect);
    }
    var buttons = rootEl.querySelectorAll("[data-dir]");
    for (var i = 0; i < buttons.length; i++) {
      (function (btn) {
        var dir = btn.getAttribute("data-dir");
        function down(ev) {
          self.held[dir] = true;
          btn.classList.add("is-down");
          if (ev) ev.preventDefault();
          clearSelection();
        }
        function up(ev) {
          self.held[dir] = false;
          btn.classList.remove("is-down");
          if (ev) ev.preventDefault();
        }
        btn.addEventListener("touchstart", down, { passive: false });
        btn.addEventListener("touchend", up, { passive: false });
        btn.addEventListener("touchcancel", up);
        btn.addEventListener("pointerdown", function (ev) {
          if (ev.pointerType === "touch") return;
          down(ev);
        });
        btn.addEventListener("pointerup", function (ev) {
          if (ev.pointerType === "touch") return;
          up(ev);
        });
        btn.addEventListener("pointerleave", function (ev) {
          if (ev.pointerType === "touch") return;
          up(ev);
        });
        btn.addEventListener("pointercancel", up);
        btn.addEventListener("selectstart", killSelect);
        btn.addEventListener("contextmenu", killSelect);
      })(buttons[i]);
    }

    function bindTap(el, fn) {
      if (!el) return;
      var last = 0;
      function fire(ev) {
        if (ev) ev.preventDefault();
        var now = Date.now();
        if (now - last < 350) return;
        last = now;
        fn();
        clearSelection();
      }
      el.addEventListener("touchstart", killSelect, { passive: false });
      el.addEventListener("touchend", fire, { passive: false });
      el.addEventListener("click", fire);
      el.addEventListener("selectstart", killSelect);
      el.addEventListener("contextmenu", killSelect);
    }
    bindTap(rootEl.querySelector("[data-action=restart]"), function () {
      self.restartQueued = true;
    });
    bindTap(rootEl.querySelector("[data-action=new-block]"), function () {
      self.newBlockQueued = true;
    });
    bindTap(rootEl.querySelector("[data-action=menu]"), function () {
      self.menuQueued = true;
    });
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

  Input.prototype.consumeMenu = function () {
    var v = this.menuQueued;
    this.menuQueued = false;
    return v;
  };

  root.GoMomoInput = { Input: Input };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.GoMomoInput;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
