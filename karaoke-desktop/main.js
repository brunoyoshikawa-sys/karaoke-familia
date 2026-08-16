const { app, BrowserWindow, shell, session } = require('electron');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const SERVIDOR = config.servidor.replace(/\/$/, '');

const salaFile = path.join(app.getPath('userData'), 'sala.json');

// mesma lógica de karaoke.html (gerarCodigoSala): 5 caracteres, sem 0/O/1/I/L
// pra evitar confusão na hora de ler/digitar
function gerarCodigoSala() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function obterOuCriarSala() {
  try {
    const salva = JSON.parse(fs.readFileSync(salaFile, 'utf-8'));
    if (salva && salva.sala) return salva.sala;
  } catch (e) {
    // primeira vez rodando, ou arquivo corrompido — gera uma sala nova
  }
  const nova = gerarCodigoSala();
  fs.writeFileSync(salaFile, JSON.stringify({ sala: nova }));
  return nova;
}

const SALA = obterOuCriarSala();
const URL_PALCO = `${SERVIDOR}/karaoke.html?view=palco&sala=${SALA}`;
const URL_CONTROLE = `${SERVIDOR}/karaoke.html?view=controle&sala=${SALA}`;
const PREFIXO_URL_CONTROLE = `${SERVIDOR}/karaoke.html?view=controle`;

// CSS injetado na pagina real do youtube.com pra esconder cabecalho, barra
// lateral, comentarios etc. e fazer o player ocupar a janela inteira — fica
// parecido com o tamanho do player normal do Palco, em vez do site cheio do
// YouTube. Reaplicado a cada tick do monitoramento porque o YouTube e um SPA
// e pode re-renderizar (trocar de video, por exemplo) sem recarregar a pagina.
const ESTILO_LIMPO_ID = 'karaoke-estilo-limpo';
const CSS_LIMPO = `
  html, body { background:#000 !important; overflow:hidden !important; }
  #masthead-container, #secondary, #comments, #related, #chat,
  ytd-watch-metadata, tp-yt-app-drawer, ytd-merch-shelf-renderer {
    display:none !important;
  }
  #primary, #primary-inner, #columns, #page-manager, ytd-watch-flexy,
  #content, #full-bleed-container {
    width:100% !important; max-width:none !important; margin:0 !important; padding:0 !important;
  }
  #player, #player-container-outer, #player-container-inner, #movie_player {
    position:fixed !important; inset:0 !important;
    width:100vw !important; height:100vh !important; max-width:none !important;
    margin:0 !important; z-index:999999 !important;
  }
`;

// Enquanto o video bloqueado toca no youtube.com, o botao "Abrir Controle"
// que existe na tela do Palco some (nao e mais a nossa pagina) — sem ele, so
// dava pra abrir o Controle depois que o video terminasse e voltasse pro
// Palco. Esse botao flutuante resolve isso, injetado na propria pagina do
// YouTube; o clique dispara um window.open() normal, que ja cai no mesmo
// setWindowOpenHandler que abre o Controle no navegador do sistema.
const BOTAO_CONTROLE_ID = 'karaoke-botao-controle';

function garantirVisualLimpo(win) {
  win.webContents.executeJavaScript(`
    (function(){
      if (!document.getElementById('${ESTILO_LIMPO_ID}')) {
        var s = document.createElement('style');
        s.id = '${ESTILO_LIMPO_ID}';
        s.textContent = ${JSON.stringify(CSS_LIMPO)};
        document.head.appendChild(s);
      }
      if (!document.getElementById('${BOTAO_CONTROLE_ID}')) {
        var b = document.createElement('button');
        b.id = '${BOTAO_CONTROLE_ID}';
        b.textContent = '⚙️ Controle';
        b.style.cssText = 'position:fixed; left:16px; top:16px; z-index:1000000; ' +
          'padding:10px 18px; border:none; border-radius:10px; background:#FF2E88; ' +
          'color:#fff; font-family:sans-serif; font-size:14px; font-weight:600; ' +
          'cursor:pointer; opacity:0.88; box-shadow:0 2px 10px rgba(0,0,0,.4);';
        b.onmouseenter = function(){ b.style.opacity = '1'; };
        b.onmouseleave = function(){ b.style.opacity = '0.88'; };
        b.onclick = function(){ window.open(${JSON.stringify(URL_CONTROLE)}, '_blank'); };
        document.body.appendChild(b);
      }
    })();
  `).catch(() => {});
}

