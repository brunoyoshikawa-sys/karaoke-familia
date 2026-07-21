#!/usr/bin/env python3
"""
Servidor do Karaokê — Fila
--------------------------
Serve o karaoke.html normalmente (como um servidor de arquivos) e também
guarda o estado de cada "sala" (fila de músicas, quem está tocando) em
memória — cada sala é isolada das outras, identificada por um código na
URL (?sala=XXXXX), pra que pessoas diferentes abrindo o mesmo link público
não acabem compartilhando a mesma fila sem querer.

Como usar:
    python3 server.py           -> roda na porta 8000
    python3 server.py 8080      -> roda em outra porta, se quiser

Depois é só abrir, por exemplo:
    http://localhost:8000/karaoke.html?view=palco&sala=ABCDE
    http://localhost:8000/karaoke.html?view=controle&sala=ABCDE
    http://SEU_IP:8000/karaoke.html?view=convidado&sala=ABCDE
"""

import http.server
import json
import os
import socket
import sys
import threading
import time
import urllib.parse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CATALOGO_FILE = os.path.join(BASE_DIR, 'catalogo.json')
CATALOGO_INICIAL_FILE = os.path.join(BASE_DIR, 'catalogo_inicial.json')

lock = threading.Lock()
lock_catalogo = threading.Lock()

# Cada "sala" tem sua propria fila, isolada das outras — assim, como a URL
# agora e publica, duas pessoas diferentes abrindo o karaokê nao acabam
# compartilhando a mesma lista de musicas por acidente.
# Estrutura: { "ABCDE": {"queue": [...], "current": ..., "last_access": 123456} }
rooms = {}

SALA_PADRAO = 'geral'  # usada só se alguem abrir um link antigo, sem ?sala=
TEMPO_EXPIRACAO_SEGUNDOS = 12 * 60 * 60  # salas sem uso ha 12h sao descartadas

# Catálogo de músicas favoritas — é GLOBAL (não depende da sala), curado só
# pelo Controle, pra todo mundo poder escolher de uma lista pronta em vez de
# ter que colar link do YouTube toda vez. Algumas entradas já têm "id" (vídeo
# verificado), outras têm "id": None (ainda sem link — o link é buscado na
# hora, quando o convidado escolhe a música).
CATALOGO_INICIAL_PADRAO = [
    {"id": "9VSjlVm2qF8", "titulo": "Nacionais 70, 80 e 90 - Mais Cantadas no Karaokê",
     "artista": "Coletânea", "idioma": "Português", "playlist": "Sugestões"},
]


