(function(){
  const menu = document.getElementById('menuScreen');
  const opt = document.getElementById('optionsScreen');
  const btnOpen = document.getElementById('btnOptionsCorner') || document.getElementById('btnOptions');
  const btnBack = document.getElementById('btnOptionsBack');

  const musicSlider = document.getElementById('musicSlider');
  const sfxSlider = document.getElementById('sfxSlider');
  const musicVal = document.getElementById('musicVal');
  const sfxVal = document.getElementById('sfxVal');
  const fsCheck = document.getElementById('fullscreenCheck');

  if (!menu || !opt || !btnOpen || !btnBack) return;

  function pct(n){ return Math.round(n * 100); }
  function syncUI(){
    if (musicSlider) musicSlider.value = String(pct(settings.music));
    if (sfxSlider) sfxSlider.value = String(pct(settings.sfx));
    if (musicVal) musicVal.textContent = String(pct(settings.music));
    if (sfxVal) sfxVal.textContent = String(pct(settings.sfx));
    if (fsCheck) fsCheck.checked = !!settings.fullscreen;
    const _sc=document.getElementById('shakeCheck'); if(_sc) _sc.checked=settings.screenShake!==false;
    const _posc=document.getElementById('pauseOnSelectCheck'); if(_posc) _posc.checked=settings.pauseOnSelect!==false;
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

  function __pauseForOptions(){
    const st = __getGameState();
    if (!st || st.inMenu || !st.running) return;
    __optPrevPausedManual = !!st.pausedManual;
    st.pausedManual = true;
    const pb = document.getElementById('pauseBtn');
    if (pb) pb.textContent = 'Despausar';
  }

  function __resumeAfterOptions(){
    const st = __getGameState();
    if (!st || st.inMenu || !st.running) { __optPrevPausedManual = null; return; }
    st.pausedManual = (__optPrevPausedManual === null) ? false : __optPrevPausedManual;
    __optPrevPausedManual = null;
    const pb = document.getElementById('pauseBtn');
    if (pb) pb.textContent = st.pausedManual ? 'Despausar' : 'Pausar';
  }

  function showOptions(fromInGame){
    // Se abrir in-game, pausa primeiro
    if (fromInGame) __pauseForOptions();

    if(fromInGame){
      try{ document.body.setAttribute('data-options-open','1'); }catch(_){ }
      try{
        ['shopBtn','menuBackBtn','pauseBtn','enemiesBtn','ingameOptBtn','p1ShopBtn','p2ShopBtn'].forEach(function(id){
          var b=document.getElementById(id);
          if(b){ b.disabled=true; try{b.setAttribute('aria-disabled','true');}catch(_){ }
            try{ b.style.pointerEvents='none'; }catch(_){ }
            b.style.opacity='0.35'; b.style.filter='grayscale(1)';
          }
        });
      }catch(_){ }
    }


    opt.style.display = 'flex';
    if (fromInGame){ opt.setAttribute('data-ingame','1'); } else { opt.removeAttribute('data-ingame'); }
    opt.setAttribute('aria-hidden','false');

    // Só mantém o menu visível se estivermos no menu (não in-game)
    const st = __getGameState();
    if(!st || st.inMenu) menu.setAttribute('aria-hidden','false');

    syncUI();
    try{ if (window._refreshInputModeCoopLockUI) window._refreshInputModeCoopLockUI(); }catch(_){}
    try{ const ac = getAudio(); if (ac && ac.state === 'suspended') ac.resume(); }catch(_){}
  }

  function hideOptions(){
    opt.style.display = 'none';
    opt.setAttribute('aria-hidden','true');
    menu.setAttribute('aria-hidden','false');

    // Se estiver in-game, despausa ao fechar (voltando ao estado anterior)
    try{
      if(opt.getAttribute('data-ingame')==='1'){
        try{ document.body.removeAttribute('data-options-open'); }catch(_){ }
        try{
          if(document.body.getAttribute('data-results-open')!=='1'){
            ['shopBtn','menuBackBtn','pauseBtn','enemiesBtn','ingameOptBtn','p1ShopBtn','p2ShopBtn'].forEach(function(id){
              var b=document.getElementById(id);
              if(b){ b.disabled=false; try{b.setAttribute('aria-disabled','false');}catch(_){ }
                try{ b.style.pointerEvents=''; }catch(_){ }
                b.style.opacity=''; b.style.filter=''; b.style.cursor='';
              }
            });
            try{ if (window.syncCoopLocalShopDeathButtons) window.syncCoopLocalShopDeathButtons(); }catch(_){}
          }
        }catch(_){ }

        __resumeAfterOptions();
      }
      opt.removeAttribute('data-ingame');
    }catch(_){ }
    try{ if (window._refreshInputModeCoopLockUI) window._refreshInputModeCoopLockUI(); }catch(_){}
    saveSettings();
  }

  // Expõe helpers globais (outros scripts já tentam chamar closeOptions())
  window._selectionResume = function(){ try{ _selectionResume(); }catch(_){} };
  window.openOptions = function(fromInGame){ try{ if (document.body && document.body.getAttribute('data-results-open')==='1') return; }catch(_){ } showOptions(!!fromInGame); };
  window.closeOptions = function(){
    const ingame = (opt.getAttribute('data-ingame')==='1');
    hideOptions();
    if (ingame) __resumeAfterOptions(); // redundância segura
  };

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

  btnOpen.addEventListener('click', function(){
    showOptions(false);
  });
  btnBack.addEventListener('click', function(){
    const ingame = (opt.getAttribute('data-ingame')==='1');
    hideOptions();
    if (ingame) return; // in-game não volta pro menu
    showMenu();
  });

  // sliders
  if (musicSlider){
    musicSlider.addEventListener('input', function(){
      const v = Math.min(100, Math.max(0, parseInt(musicSlider.value, 10) || 0));
      settings.music = v / 100;
      if (musicVal) musicVal.textContent = String(v);
      refreshMusicGain();
      saveSettings();
    });
  }
  if (sfxSlider){
    sfxSlider.addEventListener('input', function(){
      const v = Math.min(100, Math.max(0, parseInt(sfxSlider.value, 10) || 0));
      settings.sfx = v / 100;
      if (sfxVal) sfxVal.textContent = String(v);
      saveSettings();
      // feedback discreto
      try{ beep(520, 0.04, 'square', 0.02); }catch(_){}
    });
  }

  // fullscreen
  async function setFullscreen(on){
    const de = document.documentElement;
    try{
      if (on){
        if (!document.fullscreenElement && de.requestFullscreen) await de.requestFullscreen();
      }else{
        if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
      }
    }catch(_){}
  }

  if (fsCheck){
    fsCheck.addEventListener('change', function(){
      settings.fullscreen = !!fsCheck.checked;
      saveSettings();
      setFullscreen(settings.fullscreen);
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
  // Tipo de Jogabilidade
  function _setInputMode(mode){
    if (!window.__inputModeSetBypassCoopGuard){
      try{
        const api = window.__defendaApi;
        const st = (api && typeof api.getState === 'function') ? api.getState() : null;
        if (st && st.coop && st.running && !st.inMenu) return;
      }catch(_){}
    }
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
    btnM.style.cssText='flex:1;padding:7px 0;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:2px solid '+(isMouse?'#c97a2b':'#3a2208')+';background:'+(isMouse?'#2a1500':'#1a0d02')+';color:'+(isMouse?'#f0e6d2':'#8a6a33')+';';
    btnK.style.cssText='flex:1;padding:7px 0;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:2px solid '+(!isMouse?'#c97a2b':'#3a2208')+';background:'+(!isMouse?'#2a1500':'#1a0d02')+';color:'+(!isMouse?'#f0e6d2':'#8a6a33')+';';
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
    var locked = !!(st && st.coop && st.running && !st.inMenu);
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
      btnM.style.cursor = '';
      btnK.style.cursor = '';
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

// === Menu de torre: botões Aprimorar e Destruir ===
(function(){
  const TILE_SZ = 32; // tamanho do tile em px

  function G(){ return window._G || null; }

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
    const hp  = t.hp == null ? 4 : t.hp;
    const score = g ? g.state.score : 0;
    const upCost = [150,250,400,600,800][Math.min(lvl,4)];
    document.getElementById('sentryMenuTitle').textContent =
      'Torre Sentinela' + (lvl > 0 ? ' (Nv.' + (lvl+1) + ')' : '');
    document.getElementById('sentryMenuInfo').textContent =
      'Nível ' + (lvl+1) + '/6  |  HP: ' + hp + '/4';
    const ub = document.getElementById('sentryUpgradeBtn');
    if (lvl >= 5){ ub.textContent = 'Aprim. Máx.'; ub.disabled = true; }
    else { ub.textContent = 'Aprimorar (' + upCost + ' pts)'; ub.disabled = score < upCost; }
    const hb = document.getElementById('sentryHealBtn');
    if(hb){
      const maxHp = 4; const missing = maxHp - hp;
      if(missing <= 0){ hb.textContent = 'Reparar (HP cheio)'; hb.disabled = true; }
      else { const hcost = Math.max(10, Math.ceil(missing * 20)); hb.textContent = 'Reparar ('+hcost+' pts)'; hb.disabled = score < hcost; }
    }
  }
  window._refreshSentryMenu = refreshMenu;

  document.getElementById('sentryUpgradeBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedSentry) return;
    const t = g.state.selectedSentry;
    const lvl = t.upLevel || 0;
    if (lvl >= 5) return;
    const _sentryUpBase = [150, 250, 400, 600, 800]; const cost = _sentryUpBase[Math.min(lvl, 4)];
    if (g.state.score < cost){ g.toastMsg('Pontos insuficientes!'); return; }
    g.state.score -= cost;
    // Reduz cooldown da torre individual em 15%
    const idx = t.i || 0;
    g.state.sentryFireMs[idx] = Math.max(225, Math.floor((g.state.sentryFireMs[idx] || 960) * 0.85));
    t.upLevel = lvl + 1;
    // ─── Sons: 3 bipes metálicos ascendentes ───
    try{
      g.beep(440, 0.05, 'square', 0.05);
      setTimeout(()=>g.beep(660, 0.06, 'square', 0.05), 65);
      setTimeout(()=>g.beep(880, 0.08, 'triangle', 0.06), 140);
    }catch(_){}
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
    g.toastMsg('Torre aprimorada! (Nv.' + (t.upLevel + 1) + ')');
    refreshMenu(t);
    try{ g.updateHUD(); }catch(_){}
  });

  document.getElementById('sentryDestroyBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedSentry) return;
    const t = g.state.selectedSentry;
    const hp = t.hp == null ? 4 : t.hp;
    const refund = Math.round(300 * (hp / 4));
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
    g.state.score += refund;
    g.state.sentries = g.state.sentries.filter(s => s !== t);
    // Reindexar e recalcular sentryFireMs
    g.state.sentryFireMs = [960, 960, 960, 960];
    g.state.sentries.forEach((s, i) => {
      s.i = i;
      const ul = s.upLevel || 0;
      for (let u = 0; u < ul; u++){
        g.state.sentryFireMs[i] = Math.max(225, Math.floor(g.state.sentryFireMs[i] * 0.85));
      }
    });
    closeSentryMenu();
    try{ if(g.state){ g.state.pausedManual=false; g.state._selectionPaused=false; var _pb_=document.getElementById('pauseBtn'); if(_pb_)_pb_.textContent='Pausar'; } }catch(_){}
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
    if (g.state.score < _moveCost){ g.toastMsg('Pontos insuficientes para mover! (30 pts)'); return; }
    g.state.score -= _moveCost;
    // Entrar no modo mover
    g.state.movingSentry = t;
    g.state.sentryHoverX = -1;
    g.state.sentryHoverY = -1;
    g.state.pausedManual = true;
    try{ document.getElementById('pauseBtn').textContent = 'Despausar'; }catch(_){}
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
  });

  // ─── Gold Mine menu buttons ─────────────────────────────────
  function refreshGoldMineMenu(m){
    const g=G(); if(!g||!g.state)return;
    const lvl=m.level||1;
    const _h=[5,7,10,13,15],_iv=[3,2,2,1,1];
    const _gmUpCosts=[100,175,275,400,550]; const upCost=lvl<=4?_gmUpCosts[lvl-1]:0;
    const healAmt=_h[Math.min(5,Math.max(1,lvl))-1];
    const interval=_iv[Math.min(5,Math.max(1,lvl))-1];
    document.getElementById('goldMineMenuInfo').textContent='Nível '+lvl+'/5 — HP: '+m.hp+'/'+m.maxHp;
    document.getElementById('goldMineMenuStats').textContent='+'+healAmt+' vida a cada '+interval+' ondas';
    const ub=document.getElementById('goldMineUpgradeBtn');
    if(lvl>=5){ub.disabled=true;ub.textContent='Máx.';}
    else{ub.disabled=(g.state.score<upCost);ub.textContent='Aprimorar ('+upCost+' pts)';}
    const hb3=document.getElementById('goldMineHealBtn');
    if(hb3){
      const missing3=m.maxHp-m.hp;
      if(missing3<=0){hb3.textContent='Reparar (HP cheio)';hb3.disabled=true;}
      else{const hc3=Math.max(5,Math.ceil(missing3*6.4));hb3.textContent='Reparar ('+hc3+' pts)';hb3.disabled=(g.state.score<hc3);}
    }
    const mb=document.getElementById('goldMineMoveBtn');
    if(mb) mb.disabled=(g.state.score<50);
  }
  window._refreshGoldMineMenu = refreshGoldMineMenu;

  document.getElementById('goldMineUpgradeBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g=G(); if(!g||!g.state||!g.state.selectedGoldMine)return;
    const m=g.state.selectedGoldMine;
    const lvl=m.level||1; if(lvl>=5)return;
    const _h2=[5,7,10,13,15],_iv2=[3,2,2,1,1];
    const _gmUpCosts2=[100,175,275,400,550]; const upCost=lvl<=4?_gmUpCosts2[lvl-1]:0;
    if(g.state.score<upCost){g.toastMsg('Pontos insuficientes!');return;}
    g.state.score-=upCost;
    m.level=lvl+1;
    const newMaxHp=6+m.level*2; const wasAtMax=(m.hp>=m.maxHp); m.maxHp=newMaxHp; m.hp=wasAtMax?newMaxHp:Math.min(m.hp+2,newMaxHp);
    try{g.beep(440,0.05,'square',0.05);setTimeout(()=>g.beep(660,0.06,'square',0.05),65);setTimeout(()=>g.beep(880,0.08,'triangle',0.06),140);}catch(_){}
    try{const cx=m.x*32+16,cy=m.y*32+16;for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2,s=55+Math.random()*90,l=0.28+Math.random()*0.22;g.state.fx.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-35,life:l,max:l,color:i%2===0?'#f3d23b':'#fff8c0',size:2+Math.random()*2,grav:220});}}catch(_){}
    const newHeal=_h2[Math.min(5,Math.max(1,m.level))-1];
    const newInt=_iv2[Math.min(5,Math.max(1,m.level))-1];
    g.toastMsg('Mina aprimorada! Nv.'+m.level+' (+'+newHeal+' a cada '+newInt+' ondas)');
    refreshGoldMineMenu(m);
    try{g.updateHUD();}catch(_){}
  });

  document.getElementById('goldMineMoveBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g=G(); if(!g||!g.state||!g.state.selectedGoldMine)return;
    const m=g.state.selectedGoldMine;
    const _moveCost=50;
    if(g.state.score<_moveCost){g.toastMsg('Pontos insuficientes para mover! (50 pts)');return;}
    g.state.score-=_moveCost;
    g.state.movingGoldMine=m;
    g.state.goldMineHoverX=-1; g.state.goldMineHoverY=-1;
    g.state.pausedManual=true;
    try{document.getElementById('pauseBtn').textContent='Despausar';}catch(_){}
    const menu=document.getElementById('goldMineMenu');
    if(menu) menu.style.display='none';
    g.state.selectedGoldMine=null;
    const mh=document.getElementById('goldMineMoveHint');
    if(mh) mh.style.display='block';
    try{g.beep(480,0.05,'triangle',0.05);setTimeout(()=>g.beep(640,0.06,'triangle',0.05),70);}catch(_){}
  });

  document.getElementById('goldMineDestroyBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g=G(); if(!g||!g.state||!g.state.selectedGoldMine)return;
    try{ if(window._selectionResume) window._selectionResume(); }catch(_){}
    const m=g.state.selectedGoldMine;
    const refund=Math.round(500*(m.hp/m.maxHp));
    // Sounds same as sentry destroy
    try{g.beep(320,0.07,'sawtooth',0.07);setTimeout(()=>g.beep(210,0.06,'sawtooth',0.06),75);setTimeout(()=>g.beep(130,0.08,'sawtooth',0.05),170);}catch(_){}
    try{const cx=m.x*32+16,cy=m.y*32+16;for(let i=0;i<22;i++){const a=Math.random()*Math.PI*2,s=80+Math.random()*130,l=0.32+Math.random()*0.28;const cols=['#6f4e37','#2a2a2a','#c97a2b','#888'];g.state.fx.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-45,life:l,max:l,color:cols[i%cols.length],size:2+Math.random()*3,grav:310});}}catch(_){}
    g.state.score+=refund;
    g.state.goldMines=g.state.goldMines.filter(_m=>_m!==m);
    g.state.selectedGoldMine=null;
    const _gm=document.getElementById('goldMineMenu');if(_gm)_gm.style.display='none';
    try{ if(g.state){ g.state.pausedManual=false; g.state._selectionPaused=false; var _pb_=document.getElementById('pauseBtn'); if(_pb_)_pb_.textContent='Pausar'; } }catch(_){}
    g.toastMsg('Mina destruída. +'+refund+' pts devolvidos.');
    try{refreshShopVisibility();}catch(_){}
    try{if(window._renderShopPage)window._renderShopPage();}catch(_){}
    try{g.updateHUD();}catch(_){}
  });

  // ─── Espantalho menu buttons ─────────────────────────────────
  (function(){
    const TS=32;
    function GE(){return window._G||null;}
    function espStats(lvl){const h=[50,75,100],rg=[2,3,4],l=Math.min(3,Math.max(1,lvl||1))-1;return{maxHp:h[l],range:rg[l]};}
    function closeEM(){
      const m=document.getElementById('espantalhoMenu');if(m)m.style.display='none';
      const g=GE();if(g&&g.state)g.state.selectedEspantalho=null;
      try{if(window._selectionResume)window._selectionResume();}catch(_){}
    }
    function refreshEM(esp){
      const g=GE();if(!g||!g.state)return;
      const lvl=esp.level||1,st=espStats(lvl);
      const score=g.state.score;
      const upCosts=[150,220];
      document.getElementById('espantalhoMenuTitle').textContent='Espantalho'+(lvl>1?' (Nv.'+lvl+')':'');
      document.getElementById('espantalhoMenuInfo').textContent='Nível '+lvl+'/3  |  HP: '+esp.hp+'/'+st.maxHp;
      const ub=document.getElementById('espantalhoUpgradeBtn');
      if(lvl>=3){ub.textContent='Aprim. Máx.';ub.disabled=true;}
      else{const uc=upCosts[lvl-1];ub.textContent='Aprimorar ('+uc+' pts)';ub.disabled=(score<uc);}
      const hb=document.getElementById('espantalhoHealBtn');
      const miss=st.maxHp-esp.hp;
      if(miss<=0){hb.textContent='Reparar (HP cheio)';hb.disabled=true;}
      else{const hc=Math.max(10,Math.ceil(miss*2));hb.textContent='Reparar ('+hc+' pts)';hb.disabled=(score<hc);}
      document.getElementById('espantalhoMoveBtn').disabled=(score<10);
    }
    window._refreshEspantalhoMenu=refreshEM;
    // Aprimorar — sons idênticos à torreta
    document.getElementById('espantalhoUpgradeBtn')?.addEventListener('click',function(e){
      e.stopPropagation();
      const g=GE();if(!g||!g.state||!g.state.selectedEspantalho)return;
      const esp=g.state.selectedEspantalho,lvl=esp.level||1;if(lvl>=3)return;
      const upCosts=[150,220];const cost=upCosts[lvl-1];
      if(g.state.score<cost){g.toastMsg('Pontos insuficientes!');return;}
      g.state.score-=cost;esp.level=lvl+1;
      const ns=espStats(esp.level);const atMax=(esp.hp>=esp.maxHp);esp.maxHp=ns.maxHp;if(atMax)esp.hp=ns.maxHp;
      try{g.beep(440,0.05,'square',0.05);setTimeout(()=>g.beep(660,0.06,'square',0.05),65);setTimeout(()=>g.beep(880,0.08,'triangle',0.06),140);}catch(_){}
      try{const cx=esp.x*TS+TS/2,cy=esp.y*TS+TS/2;for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2,s=55+Math.random()*90,l=0.28+Math.random()*0.22;g.state.fx.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-35,life:l,max:l,color:i%2?'#f3d23b':'#fff8c0',size:2+Math.random()*2,grav:220});}}catch(_){}
      g.toastMsg('Espantalho aprimorado! (Nv.'+esp.level+')');
      refreshEM(esp);try{g.updateHUD();}catch(_){}
    });
    // Reparar — sons idênticos à torreta
    document.getElementById('espantalhoHealBtn')?.addEventListener('click',function(e){
      e.stopPropagation();
      const g=GE();if(!g||!g.state||!g.state.selectedEspantalho)return;
      const esp=g.state.selectedEspantalho;const st=espStats(esp.level||1);
      const miss=st.maxHp-esp.hp;if(miss<=0)return;
      const hc=Math.max(10,Math.ceil(miss*2));
      if(g.state.score<hc){g.toastMsg('Pontos insuficientes!');return;}
      g.state.score-=hc;esp.hp=st.maxHp;
      try{g.beep(880,0.05,'triangle',0.06);setTimeout(()=>g.beep(660,0.06,'square',0.05),70);setTimeout(()=>g.beep(440,0.07,'square',0.06),150);}catch(_){}
      try{const cx=esp.x*TS+TS/2,cy=esp.y*TS+TS/2;for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2,s=50+Math.random()*80,l=0.3+Math.random()*0.25;g.state.fx.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-30,life:l,max:l,color:i%2?'#2ecc71':'#a0ffa0',size:2+Math.random()*2,grav:200});}}catch(_){}
      g.toastMsg('Espantalho reparado!');
      refreshEM(esp);try{g.updateHUD();}catch(_){}
    });
    // Mover — sons e fluxo idênticos à torreta
    document.getElementById('espantalhoMoveBtn')?.addEventListener('click',function(e){
      e.stopPropagation();
      const g=GE();if(!g||!g.state||!g.state.selectedEspantalho)return;
      if(g.state.score<10){g.toastMsg('Pontos insuficientes! (10 pts)');return;}
      g.state.score-=10;
      const esp=g.state.selectedEspantalho;
      g.state.movingEspantalho=esp;g.state.placingEspantalho=true;
      g.state.espantalhoHoverX=-1;g.state.espantalhoHoverY=-1;g.state.pausedManual=true;
      try{document.getElementById('pauseBtn').textContent='Despausar';}catch(_){}
      document.getElementById('espantalhoMenu').style.display='none';g.state.selectedEspantalho=null;
      const mh=document.getElementById('espantalhoMoveHint');if(mh)mh.style.display='block';
      try{g.beep(480,0.05,'triangle',0.05);setTimeout(()=>g.beep(640,0.06,'triangle',0.05),70);}catch(_){}
    });
    // Destruir — sons e partículas idênticos à torreta
    document.getElementById('espantalhoDestroyBtn')?.addEventListener('click',function(e){
      e.stopPropagation();
      const g=GE();if(!g||!g.state||!g.state.selectedEspantalho)return;
      const esp=g.state.selectedEspantalho;
      const refund=Math.round(150*(esp.hp/esp.maxHp));
      try{g.beep(320,0.07,'sawtooth',0.07);setTimeout(()=>g.beep(210,0.06,'sawtooth',0.06),75);setTimeout(()=>g.beep(130,0.08,'sawtooth',0.05),170);}catch(_){}
      try{const cx=esp.x*TS+TS/2,cy=esp.y*TS+TS/2;const cols=['#8b5a2b','#2a2a2a','#c97a2b','#888'];for(let i=0;i<22;i++){const a=Math.random()*Math.PI*2,s=80+Math.random()*130,l=0.32+Math.random()*0.28;g.state.fx.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-45,life:l,max:l,color:cols[i%4],size:2+Math.random()*3,grav:310});}}catch(_){}
      g.state.score+=refund;g.state.espantalhos=g.state.espantalhos.filter(_e=>_e!==esp);
      closeEM();
      try{if(g.state){g.state.pausedManual=false;g.state._selectionPaused=false;const _pb=document.getElementById('pauseBtn');if(_pb)_pb.textContent='Pausar';}}catch(_){}
      g.toastMsg('Espantalho destruído. +'+refund+' pts devolvidos.');
      try{refreshShopVisibility();}catch(_){}try{if(window._renderShopPage)window._renderShopPage();}catch(_){}
      try{g.updateHUD();}catch(_){}
    });
  })();

  // ─── Barricada menu buttons ──────────────────────────────────
  (function(){
    const TILE_SZ=32;
    function G2(){ return window._G||null; }

    const _barMaxHp=[0,30,40,50,60]; // índice = nível
    const _barUpCost=75; // fixo

    function refreshBarricadaMenu(bar){
      const g=G2(); if(!g||!g.state)return;
      const lvl=bar.level||1;
      document.getElementById('barricadaMenuInfo').textContent='Nível '+lvl+'/4 — HP: '+bar.hp+'/'+bar.maxHp;
      const ub=document.getElementById('barricadaUpgradeBtn');
      if(lvl>=4){ub.disabled=true;ub.textContent='Aprim. Máx.';}
      else{ub.disabled=(g.state.score<_barUpCost);ub.textContent='Aprimorar ('+_barUpCost+' pts)';}
      const hb2=document.getElementById('barricadaHealBtn');
      if(hb2){
        const missing2=bar.maxHp-bar.hp;
        if(missing2<=0){hb2.textContent='Reparar (HP cheio)';hb2.disabled=true;}
        else{const hc2=Math.max(5,Math.ceil(missing2*1.6));hb2.textContent='Reparar ('+hc2+' pts)';hb2.disabled=(g.state.score<hc2);}
      }
      const mb=document.getElementById('barricadaMoveBtn');
      if(mb) mb.disabled=(g.state.score<5);
    }
    window._refreshBarricadaMenu=refreshBarricadaMenu;

    document.getElementById('barricadaUpgradeBtn')?.addEventListener('click',function(e){
      e.stopPropagation();
      const g=G2(); if(!g||!g.state||!g.state.selectedBarricada)return;
      const bar=g.state.selectedBarricada;
      const lvl=bar.level||1; if(lvl>=4)return;
      if(g.state.score<_barUpCost){g.toastMsg('Pontos insuficientes!');return;}
      g.state.score-=_barUpCost;
      bar.level=lvl+1;
      bar.maxHp=_barMaxHp[bar.level];
      bar.hp=bar.maxHp; // upgrade restaura HP ao novo máximo
      // Same sounds as sentry upgrade
      try{g.beep(440,0.05,'square',0.05);setTimeout(()=>g.beep(660,0.06,'square',0.05),65);setTimeout(()=>g.beep(880,0.08,'triangle',0.06),140);}catch(_){}
      try{const cx=bar.x*TILE_SZ+TILE_SZ/2,cy=bar.y*TILE_SZ+TILE_SZ/2;for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2,s=55+Math.random()*90,l=0.28+Math.random()*0.22;g.state.fx.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-35,life:l,max:l,color:i%2===0?'#f3d23b':'#fff8c0',size:2+Math.random()*2,grav:220});}}catch(_){}
      if(window._profSkinToast)window._profSkinToast('Barricada Nv.'+bar.level+'!',false); else g.toastMsg('Barricada aprimorada! (Nv.'+bar.level+')');
      refreshBarricadaMenu(bar);
      try{g.updateHUD();}catch(_){}
    });

    document.getElementById('barricadaMoveBtn')?.addEventListener('click',function(e){
      e.stopPropagation();
      const g=G2(); if(!g||!g.state||!g.state.selectedBarricada)return;
      const bar=g.state.selectedBarricada;
      const _moveCost=5;
      if(g.state.score<_moveCost){g.toastMsg('Pontos insuficientes para mover! (5 pts)');return;}
      g.state.score-=_moveCost;
      g.state.movingBarricada=bar;
      g.state.barricadaHoverX=-1; g.state.barricadaHoverY=-1;
      g.state.pausedManual=true;
      try{document.getElementById('pauseBtn').textContent='Despausar';}catch(_){}
      const menu=document.getElementById('barricadaMenu');
      if(menu) menu.style.display='none';
      g.state.selectedBarricada=null;
      const mh=document.getElementById('barricadaMoveHint');
      if(mh) mh.style.display='block';
      try{g.beep(480,0.05,'triangle',0.05);setTimeout(()=>g.beep(640,0.06,'triangle',0.05),70);}catch(_){}
    });

    document.getElementById('barricadaDestroyBtn')?.addEventListener('click',function(e){
      e.stopPropagation();
      const g=G2(); if(!g||!g.state||!g.state.selectedBarricada)return;
      try{ if(window._selectionResume) window._selectionResume(); }catch(_){}
      const bar=g.state.selectedBarricada;
      const refund=Math.round(50*(bar.hp/bar.maxHp));
      // Same sounds as sentry destroy
      try{g.beep(320,0.07,'sawtooth',0.07);setTimeout(()=>g.beep(210,0.06,'sawtooth',0.06),75);setTimeout(()=>g.beep(130,0.08,'sawtooth',0.05),170);}catch(_){}
      try{const cx=bar.x*TILE_SZ+TILE_SZ/2,cy=bar.y*TILE_SZ+TILE_SZ/2;for(let i=0;i<22;i++){const a=Math.random()*Math.PI*2,s=80+Math.random()*130,l=0.32+Math.random()*0.28;const cols=['#6f4e37','#2a2a2a','#c97a2b','#888'];g.state.fx.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-45,life:l,max:l,color:cols[i%cols.length],size:2+Math.random()*3,grav:310});}}catch(_){}
      g.state.score+=refund;
      g.state.barricadas=g.state.barricadas.filter(_b=>_b!==bar);
      g.state.selectedBarricada=null;
      const _bm=document.getElementById('barricadaMenu');if(_bm)_bm.style.display='none';
      try{ if(g.state){ g.state.pausedManual=false; g.state._selectionPaused=false; var _pb_=document.getElementById('pauseBtn'); if(_pb_)_pb_.textContent='Pausar'; } }catch(_){}
      g.toastMsg('Barricada destruída. +'+refund+' pts devolvidos.');
      try{refreshShopVisibility();}catch(_){}
      try{if(window._renderShopPage)window._renderShopPage();}catch(_){}
      try{g.updateHUD();}catch(_){}
    });
  })();

  // _setAllyMode removido


  // ─── Reparar FX helper (verde pulsante, sons únicos) ──────────
  function _doRepairFX(g, x, y){
    try{
      // Sons: 3 bipes agudos ascendentes tipo "restaurar"
      g.beep(523,0.06,'sine',0.07);
      setTimeout(()=>g.beep(659,0.07,'sine',0.07),80);
      setTimeout(()=>g.beep(784,0.09,'sine',0.08),170);
      setTimeout(()=>g.beep(1047,0.12,'triangle',0.09),280);
    }catch(_){}
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
    const maxHp=4; const hp=t.hp==null?4:t.hp; const missing=maxHp-hp;
    if(missing<=0)return;
    const cost=Math.max(10,Math.ceil(missing*25));
    if(g.state.score<cost){g.toastMsg('Pontos insuficientes!');return;}
    g.state.score-=cost;
    t.hp=maxHp;
    _doRepairFX(g,t.x,t.y);
    try{if(window._profSkinToast)window._profSkinToast('Torre reparada!',false);}catch(_){g.toastMsg('Torre reparada!');}
    if(window._refreshSentryMenu) window._refreshSentryMenu(t);
    try{g.updateHUD();}catch(_){}
  });

  // ─── Barricada Heal Button ─────────────────────────────────────
  document.getElementById('barricadaHealBtn')?.addEventListener('click',function(e){
    e.stopPropagation();
    const g=window._G; if(!g||!g.state||!g.state.selectedBarricada)return;
    const bar=g.state.selectedBarricada;
    const missing=bar.maxHp-bar.hp;
    if(missing<=0)return;
    const cost=Math.max(5,Math.ceil(missing*1.6));
    if(g.state.score<cost){g.toastMsg('Pontos insuficientes!');return;}
    g.state.score-=cost;
    bar.hp=bar.maxHp;
    _doRepairFX(g,bar.x,bar.y);
    try{if(window._profSkinToast)window._profSkinToast('Barricada reparada!',false);}catch(_){g.toastMsg('Barricada reparada!');}
    if(window._refreshBarricadaMenu) window._refreshBarricadaMenu(bar);
    try{g.updateHUD();}catch(_){}
  });

  // ─── Gold Mine Heal Button ─────────────────────────────────────
  document.getElementById('goldMineHealBtn')?.addEventListener('click',function(e){
    e.stopPropagation();
    const g=window._G; if(!g||!g.state||!g.state.selectedGoldMine)return;
    const m=g.state.selectedGoldMine;
    const missing=m.maxHp-m.hp;
    if(missing<=0)return;
    const cost=Math.max(5,Math.ceil(missing*6.4));
    if(g.state.score<cost){g.toastMsg('Pontos insuficientes!');return;}
    g.state.score-=cost;
    m.hp=m.maxHp;
    _doRepairFX(g,m.x,m.y);
    try{if(window._profSkinToast)window._profSkinToast('Mina reparada!',false);}catch(_){g.toastMsg('Mina reparada!');}
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
    const _emC=document.getElementById('espantalhoMenu');
    if(_emC&&_emC.style.display==='block'&&!_emC.contains(e.target)){
      _emC.style.display='none';
      const _eg=window._G;if(_eg&&_eg.state)_eg.state.selectedEspantalho=null;
      try{if(window._selectionResume)window._selectionResume();}catch(_){}
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
  });

  // ─── Poça de Piche Destroy Button ────────────────────────────
  (function(){
    const btn=document.getElementById('pichaPocoDestroyBtn');
    if(!btn)return;
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      const g=window._G; if(!g||!g.state||!g.state.selectedPichaPoco)return;
      try{ if(window._selectionResume) window._selectionResume(); }catch(_){}
      const pp=g.state.selectedPichaPoco;
      const refund=45;
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
      g.state.score+=refund;
      g.state.pichaPocos=g.state.pichaPocos.filter(p=>p!==pp);
      g.state.selectedPichaPoco=null;
      const m=document.getElementById('pichaPocoMenu');if(m)m.style.display='none';
      try{ if(g.state){ g.state.pausedManual=false; g.state._selectionPaused=false; var _pb_=document.getElementById('pauseBtn'); if(_pb_)_pb_.textContent='Pausar'; } }catch(_){}
      try{g.toastMsg('Poça destruída. +'+refund+' pts devolvidos.');}catch(_){}
      try{refreshShopVisibility();}catch(_){}
      try{if(window._renderShopPage)window._renderShopPage();}catch(_){}
      try{g.updateHUD();}catch(_){}
    });
  })();

  // ─── Portal Destroy Button ────────────────────────────────────
  document.getElementById('portalDestroyBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g=window._G; if(!g||!g.state||!g.state.portals) return;
    // Forçar despausar (pode ter sido aberto com jogo já pausado)
    try{
      if(window._selectionResume) window._selectionResume();
      if(g.state.pausedManual){
        g.state.pausedManual=false; g.state._selectionPaused=false;
        const _pbtn=document.getElementById('pauseBtn'); if(_pbtn) _pbtn.textContent='Pausar';
      }
    }catch(_){}

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

    // Devolver 600 pts (custo fixo)
    const refund=600;
    if(g.state.coop){
      const _ps=g.state.activeShopPlayer||1;
      if(_ps===1) g.state.score1=(g.state.score1||0)+refund;
      else g.state.score2=(g.state.score2||0)+refund;
    } else {
      g.state.score+=refund;
    }

    // Destruir portais
    g.state.portals=null;
    g.state.selectedPortal=null;
    const pm2=document.getElementById('portalMenu');
    if(pm2) pm2.style.display='none';

    // Despausa explicitamente — _selectionResume pode não agir se _selPausedPrev=null
    g.state._selectionPaused=false;
    g.state.pausedManual=false;
    try{ document.getElementById('pauseBtn').textContent='Pausar'; }catch(_){}

    g.toastMsg('Portais destruídos. +'+refund+' pts devolvidos.');
    try{ refreshShopVisibility(); }catch(_){}
    try{ if(window._renderShopPage) window._renderShopPage(); }catch(_){}
    try{ g.updateHUD(); }catch(_){}
  });

  // ── goldMenu listeners ──
  document.getElementById('goldMenuHealBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g=window._G; if(!g||!g.state) return;
    const healCost=200;
    const pts=g.state.coop?(g.state.activeShopPlayer===1?g.state.score1:g.state.score2):g.state.score;
    if(pts<healCost){ try{g.toastMsg('Pontos insuficientes!');}catch(_){} return; }
    if(g.state.gold.hp>=g.state.gold.max){ try{g.toastMsg('Ouro já está cheio!');}catch(_){} return; }
    // Descontar pontos
    if(g.state.coop){ if(g.state.activeShopPlayer===1) g.state.score1-=healCost; else g.state.score2-=healCost; }
    else g.state.score-=healCost;
    // Curar
    const before=g.state.gold.hp|0;
    g.state.gold.hp=Math.min(g.state.gold.max,(g.state.gold.hp|0)+20);
    const gained=(g.state.gold.hp|0)-before;
    if(gained>0){
      try{ g.spawnHealFX(g.state.gold.x,g.state.gold.y); }catch(_){}
      const TILE_G=32;
      const px=g.state.gold.x*TILE_G+TILE_G/2, py=g.state.gold.y*TILE_G-10;
      try{ g.pushMultiPopup('+'+gained+' VIDA','#4fe36a',px,py); }catch(_){}
      try{ g.beep(784,0.06,'triangle',0.05); g.beep(988,0.05,'triangle',0.04); }catch(_){}
      try{ const gb=document.getElementById('goldHPBar'); if(gb){gb.classList.remove('healPulse');void gb.offsetWidth;gb.classList.add('healPulse');setTimeout(()=>{try{gb.classList.remove('healPulse');}catch(_){}},560);} }catch(_){}
    }
    // Atualizar display
    const _gInfo=document.getElementById('goldMenuInfo');
    if(_gInfo) _gInfo.textContent='HP: '+(g.state.gold.hp|0)+' / '+g.state.gold.max;
    const _ghBtn=document.getElementById('goldMenuHealBtn');
    if(_ghBtn) _ghBtn.disabled=(g.state.gold.hp>=g.state.gold.max);
    try{ g.updateHUD(); }catch(_){}
  });
  // goldMenu fecha ao clicar fora (handled by canvas click-outside)

  // ── Parceiro pistoleiro: atalho da loja + visão infravermelho ──
  function refreshPartnerMenu(){
    const g = G();
    if (!g || !g.state) return;
    const st = g.state;
    const info = document.getElementById('partnerMenuInfo');
    const lvl = st.allyLevel|0;
    const fireMs = st.allyFireMs != null ? st.allyFireMs : 900;
    if (info){
      const irLine = st.partnerIrVision
        ? 'Visão IR: ativa (fantasmas e assassinos).'
        : 'Visão IR: inativa — compra libera alvos ocultos.';
      info.textContent = 'Nv. ' + Math.max(1, lvl) + '  |  Cadência ~' + (fireMs / 1000).toFixed(2) + 's — ' + irLine;
    }
    const ub = document.getElementById('partnerMenuUpgradeBtn');
    if (ub){
      const next = g.getNextAllyUpgradeCost ? g.getNextAllyUpgradeCost() : 275;
      if (next == null){
        ub.disabled = true;
        ub.textContent = 'Aprimorar (máx.)';
      } else {
        ub.textContent = 'Aprimorar (' + next + ' pts)';
        ub.disabled = false;
      }
    }
    const irb = document.getElementById('partnerMenuIrBtn');
    const irCost = (g.PARTNER_IR_VISION_COST != null ? g.PARTNER_IR_VISION_COST : 2180);
    if (irb){
      if (st.partnerIrVision){
        irb.disabled = true;
        irb.textContent = 'Visão infravermelho (ativa)';
      } else {
        irb.textContent = 'Visão infravermelho (' + irCost + ' pts)';
        irb.disabled = false;
      }
    }
  }
  window._refreshPartnerMenu = refreshPartnerMenu;

  document.getElementById('partnerMenuUpgradeBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedAlly) return;
    const next = g.getNextAllyUpgradeCost ? g.getNextAllyUpgradeCost() : null;
    if (next == null){
      try{ g.toastMsg('Parceiro já está no nível máximo!'); }catch(_){}
      return;
    }
    if (g.state.score < next){
      try{ g.toastMsg('Pontos insuficientes!'); }catch(_){}
      return;
    }
    g.state.score -= next;
    const r = g.applyAllyUpgradeCore ? g.applyAllyUpgradeCore() : { err: 'max' };
    if (r.err === 'max'){
      g.state.score += next;
      try{ g.toastMsg('Parceiro já no máximo!'); }catch(_){}
      refreshPartnerMenu();
      return;
    }
    try{
      g.beep(440, 0.05, 'square', 0.05);
      setTimeout(()=>g.beep(660, 0.06, 'square', 0.05), 65);
      setTimeout(()=>g.beep(880, 0.08, 'triangle', 0.06), 140);
    }catch(_){}
    try{ if (g.syncAllyShopCardUI) g.syncAllyShopCardUI(); }catch(_){}
    try{ g.refreshShopVisibility(); }catch(_){}
    try{ if (window._renderShopPage) window._renderShopPage(); }catch(_){}
    const _lv = g.state.allyLevel|1;
    try{ g.toastMsg(_lv === 1 ? 'Parceiro reforçado!' : ('Parceiro Nv.' + _lv + '!')); }catch(_){}
    refreshPartnerMenu();
    try{ g.updateHUD(); }catch(_){}
  });

  document.getElementById('partnerMenuIrBtn')?.addEventListener('click', function(e){
    e.stopPropagation();
    const g = G();
    if (!g || !g.state || !g.state.selectedAlly) return;
    const irCost = (g.PARTNER_IR_VISION_COST != null ? g.PARTNER_IR_VISION_COST : 2180);
    if (g.state.partnerIrVision){
      try{ g.toastMsg('Visão infravermelho já está ativa.'); }catch(_){}
      return;
    }
    if (g.state.score < irCost){
      try{ g.toastMsg('Pontos insuficientes!'); }catch(_){}
      return;
    }
    const pr = g.state.selectedAlly;
    g.state.score -= irCost;
    g.state.partnerIrVision = true;
    try{ if (g.playPartnerIrVisionPurchaseSfx) g.playPartnerIrVisionPurchaseSfx(); }catch(_){}
    try{
      if (g.spawnPartnerIrVisionPurchaseFX && pr) g.spawnPartnerIrVisionPurchaseFX(pr.x, pr.y);
    }catch(_){}
    try{ g.toastMsg('Visão infravermelho ativada!'); }catch(_){}
    refreshPartnerMenu();
    try{ g.updateHUD(); }catch(_){}
  });

})();
