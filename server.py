#!/usr/bin/env python3
"""
Servidor do Karaokê — Fila
--------------------------
Serve o karaoke.html normalmente (como um servidor de arquivos) e também
guarda o estado da fila (quem está tocando, quem é o próximo) num arquivo
local (karaoke_state.json), para que o notebook, a TV e os celulares dos
convidados vejam sempre a MESMA fila.

Como usar:
    python3 server.py           -> roda na porta 8000
    python3 server.py 8080      -> roda em outra porta, se quiser

Depois é só abrir, por exemplo:
    http://localhost:8000/karaoke.html?view=palco
    http://localhost:8000/karaoke.html?view=controle
    http://SEU_IP:8000/karaoke.html?view=convidado
"""

import http.server
import json
import os
import socket
import sys
import threading
import urllib.parse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(BASE_DIR, 'karaoke_state.json')

lock = threading.Lock()

DEFAULT_STATE = {"queue": [], "current": None}


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


def load_state():
    if not os.path.exists(STATE_FILE):
        return dict(DEFAULT_STATE)
    try:
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            data.setdefault('queue', [])
            data.setdefault('current', None)
            return data
    except Exception:
        return dict(DEFAULT_STATE)


def save_state(state):
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False)


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

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/state':
            with lock:
                state = load_state()
            self._send_json(state)
            return
        if parsed.path == '/api/serverinfo':
            self._send_json({'ip': self.server.ip_detectado, 'port': self.server.server_port})
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        body = self._read_json_body()

        if parsed.path == '/api/queue/add':
            with lock:
                state = load_state()
                state['queue'].append({
                    'id': body.get('id'),
                    'titulo': body.get('titulo') or 'Música',
                    'cantor': body.get('cantor') or 'Convidado(a)',
                    'addedAt': body.get('addedAt', 0),
                })
                save_state(state)
            self._send_json(state)
            return

        if parsed.path == '/api/queue/advance':
            with lock:
                state = load_state()
                if state['queue']:
                    state['current'] = state['queue'].pop(0)
                else:
                    state['current'] = None
                save_state(state)
            self._send_json(state)
            return

        if parsed.path == '/api/queue/remove':
            with lock:
                state = load_state()
                idx = body.get('index')
                q = state['queue']
                if isinstance(idx, int) and 0 <= idx < len(q):
                    q.pop(idx)
                save_state(state)
            self._send_json(state)
            return

        if parsed.path == '/api/queue/move':
            with lock:
                state = load_state()
                idx = body.get('index')
                direction = body.get('direction')
                q = state['queue']
                if isinstance(idx, int) and isinstance(direction, int):
                    new_idx = idx + direction
                    if 0 <= idx < len(q) and 0 <= new_idx < len(q):
                        q[idx], q[new_idx] = q[new_idx], q[idx]
                save_state(state)
            self._send_json(state)
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
