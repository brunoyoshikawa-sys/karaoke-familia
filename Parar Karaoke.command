#!/bin/bash
# ================================================================
# Parar Karaokê — duplo clique aqui pra encerrar o servidor
# ================================================================

PORTA=8000

echo "Procurando o servidor do karaokê na porta $PORTA..."

PID=$(lsof -ti :$PORTA -sTCP:LISTEN)

if [ -z "$PID" ]; then
    echo "Nenhum servidor encontrado rodando na porta $PORTA — nada pra fazer."
else
    kill -9 $PID
    echo "✅ Servidor encerrado (processo $PID)."
fi

echo ""
read -p "Pressione Enter para fechar esta janela..."
