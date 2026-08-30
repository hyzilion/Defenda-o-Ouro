(function(){
  const singleLineButtonSelector = '.map-entity-select-menu .btn';
  const singleLineButtonOriginalFont = new WeakMap();
  const singleLineButtonQueue = new Set();
  let singleLineButtonFrame = 0;

  function fitSingleLineButton(btn){
    if (!btn || !btn.isConnected) return;
    if (!singleLineButtonOriginalFont.has(btn)){
      singleLineButtonOriginalFont.set(btn, btn.style.fontSize || '');
    }
    btn.style.fontSize = singleLineButtonOriginalFont.get(btn);
    if (btn.clientWidth <= 0 || btn.scrollWidth <= btn.clientWidth) return;

    const baseSize = parseFloat(getComputedStyle(btn).fontSize) || 12;
    let low = 1;
    let high = baseSize;
    for (let i = 0; i < 10; i += 1){
      const middle = (low + high) / 2;
      btn.style.fontSize = middle.toFixed(2) + 'px';
      if (btn.scrollWidth <= btn.clientWidth) low = middle;
      else high = middle;
    }
    btn.style.fontSize = Math.max(1, Math.floor(low * 10) / 10).toFixed(1) + 'px';
  }

  function queueSingleLineButton(btn){
    if (!btn || !btn.matches(singleLineButtonSelector)) return;
    singleLineButtonQueue.add(btn);
    if (singleLineButtonFrame) return;
    singleLineButtonFrame = requestAnimationFrame(function(){
      singleLineButtonFrame = 0;
      singleLineButtonQueue.forEach(fitSingleLineButton);
      singleLineButtonQueue.clear();
    });
  }

  const singleLineButtonResizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(function(entries){
        entries.forEach(function(entry){ queueSingleLineButton(entry.target); });
      })
    : null;

  document.querySelectorAll(singleLineButtonSelector).forEach(function(btn){
    if (singleLineButtonResizeObserver) singleLineButtonResizeObserver.observe(btn);
    queueSingleLineButton(btn);
  });
  const singleLineButtonMutationObserver = new MutationObserver(function(mutations){
    mutations.forEach(function(mutation){
      const parentButton = mutation.target.nodeType === Node.TEXT_NODE
        ? mutation.target.parentElement && mutation.target.parentElement.closest(singleLineButtonSelector)
        : mutation.target.closest && mutation.target.closest(singleLineButtonSelector);
      if (parentButton) queueSingleLineButton(parentButton);
    });
  });
  document.querySelectorAll('.map-entity-select-menu').forEach(function(menuElement){
    singleLineButtonMutationObserver.observe(menuElement, { childList:true, subtree:true, characterData:true });
  });
  if (document.fonts && document.fonts.ready){
    document.fonts.ready.then(function(){
      document.querySelectorAll(singleLineButtonSelector).forEach(queueSingleLineButton);
    });
  }

  try{
    document.querySelectorAll('.map-entity-select-menu .btn').forEach(function(btn){
      btn.classList.add('map-entity-keep-hover');
    });
  }catch(_){}
  document.addEventListener('change', function(e){
    const el = e.target;
    if (!el || el.type !== 'checkbox' || el.dataset.noToggleSound === '1') return;
    try{
      if (window._playToggleSound) window._playToggleSound(!!el.checked);
      else if (window._gameBeep) window._gameBeep(el.checked ? 760 : 360, 0.045, 'triangle', 0.03);
    }catch(_){}
  });

  const menu = document.getElementById('menuScreen');
  const opt = document.getElementById('optionsScreen');
  const btnOpen = document.getElementById('btnOptionsCorner') || document.getElementById('btnOptions');
  const btnBack = document.getElementById('btnOptionsBack');
  const btnEscClose = document.getElementById('btnOptionsEscClose');

  const musicSlider = document.getElementById('musicSlider');
  const sfxSlider = document.getElementById('sfxSlider');
  const musicVal = document.getElementById('musicVal');
  const sfxVal = document.getElementById('sfxVal');
  const fsCheck = document.getElementById('fullscreenCheck');
  const autoZoomCheck = document.getElementById('autoZoomCheck');
  const autoAdvanceDialogCheck = document.getElementById('autoAdvanceDialogCheck');

  if (!menu || !opt || !btnOpen || !btnBack) return;

  function pct(n){ return Math.round(n * 100); }
  function syncSliderFill(slider){
    if (!slider) return;
    const min = Number(slider.min || 0);
    const max = Number(slider.max || 100);
    const value = Number(slider.value || 0);
    const amount = max > min ? ((value - min) / (max - min)) * 100 : 0;
    slider.style.setProperty('--range-pct', Math.max(0, Math.min(100, amount)).toFixed(1) + '%');
  }
  function syncUI(){
    if (musicSlider) musicSlider.value = String(pct(settings.music));
    if (sfxSlider) sfxSlider.value = String(pct(settings.sfx));
    syncSliderFill(musicSlider);
    syncSliderFill(sfxSlider);
    if (musicVal) musicVal.textContent = String(pct(settings.music));
    if (sfxVal) sfxVal.textContent = String(pct(settings.sfx));
    if (fsCheck) fsCheck.checked = !!settings.fullscreen;
    if (autoZoomCheck) autoZoomCheck.checked = settings.autoZoom !== false;
    const _sc=document.getElementById('shakeCheck'); if(_sc) _sc.checked=settings.screenShake!==false;
    const _posc=document.getElementById('pauseOnSelectCheck'); if(_posc) _posc.checked=settings.pauseOnSelect!==false;
    if (autoAdvanceDialogCheck) autoAdvanceDialogCheck.checked = settings.autoAdvanceDialog === true;
    try{ if (window._syncAutoAdvanceDialogControls) window._syncAutoAdvanceDialogControls(); }catch(_){}
    var _gs4sync = window._gameSettings||{};
    var _modeToShow = (_gs4sync.inputMode||settings.inputMode||'mouse');
    _updateModeBtns(_modeToShow);
    if(window._updateModeBtnsVisual) window._updateModeBtnsVisual(_modeToShow);
    if (window._refreshInputModeCoopLockUI) window._refreshInputModeCoopLockUI();
  }

  // ==== Opções (menu + in-game) ====
  // Nota: este script roda fora do IIFE principal, então NUNCA acessa `state` diretamente.
  // Use a API exposta pelo jogo.
  let __optPrevPausedManual = null;

  function __getGameState(){
    try{
      const api = window.__defendaApi;
      return (api && typeof api.getState === 'function') ? api.getState() : null;
    }catch(_){ return null; }
  }

  function __syncPauseButtonIcon(paused){
    try{
      if (typeof window.__defendaSyncPauseButtonIcon === 'function'){
        window.__defendaSyncPauseButtonIcon(paused);
        return;
      }
      const button = document.getElementById('pauseBtn');
      if (!button) return;
      const isPaused = !!paused;
      const label = isPaused ? 'Despausar' : 'Pausar';
      button.textContent = isPaused ? '▶' : '⏸';
      button.setAttribute('aria-label', label);
      button.setAttribute('data-game-tooltip', label);
    }catch(_){}
  }

  function __pauseForOptions(){
    const st = __getGameState();
    if (!st || st.inMenu || !st.running) return;
    if (st.onlineCoop) return;
    __optPrevPausedManual = !!st.pausedManual;
    st.pausedManual = true;
    __syncPauseButtonIcon(true);
  }

  function __resumeAfterOptions(){
    const st = __getGameState();
    if (!st || st.inMenu || !st.running) { __optPrevPausedManual = null; return; }
    if (st.onlineCoop){ __optPrevPausedManual = null; return; }
    st.pausedManual = (__optPrevPausedManual === null) ? false : __optPrevPausedManual;
    __optPrevPausedManual = null;
    __syncPauseButtonIcon(st.pausedManual);
  }

  function showOptions(fromInGame){
    const fromOnlineLobby = fromInGame === 'onlineLobby';
    const fromEscMenu = fromInGame === 'escMenu';
    fromInGame = !!fromInGame && !fromOnlineLobby;
    // Se abrir in-game, pausa primeiro
    if (fromInGame) __pauseForOptions();
    if (fromInGame){ try{ if (window.__defendaClearHeldInputs) window.__defendaClearHeldInputs(); }catch(_){ } }
    try{
      if (fromOnlineLobby) document.body.setAttribute('data-online-options-open','1');
      else document.body.removeAttribute('data-online-options-open');
    }catch(_){}

    if(fromInGame){
      try{ document.body.setAttribute('data-options-open','1'); }catch(_){ }
      try{ if (window.__defendaSyncInGameModalMusicDuck) window.__defendaSyncInGameModalMusicDuck(); }catch(_){ }
      try{
        ['shopBtn','menuBackBtn','pauseBtn','enemiesBtn','ingameOptBtn','p1ShopBtn','p2ShopBtn'].forEach(function(id){
          var b=document.getElementById(id);
          if(b){ b.disabled=true; try{b.setAttribute('aria-disabled','true');}catch(_){ }
          }
        });
      }catch(_){ }
    }
    if(!fromInGame && !fromOnlineLobby){
      menu.style.display = 'none';
      menu.setAttribute('aria-hidden','true');
    }


    opt.style.display = 'flex';
    if (fromInGame){ opt.setAttribute('data-ingame','1'); } else { opt.removeAttribute('data-ingame'); }
    if (fromEscMenu){ opt.setAttribute('data-return-esc-menu','1'); } else { opt.removeAttribute('data-return-esc-menu'); }
    if (fromOnlineLobby){ opt.setAttribute('data-online-lobby','1'); } else { opt.removeAttribute('data-online-lobby'); }
    opt.setAttribute('aria-hidden','false');

    syncUI();
    try{ if (window._refreshInputModeCoopLockUI) window._refreshInputModeCoopLockUI(); }catch(_){}
    try{ const ac = getAudio(); if (ac && ac.state === 'suspended') ac.resume(); }catch(_){}
  }

  function hideOptions(){
    const returnToMainMenu = opt.getAttribute('data-ingame') !== '1' && opt.getAttribute('data-online-lobby') !== '1';
    opt.style.display = 'none';
    opt.setAttribute('aria-hidden','true');
    if(returnToMainMenu){
      menu.style.display = 'flex';
      menu.setAttribute('aria-hidden','false');
    }
    try{ document.body.removeAttribute('data-online-options-open'); }catch(_){}

    // Se estiver in-game, despausa ao fechar (voltando ao estado anterior)
    try{
      if(opt.getAttribute('data-ingame')==='1'){
        try{ document.body.removeAttribute('data-options-open'); }catch(_){ }
        try{ if (window.__defendaSyncInGameModalMusicDuck) window.__defendaSyncInGameModalMusicDuck(); }catch(_){ }
        try{
          if(document.body.getAttribute('data-results-open')!=='1'){
            ['shopBtn','menuBackBtn','pauseBtn','enemiesBtn','ingameOptBtn','p1ShopBtn','p2ShopBtn'].forEach(function(id){
              var b=document.getElementById(id);
              if(b){ b.disabled=false; try{b.setAttribute('aria-disabled','false');}catch(_){ }
              }
            });
            try{ if (window.syncCoopLocalShopDeathButtons) window.syncCoopLocalShopDeathButtons(); }catch(_){}
          }
        }catch(_){ }

        __resumeAfterOptions();
        try{ if (window.__defendaRefreshDialogHudLock) window.__defendaRefreshDialogHudLock(); }catch(_){}
      }
      opt.removeAttribute('data-ingame');
      opt.removeAttribute('data-return-esc-menu');
      opt.removeAttribute('data-online-lobby');
    }catch(_){ }
    try{ if (window._refreshInputModeCoopLockUI) window._refreshInputModeCoopLockUI(); }catch(_){}
    saveSettings();
  }

  // Expõe helpers globais (outros scripts já tentam chamar closeOptions())
  if (typeof window._selectionResume !== 'function') window._selectionResume = function(){};
  window.openOptions = function(fromInGame){ try{ if (document.body && document.body.getAttribute('data-results-open')==='1') return; }catch(_){ } showOptions(fromInGame); };
  window.closeOptions = function(){
    const ingame = (opt.getAttribute('data-ingame')==='1');
    hideOptions();
    if (ingame) __resumeAfterOptions(); // redundância segura
  };

  function finishDestroySelection(g){
    try{ if (window._selectionResume) window._selectionResume(); }catch(_){}
    const st = g && g.state;
    function apply(){
      try{
        if (!st) return;
        st.pausedManual = false;
        st._selectionPaused = false;
        st._selectedMapEntitySig = null;
        st.pauseFade = 0;
        __syncPauseButtonIcon(false);
      }catch(_){}
    }
    apply();
    try{ setTimeout(apply, 0); }catch(_){}
  }

  // Botão Opções in-game: abre o mesmo painel, sobrepondo o jogo (sem background do menu)
  const ingameBtn = document.getElementById('ingameOptBtn');
  if (ingameBtn && !ingameBtn._bound2){
    ingameBtn._bound2 = true;
    ingameBtn.addEventListener('click', function(){
      const st = __getGameState();
      if (!st || !st.running || st.inMenu) return;
      showOptions(true);
    });
  }
  const onlineLobbyOptionsBtn = document.getElementById('onlineLobbyOptionsBtn');
  if (onlineLobbyOptionsBtn && !onlineLobbyOptionsBtn._boundOptions){
    onlineLobbyOptionsBtn._boundOptions = true;
    onlineLobbyOptionsBtn.addEventListener('click', function(){
      showOptions('onlineLobby');
    });
  }
  const onlineLobbyProfileBtn = document.getElementById('onlineLobbyProfileBtn');
  if (onlineLobbyProfileBtn && !onlineLobbyProfileBtn._boundProfile){
    onlineLobbyProfileBtn._boundProfile = true;
    onlineLobbyProfileBtn.addEventListener('click', function(){
      try{
        if (window.__defendaApi && window.__defendaApi.openOnlineProfileOverlay) window.__defendaApi.openOnlineProfileOverlay();
      }catch(_){}
    });
  }
  const onlineLobbyShopBtn = document.getElementById('onlineLobbyShopBtn');
  if (onlineLobbyShopBtn && !onlineLobbyShopBtn._boundShop){
    onlineLobbyShopBtn._boundShop = true;
    onlineLobbyShopBtn.addEventListener('click', function(){
      try{
        document.body.setAttribute('data-online-store-open','1');
        const storeBtn = document.getElementById('btnCosmeticStore');
        if (storeBtn) storeBtn.click();
      }catch(_){}
    });
  }

  btnOpen.addEventListener('click', function(){
    showOptions(false);
  });
  btnBack.addEventListener('click', function(){
    const ingame = (opt.getAttribute('data-ingame')==='1');
    const returnEscMenu = (opt.getAttribute('data-return-esc-menu')==='1');
    const onlineLobby = (opt.getAttribute('data-online-lobby')==='1');
    hideOptions();
    if (onlineLobby) return;
    if (returnEscMenu){
      try{
        const st = __getGameState();
        if (st && !st.onlineCoop) st.pausedManual = !!st._optionsReturnToEscPrevPausedManual;
        if (st) st._optionsReturnToEscPrevPausedManual = null;
      }catch(_){}
      try{ if (window.openInGameEscMenu) window.openInGameEscMenu(); }catch(_){}
      return;
    }
    if (ingame) return; // in-game não volta pro menu
    showMenu();
  });

  if (btnEscClose && !btnEscClose._bound){
    btnEscClose._bound = true;
    btnEscClose.addEventListener('click', function(){
      const returnEscMenu = (opt.getAttribute('data-return-esc-menu') === '1');
      if (!returnEscMenu) return;
      try{
        const st = __getGameState();
        if (st){
          const prevPaused = !!st._optionsReturnToEscPrevPausedManual;
          st._optionsReturnToEscPrevPausedManual = null;
          if (!st.onlineCoop) st.pausedManual = prevPaused;
        }
      }catch(_){}
      hideOptions();
    });
  }

  // sliders
  if (musicSlider){
    musicSlider.addEventListener('input', function(){
      const v = Math.min(100, Math.max(0, parseInt(musicSlider.value, 10) || 0));
      settings.music = v / 100;
      syncSliderFill(musicSlider);
      if (musicVal) musicVal.textContent = String(v);
      refreshMusicGain();
      saveSettings();
    });
  }
  if (sfxSlider){
    sfxSlider.addEventListener('input', function(){
      const v = Math.min(100, Math.max(0, parseInt(sfxSlider.value, 10) || 0));
      settings.sfx = v / 100;
      syncSliderFill(sfxSlider);
      if (sfxVal) sfxVal.textContent = String(v);
      saveSettings();
      // feedback discreto
      try{ beep(520, 0.04, 'square', 0.02); }catch(_){}
    });
  }

  // fullscreen
  async function setFullscreen(on){
    const nativeStore = window.__defendaNativeStore;
    if (nativeStore && typeof nativeStore.setFullscreen === 'function'){
      try{
        return !!nativeStore.setFullscreen(!!on);
      }catch(_){}
    }
    const de = document.documentElement;
    try{
      if (on){
        if (!document.fullscreenElement && de.requestFullscreen) await de.requestFullscreen();
        return true;
      }else{
        if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
        return false;
      }
    }catch(_){}
    return !!document.fullscreenElement;
  }

  if (fsCheck){
    fsCheck.addEventListener('change', async function(){
      settings.fullscreen = !!fsCheck.checked;
      saveSettings();
      const applied = await setFullscreen(settings.fullscreen);
      settings.fullscreen = !!applied;
      fsCheck.checked = !!applied;
      saveSettings();
    });
  }
  if (autoZoomCheck){
    autoZoomCheck.addEventListener('change', function(){
      settings.autoZoom = autoZoomCheck.checked;
      if (window._gameSettings) window._gameSettings.autoZoom = autoZoomCheck.checked;
      saveSettings();
      try{ if (window.__defendaSyncAutoZoomPreference) window.__defendaSyncAutoZoomPreference(); }catch(_){}
    });
  }
  const _shakeEl=document.getElementById('shakeCheck');
  if(_shakeEl){
    _shakeEl.addEventListener('change',function(){settings.screenShake=_shakeEl.checked;if(window._gameSettings)window._gameSettings.screenShake=_shakeEl.checked;saveSettings();});
  }
  // Pausar em Seleções
  var _posEl=document.getElementById('pauseOnSelectCheck');
  if(_posEl){
    _posEl.addEventListener('change',function(){
      settings.pauseOnSelect=_posEl.checked;
      if(window._gameSettings) window._gameSettings.pauseOnSelect=_posEl.checked;
      saveSettings();
    });
  }
  if (autoAdvanceDialogCheck){
    autoAdvanceDialogCheck.addEventListener('change', function(){
      settings.autoAdvanceDialog = autoAdvanceDialogCheck.checked;
      if (window._gameSettings) window._gameSettings.autoAdvanceDialog = autoAdvanceDialogCheck.checked;
      saveSettings();
      try{ if (window._syncAutoAdvanceDialogControls) window._syncAutoAdvanceDialogControls(); }catch(_){}
      try{ if (window._refreshDialogAutoAdvance) window._refreshDialogAutoAdvance(); }catch(_){}
    });
  }
  // Tipo de Jogabilidade
  function _setInputMode(mode){
    if (!window.__inputModeSetBypassCoopGuard){
      try{
        const api = window.__defendaApi;
        const st = (api && typeof api.getState === 'function') ? api.getState() : null;
        if (st && st.coop && !st.onlineCoop && st.running && !st.inMenu) return;
      }catch(_){}
    }
    var previousMode = settings.inputMode || 'mouse';
    settings.inputMode=mode;
    if(window._gameSettings) window._gameSettings.inputMode=mode;
    // Garantir que window.settings (usado como fallback) também é atualizado
    try{ if(window.settings) window.settings.inputMode=mode; }catch(_){}
    saveSettings();
    _updateModeBtns(mode);
    if(window._updateModeBtnsVisual) window._updateModeBtnsVisual(mode);
  }
  function _updateModeBtns(mode){
    var btnM=document.getElementById('inputModeMouse'), btnK=document.getElementById('inputModeKeys');
    if(!btnM||!btnK) return;
    var isMouse=(mode||'mouse')==='mouse';
    btnM.classList.toggle('active', isMouse);
    btnK.classList.toggle('active', !isMouse);
  }
  window._setInputMode = _setInputMode;
  window._updateModeBtns = _updateModeBtns;

  /** Durante partida em coop: força UI em Apenas Teclado e desativa os botões de modo. */
  window._refreshInputModeCoopLockUI = function _refreshInputModeCoopLockUI(){
    var btnM = document.getElementById('inputModeMouse');
    var btnK = document.getElementById('inputModeKeys');
    if (!btnM || !btnK) return;
    var st = null;
    try{
      var api = window.__defendaApi;
      st = (api && typeof api.getState === 'function') ? api.getState() : null;
    }catch(_){}
    var locked = !!(st && st.coop && !st.onlineCoop && st.running && !st.inMenu);
    if (locked){
      btnM.disabled = true;
      btnK.disabled = true;
      try{ btnM.setAttribute('aria-disabled', 'true'); btnK.setAttribute('aria-disabled', 'true'); }catch(_){}
      try{ btnM.style.pointerEvents = 'none'; btnK.style.pointerEvents = 'none'; }catch(_){}
      btnM.style.cursor = 'not-allowed';
      btnK.style.cursor = 'not-allowed';
      btnM.style.opacity = '0.42';
      btnM.style.filter = 'grayscale(1)';
      btnK.style.opacity = '1';
      btnK.style.filter = '';
    } else {
      btnM.disabled = false;
      btnK.disabled = false;
      try{ btnM.removeAttribute('aria-disabled'); btnK.removeAttribute('aria-disabled'); }catch(_){}
      try{ btnM.style.pointerEvents = ''; btnK.style.pointerEvents = ''; }catch(_){}
      btnM.style.cursor = 'pointer';
      btnK.style.cursor = 'pointer';
      btnM.style.opacity = '';
      btnM.style.filter = '';
      btnK.style.opacity = '';
      btnK.style.filter = '';
    }
  };

  // Apply saved fullscreen on load (best-effort; may require user gesture)
  window.addEventListener('load', function(){
    syncUI();
    if (settings.fullscreen){
      try{ fsCheck.checked = true; }catch(_){}
    }
    refreshMusicGain();
  });

})();

