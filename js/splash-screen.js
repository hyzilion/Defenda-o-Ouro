/**
 * Splash de abertura (~3s: fade in 0,5s + hold 2s + fade out 0,5s).
 * Espaço: beep curto + fade out rápido + menu.
 */
(function () {
  var FADE_MS = 500;
  var HOLD_MS = 2000;
  var SKIP_FADE_MS = 380;

  function splashSkipBeep() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ac = new Ctx();
      var o = ac.createOscillator();
      var g = ac.createGain();
      o.type = "sine";
      o.frequency.value = 920;
      g.gain.value = 0.07;
      o.connect(g);
      g.connect(ac.destination);
      o.start();
      setTimeout(function () {
        try {
          o.stop();
          ac.close();
        } catch (_) {}
      }, 70);
    } catch (_) {}
  }

  function onReady() {
    var root = document.documentElement;
    var el = document.getElementById("splashScreen");
    if (!el || el._splashBound) return;
    el._splashBound = true;

    var done = false;
    var tHoldEnd;
    var tAfterFadeOut;

    function cleanupUI() {
      el.style.display = "none";
      el.setAttribute("aria-hidden", "true");
      root.classList.remove("splash-pending");
      try {
        var api = window.__defendaApi;
        if (api && typeof api.showMenu === "function") api.showMenu();
      } catch (_) {}
      try {
        var m = document.getElementById("menuScreen");
        if (m) {
          m.style.display = "flex";
          m.setAttribute("aria-hidden", "false");
        }
      } catch (_) {}
      try {
        var w = document.getElementById("wrap");
        if (w) w.style.visibility = "";
      } catch (_) {}
    }

    function finishSkip() {
      if (done) return;
      done = true;
      clearTimeout(tHoldEnd);
      clearTimeout(tAfterFadeOut);
      document.removeEventListener("keydown", onKey, true);
      el.classList.remove("splash-visible");
      setTimeout(cleanupUI, SKIP_FADE_MS);
    }

    function onKey(e) {
      if (done) return;
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        splashSkipBeep();
        finishSkip();
      }
    }

    el.setAttribute("aria-hidden", "false");
    document.addEventListener("keydown", onKey, true);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (done) return;
        el.classList.add("splash-visible");
      });
    });

    tHoldEnd = setTimeout(function () {
      if (done) return;
      el.classList.remove("splash-visible");
      tAfterFadeOut = setTimeout(function () {
        if (done) return;
        done = true;
        document.removeEventListener("keydown", onKey, true);
        cleanupUI();
      }, FADE_MS);
    }, FADE_MS + HOLD_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }
})();
