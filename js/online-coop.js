(function(){
  // Estado global para coop online (placeholder)
  window.onlineState = {
    active: false,
    host: false,
    roomCode: '',
    players: [],
    yourIndex: 0,
    mapId: null,
    yourName: '',
    chatMessages: []
  };
  // Cores base para até quatro cowboys no lobby (placeholder)
  // Colours per player slot: host=azul, 2º=verde, 3º=vermelho, 4º=laranja
  const ONLINE_COLORS = ['#5d8cd0','#8dc07f','#d05d3d','#c97a2b'];

  // Desenha um avatar estilizado de cowboy no canvas do lobby. O avatar é uma
  // versão simplificada do sprite do jogador com cores baseadas em ONLINE_COLORS.
  function drawLobbyAvatar(ctx, idx){
    try{
      // Draw a scaled version of the in-game cowboy sprite.  Colours come from the
      // ONLINE_COLORS array (body) and the global COLORS palette (hat, shadow).
      const bodyColor = ONLINE_COLORS[idx % ONLINE_COLORS.length] || '#5d8cd0';
      const hatColor  = (typeof COLORS !== 'undefined' && COLORS.hat) ? COLORS.hat : '#4d2f0a';
      const shadowCol = (typeof COLORS !== 'undefined' && COLORS.shadow) ? COLORS.shadow : 'rgba(0,0,0,0.25)';
      const cw = ctx.canvas.width;
      const scale = cw / 32;
      ctx.clearRect(0, 0, cw, cw);
      // ground shadow
      ctx.fillStyle = shadowCol;
      ctx.fillRect(6 * scale, (32 - 8) * scale, (32 - 12) * scale, 4 * scale);
      // body
      ctx.fillStyle = bodyColor;
      ctx.fillRect(8 * scale, 8 * scale, (32 - 16) * scale, (32 - 16) * scale);
      // hat top and brim
      ctx.fillStyle = hatColor;
      ctx.fillRect(6 * scale, 6 * scale, (32 - 12) * scale, 6 * scale);
      ctx.fillRect(4 * scale, 10 * scale, (32 - 8) * scale, 4 * scale);
      // eyes
      ctx.fillStyle = '#111';
      ctx.fillRect(14 * scale, 16 * scale, 2 * scale, 2 * scale);
      ctx.fillRect((32 - 16) * scale, 16 * scale, 2 * scale, 2 * scale);
    }catch(_){}
  }
  function generateRoomCode(){
    return Math.floor(Math.random()*1000000).toString().padStart(6,'0');
  }
  function resetOnline(){
    onlineState.active = false;
    onlineState.host = false;
    onlineState.roomCode = '';
    onlineState.players = [];
    onlineState.yourIndex = 0;
    onlineState.mapId = null;
    onlineState.chatMessages = [];
    onlineState.yourName = '';
    // Remove lobby state from storage when resetting
    try{ localStorage.removeItem('defendaLobbyState'); }catch(_){}
  }

  // Escuta alterações na chave 'defendaJoinData' no localStorage para
  // simular a entrada de convidados sem servidor. Quando um convidado
  // escreve seu nome nessa chave, o host (se ativo) adiciona o jogador
  // à lista de players e atualiza o lobby.
  window.addEventListener('storage', function(ev){
    try{
      if (ev.key === 'defendaJoinData' && ev.newValue){
        const data = JSON.parse(ev.newValue);
        if (!onlineState.host) return;
        // Não adicione se já existir um jogador com o mesmo nome
        const exists = onlineState.players.some(function(pl){ return pl && pl.name === data.name; });
        if (!exists){
          onlineState.players.push({ name: data.name || ('Cowboy ' + (onlineState.players.length+1)), isHost: false });
          // Play join sound effect
          try{ beep(660, 0.15, 'triangle', 0.06); }catch(_){}
          updateLobbyUI();
        }
        localStorage.removeItem('defendaJoinData');
      }
    }catch(_){}
  });
  // Helpers to toggle visibility of game canvas and HUD when showing online/local coop menus
  function hideGameLayer(){
    const gameCanvas = document.getElementById('game');
    if (gameCanvas) gameCanvas.style.display = 'none';
    const hudEl = document.querySelector('.hud');
    if (hudEl) hudEl.style.display = 'none';
    // Oculta também o botão de zoom (lupa) para menus de coop/online
    const zw = document.getElementById('zoomWrap');
    if (zw){
      zw.style.display = '';
      zw.style.visibility = 'hidden';
      zw.style.opacity = '0';
    }
  }
  function showGameLayer(){
    const gameCanvas = document.getElementById('game');
    if (gameCanvas) gameCanvas.style.display = '';
    const hudEl = document.querySelector('.hud');
    if (hudEl) hudEl.style.display = '';
    // Restaura botão de zoom quando retornamos ao gameplay/menus principais
    const zw = document.getElementById('zoomWrap');
    if (zw){
      zw.style.display = '';
      zw.style.visibility = 'visible';
      zw.style.opacity = '1';
    }
  }
  // Expose helpers globally so external event listeners (defined outside this closure) can call them
  window.hideGameLayer = hideGameLayer;
  window.showGameLayer = showGameLayer;
  function updateLobbyUI(){
    const statusEl = document.getElementById('lobbyStatus');
    if (statusEl) statusEl.textContent = onlineState.players.length + '/4 jogadores';
    const codeEl = document.getElementById('lobbyCode');
    if (codeEl) codeEl.textContent = onlineState.roomCode;
    const slots = document.querySelectorAll('.lobby-player-slot');
    slots.forEach((slot,index)=>{
      const p = onlineState.players[index];
      // Clear previous contents
      while (slot.firstChild) slot.removeChild(slot.firstChild);
      if (p){
        slot.classList.add('lobby-filled');
        slot.style.borderStyle = 'solid';
        slot.style.borderColor = ONLINE_COLORS[index % ONLINE_COLORS.length];
        // Draw avatar on canvas
        const cvs = document.createElement('canvas');
        // enlarge avatar canvas for lobby (~15% larger than original 56px)
        cvs.width = 64; cvs.height = 64;
        cvs.className = 'slot-avatar';
        slot.appendChild(cvs);
        try{
          const ctx = cvs.getContext('2d');
          if (ctx) drawLobbyAvatar(ctx, index);
        }catch(_){ }
        const nameEl = document.createElement('div');
        nameEl.className = 'slot-name';
        nameEl.textContent = p.name || ('Cowboy ' + (index+1));
        slot.appendChild(nameEl);
      } else {
        slot.classList.remove('lobby-filled');
        slot.style.borderStyle = 'dashed';
        slot.style.borderColor = '#6b4b1b';
        // Empty slot representation: draw a dark silhouette
        const cvs = document.createElement('canvas');
        cvs.width = 64; cvs.height = 64;
        cvs.className = 'slot-avatar';
        slot.appendChild(cvs);
        try{
          const ctx = cvs.getContext('2d');
          if (ctx){
            // draw placeholder silhouette: simple cowboy hat and body in dark colour
            // scale the placeholder to fit the larger canvas (64px)
            const scale = cvs.width / 48; // original placeholder designed at 48px width
            ctx.fillStyle = '#2b1c0d';
            ctx.fillRect(14 * scale, 28 * scale, 28 * scale, 20 * scale);
            ctx.fillStyle = '#1b1206';
            ctx.fillRect(12 * scale, 22 * scale, 32 * scale, 10 * scale);
            ctx.fillRect(10 * scale, 26 * scale, 36 * scale, 4 * scale);
            ctx.fillStyle = '#100a05';
            ctx.fillRect(20 * scale, 38 * scale, 4 * scale, 2 * scale);
            ctx.fillRect(32 * scale, 38 * scale, 4 * scale, 2 * scale);
          }
        }catch(_){}
        const nameEl = document.createElement('div');
        nameEl.className = 'slot-name';
        nameEl.textContent = 'Vazio';
        slot.appendChild(nameEl);
      }
    });
    // Highlight selected map inside the dropdown
    const mapCards = document.querySelectorAll('#mapDropdown .map-card');
    mapCards.forEach(card => {
      const mId = card.dataset.mapId;
      if (onlineState.mapId && onlineState.mapId === mId){
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
    // Update map name display
    const mapNameEl = document.getElementById('lobbyMapName');
    if (mapNameEl){
      const id = onlineState.mapId || 'desert';
      const defs = (typeof window !== 'undefined' && window.MAP_DEFS) ? window.MAP_DEFS : {};
      const def = defs[id] || defs.desert || {};
      mapNameEl.textContent = def.name || 'Deserto';
    }
    // Draw the preview of the selected map
    try{ renderLobbyMapPreview(); }catch(_){}
    const startBtn = document.getElementById('startOnlineGameBtn');
    if (startBtn) startBtn.disabled = !(onlineState.host && onlineState.players.length >= 1);
    updateChatUI();
    // Sync lobby state to localStorage so that multiple tabs can reflect the same players and map selection
    try{
      syncLobbyToLocalStorage();
    }catch(_){}
  }

  // Render a small preview of the currently selected map inside the lobby. This draws
  // into the <canvas id="lobbyMapPreview"> element using the map definition's
  // drawPreview() helper. If the function is unavailable or throws, falls back
  // to a simple coloured rectangle based on the map's colour palette.
  function renderLobbyMapPreview(){
    const canvas = document.getElementById('lobbyMapPreview');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const id = onlineState.mapId || 'desert';
    // Access MAP_DEFS via window to ensure it is in the global scope.  In some
    // contexts the variable may not be captured from the closure.
    const defs = (typeof window !== 'undefined' && window.MAP_DEFS) ? window.MAP_DEFS : {};
    const def = defs[id] || defs.desert;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    try{
      if (def && typeof def.drawPreview === 'function'){
        def.drawPreview(ctx, canvas.width, canvas.height);
      } else {
        throw new Error('drawPreview missing');
      }
    }catch(_){
      try{
        const col = def && def.colors ? (def.colors.mid || '#3b2a10') : '#3b2a10';
        ctx.fillStyle = col;
        ctx.fillRect(0,0,canvas.width, canvas.height);
      }catch(__){
        ctx.fillStyle = '#3b2a10';
        ctx.fillRect(0,0,canvas.width, canvas.height);
      }
    }
  }
  // Persist the current lobby state into localStorage. This allows host and guests running in separate
  // tabs to detect each other by reading the same key. We store the room code, players and selected map.
  function syncLobbyToLocalStorage(){
    if (!onlineState || !onlineState.active) return;
    const data = {
      roomCode: onlineState.roomCode,
      players: onlineState.players,
      mapId: onlineState.mapId || null
    };
    try{
      localStorage.setItem('defendaLobbyState', JSON.stringify(data));
    }catch(_){}
  }
  // Periodically poll localStorage for lobby state updates from other tabs. When the stored state
  // differs from the local one, merge the player list and map selection and refresh the UI. This
  // mechanism supplements the `storage` event, which may not fire when local changes are made in the
  // same tab, and ensures that both host and guest see each other's names. The polling interval
  // is modest to avoid excessive overhead.
  function startLobbyPolling(){
    if (window._lobbyPollingStarted) return;
    window._lobbyPollingStarted = true;
    window._lobbyPollingTimer = setInterval(()=>{
      try{
        const dataStr = localStorage.getItem('defendaLobbyState');
        if (!dataStr) return;
        const data = JSON.parse(dataStr);
        if (!data || !onlineState || !onlineState.active) return;
        // Only act on matching room codes
        if (data.roomCode && data.roomCode === onlineState.roomCode){
          // Merge players: for each stored player, ensure we have them in local list
          const storedPlayers = Array.isArray(data.players) ? data.players : [];
          // Only update when number of players differs or names differ
          let changed = false;
          if (storedPlayers.length !== onlineState.players.length){
            changed = true;
          } else {
            for (let i=0; i<storedPlayers.length; i++){
              if (!onlineState.players[i] || onlineState.players[i].name !== storedPlayers[i].name){
                changed = true;
                break;
              }
            }
          }
          if (changed){
            onlineState.players = storedPlayers.map(p => ({ name: p.name, isHost: !!p.isHost }));
          }
          // Update map selection
          if (data.mapId && data.mapId !== onlineState.mapId){
            onlineState.mapId = data.mapId;
          }
          // Recompute host flag: first player is host
          if (onlineState.players.length > 0){
            const hostName = onlineState.players[0].name;
            onlineState.host = (hostName === onlineState.yourName);
          }
          if (changed || (data.mapId && data.mapId !== onlineState.mapId)){
            updateLobbyUI();
          }
        }
      }catch(_){}
    }, 500);
  }
  function updateChatUI(){
    const container = document.getElementById('chatMessages');
    if (!container) return;
    container.innerHTML = '';
    onlineState.chatMessages.forEach(msg=>{
      const div = document.createElement('div');
      const nameSpan = document.createElement('span');
      nameSpan.style.fontWeight = '700';
      nameSpan.textContent = msg.name + ': ';
      div.appendChild(nameSpan);
      div.appendChild(document.createTextNode(msg.text));
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  }
  function populateLobbyMapOptions(){
    const container = document.getElementById('mapDropdown');
    if (!container) return;
    container.innerHTML = '';
    const originals = document.querySelectorAll('#mapScreen .map-card');
    originals.forEach(orig => {
      const clone = orig.cloneNode(true);
      // Compact spacing for the dropdown list
      clone.style.margin = '4px 0';
      // Disable interaction for guests
      if (!onlineState.host){
        clone.classList.add('disabled');
      }
      clone.addEventListener('click', () => {
        if (!onlineState.host) return;
        const id = clone.dataset.mapId;
        if (id){
          onlineState.mapId = id;
          updateLobbyUI();
          try { syncLobbyToLocalStorage(); } catch(_) {}
          // hide the dropdown after selecting a map
          const dd = document.getElementById('mapDropdown');
          if (dd) dd.style.display = 'none';
        }
      });
      container.appendChild(clone);
    });
    // Render previews for the new list of map cards
    try { renderMapPreviews(); } catch(_) {}
  }
  // Atualiza sobreposição de nomes durante o jogo
  window.updateNameOverlay = function(){
    const overlay = document.getElementById('nameOverlay');
    if (!overlay) return;
    overlay.innerHTML = '';
    if (!state || !state.running) return;
    const canvas = document.getElementById('game');
    const rect = canvas.getBoundingClientRect();
    const tile = 32;
    const players = [];
    if (state.player) players.push(state.player);
    if (state.coop && state.player2) players.push(state.player2);
    players.forEach(p=>{
      if (!p || p.hp <= 0) return;
      const div = document.createElement('div');
      div.className = 'player-name-overlay';
      let name = p.name || '';
      if (!name) name = 'Cowboy';
      if (p.inShop) name += ' (Loja)';
      div.textContent = name;
      const left = rect.left + p.x * tile;
      const top = rect.top + p.y * tile - 18;
      div.style.left = left + 'px';
      div.style.top = top + 'px';
      div.style.width = tile + 'px';
      overlay.appendChild(div);
    });
  };
  document.addEventListener('DOMContentLoaded', ()=>{
    // Botão voltar na seleção de coop
    const coopModeBackBtn = document.getElementById('coopModeBackBtn');
    if (coopModeBackBtn && !coopModeBackBtn._bound){
      coopModeBackBtn._bound = true;
      coopModeBackBtn.addEventListener('click', ()=>{
        const cms = document.getElementById('coopModeSelectScreen');
        if (cms){ cms.style.display = 'none'; cms.setAttribute('aria-hidden','true'); }
        const menuScr = document.getElementById('menuScreen');
        if (menuScr){ menuScr.style.display = 'flex'; menuScr.setAttribute('aria-hidden','false'); }
        const zw = document.getElementById('zoomWrap');
        if (zw) zw.style.display = '';
        // Show game and HUD again when returning to main menu
        try{ showGameLayer(); }catch(_){}
      });
    }
    // Coop local
    const btnCoopLocal = document.getElementById('btnCoopLocal');
    if (btnCoopLocal && !btnCoopLocal._bound){
      btnCoopLocal._bound = true;
      btnCoopLocal.addEventListener('click', ()=>{
        const cms = document.getElementById('coopModeSelectScreen');
        if (cms){ cms.style.display = 'none'; cms.setAttribute('aria-hidden','true'); }
        const coopScr = document.getElementById('coopScreen');
        if (coopScr){ coopScr.style.display = 'flex'; coopScr.setAttribute('aria-hidden','false'); }
        // Hide underlying game and HUD while in coop local menu
        try{ hideGameLayer(); }catch(_){}
      });
    }
    // Coop online
    const btnCoopOnline = document.getElementById('btnCoopOnline');
    if (btnCoopOnline && !btnCoopOnline._bound){
      btnCoopOnline._bound = true;
      btnCoopOnline.addEventListener('click', ()=>{
        const cms = document.getElementById('coopModeSelectScreen');
        if (cms){ cms.style.display = 'none'; cms.setAttribute('aria-hidden','true'); }
        const entry = document.getElementById('onlineEntryScreen');
        if (entry){ entry.style.display = 'flex'; entry.setAttribute('aria-hidden','false'); }
        // Hide underlying game and HUD while in online entry screen
        try{ hideGameLayer(); }catch(_){}
      });
    }
    // Entrada online voltar
    const onlineEntryBackBtn = document.getElementById('onlineEntryBackBtn');
    if (onlineEntryBackBtn && !onlineEntryBackBtn._bound){
      onlineEntryBackBtn._bound = true;
      onlineEntryBackBtn.addEventListener('click', ()=>{
        const entry = document.getElementById('onlineEntryScreen');
        if (entry){ entry.style.display = 'none'; entry.setAttribute('aria-hidden','true'); }
        const cms = document.getElementById('coopModeSelectScreen');
        if (cms){ cms.style.display = 'flex'; cms.setAttribute('aria-hidden','false'); }
      });
    }
    // Criar sala
    const btnOnlineCreate = document.getElementById('btnOnlineCreate');
    if (btnOnlineCreate && !btnOnlineCreate._bound){
      btnOnlineCreate._bound = true;
      btnOnlineCreate.addEventListener('click', ()=>{
        resetOnline();
        onlineState.host = true;
        const entry = document.getElementById('onlineEntryScreen');
        if (entry){ entry.style.display = 'none'; entry.setAttribute('aria-hidden','true'); }
        const nameScr = document.getElementById('onlineNameScreen');
        if (nameScr){ nameScr.style.display = 'flex'; nameScr.setAttribute('aria-hidden','false'); }
      });
    }
    // Entrar sala
    const btnOnlineJoin = document.getElementById('btnOnlineJoin');
    if (btnOnlineJoin && !btnOnlineJoin._bound){
      btnOnlineJoin._bound = true;
      btnOnlineJoin.addEventListener('click', ()=>{
        resetOnline();
        onlineState.host = false;
        const entry = document.getElementById('onlineEntryScreen');
        if (entry){ entry.style.display = 'none'; entry.setAttribute('aria-hidden','true'); }
        const joinScr = document.getElementById('onlineJoinScreen');
        if (joinScr){ joinScr.style.display = 'flex'; joinScr.setAttribute('aria-hidden','false'); }
      });
    }
    // Voltar nome
    const onlineNameBackBtn = document.getElementById('onlineNameBackBtn');
    if (onlineNameBackBtn && !onlineNameBackBtn._bound){
      onlineNameBackBtn._bound = true;
      onlineNameBackBtn.addEventListener('click', ()=>{
        const nameScr = document.getElementById('onlineNameScreen');
        if (nameScr){ nameScr.style.display = 'none'; nameScr.setAttribute('aria-hidden','true'); }
        const entry = document.getElementById('onlineEntryScreen');
        if (entry){ entry.style.display = 'flex'; entry.setAttribute('aria-hidden','false'); }
      });
    }
    // Continuar após nome
    const btnNameContinue = document.getElementById('btnNameContinue');
    if (btnNameContinue && !btnNameContinue._bound){
      btnNameContinue._bound = true;
      btnNameContinue.addEventListener('click', ()=>{
        const inp = document.getElementById('playerNameInput');
        if(inp&&!inp.value&&window._expSystem){try{var _an=window._expSystem.acctLoad();if(_an.name)inp.value=_an.name;}catch(_){}}
        let name = inp ? inp.value.trim() : '';
        if (!name) name = 'Cowboy 1';
        onlineState.yourName = name;
        onlineState.players = [{ name: name, isHost:true }];
        onlineState.yourIndex = 0;
        onlineState.roomCode = generateRoomCode();
        // Define default map as desert when creating a new lobby
        onlineState.mapId = 'desert';
        onlineState.active = true;
        // Persist host name locally so guests on the same domain can display it
        try{ localStorage.setItem('defendaHostName', name); }catch(_){}
        const nameScr = document.getElementById('onlineNameScreen');
        if (nameScr){ nameScr.style.display = 'none'; nameScr.setAttribute('aria-hidden','true'); }
        const lobby = document.getElementById('onlineLobbyScreen');
        if (lobby){
          lobby.style.display = 'flex';
          lobby.style.alignItems = 'center';
          lobby.style.justifyContent = 'center';
          lobby.setAttribute('aria-hidden','false');
        }
        populateLobbyMapOptions();
        updateLobbyUI();
        // Start polling for lobby updates and persist initial state
        try{ startLobbyPolling(); syncLobbyToLocalStorage(); }catch(_){}
        // Toca uma música específica para o lobby online
        try{ musicStop(); musicLobbyStart(); }catch(_){}
      });
    }
    // Voltar de join
    const onlineJoinBackBtn = document.getElementById('onlineJoinBackBtn');
    if (onlineJoinBackBtn && !onlineJoinBackBtn._bound){
      onlineJoinBackBtn._bound = true;
      onlineJoinBackBtn.addEventListener('click', ()=>{
        const joinScr = document.getElementById('onlineJoinScreen');
        if (joinScr){ joinScr.style.display = 'none'; joinScr.setAttribute('aria-hidden','true'); }
        const entry = document.getElementById('onlineEntryScreen');
        if (entry){ entry.style.display = 'flex'; entry.setAttribute('aria-hidden','false'); }
      });
    }
    // Entrar em sala com código
    const btnJoinRoom = document.getElementById('btnJoinRoom');
    if (btnJoinRoom && !btnJoinRoom._bound){
      btnJoinRoom._bound = true;
      btnJoinRoom.addEventListener('click', ()=>{
        const codeIn = document.getElementById('roomCodeInput');
        const nameIn = document.getElementById('playerNameInputJoin');
        const code = codeIn ? codeIn.value.trim() : '';
        let name = nameIn ? nameIn.value.trim() : '';
        if (!name) name = 'Cowboy 2';
        onlineState.yourName = name;
        onlineState.roomCode = code || generateRoomCode();
        // Recupera o nome do host salvo (quando possível) para exibir no lobby
        let hostName = 'Host';
        try{
          const saved = localStorage.getItem('defendaHostName');
          if (saved) hostName = saved;
        }catch(_){}
        // Simula host já existente
        onlineState.players = [{ name: hostName, isHost:true }, { name: name, isHost:false }];
        onlineState.yourIndex = 1;
        // Attempt to load the currently selected map from the stored lobby state; default to desert when unavailable
        let selMap = 'desert';
        try{
          const stStr = localStorage.getItem('defendaLobbyState');
          if (stStr){
            const st = JSON.parse(stStr);
            if (st && st.roomCode === onlineState.roomCode && st.mapId){
              selMap = st.mapId;
            }
          }
        }catch(_){}
        onlineState.mapId = selMap;
        onlineState.active = true;
        const joinScr = document.getElementById('onlineJoinScreen');
        if (joinScr){ joinScr.style.display = 'none'; joinScr.setAttribute('aria-hidden','true'); }
        const lobby = document.getElementById('onlineLobbyScreen');
        if (lobby){
          lobby.style.display = 'flex';
          lobby.style.alignItems = 'center';
          lobby.style.justifyContent = 'center';
          lobby.setAttribute('aria-hidden','false');
        }
        populateLobbyMapOptions();
        updateLobbyUI();
        // Start polling for lobby updates and persist initial state
        try{ startLobbyPolling(); syncLobbyToLocalStorage(); }catch(_){}
        // Toca uma música específica para o lobby online
        try{ musicStop(); musicLobbyStart(); }catch(_){}
        // Grava no localStorage para que o host receba este convidado
        try{ localStorage.setItem('defendaJoinData', JSON.stringify({ name: name })); }catch(_){}
      });
    }
    // Sair do lobby
    const onlineLobbyBackBtn = document.getElementById('onlineLobbyBackBtn');
    if (onlineLobbyBackBtn && !onlineLobbyBackBtn._bound){
      onlineLobbyBackBtn._bound = true;
      onlineLobbyBackBtn.addEventListener('click', ()=>{
        // Ask for confirmation when attempting to leave the lobby
        let msg;
        if (onlineState && onlineState.host){
          msg = 'Tem certeza que deseja fechar o lobby? Todos os jogadores serão desconectados.';
        } else {
          msg = 'Tem certeza que deseja sair do lobby?';
        }
        if (!window.confirm(msg)) return;
        // Play a sound to indicate leaving the lobby
        try{ beep(300, 0.15, 'square', 0.06); }catch(_){}
        resetOnline();
        const lobby = document.getElementById('onlineLobbyScreen');
        if (lobby){ lobby.style.display = 'none'; lobby.setAttribute('aria-hidden','true'); }
        const cms = document.getElementById('coopModeSelectScreen');
        if (cms){ cms.style.display = 'flex'; cms.setAttribute('aria-hidden','false'); }
        // Continue hiding game layer while still inside coop selection
        try{ hideGameLayer(); }catch(_){}
      });
    }
    // Copiar código
    const copyCodeBtn = document.getElementById('copyCodeBtn');
    if (copyCodeBtn && !copyCodeBtn._bound){
      copyCodeBtn._bound = true;
      copyCodeBtn.addEventListener('click', async ()=>{
        try{
          await navigator.clipboard.writeText(onlineState.roomCode || '');
          copyCodeBtn.textContent = 'Copiado!';
          setTimeout(()=>{ copyCodeBtn.textContent = 'Copiar'; }, 1200);
        }catch(_){}
      });
    }
    // Chat envio
    const sendChatBtn = document.getElementById('sendChatBtn');
    const chatInput = document.getElementById('chatInput');
    if (sendChatBtn && !sendChatBtn._bound){
      sendChatBtn._bound = true;
      const sendMsg = ()=>{
        const text = chatInput.value.trim();
        if (!text) return;
        onlineState.chatMessages.push({ name: onlineState.yourName || 'Você', text });
        chatInput.value = '';
        updateChatUI();
      };
      sendChatBtn.addEventListener('click', sendMsg);
      chatInput.addEventListener('keypress', ev=>{
        if (ev.key === 'Enter'){
          ev.preventDefault();
          sendMsg();
        }
      });
    }
    // Emoji
    const emojiBtn = document.getElementById('emojiBtn');
    if (emojiBtn && !emojiBtn._bound){
      emojiBtn._bound = true;
      emojiBtn.addEventListener('click', (ev)=>{
        ev.preventDefault();
        ev.stopPropagation();
        const menu = document.getElementById('emojiMenu');
        if (!menu) return;
        // Toggle display
        if (menu.style.display === 'flex'){
          menu.style.display = 'none';
        } else {
          // Position menu relative to the button
          menu.style.display = 'flex';
        }
      });
      const emojiMenu = document.getElementById('emojiMenu');
      if (emojiMenu){
        emojiMenu.addEventListener('click', (ev)=>{
          const target = ev.target;
          if (target && target.dataset && target.dataset.emoji){
            chatInput.value += target.dataset.emoji;
            chatInput.focus();
            emojiMenu.style.display = 'none';
          }
        });
      }
    }

    // Map preview: toggle the map dropdown when the host clicks the preview button. Guests cannot open the dropdown.
    const mapPreviewBtn = document.getElementById('mapPreviewBtn');
    if (mapPreviewBtn && !mapPreviewBtn._bound){
      mapPreviewBtn._bound = true;
      mapPreviewBtn.addEventListener('click', ()=>{
        if (!onlineState || !onlineState.host) return;
        const dd = document.getElementById('mapDropdown');
        if (!dd) return;
        // If the dropdown is hidden or unset, show it; otherwise hide it
        if (dd.style.display && dd.style.display !== 'none'){
          dd.style.display = 'none';
        } else {
          dd.style.display = 'block';
        }
      });
    }
    // Iniciar jogo online
    const startOnlineBtn = document.getElementById('startOnlineGameBtn');
    if (startOnlineBtn && !startOnlineBtn._bound){
      startOnlineBtn._bound = true;
      startOnlineBtn.addEventListener('click', ()=>{
        // Somente o host pode iniciar
        if (!onlineState.host) return;
        const chosen = onlineState.mapId || 'desert';
        window.currentMapId = chosen;
        const coopMode = onlineState.players.length > 1;
        // Oculta o lobby imediatamente
        const lobby = document.getElementById('onlineLobbyScreen');
        if (lobby){ lobby.style.display = 'none'; lobby.setAttribute('aria-hidden','true'); }
        // Ajusta a flag coop antes de iniciar
        try{ if (state) state.coop = coopMode; }catch(_){}
        // Garante que os métodos start* existam no escopo global
        const p1name = onlineState.players[0] ? onlineState.players[0].name : 'Cowboy 1';
        const p2name = onlineState.players[1] ? onlineState.players[1].name : 'Cowboy 2';
        // Show game and HUD when transitioning into gameplay
        try{ showGameLayer(); }catch(_){}
        if (coopMode){
          if (typeof window.startCoopGame === 'function'){
            window.startCoopGame();
          } else if (typeof startCoopGame === 'function'){
            startCoopGame();
          }
        } else {
          if (typeof window.startGame === 'function'){
            window.startGame();
          } else if (typeof startGame === 'function'){
            startGame();
          }
        }
        // Após breve atraso, aplica nomes aos jogadores; usa timeout para garantir que
        // state.player/state.player2 existam após reset
        setTimeout(()=>{
          try{
            if (state && state.player){ state.player.name = p1name; }
            if (coopMode && state && state.player2){ state.player2.name = p2name; }
          }catch(_){}
        }, 50);
      });
    }
  });
})();
