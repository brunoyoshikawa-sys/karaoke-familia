# Karaokê Palco — app de desktop (experimental)

Uma segunda forma de abrir o Palco, além do site normal. É a mesma tela do
Palco de sempre, só que numa janela própria em vez de uma aba do navegador —
com uma vantagem: quando alguém pede uma música com a incorporação bloqueada
pelo YouTube, esse app **volta sozinho pro Karaokê assim que o vídeo
termina**, sem precisar clicar em "Voltar".

Controle e Convidado continuam exatamente iguais — abrem no navegador normal
do celular/notebook, como sempre. Esse app aqui é só uma alternativa pra
quem hospeda, pra tela que vai na TV.

---

## Pra quem vai só instalar e usar (família, amigos)

Nenhum comando, nenhum terminal — é só isso:

1. Peça o arquivo `Karaokê Palco-1.0.0-arm64.dmg` pra quem está compartilhando
   (AirDrop, link do Google Drive, etc.) e dê duplo clique nele.
2. Vai abrir uma janela — arraste o ícone **Karaokê Palco** pra pasta
   **Applications** (o atalho que aparece do lado).
3. Abra o **Launchpad** (ou a pasta Applications) e clique em **Karaokê
   Palco**.
4. **Só na primeira vez**: o Mac vai avisar que é de um "desenvolvedor não
   identificado" — isso é normal (o app não tem uma assinatura paga da
   Apple). Clique com o **botão direito** no ícone → **Abrir** → confirme
   **Abrir mesmo assim**. Da próxima vez, abre normal com duplo clique.

Pronto — a janela do Palco abre sozinha, já conectada à mesma fila de
sempre.

---

## Pra quem vai gerar/atualizar o instalador (você)

Isso aqui já é técnico — só quem for mexer no código ou gerar uma versão
nova do `.dmg` precisa disso. Requer o [Node.js](https://nodejs.org)
instalado.

**Testar sem gerar instalador** (roda o app direto):
```bash
cd karaoke-desktop
npm install
npm start
```

**Gerar o `.dmg` pra distribuir**:
```bash
npm run build
```
O arquivo sai em `karaoke-desktop/dist/Karaokê Palco-1.0.0-arm64.dmg` —
esse é o arquivo que você compartilha com a família/amigos (passo acima).

Por padrão o app se conecta no servidor do Render
(`https://karaoke-familia.onrender.com`). Pra apontar pra um servidor local
em vez disso, edite `config.json` antes de gerar o instalador:
```json
{ "servidor": "http://localhost:8123" }
```