def carregar_catalogo_inicial():
    if os.path.exists(CATALOGO_INICIAL_FILE):
        try:
            with open(CATALOGO_INICIAL_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except Exception:
            pass
    return list(CATALOGO_INICIAL_PADRAO)


def carregar_catalogo():
    if not os.path.exists(CATALOGO_FILE):
        return carregar_catalogo_inicial()
    try:
        with open(CATALOGO_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
    except Exception:
        pass
    return carregar_catalogo_inicial()


def salvar_catalogo(catalogo):
    try:
        with open(CATALOGO_FILE, 'w', encoding='utf-8') as f:
            json.dump(catalogo, f, ensure_ascii=False)
    except Exception:
        pass  # se o disco for so-leitura (alguns hosts), o catalogo so fica em memoria


catalogo = carregar_catalogo()


def get_room(sala_id):
    sala_id = (sala_id or SALA_PADRAO).strip().upper()[:20] or SALA_PADRAO
    room = rooms.get(sala_id)
    if room is None:
        room = {"queue": [], "current": None}
        rooms[sala_id] = room
    room['last_access'] = time.time()
    _limpar_salas_antigas()
    return sala_id, room


def _limpar_salas_antigas():
    agora = time.time()
    expiradas = [sid for sid, r in rooms.items()
                 if agora - r.get('last_access', agora) > TEMPO_EXPIRACAO_SEGUNDOS]
    for sid in expiradas:
        del rooms[sid]


def detectar_ip_local():
    """Descobre o IP da máquina na rede local, sem precisar de internet de verdade
    (o 'connect' aqui é só um truque do sistema operacional para saber por qual
    interface de rede a máquina se comunicaria — nenhum pacote é realmente enviado)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        try:
            ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            ip = '127.0.0.1'
    finally:
        s.close()
    return ip


class KaraokeHandler(http.server.SimpleHTTPRequestHandler):

    def end_headers(self):
        # nunca deixa o navegador guardar cache do HTML/JS — evita o classico
        # "fiz a atualizacao mas continua aparecendo a versao antiga"
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def _send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
        except (TypeError, ValueError):
            length = 0
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def _sala_da_query(self, parsed):
        qs = urllib.parse.parse_qs(parsed.query)
        return qs.get('sala', [''])[0]

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def list_directory(self, path):
        # nunca mostra o conteudo de pastas (nem a raiz, nem .git, nem .venv, etc.)
        self.send_error(403, "Listagem de pasta desativada")
        return None

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/' or parsed.path == '':
            # serve o karaoke.html direto (200 OK) em vez de redirecionar (302) —
            # servicos de hospedagem costumam checar a raiz "/" pra saber se o
            # app esta saudavel, e um redirecionamento pode ser mal interpretado
            # como "servico com problema", causando reinicios em loop.
            self.path = '/karaoke.html'
            return super().do_GET()
        if parsed.path == '/api/state':
            with lock:
                _, room = get_room(self._sala_da_query(parsed))
                state = {"queue": room['queue'], "current": room['current']}
            self._send_json(state)
            return
        if parsed.path == '/api/serverinfo':
            self._send_json({'ip': self.server.ip_detectado, 'port': self.server.server_port})
            return
        if parsed.path == '/api/catalogo':
            with lock_catalogo:
                self._send_json({'catalogo': catalogo})
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        body = self._read_json_body()
        sala_param = body.get('sala') or self._sala_da_query(parsed)

        if parsed.path == '/api/queue/add':
            with lock:
                _, room = get_room(sala_param)
                room['queue'].append({
                    'id': body.get('id'),
                    'titulo': body.get('titulo') or 'Música',
                    'cantor': body.get('cantor') or 'Convidado(a)',
                    'addedAt': body.get('addedAt', 0),
                })
                state = {"queue": room['queue'], "current": room['current']}
            self._send_json(state)
            return

        if parsed.path == '/api/queue/advance':
            with lock:
                _, room = get_room(sala_param)
                if room['queue']:
                    room['current'] = room['queue'].pop(0)
                else:
                    room['current'] = None
                state = {"queue": room['queue'], "current": room['current']}
            self._send_json(state)
            return

        if parsed.path == '/api/queue/remove':
            with lock:
                _, room = get_room(sala_param)
                idx = body.get('index')
                q = room['queue']
                if isinstance(idx, int) and 0 <= idx < len(q):
                    q.pop(idx)
                state = {"queue": room['queue'], "current": room['current']}
            self._send_json(state)
            return

        if parsed.path == '/api/queue/move':
            with lock:
                _, room = get_room(sala_param)
                idx = body.get('index')
                direction = body.get('direction')
                q = room['queue']
                if isinstance(idx, int) and isinstance(direction, int):
                    new_idx = idx + direction
                    if 0 <= idx < len(q) and 0 <= new_idx < len(q):
                        q[idx], q[new_idx] = q[new_idx], q[idx]
                state = {"queue": room['queue'], "current": room['current']}
            self._send_json(state)
            return

        if parsed.path == '/api/catalogo/add':
            with lock_catalogo:
                catalogo.append({
                    'id': body.get('id'),
                    'titulo': body.get('titulo') or 'Música',
                    'artista': body.get('artista') or '',
                    'idioma': body.get('idioma') or 'Outro',
                    'playlist': body.get('playlist') or '',
                })
                salvar_catalogo(catalogo)
                resultado = list(catalogo)
            self._send_json({'catalogo': resultado})
            return

        if parsed.path == '/api/catalogo/remove':
            with lock_catalogo:
                idx = body.get('index')
                if isinstance(idx, int) and 0 <= idx < len(catalogo):
                    catalogo.pop(idx)
                salvar_catalogo(catalogo)
                resultado = list(catalogo)
            self._send_json({'catalogo': resultado})
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        # deixa o terminal mais limpo (comente esta linha se quiser ver os logs de acesso)
        pass


if __name__ == '__main__':
    # Serviços de hospedagem (Render, Railway, etc.) definem a porta via variável
    # de ambiente PORT. Localmente, continua funcionando do jeito de sempre.
    porta_env = os.environ.get('PORT')
    if porta_env:
        port = int(porta_env)
        modo_nuvem = True
    else:
        port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
        modo_nuvem = False

    os.chdir(BASE_DIR)
    server = http.server.ThreadingHTTPServer(('0.0.0.0', port), KaraokeHandler)

    print('=' * 52)
    print('  Servidor do Karaokê rodando!')
    print('=' * 52)
    if modo_nuvem:
        server.ip_detectado = None
        print(f'  Rodando na nuvem, porta {port}.')
        print('  A URL publica e a que o servico de hospedagem fornecer.')
    else:
        ip = detectar_ip_local()
        server.ip_detectado = ip
        print(f'  Página inicial:  http://localhost:{port}/karaoke.html')
        print(f'  IP detectado:    {ip}')
        print()
        print('  Deixe este Terminal aberto enquanto a festa rolar.')
        print('  Pressione Ctrl+C para parar o servidor.')
    print('=' * 52)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServidor encerrado.')
