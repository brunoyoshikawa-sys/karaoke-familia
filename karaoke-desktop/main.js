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
const URL_ESTADO = `${SERVIDOR}/api/state?sala=${SALA}`;
const URL_LIMPAR_YOUTUBE = `${SERVIDOR}/api/queue/limpar-youtube-atual?sala=${SALA}`;

// Pra saber se alguem apertou "Pular" no Controle enquanto o video bloqueado
// toca no youtube.com de verdade — nesse caso nao tem nenhum JS nosso rodando
// na pagina pra perceber isso sozinho (nao e mais a nossa pagina).
//
// Usa 'youtubeAtual' (nao 'current'): 'current' ja e pre-avancado pra proxima
// musica assim que a tela vem pro youtube.com, entao ele NAO muda quando o
// Controle aperta "Pular" nesse meio tempo (server.py so limpa youtube_atual
// nesse caso, sem tirar mais ninguem da fila — ver /api/queue/advance). Ou
// seja, 'youtubeAtual' e quem realmente reflete "saimos do video que estava
// aqui", que e o sinal certo pra saber quando voltar pro Palco.
async function obterYoutubeAtualNoServidor() {
  try {
    const r = await fetch(URL_ESTADO, { cache: 'no-store' });
    const data = await r.json();
    return data.youtubeAtual ? data.youtubeAtual.id : null;
  } catch (e) {
    return undefined; // sem servidor/rede — nao da pra saber, nao trata como mudanca
  }
}

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
//
// O youtube.com as vezes dispara 'did-navigate' mais de uma vez pro MESMO
// video (ex: um redirecionamento intermediario que tambem bate com o prefixo
// '/watch'), o que chamaria iniciarMonitoramento() duas vezes em paralelo.
// Como a primeira parte dessa funcao e assincrona (espera o /api/state
// responder antes de criar o setInterval), sem cuidado isso deixava DOIS
// monitoramentos rodando ao mesmo tempo, cada um capaz de mandar a janela
// de volta pro Palco por conta propria — daí a instabilidade (fila avançando
// mais de uma música, tela do Controle dessincronizando). O "numero de
// geracao" invalida qualquer chamada antiga que ainda esteja no meio do
// caminho assim que uma nova comeca.
let intervaloMonitor = null;
let geracaoMonitor = 0;
let voltandoParaPalco = false;

function pararMonitoramento() {
  geracaoMonitor++; // invalida qualquer iniciarMonitoramento() ainda esperando o /api/state
  if (intervaloMonitor) {
    clearInterval(intervaloMonitor);
    intervaloMonitor = null;
  }
}

function voltarProPalco(win, motivo) {
  if (voltandoParaPalco || win.isDestroyed()) return;
  voltandoParaPalco = true;
  pararMonitoramento();
  console.log('[karaoke] ' + motivo + ' — voltando pro Palco');
  // limpa o "youtube_atual" no servidor — sem isso, o Controle continuaria
  // mostrando esse video como tocando mesmo depois de ja termos saido dele.
  // Chamar de novo apos um "pular" (que ja limpa isso sozinho no servidor)
  // e inofensivo, so um POST a mais.
  fetch(URL_LIMPAR_YOUTUBE, { method: 'POST' }).catch(() => {});
  win.loadURL(URL_PALCO);
}

async function iniciarMonitoramento(win) {
  pararMonitoramento();
  const minhaGeracao = geracaoMonitor;
  console.log('[karaoke] vídeo bloqueado aberto no YouTube — monitorando até terminar...');
  garantirVisualLimpo(win);

  // id de 'youtubeAtual' no servidor nesse momento — deve ser o proprio video que
  // acabou de abrir aqui (tocarBloqueadoNoYoutube manda o /api/queue/ir-para-youtube
  // antes de navegar, que grava isso). Se sumir (virar null) enquanto ainda estamos
  // aqui, e porque alguem apertou "Pular" no Controle — nesse caso volta na hora.
  const idQuandoComecou = await obterYoutubeAtualNoServidor();

  // enquanto esperavamos a resposta acima, outra chamada a iniciarMonitoramento
  // pode ter acontecido (did-navigate duplicado) — essa aqui ficou desatualizada,
  // deixa a mais recente no comando e nao cria um segundo setInterval.
  if (minhaGeracao !== geracaoMonitor) return;

  // capturado numa variavel local (nao a "intervaloMonitor" compartilhada) pra
  // esse callback so cancelar A SI MESMO — se usasse a variavel compartilhada,
  // um callback antigo/invalidado poderia acabar cancelando por engano um
  // monitoramento mais novo, que ja sobrescreveu essa variavel nesse meio tempo.
  const meuIntervalo = setInterval(async () => {
    if (minhaGeracao !== geracaoMonitor || win.isDestroyed()) {
      clearInterval(meuIntervalo);
      return;
    }
    garantirVisualLimpo(win);

    if (idQuandoComecou !== undefined) {
      const idAgora = await obterYoutubeAtualNoServidor();
      if (minhaGeracao !== geracaoMonitor) return; // invalidado enquanto esperava essa resposta
      if (idAgora !== undefined && idAgora !== idQuandoComecou) {
        voltarProPalco(win, 'fila avançou (pular)');
        return;
      }
    }

    try {
      const terminou = await win.webContents.executeJavaScript(
        "(function(){ var v = document.querySelector('video'); return !!(v && v.ended); })()"
      );
      if (minhaGeracao !== geracaoMonitor) return;
      if (terminou) {
        voltarProPalco(win, 'vídeo terminou');
      }
    } catch (e) {
      // pagina ainda carregando ou trocou de contexto — tenta de novo no proximo tick
    }
  }, 2000);
  intervaloMonitor = meuIntervalo;
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
      voltandoParaPalco = false; // chegou num lugar que nao e o youtube.com/watch — destrava
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
    voltarProPalco(win, 'a página travou (' + details.reason + ')');
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
