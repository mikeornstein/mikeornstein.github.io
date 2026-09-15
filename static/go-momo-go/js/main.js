(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;

  var params = new URLSearchParams(window.location.search);
  var seed = GoMomoRng.parseSeed(params.get("seed"));
  var game = new GoMomoGame.Game(seed);
  var input = new GoMomoInput.Input(document.querySelector(".device"));
  var seedEl = document.getElementById("seed-label");
  window.GoMomo = { game: game, input: input };

  function syncSeed() {
    if (seedEl) seedEl.textContent = String(game.map.seed);
    try {
      var url = new URL(window.location.href);
      url.searchParams.set("seed", String(game.map.seed));
      history.replaceState(null, "", url);
    } catch (err) {
      /* file:// may reject URL mutation; ignore */
    }
  }

  syncSeed();

  var last = 0;
  function frame(now) {
    var dt = (now - last) / 1000;
    if (dt > 0.05) dt = 0.05;
    if (!last) dt = 1 / 60;
    last = now;
    if (typeof document !== "undefined" && document.hidden) {
      game.draw(ctx);
      requestAnimationFrame(frame);
      return;
    }
    var prevSeed = game.map.seed;
    game.update(dt, input);
    if (game.map.seed !== prevSeed) syncSeed();
    game.draw(ctx);
    requestAnimationFrame(frame);
  }

  canvas.focus();
  requestAnimationFrame(frame);
})();
