const { app, BrowserWindow, shell } = require('electron');
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
  intervaloMonitor = setInterval(async () => {
    if (win.isDestroyed()) {
      pararMonitoramento();
      return;
    }
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

  // Qualquer window.open() da pagina (hoje, so o botao "Abrir Controle") abre
  // no navegador padrao do sistema, em vez de criar outra janela do Electron.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('did-navigate', (_event, url) => {
    if (url.startsWith('https://www.youtube.com/watch')) {
      iniciarMonitoramento(win);
    } else {
      pararMonitoramento();
    }
  });

  win.loadURL(URL_PALCO);

  return win;
}

app.whenReady().then(() => {
  criarJanela();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  pararMonitoramento();
  if (process.platform !== 'darwin') app.quit();
});
