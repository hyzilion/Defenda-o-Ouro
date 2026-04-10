(function(){
  function wireModeButtons(){
    var btnM = document.getElementById('inputModeMouse');
    var btnK = document.getElementById('inputModeKeys');
    if(!btnM || !btnK || btnM._wired) return;
    btnM._wired = true;
    function applyVisual(mode){
      var isMouse = mode === 'mouse';
      var active  = 'border:2px solid #c97a2b;background:#2a1500;color:#f0e6d2;';
      var inactive = 'border:2px solid #3a2208;background:#1a0d02;color:#8a6a33;';
      var base = 'flex:1;padding:7px 0;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;';
      btnM.style.cssText = base + (isMouse  ? active : inactive);
      btnK.style.cssText = base + (!isMouse ? active : inactive);
    }
    // Ler modo salvo do localStorage diretamente
    var current = 'mouse';
    try{
      var raw = localStorage.getItem('defenda_o_ouro_settings_v1');
      if(raw){ var parsed = JSON.parse(raw); if(parsed.inputMode) current = parsed.inputMode; }
    }catch(_){}
    applyVisual(current);
    btnM.addEventListener('click', function(){
      applyVisual('mouse');
      // Delegar para o IIFE de opções que tem o settings local e o saveSettings
      if(window._setInputMode) window._setInputMode('mouse');
    });
    btnK.addEventListener('click', function(){
      applyVisual('keys');
      if(window._setInputMode) window._setInputMode('keys');
    });
    // Expor applyVisual para syncUI poder atualizar o visual
    window._updateModeBtnsVisual = applyVisual;
  }
  // Tentar agora e também quando o painel abrir
  wireModeButtons();

})();