// === Tooltips customizados ===
(function(){
  let tooltipEl = null;
  let activeTarget = null;

  function ensureTooltip(){
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'game-tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function tooltipText(el){
    if (!el) return '';
    const title = el.getAttribute('title');
    if (title){
      el.setAttribute('data-game-tooltip', title);
      el.removeAttribute('title');
      return title;
    }
    return el.getAttribute('data-game-tooltip') || '';
  }

  function isExtraUpgradeTooltip(target){
    if (!target || !target.matches || !target.matches('.map-entity-select-menu .btn[data-game-tooltip]')) return false;
    let sibling = target.previousElementSibling;
    while (sibling){
      if (sibling.classList.contains('ally-menu-extra-label')) return true;
      if (sibling.classList.contains('ally-menu-divider')) return false;
      sibling = sibling.previousElementSibling;
    }
    return false;
  }

  function positionTooltip(target){
    if (!tooltipEl || !target) return;
    const rect = target.getBoundingClientRect();
    const tip = tooltipEl.getBoundingClientRect();
    const margin = 10;
    let left = rect.left + rect.width / 2;
    let top = rect.top;
    const below = rect.top - tip.height - margin < 8;
    left = Math.max(12 + tip.width / 2, Math.min(window.innerWidth - 12 - tip.width / 2, left));
    if (below) top = rect.bottom;
    tooltipEl.classList.toggle('is-below', below);
    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = top + 'px';
  }

  function showTooltip(target){
    const text = tooltipText(target);
    if (!text) return;
    activeTarget = target;
    const tip = ensureTooltip();
    tip.textContent = text;
    tip.classList.toggle('is-extra-upgrade', isExtraUpgradeTooltip(target));
    tip.classList.add('is-visible');
    positionTooltip(target);
  }

  function hideTooltip(){
    activeTarget = null;
    if (tooltipEl) tooltipEl.classList.remove('is-visible', 'is-extra-upgrade');
  }

  document.addEventListener('mouseover', function(e){
    const target = e.target && e.target.closest ? e.target.closest('[title], [data-game-tooltip]') : null;
    if (target) showTooltip(target);
  });
  document.addEventListener('click', function(e){
    const clickedTarget = activeTarget;
    if (!clickedTarget) return;
    requestAnimationFrame(function(){
      if (activeTarget !== clickedTarget) return;
      const hovered = document.elementFromPoint(e.clientX, e.clientY);
      if (hovered && (hovered === clickedTarget || clickedTarget.contains(hovered))) showTooltip(clickedTarget);
      else hideTooltip();
    });
  });
  document.addEventListener('mouseout', function(e){
    if (!activeTarget) return;
    const next = e.relatedTarget;
    if (next && activeTarget.contains && activeTarget.contains(next)) return;
    hideTooltip();
  });
  document.addEventListener('focusin', function(e){
    const target = e.target && e.target.closest ? e.target.closest('[title], [data-game-tooltip]') : null;
    if (target) showTooltip(target);
  });
  document.addEventListener('focusout', hideTooltip);
  window.addEventListener('scroll', function(){ if (activeTarget) positionTooltip(activeTarget); }, true);
  window.addEventListener('resize', function(){ if (activeTarget) positionTooltip(activeTarget); });
})();

