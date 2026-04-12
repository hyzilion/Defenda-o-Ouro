/**
 * Splash de abertura (~3s: fade in 0,5s + hold 2s + fade out 0,5s).
 * Espaço: vai direto ao menu, sem som e sem fade-out.
 */
(function () {
  var FADE_MS = 500;
  var HOLD_MS = 2000;

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
      try {
        el.style.transition = "";
        el.style.opacity = "";
      } catch (_) {}
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
      try {
        el.style.transition = "none";
        el.style.opacity = "0";
      } catch (_) {}
      cleanupUI();
    }

    function onKey(e) {
      if (done) return;
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
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