// Monitora a pagina do YouTube (quando um video bloqueado manda a janela pra
// la — mecanismo que ja existe em karaoke.html, tocarBloqueadoNoYoutube())
// pra voltar sozinho assim que o video terminar, sem precisar de clique.
let intervaloMonitor = null;

function pararMonitoramento() {
  if (intervaloMonitor) {
    clearInterval(intervaloMonitor);
    intervaloMonitor = null;
  }
}

function iniciarMonitoramento(win) {
  pararMonitoramento();
  console.log('[karaoke] vídeo bloqueado aberto no YouTube — monitorando até terminar...');
  garantirVisualLimpo(win);
  intervaloMonitor = setInterval(async () => {
    if (win.isDestroyed()) {
      pararMonitoramento();
      return;
    }
    garantirVisualLimpo(win);
    try {
      const terminou = await win.webContents.executeJavaScript(
        "(function(){ var v = document.querySelector('video'); return !!(v && v.ended); })()"
      );
      if (terminou) {
        pararMonitoramento();
        console.log('[karaoke] vídeo terminou — voltando pro Palco');
        win.loadURL(URL_PALCO);
      }
    } catch (e) {
      // pagina ainda carregando ou trocou de contexto — tenta de novo no proximo tick
    }
  }, 2000);
}

function criarJanela() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Karaokê — Palco',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);

  // So o botao "Abrir Controle" deve abrir janela nova (no navegador padrao
  // do sistema). Qualquer outro window.open() — inclusive os que a propria
  // pagina do youtube.com dispara sozinha (login, consentimento, anuncios) —
  // e simplesmente bloqueado, pra nunca abrir uma janela/aba extra.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(PREFIXO_URL_CONTROLE)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('did-navigate', (_event, url) => {
    if (url.startsWith('https://www.youtube.com/watch')) {
      iniciarMonitoramento(win);
    } else {
      pararMonitoramento();
    }
  });

  // Aplica o visual limpo assim que o DOM da pagina existe, sem esperar o
  // primeiro tick do monitoramento (ate 2s de atraso) — some com o
  // cabecalho/menu do YouTube o mais rapido possivel.
  win.webContents.on('dom-ready', () => {
    if (win.webContents.getURL().startsWith('https://www.youtube.com/watch')) {
      garantirVisualLimpo(win);
    }
  });

  // Se a pagina travar/cair (ex: o youtube.com e bem mais pesado que o
  // Palco), a janela fica presa numa tela morta sem nenhum aviso. Em vez de
  // deixar assim, volta sozinho pro Palco.
  win.webContents.on('render-process-gone', (_event, details) => {
    console.log('[karaoke] a pagina travou (' + details.reason + ') — voltando pro Palco');
    pararMonitoramento();
    if (!win.isDestroyed()) win.loadURL(URL_PALCO);
  });

  win.loadURL(URL_PALCO);

  return win;
}

// uBlock Origin (código aberto, GPL-3.0) embutido pra filtrar os anúncios do
// YouTube quando um vídeo bloqueado toca la — ver vendor/ublock-origin/LICENSE.txt.
// Extensao de navegador precisa de arquivos reais em disco (nao funciona de
// dentro do app.asar), por isso o build desse app roda com "asar": false.
const PASTA_UBLOCK = path.join(__dirname, 'vendor', 'ublock-origin');

app.whenReady().then(async () => {
  try {
    await session.defaultSession.loadExtension(PASTA_UBLOCK, { allowFileAccess: true });
    console.log('[karaoke] uBlock Origin carregado');
  } catch (e) {
    console.log('[karaoke] falha ao carregar uBlock Origin:', e.message);
  }

  criarJanela();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  pararMonitoramento();
  if (process.platform !== 'darwin') app.quit();
});
