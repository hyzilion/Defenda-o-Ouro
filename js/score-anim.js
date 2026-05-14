(function(){
  // Animated score counter state per label id
  window._scoreAnim = window._scoreAnim || {};

  function formatScoreValue(value){
    const n = Math.round(Number(value) || 0);
    try{
      return n.toLocaleString('pt-BR');
    }catch(_){
      return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
  }
  window.formatGameScoreValue = window.formatGameScoreValue || formatScoreValue;

  // Call this instead of el.textContent = value
  // el      : the .badge element that wraps the label (for flash)
  // labelEl : the <span> that shows the number
  // target  : the real integer score
  window.animateScore = function(badgeEl, labelEl, target){
    target = Math.round(Number(target) || 0);
    const id = labelEl.id || (labelEl.id = '_sl_' + Math.random().toString(36).slice(2));
    if (!window._scoreAnim[id]){
      window._scoreAnim[id] = { disp: target, raf: null, prev: target };
      labelEl.textContent = formatScoreValue(target);
      return;
    }
    const st = window._scoreAnim[id];

    // Flash removido a pedido do usuário
    if (target !== st.prev){ st.prev = target; }

    // Smooth roll toward target
    if (st.raf) cancelAnimationFrame(st.raf);
    const roll = function(){
      const diff = target - st.disp;
      if (Math.abs(diff) < 1){
        st.disp = target;
        labelEl.textContent = formatScoreValue(target);
        st.raf = null;
        return;
      }
      // Speed: at least 1, up to 8% of diff per frame, scales with magnitude
      const step = Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) * 0.08));
      st.disp += step;
      labelEl.textContent = formatScoreValue(st.disp);
      st.raf = requestAnimationFrame(roll);
    };
    st.raf = requestAnimationFrame(roll);
  };
})();
