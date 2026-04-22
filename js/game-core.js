(() => {
  const TILE = 32;
  const GRID_W = 19;
  const GRID_H = 15;
  const CANVAS_W = GRID_W * TILE;
  const CANVAS_H = GRID_H * TILE;
  window.TILE = TILE;
  window.GRID_W = GRID_W;
  window.GRID_H = GRID_H;

  /** Barricada: 5 níveis; maxHp por nível (índice = nível). */
  const BARRICADA_LEGACY_MAX_HP = [0, 30, 40, 50, 60];
  window.BARRICADA_MAX_LEVEL = 5;
  window.BARRICADA_MAX_HP_BY_LEVEL = [0, 60, 80, 100, 120, 140];
  window._migrateBarricadaIfLegacy = function(bar){
    if (!bar) return;
    if ((bar.level | 0) > window.BARRICADA_MAX_LEVEL) bar.level = window.BARRICADA_MAX_LEVEL;
    const lv = Math.min(window.BARRICADA_MAX_LEVEL, Math.max(1, bar.level | 0));
    const t = window.BARRICADA_MAX_HP_BY_LEVEL;
    const leg = BARRICADA_LEGACY_MAX_HP[lv];
    if (leg && bar.maxHp === leg){
      const r = bar.maxHp > 0 ? (bar.hp / bar.maxHp) : 1;
      bar.maxHp = t[lv];
      bar.hp = Math.max(0, Math.min(bar.maxHp, Math.round(bar.maxHp * r)));
    }
  };

  /** Torre Sentinela: cooldown base e pisos após −30% nos tempos anteriores. */
  const SENTRY_FIRE_BASE_MS = Math.round(960 * 0.7);
  const SENTRY_FIRE_CD_FALLBACK_MS = Math.round(1280 * 0.7);
  const SENTRY_FIRE_CD_MIN_AFTER_MENU_UP = Math.round(225 * 0.7);
  const SENTRY_FIRE_CD_MIN_AFTER_SHOP_UP = Math.round(150 * 0.7);
  const SENTRY_MAX_UP_LEVEL = 4; // exibido como nível 1..5 (upLevel+1)
  window.SENTRY_FIRE_BASE_MS = SENTRY_FIRE_BASE_MS;
  window.SENTRY_FIRE_CD_MIN_AFTER_MENU_UP = SENTRY_FIRE_CD_MIN_AFTER_MENU_UP;
  window.SENTRY_FIRE_CD_MIN_AFTER_SHOP_UP = SENTRY_FIRE_CD_MIN_AFTER_SHOP_UP;
  window.SENTRY_MAX_UP_LEVEL = SENTRY_MAX_UP_LEVEL;

  const PICHA_POCO_MAX = 10;

  const COLORS = {
    sandLight: "#d8b77a",
    sandMid:   "#caa76a",
    sandDark:  "#b38d52",
    rock:      "#7e6b5a",
    cactus:    "#2f7d32",
    wood:      "#6b4b1b",
    shadow:    "rgba(0,0,0,0.25)",
    bandit:    "#4a1f1f",
    bandana:   "#b91414",
    bullet:    "#111",
    player:    "#3c6ca8",
    hat:       "#4d2f0a",
    gold:      "#f1d14a",
    goldShadow:"#d9b237",
    tumble:    "#a7793a"
  };

  function loadEnemySprite(src){
    const img = new Image();
    img.src = src;
    return img;
  }
  const ENEMY_SPRITES = {
    bandit: loadEnemySprite('img/enemy-bandido.png'),
    assassin: loadEnemySprite('img/enemy-assassino.png'),
    vandal: loadEnemySprite('img/enemy-vandalo.png')
  };
  function drawEnemySprite(ctx, kind, x, y, size){
    const img = ENEMY_SPRITES[kind];
    if (!img || !img.complete || !img.naturalWidth) return false;
    try{
      const prev = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, x, y, size || 16, size || 16);
      ctx.imageSmoothingEnabled = prev;
      return true;
    }catch(_){
      return false;
    }
  }

  /*
   * Multi‑map definitions
   *
   * The game now supports five distinct biomas. Each map entry defines
   * its name, synopsis for the selection screen, the number of random
   * obstacles to scatter, the probability of generating obstacle type 1
   * versus type 2, colour palette for the ground texture and shadows, and
   * functions to draw each obstacle. These draw functions accept a
   * CanvasRenderingContext2D and pixel coordinates (top‑left) to render
   * each tile. A simple preview renderer is also provided for the map
   * selection screen. Finally, a minimal music definition controls the
   * tempo and note sequences of the background loop for the map.
   */
  window.currentMapId = window.currentMapId || 'desert';
  window.currentMode  = window.currentMode  || 'infinite';

  const MAP_DEFS = {
    desert: {
      id: 'desert',
      name: 'Deserto Escaldante',
      synopsis: 'Planície arenosa com cactos e rochas.',
      numObstacles: 40,
      probType1: 0.6,
      colors: {
        light: '#d8b77a',
        mid:   '#caa76a',
        dark:  '#b38d52',
        shadow: 'rgba(0,0,0,0.25)'
      },
      // Cacto (tipo 1) – reaproveita o desenho original
      drawObstacle1(g, px, py){
        // sombra
        g.fillStyle = this.colors.shadow;
        g.beginPath(); g.ellipse(px+16, py+TILE-5, 14, 5, 0, 0, Math.PI*2); g.fill();
        // corpo
        g.fillStyle = COLORS.cactus;
        g.beginPath();
        g.moveTo(px+10, py+28);
        g.lineTo(px+10, py+16);
        g.quadraticCurveTo(px+10, py+10, px+16, py+10);
        g.quadraticCurveTo(px+22, py+10, px+22, py+16);
        g.lineTo(px+22, py+28);
        g.closePath(); g.fill();
        // braços
        g.beginPath();
        g.moveTo(px+10, py+18);
        g.quadraticCurveTo(px+7, py+14, px+10, py+12);
        g.quadraticCurveTo(px+12, py+14, px+12, py+18);
        g.closePath(); g.fill();
        g.beginPath();
        g.moveTo(px+22, py+18);
        g.quadraticCurveTo(px+25, py+14, px+22, py+12);
        g.quadraticCurveTo(px+20, py+14, px+20, py+18);
        g.closePath(); g.fill();
        // brilho leve
        g.globalAlpha = 0.15; g.fillStyle = '#7ccf7f';
        g.fillRect(px+12, py+14, 2, 8);
        g.globalAlpha = 1;
      },
      // Rocha (tipo 2) – reaproveita o desenho original
      drawObstacle2(g, px, py){
        // sombra
        g.fillStyle = this.colors.shadow;
        g.beginPath(); g.ellipse(px+18, py+22, 12, 8, 0.15, 0, Math.PI*2); g.fill();
        // corpo da rocha
        g.fillStyle = COLORS.rock;
        g.beginPath();
        g.moveTo(px+10, py+22);
        g.lineTo(px+14, py+14);
        g.lineTo(px+22, py+12);
        g.lineTo(px+26, py+18);
        g.lineTo(px+24, py+26);
        g.lineTo(px+16, py+28);
        g.closePath(); g.fill();
        // highlight
        g.fillStyle = '#8b7a6a';
        g.beginPath(); g.moveTo(px+20, py+14); g.lineTo(px+23, py+17); g.lineTo(px+18, py+18); g.closePath(); g.fill();
        // fissura
        g.strokeStyle = '#5f5146'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(px+14, py+20); g.lineTo(px+18, py+23); g.lineTo(px+22, py+21); g.stroke();
      },
      drawPreview(ctx,w,h){
        ctx.fillStyle = this.colors.mid;
        ctx.fillRect(0,0,w,h);
        for(let i=0;i<2;i++){
          const px = Math.random()*(w-28);
          const py = Math.random()*(h-32);
          if(Math.random()<this.probType1){ this.drawObstacle1(ctx, px, py); }
          else { this.drawObstacle2(ctx, px, py); }
        }
      },
      music: { tempo: 132, bass: [110,110,165,110,110,220,196,165], lead: [440,494,440,392,0,392,440,494] }
    },
    forest: {
      id: 'forest',
      name: 'Floresta Ancestral',
      synopsis: 'Uma densa floresta repleta de árvores e arbustos.',
      numObstacles: 50,
      probType1: 0.6,
      colors: {
        light: '#577d4b',
        mid:   '#47653e',
        dark:  '#3c5c32',
        shadow: 'rgba(0,0,0,0.25)'
      },
      drawObstacle1(g, px, py){
        // Árvore: tronco marrom + copa verde
        // sombra
        g.fillStyle = this.colors.shadow;
        g.beginPath(); g.ellipse(px+16, py+TILE-4, 12, 4, 0, 0, Math.PI*2); g.fill();
        // tronco
        g.fillStyle = '#704214';
        g.fillRect(px+14, py+18, 4, 10);
        // copa (folhas) – três círculos sobrepostos
        g.fillStyle = '#3c8137';
        g.beginPath(); g.arc(px+16, py+14, 7, 0, Math.PI*2); g.fill();
        g.beginPath(); g.arc(px+12, py+17, 6, 0, Math.PI*2); g.fill();
        g.beginPath(); g.arc(px+20, py+17, 6, 0, Math.PI*2); g.fill();
        // brilho
        g.globalAlpha = 0.18; g.fillStyle = '#5da554';
        g.beginPath(); g.arc(px+16, py+13, 4, 0, Math.PI*2); g.fill();
        g.globalAlpha = 1;
      },
      drawObstacle2(g, px, py){
        // Arbusto: amontoado baixo e largo
        g.fillStyle = this.colors.shadow;
        g.beginPath(); g.ellipse(px+16, py+TILE-4, 12, 4, 0, 0, Math.PI*2); g.fill();
        // corpo principal
        g.fillStyle = '#2f6e2d';
        g.beginPath();
        g.ellipse(px+16, py+20, 10, 6, 0, 0, Math.PI*2); g.fill();
        g.beginPath();
        g.ellipse(px+10, py+18, 8, 5, 0, 0, Math.PI*2); g.fill();
        g.beginPath();
        g.ellipse(px+22, py+18, 8, 5, 0, 0, Math.PI*2); g.fill();
        // highlight
        g.globalAlpha = 0.18; g.fillStyle = '#4c8a3e';
        g.beginPath(); g.ellipse(px+16, py+19, 6, 3, 0, 0, Math.PI*2); g.fill();
        g.globalAlpha = 1;
      },
      drawPreview(ctx,w,h){
        ctx.fillStyle = this.colors.mid;
        ctx.fillRect(0,0,w,h);
        for(let i=0;i<2;i++){
          const px = Math.random()*(w-28);
          const py = Math.random()*(h-32);
          if(Math.random()<this.probType1) this.drawObstacle1(ctx,px,py);
          else this.drawObstacle2(ctx,px,py);
        }
      },
      music: { tempo: 120, bass: [98,98,147,98,98,196,174,147], lead: [392,440,392,349,0,349,392,440] }
    },
    snow: {
      id: 'snow',
      name: 'Tundra Congelada',
      synopsis: 'Uma paisagem coberta de neve e gelo.',
      numObstacles: 35,
      probType1: 0.55,
      colors: {
        light: '#f5f8fc',
        mid:   '#e1e8f0',
        dark:  '#cbd8e4',
        shadow: 'rgba(0,0,0,0.25)'
      },
      drawObstacle1(g, px, py){
        // Pinheiro coberto de neve
        // sombra
        g.fillStyle = this.colors.shadow;
        g.beginPath(); g.ellipse(px+16, py+TILE-4, 12, 4, 0, 0, Math.PI*2); g.fill();
        // tronco
        g.fillStyle = '#5b3a1f';
        g.fillRect(px+15, py+20, 3, 8);
        // camadas de folhas (triângulos)
        g.fillStyle = '#31633b';
        g.beginPath(); g.moveTo(px+16, py+8); g.lineTo(px+8, py+20); g.lineTo(px+24, py+20); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(px+16, py+14); g.lineTo(px+10, py+24); g.lineTo(px+22, py+24); g.closePath(); g.fill();
        // neve no topo
        g.fillStyle = '#e9eff7';
        g.beginPath(); g.arc(px+16, py+9, 5, 0, Math.PI*2); g.fill();
      },
      drawObstacle2(g, px, py){
        // Rocha nevada
        // sombra
        g.fillStyle = this.colors.shadow;
        g.beginPath(); g.ellipse(px+18, py+22, 12, 8, 0.1, 0, Math.PI*2); g.fill();
        // corpo
        g.fillStyle = '#b6c4d6';
        g.beginPath();
        g.moveTo(px+11, py+22);
        g.lineTo(px+15, py+16);
        g.lineTo(px+22, py+14);
        g.lineTo(px+27, py+19);
        g.lineTo(px+25, py+26);
        g.lineTo(px+17, py+28);
        g.closePath(); g.fill();
        // neve highlight
        g.fillStyle = '#d0deed';
        g.beginPath();
        g.moveTo(px+19, py+15); g.lineTo(px+23, py+18); g.lineTo(px+18, py+19); g.closePath(); g.fill();
        // fissura
        g.strokeStyle = '#95a6b9'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(px+15, py+21); g.lineTo(px+19, py+24); g.lineTo(px+23, py+22); g.stroke();
      },
      drawPreview(ctx,w,h){
        ctx.fillStyle = this.colors.mid;
        ctx.fillRect(0,0,w,h);
        for(let i=0;i<2;i++){
          const px = Math.random()*(w-28);
          const py = Math.random()*(h-32);
          if(Math.random()<this.probType1) this.drawObstacle1(ctx,px,py);
          else this.drawObstacle2(ctx,px,py);
        }
      },
      music: { tempo: 100, bass: [82,82,123,82,82,164,146,123], lead: [330,349,330,294,0,294,330,349] }
    },
    swamp: {
      id: 'swamp',
      name: 'Pântano Lamacento',
      synopsis: 'Neblina rasteira, vagalumes e lagos cobertos de musgo.',
      numObstacles: 38,
      probType1: 0.60,
      colors: {
        light: '#4a6130',
        mid:   '#2e3d1c',
        dark:  '#1e2a10',
        shadow: 'rgba(0,0,0,0.35)'
      },
      drawObstacle1(g, px, py){
        // Árvore seca com galhos retorcidos
        const cx = px+16, by = py+28;
        // sombra
        g.fillStyle = 'rgba(0,0,0,0.28)';
        g.beginPath(); g.ellipse(cx, py+TILE-3, 10, 3.5, 0, 0, Math.PI*2); g.fill();
        // raízes tortas
        g.strokeStyle = '#3a2510'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(cx, by); g.lineTo(cx-6, by+3); g.stroke();
        g.beginPath(); g.moveTo(cx, by); g.lineTo(cx+5, by+4); g.stroke();
        // tronco principal (mais grosso embaixo, afunila em cima)
        g.fillStyle = '#3e2810';
        g.beginPath();
        g.moveTo(cx-4, by);
        g.quadraticCurveTo(cx-5, py+18, cx-2, py+10);
        g.lineTo(cx+2, py+10);
        g.quadraticCurveTo(cx+5, py+18, cx+4, by);
        g.closePath(); g.fill();
        // highlight lateral no tronco
        g.globalAlpha = 0.18; g.fillStyle = '#7a5030';
        g.beginPath();
        g.moveTo(cx-2, by);
        g.quadraticCurveTo(cx-3, py+18, cx-1, py+12);
        g.lineTo(cx, py+12); g.lineTo(cx, by); g.closePath(); g.fill();
        g.globalAlpha = 1;
        // galho esquerdo principal
        g.strokeStyle = '#3e2810'; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(cx-1, py+14); g.quadraticCurveTo(cx-8, py+10, cx-11, py+7); g.stroke();
        // galho esquerdo bifurcado
        g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(cx-9, py+9); g.lineTo(cx-13, py+6); g.stroke();
        g.beginPath(); g.moveTo(cx-9, py+9); g.lineTo(cx-10, py+5); g.stroke();
        // galho direito principal
        g.lineWidth = 2.0;
        g.beginPath(); g.moveTo(cx+1, py+12); g.quadraticCurveTo(cx+8, py+8, cx+12, py+5); g.stroke();
        // galho direito bifurcado
        g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(cx+10, py+7); g.lineTo(cx+14, py+4); g.stroke();
        g.beginPath(); g.moveTo(cx+10, py+7); g.lineTo(cx+12, py+11); g.stroke();
        // galho pequeno para cima
        g.lineWidth = 1.0;
        g.beginPath(); g.moveTo(cx, py+11); g.lineTo(cx-2, py+7); g.stroke();
        g.beginPath(); g.moveTo(cx, py+11); g.lineTo(cx+3, py+7); g.stroke();
        // musgo / líquen nos galhos
        g.globalAlpha = 0.22; g.fillStyle = '#6a8a40';
        g.beginPath(); g.arc(cx-11, py+7, 2.5, 0, Math.PI*2); g.fill();
        g.beginPath(); g.arc(cx+12, py+5, 2, 0, Math.PI*2); g.fill();
        g.globalAlpha = 1;
      },
      drawObstacle2(g, px, py){
        // Touça de capim pantanoso com cogumelo
        const cx = px+16, by = py+26;
        // sombra
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.beginPath(); g.ellipse(cx, py+TILE-3, 11, 3.5, 0, 0, Math.PI*2); g.fill();
        // base terrosa úmida
        g.fillStyle = '#3b4a20';
        g.beginPath(); g.ellipse(cx, by+1, 9, 4, 0, 0, Math.PI*2); g.fill();
        // folhas de capim — várias hastes curvas
        const blades = [
          {ox:-7, cp1x:-9, cp1y:by-8, ex:-11, ey:py+12, w:1.4, col:'#4a6a28'},
          {ox:-4, cp1x:-5, cp1y:by-10, ex:-6,  ey:py+9,  w:1.2, col:'#3d5a20'},
          {ox: 0, cp1x: 1, cp1y:by-12, ex: 2,  ey:py+8,  w:1.6, col:'#5a7a30'},
          {ox: 3, cp1x: 5, cp1y:by-11, ex: 8,  ey:py+10, w:1.3, col:'#4a6828'},
          {ox: 6, cp1x: 9, cp1y:by-8,  ex:12,  ey:py+13, w:1.2, col:'#3a5020'},
        ];
        for(const b of blades){
          g.strokeStyle = b.col; g.lineWidth = b.w;
          g.beginPath(); g.moveTo(cx+b.ox, by); g.quadraticCurveTo(cx+b.cp1x, b.cp1y, cx+b.ex, b.ey); g.stroke();
        }
        // nenhuma flor — só capim pantanoso puro
        // reflexo
        g.globalAlpha = 0.15; g.fillStyle = '#8ab040';
        g.beginPath(); g.ellipse(cx, by, 7, 3, 0, 0, Math.PI*2); g.fill();
        g.globalAlpha = 1;
      },
      drawPreview(ctx,w,h){
        ctx.fillStyle = this.colors.mid;
        ctx.fillRect(0,0,w,h);
        for(let i=0;i<2;i++){
          const px = Math.random()*(w-28);
          const py = Math.random()*(h-32);
          if(Math.random()<this.probType1) this.drawObstacle1(ctx,px,py);
          else this.drawObstacle2(ctx,px,py);
        }
      },
      music: { tempo: 104, bass: [92,92,138,92,92,184,164,138], lead: [311,329,311,293,0,293,311,329] }
    },
    canyon: {
      id: 'canyon',
      name: 'Cânion Vermelho',
      synopsis: 'Desfiladeiros profundos com colunas de pedra.',
      numObstacles: 40,
      probType1: 0.5,
      colors: {
        light: '#d4674a',
        mid:   '#b84c35',
        dark:  '#8a2e1c',
        shadow: 'rgba(0,0,0,0.35)'
      },
      drawObstacle1(g, px, py){
        // Coluna rochosa compacta estilo canyon
        g.fillStyle = this.colors.shadow;
        g.beginPath(); g.ellipse(px+16, py+TILE-4, 11, 4, 0, 0, Math.PI*2); g.fill();
        // base
        g.fillStyle = '#7f2616';
        g.fillRect(px+10, py+22, TILE-20, 7);
        // corpo principal
        g.fillStyle = '#a33525';
        g.beginPath();
        g.moveTo(px+12, py+22);
        g.lineTo(px+13, py+10);
        g.lineTo(px+19, py+10);
        g.lineTo(px+20, py+22);
        g.closePath(); g.fill();
        // topo (mesa)
        g.fillStyle = '#bf4833';
        g.fillRect(px+12, py+9, 8, 3);
        // faixa de sedimento sutil
        g.globalAlpha = 0.30;
        g.fillStyle = '#ffede0';
        g.fillRect(px+12, py+16, 8, 1);
        g.globalAlpha = 1;
        // sombra lateral
        g.globalAlpha = 0.18;
        g.fillStyle = '#3a0a05';
        g.fillRect(px+18, py+10, 3, 12);
        g.globalAlpha = 1;
      },
      drawObstacle2(g, px, py){
        // Rocha vermelha arredondada com cacto
        g.fillStyle = this.colors.shadow;
        g.beginPath(); g.ellipse(px+17, py+23, 11, 5, 0, 0, Math.PI*2); g.fill();
        // corpo da pedra
        g.fillStyle = '#9c3220';
        g.beginPath();
        g.moveTo(px+10, py+24);
        g.lineTo(px+13, py+15);
        g.lineTo(px+20, py+13);
        g.lineTo(px+26, py+18);
        g.lineTo(px+24, py+26);
        g.lineTo(px+15, py+28);
        g.closePath(); g.fill();
        // topo mais claro
        g.fillStyle = '#bf4030';
        g.beginPath();
        g.moveTo(px+14, py+16);
        g.lineTo(px+20, py+14);
        g.lineTo(px+24, py+19);
        g.lineTo(px+18, py+20);
        g.closePath(); g.fill();
        // sombra lateral direita
        g.globalAlpha = 0.20;
        g.fillStyle = '#3a0a05';
        g.beginPath();
        g.moveTo(px+24, py+18); g.lineTo(px+26, py+18); g.lineTo(px+24, py+26); g.lineTo(px+22, py+26);
        g.closePath(); g.fill();
        g.globalAlpha = 1;
        // cacto simples
        g.fillStyle = '#2d5e22';
        g.fillRect(px+6, py+17, 2, 9);   // tronco
        g.fillRect(px+3, py+19, 5, 2);   // braço esquerdo
        g.fillRect(px+3, py+17, 2, 4);   // ponta esquerda
      },
      drawPreview(ctx,w,h){
        ctx.fillStyle = this.colors.mid;
        ctx.fillRect(0,0,w,h);
        for(let i=0;i<2;i++){
          const px = Math.random()*(w-28);
          const py = Math.random()*(h-32);
          if(Math.random()<this.probType1) this.drawObstacle1(ctx,px,py);
          else this.drawObstacle2(ctx,px,py);
        }
      },
      music: { tempo: 140, bass: [110,123,165,110,110,196,174,165], lead: [440,466,440,392,0,392,440,466] }
    }
  };
  window.MAP_DEFS = MAP_DEFS;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  // === Mira Aprimorada (target lock) ===
  function sfxTargetLock(){
    try{
      beep(1320, 0.04, "square", 0.05);
      beep(1980, 0.03, "sine", 0.04);
      noise(0.03, 0.02);
    }catch(_){}
  }

  function getEntityAtCanvasPoint(cx, cy){
    const tx = cx / TILE;
    const ty = cy / TILE;

    // Boss primeiro
    if (state.boss && state.boss.alive){
      const b = state.boss;
      const dx = (b.x + 0.5) - tx;
      const dy = (b.y + 0.5) - ty;
      if ((dx*dx + dy*dy) <= 0.62*0.62) return {kind:"boss", id:b.id};
    }
    // Inimigos
    for (let i = state.bandits.length-1; i>=0; i--){
      const z = state.bandits[i];
      if (!z.alive) continue;
      const dx = (z.x + 0.5) - tx;
      const dy = (z.y + 0.5) - ty;
      if ((dx*dx + dy*dy) <= 0.62*0.62) return {kind:"bandit", id:z.id};
    }
    return null;
  }

  function resolveTarget(){
    if (!state.target) return null;
    const t = state.target;
    if (t.kind === "boss"){
      if (state.boss && state.boss.alive && state.boss.id === t.id) return state.boss;
      return null;
    }
    for (const z of state.bandits){
      if (z.alive && z.id === t.id) return z;
    }
    return null;
  }

  
  function targetNearest(){
    if (!state || !state.running) return;
    if ((state.aimLevel||0) <= 0) return;

    const p = state.player;
    const px = p.x + 0.5;
    const py = p.y + 0.5;

    let best = null;
    let bestD2 = Infinity;

    // Boss
    if (state.boss && state.boss.alive){
      const b = state.boss;
      const dx = (b.x + 0.5) - px;
      const dy = (b.y + 0.5) - py;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2){
        bestD2 = d2;
        best = { kind: "boss", id: b.id };
      }
    }

    // Inimigos
    for (const z of state.bandits){
      if (!z.alive) continue;
      const dx = (z.x + 0.5) - px;
      const dy = (z.y + 0.5) - py;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD2){
        bestD2 = d2;
        best = { kind: "bandit", id: z.id };
      }
    }

    if (best){
      state.target = best;
      sfxTargetLock();
    } else {
      state.target = null;
    }
  }

function clearTarget(){ state.target = null; }

  function aimSlowFactor(){
    const lvl = state.aimLevel || 0;
    if (lvl <= 0) return 1;
    // Reducao de 30% no cooldown da Mira Aprimorada em todos os niveis.
    if (lvl === 1) return 2.8; // era 4x
    if (lvl === 2) return 2.1; // era 3x
    return 1.4; // lvl 3: era 2x
  }

  canvas.addEventListener("pointerdown", (e)=>{
    if (!state || state.inMenu) return;
    if (state.pausedManual || state.pausedShop) return;
    if (dialog && dialog.active) return;
    if (!state.running) return;
    if (!state.aimLevel || state.aimLevel <= 0) return;

    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const cy = (e.clientY - rect.top) * (canvas.height / rect.height);

    const hit = getEntityAtCanvasPoint(cx, cy);
    if (!hit){ clearTarget(); return; }

    state.target = { kind: hit.kind, id: hit.id };
    sfxTargetLock();
  });
  // ── Pause silenciosa para seleções ──────────────────────────────────────
  var _selPausedPrev = null;
  function _selectionPause(){
    const _gsP = window._gameSettings || {};
    if (_gsP.pauseOnSelect === false) return;
    if (!state || !state.running || state.pausedShop || state.inMenu) return;
    if (_selPausedPrev !== null) return; // já pausado por seleção
    _selPausedPrev = !!state.pausedManual;
    if (!state.pausedManual) {
      state.pausedManual = true;
      state._selectionPaused = true;
      try{ var _pb=document.getElementById('pauseBtn'); if(_pb) _pb.textContent='Despausar'; }catch(_){}
    }
  }
  function _selectionResume(){
    const _gsP = window._gameSettings || {};
    if (_gsP.pauseOnSelect === false) { _selPausedPrev = null; return; }
    if (!state || !state.running || state.inMenu) { _selPausedPrev = null; return; }
    if (_selPausedPrev === null) return;
    if (stateInStructuralPlaceMode()){
      _selPausedPrev = null;
      state._selectionPaused = false;
      return;
    }
    const wasManual = _selPausedPrev;
    _selPausedPrev = null;
    state._selectionPaused = false;
    if (!wasManual) {
      state.pausedManual = false;
      try{ var _pb2=document.getElementById('pauseBtn'); if(_pb2) _pb2.textContent='Pausar'; }catch(_){}
    }
  }

  /** Colocação ou mover estruturas: o jogo deve permanecer pausado até terminar ou cancelar (evita despausar no clique “fora” dos menus ou ao fechar diálogo). */
  function stateInStructuralPlaceMode(){
    if (!state) return false;
    return !!(
      state.placingPortalBlue || state.placingPortalOrange ||
      state.placingSentry || state.movingSentry ||
      state.placingClearPath ||
      state.placingGoldMine || state.movingGoldMine ||
      state.placingBarricada || state.movingBarricada ||
      state.placingEspantalho || state.movingEspantalho ||
      state.placingPichaPoco || state.movingPichaPoco
    );
  }

  /** Menus de entidade no mapa: canto direito da viewport, centro vertical (mesmo para todos). */
  window._positionMapEntitySelectionMenu = function(el){
    if (!el) return;
    const margin = 16;
    el.style.position = 'fixed';
    el.style.left = 'auto';
    el.style.right = margin + 'px';
    el.style.top = '50%';
    el.style.bottom = 'auto';
    el.style.transform = 'translateY(-50%)';
  };

  const _MAP_ENTITY_SELECTION_MENU_IDS = ['goldMenu','partnerMenu','reparadorMenu','sentryMenu','espantalhoMenu','goldMineMenu','pichaPocoMenu','barricadaMenu','portalMenu'];
  /** Fecha todos os painéis de seleção no mapa e limpa estado; não altera pausa (não chama _selectionResume). */
  function _closeAllMapEntitySelectionMenusNoResume(){
    for (let i = 0; i < _MAP_ENTITY_SELECTION_MENU_IDS.length; i++){
      const node = document.getElementById(_MAP_ENTITY_SELECTION_MENU_IDS[i]);
      if (node) node.style.display = 'none';
    }
    if (!state) return;
    state.selectedSentry = null;
    state.selectedGoldMine = null;
    state.selectedEspantalho = null;
    state.selectedBarricada = null;
    state.selectedPichaPoco = null;
    state.selectedPortal = null;
    state.selectedGold = false;
    state.selectedAlly = null;
    state.selectedReparador = false;
  }

  try{
    window.addEventListener('resize', function(){
      for (let i = 0; i < _MAP_ENTITY_SELECTION_MENU_IDS.length; i++){
        const node = document.getElementById(_MAP_ENTITY_SELECTION_MENU_IDS[i]);
        if (node && node.style.display === 'block') window._positionMapEntitySelectionMenu(node);
      }
    });
  }catch(_){}

  document.addEventListener('click', function(ev){
    const t = ev.target;
    if (!t || !t.closest || !t.closest('.map-entity-menu-close')) return;
    ev.preventDefault();
    ev.stopPropagation();
    _closeAllMapEntitySelectionMenusNoResume();
    _selectionResume();
  });

  // Clique fora dos painéis de seleção (inclusive fora do canvas):
  // deve sempre fechar e despausar quando a pausa veio da própria seleção.
  document.addEventListener('click', function(ev){
    if (!state || !state.running || state.inMenu) return;
    const t = ev.target;
    if (!t || !t.closest) return;
    // Se clicou dentro de um painel, deixa o handler específico do botão agir.
    if (t.closest('.map-entity-select-menu')) return;
    // Clique no canvas já é tratado no listener do próprio canvas.
    if (t.closest('#game')) return;

    let anyOpen = false;
    for (let i = 0; i < _MAP_ENTITY_SELECTION_MENU_IDS.length; i++){
      const node = document.getElementById(_MAP_ENTITY_SELECTION_MENU_IDS[i]);
      if (node && node.style.display === 'block'){ anyOpen = true; break; }
    }
    if (!anyOpen) return;

    _closeAllMapEntitySelectionMenusNoResume();
    _selectionResume();
  });

  // Click em torre existente para selecionar
  canvas.addEventListener('click',e=>{
    if(!state||stateInStructuralPlaceMode())return;
    const r=canvas.getBoundingClientRect();
    const tx=Math.floor((e.clientX-r.left)*(canvas.width/r.width)/TILE);
    const ty=Math.floor((e.clientY-r.top)*(canvas.height/r.height)/TILE);
    if(!state.sentries)return;

    // Parceiro pistoleiro (atalho loja + visão IR) — só single-player
    if(!state.coop){
      const _prClick = getPartner();
      if(_prClick && tx===_prClick.x && ty===_prClick.y){
        _closeAllMapEntitySelectionMenusNoResume();
        state.selectedAlly = _prClick;
        _selectionPause();
        const _pm = document.getElementById('partnerMenu');
        if(_pm){
          _pm.style.display = 'block';
          try{ if(window._refreshPartnerMenu) window._refreshPartnerMenu(); }catch(_){}
          window._positionMapEntitySelectionMenu(_pm);
        }
        e.stopPropagation();
        return;
      }
    }

    const _rpClick = getReparador();
    if(_rpClick && !_rpClick.hidden && tx === _rpClick.x && ty === _rpClick.y){
      _closeAllMapEntitySelectionMenusNoResume();
      state.selectedReparador = true;
      _selectionPause();
      const _rm = document.getElementById('reparadorMenu');
      if(_rm){
        _rm.style.display = 'block';
        try{ if(window._refreshReparadorMenu) window._refreshReparadorMenu(); }catch(_){}
        window._positionMapEntitySelectionMenu(_rm);
      }
      e.stopPropagation();
      return;
    }

    // Check gold click
    if(state.gold && tx===state.gold.x && ty===state.gold.y){
      _closeAllMapEntitySelectionMenusNoResume();
      state.selectedGold = true;
      _selectionPause();
      const _gm=document.getElementById('goldMenu');
      if(_gm){
        _gm.style.display='block';
        const _gInfo=document.getElementById('goldMenuInfo');
        if(_gInfo) _gInfo.textContent='HP: '+(state.gold.hp|0)+'/'+state.gold.max;
        const _ghBtn=document.getElementById('goldMenuHealBtn');
        if(_ghBtn){
          const _healCost=200;
          const _pts=state.coop?(state.activeShopPlayer===1?state.score1:state.score2):state.score;
          _ghBtn.disabled=(_pts<_healCost)||(state.gold.hp>=state.gold.max);
          _ghBtn.textContent='Comprar Ouro (200 pts)';
        }
        window._positionMapEntitySelectionMenu(_gm);
      }
      e.stopPropagation();
      return;
    }
    const found=state.sentries.find(t=>(t.hp==null?4:t.hp)>0&&t.x===tx&&t.y===ty);
    if(found){
      _closeAllMapEntitySelectionMenusNoResume();
      state.selectedSentry=found;
      _selectionPause();
      const menu=document.getElementById('sentryMenu');
      if(menu){
        menu.style.display='block';
        const hp=(found.hp==null?4:found.hp);
        const lvl=(found.upLevel||0);
        const upCost=[150,250,400,600][Math.min(lvl,3)];
        document.getElementById('sentryMenuTitle').textContent='Torre Sentinela';
        const _sMaxLv=(typeof SENTRY_MAX_UP_LEVEL!=='undefined'?SENTRY_MAX_UP_LEVEL:4)+1;
        document.getElementById('sentryMenuInfo').textContent='Nível: '+(lvl+1)+'/'+_sMaxLv+' | HP: '+hp+'/4';
        document.getElementById('sentryUpgradeBtn').textContent='Aprimorar ('+upCost+' pts)';
        if(window._refreshSentryMenu) window._refreshSentryMenu(found);
        else { document.getElementById('sentryUpgradeBtn').disabled=(lvl>=SENTRY_MAX_UP_LEVEL)||(state.score<upCost); }
        window._positionMapEntitySelectionMenu(menu);
      }
      e.stopPropagation();
      return;
    }
    // Check espantalho click
    if(state.espantalhos&&state.espantalhos.length&&!state.placingEspantalho&&!state.movingEspantalho){
      const _ef=state.espantalhos.find(e=>e.hp>0&&e.x===tx&&e.y===ty);
      if(_ef){
        _closeAllMapEntitySelectionMenusNoResume();
        state.selectedEspantalho=_ef;
        _selectionPause();
        const _em=document.getElementById('espantalhoMenu');
        if(_em){
          _em.style.display='block';
          if(window._refreshEspantalhoMenu)window._refreshEspantalhoMenu(_ef);
          window._positionMapEntitySelectionMenu(_em);
        }
        e.stopPropagation();return;
      }
    }
    // Check gold mine click
    if(state.goldMines && state.goldMines.length){
      const mineFound=state.goldMines.find(m=>m.hp>0&&m.x===tx&&m.y===ty);
      if(mineFound){
        _closeAllMapEntitySelectionMenusNoResume();
        state.selectedGoldMine=mineFound;
        _selectionPause();
        const menu=document.getElementById('goldMineMenu');
        if(menu){
          menu.style.display='block';
          if(!mineFound.maxHp) mineFound.maxHp = 6 + (mineFound.level||1)*2;
          if(window._refreshGoldMineMenu){ window._refreshGoldMineMenu(mineFound); }
          else {
            const lvl=mineFound.level||1;
            const _h=[5,7,10,13,15],_iv=[3,2,2,1,1];
            const _gmUpCosts3=[100,175,275,400,550]; const upCost=lvl<=4?_gmUpCosts3[lvl-1]:0;
            const healAmt=_h[Math.min(5,Math.max(1,lvl))-1];
            const interval=_iv[Math.min(5,Math.max(1,lvl))-1];
            document.getElementById('goldMineMenuInfo').textContent='Nível: '+lvl+'/5 | HP: '+mineFound.hp+'/'+mineFound.maxHp;
            document.getElementById('goldMineMenuStats').textContent='+'+healAmt+' vida a cada '+interval+' ondas';
            const upgradeBtn=document.getElementById('goldMineUpgradeBtn');
            if(lvl>=5){upgradeBtn.disabled=true;upgradeBtn.textContent='Máx.';}
            else{upgradeBtn.disabled=(state.score<upCost);upgradeBtn.textContent='Aprimorar ('+upCost+' pts)';}
            const hb=document.getElementById('goldMineHealBtn');
            if(hb){ const miss=mineFound.maxHp-mineFound.hp; if(miss<=0){hb.textContent='Reparar (HP cheio)';hb.disabled=true;} else{const hc=Math.max(5,Math.ceil(miss*6.4));hb.textContent='Reparar ('+hc+' pts)';hb.disabled=(state.score<hc);} }
          }
          window._positionMapEntitySelectionMenu(menu);
        }
        e.stopPropagation();
        return;
      }
    }
    // Check piche click
    if(state.pichaPocos && state.pichaPocos.length){
      const ppFound=state.pichaPocos.find(p=>p.x===tx&&p.y===ty);
      if(ppFound){
        _closeAllMapEntitySelectionMenusNoResume();
        state.selectedPichaPoco=ppFound;
        _selectionPause();
        const menu=document.getElementById('pichaPocoMenu');
        if(menu){
          menu.style.display='block';
          const _ppi=document.getElementById('pichaPocoMenuInfo');
          if(_ppi) _ppi.textContent='Nível: 1/1 | HP: —/—';
          try{ if(window._refreshPichaPocoMenu) window._refreshPichaPocoMenu(); }catch(_){}
          window._positionMapEntitySelectionMenu(menu);
        }
        e.stopPropagation(); return;
      }
    }
    // Check barricada click
    if(state.barricadas && state.barricadas.length){
      const barFound=state.barricadas.find(b=>b.hp>0&&b.x===tx&&b.y===ty);
      if(barFound){
        _closeAllMapEntitySelectionMenusNoResume();
        state.selectedBarricada=barFound;
        _selectionPause();
        const menu=document.getElementById('barricadaMenu');
        if(menu){
          menu.style.display='block';
          if(window._refreshBarricadaMenu) window._refreshBarricadaMenu(barFound);
          window._positionMapEntitySelectionMenu(menu);
        }
        e.stopPropagation();
        return;
      }
    }
    // Check portal click
    if(state.portals&&!state.placingPortalBlue&&!state.placingPortalOrange){
      const _pb6=state.portals.blue, _po6=state.portals.orange;
      const _hitPortal=(_pb6&&_pb6.x===tx&&_pb6.y===ty)||(_po6&&_po6.x===tx&&_po6.y===ty);
      if(_hitPortal){
        _closeAllMapEntitySelectionMenusNoResume();
        state.selectedPortal=true;
        _selectionPause();
        const _pm=document.getElementById('portalMenu');
        if(_pm){
          _pm.style.display='block';
          window._positionMapEntitySelectionMenu(_pm);
          document.getElementById('portalMenuInfo').textContent='Nível: 1/1 | HP: —/—';
        }
        e.stopPropagation();
        return;
      }
    }
    // Clicar fora fecha menus e pode despausar (se a pausa era só da seleção)
    _closeAllMapEntitySelectionMenusNoResume();
    _selectionResume();
  });

  // Menu de prioridade do aliado removido

  
  // ─── Face do Cowboy segue o mouse (4 direções) — document: funciona com o cursor fora do canvas (modo mouse+teclado)
  document.addEventListener('mousemove', (e)=>{
    try{
      if (!state || !state.running) return;
      if (state.inMenu) return;
      const _gs2 = window._gameSettings || {};
      if ((_gs2.inputMode || 'mouse') === 'keys') return;
      if (state.pausedShop || state.pausedManual) return;
      if (dialog && dialog.active) return;
      if (state.placingSentry || state.movingSentry || state.placingClearPath || state.placingGoldMine || state.movingGoldMine || state.placingBarricada || state.movingBarricada || state.placingEspantalho || state.movingEspantalho || state.placingPichaPoco || state.movingPichaPoco) return;

      const r = canvas.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const sx = canvas.width / r.width;
      const sy = canvas.height / r.height;
      const rawCx = (e.clientX - r.left) * sx;
      const rawCy = (e.clientY - r.top) * sy;
      const cx = Math.max(0, Math.min(canvas.width, rawCx));
      const cy = Math.max(0, Math.min(canvas.height, rawCy));

      const mx = cx / TILE;
      const my = cy / TILE;

      const p = state.player;
      if (!p) return;

      const px = p.x + 0.5;
      const py = p.y + 0.5;
      const dx = mx - px;
      const dy = my - py;

      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;

      if (Math.abs(dx) >= Math.abs(dy)){
        p.face = (dx >= 0) ? DIRS.right : DIRS.left;
      } else {
        p.face = (dy >= 0) ? DIRS.down : DIRS.up;
      }
    }catch(_){}
  }, { passive: true });

canvas.addEventListener('mousemove',e=>{if(!state||(!state.placingSentry&&!state.movingSentry&&!state.placingClearPath))return;const r=canvas.getBoundingClientRect();state.sentryHoverX=Math.floor((e.clientX-r.left)*(canvas.width/r.width)/TILE);state.sentryHoverY=Math.floor((e.clientY-r.top)*(canvas.height/r.height)/TILE);});
  canvas.addEventListener('mousemove',e=>{if(!state||!state.placingGoldMine&&!state.movingGoldMine&&!state.placingBarricada&&!state.movingBarricada)return;const r=canvas.getBoundingClientRect();state.goldMineHoverX=Math.floor((e.clientX-r.left)*(canvas.width/r.width)/TILE);state.goldMineHoverY=Math.floor((e.clientY-r.top)*(canvas.height/r.height)/TILE);});
  canvas.addEventListener('mousemove',e=>{if(!state||!state.placingPichaPoco&&!state.movingPichaPoco)return;const r=canvas.getBoundingClientRect();state.pichaPocoHoverX=Math.floor((e.clientX-r.left)*(canvas.width/r.width)/TILE);state.pichaPocoHoverY=Math.floor((e.clientY-r.top)*(canvas.height/r.height)/TILE);});
  canvas.addEventListener('mousemove',e=>{if(!state||(!state.placingBarricada&&!state.movingBarricada))return;const r=canvas.getBoundingClientRect();state.barricadaHoverX=Math.floor((e.clientX-r.left)*(canvas.width/r.width)/TILE);state.barricadaHoverY=Math.floor((e.clientY-r.top)*(canvas.height/r.height)/TILE);});
  canvas.addEventListener('mousemove',e=>{if(!state||(!state.placingEspantalho&&!state.movingEspantalho))return;const r=canvas.getBoundingClientRect();state.espantalhoHoverX=Math.floor((e.clientX-r.left)*(canvas.width/r.width)/TILE);state.espantalhoHoverY=Math.floor((e.clientY-r.top)*(canvas.height/r.height)/TILE);});
  canvas.addEventListener('click',e=>{
    if(!state) return;
    const r=canvas.getBoundingClientRect();
    const tx=Math.floor((e.clientX-r.left)*(canvas.width/r.width)/TILE);
    const ty=Math.floor((e.clientY-r.top)*(canvas.height/r.height)/TILE);
    const gx=state.gold.x, gy=state.gold.y;

    // ─── Modo MOVER torre ────────────────────────────────────────
    if(state.movingSentry){
      const t=state.movingSentry;
      const occupied=state.sentries&&state.sentries.some(s=>s!==t&&s.x===tx&&s.y===ty);
      const inv=(Math.abs(tx-gx)<=1&&Math.abs(ty-gy)<=1)||(tx<=0||ty<=0||tx>=GRID_W-1||ty>=GRID_H-1)||isBlocked(tx,ty)||occupied;
      if(inv){try{beep(180,0.06,'sawtooth',0.04);}catch(_){}return;}
      // Efeito na posição antiga (smoke)
      const ocx=t.x*TILE+TILE/2, ocy=t.y*TILE+TILE/2;
      for(let i=0;i<10;i++){const a=Math.random()*Math.PI*2,s=40+Math.random()*60,l=0.3+Math.random()*0.2;state.fx.push({x:ocx,y:ocy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-20,life:l,max:l,color:'#888',size:2+Math.random()*2,grav:80});}
      // Mover torre
      t.x=tx; t.y=ty;
      // Efeito na nova posição (dourado)
      const ncx=tx*TILE+TILE/2, ncy=ty*TILE+TILE/2;
      for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2,s=60+Math.random()*90,l=0.3+Math.random()*0.25;state.fx.push({x:ncx,y:ncy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-35,life:l,max:l,color:i%2?'#f3d23b':'#c97a2b',size:2+Math.random()*2,grav:220});}
      // Som: whoosh + land
      try{beep(520,0.05,'triangle',0.05);setTimeout(()=>beep(380,0.07,'square',0.06),80);setTimeout(()=>beep(660,0.08,'triangle',0.06),160);}catch(_){}
      state._sentryRefund=0;
      state.movingSentry=null;
      state.sentryHoverX=-1; state.sentryHoverY=-1;
      state.pausedManual=false;
      try{pauseBtn.textContent='Pausar';}catch(_){}
      const _mh=document.getElementById('sentryMoveHint');if(_mh)_mh.style.display='none';
      toastMsg('Torre reposicionada!');
      return;
    }

    // ─── Modo COLOCAR nova torre ──────────────────────────────────
    if(!state.placingSentry) return;
    const inv=(Math.abs(tx-gx)<=1&&Math.abs(ty-gy)<=1)||(tx<=0||ty<=0||tx>=GRID_W-1||ty>=GRID_H-1)||isBlocked(tx,ty)||(state.sentries&&state.sentries.some(s=>s.x===tx&&s.y===ty));
    if(inv){try{beep(180,0.06,'sawtooth',0.04);}catch(_){}return;}
    state.sentries.push({x:tx,y:ty,i:state.sentries.length,nextAt:0,hp:4});
    state._sentryRefund=0;
    state.placingSentry=false;
    state.sentryHoverX=-1;state.sentryHoverY=-1;
    state.pausedManual=false;
    try{pauseBtn.textContent='Pausar';}catch(_){}
    const _h=document.getElementById('sentryPlaceHint');if(_h)_h.style.display='none';
    const fcx=tx*TILE+TILE/2,fcy=ty*TILE+TILE/2;
    for(let i=0;i<16;i++){const a=Math.random()*Math.PI*2,s=80+Math.random()*120,l=0.3+Math.random()*0.3;state.fx.push({x:fcx,y:fcy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,life:l,max:l,color:i%2===0?'#6f4e37':'#c97a2b',size:2+Math.random()*2,grav:200});}
    try{beep(440,0.06,'square',0.05);setTimeout(()=>beep(660,0.08,'triangle',0.06),70);setTimeout(()=>beep(880,0.12,'triangle',0.07),160);}catch(_){}
    toastMsg('Torre Sentinela posicionada!');
    try{refreshShopVisibility();if(window._renderShopPage)window._renderShopPage();}catch(_){}
    try{updateHUD();}catch(_){}
  });
  // ─── Modo REMOVER obstáculo (Abrir Caminho) ───────────────────
  canvas.addEventListener('click', e=>{
    if(!state||!state.placingClearPath)return;
    const r=canvas.getBoundingClientRect();
    const tx=Math.floor((e.clientX-r.left)*(canvas.width/r.width)/TILE);
    const ty=Math.floor((e.clientY-r.top)*(canvas.height/r.height)/TILE);
    if(!inBounds(tx,ty))return;
    const tileVal = state.map[ty][tx];
    // Only removable obstacles: types 1,2,5 (not 0=empty, 3=gold, 9=path)
    // Also not sentries or gold mines
    const hasSentry = state.sentries && state.sentries.some(s=>s.x===tx&&s.y===ty);
    const hasMine = state.goldMines && state.goldMines.some(m=>m.x===tx&&m.y===ty);
    if(tileVal===0||tileVal===3||tileVal===9||hasSentry||hasMine){
      try{beep(180,0.06,'sawtooth',0.04);}catch(_){}
      return;
    }
    // Remove obstacle
    state.map[ty][tx] = 0;
    state._clearpathCount = (state._clearpathCount||0)+1;
    state._clearPathRefund = 0;
    state.placingClearPath = false;
    state.pausedManual = false;
    try{pauseBtn.textContent='Pausar';}catch(_){}
    const _ch=document.getElementById('clearPathHint');if(_ch)_ch.style.display='none';
    // Rubble explosion animation
    const ocx=tx*TILE+TILE/2, ocy=ty*TILE+TILE/2;
    for(let i=0;i<22;i++){
      const a=Math.random()*Math.PI*2,s=80+Math.random()*150,l=0.4+Math.random()*0.3;
      const col = i%3===0?'#7a6040':i%3===1?'#4a7a30':'#c8a060';
      state.fx.push({x:ocx,y:ocy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-60,life:l,max:l,color:col,size:2+Math.random()*3,grav:320});
    }
    // Rebuild background to remove the obstacle visually
    try{buildBackground();}catch(_){}
    // Sound: rock crack / rubble thud - more natural
    try{
      beep(180,0.08,'triangle',0.07);
      setTimeout(()=>beep(140,0.10,'sine',0.08),50);
      setTimeout(()=>beep(100,0.09,'sine',0.07),130);
      setTimeout(()=>beep(70,0.07,'sine',0.05),230);
    }catch(_){}
    toastMsg('Obstáculo removido!');
    try{refreshShopVisibility();if(window._renderShopPage)window._renderShopPage();}catch(_){}
    try{updateHUD();}catch(_){}
  });
  // ─── Modo COLOCAR Mina de Ouro ────────────────────────────────
  canvas.addEventListener('click', e=>{
    if(!state||!state.placingGoldMine)return;
    const r=canvas.getBoundingClientRect();
    const tx=Math.floor((e.clientX-r.left)*(canvas.width/r.width)/TILE);
    const ty=Math.floor((e.clientY-r.top)*(canvas.height/r.height)/TILE);
    if(!inBounds(tx,ty))return;
    const gx=state.gold.x,gy=state.gold.y;
    const occupied=(state.sentries&&state.sentries.some(s=>s.x===tx&&s.y===ty))||
                   (state.goldMines&&state.goldMines.some(m=>m.x===tx&&m.y===ty))||
                   (state.barricadas&&state.barricadas.some(b=>b.x===tx&&b.y===ty));
    const inv=(Math.abs(tx-gx)<=1&&Math.abs(ty-gy)<=1)||(tx<=0||ty<=0||tx>=GRID_W-1||ty>=GRID_H-1)||isBlocked(tx,ty)||occupied;
    if(inv){try{beep(180,0.06,'sawtooth',0.04);}catch(_){}return;}
    if(!state.goldMines)state.goldMines=[];
    state.goldMines.push({x:tx,y:ty,level:1,hp:8,maxHp:8,lastGoldWave:state.wave,warnT:0});
    state._goldMineRefund=0;
    state.placingGoldMine=false;
    state.goldMineHoverX=-1;state.goldMineHoverY=-1;
    state.pausedManual=false;
    try{pauseBtn.textContent='Pausar';}catch(_){}
    const _gh=document.getElementById('goldMinePlaceHint');if(_gh)_gh.style.display='none';
    const fcx=tx*TILE+TILE/2,fcy=ty*TILE+TILE/2;
    for(let i=0;i<18;i++){const a=Math.random()*Math.PI*2,s=70+Math.random()*110,l=0.35+Math.random()*0.3;state.fx.push({x:fcx,y:fcy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-45,life:l,max:l,color:i%2===0?'#f3d23b':'#c97a2b',size:2+Math.random()*2,grav:220});}
    try{beep(523,0.07,'triangle',0.06);setTimeout(()=>beep(659,0.07,'triangle',0.07),80);setTimeout(()=>beep(784,0.10,'triangle',0.08),160);}catch(_){}
    toastMsg('Mina de Ouro posicionada!');
    try{refreshShopVisibility();if(window._renderShopPage)window._renderShopPage();}catch(_){}
    try{updateHUD();}catch(_){}
  });
  // ─── Modo MOVER Mina de Ouro ─────────────────────────────────
  canvas.addEventListener('click', e=>{
    if(!state||!state.movingGoldMine)return;
    const r=canvas.getBoundingClientRect();
    const tx=Math.floor((e.clientX-r.left)*(canvas.width/r.width)/TILE);
    const ty=Math.floor((e.clientY-r.top)*(canvas.height/r.height)/TILE);
    if(!inBounds(tx,ty))return;
    const m=state.movingGoldMine;
    const gx=state.gold.x,gy=state.gold.y;
    const occupied=(state.sentries&&state.sentries.some(s=>s.x===tx&&s.y===ty))||(state.goldMines&&state.goldMines.some(_m=>_m!==m&&_m.x===tx&&_m.y===ty))||(state.barricadas&&state.barricadas.some(b=>b.x===tx&&b.y===ty));
    const inv=(Math.abs(tx-gx)<=1&&Math.abs(ty-gy)<=1)||(tx<=0||ty<=0||tx>=GRID_W-1||ty>=GRID_H-1)||isBlocked(tx,ty)||occupied;
    if(inv){try{beep(180,0.06,'sawtooth',0.04);}catch(_){}return;}
    const ocx=m.x*TILE+TILE/2,ocy=m.y*TILE+TILE/2;
    for(let i=0;i<10;i++){const a=Math.random()*Math.PI*2,s=40+Math.random()*60,l=0.3+Math.random()*0.2;state.fx.push({x:ocx,y:ocy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-20,life:l,max:l,color:'#888',size:2+Math.random()*2,grav:80});}
    m.x=tx; m.y=ty;
    const ncx=tx*TILE+TILE/2,ncy=ty*TILE+TILE/2;
    for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2,s=60+Math.random()*90,l=0.3+Math.random()*0.25;state.fx.push({x:ncx,y:ncy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-35,life:l,max:l,color:i%2?'#f3d23b':'#c97a2b',size:2+Math.random()*2,grav:220});}
    try{beep(520,0.05,'triangle',0.05);setTimeout(()=>beep(380,0.07,'square',0.06),80);setTimeout(()=>beep(660,0.08,'triangle',0.06),160);}catch(_){}
    state._goldMineRefund=0;
    state.movingGoldMine=null;
    state.goldMineHoverX=-1;state.goldMineHoverY=-1;
    state.pausedManual=false;
    try{pauseBtn.textContent='Pausar';}catch(_){}
    const _mh=document.getElementById('goldMineMoveHint');if(_mh)_mh.style.display='none';
    toastMsg('Mina reposicionada!');
  });
  // ─── Modo COLOCAR / MOVER Espantalho ──────────────────────────
  canvas.addEventListener('click', e=>{
    if(!state||(!state.placingEspantalho&&!state.movingEspantalho))return;
    const r=canvas.getBoundingClientRect();
    const tx=Math.floor((e.clientX-r.left)*(canvas.width/r.width)/TILE);
    const ty=Math.floor((e.clientY-r.top)*(canvas.height/r.height)/TILE);
    if(!inBounds(tx,ty))return;
    const gx=state.gold.x,gy=state.gold.y;
    const _me=state.movingEspantalho;
    const occupied=(state.sentries&&state.sentries.some(s=>s.x===tx&&s.y===ty))||(state.goldMines&&state.goldMines.some(m=>m.x===tx&&m.y===ty))||(state.barricadas&&state.barricadas.some(b=>b.x===tx&&b.y===ty))||(state.espantalhos&&state.espantalhos.some(e=>e!==_me&&e.x===tx&&e.y===ty));
    const inv=(Math.abs(tx-gx)<=1&&Math.abs(ty-gy)<=1)||(tx<=0||ty<=0||tx>=GRID_W-1||ty>=GRID_H-1)||isBlocked(tx,ty)||occupied;
    if(inv){try{beep(180,0.06,'sawtooth',0.04);}catch(_){}return;}
    if(_me){
      // Mover
      const ocx=_me.x*TILE+TILE/2,ocy=_me.y*TILE+TILE/2;
      for(let i=0;i<10;i++){const a=Math.random()*Math.PI*2,s=40+Math.random()*60,l=0.3+Math.random()*0.2;state.fx.push({x:ocx,y:ocy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-20,life:l,max:l,color:'#888',size:2+Math.random()*2,grav:80});}
      _me.x=tx;_me.y=ty;
      const ncx=tx*TILE+TILE/2,ncy=ty*TILE+TILE/2;
      for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2,s=60+Math.random()*90,l=0.3+Math.random()*0.25;state.fx.push({x:ncx,y:ncy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-35,life:l,max:l,color:i%2?'#f3d23b':'#c97a2b',size:2+Math.random()*2,grav:220});}
      try{beep(520,0.05,'triangle',0.05);setTimeout(()=>beep(380,0.07,'square',0.06),80);setTimeout(()=>beep(660,0.08,'triangle',0.06),160);}catch(_){}
      state._espantalhoRefund=0;
      state.movingEspantalho=null;
      const _mh=document.getElementById('espantalhoMoveHint');if(_mh)_mh.style.display='none';
      toastMsg('Espantalho reposicionado!');
    } else {
      // Colocar novo
      if(!state.espantalhos)state.espantalhos=[];
      const _st0=espantalhoStats(1);
      state.espantalhos.push({x:tx,y:ty,hp:_st0.maxHp,maxHp:_st0.maxHp,level:1,warnT:0,_dmgTimer:0});
      state._espantalhoRefund=0;
      const fcx=tx*TILE+TILE/2,fcy=ty*TILE+TILE/2;
      for(let i=0;i<16;i++){const a=Math.random()*Math.PI*2,s=80+Math.random()*120,l=0.3+Math.random()*0.3;state.fx.push({x:fcx,y:fcy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,life:l,max:l,color:i%2===0?'#8b5a2b':'#c97a2b',size:2+Math.random()*2,grav:200});}
      try{beep(440,0.06,'square',0.05);setTimeout(()=>beep(660,0.08,'triangle',0.06),70);setTimeout(()=>beep(880,0.12,'triangle',0.07),160);}catch(_){}
      toastMsg('Espantalho posicionado!');
      const _ph=document.getElementById('espantalhoPlaceHint');if(_ph)_ph.style.display='none';
      try{refreshShopVisibility();if(window._renderShopPage)window._renderShopPage();}catch(_){}
      try{updateHUD();}catch(_){}
    }
    state.placingEspantalho=false;state.espantalhoHoverX=-1;state.espantalhoHoverY=-1;
    state.pausedManual=false;try{pauseBtn.textContent='Pausar';}catch(_){}
  });
  // ─── Modo COLOCAR Poça de Piche ──────────────────────────────
  canvas.addEventListener('click', e=>{
    if(!state||!state.placingPichaPoco)return;
    const r=canvas.getBoundingClientRect();
    const tx=Math.floor((e.clientX-r.left)*(canvas.width/r.width)/TILE);
    const ty=Math.floor((e.clientY-r.top)*(canvas.height/r.height)/TILE);
    if(!inBounds(tx,ty))return;
    const gx=state.gold.x,gy=state.gold.y;
    // Piche NÃO bloqueia, mas não empilha no mesmo tile
    const occupied=(state.pichaPocos&&state.pichaPocos.some(p=>p.x===tx&&p.y===ty));
    const inv=(Math.abs(tx-gx)<=1&&Math.abs(ty-gy)<=1)||(tx<=0||ty<=0||tx>=GRID_W-1||ty>=GRID_H-1)||isBlocked(tx,ty)||occupied;
    if(inv){try{beep(180,0.06,'sawtooth',0.04);}catch(_){}return;}
    if(!state.pichaPocos)state.pichaPocos=[];
    state.pichaPocos.push({x:tx,y:ty});
    state._pichaPocoRefund=0;
    state.placingPichaPoco=false;
    state.pichaPocoHoverX=-1;state.pichaPocoHoverY=-1;
    state.pausedManual=false;
    try{pauseBtn.textContent='Pausar';}catch(_){}
    const _pph=document.getElementById('pichaPocoPlaceHint');if(_pph)_pph.style.display='none';
    const fcx=tx*TILE+TILE/2,fcy=ty*TILE+TILE/2;
    for(let i=0;i<10;i++){const a=Math.random()*Math.PI*2,s=40+Math.random()*60,l=0.4+Math.random()*0.3;state.fx.push({x:fcx,y:fcy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-20,life:l,max:l,color:i%2?'#111111':'#333333',size:2+Math.random()*3,grav:180});}
    try{beep(220,0.08,'sawtooth',0.06);setTimeout(()=>beep(180,0.07,'sawtooth',0.05),80);}catch(_){}
    refreshShopVisibility();
  });
  // ─── Modo MOVER Poça de Piche ─────────────────────────────────
  canvas.addEventListener('click', e=>{
    if(!state||!state.movingPichaPoco)return;
    const r=canvas.getBoundingClientRect();
    const tx=Math.floor((e.clientX-r.left)*(canvas.width/r.width)/TILE);
    const ty=Math.floor((e.clientY-r.top)*(canvas.height/r.height)/TILE);
    if(!inBounds(tx,ty))return;
    const pp=state.movingPichaPoco;
    const gx=state.gold.x,gy=state.gold.y;
    const occupied=(state.pichaPocos&&state.pichaPocos.some(p=>p!==pp&&p.x===tx&&p.y===ty));
    const inv=(Math.abs(tx-gx)<=1&&Math.abs(ty-gy)<=1)||(tx<=0||ty<=0||tx>=GRID_W-1||ty>=GRID_H-1)||isBlocked(tx,ty)||occupied;
    if(inv){try{beep(180,0.06,'sawtooth',0.04);}catch(_){}return;}
    const ocx=pp.x*TILE+TILE/2,ocy=pp.y*TILE+TILE/2;
    for(let i=0;i<10;i++){const a=Math.random()*Math.PI*2,s=40+Math.random()*60,l=0.3+Math.random()*0.2;state.fx.push({x:ocx,y:ocy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-20,life:l,max:l,color:'#888',size:2+Math.random()*2,grav:80});}
    pp.x=tx;pp.y=ty;
    const ncx=tx*TILE+TILE/2,ncy=ty*TILE+TILE/2;
    for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2,s=60+Math.random()*90,l=0.3+Math.random()*0.25;state.fx.push({x:ncx,y:ncy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-35,life:l,max:l,color:i%2?'#1a3a1a':'#2a5a2a',size:2+Math.random()*2,grav:220});}
    try{beep(520,0.05,'triangle',0.05);setTimeout(()=>beep(380,0.07,'square',0.06),80);setTimeout(()=>beep(660,0.08,'triangle',0.06),160);}catch(_){}
    state._pichaPocoRefund=0;
    state.movingPichaPoco=null;
    state.pichaPocoHoverX=-1;state.pichaPocoHoverY=-1;
    state.pausedManual=false;
    try{pauseBtn.textContent='Pausar';}catch(_){}
    const _mh=document.getElementById('pichaPocoMoveHint');if(_mh)_mh.style.display='none';
    toastMsg('Poça de Piche reposicionada!');
    try{updateHUD();}catch(_){}
  });

  // ─── Modo COLOCAR Barricada ───────────────────────────────────
  canvas.addEventListener('click', e=>{
    if(!state||!state.placingBarricada)return;
    const r=canvas.getBoundingClientRect();
    const tx=Math.floor((e.clientX-r.left)*(canvas.width/r.width)/TILE);
    const ty=Math.floor((e.clientY-r.top)*(canvas.height/r.height)/TILE);
    if(!inBounds(tx,ty))return;
    const gx=state.gold.x,gy=state.gold.y;
    const occupied=(state.sentries&&state.sentries.some(s=>s.x===tx&&s.y===ty))||(state.goldMines&&state.goldMines.some(m=>m.x===tx&&m.y===ty))||(state.barricadas&&state.barricadas.some(b=>b.x===tx&&b.y===ty));
    const inv=(Math.abs(tx-gx)<=1&&Math.abs(ty-gy)<=1)||(tx<=0||ty<=0||tx>=GRID_W-1||ty>=GRID_H-1)||isBlocked(tx,ty)||occupied;
    if(inv){try{beep(180,0.06,'sawtooth',0.04);}catch(_){}return;}
    if(!state.barricadas)state.barricadas=[];
    const _bh0 = (window.BARRICADA_MAX_HP_BY_LEVEL && window.BARRICADA_MAX_HP_BY_LEVEL[1]) || 60;
    state.barricadas.push({x:tx,y:ty,level:1,hp:_bh0,maxHp:_bh0,warnT:0});
    state._barricadaRefund=0;
    state.placingBarricada=false;
    state.barricadaHoverX=-1;state.barricadaHoverY=-1;
    state.pausedManual=false;
    try{pauseBtn.textContent='Pausar';}catch(_){}
    const _bh=document.getElementById('barricadaPlaceHint');if(_bh)_bh.style.display='none';
    const fcx=tx*TILE+TILE/2,fcy=ty*TILE+TILE/2;
    for(let i=0;i<16;i++){const a=Math.random()*Math.PI*2,s=65+Math.random()*100,l=0.3+Math.random()*0.28;state.fx.push({x:fcx,y:fcy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,life:l,max:l,color:i%2?'#8b5a2b':'#c97a2b',size:2+Math.random()*2,grav:210});}
    try{beep(440,0.06,'square',0.05);setTimeout(()=>beep(560,0.07,'triangle',0.06),70);setTimeout(()=>beep(700,0.10,'triangle',0.07),150);}catch(_){}
    toastMsg('Barricada posicionada!');
    try{refreshShopVisibility();if(window._renderShopPage)window._renderShopPage();}catch(_){}
    try{updateHUD();}catch(_){}
  });
  // ─── Modo MOVER Barricada ─────────────────────────────────────
  canvas.addEventListener('click', e=>{
    if(!state||!state.movingBarricada)return;
    const r=canvas.getBoundingClientRect();
    const tx=Math.floor((e.clientX-r.left)*(canvas.width/r.width)/TILE);
    const ty=Math.floor((e.clientY-r.top)*(canvas.height/r.height)/TILE);
    if(!inBounds(tx,ty))return;
    const b=state.movingBarricada;
    const gx=state.gold.x,gy=state.gold.y;
    const occupied=(state.sentries&&state.sentries.some(s=>s.x===tx&&s.y===ty))||(state.goldMines&&state.goldMines.some(m=>m.x===tx&&m.y===ty))||(state.barricadas&&state.barricadas.some(_b=>_b!==b&&_b.x===tx&&_b.y===ty));
    const inv=(Math.abs(tx-gx)<=1&&Math.abs(ty-gy)<=1)||(tx<=0||ty<=0||tx>=GRID_W-1||ty>=GRID_H-1)||isBlocked(tx,ty)||occupied;
    if(inv){try{beep(180,0.06,'sawtooth',0.04);}catch(_){}return;}
    const ocx=b.x*TILE+TILE/2,ocy=b.y*TILE+TILE/2;
    for(let i=0;i<10;i++){const a=Math.random()*Math.PI*2,s=40+Math.random()*60,l=0.3+Math.random()*0.2;state.fx.push({x:ocx,y:ocy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-20,life:l,max:l,color:'#888',size:2+Math.random()*2,grav:80});}
    b.x=tx; b.y=ty;
    const ncx=tx*TILE+TILE/2,ncy=ty*TILE+TILE/2;
    for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2,s=60+Math.random()*90,l=0.3+Math.random()*0.25;state.fx.push({x:ncx,y:ncy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-35,life:l,max:l,color:i%2?'#8b5a2b':'#c97a2b',size:2+Math.random()*2,grav:220});}
    try{beep(520,0.05,'triangle',0.05);setTimeout(()=>beep(380,0.07,'square',0.06),80);setTimeout(()=>beep(660,0.08,'triangle',0.06),160);}catch(_){}
    state._barricadaRefund=0;
    state.movingBarricada=null;
    state.barricadaHoverX=-1;state.barricadaHoverY=-1;
    state.pausedManual=false;
    try{pauseBtn.textContent='Pausar';}catch(_){}
    const _mh=document.getElementById('barricadaMoveHint');if(_mh)_mh.style.display='none';
    toastMsg('Barricada reposicionada!');
  });

  // ─── Portal: mousemove hover ─────────────────────────────────
  canvas.addEventListener('mousemove', e=>{
    if(!state||(!state.placingPortalBlue&&!state.placingPortalOrange))return;
    const r=canvas.getBoundingClientRect();
    state.portalHoverX=Math.floor((e.clientX-r.left)*(canvas.width/r.width)/TILE);
    state.portalHoverY=Math.floor((e.clientY-r.top)*(canvas.height/r.height)/TILE);
  });

  // ─── Portal: click colocar ────────────────────────────────────
  canvas.addEventListener('click', e=>{
    if(!state||(!state.placingPortalBlue&&!state.placingPortalOrange))return;
    const r=canvas.getBoundingClientRect();
    const tx=Math.floor((e.clientX-r.left)*(canvas.width/r.width)/TILE);
    const ty=Math.floor((e.clientY-r.top)*(canvas.height/r.height)/TILE);
    if(!inBounds(tx,ty))return;
    const gx=state.gold.x,gy=state.gold.y;
    // Inválido: bordas, adjacentes ao ouro (incluindo diagonais), bloqueados
    const borderInv=(tx<=0||ty<=0||tx>=GRID_W-1||ty>=GRID_H-1);
    const goldInv=(Math.abs(tx-gx)<=1&&Math.abs(ty-gy)<=1);
    const occupied=isBlocked(tx,ty)||
      (state.portals&&((state.portals.blue&&state.portals.blue.x===tx&&state.portals.blue.y===ty)||
                       (state.portals.orange&&state.portals.orange.x===tx&&state.portals.orange.y===ty)));
    if(borderInv||goldInv||occupied){try{beep(180,0.06,'sawtooth',0.04);}catch(_){}return;}

    if(state.placingPortalBlue){
      if(!state.portals)state.portals={};
      state.portals.blue={x:tx,y:ty};
      state.placingPortalBlue=false;
      state.placingPortalOrange=true;
      state.portalHoverX=-1; state.portalHoverY=-1;
      const _hb=document.getElementById('portalBlueHint');if(_hb)_hb.style.display='none';
      const _ho=document.getElementById('portalOrangeHint');if(_ho)_ho.style.display='block';
      // FX + som portal azul
      const fcx=tx*TILE+TILE/2,fcy=ty*TILE+TILE/2;
      for(let i=0;i<22;i++){const a=Math.random()*Math.PI*2,s=50+Math.random()*100,l=0.28+Math.random()*0.32;state.fx.push({x:fcx,y:fcy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,life:l,max:l,color:i%3===0?'#ffffff':i%3===1?'#2060ff':'#60c0ff',size:1.5+Math.random()*3,grav:60});}
      // Anel de partículas orbitando (efeito portal se abrindo)
      for(let i=0;i<12;i++){const a=(i/12)*Math.PI*2,r=10,vt=60;state.fx.push({x:fcx+Math.cos(a)*r,y:fcy+Math.sin(a)*r,vx:-Math.sin(a)*vt,vy:Math.cos(a)*vt,life:0.5,max:0.5,color:'#2060ff',size:2.5,grav:0});}
      try{beep(300,0.04,'sine',0.04);setTimeout(()=>beep(550,0.06,'sine',0.06),60);setTimeout(()=>beep(880,0.09,'sine',0.08),130);setTimeout(()=>beep(1100,0.11,'triangle',0.09),220);}catch(_){}
      toastMsg('Portal Azul posicionado! Coloque o Laranja.');
    } else if(state.placingPortalOrange){
      if(state.portals&&state.portals.blue&&state.portals.blue.x===tx&&state.portals.blue.y===ty){
        try{beep(180,0.06,'sawtooth',0.04);}catch(_){}return;
      }
      if(!state.portals)state.portals={};
      state.portals.orange={x:tx,y:ty};
      state._portalRefund=0;
      state.placingPortalOrange=false;
      state.portalHoverX=-1; state.portalHoverY=-1;
      state.pausedManual=false;
      try{pauseBtn.textContent='Pausar';}catch(_){}
      const _ho=document.getElementById('portalOrangeHint');if(_ho)_ho.style.display='none';
      // FX + som portal laranja + fanfarra de par completo
      const fcx=tx*TILE+TILE/2,fcy=ty*TILE+TILE/2;
      for(let i=0;i<22;i++){const a=Math.random()*Math.PI*2,s=50+Math.random()*100,l=0.28+Math.random()*0.32;state.fx.push({x:fcx,y:fcy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,life:l,max:l,color:i%3===0?'#ffffff':i%3===1?'#ff8020':'#ffb060',size:1.5+Math.random()*3,grav:60});}
      for(let i=0;i<12;i++){const a=(i/12)*Math.PI*2,r=10,vt=60;state.fx.push({x:fcx+Math.cos(a)*r,y:fcy+Math.sin(a)*r,vx:-Math.sin(a)*vt,vy:Math.cos(a)*vt,life:0.5,max:0.5,color:'#ff8020',size:2.5,grav:0});}
      // Feixe de luz entre os dois portais (FX de linha de partículas)
      const _pb5=state.portals.blue;
      const bcx=_pb5.x*TILE+TILE/2,bcy=_pb5.y*TILE+TILE/2;
      const steps=12;
      for(let i=0;i<steps;i++){const t2=i/steps;const bx=bcx+(fcx-bcx)*t2,by=bcy+(fcy-bcy)*t2;const l2=0.4+Math.random()*0.25;state.fx.push({x:bx,y:by,vx:(Math.random()-0.5)*20,vy:(Math.random()-0.5)*20,life:l2,max:l2,color:i%2?'#2060ff':'#ff8020',size:2+Math.random()*2,grav:0});}
      try{beep(300,0.04,'sine',0.04);setTimeout(()=>beep(550,0.06,'sine',0.06),60);setTimeout(()=>beep(880,0.08,'sine',0.08),130);setTimeout(()=>beep(1100,0.10,'triangle',0.09),200);setTimeout(()=>beep(1320,0.13,'triangle',0.10),290);}catch(_){}
      toastMsg('Portais ativos! Passe por eles para teleportar.');
      try{refreshShopVisibility();if(window._renderShopPage)window._renderShopPage();}catch(_){}
      try{updateHUD();}catch(_){}
    }
  });

  // crop 1 tile from the left for symmetrical view
  

  // HUD
  const goldHPLabel = document.getElementById("goldHPLabel");
  const goldHPFill  = document.getElementById("goldHPFill");
  const scoreLabel  = document.getElementById("scoreLabel");
  const playerHPLabel = document.getElementById("playerHPLabel");
  const playerHPFill  = document.getElementById("playerHPFill");
  const playerHUDGroup = document.getElementById("playerHUDGroup");
  const playerHPBar = document.getElementById("playerHPBar");
  const scoreLabelShop  = document.getElementById("scoreLabelShop");
  const cooldownLabel = document.getElementById("cooldownLabel");
  const rollCdWrap = document.getElementById("rollCdWrap");
  const rollCdLabel = document.getElementById("rollCdLabel");
  const cooldownAimWrap = document.getElementById("cooldownAimWrap");
  const cooldownAimLabel = document.getElementById("cooldownAimLabel");
  const saraivadaCdWrap = document.getElementById("saraivadaCdWrap");
  const saraivadaCdLabel = document.getElementById("saraivadaCdLabel");
  const waveLabel = document.getElementById("waveLabel");
  const pauseBtn = document.getElementById("pauseBtn");
  const shopBtn = document.getElementById("shopBtn");
  const shopModal = document.getElementById("shopModal");
  const closeShop = document.getElementById("closeShop");
  const bossName = document.getElementById("bossName");
  const bossBar = document.getElementById("bossBar");
  const bossBarFill = document.getElementById("bossBarFill");
  function resetBossBarUi(hideMain){
    try{
      const gbw = document.getElementById("geminiBarsWrap");
      if (gbw){
        gbw.style.display = "none";
        gbw.style.opacity = "";
        gbw.style.transform = "";
        gbw.style.transition = "";
      }
      const bmr = document.getElementById("bossRowMain");
      if (bmr) bmr.style.display = "flex";
      const r1 = document.getElementById("geminiRow1");
      if (r1) r1.style.display = "flex";
      const r2 = document.getElementById("geminiRow2");
      if (r2) r2.style.display = "flex";
      const g1f = document.getElementById("geminiBar1Fill");
      if (g1f) g1f.style.width = "0%";
      const g2f = document.getElementById("geminiBar2Fill");
      if (g2f) g2f.style.width = "0%";
    }catch(_){}
    if (hideMain !== false){
      try{
        bossName.style.visibility = "hidden";
        bossName.style.opacity = "0";
        bossBar.style.visibility = "hidden";
        bossBarFill.style.width = "0%";
      }catch(_){}
    }
  }
  // toast criado dinamicamente via toastMsg()

  // Coop UI elements
  const btnCoop = document.getElementById("btnCoop");
  const coopOverlay = document.getElementById("coopOverlay");
  const btnStartCoop = document.getElementById("btnStartCoop");
  const btnCancelCoop = document.getElementById("btnCancelCoop");
  // New coop screen elements
  const coopScreen = document.getElementById("coopScreen");
  const coopBackBtn = document.getElementById("coopBackBtn");
  const btnCoopStart = document.getElementById("btnCoopStart");
  const player1HUD = document.getElementById("player1HUD");
  const player2HUD = document.getElementById("player2HUD");
  const p1HPLabel = document.getElementById("p1HPLabel");
  const p1HPFill  = document.getElementById("p1HPFill");
  const p1ScoreLabel = document.getElementById("p1ScoreLabel");
  const p1CdLabel  = document.getElementById("p1CdLabel");
  const p1ShopBtn  = document.getElementById("p1ShopBtn");
  const p2HPLabel = document.getElementById("p2HPLabel");
  const p2HPFill  = document.getElementById("p2HPFill");
  const p2ScoreLabel = document.getElementById("p2ScoreLabel");
  const p2CdLabel  = document.getElementById("p2CdLabel");
  const p2ShopBtn  = document.getElementById("p2ShopBtn");
  const shopHeading = document.getElementById("shopHeading");

  // Additional elements for coop
  // Shop card element (for color themes)
  const shopCard = document.getElementById("shopCard");
  // Roll cooldown labels for each player
  const p1RollLabel = document.getElementById("p1RollLabel");
  const p2RollLabel = document.getElementById("p2RollLabel");
  // Additional coop HUD row elements for toggling visibility
  const p1HPRow = document.getElementById("p1HPRow");
  const p1HPBarEl = document.getElementById("p1HPBar");
  const p2HPRow = document.getElementById("p2HPRow");
  const p2HPBarEl = document.getElementById("p2HPBar");
  const p1RollRow = document.getElementById("p1RollRow");
  const p2RollRow = document.getElementById("p2RollRow");
  const p1CdRow = document.getElementById("p1CdRow");
  const p2CdRow = document.getElementById("p2CdRow");

  
/*__MENU_SAFE_LISTENERS__*/
(function(){
  // Substitui o comportamento do botão "Jogar" para abrir a tela de
  // seleção de modo em vez de iniciar o jogo imediatamente. Isso
  // permite ao jogador escolher entre Modo Infinito (com seleção de
  // mapas) e Modo História (indisponível por ora).
  const s = document.getElementById("btnStart");
  const exitBtn = document.getElementById("btnExit");
  if (s && !s._bound){
    s._bound = true;
    s.addEventListener("click", () => {
      try{
        // esconder o menu principal
        const menuScr = document.getElementById('menuScreen');
        if (menuScr){ menuScr.style.display = 'none'; menuScr.setAttribute('aria-hidden','true'); }
        // exibir a tela de modos
        const modeScr = document.getElementById('modeScreen');
        if (modeScr){ modeScr.style.display = 'flex'; modeScr.setAttribute('aria-hidden','false'); }
        // ocultar o botão de zoom (lupa) enquanto na tela de seleção de modo
        try{
          const zw = document.getElementById('zoomWrap');
          if (zw){ zw.style.display = 'none'; }
        }catch(_){}
      }catch(_){}
    });
  }
  if (exitBtn && !exitBtn._bound){
    exitBtn._bound = true;
    exitBtn.addEventListener("click", () => {
      try{
        if (window.__defendaNativeStore && typeof window.__defendaNativeStore.exitApp === 'function'){
          window.__defendaNativeStore.exitApp();
          return;
        }
      }catch(_){}
      try{ window.close(); }catch(_){}
    });
  }
})();
// Coop menu button listeners
(function(){
  const coopModeBackBtn = document.getElementById('coopModeBackBtn');
  const btnCoopLocal = document.getElementById('btnCoopLocal');
  if (btnCoop && !btnCoop._bound){
    btnCoop._bound = true;
    btnCoop.addEventListener("click", () => {
      // Ir para tela de seleção de tipo de coop (local ou online)
      try{
        // Oculta o menu principal
        const menuScr = document.getElementById('menuScreen');
        if (menuScr){ menuScr.style.display = 'none'; menuScr.setAttribute('aria-hidden','true'); }
        // Exibe a tela de escolha de modo cooperativo
        const selectScr = document.getElementById('coopModeSelectScreen');
        if (selectScr){ selectScr.style.display = 'flex'; selectScr.setAttribute('aria-hidden','false'); }
        // Oculta o botão de lupa/zoom
        const zw = document.getElementById('zoomWrap');
        if (zw){ zw.style.display = 'none'; }
        // Esconde jogo e HUD enquanto navega em coop
        try{ hideGameLayer(); }catch(_){}
      }catch(_){}
    });
  }
  if (coopModeBackBtn && !coopModeBackBtn._bound){
    coopModeBackBtn._bound = true;
    coopModeBackBtn.addEventListener("click", () => {
      try{
        const selectScr = document.getElementById('coopModeSelectScreen');
        if (selectScr){ selectScr.style.display = 'none'; selectScr.setAttribute('aria-hidden','true'); }
        const menuScr = document.getElementById('menuScreen');
        if (menuScr){ menuScr.style.display = 'flex'; menuScr.setAttribute('aria-hidden','false'); }
        const zw = document.getElementById('zoomWrap');
        if (zw){ zw.style.display = ''; }
        hideGameLayer();
      }catch(_){}
    });
  }
  if (btnCoopLocal && !btnCoopLocal._bound){
    btnCoopLocal._bound = true;
    btnCoopLocal.addEventListener("click", () => {
      try{
        const selectScr = document.getElementById('coopModeSelectScreen');
        if (selectScr){ selectScr.style.display = 'none'; selectScr.setAttribute('aria-hidden','true'); }
        const coopScr = document.getElementById("coopScreen");
        if (coopScr){ coopScr.style.display = "flex"; coopScr.setAttribute("aria-hidden","false"); }
      }catch(_){}
    });
  }
  // back button on coop screen
  if (coopBackBtn && !coopBackBtn._bound){
    coopBackBtn._bound = true;
    coopBackBtn.addEventListener("click", () => {
      const coopScr = document.getElementById("coopScreen");
      if (coopScr){ coopScr.style.display = "none"; coopScr.setAttribute("aria-hidden","true"); }
      const menuScr = document.getElementById("menuScreen");
      if (menuScr){ menuScr.style.display = "flex"; menuScr.setAttribute("aria-hidden","false"); }
      // Restore zoom button when leaving coop screen
      try{
        const zw = document.getElementById("zoomWrap");
        if (zw) zw.style.display = "";
      }catch(_){}
      // Reset coop flag so single‑player behaves normally
      if (state){ state.coop = false; }
    });
  }
  // start button on coop screen
  if (btnCoopStart && !btnCoopStart._bound){
    btnCoopStart._bound = true;
      btnCoopStart.addEventListener("click", () => {
        const coopScr = document.getElementById("coopScreen");
        if (coopScr){ coopScr.style.display = "none"; coopScr.setAttribute("aria-hidden","true"); }
        // Show game and HUD when starting local coop
        try{ showGameLayer(); }catch(_){}
        startCoopGame();
      });
  }
  // maintain legacy overlay close buttons (unused in new coop screen)
  if (btnCancelCoop && !btnCancelCoop._bound){
    btnCancelCoop._bound = true;
    btnCancelCoop.addEventListener("click", () => {
      coopOverlay.style.display = "none";
      coopOverlay.setAttribute("aria-hidden","true");
    });
  }
  if (btnStartCoop && !btnStartCoop._bound){
    btnStartCoop._bound = true;
    btnStartCoop.addEventListener("click", () => {
      coopOverlay.style.display = "none";
      coopOverlay.setAttribute("aria-hidden","true");
      startCoopGame();
    });
  }
})();

// === Modo e Mapa: listeners de navegação ===
// Esta IIFE configura os botões da nova interface de seleção de modo e mapa.
// Ela garante que os elementos só recebam um único ouvinte e que os mapas
// exibam pré‑visualizações temáticas ao serem mostrados. A lógica é isolada
// aqui para evitar conflitos com outros event listeners.
(function(){
  // Função auxiliar: desenhar as prévias nos cartões de mapa. Só é chamada
  // quando a tela de mapas é exibida. Itera sobre todos os <canvas> dentro
  // de .map-card e usa drawPreview do respectivo MAP_DEFS para preencher.
  function renderMapPreviews(){
    const cards = document.querySelectorAll('.map-card');
    cards.forEach(card => {
      const mapId = card.dataset.mapId;
      const def = MAP_DEFS[mapId] || MAP_DEFS.desert;
      const canvas = card.querySelector('canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      // limpar
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      try {
        def.drawPreview(ctx, canvas.width, canvas.height);
      } catch(e) {
        // fallback: cor simples
        ctx.fillStyle = def.colors ? def.colors.mid : '#3b2a10';
        ctx.fillRect(0,0,canvas.width,canvas.height);
      }
    });
  }

  // voltar da tela de modos para o menu principal
  const modeBackBtn = document.getElementById('modeBackBtn');
  if (modeBackBtn && !modeBackBtn._bound){
    modeBackBtn._bound = true;
    modeBackBtn.addEventListener('click', () => {
      const modeScr = document.getElementById('modeScreen');
      if (modeScr){ modeScr.style.display = 'none'; modeScr.setAttribute('aria-hidden','true'); }
      const menuScr = document.getElementById('menuScreen');
      if (menuScr){ menuScr.style.display = 'flex'; menuScr.setAttribute('aria-hidden','false'); }
      // restaurar o botão de zoom quando voltar ao menu
      try{
        const zw = document.getElementById('zoomWrap');
        if (zw){ zw.style.display = ''; }
      }catch(_){}
    });
  }

  // botão do modo infinito: abre seletor de mapas
  const modeInfiniteBtn = document.getElementById('modeInfiniteBtn');
  if (modeInfiniteBtn && !modeInfiniteBtn._bound){
    modeInfiniteBtn._bound = true;
    modeInfiniteBtn.addEventListener('click', () => {
      // esconder tela de modos
      const modeScr = document.getElementById('modeScreen');
      if (modeScr){ modeScr.style.display = 'none'; modeScr.setAttribute('aria-hidden','true'); }
      // mostrar tela de mapas
      const mapScr = document.getElementById('mapScreen');
      if (mapScr){ mapScr.style.display = 'flex'; mapScr.setAttribute('aria-hidden','false'); }
      // desenhar previews
      try { renderMapPreviews(); } catch(_){ }
      // ocultar o botão de zoom (lupa) na tela de seleção de mapa
      try{
        const zw = document.getElementById('zoomWrap');
        if (zw){ zw.style.display = 'none'; }
      }catch(_){}
    });
  }

  // voltar da seleção de mapas para a tela de modos
  const mapBackBtn = document.getElementById('mapBackBtn');
  if (mapBackBtn && !mapBackBtn._bound){
    mapBackBtn._bound = true;
    mapBackBtn.addEventListener('click', () => {
      const mapScr = document.getElementById('mapScreen');
      if (mapScr){ mapScr.style.display = 'none'; mapScr.setAttribute('aria-hidden','true'); }
      const modeScr = document.getElementById('modeScreen');
      if (modeScr){ modeScr.style.display = 'flex'; modeScr.setAttribute('aria-hidden','false'); }
      // manter o zoom oculto ao retornar à seleção de modos
      try{
        const zw = document.getElementById('zoomWrap');
        if (zw){ zw.style.display = 'none'; }
      }catch(_){}
    });
  }

  // clique em cartões de mapa: define o mapa e inicia o jogo (modo infinito)
  const mapCards = document.querySelectorAll('.map-card');
  mapCards.forEach(card => {
    if (!card._bound){
      card._bound = true;
      card.addEventListener('click', () => {
        const id = card.dataset.mapId;
        if (!id) return;
        if (card.classList.contains('disabled') || card.disabled) return;
        // define modo infinito e mapa escolhido em variáveis globais
        window.currentMode = 'infinite';
        window.currentMapId = id;
        // esconder a tela de mapas
        const mapScr = document.getElementById('mapScreen');
        if (mapScr){ mapScr.style.display = 'none'; mapScr.setAttribute('aria-hidden','true'); }
        // iniciar jogo single
        try{ startGame(); }catch(e){}
      });
    }
  });
})();

// Coop shop buttons
(function(){
  if (p1ShopBtn && !p1ShopBtn._bound){
    p1ShopBtn._bound = true;
    p1ShopBtn.addEventListener('click', () => {
      if (!state) return;
      if (state.coop && state.dead1) return;
      state.activeShopPlayer = 1;
      openShop();
    });
  }
  if (p2ShopBtn && !p2ShopBtn._bound){
    p2ShopBtn._bound = true;
    p2ShopBtn.addEventListener('click', () => {
      if (!state) return;
      if (state.coop && state.dead2) return;
      state.activeShopPlayer = 2;
      openShop();
    });
  }
})();
// Loja

  // Abas da loja (layout idêntico; apenas filtra os cards por categoria)
  window._shopTab = window._shopTab || "player";
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(t => t.addEventListener("click", () => {
    const key = t.getAttribute("data-tab") || "player";
    window._shopTab = key;

    tabs.forEach(o => o.classList.remove("active"));
    t.classList.add("active");

    // resetar página ao trocar de aba
    try{ window._setShopPage?.(0); }catch(_){}
    try{ window._renderShopPage?.(); }catch(_){}
  }));
// Estado
  let state;

  function normalizeStoredSettings(raw){
    var data = (raw && typeof raw === 'object') ? raw : {};
    var zoomLevel = Number(data.zoomLevel);
    return {
      music: typeof data.music === 'number' ? Math.min(1, Math.max(0, data.music)) : 1,
      sfx: typeof data.sfx === 'number' ? Math.min(1, Math.max(0, data.sfx)) : 1,
      fullscreen: !!data.fullscreen,
      zoomLevel: (isFinite(zoomLevel) && zoomLevel > 0) ? zoomLevel : null,
      screenShake: typeof data.screenShake === 'boolean' ? data.screenShake : true,
      inputMode: data.inputMode === 'keys' ? 'keys' : 'mouse',
      pauseOnSelect: typeof data.pauseOnSelect === 'boolean' ? data.pauseOnSelect : true
    };
  }
  function loadStoredSettings(){
    try{
      var nativeStore = window.__defendaNativeStore;
      if (nativeStore && nativeStore.loadSettings) return normalizeStoredSettings(nativeStore.loadSettings());
    }catch(_){}
    return normalizeStoredSettings(null);
  }
  function loadStoredAccountSnapshot(){
    try{
      var nativeStore = window.__defendaNativeStore;
      if (nativeStore && nativeStore.loadAccount) return nativeStore.loadAccount() || {};
    }catch(_){}
    return {};
  }
  const settings = loadStoredSettings();
  // Mesmo objeto em window.settings e _gameSettings (menu de opções usa window.settings)
  window.settings = settings;
  window._gameSettings = settings;
  /** Durante coop ativo: `settings.inputMode` fica em `keys`, mas o valor salvo no disco permanece o preferido do jogador (`savedMode`). */
  window.__coopInputModeLock = null;
  window.__inputModeSetBypassCoopGuard = false;
  function saveSettings(){
    try{
      const lock = window.__coopInputModeLock;
      const payload = normalizeStoredSettings({
        music: settings.music,
        sfx: settings.sfx,
        fullscreen: !!settings.fullscreen,
        zoomLevel: settings.zoomLevel,
        screenShake: settings.screenShake !== false,
        inputMode: (lock && lock.savedMode != null) ? lock.savedMode : (settings.inputMode || 'mouse'),
        pauseOnSelect: settings.pauseOnSelect !== false
      });
      var nativeStore = window.__defendaNativeStore;
      if (nativeStore && nativeStore.saveSettings){
        var persisted = normalizeStoredSettings(nativeStore.saveSettings(payload));
        Object.keys(persisted).forEach(function(key){ settings[key] = persisted[key]; });
      }
    }catch(_){}
  }
  window.saveSettings = saveSettings;

  function applyCoopInputModeLock(){
    if (window.__coopInputModeLock) return;
    window.__coopInputModeLock = { savedMode: (settings.inputMode || 'mouse') };
    window.__inputModeSetBypassCoopGuard = true;
    try{
      if (window._setInputMode) window._setInputMode('keys');
      else {
        settings.inputMode = 'keys';
        window._gameSettings.inputMode = 'keys';
        if (window._updateModeBtns) window._updateModeBtns('keys');
        if (window._updateModeBtnsVisual) window._updateModeBtnsVisual('keys');
        saveSettings();
      }
    }finally{
      window.__inputModeSetBypassCoopGuard = false;
    }
    try{ if (window._refreshInputModeCoopLockUI) window._refreshInputModeCoopLockUI(); }catch(_){}
  }
  function releaseCoopInputModeLock(){
    const L = window.__coopInputModeLock;
    if (!L) return;
    const restore = L.savedMode || 'mouse';
    window.__coopInputModeLock = null;
    window.__inputModeSetBypassCoopGuard = true;
    try{
      if (window._setInputMode) window._setInputMode(restore);
      else {
        settings.inputMode = restore;
        window._gameSettings.inputMode = restore;
        if (window._updateModeBtns) window._updateModeBtns(restore);
        if (window._updateModeBtnsVisual) window._updateModeBtnsVisual(restore);
        saveSettings();
      }
    }finally{
      window.__inputModeSetBypassCoopGuard = false;
    }
    try{ if (window._refreshInputModeCoopLockUI) window._refreshInputModeCoopLockUI(); }catch(_){}
  }
  window.applyCoopInputModeLock = applyCoopInputModeLock;
  window.releaseCoopInputModeLock = releaseCoopInputModeLock;
  // Música atual: guarda ganho e base pra permitir update ao vivo
  let __musicMaster = null;
  let __musicBase = 1;

  function setMusicMaster(master, base){
    __musicMaster = master;
    __musicBase = base;
    try{ master.gain.value = base * settings.music; }catch(_){}
  }
  function refreshMusicGain(){
    if (__musicMaster){
      try{ __musicMaster.gain.value = __musicBase * settings.music; }catch(_){}
    }
  }


  const DIRS = {
    up:    {x:0, y:-1, name:"up"},
    down:  {x:0, y:1,  name:"down"},
    left:  {x:-1,y:0,  name:"left"},
    right: {x:1, y:0,  name:"right"},
  };

  // Sons
  let audioCtx = null;
  function getAudio(){ if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); return audioCtx; }
  function beep(freq=440, dur=0.08, type="square", gain=0.03){
    const ac = getAudio();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = gain * settings.sfx;
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur);
  }
  window._gameBeep = beep; // exposto para sistema de EXP
  function noise(dur=0.08, gain=0.03){
    const ac = getAudio();
    const bufferSize = ac.sampleRate * dur;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<bufferSize;i++){ data[i] = (Math.random()*2-1) * 0.7; }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const g = ac.createGain(); g.gain.value = gain * settings.sfx;
    src.connect(g).connect(ac.destination);
    src.start();
  }
  
  function musicStart(){
    const ac = getAudio();
    if (state.music) return;
    const mapId = (state && state.mapId) || window.currentMapId || 'desert';

    // Música especial para a Tundra: melodia cristalina e memorável
    if (mapId === 'snow'){
      // Tema de inverno: "Aurora Boreal" - Em menor, sons suaves de triângulo e sino
      // Melodia principal: Mi menor descendente e ascendente, memorável e bonita
      // Tempo lento para transmitir a quietude e beleza do inverno
      const tempo = 80;
      const beat = 60/tempo;
      let step = 0;

      const master = ac.createGain();
      setMusicMaster(master, 0.26);
      master.connect(ac.destination);

      // Melodia principal - triângulo suave (cristalino, como sinos de gelo)
      // Escala Em: E4(330) F#4(370) G4(392) A4(440) B4(494) C5(523) D5(587) E5(659)
      // Melodia "Aurora Boreal" - 16 notas, 4 compassos
      // Melodia expandida — 48 notas (3 frases × 16), frase A original intacta
      const melody = [
        // Frase A (original)
        659, 587, 523, 494,
        440, 494, 523, 587,
        659,   0, 587, 523,
        494, 440, 370, 330,
        // Frase B — variação ascendente contemplativa
        349, 392, 440, 523,
        587, 523, 494, 440,
        392,   0, 440, 494,
        523, 494, 440, 392,
        // Frase C — eco grave, ornamento e retorno
        330, 370, 392, 440,
        494, 440, 392, 349,
        330,   0, 392, 440,
        494, 523, 494, 440
      ];
      // Baixo expandido — 48 notas
      const bassLine = [
        165,   0, 196,   0,
        220,   0, 247,   0,
        165,   0, 196,   0,
        220,   0, 165,   0,
        174,   0, 196,   0,
        220,   0, 247,   0,
        185,   0, 196,   0,
        220,   0, 247,   0,
        165,   0, 185,   0,
        196,   0, 220,   0,
        147,   0, 165,   0,
        174,   0, 196,   0
      ];
      // Contramelo expandido — 24 fases
      const counterLine = [
        330, 0, 370, 0, 392, 0, 330, 0,
        349, 0, 392, 0, 330, 0,   0, 0,
        294, 0, 330, 0, 349, 0, 330, 0
      ];

      function bell(freq, dur=0.45, vol=0.18, type='triangle'){
        if (!freq || freq <= 0) return;
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type;
        o.frequency.value = freq;
        o.connect(g).connect(master);
        const now = ac.currentTime;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(vol, now + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        o.start(now); o.stop(now + dur + 0.01);
      }

      function softBass(freq, dur=0.5){
        if (!freq || freq <= 0) return;
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        o.connect(g).connect(master);
        const now = ac.currentTime;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.12, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        o.start(now); o.stop(now + dur + 0.01);
      }

      // Leve shimmer de neve (ruído suave)
      function snowShimmer(){
        const nBuf = ac.createBuffer(1, ac.sampleRate*0.08, ac.sampleRate);
        const data = nBuf.getChannelData(0);
        for (let i=0;i<data.length;i++) data[i] = (Math.random()*2-1)*0.3;
        const src = ac.createBufferSource(); src.buffer = nBuf;
        const g = ac.createGain(); g.gain.value = 0;
        const filt = ac.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 3000;
        src.connect(filt).connect(g).connect(master);
        src.start();
        g.gain.linearRampToValueAtTime(0.025, ac.currentTime+0.01);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+0.1);
        src.stop(ac.currentTime+0.11);
      }

      function tick(){
        if (!state || !state.running){ state.music = null; return; }
        const i16 = step % melody.length;
        // Melodia principal a cada nota (todas as colcheias)
        if (melody[i16] > 0) bell(melody[i16], 0.48, 0.16);
        // Baixo a cada nota par
        if (step % 2 === 0 && bassLine[i16] > 0) softBass(bassLine[i16], 0.7);
        // Contramelo a cada 4 notas
        if (step % 4 === 0 && counterLine[(step/4)%counterLine.length] > 0)
          bell(counterLine[(step/4)%counterLine.length], 0.55, 0.09, 'triangle');
        // Shimmer de neve a cada 3 notas
        if (step % 3 === 0) snowShimmer();
        step++;
        state.music = setTimeout(tick, beat*500);
      }
      tick();
      return;
    }

    // ─── Música especial para o Pântano: "Cajun do Brejo" ───────────────────
    // Tema único: groove sincopado estilo blues/cajun, vivo e marcante.
    // COMPLETAMENTE diferente da Tundra: sem triangle, sem lento, sem vibrato,
    // sem filtro lowpass. Sawtooth nasal p/ melodia, square seco p/ baixo,
    // percussão de tronco oco, chiado de grilo, arpejo de bandolim.
    // Escala: Lá menor blues (A3 A4 C4 C5 D4 Eb4 E4 G4 G5)
    // A3=220 C4=261 D4=294 Eb4=311 E4=330 G4=392 A4=440 C5=523 E5=659 G5=784
    if (mapId === 'swamp'){
      const tempo = 112;
      const beat = 60/tempo;
      let step = 0;

      const master = ac.createGain();
      setMusicMaster(master, 0.21);
      master.connect(ac.destination);

      // ── Melodia principal "Cajun do Brejo" ──
      // 48 notas, 3 frases de 16. Sawtooth nasal, notas CURTAS e secas.
      // Caráter: motivo de 3 notas repetido com variações, fica na cabeça.
      // Frase A: motivo principal A-C-E sobe e desce com blue note Eb
      // Frase B: resposta que sobe ao agudo e cai com drama
      // Frase C: variação sincopada com silêncios e ornamento
      const melody = [
        // Frase A — motivo chicote: sobe rápido, blue note, cai
        440, 523, 659,   0,
        311, 330, 294, 440,
        523, 440, 330,   0,
        294, 311, 440,   0,
        // Frase B — resposta aguda, dramática
        659, 523, 440, 392,
        330, 294,   0, 330,
        440, 523, 659, 784,
        659,   0, 523, 440,
        // Frase C — variação sincopada com ornamento e gancho
        330, 440,   0, 523,
        440, 311, 294,   0,
        330, 392, 440,   0,
        523, 440, 330, 220
      ];

      // ── Baixo square sincopado — 16 notas, 1 a cada 3 steps ──
      // Riff de baixo que bate na cabeça, acento no contratempo
      const bassRiff = [
        220,   0, 220, 165,
        220,   0, 196, 220,
        165,   0, 220,   0,
        196, 165, 220,   0
      ];

      // ── Arpejo de "bandolim do brejo" (sawtooth agudo, muito curto) ──
      // Toca em grupos de 3 notas a cada 8 steps — efeito de rasqueado
      const banjoArp = [
        [440, 523, 659],
        [392, 440, 523],
        [330, 440, 523],
        [294, 392, 440],
        [330, 392, 523],
        [440, 659, 784]
      ];
      let banjoIdx = 0;

      // ── Função: nota de melodia (sawtooth, ataque imediato, seca) ──
      function sawNote(freq, dur=0.13){
        if (!freq || freq <= 0) return;
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'sawtooth';
        o.frequency.value = freq;
        // Highpass leve para tirar o grave do saw e deixar nasal/aberto
        const hp = ac.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 200;
        o.connect(hp).connect(g).connect(master);
        const now = ac.currentTime;
        g.gain.setValueAtTime(0.22, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        o.start(now); o.stop(now + dur + 0.01);
      }

      // ── Função: baixo square seco ──
      function swampBass(freq, dur=0.18){
        if (!freq || freq <= 0) return;
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'square';
        o.frequency.value = freq;
        // Bandpass apertado — som de corda dedilhada seca
        const bp = ac.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = freq * 1.5;
        bp.Q.value = 1.2;
        o.connect(bp).connect(g).connect(master);
        const now = ac.currentTime;
        g.gain.setValueAtTime(0.28, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        o.start(now); o.stop(now + dur + 0.01);
      }

      // ── Função: pancada de tronco oco (percussão) ──
      function woodKick(vol=0.18){
        // Noise curtíssimo + sine grave = "tok" seco de tronco
        const dur = 0.055;
        const nBuf = ac.createBuffer(1, Math.ceil(ac.sampleRate*dur), ac.sampleRate);
        const d = nBuf.getChannelData(0);
        for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1);
        const src = ac.createBufferSource(); src.buffer = nBuf;
        const bp = ac.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=220; bp.Q.value=3;
        const g = ac.createGain(); g.gain.value=0;
        src.connect(bp).connect(g).connect(master);
        src.start();
        g.gain.linearRampToValueAtTime(vol, ac.currentTime+0.003);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+dur);
        src.stop(ac.currentTime+dur+0.005);
        // Sine grave junto para dar corpo
        const o2 = ac.createOscillator(); o2.type='sine'; o2.frequency.value=90;
        const g2 = ac.createGain(); g2.gain.value=0;
        o2.connect(g2).connect(master);
        o2.start(); o2.stop(ac.currentTime+0.06);
        g2.gain.linearRampToValueAtTime(0.15, ac.currentTime+0.003);
        g2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+0.05);
      }

      // ── Função: chiado de grilo (hihat natural do pântano) ──
      function cricketHat(){
        const dur = 0.03;
        const nBuf = ac.createBuffer(1, Math.ceil(ac.sampleRate*dur), ac.sampleRate);
        const d = nBuf.getChannelData(0);
        for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*0.6;
        const src = ac.createBufferSource(); src.buffer = nBuf;
        const hp = ac.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=4000;
        const g = ac.createGain(); g.gain.value=0;
        src.connect(hp).connect(g).connect(master);
        src.start();
        g.gain.linearRampToValueAtTime(0.10, ac.currentTime+0.002);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+dur);
        src.stop(ac.currentTime+dur+0.003);
      }

      // ── Função: rasqueado de bandolim (sawtooth agudo curtíssimo, 3 notas rápidas) ──
      function banjoStrum(){
        const chord = banjoArp[banjoIdx % banjoArp.length];
        banjoIdx++;
        chord.forEach((f, i)=>{
          const delay = i * 0.028;
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'sawtooth';
          o.frequency.value = f;
          const hp = ac.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=300;
          o.connect(hp).connect(g).connect(master);
          const t = ac.currentTime + delay;
          g.gain.setValueAtTime(0.09, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
          o.start(t); o.stop(t + 0.12);
        });
      }

      function tick(){
        if (!state || !state.running){ state.music = null; return; }
        const i48 = step % melody.length;

        // Chiado de grilo em todo step (hihat constante)
        cricketHat();

        // Melodia sawtooth — toda nota
        if (melody[i48] > 0) sawNote(melody[i48], 0.14);

        // Baixo square — a cada 3 steps
        if (step % 3 === 0){
          const bi = Math.floor(step/3) % bassRiff.length;
          if (bassRiff[bi] > 0) swampBass(bassRiff[bi], 0.20);
        }

        // Tronco oco — batida forte no beat 1 e 3 do compasso (cada 4 e 12 steps)
        if (i48 % 4 === 0) woodKick(0.20);
        // Batida fraca no contratempo
        else if (i48 % 4 === 2) woodKick(0.09);

        // Rasqueado de bandolim — a cada 8 steps, no início de cada frase
        if (step % 8 === 0) banjoStrum();

        step++;
        state.music = setTimeout(tick, beat*500);
      }
      tick();
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Música padrão para os outros mapas (desert, forest, swamp, canyon)
    const musicDef = (MAP_DEFS[mapId] && MAP_DEFS[mapId].music) || { tempo:132, bass:[110,110,165,110,110,220,196,165], lead:[440,494,440,392,0,392,440,494] };
    const tempo = musicDef.tempo;
    const beat = 60/tempo;
    const bassSeq = musicDef.bass;
    const leadSeq = musicDef.lead;
    let step = 0;

    const master = ac.createGain();
    setMusicMaster(master, 0.21);
    master.connect(ac.destination);
    const hh = ac.createGain(); hh.gain.value = 0.0552; hh.connect(master);

    function hat(){
      const noiseBuf = ac.createBuffer(1, ac.sampleRate*0.05, ac.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i=0;i<data.length;i++){ data[i] = (Math.random()*2-1) * 0.8; }
      const src = ac.createBufferSource(); src.buffer = noiseBuf;
      const g = ac.createGain(); g.gain.value = 0.0; g.connect(hh);
      src.connect(g);
      src.start();
      g.gain.linearRampToValueAtTime(0.20, ac.currentTime + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.07);
      src.stop(ac.currentTime + 0.08);
    }

    function pluck(freq, dur=0.18){
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "square"; o.frequency.value = freq;
      o.connect(g).connect(master);
      const now = ac.currentTime;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.20, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      o.start(now); o.stop(now + dur + 0.02);
    }

    function tick(){
      if (!state || !state.running){ state.music = null; return; }
      // chimbal em 8 notas por compasso
      hat();
      if (step % 2 === 0){ pluck(bassSeq[(step/2)%bassSeq.length]); }
      if (step % 4 === 0){ const n = leadSeq[(step/4)%leadSeq.length]; if (n>0) pluck(n, 0.22); }
      step++;
      state.music = setTimeout(tick, beat*500); // 8th notes
    }
    tick();
  }

  // Música especial por Boss (mais tensa)
  function bossMusicStart(name){
    const ac = getAudio();
    if (state.music) { clearTimeout(state.music); state.music = null; }
    // ── Música d'O Pregador (e tema padrão para outros bosses futuros) ──
    if(name === "Os Gêmeos"){
      // ── Tema dos Gêmeos — La menor, 182 BPM ─────────────────────────
      // Melodia com ritmo real: semínimas (q=2 steps), mínimas (h=4 steps),
      // colcheias (e=1 step). Notas longas criam respiração e nexo melódico.
      // dur=0.52s para todas as notas da melodia — sustenta através dos zeros.
      // 220 BPM, La menor. Melodia com duração real (0.28s por nota).
      // Motivo: A4→E5 (quinta ascendente forte) como ancoragem, depois variação.
      // Ritmo: colcheias densas com pausas estratégicas — não 100% preenchido.
      const tempo=220, beat=60/tempo;
      let i=0;
      // 16 steps = 2 compassos que se repetem (mais curto = mais chiclete)
      // A: A4 C5 E5 C5 | A4 . E5 .    (sobe e oscila)
      // B: G5 E5 D5 C5 | A4 . . A4    (desce e ancora)
      const mel=[
        440,523,659,523, 440,0,659,0,
        784,659,587,523, 440,0,0,440,
      ];
      // Baixo: A2 no 1 e 3, E2 no 2 e 4 — padrão de tônica/dominante
      const bass=[
        110,0,82,0,  110,0,82,0,
        110,0,82,0,  110,0,110,0,
      ];
      // Contra: A3/E4 — riff de duas notas que gruda
      const cnt=[
        220,0,330,0, 220,0,330,0,
        261,0,330,0, 220,0,0,0,
      ];
      const master=ac.createGain();
      setMusicMaster(master,0.38);
      master.connect(ac.destination);
      function note(freq,type,vol,dur){
        if(!freq||freq<10)return;
        const o=ac.createOscillator(); o.type=type; o.frequency.value=freq;
        const g=ac.createGain(); o.connect(g).connect(master);
        const t=ac.currentTime;
        g.gain.setValueAtTime(vol,t);
        g.gain.exponentialRampToValueAtTime(0.001,t+dur);
        o.start(t); o.stop(t+dur+0.01);
      }
      function kick(){
        const o=ac.createOscillator(); o.type='sine'; o.frequency.value=65;
        const g=ac.createGain(); o.connect(g).connect(master);
        const t=ac.currentTime;
        o.frequency.exponentialRampToValueAtTime(25,t+0.07);
        g.gain.setValueAtTime(0.4,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
        o.start(t); o.stop(t+0.20);
      }
      function snare(){
        const o=ac.createOscillator(); o.type='sawtooth'; o.frequency.value=200;
        const g=ac.createGain(); o.connect(g).connect(master);
        const t=ac.currentTime;
        g.gain.setValueAtTime(0.07,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.08);
        o.start(t); o.stop(t+0.09);
      }
      function tick(){
        if(!state||!state.running){state.music=null;return;}
        const mf=mel[i%16]; const bf=bass[i%16]; const cf=cnt[i%16];
        if(mf) note(mf,'sawtooth',0.22,0.22);  // articulado mas com sustain
        if(bf) note(bf,'square',0.14,0.28);
        if(cf) note(cf,'triangle',0.08,0.20);
        if(i%4===0) kick();
        if(i%8===4) snare();
        i++;
        state.music=setTimeout(tick,beat*1000);
      }
      tick(); return;
    }
    if(name === "Pistoleiro Fantasma"){
      // Tema retrabalhado: mais assombroso, com pulso marcado e camada etérea.
      const tempo=104, beat=60/tempo;
      let i=0;
      const mel=[
        587,659,740,659, 587,523,587,0,
        554,622,698,622, 554,494,554,0,
        659,740,784,740, 659,587,523,587,
        494,554,622,554, 523,494,466,523,
      ];
      const bass=[73,0,82,0, 73,0,69,0, 73,0,82,0, 73,0,65,0];
      const ghostPad=[294,0,370,0, 349,0,440,0, 294,0,392,0, 330,0,370,0];
      const master=ac.createGain();
      setMusicMaster(master,0.34);
      master.connect(ac.destination);
      function pluck(f,v,d){
        if(!f||f<20)return;
        const o=ac.createOscillator(); o.type='triangle'; o.frequency.value=f;
        const g=ac.createGain(); o.connect(g).connect(master);
        const t=ac.currentTime;
        g.gain.setValueAtTime(0,t);
        g.gain.linearRampToValueAtTime(v,t+0.004);
        g.gain.exponentialRampToValueAtTime(0.001,t+d);
        o.start(t); o.stop(t+d+0.018);
      }
      function lowPulse(f,v,d){
        if(!f||f<15)return;
        const o=ac.createOscillator(); o.type='sine'; o.frequency.value=f;
        const g=ac.createGain(); o.connect(g).connect(master);
        const t=ac.currentTime;
        g.gain.setValueAtTime(v*0.38,t);
        g.gain.exponentialRampToValueAtTime(0.001,t+d);
        o.start(t); o.stop(t+d+0.025);
      }
      function ghostPadHit(f){
        if(!f||f<20)return;
        const o=ac.createOscillator(); o.type='sawtooth'; o.frequency.value=f;
        const lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900;
        const g=ac.createGain();
        o.connect(lp).connect(g).connect(master);
        const t=ac.currentTime;
        g.gain.setValueAtTime(0.0001,t);
        g.gain.exponentialRampToValueAtTime(0.06,t+0.05);
        g.gain.exponentialRampToValueAtTime(0.001,t+0.42);
        o.start(t); o.stop(t+0.45);
      }
      function dustHat(){
        const _ac=getAudio();
        const nb=_ac.createBuffer(1,Math.ceil(_ac.sampleRate*0.05),_ac.sampleRate);
        const d=nb.getChannelData(0);
        for(let k=0;k<d.length;k++) d[k]=(Math.random()*2-1)*0.42;
        const src=_ac.createBufferSource(); src.buffer=nb;
        const hp=_ac.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=3200;
        const g=_ac.createGain(); g.gain.value=0.05;
        src.connect(hp).connect(g).connect(master);
        const t=_ac.currentTime;
        src.start(t); src.stop(t+0.055);
      }
      function tick(){
        if(!state||!state.running){state.music=null;return;}
        const m=mel[i%32], b=bass[i%16], p=ghostPad[i%16];
        if(m) pluck(m,0.19,0.24);
        if(b) lowPulse(b,0.15,0.30);
        if((i%4)===2 && p) ghostPadHit(p);
        if((i%2)===0) dustHat();
        if((i%8)===4 && m) pluck(m*0.5,0.075,0.44);
        i++;
        state.music=setTimeout(tick,beat*500);
      }
      tick();
      return;
    }
    if(name === "O Pregador"){
      // ── Tema do Pregador: 175 BPM, Mi menor sombrio-tenso
      // 32 colcheias = 4 compassos distintos sem repetição trivial
      // Instrumentos: melodia sawtooth lead + baixo pulsante + harmonia triangle + percussão
      const tempo=192, beat=60/tempo;
      let i=0;
      // Melodia (sawtooth agressivo)
      const mel=[
        // A: motivo ascendente E4-G4-A4-B4, corta em pausa, resposta descendente
        330,0,392,0, 440,494,440,0,
        // B: tensão Bb4-A4-G4-F#4, resolve em E4
        466,440,392,370, 370,0,330,0,
        // C: corre para cima A4-B4-C5-D5, estaca em E5
        440,494,523,587, 659,0,659,0,
        // D: queda E5-D5-B4-G4-E4, retorna ao motivo
        659,587,494,392, 330,0,0,330,
      ];
      // Baixo (square, soa a cada colcheia par)
      const bass=[
        165,0,165,0, 196,0,196,0,
        220,0,220,0, 185,0,185,0,
        220,0,247,0, 294,0,294,0,
        165,0,196,0, 220,0,165,0,
      ];
      // Contra-melodia (triangle, mais suave)
      const cnt=[
        247,0,0,247, 0,294,0,0,
        261,0,0,220, 0,196,0,0,
        330,0,0,294, 0,0,349,0,
        247,0,220,0, 196,0,247,0,
      ];
      const master=ac.createGain();
      setMusicMaster(master,0.38);
      master.connect(ac.destination);
      function note(freq,type,vol,dur){
        if(!freq||freq<10)return;
        const o=ac.createOscillator(); o.type=type; o.frequency.value=freq;
        const g=ac.createGain(); o.connect(g).connect(master);
        const t=ac.currentTime;
        g.gain.setValueAtTime(vol,t);
        g.gain.exponentialRampToValueAtTime(0.001,t+dur);
        o.start(t); o.stop(t+dur+0.01);
      }
      function kick(){
        const o=ac.createOscillator(); o.type='sine'; o.frequency.value=65;
        const g=ac.createGain(); o.connect(g).connect(master);
        const t=ac.currentTime;
        o.frequency.exponentialRampToValueAtTime(25,t+0.07);
        g.gain.setValueAtTime(0.4,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
        o.start(t); o.stop(t+0.20);
      }
      function snare(){
        const o=ac.createOscillator(); o.type='sawtooth'; o.frequency.value=200;
        const g=ac.createGain(); o.connect(g).connect(master);
        const t=ac.currentTime;
        g.gain.setValueAtTime(0.07,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.08);
        o.start(t); o.stop(t+0.09);
      }
      function tick(){
        if(!state||!state.running){state.music=null;return;}
        const mf=mel[i%32]; const bf=bass[i%32]; const cf=cnt[i%32];
        if(mf) note(mf,'sawtooth',0.20,0.14);
        if(bf) note(bf,'square',0.11,0.22);
        if(cf) note(cf,'triangle',0.07,0.28);
        if(i%4===0) kick();
        if(i%8===4) snare();
        // acentos extras no compasso 3
        if(i%32>=16&&i%32<24&&i%2===0&&mf) note(mf*2,'square',0.04,0.06);
        i++;
        state.music=setTimeout(tick,beat*1000);
      }
      tick();
      return;
    }
    // Tema padrão (fallback)
    const theme = { tempo: 160, seq:[233,0,233,0,220,0,196,0] };
    const beat = 60/theme.tempo;
    let i = 0;
    const master = ac.createGain();
    setMusicMaster(master, 0.0966);
    master.connect(ac.destination);
    function stab(freq){
      const o = ac.createOscillator(); o.type="sawtooth"; o.frequency.value=freq;
      const g = ac.createGain(); o.connect(g).connect(master);
      const now = ac.currentTime; g.gain.setValueAtTime(0,now);
      g.gain.linearRampToValueAtTime(0.25, now+0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now+0.20);
      o.start(now); o.stop(now+0.22);
    }
    function pulseKick(){
      const o = ac.createOscillator(); o.type="sine"; o.frequency.value=60;
      const g = ac.createGain(); g.gain.value=0.0; o.connect(g).connect(master);
      const now = ac.currentTime; g.gain.linearRampToValueAtTime(0.30, now+0.005);
      g.gain.exponentialRampToValueAtTime(0.001, now+0.20);
      o.start(now); o.stop(now+0.22);
    }
    function tick(){
      if (!state || !state.running){ state.music = null; return; }
      const f = theme.seq[i % theme.seq.length] || 0.001;
      stab(f);
      if (i % 2 === 0) pulseKick();
      i++;
      state.music = setTimeout(tick, beat*1000);
    }
    tick();
  }


function musicMenuStart(){
  const ac = getAudio();
  if (state && state.music){ clearTimeout(state.music); state.music = null; }

  // "Fronteira" — tema do menu. 118 BPM, Mi menor, 32 colcheias (4 compassos).
  // Mantém o groove de shaker+pluck+bass original e adiciona:
  //   kick na semínima, contraponto triangle, 4 frases distintas.
  // Frase A (0–7) : motivo original E–G–A–B–A–G–E–pausa
  // Frase B (8–15): resposta sobe para C, resolve em G
  // Frase C (16–23): variação — pulo para E5, desce cromaticamente
  // Frase D (24–31): tensão em D, resolve de volta em E (retorna para A)
  const tempo = 118;
  const beat  = 60 / tempo;
  let i = 0;

  // 32 notas de melodia (Hz). 0 = silêncio.
  const mel = [
  //  A: E4  G4  A4  B4  A4  G4  E4  —
      330, 392, 440, 494, 440, 392, 330,   0,
  //  B: G4  A4  B4  C5  B4  A4  G4  E4
      392, 440, 494, 523, 494, 440, 392, 330,
  //  C: A4  B4  C5  E5  D5  C5  B4  —
      440, 494, 523, 659, 587, 523, 494,   0,
  //  D: D5  B4  G4  A4  B4  G4  E4  E4
      587, 494, 392, 440, 494, 392, 330, 330
  ];

  // Baixo (soa a cada 2 steps = semínimas). Segue harmonia E / G / Am / E.
  const bassLine = [
  //  A
      165, 165, 196, 196, 220, 220, 165, 165,
  //  B
      196, 196, 220, 220, 196, 196, 165, 165,
  //  C
      220, 220, 261, 261, 220, 220, 196, 196,
  //  D
      294, 294, 220, 220, 196, 196, 165, 165
  ];

  const master = ac.createGain();
  setMusicMaster(master, 0.155);
  master.connect(ac.destination);
  const hhBus = ac.createGain(); hhBus.gain.value = 0.05; hhBus.connect(master);

  function shaker(accent){
    const nb = ac.createBuffer(1, Math.ceil(ac.sampleRate * 0.08), ac.sampleRate);
    const d = nb.getChannelData(0);
    for (let k = 0; k < d.length; k++) d[k] = (Math.random()*2-1) * 0.6;
    const src = ac.createBufferSource(); src.buffer = nb;
    const g = ac.createGain(); g.gain.value = 0; src.connect(g).connect(hhBus);
    const now = ac.currentTime;
    src.start(now);
    g.gain.linearRampToValueAtTime(accent ? 0.28 : 0.18, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    src.stop(now + 0.15);
  }

  function kick(){
    const o = ac.createOscillator(); o.type = 'sine';
    const g = ac.createGain(); o.connect(g).connect(master);
    const now = ac.currentTime;
    o.frequency.setValueAtTime(120, now);
    o.frequency.exponentialRampToValueAtTime(38, now + 0.14);
    g.gain.setValueAtTime(0.30, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    o.start(now); o.stop(now + 0.22);
  }

  function pluck(freq, dur, vol){
    if (!freq) return;
    dur = dur || 0.20; vol = vol || 0.26;
    const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = freq;
    const g = ac.createGain(); g.gain.value = 0; o.connect(g).connect(master);
    const now = ac.currentTime;
    g.gain.linearRampToValueAtTime(vol, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.start(now); o.stop(now + dur + 0.02);
  }

  function bassNote(freq){
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq / 2;
    const g = ac.createGain(); g.gain.value = 0; o.connect(g).connect(master);
    const now = ac.currentTime;
    g.gain.linearRampToValueAtTime(0.22, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    o.start(now); o.stop(now + 0.33);
  }

  // Triangle suave como contraponto, soa nas colcheias ímpares (step % 4 === 2)
  const ctr = [
      494,  0, 440,  0, 392,  0, 330,  0,
      440,  0, 523,  0, 494,  0, 392,  0,
      523,  0, 659,  0, 587,  0, 494,  0,
      440,  0, 392,  0, 330,  0, 330,  0
  ];
  function counter(freq){
    if (!freq) return;
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const g = ac.createGain(); g.gain.value = 0; o.connect(g).connect(master);
    const now = ac.currentTime;
    g.gain.linearRampToValueAtTime(0.09, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    o.start(now); o.stop(now + 0.35);
  }

  function tick(){
    if (!state || !state.inMenu){ state.music = null; return; }
    const s = i % 32;

    // Shaker em toda colcheia; acentuado nos tempos 1 e 3 do compasso
    shaker(s % 4 === 0 || s % 4 === 2);

    // Kick na semínima (steps 0 e 4 de cada compasso de 8)
    if (s % 4 === 0) kick();

    // Melodia principal
    const isLong = (s === 7 || s === 15 || s === 23 || s === 31);
    pluck(mel[s], isLong ? 0.36 : 0.20, isLong ? 0.30 : 0.26);

    // Baixo a cada semínima
    if (s % 2 === 0) bassNote(bassLine[s]);

    // Contraponto triangle nas contratempo
    if (s % 4 === 2) counter(ctr[s]);

    i++;
    state.music = setTimeout(tick, beat * 500);
  }
  tick();
}

// Música exclusiva do lobby online. É semelhante à música de menu,
// porém com um tempo mais lento e um arpejo diferente para dar
// identidade própria à tela de espera.  Usa baixo e pluck para
// compor um clima de faroeste tranquilo.
function musicLobbyStart(){
  const ac = getAudio();
  // cancela qualquer música atual
  if (state && state.music){ clearTimeout(state.music); state.music = null; }
  // tema do lobby: andamento mais calmo e arpejo ascendente/descendente
  const tempo = 96;
  const beat = 60/tempo;
  const arp = [392, 440, 494, 523, 494, 440, 392, 0]; // G4-A4-B4-C5-B4-A4-G4-rest
  let i = 0;

  const master = ac.createGain();
  setMusicMaster(master, 0.125);
  master.connect(ac.destination);
  const hhBus  = ac.createGain(); hhBus.gain.value = 0.042; hhBus.connect(master);

  function shaker(){
    const noiseBuf = ac.createBuffer(1, ac.sampleRate*0.08, ac.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let k=0;k<data.length;k++){ data[k] = (Math.random()*2-1) * 0.5; }
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const g = ac.createGain(); g.gain.value = 0; src.connect(g).connect(hhBus);
    const now = ac.currentTime;
    src.start(now);
    g.gain.linearRampToValueAtTime(0.18, now+0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now+0.14);
    src.stop(now+0.15);
  }

  function pluck(freq, dur=0.20){
    const o = ac.createOscillator(); o.type="square"; o.frequency.value = freq;
    const g = ac.createGain(); g.gain.value = 0; o.connect(g).connect(master);
    const now = ac.currentTime;
    g.gain.linearRampToValueAtTime(0.22, now+0.006);
    g.gain.exponentialRampToValueAtTime(0.001, now+dur);
    o.start(now); o.stop(now+dur+0.02);
  }

  function bass(freq, dur=0.26){
    const o = ac.createOscillator(); o.type="sawtooth"; o.frequency.value = freq/2;
    const g = ac.createGain(); g.gain.value = 0; o.connect(g).connect(master);
    const now = ac.currentTime;
    g.gain.linearRampToValueAtTime(0.20, now+0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now+dur);
    o.start(now); o.stop(now+dur+0.02);
  }

  function tick(){
    if (!state || !state.inMenu){
      state.music = null;
      return;
    }
    // shaker em colcheias
    shaker();
    // baixo toca a cada batida inteira
    if (i % 2 === 0){ bass(arp[(i/2)%arp.length] || 196, 0.22); }
    // melodia toca a cada meio compasso
    if (i % 4 === 0){ const n = arp[(i/4)%arp.length]; if (n) pluck(n, 0.22); }
    i++;
    state.music = setTimeout(tick, beat*500);
  }
  tick();
}

function musicStop(){

    if (state && state.music){ clearTimeout(state.music); state.music = null; }
  }

  // Tenta iniciar/resumir música do menu automaticamente (inclusive em Electron)
  function forceMenuAutoplay(){
  const m = document.getElementById("menuScreen");
  // 1) Tenta retomar e iniciar imediatamente
  try{ const ac = getAudio(); if (ac.state === "suspended") ac.resume(); }catch(e){}
  // Splash: sem música até o menu estar visível (cleanup da splash chama showMenu de novo).
  try{
    if (document.documentElement && document.documentElement.classList.contains("splash-pending")) return;
  }catch(_e){}
  try{ musicMenuStart(); }catch(e){}
  // 2) Dispara um pointerdown sintético no menu (pode ajudar em alguns ambientes)
  try{ if (m) m.dispatchEvent(new PointerEvent("pointerdown", {bubbles:true})); }catch(e){}
  // 3) Repetidas tentativas curtas
  let tries = 0; const id = setInterval(()=>{
    tries++;
    try{
      if (!state || !state.inMenu){ clearInterval(id); return; }
      const ac = getAudio(); if (ac.state !== "running") ac.resume();
      if (!state.music) musicMenuStart();
      // Electron: userAgent contém "Electron"
      if ((navigator.userAgent||"").includes("Electron") && ac.state === "running" && state.music){ clearInterval(id); }
    }catch(e){}
    if (tries > 24) clearInterval(id);
  }, 200);
}

function ensureMenuMusicAuto(){
    try{
      const ac = getAudio();
      if (ac.state === "suspended") ac.resume();
      musicMenuStart();
    }catch(e){}
    // fallback: algumas tentativas nos primeiros segundos
    let _tries = 0;
    const id = setInterval(()=>{
      _tries++;
      try{
        if (!state || !state.inMenu){ clearInterval(id); return; }
        const ac = getAudio();
        if (ac.state !== "running"){ ac.resume(); }
        if (!state.music) musicMenuStart();
        if (ac.state === "running" && state.music){ clearInterval(id); }
      }catch(e){}
      if (_tries > 20) clearInterval(id);
    }, 250);
  }

  function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }

  // ----- Confirm Reset (R) helpers -----
  function openConfirmReset(){
    const m = document.getElementById('confirmResetModal');
    if (!m) return;
    m.style.display = 'flex';
    m.setAttribute('aria-hidden','false');
    state.pausedManual = true;
  }
  function closeConfirmReset(){
    const m = document.getElementById('confirmResetModal');
    if (!m) return;
    m.style.display = 'none';
    m.setAttribute('aria-hidden','true');
    state.pausedManual = false;
  }
  (function bindConfirmReset(){
    const noBtn = document.getElementById('confirmResetNo');
    const yesBtn = document.getElementById('confirmResetYes');
    if (noBtn && !noBtn._bound){ noBtn._bound = true; noBtn.addEventListener('click', ()=>{ closeConfirmReset(); }); }
    if (yesBtn && !yesBtn._bound){ yesBtn._bound = true; yesBtn.addEventListener('click', ()=>{
      closeConfirmReset();
      // Reinicia a rodada (não vai pro menu)
      if (state && state.coop) resetGameCoop();
      else resetGame();
      state.running = true;
      state.inMenu = false;
      musicStop(); musicStart();
    }); }
  })();
  // === Sistema de Diálogo ===
  let dialog = { active:false, lines:[], idx:0, char:0, timer:null, speedMs:24, drawPortrait:null, nameOverride:null };
  const dialogLayer = document.getElementById("dialogLayer");
  const dialogText = document.getElementById("dialogText");
  const dialogName = document.getElementById("dialogName");
  const dialogPortrait = document.getElementById("dialogPortrait");

  // Nome do jogador (Perfil). Se vazio, usa 'Cowboy'.
  function getPlayerDisplayName(){
    try{
      if(window._expSystem && typeof window._expSystem.acctLoad==='function'){
        var a = window._expSystem.acctLoad();
        var n = (a && a.name ? String(a.name).trim() : '');
        if(n) return n;
      }
    }catch(e){}
    return 'Cowboy';
  }

  function _stripDecorNameClassesFromEl(el){
    if (!el || !el.classList) return;
    Array.prototype.slice.call(el.classList).forEach(function(c){
      if (/^dn-s\d+$/.test(c)) el.classList.remove(c);
    });
  }
  // Nomes acima dos cowboys (DOM sobre o canvas: fica acima de inimigos, ouro, etc.)
  // Não recriar os nós a cada frame — innerHTML a 60fps reinicia as CSS animations.
  window.updateNameOverlay = function(){
    const overlay = document.getElementById('nameOverlay');
    if (!overlay) return;

    function clearOverlay(){
      overlay.innerHTML = '';
    }

    if (!state || !state.running || state.inMenu){ clearOverlay(); return; }
    if (state.pausedShop){ clearOverlay(); return; }
    if (dialog && dialog.active){ clearOverlay(); return; }
    try{
      const b = document.body;
      if (b.getAttribute('data-results-open') === '1'){ clearOverlay(); return; }
      const _vis = function(id){
        const el = document.getElementById(id);
        return el && el.style.display === 'flex';
      };
      if (_vis('optionsScreen') || _vis('confirmModal') || _vis('confirmResetModal') ||
          _vis('dialogPrompt') || _vis('dialogLayer') || _vis('shopModal') || _vis('wavePickerModal') ||
          _vis('enemiesModal') ||
          b.getAttribute('data-options-open') === '1' ||
          b.getAttribute('data-confirm-open') === '1'){
        clearOverlay();
        return;
      }
      const _ra = document.getElementById('resetAccountModal');
      if (_ra && _ra.style.display === 'flex'){ clearOverlay(); return; }
    }catch(_){}

    const canvas = document.getElementById('game');
    if (!canvas){ clearOverlay(); return; }
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1){ clearOverlay(); return; }
    const sx = rect.width / canvas.width;
    const sy = rect.height / canvas.height;
    const scale = Math.min(sx, sy);
    const tile = TILE;

    function ensureNameSlot(slot){
      var sel = '.player-name-overlay[data-name-slot="' + slot + '"]';
      var wrap = overlay.querySelector(sel);
      if (!wrap){
        wrap = document.createElement('div');
        wrap.className = 'player-name-overlay';
        wrap.setAttribute('data-name-slot', String(slot));
        var inner = document.createElement('span');
        inner.className = 'player-name-overlay-text';
        wrap.appendChild(inner);
        overlay.appendChild(wrap);
      }
      return wrap;
    }

    function removeNameSlot(slot){
      var w = overlay.querySelector('.player-name-overlay[data-name-slot="' + slot + '"]');
      if (w) w.remove();
    }

    function syncLabel(wrap, px, py, text, usePlayerDecor){
      if (!text){ wrap.remove(); return; }
      var inner = wrap.querySelector('.player-name-overlay-text');
      if (!inner){
        inner = document.createElement('span');
        inner.className = 'player-name-overlay-text';
        wrap.appendChild(inner);
      }
      var cx = rect.left + (px + 0.5) * tile * sx;
      var _nameLift = (state && state.wave >= 12) ? (12 * scale) : 0;
      var _nameScale = scale * 0.88;
      var top = rect.top + py * tile * sy - 18 * scale - _nameLift;
      wrap.style.left = cx + 'px';
      wrap.style.top = top + 'px';
      wrap.style.transform = 'translateX(-50%) scale(' + _nameScale.toFixed(4) + ')';
      wrap.style.transformOrigin = 'center top';

      var decorId = (usePlayerDecor && typeof state.equippedName === 'number') ? (state.equippedName | 0) : -1;
      var sig = text + '\n' + decorId;
      if (wrap._dnSig !== sig){
        wrap._dnSig = sig;
        inner.textContent = text;
        _stripDecorNameClassesFromEl(inner);
        if (usePlayerDecor && typeof state.equippedName === 'number' && window._decorNameCssById){
          var extra = String(window._decorNameCssById[state.equippedName] || '').trim();
          if (extra) inner.classList.add(extra);
        }
      }
    }

    var p1 = state.player1 || state.player;
    var need1 = !!(p1 && p1.hp > 0);
    var need2 = !!(state.coop && state.player2 && state.player2.hp > 0);

    if (!need1) removeNameSlot('1');
    if (!need2) removeNameSlot('2');

    if (need1){
      var nm = getPlayerDisplayName();
      if (p1.inShop) nm += ' (Loja)';
      syncLabel(ensureNameSlot('1'), p1.x, p1.y, nm, true);
    }
    if (need2){
      var _n2 = (state.player2.name && String(state.player2.name).trim()) || 'Cowboy 2';
      var nm2 = _n2;
      if (state.player2.inShop) nm2 += ' (Loja)';
      syncLabel(ensureNameSlot('2'), state.player2.x, state.player2.y, nm2, false);
    }
  };

  /** Textos flutuantes no mundo (ex.: Abate x2, FAREJANDO!, Cuidado!): DOM como o nome padrão — nítido em qualquer zoom. */
  window.updateWorldFloatingTexts = function(dt){
    const overlay = document.getElementById('worldTextOverlay');
    if (!overlay || !state) return;
    const d = (typeof dt === 'number' && isFinite(dt))
      ? Math.max(0.001, Math.min(dt, 0.05))
      : (1 / 60);

    function worldTextBlocked(){
      if (!state.running || state.inMenu) return true;
      if (state.pausedShop) return true;
      if (dialog && dialog.active) return true;
      try{
        const b = document.body;
        if (b.getAttribute('data-results-open') === '1') return true;
        const _vis = function(id){
          const el = document.getElementById(id);
          return el && el.style.display === 'flex';
        };
        if (_vis('optionsScreen') || _vis('confirmModal') || _vis('confirmResetModal') ||
            _vis('dialogPrompt') || _vis('dialogLayer') || _vis('shopModal') || _vis('wavePickerModal') ||
            _vis('enemiesModal') ||
            b.getAttribute('data-options-open') === '1' ||
            b.getAttribute('data-confirm-open') === '1'){
          return true;
        }
        const _ra = document.getElementById('resetAccountModal');
        if (_ra && _ra.style.display === 'flex') return true;
      }catch(_){}
      return false;
    }

    if (worldTextBlocked()){
      try{ overlay.innerHTML = ''; }catch(_){}
      state.multiPopups = [];
      return;
    }

    const canvas = document.getElementById('game');
    if (!canvas){
      try{ overlay.innerHTML = ''; }catch(_){}
      state.multiPopups = [];
      return;
    }
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1){
      try{ overlay.innerHTML = ''; }catch(_){}
      state.multiPopups = [];
      return;
    }
    const sx = rect.width / canvas.width;
    const sy = rect.height / canvas.height;
    const tile = TILE;

    // ── multiPopups (antes no canvas) ──
    const keptMp = [];
    for (const p of state.multiPopups){
      p.life -= d;
      if (p.life <= 0){
        try{ if (p._el) p._el.remove(); }catch(_){}
        p._el = null;
        continue;
      }
      p.y += p.vy * d;
      const a = Math.max(0, p.life / p.max);
      const screenX = rect.left + p.x * sx;
      const screenY = rect.top + p.y * sy;
      if (!p._el){
        p._el = document.createElement('div');
        p._el.className = 'world-floating-popup';
        const span = document.createElement('span');
        span.className = 'world-floating-popup-text';
        p._el.appendChild(span);
        overlay.appendChild(p._el);
      }
      const span = p._el.querySelector('.world-floating-popup-text');
      if (span && span.textContent !== p.text) span.textContent = p.text;
      if (span) span.style.color = p.color || '#f5ecd4';
      p._el.style.left = screenX + 'px';
      p._el.style.top = screenY + 'px';
      p._el.style.opacity = String(a);
      keptMp.push(p);
    }
    state.multiPopups = keptMp;

    // ── Pilha xN sobre inimigos ──
    const stackActive = new Set();
    const counts = new Map();
    for (const z of state.bandits){
      if (!z.alive) continue;
      const key = z.x + ',' + z.y;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (state.boss && state.boss.alive){
      const key = state.boss.x + ',' + state.boss.y;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (const [key, count] of counts.entries()){
      if (count <= 1) continue;
      stackActive.add(key);
      let row = overlay.querySelector('[data-stack-key="' + key + '"]');
      if (!row){
        row = document.createElement('div');
        row.setAttribute('data-stack-key', key);
        row.className = 'world-floating-popup';
        const span = document.createElement('span');
        span.className = 'world-floating-popup-text';
        row.appendChild(span);
        overlay.appendChild(row);
      }
      const span = row.querySelector('.world-floating-popup-text');
      if (span){
        span.textContent = 'x' + count;
        span.style.color = '#f0e6d2';
      }
      const parts = key.split(',').map(Number);
      const cx = parts[0] * tile + tile / 2;
      // Acima do tile: evita sobrepor o desenho dos inimigos (antes ~centro em y*TILE+10).
      const cy = parts[1] * tile - 5;
      row.style.left = (rect.left + cx * sx) + 'px';
      row.style.top = (rect.top + cy * sy) + 'px';
      row.style.opacity = '1';
    }
    overlay.querySelectorAll('[data-stack-key]').forEach(function(el){
      const k = el.getAttribute('data-stack-key');
      if (k && !stackActive.has(k)) el.remove();
    });

    // ── "Cuidado!" (ouro, torreta, cowboy) — caixa continua no canvas ──
    const warnActive = new Set();
    function syncCuidado(id, canvasX, canvasY, opacity){
      warnActive.add(id);
      let el = overlay.querySelector('[data-world-warn="' + id + '"]');
      if (!el){
        el = document.createElement('div');
        el.setAttribute('data-world-warn', id);
        el.className = 'world-floating-popup';
        el.style.width = '92px';
        el.style.height = '30px';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.background = 'transparent';
        el.style.border = 'none';
        el.style.boxShadow = 'none';
        const span = document.createElement('span');
        span.className = 'world-floating-popup-text world-cuidado-text';
        span.textContent = 'Cuidado!';
        span.style.fontSize = '20px';
        span.style.lineHeight = '1';
        span.style.display = 'block';
        span.style.color = '#ff4d4d';
        span.style.transform = 'translateY(-10px)';
        el.appendChild(span);
        overlay.appendChild(el);
      }
      const warnSpan = el.querySelector('.world-cuidado-text');
      if (warnSpan){
        warnSpan.style.color = '#ff4d4d';
      }
      el.style.left = (rect.left + canvasX * sx) + 'px';
      el.style.top = (rect.top + canvasY * sy) + 'px';
      el.style.opacity = String(Math.max(0, Math.min(1, opacity)));
    }
    if (state.goldWarnT > 0){
      const g = state.gold;
      const cx = g.x * tile + tile / 2;
      const topY = g.y * tile - 6;
      const a = Math.min(1, state.goldWarnT);
      const bounce = Math.sin((state.t || 0) * 10) * 3;
      syncCuidado('gold', cx, topY - 7 + bounce, a);
    }
    if (state.sentries){
      for (let si = 0; si < state.sentries.length; si++){
        const t = state.sentries[si];
        if (!(t.warnT > 0)) continue;
        const cx = t.x * tile + tile / 2;
        const topY = t.y * tile - 6;
        const a = Math.min(1, t.warnT);
        const bounce = Math.sin((state.t || 0) * 10) * 3;
        syncCuidado('sentry-' + t.x + '-' + t.y, cx, topY - 7 + bounce, a);
      }
    }
    if (state.playerWarnT > 0){
      const p = state.player;
      const cx = p.x * tile + tile / 2;
      const topY = p.y * tile - 6;
      const a = Math.min(1, state.playerWarnT);
      const bounce = Math.sin((state.t || 0) * 10) * 3;
      syncCuidado('player', cx, topY - 27 + bounce, a);
    }
    overlay.querySelectorAll('[data-world-warn]').forEach(function(el){
      const id = el.getAttribute('data-world-warn');
      if (id && !warnActive.has(id)) el.remove();
    });

    // ── "Pausado" (centro) ──
    const _placeBlock = state._selectionPaused || state.placingSentry || state.movingSentry ||
      state.placingClearPath || state.placingGoldMine || state.movingGoldMine ||
      state.placingBarricada || state.movingBarricada || state.placingPichaPoco || state.movingPichaPoco ||
      state.placingPortalBlue || state.placingPortalOrange || state.placingEspantalho || state.movingEspantalho;
    const showPause = state.running && !state.inMenu && state.pauseFade > 0.01 && !_placeBlock;
    let pauseEl = overlay.querySelector('[data-world-pause="1"]');
    if (showPause){
      if (!pauseEl){
        pauseEl = document.createElement('div');
        pauseEl.setAttribute('data-world-pause', '1');
        pauseEl.className = 'world-pause-overlay-text';
        pauseEl.textContent = 'Pausado';
        overlay.appendChild(pauseEl);
      }
      const a = Math.max(0, Math.min(1, state.pauseFade));
      const ease = a * a * (3 - 2 * a);
      pauseEl.style.display = 'block';
      pauseEl.style.left = (rect.left + (canvas.width / 2) * sx) + 'px';
      pauseEl.style.top = (rect.top + (canvas.height / 2 - 4 + (8 * (1 - ease))) * sy) + 'px';
      pauseEl.style.opacity = String(a);
    } else if (pauseEl){
      pauseEl.style.display = 'none';
    }
  };

  // Bloqueia botoes do HUD durante dialogos (pra evitar cliques indevidos)
  const __hudButtonsDuringDialog = [
    document.getElementById('pauseBtn'),
    document.getElementById('shopBtn'),
    document.getElementById('enemiesBtn'),
    document.getElementById('menuBackBtn'),
    document.getElementById('ingameOptBtn'),
    // In coop mode each player has their own shop button.  These should
    // also be disabled during dialogs to prevent opening the shop while
    // conversations are active, matching the single‑player behaviour.
    document.getElementById('p1ShopBtn'),
    document.getElementById('p2ShopBtn')
  ].filter(Boolean);

  function setHudButtonsLocked(locked){
    __hudButtonsDuringDialog.forEach(b=>{
      b.disabled = !!locked;
      b.setAttribute('aria-disabled', locked ? 'true' : 'false');
      // Em alguns navegadores/overlays, só o "disabled" visual não impede 100% dos cliques
      // quando há listeners antigos/encadeados. Pointer-events garante bloqueio real.
      try{ b.style.pointerEvents = locked ? 'none' : ''; }catch(_){}
    });
  }

// --- Guard extra: impede cliques em botões "travados" (disabled/aria-disabled) ---
(function(){
  const sel = '#pauseBtn,#shopBtn,#enemiesBtn,#menuBackBtn,#ingameOptBtn,#p1ShopBtn,#p2ShopBtn';
  document.addEventListener('click', function(ev){
    const t = ev.target && ev.target.closest ? ev.target.closest(sel) : null;
    if (!t) return;
    const aria = (t.getAttribute && t.getAttribute('aria-disabled')) || '';
    if (t.disabled || aria === 'true'){
      ev.preventDefault();
      ev.stopPropagation();
      // se algum listener já está no target, isso corta também
      try{ ev.stopImmediatePropagation(); }catch(_){}
      return false;
    }
  }, true); // capture
})();



  // === Wave Picker (\) ===
  let wavePickerInited = false;
  let wavePickerPrevPaused = false;

  function wavePickerEls(){
    return {
      modal: document.getElementById("wavePickerModal"),
      input: document.getElementById("wavePickerInput"),
      go: document.getElementById("wavePickerGo"),
      close: document.getElementById("wavePickerClose"),
    };
  }

  function isWavePickerOpen(){
    const {modal} = wavePickerEls();
    return !!(modal && modal.style.display === "flex");
  }

  function initWavePickerOnce(){
    if (wavePickerInited) return;
    const {modal, go, close} = wavePickerEls();
    if (!modal) return;
    wavePickerInited = true;

    if (go){
      go.addEventListener("click", ()=>{
        gotoWave(document.getElementById("wavePickerInput")?.value || (state.wave||1));
      });
    }
    if (close){
      close.addEventListener("click", closeWavePicker);
    }
    modal.addEventListener("click", (e)=>{
      if (e.target === modal) closeWavePicker();
    });
  }

  function openWavePicker(){
    const els = wavePickerEls();
    if (!els.modal) return;

    initWavePickerOnce();

    // fecha outras janelas
    try{ closeEnemiesModal(); }catch(_){}
    try{ closeShop(); }catch(_){}
    try{ closeOptions(); }catch(_){}

    // trava HUD e pausa o jogo
    setHudButtonsLocked(true);
    wavePickerPrevPaused = !!state.pausedManual;
    state.pausedManual = true;

    els.modal.style.display = "flex";
    els.modal.setAttribute("aria-hidden","false");

    if (els.input){
      els.input.value = String(state.wave || 1);
      setTimeout(()=>{ els.input.focus(); try{ els.input.select(); }catch(_){ } }, 0);
    }
  }

  function closeWavePicker(){
    const els = wavePickerEls();
    if (!els.modal) return;

    els.modal.style.display = "none";
    els.modal.setAttribute("aria-hidden","true");

    // destrava HUD e restaura pausa
    setHudButtonsLocked(!!(dialog && dialog.active));
    state.pausedManual = wavePickerPrevPaused;
  }

  function gotoWave(n){
    n = Math.max(1, Math.floor(Number(n||1)));

    state.wave = n;
    state.bandits = [];
    state.enemiesAlive = 0;
    state.enemiesToSpawn = 0;
    state.boss = null; state.boss2 = null; state._gemeosSplit=false; state._gemeosSplitT=0;
    try{
      const _gbw=document.getElementById('geminiBarsWrap');if(_gbw)_gbw.style.display='none';
      const _bmr2=document.getElementById('bossRowMain');if(_bmr2)_bmr2.style.display='flex';
      const _r1=document.getElementById('geminiRow1');if(_r1)_r1.style.display='flex';
      const _r2=document.getElementById('geminiRow2');if(_r2)_r2.style.display='flex';
    }catch(_){}
    state.betweenWaves = true;

    try{ bossName.style.visibility="hidden"; bossName.style.opacity="0"; bossBar.style.visibility="hidden"; bossBarFill.style.width="0%"; }catch(_){}
    try{
    const _gbw2=document.getElementById('geminiBarsWrap');if(_gbw2)_gbw2.style.display='none';
    const _bmr2=document.getElementById('bossRowMain');if(_bmr2)_bmr2.style.display='flex';
    const _gr1=document.getElementById('geminiRow1');if(_gr1)_gr1.style.display='flex';
    const _gr2=document.getElementById('geminiRow2');if(_gr2)_gr2.style.display='flex';
  }catch(_){}

    closeWavePicker();
    startWave();
  }




  function drawAllyPortrait(){
    const pctx = dialogPortrait.getContext("2d");
    const oy = 10;
    pctx.clearRect(0,0,dialogPortrait.width, dialogPortrait.height);
    pctx.fillStyle = "#0f1a1d"; pctx.fillRect(0,0,180,180);
    pctx.fillStyle = "rgba(44,180,200,0.14)"; pctx.beginPath(); pctx.arc(90, 95+oy, 78, 0, Math.PI*2); pctx.fill();
    pctx.fillStyle = "#1f4d1f"; pctx.fillRect(38,42+oy,104,16);
    pctx.beginPath(); pctx.moveTo(58, 36+oy); pctx.quadraticCurveTo(90,18+oy,122,36+oy); pctx.lineTo(122,46+oy); pctx.lineTo(58,46+oy); pctx.closePath(); pctx.fill();
    pctx.fillStyle = "#c7a06a"; pctx.fillRect(72,58+oy,36,34);
    pctx.fillStyle = "#111"; pctx.fillRect(80,72+oy,6,6); pctx.fillRect(96,72+oy,6,6);
    pctx.fillStyle = "#2e2e2e"; pctx.fillRect(62,122+oy,56,28);
    // triângulo desenhado por cima do retângulo
    pctx.fillStyle = "#8dc07f"; pctx.beginPath(); pctx.moveTo(58,102+oy); pctx.lineTo(122,102+oy); pctx.lineTo(90,136+oy); pctx.closePath(); pctx.fill();
  }


  
  function drawXerifePortrait(){
    const pctx = dialogPortrait.getContext('2d');
    const oy = 8;
    pctx.clearRect(0,0,dialogPortrait.width,dialogPortrait.height);
    pctx.fillStyle='#1b1206'; pctx.fillRect(0,0,180,180);
    // halo dourado
    pctx.fillStyle='rgba(243,210,59,0.13)';
    pctx.beginPath(); pctx.arc(90,95+oy,80,0,Math.PI*2); pctx.fill();
    // Aba do chapéu (bem larga, bege)
    pctx.fillStyle='#c8aa6a'; pctx.fillRect(22,52+oy,136,18);
    // Copa do chapéu (alta, larga, exagerada)
    pctx.fillStyle='#d4b87a';
    pctx.beginPath();
    pctx.moveTo(42,52+oy);
    pctx.lineTo(50,18+oy);
    pctx.lineTo(130,18+oy);
    pctx.lineTo(138,52+oy);
    pctx.closePath(); pctx.fill();
    // Faixa do chapéu
    pctx.fillStyle='#7a5030'; pctx.fillRect(42,48+oy,96,6);
    // Rosto (tom pele)
    pctx.fillStyle='#caa76a'; pctx.fillRect(60,70+oy,60,36);
    // Olhos
    pctx.fillStyle='#111'; pctx.fillRect(70,82+oy,8,7); pctx.fillRect(102,82+oy,8,7);
    // Corpo preto
    pctx.fillStyle='#1a1a1a'; pctx.fillRect(50,126+oy,80,28);
    // Bandana laranja
    pctx.fillStyle='#e06010';
    pctx.beginPath(); pctx.moveTo(50,106+oy); pctx.lineTo(130,106+oy); pctx.lineTo(90,130+oy); pctx.closePath(); pctx.fill();
    // Estrela de xerife
    pctx.fillStyle='#f3d23b'; pctx.fillRect(60,134+oy,14,14);
    pctx.fillStyle='#e0a257'; pctx.fillRect(63,137+oy,8,8);
  }

  function drawDinamiteiroPortrait(){
    const pctx = dialogPortrait.getContext('2d');
    const oy = 8;
    pctx.clearRect(0,0,dialogPortrait.width,dialogPortrait.height);
    pctx.fillStyle='#1a1400'; pctx.fillRect(0,0,180,180);
    pctx.fillStyle='rgba(232,160,20,0.15)';
    pctx.beginPath(); pctx.arc(90,95+oy,80,0,Math.PI*2); pctx.fill();
    pctx.fillStyle='#111'; pctx.fillRect(24,52+oy,132,16);
    pctx.fillStyle='#1a1a1a';
    pctx.beginPath();
    pctx.moveTo(44,52+oy); pctx.lineTo(52,18+oy); pctx.lineTo(128,18+oy); pctx.lineTo(136,52+oy);
    pctx.closePath(); pctx.fill();
    pctx.fillStyle='#c8a010'; pctx.fillRect(44,48+oy,92,6);
    pctx.fillStyle='#d4a030'; pctx.fillRect(60,70+oy,60,36);
    pctx.fillStyle='#111'; pctx.fillRect(70,82+oy,8,7); pctx.fillRect(102,82+oy,8,7);
    pctx.fillStyle='#cc1a1a';
    pctx.beginPath(); pctx.moveTo(52,106+oy); pctx.lineTo(128,106+oy); pctx.lineTo(90,130+oy); pctx.closePath(); pctx.fill();
    pctx.fillStyle='#e8c020'; pctx.fillRect(50,126+oy,80,28);
    pctx.fillStyle='#cc2222'; pctx.fillRect(134,100+oy,10,28);
    pctx.fillStyle='#888'; pctx.fillRect(136,88+oy,6,14);
    pctx.fillStyle='#ffdd00'; pctx.fillRect(138,82+oy,3,10);
  }

  function drawReparadorPortrait(){
    const pctx = dialogPortrait.getContext('2d');
    const oy = 8;
    pctx.clearRect(0, 0, dialogPortrait.width, dialogPortrait.height);
    pctx.fillStyle = '#0f1520';
    pctx.fillRect(0, 0, 180, 180);
    pctx.fillStyle = 'rgba(100, 180, 220, 0.14)';
    pctx.beginPath();
    pctx.arc(90, 95 + oy, 78, 0, Math.PI * 2);
    pctx.fill();
    pctx.fillStyle = '#c9a227';
    pctx.fillRect(28, 44 + oy, 124, 14);
    pctx.fillStyle = '#e8d040';
    pctx.fillRect(36, 28 + oy, 108, 22);
    pctx.fillStyle = '#3d5a80';
    pctx.fillRect(50, 72 + oy, 80, 72);
    pctx.fillStyle = '#2a4060';
    pctx.fillRect(50, 108 + oy, 80, 12);
    pctx.fillStyle = '#111';
    pctx.fillRect(64, 88 + oy, 8, 6);
    pctx.fillRect(108, 88 + oy, 8, 6);
    pctx.fillStyle = 'rgba(68, 221, 136, 0.35)';
    pctx.fillRect(58, 124 + oy, 64, 6);
  }

  function drawDogPortrait(){    const pctx = dialogPortrait.getContext('2d');
    const oy = 10;
    pctx.clearRect(0,0,dialogPortrait.width, dialogPortrait.height);
    pctx.fillStyle = '#0f1a1d'; pctx.fillRect(0,0,180,180);
    pctx.fillStyle = 'rgba(243,210,59,0.10)'; pctx.beginPath(); pctx.arc(90, 96+oy, 78, 0, Math.PI*2); pctx.fill();

    // Dog: bloco simples + orelhas + olhos + coleira + rabo
    const bx = 52, by = 52+oy, bw = 76, bh = 76;
    // body
    pctx.fillStyle = '#b07a3a'; pctx.fillRect(bx, by, bw, bh);
    // ears
    pctx.fillStyle = '#96622c';
    pctx.fillRect(bx, by-10, 14, 14);
    pctx.fillRect(bx+bw-14, by-10, 14, 14);
    // eyes
    pctx.fillStyle = '#111';
    pctx.fillRect(bx+18, by+24, 6, 6);
    pctx.fillRect(bx+bw-24, by+24, 6, 6);
    // collar — maior, na base da cabeça (by+60)
    pctx.fillStyle = '#b91414';
    pctx.fillRect(bx+4, by+60, bw-8, 9);
    pctx.fillStyle = '#f3d23b';
    pctx.fillRect(bx + Math.floor(bw/2)-3, by+60, 6, 9);
    // tail (2 blocks)
    pctx.fillStyle = '#b07a3a';
    pctx.fillRect(bx+bw, by+34, 10, 10);
    pctx.fillRect(bx+bw+10, by+30, 10, 10);

    // simple outline
    pctx.strokeStyle = 'rgba(0,0,0,0.35)'; pctx.lineWidth = 3;
    pctx.strokeRect(bx, by, bw, bh);
  }

function drawCowboyPortrait(){
    const pctx = dialogPortrait.getContext("2d");
    const oy = 8; // desloca um pouco para baixo para centralizar
    pctx.clearRect(0,0,dialogPortrait.width, dialogPortrait.height);
    // fundo
    pctx.fillStyle = "#1b1206"; pctx.fillRect(0,0,180,180);
    // halo
    pctx.fillStyle = "rgba(243,210,59,0.12)";
    pctx.beginPath(); pctx.arc(90, 95+oy, 80, 0, Math.PI*2); pctx.fill();

    // helpers de cor
    function hexToRgb(hex){
      if (!hex) return {r:0,g:0,b:0};
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return m ? { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) } : {r:0,g:0,b:0};
    }
    function rgbToHex(r,g,b){
      const to2 = v => ('0'+v.toString(16)).slice(-2);
      return '#' + to2(Math.max(0,Math.min(255,Math.round(r)))) + to2(Math.max(0,Math.min(255,Math.round(g)))) + to2(Math.max(0,Math.min(255,Math.round(b))));
    }
    function mix(c1,c2,t){ return { r: c1.r*(1-t)+c2.r*t, g: c1.g*(1-t)+c2.g*t, b: c1.b*(1-t)+c2.b*t }; }
    function luminance(c){ return 0.2126*(c.r/255) + 0.7152*(c.g/255) + 0.0722*(c.b/255); }

    const sk = (typeof state!=="undefined" && state && Number.isInteger(state.currentSkin) && SKINS[state.currentSkin]) ? SKINS[state.currentSkin] : null;
    const isClassic = (sk && (state.currentSkin===0 || sk.name==="Clássico"));

    // Cores base
    let hatCol, bandCol, jacketCol;
    if (isClassic){
      // Mantém exatamente como era antes
      hatCol = "#4d2f0a";      // chapéu marrom original
      bandCol = "#2b6cb0";     // bandana azul original
      jacketCol = "#6b4b1b";   // jaqueta marrom original
    } else {
      // Outras skins: chapéu e bandana da skin, jaqueta em paleta consistente
      hatCol = (sk && sk.hat) ? sk.hat : "#4d2f0a";
      bandCol = (sk && sk.body) ? sk.body : "#2b6cb0";
      let hatRGB = hexToRgb(hatCol);
      let bandRGB = hexToRgb(bandCol);
      let j = mix(bandRGB, hatRGB, 0.5);
      const Lh = luminance(hatRGB), Lb = luminance(bandRGB);
      let Lj = luminance(j);
      if (!(Lj < Lb)) { j = mix(bandRGB, hatRGB, 0.65); Lj = luminance(j); }
      if (!(Lj > Lh)) { j = mix(bandRGB, hatRGB, 0.35); Lj = luminance(j); }
      jacketCol = rgbToHex(j.r, j.g, j.b);
    }

    // chapéu (aba + copa) — desceu 6px para encostar na cabeça
    pctx.fillStyle = hatCol; pctx.fillRect(35,41+oy,110,18);
    pctx.beginPath(); pctx.moveTo(55, 36+oy); pctx.quadraticCurveTo(90,16+oy,125,36+oy); pctx.lineTo(125,46+oy); pctx.lineTo(55,46+oy); pctx.closePath(); pctx.fill();
    // rosto (fixo)
    pctx.fillStyle = "#caa76a"; pctx.fillRect(70,58+oy,40,36);
    // olhos
    pctx.fillStyle = "#111"; pctx.fillRect(78,74+oy,6,6); pctx.fillRect(96,74+oy,6,6);
    // jaqueta
    pctx.fillStyle = jacketCol; pctx.fillRect(60,122+oy,60,28);
    // estrela xerife
    pctx.fillStyle = "#f3d23b"; pctx.fillRect(66,132+oy,10,10);
    // bandana — desenhada por cima da jaqueta/rosto
    pctx.fillStyle = bandCol;
    pctx.beginPath(); pctx.moveTo(60,94+oy); pctx.lineTo(120,94+oy); pctx.lineTo(90,124+oy); pctx.closePath(); pctx.fill();
  }function openDialogLayer(){
    setHudButtonsLocked(true);
    (dialog.drawPortrait || drawCowboyPortrait)();
    dialogLayer.style.display = "flex";
    dialogLayer.setAttribute("aria-hidden","false");
  }
  function closeDialogLayer(){
    dialogLayer.style.display = "none";
    dialogLayer.setAttribute("aria-hidden","true");
  }

  function typeTick(){
    const line = dialog.lines[dialog.idx];
    if (!line){ endDialog(); return; }
    const full = line.text;
    if (dialog.char < full.length){
      dialog.char++;
      dialogText.textContent = full.slice(0, dialog.char);
      // barulhinho por letra (não em espaços)
      const ch = full[dialog.char-1];
      if (ch && ch.trim().length){
        const f = 520 + (dialog.char%5)*20;
        beep(f, 0.02, "square", 0.02);
      }
      dialog.timer = setTimeout(typeTick, dialog.speedMs);
    } else {
      dialog.timer = null;
    }
  }

  function startDialog(lines, opts){
    dialog.active = true;
    // Troca 'Cowboy' (placeholder do jogador) pelo nome do Perfil, se existir
    try{
      var __pname = getPlayerDisplayName();
      if (Array.isArray(lines)){
        lines = lines.map(function(l){
          try{
            if (l && typeof l === 'object' && l.name === 'Cowboy'){
              return Object.assign({}, l, { name: __pname });
            }
          }catch(_){}
          return l;
        });
      }
      if (opts && opts.name === 'Cowboy') opts = Object.assign({}, opts, { name: __pname });
    }catch(_){}
    setHudButtonsLocked(true); dialog.lines = lines.slice(0); dialog.idx = 0; dialog.char = 0;
    if (opts && opts.portrait === 'coop'){
      // retrato dinâmico baseado no palestrante (Cowboy 1 ou 2)
      dialog.drawPortrait = function(){
        const line = dialog.lines[dialog.idx];
        if (!line) return;
        const nm = (line.name||"").toLowerCase();
        if (nm.includes("2")){
          drawCowboy2Portrait();
        } else {
          drawCowboy1Portrait();
        }
      };
    } else {
      dialog.drawPortrait = (opts && opts.portrait === 'ally') ? drawAllyPortrait : (opts && opts.portrait === 'dog') ? drawDogPortrait : (opts && opts.portrait === 'xerife') ? drawXerifePortrait : (opts && opts.portrait === 'dinamiteiro') ? drawDinamiteiroPortrait : (opts && opts.portrait === 'reparador') ? drawReparadorPortrait : drawCowboyPortrait;
    }
    dialog.nameOverride = (opts && opts.name) ? opts.name : null;
    dialogText.textContent = "";
    dialogName.textContent = dialog.nameOverride || (dialog.lines[0] && dialog.lines[0].name) || getPlayerDisplayName();
    try{
      if (dialogName){
        _stripDecorNameClassesFromEl(dialogName);
        const __dnShown = String(dialogName.textContent || '').trim();
        const __dnPname = String(getPlayerDisplayName() || '').trim();
        if (__dnShown === __dnPname && typeof state !== 'undefined' && state && typeof state.equippedName === 'number' && window._decorNameCssById){
          const __dnc = String(window._decorNameCssById[state.equippedName] || '').trim();
          if (__dnc) dialogName.classList.add(__dnc);
        }
      }
    }catch(_){}
    openDialogLayer();
    state.pausedManual = true; // pausa o jogo
    try{ var pb=document.getElementById('pauseBtn'); if(pb) pb.textContent='Despausar'; }catch(_){}
    typeTick();
  }

  function nextDialog(){
    const line = dialog.lines[dialog.idx];
    if (!line) { endDialog(); return; }
    const full = line.text;
    if (dialog.char < full.length){
      dialog.char = full.length;
      dialogText.textContent = full;
      return;
    }
    dialog.idx++;
    dialog.char = 0;
    if (dialog.idx >= dialog.lines.length){ endDialog(); return; }
    dialogName.textContent = dialog.lines[dialog.idx].name || dialog.nameOverride || getPlayerDisplayName();
    try{
      if (dialogName){
        _stripDecorNameClassesFromEl(dialogName);
        const __dnShown = String(dialogName.textContent || '').trim();
        const __dnPname = String(getPlayerDisplayName() || '').trim();
        if (__dnShown === __dnPname && typeof state !== 'undefined' && state && typeof state.equippedName === 'number' && window._decorNameCssById){
          const __dnc = String(window._decorNameCssById[state.equippedName] || '').trim();
          if (__dnc) dialogName.classList.add(__dnc);
        }
      }
    }catch(_){}
    dialogText.textContent = "";
    typeTick();
  }

  function endDialog(){
    if (dialog.timer){ clearTimeout(dialog.timer); dialog.timer = null; }
    dialog.active = false; dialog.lines = []; dialog.idx=0; dialog.char=0;
    try{ _stripDecorNameClassesFromEl(dialogName); }catch(_){}
    setHudButtonsLocked(false);
    closeDialogLayer();
        // Reveal dog after its intro barks
    try{ if (state && state._revealDogAfterDialog){ const d=getDog(); if(d) d.hidden=false; state._revealDogAfterDialog=false; } }catch(_){ }
    try{ if (state && state._revealXerifeAfterDialog){ const xr=getXerife(); if(xr) xr.hidden=false; state._revealXerifeAfterDialog=false; } }catch(_){ }
    if (stateInStructuralPlaceMode()){
      state.pausedManual = true;
      try{ var pb=document.getElementById('pauseBtn'); if(pb) pb.textContent='Despausar'; }catch(_){}
    } else {
      state.pausedManual = false;
      try{ var pb=document.getElementById('pauseBtn'); if(pb) pb.textContent='Pausar'; }catch(_){}
    }
    beep(660,0.06,"square",0.03);
  }

  // Prompt inicial
  const dialogPrompt = document.getElementById("dialogPrompt");
  const dlgYes = document.getElementById("dlgYes");
  const dlgNo  = document.getElementById("dlgNo");
  let __dialogPromptPrevPaused = false;
  function openDialogPrompt(){
    setHudButtonsLocked(true);
    dialogPrompt.style.display = "flex";
    dialogPrompt.setAttribute("aria-hidden","false");
    // Pause gameplay while prompt is visible
    __dialogPromptPrevPaused = !!(state && state.pausedManual);
    if (state) state.pausedManual = true;
    try{ var pb=document.getElementById('pauseBtn'); if(pb) pb.textContent='Despausar'; }catch(_){ }
  }
  function closeDialogPrompt(){
    dialogPrompt.style.display = "none";
    dialogPrompt.setAttribute("aria-hidden","true");
  
    if (!dialog.active){
      setHudButtonsLocked(false);
      if (state){
        if (stateInStructuralPlaceMode()) state.pausedManual = true;
        else state.pausedManual = __dialogPromptPrevPaused;
      }
      try{ var pb=document.getElementById('pauseBtn'); if(pb) pb.textContent = (state && state.pausedManual) ? 'Despausar' : 'Pausar'; }catch(_){ }
    }
  }
  if (dlgYes && !dlgYes._bound){
    dlgYes._bound = true;
    dlgYes.addEventListener("click", ()=>{
      closeDialogPrompt();
      // Diálogo inicial (custom)
      const lines = [
        {name:"Cowboy", text:"Ei, parceiro! Tava só andando por aí e… do nada, encontrei essa pilha de ouro brilhando no sol. Agora tenho que cuidar pra nenhum bandido meter a mão!"},
        {name:"Cowboy", text:"Preciso de uma ajuda pra DEFENDER O OURO. Prometo dividir… a glória. O ouro não, sou pobre."},
        {name:"Cowboy", text:"Dica rápida: mova com WASD ou setinhas. A mira é automática pelo lado que você tá virado. Atira com Espaço."},
        {name:"Cowboy", text:"Quando tiver bastante Pontuação, abre a Loja pra dar uma olhada. Recarregamento rápido, bala afiada… tudo que cowboy moderno precisa."},
        {name:"Cowboy", text:"Minha opinião? pega as Dinamites, elas armam nos quatro cantos do ouro e viram fogos de artifício de bandido. Hit-kill, cabrum!"},
        {name:"Cowboy", text:"Ah, outra coisa! Matar vários ao mesmo tempo dá Combo com multiplicador. Abate Duplo, Triplo, Quádruplo… cara, é muito satisfatório!"},
        {name:"Cowboy", text:"Pronto, parceiro! Agora bora mostrar pra esses sem-vergonha que o ouro tem dono."}
      ];
      startDialog(lines, {portrait:'cowboy', name:'Cowboy'});
    });
  }
  if (dlgNo && !dlgNo._bound){
    dlgNo._bound = true;
    dlgNo.addEventListener("click", ()=>{
      closeDialogPrompt();
      if (stateInStructuralPlaceMode()){
        state.pausedManual = true;
        try{ var _pbn=document.getElementById('pauseBtn'); if(_pbn) _pbn.textContent='Despausar'; }catch(_){}
      } else {
        state.pausedManual = false;
        try{ var _pbx=document.getElementById('pauseBtn'); if(_pbx) _pbx.textContent='Pausar'; }catch(_){}
      }
    });
  }


  // Restaura os custos/estado visual da loja
  function resetShopUI(){
    // Reset de custos
    const defaults={fastfire:150,pierce:175,bulletspd:150,heal:200,movespd:125,
      firstaid:350,balatranslucida:700,dynamite:220,sentry:300,sentryup:260,ally:275,dog:375,
      aimassist:650,roll:800,saraivada:950,secondchance:1000,clearpath:40,goldmine:280,barricada:50,pichapoco:45,xerife:425,reparador:800,ricochete:190,dinamiteiro:1125,espantalho:150};
    for(const k in defaults){
      const s=document.querySelector('span[data-cost="'+k+'"]');
      if(s) s.textContent=String(defaults[k]);
    }
    // Reabilita todos os botões
    ['dynamite','sentry','sentryup','aimassist','roll','secondchance','ally','dog','balatranslucida',
     'pierce','bulletspd','fastfire','movespd','heal','firstaid','clearpath','goldmine','barricada','pichapoco','portal','xerife','reparador','ricochete','dinamiteiro','espantalho'].forEach(a=>{
      const b=document.querySelector('button[data-action="'+a+'"]');
      if(b){b.disabled=false;b.textContent="Comprar";}
    });
    // Segunda Chance reset explícito
    const scBtn=document.getElementById('btn-secondchance');
    if(scBtn){scBtn.disabled=false;scBtn.textContent="Comprar";}
    // saraivada: reset botão
    const sarCard=document.getElementById('card-saraivada');
    if(sarCard){const _sb2=sarCard.querySelector('button');if(_sb2){_sb2.disabled=false;_sb2.textContent='Comprar';}const _ss2=sarCard.querySelector('span[data-cost]');if(_ss2)_ss2.textContent='950';}
    // sentryup: oculto (sem torres)
    const suCard=document.getElementById('card-sentryup');
    if(suCard){suCard.style.display='none';suCard._cond=true;}
    // portal: reset to comprar on game reset (refreshShopVisibility handles in-game)
    (function(){
      const _pBtn=document.querySelector('button[data-action="portal"]');
      const _pSpan=document.querySelector('span[data-cost="portal"]');
      if(!_pBtn||!_pSpan)return;
      _pBtn.disabled=false; _pBtn.textContent='Comprar';
      _pBtn.style.background=''; _pBtn.style.borderColor=''; _pBtn.style.color='';
      _pSpan.textContent='400';
    })();
    // firstaid: oculto (wave < 12)
    const faCard=document.getElementById('card-firstaid');
    if(faCard){faCard.style.display='none';faCard._cond=true;}
    // Reset paginação para página 0
    if(window._setShopPage) window._setShopPage(0);
    else if(window._renderShopPage) window._renderShopPage();
  }

  /** Máx. compras de Recarregamento Rápido até 0,30s (750ms com −15% por passo). */
  function _shopFastfireMaxPurchases(){
    const minMs = 300;
    let c = 750;
    let n = 0;
    while (c > minMs + 0.5 && n < 48){
      const nx = Math.max(minMs, Math.round(c * 0.85));
      if (nx >= c) break;
      c = nx;
      n++;
    }
    return Math.max(1, n);
  }
  function _shopFastfirePurchasesDone(currentMs){
    const minMs = 300;
    const cd = (typeof currentMs === 'number' && isFinite(currentMs)) ? currentMs : 750;
    if (cd <= minMs + 0.5) return _shopFastfireMaxPurchases();
    let c = 750;
    let n = 0;
    while (c > cd + 0.5 && n < 48){
      const nx = Math.max(minMs, Math.round(c * 0.85));
      if (nx >= c) break;
      c = nx;
      n++;
    }
    return n;
  }

  /** Indicador "x/y" nos cards com limite (lado oposto ao custo). */
  function syncShopQtyIndicators(){
    if (typeof state === 'undefined' || !state) return;
    function q(action, cur, max){
      const els = document.querySelectorAll('#shopGrid [data-shop-qty="' + action + '"]');
      if (!els.length) return;
      if (max == null || max < 0){
        els.forEach(el => { el.textContent = ''; el.style.display = 'none'; });
        return;
      }
      var c0 = (typeof cur === 'number' && isFinite(cur)) ? cur : 0;
      c0 = Math.max(0, Math.min(Math.floor(c0), max));
      const txt = c0 + '/' + max;
      els.forEach(el => { el.textContent = txt; el.style.display = ''; });
    }
    const coop = !!state.coop;
    const ap = state.activeShopPlayer || 1;
    const moveTarget = coop ? (ap === 1 ? state.player : state.player2) : state.player;

    q('clearpath', (state._clearpathCount || 0), 4);
    q('portal', (state.portals && state.portals.blue && state.portals.orange) ? 1 : 0, 1);
    q('pichapoco', (state.pichaPocos && state.pichaPocos.length) || 0, PICHA_POCO_MAX);
    q('barricada', (state.barricadas && state.barricadas.length) || 0, 8);
    q('goldmine', (state.goldMines && state.goldMines.length) || 0, 4);
    q('sentry', (state.sentries && state.sentries.length) || 0, 4);
    q('espantalho', (state.espantalhos && state.espantalhos.length) || 0, 2);

    q('explosive', (state.explosiveLevel || 0), 3);
    q('ally', (state.allyLevel || 0), 10);
    q('dinamiteiro', (state.dinamiteiroLevel || 0), 4);
    q('dog', (state.dogLevel || 0), 5);
    q('xerife', (state.xerifeLevel || 0), 5);
    q('reparador', (state.reparadorLevel || 0), 5);
    q('bulletspd', (state.bulletSpdLevel || 0), 5);
    q('aimassist', (state.aimLevel || 0), 3);
    q('saraivada', (state.saraivadaLevel || 0), 4);

    const _cd = coop && ap === 2
      ? (typeof state.shotCooldownMs2 === 'number' ? state.shotCooldownMs2 : state.shotCooldownMs)
      : state.shotCooldownMs;
    q('fastfire', _shopFastfirePurchasesDone(_cd), _shopFastfireMaxPurchases());

    q('movespd', (moveTarget && (moveTarget.moveSpdCount || 0)) || 0, 3);

    const _rb = coop && ap === 2 ? (state.bulletBounce2 || 0) : (state.bulletBounce || 0);
    q('ricochete', _rb, 4);

    const _rl = coop && ap === 2 ? (state.rollLevel2 || 0) : (state.rollLevel || 0);
    q('roll', _rl, 3);

    const _dyn = (state.dynaLevel !== undefined && state.dynaLevel !== null) ? state.dynaLevel : -1;
    q('dynamite', Math.max(0, _dyn + 1), 5);
  }
  
function refreshShopVisibility(){
  if ((state.dinamiteiroLevel | 0) > 4){
    state.dinamiteiroLevel = 4;
    const _dmMig = getDinamiteiro();
    if (_dmMig) _dmMig.level = 4;
  }
  const firstAid = document.getElementById("card-firstaid");
  if (firstAid){ const _show=state.wave>=12; firstAid._cond=!_show; firstAid.style.display=_show?"":"none"; }

  // Coop mode restrictions: hide partner in local coop only; online coop keeps shop card; per-player item limits below
  if (state.coop){
    const _localCoopOnly = true;
    // Parceiro Pistoleiro: oculto só no coop local (P1 e P2); no coop online o cartão permanece
    // Bala Translúcida: lock if already bought
    try{
      const _btBtn = document.querySelector('button[data-action="balatranslucida"]');
      const _btSpan = document.querySelector('span[data-cost="balatranslucida"]');
      if(_btBtn && state && state.balaTranslucida){ _btBtn.disabled=true; _btBtn.textContent="Adquirido"; if(_btSpan) _btSpan.textContent="—"; }
    }catch(_){}
    const allyBtn = document.querySelector('button[data-action="ally"]');
    if (allyBtn){
      const card = allyBtn.closest('.card');
      if (card){
        // _cond obrigatório: senão _renderShopPage volta a exibir o card na paginação
        if (_localCoopOnly){ card._cond = true; card.style.display = 'none'; }
        else { card._cond = false; card.style.display = ''; }
      }
    }
    // Hide the dog companion card entirely
    const dogBtn = document.querySelector('button[data-action="dog"]');
    if (dogBtn){
      const card = dogBtn.closest('.card');
      if (card) card.style.display = 'none';
    }
    // Hide the xerife companion card entirely
    const xerifeBtn = document.querySelector('button[data-action="xerife"]');
    if (xerifeBtn){
      const card = xerifeBtn.closest('.card');
      if (card) card.style.display = 'none';
    }
    const reparadorBtnCoop = document.querySelector('button[data-action="reparador"]');
    if (reparadorBtnCoop){
      const card = reparadorBtnCoop.closest('.card');
      if (card) card.style.display = 'none';
    }
    // Determine which player is viewing the shop
    // Player1 cannot buy dynamites; Player2 cannot buy sentries
    const dynaBtn = document.querySelector('button[data-action="dynamite"]');
    const dynaCard = dynaBtn ? dynaBtn.closest('.card') : null;
    const sentryCard = document.getElementById('card-sentry');
    const sentryUpCard = document.getElementById('card-sentryup');
    if (state.activeShopPlayer === 1){
      // Player 1: hide dynamites
      if (dynaCard) dynaCard.style.display = 'none';
      // show sentry and sentryup normally (subject to tower count)
      if (sentryCard) sentryCard.style.display = '';
      if (sentryUpCard){
        // show or hide based on tower count later in function
        // We'll allow subsequent logic to adjust visibility
      }
    } else if (state.activeShopPlayer === 2){
      // Player 2: hide sentry and sentry upgrades; show dynamites
      if (dynaCard) dynaCard.style.display = '';
      if (sentryCard) sentryCard.style.display = 'none';
      if (sentryUpCard) sentryUpCard.style.display = 'none';
    }

    // Hide aimassist (mira aprimorada) upgrade for both players in coop
    (function(){
      const aimBtn = document.querySelector('button[data-action="aimassist"]');
      if (aimBtn){
        const card = aimBtn.closest('.card');
        if (card) card.style.display = 'none';
      }
    })();
  } else {
    // In single‑player, ensure all cards are displayed (partner upgrade may be hidden due to coop previously)
    const allyBtn = document.querySelector('button[data-action="ally"]');
    if (allyBtn){ const card = allyBtn.closest('.card'); if (card){ card._cond = false; card.style.display = ''; } }
    const dogBtn = document.querySelector('button[data-action="dog"]');
    if (dogBtn){ const card = dogBtn.closest('.card'); if (card) card.style.display = ''; }
    const xerifeBtn2 = document.querySelector('button[data-action="xerife"]');
    if (xerifeBtn2){ const card = xerifeBtn2.closest('.card'); if (card) card.style.display = ''; }
    const reparadorBtnSp = document.querySelector('button[data-action="reparador"]');
    if (reparadorBtnSp){ const card = reparadorBtnSp.closest('.card'); if (card) card.style.display = ''; }
    const dynaBtn = document.querySelector('button[data-action="dynamite"]');
    const dynaCard = dynaBtn ? dynaBtn.closest('.card') : null;
    if (dynaCard) dynaCard.style.display = '';
    const sentryCard = document.getElementById('card-sentry'); if (sentryCard) sentryCard.style.display = '';
    const sentryUpCard = document.getElementById('card-sentryup'); if (sentryUpCard) { /* nothing here; logic below will hide if needed */ }
  }

  // Sentry visible from Wave 1
  const cs = document.getElementById("card-sentry");
  if (cs){ cs.style.display = ""; }

  // SentryUp visible when there's at least 1 tower
  const cu = document.getElementById("card-sentryup");
  if (cu){ const _ht=!!(state.sentries&&state.sentries.length>=1); cu._cond=!_ht; cu.style.display=_ht?"":"none"; }

  // Handle MAX/disabled states (persist cards like Dinamites)
  // SENTRY MAX (>=4)
  (function(){
    const btn = document.querySelector('button[data-action="sentry"]');
    const span = document.querySelector('span[data-cost="sentry"]');
    if (!btn || !span) return;
    if (state.sentries && state.sentries.length >= 4){
      btn.disabled = true; btn.textContent = "Máx.";
      span.textContent = "—";
    } else {
      btn.disabled = false; btn.textContent = "Comprar";
      if (span.textContent === "—" || !/^\d+$/.test(span.textContent)) span.textContent = "300";
    }
  })();

  // EXPLOSIVE MAX (>=3)
  (function(){
    const btn = document.querySelector('button[data-action="explosive"]');
    const span = document.querySelector('span[data-cost="explosive"]');
    if (!btn || !span) return;
    const lvl = state.explosiveLevel || 0;
    const costs = [240, 440, 810];
    if (lvl >= 3){
      btn.disabled = true; btn.textContent = "Máx."; span.textContent = "—";
    } else {
      btn.disabled = false;
      if (btn.textContent === "Máx.") btn.textContent = "Comprar";
      if (span.textContent === "—") span.textContent = String(costs[lvl]);
    }
  })();

  // DINAMITEIRO MAX (4 níveis)
  (function(){
    const btn=document.querySelector('button[data-action="dinamiteiro"]');
    const span=document.querySelector('span[data-cost="dinamiteiro"]');
    if(!btn||!span) return;
    const lvl=state.dinamiteiroLevel||0;
    const dmCosts=[1125,1375,1690,2065]; // até Nv.4
    if(lvl>=4){btn.disabled=true;btn.textContent="Máx.";span.textContent="—";}
    else{btn.disabled=false;btn.textContent="Comprar";span.textContent=String(dmCosts[lvl]);}
  })();

  // ESPANTALHO MAX (>=2)
  (function(){
    const btn=document.querySelector('button[data-action="espantalho"]');
    const span=document.querySelector('span[data-cost="espantalho"]');
    if(!btn||!span) return;
    const cnt=(state.espantalhos&&state.espantalhos.length)||0;
    if(cnt>=2){btn.disabled=true;btn.textContent="Máx.";span.textContent="—";}
    else{btn.disabled=false;btn.textContent="Comprar";span.textContent=cnt===0?"150":"220";}
  })();

  // DOG MAX (>=5)
  (function(){
    const btn = document.querySelector('button[data-action="dog"]');
    const span = document.querySelector('span[data-cost="dog"]');
    if (!btn || !span) return;
    const lvl = state.dogLevel || 0; // 0..5
    const costs = [375, 500, 650, 820, 1000];
    if (lvl >= 5){
      btn.disabled = true; btn.textContent = "Máx."; span.textContent = "—";
    } else {
      btn.disabled = false; btn.textContent = "Comprar";
      span.textContent = String(costs[lvl]);
    }
  })();

  // REPARADOR MAX (>=5 níveis)
  (function(){
    const btn=document.querySelector('button[data-action="reparador"]');
    const span=document.querySelector('span[data-cost="reparador"]');
    if(!btn||!span) return;
    const lvl=state.reparadorLevel||0;
    const rpCosts=[800,1060,1400,1800,2250];
    if(lvl>=5){btn.disabled=true;btn.textContent="Máx.";span.textContent="—";}
    else{btn.disabled=false;btn.textContent="Comprar";span.textContent=String(rpCosts[lvl]);}
  })();



  // BULLETSPD MAX (>=5)
  (function(){
    const btn = document.querySelector('button[data-action="bulletspd"]');
    const span = document.querySelector('span[data-cost="bulletspd"]');
    if (!btn || !span) return;
    if ((state.bulletSpdLevel||0) >= 5){
      btn.disabled = true; btn.textContent = "Máx."; span.textContent = "—";
    }
  })();

  // FASTFIRE MAX (<=300ms)
  (function(){
    const btn = document.querySelector('button[data-action="fastfire"]');
    const span = document.querySelector('span[data-cost="fastfire"]');
    if (!btn || !span) return;
    const _cd = state.coop&&state.activeShopPlayer===2
      ? (typeof state.shotCooldownMs2==="number"?state.shotCooldownMs2:state.shotCooldownMs)
      : state.shotCooldownMs;
    if (_cd <= 300){
      btn.disabled = true; btn.textContent = "Máx."; span.textContent = "—";
    } else {
      btn.disabled = false;
      if (btn.textContent === "Máx.") btn.textContent = "Comprar";
      if (span.textContent === "—") span.textContent = "150";
    }
  })();

  // MOVESPD MAX (>=3)
  (function(){
    const btn = document.querySelector('button[data-action="movespd"]');
    const span = document.querySelector('span[data-cost="movespd"]');
    if (!btn || !span) return;
    const _target = state.coop ? (state.activeShopPlayer===1?state.player:state.player2) : state.player;
    if ((_target.moveSpdCount||0) >= 3){
      btn.disabled = true; btn.textContent = "Máx."; span.textContent = "—";
    } else {
      btn.disabled = false;
      if (btn.textContent === "Máx.") btn.textContent = "Comprar";
      if (span.textContent === "—") span.textContent = "130";
    }
  })();

  // AIMAID MAX (>=3)
  (function(){
    const btn = document.querySelector('button[data-action="aimassist"]');
    const span = document.querySelector('span[data-cost="aimassist"]');
    if (!btn || !span) return;
    if ((state.aimLevel||0) >= 3){
      btn.disabled = true; btn.textContent = "Máx.";
      span.textContent = "—";
    } else {
      btn.disabled = false;
      if (btn.textContent === "Máx.") btn.textContent = "Comprar";
    }
  })();

  // ROLL MAX / cost per player
  (function(){
    const btn = document.querySelector('button[data-action="roll"]');
    const span = document.querySelector('span[data-cost="roll"]');
    if (!btn || !span) return;
    if (state.coop){
      // Determine the active player's roll level and cost
      const lvl = (state.activeShopPlayer === 1 ? (state.rollLevel||0) : (state.rollLevel2||0));
      const cost = (state.activeShopPlayer === 1 ? state.rollCost1 : state.rollCost2);
      span.textContent = String(cost);
      if (lvl >= 3){
        btn.disabled = true; btn.textContent = "Máx.";
      } else {
        btn.disabled = false; btn.textContent = "Comprar";
      }
    } else {
      // Single player logic: check global roll level
      if ((state.rollLevel||0) >= 3){
        btn.disabled = true; btn.textContent = "Máx.";
        span.textContent = "—";
      } else {
        btn.disabled = false;
        if (btn.textContent === "Máx.") btn.textContent = "Comprar";
      }
    }
  })();



  // Saraivada MAX
  (function(){
    const _sarBtn = document.querySelector('button[data-action="saraivada"]');
    const _sarSpan = document.querySelector('span[data-cost="saraivada"]');
    if (_sarBtn && _sarSpan){
      if ((state.saraivadaLevel||0) >= 4){
        _sarBtn.disabled = true; _sarBtn.textContent = 'Máx.'; _sarSpan.textContent = '—';
      } else {
        if (_sarBtn.textContent === 'Máx.') _sarBtn.textContent = 'Comprar';
      }
    }
  })();
  // re-render paginação após cada refresh de visibilidade
  if (window._renderShopPage) window._renderShopPage();

  // SENTRYUP MAX (>=4)
  (function(){
    const btn = document.querySelector('button[data-action="sentryup"]');
    const span = document.querySelector('span[data-cost="sentryup"]');
    if (!btn || !span) return;
    const upCount = (state._sentryUpCount||0);
    if (upCount >= 4){
      btn.disabled = true; btn.textContent = "Máx.";
      span.textContent = "—";
    } else if (state.sentries && state.sentries.length >= 1) {
      btn.disabled = false; btn.textContent = "Comprar";
      if (span.textContent === "—" || !/^\d+$/.test(span.textContent)) span.textContent = "150";
    } else {
      // hide card until at least 1 tower exists
      const card = document.getElementById("card-sentryup");
      if (card){ card.style.display="none"; card._cond=true; }
    }
  })();
  // CLEARPATH MAX (>=4)
  (function(){
    const btn = document.querySelector('button[data-action="clearpath"]');
    const span = document.querySelector('span[data-cost="clearpath"]');
    if (!btn || !span) return;
    if ((state._clearpathCount||0) >= 4){
      btn.disabled = true; btn.textContent = "Máx."; span.textContent = "—";
    } else {
      btn.disabled = false;
      if (btn.textContent === "Máx.") btn.textContent = "Comprar";
      if (span.textContent === "—") span.textContent = "40";
    }
  })();

  // GOLDMINE MAX (>=4)
  (function(){
    const btn = document.querySelector('button[data-action="goldmine"]');
    const span = document.querySelector('span[data-cost="goldmine"]');
    if (!btn || !span) return;
    if (state.goldMines && state.goldMines.length >= 4){
      btn.disabled = true; btn.textContent = "Máx."; span.textContent = "—";
    } else {
      btn.disabled = false;
      if (btn.textContent === "Máx.") btn.textContent = "Comprar";
      if (span.textContent === "—") span.textContent = "500";
    }
  })();

  // BARRICADA MAX (>=8)
  (function(){
    const btn = document.querySelector('button[data-action="barricada"]');
    const span = document.querySelector('span[data-cost="barricada"]');
    if (!btn || !span) return;
    if (state.barricadas && state.barricadas.length >= 8){
      btn.disabled = true; btn.textContent = "Máx."; span.textContent = "—";
    } else {
      btn.disabled = false;
      if (btn.textContent === "Máx.") btn.textContent = "Comprar";
      if (span.textContent === "—") span.textContent = "50";
    }
  })();

  // PICHAPOCO MAX
  (function(){
    const btn = document.querySelector('button[data-action="pichapoco"]');
    const span = document.querySelector('span[data-cost="pichapoco"]');
    if (!btn || !span) return;
    if (state.pichaPocos && state.pichaPocos.length >= PICHA_POCO_MAX){
      btn.disabled = true; btn.textContent = "Máx."; span.textContent = "—";
    } else {
      btn.disabled = false;
      if (btn.textContent === "Máx.") btn.textContent = "Comprar";
      if (span.textContent === "—") span.textContent = "45";
    }
  })();

  // PORTAL: cinza + "—" quando par ativo; comprar quando destruído
  (function(){
    const btn = document.querySelector('button[data-action="portal"]');
    const span = document.querySelector('span[data-cost="portal"]');
    if (!btn || !span) return;
    const _active = !!(state.portals && state.portals.blue && state.portals.orange);
    if (_active){
      btn.disabled = true;
      btn.textContent = 'Ativo';
      btn.style.background = '#555';
      btn.style.borderColor = '#777';
      btn.style.color = '#aaa';
      span.textContent = '—';
    } else {
      btn.disabled = false;
      btn.textContent = 'Comprar';
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
      if (span.textContent === '—') span.textContent = '400';
    }
  })();

  // Parceiro pistoleiro: custo na loja e botão conforme pontos
  (function(){ try{ syncAllyShopCardUI(); }catch(_){} })();

  try{ syncShopQtyIndicators(); }catch(_){}
}

  function inBounds(x,y){ return x>=0 && y>=0 && x<GRID_W && y<GRID_H; }

  // === Gold Mine helpers ===
  function _goldMineHealAmount(lvl){
    // Nv1:5  Nv2:7  Nv3:10  Nv4:13  Nv5:15
    const heals = [5, 7, 10, 13, 15];
    return heals[Math.min(5, Math.max(1, lvl)) - 1];
  }
  function _goldMineInterval(lvl){
    // Nv1:3w  Nv2:2w  Nv3:2w  Nv4:1w  Nv5:1w
    const intervals = [3, 2, 2, 1, 1];
    return intervals[Math.min(5, Math.max(1, lvl)) - 1];
  }
  function stepGoldMines(){
    if(!state.goldMines||!state.goldMines.length)return;
    for(const m of state.goldMines){
      if(m.warnT>0) m.warnT=Math.max(0,m.warnT-0.016);
    }
  }

  function goldAdjacentTiles(){
    const arr = [];
    const gx = state.gold.x, gy = state.gold.y;
    const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
    for (const d of dirs){
      const x = gx + d.x, y = gy + d.y;
      if (inBounds(x,y)) arr.push({x,y});
    }
    return arr;
  }
  // === Fundo pre-renderizado (sem flicker) ===
  function buildBackground(){
    const off = document.createElement('canvas');
    off.width = CANVAS_W;
    off.height = CANVAS_H;
    const g = off.getContext('2d');
    // Determine the active bioma. Use state.mapId if available (set
    // during resetGame), otherwise fall back to the globally tracked
    // currentMapId. Default to desert if nothing is set.
    const mapId = (state && state.mapId) || window.currentMapId || 'desert';
    const def = MAP_DEFS[mapId] || MAP_DEFS.desert;
    // Base ground colour
    g.fillStyle = def.colors.mid;
    g.fillRect(0, 0, off.width, off.height);
    // Static per‑tile noise: three blotches per tile using light/dark
    const isSnowMap = (mapId === 'snow');
    const baseAlpha = isSnowMap ? 0.19 : 0.12;
    for (let y = 0; y < GRID_H; y++){
      for (let x = 0; x < GRID_W; x++){
        const px = x * TILE;
        const py = y * TILE;
        for (let k = 0; k < 3; k++){
          const rx = px + 4 + Math.random() * (TILE - 8);
          const ry = py + 4 + Math.random() * (TILE - 8);
          const rw = 6 + Math.random() * 10;
          const rh = 4 + Math.random() * 8;
          g.globalAlpha = baseAlpha;
          g.fillStyle = Math.random() < 0.5 ? def.colors.light : def.colors.dark;
          g.fillRect(rx, ry, rw, rh);
          g.globalAlpha = 1;
        }
        // Extra snow texture: subtle icy ripples and sparkle dots
        if (isSnowMap){
          // Ripple/crack lines on snow surface
          if (Math.random() < 0.35){
            g.strokeStyle = Math.random() < 0.5 ? '#cdd8e8' : '#dae4f0';
            g.globalAlpha = 0.22;
            g.lineWidth = 0.8;
            g.beginPath();
            const lx = px + 3 + Math.random() * (TILE - 6);
            const ly = py + 3 + Math.random() * (TILE - 6);
            g.moveTo(lx, ly);
            g.lineTo(lx + (Math.random()-0.5)*10, ly + (Math.random()-0.5)*10);
            g.stroke();
            g.globalAlpha = 1;
          }
          // Sparkle dots (glinting snow crystals)
          for (let s = 0; s < 2; s++){
            if (Math.random() < 0.45){
              g.globalAlpha = 0.28;
              g.fillStyle = '#ffffff';
              g.beginPath();
              g.arc(px + 2 + Math.random()*(TILE-4), py + 2 + Math.random()*(TILE-4), 0.7, 0, Math.PI*2);
              g.fill();
              g.globalAlpha = 1;
            }
          }
          // Subtle blue-tinted shadow blotch to add depth
          if (Math.random() < 0.25){
            g.globalAlpha = 0.10;
            g.fillStyle = '#8aa8c8';
            const bx = px + Math.random()*(TILE-12);
            const by = py + Math.random()*(TILE-10);
            g.fillRect(bx, by, 8 + Math.random()*8, 5 + Math.random()*6);
            g.globalAlpha = 1;
          }
        }
        // Extra canyon texture: scattered pebbles and subtle dust
        if (mapId === 'canyon'){
          // Scattered pebbles
          if (Math.random() < 0.35){
            g.globalAlpha = 0.22;
            g.fillStyle = Math.random() < 0.5 ? '#7a1e10' : '#b83828';
            g.beginPath();
            g.ellipse(px + 3 + Math.random()*(TILE-6), py + 3 + Math.random()*(TILE-6), 1.8, 1.1, Math.random()*Math.PI, 0, Math.PI*2);
            g.fill();
            g.globalAlpha = 1;
          }
          // Occasional larger flat stone
          if (Math.random() < 0.10){
            g.globalAlpha = 0.18;
            g.fillStyle = '#8a2818';
            g.beginPath();
            g.ellipse(px + 4 + Math.random()*(TILE-8), py + 4 + Math.random()*(TILE-8), 4, 2.5, Math.random()*Math.PI, 0, Math.PI*2);
            g.fill();
            g.globalAlpha = 1;
          }
        }
      }
    }
    // Draw static obstacles for this map
    for (let y = 0; y < GRID_H; y++){
      for (let x = 0; x < GRID_W; x++){
        const type = state.map[y][x];
        if (type === 0 || type === 9 || type === 6) continue;
        const px = x * TILE;
        const py = y * TILE;
        if (type === 1){
          // obstacle type 1
          try { def.drawObstacle1(g, px, py); } catch(e){}
        } else if (type === 2){
          try { def.drawObstacle2(g, px, py); } catch(e){}
        } else if (type === 5){
          // Boneco de neve (tundra)
          (function(_g,_px,_py){
            _g.fillStyle='rgba(0,0,0,0.18)';
            _g.beginPath();_g.ellipse(_px+16,_py+TILE-4,11,4,0,0,Math.PI*2);_g.fill();
            _g.fillStyle='#e8eff7';_g.beginPath();_g.arc(_px+16,_py+22,7,0,Math.PI*2);_g.fill();
            _g.strokeStyle='#b0c0d0';_g.lineWidth=0.8;_g.stroke();
            _g.fillStyle='#f2f6fc';_g.beginPath();_g.arc(_px+16,_py+13,5,0,Math.PI*2);_g.fill();
            _g.strokeStyle='#b0c0d0';_g.lineWidth=0.7;_g.stroke();
            _g.fillStyle='#222';
            _g.beginPath();_g.arc(_px+14,_py+12,0.9,0,Math.PI*2);_g.fill();
            _g.beginPath();_g.arc(_px+18,_py+12,0.9,0,Math.PI*2);_g.fill();
            _g.fillStyle='#e07020';_g.beginPath();_g.arc(_px+16,_py+13.5,1,0,Math.PI*2);_g.fill();
            _g.fillStyle='#334';
            _g.beginPath();_g.arc(_px+16,_py+19,0.9,0,Math.PI*2);_g.fill();
            _g.beginPath();_g.arc(_px+16,_py+22,0.9,0,Math.PI*2);_g.fill();
            _g.fillStyle='#c0220a';_g.fillRect(_px+11,_py+17,10,2);
            _g.strokeStyle='#7a5020';_g.lineWidth=1.2;
            _g.beginPath();_g.moveTo(_px+9,_py+21);_g.lineTo(_px+6,_py+18);_g.stroke();
            _g.beginPath();_g.moveTo(_px+23,_py+21);_g.lineTo(_px+26,_py+18);_g.stroke();
            _g.fillStyle='#222240';_g.fillRect(_px+12,_py+7,8,5);_g.fillRect(_px+10,_py+8,12,2);
          })(g, px, py);
        } else if (type === 7){
          // Cogumelo vermelho gigante (pântano)
          (function(_g,_px,_py){
            const _cx=_px+16, _scale=0.80; // 20% menor que o skin do ouro
            const _oy=2; // offset vertical
            // Sombra
            _g.fillStyle='rgba(0,0,0,0.22)';
            _g.beginPath();_g.ellipse(_cx,_py+TILE-4,10,3.5,0,0,Math.PI*2);_g.fill();
            // Haste
            _g.fillStyle='#d8c8b0';
            _g.beginPath();
            _g.moveTo(_cx-4,_py+26+_oy);_g.lineTo(_cx+4,_py+26+_oy);
            _g.lineTo(_cx+3.5*_scale,_py+18+_oy);_g.lineTo(_cx-3.5*_scale,_py+18+_oy);
            _g.closePath();_g.fill();
            // Véu (saia)
            _g.fillStyle='rgba(210,190,170,0.65)';
            _g.beginPath();_g.ellipse(_cx,_py+19+_oy,7*_scale,2*_scale,0,0,Math.PI*2);_g.fill();
            // Chapéu — gradiente radial vermelho
            const _gCog=_g.createRadialGradient(_cx-2,_py+13+_oy,1,_cx,_py+15+_oy,9*_scale);
            _gCog.addColorStop(0,'#ff4444');_gCog.addColorStop(0.55,'#cc1010');_gCog.addColorStop(1,'#7a0000');
            _g.fillStyle=_gCog;
            _g.beginPath();_g.ellipse(_cx,_py+15+_oy,9*_scale,7.5*_scale,0,0,Math.PI*2);_g.fill();
            // Borda plana inferior do chapéu
            _g.fillStyle='#aa0e0e';
            _g.beginPath();_g.ellipse(_cx,_py+19+_oy,9*_scale,2.5*_scale,0,0,Math.PI*2);_g.fill();
            // Pintas brancas (4)
            _g.fillStyle='rgba(240,240,240,0.92)';
            const _spots=[[-3,-5,2.2],[3,-4,1.8],[0,-8,1.5],[-5,-2,1.4],[5,-2,1.3]];
            for(const [_sx,_sy,_sr] of _spots){
              _g.beginPath();_g.arc(_cx+_sx*_scale,_py+15+_oy+_sy*_scale,_sr*_scale,0,Math.PI*2);_g.fill();
            }
            // Luz vermelha suave (glow no canvas de fundo)
            const _glw=_g.createRadialGradient(_cx,_py+15+_oy,0,_cx,_py+15+_oy,22);
            _glw.addColorStop(0,'rgba(200,20,20,0.18)');
            _glw.addColorStop(0.5,'rgba(180,10,10,0.08)');
            _glw.addColorStop(1,'rgba(140,0,0,0)');
            _g.save();_g.globalCompositeOperation='screen';
            _g.fillStyle=_glw;
            _g.beginPath();_g.arc(_cx,_py+15+_oy,22,0,Math.PI*2);_g.fill();
            _g.restore();
          })(g, px, py);
        }
      }
    }
    // Swamp: draw lakes and bridges on background
    if((window.currentMapId||'')==='swamp'){ try{ drawSwampLakes(g); }catch(_){} }
    state.bgCanvas = off;
  }



  function makeMap() {
  function buildBackground(){
    const off = document.createElement('canvas');
    off.width = CANVAS_W; off.height = CANVAS_H;
    const g = off.getContext('2d');
    // base areia
    g.fillStyle = COLORS.sandMid;
    g.fillRect(0,0,off.width, off.height);
    // texturinha estática por tile (sem flicker)
    for (let y=0;y<GRID_H;y++){
      for (let x=0;x<GRID_W;x++){
        const px = x*TILE, py = y*TILE;
        // manchas leves, mas fixas (3 por tile)
        for (let k=0;k<3;k++){
          const rx = px + 4 + Math.random()* (TILE-8);
          const ry = py + 4 + Math.random()* (TILE-8);
          const rw = 6 + Math.random()*10;
          const rh = 4 + Math.random()*8;
          g.globalAlpha = 0.12;
          g.fillStyle = Math.random()<0.5 ? COLORS.sandLight : COLORS.sandDark;
          g.fillRect(rx, ry, rw, rh);
          g.globalAlpha = 1;
        }
      }
    }
    // desenha elementos estáticos do mapa (cactos e rochas)
    for (let y=0;y<GRID_H;y++){
      for (let x=0;x<GRID_W;x++){
        const type = state.map[y][x];
        const px = x*TILE, py = y*TILE;
        if (type===1){
          // Cacto vetorizado maior (sombra + tronco arredondado grosso + braços)
          g.fillStyle = COLORS.shadow; g.beginPath(); g.ellipse(px+16, py+TILE-5, 14, 5, 0, 0, Math.PI*2); g.fill();
          g.fillStyle = COLORS.cactus;
          // tronco arredondado (largura ~12)
          g.beginPath();
          g.moveTo(px+10, py+28);
          g.lineTo(px+10, py+16);
          g.quadraticCurveTo(px+10, py+10, px+16, py+10);
          g.quadraticCurveTo(px+22, py+10, px+22, py+16);
          g.lineTo(px+22, py+28);
          g.closePath(); g.fill();
          // braço esquerdo (mais grosso)
          g.beginPath();
          g.moveTo(px+10, py+18);
          g.quadraticCurveTo(px+7, py+14, px+10, py+12);
          g.quadraticCurveTo(px+12, py+14, px+12, py+18);
          g.closePath(); g.fill();
          // braço direito (mais grosso)
          g.beginPath();
          g.moveTo(px+22, py+18);
          g.quadraticCurveTo(px+25, py+14, px+22, py+12);
          g.quadraticCurveTo(px+20, py+14, px+20, py+18);
          g.closePath(); g.fill();
          // leve brilho
          g.globalAlpha = 0.15; g.fillStyle = "#7ccf7f";
          g.fillRect(px+12, py+14, 2, 8);
          g.globalAlpha = 1;
        } else if (type===2){
          // Rocha facetada com sombra e brilho
          g.fillStyle = COLORS.shadow; g.beginPath(); g.ellipse(px+18, py+22, 12, 8, 0.15, 0, Math.PI*2); g.fill();
          // Corpo da rocha
          g.fillStyle = COLORS.rock; g.beginPath();
          g.moveTo(px+10, py+22);
          g.lineTo(px+14, py+14);
          g.lineTo(px+22, py+12);
          g.lineTo(px+26, py+18);
          g.lineTo(px+24, py+26);
          g.lineTo(px+16, py+28);
          g.closePath(); g.fill();
          // Luz (highlight)
          g.fillStyle = '#8b7a6a';
          g.beginPath(); g.moveTo(px+20, py+14); g.lineTo(px+23, py+17); g.lineTo(px+18, py+18); g.closePath(); g.fill();
          // Fissura
          g.strokeStyle = '#5f5146'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(px+14, py+20); g.lineTo(px+18, py+23); g.lineTo(px+22, py+21); g.stroke();
        } else if (type===5){
          // Boneco de neve
          g.fillStyle='rgba(0,0,0,0.18)';
          g.beginPath();g.ellipse(px+16,py+TILE-4,11,4,0,0,Math.PI*2);g.fill();
          g.fillStyle='#e8eff7';g.beginPath();g.arc(px+16,py+22,7,0,Math.PI*2);g.fill();
          g.strokeStyle='#b0c0d0';g.lineWidth=0.8;g.stroke();
          g.fillStyle='#f2f6fc';g.beginPath();g.arc(px+16,py+13,5,0,Math.PI*2);g.fill();
          g.strokeStyle='#b0c0d0';g.lineWidth=0.7;g.stroke();
          g.fillStyle='#222';
          g.beginPath();g.arc(px+14,py+12,0.9,0,Math.PI*2);g.fill();
          g.beginPath();g.arc(px+18,py+12,0.9,0,Math.PI*2);g.fill();
          g.fillStyle='#e07020';g.beginPath();g.arc(px+16,py+13.5,1,0,Math.PI*2);g.fill();
          g.fillStyle='#334';
          g.beginPath();g.arc(px+16,py+19,0.9,0,Math.PI*2);g.fill();
          g.beginPath();g.arc(px+16,py+22,0.9,0,Math.PI*2);g.fill();
          g.fillStyle='#c0220a';g.fillRect(px+11,py+17,10,2);
          g.strokeStyle='#7a5020';g.lineWidth=1.2;
          g.beginPath();g.moveTo(px+9,py+21);g.lineTo(px+6,py+18);g.stroke();
          g.beginPath();g.moveTo(px+23,py+21);g.lineTo(px+26,py+18);g.stroke();
          g.fillStyle='#222240';g.fillRect(px+12,py+7,8,5);g.fillRect(px+10,py+8,12,2);
        }
      }
    }
    state.bgCanvas = off;
  }

    // Select the map definition based on the globally chosen bioma. If
    // none has been chosen yet, default to the desert. Each definition
    // specifies how many obstacles to scatter and the ratio of type 1 vs
    // type 2. The placement avoids the central ouro area and the four
    // sentry positions. See MAP_DEFS for details.
    const mapId = window.currentMapId || 'desert';
    const def = MAP_DEFS[mapId] || MAP_DEFS.desert;
    const grid = Array.from({length:GRID_H}, () => Array(GRID_W).fill(0));
    const avoid = new Set();
    const cx = Math.floor(GRID_W/2);
    const cy = Math.floor(GRID_H/2);
    // Reserve central 5x5 around ouro
    for (let yy = cy-2; yy <= cy+2; yy++){
      for (let xx = cx-2; xx <= cx+2; xx++){
        avoid.add(`${xx},${yy}`);
      }
    }
    // Reserve sentry spots (radius² ≤4) at cardinal positions
    (function(){
      const centerX = Math.floor(GRID_W/2);
      const centerY = Math.floor(GRID_H/2);
      const spots = [
        {x:centerX, y:2},
        {x:GRID_W-3, y:centerY},
        {x:centerX, y:GRID_H-3},
        {x:2, y:centerY}
      ];
      for (const p of spots){
        for (let dy=-2; dy<=2; dy++){
          for (let dx=-2; dx<=2; dx++){
            if (dx*dx + dy*dy <= 4){
              const xx = p.x + dx;
              const yy = p.y + dy;
              if (xx>=0 && yy>=0 && xx<GRID_W && yy<GRID_H){
                avoid.add(`${xx},${yy}`);
              }
            }
          }
        }
      }
    })();
    // Generate swamp lakes BEFORE obstacles so avoid set is populated
        // Swamp: generate 3-4 lakes (tile type 6 = water, passable for bullets, NOT for enemies/player)
    // Lakes are 2x2 or 3x2 groups of tiles, plus a bridge (tile 9=passable) crossing them
    if (mapId === 'swamp'){
      // ── Step 1: Generate lakes FIRST (so avoid set prevents obstacle overlap) ──
      const lakeCount = 2 + Math.floor(Math.random() * 2);
      const bridgeTiles = new Set(); // tracks which tile-9s are swamp bridges
      for(let lk=0; lk<lakeCount; lk++){
        let att=0;
        while(att<200){
          att++;
          const seedX = randInt(3, GRID_W-4);
          const seedY = randInt(3, GRID_H-4);
          if(avoid.has(seedX+','+seedY)) continue;
          // Check distance from other lakes
          let tooClose=false;
          for(let ky=0;ky<GRID_H&&!tooClose;ky++) for(let kx=0;kx<GRID_W&&!tooClose;kx++){
            if(grid[ky][kx]===6&&Math.abs(kx-seedX)+Math.abs(ky-seedY)<9) tooClose=true;
          }
          if(tooClose) continue;
          // ── Lake: rectangular base + organic border expansion ──
          // Step 1: pick a random rectangle (2-4 wide, 2-3 tall)
          const rectW = 2 + Math.floor(Math.random()*3); // 2,3,4
          const rectH = 2 + Math.floor(Math.random()*2); // 2,3
          // Centre the rect on seed, clamped to grid
          const rx0 = Math.max(2, Math.min(GRID_W-2-rectW, seedX - Math.floor(rectW/2)));
          const ry0 = Math.max(2, Math.min(GRID_H-2-rectH, seedY - Math.floor(rectH/2)));
          const lakeTiles = new Set();
          for(let dy=0;dy<rectH;dy++) for(let dx=0;dx<rectW;dx++){
            const key=(rx0+dx)+','+(ry0+dy);
            if(!avoid.has(key)) lakeTiles.add(key);
          }
          if(lakeTiles.size<3) continue;

          // Step 2: organically add 2-5 extra tiles on the border to break symmetry
          const dirs4=[[1,0],[-1,0],[0,1],[0,-1]];
          const extraMax = 2 + Math.floor(Math.random()*4);
          let growAtt=0;
          while(lakeTiles.size < lakeTiles.size + extraMax && growAtt < 300){
            growAtt++;
            // pick a random border tile (has at least one non-water neighbor)
            const keys=[...lakeTiles];
            const srcKey=keys[Math.floor(Math.random()*keys.length)];
            const[sx2,sy2]=srcKey.split(',').map(Number);
            // only expand from perimeter tiles
            let isPerimeter=false;
            for(const[dx,dy] of dirs4) if(!lakeTiles.has((sx2+dx)+','+(sy2+dy))){isPerimeter=true;break;}
            if(!isPerimeter) continue;
            const[ddx,ddy]=dirs4[Math.floor(Math.random()*4)];
            const nx=sx2+ddx, ny=sy2+ddy;
            if(nx<2||ny<2||nx>=GRID_W-2||ny>=GRID_H-2) continue;
            const key=nx+','+ny;
            if(lakeTiles.has(key)||avoid.has(key)) continue;
            // Only add if it won't create a fully-enclosed 2x2 block of new tiles
            // (keeps the edge irregular). Check: if adding this tile completes a 2x2
            // with 3 other existing tiles, skip 70% of the time
            let squareCount=0;
            for(const[cx,cy] of [[-1,-1],[0,-1],[-1,0]]){
              if(lakeTiles.has((nx+cx)+','+(ny+cy))&&lakeTiles.has((nx+cx+1)+','+(ny+cy))&&
                 lakeTiles.has((nx+cx)+','+(ny+cy+1))) squareCount++;
            }
            if(squareCount>0 && Math.random()<0.7) continue;
            lakeTiles.add(key);
            if(lakeTiles.size >= (rectW*rectH) + extraMax) break;
          }
          if(lakeTiles.size<4) continue;
          for(const key of lakeTiles){
            const[lx2,ly2]=key.split(',').map(Number);
            grid[ly2][lx2]=6; avoid.add(key);
          }

          // ── Bridge: find the SHORTEST crossing (fewest water tiles on that line) ──
          let minX=GRID_W,maxX=0,minY=GRID_H,maxY=0;
          for(const key of lakeTiles){
            const[lx2,ly2]=key.split(',').map(Number);
            if(lx2<minX)minX=lx2;if(lx2>maxX)maxX=lx2;
            if(ly2<minY)minY=ly2;if(ly2>maxY)maxY=ly2;
          }
          // Collect all valid horizontal crossings (skip top/bottom edge rows)
          const allRows=[], allCols=[];
          for(let ry=minY+1;ry<maxY;ry++){
            let rMinX=GRID_W,rMaxX=-1;
            for(let rx=minX;rx<=maxX;rx++) if(lakeTiles.has(rx+','+ry)){if(rx<rMinX)rMinX=rx;if(rx>rMaxX)rMaxX=rx;}
            if(rMaxX<0) continue;
            const leftOk  = rMinX>0        && !lakeTiles.has((rMinX-1)+','+ry);
            const rightOk = rMaxX<GRID_W-1 && !lakeTiles.has((rMaxX+1)+','+ry);
            if(leftOk&&rightOk) allRows.push({row:ry,minX:rMinX,maxX:rMaxX,span:rMaxX-rMinX+1});
          }
          // Collect all valid vertical crossings (skip left/right edge cols)
          for(let rx=minX+1;rx<maxX;rx++){
            let cMinY=GRID_H,cMaxY=-1;
            for(let ry=minY;ry<=maxY;ry++) if(lakeTiles.has(rx+','+ry)){if(ry<cMinY)cMinY=ry;if(ry>cMaxY)cMaxY=ry;}
            if(cMaxY<0) continue;
            const topOk    = cMinY>0        && !lakeTiles.has(rx+','+(cMinY-1));
            const bottomOk = cMaxY<GRID_H-1 && !lakeTiles.has(rx+','+(cMaxY+1));
            if(topOk&&bottomOk) allCols.push({col:rx,minY:cMinY,maxY:cMaxY,span:cMaxY-cMinY+1});
          }
          allRows.sort((a,b)=>a.span-b.span);
          allCols.sort((a,b)=>a.span-b.span);
          const shortR=allRows.length?allRows[0].span:99;
          const shortC=allCols.length?allCols[0].span:99;
          // Pool: crossings within 1 tile of shortest span → some variety without being long
          const poolR=allRows.filter(r=>r.span<=shortR+1);
          const poolC=allCols.filter(r=>r.span<=shortC+1);
          const canH=poolR.length>0, canV=poolC.length>0;
          const horiz=canH&&(!canV||shortR<=shortC||(shortR===shortC&&Math.random()<0.5));
          if(horiz){
            const entry=poolR[Math.floor(Math.random()*poolR.length)];
            for(let bx2=entry.minX-1;bx2<=entry.maxX+1;bx2++){
              if(bx2<0||bx2>=GRID_W) continue;
              const bkey=bx2+','+entry.row;
              if(grid[entry.row][bx2]===6||grid[entry.row][bx2]===0){
                grid[entry.row][bx2]=9; bridgeTiles.add(bkey); avoid.add(bkey);
              }
            }
          } else if(canV){
            const entry=poolC[Math.floor(Math.random()*poolC.length)];
            for(let by2=entry.minY-1;by2<=entry.maxY+1;by2++){
              if(by2<0||by2>=GRID_H) continue;
              const bkey=entry.col+','+by2;
              if(grid[by2][entry.col]===6||grid[by2][entry.col]===0){
                grid[by2][entry.col]=9; bridgeTiles.add(bkey); avoid.add(bkey);
              }
            }
          }          break;
        }
      }
      window._swampBridgeTiles = bridgeTiles; // Set of "x,y" strings
      // Also store per-tile orientation: 'h' = horiz bridge (player enters L/R), 'v' = vert (enters U/D)
      // Already known from horiz flag above; re-derive from the tile positions
      const bridgeOrient = new Map(); // "x,y" -> 'h' or 'v'
      for(const bk of bridgeTiles){
        const[bx,by]=bk.split(',').map(Number);
        // A bridge tile's orientation = direction of the bridge LINE itself
        // horiz bridge line = tiles arranged left-right = 'h', player enters from left/right
        // vert bridge line  = tiles arranged up-down   = 'v', player enters from top/bottom
        // We can check neighbors in the bridgeSet
        const neighH = bridgeTiles.has((bx-1)+','+by)||bridgeTiles.has((bx+1)+','+by);
        const neighV = bridgeTiles.has(bx+','+(by-1))||bridgeTiles.has(bx+','+(by+1));
        // edge tiles (1 neighbor) inherit from that neighbor's direction
        // For single-tile bridges default to horiz
        if(neighH&&!neighV) bridgeOrient.set(bk,'h');
        else if(neighV&&!neighH) bridgeOrient.set(bk,'v');
        else if(neighH&&neighV) bridgeOrient.set(bk,'h'); // corner - pick horiz
        else bridgeOrient.set(bk, horiz?'h':'v');
      }
      window._swampBridgeOrient = bridgeOrient;
      // Protect bridge exit tiles from obstacle placement
      for(const bk of bridgeTiles){
        const[bx,by]=bk.split(',').map(Number);
        const ori = bridgeOrient.get(bk);
        if(ori==='h'){
          // Exits are to the left/right of the bridge span
          // Find leftmost and rightmost bridge tile in this row
          // Just protect immediate neighbors that are NOT water
          if(bx>0&&grid[by][bx-1]===0) avoid.add((bx-1)+','+by);
          if(bx<GRID_W-1&&grid[by][bx+1]===0) avoid.add((bx+1)+','+by);
        } else {
          if(by>0&&grid[by-1][bx]===0) avoid.add(bx+','+(by-1));
          if(by<GRID_H-1&&grid[by+1][bx]===0) avoid.add(bx+','+(by+1));
        }
      }

      // ── Step 2: Mushrooms (placed after lakes so they don't overlap) ──
      {
        const mushroomCount = 2 + Math.floor(Math.random() * 2);
        const mushroomPlaced = [];
        let mAt=0;
        while(mushroomPlaced.length<mushroomCount&&mAt<300){
          mAt++;
          const mx=randInt(2,GRID_W-3), my=randInt(2,GRID_H-3);
          if(avoid.has(mx+','+my)) continue;
          if(grid[my][mx]!==0) continue;
          let near=false;
          for(const p of mushroomPlaced) if(Math.abs(mx-p.x)+Math.abs(my-p.y)<6){near=true;break;}
          if(near) continue;
          grid[my][mx]=7;
          avoid.add(mx+','+my);
          mushroomPlaced.push({x:mx,y:my});
        }
      }
    } else {
      window._swampBridgeTiles = null;
      window._swampBridgeOrient = null;
    }

        // Scatter obstacles
    let placed = 0;
    const max = def.numObstacles || 40;
    const prob1 = def.probType1 != null ? def.probType1 : 0.5;
    while (placed < max){
      const x = randInt(0, GRID_W-1);
      const y = randInt(0, GRID_H-1);
      if (avoid.has(`${x},${y}`)) continue;
      if (x === 0 || y === 0 || x === GRID_W-1 || y === GRID_H-1) continue;
      if (grid[y][x] !== 0) continue; // also skips water(6) and bridge(9)
      grid[y][x] = Math.random() < prob1 ? 1 : 2;
      placed++;
    }

    // Customise the snow map to have clusters of pine trees. When the selected
    // map is the tundra (snow), replace some scattered obstacles with small
    // patches of pinheiros. These clusters override empty tiles or rocks but
    // respect reserved areas and avoid the outer border.
    if (mapId === 'snow'){
      // 1–2 bonecos de neve (tile tipo 5), afastados entre si
      {
        const snowmanCount = 1 + Math.floor(Math.random() * 2);
        const placed = [];
        let smAt = 0;
        while (placed.length < snowmanCount && smAt < 300){
          smAt++;
          const sx = randInt(2, GRID_W-3), sy = randInt(2, GRID_H-3);
          if (avoid.has(sx+','+sy)) continue;
          if (grid[sy][sx] !== 0) continue;
          let near = false;
          for (const p of placed) if (Math.abs(sx-p.x)+Math.abs(sy-p.y)<5){ near=true; break; }
          if (near) continue;
          grid[sy][sx] = 5;
          placed.push({x:sx,y:sy});
        }
      }
      // Determine how many clusters to create based on the obstacle count.
      const clusterCount = Math.max(2, Math.floor((def.numObstacles || 35) / 12));
      for (let cc = 0; cc < clusterCount; cc++){
        let attempts = 0;
        while (attempts < 100){
          attempts++;
          // choose a random centre away from the edges (2..GRID_W-3)
          const cxRand = randInt(2, GRID_W-3);
          const cyRand = randInt(2, GRID_H-3);
          const key = `${cxRand},${cyRand}`;
          if (avoid.has(key)) continue;
          // choose cluster size: 3 or 4
          const size = 3 + Math.floor(Math.random() * 2);
          const positions = [];
          positions.push({x: cxRand, y: cyRand});
          // randomly expand cluster by picking neighbours of existing positions
          while (positions.length < size){
            const base = positions[Math.floor(Math.random() * positions.length)];
            const dx = randInt(-1, 1);
            const dy = randInt(-1, 1);
            if (dx === 0 && dy === 0) continue;
            const nx = base.x + dx;
            const ny = base.y + dy;
            // skip if out of bounds
            if (nx <= 0 || ny <= 0 || nx >= GRID_W - 1 || ny >= GRID_H - 1) continue;
            // skip if reserved
            if (avoid.has(`${nx},${ny}`)) continue;
            // avoid duplicates
            let exists = false;
            for (const p of positions){
              if (p.x === nx && p.y === ny){ exists = true; break; }
            }
            if (!exists) positions.push({x: nx, y: ny});
          }
          // assign pine type (1) to each position if currently empty or rock
          for (const pos of positions){
            if (grid[pos.y][pos.x] === 0 || grid[pos.y][pos.x] === 2){
              grid[pos.y][pos.x] = 1;
            }
          }
          break;
        }
      }
    }
    return grid;
  }

  // Garante que todos os tiles livres do mapa sejam alcançáveis entre si.
  // Remove obstáculos que criam bolsões isolados, repetindo até o mapa ser
  // totalmente conectado. Também garante que o tile do ouro seja acessível.
  function ensureMapConnected(grid, goldX, goldY){
    const W = GRID_W, H = GRID_H;

    function floodFill(startX, startY){
      const visited = new Set();
      const q = [[startX, startY]];
      visited.add(startX + startY * W);
      while (q.length){
        const [cx, cy] = q.pop();
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const nx = cx+dx, ny = cy+dy;
          if (nx<0||ny<0||nx>=W||ny>=H) continue;
          const k = nx + ny*W;
          if (visited.has(k)) continue;
          const _tv=grid[ny][nx]; if(_tv!==0&&_tv!==9) continue; // blocked (water=6 blocked, bridge=9 passable)
          visited.add(k);
          q.push([nx, ny]);
        }
      }
      return visited;
    }

    // Iteratively fix: find the largest connected component of free tiles,
    // then remove obstacles adjacent to any isolated free tiles to reconnect.
    for (let pass = 0; pass < 60; pass++){
      // Find all free tiles
      const freeTiles = [];
      for (let y=0;y<H;y++) for (let x=0;x<W;x++) if (grid[y][x]===0||grid[y][x]===9) freeTiles.push([x,y]);
      if (freeTiles.length === 0) break;

      // Find the largest connected component starting from gold tile
      const mainComponent = floodFill(goldX, goldY);

      // Find free tiles NOT in main component
      const isolated = freeTiles.filter(([x,y]) => !mainComponent.has(x + y*W));
      if (isolated.length === 0) break; // fully connected!

      // For each isolated tile, find an adjacent obstacle and remove it
      // to create a bridge toward the main component
      let fixed = false;
      for (const [ix, iy] of isolated){
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
          const nx = ix+dx, ny = iy+dy;
          if (nx<0||ny<0||nx>=W||ny>=H) continue;
          const _tnx=grid[ny][nx]; if(_tnx!==0&&_tnx!==3&&_tnx!==6&&_tnx!==9){ // obstacle (not gold/water/bridge)
            grid[ny][nx] = 0; // remove obstacle
            fixed = true;
            break;
          }
        }
        if (fixed) break;
      }
      if (!fixed) break; // cannot fix further
    }
    return grid;
  }


  // Returns true if bridge orientation blocks this specific movement direction.
  // A horizontal bridge ('h') only allows entry/exit left↔right (dx!=0, dy==0).
  // A vertical bridge ('v') only allows entry/exit up↔down (dx==0, dy!=0).
  // Also blocks exiting a bridge tile sideways (same logic applied to 'from' tile).
  function isBridgeMoveBlocked(fx,fy,tx,ty){
    const _bo=window._swampBridgeOrient;
    if(!_bo) return false;
    const dx=tx-fx, dy=ty-fy;
    // Check destination tile
    const _od=_bo.get(tx+','+ty);
    if(_od){
      if(_od==='h' && dy!==0) return true;
      if(_od==='v' && dx!==0) return true;
    }
    // Check source tile (can't exit sideways either)
    const _os=_bo.get(fx+','+fy);
    if(_os){
      if(_os==='h' && dy!==0) return true;
      if(_os==='v' && dx!==0) return true;
    }
    return false;
  }

  function isBlocked(x,y){
    if (!inBounds(x,y)) return true;
    // Torres Sentinelas ocupam a tile (se de pé)
    try {
      if (state && state.sentries && state.sentries.length){
        for (const t of state.sentries){
          const thp = (t.hp==null?4:t.hp);
          if (thp>0 && t.x===x && t.y===y) return true;
        }
      }
    } catch(_){}
    // Minas de Ouro também bloqueiam
    try {
      if (state && state.goldMines && state.goldMines.length){
        for (const m of state.goldMines){
          if (m.hp>0 && m.x===x && m.y===y) return true;
        }
      }
    } catch(_){}
    // Barricadas também bloqueiam
    try {
      if (state && state.barricadas && state.barricadas.length){
        for (const bar of state.barricadas){
          if (bar.hp>0 && bar.x===x && bar.y===y) return true;
        }
      }
    } catch(_){}
    // Espantalhos bloqueiam passagem
    try {
      if (state && state.espantalhos && state.espantalhos.length){
        for (const esp of state.espantalhos){
          if (esp.hp>0 && esp.x===x && esp.y===y) return true;
        }
      }
    } catch(_){}
    const _tv = state.map[y][x];
    if(_tv === 6) return true; // water always blocked
    return _tv !== 0 && _tv !== 9;
  }

  /** Eixo do ricochete: mesmos obstáculos que isBlocked (torre, mina, barricada…). Água (mapa 6) não conta como “parede” do eixo. */
  function ricochetAxisBlocked(x, y){
    if (!inBounds(x, y)) return true;
    try {
      if (state.map[y][x] === 6) return false;
    } catch (_){}
    return isBlocked(x, y);
  }


  // --- Vandal path helper: find barricade blocking path to a target ---
  function barricadeAt(x,y){
    try{
      if (state && state.barricadas && state.barricadas.length){
        for (const bar of state.barricadas){
          if (bar.hp>0 && bar.x===x && bar.y===y) return bar;
        }
      }
    }catch(_){}
    return null;
  }

  function sentryAt(x,y){
    try{
      if(state && state.sentries && state.sentries.length){
        for(const t of state.sentries){
          const thp=(t.hp==null?4:t.hp);
          if(thp>0 && t.x===x && t.y===y) return t;
        }
      }
    }catch(_){}
    return null;
  }

  // isBlocked variant that treats BOTH barricadas AND sentries as passable (for vandal path probing)
  function isBlockedIgnoreBarricadeAndSentry(x,y){
    if(!inBounds(x,y)) return true;
    // gold mines still block
    try{
      if(state && state.goldMines && state.goldMines.length){
        for(const m of state.goldMines){ if(m.hp>0 && m.x===x && m.y===y) return true; }
      }
    }catch(_){}
    const _tv=state.map[y][x];
    if(_tv===6) return true;
    return _tv!==0 && _tv!==9;
  }

  // Returns the first sentry on the path if the target is reachable only by going through a sentry
  function findBlockingSentryOnPath(sx,sy,tx,ty){
    if(!state || !state.sentries || !state.sentries.length) return null;
    const W=GRID_W, H=GRID_H;
    const start=sx+sy*W;
    const visited=new Uint8Array(W*H);
    const parent=new Int16Array(W*H).fill(-1);
    visited[start]=1;
    const q=[start];
    let head=0, found=-1;
    const DX=[1,-1,0,0], DY=[0,0,1,-1];
    while(head<q.length){
      const cur=q[head++];
      const cx=cur%W, cy=(cur/W)|0;
      for(let i=0;i<4;i++){
        const nx=cx+DX[i], ny=cy+DY[i];
        if(nx<0||ny<0||nx>=W||ny>=H) continue;
        const nk=nx+ny*W;
        if(visited[nk]) continue;
        if(nx===tx&&ny===ty) continue;
        if(isBlockedIgnoreBarricadeAndSentry(nx,ny)||isBridgeMoveBlocked(cx,cy,nx,ny)) continue;
        visited[nk]=1; parent[nk]=cur;
        if(Math.abs(nx-tx)+Math.abs(ny-ty)===1){ found=nk; head=q.length; break; }
        q.push(nk);
      }
    }
    if(found===-1) return null;
    let cur=found;
    const path=[];
    let safety=W*H;
    while(cur!==start&&cur!==-1&&safety-- > 0){ path.push(cur); cur=parent[cur]; }
    if(cur!==start) return null;
    path.reverse();
    for(const node of path){
      const x=node%W, y=(node/W)|0;
      const t=sentryAt(x,y);
      if(t) return t;
    }
    return null;
  }

  // isBlocked variant used ONLY for path probing (treat barricades as passable)
  function isBlockedIgnoreBarricade(x,y){
    if (!inBounds(x,y)) return true;
    // sentries block
    try{
      if (state && state.sentries && state.sentries.length){
        for (const t of state.sentries){
          const thp = (t.hp==null?4:t.hp);
          if (thp>0 && t.x===x && t.y===y) return true;
        }
      }
    }catch(_){}
    // gold mines block
    try{
      if (state && state.goldMines && state.goldMines.length){
        for (const m of state.goldMines){
          if (m.hp>0 && m.x===x && m.y===y) return true;
        }
      }
    }catch(_){}
    // NOTE: barricades are intentionally NOT blocking here
    const _tv2=state.map[y][x];
    if(_tv2===6) return true;
    return _tv2 !== 0 && _tv2 !== 9;
  }

  /**
   * If a target is unreachable only because of barricades, returns the first barricade
   * on a valid path to the target-adjacent tile (with barricades treated as passable).
   * Otherwise returns null.
   */
  function findBlockingBarricadeOnPath(sx,sy,tx,ty){
    if (!state || !state.barricadas || !state.barricadas.length) return null;
    const W = GRID_W, H = GRID_H;
    const start = sx + sy * W;
    const visited = new Uint8Array(W * H);
    const parent  = new Int16Array(W * H).fill(-1);
    visited[start] = 1;
    const q = [start];
    let head = 0;
    let found = -1;
    const DX = [1,-1,0,0], DY = [0,0,1,-1];

    while (head < q.length){
      const cur = q[head++];
      const cx = cur % W, cy = (cur / W) | 0;
      for (let i=0;i<4;i++){
        const nx = cx + DX[i], ny = cy + DY[i];
        if (nx<0||ny<0||nx>=W||ny>=H) continue;
        const nk = nx + ny * W;
        if (visited[nk]) continue;
        if (nx===tx && ny===ty) continue; // never step onto target tile
        if (isBlockedIgnoreBarricade(nx,ny) || isBridgeMoveBlocked(cx,cy,nx,ny)) continue;
        visited[nk] = 1;
        parent[nk] = cur;
        if (Math.abs(nx-tx)+Math.abs(ny-ty) === 1){ found = nk; head = q.length; break; }
        q.push(nk);
      }
    }
    if (found === -1) return null;

    // backtrack to build path
    let cur = found;
    const path = [];
    let safety = W * H;
    while (cur !== start && cur !== -1 && safety-- > 0){
      path.push(cur);
      cur = parent[cur];
    }
    if (cur !== start) return null;
    path.reverse();

    for (const node of path){
      const x = node % W, y = (node / W) | 0;
      const bar = barricadeAt(x,y);
      if (bar) return bar;
    }
    return null;
  }

  /**
   * BFS para encontrar o próximo passo de (sx,sy) até (tx,ty).
   * avoidTarget=true: não pisa no tile destino (fica adjacente).
   * avoidGold=true: não pisa no tile do ouro (gx,gy).
   * Retorna {x,y} do próximo passo, ou null se sem caminho.
   */
  function bfsNextStep(sx, sy, tx, ty, avoidTarget, avoidGold){
    if (sx === tx && sy === ty) return null;
    const gx = state.gold ? state.gold.x : -1;
    const gy = state.gold ? state.gold.y : -1;
    const W = GRID_W, H = GRID_H;
    // packed int key: x + y*W
    const start = sx + sy * W;
    const goal  = tx + ty * W;
    const visited = new Uint8Array(W * H);
    const parent  = new Int16Array(W * H).fill(-1);
    visited[start] = 1;
    const q = [start];
    let head = 0;
    let found = -1;
    const DX = [1, -1, 0, 0];
    const DY = [0,  0, 1,-1];
    outer: while (head < q.length){
      const cur = q[head++];
      const cx = cur % W, cy = (cur / W) | 0;
      for (let i = 0; i < 4; i++){
        const nx = cx + DX[i], ny = cy + DY[i];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nk = nx + ny * W;
        if (visited[nk]) continue;
        if (avoidTarget && nx === tx && ny === ty) continue;
        if (avoidGold && nx === gx && ny === gy) continue;
        if (isBlocked(nx, ny) || isBridgeMoveBlocked(cx,cy,nx,ny)) continue;
        visited[nk] = 1;
        parent[nk] = cur;
        if (nk === goal){ found = nk; break outer; }
        q.push(nk);
      }
    }
    if (found === -1) return null;
    // backtrack to first step
    let cur = found;
    let safety = W * H;
    while (parent[cur] !== start && parent[cur] !== -1 && safety-- > 0) cur = parent[cur];
    if (parent[cur] === -1 || safety <= 0) return null;
    return { x: cur % W, y: (cur / W) | 0 };
  }

  /**
   * Move robusto para inimigos: tenta heurística greedy primeiro,
   * depois BFS, depois BFS relaxado, depois teleporte de escape.
   * - target: {x,y} destino
   * - dontStepOn: tile que não pode pisar (ouro) — se null, sem restrição
   * - entity: referência ao inimigo (para _stuckSteps e teleporte)
   */
  /**
   * Move um inimigo um passo em direção a (tx,ty).
   *
   * Dijkstra com ruído por tile e por entidade: cada inimigo tem uma semente
   * aleatória que adiciona custo 0-3 por tile. Isso garante que o caminho
   * é sempre válido (nunca trava) mas cada inimigo toma uma rota ligeiramente
   * diferente, criando movimento natural e variado.
   */
  function enemyMoveTo(entity, tx, ty){
    // Sanitiza inputs - evita NaN/undefined que causam loop infinito
    if (!entity || typeof tx !== 'number' || typeof ty !== 'number' || isNaN(tx) || isNaN(ty)) return false;
    const sx = entity.x, sy = entity.y;
    if (typeof sx !== 'number' || typeof sy !== 'number' || isNaN(sx) || isNaN(sy)) return false;
    const W = GRID_W, H = GRID_H;
    const MAXN = W * H; // 285

    // Já adjacente — não move
    if (Math.abs(sx-tx) + Math.abs(sy-ty) <= 1){ entity._stuckSteps = 0; return false; }

    // Semente de ruído estável por entidade (muda quando o destino muda)
    const destKey = tx * 100 + ty;
    if (!entity._noiseSeed || entity._noiseTarget !== destKey){
      entity._noiseSeed = (Math.random() * 0xFFFFFF) | 0;
      entity._noiseTarget = destKey;
    }
    const seed = entity._noiseSeed;

    // Custo extra 0-3 por tile, determinístico dado semente+posição
    function extraCost(x, y){
      let h = (seed ^ (x * 374761393) ^ (y * 668265263)) >>> 0;
      h = (Math.imul(h ^ (h >>> 13), 1274126177)) >>> 0;
      return h & 3;
    }

    // Dijkstra com bucket queue (custos 1-4 por step, max dist ~285*4=1140)
    const BUCKETS = 1200;
    const buckets = Array.from({length: BUCKETS}, () => []);
    const dist    = new Uint16Array(MAXN).fill(0xFFFF);
    const parent  = new Int16Array(MAXN).fill(-1);
    const DX = [1,-1,0,0], DY = [0,0,1,-1];

    const start = sx + sy * W;
    dist[start] = 0;
    buckets[0].push(start);
    let found = -1;
    const _deadline = performance.now() + 8; // max 8ms por chamada

    for (let d = 0; d < BUCKETS && found === -1; d++){
      if (performance.now() > _deadline) break; // safety: nunca bloqueia a thread
      const bucket = buckets[d];
      for (let bi = 0; bi < bucket.length; bi++){
        const cur = bucket[bi];
        if (dist[cur] !== d) continue; // stale entry
        const cx = cur % W, cy = (cur / W) | 0;
        for (let i = 0; i < 4; i++){
          const nx = cx+DX[i], ny = cy+DY[i];
          if (nx<0||ny<0||nx>=W||ny>=H) continue;
          if (nx===tx && ny===ty) continue; // nunca pisa no destino
          if (isBlocked(nx, ny) || isBridgeMoveBlocked(cx,cy,nx,ny)) continue;
          // Evita tile dos bosses
          // Boss1 bloqueia pathfinding de bandidos mas não do boss2
          if (state.boss && state.boss.alive && nx===state.boss.x && ny===state.boss.y) continue;
          // Boss2 só bloqueia bandidos normais, não bloqueia o boss1 em fúria
          const nk = nx + ny * W;
          const nd = d + 1 + extraCost(nx, ny);
          if (nd < dist[nk]){
            dist[nk] = nd;
            parent[nk] = cur;
            if (nd < BUCKETS) buckets[nd].push(nk);
            // Chega adjacente ao destino?
            if (Math.abs(nx-tx)+Math.abs(ny-ty) === 1){ found = nk; break; }
          }
        }
        if (found !== -1) break;
      }
    }

    if (found === -1) return false;

    // Backtrack até o primeiro passo
    let cur = found;
    let safety = MAXN;
    while (parent[cur] !== start && parent[cur] !== -1 && safety-- > 0) cur = parent[cur];
    if (parent[cur] !== start) return false;

    entity.x = cur % W;
    entity.y = (cur / W) | 0;
    entity._stuckSteps = 0;
    return true;
  }

  // Retorna qualquer tile adjacente livre (fallback legado, mantido por compatibilidade)
  function bfsAnyOpenMove(sx, sy, tx, ty){
    const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
    let best = null, bestDist = Infinity;
    for (const d of dirs){
      const nx = sx + d.x, ny = sy + d.y;
      if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
      if (isBlocked(nx, ny) || isBridgeMoveBlocked(sx,sy,nx,ny)) continue;
      const dist = Math.abs(nx - tx) + Math.abs(ny - ty);
      if (dist < bestDist){ bestDist = dist; best = {x:nx, y:ny}; }
    }
    return best;
  }

  // Skins
  const SKINS = [
    // idx 0–11: originais
    {name:"Clássico",        body:"#3c6ca8", hat:"#4d2f0a", cost:0},
    {name:"Desbravador",     body:"#7a3c3c", hat:"#2b1b0a", cost:120},
    {name:"Noite Fria",      body:"#2f3a5f", hat:"#1a1a1a", cost:140},
    {name:"Pôr‑do‑Sol",      body:"#c85028", hat:"#5a2a0a", cost:160},
    {name:"Duna",            body:"#a67c52", hat:"#4d2f0a", cost:150},
    {name:"Cacique",         body:"#2f7d32", hat:"#52310c", cost:180},
    {name:"Cobalto",         body:"#224d9b", hat:"#0e2a52", cost:180},
    {name:"Carvoeiro",       body:"#333333", hat:"#111111", cost:200},
    {name:"Rosa do Deserto", body:"#e36db2", hat:"#8a2a5b", cost:190},
    null, // idx 9 removido
    {name:"Bandidão",        body:"#4a1f1f", hat:"#1e0c0c", cost:260},
    {name:"Espectral",       body:"#6b4bbd", hat:"#2a0d4a", cost:300},
    // idx 12+: novos
    {name:"Âmbar",           body:"#f0c060", hat:"#7a4a10", cost:210},
    {name:"Giz",             body:"#e8e8e8", hat:"#c0c0c0", cost:230},
    {name:"Musgo",           body:"#6b8c5a", hat:"#2a3a1a", cost:235},
    {name:"Marfim",          body:"#f0ead8", hat:"#b89a6a", cost:290},
    {name:"Fantasma",        body:"#f0f0f0", hat:"#111111", cost:320},
    {name:"Obsidiana",       body:"#1a1a2e", hat:"#0d0d18", cost:620},
    {name:"Guarda",          body:"#3a3a5a", hat:"#c02020", cost:370},
    {name:"Menta",           body:"#a8d8b8", hat:"#4a8a5a", cost:360},
    {name:"Lavanda",         body:"#c4aee8", hat:"#6a4a9a", cost:380},
    {name:"Pêssego",         body:"#f0b898", hat:"#a05830", cost:400},
    {name:"Vaqueiro Claro",  body:"#e8d8b8", hat:"#8b1a1a", cost:430},
    {name:"Céu Claro",       body:"#b0d4f0", hat:"#4878a8", cost:420},
    {name:"Quartzo",         body:"#ecc8d8", hat:"#a04870", cost:480},
    {name:"Duque",           body:"#d8d8f0", hat:"#404080", cost:445},
    {name:"Ferrugem",        body:"#c06040", hat:"#501808", cost:490},
    {name:"Pistola de Prata",body:"#c8c8d8", hat:"#484858", cost:520},
  ];

  function renderCosmetics(){
    const container = document.getElementById("shopGridCosm");
    if(!container) return; // aba cosméticos removida
    // sort cosmetics by cost ascending for display
    const order = SKINS.map((s,i)=>s?{i, c:s.cost||0}:null).filter(Boolean).sort((a,b)=>a.c-b.c).map(o=>o.i);
    order.forEach(idx => { const s = SKINS[idx];
      const div = document.createElement("div");
      div.className = "skin";
      div.innerHTML = `
        <div class="preview" data-skin="${idx}"></div>
        <div style="flex:1;">
          <h4 style="margin:0;">${s.name}</h4>
          <div class="cost"><strong class="cost-label">Custo</strong>: <span>${s.cost}</span> pts</div>
        </div>
        <button class="btn btn-orange" data-equip="${idx}">Comprar/Equipar</button>
      `;
      container.appendChild(div);
      const pv = div.querySelector(".preview");
      const c = document.createElement("canvas"); c.width=32; c.height=32;
      const pctx = c.getContext("2d");
      pctx.fillStyle = s.body; pctx.fillRect(8,8,16,16);
      pctx.fillStyle = s.hat; pctx.fillRect(6,6,20,6); pctx.fillRect(4,10,24,4);
      pv.appendChild(c);
    });

    container.addEventListener("click", (e)=>{
      const equip = e.target.closest("button[data-equip]");
      if (!equip) return;
      const idx = parseInt(equip.getAttribute("data-equip"),10);
      const skin = SKINS[idx];
      if (!skin) return;
      // Purchase if not yet unlocked
      if (!state.unlockedSkins.has(idx)){
        if (state.coop){
          // Determine points for the active player
          let pts = 0;
          if (state.activeShopPlayer === 1){ pts = (state.score1||0); if (pts < skin.cost) return; state.score1 = pts - skin.cost; }
          else if (state.activeShopPlayer === 2){ pts = (state.score2||0); if (pts < skin.cost) return; state.score2 = pts - skin.cost; }
        } else {
          if (state.score < skin.cost) return;
          state.score -= skin.cost;
        }
        state.unlockedSkins.add(idx);
        toastMsg(`Desbloqueou skin: ${skin.name}!`);
      }
      // Equip skin for the appropriate player
      if (state.coop){
        if (state.activeShopPlayer === 1){
          // Cowboy 1: aplica skin e atualiza currentSkin global também
          state.currentSkin1 = idx;
          state.currentSkin = idx;
        } else if (state.activeShopPlayer === 2){
          state.currentSkin2 = idx;
        }
      } else {
        state.currentSkin = idx;
      }
      toastMsg(`Equipou: ${skin.name}`);
      updateHUD();
    });
  }

  function toastMsg(t){
    let el = document.getElementById('_gameToastEl');
    if (!el){
      el = document.createElement('div');
      el.id = '_gameToastEl';
      el.style.cssText = [
        'position:fixed','left:50%','transform:translateX(-50%)',
        'bottom:36px','z-index:10000',
        'padding:9px 20px','border-radius:12px',
        'font-size:13px','font-weight:800',
        'pointer-events:none','letter-spacing:.03em',
        'white-space:nowrap','transition:opacity 0.3s ease','opacity:0'
      ].join(';');
      document.body.appendChild(el);
    }
    el.style.background  = 'rgba(70,28,4,0.96)';
    el.style.border      = '1px solid #e0a257';
    el.style.color       = '#f3c06a';
    el.style.boxShadow   = '0 4px 18px rgba(180,90,0,0.45)';
    el.textContent = t;
    clearTimeout(el._t1); clearTimeout(el._t2);
    el._t1 = setTimeout(()=>{ el.style.opacity = '1'; }, 10);
    el._t2 = setTimeout(()=>{ el.style.opacity = '0'; }, 2200);
  }

  
function showMenu(){ 
  const m = document.getElementById("menuScreen");
  /*__MENU_POINTER_UNLOCK__*/
  if (m && !m._unlockBound){
    m._unlockBound = true;
    m.addEventListener("pointerdown", ()=>{
      try{ const ac = getAudio(); if (ac.state === "suspended") ac.resume(); }catch(e){}
      try{ musicMenuStart(); }catch(e){}
    }, { once:true });
  }

  /*__MENU_AUDIO_UNLOCK__*/
  try{ const ac = getAudio(); if (ac.state === "suspended") { ac.resume(); } }catch(e){}

  if (!m) return;
  m.style.display = "flex"; m.setAttribute("aria-hidden","false");
  if (state){ state.inMenu = true; state.running = false; }
  try{ bossName.style.visibility="hidden"; bossName.style.opacity="0"; bossBar.style.visibility="hidden"; bossBarFill.style.width="0%"; }catch(_){}
  try{
    const _gbw2=document.getElementById('geminiBarsWrap');if(_gbw2)_gbw2.style.display='none';
    const _bmr2=document.getElementById('bossRowMain');if(_bmr2)_bmr2.style.display='flex';
    const _gr1=document.getElementById('geminiRow1');if(_gr1)_gr1.style.display='flex';
    const _gr2=document.getElementById('geminiRow2');if(_gr2)_gr2.style.display='flex';
  }catch(_){}
  forceMenuAutoplay();
  // keep controls details hidden when returning to the menu.  The user
  // requested that the controls button not be visible on any screens,
  // so we explicitly set it to "none" here.  The <details> element is
  // already hidden via inline style, but some code paths attempt to
  // restore it; override those attempts by forcing the display to none.
  try{
    const ctrl = document.getElementById("controlsDetails");
    if (ctrl) ctrl.style.display = "none";
  }catch(e){}

  // Do not show the zoom/lupa button while in any menu. It will be restored by showGameLayer()
  try{
    const zw = document.getElementById("zoomWrap");
    if (zw) zw.style.display = "none";
  }catch(_){}
}
function hideMenu(){ 
  const m = document.getElementById("menuScreen");
  if (!m) return;
  m.style.display = "none"; m.setAttribute("aria-hidden","true");
}
function startGame(){
  // Always reset the game state when starting a new single‑player game.
  // This clears any leftover coop flags or variables and ensures a clean start.
  resetGame();
  try{ if (window.releaseCoopInputModeLock) window.releaseCoopInputModeLock(); }catch(_){}
  state.inMenu = false; state.running = true; state.pausedManual = false; state.pausedShop = false;
  musicStop(); musicStart();
  hideMenu();
  // fecha qualquer overlay remanescente
  try{ closeConfirmReset(); }catch(e){}
  // abre o prompt com leve atraso pra garantir camada
  setTimeout(()=>{ try{ openDialogPrompt(); }catch(e){} }, 60);
  // Toast da onda 1 aparece após o menu sumir
  setTimeout(()=>{ try{ toastMsg('Onda 1!'); }catch(e){}; }, 120);

  // Keep controls details hidden in single‑player as well.  The
  // controls button should not appear during gameplay, so force
  // the element to remain hidden instead of restoring it here.
  try{
    const ctrl = document.getElementById("controlsDetails");
    if (ctrl) ctrl.style.display = "none";
  }catch(e){}

  // Show zoom/lupa interface in single-player. It may have been hidden
  // during coop. Restoring it here ensures the player can zoom normally.
  try{
    const zw = document.getElementById("zoomWrap");
    if (zw){
      zw.style.display = "";
      zw.style.visibility = "visible";
      zw.style.opacity = "1";
    }
  }catch(_){}
}

function resetGame(){

    // Evita música duplicada em reset
  try{ musicStop(); }catch(e){}
    const accountBootstrap = loadStoredAccountSnapshot();
const map = makeMap();
    const gold = {
      x: Math.floor(GRID_W/2),
      y: Math.floor(GRID_H/2),
      hp: 100, max: 100
    };
    map[gold.y][gold.x] = 3; // ouro colide
    // Garante que o mapa é totalmente conectado — sem bolsões isolados
    ensureMapConnected(map, gold.x, gold.y);

    const player = {
      x: gold.x, y: gold.y+2,
      face: DIRS.up,
      moveLock:false,
      moveLockMs: 220,
      nextMoveAt: 0,
      hp: 100, max: 100
    };

    state = {
      seen: { bandit:false, assassin:false, vandal:false, fantasma:false, bosses:{} },
      nextBanditId: 1,
      aimLevel: 0,
      target: null,
      rollLevel: 0,
      lastRollAt: -9999,
      rollCooldownMs: 2000,
      rollFlash: 0,
      rollAnimT: 0,
      dynaLocks: {},
      forceBossName:null,
      keysHeld:{up:false,down:false,left:false,right:false,shoot:false},
      _pendingAllyDialog:false,
      _pendingDogDialog:false,
      xerifeLevel: 0,
      _pendingXerifeDialog: false,
      _pendingXerifeDialogAfterShop: false,
      dinamiteiroLevel: 0,
      reparadorLevel: 0,
      reparadorInstantUnlocked: false,
      dinamiteiroBombs: [],
      explosiveAoeFlashes: [],
      _pendingDinamiteiroDialog: false,
      _pendingDinamiteiroDialogAfterShop: false,
      _pendingReparadorDialog: false,
      _pendingReparadorDialogAfterShop: false,
      _ropeProjectiles: [],
      _revealDogAfterDialog:false,
      allyPriorityMode: 'bandits', // 'bandits' | 'vandals'
      t: 0,
      goldWarnT: 0,
      playerWarnT: 0,
      // Multi-kill state
      multiKill: {count:0, lastAt:0, baseSum:0, sx:0, sy:0, windowMs:220},
      multiPopups: [],
      map, gold, player,
      fx: [],
      bullets: [],
      allies: [],
      bandits: [],
      banditTileCounts: new Map(),
      tumbleweeds: [],
      // Array of falling snow particles. Only populated on the tundra map.
      snowflakes: [],
      fireflies: [],
      fogClouds: [],
      swampBubbles: [],
      swampLakes: null,
      // Footprints left by entities on snow/tundra map.
      footprints: [],
      score: 0,
      totalScore: 0,
      timeScoreTimer: 0,
      lastShotAt: -9999,
      shotCooldownMs: 750,                 // base 750ms
      bulletSpeed: Math.round(11 * TILE),  // bala um pouco mais rápida que v4
      bulletSpdLevel: 0,
      bulletPierce: 0,
      bulletBounce: 0,
      ammoBuffer: 1,
      bufferedShots: 0,
      spawnTimer: 0,
      spawnEveryMs: 1500,                  // frequência de spawn
      baseSpawnEveryMs: 1500,
      banditStepMs: 1120,                  // **metade da velocidade** (dobrei o intervalo)
      
      baseBanditStepMs: 1120,lastBanditStep: 0,
      baseDamage: 5,                        // dano base fixo
      running: true,
      pausedShop: false,
      pausedManual: false,
      lastTime: performance.now(),
      wave: 1,
      enemiesToSpawn: 0,
      enemiesAlive: 0,
      betweenWaves: false,
      waveCool: 800,
      boss: null, boss2: null, _gemeosSplit: false, _gemeosSplitT: 0,
      music: null,
      unlockedSkins: (function(){ var skins = new Set([0]); try{ (accountBootstrap.skins || [0]).forEach(function(i){ skins.add(i); }); }catch(_){} return skins; })(),
      currentSkin: (accountBootstrap.equippedSkin != null ? accountBootstrap.equippedSkin : 0),
      equippedAura: (accountBootstrap.equippedAura != null ? accountBootstrap.equippedAura : -1),
      equippedShot: (accountBootstrap.equippedShot != null ? accountBootstrap.equippedShot : -1),
      equippedGold: (accountBootstrap.equippedGold != null ? accountBootstrap.equippedGold : -1),
      equippedKill: (accountBootstrap.equippedKill != null && accountBootstrap.equippedKill !== -1 ? accountBootstrap.equippedKill : 0),
      equippedName: (accountBootstrap.equippedName != null ? accountBootstrap.equippedName : 0),
      allyFireMs: 900, // base cadência do aliado
      allyLevel: 0, // número de upgrades do parceiro (máx 7)
      partnerIrVision: false, // compra única: parceiro enxerga fantasmas/assassinos
      balaTranslucida: false,
      shakeT: 0,
      shakeMag: 0,
      multiFlashT: 0, multiFlashColor: '#f3d23b', multiFlashAlpha: 0.2,
      secondChanceFlashT: 0,
      goldInvulT: 0,
      placingSentry: false,
      movingSentry: null,   // torre sendo reposicionada
      sentryHoverX: -1, sentryHoverY: -1,
      selectedSentry: null,
      placingClearPath: false,
      placingGoldMine: false,
      movingGoldMine: null,
      goldMineHoverX: -1, goldMineHoverY: -1,
      goldMines: [],
      barricadas: [],
      placingBarricada: false,
      movingBarricada: null,
      barricadaHoverX: -1, barricadaHoverY: -1,
      selectedBarricada: null,
      espantalhos: [], placingEspantalho: false, movingEspantalho: null,
      espantalhoHoverX: -1, espantalhoHoverY: -1, selectedEspantalho: null,
      pichaPocos: [], placingPichaPoco: false, movingPichaPoco: null, pichaPocoHoverX: -1, pichaPocoHoverY: -1, selectedPichaPoco: null,
      // Portais: par único {blue:{x,y,dir}, orange:{x,y,dir}} ou null
      portals: null,
      placingPortalBlue: false,
      placingPortalOrange: false,
      portalHoverX: -1, portalHoverY: -1,
      selectedPortal: null,
      saraivadaLevel: 0,
      lastSaraivadaAt: -99999,
      saraivadaFlashT: 0,
      saraivadaSpinT: 0,   // duração da animação de spin do ponteiro
      goldFlashT: 0, playerFlashT: 0, playerInvulT: 0, assassinLastStep: 0, assassinStepMs: 0,
      explosiveLevel: 0,  // Tiro Explosivo
      sentries: [], sentryFireMs: [SENTRY_FIRE_BASE_MS,SENTRY_FIRE_BASE_MS,SENTRY_FIRE_BASE_MS,SENTRY_FIRE_BASE_MS], sentryRange: 4,
      dynaLevel: -1, // -1 = não comprado; 0..4 nível (intervalos 30..10)
      dynamites: [], // elementos {x,y, armed:true/false, nextAt:ms}
      dynaCooldownMs: 30000,
      coop: false,
      secondChance: false,
      selectedGold: false,
      selectedAlly: null,
      selectedReparador: false
    };
    // Tag this state with the chosen map and mode so that the background
    // builder and other systems can adapt appropriately. These values
    // originate from the menu selection. currentMapId and currentMode are
    // globals updated by the selection UI.
    state.mapId = window.currentMapId || 'desert';
    state.mode = window.currentMode || 'infinite';
    // Store a persistent reference to the primary player so coop collision checks
    // can distinguish between player 1 and player 2 even when state.player is
    // temporarily swapped (e.g. during player 2 movement calls). This alias
    // remains stable across resets.  It is important for preventing the
    // cowboys from walking through each other when coop is active.
    state.player1 = player;
    renderCosmetics();
    updateHUD();
    resetShopUI();
    buildBackground();
    // dinamites reset
    state.dynaLevel = -1; state.dynamites = []; state.dynaCooldownMs = 30000;
    state.barricadas = []; state.selectedBarricada = null; state.placingBarricada = false; state.movingBarricada = null;
    state.pichaPocos = []; state.selectedPichaPoco = null; state.placingPichaPoco = false; state.movingPichaPoco = null; state.pichaPocoHoverX = -1; state.pichaPocoHoverY = -1;
    state.portals = null; state.placingPortalBlue = false; state.placingPortalOrange = false; state.portalHoverX = -1; state.portalHoverY = -1; state.selectedPortal = null;
    startWave(true);
  }

  // === Coop mode helpers ===
  function resetGameCoop(){
    // initialize standard game then augment with coop-specific state
    resetGame();
    state.coop = true;
    // Second player spawn: aligned with gold. Player 1 nasce 2 tiles abaixo (via resetGame),
    // o Jogador 2 nasce 2 tiles acima. Garante que ambos fiquem alinhados em x.
    const gx = state.gold.x;
    const gy = state.gold.y;
    state.player2 = {
      x: gx,
      y: (gy - 2 >= 0 ? gy - 2 : gy + 2),
      face: DIRS.up,
      moveLock:false,
      moveLockMs: 220,
      nextMoveAt: 0,
      hp: 100, max: 100
    };
    state.keysHeld2 = {up:false,down:false,left:false,right:false,shoot:false};
    // Initialize individual stats for player2
    state.shotCooldownMs2 = state.shotCooldownMs;
    state.bulletSpeed2 = state.bulletSpeed;
    state.bulletPierce2 = state.bulletPierce;
    state.bulletBounce2 = state.bulletBounce;
    state.rollLevel2 = 0;
    state.rollCooldownMs2 = state.rollCooldownMs;
    state.lastRollAt2 = -9999;
    // individual score tracking for each player
    state.score1 = 0;
    state.score2 = 0;
    state.totalScore1 = 0;
    state.totalScore2 = 0;
    // which player currently has the shop open (1 or 2)
    state.activeShopPlayer = 1;
    // last shot timestamp for player2
    state.lastShotAt2 = -9999;
    // track death states for revival and game over
    state.dead1 = false;
    state.dead2 = false;
    state.reviveTimer1 = 0;
    state.reviveTimer2 = 0;
    // assign individual skin indices: player1 uses the single‑player skin,
    // player2 defaults to the "ally" palette (represented by -1).  A value <0
    // signals custom colors for the partner rather than a cosmetics entry.
    state.currentSkin1 = (typeof state.currentSkin !== "undefined" ? state.currentSkin : 0);
    state.currentSkin2 = -1;
    // update HUD for coop
    updateHUD();

    // initialise separate roll costs for each player (base 900) so the price scales
    // independently. Without this the cost would rise in both shops when only one
    // cowboy purchases the upgrade. These values are used in refreshShopVisibility
    // and openShop to display the correct cost to the active buyer.
    state.rollCost1 = 800;
    state.rollCost2 = 800;

    // ensure the persistent alias for player 1 remains correct after resetting
    state.player1 = state.player;
  }

  function startCoopGame(){
    // hide menu and start coop
    state.inMenu = false;
    state.running = true;
    resetGameCoop();
    musicStop(); musicStart();
    hideMenu();
    // Hide the controls detail element when coop starts
    try{
      const ctrl = document.getElementById("controlsDetails");
      if (ctrl) ctrl.style.display = "none";
    }catch(e){}
    // Hide the zoom button/lens interface in coop to avoid glitches
    try{
      const zw = document.getElementById("zoomWrap");
      if (zw) zw.style.display = "none";
    }catch(_){}
    try{ if (window.applyCoopInputModeLock) window.applyCoopInputModeLock(); }catch(_){}
    // Intro dialog: apenas Cowboy 1 fala, explicando que ele e o parceiro
    // encontraram o ouro e precisam defendê‑lo. Ao usar um único palestrante
    // garantimos que apenas seu retrato aparece. Variantes adicionais não
    // são necessárias aqui, por isso fornecemos uma pequena sequência.
    const lines = [
      { name: "Cowboy 1", text: "Ei, encontramos esse ouro no deserto!" },
      { name: "Cowboy 1", text: "Eu e meu parceiro vamos defendê‑lo a qualquer custo." },
      { name: "Cowboy 1", text: "Fique de olho e mantenha o dedo no gatilho!" }
    ];
    startDialog(lines, { portrait: "coop" });
  }

  function addScore(src, amount){
    if (!amount) return;
    if (state.coop){
      if (src === 'player'){
        state.score1 = (state.score1||0) + amount;
        state.totalScore1 = (state.totalScore1||0) + amount;
      } else if (src === 'player2'){
        state.score2 = (state.score2||0) + amount;
        state.totalScore2 = (state.totalScore2||0) + amount;
      } else {
        // neutral kills (sentries, dynamites, ally) split evenly
        const half = Math.floor(amount/2);
        state.score1 = (state.score1||0) + half;
        state.score2 = (state.score2||0) + (amount - half);
        state.totalScore1 = (state.totalScore1||0) + half;
        state.totalScore2 = (state.totalScore2||0) + (amount - half);
      }
    } else {
      state.score += amount;
      state.totalScore = (state.totalScore||0) + amount;
    }
    updateHUD();
  }

  function tryMove2(key){
    if (!state.coop || !state.player2) return;
    // Prevent movement when player2 is down
    if (state.player2.hp <= 0) return;
    const origPlayer = state.player;
    const origKeys = state.keysHeld;
    state.player = state.player2;
    state.keysHeld = state.keysHeld2;
    // Map arrow keys to WASD letters expected by tryMove()
    let mk = null;
    if (key === "ArrowUp") mk = "w";
    else if (key === "ArrowDown") mk = "s";
    else if (key === "ArrowLeft") mk = "a";
    else if (key === "ArrowRight") mk = "d";
    else mk = key;
    tryMove(mk);
    state.player = origPlayer;
    state.keysHeld = origKeys;
  }

  function tryShoot2(){
    if (!state.coop || !state.player2) return;
    // Prevent shooting when player2 is down
    if (state.player2.hp <= 0) return;
    const origPlayer = state.player;
    const origLast = state.lastShotAt;
    const bulletsBefore = state.bullets.length;
    state.player = state.player2;
    // Use player2's own last shot timestamp
    state.lastShotAt = (state.lastShotAt2||-9999);
    // Override bullet stats and cooldown for player2
    const origCd   = state.shotCooldownMs;
    const origSpd  = state.bulletSpeed;
    const origPr   = state.bulletPierce;
    const origBnc  = state.bulletBounce;
    state.shotCooldownMs = (typeof state.shotCooldownMs2 === 'number') ? state.shotCooldownMs2 : state.shotCooldownMs;
    state.bulletSpeed   = (typeof state.bulletSpeed2 === 'number') ? state.bulletSpeed2 : state.bulletSpeed;
    state.bulletPierce  = (typeof state.bulletPierce2 === 'number') ? state.bulletPierce2 : state.bulletPierce;
    state.bulletBounce  = (typeof state.bulletBounce2 === 'number') ? state.bulletBounce2 : state.bulletBounce;
    tryShoot();
    // Capture updated timestamp and restore stats
    state.lastShotAt2 = state.lastShotAt;
    state.shotCooldownMs = origCd;
    state.bulletSpeed   = origSpd;
    state.bulletPierce  = origPr;
    state.bulletBounce  = origBnc;
    state.lastShotAt = origLast;
    state.player = origPlayer;
    // mark bullets created by player2
    for (let i=bulletsBefore; i<state.bullets.length; i++){
      const bb = state.bullets[i];
      if (bb && bb.src === 'player'){
        bb.src = 'player2';
      }
    }
  }

// === Additional coop helper functions ===
// Rolling for player2 using player-specific variables and keysHeld2
function tryRoll2(){
  if (!state || !state.coop || !state.player2) return;
  // Prevent rolling when player2 is down
  if (state.player2.hp <= 0) return;
  if (!state.rollLevel2 || state.rollLevel2 <= 0) return;
  const origPlayer = state.player;
  const origRollLevel = state.rollLevel;
  const origRollCooldown = state.rollCooldownMs;
  const origLastRoll = state.lastRollAt;
  const origKeys = state.keysHeld;
  state.player = state.player2;
  state.rollLevel = state.rollLevel2;
  state.rollCooldownMs = state.rollCooldownMs2 || 2000;
  state.lastRollAt = state.lastRollAt2 || -9999;
  state.keysHeld = state.keysHeld2;
  tryRoll();
  state.lastRollAt2 = state.lastRollAt;
  state.player = origPlayer;
  state.rollLevel = origRollLevel;
  state.rollCooldownMs = origRollCooldown;
  state.lastRollAt = origLastRoll;
  state.keysHeld = origKeys;
}

// Dynamic portrait functions for coop dialogues
function drawCowboy1Portrait(){
  const prev = state.currentSkin;
  state.currentSkin = state.currentSkin1;
  try{
    drawCowboyPortrait();
  }finally{
    state.currentSkin = prev;
  }
}

function drawCowboy2Portrait(){
  const prev = state.currentSkin;
  if (state.currentSkin2 < 0){
    drawAllyPortrait();
  } else {
    state.currentSkin = state.currentSkin2;
    drawCowboyPortrait();
  }
  state.currentSkin = prev;
}

  // Revival mechanic: called each frame in loop()
  function handleRevive(dt){
    if (!state.coop) return;
    // If both players dead, end game
    const dead1 = state.player.hp <= 0;
    const dead2 = state.player2 && state.player2.hp <= 0;
    if (dead1 && dead2){
      // Both cowboys have fallen: game over
      state.running = false;
      state.gameOverReason = "both";
      musicStop();
      try{ window._expSystem&&window._expSystem.onGameOver(state,'both'); }catch(_){}
      return;
    }
    // Player1 dead: allow player2 to revive
    if (dead1 && !dead2){
      const dx = Math.abs(state.player2.x - state.player.x);
      const dy = Math.abs(state.player2.y - state.player.y);
      const near = (dx + dy) <= 1;
      if (near && state.keysHeld2 && state.keysHeld2.shoot){
        state.reviveTimer1 = (state.reviveTimer1||0) + dt;
        // play periodic beep while reviving
        state.revBeep1Counter = (state.revBeep1Counter||0) + dt;
        if (state.revBeep1Counter >= 0.5){
          try { beep(180, 0.03, "square", 0.02); } catch(_){}
          state.revBeep1Counter -= 0.5;
        }
        if (state.reviveTimer1 >= 6.0){
          // revive player1
          state.player.hp = state.player.max;
          state.dead1 = false;
          state.reviveTimer1 = 0;
          state.revBeep1Counter = 0;
          // celebratory popup and sound
          try{ pushMultiPopup("REVIVIDO!", "#f3d23b", state.player.x*TILE + TILE/2, state.player.y*TILE + 8); }catch(_){}
          try{ noise(0.05, 0.05); beep(260, 0.06, "sawtooth", 0.03); }catch(_){}
        }
      } else {
        // stopped reviving
        state.reviveTimer1 = 0;
        state.revBeep1Counter = 0;
      }
    }
    // Player2 dead: allow player1 to revive
    if (dead2 && !dead1){
      const dx2 = Math.abs(state.player.x - state.player2.x);
      const dy2 = Math.abs(state.player.y - state.player2.y);
      const near2 = (dx2 + dy2) <= 1;
      if (near2 && state.keysHeld && state.keysHeld.shoot){
        state.reviveTimer2 = (state.reviveTimer2||0) + dt;
        state.revBeep2Counter = (state.revBeep2Counter||0) + dt;
        if (state.revBeep2Counter >= 0.5){
          try { beep(180, 0.03, "square", 0.02); } catch(_){}
          state.revBeep2Counter -= 0.5;
        }
        if (state.reviveTimer2 >= 6.0){
          state.player2.hp = state.player2.max;
          state.dead2 = false;
          state.reviveTimer2 = 0;
          state.revBeep2Counter = 0;
          try{ pushMultiPopup("REVIVIDO!", "#f3d23b", state.player2.x*TILE + TILE/2, state.player2.y*TILE + 8); }catch(_){}
          try{ noise(0.05, 0.05); beep(260, 0.06, "sawtooth", 0.03); }catch(_){}
        }
      } else {
        state.reviveTimer2 = 0;
        state.revBeep2Counter = 0;
      }
    }
  }

  // Bosses a cada 10 ondas (permanece)
  const BOSSES = [
    {name:"O Pregador", maxhp: 350, speedMul:0.85, dmgMul:1.6, color:"#e8e0d0"},
    {name:"Os Gêmeos",  maxhp: 220, speedMul:3.74, dmgMul:1.5, color:"#9b2b6b"},
    {name:"Pistoleiro Fantasma", maxhp: 300, speedMul:0.92, dmgMul:1.25, color:"#5ee8e8"}
  ];
  function isBossWave(w){ return w % 10 === 0; }

  
  function dynaIntervalsMs(){
    // level: 0..4 -> 30,25,20,15,10
    return [30000,25000,20000,15000,10000];
  }


  const DYNA_DISARM_MS = 2000; // 20% mais rápido (era 2500ms)

  function dynaKey(x,y){ return x + "," + y; }

  function cleanupDynaLocks(){
    if (!state.dynaLocks) state.dynaLocks = {};
    for (const k in state.dynaLocks){
      const lock = state.dynaLocks[k];
      if (!lock) { delete state.dynaLocks[k]; continue; }
      const b = state.bandits && state.bandits.find(bb => bb && bb.alive && bb.id === lock.id);
      if (!b || !b.disarming){ delete state.dynaLocks[k]; continue; }
      const tx = (typeof b.disarming.x === "number") ? b.disarming.x : null;
      const ty = (typeof b.disarming.y === "number") ? b.disarming.y : null;
      if (tx === null || ty === null){ delete state.dynaLocks[k]; continue; }
      const want = dynaKey(tx,ty);
      if (want !== k){ delete state.dynaLocks[k]; continue; }
    }
  }

  function isDynaLocked(x,y, requesterId){
    if (!state.dynaLocks) state.dynaLocks = {};
    const k = dynaKey(x,y);
    const lock = state.dynaLocks[k];
    if (!lock) return false;
    if (lock.id === requesterId) return false;
    // lock pode ficar "podre" (vândalo morreu / parou) -> limpa
    const b = state.bandits && state.bandits.find(bb => bb && bb.alive && bb.id === lock.id);
    if (!b || !b.disarming){ delete state.dynaLocks[k]; return false; }
    const tx = (typeof b.disarming.x === "number") ? b.disarming.x : null;
    const ty = (typeof b.disarming.y === "number") ? b.disarming.y : null;
    if (tx !== x || ty !== y){ delete state.dynaLocks[k]; return false; }
    return true;
  }

  function tryLockDyna(x,y, id){
    cleanupDynaLocks();
    if (isDynaLocked(x,y, id)) return false;
    state.dynaLocks[dynaKey(x,y)] = { id, at: performance.now() };
    return true;
  }

  function unlockDynaBy(id){
    if (!state.dynaLocks) return;
    for (const k in state.dynaLocks){
      if (state.dynaLocks[k] && state.dynaLocks[k].id === id) delete state.dynaLocks[k];
    }
  }

  function sfxDynaRearm(){
    // "clic" elétrico de rearmar
    noise(0.028, 0.018);
    beep(720, 0.03, "sine", 0.020);
    beep(980, 0.02, "square", 0.012);
  }

  function armDynamitesImmediate(){
    state.dynamites = [];
    const tiles = goldAdjacentTiles();
    for (const t of tiles){
      state.dynamites.push({x:t.x, y:t.y, armed:true, nextAt: 0});
    }
  }

  function updateDynamites(now){
    if (state.dynaLevel < 0) return;
    const cooldown = dynaIntervalsMs()[Math.max(0, Math.min(state.dynaLevel, 4))];
    let rearmed = false;
    for (const d of state.dynamites){
      if (!d.armed && now >= d.nextAt){
        d.armed = true;
        rearmed = true;
      }
    }
    state.dynaCooldownMs = cooldown;
    if (rearmed) sfxDynaRearm();
  }


  function enemiesForWave(w){return 5+2*(w-1);}
  function spawnBatchSize(w){
    if(w<=5)  return 1;
    if(w<=10) return 2;
    if(w<=20) return 3;
    if(w<=35) return 4;
    if(w<=60) return 5;
    if(w<=90) return 7;
    if(w<=130)return 10;
    if(w<=180)return 14;
    return Math.min(25, 14 + Math.floor((w-180)/15));
  }

  function startWave(silent){
    state.boss = null;
    const w = state.wave;
    // Acelera bandidos um pouco por onda, até 3x a velocidade base
    const speedFactor = Math.min(4, 1 + 0.10 * (w - 1));
    state.banditStepMs = Math.max( Math.round(state.baseBanditStepMs / speedFactor), 120 );
    state.assassinStepMs = state.banditStepMs;
    // Diminuir intervalo de spawn por onda
    const spawnFactor = 1 + 0.05 * (w - 1);
    const spawnMinMs = w <= 40 ? 500 : Math.max(180, Math.round(500 - (w - 40) * 4));
    state.spawnEveryMs = Math.max(spawnMinMs, Math.round(state.baseSpawnEveryMs / spawnFactor));
    state.baseDamage = 5; // dano fixo
    state.enemiesToSpawn = isBossWave(w) ? 0 : enemiesForWave(w);
    // Assassinos: chance por spawn (10% a partir da Onda 12)
    state.assassinChance = (state.wave >= 12) ? 0.10 : 0;
    
    // Vândalos: chance por spawn (a partir da Onda 24)
    state.vandalChance = (state.wave >= 24) ? 0.18 : 0;
    // Fantasmas: chance por spawn (a partir da Onda 72)
    state.ghostChance = (state.wave >= 72) ? 0.025 : 0;
state.betweenWaves = false;
    resetBossBarUi();
    if (!silent){
      toastMsg(`Onda ${w}!`);
      beep(660,0.08,"square",0.04);
      beep(880,0.08,"square",0.04);
    }
    try{refreshShopVisibility();if(window._renderShopPage)window._renderShopPage();}catch(e){}

    if (w === 4){
      if (state && state.coop){
        // Wave 4 dialogues: apenas Cowboy 2 fala (5 variações). Isso evita a troca
        // de retratos e deixa claro que o parceiro está comentando a batalha.
        const coopVariants4 = [
          [
            {name:"Cowboy 2", text:"Já tamo pegando o jeito dessa defesa, hein?"},
            {name:"Cowboy 2", text:"Só não deixa a munição acabar!"}
          ],
          [
            {name:"Cowboy 2", text:"Tão vindo mais e mais."},
            {name:"Cowboy 2", text:"Melhor pra nossa pontuação! Aperta o Enter e faz música."}
          ],
          [
            {name:"Cowboy 2", text:"Isso ainda é aquecimento?"},
            {name:"Cowboy 2", text:"Se for, tô curtindo a festa."}
          ],
          [
            {name:"Cowboy 2", text:"Nossa dupla tá entrosada."},
            {name:"Cowboy 2", text:"Tipo dupla sertaneja: um canta, outro atira."}
          ],
          [
            {name:"Cowboy 2", text:"O gatilho já esquentou!"},
            {name:"Cowboy 2", text:"Mas minha mira tá fria não."},
            {name:"Cowboy 2", text:"Então bora, sem poeira parar!"}
          ]
        ];
        const pick = Math.floor(Math.random()*coopVariants4.length);
        startDialog(coopVariants4[pick], {portrait:'coop'});
      } else {
        const variants4 = [
        [
          {name:"Cowboy", text:"Olha só… já estamos pegando o jeito!"},
          {name:"Cowboy", text:"Continua assim que nem poeira fica em pé."},
          {name:"Cowboy", text:"Se errar, erra atirando!"}
        ],
        [
          {name:"Cowboy", text:"Rodada 4 e o gatilho já tá afiado."},
          {name:"Cowboy", text:"Mão firme, mira esperta. Bora!"}
        ],
        [
          {name:"Cowboy", text:"Tão vindo mais? Bom, melhor pra pontuação."},
          {name:"Cowboy", text:"Aperta o espaço e deixa o resto comigo!"}
        ],
        [
          {name:"Cowboy", text:"É isso aí, parceiro: ritmo de trem descendo ladeira."},
          {name:"Cowboy", text:"Sem pressa, sem pausa… e sem bandido."}
        ],
        [
          {name:"Cowboy", text:"Eu chamo isso de aquecimento ainda."},
          {name:"Cowboy", text:"Mas aquecimento que dá ponto é meu favorito!"}
        ],
        [
          {name:"Cowboy", text:"Cada rodada uma história… e nessa a moral é: continua atirando."},
          {name:"Cowboy", text:"Bandido não gosta de plot twist de chumbo."}
        ],
        [
          {name:"Cowboy", text:"Estamos sincronizados que nem dupla sertaneja."},
          {name:"Cowboy", text:"Eu canto e você atira… ou o contrário."}
        ],
        [
          {name:"Cowboy", text:"Mantém o compasso: passo, tiro, passo, tiro."},
          {name:"Cowboy", text:"Se vier em linha, vira melodia de assobio."}
        ],
        [
          {name:"Cowboy", text:"Se continuar desse jeito, até o ouro fica relaxado."},
          {name:"Cowboy", text:"Quer dizer… relaxado não, guardado."}
        ],
        [
          {name:"Cowboy", text:"Bom sinal quando a bota suja de poeira, não de medo."},
          {name:"Cowboy", text:"Vamo nessa que hoje eu tô confiante!"}
        ]
      ];
      const p4 = Math.floor(Math.random()*variants4.length);
      startDialog(variants4[p4]);
      }
    }

    if (w === 12){
      if (state && state.coop){
        // Wave 12 dialogues: apenas Cowboy 1 fala (5 variações). Ele explica
        // sobre os assassinos que ignoram o ouro e atacam diretamente os cowboys.
        const coopVariants12 = [
          [
            {name:"Cowboy 1", text:"Viu aqueles de bandana roxa correndo?"},
            {name:"Cowboy 1", text:"São assassinos, vêm direto na gente."},
            {name:"Cowboy 1", text:"Dois tiros neles, mas se eles me pegarem, adeus."},
            {name:"Cowboy 1", text:"Olho na barra de vida!"}
          ],
          [
            {name:"Cowboy 1", text:"Previsão do tempo: chuva de assassino."},
            {name:"Cowboy 1", text:"Tão de olho em nós, não no ouro."},
            {name:"Cowboy 1", text:"Se zerar minha barra ou a sua, já era."},
            {name:"Cowboy 1", text:"Mira firme e não deixa chegar perto."}
          ],
          [
            {name:"Cowboy 1", text:"Agora a coisa ficou séria."},
            {name:"Cowboy 1", text:"Esses de preto são assassinos; dois tiros e vão pro chão."},
            {name:"Cowboy 1", text:"Se encostarem em mim, me derrubam sem dó."},
            {name:"Cowboy 1", text:"Então me ajuda a cobrir os flancos."}
          ],
          [
            {name:"Cowboy 1", text:"Bandido novo na área: assassino."},
            {name:"Cowboy 1", text:"Eles ignoram o ouro e vêm na nossa jugular."},
            {name:"Cowboy 1", text:"A partir de agora, se um de nós cair, acabou."},
            {name:"Cowboy 1", text:"Fica de olho nessa barra e atira rápido."}
          ],
          [
            {name:"Cowboy 1", text:"Ei, esses aí tão mirando no peito!"},
            {name:"Cowboy 1", text:"Chegaram os assassinos. Correm que nem loucos."},
            {name:"Cowboy 1", text:"Dois tiros e caem, mas um de nós cair também acaba tudo."},
            {name:"Cowboy 1", text:"Então cuida da sua barra, parceiro!"}
          ]
        ];
        const pick12 = Math.floor(Math.random()*coopVariants12.length);
        startDialog(coopVariants12[pick12], {portrait:'coop'});
      } else {
        const variants = [
        [
          {name:"Cowboy", text:"Opa… não gostei daqueles ali."},
          {name:"Cowboy", text:"Andar apressado, bandana roxa… é, deu ruim."},
          {name:"Cowboy", text:"Esses vêm em mim, e não no ouro. Mal educados."},
          {name:"Cowboy", text:"Se eu morrer, acabou. Fica de olho na barrinha azul."}
        ],
        [
          {name:"Cowboy", text:"Proteger o ouro, né?"},
          {name:"Cowboy", text:"Bom... agora é ouro e Cowboy."},
          {name:"Cowboy", text:"Tem uns desgraçados chegando aí só pra me acertar."},
          {name:"Cowboy", text:"Barra azul ativada, parceiro. Dois tiros neles, ou sou eu que vai de base."}
        ],
        [
          {name:"Cowboy", text:"Hm… tem uns cabras de preto espreitando lá longe."},
          {name:"Cowboy", text:"Não tão nem de olho no ouro… tão me olhando que nem urubu em cima de carniça."},
          {name:"Cowboy", text:"Devem ser os tais assassinos. Correm mais, batem mais, e só caem com dois tiros."},
          {name:"Cowboy", text:"A partir de agora, se minha barra azul zerar... é chão pra mim também."}
        ],
        [
          {name:"Cowboy", text:"Ei, parceiro... novidade ruim chegando lá do horizonte."},
          {name:"Cowboy", text:"Umas figuras apressadas e de roupa escura. Se tão vindo daquele jeito... é pra matar."},
          {name:"Cowboy", text:"Deixa o rifle pronto que agora precisa de dois tiros. E nada de deixar me encostar."}
        ],
        [
          {name:"Cowboy", text:"Avisa a funerária: tão vindo uns cabras querendo me pôr no chão."},
          {name:"Cowboy", text:"Correm feito alma penada e só morrem com dois tiros."},
          {name:"Cowboy", text:"Mas eu sou teimoso. Só caio se secar essa barra azul aí em cima."}
        ],
        [
          {name:"Cowboy", text:"A próxima onda vem com ingrediente especial: tentativa de homicídio."},
          {name:"Cowboy", text:"Assassino não quer tesouro. Quer eu mesmo, inteirinho."},
          {name:"Cowboy", text:"Se prepara: agora é proteger o ouro e o cowboy."}
        ],
        [
          {name:"Cowboy", text:"Previsão do tempo: céu limpo com 10% de chance de latrocínio."},
          {name:"Cowboy", text:"Tô vendo uns caras de preto correndo no horizonte…"},
          {name:"Cowboy", text:"Não tão vindo atrás do ouro. Tão vindo atrás de MIM."},
          {name:"Cowboy", text:"A partir de agora, barra azul no topo. Se ela zera... adeus, cowboy."}
        ],
        [
          {name:"Cowboy", text:"Tem um tipo novo de bandido vindo aí..."},
          {name:"Cowboy", text:"Preto, bandana roxa, cara de poucos amigos."},
          {name:"Cowboy", text:"Só caem com dois tiros. E vêm direto em mim, não no ouro."}
        ],
        [
          {name:"Cowboy", text:"É impressão minha ou tem uns cabras com sede de sangue vindo aí?"},
          {name:"Cowboy", text:"Parece que agora eu sou o alvo."},
          {name:"Cowboy", text:"Dois tiros pra tombar cada um. Tenta não errar."},
          {name:"Cowboy", text:"E vê aquela barrinha azul ali? Quando ela zera, adeus."}
        ]
];
      const pick = Math.floor(Math.random()*variants.length);
      startDialog(variants[pick]);
      }
    }
    if (w === 24){
      if (state && state.coop){
        // Wave 24 dialogues: apenas Cowboy 2 fala (5 variações). Aqui ele adverte
        // sobre os vândalos, que ignoram o ouro para atacar torres e dinamites.
        const coopVariants24 = [
          [
            {name:"Cowboy 2", text:"Tá vendo aqueles de lenço amarelo?"},
            {name:"Cowboy 2", text:"São vândalos, quebram torres e desarmam dinamites."},
            {name:"Cowboy 2", text:"Não tão nem aí pro ouro, só pra bagunçar nossa defesa."}
          ],
          [
            {name:"Cowboy 2", text:"Chegou encrenca nova: os vândalos."},
            {name:"Cowboy 2", text:"Ignoram a pilha de ouro e vão direto nas nossas sentinelas."},
            {name:"Cowboy 2", text:"Um tiro basta, mas se encostar na dinamite, desarma."}
          ],
          [
            {name:"Cowboy 2", text:"Lenço amarelo no horizonte."},
            {name:"Cowboy 2", text:"Esses são os caras que destroem nossas torres."},
            {name:"Cowboy 2", text:"Se ouviu metal quebrando, já era. Melhor não deixar chegar perto."}
          ],
          [
            {name:"Cowboy 2", text:"Vândalos chegando! Eles odeiam torres."},
            {name:"Cowboy 2", text:"Quatro pancadas e desmontam qualquer sentinela."},
            {name:"Cowboy 2", text:"E ainda desarmam dinamite com um pé. Vamos detonar eles antes que dê tempo."}
          ],
          [
            {name:"Cowboy 2", text:"Ei, aqueles amarelos ignoram o ouro."},
            {name:"Cowboy 2", text:"Preferem destruir o que construímos."},
            {name:"Cowboy 2", text:"Um tiro derruba, mas se encostar, adeus torre. Não dá mole, acerta eles primeiro."}
          ]
        ];
        const pick24 = Math.floor(Math.random()*coopVariants24.length);
        startDialog(coopVariants24[pick24], {portrait:'coop'});
      } else {
        const variants = [
        [
          {name:"Cowboy", text:"Ei... tá vindo coisa nova no horizonte."},
          {name:"Cowboy", text:"Bandana amarela, corpo marrom... não é bandido comum."},
          {name:"Cowboy", text:"Vai nas torres primeiro e ainda mexe nas dinamites. Fica esperto."}
        ],
        [
          {name:"Cowboy", text:"Novo tipo de peste chegando."},
          {name:"Cowboy", text:"Esses aí quebram a sentinela como se fosse brinquedo..."},
          {name:"Cowboy", text:"...e ainda desarmam dinamite se encostar. Não deixa chegar."}
        ],
        [
          {name:"Cowboy", text:"Tá vendo o lenço amarelo?"},
          {name:"Cowboy", text:"Marca registrada de encrenca. Eles ignoram ouro pra quebrar torre."}
        ],
        [
          {name:"Cowboy", text:"Não vacila com a sentinela."},
          {name:"Cowboy", text:"Quatro pancadas desses Vândalos e ela vira sucata."}
        ],
        [
          {name:"Cowboy", text:"Se um desses parar em cima da dinamite..."},
          {name:"Cowboy", text:"...ele desarma em poucos segundos. Não dá mole."}
        ],
        [
          {name:"Cowboy", text:"Olho vivo: inimigo novo no pedaço."},
          {name:"Cowboy", text:"Bandana amarela. Primeiro alvo: nossas torres."}
        ],
        [
          {name:"Cowboy", text:"Tem Vândalo chegando por aí."},
          {name:"Cowboy", text:"Morre com um tiro, mas se encostar na torre dá ruim."}
        ],
        [
          {name:"Cowboy", text:"Atenção: torres sob ameaça."},
          {name:"Cowboy", text:"Eles arrebentam a base e neutralizam explosivo."}
        ],
        [
          {name:"Cowboy", text:"Se ouvir metal quebrando... já era a sentinela."},
          {name:"Cowboy", text:"Vândalo não quer ouro, quer bagunça."}
        ],
        [
          {name:"Cowboy", text:"Não deixa esse tal de Vândalo respirar."},
          {name:"Cowboy", text:"Um tiro e cai. Dois segundos parado na dinamite e adeus boom."}
        ]
      ];
      const pick = Math.floor(Math.random()*variants.length);
      startDialog(variants[pick]);
      }
    }


    if (w === 72){
      const variants72 = [
        [
          {name:"Cowboy", text:"Ei... o que é isso?"},
          {name:"Cowboy", text:"Tem umas figuras translúcidas flutuando aí."},
          {name:"Cowboy", text:"Fantasmas. Não é brincadeira."},
          {name:"Cowboy", text:"Bala normal atravessa eles. Só com a Bala Translúcida você consegue acertar. E precisa de três tiros."}
        ],
        [
          {name:"Cowboy", text:"Tô vendo coisas ou tem espectro voando aí?"},
          {name:"Cowboy", text:"Fantasmas. Imunes a tudo que temos."},
          {name:"Cowboy", text:"Torres, parceiro, cachorro, dinamite... nada funciona neles."},
          {name:"Cowboy", text:"Só a Bala Translúcida dá conta. Três tiros pra cada um."}
        ],
        [
          {name:"Cowboy", text:"Bem. Achei que bandido armado era o pior."},
          {name:"Cowboy", text:"Fantasmas. Passam por barricada, torres, tudo."},
          {name:"Cowboy", text:"Meus aliados não conseguem nem ver eles."},
          {name:"Cowboy", text:"Se você tiver Bala Translúcida, tá no jogo. Senão... reza."}
        ],
        [
          {name:"Cowboy", text:"O deserto agora tem fantasma. Que dia."},
          {name:"Cowboy", text:"Atravessam qualquer coisa que a gente construiu."},
          {name:"Cowboy", text:"A boa notícia: só o ouro importa pra eles."},
          {name:"Cowboy", text:"Consegue ver eles? Pega Bala Translúcida e dá três tiros. Simples assim."}
        ],
        [
          {name:"Cowboy", text:"Isso aí que tá flutuando... não é nuvem."},
          {name:"Cowboy", text:"São fantasmas. Invisíveis pra tudo, menos pra bala especial."},
          {name:"Cowboy", text:"Compra a Bala Translúcida se ainda não tem."},
          {name:"Cowboy", text:"Três tiros certeiros e eles somem. Bota fé."}
        ]
      ];
      const pick72 = Math.floor(Math.random()*variants72.length);
      startDialog(variants72[pick72]);
    }

    if (isBossWave(w)) {
      const forced = state.forceBossName;
      const pool = (w < 20) ? BOSSES.filter(bb => bb.name !== "Os Gêmeos" && bb.name !== "Pistoleiro Fantasma") : BOSSES;
      const bdefForced = forced ? (pool.find(b=>b.name===forced) || pool[0]) : null;
      const bdef = bdefForced ? bdefForced : pool[randInt(0, pool.length-1)];
      state.forceBossName = null;
      const side = randInt(0,3);
      let x,y;
      if (side===0){ x=0; y=randInt(0,GRID_H-1); }
      else if (side===1){ x=GRID_W-1; y=randInt(0,GRID_H-1); }
      else if (side===2){ x=randInt(0,GRID_W-1); y=0; }
      else { x=randInt(0,GRID_W-1); y=GRID_H-1; }
      for (let tries=0; tries<20 && isBlocked(x,y); tries++){
        if (side<=1) y = randInt(0,GRID_H-1);
        else x = randInt(0,GRID_W-1);
      }
      const _bossHpMul = 1 + Math.max(0, (w/10 - 1)) * 0.2;
      const _bossHp = Math.round(bdef.maxhp * _bossHpMul);
      if(bdef.name === "Os Gêmeos"){
        // Spawn em lados opostos: sortear eixo (horizontal ou vertical)
        const _axis = randInt(0,1); // 0=horizontal(esq/dir), 1=vertical(cima/baixo)
        let x1,y1,x2,y2;
        if(_axis===0){
          x1=0; y1=randInt(1,GRID_H-2);
          x2=GRID_W-1; y2=randInt(1,GRID_H-2);
        } else {
          x1=randInt(1,GRID_W-2); y1=0;
          x2=randInt(1,GRID_W-2); y2=GRID_H-1;
        }
        for(let _t=0;_t<10&&isBlocked(x1,y1);_t++){ if(_axis===0)y1=randInt(1,GRID_H-2); else x1=randInt(1,GRID_W-2); }
        for(let _t=0;_t<10&&isBlocked(x2,y2);_t++){ if(_axis===0)y2=randInt(1,GRID_H-2); else x2=randInt(1,GRID_W-2); }
        state.boss = { name:"Os Gêmeos", id:state.nextBanditId++, color:"#9b2b6b",
          x:x1,y:y1, hp:_bossHp, maxhp:_bossHp, speedMul:3.74, dmgMul:1.5, alive:true, dmgTimer:0,
          _gemino:1 };
        state.boss2 = { name:"Os Gêmeos", id:state.nextBanditId++, color:"#6b9b2b",
          x:x2,y:y2, hp:_bossHp, maxhp:_bossHp, speedMul:3.74, dmgMul:1.5, alive:true, dmgTimer:0,
          _gemino:2 };
        state._gemeosSplitT = 0; // timer para animação de split
        state._gemeosSplit = false;
        // Barra única inicialmente
        bossName.textContent = "Os Gêmeos";
        bossName.style.visibility="visible"; bossName.style.opacity="1";
        bossBar.style.visibility="visible"; bossBarFill.style.width="100%";
        try{const _g=document.getElementById('geminiBarsWrap');if(_g)_g.style.display='none';}catch(_){}
      } else {
        state.boss = { name:bdef.name, id: state.nextBanditId++, color:bdef.color, x,y, hp:_bossHp, maxhp:_bossHp, speedMul:bdef.speedMul, dmgMul:bdef.dmgMul, alive:true, dmgTimer:0 };
        state.boss2 = null;
      }
      state.seen.bosses[bdef.name] = true;
      musicStop(); bossMusicStart(bdef.name);
      if(bdef.name !== "Os Gêmeos"){
        resetBossBarUi(false);
        bossName.textContent = bdef.name;
        bossName.style.visibility="visible"; bossName.style.opacity="1";
        bossBar.style.visibility="visible";
        bossBarFill.style.width = "100%";
      }
      toastMsg(`BOSS: ${bdef.name}!`);
      beep(200,0.12,"sawtooth",0.05); beep(120,0.22,"sawtooth",0.05);
    }
  }

  function endWave(){
    const clearedWave = state.wave;

    // Cowboy heal on boss clear (a partir da onda 20)
    if (isBossWave(clearedWave) && clearedWave >= 20 && state.wave >= 12){
      const before = state.player.hp|0;
      const add = 50;
      state.player.hp = Math.min(state.player.max, (state.player.hp|0) + add);
      const gained = (state.player.hp|0) - before;
      if (gained > 0){
        // popup bonito + som
        const px = state.player.x*TILE + TILE/2;
        const py = state.player.y*TILE - 10;
        pushMultiPopup(`+${gained} VIDA`, "#4fe36a", px, py);
        spawnHealFX(state.player.x, state.player.y);
        beep(784,0.06,"triangle",0.05);
        beep(988,0.05,"triangle",0.04);

        // animação da barra de vida
        try{
          playerHPBar.classList.remove("healPulse");
          void playerHPBar.offsetWidth;
          playerHPBar.classList.add("healPulse");
          setTimeout(()=>playerHPBar.classList.remove("healPulse"), 560);
        }catch(e){}
        try{ updateHUD(); }catch(e){}
      }
    }

    state.wave++;
    state.betweenWaves = true;
    // Gold mine: check if any mine should provide gold this wave
    try{
      if(state.goldMines && state.goldMines.length){
        for(const m of state.goldMines){
          if(m.hp<=0)continue;
          const lvl=m.level||1;
          const interval=_goldMineInterval(lvl);
          if((state.wave - m.lastGoldWave) >= interval){
            m.lastGoldWave=state.wave;
            const healAmt=_goldMineHealAmount(lvl);
            const before=state.gold.hp|0;
            state.gold.hp=Math.min(state.gold.max,(state.gold.hp|0)+healAmt);
            const gained=(state.gold.hp|0)-before;
            if(gained>0){
              // Floating yellow text above mine
              const mpx=m.x*TILE+TILE/2, mpy=m.y*TILE-8;
              pushMultiPopup('+'+gained+' ⛏️','#f3d23b',mpx,mpy);
              // Gold bar pulse
              try{
                const gbar=document.getElementById('goldHPBar');
                if(gbar){gbar.classList.remove('healPulse');void gbar.offsetWidth;gbar.classList.add('healPulse');setTimeout(()=>{try{gbar.classList.remove('healPulse');}catch(_){}},560);}
              }catch(_){}
              // Mine sparkle FX
              for(let i=0;i<12;i++){const a=Math.random()*Math.PI*2,s=50+Math.random()*80,l=0.4+Math.random()*0.3;state.fx.push({x:mpx,y:mpy+8,vx:Math.cos(a)*s,vy:Math.sin(a)*s-50,life:l,max:l,color:i%2===0?'#f3d23b':'#ffe080',size:2+Math.random()*2,grav:180});}
              // Unique mine sound: high sparkly chime
              try{beep(1047,0.06,'triangle',0.05);setTimeout(()=>beep(1319,0.06,'triangle',0.05),60);setTimeout(()=>beep(1568,0.08,'triangle',0.06),130);}catch(_){}
              try{updateHUD();}catch(_){}
            }
          }
        }
      }
    }catch(_){}
    setTimeout(()=>{ startWave(); }, state.waveCool);
  }

  // Entrada

  function _feedCheat1303FromKeydown(e){
    const ch = (e.key||"").toLowerCase();
    if (!/^[a-z0-9]$/.test(ch)) return;
    window._cheatBuf = (window._cheatBuf||"");
    window._cheatBuf = (window._cheatBuf + ch).slice(-20);
    if (!window._cheatBuf.endsWith("1303")) return;
    if (state && state.coop){
      state.score1 = (state.score1||0) + 10000;
      state.score2 = (state.score2||0) + 10000;
      state.totalScore1 = (state.totalScore1||0) + 10000;
      state.totalScore2 = (state.totalScore2||0) + 10000;
    } else if (state) {
      state.score += 10000;
      state.totalScore = (state.totalScore||0) + 10000;
    }
    try{ updateHUD(); }catch(_){}
    try{ if (typeof window._renderShopPage === "function") window._renderShopPage(); }catch(_){}
    try{ if (typeof refreshShopVisibility === "function") refreshShopVisibility(); }catch(_){}
  }

  function _refundPlacementCost(amount){
    amount = Number(amount) || 0;
    if (!state || amount <= 0) return;
    if (state.coop){
      const ps = state.activeShopPlayer || 1;
      if (ps === 1) state.score1 = (state.score1 || 0) + amount;
      else state.score2 = (state.score2 || 0) + amount;
    } else {
      state.score = (state.score || 0) + amount;
    }
    try{ if (typeof refreshShopVisibility === "function") refreshShopVisibility(); }catch(_){}
    try{ if (typeof window._renderShopPage === "function") window._renderShopPage(); }catch(_){}
    try{ updateHUD(); }catch(_){}
  }
  
/*__MODAL_HOTKEY_GATE__*/
window.addEventListener("keydown", (e)=>{
    // Modal gate (sem gambiarra): 
    // - Resultados: bloqueia tudo
    // - Opções in-game: só aceita 'O' pra fechar
    // - Loja: só aceita 'L' pra fechar
    try{
      const b = document.body;
      const gor = document.getElementById('gameOverResults');
      const resultsOpen = (b && b.getAttribute('data-results-open')==='1') || (gor && gor.classList && gor.classList.contains('gor-visible'));
      const optionsOpen = (b && b.getAttribute('data-options-open')==='1');
      const shopOpen = (b && b.getAttribute('data-shop-open')==='1');

      // Se o foco estiver em um campo de texto (ex.: nome no Perfil), não intercepta teclas.
      // Isso evita bloquear digitação no menu/Perfil.
      const ae = document.activeElement;
      const typingTarget = !!(ae && (ae.tagName==='INPUT' || ae.tagName==='TEXTAREA' || ae.isContentEditable));
      if (e.key === 'Tab'){
        e.preventDefault();
        return;
      }
      if (!resultsOpen && typingTarget) return;

      if (resultsOpen){
        e.preventDefault();
        return;
      }
      if (optionsOpen){
        const k = e.key;
        if (k === 'o' || k === 'O'){
          e.preventDefault();
          try{ if (window.closeOptions) window.closeOptions(); }catch(_){}
        } else {
          e.preventDefault();
        }
        return;
      }
      if (shopOpen){
        _feedCheat1303FromKeydown(e);
        const k = e.key;
        if (k === '1' || k === '2' || k === '3' || k === '4'){
          e.preventDefault();
          try{
            const map = { '1':'player', '2':'place', '3':'comp', '4':'abil' };
            const key = map[k];
            if (key){
              window._shopTab = key;
              const _tabs = document.querySelectorAll('.tab');
              _tabs.forEach(function(t){
                t.classList.toggle('active', (t.getAttribute('data-tab')||'player') === key);
              });
              if (window._setShopPage) window._setShopPage(0);
              else if (window._renderShopPage) window._renderShopPage();
            }
          }catch(_){}
        } else if (k === 'l' || k === 'L'){
          e.preventDefault();
          try{ if (typeof toggleShop === 'function') toggleShop(); }catch(_){}
        } else {
          e.preventDefault();
        }
        return;
      }
    }catch(_){}

    // Wave Picker aberto: captura Enter/Esc e evita que o resto do jogo receba input,
    // mas SEM bloquear digitação no campo.
    if (isWavePickerOpen && isWavePickerOpen()){
      const inp = document.getElementById("wavePickerInput");
      const ae = document.activeElement;

      if(e.key==="Escape"){e.preventDefault();closeWavePicker();return;}
      // Placement mode ESC cancel (handled in main keydown below)
      if (e.key === "Enter"){ e.preventDefault(); gotoWave(inp?.value || (state.wave||1)); return; }

      // Se o foco estiver no input, deixa digitar normalmente
      if (inp && ae === inp) return;

      // Fora do input: bloqueia (pra não andar/atirar/pause etc.)
      e.preventDefault();
      return;
    }

// Hotkey: \ abre seletor de wave
    if (e.key === "\\" || e.code === "Backslash" || e.code === "IntlBackslash"){
      if (!state.inMenu){
        e.preventDefault();
        openWavePicker();
      }
      return;
    }


  // No teclado do menu, só começa pelo botão "Jogar"
  if (state && state.inMenu) { /* ignore keys on menu */ }

  _feedCheat1303FromKeydown(e);

  if(e.key==="Escape"&&state&&(state.placingSentry||state.movingSentry)){if((state._sentryRefund||0)>0){_refundPlacementCost(state._sentryRefund);state._sentryRefund=0;}state.placingSentry=false;state.movingSentry=null;state.sentryHoverX=-1;state.sentryHoverY=-1;state.pausedManual=false;try{pauseBtn.textContent='Pausar';}catch(_){}const _eh=document.getElementById('sentryPlaceHint');if(_eh)_eh.style.display='none';const _mh=document.getElementById('sentryMoveHint');if(_mh)_mh.style.display='none';return;}
  if(e.key==="Escape"&&state&&state.placingClearPath){if((state._clearPathRefund||0)>0){_refundPlacementCost(state._clearPathRefund);state._clearPathRefund=0;}state.placingClearPath=false;state.pausedManual=false;try{pauseBtn.textContent='Pausar';}catch(_){}const _ch=document.getElementById('clearPathHint');if(_ch)_ch.style.display='none';return;}
  if(e.key==="Escape"&&state&&state.placingGoldMine){if((state._goldMineRefund||0)>0){_refundPlacementCost(state._goldMineRefund);state._goldMineRefund=0;}state.placingGoldMine=false;state.goldMineHoverX=-1;state.goldMineHoverY=-1;state.pausedManual=false;try{pauseBtn.textContent='Pausar';}catch(_){}const _gh=document.getElementById('goldMinePlaceHint');if(_gh)_gh.style.display='none';return;}
  if(e.key==="Escape"&&state&&state.movingGoldMine){if((state._goldMineRefund||0)>0){_refundPlacementCost(state._goldMineRefund);state._goldMineRefund=0;}state.movingGoldMine=null;state.goldMineHoverX=-1;state.goldMineHoverY=-1;state.pausedManual=false;try{pauseBtn.textContent='Pausar';}catch(_){}const _mh=document.getElementById('goldMineMoveHint');if(_mh)_mh.style.display='none';return;}
  if(e.key==="Escape"&&state&&(state.placingEspantalho||state.movingEspantalho)){
    if((state._espantalhoRefund||0)>0){_refundPlacementCost(state._espantalhoRefund);state._espantalhoRefund=0;}
    state.placingEspantalho=false;state.movingEspantalho=null;state.espantalhoHoverX=-1;state.espantalhoHoverY=-1;state.pausedManual=false;
    try{pauseBtn.textContent='Pausar';}catch(_){}
    const _eh=document.getElementById('espantalhoPlaceHint');if(_eh)_eh.style.display='none';
    const _emh=document.getElementById('espantalhoMoveHint');if(_emh)_emh.style.display='none';
    return;
  }
  if(e.key==="Escape"&&state&&state.placingPichaPoco){if((state._pichaPocoRefund||0)>0){_refundPlacementCost(state._pichaPocoRefund);state._pichaPocoRefund=0;}state.placingPichaPoco=false;state.pichaPocoHoverX=-1;state.pichaPocoHoverY=-1;state.pausedManual=false;try{pauseBtn.textContent='Pausar';}catch(_){}const _pph=document.getElementById('pichaPocoPlaceHint');if(_pph)_pph.style.display='none';return;}
  if(e.key==="Escape"&&state&&state.movingPichaPoco){if((state._pichaPocoRefund||0)>0){_refundPlacementCost(state._pichaPocoRefund);state._pichaPocoRefund=0;}state.movingPichaPoco=null;state.pichaPocoHoverX=-1;state.pichaPocoHoverY=-1;state.pausedManual=false;try{pauseBtn.textContent='Pausar';}catch(_){}const _pmh=document.getElementById('pichaPocoMoveHint');if(_pmh)_pmh.style.display='none';return;}
  if(e.key==="Escape"&&state&&state.placingBarricada){if((state._barricadaRefund||0)>0){_refundPlacementCost(state._barricadaRefund);state._barricadaRefund=0;}state.placingBarricada=false;state.barricadaHoverX=-1;state.barricadaHoverY=-1;state.pausedManual=false;try{pauseBtn.textContent='Pausar';}catch(_){}const _bh=document.getElementById('barricadaPlaceHint');if(_bh)_bh.style.display='none';return;}
  if(e.key==="Escape"&&state&&(state.placingPortalBlue||state.placingPortalOrange)){
    // Cancelar: se laranja estava sendo colocado, desfaz o azul também
    state.portals=null;
    state.placingPortalBlue=false;state.placingPortalOrange=false;
    state.portalHoverX=-1;state.portalHoverY=-1;
    state.pausedManual=false;
    try{pauseBtn.textContent='Pausar';}catch(_){}
    const _hb=document.getElementById('portalBlueHint');if(_hb)_hb.style.display='none';
    const _ho=document.getElementById('portalOrangeHint');if(_ho)_ho.style.display='none';
    if((state._portalRefund||0)>0){_refundPlacementCost(state._portalRefund);state._portalRefund=0;}
    toastMsg('Portal cancelado.');
    return;
  }
  if(e.key==="Escape"&&state&&state.movingBarricada){if((state._barricadaRefund||0)>0){_refundPlacementCost(state._barricadaRefund);state._barricadaRefund=0;}state.movingBarricada=null;state.barricadaHoverX=-1;state.barricadaHoverY=-1;state.pausedManual=false;try{pauseBtn.textContent='Pausar';}catch(_){}const _bm=document.getElementById('barricadaMoveHint');if(_bm)_bm.style.display='none';return;}
  if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault();

  // Bloqueia hotkeys durante telas modais (Resultados / Opções / Loja / Confirmações)
  try{
    const body = document.body;
    const resultsOpen = body && body.getAttribute('data-results-open')==='1';
    const optionsOpen = body && body.getAttribute('data-options-open')==='1';
    const shopOpen    = body && body.getAttribute('data-shop-open')==='1';
    const confirmOpen = body && body.getAttribute('data-confirm-open')==='1';
    const k = e.key;

    // Resultados: bloqueia TODO input de hotkey (inclui wave skip, wave picker etc.)
    if (resultsOpen){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }

    // Opções in-game: tecla O fecha (toggle). Fora isso, bloqueia tudo.
    if (optionsOpen){
      if (k==='o' || k==='O'){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); try{ window.closeOptions(); }catch(_){ } return; }
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }

    // Loja: tecla L fecha (toggle). Fora isso, bloqueia tudo.
    if (shopOpen){
      if (k==='l' || k==='L'){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); try{ toggleShop(); }catch(_){ } return; }
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }

    // Confirmações (menu/reset etc.): bloqueia hotkeys (usa somente os botões da UI)
    if (confirmOpen){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }
  }catch(_){ }

// Reiniciar (R)
  if (e.key === "r" || e.key === "R"){
    if (window._expSystem && window._expSystem._isLocked && window._expSystem._isLocked()) return;
    if (state && !state.running && !state.inMenu){
      try{ closeConfirmReset(); }catch(_){}
      if (state.coop) resetGameCoop();
      else resetGame();
      state.running = true;
      state.inMenu = false;
      musicStop(); musicStart();
      return;
    }
    // Durante a partida: pede confirmação (se não há diálogo/loja)
    if (state && state.running && !state.inMenu && !(dialog && dialog.active) && !state.pausedShop){
      openConfirmReset();
    }
    return;
  }

  // Avançar diálogo (tecla Espaço) — só quando há diálogo ativo
  if (dialog && dialog.active){
    if (e.code === "Space"){ nextDialog(); e.preventDefault(); }
    return;
  }

  // Atalhos gerais
  // Atalho para a loja (L). No modo cooperativo, cada jogador abre sua loja por botões separados, então ignora esta tecla.
  if (e.key === "l" || e.key === "L") {
    if (state && state.coop){ /* ignore in coop */ return; }
    toggleShop();
    return;
  }

  // Atalho para Opções (O) — apenas in-game (não no menu, não em diálogo/loja, não em resultados)
  if (e.key === "o" || e.key === "O") {
    try{
      if (state && state.running && !state.inMenu && !(dialog && dialog.active) && !state.pausedShop){
        if (window.openOptions) window.openOptions(true);
      }
    }catch(_){}
    return;
  }
  if (e.key === "i" || e.key === "I") {
    // no-op: inimigos enciclopédia desativado
    return;
  }
  if (e.key === "p" || e.key === "P") { togglePause(); return; }
  if (e.key === "m" || e.key === "M") { if (state && state.running && !state.inMenu && !(dialog && dialog.active) && !state.pausedShop) { openConfirmMenu(); } return; }

  // Rolamento (Shift) — só fora do menu/pausa/diálogo/loja
  if (e.key === "Shift" || e.code === "ShiftLeft" || e.code === "ShiftRight"){
    // In coop, ignore right shift for rolling since it controls player2 shooting
    if (state && state.coop && e.code === "ShiftRight"){
      // do not handle roll; allow coop handling below
    } else {
      if (e.repeat) return;
      if (state && state.running && !state.inMenu && !state.pausedShop && !state.pausedManual && !(dialog && dialog.active)){
        e.preventDefault();
        tryRoll();
      }
      return;
    }
  }

  // Mira aprimorada: F trava automaticamente no inimigo mais próximo
  if (e.code === "KeyF"){
    if (state && state.running && !state.inMenu && !state.pausedShop && !state.pausedManual && !(dialog && dialog.active)){
      if ((state.aimLevel||0) > 0){
        e.preventDefault();
        targetNearest();
      }
    }
    return;
  }

  // Coop input handling para o Cowboy 2: setas movem, Enter atira, Shift direito rola
  if (state && state.coop){
    // evita scroll com setas
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) e.preventDefault();
    // atualiza flags de movimento do Cowboy 2
    if (e.key === "ArrowUp") { state.keysHeld2.up = true; }
    if (e.key === "ArrowDown") { state.keysHeld2.down = true; }
    if (e.key === "ArrowLeft") { state.keysHeld2.left = true; }
    if (e.key === "ArrowRight") { state.keysHeld2.right = true; }
    // Enter controla tiro do Cowboy 2
    if (e.code === "Enter") { state.keysHeld2.shoot = true; }
    // ação imediata
    if (!e.repeat){
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)){
        tryMove2(e.key);
      }
      if (e.code === "Enter"){
        tryShoot2();
      }
      if (e.code === "ShiftRight"){
        tryRoll2();
      }
    }
  }

  // Registra teclas pressionadas (para movimento/tiro contínuo) para o Cowboy 1.
  if ((e.key === "w" || e.key === "W") || ((!state || !state.coop) && e.key === "ArrowUp")) {
    if (state && state.keysHeld){ state.keysHeld.up = true; }
  }
  if ((e.key === "s" || e.key === "S") || ((!state || !state.coop) && e.key === "ArrowDown")) {
    if (state && state.keysHeld){ state.keysHeld.down = true; }
  }
  if ((e.key === "a" || e.key === "A") || ((!state || !state.coop) && e.key === "ArrowLeft")) {
    if (state && state.keysHeld){ state.keysHeld.left = true; }
  }
  if ((e.key === "d" || e.key === "D") || ((!state || !state.coop) && e.key === "ArrowRight")) {
    if (state && state.keysHeld){ state.keysHeld.right = true; }
  }
  // Atirar para Cowboy 1 usa Espaço. No coop o Enter controla Cowboy 2.
  if (e.code === "Space") { if (state && state.keysHeld){ state.keysHeld.shoot = true; } }
  // Saraivada: tecla Q
  if ((e.key === 'q' || e.key === 'Q') && state && state.running && !state.pausedManual && !state.pausedShop && !state.inMenu){
    if (!(dialog && dialog.active)) doSaraivada();
    return;
  }
  // Menu do parceiro: aberto clicando no aliado no canvas

  // Se o jogo está pausado, não executa ação imediata
  if (!state.running || state.pausedShop || state.pausedManual) return;

  // Ação imediata no primeiro pressionar (sem depender do auto-repeat do SO)
  if (!e.repeat){
    const shiftDown = !!(state && state.keysHeld && state.keysHeld.shift);
    // Se o Shift estiver segurado, nao dispara move instantaneo extra
    if (!shiftDown){
      // Movimento instantâneo para Cowboy 1: inclui setas somente fora do coop
      const moveKeys1 = ["w","a","s","d","W","A","S","D"];
      const arrowKeys = ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"];
      if (moveKeys1.includes(e.key) || (!state || !state.coop) && arrowKeys.includes(e.key)){
        tryMove(e.key);
      }
    }
    // Atira imediatamente com Espaço para o Cowboy 1
    if (e.code === "Space") tryShoot();
  }

});
window.addEventListener("keyup", (e)=>{
  if (!state || !state.keysHeld) return;
  // Libera teclas pressionadas para Cowboy 1
  if (e.key === "w" || e.key === "W" || ((!state || !state.coop) && e.key === "ArrowUp")) state.keysHeld.up = false;
  if (e.key === "s" || e.key === "S" || ((!state || !state.coop) && e.key === "ArrowDown")) state.keysHeld.down = false;
  if (e.key === "a" || e.key === "A" || ((!state || !state.coop) && e.key === "ArrowLeft")) state.keysHeld.left = false;
  if (e.key === "d" || e.key === "D" || ((!state || !state.coop) && e.key === "ArrowRight")) state.keysHeld.right = false;
  if (e.code === "Space") state.keysHeld.shoot = false;

  // Libera controles do Cowboy 2 no modo coop
  if (state && state.coop && state.keysHeld2){
    if (e.key === "ArrowUp") state.keysHeld2.up = false;
    if (e.key === "ArrowDown") state.keysHeld2.down = false;
    if (e.key === "ArrowLeft") state.keysHeld2.left = false;
    if (e.key === "ArrowRight") state.keysHeld2.right = false;
    if (e.code === "Enter") state.keysHeld2.shoot = false;
    // Right Shift controlava tiro antes, mas agora é rolamento; nada a fazer aqui
  }
});


  
  // === Multi-kill helpers ===
  function multiLabel(n){
    if (n<=1) return "";
    return "Abate x"+n;
  }
  // cores únicas (2..15)
  const MULTI_COLORS = {
    2:"#2ecc71", 3:"#27ae60", 4:"#1abc9c",
    5:"#16a085", 6:"#f1c40f", 7:"#f39c12",
    8:"#e67e22", 9:"#d35400", 10:"#e74c3c",
    11:"#c0392b", 12:"#9b59b6", 13:"#8e44ad",
    14:"#2980b9", 15:"#2c3e50"
  };
  function multiColor(n){ return MULTI_COLORS[Math.max(2, Math.min(15, n))] || "#fff"; }
  function multiSound(n){const base=360+n*18;if(n>=5){beep(base,0.06,"square",0.05);beep(base+60,0.08,"triangle",0.05);beep(base+120,0.10,"triangle",0.05);setTimeout(()=>beep(base+200,0.14,"sine",0.07),80);if(n>=8){setTimeout(()=>beep(base+320,0.18,"sine",0.08),180);setTimeout(()=>beep(base+450,0.22,"triangle",0.09),300);}}else{beep(base,0.07,"square",0.05);beep(base+90,0.10,"triangle",0.04);}}
  function pushMultiPopup(text, color, x, y){
    state.multiPopups.push({text, color, x, y, vy: -16, life: 1.0, max: 1.0});
  }
  function registerMultiKill(basePoints, tx, ty){
    const now = performance.now();
    const mk = state.multiKill;
    if (now - mk.lastAt <= mk.windowMs){
      mk.count += 1;
      mk.baseSum += basePoints;
      mk.sx += (tx || 0); mk.sy += (ty || 0);
    } else {
      // finaliza janela anterior (se houver) antes de iniciar outra
      finalizeMultiKill();
      mk.count = 1;
      mk.baseSum = basePoints;
      mk.sx = (tx || 0);
      mk.sy = (ty || 0);
    }
    mk.lastAt = now;
  }
  function triggerSegundaChanceOrGameOver(){if(state.secondChance){state.secondChance=false;state.gold.hp=50;state.goldInvulT=3.0;try{const gx=state.gold.x*TILE+TILE/2,gy=state.gold.y*TILE+TILE/2;for(let i=0;i<40;i++){const a=(Math.PI*2*i)/40,s=3+Math.random()*5,l=0.6+Math.random()*0.6;state.fx.push({x:gx,y:gy,vx:Math.cos(a)*s*60,vy:Math.sin(a)*s*60-40,life:l,max:l,color:i%3===0?'#f3d23b':(i%3===1?'#ffffff':'#e0a257'),size:2+Math.random()*4,grav:80});}}catch(_){}state.secondChanceFlashT=1.0;state.shakeT=Math.min(1.0,(state.shakeT||0)+0.8);state.shakeMag=Math.max(8.0,state.shakeMag||0);try{beep(200,0.06,'sawtooth',0.07);setTimeout(()=>beep(400,0.08,'square',0.07),80);setTimeout(()=>beep(600,0.08,'triangle',0.07),160);setTimeout(()=>beep(800,0.10,'triangle',0.08),250);setTimeout(()=>beep(1000,0.12,'triangle',0.09),350);setTimeout(()=>beep(1200,0.18,'triangle',0.10),470);}catch(_){}pushMultiPopup('⚡ SEGUNDA CHANCE!','#f3d23b',state.gold.x*TILE+TILE/2,state.gold.y*TILE-18);toastMsg('⚡ SEGUNDA CHANCE! Ouro restaurado para 50!');try{updateHUD();}catch(_){}}else{state.running=false;musicStop();try{window._expSystem&&window._expSystem.onGameOver(state,'gold');}catch(_){}}}

  function finalizeMultiKill(){const mk=state.multiKill;if(mk.count>=2){const n=Math.min(15,mk.count);addScore('multi',mk.baseSum*(n-1));const ax=(mk.sx/mk.count)*TILE+TILE/2,ay=(mk.sy/mk.count)*TILE+8;pushMultiPopup(multiLabel(n),multiColor(n),ax,ay);multiSound(n);if((state.shakeT||0)<0.15){const i=Math.min(n,8);state.shakeT=Math.min(0.7,0.12+i*0.07);state.shakeMag=1.8+i*0.55;}if(n>=3){state.multiFlashT=Math.max(state.multiFlashT||0,0.45+n*0.04);state.multiFlashColor=multiColor(n);state.multiFlashAlpha=Math.min(0.55,0.12+(n-2)*0.08);}if(n>=4){const cnt=6+n*2;for(let i=0;i<cnt;i++){const ang=(Math.PI*2*i)/cnt,spd=(2+Math.random()*3*(n/6))*60,life=0.3+Math.random()*0.4;state.fx.push({x:ax,y:ay,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-30,life,max:life,color:multiColor(n),size:1.5+Math.random()*2.5,grav:150});}}}mk.count=0;mk.baseSum=0;mk.sx=0;mk.sy=0;}

  function tryMove(k){
    const p = state.player;
    // Do not move if the cowboy is down (HP zero)
    if (p && p.hp <= 0) return;
    if (p.moveLock) return; // usado para travas "lógicas" (dialogo/pause/etc)
    const now = performance.now();
    if (now < (p.nextMoveAt||0)) return;

    let dir = null;
    if (k==="w" || k==="W" || k==="ArrowUp") dir = DIRS.up;
    if (k==="s" || k==="S" || k==="ArrowDown") dir = DIRS.down;
    if (k==="a" || k==="A" || k==="ArrowLeft") dir = DIRS.left;
    if (k==="d" || k==="D" || k==="ArrowRight") dir = DIRS.right;
    if (!dir) return;
    // Em modo Apenas Teclado, a direção do movimento define o face
    const _gsm = window._gameSettings || {};
    if ((_gsm.inputMode || 'mouse') === 'keys') p.face = dir;
    const nx = p.x + dir.x;
    const ny = p.y + dir.y;
    // Prevent walking through the other player in coop. We need to know
    // which cowboy is moving; state.player1 references the original single‑player
    // cowboy, and state.player2 references the partner. When coop is active
    // and both players exist, block movement into the other player's tile.
    let blocked = isBlocked(nx,ny) || isBridgeMoveBlocked(p.x,p.y,nx,ny);
    // Boss bloqueia passagem do jogador
    if (!blocked && state && state.boss && state.boss.alive && nx===state.boss.x && ny===state.boss.y) blocked=true;
    if (!blocked && state && state.boss2 && state.boss2.alive && nx===state.boss2.x && ny===state.boss2.y) blocked=true;
    if (!blocked && state && state.coop && state.player2){
      const other = (state.player === state.player1) ? state.player2 : state.player1;
      if (other && nx === other.x && ny === other.y){
        blocked = true;
      }
    }
    if (!blocked){
      p.x = nx; p.y = ny;
      p.nextMoveAt = now + (p.moveLockMs||220);
      // ─── Teleporte via portal (side-aware) ─────────────────────
      if(state.portals&&state.portals.blue&&state.portals.orange){
        const _pb=state.portals.blue, _po=state.portals.orange;
        // from = tile de onde o player veio antes de entrar no portal (p.x/p.y é NOVO tile)
        const _fromX=p.x-dir.x, _fromY=p.y-dir.y; // tile anterior
        let _dest=null, _entrySide=null;
        if(p.x===_pb.x&&p.y===_pb.y&&!p._justTeleported){
          _dest=_po; _entrySide={x:dir.x,y:dir.y}; // direção de entrada
        } else if(p.x===_po.x&&p.y===_po.y&&!p._justTeleported){
          _dest=_pb; _entrySide={x:dir.x,y:dir.y};
        }
        if(_dest&&_entrySide){
          // Sai pelo lado oposto à entrada no portal destino
          const _ex=_dest.x+_entrySide.x, _ey=_dest.y+_entrySide.y;
          if(inBounds(_ex,_ey)&&!isBlocked(_ex,_ey)){
            p.x=_ex; p.y=_ey;
          } else {
            // fallback: sai por qualquer lado livre
            p.x=_dest.x; p.y=_dest.y;
          }
          p._justTeleported=true;
          const _pcx=p.x*TILE+TILE/2,_pcy=p.y*TILE+TILE/2;
          for(let _pi=0;_pi<18;_pi++){const _a=Math.random()*Math.PI*2,_s=60+Math.random()*90,_l=0.22+Math.random()*0.22;state.fx.push({x:_pcx,y:_pcy,vx:Math.cos(_a)*_s,vy:Math.sin(_a)*_s-30,life:_l,max:_l,color:_pi%3===0?'#ffffff':_pi%3===1?'#60c0ff':'#ffb060',size:1.5+Math.random()*2.5,grav:60});}
          try{beep(440,0.05,'sine',0.05);setTimeout(()=>beep(880,0.07,'sine',0.07),60);setTimeout(()=>beep(1320,0.09,'triangle',0.08),120);}catch(_){}
        } else if(!p._justTeleported){
          // já saiu do portal
        }
        if(p.x!==_pb.x||p.y!==_pb.y) if(p.x!==_po.x||p.y!==_po.y) p._justTeleported=false;
      }
    }
  }


  
  function tileOccupiedByEnemy(x,y){
    // Boss
    if (state.boss && state.boss.alive && state.boss.x===x && state.boss.y===y) return true;
    // Inimigos
    for (const z of state.bandits){
      if (!z.alive) continue;
      if (z.x===x && z.y===y) return true;
    }
    return false;
  }

  function rollDistanceTiles(){
    const lvl = state.rollLevel||0;
    if (lvl<=0) return 0;
    if (lvl===1) return 2;
    if (lvl===2) return 4;
    return 6;
  }

  function sfxRoll(){
    try{
      // "whoosh" + clickzinho
      noise(0.06, 0.03);
      beep(620, 0.03, "sine", 0.06);
      beep(980, 0.05, "triangle", 0.05);
    }catch(_){}
  }

  function spawnRollTrail(px, py, dir){
    // trilha azul bem marcada (partículas)
    const cx = px * TILE + TILE/2;
    const cy = py * TILE + TILE/2;
    for (let i=0;i<8;i++){
      const spread = 0.45;
      const ang = Math.atan2(-dir.y, -dir.x) + (Math.random()-0.5)*spread;
      const spd = 120 + Math.random()*180;
      const life = 0.18 + Math.random()*0.10;
      state.fx.push({
        x: cx + (Math.random()-0.5)*6,
        y: cy + (Math.random()-0.5)*6,
        vx: Math.cos(ang)*spd,
        vy: Math.sin(ang)*spd,
        life, max: life,
        color: (i%3===0) ? "#b9ecff" : "#3da1ff",
        size: 2,
        grav: 0
      });
    }
  }

  function tryRoll(){
    if (!state || !state.running || state.inMenu) return;
    if (state.pausedShop || state.pausedManual) return;
    if (dialog && dialog.active) return;
    if (!(state.rollLevel>0)) return;

    // Prevent rolling when the cowboy is down (HP zero)
    if (state.player && state.player.hp <= 0) return;

    const now = performance.now();
    if (now - (state.lastRollAt||-9999) < (state.rollCooldownMs||4000)) return;

    const p = state.player;
    if (!p) return;
    const dist = rollDistanceTiles();
    if (!dist) return;

    // Direção do rolamento: prioriza tecla pressionada no momento; senão usa a face atual
    let dir = p.face || DIRS.up;
    if (state.keysHeld){
      if (state.keysHeld.up) dir = DIRS.up;
      else if (state.keysHeld.down) dir = DIRS.down;
      else if (state.keysHeld.left) dir = DIRS.left;
      else if (state.keysHeld.right) dir = DIRS.right;
    }
    // p.face is controlled by mouse aim
// Rolamento nao usa moveLock por tempo (evita bug de velocidade)

    // executa deslocamento tile-a-tile, parando em obstáculo/inimigo
    let steps = 0;
    for (let i=0;i<dist;i++){
      const nx = p.x + dir.x;
      const ny = p.y + dir.y;
      if (isBlocked(nx,ny) || isBridgeMoveBlocked(p.x,p.y,nx,ny) || tileOccupiedByEnemy(nx,ny)) break;
      p.x = nx; p.y = ny;
      steps++;
      spawnRollTrail(p.x, p.y, dir);
    }

    if (steps>0){
      state.lastRollAt = now;
      // evita 'boost' de movimento logo apos rolar
      state.lastMoveAt = now;
      state.player.nextMoveAt = now + (state.player.moveLockMs||220);
      state.rollFlash=Math.max(state.rollFlash||0,0.28);state.rollAnimT=0.32;
      sfxRoll();
      // micro screenshake "bom" (não incomoda)
      state.shakeT = Math.max(state.shakeT||0, 0.06);
      state.shakeMag = Math.max(state.shakeMag||0, 1.4);
    }
  }


function doSaraivada(){
  if (!state || !state.running) return;
  if (!state.saraivadaLevel || state.saraivadaLevel <= 0) return;
  if (state.player && state.player.hp <= 0) return;
  const now = performance.now();
  const mults = [0, 9, 7.5, 6, 4.5];
  const mult = mults[Math.min(state.saraivadaLevel, 4)] || 2.5;
  const cd = Math.round(state.shotCooldownMs * mult);
  if (now - state.lastSaraivadaAt < cd) return;
  state.lastSaraivadaAt = now;
  const p = state.player;
  const cx = p.x * TILE + TILE/2, cy = p.y * TILE + TILE/2;
  // 8 direções: cardinais + diagonais
  const dirs8 = [
    {x:0,y:-1},{x:1,y:-1},{x:1,y:0},{x:1,y:1},
    {x:0,y:1},{x:-1,y:1},{x:-1,y:0},{x:-1,y:-1}
  ];
  for (const d of dirs8){
    const len = Math.hypot(d.x, d.y) || 1;
    const vx = (d.x/len) * state.bulletSpeed;
    const vy = (d.y/len) * state.bulletSpeed;
    state.bullets.push({
      dir: d, px: cx, py: cy,
      vx, vy,
      speed: state.bulletSpeed,
      alive: true,
      pierceLeft: state.bulletPierce,
      bounceLeft: state.bulletBounce,
      dmg: 20,
      src: 'player'
    });
  }
  // Animação: spin do ponteiro + flash
  state.saraivadaSpinT = 0.32;
  state.saraivadaFlashT = 0.22;
  // Som: rajada rápida de bipes
  try{
    beep(600, 0.03, 'square', 0.05);
    setTimeout(()=>beep(800, 0.03, 'square', 0.05), 28);
    setTimeout(()=>beep(1000, 0.04, 'square', 0.06), 58);
    setTimeout(()=>beep(1200, 0.04, 'triangle', 0.07), 90);
    setTimeout(()=>beep(1000, 0.03, 'triangle', 0.05), 130);
    setTimeout(()=>beep(800, 0.03, 'triangle', 0.04), 165);
    setTimeout(()=>beep(600, 0.03, 'triangle', 0.04), 200);
    setTimeout(()=>beep(400, 0.04, 'sine', 0.04), 240);
  }catch(_){}
  updateHUD();
}

function tryShoot(){
    const now = performance.now();
    // Prevent shooting when the cowboy is down (HP zero)
    if (state.player && state.player.hp <= 0) return;
    // In coop, do not fire if the other cowboy is down and we are within
    // revival range. Holding the shoot button next to a fallen partner
    // should only revive them and not produce bullets. We rely on the
    // persistent player1 alias to identify the non‑active cowboy.
    if (state && state.coop){
      try{
        // Determine the other player relative to the current shooter. If
        // state.player2 exists and the current state.player is state.player2
        // then the other is player1; otherwise the other is player2.
        const other = (state.player2 && state.player === state.player2) ? state.player1 : state.player2;
        if (other && other.hp <= 0){
          const d = Math.abs(state.player.x - other.x) + Math.abs(state.player.y - other.y);
          if (d <= 1){
            return;
          }
        }
      }catch(_){}
    }

    // Mira aprimorada: aumenta o COOLDOWN (tempo entre tiros) quando existe alvo travado válido
    let targetRef = null;
    let effectiveCd = state.shotCooldownMs;
    if ((state.aimLevel||0) > 0 && state.target){
      targetRef = resolveTarget();
      if (targetRef){
        effectiveCd = Math.round(state.shotCooldownMs * aimSlowFactor());
      } else {
        state.target = null;
      }
    }

    if (now - state.lastShotAt < effectiveCd){
      if (state.bufferedShots < state.ammoBuffer-1){ state.bufferedShots++; }
      return;
    }
    state.lastShotAt = now;
    if (state.bufferedShots > 0) state.bufferedShots--;

    const p = state.player;
    const b = {
      dir: p.face,
      px: p.x * TILE + TILE/2,
      py: p.y * TILE + TILE/2,
      speed: state.bulletSpeed,
      alive: true,
      pierceLeft: state.bulletPierce,
      bounceLeft: state.bulletBounce,
      dmg: 20,
      src: 'player'
    };
    // Mira aprimorada: se houver alvo, tiro direto na direção do alvo (sem curva)
    if (targetRef){
      const tx = targetRef.x * TILE + TILE/2;
      const ty = targetRef.y * TILE + TILE/2;
      const dx = tx - b.px, dy = ty - b.py;
      const len = Math.hypot(dx, dy) || 1;
      b.vx = (dx/len) * state.bulletSpeed;
      b.vy = (dy/len) * state.bulletSpeed;
    }

    state.bullets.push(b);
    // Diferencia som do tiro para cada jogador em coop. Jogador 1 usa o
    // som padrão (grave), enquanto o Jogador 2 usa o mesmo som do parceiro
    // no single‑player (700 Hz). A duração e tipo de onda foram ajustados
    // para coincidir com o disparo do aliado.
    const p2Shot = (state.coop && state.player === state.player2);
    if (p2Shot){
      beep(700, 0.04, "square", 0.035);
    } else {
      beep(880, 0.06, "square", 0.04);
    }
    updateHUD();
  }

  // Aliado
  function spawnAlly(){
    const a = {
      type: 'partner',
      x: state.gold.x + randInt(-3,3),
      y: state.gold.y + randInt(-3,3),
      face: DIRS.up,
      moveTimer: 0,
      fireTimer: 0
    };
    a.x = Math.max(0, Math.min(GRID_W-1, a.x)); a.y = Math.max(0, Math.min(GRID_H-1, a.y));
    if (isBlocked(a.x,a.y)) { a.x = state.player.x; a.y = state.player.y; }
    state.allies.push(a);
  }
  // Cachorro (companheiro) — fareja assassinos e morde alvo em melee
  function getPartner(){
    for (const a of (state.allies||[])){ if (a && a.type === 'partner') return a; }
    return null;
  }

  const PARTNER_IR_VISION_COST = 2180;
  function getPlayerMaxMoveInterval(){
    let playerMaxMs = 220;
    for (let i = 0; i < 3; i++) playerMaxMs = Math.max(30, Math.round(playerMaxMs * 0.85));
    return playerMaxMs / 1000;
  }

  function lerpMoveInterval(level, maxLevel, baseSeconds){
    const lvl = Math.min(maxLevel, Math.max(1, level | 0));
    const t = maxLevel <= 1 ? 1 : (lvl - 1) / (maxLevel - 1);
    return baseSeconds + (getPlayerMaxMoveInterval() - baseSeconds) * t;
  }

  function getPartnerMoveInterval(level){
    return lerpMoveInterval(level, 10, 0.28);
  }

  function getDogMoveInterval(level){
    return lerpMoveInterval(level, 5, 0.18);
  }

  function getDogBiteCooldown(level){
    const lvl = Math.min(5, Math.max(1, level | 0));
    const baseCooldown = 0.45;
    const maxCooldown = baseCooldown * (getPlayerMaxMoveInterval() / 0.18);
    const t = (lvl - 1) / 4;
    return baseCooldown + (maxCooldown - baseCooldown) * t;
  }

  function getXerifeMoveInterval(level){
    return lerpMoveInterval(level, 5, 0.28);
  }

  /** Lógica compartilhada: loja e menu do parceiro (custo já descontado). */
  function applyAllyUpgradeCore(){
    const ALLY_MAX_LEVEL = 10;
    const p = getPartner();
    if (!p){
      spawnAlly();
      state._pendingAllyDialog = true;
      state.allyLevel = 1;
      return { ok: true };
    }
    if ((state.allyLevel||0) >= ALLY_MAX_LEVEL) return { err: 'max' };
    state.allyFireMs = Math.max(300, Math.round(state.allyFireMs*0.85));
    state.allyLevel = (state.allyLevel||0) + 1;
    return { ok: true };
  }

  function syncAllyShopCardUI(){
    if (state.coop) return;
    const btn = document.querySelector('button[data-action="ally"]');
    const span = document.querySelector('span[data-cost="ally"]');
    if (!btn || !span) return;
    const ALLY_MAX_LEVEL = 10;
    const p = getPartner();
    const lvl = state.allyLevel|0;
    if (!p){
      span.textContent = '275';
      if (btn.textContent === 'Máx.') btn.textContent = 'Comprar';
      btn.disabled = false;
      return;
    }
    if (lvl >= ALLY_MAX_LEVEL){
      btn.disabled = true;
      btn.textContent = 'Máx.';
      span.textContent = '—';
      return;
    }
    let c = 275;
    for (let i = 1; i < lvl; i++) c = Math.round((c + 100) / 5) * 5;
    const nextCost = Math.round((c + 100) / 5) * 5;
    span.textContent = String(nextCost);
    if (btn.textContent === 'Máx.') btn.textContent = 'Comprar';
    btn.disabled = false;
  }

  function playPartnerIrVisionPurchaseSfx(){
    try{
      const ac = getAudio();
      const t0 = ac.currentTime;
      const g0 = (settings.sfx != null ? settings.sfx : 1);
      const o1 = ac.createOscillator();
      o1.type = 'sawtooth';
      const gn1 = ac.createGain();
      o1.connect(gn1).connect(ac.destination);
      o1.frequency.setValueAtTime(120, t0);
      o1.frequency.exponentialRampToValueAtTime(2200, t0 + 0.38);
      gn1.gain.setValueAtTime(0.12 * g0, t0);
      gn1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);
      o1.start(t0);
      o1.stop(t0 + 0.44);
      const o2 = ac.createOscillator();
      o2.type = 'square';
      const gn2 = ac.createGain();
      o2.connect(gn2).connect(ac.destination);
      o2.frequency.setValueAtTime(1800, t0 + 0.05);
      o2.frequency.exponentialRampToValueAtTime(400, t0 + 0.22);
      gn2.gain.setValueAtTime(0, t0 + 0.05);
      gn2.gain.linearRampToValueAtTime(0.07 * g0, t0 + 0.08);
      gn2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
      o2.start(t0 + 0.05);
      o2.stop(t0 + 0.3);
      const o3 = ac.createOscillator();
      o3.type = 'sine';
      const gn3 = ac.createGain();
      o3.connect(gn3).connect(ac.destination);
      o3.frequency.setValueAtTime(660, t0 + 0.24);
      o3.frequency.setValueAtTime(880, t0 + 0.32);
      gn3.gain.setValueAtTime(0, t0 + 0.24);
      gn3.gain.linearRampToValueAtTime(0.14 * g0, t0 + 0.28);
      gn3.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
      o3.start(t0 + 0.24);
      o3.stop(t0 + 0.48);
    }catch(_){
      try{ beep(520, 0.1, 'triangle', 0.06); setTimeout(()=>beep(880, 0.08, 'square', 0.05), 90); }catch(__){}
    }
  }

  function spawnPartnerIrVisionPurchaseFX(px, py){
    const cx = px * TILE + TILE / 2;
    const cy = py * TILE + TILE / 2;
    for (let i = 0; i < 52; i++){
      const ang = (i / 52) * Math.PI * 2 + Math.random() * 0.35;
      const spd = 70 + Math.random() * 140;
      const life = 0.42 + Math.random() * 0.35;
      const col = i % 3 === 0 ? '#ff3018' : (i % 3 === 1 ? '#00e8ff' : '#fff4a0');
      state.fx.push({
        x: cx, y: cy,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 40,
        life, max: life,
        color: col,
        size: 2 + Math.random() * 2.5,
        grav: 120
      });
    }
    state.multiFlashT = Math.max(state.multiFlashT || 0, 0.34);
    state.multiFlashColor = '#ff5020';
    state.multiFlashAlpha = 0.24;
    state.shakeT = Math.min(0.35, (state.shakeT || 0) + 0.14);
    state.shakeMag = Math.max(1.4, state.shakeMag || 0);
  }
  function getDog(){
    for (const a of (state.allies||[])){ if (a && a.type === 'dog') return a; }
    return null;
  }
  function spawnDog(){
    const d = {
      type: 'dog',
      level: 1,
      x: state.gold.x + randInt(-2,2),
      y: state.gold.y + randInt(-2,2),
      face: DIRS.up,
      moveTimer: 0,
      biteTimer: 0,
      sniffing: false,
      sniffT: 0,
      sniffDur: 3,
      targetId: null
    };
    d.x = Math.max(0, Math.min(GRID_W-1, d.x)); d.y = Math.max(0, Math.min(GRID_H-1, d.y));
    if (isBlocked(d.x,d.y)) { d.x = state.player.x; d.y = state.player.y; }
    state.allies.push(d);
  }
  function setDogLevel(lvl){
    const d = getDog();
    if (!d) return;
    d.level = lvl;
    d.sniffDur = (lvl===1?3:(lvl===2?2:(lvl===3?1:(lvl===4?0.6:0.35))));
  }

  // ══════ XERIFE ══════════════════════════════════════════════════════════════
  function getXerife(){
    for(const a of (state.allies||[])){ if(a && a.type==='xerife') return a; }
    return null;
  }
  function spawnXerife(){
    const x0 = Math.max(0,Math.min(GRID_W-1, state.gold.x + randInt(-3,3)));
    const y0 = Math.max(0,Math.min(GRID_H-1, state.gold.y + randInt(-3,3)));
    const sh = {
      type: 'xerife',
      level: 1,
      x: x0, y: y0,
      face: DIRS.up,
      moveTimer: 0,
      ropeTimer: 0,   // ms acumulados para cooldown da corda
      shotTimer: 0,   // ms acumulados para tiro normal
      hidden: true
    };
    if(isBlocked(sh.x,sh.y)){ sh.x=state.player.x; sh.y=state.player.y; }
    state.allies.push(sh);
  }
  // Nível → cooldown de corda (ms) e duração do stun (s)
  function xerifeStats(lvl){
    // Nv1: rope 4000ms stun 2s | Nv2: 3200ms 2.5s | Nv3: 2400ms 3s | Nv4: 1600ms 4s | Nv5: 900ms 5s
    const ropes  = [4000, 3200, 2400, 1600, 900];
    const stuns  = [2.0,  2.5,  3.0,  4.0,  5.0];
    const l = Math.min(5, Math.max(1, lvl||1)) - 1;
    return { ropeCd: ropes[l], stunDur: stuns[l] };
  }
  function getDinamiteiro(){ for(const a of (state.allies||[])){ if(a&&a.type==='dinamiteiro') return a; } return null; }
  function spawnDinamiteiro(){
    const x0=Math.max(1,Math.min(GRID_W-2,state.gold.x+randInt(-3,3)));
    const y0=Math.max(1,Math.min(GRID_H-2,state.gold.y+randInt(-3,3)));
    const d={type:'dinamiteiro',level:1,x:x0,y:y0,face:DIRS.up,moveTimer:0,throwTimer:0,hidden:false};
    if(isBlocked(d.x,d.y)){d.x=state.player.x;d.y=state.player.y;}
    state.allies.push(d);
  }
  function dinamiteiroStats(lvl){
    // Nv1..4 (máx.): igual aos antigos Nv1..Nv4; o antigo Nv5 foi removido.
    const cds=[3100,2650,2250,1820];
    const halfRs=[1,2,3,4];
    const l=Math.min(4,Math.max(1,lvl||1))-1;
    return{cd:cds[l],halfR:halfRs[l]};
  }

  function getReparador(){ for(const a of (state.allies||[])){ if(a&&a.type==='reparador') return a; } return null; }
  function spawnReparador(){
    const x0=Math.max(0,Math.min(GRID_W-1,state.gold.x+randInt(-3,3)));
    const y0=Math.max(0,Math.min(GRID_H-1,state.gold.y+randInt(-3,3)));
    const r={
      type:'reparador',
      level:state.reparadorLevel||1,
      x:x0,y:y0,
      face:DIRS.up,
      moveTimer:0,
      _repairJob:null,
      _repairMs:0,
      _repairsForInstant: 0,
      _instantRepairReady: false
    };
    if(isBlocked(r.x,r.y)){ r.x=state.player.x; r.y=state.player.y; }
    state.allies.push(r);
  }
  function setReparadorLevel(lvl){
    const r=getReparador();
    if(r) r.level=lvl;
  }
  function reparadorRepairMs(lvl){
    const ms=[4000,2800,1900,1100,700];
    const l=Math.min(5,Math.max(1,lvl||1))-1;
    return ms[l];
  }
  const REPARADOR_INSTANT_UNLOCK_COST = 3700;
  function reparadorPlaceableNeedsRepair(kind, ref){
    if(!ref) return false;
    if(kind==='sentry'){
      const hp=ref.hp==null?4:ref.hp;
      return hp>0 && hp<4;
    }
    if(kind==='barricada') return ref.hp>0 && ref.hp<ref.maxHp;
    if(kind==='goldmine') return ref.hp>0 && ref.hp<ref.maxHp;
    if(kind==='espantalho'){
      if(ref.hp<=0) return false;
      const mx=espantalhoStats(ref.level||1).maxHp;
      return ref.hp<mx;
    }
    return false;
  }
  function reparadorHpFraction(kind, ref){
    if(kind==='sentry'){ const c=ref.hp==null?4:ref.hp; return c/4; }
    if(kind==='barricada') return ref.hp/ref.maxHp;
    if(kind==='goldmine') return ref.hp/ref.maxHp;
    if(kind==='espantalho') return ref.hp/espantalhoStats(ref.level||1).maxHp;
    return 1;
  }
  function reparadorNearestDamage(sx, sy){
    const cands=[];
    function pushCand(kind, ref, tx, ty){
      if(!reparadorPlaceableNeedsRepair(kind, ref)) return;
      cands.push({
        kind, ref, tx, ty,
        ratio: reparadorHpFraction(kind, ref),
        dist: Math.abs(tx-sx)+Math.abs(ty-sy)
      });
    }
    for(const t of state.sentries||[]) pushCand('sentry', t, t.x, t.y);
    for(const bar of state.barricadas||[]) pushCand('barricada', bar, bar.x, bar.y);
    for(const m of state.goldMines||[]) pushCand('goldmine', m, m.x, m.y);
    for(const esp of state.espantalhos||[]) pushCand('espantalho', esp, esp.x, esp.y);
    if(!cands.length) return null;
    cands.sort((a, b) => {
      if(a.ratio!==b.ratio) return a.ratio-b.ratio;
      return a.dist-b.dist;
    });
    const w=cands[0];
    return {kind:w.kind, ref:w.ref, tx:w.tx, ty:w.ty};
  }
  function reparadorPickStandTile(sx, sy, tx, ty){
    let best=null, bestD=1e9;
    for(let i=0;i<4;i++){
      const ax=tx+[1,-1,0,0][i], ay=ty+[0,0,1,-1][i];
      if(ax<0||ay<0||ax>=GRID_W||ay>=GRID_H) continue;
      if(isBlocked(ax,ay)) continue;
      const d=Math.abs(ax-sx)+Math.abs(ay-sy);
      if(d<bestD){ bestD=d; best={x:ax,y:ay}; }
    }
    return best;
  }
  function reparadorJobStillValid(job){
    if(!job||!job.ref) return false;
    if(job.kind==='sentry') return !!(state.sentries&&state.sentries.indexOf(job.ref)>=0) && reparadorPlaceableNeedsRepair('sentry', job.ref);
    if(job.kind==='barricada') return !!(state.barricadas&&state.barricadas.indexOf(job.ref)>=0) && reparadorPlaceableNeedsRepair('barricada', job.ref);
    if(job.kind==='goldmine') return !!(state.goldMines&&state.goldMines.indexOf(job.ref)>=0) && reparadorPlaceableNeedsRepair('goldmine', job.ref);
    if(job.kind==='espantalho') return !!(state.espantalhos&&state.espantalhos.indexOf(job.ref)>=0) && reparadorPlaceableNeedsRepair('espantalho', job.ref);
    return false;
  }
  function reparadorApplyHeal(job){
    if(!job||!job.ref) return;
    const r=job.ref;
    if(job.kind==='sentry') r.hp=4;
    else if(job.kind==='barricada') r.hp=r.maxHp;
    else if(job.kind==='goldmine') r.hp=r.maxHp;
    else if(job.kind==='espantalho') r.hp=espantalhoStats(r.level||1).maxHp;
  }

  // Alvo prioritário para corda: Vândalo vivo mais próximo
  function xerifePriorityVandal(sh){
    if(!state.bandits) return null;
    let best=null, bestD=1e9;
    for(const z of state.bandits){
      if(!z.alive||!z.vandal) continue;
      if(z.xerifeStunT && z.xerifeStunT>0) continue; // já stunado
      const d=Math.abs(z.x-sh.x)+Math.abs(z.y-sh.y);
      if(d<bestD){bestD=d;best=z;}
    }
    return best;
  }
  // Alvo normal (qualquer inimigo não-vândalo): mais ameaçador ao ouro
  function xerifePickNormal(sh){
    const _xb=_pickBoss(sh?sh.x:0,sh?sh.y:0); if(_xb) return _xb;
    if(!state.bandits) return null;
    const gx=state.gold.x, gy=state.gold.y;
    let best=null, bestS=1e9;
    for(const z of state.bandits){
      if(!z.alive||z.vandal||z.assassin||z.fantasma) continue;
      const dG=Math.abs(z.x-gx)+Math.abs(z.y-gy);
      const dA=Math.abs(z.x-sh.x)+Math.abs(z.y-sh.y);
      const s=dG*3+dA;
      if(s<bestS){bestS=s;best=z;}
    }
    return best;
  }
  // FX da corda voando (trail de segmentos dourado/bege)
  function spawnRopeTrailFX(x1,y1,x2,y2){
    const STEPS=6;
    for(let i=0;i<=STEPS;i++){
      const t=i/STEPS;
      const fx=x1*(1-t)+x2*t, fy=y1*(1-t)+y2*t;
      state.fx.push({x:fx,y:fy,vx:(Math.random()-0.5)*18,vy:(Math.random()-0.5)*18,
        life:0.32,max:0.32,color:(i%2===0)?'#c8a040':'#e8c870',size:2.2,grav:0});
    }
  }
  // FX da corda prendendo o vândalo (círculo de laços)
  function spawnRopeCatchFX(tx,ty){
    const cx=tx*TILE+TILE/2, cy=ty*TILE+TILE/2;
    for(let i=0;i<12;i++){
      const a=(Math.PI*2*i/12)+Math.random()*0.4;
      const spd=28+Math.random()*28;
      state.fx.push({x:cx,y:cy,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,
        life:0.55,max:0.55,color:(i%3===0)?'#c8a040':(i%3===1)?'#fff':'#e8c870',size:2.8,grav:0});
    }
  }
  // Som único da corda: whip crack + nota de laço
  function soundRopeThrow(){
    try{
      const ac=getAudio();
      const now=ac.currentTime;
      // ── Whip crack: ruído filtrado que varre de agudo para grave ──
      const dur=0.22;
      const nb=ac.createBuffer(1,Math.ceil(ac.sampleRate*dur),ac.sampleRate);
      const d=nb.getChannelData(0);
      for(let i=0;i<d.length;i++){
        // ruído com envelope em triângulo (pico no meio)
        const env=Math.sin((i/d.length)*Math.PI);
        d[i]=(Math.random()*2-1)*env;
      }
      const src=ac.createBufferSource(); src.buffer=nb;
      // highpass que desce rápido → simula "chicote"
      const hp=ac.createBiquadFilter(); hp.type='highpass';
      hp.frequency.setValueAtTime(3200,now);
      hp.frequency.exponentialRampToValueAtTime(320,now+dur);
      const g=ac.createGain(); g.gain.setValueAtTime(0.22*settings.sfx,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+dur);
      src.connect(hp).connect(g).connect(ac.destination);
      src.start(now); src.stop(now+dur+0.01);

      // ── Swoosh descendente (a corda voando) ──
      const o=ac.createOscillator(); o.type='sawtooth';
      const og=ac.createGain();
      o.connect(og).connect(ac.destination);
      o.frequency.setValueAtTime(520,now+0.02);
      o.frequency.exponentialRampToValueAtTime(140,now+0.18);
      og.gain.setValueAtTime(0.10*settings.sfx,now+0.02);
      og.gain.exponentialRampToValueAtTime(0.001,now+0.2);
      o.start(now+0.02); o.stop(now+0.22);
    }catch(_){}
  }
  function soundRopeCatch(){
    try{
      const ac=getAudio();
      const now=ac.currentTime;
      // Thud grave (laço apertando)
      const o1=ac.createOscillator(); o1.type='sine';
      const g1=ac.createGain();
      o1.connect(g1).connect(ac.destination);
      o1.frequency.setValueAtTime(180,now);
      o1.frequency.exponentialRampToValueAtTime(60,now+0.12);
      g1.gain.setValueAtTime(0.18*settings.sfx,now);
      g1.gain.exponentialRampToValueAtTime(0.001,now+0.14);
      o1.start(now); o1.stop(now+0.16);
      // Click de impacto
      const o2=ac.createOscillator(); o2.type='square';
      const g2=ac.createGain();
      o2.connect(g2).connect(ac.destination);
      o2.frequency.setValueAtTime(280,now);
      g2.gain.setValueAtTime(0.10*settings.sfx,now);
      g2.gain.exponentialRampToValueAtTime(0.001,now+0.06);
      o2.start(now); o2.stop(now+0.07);
    }catch(_){}
  }
  // ═══════════════════════════════════════════════════════════════════════════
  function dogPickAssassin(){
    if (!state.bandits) return null;
    const d = getDog();
    if (!d) return null;
    let best=null, bestDist=1e9;
    for (const z of state.bandits){
      if (!z.alive || !z.assassin) continue;
      const dist = Math.abs(z.x - d.x) + Math.abs(z.y - d.y);
      if (dist < bestDist){ bestDist = dist; best = z; }
    }
    return best;
  }
  function dogPickNormal(){
    const d = getDog();
    if (!d) return null;
    // Boss gets priority (like ally)
    const _db=_pickBoss(d?d.x:0,d?d.y:0); if(_db) return _db;
    if (!state.bandits) return null;
    let best=null, bestDist=1e9;
    for (const z of state.bandits){
      if (!z.alive) continue;
      if (z.assassin) continue;
      if (z.fantasma) continue; // cão não vê fantasmas
      const dist = Math.abs(z.x - d.x) + Math.abs(z.y - d.y);
      if (dist < bestDist){ bestDist = dist; best = z; }
    }
    return best;
  }
  function spawnDogTrailFX(tx, ty){
    const mapId = (state && state.mapId) || window.currentMapId || 'desert';
    const dustCol  = (mapId === 'snow') ? '#c8e0f0' : (mapId === 'swamp') ? '#3a6630' : (mapId === 'grass') ? '#a8b860' : '#c88830';
    const dustCol2 = (mapId === 'snow') ? '#e0eeff' : (mapId === 'swamp') ? '#5a8a48' : (mapId === 'grass') ? '#c8d880' : '#e0aa50';
    const cx = tx * TILE + TILE/2;
    const cy = ty * TILE + TILE - 6;
    // 6 partículas: 2 puffs centrais maiores + 4 laterais menores
    for (let i = 0; i < 6; i++){
      const side = (i % 2 === 0) ? -1 : 1;
      const big = i < 2;
      const spd = big ? (45 + Math.random()*25) : (25 + Math.random()*20);
      const offX = side * (1 + Math.random()*5);
      const offY = big ? 0 : (Math.random()*3);
      const life = big ? (0.28 + Math.random()*0.10) : (0.18 + Math.random()*0.08);
      const sz   = big ? (3 + Math.random()*1.5) : (1.8 + Math.random());
      const col  = big ? dustCol2 : dustCol;
      state.fx.push({ x: cx+offX, y: cy+offY, vx: side*spd*0.55, vy: -(14+Math.random()*14), life, max: life, color: col, size: sz, grav: 100 });
    }
  }
  function spawnDogClawFX(tx, ty){
    // 3 garras vermelhas em leque diagonal — simula arranhão
    const cx = tx * TILE + TILE/2;
    const cy = ty * TILE + TILE/2;
    const slashAngles = [-0.55, 0, 0.55];
    for (const baseAng of slashAngles){
      const ang = -Math.PI/2 + baseAng;
      for (let j = 0; j < 2; j++){
        const spd = 50 + Math.random()*40;
        const life = 0.20 + Math.random()*0.08;
        const offX = (Math.random()-0.5)*5, offY = (Math.random()-0.5)*4;
        state.fx.push({ x: cx+offX, y: cy+offY, vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd, life, max: life, color: '#e01010', size: 2.5, grav: 0 });
      }
    }
    // flash vermelho central
    state.fx.push({ x: cx, y: cy, vx: 0, vy: -15, life: 0.13, max:0.13, color:'#ff4444', size: 3.5, grav: 0 });
  }


  // Verifica linha de visão entre (x1,y1) e (x2,y2) em tiles usando Bresenham.
  // ─────────────────────────────────────────────────────────────
  // allyTileBlocked(tx,ty) — retorna true se um tile bloqueia balas
  // (paredes de mapa + sentries + goldmines + barricadas)
  // ─────────────────────────────────────────────────────────────
  function allyTileBlocked(tx, ty){
    if(!inBounds(tx,ty)) return true;
    if(state.map[ty][tx]!==0 && state.map[ty][tx]!==9) return true;
    if(state.sentries){
      for(const s of state.sentries){ if((s.hp==null?4:s.hp)>0&&s.x===tx&&s.y===ty) return true; }
    }
    if(state.goldMines){
      for(const m of state.goldMines){ if(m.hp>0&&m.x===tx&&m.y===ty) return true; }
    }
    if(state.barricadas){
      for(const b of state.barricadas){ if(b.hp>0&&b.x===tx&&b.y===ty) return true; }
    }
    return false;
  }

  /** Mesma regra que fantasmaStep: só tilemap (cactos, rochas, água…); atravessa barricada, torre, mina, espantalho. */
  function pistoleiroFantasmaTileBlocked(tx, ty){
    if (!inBounds(tx, ty)) return true;
    const tv = state.map[ty][tx];
    if (tv === 6) return true;
    return tv !== 0 && tv !== 9;
  }

  // ─────────────────────────────────────────────────────────────
  // LOS em 3 raios (centro ± margem) — tileBlockedFn decide o que bloqueia.
  // ─────────────────────────────────────────────────────────────
  function rayProjectileLosClear(x1, y1, x2, y2, tileBlockedFn){
    const TILE_H = TILE;
    const MARGIN = 3;
    const STEP = TILE_H * 0.35;
    const cx1 = x1 * TILE_H + TILE_H / 2, cy1 = y1 * TILE_H + TILE_H / 2;
    const cx2 = x2 * TILE_H + TILE_H / 2, cy2 = y2 * TILE_H + TILE_H / 2;
    const ddx = cx2 - cx1, ddy = cy2 - cy1;
    const dist = Math.hypot(ddx, ddy);
    if (dist < 1) return true;
    const ux = ddx / dist, uy = ddy / dist;
    const px = -uy, py = ux;
    for (let ray = 0; ray < 3; ray++){
      const off = (ray === 0 ? 0 : ray === 1 ? MARGIN : -MARGIN);
      const ox = px * off, oy = py * off;
      for (let s = TILE_H * 0.55; s <= dist - TILE_H * 0.55; s += STEP){
        const wx = cx1 + ux * s + ox;
        const wy = cy1 + uy * s + oy;
        const tx = Math.floor(wx / TILE_H);
        const ty = Math.floor(wy / TILE_H);
        if (tileBlockedFn(tx, ty)) return false;
      }
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // allyHasLOS — simula EXATAMENTE o mesmo raycasting que a bala
  // usa (Math.floor pixel/TILE). Testa o centro da trajetória
  // + dois raios paralelos deslocados ±MARGIN pixels perpendicular
  // à direção, para cobrir a largura real do projétil.
  // Retorna true apenas se TODAS as 3 linhas estão livres.
  // ─────────────────────────────────────────────────────────────
  function allyHasLOS(x1, y1, x2, y2){
    return rayProjectileLosClear(x1, y1, x2, y2, allyTileBlocked);
  }

  function pistoleiroFantasmaHasLOS(x1, y1, x2, y2){
    return rayProjectileLosClear(x1, y1, x2, y2, pistoleiroFantasmaTileBlocked);
  }

  // ─────────────────────────────────────────────────────────────
  // allyFindFiringPos — BFS a partir da posição do aliado para
  // encontrar a firing position ótima para um alvo.
  //
  // "Ótima" = tile livre com LOS garantida, pontuado por:
  //   score = distToAlly*1.0 + distToTarget*0.4
  // O melhor score define o tile preferido.
  // Explora todos os tiles acessíveis dentro de maxDist,
  // depois escolhe o melhor score global (não para no primeiro).
  // ─────────────────────────────────────────────────────────────
  function allyFindFiringPos(ax, ay, tx, ty, maxDist){
    const W=GRID_W, H=GRID_H;
    const visited = new Uint8Array(W*H);
    const distArr = new Uint8Array(W*H);
    const start   = ax + ay*W;
    visited[start]=1; distArr[start]=0;
    const q=[start];
    let head=0;
    const DX=[1,-1,0,0], DY=[0,0,1,-1];

    let best=null, bestScore=1e9;

    while(head<q.length){
      const cur=q[head++];
      const cx=cur%W, cy=(cur/W)|0;
      const d=distArr[cur];
      if(d>maxDist) { head++; continue; }

      // candidato válido?
      if(!isBlocked(cx,cy) && cx>0&&cy>0&&cx<W-1&&cy<H-1
         && allyHasLOS(cx,cy,tx,ty)){
        const dAlly   = d; // BFS dist from ally = tiles to walk
        const dTarget = Math.abs(cx-tx)+Math.abs(cy-ty);
        // penaliza posições muito próximas ao inimigo (risco de melee) ou muito longe
        const rangePenalty = dTarget<2 ? 4 : dTarget>10 ? (dTarget-10)*0.5 : 0;
        const score = dAlly * 1.0 + dTarget * 0.4 + rangePenalty;
        if(score < bestScore){ bestScore=score; best={x:cx,y:cy}; }
      }

      for(let i=0;i<4;i++){
        const nx=cx+DX[i], ny=cy+DY[i];
        if(nx<0||ny<0||nx>=W||ny>=H) continue;
        const nk=nx+ny*W;
        if(visited[nk]) continue;
        if(isBlocked(nx,ny)) continue;
        visited[nk]=1; distArr[nk]=d+1;
        q.push(nk);
      }
    }
    return best;
  }

  /** Igual a allyFindFiringPos, mas atravessa posicionáveis (fantasma). */
  function pistoleiroFindFiringPos(ax, ay, tx, ty, maxDist){
    const W = GRID_W, H = GRID_H;
    const visited = new Uint8Array(W * H);
    const distArr = new Uint8Array(W * H);
    const start = ax + ay * W;
    visited[start] = 1;
    distArr[start] = 0;
    const q = [start];
    let head = 0;
    const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
    let best = null, bestScore = 1e9;
    while (head < q.length){
      const cur = q[head++];
      const cx = cur % W, cy = (cur / W) | 0;
      const d = distArr[cur];
      if (d > maxDist){ head++; continue; }
      if (!pistoleiroFantasmaTileBlocked(cx, cy) && cx > 0 && cy > 0 && cx < W - 1 && cy < H - 1
        && pistoleiroFantasmaHasLOS(cx, cy, tx, ty)){
        const dAlly = d;
        const dTarget = Math.abs(cx - tx) + Math.abs(cy - ty);
        const rangePenalty = dTarget < 2 ? 4 : dTarget > 10 ? (dTarget - 10) * 0.5 : 0;
        const score = dAlly * 1.0 + dTarget * 0.4 + rangePenalty;
        if (score < bestScore){ bestScore = score; best = { x: cx, y: cy }; }
      }
      for (let i = 0; i < 4; i++){
        const nx = cx + DX[i], ny = cy + DY[i];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nk = nx + ny * W;
        if (visited[nk]) continue;
        if (pistoleiroFantasmaTileBlocked(nx, ny)) continue;
        visited[nk] = 1;
        distArr[nk] = d + 1;
        q.push(nk);
      }
    }
    return best;
  }

  /** BFS como bfsNextStep, mas só obstáculos do mapa (boss fantasma atravessa torre/barricada/etc.). */
  function pistoleiroBossBfsNextStep(sx, sy, tx, ty, avoidTarget, avoidGold){
    if (sx === tx && sy === ty) return null;
    const gx = state.gold ? state.gold.x : -1;
    const gy = state.gold ? state.gold.y : -1;
    const W = GRID_W, H = GRID_H;
    const start = sx + sy * W;
    const goal = tx + ty * W;
    const visited = new Uint8Array(W * H);
    const parent = new Int16Array(W * H).fill(-1);
    visited[start] = 1;
    const q = [start];
    let head = 0;
    let found = -1;
    const DX = [1, -1, 0, 0];
    const DY = [0, 0, 1, -1];
    outer: while (head < q.length){
      const cur = q[head++];
      const cx = cur % W, cy = (cur / W) | 0;
      for (let i = 0; i < 4; i++){
        const nx = cx + DX[i], ny = cy + DY[i];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nk = nx + ny * W;
        if (visited[nk]) continue;
        if (avoidTarget && nx === tx && ny === ty) continue;
        if (avoidGold && nx === gx && ny === gy) continue;
        if (pistoleiroFantasmaTileBlocked(nx, ny) || isBridgeMoveBlocked(cx, cy, nx, ny)) continue;
        visited[nk] = 1;
        parent[nk] = cur;
        if (nk === goal){ found = nk; break outer; }
        q.push(nk);
      }
    }
    if (found === -1) return null;
    let cur = found;
    let safety = W * H;
    while (parent[cur] !== start && parent[cur] !== -1 && safety-- > 0) cur = parent[cur];
    if (parent[cur] === -1 || safety <= 0) return null;
    return { x: cur % W, y: (cur / W) | 0 };
  }

  // Escolhe alvo prioritário: mais perigoso para o ouro

  // Retorna o boss mais próximo de (ax,ay) considerando boss2 dos Gêmeos.
  // Pistoleiro Fantasma só entra no “radar” com allowPistoleiroFantasma (parceiro + visão IR).
  function _pickBoss(ax,ay,opts){
    opts = opts || {};
    const allowPF = !!opts.allowPistoleiroFantasma;
    function cand(b){
      if (!b || !b.alive) return null;
      if (b.name === "Pistoleiro Fantasma" && !allowPF) return null;
      return b;
    }
    const b1 = cand(state.boss && state.boss.alive ? state.boss : null);
    const b2 = cand(state.boss2 && state.boss2.alive ? state.boss2 : null);
    if(b1&&!b2) return b1;
    if(b2&&!b1) return b2;
    if(b1&&b2){
      const d1=Math.abs(b1.x-ax)+Math.abs(b1.y-ay);
      const d2=Math.abs(b2.x-ax)+Math.abs(b2.y-ay);
      return d1<=d2?b1:b2;
    }
    return null;
  }
  function allyPickTarget(a){
    const _ab=_pickBoss(a?a.x:0,a?a.y:0,{allowPistoleiroFantasma:!!state.partnerIrVision}); if(_ab) return _ab;
    if(!state.bandits||!a) return null;
    // Sem visão IR: assassinos e fantasmas invisíveis para o parceiro
    const alive = state.partnerIrVision
      ? state.bandits.filter(z=>z.alive)
      : state.bandits.filter(z=>z.alive&&!z.assassin&&!z.fantasma);
    if(!alive.length) return null;
    const gx=state.gold.x, gy=state.gold.y;
    let best=null, bestScore=1e9;
    for(const z of alive){
      // Prioridade: distância ao ouro (maior ameaça) + leve peso da distância ao aliado
      const dGold=Math.abs(z.x-gx)+Math.abs(z.y-gy);
      const dAlly=Math.abs(z.x-a.x)+Math.abs(z.y-a.y);
      const score=dGold*3+dAlly;
      if(score<bestScore){bestScore=score;best=z;}
    }
    return best;
  }

  function alliesThink(dt){
    const DIRS4 = [DIRS.up, DIRS.down, DIRS.left, DIRS.right];
    const gx = state.gold.x, gy = state.gold.y;
    for (const a of state.allies){
      a.moveTimer += dt;
      a.fireTimer += dt * 1000;
      // Cachorro: lógica própria (melee + farejo)
      if (a && a.type === 'dog'){
        // garantir parâmetros por nível
        a.level = a.level || 1;
        a.sniffDur = (a.level===1?3:(a.level===2?2:(a.level===3?1:(a.level===4?0.6:0.35))));
        // Assassinos dentro de 10 tiles (Manhattan) ativam modo farejo
        const SNIFF_RANGE = 10;
        const nearbyAssassin = state.bandits && state.bandits.find(z =>
          z.alive && z.assassin &&
          Math.abs(z.x - a.x) + Math.abs(z.y - a.y) <= SNIFF_RANGE
        );
        let target = null;
        if (nearbyAssassin){
          if (!a.targetId){
            if (!a.sniffing){ a.sniffing = true; a.sniffT = 0;
              pushMultiPopup('FAREJANDO!', '#f3d23b', a.x*TILE + TILE/2, a.y*TILE - 4);
            }
            a.sniffT += dt;
            if (a.sniffT >= a.sniffDur){
              a.sniffing = false; a.sniffT = 0;
              const ass = dogPickAssassin();
              if (ass) a.targetId = ass.id;
            } else { continue; }
          }
          target = state.bandits.find(z=>z.alive && z.assassin && z.id===a.targetId) || null;
          if (!target){ a.targetId = null; continue; }
        } else {
          a.sniffing = false; a.sniffT = 0; a.targetId = null;
          target = dogPickNormal();
          if (!target) continue;
        }

        // Movimento rápido — para adjacente ao alvo (nunca pisa no tile do inimigo)
        const stepEvery = getDogMoveInterval(a.level || 1);
        if (a.moveTimer >= stepEvery){
          a.moveTimer = 0;
          const ax=a.x, ay=a.y;
          const md = Math.abs(target.x-ax) + Math.abs(target.y-ay);
          if (md > 1){
            // avoidTarget=false porque o BFS com true nunca encontra o goal;
            // prevenimos pisar no alvo checando o step retornado
            const step = bfsNextStep(ax, ay, target.x, target.y, false, false);
            if (step && !(step.x===target.x && step.y===target.y)){
              const fdx=step.x-ax, fdy=step.y-ay;
              a.face = Math.abs(fdx)>=Math.abs(fdy)?(fdx>0?DIRS.right:DIRS.left):(fdy>0?DIRS.down:DIRS.up);
              a.x=step.x; a.y=step.y;
              spawnDogTrailFX(ax, ay);
            } else {
              // Já adjacente ou BFS não retornou passo além do alvo — só vira a cara
              const fdx=target.x-ax, fdy=target.y-ay;
              a.face = Math.abs(fdx)>=Math.abs(fdy)?(fdx>0?DIRS.right:DIRS.left):(fdy>0?DIRS.down:DIRS.up);
            }
          } else if (md === 1){
            const fdx=target.x-ax, fdy=target.y-ay;
            a.face = Math.abs(fdx)>=Math.abs(fdy)?(fdx>0?DIRS.right:DIRS.left):(fdy>0?DIRS.down:DIRS.up);
          }
        }

        // Ataque (mordida/garras)
        a.biteTimer = (a.biteTimer||0) + dt;
        const md2 = Math.abs(target.x-a.x) + Math.abs(target.y-a.y);
        if (md2 <= 1 && a.biteTimer >= getDogBiteCooldown(a.level || 1)){
          a.biteTimer = 0;
          spawnDogClawFX(target.x, target.y);
          beep(260,0.06,'square',0.04);

          // Boss: mesma lógica de morte usada pelos projéteis
          if(state.boss2&&state.boss2.alive&&target===state.boss2){
            state.boss2.hp=Math.max(0,state.boss2.hp-20);
            if(state.boss2.hp<=0){
              state.boss2.alive=false; spawnAllyDeathFX(state.boss2.x,state.boss2.y,true);
              beep(220,0.12,'square',0.06); addScore('dog',38);
              if(state.boss&&state.boss.alive){
                state.boss._enraged=true;state.boss.speedMul=3.74;state.boss._stepSkip2=0;
                pushMultiPopup('FÚRIA!','#ff2020',state.boss.x*TILE+TILE/2,state.boss.y*TILE-4);
                try{const _r2=document.getElementById('geminiRow2');if(_r2)_r2.style.display='none';}catch(_){}
              } else {
                try{const _gbw=document.getElementById('geminiBarsWrap');if(_gbw)_gbw.style.display='none';const _bmr=document.getElementById('bossRowMain');if(_bmr)_bmr.style.display='flex';const _r1r=document.getElementById('geminiRow1');if(_r1r)_r1r.style.display='flex';const _r2r=document.getElementById('geminiRow2');if(_r2r)_r2r.style.display='flex';}catch(_){}
                musicStop();musicStart();endWave();
              }
            } else {
              spawnBossHitFX(state.boss2.x,state.boss2.y); beep(240,0.05,'triangle',0.03);
              try{document.getElementById('geminiBar2Fill').style.width=Math.max(0,state.boss2.hp/state.boss2.maxhp*100).toFixed(0)+'%';}catch(_){}
            }
          } else if (state.boss && state.boss.alive && target === state.boss){
            state.boss.hp = Math.max(0, state.boss.hp - 20);
            if (state.boss.hp <= 0){
              state.boss.alive = false;
              beep(220,0.12,'square',0.06); beep(196,0.18,'square',0.06);
              if(state.boss.name==="Os Gêmeos" && state.boss2 && state.boss2.alive){
                spawnAllyDeathFX(state.boss.x,state.boss.y,true);
                addScore('dog',38);
                state.boss2._enraged=true; state.boss2.speedMul=3.74; state.boss2._stepSkip=0;
                pushMultiPopup('FÚRIA!','#ff2020',state.boss2.x*TILE+TILE/2,state.boss2.y*TILE-4);
                try{const _r1=document.getElementById('geminiRow1');if(_r1)_r1.style.display='none';}catch(_){}
              } else {
                spawnAllyDeathFX(state.boss.x, state.boss.y, true);
                addScore('dog', state.boss.name==="Os Gêmeos"?38:Math.floor(150/2));
                try{bossBarFill.style.width='0%';const _g=document.getElementById('geminiBarsWrap');if(_g)_g.style.display='none';}catch(_){}
                musicStop(); musicStart(); endWave();
              }
            } else {
              spawnBossHitFX(state.boss.x, state.boss.y);
              beep(240,0.05,'triangle',0.03);
              const _bpct = Math.max(0, state.boss.hp/state.boss.maxhp)*100;
              if(state.boss.name!=="Os Gêmeos") bossBarFill.style.width = _bpct.toFixed(0)+'%';
              else try{document.getElementById('geminiBar1Fill').style.width=_bpct.toFixed(0)+'%';}catch(_){}
            }
          } else {
            // Bandidos normais / assassinos
            if (typeof target.hp === 'number'){
              target.hp = Math.max(0, target.hp - 20);
              if (target.hp <= 0){ target.alive = false; state.enemiesAlive--; }
            } else { target.alive = false; state.enemiesAlive--; }
            if (!target.alive){
              spawnAllyDeathFX(target.x, target.y, false);
              addScore('dog', (typeof target.hp === 'number') ? 6 : 5);
              if (nearbyAssassin){ a.targetId = null; }
            }
          }
        }
        continue;
      }



      // ── XERIFE ──────────────────────────────────────────────────────────────
      if(a && a.type==='xerife'){
        const shStats = xerifeStats(a.level||1);
        a.ropeTimer  = (a.ropeTimer||0)  + dt*1000;
        a.shotTimer  = (a.shotTimer||0)  + dt*1000;
        a.moveTimer  = (a.moveTimer||0);

        // Decrementa stun nos vândalos
        if(state.bandits){
          for(const z of state.bandits){
            if(z.xerifeStunT && z.xerifeStunT>0){
              z.xerifeStunT -= dt;
              if(z.xerifeStunT<=0){ z.xerifeStunT=0; z.xerifeStunned=false; }
            }
          }
        }

        // Alvo para corda (vândalo) e alvo normal
        const vandalTarget = xerifePriorityVandal(a);
        const normalTarget = xerifePickNormal(a);
        // Se há vândalo, o alvo de movimento é ele; senão o normal
        const moveTarget = vandalTarget || normalTarget;

        // ── MOVIMENTO — cópia exata do Sharp Shooter do Parceiro ──────────
        const MOVE_INTERVAL = getXerifeMoveInterval(a.level || 1);
        if(a.moveTimer >= MOVE_INTERVAL){
          a.moveTimer = 0;
          if(moveTarget){
            const hasLOS = allyHasLOS(a.x, a.y, moveTarget.x, moveTarget.y);
            if(hasLOS){
              // AIM: tem LOS, ajusta para alinhamento axial
              a._fpStale = false; a._fpTarget = moveTarget.id;
              const toBx=moveTarget.x-a.x, toBy=moveTarget.y-a.y;
              const ang=Math.atan2(Math.abs(toBy),Math.abs(toBx));
              const axialDeviation=Math.min(ang,Math.PI/2-ang);
              if(axialDeviation>0.35){
                let bestAdj=null, bestDev=axialDeviation;
                for(let i=0;i<4;i++){
                  const nx=a.x+[1,-1,0,0][i], ny=a.y+[0,0,1,-1][i];
                  if(isBlocked(nx,ny)||nx<=0||ny<=0||nx>=GRID_W-1||ny>=GRID_H-1) continue;
                  if(!allyHasLOS(nx,ny,moveTarget.x,moveTarget.y)) continue;
                  const dx2=moveTarget.x-nx, dy2=moveTarget.y-ny;
                  const a2=Math.atan2(Math.abs(dy2),Math.abs(dx2));
                  const dev2=Math.min(a2,Math.PI/2-a2);
                  if(dev2<bestDev){bestDev=dev2;bestAdj={x:nx,y:ny};}
                }
                if(bestAdj){
                  const fdx=bestAdj.x-a.x,fdy=bestAdj.y-a.y;
                  a.face=Math.abs(fdx)>=Math.abs(fdy)?(fdx>0?DIRS.right:DIRS.left):(fdy>0?DIRS.down:DIRS.up);
                  a.x=bestAdj.x; a.y=bestAdj.y;
                }
              }
              const toBx2=moveTarget.x-a.x,toBy2=moveTarget.y-a.y;
              if(Math.abs(toBx2)>=Math.abs(toBy2)) a.face=toBx2>0?DIRS.right:DIRS.left;
              else a.face=toBy2>0?DIRS.down:DIRS.up;
            } else {
              // HUNT: sem LOS, navega para firing position
              const targetChanged=(a._fpTarget!==moveTarget.id);
              const atFP=(a._fpx!=null&&a._fpx===a.x&&a._fpy===a.y);
              const needRecalc=targetChanged||a._fpStale||(atFP&&!allyHasLOS(a.x,a.y,moveTarget.x,moveTarget.y))||a._fpx==null;
              if(needRecalc){
                const fp=allyFindFiringPos(a.x,a.y,moveTarget.x,moveTarget.y,20);
                a._fpx=fp?fp.x:null; a._fpy=fp?fp.y:null;
                a._fpTarget=moveTarget.id; a._fpStale=false;
              }
              if(a._fpx!=null&&!(a._fpx===a.x&&a._fpy===a.y)){
                const step=bfsNextStep(a.x,a.y,a._fpx,a._fpy,false,false);
                if(step){
                  const fdx=step.x-a.x,fdy=step.y-a.y;
                  a.face=Math.abs(fdx)>=Math.abs(fdy)?(fdx>0?DIRS.right:DIRS.left):(fdy>0?DIRS.down:DIRS.up);
                  a.x=step.x; a.y=step.y;
                } else { a._fpx=null; }
              }
            }
          } else {
            // IDLE: sem inimigos, patrulha perto do ouro
            a._fpx=null; a._fpy=null; a._fpTarget=null; a._fpStale=false;
            const distToGold=Math.abs(a.x-gx)+Math.abs(a.y-gy);
            if(distToGold>4){
              const step=bfsNextStep(a.x,a.y,gx,gy,true,true);
              if(step){const fdx=step.x-a.x,fdy=step.y-a.y;a.face=Math.abs(fdx)>=Math.abs(fdy)?(fdx>0?DIRS.right:DIRS.left):(fdy>0?DIRS.down:DIRS.up);a.x=step.x;a.y=step.y;}
            } else {
              const d=DIRS4[randInt(0,3)];const nx=a.x+d.x,ny=a.y+d.y;
              if(!isBlocked(nx,ny)&&nx>0&&ny>0&&nx<GRID_W-1&&ny<GRID_H-1){a.x=nx;a.y=ny;a.face=d;}
            }
          }
        }

        // ── Lançar corda num vândalo ──────────────────────────────────────
        if(vandalTarget && a.ropeTimer >= shStats.ropeCd){
          const bx=vandalTarget.x*TILE+TILE/2, by=vandalTarget.y*TILE+TILE/2;
          const ox=a.x*TILE+TILE/2, oy=a.y*TILE+TILE/2;
          const fdx=vandalTarget.x-a.x, fdy=vandalTarget.y-a.y;
          if(Math.abs(fdx)>=Math.abs(fdy)) a.face=fdx>0?DIRS.right:DIRS.left;
          else a.face=fdy>0?DIRS.down:DIRS.up;
          if(!allyHasLOS(a.x,a.y,vandalTarget.x,vandalTarget.y)){
            a._fpStale=true;
          } else {
            a.ropeTimer=0;
            if(!state._ropeProjectiles) state._ropeProjectiles=[];
            state._ropeProjectiles.push({
              x1:ox,y1:oy, x2:bx,y2:by,
              t:0, dur:0.22,
              target: vandalTarget
            });
            soundRopeThrow();
            const _zRef=vandalTarget;
            const _stunDur=shStats.stunDur;
            setTimeout(()=>{
              try{
                if(_zRef&&_zRef.alive){
                  _zRef.xerifeStunT   = _stunDur;
                  _zRef.xerifeStunned = true;
                  spawnRopeCatchFX(_zRef.x,_zRef.y);
                  soundRopeCatch();
                  pushMultiPopup('PRENDEU!','#f3d23b',_zRef.x*TILE+TILE/2,_zRef.y*TILE-4);
                }
              }catch(_){}
            }, 220);
          }
        }

        // ── Tiro normal (sem vândalos) — usa mesmo timer que o parceiro ──
        if(!vandalTarget && normalTarget && a.shotTimer >= 1000){
          const bx=normalTarget.x*TILE+TILE/2, by=normalTarget.y*TILE+TILE/2;
          const ox=a.x*TILE+TILE/2, oy=a.y*TILE+TILE/2;
          const ddx=bx-ox, ddy=by-oy;
          if(Math.abs(ddx)>=Math.abs(ddy)) a.face=ddx>0?DIRS.right:DIRS.left;
          else a.face=ddy>0?DIRS.down:DIRS.up;
          if(allyHasLOS(a.x,a.y,normalTarget.x,normalTarget.y)){
            a.shotTimer=0;
            const dlen=Math.hypot(ddx,ddy)||1;
            state.bullets.push({
              dir:a.face, px:ox, py:oy,
              vx:(ddx/dlen)*state.bulletSpeed*0.9,
              vy:(ddy/dlen)*state.bulletSpeed*0.9,
              speed:state.bulletSpeed*0.9,
              alive:true, pierceLeft:0, dmg:10, src:'xerife'
            });
            beep(660,0.04,'square',0.04);
          } else { a._fpStale=true; }
        }
        continue;
      }

      // ── DINAMITEIRO ──────────────────────────────────────────────────────────
      if(a && a.type==='dinamiteiro'){
        const _dmLv=Math.min(4,Math.max(1,state.dinamiteiroLevel||a.level||1));
        a.level=_dmLv;
        const dmStats=dinamiteiroStats(_dmLv);
        a.throwTimer=(a.throwTimer||0)+dt*1000;
        a.moveTimer=(a.moveTimer||0)+dt;
        // ── Movimento: waypoint aleatório pelo mapa ──────────────────
        // Passo a cada 0.35s. avoidTarget=false sempre para garantir
        // que bfsNextStep nunca retorna null por causa do skip do goal.
        if(a.moveTimer>=0.47){
          a.moveTimer=0;
          // Precisa de novo waypoint?
          const _arrived = (a._wptX!=null &&
            a.x===a._wptX && a.y===a._wptY);
          const _noWpt = (a._wptX==null);
          a._wptFail=(a._wptFail||0);
          if(_noWpt || _arrived || a._wptFail>=6){
            a._wptFail=0;
            // Escolhe tile livre aleatório com distância mínima de 4
            let _found=false;
            for(let _wi=0;_wi<30;_wi++){
              const _wx=1+randInt(0,GRID_W-3), _wy=1+randInt(0,GRID_H-3);
              if(!isBlocked(_wx,_wy) && (_wx!==a.x||_wy!==a.y) &&
                 Math.abs(_wx-a.x)+Math.abs(_wy-a.y)>=4){
                a._wptX=_wx; a._wptY=_wy; _found=true; break;
              }
            }
            if(!_found){a._wptX=state.gold.x;a._wptY=state.gold.y;}
          }
          // BFS passo único — avoidTarget=false, goal é o waypoint (tile livre)
          const step=bfsNextStep(a.x,a.y,a._wptX,a._wptY,false,false);
          if(step){
            a._wptFail=0;
            a.face=Math.abs(step.x-a.x)>=Math.abs(step.y-a.y)?
              (step.x>a.x?DIRS.right:DIRS.left):(step.y>a.y?DIRS.down:DIRS.up);
            a.x=step.x; a.y=step.y;
          } else {
            // Caminho bloqueado: conta falha e troca de waypoint na próxima tick
            a._wptFail++;
          }
        }
        // Lançar bomba
        if(a.throwTimer>=dmStats.cd){
          let bestTile=null,bestCount=-1;
          if(state.bandits){
            const checked=new Set();
            for(const z of state.bandits){
              if(!z.alive||z.assassin||z.fantasma)continue; // assassinos e fantasmas invisíveis
              const key=z.x+','+z.y;
              if(checked.has(key))continue; checked.add(key);
              let count=0;
              for(const z2 of state.bandits){
                if(!z2.alive||z2.assassin||z2.fantasma)continue;
                if(Math.abs(z2.x-z.x)<=dmStats.halfR&&Math.abs(z2.y-z.y)<=dmStats.halfR)count++;
              }
              if(count>bestCount){bestCount=count;bestTile={x:z.x,y:z.y};}
            }
          }
          // Fallback: boss vivo (exceto Pistoleiro Fantasma — invisível p/ companheiros)
          if(!bestTile && state.boss && state.boss.alive && state.boss.name !== "Pistoleiro Fantasma"){
            bestTile={x:state.boss.x, y:state.boss.y}; bestCount=1;
          }
          if(bestTile&&bestCount>0){
            a.throwTimer=0;
            const fdx=bestTile.x-a.x,fdy=bestTile.y-a.y;
            if(Math.abs(fdx)>=Math.abs(fdy))a.face=fdx>=0?DIRS.right:DIRS.left;
            else a.face=fdy>=0?DIRS.down:DIRS.up;
            if(!state.dinamiteiroBombs)state.dinamiteiroBombs=[];
            state.dinamiteiroBombs.push({x:bestTile.x,y:bestTile.y,halfR:dmStats.halfR,fuseT:0,fuseDur:2.0,_lastFlash:0,fromX:a.x,fromY:a.y,flyT:0,flyDur:0.35});
            try{beep(300,0.05,'square',0.04);setTimeout(()=>beep(200,0.06,'sawtooth',0.04),80);}catch(_){}
          }
        }
        continue;
      }

      // ── REPARADOR ──────────────────────────────────────────────────────────
      if(a && a.type==='reparador'){
        if(a._repairsForInstant==null) a._repairsForInstant=0;
        if(a._instantRepairReady==null) a._instantRepairReady=false;
        if(!state.reparadorInstantUnlocked){
          a._repairsForInstant=0;
          a._instantRepairReady=false;
        }
        const lvl=Math.min(5,Math.max(1,state.reparadorLevel||a.level||1));
        a.level=lvl;
        const repairNeedMs=reparadorRepairMs(lvl);
        if(a._repairJob && !reparadorJobStillValid(a._repairJob)){
          a._repairJob=null;
          a._repairMs=0;
        }
        const job=a._repairJob;
        const mdJob=(job&&job.tx!=null)?(Math.abs(a.x-job.tx)+Math.abs(a.y-job.ty)):999;
        if(job && mdJob<=1){
          const fdx=job.tx-a.x, fdy=job.ty-a.y;
          a.face=Math.abs(fdx)>=Math.abs(fdy)?(fdx>0?DIRS.right:DIRS.left):(fdy>0?DIRS.down:DIRS.up);
          if(state.reparadorInstantUnlocked && a._instantRepairReady){
            if(reparadorJobStillValid(job)){
              reparadorApplyHeal(job);
              try{
                const g=window._G;
                if(typeof window._doRepairFX==='function') window._doRepairFX(g, job.tx, job.ty);
              }catch(_){}
              try{ pushMultiPopup('REPARO INSTANTÂNEO!','#66ffcc', a.x*TILE+TILE/2, a.y*TILE-14); }catch(_){}
              try{ beep(880,0.06,'triangle',0.05); setTimeout(()=>beep(1040,0.08,'triangle',0.06),60); }catch(_){}
              a._instantRepairReady=false;
            }
            a._repairJob=null;
            a._repairMs=0;
            continue;
          }
          a._repairMs=(a._repairMs||0)+dt*1000;
          if(a._repairMs>=repairNeedMs){
            if(reparadorJobStillValid(job)){
              reparadorApplyHeal(job);
              try{
                const g=window._G;
                if(typeof window._doRepairFX==='function') window._doRepairFX(g, job.tx, job.ty);
              }catch(_){}
              try{ toastMsg('Reparador consertou uma estrutura!'); }catch(_){}
              if(state.reparadorInstantUnlocked){
                a._repairsForInstant=(a._repairsForInstant|0)+1;
                if(a._repairsForInstant>=3){
                  a._repairsForInstant=0;
                  a._instantRepairReady=true;
                }
              }
            }
            a._repairJob=null;
            a._repairMs=0;
          }
          continue;
        }
        if(a._repairMs>0 && mdJob>1) a._repairMs=0;
        if(!job || !reparadorJobStillValid(job)){
          a._repairJob=reparadorNearestDamage(a.x,a.y);
          a._repairMs=0;
        }
        const job2=a._repairJob;
        if(!job2){
          if(a.moveTimer>=0.42){
            a.moveTimer=0;
            const d=DIRS4[randInt(0,3)];
            const nx=a.x+d.x, ny=a.y+d.y;
            if(!isBlocked(nx,ny)&&nx>0&&ny>0&&nx<GRID_W-1&&ny<GRID_H-1){ a.x=nx; a.y=ny; a.face=d; }
          }
          continue;
        }
        const stand=reparadorPickStandTile(a.x,a.y,job2.tx,job2.ty);
        if(!stand){
          a._repairJob=null;
          continue;
        }
        if(a.moveTimer>=0.30){
          a.moveTimer=0;
          if(a.x!==stand.x||a.y!==stand.y){
            const step=bfsNextStep(a.x,a.y,stand.x,stand.y,false,false);
            if(step){
              const fdx=step.x-a.x, fdy=step.y-a.y;
              a.face=Math.abs(fdx)>=Math.abs(fdy)?(fdx>0?DIRS.right:DIRS.left):(fdy>0?DIRS.down:DIRS.up);
              a.x=step.x; a.y=step.y;
            } else {
              a._repairJob=null;
            }
          }
        }
        continue;
      }
      //
      // Estados:
      //   HUNT  — sem LOS, navega para firing position calculada
      //           por allyFindFiringPos (BFS + avaliação de score)
      //   AIM   — tem LOS, verifica 3 raios antes de atirar.
      //           Se qualquer raio está bloqueado, procura tile
      //           adjacente com melhor alinhamento axial.
      //   IDLE  — sem inimigos, patrulha perto do ouro
      //
      // Firing position é recalculada apenas quando:
      //   - alvo muda
      //   - chegou na FP e ainda sem LOS
      //   - a._fpStale = true (forçado pelo estado AIM)
      // ════════════════════════════════════════════════════════
      const target = allyPickTarget(a);

      // Movimento: acelera um pouco por nível e chega no 10 igual ao jogador com Polir Botas 3/3
      const partnerLevel = Math.min(10, Math.max(1, state.allyLevel || a.level || 1));
      a.level = partnerLevel;
      const MOVE_INTERVAL = getPartnerMoveInterval(partnerLevel);
      if(a.moveTimer >= MOVE_INTERVAL){
        a.moveTimer = 0;

        if(target){
          const hasLOS = allyHasLOS(a.x, a.y, target.x, target.y);

          if(hasLOS){
            // ── ESTADO AIM ──────────────────────────────────
            // Temos LOS mas pode ser um ângulo ruim (tiro roça quina).
            // Avalia se a posição atual é "boa":
            //   boa = diferença de ângulo entre a direção ao alvo e
            //         os eixos cardinais é pequena (alinhamento axial).
            // Se posição atual é ruim, busca tile adjacente melhor.
            a._fpStale = false;
            a._fpTarget = target.id;

            const toBx = target.x - a.x, toBy = target.y - a.y;
            // ângulo em graus da diferença para o eixo cardinal mais próximo
            const ang = Math.atan2(Math.abs(toBy), Math.abs(toBx)); // 0=horizontal, PI/2=vertical
            const axialDeviation = Math.min(ang, Math.PI/2 - ang); // 0 = perfeitamente axial
            // Se muito diagonal (>20°) E existe tile melhor: move
            if(axialDeviation > 0.35){ // ~20 graus
              // procura tile adjacente livre com LOS e melhor alinhamento axial
              let bestAdj=null, bestDev=axialDeviation;
              for(let i=0;i<4;i++){
                const nx=a.x+[1,-1,0,0][i], ny=a.y+[0,0,1,-1][i];
                if(isBlocked(nx,ny)||nx<=0||ny<=0||nx>=GRID_W-1||ny>=GRID_H-1) continue;
                if(!allyHasLOS(nx,ny,target.x,target.y)) continue;
                const dx2=target.x-nx, dy2=target.y-ny;
                const a2=Math.atan2(Math.abs(dy2),Math.abs(dx2));
                const dev2=Math.min(a2, Math.PI/2-a2);
                if(dev2<bestDev){ bestDev=dev2; bestAdj={x:nx,y:ny}; }
              }
              if(bestAdj){
                const fdx=bestAdj.x-a.x, fdy=bestAdj.y-a.y;
                a.face=Math.abs(fdx)>=Math.abs(fdy)?(fdx>0?DIRS.right:DIRS.left):(fdy>0?DIRS.down:DIRS.up);
                a.x=bestAdj.x; a.y=bestAdj.y;
              }
            }
            // Atualiza orientação para o alvo
            if(Math.abs(toBx)>=Math.abs(toBy)) a.face=toBx>0?DIRS.right:DIRS.left;
            else a.face=toBy>0?DIRS.down:DIRS.up;

          } else {
            // ── ESTADO HUNT ──────────────────────────────────
            // Sem LOS — calcula ou reutiliza firing position
            const targetChanged = (a._fpTarget !== target.id);
            const atFP = (a._fpx!==null && a._fpx===a.x && a._fpy===a.y);
            const needRecalc = targetChanged || a._fpStale || (atFP && !allyHasLOS(a.x,a.y,target.x,target.y)) || a._fpx==null;

            if(needRecalc){
              const fp = allyFindFiringPos(a.x, a.y, target.x, target.y, 20);
              a._fpx = fp ? fp.x : null;
              a._fpy = fp ? fp.y : null;
              a._fpTarget = target.id;
              a._fpStale  = false;
            }

            if(a._fpx!==null && !(a._fpx===a.x && a._fpy===a.y)){
              const step = bfsNextStep(a.x, a.y, a._fpx, a._fpy, false, false);
              if(step){
                const fdx=step.x-a.x, fdy=step.y-a.y;
                a.face=Math.abs(fdx)>=Math.abs(fdy)?(fdx>0?DIRS.right:DIRS.left):(fdy>0?DIRS.down:DIRS.up);
                a.x=step.x; a.y=step.y;
              } else {
                a._fpx=null; // caminho bloqueado, recalcula
              }
            }
          }

        } else {
          // ── ESTADO IDLE ───────────────────────────────────
          a._fpx=null; a._fpy=null; a._fpTarget=null; a._fpStale=false;
          const distToGold = Math.abs(a.x-gx)+Math.abs(a.y-gy);
          if(distToGold > 4){
            const step=bfsNextStep(a.x, a.y, gx, gy, true, true);
            if(step){ const fdx=step.x-a.x,fdy=step.y-a.y; a.face=Math.abs(fdx)>=Math.abs(fdy)?(fdx>0?DIRS.right:DIRS.left):(fdy>0?DIRS.down:DIRS.up); a.x=step.x; a.y=step.y; }
          } else {
            const d=DIRS4[randInt(0,3)];
            const nx=a.x+d.x, ny=a.y+d.y;
            if(!isBlocked(nx,ny)&&nx>0&&ny>0&&nx<GRID_W-1&&ny<GRID_H-1){ a.x=nx; a.y=ny; a.face=d; }
          }
        }
      }

      // ─── Tiro ───────────────────────────────────────────────
      // Só dispara se allyHasLOS confirmar (3 raios, simulação pixel)
      if(a.fireTimer >= state.allyFireMs){
        a.fireTimer = 0;
        if(!target) continue;

        const bx=target.x*TILE+TILE/2, by=target.y*TILE+TILE/2;
        const ox=a.x*TILE+TILE/2,      oy=a.y*TILE+TILE/2;
        const ddx=bx-ox, ddy=by-oy;
        // orienta sempre para o alvo (mesmo sem tiro)
        if(Math.abs(ddx)>=Math.abs(ddy)) a.face=ddx>0?DIRS.right:DIRS.left;
        else a.face=ddy>0?DIRS.down:DIRS.up;

        if(!allyHasLOS(a.x, a.y, target.x, target.y)){
          // Tiro bloqueado — marca FP como stale para recalcular no próximo move
          a._fpStale = true;
          continue;
        }

        const dlen=Math.hypot(ddx,ddy)||1;
        const vx=(ddx/dlen)*state.bulletSpeed*0.9;
        const vy=(ddy/dlen)*state.bulletSpeed*0.9;
        state.bullets.push({
          dir:a.face, px:ox, py:oy, vx, vy,
          speed:state.bulletSpeed*0.9,
          alive:true, pierceLeft:state.bulletPierce||0,
          dmg:20, src:'ally'
        });
        beep(700,0.04,"square",0.035);
      }
    }
  }

  // Spawn inimigos
  function spawnBandit(){
    const side = randInt(0,3);
    let x,y;
    if (side===0){ x=0; y=randInt(0,GRID_H-1); }
    else if (side===1){ x=GRID_W-1; y=randInt(0,GRID_H-1); }
    else if (side===2){ x=randInt(0,GRID_W-1); y=0; }
    else { x=randInt(0,GRID_W-1); y=GRID_H-1; }
    for (let tries=0; tries<10 && isBlocked(x,y); tries++){
      if (side<=1) y = randInt(0,GRID_H-1);
      else x = randInt(0,GRID_W-1);
    }
    if (isBlocked(x,y)) return;
    state.seen.bandit = true;
    const vc = (state.wave>=24) ? (state.vandalChance||0) : 0;
    const gc = (state.ghostChance||0);
    if (state.wave>=12 && (state.assassinChance||0) > 0 && Math.random() < state.assassinChance){ state.seen.assassin = true;
      state.bandits.push({ id: state.nextBanditId++, x, y, alive:true, dmgTimer:0, assassin:true, hp:40, hitFlashT:0 });
    } else if (gc>0 && Math.random() < gc){ state.seen.fantasma = true;
      state.bandits.push({ id: state.nextBanditId++, x, y, alive:true, dmgTimer:0, fantasma:true, hp:60, _floatT:Math.random()*Math.PI*2 });
    } else if (vc>0 && Math.random() < vc){ state.seen.vandal = true;
      state.bandits.push({ id: state.nextBanditId++, x, y, alive:true, dmgTimer:0, vandal:true, disarming:null, towerDmgTimer:0 });
    } else {
      state.bandits.push({ id: state.nextBanditId++, x, y, alive:true, dmgTimer:0 });
    }
    state.enemiesAlive++;
  }

  function stepBandits(now){


    cleanupDynaLocks();
    // Checa colisão com dinamites (hitkill)
    if (state.dynaLevel >= 0){
      for (const d of state.dynamites){
        if (d.armed){
          for (const z of state.bandits){
            if (!z.alive) continue;
            if (z.assassin) continue;
            if (z.fantasma) continue; // fantasmas imunes às dinamites
            if (z.x === d.x && z.y === d.y){
              if (z.vandal){
                // Inicia ou mantém desarme em vez de explodir (apenas 1 vândalo por dinamite)
                if (!z.disarming){
                  const tnow = performance.now();
                  if (tryLockDyna(d.x, d.y, z.id)) z.disarming = { x:d.x, y:d.y, startAt: tnow, endAt: tnow + DYNA_DISARM_MS };
                }
                continue;
              }
              // explode
              z.alive = false; state.enemiesAlive--;
              // award points for dynamite kills
              addScore('dynamite', 5);
              registerMultiKill(5, z.x, z.y);
              // FX de explosão
              spawnSmallExplosionFX(z.x*TILE+TILE/2, z.y*TILE+TILE/2);
              noise(0.12,0.06); beep(90,0.1,"sawtooth",0.05); beep(60,0.12,"sine",0.05);
                        pushMultiPopup("BOOM!", "#f3d23b", z.x*TILE + TILE/2, z.y*TILE + 10);
// consome dinamite e inicia cooldown
                        // Screen shake mais forte para explosão de dinamite
          state.shakeT = Math.min(0.6, (state.shakeT||0) + 0.28);
          state.shakeMag = Math.max(3.2, state.shakeMag||0);
d.armed = false; d.nextAt = performance.now() + state.dynaCooldownMs;
            }
          }
        }
      }
    }

    if (now - state.lastBanditStep < state.banditStepMs) return;
    state.lastBanditStep = now;
    const gx = state.gold.x, gy = state.gold.y;

    if (state.boss && state.boss.alive){
      const b = state.boss;

      // === O Pregador: movimento + habilidades ===
      if (b.name === "O Pregador"){
        // ── Inicializar timers ────────────────────────────────
        if(b._summonT==null) b._summonT=0; // acumulador em segundos (pára quando pausado)
        if(b._auraPulse==null) b._auraPulse=0;

        // Vai ao ouro — throttle já foi feito pelo banditStepMs acima
        // Boss anda com cadência baseada na velocidade (Pregador 2 steps; Gêmeo enraivecido 1 step)
        if(!b._stepSkip) b._stepSkip=0;
        b._stepSkip++;
        const _bSkip=b._gemino?1:2;
        const _bSteps=(b._gemino&&(b.speedMul||3.74)>6)?2:1;
        if(b._stepSkip>=_bSkip){
          b._stepSkip=0;
          if(b._gemino&&b._enraged){
            let _tpx=state.player.x,_tpy=state.player.y;
            if(state.coop&&state.player2&&state.player2.hp>0){
              if(Math.abs(b.x-state.player2.x)+Math.abs(b.y-state.player2.y)<Math.abs(b.x-_tpx)+Math.abs(b.y-_tpy)){_tpx=state.player2.x;_tpy=state.player2.y;}
            }
            enemyMoveTo(b,_tpx,_tpy,null,null);
          } else {
            enemyMoveTo(b,gx,gy,null,null);
          }
        }

        // ── Habilidade 1: Invocação ────────────────────────────
        // A cada 8s invoca 3 bandidos ao redor do Pregador
        // stepBandits só é chamado quando o jogo está rodando, então dt-based é seguro
        // _summonT é incrementado por dt no updateFX (frame-accurate, pára no pause)
        if(b._summonT >= 8){
          b._summonT = 0; b._summonPopupSent=false;
          let spawned=0;
          const dirs=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},{x:1,y:1},{x:-1,y:1},{x:1,y:-1},{x:-1,y:-1}];
          for(const d of dirs){
            const _maxSpawn=Math.min(12,Math.floor((state.wave||10)/10)*3);
            if(spawned>=_maxSpawn) break;
            const nx=b.x+d.x, ny=b.y+d.y;
            if(nx<0||ny<0||nx>=GRID_W||ny>=GRID_H||isBlocked(nx,ny)) continue;
            if(nx===b.x&&ny===b.y) continue; // não spawna no mesmo tile do Pregador
            if(state.bandits.some(z=>z.alive&&z.x===nx&&z.y===ny)) continue;
            state.bandits.push({id:state.nextBanditId++,x:nx,y:ny,alive:true,dmgTimer:0});
            state.enemiesAlive++;
            // FX de spawn: flash branco + anel de partículas saindo do chão
            const _scx=nx*TILE+TILE/2, _scy=ny*TILE+TILE/2;
            // Flash central branco
            state.fx.push({x:_scx,y:_scy,vx:0,vy:0,life:0.18,max:0.18,color:'#ffffff',size:14,grav:0,_circle:true});
            // Anel de partículas coloridas (branco creme = "energia do pregador")
            for(let _pi=0;_pi<16;_pi++){
              const _pa=(_pi/16)*Math.PI*2;
              const _ps=55+Math.random()*50, _pl=0.35+Math.random()*0.25;
              state.fx.push({x:_scx,y:_scy,vx:Math.cos(_pa)*_ps,vy:Math.sin(_pa)*_ps-30,
                life:_pl,max:_pl,color:_pi%3===0?'#ffffff':(_pi%3===1?'#dfd8c0':'#c8b870'),
                size:2.5+Math.random()*2,grav:150});
            }
            // Partículas que sobem (fumaça branca)
            for(let _pi=0;_pi<6;_pi++){
              state.fx.push({x:_scx+(Math.random()-0.5)*12,y:_scy,
                vx:(Math.random()-0.5)*20,vy:-40-Math.random()*50,
                life:0.5+Math.random()*0.3,max:0.6,color:'#e8e0d0',size:4+Math.random()*3,grav:-15,_circle:true});
            }
            spawned++;
          }
          if(spawned>0){
            try{
              // Som de invocação: acorde sombrio em camadas
              beep(110,0.12,'sawtooth',0.08);                         // fundamental grave
              setTimeout(()=>beep(138,0.10,'square',0.07),40);        // terça menor
              setTimeout(()=>beep(165,0.10,'triangle',0.07),90);      // quinta
              setTimeout(()=>beep(220,0.08,'square',0.06),160);       // oitava
              setTimeout(()=>beep(330,0.06,'triangle',0.05),230);     // acima — sweep
              noise(0.06,0.04);                                        // ruído curto
            }catch(_){}
            state.shakeT=Math.min(0.5,(state.shakeT||0)+0.2); state.shakeMag=Math.max(2.5,state.shakeMag||0);
            // (popup INVOCANDO! já disparado ao iniciar a barra)
          }
        }

        // ── Habilidade 2: Aura de lentidão nos tiros (SÓ O Pregador, não os Gêmeos) ──────────
        if(b.name==="O Pregador"){
          state._pregadorAuraActive=true;
          state._pregadorAuraX=b.x; state._pregadorAuraY=b.y;
        }
        // (aplicado em updateBullets via flag)

      } else if (b.name === "Os Gêmeos"){
        // Gêmeo 1: vai ao ouro ou jogador se enraivecido
        if(!b._stepSkip2) b._stepSkip2=0;
        b._stepSkip2++;
        const _g1skip = 1; // gêmeos movem todo tick
        if(b._stepSkip2 >= _g1skip){
          b._stepSkip2=0;
          if(b._enraged){
            let _tpx=state.player.x,_tpy=state.player.y;
            if(state.coop&&state.player2&&state.player2.hp>0){
              if(Math.abs(b.x-state.player2.x)+Math.abs(b.y-state.player2.y)<Math.abs(b.x-_tpx)+Math.abs(b.y-_tpy)){_tpx=state.player2.x;_tpy=state.player2.y;}
            }
            enemyMoveTo(b,_tpx,_tpy,null,null);
          } else {
            enemyMoveTo(b,gx,gy,null,null);
          }
        }
      } else if (b.name === "Pistoleiro Fantasma"){
        if (!b._pfStep) b._pfStep = 0;
        b._pfStep++;
        if (b._pfStep >= 1){
          b._pfStep = 0;
          let tpx = state.player.x, tpy = state.player.y;
          if (state.coop && state.player2 && state.player2.hp > 0){
            if (state.player.hp > 0){
              const d1 = Math.abs(b.x-tpx)+Math.abs(b.y-tpy);
              const d2 = Math.abs(b.x-state.player2.x)+Math.abs(b.y-state.player2.y);
              if (d2 < d1){ tpx = state.player2.x; tpy = state.player2.y; }
            } else { tpx = state.player2.x; tpy = state.player2.y; }
          }
          const tid = tpx+","+tpy;
          const hasLOS = pistoleiroFantasmaHasLOS(b.x, b.y, tpx, tpy);
          if (hasLOS){
            b._pfFpStale = false;
            b._pfLosTid = tid;
            const md = Math.abs(b.x-tpx)+Math.abs(b.y-tpy);
            const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},{x:1,y:1},{x:1,y:-1},{x:-1,y:1},{x:-1,y:-1}];
            let best = null, bestScore = (md < 5) ? -1e9 : 1e9;
            for (const d of dirs){
              const nx = b.x+d.x, ny = b.y+d.y;
              if (!inBounds(nx,ny) || pistoleiroFantasmaTileBlocked(nx,ny)) continue;
              if (nx === tpx && ny === tpy) continue;
              const nd = Math.abs(nx-tpx)+Math.abs(ny-tpy);
              const sc = (md < 5) ? nd : -nd;
              if ((md < 5 && sc > bestScore) || (md >= 5 && sc < bestScore)){
                bestScore = sc; best = {nx, ny};
              }
            }
            if (best){ b.x = best.nx; b.y = best.ny; }
          } else {
            const targetChanged = (b._pfLosTid !== tid);
            const atFP = (b._pfFpx!=null && b._pfFpx===b.x && b._pfFpy===b.y);
            const needRecalc = targetChanged || b._pfFpStale || (atFP && !pistoleiroFantasmaHasLOS(b.x,b.y,tpx,tpy)) || b._pfFpx==null;
            if (needRecalc){
              const fp = pistoleiroFindFiringPos(b.x, b.y, tpx, tpy, 22);
              b._pfFpx = fp ? fp.x : null;
              b._pfFpy = fp ? fp.y : null;
              b._pfLosTid = tid;
              b._pfFpStale = false;
            }
            if (b._pfFpx!=null && !(b._pfFpx===b.x && b._pfFpy===b.y)){
              const step = pistoleiroBossBfsNextStep(b.x, b.y, b._pfFpx, b._pfFpy, false, false);
              if (step){ b.x = step.x; b.y = step.y; }
              else { b._pfFpx = null; }
            }
          }
        }
      }
    }
    // === Gêmeo 2 (boss2) — FORA do if boss alive para funcionar em fúria ===
    if(state.boss2 && state.boss2.alive){
      const b2=state.boss2;
      if(!b2._stepSkip) b2._stepSkip=0;
      b2._stepSkip++;
      if(b2._stepSkip>=1){
        b2._stepSkip=0;
        if(b2._enraged){
          let tpx=state.player.x, tpy=state.player.y;
          if(state.coop&&state.player2&&state.player2.hp>0){
            if(Math.abs(b2.x-state.player2.x)+Math.abs(b2.y-state.player2.y)<Math.abs(b2.x-tpx)+Math.abs(b2.y-tpy)){tpx=state.player2.x;tpy=state.player2.y;}
          }
          enemyMoveTo(b2,tpx,tpy,null,null);
        } else {
          enemyMoveTo(b2,gx,gy,null,null);
        }
      }
    }
    // Reset aura se boss morreu
    if(!state.boss || !state.boss.alive || state.boss.name!=='O Pregador') state._pregadorAuraActive=false;

    for (const b of state.bandits){ if (!b.alive) continue; if (b.assassin) continue; if (b.fantasma) continue; // fantasmas movem em fantasmaStep
      // Comportamento do Vândalo: prioriza torres; depois dinamites armadas; por fim o ouro
      if (b.vandal){
        // ── Stun do Xerife: vândalo fica parado ──────────────────────────
        if(b.xerifeStunT && b.xerifeStunT>0){ continue; }
        // ─────────────────────────────────────────────────────────────────
        // anySentryAlive: true only if real sentries exist (not mines/barricadas)
        const anySentryAlive = !!(state.sentries && state.sentries.some(t => (t.hp==null?4:t.hp) > 0));
        const anyDynaArmed = !!(state.dynaLevel >= 0 && state.dynamites && state.dynamites.some(d => d.armed));
        
        const nowms = performance.now();
        // Se está desarmando, verifica término e permanece parado
        if (b.disarming){
          if (typeof b.disarming.fromX === 'number' && typeof b.disarming.fromY === 'number'){
            const ad = Math.abs(b.disarming.x - b.x) + Math.abs(b.disarming.y - b.y);
            if (ad !== 1){
              if (!isBlocked(b.disarming.fromX, b.disarming.fromY) &&
                  Math.abs(b.disarming.x - b.disarming.fromX) + Math.abs(b.disarming.y - b.disarming.fromY) === 1){
                b.x = b.disarming.fromX; b.y = b.disarming.fromY;
              } else {
                unlockDynaBy(b.id);
                b.disarming = null;
              }
            }
          }
          if (b.disarming){
            let dyn = null;
            for (const d of state.dynamites){ if (d.x===b.disarming.x && d.y===b.disarming.y && d.armed){ dyn = d; break; } }
            if (!dyn){ unlockDynaBy(b.id);
                b.disarming = null; }
            else {
              if (nowms >= (b.disarming.endAt||0)){
                dyn.armed = false; dyn.nextAt = nowms + state.dynaCooldownMs;
                noise(0.06,0.04); beep(200,0.05,"square",0.02);
                pushMultiPopup("DESARMADA!", "#ff4a4a", b.disarming.x*TILE + TILE/2, b.disarming.y*TILE + 10);
                unlockDynaBy(b.id);
                b.disarming = null;
              }
              if (b.disarming) continue;
            }
          }
        }
        // Prioridade 1: Mina de Ouro mais próxima
        let target = null, bestD = 1e9;
        if(state.goldMines && state.goldMines.length){
          for(const m of state.goldMines){ if(m.hp<=0)continue; const d=Math.abs(m.x-b.x)+Math.abs(m.y-b.y); if(d<bestD){bestD=d;target={x:m.x,y:m.y,type:'goldmine',mine:m};} }
        }
        // Prioridade 2: Torre Sentinela mais próxima
        if(!target && state.sentries && state.sentries.length){
          for (const t of state.sentries){
            const thp = (t.hp==null?4:t.hp); if (thp<=0) continue;
            const d = Math.abs(t.x - b.x) + Math.abs(t.y - b.y);
            if (d < bestD){ bestD = d; target = {x:t.x, y:t.y, type:'tower'}; }
          }
        }
        // Prioridade 3: Dinamite armada mais próxima
        if (!target && state.dynamites && state.dynamites.length){
          for (const d of state.dynamites){
            if (!d.armed) continue;
            const dist = Math.abs(d.x - b.x) + Math.abs(d.y - b.y);
            if (dist < bestD){ bestD = dist; target = {x:d.x, y:d.y, type:'dyna'}; }
          }
        }
        // Barricada só como último recurso (bloqueia caminho)
        if(!target && state.barricadas && state.barricadas.length){
          for(const bar of state.barricadas){ if(bar.hp<=0)continue; const d=Math.abs(bar.x-b.x)+Math.abs(bar.y-b.y); if(d<bestD){bestD=d;target={x:bar.x,y:bar.y,type:'barricada',bar:bar};} }
        }

        // Se o alvo (mina/torre/dinamite/ouro) estiver inacessível apenas por barricadas ou torretas,
        // o vândalo deve quebrar o obstáculo que está bloqueando o caminho.
        if (target && target.type!=='barricada' && target.type!=='tower' && bestD>1){
          const step = bfsNextStep(b.x, b.y, target.x, target.y, true, false);
          if (!step){
            // Tenta barricada bloqueante primeiro
            const bar = findBlockingBarricadeOnPath(b.x, b.y, target.x, target.y);
            if (bar){
              target = {x:bar.x, y:bar.y, type:'barricada', bar:bar};
              bestD = Math.abs(bar.x-b.x) + Math.abs(bar.y-b.y);
            } else {
              // Tenta torreta bloqueante
              const sent = findBlockingSentryOnPath(b.x, b.y, target.x, target.y);
              if (sent){
                target = {x:sent.x, y:sent.y, type:'tower'};
                bestD = Math.abs(sent.x-b.x) + Math.abs(sent.y-b.y);
              }
            }
          }
        }

        // Se está em cima de uma dinamite armada, inicia desarme
        
        if (target && (target.type==='dyna' || target.kind==='dyna')){
          const dist = Math.abs(target.x - b.x) + Math.abs(target.y - b.y);
          if (dist === 0){
            // Step off to an adjacent, still-adjacent-to-dynamite tile
            const adj = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
            for (const d of adj){
              const nx = b.x + d.x, ny = b.y + d.y;
              if (Math.abs(nx - target.x) + Math.abs(ny - target.y) === 1 && !isBlocked(nx,ny)) { b.x=nx; b.y=ny; break; }
            }
            continue;
          }
          if (dist === 1){
            if (!b.disarming || b.disarming.x !== target.x || b.disarming.y !== target.y){
              b.disarming = { x: target.x, y: target.y, fromX: b.x, fromY: b.y, startAt: nowms, endAt: nowms + DYNA_DISARM_MS };
            }
            continue;
          }
          // walk toward adjacency (never step onto the dynamite tile)
          // Use enemyMoveTo but skip destination tile (avoidTarget via null dontStepOn)
          enemyMoveTo(b, target.x, target.y, null, null);
          continue;
        }

        // Vandal attacks goldmine when adjacent
        if(target && target.type==='goldmine' && bestD<=1){
          if(nowms>=(b.towerDmgTimer||0)){
            const m=target.mine;
            if(m&&m.hp>0){
              m.hp-=5; if(m.hp<0)m.hp=0; m.warnT=1.2; b.towerDmgTimer=nowms+1000;
              try{if(typeof spawnAssassinHitFX==='function')spawnAssassinHitFX(m.x,m.y);}catch(_){}
              noise(0.04,0.02); beep(220,0.04,'square',0.03);
              if(m.hp<=0){
                noise(0.10,0.06); beep(130,0.07,'square',0.03); beep(90,0.09,'sine',0.03);
                const dcx=m.x*TILE+TILE/2,dcy=m.y*TILE+TILE/2;
                for(let i=0;i<20;i++){const a=Math.random()*Math.PI*2,s=70+Math.random()*120,l=0.4+Math.random()*0.3;state.fx.push({x:dcx,y:dcy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-50,life:l,max:l,color:i%2?'#6b4b1b':'#f3d23b',size:2+Math.random()*3,grav:280});}
                pushMultiPopup("Mina destruída!","#ff4d4d",m.x*TILE+TILE/2,m.y*TILE+12);
                if(state.selectedGoldMine===m){state.selectedGoldMine=null;try{const _gm=document.getElementById('goldMineMenu');if(_gm)_gm.style.display='none';}catch(_){}}
                state.goldMines=state.goldMines.filter(_m=>_m!==m);
                try{refreshShopVisibility();if(window._renderShopPage)window._renderShopPage();}catch(_){}
              }
            }
          }
          continue;
        }

        // Vandal attacks barricada when adjacent
        if(target && target.type==='barricada' && bestD<=1){
          if(nowms>=(b.towerDmgTimer||0)){
            const bar=target.bar;
            if(bar&&bar.hp>0){
              bar.hp-=5; if(bar.hp<0)bar.hp=0; bar.warnT=1.2; b.towerDmgTimer=nowms+1000;
              try{if(typeof spawnAssassinHitFX==='function')spawnAssassinHitFX(bar.x,bar.y);}catch(_){}
              noise(0.04,0.02); beep(200,0.05,'square',0.03);
              if(bar.hp<=0){
                noise(0.09,0.05); beep(120,0.06,'sawtooth',0.04); beep(80,0.07,'sine',0.03);
                const dcx=bar.x*TILE+TILE/2,dcy=bar.y*TILE+TILE/2;
                for(let i=0;i<18;i++){const a=Math.random()*Math.PI*2,s=65+Math.random()*110,l=0.35+Math.random()*0.28;state.fx.push({x:dcx,y:dcy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-45,life:l,max:l,color:i%2?'#6f4e37':'#c8a060',size:2+Math.random()*3,grav:280});}
                pushMultiPopup("Barricada destruída!","#ff8c00",bar.x*TILE+TILE/2,bar.y*TILE+12);
                if(state.selectedBarricada===bar){state.selectedBarricada=null;try{const _bm=document.getElementById('barricadaMenu');if(_bm)_bm.style.display='none';}catch(_){}}
                state.barricadas=state.barricadas.filter(_b=>_b!==bar);
                try{refreshShopVisibility();if(window._renderShopPage)window._renderShopPage();}catch(_){}
              }
            }
          }
          continue;
        }
        
        // Se adjacente à torre, bater (1 hit por ~1s)
        if (target && target.type==='tower' && bestD <= 1){
          if (nowms >= (b.towerDmgTimer||0)){
            // encontra a torre alvo
            for (const t of state.sentries){
              if (t.x===target.x && t.y===target.y){
                t.hp = (t.hp==null?4:t.hp) - 1;
                t.warnT = 1.0;b.towerDmgTimer = nowms + 1000;
                try{ if (typeof spawnAssassinHitFX==='function') spawnAssassinHitFX(t.x, t.y); }catch(_){}
                // FX quebrando e som leve de impacto
                beep(120,0.04,"square",0.02); noise(0.03,0.03);
                if (t.hp <= 0){
                  try{if(typeof spawnTowerBreakFX==='function')spawnTowerBreakFX(t.x,t.y);}catch(_){}
                  try{if(typeof quickShake==='function')quickShake(6,180);}catch(_){}
                  noise(0.1,0.06);beep(90,0.06,"sine",0.02);beep(60,0.08,"square",0.02);
                  if(state.selectedSentry===t){state.selectedSentry=null;try{const _sm=document.getElementById('sentryMenu');if(_sm)_sm.style.display='none';}catch(_){}}
                  state.sentries=state.sentries.filter(s=>!(s.x===t.x&&s.y===t.y));
                  pushMultiPopup("TORRE QUEBRADA!","#ff4d4d",t.x*TILE+TILE/2,t.y*TILE+6);
                }
                break;
              }
            }
          }
          continue;
        }
        // Mover 1 passo em direção ao alvo escolhido; se não houver alvo, vai ao ouro
        {
          let mvtx, mvty;
          if (target){ mvtx = target.x; mvty = target.y; }
          else { mvtx = gx; mvty = gy; } // sem alvo → vai ao ouro
          enemyMoveTo(b, mvtx, mvty, gx, gy);
        }
        continue;
      }

      // Bandido normal: vai ao ouro
      // Poça de Piche: skip de movimento (50% mais lento)
      if(state.pichaPocos&&state.pichaPocos.some(p=>p.x===b.x&&p.y===b.y)){
        if(!b._pichDelay){b._pichDelay=true;continue;}else{b._pichDelay=false;}
      } else { b._pichDelay=false; }
      enemyMoveTo(b, gx, gy, null, null);
    }
  }

  
  // Move assassins (who are stored inside state.bandits) toward the player once per bandit step
  function assassinsStep(now){
    if (!state.assassinLastStep) state.assassinLastStep = 0;
    if (now - state.assassinLastStep < state.assassinStepMs) return;
    state.assassinLastStep = now;
    // Determine available alive players and their positions
    const alivePlayers = [];
    if (state.player && state.player.hp > 0){ alivePlayers.push({x: state.player.x, y: state.player.y}); }
    if (state.coop && state.player2 && state.player2.hp > 0){ alivePlayers.push({x: state.player2.x, y: state.player2.y}); }
    for (const z of state.bandits){
      if (!z.alive || !z.assassin) continue;
      // Skip assassins if no alive players
      if (alivePlayers.length === 0) continue;
      // Find closest target among alive players
      let target = alivePlayers[0];
      let bestDist = Math.abs(z.x - target.x) + Math.abs(z.y - target.y);
      for (let i=1; i<alivePlayers.length; i++){
        const p = alivePlayers[i];
        const dist = Math.abs(z.x - p.x) + Math.abs(z.y - p.y);
        if (dist < bestDist){ bestDist = dist; target = p; }
      }
      // Se há espantalho atraindo, vai até ele
      if(z._espTarget){
        const et=z._espTarget; z._espTarget=null;
        const espAlive=state.espantalhos&&state.espantalhos.some(e=>e.hp>0&&e.x===et.x&&e.y===et.y);
        if(espAlive){const md=Math.abs(z.x-et.x)+Math.abs(z.y-et.y);if(md>1)enemyMoveTo(z,et.x,et.y,null,null);continue;}
      }
      if (bestDist <= 1) continue;
      // Poça de Piche: assassino fica lento
      if(state.pichaPocos&&state.pichaPocos.some(p=>p.x===z.x&&p.y===z.y)){
        if(!z._pichDelay){z._pichDelay=true;continue;}else{z._pichDelay=false;}
      } else { z._pichDelay=false; }
      enemyMoveTo(z, target.x, target.y, null, null);
    }
  }

  // ── Fantasma: movimento proprio atravessando objetos do jogador ──
  function fantasmaStep(now){
    if (!state.fantasmaLastStep) state.fantasmaLastStep = 0;
    if (now - state.fantasmaLastStep < state.banditStepMs) return;
    state.fantasmaLastStep = now;
    const gx=state.gold.x, gy=state.gold.y;
    const W=GRID_W, H=GRID_H;
    const DX=[1,-1,0,0], DY=[0,0,1,-1];
    for (const z of state.bandits){
      if (!z.alive || !z.fantasma) continue;
      if (Math.abs(z.x-gx)+Math.abs(z.y-gy)<=1) continue; // já adjacente
      // BFS simples: só bloqueia obstáculos do mapa (tiles 1,2,5,6,7), nada do jogador
      const start=z.x+z.y*W, goal=gx+gy*W;
      const visited=new Uint8Array(W*H), parent=new Int16Array(W*H).fill(-1);
      visited[start]=1; const q=[start]; let head=0, found=-1;
      outer: while(head<q.length){
        const cur=q[head++], cx=cur%W, cy=(cur/W)|0;
        for(let i=0;i<4;i++){
          const nx=cx+DX[i], ny=cy+DY[i];
          if(nx<0||ny<0||nx>=W||ny>=H) continue;
          const nk=nx+ny*W; if(visited[nk]) continue;
          // Checa se chegou ao destino ANTES de filtrar por tile (gold é tile 3)
          if(nk===goal){visited[nk]=1;parent[nk]=cur;found=nk;break outer;}
          // Fantasma: só bloqueia tiles sólidos do mapa (cactos, rochas, etc)
          const _tv=state.map[ny][nx];
          if(_tv!==0&&_tv!==9) continue; // bloqueia obstáculos (6=água tb bloqueia)
          visited[nk]=1; parent[nk]=cur;
          q.push(nk);
        }
      }
      if(found===-1) continue;
      // Poça de Piche: fantasma fica lento
      if(state.pichaPocos&&state.pichaPocos.some(p=>p.x===z.x&&p.y===z.y)){
        if(!z._pichDelay){z._pichDelay=true;continue;}else{z._pichDelay=false;}
      } else { z._pichDelay=false; }
      let cur=found; let safety=W*H;
      while(parent[cur]!==start&&parent[cur]!==-1&&safety-- > 0) cur=parent[cur];
      if(parent[cur]!==-1){z.x=cur%W;z.y=(cur/W)|0;}
    }
  }

  function espantalhoStats(lvl){
    const h=[50,75,100],rg=[2,3,4],l=Math.min(3,Math.max(1,lvl||1))-1;
    return{maxHp:h[l],range:rg[l]};
  }
  function stepEspantalhos(){
    if(!state||!state.espantalhos||!state.espantalhos.length)return;
    for(const esp of state.espantalhos){
      if(esp.hp<=0)continue;
      const r=espantalhoStats(esp.level||1).range;
      for(const z of state.bandits||[]){
        if(!z.alive||!z.assassin)continue;
        const dx=Math.abs(z.x-esp.x),dy=Math.abs(z.y-esp.y);
        if(dx<=r&&dy<=r)z._espTarget={x:esp.x,y:esp.y};
      }
    }
  }
  function espantalhoAssassinDamage(dt){
    if(!state||!state.espantalhos||!state.espantalhos.length)return;
    for(let _ei=state.espantalhos.length-1;_ei>=0;_ei--){
      const esp=state.espantalhos[_ei];
      if(esp.hp<=0)continue;
      for(const z of state.bandits||[]){
        if(!z.alive||!z.assassin)continue;
        if(Math.abs(z.x-esp.x)+Math.abs(z.y-esp.y)<=1){
          esp._dmgTimer=(esp._dmgTimer||0)+dt;
          if(esp._dmgTimer>=1){
            esp._dmgTimer=0;
            esp.hp=Math.max(0,esp.hp-10);
            esp.warnT=1.2;
            try{spawnAssassinHitFX(esp.x,esp.y);}catch(_){}
            try{beep(180,0.07,'sawtooth',0.06);setTimeout(()=>beep(280,0.05,'square',0.04),60);}catch(_){}
            if(esp.hp<=0){
              const cx=esp.x*TILE+TILE/2,cy=esp.y*TILE+TILE/2;
              for(let i=0;i<22;i++){const a=Math.random()*Math.PI*2,s=80+Math.random()*130,l=0.32+Math.random()*0.28;const cols=['#8b5a2b','#2a2a2a','#c97a2b','#888'];state.fx.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-45,life:l,max:l,color:cols[i%4],size:2+Math.random()*3,grav:310});}
              try{beep(320,0.07,'sawtooth',0.07);setTimeout(()=>beep(210,0.06,'sawtooth',0.06),75);setTimeout(()=>beep(130,0.08,'sawtooth',0.05),170);}catch(_){}
              if(state.selectedEspantalho===esp){state.selectedEspantalho=null;try{document.getElementById('espantalhoMenu').style.display='none';}catch(_){}}
              state.espantalhos.splice(_ei,1);
              try{refreshShopVisibility();if(window._renderShopPage)window._renderShopPage();}catch(_){}
              break;
            }
          }
        }
      }
    }
  }
  function spawnPlayerHitFX(pxTile, pyTile){
    const cx = pxTile * TILE + TILE/2;
    const cy = pyTile * TILE + TILE/2 - 6;
    for (let i=0;i<12;i++){
      const ang = Math.random()*Math.PI*2;
      const spd = 120 + Math.random()*80;
      const life = 0.22 + Math.random()*0.15;
      state.fx.push({
        x: cx, y: cy,
        vx: Math.cos(ang)*spd,
        vy: Math.sin(ang)*spd - 20,
        life, max: life,
        color: (i%3===0? "#ffe3a2" : (i%3===1? "#c97a2b" : "#000")),
        size: 2,
        grav: 260
      });
    }
  }

  function spawnAssassinHitFX(tx, ty){
    const cx = tx * TILE + TILE/2;
    const cy = ty * TILE + TILE/2;
    for (let i=0;i<8;i++){
      const ang = Math.random()*Math.PI*2;
      const spd = 90 + Math.random()*60;
      const life = 0.18 + Math.random()*0.12;
      state.fx.push({
        x: cx, y: cy,
        vx: Math.cos(ang)*spd,
        vy: Math.sin(ang)*spd - 18,
        life, max: life,
        color: (i%2? "#5a00cc" : "#111"),
        size: 2,
        grav: 200
      });
    }
  }

  // === Torres Sentinelas ===
  function stepSentries(now){
    if (!state.sentries || state.sentries.length===0) return;
    state.sentries = state.sentries.filter(t => t && typeof t.x==='number' && (t.hp==null || t.hp>0));
    for (let si = 0; si < state.sentries.length; si++){
      const t = state.sentries[si];
      t.i = si;
      if ((t.upLevel | 0) > SENTRY_MAX_UP_LEVEL){
        t.upLevel = SENTRY_MAX_UP_LEVEL;
        let cdM = SENTRY_FIRE_BASE_MS;
        for (let u = 0; u < SENTRY_MAX_UP_LEVEL; u++) cdM = Math.max(SENTRY_FIRE_CD_MIN_AFTER_MENU_UP, Math.floor(cdM * 0.85));
        state.sentryFireMs[si] = cdM;
      }
    }
    for (const t of state.sentries){
      const i = t.i || 0;
      const cd = state.sentryFireMs[i] || SENTRY_FIRE_CD_FALLBACK_MS;
      if (now < (t.nextAt||0)) continue;
      // Acquire nearest target within range (bandits or assassins, alive)
      let best=null, bestD=1e9;
      const px=t.x, py=t.y, r=2; // quadrado 2 tiles para cada lado
      function consider(z){
        if (!z.alive) return;
        if (z.assassin) return; // invisível para torres
        if (z.fantasma) return; // fantasmas invisíveis para torres
        // vândalos: visíveis e atacáveis normalmente
        const dx=Math.abs(z.x-px), dy=Math.abs(z.y-py);
        if (dx<=r && dy<=r){ const d=dx+dy; if(d<bestD){ best=z; bestD=d; } }
      }
      for (const z of state.bandits){ consider(z); }
      for (const a of state.assassins||[]){ consider(a); }
      // Boss dentro do range (inclui boss2)
      if (!best && state.boss && state.boss.alive && state.boss.name !== "Pistoleiro Fantasma"){
        const _bdx=Math.abs(state.boss.x-px), _bdy=Math.abs(state.boss.y-py);
        if(_bdx<=r && _bdy<=r) best=state.boss;
      }
      if (!best && state.boss2 && state.boss2.alive && state.boss2.name !== "Pistoleiro Fantasma"){
        const _b2dx=Math.abs(state.boss2.x-px), _b2dy=Math.abs(state.boss2.y-py);
        if(_b2dx<=r && _b2dy<=r) best=state.boss2;
      }
      if (!best) continue;
      // Fire towards best (simple straight bullet in 8-dir approx using vx/vy continuous)
      const sx = px*TILE + TILE/2, sy = py*TILE + TILE/2;
      const tx = best.x*TILE + TILE/2, ty = best.y*TILE + TILE/2;
      let vx = tx - sx, vy = ty - sy;
      const len = Math.hypot(vx, vy) || 1;
      vx /= len; vy /= len;
      const speed = state.bulletSpeed || 240;
      state.bullets.push({ dir:{x:vx,y:vy}, px:sx, py:sy, speed: state.bulletSpeed, alive:true, pierceLeft:0, dmg:20, src:'sentry', _originX:px, _originY:py });
      t.nextAt = now + cd;
      // small muzzle flash fx
      state.fx.push({ x:sx, y:sy, vx:0, vy:-20, life:0.15, max:0.15, color:'#ffe3a2', size:2, grav:180 });
      beep(180,0.03,'square',0.02);
      resolveEnemyOverlap();
}
  
  // Resolve colisões: se duas entidades ficam na mesma célula, a segunda volta para a célula anterior
  function resolveEnemyOverlap(){
    const used = new Set();
    const key = (x,y)=>x+"|"+y;

    if (state.boss && state.boss.alive){
      used.add(key(state.boss.x, state.boss.y));
    }
    for (const e of state.bandits){
      if (!e.alive) continue;
      const k = key(e.x, e.y);
      if (used.has(k)){
        if (typeof e.prevX === 'number' && typeof e.prevY === 'number'){
          e.x = e.prevX; e.y = e.prevY;
        }
      }
      used.add(key(e.x,e.y));
    }
  }

}
  function spawnBigExplosionFX(cx,cy,halfR,extraScale){
    const mul = (extraScale != null && isFinite(extraScale) && extraScale > 0) ? extraScale : 1;
    const sc = (0.6 + halfR * 0.55) * mul; // escala proporcional ao raio (Nv1~1.15, Nv4~2.25) × mul
    const R = sc;
    // ── 1. Flash branco central (núcleo da detonação) ────────────
    state.fx.push({x:cx,y:cy,vx:0,vy:0,life:0.08,max:0.08,color:'#ffffff',size:28*sc,grav:0,_circle:true});
    state.fx.push({x:cx,y:cy,vx:0,vy:0,life:0.14,max:0.14,color:'#ffe8a0',size:20*sc,grav:0,_circle:true});
    // ── 2. Anel de shockwave (3 anéis concêntricos expandindo) ──
    const ringSpds=[90,140,200];
    const ringCols=['#ffdd88','#ff9900','#ff4400'];
    const ringLives=[0.28,0.22,0.16];
    for(let r=0;r<3;r++){
      const spd=ringSpds[r]*sc, lf=ringLives[r];
      const N=12+r*4;
      for(let i=0;i<N;i++){
        const ang=(Math.PI*2*i)/N;
        state.fx.push({x:cx+Math.cos(ang)*3,y:cy+Math.sin(ang)*3,
          vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd*0.55,
          life:lf,max:lf,color:ringCols[r],size:(3.5-r*0.6)*sc,grav:0,_circle:true});
      }
    }
    // ── 3. Bola de fogo: esfera laranja/amarela que cresce e sobe ─
    const nFire=20+Math.round(8*sc);
    for(let i=0;i<nFire;i++){
      const ang=Math.random()*Math.PI*2;
      const spd=(25+Math.random()*55)*sc;
      const life=0.45+Math.random()*0.35;
      const sz=(8+Math.random()*8)*sc;
      const col=['#ff2200','#ff6600','#ff9900','#ffcc00','#ffffff'][Math.floor(Math.random()*5)];
      state.fx.push({x:cx+(Math.random()-0.5)*12*sc,y:cy+(Math.random()-0.5)*8*sc,
        vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-55*sc,
        life,max:life,color:col,size:sz,grav:-35*sc,_circle:true});
    }
    // ── 4. Detritos pesados (fragmentos que caem com gravidade) ──
    const nDebris=14+Math.round(6*sc);
    for(let i=0;i<nDebris;i++){
      const ang=Math.random()*Math.PI*2;
      const spd=(70+Math.random()*110)*sc;
      const life=0.55+Math.random()*0.45;
      const col=Math.random()<0.5?'#3a2010':(Math.random()<0.5?'#6b4b1b':'#888888');
      state.fx.push({x:cx+(Math.random()-0.5)*8*sc,y:cy+(Math.random()-0.5)*6*sc,
        vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-70*sc,
        life,max:life,color:col,size:(3+Math.random()*3)*sc,grav:320,hat:false});
    }
    // ── 5. Fumaça densa subindo (coluna vertical) ─────────────────
    const nSmoke=10+Math.round(4*sc);
    for(let i=0;i<nSmoke;i++){
      const ox=(Math.random()-0.5)*18*sc;
      const life=0.75+Math.random()*0.55;
      const sz=(9+Math.random()*9)*sc;
      const col=i%3===0?'#222222':(i%3===1?'#444444':'#666666');
      state.fx.push({x:cx+ox,y:cy+(Math.random()-0.5)*6*sc,
        vx:(Math.random()-0.5)*22*sc,vy:-(28+Math.random()*40)*sc,
        life,max:life,color:col,size:sz,grav:-18*sc,_circle:true});
    }
    // ── 6. Faíscas longas (raycast) que saem em alta velocidade ──
    const nSparks=16+Math.round(6*sc);
    for(let i=0;i<nSparks;i++){
      const ang=(Math.PI*2*i)/nSparks+Math.random()*0.3;
      const spd=(160+Math.random()*120)*sc;
      state.fx.push({x:cx,y:cy,
        vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-30*sc,
        life:0.18+Math.random()*0.12,max:0.22,
        color:Math.random()<0.5?'#ffffff':'#ffee88',
        size:(1.5+Math.random())*sc,grav:80,_circle:false});
    }
    // ── 7. Poeira no chão (anel rasante) ─────────────────────────
    const nDust=10;
    for(let i=0;i<nDust;i++){
      const ang=(Math.PI*2*i)/nDust;
      const spd=(55+Math.random()*40)*sc;
      state.fx.push({x:cx+Math.cos(ang)*4,y:cy+Math.sin(ang)*2,
        vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd*0.25+2,
        life:0.5+Math.random()*0.3,max:0.6,
        color:'#c8a060',size:(4+Math.random()*4)*sc,grav:30,_circle:true});
    }
  }
  function spawnSmallExplosionFX(cx,cy){
    const cols=['#ff6600','#ff9900','#ffcc00','#ff3300'];
    for(let i=0;i<22;i++){const ang=Math.random()*Math.PI*2,spd=80+Math.random()*130,life=0.28+Math.random()*0.22;state.fx.push({x:cx+(Math.random()-0.5)*8,y:cy+(Math.random()-0.5)*8,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-50,life,max:life,color:cols[i%cols.length],size:2.5+Math.random()*2.5,grav:150});}
    for(let i=0;i<8;i++){const ang=Math.random()*Math.PI*2,spd=150+Math.random()*120;state.fx.push({x:cx,y:cy,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-60,life:0.14+Math.random()*0.08,max:0.22,color:'#ffffff',size:2+Math.random()*2,grav:0});}
    for(let i=0;i<12;i++){const ang=Math.random()*Math.PI*2,spd=60+Math.random()*90;state.fx.push({x:cx,y:cy,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-80,life:0.5+Math.random()*0.3,max:0.8,color:Math.random()<0.5?'#ff6600':'#ffaa00',size:1.5+Math.random()*2,grav:280});}
  }
  function updateExplosiveAoeFlashes(dt){
    if (!state || !state.explosiveAoeFlashes || !state.explosiveAoeFlashes.length) return;
    const next = [];
    for (let i = 0; i < state.explosiveAoeFlashes.length; i++){
      const f = state.explosiveAoeFlashes[i];
      f.t = (f.t || 0) + dt;
      if (f.t < (f.maxT || 0.35)) next.push(f);
    }
    state.explosiveAoeFlashes = next;
  }

  function drawExplosiveAoeFlashes(ctx){
    if (!state.explosiveAoeFlashes || !state.explosiveAoeFlashes.length) return;
    const oScale = 0.68;
    for (const f of state.explosiveAoeFlashes){
      const fuseProg = Math.min(1, (f.t || 0) / (f.maxT || 0.35));
      const bx = f.x * TILE + TILE / 2, by = f.y * TILE + TILE / 2;
      const hr = f.halfR | 0;
      const fullR = (hr * 2 + 1) * TILE;
      const _r = fullR * oScale;
      const _ax = bx - _r / 2, _ay = by - _r / 2;
      const blinkRate = Math.max(0.06, 0.22 - fuseProg * 0.16);
      const blinkOn = Math.floor((f.t || 0) / blinkRate) % 2 === 0;
      if (fuseProg > 0.04){
        const _aAlpha = (0.06 + fuseProg * 0.14) * (blinkOn ? 1.0 : 0.7);
        ctx.save();
        ctx.globalAlpha = _aAlpha;
        const _grad = ctx.createRadialGradient(bx, by, 2, bx, by, _r * 0.7);
        _grad.addColorStop(0, '#ff4400');
        _grad.addColorStop(1, 'rgba(255,68,0,0)');
        ctx.fillStyle = _grad;
        ctx.fillRect(_ax, _ay, _r, _r);
        ctx.globalAlpha = 0.35 + fuseProg * 0.3;
        ctx.strokeStyle = blinkOn ? '#ff6600' : '#cc2200';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(_ax + 1, _ay + 1, _r - 2, _r - 2);
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
  }

  function updateDinamiteiroBombs(dt){
    if(!state||!state.running||state.betweenWaves) return;
    if(!state.dinamiteiroBombs||!state.dinamiteiroBombs.length) return;
    const toRemove=[];
    for(let bi=0;bi<state.dinamiteiroBombs.length;bi++){
      const b=state.dinamiteiroBombs[bi];
      if(b.flyT<b.flyDur){b.flyT+=dt;continue;}
      b.fuseT+=dt;
      if(!b._lastFlash||b.fuseT-b._lastFlash>0.18){
        b._lastFlash=b.fuseT;
        const bx=b.x*TILE+TILE/2,by=b.y*TILE+TILE/2;
        state.fx.push({x:bx+(Math.random()-0.5)*4,y:by+(Math.random()-0.5)*4,vx:(Math.random()-0.5)*20,vy:-15-Math.random()*20,life:0.12,max:0.12,color:'#ffffff',size:2+Math.min(1,b.fuseT/b.fuseDur)*3,grav:0});
      }
      if(b.fuseT>=b.fuseDur){
        const cx=b.x*TILE+TILE/2,cy=b.y*TILE+TILE/2;
        spawnBigExplosionFX(cx,cy,b.halfR);
        try{beep(60,0.18,'sawtooth',0.12);beep(80,0.15,'square',0.10);setTimeout(()=>beep(40,0.12,'sawtooth',0.08),60);setTimeout(()=>beep(100,0.10,'sine',0.06),120);}catch(_){}
        // shake proporcional ao raio (-20%)
        const _shakeScale=(0.144+b.halfR*0.096);
        state.shakeT=Math.min(1.0,(state.shakeT||0)+_shakeScale);
        state.shakeMag=1.6+b.halfR*0.96;
        const hr=b.halfR;
        let killed=false;
        if(state.bandits){
          for(const z of state.bandits){
            if(!z.alive) continue;
            if(z.fantasma) continue; // fantasmas imunes às bombas
            if(Math.abs(z.x-b.x)<=hr&&Math.abs(z.y-b.y)<=hr){
              z.alive=false; state.enemiesAlive=Math.max(0,(state.enemiesAlive||1)-1);
              addScore('ally',8);
              // Efeito de morte sempre Padrão (id=0), como outros companheiros
              try{ spawnAllyDeathFX(z.x,z.y,false); }catch(_){}
              killed=true;
            }
          }
        }
        if(state.boss2&&state.boss2.alive&&Math.abs(state.boss2.x-b.x)<=hr&&Math.abs(state.boss2.y-b.y)<=hr){
          state.boss2.hp=Math.max(0,state.boss2.hp-80);
          if(state.boss2.hp<=0){
            state.boss2.alive=false; spawnAllyDeathFX(state.boss2.x,state.boss2.y,true); addScore('ally',38);
            if(state.boss&&state.boss.alive){state.boss._enraged=true;state.boss.speedMul=3.74;state.boss._stepSkip2=0;pushMultiPopup('FÚRIA!','#ff2020',state.boss.x*TILE+TILE/2,state.boss.y*TILE-4);try{const _r2=document.getElementById('geminiRow2');if(_r2)_r2.style.display='none';}catch(_){}}            else{try{const _gbw=document.getElementById('geminiBarsWrap');if(_gbw)_gbw.style.display='none';}catch(_){} musicStop();musicStart();endWave();}
          } else {spawnBossHitFX(state.boss2.x,state.boss2.y);try{document.getElementById('geminiBar2Fill').style.width=Math.max(0,state.boss2.hp/state.boss2.maxhp*100).toFixed(0)+'%';}catch(_){}}
        }
        if(state.boss&&state.boss.alive&&state.boss.name!=="Pistoleiro Fantasma"&&Math.abs(state.boss.x-b.x)<=hr&&Math.abs(state.boss.y-b.y)<=hr){
          state.boss.hp=Math.max(0,state.boss.hp-80);
          if(state.boss.hp<=0){
            state.boss.alive=false;
            if(b&&(b.src==='player'||b.src==='player2')){spawnDeathFX(state.boss.x,state.boss.y,true,b.src);}
            else{spawnAllyDeathFX(state.boss.x,state.boss.y,true);}
            if(state.boss.name==="Os Gêmeos"&&state.boss2&&state.boss2.alive){
              addScore('ally',38);state.boss2._enraged=true;state.boss2.speedMul=3.74;
              pushMultiPopup('FÚRIA!','#ff2020',state.boss2.x*TILE+TILE/2,state.boss2.y*TILE-4);
              try{const _r1=document.getElementById('geminiRow1');if(_r1)_r1.style.display='none';}catch(_){}
            } else {
              addScore('ally',state.boss.name==="Os Gêmeos"?38:150);
              try{bossBarFill.style.width='0%';const _g=document.getElementById('geminiBarsWrap');if(_g)_g.style.display='none';}catch(_){}
              musicStop();musicStart();endWave();
            }
          } else{spawnBossHitFX(state.boss.x,state.boss.y);if(state.boss.name!=="Os Gêmeos")try{bossBarFill.style.width=Math.max(0,state.boss.hp/state.boss.maxhp*100).toFixed(0)+'%';}catch(_){}}
        }
        pushMultiPopup('BOOM!','#ff6600',cx,b.y*TILE);
        toRemove.push(bi);
      }
    }
    for(let i=toRemove.length-1;i>=0;i--) state.dinamiteiroBombs.splice(toRemove[i],1);
  }

function bulletPathHitsTile(x0, y0, x1, y1, tx, ty){
    const minX = tx * TILE;
    const minY = ty * TILE;
    const maxX = minX + TILE;
    const maxY = minY + TILE;
    if (x0 >= minX && x0 <= maxX && y0 >= minY && y0 <= maxY) return true;
    const dx = x1 - x0;
    const dy = y1 - y0;
    let tMin = 0;
    let tMax = 1;
    if (Math.abs(dx) < 0.0001){
      if (x0 < minX || x0 > maxX) return false;
    } else {
      let tx1 = (minX - x0) / dx;
      let tx2 = (maxX - x0) / dx;
      if (tx1 > tx2){ const tmp = tx1; tx1 = tx2; tx2 = tmp; }
      tMin = Math.max(tMin, tx1);
      tMax = Math.min(tMax, tx2);
      if (tMin > tMax) return false;
    }
    if (Math.abs(dy) < 0.0001){
      if (y0 < minY || y0 > maxY) return false;
    } else {
      let ty1 = (minY - y0) / dy;
      let ty2 = (maxY - y0) / dy;
      if (ty1 > ty2){ const tmp = ty1; ty1 = ty2; ty2 = tmp; }
      tMin = Math.max(tMin, ty1);
      tMax = Math.min(tMax, ty2);
      if (tMin > tMax) return false;
    }
    return tMax >= 0 && tMin <= 1;
  }

function updateBullets(dt){
    for (const b of state.bullets){
      if (!b.alive) continue;
      const prevPx = b.px;
      const prevPy = b.py;
      // Movimento do projétil
      // Habilidade 2 do Pregador: aura de lentidão nos tiros do jogador
      let _bulletSpeedMul=1;
      // Aura de lentidão: SOMENTE quando o Pregador está ativo
      if(state._pregadorAuraActive && state.boss && state.boss.alive && state.boss.name==='O Pregador' && (b.src==='player'||b.src==='player2')){
        const _bTX=Math.floor(b.px/TILE), _bTY=Math.floor(b.py/TILE);
        const _paX=state._pregadorAuraX||0, _paY=state._pregadorAuraY||0;
        if(Math.abs(_bTX-_paX)<=3 && Math.abs(_bTY-_paY)<=3) _bulletSpeedMul=0.25;
      }
      if (typeof b.vx === 'number' && typeof b.vy === 'number'){
        b.px += b.vx * dt * _bulletSpeedMul;
        b.py += b.vy * dt * _bulletSpeedMul;
      } else {
        b.px += b.dir.x * b.speed * dt * _bulletSpeedMul;
        b.py += b.dir.y * b.speed * dt * _bulletSpeedMul;
        if(_bulletSpeedMul<1 && Math.random()<0.3){
          state.fx.push({x:b.px,y:b.py,vx:(Math.random()-0.5)*20,vy:(Math.random()-0.5)*20,
            life:0.14,max:0.14,color:'#c0d8ff',size:2,grav:0,_circle:true});
        }
      }
      const tx = Math.floor(b.px / TILE);
      const ty = Math.floor(b.py / TILE);
      const bulletHitsTile = (tileX, tileY) => bulletPathHitsTile(prevPx, prevPy, b.px, b.py, tileX, tileY);
      // In coop, bullets cannot pass through the other player. If a player's
      // bullet collides with the other cowboy's tile, simply remove it.
      if (state && state.coop){
        if (b.src === 'player' && state.player2 && state.player2.hp > 0){
          if (bulletHitsTile(state.player2.x, state.player2.y)){ b.alive = false; continue; }
        }
        if (b.src === 'player2' && state.player && state.player.hp > 0){
          if (bulletHitsTile(state.player.x, state.player.y)){ b.alive = false; continue; }
        }
      }
      // ─── Teleporte de projétil via portal ────────────────────────
      // Bala mantém mesma direção de movimento ao atravessar o portal.
      if(state.portals&&state.portals.blue&&state.portals.orange&&!b._justPortaled){
        const _pb2=state.portals.blue, _po2=state.portals.orange;
        // Detecta colisão apenas pelo tile atual (simples e correto)
        let _ptarget=null;
        if(tx===_pb2.x&&ty===_pb2.y){ _ptarget=_po2; }
        else if(tx===_po2.x&&ty===_po2.y){ _ptarget=_pb2; }
        if(_ptarget){
          // Direção da bala: lê b.dir se disponível (player/sentry), senão vx/vy.
          // Mantém diagonais quando a bala entra no portal nesse ângulo.
          let _outX=0, _outY=0;
          const _hasVxVy=(typeof b.vx==='number'&&typeof b.vy==='number');
          if(b.dir&&(b.dir.x!==0||b.dir.y!==0)){
            _outX = b.dir.x === 0 ? 0 : (b.dir.x > 0 ? 1 : -1);
            _outY = b.dir.y === 0 ? 0 : (b.dir.y > 0 ? 1 : -1);
          } else if(_hasVxVy&&(b.vx!==0||b.vy!==0)){
            _outX = Math.abs(b.vx) < 0.001 ? 0 : (b.vx > 0 ? 1 : -1);
            _outY = Math.abs(b.vy) < 0.001 ? 0 : (b.vy > 0 ? 1 : -1);
          } else { _outX=1; } // fallback: vai para a direita
          // Tile de saída: portal destino + mesma direção da bala
          const _ex=_ptarget.x+_outX, _ey=_ptarget.y+_outY;
          if(inBounds(_ex,_ey)&&!isBlocked(_ex,_ey)){
            b.px=_ex*TILE+TILE/2; b.py=_ey*TILE+TILE/2;
          } else {
            // Fallback: tenta outras saídas livres ao redor do portal destino
            let _placed=false;
            for(const [_sx,_sy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
              const _fx=_ptarget.x+_sx, _fy=_ptarget.y+_sy;
              if(inBounds(_fx,_fy)&&!isBlocked(_fx,_fy)){
                b.px=_fx*TILE+TILE/2; b.py=_fy*TILE+TILE/2;
                _outX=_sx; _outY=_sy; _placed=true; break;
              }
            }
            if(!_placed){ b.alive=false; continue; } // sem saída: mata a bala
          }
          // Atualiza velocidade/direção para continuar o movimento
          if(_hasVxVy){
            const _bspd=Math.hypot(b.vx,b.vy)||(b.speed||350);
            b.vx=_outX*_bspd; b.vy=_outY*_bspd;
          }
          if(b.dir){ b.dir={x:_outX,y:_outY}; }
          b._justPortaled=true;
          // FX mini-burst colorido na saída
          const _fxCol=(_ptarget===_po2)?'#60c0ff':'#ffb060';
          for(let _bi2=0;_bi2<10;_bi2++){const _a2=Math.random()*Math.PI*2,_s2=35+Math.random()*55,_l2=0.14+Math.random()*0.14;state.fx.push({x:b.px,y:b.py,vx:Math.cos(_a2)*_s2,vy:Math.sin(_a2)*_s2,life:_l2,max:_l2,color:_bi2%2===0?'#ffffff':_fxCol,size:1.5+Math.random()*2,grav:0});}
          continue;
        }
      }
      // Limpar flag quando sai do tile do portal
      if(b._justPortaled){
        const _pb3=state.portals&&state.portals.blue, _po3=state.portals&&state.portals.orange;
        const _atPortal=((_pb3&&tx===_pb3.x&&ty===_pb3.y)||(_po3&&tx===_po3.x&&ty===_po3.y));
        if(!_atPortal) b._justPortaled=false;
      }

      // Water tiles don't stop bullets
      const _btv = (inBounds(tx,ty)&&state.map[ty]) ? state.map[ty][tx] : 0;
      if (!inBounds(tx,ty) || (_btv!==6 && isBlocked(tx,ty))){
        // Balas de torre não colidem com a própria torre de origem
        let _ownTower = false;
        if (b.src === 'sentry' && b._originX !== undefined){
          _ownTower = (tx === b._originX && ty === b._originY);
        }
        // Bala Translúcida: balas do jogador atravessam barricadas e torretas
        let _transPass = false;
        if(!_ownTower && state.balaTranslucida && (b.src==='player'||b.src==='player2')){
          const _mapBlocked = (state.map[ty] && state.map[ty][tx] !== 0 && state.map[ty][tx] !== 9);
          if(!_mapBlocked && inBounds(tx,ty)) _transPass = true;
        }
        if (!_ownTower && !_transPass){
          // ── Ricochete: bala do jogador quica na parede ──
          if ((b.src==='player'||b.src==='player2') && (b.bounceLeft||0) > 0){
            b.bounceLeft--;
            const _bHasVxVy = (typeof b.vx === 'number' && typeof b.vy === 'number');
            const _dirX = _bHasVxVy ? b.vx : (b.dir ? b.dir.x * b.speed : 0);
            const _dirY = _bHasVxVy ? b.vy : (b.dir ? b.dir.y * b.speed : 0);
            const _prevTx = Math.floor((b.px - (_dirX > 0 ? 1 : -1) * 0.5) / TILE);
            const _prevTy = Math.floor((b.py - (_dirY > 0 ? 1 : -1) * 0.5) / TILE);
            const _blockedX = ricochetAxisBlocked(tx, _prevTy);
            const _blockedY = ricochetAxisBlocked(_prevTx, ty);
            if (_bHasVxVy){
              if (_blockedX && !_blockedY){ b.vx = -b.vx; }
              else if (_blockedY && !_blockedX){ b.vy = -b.vy; }
              else { b.vx = -b.vx; b.vy = -b.vy; }
            }
            if (b.dir){
              const _newDx = _bHasVxVy ? (b.vx > 0 ? 1 : b.vx < 0 ? -1 : 0) : (_blockedX ? -b.dir.x : b.dir.x);
              const _newDy = _bHasVxVy ? (b.vy > 0 ? 1 : b.vy < 0 ? -1 : 0) : (_blockedY ? -b.dir.y : b.dir.y);
              b.dir = { x: _newDx, y: _newDy };
            }
            b.px -= (_dirX / (Math.hypot(_dirX,_dirY)||1)) * (TILE * 0.55);
            b.py -= (_dirY / (Math.hypot(_dirX,_dirY)||1)) * (TILE * 0.55);
            for(let _ri=0;_ri<6;_ri++){
              const _ra=Math.random()*Math.PI*2;
              state.fx.push({x:b.px,y:b.py,vx:Math.cos(_ra)*60,vy:Math.sin(_ra)*60,life:0.12,max:0.12,color:'#ffe066',size:1.8,grav:0});
            }
            try{ beep(1200, 0.03, 'square', 0.03); }catch(_){}
            continue;
          }
          b.alive = false; continue;
        }
      }
            // Trail especial do projétil do boss
      if (b.src === 'boss'){
        const _pfCyan = (b.tint === "#5ee8ff" || b.tint === "#b8f6ff" || b._pfBurst);
        if (Math.random() < 0.75){
          state.fx.push({
            x: b.px, y: b.py,
            vx: (Math.random()*2-1)*25,
            vy: (Math.random()*2-1)*25,
            life: 0.16, max: 0.16,
            color: _pfCyan ? (Math.random()<0.55 ? "#7ee8ff" : "#c8ffff") : ((Math.random()<0.55) ? "#b91414" : "#ff2d2d"),
            size: 2.0,
            grav: 0
          });
        }
                // bateu em obstáculo? (cacto/pedra etc.) -> explode e some
        if (isBlocked(tx,ty) && !(tx===state.player.x && ty===state.player.y)){
          b.alive = false;
          for (let i=0;i<18;i++){
            const ang = Math.random()*Math.PI*2;
            const spd = 110 + Math.random()*220;
            const life = 0.14 + Math.random()*0.18;
            state.fx.push({
              x: b.px, y: b.py,
              vx: Math.cos(ang)*spd,
              vy: Math.sin(ang)*spd,
              life, max: life,
              color: _pfCyan ? (Math.random()<0.55 ? "#9ff0ff" : "#ffffff") : ((Math.random()<0.55) ? "#b91414" : "#ff2d2d"),
              size: 2.3,
              grav: 120
            });
          }
          spawnRedShotFX(tx,ty,false);
          beep(190,0.03,"square",0.035);
          beep(130,0.05,"triangle",0.03);
          continue;
        }

        // Boss bullet hits: check both players in coop
        if (bulletHitsTile(state.player.x, state.player.y)){
          // Hit player1
          b.alive = false;
          const dmg = b.dmg || Math.round(state.baseDamage*1.8);
          if ((state.playerInvulT||0) <= 0){
          state.player.hp = Math.max(0, state.player.hp - dmg);
          state.playerFlashT = 0.6;
          state.playerWarnT = 1.0;
          spawnPlayerHitFX(state.player.x, state.player.y);
          spawnRedShotFX(state.player.x, state.player.y, false);
          state.shakeT = Math.min(0.65, (state.shakeT||0) + 0.38);
          state.shakeMag = Math.max(3.6, state.shakeMag||0);
          beep(120,0.06,"triangle",0.04);
          if (state.player.hp <= 0){
            // Trigger death popup and sound once
            if (!state.dead1){
              state.dead1 = true;
              try{ pushMultiPopup("COWBOY ABATIDO!", "#ff4d4d", state.player.x*TILE + TILE/2, state.player.y*TILE + 10); }catch(_){}
              try{ noise(0.08, 0.05); beep(90, 0.08, "square", 0.03); }catch(_){}
            }
            // In coop, only end game if both players down; otherwise revival may occur
            if (state.coop){
              // nothing here; handleRevive will detect both dead
            } else {
              state.running = false;
              state.gameOverReason = "player";
              musicStop();
              try{ window._expSystem&&window._expSystem.onGameOver(state,'player'); }catch(_){}
            }
          }
          } // end playerInvulT check
          continue;
        } else if (state.coop && state.player2 && bulletHitsTile(state.player2.x, state.player2.y)){
          // Hit player2
          b.alive = false;
          const dmg2 = b.dmg || Math.round(state.baseDamage*1.8);
          state.player2.hp = Math.max(0, state.player2.hp - dmg2);
          // reuse player flash timers for second player for now (we only have one set of timers)
          state.playerFlashT = 0.6;
          state.playerWarnT = 1.0;
          spawnPlayerHitFX(state.player2.x, state.player2.y);
          spawnRedShotFX(state.player2.x, state.player2.y, false);
          state.shakeT = Math.min(0.65, (state.shakeT||0) + 0.38);
          state.shakeMag = Math.max(3.6, state.shakeMag||0);
          beep(120,0.06,"triangle",0.04);
          if (state.player2.hp <= 0){
            // Trigger death popup and sound once for player2
            if (!state.dead2){
              state.dead2 = true;
              try{ pushMultiPopup("COWBOY ABATIDO!", "#ff4d4d", state.player2.x*TILE + TILE/2, state.player2.y*TILE + 10); }catch(_){}
              try{ noise(0.08, 0.05); beep(90, 0.08, "square", 0.03); }catch(_){}
            }
            // In coop, handleRevive will decide if game over
            // do not immediately end game here
          }
          continue;
        }
      }

// Boss2 (Gêmeo 2)
      if(b.src!=='boss' && state.boss2 && state.boss2.alive && bulletHitsTile(state.boss2.x, state.boss2.y)){
        state.boss2.hp -= b.dmg;
        if(state.boss2.hp<=0){
          state.boss2.alive=false;
          if(b.src==='player'||b.src==='player2'){spawnDeathFX(state.boss2.x,state.boss2.y,true,b.src);}
          else{spawnAllyDeathFX(state.boss2.x,state.boss2.y,true);}
          addScore(b.src,(b.src==='player'||b.src==='player2')?75:38);
          beep(220,0.12,"square",0.06);
          // Esconde row do gêmeo 2 imediatamente
          try{const _r2=document.getElementById('geminiRow2');if(_r2)_r2.style.display='none';}catch(_){}
          if(state.boss&&state.boss.alive){
            state.boss._enraged=true; state.boss.speedMul=3.74;
            state.boss._stepSkip2=0;
            pushMultiPopup('FÚRIA!','#ff2020',state.boss.x*TILE+TILE/2,state.boss.y*TILE-4);
          }
          if(!state.boss||!state.boss.alive){
            try{
      const _gbw=document.getElementById('geminiBarsWrap');if(_gbw)_gbw.style.display='none';
      const _bmr2=document.getElementById('bossRowMain');if(_bmr2)_bmr2.style.display='flex';
      const _r1=document.getElementById('geminiRow1');if(_r1)_r1.style.display='flex';
      const _r2=document.getElementById('geminiRow2');if(_r2)_r2.style.display='flex';
    }catch(_){}
            bossBar.style.visibility='hidden'; bossBarFill.style.width='0%';
            bossName.style.visibility='hidden';
            musicStop();musicStart();endWave();
          } else {
            // geminiRow2 já foi escondido acima
          }
        } else {
          spawnBossHitFX(state.boss2.x,state.boss2.y);
          beep(240,0.05,"triangle",0.03);
          const _p2=Math.max(0,state.boss2.hp/state.boss2.maxhp*100);
          try{document.getElementById('geminiBar2Fill').style.width=_p2.toFixed(0)+'%';}catch(_){}
        }
        b.alive=false; continue;
      }
// Boss
      if (b.src !== 'boss' && state.boss && state.boss.alive && bulletHitsTile(state.boss.x, state.boss.y)){
      const _pfBoss = state.boss.name === "Pistoleiro Fantasma";
      const _canHitPfBoss = !_pfBoss || b.src==='player'||b.src==='player2'||(b.src==='ally'&&state.partnerIrVision);
      if (_pfBoss && !_canHitPfBoss){
        /* bala atravessa: torreta/xerife/aliado sem IR não “enxergam” o Pistoleiro Fantasma */
      } else if (maybePistoleiroFantasmaTeleportOnBullet(state.boss, b.src)){
        b.alive = false;
        continue;
      } else {
      state.boss.hp -= b.dmg;
    if (state.boss.hp <= 0){
      state.boss.alive = false;
      if(b.src==='player'||b.src==='player2'){spawnDeathFX(state.boss.x,state.boss.y,true,b.src);}
      else{spawnAllyDeathFX(state.boss.x,state.boss.y,true);}
      const _isGemeos=(state.boss.name==="Os Gêmeos");
      if(_isGemeos && state.boss2 && state.boss2.alive){
        // Gêmeo 1 morreu, gêmeo 2 ainda vivo → enraivece, NÃO acaba a wave
        addScore(b.src,(b.src==='player'||b.src==='player2')?75:38);
        beep(220,0.12,"square",0.06);
        state.boss2._enraged=true; state.boss2.speedMul=3.74;
        state.boss2._stepSkip=0; // resetar skip para mover imediatamente
        pushMultiPopup('FÚRIA!','#ff2020',state.boss2.x*TILE+TILE/2,state.boss2.y*TILE-4);
        try{const _r1=document.getElementById('geminiRow1');if(_r1)_r1.style.display='none';}catch(_){}
      } else if(_isGemeos){
        // Ambos os gêmeos mortos → acaba wave
        addScore(b.src,(b.src==='player'||b.src==='player2')?75:38);
        beep(220,0.12,"square",0.06); beep(196,0.18,"square",0.06);
        if(b.src==='player'||b.src==='player2'){spawnDeathFX(state.boss.x,state.boss.y,true,b.src);}
        else{spawnAllyDeathFX(state.boss.x,state.boss.y,true);}
        try{
      const _gbw=document.getElementById('geminiBarsWrap');if(_gbw)_gbw.style.display='none';
      const _bmr2=document.getElementById('bossRowMain');if(_bmr2)_bmr2.style.display='flex';
      const _r1=document.getElementById('geminiRow1');if(_r1)_r1.style.display='flex';
      const _r2=document.getElementById('geminiRow2');if(_r2)_r2.style.display='flex';
    }catch(_){}
        bossBar.style.visibility='hidden'; bossBarFill.style.width='0%';
        bossName.style.visibility='hidden'; bossName.style.opacity='0';
        musicStop(); musicStart(); endWave();
      } else {
        // Boss normal morre
        addScore(b.src,(b.src==='player'||b.src==='player2')?150:75);
        beep(220,0.12,"square",0.06); beep(196,0.18,"square",0.06);
        bossBarFill.style.width='0%';
        musicStop(); musicStart(); endWave();
      }
    } else {
      spawnBossHitFX(state.boss.x, state.boss.y);
      beep(240,0.05,"triangle",0.03);
      const pct = Math.max(0, state.boss.hp/state.boss.maxhp)*100;
      if(state.boss.name==="Os Gêmeos"){
        try{document.getElementById('geminiBar1Fill').style.width=pct.toFixed(0)+'%';}catch(_){}
        // bossBar fica escondida para os gêmeos — não atualizar
      } else {
        bossBarFill.style.width = pct.toFixed(0)+"%";
      }
    }
        b.alive = false; // boss sempre consome a bala (sem pierce)
        continue;
        }
      }
      // Normais
      for (const z of state.bandits){
        if (!z.alive) continue;
        if ((z.x === tx && z.y === ty) || bulletHitsTile(z.x, z.y)){
          // Fantasma: bala translúcida (jogador) ou parceiro com visão IR
          if (z.fantasma){
            const _canHitFantasma =
              ((b.src==='player'||b.src==='player2') && state.balaTranslucida) ||
              (b.src==='ally' && state.partnerIrVision);
            if (!_canHitFantasma){
              b.alive=false; break; // bala normal atravessa/é absorvida
            }
            z.hp-=b.dmg;
            // Som único de fantasma: ondulado
            try{
              const _ac=getAudio(); const _n=_ac.currentTime;
              const _osc=_ac.createOscillator(); _osc.type='sine';
              const _gn=_ac.createGain();
              _osc.connect(_gn).connect(_ac.destination);
              _osc.frequency.setValueAtTime(420,_n);
              _osc.frequency.exponentialRampToValueAtTime(180,_n+0.15);
              _osc.frequency.exponentialRampToValueAtTime(320,_n+0.32);
              _osc.frequency.exponentialRampToValueAtTime(120,_n+0.52);
              _gn.gain.setValueAtTime(0.18*settings.sfx,_n);
              _gn.gain.exponentialRampToValueAtTime(0.001,_n+0.55);
              _osc.start(_n); _osc.stop(_n+0.56);
            }catch(_){}
            if(z.hp>0){
              // Hit flash: partículas brancas/azuis
              const _hcx=z.x*TILE+TILE/2,_hcy=z.y*TILE+TILE/2;
              for(let _hi=0;_hi<8;_hi++){
                const _ha=Math.random()*Math.PI*2,_hs=35+Math.random()*45;
                state.fx.push({x:_hcx,y:_hcy,vx:Math.cos(_ha)*_hs,vy:Math.sin(_ha)*_hs-12,
                  life:0.28,max:0.28,color:_hi%2?'#a0c8ff':'#ffffff',size:2+Math.random()*1.5,grav:0});
              }
              b.alive=false; break;
            }
            // Morreu (3 hits)
            z.alive=false; state.enemiesAlive--;
            addScore(b.src,15);
            registerMultiKill(15,z.x,z.y);
            // Efeito de morte: usa animação equipada pelo jogador (igual a bandido normal)
            try{ spawnDeathFX(z.x,z.y,false,b.src); }catch(_){}
            // Som de morte de fantasma
            try{
              const _ac2=getAudio(); const _n2=_ac2.currentTime;
              const _o2=_ac2.createOscillator(); _o2.type='sine';
              const _g2=_ac2.createGain();
              _o2.connect(_g2).connect(_ac2.destination);
              _o2.frequency.setValueAtTime(500,_n2);
              _o2.frequency.exponentialRampToValueAtTime(80,_n2+0.7);
              _g2.gain.setValueAtTime(0.22*settings.sfx,_n2);
              _g2.gain.exponentialRampToValueAtTime(0.001,_n2+0.75);
              _o2.start(_n2); _o2.stop(_n2+0.8);
            }catch(_){}
            if(b.src==='player'||b.src==='player2'||(b.src==='ally'&&state.partnerIrVision)){
              state.shakeT=Math.min(0.4,(state.shakeT||0)+0.18);
              state.shakeMag=Math.max(2.0,state.shakeMag||0);
            }
            b.alive=false; break;
          }
          if (z.assassin && (b.src==="player" || b.src==="ally")){
            z.hp -= b.dmg;
            if (z.hp > 0){
              spawnAssassinHitFX(z.x, z.y);
              // Assassino absorve a bala — pierce NÃO atravessa (exige 2 tiros)
              b.alive = false;
              break;
            }
            if (z.hp <= 0){
              z.alive = false;
              addScore(b.src, (b.src === 'player' || b.src === 'player2') ? 12 : Math.floor(12/2));
              if(b.src==='ally'||b.src==='sentry'||b.src==='xerife'){ spawnAllyDeathFX(z.x,z.y,false); }else{ spawnDeathFX(z.x, z.y, false, b.src); }
              noise(0.05,0.03);
              beep(140,0.06,"sawtooth",0.04);
              if (b.src === 'player' || b.src === 'player2') {
                state.shakeT = Math.min(0.4, (state.shakeT||0) + 0.22);
                state.shakeMag = Math.max(2.4, state.shakeMag||0);
              }
              state.enemiesAlive--;
              if (b.src === 'player' || b.src === 'player2') {
                registerMultiKill(12, z.x, z.y);
              }
            }
            } else {
            z.alive = false;
            // Award bandit kill points: full for players (player1/player2), half for neutral sources
            addScore(b.src, (b.src === 'player' || b.src === 'player2') ? 10 : Math.floor(10/2));
            if(b.src==='ally'||b.src==='sentry'||b.src==='xerife'){ spawnAllyDeathFX(z.x,z.y,false); }else{ spawnDeathFX(z.x, z.y, false, b.src); }
            noise(0.05,0.03);
            beep(120,0.06,"sawtooth",0.04);
            // Apply screen shake for both players when either cowboy makes a kill
            if (b.src === 'player' || b.src === 'player2') {
              state.shakeT = Math.min(0.4, (state.shakeT||0) + 0.2);
              state.shakeMag = Math.max(2.2, state.shakeMag||0);
            }
            state.enemiesAlive--;
            // Count multi‑kills for both players
            if (b.src === 'player' || b.src === 'player2') {
              registerMultiKill(5, z.x, z.y);
            }
          }
          // Tiro Explosivo: chance de matar inimigos adjacentes (exceto assassinos)
          if ((state.explosiveLevel||0) > 0 && (b.src==='player'||b.src==='player2'||b.src==='ally'||b.src==='xerife'||b.src==='sentry')){
            const _expChances = [0, 0.10, 0.15, 0.20];
            const _chance = _expChances[Math.min(state.explosiveLevel,3)];
            if (Math.random() < _chance){
              const _ex = tx, _ey = ty;
              for (const _ez of state.bandits){
                if (!_ez.alive || _ez.assassin || _ez.fantasma) continue;
                if (Math.abs(_ez.x-_ex)<=1 && Math.abs(_ez.y-_ey)<=1 && !(_ez.x===_ex&&_ez.y===_ey)){
                  _ez.alive = false;
                  state.enemiesAlive--;
                  addScore(b.src, (b.src==='player'||b.src==='player2')?8:4);
                  registerMultiKill(8, _ez.x, _ez.y);
                  spawnDeathFX(_ez.x, _ez.y, true, b.src);
                }
              }
              const _ecx=_ex*TILE+TILE/2, _ecy=_ey*TILE+TILE/2;
              const _expHr = 1;
              const _expFxMul = 0.42;
              spawnBigExplosionFX(_ecx, _ecy, _expHr, _expFxMul);
              try{beep(60,0.18,'sawtooth',0.12);beep(80,0.15,'square',0.10);setTimeout(()=>beep(40,0.12,'sawtooth',0.08),60);setTimeout(()=>beep(100,0.10,'sine',0.06),120);}catch(_){}
              const _shakeScale = (0.144 + _expHr * 0.096) * _expFxMul;
              state.shakeT = Math.min(1.0, (state.shakeT || 0) + _shakeScale);
              state.shakeMag = Math.max(state.shakeMag || 0, (1.6 + _expHr * 0.96) * _expFxMul);
              if (!state.explosiveAoeFlashes) state.explosiveAoeFlashes = [];
              state.explosiveAoeFlashes.push({ x: _ex, y: _ey, halfR: _expHr, t: 0, maxT: 0.38 });
              pushMultiPopup('BOOM!','#ff6600',_ecx,_ey*TILE);
            }
          }
          if (b.pierceLeft > 0){ b.pierceLeft--; } else { b.alive = false; }
          break;
        }
      }
    }
    state.bullets = state.bullets.filter(b => b.alive);
    state.bandits = state.bandits.filter(z => z.alive);
  }

  function goldDamage(dt){
  const anySentryAlive = !!(state.sentries && state.sentries.some(t => (t.hp==null?4:t.hp) > 0));
  const anyDynaArmed = !!(state.dynaLevel >= 0 && state.dynamites && state.dynamites.some(d => d.armed));
  const gemeosEnrageDamage = 22; // dano dos Gêmeos em modo de fúria (ambos)
    // Boss2 dano ao ouro / jogador enraivecido
    if(state.boss2 && state.boss2.alive){
      const _m2=Math.abs(state.boss2.x-state.gold.x)+Math.abs(state.boss2.y-state.gold.y);
      if(_m2<=1 && !state.boss2._enraged && !(state.boss2.name==="Os Gêmeos" && state.boss2._enraged)){
        state.boss2.dmgTimer=(state.boss2.dmgTimer||0)+dt;
        if(state.boss2.dmgTimer>=1){
          state.boss2.dmgTimer=0;
          const _dmg2b=Math.round(state.baseDamage*(state.boss2.dmgMul||1.5));
          if((state.goldInvulT||0)<=0){state.gold.hp=Math.max(0,state.gold.hp-_dmg2b);spawnPlayerHitFX(state.gold.x,state.gold.y);beep(100,0.08,"sawtooth",0.05);state.goldFlashT=0.5;state.goldWarnT=1.0;state.shakeT=Math.min(0.6,(state.shakeT||0)+0.35);state.shakeMag=Math.max(3.0,state.shakeMag||0);if(state.gold.hp<=0)triggerSegundaChanceOrGameOver();}
        }
      }
      // Enraivecido: ataca jogador
      if(state.boss2._enraged){
        const _mp2=Math.abs(state.boss2.x-state.player.x)+Math.abs(state.boss2.y-state.player.y);
        if(_mp2<=1){
          state.boss2._pDmgT=(state.boss2._pDmgT||0)+dt;
          if(state.boss2._pDmgT>=1.2){
            state.boss2._pDmgT=0;
            if(state.player.hp>0&&(state.playerInvulT||0)<=0){
              state.player.hp=Math.max(0,state.player.hp-gemeosEnrageDamage);
              state.playerFlashT=0.5; state.playerInvulT=0.8; state.playerWarnT=1.0;
              state.shakeT=Math.min(0.55,(state.shakeT||0)+0.30); state.shakeMag=Math.max(3.0,state.shakeMag||0);
              beep(140,0.05,'triangle',0.035);
              spawnAssassinHitFX(state.boss2.x, state.boss2.y);
              spawnPlayerHitFX(state.player.x, state.player.y);
              if(state.player.hp<=0) triggerSegundaChanceOrGameOver();
            }
          }
        }
      }
    }
    if (state.boss && state.boss.alive){
      // Gêmeo 1 enraivecido ataca jogador
      if(state.boss.name==="Os Gêmeos"&&state.boss._enraged){
        const _mp1=Math.abs(state.boss.x-state.player.x)+Math.abs(state.boss.y-state.player.y);
        if(_mp1<=1){
          state.boss._pDmgT=(state.boss._pDmgT||0)+dt;
          if(state.boss._pDmgT>=1.2){
            state.boss._pDmgT=0;
            if(state.player.hp>0&&(state.playerInvulT||0)<=0){
              state.player.hp=Math.max(0,state.player.hp-gemeosEnrageDamage);
              state.playerFlashT=0.5; state.playerInvulT=0.8; state.playerWarnT=1.0;
              state.shakeT=Math.min(0.55,(state.shakeT||0)+0.30); state.shakeMag=Math.max(3.0,state.shakeMag||0);
              beep(140,0.05,'triangle',0.035); // som idêntico ao assassino
              spawnAssassinHitFX(state.boss.x, state.boss.y);
              spawnPlayerHitFX(state.player.x, state.player.y);
              if(state.player.hp<=0) triggerSegundaChanceOrGameOver();
            }
          }
        }
      }
      if (state.boss.name !== "Pistoleiro Fantasma" && !(state.boss.name==="Os Gêmeos" && state.boss._enraged)){
        const m = Math.abs(state.boss.x - state.gold.x) + Math.abs(state.boss.y - state.gold.y);
      if (m <= 1){
        state.boss.dmgTimer += dt;
        if (state.boss.dmgTimer >= 1){
          state.boss.dmgTimer = 0;
          const dmg = Math.round(state.baseDamage * state.boss.dmgMul);
          if((state.goldInvulT||0)<=0){const _dmg2=dmg;state.gold.hp=Math.max(0,state.gold.hp-_dmg2);spawnPlayerHitFX(state.gold.x,state.gold.y);beep(100,0.08,"sawtooth",0.05);state.goldFlashT=0.5;state.goldWarnT=1.0;state.shakeT=Math.min(0.6,(state.shakeT||0)+0.35);state.shakeMag=Math.max(3.0,state.shakeMag||0);if(state.gold.hp<=0)triggerSegundaChanceOrGameOver();}
          if(state.gold.hp<=0)triggerSegundaChanceOrGameOver();
        }
      }
      }

    }
    for (const z of state.bandits){
      if (!z.alive || z.assassin) continue;
      const manhattan = Math.abs(z.x - state.gold.x) + Math.abs(z.y - state.gold.y);
      if (manhattan <= 1){
        z.dmgTimer += dt;
        if (z.dmgTimer >= 1){
          z.dmgTimer = 0;
          if((state.goldInvulT||0)<=0){state.gold.hp=Math.max(0,state.gold.hp-state.baseDamage);spawnPlayerHitFX(state.gold.x,state.gold.y);beep(160,0.05,"triangle",0.03);state.goldFlashT=0.5;state.goldWarnT=1.0;state.shakeT=Math.min(0.6,(state.shakeT||0)+0.28);state.shakeMag=Math.max(2.8,state.shakeMag||0);if(state.gold.hp<=0)triggerSegundaChanceOrGameOver();}
        }
      }
    }
  }
function assassinDamage(dt){
  for (const z of state.bandits){
    if (!z.alive || !z.assassin) continue;
    // Determine which cowboy is closer (Manhattan distance). Assassinos focam
    // apenas um alvo por vez. Se ambos estiverem fora de alcance, reset timers.
    const m1 = Math.abs(z.x - state.player.x) + Math.abs(z.y - state.player.y);
    const hasP2 = (state.coop && state.player2);
    const m2 = hasP2 ? (Math.abs(z.x - state.player2.x) + Math.abs(z.y - state.player2.y)) : Infinity;
    let target = null;
    let timerKey = null;
    if (hasP2){
      // choose the closer one within range 1
      if (m1 <= 1 && (m1 <= m2 || m2 > 1)){
        target = state.player; timerKey = 'dmgTimer';
      } else if (m2 <= 1){
        target = state.player2; timerKey = '_dmgTimer2';
      }
    } else {
      // single-player: only player1 matters
      if (m1 <= 1){ target = state.player; timerKey = 'dmgTimer'; }
    }
    // If no target in range, reset timers and continue
    if (!target){
      z.dmgTimer = 0;
      if (hasP2) z._dmgTimer2 = 0;
      continue;
    }
    // Increment the appropriate damage timer and apply damage every second
    z[timerKey] = (z[timerKey]||0) + dt;
    // Reset other timer when not the target
    if (timerKey === 'dmgTimer' && hasP2){ z._dmgTimer2 = 0; }
    if (timerKey === '_dmgTimer2'){ z.dmgTimer = 0; }
    if (z[timerKey] >= 1){
      z[timerKey] = 0;
      // Skip damage if this target is the player and invulnerable
      const isPlayer1 = (target === state.player);
      if (isPlayer1 && (state.playerInvulT||0) > 0){
        // invulnerable — skip damage but reset timer
      } else {
        // Apply damage to the chosen target
        target.hp = Math.max(0, target.hp - state.baseDamage);
        beep(140,0.05,"triangle",0.035);
        state.playerFlashT = 0.5;
        state.playerWarnT = 1.0;
        spawnPlayerHitFX(target.x, target.y);
        state.shakeT = Math.min(0.55, (state.shakeT||0) + 0.30);
        state.shakeMag = Math.max(3.0, state.shakeMag||0);
        if (target.hp <= 0){
          if (!state.dead1){ state.dead1 = true; }
          if (!state.coop){
            state.running = false;
            state.gameOverReason = "player";
            musicStop();
            try{ window._expSystem&&window._expSystem.onGameOver(state,'player'); }catch(_){}
          }
          // In coop, handleRevive will determine game over
        }
      }
    }
  }
}


  
  function isAdjacent4(ax, ay, bx, by){
    return Math.abs(ax-bx) + Math.abs(ay-by) === 1;
  }

  // Efeitos visuais de morte para aliados/cachorro — sempre usa Padrão (id=0)
  function spawnAllyDeathFX(tx, ty, big=false){
    const cx = tx * TILE + TILE/2;
    const cy = ty * TILE + TILE/2;
    try {
      const _kp = (window._spawnKillParticles||_spawnKillParticles)(0, cx, cy, true);
      for (const p of _kp){
        state.fx.push({
          x:p.x, y:p.y, vx:p.vx||0, vy:p.vy||0,
          life:p.life, max:p.max,
          color:p.color||'#fff',
          size: big ? (p.size||3) : (p.size||3)*0.75,
          grav:p.grav||0,
          hat: p.hat||false,
          _circle: p._type==='circle'
        });
      }
    } catch(_e) {
      const count = big ? 20 : 10;
      for (let i=0;i<count;i++){
        const ang = Math.random()*Math.PI*2;
        const spd = 40 + Math.random()*60;
        const life = 0.5 + Math.random()*0.3;
        state.fx.push({ x:cx, y:cy, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd-20, life, max:life,
          color:Math.random()<0.5?'#c8a870':'#a07840', size:3, grav:80 });
      }
    }
  }

  // Efeitos visuais de morte (poeira/chapéu) para bandidos e bosses
  function spawnDeathFX(tx, ty, big=false, bulletSrc){
    const cx = tx * TILE + TILE/2;
    const cy = ty * TILE + TILE/2;
    const _onlineCoop = false;
    // Animação de abate: conta no coop local — Cowboy 2 usa sempre o Padrão (0)
    let _kid = (state && typeof state.equippedKill === 'number' && state.equippedKill !== -1) ? state.equippedKill : 0;
    if (state && state.coop && !_onlineCoop && bulletSrc === 'player2') _kid = 0;
    // Gera partículas via sistema de kill anims (escala big=true para in-game)
    try {
      const _kp = (window._spawnKillParticles||_spawnKillParticles)(_kid, cx, cy, true);
      for (const p of _kp){
        // mapeia _type:circle para o sistema de fx (usa flag _circle)
        state.fx.push({
          x:p.x, y:p.y, vx:p.vx||0, vy:p.vy||0,
          life:p.life, max:p.max,
          color:p.color||'#fff',
          size: big ? (p.size||3) : (p.size||3)*0.75,
          grav:p.grav||0,
          hat: p.hat||false,
          _circle: p._type==='circle'
        });
      }
    } catch(_e) {
      // fallback seguro — padrão original
      const count = big ? 26 : 12;
      for (let i=0;i<count;i++){
        const ang = Math.random()*Math.PI*2;
        const spd = (big? 70:55) + Math.random()*(big? 90:60);
        const life = (big? 0.9:0.6) + Math.random()*0.25;
        state.fx.push({ x:cx, y:cy, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd-(big?30:20), life, max:life,
          color: big?"#c97a2b":(Math.random()<0.25?"#b91414":"#a7793a"), size:big?4:3, grav:85 });
      }
      state.fx.push({ x:cx, y:cy-4, vx:(Math.random()*2-1)*60, vy:-120, life:0.8, max:0.8, hat:true, rot:0, vrot:(Math.random()*2-1)*6, grav:220 });
    }
  }

  
function updateGoldShine(dt){
  if (!state || !state.running) return;
  if (!state.goldSpark) state.goldSpark = {t:0};
  state.goldSpark.t += dt;
  if (state.goldSpark.t > 0.12){
    state.goldSpark.t = 0;
    if (Math.random() < 0.25){
      const gx = state.gold.x*TILE + TILE/2;
      const gy = state.gold.y*TILE + TILE/2;

    // Snapshot para colisão entre inimigos (evita empilhar)
    if (state.boss && state.boss.alive){ state.boss.prevX = state.boss.x; state.boss.prevY = state.boss.y; }
    for (const e of state.bandits){ if (!e.alive) continue; e.prevX = e.x; e.prevY = e.y; }
      const goldAuraFx = _spawnAuraParticles(4, gx, gy, state.t||0);
      for (let i=0; i<goldAuraFx.length; i++) state.fx.push(goldAuraFx[i]);
    }
  }
}

function updateFXParticles(dt){
    const keep = [];
    for (const p of state.fx){
      p.life -= dt;
      if (p.life <= 0) continue;
      // física simples
      if (!p.hat){
        p.vy += (p.grav!=null?p.grav:120)*dt;
        p.x += p.vx*dt; p.y += p.vy*dt;
      } else {
        p.vy += (p.grav!=null?p.grav:220)*dt;
        p.x += p.vx*dt; p.y += p.vy*dt;
        p.rot = (p.rot||0) + (p.vrot||0)*dt;
      }
      keep.push(p);
    }
    state.fx = keep;
  }

function updateFX(dt){

    // Player aura particles (cosmetic)
    if(state && state.player && state.player.hp > 0 && typeof state.equippedAura === 'number' && state.equippedAura >= 0){
      if(!state._playerAuraT) state._playerAuraT = 0;
      state._playerAuraT += dt;
      if(state._playerAuraT > 0.09){
        state._playerAuraT -= 0.09;
        var _acx = state.player.x*TILE + TILE/2;
        var _acy = state.player.y*TILE + TILE/2;
        var _aps = (window._spawnAuraParticles||function(){return[];})(state.equippedAura, _acx, _acy, state.t||0);
        for(var _ai=0;_ai<_aps.length;_ai++) state.fx.push(_aps[_ai]);
      }
    }

    // Animação de split da barra dos Gêmeos
    if(state.boss && state.boss.alive && state.boss.name==="Os Gêmeos" && !state._gemeosSplit){
      state._gemeosSplitT=(state._gemeosSplitT||0)+dt;
      if(state._gemeosSplitT>=2.5){
        state._gemeosSplit=true;
        // Transição: esconde barra única, mostra duas barras
        try{
          // Split: sem delay, imediato com mola
          const _bmr=document.getElementById('bossRowMain');
          if(_bmr)_bmr.style.display='none';
          const _gbw=document.getElementById('geminiBarsWrap');
          const _hp1=state.boss&&state.boss.alive?Math.max(0,state.boss.hp/state.boss.maxhp*100).toFixed(0):'0';
          const _hp2=state.boss2&&state.boss2.alive?Math.max(0,state.boss2.hp/state.boss2.maxhp*100).toFixed(0):'0';
          const _g1f=document.getElementById('geminiBar1Fill');
          const _g2f=document.getElementById('geminiBar2Fill');
          if(_g1f){_g1f.style.transition='none';_g1f.style.width='0%';}
          if(_g2f){_g2f.style.transition='none';_g2f.style.width='0%';}
          if(_gbw){
            _gbw.style.opacity='0'; _gbw.style.transform='scaleX(0.1)';
            _gbw.style.transition='none'; _gbw.style.display='flex';
            requestAnimationFrame(function(){requestAnimationFrame(function(){
              _gbw.style.transition='opacity 0.15s,transform 0.2s cubic-bezier(0.2,1.6,0.5,1)';
              _gbw.style.opacity='1'; _gbw.style.transform='scaleX(1)';
              if(_g1f){_g1f.style.transition='width 0.2s ease-out';_g1f.style.width=_hp1+'%';}
              if(_g2f){_g2f.style.transition='width 0.2s ease-out';_g2f.style.width=_hp2+'%';}
              try{beep(330,0.06,'sawtooth',0.05);setTimeout(()=>beep(220,0.07,'square',0.05),60);setTimeout(()=>beep(440,0.05,'triangle',0.04),120);}catch(_){}
            });});
          }
        }catch(_){}
      }
    }
    // Aura vermelha de sangue dos gêmeos enraivecidos
    if(!state._gemEnrageT) state._gemEnrageT=0;
    state._gemEnrageT+=dt;
    if(state._gemEnrageT>0.10){
      state._gemEnrageT=0;
      for(const _gb of [state.boss, state.boss2]){
        if(!_gb||!_gb.alive||!_gb._enraged) continue;
        const _gcx=_gb.x*TILE+TILE/2, _gcy=_gb.y*TILE+TILE/2;
        for(let _gi=0;_gi<3;_gi++){
          const _ga=Math.random()*Math.PI*2, _gr=8+Math.random()*8;
          state.fx.push({x:_gcx+Math.cos(_ga)*_gr,y:_gcy+Math.sin(_ga)*_gr,
            vx:(Math.random()-0.5)*25,vy:-18-Math.random()*22,
            life:0.4+Math.random()*0.25,max:0.5,
            color:_gi%2?'#ff2020':'#cc1010',size:2.5+Math.random()*2,grav:30,_circle:true});
        }
      }
    }
    // Timer de invocação do Pregador — dt-based (suave, pára quando pausado)
    if(state.boss && state.boss.alive && state.boss.name==='O Pregador'){
      if(state.boss._summonT==null) state.boss._summonT=0;
      state.boss._summonT += dt;
      // Popup uma vez quando barra começa a encher
      if(state.boss._summonT >= 6.5 && !state.boss._summonPopupSent){
        state.boss._summonPopupSent=true;
        pushMultiPopup('INVOCANDO!','#f3d23b',state.boss.x*TILE+TILE/2,state.boss.y*TILE-4);
      }
    }
    pistoleiroFantasmaCombatUpdate(dt);
    // Aura do Pregador (partículas brancas flutuando ao redor)
    if(state.boss && state.boss.alive && state.boss.name==="O Pregador"){
      if(!state._pregAuraT) state._pregAuraT=0;
      state._pregAuraT+=dt;
      if(state._pregAuraT>0.15){
        state._pregAuraT=0;
        const _bx=state.boss.x*TILE+TILE/2, _by=state.boss.y*TILE+TILE/2;
        for(let _pai=0;_pai<2;_pai++){
          const _pa=(state.t||0)*0.8+_pai*Math.PI;
          const _pr=18+Math.random()*20;
          state.fx.push({
            x:_bx+Math.cos(_pa)*_pr, y:_by+Math.sin(_pa)*_pr*0.6,
            vx:(Math.random()-0.5)*12, vy:-10-Math.random()*12,
            life:0.6+Math.random()*0.4, max:0.8,
            color:_pai%2?'#e8e0d0':'#c0b898', size:2+Math.random()*2, grav:-8, _circle:true
          });
        }
      }
    }
    // Assassin aura particles
    if (!state._assassinAuraT) state._assassinAuraT = 0;
    state._assassinAuraT += dt;
    if (state._assassinAuraT > 0.18){
      state._assassinAuraT = 0;
      for (const z of state.bandits){
        if (!z.alive || !z.assassin) continue;
        const cx = z.x*TILE + TILE/2, cy = z.y*TILE + TILE/2;
        const cnt = 1;
        for (let i=0;i<cnt;i++){
          const ang = Math.random()*Math.PI*2;
          const r = 4 + Math.random()*6;
          const x = cx + Math.cos(ang)*r, y = cy + Math.sin(ang)*r;
          state.fx.push({ x, y, vx: (Math.random()-0.5)*10, vy: -25 - Math.random()*20, life: 0.45, max:0.45, color:"#111", size: 2, grav: 0 });
        }
      }
    }
    // Aura Fantasma (id=14 da loja): usa exatamente _spawnAuraParticles igual ao jogador
    if (!state._fantasmaAuraT) state._fantasmaAuraT = 0;
    state._fantasmaAuraT += dt;
    if (state._fantasmaAuraT > 0.09){
      state._fantasmaAuraT = 0;
      for (const z of state.bandits){
        if (!z.alive || !z.fantasma) continue;
        const _fcx = z.x*TILE + TILE/2, _fcy = z.y*TILE + TILE/2;
        const _fps = (window._spawnAuraParticles||function(){return[];})(14, _fcx, _fcy, state.t||0);
        for(let _fpi=0;_fpi<_fps.length;_fpi++) state.fx.push(_fps[_fpi]);
      }
      if (state.boss && state.boss.alive && state.boss.name === "Pistoleiro Fantasma"){
        const _bcx = state.boss.x*TILE + TILE/2, _bcy = state.boss.y*TILE + TILE/2;
        const _bpf = (window._spawnAuraParticles||function(){return[];})(14, _bcx, _bcy, state.t||0);
        for (let _bi=0; _bi<_bpf.length; _bi++) state.fx.push(_bpf[_bi]);
      }
    }

    updateFXParticles(dt);
  }

  function drawFX(ctx){
    for (const p of state.fx){
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      if (p.hat){
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot||0);
        ctx.fillStyle = "#4d2f0a";
        ctx.fillRect(-6,-2,12,4); // aba
        ctx.fillRect(-4,-6,8,4);  // topo
        ctx.restore();
      } else if (p._circle) {
        ctx.fillStyle = p.color || "#a7793a";
        const _cr = Math.max(0.5,(p.size||2)/2);
        ctx.beginPath(); ctx.arc(p.x, p.y, _cr, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.fillStyle = p.color || "#a7793a";
        ctx.fillRect(p.x-(p.size||2)/2, p.y-(p.size||2)/2, (p.size||2), (p.size||2));
      }
      ctx.globalAlpha = 1;
    }
  }


  // Impacto em Boss: faíscas/poeira rápidas
  function spawnBossHitFX(tx, ty){
    const cx = tx * TILE + TILE/2;
    const cy = ty * TILE + TILE/2;
    for (let i=0;i<10;i++){
      const ang = Math.random()*Math.PI*2;
      const spd = 80 + Math.random()*80;
      const life = 0.25 + Math.random()*0.15;
      state.fx.push({
        x: cx, y: cy,
        vx: Math.cos(ang)*spd,
        vy: Math.sin(ang)*spd - 30,
        life, max: life,
        color: i%2? "#ffd36b":"#c23b22",
        size: 2,
        grav: 220
      });
    }
  }

function updateScoreOverTime(dt){
    state.timeScoreTimer += dt;
    if (state.timeScoreTimer >= 1){
      const ticks = Math.floor(state.timeScoreTimer);
      state.timeScoreTimer -= ticks;
      // award passive time points; split evenly in coop
      addScore('time', ticks);
    }
  }

  // Tumbleweeds (70% menos)
  function spawnTumbleweed(){
    const side = Math.random() < 0.5 ? "left" : "right";
    const y = randInt(1, GRID_H-2) * TILE + randInt(4, 24);
    const x = side==="left" ? -20 : CANVAS_W+20;
    const dir = side==="left" ? 1 : -1;
    const speed = randInt(30, 60);
    const rot = Math.random()*Math.PI*2;
    state.tumbleweeds.push({x, y, dir, speed, rot});
  }
  function updateTumbleweeds(dt){
    // Only spawn or update tumbleweeds on the desert and canyon maps.
    // On all other maps the list is cleared and no spawn occurs.
    const mId = window.currentMapId || '';
    if (mId !== 'desert' && mId !== 'canyon'){
      state.tumbleweeds = [];
      return;
    }
    // spawn chance scales with dt (approx 0.18 per second).
    if (Math.random() < dt * 0.18){ spawnTumbleweed(); }
    for (const t of state.tumbleweeds){
      t.x += t.dir * t.speed * dt;
      t.rot += dt * t.dir * 2;
    }
    // remove off‑screen tumbleweeds
    state.tumbleweeds = state.tumbleweeds.filter(t => t.x>-40 && t.x<CANVAS_W+40);
  }

  // === Snowflakes ===
  // ─── Swamp: fireflies, fog clouds ─────────────────────────────
  function spawnFirefly(){
    if(!state.fireflies) state.fireflies=[];
    const x = Math.random() * CANVAS_W;
    const y = Math.random() * CANVAS_H;
    const angle = Math.random() * Math.PI * 2;
    const speed = 12 + Math.random() * 20;
    const size = 1.2 + Math.random() * 1.8;
    const life = 3.0 + Math.random() * 4.0;
    const pulseRate = 1.5 + Math.random() * 3.0;
    const phase = Math.random() * Math.PI * 2;
    const col = Math.random()<0.7 ? '#b8ff60' : '#80ffb0'; // lime/mint
    state.fireflies.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,size,life,maxLife:life,pulseRate,phase,col,wander:Math.random()*2-1});
  }
  function spawnFogCloud(){
    if(!state.fogClouds) state.fogClouds=[];
    // enter from left or right side
    const fromLeft = Math.random()<0.5;
    const x = fromLeft ? -80 : CANVAS_W+80;
    const y = 20 + Math.random() * (CANVAS_H - 40);
    const speed = 8 + Math.random() * 14;
    const w = 90 + Math.random() * 120;
    const h = 30 + Math.random() * 50;
    const alpha = 0.045 + Math.random() * 0.065;
    state.fogClouds.push({x,y,vx:fromLeft?speed:-speed,w,h,alpha,life:1.0});
  }
  function updateSwampEffects(dt){
    const mId = window.currentMapId || '';
    if(mId !== 'swamp'){
      if(state.fireflies) state.fireflies=[];
      if(state.fogClouds) state.fogClouds=[];
      if(state.swampBubbles) state.swampBubbles=[];
      return;
    }
    if(!state.fireflies) state.fireflies=[];
    if(!state.fogClouds) state.fogClouds=[];
    // spawn fireflies (~6 on screen at a time)
    if(state.fireflies.length < 7 && Math.random() < dt*2.5) spawnFirefly();
    // spawn fog (~2-3 clouds at a time)
    if(state.fogClouds.length < 3 && Math.random() < dt*0.4) spawnFogCloud();
    // update fireflies
    const t = state.t || 0;
    for(const f of state.fireflies){
      f.life -= dt;
      // gentle wandering
      f.wander += (Math.random()-0.5) * 3.5 * dt;
      f.wander = Math.max(-1.5, Math.min(1.5, f.wander));
      const ang = Math.atan2(f.vy, f.vx) + f.wander * dt;
      const spd = Math.hypot(f.vx,f.vy);
      f.vx = Math.cos(ang)*spd; f.vy = Math.sin(ang)*spd;
      f.x += f.vx*dt; f.y += f.vy*dt;
      // bounce off edges
      if(f.x<0||f.x>CANVAS_W) f.vx=-f.vx;
      if(f.y<0||f.y>CANVAS_H) f.vy=-f.vy;
    }
    state.fireflies = state.fireflies.filter(f=>f.life>0);
    // update fog
    for(const fc of state.fogClouds){
      fc.x += fc.vx*dt;
    }
    state.fogClouds = state.fogClouds.filter(fc => fc.x > -200 && fc.x < CANVAS_W+200);

    // ── Swamp bubbles ──
    if(!state.swampBubbles) state.swampBubbles=[];
    // Spawn bubbles on random water tiles (~4 alive at once)
    if(state.swampBubbles.length < 5 && Math.random() < dt*3.0){
      // Pick a random water tile
      const map=state.map;
      if(map){
        const wTiles=[];
        for(let ty2=0;ty2<GRID_H;ty2++) for(let tx2=0;tx2<GRID_W;tx2++) if(map[ty2][tx2]===6) wTiles.push([tx2,ty2]);
        if(wTiles.length){
          const [bx,by]=wTiles[Math.floor(Math.random()*wTiles.length)];
          const px=bx*TILE+TILE*0.2+Math.random()*TILE*0.6;
          const py=by*TILE+TILE*0.7+Math.random()*TILE*0.25;
          state.swampBubbles.push({
            x:px, y:py,
            vy: -(12+Math.random()*14), // float up
            r: 1.5+Math.random()*2.5,   // radius
            life:1.0,
            // time to pop (seconds) — fast rise
            maxLife: 0.5+Math.random()*0.7,
            popping:false, popT:0
          });
        }
      }
    }
    for(const b of state.swampBubbles){
      if(!b.popping){
        b.y += b.vy*dt;
        b.life -= dt/b.maxLife;
        if(b.life<=0.15){ b.popping=true; b.popT=0; }
      } else {
        b.popT += dt*6; // pop animation
        if(b.popT>=1) b.life=-1;
      }
    }
    state.swampBubbles=state.swampBubbles.filter(b=>b.life>0);
  }
  function drawSwampFogUnder(ctx){
    // subtle dark overlay for the swamp atmosphere (drawn UNDER everything)
    if((window.currentMapId||'')!=='swamp') return;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.28)';
    ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    ctx.restore();
  }
  function drawSwampLakes(ctx){
    // Called on bgCanvas (static). Draws water + bridges.
    // Animated ripples are drawn at runtime by drawSwampWaterAnim.
    const mId=(window.currentMapId||'');
    if(mId!=='swamp') return;
    if(!state||!state.map) return;
    const T=TILE, map=state.map;
    const bridgeSet=window._swampBridgeTiles||new Set();
    const bridgeOrient=window._swampBridgeOrient||new Map();
    const R=11; // corner radius — big enough to be clearly visible on 32px tiles

    function isWater(x,y){
      if(x<0||y<0||x>=GRID_W||y>=GRID_H) return false;
      const v=map[y][x];
      return v===6||(v===9&&bridgeSet.has(x+','+y));
    }

    // Ground colour must exactly match swamp mid so rounded corners blend in
    const GROUND = '#2e3d1c';
    const WATER  = '#1a3d26';

    // ── STEP 1: Stamp a rounded water shape per tile.
    // Strategy that actually works:
    //   a) clipRect the tile
    //   b) fill full tile with ground (so corners show ground under the arc)
    //   c) fill rounded water rect using a path with arcTo on outer corners
    // This way corners show through to the ground perfectly, with zero seams
    // between adjacent water tiles (they all have the same WATER fill).
    for(let y=0;y<GRID_H;y++){
      for(let x=0;x<GRID_W;x++){
        if(!isWater(x,y)) continue;
        const px=x*T, py=y*T;
        const n=isWater(x,y-1), s=isWater(x,y+1), w=isWater(x-1,y), e=isWater(x+1,y);
        const x0=px, y0=py, x1=px+T, y1=py+T;

        ctx.save();
        // Clip to this tile so ground fill doesn't bleed
        ctx.beginPath(); ctx.rect(x0,y0,T,T); ctx.clip();

        // Fill ground behind (reveals at rounded corners)
        ctx.fillStyle=GROUND; ctx.fillRect(x0,y0,T,T);

        // Build the rounded water path
        ctx.beginPath();
        // Top-left
        if(!n&&!w){ ctx.moveTo(x0,y0+R); ctx.arcTo(x0,y0,x0+R,y0,R); }
        else       { ctx.moveTo(x0,y0); }
        // → top-right
        if(!n&&!e){ ctx.lineTo(x1-R,y0); ctx.arcTo(x1,y0,x1,y0+R,R); }
        else       { ctx.lineTo(x1,y0); }
        // → bottom-right
        if(!s&&!e){ ctx.lineTo(x1,y1-R); ctx.arcTo(x1,y1,x1-R,y1,R); }
        else       { ctx.lineTo(x1,y1); }
        // → bottom-left
        if(!s&&!w){ ctx.lineTo(x0+R,y1); ctx.arcTo(x0,y1,x0,y1-R,R); }
        else       { ctx.lineTo(x0,y1); }
        ctx.closePath();
        ctx.fillStyle=WATER; ctx.fill();

        // Shore darkening on exposed edges — clipped to water shape
        ctx.save(); ctx.clip();
        const sh=6;
        let g2;
        // Edge gradients — tight, clipped to water shape
        if(!n){g2=ctx.createLinearGradient(0,y0,0,y0+sh);g2.addColorStop(0,'rgba(0,0,0,0.45)');g2.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g2;ctx.fillRect(x0,y0,T,sh);}
        if(!s){g2=ctx.createLinearGradient(0,y1-sh,0,y1);g2.addColorStop(0,'rgba(0,0,0,0)');g2.addColorStop(1,'rgba(0,0,0,0.35)');ctx.fillStyle=g2;ctx.fillRect(x0,y1-sh,T,sh);}
        if(!w){g2=ctx.createLinearGradient(x0,0,x0+sh,0);g2.addColorStop(0,'rgba(0,0,0,0.42)');g2.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g2;ctx.fillRect(x0,y0,sh,T);}
        if(!e){g2=ctx.createLinearGradient(x1-sh,0,x1,0);g2.addColorStop(0,'rgba(0,0,0,0)');g2.addColorStop(1,'rgba(0,0,0,0.38)');ctx.fillStyle=g2;ctx.fillRect(x1-sh,y0,sh,T);}
        // Concave corners: tile has water N+W but no water at NW diagonal → dark corner dot
        // sr must be small (≈sh) so it doesn't intrude visibly into the water interior
        const nw=isWater(x-1,y-1),ne=isWater(x+1,y-1),sw=isWater(x-1,y+1),se=isWater(x+1,y+1);
        const sr=sh;
        if(n&&w&&!nw){g2=ctx.createRadialGradient(x0,y0,0,x0,y0,sr);g2.addColorStop(0,'rgba(0,0,0,0.50)');g2.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g2;ctx.fillRect(x0,y0,sr,sr);}
        if(n&&e&&!ne){g2=ctx.createRadialGradient(x1,y0,0,x1,y0,sr);g2.addColorStop(0,'rgba(0,0,0,0.50)');g2.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g2;ctx.fillRect(x1-sr,y0,sr,sr);}
        if(s&&w&&!sw){g2=ctx.createRadialGradient(x0,y1,0,x0,y1,sr);g2.addColorStop(0,'rgba(0,0,0,0.42)');g2.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g2;ctx.fillRect(x0,y1-sr,sr,sr);}
        if(s&&e&&!se){g2=ctx.createRadialGradient(x1,y1,0,x1,y1,sr);g2.addColorStop(0,'rgba(0,0,0,0.42)');g2.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g2;ctx.fillRect(x1-sr,y1-sr,sr,sr);}
        ctx.restore(); // restore clip to water shape

        ctx.restore(); // restore clip to tile rect
      }
    }

    // ── STEP 2: Bridge planks on top of water, using stored orientation ──
    for(let y=0;y<GRID_H;y++){
      for(let x=0;x<GRID_W;x++){
        if(map[y][x]!==9||!bridgeSet.has(x+','+y)) continue;
        const px=x*T, py=y*T;
        const ori=bridgeOrient.get(x+','+y)||'h';
        const horiz=(ori==='h');
        ctx.save();
        if(horiz){
          // Horizontal bridge: planks side-by-side, runs L-R across water
          const bh=20, bpy=py+(T-bh)/2; // slightly wider than before
          const pw=T/4;
          const cols=['#8a5e28','#9a6830','#7e5420','#8c6028'];
          for(let pi=0;pi<4;pi++){
            ctx.fillStyle=cols[pi]; ctx.fillRect(px+pi*pw,bpy,pw-1,bh);
            ctx.strokeStyle='rgba(0,0,0,0.14)'; ctx.lineWidth=0.7;
            ctx.beginPath(); ctx.moveTo(px+pi*pw+2,bpy+3); ctx.lineTo(px+pi*pw+2,bpy+bh-3); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(px+pi*pw+5,bpy+2); ctx.lineTo(px+pi*pw+5,bpy+bh-2); ctx.stroke();
          }
          ctx.fillStyle='#503616'; ctx.fillRect(px,bpy,T,2); ctx.fillRect(px,bpy+bh-2,T,2);
          ctx.fillStyle='rgba(20,10,2,0.5)';
          for(let ni=0;ni<4;ni++){
            ctx.beginPath();ctx.arc(px+ni*pw+pw/2,bpy+3,1.3,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(px+ni*pw+pw/2,bpy+bh-4,1.3,0,Math.PI*2);ctx.fill();
          }
        } else {
          // Vertical bridge: planks top-to-bottom
          const bw=20, bpx=px+(T-bw)/2;
          const ph=T/4;
          const cols=['#8a5e28','#9a6830','#7e5420','#8c6028'];
          for(let pi=0;pi<4;pi++){
            ctx.fillStyle=cols[pi]; ctx.fillRect(bpx,py+pi*ph,bw,ph-1);
            ctx.strokeStyle='rgba(0,0,0,0.14)'; ctx.lineWidth=0.7;
            ctx.beginPath(); ctx.moveTo(bpx+3,py+pi*ph+2); ctx.lineTo(bpx+bw-3,py+pi*ph+2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bpx+2,py+pi*ph+5); ctx.lineTo(bpx+bw-2,py+pi*ph+5); ctx.stroke();
          }
          ctx.fillStyle='#503616'; ctx.fillRect(bpx,py,2,T); ctx.fillRect(bpx+bw-2,py,2,T);
          ctx.fillStyle='rgba(20,10,2,0.5)';
          for(let ni=0;ni<4;ni++){
            ctx.beginPath();ctx.arc(bpx+3,py+ni*ph+ph/2,1.3,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(bpx+bw-4,py+ni*ph+ph/2,1.3,0,Math.PI*2);ctx.fill();
          }
        }
        ctx.restore();
      }
    }
  }

  function drawSwampWaterAnim(ctx){
    // Called every frame — animated ripples drawn over the bgCanvas water.
    if((window.currentMapId||'')!=='swamp') return;
    if(!state||!state.map) return;
    const T=TILE, map=state.map, t=state.t||0;
    const bridgeSet=window._swampBridgeTiles||new Set();
    const R=11;
    function isWater(x,y){
      if(x<0||y<0||x>=GRID_W||y>=GRID_H) return false;
      const v=map[y][x];
      return v===6||(v===9&&bridgeSet.has(x+','+y));
    }

    ctx.save();
    for(let y=0;y<GRID_H;y++){
      for(let x=0;x<GRID_W;x++){
        if(!isWater(x,y)) continue;
        if(map[y][x]===9) continue; // no anim on bridge planks
        const px=x*T, py=y*T;
        const n=isWater(x,y-1),s=isWater(x,y+1),w=isWater(x-1,y),e=isWater(x+1,y);
        const x0=px,y0=py,x1=px+T,y1=py+T;

        // Clip to the same rounded rect shape as the static water
        ctx.save();
        ctx.beginPath();
        if(!n&&!w){ ctx.moveTo(x0,y0+R); ctx.arcTo(x0,y0,x0+R,y0,R); } else { ctx.moveTo(x0,y0); }
        if(!n&&!e){ ctx.lineTo(x1-R,y0); ctx.arcTo(x1,y0,x1,y0+R,R); } else { ctx.lineTo(x1,y0); }
        if(!s&&!e){ ctx.lineTo(x1,y1-R); ctx.arcTo(x1,y1,x1-R,y1,R); } else { ctx.lineTo(x1,y1); }
        if(!s&&!w){ ctx.lineTo(x0+R,y1); ctx.arcTo(x0,y1,x0,y1-R,R); } else { ctx.lineTo(x0,y1); }
        ctx.closePath();
        ctx.clip();

        // Slow darkening pulse simulating depth variation
        const phase = x*1.37+y*2.19;
        const pulse = (Math.sin(t*0.55+phase)*0.5+0.5); // 0..1
        ctx.globalAlpha = 0.07 + pulse*0.05;
        ctx.fillStyle = '#0a1e10';
        ctx.fillRect(x0,y0,T,T);

        // 2 wavy ripple ellipses per tile, slow and organic
        ctx.globalAlpha = 0.0;
        const r1y = y0+T*0.35 + Math.sin(t*0.6+phase)*3;
        const r2y = y0+T*0.68 + Math.sin(t*0.5+phase+1.8)*2.5;
        const r1w = T*0.38 + Math.sin(t*0.4+phase+0.5)*3;
        const r2w = T*0.28 + Math.sin(t*0.45+phase+2.3)*2;

        // Ripple 1
        ctx.globalAlpha = (0.12 + Math.sin(t*0.7+phase)*0.06) * (n&&s&&w&&e ? 1 : 0.5);
        ctx.strokeStyle='#4db87a'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.ellipse(x0+T/2, r1y, r1w, 2.8, 0, 0, Math.PI*2); ctx.stroke();

        // Ripple 2
        ctx.globalAlpha = (0.09 + Math.sin(t*0.65+phase+1)*0.05) * (n&&s&&w&&e ? 1 : 0.5);
        ctx.beginPath(); ctx.ellipse(x0+T/2, r2y, r2w, 2, 0, 0, Math.PI*2); ctx.stroke();

        // Algae dot clusters only on interior tiles
        if(n&&s&&w&&e){
          ctx.globalAlpha=0.14; ctx.fillStyle='#1e5530';
          ctx.beginPath(); ctx.ellipse(x0+T*0.28,y0+T*0.62,4.5,2.2,0.4,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(x0+T*0.72,y0+T*0.3,3.5,2,0.9,0,Math.PI*2); ctx.fill();
        }

        ctx.globalAlpha=1;
        ctx.restore();
      }
    }
    ctx.restore();
  }


  function drawSwampBubbles(ctx){
    if((window.currentMapId||'')!=='swamp') return;
    if(!state||!state.swampBubbles||!state.swampBubbles.length) return;
    ctx.save();
    for(const b of state.swampBubbles){
      if(b.popping){
        // Pop: expand ring that fades out
        const pr=b.r*(1+b.popT*2.5);
        ctx.globalAlpha=Math.max(0,(1-b.popT)*0.55);
        ctx.strokeStyle='#5ad66a';
        ctx.lineWidth=0.8;
        ctx.beginPath(); ctx.arc(b.x,b.y,pr,0,Math.PI*2); ctx.stroke();
        // Small splash dots
        ctx.fillStyle='#3ab84a';
        ctx.globalAlpha=Math.max(0,(1-b.popT)*0.4);
        for(let i=0;i<4;i++){
          const a=i*Math.PI/2+b.popT;
          const dr=pr*0.9;
          ctx.beginPath(); ctx.arc(b.x+Math.cos(a)*dr, b.y+Math.sin(a)*dr, 0.9, 0, Math.PI*2); ctx.fill();
        }
      } else {
        const alpha=Math.min(1,b.life*3)*0.7;
        ctx.globalAlpha=alpha;
        // Bubble ring
        ctx.strokeStyle='#4ecf60';
        ctx.lineWidth=0.9;
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.stroke();
        // Tiny highlight
        ctx.fillStyle='rgba(160,255,180,0.45)';
        ctx.beginPath(); ctx.arc(b.x-b.r*0.3, b.y-b.r*0.3, b.r*0.28, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha=1;
    }
    ctx.restore();
  }

    function drawSwampFireflies(ctx){
    if((window.currentMapId||'')!=='swamp') return;
    if(!state.fireflies || !state.fireflies.length) return;
    const t = state.t || 0;
    ctx.save();
    for(const f of state.fireflies){
      const lifePct = f.life/f.maxLife;
      const fadeIn = Math.min(1, (f.maxLife-f.life)*4);
      const fadeOut = lifePct < 0.3 ? lifePct/0.3 : 1;
      const pulse = (Math.sin(t*f.pulseRate+f.phase)+1)*0.5; // 0-1
      const glow = (0.5 + pulse*0.5) * fadeIn * fadeOut;
      if(glow < 0.02) continue;
      // outer glow
      const grd = ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,f.size*5);
      grd.addColorStop(0, f.col.replace(')',','+( glow*0.7).toFixed(2)+')').replace('rgb','rgba'));
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = glow*0.6;
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(f.x,f.y,f.size*5,0,Math.PI*2); ctx.fill();
      // bright core
      ctx.globalAlpha = glow;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(f.x,f.y,f.size*0.7,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
    ctx.restore();
  }
  function drawSwampFog(ctx){
    if((window.currentMapId||'')!=='swamp') return;
    if(!state.fogClouds || !state.fogClouds.length) return;
    ctx.save();
    for(const fc of state.fogClouds){
      const grd = ctx.createRadialGradient(fc.x,fc.y,0,fc.x,fc.y,fc.w*0.6);
      grd.addColorStop(0, `rgba(180,220,190,${fc.alpha})`);
      grd.addColorStop(1, 'rgba(180,220,190,0)');
      ctx.fillStyle=grd;
      ctx.beginPath(); ctx.ellipse(fc.x,fc.y,fc.w*0.6,fc.h*0.5,0,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // Spawn a single snowflake at the top of the canvas with a small drift.
  function spawnSnowflake(){
    const x = Math.random() * (CANVAS_W + 40) - 20;
    const y = -10;
    // Speed downward: between 25 and 80 pixels per second (levemente mais rápido).
    const speed = 25 + Math.random() * 55;
    // Horizontal drift: gently wander left/right.
    const drift = (Math.random() - 0.5) * 30;
    const size = 1.4 + Math.random() * 2.4; // flocos maiores
    state.snowflakes.push({x, y, speed, drift, size});
  }

  // Update all snowflakes and spawn new ones when on the tundra.
  function updateSnowflakes(dt){
    // Only show snow in the tundra (snow) map.
    const mId = window.currentMapId || '';
    if (mId !== 'snow'){
      // clear flakes when leaving the tundra
      state.snowflakes = [];
      return;
    }
    // Neve mais densa: ~4-5 flocos por frame a 60fps
    const spawnChance = dt * 5.5;
    const extra = Math.floor(spawnChance);
    for(let i=0; i<extra; i++) spawnSnowflake();
    if (Math.random() < (spawnChance - extra)) spawnSnowflake();
    // update positions
    for (const f of state.snowflakes){
      f.y += f.speed * dt;
      f.x += f.drift * dt;
      // wrap horizontally if drift moves flake off canvas
      if (f.x < -20) f.x = CANVAS_W + 20;
      else if (f.x > CANVAS_W + 20) f.x = -20;
    }
    // remove flakes that have fallen below the screen
    state.snowflakes = state.snowflakes.filter(f => f.y < CANVAS_H + 15);
  }

  // Spawn footprint at tile position for snow map
  function spawnFootprint(tx, ty, dir){
    if ((window.currentMapId || '') !== 'snow') return;
    if (!state.footprints) state.footprints = [];
    // left/right foot offset alternation based on count
    const count = state.footprints.length;
    const side = (count % 2 === 0) ? 1 : -1;
    const perpX = dir ? -dir.y : 0;
    const perpY = dir ? dir.x : 0;
    const cx = tx * TILE + TILE/2 + perpX * 5 * side;
    const cy = ty * TILE + TILE/2 + perpY * 5 * side;
    state.footprints.push({ x: cx, y: cy, life: 1.0, dir: dir ? {x: dir.x, y: dir.y} : {x:0,y:1} });
    // Limit total footprints
    if (state.footprints.length > 300) state.footprints.shift();
  }

  // Update footprints: fade over time
  function updateFootprints(dt){
    if (!state.footprints || !state.footprints.length) return;
    if ((window.currentMapId || '') !== 'snow'){
      state.footprints = [];
      return;
    }
    for (const f of state.footprints){
      f.life -= dt * 0.22; // ~4.5 seconds to fade out
    }
    state.footprints = state.footprints.filter(f => f.life > 0);
  }
  function spawnRedShotFX(tx, ty, muzzle=false){
    const cx = tx * TILE + TILE/2;
    const cy = ty * TILE + TILE/2;
    const n = muzzle ? 14 : 10;
    for (let i=0;i<n;i++){
      const ang = Math.random()*Math.PI*2;
      const spd = (muzzle? 120:80) + Math.random()*120;
      const life = (muzzle? 0.22:0.18) + Math.random()*0.14;
      state.fx.push({
        x: cx, y: cy,
        vx: Math.cos(ang)*spd,
        vy: Math.sin(ang)*spd - (muzzle? 25:10),
        life, max: life,
        color: (Math.random()<0.5) ? "#b91414" : "#ff2d2d",
        size: muzzle ? 2.6 : 2.2,
        grav: 180
      });
    }
  }

  function spawnPistoleiroTeleportFX(tx, ty){
    const cx = tx * TILE + TILE/2;
    const cy = ty * TILE + TILE/2;
    for (let i=0;i<18;i++){
      const ang = (Math.PI*2*i)/18 + Math.random()*0.2;
      const spd = 90 + Math.random()*110;
      state.fx.push({
        x: cx, y: cy,
        vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd - 25,
        life: 0.22+Math.random()*0.14, max: 0.32,
        color: Math.random()<0.55 ? "#7ee8ff" : "#ffffff",
        size: 2+Math.random()*2.2, grav: 40
      });
    }
    for (let i=0;i<10;i++){
      const ang = Math.random()*Math.PI*2;
      const spd = 40+Math.random()*70;
      state.fx.push({
        x: cx+(Math.random()-0.5)*6, y: cy+(Math.random()-0.5)*6,
        vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
        life: 0.35+Math.random()*0.2, max: 0.5,
        color: "#b8f6ff", size: 3+Math.random()*2, grav: -20, _circle: true
      });
    }
  }

  function playPistoleiroBurstSfx(){
    try{
      const ac = getAudio();
      const t0 = ac.currentTime;
      const g0 = (settings.sfx||1);
      function pulse(freq, type, at, dur, vol){
        const o=ac.createOscillator(); o.type=type;
        const g=ac.createGain();
        o.connect(g).connect(ac.destination);
        o.frequency.setValueAtTime(freq, t0+at);
        o.frequency.exponentialRampToValueAtTime(Math.max(80,freq*0.62), t0+at+dur*0.9);
        g.gain.setValueAtTime(vol*g0, t0+at);
        g.gain.exponentialRampToValueAtTime(0.001, t0+at+dur);
        o.start(t0+at); o.stop(t0+at+dur+0.01);
      }
      pulse(380,'square',0.00,0.11,0.05);
      pulse(520,'triangle',0.05,0.10,0.045);
      pulse(690,'sine',0.10,0.12,0.04);
    }catch(_){}
  }

  function playPistoleiroShotSfx(){
    try{
      const ac = getAudio();
      const t0 = ac.currentTime;
      const g0 = (settings.sfx||1);
      const o1=ac.createOscillator(); o1.type='triangle';
      const g1=ac.createGain(); o1.connect(g1).connect(ac.destination);
      o1.frequency.setValueAtTime(260,t0);
      o1.frequency.exponentialRampToValueAtTime(140,t0+0.09);
      g1.gain.setValueAtTime(0.05*g0,t0);
      g1.gain.exponentialRampToValueAtTime(0.001,t0+0.1);
      o1.start(t0); o1.stop(t0+0.11);
      const o2=ac.createOscillator(); o2.type='sine';
      const g2=ac.createGain(); o2.connect(g2).connect(ac.destination);
      o2.frequency.setValueAtTime(920,t0+0.01);
      o2.frequency.exponentialRampToValueAtTime(360,t0+0.1);
      g2.gain.setValueAtTime(0.025*g0,t0+0.01);
      g2.gain.exponentialRampToValueAtTime(0.001,t0+0.11);
      o2.start(t0+0.01); o2.stop(t0+0.12);
    }catch(_){}
  }

  function playPistoleiroTeleportSfx(){
    try{
      const ac = getAudio();
      const t0 = ac.currentTime;
      const g0 = (settings.sfx||1);
      const o1 = ac.createOscillator(); o1.type = "sine";
      const g1 = ac.createGain(); o1.connect(g1).connect(ac.destination);
      o1.frequency.setValueAtTime(980, t0);
      o1.frequency.exponentialRampToValueAtTime(170, t0+0.28);
      g1.gain.setValueAtTime(0.10*g0, t0);
      g1.gain.exponentialRampToValueAtTime(0.001, t0+0.32);
      o1.start(t0); o1.stop(t0+0.34);
      const o2 = ac.createOscillator(); o2.type = "triangle";
      const g2 = ac.createGain(); o2.connect(g2).connect(ac.destination);
      o2.frequency.setValueAtTime(1500, t0+0.03);
      o2.frequency.exponentialRampToValueAtTime(260, t0+0.24);
      g2.gain.setValueAtTime(0.055*g0, t0+0.03);
      g2.gain.exponentialRampToValueAtTime(0.001, t0+0.28);
      o2.start(t0+0.03); o2.stop(t0+0.3);
      const o3 = ac.createOscillator(); o3.type = "sawtooth";
      const g3 = ac.createGain(); o3.connect(g3).connect(ac.destination);
      o3.frequency.setValueAtTime(220, t0+0.02);
      o3.frequency.exponentialRampToValueAtTime(85, t0+0.3);
      g3.gain.setValueAtTime(0.018*g0, t0+0.02);
      g3.gain.exponentialRampToValueAtTime(0.001, t0+0.32);
      o3.start(t0+0.02); o3.stop(t0+0.33);
    }catch(_){}
  }

  function maybePistoleiroFantasmaTeleportOnBullet(boss, src){
    if (!boss || boss.name !== "Pistoleiro Fantasma" || !boss.alive) return false;
    const ok = (src === "player" || src === "player2" || (src === "ally" && state.partnerIrVision));
    if (!ok) return false;
    if (Math.random() > 0.32) return false;
    const now = performance.now();
    if (boss._pfLastTp && (now - boss._pfLastTp) < 1300) return false;
    const ox = boss.x, oy = boss.y;
    let nx = ox, ny = oy, found = false;
    for (let t=0; t<90; t++){
      const dx = (Math.random()<0.5?-1:1) * (4+Math.floor(Math.random()*8));
      const dy = (Math.random()<0.5?-1:1) * (4+Math.floor(Math.random()*8));
      nx = ox+dx; ny = oy+dy;
      const md = Math.abs(nx-ox)+Math.abs(ny-oy);
      if (md < 4 || md > 13) continue;
      if (nx<1||ny<1||nx>=GRID_W-1||ny>=GRID_H-1) continue;
      if (isBlocked(nx,ny)) continue;
      if (Math.abs(nx-state.gold.x)+Math.abs(ny-state.gold.y)<=1) continue;
      found = true;
      break;
    }
    if (!found) return false;
    spawnPistoleiroTeleportFX(ox, oy);
    boss.x = nx; boss.y = ny;
    spawnPistoleiroTeleportFX(nx, ny);
    boss._pfLastTp = now;
    playPistoleiroTeleportSfx();
    return true;
  }

  function pistoleiroFantasmaCombatUpdate(dt){
    const boss = state.boss;
    if (!boss || !boss.alive || boss.name !== "Pistoleiro Fantasma") return;
    if (!state.running || state.inMenu || state.betweenWaves) return;
    if (!boss._pfBurstInited){
      boss._pfBurstInited = true;
      boss._pfBurstCD = 2800;
      boss._pfShotCD = 700;
    }
    if (boss._pfShotCD == null) boss._pfShotCD = 0;
    if (boss._pfBurstCD == null) boss._pfBurstCD = 0;
    boss._pfShotCD += dt * 1000;
    boss._pfBurstCD += dt * 1000;
    let px = state.player.x, py = state.player.y;
    if (state.coop && state.player2 && state.player2.hp > 0){
      if (state.player.hp > 0){
        const d1 = Math.abs(boss.x-px)+Math.abs(boss.y-py);
        const d2 = Math.abs(boss.x-state.player2.x)+Math.abs(boss.y-state.player2.y);
        if (d2 < d1){ px = state.player2.x; py = state.player2.y; }
      } else { px = state.player2.x; py = state.player2.y; }
    }
    const gunX = boss.x * TILE + TILE/2;
    const gunY = boss.y * TILE + TILE/2;
    const tax = px * TILE + TILE/2;
    const tay = py * TILE + TILE/2;
    function pushBurstDir(ix, iy, dmg){
      const len = Math.hypot(ix, iy) || 1;
      const sp = 430;
      state.bullets.push({
        px: gunX + (ix/len)*10, py: gunY + (iy/len)*10,
        vx: (ix/len)*sp, vy: (iy/len)*sp,
        alive: true, dmg,
        src: "boss",
        tint: "#b8f6ff",
        _pfBurst: true,
        direct: true
      });
    }
    const hasLOS = pistoleiroFantasmaHasLOS(boss.x, boss.y, px, py);
    if (boss._pfBurstCD >= 5200){
      if (!hasLOS){
        boss._pfBurstCD = 4800;
        boss._pfFpStale = true;
      } else {
      boss._pfBurstCD = 0;
      const mdx = px - boss.x, mdy = py - boss.y;
      let mx = 0, my = 0;
      if (Math.abs(mdx) >= Math.abs(mdy)){ mx = Math.sign(mdx) || 1; }
      else { my = Math.sign(mdy) || 1; }
      const perpX = -my, perpY = mx;
      const dmgB = Math.round(state.baseDamage);
      pushBurstDir(mx, my, dmgB);
      pushBurstDir(mx+perpX, my+perpY, dmgB);
      pushBurstDir(mx-perpX, my-perpY, dmgB);
      playPistoleiroBurstSfx();
      state.shakeT = Math.min(0.45,(state.shakeT||0)+0.12);
      state.shakeMag = Math.max(2.2, state.shakeMag||0);
      return;
      }
    }
    if (boss._pfShotCD >= 1450){
      if (!hasLOS){
        boss._pfShotCD = 1250;
        boss._pfFpStale = true;
      } else {
      boss._pfShotCD = 0;
      const ddx = tax - gunX, ddy = tay - gunY;
      const dlen = Math.hypot(ddx, ddy) || 1;
      const dmg = Math.round(state.baseDamage * 1.4);
      state.bullets.push({
        px: gunX + (ddx/dlen)*12,
        py: gunY + (ddy/dlen)*12,
        vx: (ddx/dlen)*395,
        vy: (ddy/dlen)*395,
        alive: true, dmg, src: "boss", tint: "#5ee8ff", direct: true
      });
      spawnRedShotFX(boss.x, boss.y, true);
      playPistoleiroShotSfx();
      }
    }
  }

function drawBoss(ctx){
    // Desenhar Gêmeo 2: quadrado verde com faixa diagonal oposta
    if(state.boss2 && state.boss2.alive){
      const _b2=state.boss2, _p2x=_b2.x*TILE, _p2y=_b2.y*TILE, _t2=state.t||0;
      // enrage visual: handled by spawnAssassinHitFX particles, no overlay
      ctx.fillStyle=COLORS.shadow; ctx.fillRect(_p2x+6,_p2y+TILE-8,TILE-12,4);
      ctx.fillStyle='#286b28';
      ctx.fillRect(_p2x+8,_p2y+8,TILE-16,TILE-16);
      ctx.fillStyle='#104010';
      ctx.fillRect(_p2x+8,_p2y+18,TILE-16,6);
      ctx.fillStyle='#eee';
      ctx.fillRect(_p2x+12,_p2y+14,3,2);
      ctx.fillRect(_p2x+TILE-15,_p2y+14,3,2);
    }
    if (!(state.boss && state.boss.alive)) return;
    const b = state.boss;
    const px = b.x*TILE, py = b.y*TILE;
    const _t = state.t || 0;

    if (b.name === "Pistoleiro Fantasma"){
      ctx.fillStyle=COLORS.shadow; ctx.fillRect(px+6,py+TILE-8,TILE-12,4);
      ctx.fillStyle="#4dd4d4";
      ctx.fillRect(px+8,py+8,TILE-16,TILE-16);
      ctx.fillStyle="#f4f4f4";
      ctx.fillRect(px+10,py+18,TILE-20,6);
      ctx.fillStyle="#f4f4f4";
      ctx.fillRect(px+12,py+14,3,2); ctx.fillRect(px+TILE-15,py+14,3,2);
      return;
    }

    // ── O Pregador (aura) ───────────────────────────────────────
    if (b.name === "O Pregador"){
    // Aura de lentidão — fade suave SEM pulsar (só alpha cresce/decresce)
    {
      const _hasBullet = state._pregadorAuraActive && state.bullets && state.bullets.some(function(_ab){
        if(!_ab.alive||(_ab.src!=='player'&&_ab.src!=='player2')) return false;
        return Math.abs(Math.floor(_ab.px/TILE)-b.x)<=3 && Math.abs(Math.floor(_ab.py/TILE)-b.y)<=3;
      });
      if(!b._auraAlpha) b._auraAlpha=0;
      // Fade in/out suave — sem multiplicar por pulso para não piscar
      b._auraAlpha = Math.max(0, Math.min(1, b._auraAlpha + (_hasBullet ? 0.05 : -0.03)));
      if(b._auraAlpha>0.01){
        const _aR=3, _aSz=(_aR*2+1)*TILE;
        const _aax=(b.x-_aR)*TILE, _aay=(b.y-_aR)*TILE;
        const _acx=px+TILE/2, _acy=py+TILE/2;
        ctx.save();
        ctx.globalAlpha=b._auraAlpha*0.12;
        const _aGrad=ctx.createRadialGradient(_acx,_acy,TILE/2,_acx,_acy,_aSz*0.5);
        _aGrad.addColorStop(0,'#e8dfc0'); _aGrad.addColorStop(1,'rgba(232,223,192,0)');
        ctx.fillStyle=_aGrad; ctx.fillRect(_aax,_aay,_aSz,_aSz);
        ctx.globalAlpha=b._auraAlpha*0.6;
        ctx.strokeStyle='#c8b870';
        ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
        ctx.strokeRect(_aax+1,_aay+1,_aSz-2,_aSz-2);
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
    }

    if(b._gemino===1){
      // Gêmeo 1: estrutura IDÊNTICA ao bandido normal, cor roxa
      ctx.fillStyle=COLORS.shadow; ctx.fillRect(px+6,py+TILE-8,TILE-12,4);
      ctx.fillStyle='#8b2858';
      ctx.fillRect(px+8,py+8,TILE-16,TILE-16);
      ctx.fillStyle='#5a1038';
      ctx.fillRect(px+8,py+18,TILE-16,6);
      ctx.fillStyle='#eee';
      ctx.fillRect(px+12,py+14,3,2);
      ctx.fillRect(px+TILE-15,py+14,3,2);
    } else {
      // ── Pregador ────────────────────────────────────────────
      ctx.fillStyle=COLORS.shadow; ctx.fillRect(px+9,py+24,TILE-18,3);
      const _cajOff=Math.round(Math.sin(_t*2.8)*2);
      ctx.fillStyle='#7a5018';
      ctx.fillRect(px+TILE-9, py-4+_cajOff, 3, TILE+2);
      ctx.fillRect(px+TILE-9, py-4+_cajOff, 9, 3);
      ctx.fillRect(px+TILE+0, py-4+_cajOff, 3, 6);
      ctx.fillStyle='#dfd8c0';
      ctx.fillRect(px+9, py+8, TILE-18, TILE-16);
      ctx.fillStyle='#141008';
      ctx.fillRect(px+7, py+8, TILE-14, 2);
      ctx.fillRect(px+11, py-2, TILE-22, 11);
      ctx.fillStyle='#5a3a08';
      ctx.fillRect(px+11, py+6, TILE-22, 2);
      ctx.fillStyle='#cc1010';
      ctx.fillRect(px+12, py+14, 3, 2);
      ctx.fillRect(px+TILE-15, py+14, 3, 2);
    } // fim if/else gemino vs pregador
    // Barra de invocação — só para o Pregador
    if(b.name==="O Pregador" && b._summonT!=null && b._summonT > 6.5){
      const _prog = Math.max(0, Math.min(1, (b._summonT - 6.5) / 1.5));
      const _bw=TILE-10, _bh=3;
      const _sx=px+5, _sy=py+TILE-5;
      ctx.fillStyle='#000'; ctx.fillRect(_sx,_sy,_bw,_bh);
      ctx.fillStyle='#f3d23b'; ctx.fillRect(_sx,_sy,Math.floor(_bw*_prog),_bh);
    }
  }


  function spawnHealFX(tx, ty){
    const cx = tx * TILE + TILE/2;
    const cy = ty * TILE + TILE/2;
    for (let i=0;i<20;i++){
      const ang = Math.random()*Math.PI*2;
      const spd = 70 + Math.random()*170;
      const life = 0.22 + Math.random()*0.22;
      state.fx.push({
        x: cx, y: cy,
        vx: Math.cos(ang)*spd,
        vy: Math.sin(ang)*spd - 40,
        life, max: life,
        color: (Math.random()<0.55) ? "#4fe36a" : "#9dffad",
        size: 2.4,
        grav: 120
      });
    }
  }


  function updateHUD(){
    goldHPLabel.textContent = state.gold.hp.toString();
    const pct = Math.max(0, (state.gold.hp/state.gold.max)*100);
    goldHPFill.style.width = pct.toFixed(0) + "%";
    // low HP pulse for gold
    try{ goldHPFill.parentElement.classList.toggle("lowhp", state.gold.hp <= 25);
    try{ goldHPFill.parentElement.classList.toggle("critical", state.gold.hp <= 10); }catch(e){} }catch(e){}
    // Update score labels
    if (state.coop){
      try{ const _cs=(state.score1||0)+(state.score2||0);
        if(window.animateScore){ window.animateScore(scoreLabel.parentElement, scoreLabel, _cs); }
        else { scoreLabel.textContent = String(_cs); } }catch(e){}
      // Shop label updated separately when opening shop
    } else {
      if(window.animateScore){ const _sb=scoreLabel.parentElement; window.animateScore(_sb, scoreLabel, state.score|0); }
      else { scoreLabel.textContent = state.score.toString(); }
      if (scoreLabelShop){
        if (window.animateScore){ window.animateScore(scoreLabelShop.parentElement, scoreLabelShop, state.score|0); }
        else { scoreLabelShop.textContent = state.score.toString(); }
      }
    }
    // Hide central score badge in coop
    try{
      if (scoreLabel && scoreLabel.parentElement){
        scoreLabel.parentElement.style.display = state.coop ? 'none' : '';
      }
    }catch(e){}

    // Always hide the coop side panels when not in coop mode. Without this
    // guard the interface could remain visible after returning to the
    // single‑player menu, causing overlay glitches. When coop is active the
    // panels will be shown later in this function. We wrap in a try/catch
    // because these elements may not exist early during initialization.
    try{
      if (!state.coop){
        if (player1HUD) player1HUD.style.display = "none";
        if (player2HUD) player2HUD.style.display = "none";
        // Restore skills bar indicators when not in coop.
        const _sb = document.getElementById('skillsBar');
        if (_sb) _sb.style.display = '';
        // rollCdWrap visibility is managed by the roll cooldown section below
      }
    }catch(_){}
    waveLabel.textContent = state.wave.toString();
    const now = performance.now();
    const cd = Math.max(0, state.shotCooldownMs - (now - state.lastShotAt));
    // cooldown do modo mira (bala aprimorada): usa multiplicador 4x/3x/2x somente quando há alvo válido
    let aimCd = null;
    let aimTotal = null;
    const hasAim = (state.aimLevel||0) > 0;
    const tRef = (hasAim && state.target) ? resolveTarget() : null;
    if (hasAim){
      aimTotal = Math.round(state.shotCooldownMs * aimSlowFactor());
      aimCd = Math.max(0, aimTotal - (now - state.lastShotAt));
      if (cooldownAimWrap){
        cooldownAimWrap.style.display=''; cooldownAimWrap.style.opacity='1'; cooldownAimWrap.style.pointerEvents='';
        cooldownAimWrap.classList.toggle("aimActive", !!tRef);
      }
    } else {
      if(cooldownAimWrap){ cooldownAimWrap.style.display='none'; cooldownAimWrap.style.opacity='0'; cooldownAimWrap.style.pointerEvents='none'; };
    }

    if (!state.coop && playerHUDGroup && playerHPBar){
      const show = state.wave >= 12;
      playerHUDGroup.style.display = show ? "" : "none"; playerHUDGroup.style.opacity = show ? "1" : "0";
      playerHPBar.style.display = show ? "" : "none"; playerHPBar.style.opacity = show ? "1" : "0";
      if (show){
        playerHPLabel.textContent = (state.player.hp|0).toString();
        const ppct = Math.max(0, (state.player.hp/state.player.max)*100);
        playerHPFill.style.width = ppct.toFixed(0) + "%";
        // low HP pulse for player
        try{ playerHPBar.classList.toggle("lowhp", state.player.hp <= 25);
        try{ playerHPBar.classList.toggle("critical", state.player.hp <= 10); }catch(e){} }catch(e){}
      }
    }

    // Coop mode HUD updates
    if (state.coop){
      // Hide original central player HUD elements (HP bar, cooldown, roll)
      if(playerHUDGroup){ playerHUDGroup.style.display="none"; playerHUDGroup.style.opacity="0"; };
      if(playerHPBar){ playerHPBar.style.display="none"; playerHPBar.style.opacity="0"; };
      // Hide the skills bar (cooldown indicators) in coop mode
      try{
        const _sb = document.getElementById('skillsBar');
        if (_sb) _sb.style.display = "none";
      }catch(e){}
      if(rollCdWrap){ rollCdWrap.style.display="none"; rollCdWrap.style.opacity="0"; rollCdWrap.style.pointerEvents="none"; }

      // Always show side panels in coop
      if (player1HUD) player1HUD.style.display = "flex";
      if (player2HUD) player2HUD.style.display = "flex";
      // Determine if HP indicators should be visible (waves >=12)
      const showHP = state.wave >= 12;
      if (p1HPRow) p1HPRow.style.display = showHP ? "" : "none";
      if (p1HPBarEl) p1HPBarEl.style.display = showHP ? "block" : "none";
      if (p2HPRow) p2HPRow.style.display = showHP ? "" : "none";
      if (p2HPBarEl) p2HPBarEl.style.display = showHP ? "block" : "none";

      // Update player HP values and low HP pulses
      if (p1HPLabel && p1HPFill){
        p1HPLabel.textContent = (state.player.hp|0).toString();
        const pct1 = Math.max(0, (state.player.hp/state.player.max) * 100);
        p1HPFill.style.width = pct1.toFixed(0) + "%";
        try{
          p1HPBarEl.classList.toggle("lowhp", state.player.hp <= 25);
          p1HPBarEl.classList.toggle("critical", state.player.hp <= 10);
        }catch(e){}
      }
      if (p2HPLabel && p2HPFill){
        p2HPLabel.textContent = (state.player2.hp|0).toString();
        const pct2 = Math.max(0, (state.player2.hp/state.player2.max) * 100);
        p2HPFill.style.width = pct2.toFixed(0) + "%";
        try{
          p2HPBarEl.classList.toggle("lowhp", state.player2.hp <= 25);
          p2HPBarEl.classList.toggle("critical", state.player2.hp <= 10);
        }catch(e){}
      }

      // Always show bullet cooldown rows
      if (p1CdRow) p1CdRow.style.display = "";
      if (p2CdRow) p2CdRow.style.display = "";
      // Update individual scores
      if (p1ScoreLabel){ const _v1=state.score1||0;
        if(window.animateScore) window.animateScore(p1ScoreLabel.parentElement, p1ScoreLabel, _v1);
        else p1ScoreLabel.textContent = String(_v1); }
      if (p2ScoreLabel){ const _v2=state.score2||0;
        if(window.animateScore) window.animateScore(p2ScoreLabel.parentElement, p2ScoreLabel, _v2);
        else p2ScoreLabel.textContent = String(_v2); }
      // Update bullet cooldown values for each player
      const nowCoop = performance.now();
      const cd1 = Math.max(0, state.shotCooldownMs - (nowCoop - state.lastShotAt));
      const last2 = state.lastShotAt2 || -999999;
      const cd2Eff = (typeof state.shotCooldownMs2 === 'number') ? state.shotCooldownMs2 : state.shotCooldownMs;
      const cd2 = Math.max(0, cd2Eff - (nowCoop - last2));
      if (p1CdLabel) p1CdLabel.textContent = cd1>0 ? ((cd1/1000).toFixed(2) + "s") : "Pronta";
      if (p2CdLabel) p2CdLabel.textContent = cd2>0 ? ((cd2/1000).toFixed(2) + "s") : "Pronta";
      // Roll cooldown labels and visibility: show only if the player purchased roll upgrade
      if (p1RollRow){
        const hasRoll1 = (state.rollLevel||0) > 0;
        p1RollRow.style.display = hasRoll1 ? "" : "none";
        if (hasRoll1 && p1RollLabel){
          const rcd1 = Math.max(0, (state.rollCooldownMs||2000) - (nowCoop - (state.lastRollAt||-9999)));
          p1RollLabel.textContent = rcd1>0 ? ((rcd1/1000).toFixed(2) + "s") : "Pronto";
        }
      }
      if (p2RollRow){
        const hasRoll2 = (state.rollLevel2||0) > 0;
        p2RollRow.style.display = hasRoll2 ? "" : "none";
        if (hasRoll2 && p2RollLabel){
          const rcd2 = Math.max(0, (state.rollCooldownMs2||2000) - (nowCoop - (state.lastRollAt2||-9999)));
          p2RollLabel.textContent = rcd2>0 ? ((rcd2/1000).toFixed(2) + "s") : "Pronto";
        }
      }
      // Update shop score label inside coop
      if (scoreLabelShop){
        if (state.activeShopPlayer === 1){
          const _sv1 = state.score1||0;
          if (window.animateScore) window.animateScore(scoreLabelShop.parentElement, scoreLabelShop, _sv1);
          else scoreLabelShop.textContent = String(_sv1);
        } else if (state.activeShopPlayer === 2){
          const _sv2 = state.score2||0;
          if (window.animateScore) window.animateScore(scoreLabelShop.parentElement, scoreLabelShop, _sv2);
          else scoreLabelShop.textContent = String(_sv2);
        }
      }
      // Hide the central roll cooldown wrapper (single-player) permanently in coop
      if(rollCdWrap){ rollCdWrap.style.display="none"; rollCdWrap.style.opacity="0"; rollCdWrap.style.pointerEvents="none"; }
      if (saraivadaCdWrap){ saraivadaCdWrap.style.display="none"; saraivadaCdWrap.style.opacity="0"; saraivadaCdWrap.style.pointerEvents="none"; }
    }
    
    // cooldown do rolamento
    if (rollCdWrap && rollCdLabel){
      if ((state.rollLevel||0) > 0){
        rollCdWrap.style.display=""; rollCdWrap.style.opacity="1"; rollCdWrap.style.pointerEvents="";
        const rcd = Math.max(0, (state.rollCooldownMs||2000) - (now - (state.lastRollAt||-9999)));
        rollCdLabel.innerHTML=rcd>0?((rcd/1000).toFixed(2)+"s"):"<b>Pronto</b>";
        rollCdWrap.classList.toggle("rollReady", rcd<=0.0001);
      } else {
        rollCdWrap.style.display="none"; rollCdWrap.style.opacity="0"; rollCdWrap.style.pointerEvents="none";
        rollCdWrap.classList.remove("rollReady");
      }
    }

    // cooldown da saraivada
    if (saraivadaCdWrap && saraivadaCdLabel && !state.coop){
      if ((state.saraivadaLevel||0) > 0){
        saraivadaCdWrap.style.display=""; saraivadaCdWrap.style.opacity="1"; saraivadaCdWrap.style.pointerEvents="";
        const sarMults = [0, 9, 7.5, 6, 4.5];
        const sarMult = sarMults[Math.min(state.saraivadaLevel, 4)] || 9;
        const sarCdTotal = Math.round(state.shotCooldownMs * sarMult);
        const sarCd = Math.max(0, sarCdTotal - (now - (state.lastSaraivadaAt||-99999)));
        saraivadaCdLabel.innerHTML = sarCd>0 ? ((sarCd/1000).toFixed(2)+"s") : "<b>Pronta</b>";
        saraivadaCdWrap.classList.toggle("saraivadaReady", sarCd<=0.0001);
      } else {
        saraivadaCdWrap.style.display="none"; saraivadaCdWrap.style.opacity="0"; saraivadaCdWrap.style.pointerEvents="none";
        saraivadaCdWrap.classList.remove("saraivadaReady");
      }
    }

const bufferInfo = state.bufferedShots>0 ? ` (+${state.bufferedShots})` : "";
    cooldownLabel.innerHTML = cd>0 ? ( (cd/1000).toFixed(2)+"s"+bufferInfo ) : ("<b>Pronto</b>"+(bufferInfo?` ${bufferInfo}`:""));
    try{ const _tw=document.getElementById('tiroCdWrap'); if(_tw) _tw.classList.toggle('tiroReady',cd<=0); }catch(_){}
    if (cooldownAimLabel && (state.aimLevel||0) > 0){
      if (tRef){
        cooldownAimLabel.innerHTML=aimCd>0?((aimCd/1000).toFixed(2)+"s"):"<b>Pronta</b>";
      } else {
        cooldownAimLabel.innerHTML = "<span style='white-space:nowrap;'>Sem alvo</span>";
      }
    }

    if (state.boss && state.boss.alive){
      if(state.boss.name!=="Os Gêmeos"){
        // Boss normal: atualiza barra única
        resetBossBarUi(false);
        bossName.style.visibility="visible"; bossName.style.opacity="1";
        bossBar.style.visibility="visible";
        const pctb = Math.max(0, state.boss.hp/state.boss.maxhp) * 100;
        bossBarFill.style.width = pctb.toFixed(0) + "%";
      } else if(!state._gemeosSplit){
        // Gêmeos antes do split: barra única mostra média dos dois
        bossName.style.visibility="visible"; bossName.style.opacity="1";
        bossBar.style.visibility="visible";
        const _hp1=(state.boss.alive?state.boss.hp:0);
        const _hp2=(state.boss2&&state.boss2.alive?state.boss2.hp:0);
        const _max1=state.boss.maxhp, _max2=(state.boss2?state.boss2.maxhp:state.boss.maxhp);
        bossBarFill.style.width = Math.max(0,((_hp1+_hp2)/(_max1+_max2))*100).toFixed(0)+"%";
      } else {
        // Gêmeos após split: bossBar fica hidden, barras individuais são gerenciadas separadamente
        bossBar.style.visibility="hidden";
        bossName.style.visibility="hidden"; bossName.style.opacity="0";
      }
    } else if(!state.boss2||!state.boss2.alive) {
      bossName.style.visibility="hidden"; bossName.style.opacity="0";
      bossBar.style.visibility="hidden";
    }

    // Hide default shop button when in coop, show otherwise
    try{
      if (shopBtn){
        if (state.coop) shopBtn.style.display = "none";
        else shopBtn.style.display = "";
      }
    }catch(e){}
    try{ syncCoopLocalShopDeathButtons(); }catch(_){}
  }

  // Loop
  
function drawTargetOutline(ctx){
  if (!state || !state.target) return;
  const t = resolveTarget();
  if (!t) { state.target = null; return; }
  const px = t.x*TILE, py = t.y*TILE;
  const pulse = 0.55 + 0.45*Math.sin((state.t||0)*8);
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 3;
  ctx.strokeStyle = `rgba(255,80,80,${0.35 + 0.35*pulse})`;
  ctx.strokeRect(px+4, py+4, TILE-8, TILE-8);
  ctx.restore();
}
function loop(now){
  try {
    const dt = Math.min(0.05, (now - state.lastTime)/1000);
    state.lastTime = now;
    state.t = (state.t||0) + dt;
    // Start pending companion dialogs reliably (even if shop-close hook fails)
    try{
      const b=document.body;
      const blocked = b && (b.getAttribute('data-results-open')==='1' || b.getAttribute('data-shop-open')==='1' || b.getAttribute('data-options-open')==='1' || b.getAttribute('data-confirm-open')==='1');
      if (!blocked && state && state.running && !dialog?.active){
        if (state._pendingDogDialog){ try{ maybeStartDogDialog(); }catch(_){ } }
        if (state._pendingAllyDialog){ try{ maybeStartAllyDialog(); }catch(_){ } }
        if (state._pendingDinamiteiroDialog){ try{ maybeStartDinamiteiroDialog(); }catch(_){ } }
        if (state._pendingReparadorDialog){ try{ maybeStartReparadorDialog(); }catch(_){ } }
      }
    }catch(_){}

    // Smooth overlays (pause/game over)
    if (state.pauseFade == null) state.pauseFade = 0;
    if (state.gameOverFade == null) state.gameOverFade = 0;
    const _targetPause = (state.running && !state.inMenu && state.pausedManual && !state.pausedShop) ? 1 : 0;
    const _targetOver = (!state.running && !state.inMenu) ? 1 : 0;
    const _fadeK = Math.min(1, dt * 10);
    state.pauseFade += (_targetPause - state.pauseFade) * _fadeK;
    state.gameOverFade += (_targetOver - state.gameOverFade) * _fadeK;
    try{const _go=!state.running&&!state.inMenu;try{ document.body.removeAttribute('data-results-open'); }catch(_){ }
    ['shopBtn','menuBackBtn','pauseBtn','enemiesBtn','ingameOptBtn','p1ShopBtn','p2ShopBtn'].forEach(function(id){const b=document.getElementById(id);if(b){b.disabled=_go;b.style.opacity=_go?'0.35':'';b.style.pointerEvents=_go?'none':'';}});
      if (!_go && state && state.coop && state.running && !state.inMenu){
        try{ syncCoopLocalShopDeathButtons(); }catch(_){}
      }
    }catch(_){}
    if(state.goldWarnT>0)state.goldWarnT=Math.max(0,state.goldWarnT-dt*1.2);
    if((state.goldInvulT||0)>0)state.goldInvulT=Math.max(0,state.goldInvulT-dt);
    if((state.playerInvulT||0)>0)state.playerInvulT=Math.max(0,state.playerInvulT-dt);

    if (state.playerWarnT>0) state.playerWarnT = Math.max(0, state.playerWarnT - dt*1.2);
    if(state.rollFlash>0)state.rollFlash=Math.max(0,state.rollFlash-dt*5.5);
    if((state.rollAnimT||0)>0)state.rollAnimT=Math.max(0,state.rollAnimT-dt);

    
    // Decaimento do aviso das torres
    if (state.sentries && state.sentries.length){
      for (const __t of state.sentries){
        if (__t.warnT>0) __t.warnT = Math.max(0, __t.warnT - dt*1.2);
      }
    }
    if (state.goldMines && state.goldMines.length){
      for (const __m of state.goldMines){
        if (__m.warnT>0) __m.warnT = Math.max(0, __m.warnT - dt*1.2);
      }
    }
    if (state.barricadas && state.barricadas.length){
      for (const __b of state.barricadas){
        try{ if(window._migrateBarricadaIfLegacy) window._migrateBarricadaIfLegacy(__b); }catch(_){}
        if (__b.warnT>0) __b.warnT = Math.max(0, __b.warnT - dt*1.2);
      }
    }
    if (state.espantalhos && state.espantalhos.length){
      for (const __e of state.espantalhos){
        if (__e.warnT>0) __e.warnT = Math.max(0, __e.warnT - dt*1.2);
      }
    }
if (state.running && !state.pausedShop && !state.pausedManual){
      // Held input: smooth movement and autofire without OS key repeat delay
      if (state.keysHeld){
        if (state.keysHeld.up) { tryMove("w"); }
        else if (state.keysHeld.down) { tryMove("s"); }
        else if (state.keysHeld.left) { tryMove("a"); }
        else if (state.keysHeld.right) { tryMove("d"); }
        if (state.keysHeld.shoot) { tryShoot(); }
      }
      if (!state.betweenWaves){
        // Spawna até atingir a contagem da onda atual
        state.spawnTimer += dt*1000;
        if(!state.boss&&state.enemiesToSpawn>0&&state.spawnTimer>=state.spawnEveryMs){state.spawnTimer=0;const _bt=Math.min(spawnBatchSize(state.wave),state.enemiesToSpawn);for(let _bi=0;_bi<_bt;_bi++)spawnBandit();state.enemiesToSpawn-=_bt;}
        // Avança a onda somente quando tudo morreu:
        // - se boss wave: quando o boss morrer
        // - senão: quando enemiesToSpawn==0 e enemiesAlive==0
        if (state.boss){
          // Para Os Gêmeos: só acaba a wave quando os DOIS morrem
          const _bothDead = state.boss.name==="Os Gêmeos"
            ? (!state.boss.alive && (!state.boss2||!state.boss2.alive))
            : !state.boss.alive;
          if(_bothDead){ endWave(); }
        } else if (state.enemiesToSpawn <= 0 && state.enemiesAlive <= 0){
          endWave();
        }
      }
      try{ stepBandits(now); }catch(_e){ console.warn('[stepBandits]',_e); }

      try{ assassinsStep(now); }catch(_e){ console.warn('[assassinsStep]',_e); }
      try{ stepEspantalhos(); }catch(_e){ console.warn('[stepEspantalhos]',_e); }
      try{ espantalhoAssassinDamage(dt); }catch(_e){ console.warn('[espantalhoAssassinDamage]',_e); }
      try{ fantasmaStep(now); }catch(_e){ console.warn('[fantasmaStep]',_e); }
      try{ stepSentries(now); }catch(_e){ console.warn('[stepSentries]',_e); }
      try{ stepGoldMines(); }catch(_e){ console.warn('[stepGoldMines]',_e); }
      try{ updateDinamiteiroBombs(dt); }catch(_e){ console.warn('[updateDinamiteiroBombs]',_e); }
      try{ updateExplosiveAoeFlashes(dt); }catch(_e){ console.warn('[updateExplosiveAoeFlashes]',_e); }
      try{ updateBullets(dt); }catch(_e){ console.warn('[updateBullets]',_e); }
      try{ goldDamage(dt); }catch(_e){ console.warn('[goldDamage]',_e); }
      try{ assassinDamage(dt); }catch(_e){ console.warn('[assassinDamage]',_e); }
      updateTumbleweeds(dt);
      updateSnowflakes(dt);
      updateSwampEffects(dt);
      updateFootprints(dt);
      // Spawn footprints for entities that moved (snow map only)
      if ((window.currentMapId || '') === 'snow' && state.footprints !== undefined){
        try{
          // Player 1
          const _p = state.player;
          if (_p && _p.hp > 0){
            if (_p._fpX !== _p.x || _p._fpY !== _p.y){
              spawnFootprint(_p.x, _p.y, _p.face || {x:0,y:1});
              _p._fpX = _p.x; _p._fpY = _p.y;
            }
          }
          // Player 2 (coop)
          if (state.coop && state.player2 && state.player2.hp > 0){
            const _p2 = state.player2;
            if (_p2._fpX !== _p2.x || _p2._fpY !== _p2.y){
              spawnFootprint(_p2.x, _p2.y, _p2.face || {x:0,y:1});
              _p2._fpX = _p2.x; _p2._fpY = _p2.y;
            }
          }
          // Bandits
          for (const _b of state.bandits){
            if (!_b.alive) continue;
            if (_b._fpX !== _b.x || _b._fpY !== _b.y){
              const _fdir = { x: (_b.x - (_b._fpX||_b.x)), y: (_b.y - (_b._fpY||_b.y)) };
              spawnFootprint(_b.x, _b.y, _fdir.x || _fdir.y ? _fdir : {x:0,y:1});
              _b._fpX = _b.x; _b._fpY = _b.y;
            }
          }
          // Boss
          if (state.boss && state.boss.alive){
            const _bos = state.boss;
            if (_bos._fpX !== _bos.x || _bos._fpY !== _bos.y){
              const _fdir = { x: (_bos.x - (_bos._fpX||_bos.x)), y: (_bos.y - (_bos._fpY||_bos.y)) };
              spawnFootprint(_bos.x, _bos.y, _fdir.x || _fdir.y ? _fdir : {x:0,y:1});
              // Boss leaves 2 footprints (bigger entity)
              spawnFootprint(_bos.x, _bos.y, {x:-(_fdir.y||0), y:(_fdir.x||1)});
              _bos._fpX = _bos.x; _bos._fpY = _bos.y;
            }
          }
          // Allies
          for (const _a of state.allies||[]){
            if (_a._fpX !== _a.x || _a._fpY !== _a.y){
              spawnFootprint(_a.x, _a.y, {x:0,y:1});
              _a._fpX = _a.x; _a._fpY = _a.y;
            }
          }
        }catch(_){}
      }
      updateFX(dt);
      updateGoldShine(dt);
      alliesThink(dt);
      updateDynamites(performance.now());
      updateScoreOverTime(dt);
      // Coop mode: continuous movement/shoot for player2 and revive logic
      if (state.coop){
        if (state.keysHeld2){
          if (state.keysHeld2.up)      tryMove2("ArrowUp");
          else if (state.keysHeld2.down)  tryMove2("ArrowDown");
          else if (state.keysHeld2.left)  tryMove2("ArrowLeft");
          else if (state.keysHeld2.right) tryMove2("ArrowRight");
          if (state.keysHeld2.shoot) tryShoot2();
        }
        handleRevive(dt);
      }
      // finalize multi-kill se a janela passou
      /*__TICK_MULTI_KILL__*/
      if (state.multiKill && state.multiKill.count>0){
        if (performance.now() - state.multiKill.lastAt > state.multiKill.windowMs){ finalizeMultiKill(); }
      }
      updateHUD();
    }
    else if (state.running && (state.pausedManual || state.pausedShop)){
      try{ updateFXParticles(dt); }catch(_e){ console.warn('[updateFXParticles]',_e); }
    }

    ctx.clearRect(0,0,canvas.width, canvas.height);
    ctx.save();
    if (state.shakeT>0){
      const _gs = (typeof settings!=='undefined'?settings:null)||(window._gameSettings)||{screenShake:true};
      if(_gs.screenShake!==false){const m=state.shakeMag||1.5;ctx.translate((Math.random()-0.5)*m,(Math.random()-0.5)*m);}
      state.shakeT = Math.max(0, state.shakeT - dt);
      if(state.shakeT<=0) state.shakeMag=0;
    }
    // Render simples
    if (state.bgCanvas) { ctx.drawImage(state.bgCanvas, 0, 0); } else { ctx.fillStyle = COLORS.sandMid; ctx.fillRect(0,0,canvas.width, canvas.height); }
    // Swamp atmosphere: dark overlay drawn just after background
    try{ drawSwampFogUnder(ctx); }catch(_){}
    // Animated water ripples (drawn at runtime over bgCanvas water)
    try{ drawSwampWaterAnim(ctx); }catch(_){}
    
    // Draw footprints on snow map
    if ((window.currentMapId || '') === 'snow' && state.footprints && state.footprints.length){
      ctx.save();
      for (const _fp of state.footprints){
        const _a = Math.max(0, Math.min(1, _fp.life));
        ctx.globalAlpha = _a * 0.70;
        ctx.fillStyle = '#9ab8d0';
        // Small oval footprint - slightly larger than before
        ctx.beginPath();
        const _rx = Math.abs(_fp.dir && _fp.dir.x) > 0.5 ? 3.2 : 2.4;
        const _ry = Math.abs(_fp.dir && _fp.dir.y) > 0.5 ? 3.2 : 2.4;
        ctx.ellipse(_fp.x, _fp.y, _rx, _ry, Math.atan2(_fp.dir ? _fp.dir.y : 1, _fp.dir ? _fp.dir.x : 0), 0, Math.PI*2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    
    // Dinamites
    if (state.dynaLevel >= 0){
      for (const d of state.dynamites){
        // desenha apenas se armada
        if (!d.armed) continue;
        const px = d.x*TILE, py = d.y*TILE;
        ctx.fillStyle = COLORS.shadow; ctx.fillRect(px+8, py+TILE-10, TILE-16, 4);
        // corpo do explosivo
        ctx.fillStyle = "#b91414"; ctx.fillRect(px+12, py+14, 8, 8);
        // pavio
        ctx.fillStyle = "#111"; ctx.fillRect(px+18, py+12, 2, 4);
        // faísca
        ctx.fillStyle = "#f3d23b"; ctx.fillRect(px+20, py+12, 2, 2);
      }
    }

    // Ouro
    (function drawGold(){
      const g = state.gold; const px = g.x*TILE, py = g.y*TILE;
      const _gid = (typeof state.equippedGold === 'number') ? state.equippedGold : -1;
      if(window._drawGoldSkin){
        window._drawGoldSkin(ctx, _gid, px, py, state.t||0);
      }
      if(state.selectedGold){
        ctx.save(); ctx.lineWidth=2.5; ctx.strokeStyle='#f3d23b';
        ctx.strokeRect(px+2,py+2,TILE-4,TILE-4); ctx.restore();
      }
      // Gold HP bar moved to after drawFX for proper overlay
    })();
    if((state.goldInvulT||0)>0){const _gp=state.gold,_px=_gp.x*TILE,_py=_gp.y*TILE,_pulse=Math.abs(Math.sin((state.t||0)*7));ctx.save();ctx.globalAlpha=0.35+_pulse*0.35;ctx.fillStyle='#49a0d9';ctx.fillRect(_px+2,_py+2,TILE-4,TILE-4);ctx.globalAlpha=1;ctx.restore();}
    // invulnerability visual removed (blue square)
    /*__GOLD_WARN_MOVED__*/
    // Tumbleweeds (vetorizadas)
    for (const t of state.tumbleweeds){
      ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.rot);
      // corpo
      ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2);
      ctx.fillStyle = COLORS.tumble; ctx.fill();
      // ramos curvos
      ctx.lineWidth = 1; ctx.strokeStyle = "#3b2a10";
      for (let k=0;k<6;k++){
        const ang = (k/6)*Math.PI*2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang)*-3, Math.sin(ang)*-3);
        ctx.quadraticCurveTo(Math.cos(ang+0.5)*2, Math.sin(ang+0.5)*2, Math.cos(ang)*6, Math.sin(ang)*6);
        ctx.stroke();
      }
      // pequenos espinhos
      ctx.globalAlpha = 0.85;
      for (let k=0;k<6;k++){
        const ang = (k/6)*Math.PI*2 + 0.3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang)*5, Math.sin(ang)*5);
        ctx.lineTo(Math.cos(ang)*7, Math.sin(ang)*7);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    // Snowflakes (falling effect on the tundra). Draw after tumbleweeds so flakes appear on top.
    if ((window.currentMapId || '') === 'snow' && state.snowflakes && state.snowflakes.length){
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.9;
      for (const f of state.snowflakes){
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size || 1.5, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }
    // Inimigos e Boss

    if((state.placingSentry||state.movingSentry)&&state.sentryHoverX>=0&&state.sentryHoverY>=0){const _hx=state.sentryHoverX,_hy=state.sentryHoverY,_gx=state.gold.x,_gy=state.gold.y;const _inv=(Math.abs(_hx-_gx)<=1&&Math.abs(_hy-_gy)<=1)||(_hx<=0||_hy<=0||_hx>=GRID_W-1||_hy>=GRID_H-1)||isBlocked(_hx,_hy)||(state.sentries&&state.sentries.some(s=>(state.movingSentry?s!==state.movingSentry:true)&&s.x===_hx&&s.y===_hy));ctx.save();ctx.globalAlpha=0.55;ctx.fillStyle=_inv?'#d94949':'#49d97a';ctx.fillRect(_hx*TILE+2,_hy*TILE+2,TILE-4,TILE-4);ctx.globalAlpha=0.9;ctx.lineWidth=3;ctx.strokeStyle=_inv?'#7a1a1a':'#1a7a3a';if(!_inv){ctx.beginPath();ctx.moveTo(_hx*TILE+8,_hy*TILE+TILE/2);ctx.lineTo(_hx*TILE+TILE/2-2,_hy*TILE+TILE-8);ctx.lineTo(_hx*TILE+TILE-6,_hy*TILE+7);ctx.stroke();}else{ctx.beginPath();ctx.moveTo(_hx*TILE+8,_hy*TILE+8);ctx.lineTo(_hx*TILE+TILE-8,_hy*TILE+TILE-8);ctx.stroke();ctx.beginPath();ctx.moveTo(_hx*TILE+TILE-8,_hy*TILE+8);ctx.lineTo(_hx*TILE+8,_hy*TILE+TILE-8);ctx.stroke();}ctx.restore();}
    // Gold mine placement hover
    if(state.placingGoldMine&&state.goldMineHoverX>=0&&state.goldMineHoverY>=0){
      const _hx=state.goldMineHoverX,_hy=state.goldMineHoverY,_gx=state.gold.x,_gy=state.gold.y;
      const _occupied=(state.sentries&&state.sentries.some(s=>s.x===_hx&&s.y===_hy))||(state.goldMines&&state.goldMines.some(m=>m.x===_hx&&m.y===_hy));
      const _inv=(Math.abs(_hx-_gx)<=1&&Math.abs(_hy-_gy)<=1)||(_hx<=0||_hy<=0||_hx>=GRID_W-1||_hy>=GRID_H-1)||isBlocked(_hx,_hy)||_occupied;
      ctx.save();ctx.globalAlpha=0.55;ctx.fillStyle=_inv?'#d94949':'#f3d23b';ctx.fillRect(_hx*TILE+2,_hy*TILE+2,TILE-4,TILE-4);
      ctx.globalAlpha=0.9;ctx.lineWidth=3;ctx.strokeStyle=_inv?'#7a1a1a':'#c97a2b';
      if(!_inv){ctx.beginPath();ctx.moveTo(_hx*TILE+8,_hy*TILE+TILE/2);ctx.lineTo(_hx*TILE+TILE/2-2,_hy*TILE+TILE-8);ctx.lineTo(_hx*TILE+TILE-6,_hy*TILE+7);ctx.stroke();}
      else{ctx.beginPath();ctx.moveTo(_hx*TILE+8,_hy*TILE+8);ctx.lineTo(_hx*TILE+TILE-8,_hy*TILE+TILE-8);ctx.stroke();ctx.beginPath();ctx.moveTo(_hx*TILE+TILE-8,_hy*TILE+8);ctx.lineTo(_hx*TILE+8,_hy*TILE+TILE-8);ctx.stroke();}
      ctx.restore();
    }
    // Gold mine move hover
    if(state.movingGoldMine&&state.goldMineHoverX>=0&&state.goldMineHoverY>=0){
      const _hx=state.goldMineHoverX,_hy=state.goldMineHoverY,_gx=state.gold.x,_gy=state.gold.y;
      const _m=state.movingGoldMine;
      const _occupied=(state.sentries&&state.sentries.some(s=>s.x===_hx&&s.y===_hy))||(state.goldMines&&state.goldMines.some(m=>m!==_m&&m.x===_hx&&m.y===_hy));
      const _inv=(Math.abs(_hx-_gx)<=1&&Math.abs(_hy-_gy)<=1)||(_hx<=0||_hy<=0||_hx>=GRID_W-1||_hy>=GRID_H-1)||isBlocked(_hx,_hy)||_occupied;
      ctx.save();ctx.globalAlpha=0.55;ctx.fillStyle=_inv?'#d94949':'#f3d23b';ctx.fillRect(_hx*TILE+2,_hy*TILE+2,TILE-4,TILE-4);
      ctx.globalAlpha=0.9;ctx.lineWidth=3;ctx.strokeStyle=_inv?'#7a1a1a':'#c97a2b';
      if(!_inv){ctx.beginPath();ctx.moveTo(_hx*TILE+8,_hy*TILE+TILE/2);ctx.lineTo(_hx*TILE+TILE/2-2,_hy*TILE+TILE-8);ctx.lineTo(_hx*TILE+TILE-6,_hy*TILE+7);ctx.stroke();}
      else{ctx.beginPath();ctx.moveTo(_hx*TILE+8,_hy*TILE+8);ctx.lineTo(_hx*TILE+TILE-8,_hy*TILE+TILE-8);ctx.stroke();ctx.beginPath();ctx.moveTo(_hx*TILE+TILE-8,_hy*TILE+8);ctx.lineTo(_hx*TILE+8,_hy*TILE+TILE-8);ctx.stroke();}
      ctx.restore();
    }
    // Barricada placement/move hover
    if((state.placingEspantalho||state.movingEspantalho)&&state.espantalhoHoverX>=0&&state.espantalhoHoverY>=0){
      const _hx=state.espantalhoHoverX,_hy=state.espantalhoHoverY,_gx=state.gold.x,_gy=state.gold.y;
      const _me=state.movingEspantalho;
      const _occupied=(state.sentries&&state.sentries.some(s=>s.x===_hx&&s.y===_hy))||(state.goldMines&&state.goldMines.some(m=>m.x===_hx&&m.y===_hy))||(state.barricadas&&state.barricadas.some(b=>b.x===_hx&&b.y===_hy))||(state.espantalhos&&state.espantalhos.some(e=>e!==_me&&e.x===_hx&&e.y===_hy));
      const _inv=(Math.abs(_hx-_gx)<=1&&Math.abs(_hy-_gy)<=1)||(_hx<=0||_hy<=0||_hx>=GRID_W-1||_hy>=GRID_H-1)||isBlocked(_hx,_hy)||_occupied;
      ctx.save();ctx.globalAlpha=0.55;ctx.fillStyle=_inv?'#d94949':'#c97a2b';ctx.fillRect(_hx*TILE+2,_hy*TILE+2,TILE-4,TILE-4);
      ctx.globalAlpha=0.9;ctx.lineWidth=3;ctx.strokeStyle=_inv?'#7a1a1a':'#8a5a1a';
      if(!_inv){ctx.beginPath();ctx.moveTo(_hx*TILE+8,_hy*TILE+TILE/2);ctx.lineTo(_hx*TILE+TILE/2-2,_hy*TILE+TILE-8);ctx.lineTo(_hx*TILE+TILE-6,_hy*TILE+7);ctx.stroke();}
      else{ctx.beginPath();ctx.moveTo(_hx*TILE+8,_hy*TILE+8);ctx.lineTo(_hx*TILE+TILE-8,_hy*TILE+TILE-8);ctx.stroke();ctx.beginPath();ctx.moveTo(_hx*TILE+TILE-8,_hy*TILE+8);ctx.lineTo(_hx*TILE+8,_hy*TILE+TILE-8);ctx.stroke();}
      ctx.restore();
    }
    if((state.placingPichaPoco||state.movingPichaPoco)&&state.pichaPocoHoverX>=0&&state.pichaPocoHoverY>=0){
      const _hx=state.pichaPocoHoverX,_hy=state.pichaPocoHoverY,_gx=state.gold.x,_gy=state.gold.y;
      const _mpp=state.movingPichaPoco;
      const _occupied=(state.pichaPocos&&state.pichaPocos.some(p=>p!==_mpp&&p.x===_hx&&p.y===_hy));
      const _inv=(Math.abs(_hx-_gx)<=1&&Math.abs(_hy-_gy)<=1)||(_hx<=0||_hy<=0||_hx>=GRID_W-1||_hy>=GRID_H-1)||isBlocked(_hx,_hy)||_occupied;
      ctx.save();
      ctx.globalAlpha=0.55;
      ctx.fillStyle=_inv?'#d94949':'#1a7a2a';
      ctx.fillRect(_hx*TILE+2,_hy*TILE+2,TILE-4,TILE-4);
      ctx.globalAlpha=0.9;ctx.lineWidth=3;ctx.strokeStyle=_inv?'#7a1a1a':'#1a5a1a';
      if(!_inv){
        ctx.beginPath();ctx.moveTo(_hx*TILE+8,_hy*TILE+TILE/2);ctx.lineTo(_hx*TILE+TILE/2-2,_hy*TILE+TILE-8);ctx.lineTo(_hx*TILE+TILE-6,_hy*TILE+7);ctx.stroke();
      } else {
        ctx.beginPath();ctx.moveTo(_hx*TILE+8,_hy*TILE+8);ctx.lineTo(_hx*TILE+TILE-8,_hy*TILE+TILE-8);ctx.stroke();
        ctx.beginPath();ctx.moveTo(_hx*TILE+TILE-8,_hy*TILE+8);ctx.lineTo(_hx*TILE+8,_hy*TILE+TILE-8);ctx.stroke();
      }
      ctx.restore();
    }
    if((state.placingBarricada||state.movingBarricada)&&state.barricadaHoverX>=0&&state.barricadaHoverY>=0){
      const _hx=state.barricadaHoverX,_hy=state.barricadaHoverY,_gx=state.gold.x,_gy=state.gold.y;
      const _mb=state.movingBarricada;
      const _occupied=(state.sentries&&state.sentries.some(s=>s.x===_hx&&s.y===_hy))||(state.goldMines&&state.goldMines.some(m=>m.x===_hx&&m.y===_hy))||(state.barricadas&&state.barricadas.some(b=>b!==_mb&&b.x===_hx&&b.y===_hy));
      const _inv=(Math.abs(_hx-_gx)<=1&&Math.abs(_hy-_gy)<=1)||(_hx<=0||_hy<=0||_hx>=GRID_W-1||_hy>=GRID_H-1)||isBlocked(_hx,_hy)||_occupied;
      ctx.save();ctx.globalAlpha=0.55;ctx.fillStyle=_inv?'#d94949':'#c97a2b';ctx.fillRect(_hx*TILE+2,_hy*TILE+2,TILE-4,TILE-4);
      ctx.globalAlpha=0.9;ctx.lineWidth=3;ctx.strokeStyle=_inv?'#7a1a1a':'#8a5a1a';
      if(!_inv){ctx.beginPath();ctx.moveTo(_hx*TILE+8,_hy*TILE+TILE/2);ctx.lineTo(_hx*TILE+TILE/2-2,_hy*TILE+TILE-8);ctx.lineTo(_hx*TILE+TILE-6,_hy*TILE+7);ctx.stroke();}
      else{ctx.beginPath();ctx.moveTo(_hx*TILE+8,_hy*TILE+8);ctx.lineTo(_hx*TILE+TILE-8,_hy*TILE+TILE-8);ctx.stroke();ctx.beginPath();ctx.moveTo(_hx*TILE+TILE-8,_hy*TILE+8);ctx.lineTo(_hx*TILE+8,_hy*TILE+TILE-8);ctx.stroke();}
      ctx.restore();
    }
    // ClearPath placement hover (shows tile type: green if obstacle, red if no obstacle)
    if(state.placingClearPath){
      // We'll use sentryHoverX/Y which is updated by the general mousemove
      const _hx=state.sentryHoverX,_hy=state.sentryHoverY;
      if(_hx>=0&&_hy>=0&&inBounds(_hx,_hy)){
        const _tileVal=state.map[_hy][_hx];
        const _isObstacle=_tileVal!==0&&_tileVal!==3&&_tileVal!==9;
        const _hasSentry=state.sentries&&state.sentries.some(s=>s.x===_hx&&s.y===_hy);
        const _hasMine=state.goldMines&&state.goldMines.some(m=>m.x===_hx&&m.y===_hy);
        const _canRemove=_isObstacle&&!_hasSentry&&!_hasMine;
        ctx.save();ctx.globalAlpha=0.50;ctx.fillStyle=_canRemove?'#49d97a':'#d94949';ctx.fillRect(_hx*TILE+2,_hy*TILE+2,TILE-4,TILE-4);
        ctx.globalAlpha=0.9;ctx.lineWidth=3;ctx.strokeStyle=_canRemove?'#1a7a3a':'#7a1a1a';
        if(_canRemove){ctx.beginPath();ctx.moveTo(_hx*TILE+8,_hy*TILE+TILE/2);ctx.lineTo(_hx*TILE+TILE/2-2,_hy*TILE+TILE-8);ctx.lineTo(_hx*TILE+TILE-6,_hy*TILE+7);ctx.stroke();}
        else{ctx.beginPath();ctx.moveTo(_hx*TILE+8,_hy*TILE+8);ctx.lineTo(_hx*TILE+TILE-8,_hy*TILE+TILE-8);ctx.stroke();ctx.beginPath();ctx.moveTo(_hx*TILE+TILE-8,_hy*TILE+8);ctx.lineTo(_hx*TILE+8,_hy*TILE+TILE-8);ctx.stroke();}
        ctx.restore();
      }
    }
    // Torres Sentinelas
    if(state.sentries){
      for (const t of state.sentries){
        const px=t.x*TILE, py=t.y*TILE;
        ctx.fillStyle='#2a2a2a'; ctx.fillRect(px+10,py+10,TILE-20,TILE-20);
        ctx.fillStyle='#6f4e37'; ctx.fillRect(px+14,py+6,TILE-28,10);
        ctx.fillStyle='#c97a2b'; ctx.fillRect(px+TILE/2-2,py+4,4,8);
        if(state.selectedSentry&&state.selectedSentry===t){
          const _sr=2; // quadrado 2 tiles
          const _sSize=(_sr*2+1)*TILE;
          const _sax=(t.x-_sr)*TILE, _say=(t.y-_sr)*TILE;
          const _scx=t.x*TILE+TILE/2, _scy=t.y*TILE+TILE/2;
          const _sPulse=0.5+0.5*Math.abs(Math.sin((state.t||0)*3.5));
          ctx.save();
          // Gradiente radial azul (igual ao vermelho da bomba, mas azul)
          ctx.globalAlpha=(0.06+_sPulse*0.14);
          const _sGrad=ctx.createRadialGradient(_scx,_scy,2,_scx,_scy,_sSize*0.7);
          _sGrad.addColorStop(0,'#0088ff'); _sGrad.addColorStop(1,'rgba(0,100,255,0)');
          ctx.fillStyle=_sGrad;
          ctx.fillRect(_sax,_say,_sSize,_sSize);
          // Borda pontilhada azul (idêntica à da bomba)
          ctx.globalAlpha=0.35+_sPulse*0.3;
          ctx.strokeStyle=_sPulse>0.5?'#4090ff':'#2060cc';
          ctx.lineWidth=1.5;
          ctx.setLineDash([4,3]);
          ctx.strokeRect(_sax+1,_say+1,_sSize-2,_sSize-2);
          ctx.setLineDash([]);
          ctx.restore();
          // Outline dourado na torreta
          ctx.save();ctx.lineWidth=2.5;ctx.strokeStyle='#f3d23b';
          ctx.strokeRect(px+2,py+2,TILE-4,TILE-4);ctx.restore();
        }
        // HP bar drawn after enemies for overlay
      }
    }
    // ─── Gold Mines drawing ───────────────────────────────────────
    if(state.goldMines && state.goldMines.length){
      for(const m of state.goldMines){
        if(m.hp<=0)continue;
        const px=m.x*TILE, py=m.y*TILE;
        const lvl=m.level||1;
        const t=state.t||0;
        // Ground shadow
        ctx.fillStyle='rgba(0,0,0,0.28)';
        ctx.beginPath(); ctx.ellipse(px+16,py+27,12,4,0,0,Math.PI*2); ctx.fill();
        // Main mine body - wooden barrel/crate look
        // Base dark brown ground patch
        ctx.fillStyle='#2a1800'; ctx.fillRect(px+7,py+16,TILE-14,TILE-18);
        // Stone walls on sides
        ctx.fillStyle='#5a4030'; ctx.fillRect(px+6,py+12,4,TILE-18);
        ctx.fillStyle='#5a4030'; ctx.fillRect(px+TILE-10,py+12,4,TILE-18);
        // Entrance arch (dark mouth of mine)
        ctx.fillStyle='#1a0f00';
        ctx.beginPath();
        ctx.moveTo(px+9,py+26); ctx.lineTo(px+9,py+17);
        ctx.quadraticCurveTo(px+16,py+11,px+23,py+17);
        ctx.lineTo(px+23,py+26); ctx.closePath(); ctx.fill();
        // Entrance arch frame (wood beams)
        ctx.strokeStyle='#8b5a2b'; ctx.lineWidth=1.5;
        ctx.beginPath();
        ctx.moveTo(px+9,py+26); ctx.lineTo(px+9,py+17);
        ctx.quadraticCurveTo(px+16,py+11,px+23,py+17);
        ctx.lineTo(px+23,py+26); ctx.stroke();
        // Horizontal beam
        ctx.beginPath(); ctx.moveTo(px+8,py+18); ctx.lineTo(px+24,py+18); ctx.stroke();
        // Roof / mountain top
        ctx.fillStyle='#6b5040';
        ctx.beginPath(); ctx.moveTo(px+4,py+14); ctx.lineTo(px+16,py+5); ctx.lineTo(px+28,py+14); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#8a6450';
        ctx.beginPath(); ctx.moveTo(px+4,py+14); ctx.lineTo(px+16,py+7); ctx.lineTo(px+28,py+14); ctx.closePath(); ctx.fill();
        // Rock texture dots on roof
        ctx.fillStyle='rgba(0,0,0,0.18)';
        ctx.beginPath(); ctx.arc(px+11,py+11,1.5,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(px+20,py+10,1.2,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(px+16,py+13,1,0,Math.PI*2); ctx.fill();
        // Gold ore sparkle inside entrance - animated
        const sparkPhase = Math.floor(t*4+m.x*3+m.y*7)%3;
        const sparkColors=['#f3d23b','#ffe070','#e0a020'];
        ctx.fillStyle=sparkColors[sparkPhase];
        ctx.beginPath(); ctx.arc(px+14+sparkPhase,py+21,1.5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#f3d23b';
        ctx.beginPath(); ctx.arc(px+18,py+22,1.2,0,Math.PI*2); ctx.fill();
        // Pickaxe icon on the side wall
        ctx.save(); ctx.strokeStyle='#c97a2b'; ctx.lineWidth=1.2;
        // handle
        ctx.beginPath(); ctx.moveTo(px+3,py+22); ctx.lineTo(px+7,py+18); ctx.stroke();
        // head of pickaxe
        ctx.beginPath(); ctx.moveTo(px+5,py+16); ctx.lineTo(px+8,py+17); ctx.lineTo(px+7,py+19); ctx.stroke();
        ctx.restore();
        // Hit flash: handled by spawnAssassinHitFX particles (no overlay needed)
        // Selected highlight - solid like sentry
        if(state.selectedGoldMine&&state.selectedGoldMine===m){
          ctx.save(); ctx.lineWidth=2.5; ctx.strokeStyle='#f3d23b';
          ctx.strokeRect(px+2,py+2,TILE-4,TILE-4);
          ctx.restore();
        }
        // HP bar drawn after enemies for overlay
      }
    }
    // ─── Poças de Piche ───────────────────────────────────────────
    if(state.pichaPocos && state.pichaPocos.length){
      const _T=state.t||0;
      for(const pp of state.pichaPocos){
        const px=pp.x*TILE, py=pp.y*TILE;
        const cx=px+TILE/2, cy=py+TILE/2;
        // Fundo escuro da poça
        ctx.save();
        ctx.globalAlpha=0.82;
        const _pGrad=ctx.createRadialGradient(cx,cy+4,2,cx,cy+2,TILE*0.48);
        _pGrad.addColorStop(0,'#0a0a0a'); _pGrad.addColorStop(0.55,'#1a1a1a'); _pGrad.addColorStop(1,'rgba(10,10,10,0)');
        ctx.fillStyle=_pGrad;
        ctx.beginPath(); ctx.ellipse(cx,cy+4,TILE*0.45,TILE*0.32,0,0,Math.PI*2); ctx.fill();
        // Brilho esverdeado pulsante na superfície
        const _pulse=0.12+0.06*Math.abs(Math.sin(_T*2.2+pp.x*0.7+pp.y*0.5));
        ctx.globalAlpha=_pulse;
        ctx.fillStyle='#444444';
        ctx.beginPath(); ctx.ellipse(cx-3,cy+2,TILE*0.2,TILE*0.1,0.3,0,Math.PI*2); ctx.fill();
        ctx.restore();
        // Selected highlight
        if(state.selectedPichaPoco===pp){
          ctx.save(); ctx.lineWidth=2.5; ctx.strokeStyle='#f3d23b';
          ctx.strokeRect(px+2,py+2,TILE-4,TILE-4);
          ctx.restore();
        }
      }
    }

    // ─── Barricadas drawing ───────────────────────────────────────
    if(state.barricadas && state.barricadas.length){
      for(const bar of state.barricadas){
        if(bar.hp<=0)continue;
        const px=bar.x*TILE, py=bar.y*TILE;
        const lvl=bar.level||1;
        const hpPct=Math.max(0,bar.hp/bar.maxHp);
        // Log fence posts
        ctx.fillStyle='#4a2e10'; ctx.fillRect(px+4,py+8,TILE-8,TILE-14);
        // Horizontal planks
        ctx.fillStyle='#7a5030'; ctx.fillRect(px+3,py+9,TILE-6,5);
        ctx.fillStyle='#8a6040'; ctx.fillRect(px+3,py+16,TILE-6,5);
        ctx.fillStyle='#7a5030'; ctx.fillRect(px+3,py+23,TILE-6,4);
        // Vertical posts
        ctx.fillStyle='#5a3820'; ctx.fillRect(px+6,py+8,4,TILE-14);
        ctx.fillStyle='#5a3820'; ctx.fillRect(px+22,py+8,4,TILE-14);
        // Nível não muda o gráfico — visual sempre igual ao nível 1
        // Warn flash
        if((bar.warnT||0)>0){
          ctx.save(); ctx.globalAlpha=Math.min(0.55,bar.warnT*0.7);
          ctx.fillStyle='#ff4444'; ctx.fillRect(px+4,py+8,TILE-8,TILE-14);
          ctx.restore();
        }
        // Selected highlight - solid like sentry
        if(state.selectedBarricada&&state.selectedBarricada===bar){
          ctx.save(); ctx.lineWidth=2.5; ctx.strokeStyle='#f3d23b';
          ctx.strokeRect(px+2,py+2,TILE-4,TILE-4);
          ctx.restore();
        }
        // HP bar drawn after enemies
      }
    }


    // ─── Draw Portais ────────────────────────────────────────────
    // Direções de saída: 0=up 1=right 2=down 3=left
    function _drawPortalTile(ctx, px, py, color, glowColor, t){
      const cx=px+TILE/2, cy=py+TILE/2;
      // Sombra reta
      ctx.fillStyle='rgba(0,0,0,0.30)';
      ctx.fillRect(px+6,py+28,20,3);
      // Anel externo pulsante
      const pulse=0.7+Math.sin((t||0)*4)*0.15;
      ctx.save(); ctx.globalAlpha=0.22*pulse;
      ctx.fillStyle=color;
      ctx.beginPath(); ctx.arc(cx,cy,14,0,Math.PI*2); ctx.fill();
      ctx.restore();
      // Anel médio giratório
      ctx.save(); ctx.translate(cx,cy); ctx.rotate((t||0)*1.8);
      ctx.strokeStyle=color; ctx.lineWidth=2.5; ctx.globalAlpha=0.65;
      ctx.beginPath(); ctx.ellipse(0,0,10,4,0,0,Math.PI*2); ctx.stroke();
      ctx.restore();
      // Núcleo brilhante
      ctx.save(); ctx.globalAlpha=0.85+Math.sin((t||0)*6)*0.15;
      const grd=ctx.createRadialGradient(cx,cy,1,cx,cy,7);
      grd.addColorStop(0,'#ffffff'); grd.addColorStop(0.4,glowColor); grd.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=grd;
      ctx.beginPath(); ctx.arc(cx,cy,7,0,Math.PI*2); ctx.fill();
      ctx.restore();
      // Estrela central estática
      ctx.save(); ctx.globalAlpha=0.55+Math.sin((t||0)*5)*0.1;
      ctx.fillStyle='#ffffff';
      ctx.font='bold 10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('✦', cx, cy+1);
      ctx.restore();
    }

    if(state.portals){
      const T=state.t||0;
      if(state.portals.blue){
        const p=state.portals.blue;
        _drawPortalTile(ctx, p.x*TILE, p.y*TILE, '#2060ff', '#60c0ff', T);
        if(state.selectedPortal){
          ctx.save(); ctx.lineWidth=2.5; ctx.strokeStyle='#60c0ff';
          ctx.strokeRect(p.x*TILE+2,p.y*TILE+2,TILE-4,TILE-4); ctx.restore();
        }
      }
      if(state.portals.orange){
        const p=state.portals.orange;
        _drawPortalTile(ctx, p.x*TILE, p.y*TILE, '#ff8020', '#ffb060', T+1.5);
        if(state.selectedPortal){
          ctx.save(); ctx.lineWidth=2.5; ctx.strokeStyle='#ffb060';
          ctx.strokeRect(p.x*TILE+2,p.y*TILE+2,TILE-4,TILE-4); ctx.restore();
        }
      }
    }

    // Portal placement hover
    if((state.placingPortalBlue||state.placingPortalOrange)&&state.portalHoverX>=0&&state.portalHoverY>=0){
      const _hx=state.portalHoverX,_hy=state.portalHoverY;
      const gx2=state.gold.x,gy2=state.gold.y;
      const borderInv2=(_hx<=0||_hy<=0||_hx>=GRID_W-1||_hy>=GRID_H-1);
      const goldInv2=(Math.abs(_hx-gx2)<=1&&Math.abs(_hy-gy2)<=1);
      const occ2=isBlocked(_hx,_hy)||
        (state.portals&&state.portals.blue&&state.portals.blue.x===_hx&&state.portals.blue.y===_hy);
      const _inv2=borderInv2||goldInv2||occ2;
      if(!_inv2){
        const _col=state.placingPortalBlue?'#2060ff':'#ff8020';
        const _gcol=state.placingPortalBlue?'#60c0ff':'#ffb060';
        ctx.save(); ctx.globalAlpha=0.65;
        _drawPortalTile(ctx,_hx*TILE,_hy*TILE,_col,_gcol,state.t||0);
        ctx.restore();
      } else {
        ctx.save(); ctx.globalAlpha=0.45; ctx.fillStyle='#d94949';
        ctx.fillRect(_hx*TILE+2,_hy*TILE+2,TILE-4,TILE-4);
        ctx.globalAlpha=0.9; ctx.lineWidth=3; ctx.strokeStyle='#7a1a1a';
        ctx.beginPath(); ctx.moveTo(_hx*TILE+8,_hy*TILE+8); ctx.lineTo(_hx*TILE+TILE-8,_hy*TILE+TILE-8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(_hx*TILE+TILE-8,_hy*TILE+8); ctx.lineTo(_hx*TILE+8,_hy*TILE+TILE-8); ctx.stroke();
        ctx.restore();
      }
    }

    // ── Espantalhos ──────────────────────────────────────────────
    if(state.espantalhos){
      for(const esp of state.espantalhos){
        if(esp.hp<=0)continue;
        const _ex=esp.x*TILE,_ey=esp.y*TILE,_lvl=esp.level||1,_t2=state.t||0;
        ctx.save();
        // Sombra
        ctx.fillStyle='rgba(0,0,0,0.22)';ctx.fillRect(_ex+6,_ey+TILE-5,TILE-12,3);
        // Poste vertical (madeira escura)
        ctx.fillStyle='#5a3515';ctx.fillRect(_ex+14,_ey+3,4,TILE-5);
        // Barra horizontal (braços)
        ctx.fillStyle='#6b4218';ctx.fillRect(_ex+3,_ey+10,TILE-6,4);
        // Roupão (retângulo simples, cor palha)
        ctx.fillStyle='#b89840';ctx.fillRect(_ex+9,_ey+13,TILE-18,12);
        // Faixa escura no meio do roupão
        ctx.fillStyle='#8a7030';ctx.fillRect(_ex+9,_ey+18,TILE-18,2);
        // Cabeça (quadrado arredondado simples, bege)
        ctx.fillStyle='#d4bc7a';ctx.fillRect(_ex+10,_ey+3,12,10);
        // Olhos (2 pontinhos escuros — estilo bandit do jogo)
        ctx.fillStyle='#2a1a08';ctx.fillRect(_ex+12,_ey+7,2,2);ctx.fillRect(_ex+18,_ey+7,2,2);
        // Chapéu (aba + copa — igual estilo cowboy do jogo)
        ctx.fillStyle='#2a1a04';ctx.fillRect(_ex+8,_ey+4,16,2); // aba
        ctx.fillRect(_ex+11,_ey+0,10,5); // copa
        // Nível: pontinhos dourados na aba
        if(_lvl>1){ctx.fillStyle='#f3d23b';for(let _li=0;_li<_lvl-1;_li++)ctx.fillRect(_ex+9+_li*5,_ey+4,2,2);}
        ctx.restore();
        // Range preview se selecionado — cópia do padrão da torreta mas marrom
        if(state.selectedEspantalho===esp){
          const _er=espantalhoStats(_lvl).range;
          const _eSz=(_er*2+1)*TILE;
          const _eax=(esp.x-_er)*TILE,_eay=(esp.y-_er)*TILE;
          const _ecx=_ex+TILE/2,_ecy=_ey+TILE/2;
          const _ePulse=0.5+0.5*Math.abs(Math.sin(_t2*3.5));
          ctx.save();
          ctx.globalAlpha=0.06+_ePulse*0.14;
          const _eGrad=ctx.createRadialGradient(_ecx,_ecy,2,_ecx,_ecy,_eSz*0.7);
          _eGrad.addColorStop(0,'#c06020');_eGrad.addColorStop(1,'rgba(180,80,0,0)');
          ctx.fillStyle=_eGrad;ctx.fillRect(_eax,_eay,_eSz,_eSz);
          ctx.globalAlpha=0.35+_ePulse*0.3;
          ctx.strokeStyle=_ePulse>0.5?'#d07030':'#a04010';
          ctx.lineWidth=1.5;ctx.setLineDash([4,3]);
          ctx.strokeRect(_eax+1,_eay+1,_eSz-2,_eSz-2);
          ctx.setLineDash([]);
          ctx.restore();
          ctx.save();ctx.lineWidth=2.5;ctx.strokeStyle='#f3d23b';
          ctx.strokeRect(_ex+2,_ey+2,TILE-4,TILE-4);ctx.restore();
        }
      }
    }
    // ── Fantasmas (desenhados separado, semi-transparentes) ──────────
    for (const z of state.bandits){
      if (!z.alive || !z.fantasma) continue;
      if (!z._floatT) z._floatT = 0;
      z._floatT += 0.016; // tick visual (não depende de dt aqui, é aproximado)
      const _fOff = Math.sin((state.t||0)*3.5 + z._floatT) * 3; // oscilaçao vertical
      const _fOff2 = Math.sin((state.t||0)*2.2 + z._floatT + 1) * 1.5; // leve horizontal
      const fpx = z.x*TILE + _fOff2, fpy = z.y*TILE + _fOff;
      ctx.save();
      ctx.globalAlpha = 0.82;
      // Sombra tênue
      ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.fillRect(fpx+6, fpy+TILE-8, TILE-12, 3);
      // Corpo branco
      ctx.fillStyle='#f0f0ff'; ctx.fillRect(fpx+8, fpy+8, TILE-16, TILE-16);
      // Brilho no corpo (pulsante)
      const _gPulse = 0.18 + Math.abs(Math.sin((state.t||0)*4 + z._floatT))*0.15;
      ctx.globalAlpha = _gPulse;
      ctx.fillStyle='#ffffff'; ctx.fillRect(fpx+10, fpy+10, TILE-20, TILE-20);
      ctx.globalAlpha = 0.82;
      // Bandana cinza-azulada
      ctx.fillStyle='#7090b8'; ctx.fillRect(fpx+8, fpy+18, TILE-16, 6);
      // Olhos pretos
      ctx.fillStyle='#111'; ctx.fillRect(fpx+12, fpy+14, 3, 2); ctx.fillRect(fpx+TILE-15, fpy+14, 3, 2);
      // No mapa Tundra: outline preto para visibilidade
      if((window.currentMapId||'')==='snow'){
        ctx.globalAlpha=0.75;
        ctx.strokeStyle='#000';
        ctx.lineWidth=1.5;
        ctx.strokeRect(fpx+7, fpy+7, TILE-14, TILE-14);
      }
      ctx.restore();
    }
    for (const z of state.bandits){ if (!z.alive) continue; if (z.fantasma) continue; const px = z.x*TILE, py = z.y*TILE;
      const enemyKind = z.assassin ? 'assassin' : (z.vandal ? 'vandal' : 'bandit');
      if (!drawEnemySprite(ctx, enemyKind, px, py, TILE)){
        ctx.fillStyle = COLORS.shadow; ctx.fillRect(px+6, py+TILE-8, TILE-12, 4);
        ctx.fillStyle = (z.assassin? "#111" : COLORS.bandit); ctx.fillRect(px+8, py+8, TILE-16, TILE-16);
        ctx.fillStyle = (z.assassin? "#5a00cc" : (z.vandal? "#f1d94c" : COLORS.bandana)); ctx.fillRect(px+8, py+18, TILE-16, 6); ctx.fillStyle = "#eee"; ctx.fillRect(px+12, py+14, 3,2); ctx.fillRect(px+TILE-15, py+14, 3,2);
      }
       // ── Corda do Xerife prendendo o vândalo ──
       if(z.xerifeStunned && z.xerifeStunT>0){
         ctx.save();
         // Animação de pulso: a corda pisca levemente
         const _rAlpha=0.55+0.35*Math.sin((state.t||0)*12);
         ctx.globalAlpha=_rAlpha;
         // 4 segmentos de corda ao redor do sprite
         ctx.strokeStyle='#c8a040'; ctx.lineWidth=2.5;
         ctx.beginPath(); ctx.rect(px+5,py+6,TILE-10,TILE-10); ctx.stroke();
         ctx.strokeStyle='#e8c870'; ctx.lineWidth=1.2;
         ctx.beginPath(); ctx.moveTo(px+5,py+6); ctx.lineTo(px+14,py+14); ctx.stroke();
         ctx.beginPath(); ctx.moveTo(px+TILE-5,py+6); ctx.lineTo(px+TILE-14,py+14); ctx.stroke();
         ctx.beginPath(); ctx.moveTo(px+5,py+TILE-6); ctx.lineTo(px+14,py+TILE-14); ctx.stroke();
         ctx.beginPath(); ctx.moveTo(px+TILE-5,py+TILE-6); ctx.lineTo(px+TILE-14,py+TILE-14); ctx.stroke();
         ctx.restore();
         // Barra de duração do stun (acima do vândalo)
         const _sMax=xerifeStats(state.xerifeLevel||1).stunDur;
         const _sProg=Math.max(0,Math.min(1,(z.xerifeStunT||0)/_sMax));
         const _sbW=TILE-10;
         ctx.fillStyle='#000'; ctx.fillRect(px+5,py-8,_sbW,3);
         ctx.fillStyle='#c8a040'; ctx.fillRect(px+5,py-8,Math.floor(_sbW*_sProg),3);
       }
      // ── Efeito piche: gotículas pretas pulsando sobre o inimigo ──
      if(state.pichaPocos&&state.pichaPocos.some(p=>p.x===z.x&&p.y===z.y)){
        ctx.save();
        const _T=state.t||0;
        const _pulse=0.6+0.35*Math.abs(Math.sin(_T*3.5+z.x*1.3+z.y*0.7));
        // Borda de piche escorrendo (4 gotas nos cantos)
        ctx.globalAlpha=_pulse;
        ctx.fillStyle='#0a0a0a';
        // gota topo-esq
        ctx.beginPath();ctx.arc(px+9,py+9+Math.sin(_T*4+0)*2,3,0,Math.PI*2);ctx.fill();
        // gota topo-dir
        ctx.beginPath();ctx.arc(px+TILE-9,py+9+Math.sin(_T*4+1.5)*2,3,0,Math.PI*2);ctx.fill();
        // gota baixo-esq
        ctx.beginPath();ctx.arc(px+9,py+TILE-9+Math.sin(_T*4+3)*2,2.5,0,Math.PI*2);ctx.fill();
        // gota baixo-dir
        ctx.beginPath();ctx.arc(px+TILE-9,py+TILE-9+Math.sin(_T*4+4.5)*2,2.5,0,Math.PI*2);ctx.fill();
        // contorno fino pulsante
        ctx.globalAlpha=_pulse*0.7;
        ctx.strokeStyle='#0a0a0a'; ctx.lineWidth=2;
        ctx.strokeRect(px+6,py+6,TILE-12,TILE-12);
        ctx.restore();
      }
    }

    // ── Projéteis de corda voando (animação de corda ondulada) ────────────────
    if(state._ropeProjectiles&&state._ropeProjectiles.length>0){
      state._ropeProjectiles = state._ropeProjectiles.filter(rp=>{
        rp.t += dt/rp.dur;
        if(rp.t>1) return false;
        const prog = rp.t; // 0→1: corda se estende da origem ao alvo
        // ponto final atual: avança progressivamente até o destino
        const ex = rp.x1 + (rp.x2-rp.x1)*prog;
        const ey = rp.y1 + (rp.y2-rp.y1)*prog;
        const dx = ex-rp.x1, dy = ey-rp.y1;
        const len = Math.hypot(dx,dy)||1;
        // vetor perpendicular normalizado
        const perpX = -dy/len, perpY = dx/len;
        // amplitude da ondulação decresce à medida que a corda chega (tensiona)
        const amp = (1-prog) * 6;
        const SEGS = 14; // segmentos da corda
        ctx.save();
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // sombra da corda
        ctx.strokeStyle = 'rgba(40,18,5,0.45)';
        ctx.beginPath();
        for(let i=0;i<=SEGS;i++){
          const tt = i/SEGS;
          const px2 = rp.x1 + (ex-rp.x1)*tt;
          const py2 = rp.y1 + (ey-rp.y1)*tt;
          // onda senoidal: decresce para zero nas extremidades (envelope)
          const wave = Math.sin(tt*Math.PI*2.5 + prog*8) * amp * Math.sin(tt*Math.PI);
          const wx = px2 + perpX*wave + 1;
          const wy = py2 + perpY*wave + 1;
          if(i===0) ctx.moveTo(wx,wy); else ctx.lineTo(wx,wy);
        }
        ctx.stroke();
        // corda principal (marrom dourado)
        ctx.strokeStyle = '#9a6020';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        for(let i=0;i<=SEGS;i++){
          const tt = i/SEGS;
          const px2 = rp.x1 + (ex-rp.x1)*tt;
          const py2 = rp.y1 + (ey-rp.y1)*tt;
          const wave = Math.sin(tt*Math.PI*2.5 + prog*8) * amp * Math.sin(tt*Math.PI);
          const wx = px2 + perpX*wave;
          const wy = py2 + perpY*wave;
          if(i===0) ctx.moveTo(wx,wy); else ctx.lineTo(wx,wy);
        }
        ctx.stroke();
        // linha de brilho (mais fina, mais clara)
        ctx.strokeStyle = '#d4943a';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        for(let i=0;i<=SEGS;i++){
          const tt = i/SEGS;
          const px2 = rp.x1 + (ex-rp.x1)*tt;
          const py2 = rp.y1 + (ey-rp.y1)*tt;
          const wave = Math.sin(tt*Math.PI*2.5 + prog*8) * amp * Math.sin(tt*Math.PI);
          const wx = px2 + perpX*(wave-0.8);
          const wy = py2 + perpY*(wave-0.8);
          if(i===0) ctx.moveTo(wx,wy); else ctx.lineTo(wx,wy);
        }
        ctx.stroke();
        // laço na ponta
        ctx.fillStyle='#c8a040';
        ctx.beginPath(); ctx.arc(ex,ey,3,0,Math.PI*2); ctx.fill();
        ctx.restore();
        return true;
      });
    }
    drawBoss(ctx);
    drawTargetOutline(ctx);
    // HP bars moved below player/allies — see after drawFX

    if (state.rollFlash && state.rollFlash > 0.001){
      const a = Math.max(0, Math.min(1, state.rollFlash));
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255," + (0.55 * a).toFixed(3) + ")";
      ctx.fillRect(0,0,canvas.width, canvas.height);
      ctx.restore();
    }

    /* multiPopups: render em #worldTextOverlay via updateWorldFloatingTexts(dt) */
    // Bombas do Dinamiteiro
    if(state.dinamiteiroBombs&&state.dinamiteiroBombs.length){
      for(const bomb of state.dinamiteiroBombs){
        const bx=bomb.x*TILE+TILE/2, by=bomb.y*TILE+TILE/2;
        ctx.save();
        if(bomb.flyT<bomb.flyDur){
          // ── Voo: cilindro vermelho girando em arco parabólico ──
          const prog=bomb.flyT/bomb.flyDur;
          const sx=bomb.fromX*TILE+TILE/2, sy=bomb.fromY*TILE+TILE/2;
          const cx2=sx+(bx-sx)*prog, cy2=sy+(by-sy)*prog-Math.sin(prog*Math.PI)*48;
          const rot=prog*Math.PI*4; // gira 2 voltas completas
          ctx.save();
          ctx.translate(cx2,cy2);
          ctx.rotate(rot);
          // Sombra
          ctx.fillStyle='rgba(0,0,0,0.3)';
          ctx.fillRect(-4,3,8,3);
          // Corpo do cilindro vermelho
          const g1=ctx.createLinearGradient(-5,-7,5,-7);
          g1.addColorStop(0,'#aa1010'); g1.addColorStop(0.4,'#ee2020'); g1.addColorStop(1,'#aa1010');
          ctx.fillStyle=g1;
          ctx.fillRect(-5,-7,10,14);
          // Tampa superior
          ctx.fillStyle='#880808'; ctx.fillRect(-5,-7,10,2);
          // Tampa inferior
          ctx.fillStyle='#880808'; ctx.fillRect(-5,5,10,2);
          // Faixa preta central (estilo TNT)
          ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(-5,-1,10,2);
          // Mecha saindo do topo
          ctx.strokeStyle='#c8a020'; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.moveTo(0,-7); ctx.lineTo(2,-14); ctx.stroke();
          // Faísca na ponta da mecha (pisca durante o voo)
          if(Math.floor(bomb.flyT*20)%2===0){
            ctx.fillStyle='#ffff00';
            ctx.beginPath(); ctx.arc(2,-14,2.5,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#ff8800';
            ctx.beginPath(); ctx.arc(2,-14,1.2,0,Math.PI*2); ctx.fill();
          }
          ctx.restore();
          // Trilha de partículas de faísca
          if(Math.random()<0.6){
            state.fx.push({x:cx2+(Math.random()-0.5)*4,y:cy2+(Math.random()-0.5)*4,
              vx:(Math.random()-0.5)*30,vy:(Math.random()-0.5)*30-10,
              life:0.18,max:0.18,color:Math.random()<0.5?'#ffdd00':'#ff8800',size:1.5,grav:40});
          }
        } else {
          // ── No chão: cilindro pulsando com preview da área ──
          const fuseProg=Math.min(1,bomb.fuseT/bomb.fuseDur);
          const blinkRate=Math.max(0.06,0.22-fuseProg*0.16);
          const blinkOn=Math.floor(bomb.fuseT/blinkRate)%2===0;
          // Área de explosão (gradiente vermelho suave)
          if(fuseProg>0.35){
            const _aAlpha=(0.06+fuseProg*0.14)*(blinkOn?1.0:0.7);
            ctx.save();
            ctx.globalAlpha=_aAlpha;
            const _r=(bomb.halfR*2+1)*TILE;
            const _ax=(bomb.x-bomb.halfR)*TILE, _ay=(bomb.y-bomb.halfR)*TILE;
            const _grad=ctx.createRadialGradient(bx,by,2,bx,by,_r*0.7);
            _grad.addColorStop(0,'#ff4400'); _grad.addColorStop(1,'rgba(255,68,0,0)');
            ctx.fillStyle=_grad;
            ctx.fillRect(_ax,_ay,_r,_r);
            // Borda pontilhada da área
            ctx.globalAlpha=0.35+fuseProg*0.3;
            ctx.strokeStyle=blinkOn?'#ff6600':'#cc2200';
            ctx.lineWidth=1.5;
            ctx.setLineDash([4,3]);
            ctx.strokeRect(_ax+1,_ay+1,_r-2,_r-2);
            ctx.setLineDash([]);
            ctx.restore();
          }
          // Sombra no chão
          ctx.save();
          ctx.globalAlpha=0.25;
          ctx.fillStyle='#000';
          ctx.beginPath(); ctx.ellipse(bx,by+8,6,2.5,0,0,Math.PI*2); ctx.fill();
          ctx.restore();
          // Corpo do cilindro (vertical, pulsando levemente)
          const pulse=1+Math.sin(bomb.fuseT*18)*0.06*fuseProg;
          ctx.save();
          ctx.translate(bx,by);
          ctx.scale(pulse,pulse);
          // Corpo vermelho
          const g2=ctx.createLinearGradient(-5,-8,5,-8);
          g2.addColorStop(0,'#aa1010'); g2.addColorStop(0.35,'#ee2020'); g2.addColorStop(1,'#aa1010');
          ctx.fillStyle=g2;
          ctx.fillRect(-5,-8,10,16);
          // Tampas
          ctx.fillStyle='#880808';
          ctx.fillRect(-5,-8,10,2); ctx.fillRect(-5,6,10,2);
          // Faixa preta (TNT)
          ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(-5,-1,10,2);
          // Letrinhas "TNT" quando fuseT baixo
          if(fuseProg<0.7){
            ctx.fillStyle='rgba(255,200,200,0.7)';
            ctx.font='bold 4px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText('TNT',0,2);
          }
          // Mecha (encurta conforme o fuse avança)
          const mechaLen=Math.max(3,(1-fuseProg)*12);
          ctx.strokeStyle='#c8a020'; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(1.5*Math.sin(bomb.fuseT*8),-8-mechaLen); ctx.stroke();
          // Faísca no fim da mecha
          ctx.fillStyle=blinkOn?'#ffff00':'#ff9900';
          ctx.beginPath(); ctx.arc(1.5*Math.sin(bomb.fuseT*8),-8-mechaLen,blinkOn?3:2,0,Math.PI*2); ctx.fill();
          if(blinkOn){
            ctx.fillStyle='#ffffff';
            ctx.beginPath(); ctx.arc(1.5*Math.sin(bomb.fuseT*8)-0.8,-8-mechaLen-0.8,1,0,Math.PI*2); ctx.fill();
          }
          ctx.restore();
        }
        ctx.restore();
      }
    }
    drawExplosiveAoeFlashes(ctx);
    // Balas
    for (const b of state.bullets){
      if (!b.alive) continue;
      // Shot effect: trail particles for player bullets only (P1 usa cosmético; P2 no coop local sempre Padrão)
      var _sid = (typeof state.equippedShot === 'number') ? state.equippedShot : -1;
      if (state.coop && b.src === 'player2'){
        _sid = -1;
      }
      if(_sid >= 0 && (b.src==='player'||b.src==='player2') && window._spawnShotTrail){
        var _bdir = b.dir || {x:1,y:0};
        var _trail = window._spawnShotTrail(_sid, b.px, b.py, _bdir);
        for(var _ti=0;_ti<_trail.length;_ti++) state.fx.push(_trail[_ti]);
        var _bc = window._shotBulletColor(_sid);
        // Outline preto apenas para: Meteoro(9), Raio(16), Abissal(15)
        if(_sid===9||_sid===15||_sid===16){
          ctx.fillStyle='#111'; ctx.fillRect(b.px-3,b.py-3,6,6);
        }
        ctx.fillStyle=_bc; ctx.fillRect(b.px-2,b.py-2,4,4);
      } else {
        ctx.fillStyle = COLORS.bullet; ctx.fillRect(b.px-2, b.py-2, 4, 4);
      }
    }
    // Jogador + Aliados
    // Draw player 1. If the player is currently in the shop (online), reduce
    // opacity to indicate that they are not active in battle.  We wrap the
    // drawing in a save/restore to ensure globalAlpha does not bleed into
    // subsequent draws.
    (function drawPlayerLike(x,y,body,hat){ctx.save();try{if(state&&state.player&&state.player.inShop)ctx.globalAlpha*=0.55;}catch(_){}const px=x*TILE,py=y*TILE;ctx.fillStyle=COLORS.shadow;ctx.fillRect(px+6,py+TILE-8,TILE-12,4);const _rT=state.rollAnimT||0;if(_rT>0){ctx.save();ctx.translate(px+TILE/2,py+TILE/2);ctx.rotate((1-_rT/0.32)*Math.PI*2);ctx.translate(-(px+TILE/2),-(py+TILE/2));}ctx.fillStyle=body;ctx.fillRect(px+8,py+8,TILE-16,TILE-16);ctx.fillStyle=hat;ctx.fillRect(px+6,py+6,TILE-12,6);ctx.fillRect(px+4,py+10,TILE-8,4);ctx.fillStyle="#111";ctx.fillRect(px+14,py+16,2,2);ctx.fillRect(px+TILE-16,py+16,2,2);
      if((state.rollAnimT||0)>0)ctx.restore();
      ctx.restore();
    })(state.player.x, state.player.y, (state.player && state.player.hp <= 0 ? "#666" : (state.coop ? ((typeof state.currentSkin1 === 'number' && state.currentSkin1 >= 0 && SKINS[state.currentSkin1]) ? SKINS[state.currentSkin1].body : "#8dc07f") : (SKINS[state.currentSkin] || SKINS[0]).body)), (state.player && state.player.hp <= 0 ? "#444" : (state.coop ? ((typeof state.currentSkin1 === 'number' && state.currentSkin1 >= 0 && SKINS[state.currentSkin1]) ? SKINS[state.currentSkin1].hat : "#1f4d1f") : (SKINS[state.currentSkin] || SKINS[0]).hat)));
    // Nome no canvas removido: usar #nameOverlay + updateNameOverlay() (acima de inimigos/ouro)
    // Animação de saraivada: calcular face temporária (ponteiro gira)
    if ((state.saraivadaSpinT||0) > 0){
      state.saraivadaSpinT = Math.max(0, state.saraivadaSpinT - dt);
      const _prog = 1 - state.saraivadaSpinT / 0.32;
      const _phase = Math.floor(_prog * 12) % 8;
      const _dirs8=[{x:0,y:-1},{x:1,y:-1},{x:1,y:0},{x:1,y:1},{x:0,y:1},{x:-1,y:1},{x:-1,y:0},{x:-1,y:-1}];
      state._saraivadaRenderFace = _dirs8[_phase];
    } else {
      state._saraivadaRenderFace = null;
    }
    // Flash da Saraivada (anel dourado pulsante)
    if ((state.saraivadaFlashT||0) > 0){
      state.saraivadaFlashT = Math.max(0, (state.saraivadaFlashT||0) - dt);
      const _sf = state.saraivadaFlashT / 0.22;
      ctx.save();
      ctx.globalAlpha = _sf * 0.75;
      ctx.strokeStyle = '#f3d23b';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#ffe066';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(state.player.x*TILE + TILE/2, state.player.y*TILE + TILE/2, TILE*0.72, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }
    // Barra de vida do cowboy: azul, acima do sprite (a partir da wave 12)
    if(state.player&&state.player.max>0&&(state.wave||1)>=12){
      const _bpx=state.player.x*TILE,_bpy=state.player.y*TILE;
      const _bpct=Math.max(0,Math.min(1,state.player.hp/state.player.max));
      const _bw=Math.round((TILE-10)*_bpct);
      ctx.fillStyle='#000';ctx.fillRect(_bpx+5,_bpy-6,TILE-10,4);
      ctx.fillStyle='#49a0d9';ctx.fillRect(_bpx+5,_bpy-6,_bw,4);
    }
    // draw allies
    for (const a of state.allies){
      if (a && a.hidden) continue;
      const px=a.x*TILE, py=a.y*TILE;
      // shadow
      ctx.fillStyle = COLORS.shadow; ctx.fillRect(px+6, py+TILE-8, TILE-12, 4);

      if (a && a.type === 'dog'){
        // Dog sprite — estilo cúbico, baseado no bandido (16×16), um pouco menor (14×14)
        // Orelhas: 4×4 marrom escuro, acima dos cantos da cabeça
        ctx.fillStyle = '#7a4a18';
        ctx.fillRect(px+9,  py+6, 4, 4);   // orelha esquerda
        ctx.fillRect(px+19, py+6, 4, 4);   // orelha direita
        // Corpo marrom claro (bandido é 16×16 em px+8,py+8 → cachorro 14×14 em px+9,py+9)
        ctx.fillStyle = '#c28840';
        ctx.fillRect(px+9, py+9, 14, 14);
        // Olhos pretos — mesma posição relativa dos bandidos (3×2)
        ctx.fillStyle = '#111';
        ctx.fillRect(px+12, py+14, 3, 2);
        ctx.fillRect(px+TILE-15, py+14, 3, 2);
        // Coleira vermelha (onde seria a bandana do bandido)
        ctx.fillStyle = '#cc1a1a';
        ctx.fillRect(px+9, py+19, 14, 3);
        // Tag amarela centralizada na coleira
        ctx.fillStyle = '#f3d23b';
        ctx.fillRect(px+15, py+19, 2, 3);

        // sniff bar (only when sniffing)
        if (a.sniffing){
          const prog = Math.max(0, Math.min(1, (a.sniffT||0) / (a.sniffDur||3)));
          const bw2 = TILE-10, bh2 = 3;
          const sx = px + 5, sy = py + TILE - 5;
          ctx.fillStyle = '#000'; ctx.fillRect(sx, sy, bw2, bh2);
          ctx.fillStyle = '#f3d23b'; ctx.fillRect(sx, sy, Math.floor(bw2*prog), bh2);
        }
      } else if(a && a.type==='reparador'){
        if(state.reparadorInstantUnlocked && a._instantRepairReady){
          const pulse=0.45+0.55*Math.abs(Math.sin((state.t||0)*8));
          ctx.save();
          ctx.globalAlpha=0.35+pulse*0.35;
          ctx.strokeStyle='#66ffcc';
          ctx.lineWidth=2.5;
          ctx.shadowBlur=14+pulse*10;
          ctx.shadowColor='#aaffee';
          ctx.strokeRect(px+0.5,py+0.5,TILE-1,TILE-1);
          ctx.globalAlpha=1;
          ctx.restore();
        }
        ctx.fillStyle='#3d5a80';
        ctx.fillRect(px+8,py+8,TILE-16,TILE-16);
        ctx.fillStyle='#2a4060';
        ctx.fillRect(px+8,py+18,TILE-16,6);
        ctx.fillStyle='#111';
        ctx.fillRect(px+12,py+14,3,2);
        ctx.fillRect(px+TILE-15,py+14,3,2);
        ctx.fillStyle='#c9a227';
        ctx.fillRect(px+6,py+5,TILE-12,5);
        ctx.fillStyle='#e8d040';
        ctx.fillRect(px+8,py+2,TILE-16,6);
        const _rj=a._repairJob;
        if(_rj&&_rj.tx!=null && !(state.reparadorInstantUnlocked && a._instantRepairReady)){
          const _md=Math.abs(a.x-_rj.tx)+Math.abs(a.y-_rj.ty);
          if(_md<=1){
            const _lvl=Math.min(5,Math.max(1,state.reparadorLevel||a.level||1));
            const _need=reparadorRepairMs(_lvl);
            const prog=Math.max(0,Math.min(1,(a._repairMs||0)/_need));
            const bw2=TILE-10, bh2=3;
            const sx=px+5, sy=py+TILE-5;
            ctx.fillStyle='#000'; ctx.fillRect(sx,sy,bw2,bh2);
            ctx.fillStyle='#44dd88'; ctx.fillRect(sx,sy,Math.floor(bw2*prog),bh2);
          }
        }
      } else if(a && a.type==='dinamiteiro'){
        // Sombra
        ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(px+6,py+TILE-8,TILE-12,4);
        // Corpo amarelo
        ctx.fillStyle='#e8c020'; ctx.fillRect(px+8,py+8,TILE-16,TILE-16);
        // Bandana vermelha
        ctx.fillStyle='#cc1a1a'; ctx.fillRect(px+8,py+18,TILE-16,6);
        // Olhos
        ctx.fillStyle='#111'; ctx.fillRect(px+12,py+14,3,2); ctx.fillRect(px+TILE-15,py+14,3,2);
        // Aba chapéu preto
        ctx.fillStyle='#111'; ctx.fillRect(px+2,py+6,TILE-4,5);
        // Copa chapéu preto
        ctx.fillStyle='#1a1a1a'; ctx.fillRect(px+6,py+0,TILE-12,9);
        // Faixa amarela
        ctx.fillStyle='#c8a010'; ctx.fillRect(px+6,py+7,TILE-12,2);
      } else if(a && a.type==='xerife'){
        // ── Xerife: mesmo quadrado do parceiro, chapéu bege largo ──
        // Corpo (igual parceiro, mas roupa preta)
        ctx.fillStyle = "#1a1a1a"; ctx.fillRect(px+8, py+8, TILE-16, TILE-16);
        // Bandana laranja
        ctx.fillStyle = "#e06010"; ctx.fillRect(px+8, py+18, TILE-16, 6);
        // Olhos
        ctx.fillStyle = "#eee"; ctx.fillRect(px+12, py+14, 3, 2); ctx.fillRect(px+TILE-15, py+14, 3, 2);
        // Aba do chapéu (mais larga que o cowboy — sai dos lados)
        ctx.fillStyle = '#c8aa6a'; ctx.fillRect(px+2, py+6, TILE-4, 5);
        // Copa do chapéu (bege, mais larga e alta)
        ctx.fillStyle = '#d4b87a'; ctx.fillRect(px+6, py+0, TILE-12, 9);
        // Faixa do chapéu
        ctx.fillStyle = '#7a5030'; ctx.fillRect(px+6, py+7, TILE-12, 2);
      } else {
        ctx.fillStyle = "#8dc07f"; ctx.fillRect(px+8, py+8, TILE-16, TILE-16);
        ctx.fillStyle = "#1f4d1f"; ctx.fillRect(px+6, py+6, TILE-12, 6); ctx.fillRect(px+4, py+10, TILE-8, 4);
        ctx.fillStyle = "#111"; ctx.fillRect(px+14, py+16, 2,2); ctx.fillRect(px+TILE-16, py+16, 2,2);
      }

      // Outline de seleção (igual ao da torreta)
      if((state.selectedAlly && state.selectedAlly === a) || (state.selectedReparador && a && a.type==='reparador')){
        ctx.save(); ctx.lineWidth=2.5; ctx.strokeStyle='#2ecc71';
        ctx.strokeRect(px+2,py+2,TILE-4,TILE-4); ctx.restore();
      }
    }
    // Draw second player in coop mode
    if (state.coop && state.player2){
      (function(){
        let body, hat;
        if (state.player2 && state.player2.hp <= 0){
          body = "#666";
          hat  = "#444";
        } else {
          const idx = state.currentSkin2;
          if (typeof idx === 'number' && idx >= 0 && SKINS[idx]){
            body = SKINS[idx].body;
            hat  = SKINS[idx].hat;
          } else {
            // default partner colors
            body = "#8dc07f";
            hat  = "#1f4d1f";
          }
        }
        const px2 = state.player2.x*TILE, py2 = state.player2.y*TILE;
        ctx.save();
        // Reduce opacity if player 2 is in the shop (online), to indicate inactivity
        try{
          if (state && state.player2 && state.player2.inShop){ ctx.globalAlpha *= 0.55; }
        }catch(_){}
        // shadow
        ctx.fillStyle = COLORS.shadow; ctx.fillRect(px2+6, py2+TILE-8, TILE-12, 4);
        // body and hat
        ctx.fillStyle = body; ctx.fillRect(px2+8, py2+8, TILE-16, TILE-16);
        ctx.fillStyle = hat; ctx.fillRect(px2+6, py2+6, TILE-12, 6); ctx.fillRect(px2+4, py2+10, TILE-8, 4);
        // eyes
        ctx.fillStyle = "#111"; ctx.fillRect(px2+14, py2+16, 2,2); ctx.fillRect(px2+TILE-16, py2+16, 2,2);
        ctx.restore();
      })();
    }
    // Draw revival outlines for downed cowboys in coop
    if (state && state.coop){
      // Downed player 1 outline
      if (state.player && state.player.hp <= 0){
        let near = false;
        if (state.player2 && state.player2.hp > 0){
          const dd = Math.abs(state.player2.x - state.player.x) + Math.abs(state.player2.y - state.player.y);
          near = dd <= 1;
        }
        ctx.save();
        ctx.lineWidth = near ? 3 : 2;
        ctx.strokeStyle = near ? 'rgba(243,210,59,0.9)' : 'rgba(160,160,160,0.6)';
        ctx.strokeRect(state.player.x*TILE + 2, state.player.y*TILE + 2, TILE - 4, TILE - 4);
        ctx.restore();
      }
      // Downed player 2 outline
      if (state.player2 && state.player2.hp <= 0){
        let near = false;
        if (state.player && state.player.hp > 0){
          const dd = Math.abs(state.player.x - state.player2.x) + Math.abs(state.player.y - state.player2.y);
          near = dd <= 1;
        }
        ctx.save();
        ctx.lineWidth = near ? 3 : 2;
        ctx.strokeStyle = near ? 'rgba(243,210,59,0.9)' : 'rgba(160,160,160,0.6)';
        ctx.strokeRect(state.player2.x*TILE + 2, state.player2.y*TILE + 2, TILE - 4, TILE - 4);
        ctx.restore();
      }
    }

    drawFX(ctx); // aura particles above all sprites

    // Swamp post-effects: fog and fireflies on top of sprites
    try{ drawSwampFog(ctx); }catch(_){}
    try{ drawSwampFireflies(ctx); }catch(_){}
    try{ drawSwampBubbles(ctx); }catch(_){}
    // ─── HP bars drawn on top of EVERYTHING (players, enemies, FX) ───
    // Gold HP bar
    (function(){
      const g=state.gold; const px=g.x*TILE,py=g.y*TILE;
      const w=TILE-8; const pct=Math.max(0,g.hp/g.max);
      ctx.fillStyle='#000'; ctx.fillRect(px+4,py-6,w,5);
      ctx.fillStyle=COLORS.gold; ctx.fillRect(px+4,py-6,Math.round(w*pct),5);
    })();
    // Sentry HP bars
    if(state.sentries){ for(const t of state.sentries){ const hp=(t.hp==null?4:t.hp); const w=Math.round((TILE-18)*Math.max(0,hp/4)); const px=t.x*TILE,py=t.y*TILE; const _hpY=py-7; ctx.fillStyle='#000'; ctx.fillRect(px+9,_hpY,TILE-18,5); ctx.fillStyle='#2ecc71'; ctx.fillRect(px+9,_hpY,w,5); } }
    // Espantalho HP bars
    if(state.espantalhos){for(const _esp2 of state.espantalhos){if(_esp2.hp<=0)continue;const _st2=espantalhoStats(_esp2.level||1);const _p2=Math.max(0,_esp2.hp/_st2.maxHp);const _w2=TILE-8;const _ex2=_esp2.x*TILE,_ey2=_esp2.y*TILE;ctx.fillStyle='#000';ctx.fillRect(_ex2+4,_ey2-9,_w2,5);ctx.fillStyle=_p2>0.6?'#c97a2b':_p2>0.3?'#d04010':'#c82020';ctx.fillRect(_ex2+4,_ey2-9,Math.round(_w2*_p2),5);}}
    // Mine HP bars
    if(state.goldMines){ for(const m of state.goldMines){ if(m.hp<=0)continue; const hpPct=Math.max(0,m.hp/m.maxHp); const hpW=TILE-8; const px=m.x*TILE,py=m.y*TILE; ctx.fillStyle='#000'; ctx.fillRect(px+4,py-9,hpW,5); ctx.fillStyle=hpPct>0.6?'#e8c020':hpPct>0.3?'#e07820':'#c82020'; ctx.fillRect(px+4,py-9,Math.round(hpW*hpPct),5); } }
    // Barricada HP bars
    if(state.barricadas){ for(const bar of state.barricadas){ if(bar.hp<=0)continue; const hpPct=Math.max(0,bar.hp/bar.maxHp); const hpW=TILE-8; const px=bar.x*TILE,py=bar.y*TILE; ctx.fillStyle='#000'; ctx.fillRect(px+4,py-9,hpW,5); ctx.fillStyle=hpPct>0.6?'#a06020':hpPct>0.3?'#c04010':'#c82020'; ctx.fillRect(px+4,py-9,Math.round(hpW*hpPct),5); } }

    /*__GOLD_WARN__*/
    (function(){
      if (!(state.goldWarnT>0)) return;
      const g = state.gold;
      const cx = g.x*TILE + TILE/2;
      const topY = g.y*TILE - 6;
      const a = Math.min(1, state.goldWarnT);
      const bounce = Math.sin((state.t||0)*10) * 3;
    })();

    // Indicador de direção
    if (!state.pausedShop && !state.pausedManual && state.running){
      // Draw direction indicator for player1 only if alive
      if (state.player && state.player.hp > 0){
        const p = state.player;
        const cx = p.x*TILE + TILE/2;
        const cy = p.y*TILE + TILE/2;
        const _sf = state._saraivadaRenderFace || p.face;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + _sf.x*14, cy + _sf.y*14);
        ctx.stroke();
      }
      // Indicador de direção do Parceiro e do Xerife (não do Cachorro)
      for (var _ai2=0; _ai2 < state.allies.length; _ai2++){
        var _al = state.allies[_ai2];
        if(!_al || _al.hidden || _al.type==='dog' || _al.type==='dinamiteiro' || _al.type==='reparador' || _al.hp<=0) continue;
        var _alx = _al.x*TILE + TILE/2, _aly = _al.y*TILE + TILE/2;
        var _alf = _al.face || DIRS.up;
        ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(_alx,_aly); ctx.lineTo(_alx+_alf.x*14,_aly+_alf.y*14); ctx.stroke();
      }
      // Indicador de direção do Cowboy 2
      if (state.coop && state.player2 && state.player2.hp > 0){
        const p2 = state.player2;
        const cx2 = p2.x*TILE + TILE/2;
        const cy2 = p2.y*TILE + TILE/2;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx2, cy2);
        ctx.lineTo(cx2 + p2.face.x*14, cy2 + p2.face.y*14);
        ctx.stroke();
      }
    }

    
    /*__PLAYER_WARN__*/
    /*__DYNA_DISARM_PROGRESS__*/
    (function(){
      const disarms = [];
      for (const z of state.bandits){ if (z.alive && z.vandal && z.disarming) disarms.push(z.disarming); }
      if (!disarms.length) return;
      for (const d of disarms){
        const tx = d.x, ty = d.y;
        const dyn = state.dynamites && state.dynamites.find(dd => dd.x===tx && dd.y===ty && dd.armed);
        if (!dyn) continue;
        const start = d.startAt || (d.endAt - DYNA_DISARM_MS);
        const now = performance.now();
        const t = Math.max(0, Math.min(1, (now - start) / DYNA_DISARM_MS));
        const px = tx*TILE, py = ty*TILE;
        const w = TILE-6, h = 5, x = px + 3, y = py + TILE - h - 2;
        ctx.save();
        ctx.fillStyle = "#1b1206"; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = "#6b4b1b"; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = "#ff4a4a"; ctx.fillRect(x, y, Math.floor(w*t), h);
        ctx.restore();
      }
    })();

    /*__REVIVE_PROGRESS__*/
    (function(){
      // Draw revival progress bars for downed players in coop mode
      if (!state || !state.coop) return;
      const barW = TILE - 6;
      const barH = 5;
      // Player1 progress
      if (state.player && state.player.hp <= 0 && state.reviveTimer1 && state.reviveTimer1 > 0){
        const t = Math.max(0, Math.min(1, state.reviveTimer1 / 6.0));
        const px = state.player.x * TILE;
        const py = state.player.y * TILE;
        const x = px + 3;
        const y = py - 8; // place above the tile
        ctx.save();
        ctx.fillStyle = "#1b1206";
        ctx.fillRect(x, y, barW, barH);
        ctx.strokeStyle = "#6b4b1b";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barW, barH);
        ctx.fillStyle = "#f3d23b";
        ctx.fillRect(x, y, Math.floor(barW * t), barH);
        ctx.restore();
      }
      // Player2 progress
      if (state.player2 && state.player2.hp <= 0 && state.reviveTimer2 && state.reviveTimer2 > 0){
        const t2 = Math.max(0, Math.min(1, state.reviveTimer2 / 6.0));
        const px2 = state.player2.x * TILE;
        const py2 = state.player2.y * TILE;
        const x2 = px2 + 3;
        const y2 = py2 - 8;
        ctx.save();
        ctx.fillStyle = "#1b1206";
        ctx.fillRect(x2, y2, barW, barH);
        ctx.strokeStyle = "#6b4b1b";
        ctx.lineWidth = 1;
        ctx.strokeRect(x2, y2, barW, barH);
        ctx.fillStyle = "#f3d23b";
        ctx.fillRect(x2, y2, Math.floor(barW * t2), barH);
        ctx.restore();
      }
    })();

    /*__SENTRY_WARN__*/
    (function(){
      if (!state.sentries || state.sentries.length===0) return;
      for (const t of state.sentries){
        if (!(t.warnT>0)) continue;
        const cx = t.x*TILE + TILE/2;
        const topY = t.y*TILE - 6;
        const a = Math.min(1, t.warnT);
        const bounce = Math.sin((state.t||0)*10) * 3;
      }
    })();

    (function(){
      if (!(state.playerWarnT>0)) return;
      const p = state.player;
      const cx = p.x*TILE + TILE/2;
      const topY = p.y*TILE - 6;
      const a = Math.min(1, state.playerWarnT);
      const bounce = Math.sin((state.t||0)*10) * 3;
    })();
    // Indicador de pilha (xN): DOM em updateWorldFloatingTexts

    // Overlays: Game Over (smooth) + Pause dim + 'Pausado' text
    if (state.gameOverFade > 0.001){
      const a = Math.max(0, Math.min(1, state.gameOverFade));
      ctx.fillStyle = "rgba(0,0,0," + (0.55 * a).toFixed(3) + ")";
      ctx.fillRect(0,0,canvas.width, canvas.height);
    }else if(state.running&&(state.pausedShop||state.pausedManual)&&!state._selectionPaused&&!state.placingSentry&&!state.movingSentry&&!state.placingClearPath&&!state.placingGoldMine&&!state.movingGoldMine&&!state.placingBarricada&&!state.movingBarricada&&!state.placingPichaPoco&&!state.movingPichaPoco&&!state.placingPortalBlue&&!state.placingPortalOrange&&!state.placingEspantalho&&!state.movingEspantalho){const dim=state.pausedShop?1:Math.max(0,Math.min(1,state.pauseFade));ctx.fillStyle="rgba(0,0,0,"+(0.25*dim).toFixed(3)+")";ctx.fillRect(0,0,canvas.width,canvas.height);}

    /* "Pausado": texto em #worldTextOverlay */

    if (state.playerFlashT>0){
      state.playerFlashT = Math.max(0, state.playerFlashT - dt*2.2);
      ctx.fillStyle = 'rgba(180,0,0,' + (0.35*state.playerFlashT) + ')';
      ctx.fillRect(0,0,canvas.width, canvas.height);
    }

    if(state.goldFlashT>0){state.goldFlashT=Math.max(0,state.goldFlashT-dt*2.2);ctx.fillStyle='rgba(180,0,0,'+(0.35*state.goldFlashT)+')';ctx.fillRect(0,0,canvas.width,canvas.height);}
    if((state.multiFlashT||0)>0){state.multiFlashT=Math.max(0,state.multiFlashT-dt*2.5);try{const _mc=state.multiFlashColor||'#f3d23b',_r=parseInt(_mc.slice(1,3),16),_g=parseInt(_mc.slice(3,5),16),_b=parseInt(_mc.slice(5,7),16),_ma=(state.multiFlashAlpha||0.2)*state.multiFlashT;ctx.fillStyle='rgba('+_r+','+_g+','+_b+','+_ma.toFixed(3)+')';ctx.fillRect(0,0,canvas.width,canvas.height);}catch(_){}}
    if((state.secondChanceFlashT||0)>0){state.secondChanceFlashT=Math.max(0,state.secondChanceFlashT-dt*1.8);const _a=(Math.pow(state.secondChanceFlashT,0.5)*0.75);ctx.fillStyle='rgba(255,240,180,'+_a.toFixed(3)+')';ctx.fillRect(0,0,canvas.width,canvas.height);}
    ctx.restore();
    try{
      if (typeof updateNameOverlay === 'function') updateNameOverlay();
      if (typeof updateWorldFloatingTexts === 'function') updateWorldFloatingTexts(dt);
    }catch(_){}
  } catch(loopErr) {
    // Se ocorreu erro, limpa estado inconsistente (ex: torreta destruída)
    try {
      if (state) {
        state.selectedSentry = null;
        state.placingSentry = false;
        state.movingSentry = null;
        state.pausedManual = false;
        // Remove sentinelas inconsistentes (estado de erro)
        if (state.sentries) {
          state.sentries = state.sentries.filter(t => t && typeof t.x === 'number');
        }
        if (state.target) {
          // Valida o alvo atual
          const validTarget = state.bandits && state.bandits.find(z => z && z.alive && z.id === (state.target && state.target.id));
          if (!validTarget) state.target = null;
        }
      }
    } catch(_) {}
  }
  requestAnimationFrame(loop);
}

/*__MENU_SAFE_LISTENERS__*/
(function(){
  const s = document.getElementById("btnStart");
  if (s && !s._bound){ s._bound = true; s.addEventListener("click", startGame); }
})();
// Loja

  /** Coop local: loja cinza/bloqueada para jogador morto; online não altera. */
  function syncCoopLocalShopDeathButtons(){
    if (!state || !state.coop) return;
    const b1 = document.getElementById('p1ShopBtn');
    const b2 = document.getElementById('p2ShopBtn');
    if (!b1 || !b2) return;
    try{
      const body = document.body;
      if (body && (
        body.getAttribute('data-results-open')==='1' ||
        body.getAttribute('data-options-open')==='1' ||
        body.getAttribute('data-confirm-open')==='1' ||
        body.getAttribute('data-shop-open')==='1'
      )) return;
    }catch(_){}

    const d1 = !!state.dead1;
    const d2 = !!state.dead2;

    function apply(btn, dead){
      btn.disabled = !!dead;
      if (dead){
        btn.style.opacity = '0.42';
        btn.style.filter = 'grayscale(1)';
        btn.style.cursor = 'not-allowed';
        try{ btn.style.pointerEvents = 'none'; }catch(_){}
        try{ btn.setAttribute('aria-disabled', 'true'); }catch(_){}
      } else {
        btn.style.opacity = '';
        btn.style.filter = '';
        btn.style.cursor = '';
        try{ btn.style.pointerEvents = ''; }catch(_){}
        try{ btn.removeAttribute('aria-disabled'); }catch(_){}
      }
    }
    apply(b1, d1);
    apply(b2, d2);
  }
  window.syncCoopLocalShopDeathButtons = syncCoopLocalShopDeathButtons;

  function openShop(){
    try{ if (document.body && document.body.getAttribute('data-results-open')==='1') return; }catch(_){ }
    try{ state.pausedShop = true; }catch(_){ state.pausedShop = true; }
    refreshShopVisibility();
    // Update shop heading based on active player in coop or online
    if (typeof shopHeading !== 'undefined' && shopHeading){
      if (state.coop){
        // Use chosen names when available (for online coop). Fallback to default labels.
        let pname = '';
        try{
          if (state.activeShopPlayer === 1 && state.player){ pname = state.player.name || 'Cowboy 1'; }
          else if (state.activeShopPlayer === 2 && state.player2){ pname = state.player2.name || 'Cowboy 2'; }
        }catch(_){}
        if (!pname){ pname = (state.activeShopPlayer === 1 ? 'Cowboy 1' : 'Cowboy 2'); }
        shopHeading.textContent = 'Loja de ' + pname;
      } else {
        shopHeading.textContent = 'Loja';
      }
    }
    // Adjust shop card appearance and score display based on active player in coop
    try{
      const card = document.getElementById('shopCard');
      if (state.coop){
        if (card){
          // remove any existing player‑theme classes and apply the appropriate one based on the active
          // shop player (supports up to 4 players).  Default to p1 if index out of range.
          card.classList.remove('p1','p2','p3','p4');
          const idx = Math.max(1, Math.min(4, state.activeShopPlayer||1));
          card.classList.add('p' + idx);
        }
        if (scoreLabelShop && scoreLabelShop.parentElement){
          scoreLabelShop.parentElement.style.display = 'none';
        }
      } else {
        if (card) card.classList.remove('p1','p2');
        if (scoreLabelShop && scoreLabelShop.parentElement){
          scoreLabelShop.parentElement.style.display = '';
        }
      }
    }catch(e){}

    // Coop local: morto = botão da loja bloqueado
    if (state.coop){
      try{ syncCoopLocalShopDeathButtons(); }catch(_){}
      // Ensure roll cost reflects the active player's current price
      try{
        const span = document.querySelector('span[data-cost="roll"]');
        if (span){
          const cost = (state.activeShopPlayer === 1 ? state.rollCost1 : state.rollCost2);
          span.textContent = String(cost);
        }
      }catch(_){}
    }
    // Lock HUD + hotkeys while shop is open (single/co-op; online only locks HUD)
    try{ document.body.setAttribute('data-shop-open','1'); }catch(_){}
    try{ __hudLockButtons(); }catch(_){}
    try{ const pb=document.getElementById('pauseBtn'); if(pb) pb.textContent='Despausar'; }catch(_){}
    // Show modal
    shopModal.style.display = "flex";
    shopModal.setAttribute("aria-hidden", "false");
    // Immediately update HUD (scores) while shop is open
    try{ updateHUD(); }catch(e){}
  }
  function closeShopModal(){
    shopModal.style.display = "none";
    shopModal.setAttribute("aria-hidden", "true");
    try{ state.pausedShop = false; }catch(_){ state.pausedShop = false; }

    // Unlock HUD/hotkeys after closing shop (only if no other modal is open)
    try{ document.body.removeAttribute('data-shop-open'); }catch(_){}
    try{ __hudUnlockButtonsIfNoModal(); }catch(_){}
    try{
      const pb=document.getElementById('pauseBtn');
      if(pb){ pb.textContent = (state && (state.pausedManual || state.pausedShop)) ? 'Despausar' : 'Pausar'; }
    }catch(_){}
    // Coop local: reabilitar conforme vivo/morto
    if (state && state.coop){
      try{ syncCoopLocalShopDeathButtons(); }catch(_){}
    }
    if (state._pendingAllyDialog){ setTimeout(()=>{ try{ maybeStartAllyDialog(); }catch(_){} }, 80); }
    if (state._pendingDogDialog && state._pendingDogDialogAfterShop){ 
      state._pendingDogDialogAfterShop = false;
      setTimeout(()=>{ try{ maybeStartDogDialog(); }catch(_){} }, 80);
    }
    if (state._pendingXerifeDialog && state._pendingXerifeDialogAfterShop){
      state._pendingXerifeDialogAfterShop = false;
      setTimeout(()=>{ try{ maybeStartXerifeDialog(); }catch(_){} }, 80);
    }
    if (state._pendingDinamiteiroDialog && state._pendingDinamiteiroDialogAfterShop){
      state._pendingDinamiteiroDialogAfterShop = false;
      setTimeout(()=>{ try{ maybeStartDinamiteiroDialog(); }catch(_){} }, 80);
    }
    if (state._pendingReparadorDialog && state._pendingReparadorDialogAfterShop){
      state._pendingReparadorDialogAfterShop = false;
      setTimeout(()=>{ try{ maybeStartReparadorDialog(); }catch(_){} }, 80);
    }
  }
  
  function maybeStartAllyDialog(){
    if (!state || !state.running) return;
    if (!state._pendingAllyDialog) return;
    if (!state.allies || state.allies.length===0) return;
    state._pendingAllyDialog = false;
    
    const variants = [
      [
        {name:"Parceiro", text:"Ouvi o barulho daqui da estrada."},
        {name:"Parceiro", text:"Disse pra mim mesmo: isso é ou tiroteio ou festa."},
        {name:"Parceiro", text:"Cheguei preparado pros dois."}
      ],
      [
        {name:"Parceiro", text:"Relaxa, já lidei com coisa pior que bandido."},
        {name:"Parceiro", text:"Tipo a minha sogra."}
      ],
      [
        {name:"Parceiro", text:"Me chamaram de doido por vir te ajudar."},
        {name:"Parceiro", text:"Mas doido mesmo é quem tenta roubar ouro de dois malucos armados."}
      ],
      [
        {name:"Parceiro", text:"Trouxe minha companheira... a pistola, não a esposa."},
        {name:"Parceiro", text:"Vamos dar um susto nesses malandros antes que encostem no ouro."}
      ],
      [
        {name:"Parceiro", text:"Tá com cara de confusão boa por aqui."},
        {name:"Parceiro", text:"Já deixei minha mula amarrada e trouxe o rifle."}
      ],
      [
        {name:"Parceiro", text:"Rapaz... vi ouro brilhando daqui da ladeira."},
        {name:"Parceiro", text:"Achei que era miragem, mas é treta mesmo."},
        {name:"Parceiro", text:"Bora fazer poeira voar."}
      ],
      [
        {name:"Parceiro", text:"Cheguei, chefe! Me contrata aí que o currículo é BALA."},
        {name:"Parceiro", text:"Sou especialista em cobrir os canto e conversar fiado."}
      ],
      [
        {name:"Parceiro", text:"Ué, é treta ou festa?"},
        {name:"Parceiro", text:"Se for festa, me avisa... que eu trouxe bala pra todo mundo."}
      ],
      [
        {name:"Parceiro", text:"Ouro no meio do nada, cercado de bandido..."},
        {name:"Parceiro", text:"Essa história tá com cheiro de emboscada."},
        {name:"Parceiro", text:"E eu adoro uma emboscada."}
      ]
    ];

    const pick = Math.floor(Math.random()*variants.length);
    const lines = variants[pick];
    startDialog(lines, {portrait:'ally', name:'Parceiro'});
  }
  function toggleShop(){ try{ if (enemiesModal && enemiesModal.style.display==="flex") closeEnemiesModal(); }catch(e){} if (shopModal.style.display === "flex") closeShopModal(); else openShop(); }
  shopBtn.addEventListener("click", openShop);
  
  // Voltar ao menu (com confirmação)
  (function(){
    const menuBackBtn = document.getElementById("menuBackBtn");
    if (menuBackBtn && !menuBackBtn._bound){
      menuBackBtn._bound = true;
      menuBackBtn.addEventListener("click", ()=>{
        // Pausa o jogo e abre confirmação
        state.pausedManual = true;
        const m = document.getElementById("confirmModal");
        if (m){ m.style.display = "flex"; m.setAttribute("aria-hidden","false"); }
      });
    }
  })();
closeShop.addEventListener("click", closeShopModal);

  
  // === HUD lock helpers for in-game modals (Shop / Confirm Menu) ===
  function __hudLockButtons(){
    try{
      ['shopBtn','menuBackBtn','pauseBtn','enemiesBtn','ingameOptBtn','p1ShopBtn','p2ShopBtn'].forEach(function(id){
        var b=document.getElementById(id);
        if(b){
          b.disabled = true;
          try{ b.setAttribute('aria-disabled','true'); }catch(_){}
          try{ b.style.pointerEvents='none'; }catch(_){}
        }
      });
    }catch(_){}
  }
  function __hudUnlockButtonsIfNoModal(){
    try{
      const body = document.body;
      const anyOpen =
        (body && body.getAttribute('data-results-open')==='1') ||
        (body && body.getAttribute('data-options-open')==='1') ||
        (body && body.getAttribute('data-shop-open')==='1') ||
        (body && body.getAttribute('data-confirm-open')==='1');
      if(anyOpen) return;
      ['shopBtn','menuBackBtn','pauseBtn','enemiesBtn','ingameOptBtn','p1ShopBtn','p2ShopBtn'].forEach(function(id){
        var b=document.getElementById(id);
        if(b){
          b.disabled = false;
          try{ b.setAttribute('aria-disabled','false'); }catch(_){}
          try{ b.style.pointerEvents=''; }catch(_){}
        }
      });
      try{
        if (state && state.coop && state.running && !state.inMenu){
          syncCoopLocalShopDeathButtons();
        }
      }catch(_){}
    }catch(_){}
  }
// Confirmação para voltar ao menu
  function openConfirmMenu(){ state.pausedManual = true; try{ document.body.setAttribute('data-confirm-open','1'); }catch(_){ } try{ __hudLockButtons(); }catch(_){ } try{ const pb=document.getElementById('pauseBtn'); if(pb) pb.textContent='Despausar'; }catch(_){ } const m=document.getElementById("confirmModal"); if(m){ m.style.display="flex"; m.setAttribute("aria-hidden","false"); } }
  function closeConfirmMenu(){ const m=document.getElementById("confirmModal"); if(m){ m.style.display="none"; m.setAttribute("aria-hidden","true"); } state.pausedManual = false; try{ document.body.removeAttribute('data-confirm-open'); }catch(_){ } try{ __hudUnlockButtonsIfNoModal(); }catch(_){ } try{ const pb=document.getElementById('pauseBtn'); if(pb) pb.textContent=(state && (state.pausedManual||state.pausedShop))?'Despausar':'Pausar'; }catch(_){ } }
  (function(){
    const noBtn = document.getElementById("confirmNo");
    const yesBtn = document.getElementById("confirmYes");
    if (noBtn && !noBtn._bound){ noBtn._bound=true; noBtn.addEventListener("click", ()=>{ closeConfirmMenu(); }); }
    if (yesBtn && !yesBtn._bound){ yesBtn._bound=true; yesBtn.addEventListener("click", ()=>{
      // Confirma: reseta e volta ao menu (progresso perdido)
      closeConfirmMenu();
      // If currently in coop, use coop reset to keep both jogadores alive
      if (state && state.coop){
        resetGameCoop();
      } else {
        resetGame();
      }
      // Clear coop state so that returning to the menu resets UI and
      // gameplay back to single‑player mode. Without clearing this flag or
      // removing the secondary cowboy, starting a new solo run after
      // leaving coop could inherit coop HUD elements or leftover data.
      if (state){
        state.coop = false;
        delete state.player2;
      }
      try{ if (window.releaseCoopInputModeLock) window.releaseCoopInputModeLock(); }catch(_){}
      state.running = false;
      state.inMenu = true;
      musicStop();
      showMenu();
    }); }
    // Fechar ao clicar fora do card
    const modal = document.getElementById("confirmModal");
    if (modal && !modal._bound){ modal._bound=true; modal.addEventListener("click", (e)=>{ if (e.target === modal) closeConfirmMenu(); }); }
  })();
  shopModal.addEventListener("click", (e)=>{ if (e.target === shopModal) closeShopModal(); });
  function maybeStartDogDialog(){
    if (!state || !state.running) return;
    if (!state._pendingDogDialog) return;
    const d = getDog();
    if (!d) return;
    state._pendingDogDialog = false;
    state._revealDogAfterDialog = true;

    const variants = [
      [ {name:"Cachorro", text:"Au! Au!"} ],
      [ {name:"Cachorro", text:"Ruff! Au!"} ],
      [ {name:"Cachorro", text:"Au au au!"} ],
      [ {name:"Cachorro", text:"Grr... au!"} ],
      [ {name:"Cachorro", text:"Auuuu!"} ]
    ];
    const pick = variants[randInt(0, variants.length-1)];
    startDialog(pick, { portrait: 'dog', name: 'Cachorro' });
  }

  function maybeStartXerifeDialog(){
    if(!state||!state.running) return;
    if(!state._pendingXerifeDialog) return;
    const xr=getXerife(); if(!xr) return;
    state._pendingXerifeDialog=false;
    state._revealXerifeAfterDialog=true;

    const variants=[
      [
        {name:"Xerife",text:"Esse povo devia arrumar um emprego."},
        {name:"Xerife",text:"Mas insistem em virar estatística."}
      ],
      [
        {name:"Xerife",text:"Cheguei pra botar ordem nesse chiqueiro."},
        {name:"Xerife",text:"Se eu vir um vagabundo encostando nas suas coisas..."},
	{name:"Xerife",text:"Ele vai conhecer o abraço da minha corda."}
      ],
      [
        {name:"Xerife",text:"Tem muito idiota por metro quadrado aqui."},
        {name:"Xerife",text:"Bom pra mim, hoje eu tô inspirado."}
      ],
      [
        {name:"Xerife",text:"Pode ficar tranquilo."},
        {name:"Xerife",text:"Hoje eu tô com pouca paciência e muita munição."},
	{name:"Xerife",text:"Pior combinação pra quem fizer gracinha."}
      ],
      [
        {name:"Xerife",text:"Que cena linda."},
        {name:"Xerife",text:"Poeira, gritaria e vagabundo prestes a se ferrar."}
      ],
      [
        {name:"Xerife",text:"Hoje ninguém quebra nada."},
        {name:"Xerife",text:"Exceto eu. E vai ser osso."}
      ],
      [
        {name:"Xerife",text:"Eu não faço milagre."},
        {name:"Xerife",text:"Mas faço marginal sumir rapidinho."},
	{name:"Xerife",text:"Já ajuda bastante."}
      ],
      [
        {name:"Xerife",text:"Construir dá trabalho."},
        {name:"Xerife",text:"Por isso esses vermes preferem quebrar."},
	{name:"Xerife",text:"É a lógica do fracassado."}
      ],
      [
        {name:"Xerife",text:"Quem chamou a polícia?"},
        {name:"Xerife",text:"Espero que não tenha sido o pessoal dos direitos humanos..."},
	{name:"Xerife",text:"Porque eu tenho uma tendência a resolver as coisas à moda antiga."}
      ],
      [
        {name:"Xerife",text:"Tem gente que chama isso de opressão."},
        {name:"Xerife",text:"Eu chamo de prevenção."}
      ]
    ];
    const pick=variants[randInt(0,variants.length-1)];
    startDialog(pick,{portrait:'xerife',name:'Xerife'});
  }

  function maybeStartDinamiteiroDialog(){
    if(!state||!state.running) return;
    if(!state._pendingDinamiteiroDialog) return;
    const dm=getDinamiteiro(); if(!dm) return;
    state._pendingDinamiteiroDialog=false;

    const variants=[
      [
        {name:"Dinamiteiro",text:"Minha mãe dizia que eu ia bombar com meu talento."},
        {name:"Dinamiteiro",text:"Bom, ela não tava errada."}
      ],
      [
        {name:"Dinamiteiro",text:"Fui ao psicólogo uma vez."},
        {name:"Dinamiteiro",text:"Ele disse que eu tenho tendências destrutivas..."},
        {name:"Dinamiteiro",text:"Tomei isso como um elogio."}
      ],
      [
        {name:"Dinamiteiro",text:"Minha ex dizia que eu era explosivo demais."},
        {name:"Dinamiteiro",text:"O pior é que eu não tinha nem como contestar..."}
      ],
      [
        {name:"Dinamiteiro",text:"As pessoas me chamam de instável..."},
        {name:"Dinamiteiro",text:"Eu prefiro 'dinamicamente imprevisível'."}
      ],
      [
        {name:"Dinamiteiro",text:"Não se preocupa com dano colateral."},
        {name:"Dinamiteiro",text:"Só com os que tão do lado errado."},
        {name:"Dinamiteiro",text:"E hoje é todo mundo que não sou eu."}
      ],
      [
        {name:"Dinamiteiro",text:"Já trabalhei em mina, em pedreira, em fazenda..."},
        {name:"Dinamiteiro",text:"Em todo lugar que precisava de algo explodido."}
      ],
      [
        {name:"Dinamiteiro",text:"Odeio trabalho fino."},
        {name:"Dinamiteiro",text:"Por isso inventei o meu próprio método."},
        {name:"Dinamiteiro",text:"Jogou, esperou, BOOM. Simples assim."}
      ],
      [
        {name:"Dinamiteiro",text:"Pode deixar o ouro comigo."},
        {name:"Dinamiteiro",text:"Ninguém atravessa uma parede de fogo pra roubar nada."}
      ]
    ];
    const pick=variants[randInt(0,variants.length-1)];
    startDialog(pick,{portrait:'dinamiteiro',name:'Dinamiteiro'});
  }

  function maybeStartReparadorDialog(){
    if (!state || !state.running) return;
    if (!state._pendingReparadorDialog) return;
    const rp = getReparador();
    if (!rp) return;
    state._pendingReparadorDialog = false;

    const variants = [
      [
        { name: 'Reparador', text: 'Contrataram um técnico? Boa escolha.' },
        { name: 'Reparador', text: 'Aqui é conserto na unha e no parafuso.' }
      ],
      [
        { name: 'Reparador', text: 'Vi torre torta, mina rangendo, barricada banguela…' },
        { name: 'Reparador', text: 'Relaxa: o que der pra endireitar, eu endireito.' }
      ],
      [
        { name: 'Reparador', text: 'Meu lema é simples: aperta bem e reza pouco.' },
        { name: 'Reparador', text: 'Chave não falha se a mão for firme.' }
      ],
      [
        { name: 'Reparador', text: 'Ouro valendo mais que igreja e estrutura rangendo?' },
        { name: 'Reparador', text: 'Isso é prioridade torta — daqui a pouco a gente nivela.' }
      ],
      [
        { name: 'Reparador', text: 'Se quebrar de novo, não foi culpa minha.' },
        { name: 'Reparador', text: 'Foi o bando que tem inveja do meu trabalho bonito.' }
      ],
      [
        { name: 'Reparador', text: 'Traz café preto e deixa eu trabalhar.' },
        { name: 'Reparador', text: 'Ferramenta responde melhor com cafeína.' }
      ],
      [
        { name: 'Reparador', text: 'Rumor na estrada: o ouro chora pedindo parafuso.' },
        { name: 'Reparador', text: 'Cheguei com cola forte e paciência curta.' }
      ],
      [
        { name: 'Reparador', text: 'Não sou santo, mas o conserto fica redondo.' },
        { name: 'Reparador', text: 'Redondo como moeda — encaixa direitinho.' }
      ],
      [
        { name: 'Reparador', text: 'Explosão é coisa de dinamiteiro.' },
        { name: 'Reparador', text: 'Eu prefiro silêncio… só o rangido do metal endireitando.' }
      ],
      [
        { name: 'Reparador', text: 'Missão dada é parafuso apertado.' },
        { name: 'Reparador', text: 'Bora botar essa cidade de pé de novo.' }
      ]
    ];
    const pick = variants[randInt(0, variants.length - 1)];
    startDialog(pick, { portrait: 'reparador', name: 'Reparador' });
  }

  (function(){
  const PER = 6;
  let pg = 0;



  function render(){
    const all = Array.from(document.querySelectorAll('#shopGrid .card'));
    // Ordenação fixa por preço base (data-sorder), nunca muda
    all.sort((a,b) => (+a.dataset.sorder||99) - (+b.dataset.sorder||99));
    // Reapend sorted cards to DOM so visual order matches sorder
    const _grid = document.getElementById('shopGrid');
    if(_grid){ all.forEach(card => _grid.appendChild(card)); }
    // Visíveis = não ocultos por condição de jogo (_cond)
    const tab = (window._shopTab || 'player');
    const vis = all.filter(c => !c._cond && ((c.dataset.cat||'player')===tab));
    const pages = Math.max(1, Math.ceil(vis.length/PER));
    pg = Math.max(0, Math.min(pg, pages-1));
    // Ocultar todos (não-_cond) primeiro
    all.forEach(c => { if (!c._cond) c.style.display = 'none'; });
    // Exibir apenas os da página atual
    vis.slice(pg*PER, (pg+1)*PER).forEach(c => { c.style.display = ''; });
    const lbl = document.getElementById('pgLabel');
    if (lbl) lbl.textContent = (pg+1)+'/'+pages;
    const prev = document.getElementById('pgPrev');
    if (prev) prev.disabled = pg===0;
    const next = document.getElementById('pgNext');
    if (next) next.disabled = pg>=pages-1;
    try{ syncShopQtyIndicators(); }catch(_){}
  }

  window._renderShopPage = render;
  window._setShopPage = p => { pg=p||0; render(); };
  document.getElementById('pgPrev')?.addEventListener('click',()=>{pg--;render();});
  document.getElementById('pgNext')?.addEventListener('click',()=>{pg++;render();});
  document.getElementById('shopBtn')?.addEventListener('click',()=>{pg=0;try{document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active',(el.getAttribute('data-tab')||'player')===(window._shopTab||'player')));}catch(_){} setTimeout(render,20);});
  document.getElementById('p1ShopBtn')?.addEventListener('click',()=>{pg=0;try{document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active',(el.getAttribute('data-tab')||'player')===(window._shopTab||'player')));}catch(_){} setTimeout(render,20);});
  document.getElementById('p2ShopBtn')?.addEventListener('click',()=>{pg=0;try{document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active',(el.getAttribute('data-tab')||'player')===(window._shopTab||'player')));}catch(_){} setTimeout(render,20);});
  setTimeout(render,80);
})();
  document.getElementById("shopGrid").addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-action]"); if (!btn) return;
    const action = btn.getAttribute("data-action");
    const costSpan = document.querySelector(`span[data-cost="${action}"]`);
    const cost = parseInt(costSpan.textContent,10);
    let _shopDidMsg = false;
    const _shopPop = (good)=>{
      try{
        btn.animate([
          { transform:'scale(1)', filter:'brightness(1)' },
          { transform: good?'scale(1.05)':'scale(0.98)', filter: good?'brightness(1.25)':'brightness(0.85)' },
          { transform:'scale(1)', filter:'brightness(1)' }
        ], { duration: 220, easing: 'cubic-bezier(0.22,1,0.36,1)' });
      }catch(_){}
    };
    const shopOk = (msg)=>{
      _shopDidMsg = true;
      try{ (window._profSndBuy||window.__profSndBuy||null)?.(); }catch(_){}
      try{ (window._profSkinToast||window.__profSkinToast||null)?.(msg, false); }catch(_){}
      _shopPop(true);
    };
    const shopErr = (msg)=>{
      _shopDidMsg = true;
      try{ (window._profSkinToast||window.__profSkinToast||null)?.(msg, true); }catch(_){}
      try{ window._gameBeep(180,0.09,'sawtooth',0.07); }catch(_){}
      _shopPop(false);
    };
    // Deduct cost from the appropriate player in coop
    if (state.coop){
      let pts = 0;
      if (state.activeShopPlayer === 1){ pts = (state.score1||0); if (pts < cost){ shopErr("Pontuação insuficiente"); return; } state.score1 = pts - cost; }
      else if (state.activeShopPlayer === 2){ pts = (state.score2||0); if (pts < cost){ shopErr("Pontuação insuficiente"); return; } state.score2 = pts - cost; }
    } else {
      if (state.score < cost){ shopErr("Pontuação insuficiente"); return; }
      state.score -= cost;
    }
    switch(action){
      
      case "dynamite":
        if (state.dynaLevel < 4){
          if (state.dynaLevel === -1){
            state.dynaLevel = 0;
            armDynamitesImmediate();
            shopOk("Dinamites armadas!");
          } else {
            state.dynaLevel += 1;
            shopOk("Dinamites melhoradas!");
          }
          const nextCost = Math.round((cost + 75) / 5) * 5;
          if (state.dynaLevel >= 4){
            // Máximo atingido: trava compra
            const btn = document.querySelector('button[data-action="dynamite"]');
            if (btn){ btn.disabled = true; btn.textContent = "Máx."; }
            const span = document.querySelector('span[data-cost="dynamite"]');
            if (span) span.textContent = "—";
          } else {
            const span = document.querySelector('span[data-cost="dynamite"]');
            if (span) span.textContent = String(nextCost);
          }
        }
        break;
case "fastfire":
        {
          if (state.coop){
            if (state.activeShopPlayer === 1){
              if (state.shotCooldownMs <= 300){ if(state.score1!=null)state.score1+=cost;else state.score+=cost; shopErr("Recarregamento já no mínimo! (0.30s)"); break; }
              state.shotCooldownMs = Math.max(300, Math.round(state.shotCooldownMs * 0.85));
            } else {
              const _cd2 = (typeof state.shotCooldownMs2==="number"?state.shotCooldownMs2:state.shotCooldownMs);
              if (_cd2 <= 300){ if(state.score2!=null)state.score2+=cost;else state.score+=cost; shopErr("Recarregamento já no mínimo! (0.30s)"); break; }
              state.shotCooldownMs2 = Math.max(300, Math.round(_cd2 * 0.85));
            }
          } else {
            if (state.shotCooldownMs <= 300){ state.score+=cost; shopErr("Recarregamento já no mínimo! (0.30s)"); break; }
            state.shotCooldownMs = Math.max(300, Math.round(state.shotCooldownMs * 0.85));
          }
          costSpan.textContent = String(Math.round((cost + 50) / 5) * 5);
          // Verificar se chegou ao mínimo
          const _cdNow = state.coop&&state.activeShopPlayer===2
            ? (state.shotCooldownMs2||state.shotCooldownMs)
            : state.shotCooldownMs;
          if (_cdNow <= 300){
            const _ffBtn=document.querySelector('button[data-action="fastfire"]');
            const _ffSpan=document.querySelector('span[data-cost="fastfire"]');
            if(_ffBtn){ _ffBtn.disabled=true; _ffBtn.textContent='Máx.'; }
            if(_ffSpan) _ffSpan.textContent='—';
          }
          shopOk("Cooldown reduzido! ("+(_cdNow/1000).toFixed(2)+"s)");
        }
        break;

      case "explosive":
        {
          const _expLvl = state.explosiveLevel || 0;
          if (_expLvl >= 3){ state.score += cost; shopErr("Tiro Explosivo já no máximo!"); break; }
          state.explosiveLevel = _expLvl + 1;
          const _expCosts = [240, 390, 550];
          const _expChances = [10, 15, 20];
          // Próximo custo
          if (state.explosiveLevel < 3){
            const _eBtn=document.querySelector('button[data-action="explosive"]');
            const _eSpan=document.querySelector('span[data-cost="explosive"]');
            if(_eBtn&&_eSpan) _eSpan.textContent=String(_expCosts[state.explosiveLevel]);
          } else {
            const _eBtn=document.querySelector('button[data-action="explosive"]');
            const _eSpan=document.querySelector('span[data-cost="explosive"]');
            if(_eBtn){ _eBtn.disabled=true; _eBtn.textContent='Máx.'; }
            if(_eSpan) _eSpan.textContent='—';
          }
          shopOk("Tiro Explosivo Nv."+state.explosiveLevel+"! ("+_expChances[_expLvl]+"% de chance)");
        }
        break;

      case "aimassist":
        state.aimLevel = state.aimLevel || 0;
        if (state.aimLevel >= 3){
          shopOk("Mira aprimorada no máximo!");
          break;
        }
        state.aimLevel += 1;
        // reduz cooldown (stack) - mantém um limite mínimo
        state.shotCooldownMs = Math.max(240, Math.round(state.shotCooldownMs * 0.90));
        shopOk("Mira aprimorada! (Nível " + state.aimLevel + ")");
        // aumenta custo para a próxima (caro mesmo)
        costSpan.textContent = String(Math.round((cost + 200) / 5) * 5);
        refreshShopVisibility();
        break;
      
      case "roll":
        if (state.coop){
          // Determine the current cost from the span (which is set to the active player's cost)
          let curCost = parseInt(costSpan.textContent,10);
          if (state.activeShopPlayer === 1){
            state.rollLevel = state.rollLevel || 0;
            if (state.rollLevel >= 3){
              shopOk("Rolamento no máximo!");
              break;
            }
            state.rollLevel += 1;
            state.rollCooldownMs = 2000;
            shopOk("Rolamento! (Nível " + state.rollLevel + ")");
            // Increase cost only for player 1
            state.rollCost1 = Math.round((curCost + 200) / 5) * 5;
          } else {
            state.rollLevel2 = state.rollLevel2 || 0;
            if (state.rollLevel2 >= 3){
              shopOk("Rolamento no máximo!");
              break;
            }
            state.rollLevel2 += 1;
            state.rollCooldownMs2 = 2000;
            shopOk("Rolamento! (Nível " + state.rollLevel2 + ")");
            // Increase cost only for player 2
            state.rollCost2 = Math.round((curCost + 200) / 5) * 5;
          }
        } else {
          state.rollLevel = state.rollLevel || 0;
          if (state.rollLevel >= 3){
            shopOk("Rolamento no máximo!");
            break;
          }
          state.rollLevel += 1;
          state.rollCooldownMs = 2000;
          shopOk("Rolamento! (Nível " + state.rollLevel + ")");
          costSpan.textContent = String(Math.round((cost + 200) / 5) * 5);
        }
        // Update cost display for coop based on new values
        if (state.coop){
          const spanRoll = document.querySelector('span[data-cost="roll"]');
          if (spanRoll){
            spanRoll.textContent = String(state.activeShopPlayer === 1 ? state.rollCost1 : state.rollCost2);
          }
        }
        refreshShopVisibility();
        break;

case "secondchance":
        if(state.secondChance){if(state.coop){if(state.activeShopPlayer===1)state.score1=(state.score1||0)+cost;else state.score2=(state.score2||0)+cost;}else state.score+=cost;shopOk("Segunda Chance já ativa!");break;}
        state.secondChance=true;shopOk("Segunda Chance ativada!");
        {const _sb=document.getElementById('btn-secondchance');if(_sb){_sb.disabled=true;_sb.textContent="Adquirido";}const _ss=document.querySelector('span[data-cost="secondchance"]');if(_ss)_ss.textContent="—";}
        break;

case "pierce":
        if (state.coop){
          if (state.activeShopPlayer === 1){
            state.bulletPierce += 1;
          } else {
            state.bulletPierce2 = (state.bulletPierce2 || 0) + 1;
          }
        } else {
          state.bulletPierce += 1;
        }
        costSpan.textContent = String(Math.round((cost + 75) / 5) * 5);
        shopOk("+1 penetração!");
        break;
      case "ricochete": {
        const _rMax = 4;
        let _rCount;
        if (state.coop){
          if (state.activeShopPlayer === 1){
            state.bulletBounce = (state.bulletBounce || 0) + 1;
            _rCount = state.bulletBounce;
          } else {
            state.bulletBounce2 = (state.bulletBounce2 || 0) + 1;
            _rCount = state.bulletBounce2;
          }
        } else {
          state.bulletBounce = (state.bulletBounce || 0) + 1;
          _rCount = state.bulletBounce;
        }
        shopOk("Balas quicam " + _rCount + "x!");
        if (_rCount >= _rMax){
          const _rBtn = document.querySelector('button[data-action="ricochete"]');
          const _rSpan = document.querySelector('span[data-cost="ricochete"]');
          if (_rBtn){ _rBtn.disabled = true; _rBtn.textContent = "Máx."; }
          if (_rSpan){ _rSpan.textContent = "—"; }
        } else {
          costSpan.textContent = String(Math.round((cost + 60) / 5) * 5);
        }
        break;
      }

      case "bulletspd":
        if ((state.bulletSpdLevel||0) >= 5){
          if(state.coop){if(state.activeShopPlayer===1)state.score1=(state.score1||0)+cost;else state.score2=(state.score2||0)+cost;}else state.score+=cost;
          shopErr("Velocidade no máximo!"); break;
        }
        state.bulletSpdLevel = (state.bulletSpdLevel||0) + 1;
        if (state.coop){
          if (state.activeShopPlayer === 1){
            state.bulletSpeed = Math.round(state.bulletSpeed * 1.20);
          } else {
            state.bulletSpeed2 = Math.round((state.bulletSpeed2 || state.bulletSpeed) * 1.20);
          }
        } else {
          state.bulletSpeed = Math.round(state.bulletSpeed * 1.20);
        }
        if ((state.bulletSpdLevel||0) >= 5){ btn.disabled = true; btn.textContent = "Máx."; costSpan.textContent = "—"; }
        else { costSpan.textContent = String(Math.round((cost + 60) / 5) * 5); }
        shopOk("Projéteis mais rápidos!");
        break;
      case "heal":
        {
          const ghp = state.gold.hp|0;
          const gmax = state.gold.max|0;
          if (ghp >= gmax){
            if (state.coop){
              if (state.activeShopPlayer === 1) state.score1 = (state.score1||0) + cost;
              else state.score2 = (state.score2||0) + cost;
            } else state.score += cost;
            shopErr("A vida do ouro está cheia!");
            break;
          }
          const before = state.gold.hp|0;
          state.gold.hp = Math.min(state.gold.max, (state.gold.hp|0) + 20);
          const gained = (state.gold.hp|0) - before;
          // Cost stays fixed at 200 - do not update costSpan
          shopOk("+20 vida do ouro!");
          if (gained > 0){
            try{
              spawnHealFX(state.gold.x, state.gold.y);
              const px = state.gold.x * TILE + TILE / 2;
              const py = state.gold.y * TILE - 10;
              pushMultiPopup(`+${gained} VIDA`, "#4fe36a", px, py);
              beep(784, 0.06, "triangle", 0.05);
              beep(988, 0.05, "triangle", 0.04);
              const gbar = document.getElementById("goldHPBar");
              if (gbar){
                gbar.classList.remove("healPulse");
                void gbar.offsetWidth;
                gbar.classList.add("healPulse");
                setTimeout(() => {
                  try{ gbar.classList.remove("healPulse"); }catch(_){}
                }, 560);
              }
            }catch(e){}
          }
          try{ updateHUD(); }catch(e){}
        }
        break;
      case "movespd":
        {
          const _mTgt = state.coop
            ? (state.activeShopPlayer===1 ? state.player : state.player2)
            : state.player;
          _mTgt.moveSpdCount = (_mTgt.moveSpdCount||0);
          if (_mTgt.moveSpdCount >= 3){
            if(state.coop){ if(state.activeShopPlayer===1) state.score1=(state.score1||0)+cost; else state.score2=(state.score2||0)+cost; }
            else { state.score += cost; }
            shopErr("Polir Botas já está no máximo! (3/3)");
            break;
          }
          _mTgt.moveSpdCount++;
          _mTgt.moveLockMs = Math.max(30, Math.round(_mTgt.moveLockMs * 0.85));
          costSpan.textContent = String(Math.round((cost + 60) / 5) * 5);
          if (_mTgt.moveSpdCount >= 3){
            const _mvBtn=document.querySelector('button[data-action="movespd"]');
            const _mvSpan=document.querySelector('span[data-cost="movespd"]');
            if (_mvBtn){ _mvBtn.disabled=true; _mvBtn.textContent='Máx.'; }
            if (_mvSpan) _mvSpan.textContent='—';
          }
          shopOk("Você ficou mais ágil! ("+_mTgt.moveSpdCount+"/3)");
        }
        break;
      /* ammo removed */ break;
      case "firstaid":
        {
          let _faTgt = null;
          if (state.coop){
            _faTgt = state.activeShopPlayer === 1 ? state.player : state.player2;
          } else {
            _faTgt = state.player;
          }
          if (!_faTgt || (_faTgt.hp|0) >= (_faTgt.max|0)){
            if (state.coop){
              if (state.activeShopPlayer === 1) state.score1 = (state.score1||0) + cost;
              else state.score2 = (state.score2||0) + cost;
            } else state.score += cost;
            shopErr("A vida do cowboy está cheia!");
            break;
          }
          // Heal the appropriate cowboy by 30 when purchasing first aid.  Apply
          // the same animation and sound feedback used when a boss awards
          // bonus health.  Determine the target player in coop based on
          // activeShopPlayer and compute the amount actually healed.
          let before = 0;
          let gained = 0;
          let px = 0;
          let py = 0;
          let barEl = null;
          if (state.coop){
            if (state.activeShopPlayer === 1){
              before = state.player.hp|0;
              state.player.hp = Math.min(state.player.max, (state.player.hp|0) + 30);
              gained = (state.player.hp|0) - before;
              px = state.player.x * TILE + TILE / 2;
              py = state.player.y * TILE - 10;
              barEl = p1HPBarEl;
            } else {
              before = state.player2.hp|0;
              state.player2.hp = Math.min(state.player2.max, (state.player2.hp|0) + 30);
              gained = (state.player2.hp|0) - before;
              px = state.player2.x * TILE + TILE / 2;
              py = state.player2.y * TILE - 10;
              barEl = p2HPBarEl;
            }
          } else {
            before = state.player.hp|0;
            state.player.hp = Math.min(state.player.max, (state.player.hp|0) + 30);
            gained = (state.player.hp|0) - before;
            px = state.player.x * TILE + TILE / 2;
            py = state.player.y * TILE - 10;
            barEl = playerHPBar;
          }
          shopOk("Primeiros Socorros: +30 vida do Cowboy!");
          // Cost stays fixed at 350 - do not update costSpan
          if (gained > 0){
            try{
              // Spawn heal particles at the healed cowboy's position
              if (state.coop){
                const tx = (state.activeShopPlayer === 1 ? state.player.x : state.player2.x);
                const ty = (state.activeShopPlayer === 1 ? state.player.y : state.player2.y);
                spawnHealFX(tx, ty);
              } else {
                spawnHealFX(state.player.x, state.player.y);
              }
              // Show a popup indicating the amount healed
              pushMultiPopup(`+${gained} VIDA`, "#4fe36a", px, py);
              // Play healing sounds
              beep(784, 0.06, "triangle", 0.05);
              beep(988, 0.05, "triangle", 0.04);
              // Trigger heal pulse on the relevant HP bar
              if (barEl){
                barEl.classList.remove("healPulse");
                void barEl.offsetWidth;
                barEl.classList.add("healPulse");
                setTimeout(() => {
                  try{ barEl.classList.remove("healPulse"); }catch(_){}
                }, 560);
              }
            }catch(e){}
          }
          try{ updateHUD(); }catch(e){}
        }
        break;
      case "sentry":
        if(!state.sentries)state.sentries=[];
        if(state.sentries.length>=4){shopOk("Torres no máximo!");if(state.coop){if(state.activeShopPlayer===1)state.score1=(state.score1||0)+cost;else state.score2=(state.score2||0)+cost;}else state.score+=cost;break;}
        state._sentryRefund=cost;
        setTimeout(()=>{state.placingSentry=true;state.sentryHoverX=-1;state.sentryHoverY=-1;state.pausedManual=true;const _h=document.getElementById('sentryPlaceHint');if(_h)_h.style.display='block';try{pauseBtn.textContent='Despausar';}catch(_){}},80);
        closeShop.click();
        costSpan.textContent="300"; break;

      case "clearpath":
        {
          state._clearpathCount = state._clearpathCount || 0;
          if(state._clearpathCount >= 4){shopErr("Abrir Caminho já no máximo!");if(state.coop){if(state.activeShopPlayer===1)state.score1=(state.score1||0)+cost;else state.score2=(state.score2||0)+cost;}else state.score+=cost;break;}
          // Som igual a destruir torreta
          try{ beep(320,0.07,'sawtooth',0.07); setTimeout(()=>beep(210,0.06,'sawtooth',0.06),75); setTimeout(()=>beep(130,0.08,'sawtooth',0.05),170); }catch(_){}
          state._clearPathRefund=cost;
          setTimeout(()=>{
            state.placingClearPath=true;
            state.sentryHoverX=-1; state.sentryHoverY=-1;
            state.pausedManual=true;
            const _h=document.getElementById('clearPathHint');
            if(_h)_h.style.display='block';
            try{pauseBtn.textContent='Despausar';}catch(_){}
          },80);
          closeShop.click();
        }
        break;

      case "goldmine":
        {
          if(!state.goldMines)state.goldMines=[];
          if(state.goldMines.length>=4){shopOk("Minas de Ouro no máximo!");if(state.coop){if(state.activeShopPlayer===1)state.score1=(state.score1||0)+cost;else state.score2=(state.score2||0)+cost;}else state.score+=cost;break;}
          state._goldMineRefund=cost;
          setTimeout(()=>{
            state.placingGoldMine=true;
            state.sentryHoverX=-1; state.sentryHoverY=-1;
            state.pausedManual=true;
            const _h=document.getElementById('goldMinePlaceHint');
            if(_h)_h.style.display='block';
            try{pauseBtn.textContent='Despausar';}catch(_){}
          },80);
          closeShop.click();
        }
        break;

      case "espantalho":
        if(!state.espantalhos)state.espantalhos=[];
        if(state.espantalhos.length>=2){shopErr("Espantalhos no máximo!");if(state.coop){if(state.activeShopPlayer===1)state.score1=(state.score1||0)+cost;else state.score2=(state.score2||0)+cost;}else state.score+=cost;break;}
        state._espantalhoRefund=cost; // guardado para ESC devolver
        setTimeout(()=>{state.placingEspantalho=true;state.espantalhoHoverX=-1;state.espantalhoHoverY=-1;state.pausedManual=true;const _h=document.getElementById('espantalhoPlaceHint');if(_h)_h.style.display='block';try{pauseBtn.textContent='Despausar';}catch(_){}},80);
        closeShop.click();
        break;
      case "pichapoco":
        {
          if(!state.pichaPocos)state.pichaPocos=[];
          if(state.pichaPocos.length>=PICHA_POCO_MAX){shopOk("Poças no máximo!");if(state.coop){if(state.activeShopPlayer===1)state.score1=(state.score1||0)+cost;else state.score2=(state.score2||0)+cost;}else state.score+=cost;break;}
          state._pichaPocoRefund=cost;
          setTimeout(()=>{
            state.placingPichaPoco=true;
            state.pichaPocoHoverX=-1; state.pichaPocoHoverY=-1;
            state.pausedManual=true;
            const _h=document.getElementById('pichaPocoPlaceHint');
            if(_h)_h.style.display='block';
            try{pauseBtn.textContent='Despausar';}catch(_){}
          },80);
          closeShop.click();
        }
        break;

      case "barricada":
        {
          if(!state.barricadas)state.barricadas=[];
          if(state.barricadas.length>=8){shopOk("Barricadas no máximo!");if(state.coop){if(state.activeShopPlayer===1)state.score1=(state.score1||0)+cost;else state.score2=(state.score2||0)+cost;}else state.score+=cost;break;}
          state._barricadaRefund=cost;
          setTimeout(()=>{
            state.placingBarricada=true;
            state.barricadaHoverX=-1; state.barricadaHoverY=-1;
            state.pausedManual=true;
            const _h=document.getElementById('barricadaPlaceHint');
            if(_h)_h.style.display='block';
            try{pauseBtn.textContent='Despausar';}catch(_){}
          },80);
          closeShop.click();
        }
        break;

      case "portal":
        {
          if(state.portals){shopOk('Portais já posicionados! Destrua-os primeiro.');if(state.coop){if(state.activeShopPlayer===1)state.score1=(state.score1||0)+cost;else state.score2=(state.score2||0)+cost;}else state.score+=cost;break;}
          state._portalRefund=cost;
          setTimeout(()=>{
            state.placingPortalBlue=true;
            state.placingPortalOrange=false;
            state.portalHoverX=-1; state.portalHoverY=-1;
            state.pausedManual=true;
            const _hb=document.getElementById('portalBlueHint');
            if(_hb)_hb.style.display='block';
            const _ho=document.getElementById('portalOrangeHint');
            if(_ho)_ho.style.display='none';
            try{pauseBtn.textContent='Despausar';}catch(_){}
          },80);
          closeShop.click();
        }
        break;

      case "sentryup":
        // Improve turret fire rate in order (top→right→bottom→left)
        if (!state._sentryUpCount) state._sentryUpCount = 0;
        const upi = Math.min(state._sentryUpCount, 3);
        state.sentryFireMs[upi] = Math.max(SENTRY_FIRE_CD_MIN_AFTER_SHOP_UP, Math.floor(state.sentryFireMs[upi] * 0.85));
        state._sentryUpCount++;
        shopOk("Torre aprimorada: " + ["cima","direita","baixo","esquerda"][upi]);
        refreshShopVisibility();
        costSpan.textContent = String(Math.round((cost + 100) / 5) * 5);
        break;
      // Enforce MAX state if reached
      (function(){
        const btn = document.querySelector('button[data-action="sentryup"]');
        const span = document.querySelector('span[data-cost="sentryup"]');
        if ((state._sentryUpCount||0) >= 4){
          if (btn){ btn.disabled = true; btn.textContent = "Máx."; }
          if (span){ span.textContent = "—"; }
        }
      })();

      case "saraivada":
        state.saraivadaLevel = state.saraivadaLevel || 0;
        if (state.saraivadaLevel >= 4){ shopOk("Saraivada no máximo!"); break; }
        state.saraivadaLevel += 1;
        costSpan.textContent = String(Math.round((cost + 250) / 5) * 5);
        shopOk("Saraivada! (Nível " + state.saraivadaLevel + ") — tecla Q");
        refreshShopVisibility();
        break;

      case "ally":
        {
          const r = applyAllyUpgradeCore();
          if (r.err === 'max'){
            if(state.coop){ if(state.activeShopPlayer===1)state.score1+=cost; else state.score2+=cost; } else state.score+=cost;
            shopErr("Parceiro já no máximo!");
            break;
          }
          syncAllyShopCardUI();
          const _allyLvlNow = state.allyLevel||1;
          if(_allyLvlNow===1){ shopOk("Parceiro chegou à cidade!"); }
          else { shopOk("Parceiro Nv."+_allyLvlNow+"!"); }
        }
        break;

      case "balatranslucida":
        {
          if(state.balaTranslucida){
            // refund — already bought
            if(state.coop){ if(state.activeShopPlayer===1)state.score1+=cost; else state.score2+=cost; } else state.score+=cost;
            shopErr("Já adquirido!");
            break;
          }
          state.balaTranslucida = true;
          btn.disabled = true; btn.textContent = "Adquirido";
          costSpan.textContent = "—";
          shopOk("Bala Translúcida!");
        }
        break;

      case "dog":
        {
          state.dogLevel = state.dogLevel || 0;
          if (state.dogLevel >= 5){
            if (state.coop){ if (state.activeShopPlayer === 1) state.score1 += cost; else if (state.activeShopPlayer === 2) state.score2 += cost; } else { state.score += cost; }
            shopErr("Cachorro já no máximo!"); break;
          }
          state.dogLevel += 1;
          if (!getDog()){
            state._pendingDogDialog = true; state._pendingDogDialogAfterShop = true;
            spawnDog();
            try{ const _d=getDog(); if(_d) _d.hidden=true; }catch(_){ }
          }
          setDogLevel(state.dogLevel);
          const costs = [375, 500, 650, 820, 1000];
          if (state.dogLevel >= 5){ btn.disabled = true; btn.textContent = "Máx."; costSpan.textContent = "—"; }
          else { costSpan.textContent = String(costs[state.dogLevel]); btn.disabled = false; btn.textContent = "Comprar"; }
          shopOk("Cachorro Nv."+state.dogLevel+"!");
          refreshShopVisibility();
        }
        break;

      case "xerife":
        {
          const XERIFE_MAX = 5;
          state.xerifeLevel = state.xerifeLevel || 0;
          if(state.xerifeLevel >= XERIFE_MAX){
            if(state.coop){ if(state.activeShopPlayer===1)state.score1+=cost; else state.score2+=cost; }else state.score+=cost;
            shopErr("Xerife já no máximo!"); break;
          }
          state.xerifeLevel += 1;
          if(!getXerife()){
            state._pendingXerifeDialog = true; state._pendingXerifeDialogAfterShop = true;
            spawnXerife();
            try{ const _xr=getXerife(); if(_xr) _xr.hidden=true; }catch(_){}
          } else {
            // Sobe o nível do xerife existente
            const _xr=getXerife(); if(_xr) _xr.level=state.xerifeLevel;
          }
          // Custos progressivos: 425, 560, 700, 860, 1050
          const xCosts=[425,560,700,860,1050];
          if(state.xerifeLevel>=XERIFE_MAX){ btn.disabled=true; btn.textContent="Máx."; costSpan.textContent="—"; }
          else { costSpan.textContent=String(xCosts[state.xerifeLevel]); btn.disabled=false; btn.textContent="Comprar"; }
          if(state.xerifeLevel===1){ shopOk("Xerife chegou à cidade!"); }
          else { shopOk("Xerife Nv."+state.xerifeLevel+"!"); }
          refreshShopVisibility();
        }
        break;

      case "dinamiteiro":
        {
          const DM_MAX=4;
          state.dinamiteiroLevel=state.dinamiteiroLevel||0;
          if(state.dinamiteiroLevel>=DM_MAX){
            if(state.coop){if(state.activeShopPlayer===1)state.score1+=cost;else state.score2+=cost;}else state.score+=cost;
            shopErr("Dinamiteiro já no máximo!"); break;
          }
          state.dinamiteiroLevel+=1;
          if(!getDinamiteiro()){ spawnDinamiteiro(); }
          const _dm=getDinamiteiro(); if(_dm) _dm.level=state.dinamiteiroLevel;
          const dmCosts=[1125,1375,1690,2065];
          if(state.dinamiteiroLevel>=DM_MAX){ btn.disabled=true; btn.textContent="Máx."; costSpan.textContent="—"; }
          else{ costSpan.textContent=String(dmCosts[state.dinamiteiroLevel]); btn.disabled=false; btn.textContent="Comprar"; }
          if(state.dinamiteiroLevel===1){ shopOk("Dinamiteiro chegou!"); state._pendingDinamiteiroDialog=true; state._pendingDinamiteiroDialogAfterShop=true; }
          else shopOk("Dinamiteiro Nv."+state.dinamiteiroLevel+"!");
          refreshShopVisibility();
        }
        break;

      case "reparador":
        {
          const RP_MAX=5;
          state.reparadorLevel=state.reparadorLevel||0;
          if(state.reparadorLevel>=RP_MAX){
            if(state.coop){ if(state.activeShopPlayer===1) state.score1+=cost; else state.score2+=cost; } else { state.score+=cost; }
            shopErr("Reparador já no máximo!"); break;
          }
          state.reparadorLevel+=1;
          if(!getReparador()) spawnReparador();
          setReparadorLevel(state.reparadorLevel);
          const rpCosts=[800,1060,1400,1800,2250];
          if(state.reparadorLevel>=RP_MAX){ btn.disabled=true; btn.textContent="Máx."; costSpan.textContent="—"; }
          else { costSpan.textContent=String(rpCosts[state.reparadorLevel]); btn.disabled=false; btn.textContent="Comprar"; }
          if(state.reparadorLevel===1){
            shopOk("Reparador chegou!");
            state._pendingReparadorDialog = true;
            state._pendingReparadorDialogAfterShop = true;
          }
          else shopOk("Reparador Nv."+state.reparadorLevel+"!");
          refreshShopVisibility();
        }
        break;

    }
    if(!_shopDidMsg){ shopOk("Compra realizada!"); }
    try{ syncShopQtyIndicators(); }catch(_){}
    updateHUD();
  });

  // Pausar
  function togglePause(){ if (dialog && dialog.active) return; state.pausedManual = !state.pausedManual; pauseBtn.textContent = state.pausedManual ? "Despausar" : "Pausar"; }
  
  // === Inimigos (Enciclopédia) ===
  const enemiesModal = document.getElementById("enemiesModal");
  const enemiesList = document.getElementById("enemiesList");
  const closeEnemies = document.getElementById("closeEnemies");
  const enemiesBtn = document.getElementById("enemiesBtn");

  function openEnemies(){
    try{ if (typeof buildEnemiesList==='function') buildEnemiesList(); }catch(_){}
    try{
      enemiesModal.style.display = "flex";
      enemiesModal.setAttribute("aria-hidden","false");
    }catch(_){}
    if (state){ state.pausedManual = true; }

    if (!state) return;
    buildEnemiesList();
    enemiesModal.style.display = "flex";
    enemiesModal.setAttribute("aria-hidden","false");
    state.pausedManual = true;
  }
  function closeEnemiesModal(){
    enemiesModal.style.display = "none";
    enemiesModal.setAttribute("aria-hidden","true");
    state.pausedManual = false;
  }
  if (closeEnemies && !closeEnemies._bound){ closeEnemies._bound = true; closeEnemies.addEventListener("click", closeEnemiesModal); }
  if (enemiesBtn && !enemiesBtn._bound){ enemiesBtn._bound = true; enemiesBtn.addEventListener("click", openEnemies); }

  function drawBanditPreview(g, assassin=false){
    const TILEP = 32;
    g.clearRect(0,0,64,64);
    const px = 16, py = 16;
    if (drawEnemySprite(g, assassin ? 'assassin' : 'bandit', px, py, TILEP)) return;
    // sombra
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px+4, py+TILEP-6, TILEP-8, 5);
    // corpo
    g.fillStyle = assassin ? '#111' : '#4a1f1f'; g.fillRect(px+8, py+8, TILEP-16, TILEP-16);
    // bandana
    g.fillStyle = assassin ? '#5a00cc' : '#b91414'; g.fillRect(px+10, py+18, TILEP-20, 6);
    // olhos
    g.fillStyle = '#eee'; g.fillRect(px+12, py+14, 3,2); g.fillRect(px+TILEP-15, py+14, 3,2);
  }
  function drawBossPreview(g, name){
    // O Pregador
    if(name === "O Pregador"){
      g.fillStyle='#e8e0d0'; g.fillRect(12,22,28,30);
      g.fillStyle='#111'; g.fillRect(10,22,30,4); g.fillRect(14,8,22,15);
      g.fillStyle='#2a1a04'; g.fillRect(14,20,22,2);
      g.fillStyle='#cc1010'; g.fillRect(18,28,4,2); g.fillRect(30,28,4,2);
      g.fillStyle='#8a6030'; g.fillRect(6,6,3,46); g.fillRect(4,6,7,3);
      return;
    }
    if(name === "Pistoleiro Fantasma"){
      g.clearRect(0,0,64,64);
      const px = 16, py = 16, TILEP = 32;
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px+4, py+TILEP-6, TILEP-8, 5);
      g.fillStyle = "#4dd4d4"; g.fillRect(px+8, py+8, TILEP-16, TILEP-16);
      g.fillStyle = "#f4f4f4"; g.fillRect(px+10, py+18, TILEP-20, 6);
      g.fillStyle = "#f4f4f4"; g.fillRect(px+12, py+14, 3,2); g.fillRect(px+TILEP-15, py+14, 3,2);
      return;
    }
    const TILEP = 32;
    g.clearRect(0,0,64,64);
    const px = 16, py = 16;
    // sombra
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px+4, py+TILEP-6, TILEP-8, 5);
    let color = '#6b4b1b';
    switch(name){
      case "Coiote de Ferro": color = "#7b3f00"; break;
      case "Touro Bizarro": color = "#6b4b1b"; break;
      case "Víbora do Deserto": color = "#2f7d32"; break;
  }
  function drawVandalPreview(g){
    const TILEP = 32; const px = 16, py = 16;
    g.clearRect(0,0,64,64);
    if (drawEnemySprite(g, 'vandal', px, py, TILEP)) return;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px+4, py+TILEP-6, TILEP-8, 5);
    g.fillStyle = "#6b4b1b"; g.fillRect(px+8, py+8, TILEP-16, TILEP-16);
    g.fillStyle = "#f1d94c"; g.fillRect(px+12, py+14, 3,2); g.fillRect(px+TILEP-15, py+14, 3,2);
  }

    // reuse the same shapes used in drawBoss
    if (name === "Touro Bizarro"){
      g.fillStyle = color; g.fillRect(px+6, py+8, TILEP-12, TILEP-14);
      g.fillStyle = "#eee"; g.fillRect(px+10, py+12, 3,2); g.fillRect(px+TILEP-15, py+12, 3,2);
      g.fillStyle = "#bfb8a6"; g.fillRect(px+8, py+6, 4,3); g.fillRect(px+TILEP-12, py+6, 4,3);
    } else if (name === "Coiote de Ferro"){
      g.fillStyle = color; g.fillRect(px+8, py+10, TILEP-16, TILEP-12);
      g.fillRect(px+TILEP/2-3, py+6, 6,4);
      g.fillStyle = "#eee"; g.fillRect(px+12, py+12, 3,2); g.fillRect(px+TILEP-15, py+12, 3,2);
    } else { // Víbora do Deserto (default)
      g.fillStyle = color; g.fillRect(px+8, py+10, TILEP-16, TILEP-10);
      g.beginPath(); g.moveTo(px+TILEP-10, py+10); g.lineTo(px+TILEP-4, py+16); g.lineTo(px+TILEP-10, py+20); g.closePath(); g.fill();
      g.fillStyle = "#eee"; g.fillRect(px+12, py+12, 3,2); g.fillRect(px+TILEP-15, py+12, 3,2);
    }
  }

  function enemyDescription(key){
    switch(key){
      case 'bandit': return 'Vai no ouro. Morre com 1 tiro.';
      case 'assassin': return 'Vai no cowboy. Corre mais. 2 tiros pra cair.';
      case 'vandal': return 'Vai nas torres e desarma dinamites. Morre com 1 tiro.';
      case 'fantasma': return 'Atravessa tudo. Invisível para aliados. 3 tiros com Bala Translúcida.';
      default: return 'Chefe poderoso.';
    }
  }

  function buildEnemiesList(){
    enemiesList.innerHTML = '';
    const seen = state.seen || {bandit:false, assassin:false, vandal:false, bosses:{}};
    const items = [];

    if (seen.bandit) items.push({kind:'bandit', name:'Bandido'});
    if (seen.assassin) items.push({kind:'assassin', name:'Assassino'});
    if (seen.vandal) items.push({kind:'vandal', name:'Vândalo'});
    if (seen.fantasma) items.push({kind:'fantasma', name:'Fantasma'});
    const bossNames = Object.keys(seen.bosses||{}).filter(k => !!seen.bosses[k]);
    for (const bn of bossNames){ items.push({kind:'boss', name:bn}); }

    items.forEach(it => {
      const card = document.createElement('div');
      card.className = 'enemycard';
      const c = document.createElement('canvas'); c.width=64; c.height=64;
      const g = c.getContext('2d');
      if (it.kind==='bandit') drawBanditPreview(g, false);
      else if (it.kind==='assassin') drawBanditPreview(g, true);
      else if (it.kind==='vandal') drawVandalPreview(g);
      else drawBossPreview(g, it.name);
      const info = document.createElement('div');
      info.className = 'enemyinfo';
      const title = document.createElement('div'); title.className='enemyname'; title.textContent = it.name;
      const desc = document.createElement('div'); desc.className='enemydesc';
      desc.textContent = (it.kind==='boss') ? (it.name==='O Pregador'?'Invoca bandidos periodicamente. Aura de lentidão nos tiros.':(it.name==='Pistoleiro Fantasma'?'Atira à distância, rajada em três direções e teletransporte ao levar tiro.':'Boss.')) : enemyDescription(it.kind);
      info.appendChild(title); info.appendChild(desc);
      card.appendChild(c); card.appendChild(info);
      enemiesList.appendChild(card);
    });
    // Update discovered counter
    const total = 8;
    const discovered = items.length;
    const cnt = document.getElementById("enemiesCount");
    if (cnt) cnt.textContent = `Descobertos: ${discovered}/${total}`;
  }

  pauseBtn.addEventListener("click", togglePause);

  function getNextReparadorUpgradeCost(){
    const RP_MAX = 5;
    const lvl = state.reparadorLevel | 0;
    if (lvl >= RP_MAX) return null;
    return [800, 1060, 1400, 1800, 2250][lvl];
  }
  function applyReparadorUpgradeFromMapMenu(){
    const RP_MAX = 5;
    const lvl = state.reparadorLevel | 0;
    if (lvl >= RP_MAX) return { ok: false, err: 'max' };
    const rpCosts = [800, 1060, 1400, 1800, 2250];
    const cost = rpCosts[lvl];
    const getPts = () => (state.coop
      ? (state.activeShopPlayer === 1 ? (state.score1 | 0) : (state.score2 | 0))
      : (state.score | 0));
    const setPts = (v) => {
      if (state.coop){
        if (state.activeShopPlayer === 1) state.score1 = v;
        else state.score2 = v;
      } else state.score = v;
    };
    const pts = getPts();
    if (pts < cost) return { ok: false, err: 'nomoney' };
    setPts(pts - cost);
    state.reparadorLevel = lvl + 1;
    if (!getReparador()) spawnReparador();
    else setReparadorLevel(state.reparadorLevel);
    if (state.reparadorLevel === 1) state._pendingReparadorDialog = true;
    try{ refreshShopVisibility(); }catch(_){}
    return { ok: true };
  }
  function applyReparadorInstantUnlockFromMapMenu(){
    if (state.reparadorInstantUnlocked) return { ok: false, err: 'owned' };
    const getPts = () => (state.coop
      ? (state.activeShopPlayer === 1 ? (state.score1 | 0) : (state.score2 | 0))
      : (state.score | 0));
    const setPts = (v) => {
      if (state.coop){
        if (state.activeShopPlayer === 1) state.score1 = v;
        else state.score2 = v;
      } else state.score = v;
    };
    const pts = getPts();
    if (pts < REPARADOR_INSTANT_UNLOCK_COST) return { ok: false, err: 'nomoney' };
    setPts(pts - REPARADOR_INSTANT_UNLOCK_COST);
    state.reparadorInstantUnlocked = true;
    const r = getReparador();
    if (r){
      r._repairsForInstant = 0;
      r._instantRepairReady = false;
      r._repairMs = 0;
    }
    try{ refreshShopVisibility(); }catch(_){}
    return { ok: true };
  }

  // Expor para outros scripts (menu de torre, etc.)
  window._G = {
    get state(){ return state; },
    beep, toastMsg, updateHUD,
    get addScore(){ return addScore; },
    refreshShopVisibility,
    PARTNER_IR_VISION_COST,
    REPARADOR_INSTANT_UNLOCK_COST,
    getNextReparadorUpgradeCost,
    applyReparadorUpgradeFromMapMenu,
    applyReparadorInstantUnlockFromMapMenu,
    getNextAllyUpgradeCost(){
      const ALLY_MAX_LEVEL = 10;
      const lvl = state.allyLevel|0;
      const p = getPartner();
      if (!p) return 275;
      if (lvl >= ALLY_MAX_LEVEL) return null;
      let c = 275;
      for (let i = 1; i < lvl; i++) c = Math.round((c + 100) / 5) * 5;
      return Math.round((c + 100) / 5) * 5;
    },
    applyAllyUpgradeCore,
    syncAllyShopCardUI,
    playPartnerIrVisionPurchaseSfx,
    spawnPartnerIrVisionPurchaseFX
  };
  // Start
  resetGame();
  state.running = false; state.inMenu = true; musicStop(); showMenu();
  try{const _sb=document.getElementById('btn-secondchance');if(_sb){_sb.disabled=false;_sb.textContent='Comprar';}const _ss=document.querySelector('span[data-cost="secondchance"]');if(_ss)_ss.textContent='1000';}catch(_){}
  // Aplicar skin salva
  try{ if(window._expSystem){ var _ra=window._expSystem.acctLoad(); state.currentSkin=_ra.equippedSkin||0; state.equippedAura=(_ra.equippedAura!=null?_ra.equippedAura:-1); state.equippedShot=(_ra.equippedShot!=null?_ra.equippedShot:-1); state.equippedGold=(_ra.equippedGold!=null?_ra.equippedGold:-1); state.equippedKill=(_ra.equippedKill!=null?_ra.equippedKill:-1); state.equippedName=(_ra.equippedName!=null?_ra.equippedName:0); if(state.unlockedSkins){(_ra.skins||[0]).forEach(function(i){state.unlockedSkins.add(i);});} } }catch(_){}
  renderCosmetics();

  // Expor uma API mínima para o sistema de resultados (fora deste IIFE)
  // poder reiniciar/voltar ao menu sem depender de variáveis locais.
  try{
    window.__defendaApi = window.__defendaApi || {};
    window.__defendaApi.getState = () => state;
    window.__defendaApi.resetGame = () => resetGame();
    window.__defendaApi.resetGameCoop = () => (typeof resetGameCoop === 'function' ? resetGameCoop() : resetGame());
    window.__defendaApi.showMenu = () => showMenu();
    window.__defendaApi.musicStop = () => musicStop();
    window.__defendaApi.musicStart = () => musicStart();
  }catch(_e){}

  requestAnimationFrame(loop);
})();

function spawnTowerBreakFX(tx, ty){
  const T = window.TILE || 32;
  const cx = tx * T + T/2, cy = ty * T + T/2;
  const cnt = 24 + Math.floor(Math.random()*10);
  for (let i=0;i<cnt;i++){
    const ang = Math.random()*Math.PI*2;
    const spd = 120 + Math.random()*120;
    const life = 0.35 + Math.random()*0.25;
    state.fx.push({ x:cx, y:cy, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd-30, life, max:life,
      color: (i%3===0? "#6f4e37" : (i%3===1? "#2a2a2a" : "#c97a2b")), size: 2 + (Math.random()<0.25?1:0), grav:300 });
  }
}

function quickShake(px, ms){
  try {
    const c = document.querySelector('canvas'); if (!c) return;
    const origin = c.style.transform || ""; const start = performance.now();
    function step(){
      const p = Math.min(1, (performance.now()-start)/ms); const amp = px*(1-p);
      const dx = (Math.random()*2-1)*amp, dy = (Math.random()*2-1)*amp;
      c.style.transform = `translate(${dx}px, ${dy}px)`;
      if (p < 1) requestAnimationFrame(step); else c.style.transform = origin;
    }
    requestAnimationFrame(step);
  } catch(_){}
}

// ═══════════════════════════════════════════════════════════════════
//  SISTEMA DE EXP & OURO DA CONTA
// ═══════════════════════════════════════════════════════════════════
//  SISTEMA DE CONTA: EXP, OURO, PERFIL, SKINS
// ═══════════════════════════════════════════════════════════════════
(function(){
  var _nativeStore = window.__defendaNativeStore || null;
  var _acctCache = null;
  function _cloneData(v){ try{ return JSON.parse(JSON.stringify(v)); }catch(_){ return v; } }
  function _uniqueInts(list, fallback){
    var src = Array.isArray(list) ? list : fallback;
    var out = [];
    for (var i = 0; i < src.length; i++){
      var num = Number(src[i]);
      if (!Number.isFinite(num)) continue;
      var int = num | 0;
      if (out.indexOf(int) < 0) out.push(int);
    }
    return out.length ? out : _cloneData(fallback);
  }
  function _normalizeAccountData(raw){
    var data = (raw && typeof raw === 'object') ? _cloneData(raw) : {};
    var out = {
      level: 1,
      exp: 0,
      coins: 0,
      skins: [0],
      equippedSkin: 0,
      name: '',
      ownedAuras: [],
      equippedAura: -1,
      ownedShots: [],
      equippedShot: -1,
      ownedGolds: [],
      equippedGold: -1,
      ownedKills: [],
      equippedKill: 0,
      ownedNames: [0],
      equippedName: 0
    };
    out.level = Math.max(1, Number.isFinite(Number(data.level)) ? (Number(data.level) | 0) : 1);
    out.exp = Math.max(0, Math.round(Number(data.exp) || 0));
    out.coins = Math.max(0, Math.round(Number(data.coins) || 0));
    out.skins = _uniqueInts(data.skins, [0]).filter(function(x){ return x !== 9; });
    if (out.skins.indexOf(0) < 0) out.skins.unshift(0);
    out.equippedSkin = Number.isFinite(Number(data.equippedSkin)) ? (Number(data.equippedSkin) | 0) : 0;
    if (out.skins.indexOf(out.equippedSkin) < 0) out.equippedSkin = 0;
    out.name = typeof data.name === 'string' ? data.name : '';
    out.ownedAuras = _uniqueInts(data.ownedAuras, []).filter(function(x){ return x !== 9 && x !== 13; });
    out.equippedAura = Number.isFinite(Number(data.equippedAura)) ? (Number(data.equippedAura) | 0) : -1;
    if (out.equippedAura === 9 || out.equippedAura === 13 || out.ownedAuras.indexOf(out.equippedAura) < 0) out.equippedAura = -1;
    out.ownedShots = _uniqueInts(data.ownedShots, []);
    out.equippedShot = Number.isFinite(Number(data.equippedShot)) ? (Number(data.equippedShot) | 0) : -1;
    out.ownedGolds = _uniqueInts(data.ownedGolds, []);
    out.equippedGold = Number.isFinite(Number(data.equippedGold)) ? (Number(data.equippedGold) | 0) : -1;
    out.ownedKills = _uniqueInts(data.ownedKills, []).filter(function(x){ return x !== 16; });
    out.equippedKill = Number.isFinite(Number(data.equippedKill)) ? (Number(data.equippedKill) | 0) : 0;
    if (out.equippedKill === -1 || out.equippedKill === 16) out.equippedKill = 0;
    out.ownedNames = _uniqueInts(data.ownedNames, [0]).filter(function(x){ return x !== 3 && x !== 11 && x !== 14 && x !== 15 && x !== 16 && x !== 17 && x !== 19 && x !== 24 && x !== 25 && x !== 26 && x !== 27 && x !== 28 && x !== 29 && x !== 30 && x !== 31 && x !== 32 && x !== 33 && x !== 34 && x !== 35 && x !== 36 && x !== 37 && x !== 38 && x !== 39 && x !== 40 && x !== 41 && x !== 42 && x !== 43 && x !== 44 && x !== 45 && x !== 46 && x !== 47 && x !== 48 && x !== 49 && x !== 51 && x !== 52 && x !== 53 && x !== 54 && x !== 55 && x !== 56 && x !== 57 && x !== 58; });
    if (out.ownedNames.indexOf(0) < 0) out.ownedNames.unshift(0);
    out.equippedName = Number.isFinite(Number(data.equippedName)) ? (Number(data.equippedName) | 0) : 0;
    if (out.equippedName === 3 || out.equippedName === 11 || out.equippedName === 14 || out.equippedName === 15 || out.equippedName === 16 || out.equippedName === 17 || out.equippedName === 19 || out.equippedName === 24 || out.equippedName === 25 || out.equippedName === 26 || out.equippedName === 27 || out.equippedName === 28 || out.equippedName === 29 || out.equippedName === 30 || out.equippedName === 31 || out.equippedName === 32 || out.equippedName === 33 || out.equippedName === 34 || out.equippedName === 35 || out.equippedName === 36 || out.equippedName === 37 || out.equippedName === 38 || out.equippedName === 39 || out.equippedName === 40 || out.equippedName === 41 || out.equippedName === 42 || out.equippedName === 43 || out.equippedName === 44 || out.equippedName === 45 || out.equippedName === 46 || out.equippedName === 47 || out.equippedName === 48 || out.equippedName === 49 || out.equippedName === 51 || out.equippedName === 52 || out.equippedName === 53 || out.equippedName === 54 || out.equippedName === 55 || out.equippedName === 56 || out.equippedName === 57 || out.equippedName === 58 || out.ownedNames.indexOf(out.equippedName) < 0) out.equippedName = 0;
    return out;
  }

  function expNeeded(lvl){
    var raw = 100 * Math.pow(1.30, lvl - 1);
    if(raw < 1000) return Math.ceil(raw / 10) * 10;
    var digits = Math.floor(Math.log10(raw)) + 1;
    var step = digits >= 10
      ? 5 * Math.pow(10, digits - 2)
      : 5 * Math.pow(10, Math.max(0, digits - 3));
    return Math.ceil(raw / step) * step;
  }
  function fmtExpNum(v){ return Math.round(Math.max(0, Number(v)||0)).toLocaleString('pt-BR'); }
  function calcExp(waves){ return Math.max(5, 15 + waves*14 + (waves>=8?Math.round((waves-7)*waves*1.4):0)); }
  function calcCoins(waves, score){ return Math.max(1, Math.round(waves*3 + (score||0)/350)); }

  function acctLoad(){
    try{
      if(!_acctCache){
        var loaded = (_nativeStore && _nativeStore.loadAccount) ? _nativeStore.loadAccount() : null;
        _acctCache = _normalizeAccountData(loaded);
      }
      return _cloneData(_acctCache);
    }catch(e){}
    return _normalizeAccountData(null);
  }
  function acctSave(a){
    try{
      _acctCache = _normalizeAccountData(a);
      if(_nativeStore && _nativeStore.saveAccount){
        _acctCache = _normalizeAccountData(_nativeStore.saveAccount(_acctCache));
      }
      return _cloneData(_acctCache);
    }catch(e){}
    return acctLoad();
  }

  function refreshMenu(){
    var a=acctLoad(), needed=expNeeded(a.level), pct=Math.min(100,a.exp/needed*100).toFixed(1), e;
    e=document.getElementById('profLevelLabel'); if(e) e.textContent='Nível '+a.level;
    e=document.getElementById('profCoinsLabel'); if(e) e.textContent=a.coins.toLocaleString('pt-BR')+' Ouro';
    e=document.getElementById('storeCoinsValue'); if(e) e.textContent=a.coins.toLocaleString('pt-BR')+' Ouro';
    e=document.getElementById('profExpFill');    if(e){ e.style.width=pct+'%'; if(pct>0 && pct<2) e.style.width='2%'; }
    e=document.getElementById('profExpLabel');   if(e) e.textContent=fmtExpNum(a.exp)+' / '+fmtExpNum(needed)+' EXP';
    e=document.getElementById('profileNameInput'); if(e && document.activeElement!==e) e.value=a.name||'';
    renderProfileSkins();
    if(_isCosmeticStoreOpen()) renderCosmeticStore();
  }

  var _gorLocked=false;
  var _gorAnimToken=0, _gorAnimRafs=[], _gorAnimTimers=[];
  function _gorClearTracked(list, cancelFn){
    while(list.length){
      try{ cancelFn(list.pop()); }catch(_){}
    }
  }
  function _gorCancelPendingAnims(){
    _gorAnimToken++;
    _gorClearTracked(_gorAnimRafs, cancelAnimationFrame);
    _gorClearTracked(_gorAnimTimers, clearTimeout);
  }
  function _gorTrackRaf(token, fn){
    var id=requestAnimationFrame(function(now){
      var idx=_gorAnimRafs.indexOf(id); if(idx>=0) _gorAnimRafs.splice(idx,1);
      if(token!==_gorAnimToken) return;
      fn(now);
    });
    _gorAnimRafs.push(id);
    return id;
  }
  function _gorTrackTimeout(token, fn, ms){
    var id=setTimeout(function(){
      var idx=_gorAnimTimers.indexOf(id); if(idx>=0) _gorAnimTimers.splice(idx,1);
      if(token!==_gorAnimToken) return;
      fn();
    }, ms);
    _gorAnimTimers.push(id);
    return id;
  }
  function gorSetLocked(v){
    _gorLocked=!!v;
    ['gorContinueBtn','gorMenuBtn','gorSecondChanceBtn'].forEach(function(id){
      var b=document.getElementById(id); if(!b) return;
      b.disabled=!!v;
      try{ b.setAttribute('aria-disabled', v?'true':'false'); }catch(_){ }
      b.style.pointerEvents=v?'none':'auto';
      b.style.filter=v?'grayscale(1) brightness(0.45)':'';
      b.style.cursor=v?'not-allowed':'';
      if(!v){
        b.style.transition='opacity 0.25s ease, filter 0.25s ease';
        b.style.opacity='1';
        b.style.filter='';
        b.style.cursor='';
        if(id==='gorSecondChanceBtn'){
          try{ _gorUpdateChanceBtn(); }catch(_){ b.style.opacity='1'; }
        }
      } else {
        b.style.transition='';
        b.style.opacity='0.38';
      }
    });
  }

  function gorHide(){
    _gorCancelPendingAnims();
    var p=document.getElementById('gameOverResults'); if(p) p.classList.remove('gor-visible');
    gorSetLocked(false);
    try{ document.body.removeAttribute('data-results-open'); }catch(_){ }
    try{
      ['shopBtn','menuBackBtn','pauseBtn','enemiesBtn','ingameOptBtn','p1ShopBtn','p2ShopBtn'].forEach(function(id){
        var b=document.getElementById(id);
        if(b){
          b.disabled=false;
          try{ b.removeAttribute('aria-disabled'); }catch(_){ }
          b.style.opacity='';
          b.style.pointerEvents='';
          b.style.filter='';
        }
      });
    }catch(_){ }
  }

  function sndTick(pct){ try{ window._gameBeep(380+pct*5.5,0.065,'sine',0.055); }catch(e){} }
  function sndLevelUp(token){
    try{ window._gameBeep(523,0.16,'triangle',0.09); }catch(e){}
    _gorTrackTimeout(token, function(){ try{ window._gameBeep(659,0.16,'triangle',0.10); }catch(e){}},110);
    _gorTrackTimeout(token, function(){ try{ window._gameBeep(784,0.18,'triangle',0.11); }catch(e){}},220);
    _gorTrackTimeout(token, function(){ try{ window._gameBeep(1047,0.30,'triangle',0.13); }catch(e){}},350);
  }
  function sndCoin(){ try{ window._gameBeep(680+Math.random()*160,0.055,'sine',0.042); }catch(e){} }

  function animateCoins(target, token){
    var el=document.getElementById('gorCoinsText');
    if(!el){ if(token===_gorAnimToken) gorSetLocked(false); return; }
    var DUR=1500,t0=performance.now(),lastTick=-999;
    (function frame(now){
      if(token!==_gorAnimToken) return;
      var p=Math.min(1,(now-t0)/DUR), cur=Math.round((1-Math.pow(1-p,3))*target);
      el.textContent='+ '+cur.toLocaleString('pt-BR')+' Ouro ganho';
      if(now-lastTick>115&&cur>0){ lastTick=now; sndCoin(); }
      if(p<1){ _gorTrackRaf(token, frame); }
      else if(token===_gorAnimToken){ el.textContent='+ '+target.toLocaleString('pt-BR')+' Ouro ganho'; gorSetLocked(false); }
    })(performance.now());
  }

  function animateBar(preLevel, preExp, expToAdd, coinsGained, token){
    var curLvl=preLevel, curExp=preExp, rem=expToAdd;
    function segment(fromPct,toPct,dur,done){
      var t0=performance.now(),lastSnd=-999;
      (function frame(now){
        if(token!==_gorAnimToken) return;
        var p=Math.min(1,(now-t0)/dur), ease=p<0.5?2*p*p:-1+(4-2*p)*p, pct=fromPct+(toPct-fromPct)*ease;
        var fill=document.getElementById('gorExpBarFill'), lbl=document.getElementById('gorExpBarLabel');
        if(fill) fill.style.width=pct.toFixed(2)+'%';
        if(lbl){ var needed=expNeeded(curLvl), disp=Math.round(curExp+(pct-fromPct)/(Math.max(0.01,toPct-fromPct))*(toPct/100*needed-curExp)); lbl.textContent=fmtExpNum(Math.max(0,Math.min(needed,disp)))+' / '+fmtExpNum(needed); }
        if(now-lastSnd>=90&&p<0.97){ lastSnd=now; sndTick(pct); }
        if(p<1) _gorTrackRaf(token, frame); else if(token===_gorAnimToken) done();
      })(performance.now());
    }
    function step(){
      if(token!==_gorAnimToken) return;
      var needed=expNeeded(curLvl), space=needed-curExp;
      if(rem<=space){
        var dur=Math.max(500,Math.round(rem/Math.max(1,expToAdd)*1600)+350);
        segment(curExp/needed*100,(curExp+rem)/needed*100,dur,function(){
          if(token!==_gorAnimToken) return;
          var lbl=document.getElementById('gorExpBarLabel'); if(lbl) lbl.textContent=fmtExpNum(curExp+rem)+' / '+fmtExpNum(needed);
          _gorTrackTimeout(token, function(){ animateCoins(coinsGained, token); },350);
        });
      } else {
        var dur2=Math.max(350,Math.round(space/Math.max(1,expToAdd)*1600)+150);
        segment(curExp/needed*100,100,dur2,function(){
          _gorTrackTimeout(token, function(){
            if(token!==_gorAnimToken) return;
            curLvl++; rem-=space; curExp=0;
            var e;
            e=document.getElementById('gorExpLevelLabel'); if(e) e.textContent='Nível '+curLvl;
            e=document.getElementById('gorExpBarFill');    if(e) e.style.width='0%';
            e=document.getElementById('gorExpBarLabel');   if(e) e.textContent='0 / '+fmtExpNum(expNeeded(curLvl));
            var banner=document.getElementById('gorLevelUpBanner');
            if(banner){ banner.style.display='block'; banner.style.animation='none'; void banner.offsetWidth; banner.style.animation='levelPop 0.4s cubic-bezier(0.22,1,0.36,1)'; }
            sndLevelUp(token);
            _gorTrackTimeout(token, step,560);
          },220);
        });
      }
    }
    step();
  }

  function animateStatCount(el, from, to, dur, formatFn, tickEveryMs, tickFn, token){
    if(!el){ return new Promise(function(res){res();}); }
    from = Number(from)||0; to = Number(to)||0; dur = Math.max(120, dur||600);
    var t0 = performance.now(), lastTick = -9999;
    return new Promise(function(resolve){
      (function frame(now){
        if(token!==_gorAnimToken){ resolve(); return; }
        var p = Math.min(1, (now - t0) / dur);
        var e = 1 - Math.pow(1 - p, 3);
        var cur = Math.round(from + (to - from) * e);
        el.textContent = formatFn ? formatFn(cur) : String(cur);
        if(tickFn && (now - lastTick) >= (tickEveryMs||85) && cur !== from && p < 0.999){
          lastTick = now;
          try{ tickFn(cur, to); }catch(_){}
        }
        if(p < 1) _gorTrackRaf(token, frame);
        else { el.textContent = formatFn ? formatFn(to) : String(to); resolve(); }
      })(performance.now());
    });
  }

  function animateResultsPrelude(waves, score, expG, preL, token){
    function $(id){ return document.getElementById(id); }
    var elW = $('gorStatWaves');
    var elS = $('gorStatScore');
    var elE = $('gorStatExp');
    var elGain = $('gorExpGainLabel');

    if(elW) elW.textContent = '0';
    if(elS) elS.textContent = '0';
    if(elE) elE.textContent = '+0';
    if(elGain) elGain.textContent = '+0 EXP';

    function tickCounter(cur, to){
      var pct = to>0 ? (cur/to) : 0;
      try{ window._gameBeep(520 + pct*220 + (Math.random()*40-20), 0.045, 'sine', 0.045); }catch(_){ }
    }

    return animateStatCount(elW, 0, waves, 900, function(v){ return String(v); }, 105, function(){ tickCounter(1,1); }, token)
      .then(function(){
        if(token!==_gorAnimToken) return;
        return animateStatCount(elS, 0, score, 1050, function(v){ return v.toLocaleString('pt-BR'); }, 95, function(cur,to){
          if(to <= 2500 || (cur % Math.ceil(to/50) === 0)) tickCounter(cur,to);
        }, token);
      })
      .then(function(){
        if(token!==_gorAnimToken) return;
        return animateStatCount(elE, 0, expG, 950, function(v){ return '+'+fmtExpNum(v); }, 90, function(cur,to){
          tickCounter(cur,to);
          if(elGain) elGain.textContent = '+'+fmtExpNum(cur)+' EXP';
        }, token).then(function(){
          if(elGain) elGain.textContent = '+'+fmtExpNum(expG)+' EXP';
        });
      });
  }

  function showResults(gs, reason){
    if(gs && gs._gorResultsShown) return;
    if(gs) gs._gorResultsShown = true;
    _gorCancelPendingAnims();
    var token=_gorAnimToken;
    var waves=Math.max(0,(gs.wave||1)-1);
    var score=gs.coop
      ? Math.max(0,(gs.totalScore1||0) + (gs.totalScore2||0))
      : Math.max(0, gs.totalScore!=null ? gs.totalScore : (gs.score||0));
    var coinBaseWaves=Math.max(0,gs.accountCoinsRewardWaveBase||0), coinBaseScore=Math.max(0,gs.accountCoinsRewardScoreBase||0);
    var rewardWaves=Math.max(0,waves-coinBaseWaves), rewardScore=Math.max(0,score-coinBaseScore);
    var expG=calcExp(waves), coinsG=((rewardWaves>0||rewardScore>0)?calcCoins(rewardWaves,rewardScore):0);
    var acc=acctLoad(), preL=acc.level, preE=acc.exp;
    acc.exp+=expG; acc.coins+=coinsG;
    while(acc.exp>=expNeeded(acc.level)){ acc.exp-=expNeeded(acc.level); acc.level++; }
    acctSave(acc);
    var reasons={gold:'o ouro foi roubado',player:'cowboy abatido',both:'ambos caíram'};
    function set(id,v){ var e=document.getElementById(id); if(e) e.textContent=v; }
    set('gorSubtitle',reasons[reason]||'fim de jogo');
    set('gorStatWaves','0'); set('gorStatScore','0'); set('gorStatExp','+0');
    set('gorExpLevelLabel','Nível '+preL); set('gorExpGainLabel','+'+fmtExpNum(expG)+' EXP'); set('gorCoinsText','+ 0 Ouro ganho');
    var banner=document.getElementById('gorLevelUpBanner'); if(banner) banner.style.display='none';
    var n0=expNeeded(preL), p0=(preE/n0*100).toFixed(1);
    var fill0=document.getElementById('gorExpBarFill'); if(fill0){ fill0.style.transition='none'; fill0.style.width=p0+'%'; }
    set('gorExpBarLabel',fmtExpNum(preE)+' / '+fmtExpNum(n0));
    var panel=document.getElementById('gameOverResults'); if(panel) panel.classList.add('gor-visible');
    try{ document.body.setAttribute('data-results-open','1'); }catch(_){ }
    try{
      ['shopBtn','menuBackBtn','pauseBtn','enemiesBtn','ingameOptBtn','p1ShopBtn','p2ShopBtn'].forEach(function(id){
        var b=document.getElementById(id);
        if(b){ b.disabled=true; try{b.setAttribute('aria-disabled','true');}catch(_){ }
          try{ b.style.pointerEvents='none'; }catch(_){ }
          b.style.opacity='0.35'; b.style.filter='grayscale(1)';
        }
      });
    }catch(_){ }

    gorSetLocked(true);
    _gorTrackTimeout(token, function(){
      animateResultsPrelude(waves, score, expG, preL, token).then(function(){
        if(token!==_gorAnimToken) return;
        animateBar(preL,preE,expG,coinsG, token);
      });
    }, 220);
  }

  // PROFILE SKINS — mesmo índice que SKINS[] do jogo
  var PROFILE_SKINS=[
    // idx 0–11: originais
    {name:'Clássico',         body:'#3c6ca8',hat:'#4d2f0a',cost:0},
    {name:'Desbravador',      body:'#7a3c3c',hat:'#2b1b0a',cost:120},
    {name:'Noite Fria',       body:'#2f3a5f',hat:'#1a1a1a',cost:140},
    {name:'Pôr-do-Sol',       body:'#c85028',hat:'#5a2a0a',cost:160},
    {name:'Duna',             body:'#a67c52',hat:'#4d2f0a',cost:150},
    {name:'Cacique',          body:'#2f7d32',hat:'#52310c',cost:180},
    {name:'Cobalto',          body:'#224d9b',hat:'#0e2a52',cost:180},
    {name:'Carvoeiro',        body:'#333333',hat:'#111111',cost:200},
    {name:'Rosa do Deserto',  body:'#e36db2',hat:'#8a2a5b',cost:190},
    null, // idx 9 removido
    {name:'Bandidão',         body:'#4a1f1f',hat:'#1e0c0c',cost:260},
    {name:'Espectral',        body:'#6b4bbd',hat:'#2a0d4a',cost:300},
    // idx 12+: novos
    {name:'Âmbar',            body:'#f0c060',hat:'#7a4a10',cost:210},
    {name:'Giz',              body:'#e8e8e8',hat:'#c0c0c0',cost:230},
    {name:'Musgo',            body:'#6b8c5a',hat:'#2a3a1a',cost:235},
    {name:'Marfim',           body:'#f0ead8',hat:'#b89a6a',cost:290},
    {name:'Fantasma',         body:'#f0f0f0',hat:'#111111',cost:320},
    {name:'Obsidiana',        body:'#1a1a2e',hat:'#0d0d18',cost:620},
    {name:'Guarda',           body:'#3a3a5a',hat:'#c02020',cost:370},
    {name:'Menta',            body:'#a8d8b8',hat:'#4a8a5a',cost:360},
    {name:'Lavanda',          body:'#c4aee8',hat:'#6a4a9a',cost:380},
    {name:'Pêssego',          body:'#f0b898',hat:'#a05830',cost:400},
    {name:'Vaqueiro Claro',   body:'#e8d8b8',hat:'#8b1a1a',cost:430},
    {name:'Céu Claro',        body:'#b0d4f0',hat:'#4878a8',cost:420},
    {name:'Quartzo',          body:'#ecc8d8',hat:'#a04870',cost:480},
    {name:'Duque',            body:'#d8d8f0',hat:'#404080',cost:445},
    {name:'Ferrugem',         body:'#c06040',hat:'#501808',cost:490},
    {name:'Pistola de Prata', body:'#c8c8d8',hat:'#484858',cost:520},
  ];


  // ═══════════════════════════════════════════════════════════════
  // AURAS — sistema completo
  // ═══════════════════════════════════════════════════════════════

  var AURAS = [
    // Página 0 — especial
    {id:-1, name:'Nenhuma',    cost:0,    icon:'✖'},
    // Página 1 — sutis (300–550)
    {id:0,  name:'Brasa',      cost:300,  icon:'🔥'},
    {id:1,  name:'Névoa',      cost:340,  icon:'🌫'},
    {id:2,  name:'Folhas',     cost:380,  icon:'🍂'},
    {id:3,  name:'Faíscas',    cost:420,  icon:'⚡'},
    {id:4,  name:'Pó Dourado', cost:460,  icon:'✨'},
    {id:5,  name:'Gelo',       cost:500,  icon:'❄'},
    // Página 2 — criativas (550–880)
    {id:18, name:'Angelical',  cost:550,  icon:'😇'},
    {id:6,  name:'Chuva',      cost:560,  icon:'🌧'},
    {id:7,  name:'Sombra',     cost:620,  icon:'👤'},
    {id:8,  name:'Sangue',     cost:680,  icon:'🩸'},
    {id:10, name:'Veneno',     cost:820,  icon:'☣'},
    // Página 3 — premium intensas (880–1650)
    {id:11, name:'Aurora',     cost:880,  icon:'🌌'},
    {id:12, name:'Vulcão',     cost:960,  icon:'🌋'},
    {id:14, name:'Fantasma',   cost:1160, icon:'👻'},
    {id:15, name:'Galáxia',    cost:1300, icon:'🌠'},
    {id:16, name:'Dragão',     cost:1480, icon:'🐉'},
    {id:17, name:'Abismo',     cost:1650, icon:'🕳'},
  ];
  var AURAS_PER_PAGE = 6;
  var _auraPage = 0;

  // ═══════════════════════════════════════════════════════════════
  // NOMES DECORATIVOS — ordenado por custo após definir
  // ═══════════════════════════════════════════════════════════════
  var DECORATIVE_NAMES = [
    { id: 0,  name: 'Padrão',          cost: 0,    cssClass: '' },
    { id: 1,  name: 'Ouro Velho',      cost: 260,  cssClass: 'dn-s1' },
    { id: 2,  name: 'Neon',            cost: 320,  cssClass: 'dn-s2' },
    { id: 4,  name: 'Chamas',          cost: 360,  cssClass: 'dn-s4' },
    { id: 5,  name: 'Gélido',          cost: 600,  cssClass: 'dn-s5' },
    { id: 6,  name: 'Arco-íris',       cost: 520,  cssClass: 'dn-s6' },
    { id: 8,  name: 'Carmesim',        cost: 300,  cssClass: 'dn-s8' },
    { id: 9,  name: 'Trovão',          cost: 440,  cssClass: 'dn-s9' },
    { id: 10, name: 'Abismo',          cost: 480,  cssClass: 'dn-s10' },
    { id: 12, name: 'Entardecer',      cost: 380,  cssClass: 'dn-s12' },
    { id: 13, name: 'Matriz',          cost: 350,  cssClass: 'dn-s13' },
    { id: 18, name: 'Magnata',         cost: 720,  cssClass: 'dn-s18' },
    { id: 20, name: 'Relíquia',        cost: 1080, cssClass: 'dn-s20' },
    { id: 21, name: 'Nebulosa',        cost: 1320, cssClass: 'dn-s21' },
    { id: 22, name: 'Soberano',        cost: 1680, cssClass: 'dn-s22' },
    { id: 50, name: 'Corvo',           cost: 1040, cssClass: 'dn-s50' },
  ];
  DECORATIVE_NAMES.sort(function(a, b){ return (a.cost - b.cost) || (a.id - b.id); });
  window._decorNameCssById = {};
  for (var _dni = 0; _dni < DECORATIVE_NAMES.length; _dni++){
    var _de = DECORATIVE_NAMES[_dni];
    window._decorNameCssById[_de.id] = _de.cssClass || '';
  }
  var NAMES_PER_PAGE = 6;
  var _namePage = 0;

  function _profDecorPreviewLabel(){
    var a = acctLoad();
    var n = (a && a.name) ? String(a.name).trim() : '';
    return n || 'Cowboy';
  }

  function renderProfileNames(){
    var grid = document.getElementById('profNamesGrid');
    if (!grid) return;
    grid.innerHTML = '';
    var acc = acctLoad(), owned = new Set(acc.ownedNames || [0]);
    if (!owned.has(0)) owned.add(0);
    var eq = (acc.equippedName != null) ? acc.equippedName : 0;
    var previewLabel = _profDecorPreviewLabel();
    var catalog = _getCosmeticCatalogEntries('names', true, acc);
    var totalPages = Math.max(1, Math.ceil(catalog.length / NAMES_PER_PAGE));
    if (_namePage >= totalPages) _namePage = Math.max(0, totalPages - 1);
    var start = _namePage * NAMES_PER_PAGE, end = Math.min(start + NAMES_PER_PAGE, catalog.length);
    for (var i = start; i < end; i++){
      (function(item){
        var entry = item.data;
        var isOwned = owned.has(entry.id), isEq = (eq === entry.id);
        var card = document.createElement('div');
        card.className = 'prof-name-card' + (isEq ? ' equipped' : '');
        var prev = document.createElement('div');
        prev.className = 'prof-name-preview';
        var prevTxt = document.createElement('span');
        prevTxt.className = 'prof-name-preview-text' + (entry.cssClass ? ' ' + entry.cssClass : '');
        prevTxt.textContent = previewLabel;
        prev.appendChild(prevTxt);
        var nm = document.createElement('div');
        nm.className = 'name-style-label';
        nm.textContent = entry.name;
        var btn = document.createElement('button');
        btn.className = 'name-style-btn';
        if (isEq){
          btn.textContent = 'Equipado';
          btn.disabled = true;
          btn.className = 'name-style-btn btn-equipped';
        } else if (isOwned){
          btn.textContent = 'Equipar';
          btn.className = 'name-style-btn btn-equip';
          btn.onclick = function(e){ e.stopPropagation(); _equipName(entry.id); };
        } else {
          btn.textContent = entry.cost + ' Ouro';
          btn.className = 'name-style-btn btn-buy';
          btn.onclick = function(e){ e.stopPropagation(); _buyName(entry.id); };
        }
        card.appendChild(prev);
        card.appendChild(nm);
        card.appendChild(btn);
        grid.appendChild(card);
      })(catalog[i]);
    }
    for (var fi = end - start; fi < NAMES_PER_PAGE; fi++){
      var ph = document.createElement('div');
      ph.style.visibility = 'hidden';
      grid.appendChild(ph);
    }
    var lbl = document.getElementById('profNamePgLabel');
    if (lbl) lbl.textContent = (_namePage + 1) + ' / ' + totalPages;
    var pp = document.getElementById('profNamePgPrev');
    if (pp) pp.disabled = (_namePage === 0);
    var pn = document.getElementById('profNamePgNext');
    if (pn) pn.disabled = (_namePage >= totalPages - 1);
  }

  window._profChangeNamePage = function(d){
    var tp = Math.max(1, Math.ceil(_getCosmeticCatalogEntries('names', true).length / NAMES_PER_PAGE));
    _namePage = Math.max(0, Math.min(tp - 1, _namePage + d));
    renderProfileNames();
  };

  function _findDecorEntry(id){
    for (var i = 0; i < DECORATIVE_NAMES.length; i++){
      if (DECORATIVE_NAMES[i].id === id) return DECORATIVE_NAMES[i];
    }
    return null;
  }

  function _buyName(id){
    if (id === 0){ _equipName(0); return; }
    var ent = _findDecorEntry(id);
    if (!ent) return;
    var acc = acctLoad();
    if (!acc.ownedNames) acc.ownedNames = [0];
    if (acc.ownedNames.indexOf(id) >= 0){ _equipName(id); return; }
    if (acc.coins < ent.cost){
      _profSkinToast('Ouro insuficiente', true);
      try{ window._gameBeep(180, 0.09, 'sawtooth', 0.07); }catch(_){}
      return;
    }
    acc.coins -= ent.cost;
    if (!acc.ownedNames) acc.ownedNames = [0];
    if (!acc.ownedNames.includes(id)) acc.ownedNames.push(id);
    acc.equippedName = id;
    acctSave(acc);
    if (typeof state !== 'undefined' && state) state.equippedName = id;
    _profSndBuy();
    _profSkinToast('Estilo desbloqueado e equipado!', false);
    refreshMenu();
    renderProfileNames();
    _refreshCosmeticStoreIfOpen();
  }

  function _equipName(id){
    var acc = acctLoad();
    if (!acc.ownedNames) acc.ownedNames = [0];
    if (id !== 0 && acc.ownedNames.indexOf(id) < 0) return;
    acc.equippedName = id;
    acctSave(acc);
    if (typeof state !== 'undefined' && state) state.equippedName = id;
    _profSndEquip();
    _profSkinToast('Estilo equipado!', false);
    renderProfileNames();
    _refreshCosmeticStoreIfOpen();
  }

  function _profOpenNames(){
    var ps = document.getElementById('profileScreen');
    var home = document.getElementById('profShopHome');
    if (ps){
      ps.classList.remove('prof-skins-full');
      ps.classList.remove('prof-auras-full');
      ps.classList.remove('prof-shots-full');
      ps.classList.remove('prof-golds-full');
      ps.classList.remove('prof-kills-full');
      ps.classList.add('prof-names-full');
    }
    if (home) home.style.display = 'none';
    _namePage = 0;
    renderProfileNames();
  }

  // ── Gerador de partículas por aura ────────────────────────────
  // Retorna array de partículas compatíveis com state.fx
  function _spawnAuraParticles(id, cx, cy, t){
    var p = [], r = Math.random;
    switch(id){
      case 0: // Brasa — rastro de fogo canto esquerdo, alguns pixels acima da base
        for(var i=0;i<2;i++){
          var _bx=cx-8+(r()-0.5)*4, _by=cy+2+r()*4;
          p.push({x:_bx,y:_by,vx:-8-r()*12,vy:-4-r()*8,life:0.4,max:0.4,color:r()<0.5?'#ff6020':'#ff9040',size:1.5+r()*1.5,grav:0});
        }
        break;
      case 1: // Névoa — nuvens brancas suaves, sobem
        p.push({x:cx+(r()-0.5)*14,y:cy+4+(r()-0.5)*6,vx:(r()-0.5)*4,vy:-14-r()*6,life:0.9,max:0.9,color:r()<0.5?'#c8d8e8':'#e0e8f0',size:3+r()*1.5,grav:0});
        break;
      case 2: // Folhas — verdes que giram e caem
        p.push({x:cx+(r()-0.5)*20,y:cy-4+r()*14,vx:(r()-0.5)*16,vy:-4+r()*10,life:0.85,max:0.85,color:r()<0.4?'#2aaa30':r()<0.7?'#40cc40':'#1a8020',size:2+r()*1.5,grav:50});
        break;
      case 3: // Faíscas elétricas azuis — rápidas e nítidas
        for(var i=0;i<2;i++){
          var a2=r()*Math.PI*2, rd=5+r()*9;
          p.push({x:cx+Math.cos(a2)*rd,y:cy+Math.sin(a2)*rd,vx:(r()-0.5)*24,vy:-22-r()*18,life:0.28,max:0.28,color:r()<0.55?'#60c8ff':'#ffffff',size:1.5+r()*1.5,grav:0});
        }
        break;
      case 4: // Pó Dourado — cintila em arco suave
        var ga=r()*Math.PI*2;
        p.push({x:cx+Math.cos(ga)*(5+r()*9),y:cy+Math.sin(ga)*(5+r()*9),vx:(r()-0.5)*10,vy:-10-r()*8,life:0.65,max:0.65,color:r()<0.55?'#f3d23b':'#ffe880',size:1.5+r()*2,grav:25});
        break;
      case 5: // Gelo — cristais em órbita lenta
        var ia=(t*1.4)*Math.PI*2;
        for(var i=0;i<2;i++){
          var angle=ia+i*Math.PI;
          p.push({x:cx+Math.cos(angle)*13,y:cy+Math.sin(angle)*9,vx:(r()-0.5)*5,vy:-7-r()*4,life:0.55,max:0.55,color:r()<0.5?'#a8daf0':'#dff4ff',size:2+r(),grav:12});
        }
        break;
      case 6: // Chuva — nuvem acima que despeja gotas azuis
        // nuvem branca
        p.push({x:cx+(r()-0.5)*12,y:cy-22,vx:(r()-0.5)*3,vy:0,life:0.5,max:0.5,color:r()<0.5?'#e8eeff':'#ffffff',size:4+r()*2,grav:0});
        // gotas caindo
        for(var i=0;i<2;i++)
          p.push({x:cx+(r()-0.5)*16,y:cy-18+r()*4,vx:(r()-0.5)*3,vy:55+r()*35,life:0.32,max:0.32,color:r()<0.65?'#4090d8':'#80c4ff',size:1.5,grav:140});
        break;
      case 7: // Sombra — fumaça escura, sobe
        p.push({x:cx+(r()-0.5)*14,y:cy+4+(r()-0.5)*6,vx:(r()-0.5)*5,vy:-16-r()*8,life:0.75,max:0.75,color:r()<0.5?'#0a0a12':'#151525',size:4+r()*2,grav:0});
        break;
      case 8: // Sangue — gotas vermelhas escorrem ao redor
        for(var i=0;i<2;i++){
          p.push({x:cx+(r()-0.5)*18,y:cy+(r()-0.5)*12,vx:(r()-0.5)*5,vy:18+r()*22,life:0.55,max:0.55,color:r()<0.6?'#cc0010':'#880008',size:2+r()*1.5,grav:160});
        }
        break;
      case 9: // Arco-Íris — espiral multicolorida
        var cols9=['#ff4040','#ff9020','#f3d23b','#40cc40','#4090ff','#9040ff'];
        var ang9=(t*2.8)*Math.PI*2, rad9=11+r()*4;
        p.push({x:cx+Math.cos(ang9)*rad9,y:cy+Math.sin(ang9)*rad9*0.65,vx:(r()-0.5)*8,vy:-9-r()*6,life:0.5,max:0.5,color:cols9[Math.floor(r()*cols9.length)],size:2.5+r(),grav:22});
        break;
      case 10: // Veneno — bolhas verde-tóxico, sobem
        p.push({x:cx+(r()-0.5)*12,y:cy+4+(r()-0.5)*6,vx:(r()-0.5)*5,vy:-18-r()*8,life:0.7,max:0.7,color:r()<0.5?'#50cc20':'#90ff40',size:2.5+r()*2,grav:0});
        if(r()<0.45) p.push({x:cx+(r()-0.5)*10,y:cy+4+(r()-0.5)*6,vx:(r()-0.5)*3,vy:-12-r()*5,life:0.4,max:0.4,color:'#30aa10',size:3.5+r(),grav:0});
        break;
      case 11: // Aurora — ondas suaves de verde e roxo
        var colsA=['#40ff80','#80ffb0','#8040ff','#c080ff','#20e8a0'];
        var aa=(t*0.9+r()*0.5)*Math.PI*2, ar=13+r()*5;
        p.push({x:cx+Math.cos(aa)*ar,y:cy+Math.sin(aa)*ar*0.5,vx:(r()-0.5)*5,vy:-5-r()*4,life:0.85,max:0.85,color:colsA[Math.floor(r()*colsA.length)],size:3+r(),grav:0});
        break;
      case 12: // Vulcão — lava e cinzas saindo da cabeça do sprite (3px abaixo)
        for(var i=0;i<3;i++){
          var va=-Math.PI/2+(r()-0.5)*1.4, vs=40+r()*55;
          p.push({x:cx+(r()-0.5)*8,y:cy-11,vx:Math.cos(va)*vs,vy:Math.sin(va)*vs-20,life:0.55,max:0.55,color:r()<0.35?'#ff2000':r()<0.65?'#ff7020':'#ffaa00',size:2.5+r()*2.5,grav:160});
        }
        p.push({x:cx+(r()-0.5)*10,y:cy-11,vx:(r()-0.5)*15,vy:-40-r()*30,life:0.6,max:0.6,color:'#444444',size:2+r(),grav:80});
        break;
      case 13: // Tempestade — chuva densa + relâmpagos ocasionais
        for(var i=0;i<3;i++)
          p.push({x:cx+(r()-0.5)*24,y:cy-22+r()*12,vx:(r()-0.5)*5,vy:80+r()*45,life:0.26,max:0.26,color:r()<0.7?'#60a0e0':'#c0d8ff',size:1.5+r()*0.5,grav:130});
        if(r()<0.18) // relâmpago
          p.push({x:cx+(r()-0.5)*18,y:cy-18,vx:0,vy:70,life:0.18,max:0.18,color:'#ffffa0',size:2.5,grav:0});
        break;
      case 14: // Fantasma — almas brancas orbitando devagar
        var fa=(t*0.55+r()*0.5)*Math.PI*2, fr=15+r()*5;
        p.push({x:cx+Math.cos(fa)*fr,y:cy+Math.sin(fa)*fr*0.7-4,vx:(r()-0.5)*4,vy:-7-r()*5,life:1.1,max:1.1,color:r()<0.6?'#d8eeff':'#a0c8ff',size:3.5+r()*1.5,grav:-12});
        break;
      case 15: // Galáxia — estrelas cósmicas + poeira em órbita rápida
        var cols15=['#a060ff','#ff60ff','#60ffff','#ffffa0','#ffffff','#80a0ff'];
        for(var i=0;i<2;i++){
          var sang=(t*3.5+i*Math.PI+r()*0.5), srad=12+r()*8;
          p.push({x:cx+Math.cos(sang)*srad,y:cy+Math.sin(sang)*srad*0.55,vx:(r()-0.5)*6,vy:-8-r()*5,life:0.55,max:0.55,color:cols15[Math.floor(r()*cols15.length)],size:1.5+r()*2,grav:0});
        }
        break;
      case 16: // Dragão — labaredas em redemoinho, multi-cor e intensas
        var cols16=['#ff1000','#ff5000','#ff8010','#ffcc00','#fff040'];
        for(var i=0;i<3;i++){
          var da=(t*4.5+i*Math.PI*2/3), dr=9+r()*8;
          p.push({x:cx+Math.cos(da)*dr,y:cy+Math.sin(da)*dr*0.7,vx:Math.cos(da+Math.PI/2)*22*(0.5+r()),vy:-28-r()*22,life:0.42,max:0.42,color:cols16[Math.floor(r()*cols16.length)],size:2.5+r()*2.5,grav:0});
        }
        // fumaça escura
        p.push({x:cx+(r()-0.5)*14,y:cy+(r()-0.5)*8,vx:(r()-0.5)*10,vy:-18-r()*10,life:0.5,max:0.5,color:'#331100',size:4+r()*2,grav:0});
        break;
      case 17: // Abismo — vórtice escuro com pulsos de energia violeta
        var cols17=['#2000a0','#5000cc','#8820ff','#cc60ff'];
        for(var i=0;i<3;i++){
          var aba=(t*5.5+i*Math.PI*2/3+r()*0.3), abr=11+r()*9;
          p.push({x:cx+Math.cos(aba)*abr,y:cy+Math.sin(aba)*abr*0.6,vx:Math.cos(aba+Math.PI/2)*16*(0.5+r()),vy:-10-r()*10,life:0.6,max:0.6,color:cols17[Math.floor(r()*cols17.length)],size:2.5+r()*2.5,grav:0});
        }
        // núcleo negro pulsante
        p.push({x:cx+(r()-0.5)*6,y:cy+(r()-0.5)*6,vx:0,vy:0,life:0.3,max:0.3,color:'#000000',size:5+r()*2,grav:0});
        if(r()<0.3) p.push({x:cx+(r()-0.5)*22,y:cy+(r()-0.5)*16,vx:0,vy:0,life:0.2,max:0.2,color:'#ff80ff',size:3.5,grav:0});
        break;
      case 18: { // Anjinho — halo dourado fixo acima da cabeça, partículas orbitam sem cair
        // halo centrado ~16px acima do cowboy (cx,cy = centro do sprite)
        var _hy18 = cy - 16;
        var _hr18 = 9; // raio do anel
        // 2 partículas por frame orbitando o anel
        for(var _ai=0;_ai<2;_ai++){
          var _a18 = t*2.6 + _ai*Math.PI + r()*0.5;
          var _px18 = cx + Math.cos(_a18)*(_hr18 + r()*1.5);
          var _py18 = _hy18 + Math.sin(_a18)*2.5; // anel levemente achatado
          // velocidade tangencial pura — sem componente vertical para baixo
          var _vx18 = -Math.sin(_a18) * 14 * (0.6+r()*0.5);
          var _vy18 =  Math.cos(_a18) * 5  * (0.6+r()*0.5); // pequena oscilação vertical
          p.push({x:_px18, y:_py18, vx:_vx18, vy:_vy18,
                  life:0.30+r()*0.15, max:0.45,
                  color: r()<0.55 ? '#ffe040' : (r()<0.7 ? '#fff5a0' : '#ffd020'),
                  size:1.8+r()*1.4, grav:0});
        }
        // fagulhas douradas ocasionais no anel — ficam paradas e somem
        if(r()<0.35){
          var _a18b = r()*Math.PI*2;
          p.push({x:cx+Math.cos(_a18b)*_hr18, y:_hy18+Math.sin(_a18b)*2,
                  vx:(r()-0.5)*2, vy:(r()-0.5)*1,
                  life:0.5, max:0.5, color:'#ffffff', size:1.2+r()*0.8, grav:0});
        }
        break;
      }
    }
    return p;
  }

  window._spawnAuraParticles = _spawnAuraParticles;

  // ══════════════════════════════════════════════════════════
  // SHOT EFFECTS — definição, preview e lógica de compra/equip
  // ══════════════════════════════════════════════════════════
  var SHOT_EFFECTS = [
    // Página 1
    {id:-1, name:'Padrão',       cost:0,    desc:'Tiro simples'},
    {id:0,  name:'Fagulha',      cost:250,  desc:'Centelhas caindo para baixo'},
    {id:1,  name:'Congelante',   cost:300,  desc:'Cristais que flutuam e somem'},
    {id:2,  name:'Elétrico',     cost:350,  desc:'Arcos que pulsam para os lados'},
    {id:3,  name:'Ácido',        cost:380,  desc:'Gotas que sobem em espiral'},
    {id:4,  name:'Espectral',    cost:420,  desc:'Rastro que abre e fecha como onda'},
    // Página 2
    {id:5,  name:'Dourado',      cost:460,  desc:'Pó que flutua suavemente'},
    {id:6,  name:'Sangue',       cost:500,  desc:'Gotas que despencam com gravidade'},
    {id:7,  name:'Sombra',       cost:540,  desc:'Manchas escuras que crescem e somem'},
    {id:8,  name:'Arco-íris',    cost:580,  desc:'Cada partícula em uma cor diferente'},
    {id:9,  name:'Meteoro',      cost:620,  desc:'Rastro longo de brasa que cai'},
    {id:10, name:'Gelo Vivo',    cost:660,  desc:'Flocos que giram ao redor da bala'},
    // Página 3
    {id:11, name:'Cortante',     cost:700,  desc:'Lâminas que partem para os lados'},
    {id:12, name:'Plasma',       cost:760,  desc:'Pulso elétrico que vibra e expande'},
    {id:13, name:'Aurora',       cost:820,  desc:'Faixas coloridas que sobem devagar'},
    {id:14, name:'Chama Viva',   cost:900,  desc:'Labaredas que sobem e tombam'},
    {id:15, name:'Abissal',      cost:980,  desc:'Partículas que implodem para o centro'},
    {id:16, name:'Raio',         cost:1060, desc:'Faíscas brancas em rajada rápida'},
    // Página 4
    {id:17, name:'Magma',        cost:1150, desc:'Gotas quentes que caem pesadas'},
    {id:18, name:'Estelar',      cost:1250, desc:'Estrelinhas que piscam e somem'},
    {id:19, name:'Deriva',       cost:1350, desc:'Partículas que vagam sem direção'},
    {id:20, name:'Ciclone',      cost:1450, desc:'Espiral de partículas ao redor da bala'},
    {id:21, name:'Sombrio',      cost:1550, desc:'Névoa escura que se alarga'},
    {id:22, name:'Rosa',         cost:1650, desc:'Pétalas suaves que caem'},
    // Página 5
    {id:23, name:'Nebulosa',     cost:1800, desc:'Nuvem densa que fica para trás'},
  ];
  var SHOTS_PER_PAGE = 6;
  var _shotPage = 0;

  // Gera partículas de rastro para um dado efeito de tiro
  // cx,cy = posição atual da bala; dir = {x,y} normalizado
  function _spawnShotTrail(id, cx, cy, dir){
    var p=[], r=Math.random;
    var perpX=-(dir.y||0), perpY=(dir.x||0);
    // backX/Y: direção oposta ao movimento (onde o rastro fica)
    var backX=-(dir.x||1), backY=-(dir.y||0);
    switch(id){
      case 0: // Fagulha — centelhas caem para baixo com gravidade forte
        if(r()<0.65){
          var ang=(r()-0.5)*1.2; var spd=12+r()*14;
          p.push({x:cx+backX*2+(r()-0.5)*3,y:cy+backY*2+(r()-0.5)*3,
            vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd+5,
            life:0.28,max:0.28,color:r()<0.5?'#ff7020':'#ffb040',size:1.5+r(),grav:120});
        }
        break;
      case 1: // Congelante — cristais minúsculos que flutuam parados e somem devagar
        if(r()<0.5){
          p.push({x:cx+(r()-0.5)*8,y:cy+(r()-0.5)*8,
            vx:(r()-0.5)*2, vy:(r()-0.5)*2,
            life:0.55,max:0.55,color:r()<0.5?'#c0eeff':'#ffffff',size:2+r()*2,grav:0});
        }
        break;
      case 2: // Elétrico — arcos curtos que disparam 90° para os dois lados perpendiculares
        for(var _ei=0;_ei<2;_ei++){
          var side=(_ei===0?1:-1);
          p.push({x:cx+(r()-0.5)*2, y:cy+(r()-0.5)*2,
            vx:perpX*side*(25+r()*15), vy:perpY*side*(25+r()*15),
            life:0.12,max:0.12,color:r()<0.5?'#88ddff':'#ffffff',size:1+r()*1.5,grav:0});
        }
        break;
      case 3: // Ácido — bolhas sobem em zigue-zague, ganham velocidade lateral oscilante
        if(r()<0.5){
          var phase=r()*Math.PI*2;
          p.push({x:cx+(r()-0.5)*4, y:cy+(r()-0.5)*4,
            vx:Math.sin(phase)*10, vy:-14-r()*10,
            life:0.4,max:0.4,color:r()<0.5?'#60ee20':'#a0ff40',size:2+r(),grav:-10});
        }
        break;
      case 4: // Espectral — rastro longo e fino que pulsa: aparece e desaparece (vida curta, tamanho grande)
        if(r()<0.6){
          p.push({x:cx+backX*(4+r()*8), y:cy+backY*(4+r()*8)+(r()-0.5)*3,
            vx:backX*8+(r()-0.5)*4, vy:backY*8+(r()-0.5)*4,
            life:0.18,max:0.18,color:r()<0.5?'#b0c8ff':'#8899dd',size:3+r()*3,grav:0});
        }
        break;
      case 5: // Dourado — pózinho que flutua levinho para cima, sem pressa
        if(r()<0.55){
          p.push({x:cx+(r()-0.5)*6, y:cy+(r()-0.5)*6,
            vx:(r()-0.5)*5, vy:-4-r()*6,
            life:0.6,max:0.6,color:r()<0.4?'#f3d23b':r()<0.7?'#ffe060':'#ffffff',size:1+r()*1.5,grav:-5});
        }
        break;
      case 6: // Sangue — gotas que despencam com gravidade pesada, sem lateral
        if(r()<0.6){
          p.push({x:cx+(r()-0.5)*3, y:cy+(r()-0.5)*3,
            vx:(r()-0.5)*4, vy:6+r()*8,
            life:0.35,max:0.35,color:r()<0.6?'#cc0010':'#880008',size:2+r()*2,grav:140});
        }
        break;
      case 7: // Sombra — manchas escuras que crescem (size grande, vida longa, quase paradas)
        if(r()<0.45){
          p.push({x:cx+(r()-0.5)*5, y:cy+(r()-0.5)*5,
            vx:(r()-0.5)*3, vy:(r()-0.5)*3,
            life:0.5,max:0.5,color:r()<0.5?'#10001a':'#200030',size:5+r()*5,grav:0});
        }
        break;
      case 8: // Arco-íris — partículas pequenas, cada uma cor diferente do espectro, se espalham bastante
        var _cols8=['#ff3030','#ff8800','#ffe000','#30dd30','#3388ff','#9933ff'];
        var _ci8=Math.floor(r()*_cols8.length);
        p.push({x:cx+(r()-0.5)*3, y:cy+(r()-0.5)*3,
          vx:(r()-0.5)*20, vy:(r()-0.5)*20,
          life:0.22,max:0.22,color:_cols8[_ci8],size:1.5+r(),grav:0});
        break;
      case 9: // Meteoro — rastro longo na direção oposta, partículas grandes que caem
        for(var _mi=0;_mi<2;_mi++){
          p.push({x:cx+backX*(3+_mi*4)+(r()-0.5)*2, y:cy+backY*(3+_mi*4)+(r()-0.5)*2,
            vx:backX*20+(r()-0.5)*8, vy:backY*20+8+r()*10,
            life:0.3,max:0.3,color:_mi===0?'#ff5010':'#ffaa20',size:2+r()*2,grav:80});
        }
        break;
      case 10: // Gelo Vivo — flocos que orbitam ao redor da bala em ângulo, ficam parados girando
        var _ang10=r()*Math.PI*2; var _rad10=6+r()*5;
        p.push({x:cx+Math.cos(_ang10)*_rad10, y:cy+Math.sin(_ang10)*_rad10,
          vx:Math.cos(_ang10+Math.PI/2)*8, vy:Math.sin(_ang10+Math.PI/2)*8,
          life:0.4,max:0.4,color:r()<0.5?'#a0e8ff':'#e0f8ff',size:1.5+r()*1.5,grav:0});
        break;
      case 11: // Cortante — duas lâminas que partem perpendicularmente, rápidas e finas
        for(var _li2=0;_li2<2;_li2++){
          var _s=(_li2===0?1:-1);
          p.push({x:cx, y:cy,
            vx:perpX*_s*35+backX*10, vy:perpY*_s*35+backY*10,
            life:0.15,max:0.15,color:'#ddeeff',size:1+r(),grav:0});
        }
        break;
      case 12: // Plasma — pulso que expande radialmente a partir da bala, anel de partículas
        var _nplasma=4;
        for(var _pi=0;_pi<_nplasma;_pi++){
          var _a12=(_pi/_nplasma)*Math.PI*2+r()*0.5;
          p.push({x:cx+Math.cos(_a12)*3, y:cy+Math.sin(_a12)*3,
            vx:Math.cos(_a12)*18, vy:Math.sin(_a12)*18,
            life:0.2,max:0.2,color:r()<0.5?'#dd44ff':'#ff99ff',size:1.5+r()*1.5,grav:0});
        }
        break;
      case 13: // Aurora — faixas largas e lentas que sobem, cores frias mudando
        if(r()<0.5){
          var _cols13=['#40ffaa','#4488ff','#aa44ff','#88ffdd'];
          p.push({x:cx+(r()-0.5)*10, y:cy+(r()-0.5)*4,
            vx:(r()-0.5)*4, vy:-8-r()*8,
            life:0.7,max:0.7,color:_cols13[Math.floor(r()*_cols13.length)],size:3+r()*4,grav:-6});
        }
        break;
      case 14: // Chama Viva — labaredas que sobem rápido e tombam para os lados com gravidade negativa
        if(r()<0.65){
          p.push({x:cx+(r()-0.5)*5, y:cy+(r()-0.5)*4,
            vx:(r()-0.5)*18, vy:-20-r()*15,
            life:0.28,max:0.28,color:r()<0.35?'#ff2000':r()<0.7?'#ff7000':'#ffcc00',size:2+r()*2,grav:-40});
        }
        break;
      case 15: // Abissal — partículas implodem: nascem longe e convergem para o centro
        var _ang15=r()*Math.PI*2; var _r15=12+r()*8;
        p.push({x:cx+Math.cos(_ang15)*_r15, y:cy+Math.sin(_ang15)*_r15,
          vx:-Math.cos(_ang15)*30, vy:-Math.sin(_ang15)*30,
          life:0.2,max:0.2,color:r()<0.5?'#5500cc':'#220066',size:2+r()*2,grav:0});
        break;
      case 16: // Raio — faíscas brancas minúsculas em rajada super rápida e curta
        for(var _ri=0;_ri<3;_ri++){
          p.push({x:cx+(r()-0.5)*6, y:cy+(r()-0.5)*6,
            vx:(r()-0.5)*50, vy:(r()-0.5)*50,
            life:0.08,max:0.08,color:r()<0.5?'#ffffff':'#eeeeff',size:1+r()*2,grav:0});
        }
        break;
      case 17: // Magma — gotas laranja-vermelhas pesadíssimas que caem quase verticalmente
        if(r()<0.6){
          p.push({x:cx+(r()-0.5)*4, y:cy+(r()-0.5)*3,
            vx:(r()-0.5)*6, vy:10+r()*12,
            life:0.45,max:0.45,color:r()<0.4?'#ff3000':r()<0.7?'#ff6600':'#ff9900',size:2.5+r()*2,grav:180});
        }
        break;
      case 18: // Estelar — estrelinhas que piscam no lugar: nascem, ficam paradas e somem
        if(r()<0.5){
          p.push({x:cx+(r()-0.5)*14, y:cy+(r()-0.5)*10,
            vx:(r()-0.5)*1, vy:(r()-0.5)*1,
            life:0.45,max:0.45,color:r()<0.4?'#ffffff':r()<0.7?'#ffeeaa':'#aaccff',size:1.5+r()*2,grav:0});
        }
        break;
      case 19: // Deriva — partículas que vagam: começam na bala e se movem em direções aleatórias devagar
        if(r()<0.5){
          var _ang19=r()*Math.PI*2;
          p.push({x:cx+(r()-0.5)*3, y:cy+(r()-0.5)*3,
            vx:Math.cos(_ang19)*6, vy:Math.sin(_ang19)*6,
            life:0.8,max:0.8,color:r()<0.5?'#aaddff':'#ddaaff',size:1.5+r()*2,grav:0});
        }
        break;
      case 20: // Ciclone — espiral: partículas orbitam em volta da bala em anel girando
        var _nciclone=3;
        for(var _ci2=0;_ci2<_nciclone;_ci2++){
          var _phase20=(_ci2/_nciclone)*Math.PI*2 + r()*0.3;
          var _rad20=8+r()*4;
          p.push({x:cx+Math.cos(_phase20)*_rad20, y:cy+Math.sin(_phase20)*_rad20,
            vx:Math.cos(_phase20+Math.PI/2)*22+backX*5,
            vy:Math.sin(_phase20+Math.PI/2)*22+backY*5,
            life:0.25,max:0.25,color:r()<0.5?'#88ccff':'#ffffff',size:1.5+r(),grav:0});
        }
        break;
      case 21: // Sombrio — névoa escura larga que se alarga: size enorme, lenta, quase transparente (vida longa)
        if(r()<0.4){
          p.push({x:cx+(r()-0.5)*8, y:cy+(r()-0.5)*8,
            vx:(r()-0.5)*5, vy:(r()-0.5)*5,
            life:0.7,max:0.7,color:r()<0.5?'#1a0020':'#2a0035',size:7+r()*7,grav:0});
        }
        break;
      case 22: // Rosa — pétalas suaves que caem com pouca gravidade, tamanho médio
        if(r()<0.5){
          p.push({x:cx+(r()-0.5)*6, y:cy+(r()-0.5)*5,
            vx:(r()-0.5)*10, vy:5+r()*8,
            life:0.5,max:0.5,color:r()<0.4?'#ff88bb':r()<0.7?'#ffaad0':'#ffd0e8',size:2+r()*2.5,grav:25});
        }
        break;
      case 23: // Nebulosa — nuvem densa e lenta que fica bem atrás da bala, grande e colorida
        if(r()<0.5){
          var _cols23=['#6622aa','#aa22cc','#cc66ff','#ff66aa'];
          p.push({x:cx+backX*(6+r()*8)+(r()-0.5)*4, y:cy+backY*(6+r()*8)+(r()-0.5)*4,
            vx:backX*4+(r()-0.5)*3, vy:backY*4+(r()-0.5)*3,
            life:0.6,max:0.6,color:_cols23[Math.floor(r()*_cols23.length)],size:4+r()*5,grav:0});
        }
        break;
    }
    return p;
  }
  window._spawnShotTrail = _spawnShotTrail;

  // ══════════════════════════════════════════════════════════
  // GOLD SKINS — visuais do bloco de ouro
  // ══════════════════════════════════════════════════════════
  var GOLD_SKINS = [
    // Página 1
    {id:-1, name:'Clássico',       cost:0,    desc:'Lingote de ouro aprimorado'},
    {id:0,  name:'Cofre',          cost:350,  desc:'Cofre metálico reforçado'},
    {id:1,  name:'Cristal',        cost:420,  desc:'Gema translúcida azul'},
    {id:2,  name:'Caixão',         cost:480,  desc:'Madeira escura e cruz dourada'},
    {id:3,  name:'Barril',         cost:520,  desc:'Barril de madeira com aros'},
    {id:4,  name:'Totem',          cost:580,  desc:'Totem entalhado e colorido'},
    // Página 2
    {id:5,  name:'Esmeralda',      cost:650,  desc:'Gema verde lapidada'},
    {id:6,  name:'Crânio',         cost:720,  desc:'Crânio dourado com dentes'},
    {id:7,  name:'Ampulheta',      cost:800,  desc:'Areia que escoa com o tempo'},
    {id:8,  name:'Caldeirão',      cost:880,  desc:'Borbulhando misteriosamente'},
    {id:9,  name:'Coração',        cost:960,  desc:'Pulsa vivo de energia'},
    {id:10, name:'Artefato',       cost:1100, desc:'Pedra alienígena com runas'},
    // Página 3
    {id:11, name:'Presente',       cost:1300, desc:'Embrulho misterioso com laço'},
    {id:12, name:'Vórtex',         cost:1600, desc:'Dimensão comprimida girando'},
    {id:13, name:'Baú do Tesouro', cost:450,  desc:'Baú de madeira com moedas'},
    {id:14, name:'Dinamite',       cost:500,  desc:'Dinamite com fuse aceso'},
    {id:15, name:'Lanterna',       cost:560,  desc:'Lanterna a óleo com luz viva'},
    {id:16, name:'Moeda',          cost:300,  desc:'Moeda de ouro brilhante'},
    // Página 4
    {id:17, name:'Frasco Mágico',  cost:700,  desc:'Frasco com líquido encantado'},
    {id:18, name:'Escudo',         cost:760,  desc:'Escudo medieval com brasão'},
    {id:19, name:'Estrela Sheriff',cost:650,  desc:'Estrela de xerife dourada'},
    {id:20, name:'Chapéu',         cost:720,  desc:'Chapéu de cowboy autêntico'},
    {id:21, name:'Cogumelo',       cost:1800, desc:'Cogumelo venenoso de olhos loucos'},
    {id:22, name:'Caixão de Ouro', cost:2000, desc:'Tudo que há de mais caro'},
    // Página 5
    {id:23, name:'Relógio de Bolso',cost:1400, desc:'Ponteiros que giram de verdade'},
  ];
  var GOLDS_PER_PAGE = 6;
  var _goldPage = 0;

  // Desenha um visual de ouro num canvas 2D dado o id
  // T = state.t (para animações), px/py = canto sup-esq do tile
  function _drawGoldSkin(ctx2, id, px, py, T){
    var t = T||0;
    var TILE2 = 32;
    // Sombra reta minimalista — igual ao cowboy e bandido — herdada por todos os skins
    ctx2.fillStyle = 'rgba(0,0,0,0.30)';
    ctx2.fillRect(px+6, py+28, 20, 3);
    switch(id){

      case -1: default: { // ── Clássico: pilha de 3 barras de ouro ──
        // 3 barras empilhadas de baixo pra cima, perspectiva leve
        // layout: [x_offset, y_topo, largura]
        var _bars = [[5,22,22],[6,16,20],[7,10,18]];
        // cores: mais escuro embaixo, mais claro no topo
        var _bright = ['#f0c830','#f8d840','#ffe060'];
        var _dark   = ['#a07010','#aa7c12','#b88a18'];
        for(var _bi=0;_bi<3;_bi++){
          var _bx=_bars[_bi][0], _by=_bars[_bi][1], _bw=_bars[_bi][2];
          // Face superior (topo) — trapézio estreito, perspectiva
          var _gT=ctx2.createLinearGradient(0,py+_by-3,0,py+_by);
          _gT.addColorStop(0,'#fff8d0'); _gT.addColorStop(1,_bright[_bi]);
          ctx2.fillStyle=_gT;
          ctx2.beginPath();
          ctx2.moveTo(px+_bx+2,  py+_by-3);
          ctx2.lineTo(px+_bx+_bw-2, py+_by-3);
          ctx2.lineTo(px+_bx+_bw,   py+_by);
          ctx2.lineTo(px+_bx,       py+_by);
          ctx2.closePath(); ctx2.fill();
          // Face frontal — gradiente horizontal claro no centro
          var _gF=ctx2.createLinearGradient(px+_bx,0,px+_bx+_bw,0);
          _gF.addColorStop(0,  _dark[_bi]);
          _gF.addColorStop(0.2,_bright[_bi]);
          _gF.addColorStop(0.8,_bright[_bi]);
          _gF.addColorStop(1,  _dark[_bi]);
          ctx2.fillStyle=_gF;
          ctx2.fillRect(px+_bx, py+_by, _bw, 5);
          // linha de brilho no topo da face frontal
          ctx2.fillStyle='rgba(255,255,200,0.55)';
          ctx2.fillRect(px+_bx+1, py+_by, _bw-2, 1);
          // linha de sombra na base
          ctx2.fillStyle='rgba(0,0,0,0.22)';
          ctx2.fillRect(px+_bx, py+_by+4, _bw, 1);
        }
        // reflexo especular no lingote do topo
        ctx2.save(); ctx2.globalAlpha=0.40; ctx2.fillStyle='#ffffff';
        ctx2.fillRect(px+9, py+11, 5, 2);
        ctx2.restore();
        break;
      }

      case 0: { // ── Cofre ──
        // Corpo cinza metálico
        var gCof=ctx2.createLinearGradient(px+4,py+8,px+4,py+27);
        gCof.addColorStop(0,'#b0b8c8'); gCof.addColorStop(1,'#606878');
        ctx2.fillStyle=gCof; ctx2.fillRect(px+4,py+8,24,19);
        // Reforços horizontais
        ctx2.fillStyle='#888fa0';
        ctx2.fillRect(px+4,py+13,24,3);
        ctx2.fillRect(px+4,py+21,24,3);
        // Dobradiças esquerda
        ctx2.fillStyle='#c0c8d8'; ctx2.fillRect(px+4,py+10,3,4); ctx2.fillRect(px+4,py+20,3,4);
        // Fechadura central dourada
        ctx2.fillStyle='#f3d23b'; ctx2.fillRect(px+14,py+15,4,5);
        ctx2.fillStyle='#b89020'; ctx2.fillRect(px+15,py+16,2,2);
        // Contorno escuro
        ctx2.strokeStyle='#404858'; ctx2.lineWidth=1;
        ctx2.strokeRect(px+4.5,py+8.5,23,18);
        break;
      }

      case 1: { // ── Cristal azul ──
        var pulse1=Math.sin(t*3)*0.15+0.85;
        ctx2.save(); ctx2.globalAlpha=pulse1;
        // Base hexagonal (simplificada como losango+rect)
        var gCri=ctx2.createLinearGradient(px+8,py+7,px+24,py+27);
        gCri.addColorStop(0,'#d0f4ff'); gCri.addColorStop(0.4,'#60c8ff'); gCri.addColorStop(1,'#1860b0');
        ctx2.fillStyle=gCri;
        ctx2.beginPath();
        ctx2.moveTo(px+16,py+7); ctx2.lineTo(px+26,py+16);
        ctx2.lineTo(px+16,py+28); ctx2.lineTo(px+6,py+16);
        ctx2.closePath(); ctx2.fill();
        // Reflexo interno
        ctx2.fillStyle='rgba(255,255,255,0.35)';
        ctx2.beginPath();
        ctx2.moveTo(px+16,py+9); ctx2.lineTo(px+22,py+16);
        ctx2.lineTo(px+16,py+14);
        ctx2.closePath(); ctx2.fill();
        ctx2.restore();
        // Brilho piscando
        ctx2.save(); ctx2.globalAlpha=Math.abs(Math.sin(t*4))*0.4;
        ctx2.fillStyle='#ffffff';
        ctx2.fillRect(px+14,py+9,3,3); ctx2.restore();
        break;
      }

      case 2: { // ── Caixão ──
        // Forma hexagonal (caixão)
        ctx2.fillStyle='#2a1508';
        ctx2.beginPath();
        ctx2.moveTo(px+11,py+7); ctx2.lineTo(px+21,py+7);
        ctx2.lineTo(px+27,py+13); ctx2.lineTo(px+27,py+22);
        ctx2.lineTo(px+21,py+27); ctx2.lineTo(px+11,py+27);
        ctx2.lineTo(px+5,py+22);  ctx2.lineTo(px+5,py+13);
        ctx2.closePath(); ctx2.fill();
        // Veios da madeira
        ctx2.strokeStyle='#1a0c04'; ctx2.lineWidth=0.8;
        for(var _ci=0;_ci<3;_ci++){
          ctx2.beginPath(); ctx2.moveTo(px+10+_ci*4,py+8); ctx2.lineTo(px+10+_ci*4,py+26); ctx2.stroke();
        }
        // Cruz dourada
        ctx2.fillStyle='#c8a020';
        ctx2.fillRect(px+15,py+12,2,10);
        ctx2.fillRect(px+12,py+15,8,2);
        break;
      }

      case 3: { // ── Barril ──
        // Corpo do barril (elipse + retângulo)
        var gBar=ctx2.createLinearGradient(px+4,py+8,px+28,py+8);
        gBar.addColorStop(0,'#5a3010'); gBar.addColorStop(0.5,'#8a5820'); gBar.addColorStop(1,'#5a3010');
        ctx2.fillStyle=gBar;
        ctx2.beginPath(); ctx2.ellipse(px+16,py+11,11,5,0,0,Math.PI*2); ctx2.fill();
        ctx2.fillRect(px+5,py+11,22,14);
        ctx2.beginPath(); ctx2.ellipse(px+16,py+25,11,5,0,0,Math.PI*2); ctx2.fill();
        // Arcos metálicos
        ctx2.strokeStyle='#808080'; ctx2.lineWidth=2.5;
        ctx2.beginPath(); ctx2.ellipse(px+16,py+14,11,3,0,0,Math.PI*2); ctx2.stroke();
        ctx2.beginPath(); ctx2.ellipse(px+16,py+22,11,3,0,0,Math.PI*2); ctx2.stroke();
        // "POW" ou faixa vermelha
        ctx2.fillStyle='#cc2020'; ctx2.fillRect(px+8,py+17,16,3);
        break;
      }

      case 4: { // ── Totem ──
        // Base
        ctx2.fillStyle='#6a3a0a'; ctx2.fillRect(px+11,py+23,10,5);
        // Corpo
        var gTot=ctx2.createLinearGradient(px+9,py+8,px+23,py+8);
        gTot.addColorStop(0,'#8a4a10'); gTot.addColorStop(0.5,'#c07030'); gTot.addColorStop(1,'#8a4a10');
        ctx2.fillStyle=gTot; ctx2.fillRect(px+10,py+8,12,16);
        // Olhos
        ctx2.fillStyle='#f3d23b'; ctx2.fillRect(px+12,py+11,3,3); ctx2.fillRect(px+17,py+11,3,3);
        ctx2.fillStyle='#111'; ctx2.fillRect(px+13,py+12,2,2); ctx2.fillRect(px+18,py+12,2,2);
        // Boca
        ctx2.fillStyle='#111'; ctx2.fillRect(px+13,py+18,6,2);
        // Penas no topo
        var penaCols=['#e83020','#f3d23b','#20cc20'];
        for(var _pi=0;_pi<3;_pi++){ ctx2.fillStyle=penaCols[_pi]; ctx2.fillRect(px+12+_pi*3,py+5,2,4); }
        break;
      }

      case 5: { // ── Jóia/Esmeralda ──
        var pulse5=Math.sin(t*2.5)*0.1+0.9;
        ctx2.save(); ctx2.globalAlpha=pulse5;
        var gJoi=ctx2.createLinearGradient(px+8,py+8,px+24,py+26);
        gJoi.addColorStop(0,'#a0ffb0'); gJoi.addColorStop(0.45,'#20cc60'); gJoi.addColorStop(1,'#007830');
        ctx2.fillStyle=gJoi;
        // Octógono
        ctx2.beginPath();
        ctx2.moveTo(px+13,py+8); ctx2.lineTo(px+19,py+8);
        ctx2.lineTo(px+24,py+13); ctx2.lineTo(px+24,py+21);
        ctx2.lineTo(px+19,py+26); ctx2.lineTo(px+13,py+26);
        ctx2.lineTo(px+8,py+21);  ctx2.lineTo(px+8,py+13);
        ctx2.closePath(); ctx2.fill();
        // Facetas
        ctx2.fillStyle='rgba(255,255,255,0.3)';
        ctx2.beginPath(); ctx2.moveTo(px+13,py+8); ctx2.lineTo(px+19,py+8); ctx2.lineTo(px+16,py+14); ctx2.closePath(); ctx2.fill();
        ctx2.restore();
        break;
      }

      case 6: { // ── Crânio dourado ──
        // Crânio
        ctx2.fillStyle='#e8c840';
        ctx2.beginPath(); ctx2.ellipse(px+16,py+14,9,10,0,0,Math.PI*2); ctx2.fill();
        // Mandíbula
        ctx2.fillStyle='#d4b030';
        ctx2.fillRect(px+10,py+21,12,6);
        // Olhos (cavidades)
        ctx2.fillStyle='#1a0800';
        ctx2.beginPath(); ctx2.ellipse(px+13,py+14,3,3.5,0,0,Math.PI*2); ctx2.fill();
        ctx2.beginPath(); ctx2.ellipse(px+19,py+14,3,3.5,0,0,Math.PI*2); ctx2.fill();
        // Dentes
        ctx2.fillStyle='#f5f0d0';
        for(var _di=0;_di<4;_di++){ ctx2.fillRect(px+11+_di*3,py+22,2,3); }
        break;
      }

      case 7: { // ── Ampulheta ──
        var sandY=Math.sin(t*1.5)*2; // areia cai
        // Moldura
        ctx2.fillStyle='#d0a840';
        ctx2.fillRect(px+9,py+7,14,3); ctx2.fillRect(px+9,py+26,14,3);
        ctx2.fillStyle='#b09030';
        ctx2.fillRect(px+10,py+10,2,16); ctx2.fillRect(px+20,py+10,2,16);
        // Vidro superior
        ctx2.fillStyle='rgba(200,240,255,0.4)';
        ctx2.beginPath();
        ctx2.moveTo(px+11,py+10); ctx2.lineTo(px+21,py+10);
        ctx2.lineTo(px+17,py+18); ctx2.lineTo(px+15,py+18);
        ctx2.closePath(); ctx2.fill();
        // Areia caindo
        ctx2.fillStyle='#e8b840';
        ctx2.beginPath();
        ctx2.moveTo(px+11,py+10); ctx2.lineTo(px+21,py+10);
        ctx2.lineTo(px+17,py+10+8+sandY); ctx2.lineTo(px+15,py+10+8+sandY);
        ctx2.closePath(); ctx2.fill();
        // Vidro inferior
        ctx2.fillStyle='rgba(200,240,255,0.4)';
        ctx2.beginPath();
        ctx2.moveTo(px+15,py+18); ctx2.lineTo(px+17,py+18);
        ctx2.lineTo(px+21,py+26); ctx2.lineTo(px+11,py+26);
        ctx2.closePath(); ctx2.fill();
        // Areia acumulada embaixo
        ctx2.fillStyle='#d4a030';
        ctx2.beginPath();
        ctx2.moveTo(px+12,py+26); ctx2.lineTo(px+20,py+26);
        ctx2.lineTo(px+18,py+21-sandY*0.5); ctx2.lineTo(px+14,py+21-sandY*0.5);
        ctx2.closePath(); ctx2.fill();
        break;
      }

      case 8: { // ── Caldeirão ──
        // Pernas
        ctx2.fillStyle='#303030';
        ctx2.fillRect(px+8,py+24,3,4); ctx2.fillRect(px+21,py+24,3,4);
        // Corpo (elipse)
        var gCal=ctx2.createLinearGradient(px+5,py+12,px+5,py+26);
        gCal.addColorStop(0,'#484848'); gCal.addColorStop(1,'#202020');
        ctx2.fillStyle=gCal;
        ctx2.beginPath(); ctx2.ellipse(px+16,py+20,11,8,0,0,Math.PI*2); ctx2.fill();
        // Líquido borbulhando
        var bubCol=Math.sin(t*4)>0?'#60ee30':'#40cc10';
        ctx2.fillStyle=bubCol;
        ctx2.beginPath(); ctx2.ellipse(px+16,py+16,9,4,0,0,Math.PI*2); ctx2.fill();
        // Bolhas
        ctx2.fillStyle='rgba(100,255,60,0.6)';
        var bpos=[[px+13,py+14+Math.sin(t*5)*2],[px+19,py+15+Math.sin(t*5+1)*2],[px+16,py+13+Math.sin(t*4+2)*2]];
        for(var _bi=0;_bi<bpos.length;_bi++){ ctx2.beginPath(); ctx2.arc(bpos[_bi][0],bpos[_bi][1],1.5,0,Math.PI*2); ctx2.fill(); }
        // Aro da borda
        ctx2.strokeStyle='#606060'; ctx2.lineWidth=2;
        ctx2.beginPath(); ctx2.ellipse(px+16,py+20,11,8,0,0,Math.PI*2); ctx2.stroke();
        break;
      }

      case 9: { // ── Coração pulsando ──
        var scale9=1+Math.sin(t*5)*0.08;
        ctx2.save(); ctx2.translate(px+16,py+17); ctx2.scale(scale9,scale9); ctx2.translate(-(px+16),-(py+17));
        ctx2.fillStyle='#ee1030';
        ctx2.beginPath();
        ctx2.moveTo(px+16,py+22);
        ctx2.bezierCurveTo(px+4,py+14,px+4,py+8,px+10,py+8);
        ctx2.bezierCurveTo(px+13,py+8,px+15,py+10,px+16,py+12);
        ctx2.bezierCurveTo(px+17,py+10,px+19,py+8,px+22,py+8);
        ctx2.bezierCurveTo(px+28,py+8,px+28,py+14,px+16,py+22);
        ctx2.closePath(); ctx2.fill();
        // Brilho
        ctx2.fillStyle='rgba(255,180,180,0.4)';
        ctx2.beginPath(); ctx2.ellipse(px+13,py+12,3,2,Math.PI/4,0,Math.PI*2); ctx2.fill();
        ctx2.restore();
        break;
      }

      case 10: { // ── Artefato alienígena ──
        var gArte=ctx2.createRadialGradient(px+16,py+17,2,px+16,py+17,12);
        gArte.addColorStop(0,'#c0ffb0'); gArte.addColorStop(0.5,'#406040'); gArte.addColorStop(1,'#102010');
        ctx2.fillStyle=gArte;
        ctx2.beginPath(); ctx2.ellipse(px+16,py+17,12,11,0,0,Math.PI*2); ctx2.fill();
        // Runas/símbolos
        ctx2.strokeStyle='#80ff60'; ctx2.lineWidth=1;
        var pulse10=Math.abs(Math.sin(t*2));
        ctx2.globalAlpha=0.4+pulse10*0.5;
        ctx2.beginPath(); ctx2.moveTo(px+12,py+12); ctx2.lineTo(px+20,py+12); ctx2.lineTo(px+16,py+22); ctx2.closePath(); ctx2.stroke();
        ctx2.beginPath(); ctx2.arc(px+16,py+17,5,0,Math.PI*2); ctx2.stroke();
        ctx2.globalAlpha=1;
        break;
      }

      case 11: { // ── Caixinha/Presente ──
        // Corpo
        var gCx=ctx2.createLinearGradient(px+5,py+14,px+5,py+27);
        gCx.addColorStop(0,'#c82020'); gCx.addColorStop(1,'#880010');
        ctx2.fillStyle=gCx; ctx2.fillRect(px+5,py+14,22,13);
        // Tampa
        var gTmp=ctx2.createLinearGradient(px+5,py+10,px+5,py+14);
        gTmp.addColorStop(0,'#ee3030'); gTmp.addColorStop(1,'#cc1020');
        ctx2.fillStyle=gTmp; ctx2.fillRect(px+4,py+10,24,4);
        // Fita vertical dourada
        ctx2.fillStyle='#f3d23b'; ctx2.fillRect(px+14,py+10,4,17);
        // Fita horizontal
        ctx2.fillStyle='#f3d23b'; ctx2.fillRect(px+5,py+13,22,3);
        // Laço (dois círculos)
        ctx2.strokeStyle='#f3d23b'; ctx2.lineWidth=2;
        ctx2.beginPath(); ctx2.ellipse(px+13,py+9,4,3,Math.PI/6,0,Math.PI*2); ctx2.stroke();
        ctx2.beginPath(); ctx2.ellipse(px+19,py+9,4,3,-Math.PI/6,0,Math.PI*2); ctx2.stroke();
        break;
      }

      case 12: { // ── Vórtex dimensional ──
        var angle=t*3;
        for(var _ri=3;_ri>=0;_ri--){
          var rad=4+_ri*3.5;
          var col=['#ff44ff','#8844ff','#4488ff','#44ffff'][_ri];
          ctx2.save(); ctx2.globalAlpha=0.3+_ri*0.15;
          ctx2.fillStyle=col;
          ctx2.beginPath(); ctx2.arc(px+16,py+17,rad,0,Math.PI*2); ctx2.fill();
          ctx2.restore();
        }
        ctx2.save(); ctx2.translate(px+16,py+17); ctx2.rotate(angle);
        ctx2.strokeStyle='#ffffff'; ctx2.lineWidth=1.5; ctx2.globalAlpha=0.7;
        ctx2.beginPath(); ctx2.ellipse(0,0,10,4,0,0,Math.PI*2); ctx2.stroke();
        ctx2.restore();
        ctx2.save(); ctx2.globalAlpha=0.7+Math.sin(t*6)*0.3;
        ctx2.fillStyle='#ffffff';
        ctx2.beginPath(); ctx2.arc(px+16,py+17,2.5,0,Math.PI*2); ctx2.fill();
        ctx2.restore();
        break;
      }

      case 13: { // ── Baú do Tesouro ──
        // Corpo do baú (madeira)
        var gBau=ctx2.createLinearGradient(px+4,py+14,px+4,py+27);
        gBau.addColorStop(0,'#8a5020'); gBau.addColorStop(1,'#5a3010');
        ctx2.fillStyle=gBau; ctx2.fillRect(px+4,py+14,24,13);
        // Tampa arqueada
        var gTampa=ctx2.createLinearGradient(px+4,py+8,px+4,py+15);
        gTampa.addColorStop(0,'#c07838'); gTampa.addColorStop(1,'#8a5020');
        ctx2.fillStyle=gTampa;
        ctx2.beginPath(); ctx2.moveTo(px+4,py+14); ctx2.lineTo(px+28,py+14);
        ctx2.lineTo(px+28,py+10); ctx2.quadraticCurveTo(px+16,py+6,px+4,py+10);
        ctx2.closePath(); ctx2.fill();
        // Reforços dourados
        ctx2.fillStyle='#d4a030';
        ctx2.fillRect(px+4,py+14,24,2);  // divisa
        ctx2.fillRect(px+4,py+22,24,2);  // inferior
        ctx2.fillRect(px+4,py+14,2,13);  // lateral esq
        ctx2.fillRect(px+26,py+14,2,13); // lateral dir
        // Fechadura oval dourada
        ctx2.fillStyle='#f3d23b';
        ctx2.beginPath(); ctx2.ellipse(px+16,py+18,4,3,0,0,Math.PI*2); ctx2.fill();
        ctx2.fillStyle='#8a6010';
        ctx2.beginPath(); ctx2.ellipse(px+16,py+18,2,1.5,0,0,Math.PI*2); ctx2.fill();
        // Moedas derramando (brilhando)
        ctx2.save(); ctx2.globalAlpha=0.8+Math.sin(t*4)*0.2;
        ctx2.fillStyle='#f3d23b';
        ctx2.beginPath(); ctx2.ellipse(px+12,py+27,3,1.5,0,0,Math.PI*2); ctx2.fill();
        ctx2.beginPath(); ctx2.ellipse(px+20,py+27,2.5,1.5,0,0,Math.PI*2); ctx2.fill();
        ctx2.restore();
        break;
      }

      case 14: { // ── Dinamite ──
        // Corpo vermelho
        var gDin=ctx2.createLinearGradient(px+10,py+8,px+22,py+8);
        gDin.addColorStop(0,'#aa1010'); gDin.addColorStop(0.5,'#ee2020'); gDin.addColorStop(1,'#aa1010');
        ctx2.fillStyle=gDin;
        ctx2.beginPath(); ctx2.roundRect(px+10,py+8,12,18,3); ctx2.fill();
        // Rótulo bege
        ctx2.fillStyle='#f0e0b0';
        ctx2.fillRect(px+11,py+12,10,8);
        ctx2.fillStyle='#333';
        ctx2.font='bold 5px monospace'; ctx2.textAlign='center'; ctx2.textBaseline='middle';
        ctx2.fillText('TNT',px+16,py+16);
        // Fio aceso no topo (animado)
        var fuseAnim=Math.sin(t*10)*2;
        ctx2.strokeStyle='#c8a020'; ctx2.lineWidth=1.5;
        ctx2.beginPath(); ctx2.moveTo(px+16,py+8);
        ctx2.quadraticCurveTo(px+16+fuseAnim,py+4,px+16+fuseAnim*0.5,py+2);
        ctx2.stroke();
        // Chispa no fim do fio
        ctx2.save(); ctx2.globalAlpha=0.9;
        ctx2.fillStyle='#ffcc00';
        ctx2.beginPath(); ctx2.arc(px+16+fuseAnim*0.5,py+2,2,0,Math.PI*2); ctx2.fill();
        ctx2.globalAlpha=0.5+Math.random()*0.4;
        ctx2.fillStyle='#ff6000';
        ctx2.beginPath(); ctx2.arc(px+16+fuseAnim*0.5,py+2,3,0,Math.PI*2); ctx2.fill();
        ctx2.restore();
        // Tampa e base metálicos
        ctx2.fillStyle='#808080';
        ctx2.fillRect(px+10,py+26,12,2);
        ctx2.fillRect(px+10,py+7,12,2);
        break;
      }

      case 15: { // ── Lanterna a Óleo ──
        // Base e poste
        ctx2.fillStyle='#888890';
        ctx2.fillRect(px+13,py+24,6,3); // base
        ctx2.fillRect(px+15,py+10,2,14); // haste
        // Corpo da lanterna (hexagonal)
        var gLan=ctx2.createLinearGradient(px+9,py+10,px+23,py+10);
        gLan.addColorStop(0,'#505860'); gLan.addColorStop(0.5,'#788090'); gLan.addColorStop(1,'#505860');
        ctx2.fillStyle=gLan;
        ctx2.beginPath();
        ctx2.moveTo(px+12,py+10); ctx2.lineTo(px+20,py+10);
        ctx2.lineTo(px+23,py+14); ctx2.lineTo(px+23,py+20);
        ctx2.lineTo(px+20,py+24); ctx2.lineTo(px+12,py+24);
        ctx2.lineTo(px+9,py+20);  ctx2.lineTo(px+9,py+14);
        ctx2.closePath(); ctx2.fill();
        // Luz interior — brilho pulsante quente
        var flickerLan=0.75+Math.sin(t*7+Math.cos(t*13))*0.25;
        ctx2.save(); ctx2.globalAlpha=flickerLan*0.85;
        var gFlame=ctx2.createRadialGradient(px+16,py+17,1,px+16,py+17,7);
        gFlame.addColorStop(0,'#ffe8a0'); gFlame.addColorStop(0.5,'#ff9020'); gFlame.addColorStop(1,'rgba(255,80,0,0)');
        ctx2.fillStyle=gFlame;
        ctx2.beginPath(); ctx2.ellipse(px+16,py+17,7,6,0,0,Math.PI*2); ctx2.fill();
        ctx2.restore();
        // Vidro — reflexo
        ctx2.save(); ctx2.globalAlpha=0.25;
        ctx2.fillStyle='#d0e8ff';
        ctx2.beginPath();
        ctx2.moveTo(px+13,py+11); ctx2.lineTo(px+16,py+11); ctx2.lineTo(px+15,py+16); ctx2.lineTo(px+12,py+15);
        ctx2.closePath(); ctx2.fill();
        ctx2.restore();
        // Corrente no topo
        ctx2.strokeStyle='#606060'; ctx2.lineWidth=1;
        ctx2.beginPath(); ctx2.moveTo(px+14,py+9); ctx2.lineTo(px+16,py+7); ctx2.lineTo(px+18,py+9); ctx2.stroke();
        break;
      }

      case 16: { // ── Moeda Gigante ──
        // Corpo da moeda (perspectiva fina)
        ctx2.fillStyle='#a07010';
        ctx2.beginPath(); ctx2.ellipse(px+16,py+18,11,3,0,0,Math.PI*2); ctx2.fill();
        var gMo=ctx2.createLinearGradient(px+5,py+10,px+5,py+18);
        gMo.addColorStop(0,'#ffe87a'); gMo.addColorStop(0.4,'#f3d23b'); gMo.addColorStop(1,'#c89010');
        ctx2.fillStyle=gMo;
        ctx2.beginPath(); ctx2.ellipse(px+16,py+10,11,10,0,0,Math.PI*2); ctx2.fill();
        // Borda serrilhada (estrela de 12 pontas simulada com gradiente)
        ctx2.strokeStyle='#a07010'; ctx2.lineWidth=1.5;
        ctx2.beginPath(); ctx2.ellipse(px+16,py+10,11,10,0,0,Math.PI*2); ctx2.stroke();
        // "$" central
        ctx2.fillStyle='#9a7010';
        ctx2.font='bold 12px serif'; ctx2.textAlign='center'; ctx2.textBaseline='middle';
        ctx2.fillText('$',px+16,py+10);
        // Reflexo superior
        ctx2.save(); ctx2.globalAlpha=0.4;
        ctx2.fillStyle='#fff';
        ctx2.beginPath(); ctx2.ellipse(px+13,py+7,4,2,Math.PI/6,0,Math.PI*2); ctx2.fill();
        ctx2.restore();
        break;
      }

      case 17: { // ── Frasco Encantado ──
        var bubbleY=Math.sin(t*3)*2;
        // Corpo do frasco
        ctx2.fillStyle='rgba(80,160,220,0.18)';
        ctx2.beginPath();
        ctx2.moveTo(px+13,py+14); ctx2.lineTo(px+19,py+14);
        ctx2.lineTo(px+22,py+24); ctx2.lineTo(px+10,py+24);
        ctx2.closePath(); ctx2.fill();
        // Gargalo
        var gFr=ctx2.createLinearGradient(px+12,py+9,px+20,py+9);
        gFr.addColorStop(0,'#607080'); gFr.addColorStop(0.5,'#90a8b8'); gFr.addColorStop(1,'#607080');
        ctx2.fillStyle=gFr; ctx2.fillRect(px+13,py+9,6,6);
        // Tampa/rolha
        ctx2.fillStyle='#8a5020'; ctx2.fillRect(px+12,py+7,8,3);
        // Líquido dentro (azul brilhante)
        var gLiq=ctx2.createLinearGradient(px+11,py+15,px+21,py+15);
        gLiq.addColorStop(0,'#2080ee'); gLiq.addColorStop(0.5,'#60c0ff'); gLiq.addColorStop(1,'#2080ee');
        ctx2.fillStyle=gLiq;
        ctx2.beginPath();
        ctx2.moveTo(px+13.5,py+16); ctx2.lineTo(px+18.5,py+16);
        ctx2.lineTo(px+21,py+24); ctx2.lineTo(px+11,py+24);
        ctx2.closePath(); ctx2.fill();
        // Brilho vidro
        ctx2.save(); ctx2.globalAlpha=0.3;
        ctx2.fillStyle='#ffffff';
        ctx2.beginPath(); ctx2.moveTo(px+13,py+15); ctx2.lineTo(px+15,py+14); ctx2.lineTo(px+15,py+21); ctx2.lineTo(px+13,py+21); ctx2.closePath(); ctx2.fill();
        ctx2.restore();
        // Bolha animada
        ctx2.save(); ctx2.globalAlpha=0.7;
        ctx2.fillStyle='rgba(180,240,255,0.8)';
        ctx2.beginPath(); ctx2.arc(px+16,py+21+bubbleY,1.5,0,Math.PI*2); ctx2.fill();
        ctx2.beginPath(); ctx2.arc(px+14,py+18+bubbleY*0.7,1,0,Math.PI*2); ctx2.fill();
        ctx2.restore();
        // Brilho mágico externo
        ctx2.save(); ctx2.globalAlpha=0.25+Math.sin(t*4)*0.15;
        ctx2.fillStyle='#80c8ff';
        ctx2.beginPath(); ctx2.ellipse(px+16,py+18,10,8,0,0,Math.PI*2); ctx2.fill();
        ctx2.restore();
        break;
      }

      case 18: { // ── Escudo Medieval ──
        // Forma do escudo
        var gEsc=ctx2.createLinearGradient(px+6,py+7,px+26,py+27);
        gEsc.addColorStop(0,'#d0d8e0'); gEsc.addColorStop(0.4,'#f0f4f8'); gEsc.addColorStop(1,'#8090a0');
        ctx2.fillStyle=gEsc;
        ctx2.beginPath();
        ctx2.moveTo(px+16,py+28); ctx2.lineTo(px+6,py+19);
        ctx2.lineTo(px+6,py+8); ctx2.lineTo(px+26,py+8);
        ctx2.lineTo(px+26,py+19);
        ctx2.closePath(); ctx2.fill();
        // Divisória em cruz
        ctx2.fillStyle='rgba(180,0,0,0.8)';
        ctx2.fillRect(px+14,py+8,4,20);
        ctx2.fillRect(px+6,py+14,20,4);
        // Borda
        ctx2.strokeStyle='#6070a0'; ctx2.lineWidth=1.5;
        ctx2.beginPath();
        ctx2.moveTo(px+16,py+28); ctx2.lineTo(px+6,py+19);
        ctx2.lineTo(px+6,py+8); ctx2.lineTo(px+26,py+8);
        ctx2.lineTo(px+26,py+19);
        ctx2.closePath(); ctx2.stroke();
        // Brilho no canto
        ctx2.save(); ctx2.globalAlpha=0.4;
        ctx2.fillStyle='#ffffff';
        ctx2.beginPath(); ctx2.ellipse(px+11,py+11,3,2,Math.PI/4,0,Math.PI*2); ctx2.fill();
        ctx2.restore();
        break;
      }

      case 19: { // ── Estrela Sheriff ──
        // Estrela de 6 pontas
        ctx2.fillStyle='#c8a020';
        var starR1=11, starR2=5.5;
        ctx2.beginPath();
        for(var _sp=0;_sp<12;_sp++){
          var _sang=(_sp*Math.PI/6)-Math.PI/2;
          var _sr=(_sp%2===0)?starR1:starR2;
          if(_sp===0) ctx2.moveTo(px+16+Math.cos(_sang)*_sr,py+17+Math.sin(_sang)*_sr);
          else ctx2.lineTo(px+16+Math.cos(_sang)*_sr,py+17+Math.sin(_sang)*_sr);
        }
        ctx2.closePath(); ctx2.fill();
        // Contorno
        ctx2.strokeStyle='#8a6808'; ctx2.lineWidth=1;
        ctx2.stroke();
        // Brilho especular
        ctx2.save(); ctx2.globalAlpha=0.5;
        var gStar=ctx2.createLinearGradient(px+10,py+11,px+18,py+17);
        gStar.addColorStop(0,'rgba(255,255,200,0.8)'); gStar.addColorStop(1,'rgba(255,255,200,0)');
        ctx2.fillStyle=gStar;
        ctx2.beginPath();
        for(var _sp2=0;_sp2<12;_sp2++){
          var _sang2=(_sp2*Math.PI/6)-Math.PI/2;
          var _sr2=(_sp2%2===0)?starR1:starR2;
          if(_sp2===0) ctx2.moveTo(px+16+Math.cos(_sang2)*_sr2,py+17+Math.sin(_sang2)*_sr2);
          else ctx2.lineTo(px+16+Math.cos(_sang2)*_sr2,py+17+Math.sin(_sang2)*_sr2);
        }
        ctx2.closePath(); ctx2.fill();
        ctx2.restore();
        // Centro
        ctx2.fillStyle='#f3d23b';
        ctx2.beginPath(); ctx2.arc(px+16,py+17,3,0,Math.PI*2); ctx2.fill();
        break;
      }

      case 20: { // ── Chapéu de Cowboy ──
        // Aba
        var gAba=ctx2.createLinearGradient(px+2,py+20,px+2,py+24);
        gAba.addColorStop(0,'#8a5a20'); gAba.addColorStop(1,'#6a3808');
        ctx2.fillStyle=gAba;
        ctx2.beginPath(); ctx2.ellipse(px+16,py+21,14,4,0,0,Math.PI*2); ctx2.fill();
        // Copa
        var gCopa=ctx2.createLinearGradient(px+7,py+9,px+25,py+9);
        gCopa.addColorStop(0,'#7a4818'); gCopa.addColorStop(0.5,'#a06030'); gCopa.addColorStop(1,'#7a4818');
        ctx2.fillStyle=gCopa; ctx2.fillRect(px+8,py+9,16,13);
        // Amassado no topo
        ctx2.fillStyle='#8a5020';
        ctx2.fillRect(px+8,py+9,16,3);
        ctx2.fillStyle='#7a4018';
        ctx2.beginPath(); ctx2.ellipse(px+16,py+9,6,2,0,0,Math.PI*2); ctx2.fill();
        // Fita
        ctx2.fillStyle='#202020'; ctx2.fillRect(px+8,py+20,16,2);
        // Brilho na aba
        ctx2.save(); ctx2.globalAlpha=0.25;
        ctx2.fillStyle='#fff';
        ctx2.beginPath(); ctx2.ellipse(px+12,py+20,4,1.5,0,0,Math.PI*2); ctx2.fill();
        ctx2.restore();
        break;
      }

      case 21: { // ── Cogumelo Venenoso (doido, caro) ──
        // Haste
        ctx2.fillStyle='#e8d8c0';
        ctx2.beginPath();
        ctx2.moveTo(px+12,py+26); ctx2.lineTo(px+20,py+26);
        ctx2.lineTo(px+19,py+17); ctx2.lineTo(px+13,py+17);
        ctx2.closePath(); ctx2.fill();
        // Véu (saia)
        ctx2.fillStyle='rgba(220,200,180,0.7)';
        ctx2.beginPath(); ctx2.ellipse(px+16,py+18,8,2.5,0,0,Math.PI*2); ctx2.fill();
        // Chapéu (cap) — vermelho com pintas brancas
        var gCog=ctx2.createRadialGradient(px+14,py+12,1,px+16,py+14,10);
        gCog.addColorStop(0,'#ff4040'); gCog.addColorStop(0.6,'#cc1010'); gCog.addColorStop(1,'#880000');
        ctx2.fillStyle=gCog;
        ctx2.beginPath(); ctx2.ellipse(px+16,py+14,11,9,0,0,Math.PI*2); ctx2.fill();
        // Base plana do chapéu
        ctx2.fillStyle='#cc1010';
        ctx2.beginPath(); ctx2.ellipse(px+16,py+18,11,3,0,0,Math.PI*2); ctx2.fill();
        // Pintas brancas
        var spots=[[px+13,py+11,2.5],[px+19,py+12,2],[px+16,py+9,1.5],[px+11,py+15,1.5],[px+21,py+16,1.5]];
        ctx2.fillStyle='#f0f0f0';
        for(var _si=0;_si<spots.length;_si++){
          ctx2.beginPath(); ctx2.arc(spots[_si][0],spots[_si][1],spots[_si][2],0,Math.PI*2); ctx2.fill();
        }
        // Olhinhos malucos
        ctx2.fillStyle='#111';
        ctx2.beginPath(); ctx2.arc(px+14,py+14,1,0,Math.PI*2); ctx2.fill();
        ctx2.beginPath(); ctx2.arc(px+18,py+14,1,0,Math.PI*2); ctx2.fill();
        ctx2.fillStyle='#ff8800';
        ctx2.beginPath(); ctx2.arc(px+14,py+14,0.5,0,Math.PI*2); ctx2.fill();
        ctx2.beginPath(); ctx2.arc(px+18,py+14,0.5,0,Math.PI*2); ctx2.fill();
        break;
      }

      case 22: { // ── Caixão de Ouro (doido, caro) ──
        // Forma do caixão em ouro sólido
        var gCaixao=ctx2.createLinearGradient(px+5,py+7,px+27,py+7);
        gCaixao.addColorStop(0,'#c89010'); gCaixao.addColorStop(0.4,'#ffe060'); gCaixao.addColorStop(0.7,'#f3d23b'); gCaixao.addColorStop(1,'#c89010');
        ctx2.fillStyle=gCaixao;
        ctx2.beginPath();
        ctx2.moveTo(px+11,py+7); ctx2.lineTo(px+21,py+7);
        ctx2.lineTo(px+27,py+12); ctx2.lineTo(px+27,py+22);
        ctx2.lineTo(px+21,py+27); ctx2.lineTo(px+11,py+27);
        ctx2.lineTo(px+5,py+22);  ctx2.lineTo(px+5,py+12);
        ctx2.closePath(); ctx2.fill();
        // Contorno escuro
        ctx2.strokeStyle='#906008'; ctx2.lineWidth=1.5;
        ctx2.beginPath();
        ctx2.moveTo(px+11,py+7); ctx2.lineTo(px+21,py+7);
        ctx2.lineTo(px+27,py+12); ctx2.lineTo(px+27,py+22);
        ctx2.lineTo(px+21,py+27); ctx2.lineTo(px+11,py+27);
        ctx2.lineTo(px+5,py+22);  ctx2.lineTo(px+5,py+12);
        ctx2.closePath(); ctx2.stroke();
        // Cruz prateada
        ctx2.fillStyle='#e0e8f0';
        ctx2.fillRect(px+15,py+10,2,12);
        ctx2.fillRect(px+12,py+14,8,2);
        // Brilho
        ctx2.save(); ctx2.globalAlpha=0.4;
        ctx2.fillStyle='#fff';
        ctx2.beginPath(); ctx2.moveTo(px+13,py+8); ctx2.lineTo(px+20,py+8); ctx2.lineTo(px+18,py+12); ctx2.lineTo(px+15,py+12); ctx2.closePath(); ctx2.fill();
        ctx2.restore();
        break;
      }

      case 23: { // ── Relógio de Bolso (doido, caro) ──
        // Corrente
        ctx2.strokeStyle='#c8a020'; ctx2.lineWidth=1.5;
        ctx2.beginPath(); ctx2.moveTo(px+16,py+6); ctx2.quadraticCurveTo(px+22,py+8,px+24,py+12); ctx2.stroke();
        // Corpo circular
        var gRel=ctx2.createRadialGradient(px+14,py+13,1,px+15,py+18,10);
        gRel.addColorStop(0,'#fffce0'); gRel.addColorStop(0.4,'#e8d048'); gRel.addColorStop(1,'#9a7008');
        ctx2.fillStyle=gRel;
        ctx2.beginPath(); ctx2.arc(px+15,py+19,10,0,Math.PI*2); ctx2.fill();
        // Borda
        ctx2.strokeStyle='#c8a010'; ctx2.lineWidth=2;
        ctx2.beginPath(); ctx2.arc(px+15,py+19,10,0,Math.PI*2); ctx2.stroke();
        // Coroa (botão superior)
        ctx2.fillStyle='#c8a020'; ctx2.fillRect(px+13,py+8,4,3);
        // Mostrador
        ctx2.fillStyle='rgba(255,255,240,0.9)';
        ctx2.beginPath(); ctx2.arc(px+15,py+19,8,0,Math.PI*2); ctx2.fill();
        // Marcações
        ctx2.strokeStyle='#806010'; ctx2.lineWidth=1;
        for(var _hi=0;_hi<12;_hi++){
          var _ha=(_hi/12)*Math.PI*2-Math.PI/2;
          ctx2.beginPath(); ctx2.moveTo(px+15+Math.cos(_ha)*6,py+19+Math.sin(_ha)*6);
          ctx2.lineTo(px+15+Math.cos(_ha)*8,py+19+Math.sin(_ha)*8); ctx2.stroke();
        }
        // Ponteiros animados
        var hAngle=t*0.5; var mAngle=t*2;
        ctx2.strokeStyle='#302000'; ctx2.lineWidth=1.5;
        ctx2.beginPath(); ctx2.moveTo(px+15,py+19); ctx2.lineTo(px+15+Math.cos(hAngle-Math.PI/2)*4,py+19+Math.sin(hAngle-Math.PI/2)*4); ctx2.stroke();
        ctx2.lineWidth=1;
        ctx2.beginPath(); ctx2.moveTo(px+15,py+19); ctx2.lineTo(px+15+Math.cos(mAngle-Math.PI/2)*6,py+19+Math.sin(mAngle-Math.PI/2)*6); ctx2.stroke();
        // Centro
        ctx2.fillStyle='#c8a010';
        ctx2.beginPath(); ctx2.arc(px+15,py+19,1.5,0,Math.PI*2); ctx2.fill();
        break;
      }
    }
  }
  window._drawGoldSkin = _drawGoldSkin;

  // ── Card preview: ouro animado ────────────────────────────
  var _goldCardLoops = new Map();
  function _stopGoldCardLoop(canvas){
    var obj=_goldCardLoops.get(canvas);
    if(obj){obj.active=false;if(obj.raf)cancelAnimationFrame(obj.raf);}
    _goldCardLoops.delete(canvas);
  }
  function _startGoldCardLoop(canvas, goldId){
    _stopGoldCardLoop(canvas);
    var W=canvas.width, H=canvas.height;
    var obj={active:true,raf:null}; _goldCardLoops.set(canvas,obj);
    var last=null, T=0;
    // offset para centralizar o bloco 32px no canvas
    var offX=Math.floor((W-32)/2), offY=Math.floor((H-32)/2);
    function frame(now){
      if(!obj.active) return;
      if(last===null) last=now;
      var dt=Math.min(0.05,(now-last)/1000); last=now; T+=dt;
      var ctx2=canvas.getContext('2d');
      ctx2.clearRect(0,0,W,H);
      // fundo areia
      ctx2.fillStyle='#c8a95a'; ctx2.fillRect(0,0,W,H);
      // desenhaar o gold skin
      ctx2.save();
      // escala para caber no preview
      var sc=W/48;
      ctx2.scale(sc,sc);
      _drawGoldSkin(ctx2, goldId, offX/sc, offY/sc+2, T);
      ctx2.restore();
      obj.raf=requestAnimationFrame(frame);
    }
    obj.raf=requestAnimationFrame(frame);
  }

  // ── Render grid de visuais do ouro ───────────────────────
  function renderProfileGolds(){
    var grid=document.getElementById('profGoldsGrid'); if(!grid) return;
    _stopCosmeticPreviewLoops(grid);
    grid.innerHTML='';
    var acc=acctLoad(), owned=new Set(acc.ownedGolds||[]), eq=acc.equippedGold;
    var catalog=_getCosmeticCatalogEntries('golds', true, acc);
    var totalPages=Math.max(1, Math.ceil(catalog.length/GOLDS_PER_PAGE));
    if(_goldPage>=totalPages) _goldPage=Math.max(0,totalPages-1);
    var start=_goldPage*GOLDS_PER_PAGE, end=Math.min(start+GOLDS_PER_PAGE,catalog.length);
    for(var i=start;i<end;i++){
      (function(item){
        var gsk=item.data;
        var isDefault=(gsk.id===-1);
        var isOwned=isDefault||owned.has(gsk.id), isEq=(eq===gsk.id);
        var card=document.createElement('div'); card.className='prof-gold-card'+(isEq?' equipped':'');
        var cvs=document.createElement('canvas'); cvs.width=48; cvs.height=32;
        var nm=document.createElement('div'); nm.className='gold-name'; nm.textContent=gsk.name;
        var btn=document.createElement('button'); btn.className='gold-btn';
        if(isEq){
          btn.textContent='Equipado'; btn.disabled=true; btn.className='gold-btn btn-equipped';
        } else if(isOwned){
          btn.textContent='Equipar'; btn.className='gold-btn btn-equip';
          btn.onclick=function(e){ e.stopPropagation(); _equipGold(gsk.id); };
        } else {
          btn.textContent=gsk.cost+' Ouro'; btn.className='gold-btn btn-buy';
          btn.onclick=function(e){ e.stopPropagation(); _buyGold(gsk.id); };
        }
        card.appendChild(cvs); card.appendChild(nm); card.appendChild(btn);
        grid.appendChild(card);
        _startGoldCardLoop(cvs, gsk.id);
      })(catalog[i]);
    }
    for(var fi=end-start;fi<GOLDS_PER_PAGE;fi++){
      var ph=document.createElement('div'); ph.style.visibility='hidden'; grid.appendChild(ph);
    }
    var lbl=document.getElementById('profGoldPgLabel'); if(lbl) lbl.textContent=(_goldPage+1)+' / '+totalPages;
    var pp=document.getElementById('profGoldPgPrev'); if(pp) pp.disabled=(_goldPage===0);
    var pn=document.getElementById('profGoldPgNext'); if(pn) pn.disabled=(_goldPage>=totalPages-1);
  }

  window._profChangeGoldPage=function(d){
    var tp=Math.max(1, Math.ceil(_getCosmeticCatalogEntries('golds', true).length/GOLDS_PER_PAGE));
    _goldPage=Math.max(0,Math.min(tp-1,_goldPage+d));
    renderProfileGolds();
  };

  function _buyGold(id){
    var gsk=null; for(var i=0;i<GOLD_SKINS.length;i++){if(GOLD_SKINS[i].id===id){gsk=GOLD_SKINS[i];break;}} if(!gsk||id===-1) return;
    var acc=acctLoad();
    if(acc.coins<gsk.cost){ _profSkinToast('Ouro insuficiente',true); try{window._gameBeep(180,0.09,'sawtooth',0.07);}catch(_){} return; }
    acc.coins-=gsk.cost;
    if(!acc.ownedGolds.includes(id)) acc.ownedGolds.push(id);
    acc.equippedGold=id; acctSave(acc);
    if(typeof state!=='undefined'&&state) state.equippedGold=id;
    _profSndBuy();
    _profSkinToast('Visual desbloqueado e equipado!',false);
    refreshMenu();
    renderProfileGolds();
    _refreshCosmeticStoreIfOpen();
  }

  function _equipGold(id){
    var acc=acctLoad(); acc.equippedGold=id; acctSave(acc);
    if(typeof state!=='undefined'&&state) state.equippedGold=id;
    _profSndEquip();
    _profSkinToast('Visual equipado!',false);
    renderProfileGolds();
    _refreshCosmeticStoreIfOpen();
  }

  // Cor principal da bala para cada efeito (substituída visualmente)
  function _shotBulletColor(id){
    var map={0:'#ff8030',1:'#c8f0ff',2:'#88ddff',3:'#80ff30',4:'#9abaee',
             5:'#f3d23b',6:'#ee1010',7:'#3a1060',8:'#ff9020',9:'#ff6020',
             10:'#b0eeff',11:'#ddeeff',12:'#ee44ff',13:'#44ffcc',14:'#ff4000',
             15:'#7700ff',16:'#ffffff',17:'#ff5500',18:'#fffaaa',19:'#aaddff',
             20:'#66bbff',21:'#330044',22:'#ffaacc',23:'#cc44ff'};
    return map[id]||'#f3d23b';
  }
  window._shotBulletColor = _shotBulletColor;

  // ── Card preview: animação de bala voando ─────────────────
  var _shotCardLoops = new Map();
  function _stopShotCardLoop(canvas){
    var obj=_shotCardLoops.get(canvas);
    if(obj){obj.active=false;if(obj.raf)cancelAnimationFrame(obj.raf);}
    _shotCardLoops.delete(canvas);
  }
  function _startShotCardLoop(canvas, shotId){
    _stopShotCardLoop(canvas);
    var W=canvas.width, H=canvas.height;
    var obj={active:true,raf:null};
    _shotCardLoops.set(canvas,obj);
    // bala virtual
    var bx=4, by=H/2, speed=W*1.8;
    var dirX=1, dirY=0;
    var particles=[], last=null;
    function frame(now){
      if(!obj.active) return;
      if(last===null) last=now;
      var dt=Math.min(0.05,(now-last)/1000); last=now;
      // mover bala
      bx += dirX*speed*dt;
      by += dirY*speed*dt;
      if(bx > W+6){ bx=4; by=H/2; particles=[]; }
      // spawn trail
      if(shotId>=0){
        var trail=_spawnShotTrail(shotId, bx, by, {x:dirX,y:dirY});
        // escalar para canvas pequeno
        var sc=W/80;
        for(var i=0;i<trail.length;i++){
          var tp=trail[i];
          tp.x=bx+(tp.x-bx)*sc; tp.y=by+(tp.y-by)*sc;
          tp.vx=(tp.vx||0)*sc; tp.vy=(tp.vy||0)*sc;
          tp.size=(tp.size||2)*sc; tp.grav=(tp.grav||0)*sc;
        }
        particles=particles.concat(trail);
      }
      // update
      var keep=[];
      for(var i=0;i<particles.length;i++){
        var p=particles[i]; p.life-=dt; if(p.life<=0) continue;
        p.vy=(p.vy||0)+(p.grav||0)*dt; p.x+=(p.vx||0)*dt; p.y+=p.vy*dt; keep.push(p);
      }
      particles=keep;
      // draw
      var ctx=canvas.getContext('2d');
      ctx.clearRect(0,0,W,H);
      // fundo areia do deserto
      ctx.fillStyle='#c8a95a'; ctx.fillRect(0,0,W,H);
      // trail
      for(var i=0;i<particles.length;i++){
        var p=particles[i];
        ctx.globalAlpha=Math.max(0,p.life/p.max)*0.85;
        ctx.fillStyle=p.color||'#fff';
        var sz=Math.max(1,p.size||2);
        ctx.fillRect(p.x-sz/2,p.y-sz/2,sz,sz);
      }
      ctx.globalAlpha=1;
      // bala — outline preto seletivo; Padrão menor no preview
      var _pbc=(shotId>=0)?_shotBulletColor(shotId):'#111';
      if(shotId===-1){
        // Padrão: bala menor só no preview
        ctx.fillStyle='#111'; ctx.fillRect(bx-1.5,by-1.5,3,3);
      } else {
        if(shotId===9||shotId===15||shotId===16){
          ctx.fillStyle='#111'; ctx.fillRect(bx-3,by-3,6,6);
        }
        ctx.fillStyle=_pbc; ctx.fillRect(bx-2,by-2,4,4);
      }
      obj.raf=requestAnimationFrame(frame);
    }
    obj.raf=requestAnimationFrame(frame);
  }

  // ── Render grid de efeitos de disparo ─────────────────────
  function renderProfileShots(){
    var grid=document.getElementById('profShotsGrid'); if(!grid) return;
    _stopCosmeticPreviewLoops(grid);
    grid.innerHTML='';
    var acc=acctLoad(), owned=new Set(acc.ownedShots||[]), eq=acc.equippedShot;
    var catalog=_getCosmeticCatalogEntries('shots', true, acc);
    var totalPages=Math.max(1, Math.ceil(catalog.length/SHOTS_PER_PAGE));
    if(_shotPage>=totalPages) _shotPage=Math.max(0,totalPages-1);
    var start=_shotPage*SHOTS_PER_PAGE, end=Math.min(start+SHOTS_PER_PAGE,catalog.length);
    for(var i=start;i<end;i++){
      (function(item){
        var shot=item.data;
        var isNone=(shot.id===-1);
        var isOwned=isNone||owned.has(shot.id), isEq=(eq===shot.id);
        var card=document.createElement('div'); card.className='prof-shot-card'+(isEq?' equipped':'');
        var cvs=document.createElement('canvas'); cvs.width=48; cvs.height=28;
        var nm=document.createElement('div'); nm.className='shot-name'; nm.textContent=shot.name;
        var btn=document.createElement('button'); btn.className='shot-btn';
        if(isEq){
          btn.textContent='Equipado'; btn.disabled=true; btn.className='shot-btn btn-equipped';
        } else if(isOwned){
          btn.textContent='Equipar'; btn.className='shot-btn btn-equip';
          btn.onclick=function(e){ e.stopPropagation(); _equipShot(shot.id); };
        } else {
          btn.textContent=shot.cost+' Ouro'; btn.className='shot-btn btn-buy';
          btn.onclick=function(e){ e.stopPropagation(); _buyShot(shot.id); };
        }
        card.appendChild(cvs); card.appendChild(nm); card.appendChild(btn);
        grid.appendChild(card);
        _startShotCardLoop(cvs, shot.id);
      })(catalog[i]);
    }
    for(var fi=end-start;fi<SHOTS_PER_PAGE;fi++){
      var ph=document.createElement('div'); ph.style.visibility='hidden'; grid.appendChild(ph);
    }
    var lbl=document.getElementById('profShotPgLabel'); if(lbl) lbl.textContent=(_shotPage+1)+' / '+totalPages;
    var pp=document.getElementById('profShotPgPrev'); if(pp) pp.disabled=(_shotPage===0);
    var pn=document.getElementById('profShotPgNext'); if(pn) pn.disabled=(_shotPage>=totalPages-1);
  }

  window._profChangeShotPage=function(d){
    var tp=Math.max(1, Math.ceil(_getCosmeticCatalogEntries('shots', true).length/SHOTS_PER_PAGE));
    _shotPage=Math.max(0,Math.min(tp-1,_shotPage+d));
    renderProfileShots();
  };

  function _buyShot(id){
    var shot=null; for(var i=0;i<SHOT_EFFECTS.length;i++){if(SHOT_EFFECTS[i].id===id){shot=SHOT_EFFECTS[i];break;}} if(!shot||id===-1) return;
    var acc=acctLoad();
    if(acc.coins<shot.cost){ _profSkinToast('Ouro insuficiente', true); try{window._gameBeep(180,0.09,'sawtooth',0.07);}catch(_){} return; }
    acc.coins-=shot.cost;
    if(!acc.ownedShots.includes(id)) acc.ownedShots.push(id);
    acc.equippedShot=id; acctSave(acc);
    if(typeof state!=='undefined'&&state) state.equippedShot=id;
    _profSndBuy();
    _profSkinToast('Efeito desbloqueado e equipado!', false);
    refreshMenu();
    renderProfileShots();
    _refreshCosmeticStoreIfOpen();
  }

  function _equipShot(id){
    var acc=acctLoad(); acc.equippedShot=id; acctSave(acc);
    if(typeof state!=='undefined'&&state) state.equippedShot=id;
    _profSndEquip();
    _profSkinToast('Efeito equipado!', false);
    renderProfileShots();
    _refreshCosmeticStoreIfOpen();
  }

  // ── Preview animado no canvas do card ─────────────────────────
  var _auraCardLoops = new Map(); // canvas -> {active, raf}

  function _startAuraCardLoop(canvas, auraId){
    _stopAuraCardLoop(canvas);
    var particles=[], t=0, last=null, acc=0;
    var W=canvas.width, H=canvas.height;
    var largePreview = W >= 120 && H >= 120;
    var spritePx = largePreview ? 96 : W;
    var S=spritePx/32;
    var ox=(W-spritePx)/2;
    var oy=(H-spritePx)/2;
    var cx=ox+spritePx/2, cy=oy+spritePx/2+2;
    var obj={active:true, raf:null};
    _auraCardLoops.set(canvas, obj);

    function frame(now){
      if(!obj.active) return;
      if(last===null) last=now;
      var dt=Math.min(0.05,(now-last)/1000); last=now; t+=dt; acc+=dt;
      // spawn
      var interval=[1,6,11,14].indexOf(auraId)>=0?0.13:0.09;
      if(acc>interval){ acc=0;
        var _csc=S;
        var np=_spawnAuraParticles(auraId,cx,cy,t);
        for(var _ci=0;_ci<np.length;_ci++){
          var _cp=np[_ci];
          _cp.x = cx + (_cp.x - cx)*_csc;
          _cp.y = cy + (_cp.y - cy)*_csc;
          _cp.vx = (_cp.vx||0)*_csc;
          _cp.vy = (_cp.vy||0)*_csc;
          _cp.grav = (_cp.grav||0)*_csc;
          _cp.size = (_cp.size||2)*_csc;
        }
        particles=particles.concat(np);
      }
      // update
      var keep=[];
      for(var i=0;i<particles.length;i++){
        var p=particles[i]; p.life-=dt; if(p.life<=0) continue;
        p.vy=(p.vy||0)+(p.grav||0)*dt; p.x+=(p.vx||0)*dt; p.y+=p.vy*dt; keep.push(p);
      }
      particles=keep;
      // draw bg + cowboy
      var ctx2=canvas.getContext('2d');
      ctx2.clearRect(0,0,W,H);
      ctx2.globalAlpha=1;
      var accD=acctLoad(), sk=PROFILE_SKINS[accD.equippedSkin||0]||PROFILE_SKINS[0];
      ctx2.fillStyle='rgba(0,0,0,0.28)'; ctx2.fillRect(ox+6*S,oy+(32-8)*S,20*S,4*S);
      ctx2.fillStyle=sk.body; ctx2.fillRect(ox+8*S,oy+8*S,16*S,16*S);
      ctx2.fillStyle=sk.hat;  ctx2.fillRect(ox+6*S,oy+6*S,20*S,6*S);
      ctx2.fillStyle=sk.hat;  ctx2.fillRect(ox+4*S,oy+10*S,24*S,4*S);
      ctx2.fillStyle='#111';  ctx2.fillRect(ox+14*S,oy+16*S,2*S,2*S);
      ctx2.fillStyle='#111';  ctx2.fillRect(ox+16*S,oy+16*S,2*S,2*S);
      // draw particles
      for(var i=0;i<particles.length;i++){
        var p=particles[i];
        ctx2.globalAlpha=Math.max(0,p.life/p.max);
        ctx2.fillStyle=p.color||'#fff'; var sz=p.size||2;
        ctx2.fillRect(p.x-sz/2,p.y-sz/2,sz,sz);
      }
      ctx2.globalAlpha=1;
      obj.raf=requestAnimationFrame(frame);
    }
    obj.raf=requestAnimationFrame(frame);
  }

  function _stopAuraCardLoop(canvas){
    var obj=_auraCardLoops.get(canvas);
    if(obj){obj.active=false;if(obj.raf)cancelAnimationFrame(obj.raf);}
    _auraCardLoops.delete(canvas);
  }

  // ── Preview principal (profPreviewCanvas) com aura animada ────
  var _mainAuraLoop = null; // {active, raf}
  var _mainAuraParticles = [];
  var _mainAuraT = 0;
  var _mainAuraLast = null;
  var _mainAuraAcc = 0;

  function _refreshMainPreview(){
    if(_mainAuraLoop){ _mainAuraLoop.active=false; if(_mainAuraLoop.raf)cancelAnimationFrame(_mainAuraLoop.raf); _mainAuraLoop=null; }
    _mainAuraParticles=[]; _mainAuraT=0; _mainAuraLast=null; _mainAuraAcc=0;
    var canvas=document.getElementById('profPreviewCanvas'); if(!canvas) return;
    var acc2=acctLoad(), sk=PROFILE_SKINS[acc2.equippedSkin||0]||PROFILE_SKINS[0];
    var auraId=acc2.equippedAura;
    if(auraId<0){
      // sem aura: só desenha cowboy estático
      drawSkinMini(canvas, sk.body, sk.hat);
      return;
    }
    var W=canvas.width, H=canvas.height, S=W/32, cx=W/2, cy=H/2+2;
    var obj={active:true, raf:null};
    _mainAuraLoop=obj;
    function frame(now){
      if(!obj.active) return;
      if(_mainAuraLast===null) _mainAuraLast=now;
      var dt=Math.min(0.05,(now-_mainAuraLast)/1000); _mainAuraLast=now;
      _mainAuraT+=dt; _mainAuraAcc+=dt;
      if(_mainAuraAcc>0.09){
        _mainAuraAcc=0;
        var _sc=S;
        var np=_spawnAuraParticles(auraId,cx,cy,_mainAuraT);
        for(var _ni=0;_ni<np.length;_ni++){
          var _np=np[_ni];
          _np.x = cx + (_np.x - cx)*_sc;
          _np.y = cy + (_np.y - cy)*_sc;
          _np.vx = (_np.vx||0)*_sc;
          _np.vy = (_np.vy||0)*_sc;
          _np.grav = (_np.grav||0)*_sc;
          _np.size = (_np.size||2)*_sc;
        }
        _mainAuraParticles=_mainAuraParticles.concat(np);
      }
      var keep=[];
      for(var i=0;i<_mainAuraParticles.length;i++){
        var p=_mainAuraParticles[i]; p.life-=dt; if(p.life<=0) continue;
        p.vy=(p.vy||0)+(p.grav||0)*dt; p.x+=(p.vx||0)*dt; p.y+=p.vy*dt; keep.push(p);
      }
      _mainAuraParticles=keep;
      var ctx2=canvas.getContext('2d'), acc3=acctLoad(), sk2=PROFILE_SKINS[acc3.equippedSkin||0]||PROFILE_SKINS[0];
      ctx2.clearRect(0,0,W,H); ctx2.globalAlpha=1;
      ctx2.fillStyle='rgba(0,0,0,0.28)'; ctx2.fillRect(6*S,(32-8)*S,20*S,4*S);
      ctx2.fillStyle=sk2.body; ctx2.fillRect(8*S,8*S,16*S,16*S);
      ctx2.fillStyle=sk2.hat;  ctx2.fillRect(6*S,6*S,20*S,6*S);
      ctx2.fillStyle=sk2.hat;  ctx2.fillRect(4*S,10*S,24*S,4*S);
      ctx2.fillStyle='#111';   ctx2.fillRect(14*S,16*S,2*S,2*S);
      ctx2.fillStyle='#111';   ctx2.fillRect(16*S,16*S,2*S,2*S);
      for(var i=0;i<_mainAuraParticles.length;i++){
        var p=_mainAuraParticles[i];
        ctx2.globalAlpha=Math.max(0,p.life/p.max);
        ctx2.fillStyle=p.color||'#fff'; var sz=p.size||2;
        ctx2.fillRect(p.x-sz/2,p.y-sz/2,sz,sz);
      }
      ctx2.globalAlpha=1;
      obj.raf=requestAnimationFrame(frame);
    }
    obj.raf=requestAnimationFrame(frame);
  }

  // ── Render grid de auras ──────────────────────────────────────
  function renderProfileAuras(){
    var grid=document.getElementById('profAurasGrid'); if(!grid) return;
    _stopCosmeticPreviewLoops(grid);
    grid.innerHTML='';
    var acc4=acctLoad(), owned=new Set(acc4.ownedAuras||[]), eq=acc4.equippedAura;
    var catalog=_getCosmeticCatalogEntries('auras', true, acc4);
    var totalPages=Math.max(1, Math.ceil(catalog.length/AURAS_PER_PAGE));
    if(_auraPage>=totalPages) _auraPage=Math.max(0,totalPages-1);
    var start=_auraPage*AURAS_PER_PAGE, end=Math.min(start+AURAS_PER_PAGE,catalog.length);
    for(var i=start;i<end;i++){
      (function(item){
        var aura=item.data;
        var isNone=(aura.id===-1);
        var isOwned=isNone||owned.has(aura.id), isEq=(eq===aura.id);
        var card=document.createElement('div');
        card.className='prof-aura-card'+(isEq?' equipped':'');
        var cvs=document.createElement('canvas'); cvs.width=48; cvs.height=48;
        var nm=document.createElement('div'); nm.className='aura-name'; nm.textContent=aura.name;
        var btn=document.createElement('button'); btn.className='aura-btn';
        if(isEq){
          btn.textContent='Equipada'; btn.disabled=true; btn.className='aura-btn btn-equipped';
        } else if(isOwned){
          btn.textContent='Equipar'; btn.className='aura-btn btn-equip';
          btn.onclick=function(e){ e.stopPropagation(); _equipAura(aura.id); };
        } else {
          btn.textContent=aura.cost+' Ouro'; btn.className='aura-btn btn-buy';
          btn.onclick=function(e){ e.stopPropagation(); _buyAura(aura.id); };
        }
        card.appendChild(cvs); card.appendChild(nm); card.appendChild(btn);
        grid.appendChild(card);
        if(isNone){
          // preview estático do cowboy sem aura
          var acc4n=acctLoad(), skN=PROFILE_SKINS[acc4n.equippedSkin||0]||PROFILE_SKINS[0];
          drawSkinMini(cvs, skN.body, skN.hat);
        } else {
          _startAuraCardLoop(cvs, aura.id);
        }
      })(catalog[i]);
    }
    // placeholders vazios para manter grid uniforme
    for(var fi=end-start;fi<AURAS_PER_PAGE;fi++){
      var ph=document.createElement('div'); ph.style.visibility='hidden'; grid.appendChild(ph);
    }
    var lbl=document.getElementById('profAuraPgLabel'); if(lbl) lbl.textContent=(_auraPage+1)+' / '+totalPages;
    var pp=document.getElementById('profAuraPgPrev'); if(pp) pp.disabled=(_auraPage===0);
    var pn=document.getElementById('profAuraPgNext'); if(pn) pn.disabled=(_auraPage>=totalPages-1);
  }

  window._profChangeAuraPage=function(d){
    var tp=Math.max(1, Math.ceil(_getCosmeticCatalogEntries('auras', true).length/AURAS_PER_PAGE));
    _auraPage=Math.max(0,Math.min(tp-1,_auraPage+d));
    renderProfileAuras();
  };

  // ── Compra e equip ────────────────────────────────────────────
  function _buyAura(id){
    if(id===-1){ _equipAura(-1); return; }
    var aura=null; for(var i=0;i<AURAS.length;i++){if(AURAS[i].id===id){aura=AURAS[i];break;}} if(!aura) return;
    var acc5=acctLoad();
    if(acc5.coins<aura.cost){ _profSkinToast('Ouro insuficiente',true); try{window._gameBeep(180,0.09,'sawtooth',0.07);}catch(_){} return; }
    acc5.coins-=aura.cost;
    if(!acc5.ownedAuras) acc5.ownedAuras=[];
    if(!acc5.ownedAuras.includes(id)) acc5.ownedAuras.push(id);
    acc5.equippedAura=id; acctSave(acc5);
    if(typeof state!=='undefined'&&state) state.equippedAura=id;
    _profSndBuy(); _profFlashPreview();
    _profSkinToast('Aura desbloqueada e equipada!',false);
    var e2=document.getElementById('profCoinsLabel'); if(e2) e2.textContent=acc5.coins.toLocaleString('pt-BR')+' Ouro';
    _refreshMainPreview();
    renderProfileAuras();
    _refreshCosmeticStoreIfOpen();
  }

  function _equipAura(id){
    var acc6=acctLoad(); acc6.equippedAura=id; acctSave(acc6);
    if(typeof state!=='undefined'&&state) state.equippedAura=id;
    _profSndEquip(); _profFlashPreview();
    _profSkinToast('Aura equipada!',false);
    _refreshMainPreview();
    renderProfileAuras();
    _refreshCosmeticStoreIfOpen();
  }

  // Renderiza sprite idêntico ao do jogo (escala de TILE=32)
  function drawSkinMini(canvas, body, hat){
    var ctx=canvas.getContext('2d'), w=canvas.width, h=canvas.height, s=w/32;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='rgba(0,0,0,0.30)'; ctx.fillRect(6*s,(32-8)*s,20*s,4*s); // sombra
    ctx.fillStyle=body; ctx.fillRect(8*s,8*s,16*s,16*s);                    // corpo
    ctx.fillStyle=hat;  ctx.fillRect(6*s,6*s,20*s,6*s);                     // aba chapeu
    ctx.fillStyle=hat;  ctx.fillRect(4*s,10*s,24*s,4*s);                    // borda chapeu
    ctx.fillStyle='#111'; ctx.fillRect(14*s,16*s,2*s,2*s);                  // olho esq
    ctx.fillStyle='#111'; ctx.fillRect(16*s,16*s,2*s,2*s);                  // olho dir
  }

  function _profSkinToast(msg, isErr){
    var t=document.getElementById('_profToastEl');
    if(!t){ t=document.createElement('div'); t.id='_profToastEl';
      t.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:36px;z-index:10000;padding:9px 18px;border-radius: 12px;font-size:13px;font-weight:800;pointer-events:none;letter-spacing:.03em;white-space:nowrap;transition:opacity 0.3s ease;opacity:0;';
      document.body.appendChild(t); }
    t.style.background=isErr?'rgba(100,15,15,0.96)':'rgba(15,60,15,0.96)';
    t.style.border=isErr?'1px solid #c04040':'1px solid #40b040';
    t.style.color=isErr?'#ffb0a0':'#a0ffb0';
    t.style.boxShadow=isErr?'0 4px 16px rgba(180,0,0,0.4)':'0 4px 16px rgba(0,150,0,0.3)';
    t.textContent=msg;
    clearTimeout(t._t1); clearTimeout(t._t2);
    t._t1=setTimeout(function(){ t.style.opacity='1'; },10);
    t._t2=setTimeout(function(){ t.style.opacity='0'; },2300);
  }

  function _profSndBuy(){
    try{ window._gameBeep(440,0.05,'sine',0.04); }catch(_){}
    setTimeout(function(){ try{ window._gameBeep(660,0.07,'sine',0.06); }catch(_){}},80);
    setTimeout(function(){ try{ window._gameBeep(880,0.10,'triangle',0.08); }catch(_){}},160);
    setTimeout(function(){ try{ window._gameBeep(1320,0.14,'triangle',0.10); }catch(_){}},260);
  }
  function _profSndEquip(){
    try{ window._gameBeep(660,0.06,'triangle',0.05); }catch(_){}
    setTimeout(function(){ try{ window._gameBeep(880,0.08,'triangle',0.07); }catch(_){}},90);
    setTimeout(function(){ try{ window._gameBeep(1100,0.11,'triangle',0.09); }catch(_){}},180);
  }

  // Expor toasts/sons do Perfil para reutilizar in-game
  window._profSkinToast = _profSkinToast;
  window._profSndBuy = _profSndBuy;
  window._profSndEquip = _profSndEquip;
  function _profFlashPreview(){
    var c=document.getElementById('profPreviewCanvas'); if(!c) return;
    c.style.transition='filter 0.12s, box-shadow 0.12s';
    c.style.filter='brightness(2.5) saturate(1.8)';
    c.style.boxShadow='0 0 16px 4px rgba(243,210,59,0.7)';
    setTimeout(function(){ c.style.filter='brightness(1.1)'; c.style.boxShadow='0 0 6px rgba(243,210,59,0.3)'; },150);
    setTimeout(function(){ c.style.filter=''; c.style.boxShadow=''; },380);
  }

  var _profPage=0;
  var PROF_PER_PAGE=6;

  function renderProfileSkins(){
    var grid=document.getElementById('profSkinsGrid'); if(!grid) return;
    var acc=acctLoad(), owned=new Set(acc.skins||[0]), eq=acc.equippedSkin||0;
    var catalog=_getCosmeticCatalogEntries('skins', true, acc);
    var totalPages=Math.max(1, Math.ceil(catalog.length/PROF_PER_PAGE));
    if(_profPage>=totalPages) _profPage=Math.max(0,totalPages-1);
    var start=_profPage*PROF_PER_PAGE, end=Math.min(start+PROF_PER_PAGE,catalog.length);
    grid.innerHTML='';
    for(var si=start;si<end;si++){
      (function(item){
        var idx=item.id;
        var sk=PROFILE_SKINS[idx], unlocked=owned.has(idx), isEq=(eq===idx);
        var card=document.createElement('div');
        card.className='prof-skin-card'+(isEq?' equipped':'');
        var cvs=document.createElement('canvas'); cvs.width=48; cvs.height=48;
        cvs.style.cssText='image-rendering:pixelated;border-radius:5px;background:#0e0804;display:block;';
        drawSkinMini(cvs,sk.body,sk.hat);
        var nm=document.createElement('div'); nm.className='skin-name'; nm.textContent=sk.name;
        var bt=document.createElement('button'); bt.className='skin-btn';
        if(isEq){
          bt.textContent='Equipada'; bt.disabled=true; bt.className='skin-btn btn-equipped';
        } else if(unlocked){
          bt.textContent='Equipar'; bt.className='skin-btn btn-equip';
          bt.onclick=function(e){ e.stopPropagation(); _equipSkin(idx); };
        } else {
          bt.textContent=sk.cost+' Ouro'; bt.className='skin-btn btn-buy';
          bt.onclick=function(e){ e.stopPropagation(); _buySkin(idx); };
        }
        card.appendChild(cvs); card.appendChild(nm); card.appendChild(bt);
        grid.appendChild(card);
      })(catalog[si]);
    }
    // placeholders
    for(var fi=end-start;fi<PROF_PER_PAGE;fi++){
      var ph=document.createElement('div'); ph.style.visibility='hidden'; grid.appendChild(ph);
    }
    var lbl=document.getElementById('profPgLabel'); if(lbl) lbl.textContent=(_profPage+1)+' / '+totalPages;
    var pp=document.getElementById('profPgPrev'); if(pp) pp.disabled=(_profPage===0);
    var pn=document.getElementById('profPgNext'); if(pn) pn.disabled=(_profPage>=totalPages-1);
    // Preview
    var big=document.getElementById('profPreviewCanvas'), sk2=PROFILE_SKINS[eq]||PROFILE_SKINS[0];
    if(big) drawSkinMini(big,sk2.body,sk2.hat);
    var nl=document.getElementById('profPreviewName'); if(nl) nl.textContent=sk2.name;
  }

  window._profChangePage=function(d){
    var t=Math.max(1, Math.ceil(_getCosmeticCatalogEntries('skins', true).length/PROF_PER_PAGE));
    _profPage=Math.max(0,Math.min(t-1,_profPage+d));
    renderProfileSkins();
  };
  
  function _profOpenShopHome(){
    var ps=document.getElementById('profileScreen');
    var home=document.getElementById('profShopHome');
    if(ps){ ps.classList.remove('prof-skins-full'); ps.classList.remove('prof-auras-full'); ps.classList.remove('prof-shots-full'); ps.classList.remove('prof-golds-full'); ps.classList.remove('prof-kills-full'); ps.classList.remove('prof-names-full'); }
    if(home){ home.style.display='flex'; home.style.flexDirection='column'; }
    try{ _refreshProfileCollectionCounts(); }catch(_){}
    try{ _stopCosmeticPreviewLoops(document.getElementById('profileScreen')); }catch(_){}
    try{ _refreshMainPreview(); }catch(_){}
  }

  function _profOpenGolds(){
    var ps=document.getElementById('profileScreen');
    var home=document.getElementById('profShopHome');
    if(ps){ ps.classList.remove('prof-skins-full'); ps.classList.remove('prof-auras-full'); ps.classList.remove('prof-shots-full'); ps.classList.remove('prof-names-full'); ps.classList.add('prof-golds-full'); }
    if(home) home.style.display='none';
    _goldPage=0;
    renderProfileGolds();
  }
  function _profOpenShots(){
    var ps=document.getElementById('profileScreen');
    var home=document.getElementById('profShopHome');
    if(ps){ ps.classList.remove('prof-skins-full'); ps.classList.remove('prof-auras-full'); ps.classList.remove('prof-golds-full'); ps.classList.remove('prof-names-full'); ps.classList.add('prof-shots-full'); }
    if(home) home.style.display='none';
    _shotPage=0;
    renderProfileShots();
  }
  function _profOpenAuras(){
    var ps=document.getElementById('profileScreen');
    var home=document.getElementById('profShopHome');
    if(ps){ ps.classList.remove('prof-skins-full'); ps.classList.remove('prof-shots-full'); ps.classList.remove('prof-golds-full'); ps.classList.remove('prof-names-full'); ps.classList.add('prof-auras-full'); }
    if(home) home.style.display='none';
    // deixa o CSS controlar a visibilidade via classes
    _auraPage=0;
    renderProfileAuras();
  }
  function _profOpenSkins(){
    var ps=document.getElementById('profileScreen');
    var home=document.getElementById('profShopHome');
    if(ps){ ps.classList.remove('prof-auras-full'); ps.classList.remove('prof-shots-full'); ps.classList.remove('prof-golds-full'); ps.classList.remove('prof-names-full'); ps.classList.add('prof-skins-full'); }
    if(home) home.style.display='none';
    // deixa o CSS controlar a visibilidade via classes
    renderProfileSkins();
  }

window._profShowTab=function(tab){
    var sp=document.getElementById('profShopPanel'), cs=document.getElementById('profComingSoon');
    var tL=document.getElementById('profTabLoja'), tE=document.getElementById('profTabEmBreve');
    if(tab==='loja'){
      if(sp){sp.className='open';} if(cs){cs.className='';}
      _profOpenShopHome();
      if(tL) tL.classList.add('active'); if(tE) tE.classList.remove('active');
    } else {
      if(sp){sp.className='';} if(cs){cs.className='open';}
      _profOpenShopHome();
      if(tE) tE.classList.add('active'); if(tL) tL.classList.remove('active');
    }
  };

  function _buySkin(idx){
    var sk=PROFILE_SKINS[idx]; if(!sk) return;
    var acc=acctLoad();
    if(sk.cost>0){
      if(acc.coins<sk.cost){
        _profSkinToast('Ouro insuficiente', true);
        try{ window._gameBeep(180,0.09,'sawtooth',0.07); }catch(_){}
        return;
      }
      acc.coins-=sk.cost;
    }
    if(!acc.skins.includes(idx)) acc.skins.push(idx);
    acc.equippedSkin=idx; acctSave(acc);
    if(typeof state!=='undefined'&&state){ state.currentSkin=idx; if(state.unlockedSkins) state.unlockedSkins.add(idx); }
    _profSndBuy(); _profFlashPreview();
    _profSkinToast('Skin desbloqueada e equipada!', false);
    refreshMenu();
    // Permanece na aba de skins (não volta para o home)
    try{ renderProfileSkins(); }catch(_){ }
    try{ _refreshMainPreview(); }catch(_){ }
    _refreshCosmeticStoreIfOpen();

  }

  function _equipSkin(idx){
    var acc=acctLoad(); acc.equippedSkin=idx; acctSave(acc);
    if(typeof state!=='undefined'&&state){ state.currentSkin=idx; if(state.unlockedSkins) state.unlockedSkins.add(idx); }
    _profSndEquip(); _profFlashPreview();
    _profSkinToast('Skin equipada!', false);
    refreshMenu();
    try{ _refreshMainPreview(); }catch(_){}
    _refreshCosmeticStoreIfOpen();
  }

  function _showProfile(){
    var ps=document.getElementById('profileScreen'); if(!ps) return;
    var ms=document.getElementById('menuScreen');
    if(ms){ ms.style.display='none'; ms.setAttribute('aria-hidden','true'); }
    // Esconde zoom — não usar cssText para não quebrar showGameLayer()
    var zw=document.getElementById('zoomWrap');
    if(zw){ zw.style.display='none'; zw.style.visibility='hidden'; zw.style.opacity='0'; zw.style.pointerEvents='none'; }
    document.body.setAttribute('data-profile-open','1');
    ps.style.display='flex';
    refreshMenu();
    try{ if(window._updateProfileNameCounter) window._updateProfileNameCounter(); }catch(_){ }
    try{ _refreshProfileCollectionCounts(); }catch(_){ }
    try{ _wireProfShopNav(); _refreshMainPreview(); }catch(_){}
  }
  function _hideProfile(){
    var ps=document.getElementById('profileScreen'); if(!ps) return;
    ps.style.display='none';
    try{ if(_mainAuraLoop){_mainAuraLoop.active=false;if(_mainAuraLoop.raf)cancelAnimationFrame(_mainAuraLoop.raf);_mainAuraLoop=null;} }catch(_){}
    try{ _stopCosmeticPreviewLoops(ps); }catch(_){}
    document.body.removeAttribute('data-profile-open');
    var ms=document.getElementById('menuScreen');
    if(ms){ ms.style.display='flex'; ms.setAttribute('aria-hidden','false'); }
    // Zoom fica oculto no menu (só showGameLayer() o restaura no jogo)
    var zw=document.getElementById('zoomWrap');
    if(zw){ zw.style.display='none'; zw.style.visibility='hidden'; zw.style.opacity='0'; zw.style.pointerEvents='none'; }
  }

  window._expSystem = {
    onGameOver: function(gs,r){ setTimeout(function(){ showResults(gs,r); },80); },
    refreshMenu: refreshMenu,
    _isLocked: function(){ return _gorLocked; },
    acctLoad: acctLoad
  };

  // ── Botões ───────────────────────────────────────────────────────

  function _gorDoRestart(){
    if(_gorLocked) return;
    _gorCancelPendingAnims();
    gorSetLocked(false);
    _gorChanceIdx = 0;
    var _p=document.getElementById('gameOverResults'); if(_p) _p.classList.remove('gor-visible');

    try{ document.body.removeAttribute('data-results-open'); }catch(_){ }
    try{
      ['shopBtn','menuBackBtn','pauseBtn','enemiesBtn','ingameOptBtn','p1ShopBtn','p2ShopBtn'].forEach(function(id){
        var b=document.getElementById(id); if(!b) return;
        b.disabled=false; try{b.setAttribute('aria-disabled','false');}catch(_){ }
        try{ b.style.pointerEvents=''; }catch(_){ }
        b.style.opacity=''; b.style.filter=''; b.style.cursor='';
      });
    }catch(_){ }

    try{
      var api = window.__defendaApi;
      if(api && api.getState){
        var st = api.getState();
        if(st && st.coop && api.resetGameCoop) api.resetGameCoop();
        else if(api.resetGame) api.resetGame();

        st = api.getState && api.getState();
        if(st){
          st.running=true; st.inMenu=false; st.pausedManual=false; st.pausedShop=false;
        }
        if(api.musicStop) api.musicStop();
        if(api.musicStart) api.musicStart();
      }
    }catch(_e){}
  }
  function _gorDoMenu(){
    if(_gorLocked) return;
    _gorCancelPendingAnims();
    gorSetLocked(false);
    _gorChanceIdx = 0;
    var _p=document.getElementById('gameOverResults'); if(_p) _p.classList.remove('gor-visible');

    try{
      var body=document.body;
      if(body){
        body.removeAttribute('data-results-open');
        body.removeAttribute('data-shop-open');
        body.removeAttribute('data-options-open');
        body.removeAttribute('data-confirm-open');
      }
    }catch(_){ }
    try{
      ['shopBtn','menuBackBtn','pauseBtn','enemiesBtn','ingameOptBtn','p1ShopBtn','p2ShopBtn'].forEach(function(id){
        var b=document.getElementById(id); if(!b) return;
        b.disabled=false; try{b.setAttribute('aria-disabled','false');}catch(_){ }
        try{ b.style.pointerEvents=''; }catch(_){ }
        try{ b.style.opacity=''; b.style.filter=''; b.style.cursor=''; }catch(_){ }
      });
    }catch(_){ }
    try{ if(window.__hudUnlockButtonsIfNoModal) window.__hudUnlockButtonsIfNoModal(); }catch(_){ }

    try{
      var api = window.__defendaApi;
      if(api && api.getState){
        if(api.resetGame) api.resetGame();
        var st = api.getState && api.getState();
        if(st){
          st.running=false; st.inMenu=true; st.pausedManual=false; st.coop=false; try{ delete st.player2; }catch(_){ }
        }
        try{ if (window.releaseCoopInputModeLock) window.releaseCoopInputModeLock(); }catch(_){ }
        if(api.musicStop) api.musicStop();
        if(api.showMenu) api.showMenu();
      }
    }catch(_e){}
  }

  // ─── Segunda Chance ─────────────────────────────────────────────
  // custo por uso dentro da mesma partida: 100 → 200 → 400 → 800 → 1000 (máx)
  var _gorChanceCosts = [100, 200, 400, 800, 1000];
  var _gorChanceIdx   = 0; // índice atual (aumenta a cada uso na partida)

  function _gorUpdateChanceBtn(){
    var btn  = document.getElementById('gorSecondChanceBtn');
    var span = document.getElementById('gorChanceCost');
    if (!btn) return;
    var cost = _gorChanceCosts[Math.min(_gorChanceIdx, _gorChanceCosts.length - 1)];
    if (span) span.textContent = cost;
    var acc = acctLoad();
    var canAfford = acc.coins >= cost;
    // Só mexe no disabled por saldo — o lock de animação é responsabilidade do gorSetLocked
    btn.disabled = !canAfford;
    btn.style.opacity = canAfford ? '1' : '0.38';
    btn.style.filter  = canAfford ? '' : 'grayscale(1)';
    btn.style.cursor  = canAfford ? 'pointer' : 'not-allowed';
    try{ btn.removeAttribute('title'); }catch(_){} 
  }

  function _gorDoSecondChance(){
    if (_gorLocked) return;
    _gorCancelPendingAnims();
    var cost = _gorChanceCosts[Math.min(_gorChanceIdx, _gorChanceCosts.length - 1)];
    var acc  = acctLoad();
    if (acc.coins < cost) return;

    // Deduz ouro da conta
    acc.coins -= cost;
    acctSave(acc);
    // Avança custo para a próxima vez (até o máximo)
    if (_gorChanceIdx < _gorChanceCosts.length - 1) _gorChanceIdx++;

    // ── Efeito sonoro grandioso ──
    try{
      var bip = window._gameBeep || (window._G && window._G.beep);
      if (bip){
        bip(440, 0.06, 'triangle', 0.07);
        setTimeout(function(){ bip(554, 0.07, 'triangle', 0.08); }, 80);
        setTimeout(function(){ bip(659, 0.09, 'triangle', 0.09); }, 170);
        setTimeout(function(){ bip(880, 0.14, 'triangle', 0.12); }, 270);
        setTimeout(function(){ bip(1100,0.18, 'triangle', 0.14); }, 390);
        setTimeout(function(){ bip(1320,0.22, 'sine',     0.18); }, 530);
      }
    }catch(_){}

    // ── Flash dourado na tela ──
    var flash = document.getElementById('gorChanceFlash');
    if (flash){
      flash.style.display = 'block';
      flash.style.animation = 'none';
      void flash.offsetWidth; // reflow
      flash.style.animation = 'gorFlashAnim 0.55s ease-out forwards';
      setTimeout(function(){ flash.style.display = 'none'; }, 600);
    }

    // ── Partículas douradas no canvas ──
    setTimeout(function(){
      try{
        var st = window.__defendaApi && window.__defendaApi.getState && window.__defendaApi.getState();
        if (st && st.fx && st.gold){
          var cx = st.gold.x * 32 + 16, cy = st.gold.y * 32 + 16;
          for (var i = 0; i < 40; i++){
            var ang = Math.random() * Math.PI * 2;
            var spd = 80 + Math.random() * 120;
            var life = 0.5 + Math.random() * 0.4;
            var cols = ['#f3d23b','#ffe066','#ffd700','#ffec80'];
            st.fx.push({
              x: cx + (Math.random()-0.5)*20,
              y: cy + (Math.random()-0.5)*20,
              vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd - 40,
              life: life, max: life,
              color: cols[Math.floor(Math.random()*cols.length)],
              size: 2.5 + Math.random()*2, grav: 120
            });
          }
        }
      }catch(_){ }
    }, 80);

    // ── Fechar tela de resultados e retomar jogo ──
    gorSetLocked(false);
    var _p = document.getElementById('gameOverResults');
    if (_p) _p.classList.remove('gor-visible');
    try{ document.body.removeAttribute('data-results-open'); }catch(_){}
    try{
      ['shopBtn','menuBackBtn','pauseBtn','enemiesBtn','ingameOptBtn','p1ShopBtn','p2ShopBtn'].forEach(function(id){
        var b=document.getElementById(id); if(!b) return;
        b.disabled=false;
        try{b.setAttribute('aria-disabled','false');}catch(_){}
        try{b.style.pointerEvents='';}catch(_){}
        b.style.opacity=''; b.style.filter=''; b.style.cursor='';
      });
    }catch(_){}

    // ── Restaurar 100 de vida no ouro e retomar ──
    try{
      var api = window.__defendaApi;
      if (api && api.getState){
        var st2 = api.getState();
        if (st2){
          // Restaura HP do ouro
          st2.gold.hp = Math.min(st2.gold.max, Math.max(st2.gold.hp || 0, 0) + 100);
          if (st2.gold.hp <= 0) st2.gold.hp = 100;
          // Restaura HP do jogador e dá invulnerabilidade de 3s
          if (st2.player){
            st2.player.hp = Math.min(st2.player.max || 100, (st2.player.hp || 0) + 100);
            if (st2.player.hp <= 0) st2.player.hp = 100;
          }
          st2.playerInvulT = 3.0; // invulnerabilidade similar à do ouro
          st2.dead1 = false;       // limpa estado de morto do singleplayer
          try{ delete st2._gorResultsShown; }catch(_){ st2._gorResultsShown = false; }
          // A partir daqui, ouro de conta só conta o progresso após este continuar
          st2.accountCoinsRewardWaveBase = Math.max(0, (st2.wave || 1) - 1);
          st2.accountCoinsRewardScoreBase = st2.score || 0;
          // Limpa estado de game over
          st2.gameOverReason = null;
          st2.gameOverFade   = 0;
          // Reativa o jogo
          st2.running      = true;
          st2.inMenu       = false;
          st2.pausedManual = false;
          st2.pausedShop   = false;
          // Invulnerabilidade breve ao ouro também
          st2.goldInvulT = 3.0;
          // Toast
          try{
            var tm = window._G && window._G.toastMsg;
            if (tm) tm('💛 Continuar! +100 vida ao ouro e ao cowboy');
          }catch(_){ }
          // Popup dourado flutuante no ouro
          try{
            var gx2 = st2.gold.x * 32 + 16, gy2 = st2.gold.y * 32 - 10;
            if (st2.multiPopups){
              st2.multiPopups.push({ text:'+100 ❤', x:gx2, y:gy2, vy:-38, life:1.1, max:1.1, color:'#f3d23b' });
            }
          }catch(_){ }
        }
        if (api.musicStart) api.musicStart();
      }
    }catch(_e){}

    // Atualiza HUD de ouro (label de moedas no perfil)
    try{
      var e = document.getElementById('profCoinsLabel');
      if(e){ var a2=acctLoad(); e.textContent=a2.coins.toLocaleString('pt-BR')+' Ouro'; }
    }catch(_){ }
  }

  var btnR = document.getElementById('gorContinueBtn');
  if(btnR) btnR.onclick = _gorDoRestart;

  var btnM = document.getElementById('gorMenuBtn');
  if(btnM) btnM.onclick = _gorDoMenu;

  var btnSC = document.getElementById('gorSecondChanceBtn');
  if(btnSC) btnSC.onclick = _gorDoSecondChance;

  // Perfil
  var _btnProf=document.getElementById('btnProfile'); if(_btnProf) _btnProf.onclick=_showProfile;
  var _btnProfBack=document.getElementById('btnProfileBack'); if(_btnProfBack) _btnProfBack.onclick=_hideProfile;

  // Navegação da Loja de Cosméticos (Perfil): Home -> Skins

  // ══════════════════════════════════════════════════════════════
  // ANIMAÇÕES DE ABATE
  // ══════════════════════════════════════════════════════════════
  var KILL_ANIMS = [
    // Página 1 — id:0 é Padrão (gratuito)
    {id:0,  name:'Padrão',       cost:0,    desc:'Nuvem de poeira com chapéu voando'},
    {id:1,  name:'Implosão',     cost:400,  desc:'Matéria colapsa em vórtice roxo'},
    {id:2,  name:'Cristal',      cost:500,  desc:'Estilhaços de vidro com reflexos'},
    {id:3,  name:'Chamas',       cost:600,  desc:'Coluna de fogo com brasas'},
    {id:4,  name:'Relâmpago',    cost:700,  desc:'Descarga elétrica em todas direções'},
    {id:5,  name:'Fantasma',     cost:800,  desc:'Alma esfumaçada sobe dos restos'},
    // Página 2
    {id:6,  name:'Confete',      cost:900,  desc:'Explosão festiva de cores'},
    {id:7,  name:'Gelo',         cost:1000, desc:'Estilhaços de gelo com anel gelado'},
    {id:8,  name:'Veneno',       cost:1100, desc:'Nuvem tóxica com bolhas verdes'},
    {id:9,  name:'Meteoro',      cost:1250, desc:'Impacto meteórico com cratera'},
    {id:10, name:'Divino',       cost:1600, desc:'Julgamento celestial com raios dourados'},
    {id:11, name:'Supernova',    cost:1850, desc:'Explosão estelar com anel expansivo'},
    // Página 3
    {id:12, name:'Massacre',     cost:2100, desc:'Sangue em todas as direções'},
    {id:13, name:'Tempestade',   cost:2400, desc:'Relâmpagos e vento violento'},
    {id:14, name:'Apocalipse',   cost:2700, desc:'Pilares de fogo, cinza e shockwave'},
    {id:15, name:'Transcendência',cost:3000,desc:'Ascensão em espiral de luz pura'},
    {id:17, name:'Buraco Negro', cost:3800, desc:'Singularidade que distorce espaço'},
    // Página 4
    {id:18, name:'Ritual',       cost:4200, desc:'Pentagrama e chamas demoníacas'},
    {id:19, name:'Blizzard',     cost:4600, desc:'Vendaval de cristais de neve'},
    {id:20, name:'Inferno',      cost:5000, desc:'Explosão total com shockwave duplo'},
    {id:21, name:'Glória',       cost:5500, desc:'Explosão sagrada de luz e ouro'},
  ];
  var KILLS_PER_PAGE = 6;
  var _killPage = 0;

  // Gera partículas de kill para preview (cx,cy = centro do canvas, big = false para preview)
  function _spawnKillParticles(id, cx, cy, big){
    var p=[], r=Math.random;
    var sc = big ? 1 : 0.52;
    switch(id){

      case 0: // Padrão — nuvem de poeira densa + detritos
        // nuvem principal de poeira em arco
        for(var i=0;i<(big?22:13);i++){
          var ang=r()*Math.PI*2, spd=(30+r()*55)*sc;
          var life=0.6+r()*0.4;
          p.push({x:cx+(r()-0.5)*4*sc,y:cy+(r()-0.5)*4*sc,
            vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-(15*sc),
            life:life,max:life,
            color:r()<0.3?'#c8a870':(r()<0.6?'#a07840':'#e0c090'),
            size:(3+r()*4)*sc,grav:30*sc,_type:'circle'});
        }
        // fragmentos sólidos
        for(var i=0;i<(big?10:6);i++){
          var ang=r()*Math.PI*2, spd=(40+r()*70)*sc;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-(20*sc),
            life:0.4+r()*0.3,max:0.55,
            color:r()<0.4?'#b91414':'#a7793a',
            size:(2+r()*2)*sc,grav:95*sc,_type:'sq'});
        }
        break;

      case 1: // Implosão — matéria colapsa, racha, explode ao centro
        // anel de partículas vindo de fora para dentro
        for(var i=0;i<(big?20:12);i++){
          var ang=i/(big?20:12)*Math.PI*2+r()*0.2;
          var dist=(24+r()*12)*sc;
          var spd=(70+r()*50)*sc;
          var life=0.4+r()*0.2;
          p.push({x:cx+Math.cos(ang)*dist,y:cy+Math.sin(ang)*dist,
            vx:-Math.cos(ang)*spd,vy:-Math.sin(ang)*spd,
            life:life,max:life,color:r()<0.4?'#cc44ff':(r()<0.7?'#8800cc':'#440088'),
            size:(2.5+r()*2.5)*sc,grav:0,_type:'sq'});
        }
        // partículas orbitando antes de colapsar
        for(var i=0;i<(big?12:7);i++){
          var ang=i/(big?12:7)*Math.PI*2;
          var dist2=(14+r()*6)*sc;
          p.push({x:cx+Math.cos(ang)*dist2,y:cy+Math.sin(ang)*dist2,
            vx:(Math.sin(ang)*35-Math.cos(ang)*55)*sc,
            vy:(-Math.cos(ang)*35-Math.sin(ang)*55)*sc,
            life:0.35,max:0.35,color:'#aa00ff',size:(2+r()*1.5)*sc,grav:0,_type:'sq'});
        }
        // flash branco central
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.15,max:0.15,color:'#ffffff',size:14*sc,grav:0,_type:'circle'});
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.25,max:0.25,color:'#cc00ff',size:8*sc,grav:0,_type:'circle'});
        // explosão pós-colapso
        for(var i=0;i<(big?10:6);i++){
          var ang=r()*Math.PI*2;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*(50+r()*60)*sc,vy:Math.sin(ang)*(50+r()*60)*sc,
            life:0.3+r()*0.2,max:0.4,color:r()<0.5?'#ffffff':'#dd88ff',
            size:(1.5+r()*2)*sc,grav:20*sc,_type:'sq'});
        }
        break;

      case 2: // Cristal — explosão de fragmentos angulares com reflexos de luz
        // fragmentos principais voando em todas direções
        for(var i=0;i<(big?24:14);i++){
          var ang=r()*Math.PI*2, spd=(40+r()*85)*sc;
          var life=0.45+r()*0.4;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-18*sc,
            life:life,max:life,
            color:r()<0.35?'#ffffff':(r()<0.6?'#cceeFF':(r()<0.8?'#88bbff':'#4499cc')),
            size:(2+r()*4)*sc,grav:65*sc,_type:'sq'});
        }
        // luz refletida — raios finos brancos
        for(var i=0;i<(big?12:7);i++){
          var ang=i/(big?12:7)*Math.PI*2;
          var spd2=(45+r()*55)*sc;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*spd2,vy:Math.sin(ang)*spd2,
            life:0.2+r()*0.1,max:0.25,color:'#eeffff',size:(1+r())*sc,grav:0,_type:'sq'});
        }
        // flash central azul-branco
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.12,max:0.12,color:'#ffffff',size:12*sc,grav:0,_type:'circle'});
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.2,max:0.2,color:'#aaddff',size:7*sc,grav:0,_type:'circle'});
        // micro-fragmentos cintilantes
        for(var i=0;i<(big?14:8);i++){
          var ang=r()*Math.PI*2, spd3=(20+r()*40)*sc;
          p.push({x:cx+(r()-0.5)*5*sc,y:cy+(r()-0.5)*5*sc,
            vx:Math.cos(ang)*spd3,vy:Math.sin(ang)*spd3-10*sc,
            life:0.3+r()*0.25,max:0.45,color:'#ffffff',
            size:(1+r()*1.5)*sc,grav:50*sc,_type:'sq'});
        }
        break;

      case 3: // Chamas — coluna de fogo com brasas voando
        // coluna central de fogo
        for(var i=0;i<(big?26:15);i++){
          var ox=(r()-0.5)*22*sc;
          var spd=(50+r()*80)*sc;
          var life=0.55+r()*0.45;
          p.push({x:cx+ox,y:cy+(r()*6)*sc,vx:(r()-0.5)*15*sc,vy:-spd,
            life:life,max:life,
            color:r()<0.25?'#ffffff':(r()<0.5?'#ffee00':(r()<0.75?'#ff7700':'#ff2200')),
            size:(2.5+r()*4)*sc,grav:-30*sc,_type:'sq'});
        }
        // brasas que voam para os lados e caem
        for(var i=0;i<(big?18:10);i++){
          var ang=(r()-0.5)*Math.PI*1.2 - Math.PI/2;
          var spd2=(30+r()*60)*sc;
          p.push({x:cx+(r()-0.5)*10*sc,y:cy,vx:Math.cos(ang)*spd2,vy:Math.sin(ang)*spd2,
            life:0.5+r()*0.4,max:0.7,
            color:r()<0.5?'#ff6600':'#ff9900',
            size:(1.5+r()*2)*sc,grav:120*sc,_type:'sq'});
        }
        // fumaça escura subindo atrás das chamas
        for(var i=0;i<(big?8:5);i++){
          p.push({x:cx+(r()-0.5)*18*sc,y:cy-(10+r()*8)*sc,
            vx:(r()-0.5)*12*sc,vy:-(20+r()*30)*sc,
            life:0.7+r()*0.3,max:0.9,color:r()<0.5?'#333333':'#555555',
            size:(5+r()*5)*sc,grav:-5*sc,_type:'circle'});
        }
        // flash laranja na base
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.1,max:0.1,color:'#ffcc00',size:15*sc,grav:0,_type:'circle'});
        break;

      case 4: // Relâmpago — descarga elétrica em 12 direções com ramificações
        for(var d=0;d<12;d++){
          var ang=d/12*Math.PI*2;
          var segs=5+Math.floor(r()*4);
          var ox=0,oy=0;
          for(var s=0;s<segs;s++){
            var jx=(r()-0.5)*10*sc, jy=(r()-0.5)*10*sc;
            var spd=(22+s*15)*sc;
            var life=0.2+s*0.05;
            p.push({x:cx+ox,y:cy+oy,
              vx:Math.cos(ang)*spd+jx,vy:Math.sin(ang)*spd+jy,
              life:life,max:life,
              color:s===0?'#ffffff':(s<3?'#88ffff':'#0066ff'),
              size:(3.5-s*0.4)*sc,grav:0,_type:'sq'});
            ox+=Math.cos(ang)*7*sc+(r()-0.5)*3*sc;
            oy+=Math.sin(ang)*7*sc+(r()-0.5)*3*sc;
            // ramificação aleatória
            if(s===2&&r()<0.5){
              var bAng=ang+(r()-0.5)*1.2;
              p.push({x:cx+ox,y:cy+oy,vx:Math.cos(bAng)*spd*0.7,vy:Math.sin(bAng)*spd*0.7,
                life:0.12,max:0.12,color:'#aaffff',size:2*sc,grav:0,_type:'sq'});
            }
          }
        }
        // flash branco/azul central
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.1,max:0.1,color:'#ffffff',size:16*sc,grav:0,_type:'circle'});
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.2,max:0.2,color:'#44ddff',size:9*sc,grav:0,_type:'circle'});
        break;

      case 5: // Fantasma — alma se destaca do corpo e sobe em espiral
        // forma fantasma principal — blob branco que sobe
        for(var i=0;i<(big?16:9);i++){
          var ox=(r()-0.5)*14*sc, oy=(r()-0.5)*10*sc;
          var life=0.8+r()*0.5;
          p.push({x:cx+ox,y:cy+oy,vx:(r()-0.5)*10*sc,vy:-(22+r()*28)*sc,
            life:life,max:life,
            color:r()<0.5?'rgba(200,220,255,0.8)':(r()<0.8?'rgba(180,200,255,0.6)':'rgba(255,255,255,0.5)'),
            size:(5+r()*5)*sc,grav:-10*sc,_type:'circle'});
        }
        // trilha de partículas subindo
        for(var i=0;i<(big?12:7);i++){
          p.push({x:cx+(r()-0.5)*8*sc,y:cy-(i*4)*sc,
            vx:(r()-0.5)*8*sc,vy:-(15+r()*20)*sc,
            life:0.4+r()*0.3,max:0.6,color:'rgba(220,235,255,0.7)',
            size:(2+r()*3)*sc,grav:-8*sc,_type:'circle'});
        }
        // olhos brilhantes
        p.push({x:cx-5*sc,y:cy-3*sc,vx:-2*sc,vy:-25*sc,life:0.7,max:0.7,color:'#000011',size:3*sc,grav:-10*sc,_type:'sq'});
        p.push({x:cx+5*sc,y:cy-3*sc,vx:2*sc,vy:-25*sc,life:0.7,max:0.7,color:'#000011',size:3*sc,grav:-10*sc,_type:'sq'});
        // resíduo no chão
        for(var i=0;i<(big?6:4);i++){
          p.push({x:cx+(r()-0.5)*12*sc,y:cy+4*sc,
            vx:(r()-0.5)*12*sc,vy:-(3+r()*8)*sc,
            life:0.5+r()*0.3,max:0.6,color:'rgba(150,180,220,0.4)',
            size:(3+r()*3)*sc,grav:5*sc,_type:'circle'});
        }
        break;

      case 6: // Confete — explosão festiva com tiras coloridas e círculos
        var cols6=['#ff4466','#44ff88','#4488ff','#ffdd00','#ff88ff','#00ffdd','#ff8800','#cc44ff'];
        for(var i=0;i<(big?32:18);i++){
          var ang=r()*Math.PI*2, spd=(35+r()*80)*sc;
          var life=0.65+r()*0.5;
          p.push({x:cx+(r()-0.5)*3*sc,y:cy+(r()-0.5)*3*sc,
            vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-22*sc,
            life:life,max:life,
            color:cols6[Math.floor(r()*cols6.length)],
            size:(1.5+r()*3.5)*sc,grav:85*sc,
            _type:r()<0.5?'sq':'circle'});
        }
        // tiras longas que voam
        for(var i=0;i<(big?10:6);i++){
          var ang=r()*Math.PI*2, spd2=(50+r()*60)*sc;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*spd2,vy:Math.sin(ang)*spd2-15*sc,
            life:0.5+r()*0.3,max:0.65,
            color:cols6[Math.floor(r()*cols6.length)],
            size:(1+r())*sc,grav:70*sc,_type:'sq'});
        }
        // flash branco central
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.08,max:0.08,color:'#ffffff',size:14*sc,grav:0,_type:'circle'});
        break;

      case 7: // Gelo — explosão criogênica com anel de escudo e lascas
        // lascas de gelo em todas direções
        for(var i=0;i<(big?24:14);i++){
          var ang=r()*Math.PI*2, spd=(30+r()*80)*sc;
          var life=0.5+r()*0.35;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,
            life:life,max:life,
            color:r()<0.4?'#ffffff':(r()<0.7?'#cceeFF':'#88bbdd'),
            size:(2+r()*4)*sc,grav:45*sc,_type:'sq'});
        }
        // anel expansivo de gelo
        for(var i=0;i<14;i++){
          var ang=i/14*Math.PI*2;
          var spd2=(50+r()*20)*sc;
          p.push({x:cx+Math.cos(ang)*6*sc,y:cy+Math.sin(ang)*6*sc,
            vx:Math.cos(ang)*spd2,vy:Math.sin(ang)*spd2,
            life:0.3+r()*0.1,max:0.35,color:i%2===0?'#aaddff':'#eeffff',
            size:(2.5+r())*sc,grav:0,_type:'sq'});
        }
        // neblina de frio
        for(var i=0;i<(big?8:5);i++){
          p.push({x:cx+(r()-0.5)*16*sc,y:cy+(r()-0.5)*8*sc,
            vx:(r()-0.5)*10*sc,vy:-(5+r()*15)*sc,
            life:0.6+r()*0.3,max:0.8,color:'rgba(180,220,255,0.4)',
            size:(6+r()*6)*sc,grav:-5*sc,_type:'circle'});
        }
        // flash central azul-branco
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.1,max:0.1,color:'#ffffff',size:13*sc,grav:0,_type:'circle'});
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.22,max:0.22,color:'#88ccff',size:8*sc,grav:0,_type:'circle'});
        break;

      case 8: // Veneno — nuvem tóxica densa com bolhas e respingos ácidos
        // bolhas tóxicas que sobem
        for(var i=0;i<(big?18:10);i++){
          var ox=(r()-0.5)*18*sc;
          var spd=(20+r()*45)*sc;
          var life=0.6+r()*0.5;
          p.push({x:cx+ox,y:cy+(r()-0.5)*4*sc,
            vx:(r()-0.5)*15*sc,vy:-spd,
            life:life,max:life,
            color:r()<0.4?'#44ff00':(r()<0.7?'#88ee22':'#22cc00'),
            size:(3.5+r()*4)*sc,grav:-18*sc,_type:'circle'});
        }
        // spray ácido para os lados
        for(var i=0;i<(big?16:9);i++){
          var ang=r()*Math.PI*2, spd2=(25+r()*55)*sc;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*spd2,vy:Math.sin(ang)*spd2-8*sc,
            life:0.35+r()*0.25,max:0.5,
            color:r()<0.5?'#aaff00':'#00ff44',
            size:(1.5+r()*2)*sc,grav:65*sc,_type:'circle'});
        }
        // nuvem de gás
        for(var i=0;i<(big?6:4);i++){
          p.push({x:cx+(r()-0.5)*10*sc,y:cy-(5+r()*10)*sc,
            vx:(r()-0.5)*12*sc,vy:-(8+r()*18)*sc,
            life:0.7+r()*0.4,max:1.0,color:'rgba(80,200,40,0.35)',
            size:(8+r()*8)*sc,grav:-8*sc,_type:'circle'});
        }
        // flash verde
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.1,max:0.1,color:'#aaffaa',size:12*sc,grav:0,_type:'circle'});
        break;

      case 9: // Meteoro — impacto com cratera, ejecção e rastro
        // rastro de entrada caindo de cima
        for(var i=0;i<(big?16:9);i++){
          var oy=(-30-r()*25)*sc;
          var spd=(60+r()*70)*sc;
          var life=0.35+r()*0.25;
          p.push({x:cx+(r()-0.5)*8*sc,y:cy+oy,
            vx:(r()-0.5)*15*sc,vy:spd,
            life:life,max:life,
            color:r()<0.35?'#ffffff':(r()<0.6?'#ff6600':'#ffaa00'),
            size:(2+r()*3)*sc,grav:90*sc,_type:'sq'});
        }
        // explosão de impacto — ejecção radial com gravidade
        for(var i=0;i<(big?24:14);i++){
          var ang=(r()-0.5)*Math.PI*1.6-Math.PI/2;
          var spd2=(40+r()*90)*sc;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*spd2,vy:Math.sin(ang)*spd2-20*sc,
            life:0.5+r()*0.35,max:0.7,
            color:r()<0.3?'#ffffff':(r()<0.6?'#ff4400':'#ff9900'),
            size:(2+r()*3.5)*sc,grav:110*sc,_type:'sq'});
        }
        // shockwave de impacto
        for(var i=0;i<12;i++){
          var ang=i/12*Math.PI*2;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*75*sc,vy:Math.sin(ang)*35*sc,
            life:0.18,max:0.18,color:'#ffcc44',size:3*sc,grav:0,_type:'sq'});
        }
        // flash do impacto
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.1,max:0.1,color:'#ffffff',size:18*sc,grav:0,_type:'circle'});
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.2,max:0.2,color:'#ff6600',size:11*sc,grav:0,_type:'circle'});
        break;

      case 10: // Divino — julgamento celestial: raios dourados do céu + halo
        // raios de luz descendo do alto em leque
        for(var i=0;i<(big?20:12);i++){
          var ox=(r()-0.5)*28*sc;
          var oy=(-35-r()*25)*sc;
          var spd=(50+r()*70)*sc;
          var life=0.55+r()*0.35;
          p.push({x:cx+ox,y:cy+oy,vx:(r()-0.5)*10*sc,vy:spd,
            life:life,max:life,
            color:r()<0.4?'#ffffff':(r()<0.7?'#ffee88':'#ffcc00'),
            size:(2+r()*3)*sc,grav:30*sc,_type:'sq'});
        }
        // halo dourado expandindo
        for(var i=0;i<16;i++){
          var ang=i/16*Math.PI*2;
          var spd2=(40+r()*25)*sc;
          p.push({x:cx+Math.cos(ang)*5*sc,y:cy-4*sc+Math.sin(ang)*5*sc,
            vx:Math.cos(ang)*spd2,vy:Math.sin(ang)*spd2-5*sc,
            life:0.4+r()*0.2,max:0.5,
            color:i%2===0?'#ffee00':'#ffffff',
            size:(2.5+r()*1.5)*sc,grav:0,_type:'sq'});
        }
        // poeira sagrada
        for(var i=0;i<(big?10:6);i++){
          p.push({x:cx+(r()-0.5)*20*sc,y:cy+(r()-0.5)*8*sc,
            vx:(r()-0.5)*15*sc,vy:-(10+r()*20)*sc,
            life:0.5+r()*0.4,max:0.75,color:'rgba(255,240,180,0.5)',
            size:(5+r()*5)*sc,grav:-8*sc,_type:'circle'});
        }
        // flash dourado central
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.12,max:0.12,color:'#ffffff',size:18*sc,grav:0,_type:'circle'});
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.25,max:0.25,color:'#ffcc00',size:11*sc,grav:0,_type:'circle'});
        break;

      case 11: // Supernova — anel expansivo + núcleo pulsante + fragmentos estelares
        // anel primário expansivo
        for(var i=0;i<20;i++){
          var ang=i/20*Math.PI*2;
          var spd=(60+r()*25)*sc;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,
            life:0.5+r()*0.15,max:0.55,
            color:i%3===0?'#ffffff':(i%3===1?'#ffee88':'#ff9900'),
            size:(3.5+r()*2)*sc,grav:0,_type:'sq'});
        }
        // anel secundário mais lento
        for(var i=0;i<14;i++){
          var ang=i/14*Math.PI*2+0.2;
          var spd2=(35+r()*15)*sc;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*spd2,vy:Math.sin(ang)*spd2,
            life:0.65+r()*0.2,max:0.7,
            color:r()<0.5?'#ff4400':'#ff8800',
            size:(2+r()*2)*sc,grav:0,_type:'sq'});
        }
        // núcleo branco pulsante
        for(var i=0;i<8;i++){
          var ang=r()*Math.PI*2, spd3=(5+r()*15)*sc;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*spd3,vy:Math.sin(ang)*spd3,
            life:0.3+r()*0.1,max:0.35,color:'#ffffff',size:(7-i*0.6)*sc,grav:0,_type:'circle'});
        }
        // fragmentos estelares voando longe
        for(var i=0;i<(big?18:10);i++){
          var ang=r()*Math.PI*2, spd4=(90+r()*70)*sc;
          var life4=0.45+r()*0.3;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*spd4,vy:Math.sin(ang)*spd4-12*sc,
            life:life4,max:life4,
            color:r()<0.4?'#ffffaa':r()<0.7?'#ffbb44':'#ff8800',
            size:(1.5+r()*2)*sc,grav:30*sc,_type:'sq'});
        }
        // flash central
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.1,max:0.1,color:'#ffffff',size:20*sc,grav:0,_type:'circle'});
        break;

      case 12: // Massacre — sangue em todas as direções, muito violento
        // explosão de sangue omnidirecional
        for(var i=0;i<(big?40:22);i++){
          var ang=r()*Math.PI*2, spd=(50+r()*110)*sc;
          var life=0.5+r()*0.5;
          p.push({x:cx+(r()-0.5)*3*sc,y:cy+(r()-0.5)*3*sc,
            vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-(15*sc),
            life:life,max:life,
            color:r()<0.5?'#cc0000':(r()<0.75?'#990000':'#ff1111'),
            size:(2+r()*4.5)*sc,grav:100*sc,_type:'circle'});
        }
        // jatos horizontais rápidos
        for(var i=0;i<(big?12:7);i++){
          var side=r()<0.5?-1:1;
          p.push({x:cx,y:cy+(r()-0.5)*6*sc,
            vx:side*(80+r()*100)*sc,vy:-(10+r()*30)*sc,
            life:0.25+r()*0.2,max:0.38,color:r()<0.6?'#dd0000':'#ff2200',
            size:(1.5+r()*2)*sc,grav:95*sc,_type:'circle'});
        }
        // sangue para cima alto
        for(var i=0;i<(big?10:6);i++){
          p.push({x:cx+(r()-0.5)*8*sc,y:cy,
            vx:(r()-0.5)*40*sc,vy:-(80+r()*100)*sc,
            life:0.6+r()*0.3,max:0.8,color:r()<0.5?'#cc0000':'#880000',
            size:(2.5+r()*3)*sc,grav:130*sc,_type:'circle'});
        }
        // poça no chão
        for(var i=0;i<(big?10:6);i++){
          p.push({x:cx+(r()-0.5)*22*sc,y:cy+5*sc,
            vx:(r()-0.5)*6*sc,vy:(2+r()*5)*sc,
            life:0.8+r()*0.4,max:1.0,color:r()<0.5?'#990000':'#770000',
            size:(2+r()*3)*sc,grav:0,_type:'circle'});
        }
        // flash vermelho central
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.08,max:0.08,color:'#ff4444',size:14*sc,grav:0,_type:'circle'});
        break;

      case 13: // Tempestade — vento + relâmpagos + detritos voando
        // raios em zigue-zague longos
        for(var d=0;d<6;d++){
          var ang=d/6*Math.PI*2;
          var segs3=6+Math.floor(r()*4);
          var ox=0,oy=0;
          for(var s3=0;s3<segs3;s3++){
            var jx3=(r()-0.5)*12*sc, jy3=(r()-0.5)*12*sc;
            var spd3=(25+s3*18)*sc;
            p.push({x:cx+ox,y:cy+oy,
              vx:Math.cos(ang)*spd3+jx3,vy:Math.sin(ang)*spd3+jy3,
              life:0.18+s3*0.06,max:0.3,
              color:s3<2?'#ffffff':(s3<4?'#ccffff':'#4488ff'),
              size:(3.5-s3*0.35)*sc,grav:0,_type:'sq'});
            ox+=Math.cos(ang)*8*sc+jx3*0.4;
            oy+=Math.sin(ang)*8*sc+jy3*0.4;
          }
        }
        // detritos voando com o vento (partículas horizontais)
        for(var i=0;i<(big?18:10);i++){
          var dir=r()<0.5?-1:1;
          p.push({x:cx+(r()-0.5)*10*sc,y:cy+(r()-0.5)*14*sc,
            vx:dir*(50+r()*80)*sc,vy:-(5+r()*25)*sc,
            life:0.4+r()*0.35,max:0.6,
            color:r()<0.4?'#cccccc':(r()<0.7?'#888888':'#aaaaaa'),
            size:(1.5+r()*2)*sc,grav:30*sc,_type:'sq'});
        }
        // nuvem escura de tempestade
        for(var i=0;i<(big?6:4);i++){
          p.push({x:cx+(r()-0.5)*20*sc,y:cy-(8+r()*15)*sc,
            vx:(r()-0.5)*20*sc,vy:-(5+r()*12)*sc,
            life:0.6+r()*0.4,max:0.9,color:'rgba(60,60,80,0.5)',
            size:(7+r()*7)*sc,grav:-3*sc,_type:'circle'});
        }
        // flash azul
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.09,max:0.09,color:'#ffffff',size:16*sc,grav:0,_type:'circle'});
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.18,max:0.18,color:'#8888ff',size:10*sc,grav:0,_type:'circle'});
        break;

      case 14: // Apocalipse — pilares de fogo + cinzas + shockwave duplo
        // 5 pilares de fogo em posições diferentes
        for(var col=0;col<5;col++){
          var ox3=(col-2)*13*sc;
          for(var i=0;i<(big?9:5);i++){
            var life6=0.65+r()*0.45;
            p.push({x:cx+ox3+(r()-0.5)*5*sc,y:cy+4*sc,
              vx:(r()-0.5)*14*sc,vy:-(45+r()*85)*sc,
              life:life6,max:life6,
              color:r()<0.2?'#ffffff':(r()<0.5?'#ffee00':(r()<0.75?'#ff6600':'#ff2200')),
              size:(3+r()*4)*sc,grav:-22*sc,_type:'sq'});
          }
        }
        // cinzas densos caindo de cima
        for(var i=0;i<(big?20:12);i++){
          p.push({x:cx+(r()-0.5)*50*sc,y:cy-(30+r()*20)*sc,
            vx:(r()-0.5)*22*sc,vy:(15+r()*35)*sc,
            life:0.75+r()*0.45,max:1.0,
            color:r()<0.4?'#888888':(r()<0.7?'#555555':'#aaaaaa'),
            size:(2+r()*3)*sc,grav:45*sc,_type:'sq'});
        }
        // shockwave primário
        for(var i=0;i<16;i++){
          var ang=i/16*Math.PI*2;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*100*sc,vy:Math.sin(ang)*45*sc,
            life:0.2,max:0.2,color:'#ffcc44',size:3.5*sc,grav:0,_type:'sq'});
        }
        // shockwave secundário (menor e mais lento)
        for(var i=0;i<12;i++){
          var ang=i/12*Math.PI*2+0.25;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*60*sc,vy:Math.sin(ang)*28*sc,
            life:0.3,max:0.3,color:'#ff8800',size:2.5*sc,grav:0,_type:'sq'});
        }
        // flash laranja massivo
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.1,max:0.1,color:'#ffffff',size:22*sc,grav:0,_type:'circle'});
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.22,max:0.22,color:'#ff8800',size:14*sc,grav:0,_type:'circle'});
        break;

      case 15: // Transcendência — ascensão em espiral de luz pura
        // espiral dupla subindo
        for(var i=0;i<(big?30:18);i++){
          var t3=i/(big?30:18);
          var ang5a=t3*Math.PI*5;
          var ang5b=t3*Math.PI*5+Math.PI;
          var r3=(4+t3*16)*sc;
          var life8=0.55+t3*0.6;
          p.push({x:cx+Math.cos(ang5a)*r3,y:cy+Math.sin(ang5a)*r3*0.35-(t3*20*sc),
            vx:Math.cos(ang5a+Math.PI/2)*25*sc*t3,vy:-(28+t3*75)*sc,
            life:life8,max:life8,
            color:i%4===0?'#ffffff':(i%4===1?'#aaddff':(i%4===2?'#ffddff':'#ffffaa')),
            size:(2+t3*3.5)*sc,grav:-18*sc,_type:'circle'});
          if(i<(big?15:9)){
            p.push({x:cx+Math.cos(ang5b)*r3*0.7,y:cy+Math.sin(ang5b)*r3*0.25-(t3*15*sc),
              vx:Math.cos(ang5b+Math.PI/2)*18*sc,vy:-(20+t3*55)*sc,
              life:life8*0.8,max:life8*0.8,color:'rgba(200,220,255,0.6)',
              size:(1.5+t3*2)*sc,grav:-12*sc,_type:'circle'});
          }
        }
        // coluna central de luz intensa
        for(var i=0;i<10;i++){
          p.push({x:cx+(r()-0.5)*3*sc,y:cy-(i*6)*sc,
            vx:(r()-0.5)*7*sc,vy:-(25+i*18)*sc,
            life:0.4+i*0.05,max:0.6,color:'#ffffff',
            size:(5.5-i*0.4)*sc,grav:-22*sc,_type:'circle'});
        }
        // estrelas que aparecem ao redor
        for(var i=0;i<(big?14:8);i++){
          var ang6=r()*Math.PI*2, dist3=(18+r()*22)*sc;
          p.push({x:cx+Math.cos(ang6)*dist3,y:cy+Math.sin(ang6)*dist3,
            vx:Math.cos(ang6)*12*sc,vy:-(15+r()*35)*sc,
            life:0.5+r()*0.45,max:0.8,
            color:r()<0.5?'#ffffcc':'#ffffff',
            size:(2.5+r()*2)*sc,grav:-5*sc,_type:'sq'});
        }
        // flash divino
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.12,max:0.12,color:'#ffffff',size:20*sc,grav:0,_type:'circle'});
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.28,max:0.28,color:'#ddeeff',size:12*sc,grav:0,_type:'circle'});
        break;

      case 16: // Desintegração — pixels se soltando e sumindo
        // grade de pixels voando
        for(var i=0;i<(big?32:18);i++){
          var ox=(r()-0.5)*20*sc, oy=(r()-0.5)*20*sc;
          var spd=(8+r()*55)*sc;
          var ang=r()*Math.PI*2;
          var life=0.5+r()*0.6;
          p.push({x:cx+ox,y:cy+oy,
            vx:Math.cos(ang)*spd+(ox*0.8),vy:Math.sin(ang)*spd+(oy*0.5),
            life:life,max:life,
            color:r()<0.3?'#4488ff':(r()<0.55?'#22ccff':(r()<0.75?'#ff4488':'#ffff44')),
            size:(2+r()*2)*sc,grav:10*sc,_type:'sq'});
        }
        // linhas de scan-glitch horizontais
        for(var i=0;i<8;i++){
          var yOff=(i-4)*4*sc;
          for(var j=0;j<(big?5:3);j++){
            var ox2=(r()-0.5)*24*sc;
            p.push({x:cx+ox2,y:cy+yOff,
              vx:(r()<0.5?-1:1)*(30+r()*50)*sc,vy:(r()-0.5)*5*sc,
              life:0.15+r()*0.2,max:0.3,
              color:r()<0.5?'#00ffff':'#ffffff',
              size:(1+r())*sc,grav:0,_type:'sq'});
          }
        }
        // flash digital
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.08,max:0.08,color:'#44ffff',size:16*sc,grav:0,_type:'circle'});
        break;

      case 17: // Buraco Negro — singularidade que puxa e distorce tudo
        // anel de singularidade — partículas em órbita decaindo rapidamente
        for(var i=0;i<(big?28:16);i++){
          var ang=i/(big?28:16)*Math.PI*2+r()*0.3;
          var dist=(28+r()*14)*sc;
          var spd=(80+r()*60)*sc;
          var life=0.6+r()*0.35;
          p.push({x:cx+Math.cos(ang)*dist,y:cy+Math.sin(ang)*dist,
            vx:(-Math.cos(ang)*spd*1.1+Math.sin(ang)*spd*0.8),
            vy:(-Math.sin(ang)*spd*1.1-Math.cos(ang)*spd*0.8),
            life:life,max:life,
            color:r()<0.3?'#000000':(r()<0.6?'#330044':'#660066'),
            size:(3+r()*3)*sc,grav:0,_type:'sq'});
        }
        // radiação Hawking — partículas escapando
        for(var i=0;i<(big?14:8);i++){
          var ang=r()*Math.PI*2;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*(30+r()*40)*sc,vy:Math.sin(ang)*(30+r()*40)*sc,
            life:0.2+r()*0.15,max:0.3,
            color:r()<0.5?'#ff00ff':'#ffffff',
            size:(1.5+r()*2)*sc,grav:0,_type:'sq'});
        }
        // anel de luz (evento horizon)
        for(var i=0;i<16;i++){
          var ang=i/16*Math.PI*2;
          p.push({x:cx+Math.cos(ang)*18*sc,y:cy+Math.sin(ang)*18*sc,
            vx:(-Math.cos(ang)*45+Math.sin(ang)*45)*sc,
            vy:(-Math.sin(ang)*45-Math.cos(ang)*45)*sc,
            life:0.25,max:0.25,color:i%2===0?'#ffffff':'#ff88ff',size:2.5*sc,grav:0,_type:'sq'});
        }
        // núcleo negro absoluto
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.5,max:0.5,color:'#000000',size:12*sc,grav:0,_type:'circle'});
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.12,max:0.12,color:'#ff00ff',size:18*sc,grav:0,_type:'circle'});
        break;

      case 18: // Ritual — pentagrama e chamas demoníacas vermelhas
        // 5 pontas do pentagrama — partículas nos vértices
        for(var v=0;v<5;v++){
          var ang=v/5*Math.PI*2-Math.PI/2;
          var px=cx+Math.cos(ang)*16*sc, py=cy+Math.sin(ang)*16*sc;
          // chama em cada ponta
          for(var i=0;i<(big?6:4);i++){
            p.push({x:px+(r()-0.5)*4*sc,y:py+(r()-0.5)*4*sc,
              vx:(r()-0.5)*20*sc,vy:-(25+r()*40)*sc,
              life:0.5+r()*0.4,max:0.7,
              color:r()<0.3?'#ffee00':(r()<0.6?'#ff4400':'#cc0000'),
              size:(2+r()*3)*sc,grav:-20*sc,_type:'sq'});
          }
          // faísca conectora entre pontas
          var angNext=(v+1)/5*Math.PI*2-Math.PI/2;
          var nx=cx+Math.cos(angNext)*16*sc, ny=cy+Math.sin(angNext)*16*sc;
          for(var j=0;j<(big?5:3);j++){
            var t4=j/(big?4:2);
            p.push({x:px+(nx-px)*t4,y:py+(ny-py)*t4,
              vx:(r()-0.5)*10*sc,vy:-(5+r()*15)*sc,
              life:0.3+r()*0.2,max:0.4,color:'#cc0000',
              size:(1.5+r())*sc,grav:10*sc,_type:'sq'});
          }
        }
        // fumaça negra central subindo
        for(var i=0;i<(big?10:6);i++){
          p.push({x:cx+(r()-0.5)*10*sc,y:cy+(r()-0.5)*8*sc,
            vx:(r()-0.5)*12*sc,vy:-(20+r()*35)*sc,
            life:0.65+r()*0.4,max:0.9,color:'rgba(30,0,0,0.7)',
            size:(5+r()*6)*sc,grav:-8*sc,_type:'circle'});
        }
        // flash demoníaco vermelho
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.1,max:0.1,color:'#ff0000',size:18*sc,grav:0,_type:'circle'});
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.25,max:0.25,color:'#660000',size:12*sc,grav:0,_type:'circle'});
        break;

      case 19: // Blizzard — vendaval de cristais de neve cortando tudo
        // rajada de cristais vindo de um lado
        for(var i=0;i<(big?28:16);i++){
          var dir=r()<0.5?-1:1;
          var spd=(60+r()*90)*sc;
          p.push({x:cx+(r()-0.5)*10*sc,y:cy+(r()-0.5)*20*sc,
            vx:dir*spd,vy:-(5+r()*20)*sc,
            life:0.35+r()*0.3,max:0.55,
            color:r()<0.4?'#ffffff':(r()<0.7?'#cceeFF':'#88aacc'),
            size:(1.5+r()*3)*sc,grav:20*sc,_type:'sq'});
        }
        // floco grande no centro
        for(var i=0;i<12;i++){
          var ang=i/12*Math.PI*2;
          var spd2=(40+r()*50)*sc;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*spd2,vy:Math.sin(ang)*spd2,
            life:0.4+r()*0.25,max:0.55,
            color:i%2===0?'#ffffff':'#aaddff',
            size:(2.5+r()*2)*sc,grav:10*sc,_type:'sq'});
        }
        // neblina gelada
        for(var i=0;i<(big?8:5);i++){
          p.push({x:cx+(r()-0.5)*25*sc,y:cy+(r()-0.5)*15*sc,
            vx:(r()<0.5?-1:1)*(15+r()*25)*sc,vy:-(3+r()*10)*sc,
            life:0.6+r()*0.4,max:0.9,color:'rgba(200,230,255,0.35)',
            size:(8+r()*8)*sc,grav:-3*sc,_type:'circle'});
        }
        // flash branco/azul
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.09,max:0.09,color:'#ffffff',size:17*sc,grav:0,_type:'circle'});
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.2,max:0.2,color:'#99ddff',size:10*sc,grav:0,_type:'circle'});
        break;

      case 20: // Inferno — explosão total com shockwave triplo e caos
        // explosão omnidirecional massiva
        for(var i=0;i<(big?40:22);i++){
          var ang=r()*Math.PI*2, spd=(70+r()*120)*sc;
          var life=0.5+r()*0.4;
          p.push({x:cx+(r()-0.5)*3*sc,y:cy+(r()-0.5)*3*sc,
            vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-(20*sc),
            life:life,max:life,
            color:r()<0.25?'#ffffff':(r()<0.5?'#ffee44':(r()<0.75?'#ff6600':'#cc2200')),
            size:(2.5+r()*4)*sc,grav:70*sc,_type:'sq'});
        }
        // shockwaves triplos
        for(var ring=0;ring<3;ring++){
          var ringSize=14+ring*8;
          var ringSpd=(95-ring*20)*sc;
          for(var i=0;i<14;i++){
            var ang=i/14*Math.PI*2+ring*0.3;
            p.push({x:cx+Math.cos(ang)*ringSize*sc*0.1,y:cy+Math.sin(ang)*ringSize*sc*0.1,
              vx:Math.cos(ang)*ringSpd,vy:Math.sin(ang)*ringSpd*0.5,
              life:0.15+ring*0.08,max:0.2+ring*0.08,
              color:ring===0?'#ffffff':(ring===1?'#ffcc44':'#ff6600'),
              size:(4-ring*0.8)*sc,grav:0,_type:'sq'});
          }
        }
        // detritos massivos
        for(var i=0;i<(big?14:8);i++){
          var ang=r()*Math.PI*2, spd2=(40+r()*70)*sc;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*spd2,vy:Math.sin(ang)*spd2-30*sc,
            life:0.6+r()*0.4,max:0.85,
            color:r()<0.5?'#888888':'#555555',
            size:(3+r()*4)*sc,grav:100*sc,_type:'sq'});
        }
        // flash colossal
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.12,max:0.12,color:'#ffffff',size:26*sc,grav:0,_type:'circle'});
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.28,max:0.28,color:'#ff8800',size:16*sc,grav:0,_type:'circle'});
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.5,max:0.5,color:'#660000',size:9*sc,grav:0,_type:'circle'});
        break;

      case 21: // Glória — explosão sagrada de luz pura e ouro
        // raios de luz em todas as direções
        for(var i=0;i<20;i++){
          var ang=i/20*Math.PI*2;
          var spd=(70+r()*50)*sc;
          p.push({x:cx,y:cy,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,
            life:0.5+r()*0.2,max:0.55,
            color:i%3===0?'#ffffff':(i%3===1?'#ffffaa':'#ffdd44'),
            size:(3+r()*3)*sc,grav:0,_type:'sq'});
        }
        // partículas douradas voando para cima
        for(var i=0;i<(big?24:14);i++){
          var ang=r()*Math.PI*2, spd2=(30+r()*80)*sc;
          p.push({x:cx+(r()-0.5)*5*sc,y:cy+(r()-0.5)*5*sc,
            vx:Math.cos(ang)*spd2,vy:Math.sin(ang)*spd2-(28*sc),
            life:0.55+r()*0.4,max:0.75,
            color:r()<0.4?'#ffffff':(r()<0.7?'#ffffcc':'#ffcc44'),
            size:(2+r()*3.5)*sc,grav:25*sc,_type:'circle'});
        }
        // halos concêntricos
        for(var ring=0;ring<3;ring++){
          for(var i=0;i<12;i++){
            var ang=i/12*Math.PI*2+ring*0.4;
            var rad=(8+ring*10)*sc;
            p.push({x:cx+Math.cos(ang)*rad,y:cy+Math.sin(ang)*rad,
              vx:Math.cos(ang)*(35+ring*15)*sc,vy:Math.sin(ang)*(35+ring*15)*sc-5*sc,
              life:0.3+ring*0.1,max:0.35+ring*0.1,
              color:ring===0?'#ffffff':(ring===1?'#ffffaa':'#ffcc44'),
              size:(3-ring*0.5)*sc,grav:0,_type:'sq'});
          }
        }
        // flash sagrado
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.12,max:0.12,color:'#ffffff',size:24*sc,grav:0,_type:'circle'});
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.3,max:0.3,color:'#ffffcc',size:15*sc,grav:0,_type:'circle'});
        p.push({x:cx,y:cy,vx:0,vy:0,life:0.55,max:0.55,color:'#ffcc44',size:8*sc,grav:0,_type:'circle'});
        break;

    }
    return p;
  }
  window._spawnKillParticles = _spawnKillParticles; // expose to game IIFE

  // ── Preview loop para cards de kill ───────────────────────
  var _killCardLoops = new Map();
  function _stopKillCardLoop(canvas){
    var obj=_killCardLoops.get(canvas);
    if(obj){obj.active=false;if(obj.raf)cancelAnimationFrame(obj.raf);}
    _killCardLoops.delete(canvas);
  }
  function _startKillCardLoop(canvas, killId){
    _stopKillCardLoop(canvas);
    var W=canvas.width, H=canvas.height;
    var obj={active:true,raf:null};
    _killCardLoops.set(canvas,obj);
    var particles=[], last=null, timer=0, INTERVAL=1.1;
    var cx=W/2, cy=H/2;

    function frame(now){
      if(!obj.active) return;
      if(last===null) last=now;
      var dt=Math.min(0.05,(now-last)/1000); last=now;
      timer+=dt;
      // spawna animação periodicamente
      if(timer>=INTERVAL){ timer=0; particles=particles.concat(_spawnKillParticles(killId,cx,cy,false)); }
      // update particles
      var keep=[];
      for(var i=0;i<particles.length;i++){
        var p=particles[i]; p.life-=dt; if(p.life<=0) continue;
        p.vy=(p.vy||0)+(p.grav||0)*dt; p.x+=(p.vx||0)*dt; p.y+=p.vy*dt; keep.push(p);
      }
      particles=keep;
      // draw
      var ctx=canvas.getContext('2d');
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle='#c8a95a'; ctx.fillRect(0,0,W,H);
      for(var i=0;i<particles.length;i++){
        var p=particles[i];
        var alpha=Math.max(0,p.life/p.max)*0.9;
        ctx.globalAlpha=alpha;
        ctx.fillStyle=p.color||'#fff';
        var sz=Math.max(0.5,p.size||2);
        if(p.hat){
          // chapéu voador
          ctx.fillStyle='#3a1a00';
          ctx.fillRect(p.x-sz,p.y-sz*0.4,sz*2,sz*0.7);
          ctx.fillRect(p.x-sz*0.6,p.y-sz,sz*1.2,sz*0.7);
        } else if(p._type==='circle'){
          ctx.beginPath(); ctx.arc(p.x,p.y,sz/2,0,Math.PI*2); ctx.fill();
        } else {
          ctx.fillRect(p.x-sz/2,p.y-sz/2,sz,sz);
        }
      }
      ctx.globalAlpha=1;
      obj.raf=requestAnimationFrame(frame);
    }
    // Dispara primeira animação imediatamente
    particles=_spawnKillParticles(killId,cx,cy,false);
    obj.raf=requestAnimationFrame(frame);
  }

  // ── Render grid de animações de abate ─────────────────────
  function renderProfileKills(){
    var grid=document.getElementById('profKillsGrid'); if(!grid) return;
    _stopCosmeticPreviewLoops(grid);
    grid.innerHTML='';
    var acc=acctLoad(), owned=new Set(acc.ownedKills||[]), eq=(acc.equippedKill!=null?acc.equippedKill:-1);
    var catalog=_getCosmeticCatalogEntries('kills', true, acc);
    var totalPages=Math.max(1, Math.ceil(catalog.length/KILLS_PER_PAGE));
    if(_killPage>=totalPages) _killPage=Math.max(0,totalPages-1);
    var start=_killPage*KILLS_PER_PAGE, end=Math.min(start+KILLS_PER_PAGE,catalog.length);
    for(var i=start;i<end;i++){
      (function(item){
        var anim=item.data;
        var isNone=(anim.id===-1);
        var isOwned=isNone||owned.has(anim.id), isEq=(eq===anim.id)||(isNone&&eq===-1);
        var card=document.createElement('div'); card.className='prof-kill-card'+(isEq?' equipped':'');
        var cvs=document.createElement('canvas'); cvs.width=48; cvs.height=28;
        var nm=document.createElement('div'); nm.className='kill-name'; nm.textContent=anim.name;
        var btn=document.createElement('button'); btn.className='kill-btn';
        if(isEq){
          btn.textContent='Equipado'; btn.disabled=true; btn.className='kill-btn btn-equipped';
        } else if(isOwned){
          btn.textContent='Equipar'; btn.className='kill-btn btn-equip';
          btn.onclick=(function(id){ return function(e){ e.stopPropagation(); _equipKill(id); }; })(anim.id);
        } else {
          btn.textContent=anim.cost+' Ouro'; btn.className='kill-btn btn-buy';
          btn.onclick=(function(id){ return function(e){ e.stopPropagation(); _buyKill(id); }; })(anim.id);
        }
        card.appendChild(cvs); card.appendChild(nm); card.appendChild(btn);
        grid.appendChild(card);
        _startKillCardLoop(cvs, anim.id);
      })(catalog[i]);
    }
    for(var fi=end-start;fi<KILLS_PER_PAGE;fi++){
      var ph=document.createElement('div'); ph.style.visibility='hidden'; grid.appendChild(ph);
    }
    var lbl=document.getElementById('profKillPgLabel'); if(lbl) lbl.textContent=(_killPage+1)+' / '+totalPages;
    var pp=document.getElementById('profKillPgPrev'); if(pp) pp.disabled=(_killPage===0);
    var pn=document.getElementById('profKillPgNext'); if(pn) pn.disabled=(_killPage>=totalPages-1);
  }

  window._profChangeKillPage=function(d){
    var tp=Math.max(1, Math.ceil(_getCosmeticCatalogEntries('kills', true).length/KILLS_PER_PAGE));
    _killPage=Math.max(0,Math.min(tp-1,_killPage+d));
    renderProfileKills();
  };

  function _buyKill(id){
    var anim=null; for(var i=0;i<KILL_ANIMS.length;i++){if(KILL_ANIMS[i].id===id){anim=KILL_ANIMS[i];break;}} if(!anim||id===-1) return;
    var acc=acctLoad();
    if(acc.coins<anim.cost){ _profSkinToast('Ouro insuficiente',true); try{window._gameBeep(180,0.09,'sawtooth',0.07);}catch(_){} return; }
    acc.coins-=anim.cost;
    if(!acc.ownedKills) acc.ownedKills=[];
    if(!acc.ownedKills.includes(id)) acc.ownedKills.push(id);
    acc.equippedKill=id; acctSave(acc);
    if(typeof state!=='undefined'&&state) state.equippedKill=id;
    _profSndBuy();
    _profSkinToast('Animação desbloqueada e equipada!', false);
    refreshMenu();
    renderProfileKills();
    _refreshCosmeticStoreIfOpen();
  }
  function _equipKill(id){
    var acc=acctLoad(); acc.equippedKill=id; acctSave(acc);
    if(typeof state!=='undefined'&&state) state.equippedKill=id;
    _profSndEquip();
    _profSkinToast('Animação equipada!', false);
    renderProfileKills();
    _refreshCosmeticStoreIfOpen();
  }

  // ── Abrir aba kill anims ───────────────────────────────────
  function _profOpenKills(){
    var ps=document.getElementById('profileScreen');
    var home=document.getElementById('profShopHome');
    if(ps){ ps.classList.remove('prof-skins-full'); ps.classList.remove('prof-auras-full');
            ps.classList.remove('prof-shots-full'); ps.classList.remove('prof-golds-full');
            ps.classList.remove('prof-names-full');
            ps.classList.add('prof-kills-full'); }
    if(home) home.style.display='none';
    _killPage=0;
    renderProfileKills();
  }

  var COSMETIC_STORE_PER_PAGE = 6;
  var _cosmeticStoreCategory = 'skins';
  var _cosmeticStorePage = 0;
  var _cosmeticCatalogInflated = false;
  var _cosmeticStoreFreshBuys = {};

  var COSMETIC_STORE_META = {
    skins: {
      label: 'Arsenal Visual',
      title: 'Skins',
      desc: 'Tecidos, chapéus e combinações que fazem cada entrada no mapa parecer cartaz de procurado.'
    },
    auras: {
      label: 'Presença',
      title: 'Auras',
      desc: 'Brilhos, fumaças e fenômenos que anunciam sua chegada antes mesmo do primeiro tiro.'
    },
    shots: {
      label: 'Projéteis',
      title: 'Efeitos de Disparo',
      desc: 'Rastros para transformar cada bala numa assinatura visual do seu estilo.'
    },
    golds: {
      label: 'Relíquias',
      title: 'Visuais do Ouro',
      desc: 'Caixas, cofres e relíquias para deixar o tesouro mais memorável do que nunca.'
    },
    kills: {
      label: 'Execuções',
      title: 'Animações de Abate',
      desc: 'Finalizações dramáticas para quando o velho oeste pedir espetáculo.'
    },
    names: {
      label: 'Identidade',
      title: 'Estilos de Nome',
      desc: 'Assine seu nome de guerra com a presença de quem já virou lenda na cidade.'
    }
  };

  function _inflateCosmeticCatalog(){
    if(_cosmeticCatalogInflated) return;
    [
      PROFILE_SKINS,
      AURAS,
      DECORATIVE_NAMES,
      SHOT_EFFECTS,
      GOLD_SKINS,
      KILL_ANIMS
    ].forEach(function(list){
      for(var i=0;i<list.length;i++){
        var entry=list[i];
        if(!entry) continue;
        var cost=Number(entry.cost)||0;
        if(cost>0) entry.cost=Math.round(cost*2);
      }
    });
    _cosmeticCatalogInflated = true;
  }

  function _getCosmeticRarity(cost){
    cost = Math.max(0, Number(cost) || 0);
    if(cost >= 6000) return { key:'legendary', label:'Lendário' };
    if(cost >= 3000) return { key:'epic', label:'Épico' };
    if(cost >= 1500) return { key:'rare', label:'Raro' };
    if(cost >= 700) return { key:'uncommon', label:'Incomum' };
    return { key:'common', label:'Comum' };
  }

  function _getCosmeticFlavor(category, entry, id){
    if(category === 'skins'){
      return 'Vestir ' + entry.name + ' é entrar no saloon com cara de quem já venceu o duelo.';
    }
    if(category === 'auras'){
      return 'A aura ' + entry.name + ' faz até a poeira do mapa abrir caminho quando você passa.';
    }
    if(category === 'shots'){
      if(id === -1) return 'O disparo clássico: seco, limpo e mortal como todo bom duelo pede.';
      return (entry.desc || 'Rastro único') + '. Cada tiro parece cena final de filme.';
    }
    if(category === 'golds'){
      if(id === -1) return 'O tesouro tradicional, firme e reconhecível como símbolo da sua defesa.';
      return (entry.desc || 'Relíquia valiosa') + '. Um visual que faz o saque parecer ainda mais cobiçado.';
    }
    if(category === 'kills'){
      return (entry.desc || 'Finalização marcante') + '. Feita para transformar o último golpe em espetáculo.';
    }
    if(category === 'names'){
      return 'O estilo ' + entry.name + ' assina seu cartaz de procurado com presença de lenda.';
    }
    return entry.desc || '';
  }

  function _isCosmeticStoreOpen(){
    return document.body.getAttribute('data-cosmetic-store-open') === '1';
  }

  function _stopCosmeticPreviewLoops(root){
    if(!root || !root.querySelectorAll) return;
    root.querySelectorAll('canvas').forEach(function(cv){
      try{ _stopAuraCardLoop(cv); }catch(_){}
      try{ _stopShotCardLoop(cv); }catch(_){}
      try{ _stopGoldCardLoop(cv); }catch(_){}
      try{ _stopKillCardLoop(cv); }catch(_){}
    });
  }

  function _getCosmeticCatalogEntries(category, ownedOnly, acc){
    _inflateCosmeticCatalog();
    acc = acc || acctLoad();
    var list = [];
    switch(category){
      case 'skins': {
        var ownedSkins = new Set(acc.skins || [0]);
        list = PROFILE_SKINS.map(function(entry, idx){
          if (!entry) return null;
          return {
            category: 'skins',
            id: idx,
            data: entry,
            owned: ownedSkins.has(idx),
            equipped: (acc.equippedSkin || 0) === idx,
            cost: entry.cost || 0,
            rarity: _getCosmeticRarity(entry.cost || 0),
            desc: _getCosmeticFlavor('skins', entry, idx)
          };
        }).filter(Boolean).sort(function(a,b){
          return (a.cost - b.cost) || a.id - b.id;
        });
        break;
      }
      case 'auras': {
        var ownedAuras = new Set(acc.ownedAuras || []);
        list = AURAS.map(function(entry){
          var isDefault = entry.id === -1;
          return {
            category: 'auras',
            id: entry.id,
            data: entry,
            owned: isDefault || ownedAuras.has(entry.id),
            equipped: acc.equippedAura === entry.id,
            cost: entry.cost || 0,
            rarity: _getCosmeticRarity(entry.cost || 0),
            desc: _getCosmeticFlavor('auras', entry, entry.id)
          };
        }).sort(function(a,b){
          return (a.cost - b.cost) || a.id - b.id;
        });
        break;
      }
      case 'shots': {
        var ownedShots = new Set(acc.ownedShots || []);
        list = SHOT_EFFECTS.map(function(entry){
          var isDefault = entry.id === -1;
          return {
            category: 'shots',
            id: entry.id,
            data: entry,
            owned: isDefault || ownedShots.has(entry.id),
            equipped: acc.equippedShot === entry.id,
            cost: entry.cost || 0,
            rarity: _getCosmeticRarity(entry.cost || 0),
            desc: _getCosmeticFlavor('shots', entry, entry.id)
          };
        }).sort(function(a,b){
          return (a.cost - b.cost) || a.id - b.id;
        });
        break;
      }
      case 'golds': {
        var ownedGolds = new Set(acc.ownedGolds || []);
        list = GOLD_SKINS.map(function(entry){
          var isDefault = entry.id === -1;
          return {
            category: 'golds',
            id: entry.id,
            data: entry,
            owned: isDefault || ownedGolds.has(entry.id),
            equipped: acc.equippedGold === entry.id,
            cost: entry.cost || 0,
            rarity: _getCosmeticRarity(entry.cost || 0),
            desc: _getCosmeticFlavor('golds', entry, entry.id)
          };
        }).sort(function(a,b){
          return (a.cost - b.cost) || a.id - b.id;
        });
        break;
      }
      case 'kills': {
        var ownedKills = new Set(acc.ownedKills || []);
        list = KILL_ANIMS.map(function(entry){
          var isDefault = entry.id === 0;
          return {
            category: 'kills',
            id: entry.id,
            data: entry,
            owned: isDefault || ownedKills.has(entry.id),
            equipped: (acc.equippedKill != null ? acc.equippedKill : 0) === entry.id,
            cost: entry.cost || 0,
            rarity: _getCosmeticRarity(entry.cost || 0),
            desc: _getCosmeticFlavor('kills', entry, entry.id)
          };
        }).sort(function(a,b){
          return (a.cost - b.cost) || a.id - b.id;
        });
        break;
      }
      case 'names': {
        var ownedNames = new Set(acc.ownedNames || [0]);
        ownedNames.add(0);
        list = DECORATIVE_NAMES.map(function(entry){
          return {
            category: 'names',
            id: entry.id,
            data: entry,
            owned: ownedNames.has(entry.id),
            equipped: (acc.equippedName != null ? acc.equippedName : 0) === entry.id,
            cost: entry.cost || 0,
            rarity: _getCosmeticRarity(entry.cost || 0),
            desc: _getCosmeticFlavor('names', entry, entry.id)
          };
        }).sort(function(a,b){
          return (a.cost - b.cost) || a.id - b.id;
        });
        break;
      }
    }
    return ownedOnly ? list.filter(function(item){ return item.owned; }) : list;
  }

  function _refreshProfileCollectionCounts(){
    var acc = acctLoad();
    [
      { id: 'profChoiceSkins', category: 'skins', label: 'Skins' },
      { id: 'profChoiceAuras', category: 'auras', label: 'Auras' },
      { id: 'profChoiceShots', category: 'shots', label: 'Efeitos de Disparo' },
      { id: 'profChoiceGolds', category: 'golds', label: 'Visuais do Ouro' },
      { id: 'profChoiceKills', category: 'kills', label: 'Animações de Abate' },
      { id: 'profChoiceNames', category: 'names', label: 'Nomes Decorativos' }
    ].forEach(function(entry){
      var card = document.getElementById(entry.id);
      if(!card) return;
      var name = card.querySelector('.sc-name');
      if(!name) return;
      var catalog = _getCosmeticCatalogEntries(entry.category, false, acc);
      var ownedCount = catalog.filter(function(item){ return item.owned; }).length;
      name.innerHTML = '';
      name.appendChild(document.createTextNode(entry.label + ' '));
      var count = document.createElement('span');
      count.className = 'sc-count';
      count.textContent = '(' + ownedCount + '/' + catalog.length + ')';
      var ratio = catalog.length > 0 ? ownedCount / catalog.length : 0;
      if (ratio >= 1) count.classList.add('sc-count-complete');
      else if (ratio >= 0.66) count.style.color = '#b8d96b';
      else if (ratio >= 0.33) count.style.color = '#d6b866';
      name.appendChild(count);
    });
  }

  function _buyCosmetic(category, id){
    var acc=acctLoad(), item=null, owned=false, cost=0, toastMsg='Item adquirido!';
    if(category === 'skins'){
      item=PROFILE_SKINS[id];
      if(!item) return;
      owned=(acc.skins||[]).indexOf(id)>=0;
      cost=item.cost||0;
      toastMsg='Skin adquirida!';
    } else if(category === 'auras'){
      for(var ai=0;ai<AURAS.length;ai++){ if(AURAS[ai].id===id){ item=AURAS[ai]; break; } }
      if(!item) return;
      owned=(acc.ownedAuras||[]).indexOf(id)>=0;
      cost=item.cost||0;
      toastMsg='Aura adquirida!';
    } else if(category === 'shots'){
      for(var si=0;si<SHOT_EFFECTS.length;si++){ if(SHOT_EFFECTS[si].id===id){ item=SHOT_EFFECTS[si]; break; } }
      if(!item) return;
      owned=(acc.ownedShots||[]).indexOf(id)>=0;
      cost=item.cost||0;
      toastMsg='Efeito adquirido!';
    } else if(category === 'golds'){
      for(var gi=0;gi<GOLD_SKINS.length;gi++){ if(GOLD_SKINS[gi].id===id){ item=GOLD_SKINS[gi]; break; } }
      if(!item) return;
      owned=(acc.ownedGolds||[]).indexOf(id)>=0;
      cost=item.cost||0;
      toastMsg='Visual adquirido!';
    } else if(category === 'kills'){
      for(var ki=0;ki<KILL_ANIMS.length;ki++){ if(KILL_ANIMS[ki].id===id){ item=KILL_ANIMS[ki]; break; } }
      if(!item) return;
      owned=(acc.ownedKills||[]).indexOf(id)>=0;
      cost=item.cost||0;
      toastMsg='Animação adquirida!';
    } else if(category === 'names'){
      item=_findDecorEntry(id);
      if(!item) return;
      owned=(acc.ownedNames||[]).indexOf(id)>=0;
      cost=item.cost||0;
      toastMsg='Estilo adquirido!';
    }
    if(!item || owned) return;
    if(acc.coins < cost){
      _profSkinToast('Ouro insuficiente', true);
      try{ window._gameBeep(180,0.09,'sawtooth',0.07); }catch(_){}
      return;
    }
    acc.coins -= cost;
    if(category === 'skins'){
      if(!acc.skins) acc.skins=[0];
      if(acc.skins.indexOf(id) < 0) acc.skins.push(id);
    } else if(category === 'auras'){
      if(!acc.ownedAuras) acc.ownedAuras=[];
      if(acc.ownedAuras.indexOf(id) < 0) acc.ownedAuras.push(id);
    } else if(category === 'shots'){
      if(!acc.ownedShots) acc.ownedShots=[];
      if(acc.ownedShots.indexOf(id) < 0) acc.ownedShots.push(id);
    } else if(category === 'golds'){
      if(!acc.ownedGolds) acc.ownedGolds=[];
      if(acc.ownedGolds.indexOf(id) < 0) acc.ownedGolds.push(id);
    } else if(category === 'kills'){
      if(!acc.ownedKills) acc.ownedKills=[];
      if(acc.ownedKills.indexOf(id) < 0) acc.ownedKills.push(id);
    } else if(category === 'names'){
      if(!acc.ownedNames) acc.ownedNames=[0];
      if(acc.ownedNames.indexOf(id) < 0) acc.ownedNames.push(id);
    }
    acctSave(acc);
    _cosmeticStoreFreshBuys[category + ':' + id] = true;
    _profSndBuy();
    _profSkinToast(toastMsg, false);
    refreshMenu();
    _refreshCosmeticStoreIfOpen();
  }

  function _equipCosmeticFromStore(category, id){
    delete _cosmeticStoreFreshBuys[category + ':' + id];
    if(category === 'skins') _equipSkin(id);
    else if(category === 'auras') _equipAura(id);
    else if(category === 'shots') _equipShot(id);
    else if(category === 'golds') _equipGold(id);
    else if(category === 'kills') _equipKill(id);
    else if(category === 'names') _equipName(id);
  }

  function _isCosmeticStoreDefaultItem(item){
    if(!item) return false;
    if(item.category === 'skins') return item.id === 0;
    if(item.category === 'auras' || item.category === 'shots' || item.category === 'golds') return item.id === -1;
    if(item.category === 'kills' || item.category === 'names') return item.id === 0;
    return false;
  }

  function _buildCosmeticStorePreview(item){
    var wrap=document.createElement('div');
    wrap.className='cosm-card-preview cosm-card-preview-'+item.category;
    var acc=acctLoad();
    if(item.category === 'names'){
      wrap.className='cosm-card-preview cosm-card-preview-name';
      var txt=document.createElement('span');
      txt.textContent=_profDecorPreviewLabel();
      txt.className='prof-name-preview-text' + (item.data.cssClass ? ' ' + item.data.cssClass : '');
      wrap.appendChild(txt);
      return wrap;
    }
    var cv=document.createElement('canvas');
    if(item.category === 'skins'){
      cv.width=96; cv.height=96;
    } else if(item.category === 'auras'){
      cv.width=128; cv.height=128;
    } else if(item.category === 'golds'){
      cv.width=84; cv.height=58;
    } else {
      cv.width=84; cv.height=52;
    }
    try{
      var cctx=cv.getContext('2d');
      if(cctx){
        cctx.imageSmoothingEnabled=false;
        cctx.mozImageSmoothingEnabled=false;
        cctx.webkitImageSmoothingEnabled=false;
        cctx.msImageSmoothingEnabled=false;
      }
    }catch(_){}
    wrap.appendChild(cv);
    if(item.category === 'skins'){
      drawSkinMini(cv, item.data.body, item.data.hat);
    } else if(item.category === 'auras'){
      if(item.id === -1){
        var auraSkin=PROFILE_SKINS[acc.equippedSkin || 0] || PROFILE_SKINS[0];
        drawSkinMini(cv, auraSkin.body, auraSkin.hat);
      } else {
        _startAuraCardLoop(cv, item.id);
      }
    } else if(item.category === 'shots'){
      _startShotCardLoop(cv, item.id);
    } else if(item.category === 'golds'){
      _startGoldCardLoop(cv, item.id);
    } else if(item.category === 'kills'){
      _startKillCardLoop(cv, item.id);
    }
    return wrap;
  }

  function renderCosmeticStore(){
    var grid=document.getElementById('cosmeticStoreGrid');
    if(!grid) return;
    var acc=acctLoad();
    var meta=COSMETIC_STORE_META[_cosmeticStoreCategory] || COSMETIC_STORE_META.skins;
    var label=document.getElementById('cosmeticStoreCategoryLabel');
    var title=document.getElementById('cosmeticStoreCategoryTitle');
    var desc=document.getElementById('cosmeticStoreCategoryDesc');
    var coins=document.getElementById('storeCoinsValue');
    if(label) label.textContent=meta.label;
    if(title) title.textContent=meta.title;
    if(desc) desc.textContent=meta.desc;
    if(coins) coins.textContent=acc.coins.toLocaleString('pt-BR')+' Ouro';
    document.querySelectorAll('#cosmeticStoreSidebar .cosm-cat-btn').forEach(function(btn){
      btn.classList.toggle('active', btn.getAttribute('data-cat') === _cosmeticStoreCategory);
    });
    _stopCosmeticPreviewLoops(grid);
    grid.innerHTML='';
    var catalog=_getCosmeticCatalogEntries(_cosmeticStoreCategory, false, acc).filter(function(item){
      return !_isCosmeticStoreDefaultItem(item);
    });
    var totalPages=Math.max(1, Math.ceil(catalog.length / COSMETIC_STORE_PER_PAGE));
    if(_cosmeticStorePage>=totalPages) _cosmeticStorePage=Math.max(0,totalPages-1);
    var start=_cosmeticStorePage * COSMETIC_STORE_PER_PAGE;
    var end=Math.min(start + COSMETIC_STORE_PER_PAGE, catalog.length);
    if(!catalog.length){
      var empty=document.createElement('div');
      empty.className='cosm-empty';
      empty.textContent='Nenhum item encontrado nessa categoria.';
      grid.appendChild(empty);
    } else {
      for(var i=start;i<end;i++){
        (function(item){
          var card=document.createElement('div');
          card.className='cosm-card rarity-'+item.rarity.key+(item.owned?' is-owned':'');
          var rarity=document.createElement('div');
          rarity.className='cosm-card-rarity';
          rarity.textContent=item.rarity.label;
          var name=document.createElement('div');
          name.className='cosm-card-name';
          name.textContent=item.data.name;
          var preview=_buildCosmeticStorePreview(item);
          var footer=document.createElement('div');
          footer.className='cosm-card-footer';
          var cost=document.createElement('div');
          cost.className='cosm-card-cost';
          cost.textContent=item.owned ? 'Adquirido' : (item.cost > 0 ? item.cost.toLocaleString('pt-BR') + ' Ouro' : 'Grátis');
          var btn=document.createElement('button');
          var freshBought = !!_cosmeticStoreFreshBuys[item.category + ':' + item.id];
          if(item.owned && freshBought){
            btn.className='cosm-action-btn is-fresh-equip';
            btn.textContent='Equipar';
            btn.onclick=function(){ _equipCosmeticFromStore(item.category, item.id); };
          } else if(item.owned){
            btn.className='cosm-action-btn is-equipped';
            btn.textContent='Adquirido';
            btn.disabled=true;
          } else {
            btn.className='cosm-action-btn cosm-buy-btn btn-play-gold';
            btn.textContent='Comprar';
            btn.onclick=function(){ _buyCosmetic(item.category, item.id); };
          }
          footer.appendChild(cost);
          footer.appendChild(btn);
          card.appendChild(rarity);
          card.appendChild(preview);
          card.appendChild(name);
          card.appendChild(footer);
          grid.appendChild(card);
        })(catalog[i]);
      }
    }
    var pgLabel=document.getElementById('storePageLabel');
    if(pgLabel) pgLabel.textContent='Página '+(_cosmeticStorePage+1)+' / '+totalPages;
    var prev=document.getElementById('storePagePrev');
    var next=document.getElementById('storePageNext');
    if(prev) prev.disabled=(_cosmeticStorePage===0);
    if(next) next.disabled=(_cosmeticStorePage>=totalPages-1);
  }

  function _refreshCosmeticStoreIfOpen(){
    if(_isCosmeticStoreOpen()) renderCosmeticStore();
  }

  function _showCosmeticStore(){
    var screen=document.getElementById('cosmeticStoreScreen');
    if(!screen) return;
    var menu=document.getElementById('menuScreen');
    if(menu){ menu.style.display='none'; menu.setAttribute('aria-hidden','true'); }
    var zw=document.getElementById('zoomWrap');
    if(zw){ zw.style.display='none'; zw.style.visibility='hidden'; zw.style.opacity='0'; zw.style.pointerEvents='none'; }
    document.body.setAttribute('data-cosmetic-store-open','1');
    screen.style.display='flex';
    _cosmeticStoreFreshBuys = {};
    _cosmeticStorePage=0;
    renderCosmeticStore();
  }

  function _hideCosmeticStore(){
    var screen=document.getElementById('cosmeticStoreScreen');
    if(!screen) return;
    _stopCosmeticPreviewLoops(screen);
    screen.style.display='none';
    _cosmeticStoreFreshBuys = {};
    document.body.removeAttribute('data-cosmetic-store-open');
    var menu=document.getElementById('menuScreen');
    if(menu){ menu.style.display='flex'; menu.setAttribute('aria-hidden','false'); }
    var zw=document.getElementById('zoomWrap');
    if(zw){ zw.style.display='none'; zw.style.visibility='hidden'; zw.style.opacity='0'; zw.style.pointerEvents='none'; }
  }

  function _setCosmeticStoreCategory(cat){
    if(!COSMETIC_STORE_META[cat]) return;
    _cosmeticStoreCategory=cat;
    _cosmeticStorePage=0;
    renderCosmeticStore();
  }

  function _changeCosmeticStorePage(delta){
    var catalog=_getCosmeticCatalogEntries(_cosmeticStoreCategory, false).filter(function(item){
      return !_isCosmeticStoreDefaultItem(item);
    });
    var totalPages=Math.max(1, Math.ceil(catalog.length / COSMETIC_STORE_PER_PAGE));
    _cosmeticStorePage=Math.max(0, Math.min(totalPages-1, _cosmeticStorePage + delta));
    renderCosmeticStore();
  }

  function _wireCosmeticStoreNav(){
    var btnOpen=document.getElementById('btnCosmeticStore');
    var btnBack=document.getElementById('btnCosmeticStoreBack');
    var btnPrev=document.getElementById('storePagePrev');
    var btnNext=document.getElementById('storePageNext');
    if(btnOpen) btnOpen.onclick=_showCosmeticStore;
    if(btnBack) btnBack.onclick=_hideCosmeticStore;
    if(btnPrev) btnPrev.onclick=function(){ _changeCosmeticStorePage(-1); };
    if(btnNext) btnNext.onclick=function(){ _changeCosmeticStorePage(1); };
    document.querySelectorAll('#cosmeticStoreSidebar .cosm-cat-btn').forEach(function(btn){
      btn.onclick=function(){
        if(btn.getAttribute('aria-disabled') === 'true') return;
        _setCosmeticStoreCategory(btn.getAttribute('data-cat'));
      };
    });
  }

  _inflateCosmeticCatalog();

  function _wireProfShopNav(){
    var c=document.getElementById('profChoiceSkinsBtn');
    var b=document.getElementById('profSkinsBack');
    var ca=document.getElementById('profChoiceAurasBtn');
    var ba=document.getElementById('profAurasBack');
    var ap=document.getElementById('profAuraPgPrev');
    var an=document.getElementById('profAuraPgNext');
    if(c){ c.onclick=_profOpenSkins; c.onkeydown=function(ev){ if(ev&&(ev.key==='Enter'||ev.key===' ')){ ev.preventDefault(); _profOpenSkins(); } }; }
    if(b){ b.onclick=_profOpenShopHome; }
    if(ca){ ca.onclick=_profOpenAuras; ca.onkeydown=function(ev){ if(ev&&(ev.key==='Enter'||ev.key===' ')){ ev.preventDefault(); _profOpenAuras(); } }; }
    if(ba){ ba.onclick=_profOpenShopHome; }
    var cs2=document.getElementById('profChoiceShotsBtn'), bs2=document.getElementById('profShotsBack');
    if(cs2){ cs2.onclick=_profOpenShots; cs2.onkeydown=function(ev){ if(ev&&(ev.key==='Enter'||ev.key===' ')){ ev.preventDefault(); _profOpenShots(); } }; }
    if(bs2){ bs2.onclick=_profOpenShopHome; }
    var cg=document.getElementById('profChoiceGoldsBtn'), bg=document.getElementById('profGoldsBack');
    if(cg){ cg.onclick=_profOpenGolds; cg.onkeydown=function(ev){ if(ev&&(ev.key==='Enter'||ev.key===' ')){ ev.preventDefault(); _profOpenGolds(); } }; }
    if(bg){ bg.onclick=_profOpenShopHome; }
    if(ap){ ap.onclick=function(){ window._profChangeAuraPage(-1); }; }
    if(an){ an.onclick=function(){ window._profChangeAuraPage(1); }; }
    var ck=document.getElementById('profChoiceKillsBtn'), bk=document.getElementById('profKillsBack');
    if(ck){ ck.onclick=_profOpenKills; ck.onkeydown=function(ev){ if(ev&&(ev.key==='Enter'||ev.key===' ')){ ev.preventDefault(); _profOpenKills(); } }; }
    if(bk){ bk.onclick=_profOpenShopHome; }
    var cnm = document.getElementById('profChoiceNamesBtn'), bnm = document.getElementById('profNamesBack');
    var np = document.getElementById('profNamePgPrev'), nn = document.getElementById('profNamePgNext');
    if(cnm){ cnm.onclick=_profOpenNames; cnm.onkeydown=function(ev){ if(ev&&(ev.key==='Enter'||ev.key===' ')){ ev.preventDefault(); _profOpenNames(); } }; }
    if(bnm){ bnm.onclick=_profOpenShopHome; }
    if(np){ np.onclick=function(){ window._profChangeNamePage(-1); }; }
    if(nn){ nn.onclick=function(){ window._profChangeNamePage(1); }; }
  }
  _wireProfShopNav();
  _wireCosmeticStoreNav();

  // Nome da conta

  // Indicador de limite + sons de digitação (Perfil)
  var _nameInp = document.getElementById('profileNameInput');
  var _nameCounter = document.getElementById('profileNameCounter');
  function _updateProfileNameCounter(){
    try{
      if(!_nameInp) _nameInp = document.getElementById('profileNameInput');
      if(!_nameCounter) _nameCounter = document.getElementById('profileNameCounter');
      if(!_nameInp || !_nameCounter) return;
      var max = parseInt(_nameInp.getAttribute('maxlength')||'16',10) || 16;
      var len = (_nameInp.value||'').length;
      if(len > max) len = max;
      _nameCounter.textContent = len + '/' + max;

      // Cor: vai ficando mais vermelho conforme aproxima do limite
      var r = max ? (len / max) : 0;
      // Verde -> Amarelo -> Vermelho (HSL 120 -> 0)
      var hue = Math.max(0, Math.min(120, (1 - r) * 120));
      _nameCounter.style.color = 'hsl(' + hue.toFixed(0) + ' 90% 60%)';
      _nameCounter.style.opacity = len === 0 ? '0.75' : '0.95';
    }catch(_){}
  }
  window._updateProfileNameCounter = _updateProfileNameCounter;

  (function(){
    if(!_nameInp) return;
    _updateProfileNameCounter();
    var prevLen = (_nameInp.value||'').length;
    _nameInp.addEventListener('input', function(){
      try{
        var nowLen = (_nameInp.value||'').length;
        var delta = nowLen - prevLen;
        prevLen = nowLen;
        _updateProfileNameCounter();

        // Som por letra adicionada (satisfatório, mas discreto)
        if(delta > 0){
          try{
            // garante que o áudio acorde com gesto do usuário
            if (typeof getAudio === 'function'){
              var ac = getAudio(); if (ac && ac.state === 'suspended') ac.resume();
            }
          }catch(_){}
          try{
            var base = 640 + Math.random()*120;
            // se colou várias letras, toca 1 som um pouco mais "cheio"
            var g = 0.022 + Math.min(0.02, (delta-1)*0.004);
            if (window._gameBeep) window._gameBeep(base, 0.028, 'square', g);
            if (delta > 1 && window._gameBeep) setTimeout(function(){ window._gameBeep(base*1.12, 0.022, 'triangle', 0.018); }, 18);
          }catch(_){}
        }else if(delta < 0){
          // deletar: som mais grave curtinho
          try{ if (window._gameBeep) window._gameBeep(360 + Math.random()*50, 0.018, 'square', 0.016); }catch(_){}
        }
      }catch(_){}
    });
  })();

  var _btnNameSave=document.getElementById('profileNameSave');
  if(_btnNameSave) _btnNameSave.onclick=function(){
    var inp=document.getElementById('profileNameInput'); if(!inp) return;
    var nm=inp.value.trim().slice(0,16);
    try{ inp.value = nm; }catch(_){ }
    try{ if(window._updateProfileNameCounter) window._updateProfileNameCounter(); }catch(_){ }
    var acc=acctLoad(); acc.name=nm; acctSave(acc);
    try{ if(typeof state!=='undefined'&&state&&state.player) state.player.name=nm; }catch(e){}
    try{ renderProfileNames(); }catch(_){}

    // feedback visual + som ao salvar
    try{
      var wrap = inp && inp.parentElement;
      if (wrap && wrap.classList) {
        wrap.classList.remove('saved-pop');
        // reflow pra reiniciar animação
        void wrap.offsetWidth;
        wrap.classList.add('saved-pop');
        setTimeout(function(){ try{ wrap.classList.remove('saved-pop'); }catch(_){ } }, 650);
      }
    }catch(_){}
    try{
      if (typeof getAudio === 'function'){
        var ac = getAudio(); if (ac && ac.state === 'suspended') ac.resume();
      }
    }catch(_){}
    try{
      // "confirmação" - 3 notas rápidas
      if (window._gameBeep){
        window._gameBeep(660, 0.05, 'square', 0.05);
        setTimeout(function(){ window._gameBeep(880, 0.06, 'square', 0.05); }, 55);
        setTimeout(function(){ window._gameBeep(990, 0.07, 'triangle', 0.06); }, 120);
      }
    }catch(_){}

    _btnNameSave.textContent='Salvo!';
    setTimeout(function(){ _btnNameSave.textContent='Salvar'; },1200);
  };

  // Reset conta
  var btnReset=document.getElementById('btnResetAccount');
  if(btnReset) btnReset.onclick=function(){
    // Abre o modal customizado de confirmação
    var modal=document.getElementById('resetAccountModal');
    var inp=document.getElementById('resetAccountConfirmInput');
    var confirmBtn=document.getElementById('resetAccountConfirmBtn');
    if(!modal||!inp||!confirmBtn) return;
    // Pega o nome atual do jogador para usar como placeholder e validação
    var acct=acctLoad();
    var currentName=(acct.name||'').trim();
    // Placeholder apagadinho com o nome atual
    inp.placeholder=currentName||'(sem nome)';
    inp.value='';
    confirmBtn.disabled=true;
    confirmBtn.style.opacity='0.5';
    modal.style.display='flex';
    inp.focus();

    // Input: sons idênticos ao profileNameInput + validação
    var _rPrevLen=0;
    function _onResetInput(){
      try{
        var nowLen=(inp.value||'').length;
        var delta=nowLen-_rPrevLen; _rPrevLen=nowLen;
        if(delta>0){
          try{var base=640+Math.random()*120;if(window._gameBeep)window._gameBeep(base,0.028,'square',0.022);}catch(_){}
        }else if(delta<0){
          try{if(window._gameBeep)window._gameBeep(360+Math.random()*50,0.018,'square',0.016);}catch(_){}
        }
        // Habilitar botão só se o texto digitado for exatamente igual ao nome
        var typed=(inp.value||'');
        var matches=currentName.length>0?(typed===currentName):(typed.length===0);
        confirmBtn.disabled=!matches;
        confirmBtn.style.opacity=matches?'1':'0.5';
        inp.style.borderColor=typed.length>0?(matches?'#4ec94e':'#c23b22'):'#5a3a0a';
      }catch(_){}
    }
    inp.removeEventListener('input',inp._resetHandler);
    inp._resetHandler=_onResetInput;
    inp.addEventListener('input',_onResetInput);

    // Fechar com ESC
    function _onKey(e){
      if(e.key==='Escape'){_closeResetModal();document.removeEventListener('keydown',_onKey);}
    }
    document.addEventListener('keydown',_onKey);
  };

  function _closeResetModal(){
    var modal=document.getElementById('resetAccountModal');
    var inp=document.getElementById('resetAccountConfirmInput');
    if(modal){modal.style.display='none';}
    if(inp){inp.value='';inp.style.borderColor='#5a3a0a';}
  }

  // Handlers do modal de reiniciar conta — ligados com addEventListener após DOM pronto
  document.addEventListener('DOMContentLoaded',function(){
    var _cancelBtn=document.getElementById('resetAccountCancelBtn');
    if(_cancelBtn) _cancelBtn.addEventListener('click',function(){
      _closeResetModal();
    });
    var _confirmBtn2=document.getElementById('resetAccountConfirmBtn');
    if(_confirmBtn2) _confirmBtn2.addEventListener('click',function(){
      if(this.disabled) return;
      acctSave({level:1,exp:0,coins:0,skins:[0],equippedSkin:0,name:'',ownedNames:[0],equippedName:0});
      _closeResetModal();
      refreshMenu();
    });
  });
  // Botão Opções in-game: binding centralizado no options-menu-script

  // Aplicar skin salva ao carregar
  try{
    var _sa=acctLoad();
    if(typeof state!=='undefined'&&state){
      state.currentSkin=_sa.equippedSkin||0;
      if(state.unlockedSkins){ (_sa.skins||[0]).forEach(function(i){ state.unlockedSkins.add(i); }); }
    }
  }catch(e){}

  var _orig=window.showMenu;
  if(typeof _orig==='function') window.showMenu=function(){
    // Esconde o canvas e HUD do jogo antes de mostrar o menu
    try{
      var _gc=document.getElementById('game'); if(_gc) _gc.style.display='none';
      var _hu=document.querySelector('.hud'); if(_hu) _hu.style.display='none';
    }catch(_){}
    _orig.apply(this,arguments);
    refreshMenu();
  };

  refreshMenu();
})();










