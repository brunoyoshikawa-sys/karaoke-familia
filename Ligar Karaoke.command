#!/bin/bash
# ================================================================
# Ligar Karaokê — duplo clique aqui pra subir tudo automaticamente
# ================================================================
# O que este arquivo faz:
#  1. Entra na pasta onde ele mesmo está salvo (onde tambem devem
#     estar o karaoke.html e o server.py).
#  2. Sobe o servidor em segundo plano (continua rodando mesmo se
#     voce fechar esta janela do Terminal).
#  3. Espera um instante e abre o Palco e o Controle automaticamente
#     no navegador, ja com o IP certo.
# ================================================================

cd "$(dirname "$0")"

PORTA=8000

echo "Verificando se o Python esta instalado..."
if ! command -v python3 &> /dev/null; then
    echo ""
    echo "❌ Python 3 nao encontrado neste Mac."
    echo "Instale pelo site oficial: https://www.python.org/downloads/"
    echo ""
    read -p "Pressione Enter para fechar..."
    exit 1
fi

# Se ja tiver um servidor rodando nessa porta (de uma vez anterior), encerra e sobe
# um novo — assim garante que a versao mais recente do server.py esta rodando.
if lsof -i :$PORTA -sTCP:LISTEN &> /dev/null; then
    echo "Encerrando servidor anterior que estava na porta $PORTA..."
    lsof -ti :$PORTA -sTCP:LISTEN | xargs kill -9 2>/dev/null
    sleep 0.5
fi

echo "Subindo o servidor do karaokê na porta $PORTA..."
nohup python3 server.py $PORTA > /tmp/karaoke-server.log 2>&1 &
disown
sleep 1.5

# Descobre o IP da mesma forma que o server.py descobre, pra montar os links
IP=$(python3 -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
try:
    s.connect(('8.8.8.8', 80))
    print(s.getsockname()[0])
except Exception:
    print('localhost')
finally:
    s.close()
")

echo ""
echo "✅ Karaokê no ar!"
echo "   IP detectado: $IP"
echo ""

# -n forca uma janela nova (em vez de virar aba de uma janela ja aberta).
# Usa o IP de verdade (nao "localhost") para que a pagina ja saiba o proprio
# endereco de rede e gere o QR code sem precisar passar pela tela inicial.
# --start-fullscreen so no Palco, ja que ele vai pra TV (o Controle continua
# em janela normal, pra dar pra usar junto com outras coisas no notebook).
if [ -d "/Applications/Google Chrome.app" ]; then
    echo "Abrindo o Palco (em tela cheia) e o Controle no Google Chrome..."
    open -na "Google Chrome" --args --new-window --start-fullscreen "http://$IP:$PORTA/karaoke.html?view=palco"
    sleep 0.8
    open -na "Google Chrome" --args --new-window "http://$IP:$PORTA/karaoke.html?view=controle"
else
    echo "⚠️  Google Chrome nao foi encontrado neste Mac — abrindo no navegador padrao."
    open -n "http://$IP:$PORTA/karaoke.html?view=palco"
    sleep 0.8
    open -n "http://$IP:$PORTA/karaoke.html?view=controle"
fi

echo ""
echo "Pronto! Arraste a janela do Palco pra TV (ela ja abre em tela cheia)."
echo "Se precisar sair da tela cheia, aperte Esc ou Cmd+Ctrl+F."
echo "Esta janela do Terminal pode ficar aberta (ou minimizada) durante a festa."
echo ""
read -p "Pressione Enter para fechar esta janela (o servidor continua rodando)..."
