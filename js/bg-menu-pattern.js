(function(){
  var el = document.getElementById('bgMenuPattern');
  if (!el) return;
  el.style.display = 'block';
  function tick(){
    try{
      var api = window.__defendaApi;
      var gameState = api && typeof api.getState === 'function' ? api.getState() : null;
      if (gameState) el.style.zIndex = gameState.inMenu ? '49' : '-1';
    }catch(_){}
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
