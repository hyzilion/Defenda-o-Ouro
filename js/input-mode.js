(function(){
  function wireModeButtons(){
    var btnM = document.getElementById('inputModeMouse');
    var btnK = document.getElementById('inputModeKeys');
    if(!btnM || !btnK || btnM._wired) return;
    btnM._wired = true;
    function applyVisual(mode){
      var isMouse = mode === 'mouse';
      btnM.classList.toggle('active', isMouse);
      btnK.classList.toggle('active', !isMouse);
    }
    // Ler modo salvo do armazenamento nativo
    var current = 'mouse';
    try{
      var nativeStore = window.__defendaNativeStore;
      var parsed = (nativeStore && nativeStore.loadSettings) ? nativeStore.loadSettings() : null;
      if(parsed && parsed.inputMode) current = parsed.inputMode;
    }catch(_){}
    applyVisual(current);
    btnM.addEventListener('click', function(){
      if (btnM.disabled) return;
      applyVisual('mouse');
      // Delegar para o IIFE de opções que tem o settings local e o saveSettings
      if(window._setInputMode) window._setInputMode('mouse');
    });
    btnK.addEventListener('click', function(){
      if (btnK.disabled) return;
      applyVisual('keys');
      if(window._setInputMode) window._setInputMode('keys');
    });
    // Expor applyVisual para syncUI poder atualizar o visual
    window._updateModeBtnsVisual = applyVisual;
  }
  // Tentar agora e também quando o painel abrir
  wireModeButtons();

})();