// === Menu de torre: botões Aprimorar e Destruir ===
(function(){
  const TILE_SZ = 32; // tamanho do tile em px

  function G(){ return window._G || null; }
  function isOnlineClient(g){
    return !!(g && g.state && g.state.onlineCoop && g.state.onlineRole === 'client');
  }
  function isOnlineGame(g){
    return !!(g && g.state && g.state.onlineCoop);
  }
  function onlineLocalPlayer(g){
    const st = g && g.state;
    if (!st || !Array.isArray(st.onlinePlayers)) return null;
    return st.onlinePlayers.find(function(p){ return p && p.id === st.onlineClientId; }) || null;
  }
  function onlineActiveMenuPlayer(g){
    const st = g && g.state;
    if (!st || !Array.isArray(st.onlinePlayers)) return null;
    const local = onlineLocalPlayer(g);
    if (local) return local;
    const slot = st.activeShopPlayer || 1;
    return st.onlinePlayers.find(function(p){ return p && (p.slot|0) === (slot|0); }) || st.onlinePlayers[0] || null;
  }
  function menuScore(g){
    if (isOnlineGame(g)){
      const p = onlineActiveMenuPlayer(g);
      return p ? (Number(p.score)||0) : 0;
    }
    return g && g.state ? (Number(g.state.score)||0) : 0;
  }
  function spendMenuScore(g, n){
    if (!g || !g.state) return;
    if (isOnlineGame(g)){
      const p = onlineActiveMenuPlayer(g);
      if (p) p.score = Math.max(0, (Number(p.score)||0) - n);
      try{ if (g.state.onlinePlayers) g.state['score' + ((p && p.slot) || 1)] = p ? (p.score || 0) : 0; }catch(_){}
      return;
    }
    g.state.score = (Number(g.state.score)||0) - n;
  }
  function mapMenuErrorToast(g){
    const msg = 'Pontuação insuficiente';
    try{
      const toast = window._profSkinToast || window.__profSkinToast;
      if (toast) toast(msg, true);
    }catch(_){}
    try{ (window._gameBeep || (g && g.beep) || function(){})(180,0.09,'sawtooth',0.07); }catch(_){}
    try{
      if (!(window._profSkinToast || window.__profSkinToast) && g && g.toastMsg) g.toastMsg(msg);
    }catch(_){}
  }
  function playShopBuySound(){
    try{ (window._profSndBuy || window.__profSndBuy || null)?.(); }catch(_){}
  }
  function mapMenuPurchaseToast(g){
    try{
      const toast = window._profSkinToast || window.__profSkinToast;
      if (toast){ toast('Compra realizada!', false); return; }
    }catch(_){}
    try{
      if (g && g.toastMsg) g.toastMsg('Compra realizada!', {
        background:'rgba(15,60,15,0.96)',
        border:'1px solid #40b040',
        color:'#a0ffb0',
        boxShadow:'0 4px 16px rgba(0,150,0,0.3)'
      });
    }catch(_){}
  }
  function sendOnlineStructureAction(g, kind, op, item){
    if (!isOnlineClient(g) || (!item && kind !== 'portal')) return false;
    try{
      if (window.__onlineCoop && window.__onlineCoop.sendAction){
        window.__onlineCoop.sendAction({ type:'structure', kind:kind, op:op, x:item ? (item.x|0) : 0, y:item ? (item.y|0) : 0 });
      }
    }catch(_){}
    return true;
  }
  function broadcastHostStructureUpgradeFx(g, kind, item){
    if (!g || !g.state || !item || !isOnlineGame(g) || g.state.onlineRole !== 'host' || !g.emitOnlineAudioEvent) return;
    try{
      const local = onlineLocalPlayer(g);
      g.emitOnlineAudioEvent('structure-upgrade', {
        kind:kind,
        x:item.x|0,
        y:item.y|0,
        sourceId:(local && local.id) || g.state.onlineClientId || g.state.onlineHostId || null
      });
    }catch(_){}
  }

  function refreshDynamiteMenu(){
    const g = G();
    if (!g || !g.state) return;
    const level = g.state.dynaLevel == null ? -1 : g.state.dynaLevel;
    const info = document.getElementById('dynamiteMenuInfo');
    if (info) info.textContent = 'Nível: ' + Math.max(1, level + 1) + '/4';
    const upgradeBtn = document.getElementById('dynamiteMenuUpgradeBtn');
    if (!upgradeBtn) return;
    const cost = g.getNextDynamiteUpgradeCost ? g.getNextDynamiteUpgradeCost() : null;
    if (cost == null){
      upgradeBtn.disabled = true;
      upgradeBtn.textContent = 'Máx.';
    } else {
      upgradeBtn.disabled = false;
      upgradeBtn.textContent = 'Aprimorar (' + cost + ' pts)';
    }
  }
  window._refreshDynamiteMenu = refreshDynamiteMenu;

  document.getElementById('dynamiteMenuUpgradeBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedDynamites || !g.requestDynamiteUpgradeFromMapMenu) return;
    const result = g.requestDynamiteUpgradeFromMapMenu();
    if (!result || !result.ok){
      if (result && result.err === 'nomoney') mapMenuErrorToast(g);
      refreshDynamiteMenu();
      return;
    }
    playShopBuySound();
    mapMenuPurchaseToast(g);
    refreshDynamiteMenu();
    try{ if (g.refreshShopVisibility) g.refreshShopVisibility(); }catch(_){}
    try{ if (window._renderShopPage) window._renderShopPage(); }catch(_){}
    try{ g.updateHUD(); }catch(_){}
  });

  document.getElementById('dynamiteMenuDestroyBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedDynamites || !g.requestDynamiteDestroyFromMapMenu) return;
    try{ if (window._selectionResume) window._selectionResume(); }catch(_){}
    const positions = (g.state.dynamites || []).map(function(d){ return { x:d.x, y:d.y }; });
    const result = g.requestDynamiteDestroyFromMapMenu();
    if (!result || !result.ok) return;
    try{
      g.beep(320,0.07,'sawtooth',0.07);
      setTimeout(function(){ g.beep(210,0.06,'sawtooth',0.06); },75);
      setTimeout(function(){ g.beep(130,0.08,'sawtooth',0.05); },170);
      positions.forEach(function(pos){
        const cx=pos.x*TILE_SZ+TILE_SZ/2, cy=pos.y*TILE_SZ+TILE_SZ/2;
        for(let i=0;i<8;i++){
          const angle=Math.random()*Math.PI*2, speed=70+Math.random()*100, life=0.28+Math.random()*0.24;
          const colors=['#7a1111','#d94a4a','#3a2a20','#888888'];
          g.state.fx.push({x:cx,y:cy,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-35,life:life,max:life,color:colors[i%colors.length],size:2+Math.random()*2.5,grav:280});
        }
      });
    }catch(_){}
    g.state.selectedDynamites = false;
    g.state._selectedMapEntitySig = null;
    const menu = document.getElementById('dynamiteMenu');
    if (menu) menu.style.display = 'none';
    finishDestroySelection(g);
    try{ g.toastMsg('Dinamites destruídas. +' + result.refund + ' pts devolvidos.'); }catch(_){}
    try{ if (g.refreshShopVisibility) g.refreshShopVisibility(); }catch(_){}
    try{ if (window._renderShopPage) window._renderShopPage(); }catch(_){}
    try{ g.updateHUD(); }catch(_){}
  });

  function closeSentryMenu(){
    const m = document.getElementById('sentryMenu');
    if (m) m.style.display = 'none';
    const g = G();
    if (g && g.state) g.state.selectedSentry = null;
    try{ if(window._selectionResume) window._selectionResume(); }catch(_){}
  }

  function refreshMenu(t){
    const g = G();
    const lvl = t.upLevel || 0;
    const maxHp = window.SENTRY_MAX_HP || 10;
    const hp  = t.hp == null ? maxHp : t.hp;
    const maxUl = window.SENTRY_MAX_UP_LEVEL != null ? window.SENTRY_MAX_UP_LEVEL : 4;
    const maxLvDisp = maxUl + 1;
    const upCost = [150,250,400,600][Math.min(lvl, 3)];
    document.getElementById('sentryMenuTitle').textContent = 'Torre Sentinela';
    document.getElementById('sentryMenuInfo').textContent =
      'Nível: ' + (lvl+1) + '/' + maxLvDisp + ' | HP: ' + hp + '/' + maxHp;
    const ub = document.getElementById('sentryUpgradeBtn');
    if (lvl >= maxUl){ ub.textContent = 'Máx.'; ub.disabled = true; }
    else { ub.textContent = 'Aprimorar (' + upCost + ' pts)'; ub.disabled = false; }
    const hb = document.getElementById('sentryHealBtn');
    if(hb){
      const missing = maxHp - hp;
      if(missing <= 0){ hb.textContent = 'Reparar (HP cheio)'; hb.disabled = true; }
      else { const hcost = Math.max(10, Math.ceil(missing * 20)); hb.textContent = 'Reparar ('+hcost+' pts)'; hb.disabled = false; }
    }
    const irb = document.getElementById('sentryIrBtn');
    const irCost = g && g.PARTNER_IR_VISION_COST != null ? g.PARTNER_IR_VISION_COST : 2180;
    if (irb){
      irb.disabled = !!t.sentryIrVision;
      irb.textContent = t.sentryIrVision ? 'Visão Infravermelho (ativa)' : 'Visão Infravermelho (' + irCost + ' pts)';
    }
    const lrb = document.getElementById('sentryLongRangeBtn');
    const longRangeCost = g && g.SENTRY_LONG_RANGE_COST != null ? g.SENTRY_LONG_RANGE_COST : 1650;
    if (lrb){
      lrb.disabled = !!t.sentryLongRange;
      lrb.textContent = t.sentryLongRange ? 'Longo Alcance (ativo)' : 'Longo Alcance (' + longRangeCost + ' pts)';
    }
  }
  window._refreshSentryMenu = refreshMenu;

  document.getElementById('sentryUpgradeBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedSentry) return;
    const t = g.state.selectedSentry;
    if (sendOnlineStructureAction(g, 'sentry', 'upgrade', t)) return;
    const lvl = t.upLevel || 0;
    const maxUl = window.SENTRY_MAX_UP_LEVEL != null ? window.SENTRY_MAX_UP_LEVEL : 4;
    if (lvl >= maxUl) return;
    const _sentryUpBase = [150, 250, 400, 600]; const cost = _sentryUpBase[Math.min(lvl, 3)];
    if (menuScore(g) < cost){ mapMenuErrorToast(g); return; }
    spendMenuScore(g, cost);
    // Reduz cooldown da torre individual em 15%
    const idx = t.i || 0;
    const base = window.SENTRY_FIRE_BASE_MS != null ? window.SENTRY_FIRE_BASE_MS : Math.round(960 * 0.7);
    const minCd = window.SENTRY_FIRE_CD_MIN_AFTER_MENU_UP != null ? window.SENTRY_FIRE_CD_MIN_AFTER_MENU_UP : Math.round(225 * 0.7);
    g.state.sentryFireMs[idx] = Math.max(minCd, Math.floor((g.state.sentryFireMs[idx] || base) * 0.85));
    t.upLevel = lvl + 1;
    playShopBuySound();
    // ─── Efeito: partículas douradas na torre ───
    try{
      const cx = t.x * TILE_SZ + TILE_SZ/2;
      const cy = t.y * TILE_SZ + TILE_SZ/2;
      for (let i = 0; i < 14; i++){
        const ang = Math.random() * Math.PI * 2;
        const spd = 55 + Math.random() * 90;
        const life = 0.28 + Math.random() * 0.22;
        g.state.fx.push({
          x:cx, y:cy,
          vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd - 35,
          life, max:life,
          color: i % 2 === 0 ? '#f3d23b' : '#fff8c0',
          size: 2 + Math.random() * 2,
          grav: 220
        });
      }
    }catch(_){}
    broadcastHostStructureUpgradeFx(g, 'sentry', t);
    mapMenuPurchaseToast(g);
    try{ window._objectiveRecordStructureOp && window._objectiveRecordStructureOp(null); }catch(_){}
    refreshMenu(t);
    try{ g.updateHUD(); }catch(_){}
  });

  document.getElementById('sentryIrBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedSentry) return;
    const t = g.state.selectedSentry;
    const cost = g.PARTNER_IR_VISION_COST != null ? g.PARTNER_IR_VISION_COST : 2180;
    if (t.sentryIrVision) return;
    if (menuScore(g) < cost){ mapMenuErrorToast(g); return; }
    if (sendOnlineStructureAction(g, 'sentry', 'sentry-ir', t)) return;
    spendMenuScore(g, cost);
    t.sentryIrVision = true;
    try{ if (g.playPartnerIrVisionPurchaseSfx) g.playPartnerIrVisionPurchaseSfx(); }catch(_){}
    try{ if (g.spawnPartnerIrVisionPurchaseFX) g.spawnPartnerIrVisionPurchaseFX(t.x, t.y); }catch(_){}
    if (isOnlineGame(g) && g.state.onlineRole === 'host' && g.emitOnlineAudioEvent){
      try{
        const local = onlineLocalPlayer(g);
        g.emitOnlineAudioEvent('sentry-ir', { x:t.x, y:t.y, sourceId:(local && local.id) || g.state.onlineClientId || g.state.onlineHostId || null });
      }catch(_){}
    }
    try{ g.toastMsg('Visão Infravermelho ativada!'); }catch(_){}
    try{ window._objectiveRecordStructureOp && window._objectiveRecordStructureOp(null); }catch(_){}
    refreshMenu(t);
    try{ g.updateHUD(); }catch(_){}
  });

  document.getElementById('sentryLongRangeBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedSentry) return;
    const t = g.state.selectedSentry;
    const cost = g.SENTRY_LONG_RANGE_COST != null ? g.SENTRY_LONG_RANGE_COST : 1650;
    if (t.sentryLongRange) return;
    if (menuScore(g) < cost){ mapMenuErrorToast(g); return; }
    if (sendOnlineStructureAction(g, 'sentry', 'sentry-long-range', t)) return;
    spendMenuScore(g, cost);
    t.sentryLongRange = true;
    try{ if (g.playSentryLongRangePurchaseSfx) g.playSentryLongRangePurchaseSfx(); }catch(_){}
    try{ if (g.spawnSentryLongRangePurchaseFX) g.spawnSentryLongRangePurchaseFX(t.x, t.y); }catch(_){}
    if (isOnlineGame(g) && g.state.onlineRole === 'host' && g.emitOnlineAudioEvent){
      try{
        const local = onlineLocalPlayer(g);
        g.emitOnlineAudioEvent('sentry-long-range', { x:t.x, y:t.y, sourceId:(local && local.id) || g.state.onlineClientId || g.state.onlineHostId || null });
      }catch(_){}
    }
    try{ g.toastMsg('Longo Alcance ativado!'); }catch(_){}
    try{ window._objectiveRecordStructureOp && window._objectiveRecordStructureOp(null); }catch(_){}
    refreshMenu(t);
    try{ g.updateHUD(); }catch(_){}
  });

  document.getElementById('sentryDestroyBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedSentry) return;
    const t = g.state.selectedSentry;
    if (sendOnlineStructureAction(g, 'sentry', 'destroy', t)){
      closeSentryMenu();
      finishDestroySelection(g);
      return;
    }
    const refund = g.getPlaceableDestroyRefund('sentry', t);
    // ─── Sons: ruído grave descendente ───
    try{
      g.beep(320, 0.07, 'sawtooth', 0.07);
      setTimeout(()=>g.beep(210, 0.06, 'sawtooth', 0.06), 75);
      setTimeout(()=>g.beep(130, 0.08, 'sawtooth', 0.05), 170);
    }catch(_){}
    // ─── Efeito: destroços voando ───
    try{
      const cx = t.x * TILE_SZ + TILE_SZ/2;
      const cy = t.y * TILE_SZ + TILE_SZ/2;
      for (let i = 0; i < 22; i++){
        const ang = Math.random() * Math.PI * 2;
        const spd = 80 + Math.random() * 130;
        const life = 0.32 + Math.random() * 0.28;
        const cols = ['#6f4e37','#2a2a2a','#c97a2b','#888'];
        g.state.fx.push({
          x:cx, y:cy,
          vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd - 45,
          life, max:life,
          color: cols[i % cols.length],
          size: 2 + Math.random() * 3,
          grav: 310
        });
      }
    }catch(_){}
    g.refundActiveShopCost(refund);
    g.state.sentries = g.state.sentries.filter(s => s !== t);
    // Reindexar e recalcular sentryFireMs
    const base = window.SENTRY_FIRE_BASE_MS != null ? window.SENTRY_FIRE_BASE_MS : Math.round(960 * 0.7);
    const minCd = window.SENTRY_FIRE_CD_MIN_AFTER_MENU_UP != null ? window.SENTRY_FIRE_CD_MIN_AFTER_MENU_UP : Math.round(225 * 0.7);
    const maxUl = window.SENTRY_MAX_UP_LEVEL != null ? window.SENTRY_MAX_UP_LEVEL : 4;
    g.state.sentryFireMs = [base, base, base, base];
    g.state.sentries.forEach((s, i) => {
      s.i = i;
      if ((s.upLevel | 0) > maxUl) s.upLevel = maxUl;
      const ul = s.upLevel || 0;
      for (let u = 0; u < ul; u++){
        g.state.sentryFireMs[i] = Math.max(minCd, Math.floor(g.state.sentryFireMs[i] * 0.85));
      }
    });
    closeSentryMenu();
    finishDestroySelection(g);
    g.toastMsg('Torre destruída. +' + refund + ' pts devolvidos.');
    try{ refreshShopVisibility(); }catch(_){}
    try{ if (window._renderShopPage) window._renderShopPage(); }catch(_){}
    try{ g.updateHUD(); }catch(_){}
  });

  document.getElementById('sentryMoveBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedSentry) return;
    const t = g.state.selectedSentry;
    // Custo: 10% do valor de compra da torre (300 * 0.1 = 30 pts)
    const _moveCost = 30;
    if (menuScore(g) < _moveCost){ mapMenuErrorToast(g); return; }
    spendMenuScore(g, _moveCost);
    g.state._sentryRefund = _moveCost;
    // Entrar no modo mover
    g.state.movingSentry = t;
    g.state.sentryHoverX = -1;
    g.state.sentryHoverY = -1;
    if (!isOnlineClient(g)) g.state.pausedManual = true;
    try{ if(window.__defendaSyncPauseButtonIcon) window.__defendaSyncPauseButtonIcon(g.state.pausedManual); }catch(_){}
    // Fechar o menu
    const m = document.getElementById('sentryMenu');
    if (m) m.style.display = 'none';
    g.state.selectedSentry = null;
    // Mostrar hint de mover
    const mh = document.getElementById('sentryMoveHint');
    if (mh) mh.style.display = 'block';
    // Som: "pegar" a torre
    try{
      g.beep(480, 0.05, 'triangle', 0.05);
      setTimeout(()=>g.beep(640, 0.06, 'triangle', 0.05), 70);
    }catch(_){}
    try{ g.updateHUD(); }catch(_){}
  });

  // ─── Gold Mine menu buttons ─────────────────────────────────
  function refreshGoldMineMenu(m){
    const g=G(); if(!g||!g.state)return;
    const lvl=m.level||1;
    const _h=[5,7,10,13,15],_iv=[3,2,2,1,1];
    const _gmUpCosts=[100,175,275,400,550]; const upCost=lvl<=4?_gmUpCosts[lvl-1]:0;
    const healAmt=_h[Math.min(5,Math.max(1,lvl))-1];
    const interval=_iv[Math.min(5,Math.max(1,lvl))-1];
    document.getElementById('goldMineMenuInfo').textContent='Nível: '+lvl+'/5 | HP: '+m.hp+'/'+m.maxHp;
    document.getElementById('goldMineMenuStats').textContent='+'+healAmt+' vida a cada '+interval+' ondas';
    const ub=document.getElementById('goldMineUpgradeBtn');
    if(lvl>=5){ub.disabled=true;ub.textContent='Máx.';}
    else{ub.disabled=false;ub.textContent='Aprimorar ('+upCost+' pts)';}
    const hb3=document.getElementById('goldMineHealBtn');
    if(hb3){
      const missing3=m.maxHp-m.hp;
      if(missing3<=0){hb3.textContent='Reparar (HP cheio)';hb3.disabled=true;}
      else{const hc3=Math.max(5,Math.ceil(missing3*6.4));hb3.textContent='Reparar ('+hc3+' pts)';hb3.disabled=false;}
    }
    const mb=document.getElementById('goldMineMoveBtn');
    if(mb) mb.disabled=false;
  }
  window._refreshGoldMineMenu = refreshGoldMineMenu;

  document.getElementById('goldMineUpgradeBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g=G(); if(!g||!g.state||!g.state.selectedGoldMine)return;
    const m=g.state.selectedGoldMine;
    if (sendOnlineStructureAction(g, 'goldmine', 'upgrade', m)) return;
    const lvl=m.level||1; if(lvl>=5)return;
    const _gmUpCosts2=[100,175,275,400,550]; const upCost=lvl<=4?_gmUpCosts2[lvl-1]:0;
    if(menuScore(g)<upCost){mapMenuErrorToast(g);return;}
    spendMenuScore(g, upCost);
    m.level=lvl+1;
    const newMaxHp=6+m.level*2; const wasAtMax=(m.hp>=m.maxHp); m.maxHp=newMaxHp; m.hp=wasAtMax?newMaxHp:Math.min(m.hp+2,newMaxHp);
    playShopBuySound();
    try{const cx=m.x*32+16,cy=m.y*32+16;for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2,s=55+Math.random()*90,l=0.28+Math.random()*0.22;g.state.fx.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-35,life:l,max:l,color:i%2===0?'#f3d23b':'#fff8c0',size:2+Math.random()*2,grav:220});}}catch(_){}
    broadcastHostStructureUpgradeFx(g, 'goldmine', m);
    mapMenuPurchaseToast(g);
    try{ window._objectiveRecordStructureOp && window._objectiveRecordStructureOp(null); }catch(_){}
    refreshGoldMineMenu(m);
    try{g.updateHUD();}catch(_){}
  });

  document.getElementById('goldMineMoveBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g=G(); if(!g||!g.state||!g.state.selectedGoldMine)return;
    const m=g.state.selectedGoldMine;
    const _moveCost=50;
    if(menuScore(g)<_moveCost){mapMenuErrorToast(g);return;}
    spendMenuScore(g, _moveCost);
    g.state._goldMineRefund=_moveCost;
    g.state.movingGoldMine=m;
    g.state.goldMineHoverX=-1; g.state.goldMineHoverY=-1;
    if (!isOnlineClient(g)) g.state.pausedManual=true;
    try{ if(window.__defendaSyncPauseButtonIcon) window.__defendaSyncPauseButtonIcon(g.state.pausedManual); }catch(_){}
    const menu=document.getElementById('goldMineMenu');
    if(menu) menu.style.display='none';
    g.state.selectedGoldMine=null;
    const mh=document.getElementById('goldMineMoveHint');
    if(mh) mh.style.display='block';
    try{g.beep(480,0.05,'triangle',0.05);setTimeout(()=>g.beep(640,0.06,'triangle',0.05),70);}catch(_){}
    try{g.updateHUD();}catch(_){}
  });

  document.getElementById('goldMineDestroyBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g=G(); if(!g||!g.state||!g.state.selectedGoldMine)return;
    try{ if(window._selectionResume) window._selectionResume(); }catch(_){}
    const m=g.state.selectedGoldMine;
    if (sendOnlineStructureAction(g, 'goldmine', 'destroy', m)){
      g.state.selectedGoldMine=null;
      const _gmRemote=document.getElementById('goldMineMenu');if(_gmRemote)_gmRemote.style.display='none';
      finishDestroySelection(g);
      return;
    }
    const refund=g.getPlaceableDestroyRefund('goldmine', m);
    // Sounds same as sentry destroy
    try{g.beep(320,0.07,'sawtooth',0.07);setTimeout(()=>g.beep(210,0.06,'sawtooth',0.06),75);setTimeout(()=>g.beep(130,0.08,'sawtooth',0.05),170);}catch(_){}
    try{const cx=m.x*32+16,cy=m.y*32+16;for(let i=0;i<22;i++){const a=Math.random()*Math.PI*2,s=80+Math.random()*130,l=0.32+Math.random()*0.28;const cols=['#6f4e37','#2a2a2a','#c97a2b','#888'];g.state.fx.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-45,life:l,max:l,color:cols[i%cols.length],size:2+Math.random()*3,grav:310});}}catch(_){}
    g.refundActiveShopCost(refund);
    g.state.goldMines=g.state.goldMines.filter(_m=>_m!==m);
    g.state.selectedGoldMine=null;
    const _gm=document.getElementById('goldMineMenu');if(_gm)_gm.style.display='none';
    finishDestroySelection(g);
    g.toastMsg('Mina destruída. +'+refund+' pts devolvidos.');
    try{refreshShopVisibility();}catch(_){}
    try{if(window._renderShopPage)window._renderShopPage();}catch(_){}
    try{g.updateHUD();}catch(_){}
  });

  // ─── Barricada menu buttons ──────────────────────────────────
  (function(){
    const TILE_SZ=32;
    function G2(){ return window._G||null; }

    const _barMaxHp=window.BARRICADA_MAX_HP_BY_LEVEL||[0,60,80,100,120,140]; // índice = nível
    const _barMaxLevel=window.BARRICADA_MAX_LEVEL||5;
    const _barUpCosts=window.BARRICADA_UPGRADE_COST_BY_LEVEL||[0,75,125,200,300];
    function barricadaUpgradeCost(lvl){
      return window.barricadaUpgradeCost ? window.barricadaUpgradeCost(lvl) : (_barUpCosts[Math.max(1, Math.min(_barMaxLevel, lvl|0))] || 75);
    }

    function refreshBarricadaMenu(bar){
      const g=G2(); if(!g||!g.state)return;
      try{ if(window._migrateBarricadaIfLegacy) window._migrateBarricadaIfLegacy(bar); }catch(_){}
      const lvl=bar.level||1;
      document.getElementById('barricadaMenuInfo').textContent='Nível: '+lvl+'/'+_barMaxLevel+' | HP: '+bar.hp+'/'+bar.maxHp;
      const ub=document.getElementById('barricadaUpgradeBtn');
      if(lvl>=_barMaxLevel){ub.disabled=true;ub.textContent='Máx.';}
      else{ub.disabled=false;ub.textContent='Aprimorar ('+barricadaUpgradeCost(lvl)+' pts)';}
      const hb2=document.getElementById('barricadaHealBtn');
      if(hb2){
        const missing2=bar.maxHp-bar.hp;
        if(missing2<=0){hb2.textContent='Reparar (HP cheio)';hb2.disabled=true;}
        else{const hc2=Math.max(5,Math.ceil(missing2*1.6));hb2.textContent='Reparar ('+hc2+' pts)';hb2.disabled=false;}
      }
      const mb=document.getElementById('barricadaMoveBtn');
      if(mb) mb.disabled=false;
    }
    window._refreshBarricadaMenu=refreshBarricadaMenu;

    document.getElementById('barricadaUpgradeBtn')?.addEventListener('click',function(e){
      e.stopPropagation();
      const g=G2(); if(!g||!g.state||!g.state.selectedBarricada)return;
      const bar=g.state.selectedBarricada;
      if (sendOnlineStructureAction(g, 'barricada', 'upgrade', bar)) return;
      const lvl=bar.level||1; if(lvl>=_barMaxLevel)return;
      const upCost=barricadaUpgradeCost(lvl);
      if(menuScore(g)<upCost){mapMenuErrorToast(g);return;}
      spendMenuScore(g, upCost);
      bar.level=lvl+1;
      bar.maxHp=_barMaxHp[bar.level];
      bar.hp=bar.maxHp; // upgrade restaura HP ao novo máximo
      playShopBuySound();
      try{const cx=bar.x*TILE_SZ+TILE_SZ/2,cy=bar.y*TILE_SZ+TILE_SZ/2;for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2,s=55+Math.random()*90,l=0.28+Math.random()*0.22;g.state.fx.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-35,life:l,max:l,color:i%2===0?'#f3d23b':'#fff8c0',size:2+Math.random()*2,grav:220});}}catch(_){}
      broadcastHostStructureUpgradeFx(g, 'barricada', bar);
      mapMenuPurchaseToast(g);
      try{ window._objectiveRecordStructureOp && window._objectiveRecordStructureOp(null); }catch(_){}
      refreshBarricadaMenu(bar);
      try{g.updateHUD();}catch(_){}
    });

    document.getElementById('barricadaMoveBtn')?.addEventListener('click',function(e){
      e.stopPropagation();
      const g=G2(); if(!g||!g.state||!g.state.selectedBarricada)return;
      const bar=g.state.selectedBarricada;
      const _moveCost=5;
      if(menuScore(g)<_moveCost){mapMenuErrorToast(g);return;}
      spendMenuScore(g, _moveCost);
      g.state._barricadaRefund=_moveCost;
      g.state.movingBarricada=bar;
      g.state.barricadaHoverX=-1; g.state.barricadaHoverY=-1;
      if (!isOnlineClient(g)) g.state.pausedManual=true;
      try{ if(window.__defendaSyncPauseButtonIcon) window.__defendaSyncPauseButtonIcon(g.state.pausedManual); }catch(_){}
      const menu=document.getElementById('barricadaMenu');
      if(menu) menu.style.display='none';
      g.state.selectedBarricada=null;
      const mh=document.getElementById('barricadaMoveHint');
      if(mh) mh.style.display='block';
      try{g.beep(480,0.05,'triangle',0.05);setTimeout(()=>g.beep(640,0.06,'triangle',0.05),70);}catch(_){}
      try{g.updateHUD();}catch(_){}
    });

    document.getElementById('barricadaDestroyBtn')?.addEventListener('click',function(e){
      e.stopPropagation();
      const g=G2(); if(!g||!g.state||!g.state.selectedBarricada)return;
      try{ if(window._selectionResume) window._selectionResume(); }catch(_){}
      const bar=g.state.selectedBarricada;
      if (sendOnlineStructureAction(g, 'barricada', 'destroy', bar)){
        g.state.selectedBarricada=null;
        const _bmRemote=document.getElementById('barricadaMenu');if(_bmRemote)_bmRemote.style.display='none';
        finishDestroySelection(g);
        return;
      }
      const refund=g.getPlaceableDestroyRefund('barricada', bar);
      // Same sounds as sentry destroy
      try{g.beep(320,0.07,'sawtooth',0.07);setTimeout(()=>g.beep(210,0.06,'sawtooth',0.06),75);setTimeout(()=>g.beep(130,0.08,'sawtooth',0.05),170);}catch(_){}
      try{const cx=bar.x*TILE_SZ+TILE_SZ/2,cy=bar.y*TILE_SZ+TILE_SZ/2;for(let i=0;i<22;i++){const a=Math.random()*Math.PI*2,s=80+Math.random()*130,l=0.32+Math.random()*0.28;const cols=['#6f4e37','#2a2a2a','#c97a2b','#888'];g.state.fx.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-45,life:l,max:l,color:cols[i%cols.length],size:2+Math.random()*3,grav:310});}}catch(_){}
      g.refundActiveShopCost(refund);
      g.state.barricadas=g.state.barricadas.filter(_b=>_b!==bar);
      g.state.selectedBarricada=null;
      const _bm=document.getElementById('barricadaMenu');if(_bm)_bm.style.display='none';
      finishDestroySelection(g);
      g.toastMsg('Barricada destruída. +'+refund+' pts devolvidos.');
      try{refreshShopVisibility();}catch(_){}
      try{if(window._renderShopPage)window._renderShopPage();}catch(_){}
      try{g.updateHUD();}catch(_){}
    });
  })();

  // _setAllyMode removido


  // ─── Reparar FX helper (verde pulsante, sons únicos) ──────────
  function _doRepairFX(g, x, y, opts){
    opts = opts || {};
    if (!opts.silent){
      try{
        // Sons: 3 bipes agudos ascendentes tipo "restaurar"
        g.beep(523,0.06,'sine',0.07);
        setTimeout(()=>g.beep(659,0.07,'sine',0.07),80);
        setTimeout(()=>g.beep(784,0.09,'sine',0.08),170);
        setTimeout(()=>g.beep(1047,0.12,'triangle',0.09),280);
      }catch(_){}
    }
    try{
      const cx=x*32+16, cy=y*32+16;
      // Cruz de luz verde subindo
      const cols=['#00ff88','#88ffcc','#ffffff','#44ff99'];
      for(let i=0;i<18;i++){
        const ang=Math.random()*Math.PI*2;
        const spd=40+Math.random()*70;
        const life=0.35+Math.random()*0.35;
        g.state.fx.push({x:cx+(Math.random()-0.5)*8,y:cy+(Math.random()-0.5)*8,
          vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-45,
          life,max:life,color:cols[i%cols.length],size:2+Math.random()*2.5,grav:60});
      }
      // Partículas de cruz (+) subindo no centro
      for(let i=0;i<8;i++){
        g.state.fx.push({x:cx+(i%2?4:-4)*(i<4?1:0),y:cy+(i%2?0:0)-(i*3),
          vx:(Math.random()-0.5)*12,vy:-(25+i*12),
          life:0.5+i*0.04,max:0.65,color:i%2?'#00ff88':'#ffffff',size:3-i*0.2,grav:-10});
      }
      // Flash verde central
      g.state.fx.push({x:cx,y:cy,vx:0,vy:0,life:0.12,max:0.12,color:'#aaffcc',size:12,grav:0,_circle:true});
    }catch(_){}
  }
  try{ window._doRepairFX = _doRepairFX; }catch(_){}

  // ─── Sentry Heal Button ────────────────────────────────────────
  document.getElementById('sentryHealBtn')?.addEventListener('click',function(e){
    e.stopPropagation();
    const g=window._G; if(!g||!g.state||!g.state.selectedSentry)return;
    const t=g.state.selectedSentry;
    if (sendOnlineStructureAction(g, 'sentry', 'repair', t)) return;
    const maxHp=window.SENTRY_MAX_HP || 10; const hp=t.hp==null?maxHp:t.hp; const missing=maxHp-hp;
    if(missing<=0)return;
    const cost=Math.max(10,Math.ceil(missing*25));
    if(menuScore(g)<cost){mapMenuErrorToast(g);return;}
    spendMenuScore(g, cost);
    t.hp=maxHp;
    _doRepairFX(g,t.x,t.y);
    try{if(window._profSkinToast)window._profSkinToast('Torre reparada!',false);}catch(_){g.toastMsg('Torre reparada!');}
    try{ window._objectiveRecordStructureOp && window._objectiveRecordStructureOp(null); }catch(_){}
    if(window._refreshSentryMenu) window._refreshSentryMenu(t);
    try{g.updateHUD();}catch(_){}
  });

  // ─── Barricada Heal Button ─────────────────────────────────────
  document.getElementById('barricadaHealBtn')?.addEventListener('click',function(e){
    e.stopPropagation();
    const g=window._G; if(!g||!g.state||!g.state.selectedBarricada)return;
    const bar=g.state.selectedBarricada;
    if (sendOnlineStructureAction(g, 'barricada', 'repair', bar)) return;
    const missing=bar.maxHp-bar.hp;
    if(missing<=0)return;
    const cost=Math.max(5,Math.ceil(missing*1.6));
    if(menuScore(g)<cost){mapMenuErrorToast(g);return;}
    spendMenuScore(g, cost);
    bar.hp=bar.maxHp;
    _doRepairFX(g,bar.x,bar.y);
    try{if(window._profSkinToast)window._profSkinToast('Barricada reparada!',false);}catch(_){g.toastMsg('Barricada reparada!');}
    try{ window._objectiveRecordStructureOp && window._objectiveRecordStructureOp(null); }catch(_){}
    if(window._refreshBarricadaMenu) window._refreshBarricadaMenu(bar);
    try{g.updateHUD();}catch(_){}
  });

  // ─── Gold Mine Heal Button ─────────────────────────────────────
  document.getElementById('goldMineHealBtn')?.addEventListener('click',function(e){
    e.stopPropagation();
    const g=window._G; if(!g||!g.state||!g.state.selectedGoldMine)return;
    const m=g.state.selectedGoldMine;
    if (sendOnlineStructureAction(g, 'goldmine', 'repair', m)) return;
    const missing=m.maxHp-m.hp;
    if(missing<=0)return;
    const cost=Math.max(5,Math.ceil(missing*6.4));
    if(menuScore(g)<cost){mapMenuErrorToast(g);return;}
    spendMenuScore(g, cost);
    m.hp=m.maxHp;
    _doRepairFX(g,m.x,m.y);
    try{if(window._profSkinToast)window._profSkinToast('Mina reparada!',false);}catch(_){g.toastMsg('Mina reparada!');}
    try{ window._objectiveRecordStructureOp && window._objectiveRecordStructureOp(null); }catch(_){}
    if(window._refreshGoldMineMenu) window._refreshGoldMineMenu(m);
    try{g.updateHUD();}catch(_){}
  });

  // Fechar ao clicar fora
  document.addEventListener('click', function(e){
    const m = document.getElementById('sentryMenu');
    if (m && m.style.display === 'block' && !m.contains(e.target)){
      closeSentryMenu();
    }
    const gm = document.getElementById('goldMineMenu');
    if (gm && gm.style.display === 'block' && !gm.contains(e.target)){
      gm.style.display='none';
      const g=window._G; if(g&&g.state) g.state.selectedGoldMine=null;
    }
    const bm = document.getElementById('barricadaMenu');
    if (bm && bm.style.display === 'block' && !bm.contains(e.target)){
      bm.style.display='none';
      const g=window._G; if(g&&g.state) g.state.selectedBarricada=null;
    }
    const pm = document.getElementById('portalMenu');
    if (pm && pm.style.display === 'block' && !pm.contains(e.target)){
      pm.style.display='none';
      const g=window._G; if(g&&g.state) g.state.selectedPortal=null;
      try{ if(window._selectionResume) window._selectionResume(); }catch(_){}
    }
    const _ppm = document.getElementById('pichaPocoMenu');
    if (_ppm && _ppm.style.display === 'block' && !_ppm.contains(e.target)){
      _ppm.style.display='none';
      const g=window._G; if(g&&g.state) g.state.selectedPichaPoco=null;
      try{ if(window._selectionResume) window._selectionResume(); }catch(_){}
    }
    const _drm = document.getElementById('reparadorMenu');
    if (_drm && _drm.style.display === 'block' && !_drm.contains(e.target)){
      _drm.style.display = 'none';
      const _gr = window._G;
      if (_gr && _gr.state) _gr.state.selectedReparador = false;
      try{ if (window._selectionResume) window._selectionResume(); }catch(_){}
    }
  });

  // ─── Poça de Piche: mover, destruir e melhoria extra ───────────
  (function(){
    const _moveCost = 5;
    const _adherenceCost = 850;
    function pichaPts(g){
      if (!g || !g.state) return 0;
      const st = g.state;
      if (isOnlineClient(g)) return menuScore(g);
      return st.coop ? (st.activeShopPlayer === 1 ? (Number(st.score1)||0) : (Number(st.score2)||0)) : (Number(st.score)||0);
    }
    function pichaSpend(g, n){
      if (!g || !g.state) return;
      if (isOnlineClient(g)) return;
      const st = g.state;
      if (st.coop){
        if (st.activeShopPlayer === 1) st.score1 = (Number(st.score1)||0) - n;
        else st.score2 = (Number(st.score2)||0) - n;
      } else st.score = (Number(st.score)||0) - n;
    }
    window._refreshPichaPocoMenu = function(){
      const g = window._G;
      const mb = document.getElementById('pichaPocoMoveBtn');
      if (!mb || !g || !g.state) return;
      mb.disabled = false;
      const pp = g.state.selectedPichaPoco;
      const ab = document.getElementById('pichaPocoAdherenceBtn');
      if (ab){
        const acquired = !!(pp && pp.pichaAdherenceMax);
        ab.disabled = acquired;
        ab.textContent = acquired ? 'Aderência Máxima (Adquirido)' : 'Aderência Máxima (' + _adherenceCost + ' pts)';
      }
    };

    document.getElementById('pichaPocoMoveBtn')?.addEventListener('click', function(e){
      e.stopPropagation();
      const g = window._G;
      if (!g || !g.state || !g.state.selectedPichaPoco) return;
      if (pichaPts(g) < _moveCost){
        mapMenuErrorToast(g);
        return;
      }
      pichaSpend(g, _moveCost);
      g.state._pichaPocoRefund = _moveCost;
      const pp = g.state.selectedPichaPoco;
      g.state.movingPichaPoco = pp;
      g.state.pichaPocoHoverX = -1;
      g.state.pichaPocoHoverY = -1;
      if (!isOnlineClient(g)) g.state.pausedManual = true;
      try{ if(window.__defendaSyncPauseButtonIcon) window.__defendaSyncPauseButtonIcon(g.state.pausedManual); }catch(_){}
      const menu = document.getElementById('pichaPocoMenu');
      if (menu) menu.style.display = 'none';
      g.state.selectedPichaPoco = null;
      const mh = document.getElementById('pichaPocoMoveHint');
      if (mh) mh.style.display = 'block';
      try{
        g.beep(480, 0.05, 'triangle', 0.05);
        setTimeout(() => g.beep(640, 0.06, 'triangle', 0.05), 70);
      }catch(_){}
      try{ g.updateHUD(); }catch(_){}
    });

    document.getElementById('pichaPocoAdherenceBtn')?.addEventListener('click', function(e){
      e.stopPropagation();
      const g = window._G;
      if (!g || !g.state || !g.state.selectedPichaPoco) return;
      const pp = g.state.selectedPichaPoco;
      if (pp.pichaAdherenceMax) return;
      const available = g.getMapMenuScore ? g.getMapMenuScore() : pichaPts(g);
      if (available < _adherenceCost){
        mapMenuErrorToast(g);
        return;
      }
      if (sendOnlineStructureAction(g, 'pichapoco', 'adherence-max', pp)) return;
      if (g.setMapMenuScore) g.setMapMenuScore(available - _adherenceCost);
      else pichaSpend(g, _adherenceCost);
      pp.pichaAdherenceMax = true;
      try{ g.playPichaAdherencePurchaseSfx(); }catch(_){}
      try{ g.spawnPichaAdherencePurchaseFX(pp.x, pp.y); }catch(_){}
      try{
        if (g.state.onlineCoop && g.state.onlineRole === 'host'){
          g.emitOnlineAudioEvent('pichapoco-adherence', { x:pp.x, y:pp.y, sourceId:pp.ownerId || null });
        }
      }catch(_){}
      mapMenuPurchaseToast(g);
      try{ window._objectiveRecordStructureOp && window._objectiveRecordStructureOp(pp.ownerId || null); }catch(_){}
      window._refreshPichaPocoMenu();
      try{ g.refreshShopVisibility(); }catch(_){}
      try{ g.updateHUD(); }catch(_){}
    });

    const btn=document.getElementById('pichaPocoDestroyBtn');
    if(!btn)return;
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      const g=window._G; if(!g||!g.state||!g.state.selectedPichaPoco)return;
      try{ if(window._selectionResume) window._selectionResume(); }catch(_){}
      const pp=g.state.selectedPichaPoco;
      if (sendOnlineStructureAction(g, 'pichapoco', 'destroy', pp)){
        g.state.selectedPichaPoco=null;
        const _ppmRemote=document.getElementById('pichaPocoMenu');if(_ppmRemote)_ppmRemote.style.display='none';
        finishDestroySelection(g);
        return;
      }
      const refund=g.getPlaceableDestroyRefund('pichapoco', pp);
      const _TSPP=32;
      // Sons iguais ao barricada/sentinela
      try{g.beep(320,0.07,'sawtooth',0.07);setTimeout(()=>g.beep(210,0.06,'sawtooth',0.06),75);setTimeout(()=>g.beep(130,0.08,'sawtooth',0.05),170);}catch(_){}
      // Partículas: piche escuro espalhando
      try{
        const cx=pp.x*_TSPP+_TSPP/2, cy=pp.y*_TSPP+_TSPP/2;
        for(let i=0;i<22;i++){
          const a=Math.random()*Math.PI*2,s=70+Math.random()*110,l=0.28+Math.random()*0.28;
          const cols=['#111111','#222222','#333333','#1a1a1a'];
          g.state.fx.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,life:l,max:l,color:cols[i%cols.length],size:2+Math.random()*3,grav:300});
        }
      }catch(_){}
      g.refundActiveShopCost(refund);
      g.state.pichaPocos=g.state.pichaPocos.filter(p=>p!==pp);
      g.state.selectedPichaPoco=null;
      const m=document.getElementById('pichaPocoMenu');if(m)m.style.display='none';
      finishDestroySelection(g);
      try{g.toastMsg('Poça destruída. +'+refund+' pts devolvidos.');}catch(_){}
      try{refreshShopVisibility();}catch(_){}
      try{if(window._renderShopPage)window._renderShopPage();}catch(_){}
      try{g.updateHUD();}catch(_){}
    });
  })();

  // ─── Portal Move + Destroy Buttons ────────────────────────────
  document.getElementById('portalMoveBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g=window._G;
    if(!g||!g.state||!g.state.portals||!g.state.portals.blue||!g.state.portals.orange)return;
    const moveCost=60;
    const available=typeof g.getMapMenuScore==='function'?g.getMapMenuScore():menuScore(g);
    if(available<moveCost){mapMenuErrorToast(g);return;}
    if(typeof g.setMapMenuScore==='function')g.setMapMenuScore(available-moveCost);
    else spendMenuScore(g,moveCost);
    try{g.beep(480,0.05,'triangle',0.05);setTimeout(()=>g.beep(640,0.06,'triangle',0.05),70);}catch(_){}
    const portals=g.state.portals;
    g.state._portalMoveOriginal=Object.assign({},portals,{
      blue:Object.assign({},portals.blue),
      orange:Object.assign({},portals.orange)
    });
    g.state._portalMoveBlue=null;
    g.state._portalRefund=moveCost;
    g.state._placingShopAction='portal-move';
    const localOnlinePlayer=g.state.onlineCoop&&Array.isArray(g.state.onlinePlayers)
      ? g.state.onlinePlayers.find(function(p){return p&&p.id===g.state.onlineClientId;})
      : null;
    g.state._placingShopPlayer=(localOnlinePlayer&&localOnlinePlayer.slot)||g.state.activeShopPlayer||1;
    g.state.placingPortalBlue=true;
    g.state.placingPortalOrange=false;
    g.state.portalHoverX=-1;
    g.state.portalHoverY=-1;
    const menu=document.getElementById('portalMenu');if(menu)menu.style.display='none';
    g.state.selectedPortal=null;
    g.state._selectedMapEntitySig=null;
    if(!isOnlineClient(g))g.state.pausedManual=true;
    try{ if(window.__defendaSyncPauseButtonIcon) window.__defendaSyncPauseButtonIcon(g.state.pausedManual); }catch(_){}
    const blueHint=document.getElementById('portalBlueHint');if(blueHint)blueHint.style.display='block';
    const orangeHint=document.getElementById('portalOrangeHint');if(orangeHint)orangeHint.style.display='none';
    try{g.updateHUD();}catch(_){}
  });

  document.getElementById('portalDestroyBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g=window._G; if(!g||!g.state||!g.state.portals) return;
    try{ if(window._selectionResume) window._selectionResume(); }catch(_){}
    if (sendOnlineStructureAction(g, 'portal', 'destroy', g.state.portals.blue || g.state.portals.orange || {x:0,y:0})){
      g.state.selectedPortal=null;
      const _pmRemote=document.getElementById('portalMenu');if(_pmRemote)_pmRemote.style.display='none';
      finishDestroySelection(g);
      return;
    }

    // FX + som de destruição nos dois portais
    const _pb=g.state.portals.blue, _po=g.state.portals.orange;
    const TILE_PD=32;
    try{
      [_pb,_po].forEach(function(p,pi){
        if(!p) return;
        const cx=p.x*TILE_PD+TILE_PD/2, cy=p.y*TILE_PD+TILE_PD/2;
        const col=pi===0?'#2060ff':'#ff8020';
        const col2=pi===0?'#60c0ff':'#ffb060';
        for(let i=0;i<24;i++){
          const a=Math.random()*Math.PI*2, s=70+Math.random()*120, l=0.30+Math.random()*0.30;
          g.state.fx.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-50,
            life:l,max:l,color:i%3===0?'#ffffff':i%3===1?col:col2,
            size:2+Math.random()*3.5,grav:280});
        }
      });
    }catch(_){}
    // Som: ruído descendente + fade
    try{
      g.beep(800,0.06,'sine',0.07);
      setTimeout(()=>g.beep(550,0.07,'sine',0.06),80);
      setTimeout(()=>g.beep(320,0.08,'sawtooth',0.06),170);
      setTimeout(()=>g.beep(160,0.10,'sawtooth',0.05),270);
    }catch(_){}

    const refund=g.getPlaceableDestroyRefund('portal', g.state.portals);
    g.refundActiveShopCost(refund);

    // Destruir portais
    g.state.portals=null;
    g.state.selectedPortal=null;
    const pm2=document.getElementById('portalMenu');
    if(pm2) pm2.style.display='none';

    finishDestroySelection(g);

    g.toastMsg('Portais destruídos. +'+refund+' pts devolvidos.');
    try{ refreshShopVisibility(); }catch(_){}
    try{ if(window._renderShopPage) window._renderShopPage(); }catch(_){}
    try{ g.updateHUD(); }catch(_){}
  });

  // ── goldMenu listeners ──
  document.getElementById('goldMenuHealBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g=window._G; if(!g||!g.state) return;
    if (typeof g.requestGoldHealFromMapMenu === 'function') return;
    const healCost=200;
    const pts=g.state.coop?(g.state.activeShopPlayer===1?g.state.score1:g.state.score2):g.state.score;
    if(pts<healCost){ mapMenuErrorToast(g); return; }
    if(g.state.gold.hp>=g.state.gold.max){ try{g.toastMsg('Ouro já está cheio!');}catch(_){} return; }
    // Descontar pontos
    if(g.state.coop){ if(g.state.activeShopPlayer===1) g.state.score1-=healCost; else g.state.score2-=healCost; }
    else g.state.score-=healCost;
    // Curar
    const before=g.state.gold.hp|0;
    g.state.gold.hp=Math.min(g.state.gold.max,(g.state.gold.hp|0)+20);
    const gained=(g.state.gold.hp|0)-before;
    if(gained>0){
      try{ if(typeof window._doRepairFX==='function') window._doRepairFX(g,g.state.gold.x,g.state.gold.y,{silent:true}); }catch(_){}
      const TILE_G=32;
      const px=g.state.gold.x*TILE_G+TILE_G/2, py=g.state.gold.y*TILE_G-10;
      try{ g.pushMultiPopup('+'+gained+' VIDA','#4fe36a',px,py); }catch(_){}
      try{ const gb=document.getElementById('goldHPBar'); if(gb){gb.classList.remove('healPulse');void gb.offsetWidth;gb.classList.add('healPulse');setTimeout(()=>{try{gb.classList.remove('healPulse');}catch(_){}},560);} }catch(_){}
    }
    // Atualizar display
    const _gInfo=document.getElementById('goldMenuInfo');
    if(_gInfo) _gInfo.textContent='HP: '+(g.state.gold.hp|0)+'/'+g.state.gold.max;
    const _ghBtn=document.getElementById('goldMenuHealBtn');
    if(_ghBtn) _ghBtn.disabled=(g.state.gold.hp>=g.state.gold.max);
    try{ g.updateHUD(); }catch(_){}
  });
  // goldMenu fecha ao clicar fora (handled by canvas click-outside)

  // ── Parceiro pistoleiro: atalho da loja + visão infravermelho ──
  function onlineOwnerName(st, ownerId){
    if (!st || !ownerId || !Array.isArray(st.onlinePlayers)) return '';
    const p = st.onlinePlayers.find(function(x){ return x && x.id === ownerId; });
    return (p && p.name) || '';
  }

  function refreshAllyOwnerLine(id, st, ally){
    const el = document.getElementById(id);
    if (!el) return;
    const name = st && st.onlineCoop ? onlineOwnerName(st, ally && ally.ownerId) : '';
    if (!name){
      el.style.display = 'none';
      el.textContent = '';
      return;
    }
    el.style.display = 'block';
    el.textContent = 'Invocado por: ' + name;
  }

  function refreshAllyResetButton(type, btnId){
    const g = G();
    const btn = document.getElementById(btnId);
    if (!btn || !g || !g.state) return;
    const cost = g.getAllyPositionResetCost ? g.getAllyPositionResetCost(type) : null;
    btn.textContent = cost == null ? 'Redefinir Posição' : ('Redefinir Posição (' + cost + ' pts)');
    const ally = type === 'reparador'
      ? (g.state.allies || []).find(function(a){ return a && a.type === 'reparador'; })
      : (g.state.selectedAlly && g.state.selectedAlly.type === type
        ? g.state.selectedAlly
        : (g.state.allies || []).find(function(a){ return a && a.type === type; }));
    btn.disabled = !ally;
  }

  function runAllyPositionReset(type, refresh){
    const g = G();
    if (!g || !g.state) return;
    const st = g.state;
    const ally = type === 'reparador'
      ? (st.allies || []).find(function(a){ return a && a.type === 'reparador'; })
      : (st.selectedAlly && st.selectedAlly.type === type ? st.selectedAlly : null);
    if (!ally) return;
    const cost = g.getAllyPositionResetCost ? g.getAllyPositionResetCost(type) : null;
    if (cost == null) return;
    if (menuScore(g) < cost){
      mapMenuErrorToast(g);
      return;
    }
    const target = g.getAllyResetTargetTile ? g.getAllyResetTargetTile(type) : null;
    const onlineClient = !!(st.onlineCoop && st.onlineRole === 'client' && g.sendOnlineMapMenuAction);
    if (onlineClient){
      if (!target) return;
      if (!g.sendOnlineMapMenuAction({ op:'ally-reset-position', allyType:type, x:target.x, y:target.y })) return;
    }
    const res = g.applyAllyPositionResetFromMapMenu ? g.applyAllyPositionResetFromMapMenu(type, target, { silentFx:onlineClient }) : { ok:false };
    if (!res || !res.ok){
      if (res && res.err === 'nomoney') mapMenuErrorToast(g);
      else try{ g.toastMsg('Aliado ainda não está em campo.'); }catch(_){}
      if (refresh) refresh();
      return;
    }
    try{ if (window._renderShopPage) window._renderShopPage(); }catch(_){}
    try{ g.toastMsg('Posição redefinida!'); }catch(_){}
    if (refresh) refresh();
    try{
      const menu = type === 'partner' ? document.getElementById('partnerMenu')
        : type === 'dog' ? document.getElementById('dogMenu')
        : type === 'xerife' ? document.getElementById('xerifeMenu')
        : type === 'dinamiteiro' ? document.getElementById('dinamiteiroMenu')
        : type === 'reparador' ? document.getElementById('reparadorMenu')
        : null;
      if (menu && window._positionMapEntitySelectionMenu) window._positionMapEntitySelectionMenu(menu);
    }catch(_){}
  }

  function refreshPartnerMenu(){
    const g = G();
    if (!g || !g.state) return;
    const st = g.state;
    refreshAllyOwnerLine('partnerMenuOwner', st, st.selectedAlly);
    const info = document.getElementById('partnerMenuInfo');
    const lvl = st.allyLevel|0;
    const ALLY_MAX = 10;
    if (info){
      const cur = Math.max(1, lvl);
      info.textContent = 'N\u00EDvel: ' + cur + '/' + ALLY_MAX;
    }
    const ub = document.getElementById('partnerMenuUpgradeBtn');
    if (ub){
      const next = g.getNextAllyUpgradeCost ? g.getNextAllyUpgradeCost() : 275;
      if (next == null){
        ub.disabled = true;
        ub.textContent = 'M\u00E1x.';
      } else {
        ub.textContent = 'Aprimorar (' + next + ' pts)';
        ub.disabled = false;
      }
    }
    refreshAllyResetButton('partner', 'partnerMenuResetBtn');
    const irb = document.getElementById('partnerMenuIrBtn');
    const irCost = (g.PARTNER_IR_VISION_COST != null ? g.PARTNER_IR_VISION_COST : 2180);
    if (irb){
      if (st.partnerIrVision){
        irb.disabled = true;
        irb.textContent = 'Visão Infravermelho (ativa)';
      } else {
        irb.textContent = 'Visão Infravermelho (' + irCost + ' pts)';
        irb.disabled = false;
      }
    }
  }
  window._refreshPartnerMenu = refreshPartnerMenu;

  function mapMenuBuyFeedback(g){
    playShopBuySound();
    try{ if (g.refreshShopVisibility) g.refreshShopVisibility(); }catch(_){}
    try{ if (window._renderShopPage) window._renderShopPage(); }catch(_){}
    try{ g.updateHUD(); }catch(_){}
  }

  function refreshSimpleAllyMenu(cfg){
    const g = G();
    if (!g || !g.state) return;
    const st = g.state;
    const ally = st.selectedAlly && st.selectedAlly.type === cfg.type
      ? st.selectedAlly
      : (st.allies || []).find(function(a){ return a && a.type === cfg.type; });
    refreshAllyOwnerLine(cfg.ownerId, st, ally);
    const lvl = Math.max(1, (st[cfg.levelKey] | 0) || (ally && ally.level) || 1);
    const info = document.getElementById(cfg.infoId);
    if (info) info.textContent = 'N\u00EDvel: ' + lvl + '/' + cfg.max;
    const ub = document.getElementById(cfg.upgradeBtnId);
    if (ub){
      const next = g[cfg.costFn] ? g[cfg.costFn]() : null;
      if (next == null){
        ub.disabled = true;
        ub.textContent = 'M\u00E1x.';
      } else {
        ub.textContent = 'Aprimorar (' + next + ' pts)';
        ub.disabled = false;
      }
    }
    if (cfg.resetBtnId) refreshAllyResetButton(cfg.type, cfg.resetBtnId);
  }

  function runSimpleAllyUpgrade(cfg){
    const g = G();
    if (!g || !g.state) return;
    const st = g.state;
    if (!st.selectedAlly || st.selectedAlly.type !== cfg.type) return;
    const res = g[cfg.applyFn] ? g[cfg.applyFn]() : { ok:false };
    if (!res || !res.ok){
      if (res && res.err === 'max') try{ g.toastMsg(cfg.maxMsg); }catch(_){}
      else if (res && res.err === 'nomoney') mapMenuErrorToast(g);
      cfg.refresh();
      return;
    }
    if (st.onlineCoop && st.onlineRole === 'client' && g.sendOnlineMapMenuAction){
      g.sendOnlineMapMenuAction(cfg.onlineOp);
    }
    mapMenuBuyFeedback(g);
    mapMenuPurchaseToast(g);
    cfg.refresh();
  }

  function refreshDogMenu(){
    refreshSimpleAllyMenu({
      type:'dog', ownerId:'dogMenuOwner', infoId:'dogMenuInfo', upgradeBtnId:'dogMenuUpgradeBtn',
      levelKey:'dogLevel', max:5, costFn:'getNextDogUpgradeCost', resetBtnId:'dogMenuResetBtn'
    });
    const g = G();
    if (!g || !g.state) return;
    const wb = document.getElementById('dogMenuWildBtn');
    if (wb){
      const cost = g.DOG_WILD_INSTINCT_COST != null ? g.DOG_WILD_INSTINCT_COST : 1650;
      if (g.state.dogWildInstinct){
        wb.disabled = true;
        wb.textContent = 'Instinto Selvagem (ativo)';
      } else {
        wb.disabled = false;
        wb.textContent = 'Instinto Selvagem (' + cost + ' pts)';
      }
    }
  }
  window._refreshDogMenu = refreshDogMenu;

  function refreshXerifeMenu(){
    refreshSimpleAllyMenu({
      type:'xerife', ownerId:'xerifeMenuOwner', infoId:'xerifeMenuInfo', upgradeBtnId:'xerifeMenuUpgradeBtn',
      levelKey:'xerifeLevel', max:5, costFn:'getNextXerifeUpgradeCost', resetBtnId:'xerifeMenuResetBtn'
    });
    const g = G();
    if (!g || !g.state) return;
    const prisonBtn = document.getElementById('xerifeMenuPrisonBtn');
    if (prisonBtn){
      const cost = g.XERIFE_PERPETUAL_PRISON_COST != null ? g.XERIFE_PERPETUAL_PRISON_COST : 5000;
      if (g.state.xerifePerpetualPrison){
        prisonBtn.disabled = true;
        prisonBtn.textContent = 'Prisão Perpétua (ativa)';
      } else {
        prisonBtn.disabled = false;
        prisonBtn.textContent = 'Prisão Perpétua (' + cost + ' pts)';
      }
    }
    const doubleBtn = document.getElementById('xerifeMenuDoubleLassoBtn');
    if (doubleBtn){
      const cost = g.XERIFE_DOUBLE_LASSO_COST != null ? g.XERIFE_DOUBLE_LASSO_COST : 5000;
      if (g.state.xerifeDoubleLasso){
        const xr = g.state.selectedAlly && g.state.selectedAlly.type === 'xerife' ? g.state.selectedAlly : null;
        doubleBtn.disabled = true;
        doubleBtn.textContent = xr && xr._justiceDoubleReady ? 'Laço Duplo: PRONTO' : 'Laço Duplo (ativo)';
      } else {
        doubleBtn.disabled = false;
        doubleBtn.textContent = 'Laço Duplo (' + cost + ' pts)';
      }
    }
  }
  window._refreshXerifeMenu = refreshXerifeMenu;

  function refreshDinamiteiroMenu(){
    refreshSimpleAllyMenu({
      type:'dinamiteiro', ownerId:'dinamiteiroMenuOwner', infoId:'dinamiteiroMenuInfo', upgradeBtnId:'dinamiteiroMenuUpgradeBtn',
      levelKey:'dinamiteiroLevel', max:3, costFn:'getNextDinamiteiroUpgradeCost', resetBtnId:'dinamiteiroMenuResetBtn'
    });
    const g = G();
    if (!g || !g.state) return;
    const fb = document.getElementById('dinamiteiroMenuShortFuseBtn');
    if (fb){
      const cost = g.DINAMITEIRO_SHORT_FUSE_COST != null ? g.DINAMITEIRO_SHORT_FUSE_COST : 3800;
      if (g.state.dinamiteiroShortFuse){
        fb.disabled = true;
        fb.textContent = 'Pavio Curto (ativo)';
      } else {
        fb.disabled = false;
        fb.textContent = 'Pavio Curto (' + cost + ' pts)';
      }
    }
    const zoneBtn = document.getElementById('dinamiteiroMenuInhabitableZoneBtn');
    if (zoneBtn){
      const cost = g.DINAMITEIRO_INHABITABLE_ZONE_COST != null ? g.DINAMITEIRO_INHABITABLE_ZONE_COST : 3800;
      if (g.state.dinamiteiroInhabitableZone){
        zoneBtn.disabled = true;
        zoneBtn.textContent = 'Zona Inabitável (ativa)';
      } else {
        zoneBtn.disabled = false;
        zoneBtn.textContent = 'Zona Inabitável (' + cost + ' pts)';
      }
    }
  }
  window._refreshDinamiteiroMenu = refreshDinamiteiroMenu;

  document.getElementById('dogMenuUpgradeBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    runSimpleAllyUpgrade({
      type:'dog', applyFn:'applyDogUpgradeFromMapMenu', onlineOp:'dog-upgrade', levelKey:'dogLevel',
      maxMsg:'Cachorro já no máximo!', refresh:refreshDogMenu
    });
  });

  document.getElementById('dogMenuResetBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    runAllyPositionReset('dog', refreshDogMenu);
  });

  document.getElementById('dogMenuWildBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedAlly || g.state.selectedAlly.type !== 'dog') return;
    const res = g.applyDogWildInstinctFromMapMenu ? g.applyDogWildInstinctFromMapMenu() : { ok:false };
    if (!res || !res.ok){
      if (res && res.err === 'owned') try{ g.toastMsg('Instinto Selvagem já está ativo.'); }catch(_){}
      else if (res && res.err === 'nomoney') mapMenuErrorToast(g);
      else try{ g.toastMsg('Compre o cachorro primeiro.'); }catch(_){}
      refreshDogMenu();
      return;
    }
    if (g.state.onlineCoop && g.state.onlineRole === 'client' && g.sendOnlineMapMenuAction){
      g.sendOnlineMapMenuAction('dog-wild');
    } else if (g.state.onlineCoop && g.state.onlineRole === 'host' && g.emitOnlineAudioEvent){
      const d = g.state.selectedAlly;
      try{ g.emitOnlineAudioEvent('dog-wild-instinct', { x:d.x, y:d.y, sourceId:g.state.onlineClientId || null }); }catch(_){}
    }
    try{ g.toastMsg('Instinto Selvagem ativado!'); }catch(_){}
    try{ if (g.refreshShopVisibility) g.refreshShopVisibility(); }catch(_){}
    try{ if (window._renderShopPage) window._renderShopPage(); }catch(_){}
    try{ g.updateHUD(); }catch(_){}
    refreshDogMenu();
  });

  document.getElementById('xerifeMenuUpgradeBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    runSimpleAllyUpgrade({
      type:'xerife', applyFn:'applyXerifeUpgradeFromMapMenu', onlineOp:'xerife-upgrade', levelKey:'xerifeLevel',
      maxMsg:'Xerife já no máximo!', refresh:refreshXerifeMenu
    });
  });

  document.getElementById('xerifeMenuResetBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    runAllyPositionReset('xerife', refreshXerifeMenu);
  });

  document.getElementById('xerifeMenuPrisonBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedAlly || g.state.selectedAlly.type !== 'xerife') return;
    const res = g.applyXerifePerpetualPrisonFromMapMenu ? g.applyXerifePerpetualPrisonFromMapMenu() : { ok:false };
    if (!res || !res.ok){
      if (res && res.err === 'owned') try{ g.toastMsg('Prisão Perpétua já está ativa.'); }catch(_){}
      else if (res && res.err === 'nomoney') mapMenuErrorToast(g);
      else try{ g.toastMsg('Compre o Xerife primeiro.'); }catch(_){}
      refreshXerifeMenu();
      return;
    }
    if (g.state.onlineCoop && g.state.onlineRole === 'client' && g.sendOnlineMapMenuAction){
      g.sendOnlineMapMenuAction('xerife-prison');
    } else if (g.state.onlineCoop && g.state.onlineRole === 'host' && g.emitOnlineAudioEvent){
      const x = g.state.selectedAlly;
      try{ g.emitOnlineAudioEvent('xerife-prison', { x:x.x, y:x.y, sourceId:g.state.onlineClientId || null }); }catch(_){}
    }
    try{ g.toastMsg('Prisão Perpétua ativada!'); }catch(_){}
    try{ if (g.refreshShopVisibility) g.refreshShopVisibility(); }catch(_){}
    try{ if (window._renderShopPage) window._renderShopPage(); }catch(_){}
    try{ g.updateHUD(); }catch(_){}
    refreshXerifeMenu();
  });

  document.getElementById('xerifeMenuDoubleLassoBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedAlly || g.state.selectedAlly.type !== 'xerife') return;
    const res = g.applyXerifeDoubleLassoFromMapMenu ? g.applyXerifeDoubleLassoFromMapMenu() : { ok:false };
    if (!res || !res.ok){
      if (res && res.err === 'owned') try{ g.toastMsg('Laço Duplo já está ativo.'); }catch(_){}
      else if (res && res.err === 'nomoney') mapMenuErrorToast(g);
      else try{ g.toastMsg('Compre o Xerife primeiro.'); }catch(_){}
      refreshXerifeMenu();
      return;
    }
    if (g.state.onlineCoop && g.state.onlineRole === 'client' && g.sendOnlineMapMenuAction){
      g.sendOnlineMapMenuAction('xerife-double-lasso');
    } else if (g.state.onlineCoop && g.state.onlineRole === 'host' && g.emitOnlineAudioEvent){
      const x = g.state.selectedAlly;
      try{ g.emitOnlineAudioEvent('xerife-double-lasso', { x:x.x, y:x.y, sourceId:g.state.onlineClientId || null }); }catch(_){}
    }
    try{ g.toastMsg('Laço Duplo ativado!'); }catch(_){}
    try{ if (g.refreshShopVisibility) g.refreshShopVisibility(); }catch(_){}
    try{ if (window._renderShopPage) window._renderShopPage(); }catch(_){}
    try{ g.updateHUD(); }catch(_){}
    refreshXerifeMenu();
  });

  document.getElementById('dinamiteiroMenuUpgradeBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    runSimpleAllyUpgrade({
      type:'dinamiteiro', applyFn:'applyDinamiteiroUpgradeFromMapMenu', onlineOp:'dinamiteiro-upgrade', levelKey:'dinamiteiroLevel',
      maxMsg:'Bombardeiro já no máximo!', refresh:refreshDinamiteiroMenu
    });
  });

  document.getElementById('dinamiteiroMenuResetBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    runAllyPositionReset('dinamiteiro', refreshDinamiteiroMenu);
  });

  document.getElementById('dinamiteiroMenuShortFuseBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedAlly || g.state.selectedAlly.type !== 'dinamiteiro') return;
    const res = g.applyDinamiteiroShortFuseFromMapMenu ? g.applyDinamiteiroShortFuseFromMapMenu() : { ok:false };
    if (!res || !res.ok){
      if (res && res.err === 'owned') try{ g.toastMsg('Pavio Curto já está ativo.'); }catch(_){}
      else if (res && res.err === 'nomoney') mapMenuErrorToast(g);
      else try{ g.toastMsg('Compre o Bombardeiro primeiro.'); }catch(_){}
      refreshDinamiteiroMenu();
      return;
    }
    if (g.state.onlineCoop && g.state.onlineRole === 'client' && g.sendOnlineMapMenuAction){
      g.sendOnlineMapMenuAction('dinamiteiro-short-fuse');
    } else if (g.state.onlineCoop && g.state.onlineRole === 'host' && g.emitOnlineAudioEvent){
      const d = g.state.selectedAlly;
      try{ g.emitOnlineAudioEvent('dinamiteiro-short-fuse', { x:d.x, y:d.y, sourceId:g.state.onlineClientId || null }); }catch(_){}
    }
    try{ g.toastMsg('Pavio Curto ativado!'); }catch(_){}
    try{ if (g.refreshShopVisibility) g.refreshShopVisibility(); }catch(_){}
    try{ if (window._renderShopPage) window._renderShopPage(); }catch(_){}
    try{ g.updateHUD(); }catch(_){}
    refreshDinamiteiroMenu();
  });

  document.getElementById('dinamiteiroMenuInhabitableZoneBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedAlly || g.state.selectedAlly.type !== 'dinamiteiro') return;
    const res = g.applyDinamiteiroInhabitableZoneFromMapMenu ? g.applyDinamiteiroInhabitableZoneFromMapMenu() : { ok:false };
    if (!res || !res.ok){
      if (res && res.err === 'owned') try{ g.toastMsg('Zona Inabitável já está ativa.'); }catch(_){}
      else if (res && res.err === 'nomoney') mapMenuErrorToast(g);
      else try{ g.toastMsg('Compre o Bombardeiro primeiro.'); }catch(_){}
      refreshDinamiteiroMenu();
      return;
    }
    if (g.state.onlineCoop && g.state.onlineRole === 'client' && g.sendOnlineMapMenuAction){
      g.sendOnlineMapMenuAction('dinamiteiro-inhabitable-zone');
    } else if (g.state.onlineCoop && g.state.onlineRole === 'host' && g.emitOnlineAudioEvent){
      const d = g.state.selectedAlly;
      try{ g.emitOnlineAudioEvent('dinamiteiro-inhabitable-zone', { x:d.x, y:d.y, sourceId:g.state.onlineClientId || null }); }catch(_){}
    }
    try{ g.toastMsg('Zona Inabitável ativada!'); }catch(_){}
    try{ if (g.refreshShopVisibility) g.refreshShopVisibility(); }catch(_){}
    try{ if (window._renderShopPage) window._renderShopPage(); }catch(_){}
    try{ g.updateHUD(); }catch(_){}
    refreshDinamiteiroMenu();
  });

  document.getElementById('partnerMenuUpgradeBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedAlly) return;
    const next = g.getNextAllyUpgradeCost ? g.getNextAllyUpgradeCost() : null;
    if (next == null){
      try{ g.toastMsg('Parceiro já está no nível máximo!'); }catch(_){}
      return;
    }
    const pts = g.getMapMenuScore ? g.getMapMenuScore() : (Number(g.state.score)||0);
    if (pts < next){
      mapMenuErrorToast(g);
      return;
    }
    if (g.setMapMenuScore) g.setMapMenuScore(pts - next);
    else g.state.score -= next;
    const r = g.applyAllyUpgradeCore ? g.applyAllyUpgradeCore() : { err: 'max' };
    if (r.err === 'max'){
      if (g.setMapMenuScore) g.setMapMenuScore((g.getMapMenuScore ? g.getMapMenuScore() : 0) + next);
      else g.state.score += next;
      try{ g.toastMsg('Parceiro já no máximo!'); }catch(_){}
      refreshPartnerMenu();
      return;
    }
    if (g.state.onlineCoop && g.state.onlineRole === 'client' && g.sendOnlineMapMenuAction){
      g.sendOnlineMapMenuAction('partner-upgrade');
    }
    playShopBuySound();
    try{ if (g.syncAllyShopCardUI) g.syncAllyShopCardUI(); }catch(_){}
    try{ g.refreshShopVisibility(); }catch(_){}
    try{ if (window._renderShopPage) window._renderShopPage(); }catch(_){}
    mapMenuPurchaseToast(g);
    refreshPartnerMenu();
    try{ g.updateHUD(); }catch(_){}
  });

  document.getElementById('partnerMenuResetBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    runAllyPositionReset('partner', refreshPartnerMenu);
  });

  document.getElementById('partnerMenuIrBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedAlly) return;
    const irCost = (g.PARTNER_IR_VISION_COST != null ? g.PARTNER_IR_VISION_COST : 2180);
    if (g.state.partnerIrVision){
      try{ g.toastMsg('Visão Infravermelho já está ativa.'); }catch(_){}
      return;
    }
    const pts = g.getMapMenuScore ? g.getMapMenuScore() : (Number(g.state.score)||0);
    if (pts < irCost){
      mapMenuErrorToast(g);
      return;
    }
    const pr = g.state.selectedAlly;
    if (g.setMapMenuScore) g.setMapMenuScore(pts - irCost);
    else g.state.score -= irCost;
    g.state.partnerIrVision = true;
    if (g.state.onlineCoop && g.state.onlineRole === 'client' && g.sendOnlineMapMenuAction){
      g.sendOnlineMapMenuAction('partner-ir');
    } else if (g.state.onlineCoop && g.state.onlineRole === 'host' && g.emitOnlineAudioEvent){
      try{ g.emitOnlineAudioEvent('partner-ir', { x:pr.x, y:pr.y, sourceId:g.state.onlineClientId || null }); }catch(_){}
    }
    try{ if (g.playPartnerIrVisionPurchaseSfx) g.playPartnerIrVisionPurchaseSfx(); }catch(_){}
    try{
      if (g.spawnPartnerIrVisionPurchaseFX && pr) g.spawnPartnerIrVisionPurchaseFX(pr.x, pr.y);
    }catch(_){}
    try{ g.toastMsg('Visão Infravermelho ativada!'); }catch(_){}
    refreshPartnerMenu();
    try{ g.updateHUD(); }catch(_){}
  });

  function refreshReparadorMenu(){
    const g = G();
    if (!g || !g.state) return;
    const st = g.state;
    const instantCost = (g.REPARADOR_INSTANT_UNLOCK_COST != null ? g.REPARADOR_INSTANT_UNLOCK_COST : 3700);
    const preventiveCost = (g.REPARADOR_PREVENTIVE_UNLOCK_COST != null ? g.REPARADOR_PREVENTIVE_UNLOCK_COST : instantCost);
    const pts = g.getMapMenuScore ? g.getMapMenuScore() : (st.coop ? (st.activeShopPlayer === 1 ? (Number(st.score1)||0) : (Number(st.score2)||0)) : (Number(st.score)||0));
    let r = null;
    for (const x of (st.allies || [])){ if (x && x.type === 'reparador'){ r = x; break; } }
    refreshAllyOwnerLine('reparadorMenuOwner', st, r);
    const lvl = st.reparadorLevel | 0;
    const info = document.getElementById('reparadorMenuInfo');
    if (info) info.textContent = 'N\u00EDvel: ' + lvl + '/5';
    const ub = document.getElementById('reparadorMenuUpgradeBtn');
    if (ub){
      const next = g.getNextReparadorUpgradeCost ? g.getNextReparadorUpgradeCost() : null;
      if (next == null){
        ub.disabled = true;
        ub.textContent = 'M\u00E1x.';
      } else {
        ub.textContent = 'Aprimorar (' + next + ' pts)';
        ub.disabled = false;
      }
    }
    refreshAllyResetButton('reparador', 'reparadorMenuResetBtn');
    const ib = document.getElementById('reparadorMenuInstantBtn');
    if (ib){
      if (!r){
        ib.disabled = true;
        ib.style.cursor = 'default';
        ib.textContent = 'Reparo Instantâneo: indisponível';
        ib.removeAttribute('title');
      } else if (!st.reparadorInstantUnlocked){
        ib.textContent = 'Reparo Instantâneo (' + instantCost + ' pts)';
        ib.disabled = false;
        ib.style.cursor = 'pointer';
        ib.removeAttribute('title');
      } else {
        ib.disabled = true;
        ib.style.cursor = 'default';
        if (r._instantRepairReady) ib.textContent = 'Reparo Instantâneo: PRONTO';
        else ib.textContent = 'Reparo Instantâneo: progresso ' + (r._repairsForInstant | 0) + '/3';
        ib.removeAttribute('title');
      }
    }
    const pb = document.getElementById('reparadorMenuPreventiveBtn');
    if (pb){
      if (!r){
        pb.disabled = true;
        pb.style.cursor = 'default';
        pb.textContent = 'Manutenção Preventiva: indisponível';
      } else if (!st.reparadorPreventiveUnlocked){
        pb.disabled = false;
        pb.style.cursor = 'pointer';
        pb.textContent = 'Manutenção Preventiva (' + preventiveCost + ' pts)';
      } else {
        pb.disabled = true;
        pb.style.cursor = 'default';
        pb.textContent = 'Manutenção Preventiva: adquirida';
      }
      pb.removeAttribute('title');
    }
  }
  window._refreshReparadorMenu = refreshReparadorMenu;

  document.getElementById('reparadorMenuUpgradeBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedReparador) return;
    const next = g.getNextReparadorUpgradeCost ? g.getNextReparadorUpgradeCost() : null;
    if (next == null){
      try{ g.toastMsg('Reparador já no nível máximo!'); }catch(_){}
      refreshReparadorMenu();
      return;
    }
    const st = g.state;
    const pts = g.getMapMenuScore ? g.getMapMenuScore() : (st.coop ? (st.activeShopPlayer === 1 ? (Number(st.score1)||0) : (Number(st.score2)||0)) : (Number(st.score)||0));
    if (pts < next){
      mapMenuErrorToast(g);
      return;
    }
    const res = g.applyReparadorUpgradeFromMapMenu ? g.applyReparadorUpgradeFromMapMenu() : { ok: false };
    if (!res || !res.ok){
      if (res && res.err === 'max') try{ g.toastMsg('Reparador já no máximo!'); }catch(_){}
      else if (res && res.err === 'nomoney') mapMenuErrorToast(g);
      refreshReparadorMenu();
      return;
    }
    if (g.state.onlineCoop && g.state.onlineRole === 'client' && g.sendOnlineMapMenuAction){
      g.sendOnlineMapMenuAction('reparador-upgrade');
    }
    playShopBuySound();
    try{ if (g.refreshShopVisibility) g.refreshShopVisibility(); }catch(_){}
    try{ if (window._renderShopPage) window._renderShopPage(); }catch(_){}
    mapMenuPurchaseToast(g);
    refreshReparadorMenu();
    try{ g.updateHUD(); }catch(_){}
  });

  document.getElementById('reparadorMenuResetBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    runAllyPositionReset('reparador', refreshReparadorMenu);
  });

  document.getElementById('reparadorMenuInstantBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedReparador) return;
    if (g.state.reparadorInstantUnlocked){
      refreshReparadorMenu();
      return;
    }
    const res = g.applyReparadorInstantUnlockFromMapMenu ? g.applyReparadorInstantUnlockFromMapMenu() : { ok: false };
    if (!res || !res.ok){
      if (res && res.err === 'nomoney') mapMenuErrorToast(g);
      else if (res && res.err === 'owned') try{ g.toastMsg('Reparo Instantâneo já foi adquirido.'); }catch(_){}
      refreshReparadorMenu();
      return;
    }
    if (g.state.onlineCoop && g.state.onlineRole === 'client' && g.sendOnlineMapMenuAction){
      g.sendOnlineMapMenuAction('reparador-instant');
    } else if (g.state.onlineCoop && g.state.onlineRole === 'host' && g.emitOnlineAudioEvent){
      try{
        const st = g.state;
        const r = (st.allies || []).find(x => x && x.type === 'reparador');
        if (r) g.emitOnlineAudioEvent('reparador-instant-unlock', { x:r.x, y:r.y, sourceId:st.onlineClientId || null });
      }catch(_){}
    }
    try{
      const st = g.state;
      const r = (st.allies || []).find(x => x && x.type === 'reparador');
      if (g.playReparadorInstantPurchaseSfx) g.playReparadorInstantPurchaseSfx();
      if (r && g.spawnReparadorInstantPurchaseFX) g.spawnReparadorInstantPurchaseFX(r.x,r.y);
    }catch(_){}
    try{ g.toastMsg('Reparo Instantâneo adquirido!'); }catch(_){}
    refreshReparadorMenu();
    try{ g.updateHUD(); }catch(_){}
  });

  document.getElementById('reparadorMenuPreventiveBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedReparador) return;
    if (g.state.reparadorPreventiveUnlocked){
      refreshReparadorMenu();
      return;
    }
    const res = g.applyReparadorPreventiveUnlockFromMapMenu ? g.applyReparadorPreventiveUnlockFromMapMenu() : { ok:false };
    if (!res || !res.ok){
      if (res && res.err === 'nomoney') mapMenuErrorToast(g);
      else if (res && res.err === 'owned') try{ g.toastMsg('Manutenção Preventiva já foi adquirida.'); }catch(_){}
      refreshReparadorMenu();
      return;
    }
    if (g.state.onlineCoop && g.state.onlineRole === 'client' && g.sendOnlineMapMenuAction){
      g.sendOnlineMapMenuAction('reparador-preventive');
    } else if (g.state.onlineCoop && g.state.onlineRole === 'host' && g.emitOnlineAudioEvent){
      try{
        const r=(g.state.allies||[]).find(x=>x&&x.type==='reparador');
        if(r) g.emitOnlineAudioEvent('reparador-preventive-unlock',{x:r.x,y:r.y,sourceId:g.state.onlineClientId||null});
      }catch(_){}
    }
    try{ if(g.playReparadorPreventivePurchaseSfx) g.playReparadorPreventivePurchaseSfx(); }catch(_){}
    try{
      const r=(g.state.allies||[]).find(x=>x&&x.type==='reparador');
      if(r&&g.spawnReparadorPreventivePurchaseFX) g.spawnReparadorPreventivePurchaseFX(r.x,r.y);
    }catch(_){}
    try{ g.toastMsg('Manutenção Preventiva adquirida!'); }catch(_){}
    refreshReparadorMenu();
    try{ g.updateHUD(); }catch(_){}
  });

})();
