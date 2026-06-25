(function(){
  "use strict";

  const MAX_PLAYERS = 4;
  const CHAT_LIMIT = 50;
  const CHAT_MAX = 160;
  const ROOM_TTL_MS = 1000 * 60 * 45;
  const HOST_SNAPSHOT_MS = 50;
  const CLIENT_INPUT_MS = 50;
  const CLIENT_INPUT_KEEPALIVE_MS = 180;
  const MAP_RESYNC_MS = 2000;
  const SNAPSHOT_BUFFER_LIMIT = 196 * 1024;
  const RTC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  const state = {
    firebaseReady: false,
    authReady: false,
    db: null,
    uid: localStorage.getItem("defendaOnlineClientId") || ("p_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-5)),
    roomCode: null,
    room: null,
    isHost: false,
    hostId: null,
    slot: 0,
    roomRef: null,
    unsub: [],
    peerById: new Map(),
    channelById: new Map(),
    inputChannelById: new Map(),
    snapshotChannelById: new Map(),
    hostPeer: null,
    hostChannel: null,
    hostControlChannel: null,
    hostInputChannel: null,
    hostSnapshotChannel: null,
    lastInputRaw: "",
    lastInputSent: 0,
    lastMapSnapshotAt: 0,
    lastMapSnapshotSig: "",
    lastMetaSnapshotAt: 0,
    mapSnapshotBurstUntil: 0,
    runId: null,
    endedRunId: null,
    running: false,
    typingClearTimer: null,
    lastTypingSentAt: 0,
    lastChatSoundAt: 0,
    chatSoundReady: false,
    playerPresence: null,
    loadingModalTimer: null
  };
  localStorage.setItem("defendaOnlineClientId", state.uid);
  const lobbyAvatarLoops = new Map();
  const lobbySnake = {
    mode: "chat",
    active: false,
    running: false,
    gameOver: false,
    raf: 0,
    lastFrame: 0,
    acc: 0,
    score: 0,
    best: 0,
    newRecord: false,
    cols: 17,
    rows: 13,
    snake: [],
    dir: { x:1, y:0 },
    nextDir: { x:1, y:0 },
    food: { x:12, y:7 },
    foodPulse: 0,
    stepCounter: 0,
    dying: false,
    deathPieces: [],
    deathIndex: 0,
    deathLast: 0
  };

  function $(id){ return document.getElementById(id); }
  function now(){ return Date.now(); }
  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" })[c];
    });
  }
  function sanitizeChat(text){ return String(text || "").replace(/\s+/g, " ").trim().slice(0, CHAT_MAX); }
  function decorClass(id){
    const cls = window._decorNameCssById && window._decorNameCssById[id];
    return cls ? String(cls).replace(/[^a-zA-Z0-9_-]/g, "") : "";
  }
  function decoratedNameHtml(name, nameStyle, extraClass){
    const cls = decorClass(nameStyle);
    return '<span class="prof-name-preview-text ' + (extraClass || "") + (cls ? " " + cls : "") + '">' + esc(name || "Cowboy") + '</span>';
  }
  function insertChatEmoji(input, emoji){
    if (!input || !emoji) return;
    const max = parseInt(input.getAttribute("maxlength") || "160", 10) || 160;
    const value = input.value || "";
    const start = input.selectionStart == null ? value.length : input.selectionStart;
    const end = input.selectionEnd == null ? value.length : input.selectionEnd;
    const next = (value.slice(0, start) + emoji + value.slice(end)).slice(0, max);
    input.value = next;
    const pos = Math.min(start + emoji.length, next.length);
    try{ input.setSelectionRange(pos, pos); }catch(_){}
    input.dispatchEvent(new Event("input", { bubbles:false }));
    input.focus();
  }
  function typingDotsHtml(){
    return '<span class="dots"><span>.</span><span>.</span><span>.</span></span>';
  }
  function renderTyping(typing){
    const active = [];
    const tnow = now();
    Object.keys(typing || {}).forEach(function(id){
      if (id === state.uid) return;
      const item = typing[id] || {};
      if (!item.until || item.until < tnow) return;
      active.push(item.name || "Cowboy");
    });
    let text = "";
    if (active.length === 1) text = esc(active[0]) + " está digitando" + typingDotsHtml();
    else if (active.length === 2) text = esc(active[0]) + " e " + esc(active[1]) + " estão digitando" + typingDotsHtml();
    else if (active.length > 2) text = active.length + " jogadores estão digitando" + typingDotsHtml();
    ["onlineTypingIndicator","onlineGameTypingIndicator"].forEach(function(id){
      const el = $(id);
      if (el) el.innerHTML = text;
    });
  }
  function setTypingActive(active){
    if (!state.roomRef) return;
    if (state.typingClearTimer){
      clearTimeout(state.typingClearTimer);
      state.typingClearTimer = null;
    }
    const ref = state.roomRef.child("typing/" + state.uid);
    if (!active){
      state.lastTypingSentAt = 0;
      ref.remove().catch(function(){});
      return;
    }
    const tnow = now();
    if (tnow - (state.lastTypingSentAt || 0) < 850) {
      state.typingClearTimer = setTimeout(function(){ setTypingActive(false); }, 1700);
      return;
    }
    state.lastTypingSentAt = tnow;
    const profile = getProfile();
    ref.set({ name:profile.name || "Cowboy", until:tnow + 2200, at:tnow }).catch(function(){});
    state.typingClearTimer = setTimeout(function(){ setTypingActive(false); }, 1700);
  }
  function onlineToast(msg, err){
    if (!msg) return;
    try{
      if (window._profSkinToast) window._profSkinToast(msg, !!err);
      else if (window.__defendaApi && window.__defendaApi.toastMsg) window.__defendaApi.toastMsg(msg);
    }catch(_){}
    try{
      if (err){
        if (window._gameBeep) window._gameBeep(180, 0.09, "sawtooth", 0.07);
      } else if (window._profSndEquip){
        window._profSndEquip();
      } else if (window._gameBeep){
        window._gameBeep(660, 0.06, "triangle", 0.05);
        setTimeout(function(){ try{ window._gameBeep(880, 0.08, "triangle", 0.07); }catch(_){} }, 90);
      }
    }catch(_){}
  }
  function setOnlineLoadingText(baseText, step){
    const text = $("onlineLoadingText");
    if (!text) return;
    const clean = String(baseText || "Carregando").replace(/\.+\s*$/, "");
    text.textContent = clean + ".".repeat((step % 3) + 1);
  }
  function showOnlineLoading(baseText){
    const modal = $("onlineLoadingModal");
    if (!modal) return;
    if (state.loadingModalTimer){
      clearInterval(state.loadingModalTimer);
      state.loadingModalTimer = null;
    }
    let step = 0;
    setOnlineLoadingText(baseText, step);
    state.loadingModalTimer = setInterval(function(){
      step = (step + 1) % 3;
      setOnlineLoadingText(baseText, step);
    }, 420);
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    try{ document.body.setAttribute("data-confirm-open", "1"); }catch(_){}
  }
  function hideOnlineLoading(){
    if (state.loadingModalTimer){
      clearInterval(state.loadingModalTimer);
      state.loadingModalTimer = null;
    }
    const modal = $("onlineLoadingModal");
    if (modal){
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }
    try{
      const stillOpen = ["confirmModal","confirmResetModal","pathBlockConfirmModal","onlineLeaveConfirmModal"].some(function(id){
        const el = $(id);
        return el && el.style.display === "flex";
      });
      if (!stillOpen) document.body.removeAttribute("data-confirm-open");
    }catch(_){ try{ document.body.removeAttribute("data-confirm-open"); }catch(__){} }
  }

  function playIncomingChatSound(){
    try{
      if (!window._gameBeep) return;
      window._gameBeep(620, 0.045, "triangle", 0.035);
      setTimeout(function(){ try{ window._gameBeep(820, 0.04, "triangle", 0.028); }catch(_){} }, 48);
    }catch(_){}
  }

  function snakeBeep(kind){
    try{
      if (!window._gameBeep) return;
      if (kind === "toggle") window._gameBeep(560, 0.045, "square", 0.035);
      else if (kind === "eat"){
        window._gameBeep(720, 0.045, "triangle", 0.04);
        setTimeout(function(){ try{ window._gameBeep(960, 0.05, "triangle", 0.035); }catch(_){} }, 48);
      } else if (kind === "move") window._gameBeep(210, 0.012, "square", 0.011);
      else if (kind === "over"){
        window._gameBeep(170, 0.09, "sawtooth", 0.05);
        setTimeout(function(){ try{ window._gameBeep(120, 0.12, "sawtooth", 0.035); }catch(_){} }, 72);
      } else if (kind === "record"){
        [523, 659, 784, 1046, 1318].forEach(function(freq, i){
          setTimeout(function(){ try{ window._gameBeep(freq, 0.09, i < 3 ? "square" : "triangle", 0.052); }catch(_){} }, i * 82);
        });
      } else if (kind === "wrap"){
        window._gameBeep(340, 0.045, "triangle", 0.032);
        setTimeout(function(){ try{ window._gameBeep(520, 0.055, "triangle", 0.032); }catch(_){} }, 45);
      } else if (kind === "shatter"){
        window._gameBeep(250, 0.035, "square", 0.035);
      } else if (kind === "shatterHead"){
        window._gameBeep(120, 0.11, "sawtooth", 0.055);
        setTimeout(function(){ try{ window._gameBeep(90, 0.09, "sawtooth", 0.035); }catch(_){} }, 70);
      } else window._gameBeep(620, 0.04, "square", 0.03);
    }catch(_){}
  }

  let snakeMusicTimer = 0;
  let snakeMusicStep = 0;
  let snakeMusicMode = "off";
  let snakeAudioCtx = null;

  function getSnakeAudio(){
    if (!snakeAudioCtx) snakeAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return snakeAudioCtx;
  }

  function snakeMusicVolume(){
    const gs = window._gameSettings || window.settings || {};
    const music = Number.isFinite(Number(gs.music)) ? Math.max(0, Math.min(1, Number(gs.music))) : 1;
    return music;
  }

  function setLobbyMusicDuck(value){
    try{
      if (typeof window.__defendaSetMusicDuckFactor === "function") window.__defendaSetMusicDuckFactor(value);
      else if (window.__defendaApi && typeof window.__defendaApi.setMusicDuckFactor === "function") window.__defendaApi.setMusicDuckFactor(value);
    }catch(_){}
  }

  function stopLobbySnakeMusic(){
    if (snakeMusicTimer) clearTimeout(snakeMusicTimer);
    snakeMusicTimer = 0;
    snakeMusicMode = "off";
  }

  function snakeTone(master, freq, type, dur, vol, at){
    if (!freq) return;
    const ac = getSnakeAudio();
    const o = ac.createOscillator();
    const g = ac.createGain();
    const t = ac.currentTime + (at || 0);
    o.type = type || "square";
    o.frequency.setValueAtTime(freq, t);
    o.connect(g).connect(master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0001, vol || 0.05), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + (dur || 0.18));
    o.start(t);
    o.stop(t + (dur || 0.18) + 0.03);
  }

  function snakePerc(master, kind){
    const ac = getSnakeAudio();
    const t = ac.currentTime;
    if (kind === "kick"){
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(92, t);
      o.frequency.exponentialRampToValueAtTime(46, t + 0.10);
      o.connect(g).connect(master);
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.start(t);
      o.stop(t + 0.18);
      return;
    }
    snakeTone(master, kind === "tick" ? 1180 : 720, "square", 0.035, kind === "tick" ? 0.018 : 0.026, 0);
  }

  function startLobbySnakeMusic(mode){
    mode = mode === "game" ? "game" : "menu";
    if (snakeMusicMode === mode && snakeMusicTimer) return;
    stopLobbySnakeMusic();
    snakeMusicMode = mode;
    snakeMusicStep = 0;
    setLobbyMusicDuck(0);
    try{
      const ac = getSnakeAudio();
      if (ac.state === "suspended") ac.resume();
    }catch(_){}

    const tempo = mode === "game" ? 132 : 112;
    const beatMs = (60 / tempo) * 500;
    const E3=165, G3=196, A3=220, B3=247, D4=294;
    const E4=330, G4=392, A4=440, B4=494, D5=587;
    const E5=659, G5=784, A5=880, B5=988, D6=1175, E6=1318;
    const menuLead = [
      E5, 0, G5, 0, A5, 0, B5, 0,
      A5, 0, G5, 0, E5, 0, 0, 0,
      G5, 0, A5, 0, B5, 0, D6, 0,
      B5, 0, A5, 0, G5, 0, 0, 0
    ];
    const gameLead = [
      E5, G5, A5, B5, A5, G5, E5, 0,
      G5, A5, B5, D6, B5, A5, G5, 0,
      E5, G5, A5, B5, D6, B5, A5, G5,
      E5, G5, A5, G5, E5, 0, B4, 0
    ];
    const menuBass = [
      E3, 0, B3, 0, E3, 0, B3, 0,
      D4, 0, A3, 0, D4, 0, A3, 0,
      G3, 0, D4, 0, G3, 0, D4, 0,
      A3, 0, E4, 0, B3, 0, 0, 0
    ];
    const gameBass = [
      E3, B3, E3, B3, E3, B3, E3, B3,
      G3, D4, G3, D4, G3, D4, G3, D4,
      A3, E4, A3, E4, A3, E4, A3, E4,
      G3, D4, A3, E4, B3, E4, B3, 0
    ];

    function tick(){
      if (snakeMusicMode !== mode) return;
      if (lobbySnake.mode !== "snake" || lobbySnake.gameOver){
        stopLobbySnakeMusic();
        return;
      }
      const ac = getSnakeAudio();
      const master = ac.createGain();
      master.gain.value = (mode === "game" ? 0.24 : 0.20) * snakeMusicVolume();
      master.connect(ac.destination);
      const s = snakeMusicStep % 32;
      const leadSeq = mode === "game" ? gameLead : menuLead;
      const bassSeq = mode === "game" ? gameBass : menuBass;
      if (s % 8 === 0) snakePerc(master, "kick");
      if (mode === "game" && s % 16 === 8) snakePerc(master, "snare");
      if (bassSeq[s]) snakeTone(master, bassSeq[s], "sawtooth", mode === "game" ? 0.18 : 0.24, mode === "game" ? 0.11 : 0.085, 0);
      if (leadSeq[s]){
        snakeTone(master, leadSeq[s], "square", mode === "game" ? 0.19 : 0.28, mode === "game" ? 0.19 : 0.16, 0.012);
        if (mode === "game" && s % 8 === 3) snakeTone(master, E6, "square", 0.10, 0.055, 0.03);
      }
      snakeMusicStep++;
      snakeMusicTimer = setTimeout(tick, beatMs);
    }
    tick();
  }

  function updateLobbySnakeBestUi(){
    const best = $("onlineSnakeBest");
    if (best) best.innerHTML = "🏆 Recorde: <b>" + esc(lobbySnake.best || 0) + "</b>";
  }

  function saveLobbySnakeBestToAccount(best){
    try{
      if (window._expSystem && window._expSystem.acctLoad && window._expSystem.acctSave){
        const acc = window._expSystem.acctLoad() || {};
        acc.lobbySnakeBest = Math.max(0, Number(best) | 0);
        window._expSystem.acctSave(acc);
      }
    }catch(_){}
  }

  function consumeLegacyLobbySnakeBest(){
    const legacy = { found:false, value:0 };
    try{
      const stored = localStorage.getItem("defenda_lobby_snake_best");
      if (stored !== null){
        legacy.found = true;
        legacy.value = Math.max(0, Number(stored) | 0);
        localStorage.removeItem("defenda_lobby_snake_best");
      }
    }catch(_){}
    return legacy;
  }

  function loadLobbySnakeBest(){
    let best = 0;
    let accountBest = 0;
    try{
      const acc = window._expSystem && window._expSystem.acctLoad ? window._expSystem.acctLoad() : null;
      if (acc && Number.isFinite(Number(acc.lobbySnakeBest))) accountBest = Math.max(0, Number(acc.lobbySnakeBest) | 0);
    }catch(_){}
    best = accountBest;
    const legacy = consumeLegacyLobbySnakeBest();
    if (legacy.found) best = Math.max(best, legacy.value);
    if (legacy.found && best !== accountBest) saveLobbySnakeBestToAccount(best);
    lobbySnake.best = Math.max(0, best | 0);
    updateLobbySnakeBestUi();
    return lobbySnake.best;
  }

  function saveLobbySnakeBest(value){
    const best = Math.max(0, Number(value) | 0);
    lobbySnake.best = best;
    saveLobbySnakeBestToAccount(best);
    updateLobbySnakeBestUi();
  }

  function updateLobbySnakeOverlayMode(mode){
    const overlay = $("onlineSnakeOverlay");
    const title = $("onlineSnakeTitle");
    const hint = $("onlineSnakeHint");
    if (overlay) overlay.classList.toggle("gameover", mode === "gameover");
    if (title) title.textContent = mode === "gameover" ? "FIM DE JOGO" : "SNAKE";
    if (hint) hint.innerHTML = mode === "gameover" ? 'Aperte <span class="kbd">Espaço</span> para Reiniciar' : 'Aperte <span class="kbd">Espaço</span> para Iniciar';
  }

  function resetLobbySnake(){
    stopLobbySnakeMusic();
    setLobbyMusicDuck(1);
    lobbySnake.mode = "chat";
    lobbySnake.active = false;
    lobbySnake.running = false;
    lobbySnake.gameOver = false;
    lobbySnake.lastFrame = 0;
    lobbySnake.acc = 0;
    lobbySnake.score = 0;
    lobbySnake.newRecord = false;
    loadLobbySnakeBest();
    lobbySnake.snake = [];
    lobbySnake.dir = { x:1, y:0 };
    lobbySnake.nextDir = { x:1, y:0 };
    lobbySnake.food = { x:12, y:7 };
    lobbySnake.foodPulse = 0;
    lobbySnake.stepCounter = 0;
    lobbySnake.dying = false;
    lobbySnake.deathPieces = [];
    lobbySnake.deathIndex = 0;
    lobbySnake.deathLast = 0;
    if (lobbySnake.raf) cancelAnimationFrame(lobbySnake.raf);
    lobbySnake.raf = 0;
    const panel = $("onlineLobbyChatPanel");
    const btn = $("onlineSnakeToggle");
    const view = $("onlineSnakeView");
    const overlay = $("onlineSnakeOverlay");
    const score = $("onlineSnakeScore");
    const record = $("onlineSnakeRecord");
    if (panel) panel.classList.remove("snake-mode");
    if (btn){ btn.textContent = "🐍"; btn.setAttribute("aria-label", "Snake"); }
    if (view) view.setAttribute("aria-hidden", "true");
    if (overlay) overlay.classList.remove("hidden");
    updateLobbySnakeOverlayMode("menu");
    if (score){ score.textContent = "0"; score.classList.remove("visible"); }
    if (record) record.style.display = "none";
    drawLobbySnake();
  }

  function initLobbySnakeRound(){
    const midX = Math.floor(lobbySnake.cols / 2);
    const midY = Math.floor(lobbySnake.rows / 2);
    lobbySnake.snake = [
      { x: midX + 1, y: midY },
      { x: midX, y: midY },
      { x: midX - 1, y: midY }
    ];
    lobbySnake.dir = { x:1, y:0 };
    lobbySnake.nextDir = { x:1, y:0 };
    lobbySnake.score = 0;
    lobbySnake.acc = 0;
    lobbySnake.lastFrame = 0;
    lobbySnake.gameOver = false;
    lobbySnake.newRecord = false;
    lobbySnake.stepCounter = 0;
    lobbySnake.dying = false;
    lobbySnake.deathPieces = [];
    lobbySnake.deathIndex = 0;
    lobbySnake.deathLast = 0;
    placeLobbySnakeFood();
    const score = $("onlineSnakeScore");
    if (score){ score.textContent = "0"; score.classList.remove("visible"); }
    const record = $("onlineSnakeRecord");
    if (record) record.style.display = "none";
  }

  function lobbySnakeContains(x, y){
    return lobbySnake.snake.some(function(p){ return p.x === x && p.y === y; });
  }

  function placeLobbySnakeFood(){
    const free = [];
    for (let y=0;y<lobbySnake.rows;y++){
      for (let x=0;x<lobbySnake.cols;x++){
        if (!lobbySnakeContains(x, y)) free.push({ x:x, y:y });
      }
    }
    lobbySnake.food = free.length ? free[Math.floor(Math.random() * free.length)] : { x:1, y:1 };
  }

  function setLobbySnakeMode(on){
    const panel = $("onlineLobbyChatPanel");
    const btn = $("onlineSnakeToggle");
    const view = $("onlineSnakeView");
    const chatInput = $("onlineChatInput");
    if (!panel || !btn) return;
    lobbySnake.mode = on ? "snake" : "chat";
    lobbySnake.active = !!on;
    panel.classList.toggle("snake-mode", !!on);
    btn.textContent = on ? "💬" : "🐍";
    btn.setAttribute("aria-label", on ? "Chat" : "Snake");
    if (view) view.setAttribute("aria-hidden", on ? "false" : "true");
    if (on){
      if (chatInput) chatInput.blur();
      if (!lobbySnake.snake.length) initLobbySnakeRound();
      drawLobbySnake();
      if (lobbySnake.dying){
        stopLobbySnakeMusic();
        setLobbyMusicDuck(0);
        lobbySnake.deathLast = 0;
        if (!lobbySnake.raf) lobbySnake.raf = requestAnimationFrame(lobbySnakeDeathLoop);
      } else if (lobbySnake.running && !lobbySnake.gameOver){
        startLobbySnakeMusic("game");
        scheduleLobbySnakeLoop();
      } else if (lobbySnake.gameOver){
        stopLobbySnakeMusic();
        setLobbyMusicDuck(0);
      } else {
        startLobbySnakeMusic("menu");
      }
    } else {
      if (lobbySnake.raf) cancelAnimationFrame(lobbySnake.raf);
      lobbySnake.raf = 0;
      lobbySnake.lastFrame = 0;
      stopLobbySnakeMusic();
      setLobbyMusicDuck(1);
    }
    snakeBeep("toggle");
  }

  function startLobbySnakeGame(){
    if (lobbySnake.dying) return;
    if (lobbySnake.gameOver || !lobbySnake.snake.length) initLobbySnakeRound();
    lobbySnake.running = true;
    lobbySnake.gameOver = false;
    startLobbySnakeMusic("game");
    const overlay = $("onlineSnakeOverlay");
    const score = $("onlineSnakeScore");
    if (score) score.classList.add("visible");
    if (overlay) overlay.classList.add("hidden");
    scheduleLobbySnakeLoop();
  }

  function scheduleLobbySnakeLoop(){
    if (lobbySnake.raf || lobbySnake.mode !== "snake" || !lobbySnake.running || lobbySnake.gameOver || lobbySnake.dying) return;
    lobbySnake.raf = requestAnimationFrame(lobbySnakeLoop);
  }

  function lobbySnakeLoop(ts){
    lobbySnake.raf = 0;
    if (lobbySnake.mode !== "snake" || !lobbySnake.running || lobbySnake.gameOver || lobbySnake.dying) return;
    if (!lobbySnake.lastFrame) lobbySnake.lastFrame = ts;
    const dt = Math.min(80, ts - lobbySnake.lastFrame);
    lobbySnake.lastFrame = ts;
    lobbySnake.acc += dt;
    lobbySnake.foodPulse += dt;
    const stepMs = 132;
    while (lobbySnake.acc >= stepMs){
      stepLobbySnake();
      lobbySnake.acc -= stepMs;
      if (lobbySnake.gameOver) break;
    }
    drawLobbySnake();
    if (!lobbySnake.gameOver) lobbySnake.raf = requestAnimationFrame(lobbySnakeLoop);
  }

  function showLobbySnakeGameOver(){
    lobbySnake.gameOver = true;
    lobbySnake.running = false;
    lobbySnake.dying = false;
    lobbySnake.deathPieces = [];
    lobbySnake.deathIndex = 0;
    lobbySnake.deathLast = 0;
    stopLobbySnakeMusic();
    setLobbyMusicDuck(0);
    const overlay = $("onlineSnakeOverlay");
    updateLobbySnakeOverlayMode("gameover");
    const record = $("onlineSnakeRecord");
    if (lobbySnake.score > (lobbySnake.best || 0)){
      lobbySnake.newRecord = true;
      saveLobbySnakeBest(lobbySnake.score);
      if (record) record.style.display = "block";
      snakeBeep("record");
    } else {
      lobbySnake.newRecord = false;
      if (record) record.style.display = "none";
      snakeBeep("over");
    }
    if (overlay) overlay.classList.remove("hidden");
    drawLobbySnake();
  }

  function startLobbySnakeDeathAnimation(){
    if (lobbySnake.dying) return;
    lobbySnake.running = false;
    lobbySnake.gameOver = false;
    lobbySnake.dying = true;
    stopLobbySnakeMusic();
    setLobbyMusicDuck(0);
    lobbySnake.acc = 0;
    lobbySnake.deathPieces = lobbySnake.snake.map(function(p){ return { x:p.x, y:p.y }; });
    lobbySnake.deathIndex = Math.max(0, lobbySnake.deathPieces.length - 1);
    lobbySnake.deathLast = 0;
    const overlay = $("onlineSnakeOverlay");
    if (overlay) overlay.classList.add("hidden");
    if (lobbySnake.raf) cancelAnimationFrame(lobbySnake.raf);
    lobbySnake.raf = requestAnimationFrame(lobbySnakeDeathLoop);
  }

  function lobbySnakeDeathLoop(ts){
    lobbySnake.raf = 0;
    if (lobbySnake.mode !== "snake" || !lobbySnake.dying) return;
    if (!lobbySnake.deathLast) lobbySnake.deathLast = ts;
    if (ts - lobbySnake.deathLast >= 78){
      const idx = lobbySnake.deathIndex;
      if (idx >= 0){
        lobbySnake.snake.splice(idx, 1);
        lobbySnake.deathIndex = idx - 1;
        snakeBeep(idx === 0 ? "shatterHead" : "shatter");
      }
      lobbySnake.deathLast = ts;
    }
    drawLobbySnake();
    if (lobbySnake.deathIndex < 0){
      const finish = function(){
        if (!lobbySnake.dying) return;
        if (lobbySnake.mode === "snake") showLobbySnakeGameOver();
        else setTimeout(finish, 130);
      };
      setTimeout(finish, 130);
    } else {
      lobbySnake.raf = requestAnimationFrame(lobbySnakeDeathLoop);
    }
  }

  function stepLobbySnake(){
    if (lobbySnake.dying) return;
    const nd = lobbySnake.nextDir;
    const cd = lobbySnake.dir;
    if (!(nd.x === -cd.x && nd.y === -cd.y)) lobbySnake.dir = { x:nd.x, y:nd.y };
    const head = lobbySnake.snake[0] || { x:0, y:0 };
    let next = { x:head.x + lobbySnake.dir.x, y:head.y + lobbySnake.dir.y };
    const wrapped = next.x < 0 || next.y < 0 || next.x >= lobbySnake.cols || next.y >= lobbySnake.rows;
    if (wrapped){
      next = {
        x: (next.x + lobbySnake.cols) % lobbySnake.cols,
        y: (next.y + lobbySnake.rows) % lobbySnake.rows
      };
    }
    const eating = next.x === lobbySnake.food.x && next.y === lobbySnake.food.y;
    const hitsBody = lobbySnake.snake.some(function(p, i){
      return p.x === next.x && p.y === next.y && (eating || i < lobbySnake.snake.length - 1);
    });
    if (hitsBody){
      startLobbySnakeDeathAnimation();
      return;
    }
    lobbySnake.snake.unshift(next);
    lobbySnake.stepCounter++;
    if (wrapped) snakeBeep("wrap");
    if (eating){
      lobbySnake.score += 1;
      const score = $("onlineSnakeScore");
      if (score) score.textContent = String(lobbySnake.score);
      placeLobbySnakeFood();
      snakeBeep("eat");
    } else {
      lobbySnake.snake.pop();
      if (!wrapped) snakeBeep("move");
    }
  }

  function drawLobbySnake(){
    const canvas = $("onlineSnakeCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const nextW = Math.max(240, Math.floor(canvas.clientWidth || canvas.width || 340));
    const nextH = Math.max(180, Math.floor(canvas.clientHeight || canvas.height || 260));
    if (canvas.width !== nextW || canvas.height !== nextH){
      canvas.width = nextW;
      canvas.height = nextH;
      ctx.imageSmoothingEnabled = false;
    }
    const w = canvas.width || 340;
    const h = canvas.height || 260;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#090402";
    ctx.fillRect(0, 0, w, h);
    const cellW = w / lobbySnake.cols;
    const cellH = h / lobbySnake.rows;
    const ox = 0;
    const oy = 0;
    for (let gy=0;gy<lobbySnake.rows;gy++){
      for (let gx=0;gx<lobbySnake.cols;gx++){
        ctx.fillStyle = (gx + gy) % 2 ? "#100704" : "#140904";
        ctx.fillRect(Math.floor(ox + gx * cellW), Math.floor(oy + gy * cellH), Math.ceil(cellW), Math.ceil(cellH));
      }
    }
    const pulse = 0.85 + Math.sin((lobbySnake.foodPulse || 0) / 120) * 0.15;
    const fx = ox + lobbySnake.food.x * cellW;
    const fy = oy + lobbySnake.food.y * cellH;
    const appleSize = Math.max(6, Math.floor(Math.min(cellW, cellH) * .62 * pulse));
    const appleX = Math.floor(fx + (cellW - appleSize) / 2);
    const appleY = Math.floor(fy + (cellH - appleSize) / 2) + 1;
    ctx.fillStyle = "#b91414";
    ctx.fillRect(appleX, appleY, appleSize, appleSize);
    ctx.fillStyle = "#ff3b31";
    ctx.fillRect(appleX + 2, appleY + 2, Math.max(2, appleSize - 4), Math.max(2, appleSize - 4));
    ctx.fillStyle = "#5ec45a";
    ctx.fillRect(appleX + Math.floor(appleSize * .55), appleY - 2, Math.max(2, Math.floor(appleSize * .25)), 3);
    lobbySnake.snake.forEach(function(part, i){
      const drawX = Math.floor(ox + part.x * cellW);
      const drawY = Math.floor(oy + part.y * cellH);
      const pad = Math.max(2, Math.floor(Math.min(cellW, cellH) * .14));
      const baseW = Math.max(4, Math.floor(cellW) - pad * 2);
      const baseH = Math.max(4, Math.floor(cellH) - pad * 2);
      ctx.fillStyle = i === 0 ? "#67d957" : "#3fa343";
      ctx.fillRect(drawX + pad, drawY + pad, baseW, baseH);
      ctx.fillStyle = "rgba(255,255,255,.16)";
      ctx.fillRect(drawX + pad + 2, drawY + pad + 2, Math.max(2, baseW - 4), 2);
      if (i === 0){
        ctx.fillStyle = "#101006";
        const minCell = Math.min(cellW, cellH);
        const ex = lobbySnake.dir.x === 0 ? pad + 2 : (lobbySnake.dir.x > 0 ? Math.floor(cellW) - pad - 5 : pad + 2);
        const ey1 = lobbySnake.dir.y === 0 ? pad + 3 : (lobbySnake.dir.y > 0 ? Math.floor(cellH) - pad - 5 : pad + 2);
        const ey2 = lobbySnake.dir.y === 0 ? Math.floor(cellH) - pad - 6 : ey1;
        const ex2 = lobbySnake.dir.x === 0 ? Math.floor(cellW) - pad - 6 : ex;
        const eye = Math.max(2, Math.floor(minCell * .12));
        ctx.fillRect(drawX + ex, drawY + ey1, eye, eye);
        ctx.fillRect(drawX + ex2, drawY + ey2, eye, eye);
      }
    });
    if (lobbySnake.dying && lobbySnake.deathPieces && lobbySnake.deathIndex >= 0){
      const breaking = lobbySnake.deathPieces[lobbySnake.deathIndex];
      if (breaking){
        const bx = Math.floor(ox + breaking.x * cellW);
        const by = Math.floor(oy + breaking.y * cellH);
        const p = Math.max(2, Math.floor(Math.min(cellW, cellH) * .15));
        ctx.fillStyle = "rgba(103,217,87,.45)";
        ctx.fillRect(bx + p * 2, by + Math.floor(cellH / 2), Math.max(2, Math.floor(cellW) - p * 4), 2);
      }
    }
  }

  function setGameChatVisible(on){
    const box = $("onlineGameChat");
    if (box){
      box.style.display = on ? "block" : "none";
      box.setAttribute("aria-hidden", on ? "false" : "true");
    }
    try{
      if (on) document.body.setAttribute("data-online-game-chat", "1");
      else document.body.removeAttribute("data-online-game-chat");
    }catch(_){}
  }
  function show(el){ if(el){ el.style.display = "flex"; el.setAttribute("aria-hidden","false"); } }
  function hide(el){ if(el){ el.style.display = "none"; el.setAttribute("aria-hidden","true"); } }
  function setStatus(id, msg, err){
    if (id === "onlineJoinStatus"){
      const elJoin = $(id);
      if (elJoin){
        elJoin.textContent = "";
        elJoin.classList.remove("error");
      }
      if (msg) onlineToast(msg, !!err);
      return;
    }
    if (id === "onlineHomeStatus"){
      if (err && msg) try{ console.warn("[online]", msg); }catch(_){}
      return;
    }
    const el = $(id);
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("error", !!err);
  }
  function updateJoinCodeCounter(){
    try{
      const input = $("onlineJoinCodeInput");
      const counter = $("onlineJoinCodeCounter");
      if (!input || !counter) return;
      const max = parseInt(input.getAttribute("maxlength") || "6", 10) || 6;
      const len = Math.min(max, (input.value || "").length);
      counter.textContent = len + "/" + max;
      const ratio = max ? (len / max) : 0;
      const hue = Math.round(38 + ratio * 82);
      counter.style.color = "hsl(" + hue + " 90% 60%)";
      counter.style.opacity = len === 0 ? "0.75" : "0.95";
    }catch(_){}
  }
  function playJoinCodeInputSound(delta){
    try{
      if (delta > 0){
        const base = 640 + Math.random() * 120;
        const gain = 0.022 + Math.min(0.02, (delta - 1) * 0.004);
        if (window._gameBeep) window._gameBeep(base, 0.028, "square", gain);
        if (delta > 1 && window._gameBeep){
          setTimeout(function(){ try{ window._gameBeep(base * 1.12, 0.022, "triangle", 0.018); }catch(_){} }, 18);
        }
      } else if (delta < 0){
        if (window._gameBeep) window._gameBeep(360 + Math.random() * 50, 0.018, "square", 0.016);
      }
    }catch(_){}
  }
  function allMenuScreens(){
    return ["menuScreen","playerCountScreen","modeScreen","gameConfigScreen","mapScreen","coopModeSelectScreen","coopScreen","onlineHomeScreen","onlineJoinScreen","onlineLobbyScreen"];
  }
  function hideGameSurface(){
    ["wrap","coopOverlay","dialogLayer","dialogPrompt","shopModal","confirmModal","onlineLeaveConfirmModal","onlineLoadingModal","wavePickerModal"].forEach(function(id){
      const el = $(id);
      if (!el) return;
      el.style.display = "none";
      try{ el.setAttribute("aria-hidden","true"); }catch(_){}
    });
    try{
      const zw = $("zoomWrap");
      if (zw){
        zw.style.display = "none";
        zw.style.visibility = "hidden";
        zw.style.opacity = "0";
        zw.style.pointerEvents = "none";
      }
    }catch(_){}
    try{
      document.body.removeAttribute("data-shop-open");
      document.body.removeAttribute("data-esc-menu-open");
      if (window.__defendaSyncInGameModalMusicDuck) window.__defendaSyncInGameModalMusicDuck();
    }catch(_){}
  }
  function hideMenusExcept(id){
    if (id !== "onlineLobbyScreen"){
      stopLobbyAvatarLoops();
      resetLobbySnake();
    }
    allMenuScreens().forEach(function(screenId){
      const el = $(screenId);
      if (!el) return;
      if (screenId === id) show(el);
      else hide(el);
    });
    hideGameSurface();
  }
  function showMainMenu(){
    try{
      if (window.__defendaApi && typeof window.__defendaApi.showMenu === "function"){
        window.__defendaApi.showMenu();
        return;
      }
    }catch(_){}
    hideMenusExcept("menuScreen");
  }

  function hasFirebaseConfig(){
    const cfg = window.DEFENDA_ONLINE_FIREBASE_CONFIG || {};
    return !!(cfg.apiKey && cfg.databaseURL && cfg.projectId && cfg.appId);
  }

  async function ensureFirebase(){
    if (state.authReady) return true;
    if (!hasFirebaseConfig()){
      throw new Error("Firebase ainda não configurado em js/online-config.js.");
    }
    if (!window.firebase || !firebase.initializeApp){
      throw new Error("Firebase CDN não carregou. Verifique a conexão ou rode em ambiente com internet.");
    }
    if (!state.firebaseReady){
      try{
        if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(window.DEFENDA_ONLINE_FIREBASE_CONFIG);
        state.db = firebase.database();
        state.firebaseReady = true;
      }catch(e){
        throw new Error("Não foi possível inicializar o Firebase: " + (e && e.message ? e.message : e));
      }
    }
    if (!firebase.auth().currentUser){
      await firebase.auth().signInAnonymously();
    }
    state.authReady = true;
    return true;
  }

  function getProfile(){
    let acc = {};
    try{ acc = window._expSystem && window._expSystem.acctLoad ? window._expSystem.acctLoad() : {}; }catch(_){}
    const st = window.__defendaApi && window.__defendaApi.getState ? window.__defendaApi.getState() : {};
    return {
      id: state.uid,
      name: (acc.name || "").trim().slice(0,16) || "Cowboy",
      skin: Number.isFinite(Number(acc.equippedSkin)) ? (Number(acc.equippedSkin)|0) : (st.currentSkin || 0),
      level: Math.max(1, Number(acc.level) || 1),
      aura: Number.isFinite(Number(acc.equippedAura)) ? (Number(acc.equippedAura)|0) : -1,
      shot: Number.isFinite(Number(acc.equippedShot)) ? (Number(acc.equippedShot)|0) : -1,
      gold: Number.isFinite(Number(acc.equippedGold)) ? (Number(acc.equippedGold)|0) : -1,
      kill: Number.isFinite(Number(acc.equippedKill)) ? (Number(acc.equippedKill)|0) : 0,
      nameStyle: Number.isFinite(Number(acc.equippedName)) ? (Number(acc.equippedName)|0) : 0
    };
  }

  function isDifficultyUnlocked(difficulty){
    if (difficulty === "easy" || difficulty === "normal") return true;
    try{
      const exp = window._expSystem;
      if (exp && typeof exp.isDifficultyUnlocked === "function") return exp.isDifficultyUnlocked(difficulty);
    }catch(_){}
    return false;
  }

  function difficultyRequirementText(difficulty){
    if (difficulty === "hard") return "Conclua 100 ondas na dificuldade Normal";
    if (difficulty === "bizarre") return "Conclua 100 ondas na dificuldade Difícil";
    return "";
  }

  function playerPayload(slot, host){
    const p = getProfile();
    return Object.assign({}, p, {
      slot: slot,
      isHost: !!host,
      connected: true,
      joinedAt: now(),
      lastSeen: now()
    });
  }

  function defaultSettings(){
    return { mode:"infinite", style:"default", difficulty:"normal", map:"desert", sandboxLocked:true };
  }

  function roomIsExpired(room){
    return !!(room && room.updatedAt && now() - room.updatedAt > ROOM_TTL_MS);
  }

  async function isRoomAvailable(code){
    const snap = await state.db.ref("rooms/" + code).get();
    if (!snap.exists()) return true;
    const val = snap.val() || {};
    if (roomIsExpired(val) || val.status === "closed"){
      try{ await state.db.ref("rooms/" + code).remove(); }catch(_){}
      return true;
    }
    return false;
  }

  async function createRoom(){
    showOnlineLoading("Criando sala online");
    try{
    await ensureFirebase();
    setStatus("onlineHomeStatus", "Criando sala...", false);
    for (let i=0;i<18;i++){
      const code = String(Math.floor(100000 + Math.random() * 900000));
      if (!(await isRoomAvailable(code))) continue;
      state.roomCode = code;
      state.isHost = true;
      state.hostId = state.uid;
      state.slot = 1;
      state.roomRef = state.db.ref("rooms/" + code);
      state.lastChatSoundAt = 0;
      state.chatSoundReady = false;
      state.playerPresence = null;
      const room = {
        code: code,
        hostId: state.uid,
        status: "lobby",
        createdAt: now(),
        updatedAt: now(),
        settings: defaultSettings(),
        players: {}
      };
      room.players[state.uid] = playerPayload(1, true);
      try{ await state.roomRef.remove(); }catch(_){}
        await state.roomRef.set(room);
        state.roomRef.onDisconnect().remove();
        enterLobby();
        attachRoomListeners();
        onlineToast("Sala online criada com sucesso", false);
        return;
      }
    throw new Error("Não consegui gerar um código livre. Tente de novo.");
    }catch(e){
      hideOnlineLoading();
      throw e;
    }
  }

  function usedSlots(players){
    const taken = {};
    Object.keys(players || {}).forEach(function(id){
      const p = players[id];
      if (p && p.connected !== false && p.slot) taken[p.slot] = true;
    });
    return taken;
  }

  async function joinRoom(rawCode){
    await ensureFirebase();
    const code = String(rawCode || "").replace(/\D/g,"").slice(0,6);
    if (code.length !== 6) throw new Error("Digite um código de 6 dígitos.");
    setStatus("onlineHomeStatus", "Entrando...", false);
    const ref = state.db.ref("rooms/" + code);
    const snap = await ref.get();
    if (!snap.exists()) throw new Error("Sala não encontrada.");
    const room = snap.val() || {};
    if (roomIsExpired(room)){
      try{ await ref.remove(); }catch(_){}
      throw new Error("Essa sala expirou.");
    }
    if (room.status === "closed") throw new Error("Essa sala foi fechada.");
    if (room.status !== "lobby") throw new Error("Essa sala já está em partida.");
    const taken = usedSlots(room.players || {});
    let slot = 0;
    for (let i=1;i<=MAX_PLAYERS;i++){ if (!taken[i]){ slot = i; break; } }
    if (!slot) throw new Error("Sala cheia.");
    showOnlineLoading("Entrando na sala online");
    try{
    state.roomCode = code;
    state.isHost = false;
    state.hostId = room.hostId;
    state.slot = slot;
    state.roomRef = ref;
    state.lastChatSoundAt = 0;
    state.chatSoundReady = false;
    state.playerPresence = null;
    await ref.child("players/" + state.uid).set(playerPayload(slot, false));
    ref.child("players/" + state.uid).onDisconnect().update({ connected:false, lastSeen: firebase.database.ServerValue.TIMESTAMP });
    enterLobby();
    attachRoomListeners();
    await connectToHost();
    onlineToast("Entrou no lobby online com sucesso", false);
    }catch(e){
      hideOnlineLoading();
      throw e;
    }
  }

  function detachRoomListeners(){
    try{
      if (state.typingClearTimer){
        clearTimeout(state.typingClearTimer);
        state.typingClearTimer = null;
      }
      if (state.roomRef) state.roomRef.child("typing/" + state.uid).remove().catch(function(){});
    }catch(_){}
    state.unsub.forEach(function(fn){ try{ fn(); }catch(_){} });
    state.unsub = [];
    renderTyping({});
  }

  function attachRoomListeners(){
    detachRoomListeners();
    const roomRef = state.roomRef;
    if (!roomRef) return;
    const roomCb = function(snap){
      state.room = snap.val();
      if (!state.room || state.room.status === "closed"){
        leaveRoom(false);
        setStatus("onlineHomeStatus", "A sala foi fechada pelo host.", true);
        hideMenusExcept("onlineHomeScreen");
        return;
      }
      syncPlayerPresenceMessages((state.room && state.room.players) || {});
      syncRunningPlayersFromRoom();
      const me = state.room.players && state.room.players[state.uid];
      if (!state.isHost && !me){
        leaveRoom(false);
        setStatus("onlineHomeStatus", "Você foi expulso da sala.", true);
        hideMenusExcept("onlineHomeScreen");
        return;
      }
      renderLobby();
      if (!state.isHost && state.running && state.room.status === "lobby"){
        returnToLobby(false).catch(function(){});
        return;
      }
      if (!state.isHost && state.room.status === "starting"){
        startClientGame(state.room.startPayload || {});
      }
    };
    roomRef.on("value", roomCb);
    state.unsub.push(function(){ roomRef.off("value", roomCb); });

    const chatRef = roomRef.child("chat").limitToLast(CHAT_LIMIT);
    const chatCb = function(snap){ renderChat(snap.val() || {}); };
    chatRef.on("value", chatCb);
    state.unsub.push(function(){ chatRef.off("value", chatCb); });

    const typingRef = roomRef.child("typing");
    const typingCb = function(snap){ renderTyping(snap.val() || {}); };
    typingRef.on("value", typingCb);
    state.unsub.push(function(){ typingRef.off("value", typingCb); renderTyping({}); });

    const sigRef = roomRef.child("signals/" + state.uid);
    const sigCb = function(snap){
      snap.forEach(function(child){
        const msg = child.val();
        handleSignal(msg);
        child.ref.remove().catch(function(){});
      });
    };
    sigRef.on("value", sigCb);
    state.unsub.push(function(){ sigRef.off("value", sigCb); });

    const heartbeat = setInterval(function(){
      if (!state.roomRef || !state.roomCode) return;
      const upd = { updatedAt: now() };
      upd["players/" + state.uid + "/lastSeen"] = now();
      upd["players/" + state.uid + "/connected"] = true;
      state.roomRef.update(upd).catch(function(){});
    }, 10000);
    state.unsub.push(function(){ clearInterval(heartbeat); });
  }

  function snapshotPlayerPresence(players){
    const out = {};
    Object.keys(players || {}).forEach(function(id){
      const p = players[id];
      if (!p) return;
      out[id] = {
        connected: p.connected !== false,
        name: p.name || ("Cowboy " + (p.slot || ""))
      };
    });
    return out;
  }

  function syncPlayerPresenceMessages(players){
    const next = snapshotPlayerPresence(players);
    const prev = state.playerPresence;
    state.playerPresence = next;
    if (!prev || !state.isHost || !state.roomRef) return;
    Object.keys(next).forEach(function(id){
      if (id === state.uid) return;
      const before = prev[id];
      const after = next[id];
      if (!before && after.connected){
        pushSystemChat(after.name + " se conectou!", "connect");
        return;
      }
      if (before && before.connected !== after.connected){
        pushSystemChat(after.name + (after.connected ? " se conectou!" : " se desconectou."), after.connected ? "connect" : "disconnect");
      }
    });
    Object.keys(prev).forEach(function(id){
      if (id === state.uid || next[id] || !prev[id].connected) return;
      pushSystemChat(prev[id].name + " se desconectou.", "disconnect");
    });
  }

  async function updateLocalCosmeticsFromProfile(){
    if (!state.roomRef || !state.uid) return;
    const p = getProfile();
    const patch = {
      skin:p.skin,
      aura:p.aura,
      shot:p.shot,
      gold:p.gold,
      kill:p.kill,
      nameStyle:p.nameStyle,
      level:p.level,
      updatedAt:now()
    };
    try{
      await state.roomRef.child("players/" + state.uid).update(patch);
    }catch(_){}
    try{
      if (state.room && state.room.players && state.room.players[state.uid]){
        Object.assign(state.room.players[state.uid], patch);
      }
    }catch(_){}
    try{ renderLobby(); }catch(_){}
  }

  function syncRunningPlayersFromRoom(){
    if (!state.running || !state.room || !state.room.players) return;
    try{
      const api = window.__defendaApi;
      if (api && api.syncOnlineRoomPlayers) api.syncOnlineRoomPlayers(state.room.players || {});
    }catch(_){}
    if (!state.isHost) return;
    const players = state.room.players || {};
    Array.from(state.channelById.keys()).forEach(function(id){
      const p = players[id];
      if (p && p.connected !== false) return;
      try{ const ch = state.channelById.get(id); if (ch) ch.close(); }catch(_){}
      try{ const ch = state.inputChannelById.get(id); if (ch) ch.close(); }catch(_){}
      try{ const ch = state.snapshotChannelById.get(id); if (ch) ch.close(); }catch(_){}
      try{ const pc = state.peerById.get(id); if (pc) pc.close(); }catch(_){}
      state.channelById.delete(id);
      state.inputChannelById.delete(id);
      state.snapshotChannelById.delete(id);
      state.peerById.delete(id);
    });
  }

  function stopLocalOnlineGame(){
    try{
      const api = window.__defendaApi;
      if (api && api.stopOnlineGameToLobby) api.stopOnlineGameToLobby();
    }catch(_){}
  }

  async function leaveRoom(removeHost){
    hideOnlineLoading();
    stopLobbyAvatarLoops();
    resetLobbySnake();
    setGameChatVisible(false);
    const wasRunning = !!state.running;
    if (wasRunning) stopLocalOnlineGame();
    detachRoomListeners();
    closePeers();
    const ref = state.roomRef;
    const wasHost = state.isHost;
    if (ref){
      try{
        if (wasHost && removeHost !== false) await ref.remove();
        else await ref.child("players/" + state.uid).update({ connected:false, lastSeen: now() });
      }catch(_){}
    }
    state.roomCode = null; state.room = null; state.isHost = false; state.hostId = null; state.slot = 0; state.roomRef = null; state.running = false; state.runId = null; state.lastChatSoundAt = 0; state.chatSoundReady = false; state.playerPresence = null;
  }

  async function kickPlayer(playerId){
    if (!state.isHost || !state.roomRef || !playerId || playerId === state.uid) return;
    await state.roomRef.child("players/" + playerId).remove();
    try{ await state.roomRef.child("signals/" + playerId).remove(); }catch(_){}
  }

  function openLeaveConfirm(){
    const modal = $("onlineLeaveConfirmModal");
    const text = $("onlineLeaveConfirmText");
    if (text) text.textContent = state.isHost ? "A sala será fechada para todos os jogadores." : "Você sairá da sala atual.";
    if (modal){
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
    }
  }

  function closeLeaveConfirm(){
    const modal = $("onlineLeaveConfirmModal");
    if (modal){
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }
  }

  async function confirmLeaveToOnlineHome(){
    const wasHost = state.isHost;
    closeLeaveConfirm();
    await leaveRoom(true);
    hideMenusExcept("onlineHomeScreen");
    setStatus("onlineHomeStatus", wasHost ? "Sala fechada." : "", false);
  }

  function enterLobby(){
    hideOnlineLoading();
    hideMenusExcept("onlineLobbyScreen");
    resetLobbySnake();
    $("onlineRoomCode").textContent = state.roomCode || "------";
    setStatus("onlineLobbyStatus", "Aguardando jogadores...", false);
    renderLobby();
  }

  function renderLobby(){
    const slots = $("onlineLobbySlots");
    if (!slots) return;
    const playersBySlot = {};
    const players = (state.room && state.room.players) || {};
    Object.keys(players).forEach(function(id){
      const p = players[id];
      if (p && p.slot && p.connected !== false) playersBySlot[p.slot] = Object.assign({ id:id }, p);
    });
    stopLobbyAvatarLoops();
    slots.innerHTML = "";
    for (let i=1;i<=MAX_PLAYERS;i++){
      const p = playersBySlot[i];
      const card = document.createElement("div");
      card.className = "online-slot" + (p ? " filled" : " empty") + (p && p.isHost ? " host" : "") + (p && p.connected === false ? " disconnected" : "");
      const info = document.createElement("div");
      info.className = "online-slot-info";
      if (p){
        const canvas = document.createElement("canvas");
        canvas.width = 64; canvas.height = 64; canvas.className = "online-avatar";
        drawAvatar(canvas, p.skin, p.aura);
        info.innerHTML = '<div class="online-slot-name">' + decoratedNameHtml(p.name || ("Cowboy " + i), p.nameStyle, "online-slot-name-text") + '</div>' +
          '<div class="online-slot-level">N&iacute;vel ' + esc(Math.max(1, Number(p.level) || 1)) + '</div>' +
          '<div class="online-slot-meta ' + (p.connected === false ? "" : "connected") + '">' + (p.connected === false ? "Desconectado" : "Conectado") + '</div>' +
          '<div class="online-slot-role"><span>' + (p.isHost ? "Anfitri&atilde;o" : "Jogador " + i) + '</span></div>';
        card.appendChild(canvas);
        if (p.id === state.uid){
          const styleBtn = document.createElement("button");
          styleBtn.className = "online-slot-style-btn";
          styleBtn.type = "button";
          styleBtn.textContent = "👕";
          styleBtn.setAttribute("aria-label", "Trocar cosméticos");
          styleBtn.setAttribute("data-game-tooltip", "Cosméticos");
          styleBtn.innerHTML = "&#128085;";
          styleBtn.addEventListener("click", function(e){
            e.preventDefault();
            e.stopPropagation();
            try{
              if (window.__defendaApi && window.__defendaApi.openOnlineProfileOverlay) window.__defendaApi.openOnlineProfileOverlay();
            }catch(_){}
          });
          card.appendChild(styleBtn);
        }
        if (state.isHost && !p.isHost && i > 1 && p.id && p.id !== state.uid){
          const kick = document.createElement("button");
          kick.className = "online-kick-btn";
          kick.type = "button";
          kick.textContent = "🔨";
          kick.setAttribute("aria-label", "Expulsar");
          kick.setAttribute("data-game-tooltip", "Expulsar");
          kick.setAttribute("data-kick-player-id", p.id);
          card.appendChild(kick);
        }
      } else {
        info.innerHTML = '<div class="online-slot-name">Vazio</div><div class="online-slot-meta">Aguardando jogador</div>';
      }
      card.appendChild(info);
      slots.appendChild(card);
    }
    const configTitle = $("onlineConfigTitle");
    if (configTitle) configTitle.textContent = state.isHost ? "Configurar Jogo" : "Configurar Jogo (apenas Anfitrião)";
    const cfg = (state.room && state.room.settings) || defaultSettings();
    document.querySelectorAll("[data-online-map]").forEach(function(btn){
      const on = btn.getAttribute("data-online-map") === (cfg.map || "desert");
      btn.classList.toggle("selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.disabled = !state.isHost;
    });
    document.querySelectorAll("[data-online-difficulty]").forEach(function(btn){
      const key = btn.getAttribute("data-online-difficulty");
      const on = key === (cfg.difficulty || "normal");
      const locked = !isDifficultyUnlocked(key);
      btn.classList.toggle("selected", on);
      btn.classList.toggle("difficulty-locked", locked);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute("aria-disabled", (!state.isHost || locked) ? "true" : "false");
      if (locked) btn.setAttribute("data-game-tooltip", difficultyRequirementText(key));
      else btn.removeAttribute("data-game-tooltip");
      btn.disabled = !state.isHost;
    });
    document.querySelectorAll("[data-online-style]").forEach(function(btn){
      const key = btn.getAttribute("data-online-style");
      const currentStyle = cfg.style === "sandbox" ? "default" : (cfg.style || "default");
      const on = key === currentStyle;
      const sandboxLocked = key === "sandbox";
      btn.classList.toggle("selected", on);
      btn.classList.toggle("sandbox-locked", sandboxLocked);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute("aria-disabled", (!state.isHost || sandboxLocked) ? "true" : "false");
      if (sandboxLocked) btn.setAttribute("data-game-tooltip", "Indisponível no momento");
      else btn.removeAttribute("data-game-tooltip");
      btn.disabled = !state.isHost && !sandboxLocked;
    });
    const count = Object.keys(players).filter(function(id){ return players[id] && players[id].connected !== false; }).length;
    const start = $("onlineStartGameBtn");
    if (start){
      const wrap = start.parentElement;
      if (wrap) wrap.style.display = "flex";
      const canStart = !!(state.isHost && count >= 2 && !state.running);
      start.disabled = !canStart;
      start.classList.toggle("btn-play-gold", canStart);
      start.textContent = state.isHost ? (count < 2 ? "Aguardando Jogadores" : "Iniciar Jogo") : "Aguardando Anfitrião";
    }
  }

  function drawAvatarBase(ctx, skinIndex){
    try{
      const skins = window.__DEFENDA_PLAYER_SKINS || [];
      const draw = window.__DEFENDA_DRAW_SKIN_SPRITE;
      if (draw && skins[skinIndex || 0]){ draw(ctx, skins[skinIndex || 0], 0, 0, 64); return; }
    }catch(_){}
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(12,48,40,8);
    ctx.fillStyle = "#8b5a2b"; ctx.fillRect(16,18,32,32);
    ctx.fillStyle = "#2a1406"; ctx.fillRect(8,12,48,10); ctx.fillRect(18,4,28,14);
    ctx.fillStyle = "#fff"; ctx.fillRect(24,30,6,4); ctx.fillRect(36,30,6,4);
  }

  function drawAuraParticle(ctx, p){
    ctx.globalAlpha = Math.max(0, Math.min(1, (p.life || 1) / (p.max || 1)));
    ctx.fillStyle = p.color || "#f3d23b";
    const s = Math.max(2, p.size || 2);
    if (p._type === "circle" || p._circle){
      ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillRect(p.x - s/2, p.y - s/2, s, s);
    }
  }

  function stopLobbyAvatarLoop(canvas){
    const obj = lobbyAvatarLoops.get(canvas);
    if (obj){
      obj.active = false;
      if (obj.raf) cancelAnimationFrame(obj.raf);
    }
    lobbyAvatarLoops.delete(canvas);
  }

  function stopLobbyAvatarLoops(){
    lobbyAvatarLoops.forEach(function(obj, canvas){
      if (obj){
        obj.active = false;
        if (obj.raf) cancelAnimationFrame(obj.raf);
      }
      lobbyAvatarLoops.delete(canvas);
    });
  }

  function startLobbyAvatarAura(canvas, skinIndex, auraId){
    stopLobbyAvatarLoop(canvas);
    if (!(Number(auraId) >= 0) || !window._spawnAuraParticles) return;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const W = canvas.width || 64;
    const H = canvas.height || 64;
    const scale = Math.max(1, W / 32);
    const cx = W / 2;
    const cy = H / 2 + 4;
    let particles = [];
    let t = 0;
    let last = null;
    let acc = 0;
    const obj = { active:true, raf:null };
    lobbyAvatarLoops.set(canvas, obj);

    function frame(ts){
      if (!obj.active) return;
      if (!canvas.isConnected){ stopLobbyAvatarLoop(canvas); return; }
      if (last === null) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      t += dt;
      acc += dt;
      const interval = (Number(auraId)|0) === 25 ? 0.045 : ((Number(auraId)|0) === 40 ? 0.04 : ((Number(auraId)|0) === 42 ? 0.18 : ((Number(auraId)|0) === 39 ? 0.16 : ([1,6,11,14,26,43].indexOf(Number(auraId)|0) >= 0 ? 0.13 : 0.09))));
      if (acc >= interval){
        acc = 0;
        const next = window._spawnAuraParticles(Number(auraId)|0, cx, cy, t) || [];
        for (let i=0;i<next.length;i++){
          const p = next[i];
          p.x = cx + (p.x - cx) * scale;
          p.y = cy + (p.y - cy) * scale;
          p.vx = (p.vx || 0) * scale;
          p.vy = (p.vy || 0) * scale;
          p.grav = (p.grav || 0) * scale;
          p.size = (p.size || 2) * scale;
          if (p.wobble) p.wobble *= scale;
          if (p.grow) p.grow *= scale;
        }
        particles = particles.concat(next);
      }
      const keep = [];
      for (let i=0;i<particles.length;i++){
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) continue;
        p.vy = (p.vy || 0) + (p.grav || 0) * dt;
        if (p.wobble){
          p._wobbleT = (p._wobbleT || 0) + dt;
          p.x += Math.sin((p._wobbleT * (p.wobbleSpeed || 5)) + (p.wobblePhase || 0)) * p.wobble * dt;
        }
        if (p.grow) p.size = (p.size || 2) + p.grow * dt;
        p.x += (p.vx || 0) * dt;
        p.y += (p.vy || 0) * dt;
        keep.push(p);
      }
      particles = keep;
      ctx.clearRect(0,0,W,H);
      ctx.globalAlpha = 1;
      drawAvatarBase(ctx, skinIndex);
      for (let i=0;i<particles.length;i++) drawAuraParticle(ctx, particles[i]);
      ctx.globalAlpha = 1;
      obj.raf = requestAnimationFrame(frame);
    }
    obj.raf = requestAnimationFrame(frame);
  }

  function drawAvatar(canvas, skinIndex, auraId){
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0,0,64,64);
    drawAvatarBase(ctx, skinIndex);
    startLobbyAvatarAura(canvas, skinIndex, auraId);
  }

  function renderChat(messages){
    const list = Object.keys(messages).map(function(id){ return messages[id]; }).filter(Boolean).sort(function(a,b){ return (a.at||0)-(b.at||0); }).slice(-CHAT_LIMIT);
    const latestAt = list.reduce(function(max, m){ return Math.max(max, Number(m.at) || 0); }, 0);
    if (!state.chatSoundReady){
      state.chatSoundReady = true;
      state.lastChatSoundAt = latestAt;
    } else {
      const hasIncoming = list.some(function(m){
        const at = Number(m.at) || 0;
        return at > (state.lastChatSoundAt || 0) && m.from && m.from !== state.uid;
      });
      if (hasIncoming) playIncomingChatSound();
      if (latestAt > (state.lastChatSoundAt || 0)) state.lastChatSoundAt = latestAt;
    }
    const html = list.map(function(m){
      if (m.system){
        const kind = m.kind === "disconnect" ? "disconnect" : (m.kind === "path-block" ? "path-block" : "connect");
        return '<div class="online-chat-msg online-chat-system ' + kind + '">' + esc(m.text || "") + '</div>';
      }
      return '<div class="online-chat-msg">' + decoratedNameHtml(m.name || "Cowboy", m.nameStyle, "online-chat-name") + ': ' + esc(m.text || "") + '</div>';
    }).join("");
    ["onlineChatLog","onlineGameChatLog"].forEach(function(id){
      const log = $(id);
      if (!log) return;
      log.innerHTML = html;
      log.scrollTop = log.scrollHeight;
    });
  }

  function pushSystemChat(text, kind){
    if (!state.roomRef || !text) return;
    const safeKind = kind === "disconnect" ? "disconnect" : (kind === "path-block" ? "path-block" : "connect");
    state.roomRef.child("chat").push({
      system:true,
      kind:safeKind,
      text:String(text).slice(0, CHAT_MAX),
      at:now()
    }).then(trimChat).catch(function(){});
  }

  async function sendChat(text){
    const clean = sanitizeChat(text);
    if (!clean || !state.roomRef) return;
    setTypingActive(false);
    const profile = getProfile();
    await state.roomRef.child("chat").push({ from:state.uid, name:profile.name, nameStyle:profile.nameStyle || 0, text:clean, at:now() });
    await trimChat();
  }

  async function trimChat(){
    try{
      const snap = await state.roomRef.child("chat").orderByChild("at").get();
      const keys = [];
      snap.forEach(function(child){ keys.push(child.key); });
      const extra = keys.length - CHAT_LIMIT;
      if (extra > 0){
        const upd = {};
        keys.slice(0, extra).forEach(function(k){ upd[k] = null; });
        await state.roomRef.child("chat").update(upd);
      }
    }catch(_){}
  }

  function sendSignal(to, data){
    if (!state.roomRef || !to || !data) return Promise.resolve();
    data.from = state.uid;
    data.at = now();
    return state.roomRef.child("signals/" + to).push(data);
  }

  function createPeer(remoteId, hostSide){
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pc.onicecandidate = function(ev){
      if (ev.candidate) sendSignal(remoteId, { type:"candidate", candidate: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate });
    };
    pc.onconnectionstatechange = function(){
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected"){
        setStatus("onlineLobbyStatus", "Conexão P2P instável. Sem TURN, algumas redes podem falhar.", true);
      }
    };
    if (hostSide){
      pc.ondatachannel = function(ev){ setupChannel(remoteId, ev.channel); };
      state.peerById.set(remoteId, pc);
    } else {
      state.hostPeer = pc;
    }
    return pc;
  }

  function channelKind(ch){
    const label = String((ch && ch.label) || "control").toLowerCase();
    if (label === "input") return "input";
    if (label === "snapshot" || label === "snapshots") return "snapshot";
    return "control";
  }

  function setupChannel(remoteId, ch){
    const kind = channelKind(ch);
    ch.onopen = function(){
      if (kind === "control"){
        setStatus("onlineLobbyStatus", "P2P conectado.", false);
        ch.send(JSON.stringify({ t:"hello", id:state.uid, profile:getProfile() }));
      }
    };
    ch.onmessage = function(ev){ handleRtcMessage(remoteId, ev.data); };
    ch.onclose = function(){ if (kind === "control") setStatus("onlineLobbyStatus", "Canal P2P fechado.", true); };
    if (state.isHost){
      if (kind === "input") state.inputChannelById.set(remoteId, ch);
      else if (kind === "snapshot") state.snapshotChannelById.set(remoteId, ch);
      else state.channelById.set(remoteId, ch);
    } else {
      if (kind === "input") state.hostInputChannel = ch;
      else if (kind === "snapshot") state.hostSnapshotChannel = ch;
      else {
        state.hostControlChannel = ch;
        state.hostChannel = ch;
      }
    }
  }

  async function connectToHost(){
    const pc = createPeer(state.hostId, false);
    setupChannel(state.hostId, pc.createDataChannel("control", { ordered:true }));
    setupChannel(state.hostId, pc.createDataChannel("input", { ordered:false, maxRetransmits:0 }));
    setupChannel(state.hostId, pc.createDataChannel("snapshot", { ordered:false, maxRetransmits:0 }));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal(state.hostId, { type:"offer", sdp: offer });
  }

  async function handleSignal(msg){
    if (!msg || !msg.from || msg.from === state.uid) return;
    if (state.isHost && msg.type === "offer"){
      const pc = createPeer(msg.from, true);
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      await sendSignal(msg.from, { type:"answer", sdp: ans });
      return;
    }
    const pc = state.isHost ? state.peerById.get(msg.from) : state.hostPeer;
    if (!pc) return;
    if (msg.type === "answer"){
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    } else if (msg.type === "candidate" && msg.candidate){
      try{ await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); }catch(_){}
    }
  }

  function handleRtcMessage(remoteId, raw){
    let msg = null;
    try{ msg = JSON.parse(raw); }catch(_){ return; }
    if (!msg || !msg.t) return;
    if (state.isHost){
      if (msg.t === "input"){
        if (msg.runId && msg.runId !== state.runId) return;
        const api = window.__defendaApi;
        if (api && api.setOnlineInput) api.setOnlineInput(remoteId, msg.input || {});
      }
      if (msg.t === "action"){
        if (msg.runId && msg.runId !== state.runId) return;
        const api2 = window.__defendaApi;
        if (api2 && api2.handleOnlineAction) api2.handleOnlineAction(remoteId, msg.action || {});
      }
      return;
    }
    if (msg.t === "start"){
      startClientGame(msg.payload || {});
    } else if (msg.t === "snapshot"){
      if (msg.runId && msg.runId !== state.runId) return;
      const api3 = window.__defendaApi;
      if (api3 && api3.applyOnlineSnapshot) api3.applyOnlineSnapshot(msg.snapshot);
    } else if (msg.t === "event"){
      if (msg.runId && state.runId && msg.runId !== state.runId && !(msg.event && msg.event.type === "return-lobby")) return;
      if (msg.event && msg.event.type === "online-continue"){
        state.running = true;
        state.endedRunId = null;
        state.lastInputRaw = "";
        state.lastInputSent = 0;
        runClientInputLoop(msg.runId || state.runId);
        try{
          if (typeof window.__defendaHandleOnlineContinueEvent === "function"){
            window.__defendaHandleOnlineContinueEvent(msg.event);
          }
        }catch(_){}
      }
      const api4 = window.__defendaApi;
      if (api4 && api4.handleOnlineEvent) api4.handleOnlineEvent(msg.event || {});
      if (msg.event && msg.event.type === "return-lobby"){
        returnToLobby(false).catch(function(){});
      }
    }
  }

  function broadcast(msg){
    const raw = JSON.stringify(msg);
    state.channelById.forEach(function(ch){
      try{ if (ch.readyState === "open") ch.send(raw); }catch(_){}
    });
  }

  function broadcastSnapshot(msg){
    const raw = JSON.stringify(msg);
    state.snapshotChannelById.forEach(function(ch, id){
      try{
        if (ch.readyState !== "open") return;
        if ((ch.bufferedAmount || 0) > SNAPSHOT_BUFFER_LIMIT) return;
        ch.send(raw);
      }catch(_){}
    });
    state.channelById.forEach(function(ch, id){
      try{
        const snapCh = state.snapshotChannelById.get(id);
        if (snapCh && snapCh.readyState === "open") return;
        if (ch.readyState !== "open") return;
        if ((ch.bufferedAmount || 0) > SNAPSHOT_BUFFER_LIMIT) return;
        ch.send(raw);
      }catch(_){}
    });
  }

  function closePeers(){
    state.channelById.forEach(function(ch){ try{ ch.close(); }catch(_){} });
    state.inputChannelById.forEach(function(ch){ try{ ch.close(); }catch(_){} });
    state.snapshotChannelById.forEach(function(ch){ try{ ch.close(); }catch(_){} });
    state.peerById.forEach(function(pc){ try{ pc.close(); }catch(_){} });
    try{ if (state.hostChannel) state.hostChannel.close(); }catch(_){}
    try{ if (state.hostControlChannel) state.hostControlChannel.close(); }catch(_){}
    try{ if (state.hostInputChannel) state.hostInputChannel.close(); }catch(_){}
    try{ if (state.hostSnapshotChannel) state.hostSnapshotChannel.close(); }catch(_){}
    try{ if (state.hostPeer) state.hostPeer.close(); }catch(_){}
    state.channelById.clear();
    state.inputChannelById.clear();
    state.snapshotChannelById.clear();
    state.peerById.clear();
    state.hostPeer = null;
    state.hostChannel = null;
    state.hostControlChannel = null;
    state.hostInputChannel = null;
    state.hostSnapshotChannel = null;
    state.lastInputRaw = "";
  }

  async function updateSettings(partial){
    if (!state.isHost || !state.roomRef) return;
    const cur = (state.room && state.room.settings) || defaultSettings();
    const next = Object.assign({}, cur, partial || {}, { mode:"infinite", sandboxLocked:true });
    if (next.style === "sandbox") next.style = "default";
    if (!isDifficultyUnlocked(next.difficulty)) next.difficulty = "normal";
    await state.roomRef.update({ settings:next, updatedAt:now() });
  }

  async function startHostGame(){
    if (!state.isHost || !state.roomRef) return;
    resetLobbySnake();
    let players = (state.room && state.room.players) || {};
    try{
      const ps = await state.roomRef.child("players").get();
      if (ps.exists()) players = ps.val() || {};
    }catch(_){}
    const connected = Object.keys(players).filter(function(id){ return players[id] && players[id].connected !== false; });
    if (connected.length < 2) return;
    const runId = String(now()) + "-" + Math.random().toString(36).slice(2, 8);
    const settings = Object.assign({}, defaultSettings(), (state.room && state.room.settings) || {});
    settings.sandboxLocked = true;
    if (settings.style === "sandbox") settings.style = "default";
    if (!isDifficultyUnlocked(settings.difficulty)) settings.difficulty = "normal";
    const payload = {
      roomCode: state.roomCode,
      hostId: state.uid,
      localId: state.uid,
      runId: runId,
      settings: settings,
      players: players,
      startedAt: now()
    };
    state.runId = runId;
    state.running = true;
    state.lastMapSnapshotAt = 0;
    state.lastMapSnapshotSig = "";
    state.lastMetaSnapshotAt = 0;
    state.mapSnapshotBurstUntil = now() + 1500;
    const api = window.__defendaApi;
    if (api && api.startOnlineHost) api.startOnlineHost(payload);
    setGameChatVisible(true);
    broadcast({ t:"start", runId:runId, payload: payload });
    runHostSnapshotLoop(runId);
    await state.roomRef.update({ status:"starting", startPayload:payload, updatedAt:now() });
  }

  async function restartHostGame(){
    if (!state.isHost || !state.roomRef) return;
    const oldRunId = state.runId;
    state.running = false;
    state.runId = null;
    state.startingRunId = null;
    if (oldRunId) state.endedRunId = oldRunId;
    state.lastInputRaw = "";
    state.lastInputSent = 0;
    state.lastMapSnapshotAt = 0;
    state.lastMapSnapshotSig = "";
    state.lastMetaSnapshotAt = 0;
    state.mapSnapshotBurstUntil = 0;
    try{
      const api = window.__defendaApi;
      if (api && api.stopOnlineGameToLobby) api.stopOnlineGameToLobby();
    }catch(_){}
    try{ await state.roomRef.update({ status:"restarting", startPayload:null, updatedAt:now() }); }catch(_){}
    return startHostGame();
  }

  async function startClientGame(payload){
    resetLobbySnake();
    payload = payload || {};
    const runId = payload.runId || String(payload.startedAt || now());
    if (runId && state.endedRunId === runId) return;
    if (runId && state.startingRunId === runId) return;
    if (state.running && state.runId === runId) return;
    state.startingRunId = runId;
    if (state.running && state.runId !== runId){
      try{
        const api0 = window.__defendaApi;
        if (api0 && api0.stopOnlineGameToLobby) api0.stopOnlineGameToLobby();
      }catch(_){}
      state.running = false;
    }
    if (!state.hostChannel || state.hostChannel.readyState !== "open"){
      try{ await connectToHost(); }catch(_){}
    }
    state.runId = runId;
    state.running = true;
    payload = Object.assign({}, payload, { localId: state.uid, runId:runId });
    try{
      const api = window.__defendaApi;
      if (api && api.startOnlineClient) api.startOnlineClient(payload);
      setGameChatVisible(true);
      runClientInputLoop(runId);
    }finally{
      state.startingRunId = null;
    }
  }

  function runHostSnapshotLoop(runId){
    if (!state.isHost || !state.running || state.runId !== runId) return;
    const api = window.__defendaApi;
    if (api && api.getOnlineSnapshot){
      const t = now();
      const mapSig = api.getOnlineMapSignature ? api.getOnlineMapSignature() : "";
      const includeMap = !state.lastMapSnapshotAt || t < state.mapSnapshotBurstUntil || mapSig !== state.lastMapSnapshotSig || (t - state.lastMapSnapshotAt) >= MAP_RESYNC_MS;
      if (includeMap){
        state.lastMapSnapshotAt = t;
        state.lastMapSnapshotSig = mapSig;
      }
      const includeMeta = includeMap || !state.lastMetaSnapshotAt || (t - state.lastMetaSnapshotAt) >= 1000;
      if (includeMeta) state.lastMetaSnapshotAt = t;
      const snapshot = api.getOnlineSnapshot({ includeMap: includeMap, includeMeta:includeMeta, runId:runId });
      broadcastSnapshot({ t:"snapshot", runId:runId, snapshot: snapshot });
      if (snapshot && snapshot.running === false){
        state.running = false;
        state.endedRunId = runId;
        try{ if (state.roomRef) state.roomRef.update({ status:"results", updatedAt:now() }); }catch(_){}
        return;
      }
    }
    setTimeout(function(){ runHostSnapshotLoop(runId); }, HOST_SNAPSHOT_MS);
  }

  function continueHostGame(){
    if (!state.isHost || !state.runId) return false;
    state.running = true;
    state.endedRunId = null;
    state.lastMapSnapshotAt = 0;
    state.lastMapSnapshotSig = "";
    state.lastMetaSnapshotAt = 0;
    state.mapSnapshotBurstUntil = now() + 1200;
    let continueSeq = 0;
    try{
      const api = window.__defendaApi;
      const gameState = api && api.getState ? api.getState() : null;
      continueSeq = gameState ? (Number(gameState.onlineContinueSeq) || 0) : 0;
    }catch(_){}
    try{ broadcast({ t:"event", runId:state.runId, event:{ type:"online-continue", at:now(), continueSeq:continueSeq } }); }catch(_){}
    runHostSnapshotLoop(state.runId);
    try{ if (state.roomRef) state.roomRef.update({ status:"playing", updatedAt:now() }); }catch(_){}
    return true;
  }

  function collectInput(){
    const api = window.__defendaApi;
    if (api && api.getLocalInputSnapshot) return api.getLocalInputSnapshot();
    const st = api && api.getState ? api.getState() : null;
    return st && st.keysHeld ? Object.assign({}, st.keysHeld) : {};
  }

  function sendInputPacket(runId, force){
    runId = runId || state.runId;
    if (state.isHost || !state.running || state.runId !== runId) return false;
    try{
      const ch = state.hostInputChannel || state.hostChannel || state.hostControlChannel;
      if (!ch || ch.readyState !== "open") return false;
      const input = collectInput();
      const rawInput = JSON.stringify(input || {});
      const t = now();
      if (!force && rawInput === state.lastInputRaw && (t - (state.lastInputSent || 0)) < CLIENT_INPUT_KEEPALIVE_MS) return false;
      state.lastInputRaw = rawInput;
      ch.send(JSON.stringify({ t:"input", runId:runId, input:input, at:t }));
      state.lastInputSent = t;
      return true;
    }catch(_){}
    return false;
  }

  function runClientInputLoop(runId){
    if (state.isHost || !state.running || state.runId !== runId) return;
    sendInputPacket(runId, false);
    setTimeout(function(){ runClientInputLoop(runId); }, CLIENT_INPUT_MS);
  }

  async function returnToLobby(hostInitiated){
    const oldRunId = state.runId;
    setGameChatVisible(false);
    state.running = false;
    state.runId = null;
    if (oldRunId) state.endedRunId = oldRunId;
    if (state.isHost && hostInitiated !== false){
      broadcast({ t:"event", runId:oldRunId, event:{ type:"return-lobby" } });
    }
    closePeers();
    try{
      const api = window.__defendaApi;
      if (api && api.stopOnlineGameToLobby) api.stopOnlineGameToLobby();
    }catch(_){}
    if (state.isHost && hostInitiated !== false && state.roomRef){
      try{ await state.roomRef.update({ status:"lobby", startPayload:null, updatedAt:now() }); }catch(_){}
    }
    enterLobby();
  }

  function wireUi(){
    const onlineBtn = $("btnCoopOnline");
    if (onlineBtn && !onlineBtn._onlineBound){
      onlineBtn._onlineBound = true;
      onlineBtn.disabled = false;
      onlineBtn.classList.remove("disabled");
      onlineBtn.addEventListener("click", function(){ hideMenusExcept("onlineHomeScreen"); setStatus("onlineHomeStatus", "", false); });
    }
    const homeBack = $("onlineHomeBackBtn");
    if (homeBack) homeBack.onclick = function(){ hideMenusExcept("coopModeSelectScreen"); };
    const openJoin = $("onlineOpenJoinBtn");
    if (openJoin) openJoin.onclick = function(){
      hideMenusExcept("onlineJoinScreen");
      setStatus("onlineJoinStatus", "", false);
      updateJoinCodeCounter();
      const input = $("onlineJoinCodeInput");
      if (input) setTimeout(function(){ input.focus(); updateJoinCodeCounter(); }, 40);
    };
    const joinBack = $("onlineJoinBackBtn");
    if (joinBack) joinBack.onclick = function(){ hideMenusExcept("onlineHomeScreen"); setStatus("onlineJoinStatus", "", false); };
    const lobbyBack = $("onlineLobbyBackBtn");
    if (lobbyBack) lobbyBack.onclick = function(){ openLeaveConfirm(); };
    const onlineHomeClose = $("onlineHomeCloseToMenuBtn");
    if (onlineHomeClose) onlineHomeClose.onclick = function(){ setStatus("onlineHomeStatus", "", false); showMainMenu(); };
    const onlineJoinClose = $("onlineJoinCloseToMenuBtn");
    if (onlineJoinClose) onlineJoinClose.onclick = function(){ setStatus("onlineJoinStatus", "", false); showMainMenu(); };
    const leaveNo = $("onlineLeaveNo");
    if (leaveNo) leaveNo.onclick = function(){ closeLeaveConfirm(); };
    const leaveYes = $("onlineLeaveYes");
    if (leaveYes) leaveYes.onclick = function(){ confirmLeaveToOnlineHome().catch(function(e){ setStatus("onlineLobbyStatus", e.message || String(e), true); }); };
    const leaveModal = $("onlineLeaveConfirmModal");
    if (leaveModal && !leaveModal._onlineBound){
      leaveModal._onlineBound = true;
      leaveModal.addEventListener("click", function(e){ if (e.target === leaveModal) closeLeaveConfirm(); });
    }
    const create = $("onlineCreateRoomBtn");
    if (create) create.onclick = function(){ createRoom().catch(function(e){ setStatus("onlineHomeStatus", e.message || String(e), true); }); };
    const join = $("onlineJoinRoomBtn");
    const input = $("onlineJoinCodeInput");
    if (input && !input._onlineCodeBound){
      input._onlineCodeBound = true;
      let prevLen = (input.value || "").length;
      updateJoinCodeCounter();
      input.addEventListener("input", function(){
        const clean = (input.value || "").replace(/\D/g, "").slice(0, 6);
        if (input.value !== clean) input.value = clean;
        const nowLen = clean.length;
        const delta = nowLen - prevLen;
        prevLen = nowLen;
        updateJoinCodeCounter();
        playJoinCodeInputSound(delta);
      });
      input.addEventListener("keydown", function(e){ if (e.key === "Enter" && join) join.click(); });
    }
    if (join) join.onclick = function(){ joinRoom(input && input.value).catch(function(e){ setStatus("onlineJoinStatus", e.message || String(e), true); }); };
    const copy = $("onlineCopyCodeBtn");
    if (copy) copy.onclick = function(){
      try{
        navigator.clipboard.writeText(state.roomCode || "");
        setStatus("onlineLobbyStatus", "C\u00f3digo copiado.", false);
        copy.textContent = "Copiado!";
        clearTimeout(copy._onlineCopiedTimer);
        copy._onlineCopiedTimer = setTimeout(function(){ copy.textContent = "Copiar"; }, 1200);
        if (window._gameBeep){
          window._gameBeep(660, 0.05, "square", 0.05);
          setTimeout(function(){ window._gameBeep(880, 0.06, "square", 0.05); }, 55);
          setTimeout(function(){ window._gameBeep(990, 0.07, "triangle", 0.06); }, 120);
        }
      }catch(_){}
    };
    document.querySelectorAll("[data-online-map]").forEach(function(btn){
      if (btn._onlineBound) return;
      btn._onlineBound = true;
      btn.addEventListener("click", function(){
        if (!state.isHost || btn.disabled) return;
        document.querySelectorAll("[data-online-map]").forEach(function(item){
          item.classList.toggle("selected", item === btn);
          item.setAttribute("aria-pressed", item === btn ? "true" : "false");
        });
        updateSettings({ map: btn.getAttribute("data-online-map") }).catch(function(e){
          setStatus("onlineLobbyStatus", e.message || String(e), true);
        });
      });
    });
    document.querySelectorAll("[data-online-difficulty]").forEach(function(btn){
      if (btn._onlineBound) return;
      btn._onlineBound = true;
      btn.addEventListener("click", function(){
        if (!state.isHost || btn.disabled || btn.classList.contains("difficulty-locked")) return;
        document.querySelectorAll("[data-online-difficulty]").forEach(function(item){
          item.classList.toggle("selected", item === btn);
          item.setAttribute("aria-pressed", item === btn ? "true" : "false");
        });
        updateSettings({ difficulty: btn.getAttribute("data-online-difficulty") || "normal" }).catch(function(e){
          setStatus("onlineLobbyStatus", e.message || String(e), true);
        });
      });
    });
    document.querySelectorAll("[data-online-style]").forEach(function(btn){
      if (btn._onlineBound) return;
      btn._onlineBound = true;
      btn.addEventListener("click", function(){
        if (!state.isHost || btn.disabled || btn.classList.contains("sandbox-locked")) return;
        document.querySelectorAll("[data-online-style]").forEach(function(item){
          item.classList.toggle("selected", item === btn);
          item.setAttribute("aria-pressed", item === btn ? "true" : "false");
        });
        updateSettings({ style: btn.getAttribute("data-online-style") || "default" }).catch(function(e){
          setStatus("onlineLobbyStatus", e.message || String(e), true);
        });
      });
    });
    const start = $("onlineStartGameBtn");
    if (start) start.onclick = function(){ startHostGame().catch(function(e){ setStatus("onlineLobbyStatus", e.message || String(e), true); }); };
    const snakeBtn = $("onlineSnakeToggle");
    if (snakeBtn && !snakeBtn._onlineSnakeBound){
      snakeBtn._onlineSnakeBound = true;
      snakeBtn.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        setLobbySnakeMode(lobbySnake.mode !== "snake");
      });
    }
    if (!window._onlineLobbySnakeKeyBound){
      window._onlineLobbySnakeKeyBound = true;
      document.addEventListener("keydown", function(e){
        if (lobbySnake.mode !== "snake") return;
        const screen = $("onlineLobbyScreen");
        if (!screen || screen.style.display === "none") return;
        const key = e.key || "";
        const lower = key.toLowerCase();
        if (key === " " || lower === "w" || lower === "a" || lower === "s" || lower === "d" || key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight"){
          e.preventDefault();
          e.stopPropagation();
        } else return;
        if (key === " "){
          if (lobbySnake.dying) return;
          startLobbySnakeGame();
          return;
        }
        if (lobbySnake.dying || !lobbySnake.running || lobbySnake.gameOver) return;
        if (lower === "w" || key === "ArrowUp") lobbySnake.nextDir = { x:0, y:-1 };
        else if (lower === "s" || key === "ArrowDown") lobbySnake.nextDir = { x:0, y:1 };
        else if (lower === "a" || key === "ArrowLeft") lobbySnake.nextDir = { x:-1, y:0 };
        else if (lower === "d" || key === "ArrowRight") lobbySnake.nextDir = { x:1, y:0 };
      }, true);
    }
    const slotsEl = $("onlineLobbySlots");
    if (slotsEl && !slotsEl._onlineKickBound){
      slotsEl._onlineKickBound = true;
      slotsEl.addEventListener("click", function(e){
        const btn = e.target && e.target.closest ? e.target.closest("[data-kick-player-id]") : null;
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        if (!state.isHost) return;
        kickPlayer(btn.getAttribute("data-kick-player-id")).catch(function(err){
          setStatus("onlineLobbyStatus", err.message || String(err), true);
        });
      });
    }
    function bindChatBox(inputId, formId, emojiBtnId, emojiPickerId){
      const chatInput = $(inputId);
      if (chatInput && !chatInput._onlineChatSoundBound){
        chatInput._onlineChatSoundBound = true;
        let chatPrevLen = (chatInput.value || "").length;
        chatInput.addEventListener("input", function(){
          const nowLen = (chatInput.value || "").length;
          const delta = nowLen - chatPrevLen;
          chatPrevLen = nowLen;
          playJoinCodeInputSound(delta);
          if ((chatInput.value || "").trim()) setTypingActive(true);
          else setTypingActive(false);
        });
        chatInput.addEventListener("blur", function(){ setTypingActive(false); });
        chatInput.addEventListener("keydown", function(e){ e.stopPropagation(); });
        chatInput.addEventListener("keyup", function(e){ e.stopPropagation(); });
      }
      const emojiBtn = $(emojiBtnId);
      const emojiPicker = $(emojiPickerId);
      if (emojiBtn && emojiPicker && !emojiBtn._onlineEmojiBound){
        emojiBtn._onlineEmojiBound = true;
      const emojis = ["😀","😂","😎","🤠","👍","👏","🔥","✨","💰","🏆","⚡","💥","❤️","💀","😱","😤","🤝","🎯"];
      emojiPicker.innerHTML = emojis.map(function(em){
        return '<button class="online-emoji-choice" data-emoji="' + esc(em) + '" type="button">' + esc(em) + '</button>';
      }).join("");
      emojiBtn.addEventListener("click", function(e){
        e.stopPropagation();
        const open = !emojiPicker.classList.contains("open");
        emojiPicker.classList.toggle("open", open);
        emojiPicker.setAttribute("aria-hidden", open ? "false" : "true");
      });
      emojiPicker.addEventListener("click", function(e){
        const btn = e.target && e.target.closest ? e.target.closest("[data-emoji]") : null;
        if (!btn) return;
        insertChatEmoji($(inputId), btn.getAttribute("data-emoji"));
      });
      document.addEventListener("click", function(e){
        if (!emojiPicker.classList.contains("open")) return;
        if (emojiPicker.contains(e.target) || emojiBtn.contains(e.target)) return;
        emojiPicker.classList.remove("open");
        emojiPicker.setAttribute("aria-hidden", "true");
      });
      }
      const chat = $(formId);
      if (chat) chat.onsubmit = function(e){
        e.preventDefault();
        const inp = $(inputId);
        const text = inp ? inp.value : "";
        if (inp){
          inp.value = "";
          if (inp._onlineChatSoundBound) inp.dispatchEvent(new Event("input", { bubbles:false }));
        }
        setTypingActive(false);
        sendChat(text).catch(function(err){ setStatus("onlineLobbyStatus", err.message || String(err), true); });
      };
    }
    bindChatBox("onlineChatInput", "onlineChatForm", "onlineEmojiBtn", "onlineEmojiPicker");
    bindChatBox("onlineGameChatInput", "onlineGameChatForm", "onlineGameEmojiBtn", "onlineGameEmojiPicker");
    const gameChatToggle = $("onlineGameChatToggle");
    const gameChatBox = $("onlineGameChat");
    if (gameChatToggle && gameChatBox && !gameChatToggle._onlineCollapseBound){
      gameChatToggle._onlineCollapseBound = true;
      gameChatToggle.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        const collapsed = !gameChatBox.classList.contains("is-collapsed");
        gameChatBox.classList.toggle("is-collapsed", collapsed);
        gameChatToggle.setAttribute("aria-label", collapsed ? "Mostrar chat" : "Ocultar chat");
        try{ gameChatToggle.blur(); }catch(_){}
        try{
          const api = window.__defendaApi;
          if (api && api.beep) api.beep(collapsed ? 420 : 620, 0.035, "triangle", 0.025);
        }catch(_){}
      });
    }
    window.addEventListener("beforeunload", function(){ try{ leaveRoom(true); }catch(_){} });
  }

  window.__onlineCoop = {
    state: state,
    open: function(){ hideMenusExcept("onlineHomeScreen"); },
    leave: leaveRoom,
    broadcast: broadcast,
    pushSystemChat: function(text, kind){ pushSystemChat(text, kind); },
    sendAction: function(action){
      const ch = state.hostControlChannel || state.hostChannel;
      if (!ch || ch.readyState !== "open") return;
      ch.send(JSON.stringify({ t:"action", runId:state.runId, action:action || {}, at:now() }));
    },
    sendInputNow: function(){ sendInputPacket(state.runId, true); },
    returnToLobby: returnToLobby,
    continueGame: continueHostGame,
    kickPlayer: kickPlayer,
    updateLocalCosmetics: updateLocalCosmeticsFromProfile
  };
  window.__onlineCoop.restartGame = function(){
    if (!state.isHost) return;
    return restartHostGame().catch(function(err){ setStatus("onlineLobbyStatus", err && err.message ? err.message : String(err), true); });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wireUi);
  else wireUi();
})();
