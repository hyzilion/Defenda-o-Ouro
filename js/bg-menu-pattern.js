(function(){
  var el = document.getElementById('bgMenuPattern');
  if (!el) return;
  function tick(){
    try{
      if (window.state){
        // show when out of menu (during gameplay)
        el.style.display = (!state.inMenu) ? 'block' : 'none';
      }
    }catch(_){}
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
