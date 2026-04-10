(function(){
  const canvas = document.getElementById('game');
  const wrap = document.getElementById('zoomWrap');
  const btn = document.getElementById('zoomBtn');
  const ind = document.getElementById('zoomMaxInd');
  if (!canvas || !btn || !wrap) return;

  const Z_BASE = [1,1.125,1.25,1.375,1.5,1.625];
  let Z = Z_BASE.slice();
  let idx = 0; // será definido após detectar o maior zoom seguro

  function _needsScroll(){
    const root = document.documentElement;
    return (root.scrollHeight > root.clientHeight + 1) || (root.scrollWidth > root.clientWidth + 1);
  }

  function detectMaxSafeZoom(){
    // tenta aumentar o zoom até o ponto ANTES de a página precisar rolar
    // (evita corte em telas menores / Electron fullscreen/windowed)
    let best = 1;
    for (const z of Z_BASE){
      canvas.style.width  = (canvas.width  * z) + 'px';
      canvas.style.height = (canvas.height * z) + 'px';
      // força layout
      canvas.getBoundingClientRect();
      if (!_needsScroll()){
        best = z;
      } else {
        break;
      }
    }
    // lista final de zooms permitidos
    Z = Z_BASE.filter(v => v <= best + 1e-9);
    if (!Z.length) Z = [1];
    idx = Z.length - 1; // inicia no zoom máximo seguro
  }

  // roda depois que a página assentou (fontes/layout) pra medir certo
  function initSafeZoom(){
    try{
      detectMaxSafeZoom();
      apply();
    }catch(_){}
  }



  let ac = null;
  function getAC(){
    if (ac) return ac;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ac = new Ctx();
    return ac;
  }

  function blip(freq, dur){
    const ctx = getAC();
    if (!ctx) return;
    if (ctx.state === 'suspended') { try{ ctx.resume(); }catch(_){ } }
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.value = 0.05;
    o.connect(g).connect(ctx.destination);
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.05, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0);
    o.stop(t0 + dur);
  }

  function safeFreq(v){
    v = Number(v) || 440;
    if (v < 120) v = 120;
    if (v > 1600) v = 1600;
    return v;
  }


  function fmt(z){
    // Avoid ugly float strings (e.g., 1.799999999)
    const s = (Math.round(z * 10) / 10).toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  }

  let indTimer = null;
  function showInd(){
    if (!ind) return;
    ind.classList.add('on');
    if (indTimer) clearTimeout(indTimer);
    indTimer = setTimeout(function(){
      if (ind) ind.classList.remove('on');
      indTimer = null;
    }, 5000);
  }
  function clearInd(){
    if (!ind) return;
    if (indTimer){ clearTimeout(indTimer); indTimer = null; }
    ind.classList.remove('on');
  }

  function apply(){
    const z = Z[idx];
    canvas.style.width  = (canvas.width  * z) + 'px';
    canvas.style.height = (canvas.height * z) + 'px';
    const label = fmt(z);
    btn.setAttribute('aria-label', 'Zoom: ' + label + 'x');    if (ind){
      if (idx === (Z.length - 1)) showInd();
      else clearInd();
    }
}
  initSafeZoom();

  // Re-show MAX badge on hover/focus (no click needed)
  btn.addEventListener('mouseenter', function(){
    if (idx === (Z.length - 1)) showInd();
  });
  btn.addEventListener('focus', function(){
    if (idx === (Z.length - 1)) showInd();
  });

  btn.addEventListener('click', function(){
    idx = (idx + 1) % Z.length;
    apply();
    blip(safeFreq(460 + idx * 95), 0.07);
  });

  btn.addEventListener('contextmenu', function(e){
    e.preventDefault();
    idx = (idx - 1 + Z.length) % Z.length;
    apply();
    blip(safeFreq(760 - idx * 70), 0.07);
  });


  // Recalcula o máximo seguro ao redimensionar (ou mudar DPI/zoom do sistema).
  window.addEventListener('resize', function(){
    try{
      const cur = Z[idx];
      detectMaxSafeZoom();
      const k = Z.indexOf(cur);
      idx = (k >= 0) ? k : (Z.length - 1);
      apply();
    }catch(_){}
  });
  function tick(){
    try{
      const menu = document.getElementById('menuScreen');
      if (menu){
        // Determine whether we are currently outside the main menu. The
        // zoom/lens button should be visible during actual gameplay but
        // hidden whenever the player is navigating menus or selection
        // screens. Start with the previous logic: show when the main
        // menu is hidden.
        const menuHidden = (menu.getAttribute('aria-hidden') === 'true') || (getComputedStyle(menu).display === 'none');
        // Nunca mostrar zoom na tela de perfil
        const profileOpen = document.body.getAttribute('data-profile-open') === '1';
        let showZoom = menuHidden && !profileOpen;
        // Additional check: hide on mode selection and map selection screens.
        // If either the modeScreen or mapScreen is visible (not hidden and
        // display isn't none), we override and hide the zoom button.
        try{
          const modeScr = document.getElementById('modeScreen');
          const mapScr  = document.getElementById('mapScreen');
          const modeVisible = modeScr && modeScr.getAttribute('aria-hidden') !== 'true' && getComputedStyle(modeScr).display !== 'none';
          const mapVisible  = mapScr && mapScr.getAttribute('aria-hidden') !== 'true' && getComputedStyle(mapScr).display !== 'none';
          if (modeVisible || mapVisible){ showZoom = false; }
        }catch(_){}
        // Coop mode always hides the zoom button.
        try{
          if (window.state && state.coop){ showZoom = false; }
        }catch(_){}
        wrap.style.display = showZoom ? 'block' : 'none';
        if (showZoom){
          wrap.style.visibility = 'visible';
          wrap.style.opacity = '1';
          wrap.style.pointerEvents = 'auto';
        } else {
          wrap.style.pointerEvents = 'none';
        }
        wrap.setAttribute('aria-hidden', showZoom ? 'false' : 'true');
      }
    }catch(_){}
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
